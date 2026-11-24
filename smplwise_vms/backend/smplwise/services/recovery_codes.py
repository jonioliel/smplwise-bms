"""MFA-RECOVERY-CODES-2490 (MFA-STEPUP-TRAIN-2490 slice 7; owner decision Q49, 2026-11-22): one-time recovery codes for the
authenticator-app second factor (services/second_factor.py).

- 10 codes per user, `XXXX-XXXX` in Crockford base32 (40 random bits each; O / I / L typed by mistake are read as 0 / 1 / 1, case,
  spaces and the dash do not matter). Generated when the factor is turned on (the enrolment's confirm answer carries them) and on
  demand (`POST auth/recovery-codes`, which needs a fresh step-up: a proof from the last minutes or the current authenticator code).
  A new batch deletes the previous one, so an old code stops working at once.
- Stored only as scrypt PHC hashes (services/local_passwords.hash_password with RECOVERY_PROFILE, a lighter cost than the passwords:
  a code is machine-made, not chosen by a person); compared by local_passwords.verify (constant time). Shown ONCE, never readable again.
- Each code works once (a conditional UPDATE marks it spent, also between two concurrent requests). A code is accepted wherever the
  current authenticator code is accepted as a FACTOR: the remote sign-in step (X-Arx-Second-Factor), the Arx-only sign-in's second
  step, a step-up proof (`POST auth/step-up/verify {method: "recovery_code"}`), and removing one's own factor (the lost-phone path:
  remove, then enrol again). It is NOT accepted where a step-up of someone else's account is demanded (the administrator's reset, the
  bridge-key reveal) - those keep asking for the live code.
- Wrong codes share the factor's lockout (5 wrong in 5 minutes lock code entry for 10 minutes, second_factor.FAILURES) and the routes'
  rate limits, so a recovery code cannot be guessed faster than an authenticator code.
- Every use and every generation is audited (where, how many codes remain) - never a code. Removing or resetting the factor deletes
  the codes. The table never travels in a backup.
"""
from __future__ import annotations

import secrets
import sqlite3
from typing import Any

from ..db import now_iso
from . import local_passwords as lp

COUNT = 10
CHARS = 8  # 8 x 5 bits = 40 bits per code
LOW_AT = 3  # remaining <= LOW_AT -> the screen warns (and offers a new batch)
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # Crockford base32: no I, L, O, U
_READ_AS = str.maketrans({"O": "0", "I": "1", "L": "1"})
RECOVERY_PROFILE = lp.Profile(0, 14, 8, 1)  # scrypt N=2^14 (16 MiB, tens of ms): 10 hashes per batch / per check stay well under a second

METHOD = "recovery_code"
CONTEXTS = ("sign_in", "local_sign_in", "step_up", "disable")


def _profile() -> lp.Profile:
    return lp._profile_override or RECOVERY_PROFILE  # tests set a cheaper profile for every hash


def canonical(raw: Any) -> str | None:
    """The 8-symbol canonical form of a typed recovery code, or None when the text cannot be one (a 6-digit authenticator code never is)."""
    if not isinstance(raw, str) or len(raw) > 32:
        return None
    text = "".join(ch for ch in raw.upper() if ch not in " -\t").translate(_READ_AS)
    if len(text) != CHARS or any(ch not in ALPHABET for ch in text):
        return None
    return text


def display(code: str) -> str:
    return f"{code[:4]}-{code[4:]}"


def _new_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CHARS))


# ---------------------------------------------------------------- storage

