"""APPREFRESH-295 slice 1: the phone app's persistent sign-in (docs/changes/CR-APPREFRESH295.md; service: services/app_refresh.py).

Session routes (a signed-in user; the Arx cookie on the remote channel - `Origin` required by the channel's CSRF rule - or the Ingress
identity locally):
  POST   /auth/app/refresh-tokens            mint a family for the caller's own device registration {device_id, install_id} (201, the
                                             refresh + access token shown ONCE). The remote channel only (security review F-02;
                                             404 on the local channel), from a sign-in <= 15 minutes old.
  GET    /auth/app/families[?user_id=]       the caller's live families (another user's / everyone's: system.configure)
  DELETE /auth/app/families/{family_id}      end one family (its owner, or system.configure)                              -> 204
  DELETE /auth/app/families[?user_id=]       end every family of a user (own, or system.configure) - the lost-phone kill switch
  GET    /auth/app/devices/{id}/key          APPREFRESH3: the device's pinned key status (its user, or system.configure)
  POST   /auth/app/devices/{id}/key-reset    APPREFRESH3: a system administrator approves a device-key reset {reason} (the lost-key path;
                                             own device: local channel only) - audited, the user notified, the old sign-in ended
  DELETE /auth/app/devices/{id}/key-reset    APPREFRESH3: withdraw a pending approval                                    -> 204
  GET    /auth/app/settings, PUT ...         the switch, lifetimes and the key-reset notice wording (a system administrator; ON from the local channel only, OFF from
                                             either channel - OFF ends every family)
Public routes (no cookie, the remote channel only; while the switch is off, or on the local channel, every one answers the same 404
before its body is read - guarded_route, the PUB-07 rule):
  POST   /auth/app/refresh                   {refresh_token, device_id, install_id} -> a rotated refresh token + a new access token
  POST   /auth/app/refresh-challenge         {device_id} -> a single-use nonce for the device-key proof (APPREFRESH2; the same shape
                                             for an unknown device, stored nowhere then)
  POST   /auth/app/sign-out                  {refresh_token} -> 204: the family ends (the app's own sign-out)
  GET    /auth/app/whoami                    `Authorization: Bearer arxa_...` -> who the access token speaks for (slice 1's only consumer)
No route logs, audits or echoes a token; only the two minting answers carry one, to its owner."""
from __future__ import annotations

import time
from typing import Any, Literal

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field

from .. import guarded_route
from ..audit import audit
from ..auth import touch_user
from ..db import Database
from ..errors import ApiError
from ..rbac import INSTALLATION, authorize, is_system_admin, note_grant
from ..remote_channel import is_remote
from ..services import app_refresh as svc
from ..services import ha_user_auth as hua
from .presence import Caller, session_caller

router = APIRouter()

CONFIGURE = "system.configure"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _db(request: Request) -> Database:
    return request.app.state.db


def _not_found() -> ApiError:
    return ApiError(404, "not_found", svc.NOT_FOUND_HE)


def _public_guard(request: Request) -> None:
    """The public routes exist only on the remote channel and only while the switch is on: otherwise the same 404 whatever the body."""
    if not is_remote(request) or not svc.enabled_db(_db(request)):
        raise _not_found()


def _client_key(request: Request) -> str:
    return "ip:" + (hua.limit_ip(hua.client_ip(request)) or "?")  # an IPv6 caller counts as its /64 (review 2.4.2 L4)


def _too_many() -> ApiError:
    return ApiError(429, "rate_limited", svc.RATE_HE, retryable=True, details={"retry_after_s": 60})


def _anchor(request: Request, caller: Caller) -> tuple[str, str, float | None]:
    """(anchor kind, anchor hash, sign-in age in seconds or None) of the session the family is minted from."""
    p = caller.principal
    s = hua.session_of(request)
    if p.source == "local" and s is not None and getattr(s, "chain_id", None):
        started = float(getattr(s, "chain_started_at", 0.0) or 0.0)
        return "local", svc.local_anchor(s.chain_id), (time.time() - started if started else None)
    if p.source == "remote" and s is not None:
        started = float(getattr(s, "chain_started", 0.0) or getattr(s, "created_at", 0.0) or 0.0)
        return ("ha" if s.iss_hash else "none"), (s.iss_hash or ""), (time.time() - started if started else None)
    if p.source in ("ingress", "dev"):
        return p.source, "", None
    return "none", "", None


# ---------------------------------------------------------------- models

class MintProofIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ts: int
    sig: str = Field(min_length=1, max_length=120)


class ReplaceProofIn(BaseModel):
    """Security review D-01 (b): the OLD key's signature that hands the device's keyed sign-in to the new key (spec section 6)."""
    model_config = ConfigDict(extra="forbid")

    nonce: str = Field(min_length=1, max_length=100)
    ts: int
    sig: str = Field(min_length=1, max_length=120)


