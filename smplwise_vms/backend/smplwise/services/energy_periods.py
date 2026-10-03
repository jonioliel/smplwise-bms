"""CR-023 P2 section 9: billing periods.

A period is [start, end) in LOCAL dates of the account's IANA zone (end exclusive); it is shown as "from start to end - 1
day". Regular periods follow the account's cycle: every `period_months` months, starting on `anchor_day` (1-31; a day the
month does not have is clamped to its last day - 31 -> 28/29 February -> 31 March, never drifting) in the months of the
cycle (`anchor_month` opens a 2-month cycle). The first period starts at `first_period_start` and ends at the next cycle
boundary (a partial first period). Local dates convert to UTC per date with zoneinfo, so DST days are 23 or 25 hours and
nothing is shifted by a fixed offset."""
from __future__ import annotations

import calendar
import datetime as dt
from dataclasses import dataclass
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

MAX_PERIOD_DAYS = 366


@dataclass(frozen=True)
class Period:
    start: dt.date  # inclusive
    end: dt.date  # exclusive

    @property
    def last_day(self) -> dt.date:
        return self.end - dt.timedelta(days=1)

    @property
    def days(self) -> int:
        return (self.end - self.start).days

    def as_api(self) -> dict[str, str]:
        return {"from": self.start.isoformat(), "to": self.last_day.isoformat()}


@dataclass(frozen=True)
class Cycle:
    months: int  # 1 | 2
    anchor_day: int  # 1-31
    anchor_month: int  # 1-12 (2-month cycles)
    first_start: dt.date


def zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        raise ValueError(f"unknown time zone: {name!r}") from None


def valid_zone(name: str) -> bool:
    try:
        zone(name)
        return True
    except ValueError:
        return False


def local_midnight_utc(day: dt.date, tz: str) -> dt.datetime:
    """The UTC instant of local 00:00 of `day` in zone `tz` (a midnight that does not exist is resolved by zoneinfo's fold
    rule - forward to the first valid instant)."""
    z = zone(tz)
    local = dt.datetime(day.year, day.month, day.day, tzinfo=z)
    # round trip through UTC normalises a non-existent local time to a real instant
    return local.astimezone(dt.timezone.utc)


def utc_window(p: Period, tz: str) -> tuple[dt.datetime, dt.datetime]:
    return local_midnight_utc(p.start, tz), local_midnight_utc(p.end, tz)


def local_date(at: dt.datetime, tz: str) -> dt.date:
    return at.astimezone(zone(tz)).date()


def _clamped(year: int, month: int, day: int) -> dt.date:
    return dt.date(year, month, min(day, calendar.monthrange(year, month)[1]))


def _add_months(year: int, month: int, k: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + k
    return idx // 12, idx % 12 + 1


def boundary_on_or_after(c: Cycle, day: dt.date) -> dt.date:
    """The first cycle boundary >= day."""
    # walk months from a little before `day`; cycle months are those congruent to anchor_month modulo `months`
    y, m = _add_months(day.year, day.month, -2)
    for _ in range(40):
        if (m - c.anchor_month) % c.months == 0:
            b = _clamped(y, m, c.anchor_day)
            if b >= day:
                return b
        y, m = _add_months(y, m, 1)
    raise RuntimeError("no cycle boundary found")  # pragma: no cover - 40 months always contain one


def boundary_after(c: Cycle, day: dt.date) -> dt.date:
    return boundary_on_or_after(c, day + dt.timedelta(days=1))


def period_containing(c: Cycle, day: dt.date) -> Period | None:
    """The regular period that contains `day` (None before the first period)."""
    if day < c.first_start:
        return None
    end = boundary_after(c, day)
    # start = the latest boundary <= day, but never before first_start
    start = _prev_boundary(c, end)
    if start < c.first_start:
        start = c.first_start
    return Period(start, end)


def _prev_boundary(c: Cycle, b: dt.date) -> dt.date:
    """The cycle boundary before boundary `b`."""
    y, m = _add_months(b.year, b.month, -c.months)
    return _clamped(y, m, c.anchor_day)


def regular_periods(c: Cycle, until: dt.date) -> list[Period]:
    """Every regular period that ENDS on or before `until` (i.e. is over by local midnight of `until`), oldest first."""
    out: list[Period] = []
    start = c.first_start
    for _ in range(10_000):
        end = boundary_after(c, start)
        if end > until:
            break
        out.append(Period(start, end))
        start = end
    return out


def periods_between(c: Cycle, start_from: dt.date, count_past: int, count_future: int, today: dt.date) -> list[Period]:
    """`count_past` ended periods before `today` and `count_future` periods from the current one on (for the account page)."""
    ended = regular_periods(c, today)
    past = ended[-count_past:] if count_past else []
    fut: list[Period] = []
    cur = period_containing(c, max(today, c.first_start))
    while cur is not None and len(fut) < count_future:
        if cur.end > today:
            fut.append(cur)
        cur = Period(cur.end, boundary_after(c, cur.end))
    return past + fut


def previous_like(p: Period, c: Cycle | None, count: int) -> list[Period]:
    """Up to `count` periods before `p` of the same cycle (oldest first): the regular cycle when given, else periods of the
    same length in days laid back to back."""
    out: list[Period] = []
    end = _prev_boundary(c, boundary_after(c, p.start)) if c is not None else p.start  # the latest boundary <= p.start
    for _ in range(count):
        start = _prev_boundary(c, end) if c is not None else end - dt.timedelta(days=p.days)
        out.append(Period(start, end))
        end = start
    return list(reversed(out))


def same_period_last_year(p: Period) -> Period:
    def back(d: dt.date) -> dt.date:
        return _clamped(d.year - 1, d.month, d.day if not (d.month == 2 and d.day == 29) else 28)

    # an end on the 1st stays on the 1st; a Feb 29 start becomes Feb 28
    return Period(back(p.start), back(p.end))


def validate_adhoc(start: dt.date, end_exclusive: dt.date) -> None:
    if end_exclusive <= start:
        raise ValueError("period_end_before_start")
    if (end_exclusive - start).days > MAX_PERIOD_DAYS:
        raise ValueError("period_too_long")
