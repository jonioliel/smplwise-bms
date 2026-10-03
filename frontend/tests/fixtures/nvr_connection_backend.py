"""Fixture backend for tests/evidence-nvr-connection-live.spec.ts (CR-022 slice C): the REAL SMPLWISE backend started WITHOUT an
NVR host (the `ha_only` installation a new install starts in), with the fake NVR and go2rtc of
smplwise_vms/backend/tests/fixtures/fake_devices.py answering the reserved `.test` names on httpx's transport. The connection
screens then run their whole flow - vendor choice, test, save, restart-required flag, remove, "no NVR" - against the real
`/nvr/vendors`, `/nvr/connection`, `/nvr/connection/test`, `/system/restart`, `/me` and `/setup/state`, while nothing can reach a
real device: a host that is not one of the fakes goes to real DNS, where a `.test` name never resolves. No real Home Assistant
(no HA_URL / HA_TOKEN) and no secret is involved. It refuses to start inside the add-on.

Run it (a fresh data dir each time - the specs of one run share the installation, so one backend per Playwright project):

    SW_PORT=8373 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <venv-python> frontend/tests/fixtures/nvr_connection_backend.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_NVRCONN=1 SW_API_PORT=8373 SW_NVRCONN_CONTROL=http://127.0.0.1:8383 SW_BASE_URL=http://127.0.0.1:4193/ \
        npx playwright test tests/evidence-nvr-connection-live.spec.ts --project=desktop --workers=1

Control API (SW_NVRCONN_CONTROL_PORT, default SW_PORT + 10, 127.0.0.1 only), JSON:
    POST /nvr {up?, auth?}     change the fake NVR ({"up": false}: every ISAPI call fails to connect; {"auth": false}: 401)
    GET  /hits                 every request the fake devices answered ("host METHOD path")
    GET  /writes               every non-GET request the fake devices received (the connection test must add none)
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
    sys.exit("nvr_connection_backend: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests" / "fixtures"))

from fake_devices import GO2RTC_HOST, FakeDevices  # noqa: E402

# a new installation: no NVR, no options file, nothing from the shell's environment
for key in ("NVR_HOST", "NVR_USER", "NVR_PASSWORD", "NVR_HTTP_PORT", "NVR_RTSP_PORT", "GO2RTC_API_USER", "GO2RTC_API_PASSWORD", "HA_URL", "HA_TOKEN"):
    os.environ.pop(key, None)
os.environ["SW_OPTIONS_FILE"] = str(Path(os.environ.get("SW_DATA_DIR") or ".") / "no-options.json")
os.environ["SW_MODE"] = "ha_only"
os.environ["GO2RTC_URL"] = f"http://{GO2RTC_HOST}:1984"
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

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: D401 - quiet control server
        return

    def do_GET(self) -> None:  # noqa: N802
        with FAKE.lock:
            if self.path == "/writes":
                return self._json(200, list(FAKE.writes))
            if self.path == "/hits":
                return self._json(200, list(FAKE.hits))
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}") if n else {}
        if self.path == "/nvr":
            unknown = set(body) - {"up", "auth"}
            if unknown:
                return self._json(400, {"error": f"unknown keys {sorted(unknown)}"})
            with FAKE.lock:
                FAKE.nvr.update(body)
                return self._json(200, {k: FAKE.nvr[k] for k in ("up", "auth")})
        self._json(404, {"error": "not_found"})


def main() -> None:
    port = int(os.environ.get("SW_NVRCONN_CONTROL_PORT") or PORT + 10)
    server = ThreadingHTTPServer(("127.0.0.1", port), Control)
    threading.Thread(target=server.serve_forever, name="nvrconn-fixture-control", daemon=True).start()
    print("nvr_connection_backend: starting without an NVR (installation mode ha_only); the fake NVR answers fake-nvr.test", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
