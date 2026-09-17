"""Playback quota hygiene: a session nobody ever connected to is dropped after 90 s (not the 10-minute lease), a
session that did stream keeps its lease for reconnects, and the beacon-friendly POST close routes release a session
or a group exactly like DELETE."""
from __future__ import annotations

import datetime as dt

from conftest import seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import playback as pb
from smplwise.services import playback_groups as pg


class _Principal:
    user_id = "dev-joni"
    username = "joni"


def _session(monkeypatch, settings, cam_id="cam-a"):
    monkeypatch.setattr(pb, "_create_stream", lambda _s, session, _start: setattr(session, "stream", f"smplwise_pb_{session.id}_g{session.generation}"))
    monkeypatch.setattr(pb, "_delete_stream", lambda _s, name: None)
    start = dt.datetime(2026, 9, 17, 8, 0, tzinfo=dt.timezone.utc)
    return pb.create(settings, _Principal(), {"id": cam_id, "channel": 1, "main_track": 101}, start, start + dt.timedelta(hours=1), "Asia/Jerusalem", 4)


def test_never_connected_sessions_expire_early(monkeypatch, settings):
    fresh = _session(monkeypatch, settings)
    streamed = _session(monkeypatch, settings, "cam-b")
    streamed.first_frame_at = fresh.created
    streamed.bytes_down = 4096
    try:
        assert pb.expire_idle(settings, 600) == []
        for s in (fresh, streamed):
            s.created -= 120
            s.last_activity -= 120
        expired = pb.expire_idle(settings, 600)
        assert expired == [fresh.id], "only the session nobody connected to is dropped early"
        assert fresh.state == "expired" and streamed.state == "buffering"
        streamed.last_activity -= 600
        assert pb.expire_idle(settings, 600) == [streamed.id], "the idle lease still applies to a session that streamed"
    finally:
        for s in (fresh, streamed):
            pb.REGISTRY.sessions.pop(s.id, None)


def test_beacon_close_routes(monkeypatch, settings):
    app = create_app(settings)
    c = TestClient(app)
    seed_tree(c)
    s = _session(monkeypatch, settings)
    pg.GROUPS["grp-b"] = pg.PlaybackGroup(id="grp-b", user_id="dev-joni", requested_at=dt.datetime(2026, 9, 17, 8, 0, tzinfo=dt.timezone.utc), session_ids=[s.id])
    try:
        r = c.post(f"/api/v1/playback/groups/grp-b/close")
        assert r.status_code == 200 and r.json()["state"] == "closed" and "grp-b" not in pg.GROUPS and s.state == "closed"
        again = c.post(f"/api/v1/playback/sessions/{s.id}/close")
        assert again.status_code == 200 and again.json()["state"] == "closed", "closing twice is harmless"
        s2 = _session(monkeypatch, settings, "cam-c")
        r2 = c.post(f"/api/v1/playback/sessions/{s2.id}/close")
        assert r2.status_code == 200 and s2.state == "closed"
        with app.state.db.connection() as conn:
            rows = conn.execute("SELECT details_json FROM audit_log WHERE action IN ('video.playback.stop', 'video.playback.group.stop') ORDER BY rowid").fetchall()
        assert rows and all("beacon" in (row[0] or "") for row in rows)
        assert c.post("/api/v1/playback/sessions/nope/close").status_code == 404
    finally:
        pg.GROUPS.pop("grp-b", None)
        for sid in list(pb.REGISTRY.sessions):
            pb.REGISTRY.sessions.pop(sid, None)
