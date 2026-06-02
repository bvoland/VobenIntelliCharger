from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class RegisterDefinition:
    register_type: str
    address: int
    width: int
    name: str
    unit: str = ""
    scale: float = 1.0
    signed: bool = False
    note: str = ""


def _tracker_definitions() -> list[RegisterDefinition]:
    defs: list[RegisterDefinition] = []
    for tracker in range(1, 9):
        base = 3 + (tracker - 1) * 4
        defs.extend(
            [
                RegisterDefinition("input", base, 1, f"pv{tracker}_voltage", "V", 0.1),
                RegisterDefinition("input", base + 1, 1, f"pv{tracker}_current", "A", 0.1),
                RegisterDefinition("input", base + 2, 2, f"pv{tracker}_power", "W", 0.1),
            ]
        )
    return defs


def _phase_definitions() -> list[RegisterDefinition]:
    defs: list[RegisterDefinition] = []
    for phase in range(1, 4):
        base = 38 + (phase - 1) * 4
        defs.extend(
            [
                RegisterDefinition("input", base, 1, f"phase_{phase}_voltage", "V", 0.1),
                RegisterDefinition("input", base + 1, 1, f"phase_{phase}_current", "A", 0.1),
                RegisterDefinition("input", base + 2, 2, f"phase_{phase}_power", "W", 0.1),
            ]
        )
    return defs


REGISTER_CATALOG: list[RegisterDefinition] = [
    RegisterDefinition("input", 0, 1, "inverter_status", note="0 waiting, 1 normal, 3 fault, 4 flash"),
    RegisterDefinition("input", 1, 2, "pv_total_power", "W", 0.1),
    *_tracker_definitions(),
    RegisterDefinition("input", 35, 2, "ac_total_power", "W", 0.1),
    RegisterDefinition("input", 37, 1, "grid_frequency", "Hz", 0.01),
    *_phase_definitions(),
    RegisterDefinition("input", 50, 1, "line_voltage_rs", "V", 0.1),
    RegisterDefinition("input", 51, 1, "line_voltage_st", "V", 0.1),
    RegisterDefinition("input", 52, 1, "line_voltage_tr", "V", 0.1),
    RegisterDefinition("input", 53, 2, "energy_today", "kWh", 0.1),
    RegisterDefinition("input", 55, 2, "energy_total", "kWh", 0.1),
    RegisterDefinition("input", 57, 2, "work_time_total", "s", 0.5),
    RegisterDefinition("input", 59, 2, "pv1_energy_today", "kWh", 0.1),
    RegisterDefinition("input", 61, 2, "pv1_energy_total", "kWh", 0.1),
    RegisterDefinition("input", 63, 2, "pv2_energy_today", "kWh", 0.1),
    RegisterDefinition("input", 65, 2, "pv2_energy_total", "kWh", 0.1),
    RegisterDefinition("input", 67, 2, "pv3_energy_today", "kWh", 0.1),
    RegisterDefinition("input", 69, 2, "pv3_energy_total", "kWh", 0.1),
    RegisterDefinition("input", 92, 2, "fault_code"),
    RegisterDefinition("input", 93, 1, "temperature", "C", 0.1),
    RegisterDefinition("input", 94, 1, "ipm_temperature", "C", 0.1),
    RegisterDefinition("input", 95, 1, "boost_temperature", "C", 0.1),
    RegisterDefinition("input", 96, 1, "p_bus_voltage", "V", 0.1),
    RegisterDefinition("input", 97, 1, "n_bus_voltage", "V", 0.1),
    RegisterDefinition("input", 98, 1, "bus_voltage", "V", 0.1),
    RegisterDefinition("input", 100, 1, "real_output_percent", "%", 0.01),
    RegisterDefinition("input", 102, 2, "active_power_limit_runtime", "W", 0.1),
    RegisterDefinition("input", 104, 1, "derating_mode"),
    RegisterDefinition("input", 113, 1, "safety_country"),
    RegisterDefinition("input", 114, 1, "work_mode"),
    RegisterDefinition("holding", 3, 1, "active_p_rate_config", "%"),
    RegisterDefinition("holding", 6, 2, "normal_power_rating", "W", 0.1),
    RegisterDefinition("holding", 22, 1, "modbus_baud_rate"),
    RegisterDefinition("holding", 23, 1, "protocol_version"),
    RegisterDefinition("input", 3166, 1, "battery_priority"),
    RegisterDefinition("input", 3171, 1, "bms_soc", "%", 0.01),
    RegisterDefinition("input", 3172, 1, "battery_voltage", "V", 0.1),
    RegisterDefinition("input", 3173, 1, "battery_current", "A", 0.1, signed=True),
    RegisterDefinition("input", 3178, 2, "battery_discharge_power_candidate", "W", 0.1, signed=True),
    RegisterDefinition("input", 3180, 2, "battery_charge_power_candidate", "W", 0.1, signed=True),
    RegisterDefinition("input", 3182, 2, "battery_hybrid_power_candidate", "W", 0.1, signed=True),
    RegisterDefinition("input", 3184, 2, "grid_to_local_load_power", "W", 0.1, signed=True),
    RegisterDefinition("input", 3212, 1, "bms_status"),
]


def definitions_by_type(register_type: str) -> dict[int, RegisterDefinition]:
    return {
        definition.address: definition
        for definition in REGISTER_CATALOG
        if definition.register_type == register_type
    }
