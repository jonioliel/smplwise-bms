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
  GET    /auth/app/whoami                    `Authorization: Bearer arxa_...` -> who the access token speaks for
  POST   /auth/app/session                   SESSIONEXCH2-295 (spec APPREFRESH-SESSION-EXCHANGE-SPEC revision 3; also needs
                                             `security.app_session_exchange` = on): `Authorization: Bearer arxa_...` + {device_id,
                                             install_id, proof} -> a ONE-TIME code (60 s, single use) for the WebView
  GET    /auth/app/session/redeem?code=      SESSIONEXCH2-295: the WebView's top-level navigation; spends the code and answers 303 with
                                             the Arx session cookie set by the server (or 303 to `?app_session=failed`, no cookie)
No route logs, audits or echoes a token; only the two minting answers carry one, to its owner."""
from __future__ import annotations

import time
from typing import Any, Literal

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from .. import guarded_route
from ..audit import audit
from ..auth import settings_of, touch_user
from ..db import Database
from ..errors import ApiError
from ..rbac import INSTALLATION, authorize, is_system_admin, note_grant
from ..remote_channel import is_remote
from ..services import app_refresh as svc
from ..services import app_session as xs
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
        kind, anchor = svc.remote_anchor(s)  # REL2140 M-4: the HA sign-in, else this session's own sign-in - never "none"
        return kind, anchor, (time.time() - started if started else None)
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


class AttestationIn(BaseModel):
    """ATTEST232: hardware attestation of the device key (docs/changes/CR-ATTEST232.md section 4). `data` is the certificate chain (Android,
    leaf first, base64 DER) or the attestation object (iOS); its contents are judged by the verifier, never here."""
    model_config = ConfigDict(extra="forbid")

    format: Literal["android_key_attestation", "ios_app_attest"]
    data: list[str] = Field(min_length=1, max_length=8)


class DeviceKeyIn(BaseModel):
    """APPREFRESH2: the public half of the app's hardware key (docs/changes/APPREFRESH-DEVICEKEY-SPEC.md section 3)."""
    model_config = ConfigDict(extra="forbid")

    alg: Literal["ES256"]
    public_key: str = Field(min_length=40, max_length=200)
    proof: MintProofIn
    replaces: ReplaceProofIn | None = None
    attestation: AttestationIn | None = None


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
    s = hua.session_of(request)
    if xs.is_app_session(s):
        # SESSIONEXCH2 / review S-01: a web session made by the exchange never mints (nor anchors) a family - refused before the pin, the
        # replace logic and revoke_device run, so the phone's live family is untouched
        with _db(request).connection(label="app_refresh.issue") as conn:
            audit(conn, actor=caller.principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=body.device_id,
                  reason="sign_in_not_anchorable", request_id=_rid(request), details={"anchor": "web_session"})
        raise ApiError(403, "sign_in_not_anchorable", svc.INVALID_HE)
    kind, anchor, age = _anchor(request, caller)
    ha_user = getattr(s, "ha_user", None)
    ha_mfa = bool(ha_user.mfa) if ha_user is not None and caller.principal.source == "remote" else None
    factor = caller.principal.source == "local" and caller.principal.factor_ok
    with _db(request).connection(label="app_refresh.issue") as conn:
        touch_user(conn, caller.principal)
        if age is None or age > svc.FRESH_SIGN_IN_S:
            audit(conn, actor=caller.principal, action="auth.app_refresh.issue", decision="denied", resource_type="mobile_device", resource_id=body.device_id,
                  reason="sign_in_not_fresh", request_id=_rid(request))
            raise ApiError(403, "fresh_sign_in_required", svc.FRESH_HE)
        return svc.issue(conn, caller.principal, body.device_id, body.install_id, anchor_kind=kind, anchor_hash=anchor,
                         channel="remote", request_id=_rid(request), device_key=body.device_key.model_dump() if body.device_key else None,
                         ha_mfa=ha_mfa, factor=factor)


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


# ---------------------------------------------------------------- SESSIONEXCH2-295: the WebView session through a one-time code

