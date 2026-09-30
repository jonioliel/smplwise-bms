"""Owner decisions 2026-09-30 (area screen redesign): the `screen.personalize` permission (system_admin only, sensitive), the
`devices.area_design` setting, the layout items' `bulk_look` and `main` (the sensors card's main strip), and the two read
routes behind "choose among ALL existing sensors": GET /devices/entities (rows by id, same visibility as the tree) and
GET /devices/entity-pool (the editor's whole list, system.configure)."""
from __future__ import annotations

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from test_devices import dev_app  # noqa: F401 - the HA structure fixture (floors, areas, entities)

from smplwise.rbac import ROLES
from smplwise.routers import device_layouts as mod
from smplwise.routers.access import PERMISSION_LABELS

URL = "/api/v1/devices/layouts"


def _put(c, sid, layout, revision=0, headers=None):
    return c.put(f"{URL}/area/{sid}", json={"variant": "desktop", "revision": revision, "layout": layout}, headers=headers)


def test_screen_personalize_is_not_defined_here_and_no_default_role_but_system_admin_holds_it():
    """The permission itself is the home branch's (label, sensitivity, catalogue); this branch only checks `can(...)` in the
    UI. Whatever defines it, the area redesign's rule holds: no role but system_admin has it by default - asserted only once
    it exists in the role table, so the test is valid before and after that branch is merged."""
    holders = {r for r, perms in ROLES.items() if "screen.personalize" in perms}
    assert holders <= {"system_admin"}
    if "screen.personalize" in PERMISSION_LABELS:
        assert PERMISSION_LABELS["screen.personalize"]


def test_area_design_setting_defaults_to_dense_tiles_and_is_validated(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    assert c.get("/api/v1/settings").json()["settings"]["devices.area_design"] == "tiles"
    assert c.patch("/api/v1/settings", json={"devices.area_design": "sections"}).json()["settings"]["devices.area_design"] == "sections"
    for bad in ("", "grid", "TILES"):
        assert c.patch("/api/v1/settings", json={"devices.area_design": bad}).status_code == 422
    assert c.patch("/api/v1/settings", json={"devices.area_design": "tiles"}).status_code == 200


def test_bulk_look_and_main_sensors_in_the_layout(dev_app):  # noqa: F811
    app, _ = dev_app
    c = TestClient(app)
    item = {"x": 0, "y": 0, "w": 6, "h": 20}
    layout = {"v": 2, "cols": 12, "items": {
        "card:lighting": {**item, "bulk_look": "icon"},
        "card:sensors": {"x": 6, "y": 0, "w": 6, "h": 20, "main": ["sensor.lobby_temp", "sensor.elsewhere_humidity"]},
    }}
    r = _put(c, "lobby", layout)
    assert r.status_code == 200, r.text
    items = r.json()["desktop"]["layout"]["items"]
    assert items["card:lighting"]["bulk_look"] == "icon"
    assert items["card:sensors"]["main"] == ["sensor.lobby_temp", "sensor.elsewhere_humidity"]  # any sensor, this order
    # nothing extra is stored for an item without them
    plain = _put(c, "office", {"v": 1, "cols": 12, "items": {"card:lighting": item}})
    assert plain.status_code == 200 and "bulk_look" not in plain.json()["desktop"]["layout"]["items"]["card:lighting"] and "main" not in plain.json()["desktop"]["layout"]["items"]["card:lighting"]
    bad = {
        "a look that does not exist": {"card:lighting": {**item, "bulk_look": "big"}},
        "main on a lighting card": {"card:lighting": {**item, "main": ["sensor.lobby_temp"]}},
        "a duplicate main sensor": {"card:sensors": {**item, "main": ["sensor.a", "sensor.a"]}},
        "a main id that is not an entity id": {"card:sensors": {**item, "main": ["nope"]}},
        "too many main sensors": {"card:sensors": {**item, "main": [f"sensor.s{i}" for i in range(mod.MAX_MAIN_SENSORS + 1)]}},
    }
    for name, items in bad.items():
        assert _put(c, "lobby", {"v": 2, "cols": 12, "items": items}, revision=1).status_code == 422, name
    assert _put(c, "lobby", {"v": 1, "cols": 12, "items": {"card:sensors": {**item, "main": []}}}, revision=1).status_code == 200


def test_entity_rows_by_id_use_the_trees_visibility(dev_app):  # noqa: F811
    app, s = dev_app
    c = TestClient(app)
    r = c.get("/api/v1/devices/entities", params={"ids": "sensor.lobby_temp,light.office,sensor.nowhere,script.night"})
    assert r.status_code == 200, r.text
    rows = {x["entity_id"]: x for x in r.json()["entities"]}
    assert set(rows) == {"sensor.lobby_temp", "light.office"}  # an unknown id and a non-device entity are simply absent
    assert rows["sensor.lobby_temp"]["card"] == "sensors" and rows["sensor.lobby_temp"]["group"] == "temperature" and rows["sensor.lobby_temp"]["value"] == 23.5
    assert rows["light.office"]["area_id"] == "office" and rows["light.office"]["can_control"] is True
    # a floor-scoped viewer with nothing placed sees none of them; a plain viewer sees them read-only
    ids = seed_tree(c)
    bind(c, s, "flo", "viewer", "floor", ids["floor2"])
    bind(c, s, "vera", "viewer", "installation", "*")
    assert c.get("/api/v1/devices/entities", params={"ids": "sensor.lobby_temp"}, headers=as_user("flo")).json()["entities"] == []
    seen = c.get("/api/v1/devices/entities", params={"ids": "light.office"}, headers=as_user("vera")).json()["entities"]
    assert len(seen) == 1 and seen[0]["can_control"] is False
    assert c.get("/api/v1/devices/entities", params={"ids": ""}).status_code == 422
    many = ",".join(f"sensor.s{i}" for i in range(300))
    assert c.get("/api/v1/devices/entities", params={"ids": many}).status_code == 200  # capped, not refused


def test_entity_pool_lists_every_visible_device_for_system_configure_only(dev_app):  # noqa: F811
    app, s = dev_app
    c = TestClient(app)
    pool = c.get("/api/v1/devices/entity-pool").json()["entities"]
    ids = {e["entity_id"] for e in pool}
    assert {"sensor.lobby_temp", "light.garden", "switch.loose", "light.office"} <= ids  # in an area, on no floor, in no area
    assert "script.night" not in ids and "sensor.lobby_rssi" not in ids  # not part of the area screens at all
    temp = next(e for e in pool if e["entity_id"] == "sensor.lobby_temp")
    assert temp["card"] == "sensors" and temp["group"] == "temperature" and temp["area_id"] == "lobby"
    assert next(e for e in pool if e["entity_id"] == "switch.loose")["area_id"] is None
    bind(c, s, "vera", "viewer", "installation", "*")
    assert c.get("/api/v1/devices/entity-pool", headers=as_user("vera")).status_code == 403
