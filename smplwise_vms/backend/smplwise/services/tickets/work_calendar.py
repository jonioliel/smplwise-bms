"""SLACAL (2.9.1 / 2.10): working-hours calendars for ticket timing.

Until now every ticket timer (unassigned / ack / stuck / waiting / overdue thresholds, the reminder cadence and the manager alert that
follows it) counted wall-clock minutes (CR-038 D7). This module adds an OPTIONAL installation-level calendar:

    {"enabled": false,                  # default: 24x7 = exactly the old behaviour; nothing changes until an administrator turns it on
     "weekdays": [0, 1, 2, 3, 6],       # ISO-style, Monday = 0 ... Sunday = 6 (default Sunday-Thursday)
     "start": "08:00", "end": "17:00",  # the daily window, local time, start < end (no window across midnight)
     "days": {"4": {"start": "08:00", "end": "13:00"}},  # per-weekday window that replaces the daily one (here: a short Friday)
     "holidays": ["2026-10-21"],        # local dates with no working time at all
     "hold_internal": true,             # an internal reminder / manager alert that falls outside working time waits for the next opening
     "auto_close": "calendar",          # "calendar" (default, as before) | "working": the `done` -> closed wait counts working time
     "link_unopened": "wall",           # "wall" (default: the vendor's clock) | "working": the "vendor link not opened" threshold
     "departments": {"<dept id>": {...}}}  # per-department override (see calendar_from_doc)

The zone is the installation's `time.zone` setting (the same one the vendor send hours use), default Asia/Jerusalem. Internal instants stay
UTC (AGENTS.md); the window of each local day is converted per day, so DST days follow the zone (a window that contains the change simply
has 1 hour more or less of real time; a wall time inside a spring-forward gap resolves to the first instant after it - the same helper as
hours.py).

Pure functions, no SQL and no clock:
  working_minutes_between(a, b, cal) - working minutes inside [a, b)
  add_working_time(start, minutes, cal) - the EARLIEST instant t with working_minutes_between(start, t) >= minutes. Counting starts at
  `start` when it is inside working time, else at the next opening. A due that completes exactly at the end of a window is that end.
  is_working(t, cal) / next_opening(t, cal) - the hold of internal reminders
  auto_close_at(done_at, days, cal) - the automatic-close time
With the default (disabled) calendar all of them are plain wall-clock arithmetic.

Wired ONLY into the "waiting too long" computations - see docs/changes/SLACAL-WORKING-HOURS-CALENDAR.md. Not touched: the vendor send
window (hours.py), ETAs (absolute instants), RFQ timers other than the question reminder, retention."""
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
AUTO_CLOSE_MODES = ("calendar", "working")
LINK_MODES = ("wall", "working")
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
    day_hours: tuple[tuple[int, dt.time, dt.time], ...] = ()  # per-weekday windows that replace start / end
    hold_internal: bool = True
    auto_close: str = "calendar"
    link_unopened: str = "wall"

    @property
    def is_24x7(self) -> bool:
        return not self.enabled or not self.weekdays or self.start >= self.end

    @property
    def tz(self) -> ZoneInfo:
        try:
            return ZoneInfo(self.zone or DEFAULT_ZONE)
        except Exception:  # noqa: BLE001 - an unknown zone name falls back to the product default
            return ZoneInfo(DEFAULT_ZONE)

    def window(self, weekday: int) -> tuple[dt.time, dt.time]:
        for wd, s, e in self.day_hours:
            if wd == weekday:
                return s, e
        return self.start, self.end

    @property
    def day_minutes(self) -> int:
        """The length of the standard daily window in minutes (what one 'day' of an automatic close is worth in working mode)."""
        return (self.end.hour * 60 + self.end.minute) - (self.start.hour * 60 + self.start.minute)

    def counts_link_unopened(self) -> "Calendar | None":
        """The calendar the 'vendor link not opened' threshold uses: None (wall-clock) unless the administrator chose working time."""
        return self if self.link_unopened == "working" else None


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
            ws, we = cal.window(day.weekday())
            s, e = _local_instant(day, ws, tz), _local_instant(day, we, tz)
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
    first = start.astimezone(cal.tz).date()
    for s, e in _windows(cal, first, first + dt.timedelta(days=_LIMIT_DAYS)):
        if e <= start:
            continue
        begin = max(s, start)
        room = e - begin
        if room >= remaining:
            return begin + remaining
        remaining -= room
    return start + delta  # no working time within ten years (every day a holiday): never block a timer forever


def is_working(t: dt.datetime, cal: Calendar | None) -> bool:
    """Whether the instant is inside working time (always true for the wall clock). The end of a window is outside."""
    if cal is None or cal.is_24x7:
        return True
    t = _utc(t)
    day = t.astimezone(cal.tz).date()
    return any(s <= t < e for s, e in _windows(cal, day, day))


def next_opening(t: dt.datetime, cal: Calendar | None) -> dt.datetime:
    """`t` itself when it is inside working time, else the start of the next window."""
    t = _utc(t)
    if cal is None or cal.is_24x7 or is_working(t, cal):
        return t
    day = t.astimezone(cal.tz).date()
    for s, _e in _windows(cal, day, day + dt.timedelta(days=_LIMIT_DAYS)):
        if s > t:
            return s
    return t


def auto_close_at(done_at: dt.datetime, days: int, cal: Calendar | None) -> dt.datetime:
    """When a `done` ticket closes by itself: `days` calendar days after done_at (the default, as before), or - with the calendar on and
    auto_close = "working" - `days` x the standard daily window of working time."""
    done_at = _utc(done_at)
    if cal is None or cal.is_24x7 or cal.auto_close != "working":
        return done_at + dt.timedelta(days=int(days))
    return add_working_time(done_at, int(days) * cal.day_minutes, cal)


