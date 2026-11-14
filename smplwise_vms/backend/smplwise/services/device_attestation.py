"""ATTEST232-295 (docs/changes/CR-ATTEST232.md): device hardware attestation for the app refresh token's device key.

A phone proves that the ES256 key it registers at mint (APPREFRESH2) really lives in secure hardware of a genuine device: Android Key
Attestation (a certificate chain whose leaf carries the key and a KeyDescription extension) or iOS App Attest. This module is the
PLUGGABLE VERIFIER layer only: an interface, a registry, a real structural Android verifier that runs on the backend's existing
`cryptography` dependency against administrator-supplied trust roots, and an iOS placeholder that answers `unavailable`.

No network access of any kind: nothing here calls Google or Apple. Trust roots come from the Settings (PEM text); with none configured the
Android verifier answers `unavailable` (never `verified`). Tests inject fakes with `override_verifiers`.

Nothing here logs or returns attestation material: a verdict is a status, a level and a short reason code."""
from __future__ import annotations

import base64
import binascii
import contextlib
import datetime as dt
import hashlib
import re
from dataclasses import dataclass, field
from typing import Any, Iterator, Protocol

from cryptography import x509
from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import serialization

FORMAT_ANDROID = "android_key_attestation"
FORMAT_IOS = "ios_app_attest"
FORMATS = (FORMAT_ANDROID, FORMAT_IOS)

VERIFIED, FAILED, UNAVAILABLE, MISSING = "verified", "failed", "unavailable", "missing"
# security levels in increasing order of assurance; iOS App Attest counts as a hardware (tee) level
LEVELS = ("software", "tee", "strongbox")
LEVEL_APP_ATTEST = "app_attest"
CHALLENGE_VERSION = "arx-app-attest-v1"
MAX_ITEMS = 8
MAX_ITEM_LEN = 8000
MAX_ROOTS_PEM = 20000

_B64 = re.compile(r"^[A-Za-z0-9_+/=-]+$")
_KEY_DESCRIPTION_OID = "1.3.6.1.4.1.11129.2.1.17"


@dataclass(frozen=True)
class Verdict:
    status: str  # verified | failed | unavailable
    level: str | None = None
    reason: str | None = None  # a short code, never input echoed


@dataclass(frozen=True)
class Context:
    """What a verifier is given. `challenge` is derived by `challenge_for` - the app computes the same 32 bytes and passes them to the
    platform API (Android `setAttestationChallenge`, iOS `clientDataHash`)."""
    device_id: str
    install_id: str
    key_spki: bytes  # the registered device key, SubjectPublicKeyInfo DER
    challenge: bytes
    trust_roots_pem: str
    now: dt.datetime
    settings: dict[str, Any] = field(default_factory=dict)


class Verifier(Protocol):
    def verify(self, data: list[str], ctx: Context) -> Verdict: ...


def challenge_for(device_id: str, install_id: str) -> bytes:
    """SHA-256 over the version line, device id and install id (LF-joined, UTF-8). It ties an attestation to one device registration, so
    one genuine phone's attestation cannot vouch for another registration. Freshness comes from the mint's own proof of possession (a
    signed timestamp), not from this value: the key is attested when it is generated, before any server nonce exists."""
    return hashlib.sha256("\n".join((CHALLENGE_VERSION, device_id, install_id)).encode("utf-8")).digest()


def level_rank(level: str | None) -> int:
    if level == LEVEL_APP_ATTEST:
        return LEVELS.index("tee")
    return LEVELS.index(level) if level in LEVELS else -1


def clean_data(raw: Any) -> list[str] | None:
    """The attestation payload as sent: 1..MAX_ITEMS base64 / base64url strings. None = malformed."""
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_ITEMS:
        return None
    for item in raw:
        if not isinstance(item, str) or not 1 <= len(item) <= MAX_ITEM_LEN or not _B64.match(item):
            return None
    return list(raw)


