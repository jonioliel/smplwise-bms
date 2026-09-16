#!/usr/bin/env python3
"""Offline verification of a SMPLWISE evidence bundle (T067) — no add-on, no network.

    python scripts/verify_bundle.py case-xxxxxxxx-20260916T120000Z.zip [--keyring keyring.json] [--public-key BASE64]

Recomputes the SHA-256 of every file listed in manifest.json, checks MANIFEST.sha256, and verifies the Ed25519
signature in manifest.sig.json with the public key embedded in it. With --keyring (the installation's
/data/keys/keyring.json, public halves only) or --public-key (the key id / key shown under הגדרות → אחסון →
חתימת ראיות) it also tells you whether that key belongs to the installation you trust.

What a passing check means: the bundle has not changed since it was exported by the holder of that key. What it
does not mean: that the footage is authentic at capture, or that anything is legally admissible. Exit code 0 when
every hash matches and the signature is valid (or absent — older bundles were unsigned), 1 otherwise.
Needs only the Python standard library plus the `cryptography` package."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
import zipfile
from pathlib import Path

SIG_NAME = "manifest.sig.json"


def _kid(public_raw: bytes) -> str:
    return hashlib.sha256(public_raw).hexdigest()[:16]


def verify_file(path: Path, keyring: dict | None = None, trusted_public_key: str | None = None) -> dict:
    out: dict = {"file": str(path), "files": [], "manifest_ok": None, "signature": {"present": False, "valid": False, "trust": "unsigned", "reason": None, "kid": None}, "ok": False, "errors": []}
    try:
        z = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as exc:
        out["errors"].append(f"not a readable zip: {exc}")
        return out
    with z:
        names = set(z.namelist())
        if "manifest.json" not in names:
            out["errors"].append("manifest.json missing")
            return out
        mbytes = z.read("manifest.json")
        try:
            manifest = json.loads(mbytes.decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            out["errors"].append(f"manifest.json unreadable: {exc}")
            return out
        out["schema"] = manifest.get("schema")
        out["case"] = (manifest.get("case") or {}).get("title")
        out["generated_at"] = manifest.get("generated_at")
        if "MANIFEST.sha256" in names:
            recorded = z.read("MANIFEST.sha256").decode("utf-8", "replace").split()[0]
            out["manifest_ok"] = recorded == hashlib.sha256(mbytes).hexdigest()
        listed = set()
        for f in manifest.get("files", []):
            listed.add(f["path"])
            if f["path"] not in names:
                out["files"].append({"path": f["path"], "status": "missing"})
                continue
            try:
                actual = hashlib.sha256(z.read(f["path"])).hexdigest()
            except Exception:  # noqa: BLE001
                out["files"].append({"path": f["path"], "status": "corrupt"})
                continue
            out["files"].append({"path": f["path"], "status": "ok" if actual == f["sha256"] else "mismatch"})
        out["extra"] = sorted(n for n in names if n not in listed and n not in ("manifest.json", "MANIFEST.sha256", SIG_NAME) and not n.endswith("/"))
        if SIG_NAME in names:
            sig = out["signature"]
            sig["present"] = True
            try:
                s = json.loads(z.read(SIG_NAME).decode("utf-8"))
                sig["kid"] = s.get("kid")
                sig["alg"] = s.get("alg")
                if s.get("alg") != "Ed25519":
                    sig["reason"] = "unsupported_alg"
                else:
                    from cryptography.exceptions import InvalidSignature
                    from cryptography.hazmat.primitives.asymmetric import ed25519

                    pub_raw = base64.b64decode(s["public_key"], validate=True)
                    if _kid(pub_raw) != s.get("kid"):
                        sig["reason"] = "kid_mismatch"
                    elif s.get("manifest_sha256") and s["manifest_sha256"] != hashlib.sha256(mbytes).hexdigest():
                        sig["reason"] = "manifest_changed"
                    else:
                        try:
                            ed25519.Ed25519PublicKey.from_public_bytes(pub_raw).verify(base64.b64decode(s["signature"], validate=True), mbytes)
                            sig["valid"] = True
                        except InvalidSignature:
                            sig["reason"] = "signature_invalid"
                if sig["valid"]:
                    known = None
                    for k in (keyring or {}).get("keys", []):
                        if k.get("kid") == s.get("kid") and k.get("public_key") == s.get("public_key"):
                            known = k
                    if trusted_public_key and trusted_public_key.strip() in (s.get("public_key"), s.get("kid")):
                        known = known or {"kid": s.get("kid"), "retired_at": None}
                    sig["known"] = known is not None
                    sig["retired"] = bool(known.get("retired_at")) if known else None
                    sig["trust"] = "installation" if known else "embedded_key_only"
            except ImportError:
                sig["reason"] = "the cryptography package is not installed (pip install cryptography)"
            except Exception as exc:  # noqa: BLE001
                sig["reason"] = f"signature unreadable: {type(exc).__name__}"
    sig_ok = not out["signature"]["present"] or out["signature"]["valid"]
    out["ok"] = out["manifest_ok"] is not False and all(f["status"] == "ok" for f in out["files"]) and not out["extra"] and sig_ok
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Verify a SMPLWISE evidence bundle offline.")
    ap.add_argument("bundle", type=Path)
    ap.add_argument("--keyring", type=Path, help="the installation's keyring.json (public halves)")
    ap.add_argument("--public-key", help="a public key (base64) or key id you trust")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):  # Hebrew titles on any console or pipe, on any platform
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    ring = json.loads(args.keyring.read_text(encoding="utf-8")) if args.keyring else None
    res = verify_file(args.bundle, ring, args.public_key)
    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print(f"bundle: {res['file']}")
        if res.get("case"):
            print(f"case: {res['case']} · generated {res.get('generated_at')}")
        for f in res["files"]:
            print(f"  {f['status']:8s} {f['path']}")
        for e in res.get("extra", []):
            print(f"  extra    {e} (not in the manifest)")
        print(f"manifest hash: {'ok' if res['manifest_ok'] else 'MISMATCH' if res['manifest_ok'] is False else 'not recorded'}")
        s = res["signature"]
        if not s["present"]:
            print("signature: none (bundle made before 0.1.40, or removed)")
        elif s["valid"]:
            trust = {"installation": "key belongs to the installation" + (" (retired key)" if s.get("retired") else ""), "embedded_key_only": "integrity only — the key is not one you told me to trust"}[s["trust"]]
            print(f"signature: valid · Ed25519 key {s['kid']} · {trust}")
        else:
            print(f"signature: INVALID ({s['reason']})")
        for e in res["errors"]:
            print(f"error: {e}")
        print("meaning: a passing check proves the bundle did not change since export by that key; it does not prove the footage is authentic at capture.")
        print("RESULT:", "OK" if res["ok"] else "FAILED")
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
