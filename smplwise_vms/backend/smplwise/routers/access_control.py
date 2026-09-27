"""WisKey tab (CR-005, access control through the owner's `hikvision_intercom` integration).

SMPLWISE's browser never talks to Home Assistant: these endpoints check SMPLWISE's own permission first and serve
what services/intercom_sync.py read from WisKey over HA's WebSocket API. Phase 1a: the read-only entry center
(`access.read`); phase 1b: the read-only activity log and people directory, same permission (CR-005 §3).

Phase 3 (owner-approved per capability, 2026-09-27): three PHYSICAL actions, each gated on `access.release` at
installation scope - door release (`stations/test_unlock`), call answer / reject / hang up (`media/signal`) and a spoken
announcement (`tts/engines` + `tts/start`). They ride the feed's own Home Assistant session (IntercomSync.action),
are never retried, and every attempt that passes the permission check is written to SMPLWISE's audit log under the
real SMPLWISE actor with its outcome: WisKey's own log sees only the add-on's single HA user (CR-005 §3,
"Accountability gap and its mitigation"). No person, card, schedule or device-setting edit lives here."""
from __future__ import annotations

import asyncio
import json
import queue
import sqlite3
import threading
import time
from datetime import datetime
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, Path, Query, Request, WebSocket
from pydantic import BaseModel, Field, StrictBool, StrictInt
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import Database, now_iso, unlocked
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require
from ..services import intercom_client, intercom_sync
from .media import _principal_for_ws

router = APIRouter()

READ = "access.read"
RELEASE = "access.release"  # every PHYSICAL WisKey command; role grants: see the note at routers/access.py PERMISSION_LABELS
RECHECK_S = 60
MAX_PAGE = 200  # WisKey's own cap for events/list and users/query
STATION_ID = Path(min_length=1, max_length=128)


