"""Read-only Hikvision ISAPI adapter used for camera discovery (T012/T013 scope kept minimal):
input channels, their online status and the recording track ids. Every call is a bounded GET with digest
auth; nothing here writes to the device, and no URL or credential leaves the server."""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import httpx

from ..config import Settings
from ..errors import ApiError
from . import xmlsafe


@dataclass
class DiscoveredChannel:
    channel: int
    name: str
    online: bool | None
    main_track: int | None
    sub_track: int | None
    stream: dict[str, object] | None = None  # from the main track's Description (evidence, not assumption)
    sub_stream: dict[str, object] | None = None  # the sub track's Description, when the device fills it


def parse_track_description(desc: str) -> dict[str, object]:
    """'trackType=standard,contentType=video,codecType=H.264-BP,resolution=2560x1440,framerate=25.0 fps,bitrate=3072 kbps'"""
    out: dict[str, object] = {}
    for part in desc.split(","):
        if "=" not in part:
            continue
        key, value = (s.strip() for s in part.split("=", 1))
        if key == "codecType":
            out["codec"] = value
        elif key == "resolution":
            out["resolution"] = value
        elif key == "framerate":
            m = re.match(r"([\d.]+)", value)
            if m:
                out["fps"] = float(m.group(1))
        elif key == "bitrate":
            m = re.match(r"(\d+)", value)
            if m:
                out["bitrate_kbps"] = int(m.group(1))
    return out


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _text(el: ET.Element, name: str) -> str:
    for child in el.iter():
        if _local(child.tag) == name and child.text:
            return child.text.strip()
    return ""


_SSL_CONTEXT = None


def _ssl_context():
    """httpx's default verification context, built once: building it loads the CA bundle (about a second on the
    workstation) for every client, and the NVR is plain http - the discovery / wizard make several calls in a row."""
    global _SSL_CONTEXT
    if _SSL_CONTEXT is None:
        _SSL_CONTEXT = httpx.create_ssl_context()
    return _SSL_CONTEXT


def _client(settings: Settings, timeout: float = 8.0) -> httpx.Client:
    from ..mode import ensure_nvr

    ensure_nvr(settings)  # NVR-less mode: 409 nvr_not_configured, reached only after the caller's permission check
    if not settings.nvr_host or not settings.nvr_user or not settings.nvr_password:
        raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו בהגדרות ה־Add-on.")
    return httpx.Client(
        base_url=f"http://{settings.nvr_host}:{settings.nvr_http_port}",
        auth=httpx.DigestAuth(settings.nvr_user, settings.nvr_password),
        timeout=timeout,
        verify=_ssl_context(),
    )


def _get(client: httpx.Client, path: str) -> str:
    try:
        r = client.get(path)
    except httpx.HTTPError as exc:
        raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"path": path, "error": type(exc).__name__}) from exc
    if r.status_code in (401, 403):
        raise ApiError(503, "source_forbidden", "ה־NVR דחה את פרטי הגישה.", details={"path": path, "status": r.status_code})
    if r.status_code != 200:
        raise ApiError(503, "source_error", "ה־NVR החזיר שגיאה.", retryable=True, details={"path": path, "status": r.status_code})
    return r.text


def fetch_snapshot(settings: Settings, channel: int) -> bytes:
    """One JPEG frame of the channel's main stream (ISAPI picture endpoint; read-only)."""
    with _client(settings) as client:
        try:
            r = client.get(f"/ISAPI/Streaming/channels/{channel}01/picture")
        except httpx.HTTPError as exc:
            raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"op": "snapshot", "error": type(exc).__name__}) from exc
    if r.status_code in (401, 403):
        raise ApiError(503, "source_forbidden", "ה־NVR דחה את פרטי הגישה.", details={"op": "snapshot", "status": r.status_code})
    if r.status_code != 200 or not r.content.startswith(b"\xff\xd8\xff"):
        raise ApiError(503, "snapshot_unavailable", "ה־NVR לא סיפק תמונה לערוץ זה.", retryable=True, details={"op": "snapshot", "status": r.status_code})
    return r.content


@dataclass
class SearchMatch:
    track_id: int
    start_raw: str  # device string, local wall clock (KNOWN_QUIRKS T2)
    end_raw: str
    playback_uri: str
    record_type: str  # CMR | MOTION | ALARM | ... | "" when the device does not say


@dataclass
class SearchPage:
    matches: list[SearchMatch]
    total: int | None  # numOfMatches as reported by the device (may be None)
    status: str  # OK | MORE | NO MATCHES | <raw>


def search_recordings(settings: Settings, track_id: int, start_wall: str, end_wall: str, position: int = 0, page_size: int = 40, search_id: str | None = None) -> SearchPage:
    """One page of `POST /ISAPI/ContentMgmt/search` (the legacy-proven plain body, KNOWN_QUIRKS S1/S2).

    A search is a read-only query. `start_wall`/`end_wall` are already in the device's local wall-clock
    format (`services.timeutil.utc_to_nvr_wall`); nothing here interprets time."""
    import uuid

    sid = search_id or str(uuid.uuid4()).upper()
    body = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<CMSearchDescription>\n"
        f"<searchID>{sid}</searchID>\n"
        f"<trackIDList><trackID>{int(track_id)}</trackID></trackIDList>\n"
        f"<timeSpanList><timeSpan><startTime>{start_wall}</startTime><endTime>{end_wall}</endTime></timeSpan></timeSpanList>"
        f"<maxResults>{int(page_size)}</maxResults>"
        f"<searchResultPosition>{int(position)}</searchResultPosition>"
        "<metadataList><metadataDescriptor>//recordType.meta.std-cgi.com</metadataDescriptor></metadataList>"
        "</CMSearchDescription>"
    )
    with _client(settings) as client:
        try:
            r = client.post("/ISAPI/ContentMgmt/search", content=body.encode("utf-8"), headers={"Content-Type": "application/xml"})
        except httpx.HTTPError as exc:
            raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"op": "search", "error": type(exc).__name__}) from exc
    if r.status_code in (401, 403):
        raise ApiError(503, "source_forbidden", "ה־NVR דחה את פרטי הגישה.", details={"op": "search", "status": r.status_code})
    if r.status_code != 200:
        raise ApiError(503, "source_error", "ה־NVR החזיר שגיאה בחיפוש.", retryable=True, details={"op": "search", "status": r.status_code, "body": r.text[:120]})
    return parse_search_response(r.text, track_id)


