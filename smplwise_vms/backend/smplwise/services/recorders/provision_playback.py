"""Provision-ISR playback, phase P3 of CR-025: recording search, calendar, playback RTSP URLs, snapshot at a time and the
read-only export source (HTTP API v1; v2 only where v1 lacks something - nothing so far).

Everything here is a READ. Commands sent: `GetRecordType`, `SearchRecordDate`, `SearchByTime`, `GetSnapshotByTime`,
`GetDateAndTime` (`PLAYBACK_COMMANDS`, passed to the adapter's allow-list per call; the adapter file is not edited). RTSP
playback (`action=playback`) and export (`action=backup`) only read the device's recordings.

What the owner's NVR really does (NVR8-16400AN, firmware 1.4.7, live read-only checks 2026-10-04,
`private-evidence/provision-isr-live/*-playback/`), where it differs from the vendor guide:
1. `SearchByTime` answers at most **1000** items (`count="1000"`, no `maxCount`), the OLDEST first; a longer window is
   continued from the end of the last item (cursor paging), not by halving.
2. Items carry only `starttime` + `seconds` + `recType` (no `endtime` on v1); the end is start + seconds.
3. Items are **clipped to the query window** (a segment that began 12:48:37 comes back as 12:49:00 / 5 s for a 12:49:00-
   12:49:05 query), so pieces of one recording abut across pages and are merged again.
4. A window without recordings answers **HTTP 400 errorCode 3** (not an empty list); so does `GetSnapshotByTime` in a gap.
5. `SearchRecordDate` writes dates without zero padding (`2026-9-19`).
6. `GetSnapshotByTime` answers `Content-Type: image/h264` with an Annex-B H.264 key frame (not a JPEG); `to_jpeg` decodes it.
7. Playback RTSP: `rtsp://<host>:554/chID=<channel>&date=YYYY-MM-DD&time=HH:MM:SS&timelen=<s>&streamType=main|sub&action=playback`
   with **1-based** channel ids (the guide's example says chID=0; chID=8 played the 2560x1440 camera of channel 8) and
   `streamType=sub` (the live stream's `sub1` is not needed). The device does NOT play only "the first segment": it
   concatenates every recording inside [time, time + timelen], starts at the first recorded frame at or after `time`, and
   keeps the real-time gaps between recordings in the presentation timestamps (a 65 s gap = a 65.8 s PTS jump). So the
   media anchor of PTS 0 is the first recorded instant >= the requested time, known from the search (`media_anchor`).
8. `action=backup` sent 300 s of the sub stream in 35 s (about 8x real time); there is no speed parameter and no HTTP
   download of video (export = RTSP backup into a file with ffmpeg, `rtsp_download`).
9. GetRecordType: `manual, schedule, motion, sensor, intel detection` (v1 names; v2 spells `intelligentDetection`).

Time: the device's wall clock follows its own POSIX rule (`provision_time`); see that module for the DST handling and why the
device rule wins over the IANA zone by default (`nvr_extra.time_basis = "iana"` forces the recorder's IANA zone).

AGENTS rule kept: a playback RTSP stream is not by itself a seekable, synchronized recording. The anchor rule of item 7 was
measured once on one channel; seek generations, rendered time and reconnect still have to be proven through go2rtc in the
browser before the timeline claims frame accuracy (`time_precision = "keyframe_limited"`)."""
from __future__ import annotations

import datetime as dt
import math
import shutil
import subprocess
import threading
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

from ...config import Settings
from ...errors import ApiError
from ..recordings import SearchResult, Segment, merge
from ..timeutil import iso_utc
from . import provision_isr as pisr
from . import provision_isr_xml as px
from . import provision_time as pt

PLAYBACK_COMMANDS = frozenset({"GetRecordType", "SearchRecordDate", "SearchByTime", "GetSnapshotByTime", "GetDateAndTime"})

