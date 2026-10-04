"""Provision-ISR HTTP API v1 documents -> normalized Python values (CR-025 P1; docs/integrations/provision-isr/API_STUDY.md).

Pure functions, no device I/O. Every document is XML in the `http://www.ipc.com/ver10` namespace, rooted at `<config>`; the
namespace is ignored (matched by local name) because firmwares differ in where they put it. Rules kept from the Hikvision
parsers (`services/nvr.py`):
- `xmlsafe.parse` only (a DOCTYPE / ENTITY is refused);
- tolerant where devices differ (an element the device does not send is None, never a default value), strict where it
  matters (text length caps, numeric fields validated, list sizes capped);
- secrets stay out: serial number, MAC, IP addresses and user names in device documents are never returned.

Shapes are taken from the vendor's v1 guide (Version 1.9, 2025-08) and the v1 Postman collection examples (26.6); see the
study for the quirks (for example `GetChannelList` puts its `<item>` elements next to an empty `<channelIDList/>`)."""
from __future__ import annotations

import hashlib
import re
import xml.etree.ElementTree as ET
from typing import Any

from .. import xmlsafe

TEXT_CAP = 64
MAX_ITEMS = 512  # list entries read from one document (channels, streams, alarm items)
_RES = re.compile(r"^\d{2,5}x\d{2,5}$")
SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]{1,32}$")  # a stream name that may go into an RTSP path


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def child(el: ET.Element | None, name: str) -> ET.Element | None:
    if el is None:
        return None
    for c in el:
        if _local(c.tag) == name:
            return c
    return None


def children(el: ET.Element | None, name: str) -> list[ET.Element]:
    return [] if el is None else [c for c in el if _local(c.tag) == name][:MAX_ITEMS]


def text(el: ET.Element | None, name: str | None = None, cap: int = TEXT_CAP) -> str | None:
    """Stripped text of `el` (or of its direct child `name`), CDATA included; None when absent or empty."""
    node = el if name is None else child(el, name)
    if node is None or node.text is None:
        return None
    value = node.text.strip()
    return value[:cap] if value else None


def to_int(value: str | None) -> int | None:
    if value is None:
        return None
    m = re.fullmatch(r"\s*(-?\d{1,12})\s*", value)
    return int(m.group(1)) if m else None


def to_bool(value: str | None) -> bool | None:
    v = (value or "").strip().lower()
    if v in ("true", "1"):
        return True
    if v in ("false", "0"):
        return False
    return None


def parse(xml: str | bytes) -> ET.Element:
    """Raises ET.ParseError (xmlsafe.UnsafeXml included) for a document that is not XML or carries a DOCTYPE."""
    return xmlsafe.parse(xml)


# ------------------------------------------------------------------------------------------------ the result envelope

def response_status(xml: str | bytes) -> tuple[str | None, int | None, str | None]:
    """`<config status="failed" errorCode="3" errorDesc="..."/>` -> ("failed", 3, desc). (None, None, None) for a document
    that is not a status answer (a data answer) or not XML."""
    try:
        root = parse(xml)
    except ET.ParseError:
        return None, None, None
    status = root.attrib.get("status")
    code = to_int(root.attrib.get("errorCode"))
    desc = (root.attrib.get("errorDesc") or "")[:TEXT_CAP] or None
    return status, code, desc


# v1 guide 1.3.6 (codes 1-5) plus the v2 table for codes a v1-named command may still return on newer firmware
ERROR_CODES: dict[int, str] = {
    1: "invalid_request",  # the command / channel / action is not supported by this device
    2: "invalid_xml_format",
    3: "invalid_xml_content",
    4: "permission_denied",
    5: "network_limit",
    7: "system_busy",
    9: "unauthorized",
    10: "user_locked",
    11: "unsupported_function",
    12: "channel_error",
    17: "service_not_enabled",
}


# ------------------------------------------------------------------------------------------------ system

