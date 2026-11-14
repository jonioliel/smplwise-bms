"""USR2 phase 1: Arx-only (local) identities through the app - negative cases first.

The switch off: every new route refuses and the HA-based remote sign-in is unchanged. Then: the permission matrix, system_admin never
assignable, one binding / no deny / no group, enumeration uniformity (status, body, the hash that ran), the delay / address / global
tiers, login CSRF, cookie flags, session persistence / rotation / revocation, the second-factor rule for administrative permissions
(owner answer Q3), administrative-target links on the local channel only, Ingress never naming a local id, the directory-sync
exemption (R11), passwords / tokens / typed names never in logs, audit rows or answers, and the project backup (owner answer Q8).
Fakes only: no Home Assistant, no device."""
from __future__ import annotations

import base64
import dataclasses
import json
import logging
import re
import sqlite3
import time

import pytest
from fastapi.testclient import TestClient

from test_remote_access import ORIGIN, Arx
from smplwise.db import Database, new_id, now_iso, permission_revision, set_setting
from smplwise.main import create_app
from smplwise.services import ha_bridge
from smplwise.services import ha_user_auth as hua
from smplwise.services import local_identity as li
from smplwise.services import local_passwords as lp
from smplwise.services import second_factor as sf

GOOD = "tree river lamp 47"
GOOD2 = "blue kettle on the hill"


class Lx(Arx):
    """A remote-enabled app (Arx), the developer identity `joni` as the system administrator on the local channel."""

    def __init__(self, settings, tmp_path, monkeypatch, **over):
        super().__init__(settings, tmp_path, monkeypatch, **over)
        lp._profile_override = lp.Profile(7, 10, 8, 1)  # cheap hashing in tests
        self.admin = TestClient(self.app)  # local channel, developer identity joni (bootstrap -> system_admin)
        assert self.admin.get("/api/v1/me").json()["user"]["id"] == "dev-joni"
        self.sleeps: list[float] = []

        async def fake_sleep(s):
            self.sleeps.append(s)

        from smplwise.routers import local_identity as router

        monkeypatch.setattr(router.asyncio, "sleep", fake_sleep)

    def enable(self, on: bool = True):
        r = self.admin.patch("/api/v1/settings", json={"security.local_identity": "on" if on else "off"})
        assert r.status_code == 200, r.text
        return r

    def create(self, username: str, role: str = "viewer", scope=("installation", "*"), **extra):
        r = self.admin.post("/api/v1/identity/local-users", json={"username": username, "display_name": username.title(), "role_id": role,
                                                                   "scope_type": scope[0], "scope_id": scope[1], **extra})
        assert r.status_code == 201, r.text
        return r.json()

    @staticmethod
    def link_token(created: dict) -> str:
        return created["link"]["path"].split("t=", 1)[1]

    def remote(self, **headers) -> TestClient:
        return TestClient(self.app, headers={**ORIGIN, **headers})

    def set_password(self, token: str, password: str = GOOD, client: TestClient | None = None):
        return (client or self.remote()).post("/arx/api/v1/auth/local/set-password", json={"token": token, "password": password})

    def sign_in(self, client: TestClient, username: str, password: str = GOOD, **headers):
        return client.post("/arx/api/v1/auth/local/sign-in", json={"username": username, "password": password}, headers=headers)

    def ready(self, username: str, role: str = "viewer", **kw) -> tuple[dict, TestClient]:
        created = self.create(username, role, **kw)
        assert self.set_password(self.link_token(created)).status_code == 200
        c = self.remote()
        r = self.sign_in(c, username)
        assert r.status_code == 200, r.text
        return created, c

    def rows(self, sql: str, args=()) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute(sql, args).fetchall()]


@pytest.fixture()
def lx(settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    yield a
    hua.reset_for_tests()


def _body(r) -> dict:
    d = r.json()
    d.pop("correlation_id", None)
    return d


def _cookie(r) -> str:
    return "\n".join(v for k, v in r.headers.multi_items() if k.lower() == "set-cookie")


# ---------------------------------------------------------------- 1. the switch off (default)

def test_off_by_default_every_new_route_refuses(lx):
    assert lx.rows("SELECT value FROM settings WHERE key = 'security.local_identity'") == []
    r = lx.admin.post("/api/v1/identity/local-users", json={"username": "maria", "display_name": "Maria", "role_id": "viewer"})
    assert r.status_code == 409 and r.json()["code"] == "local_identity_off"
    c = lx.remote()
    assert lx.sign_in(c, "maria").status_code == 403 and lx.sign_in(c, "maria").json()["code"] == "local_identity_off"
    assert lx.set_password("x" * 43).json()["code"] == "local_identity_off"
    assert c.post("/arx/api/v1/auth/local/sign-in/second-factor", json={"code": "123456"}).json()["code"] == "local_identity_off"


def test_off_leaves_the_ha_sign_in_byte_for_byte_unchanged(lx):
    """remote-config, the HA token exchange, the sessions list and the answer to an unknown cookie are exactly what they were - also
    for a cookie in the local form, and also after the feature was on and switched off again."""
    lx.flag("u-viewer")
    lx.bind("u-viewer", "viewer")
    cfg = lx.client.get("/arx/api/v1/auth/remote-config").json()
    assert set(cfg) == {"path", "session", "idle_lock_minutes"}
    r = lx.login(lx.viewer)
    assert r.status_code == 200 and set(r.json()) == {"user", "session_expires_at", "session_expires_in"}
    assert r.headers["set-cookie"].startswith("arx_session=") and "l." not in r.headers["set-cookie"].split(";")[0]
    sessions = lx.client.get("/arx/api/v1/auth/sessions").json()["sessions"]
    assert sessions and all(set(s) == {"id", "user_id", "username", "display_name", "created_at", "last_seen_at", "address", "country", "agent",
                                       "channel", "current", "live_streams"} for s in sessions)
    baseline = _body(lx.remote(Cookie="arx_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").get("/arx/api/v1/me"))
    local_form = lx.remote(Cookie="arx_session=l.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    assert _body(local_form.get("/arx/api/v1/me")) == baseline == {"code": "remote_login_required", "user_message": hua.LOGIN_REQUIRED_HE,
                                                                     "retryable": False, "details": {}}
    # on, a local session, then off: that cookie answers exactly like any unknown cookie and the session rows end
    lx.enable(True)
    _created, c = lx.ready("maria")
    assert c.get("/arx/api/v1/me").json()["user"]["source"] == "local"
    lx.enable(False)
    r = c.get("/arx/api/v1/me")
    assert r.status_code == 401 and _body(r) == baseline
    assert {row["revoked_reason"] for row in lx.rows("SELECT revoked_reason FROM auth_local_sessions")} == {"feature_off"}
    assert set(lx.client.get("/arx/api/v1/auth/remote-config").json()) == {"path", "session", "idle_lock_minutes"}


def test_only_a_system_administrator_switches_it(lx):
    lx.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "sami"})
    with lx.db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'dev-sami', 'site_admin', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), permission_revision(conn), now_iso()))
    r = lx.admin.patch("/api/v1/settings", json={"security.local_identity": "on"}, headers={"X-SW-Dev-User": "sami"})
    assert r.status_code == 403
    r = lx.enable(True)
    assert r.json()["settings"]["security.local_identity"] == "on"
    assert lx.audit("identity.local.feature_enabled")


