"""COMPLY108-295 (docs/changes/CR-COMPLY108.md): the COMPLIANCE EXPORT - who COULD enter which door, and WHEN.

A read-only, derived report for security and insurance audits. It answers "could enter" (what the configuration allows), never "did enter"
(that is the entry log, `access.events.export`). Nothing is stored: the file is generated for the request and streamed; no PIN, card
number, phone, photo or profile value is ever read into the report.

Reuse, not a second rule engine. The grants themselves are NOT recomputed here:
- the people, their enabled station assignments (the EFFECTIVE door map - groups and personal allow/deny already applied by WisKey),
  groups, validity and `active` / `archived` come from the one read adapter (`intercom_adapter.ADAPTER.people / person / groups`), so the
  caller's station-scoped visibility (`intercom_authority.Authority`, rbac deny-overrides over the station chain) is applied by the same
  code that serves the people screen;
- the SOURCE of a station grant (personal allow / group / direct) is labelled from the same two facts the station-permission screen uses
  (`access_station_permissions` rows and the person's enabled groups); an Arx record that contradicts WisKey is FLAGGED, never silently
  resolved;
- an external (vendor / technician) grant is the `access_grants` row of the person's link (`access_grants.LIVE` states): its window is
  intersected as an extra limit;
- hold-open door windows come from the planner's own occurrence rows (`door_window_occurrences`), holidays and calendar already applied.

The one thing that did not exist anywhere is "is this instant inside the person's daily-hours schedule" (the code compares and prints
schedules, it never evaluates them), so that small evaluator is here: `schedule_intervals`. Everything else is a filter over the above.

Direction of errors: an audit export must not under-report. Anything unreadable (a schedule that cannot be parsed) keeps the person IN the
matrix with a flag; anything that cannot be read at all (an incomplete scan, WisKey unavailable) refuses the export (503), it never returns
a quietly shorter list.
"""
from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass
from datetime import date, datetime, time as dtime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from ..db import get_setting
from ..errors import ApiError
from ..rbac import Principal
from . import access_grants as ag
from . import access_station_permissions as sp
from . import intercom_authority as ia

FLAG_KEY = "access.compliance_export"
KEYS = (FLAG_KEY,)
MAX_PERIOD_DAYS = 93
MAX_PEOPLE = 500          # people with at least one exportable station; above it the caller narrows by station / group (413)
MAX_ROWS = 20000          # person x station rows
PAGE = 200
EXPORT_RATE_S = 60.0      # one export a minute per user (the external-grants export's rule)
HELD_OPEN = ("planned", "armed", "starting", "active", "ending", "relock_unconfirmed", "closed_confirmed")
CONFIRMED_OPEN = ("active", "ending", "relock_unconfirmed", "closed_confirmed")
NOTICE = ("could_enter: derived from the access configuration as read at generated_at (permissions, groups, validity, daily hours, "
          "external grants, hold-open windows). It is NOT a record of who entered, and it does not prove that the door hardware holds "
          "the same configuration (see sync_state).")

WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")  # locale-free
_last: dict[str, float] = {}


# ---------------------------------------------------------------- switch, rate

def enabled(conn: sqlite3.Connection) -> bool:
    try:
        return (get_setting(conn, FLAG_KEY) or "off") == "on"
    except Exception:  # noqa: BLE001 - fail closed
        return False


def settings_view(conn: sqlite3.Connection) -> dict[str, Any]:
    return {"compliance_export": "on" if enabled(conn) else "off"}


def reset_rate() -> None:
    """Tests only."""
    _last.clear()


def wait_s(user_id: str, now: float | None = None) -> float:
    now = time.monotonic() if now is None else now
    last = _last.get(user_id)
    return 0.0 if last is None else max(0.0, EXPORT_RATE_S - (now - last))


def mark(user_id: str) -> None:
    _last[user_id] = time.monotonic()


# ---------------------------------------------------------------- the question

@dataclass(frozen=True)
class Window:
    """The asked time range, UTC. A point-in-time question is a one-second range starting at `start` (one code path for both views)."""

    start: datetime
    end: datetime
    point: bool

    @classmethod
    def at(cls, instant: datetime) -> "Window":
        return cls(instant, instant + timedelta(seconds=1), True)

    @classmethod
    def period(cls, start: datetime, end: datetime) -> "Window":
        if end <= start:
            raise ApiError(422, "compliance_period_invalid", "סוף התקופה חייב להיות אחרי תחילתה.")
        if end - start > timedelta(days=MAX_PERIOD_DAYS):
            raise ApiError(422, "compliance_period_too_long", f"אפשר לייצא תקופה של עד {MAX_PERIOD_DAYS} ימים.", details={"max_days": MAX_PERIOD_DAYS})
        return cls(start, end, False)


