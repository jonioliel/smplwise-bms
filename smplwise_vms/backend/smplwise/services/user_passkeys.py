"""MFA-PASSKEYS-2490 (second-factor train, slice 4; owner decision 2026-11-22 Q50 "passkeys for all users"): passkeys for every user
who signs in to Arx - Home Assistant users (remote sessions, the phone app's sessions, Ingress) as well as Arx-only identities - and
the passkey as a step-up method.

Built on the Arx-only passkeys (services/local_passkeys.py: the same table `auth_webauthn_credentials`, whose `user_id` already
references `users(id)` where Home Assistant ids live - no migration; the same verifier services/webauthn.py; the same relying party, the
host of `security.local_public_url`; the same challenge pools, 32 bytes, 60 s, single use). The Arx-only rules and routes stay as they
were (registration after a fresh sign-in, the passkey-first and passkeys-only modes, the 202 sign-in step); this module adds:

* `security.passkeys_all_users` (default on, owner Q50): off = passkeys stay an Arx-only-identity feature. The passkeys other users
  already made are kept and listed, but do not count (never a factor, never a step-up method) - like a passkey of an old address.
* Registration for a user who is not an Arx-only identity, bound to the caller's session (the step-up session key: the HA sign-in, the
  app session, `ingress:<user>`). Adding a passkey to an account that already has a factor needs a fresh proof in this session
  (step_up.fresh_proof: a step-up proof, a sign-in that showed the factor) - otherwise a stolen session could add its own passkey and
  then pass every step-up with it. The answer is 403 `step_up_required` (details: action `auth.passkey.register`, the methods,
  `verify_path`, `challenge_path`). The FIRST factor made this way behaves like a TOTP enrolment (routers/second_factor.confirm): the
  user's other remote sign-ins and phone device tokens end, and this session counts as having shown the factor.
* Removal: a proof whenever the account has a factor (the current authenticator code in the request, a fresh step-up proof, or - an
  Arx-only identity - the fresh sign-in of before); when the last factor goes, the user's step-up proofs go with it.
* The step-up challenge (`POST auth/step-up/challenge {action?}`): bound to the user, the session and the action, 60 s, single use
  (spent by the first verification that names it, whatever the outcome), one open per user, at most local_passkeys.MAX_CHALLENGES live
  (beyond: 429). `POST auth/step-up/verify {method: "passkey", challenge_id, assertion, action?}` checks the assertion against the
  caller's own usable passkey (origin, RP id, user presence, user verification for an administrative user, signature, the counter -
  a regression is refused, audited `auth.passkey.counter_regression` and reported to the managers like an Arx-only clone) and records the
  same server-side proof as the authenticator code (services/step_up.mark).
* User verification: required for a user who holds an administrative permission, preferred otherwise - the rule the passkey already met
  at registration and at sign-in (a passkey that counts as a factor can always pass the step-up). Recorded deviation from design 4.2
  ("required" for every step-up), see docs/changes/MFA-PASSKEYS-2490.md.

Audit (never a credential id, a public key, a challenge, a signature or a label): `auth.passkey.registered|removed|renamed|refused|
counter_regression` (users who are not Arx-only identities; the Arx-only rows keep their `auth.local.passkey.*` names),
`auth.step_up.challenge`, `auth.step_up.ok|failed` with method `passkey`, `security.passkeys_all_users` (the switch)."""
from __future__ import annotations

import hashlib
import logging
import sqlite3
from typing import Any

from ..errors import ApiError
from . import local_passkeys as lpk
from . import webauthn as wa

log = logging.getLogger("smplwise.user_passkeys")

ALL_USERS_KEY = "security.passkeys_all_users"
DEFAULT_ALL_USERS = "on"
METHOD = "passkey"
PURPOSE = "step_up"
ACTION_REGISTER = "auth.passkey.register"
ACTION_REMOVE = "auth.passkey.remove"
# The factor changes: a proof is needed for them whatever `security.step_up` says, so `auth/step-up/verify` accepts these actions also
# while the switch is off, on the local channel, or for a bearer caller (the proof lands on the session as usual).
FACTOR_ACTIONS = frozenset({ACTION_REGISTER, ACTION_REMOVE})
CHALLENGE_PATH = "auth/step-up/challenge"

