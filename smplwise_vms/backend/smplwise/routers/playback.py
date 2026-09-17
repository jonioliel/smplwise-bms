"""Playback sessions (chapter 24, T028): create → relay socket → seek (new generation) → close.

The browser receives a scoped media handle (the relay path), never a source URL. A relay socket of a
superseded generation is closed with 4410 so a late seek result cannot show an old frame."""
from __future__ import annotations

import contextlib
import datetime as dt
import logging
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..config import Settings
from ..db import unlocked, Database
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize
from ..services import revocation, go2rtc as g2
from ..services import playback as pb
from ..services import recordings
from ..services.relay import relay_ws
from ..services.timeutil import UTC, iso_utc, parse_utc
from .media import _principal_for_ws
from .recordings import camera_for_playback
from .settings import read_settings

log = logging.getLogger("smplwise.playback")
router = APIRouter()


class CreateBody(BaseModel):
    camera_id: str
    start_at: str  # UTC ISO


class SeekBody(BaseModel):
    start_at: str


def _segment_for(settings: Settings, conn: sqlite3.Connection, cam: sqlite3.Row, start: dt.datetime, tz_name: str) -> tuple[dt.datetime, dt.datetime]:
    """The recording segment containing `start`, or the next one within six hours (then the session starts
    there and the response says so). No recording at all → 409 no_recording."""
    window_end = start + pb.MAX_SPAN
    with unlocked(conn):
        result = recordings.search_segments(settings, conn, cam, start - dt.timedelta(seconds=1), window_end, tz_name)
    for seg in result.segments:
        s, e = parse_utc(seg.start_at), parse_utc(seg.end_at)
        if s <= start < e:
            return start, e
    for seg in result.segments:
        s, e = parse_utc(seg.start_at), parse_utc(seg.end_at)
        if s > start:
            return s, e
    raise ApiError(409, "no_recording", "אין הקלטה בזמן המבוקש (ובשש השעות שאחריו).", details={"camera": cam["id"], "requested_at": iso_utc(start), "coverage": result.coverage})


def _owned(conn: sqlite3.Connection, principal: Principal, session_id: str) -> pb.PlaybackSession:
    session = pb.REGISTRY.sessions.get(session_id)
    if not session:
        raise ApiError(404, "not_found", "סשן הניגון לא נמצא (אולי פג).")
    if session.user_id != principal.user_id and not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        raise ApiError(403, "forbidden", "סשן הניגון שייך למשתמש אחר.")
    return session


