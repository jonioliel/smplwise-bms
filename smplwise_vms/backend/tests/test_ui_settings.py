"""הגדרות › מסך פתיחה / הסתרת המפה (0.1.68): stored, read back, and refused when out of range."""
import json

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app


def test_start_route_and_hide_map_round_trip(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        before = c.get("/api/v1/settings").json()["settings"]
        assert before["ui.start_route"] == "explore" and before["ui.hide_map"] == "false"
        r = c.patch("/api/v1/settings", json={"ui.start_route": "wall", "ui.hide_map": "true"})
        assert r.status_code == 200, r.text
        after = c.get("/api/v1/settings").json()["settings"]
        assert after["ui.start_route"] == "wall" and after["ui.hide_map"] == "true"
        assert c.patch("/api/v1/settings", json={"ui.start_route": "kitchen"}).status_code == 422
        assert c.patch("/api/v1/settings", json={"ui.hide_map": "yes"}).status_code == 422


def test_hide_wiskey_round_trip_and_audited(settings):
    """T054 follow-up (owner request): הגדרות › בקרות כניסה gets a third control - hide the whole WisKey area from
    the navigation for everyone, regardless of role, the same "hidden for everyone" shape as ui.hide_map."""
    app = create_app(settings)
    with TestClient(app) as c:
        before = c.get("/api/v1/settings").json()["settings"]
        assert before["ui.hide_wiskey"] == "false"
        r = c.patch("/api/v1/settings", json={"ui.hide_wiskey": "true"})
        assert r.status_code == 200, r.text
        after = r.json()["settings"]
        assert after["ui.hide_wiskey"] == "true"
        assert c.get("/api/v1/settings").json()["settings"]["ui.hide_wiskey"] == "true"
        assert c.patch("/api/v1/settings", json={"ui.hide_wiskey": "yes"}).status_code == 422
        # back to shown
        assert c.patch("/api/v1/settings", json={"ui.hide_wiskey": "false"}).json()["settings"]["ui.hide_wiskey"] == "false"
        # every change is audited like any other product setting
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"ui.hide_wiskey": "true"} in rows
        assert {"ui.hide_wiskey": "false"} in rows


def test_access_ui_screen_choice_defaults_to_the_embedded_panel_and_is_audited(settings):
    """CR-005 recorded decision 2026-09-28 (embedded panel): הגדרות › בקרות כניסה chooses, per SMPLWISE WisKey screen,
    between WisKey's own panel embedded as-is ("wiskey", the default) and the SMPLWISE screen ("smplwise")."""
    keys = ("access.ui.overview", "access.ui.events", "access.ui.people")
    app = create_app(settings)
    with TestClient(app) as c:
        before = c.get("/api/v1/settings").json()["settings"]
        assert all(before[k] == "wiskey" for k in keys)
        r = c.patch("/api/v1/settings", json={"access.ui.people": "smplwise", "access.ui.events": "smplwise"})
        assert r.status_code == 200, r.text
        after = r.json()["settings"]
        assert after["access.ui.people"] == "smplwise" and after["access.ui.events"] == "smplwise" and after["access.ui.overview"] == "wiskey"
        assert c.get("/api/v1/settings").json()["settings"]["access.ui.people"] == "smplwise"
        # back to the embedded panel, and nothing else is accepted
        assert c.patch("/api/v1/settings", json={"access.ui.people": "wiskey"}).json()["settings"]["access.ui.people"] == "wiskey"
        for bad in ("iframe", "", "WISKEY", "both"):
            assert c.patch("/api/v1/settings", json={"access.ui.overview": bad}).status_code == 422
        # every change is audited like any other product setting, with the keys and values that changed
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"access.ui.people": "smplwise", "access.ui.events": "smplwise"} in rows
        assert {"access.ui.people": "wiskey"} in rows
        # readable by any user (the shell needs it to route the WisKey tabs); changeable only with system.configure
        bind(c, settings, "ron", "viewer", "installation", "*")
        seen = c.get("/api/v1/settings", headers=as_user("ron"))
        assert seen.status_code == 200 and seen.json()["settings"]["access.ui.overview"] == "wiskey" and seen.json()["can_edit"] is False
        assert c.patch("/api/v1/settings", json={"access.ui.overview": "smplwise"}, headers=as_user("ron")).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["access.ui.overview"] == "wiskey"
