#!/usr/bin/env python3
"""MFA-DEVICEKEY-ATTEST-2490: rebuild the pinned Google attestation data of the phone key's OFFLINE attestation check
(smplwise_vms/backend/smplwise/assets/attestation/*.json, read by services/device_key_attestation.py). The product never fetches anything;
this maintainer tool does not either - it reads two files a maintainer saved by hand from Google's published endpoints:

    <dir>/root.json    = https://android.googleapis.com/attestation/root    (JSON array of PEM roots)
    <dir>/status.json  = https://android.googleapis.com/attestation/status  (the attestation status / revocation list)

    py -3.12 scripts/refresh_android_attestation_pins.py <dir> smplwise_vms/backend/smplwise/assets/attestation <YYYY-MM-DD fetched>

Every root must be self-signed (a damaged copy fails). Review the diff (new / removed roots especially) before committing; a root change is
a security change (docs/changes/MFA-DEVICEKEY-ATTEST-2490.md section 5)."""
import hashlib
import json
import sys
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import serialization

src_dir = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
fetched = sys.argv[3]

raw_roots = (src_dir / "root.json").read_bytes()
roots = json.loads(raw_roots)
out_roots = []
for pem in roots:
    cert = x509.load_pem_x509_certificate(pem.encode("ascii"))
    cert.verify_directly_issued_by(cert)  # every published root is self-signed: a damaged copy fails here
    der = cert.public_bytes(serialization.Encoding.DER)
    spki = cert.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    out_roots.append({
        "subject": cert.subject.rfc4514_string(),
        "key": type(cert.public_key()).__name__.replace("_", ""),
        "not_before": cert.not_valid_before_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "not_after": cert.not_valid_after_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cert_sha256": hashlib.sha256(der).hexdigest(),
        "spki_sha256": hashlib.sha256(spki).hexdigest(),
        "pem": pem.strip() + "\n",
    })
    print("root", out_roots[-1]["subject"], out_roots[-1]["not_after"], out_roots[-1]["spki_sha256"][:16])

(out_dir / "google_roots.json").write_text(json.dumps({
    "what": "Google hardware attestation root certificates (Android Key Attestation), pinned for an OFFLINE chain check "
            "(services/device_key_attestation.py, MFA-DEVICEKEY-ATTEST-2490). Public certificates, no secret.",
    "source": "https://android.googleapis.com/attestation/root (linked from "
              "https://developer.android.com/privacy-and-security/security-key-attestation#root_certificate)",
    "fetched": fetched,
    "source_sha256": hashlib.sha256(raw_roots).hexdigest(),
    "anchor": "a chain is trusted when its top certificate has the public key of a root here, or is signed by one; older "
              "certificates of the same RSA root key (2016, 2019 issues) are therefore covered by the key",
    "roots": out_roots,
}, indent=2) + "\n", encoding="utf-8", newline="\n")

raw_status = (src_dir / "status.json").read_bytes()
status = json.loads(raw_status)
entries = {}
for serial, e in status["entries"].items():
    s = serial.strip().lower().lstrip("0") or "0"
    entries[s] = {"status": e.get("status", ""), "reason": e.get("reason", "")}
reasons = {}
for e in entries.values():
    reasons[e["status"] + "/" + e["reason"]] = reasons.get(e["status"] + "/" + e["reason"], 0) + 1
print("status entries", len(entries), reasons)
compact = {k: (v["status"] + ":" + v["reason"]).rstrip(":") for k, v in sorted(entries.items())}
(out_dir / "google_attestation_status.json").write_text(json.dumps({
    "what": "SNAPSHOT of Google's attestation certificate status list (revoked / suspended attestation keys), shipped as data so the "
            "check stays offline. It is only as fresh as `fetched`: a key revoked later is not known here (documented limit).",
    "source": "https://android.googleapis.com/attestation/status",
    "fetched": fetched,
    "source_sha256": hashlib.sha256(raw_status).hexdigest(),
    "key": "certificate serial number, lowercase hex without leading zeros",
    "entries": compact,
}, separators=(",", ":"), sort_keys=False) + "\n", encoding="utf-8", newline="\n")
