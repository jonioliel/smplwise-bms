#!/usr/bin/env python3
"""Stage the signed release APK into the add-on build context (owner decision 2026-10-06).

    python scripts/stage_apk.py <signed.apk> --version 1.4.2 [--application-id com.smplwise.arx.app]
    python scripts/stage_apk.py --clear

Verifies the file, then writes smplwise_vms/downloads/SmplWiseArx.apk and SmplWiseArx.apk.json (version, applicationId,
sha256). The Dockerfile copies that folder into the image at /app/downloads; the add-on serves it at the login screen.
Both files are gitignored - NEVER commit an APK, keystore or signing key.
Checks: valid zip, AndroidManifest.xml carrying the application id, a v1 signature block or a v2+ signing block, size cap
200 MB; when `apksigner` is on PATH it must verify and the certificate must not be the Android debug one.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "smplwise_vms" / "downloads"
APP_ID = "com.smplwise.arx.app"
MAX = 200 * 1024 * 1024
VERSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._+\- ]{0,31}$")


def verify(apk: Path, app_id: str) -> list[str]:
    problems: list[str] = []
    size = apk.stat().st_size
    if not 0 < size <= MAX:
        problems.append(f"size {size} outside 1..{MAX}")
    try:
        with zipfile.ZipFile(apk) as z:
            if z.testzip() is not None:
                problems.append("corrupt zip entry")
            names = z.namelist()
            if "AndroidManifest.xml" not in names:
                problems.append("no AndroidManifest.xml")
            else:
                manifest = z.read("AndroidManifest.xml")
                if app_id.encode("utf-16-le") not in manifest and app_id.encode() not in manifest:
                    problems.append(f"application id {app_id} not found in the manifest")
            v1 = any(n.startswith("META-INF/") and n.rsplit(".", 1)[-1] in ("RSA", "DSA", "EC") for n in names)
            if not v1 and b"APK Sig Block 42" not in apk.read_bytes():
                problems.append("no signature found (unsigned APK)")
    except zipfile.BadZipFile:
        return problems + ["not a zip / APK"]
    signer = shutil.which("apksigner")
    if signer:
        r = subprocess.run([signer, "verify", "--print-certs", str(apk)], capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            problems.append("apksigner verify failed")
        elif "android debug" in r.stdout.lower():
            problems.append("signed with the Android DEBUG certificate")
    else:
        print("note: apksigner not on PATH - the signature is not cryptographically verified here", file=sys.stderr)
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("apk", nargs="?", type=Path)
    ap.add_argument("--version")
    ap.add_argument("--application-id", default=APP_ID)
    ap.add_argument("--clear", action="store_true")
    a = ap.parse_args()
    DEST.mkdir(parents=True, exist_ok=True)
    if a.clear:
        for n in ("SmplWiseArx.apk", "SmplWiseArx.apk.json"):
            (DEST / n).unlink(missing_ok=True)
        print("cleared")
        return 0
    if not a.apk or not a.version or not a.apk.is_file():
        ap.error("an existing APK path and --version are required")
    if not VERSION_RE.fullmatch(a.version):
        ap.error("version: up to 32 characters (letters, digits, . _ + - space)")
    problems = verify(a.apk, a.application_id)
    if problems:
        print("REFUSED: " + "; ".join(problems), file=sys.stderr)
        return 1
    digest = hashlib.sha256(a.apk.read_bytes()).hexdigest()
    shutil.copyfile(a.apk, DEST / "SmplWiseArx.apk")
    if hashlib.sha256((DEST / "SmplWiseArx.apk").read_bytes()).hexdigest() != digest:
        print("REFUSED: copy hash mismatch", file=sys.stderr)
        return 1
    meta = {"version": a.version, "applicationId": a.application_id, "sha256": digest}
    (DEST / "SmplWiseArx.apk.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"staged {DEST / 'SmplWiseArx.apk'} version={a.version} sha256={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
