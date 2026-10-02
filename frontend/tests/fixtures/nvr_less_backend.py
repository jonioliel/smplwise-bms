"""Fixture backend for tests/evidence-nvr-less.spec.ts (NVR-less mode, docs/operations/NVR_LESS_MODE.md): the REAL
SMPLWISE backend with NO NVR at all - no NVR_HOST, no NVR fake, and SW_MODE=ha_only (without it a backend outside the
add-on keeps the full mode with a placeholder host, config.py) - so it starts in the `ha_only` installation mode, exactly
as an add-on installed "for electricity control only" does.

Home Assistant is the product in that mode, so it is connected: this reuses tests/fixtures/devices_fake_ha.py (the fake
HA WebSocket, REST and bridge of the device-control specs; no real HA is reachable - its host is a reserved `.test`
name). The spec seeds HA floors, areas and entities through the developer endpoints (`POST /ha/dev/registry`,
`POST /ha/dev/states`). Nothing here can reach a real device. It refuses to start inside the add-on.

Run it (a fresh data dir each time):

    SW_PORT=8372 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <venv-python> frontend/tests/fixtures/nvr_less_backend.py

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

HERE = Path(__file__).resolve().parent
# a shell that sourced lab settings must not turn this into a full installation or reach a real device
for key in ("NVR_HOST", "NVR_USER", "NVR_PASSWORD", "NVR_HTTP_PORT", "NVR_RTSP_PORT", "GO2RTC_URL", "GO2RTC_API_USER", "GO2RTC_API_PASSWORD", "HA_URL", "HA_TOKEN"):
    os.environ.pop(key, None)
os.environ["SW_OPTIONS_FILE"] = str(Path(os.environ.get("SW_DATA_DIR") or ".") / "no-options.json")
os.environ["SW_MODE"] = "ha_only"  # the NVR-less mode, as an add-on without nvr_host

sys.path.insert(0, str(HERE))
import devices_fake_ha  # noqa: E402  (installs the fake Home Assistant on import)


def main() -> None:
    print("nvr_less_backend: starting without an NVR (installation mode ha_only), fake Home Assistant connected", flush=True)
    devices_fake_ha.main()


if __name__ == "__main__":
    main()
