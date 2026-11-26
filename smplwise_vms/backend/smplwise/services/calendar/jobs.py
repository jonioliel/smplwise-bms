"""CALENDARS-298 - the hourly housekeeping of the calendars module (called from main.janitor_tick):

* guest personal data past `erase_after` is erased - ALWAYS, also while the module is switched off (retention must never depend on a switch);
* while the module is on: pending requests past their decision time expire, finished entries become `done`, and the occurrence cache is
  rolled (open series re-expanded to the horizon; guest `erase_after` of open series recomputed). D-04: the dates the roll adds are checked
  against what already holds an exclusive room there; a collision (two confirmed entries at the same time) is reported in the audit log
  (ids and instants only) and the log - the conflict checks at booking time already look past the cache, this is the net under them."""
from __future__ import annotations

import datetime as dt
import logging
import sqlite3
from typing import Any

from ...audit import audit
from ...db import Database, get_setting
from ..janitors import Every
from . import decisions, guests, model, occ
from ...test_reset import register_reset

log = logging.getLogger(__name__)
LAST_KEY = occ.ROLL_KEY  # "calendar.janitor.last_roll"


def run(db: Database, now: dt.datetime | None = None) -> dict[str, int]:
    now = now or dt.datetime.now(dt.timezone.utc)
    out = {"erased": 0, "expired": 0, "done": 0, "rolled": 0, "collisions": 0}
    with db.connection(label="calendar.janitor") as conn:
        settings = model.read_settings(conn)
        due = [r[0] for r in conn.execute("SELECT DISTINCT event_id FROM cal_guest_details WHERE erased_at IS NULL AND erase_after <= ?", (model.iso(now),)).fetchall()]
        for eid in due:  # one entry at a time: a failure never blocks the others
            out["erased"] += guests.erase_event(conn, eid, model.iso(now))
        if out["erased"]:
            audit(conn, actor=None, action="calendar.guests.erase", decision="allowed", resource_type="installation", resource_id="calendar", details={"records": out["erased"], "entries": len(due)})
        if not settings["enabled"]:
            return out
        res = decisions.expire_and_finish(conn, settings, now)
        out.update(res)
        last = get_setting(conn, LAST_KEY)
        if last != now.date().isoformat():  # the nightly roll: once per day
            for (eid,) in conn.execute("SELECT id FROM cal_events WHERE rrule IS NOT NULL AND override_of IS NULL AND state IN ('pending','confirmed')").fetchall():
                out["rolled"] += occ.rebuild(conn, eid, settings, now)
            out["collisions"] = report_collisions(conn, settings, now, last)
            guests.recompute_all(conn, settings, now)
            conn.execute("DELETE FROM cal_occurrences WHERE occ_end < ?", (model.iso(now - dt.timedelta(days=occ.PAST_DAYS)),))
            conn.execute("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (LAST_KEY, now.date().isoformat()))
    return out


def _root(conn: sqlite3.Connection, eid: str) -> str:
    base = eid[: -len(occ.HELD_SUFFIX)] if eid.endswith(occ.HELD_SUFFIX) else eid
    r = conn.execute("SELECT override_of FROM cal_events WHERE id = ?", (base,)).fetchone()
    return (r["override_of"] if r is not None and r["override_of"] else base)


def report_collisions(conn: sqlite3.Connection, settings: dict[str, Any], now: dt.datetime, last: str | None) -> int:
    """D-04: two CONFIRMED entries of different bookings at the same time on an exclusive holder, among the dates the roll just added (from
    the previous roll's edge - one day when there is none - to `now + series_horizon_days`). One audit row per pass (ids and instants only,
    never a title or a name). Returns the number of colliding pairs."""
    horizon = dt.timedelta(days=settings["series_horizon_days"])
    try:
        since = dt.datetime.combine(dt.date.fromisoformat(last), dt.time(0), tzinfo=dt.timezone.utc) + horizon if last else now + horizon - dt.timedelta(days=1)
    except ValueError:
        since = now + horizon - dt.timedelta(days=1)
    rows = conn.execute(
        "SELECT a.holder_calendar_id AS cal, a.event_id AS a_id, b.event_id AS b_id, a.occ_start AS a_start, b.occ_start AS b_start FROM cal_occurrences a "
        "JOIN cal_occurrences b ON b.holder_calendar_id = a.holder_calendar_id AND a.event_id < b.event_id AND a.occ_start < b.occ_end AND a.occ_end > b.occ_start "
        "JOIN cal_calendars c ON c.id = a.holder_calendar_id "
        "WHERE c.conflict_policy = 'exclusive' AND a.state = 'confirmed' AND b.state = 'confirmed' AND max(a.occ_start, b.occ_start) >= ? AND max(a.occ_start, b.occ_start) <= ? "
        "ORDER BY a.occ_start LIMIT 200", (model.iso(min(since, now + horizon)), model.iso(now + horizon))).fetchall()
    found = [r for r in rows if _root(conn, r["a_id"]) != _root(conn, r["b_id"])]
    if found:
        items = [{"calendar_id": r["cal"], "event_ids": [r["a_id"], r["b_id"]], "starts": [r["a_start"], r["b_start"]]} for r in found[:20]]
        audit(conn, actor=None, action="calendar.occurrence.collision", decision="allowed", resource_type="installation", resource_id="calendar",
              details={"pairs": len(found), "items": items})
        log.warning("calendar roll: %d double booking(s) on exclusive calendars (audit calendar.occurrence.collision)", len(found))
    return len(found)


_TICK = Every(3000)  # CR-JANITOR-REGISTRY-2438: the shared throttle (was the module global _last_tick)


def tick(db: Database) -> None:
    """At most once per 50 minutes per process (the pattern of services/pending_retention)."""
    if not _TICK.due():
        return
    try:
        run(db)
    except Exception:  # noqa: BLE001 - housekeeping never stops the janitor tick
        log.warning("calendar janitor failed", exc_info=True)



def notice_tick(db: Database, now: dt.datetime | None = None) -> int:
    """CAL-GRID-EDIT-2343: every janitor pass (30 s) delivers the held-back notices that are due (the undo window of the grid has passed)."""
    from . import notices  # noqa: PLC0415

    now = now or dt.datetime.now(dt.timezone.utc)
    try:
        with db.connection(label="calendar.notices") as conn:
            if conn.execute("SELECT 1 FROM cal_notices WHERE sent_at IS NULL AND withdrawn_at IS NULL AND due_at <= ? LIMIT 1", (model.iso(now),)).fetchone() is None:
                return 0
            return notices.deliver_due(conn, now)
    except Exception:  # noqa: BLE001 - housekeeping never stops the janitor tick
        log.warning("calendar notices failed", exc_info=True)
        return 0


def sync_run(db: Database, data_dir, now: dt.datetime | None = None) -> dict:
    """Phase 2: every due external-calendar sync (polling; nothing while the module or `sync_enabled` is off, nothing without a connection)."""
    from ..calendar_sync import engine  # noqa: PLC0415

    now = now or dt.datetime.now(dt.timezone.utc)
    return engine.run_due_db(db, data_dir, now)  # CALCONNECT-2330: no write lock is held while a provider is asked


_SYNC_TICK = Every(55)  # CR-JANITOR-REGISTRY-2438: the shared throttle (was the module global _last_sync_tick)


def sync_tick(db: Database, data_dir) -> None:
    """At most once per minute per process; the connections' own `next_sync_at` (poll_min, jitter, back-off) decides who is due."""
    if not _SYNC_TICK.due():
        return
    try:
        sync_run(db, data_dir)
    except Exception:  # noqa: BLE001 - housekeeping never stops the janitor tick
        log.warning("calendar sync failed", exc_info=True)


def _reset_ticks() -> None:
    _TICK.reset()
    _SYNC_TICK.reset()


register_reset(__name__, ("_TICK", "_SYNC_TICK"), _reset_ticks)  # CR-BE-COMPLEXITY-2450: a shared-class singleton (tests/test_singletons_registered.py)
