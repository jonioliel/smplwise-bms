"""Door–camera–sensor correlation (T053): HA transitions of tracked entities become events; an event's neighbourhood
in time and space lists sensor transitions (measured), unlock commands (never proof) and camera events (as the NVR
said), names delayed clocks and missing states, and never touches a device."""
from __future__ import annotations

import json

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import correlation, ha_sync


def _st(entity_id: str, state: str, last_changed: str, **attrs):
    return {"entity_id": entity_id, "state": state, "last_changed": last_changed, "last_updated": last_changed, "attributes": attrs}


def _insert_camera_event(app, eid: str, camera_id: str, occurred: str, received: str | None = None, confidence: str = "measured") -> None:
    with app.state.db.connection() as conn:
        conn.execute(
            "INSERT INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (eid, "alertstream" if confidence == "measured" else "recording", "VMD", "motion", camera_id, 1, occurred, None, received or occurred, "inactive", 1, "info", confidence, json.dumps({}), f"t:{eid}", occurred),
        )


def test_tracked_kinds_and_transitions(settings):
    app = create_app(settings)
    assert correlation.tracked_kind("binary_sensor.x", "binary_sensor", "door") == "door"
    assert correlation.tracked_kind("binary_sensor.x", "binary_sensor", "motion") == "motion"
    assert correlation.tracked_kind("binary_sensor.front_door_contact", "binary_sensor", "power") == "door", "named like a door"
    assert correlation.tracked_kind("binary_sensor.x", "binary_sensor", "power", "דלת כניסה") == "door"
    assert correlation.tracked_kind("binary_sensor.x", "binary_sensor", "power", "לחצן") is None
    assert correlation.tracked_kind("lock.x", "lock", None) == "door" and correlation.tracked_kind("light.x", "light", None) is None
    with app.state.db.connection() as conn:
        assert correlation.record_transition(conn, None, _st("light.hall", "on", "2026-09-16T10:00:00+00:00")) is None
        assert correlation.record_transition(conn, _st("binary_sensor.d", "on", "x"), _st("binary_sensor.d", "on", "2026-09-16T10:00:00+00:00", device_class="door")) is None, "no change"
        e = correlation.record_transition(conn, _st("binary_sensor.d", "off", "x"), _st("binary_sensor.d", "on", "2026-09-16T10:00:00.250000+00:00", device_class="door", friendly_name="דלת אחורית"))
        assert e and e["source"] == "ha" and e["type"] == "door" and e["occurred_at"] == "2026-09-16T10:00:00Z" and e["severity"] == "alert" and e["confidence"] == "measured"
        assert e["details"] == {"entity_id": "binary_sensor.d", "name": "דלת אחורית", "domain": "binary_sensor", "device_class": "door", "from": "off", "to": "on", "availability": None, "area": None}
        assert correlation.record_transition(conn, _st("binary_sensor.d", "off", "x"), _st("binary_sensor.d", "on", "2026-09-16T10:00:00+00:00", device_class="door")) is None, "same transition twice is one event"
        lost = correlation.record_transition(conn, _st("binary_sensor.d", "on", "x"), _st("binary_sensor.d", "unavailable", "2026-09-16T10:05:00+00:00", device_class="door"))
        assert lost["details"]["availability"] == "lost" and lost["severity"] == "alert"
        closed = correlation.record_transition(conn, _st("lock.front", "unlocked", "x"), _st("lock.front", "locked", "2026-09-16T10:06:00+00:00"))
        assert closed["type"] == "door" and closed["severity"] == "info" and closed["raw_type"] == "lock"


