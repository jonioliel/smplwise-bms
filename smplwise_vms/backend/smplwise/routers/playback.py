"""Playback sessions (chapter 24, T028): create → relay socket → seek (new generation) → close.

The browser receives a scoped media handle (the relay path), never a source URL. A relay socket of a
superseded generation is closed with 4410 so a late seek result cannot show an old frame."""
from __future__ import annotations

import asyncio
import contextlib
import datetime as dt
import logging
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, WebSocket
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..config import Settings
from ..db import unlocked, Database
from ..errors import ApiError
from ..capabilities import ensure_capability  # NN1: 409 capability_unavailable, after ensure_nvr
from ..mode import ensure_nvr  # NVR-less mode: 409 nvr_not_configured
from ..rbac import INSTALLATION, Principal, authorize
from ..services import go2rtc as g2
from ..services import playback as pb
from ..services import playback_store as store
from ..services import recordings
from ..services.access import require_camera
from ..services.leases import CameraLease
from ..services.relay import close_with_error, relay_ws, sanitize_upstream_frame
from ..services.timeutil import instant_in_repeated_hour, iso_utc, parse_utc, zone
from ..services import video_text  # noqa: F401 - `recordings.*` texts (FIX-VIDEO2-2570)
from ..i18n import localize_for, t as _t
from .media import _json_dumps_error, _principal_for_ws, refuse_media
from .recordings import camera_for_playback
from .settings import read_settings
from ..services.settings_store import setting_value
from ._common import rid as _rid
from ..wire import playback as W
from ..wire import wire

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


def _clock_note(conn: sqlite3.Connection, principal: Principal, out: dict[str, Any], start: dt.datetime, tz_name: str) -> bool:
    """FIX-VIDEO2-2570 (VD2-04): a start inside the hour the autumn change repeats is sent to the recorder as wall-clock digits
    (quirk T4) that name both occurrences, so the recorder may play the other one: the answer says so instead of staying silent."""
    if not instant_in_repeated_hour(start, zone(tz_name)):
        return False
    out["clock_change_note"] = localize_for(conn, principal, _t("recordings.playback_repeated_hour"))
    return True


def _owned(conn: sqlite3.Connection, principal: Principal, session_id: str) -> pb.PlaybackSession:
    session = pb.REGISTRY.sessions.get(session_id)
    if not session:
        raise ApiError(404, "not_found", "סשן הניגון לא נמצא (אולי פג).")
    if session.user_id != principal.user_id and not authorize(conn, principal, "system.configure", INSTALLATION).allowed:
        raise ApiError(403, "forbidden", "סשן הניגון שייך למשתמש אחר.")
    return session


