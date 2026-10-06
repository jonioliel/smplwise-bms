"""Vendor dispatch for the Frigate recorder (NN5 F1), the counterpart of `vendor_io` for Provision-ISR.

The CR-020 / CR-024 call sites (camera discovery, the snapshot route, the stream sync) were written for Hikvision ISAPI. For a
recorder whose connection names `frigate` they ask this module. Device I/O only toward Frigate (GETs), no permission decisions.
A Frigate recorder never reaches the ISAPI layer: `nvr.ensure_isapi_vendor` already refuses it (409 `vendor_unsupported`)."""
from __future__ import annotations

import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any

from ...config import Settings
from ...errors import ApiError
from .. import nvr
from .frigate import VENDOR, FrigateAdapter

STILL_TTL_S = 2.0
STILL_MAX_INFLIGHT = 4          # concurrent latest.jpg reads per recorder: Frigate re-encodes each one (study risk R4)
STILL_HEIGHT_MIN, STILL_HEIGHT_MAX = 120, 1440
STILL_CACHE_MAX = 64
IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")


def handles(settings: Settings) -> bool:
    return (settings.nvr_vendor or "") == VENDOR


@dataclass
class FrigateChannel(nvr.DiscoveredChannel):
    """A discovered channel with the vendor's own key (ADP 3.2: `source_ref` = the config key, `channel` is synthetic)."""
    source_ref: str = ""
    frigate_enabled: bool = True


def channel_map(conn: sqlite3.Connection, recorder_id: str) -> dict[str, int]:
    try:
        return {r["source_ref"]: int(r["channel"]) for r in conn.execute("SELECT source_ref, channel FROM cameras WHERE recorder_id = ? AND source_ref IS NOT NULL", (recorder_id,)).fetchall()}
    except sqlite3.OperationalError:
        return {}


def adapter_for(conn: sqlite3.Connection, settings: Settings, recorder_id: str) -> FrigateAdapter:
    """The adapter of one recorder, only when that recorder's vendor is Frigate (404 `not_found` otherwise: another vendor's
    recorder id never reaches these routes). The synthetic channel numbers come from the cameras table."""
    from . import registry

    a = registry.adapter_for(conn, settings, recorder_id)
    if not isinstance(a, FrigateAdapter):
        raise ApiError(404, "not_found", "המקליט אינו Frigate.", details={"recorder_id": recorder_id})
    a.channel_map = channel_map(conn, recorder_id)
    return a


def discover(settings: Settings, recorder_id: str, cmap: dict[str, int]) -> tuple[dict[str, Any], list[FrigateChannel], dict[int, dict[str, Any]], str | None]:
    """(device info {model, firmware}, channels, encodings {channel: {"sub": entry}}, encodings error code) - the shape
    `autosync.sync_cameras` takes from `vendor_io.discover`."""
    from ...mode import ensure_nvr, ensure_recorder_enabled

    ensure_nvr(settings)
    ensure_recorder_enabled(settings)
    a = FrigateAdapter(recorder_id, settings)
    a.channel_map = dict(cmap)
    doc = a.discover(refresh=True)
    if not doc["version_ok"]:
        raise ApiError(409, "frigate_version_unsupported", "גרסת Frigate נמוכה מהמינימום הנתמך.", details={"min": doc["min_version"]})
    channels: list[FrigateChannel] = []
    encodings: dict[int, dict[str, Any]] = {}
    for c in a.cameras():
        ch = c["channel"]
        d = c["detect"]
        online = c["online"] if c["enabled"] else False
        stream = {"frigate": True, "enabled": c["enabled"], "reason": None if c["enabled"] else "disabled_in_frigate", "snapshots": c["snapshots"], "ptz": c["ptz"],
                  "labels": c["labels"], "zones": c["zones"], "record": c["record"]["enabled"]}
        channels.append(FrigateChannel(channel=ch, name=c["name"], online=online, main_track=None, sub_track=None, stream=stream, source_ref=c["key"], frigate_enabled=c["enabled"]))
        res = f"{int(d['width'])}x{int(d['height'])}" if d.get("width") and d.get("height") else None
        encodings[ch] = {"sub": {"codec": None, "codec_raw": None, "profile": None, "b_frames": None, "svc": None, "smart_codec": None, "resolution": res,
                                 "fps": d.get("fps"), "gov_length": None, "source": "frigate_config", "webrtc": None, "reason": "frigate_detect_stream"}}
    return {"model": "Frigate", "firmware": doc["version"]}, channels, encodings, None


# ---------------------------------------------------------------------------------------------- pictures

_STILLS: dict[tuple[str, str, int | None], tuple[float, bytes, str]] = {}
_STILL_LOCK = threading.Lock()
_INFLIGHT: dict[str, threading.BoundedSemaphore] = {}


def clamp_height(h: int | None) -> int | None:
    if h is None:
        return None
    return max(STILL_HEIGHT_MIN, min(STILL_HEIGHT_MAX, int(h)))


def still(adapter: FrigateAdapter, camera_key: str, height: int | None = None, now: float | None = None) -> tuple[bytes, str, bool]:
    """The camera's latest frame through Arx: a short cache (STILL_TTL_S) so a wall of tiles costs Frigate one read per camera per
    interval however many viewers there are, and at most STILL_MAX_INFLIGHT concurrent reads per recorder (429 beyond it).
    Returns (bytes, content type, from_cache)."""
    height = clamp_height(height)
    key = (adapter.recorder_id, camera_key, height)
    t = time.monotonic() if now is None else now
    with _STILL_LOCK:
        hit = _STILLS.get(key)
        if hit and t - hit[0] < STILL_TTL_S:
            return hit[1], hit[2], True
        sem = _INFLIGHT.setdefault(adapter.recorder_id, threading.BoundedSemaphore(STILL_MAX_INFLIGHT))
    if not sem.acquire(blocking=False):
        raise ApiError(429, "frigate_busy", "יותר מדי בקשות תמונה במקביל.", retryable=True, details={"max": STILL_MAX_INFLIGHT})
    try:
        data, ctype = adapter.latest_jpeg(camera_key, height)
    finally:
        sem.release()
    if ctype not in IMAGE_TYPES:
        raise ApiError(503, "source_invalid", "Frigate לא החזיר תמונה.")
    with _STILL_LOCK:
        if len(_STILLS) >= STILL_CACHE_MAX:
            for k in sorted(_STILLS, key=lambda k: _STILLS[k][0])[: STILL_CACHE_MAX // 2]:
                _STILLS.pop(k, None)
        _STILLS[key] = (t, data, ctype)
    return data, ctype, False


def clear_stills() -> None:
    with _STILL_LOCK:
        _STILLS.clear()
        _INFLIGHT.clear()


def snapshot(settings: Settings, recorder_id: str, source_ref: str) -> bytes:
    """`cameras.py` snapshot route for a Frigate camera: the latest frame (bytes only; the route stores / serves it)."""
    from ...mode import ensure_nvr, ensure_recorder_enabled

    ensure_nvr(settings)
    ensure_recorder_enabled(settings)
    return still(FrigateAdapter(recorder_id, settings), source_ref)[0]
