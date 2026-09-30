"""The home screen's own settings (owner notes 2026-09-30, and the home redesign of the same day): the editable title, the
floor order, the direction (a / b / c) and the widget configuration - clock, weather, Shabbat, the alarm card, the quick
actions - validation, defaults (with the catalogue's suggestions), who may change them, what the tree carries, and that the
widgets read only the mirrored catalogue."""
from __future__ import annotations

import copy
import json
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.services import devices as svc
from smplwise.services import ha_client, ha_sync, home_config, home_screen

NOW = "2026-09-30T10:00:00+00:00"
ROOT = Path(__file__).resolve().parents[3]


def _st(eid: str, state: str, **attrs) -> dict:
    return {"entity_id": eid, "state": state, "attributes": attrs, "last_changed": NOW, "last_updated": NOW}


FORECAST = [
    {"datetime": "2026-09-30T14:00:00+03:00", "condition": "sunny", "temperature": 29},
    {"datetime": "2026-09-30T15:00:00+03:00", "condition": "cloudy", "temperature": 28, "extra": "dropped"},
]
STATES = [
    _st("light.a", "on", friendly_name="A"),
    _st("light.b", "off", friendly_name="B"),
    _st("light.c", "off", friendly_name="C"),
    _st("weather.home", "partlycloudy", friendly_name="Home", temperature=27.5, humidity=61, temperature_unit="°C", wind_speed=14, wind_speed_unit="km/h",
        wind_bearing=270, pressure=1012.3, pressure_unit="hPa", uv_index=6, visibility=10, visibility_unit="km", forecast=FORECAST),
    _st("weather.bare", "sunny", friendly_name="Bare", temperature=20),
    _st("sensor.jewish_calendar_date", "כ״ט באלול ה׳תשפ״ו", friendly_name="Hebrew date"),
    _st("weather.gone", "unavailable", friendly_name="Gone"),
    _st("sensor.jewish_calendar_weekly_portion", "Vayechi", friendly_name="Parsha"),
    _st("sensor.jewish_calendar_upcoming_candle_lighting", "2026-10-02T17:32:00+03:00", friendly_name="Candles", device_class="timestamp"),
    _st("sensor.jewish_calendar_upcoming_havdalah", "2026-10-03T18:30:00+03:00", friendly_name="Havdalah", device_class="timestamp"),
    _st("sensor.jewish_calendar_holiday", "Rosh Hashana", friendly_name="Holiday"),
    _st("binary_sensor.jewish_calendar_issur_melacha_in_effect", "off", friendly_name="Issur melacha"),
    _st("sensor.kitchen_temp", "22", friendly_name="Kitchen", unit_of_measurement="°C", device_class="temperature"),
    _st("alarm_control_panel.house", "armed_away", friendly_name="House"),
    _st("sensor.floor_temp", "21.5", friendly_name="Floor temp", unit_of_measurement="°C", device_class="temperature"),
    _st("sensor.other_floor_temp", "33.3", friendly_name="Other floor temp", unit_of_measurement="°C", device_class="temperature"),
    _st("binary_sensor.zone_door", "on", friendly_name="Zone door", device_class="door"),
    _st("alarm_control_panel.annex", "disarmed", friendly_name="Annex"),
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
    _reg("sensor.jewish_calendar_weekly_portion", None, "jewish_calendar"),
    _reg("sensor.jewish_calendar_upcoming_candle_lighting", None, "jewish_calendar"),
    _reg("sensor.jewish_calendar_upcoming_havdalah", None, "jewish_calendar"),
    _reg("sensor.jewish_calendar_holiday", None, "jewish_calendar"),
    _reg("binary_sensor.jewish_calendar_issur_melacha_in_effect", None, "jewish_calendar"),
    _reg("sensor.kitchen_temp", "a0"),
    _reg("sensor.jewish_calendar_date", None, "jewish_calendar"),
    _reg("alarm_control_panel.house", "a0"),
    _reg("alarm_control_panel.annex", "a1"),
    _reg("sensor.floor_temp", None),
    _reg("sensor.other_floor_temp", None),
    _reg("binary_sensor.zone_door", None),
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


def _home(c: TestClient, **kw) -> dict:
    return c.get("/api/v1/devices/tree", **kw).json()["home"]


def _cfg(c: TestClient) -> dict:
    return c.get("/api/v1/settings").json()["settings"]["home.widgets"]


# ------------------------------------------------------------------------------------------------ defaults


def test_defaults_are_the_control_centre_with_every_widget_on_and_the_catalogues_suggestions(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        st = c.get("/api/v1/settings").json()["settings"]
        assert st["home.title"] == "" and st["home.floor_order"] == "[]"
        assert st["home.direction"] == "a" and st["home.side"] == "end"  # owner decision: the default direction is the control centre
        cfg = st["home.widgets"]
        assert cfg["order"] == ["clock", "weather", "shabbat", "alarm", "quick"]
        assert all(cfg[w]["on"] for w in home_config.WIDGET_IDS)
        assert cfg["clock"]["sizes"] == {"a": "l", "b": "m", "c": "m"} and cfg["alarm"]["sizes"]["b"] == "s"
        # suggestions: the first available weather entity and one sensor per Jewish-calendar field, from the catalogue
        assert cfg["weather"]["entity"] == "weather.bare" and cfg["weather"]["fields"] == ["temperature", "condition", "humidity", "wind", "forecast"]
        assert cfg["calendar"] == {"date": "sensor.jewish_calendar_date", "parsha": "sensor.jewish_calendar_weekly_portion", "candles": "sensor.jewish_calendar_upcoming_candle_lighting",
                                   "havdalah": "sensor.jewish_calendar_upcoming_havdalah", "holiday": "sensor.jewish_calendar_holiday", "extras": []}
        h = _home(c)
        assert h["direction"] == "a" and h["side"] == "end" and h["personalize"] is True and h["time_zone"] == "Asia/Jerusalem"  # the dev identity is a system administrator
        assert h["config"] == cfg
        # the level order stays the default one
        assert [f["floor_id"] for f in c.get("/api/v1/devices/tree").json()["floors"]] == ["fm1", "f0", "f1"]


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


def test_direction_and_side_are_validated(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        for d in ("a", "b", "c"):
            assert _patch(c, {"home.direction": d}).json()["settings"]["home.direction"] == d
            assert _home(c)["direction"] == d
        assert _patch(c, {"home.side": "start"}).json()["settings"]["home.side"] == "start" and _home(c)["side"] == "start"
        for bad in ({"home.direction": "d"}, {"home.direction": ""}, {"home.direction": "A"}, {"home.side": "left"}, {"home.side": ""}):
            assert _patch(c, bad).status_code == 422, bad


# ------------------------------------------------------------------------------------------------ the widget configuration


def test_widget_configuration_round_trips_in_canonical_form_and_partial_input_takes_the_defaults(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        r = _patch(c, {"home.widgets": {"order": ["quick", "clock"], "clock": {"mode": "time", "seconds": True, "label": " שעה "}, "weather": {"on": False, "fields": ["humidity", "temperature"], "forecast": "3", "sources": {"temperature": "sensor.kitchen_temp"}}}})
        assert r.status_code == 200, r.text
        cfg = r.json()["settings"]["home.widgets"]
        assert cfg["order"] == ["quick", "clock", "weather", "shabbat", "alarm"]  # what is missing is appended in the default order
        assert cfg["clock"] == {"on": True, "sizes": {"a": "l", "b": "m", "c": "m"}, "label": "שעה", "mode": "time", "seconds": True, "hebrew": True}
        assert cfg["weather"]["on"] is False and cfg["weather"]["fields"] == ["humidity", "temperature"] and cfg["weather"]["forecast"] == "3"
        assert cfg["weather"]["sources"] == {"temperature": "sensor.kitchen_temp"}
        # saved: the catalogue's suggestions no longer fill an empty entity (the owner's explicit choice stands, even "none")
        assert cfg["weather"]["entity"] == "" and cfg["calendar"]["parsha"] == ""
        assert _cfg(c) == cfg
        # an empty object puts it back to "never saved" (the default with suggestions)
        back = _patch(c, {"home.widgets": {}}).json()["settings"]["home.widgets"]
        assert back["order"] == list(home_config.WIDGET_IDS) and back["weather"]["entity"] == "weather.bare"


def test_widget_configuration_is_refused_when_wrong(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        base = _cfg(c)
        bads = [
            {"order": ["clock", "nope"]},
            {"order": "clock"},
            {"clock": {"mode": "analog"}},
            {"clock": {"seconds": "yes"}},
            {"clock": {"sizes": {"a": "huge"}}},
            {"clock": {"sizes": {"z": "m"}}},
            {"clock": {"label": "x" * 31}},
            {"clock": {"label": "a\nb"}},
            {"clock": {"unknown": 1}},
            {"nope": {}},
            {"weather": {"entity": "sensor.kitchen_temp"}},
            {"weather": {"entity": "weather.Home"}},
            {"weather": {"fields": ["temperature", "sunshine"]}},
            {"weather": {"forecast": "7"}},
            {"weather": {"sources": {"condition": "sensor.kitchen_temp"}}},
            {"weather": {"sources": {"temperature": "weather.home"}}},
            {"alarm": {"entity": "light.a"}},
            {"quick": {"actions": ["unlock_all"]}},
            {"calendar": {"parsha": "weather.home"}},
            {"calendar": {"candles": "sensor.a b"}},
            {"calendar": {"extras": [{"entity_id": "light.a"}]}},
            {"calendar": {"extras": [{"entity_id": "sensor.kitchen_temp"}, {"entity_id": "sensor.kitchen_temp"}]}},
            {"calendar": {"extras": [{"entity_id": f"sensor.x{i}"} for i in range(5)]}},
            {"calendar": {"extras": [{"entity_id": "sensor.kitchen_temp", "label": "x" * 31}]}},
            {"calendar": {"colour": "red"}},
        ]
        for bad in bads:
            assert _patch(c, {"home.widgets": bad}).status_code == 422, bad
        assert _cfg(c) == base  # a refused value stored nothing
        assert _patch(c, {"home.widgets": {"calendar": {"extras": [{"entity_id": "binary_sensor.jewish_calendar_issur_melacha_in_effect", "label": "איסור מלאכה"}], "holiday": "sensor.jewish_calendar_holiday"}, "alarm": {"entity": "alarm_control_panel.house"}}}).status_code == 200


def test_per_field_jewish_calendar_sensors_reach_the_tree_with_their_states(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        _patch(c, {"home.widgets": {"calendar": {"parsha": "sensor.jewish_calendar_weekly_portion", "candles": "sensor.jewish_calendar_upcoming_candle_lighting", "holiday": "sensor.jewish_calendar_holiday",
                                              "extras": [{"entity_id": "binary_sensor.jewish_calendar_issur_melacha_in_effect", "label": "איסור מלאכה"}]}}})
        d = _home(c)["data"]["sensors"]
        assert set(d) == {"sensor.jewish_calendar_weekly_portion", "sensor.jewish_calendar_upcoming_candle_lighting", "sensor.jewish_calendar_holiday", "binary_sensor.jewish_calendar_issur_melacha_in_effect"}
        assert d["sensor.jewish_calendar_weekly_portion"]["state"] == "Vayechi" and d["sensor.jewish_calendar_upcoming_candle_lighting"]["device_class"] == "timestamp"
        assert d["binary_sensor.jewish_calendar_issur_melacha_in_effect"]["state"] == "off"
        # a sensor that is not mirrored (or was removed) is simply absent - the widget then takes no room for that field
        _patch(c, {"home.widgets": {"calendar": {"parsha": "sensor.jewish_calendar_nowhere"}}})
        assert _home(c)["data"]["sensors"] == {}


def test_weather_offers_exactly_what_the_entity_reports(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        _patch(c, {"home.widgets": {"weather": {"entity": "weather.home"}}})
        w = _home(c)["data"]["weather"]
        assert w["entity_id"] == "weather.home" and w["condition"] == "partlycloudy" and w["available"] is True
        assert w["values"] == {
            "temperature": {"v": 27.5, "unit": "°C"},
            "humidity": {"v": 61.0, "unit": "%"},
            "wind": {"v": 14.0, "unit": "km/h", "bearing": 270.0},
            "pressure": {"v": 1012.3, "unit": "hPa"},
            "visibility": {"v": 10.0, "unit": "km"},
            "uv": {"v": 6.0, "unit": ""},
        }
        assert w["offers"] == ["condition", "temperature", "humidity", "wind", "pressure", "visibility", "uv", "forecast"]
        assert w["forecast_len"] == 2 and w["forecast"] == [
            {"datetime": "2026-09-30T14:00:00+03:00", "condition": "sunny", "temperature": 29.0},
            {"datetime": "2026-09-30T15:00:00+03:00", "condition": "cloudy", "temperature": 28.0},
        ]
        # an entity that reports little offers little: no humidity, wind, pressure ... and no forecast
        _patch(c, {"home.widgets": {"weather": {"entity": "weather.bare"}}})
        w = _home(c)["data"]["weather"]
        assert w["offers"] == ["condition", "temperature"] and w["forecast_len"] == 0 and set(w["values"]) == {"temperature"}
        # unavailable: still reported (the editor explains it), with no condition; a missing entity is absent
        _patch(c, {"home.widgets": {"weather": {"entity": "weather.gone"}}})
        w = _home(c)["data"]["weather"]
        assert w["available"] is False and w["condition"] is None and w["offers"] == ["condition"]
        _patch(c, {"home.widgets": {"weather": {"entity": "weather.nowhere"}}})
        assert _home(c)["data"]["weather"] is None


def test_the_forecast_is_trimmed_and_malformed_entries_are_dropped():
    raw = [{"datetime": "2026-09-30T14:00:00+03:00", "condition": "sunny", "temperature": 29, "templow": 19, "precipitation_probability": 40}, "x", {"condition": "sunny"}] + [
        {"datetime": f"2026-09-30T{h:02d}:00:00", "condition": "rainy", "temperature": "n/a"} for h in range(15, 24)
    ] * 3
    f = home_screen._forecast(raw)
    assert len(f) == home_screen.FORECAST_MAX and f[0]["temperature"] == 29.0 and f[0]["templow"] == 19.0 and f[0]["precipitation_probability"] == 40.0 and f[1]["temperature"] is None
    assert home_screen._forecast(None) == [] and home_screen._forecast("nope") == []


def test_the_sync_keeps_the_weather_attributes_the_widget_offers_and_a_long_forecast_stays_valid_json():
    for k in ("temperature", "temperature_unit", "humidity", "wind_speed", "pressure", "pressure_unit", "visibility", "uv_index", "wind_bearing", "precipitation", "forecast"):
        assert k in ha_sync.ATTR_ALLOW, k
    hourly = [{"datetime": f"2026-09-30T{h % 24:02d}:00:00+03:00", "condition": "partlycloudy", "temperature": 20 + h % 5, "templow": 10.5, "precipitation_probability": 30, "wind_speed": 12.3, "extra": "x" * 40} for h in range(48)]
    kept = json.loads(ha_sync.trim_attributes({"temperature": 20, "forecast": hourly, "pressure": 1000}))  # used to be cut mid-JSON past 4000 characters
    assert kept["pressure"] == 1000 and len(kept["forecast"]) == ha_sync.FORECAST_KEEP and set(kept["forecast"][0]) <= set(ha_sync.FORECAST_FIELDS)


def test_legacy_keys_of_an_installation_that_used_them_become_its_configuration(app_c):
    """0.1.146 stored the widgets as home.clock / home.weather / home.jewish ...: an installation that switched any on keeps
    what it had (sizes chip / medium / large -> s / m / l for every direction), until an administrator saves the new config."""
    app, _ = app_c
    with TestClient(app) as c:
        assert _patch(c, {"home.clock": "time", "home.clock_size": "large", "home.clock_seconds": "true", "home.weather": "true", "home.weather_entity": "weather.home", "home.weather_size": "chip",
                          "home.jewish": "false", "home.jewish_parsha": "sensor.jewish_calendar_weekly_portion"}).status_code == 200
        cfg = _cfg(c)
        assert cfg["clock"]["on"] is True and cfg["clock"]["mode"] == "time" and cfg["clock"]["seconds"] is True and cfg["clock"]["sizes"] == {"a": "l", "b": "l", "c": "l"}
        assert cfg["weather"]["on"] is True and cfg["weather"]["entity"] == "weather.home" and cfg["weather"]["sizes"] == {"a": "s", "b": "s", "c": "s"}
        assert cfg["shabbat"]["on"] is False and cfg["calendar"]["parsha"] == "sensor.jewish_calendar_weekly_portion" and cfg["calendar"]["candles"] == ""
        assert cfg["alarm"]["on"] is True and cfg["quick"]["on"] is True  # the new widgets start on
        # the new setting, once saved, wins over the legacy keys
        _patch(c, {"home.widgets": {"clock": {"on": False}}})
        assert _cfg(c)["clock"]["on"] is False and _cfg(c)["weather"]["entity"] == ""
    # the pure conversion: nothing switched on = no legacy config
    assert home_config.from_legacy(lambda k, d: d) is None


def test_the_alarm_card_shows_only_a_panel_the_caller_may_see(app_c):
    app, s = app_c
    with TestClient(app) as c:
        a = _home(c)["data"]["alarm"]
        assert a["entity_id"] == "alarm_control_panel.house" and a["state"] == "armed_away" and a["since"] == NOW  # the most urgent of the two panels
        _patch(c, {"home.widgets": {"alarm": {"entity": "alarm_control_panel.annex"}}})
        assert _home(c)["data"]["alarm"]["entity_id"] == "alarm_control_panel.annex"
        _patch(c, {"home.widgets": {"alarm": {"entity": "alarm_control_panel.nowhere"}}})
        assert _home(c)["data"]["alarm"] is None
        # no panel at all: nothing (the client draws no card)
        with app.state.db.connection() as conn:
            conn.execute("UPDATE ha_entities SET removed_at = '2026-09-30T00:00:00+00:00' WHERE domain = 'alarm_control_panel'")
        _patch(c, {"home.widgets": {}})
        assert _home(c)["data"]["alarm"] is None


def test_the_alarm_ranking_prefers_the_urgent_state():
    cfg = home_config.default_config()
    rows = [{"entity_id": "alarm_control_panel.a", "domain": "alarm_control_panel", "state": "disarmed", "available": 1}, {"entity_id": "alarm_control_panel.b", "domain": "alarm_control_panel", "state": "triggered", "available": 1}, {"entity_id": "light.x", "domain": "light"}]
    assert home_screen.alarm_data(cfg, rows)["entity_id"] == "alarm_control_panel.b"
    assert home_screen.alarm_data(cfg, [rows[2]]) is None and home_screen.alarm_data(cfg, None) is None


# ------------------------------------------------------------------------------------------------ floor order (unchanged)


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


def test_clock_zone_reaches_the_tree(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        _patch(c, {"time.zone": "Europe/London"})
        assert _home(c)["time_zone"] == "Europe/London"


# ------------------------------------------------------------------------------------------------ candidates and who may edit


def test_candidates_list_what_each_widget_can_be_pointed_at_and_need_system_configure(app_c, settings):
    app, s = app_c
    with TestClient(app) as c:
        cand = c.get("/api/v1/devices/home-candidates").json()
        assert {w["entity_id"] for w in cand["weather"]} == {"weather.home", "weather.bare", "weather.gone"}
        home = next(w for w in cand["weather"] if w["entity_id"] == "weather.home")
        assert home["offers"][0] == "condition" and "forecast" in home["offers"] and home["forecast_len"] == 2 and home["values"]["temperature"] == {"v": 27.5, "unit": "°C"}
        assert next(w for w in cand["weather"] if w["entity_id"] == "weather.bare")["offers"] == ["condition", "temperature"]
        assert [a["entity_id"] for a in cand["alarms"]] == ["alarm_control_panel.annex", "alarm_control_panel.house"]
        ids = [x["entity_id"] for x in cand["sensors"]]
        assert all(i.split(".")[1].startswith("jewish_calendar_") for i in ids[:6]) and "sensor.kitchen_temp" in ids[6:]
        assert all(x["suggested"] for x in cand["sensors"][:6]) and not cand["sensors"][-1]["suggested"]
        assert "binary_sensor.jewish_calendar_issur_melacha_in_effect" in ids  # for the extra fields
        assert cand["suggested_calendar"]["parsha"] == "sensor.jewish_calendar_weekly_portion" and cand["suggested_calendar"]["holiday"] == "sensor.jewish_calendar_holiday"
        bind(c, s, "ron", "viewer", "installation", "*")
        assert c.get("/api/v1/devices/home-candidates", headers=as_user("ron")).status_code == 403
        # a viewer reads the settings and the tree (with the widgets) but cannot change any home.* key
        assert c.get("/api/v1/settings", headers=as_user("ron")).json()["settings"]["home.title"] == ""
        for body in ({"home.title": "x"}, {"home.floor_order": '["f0"]'}, {"home.direction": "b"}, {"home.side": "start"}, {"home.widgets": {"clock": {"on": False}}}):
            assert _patch(c, body, headers=as_user("ron")).status_code == 403, body
        h = c.get("/api/v1/devices/tree", headers=as_user("ron")).json()["home"]
        assert h["personalize"] is False and h["direction"] == "a"


def test_suggest_calendar_matches_the_integrations_ids_and_is_deterministic():
    ids = ["sensor.jewish_calendar_upcoming_shabbat_candle_lighting", "sensor.jewish_calendar_upcoming_candle_lighting", "sensor.jewish_calendar_upcoming_shabbat_havdalah", "sensor.jewish_calendar_weekly_portion",
           "sensor.jewish_calendar_date", "sensor.jewish_calendar_holiday", "sensor.jewish_calendar_day_of_the_omer"]
    s = home_config.suggest_calendar(ids)
    assert s == {"date": "sensor.jewish_calendar_date", "parsha": "sensor.jewish_calendar_weekly_portion", "candles": "sensor.jewish_calendar_upcoming_shabbat_candle_lighting",
                 "havdalah": "sensor.jewish_calendar_upcoming_shabbat_havdalah", "holiday": "sensor.jewish_calendar_holiday"}
    assert home_config.suggest_calendar(list(reversed(ids))) == s
    assert home_config.suggest_calendar(["sensor.kitchen_temp"]) == {f: "" for f in home_config.CALENDAR_FIELDS}


# ------------------------------------------------------------------------------------------------ the personal override


PERSONAL = {"direction": "c", "order": ["quick", "clock"], "widgets": {"clock": {"size": "s"}, "weather": {"on": False}}}


def _custom_role(c: TestClient, name: str, permissions: list[str]) -> str:
    r = c.post("/api/v1/access/roles", json={"name": name, "permissions": permissions, "sensitive": []})
    assert r.status_code < 300, r.text
    return r.json()["id"]


def test_the_permission_is_registered_granted_to_system_admin_only_and_not_sensitive():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    assert PERMISSION_LABELS["screen.personalize"] == "התאמה אישית של המסך שלי"
    assert [r for r, perms in ROLES.items() if "screen.personalize" in perms] == ["system_admin"]
    assert "screen.personalize" not in SENSITIVE  # a cosmetic permission a custom role may simply list
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert [r["id"] for r in contract["roles"] if "screen.personalize" in r["permissions"]] == ["system_admin"]
    assert "screen.personalize" not in contract["sensitive_permissions_not_implied"]


def test_normalise_personal_keeps_only_what_it_says_and_refuses_the_rest():
    assert home_config.normalise_personal({}) == {"direction": None, "order": None, "widgets": {}}
    p = home_config.normalise_personal({"direction": "b", "order": ["alarm"], "widgets": {"clock": {"on": None, "size": "l"}, "weather": {}}})
    assert p == {"direction": "b", "order": ["alarm", "clock", "weather", "shabbat", "quick"], "widgets": {"clock": {"size": "l"}}}
    for bad in ({"direction": "z"}, {"order": ["nope"]}, {"order": "clock"}, {"widgets": {"nope": {}}}, {"widgets": {"clock": {"size": "xl"}}}, {"widgets": {"clock": {"on": "yes"}}},
                {"widgets": {"clock": {"label": "x"}}}, {"extra": 1}, [], "a"):
        with pytest.raises(ValueError):
            home_config.normalise_personal(bad)


def test_apply_personal_lays_the_users_choices_over_the_installation_and_never_touches_entities():
    cfg = home_config.default_config()
    cfg["weather"]["entity"] = "weather.home"
    out, d = home_config.apply_personal(cfg, "a", home_config.normalise_personal(PERSONAL))
    assert d == "c" and out["order"] == ["quick", "clock", "weather", "shabbat", "alarm"]
    assert out["clock"]["sizes"] == {"a": "l", "b": "m", "c": "s"}  # the size lands on the direction that is shown
    assert out["weather"]["on"] is False and out["weather"]["entity"] == "weather.home"
    assert cfg["clock"]["sizes"]["c"] == "m" and cfg["weather"]["on"] is True  # the input is not modified
    assert home_config.apply_personal(cfg, "b", None) == (cfg, "b") and home_config.apply_personal(cfg, "b", {"direction": None, "order": None, "widgets": {}}) == (cfg, "b")


def test_a_user_without_the_permission_cannot_write_and_never_sees_a_personal_value(app_c):
    app, s = app_c
    with TestClient(app) as c:
        bind(c, s, "ron", "viewer", "installation", "*")
        r = c.put("/api/v1/me/prefs", headers=as_user("ron"), json={"home.personal": PERSONAL})
        assert r.status_code == 403 and "screen.personalize" in json.dumps(r.json())
        got = c.get("/api/v1/me/prefs", headers=as_user("ron")).json()
        assert got["prefs"]["home.personal"] is None and "home.personal" not in got["stored"]
        assert _home(c, headers=as_user("ron"))["personalize"] is False
        # clearing is always allowed (a harmless null)
        assert c.put("/api/v1/me/prefs", headers=as_user("ron"), json={"home.personal": None}).status_code == 200
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'screen.personalize' AND decision = 'denied'").fetchone()[0] == 1


def test_a_holder_gets_a_personal_screen_and_losing_the_permission_ignores_the_stored_value(app_c):
    app, s = app_c
    with TestClient(app) as c:
        role = _custom_role(c, "מתאים אישית", ["devices.read", "screen.personalize"])
        bind(c, s, "dana", role, "installation", "*")
        hd = {"headers": as_user("dana")}
        base = _home(c, **hd)
        assert base["personalize"] is True and base["direction"] == "a"
        # validated on write: a bad value is a 422 and stores nothing
        assert c.put("/api/v1/me/prefs", json={"home.personal": {"direction": "x"}}, **hd).status_code == 422
        r = c.put("/api/v1/me/prefs", json={"home.personal": PERSONAL}, **hd)
        assert r.status_code == 200, r.text
        assert r.json()["prefs"]["home.personal"]["direction"] == "c" and "home.personal" in r.json()["stored"]
        h = _home(c, **hd)
        assert h["direction"] == "c" and h["config"]["order"][:2] == ["quick", "clock"] and h["config"]["clock"]["sizes"]["c"] == "s" and h["config"]["weather"]["on"] is False
        # everyone else still sees the installation's screen
        assert _home(c)["direction"] == "a" and _home(c)["config"]["weather"]["on"] is True
        # dana loses the permission (her binding is removed): the stored value stays in the table but is ignored on every read
        with app.state.db.connection() as conn:
            conn.execute("DELETE FROM bindings WHERE subject_id = 'dev-dana'")
            conn.execute("UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'permission_revision'")
        bind(c, s, "dana", "viewer", "installation", "*")
        h = _home(c, **hd)
        assert h["personalize"] is False and h["direction"] == "a" and h["config"] == _home(c)["config"]
        got = c.get("/api/v1/me/prefs", **hd).json()
        assert got["prefs"]["home.personal"] is None and "home.personal" not in got["stored"]
        with app.state.db.connection() as conn:
            assert conn.execute("SELECT COUNT(*) FROM user_prefs WHERE key = 'home.personal'").fetchone()[0] == 1  # kept: it returns with the permission


def test_system_admin_holds_it_and_the_personal_value_is_per_user(app_c):
    app, s = app_c
    with TestClient(app) as c:  # the dev identity is the bootstrap system administrator
        assert _home(c)["personalize"] is True
        assert c.put("/api/v1/me/prefs", json={"home.personal": {"direction": "b"}}).status_code == 200
        assert _home(c)["direction"] == "b"
        bind(c, s, "ron", "viewer", "installation", "*")
        assert _home(c, headers=as_user("ron"))["direction"] == "a"  # another user is untouched
        assert c.put("/api/v1/me/prefs", json={"home.personal": None}).json()["prefs"]["home.personal"] is None
        assert _home(c)["direction"] == "a"


def test_no_floor_bucket_can_be_ordered_too(app_c):
    """A floor-less area (the "ללא קומה" bucket, floor id `none`) is a floor entry like any other in the order."""
    app, _ = app_c
    with app.state.db.connection() as conn:
        conn.execute("UPDATE ha_areas SET floor_id = NULL WHERE area_id = 'am1'")
    with TestClient(app) as c:
        assert [f["floor_id"] for f in c.get("/api/v1/devices/tree").json()["floors"]][-1] == svc.NO_FLOOR
        _patch(c, {"home.floor_order": json.dumps([svc.NO_FLOOR])})
        assert [f["floor_id"] for f in c.get("/api/v1/devices/tree").json()["floors"]][0] == svc.NO_FLOOR


def test_normalise_is_idempotent_and_the_stored_json_is_bounded():
    cfg = home_config.default_config()
    assert home_config.normalise(cfg) == cfg and home_config.normalise(copy.deepcopy(cfg)) == cfg
    assert home_config.parse_stored("") is None and home_config.parse_stored("garbage") is None and home_config.parse_stored('{"order": ["x"]}') is None
    assert home_config.parse_stored(json.dumps(cfg)) == cfg

# ------------------------------------------------------------------------------------------------ scope of the widgets' data


def _floor_scoped_viewer(app, s, c) -> str:
    """A viewer bound to ONE floor, with `sensor.floor_temp` placed on it; `sensor.other_floor_temp` and the alarm zone's door
    sensor are placed nowhere the viewer can see."""
    from conftest import png_bytes, seed_tree

    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("p.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    c.post(f"/api/v1/plan-versions/{v['id']}/publish")
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "sensor.floor_temp", "x": 0.2, "y": 0.2}).status_code == 201
    bind(c, s, "floorviewer", "viewer", "floor", ids["floor2"])
    return ids["floor2"]


def test_a_floor_scoped_caller_gets_no_state_of_a_sensor_outside_their_floors(app_c):
    """Review finding: the widgets' sensors used to be read straight from the catalogue. An administrator may point the extra
    fields / the weather field sources at any sensor (an alarm zone's, another floor's); a caller whose tree is narrowed to their
    floors must not receive that state. The Jewish Calendar's sensors and the weather entity stay the whole site's."""
    app, s = app_c
    with TestClient(app) as c:
        _floor_scoped_viewer(app, s, c)
        _patch(c, {"home.widgets": {"calendar": {"parsha": "sensor.jewish_calendar_weekly_portion", "candles": "sensor.jewish_calendar_upcoming_candle_lighting",
                                              "extras": [{"entity_id": "binary_sensor.zone_door", "label": "דלת"}, {"entity_id": "sensor.other_floor_temp", "label": "אחרת"}, {"entity_id": "sensor.floor_temp", "label": "שלי"}]},
                                 "weather": {"entity": "weather.home", "sources": {"temperature": "sensor.other_floor_temp", "humidity": "sensor.floor_temp"}}}})
        admin = _home(c)["data"]
        assert {"binary_sensor.zone_door", "sensor.other_floor_temp", "sensor.floor_temp"} <= set(admin["sensors"])  # an unscoped caller reads them all
        mine = c.get("/api/v1/devices/tree", headers=as_user("floorviewer")).json()
        assert mine["scoped"] is True
        d = mine["home"]["data"]
        assert set(d["sensors"]) == {"sensor.jewish_calendar_weekly_portion", "sensor.jewish_calendar_upcoming_candle_lighting", "sensor.floor_temp"}
        assert "33.3" not in json.dumps(mine["home"]["data"]) and "zone_door" not in json.dumps(d)
        assert d["weather"]["entity_id"] == "weather.home"  # the weather entity is the site's, as before


def test_widgets_that_are_off_compute_no_data():
    cfg = home_config.default_config()
    cfg["weather"].update({"entity": "weather.home", "sources": {"temperature": "sensor.kitchen_temp"}})
    cfg["calendar"].update({"parsha": "sensor.p", "date": "sensor.d", "extras": [{"entity_id": "sensor.x", "label": ""}]})
    assert home_screen._config_sensor_ids(cfg) == ["sensor.d", "sensor.p", "sensor.x", "sensor.kitchen_temp"]
    cfg["shabbat"]["on"] = False
    assert home_screen._config_sensor_ids(cfg) == ["sensor.d", "sensor.kitchen_temp"]  # the clock still shows the Hebrew date
    cfg["clock"]["on"] = False
    cfg["weather"]["on"] = False
    assert home_screen._config_sensor_ids(cfg) == []


def test_a_widget_switched_off_sends_no_weather_alarm_or_sensor_state(app_c):
    app, _ = app_c
    with TestClient(app) as c:
        _patch(c, {"home.widgets": {"weather": {"on": False, "entity": "weather.home"}, "alarm": {"on": False}, "shabbat": {"on": False}, "calendar": {"parsha": "sensor.jewish_calendar_weekly_portion"}}})
        d = _home(c)["data"]
        assert d["weather"] is None and d["alarm"] is None and d["sensors"] == {}  # the calendar's Hebrew date is unset here
        _patch(c, {"home.widgets": {"weather": {"entity": "weather.home"}}})
        assert _home(c)["data"]["weather"]["entity_id"] == "weather.home"

# ------------------------------------------------------------------------------------------------ /me/prefs review findings


def test_a_hidden_personal_value_does_not_leak_through_updated_at(app_c):
    """Review finding: GET /me/prefs hid `home.personal` but `updated_at` still moved with the hidden row."""
    app, s = app_c
    with TestClient(app) as c:
        bind(c, s, "ron", "viewer", "installation", "*")
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO user_prefs(user_id, key, value_json, updated_at) VALUES ('dev-ron', 'home.personal', ?, '2026-09-30T09:00:00+00:00')", (json.dumps({"direction": "c", "order": None, "widgets": {}}),))
        got = c.get("/api/v1/me/prefs", headers=as_user("ron")).json()
        assert got["prefs"]["home.personal"] is None and got["stored"] == [] and got["updated_at"] is None
        # a visible key still reports its own time, the hidden row never counts
        r = c.put("/api/v1/me/prefs", headers=as_user("ron"), json={"nav.order": ["security"]}).json()
        assert r["stored"] == ["nav.order"] and r["updated_at"] and r["updated_at"] != "2026-09-30T09:00:00+00:00" and r["prefs"]["home.personal"] is None


def test_put_prefs_is_all_or_nothing(app_c):
    """Review finding: PUT /me/prefs wrote key by key, so an invalid later key returned 422 after an earlier one had committed."""
    app, _ = app_c
    with TestClient(app) as c:
        c.put("/api/v1/me/prefs", json={"home.personal": None, "nav.order": None})
        before = c.get("/api/v1/me/prefs").json()
        for bad in ({"home.personal": {"direction": "z"}}, {"ui.nav_size": {"mode": "rel", "preset": "huge"}}, {"wiskey.density": "7"}):
            r = c.put("/api/v1/me/prefs", json={"nav.order": ["explore", "devices"], **bad})
            assert r.status_code == 422, (bad, r.text)
            assert c.get("/api/v1/me/prefs").json() == before, bad  # nothing of the request was stored
        ok = c.put("/api/v1/me/prefs", json={"nav.order": ["explore", "devices"], "home.personal": {"direction": "b"}})
        assert ok.status_code == 200 and ok.json()["prefs"]["nav.order"][0] == "explore" and ok.json()["prefs"]["home.personal"]["direction"] == "b"