def parse_search_response(xml: str, track_id: int) -> SearchPage:
    root = xmlsafe.parse(xml)
    if _local(root.tag) == "ResponseStatus":
        raise ApiError(503, "source_error", "ה־NVR דחה את החיפוש.", details={"op": "search", "status": _text(root, "statusString"), "sub": _text(root, "subStatusCode")})
    status = (_text(root, "responseStatusStrg") or _text(root, "responseStatusString") or "").strip().upper()
    total_text = _text(root, "numOfMatches")
    total = int(total_text) if total_text.isdigit() else None
    matches: list[SearchMatch] = []
    for item in root.iter():
        if _local(item.tag) != "searchMatchItem":
            continue
        tid = _text(item, "trackID")
        rtype = ""
        for meta in item.iter():
            if _local(meta.tag) == "metadataDescriptor" and meta.text:
                rtype = meta.text.strip().rsplit("/", 1)[-1].upper()
        matches.append(SearchMatch(
            track_id=int(tid) if tid.isdigit() else track_id,
            start_raw=_text(item, "startTime"),
            end_raw=_text(item, "endTime"),
            playback_uri=_text(item, "playbackURI").replace(" ", ""),
            record_type=rtype,
        ))
    return SearchPage(matches=matches, total=total, status=status or ("OK" if matches else "NO MATCHES"))


def device_info(settings: Settings) -> dict[str, str]:
    with _client(settings) as client:
        xml = _get(client, "/ISAPI/System/deviceInfo")
    root = xmlsafe.parse(xml)
    return {"model": _text(root, "model"), "firmware": _text(root, "firmwareVersion"), "device_type": _text(root, "deviceType")}


def discover_channels(settings: Settings) -> list[DiscoveredChannel]:
    with _client(settings) as client:
        channels_xml = _get(client, "/ISAPI/ContentMgmt/InputProxy/channels")
        try:
            status_xml = _get(client, "/ISAPI/ContentMgmt/InputProxy/channels/status")
        except ApiError:
            status_xml = ""
        try:
            tracks_xml = _get(client, "/ISAPI/ContentMgmt/record/tracks")
        except ApiError:
            tracks_xml = ""

    online: dict[int, bool] = {}
    if status_xml:
        for el in xmlsafe.parse(status_xml).iter():
            if _local(el.tag) == "InputProxyChannelStatus":
                cid = _text(el, "id")
                if cid.isdigit():
                    online[int(cid)] = _text(el, "online").lower() == "true"

    # Track ids come from the device (Track/id with SrcDescriptor/SrcChannel), never computed as
    # channel*100+1 (T013). Lab firmware V4.84: <Channel> repeats the track id; <SrcChannel> is the input.
    tracks: dict[int, list[tuple[int, dict[str, object]]]] = {}
    if tracks_xml:
        for el in xmlsafe.parse(tracks_xml).iter():
            if _local(el.tag) == "Track":
                tid = _text(el, "id")
                ch = _text(el, "SrcChannel")
                if tid.isdigit() and ch.isdigit():
                    tracks.setdefault(int(ch), []).append((int(tid), parse_track_description(_text(el, "Description"))))

    result: list[DiscoveredChannel] = []
    for el in xmlsafe.parse(channels_xml).iter():
        if _local(el.tag) != "InputProxyChannel":
            continue
        cid = _text(el, "id")
        if not cid.isdigit():
            continue
        ch = int(cid)
        ids = sorted(tracks.get(ch, []), key=lambda t: t[0])
        result.append(DiscoveredChannel(
            channel=ch,
            name=re.sub(r"\s+", " ", _text(el, "name")).strip(),
            online=online.get(ch),
            main_track=ids[0][0] if ids else None,
            sub_track=ids[1][0] if len(ids) > 1 else None,
            stream=ids[0][1] if ids and ids[0][1] else None,
            sub_stream=ids[1][1] if len(ids) > 1 and ids[1][1] else None,
        ))
    return result


