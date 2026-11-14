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
`POST   identity/local-users`               create + exactly one binding + a first-login link returned ONCE
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
from ..auth import current_principal, get_conn, settings_of
from ..db import bump_permission_revision, now_iso
from ..errors import ApiError
from ..rbac import INSTALLATION, Principal, authorize, require, role_name, scope_name
from ..remote_channel import csrf_reason, is_remote
from ..services import ha_user_auth as hua
from ..services import local_identity as li
from ..services import local_passwords as lp
from ..services import local_reset as lr
from ..services import presence, revocation
from ..services import second_factor as sf

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


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _error(request: Request, status: int, code: str, message: str, headers: dict[str, str] | None = None, retryable: bool = False) -> JSONResponse:
    return JSONResponse(status_code=status, headers=headers or {},
                        content={"code": code, "user_message": message, "retryable": retryable, "correlation_id": _rid(request) or "", "details": {}})


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


@public_post("/auth/local/sign-in")
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
    code: str = Field(min_length=1, max_length=16)


@public_post("/auth/local/sign-in/second-factor")
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


@public_post("/auth/local/set-password")
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


@public_post("/auth/local/reset/request", status_code=202)
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


@public_post("/auth/local/reset/confirm")
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


@router.put("/auth/local/password")
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


@router.patch("/auth/sessions/{session_id}")
def label_session(session_id: str, body: LabelBody, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """The user's own device name for one of its local sign-ins (HA sign-ins live in memory only and are not labelled in phase 1)."""
    found = li.chain_owner(conn, session_id) if re.fullmatch(r"[0-9a-f]{20}", session_id) and li.enabled(conn) else None
    if found is None or found[1] != principal.user_id:
        raise ApiError(404, "session_not_found", "הכניסה הזו כבר לא פעילה.")
    label = (body.label or "").strip() or None
    if label and any(ord(c) < 32 for c in label):
        raise ApiError(422, "validation", "שם המכשיר: טקסט רגיל בלבד.")
    conn.execute("UPDATE auth_local_sessions SET label = ? WHERE chain_id = ? AND revoked_at IS NULL", (label, found[0]))
    return {"id": session_id, "label": label}


# ---------------------------------------------------------------- administration

SCOPE_PATTERN = "^(installation|site|building|floor|camera|access_control_station)$"


class LocalUserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=32)
    display_name: str = Field(min_length=1, max_length=60)
    role_id: str = Field(min_length=1, max_length=60)
    scope_type: str = Field(default="installation", pattern=SCOPE_PATTERN)
    scope_id: str = Field(default="*", min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=254)
    notes: str | None = Field(default=None, max_length=200)
    reset_mode: str = Field(default="manager_only", pattern="^(manager_only|self_service)$")


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
    row = conn.execute("""SELECT u.*, c.password_hash IS NOT NULL AS has_password, c.must_change, c.reset_mode, c.last_sign_in_at, c.last_sign_in_from,
                                 c.failed_count, c.delay_until FROM users u JOIN auth_local_credentials c ON c.user_id = u.id
                          WHERE u.id = ? AND u.source = 'local'""", (user_id,)).fetchone()
    if row is None or (row["deleted_at"] and not include_deleted):
        raise ApiError(404, "user_unknown", NOT_FOUND_HE)
    return row


