"""The bridge HMAC key set (CR-WISKEY-HMAC-ROTATION-295 sections 3 and 4): key ids, sealed material, signature format v2.

- A key is a text secret (a new one: base64url of 32 CSPRNG bytes; the adopted legacy pairing secret as it is); the HMAC key is its
  UTF-8 bytes, exactly as `ha_bridge.sign` uses the pairing secret today. It is stored ONLY sealed (connection_store.seal_bridge_key:
  AES-256-GCM, per-install key file, AAD bound to the kid) in `bridge_keys.value_enc`, and wiped (NULL) when retired / discarded.
- `kid` = `g<generation>-<8 random hex>` (`g0-legacy` for the adopted pairing secret): never derived from key material.
- Signature v2: `HMAC-SHA256(key, "v2.<kid>.<ts>.<nonce>.<sha256_hex(canonical body)>")`; the wire is the body plus `kid`, `ts`,
  `nonce` (32 hex) and `sig`. A kid-less (v1) message verifies only against `g0-legacy` while that key is current or inside its
  retiring window - after the first completed rotation no kid-less message verifies (downgrade guard, section 4.3).
- Verify order (FABLEFIX-295 H-02): format, constant-time compare FIRST (a dummy key when the kid is unknown, unreadable or has no
  material), then kid state, time window and replay (ONE nonce cache across every key). Every refusal before the MAC proves the
  sender holds the key answers the one wire code `bad_signature`; the precise reason stays in `VerifyError.detail` and the
  process-local `REFUSALS` counter, never on the wire.

Nothing here logs, audits, raises or returns key material, a salt, a proof, a nonce or a signature in an error: refusals are closed
codes (`VerifyError.code`). Not wired to `ha_bridge.sign/verify` in this slice (activation slice, design section 13 item 3)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from ..db import get_setting, now_iso
from .connection_store import SecretError, open_bridge_key, seal_bridge_key

KID_RE = re.compile(r"^g[0-9]{1,9}-(legacy|[0-9a-f]{8})$")
LEGACY_KID = "g0-legacy"
NONCE_RE = re.compile(r"^[0-9a-f]{32}$")
SIG_RE = re.compile(r"^[0-9a-f]{64}$")
WINDOW_S = 60
WIRE_FIELDS = ("kid", "ts", "nonce", "sig")
LIVE_STATES = ("pending", "next", "current", "retiring")
DERIVE_INFO = "smplwise-bridge-rotation-v1"
PROOF_LABEL = "rotation-ack|"


class VerifyError(Exception):
    """A refused message. `code` is the closed wire value; `detail` the closed internal reason (equal to `code` unless the refusal
    was collapsed to `bad_signature` for an unauthenticated message). The exception never carries input text or key material."""

    def __init__(self, code: str, detail: str | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.detail = detail or code


class RefusalCounter:
    """Process-local count of verify refusals by internal reason (H-02: the reason is kept here, not on the wire)."""

    def __init__(self) -> None:
        self._counts: dict[str, int] = {}
        self._lock = threading.Lock()

    def add(self, detail: str) -> None:
        with self._lock:
            self._counts[detail] = self._counts.get(detail, 0) + 1

    def snapshot(self) -> dict[str, int]:
        with self._lock:
            return dict(self._counts)

    def clear(self) -> None:
        with self._lock:
            self._counts.clear()


REFUSALS = RefusalCounter()
_DUMMY_MATERIAL = secrets.token_urlsafe(32)  # never a real key; only keeps the compare's cost the same when no key can be used


class KeySetError(Exception):
    """The key set cannot serve a request (`no_key`, `key_unreadable`, `not_paired` ...). Carries a closed code only."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Key:
    kid: str
    generation: int
    state: str
    material: str | None  # None when retired / discarded; never logged or returned by a route
    verify_until: str | None = None
    activated_at: str | None = None

    def __repr__(self) -> str:  # a Key never prints its material (a traceback, a debug log)
        return f"Key(kid={self.kid!r}, generation={self.generation}, state={self.state!r})"


# ---------------------------------------------------------------- pure functions (the wire format)

def canonical(body: dict[str, Any]) -> str:
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def hmac_input(kid: str, ts: int, nonce: str, body: dict[str, Any]) -> bytes:
    return f"v2.{kid}.{ts}.{nonce}.{hashlib.sha256(canonical(body).encode('utf-8')).hexdigest()}".encode("utf-8")


def _mac(material: str, data: bytes) -> str:
    return hmac.new(material.encode("utf-8"), data, hashlib.sha256).hexdigest()


def sign_with(kid: str, material: str, body: dict[str, Any], ts: int | None = None, nonce: str | None = None) -> dict[str, Any]:
    """The v2 wire message for `body`. `ts` / `nonce` are injectable for vectors and fake clocks only."""
    if not KID_RE.fullmatch(kid):
        raise ValueError("kid")
    if any(k in body for k in WIRE_FIELDS):
        raise ValueError("body carries a wire field")
    ts = int(time.time()) if ts is None else int(ts)
    nonce = secrets.token_hex(16) if nonce is None else nonce
    if not NONCE_RE.fullmatch(nonce):
        raise ValueError("nonce")
    return {**body, "kid": kid, "ts": ts, "nonce": nonce, "sig": _mac(material, hmac_input(kid, ts, nonce, body))}


