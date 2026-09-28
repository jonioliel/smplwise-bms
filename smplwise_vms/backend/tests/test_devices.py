"""Electricity and device control (CR-007): slice 1 - the floors → areas tree with counts, the building counts, one
area's per-domain cards, the unassigned bucket, the floor scope (as /ha/entities), the permission gate and the
absence of anything secret in the replies. Slice 2 - the devices.control permission (registration, floor scope,
allow-list extensions the devices-area cards need) and each card row's can_control flag; the action itself still
runs through the existing POST /ha/entities/{id}/actions (tests/test_ha.py, tests/test_ha_authority.py own that
route's confirmation/idempotency/audit behaviour - this file only proves devices.control reaches it)."""
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
from smplwise.services import ha_bridge, ha_client, ha_sync

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


def test_failed_registry_listing_keeps_the_previous_mirror(dev_app):
    """One failed floor / area registry call must not wipe the mirror until the next refresh (review finding)."""
    import asyncio

    app, s = dev_app
    sync = ha_sync.HaSync()
    sync.db, sync.settings = app.state.db, s

    def fake_call(fail_floors: str | None, fail_areas: bool):
        async def call(msg_type: str, **_kw):
            if msg_type == "config/floor_registry/list":
                if fail_floors == "raise":
                    raise RuntimeError("socket closed")
                if fail_floors == "refused":
                    return {"success": False, "error": {"code": "unknown_command"}}
                return {"success": True, "result": [{"floor_id": "new_floor", "name": "חדשה", "level": 5}]}
            if msg_type == "config/area_registry/list":
                return {"success": False, "error": {"code": "unauthorized"}} if fail_areas else {"success": True, "result": [{"area_id": "new_area", "name": "חדש", "floor_id": "new_floor"}]}
            return {"success": True, "result": []}
        return call

    def mirror():
        with app.state.db.connection() as conn:
            return ({r["floor_id"] for r in conn.execute("SELECT floor_id FROM ha_floors")}, {r["area_id"] for r in conn.execute("SELECT area_id FROM ha_areas")})

    before = mirror()
    assert before == ({"second", "ground"}, {"office", "lobby", "empty_room", "garden"})
    asyncio.run(sync._refresh_registry(fake_call("raise", True)))
    assert mirror() == before  # both listings failed: nothing touched
    asyncio.run(sync._refresh_registry(fake_call("refused", False)))
    assert mirror() == ({"second", "ground"}, {"new_area"})  # floors kept, areas rewritten
    asyncio.run(sync._refresh_registry(fake_call(None, False)))
    assert mirror() == ({"new_floor"}, {"new_area"})
    assert ha_sync._listing({"success": True, "result": "nope"}) is None and ha_sync._listing(None) is None


def test_dev_registry_endpoint_seeds_the_structure(settings):
    from smplwise.main import create_app

    c = TestClient(create_app(settings))
    r = c.post("/api/v1/ha/dev/registry", json={"entities": [{"entity_id": "light.x", "area_id": "a1"}, {"entity_id": "update.y", "area_id": "a1"}], "areas": [{"area_id": "a1", "name": "A", "floor_id": "f1"}], "floors": [{"floor_id": "f1", "name": "F", "level": 1}]})
    assert r.status_code == 200 and r.json() == {"entities": 1, "areas": 1, "floors": 1}
    c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "light.x", "state": "on", "attributes": {"brightness": 255}}]})
    t = c.get("/api/v1/devices/tree").json()
    assert t["floors"][0]["name"] == "F" and t["floors"][0]["areas"][0]["counts"]["lights_on"] == 1
    assert c.post("/api/v1/ha/dev/registry", json={"entities": [{"entity_id": "bad"}]}).status_code == 422
    assert c.post("/api/v1/ha/dev/registry", json={"areas": [{"name": "no id"}]}).status_code == 422
    assert c.post("/api/v1/ha/dev/registry", json={"floors": [{"name": "no id"}]}).status_code == 422
    # absent in the add-on: no dev router at all
    c2 = TestClient(create_app(replace(settings, in_addon=True, dev_user=None)))
    assert c2.post("/api/v1/ha/dev/registry", json={}).status_code in (401, 404)


# ---------------------------------------------------------------- slice 2: devices.control