DEVICE_CAP = 1000  # items per SearchByTime answer (guide tip + live)
MAX_REQUESTS = 30  # SearchByTime calls for one search; beyond that the result is `partial`
MAX_WINDOW = dt.timedelta(days=7)  # the same limit as the Hikvision search (recordings.search_segments)
MAX_SPAN = dt.timedelta(hours=6)  # one playback RTSP request (playback.MAX_SPAN)
SEARCH_TIMEOUT_S = 12.0
SNAPSHOT_MAX_BYTES = 4_000_000
ZONE_TTL_S = 600.0
TYPES_TTL_S = 3600.0
NO_RECORDINGS = 3  # errorCode of SearchByTime / GetSnapshotByTime when nothing is recorded there (live)

# device record type -> Arx segment kind (recordings.Segment.kind)
KIND_BY_RECTYPE = {
    "schedule": "continuous", "manual": "manual", "motion": "motion", "sensor": "alarm",
    "intel detection": "event", "intelligentdetection": "event", "nic broken": "event", "networkbroken": "event",
}
# Arx kind -> the device names that may mean it (v1 and v2 spellings; only those the device lists are sent)
RECTYPES_BY_KIND = {
    "continuous": ("schedule",), "manual": ("manual",), "motion": ("motion",), "alarm": ("sensor",),
    "event": ("intel detection", "intelligentDetection", "nic broken", "networkBroken"),
}
KINDS = frozenset(RECTYPES_BY_KIND)
V1_DEFAULT_TYPES = ("manual", "schedule", "motion", "sensor", "intel detection")

_ZONES: dict[str, tuple[float, dt.tzinfo, str, dict[str, Any]]] = {}  # device_key -> (expires, tz, source, facts)
_TYPES: dict[str, tuple[float, tuple[str, ...]]] = {}
_CACHE_LOCK = threading.Lock()
_SEARCH_LOCKS: dict[str, threading.Lock] = {}  # one search per device at a time (like Hikvision maxConcurrentSearches=1)
_monotonic = time.monotonic


def clear_caches() -> None:
    with _CACHE_LOCK:
        _ZONES.clear()
        _TYPES.clear()


# ------------------------------------------------------------------------------------------------ pure parsers

def _items(el: ET.Element | None) -> list[ET.Element]:
    """Every `<item>` child (not capped at px.MAX_ITEMS: a search answer holds up to 1000)."""
    return [] if el is None else [c for c in el if px._local(c.tag) == "item"][: DEVICE_CAP + 10]


def parse_record_types(xml: str | bytes) -> tuple[str, ...]:
    """`GetRecordType` -> the device's record type names (v1 `recTypeCaps` list; v2 adds a `types/recType` enum)."""
    root = px.parse(xml)
    names = [px.text(i, cap=32) for i in _items(px.child(root, "recTypeCaps"))]
    out = tuple(n for n in names if n)
    if not out:
        raise ET.ParseError("no record types")
    return out


def parse_record_dates(xml: str | bytes) -> list[dt.date]:
    """`SearchRecordDate` -> sorted unique dates (the live NVR writes `2026-9-19`, the guide `2014-01-09`)."""
    root = px.parse(xml)
    lst = px.child(root, "dateList")
    if lst is None:
        raise ET.ParseError("not a date list")
    out: set[dt.date] = set()
    for item in _items(lst):
        try:
            out.add(pt.parse_date(px.text(item) or ""))
        except ValueError:
            continue
    return sorted(out)


@dataclass(frozen=True)
class SectionPage:
    sections: list[pt.Section]
    count: int | None  # the list's `count` attribute
    max_count: int | None  # v2 examples carry `maxCount`; the live v1 NVR does not

    @property
    def truncated(self) -> bool:
        cap = min(DEVICE_CAP, self.max_count) if self.max_count else DEVICE_CAP
        return len(self.sections) >= cap or (self.count is not None and self.count >= cap)


def parse_time_sections(xml: str | bytes) -> SectionPage:
    """`SearchByTime` -> device segments in device order. `starttime` text = local wall clock, attributes `seconds` and
    `recType`; v2 adds `endtime`. Items without a usable start or duration are skipped."""
    root = px.parse(xml)
    lst = px.child(root, "timesectionList")
    if lst is None:
        raise ET.ParseError("not a time section list")
    out: list[pt.Section] = []
    for item in _items(lst):
        st = px.child(item, "starttime")
        if st is None:
            continue
        raw = px.text(st, cap=32)
        seconds = px.to_int(st.attrib.get("seconds"))
        if not raw or seconds is None or seconds < 0:
            continue
        out.append(pt.Section(start_raw=raw, seconds=seconds, rec_type=(st.attrib.get("recType") or "")[:32],
                              end_raw=px.text(item, "endtime", cap=32)))
    return SectionPage(out, px.to_int(lst.attrib.get("count")), px.to_int(lst.attrib.get("maxCount")))


