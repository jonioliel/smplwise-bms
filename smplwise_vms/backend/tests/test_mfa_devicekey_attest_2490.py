"""MFA-DEVICEKEY-ATTEST-2490 (MFA-STEPUP-TRAIN-2490 slice 9; owner decision 2026-11-22 Q52): Android key attestation of the phone key
(services/device_key_attestation.py, services/device_keys.check_attestation, routers/device_keys.py, migration 0223).

The phone's Keystore chain is simulated with generated certificate chains (`cryptography`): a test root that the test pins in place of
Google's (`set_pins_for_tests`), an intermediate, and a leaf that certifies the phone's key and carries the KeyDescription extension
(OID 1.3.6.1.4.1.11129.2.1.17) with a chosen security level and attestation challenge. Covered: hardware (TEE, StrongBox), software,
none, a broken chain, a wrong (unpinned) root, a wrong challenge, another key, a revoked or expired certificate, a chain carrying an
older issue of the pinned root key, every mode of `security.device_key_attestation` (off / preferred / required, a hand-edited value),
the setting's validation, step-up and backup rules, and the shipped Google roots / status snapshot. A real phone is NOT run here."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
from fastapi.testclient import TestClient

from smplwise.services import device_key_attestation as dka
from smplwise.services import device_keys as dk
from test_mfa_devicekey_2490 import CHALLENGE, KEYS, SETTINGS, Phone, clock, details, key_row, prove, step_up_challenge, verify  # noqa: F401
from test_second_factor import arx, fresh_login  # noqa: F401 - `arx` is the fixture

API = "/arx/api/v1"
NOW = dt.datetime.now(dt.timezone.utc)
OID = x509.ObjectIdentifier(dka.KEY_DESCRIPTION_OID)


# ---------------------------------------------------------------- chain fixtures

def _der_len(n: int) -> bytes:
    if n < 0x80:
        return bytes([n])
    b = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(b)]) + b


def _tlv(tag: int, body: bytes) -> bytes:
    return bytes([tag]) + _der_len(len(body)) + body


def key_description(level: int, challenge: bytes) -> bytes:
    """KeyDescription ::= SEQUENCE { attestationVersion INTEGER, attestationSecurityLevel ENUMERATED, keyMintVersion INTEGER,
    keyMintSecurityLevel ENUMERATED, attestationChallenge OCTET STRING, uniqueId OCTET STRING, softwareEnforced AuthorizationList,
    hardwareEnforced AuthorizationList } - the AuthorizationLists empty."""
    body = (_tlv(0x02, (300).to_bytes(2, "big")) + _tlv(0x0A, bytes([level])) + _tlv(0x02, (300).to_bytes(2, "big"))
            + _tlv(0x0A, bytes([level])) + _tlv(0x04, challenge) + _tlv(0x04, b"") + _tlv(0x30, b"") + _tlv(0x30, b""))
    return _tlv(0x30, body)


def _name(cn: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def _cert(subject: str, public_key, issuer: str, signer, *, ca: bool, serial: int | None = None, not_before=None, not_after=None,
          extension: bytes | None = None) -> x509.Certificate:
    b = (x509.CertificateBuilder().subject_name(_name(subject)).issuer_name(_name(issuer)).public_key(public_key)
         .serial_number(serial or x509.random_serial_number())
         .not_valid_before(not_before or NOW - dt.timedelta(days=1)).not_valid_after(not_after or NOW + dt.timedelta(days=3650))
         .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True))
    if extension is not None:
        b = b.add_extension(x509.UnrecognizedExtension(OID, extension), critical=False)
    return b.sign(signer, hashes.SHA256())


class Ca:
    def __init__(self, name: str = "Test Attestation Root") -> None:
        self.name = name
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.cert = _cert(name, self.key.public_key(), name, self.key, ca=True)

    def pem(self) -> str:
        return self.cert.public_bytes(serialization.Encoding.PEM).decode("ascii")


def b64(cert: x509.Certificate) -> str:
    return base64.b64encode(cert.public_bytes(serialization.Encoding.DER)).decode("ascii")


def chain_for(phone: Phone, challenge: bytes, *, root: Ca, level: int = 1, include_root: bool = True, extension: bool = True,
              inter_signer=None, inter_serial: int | None = None, inter_not_after=None, leaf_key=None) -> list[str]:
    """Leaf (the phone's key + KeyDescription) <- intermediate <- root, leaf first, base64 DER - KeyStore.getCertificateChain()."""
    inter_key = ec.generate_private_key(ec.SECP256R1())
    inter = _cert("Test Attestation Intermediate", inter_key.public_key(), root.name, inter_signer or root.key, ca=True,
                  serial=inter_serial, not_after=inter_not_after)
    leaf = _cert("Android Keystore Key", leaf_key or phone.key.public_key(), "Test Attestation Intermediate", inter_key, ca=False,
                 extension=key_description(level, challenge) if extension else None)
    out = [b64(leaf), b64(inter)]
    return out + [b64(root.cert)] if include_root else out


def spki(phone: Phone) -> bytes:
    return phone.key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)


