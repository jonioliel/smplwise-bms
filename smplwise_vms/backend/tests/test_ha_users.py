"""USR1 (docs/design/USR1_HA_USERS_FROM_ARX.md): home-system users created from Arx - negative cases first.

Every test runs against tests/fake_ha_users.py (patched in for `websockets.connect`, so the real transport code runs); the HA
URLs below use the reserved `.invalid` top-level domain, which never resolves - nothing here can reach a real Home Assistant.
"""
from __future__ import annotations

import dataclasses
import json
import logging

import pytest
import websockets
from fastapi.testclient import TestClient

from conftest import as_user, bind
from fake_ha_users import ADMIN_TOKEN, CANARY, NON_ADMIN_TOKEN, SUPERVISOR_TOKEN, FakeHaUsers
from smplwise.db import Database, new_id, now_iso
from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers import ha_users as route
from smplwise.routers.access import PERMISSION_LABELS, SYSTEM_PERMISSIONS
from smplwise.services import ha_client
from smplwise.services import ha_user_admin as hua

API = "/api/v1"
PASSWORD = "Rk7#vNq2-Lp9zW"  # strong, unique: searched for in every log, audit row and answer
FAKE_PROXY = "http://fake-ha.invalid/core"


@pytest.fixture()
def fake(monkeypatch) -> FakeHaUsers:
    ha = FakeHaUsers()
    monkeypatch.setattr(websockets, "connect", ha.connect)
    return ha


@pytest.fixture()
def ha_settings(settings):
    return dataclasses.replace(settings, ha_url=FAKE_PROXY, ha_token=SUPERVISOR_TOKEN)


@pytest.fixture(autouse=True)
def _never_a_real_ha(monkeypatch):
    """Belt and braces: whatever URL a session is opened for must be one of the fake's."""
    real = ha_client.ws_session

    async def guarded(settings, *a, url=None, **kw):
        target = url or ha_client._ws_url(settings)
        assert ".invalid" in target, f"a session to a non-fake address: {target}"
        return await real(settings, *a, url=url, **kw)

    monkeypatch.setattr(ha_client, "ws_session", guarded)


def _db(settings) -> Database:
    return Database(settings.db_path)


def _seed_dir(settings, user_id: str, *, admin: bool, username: str = "", active: bool = True) -> None:
    with _db(settings).connection() as conn:
        conn.execute(
            "INSERT INTO ha_users(id, name, username, is_active, is_admin, group_ids_json, synced_at) VALUES (?,?,?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET is_admin = excluded.is_admin, is_active = excluded.is_active",
            (user_id, user_id, username or user_id, 1 if active else 0, 1 if admin else 0, "[]", now_iso()),
        )


def _client(settings, *, ha_admin: bool = True) -> TestClient:
    c = TestClient(create_app(settings))
    assert c.get(f"{API}/me").status_code == 200  # bootstraps joni as the system administrator
    _seed_dir(settings, "dev-joni", admin=ha_admin)
    return c


def _create(c: TestClient, **over) -> tuple[int, dict]:
    body = {"display_name": "Dana Levi", "username": "dana", "password": PASSWORD, "role_id": "viewer", **over}
    r = c.post(f"{API}/ha-users", json=body)
    return r.status_code, r.json()


def _audit_text(settings) -> str:
    with _db(settings).connection() as conn:
        return json.dumps([dict(r) for r in conn.execute("SELECT * FROM audit_log").fetchall()], ensure_ascii=False)


def _audit(settings, action: str) -> list[dict]:
    with _db(settings).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def _managed_rows(settings) -> list[dict]:
    with _db(settings).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM ha_managed_users ORDER BY created_at").fetchall()]


def _insert_managed(settings, ha_user_id: str, username: str, state: str = "active") -> None:
    with _db(settings).connection() as conn:
        conn.execute(
            "INSERT INTO ha_managed_users(id, ha_user_id, username, display_name, role_id, state, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (new_id(), ha_user_id, username, username, "viewer", state, "dev-joni", now_iso(), now_iso()),
        )


