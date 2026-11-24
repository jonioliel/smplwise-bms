"""MFA-DEVICEKEY-2490 (MFA-STEPUP-TRAIN-2490 slice 8): the phone key of the Android app (services/device_keys.py).

`POST   auth/device-keys/challenge {purpose, key_id?, action?}`  self: a challenge to sign - `register` (a new key's proof of possession)
                                                                 or `step_up` (answered by `POST auth/step-up/verify {method:
                                                                 "device_key", challenge_id, key_id, signature, action?}`)
`POST   auth/device-keys/sign-in/challenge {key_id}`             PUBLIC: a challenge for the sign-in factor (owner Q51); the signed
                                                                 answer goes in `X-Arx-Second-Factor: dk1:<challenge_id>:<signature>`
                                                                 (or the Arx-only second step's `code`). Always the same answer shape,
                                                                 whether the key exists or not.
`POST   auth/device-keys {challenge_id, public_key, signature, label, auth_kind, attestation?}`  self: register the key that signed
                                                                 the `register` challenge. On the remote channel a user who already
                                                                 has a step-up method needs a fresh step-up proof first (403
                                                                 `step_up_required`, action `auth.device_key.register`): a stolen
                                                                 cookie alone cannot enrol the thief's phone (design 4.4).
`GET    auth/device-keys`                                        self: the caller's active keys (no key material) and the setting
`DELETE auth/device-keys/{key_id}`                               self: revoke one key; on the remote channel a fresh step-up proof
                                                                 (action `auth.device_key.revoke`): removing a factor must not let a
                                                                 stolen session switch step-up off for its user.

Audit rows: `auth.device_key.registered` / `.revoked` / `.refused` (key id, 16-hex fingerprint prefix, auth kind; never a nonce, a
signature or a key). Rate limits per user (challenges, registration) and per address (the public sign-in challenge). Errors use the
project's ApiError envelope, like the authenticator-code routes. Attestation (owner Q52, slice 9 MFA-DEVICEKEY-ATTEST-2490): the
`attestation` field is the Keystore certificate chain of the new key; `device_keys.check_attestation` judges it offline
(services/device_key_attestation.py) by `security.device_key_attestation` - under `required` a key that is not hardware-attested is
refused (422 `device_key_attestation_required`, audited `auth.device_key.refused`)."""
from __future__ import annotations

import json
import sqlite3
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field

from .. import guarded_route
from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn, settings_of
from ..errors import ApiError
from ..rbac import Principal
from ..remote_channel import is_remote
from ..services import device_attestation as da
from ..services import device_key_attestation as dka
from ..services import device_keys as dk
from ..services import ha_user_auth as hua
from ..services import step_up
from ._common import rid as _rid
from ..wire import device_keys as W
from ..wire import wire

router = APIRouter()

CHALLENGE_LIMITS: list[tuple[float, int]] = [(300.0, 20), (3600.0, 60)]  # per user
REGISTER_LIMITS: list[tuple[float, int]] = [(3600.0, 10)]  # per user
REVOKE_LIMITS: list[tuple[float, int]] = [(3600.0, 30)]  # per user
SIGN_IN_LIMITS: list[tuple[float, int]] = [(60.0, 20), (3600.0, 200)]  # per address (public route)
ACTION_PATTERN = r"^[a-z][a-z0-9_.]{0,63}$"
REGISTER_ACTION = "auth.device_key.register"
REVOKE_ACTION = "auth.device_key.revoke"


def _limit(key: str, limits: list[tuple[float, int]]) -> None:
    if not hua.LIMITER.hit(key, limits):
        raise ApiError(429, "rate_limited", hua.RATE_LIMITED_HE, retryable=True)


def _proof_missing(conn: sqlite3.Connection, request: Request, principal: Principal) -> bool:
    """A factor change on the remote channel by a user who already has a step-up method needs a fresh proof in this session (whatever
    `security.step_up` says - like the passkey changes of slice 4). The local channel (Ingress) stays the break-glass path (design T11)."""
    if not is_remote(request) or not step_up.methods_of(conn, principal.user_id):
        return False
    key = step_up.session_key(request, principal)
    return key is None or not step_up._satisfied(conn, request, principal, key)


def _refuse_without_proof(conn: sqlite3.Connection, request: Request, principal: Principal, action: str) -> None:
    audit(conn, actor=principal, action="auth.device_key.refused", decision="denied", resource_type="user", resource_id=principal.user_id,
          reason="step_up_required", request_id=_rid(request), details={"step": action})
    raise step_up.required_error(conn, principal, action)


# ---------------------------------------------------------------- challenges

class ChallengeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    purpose: Literal["register", "step_up"]
    key_id: str | None = Field(default=None, pattern=dk.KEY_ID_PATTERN)  # step_up: the app's key (required)
    action: str | None = Field(default=None, pattern=ACTION_PATTERN)  # step_up: the change the proof is for (signed, audited)


