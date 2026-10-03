"""CR-020: the cameras' video settings (docs/architecture/NVR_SETTINGS_API.md).

S1 - the read-only table (sections 3.1-3.3). Reads go through the recorder adapter (services/recorders) - for the add-on's
Hikvision NVR the proven ISAPI code of services/nvr.py. A device that cannot be read never makes a 5xx: the cameras then
come from the codec registry (`cameras.capabilities_json["encoding"]`, main and sub only) with `stale: true`.

S2 - the guarded write of ONE stream's encoding (sections 3.4, 3.5, 4, 5) and its undo. The two-phase rule:
1. reads and validation first (device reads inside `with unlocked(conn):`, nothing written);
2. under the request's write lock: refuse a second pending change of the same stream, INSERT the change as `pending`
   and the audit row `phase:"attempt"` - committed BEFORE the device is touched;
3. `with unlocked(conn):` the adapter call - and nothing else: no SQLite access inside that block, adapters never see `conn`;
4. outcome: the change row, the audit row `phase:"outcome"` and the codec registry in one transaction.
A device action therefore always has a row; a row left `pending` (crash, busy database at re-lock, an answer that leaves
the device state unknown) is settled by `settle_pending` from a fresh read - it never writes to the device. Nothing is
retried. No response, audit row or log line carries a device address, user name, password, serial number or MAC.

S2 phase C (services/nvr_batch.py) runs this same path per camera: `write_stream` / `rollback_stream` take `batch` (kept in
the audit rows) and `adopt` (the item's `queued` placeholder, claimed atomically in `_insert_pending`); a single write or
undo is refused 409 `batch_in_progress` while a batch holds the recorder (`batch_guard`).
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import sqlite3
from dataclasses import dataclass, field
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import is_busy, new_id, now_iso, unlocked
from ..errors import ApiError
from . import nvr, stream_codecs, xmlsafe
from .access import CameraScope
from .nvr_write import _row as change_row
from .recorders import registry
from .recorders.base import RecorderAdapter, StreamEncoding, StreamOptions, StreamSnapshot

log = logging.getLogger(__name__)

MAX_CAMERAS = 256
WRITE_PERMISSION = "nvr.configure"
KIND = "stream_encoding"
PENDING_SETTLE_S = 120  # a pending row older than this is settled by reading the device (API 4 step 7)
# Review M2: a change whose device answer was unknown (timeout, 5xx, failed verify) is settled no sooner than this after it
# was recorded - the device may still be applying the PUT (whose answer it waits PUT_READ_TIMEOUT_S = 25 s for). Until then a
# second write of the stream is 409 `write_in_progress` and the janitor leaves the row alone.
UNKNOWN_SETTLE_MIN_S = 45
WRITE_FIELDS = ("codec", "profile", "resolution", "fps", "bitrate_mode", "bitrate_kbps", "quality", "gop", "svc", "smart_codec", "b_frames")
REFUSED = ("stale", "nvr_busy", "nvr_not_supported", "nvr_rejected")
# CR-020 S2 phase C: the recorder-level lock of a multi-camera batch (services/nvr_batch.py). While the key exists, a single
# write or undo on that recorder is refused 409 `batch_in_progress` - a queued stream's etag must not move under the batch.
BATCH_ACTIVE_KEY = "nvr.batch.active.{}"


def batch_guard(conn: sqlite3.Connection, recorder_id: str) -> None:
    """409 `batch_in_progress` while a multi-camera batch runs on this recorder (owner decision: "מתבצע שינוי מרובה")."""
    if conn.execute("SELECT 1 FROM settings WHERE key = ?", (BATCH_ACTIVE_KEY.format(recorder_id),)).fetchone() is not None:
        raise ApiError(409, "batch_in_progress", "מתבצע שינוי מרובה.", retryable=True)


def _batch_details(batch: tuple[str, int] | None) -> dict[str, Any]:
    return {"batch_id": batch[0], "batch_index": batch[1]} if batch else {}


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


def list_recorders(conn: sqlite3.Connection, settings: Settings, can_write: bool = False) -> dict[str, Any]:
    cards = [recorder_card(conn, registry.adapter_for(conn, settings, rid)) for rid in registry.recorder_ids(conn)]
    return {"recorders": cards, "can_write": can_write and any(c["capabilities"]["write_encodings"] for c in cards)}


# ------------------------------------------------------------------------------------------------ cameras (read)

def _writability(opts: StreamOptions | None) -> tuple[bool | None, str | None]:
    """`writable` of a stream: True / False from its capability discovery, None when not discovered yet (the list view
    never probes 20 capability documents; the detail view and the write itself do)."""
    if opts is None:
        return None, None
    return opts.writable, (None if opts.writable else (opts.reason or "capabilities_unreadable"))


def _stream_fields(stream_ref: str, role: str, enabled: Any, e: dict[str, Any], fields: dict[str, Any], etag: str | None, opts: StreamOptions | None) -> dict[str, Any]:
    writable, reason = _writability(opts)
    return {
        "stream_ref": stream_ref, "role": role, "enabled": enabled,
        "codec": e.get("codec"), "codec_raw": e.get("codec_raw"), "codec_plus": e.get("codec_plus"), "profile": e.get("profile"),
        "resolution": e.get("resolution"), "fps": e.get("fps"), "fps_full": bool(e.get("fps_full")),
        "bitrate_mode": e.get("bitrate_mode"), "bitrate_kbps": e.get("bitrate_kbps"), "quality": e.get("quality"), "gop": e.get("gop"),
        "svc": e.get("svc"), "smart_codec": e.get("smart_codec"), "b_frames": e.get("b_frames"),
        "webrtc": e.get("webrtc") or "unknown", "webrtc_reason": e.get("webrtc_reason") or "codec_unknown",
        "fields": fields, "writable": writable, "not_writable_reason": reason, "etag": etag,
    }


def _stream_dict(s: StreamEncoding, opts: StreamOptions | None = None) -> dict[str, Any]:
    return _stream_fields(s.stream_ref, s.role, s.enabled, s.encoding, s.fields, s.etag, opts)


def stream_from_parsed(p: dict[str, Any], opts: StreamOptions | None = None) -> dict[str, Any]:
    """A stream from one parsed LIST element (nvr.parse_stream_element), in the shape of section 3.2."""
    return _stream_fields(str(p["stream_ref"]), str(p["role"]), p.get("enabled"), p, p.get("fields") or {}, p.get("etag"), opts)


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
            "fields": {}, "writable": False, "not_writable_reason": "stale", "etag": None,
        })
    return out


def _arx_rows(conn: sqlite3.Connection, recorder_id: str) -> dict[int, sqlite3.Row]:
    rows = conn.execute("SELECT id, recorder_id, channel, alias, name_source, enabled, status, capabilities_json FROM cameras WHERE recorder_id = ? ORDER BY channel", (recorder_id,)).fetchall()
    return {int(r["channel"]): r for r in rows}


def _camera(recorder_id: str, channel: int, device_name: str | None, online: bool | None, row: sqlite3.Row | None, streams: list[dict[str, Any]], error: str | None) -> dict[str, Any]:
    name = (stream_codecs.camera_name(row) if row is not None else (device_name or f"ערוץ {channel}"))[:128]
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
            streams = [_stream_dict(s) for s in by_channel.get(c.source_ref, [])]  # `writable` null: the list never discovers
        cameras.append(_camera(rid, ch, c.name, c.online, row, streams, streams_error))
    return {"cameras": cameras, "stale": streams_error is not None, "error": streams_error}


def list_cameras(conn: sqlite3.Connection, settings: Settings, scope: CameraScope, recorder_id: str | None = None, can_write: bool = False) -> dict[str, Any]:
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
        for cam in res["cameras"]:
            if not (scope.allows(cam["camera_id"]) if cam["camera_id"] else scope.everything):
                continue
            for s in cam["streams"]:  # frozen API shape: `writable` is null in lists, a boolean only in the detail / options
                s["writable"], s["not_writable_reason"] = None, None
            out.append(cam)
    return {"cameras": out, "recorders_failed": failed, "stale": stale, "error": error, "can_write": can_write, "checked_at": now_iso()}


def camera_detail(conn: sqlite3.Connection, settings: Settings, camera_id: str, can_write: bool = False) -> dict[str, Any]:
    """API section 3.3: the one camera as in the list, plus each stream's `options` (capability discovery, cached per
    process) and its computed `writable`. The caller has already passed `require_camera` for this id."""
    row = conn.execute("SELECT id, recorder_id, channel FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    adapter = registry.adapter_for(conn, settings, row["recorder_id"])
    res = read_recorder(conn, adapter)
    cam = next((c for c in res["cameras"] if c["camera_id"] == camera_id), None)
    options: dict[str, Any] = {}
    if cam is None:  # the channel is no longer on the recorder: the Arx row alone, from the registry
        full = conn.execute("SELECT id, recorder_id, channel, alias, name_source, enabled, status, capabilities_json FROM cameras WHERE id = ?", (camera_id,)).fetchone()
        cam = _camera(row["recorder_id"], int(row["channel"]), None, None, full, _registry_streams(full, int(row["channel"])), "channel_missing")
        res = {**res, "stale": True, "error": "channel_missing"}
    elif not res["stale"]:
        refs = [s["stream_ref"] for s in cam["streams"]]
        found: dict[str, StreamOptions | str] = {}
        with unlocked(conn):  # capability documents: device reads only
            for ref in refs:
                try:
                    found[ref] = adapter.stream_options(ref)
                except ApiError as exc:
                    found[ref] = exc.code
        for s in cam["streams"]:
            got = found.get(s["stream_ref"])
            if isinstance(got, StreamOptions):
                options[s["stream_ref"]] = got.options
                s["writable"], s["not_writable_reason"] = _writability(got)
            else:
                options[s["stream_ref"]] = None
                s["writable"], s["not_writable_reason"] = False, got or "capabilities_unreadable"
    return {"camera": cam, "options": options, "stale": res["stale"], "can_write": can_write}


def audit_details(result: dict[str, Any]) -> dict[str, Any]:
    """What the read audit row keeps: counts and the error code - never a name, address or document."""
    cams = result.get("cameras") or []
    return {"cameras": len(cams), "streams": sum(len(c["streams"]) for c in cams), "stale": bool(result.get("stale")), "error": result.get("error")}


# ------------------------------------------------------------------------------------------------ S2: the guarded write

@dataclass
class WriteRequest:
    if_match: str
    changes: dict[str, Any] = field(default_factory=dict)


def parse_write_body(body: Any) -> WriteRequest:
    """The PUT body (API 3.4). `confirm` is checked first and only the JSON literal `true` passes (no "true", 1 or a default):
    a missing confirmation never reaches a device read. Then the shape: `if_match` (16 hex), `changes` with at least one
    known field, strict JSON types."""
    if not isinstance(body, dict) or body.get("confirm") is not True:
        raise ApiError(422, "confirm_required", "יש לאשר את השינוי.")
    extra = set(body) - {"if_match", "confirm", "changes"}
    etag = body.get("if_match")
    changes = body.get("changes")
    if extra or not isinstance(etag, str) or len(etag) != 16 or any(ch not in "0123456789abcdef" for ch in etag) or not isinstance(changes, dict) or not changes:
        raise ApiError(422, "validation", "בקשה לא תקינה.", details={"extra": sorted(extra)[:5]} if extra else None)
    unknown = sorted(k for k in changes if k not in WRITE_FIELDS)
    if unknown:
        raise ApiError(422, "validation", "שדה לא מוכר.", details={"fields": [str(k)[:32] for k in unknown[:5]]})
    for k, v in changes.items():
        ok = {
            "codec": isinstance(v, str) and len(v) <= 32, "profile": isinstance(v, str) and len(v) <= 32,
            "resolution": isinstance(v, str) and len(v) <= 11,
            "fps": v == "full" or (isinstance(v, (int, float)) and not isinstance(v, bool)),
            "bitrate_mode": v in ("CBR", "VBR"),
            "bitrate_kbps": isinstance(v, int) and not isinstance(v, bool), "quality": isinstance(v, int) and not isinstance(v, bool),
            "gop": isinstance(v, int) and not isinstance(v, bool),
            "svc": isinstance(v, bool), "smart_codec": isinstance(v, bool), "b_frames": isinstance(v, bool),
        }[k]
        if not ok:
            raise ApiError(422, "validation", "ערך בסוג לא תקין.", details={"field": k})
    return WriteRequest(if_match=etag, changes=dict(changes))


def field_value(p: dict[str, Any], name: str) -> Any:
    """A field's current value in the shape a request carries (fps: number or "full")."""
    if name == "fps":
        return "full" if p.get("fps_full") else p.get("fps")
    return p.get(name)


