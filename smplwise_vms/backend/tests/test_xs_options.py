"""Release 2.29.0 (owner decisions 2026-10-29): the cross-section, the synoptic map and the fire-alarm UI are options - `ui.xs` in PATCH /settings,
an installation-wide JSON object (services/xs_options.py). Read back as an object with every key; changed with system.configure only; refused
values change nothing; audited. The alarm UI is OFF by default (fire detection is not a product feature) and its permission is separate."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
from smplwise.services import xs_options

URL = "/api/v1/settings"
DEFAULT = {
    "desktop_place": "left",
    "phone_place": "side",
    "many": "steps",
    "links": "fold",
    "click": "select",
    "shafts": True,
    "animate": True,
    "temp_threshold": 2,
    "syn_tab": True,
    "syn_columns": "all",
    "syn_custom": ["light", "temp", "presence", "cameras", "doors", "alerts", "fire"],
    "syn_hide_empty": True,
    "syn_events": True,
    "syn_switches": "typed",
    "syn_phone_view": "table",
    "fire_column": "hidden",
    "fire_ui": False,
    "ack": "hold",
    "ack_who": "separate",
    "alarm_bar": "everywhere",
    "wall": True,
}
CHANGED = {
    "desktop_place": "right",
    "phone_place": "sheet",
    "many": "near",
    "links": "hide",
    "click": "open",
    "shafts": False,
    "animate": False,
    "temp_threshold": 3,
    "syn_tab": False,
    "syn_columns": "custom",
    "syn_custom": ["temp", "doors"],
    "syn_hide_empty": False,
    "syn_events": False,
    "syn_switches": "all",
    "syn_phone_view": "section",
    "fire_column": "dashed",
    "fire_ui": True,
    "ack": "confirm",
    "ack_who": "admin",
    "alarm_bar": "home",
    "wall": False,
}

BAD = [
    "left",
    [],
    True,
    {"desktop_place": "middle"},  # not one of the choices
    {"phone_place": 1},
    {"shafts": "true"},  # a string is not a boolean
    {"fire_ui": 1},  # nor is a number
    {"temp_threshold": 7},
    {"temp_threshold": True},  # a boolean is not a number here
    {"temp_threshold": "2"},
    {"ack": None},
    {"alarm_bar": "nowhere"},
    {"unknown_option": True},
    {"wall": True, "extra": False},
    {"syn_columns": "some"},
    {"syn_hide_empty": "yes"},
    {"syn_custom": "light"},  # a list, not a string
    {"syn_custom": ["light", "kitchen"]},  # not a column
    {"syn_custom": ["temp", "temp"]},  # each column once
    {"syn_custom": [1]},
    {"syn_switches": "some"},  # SWITCH-LIGHT-DIMMER-2331: typed | all only
    {"syn_switches": True},
    {"syn_phone_view": "tiles"},  # SYNOPTIC-MOBILE-2342: table | cards | section only
    {"syn_phone_view": "Table"},  # exact values, no case folding
    {"syn_phone_view": None},
    {"syn_phone_view": 2},
]


def _audit_details(app):
    with app.state.db.connection() as conn:
        return [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]


def test_normalize_fills_defaults_and_refuses_the_rest():
    assert xs_options.normalize({}) == DEFAULT
    assert xs_options.normalize({"click": "open", "temp_threshold": 4}) == {**DEFAULT, "click": "open", "temp_threshold": 4}
    assert xs_options.normalize(CHANGED) == CHANGED
    for bad in BAD:
        with pytest.raises(ValueError):
            xs_options.normalize(bad)


def test_syn_custom_is_kept_in_the_board_order_and_may_be_empty():
    assert xs_options.normalize({"syn_custom": ["fire", "light", "temp"]})["syn_custom"] == ["light", "temp", "fire"]
    assert xs_options.normalize({"syn_custom": []})["syn_custom"] == []
    assert xs_options.normalize({"syn_columns": "few"})["syn_columns"] == "few", "the presets stay"
    # the defaults are not shared between calls (a caller that edits the list does not change the next answer)
    xs_options.normalize({})["syn_custom"].append("x")
    assert xs_options.normalize({})["syn_custom"] == DEFAULT["syn_custom"]


def test_switches_in_the_lights_column_default_to_the_typed_ones(client):
    """SWITCH-LIGHT-DIMMER-2331: "מפסקים בעמודת התאורה" - only the switches typed as a light (default), or every switch."""
    assert client.get(URL).json()["settings"]["ui.xs"]["syn_switches"] == "typed"
    assert xs_options.normalize({"syn_switches": "all"})["syn_switches"] == "all"
    # a value stored before the option existed reads with the default
    assert xs_options.normalize({"syn_hide_empty": False})["syn_switches"] == "typed"


def test_phone_view_defaults_to_the_compact_table_and_takes_the_three_layouts(settings):
    """SYNOPTIC-MOBILE-2342 (owner round 13, answer 1A + note): "תצוגת המפה הסינופטית בטלפון" - the compact table (default), floor cards,
    or the building cross-section first. Stored with the rest of ui.xs; a value stored before the option existed reads as the table."""
    assert xs_options.DEFAULT["syn_phone_view"] == "table"
    assert xs_options.normalize({"syn_hide_empty": False})["syn_phone_view"] == "table"
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get(URL).json()["settings"]["ui.xs"]["syn_phone_view"] == "table"
        for v in ("cards", "section", "table"):
            r = c.patch(URL, json={"ui.xs": {**DEFAULT, "syn_phone_view": v}})
            assert r.status_code == 200, r.text
            assert c.get(URL).json()["settings"]["ui.xs"]["syn_phone_view"] == v
        assert c.patch(URL, json={"ui.xs": {**DEFAULT, "syn_phone_view": "grid"}}).status_code == 422
        assert c.get(URL).json()["settings"]["ui.xs"]["syn_phone_view"] == "table", "a refused value changes nothing"


def test_hiding_empty_columns_is_on_by_default(client):
    assert client.get(URL).json()["settings"]["ui.xs"]["syn_hide_empty"] is True


def test_defaults_are_the_owners_and_the_alarm_ui_is_off(client):
    got = client.get(URL).json()["settings"]["ui.xs"]
    assert got == DEFAULT, "an object with every key, not a JSON string"
    assert got["fire_ui"] is False, "fire detection is not a product feature: the alarm UI is off by default"
    assert got["fire_column"] == "hidden" and got["ack"] == "hold" and got["ack_who"] == "separate" and got["alarm_bar"] == "everywhere"
    assert got["desktop_place"] == "left" and got["phone_place"] == "side" and got["many"] == "steps" and got["links"] == "fold" and got["click"] == "select"


def test_round_trip_replaces_the_whole_value_and_is_audited(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        r = c.patch(URL, json={"ui.xs": CHANGED})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.xs"] == CHANGED
        assert c.get(URL).json()["settings"]["ui.xs"] == CHANGED
        # keys left out take their default again (the value is replaced, never merged)
        assert c.patch(URL, json={"ui.xs": {"click": "open"}}).json()["settings"]["ui.xs"] == {**DEFAULT, "click": "open"}
        assert c.patch(URL, json={"ui.xs": DEFAULT}).json()["settings"]["ui.xs"] == DEFAULT
        # a patch without the key leaves it alone
        assert c.patch(URL, json={"ui.hide_map": "true"}).json()["settings"]["ui.xs"] == DEFAULT
        assert {"ui.xs": CHANGED} in _audit_details(app)


def test_bad_values_are_a_422_and_change_nothing(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.patch(URL, json={"ui.xs": {"many": "scroll"}}).status_code == 200
        want = c.get(URL).json()["settings"]["ui.xs"]
        for bad in BAD:
            r = c.patch(URL, json={"ui.xs": bad})
            assert r.status_code == 422, (bad, r.text)
        assert c.get(URL).json()["settings"]["ui.xs"] == want


def test_only_system_configure_may_change_it(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch(URL, headers=as_user("dana"), json={"ui.xs": CHANGED}).status_code == 403
    assert c.get(URL).json()["settings"]["ui.xs"] == DEFAULT
    # every user may read it (the screens of every user follow it)
    assert c.get(URL, headers=as_user("dana")).json()["settings"]["ui.xs"] == DEFAULT


def test_a_corrupt_stored_value_reads_as_the_defaults(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES('ui.xs', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ("[1, 2",))
        assert c.get(URL).json()["settings"]["ui.xs"] == DEFAULT
        with app.state.db.connection() as conn:
            conn.execute("UPDATE settings SET value = ? WHERE key = 'ui.xs'", ('{"fire_ui": "yes"}',))
        assert c.get(URL).json()["settings"]["ui.xs"] == DEFAULT


def test_the_acknowledge_permission_is_new_separate_and_sensitive():
    assert PERMISSION_LABELS.get("fire.acknowledge"), "the permission has a Hebrew label"
    assert "fire.acknowledge" in SENSITIVE, "a custom role must name it explicitly; no wildcard implies it"
    from smplwise.rbac import ROLES

    assert not [r for r, perms in ROLES.items() if "fire.acknowledge" in perms], "no built-in role holds it: it is granted on purpose"