def parse_device_info(xml: str | bytes) -> dict[str, Any]:
    """`GetDeviceInfo`. Keys: model, brand, firmware, build_date, hardware, api_version, device_description, chl_max_count,
    kind ("nvr" | "ipc"), alarm_in_count, alarm_out_count, support_long_polling, support_https, support_http_post,
    integrated_ptz. Never the serial number, MAC, UUID or customer administrator name."""
    root = parse(xml)
    info = child(root, "deviceInfo")
    if info is None:
        raise ET.ParseError("not a deviceInfo document")
    chl_max = to_int(text(info, "chlMaxCount"))
    description = text(info, "deviceDescription")
    # v1 guide 2.1.3 tip: a device whose description is "IPCamera" is a camera; the description is user-editable on newer
    # firmware (Postman example: "Street Counting"), so the channel count decides when the description is anything else.
    if description == "IPCamera":
        kind = "ipc"
    else:
        kind = "nvr" if (chl_max or 1) > 1 else "ipc"
    return {
        "model": text(info, "model"),
        "brand": text(info, "brand"),
        "firmware": text(info, "softwareVersion"),
        "build_date": text(info, "softwareBuildDate"),
        "hardware": text(info, "hardwareVersion"),
        "api_version": text(info, "apiVersion"),
        "device_description": description,
        "chl_max_count": chl_max,
        "kind": kind,
        "alarm_in_count": to_int(text(info, "alarmInCount")),
        "alarm_out_count": to_int(text(info, "alarmOutCount")),
        "support_long_polling": to_bool(text(info, "supportAPILongPolling")),
        "support_https": to_bool(text(info, "supportHttps")),
        "support_http_post": to_bool(text(info, "SupportHttpPost")),
        "integrated_ptz": to_bool(text(info, "integratedPtz")),
        # every support* flag the device states (lower-case names), e.g. smart analytics it offers
        "support": {_local(c.tag).lower()[:48]: v for c in list(info)[:MAX_ITEMS] if _local(c.tag).lower().startswith("support")
                    and (v := to_bool(c.text)) is not None},
    }


CHANNEL_ONLINE = {"online": True, "videoOn": True, "offline": False, "videoLoss": False}


def parse_channel_list(xml: str | bytes) -> list[tuple[int, str | None]]:
    """`GetChannelList` (NVR only) -> [(channel, status)] in document order. The guide's example closes `<channelIDList/>`
    empty and puts the `<item channelStatus="online">1</item>` elements after it; a firmware that nests them inside the
    list is read the same way. Duplicates are dropped."""
    return [(ch, st) for ch, st, _name in parse_channel_list_named(xml)]


def parse_channel_list_named(xml: str | bytes) -> list[tuple[int, str | None, str | None]]:
    """As parse_channel_list, plus the channel name: the owner's NVR (firmware 1.4.7, live 2026-10-04) puts it in a
    `name` attribute of each item (not in the guide); None when absent."""
    root = parse(xml)
    out: list[tuple[int, str | None, str | None]] = []
    seen: set[int] = set()
    for el in root.iter():
        if _local(el.tag) != "item":
            continue
        ch = to_int(el.text)
        if ch is None or ch < 1 or ch > 4096 or ch in seen:
            continue
        seen.add(ch)
        status = el.attrib.get("channelStatus")
        name = (el.attrib.get("name") or "").strip()[:TEXT_CAP] or None
        out.append((ch, status[:16] if status else None, name))
        if len(out) >= MAX_ITEMS:
            break
    return out


def parse_osd_channel_name(xml: str | bytes) -> str | None:
    """`GetImageOsdConfig/{ch}` -> the channel name the device shows (`imageOsd/channelName/name`), the only place v1 names
    a channel. None when the device sends none."""
    root = parse(xml)
    name_el = child(child(child(root, "imageOsd"), "channelName"), "name")
    return text(name_el)


def parse_port_config(xml: str | bytes) -> dict[str, Any]:
    root = parse(xml)
    port = child(root, "port")
    if port is None:
        raise ET.ParseError("not a port document")
    return {
        "http": to_int(text(port, "httpPort")),
        "https": to_int(text(port, "httpsPort")),
        "rtsp": to_int(text(port, "rtspPort")),
        "net": to_int(text(port, "netPort")),
        "long_polling": to_int(text(port, "longPollingPort")),
        "long_polling_enabled": to_bool(text(port, "enablelongPollingHttp")),
        "ws": to_int(text(port, "wsPort")),
    }