def _same(a: Any, b: Any) -> bool:
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return round(float(a), 2) == round(float(b), 2)
    return a == b


def _not_allowed(name: str, allowed: Any = None) -> ApiError:
    return ApiError(422, "value_not_allowed", "הערך אינו בין הערכים שהמכשיר מקבל.", details={"field": name, **({"allowed": allowed} if allowed is not None else {})})


def _not_supported(name: str) -> ApiError:
    return ApiError(422, "field_not_supported", "המכשיר אינו מאפשר לשנות את השדה הזה בזרם הזה.", details={"field": name})


def validate_changes(current: dict[str, Any], options: dict[str, Any], requested: dict[str, Any]) -> tuple[dict[str, Any], dict[str, list[Any]], list[str]]:
    """(the changes to write, {field: [from, to]}, the unchanged field names). Every check of API 3.4, before any write:
    membership in the device's options, ranges, the field present in the stream's document, cross-field locks."""
    unsupported = set((current.get("fields") or {}).keys())
    codec_after = requested.get("codec", current.get("codec"))
    mode_after = requested.get("bitrate_mode", current.get("bitrate_mode"))
    smart_after = requested.get("smart_codec", current.get("smart_codec"))
    for name, value in requested.items():
        if name == "b_frames":
            if not options.get("b_frames"):
                raise _not_supported(name)
            continue
        if name in unsupported and not (name == "bitrate_kbps" and mode_after == "CBR" and "bitrate_mode" in requested):
            raise _not_supported(name)
        if name == "codec":
            if value not in (options.get("codec") or []):
                raise _not_allowed(name, options.get("codec"))
        elif name == "profile":
            allowed = (options.get("profile") or {}).get(str(codec_after)) or []
            if value not in allowed:
                raise _not_allowed(name, allowed)
        elif name == "resolution":
            allowed = (options.get("resolution") or {}).get(str(codec_after)) or []
            if value not in allowed:
                raise _not_allowed(name, allowed)
        elif name == "fps":
            if value == "full":
                if not options.get("fps_full"):
                    raise _not_allowed(name, options.get("fps"))
            elif not any(_same(value, f) for f in (options.get("fps") or [])):
                raise _not_allowed(name, options.get("fps"))
        elif name == "bitrate_mode":
            if value not in (options.get("bitrate_mode") or []):
                raise _not_allowed(name, options.get("bitrate_mode"))
        elif name in ("bitrate_kbps", "gop"):
            bounds = options.get(name)
            if not isinstance(bounds, dict) or not bounds["min"] <= value <= bounds["max"]:
                raise _not_allowed(name, bounds)
        elif name == "quality":
            if mode_after != "VBR":
                raise ApiError(422, "field_locked", "השדה נעול בגלל ערך של שדה אחר.", details={"field": name, "by": "bitrate_mode"})
            if value not in (options.get("quality") or []):
                raise _not_allowed(name, options.get("quality"))
        elif name in ("svc", "smart_codec"):
            if not options.get(name):
                raise _not_supported(name)
    if smart_after is True:
        for name in (options.get("locks") or {}).get("smart_codec", []):
            if name in requested and not _same(requested[name], field_value(current, name)):
                raise ApiError(422, "field_locked", "השדה נעול בגלל ערך של שדה אחר.", details={"field": name, "by": "smart_codec"})
    if "codec" in requested and requested["codec"] != current.get("codec") and current.get("profile") is not None and "profile" not in requested:
        allowed = (options.get("profile") or {}).get(str(codec_after)) or []
        if current.get("profile") not in allowed:
            raise _not_allowed("profile", allowed)
    effective: dict[str, Any] = {}
    fields: dict[str, list[Any]] = {}
    unchanged: list[str] = []
    for name in WRITE_FIELDS:
        if name not in requested:
            continue
        before = field_value(current, name)
        if _same(before, requested[name]):
            unchanged.append(name)
            continue
        effective[name] = requested[name]
        fields[name] = [before, requested[name]]
    return effective, fields, unchanged


