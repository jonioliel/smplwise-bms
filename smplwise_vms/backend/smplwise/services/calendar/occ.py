"""CALENDARS-298 sections 3.10, 4, 7 - holidays, open hours, the occurrence cache, conflicts and free slots.

The cache (`cal_occurrences`) is rebuilt per event in the same transaction as any write to it and rolled nightly; it is never the source of
truth (dropping it and rebuilding gives the same rows - a test asserts this). A single (non-recurring) entry is cached in full whatever its
date; a series only inside [now - 30 days, now + series_horizon_days]. Conflict checks read this table."""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from . import model
from .recurrence import Occ, RuleError, expand, parse_rule

UTC = dt.timezone.utc
TERMINAL = ("rejected", "withdrawn", "expired", "cancelled")
PAST_DAYS = 30


def holidays_between(conn: sqlite3.Connection, settings: dict[str, Any], start: dt.date, end: dt.date) -> set[dt.date]:
    from .. import special_days  # noqa: PLC0415

    kinds = {"holiday", "holiday_eve"} if settings.get("holiday_eve_as_holiday") else {"holiday"}
    found = {k: v for k, v in special_days.day_types(special_days.generator_of(conn), start, end).items() if v in kinds}
    try:  # the manager's installation-wide overrides (the door-window calendar): 'regular' cancels a holiday, a holiday kind adds one
        for r in conn.execute("SELECT on_date, day_type FROM door_window_calendar WHERE scope_key = '*' AND on_date >= ? AND on_date <= ?", (start.isoformat(), end.isoformat())).fetchall():
            if r["day_type"] in kinds:
                found[r["on_date"]] = r["day_type"]
            else:
                found.pop(r["on_date"], None)
    except sqlite3.Error:
        pass
    return {dt.date.fromisoformat(k) for k in found}


def hours_of(cal: sqlite3.Row | dict[str, Any], settings: dict[str, Any]) -> dict[str, Any] | None:
    mode = cal["hours_mode"]
    if mode == "always":
        return None
    if mode == "custom" and cal["hours_json"]:
        return json.loads(cal["hours_json"])
    return settings["default_hours"]


def within_hours(cal: sqlite3.Row | dict[str, Any], settings: dict[str, Any], local_start: dt.datetime, local_end: dt.datetime) -> bool:
    doc = hours_of(cal, settings)
    if doc is None:
        return True
    if local_start.date() != local_end.date() and not (local_end.time() == dt.time(0) and local_end.date() - local_start.date() == dt.timedelta(days=1)):
        return False
    if local_start.isoweekday() not in doc["weekdays"]:
        return False
    s, e = doc["start"], doc["end"]
    end_hm = "24:00" if local_end.time() == dt.time(0) and local_end.date() > local_start.date() else local_end.strftime("%H:%M")
    return s <= local_start.strftime("%H:%M") and end_hm <= e


def _parse_local(s: str) -> dt.datetime:
    return dt.datetime.strptime(s, "%Y-%m-%dT%H:%M")


def event_occurrences(conn: sqlite3.Connection, ev: sqlite3.Row, settings: dict[str, Any], now: dt.datetime, *, window_days: int | None = None) -> list[Occ]:
    """Expanded occurrences of one event row (a series expands its rule minus replaced occurrences; an override row is one entry)."""
    ls, le = _parse_local(ev["local_start"]), _parse_local(ev["local_end"])
    if not ev["rrule"]:
        return expand(None, ls, le, ev["tz"], window_start=dt.datetime(1970, 1, 1, tzinfo=UTC), window_end=dt.datetime(2200, 1, 1, tzinfo=UTC))
    days = window_days if window_days is not None else settings["series_horizon_days"]
    w0, w1 = now - dt.timedelta(days=PAST_DAYS), now + dt.timedelta(days=days)
    hol = holidays_between(conn, settings, w0.date() - dt.timedelta(days=2), w1.date() + dt.timedelta(days=2)) if ev["holiday_skip"] else None
    skip = set(json.loads(ev["exdates_json"] or "[]"))
    skip |= {r[0] for r in conn.execute("SELECT override_start FROM cal_events WHERE override_of = ?", (ev["id"],)).fetchall() if r[0]}
    return expand(parse_rule(ev["rrule"]), ls, le, ev["tz"], window_start=w0, window_end=w1, exdates=skip, holidays=hol)