def parse_date_time(xml: str | bytes) -> dict[str, Any]:
    """`GetDateAndTime` -> device wall clock (raw string, local time, no offset), POSIX time-zone string, sync mode."""
    root = parse(xml)
    t = child(root, "time")
    if t is None:
        raise ET.ParseError("not a time document")
    zone = child(t, "timezoneInfo")
    sync = child(t, "synchronizeInfo")
    return {
        "current_time": text(sync, "currentTime"),
        "time_zone": text(zone, "timeZone", cap=127),
        "sync": text(sync, "type"),
        "ntp_interval_min": to_int(text(sync, "ntpSyncInterval")),
    }


def parse_disk_info(xml: str | bytes) -> list[dict[str, Any]]:
    """`GetDiskInfo` -> [{total_mb, free_mb, status}]; an empty list when the device has no disk."""
    root = parse(xml)
    out = []
    for item in children(child(root, "diskInfo"), "item"):
        out.append({"total_mb": to_int(text(item, "totalSpace")), "free_mb": to_int(text(item, "freeSpace")),
                    "status": text(item, "diskStatus")})
    return out


def parse_record_status(xml: str | bytes) -> dict[int, dict[str, Any]]:
    """`GetRecordStatusInfo` -> {channel: {state, stream_type, record_types}} (the item's `id` is the channel id)."""
    root = parse(xml)
    out: dict[int, dict[str, Any]] = {}
    rank = {"recording": 2, "exception": 1, "norecording": 0}
    for item in children(child(root, "recordStatusList"), "item"):
        ch = to_int(item.attrib.get("id"))
        if ch is None:
            continue
        state = (text(item) or "").replace(" ", "").lower() or None  # live firmware writes "no recording"
        kinds = [k for k in re.split(r"[,\s]+", (item.attrib.get("recordTypes") or "")[:TEXT_CAP]) if k]
        stype = item.attrib.get("streamType") or None
        cur = out.setdefault(ch, {"state": state, "stream_type": None, "streams": [], "record_types": []})
        if rank.get(state or "", -1) > rank.get(cur["state"] or "", -1):
            cur["state"] = state
        if stype and state == "recording":
            cur["streams"].append(stype[:8])
            cur["stream_type"] = cur["stream_type"] or stype[:8]
        cur["record_types"] = sorted(set(cur["record_types"]) | set(kinds))
    return out


# ------------------------------------------------------------------------------------------------ streams

def stream_ref(channel: int, stream_id: int) -> str:
    """Arx stream key: the Hikvision-shaped number `<channel><id:02>` ("101" = channel 1 main), so the digit-only
    validators of the existing routes keep working."""
    return f"{channel}{stream_id:02d}"


def split_stream_ref(ref: str) -> tuple[int, int]:
    if not re.fullmatch(r"\d{3,6}", ref or ""):
        raise ValueError("stream_ref")
    channel, sid = divmod(int(ref), 100)
    if channel < 1 or sid < 1:
        raise ValueError("stream_ref")
    return channel, sid


def stream_role(stream_id: int) -> str:
    return "main" if stream_id == 1 else "sub" if stream_id == 2 else "third" if stream_id == 3 else "other"


# encodeType -> (codec family, smart codec on, "+" variant)
_CODECS: dict[str, tuple[str, bool | None, bool | None]] = {
    "h264": ("H.264", False, False), "h264plus": ("H.264", True, True), "h264smart": ("H.264", True, False),
    "h265": ("H.265", False, False), "h265plus": ("H.265", True, True), "h265smart": ("H.265", True, False),
    "mjpeg": ("MJPEG", None, None),
}
_PROFILES = {"baseline": "baseline", "mainprofile": "main", "highprofile": "high"}
ENCODING_FIELDS = ("codec", "profile", "resolution", "fps", "bitrate_mode", "bitrate_kbps", "quality", "gop", "smart_codec")
_ALL_FIELDS = ("codec", "profile", "resolution", "fps", "bitrate_mode", "bitrate_kbps", "quality", "gop", "svc", "smart_codec", "b_frames")


