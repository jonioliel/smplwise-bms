"""CR-FLEET215: the fleet report's own identity - an opaque installation id, a monotonic sequence number and an Ed25519 key pair.

Everything lives in `<data>/keys/fleet/` next to the evidence keys (services/signing.py) and follows the same rules: the private half is
written with mode 0600, never exported, never put in a project backup and never returned by any route; the public half and its key id
(`signing.kid_of`: the first 16 hex of SHA-256 over the raw public key) are what the installer copies into the receiver (enrollment).

Why a separate key and a separate id (and not the evidence key or the bundle `installation_id` setting):
- the evidence key signs export bundles that leave the installation for third parties (police, insurers). Reusing it would let anyone
  holding such a bundle link it to this installation's fleet record, and a fleet compromise would touch evidence trust. One purpose per key.
- the bundle `installation_id` setting travels inside every exported bundle. The fleet id is random, never written to the database (so a
  project backup or a settings export never carries it, and a restore onto another box cannot clone it) and never leaves the installation
  except inside a signed fleet report.
- the sequence number is in the same file for the same reason: a database restored to an older state must not make the sequence go
  backwards (the receiver refuses a sequence number it has already seen).

The signed bytes are `CONTEXT + body` (domain separation): a signature made for a fleet report can never be presented as a signature over
an evidence manifest or anything else, and the reverse."""
from __future__ import annotations

import base64
import json
import os
import secrets
import threading
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

from ..config import Settings
from . import signing

ALG = signing.ALG
CONTEXT = b"smplwise-fleet-report/1\n"
STATE_NAME = "state.json"
_lock = threading.Lock()


def fleet_dir(settings: Settings) -> Path:
    return settings.data_dir / "keys" / "fleet"


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _ensure_dir(settings: Settings) -> Path:
    d = fleet_dir(settings)
    d.mkdir(parents=True, exist_ok=True)
    for p in (d.parent, d):
        try:
            os.chmod(p, 0o700)
        except OSError:
            pass
    return d


def _write_atomic(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(fd, text.encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, path)


def _read_state(settings: Settings) -> dict[str, Any]:
    p = fleet_dir(settings) / STATE_NAME
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _valid_id(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 32 and all(c in "0123456789abcdef" for c in value)


def peek(settings: Settings) -> dict[str, Any]:
    """The current state WITHOUT creating anything: {installation_id | None, seq (last used, 0 = none), kid | None, public_key | None}."""
    st = _read_state(settings)
    out: dict[str, Any] = {"installation_id": st.get("installation_id") if _valid_id(st.get("installation_id")) else None,
                           "seq": int(st.get("seq") or 0) if isinstance(st.get("seq"), int) else 0, "kid": None, "public_key": None, "alg": ALG}
    kid = st.get("kid")
    pub = st.get("public_key")
    if isinstance(kid, str) and isinstance(pub, str) and (fleet_dir(settings) / f"{kid}.key").exists():
        out["kid"], out["public_key"] = kid, pub
    return out


def _load_private(settings: Settings, kid: str) -> ed25519.Ed25519PrivateKey | None:
    p = fleet_dir(settings) / f"{kid}.key"
    try:
        priv = serialization.load_pem_private_key(p.read_bytes(), password=None)
    except (OSError, ValueError, TypeError):
        return None
    return priv if isinstance(priv, ed25519.Ed25519PrivateKey) else None


def _new_key(settings: Settings, st: dict[str, Any]) -> ed25519.Ed25519PrivateKey:
    d = _ensure_dir(settings)
    priv = ed25519.Ed25519PrivateKey.generate()
    pub_raw = priv.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    kid = signing.kid_of(pub_raw)
    signing._write_private(d / f"{kid}.key", priv.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    st["kid"], st["public_key"] = kid, _b64(pub_raw)
    return priv


def ensure(settings: Settings) -> dict[str, Any]:
    """Create the id and the key pair on first use (files only - nothing in the database). Returns the public enrollment facts."""
    with _lock:
        st = _read_state(settings)
        changed = False
        if not _valid_id(st.get("installation_id")):
            st["installation_id"] = secrets.token_hex(16)
            changed = True
        if not isinstance(st.get("seq"), int) or st["seq"] < 0:
            st["seq"] = 0
            changed = True
        kid = st.get("kid")
        if not (isinstance(kid, str) and _load_private(settings, kid) is not None):
            _new_key(settings, st)
            changed = True
        if changed:
            _write_atomic(_ensure_dir(settings) / STATE_NAME, json.dumps(st, sort_keys=True))
        return {"installation_id": st["installation_id"], "kid": st["kid"], "alg": ALG, "public_key": st["public_key"], "seq": st["seq"]}


def next_seq(settings: Settings) -> int:
    """Take the next sequence number (persisted before it is used, so a crash can skip a number but never repeat one)."""
    ensure(settings)
    with _lock:
        st = _read_state(settings)
        st["seq"] = int(st.get("seq") or 0) + 1
        _write_atomic(_ensure_dir(settings) / STATE_NAME, json.dumps(st, sort_keys=True))
        return st["seq"]


def sign(settings: Settings, body: bytes) -> tuple[str, str]:
    """(kid, base64 signature over CONTEXT + body) with the active fleet key."""
    facts = ensure(settings)
    priv = _load_private(settings, facts["kid"])
    if priv is None:  # pragma: no cover - ensure() just proved the file loads
        raise RuntimeError("fleet key unreadable")
    return facts["kid"], _b64(priv.sign(CONTEXT + body))


def verify(public_key_b64: str, body: bytes, signature_b64: str) -> bool:
    """Pure check (tests and tools): does the signature cover CONTEXT + body under that public key?"""
    try:
        pub = ed25519.Ed25519PublicKey.from_public_bytes(base64.b64decode(public_key_b64, validate=True))
        pub.verify(base64.b64decode(signature_b64, validate=True), CONTEXT + body)
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


def enrollment_code(facts: dict[str, Any]) -> str:
    """One line the installer pastes into the receiver: `arx-fleet-1.<installation id>.<kid>.<public key base64url>`. Public data only."""
    pub = base64.urlsafe_b64encode(base64.b64decode(facts["public_key"])).decode("ascii").rstrip("=")
    return f"arx-fleet-1.{facts['installation_id']}.{facts['kid']}.{pub}"
