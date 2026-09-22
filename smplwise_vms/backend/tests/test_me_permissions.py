"""/me carries two permission views (0.1.81): `permissions_installation` (what holds at the root scope, used for
installation-wide decisions) and `permissions_any` (held at any scope, the union of the allow bindings minus an
installation-wide deny). The shell's navigation reads the second one: a floor-scoped viewer has nothing at the
installation level and still has to see the map and the live area."""
from __future__ import annotations

from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.main import create_app


def test_permissions_any_is_the_union_over_scopes(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    me = c.get("/api/v1/me", headers=as_user("dana")).json()
    assert me["has_access"] is True
    assert me["permissions_installation"] == [], "a floor binding grants nothing at the root scope"
    assert {"map.read", "video.live", "entity.state.read"} <= set(me["permissions_any"])
    assert "events.read" not in me["permissions_any"]

    # a second binding elsewhere adds to the union; an installation-wide deny removes from it everywhere
    bind(c, settings, "dana", "operator", "floor", ids["floor3"])
    db = Database(settings.db_path)
    with db.connection() as conn:
        conn.execute(
            "INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
            "VALUES (?, 'user', 'dev-dana', 'kiosk', 'installation', '*', 'deny', ?, 'test', ?)",
            (new_id(), permission_revision(conn), now_iso()),
        )
    me = c.get("/api/v1/me", headers=as_user("dana")).json()
    assert "events.read" in me["permissions_any"] and "video.playback" in me["permissions_any"]
    assert "map.read" not in me["permissions_any"] and "video.live" not in me["permissions_any"], "denied at the root: gone everywhere"
    assert "entity.state.read" in me["permissions_any"], "the deny role did not carry this one"

    # the administrator holds everything at both levels
    admin = c.get("/api/v1/me").json()
    assert set(admin["permissions_any"]) == set(admin["permissions_installation"]) and "system.configure" in admin["permissions_any"]