def webrtc_verdict(codec: str | None, profile: str | None) -> tuple[str, str]:
    """Same vocabulary as `nvr.webrtc_verdict`. v1 does not say whether a stream uses B-frames, so only an H.264 Baseline
    stream (no B-frames by definition) is `ok`; Main / High stay `unknown` until a real unit is measured."""
    if not codec:
        return "unknown", "codec_unknown"
    if codec == "MJPEG":
        return "no", "mjpeg"
    if codec == "H.265":
        return "unknown", "h265"
    if codec != "H.264":
        return "unknown", "codec_other"
    if profile == "baseline":
        return "ok", "h264_no_b_frames"
    return "unknown", "b_frames_unknown"


def _bounds(el: ET.Element | None) -> dict[str, int] | None:
    if el is None:
        return None
    lo, hi = to_int(el.attrib.get("min")), to_int(el.attrib.get("max"))
    return {"min": lo, "max": hi} if lo is not None and hi is not None else None


def item_etag(item: ET.Element) -> str:
    raw = ET.tostring(item, encoding="unicode")
    return hashlib.sha256(re.sub(r">\s+<", "><", raw).strip().encode("utf-8")).hexdigest()[:16]


QUALITY_WORDS = ("lowest", "lower", "medium", "higher", "highest")  # v1 enum; Arx carries 1..5 (the shared write route takes an int)
_LEVEL_WORDS = {"baseline": "baseLine", "main": "mainProfile", "high": "highProfile"}


def stream_url_path(value: str | None) -> str | None:
    """`rtsp://<host>:554/chID=1&streamType=main` (the live NVR's streamName / name) -> `/chID=1&streamType=main`. Only a
    strict alphabet passes (the path goes into the URL go2rtc pulls); None for anything else."""
    if not value or "://" not in value:
        return None
    m = re.match(r"^rtsp://[^/]+(/[A-Za-z0-9._=&/?-]{1,96})$", value.strip())
    return m.group(1) if m else None


def parse_stream_item(item: ET.Element, channel: int, number: int | None = None) -> dict[str, Any] | None:
    """One `<streams><item id="n">` -> the normalized dict of `parse_video_stream_config` (None for an item without id).
    `stream_id` is the device's own id (0-based on the live NVR, 1-based in the guide), `stream_no` the 1-based position
    that names the stream in Arx (`stream_ref`, role)."""
    sid = to_int(item.attrib.get("id"))
    if sid is None or not 0 <= sid <= 99:
        return None
    no = number if number is not None else max(sid, 1)
    raw = (text(item, "encodeType") or "")
    codec, smart, plus = _CODECS.get(raw.lower(), (raw or None, None, None))
    level = text(item, "encodeLevel")
    profile = _PROFILES.get((level or "").lower(), level.lower() if level else None)
    if codec == "MJPEG":
        profile = None
    res = text(item, "resolution")
    fps = to_int(text(item, "frameRate"))
    mode = (text(item, "bitRateType") or "").upper()
    rate = to_int(text(item, "maxBitRate"))
    gop = to_int(text(item, "GOP"))
    qword = text(item, "quality", cap=16)
    raw_name = text(item, "name", cap=160)
    enc: dict[str, Any] = {
        "stream_ref": stream_ref(channel, no), "stream_id": sid, "stream_no": no, "channel": channel, "role": stream_role(no),
        # the live NVR's `name` is the stream's RTSP URL with the device address: never kept as a name
        "name": raw_name if raw_name and SAFE_NAME.match(raw_name) else None,
        "url_path": stream_url_path(raw_name),
        "codec": codec, "codec_raw": raw or None, "codec_plus": plus, "profile": profile,
        "resolution": res if res and _RES.match(res) else None,
        "fps": float(fps) if fps and fps > 0 else None, "fps_full": False,
        "bitrate_mode": mode if mode in ("CBR", "VBR") else None,
        "bitrate_kbps": rate if rate and rate > 0 else None,
        "quality": QUALITY_WORDS.index(qword) + 1 if qword in QUALITY_WORDS else None,
        "quality_raw": qword,
        "gop": gop if gop and gop > 0 else None,
        "svc": None, "smart_codec": smart, "b_frames": None,
    }
    enc["webrtc"], enc["webrtc_reason"] = webrtc_verdict(enc["codec"], enc["profile"])
    enc["limits"] = {
        "bitrate_list": [v for v in (to_int(text(i)) for i in children(child(item, "bitRateLists"), "item")) if v],
        "bitrate": _bounds(child(item, "maxBitRate")),
        "gop": _bounds(child(item, "GOP")),
        "codecs": [t for t in (text(i, cap=16) for i in children(child(item, "encodeTypeCaps"), "item")) if t],
    }
    present = {
        "codec": enc["codec"] is not None, "profile": level is not None, "resolution": enc["resolution"] is not None,
        "fps": fps is not None, "bitrate_mode": enc["bitrate_mode"] is not None, "bitrate_kbps": rate is not None,
        "quality": enc["quality"] is not None, "gop": gop is not None, "svc": False,
        "smart_codec": smart is not None, "b_frames": False,
    }
    enc["fields"] = {f: {"supported": False, "editable": False} for f in _ALL_FIELDS if not present[f]}
    enc["etag"] = item_etag(item)
    enc["element"] = ET.tostring(item, encoding="unicode")
    return enc


