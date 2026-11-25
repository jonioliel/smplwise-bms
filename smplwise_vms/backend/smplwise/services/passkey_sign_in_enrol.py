"""MFA-RESET-CHANNEL-UI-2520 (docs/changes/MFA-HA-PASSKEY-2520.md open question 4, recommendation a): a home-system user (not an Arx-only
identity) whom a remote sign-in answers "enrol first" (403 `second_factor_enrollment_required`: the sign-in factor policy requires a
factor and the user has none) may register a passkey AS that enrolment, inside the same sign-in - while the owner's switch
`security.passkey_remote_factor` (services/passkey_sign_in) is on. Off (the default) = exactly the behaviour of before.

Why inside the sign-in: a passkey works only at the configured public address (the relying party), and a user under a required
policy gets no remote session there to open My Account in. The enrolment therefore rides on the browser exchange (`POST auth/session`,
services/ha_user_auth.exchange) - the pattern of the passkey sign-in step (services/passkey_sign_in):

* The offer: the 403's `details` gain `passkey_enrol` = {origin, publicKey} - WebAuthn CREATION options for this user (resident key,
  user verification required for an administrative user, the user's existing passkeys excluded). Only the exchange answers it, after
  Home Assistant validated the caller's token for that user (the first factor); no new public route; the exchange's rate limits apply.
* The answer: `X-Arx-Second-Factor: pkr1:<rawId>.<clientDataJSON>.<attestationObject>[.<transports>]` (base64url; transports a
  comma list), at most ANSWER_MAX characters, verified by the same verifier as every passkey registration (services/webauthn
  .verify_registration: the configured origin and RP id - never a request header -, user presence, user verification when required) and
  stored by user_passkeys.store (audited `auth.passkey.registered` with step `sign_in_enrol`, the user notified on every device, the
  user's other remote sign-ins and phone device tokens end as after any first factor). The new passkey counts, so the policy is met and
  the sign-in completes with a fresh step-up proof, as after the code.
* The fresh sign-in rule of adding a factor (MFA-SECFIX-2500 SR-3; MFA-FACTOR-HARDEN-2520 for every factor added from outside): the
  Home Assistant access token must have been issued within step_up.RECENT_SIGN_IN_S (its `iat`, 5 minutes), and the challenge (60 s,
  single use, one open per user) is bound to the user AND to that Home Assistant sign-in (a hash of the token's refresh-token id) - an
  attestation made for one sign-in is refused on another. An older token gets no offer (the answer of before); a late answer is refused.

Not offered (the 403 of before, unchanged): the switch off; `security.passkeys_all_users` off; no public address; an Arx-only identity;
the bearer path (no browser origin); the passkey limit reached; a token older than 5 minutes or without `iat`; an administrator's reset
pending (`must_enroll`: a reset often follows a suspected compromise - that user enrols through the local channel as before, open
question 2 of the change note); Home Assistant's "sign in again" answer of the provenance path (`before_mfa_seen`).

Audit (never a credential id, a public key, a challenge, an attestation or a label): `auth.passkey.registered` (step `sign_in_enrol`)
on success; `auth.second_factor.failed` with method `passkey` and `why` = `enrol_<reason>` (written by ha_user_auth) on a refusal."""
from __future__ import annotations

import hashlib
import logging
import sqlite3
import time
from typing import Any

from ..errors import ApiError
from . import local_passkeys as lpk
from . import second_factor as sf
from . import webauthn as wa

log = logging.getLogger("smplwise.passkey_sign_in_enrol")

METHOD = "passkey"
PURPOSE = "remote_factor"  # the pool of the passkey sign-in step; told apart by the binding (`_bind`)
PREFIX = "pkr1:"
ANSWER_MAX = 8000
STEP = "sign_in_enrol"

INVALID_HE = lpk.REGISTER_FAILED_HE  # "the passkey was not saved, try again" (the registration screen's text)


class EnrolError(sf.SecondFactorError):
    """A refused enrolment answer: `code` `invalid` (the sign-in page keeps the step, as for a wrong code); `reason` for the audit row."""

    def __init__(self, reason: str):
        super().__init__("invalid", INVALID_HE)
        self.reason = reason


def is_answer(text: Any) -> bool:
    return isinstance(text, str) and text.startswith(PREFIX)


def _bind(token: str) -> str:
    """The caller's Home Assistant sign-in (its refresh-token id, else the token) - hashed; distinct from passkey_sign_in._bind."""
    from .ha_user_auth import iss_hash, token_hash

    basis = iss_hash(token) or ("tok:" + token_hash(token))
    return hashlib.sha256(("passkey-remote-enrol|" + basis).encode("utf-8")).hexdigest()[:32]


def token_fresh(token: str | None, now: float | None = None) -> bool:
    """Was this Home Assistant access token issued within step_up.RECENT_SIGN_IN_S (and not in the future)? Its unverified `iat` -
    Home Assistant validated the token itself moments before. No `iat` = not fresh (fail closed)."""
    from .ha_user_auth import _jwt_payload
    from .step_up import RECENT_SIGN_IN_S

    payload = _jwt_payload(token) if token else None
    iat = payload.get("iat") if payload else None
    if not isinstance(iat, (int, float)) or isinstance(iat, bool):
        return False
    age = (time.time() if now is None else now) - float(iat)
    return -60.0 <= age <= RECENT_SIGN_IN_S  # a minute of clock skew either way at most


