"""WisKey tab: card capture from a station's reader (`access.cards.capture` + `access.people.manage`, CR-005 phase 2 A2) and
the capture-lease route (CR-WISKEY-LEASE-REVOCATION-EVENT L5).

CR-SPLIT-ACCESS-CONTROL-2440 (review 05:P2-08): moved unchanged out of routers/access_control.py, which still exports every name."""
from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from ..auth import current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import Database, unlocked
from ..errors import ApiError
from ..rbac import Principal
from ..services import bridge_rotation, capture_lease, capture_lease_route, intercom_authority as ia, intercom_adapter, intercom_client, intercom_sync, intercom_writes as iw, lease_events, trusted_door
from ..services.access_control_core import PERSON, _no_control
from ..services.intercom_capture import CAPTURES, POLLED
from ._common import raw_body as _raw_body
from .access_control_base import CAPTURE, MANAGE, MAX_STATION_ID, log
from .access_control_command import CommandEnvelope, SEND_WITHIN_S, _Action, _envelope, _parse, _perform
from .access_control_door import _NOT_SENT_CODES, _NOT_SENT_ERRORS
from .access_control_people import _person_summary, gated, people_writer

router = APIRouter()


# ---------------------------------------------------------------- card capture (access.cards.capture + access.people.manage), CR-005 phase 2 A2
#
# The product's first long-running physical interaction: a station's card reader is put into collection mode, the
# person presents one card, WisKey reads it and shows it masked, and only the administrator's explicit approval adds it
# to the person (brief A.7; WisKey's own flow, access/enrollment.py + panel.ts:1432-1630, ported like for like - owner
# decision 2026-09-28, answers 2 and 10). Permissions: `access.cards.capture` is its own sensitive permission, required
# IN ADDITION to `access.people.manage` on every endpoint here (a capture ends in a people write), both checked as
# dependencies before the body is read. The write path is the physical actions' one (JSON only, envelope on start and
# confirm, attempt row committed before sending, outcome row after); the start needs `confirmed: true` (the dialog's
# confirmation step - it is a physical action on a reader at a door). Start and cancel ride the feed's capture lane (one
# slot, own buckets), the confirm the config lane (it is a people write), so none of them can take a door release's
# slot. Sessions are SMPLWISE-owned (services/intercom_capture.py): WisKey sees every SMPLWISE user as the add-on's one
# HA user, so a session is served, cancelled or confirmed only for the SMPLWISE user who started it - for anyone else
# it is a 404. The collected card is WisKey's masked form (`•••• 1234`) and appears only in its owner's replies: never
# in an audit row (the rows carry ids, station, reader, states, WisKey's codes, `cards_added: 1`) or a log line.
#
# Refused vs unknown per command: intercom_client.PRE_CAPTURE (verified against the WisKey source). A start whose
# outcome is unknown may have put the reader into collection mode under a session SMPLWISE cannot see: the station is
# held for the rest of WisKey's 120 s and the reply says so; nothing is ever added to a person without the confirm.
#
# CR-036 S11: both permissions anywhere a station can be as the dependency, then per request - the start: both on the reader's
# station and on every station of the person, with the sensitive level (a card is a credential), against a fresh read unless the
# caller is unrestricted (the start carries that read's revision); the stations decided at the start are kept with the session
# and checked again at the confirm (a scope taken away meanwhile refuses it). All three commands are UNKNOWN_EFFECT (DW matrix,
# 2026-10-12): the replies say `pending: true`. The browser cancels ONCE (no automatic retry of a write); a session nobody
# follows any more is cancelled by the backend after ABANDON_S (services/intercom_capture.py), not by a retry.

CAPTURE_NOTE = "הקורא בעמדה במצב קריאת כרטיס. הצמידו כרטיס אחד לקורא; שום כרטיס לא יתווסף לאדם עד שתאשרו אותו."
_capturer_ro = people_writer(CAPTURE)  # access.people.manage + access.cards.capture anywhere, on the read connection


