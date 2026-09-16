"""Review windows (M26): adjacent events of one camera become one window, a gap opens a new one, other cameras
and system events stay apart; ack-many handles a window and keeps the raw events; scope applies."""
from __future__ import annotations

import datetime as dt
import json

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers.events import group_windows


def _iso(t: dt.datetime) -> str:
    return t.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _insert(app, eid: str, camera_id: str | None, occurred: dt.datetime, etype: str = "motion", severity: str = "info", ended: dt.datetime | None = None) -> None:
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "alertstream", "VMD", etype, camera_id, 1, _iso(occurred), _iso(ended) if ended else None, _iso(occurred), "inactive", 1, severity, "measured", json.dumps({}), f"t:{eid}", _iso(occurred)),
        )


def test_group_windows_pure():
    t0 = dt.datetime(2026, 9, 16, 8, 0, tzinfo=dt.timezone.utc)
    evs = [
        {"id": "a1", "camera_id": "A", "type": "motion", "severity": "info", "occurred_at": _iso(t0), "ended_at": None, "thumbnail": "none"},
        {"id": "a2", "camera_id": "A", "type": "person", "severity": "alert", "occurred_at": _iso(t0 + dt.timedelta(seconds=90)), "ended_at": None, "thumbnail": "ready"},
        {"id": "a3", "camera_id": "A", "type": "person", "severity": "info", "occurred_at": _iso(t0 + dt.timedelta(seconds=200)), "ended_at": None, "thumbnail": "none"},
        {"id": "a4", "camera_id": "A", "type": "motion", "severity": "info", "occurred_at": _iso(t0 + dt.timedelta(seconds=900)), "ended_at": None, "thumbnail": "none"},
        {"id": "b1", "camera_id": "B", "type": "motion", "severity": "info", "occurred_at": _iso(t0 + dt.timedelta(seconds=30)), "ended_at": None, "thumbnail": "none"},
        {"id": "s1", "camera_id": None, "type": "system", "severity": "info", "occurred_at": _iso(t0 + dt.timedelta(seconds=40)), "ended_at": None, "thumbnail": "unavailable"},
        {"id": "s2", "camera_id": None, "type": "system", "severity": "info", "occurred_at": _iso(t0 + dt.timedelta(seconds=50)), "ended_at": None, "thumbnail": "unavailable"},
    ]
    w = group_windows(evs, 180)
    assert [x["count"] for x in w] == [1, 1, 1, 1, 3], "newest first: A late, s2, s1, B, then the merged A window"
    merged = w[-1]
    assert merged["event_ids"] == ["a1", "a2", "a3"] and merged["dominant_type"] == "person" and merged["severity"] == "alert"
    assert merged["thumbnail"] == "ready" and merged["thumbnail_event_id"] == "a2" and merged["acked"] is False
    assert merged["start"] == _iso(t0) and merged["end"] == _iso(t0 + dt.timedelta(seconds=200))
    assert all(x["count"] == 1 for x in w if x["camera_id"] is None), "system events are never merged"


def test_windows_api_ack_many_and_scope(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "Entrance"}).json()
    now = dt.datetime.now(dt.timezone.utc)
    for i, secs in enumerate((0, 60, 120, 700)):
        _insert(app, f"e{i}", cam["id"], now - dt.timedelta(seconds=1000 - secs))
    r = c.get("/api/v1/events/windows?gap=180")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["events_total"] == 4 and body["gap_seconds"] == 180
    counts = sorted(w["count"] for w in body["windows"])
    assert counts == [1, 3]
    big = next(w for w in body["windows"] if w["count"] == 3)
    assert big["camera_name"] == "Entrance" and big["acked"] is False and big["event_ids"] == ["e0", "e1", "e2"]
    # handle the window at once: every raw event is acked and audited; the raw events still exist
    a = c.post("/api/v1/events/ack-many", json={"event_ids": big["event_ids"] + ["missing"]})
    assert a.status_code == 200 and sorted(a.json()["acked"]) == ["e0", "e1", "e2"] and a.json()["skipped"] == ["missing"]
    again = next(w for w in c.get("/api/v1/events/windows?gap=180").json()["windows"] if w["count"] == 3)
    assert again["acked"] is True and again["acked_count"] == 3
    assert len(c.get("/api/v1/events?acked=true").json()["events"]) == 3
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'event.ack'").fetchone()[0] == 3
    # scope: an operator bound to a floor without any visible camera gets the same explicit denial as the list
    bind(c, settings, "ron", "operator", "floor", ids["floor3"])
    assert c.get("/api/v1/events/windows", headers=as_user("ron")).status_code == 403
    assert c.post("/api/v1/events/ack-many", json={"event_ids": ["e3"]}, headers=as_user("ron")).status_code == 403
