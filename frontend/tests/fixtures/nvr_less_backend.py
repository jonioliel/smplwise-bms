"""Fixture backend for tests/evidence-nvr-less.spec.ts (NVR-less mode, docs/operations/NVR_LESS_MODE.md): the REAL
SMPLWISE backend with NO NVR at all - no NVR_HOST, no NVR fake - so it starts in the `ha_only` installation mode, exactly
as an add-on installed "for electricity control only" does. Home Assistant is not configured either (no HA_URL /
HA_TOKEN): the spec seeds HA floors, areas and entities through the developer endpoints (`POST /ha/dev/registry`,
`POST /ha/dev/states`), the same writes the HA sync performs. Nothing here can reach a real device. It refuses to start
inside the add-on.

Run it (a fresh data dir each time):

    SW_PORT=8372 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/nvr_less_backend.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_NVRLESS=1 SW_API_PORT=8372 SW_BASE_URL=http://127.0.0.1:4192/ \
        npx playwright test tests/evidence-nvr-less.spec.ts --project=desktop --project=mobile --workers=1
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("nvr_less_backend: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
# a shell that sourced lab settings must not turn this into a full installation
for key in ("NVR_HOST", "NVR_USER", "NVR_PASSWORD", "NVR_HTTP_PORT", "NVR_RTSP_PORT", "GO2RTC_URL", "GO2RTC_API_USER", "GO2RTC_API_PASSWORD", "HA_URL", "HA_TOKEN"):
    os.environ.pop(key, None)
os.environ["SW_OPTIONS_FILE"] = str(Path(os.environ.get("SW_DATA_DIR") or ".") / "no-options.json")


def main() -> None:
    print("nvr_less_backend: starting without an NVR (installation mode ha_only)", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
