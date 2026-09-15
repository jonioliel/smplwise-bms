"""Recording search with coverage status and a small cache (chapter 23, T027).

- Input: camera row, half-open UTC window [start, end).
- The NVR is asked page by page (one search at a time — the device allows one concurrent search) until
  it says there is nothing more or the page cap is reached; the latter is reported as `partial`, never
  as "no recordings".
- Adjacent/overlapping matches of the same kind are merged; each segment keeps the raw device strings.
- Cache per (camera, window): 30 s when the window touches "now", 10 min for the past.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
import threading
import time
from dataclasses import asdict, dataclass

from ..config import Settings
from ..errors import ApiError
from . import nvr
from .timeutil import UTC, iso_utc, nvr_wall_to_utc, utc_to_nvr_wall, zone

PAGE_SIZE = 40
MAX_PAGES = 25  # 1000 matches per window; beyond that the result is marked partial
MERGE_GAP_S = 2  # NVR files abut with a second of slack

KIND_BY_TYPE = {"CMR": "continuous", "MOTION": "motion", "ALARM": "alarm", "ALARMANDMOTION": "alarm", "EDR": "event", "MANUAL": "manual", "COMMAND": "manual", "ALLEVENT": "event"}


@dataclass
class Segment:
    start_at: str  # UTC ISO
    end_at: str
    kind: str  # continuous | motion | alarm | event | manual | unknown
    track_id: int
    start_raw: str
    end_raw: str


@dataclass
class SearchResult:
    segments: list[Segment]
    coverage: str  # complete | partial | unknown
    matches: int
    pages: int
    searched_at: str
    timezone: str
    note: str = ""


_cache: dict[tuple[str, str, str], tuple[float, SearchResult]] = {}
_search_lock = threading.Lock()


def _kind(record_type: str) -> str:
    return KIND_BY_TYPE.get(record_type.upper(), "unknown" if not record_type else "event")


def merge(segments: list[Segment]) -> list[Segment]:
    out: list[Segment] = []
    for seg in sorted(segments, key=lambda s: s.start_at):
        if out:
            last = out[-1]
            gap = (dt.datetime.fromisoformat(seg.start_at.replace("Z", "+00:00")) - dt.datetime.fromisoformat(last.end_at.replace("Z", "+00:00"))).total_seconds()
            if last.kind == seg.kind and gap <= MERGE_GAP_S:
                if seg.end_at > last.end_at:
                    last.end_at = seg.end_at
                    last.end_raw = seg.end_raw
                continue
        out.append(seg)
    return out


def list_matches(settings: Settings, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str) -> tuple[list[nvr.SearchMatch], str, int]:
    """Raw NVR matches (one per recording file) for [start, end): paged, serialized, de-duplicated.
    Returns (matches, coverage, pages) where coverage is complete | partial (page cap reached)."""
    track = cam["main_track"]
    if not track:
        raise ApiError(409, "no_track", "למצלמה אין track הקלטה ידוע; הרץ סנכרון מצלמות.", details={"camera": cam["id"]})
    tz = zone(tz_name)
    start_wall = utc_to_nvr_wall(start, tz)
    end_wall = utc_to_nvr_wall(end, tz)
    matches: list[nvr.SearchMatch] = []
    seen: set[tuple[int, str, str]] = set()
    pages = 0
    coverage = "complete"
    with _search_lock:  # KNOWN_QUIRKS S2: maxConcurrentSearches = 1
        import uuid

        sid = str(uuid.uuid4()).upper()
        while pages < MAX_PAGES:
            page = nvr.search_recordings(settings, int(track), start_wall, end_wall, position=pages * PAGE_SIZE, page_size=PAGE_SIZE, search_id=sid)
            pages += 1
            new = 0
            for m in page.matches:
                k = (m.track_id, m.start_raw, m.end_raw)
                if k in seen or not m.start_raw or not m.end_raw:
                    continue
                seen.add(k)
                new += 1
                matches.append(m)
            if page.status != "MORE" or not page.matches or new == 0:
                break
        else:
            coverage = "partial"
    matches.sort(key=lambda m: m.start_raw)
    return matches, coverage, pages


def search_segments(settings: Settings, conn: sqlite3.Connection | None, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str) -> SearchResult:
    """NVR search with an in-memory cache. `conn` is accepted for call-site symmetry but not used: the search is
    network-bound and must never run inside a write transaction (it would hold the SQLite write lock for seconds)."""
    if end <= start:
        raise ApiError(422, "validation", "טווח הזמן ריק.")
    if (end - start) > dt.timedelta(days=7):
        raise ApiError(422, "validation", "טווח חיפוש מקסימלי: 7 ימים.")
    key = (cam["id"], iso_utc(start), iso_utc(end))
    now = time.time()
    touches_now = end >= dt.datetime.now(UTC) - dt.timedelta(minutes=1)
    ttl = 30 if touches_now else 600
    hit = _cache.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1]

    tz = zone(tz_name)
    matches, coverage, pages = list_matches(settings, cam, start, end, tz_name)
    segments: list[Segment] = []
    for m in matches:
        s_utc = nvr_wall_to_utc(m.start_raw, tz)
        e_utc = nvr_wall_to_utc(m.end_raw, tz)
        if e_utc <= start or s_utc >= end or e_utc <= s_utc:
            continue  # outside the window (devices may return boundary files) or malformed
        segments.append(Segment(start_at=iso_utc(max(s_utc, start)), end_at=iso_utc(min(e_utc, end)), kind=_kind(m.record_type), track_id=m.track_id, start_raw=m.start_raw, end_raw=m.end_raw))
    note = f"page cap ({MAX_PAGES} × {PAGE_SIZE}) reached" if coverage == "partial" else ""
    result = SearchResult(segments=merge(segments), coverage=coverage, matches=len(matches), pages=pages, searched_at=iso_utc(dt.datetime.now(UTC)), timezone=tz_name, note=note)
    _cache[key] = (now, result)
    if len(_cache) > 512:  # bounded
        for old in sorted(_cache, key=lambda k: _cache[k][0])[:128]:
            _cache.pop(old, None)
    return result


def invalidate(camera_id: str | None = None) -> None:
    for k in list(_cache):
        if camera_id is None or k[0] == camera_id:
            _cache.pop(k, None)


def as_dict(result: SearchResult) -> dict:
    d = asdict(result)
    d["segments"] = [asdict(s) for s in result.segments]
    return d
