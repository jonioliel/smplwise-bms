"""NVRLESS-295: the sensor events list of an installation with no NVR. The list reads the stored events of source 'ha' through the
existing, permissioned GET /events (no new route); a sensor event also says where its entity is placed now (`place`: floor, building,
smallest containing zone, or None); the type / place / free-text filters work on them; and in the NVR-less mode the capability block
offers the sensor events but not the recorder's."""
from __future__ import annotations

import dataclasses
import datetime as dt

from conftest import as_user, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import correlation, ha_sync


def _door(conn, eid: str, name: str, old: str, new: str, minutes_ago: int, device_class: str = "door") -> None:
    at = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=minutes_ago)).isoformat()
    ha_sync.upsert_state(conn, {"entity_id": eid, "state": old, "last_changed": at, "attributes": {"device_class": device_class, "friendly_name": name}})
    correlation.record_transition(conn, {"state": old}, {"entity_id": eid, "state": new, "last_changed": at, "attributes": {"device_class": device_class, "friendly_name": name}})


def test_sensor_events_listing_place_and_filters(settings):
    app = create_app(dataclasses.replace(settings, nvr_host=None, nvr_user=None, nvr_password=None))
    c = TestClient(app)
    ids = seed_tree(c)
    f2 = ids["floor2"]
    asset = c.post(f"/api/v1/floors/{f2}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{f2}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    lobby = c.post(f"/api/v1/floors/{f2}/zones", json={"name": "לובי", "kind": "room", "polygon": [{"x": 0.2, "y": 0.2}, {"x": 0.5, "y": 0.2}, {"x": 0.5, "y": 0.5}, {"x": 0.2, "y": 0.5}]}).json()
    with app.state.db.connection() as conn:
        _door(conn, "binary_sensor.lobby_door", "דלת לובי", "off", "on", 6)
        _door(conn, "binary_sensor.hall_motion", "תנועה במסדרון", "off", "on", 4, device_class="motion")
        _door(conn, "binary_sensor.shed_door", "דלת מחסן", "off", "on", 2)
    c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "ha_entity", "resource_id": "binary_sensor.lobby_door", "x": 0.3, "y": 0.3, "layer_id": "doors"})
    c.post(f"/api/v1/floors/{f2}/anchors", json={"resource_type": "ha_entity", "resource_id": "binary_sensor.hall_motion", "x": 0.8, "y": 0.8, "layer_id": "doors"})

    r = c.get("/api/v1/events?source=ha")
    assert r.status_code == 200
    by_name = {e["camera_name"]: e for e in r.json()["events"]}
    assert set(by_name) == {"דלת לובי", "תנועה במסדרון", "דלת מחסן"}
    assert by_name["דלת לובי"]["place"]["zone"] == "לובי" and by_name["דלת לובי"]["place"]["floor_id"] == f2
    assert by_name["תנועה במסדרון"]["place"]["zone"] is None and by_name["תנועה במסדרון"]["place"]["floor_name"], "placed on the floor, in no room"
    assert by_name["דלת מחסן"]["place"] is None, "an entity that is not placed on any plan"
    assert all(e["thumbnail"] == "unavailable" for e in r.json()["events"]), "no clip and no picture without a recording"

    ev = lambda q: sorted(e["camera_name"] for e in c.get("/api/v1/events?source=ha" + q).json()["events"])  # noqa: E731
    assert ev("&type=motion") == ["תנועה במסדרון"]
    assert ev("&type=door") == ["דלת לובי", "דלת מחסן"]
    assert ev(f"&zone_id={lobby['id']}") == ["דלת לובי"]
    assert ev(f"&floor_id={f2}") == ["דלת לובי", "תנועה במסדרון"]
    assert ev("&q=מחסן") == ["דלת מחסן"]
    assert ev("&severity=alert") == ["דלת לובי", "דלת מחסן", "תנועה במסדרון"]


def test_sensor_events_need_events_read_and_respect_the_nvr_less_capabilities(settings):
    app = create_app(dataclasses.replace(settings, nvr_host=None, nvr_user=None, nvr_password=None))
    c = TestClient(app)
    with app.state.db.connection() as conn:
        _door(conn, "binary_sensor.front_door", "דלת כניסה", "off", "on", 3)
    me = c.get("/api/v1/me").json()
    caps = me["capabilities"]
    assert caps["events_recorder"] is False and caps["nvr"] is False  # events_ha follows the HA connection (test_installation_capabilities)
    assert [e["camera_name"] for e in c.get("/api/v1/events?source=ha").json()["events"]] == ["דלת כניסה"]
    # a caller with no events.read anywhere gets the audited 403 (the existing route's rule, unchanged)
    assert c.get("/api/v1/events?source=ha", headers=as_user("nobody")).status_code == 403
