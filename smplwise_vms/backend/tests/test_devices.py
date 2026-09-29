"""Electricity and device control (CR-007): slice 1 - the floors → areas tree with counts, the building counts, one
area's per-domain cards, the unassigned bucket, the floor scope (as /ha/entities), the permission gate and the
absence of anything secret in the replies. Slice 2 - the devices.control permission (registration, floor scope,
allow-list extensions the devices-area cards need) and each card row's can_control flag; the action itself still
runs through the existing POST /ha/entities/{id}/actions (tests/test_ha.py, tests/test_ha_authority.py own that
route's confirmation/idempotency/audit behaviour - this file only proves devices.control reaches it)."""
from __future__ import annotations

import ast
import json
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS
from smplwise.services import devices as svc
from smplwise.services import ha_bridge, ha_client, ha_scope, ha_sync

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
            # the entity listing answers as HA does (an EMPTY one is now refused as a bad answer, not applied as a wipe)
            return {"success": True, "result": ENTITY_REGISTRY if msg_type == "config/entity_registry/list" else []}
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
    assert r.status_code == 200 and r.json() == {"entities": 1, "areas": 1, "floors": 1, "changed": True}
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


def _pair(c, monkeypatch):
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.2.4"}))
    calls: list[dict] = []

    def fake_execute(_settings, payload, timeout=15.0):
        calls.append(payload)
        ha_bridge.verify(secret, payload)
        return {"ok": True, "context_id": "ctx"}

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    return calls


def _body(**kw):
    return {"allowed_action_id": "switch.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": "req", "expires_at": "2099-01-01T00:00:00Z", **kw}


def _devices_control_only_role(c) -> str:
    """A custom role holding devices.read + devices.control and nothing else: the "devices.control-only caller"."""
    r = c.post("/api/v1/access/roles", json={"name": "שליטה בהתקנים בלבד", "permissions": ["devices.read", "devices.control"]})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _place(c, floor_id: str, entity_id: str, x: float = 0.2) -> None:
    assert c.post(f"/api/v1/floors/{floor_id}/anchors", json={"resource_type": "ha_entity", "resource_id": entity_id, "x": x, "y": 0.2}).status_code == 201


def _publish_plan(c, floor_id: str) -> None:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")


def test_devices_control_permission_registered():
    """Registered like devices.read (CR-007 s3), granted by default to operator, site_admin and system_admin only
    (coordinator ruling on the slice-2 review, 2026-09-28: NOT editor - the recorded decision that editor holds no
    control permission stands; not viewer, not kiosk). Not sensitive: a role binding alone is enough."""
    assert PERMISSION_LABELS["devices.control"]
    holders = {"operator", "site_admin", "system_admin"}
    for role in ("viewer", "kiosk", "operator", "editor", "site_admin", "system_admin"):
        assert ("devices.control" in ROLES[role]) == (role in holders), role
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for role in contract["roles"]:
        assert ("devices.control" in role["permissions"]) == (role["id"] in holders), role["id"]
    assert "devices.control" not in contract["sensitive_permissions_not_implied"]


def test_area_cards_carry_can_control(dev_app):
    app, s = dev_app
    c = TestClient(app)
    # the default identity (bootstrap system_admin) controls everything it can see
    a = c.get("/api/v1/devices/areas/lobby").json()
    rows = [r for card in a["cards"].values() for r in card["entities"]]
    assert rows and all(r["can_control"] is True for r in rows)
    # a plain viewer (devices.read only) and an editor (devices.read, no control of any kind) read but never control
    bind(c, s, "vi", "viewer", "installation", "*")
    bind(c, s, "ed", "editor", "installation", "*")
    for who in ("vi", "ed"):
        av = c.get("/api/v1/devices/areas/lobby", headers=as_user(who)).json()
        assert all(r["can_control"] is False for card in av["cards"].values() for r in card["entities"]), who
    # a devices.control-only caller: the everyday domains yes, the lock / alarm panel never
    role = _devices_control_only_role(c)
    bind(c, s, "dc", role, "installation", "*")
    ad = c.get("/api/v1/devices/areas/lobby", headers=as_user("dc")).json()
    flags = {r["entity_id"]: r["can_control"] for card in ad["cards"].values() for r in card["entities"]}
    assert flags["light.lobby"] and flags["switch.lobby_sign"] and flags["cover.lobby_blind"] and flags["climate.lobby"] and flags["media_player.lobby_tv"]
    assert flags["lock.front"] is False and flags["alarm_control_panel.house"] is False
    # a floor-scoped operator (devices.control on one VMS floor) controls only the entity placed there
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    _place(c, ids["floor2"], "light.office")
    bind(c, s, "op2", "operator", "floor", ids["floor2"])
    office = c.get("/api/v1/devices/areas/office", headers=as_user("op2")).json()
    light = next(r for r in office["cards"]["lighting"]["entities"] if r["entity_id"] == "light.office")
    assert light["can_control"] is True
    bind(c, s, "op2", "viewer", "installation", "*")  # add installation-wide devices.read so the lobby itself loads
    lobby = c.get("/api/v1/devices/areas/lobby", headers=as_user("op2")).json()
    assert all(r["can_control"] is False for card in lobby["cards"].values() for r in card["entities"])


def test_single_entity_action_requires_devices_control(dev_app, monkeypatch):
    """The shared POST /ha/entities/{id}/actions route (routers/ha.py) accepts devices.control as well as the older
    ha.entity.control - either grant, at the entity's own floor scope - and every attempt is audited."""
    app, s = dev_app
    c = TestClient(app)
    calls = _pair(c, monkeypatch)
    # a viewer and an editor (neither devices.control nor ha.entity.control) cannot act - 403, denied and audited
    for i, (who, role) in enumerate((("vi", "viewer"), ("ed", "editor"))):
        bind(c, s, who, role, "installation", "*")
        r = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=_body(client_request_id=f"d{i}"), headers=as_user(who))
        assert r.status_code == 403 and not calls, who
        with app.state.db.connection() as conn:
            row = conn.execute("SELECT decision FROM audit_log WHERE action = 'ha.entity.control' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert row["decision"] == "denied", who
    # a devices.control-only caller reaches the everyday domains
    bind(c, s, "dc", _devices_control_only_role(c), "installation", "*")
    r = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=_body(client_request_id="r2"), headers=as_user("dc"))
    assert r.status_code == 202 and r.json()["status"] == "pending" and calls
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT decision FROM audit_log WHERE action = 'ha.action' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row["decision"] == "allowed"
    # floor-scoped devices.control (operator bound to floor2): only the entity placed on that same VMS floor
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    _place(c, ids["floor2"], "light.office")
    bind(c, s, "op2", "operator", "floor", ids["floor2"])
    assert c.post("/api/v1/ha/entities/light.office/actions", json=_body(allowed_action_id="light.turn_on", client_request_id="r3"), headers=as_user("op2")).status_code == 202
    denied = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=_body(client_request_id="r4"), headers=as_user("op2"))
    assert denied.status_code == 403, "switch.lobby_sign is not placed on floor2: floor-scoped control does not reach it"


def test_devices_control_never_reaches_locks_alarm_sirens_scripts_scenes_buttons(dev_app, monkeypatch):
    """BLOCKER from the slice-2 review: devices.control must not widen into the risky domains. A caller who holds
    only devices.control gets an audited 403 on lock / alarm / siren / script / scene / button - before the arguments,
    the confirmation or the bridge are even looked at - while ha.entity.control keeps its old rights on them."""
    app, s = dev_app
    c = TestClient(app)
    calls = _pair(c, monkeypatch)
    bind(c, s, "dc", _devices_control_only_role(c), "installation", "*")
    risky = [
        ("lock.front", "lock.lock"),
        ("alarm_control_panel.house", "alarm_control_panel.alarm_arm_away"),
        ("siren.yard", "siren.turn_on"),
        ("script.night", "script.turn_on"),
        ("scene.evening", "scene.turn_on"),
        ("button.doorbell", "button.press"),
    ]
    for i, (eid, aid) in enumerate(risky):
        with app.state.db.connection() as conn:
            before = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.entity.control' AND decision = 'denied'").fetchone()[0]
        r = c.post(f"/api/v1/ha/entities/{eid}/actions", json=_body(allowed_action_id=aid, confirmation_grant="confirmed", client_request_id=f"k{i}"), headers=as_user("dc"))
        assert r.status_code == 403, (aid, r.status_code, r.text)
        with app.state.db.connection() as conn:
            after = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.entity.control' AND decision = 'denied'").fetchone()[0]
        assert after == before + 1, f"{aid}: the denial must be audited"
    assert not calls, "nothing reached the bridge"
    # ha.entity.control (the bootstrap system_admin) keeps its old rights on the same entities
    r = c.post("/api/v1/ha/entities/lock.front/actions", json=_body(allowed_action_id="lock.lock", client_request_id="ok1"))
    assert r.status_code == 202 and calls[-1]["service"] == "lock"
    r = c.post("/api/v1/ha/entities/script.night/actions", json=_body(allowed_action_id="script.turn_on", confirmation_grant="confirmed", client_request_id="ok2"))
    assert r.status_code == 202 and calls[-1]["domain"] == "script"


def test_devices_control_never_reaches_door_class_or_door_layer_covers(dev_app, monkeypatch):
    """CR-007 slice 4 review (MEDIUM 2): POST /ha/entities/{id}/actions checked only the domain, so a
    devices.control-only caller could open a gate cover or a door-release switch - exactly what the bulk path
    already refuses to touch. A door-class cover (device_class door/garage/gate) or anything on the map's door
    layer is now refused under devices.control too, audited as ha.entity.control's own denial is; ha.entity.control
    keeps its old, broader rights on the same entities."""
    app, s = dev_app
    c = TestClient(app)
    calls = _pair(c, monkeypatch)
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "cover.lobby_gate", "state": "closed", "attributes": {"friendly_name": "Gate", "device_class": "gate"}}]}).status_code == 200
    bind(c, s, "dc", _devices_control_only_role(c), "installation", "*")
    with app.state.db.connection() as conn:
        before = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.entity.control' AND decision = 'denied'").fetchone()[0]
    r = c.post("/api/v1/ha/entities/cover.lobby_gate/actions", json=_body(allowed_action_id="cover.open_cover", confirmation_grant="confirmed", client_request_id="gate1"), headers=as_user("dc"))
    assert r.status_code == 403, r.text
    with app.state.db.connection() as conn:
        after = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.entity.control' AND decision = 'denied'").fetchone()[0]
    assert after == before + 1, "the refusal must be audited"
    assert not calls, "nothing reached the bridge"
    # ha.entity.control (the bootstrap system_admin) keeps its old rights on the same door-class cover
    ok = c.post("/api/v1/ha/entities/cover.lobby_gate/actions", json=_body(allowed_action_id="cover.open_cover", confirmation_grant="confirmed", client_request_id="gate2"))
    assert ok.status_code == 202 and calls[-1]["domain"] == "cover"
    # a switch placed on the map's door layer is refused the same way under devices.control
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "switch.lobby_sign", "x": 0.3, "y": 0.3, "layer_id": "doors"}).status_code == 201
    r2 = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json=_body(allowed_action_id="switch.turn_off", client_request_id="relay1"), headers=as_user("dc"))
    assert r2.status_code == 403, r2.text


