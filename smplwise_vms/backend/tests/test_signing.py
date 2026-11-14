"""T067: every evidence bundle carries an Ed25519 signature over its manifest; verification tells integrity since
export (and whether the key belongs to this installation) apart from capture authenticity; tampering with a file,
the manifest or the signature is detected; keys rotate without orphaning older bundles; the private key never
leaves /data/keys and never enters a backup; the offline script agrees with the server."""
from __future__ import annotations

import base64
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path

from conftest import as_user, bind, seed_tree
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import backup as backup_svc
from smplwise.services import bundle as bundle_svc
from smplwise.services import signing

ROOT = Path(__file__).resolve().parents[3]


def _bundle(c: TestClient) -> tuple[str, bytes, dict]:
    case = c.post("/api/v1/cases", json={"title": "חתימה", "description": "", "tags": []}).json()
    c.post(f"/api/v1/cases/{case['id']}/items", json={"kind": "note", "note": "ראיה"})
    desc = c.post(f"/api/v1/cases/{case['id']}/bundle").json()
    data = c.get("/" + desc["download_url"]).content
    return case["id"], data, desc


def _rewrite(zip_bytes: bytes, replace: dict[str, bytes | None]) -> bytes:
    src = zipfile.ZipFile(io.BytesIO(zip_bytes))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as dst:
        for name in src.namelist():
            if name in replace:
                if replace[name] is not None:
                    dst.writestr(name, replace[name])
                continue
            dst.writestr(name, src.read(name))
    return buf.getvalue()


def _verify(c: TestClient, data: bytes) -> dict:
    return c.post("/api/v1/cases/bundles/verify", files={"file": ("b.zip", data, "application/zip")}).json()


