"""USR2 phase 4: passkeys (WebAuthn) of Arx-only (local) identities - services/local_passkeys.py has the rules.

Public (remote channel only; 404 on the local channel; 403 `local_identity_off` while `security.local_identity` is off; login CSRF,
https - the same guard as the password sign-in, routers/local_identity._public_guard):
`POST auth/local/sign-in/passkey/options`   the pending second step (cookie `arx_pending`) -> assertion options for THAT user's passkeys
`POST auth/local/sign-in/passkey {credential}`  the pending second step answered by a passkey -> the session cookie | 401 `passkey_invalid`
`POST auth/local/passkey/options`           passkey first: options for a discoverable credential (403 `passkey_first_off` unless the owner
                                            switch `security.local_passkey_first` is on); its own per-address budget and
                                            challenge pool (review RELEASE_264 F1 / F10)
`POST auth/local/passkey {credential}`      passkey first: the session cookie | 401 `passkey_invalid` (uniform) | 429 (the sign-in's
                                            per-address tier, shared with the password route)

Self (a local identity on its own session; MFA-PASSKEYS-2490: every other user too while `security.passkeys_all_users` is on -
services/user_passkeys.py has their rules; with the switch off they get the 403 `not_local_identity` of before):
`GET    auth/passkeys`                      the caller's passkeys (never a credential id or a public key), the relying party, the modes
`POST   auth/passkeys/register/options`     a fresh sign-in (< 5 min; with the factor when the user has one) -> creation options;
                                            other users: a fresh step-up proof when the account already has a factor (403
                                            `step_up_required`, action `auth.passkey.register`)
`POST   auth/passkeys/register {credential, label?}`
`PATCH  auth/passkeys/{id} {label}`
`DELETE auth/passkeys/{id} {code?}`         a fresh sign-in, the current TOTP code, or a fresh step-up proof; other users: the code or a
                                            fresh step-up proof whenever the account has a factor (403 `step_up_required`, action
                                            `auth.passkey.remove`)

Step-up (MFA-PASSKEYS-2490, every user kind):
`POST   auth/step-up/challenge {action?}`   WebAuthn request options for the caller's own usable passkeys, bound to the user, this session
                                            and the action (60 s, single use); answered by `POST auth/step-up/verify {method: "passkey",
                                            challenge_id, assertion, action?}` (routers/second_factor.py)
`PUT    auth/passkeys/first {on}`           the user's own passkey-first mode (on: owner switch on, a usable passkey, a fresh sign-in)

`PUT    auth/passkeys/only {on}`             usr2-passkeys-only-mode: password sign-in refused for the caller (on: owner switch on, a usable
                                            passkey, a fresh sign-in; 409 `passkey_first_off` | `no_passkey` | `no_recovery_path`)

Administration:
`PUT    identity/local-users/{id}/passkey-only {on}`  identity.local.manage; the same mode for a user (off = the recovery); audited
`GET    identity/local-users/{id}/passkeys`           identity.directory.read
`DELETE identity/local-users/{id}/passkeys/{pk}`      identity.local.manage; an administrator who has a TOTP factor shows their own code
                                                      (CR-011 M1, routers/second_factor.require_step_up); every session of the user ends

`GET /.well-known/assetlinks.json` (registered in main.py, outside /api/v1): the Android app association for passkeys in the app's
WebView (CR-011 §2.3) - only while the feature is on and `security.local_passkey_android` names an app; 404 otherwise.
"""
from __future__ import annotations

import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, require
from ..remote_channel import is_remote
from ..services import factor_reset, notify_sources
from ..services import ha_user_auth as hua
from ..services import local_identity as li
from ..services import local_passkeys as lpk
from ..services import local_passkeys_store as store
from ..services import second_factor as sf
from ..services import step_up
from ..services import user_passkeys as upk
from .. import guarded_route
from ._common import rid as _rid
from .local_identity import _error, _public_guard, _success, _user_row
from ..wire import local_passkeys as W
from ..wire import wire
from ..wire.local_identity import LocalSignInSession

