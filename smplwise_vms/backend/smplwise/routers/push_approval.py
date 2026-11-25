"""MFA-T095-REST-2530 (CR-011 option D; T095 acceptance 3): approve a sensitive action on the phone (services/push_approval.py).

The requester (the session that was refused with 403 `step_up_required` and lists `push` among the methods):

`POST   auth/step-up/push {action}`                   open a request; answers the NUMBER the requesting screen shows
`GET    auth/step-up/push/{request_id}`               where it stands (pending / approved / denied / expired / cancelled / used)
`DELETE auth/step-up/push/{request_id}`               cancel it
then `POST auth/step-up/verify {method: "push", challenge_id: <request_id>, action}` spends an approved request (routers/second_factor).

The phone (the Android app of the same user, holding the phone key; never the requesting session itself):

`GET    auth/push-approvals`                          the pending request (what it is for - never the number)
`POST   auth/push-approvals/{request_id}/challenge {key_id, number}`   a phone-key challenge for the number the person typed
`POST   auth/push-approvals/{request_id}/approve {challenge_id, key_id, signature}`   the signed number: the right one approves, a
                                                      wrong one denies the request
`POST   auth/push-approvals/{request_id}/deny`        "this was not me"

Everything is behind `security.push_approval` (default off). Audit rows: `auth.push_approval.requested` / `.approved` / `.denied` /
`.cancelled` / `.failed` (the action, the reason, the key id - never the number, a signature or key material)."""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..services import device_keys as dk
from ..services import ha_user_auth as hua
from ..services import push_approval as pa
from ..services import step_up
from ._common import rid as _rid
from ..wire import push_approval as W
from ..wire import wire

router = APIRouter()

REQUEST_LIMITS: list[tuple[float, int]] = [(300.0, 5), (3600.0, 20)]  # per user: a flood of prompts is the fatigue attack
PHONE_LIMITS: list[tuple[float, int]] = [(60.0, 30), (3600.0, 300)]  # per user: the phone's list / challenge / answer calls
ACTION_PATTERN = r"^[a-z][a-z0-9_.]{0,63}$"


def _limit(key: str, limits: list[tuple[float, int]]) -> None:
    if not hua.LIMITER.hit(key, limits):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)


def _audit(conn: sqlite3.Connection, request: Request, principal: Principal, what: str, a: pa.Approval | None, *, allowed: bool = True,
           reason: str | None = None, **extra: Any) -> None:
    details = {"action": a.action if a else extra.pop("action", ""), **extra}
    audit(conn, actor=principal, action=f"auth.push_approval.{what}", decision="allowed" if allowed else "denied", resource_type="push_approval",
          resource_id=a.id if a else "-", reason=reason, request_id=_rid(request), details=details)


def _unknown() -> ApiError:
    return ApiError(404, "push_approval_unknown", pa.UNKNOWN_HE)


def _state(a: pa.Approval) -> dict[str, Any]:
    return {"request_id": a.id, "status": a.status, "reason": a.reason, "expires_in": pa.expires_in(a) if a.status == pa.PENDING else 0}


def _refused(action: str) -> ApiError:
    return ApiError(409, "step_up_method_refused", pa.METHOD_REFUSED_HE, details={"method": pa.METHOD, "action": action})


# ---------------------------------------------------------------- the requester

class StartBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(pattern=ACTION_PATTERN)