def test_public_routes_are_remote_only(lx):
    lx.enable()
    for path in ("/api/v1/auth/local/sign-in", "/api/v1/auth/local/set-password", "/api/v1/auth/local/sign-in/second-factor"):
        r = lx.admin.post(path, json={"username": "a", "password": "b", "token": "c", "code": "1"}, headers=ORIGIN)
        assert r.status_code == 404, path  # SECFIX2-295 / PUB-07: the guard runs before the body model, so never a 422 here
    r = lx.admin.post("/api/v1/auth/local/sign-in", json={"username": "a", "password": "b"}, headers=ORIGIN)
    assert r.status_code == 404


# ---------------------------------------------------------------- 2. permission matrix and the role rules

def test_permission_matrix(lx):
    lx.enable()
    lx.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "dana"})
    lx.admin.get("/api/v1/me", headers={"X-SW-Dev-User": "sami"})
    with lx.db.connection() as conn:
        for uid, role in (("dev-dana", "viewer"), ("dev-sami", "site_admin")):
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                         "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), uid, role, permission_revision(conn), now_iso()))
    body = {"username": "maria", "display_name": "Maria", "role_id": "viewer"}
    for who in ("dana", "sami"):
        h = {"X-SW-Dev-User": who}
        assert lx.admin.post("/api/v1/identity/local-users", json=body, headers=h).status_code == 403
        assert lx.admin.get("/api/v1/identity/local-users", headers=h).status_code == 403
        assert lx.admin.get("/api/v1/identity/local-users/export", headers=h).status_code == 403
    created = lx.create("maria")
    uid = created["user"]["id"]
    for who in ("dana", "sami"):
        h = {"X-SW-Dev-User": who}
        assert lx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "first_login"}, headers=h).status_code == 403
        assert lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": False}, headers=h).status_code == 403
        assert lx.admin.delete(f"/api/v1/identity/local-users/{uid}", headers=h).status_code == 403
        assert lx.admin.post(f"/api/v1/identity/local-users/{uid}/unlock", headers=h).status_code == 403
    assert lx.admin.get("/api/v1/identity/local-users").status_code == 200
    # a custom role can never carry identity.local.manage (a system permission)
    r = lx.admin.post("/api/v1/access/roles", json={"name": "x", "permissions": ["map.read", "identity.local.manage"], "sensitive": []})
    assert r.status_code == 422


def test_system_admin_is_never_assignable_and_one_binding_only(lx):
    lx.enable()
    r = lx.admin.post("/api/v1/identity/local-users", json={"username": "boss", "display_name": "Boss", "role_id": "system_admin"})
    assert r.status_code == 422 and r.json()["code"] == "role_not_allowed_for_local_user"
    assert lx.rows("SELECT id FROM users WHERE source = 'local'") == []  # nothing half-created
    created = lx.create("maria")
    uid = created["user"]["id"]
    base = {"subject_kind": "user", "subject_id": uid, "scope_type": "installation", "scope_id": "*"}
    r = lx.admin.post("/api/v1/access/bindings", json={**base, "role_id": "system_admin"})
    assert r.status_code == 422 and r.json()["code"] == "role_not_allowed_for_local_user"
    r = lx.admin.post("/api/v1/access/bindings", json={**base, "role_id": "operator"})
    assert r.status_code == 409 and r.json()["code"] == "local_user_one_binding"
    r = lx.admin.post("/api/v1/access/bindings", json={**base, "role_id": "editor", "effect": "deny"})
    assert r.status_code == 422 and r.json()["code"] == "local_user_no_deny"
    # no groups
    g = lx.admin.post("/api/v1/access/groups", json={"name": "staff"}).json()
    r = lx.admin.put(f"/api/v1/access/groups/{g['id']}/members", json={"user_ids": [uid], "revision": g["revision"]})
    assert r.status_code == 422 and r.json()["code"] == "local_user_no_groups"
    # a row written behind the routes' back still grants nothing (defence in depth)
    with lx.db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', ?, 'system_admin', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), uid, permission_revision(conn), now_iso()))
        from smplwise.rbac import INSTALLATION, Principal, authorize, is_system_admin

        assert is_system_admin(conn, uid) is False
        p = Principal(user_id=uid, username="maria", display_name="Maria", source="local", factor_ok=True)
        assert authorize(conn, p, "system.configure", INSTALLATION).allowed is False
    # the role is replaced through the one route (revoke + create in one transaction)
    r = lx.admin.put(f"/api/v1/identity/local-users/{uid}/role", json={"role_id": "operator"})
    assert r.status_code == 200 and r.json()["role_id"] == "operator"
    active = lx.rows("SELECT role_id FROM bindings WHERE subject_id = ? AND revoked_at IS NULL AND role_id <> 'system_admin'", (uid,))
    assert active == [{"role_id": "operator"}]


def test_username_rules_and_uniqueness_across_sources(lx):
    lx.enable()
    for bad in ("ab", "Ünïcode", "-lead", "has space", "x" * 33):
        r = lx.admin.post("/api/v1/identity/local-users", json={"username": bad, "display_name": "X", "role_id": "viewer"})
        assert r.status_code == 422, bad
    # an HA username (the directory) and an existing user row are both taken
    r = lx.admin.post("/api/v1/identity/local-users", json={"username": "dana", "display_name": "X", "role_id": "viewer"})
    assert r.status_code == 409 and r.json()["code"] == "username_taken"
    r = lx.admin.post("/api/v1/identity/local-users", json={"username": "JONI", "display_name": "X", "role_id": "viewer"})
    assert r.status_code == 409
    lx.create("maria")
    r = lx.admin.post("/api/v1/identity/local-users", json={"username": "Maria", "display_name": "X", "role_id": "viewer"})
    assert r.status_code == 409


# ---------------------------------------------------------------- 3. links and the first sign-in

def test_first_login_link_policy_single_use_and_cookie_flags(lx):
    lx.enable()
    created = lx.create("maria")
    assert created["user"]["status"] == "pending_first_login"
    link = created["link"]
    assert link["path"].startswith("/arx/#/welcome?t=") and "url" not in link  # the token rides in the fragment
    token = lx.link_token(created)
    r = lx.set_password(token, "maria12345678")
    assert r.status_code == 400 and r.json()["details"]["reason"] == "contextual" and "maria12345678" not in r.text
    r = lx.set_password(token, "Password2024!")
    assert r.json()["details"]["reason"] == "common"
    r = lx.set_password(token, GOOD)
    assert r.status_code == 200 and r.json() == {"must_enrol": False}
    again = lx.set_password(token, GOOD2)
    unknown = lx.set_password("Z" * 43, GOOD2)
    assert again.status_code == unknown.status_code == 401 and _body(again) == _body(unknown)
    c = lx.remote()
    r = lx.sign_in(c, "maria")
    assert r.status_code == 200, r.text
    assert r.json()["second_factor"] == "none" and r.json()["user"]["source"] == "local"
    cookie = _cookie(r)
    assert re.search(r"(^|\n)arx_session=l\.[A-Za-z0-9_-]{43}; HttpOnly; Max-Age=\d+; Path=/arx/; SameSite=strict", cookie), cookie
    me = c.get("/arx/api/v1/me").json()
    assert me["user"]["source"] == "local" and me["user"]["id"].startswith("l_") and me["channel"] == "remote"
    assert me["local_identity"]["admin_permissions"] is False and me["bindings"][0]["role_id"] == "viewer"
    # behind the tunnel (https): the __Secure- cookie with Secure
    c2 = lx.remote(**{"X-Forwarded-Proto": "https", "Origin": "https://testserver"})
    r = lx.sign_in(c2, "maria")
    assert "__Secure-arx_session=l." in _cookie(r) and "; Secure" in _cookie(r)


