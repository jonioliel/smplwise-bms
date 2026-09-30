"""Owner 2026-09-30: the phone UX guards are options - `ui.mobile` in PATCH /settings, an installation-wide JSON object of
booleans (services/mobile_options.py). Read back as an object with every key; changed with system.configure only; refused
values change nothing; audited. A UX guard: no permission depends on it."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import mobile_options

URL = "/api/v1/settings"
DEFAULT = {
    "hide_structure": True,
    "hide_layout_editor": False,
    "hide_wall_arrange": False,
    "hide_settings_writes": False,
    "hide_permissions": False,
    "hide_control_images": True,
}
ALL_ON = {k: True for k in DEFAULT}
ALL_OFF = {k: False for k in DEFAULT}

BAD = [
    "hide_structure",
    [],
    True,
    {"hide_structure": "true"},  # a string is not a boolean
    {"hide_structure": 1},  # nor is a number
    {"hide_structure": None},
    {"hide_everything": True},  # unknown key
    {"hide_structure": True, "extra": False},
]


def _audit_details(app):
    with app.state.db.connection() as conn:
        return [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]


def test_normalize_fills_defaults_and_refuses_the_rest():
    assert mobile_options.normalize({}) == DEFAULT
    assert mobile_options.normalize({"hide_structure": False, "hide_wall_arrange": True}) == {**DEFAULT, "hide_structure": False, "hide_wall_arrange": True}
    for bad in BAD:
        with pytest.raises(ValueError):
            mobile_options.normalize(bad)


def test_defaults_structure_and_control_images_on_the_rest_off(client):
    got = client.get(URL).json()["settings"]["ui.mobile"]
    assert got == DEFAULT, "an object with every key, not a JSON string"
    assert got["hide_structure"] is True and got["hide_control_images"] is True
    assert not any(v for k, v in got.items() if k not in ("hide_structure", "hide_control_images"))


def test_round_trip_replaces_the_whole_value_and_is_audited(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        r = c.patch(URL, json={"ui.mobile": ALL_ON})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.mobile"] == ALL_ON
        assert c.get(URL).json()["settings"]["ui.mobile"] == ALL_ON
        # keys left out take their default again (the value is replaced, never merged)
        assert c.patch(URL, json={"ui.mobile": {"hide_layout_editor": True}}).json()["settings"]["ui.mobile"] == {**DEFAULT, "hide_layout_editor": True}
        assert c.patch(URL, json={"ui.mobile": ALL_OFF}).json()["settings"]["ui.mobile"] == ALL_OFF
        # a patch without the key leaves it alone
        assert c.patch(URL, json={"ui.hide_map": "true"}).json()["settings"]["ui.mobile"] == ALL_OFF
        assert c.get(URL).json()["settings"]["ui.mobile"] == ALL_OFF
        # every change is on the record with the normalised value
        assert {"ui.mobile": ALL_ON} in _audit_details(app)
        assert {"ui.mobile": ALL_OFF} in _audit_details(app)


def test_bad_values_are_a_422_and_change_nothing(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.patch(URL, json={"ui.mobile": {"hide_permissions": True}}).status_code == 200
        want = c.get(URL).json()["settings"]["ui.mobile"]
        for bad in BAD:
            r = c.patch(URL, json={"ui.mobile": bad})
            assert r.status_code == 422, (bad, r.text)
        assert c.get(URL).json()["settings"]["ui.mobile"] == want
        with app.state.db.connection() as conn:
            n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' AND details_json LIKE '%hide_%'").fetchone()[0]
        assert n == 1, "only the one accepted change is audited"


def test_only_system_configure_may_change_it(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch(URL, headers=as_user("dana"), json={"ui.mobile": ALL_ON}).status_code == 403
    assert c.get(URL).json()["settings"]["ui.mobile"] == DEFAULT
    # every user may read it (the phone UI of every user follows it)
    assert c.get(URL, headers=as_user("dana")).json()["settings"]["ui.mobile"] == DEFAULT


def test_a_corrupt_stored_value_reads_as_the_defaults(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES('ui.mobile', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ("[1, 2",))
        assert c.get(URL).json()["settings"]["ui.mobile"] == DEFAULT
        with app.state.db.connection() as conn:
            conn.execute("UPDATE settings SET value = ? WHERE key = 'ui.mobile'", ('{"hide_structure": "yes"}',))
        assert c.get(URL).json()["settings"]["ui.mobile"] == DEFAULT
