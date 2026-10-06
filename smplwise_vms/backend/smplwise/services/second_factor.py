"""K11 first slice (CR-011, owner decisions 2026-10-06): the OPTIONAL second factor - a standard RFC 6238 TOTP, so Google
Authenticator, Microsoft Authenticator, 1Password and the like work (Arx ships no authenticator of its own).

- A user enrols and removes the factor in their own settings; nobody is forced (`security.second_factor_policy`
  defaults to `optional`; `admins` additionally refuses a remote sign-in of an administrator who has none).
- Where it applies: every NEW remote sign-in - `POST auth/session` creating a new browser session, and (security review
  2.2.0 H1) the first request or WebSocket of a new HA sign-in on the bearer path (`Authorization: Bearer <HA token>`
  without the Arx cookie; the code in `X-Arx-Second-Factor`, see services/ha_user_auth._bearer_session). The local
  Ingress channel is gated by Home Assistant's own login and stays the break-glass path; the rotation of an existing
  session and the next access token of a bearer sign-in that already showed the code need no new code.
  `security.second_factor_bearer = off` restores the old bearer behaviour (owner choice; audited per sign-in).
- What it does NOT protect: Home Assistant itself. An HA access token is a full HA credential on the same origin; only
  HA's own MFA protects HA.
- Turning the factor on, and an administrator's reset, end the user's other remote sign-ins (review M4).
- The secret is 20 random bytes, stored only as AES-256-GCM ciphertext (services/alarm_codes.py: the key file under
  `<data>/keys/`, never in a project backup) bound to the user id as associated data. Nothing here logs, audits or raises
  with a code, a secret or the key in it.
- A code is 6 digits, SHA-1, 30 s steps, one step of clock drift either way; a step already accepted is refused (replay).
- Wrong codes: 5 in 5 minutes lock the user out of code entry for 10 minutes (persisted in auth_totp_failures, so a restart does
  not reset it; expired rows are pruned by the janitor).
- Recovery: an administrator (system.configure) resets another user's factor from any channel; every reset is audited.
  Not their own (that is `disable`, with a code), and an administrator who has a factor shows their own current code
  (review M1).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
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
ENROLL_REQUIRED_HE = "מנהל המערכת דורש אימות דו־שלבי לחשבון הזה. הפעל אותו ב״החשבון שלי״ בכניסה מקומית, ואז היכנס מרחוק."


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
    """The wrong-code lockout, kept in `auth_totp_failures` (migration 0069, review item L4) so a restart does not reset it. It runs on
    the caller's connection: a wrong code is counted inside the request's transaction, which commits when the request answers 4xx
    (ApiError) or when the sign-in check catches the refusal. Before the migration (an older schema) it falls back to memory."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._mem: dict[str, tuple[list[float], float | None]] = {}

    @staticmethod
    def _now() -> float:
        return time.time()

    def _get(self, conn: sqlite3.Connection, user_id: str) -> tuple[list[float], float | None]:
        try:
            r = conn.execute("SELECT attempts_json, locked_until FROM auth_totp_failures WHERE user_id = ?", (user_id,)).fetchone()
        except sqlite3.OperationalError:
            with self._lock:
                return self._mem.get(user_id, ([], None))
        if r is None:
            return [], None
        try:
            attempts = [float(x) for x in json.loads(r["attempts_json"] or "[]")]
        except (ValueError, TypeError):
            attempts = []
        return attempts, r["locked_until"]

    def _put(self, conn: sqlite3.Connection, user_id: str, attempts: list[float], locked_until: float | None) -> None:
        try:
            conn.execute(
                "INSERT INTO auth_totp_failures(user_id, attempts_json, locked_until, updated_at) VALUES (?,?,?,?) "
                "ON CONFLICT(user_id) DO UPDATE SET attempts_json = excluded.attempts_json, locked_until = excluded.locked_until, updated_at = excluded.updated_at",
                (user_id, json.dumps(attempts), locked_until, self._now()))
        except sqlite3.OperationalError:
            with self._lock:
                self._mem[user_id] = (attempts, locked_until)

    def locked(self, conn: sqlite3.Connection, user_id: str) -> bool:
        attempts, until = self._get(conn, user_id)
        return until is not None and until > self._now()

    def fail(self, conn: sqlite3.Connection, user_id: str) -> bool:
        """Record a wrong code; True when this one locked the user out."""
        now = self._now()
        attempts, _ = self._get(conn, user_id)
        attempts = [t for t in attempts if now - t <= FAIL_WINDOW_S] + [now]
        if len(attempts) >= FAIL_MAX:
            self._put(conn, user_id, [], now + LOCK_S)
            return True
        self._put(conn, user_id, attempts, None)
        return False

    def clear(self, conn: sqlite3.Connection, user_id: str) -> None:
        try:
            conn.execute("DELETE FROM auth_totp_failures WHERE user_id = ?", (user_id,))
        except sqlite3.OperationalError:
            pass
        with self._lock:
            self._mem.pop(user_id, None)

    def prune(self, conn: sqlite3.Connection) -> int:
        """Rows that can no longer matter: no lockout running and the newest wrong code older than the window, or a lockout that ended."""
        now = self._now()
        try:
            return conn.execute(
                "DELETE FROM auth_totp_failures WHERE (locked_until IS NULL OR locked_until <= ?) AND updated_at < ?", (now, now - FAIL_WINDOW_S)).rowcount
        except sqlite3.OperationalError:
            return 0


FAILURES = _Failures()


