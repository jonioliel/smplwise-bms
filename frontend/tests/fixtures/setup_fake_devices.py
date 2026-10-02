"""Fixture backend for tests/evidence-setup-wizard.spec.ts (T071): the REAL SMPLWISE backend whose NVR and go2rtc are
the fakes in smplwise_vms/backend/tests/fixtures/fake_devices.py - the add-on's own ISAPI / go2rtc code runs unchanged,
only the HTTP answers are fake. NVR_HOST and GO2RTC_URL point at reserved `.test` names that never resolve, and httpx's
transport answers them in this process; Home Assistant is left unconfigured (no HA_URL / HA_TOKEN), so no real HA, NVR
or go2rtc can be reached from here. It refuses to start inside the add-on.

At start-up the backend's own discovery reads the fake NVR (4 channels) and its stream sync creates the `smplwise_`
streams in the fake go2rtc, as the real add-on does; the setup wizard itself never writes to a device.

Run it (a fresh data dir each time):

    SW_PORT=8349 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <venv-python> frontend/tests/fixtures/setup_fake_devices.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_SETUP_FIXTURE=1 SW_API_PORT=8349 SW_SETUP_CONTROL=http://127.0.0.1:8359 \
        SW_BASE_URL=http://127.0.0.1:4189/ npx playwright test tests/evidence-setup-wizard.spec.ts --project=desktop --project=mobile --workers=1

Control API (SW_SETUP_CONTROL_PORT, default SW_PORT + 10, 127.0.0.1 only), JSON:
    POST /reset                    fake devices back to their defaults (all up); the wizard forgets its cached checks and
                                   its rate limiter
    POST /nvr {up?, auth?, drift_s?, offset?, channels?, streaming?, encodings?, encodings_by_channel?}
                                   change the fake NVR (e.g. {"up": false} - every ISAPI call then fails to connect;
                                   {"encodings": {"main": {"codec": "H.264", "svc": false}, "sub": {...}}} - the stream
                                   encodings of GET /ISAPI/Streaming/channels, CR-008 D7; a camera sync reads them)
    POST /go2rtc {up?, auth?}      change the fake go2rtc
    GET  /writes                   every non-GET request a fake device received (the start-up stream sync's PUTs only)
"""
from __future__ import annotations

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("setup_fake_devices: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests" / "fixtures"))

from fake_devices import GO2RTC_HOST, NVR_HOST, FakeDevices  # noqa: E402

os.environ["NVR_HOST"] = NVR_HOST
os.environ["NVR_HTTP_PORT"] = "80"
os.environ["NVR_USER"] = "wizard"
os.environ["NVR_PASSWORD"] = "fake-password"
os.environ["GO2RTC_URL"] = f"http://{GO2RTC_HOST}:1984"
for key in ("HA_URL", "HA_TOKEN", "GO2RTC_API_USER", "GO2RTC_API_PASSWORD"):
    os.environ.pop(key, None)
PORT = int(os.environ.get("SW_PORT", "8099"))

FAKE = FakeDevices()
FAKE.install()


class Control(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Any) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: D401 - quiet control server
        return

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/writes":
            with FAKE.lock:
                return self._json(200, list(FAKE.writes))
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        from smplwise.services import setup_wizard  # imported here: after the transport hook is in place

        body = self._body()
        if self.path == "/reset":
            with FAKE.lock:
                streams = dict(FAKE.go2rtc["streams"])
            FAKE.reset()
            with FAKE.lock:
                FAKE.go2rtc["streams"] = streams  # go2rtc does not lose its streams because a test starts
            setup_wizard.reset()
            return self._json(200, {"ok": True})
        if self.path in ("/nvr", "/go2rtc"):
            target = FAKE.nvr if self.path == "/nvr" else FAKE.go2rtc
            allowed = {"up", "auth", "drift_s", "offset", "channels", "streaming", "encodings", "encodings_by_channel"} if self.path == "/nvr" else {"up", "auth"}
            unknown = set(body) - allowed
            if unknown:
                return self._json(400, {"error": f"unknown keys {sorted(unknown)}"})
            with FAKE.lock:
                target.update(body)
                return self._json(200, {k: target[k] for k in allowed})
        self._json(404, {"error": "not_found"})


def main() -> None:
    port = int(os.environ.get("SW_SETUP_CONTROL_PORT") or PORT + 10)
    server = ThreadingHTTPServer(("127.0.0.1", port), Control)
    threading.Thread(target=server.serve_forever, name="setup-fixture-control", daemon=True).start()
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