def download_file(settings: Settings, playback_uri: str, dest, progress=None) -> None:
    """Stream one recording file from `/ISAPI/ContentMgmt/download` (download by file name is the only
    variant this NVR supports, KNOWN_QUIRKS S4/S6) into `dest`. `progress(bytes_so_far) -> bool` may return
    False to abort. One retry on a dropped connection before the first byte."""
    import html as _html
    from pathlib import Path

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n<downloadRequest version="1.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n'
        f"<playbackURI>{_html.escape(playback_uri, quote=False)}</playbackURI>\n</downloadRequest>"
    ).encode("utf-8")
    dest = Path(dest)
    attempts = 0
    while True:
        attempts += 1
        written = 0
        try:
            with _client(settings) as client:
                client.timeout = httpx.Timeout(connect=15, read=120, write=15, pool=15)
                req = client.build_request("GET", "/ISAPI/ContentMgmt/download", content=body, headers={"Content-Type": "application/xml"})
                r = client.send(req, stream=True)
                try:
                    if r.status_code in (401, 403):
                        raise ApiError(503, "source_forbidden", "ה־NVR דחה את פרטי הגישה.", details={"op": "download", "status": r.status_code})
                    if r.status_code != 200 or "xml" in (r.headers.get("content-type") or "").lower():
                        snippet = r.read()[:300].decode("utf-8", "ignore")
                        raise ApiError(503, "download_refused", "ה־NVR סירב להוריד את הקובץ.", details={"op": "download", "status": r.status_code, "body": snippet})
                    with open(dest, "wb") as f:
                        for chunk in r.iter_bytes(256 * 1024):
                            f.write(chunk)
                            written += len(chunk)
                            if progress is not None and progress(written) is False:
                                raise ApiError(499, "cancelled", "ההורדה בוטלה.")
                finally:
                    r.close()
            return
        except httpx.HTTPError as exc:
            if written == 0 and attempts < 2:
                continue
            raise ApiError(503, "source_unavailable", "ה־NVR ניתק את ההורדה.", retryable=True, details={"op": "download", "error": type(exc).__name__, "bytes": written}) from exc


# ---------------------------------------------------------------- storage and recording plan (T051, read-only GETs)

@dataclass
class Disk:
    id: str
    name: str
    kind: str  # SATA | NAS | ...
    status: str  # ok | error | formatting | ...
    capacity_mb: int
    free_mb: int
    property: str  # RW | RO | R
    path: str = ""


@dataclass
class TrackSchedule:
    track_id: int
    channel: int
    src_channel: int | None
    enable_flag: bool  # the device's own <Enable> flag; the lab NVR reports false on tracks that do record
    default_mode: str  # CMR | MOTION | ...
    pre_s: int | None
    post_s: int | None
    expiry: str  # ISO-8601 duration; P0DT0H = no expiry
    save_audio: bool | None
    description: dict[str, object]
    blocks: list[dict[str, object]]  # {day, start, end_day, end, record, mode}
    modes: list[str]  # distinct recording modes of the blocks that record


def _child(el: ET.Element, name: str) -> ET.Element | None:
    for child in el:
        if _local(child.tag) == name:
            return child
    return None


def _int(value: str, default: int = 0) -> int:
    m = re.match(r"-?\d+", value.strip()) if value else None
    return int(m.group(0)) if m else default


def parse_storage(xml: str) -> dict[str, object]:
    """`GET /ISAPI/ContentMgmt/Storage`: hdd / nas lists (MB) and the work mode (quota | group)."""
    root_el = xmlsafe.parse(xml)
    disks: list[Disk] = []
    nas: list[Disk] = []
    for el in root_el.iter():
        tag = _local(el.tag)
        if tag not in ("hdd", "nas"):
            continue
        d = Disk(
            id=_text(el, "id"), name=_text(el, "hddName") or _text(el, "nasName") or f"{tag}{_text(el, 'id')}", kind=_text(el, "hddType") or _text(el, "nasType") or tag.upper(),
            status=_text(el, "status"), capacity_mb=_int(_text(el, "capacity")), free_mb=_int(_text(el, "freeSpace")), property=_text(el, "property"), path=_text(el, "hddPath") or _text(el, "path"),
        )
        (disks if tag == "hdd" else nas).append(d)
    return {"disks": disks, "nas": nas, "work_mode": _text(root_el, "workMode")}


def storage_status(settings: Settings) -> dict[str, object]:
    with _client(settings) as client:
        xml = _get(client, "/ISAPI/ContentMgmt/Storage")
    return parse_storage(xml)


def parse_tracks_schedule(xml: str) -> list[TrackSchedule]:
    """`GET /ISAPI/ContentMgmt/record/tracks`: per track the weekly schedule blocks, pre/post seconds and the stream description."""
    root_el = xmlsafe.parse(xml)
    out: list[TrackSchedule] = []
    tracks = [root_el] if _local(root_el.tag) == "Track" else [el for el in root_el.iter() if _local(el.tag) == "Track"]
    for tr in tracks:
        blocks: list[dict[str, object]] = []
        for act in tr.iter():
            if _local(act.tag) != "ScheduleAction":
                continue
            st, en, acts = _child(act, "ScheduleActionStartTime"), _child(act, "ScheduleActionEndTime"), _child(act, "Actions")
            blocks.append({
                "day": _text(st, "DayOfWeek") if st is not None else "", "start": _text(st, "TimeOfDay") if st is not None else "",
                "end_day": _text(en, "DayOfWeek") if en is not None else "", "end": _text(en, "TimeOfDay") if en is not None else "",
                "record": (_text(acts, "Record") if acts is not None else "") == "true", "mode": _text(acts, "ActionRecordingMode") if acts is not None else "",
            })
        src = _child(tr, "SrcDescriptor")
        src_channel = _text(src, "SrcChannel") if src is not None else ""
        desc_el = _child(tr, "Description")
        ext = next((el for el in tr.iter() if _local(el.tag) == "CustomExtension"), None)
        pre = _text(ext, "PreRecordTimeSeconds") if ext is not None else ""
        post = _text(ext, "PostRecordTimeSeconds") if ext is not None else ""
        audio = _text(ext, "SaveAudio") if ext is not None else ""
        enable_el = _child(tr, "Enable")
        out.append(TrackSchedule(
            track_id=_int(_text(_child(tr, "id") or tr, "id")) if _child(tr, "id") is not None else 0,
            channel=_int(_text(_child(tr, "Channel") or tr, "Channel")) if _child(tr, "Channel") is not None else 0,
            src_channel=int(src_channel) if src_channel.isdigit() else None,
            enable_flag=(enable_el.text or "").strip() == "true" if enable_el is not None else False,
            default_mode=(_child(tr, "DefaultRecordingMode").text or "").strip() if _child(tr, "DefaultRecordingMode") is not None else "",
            pre_s=_int(pre) if pre else None, post_s=_int(post) if post else None,
            expiry=(_child(tr, "Duration").text or "").strip() if _child(tr, "Duration") is not None else "",
            save_audio=(audio == "true") if audio else None,
            description=parse_track_description((desc_el.text or "").strip()) if desc_el is not None else {},
            blocks=blocks, modes=sorted({str(b["mode"]) for b in blocks if b["record"] and b["mode"]}),
        ))
    return out


