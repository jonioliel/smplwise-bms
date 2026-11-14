"""CR-008 amendment (owner request 2026-10-01): `remote.admins_default` - an administrator (an active installation-wide
`system_admin` binding, rbac.is_system_admin) is admitted to the remote channel without a per-user flag. The admission
matrix, the 60 s re-validation, the audit `basis`, the access list's fields and the setting's validation."""
from __future__ import annotations

import asyncio
import dataclasses
import json

import pytest
from fastapi.testclient import TestClient

from smplwise.db import new_id, now_iso, permission_revision
from smplwise.rbac import is_system_admin
from smplwise.services import ha_user_auth as hua
from test_remote_access import Arx, _www


@pytest.fixture()
def arx(settings, tmp_path, monkeypatch):
    a = Arx(settings, tmp_path, monkeypatch)
    a.bind("dev-joni", "system_admin")  # the local (developer identity) administrator
    yield a
    hua.reset_for_tests()


def bind_raw(arx: Arx, user_id: str, role: str = "system_admin", *, kind: str = "user", scope=("installation", "*"), effect: str = "allow",
             expires_at: str | None = None, revoked_at: str | None = None) -> None:
    with arx.db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at, expires_at, revoked_at) "
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'test', ?, ?, ?)",
                     (new_id(), kind, user_id, role, scope[0], scope[1], effect, permission_revision(conn), now_iso(), expires_at, revoked_at))


def created(arx: Arx) -> list[dict]:
    return [json.loads(r["details_json"]) for r in arx.audit("auth.remote_session.created")]


def sync_all_stale() -> None:
    for s in hua.STORE._sessions.values():
        s.last_validated -= hua.REVALIDATE_EVERY_S + 1


def users_list(arx: Arx) -> dict[str, dict]:
    admin = TestClient(arx.app)
    return {u["id"]: u for u in admin.get("/api/v1/identity/users").json()["users"]}


# ---------------------------------------------------------------- the predicate

def test_is_system_admin_follows_the_effective_binding(arx):
    def check(uid: str) -> bool:
        with arx.db.connection(mode="read") as conn:
            return is_system_admin(conn, uid)

    assert check("u-owner") is False  # an HA admin flag alone is information only
    bind_raw(arx, "u-owner", "site_admin")
    assert check("u-owner") is False
    bind_raw(arx, "u-viewer", "system_admin", scope=("site", "s1"))
    assert check("u-viewer") is False  # not installation-wide
    bind_raw(arx, "u-mfa", "system_admin", expires_at="2000-01-01T00:00:00Z")
    assert check("u-mfa") is False  # expired
    arx.bind("u-owner", "system_admin")
    assert check("u-owner") is True
    bind_raw(arx, "u-owner", "system_admin", effect="deny")
    assert check("u-owner") is False  # an installation-wide deny of the role wins


# ---------------------------------------------------------------- admitted / refused

def test_the_default_is_on_and_admits_an_administrator_without_a_flag(arx):
    arx.bind("u-owner", "system_admin")
    with arx.db.connection(mode="read") as conn:
        assert hua.remote_settings(conn)["remote.admins_default"] == "true"
    r = arx.login(arx.owner, **{"CF-Connecting-IP": "203.0.113.7"})
    assert r.status_code == 200, r.text
    assert arx.client.get("/arx/api/v1/me").json()["user"]["id"] == "u-owner"
    row = arx.audit("auth.remote_session.created")[-1]
    details = json.loads(row["details_json"])
    assert details["basis"] == "admin_default" and details["channel"] == "remote"
    assert "Bearer" not in row["details_json"] and "eyJ" not in row["details_json"]


def test_switched_off_the_administrator_needs_the_flag_again(arx):
    arx.bind("u-owner", "system_admin")
    arx.setting("remote.admins_default", "false")
    r = arx.login(arx.owner)
    assert r.status_code == 403 and r.json()["code"] == "remote_not_allowed"
    assert "הגישה מרחוק לא הופעלה" in r.json()["user_message"]
    arx.flag("u-owner")
    assert arx.login(arx.owner).status_code == 200
    assert created(arx)[-1]["basis"] == "flag"


