"""CR-ADMIN-GATE-2438 - authorize() uses the ONE system-wide "active user" (services/active_users, owner decision O16 a; lead decision on
question 1 of CR-RBAC-EVAL-2438): disabled on either side (`users.active = 0` or `ha_users.is_active = 0`) refuses with `user_inactive`.
No row on a side is NOT disabled there: a local (Arx-only) identity has no `ha_users` row and stays active; the service identity (a Home
Assistant user with no Arx row) is not touched. The administrator count, the camera scope and the permissions fingerprint follow."""
from __future__ import annotations

from conftest import as_user, bind, seed_tree

from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.rbac import INSTALLATION, Principal, admin_count, authorize, permissions_fingerprint
from smplwise.services.access import camera_scope
from smplwise.services.active_users import is_disabled

API = "/api/v1"


def _conn(settings):
    return Database(settings.db_path).connection()


def _p(uid: str, source: str = "dev") -> Principal:
    return Principal(user_id=uid, username=uid, display_name=uid, source=source)


def _ha(conn, uid: str, active: bool) -> None:
    conn.execute("INSERT OR REPLACE INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, ?, ?, ?, 0, ?)",
                 (uid, uid, uid, 1 if active else 0, now_iso()))


def _bind(conn, uid: str, role: str) -> None:
    conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                 "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), uid, role, permission_revision(conn), now_iso()))


def test_disabled_only_on_the_ha_side_is_refused(client, settings):
    bind(client, settings, "dana", "viewer", "installation", "*")
    with _conn(settings) as conn:
        assert authorize(conn, _p("dev-dana"), "map.read", INSTALLATION).allowed
        before = permissions_fingerprint(conn, _p("dev-dana"))
        _ha(conn, "dev-dana", False)  # users.active stays 1: the old rule let her through
    with _conn(settings) as conn:
        d = authorize(conn, _p("dev-dana"), "map.read", INSTALLATION)
        assert not d.allowed and d.reason == "user_inactive"
        assert permissions_fingerprint(conn, _p("dev-dana")) != before, "the shell re-fetches /me"
        scope = camera_scope(conn, _p("dev-dana"), "map.read")
        assert not scope.everything and not scope.ids
    assert client.get(f"{API}/sites", headers=as_user("dana")).json()["sites"] == []


def test_active_on_both_sides_and_disabled_on_the_users_side(client, settings):
    bind(client, settings, "dana", "viewer", "installation", "*")
    with _conn(settings) as conn:
        _ha(conn, "dev-dana", True)
    with _conn(settings) as conn:
        assert authorize(conn, _p("dev-dana"), "map.read", INSTALLATION).allowed
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-dana'")
    with _conn(settings) as conn:
        assert authorize(conn, _p("dev-dana"), "map.read", INSTALLATION).reason == "user_inactive"


def test_a_local_only_user_without_an_ha_users_row_stays_active(client, settings):
    seed_tree(client)
    with _conn(settings) as conn:
        now = now_iso()
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES ('l_rina', 'rina', 'rina', 'local', 1, ?, ?)", (now, now))
        _bind(conn, "l_rina", "viewer")
        assert conn.execute("SELECT COUNT(*) FROM ha_users WHERE id = 'l_rina'").fetchone()[0] == 0
    with _conn(settings) as conn:
        assert is_disabled(conn, "l_rina") is False
        assert authorize(conn, _p("l_rina", "local"), "map.read", INSTALLATION).allowed
        conn.execute("UPDATE users SET active = 0 WHERE id = 'l_rina'")
    with _conn(settings) as conn:
        assert authorize(conn, _p("l_rina", "local"), "map.read", INSTALLATION).reason == "user_inactive", "her own switch still works"


def test_a_principal_with_no_row_at_all_is_judged_by_its_bindings(client, settings):
    with _conn(settings) as conn:
        assert is_disabled(conn, "never-seen") is False
        assert authorize(conn, _p("never-seen"), "map.read", INSTALLATION).reason == "no_binding"


def test_the_service_identity_is_not_affected(client, settings):
    """The service identity is an active, non-administrator Home Assistant user with no Arx row (services/service_identity): it is never an
    Arx principal, and the active rule neither disables it nor grants it anything."""
    with _conn(settings) as conn:
        _ha(conn, "0123456789abcdef0123456789abcdef", True)
    with _conn(settings) as conn:
        assert is_disabled(conn, "0123456789abcdef0123456789abcdef") is False
        assert authorize(conn, _p("0123456789abcdef0123456789abcdef", "ingress"), "map.read", INSTALLATION).reason == "no_binding"


def test_the_administrator_count_drops_an_admin_disabled_on_the_ha_side(client, settings):
    client.get(f"{API}/me")
    bind(client, settings, "kim", "system_admin", "installation", "*")
    with _conn(settings) as conn:
        assert admin_count(conn) == 2
        _ha(conn, "dev-kim", False)
    with _conn(settings) as conn:
        assert admin_count(conn) == 1
        assert not authorize(conn, _p("dev-kim"), "rbac.roles.manage", INSTALLATION).allowed, "the count and authorize agree"
