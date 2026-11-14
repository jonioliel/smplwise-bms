"""ATTEST232-295 (docs/changes/CR-ATTEST232.md): hardware attestation of the app refresh token's device key. Covers the three modes
(off default / log_only / required), the verdict store, refusals that end nothing, the switch to `required` ending unattested sign-ins,
the settings (validation, local-channel rule), the real Android structural verifier against locally generated certificate chains, the
injected fakes, the status route, the backup classification and the migration. Fakes only: no Google, no Apple, no phone, no network."""
from __future__ import annotations

import base64
import datetime as dt

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
from test_app_refresh_295 import API, ARX, INSTALL, audit_rows, on, register, rx, switch  # noqa: F401
from test_app_refresh_devicekey_295 import Key, key_body, mint

from smplwise.db import set_setting
from smplwise.services import app_refresh as svc
from smplwise.services import backup
from smplwise.services import device_attestation as att

MODE, LEVEL, ROOTS = svc.ATTEST_MODE_KEY, svc.ATTEST_LEVEL_KEY, svc.ATTEST_ROOTS_KEY
CHAIN = ["AAAA"]  # opaque to the fakes


class Fake:
    def __init__(self, status=att.VERIFIED, level="tee", reason=None, boom=False):
        self.verdict, self.boom, self.calls = att.Verdict(status, level, reason), boom, []

    def verify(self, data, ctx):
        self.calls.append(ctx)
        if self.boom:
            raise RuntimeError("secret chain material AAAA")
        return self.verdict


def attested(rx, device_id, key, fmt=att.FORMAT_ANDROID, install_id=INSTALL, user="dana"):
    body = key_body(rx, device_id, key)
    if fmt:
        body["attestation"] = {"format": fmt, "data": CHAIN}
    return mint(rx, device_id, key, user=user, install_id=install_id, body=body)


def dev(rx):
    on(rx)
    return register(rx)["device_id"]


def verdict_row(rx, device_id):
    with rx.db.connection(mode="read") as conn:
        r = conn.execute("SELECT * FROM app_refresh_attestations WHERE device_id = ?", (device_id,)).fetchone()
    return dict(r) if r else None


def live_families(rx):
    with rx.db.connection(mode="read") as conn:
        return conn.execute("SELECT COUNT(*) FROM app_refresh_families WHERE revoked_at IS NULL").fetchone()[0]


# ---------------------------------------------------------------- defaults and modes

def test_defaults_are_off_and_editable(rx):
    s = rx.c.get(f"{API}/auth/app/settings").json()["settings"]
    assert s[MODE] == "off" and s[LEVEL] == "tee" and s[ROOTS] == ""
    out = switch(rx, **{MODE: "log_only", LEVEL: "strongbox"})["settings"]
    assert out[MODE] == "log_only" and out[LEVEL] == "strongbox"
    for key, bad in ((MODE, "on"), (MODE, None), (LEVEL, "gold"), (ROOTS, "not a pem"), (ROOTS, 5)):
        assert rx.c.put(f"{API}/auth/app/settings", json={key: bad}).status_code == 422, (key, bad)


def test_off_asks_and_records_nothing(rx):
    d = dev(rx)
    fake = Fake()
    with att.override_verifiers({att.FORMAT_ANDROID: fake}):
        r = attested(rx, d, Key())
    assert r.status_code == 201 and "attestation" not in r.json() and not fake.calls and verdict_row(rx, d) is None


def test_log_only_records_every_outcome_and_never_refuses(rx):
    d = dev(rx)
    switch(rx, **{MODE: "log_only"})
    key = Key()
    cases = [(None, att.MISSING, "not_sent"), (Fake(att.FAILED, None, "chain_signature"), att.FAILED, "chain_signature"),
             (Fake(att.UNAVAILABLE, None, "no_trust_roots"), att.UNAVAILABLE, "no_trust_roots"), (Fake(), att.VERIFIED, None),
             (Fake(boom=True), att.FAILED, "verifier_error")]
    for fake, status, reason in cases:
        with att.override_verifiers({att.FORMAT_ANDROID: fake} if fake else {}):
            r = attested(rx, d, key, fmt=att.FORMAT_ANDROID if fake else None)
        assert r.status_code == 201, r.text
        assert r.json()["attestation"]["status"] == status and r.json()["attestation"]["enforced"] is False
        row = verdict_row(rx, d)
        assert row["status"] == status and row["reason"] == reason and row["mode"] == "log_only"
    rows = audit_rows(rx, "auth.app_refresh.attestation")
    assert len(rows) == len(cases) and all(a["decision"] == "allowed" for a in rows)
    assert "AAAA" not in str(rows)  # the chain and the verifier's error text never reach the audit log