# ---------------------------------------------------------------- the permission


def test_permission_is_a_system_permission_of_system_admin_only():
    assert "users.ha_manage" in SYSTEM_PERMISSIONS and PERMISSION_LABELS["users.ha_manage"]
    assert [r for r, perms in ROLES.items() if "users.ha_manage" in perms] == ["system_admin"]


def test_custom_role_cannot_carry_it(ha_settings, fake):
    c = _client(ha_settings)
    r = c.post(f"{API}/access/roles", json={"name": "מנהל משתמשים", "permissions": ["map.read", "users.ha_manage"]})
    assert r.status_code == 422 and r.json()["code"] == "system_permission_not_allowed"


@pytest.mark.parametrize("role", ["viewer", "operator", "editor", "site_admin", "kiosk"])
def test_every_route_refuses_other_roles(ha_settings, fake, role):
    c = _client(ha_settings)
    bind(c, ha_settings, "eve", role, "installation", "*")
    _seed_dir(ha_settings, "dev-eve", admin=True)  # even an HA administrator needs the Arx permission
    _insert_managed(ha_settings, "other-1", "other")
    h = as_user("eve")
    calls = [
        c.get(f"{API}/ha-users", headers=h),
        c.post(f"{API}/ha-users/check", headers=h),
        c.post(f"{API}/ha-users", headers=h, json={"display_name": "X", "username": "xxx", "password": PASSWORD, "role_id": "viewer"}),
        c.post(f"{API}/ha-users/other-1/deactivate", headers=h, json={"confirm": True}),
        c.post(f"{API}/ha-users/other-1/activate", headers=h, json={"confirm": True}),
        c.post(f"{API}/ha-users/other-1/delete", headers=h, json={"confirm_username": "other"}),
    ]
    assert [r.status_code for r in calls] == [403] * 6
    assert fake.calls == [], "a refused caller never reaches the home system"
    assert len([a for a in _audit(ha_settings, "users.ha_manage") if a["decision"] == "denied"]) == 6


def test_system_admin_who_is_not_an_ha_admin_reads_but_never_writes(ha_settings, fake):
    c = _client(ha_settings, ha_admin=False)
    body = c.get(f"{API}/ha-users").json()
    assert body["actor_ha_admin"] is False and body["can_manage"] is True
    status, err = _create(c)
    assert status == 403 and err["code"] == "ha_admin_required"
    _insert_managed(ha_settings, "other-1", "other")
    assert c.post(f"{API}/ha-users/other-1/deactivate", json={"confirm": True}).json()["code"] == "ha_admin_required"
    assert c.post(f"{API}/ha-users/other-1/delete", json={"confirm_username": "other"}).json()["code"] == "ha_admin_required"
    assert fake.calls == []
    assert {a["reason"] for a in _audit(ha_settings, "ha_users.create")} == {"ha_admin_required"}


def test_an_inactive_ha_admin_is_refused(ha_settings, fake):
    c = _client(ha_settings)
    _seed_dir(ha_settings, "dev-joni", admin=True, active=False)
    assert _create(c)[1]["code"] == "ha_admin_required"


# ---------------------------------------------------------------- admin creation is impossible


@pytest.mark.parametrize("extra", [{"is_admin": True}, {"group_ids": ["system-admin"]}, {"is_owner": True}])
def test_admin_fields_cannot_even_be_requested(ha_settings, fake, extra):
    c = _client(ha_settings)
    status, err = _create(c, **extra)
    assert status == 422 and err["code"] == "validation"
    assert fake.calls == []


def test_created_user_is_never_an_administrator(ha_settings, fake):
    c = _client(ha_settings)
    status, body = _create(c, role_id="system_admin")  # an Arx role, not an HA flag
    assert status == 201, body
    create_calls = [a for t, a in fake.calls if t == "config/auth/create"]
    assert create_calls == [{"name": "Dana Levi", "group_ids": ["system-users"], "local_only": False}]
    user = fake.users[body["user"]["ha_user_id"]]
    assert user["group_ids"] == ["system-users"] and not user["is_owner"]


