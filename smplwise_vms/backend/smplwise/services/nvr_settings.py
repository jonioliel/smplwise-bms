"""CR-020 S1: the read-only table of the cameras' video settings (docs/architecture/NVR_SETTINGS_API.md, section 3.1-3.3).

Reads go through the recorder adapter (services/recorders) - for the add-on's Hikvision NVR the proven read-only ISAPI
code of services/nvr.py. Device calls run inside `with unlocked(conn):` (the request's write lock is never held across
device I/O) and the adapters never see the SQLite connection. Nothing here writes to a device: S1 has no write verb, and
`can_write` / `writable` say so. A device that cannot be read never makes a 5xx: the cameras then come from the codec
registry (`cameras.capabilities_json["encoding"]`, main and sub only) with `stale: true` and the adapter's error code.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from ..config import Settings
from ..db import now_iso, unlocked
from ..errors import ApiError
from . import stream_codecs
from .access import CameraScope
from .recorders import registry
from .recorders.base import RecorderAdapter, StreamEncoding

NOT_WRITABLE_REASON = "read_only"  # S1: no write path exists yet (the guarded writes are slice S2)
MAX_CAMERAS = 256


def _recorder_name(conn: sqlite3.Connection, recorder_id: str) -> tuple[str, str | None, str | None]:
    row = conn.execute("SELECT name, model, firmware FROM recorders WHERE id = ?", (recorder_id,)).fetchone()
    if row is None:
        return "NVR ראשי", None, None
    return row["name"], row["model"], row["firmware"]


def recorder_card(conn: sqlite3.Connection, adapter: RecorderAdapter) -> dict[str, Any]:
    """One recorder as API section 3.1 shows it. `online` / `error` come from the adapter's health (one deviceInfo GET)."""
    name, model, firmware = _recorder_name(conn, adapter.recorder_id)
    caps = adapter.capabilities()
    used = conn.execute("SELECT COUNT(*) FROM cameras WHERE recorder_id = ?", (adapter.recorder_id,)).fetchone()[0]
    with unlocked(conn):
        health = adapter.health()
    return {
        "recorder_id": adapter.recorder_id, "name": name, "vendor": caps.vendor, "model": health.model or model, "firmware": health.firmware or firmware,
        "enabled": True, "online": health.online, "checked_at": now_iso(),
        "capabilities": {
            "read_encodings": caps.read_encodings, "write_encodings": caps.write_encodings, "add_channel": caps.add_channel, "remove_channel": caps.remove_channel,
            "max_channels": caps.max_channels, "used_channels": used, "encoding_fields": sorted(caps.encoding_fields),
        },
        "error": health.error,
    }


def list_recorders(conn: sqlite3.Connection, settings: Settings) -> dict[str, Any]:
    cards = [recorder_card(conn, registry.adapter_for(conn, settings, rid)) for rid in registry.recorder_ids(conn)]
    return {"recorders": cards, "can_write": False}


# ------------------------------------------------------------------------------------------------ cameras

def _stream_dict(s: StreamEncoding) -> dict[str, Any]:
    e = s.encoding
    return {
        "stream_ref": s.stream_ref, "role": s.role, "enabled": s.enabled,
        "codec": e.get("codec"), "codec_raw": e.get("codec_raw"), "codec_plus": e.get("codec_plus"), "profile": e.get("profile"),
        "resolution": e.get("resolution"), "fps": e.get("fps"), "fps_full": bool(e.get("fps_full")),
        "bitrate_mode": e.get("bitrate_mode"), "bitrate_kbps": e.get("bitrate_kbps"), "quality": e.get("quality"), "gop": e.get("gop"),
        "svc": e.get("svc"), "smart_codec": e.get("smart_codec"), "b_frames": e.get("b_frames"),
        "webrtc": e.get("webrtc") or "unknown", "webrtc_reason": e.get("webrtc_reason") or "codec_unknown",
        "fields": s.fields, "writable": False, "not_writable_reason": NOT_WRITABLE_REASON, "etag": s.etag,
    }


def _registry_streams(row: sqlite3.Row | None, channel: int) -> list[dict[str, Any]]:
    """The last reading of the main / sub stream from the codec registry (the device could not be read now)."""
    enc = (stream_codecs.encoding_of(row) or {}) if row is not None else {}
    out: list[dict[str, Any]] = []
    for role, kind in (("main", 1), ("sub", 2)):
        e = enc.get(role)
        if not isinstance(e, dict):
            continue
        raw = e.get("codec_raw")
        out.append({
            "stream_ref": f"{channel}0{kind}", "role": role, "enabled": None,
            "codec": e.get("codec"), "codec_raw": raw, "codec_plus": (str(raw).endswith("+") or e.get("smart_codec") is True) if raw else None, "profile": e.get("profile"),
            "resolution": e.get("resolution"), "fps": e.get("fps"), "fps_full": False,
            "bitrate_mode": None, "bitrate_kbps": None, "quality": None, "gop": e.get("gov_length"),
            "svc": e.get("svc"), "smart_codec": e.get("smart_codec"), "b_frames": e.get("b_frames"),
            "webrtc": e.get("webrtc") or "unknown", "webrtc_reason": e.get("reason") or "codec_unknown",
            "fields": {}, "writable": False, "not_writable_reason": NOT_WRITABLE_REASON, "etag": None,
        })
    return out


