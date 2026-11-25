"""USR2 phase 1: Arx-only (local) identities - the sign-in, the first-login / reset links and the administration.

Public routes (remote channel only; 404 on the local channel; 403 `local_identity_off` while `security.local_identity` is off):
`POST auth/local/sign-in {username, password}`        200 + session cookie | 202 {second_factor: "required"} + pending cookie |
                                                      401 `sign_in_failed` (uniform) | 429 `rate_limited` (Retry-After) | 403 `csrf_refused`
`POST auth/local/sign-in/second-factor {code}`        the pending cookie + a TOTP code -> the session cookie
`POST auth/local/set-password {token, password}`      a first-login / reset link -> 200 {must_enrol} | 400 `password_policy` | 401 `link_invalid`
`POST auth/local/reset/request {username}`            phase 2: self-service reset - ALWAYS 202 (uniform); a code to the verified WhatsApp number
                                                      of an eligible user (services/local_reset.py) | 429
`POST auth/local/reset/confirm {username, code, password}`  200 {must_enrol} | 422 `code_invalid` (uniform) | 400 `password_policy` | 429
Login CSRF (section 8.2): the public routes require `Sec-Fetch-Site: same-origin` or an `Origin` equal to this origin.
SECFIX2-295 / PUB-07: the guard runs BEFORE the body is read or validated (`public_post`, smplwise/guarded_route.py): no 422 can tell a
local-channel caller that a public route exists.

Self:
`PUT   auth/local/password {current_password, new_password, code?}`   a local identity changes its own password (the session rotates,
                                                                     every other session of the user ends)
`PATCH auth/sessions/{id} {label}`                                  the user's own name for one of its local sign-ins

Administration (`identity.directory.read` to read, `identity.local.manage` - system_admin only - to change):
`GET    identity/local-users`               the list (never a hash, never a link)
`POST   identity/local-users`               create + exactly one binding + EITHER a password the administrator sets (`password`,
                                            `must_change` default true; no link) OR a first-login link returned ONCE. Every refusal
                                            is audited `identity.local.user.create_refused` with the refusal's code
                                            (CR-LOCAL-USER-CREATE-2438).
`PUT    identity/local-users/{id}/password` {password, must_change=true}: the administrator sets a user's password (same policy as the
                                            set-password page; the user's sessions, open links and reset codes end; an
                                            administrative target: local channel only). Audit `identity.local.password.set_by_admin`.
`GET    identity/local-users/export`        CSV (no secrets)
`GET    identity/local-users/{id}`
`PATCH  identity/local-users/{id}`          display_name, email, notes, active, reset_mode
`DELETE identity/local-users/{id}`          soft delete (sessions, links, device tokens and the binding end at once)
`PUT    identity/local-users/{id}/role`     replace the one binding (revoke + create in one transaction)
`POST   identity/local-users/{id}/link`     a new first-login / reset link (shown once)
`POST   identity/local-users/{id}/unlock`   clear the per-account delay
`POST   identity/local-users/{id}/sessions/revoke`
`PUT / DELETE identity/local-users/{id}/ha-link`  the manual "same person" link to an HA identity (owner answer Q7)

Owner answer Q3 (administrative targets = a local user whose role carries an administrative permission): creating one, issuing its
links and giving it an administrative role are LOCAL-CHANNEL ONLY (404 on the remote channel, like BLOCKED_ON_REMOTE); its links
are never sent by WhatsApp; self-service reset is refused for it. Owner answer Q5: `reset_mode` per user, `manager_only` (default)
| `self_service` (phase 2: the code flow above, refused at the moment of use for a user holding an administrative permission now).
Phase 2: `POST .../link {via: whatsapp}` sends a non-administrative target's link to the user's verified WhatsApp number (the answer
never carries the link); an administrative target's link stays local-channel only and is never sent by WhatsApp.
"""
from __future__ import annotations

import asyncio
import csv
import io
import re
import sqlite3
import time
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from .. import guarded_route
from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..db import bump_permission_revision, now_iso
from ..errors import ApiError, field_error
from ..i18n import localize_for
from ..rbac import INSTALLATION, Principal, authorize, is_system_admin, require, role_name, scope_name
from ..remote_channel import csrf_reason, is_remote
from ..services import ha_user_auth as hua
from ..services import local_identity as li
from ..services import local_identity_store as store
from ..services import local_passwords as lp
from ..services import local_reset as lr
from ..services import presence, revocation
from ..services import second_factor as sf
from ._common import rid as _rid
from ..wire import local_identity as W
from ..wire import wire

router = APIRouter()

NOT_FOUND_HE = "משתמש ה־Arx לא נמצא."
TAKEN_HE = "שם המשתמש תפוס (גם שמות של משתמשי תשתית המערכת שמורים)."
USERNAME_HE = "שם משתמש: 3-32 תווים באנגלית קטנה, ספרות, נקודה, קו תחתון או מקף, ומתחיל באות או ספרה."
CSRF_HE = "הבקשה נדחתה: היא לא הגיעה מדף של SmplWise Arx."
TRANSPORT_HE = "הכניסה מותרת רק בחיבור מאובטח (https)."
SELF_SERVICE_ADMIN_HE = ("איפוס עצמי אינו זמין למשתמש עם הרשאות ניהול: מי שמשתלט על מספר הטלפון היה משתלט על חשבון מנהל. "
                         "איפוס של משתמש כזה הוא קישור שמנהל מפיק מכניסה מקומית.")
WHATSAPP_ADMIN_HE = "קישור למשתמש עם הרשאות ניהול לא נשלח בוואטסאפ; הוא מוצג רק בכניסה מקומית."
SELF_ONLY_HE = "הפעולה זמינה רק למשתמשי Arx."
PW_LIMITS: list[tuple[float, int]] = [(60.0, 5), (3600.0, 30)]


# ---------------------------------------------------------------- shared checks

def _remote_only(request: Request) -> None:
    if not is_remote(request):
        raise ApiError(404, "not_found", "Not found")


def _public_guard(request: Request) -> None:
    """The public routes: remote channel, the feature on, https behind the tunnel, and the same-origin proof (login CSRF)."""
    _remote_only(request)
    settings = settings_of(request)
    if not li.enabled_db(request.app.state.db):
        raise ApiError(403, "local_identity_off", li.OFF_HE)
    proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    if settings.in_addon and proto and proto != "https":
        raise ApiError(403, "insecure_transport", TRANSPORT_HE)
    reason = csrf_reason(request.scope, list(request.scope.get("headers") or []))
    if reason is not None:
        raise ApiError(403, "csrf_refused", CSRF_HE, details={"reason": reason})