def test_link_rules_newer_invalidates_and_disable_invalidates(lx):
    lx.enable()
    created = lx.create("maria")
    uid = created["user"]["id"]
    first = lx.link_token(created)
    second = lx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "first_login"}).json()["link"]["path"].split("t=")[1]
    assert lx.set_password(first).status_code == 401
    lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": False})
    assert lx.set_password(second).status_code == 401
    lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": True})
    third = lx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "first_login"}).json()["link"]["path"].split("t=")[1]
    with lx.db.connection() as conn:  # expiry
        conn.execute("UPDATE auth_local_links SET expires_at = '2000-01-01T00:00:00Z' WHERE used_at IS NULL AND invalidated_at IS NULL")
    assert lx.set_password(third).status_code == 401
    assert {r["reason"] for r in lx.audit("auth.local.link.refused")} >= {"invalidated", "expired"}


# ---------------------------------------------------------------- 4. enumeration, timing, tiers

def test_every_refusal_is_the_same_answer_and_runs_a_hash(lx, monkeypatch):
    lx.enable()
    lx.ready("maria")
    pending = lx.create("pendo")  # no password yet
    disabled, _c = lx.ready("dora")
    lx.admin.patch(f"/api/v1/identity/local-users/{disabled['user']['id']}", json={"active": False})
    runs: list[str] = []
    real = lp._scrypt
    monkeypatch.setattr(lp, "_scrypt", lambda secret, salt, prof: (runs.append("h"), real(secret, salt, prof))[1])
    answers = []
    for user, pw in (("nobody", GOOD), ("maria", "wrong password here"), ("pendo", GOOD), ("dora", GOOD), ("maria", "x" * 200)):
        before = len(runs)
        r = lx.sign_in(lx.remote(), user, pw)
        assert len(runs) == before + 1, user  # exactly one hash computation, known or not
        answers.append((r.status_code, _body(r)))
    assert len({json.dumps(a, sort_keys=True) for a in answers}) == 1
    assert answers[0] == (401, {"code": "sign_in_failed", "user_message": li.SIGN_IN_FAILED_HE, "retryable": False, "details": {}})
    _ = pending


def test_login_csrf_needs_same_origin(lx):
    lx.enable()
    lx.ready("maria")
    bare = TestClient(lx.app)
    r = bare.post("/arx/api/v1/auth/local/sign-in", json={"username": "maria", "password": GOOD})
    assert r.status_code == 403 and r.json()["code"] == "csrf_refused" and "set-cookie" not in r.headers
    r = bare.post("/arx/api/v1/auth/local/sign-in", json={"username": "maria", "password": GOOD}, headers={"Sec-Fetch-Site": "cross-site"})
    assert r.status_code == 403
    r = bare.post("/arx/api/v1/auth/local/sign-in", json={"username": "maria", "password": GOOD}, headers={"Origin": "https://evil.example"})
    assert r.status_code == 403
    r = bare.post("/arx/api/v1/auth/local/sign-in", json={"username": "maria", "password": GOOD}, headers={"Sec-Fetch-Site": "same-origin"})
    assert r.status_code == 200
    # the existing CSRF rule still guards state-changing requests that carry the (local) session cookie
    c = TestClient(lx.app)
    c.cookies.set("arx_session", r.cookies.get("arx_session"), path="/arx/")
    r = c.put("/arx/api/v1/auth/local/password", json={"current_password": GOOD, "new_password": GOOD2})
    assert r.status_code == 403 and r.json()["code"] == "csrf_refused"


def _net(n: int) -> dict[str, str]:
    return {"CF-Connecting-IP": f"203.0.113.{n}"}


def test_account_delay_is_per_network_never_a_lock_of_the_person(lx):
    """USR2-FIX F2 (security review 2026-10-16): a guesser's failures delay the name from the guesser's network only - the person's
    correct password from their own network still signs in. Before the fix the account's delay_until refused it from everywhere."""
    lx.enable()
    created, _c = lx.ready("maria")
    uid = created["user"]["id"]
    attacker = lx.remote(**_net(7))
    for _ in range(5):
        assert lx.sign_in(attacker, "maria", "not the password").status_code == 401
    row = lx.rows("SELECT failed_count, delay_until FROM auth_local_credentials WHERE user_id = ?", (uid,))[0]
    assert row["failed_count"] == 5 and row["delay_until"] is None  # counted towards the ceiling, but no lock
    lx.sleeps.clear()
    r = lx.sign_in(attacker, "maria")  # the right password from the delayed network: the same refusal, after a bounded wait
    assert r.status_code == 401 and r.json()["code"] == "sign_in_failed"
    assert lx.sleeps and 2.0 <= lx.sleeps[-1] <= li.DELAY_SLEEP_CAP_S
    # the exact attack of F2: the victim from their own network is NOT refused
    lx.sleeps.clear()
    assert lx.sign_in(lx.remote(**_net(8)), "maria").status_code == 200
    assert not lx.sleeps
    users = lx.admin.get("/api/v1/identity/local-users").json()["users"]
    assert [u["status"] for u in users if u["id"] == uid] == ["active"]
    # an unknown name follows the same per-network schedule (no "this account exists" signal from the delay)
    for _ in range(5):
        lx.sign_in(attacker, "ghost", "not the password")
    lx.sleeps.clear()
    r = lx.sign_in(attacker, "ghost", "not the password")
    assert r.status_code == 401 and lx.sleeps and lx.sleeps[-1] >= 2.0
    lx.sleeps.clear()
    assert lx.sign_in(lx.remote(**_net(9)), "ghost", "not the password").status_code == 401 and not lx.sleeps