def eligible(conn: sqlite3.Connection, user_id: str, token: str | None) -> bool:
    """May this enrolment-required sign-in register a passkey as its enrolment? See the module docstring for every condition."""
    from . import factor_reset, passkey_sign_in
    from . import user_passkeys as upk

    if token is None or not passkey_sign_in.enabled(conn):
        return False
    try:
        if upk.is_local_user(conn, user_id) or not upk.all_users_enabled(conn):
            return False
        if lpk.rp(conn) is None or len(lpk.rows(conn, user_id)) >= lpk.MAX_PER_USER:
            return False
        if factor_reset.must_enroll(conn, user_id):
            return False
    except sqlite3.Error:
        return False
    return token_fresh(token)


def offer(conn: sqlite3.Connection, principal: Any, token: str | None) -> dict[str, Any] | None:
    """`details.passkey_enrol` of the 403 `second_factor_enrollment_required`: None (the answer of before) unless `eligible`; then the
    origin a passkey works at and fresh WebAuthn creation options bound to this user and this Home Assistant sign-in."""
    from .local_identity import holds_admin

    uid = principal.user_id
    if not eligible(conn, uid, token):
        return None
    relying = lpk.rp(conn)
    if relying is None or token is None:
        return None
    admin = holds_admin(conn, uid)
    value = lpk._issue(PURPOSE, uid, _bind(token), relying, admin)
    user = conn.execute("SELECT username, display_name FROM users WHERE id = ?", (uid,)).fetchone()
    name = (user["username"] if user is not None else "") or principal.username or principal.display_name or uid
    display = (user["display_name"] if user is not None else "") or principal.display_name or name
    existing = [r for r in lpk.rows(conn, uid) if r["rp_id"] == relying[0]]
    return {"origin": relying[1], "user_verification_required": admin, "publicKey": {
        "rp": {"id": relying[0], "name": lpk.RP_NAME},
        "user": {"id": wa.b64url(lpk.user_handle(uid)), "name": name, "displayName": display},
        "challenge": wa.b64url(value),
        "pubKeyCredParams": [{"type": "public-key", "alg": wa.ALG_ES256}, {"type": "public-key", "alg": wa.ALG_RS256}],
        "timeout": lpk.TIMEOUT_MS,
        "attestation": "none",
        "authenticatorSelection": {"residentKey": "required", "requireResidentKey": True, "userVerification": "required" if admin else "preferred"},
        "excludeCredentials": [{"type": "public-key", "id": r["credential_id"], **({"transports": r["transports"].split(",")} if r["transports"] else {})}
                               for r in existing],
    }}


def parse_answer(text: str) -> dict[str, Any] | None:
    """`pkr1:<rawId>.<clientDataJSON>.<attestationObject>[.<transports>]` -> the credential JSON local_passkeys reads (kind `create`)."""
    if not is_answer(text) or len(text) > ANSWER_MAX:
        return None
    parts = text[len(PREFIX):].split(".")
    if len(parts) not in (3, 4) or not all(parts[:3]):
        return None
    response: dict[str, Any] = {"clientDataJSON": parts[1], "attestationObject": parts[2]}
    if len(parts) == 4 and parts[3]:
        response["transports"] = parts[3].split(",")[:8]
    return {"id": parts[0], "rawId": parts[0], "type": "public-key", "response": response}


def enrol(conn: sqlite3.Connection, principal: Any, answer: str, token: str | None, request_id: str | None = None) -> str:
    """Verify an enrolment answer of this user and store the passkey. Returns the passkey's public id; raises EnrolError(reason).
    The challenge must be this module's challenge of THIS user for THIS Home Assistant sign-in, within 60 s; the sign-in still eligible
    (the switch, the token's freshness, ...); after storing, the passkey must count (else the transaction is the caller's to roll back -
    ha_user_auth runs this on one connection and refuses)."""
    from . import user_passkeys as upk
    from .local_identity import holds_admin

    uid = principal.user_id
    if token is None:
        raise EnrolError("not_offered")  # the bearer path: no browser origin, no offer
    if not eligible(conn, uid, token):
        raise EnrolError("not_offered")
    body = parse_answer(answer)
    if body is None:
        raise EnrolError("malformed")
    try:
        cred = lpk.parse_credential(body, kind="create")
        rec = lpk.take(wa.challenge_of(cred.client_data))
    except wa.WebAuthnError:
        raise EnrolError("malformed") from None
    if rec is None:
        raise EnrolError("challenge_unknown")  # unknown, expired or already used
    if rec.purpose != PURPOSE or rec.bind != _bind(token):
        raise EnrolError("challenge_mismatch")  # another ceremony, or another sign-in
    if rec.user_id != uid:
        raise EnrolError("cross_user")
    if (rec.rp_id, rec.origin) != lpk.rp(conn):
        raise EnrolError("rp_changed")
    try:
        reg = wa.verify_registration(attestation_object=cred.attestation_object or b"", client_data_json=cred.client_data, raw_id=cred.raw_id,
                                     challenge=rec.value, origin=rec.origin, rp_id=rec.rp_id, require_uv=rec.uv_required or holds_admin(conn, uid))
        # a first remote sign-in may come before the user's row exists (it is written once a session starts): the passkey needs it
        from ..auth import touch_user

        touch_user(conn, principal, force=True)
        stored = upk.store(conn, principal, cred, reg, rec.rp_id, None, keep=_Keep(token), request_id=request_id, step=STEP)
    except wa.WebAuthnError as exc:
        raise EnrolError(exc.reason) from None
    except ApiError as exc:  # the passkey limit, reached since the offer
        raise EnrolError(exc.code) from None
    if not upk.counts(conn, uid):
        raise EnrolError("not_counting")  # e.g. the public address changed in between: the caller rolls the row back
    return str(stored["passkey"])


class _Keep:
    """What ha_user_auth.revoke_user_sign_ins keeps: the Home Assistant sign-in of this exchange (no Arx session exists yet)."""

    sid = ""

    def __init__(self, token: str):
        from .ha_user_auth import iss_hash

        self.iss_hash = iss_hash(token)