def test_the_verifier_gets_the_registered_key_and_the_binding_challenge(rx):
    d = dev(rx)
    switch(rx, **{MODE: "log_only"})
    key, fake = Key(), Fake()
    with att.override_verifiers({att.FORMAT_ANDROID: fake}):
        assert attested(rx, d, key).status_code == 201
    ctx = fake.calls[0]
    assert ctx.key_spki == key.spki and ctx.challenge == att.challenge_for(d, INSTALL) and ctx.device_id == d
    assert att.challenge_for(d, INSTALL) != att.challenge_for(d, INSTALL + "x") != att.challenge_for(d + "x", INSTALL)


def test_required_refuses_what_is_not_a_verified_attestation_and_ends_nothing(rx):
    d = dev(rx)
    assert attested(rx, d, k0 := Key(), fmt=None).status_code == 201  # a live sign-in from before
    switch(rx, **{MODE: "required"})  # ends it (not attested), then we check refusals leave later ones alone
    assert live_families(rx) == 0
    cases = [(None, None, 422, "attestation_required"),
             (Fake(att.FAILED, None, "untrusted_root"), att.FORMAT_ANDROID, 422, "attestation_invalid"),
             (Fake(att.UNAVAILABLE, None, "no_trust_roots"), att.FORMAT_ANDROID, 422, "attestation_unavailable"),
             (Fake(level="software"), att.FORMAT_ANDROID, 422, "attestation_level_too_low"),
             (Fake(boom=True), att.FORMAT_ANDROID, 422, "attestation_invalid")]
    for fake, fmt, status, code in cases:
        with att.override_verifiers({att.FORMAT_ANDROID: fake} if fake else {}):
            r = attested(rx, d, k0, fmt=fmt)
        assert r.status_code == status and r.json()["code"] == code, (code, r.text)
        assert live_families(rx) == 0
    assert verdict_row(rx, d)["status"] == att.FAILED  # the last refusal's verdict is on record
    assert any(a["decision"] == "denied" for a in audit_rows(rx, "auth.app_refresh.attestation"))
    assert k0 is not None


def test_required_accepts_a_verified_attestation_at_or_above_the_minimum(rx):
    d = dev(rx)
    switch(rx, **{MODE: "required"})
    with att.override_verifiers({att.FORMAT_ANDROID: Fake(level="strongbox")}):
        r = attested(rx, d, key := Key())
    assert r.status_code == 201 and r.json()["attestation"] == {"mode": "required", "status": "verified", "level": "strongbox", "enforced": True}
    row = verdict_row(rx, d)
    assert row["status"] == att.VERIFIED and row["level"] == "strongbox" and row["key_fp"] == key.fp
    switch(rx, **{LEVEL: "strongbox"})
    with att.override_verifiers({att.FORMAT_ANDROID: Fake(level="tee")}):
        assert attested(rx, d, key).json()["code"] == "attestation_level_too_low"
    assert live_families(rx) == 1  # the verified sign-in survived the refused re-mint


def test_required_without_a_device_key_is_refused(rx):
    d = dev(rx)
    switch(rx, **{MODE: "required", svc.DEVICE_KEY_KEY: "off"})
    r = rx.user("dana").post(f"{ARX}/auth/app/refresh-tokens", json={"device_id": d, "install_id": INSTALL})
    assert r.status_code == 422 and r.json()["code"] == "attestation_required"
    assert verdict_row(rx, d)["reason"] == "no_device_key"


def test_switching_to_required_ends_unattested_sign_ins_and_keeps_verified_ones(rx):
    d = dev(rx)
    switch(rx, **{MODE: "log_only"})
    with att.override_verifiers({att.FORMAT_ANDROID: Fake()}):
        assert attested(rx, d, Key()).status_code == 201
    d2 = register(rx, "dana", install_id="99999999-aaaa-bbbb-cccc-dddddddddddd", name="נייד שני")["device_id"]
    assert attested(rx, d2, Key(), fmt=None, install_id="99999999-aaaa-bbbb-cccc-dddddddddddd").status_code == 201
    assert live_families(rx) == 2
    out = switch(rx, **{MODE: "required"})
    assert out["families_ended"] == 1 and live_families(rx) == 1
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT revoked_reason FROM app_refresh_families WHERE device_id = ?", (d2,)).fetchone()[0] == "attestation_required"


