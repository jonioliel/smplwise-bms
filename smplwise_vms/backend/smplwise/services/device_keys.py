"""MFA-DEVICEKEY-2490 (MFA-STEPUP-TRAIN-2490 slice 8; design docs/design/full-2fa-t095/DESIGN.md 4.2, 4.4, 6, 7, 8): the phone key.

The Android app makes an EC P-256 key in the Keystore that can sign only right after the phone confirmed its user (BiometricPrompt +
CryptoObject; `security.device_key_auth` = `biometric_or_screen_lock` by default, owner q23 b, or `biometric`). The server keeps the
PUBLIC key only (`auth_device_keys`, migration 0222) and checks ES256 signatures (services/app_refresh_key.verify - the same primitive
and the same `cryptography` dependency as the app's refresh key, which is NOT user-verification bound and is not this key).

What a signature can be used for (`purpose`):

* `register` - the key's own registration: the new key signs a challenge of the signed-in user's session (proof of possession);
* `step_up`  - a step-up proof (services/step_up) on the caller's session, method `device_key` (`POST auth/step-up/verify`);
* `sign_in`  - the second factor of a sign-in (owner Q51: in the app, password + phone key counts as two-factor): the answer goes in the
  sign-in's existing `X-Arx-Second-Factor` header (or the Arx-only second step's `code`) as `dk1:<challenge_id>:<signature>`.

Every challenge is server-made, single use (spent at the first presentation, also when it is then refused), lives CHALLENGE_TTL_S, and
is bound to its purpose, the origin the request reached (`<scheme>://<host>`), the user (register / step_up), the session (register /
step_up), the key (step_up / sign_in, when named) and the action (step_up). The exact bytes the key signs (`payload`) carry all of them,
so a signature made for one purpose, origin, user, key, action or nonce never verifies for another. The app shows the action text in
the phone's prompt and refuses to sign a payload whose origin is not its own server (mobile/android-shell DeviceKey.kt).

Wrong signatures count towards a lockout of the phone-key method (5 in 5 minutes -> 10 minutes, persisted in `auth_totp_failures`
under the key `dk:<user id>`, separate from the authenticator-code lockout - design 8.2 "method lockouts stay per method").

Hardware attestation is slice 9 (DEVICEKEY-ATTEST, owner Q52): `check_attestation()` is the hook; today it checks nothing and stores
nothing (`attestation_json` stays NULL, the key row says `attested: not_checked`).

Nothing here logs, audits or returns a nonce, a signature or key material: audit rows carry the key id, a 16-hex fingerprint prefix and
the declared auth kind only."""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any

from ..errors import ApiError
from . import app_refresh_key as ark
from . import second_factor as sf

TABLE = "auth_device_keys"
ID_PREFIX = "dk_"
KEY_ID_PATTERN = r"^dk_[0-9a-f]{24}$"
NONCE_PREFIX = "dkn_"
CHALLENGE_PATTERN = r"^dkn_[A-Za-z0-9_-]{40,60}$"
ANSWER_PREFIX = "dk1:"  # the sign-in answer in X-Arx-Second-Factor / the local second step: dk1:<challenge_id>:<signature>
ANSWER_MAX = 260

PAYLOAD_PREFIX = "arx-device-key"
PAYLOAD_VERSION = "v1"
PURPOSE_REGISTER = "register"
PURPOSE_STEP_UP = "step_up"
PURPOSE_SIGN_IN = "sign_in"
PURPOSES = (PURPOSE_REGISTER, PURPOSE_STEP_UP, PURPOSE_SIGN_IN)

AUTH_KEY = "security.device_key_auth"
AUTH_BIOMETRIC = "biometric"
AUTH_ANY = "biometric_or_screen_lock"
AUTH_KINDS = (AUTH_BIOMETRIC, AUTH_ANY)
DEFAULT_AUTH = AUTH_ANY  # owner q23 b: biometric OR the phone's screen code

METHOD = "device_key"  # the step-up method name (services/step_up)
FAIL_PREFIX = "dk:"  # the lockout row key in auth_totp_failures (never a real user id: those have no colon)

