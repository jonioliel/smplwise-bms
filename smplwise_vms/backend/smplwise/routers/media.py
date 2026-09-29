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
from ..db import Database, retry_locked, unlocked
from ..errors import ApiError
from ..mode import ensure_nvr  # NVR-less mode: 409 nvr_not_configured
from ..rbac import INSTALLATION, Decision, Principal, require
from ..services import autosync
from ..services import go2rtc as g2
from ..services.access import camera_decision, require_camera
from ..services.leases import CameraLease
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
    remote_chain: str | None = None  # CR-008 P2: the remote sign-in (session chain) this stream runs under; None = local


class SessionRegistry:
    def __init__(self) -> None:
        self.sessions: dict[str, LiveSession] = {}

    def count(self) -> int:
        return len(self.sessions)

    def by_user(self, user_id: str) -> int:
        return sum(1 for s in self.sessions.values() if s.user_id == user_id)


REGISTRY = SessionRegistry()


def remote_live_by_chain() -> dict[str, int]:
    """CR-008 P2: live streams per remote sign-in (the sessions list, the per-session cap, /health)."""
    out: dict[str, int] = {}
    for s in list(REGISTRY.sessions.values()):
        if s.remote_chain:
            out[s.remote_chain] = out.get(s.remote_chain, 0) + 1
    return out


REMOTE_CAP_HE = "הגעת למכסת הזרמים החיים בגישה מרחוק ({cap} במקביל לכל כניסה). סגור צפייה אחרת ונסה שוב."


def _remote_chain(conn) -> str | None:
    """The remote sign-in (session chain) a remote request / WebSocket runs under; None on the local channel."""
    from ..remote_channel import is_remote

    if not is_remote(conn):
        return None
    from ..services import ha_user_auth

    s = ha_user_auth.session_of(conn)
    return s.sign_in() if s is not None else None


CAP_AUDIT_EVERY_S = 60.0
_cap_audited: dict[str, tuple[float, int]] = {}  # sign-in -> (last audit row, refusals since)


def cap_audit_details(chain: str | None, cap: int) -> dict[str, Any] | None:
    """Review L2: a player retrying against the cap must not flood the audit log - one row per sign-in per minute, with
    the number of refusals folded into it (`suppressed`); None = count this one and write nothing."""
    key = chain or ""
    now = time.time()
    last, since = _cap_audited.get(key, (0.0, 0))
    if now - last < CAP_AUDIT_EVERY_S:
        _cap_audited[key] = (last, since + 1)
        return None
    if len(_cap_audited) > 2000:
        for k in [k for k, v in _cap_audited.items() if now - v[0] > CAP_AUDIT_EVERY_S]:
            _cap_audited.pop(k, None)
    _cap_audited[key] = (now, 0)
    return {"max": cap, **({"suppressed": since} if since else {})}


def remote_cap_refusal(chain: str | None, cap: int) -> ApiError | None:
    """CR-008 P2 `remote.max_live_streams`: the N+1st live stream of one remote sign-in is refused (429)."""
    if chain is None:
        return None
    active = remote_live_by_chain().get(chain, 0)
    if active < cap:
        return None
    return ApiError(429, "remote_live_cap", REMOTE_CAP_HE.format(cap=cap), retryable=True, details={"max": cap, "active": active})


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
    """Pre-create our namespaced streams in go2rtc for every enabled camera (idempotent, bounded). Also runs
    automatically after each discovery when go2rtc is configured."""
    require(conn, principal, "sources.configure", INSTALLATION)
    ensure_nvr(settings_of(request))  # NVR-less mode: no camera streams to create (after the permission check)
    return autosync.ensure_streams(settings_of(request), conn, actor=principal, request_id=getattr(request.state, "correlation_id", None), reason="manual")


@router.get("/media/streams")
def list_streams(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "sources.configure", INSTALLATION)
    client = g2.Go2rtc(settings_of(request))
    with unlocked(conn):
        streams = client.list_streams()
    ours = [{"name": s.name, "online": s.online, "sources": [g2.redact_source(s.name, u) for u in s.sources]} for s in streams.values() if s.name.startswith(g2.STREAM_PREFIX)]
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
    require_camera(conn, principal, camera_id, "video.live")  # T055: 403 before 404
    ensure_nvr(settings_of(request))  # NVR-less mode: 409 after the permission check
    cam = _stream_for(conn, camera_id)
    s = read_settings(conn)
    chain = _remote_chain(request)
    refusal = remote_cap_refusal(chain, s["remote.max_live_streams"])
    if refusal is not None:
        details = cap_audit_details(chain, s["remote.max_live_streams"])
        if details is not None:
            audit(conn, actor=principal, action="video.live", decision="denied", resource_type="camera", resource_id=camera_id, reason="remote_live_cap",
                  details=details)
        raise refusal
    return {
        "camera_id": cam["id"],
        "profile": profile,
        "ws_path": f"api/v1/media/live/{cam['id']}/ws?profile={profile}",
        "transport_default": s["media.transport_default"],
        "max_live_sessions": s["media.max_live_sessions"],
        "active_sessions": REGISTRY.count(),
        "media_configured": bool(settings_of(request).go2rtc_url),
        **({"remote_live": {"max": s["remote.max_live_streams"], "active": remote_live_by_chain().get(chain, 0)}} if chain else {}),
    }


