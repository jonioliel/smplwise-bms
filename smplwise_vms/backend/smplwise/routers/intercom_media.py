"""CR-036 slice S18: a station's live video and two-way audio ("talk") in Arx's own station drawer.

Endpoints (all behind the administrator setting `access.station_media`, OFF by default - `off` | `video` | `video_talk`):

- `GET /access-control/stations/{id}/media` (`access.read` on the station chain): what the drawer may offer - the video
  profiles, the socket path of each, the talk capability - or why not (`state` off / unavailable + `reason`). Built field by
  field from the descriptor (services/intercom_media.py): never a source, an address, a credential or a WisKey token.
- `WS /access-control/stations/{id}/live/ws?profile=sub|main`: the existing live relay of every Arx camera
  (routers/media.py `_live_relay`: one budget `media.max_live_sessions`, the remote cap, lease, audit start / stop), for
  `access.read` AND `video.live` on the station chain (station -> building -> site -> installation, CR-033), within the
  descriptor's per-station viewer limit.
- `POST /access-control/stations/{id}/talk` (`access.call` on the station chain - the owner: the call permission covers
  talk): reserves the station's single talker slot and the caller's single session, audited (`intercom.talk.start`).
- `WS /access-control/talk/{session}/ws`: the session's audio - G.711 frames (20 ms, 8 kHz) from the browser's microphone,
  forwarded to the provider's talk channel only while the floor is held (`talk/ptt` down .. up). WKF01F02-295 (owner 25.10):
  the browser now holds the floor for the whole session (full duplex, the microphone open) and releases it only while the
  operator mutes; the server side is unchanged. Ends on the browser's close
  or stop, the session's expiry, a lost permission (re-checked like a camera lease), the setting turned off, or the upstream
  closing; one end row (`intercom.talk.end`: outcome, duration, frame count - never audio content). WKF01F02-295: when WisKey opened
  the talk with the station's sound (`arx.station_talk_audio.v1`), the same socket carries it back to the browser as binary messages
  (800-byte PCMU packets) - two-way talk; the session and the permission are checked before every packet.
- `POST /access-control/talk/{session}/stop`: ends the caller's own session (idempotent).
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import sqlite3
import time
import uuid
from types import SimpleNamespace
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, Path, Query, Request, WebSocket
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..config import Settings
from ..db import Database, retry_locked
from ..errors import ApiError
from ..rbac import Principal, authorize
from ..services import intercom_authority as ia
from ..services import intercom_media as im
from ..services import intercom_sync
from ..services.leases import CameraLease
from ..services.wiskey_listen_adapter import ReceiveDownlink
from . import media
from .settings import read_settings

router = APIRouter()
log = logging.getLogger("smplwise.intercom.media")

READ = ia.READ
CALL = ia.CALL
LIVE = "video.live"
MAX_STATION_ID = 128
MAX_TEXT = 512


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _gate(permission: str):
    def dep(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
        return ia.require_anywhere(conn, principal, permission, _rid(request))

    return dep


def _served_station(settings: Settings, station_id: str) -> tuple[str, dict[str, Any] | None]:
    """The feed state and the station from the served copy (None: no copy, or no such station)."""
    state, overview = intercom_sync.SYNC.served(settings)
    if overview is None:
        return state, None
    return state, next((s for s in overview.get("stations") or [] if s.get("id") == station_id), None)


def _visible_station(settings: Settings, auth: ia.Authority, station_id: str) -> tuple[str, dict[str, Any]]:
    """The station when the caller sees it (`access.read` on its chain); an off-chain station answers like an absent one."""
    state, station = _served_station(settings, station_id)
    if station is None and state not in intercom_sync.SERVED_STATES:
        raise ApiError(503, "intercom_unavailable", "נתוני בקרת הכניסה אינם זמינים כרגע.", retryable=True, details={"state": state})
    if station is None or not auth.station(READ, station_id):
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה.")
    return state, station


def live_path(station_id: str, profile: str) -> str:
    return f"api/v1/access-control/stations/{quote(station_id, safe='')}/live/ws?profile={profile}"


# ---------------------------------------------------------------- what the drawer may offer

@router.get("/access-control/stations/{station_id}/media")
def station_media(request: Request, auth: ia.Authority = Depends(_gate(READ)), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID)) -> dict[str, Any]:
    """`state`: `off` (the setting; the drawer keeps the still and the classic panel), `unavailable` (+ `reason`: `feed`,
    `offline`, `no_camera`, `no_media`, `no_host`, `no_credentials`, `descriptor_*`, `provider_error`) or `ready`."""
    settings = settings_of(request)
    feed_state, station = _visible_station(settings, auth, station_id)
    mode = im.media_mode(auth.conn)
    body: dict[str, Any] = {"station_id": station_id, "mode": mode, "state": "off", "reason": None, "video": None, "talk": None, "listen": False, "expires_at": None}
    if mode == "off":
        return body
    if feed_state != "ready":
        return {**body, "state": "unavailable", "reason": "feed"}
    if not station.get("online"):
        return {**body, "state": "unavailable", "reason": "offline"}
    try:
        d = im.MEDIA.descriptor(im.provider_for(settings, auth.conn), auth.conn, settings, station)
    except im.Unavailable as exc:
        return {**body, "state": "unavailable", "reason": exc.code}
    live_ok = auth.station(LIVE, station_id)
    video = None
    if d.profiles:
        video = {
            "profiles": [p.public() for p in d.profiles],
            "default_profile": d.default_profile,
            "allowed": live_ok,
            "paths": {p.id: live_path(station_id, p.id) for p in d.profiles} if live_ok else {},
            "max_viewers": d.max_viewers,
            "viewers": im.MEDIA.viewers(station_id),
        }
    if mode != "video_talk":
        talk: dict[str, Any] = {"available": False, "reason": "off"}
    elif not d.talk_transport:
        talk = {"available": False, "reason": "unsupported"}
    elif not auth.station(CALL, station_id):
        talk = {"available": False, "reason": "forbidden"}
    else:
        busy = im.MEDIA.busy(station_id)
        talk = {"available": True, "reason": None, "transport": d.talk_transport, "codec": d.audio_codec, "duplex": d.duplex,
                "max_seconds": im.talk_limit_s(auth.conn, d), "sample_rate": im.SAMPLE_RATE, "frame_ms": im.FRAME_MS, "busy": busy}
    return {**body, "state": "ready", "video": video, "talk": talk, "listen": d.listen, "expires_at": im.iso(d.expires_at)}


# ---------------------------------------------------------------- live video (the existing relay)

class StationLease(CameraLease):
    """The live relay keeps a station's video only while the viewer still sees the station (`access.read` on its chain), holds
    `video.live`, the setting is not `off`, the station is still served and its descriptor (renewed before it expires) still
    offers the profile. Re-checked like a camera lease: on every access change of the user and every leases.RECHECK_S."""

    def __init__(self, db: Database, settings: Settings, principal: Principal, station_id: str, profile: str) -> None:
        super().__init__(db, principal, station_id, LIVE)
        self.settings = settings
        self.station_id = station_id
        self.profile = profile

    def allowed_now(self) -> bool:
        with self.db.connection(mode="read", label=f"lease station media {self.station_id}") as conn:
            auth = ia.Authority(conn, self.principal)
            if not auth.station(READ, self.station_id) or not auth.station(LIVE, self.station_id) or im.media_mode(conn) == "off":
                return False
            _state, station = _served_station(self.settings, self.station_id)
            if station is None:
                return False
            try:
                d = im.MEDIA.descriptor(im.provider_for(self.settings, conn), conn, self.settings, station)
            except im.Unavailable:
                return False
            return d.profile(self.profile) is not None


@router.websocket("/access-control/stations/{station_id}/live/ws")
async def station_live_ws(websocket: WebSocket, station_id: str, profile: str = Query("sub", pattern="^(sub|main)$")) -> None:
    """A station's live video (CR-036 S18) through the existing relay: access.read and video.live on the station chain, the setting on."""
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    principal = await media._principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return
    if not ia.valid_id(station_id) or len(station_id) > MAX_STATION_ID:
        await websocket.close(code=4403)
        return

    def _authorize() -> tuple[Any, str | None]:
        with db.connection() as conn:
            auth = ia.Authority(conn, principal)
            _state, station = _served_station(settings, station_id)
            if station is None or not auth.station(READ, station_id):
                return None, "not_found"
            decision = authorize(conn, principal, LIVE, (ia.STATION_SCOPE, station_id))
            if not decision.allowed:
                audit(conn, actor=principal, action=LIVE, decision="denied", resource_type="intercom_station", resource_id=station_id, reason=decision.reason, under=decision)
                return None, "forbidden"
            if im.media_mode(conn) == "off":
                return None, "off"
            if not station.get("online"):
                return None, "offline"
            try:
                d = im.MEDIA.descriptor(im.provider_for(settings, conn), conn, settings, station)
            except im.Unavailable:
                return None, "unavailable"
            if d.profile(profile) is None:
                return None, "profile"
            s = read_settings(conn)
            return (decision, station, d, s["media.max_live_sessions"], s["remote.max_live_streams"]), None

    granted, why = await run_in_threadpool(_authorize)
    if granted is None:
        await websocket.close(code=4503 if why in ("unavailable", "offline") else 4403)
        return
    decision, station, d, cap, remote_cap = granted
    if media.REGISTRY.count() >= cap:
        await websocket.close(code=4429)
        return
    chain = media._remote_chain(websocket)
    refusal = media.remote_cap_refusal(chain, remote_cap)
    if refusal is not None:
        await media._refuse_remote_cap(websocket, db, principal, station_id, refusal, chain, "intercom_station")
        return
    token = uuid.uuid4().hex
    if not im.MEDIA.add_viewer(station_id, token, d.max_viewers):
        await websocket.close(code=4429)  # the station's own viewer limit (the descriptor's)
        return

    def make_stream() -> str:
        with db.connection(mode="read", label="station media stream") as conn:
            return im.provider_for(settings, conn).video_stream(conn, settings, station, profile, actor=im.w10.Actor(principal.user_id, principal.username))

    try:
        await media._live_relay(
            websocket, settings=settings, db=db, principal=principal, decision=decision, resource_type="intercom_station", resource_id=station_id,
            make_stream=make_stream, lease=StationLease(db, settings, principal, station_id, profile), chain=chain, remote_cap=remote_cap,
            # go2rtc's error frames can carry a source address: never forwarded (the rule of a Home Assistant camera's stream)
            on_text=_sanitize_frame,
        )
    finally:
        im.MEDIA.drop_viewer(station_id, token)
        # WKLIVE-295: the last viewer of a station takes WisKey's leased stream (and its private source) out of go2rtc's memory again
        await run_in_threadpool(im.release_leased_streams, settings, station_id)


