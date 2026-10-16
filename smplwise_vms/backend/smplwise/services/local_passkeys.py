"""USR2 phase 4: passkeys (WebAuthn) for Arx-only (local) identities - a second factor and, optionally, a passwordless sign-in.

Design record: docs/design/USR2_ARX_ONLY_IDENTITY_SPEC.md section 8.1; contract: docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md section 9.
Verification: services/webauthn.py (own minimal implementation on `cryptography`). Everything here is inert while
`security.local_identity` is off, and passkeys are unavailable until a system administrator has set `security.local_public_url`.

- Relying party: RP id = the host of `security.local_public_url` (https + a DNS name only - local_reset.normalize_public_url), origin =
  `https://<that host>`. Never derived from a request header. A passkey made for another RP id (the address changed) is listed but
  never offered nor accepted, and does not count as a factor (so a changed address can never leave a user stuck at a factor step
  that nothing can pass - the user falls back to the password + TOTP, or to enrolment).
- Challenges: 32 random bytes, in memory only (never in the database, never in a backup), 60 s, single use (taken - and so spent -
  by the first verification that names them, whatever its outcome), bound to their purpose and to the pending sign-in / the session
  chain / nothing (passwordless) that asked; at most MAX_CHALLENGES live (beyond: 429).
- Registration: a local principal on its own session, signed in less than RECENT_AUTH_S ago, and - when the user already has a factor
  (TOTP or a usable passkey) - a session whose sign-in presented it (`factor_at`). Attestation `none`; resident key required;
  user verification `required` for a user holding an administrative permission (rbac.LOCAL_ADMIN_PERMISSIONS), else `preferred`.
  A user's FIRST factor made this way behaves exactly like a TOTP enrolment (second_factor.confirm): every other session and device
  token of the user ends and this session rotates and counts as having shown the factor (CR-USR2 F10, accepted design risk).
- Second factor (owner answer Q3): after a correct password, a user with a usable passkey gets the 202 pending step with
  `methods`; a passkey assertion bound to that pending record ends it like a TOTP code - the session's `factor_at` is set, so
  `principal.factor_ok` opens the administrative permissions. An administrative user's assertion must carry UV.
- Passkey first (passwordless): only while the owner switch `security.local_passkey_first` is on AND the user opted in
  (`auth_local_credentials.passkey_first`); a discoverable credential, UV always required; the session counts as factor-verified
  (the authenticator's biometric / PIN is the second factor). It NEVER removes the password: password sign-in, the manager's links
  and the self-service reset keep working; removing the last passkey switches the mode off. A "password removed" mode is not built
  (it would need an administrator-approved recovery path - CR-USR2 section 9).
- Counter: a regression refuses the assertion and writes `auth.local.passkey.counter_regression` (clone suspicion).
- Audit: `auth.local.passkey.registered|removed|used|refused|counter_regression|first_enabled|first_disabled` - the credential's public
  `pk_` id, never the credential id, a public key, a challenge or a signature.
"""
from __future__ import annotations

import hashlib
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Any

from ..errors import ApiError
from . import webauthn as wa

FIRST_KEY = "security.local_passkey_first"
ANDROID_KEY = "security.local_passkey_android"
RP_NAME = "SmplWise Arx"
CHALLENGE_TTL_S = 60.0
TIMEOUT_MS = 60000
MAX_CHALLENGES = 5000
RECENT_AUTH_S = 300.0
MAX_PER_USER = 10
LABEL_MAX = 40

INVALID_HE = "הכניסה במפתח הגישה נכשלה. נסה שוב או היכנס עם הסיסמה."
REGISTER_FAILED_HE = "מפתח הגישה לא נשמר. נסה שוב."
UNAVAILABLE_HE = "מפתחות גישה אינם זמינים: מנהל המערכת עוד לא הגדיר את כתובת הגישה מרחוק (https)."
REAUTH_HE = "לפעולה הזו צריך כניסה טרייה: צא והיכנס שוב (עם האימות הדו־שלבי, אם הוא פעיל), ואז נסה שוב תוך 5 דקות."
FIRST_OFF_HE = "כניסה במפתח גישה בלבד אינה מופעלת במערכת הזו."
LIMIT_HE = "אפשר לשמור עד 10 מפתחות גישה לחשבון."
NO_PASSKEY_HE = "כדי להפעיל כניסה במפתח גישה, הוסף קודם מפתח גישה."
BUSY_HE = "יותר מדי בקשות כניסה במפתח גישה כרגע. נסה שוב בעוד דקה."
NOT_FOUND_HE = "מפתח הגישה לא נמצא."


