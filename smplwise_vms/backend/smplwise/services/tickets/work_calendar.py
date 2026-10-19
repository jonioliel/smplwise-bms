"""SLACAL (2.9.1 / 2.10): working-hours calendars for ticket timing.

Until now every ticket timer (unassigned / ack / stuck / waiting / overdue / link-not-opened thresholds, the reminder cadence and the
manager alert that follows it) counted wall-clock minutes (CR-038 D7). This module adds an OPTIONAL installation-level calendar:

    {"enabled": false,                 # default: 24x7 = exactly the old behaviour; nothing changes until an administrator turns it on
     "weekdays": [6, 0, 1, 2, 3],      # ISO-style, Monday = 0 ... Sunday = 6 (default Sunday-Thursday)
     "start": "08:00", "end": "17:00", # one daily window, local time, start < end (no window across midnight)
     "holidays": ["2026-10-20"],       # local dates with no working time at all
     "departments": {"dept-id": {...}} # optional per-department override of weekdays / start / end (or {"enabled": false} = 24x7)}

The zone is the installation's `time.zone` setting (the same one the vendor send hours use), default Asia/Jerusalem. Internal instants stay
UTC (AGENTS.md); the window of each local day is converted per day, so DST days follow the zone (a window that contains the change simply
has 1 hour more or less of real time; a wall time inside a spring-forward gap resolves to the first instant after it - the same helper as
hours.py).

Two pure functions, no SQL and no clock:
  working_minutes_between(a, b, cal) - working minutes inside [a, b)
  add_working_time(start, minutes, cal) - the EARLIEST instant t with working_minutes_between(start, t) >= minutes. Counting starts at
  `start` when it is inside working time, else at the next opening. A due that completes exactly at the end of a window is that end.
With the default (disabled) calendar both are plain wall-clock arithmetic.

Wired ONLY into the "waiting too long" computations (stuck.evaluate / stuck.plan, sla.compute) - see docs/changes/SLACAL.md. Not touched:
the vendor send window (hours.py), ETAs (absolute instants), the automatic close of a `done` ticket (days), RFQ reminders, retention."""
from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass
from typing import Any
from zoneinfo import ZoneInfo

from .hours import _local_instant

UTC = dt.timezone.utc
DEFAULT_ZONE = "Asia/Jerusalem"
DEFAULT_WEEKDAYS = (6, 0, 1, 2, 3)
HOLIDAYS_MAX = 400
OVERRIDES_MAX = 200
_HHMM = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")
_DEPT_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$")
_LIMIT_DAYS = 3700  # a search for working time never walks further than ~10 years; beyond it the wall clock is used (fail safe)


@dataclass(frozen=True)
class Calendar:
    enabled: bool = False
    zone: str = DEFAULT_ZONE
    weekdays: frozenset[int] = frozenset(DEFAULT_WEEKDAYS)
    start: dt.time = dt.time(8, 0)
    end: dt.time = dt.time(17, 0)  # exclusive
    holidays: frozenset[dt.date] = frozenset()

    @property
    def is_24x7(self) -> bool:
        return not self.enabled or not self.weekdays or self.start >= self.end

    @property
    def tz(self) -> ZoneInfo:
        try:
            return ZoneInfo(self.zone or DEFAULT_ZONE)
        except Exception:  # noqa: BLE001 - an unknown zone name falls back to the product default
            return ZoneInfo(DEFAULT_ZONE)


WALL_CLOCK = Calendar(enabled=False)


def _utc(t: dt.datetime) -> dt.datetime:
    return (t if t.tzinfo else t.replace(tzinfo=UTC)).astimezone(UTC)


def _windows(cal: Calendar, first: dt.date, last: dt.date):
    """The working windows (start, end) as UTC instants for the local dates first..last, in order."""
    tz = cal.tz
    day = first
    one = dt.timedelta(days=1)
    while day <= last:
        if day.weekday() in cal.weekdays and day not in cal.holidays:
            s, e = _local_instant(day, cal.start, tz), _local_instant(day, cal.end, tz)
            if e > s:
                yield s, e
        day += one


def working_minutes_between(a: dt.datetime, b: dt.datetime, cal: Calendar | None) -> float:
    """Working minutes in [a, b). 0 when b <= a. Wall-clock minutes for a disabled calendar."""
    a, b = _utc(a), _utc(b)
    if b <= a:
        return 0.0
    if cal is None or cal.is_24x7:
        return (b - a).total_seconds() / 60.0
    tz = cal.tz
    total = 0.0
    for s, e in _windows(cal, a.astimezone(tz).date(), b.astimezone(tz).date()):
        lo, hi = max(s, a), min(e, b)
        if hi > lo:
            total += (hi - lo).total_seconds()
    return total / 60.0


def add_working_time(start: dt.datetime, minutes: float, cal: Calendar | None) -> dt.datetime:
    """The earliest instant by which `minutes` of working time have passed since `start` (see the module doc)."""
    start = _utc(start)
    delta = dt.timedelta(minutes=minutes)
    if minutes <= 0:
        return start
    if cal is None or cal.is_24x7:
        return start + delta
    remaining = delta
    tz = cal.tz
    first = start.astimezone(tz).date()
    for s, e in _windows(cal, first, first + dt.timedelta(days=_LIMIT_DAYS)):
        if e <= start:
            continue
        begin = max(s, start)
        room = e - begin
        if room >= remaining:
            return begin + remaining
        remaining -= room
    return start + delta  # no working time within ten years (every day a holiday): never block a timer forever