def test_ha_making_the_user_an_admin_is_undone(ha_settings, fake):
    c = _client(ha_settings)
    fake.create_makes_admin = True
    before = set(fake.users)
    status, err = _create(c)
    assert status == 502 and err["code"] == "ha_failed"
    assert set(fake.users) == before, "the admin user HA made was deleted again"
    assert _managed_rows(ha_settings) == []


# ---------------------------------------------------------------- create


def test_create_happy_path(ha_settings, fake, caplog):
    caplog.set_level(logging.DEBUG)
    c = _client(ha_settings)
    r = c.post(f"{API}/ha-users", json={"display_name": "Dana Levi", "username": "dana", "password": PASSWORD, "role_id": "viewer"})
    assert r.status_code == 201, r.text
    u = r.json()["user"]
    assert u["state"] == "active" and u["role_id"] == "viewer" and u["scope_type"] == "installation" and u["person"] is True
    assert fake.types() == ["config/auth/create", "config/auth_provider/homeassistant/create", "person/create"]
    assert fake.password_of("dana") == PASSWORD, "the password reached the home system once"
    with _db(ha_settings).connection() as conn:
        bindings = conn.execute("SELECT role_id, scope_type, scope_id, effect FROM bindings WHERE subject_id = ? AND revoked_at IS NULL", (u["ha_user_id"],)).fetchall()
        assert [tuple(b) for b in bindings] == [("viewer", "installation", "*", "allow")], "the chosen role and nothing else"
        row = conn.execute("SELECT * FROM ha_managed_users").fetchone()
        assert PASSWORD not in json.dumps(dict(row))
    assert PASSWORD not in r.text
    assert PASSWORD not in _audit_text(ha_settings)
    assert all(PASSWORD not in rec.getMessage() for rec in caplog.records)
    created = _audit(ha_settings, "ha_users.create")[-1]
    assert created["decision"] == "allowed" and "dana" not in (created["details_json"] or ""), "audit carries ids only"
    listed = c.get(f"{API}/ha-users").json()
    assert [x["username"] for x in listed["users"]] == ["dana"] and listed["access"]["state"] == "ok"


def test_create_with_a_site_scope_and_no_person(ha_settings, fake):
    c = _client(ha_settings)
    site = c.post(f"{API}/sites", json={"name": "אתר", "address": "רחוב 1"}).json()["id"]
    status, body = _create(c, role_id="operator", scope_type="site", scope_id=site, create_person=False)
    assert status == 201 and body["user"]["scope_id"] == site and body["user"]["person"] is False
    assert "person/create" not in fake.types()


def test_unknown_role_or_scope_is_refused_before_ha(ha_settings, fake):
    c = _client(ha_settings)
    assert _create(c, role_id="nope")[1]["code"] == "role_unknown"
    assert _create(c, scope_type="site", scope_id="missing")[1]["code"] == "scope_unknown"
    assert _create(c, role_id="system_admin", scope_type="site", scope_id="x")[0] in (409, 422)
    assert fake.calls == []


def test_username_taken_locally_or_in_ha(ha_settings, fake):
    c = _client(ha_settings)
    _seed_dir(ha_settings, "someone", admin=False, username="dana")
    assert _create(c)[1]["code"] == "username_taken"
    assert fake.calls == []
    before = set(fake.users)
    status, err = _create(c, username="other")  # in HA only (not in the directory mirror)
    assert status == 409 and err["code"] == "username_taken"
    assert set(fake.users) == before, "the user created a moment earlier was deleted again"
    assert "config/auth/delete" in fake.types() and _managed_rows(ha_settings) == []