def test_unsupported_format_and_unknown_stored_mode(rx):
    d = dev(rx)
    switch(rx, **{MODE: "log_only"})
    key = Key()
    with att.override_verifiers({att.FORMAT_ANDROID: Fake()}):  # iOS has no verifier in this set
        r = attested(rx, d, key, fmt=att.FORMAT_IOS)
    assert r.json()["attestation"]["status"] == att.FAILED and verdict_row(rx, d)["reason"] == "unsupported_format"
    r = attested(rx, d, key, fmt=att.FORMAT_IOS)  # the shipped iOS placeholder: unavailable, never verified
    assert r.json()["attestation"]["status"] == att.UNAVAILABLE and verdict_row(rx, d)["reason"] == "verifier_not_installed"
    with rx.db.connection() as conn:
        conn.execute("UPDATE settings SET value = 'maybe' WHERE key = ?", (MODE,))
        assert svc.attest_mode(conn) == "required"
        set_setting(conn, LEVEL, "maybe")
        assert svc.attest_min_level(conn) == "strongbox"


def test_malformed_payload_is_a_failed_verdict(rx):
    d = dev(rx)
    switch(rx, **{MODE: "log_only"})
    key = Key()
    body = key_body(rx, d, key)
    body["attestation"] = {"format": att.FORMAT_ANDROID, "data": ["not base64 !!"]}
    with att.override_verifiers({att.FORMAT_ANDROID: Fake()}):
        r = mint(rx, d, key, body=body)
    assert r.status_code == 201 and verdict_row(rx, d)["reason"] == "malformed"
    body = key_body(rx, d, key)
    body["attestation"] = {"format": "tpm", "data": CHAIN}
    assert mint(rx, d, key, body=body).status_code == 422  # unknown format: the request model refuses it


# ---------------------------------------------------------------- settings rules

def test_weakening_attestation_is_local_channel_only(rx):
    joni = rx.user("joni")
    switch(rx, **{MODE: "required", LEVEL: "strongbox"})
    assert joni.put(f"{ARX}/auth/app/settings", json={ROOTS: ""}).status_code in (200, 403)
    r = joni.put(f"{ARX}/auth/app/settings", json={MODE: "off"})
    assert r.status_code == 403 and r.json()["code"] == "local_channel_only"
    assert joni.put(f"{ARX}/auth/app/settings", json={LEVEL: "tee"}).status_code == 403
    assert rx.c.get(f"{API}/auth/app/settings").json()["settings"][MODE] == "required"
    switch(rx, **{MODE: "off"})
    assert joni.put(f"{ARX}/auth/app/settings", json={MODE: "required"}).status_code == 200  # raising works anywhere


def test_status_route_shows_the_verdict_without_the_chain(rx):
    d = dev(rx)
    assert rx.user("dana").get(f"{ARX}/auth/app/devices/{d}/attestation").json() == {"device_id": d, "checked": False}
    switch(rx, **{MODE: "log_only"})
    with att.override_verifiers({att.FORMAT_ANDROID: Fake(level="strongbox")}):
        attested(rx, d, key := Key())
    out = rx.user("dana").get(f"{ARX}/auth/app/devices/{d}/attestation").json()
    assert out["status"] == "verified" and out["level"] == "strongbox" and out["key_fp"] == key.fp[:16] and "AAAA" not in str(out)
    assert rx.user("dana").get(f"{ARX}/auth/app/devices/nope-device/attestation").status_code == 404


def test_backup_classification_and_migration(rx):
    assert "app_refresh_attestations" in backup.NEVER_EXPORTED_TABLES
    for k in (MODE, LEVEL, ROOTS):
        assert k in backup.SETTINGS_KEEP and k in svc.SETTING_KEYS
    with rx.db.connection(mode="read") as conn:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(app_refresh_attestations)").fetchall()]
    assert {"device_id", "status", "level", "format", "key_fp", "mode", "reason", "checked_at"} <= set(cols)


# ---------------------------------------------------------------- the real Android structural verifier

def _der(tag: int, body: bytes) -> bytes:
    n = len(body)
    head = bytes([tag, n]) if n < 128 else bytes([tag, 0x81, n]) if n < 256 else bytes([tag, 0x82, n >> 8, n & 255])
    return head + body


def key_description(level: int, challenge: bytes) -> bytes:
    return _der(0x30, _der(0x02, b"\x04") + _der(0x0A, bytes([level])) + _der(0x02, b"\x04") + _der(0x0A, bytes([level]))
                + _der(0x04, challenge) + _der(0x04, b"") + _der(0x30, b"") + _der(0x30, b""))


