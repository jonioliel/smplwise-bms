"""MFA-DEVICEKEY-ATTEST-2490 (MFA-STEPUP-TRAIN-2490 slice 9 "DEVICEKEY-ATTEST"; owner decision 2026-11-22 Q52 "phone hardware
attestation: YES" - the non-recommended option, risk recorded in docs/changes/MFA-DEVICEKEY-ATTEST-2490.md; design
docs/design/full-2fa-t095/DESIGN.md 4.4a): Android key attestation of the PHONE KEY (services/device_keys.py).

When the app creates its phone key it asks the Keystore to attest it: `setAttestationChallenge(SHA-256(register payload))`, where the
register payload is the exact text the new key then signs (`arx-device-key|v1|register|<origin>|<user>|-|-|<nonce>`). The app sends the
Keystore's certificate chain (leaf first, base64 DER) with the registration. This module judges that chain OFFLINE:

1. the leaf certifies the very public key being registered;
2. every certificate of the path is signed by the next one, every certificate above the leaf is a CA (BasicConstraints cA, keyCertSign
   when a KeyUsage is present, the pathLenConstraint kept) and only the leaf carries the KeyDescription (SEC-FIX-2520 SEC-2:
   device_attestation.ca_path_problem), and the path ends at a PINNED Google hardware attestation root
   (`smplwise/assets/attestation/google_roots.json`, fetched from Google's published list and reviewed - no network at runtime). A root
   is matched by its public key, so a chain that carries an older issue of the same root key (Google re-issued its RSA root in 2016,
   2019 and 2022) is anchored all the same; whatever the chain carries above the anchor is ignored;
3. every certificate of the path is inside its validity period;
4. no certificate of the path is on the SHIPPED SNAPSHOT of Google's attestation status list
   (`smplwise/assets/attestation/google_attestation_status.json`) - a snapshot, so a key Google revokes after `fetched` is not known
   (documented limit; the file is refreshed with each release that touches it);
5. the leaf's KeyDescription extension (OID 1.3.6.1.4.1.11129.2.1.17) carries attestationChallenge == SHA-256(register payload);
6. attestationSecurityLevel: TrustedEnvironment (1) or StrongBox (2) -> `hardware`; Software (0) -> `software`.

Verdicts (`attested` column, migration 0223): `hardware` | `software` | `none` (no chain sent) | `failed` (a chain that did not pass;
the reason code is kept). The setting `security.device_key_attestation`:

* `off`       - nothing is checked or kept (`attested` NULL: "not checked");
* `preferred` - (default) the verdict is recorded and audited, a registration is NEVER refused for it;
* `required`  - a registration whose verdict is not `hardware` is refused (422 `device_key_attestation_required`), and an existing key
  that is not `hardware` stops counting (no sign-in factor, no step-up proof) until the user registers an attested key.

Changing the setting is a settings change (`system.configure`, therefore step-up gated); it is never exported or restored
(backup.SETTINGS_KEEP). Nothing here logs, stores or returns a certificate, the challenge or key material: the kept summary is the mode,
the verdict, the level, a reason code, a 16-hex prefix of the anchoring root key, the chain length and the status-list date.

What attestation does NOT prove (the accepted risk): a genuine phone that is rooted or whose TEE is broken can still attest; the
`attestationApplicationId` (which app made the key) and the verified-boot state are not judged in this slice; a pinned-root change by
Google needs a new release."""
from __future__ import annotations

import datetime as dt
import functools
import hashlib
import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cryptography import x509
from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import serialization

from . import device_attestation as da

SETTING_KEY = "security.device_key_attestation"
MODE_OFF, MODE_PREFERRED, MODE_REQUIRED = "off", "preferred", "required"
MODES = (MODE_OFF, MODE_PREFERRED, MODE_REQUIRED)
DEFAULT_MODE = MODE_PREFERRED

HARDWARE, SOFTWARE, NONE, FAILED = "hardware", "software", "none", "failed"
VERDICTS = (HARDWARE, SOFTWARE, NONE, FAILED)
NOT_CHECKED = "not_checked"  # what the API says for a NULL column

KEY_DESCRIPTION_OID = "1.3.6.1.4.1.11129.2.1.17"
_LEVEL = {0: "software", 1: "tee", 2: "strongbox"}

