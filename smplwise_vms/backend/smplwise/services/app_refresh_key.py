"""APPREFRESH2-295 (docs/changes/APPREFRESH-DEVICEKEY-SPEC.md, the contract for the Android / iOS teams): the device-bound key of the
app refresh token - parsing the public key the app registers at mint, the exact byte strings it signs, and the ECDSA P-256 / SHA-256
verification (ES256). The primitive is the one both platforms hold natively in hardware: Android Keystore (`KeyProperties.KEY_ALGORITHM_EC`,
`secp256r1`, `SHA256withECDSA`, StrongBox where present) and the iOS Secure Enclave (`kSecAttrKeyTypeECSECPrimeRandom` 256 /
CryptoKit `SecureEnclave.P256.Signing`). Verification uses the backend's existing `cryptography` dependency (no new dependency).

Nothing here logs, stores or returns key or signature material; callers keep the SPKI DER (a public key) on the family row and put only
`fingerprint_prefix()` (16 hex of SHA-256(SPKI DER)) into audit rows."""
from __future__ import annotations

import base64
import binascii
import hashlib
import re

from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

ALG = "ES256"
POP_VERSION = "arx-app-pop-v1"
NONCE_PREFIX = "arxn_"
NONCE_TTL_S = 120  # a challenge nonce is valid this long and once
POP_SKEW_S = 300  # |ts - server time| allowed in a signed proof (the app may correct with the challenge's server_time)
# unexpired, unused nonces kept per family (older ones are dropped at the next challenge). Security review D-02 (2026-10-24): 32, so a
# burst from one source (at most RATE_CHALLENGE per client) cannot evict the nonce another client - the phone - asked for.
MAX_OPEN_NONCES = 32
FP_PREFIX_LEN = 16  # hex characters of the key fingerprint an audit row may carry

P256_N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551
_B64U = re.compile(r"^[A-Za-z0-9_-]+={0,2}$")


class BadKey(ValueError):
    """A public key or a signature that cannot be used (never carries the input)."""


def b64u_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64u_decode(text: str, *, max_len: int = 256) -> bytes:
    if not isinstance(text, str) or not text or len(text) > max_len or not _B64U.match(text):
        raise BadKey("encoding")
    body = text.rstrip("=")
    try:
        return base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
    except (binascii.Error, ValueError) as exc:
        raise BadKey("encoding") from exc


def parse_public_key(text: str) -> tuple[bytes, str]:
    """The app's `public_key` (base64url of either the X.509 SubjectPublicKeyInfo DER - Android `PublicKey.getEncoded()` - or the
    65-byte uncompressed X9.63 point 04||X||Y - iOS `SecKeyCopyExternalRepresentation` / CryptoKit `x963Representation`), P-256 only.
    Returns (normalised SPKI DER, fingerprint = SHA-256(SPKI DER) hex). Raises BadKey."""
    raw = b64u_decode(text)
    try:
        if len(raw) == 65 and raw[0] == 0x04:
            key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), raw)
        elif raw[:1] == b"\x30":
            key = serialization.load_der_public_key(raw)
        else:
            raise BadKey("format")
    except (ValueError, TypeError, UnsupportedAlgorithm) as exc:
        raise BadKey("format") from exc
    if not isinstance(key, ec.EllipticCurvePublicKey) or key.curve.name != "secp256r1":
        raise BadKey("curve")
    spki = key.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    return spki, hashlib.sha256(spki).hexdigest()


def fingerprint_prefix(fp: str | None) -> str | None:
    return fp[:FP_PREFIX_LEN] if fp else None


def _signature_der(sig_b64: str) -> bytes:
    """base64url of a DER ECDSA-Sig-Value (Android `Signature.sign()`, iOS `SecKeyCreateSignature` / CryptoKit `derRepresentation`) or
    of the 64-byte raw r||s (CryptoKit `rawRepresentation`, JOSE). Exactly 64 decoded bytes are always read as raw r||s."""
    raw = b64u_decode(sig_b64, max_len=120)
    if len(raw) == 64:
        r, s = int.from_bytes(raw[:32], "big"), int.from_bytes(raw[32:], "big")
        if not (0 < r < P256_N and 0 < s < P256_N):
            raise BadKey("signature")
        return encode_dss_signature(r, s)
    if raw[:1] != b"\x30" or not 8 <= len(raw) <= 72:
        raise BadKey("signature")
    return raw


def verify(spki_der: bytes, sig_b64: str, message: bytes) -> bool:
    """ECDSA P-256 over SHA-256(message) against the registered key. False for anything malformed or not matching."""
    try:
        key = serialization.load_der_public_key(spki_der)
        if not isinstance(key, ec.EllipticCurvePublicKey):
            return False
        key.verify(_signature_der(sig_b64), message, ec.ECDSA(hashes.SHA256()))
        return True
    except (InvalidSignature, BadKey, ValueError, TypeError, UnsupportedAlgorithm):
        return False


def token_digest(token: str) -> str:
    """base64url (no padding) of SHA-256 over the refresh token's ASCII bytes - what a refresh proof names instead of the token."""
    return b64u_encode(hashlib.sha256(token.encode("utf-8", "replace")).digest())


def refresh_message(device_id: str, nonce: str, ts: int, refresh_token: str) -> bytes:
    """The exact bytes a refresh proof signs: six lines joined by LF, UTF-8, no trailing LF."""
    return "\n".join((POP_VERSION, "refresh", device_id, nonce, str(int(ts)), token_digest(refresh_token))).encode("utf-8")


def mint_message(device_id: str, ts: int, public_key_text: str) -> bytes:
    """The exact bytes the mint's proof signs: the `public_key` field verbatim as the last line; the nonce line is "-"."""
    return "\n".join((POP_VERSION, "mint", device_id, "-", str(int(ts)), public_key_text)).encode("utf-8")


def replace_message(device_id: str, nonce: str, ts: int, new_public_key_text: str) -> bytes:
    """Security review D-01 (b): the exact bytes the OLD key signs to hand the device's saved sign-in to a new key - a challenge nonce of
    the device's current keyed sign-in, and the mint's new `public_key` field verbatim as the last line ("" when the mint sends none)."""
    return "\n".join((POP_VERSION, "replace", device_id, nonce, str(int(ts)), new_public_key_text)).encode("utf-8")


def session_message(device_id: str, nonce: str, ts: int, access_token: str) -> bytes:
    """SESSIONEXCH2-295 (device-key spec revision 3, session exchange spec section 4.1): the exact bytes the exchange proof signs - a
    challenge nonce of the device's live keyed family and the digest of the ACCESS token sent in `Authorization` as the last line. The
    purpose line `session` keeps a refresh / mint / replace signature from ever verifying here, and back."""
    return "\n".join((POP_VERSION, "session", device_id, nonce, str(int(ts)), token_digest(access_token))).encode("utf-8")


def nonce_hash(nonce: str) -> str:
    return hashlib.sha256(("nonce:" + nonce).encode("utf-8", "replace")).hexdigest()


def is_nonce(value: object) -> bool:
    return isinstance(value, str) and value.startswith(NONCE_PREFIX) and 40 <= len(value) <= 80


__all__ = ["ALG", "POP_VERSION", "NONCE_PREFIX", "NONCE_TTL_S", "POP_SKEW_S", "MAX_OPEN_NONCES", "BadKey", "parse_public_key",
           "fingerprint_prefix", "verify", "refresh_message", "mint_message", "replace_message", "session_message", "token_digest", "nonce_hash", "is_nonce", "b64u_encode",
           "b64u_decode"]