def rebuild(conn: sqlite3.Connection, event_id: str, settings: dict[str, Any], now: dt.datetime) -> int:
    """Rewrites the cached rows of one event (and, for a series, of its override rows). Returns the number of rows written."""
    ev = conn.execute("SELECT * FROM cal_events WHERE id = ?", (event_id,)).fetchone()
    conn.execute("DELETE FROM cal_occurrences WHERE event_id IN (?, ?)", (event_id, held_id(event_id)))
    if ev is None or ev["state"] in TERMINAL:
        return 0
    held = held_of(ev)
    if held and ev["state"] == "pending":  # CAL-GRID-EDIT-2343: the approved slot a change request keeps, confirmed until the decision
        conn.execute("INSERT OR REPLACE INTO cal_occurrences(event_id, holder_calendar_id, room_calendar_id, occ_start, occ_end, local_start, state) VALUES (?,?,?,?,?,?,?)",
                     (held_id(event_id), held["calendar_id"], None, held["starts_at"], held["ends_at"], held["local_start"], "confirmed"))
    base = ev["override_of"] or ev["id"]
    halves: list[tuple[str, str | None, str]] = [(ev["calendar_id"], None, ev["state"])]
    for r in conn.execute("SELECT room_calendar_id, state FROM cal_event_rooms WHERE event_id = ?", (base,)).fetchall():
        if r["state"] not in TERMINAL:
            st = ev["state"] if ev["override_of"] and ev["state"] in ("displaced", "done") else r["state"]
            halves.append((r["room_calendar_id"], r["room_calendar_id"], st))
    written = 0
    for o in event_occurrences(conn, ev, settings, now):
        for holder, room, state in halves:
            conn.execute("INSERT OR REPLACE INTO cal_occurrences(event_id, holder_calendar_id, room_calendar_id, occ_start, occ_end, local_start, state) VALUES (?,?,?,?,?,?,?)",
                         (event_id, holder, room, model.iso(o.start_utc), model.iso(o.end_utc), o.key, state))
            written += 1
    if not ev["override_of"]:
        for (oid,) in conn.execute("SELECT id FROM cal_events WHERE override_of = ?", (event_id,)).fetchall():
            written += rebuild(conn, oid, settings, now)
    return written


HELD_SUFFIX = "#held"


def held_id(event_id: str) -> str:
    """The pseudo event id of a held slot in the occurrence cache (CAL-GRID-EDIT-2343)."""
    return f"{event_id}{HELD_SUFFIX}"


def held_of(ev: sqlite3.Row | dict[str, Any] | None) -> dict[str, Any] | None:
    """The approved slot a pending change request keeps ({calendar_id, starts_at, ends_at, local_start, local_end}), or None."""
    if ev is None:
        return None
    try:
        raw = ev["held_json"]
    except (IndexError, KeyError):
        return None
    if not raw:
        return None
    try:
        doc = json.loads(raw)
    except ValueError:
        return None
    return doc if isinstance(doc, dict) and doc.get("calendar_id") else None


def family(conn: sqlite3.Connection, event_id: str) -> set[str]:
    """The event, its series and every override row of that series: one booking for conflict purposes (its own held slot included)."""
    ev = conn.execute("SELECT id, override_of FROM cal_events WHERE id = ?", (event_id,)).fetchone()
    root = (ev["override_of"] or ev["id"]) if ev else event_id
    ids = {root} | {r[0] for r in conn.execute("SELECT id FROM cal_events WHERE override_of = ?", (root,)).fetchall()}
    return ids | {held_id(i) for i in ids}


