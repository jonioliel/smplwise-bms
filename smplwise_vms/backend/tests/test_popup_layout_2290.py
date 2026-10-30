"""AREAEDIT-2290: the area pop-up layout (services/popup_layout.py, routers/popup_layout.py): validation, site default + area override,
the version check, permission (system.configure only), the audit row and the alert choice."""
import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import home_screen_options as hso, popup_layout as pl

LAYOUT = {"sections": ["climate", "sensors", "lighting"], "hidden": ["events"], "items": {"sensors": {"order": ["sensor.b", "sensor.a"], "hidden": ["binary_sensor.input_0"]}}}


def test_layout_is_canonical_and_strict():
    assert pl.normalize_layout({}) == {"sections": [], "hidden": [], "items": {}}
    assert pl.normalize_layout(LAYOUT) == LAYOUT
    assert pl.normalize_layout({"items": {"sensors": {"order": [], "hidden": []}}})["items"] == {}  # says nothing -> dropped from the canonical form
    for bad in ({"sections": ["lighting", "lighting"]}, {"sections": ["pool"]}, {"hidden": "events"}, {"nope": 1}, {"items": {"events": {"hidden": ["x"]}}},
                {"items": {"sensors": {"hidden": ["a", "a"]}}}, {"items": {"sensors": {"hidden": [1]}}}, {"items": {"sensors": {"extra": []}}}, [], {"items": []}):
        with pytest.raises(ValueError):
            pl.normalize_layout(bad)


def test_save_site_area_reset_and_version():
    base = hso.default()["popup"]
    one = pl.save(base, area_id="lobby", layout=LAYOUT, version=0)
    assert one["version"] == 1 and one["areas"]["lobby"] == LAYOUT and one["site"] is None
    two = pl.save(one, area_id=None, layout={"hidden": ["media"]}, version=1)
    assert two["version"] == 2 and two["site"]["hidden"] == ["media"] and two["areas"]["lobby"] == LAYOUT  # the area override stays
    three = pl.save(two, area_id="lobby", layout=None, version=2)
    assert "lobby" not in three["areas"] and three["site"] == two["site"]
    with pytest.raises(pl.Conflict):
        pl.save(three, area_id=None, layout=None, version=1)
    assert pl.save(three, area_id=None, layout=None, version=1, force=True)["site"] is None


def test_settings_patch_validates_the_popup_and_keeps_it(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        got = c.get("/api/v1/settings").json()["settings"]["home.screen"]
        assert got["popup"] == {"version": 0, "site": None, "areas": {}} and got["popup_alert"] == "show"
        assert c.patch("/api/v1/settings", json={"home.screen": {"popup": {"version": 1, "site": {"sections": ["pool"]}}}}).status_code == 422
        assert c.patch("/api/v1/settings", json={"home.screen": {"popup_alert": "maybe"}}).status_code == 422
        assert c.patch("/api/v1/settings", json={"home.screen": {"popup_alert": "hide"}}).status_code == 200
        r = c.put("/api/v1/devices/popup-layout", json={"version": 0, "layout": {"hidden": ["events"]}})
        assert r.status_code == 200, r.text
        assert c.patch("/api/v1/settings", json={"home.screen": {"floor_off": "buttons"}}).status_code == 200  # an unrelated patch keeps the layout
        got = c.get("/api/v1/settings").json()["settings"]["home.screen"]
        assert got["popup"]["site"]["hidden"] == ["events"] and got["popup_alert"] == "hide" and got["floor_off"] == "buttons"


def test_routes_permission_conflict_audit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, position, updated_at) VALUES ('lobby', 'Lobby', NULL, 0, '2026-10-29T00:00:00Z')")
            conn.execute("INSERT INTO ha_areas(area_id, name, floor_id, position, updated_at) VALUES ('hall', 'Hall', NULL, 1, '2026-10-29T00:00:00Z')")
        bind(c, settings, "dana", "viewer", "installation", "*")
        bind(c, settings, "ed", "editor", "installation", "*")
        for user in ("dana", "ed"):  # a viewer and an editor: not managers
            assert c.put("/api/v1/devices/areas/lobby/popup-layout", json={"version": 0, "layout": LAYOUT}, headers=as_user(user)).status_code == 403
            assert c.put("/api/v1/devices/popup-layout", json={"version": 0, "layout": LAYOUT}, headers=as_user(user)).status_code == 403
        assert c.put("/api/v1/devices/areas/nowhere/popup-layout", json={"version": 0, "layout": LAYOUT}).status_code == 404
        assert c.put("/api/v1/devices/areas/lobby/popup-layout", json={"version": 0, "layout": {"sections": ["pool"]}}).status_code == 422
        assert c.put("/api/v1/devices/areas/lobby/popup-layout", json={"version": 0, "layout": LAYOUT, "bogus": 1}).status_code == 422
        # an area save cannot flip the installation-wide alert choice for a manager who only holds the area; the admin holds both
        r = c.put("/api/v1/devices/areas/lobby/popup-layout", json={"version": 0, "layout": LAYOUT})
        assert r.status_code == 200, r.text
        assert r.json()["popup"]["version"] == 1 and r.json()["popup"]["areas"]["lobby"] == LAYOUT
        stale = c.put("/api/v1/devices/areas/hall/popup-layout", json={"version": 0, "layout": LAYOUT})
        assert stale.status_code == 409 and stale.json()["code"] == "version_conflict" and stale.json()["details"]["version"] == 1
        forced = c.put("/api/v1/devices/areas/hall/popup-layout", json={"version": 0, "layout": LAYOUT, "force": True})
        assert forced.status_code == 200 and forced.json()["popup"]["version"] == 2
        site = c.put("/api/v1/devices/popup-layout", json={"version": 2, "layout": {"hidden": ["media"]}, "popup_alert": "hide"})
        assert site.status_code == 200 and site.json()["affected_areas"] == 0 and site.json()["popup_alert"] == "hide"  # both areas have their own layout
        assert c.put("/api/v1/devices/areas/lobby/popup-layout", json={"version": 3, "layout": None}).status_code == 200  # reset: inherits again
        got = c.get("/api/v1/settings").json()["settings"]["home.screen"]["popup"]
        assert "lobby" not in got["areas"] and "hall" in got["areas"] and got["site"]["hidden"] == ["media"] and got["version"] == 4
        with app.state.db.connection() as conn:
            rows = conn.execute("SELECT decision, resource_type, resource_id, details_json FROM audit_log WHERE action = 'devices.popup_layout.save' ORDER BY rowid").fetchall()
            denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'system.configure' AND decision = 'denied'").fetchone()[0]
        assert len(rows) == 4 and rows[0]["resource_type"] == "area" and rows[0]["resource_id"] == "lobby" and rows[2]["resource_type"] == "installation"
        d = json.loads(rows[0]["details_json"])
        assert d["scope"] == "area" and d["hidden_sections"] == ["events"] and d["hidden_items"] == 1 and d["version"] == 1
        assert json.loads(rows[0]["details_json"])["forced"] is False and json.loads(rows[1]["details_json"])["forced"] is True and json.loads(rows[3]["details_json"])["reset"] is True
        assert denied >= 4