# ---------------------------------------------------------------- settings and the relying party

def first_enabled(conn: Any) -> bool:
    from ..db import get_setting

    try:
        return (get_setting(conn, FIRST_KEY, "off") or "off") == "on"
    except Exception:  # noqa: BLE001 - fail closed
        return False


def rp(conn: Any) -> tuple[str, str] | None:
    """(rp_id, origin) from the configured public address, or None (passkeys unavailable)."""
    from ..db import get_setting
    from .local_reset import normalize_public_url

    origin = normalize_public_url(get_setting(conn, "security.local_public_url", "") or "")
    if not origin:
        return None
    return origin[len("https://"):], origin


def user_handle(user_id: str) -> bytes:
    """The WebAuthn user handle: not personal data, stable per user, never reused across users."""
    return hashlib.sha256(("arx-user-handle:" + user_id).encode("utf-8")).digest()


def new_pk_id() -> str:
    return "pk_" + secrets.token_hex(10)


def _now_iso() -> str:
    from .local_identity import iso

    return iso(time.time())


def rows(conn: Any, user_id: str) -> list[Any]:
    try:
        return conn.execute("SELECT * FROM auth_webauthn_credentials WHERE user_id = ? ORDER BY created_at", (user_id,)).fetchall()
    except Exception:  # noqa: BLE001 - an older schema: none
        return []


def usable_rows(conn: Any, user_id: str) -> list[Any]:
    r = rp(conn)
    if r is None:
        return []
    return [row for row in rows(conn, user_id) if row["rp_id"] == r[0]]


def usable(conn: Any, user_id: str) -> bool:
    return bool(usable_rows(conn, user_id))


def has_factor(conn: Any, user_id: str) -> bool:
    """CR-USR2 §9 / owner answer Q3: a TOTP factor OR a usable passkey is "the second factor" of a local user."""
    from . import second_factor as sf

    return sf.is_enrolled(conn, user_id) or usable(conn, user_id)


def user_first_on(conn: Any, user_id: str) -> bool:
    try:
        r = conn.execute("SELECT passkey_first FROM auth_local_credentials WHERE user_id = ?", (user_id,)).fetchone()
    except Exception:  # noqa: BLE001
        return False
    return bool(r and r["passkey_first"])


def view(row: Any, rp_id: str | None) -> dict[str, Any]:
    """What the lists show: never the credential id or the public key."""
    return {"id": row["id"], "label": row["label"], "created_at": row["created_at"], "last_used_at": row["last_used_at"],
            "synced": bool(row["backup_eligible"]), "backed_up": bool(row["backup_state"]), "transports": [t for t in (row["transports"] or "").split(",") if t],
            "usable": rp_id is not None and row["rp_id"] == rp_id, "user_verifying": bool(row["uv_registered"])}


def summary(conn: Any, user_id: str) -> dict[str, Any]:
    r = rp(conn)
    found = rows(conn, user_id)
    return {"available": r is not None, "rp_id": r[0] if r else None, "origin": r[1] if r else None,
            "first_allowed": first_enabled(conn), "first_on": user_first_on(conn, user_id),
            "credentials": [view(x, r[0] if r else None) for x in found]}


def recent_auth(conn: Any, s: Any) -> bool:
    """A fresh sign-in on this chain (< RECENT_AUTH_S) - and, for a user who already has a factor, one that presented it."""
    if time.time() - float(s.chain_started_at or 0) > RECENT_AUTH_S:
        return False
    return bool(s.principal.factor_ok) or not has_factor(conn, s.user_id)


# ---------------------------------------------------------------- challenges (memory, single use)

@dataclass
class _Challenge:
    value: bytes
    purpose: str  # register | second_factor | passwordless
    user_id: str | None
    bind: str | None  # session chain id | pending id | None
    rp_id: str
    origin: str
    uv_required: bool
    created: float