def _capture_starter_ro(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> ia.Authority:
    """`_capturer_ro` for the capture START, which may issue a capture lease: the permission revision and the authority epochs are
    taken on the gate's own connection BEFORE any decision (review 2026-10-16 H1), so a permission change anywhere between this
    gate and the ledger insert - including the body upload the caller controls - refuses the lease (`capture_lease_stale`)."""
    request.state.capture_lease_mark = capture_lease.gate_mark(conn)
    return _capturer_ro(request, principal, conn)


class CaptureStartBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    station_id: str = Field(min_length=1, max_length=MAX_STATION_ID)
    reader_id: StrictInt = Field(ge=0, le=8)  # WisKey enrollment.start: 0..8, 0 = the station's default reader
    revision: StrictInt = Field(ge=1)  # the person's revision the editor loaded (WisKey checks it: revision_conflict)
    confirmed: Any = None  # only `true` (from the dialog's confirmation step) confirms, as ReleaseBody


class CaptureCancelBody(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CaptureConfirmBody(CommandEnvelope):
    model_config = ConfigDict(extra="forbid")
    label: str = Field("", max_length=64)  # WisKey text_field(label, 64, empty=True)
    confirmed: Any = None


def _capture_or_refuse(act: _Action, session_id: str) -> Any:
    capture = CAPTURES.owned(session_id, act.principal.user_id)
    if capture is None:
        raise act.refuse(ApiError(404, "intercom_capture_not_found", "קריאת הכרטיס הזו אינה קיימת (או שאינה שלכם)."))
    act.details.update(session_id=capture.session_id, person_id=capture.person_id, station_id=capture.station_id, station_name=capture.station_name, reader_id=capture.reader_id)
    return capture


# ---------------------------------------------------------------- the capture-lease route (CR-WISKEY-LEASE-REVOCATION-EVENT L5)
#
# Reached only while `access.capture_lease` is `on` (default `off`; it cannot be switched on in this build - no bridge offers the
# lease service). Same permissions, same body, same attempt / outcome audit rows as the classic path; the WisKey traffic is the
# signed lease route instead of the WS capture lane, and every start carries an Arx-issued lease (services/capture_lease.py).

def _lease_refused(act: _Action, exc: ApiError) -> ApiError:
    exc.details.setdefault("outcome", "not_sent")
    return act.refuse(exc)


def _lease_redecide(conn: sqlite3.Connection, principal: Principal, station_id: str, target: Any) -> None:
    """The capture start's decision once more, on the request's WRITE connection (review H1): both permissions somewhere, then
    both on the reader's station and on every station of the person decided at the start (`target.stations`; None = the
    unrestricted shortcut, which must still hold), with the sensitive level. A fresh Authority: nothing cached from the read
    connection's decision is reused. Raises the refusal."""
    fresh = ia.Authority(conn, principal)
    if not (fresh.anywhere(MANAGE) and fresh.anywhere(CAPTURE)):
        raise iw.scope_refusal()
    iw.check_stations(fresh, target.stations, permissions=(MANAGE, CAPTURE), extra_stations=[station_id], sensitive=True)
    if target.stations is not None and not (fresh.station(CAPTURE, station_id) and fresh.station(MANAGE, station_id)):
        raise iw.scope_refusal()


def _lease_start(request: Request, act: _Action, conn: sqlite3.Connection, auth: ia.Authority, body: "CaptureStartBody", user_id: str, target: Any,
                 station: dict[str, Any] | None, token: str, lease_mark: capture_lease.GateMark | None) -> dict[str, Any]:
    principal = auth.principal
    settings = settings_of(request)
    db: Database = request.app.state.db
    try:
        capture_lease.ensure_issuable(conn)
    except ApiError as exc:
        raise _lease_refused(act, exc) from None
    lease_events.WORKER.attach(db, settings)
    with unlocked(conn):  # the stream must be known to the host before a lease of it is signed (a round trip: no write lock held)
        announced = lease_events.WORKER.ensure_announced()
    if not announced:
        raise _lease_refused(act, capture_lease.unavailable())
    if lease_mark is None:  # the gate could not take its mark: fail closed
        raise _lease_refused(act, capture_lease._stale())
    # Review H1 (a): the decision is taken AGAIN on this write connection, inside the transaction that inserts the ledger row
    # (CR F3) - the write lock is held from here to the commit, so no permission write can land between this decision and the
    # row. (b): the issue compares the revision / epochs with the gate's mark, taken before the first decision.
    try:
        _lease_redecide(conn, principal, body.station_id, target)
    except ApiError as exc:
        raise _lease_refused(act, exc) from None
    binding_revision = station.get("binding_revision") if isinstance(station, dict) and isinstance(station.get("binding_revision"), str) else None
    try:
        lease = capture_lease.issue(conn, principal=principal, station_id=body.station_id, reader_id=body.reader_id, person_id=user_id, person_revision=body.revision,
                                    binding_revision=binding_revision, decision_revision=lease_mark.revision, start_request_id=lease_events_request_id(),
                                    snap=lease_mark.snapshot(principal.user_id, body.station_id, user_id))
    except ApiError as exc:
        raise _lease_refused(act, exc) from None
    act.details.update(lease_ref=lease.lease_ref, lease_seconds=lease.seconds, transport="capture_lease")
    try:
        try:
            signed = lease_events.sign(conn, "capture_start", principal.user_id, trusted_door.actor_name(principal), body.station_id, {"lease": lease.lease_object()},
                                       request_id=lease.start_request_id)
        except lease_events.NotSendable as exc:
            capture_lease.discard(conn, lease.lease_ref, "start_refused")
            if exc.code == bridge_rotation.PAUSE_CODE:  # HMACACT2-295: a clear reason, nothing sent
                raise _lease_refused(act, capture_lease.unavailable(bridge_rotation.PAUSE_CODE, bridge_rotation.PAUSE_TEXT)) from None
            raise _lease_refused(act, capture_lease.unavailable("bridge_not_paired" if exc.code == "bridge_not_paired" else "capture_lease_unavailable")) from None
        act.details["body_sha256"] = signed.body_sha256  # computed after signing, recorded only in the audit
        act.attempt()  # commits the ledger row and the attempt row together: no record, no command
    except BaseException:
        capture_lease._forget(lease.lease_ref, "destroyed")  # review L3: no committed row -> no live cache entry either
        raise
    try:
        try:
            answer = lease_events.TRANSPORT.request(settings, "capture_start", signed.text)
        except ApiError as exc:
            not_sent = exc.code in _NOT_SENT_CODES or (exc.code == "ha_unavailable" and exc.details.get("error") in _NOT_SENT_ERRORS)
            if not_sent:
                capture_lease.finish(db, lease.lease_ref, "destroyed", "start_refused")
                act.outcome("not_sent", exc.code, {"error": exc.code})
                raise ApiError(503, exc.code, capture_lease.UNAVAILABLE_TEXT, details={"outcome": "not_sent"}) from None
            answer = None
        except Exception as exc:  # noqa: BLE001 - a timeout after a possible delivery
            log.warning("capture lease start: no clear answer (%s)", type(exc).__name__)
            answer = None
    finally:
        conn.execute("BEGIN")  # deferred, lock-free: nothing more is written on the request connection
    kind, data = capture_lease_route.classify_request(answer, signed.request_id, "capture_start") if answer is not None else ("unknown", {"code": "no_answer"})
    capture_lease_route._clock_check(kind, data)
    session = None
    if kind == "ok":
        try:
            session = intercom_sync.project_capture_session(data.get("session"))
        except (ValueError, TypeError):
            kind, data = "unknown", {"code": "invalid_session"}  # F9: acknowledged without a usable session id = unknown start
    if kind in ("refused", "rejected"):
        capture_lease.finish(db, lease.lease_ref, "destroyed", "start_refused")
        act.outcome("refused", data["code"], {"code": data["code"]})
        text = capture_lease.CLOCK_TEXT if data["code"] in lease_events.CLOCK_CODES else intercom_client_text(data["code"])
        raise ApiError(409, "intercom_refused", text, details={"outcome": "refused", "wiskey_code": data["code"]})
    if kind != "ok" or session is None:
        capture_lease.on_authority_change("start_unknown", lease_refs=[lease.lease_ref])  # a session Arx cannot see may drive the reader
        held = CAPTURES.hold_unknown(token)
        act.outcome("unknown", data.get("code"), {"code": data.get("code")})
        raise ApiError(504, "intercom_outcome_unknown", "לא ידוע אם הקורא הופעל. הקריאה בוטלה, והעמדה תהיה פנויה בעוד זמן קצר.",
                       details={"outcome": "unknown", "retry_after_s": round(held, 1)})
    if not capture_lease.activate(db, lease.lease_ref, session["session_id"]):
        # revoked between the send and the answer: the host's session is cancelled with the lease's own signed cancel
        capture_lease_route.cancel_known(db, settings, principal.user_id, body.station_id, lease.lease_ref, session["session_id"])
        CAPTURES.release(token)
        act.outcome("refused", "capture_lease_gone", {"code": "capture_lease_gone"})
        raise capture_lease_route.gone()
    capture = CAPTURES.register(token, session, principal, user_id, body.station_id, act.details.get("station_name"), body.reader_id, body.revision, settings, db,
                                lease_ref=lease.lease_ref)
    capture.person_stations = target.stations
    act.outcome("ok", None, {"result": {"session_id": session["session_id"], "state": session["state"]}})
    return {"state": "ready", "configured": True, "last_error": None, "capture": CAPTURES.view(capture), "note": CAPTURE_NOTE, "command_id": act.details["command_id"],
            **iw.effect_fields("cards/capture_start")}


def lease_events_request_id() -> str:
    return str(uuid.uuid4())


def intercom_client_text(code: str) -> str:
    """The operator text for a WisKey refusal code on the lease route (never the code itself, never input)."""
    return {
        "capture_station_busy": "בעמדה הזו כבר פתוחה קריאת כרטיס. הקורא לא הופעל שוב.",
        "capture_limit": "כבר פתוחות שלוש קריאות כרטיס במערכת. נסו שוב בעוד רגע.",
        "revision_conflict": "הרשומה השתנתה מאז שנטענה. טענו אותה מחדש ונסו שוב.",
        "lease_gone": capture_lease_route.GONE_TEXT,
    }.get(code, "הפקודה נדחתה ולא בוצעה.")


def _lease_confirm(request: Request, act: _Action, auth: ia.Authority, capture: Any, label: str, not_after: datetime) -> dict[str, Any]:
    """F8: refused locally while the lease is not usable; otherwise ONE signed capture_confirm, never retried."""
    db: Database = request.app.state.db
    settings = settings_of(request)
    act.details.update(lease_ref=capture.lease_ref, transport="capture_lease")
    if not capture_lease.usable(capture.lease_ref):
        CAPTURES.back_to_captured(capture)
        capture_lease_route.stop(CAPTURES, capture, audit=False)
        raise act.refuse(capture_lease_route.gone())
    if datetime.now(timezone.utc) >= not_after:
        CAPTURES.back_to_captured(capture)
        raise act.refuse(ApiError(409, "expired", "הבקשה פגה לפני שנשלחה."))
    # R5-A5: the signed confirm writes a card to the person - the SAME per-person admission and unknown reconciliation as every other
    # people write (the classic confirm's `_perform(..., target=)`), around the unchanged signed operation: an earlier write to this
    # person still out or unsettled refuses it here, nothing signed; an unclear answer blocks the next write until a fresh readback.
    target = intercom_sync.person_target(capture.person_id)
    pending = intercom_sync.SYNC.write_gate(target)
    if pending is not None:
        CAPTURES.back_to_captured(capture)
        raise act.refuse(_gate_refusal(pending, capture))
    p = act.principal
    try:
        signed = lease_events.sign(act.conn, "capture_confirm", p.user_id, trusted_door.actor_name(p), capture.station_id,
                                   {"lease_ref": capture.lease_ref, "session_id": capture.session_id, "label": label})
    except lease_events.NotSendable:
        CAPTURES.back_to_captured(capture)
        raise act.refuse(capture_lease.unavailable()) from None
    act.details["body_sha256"] = signed.body_sha256
    act.attempt()
    blocked, op_id = intercom_sync.SYNC.begin_external(target, "capture_confirm")  # checked AND registered in one step (after the commit)
    if blocked is not None:
        CAPTURES.back_to_captured(capture)
        act.outcome("not_sent", blocked, {"error": blocked})
        act.conn.execute("BEGIN")
        raise _gate_refusal(blocked, capture)
    settled = {"outcome": "unknown", "code": None}
    try:
        return _lease_confirm_admitted(act, auth, capture, db, settings, signed, settled)
    finally:
        intercom_sync.SYNC.end_external(target, op_id, settled["outcome"], settled["code"])


def _gate_refusal(code: str, capture: Any) -> ApiError:
    exc = intercom_sync.action_error({"state": "error", "last_error": code}, "not_sent", "config")
    exc.details["capture"] = CAPTURES.view(capture)
    return exc


def _lease_confirm_admitted(act: _Action, auth: ia.Authority, capture: Any, db: Database, settings: Any, signed: Any, settled: dict[str, Any]) -> dict[str, Any]:
    """`_lease_confirm` after the per-person admission: ONE signed capture_confirm, never retried. `settled` receives what is known about
    the write (`ok` / `refused` / `not_sent`; it stays `unknown` otherwise) for the admission's own record (R5-A5)."""
    answer: Any = None
    try:
        try:
            answer = lease_events.TRANSPORT.request(settings, "capture_confirm", signed.text)
        except ApiError as exc:
            if exc.code in _NOT_SENT_CODES or (exc.code == "ha_unavailable" and exc.details.get("error") in _NOT_SENT_ERRORS):
                CAPTURES.back_to_captured(capture)
                act.outcome("not_sent", exc.code, {"error": exc.code})
                settled.update(outcome="not_sent", code=exc.code)
                raise ApiError(503, exc.code, capture_lease.UNAVAILABLE_TEXT, details={"outcome": "not_sent", "capture": CAPTURES.view(capture)}) from None
        except Exception as exc:  # noqa: BLE001 - after a possible delivery
            log.warning("capture lease confirm: no clear answer (%s)", type(exc).__name__)
    finally:
        act.conn.execute("BEGIN")
    kind, data = capture_lease_route.classify_request(answer, signed.request_id, "capture_confirm") if answer is not None else ("unknown", {"code": "no_answer"})
    capture_lease_route._clock_check(kind, data)
    if kind in ("refused", "rejected"):
        code = data["code"]
        if code in ("capture_not_ready", "invalid_text", "capture_operation_busy") or kind == "rejected":
            CAPTURES.back_to_captured(capture)
        else:
            CAPTURES.set_state(capture, "lost" if code in ("capture_not_found", "lease_gone") else "closed", code, only_from=("applying",))
            capture_lease.finish(db, capture.lease_ref, "destroyed", "lost" if code in ("capture_not_found", "lease_gone") else "error")
        settled.update(outcome="refused", code=code)
        act.outcome("refused", code, {"code": code})
        raise ApiError(409, "intercom_refused", intercom_client_text(code), details={"outcome": "refused", "wiskey_code": code, "capture": CAPTURES.view(capture)})
    person = None
    if kind == "ok":
        try:
            person = iw.project_editor(data.get("person"))
        except (ValueError, TypeError, KeyError):
            person = None
    if kind != "ok" or person is None:
        CAPTURES.set_state(capture, "unconfirmed", data.get("code"), only_from=("applying",))
        capture_lease.finish(db, capture.lease_ref, "destroyed", "confirm_unknown")
        act.outcome("unknown", data.get("code"), {"code": data.get("code")})
        raise ApiError(504, "intercom_outcome_unknown", capture_lease_route.CONFIRM_UNKNOWN_TEXT, details={"outcome": "unknown", "capture": CAPTURES.view(capture)})
    CAPTURES.set_state(capture, "confirmed", only_from=("applying",))
    capture_lease.finish(db, capture.lease_ref, "destroyed", "confirmed")
    settled.update(outcome="ok", code=None)
    act.outcome("ok", None, {"result": _person_summary(person)})
    return {"state": "ready", "configured": True, "last_error": None, "person": iw.view_editor_person(auth, person), "capture": CAPTURES.view(capture),
            "note": "WisKey הוסיף את הכרטיס לאדם וביקש לסנכרן את התחנות שלו. מצב הסנכרון של כל תחנה מוצג ברשומה.", "command_id": act.details["command_id"],
            **iw.effect_fields("cards/capture_confirm")}


def _lease_cancel(request: Request, act: _Action, capture: Any) -> dict[str, Any]:
    """ONE signed capture_cancel. Acknowledged -> destroyed(cancelled); no clear answer -> the lease is revoked (cancel_unknown)."""
    db: Database = request.app.state.db
    settings = settings_of(request)
    act.details.update(lease_ref=capture.lease_ref, transport="capture_lease")
    p = act.principal
    try:
        signed = lease_events.sign(act.conn, "capture_cancel", p.user_id, trusted_door.actor_name(p), capture.station_id,
                                   {"lease_ref": capture.lease_ref, "session_id": capture.session_id})
    except lease_events.NotSendable:
        capture_lease.on_authority_change("cancel_unknown", lease_refs=[capture.lease_ref])  # nothing could be sent: the lease is revoked instead
        CAPTURES.set_state(capture, "cancel_unknown", only_from=POLLED)
        raise act.refuse(capture_lease.unavailable()) from None
    act.details["body_sha256"] = signed.body_sha256
    act.attempt()
    answer: Any = None
    try:
        try:
            answer = lease_events.TRANSPORT.request(settings, "capture_cancel", signed.text)
        except Exception as exc:  # noqa: BLE001
            log.warning("capture lease cancel: no clear answer (%s)", type(exc).__name__)
    finally:
        act.conn.execute("BEGIN")
    kind, data = capture_lease_route.classify_request(answer, signed.request_id, "capture_cancel") if answer is not None else ("unknown", {"code": "no_answer"})
    capture_lease_route._clock_check(kind, data)
    if kind == "ok" and data.get("cancelled") is True:
        CAPTURES.set_state(capture, "cancelled", only_from=POLLED)
        capture_lease.finish(db, capture.lease_ref, "destroyed", "cancelled")
        act.outcome("ok", None, {"result": {"cancelled": True}})
        return {"state": "ready", "configured": True, "last_error": None, "cancelled": True, "capture": CAPTURES.view(capture), "command_id": act.details["command_id"],
                "note": "WisKey הפסיק להמתין לכרטיס ושום כרטיס לא נוסף. זמן ההמתנה של הקורא עצמו נקבע בקושחה שלו.", **iw.effect_fields("cards/capture_cancel")}
    if kind == "refused" and data["code"] in ("capture_not_found", "lease_gone"):
        CAPTURES.set_state(capture, "lost", only_from=POLLED)
        capture_lease.finish(db, capture.lease_ref, "destroyed", "lost")
        act.outcome("refused", data["code"], {"code": data["code"]})
        raise ApiError(409, "intercom_capture_not_found", "קריאת הכרטיס כבר אינה קיימת ב־WisKey.", details={"outcome": "refused", "capture": CAPTURES.view(capture)})
    capture_lease.on_authority_change("cancel_unknown", lease_refs=[capture.lease_ref])
    CAPTURES.set_state(capture, "cancel_unknown", only_from=POLLED)
    act.outcome("unknown", data.get("code"), {"code": data.get("code")})
    raise ApiError(504, "intercom_outcome_unknown", "לא ידוע אם הביטול התקבל. הקריאה בוטלה בצד Arx.", details={"outcome": "unknown", "capture": CAPTURES.view(capture)})


@router.get("/intercom/stations/{station_id}/card-readers")
def card_readers(request: Request, station_id: str, auth: ia.Authority = Depends(_capturer_ro)) -> dict[str, Any]:
    """The station's card readers (WisKey `cards/reader_capabilities`, a read that reaches the device - WisKey allows it
    35 s): `readers` (0 = the station's default reader) and the card-number length bounds. A station that advertises
    no card collection is `state: error`, `last_error: capture_unsupported`; offline / no managed lock likewise by
    WisKey's code. Reply: `{state, configured, last_error, fetched_at, readers, sync}`.

    CR-036 S11: both permissions on THIS station's chain - a station off it answers exactly like an unknown one (404
    `intercom_station_not_found`), and nothing is asked of the device."""
    if not 1 <= len(station_id) <= MAX_STATION_ID:
        raise ApiError(422, "validation", "מזהה העמדה אינו תקין.", details={"fields": ["station_id"]})
    if not (auth.station(CAPTURE, station_id) and auth.station(MANAGE, station_id)):
        raise ApiError(404, intercom_adapter.STATION_NOT_FOUND[0], intercom_adapter.STATION_NOT_FOUND[1])
    return intercom_sync.SYNC.command(settings_of(request), "readers", lambda call: intercom_client.reader_capabilities(call, station_id), intercom_sync.project_readers,
                                      who=auth.principal.user_id, timeout=intercom_sync.READERS_TIMEOUT_S)


@router.post("/intercom/people/{user_id}/card-capture")
def card_capture_start(request: Request, user_id: str, auth: ia.Authority = Depends(_capture_starter_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Start reading a card at a station (WisKey `cards/capture_start`, PHYSICAL: the station's reader enters card-
    collection mode). Body: `{station_id, reader_id, revision, confirmed, client_request_id, expires_at}`; `confirmed:
    true` comes only from the dialog's confirmation step. Refused before sending (each audited, `not_sent`): a malformed
    body, an expired or duplicate command, an unknown station, a station without a managed lock or offline, a missing
    confirmation, a capture of the caller's own still open (`intercom_capture_user_busy`) or one at that station
    (`intercom_capture_station_busy`, also for the rest of WisKey's 120 s after a start with an unknown outcome there).
    WisKey's refusals by name (`intercom_capture_station_busy`, `intercom_capture_limit`, `intercom_revision_conflict`
    ...); an unclear answer is a 504 `intercom_outcome_unknown` - the reader may be collecting. Reply: `{state, ...,
    capture: <the session as GET /intercom/card-capture/{id} serves it>, sync, note, command_id, effect, pending}`.

    CR-036 S11: `access.cards.capture` and `access.people.manage` on the reader's station and on every station of the person,
    with the sensitive level (a card is a credential); not unrestricted = checked against a fresh read whose revision the start
    must carry. UNKNOWN_EFFECT: `pending: true` (the session state the dialog polls is what tells)."""
    principal = auth.principal
    # capture-lease route (CR-WISKEY-LEASE-REVOCATION-EVENT L5): the permission revision and the authority epochs were taken at
    # the permission gate, BEFORE the decision (`_capture_starter_ro`, review H1) - a permission change or a trigger between
    # there and the ledger insert makes the issue refuse (capture_lease.issue). Harmless when off.
    lease_mark = getattr(request.state, "capture_lease_mark", None)
    act = _Action(request, conn, principal, "intercom.card_capture.start", user_id, PERSON)
    body: CaptureStartBody = _parse(act, CaptureStartBody, raw)
    act.details.update(client_request_id=body.client_request_id, expires_at=body.expires_at, station_id=body.station_id, reader_id=body.reader_id, revision=body.revision,
                       **iw.effect_fields("cards/capture_start"))
    settings = settings_of(request)
    target = gated(act, conn, lambda: iw.gate_person_write(settings, auth, user_id, permissions=(MANAGE, CAPTURE), extra_stations=[body.station_id], sensitive=True, revision=body.revision))
    if target.person is None and not (auth.station(CAPTURE, body.station_id) and auth.station(MANAGE, body.station_id)):
        raise act.refuse(iw.scope_refusal())  # (unrestricted callers hold both everywhere; kept explicit, fail closed)
    not_after = _envelope(act, body)
    station = intercom_sync.SYNC.station(body.station_id)
    if station is None and intercom_sync.SYNC.has_copy():
        raise act.refuse(ApiError(404, "intercom_station_not_found", "העמדה לא נמצאה ב־WisKey."))
    if station is not None:
        act.details["station_name"] = station["name"]
        if not station["lock_enabled"] or not station["locks"]:
            raise act.refuse(ApiError(409, "intercom_no_lock", f"לעמדה {station['name']} אין מנעול מנוהל ב־WisKey, ולכן אי אפשר לקרוא בה כרטיס."))
        if not station["online"]:
            raise act.refuse(ApiError(409, "intercom_station_offline", f"העמדה {station['name']} אינה מחוברת כרגע, ולכן הקורא לא הופעל."))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "הפעלת קורא הכרטיסים בעמדה דורשת אישור מפורש."))
    try:
        token = CAPTURES.reserve(principal.user_id, body.station_id)
    except ApiError as exc:
        raise act.refuse(exc) from None
    if capture_lease.mode(conn) == "on":  # the lease route (fails closed with 503 unless it can really serve: route_on, not degraded, clock)
        try:
            return _lease_start(request, act, conn, auth, body, user_id, target, station, token, lease_mark)
        except BaseException:
            CAPTURES.release(token)  # a no-op after hold_unknown / register
            raise
    held = {"s": 0.0}

    def unknown() -> None:
        held["s"] = CAPTURES.hold_unknown(token)

    station_id, reader_id, revision = body.station_id, body.reader_id, body.revision
    try:
        reply = _perform(act, "capture", lambda call: intercom_client.capture_start(call, station_id, user_id, revision, reader_id), intercom_sync.project_capture_session, not_after,
                         on_unknown=unknown, lane="capture", summary=lambda s: {"session_id": s["session_id"], "state": s["state"]}, slot_wait=intercom_sync.CAPTURE_SLOT_WAIT_S)
    except ApiError as exc:
        if exc.details.get("outcome") == "unknown":
            exc.details["retry_after_s"] = round(held["s"], 1)
        CAPTURES.release(token)  # a no-op after hold_unknown
        raise
    except BaseException:
        CAPTURES.release(token)
        raise
    capture = CAPTURES.register(token, reply["capture"], principal, user_id, station_id, act.details.get("station_name"), reader_id, revision, settings_of(request), request.app.state.db)
    capture.person_stations = target.stations  # S11: checked again at the confirm (None = decided by the unrestricted shortcut)
    reply["capture"] = CAPTURES.view(capture)
    reply["note"] = CAPTURE_NOTE
    reply.update(iw.effect_fields("cards/capture_start"))
    return reply


@router.get("/intercom/card-capture/{session_id}")
def card_capture_status(session_id: str, auth: ia.Authority = Depends(_capturer_ro)) -> dict[str, Any]:
    """The caller's own capture session as SMPLWISE's poller last read it from WisKey (no WisKey traffic per request):
    `state` preparing | waiting | captured | applying (active) or error | cancelled | cancel_unknown | expired | lost |
    confirmed | unconfirmed | closed; `error` (WisKey's code, e.g. `capture_timeout`); `card` (`{masked_number,
    technology, reader_id}` while captured - the masked form only); the countdowns (`collect_remaining_s` of WisKey's
    70 s collection, `session_remaining_s` of its 120 s session); `reader_may_be_collecting`. Reading it keeps the session
    alive: one nobody asked about for 20 s is cancelled by the backend. Another user's session is a 404."""
    capture = CAPTURES.owned(session_id, auth.principal.user_id)
    if capture is None:
        raise ApiError(404, "intercom_capture_not_found", "קריאת הכרטיס הזו אינה קיימת (או שאינה שלכם).")
    return {"capture": CAPTURES.view(capture)}


@router.post("/intercom/card-capture/{session_id}/cancel")
def card_capture_cancel(request: Request, session_id: str, auth: ia.Authority = Depends(_capturer_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Cancel the caller's own capture (WisKey `cards/capture_cancel`): WisKey stops waiting for a card and drops the
    session. Body `{}` (JSON). WisKey's reader timeout is the firmware's own: cancelling is not proof the reader left
    collection mode (WisKey `capture_limits`). A cancel with no clear answer is 504 unknown (the session is then
    `cancel_unknown`). A cancel spends no rate token: polling or other captures can never get it refused locally.
    Reply: `{state, ..., cancelled, capture, sync, note, command_id, effect, pending}`.

    CR-036 S11: the owner of the session may always cancel it (it only ever ends a reader's collection); UNKNOWN_EFFECT
    (`pending: true`). The screens send it ONCE - no automatic retry."""
    act = _Action(request, conn, auth.principal, "intercom.card_capture.cancel", session_id, "intercom_capture")
    act.details.update(iw.effect_fields("cards/capture_cancel"))
    _parse(act, CaptureCancelBody, raw)
    capture = _capture_or_refuse(act, session_id)
    if capture.state == "applying":
        raise act.refuse(ApiError(409, "intercom_capture_applying", "הכרטיס נמצא בשמירה. יש להמתין לתוצאה לפני פעולה נוספת."))
    if capture.state not in POLLED:
        raise act.refuse(ApiError(409, "intercom_capture_over", "קריאת הכרטיס הזו כבר הסתיימה; אין מה לבטל.", details={"capture": CAPTURES.view(capture)}))
    if capture.lease_ref is not None:  # the capture-lease route (L5): the lease's own signed cancel
        return _lease_cancel(request, act, capture)
    not_after = datetime.now(timezone.utc) + timedelta(seconds=SEND_WITHIN_S)

    def record(reply: dict[str, Any], outcome: str) -> None:
        # recorded while the capture lane's slot is still this cancel's: no poller status read can reach WisKey between
        # its answer and this record (and find the session it just dropped: `lost`) - T054
        if outcome == "ok":
            CAPTURES.set_state(capture, "cancelled", only_from=POLLED)
        elif outcome == "unknown":
            CAPTURES.set_state(capture, "cancel_unknown", only_from=POLLED)
        elif outcome == "refused" and reply.get("last_error") == "capture_not_found":
            CAPTURES.set_state(capture, "lost", only_from=POLLED)

    try:
        reply = _perform(act, "cancelled", lambda call: intercom_client.capture_cancel(call, capture.session_id), intercom_sync.project_cancelled, not_after,
                         lane="capture", slot_wait=intercom_sync.CAPTURE_SLOT_WAIT_S, free=True, on_result=record)  # never refused by SMPLWISE's own rate budget
    except ApiError as exc:
        exc.details["capture"] = CAPTURES.view(capture)
        raise
    reply["capture"] = CAPTURES.view(capture)
    reply["note"] = "WisKey הפסיק להמתין לכרטיס ושום כרטיס לא נוסף. זמן ההמתנה של הקורא עצמו נקבע בקושחה שלו."
    reply.update(iw.effect_fields("cards/capture_cancel"))
    return reply


@router.post("/intercom/card-capture/{session_id}/confirm")
def card_capture_confirm(request: Request, session_id: str, auth: ia.Authority = Depends(_capturer_ro), raw: bytes = Depends(_raw_body), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Add the collected card to the person (WisKey `cards/capture_confirm`, a people write: the card, enabled, goes to
    the person's existing station assignments with WisKey's immediate sync - it opens their doors). Body: `{label,
    confirmed, client_request_id, expires_at}`; `confirmed: true` comes only from the confirmation step naming the
    person. Only from `captured`. WisKey's refusals by name (`intercom_revision_conflict`, `intercom_card_conflict`,
    `intercom_capture_not_found` ...); an unclear answer is a 504 `intercom_outcome_unknown` (reload the person and look
    for the new card before anything else). The audit rows name the session, the person and the station - never the number,
    not even masked. Reply: `{state, ..., person (the editor projection), capture, sync, note, command_id, effect, pending}`.

    CR-036 S11: the stations decided when the capture started are checked again (a scope taken away meanwhile refuses the
    confirm, 403, nothing sent; WisKey's own revision check binds the person). UNKNOWN_EFFECT (DW matrix 2026-10-12: WisKey
    adds the card and asks the stations): `pending: true` until a read of the person shows the card on their stations."""
    act = _Action(request, conn, auth.principal, "intercom.card_capture.confirm", session_id, "intercom_capture")
    act.details.update(iw.effect_fields("cards/capture_confirm"))
    body: CaptureConfirmBody = _parse(act, CaptureConfirmBody, raw)
    capture = _capture_or_refuse(act, session_id)
    not_after = _envelope(act, body)
    if not _no_control(body.label):
        raise act.refuse(ApiError(422, "validation", "תווית הכרטיס אינה תקינה (ללא תווי בקרה).", details={"fields": ["label"]}))
    if body.confirmed is not True:
        raise act.refuse(ApiError(409, "confirmation_required", "הוספת הכרטיס לאדם דורשת אישור מפורש."))
    try:
        iw.check_stations(auth, capture.person_stations, permissions=(MANAGE, CAPTURE), extra_stations=[capture.station_id], sensitive=True)
    except ApiError as exc:
        raise act.refuse(exc) from None
    if capture.lease_ref is not None and not capture_lease.usable(capture.lease_ref):  # F8: refused locally, nothing signed
        capture_lease_route.stop(CAPTURES, capture, audit=False)
        raise act.refuse(capture_lease_route.gone())
    if not CAPTURES.begin_applying(capture):
        raise act.refuse(ApiError(409, "intercom_capture_not_ready", "אין כרטיס שנקרא וממתין לאישור.", details={"capture": CAPTURES.view(capture)}))
    if capture.lease_ref is not None:  # the capture-lease route (L5): ONE signed capture_confirm
        return _lease_confirm(request, act, auth, capture, body.label, not_after)
    label = body.label
    try:
        # R4-07: the confirm writes a card to the person - the same per-person gate as every other people write
        reply = _perform(act, "person", lambda call: intercom_client.capture_confirm(call, capture.session_id, label), iw.project_editor, not_after,
                         lane="config", summary=_person_summary, target=intercom_sync.person_target(capture.person_id))
    except ApiError as exc:
        outcome, code = exc.details.get("outcome"), str(exc.details.get("wiskey_code") or "")
        if outcome == "not_sent" or (outcome == "refused" and (code in intercom_client.PRE_DISPATCH or code in ("capture_not_ready", "invalid_text"))):
            CAPTURES.back_to_captured(capture)  # WisKey's session is untouched: the card still waits for approval
        elif outcome == "refused":
            CAPTURES.set_state(capture, "lost" if code == "capture_not_found" else "closed", code, only_from=("applying",))
        else:
            CAPTURES.set_state(capture, "unconfirmed", code or None, only_from=("applying",))
        exc.details["capture"] = CAPTURES.view(capture)
        raise
    except BaseException:
        CAPTURES.set_state(capture, "unconfirmed", None, only_from=("applying",))
        raise
    CAPTURES.set_state(capture, "confirmed", only_from=("applying",))
    reply["person"] = iw.view_editor_person(auth, reply["person"])
    reply["capture"] = CAPTURES.view(capture)
    reply["note"] = "WisKey הוסיף את הכרטיס לאדם וביקש לסנכרן את התחנות שלו. מצב הסנכרון של כל תחנה מוצג ברשומה."
    reply.update(iw.effect_fields("cards/capture_confirm"))
    return reply
