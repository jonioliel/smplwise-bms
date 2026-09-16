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


def _client(settings: Settings) -> httpx.Client:
    if not settings.nvr_host or not settings.nvr_user or not settings.nvr_password:
        raise ApiError(503, "source_not_configured", "פרטי ה־NVR לא הוגדרו בהגדרות ה־Add-on.")
    return httpx.Client(
        base_url=f"http://{settings.nvr_host}:{settings.nvr_http_port}",
        auth=httpx.DigestAuth(settings.nvr_user, settings.nvr_password),
        timeout=8.0,
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

