"""WisKey tab: the door release route and the ONE door path (CR-033 D4) - `open_door`, the signed transport and the devices
tile's `open_from_tile`. Every Arx-started opening of a WisKey door ends in this module.

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from fastapi import APIRouter, Depends, Request

from ..auth import get_conn, settings_of
from ..db import Database, get_setting
from ..errors import ApiError
from ..rbac import Principal, note_grant
from ..services import bridge_rotation, door_authority, ha_bridge, intercom_client, intercom_sync, trusted_door
from ..services.access_control_core import tile_action_answer, tile_action_id, tile_action_pending
from ..services.timeutil import parse_utc
from ._common import raw_body as _raw_body
from .access_control_base import log
from .access_control_command import ORIGIN_RE, RELAYS, ReleaseBody, SEND_WITHIN_S, _Action, _door_gate_ro, _envelope, _parse, _perform, _relay_of, _station

router = APIRouter()


@router.post("/intercom/stations/{station_id}/release")
def release(request: Request, station_id: str, principal: Principal = Depends(_door_gate_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Release a station's door relay once. Body: `{lock?, confirmed, client_request_id, expires_at, origin?}`; `confirmed:
    true` is sent only by the UI's confirmation dialog. Permission (CR-033 D3): the one door rule (services/door_authority.py)
    - `access.doors.open` (legacy name `access.release`) on the station's chain or `door.unlock` on the mapped lock entity, deny of either wins - at the gate
    and again for the named relay. Transport (CR-033 D4): services/trusted_door.py - today's `stations/test_unlock` while
    `doors.trusted_path` is off, the signed `door_open` once it is on; never `execute`. The reply's `release.accepted`
    means the command was ACCEPTED ("sent"); it does not mean the door moved. Refused before sending, each refusal
    audited: a malformed body, an expired or duplicate command, an unknown station (404), a station without an integrated
    lock, offline, a relay it does not have, no permission for that relay, a missing confirmation, or a release of the same
    relay not yet resolved (409 `intercom_release_in_progress`). Anything that then does not complete is an error whose
    `details.outcome` says whether the command was not sent, refused, or has an unknown outcome. Reply: `{state,
    configured, last_error, fetched_at, release, sync, note, command_id, door_request_id}`."""
    act = _Action(request, conn, principal, "intercom.release", station_id)
    body: ReleaseBody = _parse(act, ReleaseBody, raw)
    not_after = _envelope(act, body)
    station = _station(act, require_online=False)
    lock = _relay_of(act, station, body.lock)
    act.details["lock"] = lock
    entry_point = "wiskey_screen"
    if isinstance(body.origin, str) and ORIGIN_RE.fullmatch(body.origin):
        act.details["origin"] = body.origin  # CR-018: started from a notification's deep link (audit only, never authority)
        entry_point = "notification"
    decision = door_authority.check(conn, principal, station_id, lock, dev_mode=bool(settings_of(request).dev_user))
    if not decision.allowed:
        raise act.refuse(ApiError(403, "forbidden", "אין הרשאה לפתוח דלת זו", details={"reason": decision.reason}))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "שחרור דלת דורש אישור מפורש."))
    reply = open_door(act, station_id, lock, entry_point, not_after, decision)
    reply["note"] = "WisKey קיבל את הפקודה. זה אינו אישור שהדלת נפתחה בפועל."
    return reply


# ---------------------------------------------------------------- the one door path (CR-033 D4)
#
# Every Arx-started opening of a WisKey door ends here, after the route's own checks and the one door authority: the WisKey
# screen and its notification deep link (release above) and the devices tile / map card (`open_from_tile`, called by
# routers/ha.py for a WisKey lock's lock.unlock). The transport is chosen by `doors.trusted_path` (services/trusted_door.py).

def _door_details(act: _Action, station_id: str, lock: int, entry_point: str, decision: door_authority.DoorDecision, mode: str) -> str:
    request_id = trusted_door.new_request_id()
    act.details.update(transport=trusted_door.TRANSPORT, mode="signed" if mode == "on" else "interim", entry_point=entry_point, door_request_id=request_id,
                       station=station_id, relay=lock, **decision.audit_fields())
    note_grant(decision.as_rbac(), decision.granted_by or door_authority.UNLOCK)
    return request_id


