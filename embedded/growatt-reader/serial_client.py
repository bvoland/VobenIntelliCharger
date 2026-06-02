from __future__ import annotations

import socket
import time
from dataclasses import dataclass


@dataclass(slots=True)
class ProbeResult:
    host: str
    port: int
    connected: bool
    latency_ms: float | None
    message: str


class TcpSerialClient:
    def __init__(self, host: str, port: int, timeout: float) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout

    def probe(self) -> ProbeResult:
        started = time.perf_counter()

        try:
            with socket.create_connection(
                (self.host, self.port),
                timeout=self.timeout,
            ):
                latency_ms = round((time.perf_counter() - started) * 1000, 2)
                return ProbeResult(
                    host=self.host,
                    port=self.port,
                    connected=True,
                    latency_ms=latency_ms,
                    message="TCP-Verbindung erfolgreich aufgebaut.",
                )
        except TimeoutError:
            return ProbeResult(
                host=self.host,
                port=self.port,
                connected=False,
                latency_ms=None,
                message="Zeitueberschreitung beim Verbindungsaufbau.",
            )
        except OSError as exc:
            return ProbeResult(
                host=self.host,
                port=self.port,
                connected=False,
                latency_ms=None,
                message=f"Verbindung fehlgeschlagen: {exc}",
            )
