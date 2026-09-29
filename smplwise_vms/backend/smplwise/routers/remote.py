"""CR-008 SmplWise Arx: the remote channel's session endpoints and the per-user remote-access flag.

`GET  auth/remote-config`  remote channel only, no identity: how the sign-in page keeps its tokens (remote.session).
`POST auth/session`        remote channel only: `Authorization: Bearer <HA access token>` → the Arx session cookie
                           (`__Secure-arx_session`, Path=<remote_path>/, HttpOnly, Secure, SameSite=Strict).
`DELETE auth/session`      remote channel only: sign out (the session is dropped, the cookie cleared).
`PUT access/users/{id}/remote-access`  system.configure: the per-user flag of remote.policy = flag (D4).

CR-008 P2 (remote-access hardening), on both channels:
`GET    auth/sessions?scope=own|all`  the remote sign-ins (one row per browser / client), own; `all` with system.configure.
`DELETE auth/sessions/{id}`           end one sign-in (own; another user's with system.configure). Audited.
`DELETE auth/sessions[?user_id=]`     "sign out everywhere" (own) or every sign-in of one user (system.configure).
Ending one's OWN sign-ins also deletes their HA refresh tokens (best effort); an administrator's revoke ends the Arx
access only. Either way the WebSockets of the ended sessions close at once and the same sign-in cannot come back.
"""
from __future__ import annotations

import datetime as dt
import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import now_iso
from ..errors import ApiError, unauthenticated
from ..rbac import INSTALLATION, Principal, authorize, require
from ..remote_channel import channel_of, is_remote
from ..services import ha_user_auth as hua

router = APIRouter()


def _remote_only(request: Request) -> None:
    if not is_remote(request):
        raise ApiError(404, "not_found", "Not found")


@router.get("/auth/remote-config")
def remote_config(request: Request) -> dict[str, Any]:
    _remote_only(request)
    settings = settings_of(request)
    with request.app.state.db.connection(mode="read", label="auth/remote-config") as conn:
        rs = hua.remote_settings(conn)
    return {"path": settings.remote_path + "/", "session": rs["remote.session"], "idle_lock_minutes": rs["remote.idle_lock_minutes"]}