def _binding(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("""SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL
                           AND role_id != 'emergency_open' AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 1""", (user_id, now_iso())).fetchone()  # EMROLE-295: the temporary emergency_open grant is not the person's role


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
    link = conn.execute("SELECT ha_user_id FROM identity_links WHERE local_user_id = ?", (row["id"],)).fetchone()
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


@router.get("/identity/local-users")
def list_local_users(request: Request, include_deleted: bool = Query(False), principal: Principal = Depends(current_principal),
                     conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    rows = conn.execute("""SELECT u.*, c.password_hash IS NOT NULL AS has_password, c.must_change, c.reset_mode, c.last_sign_in_at, c.last_sign_in_from,
                                  c.failed_count, c.delay_until FROM users u JOIN auth_local_credentials c ON c.user_id = u.id
                           WHERE u.source = 'local'""" + ("" if include_deleted else " AND u.deleted_at IS NULL") + " ORDER BY u.display_name COLLATE NOCASE").fetchall()
    live: dict[str, int] = {}
    for c in li.chains(conn, None):
        live[c["user_id"]] = live.get(c["user_id"], 0) + 1
    return {"enabled": li.enabled(conn), "can_manage": authorize(conn, principal, "identity.local.manage", INSTALLATION).allowed,
            "channel": "remote" if is_remote(request) else "local", "users": [_user_dict(conn, r, live) for r in rows],
            # USR2 phase 2: can a code / a link leave by WhatsApp at all (an account mapped and connected), and where links point
            "whatsapp_ready": lr.channel_ready(conn), "public_url": lr.public_origin(conn, request),
            # USR2 phase 4: the owner switch of passkey-only sign-in (the tab shows it next to the address passkeys depend on)
            "passkey_first_allowed": _passkey_first_allowed(conn)}


def _passkey_first_allowed(conn: sqlite3.Connection) -> bool:
    from ..services import local_passkeys

    return local_passkeys.first_enabled(conn)


def _validate_email(email: str | None) -> str | None:
    email = (email or "").strip() or None
    if email and not li.EMAIL_RE.match(email):
        raise ApiError(422, "validation", "כתובת הדוא״ל אינה תקינה.", details={"field": "email"})
    return email


def _clean_text(value: str | None, field: str) -> str | None:
    value = (value or "").strip() or None
    if value and any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise ApiError(422, "validation", "טקסט רגיל בלבד.", details={"field": field})
    return value


def _username_taken(conn: sqlite3.Connection, key: str) -> bool:
    if conn.execute("SELECT 1 FROM users WHERE lower(trim(username)) = ?", (key,)).fetchone():
        return True
    return any(li.username_key(r[0]) == key for r in conn.execute("SELECT username FROM ha_users WHERE username IS NOT NULL").fetchall())


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


@router.post("/identity/local-users", status_code=201)
def create_local_user(body: LocalUserCreate, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _feature_on(conn)
    key = li.username_key(body.username)
    if not li.USERNAME_RE.match(key):
        raise ApiError(422, "validation", USERNAME_HE, details={"field": "username"})
    display = _clean_text(body.display_name, "display_name")
    if not display:
        raise ApiError(422, "validation", "שם התצוגה חסר.", details={"field": "display_name"})
    email = _validate_email(body.email)
    notes = _clean_text(body.notes, "notes")
    scope = (body.scope_type, body.scope_id)
    _check_role(conn, principal, body.role_id, scope)
    admin = li.role_is_admin(conn, body.role_id)
    _admin_target_local_only(request, admin)
    if admin and body.reset_mode == "self_service":
        raise ApiError(422, "self_service_not_for_admins", SELF_SERVICE_ADMIN_HE)
    if _username_taken(conn, key):
        raise ApiError(409, "username_taken", TAKEN_HE)
    uid = li.new_local_id()
    now = now_iso()
    conn.execute("SAVEPOINT usr2_create")
    try:
        conn.execute("""INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at, email, created_by, notes)
                        VALUES (?, ?, ?, 'local', 1, ?, ?, ?, ?, ?)""", (uid, key, display, now, now, email, principal.user_id, notes))
        conn.execute("INSERT INTO auth_local_credentials(user_id, reset_mode, updated_at) VALUES (?, ?, ?)", (uid, body.reset_mode, now))
        bid = _bind(conn, principal, request, uid, body.role_id, scope)
        token, expires = li.issue_link(conn, user_id=uid, purpose="first_login", via="shown", channel="remote" if is_remote(request) else "local", actor=principal)
    except BaseException:
        conn.execute("ROLLBACK TO usr2_create")
        conn.execute("RELEASE usr2_create")
        raise
    conn.execute("RELEASE usr2_create")
    audit(conn, actor=principal, action="identity.local.user.created", decision="allowed", resource_type="user", resource_id=uid, request_id=_rid(request),
          details={"role_id": body.role_id, "scope": f"{scope[0]}:{scope[1]}", "binding_id": bid, "admin": admin, "reset_mode": body.reset_mode})
    audit(conn, actor=principal, action="auth.local.link.issued", decision="allowed", resource_type="user", resource_id=uid, request_id=_rid(request),
          details={"purpose": "first_login", "via": "shown", "channel": "remote" if is_remote(request) else "local", "temporary": False})
    revocation.changed([uid])
    return {"user": _user_dict(conn, _user_row(conn, uid)), "link": _link_answer(request, token, expires, "first_login")}


@router.get("/identity/local-users/export")
def export_local_users(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    _manage(conn, principal)
    rows = conn.execute("""SELECT u.*, c.password_hash IS NOT NULL AS has_password, c.must_change, c.reset_mode, c.last_sign_in_at, c.last_sign_in_from,
                                  c.failed_count, c.delay_until FROM users u JOIN auth_local_credentials c ON c.user_id = u.id
                           WHERE u.source = 'local' AND u.deleted_at IS NULL ORDER BY u.display_name COLLATE NOCASE""").fetchall()
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


@router.get("/identity/local-users/{user_id}")
def get_local_user(user_id: str, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "identity.directory.read", INSTALLATION)
    return _user_dict(conn, _user_row(conn, user_id))


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


@router.patch("/identity/local-users/{user_id}")
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
            raise ApiError(422, "validation", "שם התצוגה חסר.", details={"field": "display_name"})
        conn.execute("UPDATE users SET display_name = ? WHERE id = ?", (name, user_id))
        changed["display_name"] = True
    if "email" in fields:
        conn.execute("UPDATE users SET email = ? WHERE id = ?", (_validate_email(fields["email"]), user_id))
        changed["email"] = True
    if "notes" in fields:
        conn.execute("UPDATE users SET notes = ? WHERE id = ?", (_clean_text(fields["notes"], "notes"), user_id))
        changed["notes"] = True
    if fields.get("reset_mode") is not None and fields["reset_mode"] != row["reset_mode"]:
        if fields["reset_mode"] == "self_service" and li.holds_admin(conn, user_id):
            audit(conn, actor=principal, action="identity.local.user.updated", decision="denied", resource_type="user", resource_id=user_id,
                  reason="self_service_not_for_admins", request_id=_rid(request))
            raise ApiError(422, "self_service_not_for_admins", SELF_SERVICE_ADMIN_HE)
        conn.execute("UPDATE auth_local_credentials SET reset_mode = ?, updated_at = ? WHERE user_id = ?", (fields["reset_mode"], now_iso(), user_id))
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
            conn.execute("UPDATE auth_local_credentials SET passkey_first = 0, updated_at = ? WHERE user_id = ?", (now_iso(), user_id))
            audit(conn, actor=principal, action="auth.local.passkey.first_disabled", decision="allowed", resource_type="user", resource_id=user_id,
                  reason="admin", request_id=_rid(request))
            changed["passkey_first"] = False
    suggest: str | None = None
    if fields.get("active") is not None and bool(fields["active"]) != bool(row["active"]):
        if not fields["active"]:
            li.lease_hook("actor_disabled", user_ids=[user_id])  # CR-WISKEY-LEASE T2 (then T4 / T3 / strict T1 below)
            conn.execute("UPDATE users SET active = 0, disabled_at = ?, disabled_by = ? WHERE id = ?", (now_iso(), principal.user_id, user_id))
            effects = _end_access(conn, user_id, "user_disabled")
            bump_permission_revision(conn)
            action = "identity.local.user.disabled"
        else:
            conn.execute("UPDATE users SET active = 1, disabled_at = NULL, disabled_by = NULL WHERE id = ?", (user_id,))
            revocation.changed([user_id])
            action = "identity.local.user.enabled"
        link = conn.execute("SELECT ha_user_id FROM identity_links WHERE local_user_id = ?", (user_id,)).fetchone()
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
    return out


@router.delete("/identity/local-users/{user_id}")
def delete_local_user(user_id: str, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _user_row(conn, user_id)
    now = now_iso()
    li.lease_hook("actor_removed", user_ids=[user_id])  # CR-WISKEY-LEASE T2 (then T4 / T3 / strict T1 below)
    conn.execute("UPDATE users SET active = 0, deleted_at = ?, disabled_at = COALESCE(disabled_at, ?), disabled_by = COALESCE(disabled_by, ?) WHERE id = ?",
                 (now, now, principal.user_id, user_id))
    effects = _end_access(conn, user_id, "user_deleted")
    bindings = conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL", (now, user_id)).rowcount
    conn.execute("DELETE FROM identity_links WHERE local_user_id = ?", (user_id,))
    bump_permission_revision(conn)
    audit(conn, actor=principal, action="identity.local.user.deleted", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
          details={**effects, "bindings_revoked": bindings})
    if effects["sessions_ended"]:
        li.close_sockets_from_thread()
    return {"id": user_id, "deleted_at": now, **effects, "bindings_revoked": bindings}


@router.put("/identity/local-users/{user_id}/role")
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
    conn.execute("SAVEPOINT usr2_role")
    try:
        # every active binding of the user ends (normally exactly one; a row written behind the routes' back too)
        for b in conn.execute("SELECT * FROM bindings WHERE subject_kind = 'user' AND subject_id = ? AND revoked_at IS NULL AND role_id != 'emergency_open'", (user_id,)).fetchall():
            revoke_one(conn, principal, request, b)
        bid = _bind(conn, principal, request, user_id, body.role_id, scope)
        reset_switched = False
        if admin and row["reset_mode"] == "self_service":  # Q5: an administrative role never keeps self-service reset
            conn.execute("UPDATE auth_local_credentials SET reset_mode = 'manager_only', updated_at = ? WHERE user_id = ?", (now_iso(), user_id))
            reset_switched = True
    except BaseException:
        conn.execute("ROLLBACK TO usr2_role")
        conn.execute("RELEASE usr2_role")
        raise
    conn.execute("RELEASE usr2_role")
    audit(conn, actor=principal, action="identity.local.user.role_changed", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
          details={"before": {"role_id": before["role_id"], "scope": f"{before['scope_type']}:{before['scope_id']}"} if before is not None else None,
                   "after": {"role_id": body.role_id, "scope": f"{scope[0]}:{scope[1]}", "binding_id": bid}, "admin": admin,
                   **({"reset_mode_switched": "manager_only"} if reset_switched else {})})
    revocation.mark([user_id])
    return _user_dict(conn, _user_row(conn, user_id))


@router.post("/identity/local-users/{user_id}/link")
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


@router.post("/identity/local-users/{user_id}/unlock")
def unlock_local_user(user_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    row = _user_row(conn, user_id)
    conn.execute("UPDATE auth_local_credentials SET failed_count = 0, last_failed_at = NULL, delay_until = NULL, unlocked_by = ?, updated_at = ? WHERE user_id = ?",
                 (principal.user_id, now_iso(), user_id))
    li.TIERS.acct_clear_name(row["username"])  # USR2-FIX F2: the per-network delays of the name end too
    audit(conn, actor=principal, action="identity.local.user.unlocked", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request))
    return _user_dict(conn, _user_row(conn, user_id))


@router.post("/identity/local-users/{user_id}/sessions/revoke")
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


@router.put("/identity/local-users/{user_id}/ha-link")
def set_ha_link(user_id: str, body: HaLinkBody, request: Request, principal: Principal = Depends(current_principal),
                conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _user_row(conn, user_id)
    if li.is_local_id(body.ha_user_id) or conn.execute("SELECT 1 FROM ha_users WHERE id = ?", (body.ha_user_id,)).fetchone() is None:
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית תשתית המערכת.")
    conn.execute("DELETE FROM identity_links WHERE local_user_id = ?", (user_id,))
    conn.execute("INSERT INTO identity_links(ha_user_id, local_user_id, linked_by, linked_at) VALUES (?, ?, ?, ?)", (body.ha_user_id, user_id, principal.user_id, now_iso()))
    audit(conn, actor=principal, action="identity.link.created", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request),
          details={"ha_user_id": body.ha_user_id})
    return _user_dict(conn, _user_row(conn, user_id))


@router.delete("/identity/local-users/{user_id}/ha-link")
def remove_ha_link(user_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _manage(conn, principal)
    _user_row(conn, user_id)
    n = conn.execute("DELETE FROM identity_links WHERE local_user_id = ?", (user_id,)).rowcount
    if n:
        audit(conn, actor=principal, action="identity.link.removed", decision="allowed", resource_type="user", resource_id=user_id, request_id=_rid(request))
    return _user_dict(conn, _user_row(conn, user_id))