def record_schedules(settings: Settings) -> list[TrackSchedule]:
    with _client(settings) as client:
        xml = _get(client, "/ISAPI/ContentMgmt/record/tracks")
    return parse_tracks_schedule(xml)


def oldest_recording(settings: Settings, track_id: int, start_wall: str, end_wall: str) -> str | None:
    """The device wall-clock start of the earliest recording in [start, end): one search page of one result
    (the NVR answers in time order). None when nothing is recorded in the window."""
    page = search_recordings(settings, track_id, start_wall, end_wall, position=0, page_size=1)
    return page.matches[0].start_raw if page.matches else None


# ---------------------------------------------------------------- detection zones (T075, read-only)

def _hex_bits(hexmap: str, rows: int, cols: int) -> list[list[bool]]:
    """ISAPI gridMap: each row packed MSB-first into ceil(cols/8) bytes, rows concatenated as hex."""
    row_bytes = (cols + 7) // 8
    cells: list[list[bool]] = []
    for r in range(rows):
        chunk = hexmap[r * row_bytes * 2:(r + 1) * row_bytes * 2]
        try:
            value = int(chunk, 16) if chunk else 0
        except ValueError:
            value = 0
        width = row_bytes * 8
        cells.append([bool((value >> (width - 1 - c)) & 1) for c in range(cols)])
    return cells


def parse_motion_grid(xml: str) -> dict[str, object]:
    """/ISAPI/System/Video/inputs/channels/{n}/motionDetection → enabled, sensitivity, grid cells, coverage."""
    from .xmlsafe import parse

    root = parse(xml)
    grid = _child(root, "Grid")
    rows = _int(_text(grid, "rowGranularity"), 0) if grid is not None else 0
    cols = _int(_text(grid, "columnGranularity"), 0) if grid is not None else 0
    layout = _child(root, "MotionDetectionLayout")
    hexmap = ""
    sensitivity = None
    target = ""
    if layout is not None:
        sensitivity = _int(_text(layout, "sensitivityLevel"), 0)
        target = _text(layout, "targetType")
        inner = _child(layout, "layout")
        if inner is not None:
            hexmap = _text(inner, "gridMap")
    cells = _hex_bits(hexmap, rows, cols) if rows and cols and hexmap else []
    total = rows * cols
    active = sum(1 for row in cells for c in row if c)
    return {
        "enabled": _text(root, "enabled") == "true",
        "region_type": _text(root, "regionType") or "grid",
        "sensitivity": sensitivity,
        "rows": rows,
        "cols": cols,
        "cells": cells,
        "coverage_pct": round(100.0 * active / total, 1) if total else 0.0,
        "target_types": [t for t in target.split(",") if t],
    }


def _points(list_el: ET.Element | None, x_name: str, y_name: str) -> list[list[int]]:
    if list_el is None:
        return []
    out: list[list[int]] = []
    for pt in list(list_el):
        x, y = _text(pt, x_name), _text(pt, y_name)
        if x and y:
            out.append([_int(x, 0), _int(y, 0)])
    return out


def _normalized(root: ET.Element, default: int) -> dict[str, int]:
    n = _child(root, "normalizedScreenSize")
    if n is None:
        return {"width": default, "height": default}
    return {"width": _int(_text(n, "normalizedScreenWidth"), default), "height": _int(_text(n, "normalizedScreenHeight"), default)}


def parse_privacy_mask(xml: str) -> dict[str, object]:
    """/ISAPI/System/Video/inputs/channels/{n}/privacyMask → enabled flag + polygons in the device's normalized frame."""
    from .xmlsafe import parse

    root = parse(xml)
    regions = []
    lst = _child(root, "PrivacyMaskRegionList")
    for reg in list(lst) if lst is not None else []:
        regions.append({"id": _text(reg, "id"), "enabled": _text(reg, "enabled") != "false", "points": _points(_child(reg, "RegionCoordinatesList"), "positionX", "positionY")})
    return {"enabled": _text(root, "enabled") == "true", "normalized": _normalized(root, 704), "regions": regions}


def parse_field_detection(xml: str) -> dict[str, object]:
    """/ISAPI/Smart/FieldDetection/{n} (intrusion regions) → polygons in a 1000×1000 frame."""
    from .xmlsafe import parse

    root = parse(xml)
    regions = []
    lst = _child(root, "FieldDetectionRegionList")
    for reg in list(lst) if lst is not None else []:
        pts = _points(_child(reg, "RegionCoordinatesList"), "positionX", "positionY")
        if pts:
            regions.append({"id": _text(reg, "id"), "sensitivity": _int(_text(reg, "sensitivityLevel"), 0), "points": pts})
    return {"enabled": _text(root, "enabled") == "true", "normalized": _normalized(root, 1000), "regions": regions}


