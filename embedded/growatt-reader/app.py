from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from threading import Event, Lock, Thread
from uuid import uuid4
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, render_template, request
from waitress import serve

from config import settings
from data_store import DataStore
from growatt_decoder import decode_overview, register_slice
from modbus_client import GrowattModbusClient
from poller import SnapshotPoller
from register_catalog import definitions_by_type
from serial_client import TcpSerialClient

app = Flask(__name__)
data_store = DataStore(settings.database_path)
BERLIN_TZ = ZoneInfo("Europe/Berlin")

HISTORY_FIELD_DEFINITIONS = {
    "pv_total_power_w": {
        "label": "PV Gesamt",
        "unit": "W",
        "source": "column",
    },
    "ac_total_power_w": {
        "label": "AC Gesamt",
        "unit": "W",
        "source": "column",
    },
    "battery_net_power_w": {
        "label": "Netto Batteriefluss",
        "unit": "W",
        "source": "payload",
    },
    "battery_charge_power_w": {
        "label": "Batterie laedt",
        "unit": "W",
        "source": "payload",
    },
    "battery_discharge_power_w": {
        "label": "Batterie entlaedt",
        "unit": "W",
        "source": "payload",
    },
    "battery_soc_percent": {
        "label": "SOC",
        "unit": "%",
        "source": "column",
    },
    "battery_voltage_v": {
        "label": "Batterie Spannung",
        "unit": "V",
        "source": "payload",
    },
    "battery_current_a": {
        "label": "Batterie Strom",
        "unit": "A",
        "source": "payload",
    },
    "load_power_w": {
        "label": "Load Power",
        "unit": "W",
        "source": "payload",
    },
    "import_from_grid_w": {
        "label": "Import from Grid",
        "unit": "W",
        "source": "payload",
    },
    "export_to_grid_w": {
        "label": "Export to Grid",
        "unit": "W",
        "source": "payload",
    },
    "curtailment_estimate_w": {
        "label": "Abregelung geschaetzt",
        "unit": "W",
        "source": "column",
    },
    "limited_output_power_w": {
        "label": "Leistungslimit Laufzeit",
        "unit": "W",
        "source": "payload",
    },
}


@dataclass(slots=True)
class JobState:
    job_id: str
    job_type: str
    status: str
    message: str
    progress_current: int = 0
    progress_total: int = 0
    current_unit_id: int | None = None
    current_address: int | None = None
    result: dict = field(default_factory=dict)


class JobManager:
    def __init__(self) -> None:
        self._lock = Lock()
        self._jobs: dict[str, JobState] = {}
        self._stop_events: dict[str, Event] = {}

    def start_job(self, job_type: str, worker) -> JobState:
        with self._lock:
            existing = self._find_active_job(job_type)
            if existing is not None:
                return existing

            job = JobState(
                job_id=str(uuid4()),
                job_type=job_type,
                status="running",
                message="Job gestartet.",
            )
            stop_event = Event()
            self._jobs[job.job_id] = job
            self._stop_events[job.job_id] = stop_event

        thread = Thread(
            target=worker,
            args=(job.job_id, stop_event),
            daemon=True,
        )
        thread.start()
        return job

    def _find_active_job(self, job_type: str) -> JobState | None:
        for job in self._jobs.values():
            if job.job_type == job_type and job.status == "running":
                return job
        return None

    def update_job(self, job_id: str, **updates) -> None:
        with self._lock:
            job = self._jobs[job_id]
            for key, value in updates.items():
                setattr(job, key, value)

    def get_job(self, job_id: str) -> JobState | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            return JobState(**asdict(job))

    def stop_job(self, job_id: str) -> JobState | None:
        with self._lock:
            stop_event = self._stop_events.get(job_id)
            job = self._jobs.get(job_id)
            if stop_event is None or job is None:
                return None
            stop_event.set()
            if job.status == "running":
                job.message = "Abbruch angefordert. Aktueller Schritt wird beendet."
            return JobState(**asdict(job))

    def serialize(self, job: JobState | None) -> dict:
        if job is None:
            return {"message": "Job nicht gefunden."}
        return asdict(job)


job_manager = JobManager()


@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


def build_client(
    host: str | None = None,
    port: int | None = None,
    timeout: float | None = None,
) -> TcpSerialClient:
    return TcpSerialClient(
        host=host or settings.serial_server_host,
        port=port or settings.serial_server_port,
        timeout=timeout or settings.serial_server_timeout,
    )