def _arx_rows(conn: sqlite3.Connection, recorder_id: str) -> dict[int, sqlite3.Row]:
    rows = conn.execute("SELECT id, recorder_id, channel, alias, name_source, enabled, status, capabilities_json FROM cameras WHERE recorder_id = ? ORDER BY channel", (recorder_id,)).fetchall()
    return {int(r["channel"]): r for r in rows}


def _camera(recorder_id: str, channel: int, device_name: str | None, online: bool | None, row: sqlite3.Row | None, streams: list[dict[str, Any]], error: str | None) -> dict[str, Any]:
    name = stream_codecs.camera_name(row) if row is not None else (device_name or f"ערוץ {channel}")
    if online is None and row is not None:
        online = {"online": True, "offline": False}.get(str(row["status"]))
    return {
        "camera_id": row["id"] if row is not None else None, "recorder_id": recorder_id, "source_ref": str(channel), "channel": channel,
        "name": name, "online": online, "enabled_in_arx": bool(row["enabled"]) if row is not None else False, "streams": streams, "error": error,
    }


def read_recorder(conn: sqlite3.Connection, adapter: RecorderAdapter) -> dict[str, Any]:
    """The cameras of one recorder: {"cameras": [...], "stale": bool, "error": code | None}."""
    rid = adapter.recorder_id
    channels: list[Any] | None = None
    by_channel: dict[str, list[StreamEncoding]] = {}
    channels_error: str | None = None
    streams_error: str | None = None
    with unlocked(conn):
        try:
            channels = adapter.list_channels()
        except ApiError as exc:
            if exc.code == "nvr_not_configured":
                raise
            channels_error = exc.code
        if channels is not None:
            try:
                by_channel = adapter.read_stream_encodings()
            except ApiError as exc:
                streams_error = exc.code
    rows = _arx_rows(conn, rid)
    cameras: list[dict[str, Any]] = []
    if channels is None:  # the device list is unreadable: every camera Arx knows, from the registry
        for ch, row in rows.items():
            cameras.append(_camera(rid, ch, None, None, row, _registry_streams(row, ch), channels_error))
        return {"cameras": cameras, "stale": True, "error": channels_error}
    for c in sorted(channels, key=lambda x: (x.channel if x.channel is not None else 10**9))[:MAX_CAMERAS]:
        ch = int(c.channel) if c.channel is not None else 0
        row = rows.get(ch)
        if streams_error is not None:
            streams = _registry_streams(row, ch)
        else:
            streams = [_stream_dict(s) for s in by_channel.get(c.source_ref, [])]
        cameras.append(_camera(rid, ch, c.name, c.online, row, streams, streams_error))
    return {"cameras": cameras, "stale": streams_error is not None, "error": streams_error}


def list_cameras(conn: sqlite3.Connection, settings: Settings, scope: CameraScope, recorder_id: str | None = None) -> dict[str, Any]:
    """API section 3.2: every channel of the recorder(s) with every stream. A camera outside the caller's scope (T055 deny) is
    left out; a channel Arx has no camera row for yet (discovery has not run) is shown to installation-wide holders only."""
    ids = [recorder_id] if recorder_id else registry.recorder_ids(conn)
    out: list[dict[str, Any]] = []
    failed: list[str] = []
    stale = False
    error: str | None = None
    for rid in ids:
        res = read_recorder(conn, registry.adapter_for(conn, settings, rid))
        if res["stale"]:
            stale = True
            failed.append(rid)
            error = error or res["error"]
        out.extend(c for c in res["cameras"] if (scope.allows(c["camera_id"]) if c["camera_id"] else scope.everything))
    return {"cameras": out, "recorders_failed": failed, "stale": stale, "error": error, "can_write": False, "checked_at": now_iso()}


def camera_detail(conn: sqlite3.Connection, settings: Settings, camera_id: str) -> dict[str, Any]:
    """API section 3.3 without `options` (they belong to the write slice): the one camera as in the list. The caller has
    already passed `require_camera` for this id."""
    row = conn.execute("SELECT id, recorder_id, channel FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    res = read_recorder(conn, registry.adapter_for(conn, settings, row["recorder_id"]))
    cam = next((c for c in res["cameras"] if c["camera_id"] == camera_id), None)
    if cam is None:  # the channel is no longer on the recorder: the Arx row alone, from the registry
        full = conn.execute("SELECT id, recorder_id, channel, alias, name_source, enabled, status, capabilities_json FROM cameras WHERE id = ?", (camera_id,)).fetchone()
        cam = _camera(row["recorder_id"], int(row["channel"]), None, None, full, _registry_streams(full, int(row["channel"])), "channel_missing")
        res = {**res, "stale": True, "error": "channel_missing"}
    return {"camera": cam, "stale": res["stale"], "can_write": False}


def audit_details(result: dict[str, Any]) -> dict[str, Any]:
    """What the read audit row keeps: counts and the error code - never a name, address or document."""
    cams = result.get("cameras") or []
    return {"cameras": len(cams), "streams": sum(len(c["streams"]) for c in cams), "stale": bool(result.get("stale")), "error": result.get("error")}