def test_bundle_is_signed_and_verifies_against_the_installation_key(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    _case_id, data, desc = _bundle(c)
    assert desc["signature"]["alg"] == "Ed25519" and len(desc["signature"]["kid"]) == 16
    names = zipfile.ZipFile(io.BytesIO(data)).namelist()
    assert signing.SIG_NAME in names and "manifest.json" in names
    v = _verify(c, data)
    assert v["ok"] is True and v["signature"]["present"] and v["signature"]["valid"] and v["signature"]["known"] and v["signature"]["retired"] is False and v["signature"]["trust"] == "installation"
    assert "אינה מוכיחה את אמיתות הצילום" in v["authenticity"]
    info = c.get("/api/v1/evidence/signing").json()
    assert info["active"] == desc["signature"]["kid"] and info["keys"][0]["kid"] == info["active"] and info["can_rotate"] is True
    assert "private" not in json.dumps(info).lower() and "BEGIN" not in json.dumps(info)
    key_file = signing.keys_dir(settings) / f"{info['active']}.key"
    assert key_file.exists() and b"PRIVATE KEY" in key_file.read_bytes()
    assert (signing.keys_dir(settings) / "keyring.json").exists()
    # listed bundles say which key signed them
    listed = c.get(f"/api/v1/cases/{_case_id}/bundles").json()["bundles"]
    assert listed[0]["signed"] == info["active"]


def test_tampering_is_detected_in_file_manifest_and_signature(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    _case_id, data, _desc = _bundle(c)
    # a changed file: hash mismatch, the manifest signature itself still valid, bundle not ok
    v = _verify(c, _rewrite(data, {"notes.md": b"# changed\n"}))
    assert v["ok"] is False and any(f["path"] == "notes.md" and f["status"] == "mismatch" for f in v["files"]) and v["signature"]["valid"] is True
    # a changed manifest: the signature no longer matches
    m = json.loads(zipfile.ZipFile(io.BytesIO(data)).read("manifest.json"))
    m["case"]["title"] = "אחר"
    v = _verify(c, _rewrite(data, {"manifest.json": json.dumps(m, ensure_ascii=False, indent=2).encode("utf-8")}))
    assert v["ok"] is False and v["signature"]["present"] and v["signature"]["valid"] is False and v["signature"]["reason"] in ("manifest_changed", "signature_invalid")
    # the signature stripped: reported as unsigned (older bundles are), hashes still checked
    v = _verify(c, _rewrite(data, {signing.SIG_NAME: None}))
    assert v["ok"] is True and v["signature"]["present"] is False and v["signature"]["trust"] == "unsigned"
    # re-signed by a stranger's key: integrity holds, trust does not
    other = ed25519.Ed25519PrivateKey.generate()
    mbytes = zipfile.ZipFile(io.BytesIO(data)).read("manifest.json")
    pub = other.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    foreign = {"schema": "smplwise-evidence-signature/1", "alg": "Ed25519", "kid": signing.kid_of(pub), "public_key": base64.b64encode(pub).decode(), "signature": base64.b64encode(other.sign(mbytes)).decode()}
    v = _verify(c, _rewrite(data, {signing.SIG_NAME: json.dumps(foreign).encode("utf-8")}))
    assert v["signature"]["valid"] is True and v["signature"]["known"] is False and v["signature"]["trust"] == "embedded_key_only" and v["ok"] is True
    # a signature whose key id does not match its key, or with a foreign algorithm, is invalid
    v = _verify(c, _rewrite(data, {signing.SIG_NAME: json.dumps({**foreign, "kid": "0000000000000000"}).encode("utf-8")}))
    assert v["signature"]["valid"] is False and v["signature"]["reason"] == "kid_mismatch" and v["ok"] is False
    v = _verify(c, _rewrite(data, {signing.SIG_NAME: json.dumps({**foreign, "alg": "RSA"}).encode("utf-8")}))
    assert v["signature"]["valid"] is False and v["signature"]["reason"] == "unsupported_alg"


def test_rotation_keeps_older_bundles_verifiable(settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    _case_a, data_a, desc_a = _bundle(c)
    bind(c, settings, "omer", "operator", "installation", "*")
    assert c.post("/api/v1/evidence/signing/rotate", headers=as_user("omer")).status_code == 403
    rotated = c.post("/api/v1/evidence/signing/rotate").json()
    assert rotated["active"] != desc_a["signature"]["kid"] and len(rotated["keys"]) == 2
    old = next(k for k in rotated["keys"] if k["kid"] == desc_a["signature"]["kid"])
    assert old["retired_at"] and rotated["keys"][-1]["retired_at"] is None
    _case_b, data_b, desc_b = _bundle(c)
    assert desc_b["signature"]["kid"] == rotated["active"]
    va, vb = _verify(c, data_a), _verify(c, data_b)
    assert va["ok"] and va["signature"]["known"] and va["signature"]["retired"] is True
    assert vb["ok"] and vb["signature"]["known"] and vb["signature"]["retired"] is False
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'evidence.key.rotate'").fetchone()[0] == 1


def test_private_keys_stay_out_of_backups_and_the_offline_script_agrees(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    _case_id, data, _desc = _bundle(c)
    assert backup_svc._rel(settings, "keys/abc.key") is None and backup_svc._rel(settings, str(signing.keys_dir(settings) / "keyring.json")) is None
    bundle_path = tmp_path / "b.zip"
    bundle_path.write_bytes(data)
    script = ROOT / "scripts" / "verify_bundle.py"
    ring = signing.keys_dir(settings) / "keyring.json"
    ok = subprocess.run([sys.executable, str(script), str(bundle_path), "--keyring", str(ring)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert ok.returncode == 0, (ok.stdout or "") + (ok.stderr or "")
    assert "signature: valid" in ok.stdout and "key belongs to the installation" in ok.stdout and "RESULT: OK" in ok.stdout
    alone = subprocess.run([sys.executable, str(script), str(bundle_path)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert alone.returncode == 0 and "integrity only" in alone.stdout, "without a keyring the script still verifies integrity but does not claim trust"
    bad_path = tmp_path / "bad.zip"
    bad_path.write_bytes(_rewrite(data, {"notes.md": b"# changed\n"}))
    bad = subprocess.run([sys.executable, str(script), str(bad_path), "--keyring", str(ring), "--json"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    assert bad.returncode == 1 and json.loads(bad.stdout)["ok"] is False
    # the service-level verifier and the script agree on the untouched bundle
    assert bundle_svc.verify(data, signing.load_keyring(settings))["ok"] is True