CHALLENGE_TTL_S = 60.0
MAX_OPEN_PER_SUBJECT = 5  # live challenges per user (register / step_up) or per key (sign_in); the oldest is dropped
MAX_OPEN = 5000
MAX_KEYS_PER_USER = 5
LABEL_MAX = 60

INVALID_HE = "האימות במפתח הטלפון לא הצליח. נסה שוב מהאפליקציה."
LOCKED_HE = "יותר מדי ניסיונות שגויים במפתח הטלפון. נסה שוב בעוד כמה דקות."
REGISTER_INVALID_HE = "רישום מפתח הטלפון לא הצליח. נסה שוב מהאפליקציה."
EXISTS_HE = "המפתח הזה כבר רשום."
LIMIT_HE = "הגעת למספר המרבי של מפתחות טלפון בחשבון. הסר מפתח ישן ונסה שוב."
KIND_HE = "ההגדרות של המערכת דורשות טביעת אצבע או זיהוי פנים בלבד (לא קוד מסך) עבור מפתח הטלפון."
UNKNOWN_HE = "מפתח הטלפון לא נמצא."
NO_KEY_HE = "אין לחשבון הזה מפתח טלפון פעיל."


class DeviceKeyError(sf.SecondFactorError):
    """A refused phone-key signature: `code` is `invalid` or `locked` (the shapes of the authenticator code, so the sign-in and step-up
    answers stay the same); `reason` says why for the audit row (challenge_unknown | challenge_mismatch | key_unknown | signature |
    locked | malformed) and never carries input."""

    def __init__(self, code: str, message: str, reason: str):
        super().__init__(code, message)
        self.reason = reason


def _now() -> float:
    return time.time()


def _iso(ts: float) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ts, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------- settings

def auth_setting(conn: sqlite3.Connection) -> str:
    from ..db import get_setting

    value = get_setting(conn, AUTH_KEY, DEFAULT_AUTH) or DEFAULT_AUTH
    return value if value in AUTH_KINDS else DEFAULT_AUTH


def allowed_kinds(conn: sqlite3.Connection) -> list[str]:
    """`biometric`: only a key that needs a biometric for every signature; `biometric_or_screen_lock` (default): either kind."""
    return [AUTH_BIOMETRIC] if auth_setting(conn) == AUTH_BIOMETRIC else list(AUTH_KINDS)


# ---------------------------------------------------------------- the origin and the exact bytes a key signs

def origin_of(settings: Any, conn_like: Any) -> str:
    """`<scheme>://<host>` the request reached (the scheme rule of ha_user_auth.arx_client_id: the add-on is always https behind the
    tunnel). The app compares it with its own server's origin before it signs."""
    host = (conn_like.headers.get("host") or "").strip().lower()
    if not host:
        return ""
    if getattr(settings, "in_addon", False):
        proto = "https"
    else:
        proto = (conn_like.headers.get("x-forwarded-proto") or conn_like.url.scheme or "http").split(",")[0].strip().lower()
    proto = {"ws": "http", "wss": "https"}.get(proto, proto)  # a WebSocket sign-in (bearer path) reaches the same origin
    return f"{proto}://{host}"


def payload(purpose: str, origin: str, user_id: str | None, key_id: str | None, action: str | None, nonce: str) -> str:
    """`arx-device-key|v1|<purpose>|<origin>|<user id or ->|<key id or ->|<action or ->|<nonce>` - UTF-8, no trailing newline. A field can
    never hold the separator (origins, ids, action names and nonces have no `|`); one that does is refused rather than escaped."""
    fields = (PAYLOAD_PREFIX, PAYLOAD_VERSION, purpose, origin, user_id or "-", key_id or "-", action or "-", nonce)
    if any("|" in f or not f for f in fields):
        raise ValueError("device key payload field")
    return "|".join(fields)


# ---------------------------------------------------------------- challenges (memory, single use)