def public_post(path: str, **kwargs: Any):
    """SECFIX2-295 / PUB-07: a PUBLIC route runs `_public_guard` BEFORE FastAPI reads or validates its body (smplwise/guarded_route.py),
    so on the local channel every body - well-formed or not - is the same 404, and on the remote channel the switch / transport / CSRF
    refusals come before any 422. The endpoint itself does not call the guard again."""
    return guarded_route.post(router, _public_guard, path, **kwargs)


def _error(request: Request, status: int, code: str, message: str, headers: dict[str, str] | None = None, retryable: bool = False) -> JSONResponse:
    """A refusal answered directly (it carries a header, or comes before the route raises): the one envelope, built by `ApiError.payload()`
    (ADR019-FAMILY678-2520; the same five keys it built by hand)."""
    return JSONResponse(status_code=status, headers=headers or {}, content=ApiError(status, code, message, retryable=retryable).payload(_rid(request) or ""))


def _session_cookie(response: Response, request: Request, value: str, s: li.LocalSession) -> None:
    settings = settings_of(request)
    name = hua.cookie_name(settings, request)
    max_age = int(s.expires_at - time.time()) if s.persistent else None
    response.headers.append("set-cookie", li.cookie_header(name, value, settings.remote_path + "/", secure=name == hua.COOKIE_SECURE, max_age=max_age))


def _pending_path(request: Request) -> str:
    return settings_of(request).remote_path + "/api/v1/auth/local/sign-in"


def _pending_cookie_name(request: Request) -> str:
    return li.PENDING_COOKIE_SECURE if hua.cookie_name(settings_of(request), request) == hua.COOKIE_SECURE else li.PENDING_COOKIE_PLAIN


def _clear_pending(response: Response, request: Request) -> None:
    name = _pending_cookie_name(request)
    response.headers.append("set-cookie", li.cookie_header(name, "", _pending_path(request), secure=name == li.PENDING_COOKIE_SECURE, max_age=0))


# ---------------------------------------------------------------- the sign-in (public)

OVERLOAD_RETRY_S = 5


async def _overloaded(request: Request) -> JSONResponse:
    """USR2-FIX F3: the hashing waiting room is full - the uniform 429 for every username, without hashing; one throttled audit
    row (`auth.local.storm`, reason `admission`) per minute, written off the event loop."""
    write, suppressed = hua.REFUSAL_AUDITS.admit("local_admission|installation")
    if write:
        def _row() -> None:
            li._audit(request.app.state.db, actor=None, action="auth.local.storm", decision="denied", reason="admission", resource_id="installation",
                      details={"in_flight": lp.ADMISSION.in_flight, **({"suppressed_since_last": suppressed} if suppressed else {})}, request_id=_rid(request))
            li._notify(request.app.state.db, "security.local_storm", "installation", reason="admission")  # phase 2: to the managers (folds for an hour)

        try:
            await run_in_threadpool(_row)
        except Exception:  # noqa: BLE001 - an audit row never changes the answer
            pass
    return _error(request, 429, "rate_limited", li.RATE_LIMITED_HE, {"Retry-After": str(OVERLOAD_RETRY_S)}, retryable=True)

class SignInBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=1024)


def _success(request: Request, r: li.SignInResult) -> JSONResponse:
    assert r.session is not None and r.cookie is not None
    response = JSONResponse({"user": r.user, "second_factor": r.second_factor, "must_change_password": r.must_change,
                             "session_expires_in": max(1, int(r.session.expires_at - time.time()))})
    _session_cookie(response, request, r.cookie, r.session)
    _clear_pending(response, request)
    return response


@public_post("/auth/local/sign-in", **wire(W.LocalSignInSession | W.LocalSignInPending))
async def local_sign_in(body: SignInBody, request: Request) -> Response:
    admitted, r = await lp.run_admitted(li.sign_in, request.app.state.db, settings_of(request), request, body.username, body.password, _rid(request))
    if not admitted or r is None:
        return await _overloaded(request)
    if r.status == "rate_limited":
        return _error(request, 429, "rate_limited", li.RATE_LIMITED_HE, {"Retry-After": str(r.retry_after)}, retryable=True)
    if r.sleep_s:
        await asyncio.sleep(r.sleep_s)  # the delay of a tier, applied before the answer - on the event loop, never holding a worker thread
    if r.status == "failed":
        return _error(request, 401, "sign_in_failed", li.SIGN_IN_FAILED_HE)
    if r.status == "pending":
        # USR2 phase 4: `methods` appears only when a passkey can answer the step (a TOTP-only user's answer is unchanged)
        response = JSONResponse({"second_factor": "required", **({"methods": list(r.methods)} if "passkey" in r.methods else {})}, status_code=202)
        name = _pending_cookie_name(request)
        response.headers.append("set-cookie", li.cookie_header(name, r.pending_id or "", _pending_path(request), secure=name == li.PENDING_COOKIE_SECURE,
                                                               max_age=int(li.PENDING_TTL_S)))
        return response
    return _success(request, r)


class CodeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # the authenticator code, or (MFA-DEVICEKEY-2490, owner Q51) the phone key's answer `dk1:<challenge_id>:<signature>`
    code: str = Field(min_length=1, max_length=260)


@public_post("/auth/local/sign-in/second-factor", **wire(W.LocalSignInSession))
async def local_sign_in_second_factor(body: CodeBody, request: Request) -> Response:
    pid = request.cookies.get(li.PENDING_COOKIE_SECURE) or (None if settings_of(request).in_addon else request.cookies.get(li.PENDING_COOKIE_PLAIN))
    if not hua.LIMITER.hit(f"lsf:{hua.limit_ip(hua.client_ip(request))}", [(60.0, 20)]):
        return _error(request, 429, "rate_limited", li.RATE_LIMITED_HE, {"Retry-After": "60"}, retryable=True)
    r = await run_in_threadpool(li.second_factor_step, request.app.state.db, settings_of(request), request, pid, body.code, _rid(request))
    return _success(request, r)


class SetPasswordBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=1024)