def _sanitize_frame(text: str) -> str | None:
    """go2rtc's signalling passes; its `error` frames are replaced by a fixed code (their text may name the source)."""
    try:
        msg = json.loads(text)
    except ValueError:
        return None
    if isinstance(msg, dict) and msg.get("type") == "error":
        return '{"type":"error","value":"upstream_error"}'
    return text


# ---------------------------------------------------------------- talk

class TalkStart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_request_id: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


async def _raw_body(request: Request) -> bytes:
    return await request.body()


def _end_row(conn: sqlite3.Connection, principal: Any, t: im.TalkSession) -> None:
    started = t.opened_at or t.created_at
    duration = max(0, int(round(time.time() - started))) if t.opened_at else 0
    audit(conn, actor=principal, action="intercom.talk.end", decision="allowed", resource_type="intercom_station", resource_id=t.station_id,
          reason=t.outcome, request_id=t.request_id,
          details={"session": t.ref, "outcome": t.outcome, "duration_s": duration, "frames": t.frames, "presses": t.presses, "transport": t.transport})


def _audit_pruned(conn: sqlite3.Connection) -> None:
    for t in im.MEDIA.prune():
        _end_row(conn, SimpleNamespace(user_id=t.user_id, username=t.username), t)


def _refuse(conn: sqlite3.Connection, principal: Principal, station_id: str, rid: str | None, exc: ApiError) -> ApiError:
    audit(conn, actor=principal, action="intercom.talk.start", decision="denied", resource_type="intercom_station", resource_id=station_id, reason=exc.code, request_id=rid)
    return exc