def test_new_allow_list_actions_validate_and_have_expected_risk(dev_app, monkeypatch):
    """The allow-list entries this slice adds for the devices-area cards: cover.set_cover_position (attention, like
    open/close - coordinator ruling), climate.set_fan_mode / turn_off, fan.set_percentage, media_player.turn_on /
    turn_off / volume_mute - each validated (range / length / type). light.toggle and media_play_pause were dropped
    in the review round (the cards use turn_on/turn_off and media_play/media_pause, which the state confirms)."""
    app, s = dev_app
    c = TestClient(app)
    _pair(c, monkeypatch)
    body = lambda **kw: {"arguments": {}, "expected_state_version": None, "confirmation_grant": None, "expires_at": "2099-01-01T00:00:00Z", **kw}  # noqa: E731
    # cover.set_cover_position: 0-100 only, and a movement needs the explicit confirmation like open/close
    assert c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id="cover.set_cover_position", arguments={"position": 150}, confirmation_grant="confirmed", client_request_id="p1")).status_code == 422
    r = c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id="cover.set_cover_position", arguments={"position": 40}, client_request_id="p2a"))
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"
    ok = c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id="cover.set_cover_position", arguments={"position": 40}, confirmation_grant="confirmed", client_request_id="p2"))
    assert ok.status_code == 202 and ok.json()["status"] == "pending" and ok.json()["confirmation"] == "attribute" and ok.json()["expected_state"] == "current_position=40"
    # climate.set_fan_mode: bounded string, confirmed from the fan_mode attribute
    assert c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_fan_mode", arguments={"fan_mode": "x" * 41}, client_request_id="p3")).status_code == 422
    r = c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_fan_mode", arguments={"fan_mode": "high"}, client_request_id="p4"))
    assert r.status_code == 202 and r.json()["expected_state"] == "fan_mode=high"
    # climate.turn_off: no arguments, the state confirms it
    r = c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.turn_off", client_request_id="p5"))
    assert r.status_code == 202 and r.json()["confirmation"] == "state"
    assert c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="fan.set_percentage", arguments={"percentage": 50}, client_request_id="p6")).status_code == 422
    # media_player.volume_mute: boolean only; the TV fixture reports no is_volume_muted, so it is honestly "none"
    assert c.post("/api/v1/ha/entities/media_player.lobby_tv/actions", json=body(allowed_action_id="media_player.volume_mute", arguments={"is_volume_muted": "yes"}, client_request_id="p7")).status_code == 422
    r = c.post("/api/v1/ha/entities/media_player.lobby_tv/actions", json=body(allowed_action_id="media_player.volume_mute", arguments={"is_volume_muted": True}, client_request_id="p8"))
    assert r.status_code == 202 and r.json()["confirmation"] == "none" and r.json()["expected_state"] is None
    assert c.post("/api/v1/ha/entities/media_player.lobby_tv/actions", json=body(allowed_action_id="media_player.turn_off", client_request_id="p10")).status_code == 202
    assert "light.toggle" not in ha_bridge.ACTIONS and "media_player.media_play_pause" not in ha_bridge.ACTIONS
    new_ids = {
        "cover.set_cover_position": ("cover", "set_cover_position", "attention"),
        "climate.set_fan_mode": ("climate", "set_fan_mode", "routine"),
        "climate.turn_off": ("climate", "turn_off", "routine"),
        "fan.set_percentage": ("fan", "set_percentage", "routine"),
        "media_player.turn_on": ("media_player", "turn_on", "routine"),
        "media_player.turn_off": ("media_player", "turn_off", "routine"),
        "media_player.volume_mute": ("media_player", "volume_mute", "routine"),
    }
    for aid, (domain, service, risk) in new_ids.items():
        spec = ha_bridge.ACTIONS[aid]
        assert (spec["domain"], spec["service"], spec["risk"]) == (domain, service, risk), aid
        assert not spec.get("grant"), aid
    # same risk for every control that moves a cover
    assert {ha_bridge.ACTIONS[a]["risk"] for a in ("cover.open_cover", "cover.close_cover", "cover.set_cover_position")} == {"attention"}


def _bridge_allowed_services(path: Path) -> set[tuple[str, str]]:
    """ALLOWED_SERVICES from the bridge integration's source, read with ast (Home Assistant is not importable here)."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "ALLOWED_SERVICES" for t in node.targets):
            return set(ast.literal_eval(node.value))
    raise AssertionError(f"ALLOWED_SERVICES not found in {path}")


def test_every_allow_listed_action_is_allowed_by_the_bridge():
    """BLOCKER from the slice-2 review: the add-on's allow-list grew and the HA-side bridge's did not, so every new
    action answered service_not_allowed on a real Home Assistant. This drift is now caught here: each action in
    services/ha_bridge.ACTIONS has its (domain, service) in the bridge's ALLOWED_SERVICES - in both copies."""
    want = {(a["domain"], a["service"]) for a in ha_bridge.ACTIONS.values()}
    for copy in (ROOT / "custom_components" / "smplwise_bridge", ROOT / "smplwise_vms" / "integration" / "smplwise_bridge"):
        have = _bridge_allowed_services(copy / "__init__.py")
        assert not want - have, f"{copy}: missing in the bridge allow-list: {sorted(want - have)}"
    manifest = json.loads((ROOT / "custom_components" / "smplwise_bridge" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["version"] == "0.2.5", "a new bridge allow-list ships as a new bridge version (HA must restart to load it)"


def test_attribute_confirmation_never_compares_the_state_to_the_argument(dev_app, monkeypatch):
    """BLOCKER from the slice-2 review: a cover's position, a fan's percentage and a climate fan mode were
    "expected" as the entity's state ("40", "50", "auto") and so always failed. They are confirmed from the attribute
    that reports them (within a tolerance), only after the request; nothing observable = "none", never confirmed."""
    app, s = dev_app
    c = TestClient(app)
    _pair(c, monkeypatch)

    def run(eid: str, aid: str, args: dict, rid: str) -> dict:
        r = c.post(f"/api/v1/ha/entities/{eid}/actions", json=_body(allowed_action_id=aid, arguments=args, confirmation_grant="confirmed", client_request_id=rid))
        assert r.status_code == 202, r.text
        return r.json()

    def poll(aid: str) -> dict:
        return c.get(f"/api/v1/ha/actions/{aid}").json()

    def state(eid: str, st: str, **attrs) -> None:
        assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": eid, "state": st, "attributes": attrs}]}).status_code == 200

    # cover: the state "open" alone (position still 70) is not the position asked for; 39 is within the tolerance
    a = run("cover.lobby_blind", "cover.set_cover_position", {"position": 40}, "c1")
    assert poll(a["id"])["status"] == "pending"
    state("cover.lobby_blind", "open", current_position=70)
    assert poll(a["id"])["status"] == "pending"
    state("cover.lobby_blind", "open", current_position=39)
    got = poll(a["id"])
    assert got["status"] == "confirmed" and got["confirmation"] == "attribute" and got["observed_state"] == "current_position=39"
    # fan: a 3-speed fan asked for 50 runs at speed 2 (HA rounds up to the next step): 67 confirms, 100 does not
    state("fan.hall", "on", percentage=33, percentage_step=33.3333)
    f = run("fan.hall", "fan.set_percentage", {"percentage": 50}, "f1")
    state("fan.hall", "on", percentage=100, percentage_step=33.3333)
    assert poll(f["id"])["status"] == "pending"
    state("fan.hall", "on", percentage=67, percentage_step=33.3333)
    assert poll(f["id"])["status"] == "confirmed"
    # climate fan mode: the state stays "cool"; the fan_mode attribute is what confirms
    m = run("climate.lobby", "climate.set_fan_mode", {"fan_mode": "high"}, "m1")
    state("climate.lobby", "cool", fan_mode="auto", temperature=22)
    assert poll(m["id"])["status"] == "pending"
    state("climate.lobby", "cool", fan_mode="high", temperature=22)
    assert poll(m["id"])["status"] == "confirmed"
    # target temperature: confirmed from the `temperature` attribute...
    t = run("climate.lobby", "climate.set_temperature", {"temperature": 23.5}, "t1")
    assert t["confirmation"] == "attribute"
    state("climate.lobby", "cool", fan_mode="high", temperature=23.5)
    assert poll(t["id"])["status"] == "confirmed"
    # ...and "none" when the entity reports no single target (heat_cool with a low/high range): sent, not confirmed
    state("climate.lobby", "heat_cool", target_temp_low=20, target_temp_high=24)
    t2 = run("climate.lobby", "climate.set_temperature", {"temperature": 21}, "t2")
    assert t2["confirmation"] == "none" and t2["expected_state"] is None
    # stop has nothing observable either
    st = run("cover.lobby_blind", "cover.stop_cover", {}, "s1")
    assert st["confirmation"] == "none"
    # pure helper: exact matches for strings and booleans, tolerance for numbers, 0 = off/closed without the attribute
    assert ha_bridge.attribute_reached("media_player.volume_mute", {"is_volume_muted": True}, "on", {"is_volume_muted": True})
    assert not ha_bridge.attribute_reached("media_player.volume_mute", {"is_volume_muted": True}, "on", {"is_volume_muted": 1})
    assert ha_bridge.attribute_reached("fan.set_percentage", {"percentage": 0}, "off", {})
    assert not ha_bridge.attribute_reached("cover.set_cover_position", {"position": 40}, "open", {"current_position": 43})


def test_fan_speed_confirms_only_the_step_home_assistant_maps_the_request_to(dev_app, monkeypatch):
    """Re-review nit: a full-step tolerance let a 3-speed fan (step 33.3) asked for 50 be "confirmed" at 33 as well as
    at 67. HA maps a percentage UP to the next speed step, so only that step (66 or 67 - HA's own rounding) confirms;
    a fan that stayed at 33 stays pending and times out honestly."""
    three = {"percentage_step": 33.333333333333336}
    reached = lambda pct, got: ha_bridge.attribute_reached("fan.set_percentage", {"percentage": pct}, "on", {**three, "percentage": got})  # noqa: E731
    assert not reached(50, 33) and reached(50, 67) and reached(50, 66) and not reached(50, 100)
    assert reached(34, 67) and not reached(34, 33) and reached(33, 33) and reached(100, 100) and reached(66, 67) and reached(67, 100)  # 67 > 66.7: HA runs speed 3
    assert not reached(10, 0) and reached(10, 33)
    # no step reported: the request itself, within a point
    assert ha_bridge.attribute_reached("fan.set_percentage", {"percentage": 50}, "on", {"percentage": 50})
    assert not ha_bridge.attribute_reached("fan.set_percentage", {"percentage": 50}, "on", {"percentage": 33})
    # through the route: a fan that stays at 33 after a request for 50 is never confirmed by a later attribute push
    app, s = dev_app
    c = TestClient(app)
    _pair(c, monkeypatch)
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "fan.hall", "state": "on", "attributes": {"percentage": 33, **three}}]}).status_code == 200
    a = c.post("/api/v1/ha/entities/fan.hall/actions", json=_body(allowed_action_id="fan.set_percentage", arguments={"percentage": 50}, client_request_id="f33")).json()
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "fan.hall", "state": "on", "attributes": {"percentage": 33, **three, "friendly_name": "Hall fan"}}]}).status_code == 200
    assert c.get(f"/api/v1/ha/actions/{a['id']}").json()["status"] == "pending"
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "fan.hall", "state": "on", "attributes": {"percentage": 66, **three}}]}).status_code == 200
    assert c.get(f"/api/v1/ha/actions/{a['id']}").json()["status"] == "confirmed"


# ---------------------------------------------------------------- slice 3: bulk actions (devices.control_bulk)

from smplwise.services import device_bulk, ha_actions  # noqa: E402


def _now_z(offset_s: float = 30.0) -> str:
    import datetime as _dt

    return (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(seconds=offset_s)).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _bulk(**kw) -> dict:
    import uuid as _uuid

    return {"scope": "area", "id": "lobby", "kind": "lights_off", "confirmed": True, "client_request_id": str(_uuid.uuid4()), "expires_at": _now_z(), **kw}