def build_modbus_client(
    host: str | None = None,
    port: int | None = None,
    timeout: float | None = None,
) -> GrowattModbusClient:
    return GrowattModbusClient(
        host=host or settings.serial_server_host,
        port=port or settings.serial_server_port,
        timeout=timeout or settings.serial_server_timeout,
    )


@app.get("/")
def index() -> str:
    return render_template(
        "index.html",
        serial_host=settings.serial_server_host,
        serial_port=settings.serial_server_port,
        serial_timeout=settings.serial_server_timeout,
        modbus_unit_id=settings.modbus_unit_id,
        modbus_probe_address=settings.modbus_probe_address,
        modbus_probe_count=settings.modbus_probe_count,
    )


@app.get("/api/health")
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


@app.get("/api/serial-server/probe")
def probe_serial_server():
    host = request.args.get("host", settings.serial_server_host).strip()
    port = request.args.get("port", default=settings.serial_server_port, type=int)
    timeout = request.args.get(
        "timeout",
        default=settings.serial_server_timeout,
        type=float,
    )

    if not host:
        return jsonify({"message": "Host darf nicht leer sein."}), 400

    if port is None or port <= 0 or port > 65535:
        return jsonify({"message": "Port muss zwischen 1 und 65535 liegen."}), 400

    if timeout is None or timeout <= 0:
        return jsonify({"message": "Timeout muss groesser als 0 sein."}), 400

    result = build_client(host=host, port=port, timeout=timeout).probe()
    status_code = 200 if result.connected else 503
    return jsonify(
        {
            "host": result.host,
            "port": result.port,
            "connected": result.connected,
            "latency_ms": result.latency_ms,
            "message": result.message,
        }
    ), status_code


def parse_common_connection_args() -> tuple[str, int | None, float | None]:
    host = request.args.get("host", settings.serial_server_host).strip()
    port = request.args.get("port", default=settings.serial_server_port, type=int)
    timeout = request.args.get(
        "timeout",
        default=settings.serial_server_timeout,
        type=float,
    )
    return host, port, timeout


def validate_connection_args(host: str, port: int | None, timeout: float | None):
    if not host:
        return "Host darf nicht leer sein."
    if port is None or port <= 0 or port > 65535:
        return "Port muss zwischen 1 und 65535 liegen."
    if timeout is None or timeout <= 0:
        return "Timeout muss groesser als 0 sein."
    return None


def current_timestamps() -> tuple[str, str]:
    utc_now = datetime.now(timezone.utc)
    local_now = utc_now.astimezone(BERLIN_TZ)
    return utc_now.isoformat(), local_now.isoformat()


def parse_logger_interval_value() -> int | None:
    payload = request.get_json(silent=True) or {}
    if "interval_seconds" in payload:
        try:
            return int(payload["interval_seconds"])
        except (TypeError, ValueError):
            return None

    for source in (request.form, request.args):
        value = source.get("interval_seconds")
        if value is not None and value != "":
            try:
                return int(value)
            except ValueError:
                return None
    return None


def validate_logger_interval(interval_seconds: int | None) -> str | None:
    if interval_seconds is None:
        return "Logger-Intervall fehlt oder ist ungueltig."
    if interval_seconds < 5 or interval_seconds > 3600:
        return "Logger-Intervall muss zwischen 5 und 3600 Sekunden liegen."
    return None


def parse_utc_timestamp(value: str | None, fallback: datetime) -> datetime:
    if not value:
        return fallback

    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def epoch_to_local_iso(value: float | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value, timezone.utc).astimezone(BERLIN_TZ).isoformat()


def serialize_poller_status() -> dict:
    status = asdict(poller.status())
    status["last_run_at_local"] = epoch_to_local_iso(status["last_run_at"])
    status["last_success_at_local"] = epoch_to_local_iso(status["last_success_at"])
    return status


