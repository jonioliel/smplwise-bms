"""Days with recordings in one local month for one camera (RECORDED-DAYS-MONTH-2407; legacy parity: the 1.5.27 add-on's
monthly calendar, REUSE_MATRIX row 6 "wrap").

Sources, in order (each one a read-only device query):
- Provision-ISR: `SearchRecordDate` (every recorded date of the channel), filtered to the month.
- Hikvision: `POST /ISAPI/ContentMgmt/record/tracks/<track>/dailyDistribution` for the month - the device answers per
  day of its own wall-clock month, which is the installation's local month (the NVR clock is kept in that zone, the same
  assumption every Hikvision search here makes).
- Hikvision without dailyDistribution (404 / notSupport / not a day list): derived from the recording search
  (`recordings.search_segments`, at most five windows of up to seven local days each; each window is cached there too).
  A window that hit the page cap makes the month `partial` - never "no recordings".

Months are local months of the IANA zone ([day 1 00:00, next month day 1 00:00) by the zone rules, so a DST month has
743 or 745 hours); days after today are never asked. A cache per (camera, month, zone): 60 s for the month that holds
today, an hour for past months; bounded."""
from __future__ import annotations

import datetime as dt
import sqlite3
import threading
import time
from dataclasses import asdict, dataclass, field

from ..config import Settings
from ..errors import ApiError
from . import nvr, recordings
from .timeutil import UTC, iso_utc, local_day_bounds, zone

WINDOW_DAYS = 7  # recordings.search_segments refuses windows above seven days
TTL_CURRENT_S = 60
TTL_PAST_S = 3600
CACHE_MAX = 256


@dataclass
class MonthDays:
    month: str  # YYYY-MM
    timezone: str
    days: list[str] = field(default_factory=list)  # local dates YYYY-MM-DD with any recording
    source: str = ""  # daily_distribution | segment_search | record_dates | future
    coverage: str = "complete"  # complete | partial
    through: str | None = None  # the last local date that was asked (today in the current month; None for a future month)
    searched_at: str = ""
    note: str = ""


_cache: dict[tuple[str, str, str], tuple[float, MonthDays]] = {}
_inflight: dict[tuple[str, str, str], threading.Lock] = {}
_guard = threading.Lock()


def parse_month(value: str) -> tuple[int, int]:
    try:
        y, m = (int(x) for x in value.split("-"))
    except ValueError as exc:
        raise ApiError(422, "validation", "חודש חייב להיות בתבנית YYYY-MM.") from exc
    if not (2000 <= y <= 2100 and 1 <= m <= 12):
        raise ApiError(422, "validation", "חודש חייב להיות בתבנית YYYY-MM.")
    return y, m


def month_span(year: int, month: int) -> tuple[dt.date, dt.date]:
    """(first day, first day of the next month)."""
    first = dt.date(year, month, 1)
    nxt = dt.date(year + (month == 12), month % 12 + 1, 1)
    return first, nxt


def local_dates_of(start_at: str, end_at: str, tz_name: str) -> set[dt.date]:
    """Every local date a half-open UTC segment [start, end) touches in the zone."""
    tz = zone(tz_name)
    s = dt.datetime.fromisoformat(start_at.replace("Z", "+00:00"))
    e = dt.datetime.fromisoformat(end_at.replace("Z", "+00:00"))
    if e <= s:
        return set()
    first = s.astimezone(tz).date()
    last = (e - dt.timedelta(microseconds=1)).astimezone(tz).date()
    out: set[dt.date] = set()
    d = first
    while d <= last:
        out.add(d)
        d += dt.timedelta(days=1)
    return out