@router.post("/playback/sessions", status_code=201, **wire(W.PlaybackSession))
def create_session(body: CreateBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    cam = camera_for_playback(conn, principal, body.camera_id)
    decision = require_camera(conn, principal, cam["id"], "video.playback")
    if not cam["main_track"]:
        raise ApiError(409, "no_track", "למצלמה אין track הקלטה ידוע; הרץ סנכרון מצלמות.")
    try:
        start = parse_utc(body.start_at)
    except ValueError:
        raise ApiError(422, "validation", "start_at חייב להיות UTC (Z).")
    s = read_settings(conn)
    ensure_nvr(settings)  # NVR-less mode: 409 after the camera permission, before the go2rtc check
    ensure_capability(settings, "playback")  # NN1: no go2rtc = 409 capability_unavailable (was 503 media_not_configured)
    actual_start, seg_end = _segment_for(settings, conn, cam, start, s["time.zone"])
    with unlocked(conn):
        session = pb.create(settings, principal, cam, actual_start, seg_end, s["time.zone"], s["playback.max_sessions"])
    out = pb.to_dict(session, s["playback.lease_s"])
    out["moved_to_next_segment"] = actual_start != start
    ambiguous = _clock_note(conn, principal, out, actual_start, s["time.zone"])
    audit(conn, actor=principal, action="video.playback.start", decision="allowed", resource_type="camera", resource_id=cam["id"],
          request_id=_rid(request), details={"session": session.id, "requested_at": iso_utc(start), "start_at": iso_utc(actual_start),
                                             **({"repeated_hour": True} if ambiguous else {})}, under=decision)
    return out


@router.get("/playback/sessions", **wire(W.PlaybackSessions))
def list_sessions(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    s = read_settings(conn)
    admin = authorize(conn, principal, "system.configure", INSTALLATION).allowed
    sessions = pb.REGISTRY.active() if admin else pb.REGISTRY.by_user(principal.user_id)
    return {"sessions": [pb.to_dict(x, s["playback.lease_s"]) for x in sessions], "max_sessions": s["playback.max_sessions"], "lease_s": s["playback.lease_s"]}


@router.get("/playback/sessions/{session_id}", **wire(W.PlaybackSession))
def get_session(session_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    session = _owned(conn, principal, session_id)
    return pb.to_dict(session, setting_value(conn, "playback.lease_s"))


@router.post("/playback/sessions/{session_id}/seek", **wire(W.PlaybackSession))
def seek_session(session_id: str, body: SeekBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    settings = settings_of(request)
    session = _owned(conn, principal, session_id)
    if session.state in pb.TERMINAL_STATES:
        raise ApiError(409, "session_over", "סשן הניגון הסתיים; פתח ניגון חדש.")
    decision = require_camera(conn, principal, session.camera_id, "video.playback")  # T055: a seek is a new request - re-checked
    cam = store.camera(conn, session.camera_id)
    try:
        start = parse_utc(body.start_at)
    except ValueError:
        raise ApiError(422, "validation", "start_at חייב להיות UTC (Z).")
    s = read_settings(conn)
    actual_start, seg_end = _segment_for(settings, conn, cam, start, s["time.zone"])
    with unlocked(conn):
        pb.seek(settings, session, actual_start, seg_end, max_per_min=int(s.get("playback.max_seeks_per_min", pb.DEFAULT_MAX_SEEKS_PER_MIN)))
    out = pb.to_dict(session, s["playback.lease_s"])
    out["moved_to_next_segment"] = actual_start != start
    ambiguous = _clock_note(conn, principal, out, actual_start, s["time.zone"])
    audit(conn, actor=principal, action="video.playback.seek", decision="allowed", resource_type="camera", resource_id=session.camera_id,
          request_id=_rid(request), details={"session": session.id, "generation": session.generation, "start_at": iso_utc(actual_start),
                                             **({"repeated_hour": True} if ambiguous else {})}, under=decision)
    return out


@router.delete("/playback/sessions/{session_id}", **wire(W.PlaybackClosed))
def close_session(session_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    session = _owned(conn, principal, session_id)
    pb.close(settings_of(request), session)
    audit(conn, actor=principal, action="video.playback.stop", decision="allowed", resource_type="camera", resource_id=session.camera_id,
          request_id=_rid(request), details={"session": session.id, "generation": session.generation, "bytes_down": session.bytes_down,
                                                                               **pb.media_timing(session)})
    return {"id": session.id, "state": session.state}


@router.post("/playback/sessions/{session_id}/close", **wire(W.PlaybackClosed))
def close_session_beacon(session_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Same as DELETE, reachable by navigator.sendBeacon on page unload (a beacon can only POST)."""
    session = _owned(conn, principal, session_id)
    if session.state in pb.TERMINAL_STATES:
        return {"id": session.id, "state": session.state}
    pb.close(settings_of(request), session)
    audit(conn, actor=principal, action="video.playback.stop", decision="allowed", resource_type="camera", resource_id=session.camera_id,
          request_id=_rid(request), details={"session": session.id, "generation": session.generation, "bytes_down": session.bytes_down, "via": "beacon",
                                                                               **pb.media_timing(session)})
    return {"id": session.id, "state": session.state}


# GO2RTC-STREAM-SYNC-2436 (lab 12.11, row 10): HA ingress delivers the 4410 of a replaced generation as a plain close 1000, so the
# player could not tell "another seek owns the session now" from "the recording ended". The socket now says it in one text frame
# first - the same pattern as HEALTH-GO2RTC-2430's error frame before 4503 - and still closes 4410 for a direct connection.
REPLACED_FRAME = '{"type":"replaced","value":"superseded"}'


async def close_replaced(websocket: WebSocket) -> None:
    """Tell a socket of an old generation it was replaced, then close it 4410 (accepted first when it was not yet)."""
    await close_with_error(websocket, REPLACED_FRAME, 4410, close_apart=True)


@router.websocket("/playback/sessions/{session_id}/ws")
async def playback_ws(websocket: WebSocket, session_id: str, generation: int = Query(0)) -> None:
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return
    session = pb.REGISTRY.sessions.get(session_id)
    if not session or session.state in pb.TERMINAL_STATES:
        await websocket.close(code=4404)
        return

    def _admin() -> bool:
        with db.connection() as conn:
            return authorize(conn, principal, "system.configure", INSTALLATION).allowed

    if session.user_id != principal.user_id and not await run_in_threadpool(_admin):
        await websocket.close(code=4403)
        return
    if generation != session.generation:
        await close_replaced(websocket)  # superseded generation: the client must reconnect with the new one
        return
    if not settings.go2rtc_url:
        await refuse_media(websocket, settings, "media_not_configured")  # HEALTH-GO2RTC-2430: the reason survives HA ingress
        return

    my_gen = generation
    client = g2.Go2rtc(settings)
    await websocket.accept()
    session.ws_open = True
    session.touch()

    def on_down(n: int) -> None:
        session.bytes_down += n
        session.touch()
        pb.mark_first_media(session)  # LOWS-BACKEND-2550 (V-08): a late byte never revives a closed / revoked session
        if session.gen_media_ms is None and session.generation == my_gen:
            pb.note_first_media(session, my_gen)  # T074: time to recording (generation 0) / time to seek (later generations), once

    def superseded() -> bool:
        return session.generation != my_gen or session.state in pb.TERMINAL_STATES

    # T055: the socket keeps the camera only while its owner still holds video.playback on it (services/leases.py);
    # an administrator watching someone else's session is checked as themselves
    lease = CameraLease(db, principal, session.camera_id, "video.playback", extra_stop=superseded)
    reason = "ended"
    # PLAYBACK-SCRUB-2341: a seek (or close) stops this socket from its own thread and waits until the upstream socket is closed
    loop = asyncio.get_running_loop()
    stop_evt = asyncio.Event()
    handle = pb.register_relay(session, my_gen)
    handle.bind_stop(lambda: loop.call_soon_threadsafe(stop_evt.set))
    # VIDEO-SECFIX-2520 (deep review V-01): go2rtc's error frames never reach the viewer (the shared fixed code of every relay
    # route); the server keeps the classified, sanitized form only (services/live_diag.py - no address, URL or credential)
    from ..services.live_diag import LiveDiag

    diag = LiveDiag()

    def on_text(text: str) -> str | None:
        with contextlib.suppress(Exception):  # an observer never breaks the relay
            diag.down_text(text)
        return sanitize_upstream_frame(text)

    try:
        try:
            if superseded():  # a seek landed between the accept and here: never open an upstream socket for an old generation
                reason = "superseded"
            else:
                reason = await relay_ws(websocket, client.ws_url(session.stream), client.ws_headers(), on_down, should_stop=lease.should_stop, stop_event=stop_evt,
                                        close_timeout=pb.UPSTREAM_CLOSE_TIMEOUT_S, on_text=on_text)
        finally:
            pb.release_relay(session, my_gen, handle)  # the upstream socket is closed now (relay_ws's `async with` has exited)
        if lease.lost:
            reason = "access_lost"
            session.state = "closed"
            with contextlib.suppress(Exception):
                await run_in_threadpool(pb.close, settings, session, "revoked")
    except Exception as exc:  # upstream refused / dropped
        reason = "upstream_failure"
        log.warning("playback session %s upstream failure: %s", session.id, type(exc).__name__)
        with contextlib.suppress(Exception):
            await websocket.send_text(_json_dumps_error("upstream_unavailable", settings))
    finally:
        if session.generation == my_gen:
            session.ws_open = False
            session.touch()
            if session.state == "playing" and reason == "upstream_closed":
                session.state = "ended"  # the NVR reached endtime (or the recording stopped)
            elif session.state == "playing":
                session.state = "paused"
        if reason == "superseded":
            await close_replaced(websocket)
        else:
            with contextlib.suppress(Exception):
                await websocket.close(code=4403 if reason == "access_lost" else 1000)
        # T074: the same shape as the live socket's line (`first media N ms`, scripts/gate/video_timing.py reads both); the time runs
        # from this generation's request (create / seek), not from the socket's open
        gen_ms = session.gen_media_ms if session.generation == my_gen else None
        log.info("playback session %s g%s socket closed: %s (%d bytes, first media %s ms)", session.id, my_gen, reason, session.bytes_down,
                 gen_ms if gen_ms is not None else "-")
        diag_details = diag.details()
        if diag_details.get("upstream_error"):
            log.warning("playback session %s g%s: go2rtc error %s: %s", session.id, my_gen, diag_details["upstream_error"], diag_details.get("upstream_error_text", ""))
