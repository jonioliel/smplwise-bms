"""CR-INFRA-ELEVATORS 2.8.0: the elevators' background work - one thread, read-only against the infrastructure.

Every TICK_S (15 s) over the state mirror, for every elevator (all of its sensors, no viewer filter - the routes filter on read):

* the state history (migration 0119 `infra_elevator_states`): a row whenever the derived state changes. While the infrastructure session is
  disconnected every elevator is recorded as `unknown` (the mirror is not a reading) - never an old state carried on.
* the notifications (sources `elevator.fire_service`, `elevator.fault`, `elevator.out_of_service`, services/notify_policy.py): a role whose
  sensor is live `on` for its hold time raises ONE notification (transition memory in `infra_elevator_alerts`, so a restart neither repeats
  nor loses it); live `off`, an unmapped role, a disabled or deleted elevator resolves it. A sensor with no live value and a disconnected mirror
  change nothing (no information is not "the condition ended"). Each role is judged on its own sensor, not on the derived state, so a fault
  that is masked by fire service on the screen still holds its notification.

Alerts are OFF by default (owner decision 2026-10-18, services/elevator_alerts.py): a condition is always tracked (memory row), but a
notification is raised only when the transition happens while the master switch AND the state's switch are on - never retroactively for a
condition that already held when alerts were turned on. Recipients are the ones chosen per state (rule `elevator`), intersected with who may
see the elevator (subject kind `elevator`). Delivery is the CR-018 pipeline's; nothing is sent from here, and nothing is ever sent to an
elevator. The janitor (hourly, main.janitor_tick) prunes the history."""
from __future__ import annotations

import datetime as dt
import logging
import os
import sqlite3
import threading
import time
from typing import Any

from ..db import Database
from . import elevator_alerts as alerts
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
_DEAD: dict[tuple[str, str], float] = {}  # since when a mapped alert sensor has had no live value
# an open notification whose sensor has had no live value this long is closed (resolution sensor_unavailable); a removed sensor at once
DEAD_CLOSE_S = 3600
SENSOR_GONE_TEXT = "החיישן של המעלית לא זמין"
_LAST = {"prune": 0.0}
_lock = threading.Lock()


def reset() -> None:
    """Tests: forget the hold timers and the janitor clock."""
    with _lock:
        _PENDING.clear()
        _DEAD.clear()
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
    """The notification id when the centre really opened (or folded into) a row; None otherwise - a disabled source, nothing to resolve, or an error
    (logged; review M1: the caller then writes no memory row, so the next tick tries again)."""
    try:
        res = notify.emit_full(conn, signal)
        return res.id if res.action in ("created", "folded", "renotified") else None
    except Exception:  # noqa: BLE001 - one failed emit never stops the pass
        log.warning("elevator notification could not reach the notification centre", exc_info=True)
        return None


def _close(conn: sqlite3.Connection, e: sqlite3.Row, role: str, resolution: str, text: str) -> None:
    """Resolves the open notification of one condition with a stated resolution and forgets it (the condition itself stays tracked)."""
    try:
        notify.emit_full(conn, notify.Signal(source_of(role), "elevator", e["id"], dedupe_key=dedupe_of(role, e["id"]), resolve=True,
                                             params={"name": e["name"], "resolution": resolution, "resolve_text": text}, origin={"elevator_id": e["id"]}))
    except Exception:  # noqa: BLE001
        log.warning("elevator notification could not be resolved", exc_info=True)
        return
    conn.execute("UPDATE infra_elevator_alerts SET notification_id = NULL WHERE elevator_id = ? AND role = ?", (e["id"], role))


def _hold_of(conn: sqlite3.Connection, role: str, cache: dict[str, int]) -> int:
    """The built-in hold plus the delay the administrator set on the source's policy (`after_s`), like every other held source (review M3)."""
    if role not in cache:
        from . import notify_policy

        pol = notify_policy.get_policy(conn, source_of(role)) or {}
        cache[role] = HOLD_S[role] + max(0, int(pol.get("after_s") or 0))
    return cache[role]

def _area_names(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["area_id"]: r["name"] for r in conn.execute("SELECT area_id, name FROM ha_areas").fetchall()}


def resolve_all(conn: sqlite3.Connection, elevator_id: str) -> int:
    """Resolves every open notification of one elevator and forgets its memory (the delete route, before the row goes)."""
    e = conn.execute("SELECT id, name, area_id FROM infra_elevators WHERE id = ?", (elevator_id,)).fetchone()
    try:
        rows = conn.execute("SELECT role, notification_id FROM infra_elevator_alerts WHERE elevator_id = ?", (elevator_id,)).fetchall()
    except sqlite3.Error:  # before the migration
        return 0
    for r in rows:
        if e is not None and r["notification_id"]:
            _emit(conn, _signal(e, r["role"], None, resolve=True))
        with _lock:
            _PENDING.pop((elevator_id, r["role"]), None)
    conn.execute("DELETE FROM infra_elevator_alerts WHERE elevator_id = ?", (elevator_id,))
    return len(rows)