def test_devices_control_permission_registered():
    """Registered like devices.read (T054/CR-007 s3), but for operator/editor/site_admin/system_admin only - a
    plain viewer reads the area, never acts on it. Not sensitive: a role binding alone is enough, no extra grant."""
    assert PERMISSION_LABELS["devices.control"]
    for role in ("operator", "editor", "site_admin", "system_admin"):
        assert "devices.control" in ROLES[role], role
    assert "devices.control" not in ROLES["viewer"] and "devices.control" not in ROLES["kiosk"]
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for role in contract["roles"]:
        assert ("devices.control" in role["permissions"]) == (role["id"] != "viewer"), role["id"]
    assert "devices.control" not in contract["sensitive_permissions_not_implied"]


def test_area_cards_carry_can_control(dev_app):
    app, s = dev_app
    c = TestClient(app)
    # the default identity (bootstrap system_admin) controls everything it can see
    a = c.get("/api/v1/devices/areas/lobby").json()
    rows = [r for card in a["cards"].values() for r in card["entities"]]
    assert rows and all(r["can_control"] is True for r in rows)
    # a plain viewer (devices.read only, no devices.control anywhere) reads but never controls
    bind(c, s, "vi", "viewer", "installation", "*")
    av = c.get("/api/v1/devices/areas/lobby", headers=as_user("vi")).json()
    assert all(r["can_control"] is False for card in av["cards"].values() for r in card["entities"])
    # a floor-scoped operator (devices.control on one VMS floor) controls only the entity placed there
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.office", "x": 0.2, "y": 0.2}).status_code == 201
    bind(c, s, "op2", "operator", "floor", ids["floor2"])
    office = c.get("/api/v1/devices/areas/office", headers=as_user("op2")).json()
    light = next(r for r in office["cards"]["lighting"]["entities"] if r["entity_id"] == "light.office")
    assert light["can_control"] is True
    # the lobby is on no VMS floor this operator holds devices.control on: read (installation-wide devices.read
    # is not bound here either, so it 404s) - the point is can_control never leaks past the floor scope
    bind(c, s, "op2", "viewer", "installation", "*")  # add installation-wide devices.read so the area itself loads
    lobby = c.get("/api/v1/devices/areas/lobby", headers=as_user("op2")).json()
    assert all(r["can_control"] is False for card in lobby["cards"].values() for r in card["entities"])


def test_single_entity_action_requires_devices_control(dev_app, monkeypatch):
    """The shared POST /ha/entities/{id}/actions route (routers/ha.py) accepts devices.control as well as the
    older ha.entity.control - either grant, at the entity's own floor scope - and every attempt is audited."""
    app, s = dev_app
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.0"}))
    calls: list[dict] = []

    def fake_execute(_settings, payload, timeout=15.0):
        calls.append(payload)
        ha_bridge.verify(secret, payload)
        return {"ok": True, "context_id": "ctx"}

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    body = lambda **kw: {"allowed_action_id": "switch.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": "req", "expires_at": "2099-01-01T00:00:00Z", **kw}  # noqa: E731
    # a viewer (devices.read only, no devices.control, no ha.entity.control) cannot act - 403, denied and audited
    bind(c, s, "vi", "viewer", "installation", "*")
    r = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=body(client_request_id="r1"), headers=as_user("vi"))
    assert r.status_code == 403 and not calls
    with app.state.db.connection() as conn:
        # the permission gate (rbac.require) audits under the permission name it checked, not "ha.action"
        row = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'ha.entity.control' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row["decision"] == "denied"
    # editor holds devices.control installation-wide (CR-007 slice 2) though never ha.entity.control - now enough
    bind(c, s, "ed", "editor", "installation", "*")
    r = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=body(client_request_id="r2"), headers=as_user("ed"))
    assert r.status_code == 202 and r.json()["status"] == "pending" and calls
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'ha.action' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row["decision"] == "allowed"
    # floor-scoped devices.control: reaches only the entity placed on that same VMS floor
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.office", "x": 0.2, "y": 0.2}).status_code == 201
    bind(c, s, "ed2", "editor", "floor", ids["floor2"])
    ok = c.post("/api/v1/ha/entities/light.office/actions", json=body(allowed_action_id="light.turn_on", client_request_id="r3"), headers=as_user("ed2"))
    assert ok.status_code == 202
    denied = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=body(client_request_id="r4"), headers=as_user("ed2"))
    assert denied.status_code == 403, "switch.lobby_sign is not placed on floor2: floor-scoped devices.control does not reach it"
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT decision, reason FROM audit_log WHERE action = 'ha.entity.control' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row["decision"] == "denied"