def parse_time_doc(xml: str | bytes) -> dict[str, Any]:
    """`GetDateAndTime` -> px.parse_date_time plus `daylight_switch` (needed to know whether the rule's DST part is on)."""
    facts = px.parse_date_time(xml)
    zone = px.child(px.child(px.parse(xml), "time"), "timezoneInfo")
    facts["daylight_switch"] = px.to_bool(px.text(zone, "daylightSwitch"))
    return facts


def _cdata(value: str) -> str:
    if "]]>" in value or "<" in value or "&" in value:
        raise ValueError("unsafe value")
    return f"<![CDATA[{value}]]>"


def search_document(types: Iterable[str], start: dt.datetime, end: dt.datetime) -> str:
    """The v1 `SearchByTime` body (guide 6.1.3 / Postman), wall-clock times."""
    items = "".join(f"<item>{_cdata(t)}</item>" for t in types)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<config version="1.0" xmlns="http://www.ipc.com/ver10"><search>'
            f'<recTypes type="list"><itemType type="recType"></itemType>{items}</recTypes>'
            f'<starttime type="string">{_cdata(pt.format_wall(start))}</starttime>'
            f'<endtime type="string">{_cdata(pt.format_wall(end))}</endtime></search></config>')


def snapshot_document(at: dt.datetime, length_s: int = 10) -> str:
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<config version="1.0" xmlns="http://www.ipc.com/ver10"><search>'
            f'<time type="string">{_cdata(pt.format_wall(at))}</time><length type="uint16">{int(length_s)}</length></search></config>')


def kind_of(rec_type: str) -> str:
    return KIND_BY_RECTYPE.get((rec_type or "").strip().lower(), "unknown" if not rec_type else "event")


# ------------------------------------------------------------------------------------------------ results

@dataclass(frozen=True)
class PlaybackRequest:
    """One playback RTSP request: the URL (server-side only, credentials inside) and what it asks the device for."""
    url: str = field(repr=False)
    channel: int
    requested_at: dt.datetime  # UTC
    end_at: dt.datetime  # UTC (requested + timelen)
    timelen_s: int
    wall_date: str
    wall_time: str
    stream: str
    action: str
    ambiguous: bool  # the wall time falls in the repeated autumn hour; the device may pick either pass


@dataclass(frozen=True)
class SnapshotAt:
    data: bytes = field(repr=False)
    content_type: str
    codec: str  # jpeg | h264 | h265 | unknown
    requested_at: dt.datetime


def _codec(data: bytes, ctype: str) -> str:
    c = (ctype or "").lower()
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if "265" in c or "hevc" in c:
        return "h265"
    if "264" in c:
        return "h264"
    if data.startswith((b"\x00\x00\x00\x01", b"\x00\x00\x01")):
        nal = data[4] if data.startswith(b"\x00\x00\x00\x01") and len(data) > 4 else (data[3] if len(data) > 3 else 0)
        return "h265" if ((nal >> 1) & 0x3F) in (32, 33, 34, 19, 20) else "h264"
    return "unknown"


# ------------------------------------------------------------------------------------------------ the service

