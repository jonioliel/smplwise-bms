"""Automatic NVR discovery and go2rtc stream sync (start-up / periodic) with the devices faked."""
from __future__ import annotations

from dataclasses import replace

from fastapi.testclient import TestClient
from test_recordings import FakeGo2rtc

from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import autosync, nvr


def test_run_once_discovers_cameras_and_streams_without_a_user(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc:1984")
    monkeypatch.setattr(nvr, "device_info", lambda _s: {"model": "DS-7616", "firmware": "V4.84", "device_type": "NVR"})
    monkeypatch.setattr(nvr, "discover_channels", lambda _s: [nvr.DiscoveredChannel(channel=1, name="Entrance", online=True, main_track=101, sub_track=102), nvr.DiscoveredChannel(channel=2, name="Lobby", online=False, main_track=201, sub_track=202)])
    FakeGo2rtc.store = {"hik_cam1": ["rtsp://x"]}
    monkeypatch.setattr(autosync.g2, "Go2rtc", FakeGo2rtc)
    app = create_app(s)
    db: Database = app.state.db
    autosync.run_once(db, s, reason="startup")
    assert autosync.STATE["cameras_last_ok"] and autosync.STATE["cameras_last_error"] is None
    assert autosync.STATE["streams_last_ok"] and autosync.STATE["streams_last_error"] is None
    c = TestClient(app)
    cams = c.get("/api/v1/cameras").json()
    assert [x["channel"] for x in cams["cameras"]] == [1, 2] and cams["recorder"]["model"] == "DS-7616"
    assert [x["status"] for x in cams["cameras"]] == ["online", "offline"]
    assert sorted(n for n in FakeGo2rtc.store if n.startswith("smplwise_")) == ["smplwise_nvr-1_ch1_main", "smplwise_nvr-1_ch1_sub", "smplwise_nvr-1_ch2_main", "smplwise_nvr-1_ch2_sub"]
    # audited as a system action (no actor), with the reason
    with db.connection() as conn:
        rows = conn.execute("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'cameras.sync'").fetchall()
    assert rows and rows[-1]["actor_user_id"] is None and '"reason": "startup"' in rows[-1]["details_json"]
    h = c.get("/api/v1/health").json()
    assert h["discovery"]["cameras"] == 2 and h["discovery"]["cameras_last_error"] is None
    # a second run keeps aliases and does not duplicate
    c.patch(f"/api/v1/cameras/{cams['cameras'][0]['id']}", json={"alias": "Front"})
    autosync.run_once(db, s, reason="periodic")
    cams2 = c.get("/api/v1/cameras").json()["cameras"]
    assert len(cams2) == 2 and cams2[0]["alias"] == "Front"


def test_run_once_records_errors_and_never_raises(settings, monkeypatch):
    s = replace(settings, nvr_host="nvr.local", nvr_user="u", nvr_password="p", go2rtc_url=None)

    def down(_s):
        raise ApiError(503, "source_unavailable", "down", retryable=True)

    monkeypatch.setattr(nvr, "device_info", down)
    app = create_app(s)
    autosync.run_once(app.state.db, s, reason="startup")
    assert autosync.STATE["cameras_last_error"] == "source_unavailable"
    assert TestClient(app).get("/api/v1/health").json()["discovery"]["cameras_last_error"] == "source_unavailable"
    # not configured at all → recorded, no crash
    autosync.run_once(app.state.db, settings, reason="startup")
    assert autosync.STATE["cameras_last_error"] == "nvr_not_configured"
