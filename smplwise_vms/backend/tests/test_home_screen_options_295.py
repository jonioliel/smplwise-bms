"""HOME-295 (owner answers on the home mockup round 2, 2026-10-25): the home screen's display options - one installation setting
`home.screen` (services/home_screen_options.py), the new `auto` info row, the inverted customer logo on dark by default and the user's
own summary tiles / phone area in /me/prefs `home.personal.screen` (screen.personalize). The frontend (src/api/home-screen.ts) lists the
same keys, values and defaults."""
import json
import re
from pathlib import Path

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import home_config, home_screen_options as hso

FRONT = Path(__file__).resolve().parents[3] / "frontend" / "src" / "api" / "home-screen.ts"


def test_defaults_are_the_owners_answers():
    d = hso.default()
    assert d == {"summary_tiles": None, "summary_chooser": "admin", "area_quick": {}, "row_actions": "quick", "tile_blinds": "pct", "tile_climate": "both",
                 "phone_area": "sheet", "desktop_area": "drawer", "floor_off": "menu", "many_floors": "more", "building_off_tablet": "hide", "quick_card": "show", "phone_floors": "selector",
                 "popup_alert": "show", "popup": {"version": 0, "site": None, "areas": {}},
                 "site_entry": "site", "site_entry_building": "", "site_off_shared": "exclude"}  # MULTIBUILDING-HOME-2330
    assert hso.stored("") == d and hso.stored(None) == d and hso.stored("{not json") == d and hso.stored('{"floor_off": "neon"}') == d


def test_the_frontend_lists_the_same_keys_values_and_defaults():
    src = FRONT.read_text(encoding="utf-8")
    for key, values in hso.CHOICES.items():
        assert re.search(key + r": \[" + ", ".join(f"'{v}'" for v in values) + r"\]", src), key
        assert re.search(key + r": '" + hso.DEFAULT[key] + "'", src), key
    assert "SUMMARY_KINDS: readonly SummaryKind[] = [" + ", ".join(f"'{k}'" for k in hso.SUMMARY_KINDS) + "]" in src
    assert "QUICK_KINDS: readonly QuickKind[] = [" + ", ".join(f"'{k}'" for k in hso.QUICK_KINDS) + "]" in src
    assert f"DEFAULT_QUICK_MAX = {hso.DEFAULT_QUICK_MAX}" in src


def test_normalize_is_partial_and_strict():
    base = hso.default()
    out = hso.normalize({"floor_off": "buttons", "summary_tiles": ["locks", "lights"], "area_quick": {"living": ["covers", "lights"]}}, base)
    assert out["floor_off"] == "buttons" and out["summary_tiles"] == ["locks", "lights"] and out["area_quick"] == {"living": ["covers", "lights"]}
    assert out["many_floors"] == "more" and base["floor_off"] == "menu"  # the base is not modified
    assert hso.normalize({"summary_tiles": None}, out)["summary_tiles"] is None  # back to every kind
    assert hso.normalize({"area_quick": {"living": []}}, out)["area_quick"] == {"living": []}  # an area with no quick action at all
    for bad in ({"nope": 1}, {"floor_off": "x"}, {"summary_tiles": ["lights", "lights"]}, {"summary_tiles": ["pool"]}, {"summary_tiles": "lights"},
                {"area_quick": {"a": ["lights", "fans"]}}, {"area_quick": {"": ["lights"]}}, {"area_quick": ["a"]}, {"area_quick": {"a": "lights"}},
                {"many_floors": None}, "x", {"tile_climate": 1}):
        with pytest.raises(ValueError):
            hso.normalize(bad, base)


def test_personal_screen():
    assert hso.normalize_personal({"summary_tiles": None, "phone_area": None}) == {}
    assert hso.normalize_personal({"summary_tiles": ["alarm"], "phone_area": "full"}) == {"summary_tiles": ["alarm"], "phone_area": "full"}
    for bad in ({"phone_area": "half"}, {"summary_tiles": ["x"]}, {"floor_off": "menu"}):
        with pytest.raises(ValueError):
            hso.normalize_personal(bad)
    p = home_config.normalise_personal({"screen": {"phone_area": "full"}})
    assert p["screen"] == {"phone_area": "full"} and not home_config.personal_is_empty(p)
    assert "screen" not in home_config.normalise_personal({"screen": {}}) and home_config.personal_is_empty(home_config.normalise_personal({"screen": {}}))


