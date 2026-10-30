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
    "syn_events": True,
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
    "syn_columns": "few",
    "syn_events": False,
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
