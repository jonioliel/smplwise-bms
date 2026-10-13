"""CR-040 (WXROT): who may rotate the bridge trust key - `access.trust.rotate`, and nothing else.

The matrix (fakes only; a refused caller never reaches the fake bridge): every built-in role but system_admin is refused on all three
routes and audited; a CUSTOM role holding only `access.trust.rotate` (in its sensitive list) passes all three - a person who is not a
system administrator; the same role bound at a site scope, or with a deny binding, is refused; the permission cannot sit in a role's
plain list, cannot be delegated, is no system permission and is labelled; a bearer-token client is refused even with the permission;
`/me` shows it to its holder."""
from __future__ import annotations

import pytest
from conftest import as_user, bind, seed_tree
from fake_trusted_bridge import TEST_TRUST_KEY, FakeTrustBridge
from fastapi.testclient import TestClient

from smplwise.db import Database, set_setting
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.rbac import ROLES, Principal
from smplwise.routers import bridge_trust as router_mod
from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE, SYSTEM_PERMISSIONS
from smplwise.services import bridge_trust

API = "/api/v1"
PERM = "access.trust.rotate"
VIEW = f"{API}/ha/bridge/trust"
ROTATE = f"{API}/ha/bridge/trust/rotations"


@pytest.fixture()
def env(settings, monkeypatch):
    c = TestClient(create_app(settings))
    c.get(f"{API}/me")
    db = c.app.state.db
    with db.connection() as conn:
        set_setting(conn, "bridge.secret", TEST_TRUST_KEY)
        set_setting(conn, "bridge.paired_at", "2026-10-13T00:00:00Z")
    fake = FakeTrustBridge().install(monkeypatch)
    assert c.post(f"{API}/ha/bridge/directory", json=fake.push()).status_code == 200
    bridge_trust.reset_limits()
    yield c, settings, db, fake
    fake.close()


def _custom(c: TestClient, name: str, sensitive: list[str], permissions: list[str] | None = None, delegable: bool = False):
    return c.post(f"{API}/access/roles", json={"name": name, "description": "CR-040 test", "permissions": permissions or [], "sensitive": sensitive, "delegable": delegable})


def _probe(c: TestClient, user: str) -> tuple[int, int, int]:
    h = as_user(user)
    return (c.get(VIEW, headers=h).status_code, c.post(ROTATE, json={"confirmed": True}, headers=h).status_code,
            c.post(f"{ROTATE}/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b/check", headers=h).status_code)


def test_the_permission_is_sensitive_assignable_labelled_and_only_system_admin_holds_it_by_default():
    assert {r for r, perms in ROLES.items() if PERM in perms} == {"system_admin"}
    assert PERM in SENSITIVE and PERM not in SYSTEM_PERMISSIONS
    assert PERMISSION_LABELS[PERM].startswith("בקרת כניסה: ") and "Home Assistant" not in PERMISSION_LABELS[PERM]
    assert bridge_trust.PERMISSION == PERM


@pytest.mark.parametrize("role", ["viewer", "kiosk", "operator", "editor", "site_admin", "door_opener"])
def test_every_other_builtin_role_is_refused_and_audited(env, role):
    c, settings, db, fake = env
    bind(c, settings, "rx", role, "installation", "*")
    assert _probe(c, "rx") == (403, 403, 403)
    assert not fake.calls
    with db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied' AND actor_user_id = 'dev-rx'", (PERM,)).fetchone()[0]
    assert denied == 3


def test_the_system_administrator_may(env):
    c, settings, db, fake = env
    assert c.get(VIEW).status_code == 200
    me = c.get(f"{API}/me").json()
    assert PERM in me["permissions_installation"]


def test_a_custom_role_with_only_the_permission_rotates_without_being_an_administrator(env):
    c, settings, db, fake = env
    r = _custom(c, "החלפת מפתח בלבד", [PERM])
    assert r.status_code == 201, r.text
    bind(c, settings, "keyholder", r.json()["id"], "installation", "*")
    h = as_user("keyholder")
    me = c.get(f"{API}/me", headers=h).json()
    assert PERM in me["permissions_installation"] and "system.configure" not in me["permissions_installation"]
    assert c.get(VIEW, headers=h).status_code == 200
    out = c.post(ROTATE, json={"confirmed": True}, headers=h)
    assert out.status_code == 200 and out.json()["state"] == "rotated", out.text
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT initiator_id FROM bridge_trust_rotations").fetchone()
    assert row["initiator_id"] == "dev-keyholder", "the logical initiator is the person"
    # the same person may not reach anything else of the administrator's
    assert c.get(f"{API}/ha/bridge/pairing", headers=h).status_code == 403


def test_a_site_scoped_binding_or_a_deny_is_refused(env):
    c, settings, db, fake = env
    tree = seed_tree(c)
    rid = _custom(c, "מפתח באתר", [PERM]).json()["id"]
    bind(c, settings, "sitekey", rid, "site", tree["site"])
    assert _probe(c, "sitekey") == (403, 403, 403), "installation scope only"
    bind(c, settings, "denied", rid, "installation", "*")
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES ('trust-deny', 'user', 'dev-denied', ?, 'installation', '*', 'deny', 1, 'test', '2026-10-13T00:00:00Z')", (rid,))
    assert _probe(c, "denied") == (403, 403, 403), "a deny wins"
    assert not fake.calls


def test_the_permission_only_in_the_sensitive_list_and_never_delegable(env):
    c, settings, db, fake = env
    plain = _custom(c, "שגוי", [], permissions=[PERM])
    assert plain.status_code == 422 and plain.json()["code"] == "sensitive_in_permissions"
    flagged = _custom(c, "מואצל", [PERM], delegable=True)
    assert flagged.status_code == 422 and flagged.json()["code"] == "sensitive_role_not_delegable"
    rid = _custom(c, "מפתח", [PERM]).json()["id"]
    r = c.put(f"{API}/access/delegation", json={"delegable_roles": ["viewer", rid]})
    assert r.status_code == 422 and r.json()["code"] == "sensitive_role_not_delegable"


def test_a_bearer_token_client_is_refused_even_with_the_permission(env):
    c, settings, db, fake = env
    with db.connection() as conn:
        for source, via, ok in (("remote", "bearer", False), ("remote", "cookie", True), ("ingress", "", True), ("dev", "", True)):
            p = Principal("u1", "u1", "u1", source, via=via)
            if ok:
                router_mod._interactive(conn, p, _Req())
            else:
                with pytest.raises(ApiError) as e:
                    router_mod._interactive(conn, p, _Req())
                assert e.value.status == 403 and e.value.code == "interactive_session_required"
        refused = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'bridge.trust.rotation.refused' AND reason = 'interactive_session_required'").fetchone()[0]
    assert refused == 1


class _Req:
    class state:  # noqa: N801 - the shape of starlette's request.state
        correlation_id = "test"