@dataclass
class Challenge:
    purpose: str
    origin: str
    nonce: str
    expires: float
    user_id: str | None = None
    key_id: str | None = None
    action: str | None = None
    session: str | None = None  # the step-up session key (services/step_up.session_key) - register / step_up only

    def subject(self) -> str:
        return f"{self.purpose}:{self.user_id or self.key_id or '-'}"

    def message(self) -> bytes:
        # sign_in: the user is not known when the challenge is made (before the first factor); the key binds it
        user = None if self.purpose == PURPOSE_SIGN_IN else self.user_id
        return payload(self.purpose, self.origin, user, self.key_id, self.action, self.nonce).encode("utf-8")


_LOCK = threading.Lock()
_POOL: dict[str, Challenge] = {}  # sha256(challenge id) -> challenge, insertion order = age


def _h(challenge_id: str) -> str:
    return hashlib.sha256(("device-key-challenge|" + challenge_id).encode("utf-8", "replace")).hexdigest()


def issue(purpose: str, origin: str, *, user_id: str | None = None, key_id: str | None = None, action: str | None = None,
          session: str | None = None) -> tuple[str, str, int]:
    """A fresh challenge. Returns (challenge id = the nonce, the payload the app signs, seconds it lives)."""
    if purpose not in PURPOSES:
        raise ValueError("purpose")
    nonce = NONCE_PREFIX + secrets.token_urlsafe(32)
    ch = Challenge(purpose=purpose, origin=origin, nonce=nonce, expires=_now() + CHALLENGE_TTL_S, user_id=user_id, key_id=key_id,
                   action=action, session=session)
    text = ch.message().decode("utf-8")  # validates the fields before anything is stored
    with _LOCK:
        now = _now()
        for k in [k for k, c in _POOL.items() if c.expires <= now]:
            _POOL.pop(k, None)
        mine = [k for k, c in _POOL.items() if c.subject() == ch.subject()]
        for k in mine[: max(0, len(mine) - MAX_OPEN_PER_SUBJECT + 1)]:
            _POOL.pop(k, None)
        while len(_POOL) >= MAX_OPEN:
            _POOL.pop(next(iter(_POOL)), None)
        _POOL[_h(nonce)] = ch
    return nonce, text, int(CHALLENGE_TTL_S)


def take(challenge_id: Any) -> Challenge | None:
    """Spend a challenge (single use: it is gone whatever happens next). None: unknown, already spent or expired."""
    if not isinstance(challenge_id, str) or not challenge_id.startswith(NONCE_PREFIX) or len(challenge_id) > 80:
        return None
    with _LOCK:
        ch = _POOL.pop(_h(challenge_id), None)
    if ch is None or ch.expires <= _now():
        return None
    return ch


def reset_for_tests() -> None:
    with _LOCK:
        _POOL.clear()


# ---------------------------------------------------------------- rows

def _rows(conn: sqlite3.Connection, sql: str, args: tuple[Any, ...]) -> list[sqlite3.Row]:
    try:
        return conn.execute(sql, args).fetchall()
    except sqlite3.OperationalError:  # before migration 0222 (an older schema): no phone keys at all
        return []


def active_rows(conn: sqlite3.Connection, user_id: str) -> list[sqlite3.Row]:
    return _rows(conn, f"SELECT * FROM {TABLE} WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at, id", (user_id,))


def has_active(conn: sqlite3.Connection, user_id: str) -> bool:
    return bool(_rows(conn, f"SELECT 1 FROM {TABLE} WHERE user_id = ? AND revoked_at IS NULL LIMIT 1", (user_id,)))


def _active_row(conn: sqlite3.Connection, user_id: str, key_id: Any) -> sqlite3.Row | None:
    if not isinstance(key_id, str) or not key_id.startswith(ID_PREFIX) or len(key_id) > 40:
        return None
    rows = _rows(conn, f"SELECT * FROM {TABLE} WHERE id = ? AND user_id = ? AND revoked_at IS NULL", (key_id, user_id))
    return rows[0] if rows else None