def _session_guard(request: Request) -> None:
    """Both switches and the remote channel, else the same 404 whatever the body (PUB-07)."""
    if not is_remote(request) or not xs.enabled_db(_db(request)):
        raise _not_found()


def _origin(request: Request) -> str:
    return hua.arx_client_id(settings_of(request), request)  # `<scheme>://<host><remote_path>/` - what the code is bound to


class SessionProofIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nonce: str = Field(min_length=1, max_length=100)
    ts: StrictInt  # review D-08 / S-11: a strict JSON integer on this route
    sig: str = Field(min_length=1, max_length=120)


class SessionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    device_id: str = Field(pattern=r"^dev_[0-9a-f]{16}$")  # review D-07 / S-15
    install_id: str = Field(min_length=8, max_length=64)
    proof: SessionProofIn | None = None  # absent for a keyed family = a theft signal: the service ends the family (spec 5 step 7)


@guarded_route.post(router, _session_guard, "/auth/app/session")
def session_exchange(body: SessionIn, request: Request) -> dict[str, Any]:
    """The exchange (spec section 5): authenticated by the bearer access token ONLY - the route never reads, touches, rotates or ends a
    cookie (review S-06; a POST carrying the session cookie without its origin never gets here: the channel answers 403 csrf_refused)."""
    key = _client_key(request)
    if svc.client_blocked(key):
        raise _too_many()
    db = _db(request)
    token = hua.bearer_of(request) or ""
    fam_id, live = xs.peek_access(db, token)  # an unknown token never takes the write gate
    if not live and svc.global_blocked():
        raise _too_many()
    if fam_id is None or not live:
        svc.failed(key)
        raise ApiError(401, "app_access_invalid", svc.INVALID_HE)
    if not svc.take("app_session.exchange", fam_id, xs.RATE_EXCHANGE):
        raise _too_many()
    with db.connection(label="app_session.exchange") as conn:
        try:
            return xs.exchange(conn, token, body.device_id, body.install_id, body.proof.model_dump() if body.proof else None, origin=_origin(request),
                               remote_path=settings_of(request).remote_path, request_id=_rid(request), meta=hua.request_meta(request))
        except ApiError:
            svc.failed(key)
            raise  # the connection commits (an ended family, a consumed nonce and the audit row are kept)


CROSS_SITE = ("cross-site", "same-site")


@router.get("/auth/app/session/redeem")
def session_redeem(request: Request, code: str = Query("", max_length=100)) -> Response:
    """The WebView's top-level navigation (spec section 5a). 303 to the web app with the server-set cookie, or 303 to
    `?app_session=failed` without one (the reason is audited, never in the URL)."""
    _session_guard(request)
    settings = settings_of(request)
    home = settings.remote_path + "/"
    headers = {"Cache-Control": "no-store"}  # the remote channel adds its own security headers (Referrer-Policy: same-origin)
    key = _client_key(request)
    if svc.client_blocked(key):
        raise _too_many()
    failed = Response(status_code=303, headers={**headers, "Location": home + "?app_session=failed"})
    site = (request.headers.get("sec-fetch-site") or "").lower()
    if site in CROSS_SITE:  # login CSRF / session fixation from another page
        svc.failed(key)
        # SX-27: audited (`auth.app_session.redeem` denied, reason `cross_site`); the answer and the code's state are unchanged
        with _db(request).connection(label="app_session.redeem_cross_site") as conn:
            xs.refuse_cross_site(conn, code, site=site, request_id=_rid(request), meta=hua.request_meta(request))
        return failed
    # X4 F-1: fix 2 - only the app's own navigation carries the marker header (a link from SMS / mail / another app cannot); fix 1 - a
    # browser that already holds ANOTHER user's live Arx session is never switched to this code's user. Both refuse after the spend.
    marker_ok = xs.redeem_marker_ok(request.headers.getlist("x-correlation-id"))
    with _db(request).connection(label="app_session.redeem") as conn:
        out = xs.redeem(conn, code, origin=_origin(request), meta=hua.request_meta(request), request_id=_rid(request), marker_ok=marker_ok,
                        current_user=xs.cookie_user(conn, settings, request))
    if not out.ok:
        if out.count_failure:
            svc.failed(key)
        return failed
    from ..services import local_identity as li

    name = hua.cookie_name(settings, request)
    max_age = max(1, int(out.expires_at - svc._now()))
    response = Response(status_code=303, headers={**headers, "Location": home})
    response.headers.append("set-cookie", li.cookie_header(name, out.cookie_value, home, secure=name == hua.COOKIE_SECURE, max_age=max_age))
    return response


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