def test_compensation_failure_leaves_a_visible_repair_row(ha_settings, fake):
    c = _client(ha_settings)
    fake.fail["config/auth_provider/homeassistant/create"] = "username_exists"
    fake.fail["config/auth/delete"] = "home_assistant_error"
    status, err = _create(c)
    assert status == 409 and err["code"] == "username_taken"
    rows = _managed_rows(ha_settings)
    assert len(rows) == 1 and rows[0]["state"] == "needs_repair" and rows[0]["repair"] == "compensation_failed" and rows[0]["ha_user_id"] in fake.users
    listed = c.get(f"{API}/ha-users").json()["users"]
    assert listed[0]["state"] == "needs_repair"
    # repair = delete: the next delete removes the left-over user
    fake.fail.clear()
    ha_id = rows[0]["ha_user_id"]
    r = c.post(f"{API}/ha-users/{ha_id}/delete", json={"confirm_username": "dana"})
    assert r.status_code == 200, r.text
    assert ha_id not in fake.users and _managed_rows(ha_settings)[0]["state"] == "deleted"


def test_binding_failure_removes_the_ha_user_again(ha_settings, fake, monkeypatch):
    c = _client(ha_settings)
    monkeypatch.setattr(route, "_bind", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    before = set(fake.users)
    status, err = _create(c)
    assert status == 500 and err["code"] == "binding_failed"
    assert set(fake.users) == before and not fake.persons
    assert _managed_rows(ha_settings) == []
    with _db(ha_settings).connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM bindings WHERE assigned_by = 'dev-joni'").fetchone()[0] == 0


def test_binding_failure_with_a_failed_compensation_needs_repair(ha_settings, fake, monkeypatch):
    c = _client(ha_settings)
    monkeypatch.setattr(route, "_bind", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    fake.fail["config/auth/delete"] = "home_assistant_error"
    status, err = _create(c)
    assert status == 502 and err["code"] == "binding_failed"
    rows = _managed_rows(ha_settings)
    assert rows[0]["state"] == "needs_repair" and rows[0]["repair"] == "binding_failed"


def test_person_failure_keeps_the_user(ha_settings, fake):
    c = _client(ha_settings)
    fake.fail["person/create"] = "home_assistant_error"
    status, body = _create(c)
    assert status == 201 and body["user"]["repair"] == "person_missing" and body["user"]["person"] is False


def test_idempotent_replay(ha_settings, fake):
    c = _client(ha_settings)
    s1, b1 = _create(c, request_key="key-0001-abcd")
    s2, b2 = _create(c, request_key="key-0001-abcd")
    assert s1 == 201 and s2 == 201 and b2["replayed"] is True and b1["user"]["ha_user_id"] == b2["user"]["ha_user_id"]
    assert fake.types().count("config/auth/create") == 1


def test_limit(ha_settings, fake):
    c = _client(ha_settings)
    for i in range(route.MAX_MANAGED):
        _insert_managed(ha_settings, f"u{i}", f"user{i}")
    assert _create(c)[1]["code"] == "limit_reached"
    assert fake.calls == []


# ---------------------------------------------------------------- passwords


@pytest.mark.parametrize("password,rule", [
    ("short1!", "too_short"), ("a" * 129, "too_long"), ("aaaaaaaaaaaa", "repetitive"), ("ababababab", "repetitive"),
    ("password123", "common"), ("Password123!", "common"), ("1234567890", "common"), ("abcdefghijk", "sequence"),
    ("qwertyuiopas", "sequence"), ("my-dana-pass-77", "contains_username"), ("LeviFamily-2026", "contains_name"),
])
def test_password_rules(password, rule):
    assert hua.password_problem(password, "dana", "Dana Levi") == rule


def test_a_good_password_passes():
    assert hua.password_problem(PASSWORD, "dana", "Dana Levi") is None


def test_weak_password_answer_never_echoes_it(ha_settings, fake, caplog):
    caplog.set_level(logging.DEBUG)
    c = _client(ha_settings)
    weak = "password123"
    r = c.post(f"{API}/ha-users", json={"display_name": "Dana Levi", "username": "dana", "password": weak, "role_id": "viewer"})
    assert r.status_code == 422 and r.json()["code"] == "password_weak" and r.json()["details"] == {"rule": "common"}
    assert weak not in r.text and weak not in _audit_text(ha_settings)
    long_pw = "Z" * 300  # over the field limit: the validation envelope names the constraint, never the value
    r = c.post(f"{API}/ha-users", json={"display_name": "Dana Levi", "username": "dana", "password": long_pw, "role_id": "viewer"})
    assert r.status_code == 422 and long_pw not in r.text
    assert all(weak not in rec.getMessage() and long_pw not in rec.getMessage() for rec in caplog.records)
    assert fake.calls == []


# ---------------------------------------------------------------- authorisation of the token, availability


def test_not_authorised_token(ha_settings, fake):
    s = dataclasses.replace(ha_settings, ha_token=NON_ADMIN_TOKEN)
    c = _client(s)
    status, err = _create(c)
    assert status == 409 and err["code"] == "ha_not_authorised" and "חיבורים › סודות" in err["user_message"] and "התוסף" not in err["user_message"]
    assert CANARY not in json.dumps(err)
    assert c.get(f"{API}/ha-users").json()["access"]["state"] == "not_authorised"
    assert _managed_rows(s) == []
    assert c.post(f"{API}/ha-users/check").json()["access"]["state"] == "not_authorised"


def test_invalid_token_is_not_authorised(ha_settings, fake):
    c = _client(dataclasses.replace(ha_settings, ha_token="garbage"))
    assert c.post(f"{API}/ha-users/check").json()["access"]["state"] == "not_authorised"


def test_check_ok_reads_only(ha_settings, fake):
    c = _client(ha_settings)
    body = c.post(f"{API}/ha-users/check").json()
    assert body["access"]["state"] == "ok" and body["transport"] == "supervisor"
    assert fake.types() == ["config/auth/list"]


def test_unavailable(ha_settings, fake):
    c = _client(ha_settings)
    fake.unreachable = True
    status, err = _create(c)
    assert status == 503 and err["code"] == "ha_unavailable" and err["retryable"] is True
    assert _managed_rows(ha_settings) == []


def test_not_configured(settings, fake):
    c = _client(settings)  # no ha_url / ha_token: the developer backend
    assert c.get(f"{API}/ha-users").json()["transport"] == "none"
    status, err = _create(c)
    assert status == 409 and err["code"] == "ha_not_configured"
    assert fake.urls == []


def test_admin_token_goes_to_core_not_the_proxy(ha_settings, fake):
    s = dataclasses.replace(ha_settings, ha_users_token=ADMIN_TOKEN, ha_core_url="http://fake-core.invalid:8123")
    c = _client(s)
    assert c.get(f"{API}/ha-users").json()["transport"] == "token"
    assert c.post(f"{API}/ha-users/check").json()["access"]["state"] == "ok"
    assert fake.urls == ["ws://fake-core.invalid:8123/api/websocket"]


def test_uniform_errors_never_carry_ha_text(ha_settings, fake):
    c = _client(ha_settings)
    for kind, code in (("config/auth/create", "home_assistant_error"), ("config/auth/create", "weird_code")):
        fake.fail_once[kind] = code
        r = c.post(f"{API}/ha-users", json={"display_name": "Dana Levi", "username": "dana", "password": PASSWORD, "role_id": "viewer"})
        assert r.status_code in (409, 502) and CANARY not in r.text and set(r.json()) == {"code", "user_message", "retryable", "correlation_id", "details"}


# ---------------------------------------------------------------- deactivate / activate


def _created(c, ha_settings) -> str:
    status, body = _create(c)
    assert status == 201, body
    return body["user"]["ha_user_id"]


def test_deactivate_and_activate(ha_settings, fake):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    assert c.post(f"{API}/ha-users/{uid}/deactivate", json={"confirm": False}).json()["code"] == "confirm_required"
    r = c.post(f"{API}/ha-users/{uid}/deactivate", json={"confirm": True})
    assert r.status_code == 200 and r.json()["user"]["state"] == "inactive"
    assert fake.users[uid]["is_active"] is False
    update = [a for t, a in fake.calls if t == "config/auth/update"]
    assert update == [{"user_id": uid, "is_active": False}], "only is_active is ever sent"
    with _db(ha_settings).connection() as conn:
        assert conn.execute("SELECT active FROM users WHERE id = ?", (uid,)).fetchone()[0] == 0
    r = c.post(f"{API}/ha-users/{uid}/activate", json={"confirm": True})
    assert r.json()["user"]["state"] == "active" and fake.users[uid]["is_active"] is True


@pytest.mark.parametrize("target", ["owner-1", "other-1", "supervisor", "dev-joni"])
def test_deactivate_or_delete_an_unmanaged_user_is_refused(ha_settings, fake, target):
    c = _client(ha_settings)
    assert c.post(f"{API}/ha-users/{target}/deactivate", json={"confirm": True}).json()["code"] == "not_managed"
    assert c.post(f"{API}/ha-users/{target}/delete", json={"confirm_username": "owner"}).json()["code"] == "not_managed"
    assert fake.calls == []
    assert {"owner-1", "other-1", "supervisor"} <= set(fake.users)


def test_target_promoted_to_admin_in_the_directory_is_refused(ha_settings, fake):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    _seed_dir(ha_settings, uid, admin=True)
    assert c.post(f"{API}/ha-users/{uid}/deactivate", json={"confirm": True}).json()["code"] == "target_not_safe"
    assert c.post(f"{API}/ha-users/{uid}/delete", json={"confirm_username": "dana"}).json()["code"] == "target_not_safe"


def test_target_that_ha_reports_as_admin_or_owner_is_refused(ha_settings, fake):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    fake.users[uid]["group_ids"] = ["system-admin"]  # promoted in HA, the directory not pushed yet
    r = c.post(f"{API}/ha-users/{uid}/deactivate", json={"confirm": True})
    assert r.status_code == 409 and r.json()["code"] == "ha_refused" and fake.users[uid]["is_active"] is True
    # a managed row that somehow points at the owner: HA's own answer still stops it
    _insert_managed(ha_settings, "owner-1", "owner")
    r = c.post(f"{API}/ha-users/owner-1/delete", json={"confirm_username": "owner"})
    assert r.status_code == 409 and r.json()["code"] == "ha_refused" and "owner-1" in fake.users
    assert "config/auth/delete" not in fake.types()


def test_missing_in_ha_marks_the_row_for_repair(ha_settings, fake):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    del fake.users[uid]
    r = c.post(f"{API}/ha-users/{uid}/deactivate", json={"confirm": True})
    assert r.status_code == 404 and r.json()["code"] == "ha_user_not_found"
    assert _managed_rows(ha_settings)[0]["repair"] == "missing_in_ha"


# ---------------------------------------------------------------- delete


def test_delete_needs_the_exact_username(ha_settings, fake):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    n = len(fake.calls)
    for typed in ("Dana", "dana ", "other"):
        assert c.post(f"{API}/ha-users/{uid}/delete", json={"confirm_username": typed}).json()["code"] == "confirm_mismatch"
    assert len(fake.calls) == n and uid in fake.users


def test_delete_self_is_refused(ha_settings, fake):
    c = _client(ha_settings)
    _insert_managed(ha_settings, "dev-joni", "joni")
    r = c.post(f"{API}/ha-users/dev-joni/delete", json={"confirm_username": "joni"})
    assert r.status_code == 409 and r.json()["code"] == "self_target"
    assert c.post(f"{API}/ha-users/dev-joni/deactivate", json={"confirm": True}).json()["code"] == "self_target"
    assert fake.calls == []


def test_last_admin_probe_writes_nothing(ha_settings, fake):
    _client(ha_settings)
    with _db(ha_settings).connection() as conn:
        assert route.would_strand_admins(conn, "dev-joni") is True
        assert route.would_strand_admins(conn, "someone-else") is False
        assert conn.execute("SELECT active FROM users WHERE id = 'dev-joni'").fetchone()[0] == 1


def test_last_admin_refused_before_ha(ha_settings, fake, monkeypatch):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    monkeypatch.setattr(route, "would_strand_admins", lambda conn, user_id: user_id == uid)
    n = len(fake.calls)
    assert c.post(f"{API}/ha-users/{uid}/delete", json={"confirm_username": "dana"}).json()["code"] == "last_admin"
    assert c.post(f"{API}/ha-users/{uid}/deactivate", json={"confirm": True}).json()["code"] == "last_admin"
    assert len(fake.calls) == n and uid in fake.users


def test_delete_happy_path_and_idempotency(ha_settings, fake):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    assert fake.persons
    r = c.post(f"{API}/ha-users/{uid}/delete", json={"confirm_username": "dana"})
    assert r.status_code == 200 and r.json() == {"deleted": uid, "already_gone": False}
    assert uid not in fake.users and not fake.persons and "dana" not in fake.credentials
    with _db(ha_settings).connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM bindings WHERE subject_id = ? AND revoked_at IS NULL", (uid,)).fetchone()[0] == 0
        assert conn.execute("SELECT active FROM users WHERE id = ?", (uid,)).fetchone()[0] == 0
    assert c.get(f"{API}/ha-users").json()["users"] == []
    assert c.post(f"{API}/ha-users/{uid}/delete", json={"confirm_username": "dana"}).json()["code"] == "not_managed"
    assert [a["decision"] for a in _audit(ha_settings, "ha_users.delete")] == ["allowed", "denied"]
    # the username is free again
    assert _create(c)[0] == 201


def test_delete_when_ha_already_removed_it(ha_settings, fake):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    del fake.users[uid]
    r = c.post(f"{API}/ha-users/{uid}/delete", json={"confirm_username": "dana"})
    assert r.status_code == 200 and r.json()["already_gone"] is True
    assert _managed_rows(ha_settings)[0]["state"] == "deleted"


def test_delete_unavailable_changes_nothing_in_arx(ha_settings, fake):
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    fake.unreachable = True
    r = c.post(f"{API}/ha-users/{uid}/delete", json={"confirm_username": "dana"})
    assert r.status_code == 503 and r.json()["retryable"] is True
    assert _managed_rows(ha_settings)[0]["state"] == "active"
    with _db(ha_settings).connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM bindings WHERE subject_id = ? AND revoked_at IS NULL", (uid,)).fetchone()[0] == 1


def test_no_password_anywhere_after_a_full_cycle(ha_settings, fake, caplog):
    caplog.set_level(logging.DEBUG)
    c = _client(ha_settings)
    uid = _created(c, ha_settings)
    c.post(f"{API}/ha-users/{uid}/deactivate", json={"confirm": True})
    c.post(f"{API}/ha-users/{uid}/activate", json={"confirm": True})
    listed = c.get(f"{API}/ha-users").text
    c.post(f"{API}/ha-users/{uid}/delete", json={"confirm_username": "dana"})
    assert PASSWORD not in listed and PASSWORD not in _audit_text(ha_settings)
    assert all(PASSWORD not in rec.getMessage() for rec in caplog.records)
    with _db(ha_settings).connection() as conn:
        dump = "\n".join(str(tuple(r)) for t in ("ha_managed_users", "ha_users", "users", "settings") for r in conn.execute(f"SELECT * FROM {t}").fetchall())
    assert PASSWORD not in dump
    assert ADMIN_TOKEN not in _audit_text(ha_settings) and SUPERVISOR_TOKEN not in _audit_text(ha_settings)


# ---------------------------------------------------------------- USR1-263: the token lives in the secrets store, not an add-on option

CORE = "http://fake-core.invalid:8123"


def test_263_the_check_reads_the_token_from_the_secrets_store(ha_settings, fake, monkeypatch, caplog):
    """Saved in Settings > Connections > Secrets: the check uses it on HA core; the value is in no answer, audit row or log line."""
    caplog.set_level(logging.DEBUG)
    monkeypatch.delenv("HA_USERS_TOKEN", raising=False)
    s = dataclasses.replace(ha_settings, ha_core_url=CORE)
    c = _client(s)
    assert c.get(f"{API}/ha-users").json()["transport"] == "supervisor"  # nothing stored yet: the add-on's own identity
    r = c.put(f"{API}/system/secrets/ha_users_token", json={"value": ADMIN_TOKEN})
    assert r.status_code == 200 and r.json()["secret"]["configured"] is True and ADMIN_TOKEN not in r.text
    body = c.post(f"{API}/ha-users/check").json()
    assert body["transport"] == "token" and body["access"]["state"] == "ok"
    assert fake.urls[-1] == "ws://fake-core.invalid:8123/api/websocket" and fake.types() == ["config/auth/list"]
    listing = c.get(f"{API}/system/secrets")
    item = next(x for x in listing.json()["secrets"] if x["name"] == "ha_users_token")
    assert item["state"] == "set" and item["testable"] is False and ADMIN_TOKEN not in listing.text
    assert ADMIN_TOKEN not in _audit_text(s) and all(ADMIN_TOKEN not in rec.getMessage() for rec in caplog.records)


def test_263_a_row_written_behind_the_apps_back_is_read_per_request(ha_settings, fake, monkeypatch):
    """The routes read the store itself on every request (not a start-up copy of the settings)."""
    from smplwise.services import secrets_store

    monkeypatch.delenv("HA_USERS_TOKEN", raising=False)
    s = dataclasses.replace(ha_settings, ha_core_url=CORE)
    c = _client(s)
    assert c.app.state.settings.ha_users_token is None
    with _db(s).connection() as conn:
        secrets_store.set_secret(conn, s.data_dir, "ha_users_token", ADMIN_TOKEN, "dev-joni")
    assert c.get(f"{API}/ha-users").json()["transport"] == "token"
    with _db(s).connection() as conn:
        secrets_store.clear_secret(conn, "ha_users_token", "dev-joni")
    assert c.get(f"{API}/ha-users").json()["transport"] == "supervisor"


def test_263_a_cleared_entry_overrides_the_developer_environment(ha_settings, fake):
    """A cleared store row decides (fail closed): the developer fallback is not used again."""
    s = dataclasses.replace(ha_settings, ha_users_token=ADMIN_TOKEN, ha_core_url=CORE)  # as if HA_USERS_TOKEN were set
    c = _client(s)
    assert c.get(f"{API}/ha-users").json()["transport"] == "token"
    assert c.delete(f"{API}/system/secrets/ha_users_token").status_code == 200
    assert c.get(f"{API}/ha-users").json()["transport"] == "supervisor"


def test_263_an_unreadable_entry_is_treated_as_not_set(ha_settings, fake, monkeypatch):
    from smplwise.services import secrets_store
    from smplwise.services.connection_store import SecretError

    s = dataclasses.replace(ha_settings, ha_users_token=ADMIN_TOKEN, ha_core_url=CORE)
    c = _client(s)
    with _db(s).connection() as conn:
        secrets_store.set_secret(conn, s.data_dir, "ha_users_token", ADMIN_TOKEN, "dev-joni")

    def unreadable(*_a, **_k):
        raise SecretError("key changed")

    monkeypatch.setattr(secrets_store, "open_app_secret", unreadable)
    assert c.get(f"{API}/ha-users").json()["transport"] == "supervisor"  # never the stale fallback


def test_263_the_add_on_option_is_gone(tmp_path, monkeypatch):
    """ha_users_token is not an add-on option: config.yaml does not declare it and an options file carrying it is ignored."""
    from pathlib import Path

    from smplwise.config import LEGACY_SECRET_OPTIONS, load_settings

    addon = Path(__file__).resolve().parents[2]
    assert "ha_users_token" not in (addon / "config.yaml").read_text(encoding="utf-8")
    assert "ha_users_token" not in LEGACY_SECRET_OPTIONS  # never shipped as an option: nothing to import
    monkeypatch.delenv("HA_USERS_TOKEN", raising=False)
    monkeypatch.setenv("SW_DATA_DIR", str(tmp_path / "data"))
    path = tmp_path / "options.json"
    path.write_text(json.dumps({"ha_users_token": "an-options-file-value"}), encoding="utf-8")
    loaded = load_settings(path)
    assert loaded.ha_users_token is None and "an-options-file-value" not in json.dumps(loaded.legacy_secret_options)