def test_an_explicit_flag_is_recorded_even_for_an_administrator(arx):
    arx.bind("u-owner", "system_admin")
    arx.flag("u-owner")
    assert arx.login(arx.owner).status_code == 200
    assert created(arx)[-1]["basis"] == "flag"


def test_a_non_administrator_still_needs_the_flag(arx):
    arx.bind("u-viewer", "viewer")
    r = arx.login(arx.viewer)
    assert r.status_code == 403 and r.json()["code"] == "remote_not_allowed"
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    assert created(arx)[-1]["basis"] == "flag"


def test_an_ha_admin_without_the_system_admin_role_is_not_an_administrator(arx):
    # u-owner is an HA owner and admin in the fake core, and has no binding at all
    assert arx.login(arx.owner).status_code == 403
    arx.bind("u-owner", "site_admin")
    assert arx.login(arx.owner).status_code == 403
    assert arx.audit("auth.remote_session.rejected")[-1]["reason"] == "remote_not_allowed"


@pytest.mark.parametrize("kw", [
    {"scope": ("site", "s1")},
    {"effect": "deny"},
    {"expires_at": "2000-01-01T00:00:00Z"},
    {"revoked_at": "2000-01-01T00:00:00Z"},
], ids=["site-scope", "deny", "expired", "revoked"])
def test_a_binding_that_is_not_an_effective_installation_admin_does_not_count(arx, kw):
    bind_raw(arx, "u-owner", "system_admin", **kw)
    assert arx.login(arx.owner).status_code == 403


def test_an_administrator_through_a_group_counts(arx):
    gid = new_id()
    with arx.db.connection() as conn:
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES ('u-owner', 'joni', 'יוני', 'ingress', 1, ?, ?)", (now_iso(), now_iso()))
        conn.execute("INSERT INTO groups(id, name, created_at) VALUES (?, 'admins', ?)", (gid, now_iso()))
        conn.execute("INSERT INTO group_members(group_id, user_id) VALUES (?, 'u-owner')", (gid,))
    bind_raw(arx, gid, "system_admin", kind="group")
    assert arx.login(arx.owner).status_code == 200
    assert created(arx)[-1]["basis"] == "admin_default"


@pytest.mark.parametrize("where", ["ha_users", "users"])
def test_an_inactive_administrator_is_refused(arx, where):
    arx.bind("u-owner", "system_admin")
    with arx.db.connection() as conn:
        if where == "ha_users":
            conn.execute("UPDATE ha_users SET is_active = 0 WHERE id = 'u-owner'")
        else:
            conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES ('u-owner', 'joni', 'יוני', 'ingress', 0, ?, ?)", (now_iso(), now_iso()))
    r = arx.login(arx.owner)
    assert r.status_code == 403 and r.json()["code"] == "remote_user_inactive"


def test_policy_any_role_is_unchanged(arx):
    arx.setting("remote.policy", "any_role")
    arx.setting("remote.admins_default", "false")  # irrelevant under any_role
    assert arx.login(arx.owner).status_code == 403  # no role at all
    arx.bind("u-owner", "system_admin")
    arx.bind("u-viewer", "viewer")
    assert arx.login(arx.owner).status_code == 200
    assert arx.login(arx.viewer).status_code == 200
    assert [c["basis"] for c in created(arx)] == ["any_role", "any_role"]


def test_mfa_for_administrators_still_applies_to_the_default(arx):
    arx.bind("u-owner", "system_admin")
    arx.bind("u-mfa", "system_admin")
    arx.setting("remote.require_mfa_admin", "true")
    r = arx.login(arx.owner)
    assert r.status_code == 403 and r.json()["code"] == "remote_mfa_required"
    assert arx.login(arx.mfa).status_code == 200  # an administrator with MFA at HA
    assert created(arx)[-1]["basis"] == "admin_default"
    arx.setting("remote.require_mfa_admin", "false")
    assert arx.login(arx.owner).status_code == 200