@router.get("/auth/app/devices/{device_id}/attestation")
def device_attestation(device_id: str, request: Request, caller: Caller = Depends(session_caller)) -> dict[str, Any]:
    """ATTEST232: the last hardware-attestation verdict of the device (never the chain): its user, or system.configure."""
    with _db(request).connection(mode="read", label="app_refresh.attestation") as conn:
        touch_user(conn, caller.principal)
        owner = _device_owner(conn, device_id)
        if owner is None:
            raise ApiError(404, "not_found", svc.DEVICE_HE)
        _may_manage(conn, caller, owner, request)
        return svc.attestation_status(conn, device_id[:64])


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


def _attestation_weakened(conn, body: dict[str, Any]) -> bool:
    mode, level, roots = body.get(svc.ATTEST_MODE_KEY), body.get(svc.ATTEST_LEVEL_KEY), body.get(svc.ATTEST_ROOTS_KEY)
    if mode in svc.ATTEST_MODES and svc.attest_mode_rank(mode) < svc.attest_mode_rank(svc.attest_mode(conn)):
        return True
    if level in svc.att.LEVELS and svc.att.level_rank(level) < svc.att.level_rank(svc.attest_min_level(conn)):
        return True
    return svc.ATTEST_ROOTS_KEY in body and roots != svc.attest_roots(conn) and svc.clean_roots(roots) != svc.attest_roots(conn)


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
        if remote and body.get(xs.FEATURE_KEY) == "on" and xs.mode(conn) != "on":
            # SESSIONEXCH2: switching the WebView session exchange on is a local-channel act (like the saved sign-in itself); off works anywhere
            audit(conn, actor=caller.principal, action="auth.app_session.feature_enabled", decision="denied", resource_type="installation",
                  resource_id="app_session", reason="local_channel_only", request_id=_rid(request))
            raise ApiError(403, "local_channel_only", "את חיבור מסך האפליקציה מפעילים רק מתוך הרשת המקומית.")
        wanted = body.get(svc.DEVICE_KEY_KEY)
        if remote and _attestation_weakened(conn, body):
            # ATTEST232: lowering the attestation mode or minimum level, or replacing the trust roots, is a local-channel act
            audit(conn, actor=caller.principal, action="auth.app_refresh.settings", decision="denied", resource_type="installation",
                  resource_id="app_refresh", reason="local_channel_only", request_id=_rid(request), details={"attestation": True})
            raise ApiError(403, "local_channel_only", "את דרישת אימות החומרה מחלישים או משנים רק מתוך הרשת המקומית.")
        if remote and wanted in svc.DEVICE_KEY_MODES and svc.mode_rank(wanted) < svc.mode_rank(svc.device_key_mode(conn)):
            # APPREFRESH2: weakening the device-key mode is a local-channel act (like switching the feature on); raising it works anywhere
            audit(conn, actor=caller.principal, action="auth.app_refresh.settings", decision="denied", resource_type="installation",
                  resource_id="app_refresh", reason="local_channel_only", request_id=_rid(request), details={svc.DEVICE_KEY_KEY: wanted})
            raise ApiError(403, "local_channel_only", "את דרישת מפתח המכשיר מחלישים רק מתוך הרשת המקומית.")
        st, _, ended = svc.update_settings(conn, body, caller.principal, channel="remote" if remote else "local", request_id=_rid(request))
    return {"settings": st, "families_ended": ended}