# ---------------------------------------------------------------- the stored document (tickets.settings > calendar)

DEFAULT_DOC: dict[str, Any] = {"enabled": False, "weekdays": list(DEFAULT_WEEKDAYS), "start": "08:00", "end": "17:00", "holidays": [],
                               "departments": {}}


def _weekdays(v: Any) -> list[int]:
    if not isinstance(v, list) or not v or len(v) > 7 or not all(isinstance(x, int) and not isinstance(x, bool) and 0 <= x <= 6 for x in v):
        raise ValueError("weekdays")
    if len(set(v)) != len(v):
        raise ValueError("weekdays")
    return sorted(v)


def _hhmm_pair(start: Any, end: Any) -> tuple[str, str]:
    if not isinstance(start, str) or not isinstance(end, str) or not _HHMM.match(start) or not _HHMM.match(end):
        raise ValueError("time")
    if start >= end:
        raise ValueError("order")  # an empty window or one across midnight is refused (like the vendor send hours)
    return start, end


def _holidays(v: Any) -> list[str]:
    if not isinstance(v, list) or len(v) > HOLIDAYS_MAX:
        raise ValueError("holidays")
    out: set[str] = set()
    for x in v:
        if not isinstance(x, str) or len(x) != 10:
            raise ValueError("holidays")
        try:
            out.add(dt.date.fromisoformat(x).isoformat())
        except ValueError:
            raise ValueError("holidays") from None
    return sorted(out)


def validate_doc(v: Any) -> dict[str, Any]:
    """The settings validator (settings_doc.SCHEMA[("calendar",)]): the clean document or ValueError(code). Unknown keys are refused."""
    if not isinstance(v, dict) or not set(v) <= set(DEFAULT_DOC):
        raise ValueError("shape")
    out: dict[str, Any] = {k: (list(x) if isinstance(x, list) else dict(x) if isinstance(x, dict) else x) for k, x in DEFAULT_DOC.items()}
    if "enabled" in v:
        if not isinstance(v["enabled"], bool):
            raise ValueError("boolean")
        out["enabled"] = v["enabled"]
    if "weekdays" in v:
        out["weekdays"] = _weekdays(v["weekdays"])
    if "start" in v or "end" in v:
        out["start"], out["end"] = _hhmm_pair(v.get("start", out["start"]), v.get("end", out["end"]))
    if "holidays" in v:
        out["holidays"] = _holidays(v["holidays"])
    if "departments" in v:
        deps = v["departments"]
        if not isinstance(deps, dict) or len(deps) > OVERRIDES_MAX:
            raise ValueError("departments")
        clean: dict[str, dict[str, Any]] = {}
        for k, o in deps.items():
            if not isinstance(k, str) or not _DEPT_ID.match(k) or not isinstance(o, dict) or not set(o) <= {"enabled", "weekdays", "start", "end"}:
                raise ValueError("departments")
            item: dict[str, Any] = {}
            if "enabled" in o:
                if not isinstance(o["enabled"], bool):
                    raise ValueError("boolean")
                item["enabled"] = o["enabled"]
            if "weekdays" in o:
                item["weekdays"] = _weekdays(o["weekdays"])
            if "start" in o or "end" in o:
                item["start"], item["end"] = _hhmm_pair(o.get("start", out["start"]), o.get("end", out["end"]))
            clean[k] = item
        out["departments"] = clean
    if out["enabled"] and not out["weekdays"]:
        raise ValueError("weekdays")
    return out


def _time(s: str) -> dt.time:
    return dt.time(int(s[:2]), int(s[3:]))


def calendar_from_doc(doc: dict[str, Any] | None, zone: str | None, department_id: str | None = None) -> Calendar:
    """The effective calendar of a department from a (validated) document. A bad / missing document is the 24x7 wall clock."""
    if not isinstance(doc, dict):
        return WALL_CLOCK
    try:
        d = validate_doc(doc)
    except ValueError:
        return WALL_CLOCK
    enabled, weekdays, start, end = d["enabled"], d["weekdays"], d["start"], d["end"]
    over = d["departments"].get(department_id) if department_id else None
    if over:
        enabled = over.get("enabled", enabled)
        weekdays = over.get("weekdays", weekdays)
        start, end = over.get("start", start), over.get("end", end)
        if "enabled" not in over and not d["enabled"]:
            enabled = False  # an override of the hours never switches the calendar on by itself
    if not enabled:
        return WALL_CLOCK
    return Calendar(True, zone or DEFAULT_ZONE, frozenset(weekdays), _time(start), _time(end), frozenset(dt.date.fromisoformat(x) for x in d["holidays"]))


def load(conn, department_id: str | None = None) -> Calendar:
    """The calendar in force for a department now (inside a caller's connection). Never raises: a problem reads as 24x7."""
    try:
        from ...db import get_setting
        from . import settings_doc

        raw = settings_doc._stored(conn).get("calendar")
        if not raw:
            return WALL_CLOCK
        return calendar_from_doc(raw, get_setting(conn, "time.zone", None), department_id)
    except Exception:  # noqa: BLE001 - a calendar problem never stops the monitor
        return WALL_CLOCK
