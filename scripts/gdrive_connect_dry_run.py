"""GDRIVE-READY-2351: rehearse the first Google Drive connection end to end against the FAKE Google - no network, no Google account.

Runs tests/test_gdrive_connect_ready.py::test_first_connection_dry_run_end_to_end in one process and prints the transcript: what the
"בדיקת חיבור Google" check says at every step of docs/operations/GDRIVE_CONNECT_SETUP_HE.md (a Web-application client by mistake, the
right client, connect, the Drive API not enabled, all green, connection test, first upload, restore drill, the seven-day Testing expiry,
reconnect). Exit code 0 = the whole flow passed.

    python scripts/gdrive_connect_dry_run.py            (any Python 3.12 with the backend's requirements, e.g. the repo's .venv)
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "smplwise_vms" / "backend"
TEST = "tests/test_gdrive_connect_ready.py::test_first_connection_dry_run_end_to_end"


def main() -> int:
    env = {**os.environ, "GDRIVE_DRY_RUN_PRINT": "1", "PYTHONIOENCODING": "utf-8"}
    cmd = [sys.executable, "-m", "pytest", "-q", "-s", "-p", "no:cacheprovider", TEST]
    return subprocess.call(cmd, cwd=str(BACKEND), env=env)


if __name__ == "__main__":
    raise SystemExit(main())