def parse_element(element: str, channel: int = 0) -> dict[str, Any]:
    """A stored item text (change log `before_xml` / `after_xml`) -> its parsed fields. Raises ET.ParseError."""
    item = parse(element)
    if _local(item.tag) != "item":
        raise ET.ParseError("not a stream item")
    got = parse_stream_item(item, channel or 1)
    if got is None:
        raise ET.ParseError("stream item without id")
    return got


def _encode_type(codec: str | None, smart: bool | None, allowed: list[str]) -> str:
    """(codec family, smart codec on) -> the device token, from the tokens this stream lists (any known token when the
    stream lists none, e.g. v2 firmware that moved the list to GetStreamCaps)."""
    if codec == "MJPEG":
        options = ["mjpeg"]
    elif codec in ("H.264", "H.265"):
        base = "h264" if codec == "H.264" else "h265"
        options = [base + "plus", base + "smart"] if smart else [base]
    else:
        raise ValueError("codec")
    pool = [a.lower() for a in allowed] if allowed else list(_CODECS)
    for token in options:
        if token in pool:
            return token
    raise ValueError("codec")


WRITE_TAGS = ("name", "resolution", "frameRate", "bitRateType", "maxBitRate", "encodeType", "encodeLevel", "quality", "GOP")


def edited_item(element: str, changes: dict[str, Any]) -> str:
    """The stream item with `changes` applied, written the way SetVideoStreamConfig wants it (guide 3.3.4: the Get element
    WITHOUT attributes): `<item id="n">` with the scalar fields only. Every value is validated (int, enum or the strict
    resolution pattern) - nothing free-form reaches the device. Raises ValueError(field) for a value it cannot write."""
    item = parse(element)
    cur = parse_stream_item(item, 1)
    if cur is None:
        raise ValueError("stream_ref")
    values: dict[str, str] = {}
    for tag in WRITE_TAGS:
        t = text(item, tag, cap=64)
        if t is not None:
            values[tag] = t
    if "codec" in changes or "smart_codec" in changes:
        codec = changes.get("codec", cur["codec"])
        smart = changes.get("smart_codec", cur["smart_codec"])
        if codec == "MJPEG":
            smart = None
        values["encodeType"] = _encode_type(codec, bool(smart), cur["limits"]["codecs"])
        if codec == "MJPEG":
            values.pop("encodeLevel", None)
    if "profile" in changes:
        word = _LEVEL_WORDS.get(str(changes["profile"]))
        if word is None:
            raise ValueError("profile")
        values["encodeLevel"] = word
    if "resolution" in changes:
        if not isinstance(changes["resolution"], str) or not _RES.match(changes["resolution"]):
            raise ValueError("resolution")
        values["resolution"] = changes["resolution"]
    if "fps" in changes:
        v = changes["fps"]
        if v == "full" or not isinstance(v, (int, float)) or isinstance(v, bool) or not 1 <= v <= 240 or int(v) != v:
            raise ValueError("fps")
        values["frameRate"] = str(int(v))
    if "bitrate_mode" in changes:
        if changes["bitrate_mode"] not in ("CBR", "VBR"):
            raise ValueError("bitrate_mode")
        values["bitRateType"] = changes["bitrate_mode"]
    if "bitrate_kbps" in changes:
        v = changes["bitrate_kbps"]
        if not isinstance(v, int) or isinstance(v, bool) or not 16 <= v <= 100_000:
            raise ValueError("bitrate_kbps")
        values["maxBitRate"] = str(v)
    if "quality" in changes:
        v = changes["quality"]
        if not isinstance(v, int) or isinstance(v, bool) or not 1 <= v <= len(QUALITY_WORDS):
            raise ValueError("quality")
        values["quality"] = QUALITY_WORDS[v - 1]
    if "gop" in changes:
        v = changes["gop"]
        if not isinstance(v, int) or isinstance(v, bool) or not 1 <= v <= 10_000:
            raise ValueError("gop")
        values["GOP"] = str(v)
    for name in ("svc", "b_frames"):
        if name in changes:
            raise ValueError(name)
    if "name" in values and not SAFE_NAME.match(values["name"]):
        values.pop("name")  # never echo a device string we cannot vouch for; the device keeps its name
    body = "".join(f"<{tag}>{values[tag]}</{tag}>" for tag in WRITE_TAGS if tag in values)
    return f'<item id="{cur["stream_id"]}">{body}</item>'


