"""PHONENAV-295 (owner 2026-10-21): the personal preference `ui.dd_settings_nav` - how the Settings sub-pages are navigated on a phone,
tabs (default) | dropdown. Per user, presentation only (no permission), null resets it."""
from __future__ import annotations

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app

KEY = "ui.dd_settings_nav"


def test_settings_nav_is_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"][KEY] is None and KEY not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={KEY: "dropdown"})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"][KEY] == "dropdown" and KEY in r.json()["stored"]
    assert KEY not in c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["stored"]
    for bad in ["", "Dropdown", "select", "list", 1, True, ["tabs"], {"a": 1}]:
        assert c.put("/api/v1/me/prefs", json={KEY: bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"][KEY] == "dropdown"
    assert c.put("/api/v1/me/prefs", json={KEY: "tabs"}).json()["prefs"][KEY] == "tabs"
    r = c.put("/api/v1/me/prefs", json={KEY: None})
    assert r.status_code == 200 and KEY not in r.json()["stored"] and r.json()["prefs"][KEY] is None
