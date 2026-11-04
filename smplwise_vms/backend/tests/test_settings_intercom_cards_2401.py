"""SETTINGS-INTERCOM-CARDS-2401 (owner 04.11, round 19 Q6 = a): how the Settings tab "מתגי מסכי כניסה" is laid out, per installation -
`access.settings_layout` = cards (a, the default) | tabs (b) | list (c). Stored, read back, validated, audited, administrators only, and a
corrupt stored value reads as the default."""
import json

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.routers.settings import DEFAULTS

KEY = "access.settings_layout"


def test_default_is_cards():
    assert DEFAULTS[KEY] == "cards"


def test_round_trip_every_layout_and_audited(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.get("/api/v1/settings").json()["settings"][KEY] == "cards"
        for layout in ("tabs", "list", "cards"):
            r = c.patch("/api/v1/settings", json={KEY: layout})
            assert r.status_code == 200, r.text
            assert r.json()["settings"][KEY] == layout
            assert c.get("/api/v1/settings").json()["settings"][KEY] == layout
        with app.state.db.connection() as conn:
            rows = [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]
        assert {KEY: "tabs"} in rows and {KEY: "list"} in rows and {KEY: "cards"} in rows


def test_refuses_anything_else(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        for bad in ("", "a", "b", "c", "Cards", "grid", "cards ", "tabs|list", 1):
            assert c.patch("/api/v1/settings", json={KEY: bad}).status_code == 422, bad
        assert c.get("/api/v1/settings").json()["settings"][KEY] == "cards"


def test_only_who_configures_the_system_may_change_it(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        bind(c, settings, "ron", "viewer", "installation", "*")
        assert c.patch("/api/v1/settings", json={KEY: "list"}, headers=as_user("ron")).status_code == 403
        assert c.get("/api/v1/settings").json()["settings"][KEY] == "cards"
        # every signed-in user reads it (the tab draws itself from it)
        assert c.get("/api/v1/settings", headers=as_user("ron")).json()["settings"][KEY] == "cards"


def test_a_corrupt_stored_value_reads_as_the_default(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (KEY, "sideways"))
        assert c.get("/api/v1/settings").json()["settings"][KEY] == "cards"
        # the stored row is left as it is; the next valid save replaces it
        assert c.patch("/api/v1/settings", json={KEY: "tabs"}).json()["settings"][KEY] == "tabs"
