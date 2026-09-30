"""Release 0.1.149: what the home screen shows next to an area's name (`devices.area_row`) and in a floor's header
(`devices.floor_row`) - the normalisers, the settings round trip (defaults, validation, audit, the system.configure gate),
the personal override in /me/prefs (screen.personalize) and the per-area indicators the devices tree now carries."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_devices import dev_app  # noqa: F401  (the fixture: the lobby / office / garden catalogue)

from smplwise.main import create_app
from smplwise.services import area_row


# ------------------------------------------------------------------------------------------------ the normalisers

def test_defaults_are_short_and_every_default_item_is_known():
    assert area_row.normalize_area({}) == {"items": ["climate", "lights", "switches", "media"], "climate": "temp", "show_empty": False}
    assert area_row.normalize_floor({}) == {"items": ["lights", "switches", "covers", "climate", "media", "locks", "sensors"]}
    assert set(area_row.AREA_ROW_DEFAULT["items"]) <= set(area_row.AREA_ITEMS)
    assert set(area_row.FLOOR_ROW_DEFAULT["items"]) <= set(area_row.FLOOR_ITEMS)


def test_area_row_keeps_the_given_order_and_fills_the_missing_keys():
    got = area_row.normalize_area({"items": ["media", "temperature", "climate"], "climate": "mode"})
    assert got == {"items": ["media", "temperature", "climate"], "climate": "mode", "show_empty": False}
    assert area_row.normalize_area({"items": []})["items"] == []  # an empty row is a valid choice
    assert area_row.normalize_area({"show_empty": True})["show_empty"] is True


@pytest.mark.parametrize(
    "bad",
    [
        [], "items", {"items": "lights"}, {"items": ["lights", "lights"]}, {"items": ["lights", "teapot"]}, {"items": [1]},
        {"items": list(area_row.AREA_ITEMS) + ["lights"]},
        {"climate": "snow"}, {"climate": None}, {"show_empty": "true"}, {"show_empty": 1}, {"colour": "red"},
    ],
)
def test_area_row_refuses_anything_else(bad):
    with pytest.raises(ValueError):
        area_row.normalize_area(bad)


@pytest.mark.parametrize("bad", [{"items": ["sensors", "sensors"]}, {"items": ["alarm"]}, {"items": "lights"}, {"extra": 1}, []])
def test_floor_row_refuses_anything_else(bad):
    with pytest.raises(ValueError):
        area_row.normalize_floor(bad)


def test_personal_override_keeps_only_what_the_user_set():
    assert area_row.normalise_personal({}) == {}
    assert area_row.normalise_personal({"items": None, "climate": None}) == {}
    got = area_row.normalise_personal({"items": ["climate"], "climate": "icon", "show_empty": True, "floor_items": ["lights"]})
    assert got == {"items": ["climate"], "climate": "icon", "show_empty": True, "floor_items": ["lights"]}
    for bad in ({"items": ["x"]}, {"climate": "x"}, {"show_empty": "no"}, {"floor_items": ["temperature"]}, {"other": 1}):
        with pytest.raises(ValueError):
            area_row.normalise_personal(bad)


# ------------------------------------------------------------------------------------------------ the installation's settings

def test_settings_defaults_round_trip_validation_audit_and_gate(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        before = c.get("/api/v1/settings").json()["settings"]
        assert before["devices.area_row"] == area_row.AREA_ROW_DEFAULT and before["devices.floor_row"] == area_row.FLOOR_ROW_DEFAULT  # read back as objects
        change = {"devices.area_row": {"items": ["temperature", "climate", "openings"], "climate": "icon", "show_empty": True}, "devices.floor_row": {"items": ["climate", "lights"]}}
        r = c.patch("/api/v1/settings", json=change)
        assert r.status_code == 200, r.text
        assert {k: r.json()["settings"][k] for k in change} == change
        assert {k: c.get("/api/v1/settings").json()["settings"][k] for k in change} == change
        # a partial object keeps the defaults of the keys left out, and is stored canonical
        assert c.patch("/api/v1/settings", json={"devices.area_row": {"items": ["locks"]}}).json()["settings"]["devices.area_row"] == {"items": ["locks"], "climate": "temp", "show_empty": False}
        # nothing outside the lists: refused with the key named, and nothing changes
        for key, bad in (
            ("devices.area_row", {"items": ["lights", "lights"]}), ("devices.area_row", {"items": ["fridge"]}), ("devices.area_row", {"climate": "fan"}),
            ("devices.area_row", {"show_empty": "true"}), ("devices.area_row", {"x": 1}), ("devices.floor_row", {"items": ["temperature"]}), ("devices.floor_row", {"items": ["lights", "lights"]}),
        ):
            r = c.patch("/api/v1/settings", json={key: bad})
            assert r.status_code == 422, (key, bad)
            assert key in json.dumps(r.json(), ensure_ascii=False)
        assert c.get("/api/v1/settings").json()["settings"]["devices.area_row"] == {"items": ["locks"], "climate": "temp", "show_empty": False}
        # audited like any product setting
        with app.state.db.connection() as conn:
            rows = [json.loads(x[0] or "{}") for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert change in rows
        # any user reads them; only system.configure writes them
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["devices.area_row"] == {"items": ["locks"], "climate": "temp", "show_empty": False}
        assert c.patch("/api/v1/settings", json={"devices.area_row": {"items": []}}, headers=as_user("dana")).status_code == 403
        # back to the defaults
        assert c.patch("/api/v1/settings", json={"devices.area_row": area_row.AREA_ROW_DEFAULT, "devices.floor_row": area_row.FLOOR_ROW_DEFAULT}).status_code == 200


def test_a_corrupt_stored_value_reads_as_the_default(settings):
    from smplwise.db import set_setting

    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            set_setting(conn, "devices.area_row", "{not json")
            set_setting(conn, "devices.floor_row", json.dumps({"items": ["nope"]}))
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["devices.area_row"] == area_row.AREA_ROW_DEFAULT and s["devices.floor_row"] == area_row.FLOOR_ROW_DEFAULT


# ------------------------------------------------------------------------------------------------ the personal override

PERSONAL = {"items": ["temperature", "climate"], "climate": "mode", "floor_items": ["lights"]}


def test_personal_override_needs_screen_personalize_and_is_per_user(settings):
    app = create_app(settings)
    with TestClient(app) as c:  # the dev identity is the bootstrap system administrator (holds screen.personalize)
        r = c.put("/api/v1/me/prefs", json={"devices.area_row": PERSONAL})
        assert r.status_code == 200, r.text
        assert r.json()["prefs"]["devices.area_row"] == PERSONAL and "devices.area_row" in r.json()["stored"]
        assert c.put("/api/v1/me/prefs", json={"devices.area_row": {"items": ["nope"]}}).status_code == 422  # validated on write
        bind(c, settings, "ron", "viewer", "installation", "*")
        # a user without the permission: refused (and audited), never sees a value, another user's value is not theirs
        r = c.put("/api/v1/me/prefs", headers=as_user("ron"), json={"devices.area_row": PERSONAL})
        assert r.status_code == 403 and "screen.personalize" in json.dumps(r.json())
        got = c.get("/api/v1/me/prefs", headers=as_user("ron")).json()
        assert got["prefs"]["devices.area_row"] is None and "devices.area_row" not in got["stored"]
        assert c.put("/api/v1/me/prefs", headers=as_user("ron"), json={"devices.area_row": None}).status_code == 200  # clearing is always allowed
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'screen.personalize' AND decision = 'denied'").fetchone()[0] == 1
        # the administrator resets theirs
        assert c.put("/api/v1/me/prefs", json={"devices.area_row": None}).json()["prefs"]["devices.area_row"] is None


# ------------------------------------------------------------------------------------------------ the tree's per-area indicators

def test_tree_areas_carry_their_climate_temperature_and_open_count(dev_app):  # noqa: F811
    app, _s = dev_app
    c = TestClient(app)
    tree = c.get("/api/v1/devices/tree").json()
    areas = {a["area_id"]: a for f in tree["floors"] for a in f["areas"]}
    lobby = areas["lobby"]
    assert [x["entity_id"] for x in lobby["climate"]] == ["climate.lobby"]
    assert lobby["climate"][0]["hvac_mode"] == "cool" and lobby["climate"][0]["current_temperature"] == 25.5
    assert lobby["temperature"] == 23.5  # the area's own temperature sensor wins over the air conditioner's reading
    assert lobby["open_count"] == 0  # the front contact is closed
    assert areas["office"]["climate"] == [] and areas["office"]["temperature"] is None and areas["office"]["open_count"] == 0  # nothing invented


def test_tree_temperature_falls_back_to_the_air_conditioners_and_counts_open_doors(dev_app):  # noqa: F811
    from test_devices import AREAS, ENTITY_REGISTRY, FLOORS, _reg

    app, _s = dev_app
    c = TestClient(app)
    states = [
        {"entity_id": "climate.office_ac", "state": "heat", "attributes": {"friendly_name": "Office AC", "current_temperature": 20, "temperature": 24, "hvac_action": "heating"}},
        {"entity_id": "climate.office_ac2", "state": "off", "attributes": {"friendly_name": "Office AC 2", "current_temperature": 22}},
        {"entity_id": "binary_sensor.lobby_window", "state": "on", "attributes": {"friendly_name": "Window", "device_class": "window"}},
        {"entity_id": "binary_sensor.lobby_motion", "state": "on", "attributes": {"friendly_name": "Motion", "device_class": "motion"}},  # not an opening
        {"entity_id": "sensor.lobby_temp", "state": "unavailable", "attributes": {"friendly_name": "Lobby temp", "device_class": "temperature"}},
    ]
    assert c.post("/api/v1/ha/dev/states", json={"states": states}).status_code == 200
    reg = ENTITY_REGISTRY + [_reg("climate.office_ac", "office"), _reg("climate.office_ac2", "office"), _reg("binary_sensor.lobby_window", "lobby"), _reg("binary_sensor.lobby_motion", "lobby")]
    assert c.post("/api/v1/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS}).status_code == 200
    areas = {a["area_id"]: a for f in c.get("/api/v1/devices/tree").json()["floors"] for a in f["areas"]}
    assert areas["office"]["temperature"] == 21.0 and len(areas["office"]["climate"]) == 2  # the mean of the two readings
    assert areas["lobby"]["open_count"] == 1
    assert areas["lobby"]["temperature"] == 25.5  # the sensor is unavailable: the air conditioner's reading
