"""The home screen's own settings (owner notes 2026-09-30): the editable title, the floor order, and the optional
header widgets (clock, weather, Jewish-calendar times) - validation, defaults (all off), who may change them, what the
tree carries, and that the widgets read only the mirrored catalogue."""
from __future__ import annotations

import json
from dataclasses import replace

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import devices as svc
from smplwise.services import ha_client, ha_sync, home_screen

NOW = "2026-09-30T10:00:00+00:00"


def _st(eid: str, state: str, **attrs) -> dict:
    return {"entity_id": eid, "state": state, "attributes": attrs, "last_changed": NOW, "last_updated": NOW}


STATES = [
    _st("light.a", "on", friendly_name="A"),
    _st("light.b", "off", friendly_name="B"),
    _st("light.c", "off", friendly_name="C"),
    _st("weather.home", "partlycloudy", friendly_name="Home", temperature=27.5, humidity=61, temperature_unit="°C"),
    _st("weather.gone", "unavailable", friendly_name="Gone"),
    _st("sensor.jewish_calendar_parshat_hashavua", "Vayechi", friendly_name="Parsha"),
    _st("sensor.jewish_calendar_upcoming_candle_lighting", "2026-10-02T17:32:00+03:00", friendly_name="Candles", device_class="timestamp"),
    _st("sensor.jewish_calendar_upcoming_havdalah", "2026-10-03T18:30:00+03:00", friendly_name="Havdalah", device_class="timestamp"),
    _st("sensor.kitchen_temp", "22", friendly_name="Kitchen", unit_of_measurement="°C", device_class="temperature"),
]
FLOORS = [
    {"floor_id": "f0", "name": "קרקע", "level": 0, "icon": None},
    {"floor_id": "f1", "name": "קומה 1", "level": 1, "icon": None},
    {"floor_id": "fm1", "name": "קומה -1", "level": -1, "icon": None},
]
AREAS = [
    {"area_id": "a0", "name": "לובי", "floor_id": "f0", "icon": None},
    {"area_id": "a1", "name": "משרד", "floor_id": "f1", "icon": None},
    {"area_id": "am1", "name": "חניון", "floor_id": "fm1", "icon": None},
]


def _reg(eid: str, area: str | None, platform: str | None = None) -> dict:
    return {"entity_id": eid, "id": f"reg-{eid}", "area_id": area, "device_id": None, "entity_category": None, "platform": platform}


REGISTRY = [
    _reg("light.a", "a0"),
    _reg("light.b", "a1"),
    _reg("light.c", "am1"),
    _reg("weather.home", None),
    _reg("sensor.jewish_calendar_parshat_hashavua", None, "jewish_calendar"),
    _reg("sensor.jewish_calendar_upcoming_candle_lighting", None, "jewish_calendar"),
    _reg("sensor.jewish_calendar_upcoming_havdalah", None, "jewish_calendar"),
    _reg("sensor.kitchen_temp", "a0"),
]