def test_new_allow_list_actions_validate_and_have_expected_risk(dev_app, monkeypatch):
    """The allow-list entries this slice adds for the devices-area cards: light.toggle, cover.set_cover_position,
    climate.set_fan_mode / turn_off, fan.set_percentage, media_player.turn_on / turn_off / volume_mute /
    media_play_pause - each validated (range / length / type) and none of them sensitive (locks and the alarm
    panel keep their own separate grant, untouched by this slice)."""
    app, s = dev_app
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.0"}))
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda _s, payload, timeout=15.0: (ha_bridge.verify(secret, payload), {"ok": True, "context_id": "ctx"})[1])
    body = lambda **kw: {"arguments": {}, "expected_state_version": None, "confirmation_grant": None, "expires_at": "2099-01-01T00:00:00Z", **kw}  # noqa: E731
    # cover.set_cover_position: 0-100 only
    assert c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id="cover.set_cover_position", arguments={"position": 150}, client_request_id="p1")).status_code == 422
    ok = c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id="cover.set_cover_position", arguments={"position": 40}, client_request_id="p2"))
    assert ok.status_code == 202 and ok.json()["status"] == "pending"
    # climate.set_fan_mode: bounded string
    assert c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_fan_mode", arguments={"fan_mode": "x" * 41}, client_request_id="p3")).status_code == 422
    assert c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_fan_mode", arguments={"fan_mode": "auto"}, client_request_id="p4")).status_code == 202
    # climate.turn_off: no arguments needed
    assert c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.turn_off", client_request_id="p5")).status_code == 202
    # fan.set_percentage: no fan.* fixture entity here, but the domain check alone refuses a climate entity
    assert c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="fan.set_percentage", arguments={"percentage": 50}, client_request_id="p6")).status_code == 422
    # media_player.volume_mute: boolean only, not the string "true"
    assert c.post("/api/v1/ha/entities/media_player.lobby_tv/actions", json=body(allowed_action_id="media_player.volume_mute", arguments={"is_volume_muted": "yes"}, client_request_id="p7")).status_code == 422
    ok2 = c.post("/api/v1/ha/entities/media_player.lobby_tv/actions", json=body(allowed_action_id="media_player.volume_mute", arguments={"is_volume_muted": True}, client_request_id="p8"))
    assert ok2.status_code == 202
    # media_player.media_play_pause and turn_on/turn_off: no arguments
    assert c.post("/api/v1/ha/entities/media_player.lobby_tv/actions", json=body(allowed_action_id="media_player.media_play_pause", client_request_id="p9")).status_code == 202
    assert c.post("/api/v1/ha/entities/media_player.lobby_tv/actions", json=body(allowed_action_id="media_player.turn_off", client_request_id="p10")).status_code == 202
    # light.toggle: domain mismatch on a switch entity is still refused
    assert c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=body(allowed_action_id="light.toggle", client_request_id="p11")).status_code == 422
    # the allow-list entries themselves: domain, service and risk class - none sensitive, none carrying a grant
    new_ids = {
        "light.toggle": ("light", "toggle"),
        "cover.set_cover_position": ("cover", "set_cover_position"),
        "climate.set_fan_mode": ("climate", "set_fan_mode"),
        "climate.turn_off": ("climate", "turn_off"),
        "fan.set_percentage": ("fan", "set_percentage"),
        "media_player.turn_on": ("media_player", "turn_on"),
        "media_player.turn_off": ("media_player", "turn_off"),
        "media_player.volume_mute": ("media_player", "volume_mute"),
        "media_player.media_play_pause": ("media_player", "media_play_pause"),
    }
    for aid, (domain, service) in new_ids.items():
        spec = ha_bridge.ACTIONS[aid]
        assert (spec["domain"], spec["service"]) == (domain, service), aid
        assert spec["risk"] == "routine" and spec["sensitive"] is False and not spec.get("grant"), aid