def open_door(act: _Action, station_id: str, lock: int, entry_point: str, not_after: datetime, decision: door_authority.DoorDecision,
              before_attempt: Callable[[sqlite3.Connection], None] | None = None) -> dict[str, Any]:
    """Send one WisKey door opening that every check already allowed: the relay guard, the attempt row (committed before
    sending), the transport, the outcome row. Never retried, never queued. `before_attempt(conn)` writes the caller's own
    pending record in the same transaction as the attempt row (the tile's ha_actions row)."""
    mode = trusted_door.mode(act.conn)
    if not intercom_sync.SYNC.has_copy() and (mode == "on" or intercom_sync.STATE.state == "ready"):
        # SEC-WXD L5: without a WisKey copy the station, the relay and its online state cannot be checked (a relay re-wired
        # or removed in WisKey would be opened as mapped) - refused, nothing is sent. The signed transport does not use the
        # feed, so it is refused here always; the interim one needs the feed, which refuses on its own (with the feed's
        # state) unless the feed is up and the copy is not there yet
        raise act.refuse(ApiError(503, "intercom_unavailable", "הפקודה לא נשלחה: אין כרגע נתונים עדכניים ממערכת האינטרקום."))
    request_id = _door_details(act, station_id, lock, entry_point, decision, mode)
    entry = RELAYS.acquire((station_id, lock))
    if entry is None:
        wait = RELAYS.remaining((station_id, lock))
        raise act.refuse(ApiError(409, "intercom_release_in_progress", f"פקודה קודמת עדיין בטיפול. המתינו עד {int(wait) + 1} שניות ובדקו במצלמה לפני שמנסים שוב.", details={"retry_after_s": round(wait, 1)}))
    if before_attempt is not None:
        try:
            before_attempt(act.conn)
        except BaseException:
            RELAYS.settle(entry)
            raise
    try:
        if mode == "on":
            reply = _perform_signed(act, station_id, lock, request_id, not_after, on_settled=lambda: RELAYS.settle(entry), on_unknown=lambda: RELAYS.mark_unknown(entry))
        else:
            reply = _perform(act, "release", lambda call: intercom_client.release_door(call, station_id, lock), intercom_sync.project_release, not_after,
                             on_settled=lambda: RELAYS.settle(entry), on_unknown=lambda: RELAYS.mark_unknown(entry))
    except ApiError as exc:
        if exc.details.get("outcome") == "unknown":
            exc.details["retry_after_s"] = round(RELAYS.remaining((station_id, lock)), 1)  # the UI holds the button this long
        if mode == "on":
            exc.details["door_request_id"] = request_id  # the status read asks about it (the interim transport has none)
        raise
    reply["door_request_id"] = request_id
    from ..services import intercom_calls  # WISKEY-INBOUND-CALLS-2382: a door opened during (or just after) a call joins that call's log row

    intercom_calls.note_door(station_id, act.principal)
    return reply


# the add-on's own call to the bridge failed before anything could reach it: nothing was sent
_NOT_SENT_CODES = {"ha_not_configured", "service_not_found", "ha_forbidden", "bridge_not_paired",
                    "wiskey_direct_not_connected", "capture_source_unavailable",  # WKCAP-295: the direct capture transport (services/wiskey_capture_direct.py)
                    "capture_receiver_unsupported", "capture_dto9_unmappable"}  # CAPMAP-295: the disabled DTO9 pre-flight (services/wiskey_capture_map.py)
_NOT_SENT_ERRORS = {"ConnectError", "ConnectTimeout"}


def _perform_signed(act: _Action, station_id: str, lock: int, request_id: str, not_after: datetime, on_settled: Callable[[], None], on_unknown: Callable[[], None]) -> dict[str, Any]:
    """The signed transport (mode `on`): sign `door_open` with the real principal as actor, commit the attempt row (with
    `body_sha256`), call `smplwise_bridge.door_open` once, map WisKey's closed answer, record the outcome. An answer
    after a possible delivery is never `refused`; an unknown outcome is resolved only by `door_open_status`."""
    settled = False

    def settle() -> None:
        nonlocal settled
        if not settled:
            settled = True
            on_settled()

    try:
        secret = ha_bridge.signing_key(act.conn)
        if not secret or not get_setting(act.conn, "bridge.paired_at"):
            raise act.refuse(ApiError(503, "bridge_not_paired", "אין חיבור לתשתית המערכת"))
        if bridge_rotation.door_commands_paused(act.conn):  # HMACACT2-295: no door command is signed while the key set may be half switched
            raise act.refuse(ApiError(503, bridge_rotation.PAUSE_CODE, bridge_rotation.PAUSE_TEXT))
        if datetime.now(timezone.utc) >= not_after:
            raise act.refuse(ApiError(409, "expired", "הבקשה פגה לפני שנשלחה."))
        p = act.principal
        signed = trusted_door.sign_message(secret, "door_open", p.user_id, trusted_door.actor_name(p), station_id, {"relay": lock}, request_id)
        act.details["body_sha256"] = signed.body_sha256  # computed after signing, recorded only in the audit
        act.attempt()
    except BaseException:
        settle()
        raise
    try:
        try:
            answer = trusted_door.call_bridge(settings_of(act.request), "door_open", signed.text)
        except ApiError as exc:
            not_sent = exc.code in _NOT_SENT_CODES or (exc.code == "ha_unavailable" and exc.details.get("error") in _NOT_SENT_ERRORS)
            outcome = "not_sent" if not_sent else "unknown"
            if outcome == "unknown":
                on_unknown()
            act.outcome(outcome, exc.code, {"error": exc.code, "code": exc.code})
            if not_sent:
                raise ApiError(503, exc.code, "אין חיבור לתשתית המערכת", details={"outcome": "not_sent"}) from None
            raise ApiError(504, "door_outcome_unknown", trusted_door.OUTCOME_TEXT["unknown"], details={"outcome": "unknown"}) from None
        except BaseException as exc:
            on_unknown()
            act.outcome("unknown", type(exc).__name__, {"error": type(exc).__name__})
            raise
    finally:
        settle()
        act.conn.execute("BEGIN")  # deferred, lock-free: nothing more is written on the request connection
    outcome, code = trusted_door.classify(answer, request_id)
    if outcome == "sent":
        act.outcome("ok", None, {"result": {"accepted": True}, "code": code})
        return {"release": {"accepted": True}, "command_id": act.details["command_id"]}
    if outcome == "refused":
        act.outcome("refused", code, {"code": code})
        raise ApiError(409, "door_refused", trusted_door.refusal_text(code), details={"outcome": "refused"})
    on_unknown()
    act.outcome("unknown", code, {"code": code})
    raise ApiError(504, "door_outcome_unknown", trusted_door.OUTCOME_TEXT["unknown"], details={"outcome": "unknown"})