class ProvisionPlayback:
    """Playback reads for one Provision-ISR recorder, through its adapter's request path (auth, allow-list, deadline,
    lockout guard, error mapping). `tz_name` = the recorder's IANA zone (fallback / `time_basis: iana`)."""

    def __init__(self, adapter: pisr.ProvisionIsrAdapter, tz_name: str | None = "Asia/Jerusalem") -> None:
        self.adapter = adapter
        self.tz_name = tz_name or "Asia/Jerusalem"

    # ---------------------------------------------------------------- device facts

    @property
    def _extra(self) -> dict[str, Any]:
        return self.adapter._extra

    def _xml(self, command: str, channel: int | None, parser: Callable[..., Any], body: str | None = None, timeout: float = pisr.READ_TIMEOUT_S) -> Any:
        return self.adapter._xml(command, channel, parser, body=body, timeout=timeout, allowed=PLAYBACK_COMMANDS)

    def zone(self, *, refresh: bool = False) -> tuple[dt.tzinfo, str]:
        """(tzinfo, source) of the device's wall clock; cached 10 minutes per device. `source`: device | device_std | iana."""
        if str(self._extra.get("time_basis") or "").lower() == "iana":
            return pt.iana(self.tz_name), "iana"
        key = self.adapter.device_key
        with _CACHE_LOCK:
            hit = _ZONES.get(key)
        if hit and hit[0] > _monotonic() and not refresh:
            return hit[1], hit[2]
        try:
            facts = self._xml("GetDateAndTime", None, parse_time_doc)
        except ApiError as exc:
            if exc.code == "source_forbidden":
                raise
            return pt.iana(self.tz_name), "iana"  # not cached: the next call asks the device again
        tz, source = pt.device_zone(facts.get("time_zone"), facts.get("daylight_switch"), self.tz_name)
        with _CACHE_LOCK:
            _ZONES[key] = (_monotonic() + ZONE_TTL_S, tz, source, facts)
        return tz, source

    def zone_report(self, year: int | None = None) -> dict[str, Any]:
        """For health / settings: which rule converts times and where it disagrees with the recorder's IANA zone."""
        tz, source = self.zone()
        year = year or dt.datetime.now(pt.UTC).year
        periods = pt.divergence(tz, pt.iana(self.tz_name), year) if source != "iana" else []
        with _CACHE_LOCK:
            facts = dict((_ZONES.get(self.adapter.device_key) or (0, None, "", {}))[3])
        return {"source": source, "device_rule": facts.get("time_zone"), "iana": self.tz_name, "year": year,
                "differs": [{"from": iso_utc(a), "to": iso_utc(b)} for a, b in periods]}

    def record_types(self) -> tuple[str, ...]:
        key = self.adapter.device_key
        with _CACHE_LOCK:
            hit = _TYPES.get(key)
        if hit and hit[0] > _monotonic():
            return hit[1]
        try:
            types = self._xml("GetRecordType", None, parse_record_types)
        except ApiError as exc:
            if exc.code in ("source_forbidden", "source_unavailable", "deadline_exceeded"):
                raise
            return V1_DEFAULT_TYPES  # an older firmware without GetRecordType: the guide's v1 names
        with _CACHE_LOCK:
            _TYPES[key] = (_monotonic() + TYPES_TTL_S, types)
        return types

    def device_types_for(self, kinds: Iterable[str] | None) -> tuple[str, ...]:
        offered = self.record_types()
        if kinds is None:
            return offered
        wanted = set(kinds)
        unknown = wanted - KINDS
        if unknown or not wanted:
            raise ApiError(422, "validation", "סוג הקלטה לא מוכר.", details={"kinds": sorted(unknown)})
        lower = {o.lower(): o for o in offered}
        out = [lower[n.lower()] for k in sorted(wanted) for n in RECTYPES_BY_KIND[k] if n.lower() in lower]
        return tuple(dict.fromkeys(out))

    # ---------------------------------------------------------------- calendar

    def record_days(self, channel: int) -> list[dt.date]:
        """Local dates (device wall clock) with any recording on `channel` (SearchRecordDate)."""
        ch = _channel(channel)
        try:
            return self._xml("SearchRecordDate", ch, parse_record_dates)
        except ApiError as exc:
            if (exc.details or {}).get("device_code") == NO_RECORDINGS:
                return []
            raise

    def day(self, channel: int, day: dt.date, kinds: Iterable[str] | None = None) -> SearchResult:
        """The recordings of one local day [00:00, 24:00) of the device's wall clock (23 / 25 hours on DST days)."""
        tz, _ = self.zone()
        start = pt.wall_to_utc(dt.datetime.combine(day, dt.time()), tz)
        end = pt.wall_to_utc(dt.datetime.combine(day + dt.timedelta(days=1), dt.time()), tz)
        return self.search(channel, start, end, kinds)

    # ---------------------------------------------------------------- search

    def _page(self, ch: int, types: tuple[str, ...], ws: dt.datetime, we: dt.datetime) -> SectionPage:
        try:
            return self._xml("SearchByTime", ch, parse_time_sections, body=search_document(types, ws, we), timeout=SEARCH_TIMEOUT_S)
        except ApiError as exc:
            if (exc.details or {}).get("device_code") == NO_RECORDINGS:
                return SectionPage([], 0, None)  # live: an empty window is a 400 errorCode 3
            raise

    def search(self, channel: int, start: dt.datetime, end: dt.datetime, kinds: Iterable[str] | None = None) -> SearchResult:
        """Recording segments of `channel` overlapping the UTC window [start, end), as Arx `Segment`s (track_id = channel,
        raw device strings kept; end_raw = the device's endtime or `<start_raw>+<seconds>s`). Paged by cursor past the
        1000-item cap; `coverage` is `partial` when MAX_REQUESTS ran out, never "no recordings"."""
        ch = _channel(channel)
        if start.tzinfo is None or end.tzinfo is None:
            raise ApiError(422, "validation", "זמן בלי אזור זמן.")
        if end <= start:
            raise ApiError(422, "validation", "טווח הזמן ריק.")
        if end - start > MAX_WINDOW:
            raise ApiError(422, "validation", "טווח חיפוש מקסימלי: 7 ימים.")
        wanted = set(kinds) if kinds is not None else None
        types = self.device_types_for(wanted)
        tz, source = self.zone()
        ws, we, widened = pt.wall_window(start, end, tz)
        if not types:  # the device records none of the asked kinds
            return SearchResult([], "complete", 0, 0, iso_utc(dt.datetime.now(pt.UTC)), _zone_label(tz, source, self.tz_name), "no such record type on the device")
        with _CACHE_LOCK:
            lock = _SEARCH_LOCKS.setdefault(self.adapter.device_key, threading.Lock())
        sections: list[pt.Section] = []
        requests = 0
        coverage = "complete"
        cursor = ws
        with lock:
            while True:
                if requests >= MAX_REQUESTS:
                    coverage = "partial"
                    break
                page = self._page(ch, types, cursor, we)
                requests += 1
                sections.extend(page.sections)
                if not page.truncated or not page.sections:
                    break
                last = page.sections[-1]
                try:
                    nxt = pt.parse_wall(last.start_raw) + dt.timedelta(seconds=max(last.seconds, 1))
                except ValueError:
                    coverage = "partial"
                    break
                if nxt <= cursor or nxt >= we:
                    break
                cursor = nxt
        resolved = pt.resolve_sections(_dedupe(sections), tz)
        segments: list[Segment] = []
        ambiguous = 0
        for r in resolved:
            if r.end <= start or r.start >= end or r.end <= r.start:
                continue
            kind = kind_of(r.section.rec_type)
            if wanted is not None and kind not in wanted:
                continue
            ambiguous += r.ambiguous
            end_raw = r.section.end_raw or f"{r.section.start_raw}+{r.section.seconds}s"
            segments.append(Segment(start_at=iso_utc(max(r.start, start)), end_at=iso_utc(min(r.end, end)), kind=kind,
                                    track_id=ch, start_raw=r.section.start_raw, end_raw=end_raw))
        notes = []
        if coverage == "partial":
            notes.append(f"request cap ({MAX_REQUESTS} x {DEVICE_CAP}) reached")
        if ambiguous:
            notes.append(f"{ambiguous} segment(s) in the repeated DST hour placed by assumption")
        if widened:
            notes.append("query widened around a DST change")
        return SearchResult(segments=merge(segments), coverage=coverage, matches=len(sections), pages=requests,
                            searched_at=iso_utc(dt.datetime.now(pt.UTC)), timezone=_zone_label(tz, source, self.tz_name), note="; ".join(notes))

    # ---------------------------------------------------------------- playback

    def playback_request(self, channel: int, start: dt.datetime, end: dt.datetime | None = None, *, stream: str = "main",
                         action: str = "playback") -> PlaybackRequest:
        """The RTSP playback (or `backup`) request for [start, end) - at most MAX_SPAN, at least 1 s. Seek = a new request
        with a new start (the session engine makes it a new go2rtc stream generation). No speed parameter exists."""
        ch = _channel(channel)
        if stream not in ("main", "sub"):
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "stream"})
        if action not in ("playback", "backup"):
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "action"})
        if start.tzinfo is None or (end is not None and end.tzinfo is None):
            raise ApiError(422, "validation", "זמן בלי אזור זמן.")
        end = end if end is not None else start + MAX_SPAN
        if end <= start:
            raise ApiError(422, "validation", "טווח הזמן ריק.")
        end = min(end, start + MAX_SPAN)
        timelen = max(1, math.ceil((end - start).total_seconds()))
        s = self.adapter._settings
        from ...mode import ensure_nvr, ensure_recorder_enabled

        ensure_nvr(s)
        ensure_recorder_enabled(s)  # security review M3: no playback URL for a recorder disabled while running
        if not s.nvr_host or not s.nvr_user or not s.nvr_password:
            raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו.")
        tz, _ = self.zone()
        wall = pt.utc_to_wall(start, tz)
        base_no = int(self._extra.get("playback_channel_base", 1))  # live 2026-10-04: 1-based (the guide's example shows 0)
        device_ch = ch - 1 + base_no
        query = f"chID={device_ch}&date={wall:%Y-%m-%d}&time={wall:%H:%M:%S}&timelen={timelen}&streamType={stream}&action={action}"
        url = f"rtsp://{quote(s.nvr_user, safe='')}:{quote(s.nvr_password, safe='')}@{s.nvr_host}:{s.nvr_rtsp_port}/{query}"
        return PlaybackRequest(url=url, channel=ch, requested_at=start.astimezone(pt.UTC).replace(microsecond=0), end_at=start + dt.timedelta(seconds=timelen),
                               timelen_s=timelen, wall_date=f"{wall:%Y-%m-%d}", wall_time=f"{wall:%H:%M:%S}", stream=stream, action=action,
                               ambiguous=pt.is_ambiguous(wall, tz))

    # ---------------------------------------------------------------- snapshot at a time

    def snapshot_at(self, channel: int, at: dt.datetime, length_s: int = 10) -> SnapshotAt:
        """The key frame at (or within `length_s` after) `at`. 404 `no_recording` when nothing is recorded there (live:
        errorCode 3). The live NVR returns an H.264 key frame (`image/h264`); `to_jpeg` turns it into a picture."""
        ch = _channel(channel)
        if at.tzinfo is None:
            raise ApiError(422, "validation", "זמן בלי אזור זמן.")
        if not 1 <= int(length_s) <= 60:
            raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "length_s"})
        tz, _ = self.zone()
        try:
            data, ctype = self.adapter._call("GetSnapshotByTime", ch, body=snapshot_document(pt.utc_to_wall(at, tz), length_s),
                                             max_bytes=SNAPSHOT_MAX_BYTES, allowed=PLAYBACK_COMMANDS)
        except ApiError as exc:
            if (exc.details or {}).get("device_code") == NO_RECORDINGS:
                raise ApiError(404, "no_recording", "אין הקלטה בזמן הזה.", details={"op": "GetSnapshotByTime"}) from exc
            raise
        status, code, _ = px.response_status(data) if data[:1] == b"<" else (None, None, None)
        if status == "failed":
            if code == NO_RECORDINGS:
                raise ApiError(404, "no_recording", "אין הקלטה בזמן הזה.", details={"op": "GetSnapshotByTime"})
            raise pisr._device_error("GetSnapshotByTime", 400, data.decode("utf-8", "replace"))
        codec = _codec(data, ctype)
        if codec == "unknown" or len(data) < 16:
            raise ApiError(503, "snapshot_unavailable", "ה־NVR לא סיפק תמונה לזמן זה.", retryable=True, details={"op": "GetSnapshotByTime"})
        return SnapshotAt(data=data, content_type=(ctype or "")[:64], codec=codec, requested_at=at)

    # ---------------------------------------------------------------- export

    def export_files(self, channel: int, start: dt.datetime, end: dt.datetime, *, stream: str = "main") -> tuple[list[Any], str]:
        """`exports.ExportFile`s for [start, end): one per merged recording, its `playback_uri` the RTSP `backup` request
        (server-side only; `rtsp_download` is the matching Worker.downloader). Sizes are unknown (None)."""
        from ..exports import ExportFile

        result = self.search(channel, start, end)
        files = []
        for seg in result.segments:
            s, e = _parse_iso(seg.start_at), _parse_iso(seg.end_at)
            pos = s
            while pos < e:  # a recording longer than one RTSP request is split
                part_end = min(e, pos + MAX_SPAN)
                req = self.playback_request(channel, pos, part_end, stream=stream, action="backup")
                files.append(ExportFile(name=f"ch{req.channel}_{req.wall_date}_{req.wall_time.replace(':', '')}", start_at=iso_utc(pos),
                                        end_at=iso_utc(part_end), start_raw=seg.start_raw, end_raw=seg.end_raw, size=None, playback_uri=req.url))
                pos = part_end
        return files, result.coverage


