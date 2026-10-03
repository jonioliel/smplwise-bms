"""Release 0.1.157: the look of a dropdown (`ui.dd_style`, `ui.dd_style_groups`). Installation default via PATCH /settings, a user's own
choice via PUT /me/prefs (null = follow the installation), one validator (services/dd_style.py). Default `auto` = today's look."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import dd_style

BAD_STYLES = ["", "Pill", "chip", "tabs", 1, True, ["pill"], {"a": 1}]
BAD_GROUPS = ["pill", ["home"], {"nav": "pill"}, {"home": "list"}, {"home": 1}, {"home": None}, {"area": "tonal", "bottom": "pill"}]


def test_normalize_styles_and_groups():
    assert dd_style.STYLES == ("auto", "pill", "field", "underline", "text", "prefix", "tonal")
    for s in dd_style.STYLES:
        assert dd_style.normalize_style(s) == s
    assert dd_style.normalize_style(" tonal ") == "tonal"
    assert dd_style.normalize_groups({}) == {}
    assert dd_style.normalize_groups({"settings": "text", "home": "field"}) == {"home": "field", "settings": "text"}
    for bad in BAD_STYLES:
        with pytest.raises(ValueError):
            dd_style.normalize_style(bad)
    for bad in BAD_GROUPS:
        with pytest.raises(ValueError):
            dd_style.normalize_groups(bad)


def test_stored_values_that_are_corrupt_read_as_the_defaults():
    assert dd_style.stored_style("nonsense") == "auto"
    assert dd_style.stored_groups("{not json") == {}
    assert dd_style.stored_groups('{"home":"pill","ghost":"pill"}') == {}


def test_installation_default_is_auto_round_trips_and_refuses_unknown_values(settings):
    with TestClient(create_app(settings)) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_style"] == "auto" and s["ui.dd_style_groups"] == {}
        r = c.patch("/api/v1/settings", json={"ui.dd_style": "underline", "ui.dd_style_groups": {"security": "prefix", "area": "auto"}})
        assert r.status_code == 200, r.text
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_style"] == "underline" and s["ui.dd_style_groups"] == {"area": "auto", "security": "prefix"}
        for bad in ("list", "", "PILL", 3):
            assert c.patch("/api/v1/settings", json={"ui.dd_style": bad}).status_code == 422, bad
        for bad in BAD_GROUPS:
            assert c.patch("/api/v1/settings", json={"ui.dd_style_groups": bad}).status_code == 422, bad
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.dd_style"] == "underline" and s["ui.dd_style_groups"] == {"area": "auto", "security": "prefix"}
        assert c.patch("/api/v1/settings", json={"ui.dd_style_groups": {}}).status_code == 200
        assert c.get("/api/v1/settings").json()["settings"]["ui.dd_style_groups"] == {}


def test_installation_default_needs_system_configure(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", headers=as_user("dana"), json={"ui.dd_style": "pill"}).status_code == 403
    assert c.get("/api/v1/settings").json()["settings"]["ui.dd_style"] == "auto"


def test_user_preference_is_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"]["ui.dd_style"] is None and body["prefs"]["ui.dd_style_groups"] is None
    assert "ui.dd_style" not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={"ui.dd_style": "tonal", "ui.dd_style_groups": {"multimedia": "text"}})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"]["ui.dd_style"] == "tonal" and r.json()["prefs"]["ui.dd_style_groups"] == {"multimedia": "text"}
    assert {"ui.dd_style", "ui.dd_style_groups"} <= set(r.json()["stored"])
    assert "ui.dd_style" not in c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["stored"]
    assert c.put("/api/v1/me/prefs", headers=as_user("dana"), json={"ui.dd_style": "field"}).status_code == 200
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.dd_style"] == "tonal"
    for bad in ("list", "", "Pill", 7):
        assert c.put("/api/v1/me/prefs", json={"ui.dd_style": bad}).status_code == 422, bad
    for bad in BAD_GROUPS:
        assert c.put("/api/v1/me/prefs", json={"ui.dd_style_groups": bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"]["ui.dd_style"] == "tonal"
    r = c.put("/api/v1/me/prefs", json={"ui.dd_style": None, "ui.dd_style_groups": None})
    assert r.status_code == 200 and not {"ui.dd_style", "ui.dd_style_groups"} & set(r.json()["stored"])