@public_post("/auth/local/set-password", **wire(W.LocalMustEnrol))
async def local_set_password(body: SetPasswordBody, request: Request) -> dict[str, Any]:
    if not hua.LIMITER.hit(f"lsetpw:{hua.limit_ip(hua.client_ip(request))}", li.SET_PASSWORD_LIMITS):
        raise ApiError(429, "rate_limited", li.RATE_LIMITED_HE, retryable=True)
    admitted, out = await lp.run_admitted(li.use_link, request.app.state.db, settings_of(request), request, body.token, body.password, _rid(request))
    if not admitted or out is None:
        await _overloaded(request)  # the audit row; the answer is the route's usual 429 (same as its per-address limit)
        raise ApiError(429, "rate_limited", li.RATE_LIMITED_HE, retryable=True)
    return out


# ---------------------------------------------------------------- self-service reset by a WhatsApp code (public; USR2 phase 2)

class ResetRequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=64)


@public_post("/auth/local/reset/request", status_code=202, **wire(W.LocalResetRequested))
async def local_reset_request(body: ResetRequestBody, request: Request) -> dict[str, Any]:
    """Always the same 202 - an unknown name, a user without self-service, an administrator, no verified number, a cap: alike. The
    message leaves later from the sender thread, so the answer never waits for WhatsApp (local_reset module docstring)."""
    if not hua.LIMITER.hit(f"lreset:{hua.limit_ip(hua.client_ip(request))}", lr.REQUEST_LIMITS):
        raise ApiError(429, "rate_limited", li.RATE_LIMITED_HE, retryable=True)
    try:
        await run_in_threadpool(lr.request_code, request.app.state.db, request, body.username, _rid(request))
    except Exception:  # noqa: BLE001 - whatever happened inside, the caller learns nothing from the answer
        lr.log.warning("local reset request failed")
    return {"accepted": True, "user_message": lr.REQUEST_ACCEPTED_HE, "expires_in_s": int(lr.CODE_TTL_S), "resend_after_s": int(lr.COOLDOWN_S)}


class ResetConfirmBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=64)
    code: str = Field(min_length=1, max_length=16)
    password: str = Field(min_length=1, max_length=1024)


@public_post("/auth/local/reset/confirm", **wire(W.LocalMustEnrol))
async def local_reset_confirm(body: ResetConfirmBody, request: Request) -> dict[str, Any]:
    """200 {must_enrol} | 422 `code_invalid` (uniform) | 400 `password_policy` (only after a correct code; the code stays live) |
    429. No session is created; every session and open link of the user ends."""
    if not hua.LIMITER.hit(f"lresetc:{hua.limit_ip(hua.client_ip(request))}", lr.CONFIRM_LIMITS):
        raise ApiError(429, "rate_limited", li.RATE_LIMITED_HE, retryable=True)
    admitted, out = await lp.run_admitted(lr.confirm, request.app.state.db, settings_of(request), request, body.username, body.code, body.password, _rid(request))
    if not admitted or out is None:
        await _overloaded(request)
        raise ApiError(429, "rate_limited", li.RATE_LIMITED_HE, retryable=True)
    return out


# ---------------------------------------------------------------- self

class PasswordChangeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=1, max_length=1024)
    code: str | None = Field(default=None, max_length=16)


@router.put("/auth/local/password", **wire(W.LocalPasswordChanged))
def change_own_password(body: PasswordChangeBody, request: Request, principal: Principal = Depends(current_principal),
                        conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    s = hua.session_of(request)
    if principal.source != "local" or not isinstance(s, li.LocalSession):
        raise ApiError(403, "not_local_identity", SELF_ONLY_HE)
    if not hua.LIMITER.hit(f"lpw:{principal.user_id}", PW_LIMITS):
        raise ApiError(429, "rate_limited", li.RATE_LIMITED_HE, retryable=True)
    out = li.change_password(conn, settings_of(request), request, s, body.current_password, body.new_password, body.code, _rid(request))
    if out["other_sessions_ended"]:
        li.close_sockets_from_thread()
    return out


class LabelBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str | None = Field(default=None, max_length=40)


@router.patch("/auth/sessions/{session_id}", **wire(W.LocalSessionLabel))
def label_session(session_id: str, body: LabelBody, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The user's own device name for one of its local sign-ins (HA sign-ins live in memory only and are not labelled in phase 1)."""
    found = li.chain_owner(conn, session_id) if re.fullmatch(r"[0-9a-f]{20}", session_id) and li.enabled(conn) else None
    if found is None or found[1] != principal.user_id:
        raise ApiError(404, "session_not_found", "הכניסה הזו כבר לא פעילה.")
    label = (body.label or "").strip() or None
    if label and any(ord(c) < 32 for c in label):
        raise ApiError(422, "validation", "שם המכשיר: טקסט רגיל בלבד.")
    store.label_session_chain(conn, found[0], label)
    return {"id": session_id, "label": label}


# ---------------------------------------------------------------- administration

SCOPE_PATTERN = "^(installation|site|building|floor|camera|access_control_station)$"


class LocalUserCreate(BaseModel):
    """CR-LOCAL-USER-CREATE-2438: the username and the display name are length-checked by the handler (USERNAME_RE, 60 characters), not
    here - a refusal there carries the product's own sentence and is audited; a model-level 422 is neither."""
    model_config = ConfigDict(extra="forbid")
    username: str = Field(max_length=200)
    display_name: str = Field(max_length=200)
    role_id: str = Field(min_length=1, max_length=60)
    scope_type: str = Field(default="installation", pattern=SCOPE_PATTERN)
    scope_id: str = Field(default="*", min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=254)
    notes: str | None = Field(default=None, max_length=200)
    reset_mode: str = Field(default="manager_only", pattern="^(manager_only|self_service)$")
    # CR-LOCAL-USER-CREATE-2438 (owner 18.11): the administrator may set the password at creation (then no first-login link is minted).
    # `must_change` (default on): the user must choose their own password at the first sign-in.
    password: str | None = Field(default=None, min_length=1, max_length=1024)
    must_change: bool = True


class PasswordSetBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=1024)
    must_change: bool = True


class LocalUserPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=1, max_length=60)
    email: str | None = Field(default=None, max_length=254)
    notes: str | None = Field(default=None, max_length=200)
    active: bool | None = None
    reset_mode: str | None = Field(default=None, pattern="^(manager_only|self_service)$")
    passkey_first: bool | None = None  # USR2 phase 4: an administrator may only switch it OFF (on is the user's own choice)


class RoleBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role_id: str = Field(min_length=1, max_length=60)
    scope_type: str = Field(default="installation", pattern=SCOPE_PATTERN)
    scope_id: str = Field(default="*", min_length=1, max_length=200)


class LinkBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purpose: str = Field(default="reset", pattern="^(first_login|reset)$")
    via: str = Field(default="shown", pattern="^(shown|whatsapp)$")
    temporary: bool = False


class HaLinkBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ha_user_id: str = Field(min_length=1, max_length=64)


def _manage(conn: sqlite3.Connection, principal: Principal) -> None:
    require(conn, principal, "identity.local.manage", INSTALLATION)


def _feature_on(conn: sqlite3.Connection) -> None:
    if not li.enabled(conn):
        raise ApiError(409, "local_identity_off", li.OFF_HE)


def _user_row(conn: sqlite3.Connection, user_id: str, *, include_deleted: bool = False) -> sqlite3.Row:
    if not li.is_local_id(user_id) or len(user_id) > 40:
        raise ApiError(404, "user_unknown", NOT_FOUND_HE)
    row = store.local_user(conn, user_id)
    if row is None or (row["deleted_at"] and not include_deleted):
        raise ApiError(404, "user_unknown", NOT_FOUND_HE)
    return row


def _binding(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return store.role_binding(conn, user_id, now_iso())  # EMROLE-295: the temporary emergency_open grant is not the person's role


def _status(row: sqlite3.Row) -> str:
    if row["deleted_at"]:
        return "deleted"
    if not row["active"]:
        return "disabled"
    if not row["has_password"]:
        return "pending_first_login"
    if row["delay_until"] and float(row["delay_until"]) > time.time():
        return "delayed"
    return "active"


def _user_dict(conn: sqlite3.Connection, row: sqlite3.Row, live: dict[str, int] | None = None) -> dict[str, Any]:
    b = _binding(conn, row["id"])
    link = store.ha_link(conn, row["id"])
    if live is None:
        live = {row["id"]: len(li.chains(conn, row["id"]))}
    number = lr.verified_number(conn, row["id"])  # USR2 phase 2: the self-service reset / WhatsApp link needs it (masked: last two digits)
    admin = li.holds_admin(conn, row["id"])
    from ..services import local_passkeys as lpk

    passkeys = lpk.rows(conn, row["id"])  # USR2 phase 4: how many (never a credential id or a key); the list is its own route
    return {
        "passkeys": len(passkeys), "passkey_first": lpk.user_first_on(conn, row["id"]), "passkey_only": lpk.user_only_on(conn, row["id"]),
        "id": row["id"], "username": row["username"], "display_name": row["display_name"], "email": row["email"], "notes": row["notes"],
        "status": _status(row), "active": bool(row["active"]), "created_at": row["first_seen_at"], "created_by": row["created_by"],
        "last_sign_in_at": row["last_sign_in_at"], "last_sign_in_from": row["last_sign_in_from"],
        "role_id": b["role_id"] if b else None, "role_name": role_name(conn, b["role_id"]) if b else None,
        "scope_type": b["scope_type"] if b else None, "scope_id": b["scope_id"] if b else None,
        "scope_name": scope_name(conn, b["scope_type"], b["scope_id"]) if b else None, "binding_id": b["id"] if b else None,
        "admin": admin, "second_factor": sf.is_enrolled(conn, row["id"]), "reset_mode": row["reset_mode"],
        "must_change_password": bool(row["must_change"]), "sessions": live.get(row["id"], 0), "ha_user_id": link["ha_user_id"] if link else None,
        "whatsapp": {"verified": number is not None, "masked": f"····{number.digits[-2:]}" if number is not None else None},
        # why a self-service reset would be refused right now (None = it would work): the UI shows the reason next to the switch
        "self_service_blocked": None if row["reset_mode"] != "self_service" else ("admin_target" if admin else None if number is not None else "no_verified_number"),
    }


def _admin_target_local_only(request: Request, admin: bool) -> None:
    """Owner answer Q3: everything that mints a secret for (or creates) an administrative target is local-channel only; the
    refusal looks like a route that does not exist on the remote channel (BLOCKED_ON_REMOTE style)."""
    if admin and is_remote(request):
        raise ApiError(404, "not_found", "Not found")


def _link_answer(request: Request, token: str, expires: float, purpose: str) -> dict[str, Any]:
    settings = settings_of(request)
    path = li.link_path(settings, token)
    out: dict[str, Any] = {"purpose": purpose, "path": path, "expires_at": li.iso(expires)}
    if is_remote(request):
        host = request.headers.get("host") or ""
        out["url"] = f"https://{host}{path}" if host else None
    return out


@router.get("/identity/local-users", **wire(W.LocalUserList))
def list_local_users(request: Request, include_deleted: bool = Query(False), principal: Principal = Depends(current_principal_ro),
                     conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    rows = store.local_users(conn, include_deleted)
    live: dict[str, int] = {}
    for c in li.chains(conn, None):
        live[c["user_id"]] = live.get(c["user_id"], 0) + 1
    return {"enabled": li.enabled(conn), "can_manage": authorize(conn, principal, "identity.local.manage", INSTALLATION).allowed,
            "channel": "remote" if is_remote(request) else "local", "users": localize_for(conn, principal, [_user_dict(conn, r, live) for r in rows]),  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language
            # USR2 phase 2: can a code / a link leave by WhatsApp at all (an account mapped and connected), and where links point
            "whatsapp_ready": lr.channel_ready(conn), "public_url": lr.public_origin(conn, request),
            # USR2 phase 4: the owner switch of passkey-only sign-in (the tab shows it next to the address passkeys depend on)
            "passkey_first_allowed": _passkey_first_allowed(conn),
            # CR-LOCAL-USER-CREATE-2438: the shortest password the policy takes (`security.local_password_min`), for the form's hint
            "password_min": li.password_min(conn),
            # CR-LOCAL-ID-SWITCH-2442: may THIS person turn the feature on / off (PATCH /settings `security.local_identity` asks the same
            # question and is the authority; this only tells the tab whether to offer the switch)
            "can_switch": is_system_admin(conn, principal.user_id)}


def _passkey_first_allowed(conn: sqlite3.Connection) -> bool:
    from ..services import local_passkeys

    return local_passkeys.first_enabled(conn)


def _validate_email(email: str | None) -> str | None:
    email = (email or "").strip() or None
    if email and not li.EMAIL_RE.match(email):
        raise field_error("כתובת הדוא״ל אינה תקינה.", ["email"], legacy={"field": "email"})
    return email


def _clean_text(value: str | None, field: str) -> str | None:
    value = (value or "").strip() or None
    if value and any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise field_error("טקסט רגיל בלבד.", [field], legacy={"field": field})
    return value


def _username_taken(conn: sqlite3.Connection, key: str) -> bool:
    if store.username_key_in_users(conn, key):
        return True
    return any(li.username_key(r[0]) == key for r in store.directory_usernames(conn))


def _check_role(conn: sqlite3.Connection, principal: Principal, role_id: str, scope: tuple[str, str]) -> None:
    from .access import _scope_exists, check_delegation

    reason = li.role_refusal(conn, role_id)
    if reason == "role_unknown":
        raise ApiError(422, "role_unknown", "תפקיד לא מוכר.")
    if reason:
        audit(conn, actor=principal, action="identity.local.user.role_refused", decision="denied", resource_type="role", resource_id=role_id, reason=reason)
        raise ApiError(422, "role_not_allowed_for_local_user", "התפקיד הזה אינו ניתן למשתמש Arx (מנהל מערכת והרשאות מערכת שמורים למשתמשי תשתית המערכת).",
                       details={"role_id": role_id, "reason": reason})
    if not _scope_exists(conn, *scope):
        raise ApiError(422, "scope_unknown", "ההיקף (אתר / מבנה / קומה / מצלמה) לא נמצא.")
    check_delegation(conn, principal, role_id, scope, "user", None, op="bind", effect="allow")


def _bind(conn: sqlite3.Connection, principal: Principal, request: Request, user_id: str, role_id: str, scope: tuple[str, str]) -> str:
    from .access import BindingBody, insert_binding, validate_binding

    body = BindingBody(subject_kind="user", subject_id=user_id, role_id=role_id, scope_type=scope[0], scope_id=scope[1], effect="allow")
    validate_binding(conn, principal, body, request)
    bid, _rev = insert_binding(conn, principal, request, body, extra_audit={"identity": "local"})
    return bid


DISPLAY_LONG_HE = "שם התצוגה ארוך מדי (עד 60 תווים)."


def _checked_password(conn: sqlite3.Connection, request: Request, password: str, username: str, display_name: str) -> tuple[str, int]:
    """The set-password page's policy (`security.local_password_min`, common / contextual / repeated) and the hash of
    `local_passwords`. 400 `password_policy` with the reason; the password itself is never logged, audited or answered."""
    reason = lp.check_policy(password, min_length=li.password_min(conn), context=li._context_words(conn, {"username": username, "display_name": display_name}),
                             data_dir=settings_of(request).data_dir)
    if reason is not None:
        raise ApiError(400, "password_policy", li.POLICY_HE.get(reason, li.POLICY_HE["too_short"]), details={"reason": reason, "min_length": li.password_min(conn)})
    return lp.hash_password(password)


def _create_refused(conn: sqlite3.Connection, principal: Principal, request: Request, exc: ApiError, reason: str | None = None) -> None:
    """CR-LOCAL-USER-CREATE-2438: no refusal of the create route is silent. The row carries the refusal's code, the field it names and
    the policy reason - never what was typed (a password typed into the wrong field must not be kept)."""
    details: dict[str, Any] = {"status": exc.status, "channel": "remote" if is_remote(request) else "local"}
    if exc.details.get("field"):
        details["field"] = exc.details["field"]
    if exc.code == "password_policy":
        details["policy"] = exc.details.get("reason")
    audit(conn, actor=principal, action="identity.local.user.create_refused", decision="denied", resource_type="installation", resource_id="local_users",
          reason=reason or exc.code, request_id=_rid(request), details=details)


@router.post("/identity/local-users", status_code=201, **wire(W.LocalUserCreated))
def create_local_user(body: LocalUserCreate, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)  # a refusal here is audited by rbac.require (`identity.local.manage`, denied)
    try:
        return _create_local_user(body, request, principal, conn)
    except ApiError as exc:
        if not getattr(exc, "create_refusal_audited", False):
            _create_refused(conn, principal, request, exc)
        raise


def _create_local_user(body: LocalUserCreate, request: Request, principal: Principal, conn: sqlite3.Connection) -> dict[str, Any]:
    _feature_on(conn)
    key = li.username_key(body.username)
    if not li.USERNAME_RE.match(key):
        raise field_error(USERNAME_HE, ["username"], legacy={"field": "username"})
    display = _clean_text(body.display_name, "display_name")
    if not display:
        raise field_error("שם התצוגה חסר.", ["display_name"], legacy={"field": "display_name"})
    if len(display) > 60:
        raise field_error(DISPLAY_LONG_HE, ["display_name"], legacy={"field": "display_name"})
    email = _validate_email(body.email)
    notes = _clean_text(body.notes, "notes")
    scope = (body.scope_type, body.scope_id)
    _check_role(conn, principal, body.role_id, scope)
    admin = li.role_is_admin(conn, body.role_id)
    try:
        _admin_target_local_only(request, admin)
    except ApiError as exc:
        _create_refused(conn, principal, request, exc, "admin_target_remote")
        exc.create_refusal_audited = True  # type: ignore[attr-defined]
        raise
    if admin and body.reset_mode == "self_service":
        raise ApiError(422, "self_service_not_for_admins", SELF_SERVICE_ADMIN_HE)
    if _username_taken(conn, key):
        raise ApiError(409, "username_taken", TAKEN_HE)
    channel = "remote" if is_remote(request) else "local"
    hashed = _checked_password(conn, request, body.password, key, display) if body.password is not None else None
    must_change = bool(body.must_change) if hashed is not None else False
    uid = li.new_local_id()
    now = now_iso()
    token: str | None = None
    expires = 0.0
    store.savepoint(conn, "usr2_create")
    try:
        store.insert_local_user(conn, uid, key, display, now, email, principal.user_id, notes)
        if hashed is not None:
            store.insert_credentials_with_password(conn, uid, body.reset_mode, now, hashed[0], hashed[1], 1 if must_change else 0)
        else:
            store.insert_credentials(conn, uid, body.reset_mode, now)
        bid = _bind(conn, principal, request, uid, body.role_id, scope)
        if hashed is None:
            token, expires = li.issue_link(conn, user_id=uid, purpose="first_login", via="shown", channel=channel, actor=principal)
    except BaseException:
        store.rollback_savepoint(conn, "usr2_create")
        raise
    store.release_savepoint(conn, "usr2_create")
    audit(conn, actor=principal, action="identity.local.user.created", decision="allowed", resource_type="user", resource_id=uid, request_id=_rid(request),
          details={"role_id": body.role_id, "scope": f"{scope[0]}:{scope[1]}", "binding_id": bid, "admin": admin, "reset_mode": body.reset_mode,
                   "password_set": hashed is not None, **({"must_change": must_change} if hashed is not None else {})})
    if hashed is not None:
        audit(conn, actor=principal, action="identity.local.password.set_by_admin", decision="allowed", resource_type="user", resource_id=uid,
              request_id=_rid(request), details={"at": "create", "must_change": must_change, "channel": channel, "admin_target": admin})
    else:
        audit(conn, actor=principal, action="auth.local.link.issued", decision="allowed", resource_type="user", resource_id=uid, request_id=_rid(request),
              details={"purpose": "first_login", "via": "shown", "channel": channel, "temporary": False})
    revocation.changed([uid])
    return {"user": localize_for(conn, principal, _user_dict(conn, _user_row(conn, uid))), "password_set": hashed is not None,  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language
            "link": _link_answer(request, token, expires, "first_login") if token is not None else None}


@router.put("/identity/local-users/{user_id}/password", **wire(W.LocalUserPasswordSet))
def set_local_password(user_id: str, body: PasswordSetBody, request: Request, principal: Principal = Depends(current_principal),
                       conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """CR-LOCAL-USER-CREATE-2438 (owner 18.11): the administrator sets the password of an existing Arx user. Like a link that was
    used: the user's sessions, open links, reset codes and phone credentials end, the failure counters clear. `must_change` (default
    on) sends the user to choose their own password at the next sign-in. An administrative target: local channel only (owner
    answer Q3 - the same rule as its links)."""
    _manage(conn, principal)
    _feature_on(conn)
    row = _user_row(conn, user_id)
    b = _binding(conn, user_id)
    admin = li.holds_admin(conn, user_id) or bool(b and li.role_is_admin(conn, b["role_id"]))
    channel = "remote" if is_remote(request) else "local"

    def refused(reason: str, **details: Any) -> None:
        audit(conn, actor=principal, action="identity.local.password.set_by_admin", decision="denied", resource_type="user", resource_id=user_id,
              reason=reason, request_id=_rid(request), details={"at": "existing", "channel": channel, "admin_target": admin, **details})

    if admin and is_remote(request):
        refused("admin_target_remote")
        _admin_target_local_only(request, admin)
    if not row["active"]:
        refused("user_disabled")
        raise ApiError(409, "user_disabled", "המשתמש מושבת. הפעל אותו לפני קביעת סיסמה.")
    try:
        phc, version = _checked_password(conn, request, body.password, row["username"], row["display_name"])
    except ApiError as exc:
        refused(exc.code, policy=exc.details.get("reason"))
        raise
    now = now_iso()
    store.set_password_by_admin(conn, user_id, phc, version, 1 if body.must_change else 0, now)
    li.TIERS.acct_clear_name(row["username"])
    links = li.invalidate_links(conn, user_id)
    ended = li.revoke_user_sessions(conn, user_id, "password_changed")
    li.drop_pending_of(user_id)
    lr.kill_codes(conn, user_id)
    li._end_phone_credentials(conn, user_id, "password_changed", actor=principal, request_id=_rid(request))
    audit(conn, actor=principal, action="identity.local.password.set_by_admin", decision="allowed", resource_type="user", resource_id=user_id,
          request_id=_rid(request), details={"at": "existing", "must_change": bool(body.must_change), "channel": channel, "admin_target": admin,
                                             "sessions_ended": ended, "links_invalidated": links})
    revocation.changed([user_id])
    if ended:
        li.close_sockets_from_thread()
    return localize_for(conn, principal, {**_user_dict(conn, _user_row(conn, user_id)), "sessions_ended": ended, "links_invalidated": links})  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.get("/identity/local-users/export")
def export_local_users(request: Request, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    _manage(conn, principal)
    rows = store.live_local_users(conn)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "username", "display_name", "role", "scope", "status", "created_at", "last_sign_in_at", "last_sign_in_from", "second_factor"])

    def cell(v: Any) -> str:
        text = "" if v is None else str(v)
        return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text  # no spreadsheet formula from a stored name

    for r in rows:
        d = _user_dict(conn, r, {})
        w.writerow([cell(x) for x in (d["id"], d["username"], d["display_name"], d["role_name"] or "", d["scope_name"] or "", d["status"], d["created_at"],
                                      d["last_sign_in_at"] or "", d["last_sign_in_from"] or "", "on" if d["second_factor"] else "off")])
    audit(conn, actor=principal, action="identity.local.user.exported", decision="allowed", resource_type="installation", resource_id="local_users",
          request_id=_rid(request), details={"rows": len(rows)})
    return Response(content="﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="arx-local-users.csv"', "Cache-Control": "no-store"})


@router.get("/identity/local-users/{user_id}", **wire(W.LocalUser))
def get_local_user(user_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    return localize_for(conn, principal, _user_dict(conn, _user_row(conn, user_id)))  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


def _end_access(conn: sqlite3.Connection, user_id: str, reason: str) -> dict[str, int]:
    ended = li.revoke_user_sessions(conn, user_id, reason)
    links = li.invalidate_links(conn, user_id)
    li.drop_pending_of(user_id)
    lr.kill_codes(conn, user_id)  # a live self-service code ends too (the confirm would refuse it anyway; a trigger deletes it as well)
    tokens = presence.revoke_tokens(conn, user_id)
    presence.end_on_sign_out(conn, user_id, reason, everywhere=True)  # XSECFIX-297 (review M2): the push registrations end too
    revocation.mark([user_id])
    from ..services.tickets import out_documents  # TEMPLINK-2320 (owner 4A): the report links minted for him die at once

    out_documents.revoke_for_inactive_users_safe(conn)
    return {"sessions_ended": ended, "links_invalidated": links, "device_tokens_revoked": tokens}


@router.patch("/identity/local-users/{user_id}", **wire(W.LocalUserPatched))
def patch_local_user(user_id: str, body: LocalUserPatch, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    row = _user_row(conn, user_id)
    fields = body.model_dump(exclude_unset=True)
    changed: dict[str, Any] = {}
    effects: dict[str, int] = {}
    if "display_name" in fields:
        name = _clean_text(fields["display_name"], "display_name")
        if not name:
            raise field_error("שם התצוגה חסר.", ["display_name"], legacy={"field": "display_name"})
        store.set_display_name(conn, user_id, name)
        changed["display_name"] = True
    if "email" in fields:
        store.set_email(conn, user_id, _validate_email(fields["email"]))
        changed["email"] = True
    if "notes" in fields:
        store.set_notes(conn, user_id, _clean_text(fields["notes"], "notes"))
        changed["notes"] = True
    if fields.get("reset_mode") is not None and fields["reset_mode"] != row["reset_mode"]:
        if fields["reset_mode"] == "self_service" and li.holds_admin(conn, user_id):
            audit(conn, actor=principal, action="identity.local.user.updated", decision="denied", resource_type="user", resource_id=user_id,
                  reason="self_service_not_for_admins", request_id=_rid(request))
            raise ApiError(422, "self_service_not_for_admins", SELF_SERVICE_ADMIN_HE)
        store.set_reset_mode(conn, user_id, fields["reset_mode"], now_iso())
        changed["reset_mode"] = fields["reset_mode"]
        if fields["reset_mode"] == "manager_only":
            lr.kill_codes(conn, user_id)
    if fields.get("passkey_first") is not None:
        from ..services import local_passkeys as lpk

        if fields["passkey_first"]:
            raise ApiError(422, "passkey_first_self_only", "רק המשתמש עצמו מפעיל כניסה במפתח גישה (עם מפתח הגישה שלו); מנהל יכול רק לכבות אותה.")
        if lpk.user_only_on(conn, user_id):
            raise ApiError(409, "passkey_only_on", lpk.ONLY_ON_HE)  # usr2-passkeys-only-mode needs passkey-first: switch the mode off first
        if lpk.user_first_on(conn, user_id):
            li.lease_hook("second_factor_changed", user_ids=[user_id])  # CR-WISKEY-LEASE T6: the sign-in factor mode changed
            store.passkey_first_off(conn, user_id, now_iso())
            audit(conn, actor=principal, action="auth.local.passkey.first_disabled", decision="allowed", resource_type="user", resource_id=user_id,
                  reason="admin", request_id=_rid(request))
            changed["passkey_first"] = False
    suggest: str | None = None
    if fields.get("active") is not None and bool(fields["active"]) != bool(row["active"]):
        if not fields["active"]:
            li.lease_hook("actor_disabled", user_ids=[user_id])  # CR-WISKEY-LEASE T2 (then T4 / T3 / strict T1 below)
            store.disable_user(conn, user_id, now_iso(), principal.user_id)
            effects = _end_access(conn, user_id, "user_disabled")
            bump_permission_revision(conn)
            action = "identity.local.user.disabled"
        else:
            store.enable_user(conn, user_id)
            revocation.changed([user_id])
            action = "identity.local.user.enabled"
        link = store.ha_link(conn, user_id)
        suggest = link["ha_user_id"] if link else None  # owner answer Q7: the other identity of the same person is only SUGGESTED
        audit(conn, actor=principal, action=action, decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
              details={**effects, **({"linked_ha_user": suggest} if suggest else {})})
        if effects.get("sessions_ended"):
            li.close_sockets_from_thread()
    if changed:
        li.CACHE.drop_user(user_id)  # a cached principal must not write the old display name back (auth.touch_user)
        audit(conn, actor=principal, action="identity.local.user.updated", decision="allowed", resource_type="user", resource_id=user_id,
              request_id=_rid(request), details={"fields": sorted(changed), **({"reset_mode": changed["reset_mode"]} if "reset_mode" in changed else {})})
    out = _user_dict(conn, _user_row(conn, user_id))
    if suggest:
        out["suggest_also"] = {"ha_user_id": suggest, "active": not bool(fields["active"])}
    return localize_for(conn, principal, out)  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.delete("/identity/local-users/{user_id}", **wire(W.LocalUserDeleted))
def delete_local_user(user_id: str, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _user_row(conn, user_id)
    now = now_iso()
    li.lease_hook("actor_removed", user_ids=[user_id])  # CR-WISKEY-LEASE T2 (then T4 / T3 / strict T1 below)
    store.mark_user_deleted(conn, user_id, now, principal.user_id)
    effects = _end_access(conn, user_id, "user_deleted")
    bindings = store.revoke_user_bindings(conn, user_id, now)
    store.delete_ha_link(conn, user_id)
    bump_permission_revision(conn)
    audit(conn, actor=principal, action="identity.local.user.deleted", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
          details={**effects, "bindings_revoked": bindings})
    if effects["sessions_ended"]:
        li.close_sockets_from_thread()
    return {"id": user_id, "deleted_at": now, **effects, "bindings_revoked": bindings}


@router.put("/identity/local-users/{user_id}/role", **wire(W.LocalUser))
def change_local_role(user_id: str, body: RoleBody, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from .access import revoke_one

    _manage(conn, principal)
    row = _user_row(conn, user_id)
    scope = (body.scope_type, body.scope_id)
    _check_role(conn, principal, body.role_id, scope)
    admin = li.role_is_admin(conn, body.role_id)
    _admin_target_local_only(request, admin)
    before = _binding(conn, user_id)
    store.savepoint(conn, "usr2_role")
    try:
        # every active binding of the user ends (normally exactly one; a row written behind the routes' back too)
        for b in store.live_role_bindings(conn, user_id):
            revoke_one(conn, principal, request, b)
        bid = _bind(conn, principal, request, user_id, body.role_id, scope)
        reset_switched = False
        if admin and row["reset_mode"] == "self_service":  # Q5: an administrative role never keeps self-service reset
            store.force_manager_only_reset(conn, user_id, now_iso())
            reset_switched = True
    except BaseException:
        store.rollback_savepoint(conn, "usr2_role")
        raise
    store.release_savepoint(conn, "usr2_role")
    audit(conn, actor=principal, action="identity.local.user.role_changed", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
          details={"before": {"role_id": before["role_id"], "scope": f"{before['scope_type']}:{before['scope_id']}"} if before is not None else None,
                   "after": {"role_id": body.role_id, "scope": f"{scope[0]}:{scope[1]}", "binding_id": bid}, "admin": admin,
                   **({"reset_mode_switched": "manager_only"} if reset_switched else {})})
    revocation.mark([user_id])
    return localize_for(conn, principal, _user_dict(conn, _user_row(conn, user_id)))  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.post("/identity/local-users/{user_id}/link", **wire(W.LocalUserLink))
def issue_local_link(user_id: str, body: LinkBody, request: Request, principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _feature_on(conn)
    row = _user_row(conn, user_id)
    admin = li.holds_admin(conn, user_id)
    b = _binding(conn, user_id)
    admin = admin or bool(b and li.role_is_admin(conn, b["role_id"]))
    _admin_target_local_only(request, admin)
    channel = "remote" if is_remote(request) else "local"

    def refuse(status: int, code: str, message: str, reason: str) -> ApiError:
        audit(conn, actor=principal, action="auth.local.link.issued", decision="denied", resource_type="user", resource_id=user_id, request_id=_rid(request),
              reason=reason, details={"purpose": body.purpose, "via": body.via, "channel": channel, "admin_target": admin})
        return ApiError(status, code, message)

    if body.via == "whatsapp" and admin:  # owner answer Q3: an administrative target's link never travels by WhatsApp
        raise refuse(422, "whatsapp_not_for_admins", WHATSAPP_ADMIN_HE, "whatsapp_admin_target")
    if not row["active"]:
        raise ApiError(409, "user_disabled", "המשתמש מושבת. הפעל אותו לפני הפקת קישור.")
    expected = "reset" if row["has_password"] else "first_login"
    if body.purpose != expected:
        raise ApiError(409, "purpose_mismatch", "למשתמש שכבר בחר סיסמה מפיקים קישור איפוס; למשתמש חדש - קישור כניסה ראשונה.", details={"expected": expected})
    number = origin = None
    if body.via == "whatsapp":  # USR2 phase 2: a non-administrative target's link to the user's VERIFIED number (never shown, never returned)
        number = lr.verified_number(conn, user_id)
        if number is None:
            raise refuse(409, "no_verified_number", lr.NO_NUMBER_HE, "no_verified_number")
        if not lr.channel_ready(conn):
            raise refuse(409, "whatsapp_unavailable", lr.CHANNEL_HE, "channel_unavailable")
        origin = lr.public_origin(conn, request)
        if origin is None:
            raise refuse(409, "public_url_unknown", lr.PUBLIC_URL_HE, "public_url_unknown")
    token, expires = li.issue_link(conn, user_id=user_id, purpose=body.purpose, via=body.via, channel=channel, actor=principal, temporary=body.temporary)
    if number is not None and origin is not None:
        hours = max(1, int(round(li.link_ttl_s(conn) / 3600)))
        ref = li.token_hash(token)[:12]
        if not lr.send_link(request.app.state.db, user_id=user_id, number=number, url=origin + li.link_path(settings_of(request), token), purpose=body.purpose,
                            hours=hours, ref=ref):
            li.invalidate_links(conn, user_id)  # an ApiError commits the transaction: the link that never left must not stay usable
            raise ApiError(503, "busy", lr.BUSY_HE, retryable=True)
        del token
        audit(conn, actor=principal, action="auth.local.link.issued", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
              details={"purpose": body.purpose, "via": "whatsapp", "channel": channel, "temporary": body.temporary, "admin_target": False, "ref": ref})
        return {"user_id": user_id, "link": {"purpose": body.purpose, "via": "whatsapp", "expires_at": li.iso(expires), "queued": True}}
    audit(conn, actor=principal, action="auth.local.link.issued", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
          details={"purpose": body.purpose, "via": "shown", "channel": channel, "temporary": body.temporary, "admin_target": admin})
    return {"user_id": user_id, "link": _link_answer(request, token, expires, body.purpose)}


@router.post("/identity/local-users/{user_id}/unlock", **wire(W.LocalUser))
def unlock_local_user(user_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    row = _user_row(conn, user_id)
    store.unlock(conn, user_id, principal.user_id, now_iso())
    li.TIERS.acct_clear_name(row["username"])  # USR2-FIX F2: the per-network delays of the name end too
    audit(conn, actor=principal, action="identity.local.user.unlocked", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request))
    return localize_for(conn, principal, _user_dict(conn, _user_row(conn, user_id)))  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.post("/identity/local-users/{user_id}/sessions/revoke", **wire(W.LocalUserSessionsRevoked))
def revoke_local_user_sessions(user_id: str, request: Request, principal: Principal = Depends(current_principal),
                               conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _user_row(conn, user_id)
    ended = li.revoke_user_sessions(conn, user_id, "admin")
    li.drop_pending_of(user_id)
    tokens = presence.revoke_tokens(conn, user_id)
    presence.end_on_sign_out(conn, user_id, "admin", everywhere=True, actor=principal, request_id=_rid(request))  # XSECFIX-297 (review M2): push ends too
    audit(conn, actor=principal, action="identity.local.user.sessions_revoked", decision="allowed", resource_type="user", resource_id=user_id,
          request_id=_rid(request), details={"sessions_ended": ended, "device_tokens_revoked": tokens})
    if ended:
        li.close_sockets_from_thread()
    return {"user_id": user_id, "sessions_ended": ended, "device_tokens_revoked": tokens}


@router.put("/identity/local-users/{user_id}/ha-link", **wire(W.LocalUser))
def set_ha_link(user_id: str, body: HaLinkBody, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _user_row(conn, user_id)
    if li.is_local_id(body.ha_user_id) or not store.directory_user_exists(conn, body.ha_user_id):
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית תשתית המערכת.")
    store.delete_ha_link(conn, user_id)
    store.insert_ha_link(conn, body.ha_user_id, user_id, principal.user_id, now_iso())
    audit(conn, actor=principal, action="identity.link.created", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
          details={"ha_user_id": body.ha_user_id})
    return localize_for(conn, principal, _user_dict(conn, _user_row(conn, user_id)))  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language


@router.delete("/identity/local-users/{user_id}/ha-link", **wire(W.LocalUser))
def remove_ha_link(user_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _user_row(conn, user_id)
    n = store.delete_ha_link(conn, user_id)
    if n:
        audit(conn, actor=principal, action="identity.link.removed", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request))
    return localize_for(conn, principal, _user_dict(conn, _user_row(conn, user_id)))  # I18N-BACKEND-2490 (third pass): role / scope names in the reader's language