class FakeHA:
    """Home Assistant's side of the bridge for the bulk tests: verifies the signature, records every call (and how many
    were in flight at once), reports the effect as the device would - except for entities in `stuck` (accepts, does
    nothing) and `refuse` (the bridge answers ok:false) - and can hold calls until released (`hold_prefix`)."""

    def __init__(self, app, secret: str) -> None:
        import threading as _th

        self.app, self.secret = app, secret
        self.calls: list[dict] = []
        self.stuck: set[str] = set()
        self.refuse: set[str] = set()
        self.hold_prefix: str | None = None
        self.release = _th.Event()
        self.in_flight = 0
        self.max_in_flight = 0
        self.delay = 0.0
        self.on_call = None
        self._lock = _th.Lock()

    def __call__(self, _settings, payload, timeout=15.0):
        import time as _t

        ha_bridge.verify(self.secret, payload)
        eid = payload["data"]["entity_id"]
        with self._lock:
            self.calls.append(payload)
            self.in_flight += 1
            self.max_in_flight = max(self.max_in_flight, self.in_flight)
        try:
            if self.on_call:
                self.on_call(payload)
            if self.hold_prefix and eid.startswith(self.hold_prefix):
                self.release.wait(10)
            if self.delay:
                _t.sleep(self.delay)
            if eid in self.refuse:
                return {"ok": False, "error": "service_not_allowed"}
            if eid not in self.stuck:
                new = {"turn_off": "off", "close_cover": "closed", "turn_on": "on"}.get(payload["service"])
                if new:
                    now = _now_z(0)
                    with self.app.state.db.write_aside() as w:
                        ha_sync.upsert_state(w, {"entity_id": eid, "state": new, "attributes": {}, "last_changed": now, "last_updated": now})
            return {"ok": True, "context_id": "ctx"}
        finally:
            with self._lock:
                self.in_flight -= 1


@pytest.fixture()
def bulk_app(dev_app, monkeypatch):
    app, s = dev_app
    c = TestClient(app)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.2.4"}))
    fake = FakeHA(app, secret)
    monkeypatch.setattr(ha_client, "call_bridge_execute", fake)
    monkeypatch.setattr(ha_actions, "CONFIRM_WINDOW_S", 1.5)  # the confirmation window, short for the tests
    monkeypatch.setattr(device_bulk, "POLL_S", 0.1)

    def no_wiskey(*_a, **_k):
        raise AssertionError("a bulk action must never go through the WisKey feed")

    from smplwise.services import intercom_sync

    monkeypatch.setattr(intercom_sync.SYNC, "action", no_wiskey)
    device_bulk.RUNNER.clear()
    yield app, s, c, fake
    fake.release.set()
    device_bulk.RUNNER.clear()


def _finish(c, bulk_id: str, headers: dict | None = None) -> dict:
    assert device_bulk.RUNNER.wait(bulk_id, 20), "the bulk worker did not end"
    return c.get(f"/api/v1/devices/actions/{bulk_id}", headers=headers or {}).json()


def _audit_rows(app, **where) -> list[dict]:
    with app.state.db.connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = 'devices.bulk' ORDER BY rowid").fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"] or "{}")
    return [r for r in rows if all(r["details"].get(k) == v for k, v in where.items())]


def test_bulk_permission_registered_like_access_release():
    """devices.control_bulk: site_admin and system_admin only, in the sensitive list (a custom role grants it only by
    naming it explicitly), labelled - the same treatment as access.release."""
    from smplwise.routers.access import SENSITIVE

    assert PERMISSION_LABELS["devices.control_bulk"]
    assert {r for r, perms in ROLES.items() if "devices.control_bulk" in perms} == {"site_admin", "system_admin"}
    assert "devices.control_bulk" in SENSITIVE
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"] for r in contract["roles"] if "devices.control_bulk" in r["permissions"]} == {"site_admin", "system_admin"}
    assert "devices.control_bulk" in contract["sensitive_permissions_not_implied"]


def test_bulk_kinds_never_reach_locks_alarm_sirens_scripts_scenes_buttons():
    """The kinds' actions are the everyday domains only, none needs a grant, and the risky domains never appear."""
    domains = {d for parts in device_bulk.KINDS.values() for d, _a in parts}
    assert domains <= {"light", "switch", "cover", "climate", "fan", "media_player"}
    assert not domains & {"lock", "alarm_control_panel", "siren", "script", "scene", "button", "camera", "vacuum", "input_boolean"}
    for parts in device_bulk.KINDS.values():
        for domain, action_id in parts:
            spec = ha_bridge.ACTIONS[action_id]
            assert spec["domain"] == domain and not spec.get("grant") and spec["risk"] != "sensitive", action_id
    assert {a for _d, a in device_bulk.KINDS["all_off"]} == {"light.turn_off", "switch.turn_off", "cover.close_cover", "climate.turn_off", "fan.turn_off", "media_player.turn_off"}


def test_door_cover_constants_are_one_definition_not_two():
    """CR-007 slice 4 review (NIT 9): device_bulk's DOOR_COVER_CLASSES / DOOR_LAYER are services/devices.py's own
    (imported, not redefined) - services/ha_scope.py's server-side devices.control refusal reads the same ones."""
    assert device_bulk.DOOR_COVER_CLASSES is svc.DOOR_COVER_CLASSES
    assert device_bulk.DOOR_LAYER is svc.DOOR_LAYER == "doors"


def test_bulk_requires_devices_control_bulk(bulk_app):
    """403 without the permission - a viewer, and an operator who holds devices.control - checked before the body is
    even read (a non-JSON body still gets the 403), audited, nothing sent; the tree / area carry can_bulk only for a
    holder."""
    app, s, c, fake = bulk_app
    bind(c, s, "vi", "viewer", "installation", "*")
    bind(c, s, "op", "operator", "installation", "*")
    for who in ("vi", "op"):
        r = c.post("/api/v1/devices/actions", json=_bulk(), headers=as_user(who))
        assert r.status_code == 403, who
        r = c.post("/api/v1/devices/actions", content=b"not json", headers={**as_user(who), "content-type": "text/plain"})
        assert r.status_code == 403, who
        assert c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "all_off"}, headers=as_user(who)).status_code == 403
        t = c.get("/api/v1/devices/tree", headers=as_user(who)).json()
        assert t["can_bulk"] is False and not any(f["can_bulk"] or any(a["can_bulk"] for a in f["areas"]) for f in t["floors"]), who
        assert c.get("/api/v1/devices/areas/lobby", headers=as_user(who)).json()["can_bulk"] is False
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'devices.control_bulk' AND decision = 'denied'").fetchone()[0]
    assert denied >= 6
    assert not fake.calls
    # the bootstrap system_admin holds it everywhere
    t = c.get("/api/v1/devices/tree").json()
    assert t["can_bulk"] is True and all(f["can_bulk"] and all(a["can_bulk"] for a in f["areas"]) for f in t["floors"])
    assert c.get("/api/v1/devices/areas/lobby").json()["can_bulk"] is True
    assert c.get("/api/v1/devices/areas/unassigned").json()["can_bulk"] is False  # the bucket is not an area


def test_bulk_floor_scoped_holder_only_on_their_floors(bulk_app):
    """A site_admin bound to one VMS floor: floor / area actions only over the entities placed on that floor; another
    floor or area (nothing of theirs there) is an audited 403; the building needs installation scope. A custom role
    naming devices.control_bulk among its sensitive permissions grants it to one person."""
    app, s, c, fake = bulk_app
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    _place(c, ids["floor2"], "light.office")
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "light.office", "state": "on", "attributes": {"friendly_name": "Office light"}}]}).status_code == 200
    bind(c, s, "sa2", "site_admin", "floor", ids["floor2"])
    h = as_user("sa2")
    t = c.get("/api/v1/devices/tree", headers=h).json()
    assert t["can_bulk"] is False
    second = next(f for f in t["floors"] if f["floor_id"] == "second")
    assert second["can_bulk"] is True and next(a for a in second["areas"] if a["area_id"] == "office")["can_bulk"] is True
    for scope, sid in (("area", "lobby"), ("floor", "ground"), ("building", "*")):
        r = c.post("/api/v1/devices/actions", json=_bulk(scope=scope, id=sid, kind="all_off"), headers=h)
        assert r.status_code == 403, (scope, r.text)
        assert r.json()["details"]["outcome"] == "not_sent"
        assert c.get("/api/v1/devices/actions/preview", params={"scope": scope, "id": sid, "kind": "all_off"}, headers=h).status_code == 403
    refused = _audit_rows(app, phase="refused")
    assert [r["reason"] for r in refused[-3:]] == ["forbidden"] * 3 and all(r["decision"] == "denied" for r in refused[-3:])
    assert not fake.calls
    # their own floor: only what is placed there (the office light), not the office cover even when it is open
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "cover.office", "state": "open", "attributes": {"friendly_name": "Office shutter", "current_position": 50}}]}).status_code == 200
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "floor", "id": "second", "kind": "all_off"}, headers=h).json()
    assert [t["entity_id"] for t in p["targets"]] == ["light.office"]
    r = c.post("/api/v1/devices/actions", json=_bulk(scope="floor", id="second", kind="all_off"), headers=h)
    assert r.status_code == 202, r.text
    got = _finish(c, r.json()["id"], h)
    assert [i["entity_id"] for i in got["items"]] == ["light.office"] and got["all_confirmed"] is True
    assert [p["data"]["entity_id"] for p in fake.calls] == ["light.office"]
    # a custom role that names the sensitive permission explicitly grants it (per person, via a binding)
    role = c.post("/api/v1/access/roles", json={"name": "כיבוי מרוכז", "permissions": ["devices.read"], "sensitive": ["devices.control_bulk"]})
    assert role.status_code in (200, 201), role.text
    bind(c, s, "cu", role.json()["id"], "installation", "*")
    assert c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "lights_off"}, headers=as_user("cu")).status_code == 200


def test_bulk_envelope_confirmation_and_dedupe(bulk_app):
    """JSON only, a closed body, the confirmation stated (only `true`), expiry on the server clock (not past, not too
    far), a client_request_id used once - every refusal one audited row, nothing sent."""
    app, s, c, fake = bulk_app
    cases = [
        (dict(content=json.dumps(_bulk()).encode(), headers={"content-type": "text/plain"}), 415, "unsupported_media_type"),
        (dict(content=b"{not json", headers={"content-type": "application/json"}), 422, "validation"),
        (dict(json=_bulk(extra="x")), 422, "validation"),
        (dict(json=_bulk(kind="unlock_all")), 422, "validation"),
        (dict(json=_bulk(scope="site")), 422, "validation"),
        (dict(json=_bulk(confirmed=None)), 409, "confirmation_required"),
        (dict(json=_bulk(confirmed="true")), 409, "confirmation_required"),
        (dict(json=_bulk(expires_at=_now_z(-5))), 409, "expired"),
        (dict(json=_bulk(expires_at=_now_z(3600))), 422, "expires_too_far"),
        (dict(json=_bulk(expires_at="tomorrow")), 422, "validation"),
        (dict(json=_bulk(client_request_id="a%b_c")), 422, "validation"),
        (dict(json=_bulk(scope="area", id="no_such_area")), 404, "not_found"),
        (dict(json=_bulk(scope="building", id="lobby")), 422, "validation"),
        (dict(json=_bulk(preview_digest="0000000000000000")), 409, "target_changed"),
    ]
    before = len(_audit_rows(app, phase="refused"))
    for i, (kw, status, code) in enumerate(cases):
        r = c.post("/api/v1/devices/actions", **kw)
        assert (r.status_code, r.json().get("code")) == (status, code), (i, r.text)
    refused = _audit_rows(app, phase="refused")
    assert len(refused) == before + len(cases)
    assert all(r["decision"] == "denied" and r["details"]["outcome"] == "not_sent" for r in refused[before:])
    assert not fake.calls and not _audit_rows(app, phase="attempt")
    # the preview's digest matches: accepted once; the same client_request_id again is a duplicate, not a second send
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "lights_off"}).json()
    body = _bulk(preview_digest=p["digest"])
    r = c.post("/api/v1/devices/actions", json=body)
    assert r.status_code == 202, r.text
    _finish(c, r.json()["id"])
    n = len(fake.calls)
    again = c.post("/api/v1/devices/actions", json=body)
    assert again.status_code == 409 and again.json()["code"] == "duplicate_command" and again.json()["details"]["bulk_id"] == r.json()["id"]
    assert len(fake.calls) == n