def classify(parsed: dict[str, Any], fields: dict[str, list[Any]]) -> str:
    """Compare a device reading with the change: `applied` (every field has its new value), `no_effect` (every field has
    its old value), otherwise `diverged`."""
    now = {name: field_value(parsed, name) for name in fields}
    if all(_same(now[n], ft[1]) for n, ft in fields.items()):
        return "applied"
    if all(_same(now[n], ft[0]) for n, ft in fields.items()):
        return "no_effect"
    return "diverged"


def refresh_registry(conn: sqlite3.Connection, camera_id: str | None, role: str, element: str) -> None:
    """API 5.3: the verified document of a main / sub stream becomes the camera's registry entry for that role (the same
    shape the discovery builds), so the player verdict, /health and the hints change at once. Other roles: nothing."""
    if not camera_id or role not in ("main", "sub"):
        return
    row = conn.execute("SELECT capabilities_json FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if row is None:
        return
    parsed = nvr.parse_streaming_channel(xmlsafe.parse(element))
    if parsed is None:
        return
    try:
        caps = json.loads(row["capabilities_json"] or "{}")
    except (ValueError, TypeError):
        caps = {}
    if not isinstance(caps, dict):
        caps = {}
    enc = caps.get("encoding") if isinstance(caps.get("encoding"), dict) else {}
    enc = {**enc, role: parsed[1], "checked_at": now_iso(), "error": None}
    caps["encoding"] = enc
    conn.execute("UPDATE cameras SET capabilities_json = ? WHERE id = ?", (json.dumps(caps, ensure_ascii=False), camera_id))


def _camera_row(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT id, recorder_id, channel FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if row is None or row["channel"] is None:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    return row


def _pending(conn: sqlite3.Connection, recorder_id: str, stream_ref: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM nvr_changes WHERE recorder_id = ? AND stream_ref = ? AND status = 'pending'", (recorder_id, stream_ref)).fetchone()


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)  # tests move this clock


def _age_s(created_at: str) -> float:
    try:
        then = dt.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return 10**9
    if then.tzinfo is None:
        then = then.replace(tzinfo=dt.timezone.utc)
    return (_utcnow() - then).total_seconds()


def _settle_due(r: sqlite3.Row, older_than_s: float = PENDING_SETTLE_S) -> bool:
    """A pending row is settled when it is older than `older_than_s` (crash, busy database at re-lock), or - when the
    device answer was unknown - once it is UNKNOWN_SETTLE_MIN_S old (never at once: the PUT may still be landing)."""
    age = _age_s(r["created_at"])
    if r["error"] == "outcome_unknown":
        return age >= UNKNOWN_SETTLE_MIN_S
    return age > older_than_s


def _clear_pending(conn: sqlite3.Connection, settings: Settings, recorder_id: str, stream_ref: str) -> None:
    """A pending change of this stream: settled now from a device read when it is due (old, or its outcome unknown),
    otherwise 409 `write_in_progress`. Never a device write."""
    p = _pending(conn, recorder_id, stream_ref)
    if p is None:
        return
    if _settle_due(p):
        _settle_one(conn, settings, p)
        if _pending(conn, recorder_id, stream_ref) is None:
            return
    raise ApiError(409, "write_in_progress", "שינוי אחר של הזרם הזה עדיין מתבצע.", retryable=True)


def _details(rid: str, stream_ref: str, role: Any, **extra: Any) -> dict[str, Any]:
    return {"recorder_id": rid, "stream_ref": stream_ref, "role": role, **extra}


def _refuse(conn: sqlite3.Connection, principal: Any, action: str, camera_id: str, exc: ApiError, details: dict[str, Any], request_id: str | None) -> ApiError:
    """An authorized attempt that ends before any device write: one denied audit row with the reason code."""
    audit(conn, actor=principal, action=action, decision="denied", resource_type="camera", resource_id=camera_id, reason=exc.code, request_id=request_id,
          details={"phase": "attempt", **details})
    return exc


def refuse_attempt(conn: sqlite3.Connection, principal: Any, camera_id: str, stream_ref: str, exc: ApiError, request_id: str | None, action: str = "nvr.stream.write") -> ApiError:
    """For the router: an authorized request refused before the service (confirm missing, bad body)."""
    return _refuse(conn, principal, action, camera_id, exc, {"stream_ref": stream_ref}, request_id)


def _insert_pending(conn: sqlite3.Connection, principal: Any, *, rid: str, camera_id: str, stream_ref: str, path: str, before: str, after: str,
                    fields: dict[str, list[Any]], etag_before: str, rollback_of: str | None = None, note: str = "", adopt: str | None = None) -> str:
    if adopt is not None:  # phase C: a batch item claims its `queued` placeholder (a user stop that won the race leaves 0 rows)
        try:
            n = conn.execute(
                "UPDATE nvr_changes SET status = 'pending', error = NULL, path = ?, before_xml = ?, after_xml = ?, rollback_of = ?, note = ?, actor_id = ?, actor_username = ?,"
                " created_at = ?, recorder_id = ?, camera_id = ?, stream_ref = ?, fields_json = ?, etag_before = ? WHERE id = ? AND status = 'queued'",
                (path, before, after, rollback_of, note, getattr(principal, "user_id", None), getattr(principal, "username", None), now_iso(), rid, camera_id, stream_ref,
                 json.dumps(fields), etag_before, adopt),
            ).rowcount
        except sqlite3.IntegrityError as exc:  # the partial unique index: another pending change of this stream
            raise ApiError(409, "write_in_progress", "שינוי אחר של הזרם הזה עדיין מתבצע.", retryable=True) from exc
        if not n:
            raise ApiError(409, "batch_stopped", "השינוי המרובה נעצר.")
        return adopt
    cid = new_id()
    try:
        conn.execute(
            "INSERT INTO nvr_changes(id, kind, permission, target, path, before_xml, after_xml, status, error, rollback_of, note, actor_id, actor_username, created_at,"
            " recorder_id, camera_id, stream_ref, fields_json, etag_before) VALUES (?,?,?,?,?,?,?,'pending',NULL,?,?,?,?,?,?,?,?,?,?)",
            (cid, KIND, WRITE_PERMISSION, f"stream-{stream_ref}", path, before, after, rollback_of, note, getattr(principal, "user_id", None), getattr(principal, "username", None),
             now_iso(), rid, camera_id, stream_ref, json.dumps(fields), etag_before),
        )
    except sqlite3.IntegrityError as exc:  # the partial unique index: a parallel request inserted its pending row first
        raise ApiError(409, "write_in_progress", "שינוי אחר של הזרם הזה עדיין מתבצע.", retryable=True) from exc
    return cid


def _device_write(conn: sqlite3.Connection, adapter: RecorderAdapter, stream_ref: str, expect_etag: str, element: str, write_via: str) -> tuple[Any, ApiError | None]:
    """Phase 3: the adapter call with the write lock released - the block touches no SQLite. A busy database while taking
    the lock back propagates: the committed pending row stays and `settle_pending` settles it."""
    outcome: Any = None
    error: ApiError | None = None
    try:
        with unlocked(conn):
            try:
                outcome = adapter.write_stream_encoding(stream_ref, expect_etag, element, write_via)
            except ApiError as exc:
                error = exc
    except sqlite3.OperationalError as exc:
        if is_busy(exc):
            log.warning("nvr stream write: database busy after the device call; the pending change is settled by the janitor")
        raise
    return outcome, error


def _forget_options(adapter: Any, stream_ref: str) -> None:
    """The device changed the stream: its cached capability discovery is dropped (review L1). In memory only."""
    forget = getattr(adapter, "forget_options", None)
    if forget is not None:
        forget(stream_ref)


def _record_outcome(conn: sqlite3.Connection, principal: Any, *, cid: str, action: str, camera_id: str, role: str, base: dict[str, Any], fields: dict[str, list[Any]],
                    outcome: Any, error: ApiError | None, request_id: str | None, rollback_of: str | None = None, adapter: Any = None) -> tuple[dict[str, Any], str, Any]:
    """Phase 4 in one transaction: the change row, the outcome audit row, the registry. Returns (row, status, verified).
    Every UPDATE is guarded by `status = 'pending'`: when the janitor settled the row meanwhile (review L5) the request
    records nothing more - no second outcome audit row, no registry write - and answers with the janitor's verdict."""
    if error is not None:
        if error.details.get("outcome") == "unknown":
            error.retryable = False  # review M2: an unknown device outcome is never retried by a client
            n = conn.execute("UPDATE nvr_changes SET error = 'outcome_unknown' WHERE id = ? AND status = 'pending'", (cid,)).rowcount
            status = "pending"
        else:
            status = "refused" if error.code in REFUSED else "failed"
            n = conn.execute("UPDATE nvr_changes SET status = ?, error = ? WHERE id = ? AND status = 'pending'", (status, error.code, cid)).rowcount
        row = conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (cid,)).fetchone()
        if not n:
            return change_row(row), str(row["status"]), None
        audit(conn, actor=principal, action=action, decision="denied", resource_type="camera", resource_id=camera_id, reason=error.code, request_id=request_id,
              details={"phase": "outcome", **base, "fields": fields, "change_id": cid, "status": status, **({"rollback_of": rollback_of} if rollback_of else {})})
        return change_row(row), status, None
    verified: StreamSnapshot = outcome.verified
    status = classify(verified.parsed, fields)
    if status != "no_effect":
        _forget_options(adapter, verified.stream_ref)
    if not conn.execute(
        "UPDATE nvr_changes SET status = ?, error = ?, after_xml = ?, etag_after = ?, device_status = ?, reboot_required = ? WHERE id = ? AND status = 'pending'",
        (status, None if status == "applied" else status, verified.element, verified.etag, outcome.device_status, 1 if outcome.reboot_required else 0, cid),
    ).rowcount:
        row = conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (cid,)).fetchone()
        return change_row(row), str(row["status"]), verified
    if status != "no_effect":
        refresh_registry(conn, camera_id, role, verified.element)
    if status == "applied" and rollback_of:
        conn.execute("UPDATE nvr_changes SET status = 'rolled_back' WHERE id = ? AND status IN ('applied', 'diverged')", (rollback_of,))
    audit(conn, actor=principal, action=action, decision="allowed" if status == "applied" else "denied", resource_type="camera", resource_id=camera_id,
          reason=None if status == "applied" else status, request_id=request_id,
          details={"phase": "outcome", **base, "fields": fields, "change_id": cid, "status": status, "device_status": outcome.device_status,
                   "reboot_required": outcome.reboot_required, **({"rollback_of": rollback_of} if rollback_of else {})})
    return change_row(conn.execute("SELECT * FROM nvr_changes WHERE id = ?", (cid,)).fetchone()), status, verified