router = APIRouter()


def public_post(path: str, **kwargs: Any):
    """SECFIX2-295 / PUB-07: the guard before the body (routers/local_identity.public_post, smplwise/guarded_route.py)."""
    return guarded_route.post(router, _public_guard, path, **kwargs)

SELF_LIMITS: list[tuple[float, int]] = [(60.0, 20), (3600.0, 100)]
OPTIONS_LIMITS: list[tuple[float, int]] = [(60.0, 30), (3600.0, 300)]
SECOND_STEP_LIMITS: list[tuple[float, int]] = [(60.0, 20)]  # the TOTP second step's per-address limit (routers/local_identity)


class CredentialBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    credential: dict[str, Any]


# ---------------------------------------------------------------- public: the second step and passkey first

def _pending_id(request: Request) -> str | None:
    return request.cookies.get(li.PENDING_COOKIE_SECURE) or (None if settings_of(request).in_addon else request.cookies.get(li.PENDING_COOKIE_PLAIN))


def _ip_limit(request: Request, key: str, limits: list[tuple[float, int]]) -> JSONResponse | None:
    if not hua.LIMITER.hit(f"{key}:{hua.limit_ip(hua.client_ip(request))}", limits):
        return _error(request, 429, "rate_limited", li.RATE_LIMITED_HE, {"Retry-After": "60"}, retryable=True)
    return None


@public_post("/auth/local/sign-in/passkey/options", **wire(W.AssertionOptions))
async def second_step_options(request: Request) -> Response:
    refused = _ip_limit(request, "lpko", OPTIONS_LIMITS)
    if refused is not None:
        return refused
    out = await run_in_threadpool(lpk.second_factor_options, request.app.state.db, _pending_id(request))
    return JSONResponse(out)


@public_post("/auth/local/sign-in/passkey", **wire(LocalSignInSession))
async def second_step_passkey(body: CredentialBody, request: Request) -> Response:
    refused = _ip_limit(request, "lsf", SECOND_STEP_LIMITS)  # one budget with the TOTP code step
    if refused is not None:
        return refused
    r = await run_in_threadpool(lpk.second_factor_sign_in, request.app.state.db, settings_of(request), request, _pending_id(request), body.credential, _rid(request))
    return _success(request, r)


@public_post("/auth/local/passkey/options", **wire(W.AssertionOptions))
async def passwordless_options(request: Request) -> Response:
    refused = _ip_limit(request, "lpkp", OPTIONS_LIMITS)  # review F10: its own budget - never starves the second-step options
    if refused is not None:
        return refused
    addr = hua.limit_ip(hua.client_ip(request))  # review F1: a handful of live passwordless challenges per address bucket
    return JSONResponse(await run_in_threadpool(lpk.passwordless_options, request.app.state.db, addr))


@public_post("/auth/local/passkey", **wire(LocalSignInSession))
async def passwordless_sign_in(body: CredentialBody, request: Request) -> Response:
    import asyncio

    r = await run_in_threadpool(lpk.passwordless_sign_in, request.app.state.db, settings_of(request), request, body.credential, _rid(request))
    if r.status == "rate_limited":
        return _error(request, 429, "rate_limited", li.RATE_LIMITED_HE, {"Retry-After": str(r.retry_after)}, retryable=True)
    if r.sleep_s:
        await asyncio.sleep(r.sleep_s)  # the global storm tier's wait, on the event loop
    if r.status == "failed":
        return _error(request, 401, "passkey_invalid", lpk.INVALID_HE)
    response = _success(request, r)
    return response


# ---------------------------------------------------------------- self

NOT_LOCAL_HE = "הפעולה זמינה רק למשתמשי Arx."


