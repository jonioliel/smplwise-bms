"""WKAUDIN-295: listening to a station - its audio TO Arx's operator screen (read-only toward the station: nothing is sent to it).

Endpoints (all behind the administrator setting `access.station_listen`, OFF by default - `off` | `on` | `probe`, services/intercom_listen.py;
the descriptor's `audio.listen` must also say yes unless the administrator chose `probe` for a shared session with the owner):

- `GET /access-control/stations/{id}/listen` (`access.read` on the station chain): whether the drawer may offer listening, or why not.
- `POST /access-control/stations/{id}/listen` (`access.call` on the station chain, like talk): reserves a listen session, audited
  (`intercom.listen.start`, a refusal is a `denied` row with its code).
- `WS /access-control/listen/{session}/ws`: the session's audio - G.711 mu-law 8 kHz frames of 160 bytes, binary, newest wins, nothing
  queued for later - plus small text events (`listen/state`, `listen/closed`). The browser can send `listen/stop` and nothing else.
  Ends on the browser's stop or close, the expiry, a lost permission (re-checked like a camera lease), the setting turned off or the
  upstream closing; one end row (`intercom.listen.end`: outcome, duration, frame count - never audio content).
- `POST /access-control/listen/{session}/stop`: ends the caller's own session (idempotent).

The downlink itself is WisKey's and its contract is not published yet: the channel comes from the provider (`listen_open`), and the real
provider's channel answers `downlink_pending` (services/wiskey_listen_adapter.py is the one place that changes when the contract exists).
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import sqlite3
import time
from types import SimpleNamespace
from typing import Any

from fastapi import APIRouter, Depends, Path, Request, WebSocket
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal_ro, get_read_conn, settings_of
from ..config import Settings
from ..db import Database, retry_locked
from ..errors import ApiError
from ..rbac import Principal
from ..services import intercom_authority as ia
from ..services import intercom_listen as il
from ..services import intercom_media as im
from ..services import wiskey_listen_adapter as adapter
from ..services.leases import CameraLease
from . import media
from .intercom_media import CALL, MAX_STATION_ID, READ, _gate, _rid, _served_station, _visible_station

router = APIRouter()
log = logging.getLogger("smplwise.intercom.listen")

MAX_TEXT = 512


class ListenStart(BaseModel):
    model_config = ConfigDict(extra="forbid")
    client_request_id: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


async def _raw_body(request: Request) -> bytes:
    return await request.body()


def _end_row(conn: sqlite3.Connection, principal: Any, s: il.ListenSession) -> None:
    started = s.opened_at or s.created_at
    duration = max(0, int(round(time.time() - started))) if s.opened_at else 0
    audit(conn, actor=principal, action="intercom.listen.end", decision="allowed", resource_type="intercom_station", resource_id=s.station_id,
          reason=s.outcome, request_id=s.request_id,
          details={"session": s.ref, "outcome": s.outcome, "duration_s": duration, "frames": s.frames, "dropped": s.dropped, "mode": s.mode})


def _audit_pruned(conn: sqlite3.Connection) -> None:
    for s in il.LISTEN.prune():
        _end_row(conn, SimpleNamespace(user_id=s.user_id, username=s.username), s)


def _refuse(conn: sqlite3.Connection, principal: Principal, station_id: str, rid: str | None, exc: ApiError) -> ApiError:
    audit(conn, actor=principal, action="intercom.listen.start", decision="denied", resource_type="intercom_station", resource_id=station_id, reason=exc.code, request_id=rid)
    return exc


# ---------------------------------------------------------------- what the drawer may offer

@router.get("/access-control/stations/{station_id}/listen")
def listen_capability(request: Request, auth: ia.Authority = Depends(_gate(READ)), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID)) -> dict[str, Any]:
    """`available` false with a short `reason`: `off` (the setting), `forbidden` (no `access.call` on the station), `feed`, `offline`,
    `unavailable`, `unsupported` (this provider has no downlink), `no_listen` (the station does not say it can be listened to)."""
    settings = settings_of(request)
    feed_state, station = _visible_station(settings, auth, station_id)
    body: dict[str, Any] = {"station_id": station_id, "available": False, "reason": "off", "codec": adapter.CODEC, "sample_rate": adapter.SAMPLE_RATE,
                            "frame_ms": adapter.FRAME_MS, "max_seconds": None, "listeners": il.LISTEN.listeners(station_id)}
    mode = il.listen_mode(auth.conn)
    if mode == "off":
        return body
    if not auth.station(CALL, station_id):
        return {**body, "reason": "forbidden"}
    if feed_state != "ready":
        return {**body, "reason": "feed"}
    if not station.get("online"):
        return {**body, "reason": "offline"}
    try:
        provider = im.provider_for(settings, auth.conn)
        d = im.MEDIA.descriptor(provider, auth.conn, settings, station)
    except im.Unavailable:
        return {**body, "reason": "unavailable"}
    ok, reason = il.availability(mode, d, provider)
    return {**body, "available": ok, "reason": reason, "max_seconds": im.talk_limit_s(auth.conn, d) if ok else None}


# ---------------------------------------------------------------- start / stop

@router.post("/access-control/stations/{station_id}/listen")
def listen_start(request: Request, auth: ia.Authority = Depends(_gate(CALL)), station_id: str = Path(min_length=1, max_length=MAX_STATION_ID), raw: bytes = Depends(_raw_body)) -> dict[str, Any]:
    """Reserves a listen session for the caller. Refusals (each one an audit row, nothing is sent anywhere): 404
    `intercom_station_not_found`, 403 `forbidden` (no `access.call` on this station), 409 `intercom_listen_off` (the setting),
    `intercom_station_offline`, `intercom_listen_unavailable`, `intercom_listen_unsupported`, `intercom_listen_no_listen`,
    `intercom_listen_busy` (the station's listeners are at the limit), `intercom_listen_user_busy` (the caller already listens
    elsewhere), 422 `validation`."""
    settings = settings_of(request)
    conn, principal = auth.conn, auth.principal
    rid = _rid(request)
    try:
        body = ListenStart.model_validate(json.loads(raw)) if raw.strip() else ListenStart()
    except (ValueError, ValidationError) as exc:
        raise _refuse(conn, principal, station_id, rid, ApiError(422, "validation", "בקשת ההאזנה אינה תקינה.")) from exc
    rid = body.client_request_id or rid
    feed_state, station = _visible_station(settings, auth, station_id)
    if not auth.station(CALL, station_id):
        audit(conn, actor=principal, action=CALL, decision="denied", resource_type="intercom_station", resource_id=station_id, reason="station_scope", request_id=rid)
        raise ApiError(403, "forbidden", "אין הרשאה להאזין לעמדה הזו.", details={"permission": CALL})
    mode = il.listen_mode(conn)
    if mode == "off":
        raise _refuse(conn, principal, station_id, rid, ApiError(409, "intercom_listen_off", "האזנה לעמדה כבויה בהגדרות."))
    if feed_state != "ready":
        raise _refuse(conn, principal, station_id, rid, ApiError(503, "intercom_unavailable", "נתוני בקרת הכניסה אינם זמינים כרגע.", retryable=True))
    if not station.get("online"):
        raise _refuse(conn, principal, station_id, rid, ApiError(409, "intercom_station_offline", "העמדה אינה מחוברת."))
    try:
        provider = im.provider_for(settings, conn)
        d = im.MEDIA.descriptor(provider, conn, settings, station)
    except im.Unavailable as exc:
        raise _refuse(conn, principal, station_id, rid, ApiError(409, "intercom_listen_unavailable", "האזנה לעמדה אינה זמינה כרגע.", details={"reason": exc.code})) from exc
    ok, reason = il.availability(mode, d, provider)
    if not ok:
        code = {"unsupported": "intercom_listen_unsupported", "no_listen": "intercom_listen_no_listen"}.get(reason or "", "intercom_listen_unavailable")
        raise _refuse(conn, principal, station_id, rid, ApiError(409, code, "האזנה לעמדה אינה זמינה."))
    _audit_pruned(conn)
    s = il.new_listen(station_id, principal.user_id, principal.username, rid, mode, limit_s=im.talk_limit_s(conn, d))
    refusal = il.LISTEN.reserve(s)
    if refusal is not None:
        text = "יותר מדי מאזינים לעמדה." if refusal == "intercom_listen_busy" else "כבר פתוחה אצלך האזנה לעמדה אחרת."
        raise _refuse(conn, principal, station_id, rid, ApiError(409, refusal, text, retryable=refusal == "intercom_listen_busy"))
    audit(conn, actor=principal, action="intercom.listen.start", decision="allowed", resource_type="intercom_station", resource_id=station_id, request_id=rid,
          details={"session": s.ref, "mode": mode, "codec": adapter.CODEC, "max_seconds": int(s.expires_at - s.created_at)})
    return {
        "session": s.id,
        "ws_path": f"api/v1/access-control/listen/{s.id}/ws",
        "expires_at": im.iso(s.expires_at),
        "max_seconds": int(s.expires_at - s.created_at),
        "attach_within_s": int(il.RESERVE_S),
        "codec": adapter.CODEC,
        "sample_rate": adapter.SAMPLE_RATE,
        "frame_ms": adapter.FRAME_MS,
        "request_id": rid,
    }


@router.post("/access-control/listen/{session_id}/stop")
def listen_stop(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn), session_id: str = Path(min_length=16, max_length=64)) -> dict[str, Any]:
    """Ends the caller's own listen session (idempotent); another user's session answers 404 `intercom_listen_not_found`."""
    s = il.LISTEN.get(session_id)
    if s is None or s.user_id != principal.user_id:
        raise ApiError(404, "intercom_listen_not_found", "ההאזנה כבר הסתיימה.")
    if s.attached:
        s.stop_requested = "stopped"  # the socket's own watch ends it within a second and writes the end row
    elif il.LISTEN.finish(s, "stopped"):
        _end_row(conn, principal, s)
    return {"stopped": True}


# ---------------------------------------------------------------- the socket

class ListenLease(CameraLease):
    """A listen session keeps going only while its user holds `access.call` on the station and the setting is not `off`."""

    def __init__(self, db: Database, principal: Principal, station_id: str) -> None:
        super().__init__(db, principal, station_id, CALL)
        self.station_id = station_id

    def allowed_now(self) -> bool:
        with self.db.connection(mode="read", label=f"lease listen {self.station_id}") as conn:
            return ia.Authority(conn, self.principal).station(CALL, self.station_id) and il.listen_mode(conn) != "off"


CLOSE_CODES = {"expired": 4408, "access_lost": 4403, "upstream_unavailable": 4503, "upstream_closed": 1000, "stopped": 1000, "ended": 1000, "never_connected": 4404}


async def _pump(websocket: WebSocket, s: il.ListenSession, channel: adapter.ListenChannel, lease: ListenLease) -> str:
    """The downlink's frames -> the browser (newest wins); the browser may only stop; the session's watch runs every second."""

    async def to_browser() -> str:
        # the frames end when the channel ends (the one rule of ListenChannel.frames): everything it still holds goes out first.
        # ADOPTR6-295 (W-001/M5, WMR6-DOWNLINK-02): a natural end keeps the admitted tail, so the natural end is NOT a security fence. Every
        # frame - the tail included - is published only after the CURRENT admission: the lease's awaited `confirm` (a moved access
        # generation is re-checked, fail closed), then with no await before the publication the session expiry, a stop and the lease.
        # A refusal returns its reason; `listen_ws` then calls the channel's explicit `close(outcome)` (fence, drain, join the producer).
        async for frame in channel.frames():
            confirm = getattr(lease, "confirm", None)
            if confirm is not None and not await confirm():
                return "access_lost"
            if time.time() >= s.expires_at:
                return "expired"
            if s.stop_requested:
                return s.stop_requested
            if lease.should_stop():
                return "access_lost"
            s.frames += 1
            await websocket.send_bytes(frame)
        reason = await channel.wait_closed()
        return "upstream_closed" if reason not in ("stopped", "ended", "expired", "access_lost") else reason

    async def from_browser() -> str:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                return "ended"
            text = message.get("text") or ""
            if message.get("bytes") is not None or len(text) > MAX_TEXT:
                continue  # nothing flows up to the station: binary and oversize text are ignored
            try:
                msg = json.loads(text)
            except ValueError:
                continue
            if isinstance(msg, dict) and msg.get("type") == "listen/stop":
                return "stopped"

    async def watch() -> str:
        while True:
            await asyncio.sleep(1)
            if time.time() >= s.expires_at:
                return "expired"
            if s.stop_requested:
                return s.stop_requested
            if lease.should_stop():
                return "access_lost"

    tasks = [asyncio.create_task(to_browser()), asyncio.create_task(from_browser()), asyncio.create_task(watch())]
    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()
        with contextlib.suppress(BaseException):
            await task
    for task in done:
        if task.exception() is not None:
            log.warning("listen session %s ended by an error: %s", s.ref, type(task.exception()).__name__)
            return "upstream_closed"
        return task.result()
    return "ended"


@router.websocket("/access-control/listen/{session_id}/ws")
async def listen_ws(websocket: WebSocket, session_id: str) -> None:
    """One listen session's audio: G.711 frames from the station's downlink to the browser; audited at its end."""
    settings: Settings = websocket.app.state.settings
    db: Database = websocket.app.state.db

    principal = await media._principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return
    s = il.LISTEN.get(session_id) if 16 <= len(session_id) <= 64 else None
    if s is None or s.user_id != principal.user_id:
        await websocket.close(code=4404)
        return

    def _write_end() -> None:
        def _w() -> None:
            with db.connection() as conn:
                _end_row(conn, principal, s)

        try:
            retry_locked(_w, what="audit intercom.listen.end")
        except sqlite3.Error as exc:  # bookkeeping never keeps a session open
            log.error("listen end row for %s failed: %s", s.ref, exc)

    if not s.attached and time.time() - s.created_at > il.RESERVE_S:
        if il.LISTEN.finish(s, "never_connected"):
            await run_in_threadpool(_write_end)
        await websocket.close(code=4404)
        return
    if time.time() >= s.expires_at:
        if il.LISTEN.finish(s, "expired"):
            await run_in_threadpool(_write_end)
        await websocket.close(code=4408)
        return
    lease = ListenLease(db, principal, s.station_id)
    if not await run_in_threadpool(lease.allowed_now):
        if il.LISTEN.finish(s, "access_lost"):
            await run_in_threadpool(_write_end)
        await websocket.close(code=4403)
        return
    if not il.LISTEN.attach(s):
        await websocket.close(code=4409)
        return

    def _channel() -> adapter.ListenChannel:
        with db.connection(mode="read", label="listen descriptor") as conn:
            _state, station = _served_station(settings, s.station_id)
            if station is None:
                raise adapter.ListenUnavailable("feed")
            provider = im.provider_for(settings, conn)  # one selection: the descriptor and the downlink from the same provider
            d = im.MEDIA.descriptor(provider, conn, settings, station)
        return il.provider_listen_open(provider, settings, s.station_id, d, actor_id=principal.user_id, actor_name=principal.username,
                                       request_id=s.request_id, expires_at=s.expires_at)

    await websocket.accept()
    outcome = "upstream_unavailable"
    channel: adapter.ListenChannel | None = None
    try:
        channel = await run_in_threadpool(_channel)
        await channel.open()
        s.opened_at = time.time()
        await websocket.send_text(json.dumps({"type": "listen/state", "value": "open", "expires_at": im.iso(s.expires_at), "seconds": int(s.expires_at - time.time()),
                                              "codec": adapter.CODEC, "sample_rate": adapter.SAMPLE_RATE, "frame_ms": adapter.FRAME_MS}))
        outcome = await _pump(websocket, s, channel, lease)
    except (ApiError, im.Unavailable, adapter.ListenUnavailable) as exc:
        log.info("listen session %s could not open: %s", s.ref, getattr(exc, "code", type(exc).__name__))
    except Exception as exc:  # noqa: BLE001 - an upstream failure ends the session, it never leaks
        log.warning("listen session %s failed: %s", s.ref, type(exc).__name__)
        outcome = "upstream_closed" if s.opened_at else "upstream_unavailable"
    finally:
        if channel is not None:
            s.dropped = int(getattr(channel, "dropped_frames", 0) or 0)
            with contextlib.suppress(Exception):
                await channel.close(outcome)
        if il.LISTEN.finish(s, outcome):
            await run_in_threadpool(_write_end)
        with contextlib.suppress(Exception):
            await websocket.send_text(json.dumps({"type": "listen/closed", "value": outcome}))
            await websocket.close(code=CLOSE_CODES.get(outcome, 1000))
