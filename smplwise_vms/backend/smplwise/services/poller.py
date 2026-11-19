"""One background poller shape (CR-HEALTH-POLLERS, review 03:F11).

Three services ran the same thread: an environment switch, a stop event, one first wait, a loop that survives a raising pass,
a join at shutdown. `PeriodicWorker` is that thread once; each service keeps its own `POLLER = PeriodicWorker(...)` with its
thread name, switch, first delay and pass.

- `start(db, settings)` does nothing when the environment switch is "0" or the thread already runs.
- `tick(db, settings)` is one pass. `interval(db, settings)` gives the wait after it, in seconds; it is asked BEFORE the pass
  and inside the same guard, so a raising read skips the pass and waits `default_interval` (the recorder poller reads its
  interval from the database this way).
- `shutdown(timeout)` sets the stop event and joins; called from the worker's own thread it only sets the event.
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Any, Callable


class PeriodicWorker:
    def __init__(self, *, name: str, env_flag: str, first_delay: float, tick: Callable[[Any, Any], Any],
                 interval: Callable[[Any, Any], float], default_interval: float, log: logging.Logger, what: str) -> None:
        self.name = name
        self.env_flag = env_flag
        self.first_delay = first_delay
        self._tick = tick
        self._interval = interval
        self._default_interval = default_interval
        self._log = log
        self._what = what
        self.thread: threading.Thread | None = None
        self.stop_evt = threading.Event()

    def start(self, db: Any, settings: Any) -> None:
        if os.environ.get(self.env_flag, "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._loop, args=(db, settings), name=self.name, daemon=True)
        self.thread.start()

    def shutdown(self, timeout: float = 3.0) -> None:
        self.stop_evt.set()
        t = self.thread
        if t is not None and t is not threading.current_thread():
            t.join(timeout=timeout)

    def _loop(self, db: Any, settings: Any) -> None:
        if self.stop_evt.wait(self.first_delay):
            return
        while not self.stop_evt.is_set():
            interval = self._default_interval
            try:
                interval = self._interval(db, settings)
                self._tick(db, settings)
            except Exception:  # noqa: BLE001 - the poller never dies on one bad pass
                self._log.exception("%s pass failed", self._what)
            self.stop_evt.wait(interval)
