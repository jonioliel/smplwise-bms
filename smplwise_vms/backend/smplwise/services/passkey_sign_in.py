"""MFA-HA-PASSKEY-2520: the passkey as the remote sign-in factor of a home-system user (a user who is not an Arx-only identity).

Before this row a home-system user could already add a passkey in My Account and use it for step-up (MFA-PASSKEYS-2490,
services/user_passkeys.py), but the remote sign-in (services/ha_user_auth.exchange) asked only the authenticator code, a recovery code
or - in the phone app - the phone key: a passkey-only user was never asked for anything at sign-in, and under an enforced sign-in factor
policy was answered "enrol first" although a passkey that counts was on the account. See docs/changes/MFA-HA-PASSKEY-2520.md section 1.

What this module adds, all of it behind the owner's switch `security.passkey_remote_factor` (default `off` = exactly the behaviour of
before; system.configure through PATCH /settings, audited `settings.update`, never restored from a backup):

* `counts()`: with the switch on, a passkey of a home-system user that counts (user_passkeys.counts: made for the current public
  address, user verification for an administrative user, `security.passkeys_all_users` on) is a sign-in factor like an enrolled
  authenticator: every NEW remote sign-in in a browser (the cookie exchange) owes it, and it satisfies the sign-in factor policy.
* The offer: the 401 `second_factor_required` of such a sign-in carries `details` = {methods, passkey: {origin, publicKey}} - WebAuthn
  request options for the user's own usable passkeys. Only the exchange answers it, after Home Assistant validated the caller's token, so
  the options (the user's credential ids) reach nobody who has not passed the first factor of THAT user; no new public route.
* The challenge: 32 random bytes from the `remote_factor` pool of local_passkeys (memory only, 60 s, single use - spent at the first
  presentation whatever the outcome - one open per user, local_passkeys.MAX_CHALLENGES ceiling), bound to the user and to the caller's
  Home Assistant sign-in (a hash of the token's refresh-token id, so the answer is accepted only together with that sign-in).
* The answer goes in the existing `X-Arx-Second-Factor` header as `pk1:<rawId>.<clientDataJSON>.<authenticatorData>.<signature>
  [.<userHandle>]` (base64url, at most ANSWER_MAX characters) and is checked by the same verifier as every other passkey ceremony
  (local_passkeys._check: origin and RP id of the configured public address - never a request header -, user presence, user
  verification for an administrative user, signature, backup eligibility, the counter).
* Not on the bearer path (a native client has no browser origin to make a passkey for): there the passkey stays what it was - not a
  sign-in factor - and a `pk1:` answer is refused (fail closed).
* Not a passwordless sign-in: a home-system user's Arx session stands on a Home Assistant access token from Home Assistant's own sign-in,
  which a passkey cannot produce without Arx minting Home Assistant credentials (no account creation, no change to home-system users).

Audit (never a credential id, a public key, a challenge, a signature or a label): `auth.passkey.used` (step `sign_in`, the passkey's
public id), `auth.second_factor.failed` with method `passkey` and reason `passkey_<why>` (written by ha_user_auth), and
`auth.passkey.counter_regression` + the managers' `security.local_passkey_clone` notice for a counter regression."""
from __future__ import annotations

import hashlib
import logging
import sqlite3
from typing import Any

from . import local_passkeys as lpk
from . import second_factor as sf
from . import webauthn as wa

log = logging.getLogger("smplwise.passkey_sign_in")

KEY = "security.passkey_remote_factor"
DEFAULT = "off"
METHOD = "passkey"
PURPOSE = "remote_factor"
PREFIX = "pk1:"
ANSWER_MAX = 6000

INVALID_HE = "האימות במפתח הגישה נכשל. נסה שוב, או אמת עם הקוד מאפליקציית האימות."


class PasskeyFactorError(sf.SecondFactorError):
    """A refused passkey answer at sign-in: `code` is `invalid` (the shape of a wrong authenticator code, so the sign-in page keeps the
    step); `reason` says why for the audit row and never carries input."""

    def __init__(self, reason: str):
        super().__init__("invalid", INVALID_HE)
        self.reason = reason


def enabled(conn: sqlite3.Connection) -> bool:
    from ..db import get_setting

    try:
        return (get_setting(conn, KEY, DEFAULT) or DEFAULT) == "on"
    except sqlite3.Error:  # fail closed: an unreadable switch never adds a way to sign in
        return False


def counts(conn: sqlite3.Connection, user_id: str) -> bool:
    """Is a passkey a remote sign-in factor of this home-system user right now? The switch on and a passkey that counts."""
    from . import user_passkeys as upk

    if not enabled(conn) or upk.is_local_user(conn, user_id):
        return False
    try:
        return upk.counts(conn, user_id)
    except sqlite3.Error:
        return False


def is_answer(text: Any) -> bool:
    return isinstance(text, str) and text.startswith(PREFIX)


def _bind(token: str) -> str:
    """The caller's Home Assistant sign-in: the refresh-token id the token names (every access token of one sign-in carries it), else
    the token itself - hashed, never kept in clear."""
    from .ha_user_auth import iss_hash, token_hash

    basis = iss_hash(token) or ("tok:" + token_hash(token))
    return hashlib.sha256(("passkey-remote-factor|" + basis).encode("utf-8")).hexdigest()[:32]