def test_round_trip_refusal_audit_and_viewer(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        s = c.get("/api/v1/settings").json()["settings"]
        assert s["home.screen"] == hso.default() and s["home.info_style"] == "auto" and s["devices.default_view"] == "cards"
        r = c.patch("/api/v1/settings", json={"home.screen": {"many_floors": "tree_scroll", "area_quick": {"lobby": ["lights", "covers"]}}})
        assert r.status_code == 200, r.text
        got = c.get("/api/v1/settings").json()["settings"]["home.screen"]
        assert got["many_floors"] == "tree_scroll" and got["area_quick"] == {"lobby": ["lights", "covers"]} and got["floor_off"] == "menu"
        # a second partial update keeps the first one
        assert c.patch("/api/v1/settings", json={"home.screen": {"floor_off": "buttons"}}).status_code == 200
        got = c.get("/api/v1/settings").json()["settings"]["home.screen"]
        assert got["many_floors"] == "tree_scroll" and got["floor_off"] == "buttons"
        for bad in ({"home.screen": {"floor_off": "neon"}}, {"home.screen": {"bogus": True}}, {"home.screen": {"summary_tiles": ["x"]}}, {"home.info_style": "chips"}):
            assert c.patch("/api/v1/settings", json=bad).status_code == 422, bad
        assert c.patch("/api/v1/settings", json={"home.info_style": "auto"}).status_code == 200
        with app.state.db.connection() as conn:
            rows = [json.loads(x[0] or "{}") for x in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert any("home.screen" in json.dumps(x) for x in rows)
        bind(c, settings, "dana", "viewer", "installation", "*")
        seen = c.get("/api/v1/settings", headers=as_user("dana"))
        assert seen.status_code == 200 and seen.json()["settings"]["home.screen"]["floor_off"] == "buttons"
        assert c.patch("/api/v1/settings", json={"home.screen": {"floor_off": "menu"}}, headers=as_user("dana")).status_code == 403


def test_brand_dark_mode_defaults_to_invert(settings):
    with TestClient(create_app(settings)) as c:
        assert c.get("/api/v1/brand/public").json()["dark_mode"] == "invert"
        assert c.put("/api/v1/brand", json={"dark_mode": "plate"}).status_code == 200
        assert c.get("/api/v1/brand/public").json()["dark_mode"] == "plate"


def test_personal_screen_needs_the_permission(settings):
    with TestClient(create_app(settings)) as c:
        bind(c, settings, "ron", "viewer", "installation", "*")
        r = c.put("/api/v1/me/prefs", headers=as_user("ron"), json={"home.personal": {"screen": {"phone_area": "full"}}})
        assert r.status_code == 403
        # the system administrator holds screen.personalize
        r = c.put("/api/v1/me/prefs", json={"home.personal": {"screen": {"phone_area": "full", "summary_tiles": ["lights", "locks"]}}})
        assert r.status_code == 200, r.text
        assert r.json()["prefs"]["home.personal"]["screen"] == {"phone_area": "full", "summary_tiles": ["lights", "locks"]}
        assert c.put("/api/v1/me/prefs", json={"home.personal": {"screen": {"phone_area": "half"}}}).status_code == 422


def test_quick_card_choice():
    base = hso.default()
    assert base["quick_card"] == "show"
    assert hso.normalize({"quick_card": "hide"}, base)["quick_card"] == "hide"
    assert hso.stored('{"quick_card": "hide"}')["quick_card"] == "hide" and hso.stored('{"quick_card": "x"}')["quick_card"] == "show"
    for bad in ({"quick_card": "no"}, {"quick_card": True}, {"quick_card": None}):
        with pytest.raises(ValueError):
            hso.normalize(bad, base)


def test_quick_card_round_trip(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["home.screen"]["quick_card"] == "show"
        r = c.patch("/api/v1/settings", json={"home.screen": {"quick_card": "hide"}})
        assert r.status_code == 200, r.text
        assert c.get("/api/v1/settings").json()["settings"]["home.screen"]["quick_card"] == "hide"
def test_phone_floors_option_round_trip(settings):
    """FIX2232A-295: phone_floors = selector (default) | all; a bad value is refused; a partial patch keeps the others."""
    assert hso.default()["phone_floors"] == "selector" and hso.CHOICES["phone_floors"] == ("selector", "all")
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"]["home.screen"]["phone_floors"] == "selector"
        assert c.patch("/api/v1/settings", json={"home.screen": {"phone_floors": "all"}}).status_code == 200
        got = c.get("/api/v1/settings").json()["settings"]["home.screen"]
        assert got["phone_floors"] == "all" and got["floor_off"] == "menu"
        assert c.patch("/api/v1/settings", json={"home.screen": {"phone_floors": "neon"}}).status_code == 422
