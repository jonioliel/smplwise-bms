"""הגדרות › מסך פתיחה / הסתרת המפה (0.1.68): stored, read back, and refused when out of range."""
import json

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app


def test_start_route_and_hide_map_round_trip(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        before = c.get("/api/v1/settings").json()["settings"]
        assert before["ui.start_route"] == "devices" and before["ui.hide_map"] == "false"
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


def test_wiskey_size_defaults_to_normal_validates_audits_and_is_admin_only(settings):
    """Owner 2026-09-30: the embedded WisKey panel's size is an installation-wide choice (normal | fit + scale | full)."""
    app = create_app(settings)
    with TestClient(app) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.wiskey_size"] == "normal" and s["ui.wiskey_scale"] == "90"
        r = c.patch("/api/v1/settings", json={"ui.wiskey_size": "fit", "ui.wiskey_scale": "80"})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.wiskey_size"] == "fit" and r.json()["settings"]["ui.wiskey_scale"] == "80"
        for bad in ({"ui.wiskey_size": "huge"}, {"ui.wiskey_size": ""}, {"ui.wiskey_scale": "60"}, {"ui.wiskey_scale": "110"}, {"ui.wiskey_scale": "90%"}):
            assert c.patch("/api/v1/settings", json=bad).status_code == 422
        assert c.patch("/api/v1/settings", json={"ui.wiskey_size": "full"}).json()["settings"]["ui.wiskey_size"] == "full"
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"ui.wiskey_size": "fit", "ui.wiskey_scale": "80"} in rows and {"ui.wiskey_size": "full"} in rows
        bind(c, settings, "ron", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", json={"ui.wiskey_size": "fit"}, headers=as_user("ron")).status_code == 403


def test_wiskey_density_and_wall_installation_defaults_validate_and_are_admin_only(settings):
    """WisKey rc.37: the installation's start choices for the embedded panel (`density` cards, `wall` streams)."""
    app = create_app(settings)
    with TestClient(app) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["ui.wiskey_density"] == "auto" and s["ui.wiskey_wall"] == "auto"
        r = c.patch("/api/v1/settings", json={"ui.wiskey_density": "12", "ui.wiskey_wall": "9"})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.wiskey_density"] == "12" and r.json()["settings"]["ui.wiskey_wall"] == "9"
        for ok in ("auto", "4", "6", "8", "9", "12"):
            assert c.patch("/api/v1/settings", json={"ui.wiskey_density": ok}).status_code == 200
        for bad in ({"ui.wiskey_density": "5"}, {"ui.wiskey_density": ""}, {"ui.wiskey_density": "12%"}, {"ui.wiskey_wall": "6"}, {"ui.wiskey_wall": "8"}, {"ui.wiskey_wall": "13"}):
            assert c.patch("/api/v1/settings", json=bad).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["ui.wiskey_density"] == "12"
        bind(c, settings, "ron", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", json={"ui.wiskey_wall": "12"}, headers=as_user("ron")).status_code == 403


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


def test_access_phone_embed_is_off_by_default_and_audited(settings):
    """T054 follow-up (experimental): embedding WisKey inside the Companion app is opt-in - "false" keeps the 0.1.123
    behaviour (no frame in the app) until the owner has tried it on a phone."""
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["access.phone_embed"] == "false"
        r = c.patch("/api/v1/settings", json={"access.phone_embed": "true"})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["access.phone_embed"] == "true"
        for bad in ("yes", "", "TRUE", "1"):
            assert c.patch("/api/v1/settings", json={"access.phone_embed": bad}).status_code == 422
        assert c.patch("/api/v1/settings", json={"access.phone_embed": "false"}).json()["settings"]["access.phone_embed"] == "false"
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"access.phone_embed": "true"} in rows and {"access.phone_embed": "false"} in rows
        bind(c, settings, "ron", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", json={"access.phone_embed": "true"}, headers=as_user("ron")).status_code == 403


DEVICES_DEFAULTS = {
    "devices.style": "smplwise",
    "devices.theme": "default",
    "devices.default_view": "cards",
    "devices.show_sensors": "true",
    "devices.show_climate_strip": "true",
    "devices.density": "comfortable",
    "devices.scheme": "light",  # CR-007 6b
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
        # (devices.area_design - the area screens' direction, owner 2026-09-30 - has its own tests: test_area_redesign.py)
        assert sorted(k for k in before if k.startswith("devices.") and k not in ("devices.area_design", "devices.area_row", "devices.floor_row")) == sorted(DEVICES_DEFAULTS)  # (area_row / floor_row: test_area_row.py)
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


def test_devices_theme_and_scheme_6b(settings):
    """CR-007 slice 6b: four built-in palettes (every one registered in the frontend too) and the device area's own
    colour scheme - light by default (the shell is light only; dark never applies by itself), dark or auto on request."""
    import re
    from pathlib import Path

    from smplwise.routers.settings import DEVICE_THEMES

    front = (Path(__file__).resolve().parents[3] / "frontend" / "src" / "styles" / "devices-themes.ts").read_text(encoding="utf-8")
    m = re.search(r"export const DEVICE_THEMES = \[([^\]]*)\]", front)
    assert m, "DEVICE_THEMES not found in devices-themes.ts"
    assert tuple(re.findall(r"'([a-z]+)'", m.group(1))) == DEVICE_THEMES == ("default", "sand", "forest", "graphite")
    app = create_app(settings)
    with TestClient(app) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["devices.scheme"] == "light" and s["devices.theme"] == "default"
        for theme in DEVICE_THEMES:
            assert c.patch("/api/v1/settings", json={"devices.theme": theme}).status_code == 200, theme
        for scheme in ("dark", "auto", "light"):
            assert c.patch("/api/v1/settings", json={"devices.scheme": scheme}).status_code == 200, scheme
        for bad in ("Dark", "system", "", "night"):
            assert c.patch("/api/v1/settings", json={"devices.scheme": bad}).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["devices.scheme"] == "light"
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", json={"devices.scheme": "dark"}, headers=as_user("dana")).status_code == 403
        assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["devices.scheme"] == "light"


def test_ui_design_is_deprecated_but_still_accepted(settings):
    """0.1.148: design "SW B" was removed and SW A is the only design. `ui.design` / `ui.design_names` stay accepted and stored so an
    old client or a restored backup does not fail, but nothing reads them any more: the value 'b' changes nothing (the frontend has
    no design switch; `?design=b` on the URL is ignored)."""
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ui.design"] == "a"
        for value in ("b", "a"):
            r = c.patch("/api/v1/settings", json={"ui.design": value})
            assert r.status_code == 200, (value, r.text)
            assert r.json()["settings"]["ui.design"] == value
        assert c.patch("/api/v1/settings", json={"ui.design": "c"}).status_code == 422


def test_ui_tile_layout_setting(settings):
    """Owner 2026-09-29 (overview tiles): ui.tile_layout - the summary tiles' shape on the Live overview and the devices
    screens - auto (the default: compact under 600 px, cards above) | cards | compact. Per installation
    (a browser can override it for itself, in the browser only); the frontend lists the same three values."""
    import re
    from pathlib import Path

    front = (Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "tile-layout.ts").read_text(encoding="utf-8")
    m = re.search(r"export const TILE_LAYOUTS = \[([^\]]*)\]", front)
    assert m, "TILE_LAYOUTS not found in tile-layout.ts"
    assert tuple(re.findall(r"'([a-z]+)'", m.group(1))) == ("auto", "cards", "compact")
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ui.tile_layout"] == "auto"
        for value in ("compact", "cards", "auto"):
            r = c.patch("/api/v1/settings", json={"ui.tile_layout": value})
            assert r.status_code == 200, (value, r.text)
            assert r.json()["settings"]["ui.tile_layout"] == value
            assert c.get("/api/v1/settings").json()["settings"]["ui.tile_layout"] == value
        for bad in ("Compact", "tiles", "", "list", "compact "):
            assert c.patch("/api/v1/settings", json={"ui.tile_layout": bad}).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"]["ui.tile_layout"] == "auto"
        assert c.patch("/api/v1/settings", json={"ui.tile_layout": "compact"}).status_code == 200
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"ui.tile_layout": "compact"} in rows
        # read by any user; written only with system.configure
        bind(c, settings, "dana", "viewer", "installation", "*")
        seen = c.get("/api/v1/settings", headers=as_user("dana"))
        assert seen.status_code == 200 and seen.json()["settings"]["ui.tile_layout"] == "compact"
        assert c.patch("/api/v1/settings", json={"ui.tile_layout": "cards"}, headers=as_user("dana")).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["ui.tile_layout"] == "compact"


def test_security_snapshot_defaults_to_shown_round_trips_and_needs_system_configure(settings):
    """Owner 2026-09-30: הגדרות › ממשק › "תמונת מצב באבטחה" (ui.security_snapshot) hides the live overview sub-screen of the
    security area for everyone. Shown by default; true/false only; audited; read by any user, written only with system.configure."""
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["ui.security_snapshot"] == "true"
        r = c.patch("/api/v1/settings", json={"ui.security_snapshot": "false"})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["ui.security_snapshot"] == "false"
        assert c.get("/api/v1/settings").json()["settings"]["ui.security_snapshot"] == "false"
        for bad in ("yes", "", "False", "0", "hidden"):
            assert c.patch("/api/v1/settings", json={"ui.security_snapshot": bad}).status_code == 422, bad
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {"ui.security_snapshot": "false"} in rows
        bind(c, settings, "dana", "viewer", "installation", "*")
        assert c.get("/api/v1/settings", headers=as_user("dana")).json()["settings"]["ui.security_snapshot"] == "false"
        assert c.patch("/api/v1/settings", json={"ui.security_snapshot": "true"}, headers=as_user("dana")).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"]["ui.security_snapshot"] == "false"