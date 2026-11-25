"""Fixture backend for the parts of the WisKey specs that need an installation with NO Home Assistant at all (part 1 of
tests/evidence-wiskey-people.spec.ts, STALE-FIXTURE-SPECS-2530): the REAL SmplWise Arx backend with no HA_URL / HA_TOKEN and no
options file, so the access-control area honestly answers "not connected here" (`ha_not_configured`) - no WisKey, no bridge, no
fake answering in its place. No real Home Assistant, NVR, go2rtc or device can be reached: there is no HA address at all, and the
NVR and go2rtc addresses are reserved `.test` names that never resolve. It refuses to start inside the add-on.

Run it (a fresh data dir each time):

    SW_PORT=8381 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <venv-python> frontend/tests/fixtures/no_ha_backend.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_NO_HA=1 SW_API_PORT=8381 SW_BASE_URL=http://127.0.0.1:4191/ \
        npx playwright test tests/evidence-wiskey-people.spec.ts --workers=1

The release gate starts it as the fixture group `no_ha` (frontend/tests/fixtures/fixture_specs.json).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("no_ha_backend: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))

# a developer installation without Home Assistant: nothing from the shell's environment or an options file reaches it
for key in ("HA_URL", "HA_TOKEN", "HA_CORE_URL", "NVR_USER", "NVR_PASSWORD", "GO2RTC_API_USER", "GO2RTC_API_PASSWORD"):
    os.environ.pop(key, None)
os.environ["SW_OPTIONS_FILE"] = str(Path(os.environ.get("SW_DATA_DIR") or ".") / "no-options.json")
os.environ["NVR_HOST"] = "nvr-absent.test"
os.environ["GO2RTC_URL"] = "http://go2rtc-absent.test:1984"


def main() -> None:
    print("no_ha_backend: starting without Home Assistant (no HA_URL / HA_TOKEN)", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
