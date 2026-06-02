from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(slots=True)
class Settings:
    serial_server_host: str = os.getenv("SERIAL_SERVER_HOST", "192.168.0.143")
    serial_server_port: int = int(os.getenv("SERIAL_SERVER_PORT", "8899"))
    serial_server_timeout: float = float(os.getenv("SERIAL_SERVER_TIMEOUT", "3.0"))
    modbus_unit_id: int = int(os.getenv("MODBUS_UNIT_ID", "1"))
    modbus_probe_address: int = int(os.getenv("MODBUS_PROBE_ADDRESS", "0"))
    modbus_probe_count: int = int(os.getenv("MODBUS_PROBE_COUNT", "2"))
    logger_interval_seconds: int = int(os.getenv("LOGGER_INTERVAL_SECONDS", "60"))
    logger_autostart: bool = os.getenv("LOGGER_AUTOSTART", "true").lower() == "true"
    database_path: str = os.getenv("DATABASE_PATH", "growatt_data.db")
    app_host: str = os.getenv("APP_HOST", "127.0.0.1")
    app_port: int = int(os.getenv("APP_PORT", "5000"))
    app_debug: bool = os.getenv("APP_DEBUG", "false").lower() == "true"


settings = Settings()