@pytest.fixture()
def app_c(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    from smplwise.main import create_app

    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        ha_sync.apply_registry(conn, ha_client.registry_maps(REGISTRY, [], AREAS, FLOORS))
        ha_sync.apply_structure(conn, AREAS, FLOORS)
    return app, s


def _patch(c: TestClient, body: dict, **kw):
    return c.patch("/api/v1/settings", json=body, **kw)


def test_defaults_are_all_off_and_the_tree_carries_no_widgets(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        st = c.get("/api/v1/settings").json()["settings"]
        assert st["home.title"] == "" and st["home.floor_order"] == "[]" and st["home.clock"] == "off"
        assert st["home.weather"] == "false" and st["home.jewish"] == "false"
        assert st["home.weather_entity"] == "" and st["home.jewish_parsha"] == ""
        t = c.get("/api/v1/devices/tree").json()
        assert t["home"] == {"clock": "off", "time_zone": "Asia/Jerusalem", "weather": None, "jewish": None}
        # the level order stays the default one
        assert [f["floor_id"] for f in t["floors"]] == ["fm1", "f0", "f1"]


def test_title_round_trips_is_trimmed_and_audited(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        r = _patch(c, {"home.title": "  הבית שלנו  "})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["home.title"] == "הבית שלנו"
        assert c.get("/api/v1/settings").json()["settings"]["home.title"] == "הבית שלנו"
        assert _patch(c, {"home.title": "x" * 61}).status_code == 422
        assert _patch(c, {"home.title": "a\nb"}).status_code == 422
        assert _patch(c, {"home.title": ""}).json()["settings"]["home.title"] == ""  # empty = the default title
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"home.title": "הבית שלנו"} in rows


def test_widget_settings_are_validated(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        assert _patch(c, {"home.clock": "datetime", "home.weather": "true", "home.weather_entity": "weather.home"}).status_code == 200
        assert _patch(c, {"home.clock": "analog"}).status_code == 422
        assert _patch(c, {"home.weather": "yes"}).status_code == 422
        assert _patch(c, {"home.weather_entity": "sensor.kitchen_temp"}).status_code == 422  # a weather widget takes weather.* only
        assert _patch(c, {"home.weather_entity": "weather.Home"}).status_code == 422
        assert _patch(c, {"home.jewish_parsha": "weather.home"}).status_code == 422  # the Jewish widget takes sensor.* only
        assert _patch(c, {"home.jewish_candles": "sensor.a b"}).status_code == 422
        assert _patch(c, {"home.jewish_havdalah": "sensor.jewish_calendar_upcoming_havdalah"}).status_code == 200
        assert _patch(c, {"home.weather_entity": ""}).json()["settings"]["home.weather_entity"] == ""


def test_floor_order_validation_and_normalisation(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        r = _patch(c, {"home.floor_order": json.dumps(["f0", "f1", "fm1"])})
        assert r.status_code == 200, r.text
        assert json.loads(r.json()["settings"]["home.floor_order"]) == ["f0", "f1", "fm1"]
        for bad in ('{"a": 1}', "not json", '["f0", "f0"]', '["f0", ""]', "[1, 2]", json.dumps(["x"] * 101), '["' + "y" * 101 + '"]', '["a\\nb"]'):
            assert _patch(c, {"home.floor_order": bad}).status_code == 422, bad
        assert json.loads(_patch(c, {"home.floor_order": ""}).json()["settings"]["home.floor_order"]) == []


def test_floors_follow_the_stored_order_the_rest_after_in_level_order(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        _patch(c, {"home.floor_order": json.dumps(["f0", "fm1"])})
        t = c.get("/api/v1/devices/tree").json()
        assert [f["floor_id"] for f in t["floors"]] == ["f0", "fm1", "f1"]
        # an id no floor has is ignored; a new floor (f1 here, not listed) simply appends
        _patch(c, {"home.floor_order": json.dumps(["ghost", "f1"])})
        assert [f["floor_id"] for f in c.get("/api/v1/devices/tree").json()["floors"]] == ["f1", "fm1", "f0"]
        # the items panel (grouped floor > area) follows the same order
        items = c.get("/api/v1/devices/items?kind=lights").json()
        assert [g["floor_id"] for g in items["floors"]] == ["f1", "fm1", "f0"]
        _patch(c, {"home.floor_order": "[]"})
        assert [f["floor_id"] for f in c.get("/api/v1/devices/tree").json()["floors"]] == ["fm1", "f0", "f1"]


def test_order_floors_is_stable_and_pure():
    floors = [{"floor_id": x} for x in ("a", "b", "c", "d")]
    assert [f["floor_id"] for f in home_screen.order_floors(floors, ["c", "a"])] == ["c", "a", "b", "d"]
    assert home_screen.order_floors(floors, []) is floors
    assert home_screen.parse_floor_order('["a", 3, "a", "b"]') == ["a", "b"]
    assert home_screen.parse_floor_order("garbage") == [] and home_screen.parse_floor_order(None) == []


def test_weather_widget_reads_the_mirrored_entity_only_when_switched_on(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        _patch(c, {"home.weather_entity": "weather.home"})
        assert c.get("/api/v1/devices/tree").json()["home"]["weather"] is None  # configured but off
        _patch(c, {"home.weather": "true"})
        w = c.get("/api/v1/devices/tree").json()["home"]["weather"]
        assert w == {"entity_id": "weather.home", "condition": "partlycloudy", "temperature": 27.5, "unit": "°C", "humidity": 61.0}
        # unavailable / missing entity: the widget is simply absent
        _patch(c, {"home.weather_entity": "weather.gone"})
        assert c.get("/api/v1/devices/tree").json()["home"]["weather"] is None
        _patch(c, {"home.weather_entity": "weather.nowhere"})
        assert c.get("/api/v1/devices/tree").json()["home"]["weather"] is None


def test_jewish_widget_shows_only_the_configured_available_parts(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        _patch(c, {"home.jewish_parsha": "sensor.jewish_calendar_parshat_hashavua", "home.jewish_candles": "sensor.jewish_calendar_upcoming_candle_lighting", "home.jewish_havdalah": "sensor.jewish_calendar_upcoming_havdalah"})
        assert c.get("/api/v1/devices/tree").json()["home"]["jewish"] is None  # off
        _patch(c, {"home.jewish": "true"})
        j = c.get("/api/v1/devices/tree").json()["home"]["jewish"]
        assert j["parsha"]["state"] == "Vayechi" and j["candles"]["device_class"] == "timestamp" and j["havdalah"]["state"].startswith("2026-10-03")
        _patch(c, {"home.jewish_candles": "", "home.jewish_havdalah": ""})
        assert set(c.get("/api/v1/devices/tree").json()["home"]["jewish"]) == {"parsha"}
        _patch(c, {"home.jewish_parsha": ""})
        assert c.get("/api/v1/devices/tree").json()["home"]["jewish"] is None


def test_clock_mode_and_zone_reach_the_tree(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        _patch(c, {"home.clock": "time", "time.zone": "Europe/London"})
        assert c.get("/api/v1/devices/tree").json()["home"] == {"clock": "time", "time_zone": "Europe/London", "weather": None, "jewish": None}


def test_candidates_list_weather_and_sensors_with_the_jewish_calendar_first_and_need_system_configure(app_c, settings):
    app, s = app_c
    with TestClient(app) as c:
        cand = c.get("/api/v1/devices/home-candidates").json()
        assert {w["entity_id"] for w in cand["weather"]} == {"weather.home", "weather.gone"}
        ids = [x["entity_id"] for x in cand["sensors"]]
        assert ids[:3] and all(i.startswith("sensor.jewish_calendar_") for i in ids[:3]) and "sensor.kitchen_temp" in ids[3:]
        assert all(x["suggested"] for x in cand["sensors"][:3]) and not cand["sensors"][-1]["suggested"]
        bind(c, s, "ron", "viewer", "installation", "*")
        assert c.get("/api/v1/devices/home-candidates", headers=as_user("ron")).status_code == 403
        # a viewer reads the settings and the tree (with the widgets) but cannot change any home.* key
        assert c.get("/api/v1/settings", headers=as_user("ron")).json()["settings"]["home.title"] == ""
        assert _patch(c, {"home.title": "x"}, headers=as_user("ron")).status_code == 403
        assert _patch(c, {"home.floor_order": '["f0"]'}, headers=as_user("ron")).status_code == 403
        assert "home" in c.get("/api/v1/devices/tree", headers=as_user("ron")).json()


def test_the_weather_unit_attribute_is_kept_by_the_sync_allow_list():
    assert "temperature_unit" in ha_sync.ATTR_ALLOW and "temperature" in ha_sync.ATTR_ALLOW and "humidity" in ha_sync.ATTR_ALLOW


def test_no_floor_bucket_can_be_ordered_too(app_c):
    """A floor-less area (the "ללא קומה" bucket, floor id `none`) is a floor entry like any other in the order."""
    app, _ = app_c
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_areas SET floor_id = NULL WHERE area_id = 'am1'")
    with TestClient(app) as c:
        assert [f["floor_id"] for f in c.get("/api/v1/devices/tree").json()["floors"]][-1] == svc.NO_FLOOR
        _patch(c, {"home.floor_order": json.dumps([svc.NO_FLOOR])})
        assert [f["floor_id"] for f in c.get("/api/v1/devices/tree").json()["floors"]][0] == svc.NO_FLOOR