def parse_line_detection(xml: str) -> dict[str, object]:
    """/ISAPI/Smart/LineDetection/{n} (line crossing) → lines with their direction sensitivity."""
    from .xmlsafe import parse

    root = parse(xml)
    lines = []
    lst = _child(root, "LineItemList")
    for item in list(lst) if lst is not None else []:
        pts = _points(_child(item, "CoordinatesList"), "positionX", "positionY")
        if pts:
            lines.append({"id": _text(item, "id"), "enabled": _text(item, "enabled") == "true", "direction": _text(item, "directionSensitivity") or "any", "points": pts})
    return {"enabled": _text(root, "enabled") == "true", "normalized": _normalized(root, 1000), "lines": lines}


ZONE_SOURCES = {
    "motion": ("/ISAPI/System/Video/inputs/channels/{ch}/motionDetection", parse_motion_grid),
    "privacy_mask": ("/ISAPI/System/Video/inputs/channels/{ch}/privacyMask", parse_privacy_mask),
    "intrusion": ("/ISAPI/Smart/FieldDetection/{ch}", parse_field_detection),
    "line_crossing": ("/ISAPI/Smart/LineDetection/{ch}", parse_line_detection),
}


def fetch_detection_zones(settings: Settings, channel: int) -> dict[str, object]:
    """Four read-only GETs; a source the device refuses or lacks is reported as unsupported with its reason, never invented."""
    out: dict[str, object] = {}
    unsupported: dict[str, str] = {}
    with _client(settings) as client:
        for key, (path, parser) in ZONE_SOURCES.items():
            try:
                r = client.get(path.format(ch=channel))
            except httpx.HTTPError as exc:
                raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"path": path, "error": type(exc).__name__}) from exc
            if r.status_code in (401, 403):
                unsupported[key] = "forbidden"
                out[key] = None
                continue
            if r.status_code == 404:
                unsupported[key] = "not_supported"
                out[key] = None
                continue
            if r.status_code != 200:
                unsupported[key] = f"http_{r.status_code}"
                out[key] = None
                continue
            try:
                out[key] = parser(r.text)
            except Exception as exc:  # noqa: BLE001 - a malformed answer is reported, not raised
                unsupported[key] = f"unparsable_{type(exc).__name__}"
                out[key] = None
    out["unsupported"] = unsupported
    return out


# ---------------------------------------------------------------- capability facts (T045 / T012, read-only)

def parse_presets(xml: str) -> list[dict[str, object]]:
    """/ISAPI/PTZCtrl/channels/{n}/presets → [{id, name}] (an empty list is a valid answer)."""
    from .xmlsafe import parse

    root = parse(xml)
    out: list[dict[str, object]] = []
    for p in list(root):
        if _local(p.tag) != "PTZPreset":
            continue
        out.append({"id": _text(p, "id"), "name": _text(p, "presetName")})
    return out


def parse_two_way_audio(xml: str, channel: int) -> dict[str, object] | None:
    """/ISAPI/System/TwoWayAudio/channels → the audio channel associated with video input `channel`, or None."""
    from .xmlsafe import parse

    root = parse(xml)
    for ch in list(root):
        if _local(ch.tag) != "TwoWayAudioChannel":
            continue
        assoc = _child(ch, "associateVideoInputs")
        lst = _child(assoc, "videoInputChannelList") if assoc is not None else None
        inputs = [_int((v.text or "").strip(), -1) for v in list(lst)] if lst is not None else []
        if channel in inputs:
            return {"channel_id": _text(ch, "id"), "enabled": _text(ch, "enabled") == "true", "codec": _text(ch, "audioCompressionType") or None}
    return None


def _response_status(xml: str) -> dict[str, str]:
    """Hikvision error bodies (ResponseStatus): statusString + subStatusCode, e.g. 'Invalid Operation' / 'notSupport'."""
    try:
        from .xmlsafe import parse

        root = parse(xml)
        if _local(root.tag) != "ResponseStatus":
            return {}
        return {"status": _text(root, "statusString"), "sub": _text(root, "subStatusCode")}
    except Exception:  # noqa: BLE001
        return {}