def blockers(conn: sqlite3.Connection, holder: sqlite3.Row, spans: Iterable[tuple[dt.datetime, dt.datetime]], settings: dict[str, Any], *,
             exclude: Iterable[str] = (), states: tuple[str, ...] | None = None) -> list[dict[str, Any]]:
    """Cached occurrences on `holder` that collide with any span, buffers of the calendar on both sides (touching is not a collision)."""
    if holder["conflict_policy"] != "exclusive":
        return []
    st = states or (("confirmed", "pending") if settings["pending_holds_slot"] else ("confirmed",))
    margin = dt.timedelta(minutes=holder["buffer_before_min"] + holder["buffer_after_min"])
    skip = set(exclude)
    marks = ",".join("?" * len(st))
    found: dict[tuple[str, str], dict[str, Any]] = {}
    for s, e in spans:
        for r in conn.execute(f"SELECT o.event_id, o.occ_start, o.occ_end, o.state, o.local_start FROM cal_occurrences o WHERE o.holder_calendar_id = ? "
                              f"AND o.state IN ({marks}) AND o.occ_start < ? AND o.occ_end > ?", (holder["id"], *st, model.iso(e + margin), model.iso(s - margin))).fetchall():
            if r["event_id"] in skip:
                continue
            eid, held = r["event_id"], r["event_id"].endswith(HELD_SUFFIX)
            row = {"event_id": eid[: -len(HELD_SUFFIX)] if held else eid, "calendar_id": holder["id"], "start": r["occ_start"], "end": r["occ_end"], "state": r["state"]}
            if held:
                row["held"] = True  # the approved slot of a booking whose change waits for a decision
            found[(eid, r["local_start"])] = row
    return sorted(found.values(), key=lambda c: (c["start"], c["event_id"]))


def free_slots(conn: sqlite3.Connection, cal: sqlite3.Row, settings: dict[str, Any], from_utc: dt.datetime, duration_min: int, *, headcount: int | None = None,
               count: int = 3, span_hours: int = 96, exclude: Iterable[str] = ()) -> list[dict[str, str]]:
    """The first `count` start times at or after `from_utc` (aligned to the calendar's slot step) where the room is free and open."""
    if cal["capacity"] and headcount and headcount > cal["capacity"]:
        return []
    zone = ZoneInfo(cal["tz"])
    step = dt.timedelta(minutes=cal["slot_step_min"])
    dur = dt.timedelta(minutes=duration_min)
    start = from_utc.replace(second=0, microsecond=0)
    mins = (start.astimezone(zone).minute % cal["slot_step_min"])
    if mins:
        start += dt.timedelta(minutes=cal["slot_step_min"] - mins)
    end_limit = from_utc + dt.timedelta(hours=span_hours)
    held = blockers(conn, cal, [(start, end_limit + dur)], settings, exclude=exclude)
    margin = dt.timedelta(minutes=cal["buffer_before_min"] + cal["buffer_after_min"])
    spans = [(model.parse_utc(h["start"], "s") - margin, model.parse_utc(h["end"], "e") + margin) for h in held]
    out: list[dict[str, str]] = []
    cur = start
    while cur < end_limit and len(out) < count:
        ce = cur + dur
        ls, le = cur.astimezone(zone).replace(tzinfo=None), ce.astimezone(zone).replace(tzinfo=None)
        if within_hours(cal, settings, ls, le) and not any(cur < b and a < ce for a, b in spans):
            out.append({"start": model.iso(cur), "end": model.iso(ce)})
            cur = ce  # the next suggestion starts after this one
            continue
        cur += step
    return out


__all__ = ["rebuild", "blockers", "free_slots", "within_hours", "holidays_between", "family", "event_occurrences", "RuleError"]