def test_account_ceiling_locks_audits_and_an_administrator_unlocks(lx, monkeypatch):
    """USR2-FIX F2: only the high per-account ceiling (all networks together, one fixed window) locks - audited
    `auth.local.account_locked` - and the administrator's unlock (or time) ends it, together with every network's delay."""
    lx.enable()
    monkeypatch.setattr(li, "ACCOUNT_CEILING", 8)
    monkeypatch.setattr(li, "ACCOUNT_CEILING_WINDOW_S", 10 ** 9)  # one window for the whole test (no clock-boundary flake)
    created, _c = lx.ready("maria")
    uid = created["user"]["id"]
    for _ in range(4):  # the attacker's own network gets delayed after its 5th failure; four from it, then other networks
        assert lx.sign_in(lx.remote(**_net(30)), "maria", "not the password").status_code == 401
    for i in range(4):
        assert lx.sign_in(lx.remote(**_net(40 + i)), "maria", "not the password").status_code == 401
    row = lx.rows("SELECT failed_count, delay_until FROM auth_local_credentials WHERE user_id = ?", (uid,))[0]
    assert row["failed_count"] == 8 and row["delay_until"] and li.ACCOUNT_LOCK_S - 5 < row["delay_until"] - time.time() <= li.ACCOUNT_LOCK_S + 1
    locked = lx.audit("auth.local.account_locked")
    assert len(locked) == 1 and locked[0]["reason"] == "ceiling"
    users = lx.admin.get("/api/v1/identity/local-users").json()["users"]
    assert [u["status"] for u in users if u["id"] == uid] == ["delayed"]
    lx.sleeps.clear()
    r = lx.sign_in(lx.remote(**_net(60)), "maria")  # now locked from everywhere, with the same uniform answer
    assert r.status_code == 401 and r.json()["code"] == "sign_in_failed" and lx.sleeps and lx.sleeps[-1] <= li.DELAY_SLEEP_CAP_S
    # a name that does not exist reaches the same ceiling in memory (the lock is not an existence signal)
    for i in range(8):
        lx.sign_in(lx.remote(**_net(70 + i)), "ghost", "not the password")
    lx.sleeps.clear()
    assert lx.sign_in(lx.remote(**_net(61)), "ghost", "not the password").status_code == 401 and lx.sleeps
    # the administrator's unlock path
    assert lx.admin.post(f"/api/v1/identity/local-users/{uid}/unlock").status_code == 200
    assert lx.audit("identity.local.user.unlocked")
    assert lx.sign_in(lx.remote(**_net(60)), "maria").status_code == 200
    row = lx.rows("SELECT failed_count, delay_until FROM auth_local_credentials WHERE user_id = ?", (uid,))[0]
    assert row == {"failed_count": 0, "delay_until": None}


def test_address_tier_answers_429_with_retry_after_and_throttles_its_audit(lx, monkeypatch):
    lx.enable()
    monkeypatch.setattr(li, "IP_WINDOWS", ((60, 3), (3600, 100), (86400, 300)))
    c = lx.remote(**{"CF-Connecting-IP": "203.0.113.9"})
    for _ in range(3):
        assert lx.sign_in(c, "nobody").status_code == 401
    for _ in range(3):
        r = lx.sign_in(c, "nobody")
        assert r.status_code == 429 and r.json()["code"] == "rate_limited" and int(r.headers["retry-after"]) >= 1
    assert len(lx.audit("auth.local.sign_in.rate_limited")) == 1
    # another address is not affected
    assert lx.sign_in(lx.remote(**{"CF-Connecting-IP": "198.51.100.4"}), "nobody").status_code == 401


def test_global_storm_waits_and_refuses_accounts_without_a_recent_success(lx, monkeypatch):
    lx.enable()
    lx.ready("maria")  # signed in just now: keeps working through a storm
    stale = lx.create("stale")
    assert lx.set_password(lx.link_token(stale)).status_code == 200
    monkeypatch.setattr(li, "GLOBAL_STORM_AT", 3)
    monkeypatch.setattr(li, "GLOBAL_STORM_NETWORKS", 3)  # USR2 phase 2 (F7): the storm counts distinct networks too
    for i in range(3):
        lx.sign_in(lx.remote(**{"CF-Connecting-IP": f"203.0.113.{i + 20}"}), "nobody")
    lx.sleeps.clear()
    assert lx.sign_in(lx.remote(), "stale").status_code == 401  # right password, no success in 30 days
    assert lx.sleeps and lx.sleeps[-1] >= li.GLOBAL_WAIT_S
    assert lx.sign_in(lx.remote(), "maria").status_code == 200
    assert lx.audit("auth.local.storm")


def test_tiers_are_written_behind_and_restored(lx):
    lx.enable()
    lx.sign_in(lx.remote(**{"CF-Connecting-IP": "203.0.113.50"}), "nobody")
    li.janitor(lx.db)
    rows = lx.rows("SELECT key, count FROM auth_local_failures")
    assert any(r["key"].startswith("ip:") for r in rows) and any(r["key"] == "global" for r in rows)
    assert not any("203.0.113" in r["key"] for r in rows)  # the address is hashed
    li.TIERS.clear()
    assert li.restore_tiers(lx.db) >= 2 and li.TIERS.global_count() >= 1


# ---------------------------------------------------------------- 5. sessions

def test_sessions_list_label_revoke_and_sign_out(lx):
    lx.enable()
    created, c = lx.ready("maria")
    uid = created["user"]["id"]
    other = lx.remote()
    assert lx.sign_in(other, "maria").status_code == 200
    rows = c.get("/arx/api/v1/auth/sessions").json()["sessions"]
    assert len(rows) == 2 and all(r["kind"] == "local" and r["user_id"] == uid for r in rows)
    assert sum(1 for r in rows if r["current"]) == 1
    mine = next(r for r in rows if r["current"])
    theirs = next(r for r in rows if not r["current"])
    assert c.patch(f"/arx/api/v1/auth/sessions/{mine['id']}", json={"label": "טלפון של מריה"}).json()["label"] == "טלפון של מריה"
    r = c.delete(f"/arx/api/v1/auth/sessions/{theirs['id']}")
    assert r.status_code == 200 and r.json()["sessions_ended"] == 1 and r.json()["current_ended"] is False
    assert other.get("/arx/api/v1/me").status_code == 401
    # the administrator sees and ends them too
    all_rows = lx.admin.get("/api/v1/auth/sessions?scope=all").json()["sessions"]
    assert [r["label"] for r in all_rows if r.get("kind") == "local"] == ["טלפון של מריה"]
    assert lx.admin.post(f"/api/v1/identity/local-users/{uid}/sessions/revoke").json()["sessions_ended"] == 1
    assert c.get("/arx/api/v1/me").status_code == 401
    # sign out
    assert lx.sign_in(c, "maria").status_code == 200
    assert c.delete("/arx/api/v1/auth/session").status_code == 204
    assert c.get("/arx/api/v1/me").status_code == 401
    reasons = {r["revoked_reason"] for r in lx.rows("SELECT revoked_reason FROM auth_local_sessions WHERE revoked_at IS NOT NULL")}
    assert {"logout", "admin"} <= reasons


