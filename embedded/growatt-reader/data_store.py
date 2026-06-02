from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


SQLITE_DT_FORMAT = "%Y-%m-%d %H:%M:%S"
UTC = timezone.utc
BERLIN_TZ = ZoneInfo("Europe/Berlin")


class DataStore:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.database_path)

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS snapshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    unit_id INTEGER NOT NULL,
                    pv_total_power_w REAL,
                    ac_total_power_w REAL,
                    battery_power_w REAL,
                    battery_charge_power_w REAL,
                    battery_soc_percent REAL,
                    status_text TEXT,
                    curtailment_estimate_w REAL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            columns = {
                row[1]
                for row in connection.execute("PRAGMA table_info(snapshots)").fetchall()
            }
            if "created_at_utc" not in columns:
                connection.execute("ALTER TABLE snapshots ADD COLUMN created_at_utc TEXT")
            if "created_at_local" not in columns:
                connection.execute("ALTER TABLE snapshots ADD COLUMN created_at_local TEXT")
            self._migrate_timestamps(connection)
            self._ensure_indexes(connection)

    def _migrate_timestamps(self, connection: sqlite3.Connection) -> None:
        rows = connection.execute(
            """
            SELECT id, created_at, created_at_utc, created_at_local
            FROM snapshots
            WHERE created_at_utc IS NULL OR created_at_local IS NULL
            """
        ).fetchall()
        for row_id, created_at, created_at_utc, created_at_local in rows:
            if created_at_utc:
                dt_utc = datetime.strptime(created_at_utc, SQLITE_DT_FORMAT).replace(tzinfo=UTC)
            else:
                dt_utc = datetime.strptime(created_at, SQLITE_DT_FORMAT).replace(tzinfo=UTC)
            dt_local = dt_utc.astimezone(BERLIN_TZ)
            connection.execute(
                """
                UPDATE snapshots
                SET created_at_utc = ?, created_at_local = ?
                WHERE id = ?
                """,
                (
                    dt_utc.strftime(SQLITE_DT_FORMAT),
                    dt_local.strftime(SQLITE_DT_FORMAT),
                    row_id,
                ),
            )

    def _ensure_indexes(self, connection: sqlite3.Connection) -> None:
        # Main UI access patterns:
        # - recent snapshots by id DESC
        # - time range queries over created_at_utc
        # - potential future filtering by unit_id within a time range
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_snapshots_created_at_utc ON snapshots(created_at_utc)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_snapshots_created_at_local ON snapshots(created_at_local)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_snapshots_unit_id_created_at_utc ON snapshots(unit_id, created_at_utc)"
        )

    def insert_snapshot(self, payload: dict) -> None:
        live = payload.get("live", {})
        battery = payload.get("battery", {})
        zero_export = payload.get("zero_export", {})
        created_at_utc = datetime.now(UTC)
        created_at_local = created_at_utc.astimezone(BERLIN_TZ)
        created_at_utc_text = created_at_utc.strftime(SQLITE_DT_FORMAT)
        created_at_local_text = created_at_local.strftime(SQLITE_DT_FORMAT)

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO snapshots (
                    created_at,
                    created_at_utc,
                    created_at_local,
                    unit_id,
                    pv_total_power_w,
                    ac_total_power_w,
                    battery_power_w,
                    battery_charge_power_w,
                    battery_soc_percent,
                    status_text,
                    curtailment_estimate_w,
                    payload_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    created_at_local_text,
                    created_at_utc_text,
                    created_at_local_text,
                    payload.get("unit_id", 1),
                    live.get("pv_total_power_w"),
                    live.get("ac_total_power_w"),
                    battery.get("battery_power_w"),
                    battery.get("charge_power_w"),
                    battery.get("bms_soc_percent"),
                    live.get("status_text"),
                    zero_export.get("curtailment_estimate_w"),
                    json.dumps(payload, ensure_ascii=True),
                ),
            )

    def fetch_recent_snapshots(self, limit: int = 50) -> list[dict]:
        with self._connect() as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT
                    id,
                    created_at_local AS created_at,
                    created_at_utc,
                    unit_id,
                    pv_total_power_w,
                    ac_total_power_w,
                    battery_power_w,
                    battery_charge_power_w,
                    battery_soc_percent,
                    status_text,
                    curtailment_estimate_w
                FROM snapshots
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    def snapshot_count(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) FROM snapshots").fetchone()
        return int(row[0])

    def fetch_snapshots_between(
        self,
        start_utc: datetime,
        end_utc: datetime,
        limit: int = 5000,
    ) -> list[dict]:
        start_text = start_utc.astimezone(UTC).strftime(SQLITE_DT_FORMAT)
        end_text = end_utc.astimezone(UTC).strftime(SQLITE_DT_FORMAT)

        with self._connect() as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT
                    id,
                    created_at_local AS created_at,
                    created_at_utc,
                    unit_id,
                    pv_total_power_w,
                    ac_total_power_w,
                    battery_power_w,
                    battery_charge_power_w,
                    battery_soc_percent,
                    status_text,
                    curtailment_estimate_w,
                    payload_json
                FROM snapshots
                WHERE created_at_utc >= ? AND created_at_utc <= ?
                ORDER BY created_at_utc ASC, id ASC
                LIMIT ?
                """,
                (start_text, end_text, limit),
            ).fetchall()
        return [dict(row) for row in rows]