class DeviceKeyIn(BaseModel):
    """APPREFRESH2: the public half of the app's hardware key (docs/changes/APPREFRESH-DEVICEKEY-SPEC.md section 3)."""
    model_config = ConfigDict(extra="forbid")

    alg: Literal["ES256"]
    public_key: str = Field(min_length=40, max_length=200)
    proof: MintProofIn
    replaces: ReplaceProofIn | None = None


class IssueIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(min_length=4, max_length=64)
    install_id: str = Field(min_length=8, max_length=64)
    device_key: DeviceKeyIn | None = None


class ProofIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nonce: str = Field(min_length=1, max_length=100)
    ts: int
    sig: str = Field(min_length=1, max_length=120)


class RefreshIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(min_length=1, max_length=200)
    device_id: str = Field(min_length=4, max_length=64)
    install_id: str = Field(min_length=8, max_length=64)
    proof: ProofIn | None = None


class ChallengeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(min_length=4, max_length=64)


class SignOutIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(min_length=1, max_length=200)


# ---------------------------------------------------------------- minting (session)

@router.post("/auth/app/refresh-tokens", status_code=201)
def issue(body: IssueIn, request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    # Security review F-02 (owner: the safer choice): a family is minted on the remote channel only - from a remote sign-in Arx can see,
    # anchor and end. The local channel (Ingress, developer) never mints: the same 404 as the public routes there.
    if not is_remote(request) or not svc.enabled_db(_db(request)):
        raise _not_found()
    kind, anchor, age = _anchor(request, caller)
    with _db(request).connection(label="app_refresh.issue") as conn:
        touch_user(conn, caller.principal)
        if age is None or age > svc.FRESH_SIGN_IN_S:
            audit(conn, actor=caller.principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=body.device_id,
                  reason="sign_in_not_fresh", request_id=_rid(request))
            raise ApiError(403, "fresh_sign_in_required", svc.FRESH_HE)
        return svc.issue(conn, caller.principal, body.device_id, body.install_id, anchor_kind=kind, anchor_hash=anchor,
                         channel="remote", request_id=_rid(request), device_key=body.device_key.model_dump() if body.device_key else None)


# ---------------------------------------------------------------- the public routes

@guarded_route.post(router, _public_guard, "/auth/app/refresh")
def refresh(body: RefreshIn, request: Request) -> dict[str, Any]:
    key = _client_key(request)
    if svc.client_blocked(key):
        raise _too_many()
    db = _db(request)
    fam_id, live = svc.peek(db, body.refresh_token)  # an unknown token never takes the write gate
    if not live and svc.global_blocked():  # F-07: the global tier never stops a token of a live family
        raise _too_many()
    if fam_id is None:
        svc.failed(key)
        raise ApiError(401, "app_refresh_invalid", svc.INVALID_HE)
    if not svc.take("app_refresh.refresh", fam_id, svc.RATE_REFRESH):
        raise ApiError(429, "rate_limited", svc.RATE_HE, retryable=True, details={"retry_after_s": 60})
    with db.connection(label="app_refresh.refresh") as conn:
        try:
            return svc.refresh(conn, body.refresh_token, body.device_id, body.install_id, _rid(request),
                               proof=body.proof.model_dump() if body.proof else None)
        except svc.Refused:
            svc.failed(key)
            raise  # an ApiError: the connection commits (the family's end, a consumed nonce and the audit row are kept)


@guarded_route.post(router, _public_guard, "/auth/app/refresh-challenge")
def refresh_challenge(body: ChallengeIn, request: Request) -> dict[str, Any]:
    """APPREFRESH2: a single-use nonce (NONCE_TTL_S) for the next device-key proof of this device's family. The same answer shape for an
    unknown device (a nonce stored nowhere); an unknown device counts on the client's failure tier, a known one on its family bucket."""
    key = _client_key(request)
    if svc.client_blocked(key):
        raise _too_many()
    db = _db(request)
    fam_id = svc.peek_device_family(db, body.device_id)
    if fam_id is None:
        if svc.global_blocked():
            raise _too_many()
        svc.failed(key)
        return svc.unstored_challenge()  # the same shape, stored nowhere, no write gate
    # Security review D-02: the bucket is per (family, client /64) - another caller who knows the device id never empties the phone's -
    # and a per-family ceiling far above an app's need catches a storm from many addresses
    if not svc.take("app_refresh.challenge", f"{fam_id}|{key}", svc.RATE_CHALLENGE):
        raise _too_many()
    if not svc.take("app_refresh.challenge_family", fam_id, svc.RATE_CHALLENGE_FAMILY):
        raise _too_many()
    with db.connection(label="app_refresh.challenge") as conn:
        return svc.challenge(conn, body.device_id)[0]


@guarded_route.post(router, _public_guard, "/auth/app/sign-out", status_code=204)
def sign_out(body: SignOutIn, request: Request) -> Response:
    key = _client_key(request)
    if svc.client_blocked(key):
        raise _too_many()
    db = _db(request)
    fam_id, live = svc.peek(db, body.refresh_token)
    if not live:
        if svc.global_blocked():
            raise _too_many()
        if fam_id is None:
            svc.failed(key)
        return Response(status_code=204)  # the same answer: nothing to end
    with db.connection(label="app_refresh.sign_out") as conn:
        if svc.sign_out(conn, body.refresh_token, _rid(request)) == "reuse":  # F-03: an old token is a reuse, never a sign-out
            svc.failed(key)
    return Response(status_code=204)


@router.get("/auth/app/whoami")
def whoami(request: Request) -> dict[str, Any]:
    _public_guard(request)
    key = _client_key(request)
    if svc.client_blocked(key):
        raise _too_many()
    token = hua.bearer_of(request)
    with _db(request).connection(mode="read", label="app_refresh.whoami") as conn:
        found = svc.resolve_access(conn, token) if token else None
    if found is None:
        if svc.global_blocked():
            raise _too_many()
        svc.failed(key)
        raise ApiError(401, "app_access_invalid", svc.INVALID_HE)
    return found


# ---------------------------------------------------------------- manage (session)

def _may_manage(conn, caller: Caller, target_user: str | None, request: Request) -> None:
    if target_user == caller.principal.user_id:
        return
    d = authorize(conn, caller.principal, CONFIGURE, INSTALLATION)
    if d.allowed:
        note_grant(d, CONFIGURE)
        return
    audit(conn, actor=caller.principal, action="auth.app_refresh.manage", decision="denied", resource_type="user", resource_id=target_user or "*",
          reason="no_binding", request_id=_rid(request))
    raise ApiError(403, "forbidden", "אין הרשאה.", details={"permission": CONFIGURE})


@router.get("/auth/app/families")
def families(request: Request, caller: Caller = Depends(session_caller), user_id: str | None = Query(None, max_length=200), all: bool = False) -> dict[str, Any]:
    target = None if all else (user_id or caller.principal.user_id)
    with _db(request).connection(mode="read", label="app_refresh.families") as conn:
        touch_user(conn, caller.principal)
        _may_manage(conn, caller, target, request)
        return {"families": svc.list_families(conn, target), "enabled": svc.enabled(conn)}


@router.delete("/auth/app/families/{family_id}", status_code=204)
def end_family(family_id: str, request: Request, caller: Caller = Depends(session_caller)) -> Response:
    with _db(request).connection(label="app_refresh.end") as conn:
        touch_user(conn, caller.principal)
        fam = svc.family(conn, family_id[:64])
        if fam is None or fam["revoked_at"]:
            raise ApiError(404, "not_found", "הכניסה לא נמצאה.")
        _may_manage(conn, caller, fam["user_id"], request)
        reason = "revoked_by_user" if fam["user_id"] == caller.principal.user_id else "revoked_by_admin"
        svc.revoke_family(conn, fam["family_id"], reason, actor=caller.principal, request_id=_rid(request), subject=fam["user_id"])
        svc.release_pins(conn, [fam["device_id"]], reason, actor=caller.principal, request_id=_rid(request))  # Q296: only the user's own end
    return Response(status_code=204)


@router.delete("/auth/app/families")
def end_families(request: Request, caller: Caller = Depends(session_caller), user_id: str | None = Query(None, max_length=200)) -> dict[str, Any]:
    target = user_id or caller.principal.user_id
    with _db(request).connection(label="app_refresh.end_all") as conn:
        touch_user(conn, caller.principal)
        _may_manage(conn, caller, target, request)
        reason = "signed_out_everywhere" if target == caller.principal.user_id else "revoked_all_by_admin"
        devices = [r["device_id"] for r in conn.execute("SELECT device_id FROM app_refresh_families WHERE user_id = ? AND revoked_at IS NULL", (target,)).fetchall()]
        n = svc.revoke_user(conn, target, reason, actor=caller.principal, request_id=_rid(request))
        svc.release_pins(conn, devices, reason, actor=caller.principal, request_id=_rid(request))  # Q296: only the user's own end
    return {"families_ended": n}


# ---------------------------------------------------------------- the device-key pin and its reset (APPREFRESH3-295, CR section 14)

class KeyResetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=400)