def _raise_for(status: str, error: ApiError | None, cid: str) -> None:
    if error is not None:
        error.details = {**{k: v for k, v in error.details.items() if k in ("op", "code", "sub", "status", "outcome")}, "change_id": cid}
        raise error
    if status in ("no_effect", "failed"):  # "failed": the janitor settled the row meanwhile and found the old values
        raise ApiError(409, "nvr_no_effect", "ה־NVR אישר את הכתיבה אבל לא שינה את ההגדרה.", details={"change_id": cid})
    if status == "diverged":
        raise ApiError(409, "nvr_diverged", "ה־NVR שינה רק חלק מההגדרות. בדקו את הזרם.", details={"change_id": cid})


def write_stream(conn: sqlite3.Connection, settings: Settings, principal: Any, camera_id: str, stream_ref: str, req: WriteRequest, *, request_id: str | None = None,
                 batch: tuple[str, int] | None = None, adopt: str | None = None) -> dict[str, Any]:
    """API 3.4 / section 4. The caller has passed `require(nvr.configure, INSTALLATION)`, `require_camera` and the body parse.
    Phase C: a batch item passes `batch=(batch_id, index)` (kept in its audit rows) and `adopt` (its queued placeholder row);
    a single write (`batch` None) is refused while a batch runs on the recorder."""
    cam = _camera_row(conn, camera_id)
    rid = cam["recorder_id"]
    adapter = registry.adapter_for(conn, settings, rid)
    base = _details(rid, stream_ref, None, **_batch_details(batch))
    try:
        if batch is None:
            batch_guard(conn, rid)
        _clear_pending(conn, settings, rid, stream_ref)
        with unlocked(conn):  # phase 1: fresh device reads, nothing written
            snap = adapter.read_stream(stream_ref)
            opts = adapter.stream_options(stream_ref) if snap.parsed.get("channel") == cam["channel"] else None
        base["role"] = snap.parsed.get("role")
        if snap.parsed.get("channel") != cam["channel"]:  # the stream belongs to another camera: never written through this one
            raise ApiError(404, "not_found", "הזרם אינו שייך למצלמה הזו.", details={"stream_ref": stream_ref})
        if snap.etag != req.if_match:
            raise ApiError(409, "stale", "ההגדרות השתנו ב־NVR. נטען מחדש.", details={"stream": stream_from_parsed(snap.parsed, opts)})
        assert opts is not None
        if not opts.writable or opts.options is None or opts.write_via is None:
            raise ApiError(503, "capabilities_unreadable", "ה־NVR אינו מפרסם את יכולות הזרם הזה, ולכן השינוי בוטל.", details={"reason": opts.reason})
        effective, fields, unchanged = validate_changes(snap.parsed, opts.options, req.changes)
        if effective:
            document = nvr.stream_document(snap.element, effective)
    except ApiError as exc:
        raise _refuse(conn, principal, "nvr.stream.write", camera_id, exc, base, request_id) from None
    if not effective:  # every requested value is already the device's: no change row, nothing sent
        audit(conn, actor=principal, action="nvr.stream.write", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id,
              details={"phase": "outcome", **base, "status": "unchanged", "unchanged_fields": unchanged})
        return {"change": None, "stream": stream_from_parsed(snap.parsed, opts), "applied_fields": [], "unchanged_fields": unchanged, "reboot_required": False}
    # phase 2: pending row + attempt audit, committed before the device is touched
    try:
        if batch is None:
            batch_guard(conn, rid)  # under the write lock again: a batch may have started during the device reads
        _clear_pending(conn, settings, rid, stream_ref)
        cid = _insert_pending(conn, principal, rid=rid, camera_id=camera_id, stream_ref=stream_ref, path=f"{opts.write_via}:{stream_ref}",
                              before=snap.element, after=document, fields=fields, etag_before=snap.etag, adopt=adopt)
    except ApiError as exc:
        raise _refuse(conn, principal, "nvr.stream.write", camera_id, exc, base, request_id) from None
    audit(conn, actor=principal, action="nvr.stream.write", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id,
          details={"phase": "attempt", **base, "fields": fields, "change_id": cid})
    outcome, error = _device_write(conn, adapter, stream_ref, snap.etag, document, opts.write_via)
    rec, status, verified = _record_outcome(conn, principal, cid=cid, action="nvr.stream.write", camera_id=camera_id, role=str(base["role"]), base=base,
                                            fields=fields, outcome=outcome, error=error, request_id=request_id, adapter=adapter)
    _raise_for(status, error, cid)
    return {"change": rec, "stream": stream_from_parsed(verified.parsed, opts), "applied_fields": sorted(fields), "unchanged_fields": unchanged,
            "reboot_required": bool(outcome.reboot_required)}


