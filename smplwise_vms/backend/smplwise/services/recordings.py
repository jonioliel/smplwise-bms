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
from typing import Any

from ..config import Settings
from ..errors import ApiError
from . import nvr
from .timeutil import UTC, iso_utc, nvr_span_to_utc, utc_to_nvr_wall, zone
from . import video_text  # noqa: F401 - registers `recordings.*` (FIX-VIDEO2-2570)
from ..i18n import join as _join
from ..i18n import t as _t
from .ttl_cache import TtlCache
from ..test_reset import register_reset

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
    note: str = ""  # FIX-VIDEO2-2570: may be a `Msg` (or a join of them), rendered in the reader's language by the route


# CR-HEALTH-POLLERS (03:F21): the shared TTL cache - bounded at 512 (the oldest quarter goes), one search per key at a time
# and followers reuse the result (T068). The TTL is per read: 30 s for a window that touches now, 600 s for the past.
_cache: TtlCache[tuple[str, str, str, str], SearchResult] = TtlCache(600, maxsize=512)
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
    Returns (matches, coverage, pages) where coverage is complete | partial (page cap reached, or - FIX-VIDEO2-2570 VD2-06 - the
    recorder still said MORE but sent a page it had already sent: the rest of the window was never read).
    CR-024: the search goes to the camera's own recorder."""
    matches, coverage, pages, _reason = list_matches_why(settings, cam, start, end, tz_name)
    return matches, coverage, pages


def list_matches_why(settings: Settings, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str) -> tuple[list[nvr.SearchMatch], str, int, str]:
    """`list_matches` plus why the coverage is partial: "" | "page_cap" | "repeated_page"."""
    from ..recorder_scope import camera_settings

    settings = camera_settings(settings, cam)
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
    reason = ""
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
            if page.status == "MORE" and page.matches and new == 0:
                coverage, reason = "partial", "repeated_page"  # VD2-06: "more" was promised, a page already read came back
                break
            if page.status != "MORE" or not page.matches:
                break
        else:
            coverage, reason = "partial", "page_cap"
    matches.sort(key=lambda m: m.start_raw)
    return matches, coverage, pages, reason


def search_segments(settings: Settings, conn: sqlite3.Connection | None, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str) -> SearchResult:
    """NVR search with an in-memory cache. `conn` is accepted for call-site symmetry but not used: the search is
    network-bound and must never run inside a write transaction (it would hold the SQLite write lock for seconds)."""
    if end <= start:
        raise ApiError(422, "validation", "טווח הזמן ריק.")
    if (end - start) > dt.timedelta(days=7):
        raise ApiError(422, "validation", "טווח חיפוש מקסימלי: 7 ימים.")
    key = (cam["id"], iso_utc(start), iso_utc(end), tz_name)  # CR-024: a recorder's own zone is part of the question
    touches_now = end >= dt.datetime.now(UTC) - dt.timedelta(minutes=1)
    ttl = 30 if touches_now else 600
    hit = _cache.entry(key, ttl)
    if hit:
        return hit[1]
    with _cache.flight(key):
        hit = _cache.entry(key, ttl)
        if hit:
            return hit[1]  # a concurrent identical search already answered
        return _search_uncached(settings, cam, start, end, tz_name, key, ttl)


def _search_uncached(settings: Settings, cam: sqlite3.Row, start: dt.datetime, end: dt.datetime, tz_name: str, key: tuple[str, str, str], ttl: int) -> SearchResult:
    now = time.time()
    from ..recorder_scope import camera_settings
    from .recorders import vendor_io

    rs = camera_settings(settings, cam)
    if vendor_io.handles(rs):  # CR-025 P3: the Provision search (cursor paging, device clock, DST-safe ends)
        result = vendor_io.search(rs, cam["recorder_id"], cam["channel"], start, end, tz_name)
        _cache.put(key, result, at=now)
        return result
    tz = zone(tz_name)
    matches, coverage, pages, reason = list_matches_why(settings, cam, start, end, tz_name)
    segments: list[Segment] = []
    dropped = 0
    ambiguous = False
    for m in matches:
        # FIX-VIDEO2-2570 (VD2-04): the IANA zone with both readings of the hour the autumn change repeats (a file that crosses the
        # change ends on the second occurrence); a file no reading can place is counted, never silently lost
        span = nvr_span_to_utc(m.start_raw, m.end_raw, tz, start, end)
        if span is None:
            dropped += 1
            continue
        s_utc, e_utc, amb = span
        if e_utc <= start or s_utc >= end:
            continue  # outside the window (devices may return boundary files)
        ambiguous = ambiguous or amb
        segments.append(Segment(start_at=iso_utc(max(s_utc, start)), end_at=iso_utc(min(e_utc, end)), kind=_kind(m.record_type), track_id=m.track_id, start_raw=m.start_raw, end_raw=m.end_raw))
    notes: list[Any] = []
    if reason == "page_cap":
        notes.append(f"page cap ({MAX_PAGES} × {PAGE_SIZE}) reached")
    elif reason == "repeated_page":
        notes.append(_t("recordings.repeated_page"))
    if ambiguous:
        notes.append(_t("recordings.repeated_hour"))
    if dropped:
        notes.append(_t("recordings.dropped", n=dropped))
    if ambiguous or dropped:
        coverage = "partial"  # AGENTS: partial coverage is never reported as complete
    note = _join("; ", notes)
    result = SearchResult(segments=merge(segments), coverage=coverage, matches=len(matches), pages=pages, searched_at=iso_utc(dt.datetime.now(UTC)), timezone=tz_name, note=note)
    _cache.put(key, result, at=now)
    return result


def invalidate(camera_id: str | None = None) -> None:
    _cache.discard(lambda k: camera_id is None or k[0] == camera_id)


def as_dict(result: SearchResult) -> dict:
    d = asdict(result)
    d["segments"] = [asdict(s) for s in result.segments]
    return d


register_reset(__name__, ("_cache",), invalidate)  # CR-BE-COMPLEXITY-2450: a shared-class singleton (tests/test_singletons_registered.py)