def plain_item(item: ET.Element) -> str:
    """A sibling stream re-sent unchanged (attributes and capability lists dropped, scalar fields kept verbatim)."""
    sid = to_int(item.attrib.get("id")) or 0
    parts = []
    for tag in WRITE_TAGS:
        t = text(item, tag, cap=64)
        if t is not None and (tag != "name" or SAFE_NAME.match(t)):
            parts.append(f"<{tag}>{t}</{tag}>")
    return f'<item id="{sid}">{"".join(parts)}</item>'


def set_streams_document(get_xml: str | bytes, replacement: str) -> str:
    """SetVideoStreamConfig body: every stream of the channel from the current Get answer, the target replaced."""
    root = parse(get_xml)
    new = parse(replacement)
    target = to_int(new.attrib.get("id"))
    items = children(child(root, "streams"), "item")
    if target is None or not any(to_int(i.attrib.get("id")) == target for i in items):
        raise ValueError("stream_ref")
    body = "".join(replacement if to_int(i.attrib.get("id")) == target else plain_item(i) for i in items)
    return ('<?xml version="1.0" encoding="UTF-8"?><config version="1.0" xmlns="http://www.ipc.com/ver10">'
            f"<streams>{body}</streams></config>")  # guide 3.3.4: no attributes on the streams element


def parse_video_stream_config(xml: str | bytes, channel: int) -> list[dict[str, Any]]:
    """`GetVideoStreamConfig/{ch}` -> one dict per stream: `stream_ref`, `stream_id`, `channel`, `role`, `name`, the
    normalized encoding (`codec`, `codec_raw`, `codec_plus`, `profile`, `resolution`, `fps`, `bitrate_mode`, `bitrate_kbps`,
    `quality` 1..5 (lowest..highest; the vendor word in `quality_raw`), `gop` (frames), `svc` None, `smart_codec`, `b_frames` None), `webrtc` /
    `webrtc_reason`, `limits` (bitrate list, bitrate / GOP bounds, codec choices the device lists for this stream),
    `fields` (only the unsupported ones), `etag` and `element` (the item as text, for the change log of P2)."""
    root = parse(xml)
    out: list[dict[str, Any]] = []
    items = [(to_int(i.attrib.get("id")), i) for i in children(child(root, "streams"), "item")]
    items = sorted([(sid, i) for sid, i in items if sid is not None and 0 <= sid <= 99], key=lambda x: x[0])
    for no, (_sid, item) in enumerate(items, start=1):
        enc = parse_stream_item(item, channel, no)
        if enc is not None:
            out.append(enc)
    return out