def test_bulk_entity_set_never_includes_locks_alarm_or_doors(bulk_app):
    """all_off over the lobby sends exactly the lights / switches / covers / climate / fans / screens that are on -
    never the lock, the alarm panel, the camera or the sensors present in the same area, never a gate cover, never a
    switch placed on the map's door layer; an entity already off is skipped (counted), an unavailable one too."""
    app, s, c, fake = bulk_app
    extra = [
        {"entity_id": "cover.lobby_gate", "state": "open", "attributes": {"friendly_name": "Gate", "device_class": "gate"}},
        {"entity_id": "switch.lobby_door_relay", "state": "on", "attributes": {"friendly_name": "Door relay"}},
        {"entity_id": "fan.lobby", "state": "on", "attributes": {"friendly_name": "Lobby fan"}},
        {"entity_id": "light.lobby_dead", "state": "unavailable", "attributes": {"friendly_name": "Dead light"}},
    ]
    assert c.post("/api/v1/ha/dev/states", json={"states": extra}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg(e["entity_id"], "lobby") for e in extra]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "switch.lobby_door_relay", "x": 0.3, "y": 0.3, "layer_id": "doors"}).status_code == 201
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "all_off"}).json()
    sent = {t["entity_id"]: t["action_id"] for t in p["targets"]}
    assert sent == {
        "light.lobby": "light.turn_off",
        "cover.lobby_blind": "cover.close_cover",
        "climate.lobby": "climate.turn_off",
        "fan.lobby": "fan.turn_off",
        "media_player.lobby_tv": "media_player.turn_off",
    }
    assert p["by_domain"] == {"light": 1, "cover": 1, "climate": 1, "fan": 1, "media_player": 1} and p["count"] == 5
    assert p["never_included"] == {"lock": 1, "alarm_control_panel": 1}
    # switches enter only when positively safe: the unmarked sign and the door-layer relay are listed, not sent
    assert {x["entity_id"]: x["reason"] for x in p["excluded"]} == {"cover.lobby_gate": "door_cover", "switch.lobby_door_relay": "doors_layer", "switch.lobby_sign": "switch_not_marked"}
    assert all(x["reason_label"] for x in p["excluded"])
    assert p["skipped"] == {"already": 1, "unavailable": 1}  # light.lobby_spot is off; light.lobby_dead is unavailable
    assert "מנעולים" in p["note"]
    # each kind is its own subset (covers_position also needs its own argument - CR-007 slice 4)
    def _preview(k: str, **extra) -> set[str]:
        return {t["entity_id"] for t in c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": k, **extra}).json()["targets"]}

    kinds = {k: (_preview(k, position=40) if k in device_bulk.KINDS_WITH_POSITION else _preview(k)) for k in device_bulk.KINDS}
    assert kinds["lights_off"] == {"light.lobby"} and kinds["covers_close"] == {"cover.lobby_blind"}
    assert kinds["climate_off"] == {"climate.lobby", "fan.lobby"} and kinds["screens_off"] == {"media_player.lobby_tv"}
    assert kinds["covers_open"] == set() and kinds["covers_stop"] == set()  # the blind is already open, nothing is moving
    assert kinds["covers_position"] == {"cover.lobby_blind"}  # away from the requested 40%; the gate stays excluded
    # the request sends exactly that set; nothing else reaches the bridge
    r = c.post("/api/v1/devices/actions", json=_bulk(kind="all_off", preview_digest=p["digest"]))
    assert r.status_code == 202, r.text
    _finish(c, r.json()["id"])
    called = {(x["data"]["entity_id"], f'{x["domain"]}.{x["service"]}') for x in fake.calls}
    assert called == set(sent.items())
    assert not any(x["domain"] in ("lock", "alarm_control_panel", "camera", "siren", "script", "scene", "button") for x in fake.calls)
    # the building scope includes the garden (an area on no floor); the "no floor" bucket is a floor of its own
    b = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "lights_off"}).json()
    assert {t["entity_id"] for t in b["targets"]} == {"light.garden"}  # the lobby light is off now
    nf = c.get("/api/v1/devices/actions/preview", params={"scope": "floor", "id": svc.NO_FLOOR, "kind": "lights_off"}).json()
    assert [t["entity_id"] for t in nf["targets"]] == ["light.garden"]


def test_bulk_empty_set_refused(bulk_app):
    """Nothing to do (every light in the office is already off) is a 409 `nothing_to_do`, audited, nothing sent."""
    app, s, c, fake = bulk_app
    r = c.post("/api/v1/devices/actions", json=_bulk(scope="area", id="office", kind="lights_off"))
    assert r.status_code == 409 and r.json()["code"] == "nothing_to_do" and r.json()["details"]["skipped"]["already"] == 1
    assert _audit_rows(app, phase="refused")[-1]["reason"] == "nothing_to_do"
    r = c.post("/api/v1/devices/actions", json=_bulk(scope="area", id="empty_room", kind="all_off"))
    assert r.status_code == 409 and r.json()["code"] == "nothing_to_do"
    assert not fake.calls and not _audit_rows(app, phase="attempt")


def test_bulk_attempt_row_committed_before_the_first_call(bulk_app):
    """At the moment the first call reaches the bridge, the attempt audit row (scope, id, kind, count, entity ids) and
    every per-entity record are already committed - read here through a separate connection."""
    app, s, c, fake = bulk_app
    seen: list[tuple] = []

    def check(payload):
        if seen:
            return
        with app.state.db.connection(mode="read") as conn:
            att = [r["details_json"] for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'devices.bulk'").fetchall() if '"phase": "attempt"' in (r["details_json"] or "")]
            recs = conn.execute("SELECT COUNT(*) FROM ha_actions WHERE via = 'bulk'").fetchone()[0]
            mine = conn.execute("SELECT status FROM ha_actions WHERE id = ?", (payload["request_id"],)).fetchone()["status"]
        seen.append((att, recs, mine))

    fake.on_call = check
    r = c.post("/api/v1/devices/actions", json=_bulk(kind="all_off"))
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["counts"]["total"] == 4 and body["done"] is False
    _finish(c, body["id"])
    att, recs, mine = seen[0]
    assert mine == "sending", "a record is marked sending, committed, before its bridge call"
    assert len(att) == 1 and recs == 4
    d = json.loads(att[0])
    assert d["bulk_id"] == body["id"] and d["scope"] == "area" and d["id"] == "lobby" and d["kind"] == "all_off" and d["entity_count"] == 4
    assert sorted(d["entity_ids"]) == sorted(["light.lobby", "cover.lobby_blind", "climate.lobby", "media_player.lobby_tv"])
    attempt = _audit_rows(app, phase="attempt")[-1]
    assert attempt["decision"] == "allowed" and attempt["resource_type"] == "devices_area" and attempt["resource_id"] == "lobby"


def test_bulk_per_entity_outcomes_counts_and_one_outcome_row(bulk_app):
    """Per entity: confirmed when HA reported it, not_confirmed when the window passed and HA reports another state,
    refused when the bridge said no. `done` only at the end; `all_confirmed` false; ONE outcome row with the counts
    (however many times the status is read); another user may not read it."""
    app, s, c, fake = bulk_app
    fake.stuck = {"media_player.lobby_tv"}
    fake.refuse = {"climate.lobby"}
    r = c.post("/api/v1/devices/actions", json=_bulk(kind="all_off"))
    assert r.status_code == 202
    bid = r.json()["id"]
    got = _finish(c, bid)
    out = {i["entity_id"]: i["outcome"] for i in got["items"]}
    assert out == {"light.lobby": "confirmed", "cover.lobby_blind": "confirmed", "climate.lobby": "refused", "media_player.lobby_tv": "not_confirmed"}
    assert got["done"] is True and got["all_confirmed"] is False
    assert got["counts"] == {"confirmed": 2, "sent": 0, "accepted": 0, "queued": 0, "not_confirmed": 1, "refused": 1, "unknown": 0, "total": 4}
    for _ in range(3):
        assert c.get(f"/api/v1/devices/actions/{bid}").json()["counts"]["confirmed"] == 2
    outcome = _audit_rows(app, phase="outcome")
    assert len(outcome) == 1
    o = outcome[0]
    assert o["reason"] == "partial" and o["details"]["counts"]["total"] == 4 and o["details"]["not_confirmed"] == ["media_player.lobby_tv"] and o["details"]["refused"] == ["climate.lobby"]
    # the per-entity records are ordinary HA action records of this user, linked to the bulk
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT via, principal_user_id FROM ha_actions WHERE bulk_id = ?", (bid,)).fetchall()
    assert len(rows) == 4 and {(r["via"], r["principal_user_id"]) for r in rows} == {("bulk", "dev-joni")}
    bind(c, s, "other", "site_admin", "installation", "*")
    assert c.get(f"/api/v1/devices/actions/{bid}", headers=as_user("other")).status_code == 403
    # everything confirmed: all_confirmed, no "partial"
    fake.stuck, fake.refuse = set(), set()
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "light.office", "state": "on", "attributes": {}}, {"entity_id": "cover.office", "state": "open", "attributes": {}}]}).status_code == 200
    r = c.post("/api/v1/devices/actions", json=_bulk(scope="floor", id="second", kind="all_off"))
    got = _finish(c, r.json()["id"])
    assert got["all_confirmed"] is True and got["counts"]["confirmed"] == 2
    assert _audit_rows(app, phase="outcome")[-1]["reason"] is None


def test_bulk_one_per_scope_and_never_overlapping(bulk_app):
    """While a bulk runs, a second one on the same scope - or on any scope sharing an entity - is a 409
    `bulk_in_progress` (audited, nothing sent); an unrelated scope and a single-entity action still go through."""
    app, s, c, fake = bulk_app
    fake.hold_prefix = "light."
    r = c.post("/api/v1/devices/actions", json=_bulk(kind="lights_off"))
    assert r.status_code == 202
    bid = r.json()["id"]
    for scope, sid, kind in (("area", "lobby", "covers_close"), ("floor", "ground", "lights_off"), ("building", "*", "lights_off")):
        again = c.post("/api/v1/devices/actions", json=_bulk(scope=scope, id=sid, kind=kind))
        assert again.status_code == 409 and again.json()["code"] == "bulk_in_progress" and again.json()["details"]["bulk_id"] == bid, (scope, again.text)
    assert _audit_rows(app, phase="refused")[-1]["reason"] == "bulk_in_progress"
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "cover.office", "state": "open", "attributes": {}}]}).status_code == 200
    other = c.post("/api/v1/devices/actions", json=_bulk(scope="area", id="office", kind="covers_close"))
    assert other.status_code == 202, other.text
    single = c.post("/api/v1/ha/entities/switch.lobby_sign/actions", json={"allowed_action_id": "switch.turn_off", "arguments": {}, "client_request_id": "single-1", "expires_at": "2099-01-01T00:00:00Z"})
    assert single.status_code == 202, single.text
    fake.release.set()
    _finish(c, bid)
    _finish(c, other.json()["id"])
    # finished: the scope is free again
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "light.lobby", "state": "on", "attributes": {}}]}).status_code == 200
    again = c.post("/api/v1/devices/actions", json=_bulk(kind="lights_off"))
    assert again.status_code == 202
    _finish(c, again.json()["id"])


