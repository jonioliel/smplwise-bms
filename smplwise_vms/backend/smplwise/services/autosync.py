"""Automatic discovery (chapter 19/21): when the add-on has NVR credentials it discovers the channels by
itself at start-up and every few minutes (read-only ISAPI), and when go2rtc is configured it keeps the
product's `smplwise_*` live streams in place. Nobody has to press "sync" before the first camera appears;
the manual buttons remain for an immediate refresh. Results and the last error are visible in /health."""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from typing import Any

from ..audit import audit
from ..config import Settings
from ..db import Database, new_id, now_iso
from ..errors import ApiError
from . import go2rtc as g2
from . import nvr

log = logging.getLogger("smplwise.autosync")
DEFAULT_RECORDER = "nvr-1"
INTERVAL_S = 600

STATE: dict[str, Any] = {"cameras_last_ok": None, "cameras_last_error": None, "cameras_last_run": None, "streams_last_ok": None, "streams_last_error": None, "last_reason": None}


def ensure_recorder(conn: sqlite3.Connection, name: str = "NVR ראשי", model: str | None = None, firmware: str | None = None) -> None:
    conn.execute(
        """INSERT INTO recorders(id, name, model, firmware, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET model = COALESCE(excluded.model, recorders.model), firmware = COALESCE(excluded.firmware, recorders.firmware), last_seen_at = excluded.last_seen_at""",
        (DEFAULT_RECORDER, name, model, firmware, now_iso(), now_iso()),
    )


def sync_cameras(settings: Settings, conn: sqlite3.Connection, actor: Any | None = None, request_id: str | None = None, reason: str = "manual") -> dict[str, Any]:
    """Read-only discovery from the NVR: channels, online flag and track ids. Existing aliases/order survive."""
    info = nvr.device_info(settings)
    channels = nvr.discover_channels(settings)
    ensure_recorder(conn, model=info.get("model") or None, firmware=info.get("firmware") or None)
    now = now_iso()
    created = updated = 0
    for ch in channels:
        status = "online" if ch.online else "offline" if ch.online is False else "unknown"
        caps = json.dumps({"stream": ch.stream} if ch.stream else {}, ensure_ascii=False)
        existing = conn.execute("SELECT id FROM cameras WHERE recorder_id = ? AND channel = ?", (DEFAULT_RECORDER, ch.channel)).fetchone()
        if existing:
            conn.execute(
                "UPDATE cameras SET name_source = ?, main_track = COALESCE(?, main_track), sub_track = COALESCE(?, sub_track), capabilities_json = ?, status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?",
                (ch.name, ch.main_track, ch.sub_track, caps, status, now, now, existing["id"]),
            )
            updated += 1
        else:
            conn.execute(
                "INSERT INTO cameras(id, recorder_id, channel, name_source, sort_order, main_track, sub_track, capabilities_json, status, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (new_id(), DEFAULT_RECORDER, ch.channel, ch.name, ch.channel, ch.main_track, ch.sub_track, caps, status, now, now, now),
            )
            created += 1
    audit(conn, actor=actor, action="cameras.sync", decision="allowed", resource_type="recorder", resource_id=DEFAULT_RECORDER, request_id=request_id,
          details={"channels": len(channels), "created": created, "updated": updated, "model": info.get("model"), "reason": reason})
    return {"channels": len(channels), "created": created, "updated": updated, "recorder": {"model": info.get("model"), "firmware": info.get("firmware")}}


def ensure_streams(settings: Settings, conn: sqlite3.Connection, actor: Any | None = None, request_id: str | None = None, reason: str = "manual") -> dict[str, Any]:
    """Create/refresh the product's namespaced live streams in go2rtc for every enabled camera (idempotent)."""
    client = g2.Go2rtc(settings)
    result: dict[str, Any] = {"created": 0, "updated": 0, "unchanged": 0, "streams": []}
    for cam in conn.execute("SELECT * FROM cameras WHERE enabled = 1 ORDER BY channel").fetchall():
        for profile in ("sub", "main"):
            name = g2.stream_name(cam["recorder_id"], cam["channel"], profile)
            outcome = client.ensure_stream(name, g2.hikvision_rtsp_url(settings, cam["channel"], profile))
            result[outcome] += 1
            result["streams"].append(name)
    foreign = [n for n in client.list_streams() if not n.startswith(g2.STREAM_PREFIX)]
    result["foreign_streams_untouched"] = len(foreign)
    if result["created"] or result["updated"] or reason == "manual":
        audit(conn, actor=actor, action="media.streams.sync", decision="allowed", resource_type="installation", resource_id="*", request_id=request_id,
              details={**{k: v for k, v in result.items() if k != "streams"}, "reason": reason})
    return result


def run_once(db: Database, settings: Settings, reason: str = "startup") -> None:
    """Background discovery: never raises; the outcome is kept in STATE for /health."""
    STATE["last_reason"] = reason
    STATE["cameras_last_run"] = now_iso()
    if not (settings.nvr_host and settings.nvr_user and settings.nvr_password):
        STATE["cameras_last_error"] = "nvr_not_configured"
        return
    try:
        with db.connection() as conn:
            r = sync_cameras(settings, conn, actor=None, reason=reason)
        STATE["cameras_last_ok"] = now_iso()
        STATE["cameras_last_error"] = None
        log.info("auto discovery (%s): %d channels, %d new", reason, r["channels"], r["created"])
    except ApiError as exc:
        STATE["cameras_last_error"] = exc.code
        log.warning("auto discovery (%s) failed: %s %s", reason, exc.code, exc.details)
        return
    except Exception as exc:  # never die
        STATE["cameras_last_error"] = type(exc).__name__
        log.exception("auto discovery (%s) crashed", reason)
        return
    if not settings.go2rtc_url:
        STATE["streams_last_error"] = "media_not_configured"
        return
    try:
        with db.connection() as conn:
            r = ensure_streams(settings, conn, actor=None, reason=reason)
        STATE["streams_last_ok"] = now_iso()
        STATE["streams_last_error"] = None
        if r["created"] or r["updated"]:
            log.info("go2rtc streams (%s): %d created, %d updated, %d foreign untouched", reason, r["created"], r["updated"], r["foreign_streams_untouched"])
    except ApiError as exc:
        STATE["streams_last_error"] = exc.code
        log.warning("go2rtc stream sync (%s) failed: %s", reason, exc.code)
    except Exception as exc:
        STATE["streams_last_error"] = type(exc).__name__
        log.exception("go2rtc stream sync (%s) crashed", reason)


class Periodic:
    def __init__(self) -> None:
        self.last = 0.0

    def due(self) -> bool:
        return time.time() - self.last >= INTERVAL_S

    def mark(self) -> None:
        self.last = time.time()


PERIODIC = Periodic()
