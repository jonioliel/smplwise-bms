"""SEC-FIX-2520 SEC-2 (docs/review/DEEP-REVIEW-2520-SECURITY.md): both Android key attestation verifiers - the phone key's
(services/device_key_attestation.py) and the app refresh token's device key (services/device_attestation.py) - walked the chain by
issuer name and signature only. A genuine phone's Keystore key certificate is an END-ENTITY certificate; a software key certified by
that key (`[forged leaf, genuine key certificate, intermediate, root]`) passed as `hardware`. The shared rule
(device_attestation.ca_path_problem): every certificate above the leaf is a CA (BasicConstraints cA, keyCertSign when a KeyUsage is
present, the pathLenConstraint kept) and only the leaf carries the KeyDescription.

Generated chains only (`cryptography`); no phone, no network."""
# ruff: noqa: F811 - the `root` fixture is imported by name and used as a test parameter
from __future__ import annotations

import datetime as dt

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from smplwise.services import device_attestation as att
from smplwise.services import device_key_attestation as dka
from test_app_refresh_attestation_232 import INSTALL, Pki, b64, ctx
from test_app_refresh_devicekey_295 import Key
from test_mfa_devicekey_2490 import Phone
from test_mfa_devicekey_attest_2490 import Ca, OID, chain_for, key_description, root, spki  # noqa: F401 - `root` is a fixture

NOW = dt.datetime.now(dt.timezone.utc)
CH = b"\x07" * 32


def _name(cn: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def _build(subject: str, public_key, issuer: str, signer, *, ca: bool | None, path_length: int | None = None,
           key_cert_sign: bool | None = None, extension: bytes | None = None) -> x509.Certificate:
    """`ca` None: no BasicConstraints at all; `key_cert_sign` None: no KeyUsage."""
    b = (x509.CertificateBuilder().subject_name(_name(subject)).issuer_name(_name(issuer)).public_key(public_key)
         .serial_number(x509.random_serial_number()).not_valid_before(NOW - dt.timedelta(days=1)).not_valid_after(NOW + dt.timedelta(days=3650)))
    if ca is not None:
        b = b.add_extension(x509.BasicConstraints(ca=ca, path_length=path_length if ca else None), critical=True)
    if key_cert_sign is not None:
        b = b.add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False, data_encipherment=False,
                                          key_agreement=False, key_cert_sign=key_cert_sign, crl_sign=False, encipher_only=False,
                                          decipher_only=False), critical=True)
    if extension is not None:
        b = b.add_extension(x509.UnrecognizedExtension(OID, extension), critical=False)
    return b.sign(signer, hashes.SHA256())


def _forged(root_name: str, root_key, victim_public_key, *, level: int = 1, k1_ca: bool | None = False, k1_extension: bool = True):
    """The review's scenario: root -> intermediate CA -> K1 (a genuine phone's Keystore key, end-entity, with its own KeyDescription)
    -> a forged leaf certifying the registrant's SOFTWARE key with a TEE KeyDescription and this registration's challenge, signed by K1.
    Returns ([forged, k1, intermediate] certificates, intermediate key)."""
    inter_key = ec.generate_private_key(ec.SECP256R1())
    inter = _build("Intermediate", inter_key.public_key(), root_name, root_key, ca=True)
    k1 = ec.generate_private_key(ec.SECP256R1())
    k1_cert = _build("Android Keystore Key", k1.public_key(), "Intermediate", inter_key, ca=k1_ca,
                     extension=key_description(1, b"\x00" * 32) if k1_extension else None)
    forged = _build("Forged Key", victim_public_key, "Android Keystore Key", k1, ca=False, extension=key_description(level, CH))
    return [forged, k1_cert, inter]


# ---------------------------------------------------------------- the phone key (device_key_attestation)

def test_a_chain_extended_below_a_genuine_key_certificate_is_refused(root):
    phone = Phone()  # the registrant's software key
    chain = _forged(root.name, root.key, phone.key.public_key())
    out = dka.verify_chain([b64(c) for c in chain] + [b64(root.cert)], key_spki=spki(phone), challenge=CH)
    assert (out.attested, out.reason) == ("failed", "chain_not_ca"), out
    out = dka.verify_chain([b64(c) for c in chain], key_spki=spki(phone), challenge=CH)  # without the root itself
    assert (out.attested, out.reason) == ("failed", "chain_not_ca"), out
    # K1 without any BasicConstraints is no CA either
    chain = _forged(root.name, root.key, phone.key.public_key(), k1_ca=None)
    assert dka.verify_chain([b64(c) for c in chain], key_spki=spki(phone), challenge=CH).reason == "chain_not_ca"


