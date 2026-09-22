"""Spatial metadata search (T062): events by site / building / floor / zone through the current anchors, by source
and severity; facets describe which fields have data and why the others are empty; a filter that cannot match by
construction is reported as unsupported instead of an empty list that looks like "nothing happened"."""
from __future__ import annotations

import datetime as dt
import json

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import correlation, ha_sync


def _insert(app, eid: str, camera_id: str | None, occurred: str, etype: str = "motion", source: str = "alertstream", severity: str = "info", details: dict | None = None) -> None:
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, source, "VMD", etype, camera_id, 1, occurred, None, occurred, "inactive", 1, severity, "measured", json.dumps(details or {}, ensure_ascii=False), f"t:{eid}", occurred),
        )


def test_place_source_filters_facets_and_unsupported(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2, f3 = ids["floor2"], ids["floor3"]
    cam_a = c.post("/api/v1/cameras", json={"channel": 1, "alias": "לובי"}).json()
    cam_b = c.post("/api/v1/cameras", json={"channel": 2, "alias": "חניה"}).json()
    cam_c = c.post("/api/v1/cameras", json={"channel": 3, "alias": "לא מוצבת"}).json()
    for fid in (f2, f3):
        asset = c.post(f"/api/v1/floors/{fid}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{fid}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "camera", "resource_id": cam_a["id"], "x": 0.3, "y": 0.3})
    c.post(f"/api/v1/floors/{f3}/anchors", json={"resource_type": "camera", "resource_id": cam_b["id"], "x": 0.6, "y": 0.6})
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "binary_sensor.door", "state": "off", "last_changed": "2026-09-16T09:00:00+00:00", "attributes": {"device_class": "door", "friendly_name": "דלת לובי"}})
    c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "ha_entity", "resource_id": "binary_sensor.door", "x": 0.35, "y": 0.3, "layer_id": "doors"})
    lobby = c.post(f"/api/v1/floors/{f2}/zones", json={"name": "לובי", "kind": "room", "polygon": [{"x": 0.2, "y": 0.2}, {"x": 0.5, "y": 0.2}, {"x": 0.5, "y": 0.5}, {"x": 0.2, "y": 0.5}]}).json()
    empty = c.post(f"/api/v1/floors/{f2}/zones", json={"name": "מחסן", "kind": "service", "polygon": [{"x": 0.7, "y": 0.7}, {"x": 0.9, "y": 0.7}, {"x": 0.9, "y": 0.9}, {"x": 0.7, "y": 0.9}]}).json()

    now = dt.datetime.now(dt.timezone.utc)
    t = lambda m: (now - dt.timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    _insert(app, "a1", cam_a["id"], t(5))
    _insert(app, "a2", cam_a["id"], t(4), severity="alert")
    _insert(app, "b1", cam_b["id"], t(3))
    _insert(app, "c1", cam_c["id"], t(2))
    _insert(app, "s1", None, t(1), etype="coverage_gap", source="system", severity="alert")
    with app.state.db.connection() as conn:
        correlation.record_transition(conn, {"state": "off"}, {"entity_id": "binary_sensor.door", "state": "on", "last_changed": (now - dt.timedelta(minutes=1)).isoformat(), "attributes": {"device_class": "door", "friendly_name": "דלת לובי"}})

    ev_ids = lambda r: sorted(e["id"] for e in r.json()["events"])  # noqa: E731
    r = c.get(f"/api/v1/events?floor_id={f2}")
    assert r.status_code == 200 and r.json()["filters"]["applied"] == {"floor_id": f2} and r.json()["filters"]["unsupported"] == []
    door_id = next(e["id"] for e in r.json()["events"] if e["source"] == "ha")
    assert ev_ids(r) == sorted(["a1", "a2", door_id]), "the floor's camera and the door sensor placed on it"
    assert ev_ids(c.get(f"/api/v1/events?floor_id={f3}")) == ["b1"]
    assert ev_ids(c.get(f"/api/v1/events?building_id={ids['building']}")) == sorted(["a1", "a2", "b1", door_id])
    assert ev_ids(c.get(f"/api/v1/events?site_id={ids['site']}")) == sorted(["a1", "a2", "b1", door_id])
    assert ev_ids(c.get(f"/api/v1/events?zone_id={lobby['id']}")) == sorted(["a1", "a2", door_id])
    assert ev_ids(c.get(f"/api/v1/events?zone_id={lobby['id']}&source=ha")) == [door_id]
    assert ev_ids(c.get(f"/api/v1/events?floor_id={f2}&severity=alert")) == sorted(["a2", door_id]), "a door opening is an alert too"
    assert ev_ids(c.get("/api/v1/events?source=system")) == ["s1"]
    assert ev_ids(c.get("/api/v1/events?severity=alert")) == sorted(["a2", "s1", door_id])
    assert c.get("/api/v1/events?zone_id=nope").status_code == 404 and c.get("/api/v1/events?floor_id=nope").status_code == 404

    # a place with nothing placed, and a type this installation never produced, are named instead of a silent empty list
    r = c.get(f"/api/v1/events?zone_id={empty['id']}").json()
    assert r["events"] == [] and r["filters"]["unsupported"][0]["field"] == "zone_id" and "מחסן" in r["filters"]["unsupported"][0]["reason"]
    r = c.get("/api/v1/events?type=person").json()
    assert r["events"] == [] and r["filters"]["unsupported"] == [{"field": "type", "value": "person", "reason": r["filters"]["unsupported"][0]["reason"]}] and "VCA" in r["filters"]["unsupported"][0]["reason"]
    assert c.get("/api/v1/events?type=motion").json()["filters"]["unsupported"] == []

    # facets: what exists and why other fields are empty
    f = c.get("/api/v1/events/facets").json()
    assert f["days"] == 90 and {x["type"]: x["count"] for x in f["types"]} == {"motion": 4, "coverage_gap": 1, "door": 1}
    assert {x["source"]: x["count"] for x in f["sources"]} == {"alertstream": 4, "system": 1, "ha": 1}
    assert {x["severity"] for x in f["severities"]} == {"info", "alert"}
    unavailable = {x["type"]: x["reason"] for x in f["unavailable_types"]}
    assert "person" in unavailable and "vehicle" in unavailable and "motion" not in unavailable and "90" in unavailable["person"]
    site = f["places"][0]
    floors = {fl["id"]: fl for b in site["buildings"] for fl in b["floors"]}
    assert floors[f2]["cameras"] == 1 and floors[f2]["sensors"] == 1 and floors[f3]["cameras"] == 1 and floors[f3]["sensors"] == 0
    zones = {z["id"]: z for z in floors[f2]["zones"]}
    assert zones[lobby["id"]] == {"id": lobby["id"], "name": "לובי", "kind": "room", "cameras": 1, "sensors": 1} and zones[empty["id"]]["cameras"] == 0
    assert f["notes"] == [], "HA events and placed cameras exist"


def test_free_text_search(settings):
    """T062 (open corner, closed 0.1.77): `q` matches the camera's own name and the event's stored details - not
    just the structured filters - and combines with them (AND), and a range wider than one day works via from/to."""
    app = create_app(settings)
    c = TestClient(app)
    cam_a = c.post("/api/v1/cameras", json={"channel": 1, "alias": "מחסן אחורי"}).json()
    cam_b = c.post("/api/v1/cameras", json={"channel": 2, "alias": "כניסה צפונית"}).json()
    now = dt.datetime.now(dt.timezone.utc)
    t = lambda m: (now - dt.timedelta(minutes=m)).strftime("%Y-%m-%dT%H:%M:%SZ")  # noqa: E731
    _insert(app, "a1", cam_a["id"], t(5))
    _insert(app, "b1", cam_b["id"], t(4), etype="door", source="ha", details={"entity_id": "binary_sensor.kitchen_door", "friendly_name": "דלת מטבח"})
    _insert(app, "b2", cam_b["id"], t(3), severity="alert")
    old = (now - dt.timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    _insert(app, "old1", cam_a["id"], old)

    ev_ids = lambda r: sorted(e["id"] for e in r.json()["events"])  # noqa: E731

    # by camera alias (a substring, not the whole name)
    r = c.get("/api/v1/events?q=" + "מחסן")
    assert r.status_code == 200 and ev_ids(r) == ["a1"] and r.json()["filters"]["applied"]["q"] == "מחסן"

    # by the event's own stored details (an HA entity's friendly name), not just structured fields
    assert ev_ids(c.get("/api/v1/events?q=" + "מטבח")) == ["b1"]
    assert ev_ids(c.get("/api/v1/events?q=kitchen_door")) == ["b1"]

    # combines with an existing filter as AND, not OR
    assert ev_ids(c.get(f"/api/v1/events?q=" + "כניסה" + "&severity=alert")) == ["b2"]

    # no match is an empty, successful list - never an error
    r = c.get("/api/v1/events?q=" + "שם-שלא-קיים")
    assert r.status_code == 200 and r.json()["events"] == []

    # a range wider than one day (from/to) reaches an event a single day never would
    assert ev_ids(c.get(f"/api/v1/events?from={old}&to={t(0)}&camera_id={cam_a['id']}")) == sorted(["a1", "old1"])
    assert c.get("/api/v1/events/facets?days=1").json()["types"], "recent events counted"