_lock = threading.Lock()
_challenges: dict[bytes, _Challenge] = {}


def _issue(purpose: str, user_id: str | None, bind: str | None, relying: tuple[str, str], uv_required: bool) -> bytes:
    now = time.time()
    value = secrets.token_bytes(32)
    with _lock:
        for k in [k for k, v in _challenges.items() if now - v.created > CHALLENGE_TTL_S]:
            _challenges.pop(k, None)
        if len(_challenges) >= MAX_CHALLENGES:
            raise ApiError(429, "rate_limited", BUSY_HE, retryable=True)
        if user_id is not None:  # one open ceremony per user and purpose
            for k in [k for k, v in _challenges.items() if v.user_id == user_id and v.purpose == purpose]:
                _challenges.pop(k, None)
        _challenges[value] = _Challenge(value, purpose, user_id, bind, relying[0], relying[1], uv_required, now)
    return value


def take(value: bytes | None) -> _Challenge | None:
    """Spend a challenge (whatever the verification then says); None when unknown or expired."""
    if not value:
        return None
    with _lock:
        c = _challenges.pop(value, None)
    if c is None or time.time() - c.created > CHALLENGE_TTL_S:
        return None
    return c


def live_challenges() -> int:
    with _lock:
        return len(_challenges)


# ---------------------------------------------------------------- the credential JSON a browser sends (PublicKeyCredential.toJSON)

@dataclass
class _Cred:
    raw_id: bytes
    client_data: bytes
    attestation_object: bytes | None = None
    authenticator_data: bytes | None = None
    signature: bytes | None = None
    user_handle: bytes | None = None
    transports: tuple[str, ...] = ()


def parse_credential(body: Any, *, kind: str) -> _Cred:
    if not isinstance(body, dict) or body.get("type") != "public-key" or not isinstance(body.get("response"), dict):
        raise wa.WebAuthnError("malformed")
    raw_id = wa.b64url_decode(body.get("rawId") or body.get("id"), limit=2048)
    if body.get("id") is not None and wa.b64url_decode(body["id"], limit=2048) != raw_id:
        raise wa.WebAuthnError("malformed")
    resp = body["response"]
    cd = wa.b64url_decode(resp.get("clientDataJSON"), limit=8192)
    if kind == "create":
        transports = resp.get("transports") or []
        if not isinstance(transports, list):
            transports = []
        clean = tuple(sorted({t for t in transports if isinstance(t, str) and t in ("usb", "nfc", "ble", "internal", "hybrid", "smart-card")}))
        return _Cred(raw_id=raw_id, client_data=cd, attestation_object=wa.b64url_decode(resp.get("attestationObject"), limit=96 * 1024), transports=clean)
    uh = resp.get("userHandle")
    return _Cred(raw_id=raw_id, client_data=cd, authenticator_data=wa.b64url_decode(resp.get("authenticatorData"), limit=24 * 1024),
                 signature=wa.b64url_decode(resp.get("signature"), limit=2048), user_handle=wa.b64url_decode(uh, limit=256) if uh else None)


def _audit(conn_or_db: Any, *, actor: Any, action: str, decision: str, resource_id: str | None, reason: str | None = None,
           details: dict[str, Any] | None = None, request_id: str | None = None) -> None:
    from .local_identity import _audit as li_audit

    li_audit(conn_or_db, actor=actor, action=action, decision=decision, reason=reason, resource_id=resource_id, details=details, request_id=request_id)


# ---------------------------------------------------------------- registration (the user's own session)

