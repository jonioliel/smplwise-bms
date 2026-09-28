"""Electricity and device control, slice 1 (CR-007): the floors → areas tree with counts, the building counts, one
area's per-domain cards, the unassigned bucket, the floor scope (as /ha/entities), the permission gate and the
absence of anything secret in the replies."""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS
from smplwise.services import devices as svc
from smplwise.services import ha_client, ha_sync

ROOT = Path(__file__).resolve().parents[3]

STATES = [
    {"entity_id": "light.lobby", "state": "on", "attributes": {"friendly_name": "Lobby light", "brightness": 128, "color_mode": "brightness", "secret_token": "x"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "light.lobby_spot", "state": "off", "attributes": {"friendly_name": "Lobby spot"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "switch.lobby_sign", "state": "on", "attributes": {"friendly_name": "Sign"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "climate.lobby", "state": "cool", "attributes": {"friendly_name": "Lobby AC", "current_temperature": 25.5, "temperature": 22, "hvac_action": "cooling", "fan_mode": "auto"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "cover.lobby_blind", "state": "open", "attributes": {"friendly_name": "Blind", "current_position": 70, "device_class": "blind"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "lock.front", "state": "locked", "attributes": {"friendly_name": "Front door", "device_class": "lock"}, "last_changed": "2026-09-28T09:00:00+00:00", "last_updated": "2026-09-28T09:00:00+00:00"},
    {"entity_id": "binary_sensor.front_contact", "state": "off", "attributes": {"friendly_name": "Front contact", "device_class": "door"}, "last_changed": "2026-09-28T09:00:00+00:00", "last_updated": "2026-09-28T09:00:00+00:00"},
    {"entity_id": "camera.lobby", "state": "idle", "attributes": {"friendly_name": "Lobby cam"}, "last_changed": "2026-09-28T09:00:00+00:00", "last_updated": "2026-09-28T09:00:00+00:00"},
    {"entity_id": "media_player.lobby_tv", "state": "playing", "attributes": {"friendly_name": "Lobby TV", "media_title": "News", "source": "HDMI 1", "volume_level": 0.4}, "last_changed": "2026-09-28T09:00:00+00:00", "last_updated": "2026-09-28T09:00:00+00:00"},
    {"entity_id": "sensor.lobby_temp", "state": "23.5", "attributes": {"friendly_name": "Lobby temp", "unit_of_measurement": "°C", "device_class": "temperature"}, "last_changed": "2026-09-28T10:30:00+00:00", "last_updated": "2026-09-28T10:30:00+00:00"},
    {"entity_id": "binary_sensor.lobby_battery", "state": "off", "attributes": {"friendly_name": "Lobby battery", "device_class": "battery"}, "last_changed": "2026-09-28T10:30:00+00:00", "last_updated": "2026-09-28T10:30:00+00:00"},
    {"entity_id": "alarm_control_panel.house", "state": "armed_away", "attributes": {"friendly_name": "House alarm"}, "last_changed": "2026-09-28T10:30:00+00:00", "last_updated": "2026-09-28T10:30:00+00:00"},
    # second floor, one area
    {"entity_id": "light.office", "state": "off", "attributes": {"friendly_name": "Office light"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "cover.office", "state": "closed", "attributes": {"friendly_name": "Office shutter", "current_position": 0}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    # an area on no floor
    {"entity_id": "light.garden", "state": "on", "attributes": {"friendly_name": "Garden light", "brightness": 255}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    # no area at all
    {"entity_id": "switch.loose", "state": "off", "attributes": {"friendly_name": "Loose switch"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    # not part of this area: a script, a diagnostic sensor, a skipped domain
    {"entity_id": "script.night", "state": "off", "attributes": {"friendly_name": "Night script"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "sensor.lobby_rssi", "state": "-60", "attributes": {"friendly_name": "Lobby RSSI", "unit_of_measurement": "dBm"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "update.core", "state": "off", "attributes": {"friendly_name": "Core update"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
]

FLOORS = [
    {"floor_id": "second", "name": "קומה 2", "level": 2, "icon": "mdi:home-floor-2"},
    {"floor_id": "ground", "name": "קרקע", "level": 0, "icon": None},
]
AREAS = [
    {"area_id": "office", "name": "משרד", "floor_id": "second", "icon": "mdi:desk"},
    {"area_id": "lobby", "name": "לובי", "floor_id": "ground", "icon": "mdi:sofa"},
    {"area_id": "empty_room", "name": "חדר ריק", "floor_id": "ground", "icon": None},
    {"area_id": "garden", "name": "גינה", "floor_id": None, "icon": None},
]


def _reg(eid: str, area: str | None, category: str | None = None) -> dict:
    return {"entity_id": eid, "id": f"reg-{eid}", "area_id": area, "device_id": None, "entity_category": category}


ENTITY_REGISTRY = [
    *[_reg(e["entity_id"], "lobby") for e in STATES[:12]],
    _reg("light.office", "office"),
    _reg("cover.office", "office"),
    _reg("light.garden", "garden"),
    _reg("switch.loose", None),
    _reg("script.night", "lobby"),
    _reg("sensor.lobby_rssi", "lobby", "diagnostic"),
]


@pytest.fixture()
def dev_app(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    from smplwise.main import create_app

    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        maps = ha_client.registry_maps(ENTITY_REGISTRY, [], AREAS, FLOORS)
        ha_sync.apply_registry(conn, maps)
        ha_sync.apply_structure(conn, AREAS, FLOORS)
    return app, s


def test_permission_registered_like_map_read():
    assert PERMISSION_LABELS["devices.read"]
    for role in ("viewer", "operator", "editor", "site_admin", "system_admin"):
        assert "devices.read" in ROLES[role], role
    assert "devices.read" not in ROLES["kiosk"]
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for role in contract["roles"]:
        assert ("devices.read" in role["permissions"]) == (role["id"] != "kiosk"), role["id"]
    assert "devices.read" not in contract["sensitive_permissions_not_implied"]


def test_tree_floors_areas_counts_and_unassigned(dev_app):
    app, _ = dev_app
    c = TestClient(app)
    t = c.get("/api/v1/devices/tree").json()
    assert t["scoped"] is False
    # floors in level order, then the floorless bucket last; the empty area is still listed for a wide reader
    assert [f["floor_id"] for f in t["floors"]] == ["ground", "second", svc.NO_FLOOR]
    ground = t["floors"][0]
    assert ground["level"] == 0 and [a["area_id"] for a in ground["areas"]] == ["lobby", "empty_room"]
    lobby = ground["areas"][0]
    assert lobby["name"] == "לובי" and lobby["icon"] == "mdi:sofa" and lobby["has_camera"] is True
    cnt = lobby["counts"]
    assert (cnt["lights_on"], cnt["lights"]) == (1, 2)
    assert (cnt["switches_on"], cnt["switches"]) == (1, 1)
    assert (cnt["covers_open"], cnt["covers"]) == (1, 1)
    assert (cnt["climate_active"], cnt["climate"]) == (1, 1)
    assert (cnt["media_on"], cnt["media"]) == (1, 1)
    assert (cnt["locks_locked"], cnt["locks"]) == (1, 1)
    assert cnt["alarm"] == "armed_away" and cnt["cameras"] == 1 and cnt["sensors"] == 3
    # the script and the diagnostic sensor are not part of this area at all
    assert cnt["entities"] == 12
    assert ground["areas"][1]["counts"] == svc.empty_counts()
    assert ground["counts"]["lights"] == 2 and ground["counts"]["alarm"] == "armed_away"
    second = t["floors"][1]
    assert second["level"] == 2 and second["areas"][0]["counts"]["covers_open"] == 0 and second["areas"][0]["counts"]["covers"] == 1
    loose = t["floors"][2]
    assert loose["name"] == "ללא קומה" and [a["area_id"] for a in loose["areas"]] == ["garden"] and loose["areas"][0]["counts"]["lights_on"] == 1
    assert t["unassigned"]["counts"]["entities"] == 1 and t["unassigned"]["counts"]["switches"] == 1
    assert t["building"]["lights"] == 4 and t["building"]["lights_on"] == 2 and t["building"]["entities"] == 16
    assert t["sync"]["connected"] is True and "ha_url" not in t["sync"]

    b = c.get("/api/v1/devices/building").json()
    assert b["counts"] == t["building"] and b["floors"] == 2 and b["areas"] == 4 and b["unassigned"] == 1


def test_area_cards_fields_and_empty_cards(dev_app):
    app, _ = dev_app
    c = TestClient(app)
    a = c.get("/api/v1/devices/areas/lobby").json()
    assert a["area"] == {"area_id": "lobby", "name": "לובי", "icon": "mdi:sofa", "floor_id": "ground", "floor_name": "קרקע", "level": 0}
    assert [x["area_id"] for x in a["floor_areas"]] == ["lobby", "empty_room"]
    cards = a["cards"]
    assert list(cards) == list(svc.CARD_IDS)
    light = next(r for r in cards["lighting"]["entities"] if r["entity_id"] == "light.lobby")
    assert light["active"] is True and light["brightness_pct"] == 50 and light["color_mode"] == "brightness"
    assert next(r for r in cards["lighting"]["entities"] if r["entity_id"] == "light.lobby_spot")["brightness_pct"] is None
    assert cards["lighting"]["count"] == 2 and cards["lighting"]["active"] == 1
    clim = cards["climate"]["entities"][0]
    assert clim["hvac_mode"] == "cool" and clim["hvac_action"] == "cooling" and clim["current_temperature"] == 25.5 and clim["target_temperature"] == 22 and clim["fan_mode"] == "auto"
    cov = cards["covers"]["entities"][0]
    assert cov["position"] == 70 and cov["device_class"] == "blind" and cov["moving"] is False and cov["active"] is True
    sec = {r["entity_id"]: r for r in cards["security"]["entities"]}
    assert set(sec) == {"lock.front", "binary_sensor.front_contact", "camera.lobby", "alarm_control_panel.house"}
    assert sec["lock.front"]["kind"] == "lock" and sec["lock.front"]["locked"] is True
    assert sec["camera.lobby"]["kind"] == "camera" and sec["camera.lobby"]["has_camera"] is True and sec["camera.lobby"]["still_url"] is None
    assert sec["alarm_control_panel.house"]["armed"] is True
    assert sec["binary_sensor.front_contact"]["kind"] == "binary_sensor" and sec["binary_sensor.front_contact"]["device_class"] == "door"
    med = cards["media"]["entities"][0]
    assert med["media_title"] == "News" and med["source"] == "HDMI 1" and med["volume_pct"] == 40 and med["active"] is True
    sens = {r["entity_id"]: r for r in cards["sensors"]["entities"]}
    assert set(sens) == {"sensor.lobby_temp", "binary_sensor.lobby_battery"}  # the diagnostic RSSI sensor is out
    assert sens["sensor.lobby_temp"]["value"] == 23.5 and sens["sensor.lobby_temp"]["unit"] == "°C"
    assert sens["binary_sensor.lobby_battery"]["on"] is False
    # an area with nothing in it: every card present and empty, so the UI can say "אין התקן ... באזור הזה"
    e = c.get("/api/v1/devices/areas/empty_room").json()
    assert all(card["count"] == 0 and card["entities"] == [] for card in e["cards"].values())
    assert e["area"]["floor_name"] == "קרקע"
    # an area on no floor
    g = c.get("/api/v1/devices/areas/garden").json()
    assert g["area"]["floor_id"] == svc.NO_FLOOR and g["area"]["floor_name"] == "ללא קומה"
    assert c.get("/api/v1/devices/areas/nope").status_code == 404


def test_unassigned_bucket(dev_app):
    app, _ = dev_app
    c = TestClient(app)
    u = c.get("/api/v1/devices/areas/unassigned").json()
    assert u["area"]["area_id"] == "unassigned" and u["area"]["name"] == "ללא שיוך"
    assert [r["entity_id"] for r in u["cards"]["switches"]["entities"]] == ["switch.loose"]
    assert u["counts"]["entities"] == 1 and u["floor_areas"] == []


def test_floor_scope_follows_ha_entities(dev_app):
    app, s = dev_app
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.office", "x": 0.2, "y": 0.2}).status_code == 201
    bind(c, s, "ron", "viewer", "floor", ids["floor2"])
    # the floor-2 viewer: only the HA area that holds the placed entity, only that entity counted, nothing else named
    t = c.get("/api/v1/devices/tree", headers=as_user("ron")).json()
    assert t["scoped"] is True
    assert [f["floor_id"] for f in t["floors"]] == ["second"] and [a["area_id"] for a in t["floors"][0]["areas"]] == ["office"]
    assert t["floors"][0]["areas"][0]["counts"]["entities"] == 1 and t["floors"][0]["areas"][0]["counts"]["covers"] == 0
    assert t["building"]["entities"] == 1 and t["unassigned"]["counts"]["entities"] == 0
    a = c.get("/api/v1/devices/areas/office", headers=as_user("ron")).json()
    assert [r["entity_id"] for r in a["cards"]["lighting"]["entities"]] == ["light.office"] and a["cards"]["covers"]["entities"] == []
    assert c.get("/api/v1/devices/areas/lobby", headers=as_user("ron")).status_code == 404
    assert c.get("/api/v1/devices/areas/unassigned", headers=as_user("ron")).status_code == 404
    assert c.get("/api/v1/devices/building", headers=as_user("ron")).json()["counts"]["lights"] == 1
    # a viewer on the other floor sees an empty tree, not a refusal
    bind(c, s, "vi", "viewer", "floor", ids["floor3"])
    t3 = c.get("/api/v1/devices/tree", headers=as_user("vi")).json()
    assert t3["floors"] == [] and t3["building"]["entities"] == 0


def test_permission_gate(dev_app):
    app, s = dev_app
    c = TestClient(app)
    c.get("/api/v1/me", headers=as_user("nobody"))
    for path in ("/api/v1/devices/tree", "/api/v1/devices/building", "/api/v1/devices/areas/lobby"):
        r = c.get(path, headers=as_user("nobody"))
        assert r.status_code == 403, path
    ids = seed_tree(c)
    bind(c, s, "wall", "kiosk", "floor", ids["floor2"])
    assert c.get("/api/v1/devices/tree", headers=as_user("wall")).status_code == 403
    bind(c, s, "op", "operator", "installation", "*")
    assert c.get("/api/v1/devices/tree", headers=as_user("op")).status_code == 200


def test_replies_carry_no_secrets(dev_app):
    app, _ = dev_app
    c = TestClient(app)
    for path in ("/api/v1/devices/tree", "/api/v1/devices/building", "/api/v1/devices/areas/lobby", "/api/v1/devices/areas/unassigned"):
        text = c.get(path).text
        for needle in ("secret", "ha.local", "8123", "token", "attributes_json"):
            assert needle not in text, (path, needle)


def test_structure_mirror_and_fallback_from_entity_rows(dev_app):
    app, _ = dev_app
    c = TestClient(app)
    # the mirror is rewritten whole: a floor gone from HA disappears, an area moved to another floor moves
    with app.state.db.connection() as conn:
        ha_sync.apply_structure(conn, [{"area_id": "lobby", "name": "לובי", "floor_id": "second"}], [{"floor_id": "second", "name": "קומה 2", "level": 2}])
    t = c.get("/api/v1/devices/tree").json()
    assert [f["floor_id"] for f in t["floors"]] == ["second", "ground", svc.NO_FLOOR]  # "ground" survives only through the entity rows (level unknown)
    assert [a["area_id"] for a in t["floors"][0]["areas"]] == ["lobby", "office"]
    assert t["floors"][1]["level"] is None
    # with no mirror at all the tree still comes from the entity rows (a catalogue synced before 0025)
    with app.state.db.connection() as conn:
        ha_sync.apply_structure(conn, [], [])
    t = c.get("/api/v1/devices/tree").json()
    names = {a["area_id"]: a["name"] for f in t["floors"] for a in f["areas"]}
    assert names == {"lobby": "לובי", "office": "משרד", "garden": "גינה"}


def test_dev_registry_endpoint_seeds_the_structure(settings):
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    r = c.post("/api/v1/ha/dev/registry", json={"entities": [{"entity_id": "light.x", "area_id": "a1"}, {"entity_id": "update.y", "area_id": "a1"}], "areas": [{"area_id": "a1", "name": "A", "floor_id": "f1"}], "floors": [{"floor_id": "f1", "name": "F", "level": 1}]})
    assert r.status_code == 200 and r.json() == {"entities": 1, "areas": 1, "floors": 1}
    c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "light.x", "state": "on", "attributes": {"brightness": 255}}]})
    t = c.get("/api/v1/devices/tree").json()
    assert t["floors"][0]["name"] == "F" and t["floors"][0]["areas"][0]["counts"]["lights_on"] == 1
    assert c.post("/api/v1/ha/dev/registry", json={"entities": [{"entity_id": "bad"}]}).status_code == 422
    # absent in the add-on: no dev router at all
    c2 = TestClient(create_app(replace(settings, in_addon=True, dev_user=None)))
    assert c2.post("/api/v1/ha/dev/registry", json={}).status_code in (401, 404)