def view(row: sqlite3.Row) -> dict[str, Any]:
    """What the API may say about a key: never the public key, never the full fingerprint."""
    return {"id": row["id"], "label": row["label"] or "", "auth_kind": row["auth_kind"], "platform": row["platform"],
            "created_at": row["created_at"], "last_used_at": row["last_used_at"],
            # slice 9 (DEVICEKEY-ATTEST) turns this into hardware | software | none from attestation_json
            "attested": "not_checked"}


def check_attestation(conn: sqlite3.Connection, attestation: Any, challenge: Challenge) -> str | None:
    """HOOK for slice 9 (DEVICEKEY-ATTEST, owner Q52; design 4.4a): verify the Keystore attestation chain of the new key offline against
    the pinned Google roots (the registration nonce is the attestation challenge), apply `security.device_key_attestation` (off /
    preferred / required) and return the JSON to keep in `attestation_json`. This slice checks nothing and keeps nothing: None."""
    return None


# ---------------------------------------------------------------- registration

def register(conn: sqlite3.Connection, user_id: str, *, challenge_id: Any, public_key: str, signature: str, label: str, auth_kind: str,
             origin: str, session: str | None, attestation: Any = None) -> sqlite3.Row:
    """Register the key that signed a `register` challenge of this user's session. Raises ApiError (400 device_key_invalid, 409
    device_key_exists / device_key_limit, 422 device_key_auth_kind). The caller audits and notifies."""
    ch = take(challenge_id)
    if ch is None or ch.purpose != PURPOSE_REGISTER or ch.user_id != user_id or ch.origin != origin or ch.session != session:
        raise ApiError(400, "device_key_invalid", REGISTER_INVALID_HE, details={"reason": "challenge"})
    try:
        spki, fp = ark.parse_public_key(public_key)
    except ark.BadKey:
        raise ApiError(400, "device_key_invalid", REGISTER_INVALID_HE, details={"reason": "public_key"}) from None
    if not ark.verify(spki, signature, ch.message()):
        raise ApiError(400, "device_key_invalid", REGISTER_INVALID_HE, details={"reason": "signature"})
    if auth_kind not in allowed_kinds(conn):
        raise ApiError(422, "device_key_auth_kind", KIND_HE, details={"allowed": allowed_kinds(conn)})
    if conn.execute(f"SELECT 1 FROM {TABLE} WHERE fp = ?", (fp,)).fetchone() is not None:
        raise ApiError(409, "device_key_exists", EXISTS_HE)
    if len(active_rows(conn, user_id)) >= MAX_KEYS_PER_USER:
        raise ApiError(409, "device_key_limit", LIMIT_HE, details={"max": MAX_KEYS_PER_USER})
    attested = check_attestation(conn, attestation, ch)
    key_id = ID_PREFIX + secrets.token_hex(12)
    conn.execute(f"""INSERT INTO {TABLE}(id, user_id, label, spki, fp, alg, auth_kind, platform, created_at, attestation_json)
                     VALUES (?, ?, ?, ?, ?, 'ES256', ?, 'android', ?, ?)""",
                 (key_id, user_id, (label or "").strip()[:LABEL_MAX], spki, fp, auth_kind, _iso(_now()), attested))
    return conn.execute(f"SELECT * FROM {TABLE} WHERE id = ?", (key_id,)).fetchone()


# ---------------------------------------------------------------- verification (step-up, sign-in)