def registration_options(conn: Any, s: Any) -> dict[str, Any]:
    from .local_identity import holds_admin

    relying = rp(conn)
    if relying is None:
        raise ApiError(409, "passkey_unavailable", UNAVAILABLE_HE)
    if not recent_auth(conn, s):
        raise ApiError(403, "reauth_required", REAUTH_HE)
    existing = rows(conn, s.user_id)
    if len(existing) >= MAX_PER_USER:
        raise ApiError(409, "passkey_limit", LIMIT_HE)
    admin = holds_admin(conn, s.user_id)
    challenge = _issue("register", s.user_id, s.chain_id, relying, admin)
    user = conn.execute("SELECT username, display_name FROM users WHERE id = ?", (s.user_id,)).fetchone()
    return {"publicKey": {
        "rp": {"id": relying[0], "name": RP_NAME},
        "user": {"id": wa.b64url(user_handle(s.user_id)), "name": user["username"], "displayName": user["display_name"] or user["username"]},
        "challenge": wa.b64url(challenge),
        "pubKeyCredParams": [{"type": "public-key", "alg": wa.ALG_ES256}, {"type": "public-key", "alg": wa.ALG_RS256}],
        "timeout": TIMEOUT_MS,
        "attestation": "none",
        "authenticatorSelection": {"residentKey": "required", "requireResidentKey": True, "userVerification": "required" if admin else "preferred"},
        "excludeCredentials": [{"type": "public-key", "id": r["credential_id"], **({"transports": r["transports"].split(",")} if r["transports"] else {})}
                               for r in existing if r["rp_id"] == relying[0]],
    }, "user_verification_required": admin}