def media_anchor(result: SearchResult, requested_at: dt.datetime) -> dt.datetime | None:
    """The instant PTS 0 of a Provision playback stream shows: the first recorded instant at or after `requested_at`
    (live item 7). None when nothing is recorded after it inside the searched window."""
    for seg in result.segments:
        s, e = _parse_iso(seg.start_at), _parse_iso(seg.end_at)
        if e > requested_at:
            return max(s, requested_at)
    return None


def rtsp_playback_url(settings: Settings, track_id: int, start: dt.datetime, end: dt.datetime, tz_name: str, *,
                      recorder_id: str = "nvr-1", stream: str = "main") -> str:
    """Drop-in for `playback.playback_rtsp_url` (same signature) on a Provision-ISR recorder: `track_id` is the channel.
    The session engine keeps its go2rtc stream names (`smplwise_pb_<instance>_<session>_g<n>`), so nothing outside the
    product's namespace is touched. Wiring (after CR-024): `_create_stream` picks this when `settings.nvr_vendor` is
    `provision_isr`."""
    from ...mode import ensure_nvr, ensure_recorder_enabled

    ensure_nvr(settings)
    ensure_recorder_enabled(settings)  # security review M3
    adapter = pisr.ProvisionIsrAdapter(recorder_id, settings)
    return ProvisionPlayback(adapter, tz_name).playback_request(int(track_id), start, end, stream=stream).url


