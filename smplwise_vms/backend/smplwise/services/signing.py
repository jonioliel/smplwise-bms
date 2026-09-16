"""Evidence signing keys (T067): one Ed25519 key pair per installation. The private half lives only in
/data/keys (created with mode 0600, never exported, never backed up); the public half is published with its id.
Rotation creates a new active key and keeps the retired public keys in the keyring, so bundles signed earlier still
verify and are reported as "signed by a retired key of this installation".

What a signature proves — and what it does not: a valid signature over manifest.json shows that the manifest (and,
through its hashes, every file) has not changed since the bundle was exported by a holder of that key. It says
nothing about what happened before the export: the camera, the NVR and the network are outside the signature.
Capture authenticity is a separate, unproven claim, and nothing here is a statement of legal admissibility."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import os
import zipfile
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

from ..config import Settings

ALG = "Ed25519"
SIG_NAME = "manifest.sig.json"
TRUST_NOTE = (
    "החתימה מוכיחה שהחבילה לא שונתה מאז הייצוא על ידי מחזיק המפתח של המתקן (integrity-at-export). "
    "היא אינה מוכיחה את אמיתות הצילום במקור (capture authenticity): המצלמה, ה־NVR והרשת נמצאים מחוץ לחתימה. "
    "אין כאן הצהרה על קבילות משפטית."
)


def keys_dir(settings: Settings) -> Path:
    return settings.data_dir / "keys"


def _ring_path(settings: Settings) -> Path:
    return keys_dir(settings) / "keyring.json"


def _now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def kid_of(public_raw: bytes) -> str:
    return hashlib.sha256(public_raw).hexdigest()[:16]


def load_keyring(settings: Settings) -> dict[str, Any]:
    """Public halves only. Missing or unreadable → empty ring (nothing is invented)."""
    p = _ring_path(settings)
    if not p.exists():
        return {"active": None, "keys": []}
    try:
        ring = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(ring, dict) or not isinstance(ring.get("keys"), list):
            raise ValueError("keyring shape")
        return ring
    except Exception:  # noqa: BLE001 - a damaged keyring must not break exports; a new key will be generated
        return {"active": None, "keys": []}


def _save_keyring(settings: Settings, ring: dict[str, Any]) -> None:
    d = keys_dir(settings)
    d.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(d, 0o700)
    except OSError:
        pass
    _ring_path(settings).write_text(json.dumps(ring, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_private(path: Path, pem: bytes) -> None:
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(fd, pem)
    finally:
        os.close(fd)


def _generate(settings: Settings, ring: dict[str, Any]) -> tuple[str, ed25519.Ed25519PrivateKey]:
    priv = ed25519.Ed25519PrivateKey.generate()
    pub_raw = priv.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    kid = kid_of(pub_raw)
    d = keys_dir(settings)
    d.mkdir(parents=True, exist_ok=True)
    _write_private(d / f"{kid}.key", priv.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    now = _now()
    for k in ring["keys"]:
        if k.get("kid") == ring.get("active") and not k.get("retired_at"):
            k["retired_at"] = now
    ring["keys"].append({"kid": kid, "alg": ALG, "public_key": _b64(pub_raw), "created_at": now, "retired_at": None})
    ring["active"] = kid
    _save_keyring(settings, ring)
    return kid, priv


def ensure_active(settings: Settings) -> tuple[str, ed25519.Ed25519PrivateKey]:
    """The active private key, generated on first use."""
    ring = load_keyring(settings)
    kid = ring.get("active")
    if kid:
        p = keys_dir(settings) / f"{kid}.key"
        if p.exists():
            try:
                priv = serialization.load_pem_private_key(p.read_bytes(), password=None)
                if isinstance(priv, ed25519.Ed25519PrivateKey):
                    return kid, priv
            except (ValueError, TypeError):
                pass  # unreadable private half: a new key is generated below and the old one is left retired
    return _generate(settings, ring)


def rotate(settings: Settings) -> dict[str, Any]:
    """New active key; the previous public key stays in the ring as retired."""
    ring = load_keyring(settings)
    _generate(settings, ring)
    return public_info(settings)


def public_info(settings: Settings) -> dict[str, Any]:
    ring = load_keyring(settings)
    if not ring.get("active"):
        ensure_active(settings)
        ring = load_keyring(settings)
    keys = [{"kid": k.get("kid"), "alg": k.get("alg", ALG), "public_key": k.get("public_key"), "created_at": k.get("created_at"), "retired_at": k.get("retired_at")} for k in ring["keys"]]
    return {"alg": ALG, "active": ring.get("active"), "keys": keys, "trust": TRUST_NOTE}


def sign_manifest(settings: Settings, manifest_bytes: bytes) -> dict[str, Any]:
    kid, priv = ensure_active(settings)
    pub_raw = priv.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return {
        "schema": "smplwise-evidence-signature/1",
        "alg": ALG,
        "kid": kid,
        "public_key": _b64(pub_raw),
        "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "signed_at": _now(),
        "signature": _b64(priv.sign(manifest_bytes)),
        "trust": TRUST_NOTE,
    }


def verify_signature(sig: dict[str, Any], manifest_bytes: bytes, ring: dict[str, Any] | None) -> dict[str, Any]:
    """Pure function: valid? (the embedded public key checks out against the manifest bytes), known? (that public
    key is in this installation's ring), retired? Trust is 'installation' only when the key is known here;
    'embedded_key_only' means integrity holds but the key is a stranger's."""
    out: dict[str, Any] = {"present": True, "alg": sig.get("alg"), "kid": sig.get("kid"), "valid": False, "known": False, "retired": None, "trust": "unsigned", "reason": None}
    if sig.get("alg") != ALG:
        out["reason"] = "unsupported_alg"
        return out
    try:
        pub_raw = base64.b64decode(str(sig.get("public_key", "")), validate=True)
        sig_bytes = base64.b64decode(str(sig.get("signature", "")), validate=True)
    except (ValueError, TypeError):
        out["reason"] = "malformed"
        return out
    if kid_of(pub_raw) != sig.get("kid"):
        out["reason"] = "kid_mismatch"
        return out
    if sig.get("manifest_sha256") and sig["manifest_sha256"] != hashlib.sha256(manifest_bytes).hexdigest():
        out["reason"] = "manifest_changed"
        return out
    try:
        ed25519.Ed25519PublicKey.from_public_bytes(pub_raw).verify(sig_bytes, manifest_bytes)
    except (InvalidSignature, ValueError):
        out["reason"] = "signature_invalid"
        return out
    out["valid"] = True
    known = None
    for k in (ring or {}).get("keys", []):
        if k.get("kid") == sig.get("kid") and k.get("public_key") == sig.get("public_key"):
            known = k
            break
    out["known"] = known is not None
    out["retired"] = bool(known.get("retired_at")) if known else None
    out["trust"] = "installation" if known else "embedded_key_only"
    return out


def bundle_kid(path: Path) -> str | None:
    """The key id a stored bundle was signed with, or None (older or stripped bundle)."""
    try:
        with zipfile.ZipFile(path) as z:
            if SIG_NAME not in z.namelist():
                return None
            return str(json.loads(z.read(SIG_NAME).decode("utf-8")).get("kid") or "") or None
    except Exception:  # noqa: BLE001
        return None
