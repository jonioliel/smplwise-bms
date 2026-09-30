"""UI round 1: the size of the navigation. The installation default (`ui.nav_size` in PATCH /settings) and a user's own
value (`ui.nav_size` in PUT /me/prefs) share one shape - a preset ("rel") or independent sizes ("free") - and are
validated with the same allow-list and ranges (services/nav_size.py): nothing out of range is stored or clamped."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import nav_size

REL = {"mode": "rel", "preset": "xl"}
FREE = {"mode": "free", "icon": 30, "label": 12, "item": 70}

BAD = [
    "xl",
    [],
    {"mode": "rel", "preset": "huge"},
    {"mode": "rel"},
    {"mode": "rel", "preset": "m", "icon": 20},  # a rel value carries no free sizes
    {"mode": "other"},
    {"mode": "free", "icon": 30, "label": 12},  # missing item
    {"mode": "free", "icon": 13, "label": 12, "item": 70},  # icon below range
    {"mode": "free", "icon": 41, "label": 12, "item": 70},
    {"mode": "free", "icon": 30, "label": 8, "item": 70},  # a label between 1 and 8 is unreadable
    {"mode": "free", "icon": 30, "label": 17, "item": 70},
    {"mode": "free", "icon": 30, "label": 12, "item": 35},
    {"mode": "free", "icon": 30, "label": 12, "item": 97},
    {"mode": "free", "icon": 30.5, "label": 12, "item": 70},  # whole numbers only
    {"mode": "free", "icon": "30", "label": 12, "item": 70},
    {"mode": "free", "icon": True, "label": 12, "item": 70},
    {"mode": "free", "icon": 30, "label": 12, "item": 70, "avatar": 20},  # unknown key
]


@pytest.mark.parametrize("value", [REL, FREE, {"mode": "free", "icon": 14, "label": 0, "item": 36}, {"mode": "free", "icon": 40, "label": 16, "item": 96}])
def test_normalize_accepts_the_allowed_shapes(value):
    assert nav_size.normalize(value) == value


@pytest.mark.parametrize("value", BAD)
def test_normalize_refuses_everything_else(value):
    with pytest.raises(ValueError):
        nav_size.normalize(value)


def test_installation_default_round_trip_validation_and_audit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        # nothing stored: the built-in preset, read back as an object
        assert c.get("/api/v1/settings").json()["settings"]["ui.nav_size"] == {"mode": "rel", "preset": "m"}
        r = c.patch("/api/v1/settings", json={"ui.nav_size": FREE})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.nav_size"] == FREE
        assert c.get("/api/v1/settings").json()["settings"]["ui.nav_size"] == FREE
        assert c.patch("/api/v1/settings", json={"ui.nav_size": REL}).json()["settings"]["ui.nav_size"] == REL
        for bad in BAD:
            assert c.patch("/api/v1/settings", json={"ui.nav_size": bad}).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["ui.nav_size"] == REL  # refused values stored nothing
        with app.state.db.connection() as conn:
            n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' AND details_json LIKE '%nav_size%'").fetchone()[0]
        assert n == 2


def test_installation_default_needs_system_configure(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"ui.nav_size": REL}).status_code == 403
    assert c.get("/api/v1/settings").json()["settings"]["ui.nav_size"] == {"mode": "rel", "preset": "m"}


def test_user_override_is_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"]["ui.nav_size"] == {"mode": "rel", "preset": "m"} and "ui.nav_size" not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={"ui.nav_size": FREE})
    assert r.status_code == 200 and r.json()["prefs"]["ui.nav_size"] == FREE and "ui.nav_size" in r.json()["stored"]
    # another user is untouched (a viewer may keep their own size: presentation only)
    dana = c.get("/api/v1/me/prefs", headers=as_user("dana")).json()
    assert "ui.nav_size" not in dana["stored"]
    assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"ui.nav_size": REL}).status_code == 200
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.nav_size"] == FREE
    # out-of-range or foreign values are a 422 and change nothing
    for bad in BAD:
        assert c.put("/api/v1/me/prefs", json={"ui.nav_size": bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.nav_size"] == FREE
    # the tab order is a separate key: setting the size leaves it alone
    assert c.get("/api/v1/me/prefs").json()["prefs"]["nav.order"] == ["devices", "security", "explore", "wiskey"]
    # null = "ברירת מחדל של המערכת": the key is gone again
    r = c.put("/api/v1/me/prefs", json={"ui.nav_size": None})
    assert r.status_code == 200 and "ui.nav_size" not in r.json()["stored"]