def _v1_sig(material: str, body: dict[str, Any], ts: int, nonce: str) -> str:
    """The legacy recipe (ha_bridge.sign): no kid, `"<ts>.<nonce>.<sha256(body)>"`."""
    return _mac(material, f"{ts}.{nonce}.{hashlib.sha256(canonical(body).encode('utf-8')).hexdigest()}".encode("utf-8"))


def new_material() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii").rstrip("=")


def new_kid(generation: int) -> str:
    return f"g{int(generation)}-{secrets.token_hex(4)}"


def derive_next(material_cur: str, salt: bytes, kid_next: str, gen_next: int) -> str:
    """K_next = HKDF-SHA256(ikm = K_cur, salt, info = "smplwise-bridge-rotation-v1|<kid_next>|<gen_next>", 32 bytes), as text."""
    if len(salt) != 32:
        raise ValueError("salt")
    info = f"{DERIVE_INFO}|{kid_next}|{int(gen_next)}".encode("utf-8")
    raw = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=info).derive(material_cur.encode("utf-8"))
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def proof(material_next: str, rotation_id: str) -> str:
    """What the peer answers to `begin` to prove it derived the same next key (bound to the rotation id)."""
    return _mac(material_next, (PROOF_LABEL + rotation_id).encode("utf-8"))


# ---------------------------------------------------------------- the nonce cache (one for every key)

class NonceCache:
    def __init__(self, window_s: int = WINDOW_S) -> None:
        self.window_s = window_s
        self._seen: dict[str, float] = {}
        self._lock = threading.Lock()

    def check_and_add(self, nonce: str, now: float) -> bool:
        """True when unseen (and records it); False for a replay."""
        with self._lock:
            for n, t in list(self._seen.items()):
                if now - t > self.window_s * 2:
                    self._seen.pop(n, None)
            if nonce in self._seen:
                return False
            self._seen[nonce] = now
            return True

    def clear(self) -> None:
        with self._lock:
            self._seen.clear()


NONCES = NonceCache()


def reset_for_tests() -> None:
    NONCES.clear()
    REFUSALS.clear()


# ---------------------------------------------------------------- rows