@router.post("/auth/device-keys/challenge", **wire(W.DeviceKeyChallenge))
def challenge(body: ChallengeBody, request: Request, principal: Principal = Depends(current_principal_ro),
              conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    _limit(f"dkch:{principal.user_id}", CHALLENGE_LIMITS)
    session = step_up.session_key(request, principal)
    origin = dk.origin_of(settings_of(request), request)
    if session is None or not origin:
        raise ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    if body.purpose == dk.PURPOSE_STEP_UP:
        if not body.key_id:
            raise ApiError(422, "validation", dk.UNKNOWN_HE, details={"field": "key_id"})
        if not dk.has_active(conn, principal.user_id):
            raise ApiError(409, "step_up_no_method", dk.NO_KEY_HE)
        cid, text, ttl = dk.issue(dk.PURPOSE_STEP_UP, origin, user_id=principal.user_id, key_id=body.key_id, action=body.action, session=session)
    else:
        cid, text, ttl = dk.issue(dk.PURPOSE_REGISTER, origin, user_id=principal.user_id, session=session)
    return {"challenge_id": cid, "purpose": body.purpose, "payload": text, "expires_in": ttl, "auth_kind": dk.auth_setting(conn),
            "allowed_auth_kinds": dk.allowed_kinds(conn), "attestation": dka.mode(conn)}


def _remote_only(request: Request) -> None:
    """The public sign-in challenge exists on the remote channel only (a sign-in with a second factor happens there); the local channel
    answers the uniform 404 before the body is read (guard-first, smplwise/guarded_route.py, review PUB-07)."""
    if not is_remote(request):
        raise ApiError(404, "not_found", "Not found")


class SignInChallengeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key_id: str = Field(pattern=dk.KEY_ID_PATTERN)


@guarded_route.post(router, _remote_only, "/auth/device-keys/sign-in/challenge", **wire(W.DeviceKeySignInChallenge))
def sign_in_challenge(body: SignInChallengeBody, request: Request) -> dict[str, Any]:
    """Public: the sign-in has not happened yet. The answer never says whether the key exists (the check is at the sign-in, after the
    first factor identified the user); a payload carries no user id."""
    _limit(f"dksi:{hua.limit_ip(hua.client_ip(request))}", SIGN_IN_LIMITS)
    origin = dk.origin_of(settings_of(request), request)
    if not origin:
        raise ApiError(400, "bad_request", dk.INVALID_HE)
    cid, text, ttl = dk.issue(dk.PURPOSE_SIGN_IN, origin, key_id=body.key_id)
    return {"challenge_id": cid, "purpose": dk.PURPOSE_SIGN_IN, "payload": text, "expires_in": ttl,
            "answer_prefix": dk.ANSWER_PREFIX, "header": "X-Arx-Second-Factor"}


# ---------------------------------------------------------------- register / list / revoke

def _refusal_details(exc: ApiError) -> dict[str, Any]:
    """Audit details of a refused registration: codes only (never a certificate or key)."""
    d = exc.details if isinstance(exc.details, dict) else {}
    out: dict[str, Any] = {"why": d["reason"]} if "reason" in d else {}
    if exc.code == "device_key_attestation_required":
        out.update({"attested": d.get("attested"), "attestation_why": d.get("why")})
    return out


def _attest_why(row: Any) -> dict[str, Any]:
    """The level / reason code of a recorded verdict for the audit row (from the kept summary)."""
    try:
        kept = json.loads(row["attestation_json"] or "null")
    except (ValueError, TypeError):
        kept = None
    if not isinstance(kept, dict):
        return {}
    return {k: kept[k] for k in ("level", "reason") if kept.get(k)}


class RegisterBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge_id: str = Field(pattern=dk.CHALLENGE_PATTERN)
    public_key: str = Field(min_length=40, max_length=256)  # base64url SPKI DER (Android PublicKey.getEncoded()) or the X9.63 point
    signature: str = Field(min_length=40, max_length=120)  # base64url DER ECDSA-Sig-Value (or raw r||s)
    label: str = Field(default="", max_length=dk.LABEL_MAX)
    auth_kind: Literal["biometric", "biometric_or_screen_lock"]
    # slice 9: the Keystore certificate chain of the new key (leaf first, base64 / base64url DER; KeyStore.getCertificateChain)
    attestation: list[Annotated[str, Field(min_length=1, max_length=da.MAX_ITEM_LEN)]] | None = Field(default=None, max_length=da.MAX_ITEMS)


@router.post("/auth/device-keys", **wire(W.DeviceKeyRow))
def register(body: RegisterBody, request: Request, principal: Principal = Depends(current_principal),
             conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _limit(f"dkreg:{principal.user_id}", REGISTER_LIMITS)
    if _proof_missing(conn, request, principal):
        _refuse_without_proof(conn, request, principal, REGISTER_ACTION)
    try:
        row = dk.register(conn, principal.user_id, challenge_id=body.challenge_id, public_key=body.public_key, signature=body.signature,
                          label=body.label, auth_kind=body.auth_kind, origin=dk.origin_of(settings_of(request), request),
                          session=step_up.session_key(request, principal), attestation=body.attestation)
    except ApiError as exc:
        audit(conn, actor=principal, action="auth.device_key.refused", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason=exc.code, request_id=_rid(request), details={"step": REGISTER_ACTION, **_refusal_details(exc)})
        raise
    audit(conn, actor=principal, action="auth.device_key.registered", decision="allowed", resource_type="device_key", resource_id=row["id"],
          request_id=_rid(request), details={"user_id": principal.user_id, "fp": dk.fingerprint_prefix(row), "auth_kind": row["auth_kind"],
                                             "platform": row["platform"], "attested": dk.attested_of(row),
                                             "attestation_mode": dka.mode(conn), **_attest_why(row)})
    from ..services import notify_sources

    try:
        notify_sources.device_key_added(conn, principal.user_id)  # design 8.3: the user hears of it on every device
    except Exception:  # noqa: BLE001 - a notice never undoes a registration (emit_full rolled its own savepoint back)
        pass
    return dk.view(row, conn)


@router.get("/auth/device-keys", **wire(W.DeviceKeyList))
def list_keys(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    return {"keys": [dk.view(r, conn) for r in dk.active_rows(conn, principal.user_id)], "auth_kind": dk.auth_setting(conn),
            "attestation": dka.mode(conn), "max": dk.MAX_KEYS_PER_USER}


@router.delete("/auth/device-keys/{key_id}", **wire(W.DeviceKeyRevoked))
def revoke(key_id: str, request: Request, principal: Principal = Depends(current_principal),
           conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _limit(f"dkrev:{principal.user_id}", REVOKE_LIMITS)
    if len(key_id) > 40 or dk._active_row(conn, principal.user_id, key_id) is None:
        raise ApiError(404, "device_key_unknown", dk.UNKNOWN_HE)
    if _proof_missing(conn, request, principal):
        _refuse_without_proof(conn, request, principal, REVOKE_ACTION)
    row = dk.revoke(conn, principal.user_id, key_id, by=principal.user_id, reason="self")
    if row is None:  # revoked meanwhile by another request
        raise ApiError(404, "device_key_unknown", dk.UNKNOWN_HE)
    step_up.forget_user(principal.user_id)  # no step-up proof outlives the factor it may have come from
    audit(conn, actor=principal, action="auth.device_key.revoked", decision="allowed", resource_type="device_key", resource_id=row["id"],
          request_id=_rid(request), details={"user_id": principal.user_id, "fp": dk.fingerprint_prefix(row), "by": "self"})
    return {"id": row["id"], "revoked": True}


# ---------------------------------------------------------------- step-up verify (called by routers/second_factor.step_up_verify)

def verify_step_up(conn: sqlite3.Connection, request: Request, principal: Principal, *, challenge_id: str | None, key_id: str | None,
                   signature: str | None, action: str | None) -> dict[str, Any]:
    """`POST auth/step-up/verify {method: "device_key", challenge_id, key_id, signature, action?}`: the signature of a `step_up`
    challenge of this session -> a step-up proof (services/step_up.mark, method `device_key`). Audited `auth.step_up.ok` /
    `auth.step_up.failed` like the authenticator code; the same 400 `second_factor_invalid` / 429 `second_factor_locked` answers."""
    reason = step_up.not_applicable(conn, request, principal)
    if reason == "no_method" or (reason is None and not dk.has_active(conn, principal.user_id)):
        raise ApiError(409, "step_up_no_method", dk.NO_KEY_HE)
    if reason is not None:
        raise ApiError(409, "step_up_not_applicable", step_up.NOT_APPLICABLE_HE, details={"reason": reason})
    session = step_up.session_key(request, principal)
    if session is None:
        raise ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    details = {"method": dk.METHOD, "action": action or ""}
    try:
        row = dk.check(conn, principal.user_id, challenge_id, signature, purpose=dk.PURPOSE_STEP_UP, key_id=key_id,
                       origin=dk.origin_of(settings_of(request), request), session=session, action=action)
    except dk.DeviceKeyError as exc:
        audit(conn, actor=principal, action="auth.step_up.failed", decision="denied", resource_type="user", resource_id=principal.user_id,
              reason=f"step_up_{exc.code}", request_id=_rid(request), details={**details, "why": exc.reason})
        raise ApiError(429 if exc.code == "locked" else 400, f"second_factor_{exc.code}", exc.message, retryable=exc.code == "locked") from None
    until = step_up.mark(conn, request, principal, dk.METHOD)
    audit(conn, actor=principal, action="auth.step_up.ok", decision="allowed", resource_type="user", resource_id=principal.user_id,
          request_id=_rid(request), details={**details, "minutes": step_up.minutes(conn), "key_id": row["id"]})
    return {"method": dk.METHOD, "minutes": step_up.minutes(conn), "valid_until": step_up.iso(until)}
