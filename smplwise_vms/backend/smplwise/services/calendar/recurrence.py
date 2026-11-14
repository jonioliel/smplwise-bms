"""CALENDARS-298 section 4 - recurrence: a small in-repo RFC 5545 subset expander (no new dependency).

Supported: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, INTERVAL 1..52, BYDAY (weekly: a list of days; monthly / yearly: one ordinal day such as
2TU or -1FR), BYMONTHDAY (1..31 or -1), BYMONTH, COUNT 1..500 or UNTIL (a date, inclusive), open series expanded to the caller's window.
Anything else raises RuleError("rrule_unsupported"). Occurrences are generated in LOCAL wall-clock time and converted per occurrence with
the tickets module's `_local_instant` (a gap resolves to the first instant after it, a repeated hour to the first instant), so a Tuesday
18:00 class stays 18:00 across DST. EXDATE and holiday skips do not reduce COUNT (RFC behaviour). Pure: no database, no clock."""
from __future__ import annotations

import calendar as _cal
import datetime as dt
import re
from dataclasses import dataclass, field
from typing import Iterable
from zoneinfo import ZoneInfo

from ..tickets.hours import _local_instant

UTC = dt.timezone.utc
MAX_OCCURRENCES = 2000
LOCAL_FMT = "%Y-%m-%dT%H:%M"
_DAYS = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}
_BYDAY = re.compile(r"^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$")


class RuleError(ValueError):
    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


@dataclass(frozen=True)
class Rule:
    freq: str
    interval: int = 1
    byday: tuple[tuple[int, int], ...] = ()  # (ordinal or 0, weekday 0=Monday)
    bymonthday: tuple[int, ...] = ()
    bymonth: tuple[int, ...] = ()
    count: int | None = None
    until: dt.date | None = None


@dataclass(frozen=True)
class Occ:
    local_start: dt.datetime  # naive wall clock
    local_end: dt.datetime
    start_utc: dt.datetime
    end_utc: dt.datetime

    @property
    def key(self) -> str:
        return self.local_start.strftime(LOCAL_FMT)


def parse_rule(text: str) -> Rule:
    """Parses `FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20271231`. A leading `RRULE:` is tolerated."""
    raw = (text or "").strip()
    if raw.upper().startswith("RRULE:"):
        raw = raw[6:]
    if not raw or len(raw) > 300:
        raise RuleError("rrule_unsupported", "empty or too long")
    parts: dict[str, str] = {}
    for item in raw.split(";"):
        key, sep, val = item.partition("=")
        key = key.strip().upper()
        if not sep or not key or key in parts:
            raise RuleError("rrule_unsupported", "malformed")
        parts[key] = val.strip().upper()
    allowed = {"FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYMONTH", "COUNT", "UNTIL"}
    if set(parts) - allowed or parts.get("FREQ") not in ("DAILY", "WEEKLY", "MONTHLY", "YEARLY"):
        raise RuleError("rrule_unsupported", "unsupported part")
    if "COUNT" in parts and "UNTIL" in parts:
        raise RuleError("rrule_unsupported", "COUNT and UNTIL together")
    freq = parts["FREQ"]
    try:
        interval = int(parts.get("INTERVAL", "1"))
        count = int(parts["COUNT"]) if "COUNT" in parts else None
    except ValueError:
        raise RuleError("rrule_unsupported", "number") from None
    if not 1 <= interval <= 52 or (count is not None and not 1 <= count <= 500):
        raise RuleError("rrule_unsupported", "range")
    until = None
    if "UNTIL" in parts:
        m = re.fullmatch(r"(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?", parts["UNTIL"])
        if not m:
            raise RuleError("rrule_unsupported", "UNTIL")
        try:
            until = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            raise RuleError("rrule_unsupported", "UNTIL") from None
    byday: list[tuple[int, int]] = []
    if "BYDAY" in parts:
        for tok in parts["BYDAY"].split(","):
            m = _BYDAY.match(tok)
            if not m:
                raise RuleError("rrule_unsupported", "BYDAY")
            o = int(m.group(1)) if m.group(1) else 0
            if o and (freq not in ("MONTHLY", "YEARLY") or not (1 <= abs(o) <= 5)):
                raise RuleError("rrule_unsupported", "BYDAY ordinal")
            byday.append((o, _DAYS[m.group(2)]))
        if freq in ("MONTHLY", "YEARLY") and (len(byday) != 1 or not byday[0][0]):
            raise RuleError("rrule_unsupported", "monthly BYDAY needs one ordinal day")
        if freq == "DAILY":
            raise RuleError("rrule_unsupported", "DAILY BYDAY")
    bymd: list[int] = []
    if "BYMONTHDAY" in parts:
        if freq in ("DAILY", "WEEKLY") or byday and freq != "WEEKLY":
            raise RuleError("rrule_unsupported", "BYMONTHDAY")
        for tok in parts["BYMONTHDAY"].split(","):
            if not re.fullmatch(r"-?\d{1,2}", tok) or int(tok) == 0 or not (1 <= int(tok) <= 31 or int(tok) == -1):
                raise RuleError("rrule_unsupported", "BYMONTHDAY")
            bymd.append(int(tok))
    bym: list[int] = []
    if "BYMONTH" in parts:
        if freq != "YEARLY":
            raise RuleError("rrule_unsupported", "BYMONTH")
        for tok in parts["BYMONTH"].split(","):
            if not re.fullmatch(r"\d{1,2}", tok) or not 1 <= int(tok) <= 12:
                raise RuleError("rrule_unsupported", "BYMONTH")
            bym.append(int(tok))
    return Rule(freq, interval, tuple(byday), tuple(bymd), tuple(bym), count, until)


