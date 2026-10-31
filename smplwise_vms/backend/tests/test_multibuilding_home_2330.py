"""MULTIBUILDING-HOME-2330 (owner approval 31.10, round 10): the shared-building flag (migration 0188, building edit) and the home
screen's site options (home.screen.site_entry / site_entry_building / site_off_shared; per user home.personal.screen.site_entry /
site_entry_building / hide_shared)."""
import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import home_screen_options as hso

API = "/api/v1"


def test_shared_flag_defaults_false_and_is_set_in_the_building_edit(settings):
    with TestClient(create_app(settings)) as c:
        site = c.post(f"{API}/sites", json={"name": "מתחם"}).json()
        b = c.post(f"{API}/sites/{site['id']}/buildings", json={"name": "משותף"}).json()
        assert b["is_shared"] is False
        r = c.patch(f"{API}/buildings/{b['id']}", json={"is_shared": True})
        assert r.status_code == 200, r.text
        assert r.json()["is_shared"] is True and r.json()["name"] == "משותף"
        tree = c.get(f"{API}/sites?tree=true").json()["sites"]
        listed = [x for s in tree for x in s["buildings"] if x["id"] == b["id"]]
        assert listed and listed[0]["is_shared"] is True
        # a rename leaves the flag alone; false clears it
        assert c.patch(f"{API}/buildings/{b['id']}", json={"name": "משותף חדש"}).json()["is_shared"] is True
        assert c.patch(f"{API}/buildings/{b['id']}", json={"is_shared": False}).json()["is_shared"] is False
        assert c.patch(f"{API}/buildings/{b['id']}", json={"is_shared": "yes please"}).status_code == 422
        with c.app.state.db.connection() as conn:
            actions = [r[0] for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'building.update' ORDER BY rowid").fetchall()]
        assert any("is_shared" in (a or "") for a in actions)


def test_shared_flag_needs_content_permission(settings):
    with TestClient(create_app(settings)) as c:
        site = c.post(f"{API}/sites", json={"name": "מתחם"}).json()
        b = c.post(f"{API}/sites/{site['id']}/buildings", json={"name": "בניין א"}).json()
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.patch(f"{API}/buildings/{b['id']}", json={"is_shared": True}, headers=as_user("dana")).status_code == 403


def test_site_options_defaults_and_validation():
    d = hso.default()
    assert d["site_entry"] == "site" and d["site_entry_building"] == "" and d["site_off_shared"] == "exclude"
    assert hso.CHOICES["site_entry"] == ("site", "last", "fixed") and hso.CHOICES["site_off_shared"] == ("exclude", "include")
    out = hso.normalize({"site_entry": "fixed", "site_entry_building": "b1", "site_off_shared": "include"}, d)
    assert out["site_entry"] == "fixed" and out["site_entry_building"] == "b1" and out["site_off_shared"] == "include"
    for bad in ({"site_entry": "random"}, {"site_off_shared": True}, {"site_entry_building": 5}, {"site_entry_building": "x" * 200}):
        with pytest.raises(ValueError):
            hso.normalize(bad, d)


def test_personal_site_options():
    assert hso.normalize_personal({"site_entry": "last", "hide_shared": True}) == {"site_entry": "last", "hide_shared": True}
    assert hso.normalize_personal({"site_entry": "fixed", "site_entry_building": "b2"}) == {"site_entry": "fixed", "site_entry_building": "b2"}
    assert hso.normalize_personal({"site_entry": None, "site_entry_building": "", "hide_shared": False}) == {}  # nothing said = follow the installation
    for bad in ({"site_entry": "nowhere"}, {"hide_shared": "yes"}, {"site_entry_building": 7}):
        with pytest.raises(ValueError):
            hso.normalize_personal(bad)


def test_site_options_round_trip(settings):
    with TestClient(create_app(settings)) as c:
        got = c.get(f"{API}/settings").json()["settings"]["home.screen"]
        assert got["site_entry"] == "site" and got["site_off_shared"] == "exclude"
        assert c.patch(f"{API}/settings", json={"home.screen": {"site_entry": "last", "site_off_shared": "include"}}).status_code == 200
        got = c.get(f"{API}/settings").json()["settings"]["home.screen"]
        assert got["site_entry"] == "last" and got["site_off_shared"] == "include" and got["floor_off"] == "menu"
        assert c.patch(f"{API}/settings", json={"home.screen": {"site_entry": "everywhere"}}).status_code == 422
        r = c.put(f"{API}/me/prefs", json={"home.personal": {"screen": {"site_entry": "fixed", "site_entry_building": "b1", "hide_shared": True}}})
        assert r.status_code == 200, r.text
        assert r.json()["prefs"]["home.personal"]["screen"] == {"site_entry": "fixed", "site_entry_building": "b1", "hide_shared": True}
        assert c.put(f"{API}/me/prefs", json={"home.personal": {"screen": {"hide_shared": "maybe"}}}).status_code == 422
