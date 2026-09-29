"""CR-008 SmplWise Arx: the remote channel's session endpoints and the per-user remote-access flag.

`GET  auth/remote-config`  remote channel only, no identity: how the sign-in page keeps its tokens (remote.session).
`POST auth/session`        remote channel only: `Authorization: Bearer <HA access token>` → the Arx session cookie
                           (`__Secure-arx_session`, Path=<remote_path>/, HttpOnly, Secure, SameSite=Strict).
`DELETE auth/session`      remote channel only: sign out (the session is dropped, the cookie cleared).
`PUT access/users/{id}/remote-access`  system.configure: the per-user flag of remote.policy = flag (D4).
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import now_iso
from ..errors import ApiError, unauthenticated
from ..rbac import INSTALLATION, Principal, require
from ..remote_channel import is_remote
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
        raise ApiError(404, "user_unknown", "המשתמש לא נמצא בספריית המערכת.")
    before = hua.has_flag(conn, user_id)
    if body.enabled:
        conn.execute("INSERT OR IGNORE INTO remote_access_users(user_id, granted_by, granted_at) VALUES (?, ?, ?)", (user_id, principal.user_id, now_iso()))
    else:
        conn.execute("DELETE FROM remote_access_users WHERE user_id = ?", (user_id,))
    if before != body.enabled:
        audit(conn, actor=principal, action="remote.access_flag", decision="allowed", resource_type="user", resource_id=user_id,
              request_id=getattr(request.state, "correlation_id", None), details={"before": before, "after": body.enabled})
    dropped = 0
    if not body.enabled:
        # under remote.policy = flag the user's remote sessions end now (their WebSockets close on the next pass)
        from .settings import read_settings

        if read_settings(conn)["remote.policy"] == "flag":
            dropped = len(hua.STORE.drop_user(user_id))
    return {"user_id": user_id, "remote_access": body.enabled, "sessions_ended": dropped}