def _nth_weekday(year: int, month: int, ordinal: int, weekday: int) -> dt.date | None:
    days = [d for d in range(1, _cal.monthrange(year, month)[1] + 1) if dt.date(year, month, d).weekday() == weekday]
    try:
        return dt.date(year, month, days[ordinal - 1] if ordinal > 0 else days[ordinal])
    except IndexError:
        return None


def _matches(rule: Rule, anchor: dt.date, day: dt.date) -> bool:
    if day < anchor:
        return False
    f, n = rule.freq, rule.interval
    if f == "DAILY":
        return (day - anchor).days % n == 0
    if f == "WEEKLY":
        wk = (day - dt.timedelta(days=day.weekday())) - (anchor - dt.timedelta(days=anchor.weekday()))
        if (wk.days // 7) % n:
            return False
        return day.weekday() in ({w for _, w in rule.byday} or {anchor.weekday()})
    months = (day.year - anchor.year) * 12 + day.month - anchor.month
    if f == "MONTHLY":
        if months % n:
            return False
    else:  # YEARLY
        if (day.year - anchor.year) % n or day.month not in (rule.bymonth or (anchor.month,)):
            return False
    if rule.byday:
        o, w = rule.byday[0]
        return _nth_weekday(day.year, day.month, o, w) == day
    last = _cal.monthrange(day.year, day.month)[1]
    for md in rule.bymonthday or (anchor.day,):
        if (last if md == -1 else md) == day.day:
            return True
    return False


def expand(rule: Rule | None, local_start: dt.datetime, local_end: dt.datetime, tz: str | ZoneInfo, *, window_start: dt.datetime,
           window_end: dt.datetime, exdates: Iterable[str] = (), holidays: Iterable[dt.date] | None = None, max_occ: int = MAX_OCCURRENCES) -> list[Occ]:
    """Occurrences whose UTC span intersects [window_start, window_end). `rule=None` is a single entry. Raises RuleError("series_too_large")."""
    zone = tz if isinstance(tz, ZoneInfo) else ZoneInfo(tz)
    delta = local_end - local_start
    skip = set(exdates)
    hol = set(holidays) if holidays is not None else None
    t0 = local_start.time()
    out: list[Occ] = []

    def build(day: dt.date) -> Occ:
        ls = dt.datetime.combine(day, t0)
        le = ls + delta
        return Occ(ls, le, _local_instant(ls.date(), ls.time(), zone), _local_instant(le.date(), le.time(), zone))

    def keep(o: Occ) -> bool:
        return o.end_utc > window_start and o.start_utc < window_end

    if rule is None:
        o = build(local_start.date())
        return [o] if keep(o) else []
    anchor = local_start.date()
    last_day = (window_end.astimezone(zone).date() + dt.timedelta(days=2))
    if rule.until is not None:
        last_day = min(last_day, rule.until)
    produced = 0
    day = anchor
    while day <= last_day:
        if _matches(rule, anchor, day):
            produced += 1
            o = build(day)
            if o.key not in skip and not (hol is not None and day in hol) and keep(o):
                out.append(o)
                if len(out) > max_occ:
                    raise RuleError("series_too_large")
            if rule.count is not None and produced >= rule.count:
                break
        day += dt.timedelta(days=1)
    return out


def series_end(rule: Rule | None, local_start: dt.datetime, local_end: dt.datetime, tz: str | ZoneInfo, horizon_days: int) -> dt.datetime | None:
    """UTC end of the last occurrence of a closed series (COUNT or UNTIL); None for an open series (indexed by the horizon instead)."""
    if rule is None:
        zone = tz if isinstance(tz, ZoneInfo) else ZoneInfo(tz)
        return _local_instant(local_end.date(), local_end.time(), zone)
    if rule.count is None and rule.until is None:
        return None
    zone = tz if isinstance(tz, ZoneInfo) else ZoneInfo(tz)
    far = dt.datetime.combine(local_start.date(), dt.time(0)).replace(tzinfo=UTC) + dt.timedelta(days=366 * 60)
    occs = expand(rule, local_start, local_end, zone, window_start=dt.datetime(1970, 1, 1, tzinfo=UTC), window_end=far, max_occ=100000)
    return occs[-1].end_utc if occs else _local_instant(local_end.date(), local_end.time(), zone)
