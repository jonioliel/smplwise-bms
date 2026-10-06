"""K11 first slice (CR-011, owner decisions 2026-10-06): the optional TOTP second factor.

`GET    auth/second-factor`                     the caller's own factor: enabled / since / last used (never the secret)
`POST   auth/second-factor/enroll`              a fresh secret + otpauth URI for the caller (refused while a factor is active)
`POST   auth/second-factor/confirm {code}`      the first code from the authenticator app activates the factor
`POST   auth/second-factor/disable {code}`      the caller removes their own factor; needs a current code
`GET    auth/second-factor/users`               system.configure: who has an active factor + the policy
`GET    auth/second-factor/overrides`            system.configure: the per-user / per-role policy overrides (TFA2)
`PUT    auth/second-factor/overrides/{kind}/{id} {policy}`  system.configure: kind user|role, policy inherit|optional|required - audited
`DELETE auth/second-factor/users/{user_id}`     system.configure: reset (remove) ANOTHER user's factor from any channel - audited;
                                                an administrator who has a factor sends their own current code
                                                (X-Arx-Second-Factor or {code}); the target's remote sign-ins end

The factor is applied to the remote sign-in (services/ha_user_auth.exchange). Codes and secrets are never logged or audited;
audit rows carry the method and the target user only. Code attempts are limited (5 wrong in 5 minutes lock the user for
10 minutes) and every route is also rate-limited per user.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, all_roles, require
from ..services import ha_user_auth as hua
from ..services import notify_sources, presence
from ..services import second_factor as sf

router = APIRouter()

ACTION_LIMITS: list[tuple[float, int]] = [(60.0, 20), (3600.0, 100)]
ALREADY_HE = "האימות הדו־שלבי כבר פעיל. כדי להחליף אותו יש להסיר אותו קודם."
NOT_ENABLED_HE = "האימות הדו־שלבי אינו פעיל."
NOT_STARTED_HE = "ההפעלה לא התחילה או שפגה. התחל שוב."
SELF_RESET_HE = "אי אפשר לאפס את האימות הדו־שלבי של עצמך. כדי להסיר אותו, השתמש ב״הסרה״ בחשבון שלך עם קוד נוכחי."
STEP_UP_HE = "כדי לאפס אימות דו־שלבי של משתמש אחר, הזן את הקוד הנוכחי מאפליקציית האימות שלך."


class CodeBody(BaseModel):
    code: str = Field(min_length=1, max_length=16)


def _limit(principal: Principal) -> None:
    if not hua.LIMITER.hit(f"factor:{principal.user_id}", ACTION_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)


def _audit(conn: sqlite3.Connection, request: Request, principal: Principal, action: str, target: str, **details: Any) -> None:
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="user", resource_id=target,
          request_id=getattr(request.state, "correlation_id", None), details={"method": "totp", **details})


def _audit_failed(conn: sqlite3.Connection, request: Request, principal: Principal, step: str, exc: sf.SecondFactorError) -> None:
    """A refused code on enrol-confirm / disable: the same row type as a failed sign-in (`auth.second_factor.failed`, denied, the
    reason, the method) plus the step; the code itself is never written. An ApiError commits, so the row survives the 400 / 429."""
    audit(conn, actor=principal, action="auth.second_factor.failed", decision="denied", resource_type="user", resource_id=principal.user_id,
          reason={"locked": "second_factor_locked", "unreadable": "second_factor_unreadable"}.get(exc.code, "second_factor_invalid"),
          request_id=getattr(request.state, "correlation_id", None), details={"method": "totp", "step": step})


def _fail(exc: sf.SecondFactorError) -> ApiError:
    return ApiError(429 if exc.code == "locked" else 400 if exc.code == "invalid" else 409, f"second_factor_{exc.code}", exc.message, retryable=exc.code == "locked")


@router.get("/auth/second-factor")
def own_status(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    return {**sf.status(conn, principal.user_id), "policy": sf.policy(conn)}


@router.post("/auth/second-factor/enroll")
def enroll(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _limit(principal)
    if sf.is_enrolled(conn, principal.user_id):
        raise ApiError(409, "second_factor_already_enabled", ALREADY_HE)
    return sf.begin_enrolment(conn, settings_of(request), principal.user_id, principal.username or principal.display_name or principal.user_id)


@router.post("/auth/second-factor/confirm")
def confirm(body: CodeBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _limit(principal)
    if sf.is_enrolled(conn, principal.user_id):
        raise ApiError(409, "second_factor_already_enabled", ALREADY_HE)
    try:
        sf.confirm(conn, settings_of(request), principal.user_id, body.code)
    except sf.SecondFactorError as exc:
        _audit_failed(conn, request, principal, "enroll_confirm", exc)
        raise _fail(exc) from None
    # security review 2.2.0 M4: a session that began before the factor existed must not roll on without it - every other
    # remote sign-in of the user ends now (the caller's own current one stays)
    ended = hua.revoke_user_sign_ins(conn, principal.user_id, actor=principal, reason="second_factor_enrolled", keep=hua.session_of(request),
                                     request_id=getattr(request.state, "correlation_id", None))
    # TFA2: a phone device token issued before the factor existed ends too; the app re-registers through a session (which owes the code)
    tokens = presence.revoke_tokens(conn, principal.user_id)
    _audit(conn, request, principal, "auth.second_factor.enrolled", principal.user_id, other_sign_ins_ended=ended, device_tokens_revoked=tokens)
    return sf.status(conn, principal.user_id)


@router.post("/auth/second-factor/disable")
def disable(body: CodeBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _limit(principal)
    if not sf.is_enrolled(conn, principal.user_id):
        raise ApiError(409, "second_factor_not_enabled", NOT_ENABLED_HE)
    try:
        sf.verify(conn, settings_of(request), principal.user_id, body.code)
    except sf.SecondFactorError as exc:
        _audit_failed(conn, request, principal, "disable", exc)
        raise _fail(exc) from None
    sf.remove(conn, principal.user_id)
    _audit(conn, request, principal, "auth.second_factor.removed", principal.user_id, by="self")
    return sf.status(conn, principal.user_id)


@router.get("/auth/second-factor/users")
def list_users(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return {"policy": sf.policy(conn), "users": [{"user_id": uid, **info} for uid, info in sorted(sf.enrolled_users(conn).items())]}


@router.get("/auth/second-factor/overrides")
def list_overrides(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return {"policy": sf.policy(conn), **sf.overrides(conn)}


class OverrideBody(BaseModel):
    policy: str = Field(max_length=16)


@router.put("/auth/second-factor/overrides/{kind}/{subject_id}")
def set_override(kind: str, subject_id: str, body: OverrideBody, request: Request, principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """TFA2 (owner decision 2026-10-06: optional, never forced; he decides later who must use it): `required` / `optional` for ONE user or
    ONE role on top of the global policy, or `inherit` to drop the override. The user's own override beats their roles', which beat the
    global one; any role `required` wins over a role `optional`. `required` ends the other remote sign-ins of the affected users who
    have no factor, so a session that began before the rule cannot roll on without it; the local channel stays the break-glass path.
    The change is audited (before / after / how many users were affected); nothing secret is involved."""
    require(conn, principal, "system.configure", INSTALLATION)
    if kind not in sf.OVERRIDE_KINDS:
        raise ApiError(404, "not_found", "סוג היעד אינו מוכר.")
    if body.policy not in sf.OVERRIDE_VALUES:
        raise ApiError(422, "invalid_policy", "המדיניות צריכה להיות inherit, optional או required.", details={"allowed": list(sf.OVERRIDE_VALUES)})
    if len(subject_id) > 200:
        raise ApiError(404, "not_found", "היעד לא נמצא.")
    if kind == "user" and conn.execute("SELECT 1 FROM users WHERE id = ?", (subject_id,)).fetchone() is None:
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית המערכת.")
    if kind == "role" and subject_id not in all_roles(conn):
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    _limit(principal)
    before = sf.set_override(conn, kind, subject_id, body.policy, principal.user_id)
    affected = [subject_id] if kind == "user" else sf.users_of_role(conn, subject_id)
    ended = 0
    if body.policy == "required":
        for uid in affected:
            if uid != principal.user_id and not sf.is_enrolled(conn, uid):
                ended += hua.revoke_user_sign_ins(conn, uid, actor=principal, reason="second_factor_required", request_id=getattr(request.state, "correlation_id", None))
    audit(conn, actor=principal, action="auth.second_factor.policy_override", decision="allowed", resource_type=kind, resource_id=subject_id,
          request_id=getattr(request.state, "correlation_id", None),
          details={"method": "totp", "before": before or "inherit", "after": body.policy, "users_affected": len(affected), "sign_ins_ended": ended})
    return {"kind": kind, "subject_id": subject_id, "policy": body.policy, **sf.overrides(conn)}


class ResetBody(BaseModel):
    code: str | None = Field(default=None, max_length=16)


@router.delete("/auth/second-factor/users/{user_id}")
def admin_reset(user_id: str, request: Request, body: ResetBody | None = None, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Recovery for a lost authenticator (owner decision 2026-10-06: an administrator may reset from anywhere). Removes the
    user's factor - active or pending - so their next sign-in needs no code; they can enrol again. Audited with the actor and
    the target; the removed secret is gone.

    Security review 2.2.0: never the caller's own factor (M1 - that is `disable`, which needs a current code); an
    administrator who has a factor shows their OWN current code (`X-Arx-Second-Factor`, or `{"code"}` in the body) - a
    stolen session or cookie alone cannot strip anyone's factor; the target's remote sign-ins end (M4)."""
    require(conn, principal, "system.configure", INSTALLATION)
    if len(user_id) > 200:
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית המערכת.")
    if user_id == principal.user_id:
        raise ApiError(409, "second_factor_self_reset", SELF_RESET_HE)
    _limit(principal)
    if sf.is_enrolled(conn, principal.user_id):
        code = (request.headers.get(hua.SECOND_FACTOR_HEADER) or (body.code if body else None) or "").strip()
        if not code:
            raise ApiError(403, "second_factor_step_up_required", STEP_UP_HE)
        try:
            sf.verify(conn, settings_of(request), principal.user_id, code)
        except sf.SecondFactorError as exc:
            audit(conn, actor=principal, action="auth.second_factor.reset", decision="denied", resource_type="user", resource_id=user_id,
                  reason=f"step_up_{exc.code}", request_id=getattr(request.state, "correlation_id", None), details={"method": "totp"})
            raise _fail(exc) from None
    was_active = sf.is_enrolled(conn, user_id)
    removed = sf.remove(conn, user_id)
    ended = hua.revoke_user_sign_ins(conn, user_id, actor=principal, reason="second_factor_reset", request_id=getattr(request.state, "correlation_id", None))
    tokens = presence.revoke_tokens(conn, user_id)  # TFA2: the phone app's device tokens end with the factor (it re-registers through a session)
    if was_active:
        notify_sources.second_factor_reset(conn, user_id)  # TFA2: the user hears of it in their inbox - no actor, no secret
    _audit(conn, request, principal, "auth.second_factor.reset", user_id, removed=removed, step_up=sf.is_enrolled(conn, principal.user_id), sign_ins_ended=ended,
           device_tokens_revoked=tokens, user_notified=was_active)
    return {"user_id": user_id, "removed": removed}