def test_the_addon_option_still_gates_the_whole_channel(settings, tmp_path, monkeypatch):
    hua.reset_for_tests()
    arx = Arx(settings, tmp_path, monkeypatch)
    try:
        arx.bind("u-owner", "system_admin")
        off = TestClient(create_app_off(arx), headers={"Origin": "http://testserver"})
        r = off.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {arx.token(arx.owner)}"})
        assert r.status_code == 404
        assert off.get("/arx/api/v1/me").status_code == 404
    finally:
        hua.reset_for_tests()


def create_app_off(arx: Arx):
    from smplwise.main import create_app

    return create_app(dataclasses.replace(arx.settings, remote_access=False))


# ---------------------------------------------------------------- the bearer path

def test_a_bearer_client_is_admitted_by_the_default_too(arx):
    arx.bind("u-owner", "system_admin")
    r = arx.client.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(arx.owner)}"})
    assert r.status_code == 200 and r.json()["user"]["id"] == "u-owner"
    assert created(arx)[-1]["basis"] == "admin_default"
    arx.setting("remote.admins_default", "false")
    other = TestClient(arx.app)  # no cookie: a bearer-only client with a fresh token
    r = other.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(arx.owner)}", "Origin": "http://testserver"})
    assert r.status_code == 403 and r.json()["code"] == "remote_not_allowed"


# ---------------------------------------------------------------- re-validation

def test_switching_the_default_off_drops_the_session_within_a_pass(arx):
    arx.bind("u-owner", "system_admin")
    assert arx.login(arx.owner).status_code == 200
    sync_all_stale()
    assert asyncio.run(hua.revalidate_once(arx.db, arx.settings)) == 0  # still admitted
    arx.setting("remote.admins_default", "false")
    sync_all_stale()
    assert asyncio.run(hua.revalidate_once(arx.db, arx.settings)) == 1
    assert arx.client.get("/arx/api/v1/me").status_code == 401
    assert arx.audit("auth.remote_session.revoked")[-1]["reason"] == "remote_not_allowed"


def test_the_flag_keeps_the_session_when_the_default_is_switched_off(arx):
    arx.bind("u-owner", "system_admin")
    arx.flag("u-owner")
    assert arx.login(arx.owner).status_code == 200
    arx.setting("remote.admins_default", "false")
    sync_all_stale()
    assert asyncio.run(hua.revalidate_once(arx.db, arx.settings)) == 0


def test_an_administrator_who_stops_being_one_drops_the_session(arx):
    arx.bind("u-owner", "system_admin")
    assert arx.login(arx.owner).status_code == 200
    with arx.db.connection() as conn:
        conn.execute("UPDATE bindings SET revoked_at = ? WHERE subject_id = 'u-owner'", (now_iso(),))
    sync_all_stale()
    assert asyncio.run(hua.revalidate_once(arx.db, arx.settings)) == 1
    assert arx.client.get("/arx/api/v1/me").status_code == 401


def test_an_idle_session_is_re_checked_on_reuse_after_the_default_goes_off(arx):
    arx.bind("u-owner", "system_admin")
    assert arx.login(arx.owner).status_code == 200
    arx.setting("remote.admins_default", "false")
    for s in hua.STORE._sessions.values():
        s.last_validated -= hua.STALE_AFTER_S + 5
    assert arx.client.get("/arx/api/v1/me").status_code == 403


# ---------------------------------------------------------------- the access list and the flag endpoint

def test_the_users_list_shows_the_default_and_its_basis(arx):
    arx.bind("u-owner", "system_admin")
    arx.bind("u-viewer", "viewer")
    users = users_list(arx)
    assert users["u-owner"]["remote_access"] is True and users["u-owner"]["remote_access_basis"] == "admin_default"
    assert users["u-owner"]["remote_admin_default"] is True
    assert users["u-viewer"]["remote_access"] is False and users["u-viewer"]["remote_access_basis"] is None
    assert users["u-viewer"]["remote_admin_default"] is False
    arx.flag("u-viewer")
    arx.flag("u-owner")
    users = users_list(arx)
    assert users["u-viewer"]["remote_access_basis"] == "flag" and users["u-owner"]["remote_access_basis"] == "flag"
    assert users["u-owner"]["remote_admin_default"] is True  # would still be admitted without the flag
    arx.setting("remote.admins_default", "false")
    arx.flag("u-owner", False)
    users = users_list(arx)
    assert users["u-owner"]["remote_access"] is False and users["u-owner"]["remote_access_basis"] is None
    assert users["u-owner"]["remote_admin_default"] is False


