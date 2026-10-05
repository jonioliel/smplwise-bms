"""Security review HIGH (2026-10-04): a Provision export never stores the NVR password. export_jobs.payload_json holds only the
device-side request; the download rebuilds the URL from the recorder's CURRENT connection; rows written before the fix are
scrubbed at worker start."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.services import exports as ex
from smplwise.services import recordings
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_playback as pp

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, settings_for  # noqa: E402
from fake_provision_playback import FakeProvisionPlayback  # noqa: E402

CRED = re.compile(r"://[^/\s\"']+:[^/\s\"']+@")
REQ = "/chID=1&date=2026-10-04&time=12:00:00&timelen=300&streamType=main&action=backup"


@pytest.fixture()
def world(settings, monkeypatch):
    from smplwise.main import create_app

    pisr.clear_auth_cache()
    pp.clear_caches()
    recordings.invalidate()
    fake = FakeProvisionPlayback()
    fake.shape = "live"
    fake.recordings = {1: [("2026-10-04 12:00:00", 600, "motion")]}
    fake.install(monkeypatch)
    s = settings_for(settings, auth="basic", osd_names=False)
    app = create_app(s)
    with TestClient(app) as c:
        deadline = time.monotonic() + 20
        cam = None
        while time.monotonic() < deadline and cam is None:
            with app.state.db.connection(mode="read") as conn:
                cam = conn.execute("SELECT id FROM cameras WHERE recorder_id = 'nvr-1' AND channel = 1").fetchone()
            time.sleep(0.05)
        yield app, c, s, cam["id"]


def test_export_payload_never_holds_credentials(world, monkeypatch):
    app, c, s, cid = world
    monkeypatch.setattr(ex.WORKER, "downloader", lambda st, uri, dest, progress=None: Path(dest).write_bytes(b"ts"))
    r = c.post("/api/v1/exports", json={"camera_id": cid, "from_at": "2026-10-04T09:00:00Z", "to_at": "2026-10-04T09:05:00Z"})
    assert r.status_code == 201, r.text
    with app.state.db.connection(mode="read") as conn:
        payload = conn.execute("SELECT payload_json FROM export_jobs WHERE id = ?", (r.json()["id"],)).fetchone()["payload_json"]
    assert not CRED.search(payload) and PASSWORD not in payload and USER not in payload
    assert json.loads(payload)["files"][0]["playback_uri"] == REQ
    assert pp.export_url(s, REQ) == f"rtsp://{USER}:{PASSWORD}@{HOST}:554{REQ}"


def test_export_job_is_bound_to_its_recorder(world, monkeypatch):
    """Security review L6: the payload names the recorder the files were searched on; a job whose camera is gone or now
    belongs to another recorder fails instead of sending its playback requests elsewhere."""
    app, c, s, cid = world
    monkeypatch.setattr(ex.WORKER, "downloader", lambda st, uri, dest, progress=None: Path(dest).write_bytes(b"ts"))
    r = c.post("/api/v1/exports", json={"camera_id": cid, "from_at": "2026-10-04T09:00:00Z", "to_at": "2026-10-04T09:05:00Z"})
    assert r.status_code == 201, r.text
    with app.state.db.connection(mode="read") as conn:
        payload = json.loads(conn.execute("SELECT payload_json FROM export_jobs WHERE id = ?", (r.json()["id"],)).fetchone()["payload_json"])
    assert payload["recorder_id"] == "nvr-1"
    calls = []
    monkeypatch.setattr(ex.WORKER, "downloader", lambda *a, **k: calls.append(a))
    for job, camera in (("movedjob", cid), ("gonejob", "no-such-camera")):
        moved = {**payload, "recorder_id": "nvr-9"} if job == "movedjob" else payload
        with app.state.db.connection() as conn:  # 'cancelled' so the background worker leaves it alone; _run is called directly
            conn.execute("INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, "
                         "payload_json, created_at, updated_at) VALUES (?, 'u', 'u', ?, 'c', '2026-10-04T09:00:00Z', '2026-10-04T09:05:00Z', 'cancelled', 0, ?, "
                         "'2026-10-04T09:00:00Z', '2026-10-04T09:00:00Z')", (job, camera, json.dumps(moved)))
        ex.WORKER._run(job)
        with app.state.db.connection(mode="read") as conn:
            assert conn.execute("SELECT state FROM export_jobs WHERE id = ?", (job,)).fetchone()["state"] == "failed"
    mine = [a for a in calls if any(j in str(a[2]) for j in ("movedjob", "gonejob"))]  # the first job may still be running
    assert mine == [], "nothing was downloaded from any recorder"


def test_old_rows_are_scrubbed_and_old_urls_never_reused(world):
    app, c, s, cid = world
    old_url = f"rtsp://olduser:oldpass@198.51.100.9:554{REQ}"
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO export_jobs(id, owner_user_id, owner_username, camera_id, camera_name, requested_from, requested_to, state, progress, "
                     "payload_json, created_at, updated_at) VALUES ('oldjob', 'u', 'u', 'c', 'c', '2026-10-04T09:00:00Z', '2026-10-04T09:00:10Z', 'done', 1, ?, "
                     "'2026-10-04T09:00:00Z', '2026-10-04T09:00:00Z')", (json.dumps({"files": [{"playback_uri": old_url}]}),))
        assert ex.scrub_credentials(conn) == 1
        assert ex.scrub_credentials(conn) == 0, "idempotent"
        row = conn.execute("SELECT payload_json FROM export_jobs WHERE id = 'oldjob'").fetchone()["payload_json"]
    assert "oldpass" not in row and not CRED.search(row)
    rebuilt = pp.export_url(s, old_url)
    assert "oldpass" not in rebuilt and "olduser" not in rebuilt and HOST in rebuilt
    with pytest.raises(Exception):
        pp.device_request("rtsp://h/chID=1;evil")