def _b64_any(text: str) -> bytes:
    body = text.replace("-", "+").replace("_", "/").rstrip("=")
    try:
        return base64.b64decode(body + "=" * (-len(body) % 4), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("encoding") from exc


# ---------------------------------------------------------------- a tiny DER reader (just what KeyDescription needs)

def _tlv(buf: bytes, pos: int) -> tuple[int, bytes, int]:
    if pos + 2 > len(buf):
        raise ValueError("der")
    tag = buf[pos]
    n = buf[pos + 1]
    pos += 2
    if n & 0x80:
        k = n & 0x7F
        if not 1 <= k <= 3 or pos + k > len(buf):
            raise ValueError("der")
        n = int.from_bytes(buf[pos:pos + k], "big")
        pos += k
    if pos + n > len(buf):
        raise ValueError("der")
    return tag, buf[pos:pos + n], pos + n


def parse_key_description(der: bytes) -> tuple[int, bytes]:
    """(attestationSecurityLevel, attestationChallenge) of an Android KeyDescription. Raises ValueError on anything else."""
    tag, body, _ = _tlv(der, 0)
    if tag != 0x30:
        raise ValueError("der")
    pos = 0
    fields: list[tuple[int, bytes]] = []
    while pos < len(body) and len(fields) < 5:
        t, v, pos = _tlv(body, pos)
        fields.append((t, v))
    if len(fields) < 5 or fields[1][0] != 0x0A or fields[4][0] != 0x04:
        raise ValueError("der")
    return int.from_bytes(fields[1][1], "big"), fields[4][1]


_ANDROID_LEVEL = {0: "software", 1: "tee", 2: "strongbox"}


def parse_roots(pem: str) -> list[x509.Certificate]:
    """Every certificate in a PEM bundle. Raises ValueError for text that holds none or an unreadable one."""
    blocks = re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", pem or "", flags=re.S)
    if not blocks:
        raise ValueError("no_certificates")
    try:
        return [x509.load_pem_x509_certificate(b.encode("ascii")) for b in blocks]
    except (ValueError, UnsupportedAlgorithm) as exc:
        raise ValueError("certificate") from exc


class AndroidKeyAttestationVerifier:
    """Structural verification of an Android Key Attestation chain (leaf first, base64 DER certificates): each certificate is signed by
    the next, the last by (or is) one of the configured trust roots, all inside their validity period; the leaf's public key is the
    registered device key; its KeyDescription extension carries the expected challenge and a security level. Revocation (Google's status
    list) is NOT checked: that needs the network, so it is not part of this layer. The package / signing-certificate check
    (attestationApplicationId) and the verified-boot state are follow-ups."""

    def verify(self, data: list[str], ctx: Context) -> Verdict:
        if not ctx.trust_roots_pem.strip():
            return Verdict(UNAVAILABLE, reason="no_trust_roots")
        try:
            roots = parse_roots(ctx.trust_roots_pem)
        except ValueError:
            return Verdict(UNAVAILABLE, reason="trust_roots_unreadable")
        try:
            chain = [x509.load_der_x509_certificate(_b64_any(item)) for item in data]
        except (ValueError, UnsupportedAlgorithm):
            return Verdict(FAILED, reason="chain_unreadable")
        for cert in chain:
            if not (cert.not_valid_before_utc <= ctx.now <= cert.not_valid_after_utc):
                return Verdict(FAILED, reason="certificate_not_valid_now")
        try:
            for child, parent in zip(chain, chain[1:]):
                child.verify_directly_issued_by(parent)
        except (ValueError, TypeError, InvalidSignature, UnsupportedAlgorithm):
            return Verdict(FAILED, reason="chain_signature")
        top = chain[-1]
        if not any(top == r for r in roots) and not self._issued_by_any(top, roots):
            return Verdict(FAILED, reason="untrusted_root")
        leaf = chain[0]
        spki = leaf.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        if spki != ctx.key_spki:
            return Verdict(FAILED, reason="key_mismatch")
        try:
            ext = leaf.extensions.get_extension_for_oid(x509.ObjectIdentifier(_KEY_DESCRIPTION_OID))
            level_code, challenge = parse_key_description(ext.value.value)
        except (x509.ExtensionNotFound, ValueError, AttributeError):
            return Verdict(FAILED, reason="no_key_description")
        if challenge != ctx.challenge:
            return Verdict(FAILED, reason="challenge_mismatch")
        level = _ANDROID_LEVEL.get(level_code)
        return Verdict(VERIFIED, level=level) if level else Verdict(FAILED, reason="unknown_security_level")

    @staticmethod
    def _issued_by_any(cert: x509.Certificate, roots: list[x509.Certificate]) -> bool:
        for r in roots:
            try:
                cert.verify_directly_issued_by(r)
                return True
            except (ValueError, TypeError, InvalidSignature, UnsupportedAlgorithm):
                continue
        return False


class IosAppAttestVerifier:
    """Placeholder: iOS App Attest needs CBOR / attestation-object verification against Apple's App Attest root and the app id, which is a
    separate slice (CR-ATTEST232 section 9). Until it is installed it answers `unavailable` - never `verified`."""

    def verify(self, data: list[str], ctx: Context) -> Verdict:
        return Verdict(UNAVAILABLE, reason="verifier_not_installed")


_DEFAULT: dict[str, Verifier] = {FORMAT_ANDROID: AndroidKeyAttestationVerifier(), FORMAT_IOS: IosAppAttestVerifier()}
_override: dict[str, Verifier] | None = None


def verifiers() -> dict[str, Verifier]:
    return _override if _override is not None else _DEFAULT


@contextlib.contextmanager
def override_verifiers(mapping: dict[str, Verifier]) -> Iterator[None]:
    """Tests (and a future deployment hook) replace the verifier set; the default is restored on exit."""
    global _override
    previous = _override
    _override = dict(mapping)
    try:
        yield
    finally:
        _override = previous


def check(fmt: Any, data: Any, ctx: Context) -> Verdict:
    """Run the verifier for `fmt`. Never raises: a malformed payload, an unknown format or a verifier error is a `failed` verdict with a
    code (the error text is dropped, it could echo input)."""
    verifier = verifiers().get(fmt) if isinstance(fmt, str) else None
    if verifier is None:
        return Verdict(FAILED, reason="unsupported_format")
    items = clean_data(data)
    if items is None:
        return Verdict(FAILED, reason="malformed")
    try:
        verdict = verifier.verify(items, ctx)
    except Exception:  # noqa: BLE001 - a verifier bug must degrade to a refusal code, never a 500 and never leak input
        return Verdict(FAILED, reason="verifier_error")
    if verdict.status not in (VERIFIED, FAILED, UNAVAILABLE):
        return Verdict(FAILED, reason="verifier_error")
    return verdict


__all__ = ["FORMAT_ANDROID", "FORMAT_IOS", "FORMATS", "VERIFIED", "FAILED", "UNAVAILABLE", "MISSING", "LEVELS", "LEVEL_APP_ATTEST", "Verdict",
           "Context", "Verifier", "AndroidKeyAttestationVerifier", "IosAppAttestVerifier", "challenge_for", "level_rank", "clean_data", "check",
           "override_verifiers", "verifiers", "parse_roots", "parse_key_description", "MAX_ROOTS_PEM"]