def test_sign_out_everywhere_for_a_local_identity(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    other = lx.remote()
    lx.sign_in(other, "maria")
    r = c.delete("/arx/api/v1/auth/sessions")
    assert r.status_code == 200 and r.json()["sessions_ended"] == 2 and r.json()["current_ended"] is True
    assert c.get("/arx/api/v1/me").status_code == 401 and other.get("/arx/api/v1/me").status_code == 401


def test_session_survives_a_restart_and_honours_expiry(lx):
    lx.enable()
    created, c = lx.ready("maria")
    value = c.cookies.get("arx_session")
    li.CACHE.clear()
    app2 = create_app(lx.settings)  # a new process on the same data: the session is persistent
    c2 = TestClient(app2, headers=ORIGIN)
    c2.cookies.set("arx_session", value, path="/arx/")
    assert c2.get("/arx/api/v1/me").json()["user"]["id"] == created["user"]["id"]
    with lx.db.connection() as conn:
        conn.execute("UPDATE auth_local_sessions SET idle_expires_at = '2000-01-01T00:00:00Z'")
    li.CACHE.clear()
    assert c2.get("/arx/api/v1/me").status_code == 401
    assert lx.rows("SELECT revoked_reason FROM auth_local_sessions")[0]["revoked_reason"] == "idle"


def test_rotation_after_24h_with_a_short_grace(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    old = c.cookies.get("arx_session")
    with lx.db.connection() as conn:
        conn.execute("UPDATE auth_local_sessions SET created_at = '2000-01-01T00:00:00Z', last_used_at = '2000-01-01T00:00:00Z'")
    li.CACHE.clear()
    r = c.get("/arx/api/v1/me")
    assert r.status_code == 200
    new_cookie = _cookie(r)
    assert new_cookie.startswith("arx_session=l.") and old not in new_cookie and "HttpOnly" in new_cookie
    new = c.cookies.get("arx_session")
    assert new != old
    # the old value still resolves for a moment (two tabs racing), then never again
    stale = lx.remote()
    stale.cookies.set("arx_session", old, path="/arx/")
    li.CACHE.clear()
    assert stale.get("/arx/api/v1/me").status_code == 200
    with lx.db.connection() as conn:
        conn.execute("UPDATE auth_local_sessions SET revoked_at = '2000-01-01T00:00:00Z' WHERE revoked_reason = 'rotated'")
    li.CACHE.clear()
    assert stale.get("/arx/api/v1/me").status_code == 401
    assert c.get("/arx/api/v1/me").status_code == 200
    assert lx.audit("auth.local.session.rotated")


def test_a_permission_change_rotates_the_session(lx):
    lx.enable()
    created, c = lx.ready("maria")
    lx.admin.put(f"/api/v1/identity/local-users/{created['user']['id']}/role", json={"role_id": "operator"})
    li.CACHE.clear()
    r = c.get("/arx/api/v1/me")
    assert r.status_code == 200 and "arx_session=l." in _cookie(r)
    assert json.loads(lx.audit("auth.local.session.rotated")[-1]["details_json"])["reason"] == "permissions"


def test_password_change_rotates_and_ends_other_sessions(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    other = lx.remote()
    lx.sign_in(other, "maria")
    r = c.put("/arx/api/v1/auth/local/password", json={"current_password": "wrong one here", "new_password": GOOD2})
    assert r.status_code == 400 and r.json()["code"] == "current_password_invalid"
    r = c.put("/arx/api/v1/auth/local/password", json={"current_password": GOOD, "new_password": GOOD})
    assert r.status_code == 400 and r.json()["details"]["reason"] == "same_as_current"
    r = c.put("/arx/api/v1/auth/local/password", json={"current_password": GOOD, "new_password": GOOD2})
    assert r.status_code == 200 and r.json()["other_sessions_ended"] == 1 and "arx_session=l." in _cookie(r)
    assert c.get("/arx/api/v1/me").status_code == 200 and other.get("/arx/api/v1/me").status_code == 401
    assert lx.sign_in(lx.remote(), "maria", GOOD).status_code == 401 and lx.sign_in(lx.remote(), "maria", GOOD2).status_code == 200
    # an HA user has no local password
    lx.flag("u-viewer")
    lx.login(lx.viewer)
    assert lx.client.put("/arx/api/v1/auth/local/password", json={"current_password": "a", "new_password": "b"}).json()["code"] == "not_local_identity"


def test_disable_and_delete_end_everything_at_once(lx):
    lx.enable()
    created, c = lx.ready("maria")
    uid = created["user"]["id"]
    r = lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": False})
    assert r.status_code == 200 and r.json()["status"] == "disabled"
    assert c.get("/arx/api/v1/me").status_code == 401
    assert lx.sign_in(lx.remote(), "maria").status_code == 401
    lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"active": True})
    assert lx.sign_in(c, "maria").status_code == 200
    r = lx.admin.delete(f"/api/v1/identity/local-users/{uid}")
    assert r.status_code == 200 and r.json()["sessions_ended"] == 1 and r.json()["bindings_revoked"] == 1
    assert c.get("/arx/api/v1/me").status_code == 401
    assert lx.admin.get(f"/api/v1/identity/local-users/{uid}").status_code == 404
    # the username stays reserved until the purge (a later phase)
    r = lx.admin.post("/api/v1/identity/local-users", json={"username": "maria", "display_name": "X", "role_id": "viewer"})
    assert r.status_code == 409


# ---------------------------------------------------------------- 6. administrative targets (owner answer Q3)

def _remote_admin(lx: Lx) -> TestClient:
    lx.flag("u-owner")
    lx.bind("u-owner", "system_admin")
    assert lx.login(lx.owner).status_code == 200
    return lx.client


def test_administrative_targets_are_local_channel_only(lx, settings):
    lx.enable()
    lx.admin.get("/api/v1/sites")
    remote_admin = _remote_admin(lx)
    body = {"username": "sitey", "display_name": "Site Admin", "role_id": "site_admin"}
    r = remote_admin.post("/arx/api/v1/identity/local-users", json=body)
    assert r.status_code == 404  # creating (and minting the link of) an administrative target: local channel only
    assert lx.rows("SELECT id FROM users WHERE source = 'local'") == []
    r = remote_admin.post("/arx/api/v1/identity/local-users", json={**body, "username": "plain", "role_id": "viewer"})
    assert r.status_code == 201 and r.json()["link"]["url"].startswith("https://testserver/arx/#/welcome?t=")
    plain = r.json()["user"]["id"]
    r = remote_admin.put(f"/arx/api/v1/identity/local-users/{plain}/role", json={"role_id": "site_admin"})
    assert r.status_code == 404
    admin_user = lx.create("sitey", "site_admin")
    aid = admin_user["user"]["id"]
    assert admin_user["user"]["admin"] is True and admin_user["user"]["reset_mode"] == "manager_only"
    assert remote_admin.post(f"/arx/api/v1/identity/local-users/{aid}/link", json={"purpose": "first_login"}).status_code == 404
    r = lx.admin.post(f"/api/v1/identity/local-users/{aid}/link", json={"purpose": "first_login", "via": "whatsapp"})
    assert r.status_code == 422 and r.json()["code"] == "whatsapp_not_for_admins"
    r = lx.admin.post(f"/api/v1/identity/local-users/{plain}/link", json={"purpose": "first_login", "via": "whatsapp"})
    assert r.status_code == 409 and r.json()["code"] == "no_verified_number"  # USR2 phase 2: WhatsApp is real now - but needs a verified number
    # self-service reset is refused for an administrative target (create, patch) and switched off by an admin role
    r = lx.admin.patch(f"/api/v1/identity/local-users/{aid}", json={"reset_mode": "self_service"})
    assert r.status_code == 422 and r.json()["code"] == "self_service_not_for_admins"
    r = lx.admin.post("/api/v1/identity/local-users", json={**body, "username": "other", "reset_mode": "self_service"})
    assert r.status_code == 422
    assert lx.admin.patch(f"/api/v1/identity/local-users/{plain}", json={"reset_mode": "self_service"}).json()["reset_mode"] == "self_service"
    r = lx.admin.put(f"/api/v1/identity/local-users/{plain}/role", json={"role_id": "site_admin"})
    assert r.status_code == 200 and r.json()["reset_mode"] == "manager_only"


def test_f1_generic_bindings_route_cannot_shape_an_administrative_target_remotely(lx):
    """USR2-FIX F1, the exact attack of the security review: a system administrator on the REMOTE channel creates a viewer local user
    (allowed), revokes its binding through the generic route and binds site_admin through the generic route - refused (404, the
    shape of the dedicated routes); the bulk route too. The same promotion from the local channel works and kills the link that
    was minted on the remote channel."""
    lx.enable()
    lx.admin.get("/api/v1/sites")
    remote_admin = _remote_admin(lx)
    r = remote_admin.post("/arx/api/v1/identity/local-users", json={"username": "plain", "display_name": "Plain", "role_id": "viewer"})
    assert r.status_code == 201
    uid, bid = r.json()["user"]["id"], r.json()["user"]["binding_id"]
    remote_token = r.json()["link"]["path"].split("t=", 1)[1]
    assert remote_admin.delete(f"/arx/api/v1/access/bindings/{bid}").status_code == 200
    admin_bind = {"subject_kind": "user", "subject_id": uid, "role_id": "site_admin", "scope_type": "installation", "scope_id": "*"}
    r = remote_admin.post("/arx/api/v1/access/bindings", json=admin_bind)
    assert r.status_code == 404 and r.json()["code"] == "not_found"
    r = remote_admin.post("/arx/api/v1/access/bindings/bulk", json={"items": [admin_bind]})
    assert r.status_code == 404
    assert lx.rows("SELECT id FROM bindings WHERE subject_id = ? AND revoked_at IS NULL", (uid,)) == []
    assert {a["reason"] for a in lx.audit("rbac.bind") if a["decision"] == "denied"} >= {"local_admin_target_remote"}
    # a non-administrative role is still fine remotely through the generic route
    r = remote_admin.post("/arx/api/v1/access/bindings", json={**admin_bind, "role_id": "operator"})
    assert r.status_code == 201, r.text
    assert remote_admin.delete(f"/arx/api/v1/access/bindings/{r.json()['id']}").status_code == 200
    # from the local channel the promotion works - and the remotely minted first-login link no longer does
    r = lx.admin.post("/api/v1/access/bindings", json=admin_bind)
    assert r.status_code == 201, r.text
    assert lx.set_password(remote_token).status_code == 401
    inv = lx.audit("auth.local.link.invalidated")
    assert inv and inv[-1]["reason"] == "admin_role" and inv[-1]["resource_id"] == uid


def test_f1_role_change_to_an_administrative_role_invalidates_open_links(lx):
    lx.enable()
    created = lx.create("plain")  # viewer, link minted
    uid = created["user"]["id"]
    token = lx.link_token(created)
    r = lx.admin.put(f"/api/v1/identity/local-users/{uid}/role", json={"role_id": "site_admin"})
    assert r.status_code == 200 and r.json()["admin"] is True
    assert lx.set_password(token).status_code == 401
    assert lx.audit("auth.local.link.invalidated")[-1]["reason"] == "admin_role"
    # a non-administrative role change keeps an open link
    other = lx.create("other")
    token2 = lx.link_token(other)
    assert lx.admin.put(f"/api/v1/identity/local-users/{other['user']['id']}/role", json={"role_id": "operator"}).status_code == 200
    assert lx.set_password(token2).status_code == 200


def test_f3_a_sign_in_storm_waits_in_a_bounded_room_on_its_own_threads(lx, monkeypatch):
    """USR2-FIX F3: sign-ins hash on the dedicated `arx-hash` threads; beyond the waiting room the answer is the uniform 429 with
    Retry-After, without hashing, for a known and an unknown name alike; the other routes keep answering meanwhile."""
    import threading

    lx.enable()
    lx.ready("maria")
    lp.ensure_dummy()
    gate = threading.Event()
    started: list[str] = []
    real = lp._scrypt

    def slow(secret, salt, prof):
        started.append(threading.current_thread().name)
        gate.wait(15)
        return real(secret, salt, prof)

    monkeypatch.setattr(lp, "_scrypt", slow)
    monkeypatch.setattr(lp.ADMISSION, "limit", 3)
    results: list[int] = []

    def one(i: int) -> None:
        r = lx.sign_in(lx.remote(**_net(100 + i)), "maria" if i % 2 else "nobody", "wrong password here")
        results.append(r.status_code)

    threads = [threading.Thread(target=one, args=(i,)) for i in range(3)]
    try:
        for t in threads:
            t.start()
        deadline = time.monotonic() + 10
        while (len(started) < lp.HASH_THREADS or lp.ADMISSION.in_flight < 3) and time.monotonic() < deadline:
            time.sleep(0.02)
        assert len(started) == lp.HASH_THREADS and lp.ADMISSION.in_flight == 3
        t0 = time.monotonic()
        over = [lx.sign_in(lx.remote(**_net(150 + i)), name, "wrong password here") for i, name in enumerate(("maria", "nobody"))]
        assert [r.status_code for r in over] == [429, 429]
        assert _body(over[0]) == _body(over[1]) and over[0].json()["code"] == "rate_limited" and int(over[0].headers["retry-after"]) >= 1
        assert len(started) == lp.HASH_THREADS  # refused without hashing
        assert lx.admin.get("/api/v1/me").status_code == 200  # the rest of the add-on answers while every hashing thread is busy
        assert lx.admin.get("/api/v1/identity/local-users").status_code == 200
        assert time.monotonic() - t0 < 5
    finally:
        gate.set()
        for t in threads:
            t.join(20)
    assert sorted(results) == [401, 401, 401]
    assert started and all(name.startswith("arx-hash") for name in started)
    assert lx.audit("auth.local.storm") and lx.audit("auth.local.storm")[-1]["reason"] == "admission"


def test_f4_announcements_are_refused_to_a_local_identity(lx, monkeypatch):
    """USR2-FIX F4 (CR-USR2 §1a.5): an announcement runs on the add-on's own infrastructure token, so a local identity is refused
    (fail closed) until phase 3 - through the route and in the service itself - and nothing is spoken."""
    from smplwise.rbac import Principal
    from smplwise.services import announcements as ann

    spoken: list = []
    monkeypatch.setattr(ann, "SPEAK", lambda *a, **k: spoken.append(a))
    lx.enable()
    created = lx.create("sitey", "site_admin")  # site_admin carries media.announce
    assert lx.set_password(lx.link_token(created)).status_code == 200
    c = lx.remote()
    assert lx.sign_in(c, "sitey").status_code == 200
    r = c.post("/arx/api/v1/announcements", json={"scope": "device", "ref": "media_player.kitchen", "text": "hello"})
    assert r.status_code == 403 and r.json()["code"] == "local_identity_not_allowed", r.text
    assert lx.audit("media.announce")[-1]["reason"] == "local_identity_ha_action"
    p = Principal(user_id=created["user"]["id"], username="sitey", display_name="Sitey", source="local", factor_ok=True)
    with lx.db.connection() as conn:
        with pytest.raises(Exception) as exc:
            ann.announce(conn, lx.settings, p, None, source="manual", scope="device", ref="media_player.kitchen", text="hello")
    assert getattr(exc.value, "code", None) == "local_identity_not_allowed"
    assert spoken == []


def test_f11_temporary_link_of_an_enrolled_user_can_finish_the_password_change(lx):
    """USR2-FIX F11: an enrolled user given a TEMPORARY reset link signs in with the TOTP code and must change the password; that
    step has no code field, and the code shown at this very sign-in counts - before the fix it answered `second_factor_required`."""
    lx.enable()
    created, c = lx.ready("maria")
    uid = created["user"]["id"]
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    assert c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": _code(secret)}).status_code == 200
    link = lx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "reset", "temporary": True}).json()["link"]
    assert lx.set_password(link["path"].split("t=", 1)[1], GOOD2).status_code == 200
    with lx.db.connection() as conn:
        conn.execute("UPDATE auth_totp SET last_step = 0")
    c2 = lx.remote()
    assert lx.sign_in(c2, "maria", GOOD2).status_code == 202
    r = c2.post("/arx/api/v1/auth/local/sign-in/second-factor", json={"code": _code(secret)})
    assert r.status_code == 200 and r.json()["must_change_password"] is True
    r = c2.put("/arx/api/v1/auth/local/password", json={"current_password": GOOD2, "new_password": "quiet orange harbour 12"})
    assert r.status_code == 200, r.text
    assert lx.rows("SELECT must_change FROM auth_local_credentials WHERE user_id = ?", (uid,)) == [{"must_change": 0}]
    # an ordinary change (no must_change) of an enrolled user still needs a fresh code
    r = c2.put("/arx/api/v1/auth/local/password", json={"current_password": "quiet orange harbour 12", "new_password": "silver maple window 88"})
    assert r.status_code == 400 and r.json()["code"] == "second_factor_required"