def check(conn: sqlite3.Connection, user_id: str, challenge_id: Any, signature: Any, *, purpose: str, origin: str, key_id: Any = None,
          session: str | None = None, action: str | None = None) -> sqlite3.Row:
    """Verify one signature of `user_id`'s active key over a challenge of `purpose`. The challenge is spent whatever the outcome.
    Returns the key row (its use is recorded). Raises DeviceKeyError (`locked` | `invalid`); a refusal counts towards the lockout."""
    fail_key = FAIL_PREFIX + user_id
    if sf.FAILURES.locked(conn, fail_key):
        take(challenge_id)  # spent all the same
        raise DeviceKeyError("locked", LOCKED_HE, "locked")
    ch = take(challenge_id)

    def wrong(reason: str) -> DeviceKeyError:
        locked = sf.FAILURES.fail(conn, fail_key)
        return DeviceKeyError("locked", LOCKED_HE, reason) if locked else DeviceKeyError("invalid", INVALID_HE, reason)

    if ch is None:
        raise wrong("challenge_unknown")  # unknown, expired or replayed
    if ch.purpose != purpose or ch.origin != origin:
        raise wrong("challenge_mismatch")
    if ch.user_id is not None and ch.user_id != user_id:
        raise wrong("challenge_mismatch")
    if purpose == PURPOSE_STEP_UP and (ch.session is None or ch.session != session or (ch.action or None) != (action or None)):
        raise wrong("challenge_mismatch")
    if ch.key_id is not None and key_id is not None and key_id != ch.key_id:
        raise wrong("challenge_mismatch")
    row = _active_row(conn, user_id, ch.key_id or key_id)
    if row is None:
        raise wrong("key_unknown")  # another user's key, a revoked key, or no key at all
    if not isinstance(signature, str) or not ark.verify(row["spki"], signature, ch.message()):
        raise wrong("signature")
    conn.execute(f"UPDATE {TABLE} SET last_used_at = ?, sign_count = sign_count + 1 WHERE id = ?", (_iso(_now()), row["id"]))
    sf.FAILURES.clear(conn, fail_key)
    return row


def is_answer(text: Any) -> bool:
    return isinstance(text, str) and text.startswith(ANSWER_PREFIX)


def parse_answer(text: str) -> tuple[str, str] | None:
    """`dk1:<challenge_id>:<signature>` -> (challenge id, signature); None when it is not that shape."""
    if not is_answer(text) or len(text) > ANSWER_MAX:
        return None
    parts = text[len(ANSWER_PREFIX):].split(":")
    if len(parts) != 2 or not all(parts):
        return None
    return parts[0], parts[1]


def check_sign_in_answer(conn: sqlite3.Connection, user_id: str, answer: str, origin: str) -> sqlite3.Row:
    """Owner Q51: the phone key as the second factor of a sign-in (after the password / the HA token identified the user)."""
    parsed = parse_answer(answer)
    if parsed is None:
        fail_key = FAIL_PREFIX + user_id
        if sf.FAILURES.locked(conn, fail_key):
            raise DeviceKeyError("locked", LOCKED_HE, "locked")
        raise DeviceKeyError("locked", LOCKED_HE, "malformed") if sf.FAILURES.fail(conn, fail_key) else DeviceKeyError("invalid", INVALID_HE, "malformed")
    return check(conn, user_id, parsed[0], parsed[1], purpose=PURPOSE_SIGN_IN, origin=origin)


# ---------------------------------------------------------------- revocation

def revoke(conn: sqlite3.Connection, user_id: str, key_id: Any, *, by: str, reason: str) -> sqlite3.Row | None:
    """Revoke one active key of the user (the row stays). Returns the row as it was, or None when there was no such active key."""
    row = _active_row(conn, user_id, key_id)
    if row is None:
        return None
    conn.execute(f"UPDATE {TABLE} SET revoked_at = ?, revoked_by = ?, revoked_reason = ? WHERE id = ? AND revoked_at IS NULL",
                 (_iso(_now()), by, reason[:40], row["id"]))
    return row


def revoke_all(conn: sqlite3.Connection, user_id: str, *, by: str, reason: str) -> int:
    """Every active key of the user (the administrator's factor reset of slice 10 RESET-HARDENING calls this). Returns how many."""
    try:
        return conn.execute(f"UPDATE {TABLE} SET revoked_at = ?, revoked_by = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL",
                            (_iso(_now()), by, reason[:40], user_id)).rowcount
    except sqlite3.OperationalError:
        return 0


def fingerprint_prefix(row: sqlite3.Row) -> str | None:
    return ark.fingerprint_prefix(row["fp"])


from ..test_reset import register_reset  # noqa: E402 - imports nothing from the package

register_reset(__name__, ("_POOL",), reset_for_tests)
