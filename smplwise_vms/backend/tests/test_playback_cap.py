"""playback.max_sessions: cap 128, and a NON-blocking warning above half of the recorder's channel capacity."""
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import nvr_capacity as cap


def test_channels_from_model_and_warning_logic():
    models = ("DS-7616NXI-K2", "DS-7732NI-K4", "DS-96128NI-F16", "DS-7608NI-Q1", "DS-TEST", "DS-7616NI-FAKE", "", None, "DS-2CD1143G2-LIU")
    assert [cap.channels_from_model(m) for m in models] == [16, 32, 128, 8, None, 16, None, None, None]
    assert cap.playback_sessions_warning(16, 32) is None  # exactly half: fine
    assert cap.playback_sessions_warning(17, 32) and "32" in cap.playback_sessions_warning(17, 32)
    assert cap.playback_sessions_warning(100, None) is None  # unknown capacity: never warns
    assert cap.playback_sessions_warning(None, 32) is None


def test_cap_128_boundaries_and_warning_never_blocks(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        body = c.get("/api/v1/settings").json()
        assert body["nvr_channels"] is None and body["warnings"] == []
        assert c.patch("/api/v1/settings", json={"playback.max_sessions": 128}).status_code == 200
        assert c.patch("/api/v1/settings", json={"playback.max_sessions": 129}).status_code == 422
        assert c.patch("/api/v1/settings", json={"playback.max_sessions": 0}).status_code == 422
        assert c.get("/api/v1/settings").json()["settings"]["playback.max_sessions"] == 128
        assert c.get("/api/v1/settings").json()["warnings"] == []  # capacity unknown: no warning
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO recorders(id, name, model, created_at) VALUES ('r1', 'NVR', 'DS-7732NI-K4', '2026-01-01T00:00:00Z') ON CONFLICT(id) DO UPDATE SET model = excluded.model")
            conn.commit()
        r = c.patch("/api/v1/settings", json={"playback.max_sessions": 17})
        assert r.status_code == 200 and r.json()["nvr_channels"] == 32  # saved despite the warning
        assert [w["key"] for w in r.json()["warnings"]] == ["playback.max_sessions"] and "32" in r.json()["warnings"][0]["message"]
        r = c.patch("/api/v1/settings", json={"playback.max_sessions": 16})
        assert r.status_code == 200 and r.json()["warnings"] == []


def test_live_caps_128_and_non_blocking_warnings(settings):
    assert cap.live_sessions_warning(16, 32) is None and cap.remote_live_streams_warning(16, 32) is None
    assert "32" in cap.live_sessions_warning(17, 32) and "32" in cap.remote_live_streams_warning(17, 32)
    assert cap.live_sessions_warning(128, None) is None and cap.remote_live_streams_warning(None, 32) is None
    app = create_app(settings)
    with TestClient(app) as c:
        for key in ("media.max_live_sessions", "remote.max_live_streams"):
            assert c.patch("/api/v1/settings", json={key: 128}).status_code == 200
            assert c.patch("/api/v1/settings", json={key: 129}).status_code == 422
            assert c.patch("/api/v1/settings", json={key: 0}).status_code == 422
        assert c.get("/api/v1/settings").json()["warnings"] == []  # capacity unknown: no warning
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO recorders(id, name, model, created_at) VALUES ('r1', 'NVR', 'DS-7732NI-K4', '2026-01-01T00:00:00Z') ON CONFLICT(id) DO UPDATE SET model = excluded.model")
            conn.commit()
        r = c.patch("/api/v1/settings", json={"media.max_live_sessions": 20, "remote.max_live_streams": 20})
        assert r.status_code == 200  # saved despite the warnings
        assert sorted(w["key"] for w in r.json()["warnings"]) == ["media.max_live_sessions", "remote.max_live_streams"]
        r = c.patch("/api/v1/settings", json={"media.max_live_sessions": 16, "remote.max_live_streams": 16})
        assert r.status_code == 200 and r.json()["warnings"] == []