def _device_owner(conn, device_id: str) -> str | None:
    r = conn.execute("SELECT user_id FROM mobile_devices WHERE id = ?", (device_id[:64],)).fetchone()
    return r["user_id"] if r else None


@router.get("/auth/app/devices/{device_id}/key")
def device_key(device_id: str, request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    """The device's pinned key status (never the key; a 16-hex fingerprint prefix): its user, or system.configure."""
    with _db(request).connection(mode="read", label="app_refresh.device_key") as conn:
        touch_user(conn, caller.principal)
        owner = _device_owner(conn, device_id)
        if owner is None:
            raise ApiError(404, "not_found", svc.DEVICE_HE)
        _may_manage(conn, caller, owner, request)
        return svc.key_status(conn, device_id[:64])


@router.post("/auth/app/devices/{device_id}/key-reset")
def approve_key_reset(device_id: str, body: KeyResetIn, request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    """A system administrator approves a device-key reset (the lost-key path): audited, the user notified, the old sign-in ended."""
    remote = is_remote(request)
    with _db(request).connection(label="app_refresh.key_reset") as conn:
        touch_user(conn, caller.principal)
        _require_admin(conn, caller, request, "auth.app_refresh.key_reset_approved")
        if not svc.take("app_refresh.settings", "*", svc.RATE_SETTINGS):
            raise ApiError(429, "rate_limited", svc.RATE_HE, retryable=True)
        return svc.approve_key_reset(conn, caller.principal, device_id[:64], body.reason, channel="remote" if remote else "local", request_id=_rid(request))


@router.delete("/auth/app/devices/{device_id}/key-reset", status_code=204)
def withdraw_key_reset(device_id: str, request: Request, caller: Caller = Depends(session_caller)) -> Response:
    """A system administrator withdraws a pending reset approval (the pin holds again)."""
    with _db(request).connection(label="app_refresh.key_reset_withdraw") as conn:
        touch_user(conn, caller.principal)
        _require_admin(conn, caller, request, "auth.app_refresh.key_reset_withdrawn")
        if not svc.withdraw_key_reset(conn, caller.principal, device_id[:64], channel="remote" if is_remote(request) else "local", request_id=_rid(request)):
            raise ApiError(404, "not_found", "אין איפוס ממתין למכשיר הזה.")
    return Response(status_code=204)


# ---------------------------------------------------------------- settings (a system administrator)

def _require_admin(conn, caller: Caller, request: Request, action: str) -> None:
    if not is_system_admin(conn, caller.principal.user_id):
        audit(conn, actor=caller.principal, action=action, decision="denied", resource_type="installation", resource_id="app_refresh",
              reason="not_system_admin", request_id=_rid(request))
        raise ApiError(403, "forbidden", "רק מנהל מערכת יכול לשנות את הכניסה השמורה באפליקציה.")


@router.get("/auth/app/settings")
def get_settings(request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    with _db(request).connection(mode="read", label="app_refresh.settings") as conn:
        touch_user(conn, caller.principal)
        _require_admin(conn, caller, request, "auth.app_refresh.settings")
        return {"settings": svc.settings_out(conn)}


@router.put("/auth/app/settings")
def put_settings(request: Request, body: dict[str, Any] = Body(...), caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    remote = is_remote(request)
    with _db(request).connection(label="app_refresh.settings.update") as conn:
        touch_user(conn, caller.principal)
        _require_admin(conn, caller, request, "auth.app_refresh.settings")
        if not svc.take("app_refresh.settings", "*", svc.RATE_SETTINGS):
            raise ApiError(429, "rate_limited", svc.RATE_HE, retryable=True)
        if remote and body.get(svc.FEATURE_KEY) == "on" and not svc.enabled(conn):
            audit(conn, actor=caller.principal, action="auth.app_refresh.feature_enabled", decision="denied", resource_type="installation",
                  resource_id="app_refresh", reason="local_channel_only", request_id=_rid(request))
            raise ApiError(403, "local_channel_only", "את הכניסה השמורה באפליקציה מפעילים רק מתוך הרשת המקומית.")
        wanted = body.get(svc.DEVICE_KEY_KEY)
        if remote and wanted in svc.DEVICE_KEY_MODES and svc.mode_rank(wanted) < svc.mode_rank(svc.device_key_mode(conn)):
            # APPREFRESH2: weakening the device-key mode is a local-channel act (like switching the feature on); raising it works anywhere
            audit(conn, actor=caller.principal, action="auth.app_refresh.settings", decision="denied", resource_type="installation",
                  resource_id="app_refresh", reason="local_channel_only", request_id=_rid(request), details={svc.DEVICE_KEY_KEY: wanted})
            raise ApiError(403, "local_channel_only", "את דרישת מפתח המכשיר מחלישים רק מתוך הרשת המקומית.")
        st, _, ended = svc.update_settings(conn, body, caller.principal, channel="remote" if remote else "local", request_id=_rid(request))
    return {"settings": st, "families_ended": ended}