def _table_ok(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("SELECT 1 FROM auth_recovery_codes LIMIT 0")
    except sqlite3.OperationalError:
        return False
    return True


def generate(conn: sqlite3.Connection, user_id: str) -> tuple[list[str], int]:
    """A fresh batch for the user: the previous batch is deleted first (its codes stop working). Returns (the codes as shown ONCE,
    how many unused codes of the old batch were voided). Only hashes are stored."""
    voided = conn.execute("SELECT COUNT(*) FROM auth_recovery_codes WHERE user_id = ? AND used_at IS NULL", (user_id,)).fetchone()[0]
    conn.execute("DELETE FROM auth_recovery_codes WHERE user_id = ?", (user_id,))
    batch = secrets.token_hex(8)
    at = now_iso()
    codes: list[str] = []
    seen: set[str] = set()
    while len(codes) < COUNT:
        code = _new_code()
        if code in seen:
            continue
        seen.add(code)
        codes.append(code)
    prof = _profile()
    rows = [(user_id, batch, lp.hash_password(code, prof)[0], at) for code in codes]
    conn.executemany("INSERT INTO auth_recovery_codes(user_id, batch_id, code_hash, created_at) VALUES (?,?,?,?)", rows)
    return [display(c) for c in codes], int(voided)


def remove_all(conn: sqlite3.Connection, user_id: str) -> int:
    """The factor was removed or reset: its recovery codes go with it. Returns how many rows were deleted."""
    if not _table_ok(conn):
        return 0
    return conn.execute("DELETE FROM auth_recovery_codes WHERE user_id = ?", (user_id,)).rowcount


def status(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    """What the API may say: how many codes remain of how many, when the batch was made, when one was last used. Never a code or a hash."""
    if not _table_ok(conn):
        return {"remaining": 0, "total": 0, "created_at": None, "last_used_at": None, "low": False, "low_at": LOW_AT}
    r = conn.execute(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN used_at IS NULL THEN 1 ELSE 0 END) AS remaining, MAX(created_at) AS created_at, "
        "MAX(used_at) AS last_used_at FROM auth_recovery_codes WHERE user_id = ?", (user_id,)).fetchone()
    total = int(r["total"] or 0)
    remaining = int(r["remaining"] or 0)
    return {"remaining": remaining, "total": total, "created_at": r["created_at"] if total else None,
            "last_used_at": r["last_used_at"] if total else None, "low": total > 0 and remaining <= LOW_AT, "low_at": LOW_AT}


def remaining(conn: sqlite3.Connection, user_id: str) -> int:
    if not _table_ok(conn):
        return 0
    return int(conn.execute("SELECT COUNT(*) FROM auth_recovery_codes WHERE user_id = ? AND used_at IS NULL", (user_id,)).fetchone()[0])


def consume(conn: sqlite3.Connection, user_id: str, raw: Any, used_for: str) -> bool:
    """True when `raw` is one of the user's unused codes; that code is then spent (never usable again). Constant-time hash checks."""
    code = canonical(raw)
    if code is None or not _table_ok(conn):
        return False
    rows = conn.execute("SELECT id, code_hash FROM auth_recovery_codes WHERE user_id = ? AND used_at IS NULL ORDER BY id", (user_id,)).fetchall()
    for row in rows:
        if lp.verify(code, row["code_hash"]):
            # the conditional update is the single-use guard, also between two concurrent requests with the same code
            return conn.execute("UPDATE auth_recovery_codes SET used_at = ?, used_for = ? WHERE id = ? AND used_at IS NULL",
                                (now_iso(), used_for if used_for in CONTEXTS else "sign_in", row["id"])).rowcount == 1
    return False


# ---------------------------------------------------------------- the factor step: the authenticator code OR a recovery code

def verify_factor(conn: sqlite3.Connection, settings: Any, user_id: str, raw: Any, used_for: str) -> str:
    """Check the second factor shown for `used_for`: a recovery code (8 symbols, see `canonical`) or else the authenticator code.
    Returns the method (`totp` | `recovery_code`). Raises second_factor.SecondFactorError (`locked` | `invalid` | `unreadable`).
    A recovery code is only accepted while the user's authenticator factor is active; wrong recovery codes count towards the same
    lockout as wrong authenticator codes."""
    from . import second_factor as sf

    if canonical(raw) is None:
        sf.verify(conn, settings, user_id, raw)
        return "totp"
    if sf.FAILURES.locked(conn, user_id):
        raise sf.SecondFactorError("locked", sf.LOCKED_HE)
    if sf.is_enrolled(conn, user_id) and consume(conn, user_id, raw, used_for):
        sf.FAILURES.clear(conn, user_id)
        return METHOD
    if sf.FAILURES.fail(conn, user_id):
        raise sf.SecondFactorError("locked", sf.LOCKED_HE)
    raise sf.SecondFactorError("invalid", INVALID_HE)


INVALID_HE = "הקוד אינו נכון או שכבר נעשה בו שימוש. כל קוד שחזור עובד פעם אחת בלבד."


def audit_use(conn: sqlite3.Connection, actor: Any, used_for: str, request_id: str | None = None, **extra: Any) -> None:
    """`auth.recovery_code.used` (allowed): where it was used and how many codes remain - never the code."""
    from ..audit import audit

    left = remaining(conn, actor.user_id)
    audit(conn, actor=actor, action="auth.recovery_code.used", decision="allowed", resource_type="user", resource_id=actor.user_id,
          request_id=request_id, details={"method": METHOD, "used_for": used_for, "remaining": left, "low": left <= LOW_AT, **extra})
