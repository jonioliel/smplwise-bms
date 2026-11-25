"""K11 first slice (CR-011, owner decisions 2026-10-06): the optional TOTP second factor.

`GET    auth/second-factor`                     the caller's own factor: enabled / since / last used (never the secret)
`POST   auth/second-factor/enroll`              a fresh secret + otpauth URI for the caller (refused while a factor is active)
`POST   auth/second-factor/confirm {code}`      the first code from the authenticator app activates the factor
`POST   auth/second-factor/disable {code}`      the caller removes their own factor; needs a current code
`GET    auth/second-factor/users`               system.configure: who has an active factor + the policy
`GET    auth/second-factor/overrides`            system.configure: the per-user / per-role policy overrides (TFA2)
`PUT    auth/second-factor/overrides/{kind}/{id} {policy}`  system.configure: kind user|role, policy inherit|optional|required - audited
`DELETE auth/second-factor/users/{user_id} {confirm, code?}`  system.configure: reset (remove) EVERY factor of ANOTHER user - audited;
                                                an administrator who has a factor sends their own current code
                                                (X-Arx-Second-Factor or {code}) or a once-proof; MFA-RESET-HARDENING-2510: the typed
                                                username (`confirm`), the channel setting, 3 per administrator per hour, never the last
                                                administrator who can sign in remotely; every sign-in and device credential of the
                                                target ends; the user and the managers are told; the user must enrol again
`GET    auth/second-factor/users/{user_id}/reset-check`  MFA-RESET-HARDENING-2510: the preflight of that reset (services/factor_reset.check)
`GET    auth/step-up`                           MFA-STEPUP-TRAIN-2490: the step-up switch, window and the caller's current proof
`POST   auth/step-up/verify {method, code}`     MFA-STEPUP-TRAIN-2490: a current code -> a step-up proof on THIS session (services/step_up);
                                                MFA-PASSKEYS-2490: {method: "passkey", challenge_id, assertion} answers a challenge of
                                                `POST auth/step-up/challenge` (routers/local_passkeys.py, services/user_passkeys.py)
                                                method `recovery_code`: a one-time recovery code instead (MFA-RECOVERY-CODES-2490)
`GET    auth/recovery-codes`                    MFA-RECOVERY-CODES-2490: how many of the caller's recovery codes remain (never a code)
`POST   auth/recovery-codes {code?}`            MFA-RECOVERY-CODES-2490: a new batch of 10 (the old one stops working); needs a fresh
                                                step-up (a proof from the last minutes, or the current authenticator code in the body)

The enrolment's confirm answer carries the first batch of recovery codes (shown once). Removing one's own factor accepts a recovery
code in place of the current code (the lost-phone path); removing or resetting the factor deletes the codes.
                                                MFA-DEVICEKEY-2490: {method: "device_key", challenge_id, key_id, signature} answers a
                                                `step_up` challenge of `POST auth/device-keys/challenge` (routers/device_keys.py)

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
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, all_roles, require
from ..services import ha_user_auth as hua
from ..services import capture_lease, factor_reset, notify_sources, presence
from ..services import recovery_codes as rc
from ..services import second_factor as sf
from ..services import second_factor_store as store
from ..services import step_up
from ._common import rid as _rid
from ..wire import second_factor as W
from ..wire import wire

router = APIRouter()

ACTION_LIMITS: list[tuple[float, int]] = [(60.0, 20), (3600.0, 100)]
ALREADY_HE = "האימות הדו־שלבי כבר פעיל. כדי להחליף אותו יש להסיר אותו קודם."
NOT_ENABLED_HE = "האימות הדו־שלבי אינו פעיל."
NOT_STARTED_HE = "ההפעלה לא התחילה או שפגה. התחל שוב."
SELF_RESET_HE = "אי אפשר לאפס את האימות הדו־שלבי של עצמך. כדי להסיר אותו, השתמש ב״הסרה״ בחשבון שלך עם קוד נוכחי."
ENROLL_ACTION = "auth.second_factor.enroll"
STEP_UP_HE = "כדי לאפס אימות דו־שלבי של משתמש אחר, אשר את הזהות שלך: הקוד הנוכחי מאפליקציית האימות, מפתח גישה או מפתח הטלפון."


class CodeBody(BaseModel):
    code: str = Field(min_length=1, max_length=16)


def _limit(principal: Principal) -> None:
    if not hua.LIMITER.hit(f"factor:{principal.user_id}", ACTION_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)


def _audit(conn: sqlite3.Connection, request: Request, principal: Principal, action: str, target: str, **details: Any) -> None:
    audit(conn, actor=principal, action=action, decision="allowed", resource_type="user", resource_id=target,
          request_id=_rid(request), details={"method": "totp", **details})


def _audit_failed(conn: sqlite3.Connection, request: Request, principal: Principal, step: str, exc: sf.SecondFactorError, code: str | None = None) -> None:
    """A refused code on enrol-confirm / disable: the same row type as a failed sign-in (`auth.second_factor.failed`, denied, the
    reason, the method) plus the step; the code itself is never written. An ApiError commits, so the row survives the 400 / 429."""
    audit(conn, actor=principal, action="auth.second_factor.failed", decision="denied", resource_type="user", resource_id=principal.user_id,
          reason={"locked": "second_factor_locked", "unreadable": "second_factor_unreadable"}.get(exc.code, "second_factor_invalid"),
          request_id=_rid(request), details={"method": rc.METHOD if rc.canonical(code) is not None else "totp", "step": step})


def _audit_batch(conn: sqlite3.Connection, request: Request, principal: Principal, why: str, voided: int) -> None:
    """MFA-RECOVERY-CODES-2490: `auth.recovery_codes.generated` - why (enrolment | regenerate), how many, how many unused old codes
    stopped working. Never a code."""
    audit(conn, actor=principal, action="auth.recovery_codes.generated", decision="allowed", resource_type="user", resource_id=principal.user_id,
          request_id=_rid(request), details={"method": rc.METHOD, "reason": why, "count": rc.COUNT, "voided": voided})


def _fail(exc: sf.SecondFactorError) -> ApiError:
    return ApiError(429 if exc.code == "locked" else 400 if exc.code == "invalid" else 409, f"second_factor_{exc.code}", exc.message, retryable=exc.code == "locked")


@router.get("/auth/second-factor", **wire(W.OwnFactor))
def own_status(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    # MFA-RESET-HARDENING-2510: an administrator reset this account's factors and none was enrolled since (`must_enroll`); with the
    # factor policy requiring one, the next remote sign-in goes to enrolment (`must_enroll_enforced`)
    return {**sf.status(conn, principal.user_id), "policy": sf.policy(conn), "must_enroll": factor_reset.must_enroll(conn, principal.user_id),
            "must_enroll_enforced": factor_reset.enforced(conn, principal.user_id)}


@router.post("/auth/second-factor/enroll", **wire(W.Enrolment))
def enroll(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _limit(principal)
    if sf.is_enrolled(conn, principal.user_id):
        raise ApiError(409, "second_factor_already_enabled", ALREADY_HE)
    # MFA-SECFIX-2500 SR-3: a FIRST factor needs a recent sign-in of this session (403 reauth_required); a user who already has a
    # passkey / phone key needs a fresh step-up proof (never a recovery code) - a stolen old session cannot take the account's factor
    try:
        step_up.require_first_factor_freshness(conn, request, principal, ENROLL_ACTION)
    except ApiError as exc:
        audit(conn, actor=principal, action="auth.second_factor.failed", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason=exc.code, request_id=_rid(request), details={"method": "totp", "step": "enroll"})
        raise
    return sf.begin_enrolment(conn, settings_of(request), principal.user_id, principal.username or principal.display_name or principal.user_id)


@router.post("/auth/second-factor/confirm", **wire(W.FactorEnabled))
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
                                     request_id=_rid(request))
    # TFA2: a phone device token issued before the factor existed ends too; the app re-registers through a session (which owes the code)
    tokens = presence.revoke_tokens(conn, principal.user_id)
    if principal.source == "local":  # USR2: the other local sessions end; this one rotates and counts as having shown the factor
        from ..services import local_identity

        ended += local_identity.on_factor_enabled(conn, settings_of(request), request, principal)
    _audit(conn, request, principal, "auth.second_factor.enrolled", principal.user_id, other_sign_ins_ended=ended, device_tokens_revoked=tokens)
    notify_sources.second_factor_added(conn, principal.user_id, "totp")  # MFA-SECFIX-2500 SR-3: the user hears of it on every device
    factor_reset.enrolled(conn, principal.user_id)  # MFA-RESET-HARDENING-2510: a factor again - the reset's must_enroll ends
    step_up.note_proof(request, principal, "totp")  # MFA-STEPUP-TRAIN-2490: the first code was just shown in this session
    # MFA-RECOVERY-CODES-2490 (owner Q49): the first batch of one-time recovery codes, shown once in this answer and never again
    codes, voided = rc.generate(conn, principal.user_id)
    _audit_batch(conn, request, principal, "enrolment", voided)
    capture_lease.on_authority_change("second_factor_changed", user_ids=[principal.user_id])  # CR-WISKEY-LEASE-REVOCATION-EVENT T6
    return {**sf.status(conn, principal.user_id), "recovery_codes": codes}


@router.post("/auth/second-factor/disable", **wire(W.FactorStatus))
def disable(body: CodeBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _limit(principal)
    if not sf.is_enrolled(conn, principal.user_id):
        raise ApiError(409, "second_factor_not_enabled", NOT_ENABLED_HE)
    try:
        # MFA-RECOVERY-CODES-2490: a recovery code works here too - the lost-phone path is "remove with a recovery code, enrol again"
        method = rc.verify_factor(conn, settings_of(request), principal.user_id, body.code, "disable")
    except sf.SecondFactorError as exc:
        _audit_failed(conn, request, principal, "disable", exc, body.code)
        raise _fail(exc) from None
    if method == rc.METHOD:
        rc.audit_use(conn, principal, "disable", _rid(request))
    sf.remove(conn, principal.user_id)
    step_up.forget_user(principal.user_id)  # MFA-STEPUP-TRAIN-2490: no proof outlives the factor it came from
    factor_cleared = False
    if principal.source == "local":  # USR2 review RELEASE_264 F2: no factor left -> this session no longer counts as factor-verified
        from ..services import local_identity

        factor_cleared = local_identity.on_factor_removed(conn, principal.user_id)
    _audit(conn, request, principal, "auth.second_factor.removed", principal.user_id, by="self", factor_cleared=factor_cleared)
    notify_sources.second_factor_changed(conn, principal.user_id, "removed:totp")  # MFA-FACTOR-HARDEN-2520 N-6: the user is told
    capture_lease.on_authority_change("second_factor_changed", user_ids=[principal.user_id])  # CR-WISKEY-LEASE-REVOCATION-EVENT T6
    return sf.status(conn, principal.user_id)


@router.get("/auth/second-factor/users", **wire(W.EnrolledUsers))
def list_users(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return {"policy": sf.policy(conn), "users": [{"user_id": uid, **info} for uid, info in sorted(sf.enrolled_users(conn).items())],
            "must_enroll": factor_reset.must_enroll_users(conn)}  # MFA-RESET-HARDENING-2510: reset by an administrator, not enrolled since


@router.get("/auth/second-factor/overrides", **wire(W.Overrides))
def list_overrides(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    return {"policy": sf.policy(conn), **sf.overrides(conn)}


class OverrideBody(BaseModel):
    policy: str = Field(max_length=16)


@router.put("/auth/second-factor/overrides/{kind}/{subject_id}", **wire(W.OverrideSet))
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
    if kind == "user" and store.user_row(conn, subject_id) is None:
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית המערכת.")
    if kind == "role" and subject_id not in all_roles(conn):
        raise ApiError(404, "not_found", "התפקיד לא נמצא.")
    _limit(principal)
    before = sf.set_override(conn, kind, subject_id, body.policy, principal.user_id)
    affected = [subject_id] if kind == "user" else sf.users_of_role(conn, subject_id)
    ended = phones = 0
    if body.policy == "required":
        rid = _rid(request)
        for uid in affected:
            if uid != principal.user_id and not sf.is_enrolled(conn, uid):
                ended += hua.revoke_user_sign_ins(conn, uid, actor=principal, reason="second_factor_required", request_id=rid)
                # XSECFOLLOW-297 (review follow-up b): a device token issued before the rule must not roll on without the factor either -
                # the phone's device token and push registration end; the app re-registers through a session, which now owes the code
                phones += presence.end_on_sign_out(conn, uid, "second_factor_required", everywhere=True, actor=principal, request_id=rid)
    audit(conn, actor=principal, action="auth.second_factor.policy_override", decision="allowed", resource_type=kind, resource_id=subject_id,
          request_id=_rid(request),
          details={"method": "totp", "before": before or "inherit", "after": body.policy, "users_affected": len(affected), "sign_ins_ended": ended,
                   "device_credentials_ended": phones})
    return {"kind": kind, "subject_id": subject_id, "policy": body.policy, **sf.overrides(conn)}


def require_step_up(conn: sqlite3.Connection, request: Request, principal: Principal, body_code: str | None, *, action: str, target: str) -> bool:
    """Security review 2.2.0 M1: an administrator who has a factor shows their OWN current code (`X-Arx-Second-Factor`, or the body's
    `code`) before stripping a factor from someone else - a stolen session or cookie alone cannot. True when a code was checked.
    Shared by the TOTP reset below and the administrator's passkey removal (USR2 phase 4, routers/local_passkeys.py).
    MFA-STEPUP-GATES-2490: a once-action on the central proof (services/step_up.once_proof, grace 0) - the own code in this request as
    before, or a once-proof from `POST auth/step-up/verify {action}` for exactly this action; a window proof never counts."""
    try:
        method = step_up.once_proof(conn, request, principal, action, body_code)
    except step_up.OnceProofMissing:
        raise ApiError(403, "second_factor_step_up_required", STEP_UP_HE, details=step_up.once_details(conn, principal, action)) from None
    except sf.SecondFactorError as exc:
        audit(conn, actor=principal, action=action, decision="denied", resource_type="user", resource_id=target,
              reason=f"step_up_{exc.code}", request_id=_rid(request), details={"method": "totp"})
        raise _fail(exc) from None
    return method is not None


class ResetBody(BaseModel):
    code: str | None = Field(default=None, max_length=16)
    # MFA-RESET-HARDENING-2510: the target's username, typed by the administrator (services/factor_reset.confirm_text)
    confirm: str | None = Field(default=None, max_length=200)


def _reset_refused(conn: sqlite3.Connection, request: Request, principal: Principal, target: str, reason: str, status: int, code: str,
                   message: str, **details: Any) -> ApiError:
    """MFA-RESET-HARDENING-2510: one audited refusal of the reset (`auth.second_factor.reset`, denied, the reason; never a typed value
    or a code). An ApiError commits, so the row survives the refusal."""
    audit(conn, actor=principal, action=factor_reset.ACTION, decision="denied", resource_type="user", resource_id=target, reason=reason,
          request_id=_rid(request), details={"method": "totp", **details})
    return ApiError(status, code, message, details=details or None)


@router.get("/auth/second-factor/users/{user_id}/reset-check", **wire(W.FactorResetCheck))
def admin_reset_check(user_id: str, request: Request, principal: Principal = Depends(current_principal_ro),
                      conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """MFA-RESET-HARDENING-2510: the preflight of `DELETE auth/second-factor/users/{user_id}` for the reset dialog - may the reset go
    ahead now (else the first refusal it would meet), the username to type, the channel setting, the resets left this hour, what would
    be removed, whether the user must enrol again, the step-up details of the once-action. Reads only (no proof spent, nothing written)."""
    require(conn, principal, "system.configure", INSTALLATION)
    if len(user_id) > 200:
        raise ApiError(404, "user_unknown", factor_reset.UNKNOWN_HE)
    return factor_reset.check(conn, request, principal, user_id)


@router.delete("/auth/second-factor/users/{user_id}", **wire(W.FactorReset))
def admin_reset(user_id: str, request: Request, body: ResetBody | None = None, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Recovery for a lost authenticator (owner decision 2026-10-06, kept by Q53 on 2026-11-22: an administrator may reset from
    anywhere). Removes EVERY factor of the user (MFA-SECFIX-2500 SR-2) so their next sign-in needs no code; they enrol again.

    Security review 2.2.0: never the caller's own factor (M1 - that is `disable`, which needs a current code); an administrator who
    has a factor shows their OWN current code (`X-Arx-Second-Factor`, or `{"code"}` in the body) or a once-proof - a stolen session or
    cookie alone cannot strip anyone's factor; the target's sign-ins end (M4).

    MFA-RESET-HARDENING-2510 (services/factor_reset.py), checked in this order, each refusal audited, all before the proof is read:
    the channel setting `security.factor_reset_channel`, (MFA-FACTOR-HARDEN-2520 N-5) from outside a sign-in of the administrator's
    session within 5 minutes (403 `reauth_required`, the first factor's rule), the typed username (`{"confirm"}`), the last administrator who can sign in
    remotely, 3 resets per administrator per hour. After the reset: every sign-in and device credential of the target ends (the
    administrator's "sign out everywhere"), the user AND the managers are told, and the user must enrol again (`must_enroll`)."""
    require(conn, principal, "system.configure", INSTALLATION)
    if len(user_id) > 200:
        raise ApiError(404, "user_unknown", factor_reset.UNKNOWN_HE)
    if user_id == principal.user_id:
        raise _reset_refused(conn, request, principal, user_id, "self", 409, "second_factor_self_reset", SELF_RESET_HE)
    expected = factor_reset.confirm_text(conn, user_id)
    if expected is None:
        raise ApiError(404, "user_unknown", factor_reset.UNKNOWN_HE)
    if factor_reset.channel_refuses(conn, request):
        raise _reset_refused(conn, request, principal, user_id, "local_only", 403, "factor_reset_local_only", factor_reset.LOCAL_ONLY_HE,
                             channel=factor_reset.CHANNEL_LOCAL)
    if factor_reset.reauth_refuses(request):  # MFA-FACTOR-HARDEN-2520 N-5: from outside, a sign-in of this session within 5 minutes
        raise _reset_refused(conn, request, principal, user_id, "reauth", 403, "reauth_required", step_up.REAUTH_HE,
                             action=factor_reset.ACTION, within_s=int(step_up.RECENT_SIGN_IN_S))
    typed = body.confirm if body else None
    if not (typed or "").strip():
        raise _reset_refused(conn, request, principal, user_id, "confirm_required", 422, "factor_reset_confirm_required",
                             factor_reset.CONFIRM_REQUIRED_HE, field="confirm")
    if not factor_reset.confirm_matches(expected, typed):
        raise _reset_refused(conn, request, principal, user_id, "confirm_mismatch", 422, "factor_reset_confirm_mismatch",
                             factor_reset.CONFIRM_MISMATCH_HE, field="confirm")
    if factor_reset.last_admin_blocks(conn, user_id, remote_on=factor_reset.remote_on(request)):
        raise _reset_refused(conn, request, principal, user_id, "last_admin", 409, "factor_reset_last_admin", factor_reset.LAST_ADMIN_HE)
    if factor_reset.resets_left(conn, principal.user_id) <= 0:
        raise _reset_refused(conn, request, principal, user_id, "rate_limited", 429, "factor_reset_rate_limited", factor_reset.RATE_LIMITED_HE,
                             limit=factor_reset.RATE_MAX, window_s=factor_reset.RATE_WINDOW_S)
    _limit(principal)
    require_step_up(conn, request, principal, body.code if body else None, action="auth.second_factor.reset", target=user_id)
    was_active = sf.is_enrolled(conn, user_id)
    # MFA-SECFIX-2500 SR-2: "reset the second factor" removes EVERY factor kind - the authenticator code and its recovery codes,
    # every passkey and every phone key - so a factor an attacker added cannot survive the reset the user asked for
    wiped = sf.remove_every_factor(conn, user_id, by=principal.user_id)
    removed = wiped["totp"] or any(wiped[k] for k in ("passkeys", "device_keys", "recovery_codes"))
    was_active = was_active or bool(wiped["passkeys"] or wiped["device_keys"])
    step_up.forget_user(user_id)  # MFA-STEPUP-TRAIN-2490: the target's step-up proofs end with the factor (once-proofs too)
    capture_lease.on_authority_change("second_factor_changed", user_ids=[user_id])  # CR-WISKEY-LEASE-REVOCATION-EVENT T6
    rid = _rid(request)
    ended = hua.revoke_user_sign_ins(conn, user_id, actor=principal, reason="second_factor_reset", request_id=rid)
    tokens = presence.revoke_tokens(conn, user_id)  # TFA2: the phone app's device tokens end with the factor (it re-registers through a session)
    # MFA-RESET-HARDENING-2510: the administrator's "sign out everywhere" (routers/remote revoke-all) - the push registrations of the
    # user's phones end too, so a phone the reset is meant to shut out stops receiving notices at once
    devices = presence.end_on_sign_out(conn, user_id, "second_factor_reset", everywhere=True, actor=principal, request_id=rid)
    from ..services import local_identity

    ended += local_identity.on_factor_reset(conn, user_id)  # USR2: a local user's sessions end with the factor (`factor_reset`)
    factor_reset.mark_must_enroll(conn, user_id, by=principal.user_id)  # MFA-RESET-HARDENING-2510: the next sign-in enrols again
    if was_active:
        notify_sources.second_factor_reset(conn, user_id)  # TFA2: the user hears of it in their inbox - no actor, no secret
    from ..remote_channel import is_remote

    remote = bool(is_remote(request))
    notify_sources.second_factor_reset_by_admin(conn, user_id, remote=remote)  # MFA-RESET-HARDENING-2510: and so do the managers
    left = max(factor_reset.resets_left(conn, principal.user_id) - 1, 0)  # this reset's own audit row is written just below
    _audit(conn, request, principal, factor_reset.ACTION, user_id, removed=removed, step_up=bool(step_up.methods_of(conn, principal.user_id)),
           sign_ins_ended=ended, device_tokens_revoked=tokens, device_credentials_ended=devices, user_notified=was_active, managers_notified=True,
           totp_removed=wiped["totp"], passkeys_removed=wiped["passkeys"], device_keys_revoked=wiped["device_keys"],
           recovery_codes_removed=wiped["recovery_codes"], must_enroll=True, reset_channel=factor_reset.channel(conn), resets_left=left)
    return {"user_id": user_id, "removed": removed, "totp": wiped["totp"], "passkeys": wiped["passkeys"], "device_keys": wiped["device_keys"],
            "recovery_codes": wiped["recovery_codes"], "sign_ins_ended": ended, "device_credentials_ended": devices, "must_enroll": True,
            "resets_left": left}