def janitor(db: Any) -> int:
    """main.janitor_tick: expired lockout rows. A read first, so a quiet installation takes the write lock never."""
    now = time.time()
    with db.connection(mode="read", label="second_factor.janitor_read") as conn:
        try:
            due = conn.execute("SELECT 1 FROM auth_totp_failures WHERE (locked_until IS NULL OR locked_until <= ?) AND updated_at < ? LIMIT 1", (now, now - FAIL_WINDOW_S)).fetchone()
        except sqlite3.OperationalError:
            return 0
    if due is None:
        return 0
    with db.connection(label="second_factor.janitor") as conn:
        return FAILURES.prune(conn)


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
    if FAILURES.locked(conn, user_id):
        raise SecondFactorError("locked", LOCKED_HE)
    r = _row(conn, user_id)

    def wrong() -> SecondFactorError:
        return SecondFactorError("locked", LOCKED_HE) if FAILURES.fail(conn, user_id) else SecondFactorError("invalid", INVALID_HE)

    if r is None or bool(r["enabled"]) == pending:
        raise wrong()
    step = match_step(_secret_of(settings, r), normalize_code(code))
    if step is None or step <= int(r["last_step"]):
        raise wrong()
    # the conditional update is the replay guard even across two concurrent requests
    if conn.execute("UPDATE auth_totp SET last_step = ?, last_used_at = ? WHERE user_id = ? AND last_step < ?", (step, now_iso(), user_id, step)).rowcount != 1:
        raise wrong()
    FAILURES.clear(conn, user_id)


def confirm(conn: sqlite3.Connection, settings: Settings, user_id: str, code: Any) -> None:
    verify(conn, settings, user_id, code, pending=True)
    conn.execute("UPDATE auth_totp SET enabled = 1, enabled_at = ? WHERE user_id = ?", (now_iso(), user_id))


def remove(conn: sqlite3.Connection, user_id: str) -> bool:
    FAILURES.clear(conn, user_id)
    return conn.execute("DELETE FROM auth_totp WHERE user_id = ?", (user_id,)).rowcount > 0


def policy(conn: sqlite3.Connection) -> str:
    from ..db import get_setting

    v = get_setting(conn, POLICY_KEY, DEFAULT_POLICY) or DEFAULT_POLICY
    return v if v in POLICIES else DEFAULT_POLICY


# ---------------------------------------------------------------- per-user and per-role policy override (TFA2)

OVERRIDE_VALUES = ("inherit", "optional", "required")
OVERRIDE_KINDS = ("user", "role")


def overrides(conn: sqlite3.Connection) -> dict[str, dict[str, str]]:
    """Every stored override: {"user": {user_id: policy}, "role": {role_id: policy}} (a subject with no row inherits)."""
    out: dict[str, dict[str, str]] = {"user": {}, "role": {}}
    try:
        for r in conn.execute("SELECT subject_kind, subject_id, policy FROM auth_totp_policy").fetchall():
            out[r["subject_kind"]][r["subject_id"]] = r["policy"]
    except sqlite3.OperationalError:
        pass
    return out


def set_override(conn: sqlite3.Connection, kind: str, subject_id: str, value: str, actor_id: str | None) -> str | None:
    """Store `optional` / `required`, or drop the row for `inherit`. Returns the previous value (None = inherit)."""
    before = conn.execute("SELECT policy FROM auth_totp_policy WHERE subject_kind = ? AND subject_id = ?", (kind, subject_id)).fetchone()
    if value == "inherit":
        conn.execute("DELETE FROM auth_totp_policy WHERE subject_kind = ? AND subject_id = ?", (kind, subject_id))
    else:
        conn.execute(
            "INSERT INTO auth_totp_policy(subject_kind, subject_id, policy, updated_at, updated_by) VALUES (?,?,?,?,?) "
            "ON CONFLICT(subject_kind, subject_id) DO UPDATE SET policy = excluded.policy, updated_at = excluded.updated_at, updated_by = excluded.updated_by",
            (kind, subject_id, value, now_iso(), actor_id))
    return before["policy"] if before else None


def _role_ids(conn: sqlite3.Connection, principal: Any) -> list[str]:
    from ..rbac import _active_bindings

    return sorted({b["role_id"] for b in _active_bindings(conn, principal) if b["effect"] == "allow"})


def users_of_role(conn: sqlite3.Connection, role_id: str) -> list[str]:
    """Users holding the role through an active allow binding, directly or through a group."""
    now = now_iso()
    rows = conn.execute(
        """SELECT subject_kind, subject_id FROM bindings WHERE role_id = ? AND effect = 'allow' AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?)""", (role_id, now)).fetchall()
    users: set[str] = set()
    for r in rows:
        if r["subject_kind"] == "user":
            users.add(r["subject_id"])
        else:
            users.update(m[0] for m in conn.execute("SELECT user_id FROM group_members WHERE group_id = ?", (r["subject_id"],)).fetchall())
    return sorted(users)


def effective_policy(conn: sqlite3.Connection, principal: Any, admin_permissions: frozenset[str]) -> tuple[str, str]:
    """What the policy says for this user: ("required" | "optional", source) with source `user` | `role` | `global`.
    Precedence: the user's own override, then the roles (ANY role `required` wins; otherwise any role `optional`), then the global
    `security.second_factor_policy` (`admins` = required for holders of an administrative permission)."""
    from ..rbac import permissions_anywhere

    ov = overrides(conn)
    own = ov["user"].get(principal.user_id)
    if own in ("optional", "required"):
        return own, "user"
    role_values = [ov["role"][r] for r in _role_ids(conn, principal) if r in ov["role"]]
    if "required" in role_values:
        return "required", "role"
    if "optional" in role_values:
        return "optional", "role"
    if policy(conn) == "admins" and set(permissions_anywhere(conn, principal)) & admin_permissions:
        return "required", "global"
    return "optional", "global"