def extract_history_field(snapshot_row: dict, payload: dict, field_name: str):
    if field_name == "pv_total_power_w":
        return snapshot_row.get("pv_total_power_w")
    if field_name == "ac_total_power_w":
        return snapshot_row.get("ac_total_power_w")
    if field_name == "battery_net_power_w":
        return payload.get("battery", {}).get("battery_power_w")
    if field_name == "battery_charge_power_w":
        return payload.get("battery", {}).get("charge_power_w")
    if field_name == "battery_discharge_power_w":
        return payload.get("battery", {}).get("discharge_power_w")
    if field_name == "battery_soc_percent":
        return snapshot_row.get("battery_soc_percent")
    if field_name == "battery_voltage_v":
        return payload.get("battery", {}).get("battery_voltage_v")
    if field_name == "battery_current_a":
        return payload.get("battery", {}).get("battery_current_a")
    if field_name == "load_power_w":
        return payload.get("live", {}).get("estimated_load_power_w")
    if field_name == "import_from_grid_w":
        return payload.get("live", {}).get("estimated_import_from_grid_w")
    if field_name == "export_to_grid_w":
        return payload.get("live", {}).get("estimated_export_to_grid_w")
    if field_name == "curtailment_estimate_w":
        return snapshot_row.get("curtailment_estimate_w")
    if field_name == "limited_output_power_w":
        return payload.get("live", {}).get("limited_output_power_w")
    return None


def read_block(
    host: str,
    port: int,
    timeout: float,
    unit_id: int,
    register_type: str,
    address: int,
    count: int,
) -> tuple[bool, dict[int, int], str]:
    result = build_modbus_client(host=host, port=port, timeout=timeout).read_registers(
        unit_id=unit_id,
        register_type=register_type,
        address=address,
        count=count,
    )
    if not result.success:
        return False, {}, result.message
    return True, register_slice(result.values, address), result.message


def collect_register_sets(
    host: str,
    port: int,
    timeout: float,
    unit_id: int,
) -> tuple[dict[int, int], dict[int, int], dict[int, int], dict[str, str]]:
    input_registers: dict[int, int] = {}
    holding_registers: dict[int, int] = {}
    battery_registers: dict[int, int] = {}
    messages: dict[str, str] = {}

    for start in (0, 125):
        ok, block, message = read_block(
            host=host,
            port=port,
            timeout=timeout,
            unit_id=unit_id,
            register_type="input",
            address=start,
            count=125,
        )
        messages[f"input_{start}"] = message
        if ok:
            input_registers.update(block)
        elif start == 0:
            raise RuntimeError(f"Input-Register konnten nicht gelesen werden: {message}")

    for start in (0, 125):
        ok, block, message = read_block(
            host=host,
            port=port,
            timeout=timeout,
            unit_id=unit_id,
            register_type="holding",
            address=start,
            count=125,
        )
        messages[f"holding_{start}"] = message
        if ok:
            holding_registers.update(block)

    for start, count in ((3166, 25), (3211, 3)):
        ok, block, message = read_block(
            host=host,
            port=port,
            timeout=timeout,
            unit_id=unit_id,
            register_type="input",
            address=start,
            count=count,
        )
        messages[f"battery_{start}"] = message
        if ok:
            battery_registers.update(block)

    return input_registers, holding_registers, battery_registers, messages


def collect_overview_payload(
    host: str,
    port: int,
    timeout: float,
    unit_id: int,
) -> dict:
    input_registers, holding_registers, battery_registers, messages = collect_register_sets(
        host=host,
        port=port,
        timeout=timeout,
        unit_id=unit_id,
    )

    overview = decode_overview(
        input_registers=input_registers,
        holding_registers=holding_registers,
        battery_registers=battery_registers,
    )

    captured_at_utc, captured_at_local = current_timestamps()
    return {
        "captured_at": captured_at_local,
        "captured_at_utc": captured_at_utc,
        "captured_at_local": captured_at_local,
        "host": host,
        "port": port,
        "unit_id": unit_id,
        "messages": messages,
        "live": overview.live,
        "control": overview.control,
        "battery": overview.battery,
        "zero_export": overview.zero_export,
        "raw": {
            "input_registers": input_registers,
            "holding_registers": holding_registers,
            "battery_registers": battery_registers,
        },
    }


def collect_default_snapshot() -> dict:
    return collect_overview_payload(
        host=settings.serial_server_host,
        port=settings.serial_server_port,
        timeout=settings.serial_server_timeout,
        unit_id=settings.modbus_unit_id,
    )


poller = SnapshotPoller(
    interval_seconds=settings.logger_interval_seconds,
    collect_snapshot=collect_default_snapshot,
    save_snapshot=data_store.insert_snapshot,
    count_snapshots=data_store.snapshot_count,
)