def _name(cn: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def _cert(subject, issuer, pub, signer, *, ext=None, days=(-1, 3650)):
    now = dt.datetime.now(dt.timezone.utc)
    b = (x509.CertificateBuilder().subject_name(_name(subject)).issuer_name(_name(issuer)).public_key(pub).serial_number(x509.random_serial_number())
         .not_valid_before(now + dt.timedelta(days=days[0])).not_valid_after(now + dt.timedelta(days=days[1])))
    if ext is not None:
        b = b.add_extension(x509.UnrecognizedExtension(x509.ObjectIdentifier("1.3.6.1.4.1.11129.2.1.17"), ext), critical=False)
    return b.sign(signer, hashes.SHA256())


def pem(c):
    return c.public_bytes(serialization.Encoding.PEM).decode()


def b64(c):
    return base64.b64encode(c.public_bytes(serialization.Encoding.DER)).decode()


class Pki:
    def __init__(self):
        self.root_k, self.mid_k = ec.generate_private_key(ec.SECP256R1()), ec.generate_private_key(ec.SECP256R1())
        self.root = _cert("root", "root", self.root_k.public_key(), self.root_k)
        self.mid = _cert("mid", "root", self.mid_k.public_key(), self.root_k)

    def chain(self, key: Key, challenge: bytes, level: int = 2, leaf_days=(-1, 3650)):
        leaf = _cert("leaf", "mid", key.k.public_key(), self.mid_k, ext=key_description(level, challenge), days=leaf_days)
        return [b64(leaf), b64(self.mid)]


def ctx(pki, key, d, roots=None, now=None):
    return att.Context(device_id=d, install_id=INSTALL, key_spki=key.spki, challenge=att.challenge_for(d, INSTALL),
                       trust_roots_pem=pem(pki.root) if roots is None else roots, now=now or dt.datetime.now(dt.timezone.utc))


def test_android_verifier_accepts_a_good_chain_and_reports_the_level():
    pki, key = Pki(), Key()
    v = att.AndroidKeyAttestationVerifier()
    for code, level in ((0, "software"), (1, "tee"), (2, "strongbox")):
        out = v.verify(pki.chain(key, att.challenge_for("dev-1", INSTALL), code), ctx(pki, key, "dev-1"))
        assert out == att.Verdict(att.VERIFIED, level, None)
    # the chain may already include the root itself
    assert v.verify(pki.chain(key, att.challenge_for("dev-1", INSTALL)) + [b64(pki.root)], ctx(pki, key, "dev-1")).status == att.VERIFIED


def test_android_verifier_rejects_every_way_a_chain_can_be_wrong():
    pki, key, other = Pki(), Key(), Pki()
    v = att.AndroidKeyAttestationVerifier()
    good = pki.chain(key, att.challenge_for("dev-1", INSTALL))
    assert v.verify(good, ctx(pki, key, "dev-1", roots="")) == att.Verdict(att.UNAVAILABLE, None, "no_trust_roots")
    assert v.verify(good, ctx(pki, key, "dev-1", roots="garbage")).reason == "trust_roots_unreadable"
    assert v.verify(good, ctx(other, key, "dev-1", roots=pem(other.root))).reason == "untrusted_root"
    assert v.verify(pki.chain(key, att.challenge_for("dev-2", INSTALL)), ctx(pki, key, "dev-1")).reason == "challenge_mismatch"
    assert v.verify(good, ctx(pki, Key(), "dev-1")).reason == "key_mismatch"
    assert v.verify([good[0], b64(other.mid)], ctx(pki, key, "dev-1")).reason == "chain_signature"
    assert v.verify(pki.chain(key, att.challenge_for("dev-1", INSTALL), leaf_days=(-10, -2)), ctx(pki, key, "dev-1")).reason == "certificate_not_valid_now"
    assert v.verify(["AAAA"], ctx(pki, key, "dev-1")).reason == "chain_unreadable"
    leaf_no_ext = _cert("leaf", "mid", key.k.public_key(), pki.mid_k)
    assert v.verify([b64(leaf_no_ext), b64(pki.mid)], ctx(pki, key, "dev-1")).reason == "no_key_description"
    assert v.verify(pki.chain(key, att.challenge_for("dev-1", INSTALL), 7), ctx(pki, key, "dev-1")).reason == "unknown_security_level"


def test_end_to_end_with_the_real_android_verifier_and_settings_roots(rx):
    d = dev(rx)
    pki, key = Pki(), Key()
    switch(rx, **{MODE: "required", ROOTS: pem(pki.root)})
    body = key_body(rx, d, key)
    body["attestation"] = {"format": att.FORMAT_ANDROID, "data": pki.chain(key, att.challenge_for(d, INSTALL), 1)}
    r = mint(rx, d, key, body=body)
    assert r.status_code == 201 and r.json()["attestation"]["level"] == "tee", r.text
    assert verdict_row(rx, d)["format"] == att.FORMAT_ANDROID
    switch(rx, **{ROOTS: ""})  # roots removed (local channel): the same chain is now unverifiable -> refused in required mode
    body2 = key_body(rx, d, key)
    body2["attestation"] = body["attestation"]
    r = mint(rx, d, key, body=body2)
    assert r.status_code == 422 and r.json()["code"] == "attestation_unavailable"