def test_the_users_list_leaves_the_default_out_of_inactive_and_any_role(arx):
    arx.bind("u-owner", "system_admin")
    with arx.db.connection() as conn:
        conn.execute("UPDATE ha_users SET is_active = 0 WHERE id = 'u-owner'")
    assert users_list(arx)["u-owner"]["remote_access"] is False
    with arx.db.connection() as conn:
        conn.execute("UPDATE ha_users SET is_active = 1 WHERE id = 'u-owner'")
    assert users_list(arx)["u-owner"]["remote_access"] is True
    arx.setting("remote.policy", "any_role")
    users = users_list(arx)
    assert users["u-owner"]["remote_access"] is False and users["u-owner"]["remote_access_basis"] is None  # the per-user flag does not decide there


def test_turning_the_flag_off_for_an_administrator_ends_nothing(arx):
    arx.bind("u-owner", "system_admin")
    arx.flag("u-owner")
    assert arx.login(arx.owner).status_code == 200
    admin = TestClient(arx.app)
    r = admin.put("/api/v1/access/users/u-owner/remote-access", json={"enabled": False})
    assert r.status_code == 200
    assert r.json() == {"user_id": "u-owner", "remote_access": True, "remote_access_basis": "admin_default", "sessions_ended": 0}
    assert arx.client.get("/arx/api/v1/me").status_code == 200
    # without the default the same switch ends the session, as before
    arx.flag("u-owner")
    arx.setting("remote.admins_default", "false")
    r = admin.put("/api/v1/access/users/u-owner/remote-access", json={"enabled": False})
    assert r.json() == {"user_id": "u-owner", "remote_access": False, "remote_access_basis": None, "sessions_ended": 1}
    assert arx.client.get("/arx/api/v1/me").status_code == 401


def test_the_flag_endpoint_reports_the_flag_for_everyone_else(arx):
    admin = TestClient(arx.app)
    arx.bind("u-viewer", "viewer")
    r = admin.put("/api/v1/access/users/u-viewer/remote-access", json={"enabled": True})
    assert r.json() == {"user_id": "u-viewer", "remote_access": True, "remote_access_basis": "flag", "sessions_ended": 0}


# ---------------------------------------------------------------- the setting

def test_the_setting_is_validated_and_admin_only(arx):
    admin = TestClient(arx.app)
    assert admin.get("/api/v1/settings").json()["settings"]["remote.admins_default"] == "true"
    assert admin.patch("/api/v1/settings", json={"remote.admins_default": "false"}).status_code == 200
    assert admin.get("/api/v1/settings").json()["settings"]["remote.admins_default"] == "false"
    for bad in ("maybe", "", "TRUE", True):
        assert admin.patch("/api/v1/settings", json={"remote.admins_default": bad}).status_code == 422, bad
    arx.bind("dev-dana", "viewer")
    r = admin.patch("/api/v1/settings", json={"remote.admins_default": "true"}, headers={"X-SW-Dev-User": "dana"})
    assert r.status_code == 403
    assert admin.get("/api/v1/settings").json()["settings"]["remote.admins_default"] == "false"
    audited = [json.loads(r["details_json"]) for r in arx.audit("settings.update")]
    assert any(d.get("remote.admins_default") == "false" for d in audited)


def test_me_on_the_remote_channel_does_not_expose_the_setting_and_health_is_unaffected(arx):
    arx.bind("u-owner", "system_admin")
    assert arx.login(arx.owner).status_code == 200
    remote = arx.client.get("/arx/api/v1/me").json()["remote"]
    assert "remote.admins_default" not in remote and "remote.require_mfa_admin" not in remote and remote["remote.policy"] == "flag"
    health = arx.client.get("/arx/api/v1/health").json()["remote"]
    assert health["enabled"] is True and health["users"] == 1 and "basis" not in json.dumps(health)
