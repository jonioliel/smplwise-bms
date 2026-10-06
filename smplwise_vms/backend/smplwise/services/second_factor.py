"""K11 first slice (CR-011, owner decisions 2026-10-06): the OPTIONAL second factor - a standard RFC 6238 TOTP, so Google
Authenticator, Microsoft Authenticator, 1Password and the like work (Arx ships no authenticator of its own).

- A user enrols and removes the factor in their own settings; nobody is forced (`security.second_factor_policy`
  defaults to `optional`; `admins` additionally refuses a remote sign-in of an administrator who has none).
- Where it applies: the REMOTE sign-in (`POST auth/session` creating a new browser session). The local Ingress channel is
  gated by Home Assistant's own login and stays the break-glass path; the rotation of an existing session and the bearer
  path are unchanged in this slice.
- The secret is 20 random bytes, stored only as AES-256-GCM ciphertext (services/alarm_codes.py: the key file under
  `<data>/keys/`, never in a project backup) bound to the user id as associated data. Nothing here logs, audits or raises
  with a code, a secret or the key in it.
- A code is 6 digits, SHA-1, 30 s steps, one step of clock drift either way; a step already accepted is refused (replay).
- Wrong codes: 5 in 5 minutes lock the user out of code entry for 10 minutes (in memory, per process).
- Recovery: an administrator (system.configure) resets another user's factor from any channel; every reset is audited.
"""
from __future__ import annotations

import base64
import collections
import hashlib
import hmac
import secrets
import sqlite3
import struct
import threading
import time
from typing import Any
from urllib.parse import quote

from ..config import Settings
from ..db import now_iso
from . import alarm_codes

PERIOD_S = 30
DIGITS = 6
DRIFT_STEPS = 1
SECRET_BYTES = 20
ISSUER = "SmplWise Arx"
POLICIES = ("optional", "admins")
DEFAULT_POLICY = "optional"
POLICY_KEY = "security.second_factor_policy"

FAIL_MAX = 5
FAIL_WINDOW_S = 300.0
LOCK_S = 600.0

INVALID_HE = "קוד האימות אינו נכון. בדוק את הקוד באפליקציית האימות ונסה שוב."
LOCKED_HE = "יותר מדי קודים שגויים. נסה שוב בעוד כמה דקות."
REQUIRED_HE = "נדרש קוד אימות מאפליקציית האימות."
ENROLL_REQUIRED_HE = "מנהל המערכת דורש אימות דו־שלבי למשתמשי ניהול. הפעל אותו ב״החשבון שלי״ בכניסה מקומית, ואז היכנס מרחוק."


# ---------------------------------------------------------------- RFC 4226 / 6238