Interval = tuple[datetime, datetime]


def _utc(text: str | None) -> datetime | None:
    at = ag.parse_iso(text) if text else None
    return at.astimezone(timezone.utc) if at else None


def merge(items: list[Interval]) -> list[Interval]:
    out: list[Interval] = []
    for s, e in sorted(i for i in items if i[0] < i[1]):
        if out and s <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out


def intersect(a: list[Interval], b: list[Interval]) -> list[Interval]:
    out: list[Interval] = []
    for s1, e1 in a:
        for s2, e2 in b:
            s, e = max(s1, s2), min(e1, e2)
            if s < e:
                out.append((s, e))
    return merge(out)


def _minutes(text: str) -> int:
    return 1440 if text == "24:00" else int(text[:2]) * 60 + int(text[3:])


class ScheduleUnreadable(Exception):
    pass


def schedule_intervals(schedule: dict[str, Any], window: Interval) -> list[Interval]:
    """The daily-hours schedule ({mode weekly|dates, timezone, days, dates, periods[{start,end}]}, WisKey's `access_timing_policy.schedule`)
    as UTC intervals inside `window`. `weekly`: the named weekdays (any letter case); `dates`: the listed calendar dates; both in the
    schedule's IANA zone, `24:00` = midnight. Raises ScheduleUnreadable for anything that is not that shape (the caller keeps the person
    in the report and flags it)."""
    try:
        zone = ZoneInfo(str(schedule["timezone"]))
        mode = schedule["mode"]
        periods = [(_minutes(p["start"]), _minutes(p["end"])) for p in schedule.get("periods") or []]
        days = {str(d).strip().lower() for d in schedule.get("days") or []}
        dates = {str(d) for d in schedule.get("dates") or []}
        if mode not in ("weekly", "dates") or not periods or any(not 0 <= s < e <= 1440 for s, e in periods):
            raise ScheduleUnreadable
    except ScheduleUnreadable:
        raise
    except Exception as exc:  # noqa: BLE001 - any shape problem is "unreadable", never "no restriction"
        raise ScheduleUnreadable from exc
    first = (window[0] - timedelta(days=1)).astimezone(zone).date()
    last = (window[1] + timedelta(days=1)).astimezone(zone).date()
    out: list[Interval] = []
    day = first
    while day <= last:
        hit = WEEKDAYS[day.weekday()] in days if mode == "weekly" else day.isoformat() in dates
        if hit:
            for s, e in periods:
                out.append((_local_utc(day, s, zone), _local_utc(day, e, zone)))
        day += timedelta(days=1)
    return intersect(merge(out), [window])