@pytest.fixture()
def root():
    ca = Ca()
    dka.set_pins_for_tests(dka.build_pins([ca.pem()], [], "2026-11-24"))
    yield ca
    dka.set_pins_for_tests(None)


def register_attested(arx, phone: Phone, chain_maker=None, *, auth_kind: str = "biometric_or_screen_lock"):
    """The app's flow: a register challenge -> attest the new key with SHA-256(payload) -> sign the payload -> send key + chain."""
    c = arx.client.post(CHALLENGE, json={"purpose": "register"})
    assert c.status_code == 200, c.text
    c = c.json()
    body = {"challenge_id": c["challenge_id"], "public_key": phone.public_key(), "signature": phone.sign(c["payload"]), "label": "Pixel",
            "auth_kind": auth_kind}
    if chain_maker is not None:
        body["attestation"] = chain_maker(hashlib.sha256(c["payload"].encode("utf-8")).digest())
    r = arx.client.post(KEYS, json=body)
    if r.status_code == 200:
        phone.key_id = r.json()["id"]
    return r


# ---------------------------------------------------------------- the verifier (unit)

def test_hardware_tee_and_strongbox_software_and_none(root):
    phone = Phone()
    ch = b"\x01" * 32
    tee = dka.verify_chain(chain_for(phone, ch, root=root, level=1), key_spki=spki(phone), challenge=ch)
    assert (tee.attested, tee.level, tee.reason, tee.chain_len) == ("hardware", "tee", None, 3) and len(tee.root) == 16
    sb = dka.verify_chain(chain_for(phone, ch, root=root, level=2), key_spki=spki(phone), challenge=ch)
    assert (sb.attested, sb.level) == ("hardware", "strongbox")
    sw = dka.verify_chain(chain_for(phone, ch, root=root, level=0), key_spki=spki(phone), challenge=ch)
    assert (sw.attested, sw.level) == ("software", "software")
    assert dka.verify_chain(None, key_spki=spki(phone), challenge=ch).attested == "none"
    assert dka.verify_chain([], key_spki=spki(phone), challenge=ch).attested == "none"
    # the chain without the root itself (the top is issued by the pinned root) is as good
    assert dka.verify_chain(chain_for(phone, ch, root=root, include_root=False), key_spki=spki(phone), challenge=ch).attested == "hardware"


