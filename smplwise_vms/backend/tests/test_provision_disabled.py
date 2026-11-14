"""Security review M3 (2026-10-04): a Provision-ISR recorder disabled while the process runs is never contacted again - live,
snapshot, recordings search, export and playback answer 409 `recorder_unavailable` and the fake device sees no request."""
from __future__ import annotations

import dataclasses
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from smplwise import recorder_scope
from smplwise.services import recordings
from smplwise.services.recorders import provision_isr as pisr
from smplwise.services.recorders import provision_playback as pp

sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from fake_provision import settings_for  # noqa: E402
from fake_provision_playback import FakeProvisionPlayback  # noqa: E402

REFUSED = ("recorder_unavailable", "nvr_not_configured")


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
    s = dataclasses.replace(settings_for(settings, auth="basic", osd_names=False), go2rtc_url="http://go2rtc.test:1984")
    app = create_app(s)
    with TestClient(app) as c:
        deadline = time.monotonic() + 20
        cam = None
        while time.monotonic() < deadline and cam is None:
            with app.state.db.connection(mode="read") as conn:
                cam = conn.execute("SELECT id FROM cameras WHERE recorder_id = 'nvr-1' AND channel = 1").fetchone()
            time.sleep(0.05)
        assert cam is not None
        recorder_scope.set_disabled("nvr-1", True)
        try:
            yield c, fake, cam["id"]
        finally:
            recorder_scope.set_disabled("nvr-1", False)


def test_disabled_provision_recorder_is_never_contacted(world):
    c, fake, cid = world
    hits = len(fake.hits)
    window = {"from": "2026-10-04T08:50:00Z", "to": "2026-10-04T09:20:00Z"}
    answers = {
        "live": c.get(f"/api/v1/media/live/{cid}", params={"profile": "sub"}),
        "snapshot": c.get(f"/api/v1/cameras/{cid}/snapshot.jpg"),
        "search": c.get(f"/api/v1/cameras/{cid}/recordings", params=window),
        "export": c.post("/api/v1/exports", json={"camera_id": cid, "from_at": "2026-10-04T09:00:00Z", "to_at": "2026-10-04T09:05:00Z"}),
        "playback": c.post("/api/v1/playback/sessions", json={"camera_id": cid, "start_at": "2026-10-04T09:01:00Z"}),
    }
    for name, r in answers.items():
        # a disabled FIRST recorder makes the installation NVR-less at once (CR-024): nvr_not_configured; a further one: recorder_unavailable
        assert r.status_code == 409 and r.json()["code"] in REFUSED, (name, r.status_code, r.text[:200])
    assert fake.hits[hits:] == [], ("nothing reached the device", fake.hits[hits:])


def test_adapter_entry_points_refuse_when_disabled(settings):
    s = settings_for(settings, auth="basic", device_kind="nvr", rtsp_style="path")
    recorder_scope.set_disabled("nvr-1", True)
    try:
        a = pisr.ProvisionIsrAdapter("nvr-1", s)
        for call in (lambda: a.live_source("1", "main"), a.storage, lambda: pp.rtsp_playback_url(s, 1, *(__import__("datetime").datetime(2026, 10, 4, 9, tzinfo=__import__("datetime").timezone.utc),) * 2, "Asia/Jerusalem")):
            with pytest.raises(Exception) as e:
                call()
            assert getattr(e.value, "code", None) in REFUSED
    finally:
        recorder_scope.set_disabled("nvr-1", False)