def fetch_capabilities(settings: Settings, channel: int) -> dict[str, object]:
    """Three read-only GETs. 'unknown' is an honest answer (the NVR account may not read a capability document);
    'unsupported' only when the device itself says notSupport."""
    out: dict[str, object] = {"ptz": {"state": "unknown", "reason": None, "presets": None, "preset_count": None}, "audio": {"state": "unknown", "reason": None, "channel_id": None, "codec": None}}
    with _client(settings) as client:
        try:
            r = client.get(f"/ISAPI/PTZCtrl/channels/{channel}/capabilities")
        except httpx.HTTPError as exc:
            raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
        ptz = out["ptz"]
        if r.status_code == 200:
            ptz["state"] = "supported"
            ptz["reason"] = "device capability document read"
        else:
            rs = _response_status(r.text)
            if rs.get("sub") == "notSupport":
                ptz["state"] = "unsupported"
                ptz["reason"] = f"device: {rs.get('status') or 'notSupport'} / notSupport"
            elif r.status_code in (401, 403):
                ptz["reason"] = f"forbidden for the NVR account (http {r.status_code}{', ' + rs['sub'] if rs.get('sub') else ''})"
            else:
                ptz["reason"] = f"http {r.status_code}"
        try:
            r = client.get(f"/ISAPI/PTZCtrl/channels/{channel}/presets")
        except httpx.HTTPError as exc:
            raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
        if r.status_code == 200:
            try:
                presets = parse_presets(r.text)
                ptz["presets"] = presets
                ptz["preset_count"] = len(presets)
            except Exception as exc:  # noqa: BLE001
                ptz["presets"] = None
                ptz["reason"] = (ptz["reason"] or "") + f"; presets unparsable ({type(exc).__name__})"
        try:
            r = client.get("/ISAPI/System/TwoWayAudio/channels")
        except httpx.HTTPError as exc:
            raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"error": type(exc).__name__}) from exc
        audio = out["audio"]
        if r.status_code == 200:
            try:
                found = parse_two_way_audio(r.text, channel)
            except Exception as exc:  # noqa: BLE001
                found = None
                audio["reason"] = f"unparsable ({type(exc).__name__})"
            if found is None:
                if audio["reason"] is None:
                    audio["state"] = "unsupported"
                    audio["reason"] = "no two-way audio channel is associated with this video input"
            else:
                audio["channel_id"] = found["channel_id"]
                audio["codec"] = found["codec"]
                audio["state"] = "available" if found["enabled"] else "disabled"
                audio["reason"] = "enabled on the device" if found["enabled"] else "the channel exists but is disabled on the device"
        elif r.status_code in (401, 403):
            audio["reason"] = f"forbidden for the NVR account (http {r.status_code})"
        else:
            audio["reason"] = f"http {r.status_code}"
    return out


# ---------------------------------------------------------------- stream encodings (CR-008 D7, read-only)
#
# Which of a camera's streams a browser can decode over WebRTC. Browsers decode H.264 over WebRTC, but not H.265 (most
# browsers), MJPEG, or H.264 with B-frames. Lab evidence (the read-only NVR probe of 2026-09-14, firmware V4.84, ten
# cameras): seven cameras have an H.264 main stream (N01) with `<SVC><enabled>true` and an H.264 sub stream (N02)
# without SVC; three cameras are H.265 in both streams (SVC on in their mains and in one sub). In the lab WebRTC decoded
# only the sub profile - so H.264 with SVC (temporal scalability) is treated as not WebRTC-safe as well (an inference
# from that correlation, not a proof). The streaming document has no B-frame element on the lab firmware: an element
# whose name says B-frames is read where a device exposes one, and an H.264 Baseline profile has none by definition.
# A reading from a recording track's Description alone never says "plays": the lab's tracks say H.264-BP for all ten
# cameras while the streaming document shows SVC mains and H.265 streams. Anything else is "unknown" - the player then
# simply tries WebRTC.

_BFRAME_TAGS = {"bframe", "bframes", "bframeenabled", "enablebframe", "bframenum", "bframecount", "bframeinterval"}


def _codec_family(raw: str) -> str | None:
    v = (raw or "").strip().upper().replace(" ", "")
    if not v:
        return None
    if "265" in v or "HEVC" in v:
        return "H.265"
    if "264" in v or "AVC" in v:
        return "H.264"
    if "JPEG" in v:
        return "MJPEG"
    return raw.strip()


def _flag(el: ET.Element | None) -> bool | None:
    """`<X><enabled>true</enabled></X>`, `<X>true</X>` or a count (`<BFrameNum>2</BFrameNum>`) → bool; None when absent."""
    if el is None:
        return None
    en = _child(el, "enabled")
    text = ((en.text if en is not None else el.text) or "").strip().lower()
    if text in ("true", "1", "on", "yes", "enable", "enabled"):
        return True
    if text in ("false", "0", "off", "no", "disable", "disabled"):
        return False
    if text.isdigit():
        return int(text) > 0
    return None


def _child_text(el: ET.Element, name: str) -> str:
    c = _child(el, name)
    return (c.text or "").strip() if c is not None else ""


def webrtc_verdict(enc: dict[str, object]) -> tuple[str, str]:
    """(`ok` | `no` | `unknown`, reason) for one stream's encoding."""
    codec = enc.get("codec")
    if not codec:
        return "unknown", "codec_unknown"
    if codec == "H.265":
        return "no", "h265"
    if codec == "MJPEG":
        return "no", "mjpeg"
    if codec != "H.264":
        return "unknown", "codec_other"
    if enc.get("source") != "isapi":
        # a recording track's Description (codecType=H.264-BP) says nothing reliable about the live stream's SVC or
        # B-frames: at most "unknown", never "plays"
        return "unknown", "track_description_only"
    if enc.get("b_frames") is True:
        return "no", "b_frames"
    if enc.get("svc") is True:
        return "no", "svc"
    profile = str(enc.get("profile") or "").lower()
    if enc.get("b_frames") is False or profile.startswith(("baseline", "bp", "constrained")):
        return "ok", "h264_no_b_frames"
    return "ok", "h264"  # the device's own encoding document: H.264, SVC off, no B-frame setting on the device


def _with_verdict(enc: dict[str, object]) -> dict[str, object]:
    verdict, reason = webrtc_verdict(enc)
    return {**enc, "webrtc": verdict, "reason": reason}


