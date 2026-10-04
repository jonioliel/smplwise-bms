"""Device wall clock <-> UTC for Provision-ISR recorders (CR-025 P3).

A Provision-ISR device writes every time (`SearchByTime` results, playback `date=` / `time=`, `GetSnapshotByTime`) as its
own local wall clock WITHOUT an offset, and reports the rule that produces that wall clock as a POSIX TZ string in
`GetDateAndTime` (the owner's NVR, 2026-10-04: `IST-2IDT,M3.5.5/2,M10.5.0/2`, NTP-synchronized).

Why the device's own rule and not only the recorder's IANA zone: the device turns NTP time into wall-clock digits with ITS
rule. Israel's law moves the clock on the Friday before the last Sunday of March; `M3.5.5` is the last Friday of March.
The two differ in every year whose last Sunday of March falls on the 25th or 26th (2023, 2028, 2029, 2034, 2035): for that week
the recordings carry digits one hour off the IANA zone. Converting with the rule that produced the digits is exact; the IANA
zone stays the fallback (no rule read, unparsable rule, `nvr_extra.time_basis = "iana"`) and `divergence()` lists the
periods where the two disagree, for the health screen. AGENTS rule kept: no fixed +2 / +3; the raw strings are kept next
to every converted value.

DST edges (both directions tested in `tests/test_provision_time.py`):
- spring forward: a wall time inside the gap does not exist; it is read as the instant the device would mean (PEP 495
  fold=0 = the offset before the change, i.e. shifted forward like the Hikvision TimeAdapter does);
- fall back: a wall time inside the repeated hour is ambiguous; `resolve_sections` decides per segment from the device's
  own end time (v2 `endtime`) when present, else from the order of the list (a later segment never starts before an
  earlier one ended), else the earlier instant. Every segment decided by a guess is flagged `ambiguous`.

Pure: no I/O, no settings, no device calls."""
from __future__ import annotations

import datetime as dt
import re
from collections.abc import Iterable
from dataclasses import dataclass
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = dt.timezone.utc
ZERO = dt.timedelta(0)
HOUR = dt.timedelta(hours=1)
WALL_FORMAT = "%Y-%m-%d %H:%M:%S"

_NAME = r"(?:<[A-Za-z0-9+\-]+>|[A-Za-z]{3,})"
_OFFSET = r"[+-]?\d{1,3}(?::\d{1,2}(?::\d{1,2})?)?"
_RULE = r"(?:M\d{1,2}\.\d\.\d|J\d{1,3}|\d{1,3})(?:/[+-]?\d{1,3}(?::\d{1,2}(?::\d{1,2})?)?)?"
_POSIX = re.compile(rf"^({_NAME})({_OFFSET})(?:({_NAME})({_OFFSET})?(?:,({_RULE}),({_RULE}))?)?$")
_WALL = re.compile(r"^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*$")
_DATE = re.compile(r"^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$")


def _hms(text: str) -> dt.timedelta:
    sign = -1 if text.startswith("-") else 1
    parts = [int(p) for p in text.lstrip("+-").split(":")]
    parts += [0] * (3 - len(parts))
    return sign * dt.timedelta(hours=parts[0], minutes=parts[1], seconds=parts[2])