def _code(secret_b32: str) -> str:
    pad = "=" * (-len(secret_b32) % 8)
    return sf.hotp(base64.b32decode(secret_b32 + pad), sf.step_of())


def test_administrative_permissions_wait_for_the_second_factor(lx):
    lx.enable()
    created = lx.create("sitey", "site_admin")
    uid = created["user"]["id"]
    assert lx.set_password(lx.link_token(created)).json() == {"must_enrol": True}
    c = lx.remote()
    r = lx.sign_in(c, "sitey")
    assert r.status_code == 200 and r.json()["second_factor"] == "enroll_required"
    row = lx.rows("SELECT expires_at, chain_started_at FROM auth_local_sessions WHERE user_id = ?", (uid,))[0]
    assert li.epoch(row["expires_at"]) - li.epoch(row["chain_started_at"]) <= 7 * 86400  # Q3: 7-day sessions
    me = c.get("/arx/api/v1/me").json()
    assert me["local_identity"]["admin_permissions_blocked"] is True and "rbac.assign" not in me["permissions_any"]
    r = c.get("/arx/api/v1/access/bindings")
    assert r.status_code == 403
    assert lx.rows("SELECT reason FROM audit_log WHERE actor_user_id = ? AND decision = 'denied' ORDER BY at DESC LIMIT 1", (uid,))[0]["reason"] == "second_factor_required"
    assert c.get("/arx/api/v1/sites").status_code == 200  # the non-administrative part of the role works
    # enrol: the session rotates and now counts as having shown the factor
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    r = c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": _code(secret)})
    assert r.status_code == 200 and "arx_session=l." in _cookie(r)
    assert c.get("/arx/api/v1/access/bindings").status_code == 200
    # a new sign-in now owes the code: 202 + the pending cookie, then the code
    c2 = lx.remote()
    r = lx.sign_in(c2, "sitey")
    assert r.status_code == 202 and r.json() == {"second_factor": "required"} and "arx_pending=" in _cookie(r) and "arx_session=" not in _cookie(r)
    assert "Path=/arx/api/v1/auth/local/sign-in" in _cookie(r)
    assert c2.get("/arx/api/v1/me").status_code == 401
    r = c2.post("/arx/api/v1/auth/local/sign-in/second-factor", json={"code": "000000"})
    assert r.status_code == 401 and r.json()["code"] == "second_factor_invalid"
    time.sleep(0)  # the replay guard refuses a step already used: wait for a fresh step if the enrol code is the current one
    with lx.db.connection() as conn:
        conn.execute("UPDATE auth_totp SET last_step = 0")
    r = c2.post("/arx/api/v1/auth/local/sign-in/second-factor", json={"code": _code(secret)})
    assert r.status_code == 200 and "arx_session=l." in _cookie(r)
    assert c2.get("/arx/api/v1/access/bindings").status_code == 200
    # an administrator's reset of the factor ends the user's local sessions
    lx.admin.delete(f"/api/v1/auth/second-factor/users/{uid}")
    assert c2.get("/arx/api/v1/me").status_code == 401 and c.get("/arx/api/v1/me").status_code == 401


