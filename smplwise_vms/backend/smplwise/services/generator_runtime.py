"""CR-031 GEN1: the generator background work - one thread, read-only against the infrastructure.

Every TICK_S (15 s) over the state mirror: detection (at most every DETECT_EVERY_S, and on the first pass), the 1-minute history
sample, the alert engine. While the infrastructure session is disconnected the mirror is not a reading, so the pass is skipped
(like the electricity sampler). The janitor (hourly, from main.janitor_tick) prunes history and closed alerts past their retention.
Nothing here writes to a device, to Home Assistant or to the controller (the screen is view and alerts only)."""
from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any

from ..config import Settings
from ..db import Database
from . import generator_alerts as alerts
from . import generator_core as core
from . import generator_history as history

log = logging.getLogger("smplwise.generator")

TICK_S = 15
DETECT_EVERY_S = 300
PRUNE_EVERY_S = 3600
_LAST = {"detect": 0.0, "minute": 0, "prune": 0.0}


def _connected() -> bool:
    from . import ha_sync

    return bool(ha_sync.STATE.connected)


def tick(db: Database, settings: Settings, now: float | None = None, *, require_connection: bool = True) -> dict[str, Any]:
    if require_connection and not _connected():
        return {"skipped": "disconnected"}
    t = float(now if now is not None else time.time())
    out: dict[str, Any] = {}
    with db.connection(label="generator.tick") as conn:
        try:
            conn.execute("SELECT 1 FROM generator_devices LIMIT 1")
        except Exception:  # noqa: BLE001 - before the migration
            return {"skipped": "no_schema"}
        if t - _LAST["detect"] >= DETECT_EVERY_S:
            _LAST["detect"] = t
            out["detected"] = len(core.detect(conn))
        minute = int(t) // 60
        if minute != _LAST["minute"]:
            _LAST["minute"] = minute
            out["samples"] = history.record(conn, int(t))
        out.update(alerts.evaluate(conn, t, mirror_connected=True))
    return out


def janitor(db: Database, now: float | None = None) -> dict[str, Any] | None:
    t = float(now if now is not None else time.time())
    if t - _LAST["prune"] < PRUNE_EVERY_S:
        return None
    _LAST["prune"] = t
    with db.connection(label="generator.janitor") as conn:
        try:
            conn.execute("SELECT 1 FROM generator_devices LIMIT 1")
        except Exception:  # noqa: BLE001
            return {"skipped": "no_schema"}
        return {"history": history.prune(conn, int(t)), "alerts": alerts.prune_alerts(conn, t)}


def reset() -> None:
    _LAST.update({"detect": 0.0, "minute": 0, "prune": 0.0})
    alerts.reset()


class Runner:
    def __init__(self) -> None:
        self.stop_evt = threading.Event()
        self.thread: threading.Thread | None = None
        self.last: dict[str, Any] = {}
        self.errors = 0

    def start(self, db: Database, settings: Settings) -> None:
        if os.environ.get("SW_GENERATOR", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._run, args=(db, settings), name="generator-runner", daemon=True)
        self.thread.start()

    def _run(self, db: Database, settings: Settings) -> None:
        while not self.stop_evt.wait(TICK_S - (time.time() % TICK_S) + 0.5):
            try:
                self.last = tick(db, settings)
            except Exception:  # noqa: BLE001 - never dies; the next pass retries
                self.errors += 1
                log.warning("generator pass failed", exc_info=True)

    def shutdown(self) -> None:
        self.stop_evt.set()


RUNNER = Runner()