@dataclass(frozen=True)
class _Rule:
    kind: str  # "M" | "J" | "N"
    month: int = 0
    week: int = 0
    weekday: int = 0  # POSIX: 0 = Sunday
    day: int = 0
    at: dt.timedelta = dt.timedelta(hours=2)

    @classmethod
    def parse(cls, text: str) -> "_Rule":
        date, _, at = text.partition("/")
        when = _hms(at) if at else dt.timedelta(hours=2)
        if date.startswith("M"):
            m, w, d = (int(x) for x in date[1:].split("."))
            if not (1 <= m <= 12 and 1 <= w <= 5 and 0 <= d <= 6):
                raise ValueError("rule out of range")
            return cls("M", month=m, week=w, weekday=d, at=when)
        if date.startswith("J"):
            n = int(date[1:])
            if not 1 <= n <= 365:
                raise ValueError("rule out of range")
            return cls("J", day=n, at=when)
        n = int(date)
        if not 0 <= n <= 365:
            raise ValueError("rule out of range")
        return cls("N", day=n, at=when)

    def local(self, year: int) -> dt.datetime:
        """The transition moment of `year` as a naive wall-clock datetime in the time that is in force BEFORE it."""
        if self.kind == "M":
            first = dt.date(year, self.month, 1)
            # Python weekday: Monday 0 .. Sunday 6; POSIX: Sunday 0 .. Saturday 6
            offset = (self.weekday - (first.isoweekday() % 7)) % 7
            day = first + dt.timedelta(days=offset + 7 * (self.week - 1))
            if self.week == 5:
                while day.month != self.month:
                    day -= dt.timedelta(days=7)
            base = dt.datetime.combine(day, dt.time())
        elif self.kind == "J":  # 1..365, February 29 is never counted
            base = dt.datetime(year, 1, 1) + dt.timedelta(days=self.day - 1)
            if _leap(year) and self.day >= 60:
                base += dt.timedelta(days=1)
        else:  # 0..365, February 29 counted
            base = dt.datetime(year, 1, 1) + dt.timedelta(days=self.day)
        return base + self.at


def _leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


class PosixTz(dt.tzinfo):
    """A POSIX TZ rule (`IST-2IDT,M3.5.5/2,M10.5.0/2`) as a PEP 495 tzinfo. POSIX offsets are west-positive: `IST-2` is
    UTC+2. Without a DST part the zone is fixed; a DST part without rules is refused (the transition dates are unknown)."""

    def __init__(self, spec: str) -> None:
        m = _POSIX.match((spec or "").strip())
        if not m:
            raise ValueError("not a POSIX TZ string")
        std_name, std_off, dst_name, dst_off, start, end = m.groups()
        self.spec = spec.strip()
        self.std_name = std_name.strip("<>")
        self.std_offset = -_hms(std_off)
        self.dst_name = dst_name.strip("<>") if dst_name else None
        if self.dst_name and not start:
            raise ValueError("DST without transition rules")
        self.dst_offset = (-_hms(dst_off) if dst_off else self.std_offset + HOUR) if self.dst_name else self.std_offset
        self.start = _Rule.parse(start) if start else None
        self.end = _Rule.parse(end) if end else None
        if abs(self.std_offset) > dt.timedelta(hours=24) or abs(self.dst_offset) > dt.timedelta(hours=24):
            raise ValueError("offset out of range")

    def __repr__(self) -> str:
        return f"PosixTz({self.spec!r})"

    @property
    def has_dst(self) -> bool:
        return self.start is not None and self.dst_offset != self.std_offset

    def transitions(self, year: int) -> tuple[dt.datetime, dt.datetime] | None:
        """(DST start, DST end) of `year` as naive wall times: the start in standard time, the end in daylight time."""
        if not self.has_dst:
            return None
        assert self.start is not None and self.end is not None
        return self.start.local(year), self.end.local(year)

    def _in_dst(self, naive: dt.datetime, fold: int) -> bool:
        t = self.transitions(naive.year)
        if t is None:
            return False
        start, end = t
        delta = self.dst_offset - self.std_offset
        if delta > ZERO:
            gap = (start, start + delta)  # wall times that never happen
            rep = (end - delta, end)  # wall times that happen twice
        else:  # negative DST (rare): the roles of start and end swap
            gap = (end, end - delta)
            rep = (start + delta, start)
        if gap[0] <= naive < gap[1]:
            return fold == 1 if delta > ZERO else fold == 0
        if rep[0] <= naive < rep[1]:
            return fold == 0 if delta > ZERO else fold == 1
        if start < end:  # northern hemisphere
            return start <= naive < end
        return not (end <= naive < start)  # southern hemisphere: DST across the new year

    def utcoffset(self, value: dt.datetime | None) -> dt.timedelta:
        if value is None:
            return self.std_offset
        return self.dst_offset if self._in_dst(value.replace(tzinfo=None), value.fold) else self.std_offset

    def dst(self, value: dt.datetime | None) -> dt.timedelta:  # type: ignore[override]
        return self.utcoffset(value) - self.std_offset if value is not None else ZERO

    def tzname(self, value: dt.datetime | None) -> str:
        return (self.dst_name or self.std_name) if value is not None and self.utcoffset(value) != self.std_offset else self.std_name

    def fromutc(self, value: dt.datetime) -> dt.datetime:
        naive = value.replace(tzinfo=None)
        t = self.transitions(naive.year)
        if t is None:
            return (naive + self.std_offset).replace(tzinfo=self)
        start, end = t
        start_utc = start - self.std_offset
        end_utc = end - self.dst_offset
        if start_utc < end_utc:
            in_dst = start_utc <= naive < end_utc
        else:
            in_dst = not (end_utc <= naive < start_utc)
        local = naive + (self.dst_offset if in_dst else self.std_offset)
        fold = 0
        delta = self.dst_offset - self.std_offset
        if not in_dst and delta > ZERO and end_utc <= naive < end_utc + delta:
            fold = 1  # the second pass through the repeated hour
        return local.replace(tzinfo=self, fold=fold)