@router.post("/access-control/stations/{station_id}/talk")
def talk_start(request: Request, auth: ia.Authority = Depends(_gate(CALL)), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Reserves the station's talker slot for the caller. Refusals (each one audit row, nothing is sent anywhere): 404
    `intercom_station_not_found` (off the caller's chain or absent), 403 `forbidden` (no `access.call` on this station), 409
    `intercom_talk_off` (the setting), `intercom_station_offline`, `intercom_talk_unavailable`, `intercom_talk_unsupported`
    (no talk transport this build speaks: talk stays in the classic panel), `intercom_talk_busy` (another session at the
    station - who is never said), `intercom_talk_user_busy` (the caller already talks elsewhere), 422 `validation`."""
    settings = settings_of(request)
    conn, principal = auth.conn, auth.principal
    rid = _rid(request)
    try:
        body = TalkStart.model_validate(json.loads(raw)) if raw.strip() else TalkStart()
    except (ValueError, ValidationError) as exc:
        raise _refuse(conn, principal, station_id, rid, ApiError(422, "validation", "בקשת הדיבור אינה תקינה.")) from exc
    rid = body.client_request_id or rid
    feed_state, station = _visible_station(settings, auth, station_id)
    if not auth.station(CALL, station_id):
        audit(conn, actor=principal, action=CALL, decision="denied", resource_type="intercom_station", resource_id=station_id, reason="station_scope", request_id=rid)
        raise ApiError(403, "forbidden", "אין הרשאה לדבר עם העמדה הזו.", details={"permission": CALL})
    if im.media_mode(conn) != "video_talk":
        raise _refuse(conn, principal, station_id, rid, ApiError(409, "intercom_talk_off", "דיבור מתוך המסך כבוי בהגדרות."))
    if feed_state != "ready":
        raise _refuse(conn, principal, station_id, rid, ApiError(503, "intercom_unavailable", "נתוני בקרת הכניסה אינם זמינים כרגע.", retryable=True))
    if not station.get("online"):
        raise _refuse(conn, principal, station_id, rid, ApiError(409, "intercom_station_offline", "העמדה אינה מחוברת."))
    try:
        d = im.MEDIA.descriptor(im.provider_for(settings, conn), conn, settings, station)
    except im.Unavailable as exc:
        raise _refuse(conn, principal, station_id, rid, ApiError(409, "intercom_talk_unavailable", "דיבור עם העמדה אינו זמין כרגע.", details={"reason": exc.code})) from exc
    if not d.talk_transport:
        raise _refuse(conn, principal, station_id, rid, ApiError(409, "intercom_talk_unsupported", "דיבור עם העמדה זמין בלוח הקלאסי בלבד."))
    _audit_pruned(conn)
    t = im.new_talk(station_id, principal.user_id, principal.username, rid, d, limit_s=im.talk_limit_s(conn, d))
    refusal = im.MEDIA.reserve(t)
    if refusal is not None:
        text = "מישהו אחר כבר מדבר עם העמדה." if refusal == "intercom_talk_busy" else "כבר פתוח אצלך דיבור עם עמדה אחרת."
        raise _refuse(conn, principal, station_id, rid, ApiError(409, refusal, text, retryable=refusal == "intercom_talk_busy"))
    audit(conn, actor=principal, action="intercom.talk.start", decision="allowed", resource_type="intercom_station", resource_id=station_id, request_id=rid,
          details={"session": t.ref, "transport": t.transport, "codec": t.codec, "duplex": t.duplex, "max_seconds": int(t.expires_at - t.created_at)})
    return {
        "session": t.id,
        "ws_path": f"api/v1/access-control/talk/{t.id}/ws",
        "expires_at": im.iso(t.expires_at),
        "max_seconds": int(t.expires_at - t.created_at),
        "attach_within_s": int(im.RESERVE_S),
        "transport": t.transport,
        "codec": t.codec,
        "duplex": t.duplex,
        "sample_rate": im.SAMPLE_RATE,
        "frame_ms": im.FRAME_MS,
        "request_id": rid,
    }


@router.post("/access-control/talk/{session_id}/stop")
def talk_stop(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), session_id: str = Path(min_length=16, max_length=64)) -> dict[str, Any]:
    """Ends the caller's own talk session (idempotent); another user's session answers 404 `intercom_talk_not_found`."""
    t = im.MEDIA.talk(session_id)
    if t is None or t.user_id != principal.user_id:
        raise ApiError(404, "intercom_talk_not_found", "הדיבור כבר הסתיים.")
    if t.attached:
        t.stop_requested = "stopped"  # the socket's own watch ends it within a second and writes the end row
    elif im.MEDIA.finish(t, "stopped"):
        _end_row(conn, principal, t)
    return {"stopped": True}


class TalkLease(CameraLease):
    """A talk session keeps going only while its user holds `access.call` on the station and the setting is `video_talk`."""

    def __init__(self, db: Database, principal: Principal, station_id: str) -> None:
        super().__init__(db, principal, station_id, CALL)
        self.station_id = station_id

    def allowed_now(self) -> bool:
        with self.db.connection(mode="read", label=f"lease talk {self.station_id}") as conn:
            return ia.Authority(conn, self.principal).station(CALL, self.station_id) and im.media_mode(conn) == "video_talk"


CLOSE_CODES = {"expired": 4408, "access_lost": 4403, "upstream_unavailable": 4503, "busy": 4423, "upstream_closed": 1000, "stopped": 1000, "ended": 1000}


async def _pump(websocket: WebSocket, t: im.TalkSession, channel: im.TalkChannel, lease: TalkLease) -> str:
    """Browser frames -> the talk channel while the floor is held; the session's watch (expiry, stop, lease) every second."""
    held = False
    window = int(time.time())
    in_window = 0

    async def from_browser() -> str:
        nonlocal held, window, in_window
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                return "ended"
            data = message.get("bytes")
            if data is not None:
                now_s = int(time.time())
                if now_s != window:
                    window, in_window = now_s, 0
                in_window += 1
                if not held or not data or len(data) > im.FRAME_MAX_BYTES or in_window > im.FRAMES_PER_S_MAX:
                    continue  # push-to-talk: nothing reaches the station unless the button is held; oversize / flood dropped
                t.frames += 1
                await channel.send_frame(bytes(data))
                continue
            text = message.get("text") or ""
            if len(text) > MAX_TEXT:
                continue
            try:
                msg = json.loads(text)
            except ValueError:
                continue
            if not isinstance(msg, dict):
                continue
            if msg.get("type") == "talk/ptt" and msg.get("value") in ("down", "up"):
                down = msg["value"] == "down"
                if down and not held:
                    t.presses += 1
                if down != held:
                    held = down
                    await channel.floor(held)
                    await websocket.send_text(json.dumps({"type": "talk/floor", "value": "held" if held else "released"}))
            elif msg.get("type") == "talk/stop":
                return "stopped"

    async def upstream() -> str:
        reason = await channel.wait_closed()
        return "upstream_closed" if reason not in ("stopped", "ended", "expired", "access_lost") else reason

    async def watch() -> str:
        while True:
            await asyncio.sleep(1)
            if time.time() >= t.expires_at:
                return "expired"
            if t.stop_requested:
                return t.stop_requested
            if lease.should_stop():
                return "access_lost"

    async def from_station() -> str:
        """WKF01F02-295 (F02): the station's sound of a two-way talk, through the one downlink adapter (`ReceiveDownlink.for_talk` around the
        channel's `receive_audio`) to the browser as binary messages. A channel without the station's sound (a talk WisKey opened without
        `listen`, a provider that has none) waits here for ever: the talk itself goes on unchanged."""
        receive = getattr(channel, "receive_audio", None)
        if receive is None or getattr(channel, "listening", True) is False:
            await asyncio.Future()
        downlink = ReceiveDownlink.for_talk(receive)
        await downlink.open()
        try:
            async for packet in downlink.frames():
                # no await between the check of the session / the permission and the publication of a packet
                if time.time() >= t.expires_at:
                    return "expired"
                if t.stop_requested:
                    return t.stop_requested
                if lease.should_stop():
                    return "access_lost"
                await websocket.send_bytes(packet)
            return "upstream_closed"  # the station's sound ended (its connection is gone): the talk is over too
        finally:
            await downlink.close("ended")

    tasks = [asyncio.create_task(from_browser()), asyncio.create_task(upstream()),
             asyncio.create_task(watch()), asyncio.create_task(from_station())]
    try:
        done, _pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            if task.exception() is not None:
                log.warning("talk session %s ended by an error: %s", t.ref, type(task.exception()).__name__)
                return "upstream_closed"
        return next(iter(done)).result() if done else "ended"
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        joined = asyncio.gather(*tasks, return_exceptions=True)
        cancelled = False
        while not joined.done():
            try:
                await asyncio.shield(joined)
            except asyncio.CancelledError:
                cancelled = True
        if cancelled:
            raise asyncio.CancelledError


@router.websocket("/access-control/talk/{session_id}/ws")
async def talk_ws(websocket: WebSocket, session_id: str) -> None:
    """One talk session's audio: G.711 frames while push-to-talk is held, to the provider's talk channel; audited at its end."""
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    principal = await media._principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return
    t = im.MEDIA.talk(session_id) if 16 <= len(session_id) <= 64 else None
    if t is None or t.user_id != principal.user_id:
        await websocket.close(code=4404)
        return

    def _write_end() -> None:
        def _w() -> None:
            with db.connection() as conn:
                _end_row(conn, principal, t)

        try:
            retry_locked(_w, what="audit intercom.talk.end")
        except sqlite3.Error as exc:  # bookkeeping never keeps a session open
            log.error("talk end row for %s failed: %s", t.ref, exc)

    if not t.attached and time.time() - t.created_at > im.RESERVE_S:
        if im.MEDIA.finish(t, "never_connected"):
            await run_in_threadpool(_write_end)
        await websocket.close(code=4404)
        return
    if time.time() >= t.expires_at:
        if im.MEDIA.finish(t, "expired"):
            await run_in_threadpool(_write_end)
        await websocket.close(code=4408)
        return
    lease = TalkLease(db, principal, t.station_id)
    if not await run_in_threadpool(lease.allowed_now):
        if im.MEDIA.finish(t, "access_lost"):
            await run_in_threadpool(_write_end)
        await websocket.close(code=4403)
        return
    if not im.MEDIA.attach(t):
        await websocket.close(code=4409)
        return

    def _channel() -> im.TalkChannel:
        with db.connection(mode="read", label="talk descriptor") as conn:
            _state, station = _served_station(settings, t.station_id)
            if station is None:
                raise ApiError(503, "intercom_talk_upstream_unavailable", "העמדה אינה זמינה.")
            provider = im.provider_for(settings, conn)  # REL2140 M-3: one selection - the descriptor and the talk from the same provider
            d = im.MEDIA.descriptor(provider, conn, settings, station)
        return provider.talk_open(settings, t.station_id, d, actor_id=principal.user_id, actor_name=principal.username, request_id=t.request_id,
                                  expires_at=t.expires_at)

    await websocket.accept()
    outcome = "upstream_unavailable"
    channel: im.TalkChannel | None = None
    try:
        channel = await run_in_threadpool(_channel)
        await channel.open()
        t.opened_at = time.time()
        await websocket.send_text(json.dumps({"type": "talk/state", "value": "open", "expires_at": im.iso(t.expires_at), "seconds": int(t.expires_at - time.time())}))
        outcome = await _pump(websocket, t, channel, lease)
    except (ApiError, im.Unavailable) as exc:
        log.info("talk session %s could not open: %s", t.ref, getattr(exc, "code", type(exc).__name__))
        if getattr(exc, "code", None) == "intercom_talk_busy":  # WisKey refused `audio_busy`: the browser is told "busy", not "unavailable"
            outcome = "busy"
    except Exception as exc:  # noqa: BLE001 - an upstream failure ends the session, it never leaks
        log.warning("talk session %s failed: %s", t.ref, type(exc).__name__)
        outcome = "upstream_closed" if t.opened_at else "upstream_unavailable"
    finally:
        if channel is not None:
            with contextlib.suppress(Exception):
                await channel.close(outcome)
        if im.MEDIA.finish(t, outcome):
            await run_in_threadpool(_write_end)
        with contextlib.suppress(Exception):
            await websocket.send_text(json.dumps({"type": "talk/closed", "value": outcome}))
            await websocket.close(code=CLOSE_CODES.get(outcome, 1000))
