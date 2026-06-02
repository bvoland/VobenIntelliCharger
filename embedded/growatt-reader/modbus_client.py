from __future__ import annotations

from dataclasses import dataclass

from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusException


@dataclass(slots=True)
class ModbusReadResult:
    connected: bool
    success: bool
    host: str
    port: int
    unit_id: int
    register_type: str
    address: int
    count: int
    values: list[int]
    message: str


@dataclass(slots=True)
class RegisterDiscoveryHit:
    unit_id: int
    register_type: str
    start_address: int
    count: int
    values: list[int]
    message: str


class GrowattModbusClient:
    def __init__(self, host: str, port: int, timeout: float) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout

    def read_registers(
        self,
        unit_id: int,
        register_type: str,
        address: int,
        count: int,
    ) -> ModbusReadResult:
        client = ModbusTcpClient(
            host=self.host,
            port=self.port,
            timeout=self.timeout,
        )

        try:
            if not client.connect():
                return ModbusReadResult(
                    connected=False,
                    success=False,
                    host=self.host,
                    port=self.port,
                    unit_id=unit_id,
                    register_type=register_type,
                    address=address,
                    count=count,
                    values=[],
                    message="Keine TCP-Verbindung zum Modbus-Gateway moeglich.",
                )

            if register_type == "input":
                response = client.read_input_registers(
                    address=address,
                    count=count,
                    device_id=unit_id,
                )
            elif register_type == "holding":
                response = client.read_holding_registers(
                    address=address,
                    count=count,
                    device_id=unit_id,
                )
            else:
                return ModbusReadResult(
                    connected=True,
                    success=False,
                    host=self.host,
                    port=self.port,
                    unit_id=unit_id,
                    register_type=register_type,
                    address=address,
                    count=count,
                    values=[],
                    message="Ungueltiger Registertyp. Erlaubt sind input oder holding.",
                )

            if response.isError():
                return ModbusReadResult(
                    connected=True,
                    success=False,
                    host=self.host,
                    port=self.port,
                    unit_id=unit_id,
                    register_type=register_type,
                    address=address,
                    count=count,
                    values=[],
                    message=f"Modbus-Fehler: {response}",
                )

            values = [int(value) for value in response.registers]
            return ModbusReadResult(
                connected=True,
                success=True,
                host=self.host,
                port=self.port,
                unit_id=unit_id,
                register_type=register_type,
                address=address,
                count=count,
                values=values,
                message="Register erfolgreich gelesen.",
            )
        except ModbusException as exc:
            return ModbusReadResult(
                connected=True,
                success=False,
                host=self.host,
                port=self.port,
                unit_id=unit_id,
                register_type=register_type,
                address=address,
                count=count,
                values=[],
                message=f"Modbus-Ausnahme: {exc}",
            )
        except OSError as exc:
            return ModbusReadResult(
                connected=False,
                success=False,
                host=self.host,
                port=self.port,
                unit_id=unit_id,
                register_type=register_type,
                address=address,
                count=count,
                values=[],
                message=f"Netzwerkfehler: {exc}",
            )
        finally:
            client.close()

    def scan_unit_ids(
        self,
        register_type: str,
        address: int,
        count: int,
        start: int = 1,
        end: int = 5,
    ) -> list[ModbusReadResult]:
        results: list[ModbusReadResult] = []
        for unit_id in range(start, end + 1):
            results.append(
                self.read_registers(
                    unit_id=unit_id,
                    register_type=register_type,
                    address=address,
                    count=count,
                )
            )
        return results

    def discover_register_blocks(
        self,
        unit_ids: list[int],
        register_type: str,
        start_address: int,
        end_address: int,
        block_size: int,
    ) -> list[RegisterDiscoveryHit]:
        hits: list[RegisterDiscoveryHit] = []

        for unit_id in unit_ids:
            address = start_address
            while address <= end_address:
                count = min(block_size, end_address - address + 1)
                result = self.read_registers(
                    unit_id=unit_id,
                    register_type=register_type,
                    address=address,
                    count=count,
                )
                if result.success:
                    hits.append(
                        RegisterDiscoveryHit(
                            unit_id=unit_id,
                            register_type=register_type,
                            start_address=address,
                            count=count,
                            values=result.values,
                            message=result.message,
                        )
                    )
                address += block_size

        return hits
