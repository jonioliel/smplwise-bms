"""Release 0.1.153: how the tab groups are presented. The installation default (`ui.tabs_mode`, `ui.tabs_mode_groups` in
PATCH /settings) and a user's own choice (the same keys in PUT /me/prefs, null = follow the installation) share one
validator (services/tabs_mode.py). The default is `tabs`; an unknown mode or group is refused, never stored."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import tabs_mode

BAD_MODES = ["", "tab", "Tabs", "list", 1, True, ["tabs"], {"a": 1}]
BAD_GROUPS = ["tabs", ["home"], {"nav": "tabs"}, {"home": "list"}, {"home": 1}, {"home": None}, {"area": "dropdown", "bottom": "tabs"}]


def test_normalize_modes_and_groups():
    for m in tabs_mode.MODES:
        assert tabs_mode.normalize_mode(m) == m
    assert tabs_mode.normalize_mode(" hybrid ") == "hybrid"
    assert tabs_mode.normalize_groups({}) == {}
    assert tabs_mode.normalize_groups({"settings": "dropdown", "home": "hybrid"}) == {"home": "hybrid", "settings": "dropdown"}
    for bad in BAD_MODES:
        with pytest.raises(ValueError):
            tabs_mode.normalize_mode(bad)
    for bad in BAD_GROUPS:
        with pytest.raises(ValueError):
            tabs_mode.normalize_groups(bad)


def test_stored_values_that_are_corrupt_read_as_the_defaults():
    assert tabs_mode.stored_mode("nonsense") == "tabs"
    assert tabs_mode.stored_groups("{not json") == {}
    assert tabs_mode.stored_groups('{"home":"dropdown","ghost":"tabs"}') == {}


def test_installation_default_is_tabs_round_trips_and_refuses_unknown_values(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.tabs_mode"] == "tabs" and s["ui.tabs_mode_groups"] == {}
        r = c.patch("/api/v1/settings", json={"ui.tabs_mode": "hybrid", "ui.tabs_mode_groups": {"security": "dropdown", "area": "tabs"}})
        assert r.status_code == 200, r.text
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.tabs_mode"] == "hybrid" and s["ui.tabs_mode_groups"] == {"area": "tabs", "security": "dropdown"}
        for bad in ("list", "", "TABS", 3):
            assert c.patch("/api/v1/settings", json={"ui.tabs_mode": bad}).status_code == 422, bad
        for bad in BAD_GROUPS:
            assert c.patch("/api/v1/settings", json={"ui.tabs_mode_groups": bad}).status_code == 422, bad
        s = c.get("/api/v1/settings").json()["settings"]  # refused values stored nothing
        assert s["ui.tabs_mode"] == "hybrid" and s["ui.tabs_mode_groups"] == {"area": "tabs", "security": "dropdown"}
        # {} clears the overrides
        assert c.patch("/api/v1/settings", json={"ui.tabs_mode_groups": {}}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["ui.tabs_mode_groups"] == {}


def test_installation_default_needs_system_configure(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"ui.tabs_mode": "dropdown"}).status_code == 403
    assert c.get("/api/v1/settings").json()["settings"]["ui.tabs_mode"] == "tabs"


def test_user_preference_is_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"]["ui.tabs_mode"] is None and body["prefs"]["ui.tabs_mode_groups"] is None
    assert "ui.tabs_mode" not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={"ui.tabs_mode": "dropdown", "ui.tabs_mode_groups": {"multimedia": "tabs"}})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"]["ui.tabs_mode"] == "dropdown" and r.json()["prefs"]["ui.tabs_mode_groups"] == {"multimedia": "tabs"}
    assert {"ui.tabs_mode", "ui.tabs_mode_groups"} <= set(r.json()["stored"])
    # another user is untouched; a viewer may keep their own choice (presentation only, no screen.personalize needed)
    assert "ui.tabs_mode" not in c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["stored"]
    assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"ui.tabs_mode": "hybrid"}).status_code == 200
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.tabs_mode"] == "dropdown"
    # unknown values are a 422 and change nothing
    for bad in ("list", "", "Tabs", 7):
        assert c.put("/api/v1/me/prefs", json={"ui.tabs_mode": bad}).status_code == 422, bad
    for bad in BAD_GROUPS:
        assert c.put("/api/v1/me/prefs", json={"ui.tabs_mode_groups": bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.tabs_mode"] == "dropdown"
    # null = "follow the installation": the keys are gone again
    r = c.put("/api/v1/me/prefs", json={"ui.tabs_mode": None, "ui.tabs_mode_groups": None})
    assert r.status_code == 200 and not {"ui.tabs_mode", "ui.tabs_mode_groups"} & set(r.json()["stored"])