def parse_streaming_channel(el: ET.Element) -> tuple[int, dict[str, object]] | None:
    """One `<StreamingChannel>` → (its id, e.g. 101, and the encoding facts of its `<Video>`)."""
    sid = _child_text(el, "id")
    video = _child(el, "Video")
    if not sid.isdigit() or video is None:
        return None
    raw = _child_text(video, "videoCodecType")
    codec = _codec_family(raw)
    width, height = _int(_child_text(video, "videoResolutionWidth")), _int(_child_text(video, "videoResolutionHeight"))
    fps = _int(_child_text(video, "maxFrameRate"))
    profile = _child_text(video, "H264Profile") if codec == "H.264" else _child_text(video, "H265Profile") if codec == "H.265" else ""
    bframes: bool | None = None
    for child in video.iter():
        if _local(child.tag).lower() in _BFRAME_TAGS:
            got = _flag(child)
            if got is not None:
                bframes = got or bool(bframes)
    enc: dict[str, object] = {
        "codec": codec,
        "codec_raw": raw or None,
        "profile": profile or None,
        "b_frames": bframes,
        "svc": _flag(_child(video, "SVC")),
        "smart_codec": _flag(_child(video, "SmartCodec")),
        "resolution": f"{width}x{height}" if width and height else None,
        "fps": round(fps / 100, 2) if fps > 0 else None,  # hundredths (2500 = 25 fps); 0 = the camera's full rate
        "gov_length": _int(_child_text(video, "GovLength")) or None,
        "source": "isapi",
    }
    return int(sid), _with_verdict(enc)


def parse_streaming_channels(xml: str) -> dict[int, dict[str, dict[str, object]]]:
    """`GET /ISAPI/Streaming/channels` → {video input channel: {"main": encoding, "sub": encoding}}: N01 is the main and
    N02 the sub stream, the same numbering as the RTSP paths go2rtc plays (a third stream N03 is ignored)."""
    root = xmlsafe.parse(xml)
    items = [root] if _local(root.tag) == "StreamingChannel" else [el for el in root if _local(el.tag) == "StreamingChannel"]
    out: dict[int, dict[str, dict[str, object]]] = {}
    for el in items:
        parsed = parse_streaming_channel(el)
        if not parsed:
            continue
        sid, enc = parsed
        channel, kind = divmod(sid, 100)
        if channel < 1 or kind not in (1, 2):
            continue
        out.setdefault(channel, {})["main" if kind == 1 else "sub"] = enc
    return out


def encoding_from_track(desc: dict[str, object] | None) -> dict[str, object] | None:
    """Fallback when the streaming document cannot be read: the recording track's Description (`codecType=H.264-BP`)."""
    if not desc or not desc.get("codec"):
        return None
    raw = str(desc["codec"])
    enc: dict[str, object] = {"codec": _codec_family(raw), "codec_raw": raw, "profile": raw.split("-", 1)[1] if "-" in raw else None, "b_frames": None,
                              "svc": None, "smart_codec": None, "resolution": desc.get("resolution"), "fps": desc.get("fps"), "gov_length": None, "source": "track"}
    return _with_verdict(enc)


def fetch_stream_encodings(settings: Settings, timeout: float = 8.0) -> dict[int, dict[str, dict[str, object]]]:
    """One read-only GET of the NVR's streaming channels: codec, profile, SVC, smart codec, B-frames where exposed.
    `timeout`: the setup wizard passes a short one (its whole NVR check has a 20 s budget)."""
    with _client(settings, timeout=timeout) as client:
        xml = _get(client, "/ISAPI/Streaming/channels")
    return parse_streaming_channels(xml)


# ---------------------------------------------------------------- every stream's encoding (CR-020 S1, read-only)
#
# `GET /ISAPI/Streaming/channels` answers a LIST document (StreamingChannelList, v2.0 elements): every encoder output of
# every channel - N01 main, N02 sub, N03 third, ... - with the full <Video> block. The list is the only reading used: on the
# lab firmware a single-channel GET (`/ISAPI/Streaming/channels/101`) lacks the <SVC> element that the list carries, so a
# per-stream read would report "no SVC" for a stream that has it. Strict where it matters (no DOCTYPE, size and count
# caps, text length caps), tolerant where devices differ: an element the device does not send is None and its field is
# listed as unsupported - never a default value.

STREAMING_DOC_MAX_BYTES = 2_000_000  # the lab's ten-camera list is about 60 KB; a larger answer is not a streaming list
MAX_STREAMING_ELEMENTS = 256  # StreamingChannel elements read from one document (16 channels x 4 streams is the realistic ceiling)
_TEXT_CAP = 64
ENCODING_FIELDS = ("codec", "profile", "resolution", "fps", "bitrate_mode", "bitrate_kbps", "quality", "gop", "svc", "smart_codec", "b_frames")


def _get_capped(client: httpx.Client, path: str, max_bytes: int) -> str:
    """A read-only GET whose body is read at most `max_bytes` (an answer over the cap is refused, not truncated)."""
    try:
        with client.stream("GET", path) as r:
            if r.status_code in (401, 403):
                raise ApiError(503, "source_forbidden", "ה־NVR דחה את פרטי הגישה.", details={"path": path, "status": r.status_code})
            if r.status_code != 200:
                raise ApiError(503, "source_error", "ה־NVR החזיר שגיאה.", retryable=True, details={"path": path, "status": r.status_code})
            declared = r.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                raise ApiError(503, "source_too_large", "תשובת ה־NVR גדולה מהצפוי.", details={"path": path})
            body = bytearray()
            for chunk in r.iter_bytes(64 * 1024):
                body.extend(chunk)
                if len(body) > max_bytes:
                    raise ApiError(503, "source_too_large", "תשובת ה־NVR גדולה מהצפוי.", details={"path": path})
            return bytes(body).decode(r.encoding or "utf-8", "replace")
    except httpx.HTTPError as exc:
        raise ApiError(503, "source_unavailable", "ה־NVR אינו זמין כרגע.", retryable=True, details={"path": path, "error": type(exc).__name__}) from exc