ASSET_DIR = Path(__file__).resolve().parent.parent / "assets" / "attestation"
ROOTS_FILE = ASSET_DIR / "google_roots.json"
STATUS_FILE = ASSET_DIR / "google_attestation_status.json"

REQUIRED_HE = "ההגדרות של המערכת דורשות מפתח טלפון שמאומת בחומרה מאובטחת של הטלפון. הטלפון הזה לא הציג אימות כזה."
KEY_NOT_ATTESTED_HE = "ההגדרות של המערכת דורשות מפתח טלפון שמאומת בחומרה. רשום את מפתח הטלפון מחדש מהאפליקציה."


@dataclass(frozen=True)
class Result:
    attested: str  # hardware | software | none | failed
    level: str | None = None  # software | tee | strongbox (from the extension, when it was read)
    reason: str | None = None  # a short code, never input
    root: str | None = None  # 16-hex prefix of SHA-256(SPKI) of the anchoring pinned root
    chain_len: int = 0


# ---------------------------------------------------------------- the setting

def mode(conn: sqlite3.Connection) -> str:
    """A hand-edited unknown stored value fails CLOSED (`required`)."""
    from ..db import get_setting

    value = get_setting(conn, SETTING_KEY, DEFAULT_MODE) or DEFAULT_MODE
    return value if value in MODES else MODE_REQUIRED


# ---------------------------------------------------------------- the pinned data (read once; tests may point elsewhere)

@dataclass(frozen=True)
class Pins:
    roots: tuple[x509.Certificate, ...]
    root_spkis: dict[bytes, str]  # SPKI DER -> 16-hex prefix of its SHA-256
    revoked: frozenset[str]  # lowercase hex serials without leading zeros
    status_fetched: str


def _spki(cert: x509.Certificate) -> bytes:
    return cert.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)


def _serial_hex(cert: x509.Certificate) -> str:
    return format(cert.serial_number, "x")


def build_pins(roots_pem: list[str], revoked: list[str] | None = None, status_fetched: str = "") -> Pins:
    certs = tuple(x509.load_pem_x509_certificate(p.encode("ascii")) for p in roots_pem)
    return Pins(roots=certs, root_spkis={_spki(c): hashlib.sha256(_spki(c)).hexdigest()[:16] for c in certs},
                revoked=frozenset((s.strip().lower().lstrip("0") or "0") for s in (revoked or [])), status_fetched=status_fetched)


@functools.lru_cache(maxsize=1)
def _shipped_pins() -> Pins:
    roots = json.loads(ROOTS_FILE.read_text(encoding="utf-8"))
    status = json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    return build_pins([r["pem"] for r in roots["roots"]], list(status["entries"].keys()), status.get("fetched", ""))


_override: Pins | None = None


def pins() -> Pins:
    return _override if _override is not None else _shipped_pins()


def set_pins_for_tests(value: Pins | None) -> None:
    global _override
    _override = value


# ---------------------------------------------------------------- the check

def challenge_of(register_payload: bytes) -> bytes:
    """The attestation challenge the app passes to `setAttestationChallenge`: SHA-256 of the register payload it is about to sign."""
    return hashlib.sha256(register_payload).digest()


def _issued_by(child: x509.Certificate, parent: x509.Certificate) -> bool:
    try:
        child.verify_directly_issued_by(parent)
        return True
    except (ValueError, TypeError, InvalidSignature, UnsupportedAlgorithm):
        return False


def verify_chain(data: Any, *, key_spki: bytes, challenge: bytes, now: dt.datetime | None = None, pinned: Pins | None = None) -> Result:
    """Judge one Android key attestation chain. Never raises. `data` None / [] = the app sent nothing (`none`)."""
    if data is None or data == []:
        return Result(NONE, reason="no_chain")
    try:
        return _verify(data, key_spki, challenge, now or dt.datetime.now(dt.timezone.utc), pinned or pins())
    except Exception:  # noqa: BLE001 - a parser surprise is a refusal code, never a 500 and never echoed input
        return Result(FAILED, reason="verifier_error")