def open_from_tile(request: Request, principal: Principal, entity_id: str, action_id: str, client_request_id: str, expires_at: str, confirmation_grant: str | None) -> dict[str, Any]:
    """A1/A2/A4 (CR-033 5.2): `lock.unlock` of a WisKey lock entity from a devices tile, the tiles panel's dialog or a map /
    home card - the same route (`POST /ha/entities/{id}/actions`) and the same response shape as before, but judged by the
    one door authority (no `ha.entity.control` needed for a WisKey door) and sent through `open_door`, never through the
    bridge's `execute`. The `ha_actions` row is written with `via = trusted_door` and no expected state, so the screens
    show "sent" and never "opened" (decision 22); an unknown outcome is `unknown`, a refusal `failed`."""
    from ..services import ha_actions, intercom_doors

    db: Database = request.app.state.db
    settings = settings_of(request)
    with db.connection(label="door.open tile") as conn:
        existing = tile_action_id(conn, principal.user_id, client_request_id)
        if existing:
            return ha_actions.action_row(conn, existing)  # idempotent: a duplicate click never sends twice
        act = _Action(request, conn, principal, "intercom.release", entity_id, resource_type="ha_entity")
        act.details.update(client_request_id=client_request_id[:80], expires_at=expires_at[:40], entity_id=entity_id)
        try:
            expires = parse_utc(expires_at)
        except ValueError:
            raise act.refuse(ApiError(422, "validation", "expires_at חייב להיות UTC (Z).")) from None
        now = datetime.now(timezone.utc)
        if expires <= now:
            raise act.refuse(ApiError(409, "expired", "הבקשה פגה; נסה שוב."))
        not_after = min(expires, now + timedelta(seconds=SEND_WITHIN_S))
        try:
            target = intercom_doors.resolve(conn, entity_id)
        except ApiError as exc:
            raise act.refuse(exc) from None
        station = intercom_sync.SYNC.station(target.station_id)
        if station is None and intercom_sync.SYNC.has_copy():
            raise act.refuse(intercom_doors.unmapped(entity_id))
        if station is not None:
            act.details["station_name"] = station["name"]
        lock = _relay_of(act, station, target.relay)
        act.details["lock"] = lock
        decision = door_authority.check(conn, principal, target.station_id, lock, entity_id=entity_id, dev_mode=bool(settings.dev_user))
        if not decision.allowed:
            raise act.refuse(ApiError(403, "forbidden", "אין הרשאה לפתוח דלת זו", details={"reason": decision.reason, "action": action_id}))
        if confirmation_grant != "confirmed":
            raise act.refuse(ApiError(409, "confirmation_required", "פעולה רגישה דורשת אישור מפורש.", details={"action": action_id}))
        aid = uuid.uuid4().hex[:12]

        def pending_row(w: sqlite3.Connection) -> None:
            tile_action_pending(w, aid, entity_id, action_id, principal.user_id, principal.username, client_request_id, trusted_door.TRANSPORT)

        def record(status: str, error: str | None) -> None:
            try:
                with db.write_aside(label="door.open tile answer") as w:
                    tile_action_answer(w, aid, status, error)
            except Exception:  # noqa: BLE001 - the door's own audit rows are the record; the tile row stays pending and turns unknown on its own
                log.exception("door.open tile: the answer of %s could not be recorded", aid)

        try:
            open_door(act, target.station_id, lock, "devices_tile", not_after, decision, before_attempt=pending_row)
        except ApiError as exc:
            outcome = exc.details.get("outcome")
            record("unknown" if outcome == "unknown" else "failed", exc.code)
            raise
        record("confirmed", None)  # confirmation "none": the screens say "sent", never "opened"
    with db.connection(mode="read", label="door.open tile row") as r:
        out = ha_actions.action_row(r, aid)
    out["note"] = "נשלח. זה אינו אישור שהדלת נפתחה בפועל."
    return out
