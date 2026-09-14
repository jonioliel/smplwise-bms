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
    root = ET.fromstring(xml)
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
    root = ET.fromstring(xml)
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
        for el in ET.fromstring(status_xml).iter():
            if _local(el.tag) == "InputProxyChannelStatus":
                cid = _text(el, "id")
                if cid.isdigit():
                    online[int(cid)] = _text(el, "online").lower() == "true"

    # Track ids come from the device (Track/id with SrcDescriptor/SrcChannel), never computed as
    # channel*100+1 (T013). Lab firmware V4.84: <Channel> repeats the track id; <SrcChannel> is the input.
    tracks: dict[int, list[tuple[int, dict[str, object]]]] = {}
    if tracks_xml:
        for el in ET.fromstring(tracks_xml).iter():
            if _local(el.tag) == "Track":
                tid = _text(el, "id")
                ch = _text(el, "SrcChannel")
                if tid.isdigit() and ch.isdigit():
                    tracks.setdefault(int(ch), []).append((int(tid), parse_track_description(_text(el, "Description"))))

    result: list[DiscoveredChannel] = []
    for el in ET.fromstring(channels_xml).iter():
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
