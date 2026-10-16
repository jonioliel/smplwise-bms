"""USR2 phase 4: the minimal WebAuthn (Level 2/3) relying-party verification SmplWise Arx needs for passkeys - nothing else.

Why our own code and not `py_webauthn`: the add-on image is Alpine 3.22 (musl). `py_webauthn` pulls `cbor2` (a C extension with a
pure-Python fallback), `asn1crypto` and `pyOpenSSL`; their musllinux wheels for amd64 + aarch64 could not be verified from this
workstation, and the verification we need is small. `cryptography` (already a pinned dependency, requirements.txt) does every
signature check; this module only parses.

Scope (deliberately narrow - a smaller parser is a smaller attack surface):
- CBOR: definite-length items only - unsigned / negative integers, byte strings, UTF-8 text, arrays, maps (int / text keys, no
  duplicates), false / true / null. Tags, floats, indefinite lengths, `undefined` and reserved values are refused. Depth <= 8,
  items <= 4096, every length bounded by the remaining input.
- COSE keys: ES256 (alg -7, EC2 P-256, the point is validated on the curve by `cryptography`) and RS256 (alg -257, RSA >= 2048 bit,
  e odd and > 1). Nothing else is accepted.
- authenticatorData: rpIdHash, flags (UP / UV / BE / BS / AT / ED), signCount, attested credential data, extensions; trailing bytes
  are refused; BS without BE is refused.
- clientDataJSON: `type`, `challenge` (constant-time), `origin` (exact match), `crossOrigin` must not be true, `topOrigin` refused.
- Attestation: conveyance `none`. The attestation statement is NOT verified whatever `fmt` says (we never trust the authenticator
  model); the AAGUID is self-reported and display-only. The trust in a registration comes from the signed-in session that asked.
- Counter: when the stored or the received signCount is non-zero, the received one must be strictly greater (clone detection);
  both zero = an authenticator without a counter (synced passkeys), accepted.

Every failure is a WebAuthnError with a short machine reason for the audit row; callers answer the outside world uniformly.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import struct
from dataclasses import dataclass
from typing import Any

ALG_ES256 = -7
ALG_RS256 = -257
SUPPORTED_ALGS = (ALG_ES256, ALG_RS256)

FLAG_UP = 0x01
FLAG_UV = 0x04
FLAG_BE = 0x08
FLAG_BS = 0x10
FLAG_AT = 0x40
FLAG_ED = 0x80

MAX_DEPTH = 8
MAX_ITEMS = 4096
MAX_CREDENTIAL_ID = 1023
MAX_CLIENT_DATA = 4096
MAX_ATTESTATION_OBJECT = 64 * 1024
MAX_AUTH_DATA = 16 * 1024
MAX_SIGNATURE = 1024


class WebAuthnError(Exception):
    """A refused ceremony. `reason` is a short machine word for the audit row (never shown to the caller)."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