@router.post("/auth/step-up/push", **wire(W.PushApprovalStarted))
def start(body: StartBody, request: Request, principal: Principal = Depends(current_principal),
          conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Open an approval request for `action` on the caller's phone. Refused (nothing sent) when the switch is off, the action may not be
    approved on the phone, the user has no phone key, step-up does not apply, a denial is cooling down, or the rate limit is hit."""
    _limit(f"pareq:{principal.user_id}", REQUEST_LIMITS)
    if not pa.approvable(body.action):
        _audit(conn, request, principal, "refused", None, allowed=False, reason="step_up_method_refused", action=body.action)
        raise _refused(body.action)
    refusal: ApiError | None = None
    if not pa.enabled(conn):
        refusal = ApiError(409, "push_approval_unavailable", pa.OFF_HE, details={"reason": "off"})
    elif not dk.has_active(conn, principal.user_id):
        refusal = ApiError(409, "push_approval_unavailable", pa.NO_PHONE_HE, details={"reason": "no_phone_key"})
    elif (reason := step_up.not_applicable(conn, request, principal, body.action)) is not None:
        refusal = ApiError(409, "step_up_not_applicable", step_up.NOT_APPLICABLE_HE, details={"reason": reason})
    session = step_up.session_key(request, principal)
    if refusal is None and session is None:
        refusal = ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    if refusal is not None or session is None:
        refusal = refusal or ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
        why = refusal.details.get("reason") if isinstance(refusal.details, dict) else None
        _audit(conn, request, principal, "refused", None, allowed=False, reason=f"{refusal.code}:{why}" if why else refusal.code, action=body.action)
        raise refusal
    wait = pa.cooldown_left(principal.user_id)
    if wait > 0:
        _audit(conn, request, principal, "refused", None, allowed=False, reason="push_approval_cooldown", action=body.action)
        raise ApiError(429, "push_approval_cooldown", pa.COOLDOWN_HE, retryable=True, details={"retry_after_s": wait})
    a, superseded = pa.create(principal.user_id, session, body.action)
    for old in superseded:
        _audit(conn, request, principal, "cancelled", old, reason="superseded")
    _audit(conn, request, principal, "requested", a)
    from ..services import notify_sources

    notify_sources.push_approval_requested(conn, principal.user_id)  # content-free: no number, no action
    return {"request_id": a.id, "number": a.number, "action": a.action, "expires_in": pa.expires_in(a)}


@router.get("/auth/step-up/push/{request_id}", **wire(W.PushApprovalState))
def state(request_id: str, request: Request, principal: Principal = Depends(current_principal_ro)) -> dict[str, Any]:
    _limit(f"paphone:{principal.user_id}", PHONE_LIMITS)
    a = pa.of_requester(request_id, principal.user_id, step_up.session_key(request, principal))
    if a is None:
        raise _unknown()
    return _state(a)


@router.delete("/auth/step-up/push/{request_id}", **wire(W.PushApprovalState))
def cancel(request_id: str, request: Request, principal: Principal = Depends(current_principal),
           conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a = pa.of_requester(request_id, principal.user_id, step_up.session_key(request, principal))
    if a is None:
        raise _unknown()
    if pa.cancel(a):
        _audit(conn, request, principal, "cancelled", a, reason="cancelled")
    return _state(a)


# ---------------------------------------------------------------- the phone

@router.get("/auth/push-approvals", **wire(W.PushApprovalList))
def pending(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The caller's pending requests made from ANOTHER session (the requesting screen never approves itself). Never the right number."""
    _limit(f"paphone:{principal.user_id}", PHONE_LIMITS)
    if not pa.enabled(conn):
        return {"enabled": False, "pending": []}
    mine = step_up.session_key(request, principal)
    rows = [a for a in pa.pending_of(principal.user_id) if a.session != mine]
    return {"enabled": True, "pending": [{"request_id": a.id, "action": a.action, "expires_in": pa.expires_in(a)} for a in rows]}


def _phone_request(conn: sqlite3.Connection, request: Request, principal: Principal, request_id: str) -> tuple[pa.Approval, str]:
    """The pending request of this user as the PHONE may act on it, and the phone's session key. Fail closed with one answer."""
    _limit(f"paphone:{principal.user_id}", PHONE_LIMITS)
    if not pa.enabled(conn):
        raise ApiError(409, "push_approval_unavailable", pa.OFF_HE, details={"reason": "off"})
    a = pa.get(request_id)
    if a is None or a.user_id != principal.user_id or a.status != pa.PENDING:
        raise _unknown()
    session = step_up.session_key(request, principal)
    if session is None:
        raise ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    if session == a.session:
        raise ApiError(409, "push_approval_same_session", pa.SAME_SESSION_HE)
    return a, session


class ChallengeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key_id: str = Field(pattern=dk.KEY_ID_PATTERN)
    number: int = Field(ge=pa.NUMBER_MIN, le=pa.NUMBER_MAX)


@router.post("/auth/push-approvals/{request_id}/challenge", **wire(W.PushApprovalChallenge))
def challenge(request_id: str, body: ChallengeBody, request: Request, principal: Principal = Depends(current_principal_ro),
              conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    a, session = _phone_request(conn, request, principal, request_id)
    if dk._active_row(conn, principal.user_id, body.key_id) is None:
        raise ApiError(409, "step_up_no_method", dk.NO_KEY_HE)
    origin = dk.origin_of(settings_of(request), request)
    if not origin:
        raise ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    cid, text, ttl = dk.issue(dk.PURPOSE_STEP_UP, origin, user_id=principal.user_id, key_id=body.key_id,
                              action=f"{pa.APPROVE_ACTION_PREFIX}{body.number}", session=session)
    pa.note_challenge(a, cid, body.number)
    return {"challenge_id": cid, "payload": text, "expires_in": ttl}


class ApproveBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge_id: str = Field(pattern=dk.CHALLENGE_PATTERN)
    key_id: str = Field(pattern=dk.KEY_ID_PATTERN)
    signature: str = Field(min_length=40, max_length=120)


@router.post("/auth/push-approvals/{request_id}/approve", **wire(W.PushApprovalState))
def approve(request_id: str, body: ApproveBody, request: Request, principal: Principal = Depends(current_principal),
            conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The phone's signed number. The signature is checked first (single use, bound to this phone's session, the key and the number's
    action text; a wrong one counts towards the phone-key lockout); then the number: the right one approves, a wrong one denies."""
    a, session = _phone_request(conn, request, principal, request_id)
    number = pa.take_challenge(a, body.challenge_id)
    if number is None:
        dk.take(body.challenge_id)  # spent all the same: a challenge of another request never approves this one
        _audit(conn, request, principal, "failed", a, allowed=False, reason="challenge_mismatch")
        raise ApiError(400, "second_factor_invalid", dk.INVALID_HE)
    try:
        row = dk.check(conn, principal.user_id, body.challenge_id, body.signature, purpose=dk.PURPOSE_STEP_UP, key_id=body.key_id,
                       origin=dk.origin_of(settings_of(request), request), session=session, action=f"{pa.APPROVE_ACTION_PREFIX}{number}")
    except dk.DeviceKeyError as exc:
        _audit(conn, request, principal, "failed", a, allowed=False, reason=f"step_up_{exc.code}", why=exc.reason)
        raise ApiError(429 if exc.code == "locked" else 400, f"second_factor_{exc.code}", exc.message, retryable=exc.code == "locked") from None
    if number != a.number:
        if pa.deny(a, "number_mismatch"):
            _audit(conn, request, principal, "denied", a, allowed=False, reason="number_mismatch", key_id=row["id"])
        raise ApiError(409, "push_approval_number_mismatch", "המספר שבחרת לא תואם למספר שעל המסך שביקש. הבקשה נדחתה.",
                       details=_state(a))
    if not pa.approve(a, row["id"]):
        raise _unknown()
    _audit(conn, request, principal, "approved", a, key_id=row["id"])
    return _state(a)


@router.post("/auth/push-approvals/{request_id}/deny", **wire(W.PushApprovalState))
def deny(request_id: str, request: Request, principal: Principal = Depends(current_principal),
         conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    a, _session = _phone_request(conn, request, principal, request_id)
    if pa.deny(a, "user_denied"):
        _audit(conn, request, principal, "denied", a, allowed=False, reason="user_denied")
    return _state(a)


# ---------------------------------------------------------------- step-up verify (called by routers/second_factor.step_up_verify)

def verify_step_up(conn: sqlite3.Connection, request: Request, principal: Principal, *, request_id: str | None, action: str | None) -> dict[str, Any]:
    """`POST auth/step-up/verify {method: "push", challenge_id: <request_id>, action}`: spend an APPROVED request of this user, made by
    THIS session for exactly `action`, within push_approval.USE_WINDOW_S of the approval -> a proof for ONE request of that action
    (step_up.mark_action). Audited `auth.step_up.ok` / `auth.step_up.failed` like every method."""
    act = action or ""
    details = {"method": pa.METHOD, "action": act}
    if not pa.approvable(act) or not pa.enabled(conn):
        audit(conn, actor=principal, action="auth.step_up.failed", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason="step_up_method_refused", request_id=_rid(request), details=details)
        raise _refused(act)
    reason = step_up.not_applicable(conn, request, principal, act)
    if reason == "no_method":
        raise ApiError(409, "step_up_no_method", step_up.NO_METHOD_HE)
    if reason is not None:
        raise ApiError(409, "step_up_not_applicable", step_up.NOT_APPLICABLE_HE, details={"reason": reason})
    session = step_up.session_key(request, principal)
    if session is None:
        raise ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    a = pa.spend(request_id, principal.user_id, session, act)
    if a is None:
        audit(conn, actor=principal, action="auth.step_up.failed", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason="step_up_invalid", request_id=_rid(request), details=details)
        raise ApiError(400, "second_factor_invalid", pa.NOT_APPROVED_HE)
    until = step_up.mark_action(request, principal, act, pa.METHOD)
    audit(conn, actor=principal, action="auth.step_up.ok", decision="allowed", resource_type="user", resource_id=principal.user_id,
          request_id=_rid(request), details={**details, "minutes": 0, "action_bound": True, "key_id": a.key_id})
    return {"method": pa.METHOD, "minutes": 0, "valid_until": step_up.iso(until)}