@router.post("/auth/session")
async def create_session(request: Request) -> JSONResponse:
    _remote_only(request)
    settings = settings_of(request)
    token = hua.bearer_of(request)
    if not token:
        raise unauthenticated("remote_login_required", hua.LOGIN_REQUIRED_HE)
    session, max_age = await hua.exchange(request.app.state, settings, request, token)
    p = session.principal
    expires = dt.datetime.fromtimestamp(session.token_exp, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    response = JSONResponse({
        "user": {"id": p.user_id, "username": p.username, "display_name": p.display_name, "source": p.source},
        "session_expires_at": expires,
        "session_expires_in": max_age,
    })
    name = hua.cookie_name(settings, request)
    response.set_cookie(name, session.sid, max_age=max_age, path=settings.remote_path + "/", httponly=True,
                        secure=name == hua.COOKIE_SECURE, samesite="strict")
    return response


@router.delete("/auth/session")
async def delete_session(request: Request) -> Response:
    _remote_only(request)
    settings = settings_of(request)
    if not hua.LIMITER.hit(f"logout:{hua.client_ip(request)}", hua.IP_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    await run_in_threadpool(hua.logout, request.app.state, settings, request)
    await hua._close_sockets()
    response = Response(status_code=204)
    for name in (hua.COOKIE_SECURE, hua.COOKIE_PLAIN):
        response.delete_cookie(name, path=settings.remote_path + "/", httponly=True, secure=name == hua.COOKIE_SECURE, samesite="strict")
    return response


class RemoteFlag(BaseModel):
    enabled: bool


@router.put("/access/users/{user_id}/remote-access")
def set_remote_access(user_id: str, body: RemoteFlag, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    known = conn.execute("SELECT 1 FROM users WHERE id = ? UNION SELECT 1 FROM ha_users WHERE id = ?", (user_id, user_id)).fetchone()
    if not known:
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית Home Assistant.")
    before = hua.has_flag(conn, user_id)
    if body.enabled:
        conn.execute("INSERT OR IGNORE INTO remote_access_users(user_id, granted_by, granted_at) VALUES (?, ?, ?)", (user_id, principal.user_id, now_iso()))
    else:
        conn.execute("DELETE FROM remote_access_users WHERE user_id = ?", (user_id,))
    dropped = 0
    if not body.enabled:
        # under remote.policy = flag the user's remote sign-ins end now, their WebSockets with them (CR-008 P2)
        from .settings import read_settings

        if read_settings(conn)["remote.policy"] == "flag":
            dropped = len({s.chain or s.sid for s in hua.STORE.drop_user(user_id)})
            _close_sockets_from_thread()
    if before != body.enabled:
        audit(conn, actor=principal, action="remote.access_flag", decision="allowed", resource_type="user", resource_id=user_id,
              request_id=getattr(request.state, "correlation_id", None),
              details={"before": before, "after": body.enabled, **({"sessions_ended": dropped} if dropped else {})})
    return {"user_id": user_id, "remote_access": body.enabled, "sessions_ended": dropped}


def _close_sockets_from_thread() -> None:
    """Close the dropped sessions' WebSockets now from a sync handler (it runs in AnyIO's worker thread); otherwise the
    background pass closes them within seconds."""
    try:
        from anyio.from_thread import run as run_async

        run_async(hua._close_sockets)
    except Exception:  # noqa: BLE001 - not in a worker thread (a direct call): the next pass closes them
        pass


# ---------------------------------------------------------------- CR-008 P2: the remote sessions list

SESSION_NOT_FOUND_HE = "הכניסה הזו כבר לא פעילה."


def _who(request: Request) -> tuple[Principal, bool]:
    """The caller and whether they administer the installation - on a short read connection of its own, so the async
    revoke handlers never hold the write lock while they close sockets or call HA."""
    from ..auth import _principal

    with request.app.state.db.connection(mode="read", label=f"{request.method} auth/sessions") as conn:
        principal = _principal(request, conn)
        return principal, authorize(conn, principal, "system.configure", INSTALLATION).allowed


def _require_admin(request: Request, principal: Principal) -> None:
    with request.app.state.db.connection(label="auth/sessions admin") as conn:
        require(conn, principal, "system.configure", INSTALLATION)  # 403, audited


def _live_by_chain() -> dict[str, int]:
    from .media import remote_live_by_chain

    return remote_live_by_chain()


def _current_chain(request: Request) -> str | None:
    s = hua.session_of(request)
    return (s.chain or s.sid) if s is not None else None


@router.get("/auth/sessions")
def list_remote_sessions(request: Request, scope: str = Query("own", pattern="^(own|all)$")) -> dict[str, Any]:
    principal, admin = _who(request)
    if scope == "all" and not admin:
        _require_admin(request, principal)
    entries = hua.STORE.chains(None if scope == "all" else principal.user_id)
    current = _current_chain(request)
    live = _live_by_chain()
    return {"scope": scope, "can_manage": admin, "channel": channel_of(request),
            "sessions": [hua.describe(e, current, live) for e in entries]}


def _clear_cookie(response: Response, settings) -> None:
    for name in (hua.COOKIE_SECURE, hua.COOKIE_PLAIN):
        response.delete_cookie(name, path=settings.remote_path + "/", httponly=True, secure=name == hua.COOKIE_SECURE, samesite="strict")


async def _revoke(request: Request, principal: Principal, sessions: list, target_user: str, reason: str) -> JSONResponse:
    settings = settings_of(request)
    current = _current_chain(request)
    ends_current = current is not None and any((s.chain or s.sid) == current for s in sessions)
    own = target_user == principal.user_id
    result = await hua.revoke_sessions(request.app.state, settings, sessions, actor=principal, reason=reason, target_user=target_user,
                                       also_at_ha=own, request_id=getattr(request.state, "correlation_id", None))
    response = JSONResponse({**result, "current_ended": ends_current})
    if ends_current:
        _clear_cookie(response, settings)
    return response


@router.delete("/auth/sessions/{session_id}")
async def revoke_remote_session(session_id: str, request: Request) -> JSONResponse:
    principal, admin = await run_in_threadpool(_who, request)  # identity first: an anonymous caller learns nothing (401)
    sessions = hua.STORE.sessions_of({session_id}) if re.fullmatch(r"[0-9a-f]{20}", session_id) else []
    if not sessions:
        raise ApiError(404, "session_not_found", SESSION_NOT_FOUND_HE)
    owner = sessions[0].principal.user_id
    if owner != principal.user_id and not admin:
        await run_in_threadpool(_require_admin, request, principal)
    return await _revoke(request, principal, sessions, owner, "revoked_by_user" if owner == principal.user_id else "revoked_by_admin")


@router.delete("/auth/sessions")
async def revoke_all_remote_sessions(request: Request, user_id: str | None = Query(None, max_length=200)) -> JSONResponse:
    principal, admin = await run_in_threadpool(_who, request)
    target = user_id or principal.user_id
    if target != principal.user_id and not admin:
        await run_in_threadpool(_require_admin, request, principal)
    sessions = hua.STORE.sessions_of(user_id=target)
    return await _revoke(request, principal, sessions, target, "signed_out_everywhere" if target == principal.user_id else "revoked_all_by_admin")