@pytest.mark.parametrize("case, reason", [
    ("broken_chain", "chain_signature"),
    ("wrong_root", "untrusted_root"),
    ("wrong_root_no_copy", "untrusted_root"),
    ("wrong_challenge", "challenge_mismatch"),
    ("other_key", "key_mismatch"),
    ("no_extension", "no_key_description"),
    ("revoked", "revoked"),
    ("expired", "certificate_not_valid_now"),
    ("unknown_level", "unknown_security_level"),
    ("garbage", "chain_unreadable"),
    ("malformed", "malformed"),
])
def test_failed_verdicts_carry_a_reason_code(root, case, reason):
    phone = Phone()
    ch = b"\x02" * 32
    if case == "broken_chain":
        data = chain_for(phone, ch, root=root, inter_signer=ec.generate_private_key(ec.SECP256R1()))
    elif case == "wrong_root":
        data = chain_for(phone, ch, root=Ca("Test Attestation Root"))  # same name, another key: not pinned
    elif case == "wrong_root_no_copy":
        data = chain_for(phone, ch, root=Ca("Another Root"), include_root=False)
    elif case == "wrong_challenge":
        data = chain_for(phone, b"\x03" * 32, root=root)
    elif case == "other_key":
        data = chain_for(phone, ch, root=root, leaf_key=ec.generate_private_key(ec.SECP256R1()).public_key())
    elif case == "no_extension":
        data = chain_for(phone, ch, root=root, extension=False)
    elif case == "revoked":
        dka.set_pins_for_tests(dka.build_pins([root.pem()], ["00ABCDEF0123"], "2026-11-24"))  # leading zeros and case do not matter
        data = chain_for(phone, ch, root=root, inter_serial=0xABCDEF0123)
    elif case == "expired":
        data = chain_for(phone, ch, root=root, inter_not_after=NOW - dt.timedelta(minutes=1))
    elif case == "unknown_level":
        data = chain_for(phone, ch, root=root, level=7)
    elif case == "garbage":
        data = [base64.b64encode(b"not a certificate").decode()]
    else:
        data = ["not base64 !!"]
    result = dka.verify_chain(data, key_spki=spki(phone), challenge=ch)
    assert (result.attested, result.reason) == ("failed", reason)


def test_a_chain_carrying_an_older_issue_of_the_pinned_root_key_is_anchored_by_the_key(root):
    """Google re-issued its RSA root (2016, 2019, 2022) with the same key: a phone may carry an expired older issue at the top."""
    phone = Phone()
    ch = b"\x04" * 32
    old_issue = _cert(root.name, root.key.public_key(), root.name, root.key, ca=True, not_before=NOW - dt.timedelta(days=4000),
                      not_after=NOW - dt.timedelta(days=10))
    data = chain_for(phone, ch, root=root, include_root=False) + [b64(old_issue)]
    assert dka.verify_chain(data, key_spki=spki(phone), challenge=ch).attested == "hardware"


def test_no_pinned_roots_never_passes():
    dka.set_pins_for_tests(dka.build_pins([], [], ""))
    try:
        phone = Phone()
        result = dka.verify_chain(chain_for(phone, b"\x05" * 32, root=Ca()), key_spki=spki(phone), challenge=b"\x05" * 32)
        assert (result.attested, result.reason) == ("failed", "no_pinned_roots")
    finally:
        dka.set_pins_for_tests(None)


def test_the_shipped_google_roots_and_status_snapshot():
    """The data files under smplwise/assets/attestation: Google's published roots (self-signed, fingerprints as recorded) and the status
    list snapshot - read offline, no network."""
    doc = json.loads(dka.ROOTS_FILE.read_text(encoding="utf-8"))
    assert doc["source"].startswith("https://android.googleapis.com/attestation/root") and doc["fetched"] == "2026-11-24"
    assert len(doc["roots"]) == 2
    for r in doc["roots"]:
        cert = x509.load_pem_x509_certificate(r["pem"].encode("ascii"))
        cert.verify_directly_issued_by(cert)  # self-signed: a damaged copy fails here
        assert hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest() == r["cert_sha256"]
        assert hashlib.sha256(cert.public_key().public_bytes(serialization.Encoding.DER,
                                                             serialization.PublicFormat.SubjectPublicKeyInfo)).hexdigest() == r["spki_sha256"]
        assert cert.not_valid_after_utc > NOW
    subjects = {r["subject"] for r in doc["roots"]}
    assert "2.5.4.5=f92009e853b6b045" in subjects and any("Key Attestation CA1" in s for s in subjects)
    shipped = dka._shipped_pins()
    assert len(shipped.roots) == 2 and len(shipped.revoked) > 1000 and shipped.status_fetched == "2026-11-24"
    assert all(s == s.lower() and not s.startswith("0") for s in shipped.revoked)
    phone = Phone()  # a self-made chain never passes the real pins
    result = dka.verify_chain(chain_for(phone, b"\x06" * 32, root=Ca()), key_spki=spki(phone), challenge=b"\x06" * 32, pinned=shipped)
    assert (result.attested, result.reason) == ("failed", "untrusted_root")