def test_a_key_description_above_the_leaf_is_refused_even_on_a_ca(root):
    phone = Phone()
    chain = _forged(root.name, root.key, phone.key.public_key(), k1_ca=True)
    out = dka.verify_chain([b64(c) for c in chain], key_spki=spki(phone), challenge=CH)
    assert (out.attested, out.reason) == ("failed", "key_description_above_leaf"), out


def test_key_usage_without_key_cert_sign_and_a_broken_path_length_are_refused(root):
    phone = Phone()
    # an intermediate whose KeyUsage does not allow certificate signing
    inter_key = ec.generate_private_key(ec.SECP256R1())
    inter = _build("Intermediate", inter_key.public_key(), root.name, root.key, ca=True, key_cert_sign=False)
    leaf = _build("Android Keystore Key", phone.key.public_key(), "Intermediate", inter_key, ca=False, extension=key_description(1, CH))
    assert dka.verify_chain([b64(leaf), b64(inter)], key_spki=spki(phone), challenge=CH).reason == "chain_not_ca"
    # pathLen 0 on the upper intermediate, yet another CA below it
    upper_key, lower_key = ec.generate_private_key(ec.SECP256R1()), ec.generate_private_key(ec.SECP256R1())
    upper = _build("Upper", upper_key.public_key(), root.name, root.key, ca=True, path_length=0, key_cert_sign=True)
    lower = _build("Lower", lower_key.public_key(), "Upper", upper_key, ca=True, key_cert_sign=True)
    leaf = _build("Android Keystore Key", phone.key.public_key(), "Lower", lower_key, ca=False, extension=key_description(1, CH))
    assert dka.verify_chain([b64(leaf), b64(lower), b64(upper)], key_spki=spki(phone), challenge=CH).reason == "chain_path_length"
    # the same shape with pathLen 1 (and keyCertSign) is a proper chain
    upper = _build("Upper", upper_key.public_key(), root.name, root.key, ca=True, path_length=1, key_cert_sign=True)
    lower = _build("Lower", lower_key.public_key(), "Upper", upper_key, ca=True, path_length=0, key_cert_sign=True)
    leaf = _build("Android Keystore Key", phone.key.public_key(), "Lower", lower_key, ca=False, extension=key_description(2, CH))
    out = dka.verify_chain([b64(leaf), b64(lower), b64(upper), b64(root.cert)], key_spki=spki(phone), challenge=CH)
    assert (out.attested, out.level, out.reason) == ("hardware", "strongbox", None), out


def test_a_valid_chain_is_still_accepted(root):
    phone = Phone()
    out = dka.verify_chain(chain_for(phone, CH, root=root, level=1), key_spki=spki(phone), challenge=CH)
    assert (out.attested, out.level, out.reason) == ("hardware", "tee", None)
    out = dka.verify_chain(chain_for(phone, CH, root=root, include_root=False), key_spki=spki(phone), challenge=CH)
    assert out.attested == "hardware"


def test_the_shared_rule_directly():
    ca = Ca()
    leaf_key = ec.generate_private_key(ec.SECP256R1())
    leaf = _build("leaf", leaf_key.public_key(), ca.name, ca.key, ca=False, extension=key_description(1, CH))
    assert att.ca_path_problem([leaf, ca.cert]) is None
    assert att.ca_path_problem([leaf]) is None  # nothing above the leaf to judge
    assert att.ca_path_problem([leaf, leaf]) == "chain_not_ca"


# ---------------------------------------------------------------- the app refresh token's device key (device_attestation)

def test_app_refresh_verifier_refuses_the_same_forged_chain_and_keeps_a_good_one():
    pki, key = Pki(), Key()
    v = att.AndroidKeyAttestationVerifier()
    challenge = att.challenge_for("dev-1", INSTALL)
    inter_key = pki.mid_k
    k1 = ec.generate_private_key(ec.SECP256R1())
    k1_cert = _build("Android Keystore Key", k1.public_key(), "mid", inter_key, ca=False, extension=key_description(1, b"\x00" * 32))
    forged = _build("Forged Key", key.k.public_key(), "Android Keystore Key", k1, ca=False, extension=key_description(1, challenge))
    out = v.verify([b64(forged), b64(k1_cert), b64(pki.mid)], ctx(pki, key, "dev-1"))
    assert (out.status, out.reason) == (att.FAILED, "chain_not_ca"), out
    out = v.verify([b64(forged), b64(k1_cert), b64(pki.mid), b64(pki.root)], ctx(pki, key, "dev-1"))  # the root itself in the chain
    assert (out.status, out.reason) == (att.FAILED, "chain_not_ca"), out
    assert v.verify(pki.chain(key, challenge, 1), ctx(pki, key, "dev-1")) == att.Verdict(att.VERIFIED, "tee", None)
    assert v.verify(pki.chain(key, challenge, 2) + [b64(pki.root)], ctx(pki, key, "dev-1")).status == att.VERIFIED
