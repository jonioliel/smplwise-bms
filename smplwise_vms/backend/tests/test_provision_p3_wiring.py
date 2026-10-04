"""CR-025 P3 wiring (fake device only): a Provision-ISR recorder through the shared recordings, playback, thumbnails / frames,
export and health paths. The playback module itself is tested in test_provision_playback.py; this file proves the Arx
routes reach it with the camera's recorder, and that Hikvision recorders keep their own paths."""
from __future__ import annotations

import dataclasses
import datetime as dt
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise.services import exports as ex
from smplwise.services import playback as pb
from smplwise.services import recordings
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_playback as pp
from smplwise.services.recorders import vendor_io

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import HOST, PASSWORD, USER, settings_for  # noqa: E402
from fake_provision_playback import FakeProvisionPlayback  # noqa: E402

UTC = dt.timezone.utc


@pytest.fixture()
def fake(monkeypatch) -> FakeProvisionPlayback:
    pisr.clear_auth_cache()
    pp.clear_caches()
    recordings.invalidate()
    f = FakeProvisionPlayback()
    f.shape = "live"
    f.names = {1: "Gate", 2: "Lobby", 3: "Yard", 4: "Roof"}
    # Israel summer time (UTC+3): 12:00-12:10 and 12:20-12:30 wall clock on 2026-10-04 = 09:00-09:10 / 09:20-09:30 UTC
    f.recordings = {1: [("2026-10-04 12:00:00", 600, "motion"), ("2026-10-04 12:20:00", 600, "schedule")]}
    f.install(monkeypatch)
    return f


def app_for(settings, fake, **extra):
    from smplwise.main import create_app

    s = settings_for(settings, auth="basic", **extra)
    app = create_app(s)
    return app, s


