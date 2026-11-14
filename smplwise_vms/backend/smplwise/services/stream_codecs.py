"""CR-008 D7: which camera streams a browser can play over WebRTC, kept in the camera capability registry.

The discovery (services/autosync) reads the NVR's streaming channels once per run (`GET /ISAPI/Streaming/channels`,
read-only, nvr.fetch_stream_encodings) and stores, per camera, `capabilities_json["encoding"]`:

    {"main": {codec, profile, b_frames, svc, smart_codec, resolution, fps, gov_length, source, webrtc, reason},
     "sub": {...}, "checked_at": iso, "error": code|null}

`webrtc` is `ok` | `no` | `unknown` (nvr.webrtc_verdict). When the streaming document cannot be read, the last reading
from it is kept; without one the recording track's Description is the fallback (`source: "track"`). The Hebrew hint is
built when it is shown (the camera's current name, the recorder model from deviceInfo). The
remote player (frontend/src/api/video-policy.ts) skips WebRTC for a stream whose verdict is `no`; `/health`, the health
report, הגדרות › גישה מרחוק and the setup wizard's NVR step show the counts and the hints. Nothing here writes to a
device.
"""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from . import nvr

REASON_HE = {
    "h265": "מקודד H.265",
    "mjpeg": "מקודד MJPEG",
    "b_frames": "מקודד H.264 עם B-frames",
    "svc": "מקודד H.264 עם SVC",
}


def is_hikvision(model: str | None) -> bool:
    m = (model or "").strip().upper()
    return m.startswith(("DS-", "IDS-"))


def fix_path(channel: int, enc: dict[str, Any], model: str | None) -> str:
    """Where to change the main stream. The device model comes from ISAPI deviceInfo: for a Hikvision recorder the
    menu of its web interface (4.x), otherwise the generic path."""
    fixes: list[str] = []
    if enc.get("codec") != "H.264":
        fixes.append("H.264")
    if enc.get("svc"):
        fixes.append("SVC off")
    fixes.append("B-frames off")
    if is_hikvision(model):
        return f"NVR {model} → Configuration → Video/Audio → Video → Camera {channel} → Main Stream (Continuous) → Video Encoding: {', '.join(fixes)}"
    return f"NVR → Encoding → Main stream → {', '.join(fixes)}"


def main_hint(name: str, channel: int, enc: dict[str, Any] | None, model: str | None) -> str | None:
    """The Hebrew settings hint for a main stream that will not play over WebRTC; None when it will (or is unknown)."""
    if not enc or enc.get("webrtc") != "no":
        return None
    what = REASON_HE.get(str(enc.get("reason")), f"מקודד {enc.get('codec') or '?'}")
    return f"הזרם הראשי של {name} {what} - לא יתנגן ב-WebRTC; לשינוי: {fix_path(channel, enc, model)}"


def build(channel: nvr.DiscoveredChannel, isapi: dict[str, dict[str, Any]] | None, previous: dict[str, Any] | None, *,
          error: str | None, now: str) -> dict[str, Any] | None:
    """The registry entry for one camera after a discovery run."""
    isapi = isapi or {}
    if error and not isapi and previous and (previous.get("main") or {}).get("source") == "isapi":
        # the streaming document failed this time: keep the last reading from it (a track Description knows less)
        return {**previous, "error": error}
    main = isapi.get("main") or nvr.encoding_from_track(channel.stream)
    sub = isapi.get("sub") or nvr.encoding_from_track(channel.sub_stream)
    if not main and not sub:
        return {"main": None, "sub": None, "checked_at": now, "error": error} if error else None
    return {"main": main, "sub": sub, "checked_at": now, "error": error}


def recorder_model(conn: sqlite3.Connection, recorder_id: str | None = None) -> str | None:
    """The model of the camera's own recorder (CR-024); without an id, the first recorder (the single-recorder default)."""
    if recorder_id:
        row = conn.execute("SELECT model FROM recorders WHERE id = ?", (recorder_id,)).fetchone()
    else:
        row = conn.execute("SELECT model FROM recorders ORDER BY id LIMIT 1").fetchone()
    return (row["model"] if row else None) or None


def camera_name(row: sqlite3.Row) -> str:
    return row["alias"] or row["name_source"] or f"ערוץ {row['channel']}"


def hints(conn: sqlite3.Connection, rows: list[sqlite3.Row] | None = None) -> list[dict[str, Any]]:
    """One entry per enabled camera whose main stream will not play over WebRTC, with its Hebrew hint."""
    models: dict[str | None, str | None] = {}
    rows = rows if rows is not None else conn.execute("SELECT * FROM cameras WHERE enabled = 1 ORDER BY sort_order, channel").fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        main = (encoding_of(r) or {}).get("main")
        rid = r["recorder_id"] if "recorder_id" in r.keys() else None
        if rid not in models:
            models[rid] = recorder_model(conn, rid)  # CR-024: each camera's own recorder
        hint = main_hint(camera_name(r), int(r["channel"]), main, models[rid])
        if hint:
            out.append({"camera_id": r["id"], "name": camera_name(r), "channel": r["channel"], "reason": main.get("reason"), "hint": hint})  # type: ignore[union-attr]
    return out


def encoding_of(row: sqlite3.Row) -> dict[str, Any] | None:
    try:
        caps = json.loads(row["capabilities_json"] or "{}")
    except (ValueError, TypeError):
        return None
    enc = caps.get("encoding")
    return enc if isinstance(enc, dict) else None


def _count() -> dict[str, int]:
    return {"ok": 0, "no": 0, "unknown": 0}


def summary(conn: sqlite3.Connection, *, with_names: bool = False) -> dict[str, Any]:
    """Counts over the enabled cameras: how many main / sub streams play over WebRTC (`ok`), will not (`no`) or are not
    known. `with_names` adds the cameras whose main stream will not, with their hints (the health report, admins only)."""
    rows = conn.execute("SELECT * FROM cameras WHERE enabled = 1 ORDER BY sort_order, channel").fetchall()
    main, sub = _count(), _count()
    checked = 0
    last = ""
    for r in rows:
        enc = encoding_of(r)
        if not enc or not (enc.get("main") or enc.get("sub")):
            continue
        checked += 1
        last = max(last, str(enc.get("checked_at") or ""))
        for bucket, key in ((main, "main"), (sub, "sub")):
            verdict = str((enc.get(key) or {}).get("webrtc") or "unknown")
            bucket[verdict if verdict in bucket else "unknown"] += 1
    out: dict[str, Any] = {"cameras": len(rows), "checked": checked, "main": main, "sub": sub, "checked_at": last or None}
    if with_names:
        out["main_not_webrtc"] = hints(conn, rows)
    return out
