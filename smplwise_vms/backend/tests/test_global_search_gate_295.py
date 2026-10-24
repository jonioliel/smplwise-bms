"""TOPPILL-295 (owner 2026-10-24): the top-left pill's search is OFF by default, an installation setting the owner turns on and
narrows to roles, enforced by GET /search itself (not only by hiding the button); and a camera hit needs the right to watch it."""
from __future__ import annotations

import json

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import now_iso
from smplwise.main import create_app

API = "/api/v1"


def _app(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    assert c.post(f"{API}/cameras", json={"channel": 4, "alias": "כניסה ראשית"}).status_code in (200, 201)
    return app, c, ids


def _hits(c, who=None):
    r = c.get(f"{API}/search?q=כניסה", headers=as_user(who) if who else {})
    return r.status_code, r.json()


def test_search_is_off_by_default_for_everyone_including_the_admin(settings):
    app, c, ids = _app(settings)
    assert c.get(f"{API}/settings").json()["settings"]["ui.global_search"] == "off"
    status, body = _hits(c)
    assert status == 403 and body["code"] == "search_disabled"
    assert c.get(f"{API}/settings").json()["search_allowed"] is False


def test_admins_mode_lets_only_a_system_administrator_search(settings):
    app, c, ids = _app(settings)
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.patch(f"{API}/settings", json={"ui.global_search": "admins"}).status_code == 200
    assert _hits(c)[0] == 200
    assert _hits(c, "ron")[0] == 403
    assert c.get(f"{API}/settings", headers=as_user("ron")).json()["search_allowed"] is False


def test_roles_mode_admits_the_listed_roles_only(settings):
    app, c, ids = _app(settings)
    bind(c, settings, "ron", "viewer", "installation", "*")
    bind(c, settings, "dana", "operator", "installation", "*")
    assert c.patch(f"{API}/settings", json={"ui.global_search": "roles", "ui.global_search_roles": "operator"}).status_code == 200
    assert _hits(c, "dana")[0] == 200
    assert _hits(c, "ron")[0] == 403
    assert _hits(c)[0] == 200, "the administrator always passes while the search is on"
    assert c.patch(f"{API}/settings", json={"ui.global_search": "all"}).status_code == 200
    assert _hits(c, "ron")[0] == 200
    assert c.patch(f"{API}/settings", json={"ui.global_search": "off"}).status_code == 200
    assert _hits(c, "dana")[0] == 403 and _hits(c)[0] == 403


def test_the_setting_values_are_validated(settings):
    app, c, ids = _app(settings)
    assert c.patch(f"{API}/settings", json={"ui.global_search": "sometimes"}).status_code == 422
    assert c.patch(f"{API}/settings", json={"ui.global_search_roles": "a b;c"}).status_code == 422
    assert c.patch(f"{API}/settings", json={"ui.global_search_roles": "operator,site_admin"}).status_code == 200


def test_a_camera_the_caller_may_not_watch_is_not_a_hit(settings):
    """A role with the map but without video.live used to find camera names and channels; now the camera must be watchable."""
    app, c, ids = _app(settings)
    now = now_iso()
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('map_only', 'מפה בלבד', ?, ?, ?)",
                     (json.dumps(["map.read"]), now, now))
    bind(c, settings, "mia", "map_only", "installation", "*")
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.patch(f"{API}/settings", json={"ui.global_search": "all"}).status_code == 200
    kinds = lambda who: {x["kind"] for x in c.get(f"{API}/search?q=כניסה", headers=as_user(who)).json()["results"]}  # noqa: E731
    assert "camera" not in kinds("mia")
    assert "camera" in kinds("ron")


def test_only_a_system_administrator_edits_the_setting_or_sees_the_diagnostics(settings):
    """The status dot opens הגדרות › בריאות: that screen's data and every settings write already need system.configure."""
    app, c, ids = _app(settings)
    bind(c, settings, "ron", "viewer", "installation", "*")
    assert c.patch(f"{API}/settings", json={"ui.global_search": "all"}, headers=as_user("ron")).status_code == 403
    assert c.get(f"{API}/settings", headers=as_user("ron")).json()["can_edit"] is False
    health = c.get(f"{API}/health", headers=as_user("ron")).json()
    assert "process" not in health and "push" not in health, "the diagnostics block is for system.configure only"