def test_a_required_policy_gates_the_session_until_enrolment(lx):
    lx.enable()
    created = lx.create("maria")
    uid = created["user"]["id"]
    assert lx.admin.put(f"/api/v1/auth/second-factor/overrides/user/{uid}", json={"policy": "required"}).status_code == 200
    assert lx.set_password(lx.link_token(created)).json() == {"must_enrol": True}
    c = lx.remote()
    assert lx.sign_in(c, "maria").json()["second_factor"] == "enroll_required"
    r = c.get("/arx/api/v1/sites")
    assert r.status_code == 403 and r.json()["code"] == "second_factor_enrollment_required"
    assert c.get("/arx/api/v1/me").status_code == 200
    secret = c.post("/arx/api/v1/auth/second-factor/enroll").json()["secret"]
    assert c.post("/arx/api/v1/auth/second-factor/confirm", json={"code": _code(secret)}).status_code == 200
    assert c.get("/arx/api/v1/sites").status_code == 200


# ---------------------------------------------------------------- 7. trust boundary

def test_ingress_never_accepts_a_local_id(settings, tmp_path):
    from test_remote_access import remote_client

    c = remote_client(settings, tmp_path, dev_user=None, trusted_proxies=("testclient",))
    assert c.get("/api/v1/me", headers={"X-Remote-User-Id": "0123456789abcdef0123456789abcdef"}).status_code == 200
    r = c.get("/api/v1/me", headers={"X-Remote-User-Id": "l_01JABCDEFGHJKMNPQRSTVWXYZ0", "X-Remote-User-Name": "maria"})
    assert r.status_code == 401 and r.json()["code"] == "identity_missing"


def test_directory_sync_never_touches_a_local_identity(lx):
    """R11 regression: a full push without the local id keeps it active; a push naming an `l_` id is ignored for it."""
    lx.enable()
    created, c = lx.ready("maria")
    uid = created["user"]["id"]
    secret = lx.admin.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert lx.admin.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.2"})).status_code == 200
    push = [{"id": "u-owner", "name": "Joni", "username": "joni", "is_active": True}, {"id": uid, "name": "x", "username": "maria", "is_active": False}]
    assert lx.admin.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": push})).status_code == 200
    assert lx.rows("SELECT active FROM users WHERE id = ?", (uid,)) == [{"active": 1}]
    assert lx.rows("SELECT id FROM ha_users WHERE id = ?", (uid,)) == []
    assert c.get("/arx/api/v1/me").status_code == 200


