"""Fixture backend for tests/evidence-multi-nvr-live.spec.ts (CR-024): the REAL SMPLWISE backend with TWO fake recorders - the
first from the NVR_* development values (fake-nvr.test), the second (fake-nvr-2.test, "NVR מחסן") stored in Arx before the start
exactly as "הוסף NVR" stores it (recorders row + recorder_connections row with the encrypted password) - and the fake go2rtc of
smplwise_vms/backend/tests/fixtures/fake_devices.py. Discovery, the stream sync and the alert streams run for both at start-up, so
the screens read real `/recorders`, `/cameras`, `/nvr/cameras`, `/events`. No real device, platform or secret is involved: the reserved
`.test` names are answered on httpx's transport and the connection test resolves only these two names. Refuses to run in the add-on.

    SW_PORT=8391 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <venv-python> frontend/tests/fixtures/multi_nvr_backend.py
    SW_LIVE=1 SW_MULTINVR=1 SW_API_PORT=8391 SW_BASE_URL=http://127.0.0.1:<vite>/ npx playwright test tests/evidence-multi-nvr-live.spec.ts
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("multi_nvr_backend: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests" / "fixtures"))

from fake_devices import GO2RTC_HOST, NVR_ADDR, NVR_HOST, FakeDevices, install_many  # noqa: E402

NVR2_HOST = "fake-nvr-2.test"
NVR2_ADDR = "192.0.2.81"  # TEST-NET-1 (RFC 5737), documentation only
for key in ("HA_URL", "HA_TOKEN", "GO2RTC_API_USER", "GO2RTC_API_PASSWORD", "NVR_HTTP_PORT", "NVR_RTSP_PORT"):
    os.environ.pop(key, None)
DATA = Path(os.environ.get("SW_DATA_DIR") or ".")
os.environ["SW_OPTIONS_FILE"] = str(DATA / "no-options.json")
os.environ["NVR_HOST"] = NVR_HOST
os.environ["NVR_USER"] = "viewer"
os.environ["NVR_PASSWORD"] = "fixture-pass-one"  # a made-up value for a fake device
os.environ["GO2RTC_URL"] = f"http://{GO2RTC_HOST}:1984"

ONE = FakeDevices()
TWO = FakeDevices(nvr_host=NVR2_HOST, nvr_addr=NVR2_ADDR, shared=False)
TWO.nvr["serials"] = {1: "FIXTURE-SN-1"}
ONE.nvr["serials"] = {1: "FIXTURE-SN-1"}  # the same serial behind slot 1 of both recorders: still two cameras
install_many([ONE, TWO])

from smplwise.services import connection_probe  # noqa: E402

TABLE = {NVR_HOST: [NVR_ADDR], NVR2_HOST: [NVR2_ADDR]}
connection_probe.RESOLVE = lambda host: list(TABLE.get(host.strip().lower().rstrip("."), []))


def seed() -> None:
    """The second recorder, stored as the add route stores it (before the start, so the start-up overlay loads it)."""
    from smplwise.config import load_settings
    from smplwise.db import Database, now_iso
    from smplwise.services import connection_store

    settings = load_settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    db = Database(settings.db_path)
    db.migrate()
    with db.connection() as conn:
        if conn.execute("SELECT 1 FROM recorders WHERE id = 'nvr-2'").fetchone():
            return
        conn.execute("INSERT INTO recorders(id, name, created_at, vendor, enabled, sort_order) VALUES ('nvr-2', 'NVR מחסן', ?, 'hikvision', 1, 1)", (now_iso(),))
        connection_store.write_row(conn, settings, vendor="hikvision", host=NVR2_HOST, http_port=80, rtsp_port=554, username="viewer",
                                   password="fixture-pass-two", extra=None, source="ui", actor_id=None, recorder_id="nvr-2")


def main() -> None:
    seed()
    print("multi_nvr_backend: two fake recorders (fake-nvr.test, fake-nvr-2.test) and a fake go2rtc", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