def rollback_stream(conn: sqlite3.Connection, settings: Settings, principal: Any, orig: sqlite3.Row, *, request_id: str | None = None,
                    batch: tuple[str, int] | None = None, adopt: str | None = None) -> dict[str, Any]:
    """API 3.5: undo of an applied `stream_encoding` change - a write of its own (same two phases), allowed only while the
    stream still shows exactly what the change left (etag of its `after`). The caller has checked `nvr.configure` at
    installation scope and on the change's camera, and `confirm`."""
    if orig["kind"] != KIND:
        raise ApiError(409, "not_rollbackable", "השינוי הזה אינו שינוי קידוד.")
    camera_id, stream_ref, rid = orig["camera_id"], orig["stream_ref"], orig["recorder_id"]
    base = _details(rid, stream_ref, None, rollback_of=orig["id"], **_batch_details(batch))
    try:
        if batch is None:
            batch_guard(conn, rid)
        # review L4: a `diverged` change (the device took only part of it) is undone like an applied one - the same guards,
        # and only while the stream still shows exactly what that change left (its etag_after)
        if orig["status"] not in ("applied", "diverged") or not orig["before_xml"] or not orig["etag_after"] or not stream_ref or not camera_id:
            raise ApiError(409, "not_rollbackable", "אי אפשר לבטל את השינוי הזה.", details={"status": orig["status"]})
        cam = _camera_row(conn, camera_id)
        adapter = registry.adapter_for(conn, settings, rid)
        _clear_pending(conn, settings, rid, stream_ref)
        with unlocked(conn):
            snap = adapter.read_stream(stream_ref)
            opts = adapter.stream_options(stream_ref)
        base["role"] = snap.parsed.get("role")
        if snap.parsed.get("channel") != cam["channel"]:
            raise ApiError(404, "not_found", "הזרם אינו שייך למצלמה הזו.", details={"stream_ref": stream_ref})
        if snap.etag != orig["etag_after"]:
            raise ApiError(409, "stale", "הזרם השתנה מאז השינוי, ולכן אי אפשר לבטל אותו.", details={"stream": stream_from_parsed(snap.parsed, opts)})
        if not opts.writable or opts.write_via is None:
            raise ApiError(503, "capabilities_unreadable", "ה־NVR אינו מפרסם את יכולות הזרם הזה, ולכן הביטול בוטל.", details={"reason": opts.reason})
        try:
            original = json.loads(orig["fields_json"] or "{}")
        except ValueError:
            original = {}
        # from what the stream shows now back to the original values: for a diverged change only the fields the device
        # really changed (the others already have their old value)
        fields = {k: [field_value(snap.parsed, k), v[0]] for k, v in original.items()
                  if isinstance(v, list) and len(v) == 2 and not _same(field_value(snap.parsed, k), v[0])}
        if not fields:
            raise ApiError(409, "not_rollbackable", "אי אפשר לבטל את השינוי הזה.")
        document = str(orig["before_xml"])
        if batch is None:
            batch_guard(conn, rid)
        _clear_pending(conn, settings, rid, stream_ref)
        cid = _insert_pending(conn, principal, rid=rid, camera_id=camera_id, stream_ref=stream_ref, path=f"{opts.write_via}:{stream_ref}", before=snap.element,
                              after=document, fields=fields, etag_before=snap.etag, rollback_of=orig["id"], note=f"החזר של {orig['id']}", adopt=adopt)
    except ApiError as exc:
        raise _refuse(conn, principal, "nvr.rollback", camera_id or "*", exc, base, request_id) from None
    audit(conn, actor=principal, action="nvr.rollback", decision="allowed", resource_type="camera", resource_id=camera_id, request_id=request_id,
          details={"phase": "attempt", **base, "fields": fields, "change_id": cid})
    outcome, error = _device_write(conn, adapter, stream_ref, snap.etag, document, opts.write_via)
    rec, status, verified = _record_outcome(conn, principal, cid=cid, action="nvr.rollback", camera_id=camera_id, role=str(base["role"]), base=base,
                                            fields=fields, outcome=outcome, error=error, request_id=request_id, rollback_of=orig["id"], adapter=adapter)
    _raise_for(status, error, cid)
    return {"change": rec, "stream": stream_from_parsed(verified.parsed, opts), "rollback_of": orig["id"], "reboot_required": bool(outcome.reboot_required)}