def _iso(at: float) -> str:
    return datetime.fromtimestamp(at, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _epoch(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    try:
        return conn.execute("SELECT kid, generation, state, value_enc, rotation_id, created_at, activated_at, verify_until, ended_at "
                            "FROM bridge_keys ORDER BY generation DESC, created_at DESC").fetchall()
    except sqlite3.OperationalError:  # a database before the migration
        return []


def adopted(conn: sqlite3.Connection) -> bool:
    return any(r["state"] == "current" for r in rows(conn))


def _open(data_dir: Path, kid: str, blob: str | None) -> str:
    if not blob:
        raise KeySetError("key_retired")
    try:
        return open_bridge_key(data_dir, kid, blob)
    except SecretError:
        raise KeySetError("key_unreadable") from None


def load(conn: sqlite3.Connection, data_dir: Path, kid: str) -> Key | None:
    """The key `kid` with its material (None when unknown). Raises KeySetError(`key_unreadable`) for a live key that cannot be opened."""
    r = conn.execute("SELECT kid, generation, state, value_enc, verify_until, activated_at FROM bridge_keys WHERE kid = ?", (kid,)).fetchone()
    if r is None:
        return None
    material = _open(data_dir, r["kid"], r["value_enc"]) if r["state"] in LIVE_STATES else None
    return Key(r["kid"], r["generation"], r["state"], material, r["verify_until"], r["activated_at"])


def current(conn: sqlite3.Connection, data_dir: Path) -> Key:
    r = conn.execute("SELECT kid FROM bridge_keys WHERE state = 'current'").fetchone()
    if r is None:
        raise KeySetError("no_key")
    key = load(conn, data_dir, r["kid"])
    assert key is not None
    return key


def insert(conn: sqlite3.Connection, data_dir: Path, *, kid: str, generation: int, state: str, material: str, rotation_id: str | None) -> None:
    """Seal and insert one key. Sealing happens BEFORE the row is written (a key-file failure writes nothing)."""
    if state not in LIVE_STATES or not KID_RE.fullmatch(kid):
        raise ValueError("key")
    try:
        blob = seal_bridge_key(data_dir, kid, material)
    except SecretError:
        raise KeySetError("key_unreadable") from None
    conn.execute("INSERT INTO bridge_keys(kid, generation, state, value_enc, rotation_id, created_at, activated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 (kid, int(generation), state, blob, rotation_id, now_iso(), now_iso() if state == "current" else None))


def set_state(conn: sqlite3.Connection, kid: str, state: str, *, verify_until: str | None = None) -> None:
    if state in ("retired", "discarded"):
        # the wipe: the sealed blob goes in the same statement as the state (the CHECK in 0143 refuses one without the other)
        conn.execute("UPDATE bridge_keys SET state = ?, value_enc = NULL, verify_until = NULL, ended_at = ? WHERE kid = ?", (state, now_iso(), kid))
    elif state == "current":
        conn.execute("UPDATE bridge_keys SET state = 'current', verify_until = NULL, activated_at = COALESCE(activated_at, ?) WHERE kid = ?", (now_iso(), kid))
    else:
        conn.execute("UPDATE bridge_keys SET state = ?, verify_until = ? WHERE kid = ?", (state, verify_until, kid))


def adopt_legacy(conn: sqlite3.Connection, data_dir: Path) -> Key:
    """The first key of the set: the current pairing secret (`settings.bridge.secret`) as `g0-legacy`, sealed. The setting itself is
    left as it is (it is cleared only by the activation slice). Raises KeySetError(`not_paired`) when there is no pairing secret."""
    if adopted(conn):
        return current(conn, data_dir)
    secret = get_setting(conn, "bridge.secret")
    if not secret:
        raise KeySetError("not_paired")
    insert(conn, data_dir, kid=LEGACY_KID, generation=0, state="current", material=secret, rotation_id=None)
    return current(conn, data_dir)


def sign(conn: sqlite3.Connection, data_dir: Path, body: dict[str, Any], ts: int | None = None, nonce: str | None = None) -> dict[str, Any]:
    key = current(conn, data_dir)
    assert key.material is not None
    return sign_with(key.kid, key.material, body, ts, nonce)


def verify(conn: sqlite3.Connection, data_dir: Path, message: Any, now: float | None = None, nonces: NonceCache | None = None) -> str:
    """Raises VerifyError(code) unless `message` is a valid, recent, unseen v2 message under a key that may verify now (or a v1
    message under the legacy key while it may). Returns the kid it verified with."""
    nonces = nonces or NONCES
    now = time.time() if now is None else now
    if not isinstance(message, dict):
        raise VerifyError("bad_format")
    kidless = "kid" not in message
    kid = LEGACY_KID if kidless else message.get("kid")
    ts, nonce, sig = message.get("ts"), message.get("nonce"), message.get("sig")
    if (not isinstance(kid, str) or not KID_RE.fullmatch(kid) or isinstance(ts, bool) or not isinstance(ts, int)
            or not isinstance(nonce, str) or not isinstance(sig, str) or not SIG_RE.fullmatch(sig)):
        raise VerifyError("bad_format")
    if not kidless and not NONCE_RE.fullmatch(nonce):
        raise VerifyError("bad_format")
    if kidless and not nonce:
        raise VerifyError("bad_format")
    body = {k: v for k, v in message.items() if k not in WIRE_FIELDS}
    # H-02: compute the MAC before looking at the key's state, with a dummy key when no material can be used, so an unauthenticated
    # sender learns nothing about which kids exist or in which state (one wire code, one compare, whatever stopped it)
    pre: str | None = None
    try:
        key = load(conn, data_dir, kid)
    except KeySetError as exc:
        key, pre = None, exc.code
    if key is None and pre is None:
        pre = "kidless_refused" if kidless else "key_unknown"
    elif key is not None and key.material is None:
        pre = "kidless_refused" if kidless else "key_retired"
    material = key.material if key is not None and key.material is not None else _DUMMY_MATERIAL
    expected = _v1_sig(material, body, ts, nonce) if kidless else _mac(material, hmac_input(kid, ts, nonce, body))
    mac_ok = hmac.compare_digest(expected, sig)
    if pre is not None or not mac_ok:
        _refuse("bad_signature", pre or "bad_signature")
    assert key is not None
    # authenticated: the sender holds this key, so the precise reason may be answered
    if key.state == "pending":
        _refuse("key_not_active")
    if key.state == "retiring":
        until = _epoch(key.verify_until)
        if until is None or now >= until:  # a hard cut sets `verify_until` to the switch instant: refused from that instant on
            _refuse("key_expired")
    if kidless and key.state == "next":
        _refuse("kidless_refused")
    if abs(now - ts) > WINDOW_S:
        _refuse("stale")
    if not nonces.check_and_add(nonce, now):
        _refuse("replay")
    return kid


def _refuse(code: str, detail: str | None = None) -> None:
    REFUSALS.add(detail or code)
    raise VerifyError(code, detail)


def status(conn: sqlite3.Connection, data_dir: Path, limit: int = 10) -> dict[str, Any]:
    """Ids, generations, states and times - never material. `readable` says whether the current key opens on this machine."""
    out = []
    cur: dict[str, Any] | None = None
    for r in rows(conn)[:limit]:
        item = {"kid": r["kid"], "generation": r["generation"], "state": r["state"], "created_at": r["created_at"],
                "activated_at": r["activated_at"], "verify_until": r["verify_until"], "ended_at": r["ended_at"]}
        out.append(item)
        if r["state"] == "current":
            try:
                _open(data_dir, r["kid"], r["value_enc"])
                readable = True
            except KeySetError:
                readable = False
            cur = {**item, "readable": readable}
    return {"current": cur, "keys": out}


def iso_at(epoch: float) -> str:
    return _iso(epoch)


def epoch_of(iso: str | None) -> float | None:
    return _epoch(iso)