def evaluate(conn: sqlite3.Connection, now_ts: float, *, connected: bool) -> dict[str, int]:
    """One pass: history rows and condition transitions. Returns {recorded, tracked (new conditions), raised (notifications), cleared, closed}."""
    now = iso_utc(dt.datetime.fromtimestamp(now_ts, dt.timezone.utc).replace(microsecond=0))
    rows = conn.execute("SELECT id, name, area_id, enabled FROM infra_elevators ORDER BY sort_order, id").fetchall()
    sensors = el.sensors_of(conn, [r["id"] for r in rows])
    raised = {(r["elevator_id"], r["role"]): r for r in conn.execute("SELECT * FROM infra_elevator_alerts").fetchall()}
    areas: dict[str, str] | None = None
    settings = alerts.load(conn)
    holds: dict[str, int] = {}
    out = {"recorded": 0, "tracked": 0, "raised": 0, "cleared": 0, "closed": 0}
    if not connected:
        with _lock:  # review L2: a hold must be observed after the reconnect, never carried across an outage
            _PENDING.clear()
            _DEAD.clear()
    for e in rows:
        rows_e = sensors.get(e["id"], [])
        live = el.live_of(rows_e, connected=connected)
        # review M2: while disabled the elevator is not observed - its history says unknown, never the last state carried on
        if el.record_state(conn, e["id"], live["state"] if e["enabled"] else "unknown", now, live["since"] if e["enabled"] else None):
            out["recorded"] += 1
        if not connected:
            continue  # the mirror is not a reading: hold every notification as it is
        flags: dict[str, bool | None] = live["flags"] if e["enabled"] else {}
        removed = {s["role"] for s in rows_e if s["domain"] is None or s["removed_at"]}
        for role in el.ALERT_ROLES:
            key = (e["id"], role)
            v = flags.get(role, False)  # an unmapped role (or a disabled elevator) is "off": its notification ends
            if v is None:
                # mapped, no live value: no change - except an open notification whose sensor was removed from the platform (closed at once) or
                # has had no value for DEAD_CLOSE_S (review L3): it is closed with a stated resolution; the condition stays tracked
                with _lock:
                    since = _DEAD.setdefault(key, now_ts)
                r = raised.get(key)
                if r is not None and r["notification_id"] and (role in removed or now_ts - since >= DEAD_CLOSE_S):
                    _close(conn, e, role, "sensor_unavailable", SENSOR_GONE_TEXT)
                    out["closed"] += 1
                continue
            with _lock:
                _DEAD.pop(key, None)
            if v and key not in raised:
                if _held(key, True, _hold_of(conn, role, holds), now_ts):
                    # a new transition: notified only while this state's alerts are on (owner: default off, never retroactive)
                    nid = None
                    if alerts.is_on(settings, role):
                        if areas is None:
                            areas = _area_names(conn)
                        nid = _emit(conn, _signal(e, role, areas.get(e["area_id"] or "")))
                        if nid is None:
                            continue  # review M1: nothing opened (refused / failed) - no memory row, the next tick tries again
                        out["raised"] += 1
                    conn.execute("INSERT OR REPLACE INTO infra_elevator_alerts (elevator_id, role, raised_at, notification_id) VALUES (?, ?, ?, ?)", (e["id"], role, now, nid))
                    out["tracked"] += 1
            elif not v:
                _held(key, False, 0, now_ts)
                if key in raised:
                    if raised[key]["notification_id"]:
                        _emit(conn, _signal(e, role, None, resolve=True))
                        out["cleared"] += 1
                    conn.execute("DELETE FROM infra_elevator_alerts WHERE elevator_id = ? AND role = ?", key)
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
            return {"history": el.prune_history(conn, cutoff), "orphans": resolve_orphans(conn)}
        except sqlite3.Error:
            return {"skipped": "no_schema"}


def resolve_orphans(conn: sqlite3.Connection) -> int:
    """Review L9: an open elevator notification whose elevator no longer exists (deleted by a path that did not resolve it, e.g. after a rollback
    and a re-upgrade) is resolved with the resolution `elevator_removed`."""
    rows = conn.execute("""SELECT source, subject_id FROM notifications WHERE source LIKE 'elevator.%' AND state != 'resolved'
                           AND subject_id NOT IN (SELECT id FROM infra_elevators)""").fetchall()
    n = 0
    for r in rows:
        role = str(r["source"]).split(".", 1)[1]
        if role not in el.ALERT_ROLES:
            continue
        try:
            res = notify.emit_full(conn, notify.Signal(r["source"], "elevator", r["subject_id"], dedupe_key=dedupe_of(role, r["subject_id"]), resolve=True,
                                                       params={"resolution": "elevator_removed"}))
            n += res.action == "resolved"
        except Exception:  # noqa: BLE001
            log.warning("orphan elevator notification could not be resolved", exc_info=True)
    return n


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