def parse_stream_caps(xml: str | bytes) -> dict[str, Any]:
    """`GetStreamCaps/{ch}` -> {"rtsp_port", "streams": {id: {"name", "resolutions": [{"resolution", "max_fps"}], "codecs",
    "profiles"}}}. The stream name is what an IPC's RTSP path uses (`rtsp://host:port/<streamName>`)."""
    root = parse(xml)
    streams: dict[int, dict[str, Any]] = {}
    top_levels = [t for t in (text(e, cap=16) for e in children(child(root, "encodeLevelCaps"), "enum")) if t]
    found = [(to_int(i.attrib.get("id")), i) for i in children(child(root, "streamList"), "item")]
    found = sorted([(sid, i) for sid, i in found if sid is not None and 0 <= sid <= 99], key=lambda x: x[0])
    for no, (sid, item) in enumerate(found, start=1):
        raw_name = text(item, "streamName", cap=160)
        name = raw_name
        resolutions = []
        for r in children(child(item, "resolutionCaps"), "item"):
            value = text(r)
            if value and _RES.match(value):
                resolutions.append({"resolution": value, "max_fps": to_int(r.attrib.get("maxFrameRate"))})
        levels = [t for t in (text(i, cap=16) for i in children(child(item, "encodeLevelCaps"), "item")) if t] or top_levels
        streams[no] = {
            "device_id": sid,
            "name": name if name and SAFE_NAME.match(name) else None,
            "url_path": stream_url_path(raw_name),
            "resolutions": resolutions,
            "codecs": [t for t in (text(i, cap=16) for i in children(child(item, "encodeTypeCaps"), "item")) if t],
            "profiles": [_PROFILES.get(t.lower(), t) for t in levels],
        }
    return {"rtsp_port": to_int(text(root, "rtspPort")), "streams": streams}


# ------------------------------------------------------------------------------------------------ alarms / events

def parse_alarm_status_info(info: ET.Element | None) -> dict[tuple[str, int | None], bool]:
    """An `<alarmStatusInfo>` element -> {(kind, id): active}. Reads both shapes: v1 `<motionAlarm type="boolean" id="2">
    true</motionAlarm>` (one element per id, or none) and lists `<sensorAlarmIn><item id="1">false</item></sensorAlarmIn>`
    (also how v2 firmware writes every kind). Kinds are the device's element names; unknown kinds are kept."""
    out: dict[tuple[str, int | None], bool] = {}
    if info is None:
        return out
    for el in list(info)[:MAX_ITEMS]:
        kind = _local(el.tag)[:32]
        items = [i for i in el if _local(i.tag) == "item"]
        if items:
            for i in items[:MAX_ITEMS]:
                state = to_bool(i.text)
                if state is not None:
                    out[(kind, to_int(i.attrib.get("id")))] = state
            continue
        state = to_bool(el.text)
        if state is not None:
            out[(kind, to_int(el.attrib.get("id")))] = state
    return out


def parse_alarm_status(xml: str | bytes) -> dict[tuple[str, int | None], bool]:
    """`GetAlarmStatus` (short polling)."""
    root = parse(xml)
    info = child(root, "alarmStatusInfo")
    if info is None:
        raise ET.ParseError("not an alarm status document")
    return parse_alarm_status_info(info)


def parse_subscribe(xml: str | bytes) -> dict[str, Any]:
    """`SetSubscribe` answer (long polling): the subscription handle `serverAddress` (an opaque URL-like string the
    later SetRenew / GetPullMessages / SetUnSubscribe name), the device's epoch `currentTime` / `terminationTime` and
    the pull `timeout` (seconds)."""
    root = parse(xml)
    address = text(root, "serverAddress", cap=256)
    if not address:
        raise ET.ParseError("not a subscribe answer")
    return {"server_address": address, "current_time": to_int(text(root, "currentTime")),
            "termination_time": to_int(text(root, "terminationTime")), "timeout": to_int(text(root, "timeout"))}


