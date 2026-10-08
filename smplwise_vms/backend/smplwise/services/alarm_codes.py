"""Alarm codes (CR-010, owner decisions 2026-09-29 21:45 / 21:50): the stored PANEL code, per-user personal PINs, the
per-user code policy, and the wrong-code lockout. docs/changes/CR-010-SECURITY-ALARM.md §5a holds the threat model.

- The PANEL code (one per panel / partition) is typed once by an administrator (system.configure) and stored ENCRYPTED
  with AES-256-GCM (the `cryptography` package already in the image) in `alarm_panel_codes` (migration 0036); the
  associated data is the panel's entity id, so a ciphertext copied onto another panel's row does not decrypt. The key
  is 32 random bytes in `<data>/keys/alarm-codes.key`, created on first use with mode 0600 in a 0700 directory - the
  same directory and policy as the evidence signing keys (services/signing.py): never exported, never in an Arx project
  backup (services/backup.py skips keys/, and neither alarm table is a backup table). The API never returns the code:
  only "set", when and by whom. Nothing here logs, audits or raises with a code or the key in it.
- A personal PIN (4-8 digits) is stored only as a salted scrypt hash (hashlib, N=2^14, r=8, p=1) - never the panel's
  real code, so a user never learns it and one user's PIN is revoked alone.
- The per-user policy (`alarm_user_policy`): `arm_policy` / `disarm_policy` = no_code | code_required (default
  code_required, separately for arming and disarming; bypass follows the disarm policy).
- Wrong codes (a PIN, or the panel code typed in `panel_code` mode, verified here): 5 in 5 minutes per user OR per
  panel lock that user / panel out of code entry for 10 minutes (in memory, per process; the add-on runs one worker).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..config import Settings
from ..db import now_iso

KEY_NAME = "alarm-codes.key"
POLICIES = ("no_code", "code_required")
DEFAULT_POLICY = "code_required"
PIN_MIN, PIN_MAX = 4, 8  # the setting alarm.pin_min_length (default 6, review L8) picks the minimum within these
SCRYPT_N, SCRYPT_R, SCRYPT_P = 1 << 14, 8, 1
_key_lock = threading.Lock()


class CodeError(Exception):
    """A code operation failed. The message is fixed text - never the code, the key or a ciphertext."""


# ---------------------------------------------------------------- the key file

def key_path(settings: Settings) -> Path:
    return settings.data_dir / "keys" / KEY_NAME


def _load_or_create_key(settings: Settings, create: bool) -> bytes | None:
    p = key_path(settings)
    with _key_lock:
        if p.exists():
            raw = p.read_bytes()
            if len(raw) != 32:
                raise CodeError("alarm code key file is damaged")
            return raw
        if not create:
            return None
        d = p.parent
        d.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(d, 0o700)
        except OSError:
            pass
        key = secrets.token_bytes(32)
        # review L1: written to a temporary file (0600, binary - on Windows a text-mode descriptor turned a 0x0A byte of
        # the key into CR LF), flushed to disk, then renamed into place, so a crash never leaves a half-written key
        tmp = p.with_name(f".{KEY_NAME}.{secrets.token_hex(4)}.tmp")
        fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), 0o600)
        try:
            os.write(fd, key)
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(tmp, p)
        return key


# ---------------------------------------------------------------- panel codes (encrypted at rest)

def encrypt(settings: Settings, panel_entity_id: str, code: str) -> str:
    key = _load_or_create_key(settings, create=True)
    assert key is not None
    nonce = secrets.token_bytes(12)
    ct = AESGCM(key).encrypt(nonce, code.encode("utf-8"), panel_entity_id.encode("utf-8"))
    return "v1:" + base64.b64encode(nonce + ct).decode("ascii")


def decrypt(settings: Settings, panel_entity_id: str, blob: str) -> str:
    key = _load_or_create_key(settings, create=False)
    if key is None or not blob.startswith("v1:"):
        raise CodeError("the stored alarm code cannot be read")
    try:
        raw = base64.b64decode(blob[3:])
        return AESGCM(key).decrypt(raw[:12], raw[12:], panel_entity_id.encode("utf-8")).decode("utf-8")
    except (InvalidTag, ValueError, UnicodeDecodeError):
        raise CodeError("the stored alarm code cannot be read") from None


def set_panel_code(conn: sqlite3.Connection, settings: Settings, panel_entity_id: str, code: str, actor: str | None) -> dict[str, Any]:
    conn.execute(
        "INSERT INTO alarm_panel_codes(panel_entity_id, ciphertext, set_at, set_by) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(panel_entity_id) DO UPDATE SET ciphertext = excluded.ciphertext, set_at = excluded.set_at, set_by = excluded.set_by",
        (panel_entity_id, encrypt(settings, panel_entity_id, code), now_iso(), actor),
    )
    return panel_code_info(conn, panel_entity_id)


def clear_panel_code(conn: sqlite3.Connection, panel_entity_id: str) -> bool:
    return conn.execute("DELETE FROM alarm_panel_codes WHERE panel_entity_id = ?", (panel_entity_id,)).rowcount > 0


def panel_code_info(conn: sqlite3.Connection, panel_entity_id: str) -> dict[str, Any]:
    """What the API may say about a stored panel code: whether one is set, when and by whom. Never the code."""
    try:
        r = conn.execute("SELECT set_at, set_by FROM alarm_panel_codes WHERE panel_entity_id = ?", (panel_entity_id,)).fetchone()
    except sqlite3.OperationalError:
        r = None
    return {"set": r is not None, "set_at": r["set_at"] if r else None, "set_by": r["set_by"] if r else None}


def panel_code_readable(conn: sqlite3.Connection, settings: Settings, panel_entity_id: str) -> bool | None:
    """Whether the stored code still decrypts (review L1): False after the key file was lost or replaced, or after the
    panel's entity was renamed (the entity id is the ciphertext's associated data - review L2). None: no code stored."""
    try:
        return panel_code(conn, settings, panel_entity_id) is not None or None
    except CodeError:
        return False


def stored_panel_codes(conn: sqlite3.Connection) -> set[str]:
    try:
        return {r[0] for r in conn.execute("SELECT panel_entity_id FROM alarm_panel_codes").fetchall()}
    except sqlite3.OperationalError:
        return set()


def panel_code(conn: sqlite3.Connection, settings: Settings, panel_entity_id: str) -> str | None:
    """The decrypted panel code, or None when none is stored. Only the alarm route calls this, to put it in a service
    call's data (or to compare it in constant time) - it is never returned, logged or audited."""
    r = conn.execute("SELECT ciphertext FROM alarm_panel_codes WHERE panel_entity_id = ?", (panel_entity_id,)).fetchone()
    return decrypt(settings, panel_entity_id, r["ciphertext"]) if r else None