OFF_HE = "מפתחות גישה זמינים כרגע רק למשתמשי Arx."
NO_SESSION_HE = "לא נמצאה כניסה פעילה. היכנס מחדש ונסה שוב."
PROOF_HE = "כדי לשנות את מפתחות הגישה צריך לאשר שוב את הזהות: במפתח גישה או בקוד מאפליקציית האימות."
FAILED_HE = "האישור במפתח הגישה נכשל. נסה שוב."
NO_PASSKEY_HE = "אין בחשבון מפתח גישה שאפשר לאשר בו בכתובת הזו."


# ---------------------------------------------------------------- who and what counts

def all_users_enabled(conn: sqlite3.Connection) -> bool:
    from ..db import get_setting

    try:
        return (get_setting(conn, ALL_USERS_KEY, DEFAULT_ALL_USERS) or DEFAULT_ALL_USERS) != "off"
    except sqlite3.Error:  # fail closed: an unreadable switch never widens anything
        return False


def is_local_user(conn: sqlite3.Connection, user_id: str) -> bool:
    try:
        row = conn.execute("SELECT source FROM users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.Error:
        return False
    return row is not None and row["source"] == "local"


def counts(conn: sqlite3.Connection, user_id: str) -> bool:
    """Do this user's passkeys count as a factor and a step-up method right now? A usable passkey (local_passkeys.usable: made for the
    current public address; for an administrative user, with user verification) - and, for a user who is not an Arx-only identity,
    the all-users switch on."""
    if not lpk.usable(conn, user_id):
        return False
    return all_users_enabled(conn) or is_local_user(conn, user_id)


def has_factor(conn: sqlite3.Connection, user_id: str) -> bool:
    """The authenticator code or a passkey that counts."""
    from . import second_factor as sf

    return sf.is_enrolled(conn, user_id) or counts(conn, user_id)


def _admin(conn: sqlite3.Connection, user_id: str) -> bool:
    from .local_identity import holds_admin

    return holds_admin(conn, user_id)


def _bind(session_key: str, action: str) -> str:
    """What a challenge is bound to besides the user: a hash of the session (never the session key itself) and the action."""
    return hashlib.sha256(("passkey-session|" + session_key).encode("utf-8")).hexdigest()[:32] + "|" + action


def challenge_id(value: bytes) -> str:
    """The public name of a step-up challenge (the challenge bytes themselves travel only in the WebAuthn options)."""
    return "suc_" + hashlib.sha256(b"arx-step-up-challenge|" + value).hexdigest()[:24]


def proof_required(conn: sqlite3.Connection, user_id: str, action: str) -> ApiError:
    """403 `step_up_required` for a factor change: the same answer as the step-up gate (the shell's step-up dialog handles it), with
    the challenge path for a passkey."""
    from . import step_up

    return ApiError(403, "step_up_required", PROOF_HE,
                    details={"action": action, "methods": step_up.methods_of(conn, user_id), "minutes": step_up.minutes(conn),
                             "verify_path": "auth/step-up/verify", "challenge_path": CHALLENGE_PATH})


def _audit(conn: sqlite3.Connection, *, actor: Any, action: str, decision: str, user_id: str, reason: str | None = None,
           details: dict[str, Any] | None = None, request_id: str | None = None) -> None:
    from ..audit import audit

    audit(conn, actor=actor, action=action, decision=decision, resource_type="user", resource_id=user_id, reason=reason,
          request_id=request_id, details=details or {})


# ---------------------------------------------------------------- the caller's own list (a user who is not an Arx-only identity)

def own_summary(conn: sqlite3.Connection, request: Any, principal: Any) -> dict[str, Any]:
    """`GET auth/passkeys` for a user who is not an Arx-only identity: the summary without the Arx-only modes (passkey-first and
    passkeys-only are Arx-only features), whether this session holds a proof now (`recent_auth`, and for how many more seconds) and
    whether the authenticator code is enrolled. Never a credential id or a public key."""
    import time

    from . import second_factor as sf
    from . import step_up

    base = lpk.summary(conn, principal.user_id)
    until = step_up.valid_until(conn, request, principal)
    return {**base, "first_allowed": False, "first_on": False, "only_on": False, "only_effective": False,
            "recent_auth": until is not None, "recent_auth_left_s": max(0, int(until - time.time())) if until else 0,
            "totp": sf.is_enrolled(conn, principal.user_id)}


def summary(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    base = lpk.summary(conn, user_id)
    return {**base, "first_allowed": False, "first_on": False, "only_on": False, "only_effective": False}


# ---------------------------------------------------------------- registration (a user who is not an Arx-only identity)

def _session_key(request: Any, principal: Any) -> str:
    from . import step_up

    key = step_up.session_key(request, principal)
    if key is None:
        raise ApiError(409, "passkey_no_session", NO_SESSION_HE)
    return key


def registration_options(conn: sqlite3.Connection, request: Any, principal: Any) -> dict[str, Any]:
    from . import step_up

    relying = lpk.rp(conn)
    if relying is None:
        raise ApiError(409, "passkey_unavailable", lpk.UNAVAILABLE_HE)
    key = _session_key(request, principal)
    uid = principal.user_id
    existing = lpk.rows(conn, uid)
    if len(existing) >= lpk.MAX_PER_USER:
        raise ApiError(409, "passkey_limit", lpk.LIMIT_HE)
    if has_factor(conn, uid) and not step_up.fresh_proof(conn, request, principal):
        raise proof_required(conn, uid, ACTION_REGISTER)
    admin = _admin(conn, uid)
    challenge = lpk._issue("register", uid, _bind(key, ACTION_REGISTER), relying, admin)
    user = conn.execute("SELECT username, display_name FROM users WHERE id = ?", (uid,)).fetchone()
    name = (user["username"] if user is not None else "") or principal.username or principal.display_name or uid
    display = (user["display_name"] if user is not None else "") or principal.display_name or name
    return {"publicKey": {
        "rp": {"id": relying[0], "name": lpk.RP_NAME},
        "user": {"id": wa.b64url(lpk.user_handle(uid)), "name": name, "displayName": display},
        "challenge": wa.b64url(challenge),
        "pubKeyCredParams": [{"type": "public-key", "alg": wa.ALG_ES256}, {"type": "public-key", "alg": wa.ALG_RS256}],
        "timeout": lpk.TIMEOUT_MS,
        "attestation": "none",
        "authenticatorSelection": {"residentKey": "required", "requireResidentKey": True, "userVerification": "required" if admin else "preferred"},
        "excludeCredentials": [{"type": "public-key", "id": r["credential_id"], **({"transports": r["transports"].split(",")} if r["transports"] else {})}
                               for r in existing if r["rp_id"] == relying[0]],
    }, "user_verification_required": admin}


def register(conn: sqlite3.Connection, request: Any, principal: Any, body: Any, label: str | None, request_id: str | None) -> dict[str, Any]:
    """Verify and store a new passkey of the caller. Uniform 400 `passkey_invalid` on any verification failure (the reason is audited).
    The challenge was issued only after the proof rule passed (registration_options), and it is bound to this session."""
    from . import capture_lease, presence, step_up
    from . import ha_user_auth as hua

    relying = lpk.rp(conn)
    if relying is None:
        raise ApiError(409, "passkey_unavailable", lpk.UNAVAILABLE_HE)
    uid = principal.user_id
    key = _session_key(request, principal)

    def refuse(reason: str) -> ApiError:
        _audit(conn, actor=principal, action="auth.passkey.refused", decision="denied", user_id=uid, reason=reason,
               details={"step": "register"}, request_id=request_id)
        return ApiError(400, "passkey_invalid", lpk.REGISTER_FAILED_HE)

    try:
        cred = lpk.parse_credential(body, kind="create")
    except wa.WebAuthnError as exc:
        raise refuse(exc.reason) from None
    rec = lpk.take(wa.challenge_of(cred.client_data))
    if rec is None:
        raise refuse("challenge_unknown")
    if rec.purpose != "register" or rec.user_id != uid or rec.bind != _bind(key, ACTION_REGISTER):
        raise refuse("challenge_mismatch")
    if (rec.rp_id, rec.origin) != relying:
        raise refuse("rp_changed")
    require_uv = rec.uv_required or _admin(conn, uid)
    try:
        reg = wa.verify_registration(attestation_object=cred.attestation_object or b"", client_data_json=cred.client_data, raw_id=cred.raw_id,
                                     challenge=rec.value, origin=rec.origin, rp_id=rec.rp_id, require_uv=require_uv)
    except wa.WebAuthnError as exc:
        raise refuse(exc.reason) from None
    cid = wa.b64url(reg.credential_id)
    if conn.execute("SELECT 1 FROM auth_webauthn_credentials WHERE credential_id = ?", (cid,)).fetchone() is not None:
        raise refuse("credential_exists")  # another user's credential included: uniform (no cross-user signal)
    if len(lpk.rows(conn, uid)) >= lpk.MAX_PER_USER:
        raise ApiError(409, "passkey_limit", lpk.LIMIT_HE)
    first_factor = not has_factor(conn, uid)
    pk = lpk.new_pk_id()
    clean = (label or "").strip()[: lpk.LABEL_MAX] or None
    if clean and any(ord(c) < 32 or ord(c) == 127 for c in clean):
        clean = None
    capture_lease.on_authority_change("second_factor_changed", user_ids=[uid])  # CR-WISKEY-LEASE T6: the factor set changed
    conn.execute("""INSERT INTO auth_webauthn_credentials(id, user_id, credential_id, public_key, alg, sign_count, transports, aaguid, label,
                                                          backup_eligible, backup_state, uv_registered, rp_id, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                 (pk, uid, cid, wa.b64url(reg.public_key), reg.alg, reg.sign_count, ",".join(cred.transports), reg.aaguid, clean,
                  int(reg.backup_eligible), int(reg.backup_state), int(reg.uv), rec.rp_id, lpk._now_iso()))
    ended = tokens = 0
    if first_factor and counts(conn, uid):  # exactly like a TOTP enrolment (routers/second_factor.confirm)
        ended = hua.revoke_user_sign_ins(conn, uid, actor=principal, reason="second_factor_enrolled", keep=hua.session_of(request),
                                         request_id=request_id)
        tokens = presence.revoke_tokens(conn, uid)
        step_up.note_proof(request, principal, METHOD)  # the authenticator was just used in this session
    _audit(conn, actor=principal, action="auth.passkey.registered", decision="allowed", user_id=uid,
           details={"passkey": pk, "alg": reg.alg, "synced": reg.backup_eligible, "uv": reg.uv, "first_factor": first_factor,
                    "other_sign_ins_ended": ended, "device_tokens_revoked": tokens}, request_id=request_id)
    row = conn.execute("SELECT * FROM auth_webauthn_credentials WHERE id = ?", (pk,)).fetchone()
    return {"passkey": lpk.view(row, relying[0], _admin(conn, uid)), "first_factor": first_factor, "other_sessions_ended": ended}


# ---------------------------------------------------------------- removal and renaming

def removal_proof(conn: sqlite3.Connection, request: Any, principal: Any, code: str | None, *, local_session: Any = None) -> str:
    """The proof a passkey removal needs. Returns how it was shown: `code` (the current authenticator code in the request),
    `recent_sign_in` (an Arx-only identity's fresh sign-in, the rule of before), `step_up` (a proof on this session), `no_factor`
    (an account with no factor at all has nothing to protect - a user who is not an Arx-only identity). Otherwise raises: an Arx-only
    identity keeps its 403 `reauth_required`, every other user gets 403 `step_up_required` (action `auth.passkey.remove`)."""
    from . import second_factor as sf
    from . import step_up

    uid = principal.user_id
    if code and sf.is_enrolled(conn, uid):
        try:
            sf.verify(conn, request.app.state.settings, uid, code)
        except sf.SecondFactorError as exc:
            raise ApiError(429 if exc.code == "locked" else 400, f"second_factor_{exc.code}", exc.message, retryable=exc.code == "locked") from None
        return "code"
    if local_session is not None and lpk.recent_auth(conn, local_session):
        return "recent_sign_in"
    if step_up.fresh_proof(conn, request, principal):
        return "step_up"
    if local_session is not None:
        raise ApiError(403, "reauth_required", lpk.REAUTH_HE)
    if not has_factor(conn, uid):
        return "no_factor"
    raise proof_required(conn, uid, ACTION_REMOVE)


def remove(conn: sqlite3.Connection, principal: Any, pk_id: str, *, proof: str, request_id: str | None) -> dict[str, Any]:
    """Delete one passkey of the caller (a user who is not an Arx-only identity). When no factor is left, the user's step-up proofs end
    (no proof outlives the factor it came from). Their sign-ins are not ended - removing the authenticator code does not end them either."""
    from . import capture_lease, step_up

    uid = principal.user_id
    row = conn.execute("SELECT id FROM auth_webauthn_credentials WHERE id = ? AND user_id = ?", (pk_id, uid)).fetchone() \
        if isinstance(pk_id, str) and len(pk_id) <= 40 else None
    if row is None:
        raise ApiError(404, "passkey_not_found", lpk.NOT_FOUND_HE)
    capture_lease.on_authority_change("second_factor_changed", user_ids=[uid])
    conn.execute("DELETE FROM auth_webauthn_credentials WHERE id = ?", (pk_id,))
    left = has_factor(conn, uid)
    if not left:
        step_up.forget_user(uid)
    _audit(conn, actor=principal, action="auth.passkey.removed", decision="allowed", user_id=uid,
           details={"passkey": pk_id, "by": "self", "proof": proof, "factor_left": left}, request_id=request_id)
    return {"removed": pk_id, "sessions_ended": 0, "passkey_first": False, "factor_cleared": not left}


def audit_renamed(conn: sqlite3.Connection, principal: Any, pk_id: str, request_id: str | None) -> None:
    """A renamed passkey: the public id only (a label is the user's own text, never in the audit trail)."""
    _audit(conn, actor=principal, action="auth.passkey.renamed", decision="allowed", user_id=principal.user_id,
           details={"passkey": pk_id}, request_id=request_id)


# ---------------------------------------------------------------- step-up: the challenge and the assertion

def challenge(conn: sqlite3.Connection, request: Any, principal: Any, action: str | None, request_id: str | None) -> dict[str, Any]:
    """`POST auth/step-up/challenge`: WebAuthn request options for the caller's own usable passkeys, bound to the user, this session and
    the action. 409 `step_up_no_session` / `step_up_no_method` (no passkey that counts here)."""
    from . import step_up

    uid = principal.user_id
    key = step_up.session_key(request, principal)
    if key is None:
        raise ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    relying = lpk.rp(conn)
    found = lpk.usable_rows(conn, uid) if counts(conn, uid) else []
    if relying is None or not found:
        raise ApiError(409, "step_up_no_method", NO_PASSKEY_HE, details={"methods": step_up.methods_of(conn, uid)})
    admin = _admin(conn, uid)
    value = lpk._issue(PURPOSE, uid, _bind(key, action or ""), relying, admin)
    _audit(conn, actor=principal, action="auth.step_up.challenge", decision="allowed", user_id=uid,
           details={"method": METHOD, "action": action or ""}, request_id=request_id)
    return {"challenge_id": challenge_id(value), "action": action or "", "expires_in": int(lpk.CHALLENGE_TTL_S),
            "methods": step_up.methods_of(conn, uid),
            "webauthn": {"publicKey": {"challenge": wa.b64url(value), "rpId": relying[0], "timeout": lpk.TIMEOUT_MS,
                                       "userVerification": "required" if admin else "preferred",
                                       "allowCredentials": [{"type": "public-key", "id": r["credential_id"],
                                                             **({"transports": r["transports"].split(",")} if r["transports"] else {})}
                                                            for r in found]}}}


class Refused(Exception):
    def __init__(self, reason: str, row: Any = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.row = row


def check_assertion(conn: sqlite3.Connection, request: Any, principal: Any, cid: str | None, assertion: Any, action: str | None) -> str:
    """Verify a step-up assertion of the caller. Returns the passkey's public id; raises Refused(reason). The challenge is spent by
    the first verification that names it, whatever the outcome (single use); it must be a step-up challenge of THIS user, issued to
    THIS session for THIS action, under its `challenge_id`, within 60 s."""
    from . import step_up

    uid = principal.user_id
    key = step_up.session_key(request, principal)
    try:
        cred = lpk.parse_credential(assertion, kind="get")
        rec = lpk.take(wa.challenge_of(cred.client_data))
    except wa.WebAuthnError:
        raise Refused("malformed") from None
    if rec is None:
        raise Refused("challenge_unknown")  # unknown, expired or already used
    if rec.purpose != PURPOSE or not cid or challenge_id(rec.value) != cid:
        raise Refused("challenge_mismatch")
    if rec.user_id != uid:
        raise Refused("cross_user")
    if key is None or rec.bind != _bind(key, action or ""):
        raise Refused("challenge_mismatch")  # another session, or another action
    row = conn.execute("SELECT * FROM auth_webauthn_credentials WHERE credential_id = ?", (wa.b64url(cred.raw_id),)).fetchone()
    if row is None:
        raise Refused("credential_unknown")
    if row["user_id"] != uid:
        raise Refused("cross_user")
    if cred.user_handle is not None and cred.user_handle != lpk.user_handle(uid):
        raise Refused("user_handle_mismatch", row)
    if not counts(conn, uid) or row["id"] not in {r["id"] for r in lpk.usable_rows(conn, uid)}:
        raise Refused("not_usable", row)
    try:
        lpk._check(conn, row, cred, rec, rec.uv_required or _admin(conn, uid))
    except wa.WebAuthnError as exc:
        raise Refused(exc.reason, row) from None
    return row["id"]


def _counter_regression(conn: sqlite3.Connection, principal: Any, row: Any, request_id: str | None) -> None:
    _audit(conn, actor=principal, action="auth.passkey.counter_regression", decision="denied", user_id=principal.user_id,
           reason="counter_regression", details={"step": "step_up", "passkey": row["id"]}, request_id=request_id)
    try:
        from . import notify

        notify.emit(conn, notify.Signal(source="security.local_passkey_clone", subject_kind="system", subject_id=principal.user_id,
                                        dedupe_key=f"security.local_passkey_clone:{principal.user_id}", params={}, link="#/system/access"))
    except Exception:  # noqa: BLE001 - a notice never changes the answer
        log.warning("could not emit security.local_passkey_clone")


def verify(conn: sqlite3.Connection, request: Any, principal: Any, cid: str | None, assertion: Any, action: str | None,
           request_id: str | None) -> dict[str, Any]:
    """`POST auth/step-up/verify {method: "passkey", challenge_id, assertion, action?}` (routers/second_factor.step_up_verify hands the
    passkey method here). The same applicability as the code (`step_up.not_applicable`), except the factor changes (FACTOR_ACTIONS),
    which need a proof whatever the switch says, and the once-actions of the gates slice when that slice is present (a proof for one
    call of that action). Audited `auth.step_up.ok` / `auth.step_up.failed` with method `passkey`, never the assertion."""
    from . import step_up

    uid = principal.user_id
    act = action or ""
    once_actions = getattr(step_up, "ONCE_ACTIONS", frozenset())  # MFA-STEPUP-GATES-2490, when merged
    once = act in once_actions and hasattr(step_up, "mark_once")
    if not step_up.methods_of(conn, uid):
        raise ApiError(409, "step_up_no_method", step_up.NO_METHOD_HE)
    if not once and act not in FACTOR_ACTIONS:
        reason = step_up.not_applicable(conn, request, principal)
        if reason is not None:
            raise ApiError(409, "step_up_not_applicable", step_up.NOT_APPLICABLE_HE, details={"reason": reason})
    if step_up.session_key(request, principal) is None:
        raise ApiError(409, "step_up_no_session", step_up.NO_SESSION_HE)
    if not isinstance(cid, str) or not isinstance(assertion, dict):
        raise ApiError(422, "validation", FAILED_HE, details={"field": "assertion"})
    details = {"method": METHOD, "action": act}
    try:
        pk = check_assertion(conn, request, principal, cid, assertion, action)
    except Refused as exc:
        if exc.reason == "counter_regression" and exc.row is not None:
            _counter_regression(conn, principal, exc.row, request_id)
        _audit(conn, actor=principal, action="auth.step_up.failed", decision="denied", user_id=uid, reason=f"passkey_{exc.reason}",
               details=details, request_id=request_id)
        raise ApiError(400, "step_up_failed", FAILED_HE) from None
    if once:
        until = step_up.mark_once(request, principal, act, METHOD)
        _audit(conn, actor=principal, action="auth.step_up.ok", decision="allowed", user_id=uid,
               details={**details, "passkey": pk, "minutes": 0, "once": True}, request_id=request_id)
        return {"method": METHOD, "minutes": 0, "valid_until": step_up.iso(until)}
    until = step_up.mark(conn, request, principal, METHOD)
    _audit(conn, actor=principal, action="auth.step_up.ok", decision="allowed", user_id=uid,
           details={**details, "passkey": pk, "minutes": step_up.minutes(conn)}, request_id=request_id)
    return {"method": METHOD, "minutes": step_up.minutes(conn), "valid_until": step_up.iso(until)}