# ---------------------------------------------------------------- base64url

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def b64url_decode(value: Any, *, limit: int = 128 * 1024) -> bytes:
    """Strict base64url; WebAuthnError('malformed') otherwise. Padding is optional but, when present, only at the end and of exactly the
    right length; the encoding must be canonical (unused trailing bits zero), so one value has exactly one accepted spelling
    (review RELEASE_264 F6: Python's decoder alone accepts inner '=' - `YW=Jj` -> `abc`)."""
    if not isinstance(value, str) or len(value) > limit or not value:
        raise WebAuthnError("malformed")
    if any(c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=" for c in value):
        raise WebAuthnError("malformed")
    raw = value.rstrip("=")
    pad = len(value) - len(raw)
    if not raw or "=" in raw or len(raw) % 4 == 1 or (pad and pad != -len(raw) % 4):
        raise WebAuthnError("malformed")
    try:
        out = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
    except (binascii.Error, ValueError):
        raise WebAuthnError("malformed") from None
    if b64url(out) != raw:
        raise WebAuthnError("malformed")
    return out


# ---------------------------------------------------------------- CBOR (the subset WebAuthn uses)

class _Reader:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.items = 0

    def arg(self, pos: int, ai: int) -> tuple[int, int]:
        if ai < 24:
            return ai, pos
        size = {24: 1, 25: 2, 26: 4, 27: 8}.get(ai)
        if size is None:  # 28-30 reserved, 31 indefinite length
            raise WebAuthnError("cbor_unsupported")
        if pos + size > len(self.data):
            raise WebAuthnError("cbor_truncated")
        return int.from_bytes(self.data[pos:pos + size], "big"), pos + size

    def item(self, pos: int, depth: int) -> tuple[Any, int]:
        if depth > MAX_DEPTH:
            raise WebAuthnError("cbor_too_deep")
        self.items += 1
        if self.items > MAX_ITEMS:
            raise WebAuthnError("cbor_too_large")
        if pos >= len(self.data):
            raise WebAuthnError("cbor_truncated")
        head = self.data[pos]
        major, ai = head >> 5, head & 0x1F
        pos += 1
        if major == 7:
            if ai == 20:
                return False, pos
            if ai == 21:
                return True, pos
            if ai == 22:
                return None, pos
            raise WebAuthnError("cbor_unsupported")  # undefined, simple values, floats, break
        value, pos = self.arg(pos, ai)
        if major == 0:
            return value, pos
        if major == 1:
            return -1 - value, pos
        if major in (2, 3):
            if value > len(self.data) - pos:
                raise WebAuthnError("cbor_truncated")
            raw = self.data[pos:pos + value]
            pos += value
            if major == 2:
                return bytes(raw), pos
            try:
                return raw.decode("utf-8"), pos
            except UnicodeDecodeError:
                raise WebAuthnError("cbor_bad_text") from None
        if major == 4:
            if value > len(self.data) - pos:  # every item takes at least one byte
                raise WebAuthnError("cbor_truncated")
            out = []
            for _ in range(value):
                v, pos = self.item(pos, depth + 1)
                out.append(v)
            return out, pos
        if major == 5:
            if value * 2 > len(self.data) - pos:
                raise WebAuthnError("cbor_truncated")
            m: dict[Any, Any] = {}
            for _ in range(value):
                k, pos = self.item(pos, depth + 1)
                if not isinstance(k, (int, str)) or isinstance(k, bool):
                    raise WebAuthnError("cbor_bad_key")
                if k in m:
                    raise WebAuthnError("cbor_duplicate_key")
                v, pos = self.item(pos, depth + 1)
                m[k] = v
            return m, pos
        raise WebAuthnError("cbor_unsupported")  # major 6: tags


def cbor_decode_prefix(data: bytes, pos: int = 0) -> tuple[Any, int]:
    """One CBOR item from `data[pos:]`; returns (value, end position)."""
    return _Reader(data).item(pos, 0)


def cbor_decode(data: bytes) -> Any:
    """Exactly one CBOR item filling `data`."""
    value, end = cbor_decode_prefix(data)
    if end != len(data):
        raise WebAuthnError("cbor_trailing")
    return value


# ---------------------------------------------------------------- COSE keys

def load_cose_key(cose: bytes) -> tuple[int, Any]:
    """(alg, cryptography public key) of a COSE_Key; WebAuthnError for anything outside ES256 / RS256."""
    from cryptography.hazmat.primitives.asymmetric import ec, rsa

    try:
        key = cbor_decode(cose)
    except WebAuthnError:
        raise WebAuthnError("bad_public_key") from None
    if not isinstance(key, dict):
        raise WebAuthnError("bad_public_key")
    kty, alg = key.get(1), key.get(3)
    if alg == ALG_ES256 and kty == 2:
        crv, x, y = key.get(-1), key.get(-2), key.get(-3)
        if crv != 1 or not isinstance(x, bytes) or not isinstance(y, bytes) or len(x) != 32 or len(y) != 32:
            raise WebAuthnError("bad_public_key")
        try:
            pub = ec.EllipticCurvePublicNumbers(int.from_bytes(x, "big"), int.from_bytes(y, "big"), ec.SECP256R1()).public_key()
        except ValueError:  # not a point on the curve
            raise WebAuthnError("bad_public_key") from None
        return alg, pub
    if alg == ALG_RS256 and kty == 3:
        n, e = key.get(-1), key.get(-2)
        if not isinstance(n, bytes) or not isinstance(e, bytes) or not (256 <= len(n) <= 1024) or not (1 <= len(e) <= 8):
            raise WebAuthnError("bad_public_key")
        n_i, e_i = int.from_bytes(n, "big"), int.from_bytes(e, "big")
        if n_i.bit_length() < 2048 or e_i < 3 or e_i % 2 == 0:
            raise WebAuthnError("bad_public_key")
        try:
            pub = rsa.RSAPublicNumbers(e_i, n_i).public_key()
        except ValueError:
            raise WebAuthnError("bad_public_key") from None
        return alg, pub
    raise WebAuthnError("unsupported_algorithm")


def verify_signature(cose: bytes, alg: int, signature: bytes, data: bytes) -> None:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec, padding

    key_alg, pub = load_cose_key(cose)
    if key_alg != alg:
        raise WebAuthnError("algorithm_mismatch")
    if not signature or len(signature) > MAX_SIGNATURE:
        raise WebAuthnError("bad_signature")
    try:
        if alg == ALG_ES256:
            pub.verify(signature, data, ec.ECDSA(hashes.SHA256()))
        else:
            pub.verify(signature, data, padding.PKCS1v15(), hashes.SHA256())
    except (InvalidSignature, ValueError):
        raise WebAuthnError("bad_signature") from None


# ---------------------------------------------------------------- authenticatorData

@dataclass
class AuthData:
    rp_id_hash: bytes
    flags: int
    sign_count: int
    aaguid: bytes | None = None
    credential_id: bytes | None = None
    public_key: bytes | None = None  # the COSE_Key bytes exactly as sent
    extensions: dict | None = None

    @property
    def up(self) -> bool:
        return bool(self.flags & FLAG_UP)

    @property
    def uv(self) -> bool:
        return bool(self.flags & FLAG_UV)

    @property
    def backup_eligible(self) -> bool:
        return bool(self.flags & FLAG_BE)

    @property
    def backup_state(self) -> bool:
        return bool(self.flags & FLAG_BS)


def parse_auth_data(data: bytes) -> AuthData:
    if not isinstance(data, bytes) or len(data) < 37 or len(data) > MAX_AUTH_DATA:
        raise WebAuthnError("bad_auth_data")
    rp_hash, flags = data[:32], data[32]
    (count,) = struct.unpack(">I", data[33:37])
    if flags & FLAG_BS and not flags & FLAG_BE:
        raise WebAuthnError("bad_auth_data")
    out = AuthData(rp_id_hash=rp_hash, flags=flags, sign_count=count)
    pos = 37
    if flags & FLAG_AT:
        if len(data) < pos + 18:
            raise WebAuthnError("bad_auth_data")
        out.aaguid = data[pos:pos + 16]
        (cid_len,) = struct.unpack(">H", data[pos + 16:pos + 18])
        pos += 18
        if cid_len == 0 or cid_len > MAX_CREDENTIAL_ID or len(data) < pos + cid_len:
            raise WebAuthnError("bad_auth_data")
        out.credential_id = data[pos:pos + cid_len]
        pos += cid_len
        try:
            _key, end = cbor_decode_prefix(data, pos)
        except WebAuthnError:
            raise WebAuthnError("bad_auth_data") from None
        out.public_key = data[pos:end]
        pos = end
    if flags & FLAG_ED:
        try:
            ext, end = cbor_decode_prefix(data, pos)
        except WebAuthnError:
            raise WebAuthnError("bad_auth_data") from None
        if not isinstance(ext, dict):
            raise WebAuthnError("bad_auth_data")
        out.extensions = ext
        pos = end
    if pos != len(data):
        raise WebAuthnError("bad_auth_data")
    return out


# ---------------------------------------------------------------- clientDataJSON

def check_client_data(raw: bytes, *, kind: str, challenge: bytes, origin: str) -> dict[str, Any]:
    if not isinstance(raw, bytes) or not raw or len(raw) > MAX_CLIENT_DATA:
        raise WebAuthnError("bad_client_data")
    try:
        cd = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise WebAuthnError("bad_client_data") from None
    if not isinstance(cd, dict):
        raise WebAuthnError("bad_client_data")
    if cd.get("type") != kind:
        raise WebAuthnError("wrong_type")
    try:
        got = b64url_decode(cd.get("challenge"), limit=256)
    except WebAuthnError:
        raise WebAuthnError("wrong_challenge") from None
    if not hmac.compare_digest(got, challenge):
        raise WebAuthnError("wrong_challenge")
    if not isinstance(cd.get("origin"), str) or cd["origin"] != origin:
        raise WebAuthnError("wrong_origin")
    if cd.get("crossOrigin") not in (None, False):
        raise WebAuthnError("cross_origin")
    if "topOrigin" in cd:
        raise WebAuthnError("cross_origin")
    return cd


def challenge_of(raw_client_data: bytes) -> bytes | None:
    """The challenge a clientDataJSON names (to find the server's record); None when unreadable. Not a verification."""
    try:
        cd = json.loads(raw_client_data.decode("utf-8")) if raw_client_data and len(raw_client_data) <= MAX_CLIENT_DATA else None
        return b64url_decode(cd.get("challenge"), limit=256) if isinstance(cd, dict) else None
    except (UnicodeDecodeError, ValueError, WebAuthnError):
        return None


def rp_id_hash(rp_id: str) -> bytes:
    return hashlib.sha256(rp_id.encode("ascii")).digest()


# ---------------------------------------------------------------- the two ceremonies

@dataclass
class Registered:
    credential_id: bytes
    public_key: bytes
    alg: int
    sign_count: int
    aaguid: str
    backup_eligible: bool
    backup_state: bool
    uv: bool
    fmt: str


def verify_registration(*, attestation_object: bytes, client_data_json: bytes, raw_id: bytes, challenge: bytes, origin: str, rp_id: str,
                        require_uv: bool) -> Registered:
    check_client_data(client_data_json, kind="webauthn.create", challenge=challenge, origin=origin)
    if not isinstance(attestation_object, bytes) or len(attestation_object) > MAX_ATTESTATION_OBJECT:
        raise WebAuthnError("bad_attestation")
    try:
        att = cbor_decode(attestation_object)
    except WebAuthnError:
        raise WebAuthnError("bad_attestation") from None
    if not isinstance(att, dict) or not isinstance(att.get("fmt"), str) or not isinstance(att.get("attStmt"), dict) or not isinstance(att.get("authData"), bytes):
        raise WebAuthnError("bad_attestation")
    ad = parse_auth_data(att["authData"])
    if not hmac.compare_digest(ad.rp_id_hash, rp_id_hash(rp_id)):
        raise WebAuthnError("wrong_rp_id")
    if not ad.up:
        raise WebAuthnError("no_user_presence")
    if require_uv and not ad.uv:
        raise WebAuthnError("no_user_verification")
    if ad.credential_id is None or ad.public_key is None:
        raise WebAuthnError("bad_attestation")
    if not hmac.compare_digest(ad.credential_id, raw_id):
        raise WebAuthnError("credential_id_mismatch")
    alg, _pub = load_cose_key(ad.public_key)
    if alg not in SUPPORTED_ALGS:
        raise WebAuthnError("unsupported_algorithm")
    aaguid = ad.aaguid.hex() if ad.aaguid else ""
    return Registered(credential_id=ad.credential_id, public_key=ad.public_key, alg=alg, sign_count=ad.sign_count,
                      aaguid="" if set(aaguid) <= {"0"} else aaguid, backup_eligible=ad.backup_eligible, backup_state=ad.backup_state,
                      uv=ad.uv, fmt=att["fmt"][:32])


@dataclass
class Asserted:
    sign_count: int
    uv: bool
    backup_state: bool
    backup_eligible: bool = False


def verify_assertion(*, public_key: bytes, alg: int, authenticator_data: bytes, client_data_json: bytes, signature: bytes, challenge: bytes,
                     origin: str, rp_id: str, require_uv: bool, stored_sign_count: int) -> Asserted:
    check_client_data(client_data_json, kind="webauthn.get", challenge=challenge, origin=origin)
    ad = parse_auth_data(authenticator_data)
    if ad.flags & FLAG_AT:  # an assertion never carries attested credential data
        raise WebAuthnError("bad_auth_data")
    if not hmac.compare_digest(ad.rp_id_hash, rp_id_hash(rp_id)):
        raise WebAuthnError("wrong_rp_id")
    if not ad.up:
        raise WebAuthnError("no_user_presence")
    if require_uv and not ad.uv:
        raise WebAuthnError("no_user_verification")
    verify_signature(public_key, alg, signature, authenticator_data + hashlib.sha256(client_data_json).digest())
    if (stored_sign_count or ad.sign_count) and ad.sign_count <= int(stored_sign_count or 0):
        raise WebAuthnError("counter_regression")  # checked after the signature: only a genuine assertion can report a clone
    return Asserted(sign_count=ad.sign_count, uv=ad.uv, backup_state=ad.backup_state, backup_eligible=ad.backup_eligible)