def _reader(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """`access.read` at installation scope, checked as a dependency: FastAPI resolves dependencies before it validates
    query parameters, so a caller without the permission learns nothing about them (WisKey's own handlers authorize
    first, too). Returns the principal, whose id keys the caller's own rate bucket."""
    require(conn, principal, READ, INSTALLATION)
    return principal


def _instant(name: str, value: str | None) -> str | None:
    """WisKey accepts only an aware ISO instant (<=40 chars) for `start` / `end`; refuse anything else here with a clear
    422 instead of letting WisKey answer `invalid_fields`."""
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        parsed = None
    if parsed is None or parsed.tzinfo is None:
        raise ApiError(422, "validation", f"{name} חייב להיות זמן ISO עם אזור זמן (למשל 2026-09-27T08:00:00Z).")
    return value


@router.get("/intercom/overview")
def overview(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The entry center: stations with online / ringing / sync state and the last access record, plus the feed's own
    state (`ha_not_configured`, `connecting`, `ha_unavailable`, `not_installed`, `forbidden`, `error`, `ready`).
    `overview` is null whenever there is nothing honest to show; `fresh` is false for a copy from before a disconnect."""
    require(conn, principal, READ, INSTALLATION)
    return intercom_sync.SYNC.snapshot(settings_of(request))


@router.get("/intercom/events")
def events(
    request: Request,
    principal: Principal = Depends(_reader),
    station_id: str | None = Query(None, min_length=1, max_length=128),
    person: str | None = Query(None, min_length=1, max_length=128),
    result: Literal["granted", "denied", "unknown"] | None = Query(None),
    authentication: Literal["card", "pin", "unknown"] | None = Query(None),
    door: int | None = Query(None, ge=1, le=2),
    start: str | None = Query(None, max_length=40),
    end: str | None = Query(None, max_length=40),
    limit: int = Query(100, ge=1, le=MAX_PAGE),
    before: str | None = Query(None, min_length=1, max_length=128),
    current_group: str | None = Query(None, min_length=1, max_length=128),
) -> dict[str, Any]:
    """The activity log: one page of WisKey's `events/list`, newest first (WisKey keeps 5 000 records / 30 days).
    `before` is the previous page's `events.next`; WisKey refusing a request that carried `before` is a 422
    `intercom_cursor_expired` (reload from page one), any other refusal a 422 `intercom_invalid_request`. WisKey's
    `current_profile` filter is deliberately not offered: matching events by a profile value (an ID number, say) would
    let a reader probe values the people endpoints never show. Reply: `{state, configured, last_error, fetched_at,
    events, sync}`, `events` null unless `state` is `ready`. WisKey has no event push: refetch on the
    `intercom_refresh` notice, like WisKey's own panel."""
    start, end = _instant("start", start), _instant("end", end)
    if start and end and datetime.fromisoformat(start.replace("Z", "+00:00")) >= datetime.fromisoformat(end.replace("Z", "+00:00")):
        raise ApiError(422, "validation", "start חייב להיות לפני end.")
    filters = {"station_id": station_id, "person": person, "result": result, "authentication": authentication, "door": door, "start": start, "end": end, "limit": limit, "before": before, "current_group": current_group}
    try:
        return intercom_sync.SYNC.command(settings_of(request), "events", lambda call: intercom_client.events_list(call, filters), intercom_sync.project_event_page, who=principal.user_id)
    except ApiError as exc:
        if exc.code == "intercom_invalid_request" and before is not None:
            # every other field was validated above, so a refused paged request is WisKey's pruned cursor
            raise ApiError(422, "intercom_cursor_expired", "רשימת האירועים התעדכנה והסמן של 'טען עוד' פג - טענו מחדש מההתחלה.", details=exc.details) from exc
        raise


@router.get("/intercom/people")
def people(
    request: Request,
    principal: Principal = Depends(_reader),
    query: str = Query("", max_length=160),
    offset: int = Query(0, ge=0, le=10_000_000),
    limit: int = Query(50, ge=1, le=MAX_PAGE),
    snapshot: str | None = Query(None, max_length=64),
    station: str | None = Query(None, min_length=1, max_length=128),
    group: str | None = Query(None, min_length=1, max_length=128),
    rights: Literal["assigned", "unassigned", "disabled"] | None = Query(None),
    state: Literal["active", "inactive", "expired", "upcoming"] | None = Query(None),
    sort: Literal["name", "name_desc", "employee"] = Query("employee"),
) -> dict[str, Any]:
    """The people directory, projected to what a read-only list shows (no phones, cards, PIN flags or profile values).
    `query` is matched by SMPLWISE against name and employee number only and is never sent to WisKey (whose own search
    also matches phone digits and card last-4); `total` and the offsets then count matches. `people.complete` is false
    when the scan stopped early (`incomplete_reason` `scan_limit` / `rate_limited`: narrow the search). Pass the
    previous page's `people.snapshot` back; `people.stale` then says the directory changed underneath the paging. The
    `credential` and `profile` filters are deliberately not offered. Reply: `{state, configured, last_error,
    fetched_at, people, sync}`."""
    filters: dict[str, Any] = {k: v for k, v in {"station": station, "group": group, "rights": rights, "state": state}.items() if v is not None}
    filters["sort"] = sort
    return intercom_sync.SYNC.people(settings_of(request), principal.user_id, query, filters, offset, limit, snapshot)


@router.get("/intercom/people/{user_id}")
def person(request: Request, principal: Principal = Depends(_reader), user_id: str = Path(min_length=1, max_length=128)) -> dict[str, Any]:
    """One person (WisKey `users/get`), same projection as a directory row; an unknown id is a 404
    `intercom_person_not_found`. Reply: `{state, configured, last_error, fetched_at, person, sync}`."""
    return intercom_sync.SYNC.command(settings_of(request), "person", lambda call: intercom_client.users_get(call, user_id), intercom_sync.project_person, who=principal.user_id)


# ---------------------------------------------------------------- physical actions (access.release)

def _releaser(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Principal:
    """`access.release` at installation scope, as a dependency (checked before the body is validated). `access.read`
    alone is not enough: seeing the stations never implies acting on them."""
    require(conn, principal, RELEASE, INSTALLATION)
    return principal


class ReleaseBody(BaseModel):
    # the relay (`integrated_locks[].physical_index`); may be left out when the station has exactly one
    lock: StrictInt | None = Field(None, ge=1, le=64)
    # the UI's confirmation step, stated explicitly (the same rule as a sensitive HA action's `confirmation_grant`)
    confirmed: StrictBool = False


class CallBody(BaseModel):
    command: Literal["answer", "reject", "hangUp"]


class TtsBody(BaseModel):
    engine_id: str = Field(min_length=1, max_length=128)
    language: str | None = Field(None, min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=4 * intercom_client.TTS_MESSAGE_MAX)  # checked again once collapsed


_releasing: set[tuple[str, int]] = set()  # (station, lock) releases in flight: a second one is refused, never queued
_releasing_lock = threading.Lock()


def _known_station(station_id: str) -> dict[str, Any] | None:
    """The station from the served copy; 404 when there is a copy and it has no such station. Without any copy (feed not
    configured / never ready) there is nothing to check against: the action then fails as `not_sent` on its own."""
    station = intercom_sync.SYNC.station(station_id)
    if station is None and intercom_sync.SYNC.has_copy():
        raise ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey.")
    return station


def _require_online(station: dict[str, Any] | None) -> None:
    if station is not None and not station["online"]:
        raise ApiError(409, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת כרגע, ולכן הפקודה לא נשלחה.")


def _perform(
    request: Request,
    conn: sqlite3.Connection,
    principal: Principal,
    action: str,
    station_id: str,
    station: dict[str, Any] | None,
    details: dict[str, Any],
    key: str,
    send: Callable[[intercom_client.Call], Any],
    project: Callable[[Any], dict[str, Any]],
) -> dict[str, Any]:
    """Send one physical command and audit it under the real SMPLWISE actor, whatever happened: `details.outcome` is
    `ok`, `not_sent`, `refused` or `unknown` (IntercomSync.action). `decision` is SMPLWISE's own authorization, which
    was granted; `reason` carries the failure code. The WisKey call runs outside the request's write lock."""
    base = {**details, "station_name": station["name"] if station else None, "command": action.removeprefix("intercom.")}
    rid = getattr(request.state, "correlation_id", None)
    try:
        with unlocked(conn):
            reply = intercom_sync.SYNC.action(settings_of(request), key, send, project, who=principal.user_id)
    except ApiError as exc:
        outcome = str(exc.details.get("outcome") or "refused")
        code = str(exc.details.get("wiskey_code") or exc.code)
        audit(conn, actor=principal, action=action, decision="allowed", resource_type="intercom_station", resource_id=station_id, reason=code, request_id=rid,
              details={**base, "outcome": outcome, "error": exc.code, "wiskey_code": code})
        raise
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="intercom_station", resource_id=station_id, request_id=rid,
          details={**base, "outcome": "ok", "result": reply[key]})
    return reply


@router.post("/intercom/stations/{station_id}/release")
def release(request: Request, body: ReleaseBody, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), station_id: str = STATION_ID) -> dict[str, Any]:
    """Release a station's door relay once (WisKey `stations/test_unlock`). Needs `confirmed: true` - the UI sends it
    only from its confirmation dialog. The reply's `release.accepted` means WisKey ACCEPTED the command; it does not
    mean the door moved (the device's own relay time applies, and WisKey reports no physical confirmation). Refused
    before sending: an unknown station (404), a station without an integrated lock, offline, a lock it does not have,
    a missing confirmation, or a release of the same relay still in flight (409 / 422). Anything that then does not
    complete is an error whose `details.outcome` says whether the command was not sent, refused, or has an unknown
    outcome (IntercomSync.action). Reply: `{state, configured, last_error, fetched_at, release, sync, note}`."""
    station = _known_station(station_id)
    lock = body.lock
    if station is not None:
        if not station["lock_enabled"] or not station["locks"]:
            raise ApiError(409, "intercom_no_lock", f"לעמדה {station['name']} אין מנעול משולב פעיל ב־WisKey.")
        indexes = [entry["physical_index"] for entry in station["locks"]]
        if lock is None:
            if len(indexes) != 1:
                raise ApiError(422, "intercom_lock_required", "לעמדה יותר ממנעול אחד - יש לבחור איזה לשחרר.", details={"locks": indexes})
            lock = indexes[0]
        elif lock not in indexes:
            raise ApiError(422, "intercom_lock_unknown", "לעמדה אין מנעול במספר הזה.", details={"locks": indexes})
        _require_online(station)
    if lock is None:
        lock = 1  # no copy to check against: WisKey's own default relay (panel.ts unlock(station, physical = 1))
    if body.confirmed is not True:
        raise ApiError(409, "confirmation_required", "שחרור דלת דורש אישור מפורש.")
    with _releasing_lock:
        if (station_id, lock) in _releasing:
            raise ApiError(409, "intercom_release_in_progress", "שחרור של הדלת הזו כבר נשלח וממתין לתשובה.")
        _releasing.add((station_id, lock))
    try:
        reply = _perform(request, conn, principal, "intercom.release", station_id, station, {"lock": lock}, "release",
                         lambda call: intercom_client.release_door(call, station_id, lock), intercom_sync.project_release)
    finally:
        with _releasing_lock:
            _releasing.discard((station_id, lock))
    reply["note"] = "WisKey קיבל את הפקודה. זה אינו אישור שהדלת נפתחה בפועל."
    return reply


@router.post("/intercom/stations/{station_id}/call")
def call_signal(request: Request, body: CallBody, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), station_id: str = STATION_ID) -> dict[str, Any]:
    """Answer / reject a ringing call or hang up a call in progress (WisKey `media/signal`). WisKey checks the call
    state on the device itself and refuses a mismatch (`device_unavailable`), so SMPLWISE does not second-guess it from
    its own copy, which can lag a ring by a moment. The reply's `call` is WisKey's result as sent: `acknowledged`
    (true, or null when the device's answer was lost), `observed_state` / `observation` after the signal, and
    `physical_result: "unverified"`. Reply: `{state, configured, last_error, fetched_at, call, sync}`."""
    station = _known_station(station_id)
    _require_online(station)
    return _perform(request, conn, principal, "intercom.call", station_id, station, {"signal": body.command}, "call",
                    lambda call: intercom_client.media_signal(call, station_id, body.command), intercom_sync.project_signal)


@router.get("/intercom/tts/engines")
def tts_engines(request: Request, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Home Assistant's TTS engines WisKey can speak through (`tts/engines`): `{state, configured, last_error,
    fetched_at, tts, sync}` with `tts = {default, engines: [{engine_id, name, supported_languages, default_language}]}`,
    null unless `state` is `ready`. Gated like the announcement itself (WisKey gates it at manage level too)."""
    with unlocked(conn):
        return intercom_sync.SYNC.command(settings_of(request), "tts", intercom_client.tts_engines, intercom_sync.project_tts_engines, who=principal.user_id)


@router.post("/intercom/stations/{station_id}/tts")
def tts_speak(request: Request, body: TtsBody, principal: Principal = Depends(_releaser), conn: sqlite3.Connection = Depends(get_conn), station_id: str = STATION_ID) -> dict[str, Any]:
    """Speak `message` through the station's speaker (WisKey `tts/start`). The text goes to the Home Assistant TTS
    engine `engine_id` - which may be a cloud provider, so the text can leave the premises - and is recorded, as
    spoken, in SMPLWISE's audit log. The reply's `tts` is the announcement's progress when WisKey took it (`started`,
    or already `generating` / ...); later progress arrives as `intercom_tts` notices on /intercom/ws, ending in
    `completed` (`physical_result: "unverified"`) or `closed` with a reason. Reply: `{state, configured, last_error,
    fetched_at, tts, sync}`."""
    message = intercom_client.collapse(body.message)
    if not 1 <= len(message) <= intercom_client.TTS_MESSAGE_MAX:
        raise ApiError(422, "validation", f"ההודעה חייבת להכיל 1-{intercom_client.TTS_MESSAGE_MAX} תווים.")
    station = _known_station(station_id)
    _require_online(station)
    language = body.language
    return _perform(request, conn, principal, "intercom.tts", station_id, station, {"engine_id": body.engine_id, "language": language, "message": message}, "tts",
                    lambda call: intercom_sync.SYNC.tts_start(call, station_id, body.engine_id, language, message), lambda status: status)


@router.websocket("/intercom/ws")
async def intercom_ws(websocket: WebSocket) -> None:
    """Change notices for the entry center (data-free, like WisKey's own `subscribe`): `intercom_refresh` when the
    stations changed, `intercom_state` when the feed's state changed, a heartbeat every 30 s. The client refetches
    GET /intercom/overview; the permission is re-checked every minute and the socket closes (4403) once it is gone."""
    db: Database = websocket.app.state.db
    principal = await _principal_for_ws(websocket)
    if principal is None:
        await websocket.close(code=4401)
        return

    def _allowed() -> bool:
        with db.connection() as conn:
            return authorize(conn, principal, READ, INSTALLATION).allowed

    if not await run_in_threadpool(_allowed):
        await websocket.close(code=4403)
        return
    q = intercom_sync.subscribe()  # before accept: nothing published after the handshake can be missed
    seq = 0
    last_check = time.time()

    def envelope(kind: str, payload: dict[str, Any]) -> str:
        return json.dumps({"version": 1, "type": kind, "sequence": seq, "subscription_id": principal.user_id, "occurred_at": now_iso(), "received_at": now_iso(), "payload": payload}, ensure_ascii=False, default=str)

    try:
        await websocket.accept()
        while True:
            try:
                msg = await asyncio.wait_for(asyncio.get_event_loop().run_in_executor(None, q.get, True, 30), timeout=31)
            except (asyncio.TimeoutError, queue.Empty):
                msg = None
            if time.time() - last_check > RECHECK_S:
                if not await run_in_threadpool(_allowed):
                    await websocket.close(code=4403)
                    return
                last_check = time.time()
            seq += 1
            if msg is None:
                await websocket.send_text(envelope("heartbeat", {"sync": intercom_sync.STATE.as_dict()}))
            else:
                await websocket.send_text(envelope(str(msg.get("type")), msg))
    except Exception:
        pass
    finally:
        intercom_sync.unsubscribe(q)