# ---------------------------------------------------------------- step-up (MFA-STEPUP-TRAIN-2490, services/step_up.py)

STEP_UP_LIMITS: list[tuple[float, int]] = [(300.0, 10), (3600.0, 30)]


@router.get("/auth/step-up", **wire(W.StepUpStatus))
def step_up_status(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return step_up.status(conn, request, principal)


class StepUpBody(BaseModel):
    method: str = Field(default=step_up.METHOD_TOTP, pattern="^(totp|passkey|recovery_code|device_key)$")
    code: str | None = Field(default=None, min_length=1, max_length=16)  # method totp / recovery_code
    challenge_id: str | None = Field(default=None, max_length=80)  # method passkey (MFA-PASSKEYS-2490) / device_key (MFA-DEVICEKEY-2490)
    assertion: dict[str, Any] | None = None  # method passkey: PublicKeyCredential.toJSON() of the assertion
    key_id: str | None = Field(default=None, max_length=40)  # method device_key
    signature: str | None = Field(default=None, max_length=120)  # method device_key: base64url ECDSA P-256 signature of the payload
    action: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_.]{0,63}$")  # the change the proof is for (audit only)


@router.post("/auth/step-up/verify", **wire(W.StepUpProof))
def step_up_verify(body: StepUpBody, request: Request, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A current authenticator code -> a step-up proof on the caller's session (memory, server-side), good for
    `security.step_up_minutes` (0: one gated request). Audited `auth.step_up.ok` / `auth.step_up.failed` with the method and the
    action, never the code. Wrong codes count towards the factor's lockout (5 in 5 minutes); the route is rate-limited per user."""
    if not hua.LIMITER.hit(f"stepup:{principal.user_id}", STEP_UP_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    if body.method == step_up.METHOD_PASSKEY:  # MFA-PASSKEYS-2490: the assertion of a step-up challenge (services/user_passkeys.verify)
        from ..services import user_passkeys

        return user_passkeys.verify(conn, request, principal, body.challenge_id, body.assertion, body.action, _rid(request))
    if body.method == step_up.METHOD_DEVICE_KEY:  # MFA-DEVICEKEY-2490: a phone-key signature of a step-up challenge
        from . import device_keys

        return device_keys.verify_step_up(conn, request, principal, challenge_id=body.challenge_id, key_id=body.key_id,
                                          signature=body.signature, action=body.action)
    if not body.code:
        raise ApiError(422, "validation", "הזן את הקוד מאפליקציית האימות.", details={"field": "code"})
    # MFA-STEPUP-GATES-2490: a proof for ONE call of a once-action, on every channel (MFA-RESET-HARDENING-2510: also the once-actions
    # that apply only while step-up is on - a role change to system administrator, a backup restore)
    once = body.action in step_up.ANY_ONCE_ACTIONS
    # MFA-PASSKEYS-2490: a factor change needs a proof whatever the switch / channel says (MFA-SECFIX-2500: every factor change -
    # passkeys, phone keys, a new batch of recovery codes - step_up.FACTOR_CHANGE_ACTIONS)
    if once or body.action in step_up.FACTOR_CHANGE_ACTIONS:
        reason = None if step_up.methods_of(conn, principal.user_id) else "no_method"
    else:
        reason = step_up.not_applicable(conn, request, principal)
    if reason == "no_method":
        raise ApiError(409, "step_up_no_method", step_up.NO_METHOD_HE)
    if reason is not None:
        raise ApiError(409, "step_up_not_applicable", step_up.NOT_APPLICABLE_HE, details={"reason": reason})
    if step_up.session_key(request, principal) is None:
        raise ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    details = {"method": body.method, "action": body.action or ""}
    if body.method == step_up.METHOD_RECOVERY and not step_up.recovery_allowed(body.action):
        # MFA-SECFIX-2500 W-1 / SR-4 (owner questions page Q13, recommendation): a recovery code is a window proof only - never a
        # once-action (another user's factor reset, the bridge-key reveal, a passkey removal) and never a factor change; refused
        # before the code is read, so it is not spent
        audit(conn, actor=principal, action="auth.step_up.failed", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason="step_up_method_refused", request_id=_rid(request), details=details)
        raise ApiError(409, "step_up_method_refused", step_up.RECOVERY_REFUSED_HE, details={"method": body.method, "action": body.action or ""})
    try:
        if body.method == step_up.METHOD_RECOVERY:
            # MFA-RECOVERY-CODES-2490: a one-time recovery code (spent here). Only the recovery-code shape is checked under this method:
            # a 6-digit code sent as `recovery_code` is a wrong code (counted towards the shared lockout), never checked as the app's code
            if rc.canonical(body.code) is None:
                raise _wrong_recovery(conn, principal.user_id)
            rc.verify_factor(conn, settings_of(request), principal.user_id, body.code, "step_up")
        else:
            sf.verify(conn, settings_of(request), principal.user_id, body.code)
    except sf.SecondFactorError as exc:
        audit(conn, actor=principal, action="auth.step_up.failed", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason=f"step_up_{exc.code}", request_id=_rid(request), details=details)
        raise _fail(exc) from None
    if once:
        until = step_up.mark_once(request, principal, body.action or "", body.method)
        audit(conn, actor=principal, action="auth.step_up.ok", decision="allowed", resource_type="user", resource_id=principal.user_id,
              request_id=_rid(request), details={**details, "minutes": 0, "once": True})
        return {"method": body.method, "minutes": 0, "valid_until": step_up.iso(until)}
    if body.method == step_up.METHOD_RECOVERY:
        rc.audit_use(conn, principal, "step_up", _rid(request), action=body.action or "")
    until = step_up.mark(conn, request, principal, body.method)
    audit(conn, actor=principal, action="auth.step_up.ok", decision="allowed", resource_type="user", resource_id=principal.user_id,
          request_id=_rid(request), details={**details, "minutes": step_up.minutes(conn)})
    return {"method": body.method, "minutes": step_up.minutes(conn), "valid_until": step_up.iso(until)}


def _wrong_recovery(conn: sqlite3.Connection, user_id: str) -> sf.SecondFactorError:
    if sf.FAILURES.locked(conn, user_id) or sf.FAILURES.fail(conn, user_id):
        return sf.SecondFactorError("locked", sf.LOCKED_HE)
    return sf.SecondFactorError("invalid", rc.INVALID_HE)


# ---------------------------------------------------------------- recovery codes (MFA-RECOVERY-CODES-2490, services/recovery_codes.py)

RECOVERY_UNAVAILABLE_HE = "קודי שחזור זמינים רק כשהאימות הדו־שלבי מאפליקציית אימות פעיל בחשבון."
RECOVERY_STEP_UP_HE = "כדי ליצור קודי שחזור חדשים צריך לאשר שוב את הזהות: בקוד הנוכחי מאפליקציית האימות, במפתח גישה או במפתח הטלפון (לא בקוד שחזור)."


@router.get("/auth/recovery-codes", **wire(W.RecoveryStatus))
def recovery_status(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The caller's own recovery codes: whether they can have any (the authenticator factor is on), how many remain of how many,
    when the batch was made and a code last used, and whether few remain (`low`). Never a code."""
    return {"available": sf.is_enrolled(conn, principal.user_id), **rc.status(conn, principal.user_id)}


class RecoveryBody(BaseModel):
    code: str | None = Field(default=None, max_length=16)


@router.post("/auth/recovery-codes", **wire(W.RecoveryBatch))
def recovery_regenerate(request: Request, body: RecoveryBody | None = None, principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A new batch of recovery codes for the caller (shown ONCE in this answer); every code of the previous batch stops working.
    Needs a fresh step-up whatever `security.step_up` says (a stolen session alone must not mint codes that outlive it): a proof that
    counts now on this session (`auth/step-up/verify`, a sign-in or enrolment that just showed the factor), or the CURRENT
    authenticator code in the body / X-Arx-Second-Factor - never a recovery code. Audited `auth.recovery_codes.generated`
    (or denied with the reason); rate-limited like every factor action.
    With step-up off (owner Q2 = b) no proof is asked; MFA-FACTOR-HARDEN-2520 N-1: a remote caller without the current code then
    needs a sign-in of this session within 5 minutes (403 `reauth_required`), the first factor's rule."""
    _limit(principal)
    if not sf.is_enrolled(conn, principal.user_id):
        raise ApiError(409, "recovery_codes_unavailable", RECOVERY_UNAVAILABLE_HE)
    code = (request.headers.get(hua.SECOND_FACTOR_HEADER) or (body.code if body else None) or "").strip()
    if not code and not step_up.factor_change_proof_on(conn):
        # MFA-SECFIX-2500 (owner Q2 = b): with step-up off a new batch asks for no proof (as the other factor changes) -
        # MFA-FACTOR-HARDEN-2520 N-1: but, like every factor added from outside, a sign-in of this session within 5 minutes
        try:
            step_up.require_recent_sign_in(request, "auth.recovery_codes.regenerate")
        except ApiError as exc:
            audit(conn, actor=principal, action="auth.recovery_codes.generated", decision="denied", resource_type="user", resource_id=principal.user_id,
                  reason=exc.code, request_id=_rid(request), details={"method": rc.METHOD, "reason": "regenerate"})
            raise
    elif code:
        try:
            sf.verify(conn, settings_of(request), principal.user_id, code)
        except sf.SecondFactorError as exc:
            audit(conn, actor=principal, action="auth.recovery_codes.generated", decision="denied", resource_type="user", resource_id=principal.user_id,
                  reason=f"step_up_{exc.code}", request_id=_rid(request), details={"method": "totp", "reason": "regenerate"})
            raise _fail(exc) from None
        step_up.note_proof(request, principal, "totp")
    elif not step_up.fresh_proof(conn, request, principal):
        audit(conn, actor=principal, action="auth.recovery_codes.generated", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason="step_up_required", request_id=_rid(request), details={"method": rc.METHOD, "reason": "regenerate"})
        raise ApiError(403, "step_up_required", RECOVERY_STEP_UP_HE,
                       details={"action": "auth.recovery_codes.regenerate", "methods": [step_up.METHOD_TOTP], "minutes": step_up.minutes(conn),
                                "verify_path": "auth/step-up/verify"})
    codes, voided = rc.generate(conn, principal.user_id)
    _audit_batch(conn, request, principal, "regenerate", voided)
    notify_sources.second_factor_changed(conn, principal.user_id, "recovery_batch")  # MFA-FACTOR-HARDEN-2520 N-6: never a code in it
    return {"codes": codes, **rc.status(conn, principal.user_id)}
