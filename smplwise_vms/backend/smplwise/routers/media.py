"""Live media (T015/T016/T017 server side).

- `POST /media/streams/sync` — create/refresh the product's go2rtc streams for enabled cameras.
- `WS /media/live/{camera_id}/ws?profile=sub|main` — authorized relay to go2rtc's `/api/ws`. The browser
  speaks go2rtc's signalling (WebRTC offer/answer/candidates or MSE fragments) through this socket, so
  neither the go2rtc address nor any source URL is exposed. Sessions are counted and capped.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import sqlite3
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, maybe_bootstrap, resolve_principal, settings_of, touch_user
from ..config import Settings
from ..db import Database
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..services import go2rtc as g2
from ..services.access import camera_allowed
from ..services.relay import relay_ws
from .settings import read_settings

log = logging.getLogger("smplwise.media")
router = APIRouter()


@dataclass
class LiveSession:
    id: str
    camera_id: str
    stream: str
    user_id: str
    username: str
    started_at: float = field(default_factory=time.time)
    bytes_down: int = 0


class SessionRegistry:
    def __init__(self) -> None:
        self.sessions: dict[str, LiveSession] = {}

    def count(self) -> int:
        return len(self.sessions)

    def by_user(self, user_id: str) -> int:
        return sum(1 for s in self.sessions.values() if s.user_id == user_id)


REGISTRY = SessionRegistry()


def _stream_for(conn: sqlite3.Connection, camera_id: str) -> sqlite3.Row:
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not cam:
        raise ApiError(404, "not_found", "המצלמה לא נמצאה.")
    if not cam["enabled"]:
        raise ApiError(409, "camera_disabled", "המצלמה מושבתת במערכת.")
    return cam


def ensure_camera_stream(settings: Settings, cam: sqlite3.Row, profile: str) -> str:
    name = g2.stream_name(cam["recorder_id"], cam["channel"], profile)
    client = g2.Go2rtc(settings)
    client.ensure_stream(name, g2.hikvision_rtsp_url(settings, cam["channel"], profile))
    return name


@router.post("/media/streams/sync")
def sync_streams(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Pre-create our namespaced streams in go2rtc for every enabled camera (idempotent, bounded)."""
    require(conn, principal, "sources.configure", INSTALLATION)
    settings = settings_of(request)
    client = g2.Go2rtc(settings)
    result = {"created": 0, "updated": 0, "unchanged": 0, "streams": []}
    for cam in conn.execute("SELECT * FROM cameras WHERE enabled = 1 ORDER BY channel").fetchall():
        for profile in ("sub", "main"):
            name = g2.stream_name(cam["recorder_id"], cam["channel"], profile)
            outcome = client.ensure_stream(name, g2.hikvision_rtsp_url(settings, cam["channel"], profile))
            result[outcome] += 1
            result["streams"].append(name)
    foreign = [n for n in client.list_streams() if not n.startswith(g2.STREAM_PREFIX)]
    result["foreign_streams_untouched"] = len(foreign)
    audit(conn, actor=principal, action="media.streams.sync", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details={k: v for k, v in result.items() if k != "streams"})
    return result


@router.get("/media/streams")
def list_streams(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "sources.configure", INSTALLATION)
    client = g2.Go2rtc(settings_of(request))
    streams = client.list_streams()
    ours = [{"name": s.name, "online": s.online, "sources": [g2.redact_url(u) for u in s.sources]} for s in streams.values() if s.name.startswith(g2.STREAM_PREFIX)]
    return {"go2rtc": client.info(), "streams": ours, "foreign_streams": len(streams) - len(ours)}


