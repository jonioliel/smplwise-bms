"""CR-INFRA-ELEVATORS 2.8.0: the elevators' background work - one thread, read-only against the infrastructure.

Every TICK_S (15 s) over the state mirror, for every elevator (all of its sensors, no viewer filter - the routes filter on read):

* the state history (migration 0120 `infra_elevator_states`): a row whenever the derived state changes. While the infrastructure session is
  disconnected every elevator is recorded as `unknown` (the mirror is not a reading) - never an old state carried on.
* the notifications (sources `elevator.fire_service`, `elevator.fault`, `elevator.out_of_service`, services/notify_policy.py): a role whose
  sensor is live `on` for its hold time raises ONE notification (transition memory in `infra_elevator_alerts`, so a restart neither repeats
  nor loses it); live `off`, an unmapped role, a disabled or deleted elevator resolves it. A sensor with no live value and a disconnected mirror
  change nothing (no information is not "the condition ended"). Each role is judged on its own sensor, not on the derived state, so a fault
  that is masked by fire service on the screen still holds its notification.

Recipients: one default policy for now (owner 2026-10-18: recipient selection comes later) - the catalogue's rule `managers` (holders of
notify.manage) intersected with who may see the elevator (subject kind `elevator`, services/notify_visibility). Delivery is the CR-018 pipeline's;
nothing is sent from here, and nothing is ever sent to an elevator. The janitor (hourly, main.janitor_tick) prunes the history."""
from __future__ import annotations

import datetime as dt
import logging
import os
import sqlite3
import threading
import time
from typing import Any

from ..db import Database
from . import elevators as el
from . import notify
from .timeutil import iso_utc

log = logging.getLogger("smplwise.elevators")

TICK_S = 15
PRUNE_EVERY_S = 3600
# how long a role's sensor must stay live `on` before it notifies (fire service at once; a short blip of fault / shutdown is not a notification)
HOLD_S: dict[str, int] = {"fire_service": 0, "fault": 30, "out_of_service": 30}
SOURCE_PREFIX = "elevator."
LINK = "#/infra/elevators"

_PENDING: dict[tuple[str, str], float] = {}
_LAST = {"prune": 0.0}
_lock = threading.Lock()


def reset() -> None:
    """Tests: forget the hold timers and the janitor clock."""
    with _lock:
        _PENDING.clear()
    _LAST["prune"] = 0.0


def source_of(role: str) -> str:
    return f"{SOURCE_PREFIX}{role}"


def dedupe_of(role: str, elevator_id: str) -> str:
    return f"{SOURCE_PREFIX}{role}:{elevator_id}"


def _held(key: tuple[str, str], on: bool, hold_s: int, now_ts: float) -> bool:
    with _lock:
        if not on:
            _PENDING.pop(key, None)
            return False
        start = _PENDING.setdefault(key, now_ts)
        return now_ts - start >= hold_s


def _signal(e: sqlite3.Row, role: str, area_name: str | None, *, resolve: bool = False) -> notify.Signal:
    return notify.Signal(
        source_of(role), "elevator", e["id"], dedupe_key=dedupe_of(role, e["id"]), resolve=resolve,
        params={"name": e["name"], "place": area_name or e["name"]}, origin={"elevator_id": e["id"]}, link=LINK, area_id=e["area_id"])


def _emit(conn: sqlite3.Connection, signal: notify.Signal) -> str | None:
    try:
        res = notify.emit_full(conn, signal)
        return res.id if res.action in ("created", "folded", "renotified") else None
    except Exception:  # noqa: BLE001 - the memory row stands even if the centre refused the signal
        log.warning("elevator notification could not reach the notification centre", exc_info=True)
        return None


def _area_names(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["area_id"]: r["name"] for r in conn.execute("SELECT area_id, name FROM ha_areas").fetchall()}


def resolve_all(conn: sqlite3.Connection, elevator_id: str) -> int:
    """Resolves every open notification of one elevator and forgets its memory (the delete route, before the row goes)."""
    e = conn.execute("SELECT id, name, area_id FROM infra_elevators WHERE id = ?", (elevator_id,)).fetchone()
    try:
        rows = conn.execute("SELECT role FROM infra_elevator_alerts WHERE elevator_id = ?", (elevator_id,)).fetchall()
    except sqlite3.Error:  # before the migration
        return 0
    for r in rows:
        if e is not None:
            _emit(conn, _signal(e, r["role"], None, resolve=True))
        with _lock:
            _PENDING.pop((elevator_id, r["role"]), None)
    conn.execute("DELETE FROM infra_elevator_alerts WHERE elevator_id = ?", (elevator_id,))
    return len(rows)