# ---------------------------------------------------------------- registration through the API, per mode

def test_preferred_is_the_default_records_every_verdict_and_never_refuses(arx, root, clock):
    assert fresh_login(arx, arx.viewer).status_code == 200
    assert arx.client.post(CHALLENGE, json={"purpose": "register"}).json()["attestation"] == "preferred"
    hw = Phone()
    r = register_attested(arx, hw, lambda c: chain_for(hw, c, root=root, level=1))
    assert r.status_code == 200, r.text
    assert r.json()["attested"] == "hardware" and r.json()["counts"] is True
    stored = key_row(arx, hw.key_id)
    kept = json.loads(stored["attestation_json"])
    assert stored["attested"] == "hardware" and kept["mode"] == "preferred" and kept["level"] == "tee" and kept["chain_len"] == 3
    assert kept["status_list"] == "2026-11-24" and "BEGIN" not in stored["attestation_json"] and len(stored["attestation_json"]) < 400
    audit = details(arx.audit("auth.device_key.registered")[-1])
    assert audit["attested"] == "hardware" and audit["attestation_mode"] == "preferred" and audit["level"] == "tee"
    others = {
        "software": lambda p: (lambda c: chain_for(p, c, root=root, level=0)),
        "none": lambda p: None,
        "failed": lambda p: (lambda c: chain_for(p, b"\x00" * 32, root=root)),  # the chain of another registration
    }
    for verdict, maker in others.items():
        prove(arx, hw, "auth.device_key.register")  # the user has a method now: each further key needs a proof
        p = Phone()
        r = register_attested(arx, p, maker(p))
        assert r.status_code == 200 and r.json()["attested"] == verdict and r.json()["counts"] is True, (verdict, r.text)
    failed = json.loads(key_row(arx, p.key_id)["attestation_json"])
    assert failed["attested"] == "failed" and failed["reason"] == "challenge_mismatch"
    listed = arx.client.get(KEYS).json()
    assert listed["attestation"] == "preferred" and sorted(k["attested"] for k in listed["keys"]) == ["failed", "hardware", "none", "software"]


def test_off_checks_nothing_and_keeps_nothing(arx, root):
    arx.setting("security.device_key_attestation", "off")
    assert fresh_login(arx, arx.viewer).status_code == 200
    phone = Phone()
    r = register_attested(arx, phone, lambda c: chain_for(phone, b"\x00" * 32, root=root))  # even a bad chain: not looked at
    assert r.status_code == 200 and r.json()["attested"] == "not_checked" and r.json()["counts"] is True
    stored = key_row(arx, phone.key_id)
    assert stored["attested"] is None and stored["attestation_json"] is None


def test_required_refuses_every_key_that_is_not_hardware(arx, root):
    arx.setting("security.device_key_attestation", "required")
    assert fresh_login(arx, arx.viewer).status_code == 200
    cases = {
        "software": lambda p: (lambda c: chain_for(p, c, root=root, level=0)),
        "none": lambda p: None,
        "failed": lambda p: (lambda c: chain_for(p, c, root=Ca())),  # wrong root
    }
    for verdict, maker in cases.items():
        p = Phone()
        r = register_attested(arx, p, maker(p))
        assert r.status_code == 422 and r.json()["code"] == "device_key_attestation_required", r.text
        assert r.json()["details"]["attested"] == verdict
        refused = details(arx.audit("auth.device_key.refused")[-1])
        assert refused["attested"] == verdict and "BEGIN" not in json.dumps(refused)
    assert arx.client.get(KEYS).json()["keys"] == []
    hw = Phone()
    r = register_attested(arx, hw, lambda c: chain_for(hw, c, root=root, level=2))
    assert r.status_code == 200 and r.json()["attested"] == "hardware" and r.json()["counts"] is True