def iana(name: str | None, default: str = "Asia/Jerusalem") -> ZoneInfo:
    try:
        return ZoneInfo(name or default)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(default)


def device_zone(timezone_spec: str | None, daylight_switch: bool | None, fallback: str | None) -> tuple[dt.tzinfo, str]:
    """The zone the device's wall clock follows: (tzinfo, source) where source is `device` (its POSIX rule), `device_std`
    (the rule with DST switched off on the device) or `iana` (rule missing or unreadable)."""
    if timezone_spec:
        try:
            tz = PosixTz(timezone_spec)
        except ValueError:
            return iana(fallback), "iana"
        if daylight_switch is False and tz.has_dst:
            return dt.timezone(tz.std_offset, tz.std_name), "device_std"
        return tz, "device"
    return iana(fallback), "iana"


# ------------------------------------------------------------------------------------------------ conversions

def parse_wall(raw: str) -> dt.datetime:
    """A device wall-clock string (`2026-10-04 20:17:42`; the live NVR also writes dates without zero padding, e.g.
    `2026-9-19`) as a naive datetime. ValueError for anything else."""
    m = _WALL.match(raw or "")
    if not m:
        raise ValueError("not a device time")
    y, mo, d, h, mi, s = (int(x) if x is not None else 0 for x in m.groups())
    return dt.datetime(y, mo, d, h, mi, s)


def parse_date(raw: str) -> dt.date:
    m = _DATE.match(raw or "")
    if not m:
        raise ValueError("not a device date")
    return dt.date(*(int(x) for x in m.groups()))


def format_wall(value: dt.datetime) -> str:
    return value.strftime(WALL_FORMAT)


def wall_to_utc(raw: str | dt.datetime, tz: dt.tzinfo, fold: int = 0) -> dt.datetime:
    naive = parse_wall(raw) if isinstance(raw, str) else raw.replace(tzinfo=None)
    return naive.replace(tzinfo=tz, fold=fold).astimezone(UTC)


def utc_to_wall(value: dt.datetime, tz: dt.tzinfo) -> dt.datetime:
    """UTC instant -> naive device wall clock (seconds precision)."""
    if value.tzinfo is None:
        raise ValueError("naive instant")
    return value.astimezone(tz).replace(tzinfo=None, microsecond=0, fold=0)


def is_ambiguous(naive: dt.datetime, tz: dt.tzinfo) -> bool:
    return wall_to_utc(naive, tz, 0) != wall_to_utc(naive, tz, 1) and _roundtrips(naive, tz, 0) and _roundtrips(naive, tz, 1)


def is_missing(naive: dt.datetime, tz: dt.tzinfo) -> bool:
    return not _roundtrips(naive, tz, 0) and not _roundtrips(naive, tz, 1)


def _roundtrips(naive: dt.datetime, tz: dt.tzinfo, fold: int) -> bool:
    return utc_to_wall(wall_to_utc(naive, tz, fold), tz) == naive


