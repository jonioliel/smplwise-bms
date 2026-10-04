"""Fixture backend for tests/evidence-system-update-fixture.spec.ts (CR-021 S3 UI): the REAL SmplWise Arx backend (local channel, the
bootstrap administrator is a system administrator) serving the built UI, whose only fake is the infrastructure: the fake Supervisor of
update_fake_supervisor.py, wired in through `self_update.BASE_URL` / `TOKEN`. No real Home Assistant, Supervisor, device or network is
ever reached; it refuses to start inside the add-on.

The spec starts one instance per Playwright project (fresh data dir, free ports), so nothing is shared between desktop / tablet / phone.

    SW_PORT=<port> SW_DATA_DIR=<empty dir> <venv-python> frontend/tests/fixtures/update_fixture_backend.py     (npm run build first)

It prints `READY <port> <control port>` once the API answers. A small control server (127.0.0.1, SW_PORT + 1) lets the spec play the part of
the infrastructure and of the "new process" an update leaves behind - this process cannot really be replaced, so the new start is simulated
by running the same start-up hook the real new process runs (`update_runs.on_startup`) with the version patched:

    POST /fixture/set          {"installed": "...", "latest": "...", "core_check_status": 400, ...}   attributes of the fake Supervisor
    POST /fixture/new-process  {"version": "0.1.157"}                                                  the start of the updated version
    GET  /fixture/log                                                                                  the fake Supervisor's request log
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("update_fixture_backend: refusing to run inside the add-on")

ROOT = Path(__file__).resolve().parents[3]
BACKEND = ROOT / "smplwise_vms" / "backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(Path(__file__).resolve().parent))
PORT = int(os.environ.get("SW_PORT", "8351"))
CONTROL_PORT = int(os.environ.get("SW_CONTROL_PORT", str(PORT + 1)))
DIST = ROOT / "frontend" / "dist"
if not (DIST / "index.html").exists():
    sys.exit("update_fixture_backend: build the UI first (npm run build in frontend/)")

WWW = Path(tempfile.mkdtemp(prefix="update-www-"))
shutil.copytree(DIST, WWW, dirs_exist_ok=True)
if not (WWW / "arx-sw.js").exists():
    (WWW / "arx-sw.js").write_text("// placeholder service worker for the fixture\n", encoding="utf-8")

os.environ["SW_WWW_DIR"] = str(WWW)
os.environ["SW_HOST"] = "127.0.0.1"
os.environ["SW_PORT"] = str(PORT)
os.environ.setdefault("SW_DATA_DIR", tempfile.mkdtemp(prefix="update-data-"))
os.environ.pop("HA_URL", None)
os.environ.pop("HA_TOKEN", None)
os.environ["HA_CORE_URL"] = "http://fake-ha-core.test:8123"
os.environ.setdefault("SW_DEV_USER", "joni")
os.environ.setdefault("SW_BOOTSTRAP_ADMIN", "joni")
os.environ.setdefault("SW_MODE", "ha_only")

import smplwise  # noqa: E402
import uvicorn  # noqa: E402
from update_fake_supervisor import TOKEN, FakeSupervisor  # noqa: E402

from smplwise.main import create_app  # noqa: E402
from smplwise.services import self_update, update_runs  # noqa: E402

SUP = FakeSupervisor()
APP = create_app()
SETTABLE = {"installed", "latest", "role", "info_state", "update_status", "update_job", "job_done", "job_errors", "job_backup_done", "job_listed", "backup_errors", "kill_on_update",
            "core_version", "core_state", "core_check_status", "core_restart_status", "core_down_polls", "core_info_status", "reload_status", "store_stale"}


class Control(BaseHTTPRequestHandler):
    def log_message(self, *a) -> None:
        pass

    def _send(self, status: int, body: object) -> None:
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        if self.path == "/fixture/log":
            return self._send(200, {"log": SUP.log, "installed": SUP.installed, "latest": SUP.latest, "version": smplwise.__version__})
        self._send(404, {"error": "unknown"})

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self._send(400, {"error": "json"})
        if self.path == "/fixture/set":
            if "no_job_grace_s" in body:  # the follow worker's no-job grace (real: 120 s): shortened only by the spec that proves "version unchanged"
                update_runs.NO_JOB_GRACE_S = float(body.pop("no_job_grace_s"))
            bad = [k for k in body if k not in SETTABLE]
            if bad:
                return self._send(400, {"error": "unknown attribute", "keys": bad})
            for k, v in body.items():
                setattr(SUP, k, v)
            return self._send(200, {"ok": True})
        if self.path == "/fixture/new-process":
            version = str(body.get("version") or "")
            for mod in (smplwise, update_runs, self_update):
                mod.__version__ = version  # type: ignore[attr-defined]
            SUP.installed = version
            out = update_runs.on_startup(APP.state.db, APP.state.settings)
            return self._send(200, {"outcome": out})
        self._send(404, {"error": "unknown"})


def main() -> None:
    SUP._thread.start()
    self_update.BASE_URL = SUP.url
    self_update.TOKEN = TOKEN
    SUP.installed = smplwise.__version__
    SUP.latest = smplwise.__version__
    # the real timings are minutes; the fixture lives in seconds
    update_runs.POLL_S = 0.5
    update_runs.HEALTH_RETRY_S = 1.0
    update_runs.RESTART_SETTLE_S = 1.0
    self_update.CHECK_MIN_GAP_S = 0  # the manual check's 30 s / 20 per hour limit is proven by the backend tests
    self_update.CHECK_PER_HOUR = 10_000
    update_runs.APPLY_MIN_GAP_S = 0 # the spec starts several updates in a row (the 10-minute gap is proven by the backend tests)
    ctl = ThreadingHTTPServer(("127.0.0.1", CONTROL_PORT), Control)
    threading.Thread(target=ctl.serve_forever, daemon=True).start()
    print(f"READY {PORT} {CONTROL_PORT}", flush=True)
    uvicorn.run(APP, host="127.0.0.1", port=PORT, log_level="warning", proxy_headers=False)


if __name__ == "__main__":
    main()