@router.get("/media/sessions")
def list_sessions(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    now = time.time()
    return {
        "sessions": [
            {"id": s.id, "camera_id": s.camera_id, "stream": s.stream, "username": s.username, "seconds": int(now - s.started_at), "bytes_down": s.bytes_down}
            for s in REGISTRY.sessions.values()
        ],
        "max_live_sessions": read_settings(conn)["media.max_live_sessions"],
    }


@router.get("/media/live/{camera_id}")
def live_info(camera_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn), profile: str = Query("sub", pattern="^(sub|main)$")) -> dict[str, Any]:
    """What the player needs before opening the socket: permission, transport default and the relay path."""
    cam = _stream_for(conn, camera_id)
    if not camera_allowed(conn, principal, camera_id, "video.live"):
        require(conn, principal, "video.live", ("installation", "*"))  # raises with audit
    s = read_settings(conn)
    return {
        "camera_id": cam["id"],
        "profile": profile,
        "ws_path": f"api/v1/media/live/{cam['id']}/ws?profile={profile}",
        "transport_default": s["media.transport_default"],
        "max_live_sessions": s["media.max_live_sessions"],
        "active_sessions": REGISTRY.count(),
        "media_configured": bool(settings_of(request).go2rtc_url),
    }


async def _principal_for_ws(websocket: WebSocket) -> Principal | None:
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    class _Req:  # duck-typed view of the websocket for resolve_principal
        headers = websocket.headers
        client = websocket.client

    try:
        principal = resolve_principal(_Req(), settings)  # type: ignore[arg-type]
    except ApiError:
        return None

    def _touch() -> None:
        with db.connection() as conn:
            touch_user(conn, principal)
            maybe_bootstrap(conn, settings, principal, None)

    await run_in_threadpool(_touch)
    return principal


@router.websocket("/media/live/{camera_id}/ws")
async def live_ws(websocket: WebSocket, camera_id: str, profile: str = Query("sub", pattern="^(sub|main)$")) -> None:
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _authorize() -> tuple[bool, sqlite3.Row | None, int]:
        with db.connection() as conn:
            cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
            if not cam or not cam["enabled"]:
                return False, None, 0
            allowed = camera_allowed(conn, principal, camera_id, "video.live")
            if not allowed:
                audit(conn, actor=principal, action="video.live", decision="denied", resource_type="camera", resource_id=camera_id, reason="no_binding")
            return allowed, cam, read_settings(conn)["media.max_live_sessions"]

    allowed, cam, cap = await run_in_threadpool(_authorize)
    if not allowed or cam is None:
        await websocket.close(code=4403)
        return
    if REGISTRY.count() >= cap:
        await websocket.close(code=4429)
        return

    try:
        name = await run_in_threadpool(ensure_camera_stream, settings, cam, profile)
    except ApiError as exc:
        log.warning("live stream for camera %s refused: %s", camera_id, exc.code)
        await websocket.close(code=4503)
        return

    client = g2.Go2rtc(settings)
    session = LiveSession(id=uuid.uuid4().hex[:10], camera_id=camera_id, stream=name, user_id=principal.user_id, username=principal.username)

    def _audit(action: str, details: dict[str, Any]) -> None:
        try:
            with db.connection() as conn:
                audit(conn, actor=principal, action=action, decision="allowed", resource_type="camera", resource_id=camera_id, details=details)
        except sqlite3.Error as exc:  # never let bookkeeping kill or leak a live session
            log.error("audit %s for live session %s failed: %s", action, session.id, exc)

    await websocket.accept()
    REGISTRY.sessions[session.id] = session

    def on_down(n: int) -> None:
        session.bytes_down += n

    try:
        await run_in_threadpool(_audit, "video.live.start", {"session": session.id, "stream": name})
        reason = await relay_ws(websocket, client.ws_url(name), client.ws_headers(), on_down)
        log.info("live session %s ended: %s", session.id, reason)
    except Exception as exc:  # upstream refused / dropped
        log.warning("live session %s upstream failure: %s", session.id, type(exc).__name__)
        with contextlib.suppress(Exception):
            await websocket.send_text('{"type":"error","value":"upstream_unavailable"}')
    finally:
        REGISTRY.sessions.pop(session.id, None)
        with contextlib.suppress(Exception):
            await websocket.close()
        await run_in_threadpool(_audit, "video.live.stop", {"session": session.id, "seconds": int(time.time() - session.started_at), "bytes_down": session.bytes_down})
