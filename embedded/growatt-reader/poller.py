from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Event, Lock, Thread


@dataclass(slots=True)
class PollerStatus:
    running: bool
    interval_seconds: int
    last_run_at: float | None
    last_success_at: float | None
    last_duration_seconds: float | None
    last_error: str
    saved_snapshots: int


class SnapshotPoller:
    def __init__(self, interval_seconds: int, collect_snapshot, save_snapshot, count_snapshots) -> None:
        self.interval_seconds = interval_seconds
        self._collect_snapshot = collect_snapshot
        self._save_snapshot = save_snapshot
        self._count_snapshots = count_snapshots
        self._stop_event = Event()
        self._thread: Thread | None = None
        self._lock = Lock()
        self._last_run_at: float | None = None
        self._last_success_at: float | None = None
        self._last_duration_seconds: float | None = None
        self._last_error = ""

    def start(self) -> bool:
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return False
            self._stop_event = Event()
            self._thread = Thread(target=self._run_loop, daemon=True)
            self._thread.start()
            return True

    def stop(self) -> bool:
        with self._lock:
            if self._thread is None or not self._thread.is_alive():
                return False
            self._stop_event.set()
            return True

    def set_interval(self, interval_seconds: int) -> None:
        with self._lock:
            self.interval_seconds = interval_seconds

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            self._last_run_at = time.time()
            started_monotonic = time.monotonic()
            try:
                payload = self._collect_snapshot()
                self._save_snapshot(payload)
                self._last_success_at = time.time()
                self._last_error = ""
            except Exception as exc:
                self._last_error = str(exc)
            finally:
                self._last_duration_seconds = time.monotonic() - started_monotonic

            interval_seconds = self.interval_seconds
            remaining_wait = max(0.0, interval_seconds - self._last_duration_seconds)
            if self._stop_event.wait(remaining_wait):
                break

    def status(self) -> PollerStatus:
        running = self._thread is not None and self._thread.is_alive()
        return PollerStatus(
            running=running,
            interval_seconds=self.interval_seconds,
            last_run_at=self._last_run_at,
            last_success_at=self._last_success_at,
            last_duration_seconds=self._last_duration_seconds,
            last_error=self._last_error,
            saved_snapshots=self._count_snapshots(),
        )