def _self(request: Request, principal: Principal, conn: sqlite3.Connection) -> li.LocalSession:
    s = hua.session_of(request)
    if principal.source != "local" or not isinstance(s, li.LocalSession) or s.user_id != principal.user_id:
        raise ApiError(403, "not_local_identity", NOT_LOCAL_HE)
    if not li.enabled(conn):
        raise ApiError(409, "local_identity_off", li.OFF_HE)
    if not hua.LIMITER.hit(f"passkey:{principal.user_id}", SELF_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    return s


def _caller(request: Request, principal: Principal, conn: sqlite3.Connection) -> li.LocalSession | None:
    """MFA-PASSKEYS-2490: the caller's own passkeys. An Arx-only identity -> its local session (`_self`, the rules of before); any other
    user -> None while `security.passkeys_all_users` is on (services/user_passkeys.py), else the 403 `not_local_identity` of before."""
    if principal.source == "local":
        return _self(request, principal, conn)
    if not upk.all_users_enabled(conn):
        raise ApiError(403, "not_local_identity", NOT_LOCAL_HE)
    if not hua.LIMITER.hit(f"passkey:{principal.user_id}", SELF_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    return None


@router.get("/auth/passkeys", **wire(W.OwnPasskeys))
def own_passkeys(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    s = _caller(request, principal, conn)
    if s is None:  # MFA-PASSKEYS-2490: a user who is not an Arx-only identity
        return {**upk.own_summary(conn, request, principal), "user_kind": "user"}
    return {**lpk.summary(conn, s.user_id), "recent_auth": lpk.recent_auth(conn, s),
            "recent_auth_left_s": max(0, int(lpk.RECENT_AUTH_S - (time.time() - s.chain_started_at))), "totp": sf.is_enrolled(conn, s.user_id),
            "user_kind": "local"}


@router.post("/auth/passkeys/register/options", **wire(W.RegistrationOptions))
def register_options(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    s = _caller(request, principal, conn)
    if s is None:
        return upk.registration_options(conn, request, principal)
    return lpk.registration_options(conn, s)


class RegisterBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    credential: dict[str, Any]
    label: str | None = Field(default=None, max_length=lpk.LABEL_MAX)


@router.post("/auth/passkeys/register", status_code=201, **wire(W.PasskeyRegistered))
def register(body: RegisterBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    s = _caller(request, principal, conn)
    if s is None:  # MFA-PASSKEYS-2490: the other sign-ins ended by a first factor close on the background pass (revoke_user_sign_ins)
        return upk.register(conn, request, principal, body.credential, body.label, _rid(request))
    out = lpk.register(conn, settings_of(request), request, s, body.credential, body.label, _rid(request))
    if out["other_sessions_ended"]:
        li.close_sockets_from_thread()
    return out


class LabelBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str | None = Field(default=None, max_length=lpk.LABEL_MAX)


@router.patch("/auth/passkeys/{pk_id}", **wire(W.PasskeySummary))
def rename(pk_id: str, body: LabelBody, request: Request, principal: Principal = Depends(current_principal),
           conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    s = _caller(request, principal, conn)
    label = (body.label or "").strip() or None
    if label and any(ord(c) < 32 or ord(c) == 127 for c in label):
        raise ApiError(422, "validation", "שם מפתח הגישה: טקסט רגיל בלבד.")
    if len(pk_id) > 40 or store.rename_passkey(conn, label, pk_id, principal.user_id) != 1:
        raise ApiError(404, "passkey_not_found", lpk.NOT_FOUND_HE)
    upk.audit_renamed(conn, principal, pk_id, _rid(request))  # MFA-PASSKEYS-2490: the public id only, never the label
    return lpk.summary(conn, s.user_id) if s is not None else upk.summary(conn, principal.user_id)


class RemoveBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str | None = Field(default=None, max_length=16)


@router.delete("/auth/passkeys/{pk_id}", **wire(W.PasskeyRemoved))
def remove_own(pk_id: str, request: Request, body: RemoveBody | None = None, principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A fresh sign-in (< 5 min, with the factor), the current TOTP code or (MFA-PASSKEYS-2490) a fresh step-up proof: a stolen session
    alone cannot strip a factor. A user who is not an Arx-only identity: the code or a fresh step-up proof whenever the account has a
    factor (403 `step_up_required`, action `auth.passkey.remove`)."""
    s = _caller(request, principal, conn)
    if store.passkey_row(conn, pk_id[:40], principal.user_id) is None:
        raise ApiError(404, "passkey_not_found", lpk.NOT_FOUND_HE)
    code = (request.headers.get(hua.SECOND_FACTOR_HEADER) or (body.code if body else None) or "").strip()
    proof = upk.removal_proof(conn, request, principal, code, local_session=s)
    if s is None:
        out = upk.remove(conn, principal, pk_id, proof=proof, request_id=_rid(request))
        notify_sources.second_factor_changed(conn, principal.user_id, "removed:passkey")  # MFA-FACTOR-HARDEN-2520 N-6
        return {**out, **upk.summary(conn, principal.user_id)}
    out = lpk.remove(conn, s.user_id, pk_id, actor=principal, by="self", keep_chain=s.chain_id, request_id=_rid(request))
    notify_sources.second_factor_changed(conn, s.user_id, "removed:passkey")  # MFA-FACTOR-HARDEN-2520 N-6
    if not upk.has_factor(conn, s.user_id):
        step_up.forget_user(s.user_id)  # MFA-PASSKEYS-2490: no step-up proof outlives the last factor
    if out["sessions_ended"]:
        li.close_sockets_from_thread()
    return {**out, **lpk.summary(conn, s.user_id)}


class FirstBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    on: bool


@router.put("/auth/passkeys/first", **wire(W.PasskeySummary))
def own_first(body: FirstBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    s = _self(request, principal, conn)
    return lpk.set_first(conn, s, body.on, _rid(request))


class OnlyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    on: bool


@router.put("/auth/passkeys/only", **wire(W.PasskeySummary))
def own_only(body: OnlyBody, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """usr2-passkeys-only-mode: the user's own switch (on needs a working passkey, the owner switch and a fresh sign-in)."""
    s = _self(request, principal, conn)
    return lpk.set_only(conn, s.user_id, body.on, actor=principal, by="self", request_id=_rid(request), s=s)


# ---------------------------------------------------------------- step-up challenge (MFA-PASSKEYS-2490, every user kind)

CHALLENGE_LIMITS: list[tuple[float, int]] = [(300.0, 20), (3600.0, 60)]


class ChallengeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_.]{0,63}$")  # the change the proof is for (bound into the challenge)


@router.post("/auth/step-up/challenge", **wire(W.StepUpChallenge))
def step_up_challenge(request: Request, body: ChallengeBody | None = None, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A passkey step-up begins: WebAuthn request options for the caller's own usable passkeys, bound to the caller, this session and
    the action, 60 s, single use. Answered by `POST auth/step-up/verify {method: "passkey", challenge_id, assertion, action?}`.
    409 `step_up_no_session` / `step_up_no_method`; rate-limited per user."""
    if not hua.LIMITER.hit(f"stepupc:{principal.user_id}", CHALLENGE_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    return upk.challenge(conn, request, principal, body.action if body else None, _rid(request))


# ---------------------------------------------------------------- administration

@router.put("/identity/local-users/{user_id}/passkey-only", **wire(W.UserPasskeys))
def admin_only(user_id: str, body: OnlyBody, request: Request, principal: Principal = Depends(current_principal),
               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A system administrator switches the passkeys-only mode of a local user on (the user needs a working passkey) or off (the
    recovery: the password signs the user in again; sessions stay). Administrative targets: local channel only, like every secret
    minted for them. Audited on both the identity and the sign-in trail."""
    require(conn, principal, "identity.local.manage", INSTALLATION)
    row = _user_row(conn, user_id)
    if not li.enabled(conn):
        raise ApiError(409, "local_identity_off", li.OFF_HE)
    if li.holds_admin(conn, user_id) and is_remote(request):
        raise ApiError(404, "not_found", "Not found")
    if not hua.LIMITER.hit(f"factor:{principal.user_id}", SELF_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    was = lpk.user_only_on(conn, row["id"])
    out = lpk.set_only(conn, user_id, body.on, actor=principal, by="admin", request_id=_rid(request))
    if was != body.on:
        audit(conn, actor=principal, action="identity.local.user.passkey_only_enabled" if body.on else "identity.local.user.passkey_only_disabled",
              decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request), details={})
    return {"user_id": user_id, **out}


@router.get("/identity/local-users/{user_id}/passkeys", **wire(W.UserPasskeys))
def user_passkeys(user_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    _user_row(conn, user_id)
    return {"user_id": user_id, **lpk.summary(conn, user_id)}


@router.delete("/identity/local-users/{user_id}/passkeys/{pk_id}", **wire(W.UserPasskeyRemoved))
def admin_remove(user_id: str, pk_id: str, request: Request, body: RemoveBody | None = None, principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """A lost / suspected passkey (the CR-011 administrator reset, for one passkey): every local session of the user ends, a pending
    second step ends, the last passkey switches the user's passkey-first mode off. The password is never touched."""
    from ..services.step_up import reauth_error
    from .second_factor import require_step_up

    require(conn, principal, "identity.local.manage", INSTALLATION)
    _user_row(conn, user_id, include_deleted=True)
    # MFA-REVIEW-DOCS-2520 N-2: removing another user's passkey resets one of their authentication methods, so the owner's
    # `security.factor_reset_channel = local` (MFA-RESET-HARDENING-2510) applies here too - refused from outside, audited
    if factor_reset.channel_refuses(conn, request):
        audit(conn, actor=principal, action="identity.local.user.passkey_removed", decision="denied", resource_type="user", resource_id=user_id,
              reason="local_only", request_id=_rid(request), details={"channel": factor_reset.CHANNEL_LOCAL})
        raise ApiError(403, "factor_reset_local_only", factor_reset.LOCAL_ONLY_HE, details={"channel": factor_reset.CHANNEL_LOCAL})
    if factor_reset.reauth_refuses(request):  # MFA-FACTOR-HARDEN-2520 N-5: from outside, a sign-in within 5 minutes (as the reset)
        audit(conn, actor=principal, action="identity.local.user.passkey_removed", decision="denied", resource_type="user", resource_id=user_id,
              reason="reauth_required", request_id=_rid(request))
        raise reauth_error("auth.local.passkey.removed")
    if not hua.LIMITER.hit(f"factor:{principal.user_id}", SELF_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    if store.passkey_row(conn, pk_id[:40], user_id) is None:
        raise ApiError(404, "passkey_not_found", lpk.NOT_FOUND_HE)
    step_up = require_step_up(conn, request, principal, body.code if body else None, action="auth.local.passkey.removed", target=user_id)
    out = lpk.remove(conn, user_id, pk_id, actor=principal, by="admin", keep_chain=None, request_id=_rid(request))
    audit(conn, actor=principal, action="identity.local.user.passkey_removed", decision="allowed", resource_type="user", resource_id=user_id,
          request_id=_rid(request), details={"passkey": pk_id, "step_up": step_up, "sessions_ended": out["sessions_ended"]})
    notify_sources.second_factor_changed(conn, user_id, "removed:passkey")  # MFA-FACTOR-HARDEN-2520 N-6: the user is told
    if out["sessions_ended"]:
        li.close_sockets_from_thread()
    return {"user_id": user_id, **out, **lpk.summary(conn, user_id)}


# ---------------------------------------------------------------- Digital Asset Links (registered at the root in main.py)

def assetlinks(request: Request) -> Response:
    """Public by nature (Android fetches it without credentials): the package name and signing-key fingerprints of the app allowed
    to use this site's passkeys in its WebView. 404 while the feature is off or nothing is configured. Never under /api/v1."""
    with request.app.state.db.connection(mode="read", label="assetlinks") as conn:
        statements = lpk.assetlinks(conn)
    if statements is None:
        return JSONResponse(ApiError(404, "not_found", "Not found").payload(_rid(request) or ""), status_code=404)  # ADR019-FAMILY678-2520: the one envelope
    return JSONResponse(statements, headers={"Cache-Control": "public, max-age=300"})
