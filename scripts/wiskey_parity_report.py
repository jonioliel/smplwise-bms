"""CR-036 S12 (section 6.2, step 2): print the parity matrix of the native access-control screens for four identities, on the FAKE WisKey.

It runs the backend test that builds the matrix (smplwise_vms/backend/tests/test_intercom_parity.py::test_the_three_identity_report_on_the_fake)
against tests/fake_wiskey.py - nothing here contacts a WisKey, Home Assistant, station or device - and prints the Markdown table it wrote:
per identity and screen the outcome (match / filtered / not_permitted ...) and the native / unfiltered counts. Never a name.

On a real installation the same report is GET /api/v1/access-control/parity (Settings > General > "מתגי מסכי כניסה", "השוואה למסכי
האינטרקום"; `as_user` for another Arx user) - that run is the owner's lab session (slice S14), not this script.

Usage (from the repository root):
    python scripts/wiskey_parity_report.py [--out docs/changes/parity-on-fake.md]
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "smplwise_vms" / "backend"
TEST = "tests/test_intercom_parity.py::test_the_three_identity_report_on_the_fake"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", help="also keep the Markdown here")
    args = ap.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(args.out).resolve() if args.out else Path(tmp) / "parity.md"
        env = {**os.environ, "SW_PARITY_REPORT": str(target)}
        run = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", TEST], cwd=BACKEND, env=env)
        if run.returncode != 0 or not target.exists():
            print("the parity matrix test did not pass; no report", file=sys.stderr)
            return run.returncode or 1
        print(target.read_text(encoding="utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