def test_bulk_bounded_concurrency(bulk_app):
    """A 30-light area goes out at most BULK_MAX_IN_FLIGHT (8) calls at a time, all of them sent and confirmed."""
    app, s, c, fake = bulk_app
    lights = [{"entity_id": f"light.hall_{i:02d}", "state": "on", "attributes": {"friendly_name": f"Hall {i}"}} for i in range(30)]
    assert c.post("/api/v1/ha/dev/states", json={"states": lights[:20]}).status_code == 200
    assert c.post("/api/v1/ha/dev/states", json={"states": lights[20:]}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg(e["entity_id"], "empty_room") for e in lights]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    fake.delay = 0.05
    r = c.post("/api/v1/devices/actions", json=_bulk(scope="area", id="empty_room", kind="lights_off"))
    assert r.status_code == 202, r.text
    got = _finish(c, r.json()["id"])
    assert len(fake.calls) == 30 and got["counts"]["confirmed"] == 30
    assert 1 < fake.max_in_flight <= device_bulk.BULK_MAX_IN_FLIGHT == 8


def test_bulk_not_sent_after_its_deadline_and_orphans_settled(bulk_app, monkeypatch):
    """Nothing is sent after the request's deadline (the rest is reported as refused / not sent, never as sent); a bulk
    whose worker is gone (restart) is settled on the next read: what was never sent is recorded so."""
    app, s, c, fake = bulk_app
    monkeypatch.setattr(device_bulk, "SEND_WITHIN_S", 0.0)
    r = c.post("/api/v1/devices/actions", json=_bulk(kind="all_off"))
    got = _finish(c, r.json()["id"])
    assert not fake.calls and got["counts"]["refused"] == 4 and not any(i["sent"] for i in got["items"])
    assert {i["error"] for i in got["items"]} == {"expired"}
    # an orphan: a record still queued, no worker
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO device_bulk_actions(id, scope, scope_id, scope_name, kind, principal_user_id, principal_username, client_request_id, entity_count, status, requested_at, not_after) VALUES ('orphan1','area','lobby','לובי','lights_off','dev-joni','joni','orphan-req',1,'sending','2026-09-28T10:00:00Z','2026-09-28T10:00:30Z')")
        conn.execute("INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via, bulk_id) VALUES ('orphan1-0','light.lobby','light.turn_off','{}','dev-joni','joni','orphan-req:0','queued','2026-09-28T10:00:00Z','off','bulk','orphan1')")
    o = c.get("/api/v1/devices/actions/orphan1").json()
    assert o["done"] is True and o["items"][0]["outcome"] == "refused" and o["items"][0]["error"] == "interrupted" and o["items"][0]["sent"] is False
    assert _audit_rows(app, phase="outcome")[-1]["details"]["bulk_id"] == "orphan1"


def test_bulk_switches_only_when_positively_safe(bulk_app, monkeypatch):
    """Review rounds 1-2: a door / gate release relay is a switch too. A switch enters a bulk action only when an
    administrator marked it bulk-safe - a Plan Studio lighting circuit never grants that by itself (it only suggests the
    mark); a switch placed with the default layer, or not placed at all, is listed as not included. A cover on the map's
    door layer is never closed."""
    app, s, c, fake = bulk_app
    extra = [
        {"entity_id": "switch.lobby_placed", "state": "on", "attributes": {"friendly_name": "Placed relay"}},
        {"entity_id": "switch.lobby_circuit", "state": "on", "attributes": {"friendly_name": "Circuit switch"}},
        {"entity_id": "cover.lobby_hatch", "state": "open", "attributes": {"friendly_name": "Hatch"}},
    ]
    assert c.post("/api/v1/ha/dev/states", json={"states": extra}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg(e["entity_id"], "lobby") for e in extra]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    assert c.post(f"/api/v1/plan-versions/{vid}/publish").status_code == 200
    # a switch placed with the default layer (the anchor route puts a switch on "lights") and a cover on the door layer
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "switch.lobby_placed", "x": 0.2, "y": 0.2}).json()["layer_id"] == "lights"
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "cover.lobby_hatch", "x": 0.3, "y": 0.3, "layer_id": "doors"}).status_code == 201
    # a published lighting circuit switched by switch.lobby_circuit
    from test_plan_circuits_search import LAMPS, LEVELS, _publish

    _publish(c, vid, levels=LEVELS, objects=LAMPS[:1], circuits=[{"id": "k1", "name": "לובי", "switch_entity_id": "switch.lobby_circuit", "member_ids": ["l1"], "color_token": "circuit-1", "power_w": 0}])

    def preview() -> dict:
        return c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "all_off"}).json()

    p = preview()
    sent = {t["entity_id"] for t in p["targets"]}
    excluded = {x["entity_id"]: x["reason"] for x in p["excluded"]}
    assert "switch.lobby_circuit" not in sent and excluded["switch.lobby_circuit"] == "circuit_not_marked", "a circuit alone never makes a switch eligible"
    assert excluded["switch.lobby_placed"] == "switch_not_marked", "placed with the default layer: not included"
    assert excluded["switch.lobby_sign"] == "switch_not_marked", "not placed at all: not included"
    assert excluded["cover.lobby_hatch"] == "doors_layer", "a cover on the door layer is never closed, device class or not"
    assert "cover.lobby_hatch" not in {t["entity_id"] for t in c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "covers_close"}).json()["targets"]}
    # the area screen tells a bulk holder which switches are in, and why
    rows = {r["entity_id"]: r for r in c.get("/api/v1/devices/areas/lobby").json()["cards"]["switches"]["entities"]}
    assert (rows["switch.lobby_circuit"]["bulk_safe"], rows["switch.lobby_circuit"]["bulk_reason"]) == (False, "circuit_not_marked")
    assert (rows["switch.lobby_sign"]["bulk_safe"], rows["switch.lobby_sign"]["bulk_reason"]) == (False, "switch_not_marked")
    # marking is an administrator's statement: system.configure only, audited; a site_admin cannot
    bind(c, s, "sa", "site_admin", "installation", "*")
    assert c.put("/api/v1/devices/entities/switch.lobby_sign/bulk-safe", json={"bulk_safe": True}, headers=as_user("sa")).status_code == 403
    assert c.put("/api/v1/devices/entities/light.lobby/bulk-safe", json={"bulk_safe": True}).status_code == 422
    r = c.put("/api/v1/devices/entities/switch.lobby_sign/bulk-safe", json={"bulk_safe": True})
    assert r.status_code == 200 and r.json()["bulk_safe"] is True and r.json()["bulk_reason"] == "marked"
    assert "switch.lobby_sign" in {t["entity_id"] for t in preview()["targets"]}
    assert c.put("/api/v1/devices/entities/switch.lobby_circuit/bulk-safe", json={"bulk_safe": True}).json()["bulk_reason"] == "marked"
    assert "switch.lobby_circuit" in {t["entity_id"] for t in preview()["targets"]}, "a circuit switch with the mark is included"
    # a mark never overrides the door layer
    assert c.put("/api/v1/devices/entities/switch.lobby_placed/bulk-safe", json={"bulk_safe": True}).status_code == 200
    assert "switch.lobby_placed" in {t["entity_id"] for t in preview()["targets"]}
    assert c.put("/api/v1/devices/entities/switch.lobby_sign/bulk-safe", json={"bulk_safe": False}).json()["bulk_safe"] is False
    assert preview()["excluded"] and "switch.lobby_sign" in {x["entity_id"] for x in preview()["excluded"]}
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'devices.bulk_safe' AND decision = 'allowed'").fetchone()[0] == 4
    # input_booleans are HA flags, not devices: never in a bulk action
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "input_boolean.lobby_flag", "state": "on", "attributes": {}}]}).status_code == 200
    reg2 = reg + [_reg("input_boolean.lobby_flag", "lobby")]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg2, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    assert "input_boolean.lobby_flag" not in {t["entity_id"] for t in preview()["targets"]}


def test_bulk_restart_mid_send_is_unknown_never_not_sent_and_swept_at_start(bulk_app):
    """Review round 1 (MAJOR / MEDIUM): a record whose call had started (`sending`) when the process died may have
    switched the device - it is "unknown", never "not sent"; a record never handed to a call is "not sent". The next
    start settles every unfinished bulk and writes its outcome row without anyone opening it."""
    app, s, c, fake = bulk_app
    from smplwise.main import create_app

    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO device_bulk_actions(id, scope, scope_id, scope_name, kind, principal_user_id, principal_username, client_request_id, entity_count, status, requested_at, not_after) VALUES ('crash1','area','lobby','לובי','all_off','dev-joni','joni','crash-req',3,'sending','2026-09-28T10:00:00Z','2026-09-28T10:00:30Z')")
        for n, (eid, st) in enumerate((("light.lobby", "sending"), ("cover.lobby_blind", "queued"), ("climate.lobby", "pending"))):
            conn.execute("INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, expected_state, via, bulk_id) VALUES (?,?,?,'{}','dev-joni','joni',?,?,?,?, 'bulk','crash1')",
                         (f"crash1-{n}", eid, {"light": "light.turn_off", "cover": "cover.close_cover", "climate": "climate.turn_off"}[eid.split(".")[0]], f"crash-req:{n}", st, _now_z(0), "off" if not eid.startswith("cover") else "closed"))
    create_app(s)  # the next start
    assert _audit_rows(app, phase="outcome")[-1]["details"]["bulk_id"] == "crash1", "settled at start-up, not on first read"
    got = c.get("/api/v1/devices/actions/crash1").json()
    out = {i["entity_id"]: (i["outcome"], i["sent"]) for i in got["items"]}
    assert out["light.lobby"] == ("unknown", True), "a call in flight at the crash may have reached the device"
    assert out["cover.lobby_blind"] == ("refused", False), "never handed to a call: not sent"
    assert out["climate.lobby"][0] == "unknown", "still waiting for its report at start-up: unknown"
    assert got["done"] is True and got["counts"]["unknown"] == 2


def test_media_player_standby_confirms_turn_off(bulk_app):
    """Review round 1 (MEDIUM): a TV turned off often reports standby; that confirms turn_off (single and bulk), as the
    devices area already reads standby as off."""
    app, s, c, fake = bulk_app
    fake.stuck = {"media_player.lobby_tv"}
    r = c.post("/api/v1/ha/entities/media_player.lobby_tv/actions", json={"allowed_action_id": "media_player.turn_off", "arguments": {}, "client_request_id": "tv-off-1", "expires_at": "2099-01-01T00:00:00Z"})
    assert r.status_code == 202
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "media_player.lobby_tv", "state": "standby", "attributes": {}}]}).status_code == 200
    assert c.get(f"/api/v1/ha/actions/{r.json()['id']}").json()["status"] == "confirmed"
    assert ha_actions.state_matches("media_player.turn_off", "off", "standby") and not ha_actions.state_matches("light.turn_off", "off", "standby")