# ---------------------------------------------------------------- the stored document (tickets.settings > calendar)

DEFAULT_DOC: dict[str, Any] = {"enabled": False, "weekdays": list(DEFAULT_WEEKDAYS), "start": "08:00", "end": "17:00", "days": {}, "holidays": [],
                               "hold_internal": True, "auto_close": "calendar", "link_unopened": "wall", "departments": {}}
_OVERRIDE_KEYS = {"enabled", "weekdays", "start", "end", "days"}


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


def _days(v: Any) -> dict[str, dict[str, str]]:
    """Per-weekday windows: {"4": {"start": "08:00", "end": "13:00"}} - keys "0".."6", each a valid window."""
    if not isinstance(v, dict) or len(v) > 7:
        raise ValueError("days")
    out: dict[str, dict[str, str]] = {}
    for k, w in v.items():
        key = str(k)
        if key not in {"0", "1", "2", "3", "4", "5", "6"} or not isinstance(w, dict) or set(w) != {"start", "end"}:
            raise ValueError("days")
        s, e = _hhmm_pair(w["start"], w["end"])
        out[key] = {"start": s, "end": e}
    return dict(sorted(out.items()))


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


def _boolean(v: Any) -> bool:
    if not isinstance(v, bool):
        raise ValueError("boolean")
    return v


def _choice(v: Any, allowed: tuple[str, ...]) -> str:
    if v not in allowed:
        raise ValueError("choice")
    return v


def validate_doc(v: Any) -> dict[str, Any]:
    """The settings validator (settings_doc.SCHEMA[("calendar",)]): the clean document or ValueError(code). Unknown keys are refused."""
    if not isinstance(v, dict) or not set(v) <= set(DEFAULT_DOC):
        raise ValueError("shape")
    out: dict[str, Any] = {k: (list(x) if isinstance(x, list) else dict(x) if isinstance(x, dict) else x) for k, x in DEFAULT_DOC.items()}
    if "enabled" in v:
        out["enabled"] = _boolean(v["enabled"])
    if "weekdays" in v:
        out["weekdays"] = _weekdays(v["weekdays"])
    if "start" in v or "end" in v:
        out["start"], out["end"] = _hhmm_pair(v.get("start", out["start"]), v.get("end", out["end"]))
    if "days" in v:
        out["days"] = _days(v["days"])
    if "holidays" in v:
        out["holidays"] = _holidays(v["holidays"])
    if "hold_internal" in v:
        out["hold_internal"] = _boolean(v["hold_internal"])
    if "auto_close" in v:
        out["auto_close"] = _choice(v["auto_close"], AUTO_CLOSE_MODES)
    if "link_unopened" in v:
        out["link_unopened"] = _choice(v["link_unopened"], LINK_MODES)
    if "departments" in v:
        deps = v["departments"]
        if not isinstance(deps, dict) or len(deps) > OVERRIDES_MAX:
            raise ValueError("departments")
        clean: dict[str, dict[str, Any]] = {}
        for k, o in deps.items():
            if not isinstance(k, str) or not _DEPT_ID.match(k) or not isinstance(o, dict) or not set(o) <= _OVERRIDE_KEYS:
                raise ValueError("departments")
            item: dict[str, Any] = {}
            if "enabled" in o:
                item["enabled"] = _boolean(o["enabled"])
            if "weekdays" in o:
                item["weekdays"] = _weekdays(o["weekdays"])
            if "start" in o or "end" in o:
                item["start"], item["end"] = _hhmm_pair(o.get("start", out["start"]), o.get("end", out["end"]))
            if "days" in o:
                item["days"] = _days(o["days"])
            clean[k] = item
        out["departments"] = clean
    if out["enabled"] and not out["weekdays"]:
        raise ValueError("weekdays")
    return out


def _time(s: str) -> dt.time:
    return dt.time(int(s[:2]), int(s[3:]))


def calendar_from_doc(doc: dict[str, Any] | None, zone: str | None, department_id: str | None = None) -> Calendar:
    """The effective calendar of a department from a (validated) document. A bad / missing document is the 24x7 wall clock.

    A department override may set `enabled` (false = this department is 24x7, true = on even when the installation's is off),
    `weekdays`, `start` / `end` and `days`. Weekdays, start and end that it leaves out are inherited. Per-weekday windows are NOT
    inherited: an override that sets any hours carries its own `days` (none = the plain daily window). Holidays, hold_internal,
    auto_close and link_unopened are installation-wide."""
    if not isinstance(doc, dict):
        return WALL_CLOCK
    try:
        d = validate_doc(doc)
    except ValueError:
        return WALL_CLOCK
    enabled, weekdays, start, end, days = d["enabled"], d["weekdays"], d["start"], d["end"], d["days"]
    over = d["departments"].get(department_id) if department_id else None
    if over:
        enabled = over.get("enabled", enabled)
        weekdays = over.get("weekdays", weekdays)
        start, end = over.get("start", start), over.get("end", end)
        if {"weekdays", "start", "end", "days"} & set(over):
            days = over.get("days", {})
        if "enabled" not in over and not d["enabled"]:
            enabled = False  # an override of the hours never switches the calendar on by itself
    if not enabled:
        return WALL_CLOCK
    day_hours = tuple(sorted((int(k), _time(w["start"]), _time(w["end"])) for k, w in days.items()))
    return Calendar(True, zone or DEFAULT_ZONE, frozenset(weekdays), _time(start), _time(end),
                    frozenset(dt.date.fromisoformat(x) for x in d["holidays"]), day_hours, d["hold_internal"], d["auto_close"], d["link_unopened"])


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
