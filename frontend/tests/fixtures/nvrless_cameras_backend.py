"""Fixture backend for tests/evidence-nvrless-cameras-2412.spec.ts (EVIDENCE-CAMERAS-2412): the REAL SMPLWISE backend with NO NVR
(SW_MODE=ha_only, no NVR_* values, no NVR fake), the fake Home Assistant of tests/fixtures/devices_fake_ha.py, and - only when
SW_WEBRTC=1 - the in-process fake go2rtc of that module (a stream table, no media). With SW_WEBRTC=0 the go2rtc address is removed
before the backend reads its settings, so the installation has no WebRTC (video) server at all.

The spec adds two cameras without a recorder through the real `POST /cameras/standalone` (placeholder addresses under the reserved
`camera.example` name - it never resolves, nothing is contacted) while the video server is configured, then the same data dir is
restarted with SW_WEBRTC=0 for the "no WebRTC server" screens. No real device, camera, go2rtc or Home Assistant is reachable. It
refuses to start inside the add-on.

    SW_PORT=8411 SW_DATA_DIR=<dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni SW_WEBRTC=1 \
        <venv-python> frontend/tests/fixtures/nvrless_cameras_backend.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("nvrless_cameras_backend: refusing to run inside the Home Assistant add-on")

HERE = Path(__file__).resolve().parent
for key in ("NVR_HOST", "NVR_USER", "NVR_PASSWORD", "NVR_HTTP_PORT", "NVR_RTSP_PORT", "GO2RTC_URL", "GO2RTC_API_USER", "GO2RTC_API_PASSWORD", "HA_URL", "HA_TOKEN"):
    os.environ.pop(key, None)
os.environ["SW_OPTIONS_FILE"] = str(Path(os.environ.get("SW_DATA_DIR") or ".") / "no-options.json")
os.environ["SW_MODE"] = "ha_only"

sys.path.insert(0, str(HERE))
import devices_fake_ha  # noqa: E402  (installs the fake Home Assistant and declares the fake go2rtc on import)

WEBRTC = os.environ.get("SW_WEBRTC", "1") == "1"
if not WEBRTC:
    os.environ.pop("GO2RTC_URL", None)  # read by the settings at start-up (devices_fake_ha.main -> smplwise.__main__)


def main() -> None:
    print(f"nvrless_cameras_backend: no NVR, WebRTC server {'configured (fake)' if WEBRTC else 'NOT configured'}", flush=True)
    devices_fake_ha.main()


if __name__ == "__main__":
    main()