def test_bulk_safe_mark_cleared_when_the_entity_leaves_home_assistant(bulk_app):
    """Review round 2: a mark never outlives its entity. When a registry refresh no longer lists the switch (removed,
    or renamed to another id), its mark is deleted and audited, so a returning id is never pre-marked."""
    app, s, c, fake = bulk_app
    assert c.put("/api/v1/devices/entities/switch.lobby_sign/bulk-safe", json={"bulk_safe": True}).status_code == 200
    assert c.put("/api/v1/devices/entities/switch.loose/bulk-safe", json={"bulk_safe": True}).status_code == 200
    # a refresh that still lists both keeps both marks
    assert c.post("/api/v1/ha/dev/registry", json={"entities": ENTITY_REGISTRY, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    with app.state.db.connection() as conn:
        assert {r[0] for r in conn.execute("SELECT entity_id FROM device_bulk_safe").fetchall()} == {"switch.lobby_sign", "switch.loose"}
    # the sign is renamed in HA: its old id is gone from the registry
    reg = [r for r in ENTITY_REGISTRY if r["entity_id"] != "switch.lobby_sign"] + [_reg("switch.lobby_sign_2", "lobby")]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    with app.state.db.connection() as conn:
        assert {r[0] for r in conn.execute("SELECT entity_id FROM device_bulk_safe").fetchall()} == {"switch.loose"}
        cleared = conn.execute("SELECT resource_id, reason FROM audit_log WHERE action = 'devices.bulk_safe.cleared'").fetchall()
    assert [(r["resource_id"], r["reason"]) for r in cleared] == [("switch.lobby_sign", "entity_gone")]
    # the id comes back: not pre-marked
    assert c.post("/api/v1/ha/dev/registry", json={"entities": ENTITY_REGISTRY, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    rows = {r["entity_id"]: r for r in c.get("/api/v1/devices/areas/lobby").json()["cards"]["switches"]["entities"]}
    assert rows["switch.lobby_sign"]["bulk_reason"] == "switch_not_marked"
    # the sync's own refresh applies the same rule (a tombstoned entity loses its mark too)
    from smplwise.services import device_bulk as db_

    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET removed_at = '2026-09-28T10:00:00Z' WHERE entity_id = 'switch.loose'")
        assert db_.clear_stale_marks(conn, {"switch.loose"}) == ["switch.loose"]


# ---------------------------------------------------------------- slice 4: climate/covers in full, sensors, assign


def test_slice4_new_allow_list_actions_validate_and_have_expected_risk(dev_app, monkeypatch):
    """CR-007 slice 4: climate preset/swing/humidity, humidifier set_humidity/set_mode, and cover tilt (open/close/
    stop/position) - each validated (range/length) and carrying the risk the coordinator ruling calls for (cover
    tilt movement is "attention" like the top movement - one physical movement whichever control starts it;
    climate/humidifier target-setting is routine, matching set_temperature/set_fan_mode already in the allow-list).
    humidifier also joins the devices.control domains (CR-007 s3 left it out; the card now controls it)."""
    app, s = dev_app
    c = TestClient(app)
    _pair(c, monkeypatch)
    assert c.post(
        "/api/v1/ha/dev/states",
        json={
            "states": [
                {"entity_id": "humidifier.lobby", "state": "on", "attributes": {"friendly_name": "Lobby humidifier", "humidity": 45, "min_humidity": 30, "max_humidity": 80, "mode": "normal", "available_modes": ["normal", "auto"]}},
                # the fixture's climate.lobby reports no preset/swing/humidity yet: an entity confirms only what it itself reports
                {"entity_id": "climate.lobby", "state": "cool", "attributes": {"friendly_name": "Lobby AC", "current_temperature": 25.5, "temperature": 22, "hvac_action": "cooling", "fan_mode": "auto", "preset_mode": "none", "swing_mode": "off", "humidity": 50}},
            ]
        },
    ).status_code == 200
    body = lambda **kw: {"arguments": {}, "expected_state_version": None, "confirmation_grant": None, "expires_at": "2099-01-01T00:00:00Z", **kw}  # noqa: E731
    # climate: preset / swing / humidity
    assert c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_preset_mode", arguments={"preset_mode": "x" * 41}, client_request_id="q1")).status_code == 422
    r = c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_preset_mode", arguments={"preset_mode": "eco"}, client_request_id="q2"))
    assert r.status_code == 202 and r.json()["expected_state"] == "preset_mode=eco"
    r = c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_swing_mode", arguments={"swing_mode": "vertical"}, client_request_id="q3"))
    assert r.status_code == 202 and r.json()["expected_state"] == "swing_mode=vertical"
    assert c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_humidity", arguments={"humidity": 150}, client_request_id="q4")).status_code == 422
    r = c.post("/api/v1/ha/entities/climate.lobby/actions", json=body(allowed_action_id="climate.set_humidity", arguments={"humidity": 55}, client_request_id="q5"))
    assert r.status_code == 202 and r.json()["expected_state"] == "humidity=55"
    # humidifier: set_humidity / set_mode
    r = c.post("/api/v1/ha/entities/humidifier.lobby/actions", json=body(allowed_action_id="humidifier.set_humidity", arguments={"humidity": 60}, client_request_id="q6"))
    assert r.status_code == 202 and r.json()["expected_state"] == "humidity=60"
    assert c.post("/api/v1/ha/entities/humidifier.lobby/actions", json=body(allowed_action_id="humidifier.set_mode", arguments={"mode": ""}, client_request_id="q7")).status_code == 422
    r = c.post("/api/v1/ha/entities/humidifier.lobby/actions", json=body(allowed_action_id="humidifier.set_mode", arguments={"mode": "auto"}, client_request_id="q8"))
    assert r.status_code == 202 and r.json()["expected_state"] == "mode=auto"
    # cover tilt: open/close need the movement confirmation like the top ones; stop is routine; position is 0-100
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "cover.lobby_blind", "state": "open", "attributes": {"friendly_name": "Blind", "device_class": "blind", "current_position": 70, "current_tilt_position": 50}}]}).status_code == 200
    for i, aid in enumerate(("cover.open_cover_tilt", "cover.close_cover_tilt")):
        pending = c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id=aid, client_request_id=f"t{i}a"))
        assert pending.status_code == 409 and pending.json()["code"] == "confirmation_required"
        ok = c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id=aid, confirmation_grant="confirmed", client_request_id=f"t{i}b"))
        assert ok.status_code == 202 and ok.json()["confirmation"] == "none", "the cover's own state reflects position, not tilt: honestly sent, never confirmed"
    r = c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id="cover.stop_cover_tilt", client_request_id="t-stop"))
    assert r.status_code == 202, "stop is routine: never gated, even while the cover moves"
    assert c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id="cover.set_cover_tilt_position", arguments={"tilt_position": 150}, confirmation_grant="confirmed", client_request_id="t-p1")).status_code == 422
    r = c.post("/api/v1/ha/entities/cover.lobby_blind/actions", json=body(allowed_action_id="cover.set_cover_tilt_position", arguments={"tilt_position": 30}, confirmation_grant="confirmed", client_request_id="t-p2"))
    assert r.status_code == 202 and r.json()["confirmation"] == "attribute" and r.json()["expected_state"] == "current_tilt_position=30"
    new_ids = {
        "climate.set_preset_mode": ("climate", "set_preset_mode", "routine"),
        "climate.set_swing_mode": ("climate", "set_swing_mode", "routine"),
        "climate.set_humidity": ("climate", "set_humidity", "routine"),
        "humidifier.set_humidity": ("humidifier", "set_humidity", "routine"),
        "humidifier.set_mode": ("humidifier", "set_mode", "routine"),
        "cover.open_cover_tilt": ("cover", "open_cover_tilt", "attention"),
        "cover.close_cover_tilt": ("cover", "close_cover_tilt", "attention"),
        "cover.stop_cover_tilt": ("cover", "stop_cover_tilt", "routine"),
        "cover.set_cover_tilt_position": ("cover", "set_cover_tilt_position", "attention"),
    }
    for aid, (domain, service, risk) in new_ids.items():
        spec = ha_bridge.ACTIONS[aid]
        assert (spec["domain"], spec["service"], spec["risk"]) == (domain, service, risk), aid
        assert not spec.get("grant"), aid
    with app.state.db.connection() as conn:
        assert ha_scope.devices_control_reaches(conn, "humidifier.lobby") and "humidifier" in ha_scope.DEVICES_CONTROL_DOMAINS


def test_slice4_card_fields_climate_humidity_cover_door_class_and_sensor_groups(dev_app):
    """The devices-area card rows carry what the slice-4 controls need: climate preset/swing/humidity, a
    humidifier's own mode/available_modes/humidity range, a door/garage/gate cover marked read-only (`door_class`,
    `can_control: false` regardless of the caller's grant), and every sensor row grouped by device class. Also the
    building/floor "מזגני הקומה" strip: climate.* only, mode + target, never the full card."""
    app, s = dev_app
    c = TestClient(app)
    extra = [
        {"entity_id": "humidifier.lobby", "state": "on", "attributes": {"friendly_name": "Lobby humidifier", "mode": "auto", "available_modes": ["auto", "boost"], "humidity": 45, "min_humidity": 30, "max_humidity": 80}},
        {"entity_id": "cover.lobby_gate", "state": "closed", "attributes": {"friendly_name": "Gate", "device_class": "gate"}},
        {"entity_id": "sensor.lobby_power", "state": "120", "attributes": {"friendly_name": "Lobby power", "unit_of_measurement": "W", "device_class": "power"}},
    ]
    assert c.post("/api/v1/ha/dev/states", json={"states": extra}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg(e["entity_id"], "lobby") for e in extra]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    a = c.get("/api/v1/devices/areas/lobby").json()
    climate = {r["entity_id"]: r for r in a["cards"]["climate"]["entities"]}
    assert climate["humidifier.lobby"]["mode"] == "auto" and climate["humidifier.lobby"]["available_modes"] == ["auto", "boost"]
    assert climate["humidifier.lobby"]["target_humidity"] == 45 and climate["humidifier.lobby"]["min_humidity"] == 30 and climate["humidifier.lobby"]["max_humidity"] == 80
    assert climate["humidifier.lobby"]["can_control"] is True  # devices.control now reaches humidifier too
    assert climate["climate.lobby"]["preset_modes"] is None and climate["climate.lobby"]["swing_modes"] is None  # the fixture reports none: never invented
    covers = {r["entity_id"]: r for r in a["cards"]["covers"]["entities"]}
    assert covers["cover.lobby_gate"]["door_class"] is True and covers["cover.lobby_gate"]["can_control"] is False
    assert covers["cover.lobby_blind"]["door_class"] is False and covers["cover.lobby_blind"]["can_control"] is True
    sensors = {r["entity_id"]: r for r in a["cards"]["sensors"]["entities"]}
    assert sensors["sensor.lobby_power"]["group"] == "power" and sensors["sensor.lobby_temp"]["group"] == "temperature"
    assert sensors["binary_sensor.lobby_battery"]["group"] == "battery"
    t = c.get("/api/v1/devices/tree").json()
    ground = next(f for f in t["floors"] if f["floor_id"] == "ground")
    strip = {x["entity_id"]: x for x in ground["climate"]}
    assert strip["climate.lobby"]["hvac_mode"] == "cool" and strip["climate.lobby"]["target_temperature"] == 22
    assert "humidifier.lobby" not in strip, "the strip is climate.* only; humidifier stays in the area card"
    assert {x["entity_id"] for x in t["building_climate"]} == {"climate.lobby"}


