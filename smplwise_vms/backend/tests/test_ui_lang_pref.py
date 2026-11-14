"""I18N-EN-SWITCH-2438 (owner round 32, Q-SYS-7 b): the personal preference `ui.lang` - the interface language, he | en.
Per user, presentation only (no permission), null resets it to Hebrew; Arabic and Russian are not offered yet."""
from __future__ import annotations

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app

KEY = "ui.lang"


def test_ui_lang_is_per_user_validated_and_clearable(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    body = c.get("/api/v1/me/prefs").json()
    assert body["prefs"][KEY] is None and KEY not in body["stored"]
    r = c.put("/api/v1/me/prefs", json={KEY: "en"})
    assert r.status_code == 200, r.text
    assert r.json()["prefs"][KEY] == "en" and KEY in r.json()["stored"]
    # another user keeps the default
    assert KEY not in c.get("/api/v1/me/prefs", headers=as_user("dana")).json()["stored"]
    for bad in ["", "EN", "en-GB", "ar", "ru", "fr", 1, True, ["en"], {"a": 1}]:
        assert c.put("/api/v1/me/prefs", json={KEY: bad}).status_code == 422, bad
    assert c.get("/api/v1/me/prefs").json()["prefs"][KEY] == "en"
    assert c.put("/api/v1/me/prefs", json={KEY: "he"}).json()["prefs"][KEY] == "he"
    r = c.put("/api/v1/me/prefs", json={KEY: None})
    assert r.status_code == 200 and KEY not in r.json()["stored"] and r.json()["prefs"][KEY] is None


def test_ui_lang_needs_no_personalize_permission(settings):
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    bind(c, settings, "dana", "viewer", "installation", "*")
    r = c.put("/api/v1/me/prefs", json={KEY: "en"}, headers=as_user("dana"))
    assert r.status_code == 200, r.text
    assert r.json()["prefs"][KEY] == "en"