def evaluate(conn: sqlite3.Connection, now_ts: float, *, connected: bool) -> dict[str, int]:
    """One pass: history rows and notification transitions. Returns {recorded, raised, cleared}."""
    now = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc).replace(microsecond=0))
    rows = conn.execute("SELECT id, name, area_id, enabled FROM infra_elevators ORDER BY sort_order, id").fetchall()
    sensors = el.sensors_of(conn, [r["id"] for r in rows])
    raised = {(r["elevator_id"], r["role"]): r for r in conn.execute("SELECT * FROM infra_elevator_alerts").fetchall()}
    areas: dict[str, str] | None = None
    out = {"recorded": 0, "raised": 0, "cleared": 0}
    for e in rows:
        live = el.live_of(sensors.get(e["id"], []), connected=connected)
        if e["enabled"] and el.record_state(conn, e["id"], live["state"], now, live["since"]):
            out["recorded"] += 1
        if not connected:
            continue  # the mirror is not a reading: hold every notification as it is
        flags: dict[str, bool | None] = live["flags"] if e["enabled"] else {}
        for role in el.ALERT_ROLES:
            key = (e["id"], role)
            v = flags.get(role, False)  # an unmapped role (or a disabled elevator) is "off": its notification ends
            if v is None:
                continue  # mapped, no live value: no change
            if v and key not in raised:
                if _held(key, True, HOLD_S[role], now_ts):
                    if areas is None:
                        areas = _area_names(conn)
                    nid = _emit(conn, _signal(e, role, areas.get(e["area_id"] or "")))
                    conn.execute("INSERT OR REPLACE INTO infra_elevator_alerts (elevator_id, role, raised_at, notification_id) VALUES (?, ?, ?, ?)", (e["id"], role, now, nid))
                    out["raised"] += 1
            elif not v:
                _held(key, False, 0, now_ts)
                if key in raised:
                    _emit(conn, _signal(e, role, None, resolve=True))
                    conn.execute("DELETE FROM infra_elevator_alerts WHERE elevator_id = ? AND role = ?", key)
                    out["cleared"] += 1
    return out


def tick(db: Database, now: float | None = None, *, connected: bool | None = None) -> dict[str, Any]:
    t = float(now if now is not None else time.time())
    with db.connection(label="elevators.tick") as conn:
        try:
            conn.execute("SELECT 1 FROM infra_elevator_states LIMIT 1")
        except sqlite3.Error:  # before the migration
            return {"skipped": "no_schema"}
        if conn.execute("SELECT 1 FROM infra_elevators LIMIT 1").fetchone() is None:
            return {"skipped": "no_elevators"}
        return evaluate(conn, t, connected=el.mirror_connected() if connected is None else connected)


def janitor(db: Database, now: float | None = None) -> dict[str, Any] | None:
    t = float(now if now is not None else time.time())
    if t - _LAST["prune"] < PRUNE_EVERY_S:
        return None
    _LAST["prune"] = t
    cutoff = iso_utc(dt.datetime.fromtimestamp(t - el.HISTORY_KEEP_S, dt.timezone.utc).replace(microsecond=0))
    with db.connection(label="elevators.janitor") as conn:
        try:
            return {"history": el.prune_history(conn, cutoff)}
        except sqlite3.Error:
            return {"skipped": "no_schema"}


class Runner:
    def __init__(self) -> None:
        self.stop_evt = threading.Event()
        self.thread: threading.Thread | None = None
        self.last: dict[str, Any] = {}
        self.errors = 0

    def start(self, db: Database) -> None:
        if os.environ.get("SW_ELEVATORS", "1") == "0" or (self.thread and self.thread.is_alive()):
            return
        self.stop_evt.clear()
        self.thread = threading.Thread(target=self._run, args=(db,), name="elevators-runner", daemon=True)
        self.thread.start()

    def _run(self, db: Database) -> None:
        while not self.stop_evt.wait(TICK_S - (time.time() % TICK_S) + 0.7):
            try:
                self.last = tick(db)
            except Exception:  # noqa: BLE001 - never dies; the next pass retries
                self.errors += 1
                log.warning("elevators pass failed", exc_info=True)

    def shutdown(self) -> None:
        self.stop_evt.set()


RUNNER = Runner()