def _verify(data: Any, key_spki: bytes, challenge: bytes, now: dt.datetime, pinned: Pins) -> Result:
    items = da.clean_data(data)
    if items is None:
        return Result(FAILED, reason="malformed")
    try:
        chain = [x509.load_der_x509_certificate(da._b64_any(item)) for item in items]
    except (ValueError, UnsupportedAlgorithm):
        return Result(FAILED, reason="chain_unreadable", chain_len=len(items))
    n = len(chain)
    if not pinned.roots:
        return Result(FAILED, reason="no_pinned_roots", chain_len=n)
    if _spki(chain[0]) != key_spki:
        return Result(FAILED, reason="key_mismatch", chain_len=n)
    # the anchor: the first certificate (never the leaf) whose key is a pinned root's key; the path is everything below it
    anchor = next((i for i in range(1, n) if _spki(chain[i]) in pinned.root_spkis), None)
    path = chain[:anchor] if anchor is not None else chain
    for child, parent in zip(path, path[1:]):
        if not _issued_by(child, parent):
            return Result(FAILED, reason="chain_signature", chain_len=n)
    top = path[-1]
    root = next((r for r in pinned.roots if _issued_by(top, r)), None)
    if root is None:
        # the chain carries a pinned root key but its last link to it is broken: a broken chain, not a foreign root
        return Result(FAILED, reason="chain_signature" if anchor is not None else "untrusted_root", chain_len=n)
    root_prefix = pinned.root_spkis[_spki(root)]
    problem = da.ca_path_problem(path + [root])  # SEC-FIX-2520 SEC-2: every certificate above the leaf is a CA, the extension on the leaf only
    if problem is not None:
        return Result(FAILED, reason=problem, root=root_prefix, chain_len=n)
    for cert in path:
        if not (cert.not_valid_before_utc <= now <= cert.not_valid_after_utc):
            return Result(FAILED, reason="certificate_not_valid_now", root=root_prefix, chain_len=n)
    if any(_serial_hex(c) in pinned.revoked for c in path):
        return Result(FAILED, reason="revoked", root=root_prefix, chain_len=n)
    try:
        ext = chain[0].extensions.get_extension_for_oid(x509.ObjectIdentifier(KEY_DESCRIPTION_OID))
        level_code, got = da.parse_key_description(ext.value.value)
    except (x509.ExtensionNotFound, ValueError, AttributeError):
        return Result(FAILED, reason="no_key_description", root=root_prefix, chain_len=n)
    if got != challenge:
        return Result(FAILED, reason="challenge_mismatch", root=root_prefix, chain_len=n)
    level = _LEVEL.get(level_code)
    if level is None:
        return Result(FAILED, reason="unknown_security_level", root=root_prefix, chain_len=n)
    return Result(SOFTWARE if level == "software" else HARDWARE, level=level, root=root_prefix, chain_len=n)


# ---------------------------------------------------------------- policy

def summary(result: Result, mode_now: str, checked_at: str) -> str:
    """The JSON kept in `auth_device_keys.attestation_json`: no certificate, no challenge, no key."""
    return json.dumps({"mode": mode_now, "attested": result.attested, "level": result.level, "reason": result.reason,
                       "root": result.root, "chain_len": result.chain_len, "status_list": pins().status_fetched or None,
                       "checked_at": checked_at}, sort_keys=True)


def counts(conn: sqlite3.Connection, attested: Any) -> bool:
    """May a key with this stored verdict be used (sign-in factor, step-up proof)? Only `required` restricts, to `hardware`."""
    return mode(conn) != MODE_REQUIRED or attested == HARDWARE


__all__ = ["SETTING_KEY", "MODES", "DEFAULT_MODE", "MODE_OFF", "MODE_PREFERRED", "MODE_REQUIRED", "HARDWARE", "SOFTWARE", "NONE", "FAILED",
           "VERDICTS", "NOT_CHECKED", "Result", "Pins", "mode", "pins", "build_pins", "set_pins_for_tests", "challenge_of", "verify_chain",
           "summary", "counts"]


def reset_for_tests() -> None:
    set_pins_for_tests(None)


from ..test_reset import register_reset  # noqa: E402 - imports nothing from the package

register_reset(__name__, ("_override",), reset_for_tests)
