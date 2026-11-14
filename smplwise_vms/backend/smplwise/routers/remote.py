"""CR-008 SmplWise Arx: the remote channel's session endpoints and the per-user remote-access flag.

`GET  auth/remote-config`  remote channel only, no identity: how the sign-in page keeps its tokens (remote.session).
`GET  auth/app-download`   remote channel only, no identity: the Android download offer (url / version / sha256), null when not configured.
`GET  auth/app-download/file` remote channel only, no identity: the signed APK bundled in the image (GET / HEAD, ETag, ranges, rate limited).
`POST auth/session`        remote channel only: `Authorization: Bearer <HA access token>` → the Arx session cookie
                           (`__Secure-arx_session`, Path=<remote_path>/, HttpOnly, Secure, SameSite=Strict).
`DELETE auth/session`      remote channel only: sign out (the session is dropped, the cookie cleared).
`PUT access/users/{id}/remote-access`  system.configure: the per-user flag of remote.policy = flag (D4). An administrator stays
                           admitted by `remote.admins_default` (default on) whatever the flag says (CR-008 amendment).

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
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..db import now_iso
from ..errors import ApiError, unauthenticated
from ..rbac import INSTALLATION, Principal, authorize, require
from ..remote_channel import channel_of, is_remote
from ..services import app_download, ha_user_auth as hua, presence

router = APIRouter()
APP_DOWNLOAD_LIMITS: list[tuple[float, int]] = [(60.0, 30), (3600.0, 300)]


def _remote_only(request: Request) -> None:
    if not is_remote(request):
        raise ApiError(404, "not_found", "Not found")


@router.get("/auth/remote-config")
def remote_config(request: Request) -> dict[str, Any]:
    _remote_only(request)
    settings = settings_of(request)
    from ..services import local_identity

    with request.app.state.db.connection(mode="read", label="auth/remote-config") as conn:
        rs = hua.remote_settings(conn)
        local = local_identity.enabled(conn)
        local_min = local_identity.password_min(conn) if local else 0
        if local:
            from ..services import local_passkeys

            passkey_first = local_passkeys.first_enabled(conn) and local_passkeys.rp(conn) is not None
    body = {"path": settings.remote_path + "/", "session": rs["remote.session"], "idle_lock_minutes": rs["remote.idle_lock_minutes"]}
    if local:  # USR2: the sign-in page offers the "משתמש Arx" mode only while the feature is on (absent otherwise: the answer is unchanged)
        body["local_identity"] = True
        body["local_password_min"] = local_min
        if passkey_first:  # USR2 phase 4: the "sign in with a passkey" button (absent otherwise)
            body["local_passkey_first"] = True
    return body


@router.get("/auth/app-download")
def app_download_offer(request: Request) -> JSONResponse:
    """Public (no identity), remote channel only: the Android app download offer of the sign-in page. Only url / version /
    sha256 of the address an administrator saved; `{"android": null}` when none is configured."""
    _remote_only(request)
    # security review 2.2.0 L8: a public route - a modest per-address limit, like the other anonymous ones
    if not hua.LIMITER.hit(f"appdl:{hua.limit_ip(hua.client_ip(request))}", APP_DOWNLOAD_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    with request.app.state.db.connection(mode="read", label="auth/app-download") as conn:
        body = app_download.public_offer(conn, settings_of(request).downloads_dir)
    return JSONResponse(body, headers={"Cache-Control": "no-store"})


FILE_LIMITS: list[tuple[float, int]] = [(60.0, 6), (3600.0, 30)]  # per client address; the APK is tens of MB


@router.get("/auth/app-download/file")
@router.head("/auth/app-download/file", include_in_schema=False)  # one route per method: a GET+HEAD api_route gave both the same operationId
def app_download_file(request: Request) -> Response:
    """Public (no identity), remote channel only: the signed release APK bundled in the add-on image. The path is fixed (no
    caller input reaches the file system); 404 when no valid bundled file exists."""
    _remote_only(request)
    if not hua.LIMITER.hit(f"apk:{hua.limit_ip(hua.client_ip(request))}", FILE_LIMITS):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)
    bundled = app_download.load_bundled(settings_of(request).downloads_dir)
    if bundled is None:
        raise ApiError(404, "not_found", "Not found")
    headers = {
        "ETag": bundled.etag,
        "Cache-Control": "public, max-age=300, must-revalidate",
        "Content-Disposition": f'attachment; filename="{bundled.filename}"',
        "X-Content-Type-Options": "nosniff",
    }
    inm = request.headers.get("if-none-match", "")
    if bundled.etag in [t.strip() for t in inm.split(",")] or inm.strip() == "*":
        return Response(status_code=304, headers=headers)
    return FileResponse(bundled.path, media_type=app_download.MIME, headers=headers)


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
    if not hua.LIMITER.hit(f"logout:{hua.limit_ip(hua.client_ip(request))}", hua.IP_LIMITS):
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
    dropped = 0
    # what admits the user after this change: the flag just set, else the administrator default (CR-008 amendment)
    basis = hua.remote_basis(conn, user_id)
    if not body.enabled:
        # under remote.policy = flag the user's remote sign-ins end now, their WebSockets with them (CR-008 P2) - unless
        # the administrator default still admits them
        from .settings import read_settings

        if read_settings(conn)["remote.policy"] == "flag" and basis is None:
            dropped = len({s.sign_in() for s in hua.STORE.drop_user(user_id)})
            _close_sockets_from_thread()
            # APPREFRESH-295 F-01: the phone app's saved sign-ins of the user end with the remote access
            from ..services import app_refresh

            app_refresh.hook("revoke_user", conn, user_id, "remote_access_removed", actor=principal,
                             request_id=getattr(request.state, "correlation_id", None))
            # XSECFIX-297 (review M2): the phone app's device tokens and push registrations end with the remote access
            presence.end_on_sign_out(conn, user_id, "remote_access_removed", everywhere=True, actor=principal,
                                     request_id=getattr(request.state, "correlation_id", None))
    if before != body.enabled:
        audit(conn, actor=principal, action="remote.access_flag", decision="allowed", resource_type="user", resource_id=user_id,
              request_id=getattr(request.state, "correlation_id", None),
              details={"before": before, "after": body.enabled, **({"sessions_ended": dropped} if dropped else {})})
    effective = hua.BASIS_FLAG if body.enabled else hua.BASIS_ADMIN_DEFAULT if basis == hua.BASIS_ADMIN_DEFAULT else None
    return {"user_id": user_id, "remote_access": effective is not None, "remote_access_basis": effective, "sessions_ended": dropped}


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
    return s.sign_in() if s is not None else None


@router.get("/auth/sessions")
def list_remote_sessions(request: Request, scope: str = Query("own", pattern="^(own|all)$")) -> dict[str, Any]:
    principal, admin = _who(request)
    if scope == "all" and not admin:
        _require_admin(request, principal)
    entries = hua.STORE.chains(None if scope == "all" else principal.user_id)
    current = _current_chain(request)
    live = _live_by_chain()
    sessions = [hua.describe(e, current, live) for e in entries]
    sessions += _local_rows(request, None if scope == "all" else principal.user_id, current, live)
    sessions += _app_rows(request, None if scope == "all" else principal.user_id, current, live)
    return {"scope": scope, "can_manage": admin, "channel": channel_of(request), "sessions": sessions}


def _local_rows(request: Request, user_id: str | None, current: str | None, live: dict[str, int]) -> list[dict[str, Any]]:
    """USR2: the live local (Arx-only) sign-ins, one row per chain, with `kind: "local"` and the device label. Nothing while the
    feature is off, so the list is unchanged for an installation that never enabled it."""
    from ..services import local_identity

    if user_id is not None and not local_identity.is_local_id(user_id):
        return []
    with request.app.state.db.connection(mode="read", label="auth/sessions local") as conn:
        if not local_identity.enabled(conn):
            return []
        rows = local_identity.chains(conn, user_id)
    out = []
    for r in rows:
        chain = r.pop("_chain")
        out.append({**r, "current": chain == current, "live_streams": live.get(chain, 0)})
    return out


def _app_rows(request: Request, user_id: str | None, current: str | None, live: dict[str, int]) -> list[dict[str, Any]]:
    """SESSIONEXCH2 (decision 396): the phone app's WebView sessions, one row each (`kind: "app"`, the device's name, `saved_sign_in`)."""
    from ..services import app_session

    with request.app.state.db.connection(mode="read", label="auth/sessions app") as conn:
        rows = app_session.list_rows(conn, user_id)
    out = []
    for r in rows:
        chain = r.pop("_chain")
        out.append({**r, "current": chain == current, "live_streams": live.get(chain, 0)})
    return out


def _app_revoke(request: Request, principal: Principal, admin: bool, pid: str) -> JSONResponse | None:
    """SESSIONEXCH2 / review S-04: ending an app web session's row ends its FAMILY (the phone's saved sign-in), exactly like
    DELETE /auth/app/families/{id} - so the app cannot silently re-create it. None = not an app web session."""
    from ..services import app_refresh, app_session

    settings = settings_of(request)
    current = _current_chain(request)
    rid = getattr(request.state, "correlation_id", None)
    with request.app.state.db.connection(label="auth/sessions app revoke") as conn:
        row = app_session.owner_of(conn, pid)
        if row is None:
            return None
        owner = row["user_id"]
        if owner != principal.user_id and not admin:
            require(conn, principal, "system.configure", INSTALLATION)  # 403, audited
        reason = "revoked_by_user" if owner == principal.user_id else "revoked_by_admin"
        ended = app_refresh.revoke_family(conn, row["family_id"], reason, actor=principal, request_id=rid, subject=owner)
        app_session._end_where(conn, "sid_hash = ?", (row["sid_hash"],), reason)  # the family was already ended elsewhere: the row still goes
        app_refresh.release_pins(conn, [row["device_id"]], reason, actor=principal, request_id=rid)  # Q296: only the user's own end
        # XSECFIX-297 (review M2): ending the app's web session (own or by an administrator) ends that device's token and push too
        presence.end_on_sign_out(conn, owner, reason, device_ids=[row["device_id"]], actor=principal, request_id=rid)
        audit(conn, actor=principal, action="auth.app_session.revoked", decision="allowed", resource_type="user", resource_id=owner, reason=reason,
              request_id=rid, details={"session": pid, "family": row["family_id"], "families_ended": ended})
    ends_current = current == "a:" + pid
    response = JSONResponse({"sessions_ended": 1, "ha_sign_ins_ended": 0, "saved_sign_ins_ended": ended, "current_ended": ends_current})
    if ends_current:
        _clear_cookie(response, settings)
    return response


def _local_revoke(request: Request, principal: Principal, admin: bool, *, chain_pid: str | None = None, user_id: str | None = None) -> JSONResponse | None:
    """USR2: DELETE auth/sessions[/{id}] for local sign-ins. None = not a local session (the HA path answers)."""
    from ..services import local_identity

    settings = settings_of(request)
    current = _current_chain(request)
    with request.app.state.db.connection(label="auth/sessions local revoke") as conn:
        if not local_identity.enabled(conn):
            return None
        if chain_pid is not None:
            found = local_identity.chain_owner(conn, chain_pid)
            if found is None:
                return None
            chain_id, owner = found
            if owner != principal.user_id and not admin:
                require(conn, principal, "system.configure", INSTALLATION)  # 403, audited
            reason = "logout" if owner == principal.user_id else "admin"
            agents = tuple(r["user_agent"] or "" for r in conn.execute("SELECT user_agent FROM auth_local_sessions WHERE chain_id = ?", (chain_id,)).fetchall())
            ended = local_identity.revoke_chain(conn, chain_id, reason)
            ends_current = current == "l:" + chain_id
            target = owner
            # XSECFIX-297 (review M2): a sign-in of the phone app ended from the list ends the app's device token and push too
            presence.end_on_sign_out(conn, target, reason, user_agents=agents, actor=principal, request_id=getattr(request.state, "correlation_id", None))
        else:
            if not local_identity.is_local_id(user_id):
                return None
            target = user_id
            reason = "logout_all" if target == principal.user_id else "admin"
            ended = local_identity.revoke_user_sessions(conn, target, reason)
            ends_current = current is not None and current.startswith("l:") and target == principal.user_id
            # XSECFIX-297 (review M2): "sign out everywhere" / an administrator's revoke-all ends every device token and push registration
            presence.end_on_sign_out(conn, target, reason, everywhere=True, actor=principal, request_id=getattr(request.state, "correlation_id", None))
        audit(conn, actor=principal, action="auth.local.session.revoked", decision="allowed", resource_type="user", resource_id=target, reason=reason,
              request_id=getattr(request.state, "correlation_id", None), details={"sessions": ended, **({"id": chain_pid} if chain_pid else {})})
    response = JSONResponse({"sessions_ended": ended, "ha_sign_ins_ended": 0, "current_ended": ends_current})
    if ends_current:
        _clear_cookie(response, settings)
    return response


def _clear_cookie(response: Response, settings) -> None:
    for name in (hua.COOKIE_SECURE, hua.COOKIE_PLAIN):
        response.delete_cookie(name, path=settings.remote_path + "/", httponly=True, secure=name == hua.COOKIE_SECURE, samesite="strict")


async def _revoke(request: Request, principal: Principal, sessions: list, target_user: str, reason: str) -> JSONResponse:
    settings = settings_of(request)
    current = _current_chain(request)
    ends_current = current is not None and any(s.sign_in() == current for s in sessions)
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
    if not sessions and re.fullmatch(r"[0-9a-f]{20}", session_id):
        local = await run_in_threadpool(lambda: _local_revoke(request, principal, admin, chain_pid=session_id))
        if local is not None:
            await hua._close_sockets()
            return local
        app = await run_in_threadpool(lambda: _app_revoke(request, principal, admin, session_id))
        if app is not None:
            await hua._close_sockets()
            return app
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
    if target.startswith("l_"):  # USR2: a local identity's sign-ins (it has no HA sign-in)
        local = await run_in_threadpool(lambda: _local_revoke(request, principal, admin, user_id=target))
        if local is not None:
            await hua._close_sockets()
            return local
    sessions = hua.STORE.sessions_of(user_id=target)
    return await _revoke(request, principal, sessions, target, "signed_out_everywhere" if target == principal.user_id else "revoked_all_by_admin")


# ---------------------------------------------------------------- CR-008 P2: CSP violation reports (counters only)

CSP_BODY_MAX = 16 * 1024  # a report is well under 2 KB; a batch of the Reporting API a few of them
CSP_BATCH_MAX = 20
CSP_ROWS_MAX = 200  # distinct (disposition, directive, blocked) counters; beyond it everything counts as "other"
CSP_IP_LIMITS: list[tuple[float, int]] = [(60.0, 30)]
CSP_ALL_LIMITS: list[tuple[float, int]] = [(60.0, 300)]
_DIRECTIVE_RE = re.compile(r"^[a-z][a-z-]{0,39}$")
_KEYWORDS = {"inline", "eval", "wasm-eval", "data", "blob", "self", "trusted-types-policy", "trusted-types-sink"}


def _blocked_origin(raw: Any, host: str) -> str:
    """Scheme + host of the blocked resource, `self` for this origin, a CSP keyword as is; never a path or a query."""
    from urllib.parse import urlsplit

    value = str(raw or "").strip()[:500]
    if not value:
        return "none"
    if value.lower() in _KEYWORDS:
        return value.lower()
    if value.endswith(":") and value[:-1].isalpha():
        return value[:-1].lower()[:20]  # data: / blob: / about:
    try:
        u = urlsplit(value)
    except ValueError:
        return "other"
    if not u.scheme or not u.netloc:
        return u.scheme.lower()[:20] or "other"
    try:  # review L3: hostname[:port] only - never the userinfo part of a URL
        where = (u.hostname or "") + (f":{u.port}" if u.port else "")
    except ValueError:
        return "other"
    if not where:
        return "other"
    if where == (host or "").lower():
        return "self"
    return f"{u.scheme.lower()}://{where}"[:100]


def _csp_items(payload: Any, host: str) -> list[tuple[str, str, str]]:
    """(disposition, directive, blocked) of every report in a legacy `application/csp-report` body or a Reporting API
    batch (`application/reports+json`); anything else is ignored."""
    reports: list[dict[str, Any]] = []
    if isinstance(payload, dict) and isinstance(payload.get("csp-report"), dict):
        r = payload["csp-report"]
        reports.append({"disposition": r.get("disposition"), "directive": r.get("effective-directive") or r.get("violated-directive"), "blocked": r.get("blocked-uri")})
    elif isinstance(payload, list):
        for item in payload[:CSP_BATCH_MAX]:
            if isinstance(item, dict) and item.get("type") == "csp-violation" and isinstance(item.get("body"), dict):
                b = item["body"]
                reports.append({"disposition": b.get("disposition"), "directive": b.get("effectiveDirective"), "blocked": b.get("blockedURL")})
    out = []
    for r in reports:
        directive = str(r.get("directive") or "").strip().lower().split(" ")[0]
        out.append(("enforce" if r.get("disposition") == "enforce" else "report", directive if _DIRECTIVE_RE.match(directive) else "other",
                    _blocked_origin(r.get("blocked"), host)))
    return out


def _count_csp(db, items: list[tuple[str, str, str]]) -> None:
    with db.connection(label="csp-report") as conn:
        now = now_iso()
        for disposition, directive, blocked in items:
            known = conn.execute("SELECT 1 FROM csp_reports WHERE disposition = ? AND directive = ? AND blocked = ?", (disposition, directive, blocked)).fetchone()
            if not known and conn.execute("SELECT COUNT(*) FROM csp_reports").fetchone()[0] >= CSP_ROWS_MAX:
                directive, blocked = "other", "other"
            conn.execute(
                """INSERT INTO csp_reports(disposition, directive, blocked, count, first_at, last_at) VALUES (?, ?, ?, 1, ?, ?)
                   ON CONFLICT(disposition, directive, blocked) DO UPDATE SET count = count + 1, last_at = excluded.last_at""",
                (disposition, directive, blocked, now, now))


@router.post("/csp-report", status_code=204)
async def csp_report(request: Request) -> Response:
    """The browsers' CSP violation reports for the remote channel (Reporting API `report-to` and the older `report-uri`).
    Unauthenticated by nature (a report is posted by the browser itself), so: remote channel only, rate-limited per
    address and in total, the body bounded while it streams, at most 20 reports a batch, and nothing kept but counters
    per disposition, directive and blocked origin (no page URL, no sample, no path)."""
    _remote_only(request)
    if not hua.LIMITER.hit(f"csp:{hua.limit_ip(hua.client_ip(request))}", CSP_IP_LIMITS) or not hua.LIMITER.hit("csp:*", CSP_ALL_LIMITS):
        raise ApiError(429, "rate_limited", "יותר מדי דיווחים.", retryable=True)
    ctype = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    if ctype not in ("application/csp-report", "application/reports+json", "application/json"):
        raise ApiError(415, "unsupported_media_type", "סוג תוכן לא נתמך.")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > CSP_BODY_MAX:
            raise ApiError(413, "too_large", "הדיווח גדול מדי.")
    import json as _json

    try:
        payload = _json.loads(bytes(body) or b"null")
    except ValueError:
        raise ApiError(400, "bad_request", "דיווח לא תקין.")
    items = _csp_items(payload, request.headers.get("host") or "")
    if items:
        await run_in_threadpool(_count_csp, request.app.state.db, items)
    return Response(status_code=204)


@router.get("/csp-reports")
def list_csp_reports(principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """הגדרות › גישה מרחוק: the counters, the mode and both policies, for the owner's review before enforcing."""
    from ..remote_channel import CSP, CSP_STRICT, csp_enforcing

    require(conn, principal, "system.configure", INSTALLATION)
    rows = [dict(r) for r in conn.execute("SELECT disposition, directive, blocked, count, first_at, last_at FROM csp_reports ORDER BY count DESC, last_at DESC").fetchall()]
    return {"mode": "enforce" if csp_enforcing() else "report_only", "rows": rows, "total": sum(r["count"] for r in rows),
            "policy": {"enforced": CSP_STRICT if csp_enforcing() else CSP, "report_only": None if csp_enforcing() else CSP_STRICT}}


@router.delete("/csp-reports")
def clear_csp_reports(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    require(conn, principal, "system.configure", INSTALLATION)
    n = conn.execute("DELETE FROM csp_reports").rowcount
    audit(conn, actor=principal, action="remote.csp_reports_cleared", decision="allowed", resource_type="installation", resource_id="*",
          request_id=getattr(request.state, "correlation_id", None), details={"rows": n})
    return {"cleared": n}