def test_bulk_cover_group_control_open_stop_position_with_exclusions(bulk_app):
    """CR-007 slice 4: the area's "כל התריסים" group control (open all / stop all / close all / position all) goes
    through the same bulk resolve/record/run path as every other kind - never a fan-out path of its own - with the
    same exclusions (never a door/garage/gate cover, never the map's door layer); position needs an argument, and a
    change to it since the dialog opened is refused like a changed entity set (the digest covers both)."""
    app, s, c, fake = bulk_app
    extra = [
        {"entity_id": "cover.lobby_gate", "state": "closed", "attributes": {"friendly_name": "Gate", "device_class": "gate", "current_position": 0}},
        {"entity_id": "cover.lobby_curtain", "state": "closed", "attributes": {"friendly_name": "Curtain", "device_class": "curtain", "current_position": 0}},
    ]
    assert c.post("/api/v1/ha/dev/states", json={"states": extra}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg(e["entity_id"], "lobby") for e in extra]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    # covers_open: cover.lobby_blind is already open (skipped as "already"); the closed curtain is sent; the gate excluded
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "covers_open"}).json()
    assert {t["entity_id"]: t["action_id"] for t in p["targets"]} == {"cover.lobby_curtain": "cover.open_cover"}
    assert p["skipped"]["already"] == 1
    assert {x["entity_id"]: x["reason"] for x in p["excluded"]} == {"cover.lobby_gate": "door_cover"}
    # covers_stop: nothing here is moving - nothing to send, the gate is still described as excluded
    st = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "covers_stop"}).json()
    assert st["count"] == 0 and {x["entity_id"] for x in st["excluded"]} == {"cover.lobby_gate"}
    # covers_position with no position: refused (422) before anything is resolved
    assert c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "covers_position"}).status_code == 422
    pp = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "covers_position", "position": 40}).json()
    assert {t["entity_id"] for t in pp["targets"]} == {"cover.lobby_blind", "cover.lobby_curtain"}  # both away from 40%
    r = c.post("/api/v1/devices/actions", json=_bulk(kind="covers_position", position=40, preview_digest=pp["digest"]))
    assert r.status_code == 202, r.text
    _finish(c, r.json()["id"])
    sent = {x["data"]["entity_id"]: x["data"].get("position") for x in fake.calls if x["service"] == "set_cover_position"}
    assert sent == {"cover.lobby_blind": 40, "cover.lobby_curtain": 40}
    # a stale digest (the requested position changed since the dialog opened) is refused, nothing sent
    fake.calls.clear()
    r2 = c.post("/api/v1/devices/actions", json=_bulk(kind="covers_position", position=90, preview_digest=pp["digest"]))
    assert r2.status_code == 409 and r2.json()["code"] == "target_changed" and not fake.calls


def test_bulk_group_cover_kinds_are_area_only(bulk_app):
    """CR-007 slice 4 review (MEDIUM 4): covers_stop / covers_position are the area's own "כל התריסים" group control -
    refused at floor/building scope, audited like any other refusal; covers_close (a slice-3 kind, part of the classic
    five-kind menu) is unaffected and stays valid at every scope. Owner decision 2026-09-29 (the tiles' panel "open all"):
    covers_open is valid at every scope too."""
    app, s, c, fake = bulk_app
    assert c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "covers_open"}).status_code == 200
    assert c.get("/api/v1/devices/actions/preview", params={"scope": "floor", "id": "ground", "kind": "covers_open"}).status_code == 200
    for kind in ("covers_stop", "covers_position"):
        params = {"scope": "building", "id": "*", "kind": kind}
        if kind == "covers_position":
            params["position"] = 40
        r = c.get("/api/v1/devices/actions/preview", params=params)
        assert r.status_code == 422 and r.json()["details"]["fields"] == ["scope"], (kind, r.text)
        params["scope"], params["id"] = "floor", "ground"
        r2 = c.get("/api/v1/devices/actions/preview", params=params)
        assert r2.status_code == 422, (kind, r2.text)
        body = _bulk(scope="building", id="*", kind=kind, **({"position": 40} if kind == "covers_position" else {}))
        r3 = c.post("/api/v1/devices/actions", json=body)
        assert r3.status_code == 422 and not fake.calls, (kind, r3.text)
    # covers_close (slice 3): still valid at every scope
    ok = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "covers_close"})
    assert ok.status_code == 200


def test_bulk_stop_all_is_reported_sent_not_confirmed(bulk_app):
    """CR-007 slice 4 review (MEDIUM 3): cover.stop_cover has nothing observable (no expect / expect_attr); the
    single first poll would otherwise mark it "confirmed" (services/ha_actions.refresh: no expected_state to wait
    for) and a bulk "stop all" would honestly-dishonestly read "בוצע" for something nobody verified. The outcome is
    "sent", never counted in counts.confirmed, and all_confirmed is false even though nothing failed."""
    app, s, c, fake = bulk_app
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "cover.lobby_blind", "state": "opening", "attributes": {"friendly_name": "Blind", "device_class": "blind", "current_position": 40}}]}).status_code == 200
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "covers_stop"}).json()
    assert p["count"] == 1
    r = c.post("/api/v1/devices/actions", json=_bulk(kind="covers_stop", preview_digest=p["digest"]))
    assert r.status_code == 202, r.text
    got = _finish(c, r.json()["id"])
    assert got["counts"]["confirmed"] == 0 and got["counts"]["sent"] == 1 and got["counts"]["total"] == 1
    assert got["items"][0]["outcome"] == "sent" and got["items"][0]["status"] == "confirmed"
    assert got["all_confirmed"] is False


def test_bulk_covers_position_skips_covers_without_position_support(bulk_app):
    """CR-007 slice 4 review (NIT 6): a cover that neither reports current_position nor advertises the SET_POSITION
    feature cannot be positioned at all - excluded (with a reason the dialog states), never sent, never counted as
    "already"."""
    app, s, c, fake = bulk_app
    extra = [{"entity_id": "cover.lobby_no_pos", "state": "open", "attributes": {"friendly_name": "Dumb blind"}, "supported_features": 0}]
    assert c.post("/api/v1/ha/dev/states", json={"states": extra}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg("cover.lobby_no_pos", "lobby")]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "covers_position", "position": 40}).json()
    assert "cover.lobby_no_pos" not in {t["entity_id"] for t in p["targets"]}
    assert {x["entity_id"]: x["reason"] for x in p["excluded"]}.get("cover.lobby_no_pos") == "no_position"


def test_assign_unassigned_entity_to_area(dev_app, monkeypatch):
    """CR-007 slice 4: an administrator assigns an entity with no HA area to one. system.configure gate (403 and
    audited without it), a Home Assistant CONFIG write through the bridge's own registry path (never a domain
    service call), audited under the real actor with the honest bridge answer, and the local mirror updated at once
    so the tree/area screens show the move without waiting for the next HA registry refresh."""
    app, s = dev_app
    c = TestClient(app)
    calls: list[dict] = []

    def fake_set_area(_settings, payload, timeout=15.0):
        calls.append(payload)
        return {"ok": True, "context_id": None, "request_id": payload["request_id"]}

    monkeypatch.setattr(ha_client, "call_bridge_set_area", fake_set_area)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.2.5"}))
    # a viewer (no system.configure) is refused before the bridge is ever reached, and the refusal is audited
    bind(c, s, "vi", "viewer", "installation", "*")
    r = c.put("/api/v1/devices/entities/switch.loose/area", json={"area_id": "office"}, headers=as_user("vi"))
    assert r.status_code == 403 and not calls
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT decision FROM audit_log WHERE action = 'system.configure' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row["decision"] == "denied"
    # an unknown entity / area is 404
    assert c.put("/api/v1/devices/entities/switch.nope/area", json={"area_id": "office"}).status_code == 404
    assert c.put("/api/v1/devices/entities/switch.loose/area", json={"area_id": "nowhere"}).status_code == 404
    # the bootstrap system_admin: switch.loose (unassigned) moves to the office
    before = c.get("/api/v1/devices/areas/unassigned").json()
    assert any(r["entity_id"] == "switch.loose" for card in before["cards"].values() for r in card["entities"])
    r = c.put("/api/v1/devices/entities/switch.loose/area", json={"area_id": "office"})
    assert r.status_code == 200 and r.json() == {"entity_id": "switch.loose", "area_id": "office", "area_name": "משרד"}
    assert calls[-1]["entity_id"] == "switch.loose" and calls[-1]["area_id"] == "office" and calls[-1]["user_id"]
    after_unassigned = c.get("/api/v1/devices/areas/unassigned").json()
    assert not any(r["entity_id"] == "switch.loose" for card in after_unassigned["cards"].values() for r in card["entities"])
    office = c.get("/api/v1/devices/areas/office").json()
    assert any(r["entity_id"] == "switch.loose" for card in office["cards"].values() for r in card["entities"])
    with app.state.db.connection() as conn:
        audit_row = dict(conn.execute("SELECT * FROM audit_log WHERE action = 'devices.assign_area' ORDER BY rowid DESC LIMIT 1").fetchone())
    assert audit_row["decision"] == "allowed" and json.loads(audit_row["details_json"])["area_id"] == "office"
    # can_assign_area: only on the unassigned bucket, and only for a system.configure holder
    assert c.get("/api/v1/devices/areas/unassigned").json()["can_assign_area"] is True
    assert c.get("/api/v1/devices/areas/lobby").json()["can_assign_area"] is False
    assert c.get("/api/v1/devices/areas/unassigned", headers=as_user("vi")).json()["can_assign_area"] is False
    # an honest bridge refusal is reported, not silently swallowed
    def fake_refuse(_settings, payload, timeout=15.0):
        return {"ok": False, "error": "entity_not_found"}

    monkeypatch.setattr(ha_client, "call_bridge_set_area", fake_refuse)
    r2 = c.put("/api/v1/devices/entities/light.garden/area", json={"area_id": "office"})
    assert r2.status_code == 404 and r2.json()["details"]["error"] == "entity_not_found"


def test_assign_area_checks_permission_before_the_body(dev_app):
    """CR-007 slice 4 review (MEDIUM 5): the permission is checked before the body is even parsed (the _raw_body
    pattern the bulk route already uses) - an unauthorized caller with a malformed / non-JSON body still gets an
    audited 403, never a bare 422 for a request it was never entitled to send."""
    app, s = dev_app
    c = TestClient(app)
    bind(c, s, "vi", "viewer", "installation", "*")
    with app.state.db.connection() as conn:
        before = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'system.configure' AND decision = 'denied'").fetchone()[0]
    r = c.put("/api/v1/devices/entities/switch.loose/area", content=b"not json at all", headers={**as_user("vi"), "content-type": "application/json"})
    assert r.status_code == 403, r.text
    r2 = c.put("/api/v1/devices/entities/switch.loose/area", content=b"plain text", headers={**as_user("vi"), "content-type": "text/plain"})
    assert r2.status_code == 403, r2.text
    r3 = c.put("/api/v1/devices/entities/switch.loose/area", json={"unexpected_field": 1}, headers=as_user("vi"))
    assert r3.status_code == 403, r3.text
    with app.state.db.connection() as conn:
        after = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'system.configure' AND decision = 'denied'").fetchone()[0]
    assert after == before + 3, "every refusal is audited"


# ---------------------------------------------------------------- overview tiles: one kind across a scope (owner 2026-09-29)


def _item_ids(body: dict) -> list[tuple[str, str, list[str]]]:
    return [(f["floor_id"], a["area_id"], [r["entity_id"] for r in a["items"]]) for f in body["floors"] for a in f["areas"]]