def fetch_streaming_document(settings: Settings, timeout: float = 8.0, max_bytes: int = STREAMING_DOC_MAX_BYTES) -> str:
    """The raw streaming list (one read-only GET, size-capped)."""
    with _client(settings, timeout=timeout) as client:
        return _get_capped(client, "/ISAPI/Streaming/channels", max_bytes)


def _opt_int(video: ET.Element, name: str) -> int | None:
    m = re.match(r"\s*(-?\d+)", _child_text(video, name))
    return int(m.group(1)) if m else None


def _stream_etag(el: ET.Element) -> str:
    import hashlib

    raw = ET.tostring(el, encoding="unicode")
    return hashlib.sha256(re.sub(r">\s+<", "><", raw).strip().encode("utf-8")).hexdigest()[:16]


def stream_role(stream_ref: int) -> str:
    """Hikvision: id N01 is the main stream, N02 the sub stream, N03 the third, N04 and higher are others."""
    kind = stream_ref % 100
    return "main" if kind == 1 else "sub" if kind == 2 else "third" if kind == 3 else "other"


def _unsupported(video: ET.Element, enc: dict[str, object]) -> dict[str, dict[str, bool]]:
    """The fields the device document does not carry at all (`fields.<name>.supported:false`); anything not listed is supported."""
    names = {_local(c.tag) for c in video.iter()}
    present = {
        "codec": "videoCodecType" in names,
        "profile": bool(names & {"H264Profile", "H265Profile"}),
        "resolution": {"videoResolutionWidth", "videoResolutionHeight"} <= names,
        "fps": "maxFrameRate" in names,
        "bitrate_mode": "videoQualityControlType" in names,
        "bitrate_kbps": bool(names & {"constantBitRate", "vbrUpperCap"}),
        "quality": "fixedQuality" in names,
        "gop": "GovLength" in names,
        "svc": "SVC" in names,
        "smart_codec": "SmartCodec" in names,
        "b_frames": enc.get("b_frames") is not None,
    }
    return {f: {"supported": False, "editable": False} for f in ENCODING_FIELDS if not present[f]}


def parse_streaming_channels_all(xml: str | bytes, max_streams: int = MAX_STREAMING_ELEMENTS) -> list[dict[str, object]]:
    """`GET /ISAPI/Streaming/channels` -> one dict per stream the device lists, in document order.

    Keys: `stream_ref` ("101"), `channel` (the video input, 1), `role`, `enabled`, `codec` (H.264 / H.265 / MJPEG / raw),
    `codec_raw`, `codec_plus` (the vendor's "+" variants H.264+ / H.265+, i.e. smart codec on), `profile`, `resolution`
    ("2560x1440"), `fps` (None with `fps_full` True when the device says 0), `bitrate_mode`, `bitrate_kbps`, `quality`,
    `gop`, `svc`, `smart_codec`, `b_frames`, `webrtc` / `webrtc_reason` (webrtc_verdict, unchanged), `fields` (only the
    unsupported ones) and `etag`. An element that is absent is None. A stream without a <Video> block is skipped.
    Raises ET.ParseError (incl. xmlsafe.UnsafeXml) for a document that is not XML or carries a DOCTYPE."""
    root = xmlsafe.parse(xml)
    items = [root] if _local(root.tag) == "StreamingChannel" else [el for el in root if _local(el.tag) == "StreamingChannel"]
    out: list[dict[str, object]] = []
    for el in items[:max_streams]:
        sid = _child_text(el, "id")
        video = _child(el, "Video")
        if not sid.isdigit() or len(sid) > 6 or video is None:
            continue
        parsed = parse_streaming_channel(el)
        if parsed is None:
            continue
        ref, base = parsed
        raw = _child_text(video, "videoCodecType")[:_TEXT_CAP]
        mode_raw = _child_text(video, "videoQualityControlType").upper()[:_TEXT_CAP]
        mode = mode_raw if mode_raw in ("CBR", "VBR") else None
        cbr, vbr = _opt_int(video, "constantBitRate"), _opt_int(video, "vbrUpperCap")
        bitrate = cbr if mode == "CBR" else vbr if mode == "VBR" else (cbr if cbr is not None else vbr)
        width, height = _opt_int(video, "videoResolutionWidth"), _opt_int(video, "videoResolutionHeight")
        rate = _opt_int(video, "maxFrameRate")
        smart = base.get("smart_codec")
        enc: dict[str, object] = {
            "stream_ref": sid,
            "channel": ref // 100,
            "role": stream_role(ref),
            "enabled": _flag(_child(el, "enabled")),
            "codec": base["codec"],
            "codec_raw": raw or None,
            "codec_plus": (raw.endswith("+") or smart is True) if raw else None,
            "profile": str(base["profile"])[:_TEXT_CAP] if base.get("profile") else None,
            "resolution": f"{width}x{height}" if width and height else None,
            "fps": round(rate / 100, 2) if rate and rate > 0 else None,
            "fps_full": rate == 0,
            "bitrate_mode": mode,
            "bitrate_kbps": bitrate if bitrate and bitrate > 0 else None,
            "quality": _opt_int(video, "fixedQuality"),
            "gop": _opt_int(video, "GovLength") or None,
            "svc": base.get("svc"),
            "smart_codec": smart,
            "b_frames": base.get("b_frames"),
            "webrtc": base["webrtc"],
            "webrtc_reason": base["reason"],
        }
        enc["fields"] = _unsupported(video, enc)
        enc["etag"] = _stream_etag(el)
        out.append(enc)
    return out

