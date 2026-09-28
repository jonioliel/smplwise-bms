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


DEVICES_DEFAULTS = {
    "devices.style": "smplwise",
    "devices.theme": "default",
    "devices.default_view": "cards",
    "devices.show_sensors": "true",
    "devices.show_climate_strip": "true",
    "devices.density": "comfortable",
}


def test_devices_settings_defaults_validation_audit_and_gate(settings):
    """CR-007 slice 6a: הגדרות › חשמל והתקנים - the look of the device-control screens (style, first building view,
    sensors card, climate strip, density) and the style's palette (devices.theme, "default" only), per installation. Defaults keep today's screens exactly; every value outside
    its list is refused; a change is audited; any user reads them (the device screens need them), only system.configure
    changes them. No bulk-safety knob lives here (the §7 rulings stay in code)."""
    app = create_app(settings)
    with TestClient(app) as c:
        before = c.get("/api/v1/settings").json()["settings"]
        assert {k: before[k] for k in DEVICES_DEFAULTS} == DEVICES_DEFAULTS
        assert sorted(k for k in before if k.startswith("devices.")) == sorted(DEVICES_DEFAULTS)
        change = {"devices.style": "glass", "devices.default_view": "tiles", "devices.show_sensors": "false", "devices.show_climate_strip": "false", "devices.density": "compact"}
        r = c.patch("/api/v1/settings", json=change)
        assert r.status_code == 200, r.text
        assert {k: r.json()["settings"][k] for k in change} == change
        assert {k: c.get("/api/v1/settings").json()["settings"][k] for k in change} == change
        # nothing outside each list
        for key, bad in (
            ("devices.style", "domus"), ("devices.style", "GLASS"), ("devices.style", ""),
            ("devices.theme", "ocean"), ("devices.theme", "Default"), ("devices.theme", ""),  # only registered palettes
            ("devices.default_view", "board"), ("devices.default_view", "list"),
            ("devices.show_sensors", "yes"), ("devices.show_sensors", "1"),
            ("devices.show_climate_strip", "no"),
            ("devices.density", "dense"), ("devices.density", "cozy"),
        ):
            assert c.patch("/api/v1/settings", json={key: bad}).status_code == 422, (key, bad)
        # a refused value changes nothing
        assert {k: c.get("/api/v1/settings").json()["settings"][k] for k in change} == change
        # back to the defaults
        assert c.patch("/api/v1/settings", json=DEVICES_DEFAULTS).status_code == 200
        assert {k: c.get("/api/v1/settings").json()["settings"][k] for k in DEVICES_DEFAULTS} == DEVICES_DEFAULTS
        # audited like any product setting, with exactly what changed
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert change in rows and DEVICES_DEFAULTS in rows
        # read by any user; written only with system.configure (a viewer's attempt is refused and changes nothing)
        bind(c, settings, "dana", "viewer", "installation", "*")
        seen = c.get("/api/v1/settings", headers=as_user("dana"))
        assert seen.status_code == 200 and seen.json()["can_edit"] is False
        assert seen.json()["settings"]["devices.style"] == "smplwise"
        assert c.patch("/api/v1/settings", json={"devices.style": "glass"}, headers=as_user("dana")).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["devices.style"] == "smplwise"
