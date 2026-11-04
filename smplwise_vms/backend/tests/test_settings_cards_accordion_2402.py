"""SETTINGS-CARDS-ACCORDION-2402 (owner 04.11 night, round 20 Q2 = a): `access.settings_layout` gains `accordion` - the cards of Settings ›
"מתגי מסכי כניסה" opened in place on a desktop too. cards stays the default; tabs and list are unchanged."""
import json

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers.settings import DEFAULTS

KEY = "access.settings_layout"


def test_default_is_still_cards():
    assert DEFAULTS[KEY] == "cards"


def test_accordion_round_trip_audited_and_back(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"][KEY] == "cards"
        r = c.patch("/api/v1/settings", json={KEY: "accordion"})
        assert r.status_code == 200, r.text
        assert r.json()["settings"][KEY] == "accordion"
        assert c.get("/api/v1/settings").json()["settings"][KEY] == "accordion"
        for layout in ("tabs", "list", "cards"):  # the other three keep working
            assert c.patch("/api/v1/settings", json={KEY: layout}).json()["settings"][KEY] == layout
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {KEY: "accordion"} in rows


def test_refuses_near_misses(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        for bad in ("Accordion", "accordeon", "accordion ", "inplace", "cards_inline", "cards|accordion"):
            assert c.patch("/api/v1/settings", json={KEY: bad}).status_code == 422, bad


def test_only_who_configures_the_system_may_choose_it(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        bind(c, settings, "ron", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", json={KEY: "accordion"}, headers=as_user("ron")).status_code == 403


def test_a_stored_accordion_reads_back_and_a_corrupt_value_is_cards(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (KEY, "accordion"))
        assert c.get("/api/v1/settings").json()["settings"][KEY] == "accordion"
        with app.state.db.connection() as conn:
            conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (KEY, "sideways"))
        assert c.get("/api/v1/settings").json()["settings"][KEY] == "cards"
