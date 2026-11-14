"""Event page data (M27): one event with names, picture state and the camera's place on the floor (anchor,
floor, building, the smallest zone containing it); scope enforced per camera; the list's `acked` filter."""
from __future__ import annotations

import datetime as dt
import json

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def _insert_event(app, eid: str, camera_id: str | None, occurred: str) -> None:
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "alertstream", "VMD", "motion", camera_id, 1, occurred, None, occurred, "inactive", 1, "info", "measured", json.dumps({}), f"t:{eid}", occurred),
        )


def test_event_detail_location_scope_and_acked_filter(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "Entrance"}).json()
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.3, "y": 0.4, "rotation_degrees": 0, "field_of_view_degrees": 90})
    assert a.status_code == 201, a.text
    # two zones contain the pin; the smaller one wins
    big = [{"x": 0.05, "y": 0.05}, {"x": 0.9, "y": 0.05}, {"x": 0.9, "y": 0.9}, {"x": 0.05, "y": 0.9}]
    small = [{"x": 0.2, "y": 0.3}, {"x": 0.5, "y": 0.3}, {"x": 0.5, "y": 0.6}, {"x": 0.2, "y": 0.6}]
    assert c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "אגף", "kind": "zone", "polygon": big}).status_code == 201
    assert c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "לובי", "polygon": small}).status_code == 201
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    _insert_event(app, "ev-1", cam["id"], now)
    _insert_event(app, "ev-sys", None, now)

    d = c.get("/api/v1/events/ev-1")
    assert d.status_code == 200, d.text
    body = d.json()
    assert body["camera_name"] == "Entrance" and body["thumbnail"] in ("pending", "unavailable", "none", "ready") and body["timezone"]
    loc = body["location"]
    assert loc["floor_id"] == ids["floor2"] and loc["anchor_id"] == a.json()["id"] and loc["zone"] == "לובי" and loc["has_plan"] is True
    assert loc["floor_name"] and loc["building_name"] and abs(loc["x"] - 0.3) < 1e-6
    assert c.get("/api/v1/events/ev-sys").json()["location"] is None
    assert c.get("/api/v1/events/nope").status_code == 404

    # scope: an operator on another floor cannot read this camera's event; on the camera's floor they can
    bind(c, settings, "ron", "operator", "floor", ids["floor3"])
    assert c.get("/api/v1/events/ev-1", headers=as_user("ron")).status_code == 403
    bind(c, settings, "ron", "operator", "floor", ids["floor2"])
    assert c.get("/api/v1/events/ev-1", headers=as_user("ron")).status_code == 200

    # acked filter (list) after acknowledging
    assert c.post("/api/v1/events/ev-1/ack").status_code == 200
    acked = c.get("/api/v1/events?acked=true").json()["events"]
    assert [e["id"] for e in acked] == ["ev-1"]
    assert "ev-1" not in [e["id"] for e in c.get("/api/v1/events?unacked=true").json()["events"]]
