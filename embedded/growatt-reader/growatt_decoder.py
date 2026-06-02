from __future__ import annotations

from dataclasses import dataclass


def u32(high_word: int, low_word: int) -> int:
    return ((high_word & 0xFFFF) << 16) | (low_word & 0xFFFF)


def s16(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def s32(high_word: int, low_word: int) -> int:
    value = u32(high_word, low_word)
    return value - 0x1_0000_0000 if value & 0x8000_0000 else value


def register_slice(values: list[int], start_address: int) -> dict[int, int]:
    return {start_address + index: value for index, value in enumerate(values)}


def get_u16(registers: dict[int, int], address: int) -> int:
    return int(registers.get(address, 0))


def get_u32(registers: dict[int, int], address: int) -> int:
    return u32(get_u16(registers, address), get_u16(registers, address + 1))


def get_s32(registers: dict[int, int], address: int) -> int:
    return s32(get_u16(registers, address), get_u16(registers, address + 1))


def get_s16(registers: dict[int, int], address: int) -> int:
    return s16(get_u16(registers, address))


STATUS_MAP = {
    0: "waiting",
    1: "normal",
    3: "fault",
    4: "flash",
}


@dataclass(slots=True)
class OverviewResult:
    live: dict
    control: dict
    battery: dict
    zero_export: dict
    raw: dict


def decode_overview(
    input_registers: dict[int, int],
    holding_registers: dict[int, int],
    battery_registers: dict[int, int],
) -> OverviewResult:
    pv_total_power_w = get_u32(input_registers, 1) / 10
    ac_total_power_w = get_u32(input_registers, 35) / 10

    trackers = []
    for tracker_index in range(8):
        base = 3 + tracker_index * 4
        voltage_v = get_u16(input_registers, base) / 10
        current_a = get_u16(input_registers, base + 1) / 10
        power_w = get_u32(input_registers, base + 2) / 10
        trackers.append(
            {
                "tracker": tracker_index + 1,
                "voltage_v": voltage_v,
                "current_a": current_a,
                "power_w": power_w,
            }
        )

    phases = []
    for phase_index in range(3):
        base = 38 + phase_index * 4
        phases.append(
            {
                "phase": phase_index + 1,
                "voltage_v": get_u16(input_registers, base) / 10,
                "current_a": get_u16(input_registers, base + 1) / 10,
                "power_w": get_u32(input_registers, base + 2) / 10,
            }
        )

    # Current field observations indicate separate charge/discharge registers:
    # 3178/3179 -> discharge candidate, 3180/3181 -> charge candidate.
    battery_discharge_power_w = max(0.0, get_s32(battery_registers, 3178) / 10)
    battery_charge_power_w = max(0.0, get_s32(battery_registers, 3180) / 10)
    grid_to_local_load_w = get_s32(battery_registers, 3184) / 10
    battery_power_w = battery_discharge_power_w - battery_charge_power_w

    if battery_discharge_power_w > 0 and battery_charge_power_w <= 0:
        battery_flow_state = "discharging"
    elif battery_charge_power_w > 0 and battery_discharge_power_w <= 0:
        battery_flow_state = "charging"
    else:
        battery_flow_state = "idle"

    # Grid/load remain heuristic until we identify the direct registers.
    if battery_flow_state == "charging":
        estimated_grid_export_w = max(0.0, pv_total_power_w - battery_charge_power_w - ac_total_power_w)
        estimated_grid_import_w = 0.0
        estimated_load_power_w = max(0.0, pv_total_power_w - battery_charge_power_w - estimated_grid_export_w)
    elif battery_flow_state == "discharging":
        estimated_grid_import_w = max(0.0, ac_total_power_w - pv_total_power_w - battery_discharge_power_w)
        estimated_grid_export_w = 0.0
        estimated_load_power_w = max(ac_total_power_w, pv_total_power_w + battery_discharge_power_w + estimated_grid_import_w)
    else:
        estimated_grid_import_w = max(0.0, ac_total_power_w - pv_total_power_w)
        estimated_grid_export_w = max(0.0, pv_total_power_w - ac_total_power_w)
        estimated_load_power_w = max(ac_total_power_w, pv_total_power_w + estimated_grid_import_w - estimated_grid_export_w)

    configured_limit_percent = get_u16(holding_registers, 3)
    if configured_limit_percent == 255:
        configured_limit_percent = None

    live = {
        "status_code": get_u16(input_registers, 0),
        "status_text": STATUS_MAP.get(get_u16(input_registers, 0), "unknown"),
        "pv_total_power_w": pv_total_power_w,
        "ac_total_power_w": ac_total_power_w,
        "grid_frequency_hz": get_u16(input_registers, 37) / 100,
        "line_voltage_rs_v": get_u16(input_registers, 50) / 10,
        "line_voltage_st_v": get_u16(input_registers, 51) / 10,
        "line_voltage_tr_v": get_u16(input_registers, 52) / 10,
        "energy_today_kwh": get_u32(input_registers, 53) / 10,
        "energy_total_kwh": get_u32(input_registers, 55) / 10,
        "work_time_total_seconds": get_u32(input_registers, 57) / 2,
        "trackers": trackers,
        "phases": phases,
        "estimated_import_from_grid_w": estimated_grid_import_w,
        "estimated_export_to_grid_w": estimated_grid_export_w,
        "estimated_load_power_w": estimated_load_power_w,
        "grid_power_direction_note": (
            "Arbeitswert aus PV, AC sowie getrennten Lade-/Entladeregistern"
        ),
        "real_output_percent": get_u16(input_registers, 100) / 100,
        "limited_output_power_w": get_u32(input_registers, 102) / 10,
        "temperature_c": get_u16(input_registers, 93) / 10,
        "ipm_temperature_c": get_u16(input_registers, 94) / 10,
        "boost_temperature_c": get_u16(input_registers, 95) / 10,
    }

    control = {
        "configured_active_power_rate_percent": configured_limit_percent,
        "normal_power_rating_w": get_u32(holding_registers, 6) / 10,
        "modbus_baud_rate_setting": get_u16(holding_registers, 22),
    }

    battery = {
        "available": any(value != 0 for value in battery_registers.values()),
        "charge_power_w": battery_charge_power_w,
        "discharge_power_w": battery_discharge_power_w,
        "grid_to_local_load_w": grid_to_local_load_w,
        "bms_status": get_u16(battery_registers, 3212),
        "bms_soc_percent": get_u16(battery_registers, 3171) / 100,
        "battery_voltage_v": get_u16(battery_registers, 3172) / 10,
        "battery_current_a": get_s16(battery_registers, 3173) / 10,
        "battery_power_w": battery_power_w,
        "flow_state": battery_flow_state,
        "candidate_registers": {
            "input_201": {
                "raw": get_u16(input_registers, 201),
                "scale_hint": "unknown",
                "note": "Kandidat fuer momentane Freigabe-/Abregelungsinformation",
            },
            "input_202": {
                "raw": get_u16(input_registers, 202),
                "scale_hint": "unknown",
                "note": "Kandidat fuer momentane Freigabe-/Abregelungsinformation",
            },
            "input_203": {
                "raw": get_u16(input_registers, 203),
                "scale_hint": "unknown",
                "note": "Kandidat fuer momentane Freigabe-/Abregelungsinformation",
            },
            "input_231": {
                "raw": get_u16(input_registers, 231),
                "scaled_w_guess": get_u16(input_registers, 231) / 10,
                "scale_hint": "possibly_u16_div_10",
                "note": "Korrelierte Groesse, moeglicherweise Leistung oder Freigabe-Sollwert",
            },
            "input_233": {
                "raw": get_u16(input_registers, 233),
                "scale_hint": "unknown",
                "note": "Korrelierte Groesse, Bedeutung noch offen",
            },
            "battery_3166": {
                "raw": get_u16(battery_registers, 3166),
                "hex": hex(get_u16(battery_registers, 3166)),
                "scale_hint": "status_word",
                "note": "Bisher nur 257 / 513 beobachtet, sehr wahrscheinlich Statuswort",
            },
            "battery_3178_3179": {
                "raw_high": get_u16(battery_registers, 3178),
                "raw_low": get_u16(battery_registers, 3179),
                "scaled_w": battery_discharge_power_w,
                "scale_hint": "u32_div_10_or_s32_div_10",
                "note": "Staerkster Kandidat fuer Batterie-Entladeleistung",
            },
            "battery_3180_3181": {
                "raw_high": get_u16(battery_registers, 3180),
                "raw_low": get_u16(battery_registers, 3181),
                "scaled_w": battery_charge_power_w,
                "scale_hint": "u32_div_10_or_s32_div_10",
                "note": "Staerkster Kandidat fuer Batterie-Ladeleistung",
            },
            "battery_3212": {
                "raw": get_u16(battery_registers, 3212),
                "scale_hint": "status_code",
                "note": "BMS-/Freigabestatus, bisher 1 oder 4",
            },
        },
    }

    curtailed_power_estimate_w = max(
        0.0,
        pv_total_power_w - ac_total_power_w - max(battery_charge_power_w, 0),
    )

    zero_export = {
        "official_limit_register": {
            "holding_register": 3,
            "name": "Active P Rate",
            "configured_percent": configured_limit_percent,
            "note": "Das ist die konfigurierte Wirkleistungsbegrenzung, nicht zwingend die momentane Abregelung.",
        },
        "live_limit_registers": {
            "input_register_100": live["real_output_percent"],
            "input_registers_102_103_power_w": live["limited_output_power_w"],
        },
        "curtailment_estimate_w": curtailed_power_estimate_w,
        "note": (
            "Es gibt in der offiziellen Doku kein eindeutig benanntes einzelnes Register "
            "fuer 'momentan wegen Nulleinspeisung abgeregelt'. Diese Schaetzung kombiniert "
            "PV-Eingangsleistung, AC-Ausgangsleistung und Batterieladeleistung."
        ),
    }

    raw = {
        "input_registers": input_registers,
        "holding_registers": holding_registers,
        "battery_registers": battery_registers,
    }

    return OverviewResult(
        live=live,
        control=control,
        battery=battery,
        zero_export=zero_export,
        raw=raw,
    )