def parse_pull_messages(xml: str | bytes) -> dict[str, Any]:
    """`GetPullMessages` answer -> {"termination_time", "messages": [{"status": {(kind, id): bool}, "data_time": str}]}.
    The device identity block of each item (name, number, serial, IP, MAC) is dropped."""
    root = parse(xml)
    messages = []
    for item in children(child(root, "alarmInfoList"), "item"):
        messages.append({"status": parse_alarm_status_info(child(item, "alarmStatusInfo")), "data_time": text(item, "dataTime")})
    return {"termination_time": to_int(text(root, "terminationTime")), "messages": messages}


# ------------------------------------------------------------------------------------------------ device push

def parse_alarm_server(xml: str | bytes, raw_address: bool = False) -> dict[str, Any]:
    """`GetAlarmServerConfig` -> {configured, port, heartbeat, heartbeat_s} (+ `address` only for the verify step after our
    own write; never returned to a client)."""
    root = parse(xml)
    srv = child(root, "alarmServer")
    if srv is None:
        raise ET.ParseError("not an alarm server document")
    address = text(srv, "serverAddr", cap=255)
    out: dict[str, Any] = {"configured": bool(address), "port": to_int(text(srv, "serverPort")),
                           "heartbeat": to_bool(text(srv, "enableHeartbeat")), "heartbeat_s": to_int(text(srv, "heartbeatInterval"))}
    if raw_address:
        out["address"] = address
    return out


_HOST = re.compile(r"^(?:\d{1,3}(?:\.\d{1,3}){3}|[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)$")


def alarm_server_document(server: str, port: int, heartbeat_s: int) -> str:
    """SetAlarmServerConfig body (guide 5.3.3: the whole alarmServer element, no attributes). Values validated."""
    if not isinstance(server, str) or not _HOST.match(server) or len(server) > 253:
        raise ValueError("server")
    if not isinstance(port, int) or isinstance(port, bool) or not 1 <= port <= 65535:
        raise ValueError("port")
    if not isinstance(heartbeat_s, int) or isinstance(heartbeat_s, bool) or not 10 <= heartbeat_s <= 1800:
        raise ValueError("heartbeat_s")
    return ('<?xml version="1.0" encoding="UTF-8"?><config version="1.0" xmlns="http://www.ipc.com/ver10"><alarmServer>'
            f"<serverAddr><![CDATA[{server}]]></serverAddr><serverPort>{port}</serverPort>"
            f"<enableHeartbeat>true</enableHeartbeat><heartbeatInterval>{heartbeat_s}</heartbeatInterval></alarmServer></config>")


def parse_push(body: str | bytes) -> dict[str, Any]:
    """A message the device posts to the alarm server (v1 guide 5.3.2 tips; v2 long-polling / HTTP POST guide):
    `{"kind": "status" | "heartbeat", "status": {(kind, id): bool}, "data_time": str | None, "channel": int | None}`.
    v1: `<alarmStatusInfo>` + `<dataTime>` + `<deviceInfo>`; heartbeat = `<deviceInfo>` only. v2: `<messageType>alarmStatus |
    keepalive` with `deviceInfo/channelId`. The device identity (name, serial, IP, MAC) is dropped."""
    root = parse(body)
    mtype = (text(root, "messageType") or "").lower()
    info = child(root, "alarmStatusInfo")
    dev = child(root, "deviceInfo")
    channel = to_int(text(dev, "channelId")) if dev is not None else None
    if info is not None:
        return {"kind": "status", "status": parse_alarm_status_info(info), "data_time": text(root, "dataTime"), "channel": channel}
    if mtype == "keepalive" or (dev is not None and mtype in ("", "keepalive")):
        return {"kind": "heartbeat", "status": {}, "data_time": None, "channel": channel}
    raise ET.ParseError("not an alarm push message")