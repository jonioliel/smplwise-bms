"""Owner 2026-09-30: installation-wide tab configuration (`ui.tabs`) and the map's default floor (`map.default_floor`).
Contract: docs/architecture/TABS_CONFIG.md."""
import json

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app

URL = "/api/v1/settings"


def _audit_details(app):
    with app.state.db.connection() as conn:
        return [json.loads(r[0] or "{}") for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'settings.update' AND decision = 'allowed' ORDER BY rowid").fetchall()]


def test_ui_tabs_defaults_to_nothing_configured(client):
    got = client.get(URL).json()["settings"]
    assert got["ui.tabs"] == {}, "an object, not a JSON string; nothing configured = today's tabs"


def test_ui_tabs_round_trip_normalised_and_audited(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        body = {
            "security": {"order": ["alarm", "live", "alarm", "events"], "hidden": ["events", "events"]},
            "security.live": {"order": ["wall"]},  # nested levels are just other section ids; a missing list reads as []
            "explore": {"hidden": ["entities"]},
        }
        r = c.patch(URL, json={"ui.tabs": body})
        assert r.status_code == 200, r.text
        want = {
            "security": {"order": ["alarm", "live", "events"], "hidden": ["events"]},
            "security.live": {"order": ["wall"], "hidden": []},
            "explore": {"order": [], "hidden": ["entities"]},
        }
        assert r.json()["settings"]["ui.tabs"] == want
        assert c.get(URL).json()["settings"]["ui.tabs"] == want
        # the whole value is replaced, never merged; {} clears it
        assert c.patch(URL, json={"ui.tabs": {"explore": {"order": ["floors"]}}}).json()["settings"]["ui.tabs"] == {"explore": {"order": ["floors"], "hidden": []}}
        assert c.patch(URL, json={"ui.tabs": {}}).json()["settings"]["ui.tabs"] == {}
        assert c.get(URL).json()["settings"]["ui.tabs"] == {}
        # a patch without the key leaves it alone
        c.patch(URL, json={"ui.tabs": want})
        c.patch(URL, json={"ui.hide_map": "true"})
        assert c.get(URL).json()["settings"]["ui.tabs"] == want
        # every change is audited with the normalised value
        assert {"ui.tabs": want} in _audit_details(app)


def test_ui_tabs_rejects_bad_shapes_with_422(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        bad = [
            [],  # not an object
            "security",
            {"security": []},  # section is not an object
            {"security": "alarm"},
            {"security": {"order": "alarm"}},  # list expected
            {"security": {"order": [1]}},  # strings expected
            {"security": {"order": [None]}},
            {"security": {"order": [["a"]]}},
            {"security": {"hidden": {"a": 1}}},
            {"security": {"order": [], "extra": []}},  # unknown key
            {"security": {"sort": ["a"]}},
            {"Security": {"order": []}},  # not a slug: upper case
            {"secur ity": {"order": []}},
            {"": {"order": []}},
            {"-a": {"order": []}},
            {".a": {"order": []}},
            {"a/b": {"order": []}},
            {"a" * 49: {"order": []}},  # too long
            {"security": {"order": ["Alarm"]}},
            {"security": {"order": ["a b"]}},
            {"security": {"order": [""]}},
            {"security": {"hidden": ["<script>"]}},
            {"security": {"order": ["אזעקה"]}},
        ]
        for value in bad:
            r = c.patch(URL, json={"ui.tabs": value})
            assert r.status_code == 422, (value, r.status_code)
        assert c.get(URL).json()["settings"]["ui.tabs"] == {}, "nothing was stored by the refused patches"


def test_ui_tabs_size_caps(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ok = {f"s{i}": {"order": [f"t{j}" for j in range(64)], "hidden": [f"t{j}" for j in range(64)]} for i in range(64)}
        assert c.patch(URL, json={"ui.tabs": ok}).status_code == 200
        assert c.patch(URL, json={"ui.tabs": {f"s{i}": {} for i in range(65)}}).status_code == 422
        assert c.patch(URL, json={"ui.tabs": {"s": {"order": [f"t{j}" for j in range(65)]}}}).status_code == 422
        assert c.patch(URL, json={"ui.tabs": {"s": {"hidden": [f"t{j}" for j in range(65)]}}}).status_code == 422
        # duplicates count before de-duplication too: the cap is on what is sent
        assert c.patch(URL, json={"ui.tabs": {"s": {"order": ["a"] * 65}}}).status_code == 422
        assert len(c.get(URL).json()["settings"]["ui.tabs"]) == 64


def test_ui_tabs_slugs_accept_dots_hyphens_underscores(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        v = {"security.live": {"order": ["a-b", "c_d", "e.f", "g1"], "hidden": []}, "0": {"order": [], "hidden": []}}
        assert c.patch(URL, json={"ui.tabs": v}).json()["settings"]["ui.tabs"] == v


def test_ui_tabs_same_permission_as_tile_layout(settings):
    """Readable by everyone (the shell builds its tabs from it), writable only with system.configure - like ui.tile_layout."""
    app = create_app(settings)
    with TestClient(app) as c:
        assert c.patch(URL, json={"ui.tabs": {"explore": {"hidden": ["entities"]}}}).status_code == 200
        bind(c, settings, "ron", "viewer", "installation", "*")
        seen = c.get(URL, headers=as_user("ron"))
        assert seen.status_code == 200 and seen.json()["settings"]["ui.tabs"] == {"explore": {"order": [], "hidden": ["entities"]}}
        assert seen.json()["can_edit"] is False
        assert c.patch(URL, json={"ui.tabs": {}}, headers=as_user("ron")).status_code == 403
        assert c.patch(URL, json={"ui.tile_layout": "cards"}, headers=as_user("ron")).status_code == 403
        assert c.get(URL).json()["settings"]["ui.tabs"]["explore"]["hidden"] == ["entities"]


def test_ui_tabs_corrupt_stored_value_reads_as_empty(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        with app.state.db.connection() as conn:
            conn.execute("INSERT INTO settings(key, value) VALUES('ui.tabs', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", ("{not json",))
        assert c.get(URL).json()["settings"]["ui.tabs"] == {}
        with app.state.db.connection() as conn:
            conn.execute("UPDATE settings SET value = ? WHERE key = 'ui.tabs'", ('["a"]',))
        assert c.get(URL).json()["settings"]["ui.tabs"] == {}


def test_map_default_floor_validated_stored_and_audited(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        assert c.get(URL).json()["settings"]["map.default_floor"] == "", "empty = the built-in order"
        r = c.patch(URL, json={"map.default_floor": ids["floor2"]})
        assert r.status_code == 200, r.text
        assert r.json()["settings"]["map.default_floor"] == ids["floor2"]
        assert c.get(URL).json()["settings"]["map.default_floor"] == ids["floor2"]
        assert {"map.default_floor": ids["floor2"]} in _audit_details(app)
        # an id that is not a floor: 422, nothing stored
        for bad in ("nope", ids["building"], ids["site"], "x" * 65, "a b", "../x"):
            assert c.patch(URL, json={"map.default_floor": bad}).status_code == 422, bad
        assert c.get(URL).json()["settings"]["map.default_floor"] == ids["floor2"]
        # empty clears it
        assert c.patch(URL, json={"map.default_floor": ""}).json()["settings"]["map.default_floor"] == ""
        # permission: a viewer reads it, cannot set it
        c.patch(URL, json={"map.default_floor": ids["floor3"]})
        bind(c, settings, "ron", "viewer", "installation", "*")
        assert c.get(URL, headers=as_user("ron")).json()["settings"]["map.default_floor"] == ids["floor3"]
        assert c.patch(URL, json={"map.default_floor": ""}, headers=as_user("ron")).status_code == 403


def test_map_default_floor_refuses_a_deleted_floor(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        assert c.delete(f"/api/v1/floors/{ids['floor3']}").status_code == 204
        assert c.patch(URL, json={"map.default_floor": ids["floor3"]}).status_code == 422


def test_deleting_the_default_floor_clears_the_setting_and_audits_it(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        c.patch(URL, json={"map.default_floor": ids["floor3"]})
        # another floor being deleted leaves it alone
        assert c.delete(f"/api/v1/floors/{ids['floor2']}").status_code == 204
        assert c.get(URL).json()["settings"]["map.default_floor"] == ids["floor3"]
        with app.state.db.connection() as conn:
            other = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'floor.delete' AND resource_id = ?", (ids["floor2"],)).fetchone()[0])
        assert other["map_default_floor_cleared"] is False
        # the default floor itself: cleared automatically, with a settings.update row and a flag on the floor.delete row
        assert c.delete(f"/api/v1/floors/{ids['floor3']}").status_code == 204
        assert c.get(URL).json()["settings"]["map.default_floor"] == ""
        assert {"map.default_floor": "", "reason": "floor_deleted", "floor_id": ids["floor3"]} in _audit_details(app)
        with app.state.db.connection() as conn:
            row = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'floor.delete' AND resource_id = ?", (ids["floor3"],)).fetchone()[0])
        assert row["map_default_floor_cleared"] is True


def test_deleting_the_default_floor_with_anchors_via_force_clears_it_too(settings):
    """The 409 path (anchors, no force) must not clear anything; the forced delete does."""
    app = create_app(settings)
    with TestClient(app) as c:
        ids = seed_tree(c)
        c.patch(URL, json={"map.default_floor": ids["floor2"]})
        cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "כניסה"}).json()
        asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
        v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
        c.post(f"/api/v1/plan-versions/{v['id']}/publish")
        assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.25, "y": 0.4}).status_code == 201
        refused = c.delete(f"/api/v1/floors/{ids['floor2']}")
        assert refused.status_code == 409
        assert c.get(URL).json()["settings"]["map.default_floor"] == ids["floor2"]
        assert c.delete(f"/api/v1/floors/{ids['floor2']}?force=true").status_code == 204
        assert c.get(URL).json()["settings"]["map.default_floor"] == ""