def to_jpeg(snap: SnapshotAt, *, width: int = 480, timeout_s: int = 15, ffmpeg: str | None = None) -> bytes:
    """A JPEG of a snapshot: JPEG as is; an H.264 / H.265 key frame decoded by ffmpeg (stdin -> stdout, no file, no
    network). 503 `snapshot_unavailable` when ffmpeg is missing or cannot decode."""
    if snap.codec == "jpeg":
        return snap.data
    ff = ffmpeg or shutil.which("ffmpeg")
    if not ff:
        raise ApiError(503, "snapshot_unavailable", "ffmpeg אינו זמין.", details={"op": "to_jpeg", "reason": "ffmpeg_missing"})
    fmt = {"h264": "h264", "h265": "hevc"}.get(snap.codec)
    if fmt is None:
        raise ApiError(503, "snapshot_unavailable", "פורמט התמונה אינו מוכר.", details={"op": "to_jpeg"})
    args = [ff, "-hide_banner", "-loglevel", "error", "-f", fmt, "-i", "pipe:0", "-frames:v", "1", "-vf", f"scale={int(width)}:-2",
            "-q:v", "5", "-f", "image2", "-c:v", "mjpeg", "pipe:1"]
    try:
        proc = subprocess.run(args, input=snap.data, capture_output=True, timeout=timeout_s)
    except (subprocess.TimeoutExpired, OSError) as exc:
        raise ApiError(503, "snapshot_unavailable", "פענוח התמונה נכשל.", details={"op": "to_jpeg", "error": type(exc).__name__}) from exc
    if proc.returncode != 0 or not proc.stdout.startswith(b"\xff\xd8"):
        raise ApiError(503, "snapshot_unavailable", "פענוח התמונה נכשל.", details={"op": "to_jpeg", "rc": proc.returncode})
    return proc.stdout