def test_items_one_kind_across_the_building_grouped_by_floor_and_area(dev_app):
    """GET /devices/items: every entity of one tile kind in the building, grouped floor › area in the tree's own order
    (floors by level, the floorless bucket, then "ללא שיוך"), each row with the area card's fields, its place and
    can_control, plus the counts the panel's header and filter need."""
    app, _ = dev_app
    c = TestClient(app)
    b = c.get("/api/v1/devices/items", params={"kind": "lights"}).json()
    assert b["kind"] == "lights" and b["scope"] == "building" and b["name"] == "המבנה" and b["truncated"] is False
    assert _item_ids(b) == [("ground", "lobby", ["light.lobby", "light.lobby_spot"]), ("second", "office", ["light.office"]), (svc.NO_FLOOR, "garden", ["light.garden"])]
    assert b["counts"] == {"total": 4, "active": 2, "inactive": 2, "unavailable": 0}
    lobby = b["floors"][0]["areas"][0]["items"][0]
    assert lobby["brightness_pct"] == 50 and lobby["active"] is True and lobby["last_changed"] and lobby["can_control"] is True
    assert (lobby["area_id"], lobby["area_name"], lobby["floor_id"]) == ("lobby", "לובי", "ground")
    assert b["floors"][2]["name"] == svc.NO_FLOOR_NAME
    # the switches: the loose one closes the list under "ללא שיוך"
    s = c.get("/api/v1/devices/items", params={"kind": "switches"}).json()
    assert _item_ids(s) == [("ground", "lobby", ["switch.lobby_sign"]), (svc.UNASSIGNED, svc.UNASSIGNED, ["switch.loose"])]
    assert s["counts"] == {"total": 2, "active": 1, "inactive": 1, "unavailable": 0}
    # the other kinds, each only its own domains
    kinds = {k: [r["entity_id"] for f in c.get("/api/v1/devices/items", params={"kind": k}).json()["floors"] for a in f["areas"] for r in a["items"]]
             for k in ("covers", "climate", "media", "locks", "alarm")}
    assert kinds == {"covers": ["cover.lobby_blind", "cover.office"], "climate": ["climate.lobby"], "media": ["media_player.lobby_tv"], "locks": ["lock.front"], "alarm": ["alarm_control_panel.house"]}
    alarm = c.get("/api/v1/devices/items", params={"kind": "alarm"}).json()
    assert alarm["counts"]["active"] == 1 and alarm["floors"][0]["areas"][0]["items"][0]["armed"] is True  # armed = "active" for a panel
    # an unavailable entity is counted apart and never as on or off
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET state = 'unavailable' WHERE entity_id = 'light.office'")
    b2 = c.get("/api/v1/devices/items", params={"kind": "lights"}).json()
    assert b2["counts"] == {"total": 4, "active": 2, "inactive": 1, "unavailable": 1}
    # nothing secret in the reply
    text = c.get("/api/v1/devices/items", params={"kind": "lights"}).text
    for needle in ("secret", "ha.local", "8123", "token", "attributes_json"):
        assert needle not in text, needle


def test_items_floor_and_area_scope_validation_and_unknown_scope(dev_app):
    app, _ = dev_app
    c = TestClient(app)
    g = c.get("/api/v1/devices/items", params={"kind": "lights", "scope": "floor", "id": "ground"}).json()
    assert g["name"] == "קרקע" and _item_ids(g) == [("ground", "lobby", ["light.lobby", "light.lobby_spot"])]
    none = c.get("/api/v1/devices/items", params={"kind": "lights", "scope": "floor", "id": svc.NO_FLOOR}).json()
    assert _item_ids(none) == [(svc.NO_FLOOR, "garden", ["light.garden"])]
    a = c.get("/api/v1/devices/items", params={"kind": "covers", "scope": "area", "id": "office"}).json()
    assert a["name"] == "משרד" and a["floor_name"] == "קומה 2" and _item_ids(a) == [("second", "office", ["cover.office"])]
    u = c.get("/api/v1/devices/items", params={"kind": "switches", "scope": "area", "id": "unassigned"}).json()
    assert _item_ids(u) == [(svc.UNASSIGNED, svc.UNASSIGNED, ["switch.loose"])] and u["can_bulk"] is False
    # an empty scope is an honest empty list, not an error
    e = c.get("/api/v1/devices/items", params={"kind": "media", "scope": "area", "id": "empty_room"}).json()
    assert e["floors"] == [] and e["counts"]["total"] == 0
    assert c.get("/api/v1/devices/items", params={"kind": "lights", "scope": "floor", "id": "nope"}).status_code == 404
    assert c.get("/api/v1/devices/items", params={"kind": "lights", "scope": "area", "id": "nope"}).status_code == 404
    assert c.get("/api/v1/devices/items", params={"kind": "lights", "scope": "floor"}).status_code == 422
    assert c.get("/api/v1/devices/items", params={"kind": "sensors"}).status_code == 422  # not a tile kind
    assert c.get("/api/v1/devices/items", params={"kind": "lights", "scope": "site"}).status_code == 422
    # the bulk flag follows the tree's (the bootstrap admin: devices.control_bulk installation-wide)
    assert c.get("/api/v1/devices/items", params={"kind": "lights"}).json()["can_bulk"] is True
    assert g["can_bulk"] is True and a["can_bulk"] is True


def test_items_permissions_read_only_rows_floor_scope_and_unlock_grant(dev_app):
    """A viewer reads the same list with can_control false everywhere; nobody without devices.read reads it; a
    floor-scoped reader sees only what is placed on their floors (404 for a scope they cannot see); a lock row says
    whether this caller may unlock it (door.unlock, which no built-in role holds)."""
    app, s = dev_app
    c = TestClient(app)
    c.get("/api/v1/me", headers=as_user("nobody"))
    assert c.get("/api/v1/devices/items", params={"kind": "lights"}, headers=as_user("nobody")).status_code == 403
    bind(c, s, "vi", "viewer", "installation", "*")
    v = c.get("/api/v1/devices/items", params={"kind": "lights"}, headers=as_user("vi")).json()
    assert v["counts"]["total"] == 4 and all(r["can_control"] is False for f in v["floors"] for a in f["areas"] for r in a["items"])
    assert v["can_bulk"] is False
    vl = c.get("/api/v1/devices/items", params={"kind": "locks"}, headers=as_user("vi")).json()
    assert [(r["can_control"], r["can_unlock"]) for f in vl["floors"] for a in f["areas"] for r in a["items"]] == [(False, False)]
    # the admin controls the lock (ha.entity.control) but may not unlock it without door.unlock
    al = c.get("/api/v1/devices/items", params={"kind": "locks"}).json()
    assert [(r["can_control"], r["can_unlock"]) for f in al["floors"] for a in f["areas"] for r in a["items"]] == [(True, False)]
    r = c.post("/api/v1/access/roles", json={"name": "פתיחת דלתות", "permissions": ["devices.read"], "sensitive": ["ha.entity.control", "door.unlock"]})
    assert r.status_code in (200, 201), r.text
    bind(c, s, "door", r.json()["id"], "installation", "*")
    dl = c.get("/api/v1/devices/items", params={"kind": "locks"}, headers=as_user("door")).json()
    assert [(r["can_control"], r["can_unlock"]) for f in dl["floors"] for a in f["areas"] for r in a["items"]] == [(True, True)]
    # a floor-scoped viewer: only the placed light, and the other floor's scope is not theirs
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    _place(c, ids["floor2"], "light.office")
    bind(c, s, "ron", "viewer", "floor", ids["floor2"])
    rb = c.get("/api/v1/devices/items", params={"kind": "lights"}, headers=as_user("ron")).json()
    assert rb["scoped"] is True and _item_ids(rb) == [("second", "office", ["light.office"])]
    assert c.get("/api/v1/devices/items", params={"kind": "lights", "scope": "floor", "id": "ground"}, headers=as_user("ron")).status_code == 404
    assert c.get("/api/v1/devices/items", params={"kind": "switches", "scope": "area", "id": "unassigned"}, headers=as_user("ron")).status_code == 404

# ---------------------------------------------------------------- the tiles' panel master control (owner 2026-09-29)


def test_bulk_master_switches_on_off_follow_the_bulk_safe_mark(bulk_app):
    """switches_off / switches_on: the same SwitchPolicy as "כבה הכל" - an administrator's bulk-safe mark is the only
    way a switch enters (turning ON is guarded exactly like off), never an input_boolean; only switches in the needed
    state are sent; the run goes through the ordinary bulk envelope, records and audit."""
    app, s, c, fake = bulk_app
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "switches_off"}).json()
    assert p["count"] == 0 and {x["entity_id"]: x["reason"] for x in p["excluded"]} == {"switch.lobby_sign": "switch_not_marked", "switch.loose": "switch_not_marked"}
    assert c.put("/api/v1/devices/entities/switch.lobby_sign/bulk-safe", json={"bulk_safe": True}).status_code == 200
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "switches_off"}).json()
    assert [t["entity_id"] for t in p["targets"]] == ["switch.lobby_sign"] and p["targets"][0]["action_id"] == "switch.turn_off"
    assert p["kind_label"] == "כיבוי מתגים"
    # already on: switches_on has nothing to send for it, and the unmarked loose switch stays out
    on = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "switches_on"}).json()
    assert on["count"] == 0 and on["skipped"]["already"] == 1 and [x["entity_id"] for x in on["excluded"]] == ["switch.loose"]
    r = c.post("/api/v1/devices/actions", json=_bulk(scope="building", id="*", kind="switches_off", preview_digest=p["digest"]))
    assert r.status_code == 202, r.text
    done = _finish(c, r.json()["id"])
    assert done["counts"]["confirmed"] == 1 and [call["service"] for call in fake.calls] == ["turn_off"]
    on = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "switches_on"}).json()
    assert [t["action_id"] for t in on["targets"]] == ["switch.turn_on"]
    r2 = c.post("/api/v1/devices/actions", json=_bulk(scope="building", id="*", kind="switches_on", preview_digest=on["digest"]))
    assert r2.status_code == 202, r2.text
    assert _finish(c, r2.json()["id"])["counts"]["confirmed"] == 1 and fake.calls[-1]["service"] == "turn_on"
    assert len(_audit_rows(app, phase="attempt", kind="switches_on")) == 1 and len(_audit_rows(app, phase="outcome", kind="switches_on")) == 1
    # a viewer / operator (no devices.control_bulk) is refused, as for every bulk kind
    bind(c, s, "op", "operator", "installation", "*")
    assert c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "switches_on"}, headers=as_user("op")).status_code == 403


def test_bulk_lights_and_screens_on_and_the_only_narrowing(bulk_app):
    """lights_on / screens_on send turn_on to what is off; `only` (the panel's filter / search) narrows the resolved
    set - it can never add an entity the rules left out (another scope, a lock, an unknown id)."""
    app, s, c, fake = bulk_app
    lo = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "lights_on"}).json()
    assert sorted(t["entity_id"] for t in lo["targets"]) == ["light.lobby_spot", "light.office"] and {t["action_id"] for t in lo["targets"]} == {"light.turn_on"}
    so = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "screens_on"}).json()
    assert so["count"] == 0 and so["skipped"]["already"] == 1  # the TV is playing
    full = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "lights_off"}).json()
    assert sorted(t["entity_id"] for t in full["targets"]) == ["light.garden", "light.lobby"] and full["narrowed"] is False
    one = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "lights_off", "only": "light.lobby"}).json()
    assert [t["entity_id"] for t in one["targets"]] == ["light.lobby"] and one["narrowed"] is True and one["digest"] != full["digest"]
    # only cannot widen: an entity of another area, a lock, an unknown id - none is added
    area = c.get("/api/v1/devices/actions/preview", params={"scope": "area", "id": "lobby", "kind": "lights_off", "only": "light.garden,lock.front,light.nope,light.lobby"}).json()
    assert [t["entity_id"] for t in area["targets"]] == ["light.lobby"]
    # the run honours the same narrowing and refuses a set that changed
    r = c.post("/api/v1/devices/actions", json=_bulk(scope="building", id="*", kind="lights_off", only=["light.lobby"], preview_digest=one["digest"]))
    assert r.status_code == 202, r.text
    done = _finish(c, r.json()["id"])
    assert [i["entity_id"] for i in done["items"]] == ["light.lobby"] and [call["data"]["entity_id"] for call in fake.calls] == ["light.lobby"]
    r2 = c.post("/api/v1/devices/actions", json=_bulk(scope="building", id="*", kind="lights_off", only=["light.garden"], preview_digest=one["digest"]))
    assert r2.status_code == 409 and r2.json()["code"] == "target_changed"
    assert c.post("/api/v1/devices/actions", json=_bulk(scope="building", id="*", kind="lights_off", only=[f"light.x{i}" for i in range(501)])).status_code == 422