"""MFA-TOKENS-2490 (slice 6 of the MFA train): the user's own access tokens - My Account › Access tokens.

`GET    auth/tokens`        the caller's own tokens: Home Assistant's list (read-only, asked with the caller's own HA token on the remote
                            channel; HA's long-lived tokens and sign-ins), what Arx saw on the bearer path, and the tokens Arx issued
                            itself (the phone app's saved sign-ins). Any signed-in user; never another user's tokens.
`DELETE auth/tokens/{id}`   revoke ONE token Arx issued (`arf_...`, the caller's own). An HA token (`ha_...`) is refused with 409
                            `token_managed_in_ha` and where to revoke it in Home Assistant: Arx never creates, changes or revokes an HA
                            token or user. Audited either way (`auth.token.revoked` / `auth.token.revoke_refused`).
`DELETE auth/tokens`        revoke every token Arx issued to the caller (the phone app's saved sign-ins). Audited.

Revoking one's own token reduces access, so it is not a step-up action. Administrators keep their existing routes for other users
(`/auth/app/families?user_id=`, the sessions list)."""
from __future__ import annotations

import re
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from starlette.concurrency import run_in_threadpool

from ..audit import audit
from ..auth import current_principal, get_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..remote_channel import is_remote
from ..services import access_tokens as svc
from ..services import ha_user_auth as hua
from ._common import rid as _rid
from ..wire import access_tokens as W
from ..wire import wire

router = APIRouter()

HA_ID_RE = re.compile(r"^ha_[0-9a-f]{20}$")
APP_ID_RE = re.compile(r"^arf_[A-Za-z0-9_-]{4,60}$")


def _who(request: Request) -> Principal:
    """The caller, on a short read connection of its own: the list then asks HA without holding any database connection."""
    from ..auth import _principal

    with request.app.state.db.connection(mode="read", label="GET auth/tokens") as conn:
        return _principal(request, conn)


def _held_ha_token(request: Request, principal: Principal) -> tuple[str | None, str | None]:
    """(the caller's own HA access token this request runs under, or None; why there is none)."""
    if not is_remote(request):
        return None, "local_channel"
    if principal.source == "local":
        return None, "local_user"
    s = hua.session_of(request)
    if s is None or not getattr(s, "token", ""):
        return None, "no_ha_token"  # the phone app's web session holds no HA token
    return s.token, None


def _read(request: Request, principal: Principal) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], bool]:
    from ..services import app_refresh

    with request.app.state.db.connection(mode="read", label="auth/tokens list") as conn:
        seen = svc.seen_rows(conn, principal.user_id)
        apps = svc.app_rows(conn, principal.user_id)
        try:
            enabled = app_refresh.enabled(conn)
        except sqlite3.Error:
            enabled = False
    return seen, apps, enabled


@router.get("/auth/tokens", **wire(W.TokenList))
async def list_tokens(request: Request) -> dict[str, Any]:
    principal = await run_in_threadpool(_who, request)  # identity first: an anonymous caller learns nothing (401)
    token, reason = _held_ha_token(request, principal)
    s = hua.session_of(request)
    current_key = svc.key_of(s) if s is not None else ""  # the HA sign-in this request runs under (the list's "this device")
    listing = await svc.ha_refresh_tokens(settings_of(request), token) if token else None
    if token and listing is None:
        reason = "ha_unavailable"
    seen, apps, enabled = await run_in_threadpool(_read, request, principal)
    if principal.source == "local":
        ha_rows: list[dict[str, Any]] = []
    elif listing is not None:
        ha_rows = svc.ha_rows(listing, seen, current_key)
    else:
        ha_rows = svc.seen_only_rows(seen, current_key)
    return {"ha_listed": listing is not None, "ha_reason": None if listing is not None else reason, "tokens": ha_rows + apps,
            "app_enabled": enabled}


def _refuse_ha(conn: sqlite3.Connection, request: Request, principal: Principal, token_id: str) -> ApiError:
    audit(conn, actor=principal, action="auth.token.revoke_refused", decision="denied", resource_type="token", resource_id=token_id,
          reason="token_managed_in_ha", request_id=_rid(request))
    return ApiError(409, "token_managed_in_ha", svc.TOKEN_READ_ONLY_HE, details={"where": "home_assistant_profile_security"})


def _revoke_family(conn: sqlite3.Connection, request: Request, principal: Principal, family_id: str) -> int:
    from ..services import app_refresh

    fam = app_refresh.family(conn, family_id)
    if fam is None or fam["revoked_at"] or fam["user_id"] != principal.user_id:
        return 0  # another user's family answers exactly like an unknown one
    n = app_refresh.revoke_family(conn, fam["family_id"], "revoked_by_user", actor=principal, request_id=_rid(request), subject=principal.user_id)
    app_refresh.release_pins(conn, [fam["device_id"]], "revoked_by_user", actor=principal, request_id=_rid(request))  # as DELETE auth/app/families/{id}
    return n


@router.delete("/auth/tokens/{token_id}", **wire(W.TokensRevoked))
def revoke_token(token_id: str, request: Request, principal: Principal = Depends(current_principal),
                 conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    if HA_ID_RE.fullmatch(token_id):
        raise _refuse_ha(conn, request, principal, token_id)  # never an HA call: Arx does not revoke HA tokens
    n = _revoke_family(conn, request, principal, token_id) if APP_ID_RE.fullmatch(token_id) else 0
    if not n:
        raise ApiError(404, "token_not_found", svc.NOT_FOUND_HE)
    audit(conn, actor=principal, action="auth.token.revoked", decision="allowed", resource_type="token", resource_id=token_id, reason="revoked_by_user",
          request_id=_rid(request), details={"kind": svc.KIND_APP, "revoked": n})
    return {"revoked": n}


@router.delete("/auth/tokens", **wire(W.TokensRevoked))
def revoke_all_tokens(request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    from ..services import app_refresh

    try:
        devices = [r["device_id"] for r in conn.execute("SELECT device_id FROM app_refresh_families WHERE user_id = ? AND revoked_at IS NULL",
                                                       (principal.user_id,)).fetchall()]
    except sqlite3.OperationalError:  # before migration 0146
        devices = []
    # the reason DELETE auth/app/families uses for the user's own "end them all" (it releases the devices' key pins, owner decision Q296)
    reason = "signed_out_everywhere"
    n = app_refresh.revoke_user(conn, principal.user_id, reason, actor=principal, request_id=_rid(request))
    if devices:
        app_refresh.release_pins(conn, devices, reason, actor=principal, request_id=_rid(request))
    audit(conn, actor=principal, action="auth.token.revoked", decision="allowed", resource_type="user", resource_id=principal.user_id,
          reason=reason, request_id=_rid(request), details={"kind": svc.KIND_APP, "revoked": n})
    return {"revoked": n}