def wait_cam(app, channel=1, timeout=20.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with app.state.db.connection(mode="read") as conn:
            row = conn.execute("SELECT * FROM cameras WHERE recorder_id = 'nvr-1' AND channel = ?", (channel,)).fetchone()
        if row is not None:
            return dict(row)
        time.sleep(0.05)
    raise AssertionError("discovery did not create the camera")


def test_discovery_gives_provision_cameras_their_channel_as_track(settings, fake):
    app, _ = app_for(settings, fake)
    with TestClient(app):
        cam = wait_cam(app)
    assert cam["main_track"] == 1 and cam["sub_track"] is None


def test_recordings_route_searches_the_provision_recorder_with_gaps(settings, fake):
    app, _ = app_for(settings, fake)
    with TestClient(app) as c:
        cam = wait_cam(app)
        r = c.get(f"/api/v1/cameras/{cam['id']}/recordings", params={"from": "2026-10-04T08:50:00Z", "to": "2026-10-04T09:40:00Z"})
    assert r.status_code == 200, r.text
    segs = [(s["start_at"], s["end_at"], s["kind"]) for s in r.json()["segments"]]
    assert segs == [("2026-10-04T09:00:00Z", "2026-10-04T09:10:00Z", "motion"), ("2026-10-04T09:20:00Z", "2026-10-04T09:30:00Z", "continuous")], "segments with the gap between them"
    assert r.json()["track_id"] == 1 and r.json()["timezone"].startswith("device:")
    assert fake.writes == []


def test_time_basis_israel_option(settings, fake):
    fake.tz_rule = "GMT0"  # a device clock on UTC: with the Israel option its wall times are read as Israel time anyway
    app, _ = app_for(settings, fake, time_basis="iana")
    with TestClient(app) as c:
        cam = wait_cam(app)
        r = c.get(f"/api/v1/cameras/{cam['id']}/recordings", params={"from": "2026-10-04T08:50:00Z", "to": "2026-10-04T09:40:00Z"})
    assert r.json()["timezone"] == "Asia/Jerusalem" and r.json()["segments"][0]["start_at"] == "2026-10-04T09:00:00Z"


def test_playback_url_dispatch_keeps_hikvision(settings, fake):
    s = dataclasses.replace(settings_for(settings, auth="basic"), nvr_recorder_id="nvr-1") if hasattr(settings, "nvr_recorder_id") else settings_for(settings, auth="basic")
    start = dt.datetime(2026, 10, 4, 9, 0, 5, tzinfo=UTC)
    url = pb.playback_rtsp_url(s, 1, start, start + dt.timedelta(minutes=5), "Asia/Jerusalem")
    assert url.startswith(f"rtsp://{USER}:{PASSWORD}@{HOST}:554/chID=1&date=2026-10-04&time=12:00:05&timelen=300&streamType=main&action=playback")
    hik = dataclasses.replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p")
    assert "/Streaming/tracks/101" in pb.playback_rtsp_url(hik, 101, start, start + dt.timedelta(minutes=5), "Asia/Jerusalem")


def test_export_files_and_mp4_remux(settings, fake, monkeypatch):
    """Owner (2026-10-04, corrected): Provision exports are remuxed TS -> MP4 like Hikvision ones (no video re-encode)."""
    ff = shutil.which("ffmpeg")
    app, s = app_for(settings, fake)
    with TestClient(app) as c:
        cam = wait_cam(app)
        with app.state.db.connection(mode="read") as conn:
            row = conn.execute("SELECT * FROM cameras WHERE id = ?", (cam["id"],)).fetchone()
            files, coverage = ex._files_for(s, conn, row, dt.datetime(2026, 10, 4, 9, 0, tzinfo=UTC), dt.datetime(2026, 10, 4, 9, 30, tzinfo=UTC), "Asia/Jerusalem")
        assert coverage == "complete" and len(files) == 2 and all("action=backup" in f.playback_uri for f in files)
        if not ff:
            pytest.skip("ffmpeg not installed: the remux step cannot be exercised")
        src_ts = Path(settings.data_dir) / "sample.ts"
        src_ts.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=160x120:rate=5", "-t", "2", "-c:v", "libx264",
                        "-g", "5", "-f", "mpegts", str(src_ts)], check=True, timeout=60)

        def fake_download(settings_, uri, dest, progress=None):
            assert "action=backup" in uri
            shutil.copy(src_ts, dest)

        monkeypatch.setattr(ex.WORKER, "downloader", fake_download)
        r = c.post("/api/v1/exports", json={"camera_id": cam["id"], "from_at": "2026-10-04T09:00:00Z", "to_at": "2026-10-04T09:05:00Z"})
        assert r.status_code == 201, r.text
        job = r.json()["id"]
        ex.WORKER.run_pending()
        deadline = time.monotonic() + 60
        done = c.get(f"/api/v1/exports/{job}").json()
        while done["state"] in ("queued", "running") and time.monotonic() < deadline:  # the app's own worker may hold the job
            time.sleep(0.2)
            done = c.get(f"/api/v1/exports/{job}").json()
    assert done["state"] in ("done", "partial"), done
    with app.state.db.connection(mode="read") as conn:
        payload = json.loads(conn.execute("SELECT payload_json FROM export_jobs WHERE id = ?", (job,)).fetchone()["payload_json"])
    assert payload["container"] == "mp4" and payload["media_type"] == "video/mp4" and payload["remux"] == "done", payload


def test_health_report_names_provision_and_its_time_basis(settings, fake):
    app, s = app_for(settings, fake)
    with TestClient(app) as c:
        wait_cam(app)
        pp.ProvisionPlayback(vendor_io.adapter(s, "nvr-1"), "Asia/Jerusalem").zone()  # what the event loop does every 10 minutes
        r = c.get("/api/v1/health/report", params={"fresh": 1})
    checks = {x["id"]: x for x in r.json()["checks"]}
    assert checks["nvr"]["label"] == "NVR (Provision-ISR)" and checks["nvr"]["status"] == "ok"
    t = checks["recorder_time_nvr-1"]
    assert t["status"] == "ok" and "שעון המכשיר" in t["detail"]


def test_health_warns_when_the_device_clock_differs(settings, fake):
    fake.tz_rule = "GMT0"
    app, s = app_for(settings, fake)
    with TestClient(app) as c:
        wait_cam(app)
        pp.clear_caches()
        pp.ProvisionPlayback(vendor_io.adapter(s, "nvr-1"), "Asia/Jerusalem").zone()
        r = c.get("/api/v1/health/report")
    t = {x["id"]: x for x in r.json()["checks"]}["recorder_time_nvr-1"]
    assert t["status"] == "warn" and "שונה משעון ישראל" in t["detail"]