def test_correlation_neighbourhood_certainty_and_notes(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    floor = ids["floor2"]
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
    cam_far = c.post("/api/v1/cameras", json={"channel": 2, "alias": "חניה"}).json()
    asset = c.post(f"/api/v1/floors/{floor}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, _st("binary_sensor.door", "off", "2026-09-16T09:00:00+00:00", device_class="door", friendly_name="דלת כניסה"))
        ha_sync.upsert_state(conn, _st("lock.front", "locked", "2026-09-16T09:00:00+00:00", friendly_name="מנעול כניסה"))
        ha_sync.upsert_state(conn, _st("binary_sensor.far", "off", "2026-09-16T09:00:00+00:00", device_class="door", friendly_name="דלת מחסן"))
        ha_sync.upsert_state(conn, _st("binary_sensor.pir", "unavailable", "2026-09-16T09:00:00+00:00", device_class="motion", friendly_name="גלאי לובי"))
    # placements: the camera, a door + lock + PIR beside it, a far door and a far camera
    place = lambda rt, rid, x, y: c.post(f"/api/v1/floors/{floor}/anchors", json={"resource_type": rt, "resource_id": rid, "x": x, "y": y, **({"layer_id": "doors"} if rt == "ha_entity" else {})}).json()  # noqa: E731
    place("camera", cam["id"], 0.30, 0.30)
    place("ha_entity", "binary_sensor.door", 0.34, 0.31)
    place("ha_entity", "lock.front", 0.35, 0.31)
    place("ha_entity", "binary_sensor.pir", 0.28, 0.35)
    place("ha_entity", "binary_sensor.far", 0.80, 0.80)
    place("camera", cam_far["id"], 0.85, 0.85)
    z = c.post(f"/api/v1/floors/{floor}/zones", json={"name": "לובי", "kind": "room", "polygon": [{"x": 0.2, "y": 0.2}, {"x": 0.5, "y": 0.2}, {"x": 0.5, "y": 0.5}, {"x": 0.2, "y": 0.5}]})
    assert z.status_code == 201, z.text

    t0 = "2026-09-16T10:00:00Z"
    _insert_camera_event(app, "cam1", cam["id"], t0)
    _insert_camera_event(app, "cam1b", cam["id"], "2026-09-16T10:00:40Z", confidence="inferred")
    _insert_camera_event(app, "camfar", cam_far["id"], "2026-09-16T10:00:20Z")
    _insert_camera_event(app, "camlate", cam["id"], "2026-09-16T10:10:00Z")
    with app.state.db.connection() as conn:
        correlation.record_transition(conn, _st("binary_sensor.door", "off", "x"), _st("binary_sensor.door", "on", "2026-09-16T10:00:10+00:00", device_class="door", friendly_name="דלת כניסה"))
        correlation.record_transition(conn, _st("binary_sensor.far", "off", "x"), _st("binary_sensor.far", "on", "2026-09-16T10:00:12+00:00", device_class="door", friendly_name="דלת מחסן"))
        correlation.record_transition(conn, _st("binary_sensor.door", "on", "x"), _st("binary_sensor.door", "off", "2026-09-16T10:03:00+00:00", device_class="door", friendly_name="דלת כניסה"))
        conn.execute(
            "INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via) VALUES ('a1','lock.front','lock.unlock','{}','u','joni','r1','confirmed','2026-09-16T09:59:55Z','unlocked','bridge')"
        )

    r = c.get("/api/v1/events/cam1/correlation")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["subject"] == {"kind": "camera", "id": cam["id"]} and d["spatial"] is True and d["location"]["zone"] == "לובי" and d["window_s"] == 120
    assert {e["entity_id"] for e in d["entities"]} == {"binary_sensor.door", "lock.front", "binary_sensor.pir"}, "the far door is neither near nor in the zone"
    assert [x["camera_id"] for x in d["cameras"]] == [cam["id"]]
    kinds = [(l["kind"], l.get("entity_id") or l.get("camera_id"), l["delta_s"], l["certainty"]) for l in d["links"]]
    assert kinds == [("command", "lock.front", -5.0, "command"), ("sensor", "binary_sensor.door", 10.0, "measured"), ("camera", cam["id"], 40.0, "inferred")], kinds
    cmd = d["links"][0]
    assert "אינה הוכחה" in cmd["note"] and cmd["status"] == "confirmed" and cmd["by"] == "joni"
    assert d["links"][2]["note"].startswith("נגזר")
    assert any(n["code"] == "missing_state" and "גלאי לובי" in n["text"] for n in d["notes"]) and not any(n["code"] == "delayed_clock" for n in d["notes"])
    assert "אינה מופעלת אוטומטית" in d["policy"] and d["event"]["camera_name"] == "כניסה"
    assert c.get("/api/v1/events/cam1/correlation?window=30").json()["links"][-1]["delta_s"] == 10.0, "window trims the inferred camera event and the later door close"

    # the sensor event as subject: its neighbourhood includes the camera's events
    door_evt = c.get("/api/v1/events?limit=50").json()["events"]
    sensor_id = next(e["id"] for e in door_evt if e["source"] == "ha" and e["details"]["entity_id"] == "binary_sensor.door" and e["details"]["to"] == "on")
    d2 = c.get(f"/api/v1/events/{sensor_id}/correlation").json()
    assert d2["subject"] == {"kind": "entity", "id": "binary_sensor.door"} and d2["location"]["zone"] == "לובי"
    assert [l["kind"] for l in d2["links"]] == ["camera", "command", "camera"], "ordered by distance in time: cam1 (−10 s), the unlock (−15 s), the inferred event (+30 s)"
    assert d2["links"][0]["event_id"] == "cam1" and d2["links"][0]["delta_s"] == -10.0

    # delayed clock is named; an unplaced camera falls back to time-only against every tracked sensor
    _insert_camera_event(app, "late", cam["id"], "2026-09-16T11:00:00Z", received="2026-09-16T11:02:00Z")
    assert any(n["code"] == "delayed_clock" and "120" in n["text"] for n in c.get("/api/v1/events/late/correlation").json()["notes"])
    cam3 = c.post("/api/v1/cameras", json={"channel": 3, "alias": "לא מוצבת"}).json()
    _insert_camera_event(app, "unplaced", cam3["id"], "2026-09-16T10:00:05Z")
    d3 = c.get("/api/v1/events/unplaced/correlation").json()
    assert d3["spatial"] is False and any(n["code"] == "unplaced" for n in d3["notes"])
    assert {e["entity_id"] for e in d3["entities"]} == {"binary_sensor.door", "lock.front", "binary_sensor.pir", "binary_sensor.far"}
    assert sorted(l.get("entity_id") for l in d3["links"] if l["kind"] == "sensor") == ["binary_sensor.door", "binary_sensor.far"]

    # permissions: a viewer bound to the floor sees the camera event's correlation without entity states
    assert c.get("/api/v1/events/nope/correlation").status_code == 404
    bind(c, settings, "ron", "viewer", "floor", floor)
    assert c.get("/api/v1/events/cam1/correlation", headers=as_user("ron")).status_code == 403, "viewers have no events.read"
    bind(c, settings, "dan", "operator", "floor", floor)
    dd = c.get("/api/v1/events/cam1/correlation", headers=as_user("dan")).json()
    assert dd["entities"] == [] and any(n["code"] == "entities_hidden" for n in dd["notes"]) and [l["kind"] for l in dd["links"]] == ["camera"], "floor-scoped operator: no installation-wide entity read"