def signed_16bit(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def signed_32bit(value: int) -> int:
    return value - 0x1_0000_0000 if value & 0x8000_0000 else value


def flatten_registers(register_type: str, registers: dict[int, int]) -> list[dict]:
    catalog = definitions_by_type(register_type)
    consumed: set[int] = set()
    rows: list[dict] = []

    for address in sorted(registers):
        if address in consumed:
            continue

        definition = catalog.get(address)
        if definition is None:
            rows.append(
                {
                    "register_type": register_type,
                    "address": address,
                    "raw_words": [registers[address]],
                    "raw_value": registers[address],
                    "name": "",
                    "decoded_value": registers[address],
                    "unit": "",
                    "known": False,
                    "note": "",
                }
            )
            consumed.add(address)
            continue

        raw_words = [registers.get(address + offset, 0) for offset in range(definition.width)]
        raw_value = raw_words[0]
        decoded_value: float | int = raw_words[0]

        if definition.width == 2:
            raw_value = ((raw_words[0] & 0xFFFF) << 16) | (raw_words[1] & 0xFFFF)
            decoded_value = signed_32bit(raw_value) if definition.signed else raw_value
        elif definition.width == 1 and definition.signed:
            decoded_value = signed_16bit(raw_words[0])

        decoded_value = decoded_value * definition.scale
        rows.append(
            {
                "register_type": register_type,
                "address": address,
                "raw_words": raw_words,
                "raw_value": raw_value,
                "name": definition.name,
                "decoded_value": decoded_value,
                "unit": definition.unit,
                "known": True,
                "note": definition.note,
            }
        )
        for offset in range(definition.width):
            consumed.add(address + offset)

    return rows


def run_modbus_read_job(
    job_id: str,
    stop_event: Event,
    host: str,
    port: int,
    timeout: float,
    unit_id: int,
    register_type: str,
    address: int,
    count: int,
) -> None:
    if stop_event.is_set():
        job_manager.update_job(job_id, status="stopped", message="Job wurde abgebrochen.")
        return

    job_manager.update_job(
        job_id,
        message="Lese Register...",
        progress_total=1,
        progress_current=0,
        current_unit_id=unit_id,
        current_address=address,
    )

    result = build_modbus_client(host=host, port=port, timeout=timeout).read_registers(
        unit_id=unit_id,
        register_type=register_type,
        address=address,
        count=count,
    )

    if stop_event.is_set():
        job_manager.update_job(job_id, status="stopped", message="Job wurde abgebrochen.")
        return

    job_manager.update_job(
        job_id,
        status="completed" if result.success else "failed",
        message=result.message,
        progress_current=1,
        result={
            "connected": result.connected,
            "success": result.success,
            "host": result.host,
            "port": result.port,
            "unit_id": result.unit_id,
            "register_type": result.register_type,
            "address": result.address,
            "count": result.count,
            "values": result.values,
            "message": result.message,
        },
    )


def run_modbus_scan_job(
    job_id: str,
    stop_event: Event,
    host: str,
    port: int,
    timeout: float,
    register_type: str,
    address: int,
    count: int,
    start: int,
    end: int,
) -> None:
    total = end - start + 1
    results: list[dict] = []
    job_manager.update_job(job_id, progress_total=total, message="Starte Unit-ID-Scan...")

    for index, unit_id in enumerate(range(start, end + 1), start=1):
        if stop_event.is_set():
            job_manager.update_job(
                job_id,
                status="stopped",
                message="Unit-ID-Scan wurde abgebrochen.",
                result={"results": results},
            )
            return

        job_manager.update_job(
            job_id,
            message=f"Pruefe Unit-ID {unit_id}...",
            progress_current=index - 1,
            current_unit_id=unit_id,
            current_address=address,
        )
        result = build_modbus_client(host=host, port=port, timeout=timeout).read_registers(
            unit_id=unit_id,
            register_type=register_type,
            address=address,
            count=count,
        )
        results.append(
            {
                "connected": result.connected,
                "success": result.success,
                "unit_id": result.unit_id,
                "register_type": result.register_type,
                "address": result.address,
                "count": result.count,
                "values": result.values,
                "message": result.message,
            }
        )
        job_manager.update_job(
            job_id,
            progress_current=index,
            result={"results": results},
        )

    successful = [item for item in results if item["success"]]
    job_manager.update_job(
        job_id,
        status="completed",
        message=(
            f"Antwort von Unit-ID(s): {', '.join(str(item['unit_id']) for item in successful)}"
            if successful
            else "Keine erfolgreiche Modbus-Antwort im Bereich gefunden."
        ),
        result={"results": results},
    )


def run_discovery_job(
    job_id: str,
    stop_event: Event,
    host: str,
    port: int,
    timeout: float,
    register_type: str,
    start_unit: int,
    end_unit: int,
    start_address: int,
    end_address: int,
    block_size: int,
) -> None:
    hits: list[dict] = []
    units = list(range(start_unit, end_unit + 1))
    blocks_per_unit = ((end_address - start_address) // block_size) + 1
    total = len(units) * blocks_per_unit
    step = 0

    job_manager.update_job(job_id, progress_total=total, message="Starte Discovery...")

    for unit_id in units:
        address = start_address
        while address <= end_address:
            if stop_event.is_set():
                job_manager.update_job(
                    job_id,
                    status="stopped",
                    message="Discovery wurde abgebrochen.",
                    result={"hits": hits},
                )
                return

            count = min(block_size, end_address - address + 1)
            job_manager.update_job(
                job_id,
                message=f"Pruefe Unit-ID {unit_id}, Adresse {address}...",
                progress_current=step,
                current_unit_id=unit_id,
                current_address=address,
            )
            result = build_modbus_client(host=host, port=port, timeout=timeout).read_registers(
                unit_id=unit_id,
                register_type=register_type,
                address=address,
                count=count,
            )
            if result.success:
                hits.append(
                    {
                        "unit_id": result.unit_id,
                        "register_type": result.register_type,
                        "start_address": result.address,
                        "count": result.count,
                        "values": result.values,
                        "message": result.message,
                    }
                )
            step += 1
            job_manager.update_job(
                job_id,
                progress_current=step,
                result={
                    "host": host,
                    "port": port,
                    "register_type": register_type,
                    "start_unit": start_unit,
                    "end_unit": end_unit,
                    "start_address": start_address,
                    "end_address": end_address,
                    "block_size": block_size,
                    "hits": hits,
                },
            )
            address += block_size

    job_manager.update_job(
        job_id,
        status="completed",
        message=(
            f"{len(hits)} erfolgreiche Registerblock-Antworten gefunden."
            if hits
            else "Keine antwortenden Registerbloecke im gewaehlten Bereich gefunden."
        ),
        result={
            "host": host,
            "port": port,
            "register_type": register_type,
            "start_unit": start_unit,
            "end_unit": end_unit,
            "start_address": start_address,
            "end_address": end_address,
            "block_size": block_size,
            "hits": hits,
        },
    )


@app.post("/api/jobs/modbus-read")
def start_modbus_read_job():
    host, port, timeout = parse_common_connection_args()
    unit_id = request.args.get("unit_id", default=settings.modbus_unit_id, type=int)
    register_type = request.args.get("register_type", "input").strip().lower()
    address = request.args.get("address", default=settings.modbus_probe_address, type=int)
    count = request.args.get("count", default=settings.modbus_probe_count, type=int)

    error = validate_connection_args(host, port, timeout)
    if error:
        return jsonify({"message": error}), 400
    if unit_id is None or unit_id < 1 or unit_id > 247:
        return jsonify({"message": "Unit-ID muss zwischen 1 und 247 liegen."}), 400
    if address is None or address < 0 or address > 65535:
        return jsonify({"message": "Adresse muss zwischen 0 und 65535 liegen."}), 400
    if count is None or count < 1 or count > 125:
        return jsonify({"message": "Count muss zwischen 1 und 125 liegen."}), 400

    job = job_manager.start_job(
        "modbus-read",
        lambda job_id, stop_event: run_modbus_read_job(
            job_id,
            stop_event,
            host,
            port,
            timeout,
            unit_id,
            register_type,
            address,
            count,
        ),
    )
    return jsonify(job_manager.serialize(job)), 202


@app.post("/api/jobs/modbus-scan")
def start_modbus_scan_job():
    host, port, timeout = parse_common_connection_args()
    register_type = request.args.get("register_type", "input").strip().lower()
    address = request.args.get("address", default=settings.modbus_probe_address, type=int)
    count = request.args.get("count", default=1, type=int)
    start = request.args.get("start", default=1, type=int)
    end = request.args.get("end", default=5, type=int)

    error = validate_connection_args(host, port, timeout)
    if error:
        return jsonify({"message": error}), 400
    if start is None or end is None or start < 1 or end > 247 or start > end:
        return jsonify({"message": "Scan-Bereich muss zwischen 1 und 247 liegen."}), 400

    job = job_manager.start_job(
        "modbus-scan",
        lambda job_id, stop_event: run_modbus_scan_job(
            job_id,
            stop_event,
            host,
            port,
            timeout,
            register_type,
            address,
            count,
            start,
            end,
        ),
    )
    return jsonify(job_manager.serialize(job)), 202


@app.post("/api/jobs/discovery")
def start_discovery_job():
    host, port, timeout = parse_common_connection_args()
    register_type = request.args.get("register_type", "input").strip().lower()
    start_unit = request.args.get("start_unit", default=1, type=int)
    end_unit = request.args.get("end_unit", default=5, type=int)
    start_address = request.args.get("start_address", default=0, type=int)
    end_address = request.args.get("end_address", default=50, type=int)
    block_size = request.args.get("block_size", default=10, type=int)

    error = validate_connection_args(host, port, timeout)
    if error:
        return jsonify({"message": error}), 400
    if start_unit is None or end_unit is None or start_unit < 1 or end_unit > 247 or start_unit > end_unit:
        return jsonify({"message": "Unit-ID-Bereich muss zwischen 1 und 247 liegen."}), 400
    if start_address is None or end_address is None or start_address < 0 or end_address > 65535 or start_address > end_address:
        return jsonify({"message": "Adressbereich ist ungueltig."}), 400
    if block_size is None or block_size < 1 or block_size > 125:
        return jsonify({"message": "Blockgroesse muss zwischen 1 und 125 liegen."}), 400

    job = job_manager.start_job(
        "discovery",
        lambda job_id, stop_event: run_discovery_job(
            job_id,
            stop_event,
            host,
            port,
            timeout,
            register_type,
            start_unit,
            end_unit,
            start_address,
            end_address,
            block_size,
        ),
    )
    return jsonify(job_manager.serialize(job)), 202


@app.get("/api/modbus/read")
def legacy_modbus_read():
    host, port, timeout = parse_common_connection_args()
    unit_id = request.args.get("unit_id", default=settings.modbus_unit_id, type=int)
    register_type = request.args.get("register_type", "input").strip().lower()
    address = request.args.get("address", default=settings.modbus_probe_address, type=int)
    count = request.args.get("count", default=settings.modbus_probe_count, type=int)

    error = validate_connection_args(host, port, timeout)
    if error:
        return jsonify({"message": error}), 400
    if unit_id is None or unit_id < 1 or unit_id > 247:
        return jsonify({"message": "Unit-ID muss zwischen 1 und 247 liegen."}), 400
    if address is None or address < 0 or address > 65535:
        return jsonify({"message": "Adresse muss zwischen 0 und 65535 liegen."}), 400
    if count is None or count < 1 or count > 125:
        return jsonify({"message": "Count muss zwischen 1 und 125 liegen."}), 400

    result = build_modbus_client(host=host, port=port, timeout=timeout).read_registers(
        unit_id=unit_id,
        register_type=register_type,
        address=address,
        count=count,
    )
    return jsonify(
        {
            "connected": result.connected,
            "success": result.success,
            "host": result.host,
            "port": result.port,
            "unit_id": result.unit_id,
            "register_type": result.register_type,
            "address": result.address,
            "count": result.count,
            "values": result.values,
            "message": result.message,
        }
    ), (200 if result.success else 502)


@app.get("/api/modbus/scan")
def legacy_modbus_scan():
    host, port, timeout = parse_common_connection_args()
    register_type = request.args.get("register_type", "input").strip().lower()
    address = request.args.get("address", default=settings.modbus_probe_address, type=int)
    count = request.args.get("count", default=1, type=int)
    start = request.args.get("start", default=1, type=int)
    end = request.args.get("end", default=5, type=int)

    error = validate_connection_args(host, port, timeout)
    if error:
        return jsonify({"message": error}), 400
    if start is None or end is None or start < 1 or end > 247 or start > end:
        return jsonify({"message": "Scan-Bereich muss zwischen 1 und 247 liegen."}), 400

    results = build_modbus_client(host=host, port=port, timeout=timeout).scan_unit_ids(
        register_type=register_type,
        address=address,
        count=count,
        start=start,
        end=end,
    )
    return jsonify(
        {
            "results": [
                {
                    "connected": result.connected,
                    "success": result.success,
                    "unit_id": result.unit_id,
                    "register_type": result.register_type,
                    "address": result.address,
                    "count": result.count,
                    "values": result.values,
                    "message": result.message,
                }
                for result in results
            ]
        }
    ), 200


@app.get("/api/modbus/discovery")
def legacy_modbus_discovery():
    host, port, timeout = parse_common_connection_args()
    register_type = request.args.get("register_type", "input").strip().lower()
    start_unit = request.args.get("start_unit", default=1, type=int)
    end_unit = request.args.get("end_unit", default=5, type=int)
    start_address = request.args.get("start_address", default=0, type=int)
    end_address = request.args.get("end_address", default=50, type=int)
    block_size = request.args.get("block_size", default=10, type=int)

    error = validate_connection_args(host, port, timeout)
    if error:
        return jsonify({"message": error}), 400
    if start_unit is None or end_unit is None or start_unit < 1 or end_unit > 247 or start_unit > end_unit:
        return jsonify({"message": "Unit-ID-Bereich muss zwischen 1 und 247 liegen."}), 400
    if start_address is None or end_address is None or start_address < 0 or end_address > 65535 or start_address > end_address:
        return jsonify({"message": "Adressbereich ist ungueltig."}), 400
    if block_size is None or block_size < 1 or block_size > 125:
        return jsonify({"message": "Blockgroesse muss zwischen 1 und 125 liegen."}), 400

    unit_ids = list(range(start_unit, end_unit + 1))
    hits = build_modbus_client(host=host, port=port, timeout=timeout).discover_register_blocks(
        unit_ids=unit_ids,
        register_type=register_type,
        start_address=start_address,
        end_address=end_address,
        block_size=block_size,
    )
    return jsonify(
        {
            "host": host,
            "port": port,
            "register_type": register_type,
            "start_unit": start_unit,
            "end_unit": end_unit,
            "start_address": start_address,
            "end_address": end_address,
            "block_size": block_size,
            "hits": [
                {
                    "unit_id": hit.unit_id,
                    "register_type": hit.register_type,
                    "start_address": hit.start_address,
                    "count": hit.count,
                    "values": hit.values,
                    "message": hit.message,
                }
                for hit in hits
            ],
            "message": (
                f"{len(hits)} erfolgreiche Registerblock-Antworten gefunden."
                if hits
                else "Keine antwortenden Registerbloecke im gewaehlten Bereich gefunden."
            ),
        }
    ), 200


@app.get("/api/growatt/overview")
def get_growatt_overview():
    host, port, timeout = parse_common_connection_args()
    unit_id = request.args.get("unit_id", default=settings.modbus_unit_id, type=int)

    error = validate_connection_args(host, port, timeout)
    if error:
        return jsonify({"message": error}), 400
    if unit_id is None or unit_id < 1 or unit_id > 247:
        return jsonify({"message": "Unit-ID muss zwischen 1 und 247 liegen."}), 400

    try:
        payload = collect_overview_payload(
            host=host,
            port=port,
            timeout=timeout,
            unit_id=unit_id,
        )
    except RuntimeError as exc:
        return jsonify({"message": str(exc)}), 502
    return jsonify(payload), 200


@app.get("/api/growatt/register-explorer")
def get_register_explorer():
    host, port, timeout = parse_common_connection_args()
    unit_id = request.args.get("unit_id", default=settings.modbus_unit_id, type=int)

    error = validate_connection_args(host, port, timeout)
    if error:
        return jsonify({"message": error}), 400
    if unit_id is None or unit_id < 1 or unit_id > 247:
        return jsonify({"message": "Unit-ID muss zwischen 1 und 247 liegen."}), 400

    try:
        input_registers, holding_registers, battery_registers, messages = collect_register_sets(
            host=host,
            port=port,
            timeout=timeout,
            unit_id=unit_id,
        )
    except RuntimeError as exc:
        return jsonify({"message": str(exc)}), 502

    rows = (
        flatten_registers("input", input_registers)
        + flatten_registers("holding", holding_registers)
        + flatten_registers("input", battery_registers)
    )
    rows.sort(key=lambda row: (row["register_type"], row["address"]))

    return jsonify(
        {
            "host": host,
            "port": port,
            "unit_id": unit_id,
            "messages": messages,
            "row_count": len(rows),
            "rows": rows,
        }
    ), 200


@app.get("/api/logger/status")
def get_logger_status():
    return jsonify(serialize_poller_status()), 200


@app.post("/api/logger/start")
def start_logger():
    interval_seconds = parse_logger_interval_value()
    if interval_seconds is not None:
        error = validate_logger_interval(interval_seconds)
        if error:
            return jsonify({"message": error}), 400
        poller.set_interval(interval_seconds)

    started = poller.start()
    status_code = 202 if started else 200
    return jsonify(
        {
            "started": started,
            "status": serialize_poller_status(),
        }
    ), status_code


@app.post("/api/logger/stop")
def stop_logger():
    stopped = poller.stop()
    status_code = 200
    return jsonify(
        {
            "stopped": stopped,
            "status": serialize_poller_status(),
        }
    ), status_code


@app.post("/api/logger/config")
def configure_logger():
    interval_seconds = parse_logger_interval_value()
    error = validate_logger_interval(interval_seconds)
    if error:
        return jsonify({"message": error}), 400

    poller.set_interval(interval_seconds)
    return jsonify(
        {
            "updated": True,
            "status": serialize_poller_status(),
            "message": "Logger-Intervall aktualisiert.",
        }
    ), 200


@app.get("/api/logger/recent")
def get_recent_logger_data():
    limit = request.args.get("limit", default=50, type=int)
    if limit is None or limit < 1 or limit > 1000:
        return jsonify({"message": "Limit muss zwischen 1 und 1000 liegen."}), 400
    return jsonify({"rows": data_store.fetch_recent_snapshots(limit=limit)}), 200


@app.get("/api/logger/history")
def get_logger_history():
    default_end = datetime.now(timezone.utc)
    default_start = default_end - timedelta(hours=6)

    start_utc = parse_utc_timestamp(request.args.get("start"), default_start)
    end_utc = parse_utc_timestamp(request.args.get("end"), default_end)
    limit = request.args.get("limit", default=5000, type=int)
    fields_raw = request.args.get("fields", "")
    selected_fields = [field.strip() for field in fields_raw.split(",") if field.strip()]

    if start_utc > end_utc:
        return jsonify({"message": "Startzeit muss vor der Endzeit liegen."}), 400
    if limit is None or limit < 1 or limit > 10000:
        return jsonify({"message": "Limit muss zwischen 1 und 10000 liegen."}), 400
    if not selected_fields:
        selected_fields = [
            "pv_total_power_w",
            "ac_total_power_w",
            "load_power_w",
            "battery_charge_power_w",
            "battery_discharge_power_w",
            "battery_soc_percent",
        ]

    invalid_fields = [field for field in selected_fields if field not in HISTORY_FIELD_DEFINITIONS]
    if invalid_fields:
        return jsonify({"message": f"Unbekannte Felder: {', '.join(invalid_fields)}"}), 400

    rows = data_store.fetch_snapshots_between(start_utc=start_utc, end_utc=end_utc, limit=limit)

    points = []
    for row in rows:
        payload = json.loads(row["payload_json"])
        values = {
            field_name: extract_history_field(row, payload, field_name)
            for field_name in selected_fields
        }
        points.append(
            {
                "id": row["id"],
                "timestamp_utc": f"{row['created_at_utc']}Z",
                "timestamp_local": row["created_at"],
                "status_text": row["status_text"],
                "values": values,
            }
        )

    return jsonify(
        {
            "start_utc": start_utc.isoformat(),
            "end_utc": end_utc.isoformat(),
            "point_count": len(points),
            "fields": {
                field_name: HISTORY_FIELD_DEFINITIONS[field_name]
                for field_name in selected_fields
            },
            "available_fields": HISTORY_FIELD_DEFINITIONS,
            "points": points,
        }
    ), 200


@app.get("/api/jobs/<job_id>")
def get_job(job_id: str):
    job = job_manager.get_job(job_id)
    if job is None:
        return jsonify({"message": "Job nicht gefunden."}), 404
    return jsonify(job_manager.serialize(job)), 200


@app.post("/api/jobs/<job_id>/stop")
def stop_job(job_id: str):
    job = job_manager.stop_job(job_id)
    if job is None:
        return jsonify({"message": "Job nicht gefunden."}), 404
    return jsonify(job_manager.serialize(job)), 200


if settings.logger_autostart:
    poller.start()


if __name__ == "__main__":
    serve(
        app,
        host=settings.app_host,
        port=settings.app_port,
        threads=8,
    )