def days_in_month(settings: Settings, cam: sqlite3.Row, month: str, tz_name: str, *, now: dt.datetime | None = None) -> MonthDays:
    """Cached entry point (the route calls this outside any write transaction). `now` is injectable for tests."""
    year, mon = parse_month(month)
    tz = zone(tz_name)
    now = now or dt.datetime.now(UTC)
    today = now.astimezone(tz).date()
    first, nxt = month_span(year, mon)
    key = (str(cam["id"]), f"{year:04d}-{mon:02d}", tz_name)
    ttl = TTL_CURRENT_S if first <= today < nxt else TTL_PAST_S
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    with _guard:
        lock = _inflight.setdefault(key, threading.Lock())
    with lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < ttl:
            return hit[1]  # a concurrent identical request already answered
        result = _uncached(settings, cam, year, mon, tz_name, now)
        _cache[key] = (time.time(), result)
        if len(_cache) > CACHE_MAX:
            for old in sorted(_cache, key=lambda k: _cache[k][0])[: CACHE_MAX // 4]:
                _cache.pop(old, None)
    with _guard:
        _inflight.pop(key, None)
    return result


def _uncached(settings: Settings, cam: sqlite3.Row, year: int, mon: int, tz_name: str, now: dt.datetime) -> MonthDays:
    from ..recorder_scope import camera_settings
    from .recorders import vendor_io

    first, nxt = month_span(year, mon)
    today = now.astimezone(zone(tz_name)).date()
    out = MonthDays(month=f"{year:04d}-{mon:02d}", timezone=tz_name, searched_at=iso_utc(dt.datetime.now(UTC)))
    if first > today:
        out.source = "future"
        return out  # nothing recorded yet: the device is not asked
    through = min(nxt - dt.timedelta(days=1), today)
    out.through = through.isoformat()
    rs = camera_settings(settings, cam)  # CR-024: the camera's own recorder
    if vendor_io.handles(rs):
        dates = vendor_io.record_days(rs, cam["recorder_id"], cam["channel"], tz_name)
        out.days = sorted({d.isoformat() for d in dates if first <= d <= through})
        out.source = "record_dates"
        return out
    track = cam["main_track"]
    if not track:
        raise ApiError(409, "no_track", "למצלמה אין track הקלטה ידוע; הרץ סנכרון מצלמות.", details={"camera": cam["id"]})
    try:
        by_day = nvr.daily_distribution(rs, int(track), year, mon)
    except nvr.DailyDistributionUnsupported as exc:
        by_day = None
        out.note = f"dailyDistribution not offered ({exc}); derived from the recording search"
    if by_day:
        out.days = [dt.date(year, mon, d).isoformat() for d in sorted(by_day) if by_day[d] and d <= through.day]
        out.source = "daily_distribution"
        return out
    if by_day is not None:
        out.note = "dailyDistribution returned no days; derived from the recording search"
    return _from_search(settings, cam, first, through, tz_name, out, now)


def _from_search(settings: Settings, cam: sqlite3.Row, first: dt.date, through: dt.date, tz_name: str, out: MonthDays, now: dt.datetime) -> MonthDays:
    tz = zone(tz_name)
    found: set[dt.date] = set()
    partial = False
    day = first
    while day <= through:
        last = min(day + dt.timedelta(days=WINDOW_DAYS - 1), through)
        start, _ = local_day_bounds(day, tz)
        _, end = local_day_bounds(last, tz)
        if last >= now.astimezone(tz).date():
            end = min(end, max(now, start + dt.timedelta(seconds=1)))  # the window holding today: up to now
        res = recordings.search_segments(settings, None, cam, start, end, tz_name)
        partial = partial or res.coverage != "complete"
        for seg in res.segments:
            found |= {d for d in local_dates_of(seg.start_at, seg.end_at, tz_name) if first <= d <= through}
        day = last + dt.timedelta(days=1)
    out.days = sorted(d.isoformat() for d in found)
    out.source = "segment_search"
    out.coverage = "partial" if partial else "complete"
    if partial:
        out.note = (out.note + "; " if out.note else "") + "a search window reached the page cap: days may be missing"
    return out


def invalidate(camera_id: str | None = None) -> None:
    for k in list(_cache):
        if camera_id is None or k[0] == camera_id:
            _cache.pop(k, None)


def as_dict(result: MonthDays) -> dict:
    return asdict(result)