def hotp(secret: bytes, counter: int, digits: int = DIGITS) -> str:
    mac = hmac.new(secret, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = mac[-1] & 0x0F
    value = (struct.unpack(">I", mac[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(value).zfill(digits)


def step_of(at: float | None = None) -> int:
    return int((time.time() if at is None else at) // PERIOD_S)


def match_step(secret: bytes, code: str, at: float | None = None) -> int | None:
    """The time step whose code equals `code` (within the drift window), else None. Constant-time comparisons."""
    if not (isinstance(code, str) and len(code) == DIGITS and code.isascii() and code.isdigit()):
        return None
    now = step_of(at)
    found: int | None = None
    for s in range(now - DRIFT_STEPS, now + DRIFT_STEPS + 1):
        if hmac.compare_digest(hotp(secret, s), code):
            found = s
    return found


def normalize_code(raw: Any) -> str:
    return "".join(str(raw or "").split())[:12]


def provisioning_uri(secret: bytes, account: str) -> str:
    b32 = base64.b32encode(secret).decode("ascii").rstrip("=")
    label = quote(f"{ISSUER}:{account}", safe="")
    return f"otpauth://totp/{label}?secret={b32}&issuer={quote(ISSUER, safe='')}&algorithm=SHA1&digits={DIGITS}&period={PERIOD_S}"


# ---------------------------------------------------------------- wrong-code lockout

class _Failures:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._fails: dict[str, collections.deque] = {}
        self._locked: dict[str, float] = {}

    def locked(self, user_id: str) -> bool:
        with self._lock:
            until = self._locked.get(user_id)
            if until is None:
                return False
            if until <= time.time():
                self._locked.pop(user_id, None)
                self._fails.pop(user_id, None)
                return False
            return True

    def fail(self, user_id: str) -> bool:
        """Record a wrong code; True when this one locked the user out."""
        now = time.time()
        with self._lock:
            q = self._fails.setdefault(user_id, collections.deque())
            while q and now - q[0] > FAIL_WINDOW_S:
                q.popleft()
            q.append(now)
            if len(q) >= FAIL_MAX:
                self._locked[user_id] = now + LOCK_S
                q.clear()
                return True
            return False

    def clear(self, user_id: str | None = None) -> None:
        with self._lock:
            if user_id is None:
                self._fails.clear()
                self._locked.clear()
            else:
                self._fails.pop(user_id, None)
                self._locked.pop(user_id, None)


FAILURES = _Failures()


class SecondFactorError(Exception):
    """A verification outcome: code is `invalid`, `locked` or `unreadable`; the message is fixed text."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# ---------------------------------------------------------------- storage

def _row(conn: sqlite3.Connection, user_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM auth_totp WHERE user_id = ?", (user_id,)).fetchone()


def _ad(user_id: str) -> str:
    return "totp:" + user_id


def is_enrolled(conn: sqlite3.Connection, user_id: str) -> bool:
    try:
        r = conn.execute("SELECT enabled FROM auth_totp WHERE user_id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:
        return False
    return bool(r and r["enabled"])


def status(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    """What the API may say: whether the factor is active, when it was enabled and last used. Never the secret."""
    r = _row(conn, user_id)
    on = bool(r and r["enabled"])
    return {"enabled": on, "enabled_at": r["enabled_at"] if on else None, "last_used_at": r["last_used_at"] if on else None}


def enrolled_users(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    try:
        rows = conn.execute("SELECT user_id, enabled_at, last_used_at FROM auth_totp WHERE enabled = 1").fetchall()
    except sqlite3.OperationalError:
        return {}
    return {r["user_id"]: {"enabled_at": r["enabled_at"], "last_used_at": r["last_used_at"]} for r in rows}


def begin_enrolment(conn: sqlite3.Connection, settings: Settings, user_id: str, account: str) -> dict[str, str]:
    """A fresh secret for a user who has no ACTIVE factor (a pending one is replaced; the caller refuses an active one).
    The only time the secret leaves the server; the factor is not active until `confirm` accepts a first code."""
    secret = secrets.token_bytes(SECRET_BYTES)
    conn.execute(
        "INSERT INTO auth_totp(user_id, secret_ct, enabled, created_at) VALUES (?, ?, 0, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET secret_ct = excluded.secret_ct, created_at = excluded.created_at, "
        "enabled_at = NULL, last_used_at = NULL, last_step = 0 WHERE auth_totp.enabled = 0",
        (user_id, alarm_codes.encrypt(settings, _ad(user_id), base64.b64encode(secret).decode("ascii")), now_iso()))
    return {"secret": base64.b32encode(secret).decode("ascii").rstrip("="), "otpauth_uri": provisioning_uri(secret, account), "issuer": ISSUER}


def _secret_of(settings: Settings, r: sqlite3.Row) -> bytes:
    try:
        return base64.b64decode(alarm_codes.decrypt(settings, _ad(r["user_id"]), r["secret_ct"]))
    except alarm_codes.CodeError:
        raise SecondFactorError("unreadable", "לא ניתן לקרוא את סוד האימות. מנהל המערכת יכול לאפס אותו.") from None


def verify(conn: sqlite3.Connection, settings: Settings, user_id: str, code: Any, *, pending: bool = False) -> None:
    """Check a code against the user's ACTIVE factor (`pending=True`: the not-yet-confirmed secret, for the enrolment's
    first code). Raises SecondFactorError (`locked` | `invalid` | `unreadable`); on success the step is marked used. Wrong
    codes count towards the lockout."""
    if FAILURES.locked(user_id):
        raise SecondFactorError("locked", LOCKED_HE)
    r = _row(conn, user_id)

    def wrong() -> SecondFactorError:
        return SecondFactorError("locked", LOCKED_HE) if FAILURES.fail(user_id) else SecondFactorError("invalid", INVALID_HE)

    if r is None or bool(r["enabled"]) == pending:
        raise wrong()
    step = match_step(_secret_of(settings, r), normalize_code(code))
    if step is None or step <= int(r["last_step"]):
        raise wrong()
    # the conditional update is the replay guard even across two concurrent requests
    if conn.execute("UPDATE auth_totp SET last_step = ?, last_used_at = ? WHERE user_id = ? AND last_step < ?", (step, now_iso(), user_id, step)).rowcount != 1:
        raise wrong()
    FAILURES.clear(user_id)


def confirm(conn: sqlite3.Connection, settings: Settings, user_id: str, code: Any) -> None:
    verify(conn, settings, user_id, code, pending=True)
    conn.execute("UPDATE auth_totp SET enabled = 1, enabled_at = ? WHERE user_id = ?", (now_iso(), user_id))


def remove(conn: sqlite3.Connection, user_id: str) -> bool:
    FAILURES.clear(user_id)
    return conn.execute("DELETE FROM auth_totp WHERE user_id = ?", (user_id,)).rowcount > 0


def policy(conn: sqlite3.Connection) -> str:
    from ..db import get_setting

    v = get_setting(conn, POLICY_KEY, DEFAULT_POLICY) or DEFAULT_POLICY
    return v if v in POLICIES else DEFAULT_POLICY