def register(conn: Any, settings: Any, request: Any, s: Any, body: Any, label: str | None, request_id: str | None) -> dict[str, Any]:
    """Verify and store a new passkey of the caller. Uniform 400 `passkey_invalid` on any verification failure (the reason is audited)."""
    from . import local_identity as li
    from . import presence

    relying = rp(conn)
    if relying is None:
        raise ApiError(409, "passkey_unavailable", UNAVAILABLE_HE)

    def refuse(reason: str) -> ApiError:
        _audit(conn, actor=s.principal, action="auth.local.passkey.refused", decision="denied", resource_id=s.user_id, reason=reason,
               details={"step": "register"}, request_id=request_id)
        return ApiError(400, "passkey_invalid", REGISTER_FAILED_HE)

    try:
        cred = parse_credential(body, kind="create")
    except wa.WebAuthnError as exc:
        raise refuse(exc.reason) from None
    rec = take(wa.challenge_of(cred.client_data))
    if rec is None:
        raise refuse("challenge_unknown")
    if rec.purpose != "register" or rec.user_id != s.user_id or rec.bind != s.chain_id:
        raise refuse("challenge_mismatch")
    if (rec.rp_id, rec.origin) != relying:
        raise refuse("rp_changed")
    if not recent_auth(conn, s):  # the session may have aged / lost its standing between the options and now
        raise ApiError(403, "reauth_required", REAUTH_HE)
    require_uv = rec.uv_required or li.holds_admin(conn, s.user_id)
    try:
        reg = wa.verify_registration(attestation_object=cred.attestation_object or b"", client_data_json=cred.client_data, raw_id=cred.raw_id,
                                     challenge=rec.value, origin=rec.origin, rp_id=rec.rp_id, require_uv=require_uv)
    except wa.WebAuthnError as exc:
        raise refuse(exc.reason) from None
    cid = wa.b64url(reg.credential_id)
    if conn.execute("SELECT 1 FROM auth_webauthn_credentials WHERE credential_id = ?", (cid,)).fetchone() is not None:
        raise refuse("credential_exists")  # another user's credential included: uniform (no cross-user signal)
    if len(rows(conn, s.user_id)) >= MAX_PER_USER:
        raise ApiError(409, "passkey_limit", LIMIT_HE)
    first_factor = not has_factor(conn, s.user_id)
    pk = new_pk_id()
    clean = (label or "").strip()[:LABEL_MAX] or None
    if clean and any(ord(c) < 32 or ord(c) == 127 for c in clean):
        clean = None
    conn.execute("""INSERT INTO auth_webauthn_credentials(id, user_id, credential_id, public_key, alg, sign_count, transports, aaguid, label,
                                                          backup_eligible, backup_state, uv_registered, rp_id, created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                 (pk, s.user_id, cid, wa.b64url(reg.public_key), reg.alg, reg.sign_count, ",".join(cred.transports), reg.aaguid, clean,
                  int(reg.backup_eligible), int(reg.backup_state), int(reg.uv), rec.rp_id, _now_iso()))
    ended = tokens = 0
    if first_factor:  # exactly like a TOTP enrolment (routers/second_factor.confirm)
        tokens = presence.revoke_tokens(conn, s.user_id)
        ended = li.on_factor_enabled(conn, settings, request, s.principal)
    _audit(conn, actor=s.principal, action="auth.local.passkey.registered", decision="allowed", resource_id=s.user_id,
           details={"passkey": pk, "alg": reg.alg, "synced": reg.backup_eligible, "uv": reg.uv, "first_factor": first_factor,
                    "other_sessions_ended": ended, "device_tokens_revoked": tokens}, request_id=request_id)
    return {"passkey": view(conn.execute("SELECT * FROM auth_webauthn_credentials WHERE id = ?", (pk,)).fetchone(), relying[0]),
            "first_factor": first_factor, "other_sessions_ended": ended}


# ---------------------------------------------------------------- removal / the per-user mode

def _set_first(conn: Any, user_id: str, on: bool) -> None:
    conn.execute("UPDATE auth_local_credentials SET passkey_first = ?, updated_at = ? WHERE user_id = ?", (1 if on else 0, _now_iso(), user_id))


def remove(conn: Any, user_id: str, pk_id: str, *, actor: Any, by: str, keep_chain: str | None, request_id: str | None) -> dict[str, Any]:
    """Delete one passkey of `user_id`. The user's other local sessions end (`factor_reset`; the caller's own chain is kept when it is the
    user's), a pending second step ends, and removing the last passkey switches the user's passkey-first mode off (audited)."""
    from . import local_identity as li

    row = conn.execute("SELECT * FROM auth_webauthn_credentials WHERE id = ? AND user_id = ?", (pk_id, user_id)).fetchone() if isinstance(pk_id, str) and len(pk_id) <= 40 else None
    if row is None:
        raise ApiError(404, "passkey_not_found", NOT_FOUND_HE)
    conn.execute("DELETE FROM auth_webauthn_credentials WHERE id = ?", (pk_id,))
    first_off = False
    if not rows(conn, user_id) and user_first_on(conn, user_id):
        _set_first(conn, user_id, False)
        first_off = True
        _audit(conn, actor=actor, action="auth.local.passkey.first_disabled", decision="allowed", resource_id=user_id, reason="last_passkey_removed",
               request_id=request_id)
    li.drop_pending_of(user_id)
    ended = li.revoke_user_sessions(conn, user_id, "factor_reset", keep_chain=keep_chain)
    _audit(conn, actor=actor, action="auth.local.passkey.removed", decision="allowed", resource_id=user_id,
           details={"passkey": pk_id, "by": by, "sessions_ended": ended, "passkey_first_switched_off": first_off}, request_id=request_id)
    return {"removed": pk_id, "sessions_ended": ended, "passkey_first": user_first_on(conn, user_id)}


def set_first(conn: Any, s: Any, on: bool, request_id: str | None) -> dict[str, Any]:
    if on:
        if not first_enabled(conn):
            raise ApiError(409, "passkey_first_off", FIRST_OFF_HE)
        if not usable(conn, s.user_id):
            raise ApiError(409, "no_passkey", NO_PASSKEY_HE)
        if not recent_auth(conn, s):
            raise ApiError(403, "reauth_required", REAUTH_HE)
    if user_first_on(conn, s.user_id) != on:
        _set_first(conn, s.user_id, on)
        _audit(conn, actor=s.principal, action="auth.local.passkey.first_enabled" if on else "auth.local.passkey.first_disabled", decision="allowed",
               resource_id=s.user_id, reason=None if on else "self", request_id=request_id)
    return summary(conn, s.user_id)


# ---------------------------------------------------------------- assertions

def second_factor_options(db: Any, pid: str | None) -> dict[str, Any]:
    """The pending second step (a correct password moments ago) asks for a passkey of THAT user."""
    from . import local_identity as li

    p = li.peek_pending(pid)
    if p is None:
        raise ApiError(401, "second_factor_expired", li.PENDING_EXPIRED_HE)
    with db.connection(mode="read", label="passkey options") as conn:
        relying = rp(conn)
        found = usable_rows(conn, p.user_id)
        if relying is None or not found:
            raise ApiError(409, "passkey_unavailable", UNAVAILABLE_HE)
        admin = li.holds_admin(conn, p.user_id)
    challenge = _issue("second_factor", p.user_id, pid, relying, admin)
    return {"publicKey": {"challenge": wa.b64url(challenge), "rpId": relying[0], "timeout": TIMEOUT_MS, "userVerification": "required" if admin else "preferred",
                          "allowCredentials": [{"type": "public-key", "id": r["credential_id"], **({"transports": r["transports"].split(",")} if r["transports"] else {})}
                                               for r in found]}}


def passwordless_options(db: Any) -> dict[str, Any]:
    with db.connection(mode="read", label="passkey options") as conn:
        relying = rp(conn)
        on = first_enabled(conn)
    if not on:
        raise ApiError(403, "passkey_first_off", FIRST_OFF_HE)
    if relying is None:
        raise ApiError(409, "passkey_unavailable", UNAVAILABLE_HE)
    challenge = _issue("passwordless", None, None, relying, True)
    return {"publicKey": {"challenge": wa.b64url(challenge), "rpId": relying[0], "timeout": TIMEOUT_MS, "userVerification": "required", "allowCredentials": []}}


def _check(conn: Any, row: Any, cred: _Cred, rec: _Challenge, require_uv: bool) -> wa.Asserted:
    """Verify an assertion against a stored credential and record the new counter (conditionally: a concurrent use of the same
    counter value loses). WebAuthnError on any failure."""
    if row["rp_id"] != rec.rp_id:
        raise wa.WebAuthnError("wrong_rp_id")
    out = wa.verify_assertion(public_key=wa.b64url_decode(row["public_key"], limit=4096), alg=int(row["alg"]), authenticator_data=cred.authenticator_data or b"",
                              client_data_json=cred.client_data, signature=cred.signature or b"", challenge=rec.value, origin=rec.origin, rp_id=rec.rp_id,
                              require_uv=require_uv, stored_sign_count=int(row["sign_count"] or 0))
    if conn.execute("UPDATE auth_webauthn_credentials SET sign_count = ?, backup_state = ?, last_used_at = ? WHERE id = ? AND sign_count = ?",
                    (out.sign_count, int(out.backup_state), _now_iso(), row["id"], int(row["sign_count"] or 0))).rowcount != 1:
        raise wa.WebAuthnError("counter_regression")
    return out


def _failed(conn: Any, row: Any, reason: str, *, step: str, ip_masked: str, request_id: str | None) -> None:
    """The audit row of a refused assertion (a counter regression has its own action: a suspected cloned authenticator). No
    notification-centre signal in phase 4 (a new catalogue source is a follow-up item - CR-USR2 section 9)."""
    uid = row["user_id"] if row is not None else None
    _audit(conn, actor=None, action="auth.local.passkey.counter_regression" if reason == "counter_regression" else "auth.local.passkey.refused",
           decision="denied", resource_id=uid or "unknown", reason=reason,
           details={"step": step, "ip": ip_masked, **({"passkey": row["id"]} if row is not None else {})}, request_id=request_id)


def second_factor_sign_in(db: Any, settings: Any, conn_like: Any, pid: str | None, body: Any, request_id: str | None) -> Any:
    """The passkey answer to the pending second step. 401 `passkey_invalid` (uniform) / `second_factor_expired`."""
    from . import local_identity as li
    from .ha_user_auth import _record_sign_in, mask_address, request_meta

    p = li.take_pending(pid)
    if p is None:
        raise ApiError(401, "second_factor_expired", li.PENDING_EXPIRED_HE)
    meta = request_meta(conn_like)
    masked = mask_address(meta.get("client_ip", ""))
    try:
        cred = parse_credential(body, kind="get")
        rec = take(wa.challenge_of(cred.client_data))
    except wa.WebAuthnError:
        cred, rec = None, None
    with db.connection(label="local sign-in passkey") as conn:
        user = conn.execute("SELECT id, username, display_name, active, deleted_at FROM users WHERE id = ? AND source = 'local'", (p.user_id,)).fetchone()
        if user is None or not user["active"] or user["deleted_at"]:
            li.drop_pending(pid)
            raise ApiError(401, "second_factor_expired", li.PENDING_EXPIRED_HE)
        row = conn.execute("SELECT * FROM auth_webauthn_credentials WHERE credential_id = ?", (wa.b64url(cred.raw_id),)).fetchone() if cred else None
        reason = None
        if cred is None:
            reason = "malformed"
        elif rec is None:
            reason = "challenge_unknown"
        elif rec.purpose != "second_factor" or rec.bind != pid or rec.user_id != p.user_id:
            reason = "challenge_mismatch"
        elif row is None:
            reason = "credential_unknown"
        elif row["user_id"] != p.user_id:
            reason = "cross_user"
        elif cred.user_handle is not None and cred.user_handle != user_handle(p.user_id):
            reason = "user_handle_mismatch"
        if reason is None:
            try:
                _check(conn, row, cred, rec, rec.uv_required or li.holds_admin(conn, p.user_id))
            except wa.WebAuthnError as exc:
                reason = exc.reason
        if reason is not None:
            _failed(conn, row if row is not None and row["user_id"] == p.user_id else None, reason, step="second_factor", ip_masked=masked, request_id=request_id)
            if reason == "counter_regression":
                li.drop_pending(pid)
        else:
            li.drop_pending(pid)
            principal = li.Principal(user_id=user["id"], username=user["username"], display_name=user["display_name"] or user["username"], source="local", via="cookie")
            value, s = li.create_session(conn, settings, conn_like, user["id"], factor=True, meta=meta)
            _audit(conn, actor=principal, action="auth.local.passkey.used", decision="allowed", resource_id=user["id"],
                   details={"passkey": row["id"], "step": "second_factor", "ip": masked}, request_id=request_id)
            _audit(conn, actor=principal, action="auth.local.sign_in.succeeded", decision="allowed", resource_id=user["id"],
                   details={"kind": s.kind, "ip": masked, "country": meta.get("country", ""), "factor": "passkey", "id": li.public_id(s.chain_id)},
                   request_id=request_id)
            cred_row = conn.execute("SELECT must_change FROM auth_local_credentials WHERE user_id = ?", (user["id"],)).fetchone()
    if reason is not None:
        raise ApiError(401, "passkey_invalid", INVALID_HE)
    _record_sign_in(db, principal, meta)
    return li.SignInResult(status="session", cookie=value, session=s, second_factor="none", must_change=bool(cred_row and cred_row["must_change"]),
                           user={"id": user["id"], "username": user["username"], "display_name": user["display_name"], "source": "local"})


def passwordless_sign_in(db: Any, settings: Any, conn_like: Any, body: Any, request_id: str | None) -> Any:
    """Passkey first: a discoverable credential with UV, no username, no password. Every refusal is the same 401 after the same tiers."""
    from . import local_identity as li
    from .ha_user_auth import REFUSAL_AUDITS, _record_sign_in, mask_address, request_meta

    meta = request_meta(conn_like)
    ip = meta.get("client_ip", "")
    masked = mask_address(ip)
    wait = li.TIERS.hit_ip(ip)  # the sign-in's own per-address budget (20 / min, 100 / h, 300 / day), shared with the password route
    if wait:
        return li.SignInResult(status="rate_limited", retry_after=max(1, int(wait) + 1))
    base_sleep = li.GLOBAL_WAIT_S if li.TIERS.storm() else 0.0
    try:
        cred = parse_credential(body, kind="get")
        rec = take(wa.challenge_of(cred.client_data))
    except wa.WebAuthnError:
        cred, rec = None, None
    principal = value = s = cred_row = row = user = None
    reason: str | None = None
    with db.connection(label="local passkey sign-in") as conn:
        if not first_enabled(conn):
            reason = "first_off"
        elif cred is None:
            reason = "malformed"
        elif rec is None:
            reason = "challenge_unknown"
        elif rec.purpose != "passwordless":
            reason = "challenge_mismatch"
        else:
            row = conn.execute("SELECT * FROM auth_webauthn_credentials WHERE credential_id = ?", (wa.b64url(cred.raw_id),)).fetchone()
            user = conn.execute("""SELECT u.id, u.username, u.display_name, u.active, u.deleted_at, u.source, c.passkey_first, c.must_change
                                   FROM users u JOIN auth_local_credentials c ON c.user_id = u.id WHERE u.id = ?""",
                                (row["user_id"],)).fetchone() if row is not None else None
            if row is None or user is None:
                reason = "credential_unknown"
            elif user["source"] != "local" or not user["active"] or user["deleted_at"]:
                reason = "user_inactive"
            elif not user["passkey_first"]:
                reason = "user_not_opted_in"
            elif cred.user_handle is None or cred.user_handle != user_handle(user["id"]):
                reason = "user_handle_mismatch"
            else:
                try:
                    _check(conn, row, cred, rec, True)
                except wa.WebAuthnError as exc:
                    reason = exc.reason
        if reason is None:
            principal = li.Principal(user_id=user["id"], username=user["username"], display_name=user["display_name"] or user["username"], source="local", via="cookie")
            li.TIERS.acct_clear(user["username"], ip)
            conn.execute("UPDATE auth_local_credentials SET last_sign_in_at = ?, last_sign_in_from = ?, updated_at = ? WHERE user_id = ?",
                         (_now_iso(), (masked + (" " + meta["country"] if meta.get("country") else "")).strip(), _now_iso(), user["id"]))
            value, s = li.create_session(conn, settings, conn_like, user["id"], factor=True, meta=meta)
            _audit(conn, actor=principal, action="auth.local.passkey.used", decision="allowed", resource_id=user["id"],
                   details={"passkey": row["id"], "step": "passwordless", "ip": masked}, request_id=request_id)
            _audit(conn, actor=principal, action="auth.local.sign_in.succeeded", decision="allowed", resource_id=user["id"],
                   details={"kind": s.kind, "ip": masked, "country": meta.get("country", ""), "factor": "passkey_first", "id": li.public_id(s.chain_id)},
                   request_id=request_id)
        else:
            li.TIERS.fail_global(ip)
            known = row is not None and user is not None
            write = True
            if not known:  # an unknown / malformed credential is something anyone can send: at most one row per address a minute
                write, _suppressed = REFUSAL_AUDITS.admit(f"local_passkey_refused|{ip}")
            if write:
                _failed(conn, row if known else None, reason, step="passwordless", ip_masked=masked, request_id=request_id)
    if reason is not None:
        return li.SignInResult(status="failed", sleep_s=base_sleep)
    _record_sign_in(db, principal, meta)
    return li.SignInResult(status="session", cookie=value, session=s, sleep_s=base_sleep, second_factor="none", must_change=bool(user["must_change"]),
                           user={"id": user["id"], "username": user["username"], "display_name": user["display_name"], "source": "local"})


# ---------------------------------------------------------------- Android app association (Digital Asset Links)

def android_targets(value: str | None) -> list[tuple[str, str]] | None:
    """`security.local_passkey_android`: lines `<package>:<SHA-256 fingerprint as AA:BB:..>` (one per app signing key); None when invalid."""
    import re

    out: list[tuple[str, str]] = []
    for line in (value or "").replace(",", "\n").splitlines():
        line = line.strip()
        if not line:
            continue
        pkg, sep, fp = line.partition(":")
        fp = fp.strip().upper()
        if not sep or not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+", pkg.strip()) or not re.fullmatch(r"([0-9A-F]{2}:){31}[0-9A-F]{2}", fp):
            return None
        out.append((pkg.strip(), fp))
    return out[:8]


def assetlinks(conn: Any) -> list[dict[str, Any]] | None:
    """The statement list, or None (nothing configured / the feature off)."""
    from ..db import get_setting
    from .local_identity import enabled

    if not enabled(conn):
        return None
    targets = android_targets(get_setting(conn, ANDROID_KEY, "") or "")
    if not targets:
        return None
    by_pkg: dict[str, list[str]] = {}
    for pkg, fp in targets:
        by_pkg.setdefault(pkg, []).append(fp)
    return [{"relation": ["delegate_permission/common.get_login_creds"],
             "target": {"namespace": "android_app", "package_name": pkg, "sha256_cert_fingerprints": fps}} for pkg, fps in by_pkg.items()]


def reset_for_tests() -> None:
    with _lock:
        _challenges.clear()