def _local_utc(day: date, minutes: int, zone: ZoneInfo) -> datetime:
    """Wall-clock `minutes` after local midnight of `day` in `zone`, as UTC (1440 = the next local midnight)."""
    target = day + timedelta(days=1) if minutes == 1440 else day
    minutes = 0 if minutes == 1440 else minutes
    return datetime.combine(target, dtime(minutes // 60, minutes % 60), tzinfo=zone).astimezone(timezone.utc)


def person_intervals(person: dict[str, Any], schedule: dict[str, Any] | None, grant: dict[str, Any] | None,
                     window: Window) -> tuple[list[Interval], str | None, list[str]]:
    """(the UTC intervals inside `window` in which the person's configuration lets them in, why not, flags). Order of the funnel:
    archived -> inactive -> validity -> daily hours -> external grant window. The first stage that empties the set names the reason (a
    closed code). An unreadable daily-hours schedule does not narrow (flag `schedule_unreadable`)."""
    flags: list[str] = []
    if person.get("archived"):
        return [], "archived", flags
    if person.get("active") is not True:
        return [], "inactive", flags
    base: list[Interval] = [(window.start, window.end)]
    vf, vu = _utc(person.get("valid_from")), _utc(person.get("valid_until"))
    if vf or vu:
        limit = (vf or datetime.min.replace(tzinfo=timezone.utc), vu or datetime.max.replace(tzinfo=timezone.utc))
        base = intersect(base, [limit])
        if not base:
            if vu is not None and vu <= window.start:
                return [], "expired", flags
            return [], "not_yet_valid", flags
    if schedule is not None:
        try:
            base = intersect(base, schedule_intervals(schedule, (window.start, window.end)))
        except ScheduleUnreadable:
            flags.append("schedule_unreadable")
        if not base:
            return [], "outside_schedule", flags
    if grant is not None:
        gf, gu = _utc(grant.get("valid_from")), _utc(grant.get("valid_until"))
        if gf and gu:
            base = intersect(base, [(gf, gu)])
            if not base:
                return [], "outside_external_grant", flags
        timing = grant.get("timing")
        if timing:
            try:
                base = intersect(base, schedule_intervals(timing, (window.start, window.end)))
            except ScheduleUnreadable:
                pass  # the person's own schedule (already applied) mirrors it; an unreadable copy never narrows
            if not base:
                return [], "outside_external_grant", flags
    return base, None, flags


# ---------------------------------------------------------------- reading the sources (all through the one adapter)

def _unavailable(code: str = "compliance_source_unavailable") -> ApiError:
    return ApiError(503, code, "לא ניתן לקרוא כעת את נתוני בקרת הכניסה. הייצוא לא הופק.", retryable=True)


def read_people(settings: Any, auth: ia.Authority, *, station_id: str | None, group: str | None) -> list[dict[str, Any]]:
    """Every person the caller may see (names level at least), paged through the adapter. A scan that stopped early, a stale snapshot or
    an unavailable feed refuses the export (an audit file is never silently partial)."""
    from . import intercom_adapter as adapter

    out: list[dict[str, Any]] = []
    offset, snapshot = 0, None
    filters: dict[str, Any] = {"sort": "name"}
    if station_id:
        filters["station"] = station_id
    if group:
        filters["group"] = group
    for _ in range(200):
        reply = adapter.ADAPTER.people(settings, auth, query="", filters=dict(filters), offset=offset, limit=PAGE, snapshot=snapshot)
        page = reply.get("people")
        if page is None or reply.get("state") not in (None, "ready"):
            raise _unavailable()
        if not page.get("complete", True) or (snapshot is not None and page.get("stale")):
            raise _unavailable("compliance_source_incomplete")
        snapshot = page.get("snapshot")
        out.extend(page["records"])
        if page.get("next_offset") is None:
            return out
        offset = page["next_offset"]
    raise _unavailable("compliance_source_incomplete")


def read_groups(settings: Any, auth: ia.Authority) -> dict[str, dict[str, Any]]:
    from . import intercom_adapter as adapter

    reply = adapter.ADAPTER.groups(settings, auth)
    groups = reply.get("groups")
    if groups is None:
        raise _unavailable()
    return {g["id"]: g for g in groups.get("groups") or []}


def read_schedule(settings: Any, auth: ia.Authority, person_id: str) -> tuple[dict[str, Any] | None, str | None]:
    """(schedule in force, flag). The person's page carries the timing; only the POLICY is in force (`enforcement` set) - a bare draft is
    a proposal that nothing enforces and is ignored with a flag."""
    from . import intercom_adapter as adapter

    try:
        reply = adapter.ADAPTER.person(settings, auth, person_id)
    except ApiError as exc:
        raise _unavailable("compliance_source_incomplete") from exc  # the person vanished mid-scan: the file would be partial
    one = reply.get("person")
    if one is None:
        raise _unavailable()
    timing = one.get("timing")
    if not timing:
        return None, None
    if timing.get("enforcement") is None:
        return None, "schedule_draft_ignored"
    return timing, None


def external_grant(conn: sqlite3.Connection, person_id: str) -> dict[str, Any] | None:
    """The live external grant of the WisKey person (the same join `access_station_permissions.grant_live` uses), as a small dict. A
    grant that is not yet provisioned (requested / approved) cannot let anyone in and is not reported as one."""
    marks = ",".join("?" * len(ag.LIVE))
    try:
        row = conn.execute(
            f"""SELECT g.id, g.state, g.valid_from, g.valid_until, g.timing_json FROM access_person_links l JOIN access_grants g
                  ON (g.link_id = l.id OR (g.subject_kind = l.subject_kind AND g.subject_id = l.subject_id))
                WHERE l.wiskey_person_id = ? AND g.state IN ({marks}) LIMIT 1""", (person_id, *ag.LIVE)).fetchone()
    except sqlite3.OperationalError:
        return None
    if row is None:
        return None
    import json

    try:
        timing = json.loads(row["timing_json"]) if row["timing_json"] else None
    except ValueError:
        timing = None
    return {"id": row["id"], "state": row["state"], "valid_from": row["valid_from"], "valid_until": row["valid_until"], "timing": timing,
            "provisioned": row["state"] in ("active", "revoking", "unknown")}


def door_windows(conn: sqlite3.Connection, window: Window, stations: set[str], names: dict[str, str]) -> list[dict[str, Any]]:
    """Hold-open windows (free passage: while a door is held open ANYONE can walk in) from the planner's occurrence rows."""
    marks = ",".join("?" * len(HELD_OPEN))
    try:
        rows = conn.execute(
            f"""SELECT station_id, relay, start_at, end_at, state, origin FROM door_window_occurrences
                WHERE state IN ({marks}) AND start_at < ? AND end_at > ? ORDER BY station_id, relay, start_at""",
            (*HELD_OPEN, ag.iso(window.end), ag.iso(window.start))).fetchall()
    except sqlite3.OperationalError:
        return []
    return [{"station_id": r["station_id"], "station": names.get(r["station_id"]), "door": r["relay"],
             "from": ag.iso(max(_utc(r["start_at"]) or window.start, window.start)), "to": ag.iso(min(_utc(r["end_at"]) or window.end, window.end)),
             "state": "confirmed" if r["state"] in CONFIRMED_OPEN else "planned", "origin": r["origin"]}
            for r in rows if r["station_id"] in stations]


# ---------------------------------------------------------------- the matrix

def build(conn: sqlite3.Connection, settings: Any, principal: Principal, window: Window, *, station_id: str | None = None, group: str | None = None,
          include_excluded: bool = False) -> dict[str, Any]:
    """The matrix. Visible stations = stations on which the caller holds BOTH `access.events.export` and `access.people.read` (rbac deny
    overrides over the station chain, via ia.Authority); a person's row for any other station is simply not produced."""
    auth = ia.Authority(conn, principal)
    if station_id is not None and not (auth.station(ia.EVENTS_EXPORT, station_id) and auth.station(ia.PEOPLE_READ, station_id)):
        raise ApiError(404, "compliance_station_not_found", "העמדה לא נמצאה.")  # a station the caller cannot export looks like a missing one

    def exportable(sid: Any) -> bool:
        return auth.station(ia.EVENTS_EXPORT, sid) and auth.station(ia.PEOPLE_READ, sid)

    people = read_people(settings, auth, station_id=station_id, group=group)
    groups = read_groups(settings, auth)
    names = sp._station_names()
    tz = ag.zone_of(conn)
    candidates = []
    unknown: list[dict[str, Any]] = []
    for p in people:
        if not isinstance(p.get("stations"), list):
            unknown.append({"person_id": p["id"], "reason": "stations_unreadable"})  # never silently "no access"
            continue
        rows = [a for a in (p.get("stations") or []) if isinstance(a, dict) and a.get("enabled") and exportable(a.get("station_id"))
                and (station_id is None or a["station_id"] == station_id)]
        if rows:
            candidates.append((p, rows))
    if len(candidates) > MAX_PEOPLE:
        raise ApiError(413, "compliance_export_too_large", "יותר מדי אנשים לייצוא אחד. צמצמו לפי עמדה או קבוצה.", details={"max_people": MAX_PEOPLE})
    out: list[dict[str, Any]] = []
    seen_stations: set[str] = set()
    for p, assigned in candidates:
        flags: list[str] = []
        schedule, schedule_flag = read_schedule(settings, auth, p["id"])
        if schedule_flag:
            flags.append(schedule_flag)
        grant = external_grant(conn, p["id"])
        if grant is not None and not grant["provisioned"]:
            grant = None
        spans, reason, more = person_intervals(p, schedule, grant, window)
        flags += more
        arx = sp.rows_of(conn, p["id"]) if _table(conn) else {}
        granting = [g for g in (groups.get(gid) for gid in p.get("group_ids") or []) if g and g.get("enabled")]
        for a in sorted(assigned, key=lambda r: r["station_id"]):
            sid = a["station_id"]
            seen_stations.add(sid)
            row_flags = list(flags)
            by_group = [g["label"] for g in granting if isinstance(g.get("station_ids"), list) and sid in g["station_ids"]]
            record = arx.get(sid) or {}
            effect = record.get("effect")
            if effect == "allow":
                source = "personal"
            elif effect == "deny":
                source = "direct"
                row_flags.append("arx_deny_recorded_but_enabled")  # WisKey says enabled, Arx recorded a block: reported, not resolved
            else:
                source = "group" if by_group else "direct"
            if grant is not None:
                source = "external_grant"
            if a.get("sync_state") not in (None, "synced"):
                row_flags.append("device_sync_" + str(a.get("sync_state")))
            if source == "group" and not by_group:
                row_flags.append("group_unconfirmed")
            if not spans and not include_excluded:
                continue
            out.append({
                "person_id": p["id"], "display_name": p.get("display_name") or "", "employee_no": p.get("employee_no"),
                "category": p.get("access_category"), "station_id": sid, "station": names.get(sid), "doors": sorted(a.get("doors") or []),
                "source": source, "groups": by_group if source in ("group", "personal") else [],
                "schedule": ({"enforcement": schedule.get("enforcement"), "mode": schedule.get("mode"), "timezone": schedule.get("timezone")}
                             if schedule else None),
                "valid_from": p.get("valid_from"), "valid_until": p.get("valid_until"),
                "external_grant": ({"id": grant["id"], "state": grant["state"]} if grant else None),
                "could_enter": bool(spans),
                "intervals": [{"from": ag.iso(s), "to": ag.iso(e)} for s, e in spans] if not window.point else [],
                "reason": None if spans else reason, "flags": sorted(set(row_flags)),
            })
            if len(out) > MAX_ROWS:
                raise ApiError(413, "compliance_export_too_large", "יותר מדי שורות לייצוא. צמצמו לפי עמדה, קבוצה או תקופה.", details={"max_rows": MAX_ROWS})
    scope_ids = {sid for sid in (names or {}) if exportable(sid)} | seen_stations
    windows = door_windows(conn, window, scope_ids if station_id is None else {station_id}, names)
    return {
        "kind": "point" if window.point else "period",
        "at": ag.iso(window.start) if window.point else None,
        "from": None if window.point else ag.iso(window.start), "to": None if window.point else ag.iso(window.end),
        "timezone": getattr(tz, "key", "UTC"), "generated_at": ag.iso(ag.now()), "complete": True,
        "notice": NOTICE, "people": len({r["person_id"] for r in out}), "rows": out, "door_windows": windows, "unknown": unknown,
    }


def _table(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("SELECT 1 FROM access_station_permissions LIMIT 1")
        return True
    except sqlite3.OperationalError:
        return False


# ---------------------------------------------------------------- CSV

COLUMNS = ("person_id", "display_name", "employee_no", "category", "station_id", "station", "doors", "source", "groups", "schedule",
           "valid_from", "valid_until", "external_grant", "could_enter", "interval_from_utc", "interval_to_utc", "reason", "flags")


def csv_cells(matrix: dict[str, Any]) -> list[list[Any]]:
    """Header + one line per (person, station, interval); a point view and an excluded pair have one line with empty interval cells. Every
    cell through the shared formula guard."""
    from .tickets.text_hygiene import csv_cell

    cells: list[list[Any]] = [list(COLUMNS)]
    for r in matrix["rows"]:
        base = {
            "person_id": r["person_id"], "display_name": r["display_name"], "employee_no": r["employee_no"], "category": r["category"],
            "station_id": r["station_id"], "station": r["station"], "doors": " ".join(str(d) for d in r["doors"]), "source": r["source"],
            "groups": "; ".join(r["groups"]), "schedule": ((r["schedule"] or {}).get("mode") or "") if r["schedule"] else "",
            "valid_from": r["valid_from"], "valid_until": r["valid_until"], "external_grant": (r["external_grant"] or {}).get("id") if r["external_grant"] else "",
            "could_enter": r["could_enter"], "reason": r["reason"], "flags": " ".join(r["flags"]),
        }
        spans = r["intervals"] or [{"from": None, "to": None}]
        for s in spans:
            cells.append([csv_cell(({**base, "interval_from_utc": s["from"], "interval_to_utc": s["to"]})[c]) for c in COLUMNS])
    return cells