def same_code(a: str | None, b: str | None) -> bool:
    if a is None or b is None:
        return False
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


# ---------------------------------------------------------------- personal PINs (hash only)

def valid_pin(pin: Any, min_len: int = PIN_MIN) -> bool:
    return isinstance(pin, str) and pin.isascii() and pin.isdigit() and max(PIN_MIN, min_len) <= len(pin) <= PIN_MAX


def hash_pin(pin: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.scrypt(pin.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_pin(pin: str, stored: str | None) -> bool:
    if not stored or not isinstance(pin, str):
        return False
    try:
        algo, n, r, p, salt_b64, dk_b64 = stored.split("$")
        if algo != "scrypt":
            return False
        salt, want = base64.b64decode(salt_b64), base64.b64decode(dk_b64)
        got = hashlib.scrypt(pin.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(want))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(got, want)


# ---------------------------------------------------------------- per-user policy

def policy(conn: sqlite3.Connection, user_id: str) -> dict[str, Any]:
    try:
        r = conn.execute("SELECT * FROM alarm_user_policy WHERE user_id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:
        r = None
    return {
        "arm_policy": r["arm_policy"] if r and r["arm_policy"] in POLICIES else DEFAULT_POLICY,
        "disarm_policy": r["disarm_policy"] if r and r["disarm_policy"] in POLICIES else DEFAULT_POLICY,
        "pin_set": bool(r and r["pin_hash"]),
        "pin_set_at": r["pin_set_at"] if r else None,
        "pin_set_by": r["pin_set_by"] if r else None,
    }


def _ensure_row(conn: sqlite3.Connection, user_id: str, actor: str | None) -> None:
    conn.execute("INSERT OR IGNORE INTO alarm_user_policy(user_id, arm_policy, disarm_policy, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)",
                 (user_id, DEFAULT_POLICY, DEFAULT_POLICY, now_iso(), actor))


def set_policy(conn: sqlite3.Connection, user_id: str, arm_policy: str | None, disarm_policy: str | None, actor: str | None) -> dict[str, Any]:
    _ensure_row(conn, user_id, actor)
    if arm_policy is not None:
        conn.execute("UPDATE alarm_user_policy SET arm_policy = ?, updated_at = ?, updated_by = ? WHERE user_id = ?", (arm_policy, now_iso(), actor, user_id))
    if disarm_policy is not None:
        conn.execute("UPDATE alarm_user_policy SET disarm_policy = ?, updated_at = ?, updated_by = ? WHERE user_id = ?", (disarm_policy, now_iso(), actor, user_id))
    return policy(conn, user_id)


def set_pin(conn: sqlite3.Connection, user_id: str, pin: str | None, actor: str | None) -> dict[str, Any]:
    _ensure_row(conn, user_id, actor)
    conn.execute("UPDATE alarm_user_policy SET pin_hash = ?, pin_set_at = ?, pin_set_by = ?, updated_at = ?, updated_by = ? WHERE user_id = ?",
                 (hash_pin(pin) if pin else None, now_iso() if pin else None, actor if pin else None, now_iso(), actor, user_id))
    return policy(conn, user_id)


def pin_hash_of(conn: sqlite3.Connection, user_id: str) -> str | None:
    try:
        r = conn.execute("SELECT pin_hash FROM alarm_user_policy WHERE user_id = ?", (user_id,)).fetchone()
    except sqlite3.OperationalError:
        return None
    return r["pin_hash"] if r else None


# ---------------------------------------------------------------- what the user must type

def code_plan(*, action: str, panel: dict[str, Any], user_policy: dict[str, Any], mode: str, stored: bool, remote: bool, remote_codeless: bool) -> dict[str, str]:
    """For one action ("arm", "disarm" or "bypass") on one panel: what the user must type (`prompt`: none | pin |
    panel | unverifiable | pin_missing) and what the add-on sends to the panel (`send`: none | stored | typed).

    - `no_code` (and not forced by the remote channel): nothing to type; the stored panel code goes with the command when
      the panel needs one; without a stored code the panel's own code is typed and passed through.
    - `code_required`: `personal_pin` mode - the user's PIN, verified here; `panel_code` mode - the panel's code,
      compared with the stored one. Without a stored code, a panel that needs one gets the typed code passed through
      (the panel verifies it); a panel that needs none cannot be verified in `panel_code` mode ("unverifiable").
    Bypass sends no code to the panel (a bypass control takes none); its gate follows the disarm policy."""
    needs = False
    if action == "arm":
        needs = bool(panel.get("needs_code_arm"))
    elif action == "disarm":
        needs = bool(panel.get("needs_code_disarm"))
    pol = user_policy["arm_policy"] if action == "arm" else user_policy["disarm_policy"]
    if remote and not remote_codeless:
        pol = "code_required"
    send_stored = "stored" if needs else "none"
    if pol == "no_code":
        if needs and not stored:
            return {"prompt": "panel", "send": "typed"}
        return {"prompt": "none", "send": send_stored}
    if stored:
        if mode == "panel_code":
            return {"prompt": "panel", "send": send_stored}
        return {"prompt": "pin" if user_policy.get("pin_set") else "pin_missing", "send": send_stored}
    if needs:
        return {"prompt": "panel", "send": "typed"}
    if mode == "panel_code":
        return {"prompt": "unverifiable", "send": "none"}
    return {"prompt": "pin" if user_policy.get("pin_set") else "pin_missing", "send": "none"}


# ---------------------------------------------------------------- wrong codes: lockout

class Lockout:
    """5 wrong codes in 5 minutes per key (a user, or a panel - see routers/alarm._code_gate) lock that key for 10 minutes.
    Both survive a restart (reviews L8 and L4): a lock in force is written to `alarm_lockouts` (wall-clock expiry), and the
    failure window itself to `block_counters` (scope `alarm_code`, migration 0071), each when a connection is given. A key's
    stored window is read once per process, on its first wrong code; every later one is the in-memory path."""

    SCOPE = "alarm_code"

    def __init__(self, limit: int = 5, window_s: float = 300.0, lock_s: float = 600.0) -> None:
        self.limit, self.window_s, self.lock_s = limit, window_s, lock_s
        self._lock = threading.Lock()
        self._fails: dict[str, list[float]] = {}
        self._until: dict[str, float] = {}  # wall clock (time.time)
        self._loaded: set[str] = set()  # keys whose stored window was read into _fails
        self._ignore_stored = False  # reset(): a wipe, so windows stored before it no longer count

    def _stored(self, conn: sqlite3.Connection | None, keys: list[str]) -> dict[str, float]:
        if conn is None or not keys:
            return {}
        try:
            rows = conn.execute(f"SELECT key, until_epoch FROM alarm_lockouts WHERE key IN ({','.join('?' * len(keys))})", keys).fetchall()
        except sqlite3.OperationalError:
            return {}
        return {r[0]: float(r[1]) for r in rows}

    def _load(self, conn: sqlite3.Connection | None, key: str, now: float) -> None:
        """Merge the stored window of `key` into memory, once. Caller holds the lock."""
        if conn is None or key in self._loaded:
            return
        self._loaded.add(key)
        if self._ignore_stored:
            return
        try:
            r = conn.execute("SELECT hits_json FROM block_counters WHERE scope = ? AND key = ? AND expires_at > ?", (self.SCOPE, key, now)).fetchone()
        except sqlite3.OperationalError:
            return
        if r is None:
            return
        try:
            stored = [float(x) for x in json.loads(r[0] or "[]")]
        except (ValueError, TypeError):
            return
        self._fails[key] = sorted({*self._fails.get(key, []), *stored})

    def _persist(self, conn: sqlite3.Connection | None, key: str, hits: list[float]) -> None:
        if conn is None:
            return
        try:
            if hits:
                conn.execute(
                    "INSERT INTO block_counters(scope, key, hits_json, expires_at) VALUES (?,?,?,?) "
                    "ON CONFLICT(scope, key) DO UPDATE SET hits_json = excluded.hits_json, expires_at = excluded.expires_at",
                    (self.SCOPE, key, json.dumps(hits), max(hits) + self.window_s))
            else:
                conn.execute("DELETE FROM block_counters WHERE scope = ? AND key = ?", (self.SCOPE, key))
        except sqlite3.OperationalError:
            pass

    def locked_for(self, keys: list[str], conn: sqlite3.Connection | None = None, now: float | None = None) -> float:
        now = time.time() if now is None else now
        stored = self._stored(conn, keys)
        with self._lock:
            untils = [max(self._until.get(k, 0.0), stored.get(k, 0.0)) for k in keys]
        return max([0.0] + [u - now for u in untils if u > now])

    def fail(self, keys: list[str], conn: sqlite3.Connection | None = None, now: float | None = None) -> float:
        """Record one wrong code for each key; returns the lock (seconds) now in force, 0 when none."""
        now = time.time() if now is None else now
        newly: dict[str, float] = {}
        with self._lock:
            for k in keys:
                self._load(conn, k, now)
                recent = [t for t in self._fails.get(k, []) if now - t < self.window_s] + [now]
                self._fails[k] = recent
                if len(recent) >= self.limit:
                    self._until[k] = now + self.lock_s
                    self._fails[k] = []
                    newly[k] = self._until[k]
                self._persist(conn, k, self._fails[k])
        if conn is not None and newly:
            try:
                for k, u in newly.items():
                    conn.execute("INSERT INTO alarm_lockouts(key, until_epoch) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET until_epoch = excluded.until_epoch", (k, u))
            except sqlite3.OperationalError:
                pass
        return self.locked_for(keys, conn, now)

    def forgive(self, keys: list[str], ts: float, conn: sqlite3.Connection | None = None) -> None:
        """Take back one provisional failure recorded at `ts` (review M-A: a typed pass-through code the panel then
        confirmed), with the lock it may have set."""
        with self._lock:
            for k in keys:
                self._load(conn, k, ts)
                if ts in self._fails.get(k, []):
                    self._fails[k].remove(ts)
                    self._persist(conn, k, self._fails[k])
                if abs(self._until.get(k, 0.0) - (ts + self.lock_s)) < 1e-6:
                    self._until.pop(k, None)
                    if conn is not None:
                        try:
                            conn.execute("DELETE FROM alarm_lockouts WHERE key = ? AND ABS(until_epoch - ?) < 0.001", (k, ts + self.lock_s))
                        except sqlite3.OperationalError:
                            pass

    def succeed(self, user_key: str, conn: sqlite3.Connection | None = None) -> None:
        with self._lock:
            self._fails.pop(user_key, None)
            if conn is not None:
                self._loaded.add(user_key)
                self._persist(conn, user_key, [])

    def reset(self) -> None:
        """Wipe the counters (tests): windows stored before this call are ignored from now on. A restart is a new Lockout()."""
        with self._lock:
            self._fails.clear()
            self._until.clear()
            self._loaded.clear()
            self._ignore_stored = True


def janitor(db: Any) -> int:
    """main.janitor_tick: counter rows past their window. A read first, so a quiet installation never takes the write lock."""
    now = time.time()
    with db.connection(mode="read", label="alarm_codes.janitor_read") as conn:
        try:
            due = conn.execute("SELECT 1 FROM block_counters WHERE scope = ? AND expires_at <= ? LIMIT 1", (Lockout.SCOPE, now)).fetchone()
        except sqlite3.OperationalError:
            return 0
    if due is None:
        return 0
    with db.connection(label="alarm_codes.janitor") as conn:
        return conn.execute("DELETE FROM block_counters WHERE scope = ? AND expires_at <= ?", (Lockout.SCOPE, now)).rowcount


LOCKOUT = Lockout()