def methods(conn: sqlite3.Connection, user_id: str) -> list[str]:
    """The ways this user may answer the sign-in step in a browser (the page's chooser)."""
    from . import device_keys

    out = ["totp"] if sf.is_enrolled(conn, user_id) else []
    if counts(conn, user_id):
        out.append(METHOD)
    if device_keys.has_active(conn, user_id):
        out.append(device_keys.METHOD)
    return out


def offer(conn: sqlite3.Connection, user_id: str, token: str) -> dict[str, Any] | None:
    """The `details` of the 401 `second_factor_required` of a browser sign-in: None (the answer of before) unless the switch is on and
    the user's passkey counts; then the methods and fresh WebAuthn request options bound to this user and this Home Assistant sign-in."""
    if not counts(conn, user_id):
        return None
    from .local_identity import holds_admin

    relying = lpk.rp(conn)
    found = lpk.usable_rows(conn, user_id)
    if relying is None or not found:
        return None
    admin = holds_admin(conn, user_id)
    value = lpk._issue(PURPOSE, user_id, _bind(token), relying, admin)
    return {"methods": methods(conn, user_id),
            "passkey": {"origin": relying[1],
                        "publicKey": {"challenge": wa.b64url(value), "rpId": relying[0], "timeout": lpk.TIMEOUT_MS,
                                      "userVerification": "required" if admin else "preferred",
                                      "allowCredentials": [{"type": "public-key", "id": r["credential_id"],
                                                            **({"transports": r["transports"].split(",")} if r["transports"] else {})}
                                                           for r in found]}}}


def parse_answer(text: str) -> dict[str, Any] | None:
    """`pk1:<rawId>.<clientDataJSON>.<authenticatorData>.<signature>[.<userHandle>]` -> the credential JSON local_passkeys reads."""
    if not is_answer(text) or len(text) > ANSWER_MAX:
        return None
    parts = text[len(PREFIX):].split(".")
    if len(parts) not in (4, 5) or not all(parts[:4]):
        return None
    response: dict[str, Any] = {"clientDataJSON": parts[1], "authenticatorData": parts[2], "signature": parts[3]}
    if len(parts) == 5 and parts[4]:
        response["userHandle"] = parts[4]
    return {"id": parts[0], "rawId": parts[0], "type": "public-key", "response": response}


def check_answer(conn: sqlite3.Connection, principal: Any, answer: str, token: str | None, request_id: str | None = None) -> str:
    """Verify a sign-in passkey answer of this user. Returns the passkey's public id; raises PasskeyFactorError(reason). The challenge
    must be a `remote_factor` challenge of THIS user, issued to THIS Home Assistant sign-in, within 60 s; the credential must be the
    user's own and count. A counter regression is audited and reported to the managers."""
    from .local_identity import holds_admin

    uid = principal.user_id
    if token is None:
        raise PasskeyFactorError("not_offered")  # the bearer path: no browser origin, no offer
    if not counts(conn, uid):
        raise PasskeyFactorError("not_counting")
    body = parse_answer(answer)
    if body is None:
        raise PasskeyFactorError("malformed")
    try:
        cred = lpk.parse_credential(body, kind="get")
        rec = lpk.take(wa.challenge_of(cred.client_data))
    except wa.WebAuthnError:
        raise PasskeyFactorError("malformed") from None
    if rec is None:
        raise PasskeyFactorError("challenge_unknown")  # unknown, expired or already used
    if rec.purpose != PURPOSE or rec.bind != _bind(token):
        raise PasskeyFactorError("challenge_mismatch")  # another ceremony, or another sign-in
    if rec.user_id != uid:
        raise PasskeyFactorError("cross_user")
    row = conn.execute("SELECT * FROM auth_webauthn_credentials WHERE credential_id = ?", (wa.b64url(cred.raw_id),)).fetchone()
    if row is None:
        raise PasskeyFactorError("credential_unknown")
    if row["user_id"] != uid:
        raise PasskeyFactorError("cross_user")
    if cred.user_handle is not None and cred.user_handle != lpk.user_handle(uid):
        raise PasskeyFactorError("user_handle_mismatch")
    if row["id"] not in {r["id"] for r in lpk.usable_rows(conn, uid)}:
        raise PasskeyFactorError("not_usable")
    try:
        lpk._check(conn, row, cred, rec, rec.uv_required or holds_admin(conn, uid))
    except wa.WebAuthnError as exc:
        if exc.reason == "counter_regression":
            _counter_regression(conn, principal, row, request_id)
        raise PasskeyFactorError(exc.reason) from None
    _audit(conn, principal, "auth.passkey.used", "allowed", None, {"step": "sign_in", "passkey": row["id"]}, request_id)
    return row["id"]


def _audit(conn: sqlite3.Connection, principal: Any, action: str, decision: str, reason: str | None, details: dict[str, Any],
           request_id: str | None) -> None:
    from ..audit import audit

    audit(conn, actor=principal, action=action, decision=decision, resource_type="user", resource_id=principal.user_id, reason=reason,
          request_id=request_id, details=details)


def _counter_regression(conn: sqlite3.Connection, principal: Any, row: Any, request_id: str | None) -> None:
    _audit(conn, principal, "auth.passkey.counter_regression", "denied", "counter_regression", {"step": "sign_in", "passkey": row["id"]},
           request_id)
    try:
        from . import notify

        notify.emit(conn, notify.Signal(source="security.local_passkey_clone", subject_kind="system", subject_id=principal.user_id,
                                        dedupe_key=f"security.local_passkey_clone:{principal.user_id}", params={}, link="#/system/access"))
    except Exception:  # noqa: BLE001 - a notice never changes the answer
        log.warning("could not emit security.local_passkey_clone")