def near_transition(start: dt.datetime, end: dt.datetime, tz: dt.tzinfo, margin: dt.timedelta = 2 * HOUR) -> bool:
    """True when the UTC offset changes anywhere in [start - margin, end + margin] (sampled every 30 minutes)."""
    t = start - margin
    first = t.astimezone(tz).utcoffset()
    while t <= end + margin:
        if t.astimezone(tz).utcoffset() != first:
            return True
        t += dt.timedelta(minutes=30)
    return (end + margin).astimezone(tz).utcoffset() != first


def wall_window(start: dt.datetime, end: dt.datetime, tz: dt.tzinfo) -> tuple[dt.datetime, dt.datetime, bool]:
    """The device query window for the UTC window [start, end): (wall start, wall end, widened). Near a DST change the
    wall range is widened by the DST step on both sides (the repeated hour maps two UTC ranges onto one wall range, and
    a window across it can even come out inverted); the caller filters the converted results by UTC afterwards."""
    ws, we = utc_to_wall(start, tz), utc_to_wall(end, tz)
    if near_transition(start, end, tz):
        step = HOUR
        if isinstance(tz, PosixTz) and tz.has_dst:
            step = abs(tz.dst_offset - tz.std_offset)
        return min(ws, we) - step, max(ws, we) + step, True
    return ws, we, False


@dataclass(frozen=True)
class Section:
    start_raw: str
    seconds: int
    rec_type: str
    end_raw: str | None = None  # v2 answers carry the device's own end time


@dataclass(frozen=True)
class ResolvedSection:
    section: Section
    start: dt.datetime  # UTC
    end: dt.datetime  # UTC (start + seconds: the duration is real time, not wall time)
    ambiguous: bool  # decided by a guess inside the repeated hour
    shifted: bool  # the start fell inside the spring-forward gap


def resolve_sections(sections: Iterable[Section], tz: dt.tzinfo) -> list[ResolvedSection]:
    """Convert device segments to UTC, deciding the repeated autumn hour per segment (see the module docstring).
    Malformed items (unparsable time, negative duration) are dropped."""
    out: list[ResolvedSection] = []
    last_end: dt.datetime | None = None
    for sec in sections:
        try:
            naive = parse_wall(sec.start_raw)
        except ValueError:
            continue
        if sec.seconds < 0:
            continue
        dur = dt.timedelta(seconds=sec.seconds)
        early, late = wall_to_utc(naive, tz, 0), wall_to_utc(naive, tz, 1)
        ambiguous = False
        shifted = is_missing(naive, tz)
        if early != late and not shifted:  # inside the repeated hour
            choice = None
            if sec.end_raw:
                try:
                    end_naive = parse_wall(sec.end_raw)
                except ValueError:
                    end_naive = None
                if end_naive is not None:
                    fits = [c for c in (early, late) if utc_to_wall(c + dur, tz) == end_naive]
                    if len(fits) == 1:
                        choice = fits[0]
            if choice is None and last_end is not None and early < last_end - dt.timedelta(seconds=2) <= late:
                choice = late  # the earlier reading would start before the previous segment ended
            if choice is None:
                choice, ambiguous = early, True
            start = choice
        else:
            start = early
        end = start + dur
        out.append(ResolvedSection(section=sec, start=start, end=end, ambiguous=ambiguous, shifted=shifted))
        last_end = end if last_end is None or end > last_end else last_end
    return out


def divergence(a: dt.tzinfo, b: dt.tzinfo, year: int) -> list[tuple[dt.datetime, dt.datetime]]:
    """UTC periods of `year` where zones `a` and `b` give different offsets (hourly resolution), e.g. the device rule vs
    the recorder's IANA zone. Empty = the device's wall clock matches the IANA zone all year."""
    out: list[tuple[dt.datetime, dt.datetime]] = []
    t = dt.datetime(year, 1, 1, tzinfo=UTC)
    stop = dt.datetime(year + 1, 1, 1, tzinfo=UTC)
    began: dt.datetime | None = None
    while t < stop:
        differs = t.astimezone(a).utcoffset() != t.astimezone(b).utcoffset()
        if differs and began is None:
            began = t
        elif not differs and began is not None:
            out.append((began, t))
            began = None
        t += HOUR
    if began is not None:
        out.append((began, stop))
    return out