def test_bootstrap_never_grants_a_local_identity(settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    try:
        a.enable()
        created = a.create("boss")
        assert a.set_password(a.link_token(created)).status_code == 200
        a.settings = dataclasses.replace(a.settings, bootstrap_admin_username="boss")
        with a.db.connection() as conn:
            set_setting(conn, "bootstrap_state", "pending")
        app2 = create_app(a.settings)
        c = TestClient(app2, headers=ORIGIN)
        assert c.post("/arx/api/v1/auth/local/sign-in", json={"username": "boss", "password": GOOD}).status_code == 200
        assert c.get("/arx/api/v1/me").json()["bootstrap_state"] == "pending"
        assert a.rows("SELECT 1 FROM bindings WHERE subject_id = ? AND role_id = 'system_admin'", (created["user"]["id"],)) == []
    finally:
        hua.reset_for_tests()


def test_websocket_of_a_local_session(lx):
    from starlette.websockets import WebSocketDisconnect

    lx.enable()
    _created, c = lx.ready("maria")
    with c.websocket_connect("/arx/api/v1/me/ws", headers=ORIGIN) as ws:
        hello = json.loads(ws.receive_text())
        assert hello["type"] == "hello"
    bare = TestClient(lx.app)
    bare.cookies.set("arx_session", c.cookies.get("arx_session"), path="/arx/")
    with pytest.raises(WebSocketDisconnect):
        with bare.websocket_connect("/arx/api/v1/me/ws") as ws:  # no Origin: refused
            ws.receive_text()


# ---------------------------------------------------------------- 8. secrets never leak; backup

def test_password_token_and_typed_names_never_in_logs_audit_or_answers(lx, caplog):
    caplog.set_level(logging.DEBUG)
    lx.enable()
    created = lx.create("maria")
    token = lx.link_token(created)
    lx.set_password(token, GOOD)
    c = lx.remote()
    lx.sign_in(c, "maria", "wrong-secret-xyz-123")
    lx.sign_in(c, "typed-ghost-name", "another-secret-987")
    lx.sign_in(c, "maria")
    audit_text = json.dumps(lx.rows("SELECT actor_username, resource_id, reason, details_json FROM audit_log"), ensure_ascii=False)
    for secret in (GOOD, "wrong-secret-xyz-123", "another-secret-987", token, "typed-ghost-name"):
        assert secret not in audit_text and secret not in caplog.text
    listing = lx.admin.get("/api/v1/identity/local-users").text
    assert "$scrypt$" not in listing and token not in listing and "password_hash" not in listing
    export = lx.admin.get("/api/v1/identity/local-users/export")
    assert export.status_code == 200 and "$scrypt$" not in export.text and export.headers["content-type"].startswith("text/csv")
    # no clear secret anywhere in the database: hashes only
    with sqlite3.connect(lx.settings.db_path) as raw:
        dump = "\n".join(str(r) for r in raw.iterdump())
    assert GOOD not in dump and token not in dump and c.cookies.get("arx_session") not in dump


def test_backup_carries_hashes_but_no_sessions_links_or_counters(lx):
    from smplwise.services import backup

    lx.enable()
    lx.ready("maria")
    lx.sign_in(lx.remote(), "nobody")
    li.janitor(lx.db)
    with lx.db.connection(mode="read") as conn:
        snap = backup.snapshot(conn, include_access=True)
    assert snap["auth_local_credentials"] and snap["auth_local_credentials"][0]["password_hash"].startswith("$scrypt$")
    # BACKUP-HASH-ENC: the in-memory snapshot has the hash; the archive's data files never do (encrypted section only)
    clean, payload = backup.sens.split(snap)
    assert all("password_hash" not in r for r in clean["auth_local_credentials"]) and list(payload["password_hashes"].values())[0].startswith("$scrypt$")
    for table in ("auth_local_sessions", "auth_local_links", "auth_local_failures", "auth_totp", "auth_totp_failures"):
        assert table not in snap
    assert "security.local_identity" in backup.SETTINGS_KEEP
    assert not [r for r in snap.get("settings", []) if r["key"] == "security.local_identity"]


def test_f9_failure_counters_never_travel_in_a_backup(lx):
    """USR2-FIX F9 (CR-USR2 §1a.6): the per-account counter / lock columns of auth_local_credentials are left out of the archive,
    and an archive that has them (an older one) never writes them back."""
    from smplwise.services import backup

    lx.enable()
    created, _c = lx.ready("maria")
    uid = created["user"]["id"]
    lx.sign_in(lx.remote(), "maria", "not the password")
    with lx.db.connection() as conn:
        conn.execute("UPDATE auth_local_credentials SET delay_until = ?, unlocked_by = 'x' WHERE user_id = ?", (time.time() + 600, uid))
    with lx.db.connection(mode="read") as conn:
        snap = backup.snapshot(conn, include_access=True)
    row = next(r for r in snap["auth_local_credentials"] if r["user_id"] == uid)
    assert row["password_hash"].startswith("$scrypt$")
    assert not {"failed_count", "last_failed_at", "delay_until", "unlocked_by"} & set(row)
    tampered = {**row, "failed_count": 49, "last_failed_at": time.time(), "delay_until": time.time() + 900, "unlocked_by": "someone"}
    with lx.db.connection() as conn:
        backup._insert_rows(conn, "auth_local_credentials", [tampered], replace=True)
    after = lx.rows("SELECT failed_count, last_failed_at, delay_until, unlocked_by, password_hash FROM auth_local_credentials WHERE user_id = ?", (uid,))[0]
    assert after == {"failed_count": 0, "last_failed_at": None, "delay_until": None, "unlocked_by": None, "password_hash": row["password_hash"]}


def test_janitor_prunes_old_links_and_sessions(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    c.delete("/arx/api/v1/auth/session")
    with lx.db.connection() as conn:
        conn.execute("UPDATE auth_local_sessions SET revoked_at = '2000-01-01T00:00:00Z'")
        conn.execute("UPDATE auth_local_links SET used_at = '2000-01-01T00:00:00Z'")
    assert li.janitor(lx.db) >= 2
    assert lx.rows("SELECT * FROM auth_local_sessions") == [] and lx.rows("SELECT * FROM auth_local_links") == []


def test_a_rename_is_not_reverted_by_the_users_next_request(lx):
    lx.enable()
    created, c = lx.ready("maria")
    uid = created["user"]["id"]
    assert c.get("/arx/api/v1/me").json()["user"]["display_name"] == "Maria"
    assert lx.admin.patch(f"/api/v1/identity/local-users/{uid}", json={"display_name": "מריה כהן"}).status_code == 200
    assert c.get("/arx/api/v1/me").json()["user"]["display_name"] == "מריה כהן"
    assert lx.rows("SELECT display_name FROM users WHERE id = ?", (uid,)) == [{"display_name": "מריה כהן"}]