@router.post("/playback/sessions", status_code=201)
def create_session(body: CreateBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    cam = camera_for_playback(conn, principal, body.camera_id)
    if not cam["main_track"]:
        raise ApiError(409, "no_track", "למצלמה אין track הקלטה ידוע; הרץ סנכרון מצלמות.")
    try:
        start = parse_utc(body.start_at)
    except ValueError:
        raise ApiError(422, "validation", "start_at חייב להיות UTC (Z).")
    s = read_settings(conn)
    if not settings.go2rtc_url:
        raise ApiError(503, "media_not_configured", "כתובת go2rtc לא הוגדרה בהגדרות ה־Add-on.")
    actual_start, seg_end = _segment_for(settings, conn, cam, start, s["time.zone"])
    with unlocked(conn):
        session = pb.create(settings, principal, cam, actual_start, seg_end, s["time.zone"], s["playback.max_sessions"])
    audit(conn, actor=principal, action="video.playback.start", decision="allowed", resource_type="camera", resource_id=cam["id"],
          request_id=getattr(request.state, "correlation_id", None), details={"session": session.id, "requested_at": iso_utc(start), "start_at": iso_utc(actual_start)})
    out = pb.to_dict(session, s["playback.lease_s"])
    out["moved_to_next_segment"] = actual_start != start
    return out


@router.get("/playback/sessions")
def list_sessions(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    s = read_settings(conn)
    admin = authorize(conn, principal, "system.configure", INSTALLATION).allowed
    sessions = pb.REGISTRY.active() if admin else pb.REGISTRY.by_user(principal.user_id)
    return {"sessions": [pb.to_dict(x, s["playback.lease_s"]) for x in sessions], "max_sessions": s["playback.max_sessions"], "lease_s": s["playback.lease_s"]}


@router.get("/playback/sessions/{session_id}")
def get_session(session_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    session = _owned(conn, principal, session_id)
    return pb.to_dict(session, read_settings(conn)["playback.lease_s"])


@router.post("/playback/sessions/{session_id}/seek")
def seek_session(session_id: str, body: SeekBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    session = _owned(conn, principal, session_id)
    if session.state in ("closed", "expired"):
        raise ApiError(409, "session_over", "סשן הניגון הסתיים; פתח ניגון חדש.")
    cam = conn.execute("SELECT * FROM cameras WHERE id = ?", (session.camera_id,)).fetchone()
    try:
        start = parse_utc(body.start_at)
    except ValueError:
        raise ApiError(422, "validation", "start_at חייב להיות UTC (Z).")
    s = read_settings(conn)
    actual_start, seg_end = _segment_for(settings, conn, cam, start, s["time.zone"])
    with unlocked(conn):
        pb.seek(settings, session, actual_start, seg_end)
    audit(conn, actor=principal, action="video.playback.seek", decision="allowed", resource_type="camera", resource_id=session.camera_id,
          request_id=getattr(request.state, "correlation_id", None), details={"session": session.id, "generation": session.generation, "start_at": iso_utc(actual_start)})
    out = pb.to_dict(session, s["playback.lease_s"])
    out["moved_to_next_segment"] = actual_start != start
    return out


@router.delete("/playback/sessions/{session_id}")
def close_session(session_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    session = _owned(conn, principal, session_id)
    pb.close(settings_of(request), session)
    audit(conn, actor=principal, action="video.playback.stop", decision="allowed", resource_type="camera", resource_id=session.camera_id,
          request_id=getattr(request.state, "correlation_id", None), details={"session": session.id, "generation": session.generation, "bytes_down": session.bytes_down})
    return {"id": session.id, "state": session.state}


@router.post("/playback/sessions/{session_id}/close")
def close_session_beacon(session_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Same as DELETE, reachable by navigator.sendBeacon on page unload (a beacon can only POST)."""
    session = _owned(conn, principal, session_id)
    if session.state in ("closed", "expired", "failed"):
        return {"id": session.id, "state": session.state}
    pb.close(settings_of(request), session)
    audit(conn, actor=principal, action="video.playback.stop", decision="allowed", resource_type="camera", resource_id=session.camera_id,
          request_id=getattr(request.state, "correlation_id", None), details={"session": session.id, "generation": session.generation, "bytes_down": session.bytes_down, "via": "beacon"})
    return {"id": session.id, "state": session.state}


@router.websocket("/playback/sessions/{session_id}/ws")
async def playback_ws(websocket: WebSocket, session_id: str, generation: int = Query(0)) -> None:
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return
    session = pb.REGISTRY.sessions.get(session_id)
    if not session or session.state in ("closed", "expired", "failed"):
        await websocket.close(code=4404)
        return

    def _admin() -> bool:
        with db.connection() as conn:
            return authorize(conn, principal, "system.configure", INSTALLATION).allowed

    if session.user_id != principal.user_id and not await run_in_threadpool(_admin):
        await websocket.close(code=4403)
        return
    if generation != session.generation:
        await websocket.close(code=4410)  # superseded generation: the client must reconnect with the new one
        return
    if not settings.go2rtc_url:
        await websocket.close(code=4503)
        return

    my_gen = generation
    client = g2.Go2rtc(settings)
    await websocket.accept()
    session.ws_open = True
    session.touch()

    def on_down(n: int) -> None:
        session.bytes_down += n
        session.touch()
        if session.first_frame_at is None:
            session.first_frame_at = time.time()
            session.state = "playing"

    opened_at = time.time()

    def superseded() -> bool:
        return session.generation != my_gen or session.state in ("closed", "expired", "failed") or revocation.revoked_since(session.user_id, opened_at)

    reason = "ended"
    try:
        reason = await relay_ws(websocket, client.ws_url(session.stream), client.ws_headers(), on_down, should_stop=superseded)
    except Exception as exc:  # upstream refused / dropped
        reason = "upstream_failure"
        log.warning("playback session %s upstream failure: %s", session.id, type(exc).__name__)
        with contextlib.suppress(Exception):
            await websocket.send_text('{"type":"error","value":"upstream_unavailable"}')
    finally:
        if session.generation == my_gen:
            session.ws_open = False
            session.touch()
            if session.state == "playing" and reason == "upstream_closed":
                session.state = "ended"  # the NVR reached endtime (or the recording stopped)
            elif session.state == "playing":
                session.state = "paused"
        with contextlib.suppress(Exception):
            await websocket.close(code=4410 if reason == "superseded" else 1000)
        log.info("playback session %s g%s socket closed: %s (%d bytes)", session.id, my_gen, reason, session.bytes_down)