async def _principal_for_ws(websocket: WebSocket) -> Principal | None:
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    from ..remote_channel import is_remote

    if is_remote(websocket):
        # CR-008: the /arx channel - Origin must be this host, then the Arx session cookie (or an HA bearer token,
        # validated without blocking the event loop); the socket closes when its session is revoked
        from ..services import ha_user_auth

        principal = await ha_user_auth.remote_principal_ws(websocket, settings)
        if principal is None:
            return None
    else:
        class _Req:  # duck-typed view of the websocket for resolve_principal
            headers = websocket.headers
            client = websocket.client
            scope = websocket.scope

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


async def _refuse_remote_cap(websocket: WebSocket, db: Database, principal: Principal, camera_id: str, refusal: ApiError, chain: str | None) -> None:
    """The remote live cap on the socket: accepted first so the browser sees the reason (a close before accept is a
    bare handshake failure), then `{"type":"error","value":"remote_live_cap","message":…}` and close 4429 (the player
    shows its "stream quota reached" state for 4429). Audited like the HTTP refusal (throttled per sign-in)."""
    import json as _json

    details = cap_audit_details(chain, int(refusal.details.get("max") or 0))

    def _write() -> None:
        with db.connection() as conn:
            audit(conn, actor=principal, action="video.live", decision="denied", resource_type="camera", resource_id=camera_id, reason="remote_live_cap",
                  details=details)

    if details is not None:
        with contextlib.suppress(Exception):
            await run_in_threadpool(_write)
    with contextlib.suppress(Exception):
        if websocket.client_state.name == "CONNECTING":
            await websocket.accept()
        await websocket.send_text(_json.dumps({"type": "error", "value": "remote_live_cap", "message": refusal.user_message,
                                              "max": refusal.details.get("max")}, ensure_ascii=False))
        await websocket.close(code=4429)


@router.websocket("/media/live/{camera_id}/ws")
async def live_ws(websocket: WebSocket, camera_id: str, profile: str = Query("sub", pattern="^(sub|main)$")) -> None:
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _authorize() -> tuple[Decision | None, sqlite3.Row | None, int, int]:
        with db.connection() as conn:
            cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
            if not cam or not cam["enabled"]:
                return None, None, 0, 0
            decision = camera_decision(conn, principal, camera_id, "video.live")
            if not decision.allowed:
                audit(conn, actor=principal, action="video.live", decision="denied", resource_type="camera", resource_id=camera_id, reason=decision.reason, under=decision)
            s = read_settings(conn)
            return decision, cam, s["media.max_live_sessions"], s["remote.max_live_streams"]

    decision, cam, cap, remote_cap = await run_in_threadpool(_authorize)
    allowed = bool(decision and decision.allowed)
    if not allowed or cam is None:
        await websocket.close(code=4403)
        return
    if REGISTRY.count() >= cap:
        await websocket.close(code=4429)
        return
    chain = _remote_chain(websocket)  # CR-008 P2: the remote sign-in's own budget (remote.max_live_streams)
    refusal = remote_cap_refusal(chain, remote_cap)
    if refusal is not None:
        await _refuse_remote_cap(websocket, db, principal, camera_id, refusal, chain)
        return

    try:
        name = await run_in_threadpool(ensure_camera_stream, settings, cam, profile)
    except ApiError as exc:
        log.warning("live stream for camera %s refused: %s", camera_id, exc.code)
        await websocket.close(code=4503)
        return

    client = g2.Go2rtc(settings)
    session = LiveSession(id=uuid.uuid4().hex[:10], camera_id=camera_id, stream=name, user_id=principal.user_id, username=principal.username,
                          remote_chain=chain)

    # T055: the relay keeps the camera only while the viewer still holds video.live on it (re-checked on every access
    # change of the user and every leases.RECHECK_S) - a revoke of an unrelated camera no longer ends this stream
    lease = CameraLease(db, principal, camera_id, "video.live")

    def _audit(action: str, details: dict[str, Any]) -> None:
        def _write() -> None:
            with db.connection() as conn:
                audit(conn, actor=principal, action=action, decision="allowed", resource_type="camera", resource_id=camera_id, details=details, under=decision)

        try:
            retry_locked(_write, what=f"audit {action}")  # a busy database delays the row, it does not lose it
        except sqlite3.Error as exc:  # never let bookkeeping kill or leak a live session
            log.error("audit %s for live session %s failed: %s", action, session.id, exc)

    await websocket.accept()
    # re-checked with nothing awaited before the registration: two starts of one sign-in cannot both pass the cap
    refusal = remote_cap_refusal(chain, remote_cap)
    if refusal is not None:
        await _refuse_remote_cap(websocket, db, principal, camera_id, refusal, chain)
        return
    REGISTRY.sessions[session.id] = session

    def on_down(n: int) -> None:
        session.bytes_down += n

    reason = "ended"
    try:
        await run_in_threadpool(_audit, "video.live.start", {"session": session.id, "stream": name})
        reason = await relay_ws(websocket, client.ws_url(name), client.ws_headers(), on_down, should_stop=lease.should_stop)
        if lease.lost:
            reason = "access_lost"
        log.info("live session %s ended: %s", session.id, reason)
    except Exception as exc:  # upstream refused / dropped
        reason = "upstream_failure"
        log.warning("live session %s upstream failure: %s", session.id, type(exc).__name__)
        with contextlib.suppress(Exception):
            await websocket.send_text('{"type":"error","value":"upstream_unavailable"}')
    finally:
        REGISTRY.sessions.pop(session.id, None)
        with contextlib.suppress(Exception):
            if reason == "access_lost":
                await websocket.send_text('{"type":"error","value":"access_lost"}')
                await websocket.close(code=4403)
            else:
                await websocket.close()
        await run_in_threadpool(_audit, "video.live.stop", {"session": session.id, "seconds": int(time.time() - session.started_at), "bytes_down": session.bytes_down, "reason": reason})