def test_required_makes_an_existing_key_that_is_not_hardware_stop_counting(arx, root, clock):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register_attested(arx, phone).status_code == 200  # preferred: recorded `none`
    assert arx.client.get(f"{API}/auth/step-up").json()["methods"] == ["device_key"]
    arx.setting("security.device_key_attestation", "required")
    listed = arx.client.get(KEYS).json()
    assert listed["attestation"] == "required" and listed["keys"][0]["attested"] == "none" and listed["keys"][0]["counts"] is False
    assert arx.client.get(f"{API}/auth/step-up").json()["methods"] == []  # no longer a step-up method
    with arx.db.connection() as conn:
        assert dk.has_active(conn, "u-owner") is False
        cid, text, _ = dk.issue(dk.PURPOSE_SIGN_IN, "http://testserver", key_id=phone.key_id)
        with pytest.raises(dk.DeviceKeyError) as e:  # nor a sign-in factor, even with a good signature
            dk.check(conn, "u-owner", cid, phone.sign(text), purpose=dk.PURPOSE_SIGN_IN, origin="http://testserver")
        assert e.value.reason == "attestation_required" and e.value.code == "invalid"
        assert conn.execute("SELECT COUNT(*) FROM auth_totp_failures WHERE user_id = ?", (dk.FAIL_PREFIX + "u-owner",)).fetchone()[0] == 0
    arx.setting("security.device_key_attestation", "preferred")  # back: the key counts again
    assert arx.client.get(f"{API}/auth/step-up").json()["methods"] == ["device_key"]


def test_a_hardware_key_keeps_answering_step_up_under_required(arx, root, clock):
    arx.setting("security.device_key_attestation", "required")
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register_attested(arx, phone, lambda c: chain_for(phone, c, root=root)).status_code == 200
    r = verify(arx, phone, step_up_challenge(arx, phone))
    assert r.status_code == 200 and r.json()["method"] == "device_key"


# ---------------------------------------------------------------- the setting

def test_setting_default_validation_backup_and_fail_closed(arx):
    from smplwise.services import backup
    from smplwise.services.settings_store import DEFAULTS

    assert DEFAULTS["security.device_key_attestation"] == "preferred"
    assert "security.device_key_attestation" in backup.SETTINGS_KEEP  # never exported, never restored
    local = TestClient(arx.app)
    assert local.patch("/api/v1/settings", json={"security.device_key_attestation": "sometimes"}).status_code == 422
    for value in ("required", "off", "preferred"):
        assert local.patch("/api/v1/settings", json={"security.device_key_attestation": value}).status_code == 200
        assert local.get("/api/v1/settings").json()["settings"]["security.device_key_attestation"] == value
    arx.setting("security.device_key_attestation", "hand-edited")
    with arx.db.connection(mode="read") as conn:
        assert dka.mode(conn) == "required"  # an unknown stored value fails closed


def test_changing_the_setting_remotely_needs_a_step_up_proof(arx, clock):
    assert fresh_login(arx, arx.owner).status_code == 200
    phone = Phone()
    assert register_attested(arx, phone).status_code == 200  # the owner's first factor
    r = arx.client.patch(SETTINGS, json={"security.device_key_attestation": "off"})
    assert r.status_code == 403 and r.json()["code"] == "step_up_required"
    prove(arx, phone)
    assert arx.client.patch(SETTINGS, json={"security.device_key_attestation": "off"}).status_code == 200


def test_migration_adds_the_checked_column(arx):
    with arx.db.connection(mode="read") as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(auth_device_keys)").fetchall()}
        assert "attested" in cols
        assert conn.execute("SELECT 1 FROM schema_migrations WHERE version = 223").fetchone() is not None