def rtsp_download(settings: Settings, playback_uri: str, dest: Any, progress: Callable[[int], bool] | None = None, *,
                  ffmpeg: str | None = None, timeout_s: int = 3600, poll_s: float = 1.0) -> None:
    """`exports.Worker.downloader` for Provision-ISR: copy one RTSP `backup` request into `dest` (MPEG-TS, no re-encode).
    Read-only on the device. `progress(bytes) -> False` aborts. Errors never carry the URL, user, password or host."""
    from pathlib import Path

    ff = ffmpeg or shutil.which("ffmpeg")
    if not ff:
        raise ApiError(503, "export_unavailable", "ffmpeg אינו זמין.", details={"op": "download", "reason": "ffmpeg_missing"})
    if not str(playback_uri).startswith("rtsp://") or "action=backup" not in playback_uri:
        raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "playback_uri"})
    from ...mode import ensure_recorder_enabled

    ensure_recorder_enabled(settings)  # security review M3: an export of a recorder disabled meanwhile downloads nothing
    dest = Path(dest)
    args = [ff, "-hide_banner", "-loglevel", "error", "-y", "-rtsp_transport", "tcp", "-timeout", "15000000", "-i", playback_uri,
            "-map", "0", "-c", "copy", "-f", "mpegts", str(dest)]
    proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    began = time.monotonic()
    aborted = False
    try:
        while proc.poll() is None:
            if time.monotonic() - began > timeout_s:
                aborted = True
                proc.kill()
                break
            size = dest.stat().st_size if dest.exists() else 0
            if progress is not None and progress(size) is False:
                aborted = True
                proc.kill()
                break
            time.sleep(poll_s)
        _out, err = proc.communicate(timeout=30)
    finally:
        if proc.poll() is None:
            proc.kill()
    if aborted:
        dest.unlink(missing_ok=True)
        raise ApiError(409, "export_cancelled", "ההורדה הופסקה.", details={"op": "download"})
    if proc.returncode != 0 or not dest.exists() or dest.stat().st_size == 0:
        text = (err or b"").decode("utf-8", "replace").replace(playback_uri, "<rtsp-url>")
        for secret in (settings.nvr_password, settings.nvr_user, settings.nvr_host):
            if secret:
                text = text.replace(str(secret), "***").replace(quote(str(secret), safe=""), "***")
        dest.unlink(missing_ok=True)
        raise ApiError(503, "download_refused", "ה־NVR לא סיפק את ההקלטה.", details={"op": "download", "rc": proc.returncode, "error": text.strip()[-160:]})
    if progress is not None:
        progress(dest.stat().st_size)


# ------------------------------------------------------------------------------------------------ helpers

def _channel(channel: Any) -> int:
    ok = isinstance(channel, int) and not isinstance(channel, bool) or isinstance(channel, str) and channel.isdigit()
    ch = int(channel) if ok else 0
    if not 1 <= ch <= 512:
        raise ApiError(422, "value_not_allowed", "הערך אינו מותר.", details={"field": "channel"})
    return ch


def _dedupe(sections: list[pt.Section]) -> list[pt.Section]:
    seen: set[tuple[str, int, str]] = set()
    out = []
    for s in sections:
        k = (s.start_raw, s.seconds, s.rec_type)
        if k not in seen:
            seen.add(k)
            out.append(s)
    return out


def _parse_iso(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def _zone_label(tz: dt.tzinfo, source: str, iana_name: str) -> str:
    return iana_name if source == "iana" else f"device:{getattr(tz, 'spec', None) or tz.tzname(None)}"


__all__ = ["ProvisionPlayback", "PlaybackRequest", "SnapshotAt", "media_anchor", "rtsp_playback_url", "to_jpeg", "rtsp_download",
           "parse_record_types", "parse_record_dates", "parse_time_sections", "search_document", "kind_of", "PLAYBACK_COMMANDS"]