def stream_options(conn: sqlite3.Connection, settings: Settings, camera_id: str, stream_ref: str, codec: str | None = None) -> dict[str, Any]:
    """API 3.3 `GET .../streams/{stream_ref}/options[?codec=]`: one stream's options (capability discovery, device reads only)."""
    cam = _camera_row(conn, camera_id)
    adapter = registry.adapter_for(conn, settings, cam["recorder_id"])
    with unlocked(conn):
        snap = adapter.read_stream(stream_ref)
        if snap.parsed.get("channel") != cam["channel"]:
            raise ApiError(404, "not_found", "הזרם אינו שייך למצלמה הזו.", details={"stream_ref": stream_ref})
        opts = adapter.stream_options(stream_ref, codec)
    writable, reason = _writability(opts)
    return {"camera_id": camera_id, "stream_ref": stream_ref, "codec": codec or snap.parsed.get("codec"), "options": opts.options, "writable": writable, "not_writable_reason": reason}


# ------------------------------------------------------------------------------------------------ S2: the pending janitor

def _settle_one(conn: sqlite3.Connection, settings: Settings, r: sqlite3.Row) -> str | None:
    """Settle one pending change from a fresh device read: `applied` (the device shows the new values), `failed` with
    `error:"interrupted"` (it shows the old ones), `diverged` (anything else). Audited with no actor. Reads only; a device
    that cannot be read leaves the row pending for the next pass."""
    try:
        adapter = registry.adapter_for(conn, settings, r["recorder_id"])
    except ApiError:
        return None
    with unlocked(conn):
        try:
            snap: StreamSnapshot | None = adapter.read_stream(r["stream_ref"])
        except ApiError:
            snap = None
    if snap is None:
        return None
    try:
        fields = json.loads(r["fields_json"] or "{}")
    except ValueError:
        fields = {}
    verdict = classify(snap.parsed, fields) if fields else "diverged"
    status, error = {"applied": ("applied", None), "no_effect": ("failed", "interrupted")}.get(verdict, ("diverged", "diverged"))
    if not conn.execute("UPDATE nvr_changes SET status = ?, error = ?, after_xml = CASE WHEN ? = 'failed' THEN after_xml ELSE ? END, etag_after = ? WHERE id = ? AND status = 'pending'",
                        (status, error, status, snap.element, snap.etag, r["id"])).rowcount:
        return None  # settled by someone else meanwhile
    if status != "failed":
        refresh_registry(conn, r["camera_id"], str(snap.parsed.get("role")), snap.element)
        _forget_options(adapter, str(r["stream_ref"]))
    if status == "applied" and r["rollback_of"]:
        conn.execute("UPDATE nvr_changes SET status = 'rolled_back' WHERE id = ? AND status IN ('applied', 'diverged')", (r["rollback_of"],))
    audit(conn, actor=None, action="nvr.rollback" if r["rollback_of"] else "nvr.stream.write", decision="allowed" if status == "applied" else "denied",
          resource_type="camera", resource_id=r["camera_id"], reason=error,
          details={"phase": "settle", "recorder_id": r["recorder_id"], "stream_ref": r["stream_ref"], "change_id": r["id"], "status": status, "fields": fields})
    return status


def settle_pending(db: Any, settings: Settings, older_than_s: float = PENDING_SETTLE_S) -> int:
    """Janitor (start-up and the housekeeping pass): every due pending stream change is settled from a device read."""
    n = 0
    with db.connection() as conn:
        try:
            rows = conn.execute("SELECT * FROM nvr_changes WHERE status = 'pending' AND kind = ? AND stream_ref IS NOT NULL ORDER BY created_at", (KIND,)).fetchall()
        except sqlite3.OperationalError:
            return 0
        for r in rows:
            if _settle_due(r, older_than_s) and _settle_one(conn, settings, r):
                n += 1
    return n
