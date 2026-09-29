"""CR-008 SmplWise Arx remote access: the add-on options, the `/arx` channel middleware, the HA-token session
exchange and the remote branch of the identity resolution."""
from __future__ import annotations

import json

import pytest

from smplwise.config import DEFAULT_REMOTE_PATH, load_settings, normalize_remote_path


# ---------------------------------------------------------------- 1. add-on options

def test_remote_options_default_off(tmp_path, monkeypatch):
    monkeypatch.delenv("SW_REMOTE_ACCESS", raising=False)
    monkeypatch.delenv("SW_REMOTE_PATH", raising=False)
    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"bootstrap_admin_username": "joni"}), encoding="utf-8")
    s = load_settings(opts)
    assert s.remote_access is False
    assert s.remote_path == "/arx"


def test_remote_options_from_options_file(tmp_path, monkeypatch):
    monkeypatch.setenv("SW_REMOTE_ACCESS", "false")
    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"remote_access": True, "remote_path": "/Remote/"}), encoding="utf-8")
    s = load_settings(opts)
    assert s.remote_access is True
    assert s.remote_path == "/remote"


def test_remote_options_from_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("SW_REMOTE_ACCESS", "1")
    monkeypatch.setenv("SW_REMOTE_PATH", "arx")
    s = load_settings(tmp_path / "missing.json")
    assert s.remote_access is True and s.remote_path == "/arx"


@pytest.mark.parametrize("raw", ["/", "/api", "/auth", "/a/b", "/../x", "/hikvision-intercom", "/x y", "/" + "a" * 40])
def test_remote_path_rejects_unsafe_values(raw):
    assert normalize_remote_path(raw) == DEFAULT_REMOTE_PATH


def test_addon_manifest_declares_the_options():
    from pathlib import Path

    text = (Path(__file__).resolve().parents[2] / "config.yaml").read_text(encoding="utf-8")
    assert "  remote_access: false" in text and "  remote_path: /arx" in text
    assert "  remote_access: bool" in text and "  remote_path: match(" in text


# ---------------------------------------------------------------- 2. the /arx channel middleware

import dataclasses  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from smplwise.main import create_app  # noqa: E402


def _www(tmp_path):
    www = tmp_path / "www"
    www.mkdir(exist_ok=True)
    (www / "index.html").write_text("<!doctype html><title>Arx</title><sw-app></sw-app>", encoding="utf-8")
    (www / "arx-sw.js").write_text("// placeholder: the PWA branch ships the real worker\n", encoding="utf-8")
    return www


def remote_client(settings, tmp_path, **over) -> TestClient:
    s = dataclasses.replace(settings, remote_access=True, www_dir=_www(tmp_path), **over)
    return TestClient(create_app(s))


def test_remote_off_is_404_everywhere_under_the_prefix(settings, tmp_path):
    c = TestClient(create_app(dataclasses.replace(settings, www_dir=_www(tmp_path))))
    for path in ("/arx", "/arx/", "/arx/api/v1/me", "/arx/arx-sw.js", "/arx/index.html"):
        r = c.get(path, follow_redirects=False)
        assert r.status_code == 404, path
    # the local (Ingress / developer) paths are unchanged
    assert c.get("/api/v1/me").status_code == 200
    assert c.get("/").status_code == 200


def test_prefix_without_slash_redirects_308(settings, tmp_path):
    c = remote_client(settings, tmp_path)
    r = c.get("/arx", follow_redirects=False)
    assert r.status_code == 308 and r.headers["location"] == "/arx/"
    r = c.get("/arx?x=1", follow_redirects=False)
    assert r.headers["location"] == "/arx/?x=1"
    assert c.get("/arxfoo", follow_redirects=False).status_code != 308


def test_prefix_is_stripped_for_static_files(settings, tmp_path):
    c = remote_client(settings, tmp_path)
    r = c.get("/arx/")
    assert r.status_code == 200 and "<sw-app>" in r.text
    assert c.get("/arx/arx-sw.js").status_code == 200


def test_remote_channel_never_uses_the_developer_identity(settings, tmp_path):
    """The test settings run in developer identity mode (SW_DEV_USER): the local API answers as `dev-joni`, the
    remote channel refuses all the same."""
    c = remote_client(settings, tmp_path)
    assert c.get("/api/v1/me").json()["user"]["id"] == "dev-joni"
    r = c.get("/arx/api/v1/me", headers={"X-SW-Dev-User": "joni"})
    assert r.status_code == 401 and r.json()["code"] == "remote_login_required"


def test_forged_ingress_headers_are_refused_on_the_remote_channel(settings, tmp_path):
    c = remote_client(settings, tmp_path, dev_user=None, trusted_proxies=("testclient",))
    forged = {"X-Remote-User-Id": "u-owner", "X-Remote-User-Name": "joni", "X-Remote-User-Display-Name": "Joni",
              "X-Ingress-Path": "/api/hassio_ingress/abc"}
    # the same headers from the trusted Ingress address are an identity on the local channel...
    assert c.get("/api/v1/me", headers=forged).json()["user"]["id"] == "u-owner"
    # ...and nothing on the remote one, even from that address
    r = c.get("/arx/api/v1/me", headers=forged)
    assert r.status_code == 401 and r.json()["code"] == "remote_login_required"


def test_remote_middleware_drops_identity_headers(settings):
    import asyncio

    from smplwise.remote_channel import RemoteChannel

    seen = {}

    async def inner(scope, receive, send):
        seen.update(scope)
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    mw = RemoteChannel(inner, dataclasses.replace(settings, remote_access=True))
    scope = {"type": "http", "path": "/arx/api/v1/me", "root_path": "", "query_string": b"",
             "headers": [(b"x-remote-user-id", b"x"), (b"X-Ingress-Path", b"/p"), (b"x-sw-dev-user", b"joni"),
                         (b"x-hass-source", b"core"), (b"accept", b"*/*")]}
    sent = []

    async def send(m):
        sent.append(m)

    asyncio.run(mw(scope, None, send))
    assert seen["headers"] == [(b"accept", b"*/*")]
    assert seen["root_path"] == "/arx" and seen["path"] == "/arx/api/v1/me"
    assert seen["state"]["sw_channel"] == "remote"
    headers = dict(sent[0]["headers"])
    assert b"frame-ancestors 'self'" in headers[b"content-security-policy"]
    assert headers[b"x-frame-options"] == b"SAMEORIGIN"
    assert headers[b"cache-control"] == b"no-store"


def test_remote_responses_carry_security_headers(settings, tmp_path):
    c = remote_client(settings, tmp_path)
    for path in ("/arx/", "/arx/api/v1/me"):
        h = c.get(path).headers
        assert "frame-ancestors 'self'" in h["content-security-policy"]
        assert "script-src 'self'" in h["content-security-policy"]
        assert h["x-frame-options"] == "SAMEORIGIN"
        assert h["referrer-policy"] == "same-origin"
        assert "geolocation=()" in h["permissions-policy"]
        assert h["x-content-type-options"] == "nosniff"
    assert c.get("/arx/api/v1/me").headers["cache-control"] == "no-store"
    # the Ingress channel keeps its headers as they were
    assert "content-security-policy" not in c.get("/api/v1/me").headers


def test_remote_websocket_without_session_is_refused(settings, tmp_path):
    from starlette.websockets import WebSocketDisconnect

    c = remote_client(settings, tmp_path)
    with pytest.raises(WebSocketDisconnect):
        with c.websocket_connect("/arx/api/v1/me/ws", headers={"X-Remote-User-Id": "u-owner"}) as ws:
            ws.receive_text()


# ---------------------------------------------------------------- 3. HA-token sessions (a fake HA core)

import asyncio  # noqa: E402
import time  # noqa: E402

from fake_ha_core import FakeHaCore, FakeUser, make_jwt  # noqa: E402
from smplwise.db import Database, new_id, now_iso, permission_revision  # noqa: E402
from smplwise.services import ha_user_auth as hua  # noqa: E402

ORIGIN = {"Origin": "http://testserver"}


class Arx:
    """A remote-enabled app, a fake HA core behind it, and helpers to shape the directory, flags and bindings."""

    def __init__(self, settings, tmp_path, monkeypatch, **over):
        hua.reset_for_tests()
        self.core = FakeHaCore()
        monkeypatch.setattr(hua, "_dial", self.core.dial)
        self.settings = dataclasses.replace(settings, remote_access=True, www_dir=_www(tmp_path), ha_core_url="http://ha-core.test:8123", **over)
        self.app = create_app(self.settings)
        # an Arx page's own requests: same origin (the CSRF gate of remote_channel refuses anything else with the cookie)
        self.client = TestClient(self.app, headers=ORIGIN)
        self.db = Database(self.settings.db_path)
        self.owner = self.core.add_user(FakeUser("u-owner", "joni", "pw-owner", "יוני", is_owner=True, is_admin=True))
        self.viewer = self.core.add_user(FakeUser("u-viewer", "dana", "pw-viewer", "דנה"))
        self.mfa = self.core.add_user(FakeUser("u-mfa", "avi", "pw-avi", "אבי", mfa_code="123456"))
        with self.db.connection() as conn:
            for u in (self.owner, self.viewer, self.mfa):
                conn.execute("INSERT INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, ?, ?, 1, ?, ?)",
                             (u.id, u.name, u.username, int(u.is_admin), now_iso()))

    def flag(self, user_id: str, on: bool = True) -> None:
        with self.db.connection() as conn:
            if on:
                conn.execute("INSERT OR IGNORE INTO remote_access_users(user_id, granted_by, granted_at) VALUES (?, 'test', ?)", (user_id, now_iso()))
            else:
                conn.execute("DELETE FROM remote_access_users WHERE user_id = ?", (user_id,))

    def bind(self, user_id: str, role: str = "viewer") -> None:
        with self.db.connection() as conn:
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                         "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), user_id, role, permission_revision(conn), now_iso()))

    def setting(self, key: str, value: str) -> None:
        from smplwise.db import set_setting

        with self.db.connection() as conn:
            set_setting(conn, key, value)

    def token(self, user: FakeUser) -> str:
        return self.core.issue(user.id)["access_token"]

    def login(self, user: FakeUser, **headers):
        return self.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {self.token(user)}", **headers})

    def audit(self, action: str) -> list[dict]:
        with self.db.connection(mode="read") as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY at", (action,)).fetchall()]


@pytest.fixture()
def arx(settings, tmp_path, monkeypatch):
    a = Arx(settings, tmp_path, monkeypatch)
    yield a
    hua.reset_for_tests()


def test_exchange_sets_the_session_cookie_and_the_same_principal(arx):
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    r = arx.login(arx.viewer, **{"CF-Connecting-IP": "203.0.113.7", "CF-IPCountry": "IL"})
    assert r.status_code == 200, r.text
    assert r.json()["user"] == {"id": "u-viewer", "username": "dana", "display_name": "דנה", "source": "remote"}
    cookie = r.headers["set-cookie"]
    assert cookie.startswith("arx_session=") and "HttpOnly" in cookie and "Path=/arx/" in cookie and "SameSite=strict" in cookie
    me = arx.client.get("/arx/api/v1/me").json()
    assert me["user"]["id"] == "u-viewer" and me["user"]["source"] == "remote" and me["channel"] == "remote"
    assert me["has_access"] is True and me["bindings"][0]["role_id"] == "viewer"
    assert me["remote"]["remote.session"] == "rolling_90d" and me["remote"]["remote.default_profile"] == "main"
    assert "remote.require_mfa_admin" not in me["remote"]
    # the add-on asked HA core directly (never the Supervisor proxy) and attributed the call to the caller
    assert arx.core.dials[-1]["url"] == "ws://ha-core.test:8123/api/websocket"
    assert arx.core.dials[-1]["headers"] == {"X-Forwarded-For": "203.0.113.7"}
    row = arx.audit("auth.remote_session.created")[-1]
    details = json.loads(row["details_json"])
    assert row["actor_user_id"] == "u-viewer" and details["client_ip"] == "203.0.113.7" and details["country"] == "IL"
    assert "Bearer" not in (row["details_json"] or "") and "eyJ" not in (row["details_json"] or "")


def test_secure_cookie_behind_https(arx):
    arx.flag("u-viewer")
    r = arx.login(arx.viewer, **{"X-Forwarded-Proto": "https"})
    c = r.headers["set-cookie"]
    assert c.startswith("__Secure-arx_session=") and "Secure" in c and "HttpOnly" in c and "Path=/arx/" in c


def test_policy_flag_refuses_users_without_the_flag_in_hebrew(arx):
    arx.bind("u-viewer", "viewer")
    r = arx.login(arx.viewer)
    assert r.status_code == 403 and r.json()["code"] == "remote_not_allowed"
    assert "הגישה מרחוק לא הופעלה" in r.json()["user_message"]
    assert "set-cookie" not in r.headers
    assert arx.audit("auth.remote_session.rejected")[-1]["reason"] == "remote_not_allowed"


def test_policy_any_role(arx):
    arx.setting("remote.policy", "any_role")
    assert arx.login(arx.viewer).status_code == 403  # no role at all
    arx.bind("u-viewer", "viewer")
    assert arx.login(arx.viewer).status_code == 200  # any role will do, no flag needed


def test_inactive_directory_user_is_refused(arx):
    arx.flag("u-viewer")
    with arx.db.connection() as conn:
        conn.execute("UPDATE ha_users SET is_active = 0 WHERE id = 'u-viewer'")
    r = arx.login(arx.viewer)
    assert r.status_code == 403 and r.json()["code"] == "remote_user_inactive"


def test_mfa_required_for_admins_only_when_the_setting_is_on(arx):
    arx.flag("u-owner")
    arx.bind("u-owner", "system_admin")
    assert arx.login(arx.owner).status_code == 200  # D8: MFA optional by default
    arx.setting("remote.require_mfa_admin", "true")
    r = arx.login(arx.owner)
    assert r.status_code == 403 and r.json()["code"] == "remote_mfa_required"
    arx.flag("u-mfa")
    arx.bind("u-mfa", "system_admin")
    assert arx.login(arx.mfa).status_code == 200  # an admin with MFA in HA
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    assert arx.login(arx.viewer).status_code == 200  # a non-admin without MFA


def test_garbage_and_expired_tokens_never_reach_ha(arx):
    for token in ("not-a-token", "a.b.c", make_jwt(time.time() - 5)):
        r = arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401 and r.json()["code"] == "remote_token_invalid"
    assert arx.core.dials == []
    r = arx.client.post("/arx/api/v1/auth/session")
    assert r.status_code == 401 and r.json()["code"] == "remote_login_required"


def test_a_token_ha_refuses_is_remembered(arx):
    forged = make_jwt(time.time() + 600)
    for _ in range(2):
        r = arx.client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {forged}"})
        assert r.status_code == 401
    assert len(arx.core.dials) == 1  # the negative cache answered the second attempt


def test_rate_limit_per_address(arx, monkeypatch):
    monkeypatch.setattr(hua, "IP_LIMITS", [(60.0, 3)])
    arx.flag("u-viewer")
    codes = [arx.login(arx.viewer, **{"CF-Connecting-IP": "198.51.100.1"}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    assert arx.login(arx.viewer, **{"CF-Connecting-IP": "198.51.100.2"}).status_code == 200  # another address
    assert arx.audit("auth.remote_session.rejected")[-1]["reason"] == "rate_limited_ip"


def test_rate_limit_per_user(arx, monkeypatch):
    monkeypatch.setattr(hua, "USER_LIMITS", [(60.0, 2)])
    arx.flag("u-viewer")
    codes = [arx.login(arx.viewer, **{"CF-Connecting-IP": f"198.51.100.{i}"}).status_code for i in range(3)]
    assert codes == [200, 200, 429]


def test_logout_ends_the_session(arx):
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    assert arx.client.get("/arx/api/v1/me").status_code == 200
    r = arx.client.delete("/arx/api/v1/auth/session")
    assert r.status_code == 204 and "arx_session=" in r.headers.get("set-cookie", "")
    assert arx.client.get("/arx/api/v1/me").status_code == 401
    assert arx.audit("auth.remote_session.logout")[-1]["actor_user_id"] == "u-viewer"
    assert hua.STORE.count() == 0


def test_every_exchange_rotates_the_session_id(arx):
    arx.flag("u-viewer")
    a = arx.login(arx.viewer).cookies.get("arx_session")
    b = arx.login(arx.viewer).cookies.get("arx_session")
    assert a and b and a != b


def test_session_ends_with_its_access_token(arx):
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    for s in list(hua.STORE._sessions.values()):
        s.token_exp = time.time() - 1
    assert arx.client.get("/arx/api/v1/me").status_code == 401


def test_revalidation_drops_a_revoked_session_within_a_pass(arx):
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    arx.core.revoke_user("u-viewer")  # the "…/arx/" refresh token deleted in the HA profile
    for s in hua.STORE._sessions.values():
        s.last_validated -= hua.REVALIDATE_EVERY_S + 1
    dropped = asyncio.run(hua.revalidate_once(arx.db, arx.settings))
    assert dropped == 1
    assert arx.client.get("/arx/api/v1/me").status_code == 401
    assert arx.audit("auth.remote_session.revoked")[-1]["reason"] == "token_revoked"


def test_revalidation_applies_the_policy(arx):
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    arx.flag("u-viewer", False)
    for s in hua.STORE._sessions.values():
        s.last_validated -= hua.REVALIDATE_EVERY_S + 1
    assert asyncio.run(hua.revalidate_once(arx.db, arx.settings)) == 1
    assert arx.audit("auth.remote_session.revoked")[-1]["reason"] == "remote_not_allowed"


def test_idle_sessions_are_not_revalidated(arx):
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    dials = len(arx.core.dials)
    for s in hua.STORE._sessions.values():
        s.last_validated -= hua.REVALIDATE_EVERY_S + 1
        s.last_used -= hua.ACTIVE_WINDOW_S + 1
    asyncio.run(hua.revalidate_once(arx.db, arx.settings))
    assert len(arx.core.dials) == dials


def test_bearer_requests_map_to_the_same_principal(arx):
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    token = arx.token(arx.viewer)
    fresh = TestClient(arx.app)  # no cookie
    r = fresh.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["user"]["id"] == "u-viewer" and r.json()["user"]["source"] == "remote"
    assert fresh.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {make_jwt(time.time() + 60)}"}).status_code == 401
    # the local channel never takes a bearer token as an identity
    local = TestClient(create_app(dataclasses.replace(arx.settings, dev_user=None)))
    assert local.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"}).json()["code"] == "untrusted_origin"


def test_remote_sign_in_never_bootstraps_the_admin(arx):
    """bootstrap_admin_username = joni (the test settings) and HA's joni signs in remotely: no system_admin grant."""
    arx.flag("u-owner")
    assert arx.login(arx.owner).status_code == 200
    me = arx.client.get("/arx/api/v1/me").json()
    assert me["bootstrap_state"] == "pending" and me["bindings"] == []
    assert arx.audit("rbac.bootstrap_admin") == []


def test_websocket_checks_origin_and_session(arx):
    from starlette.websockets import WebSocketDisconnect

    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    assert arx.login(arx.viewer).status_code == 200
    with pytest.raises(WebSocketDisconnect):
        with arx.client.websocket_connect("/arx/api/v1/me/ws", headers={"Origin": "https://evil.example"}) as ws:
            ws.receive_text()
    bare = TestClient(arx.app)
    bare.cookies.update(arx.client.cookies)
    with pytest.raises(WebSocketDisconnect):
        with bare.websocket_connect("/arx/api/v1/me/ws") as ws:  # the cookie without any Origin
            ws.receive_text()
    with arx.client.websocket_connect("/arx/api/v1/me/ws", headers=ORIGIN) as ws:
        hello = json.loads(ws.receive_text())
        assert hello["type"] == "hello"


def test_revoked_session_closes_its_websocket(arx):
    from starlette.websockets import WebSocketDisconnect

    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    assert arx.login(arx.viewer).status_code == 200
    with arx.client.websocket_connect("/arx/api/v1/me/ws", headers=ORIGIN) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"
        assert arx.client.delete("/arx/api/v1/auth/session").status_code == 204
        with pytest.raises(WebSocketDisconnect) as exc:
            for _ in range(5):
                ws.receive_text()
        assert exc.value.code == 4401


def test_remote_access_flag_endpoint(arx):
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    # the local (developer identity) admin toggles the flag: system.configure, audited, sessions end at once
    admin = TestClient(arx.app)
    arx.bind("dev-joni", "system_admin")
    users = {u["id"]: u for u in admin.get("/api/v1/identity/users").json()["users"]}
    assert users["u-viewer"]["remote_access"] is True and users["u-owner"]["remote_access"] is False
    r = admin.put("/api/v1/access/users/u-viewer/remote-access", json={"enabled": False})
    assert r.status_code == 200 and r.json()["sessions_ended"] == 1
    assert arx.client.get("/arx/api/v1/me").status_code == 401
    assert json.loads(arx.audit("remote.access_flag")[-1]["details_json"]) == {"before": True, "after": False, "sessions_ended": 1}
    assert admin.put("/api/v1/access/users/nobody/remote-access", json={"enabled": True}).status_code == 404
    arx.bind("dev-dana", "viewer")
    assert admin.put("/api/v1/access/users/u-owner/remote-access", json={"enabled": True}, headers={"X-SW-Dev-User": "dana"}).status_code == 403


def test_remote_settings_are_validated(arx):
    admin = TestClient(arx.app)
    arx.bind("dev-joni", "system_admin")
    s = admin.get("/api/v1/settings").json()["settings"]
    assert s["remote.policy"] == "flag" and s["remote.session"] == "rolling_90d" and s["remote.idle_lock_minutes"] == 720
    assert s["remote.default_profile"] == "main" and s["remote.mse_fallback"] == "true" and s["remote.require_mfa_admin"] == "false"
    ok = admin.patch("/api/v1/settings", json={"remote.policy": "any_role", "remote.session": "rolling_90d_idle_lock", "remote.idle_lock_minutes": 30})
    assert ok.status_code == 200
    for bad in ({"remote.policy": "all"}, {"remote.idle_lock_minutes": 2}, {"remote.session": "forever"}, {"remote.default_profile": "hd"}):
        assert admin.patch("/api/v1/settings", json=bad).status_code == 422


def test_remote_config_is_public_on_the_remote_channel_only(arx):
    r = arx.client.get("/arx/api/v1/auth/remote-config")
    assert r.status_code == 200 and r.json() == {"path": "/arx/", "session": "rolling_90d", "idle_lock_minutes": 720}
    assert TestClient(arx.app).get("/api/v1/auth/remote-config").status_code == 404
    assert TestClient(arx.app).post("/api/v1/auth/session", headers={"Authorization": "Bearer x.y.z"}).status_code == 404


# every route of the app, reached on the remote channel without a session, is refused (CR-008 §3e.2)
# config; an idempotent sign-out; the CSP report sink (CR-008 P2: counters only, rate-limited, bounded)
PUBLIC_ON_REMOTE = {("GET", "/api/v1/auth/remote-config"), ("DELETE", "/api/v1/auth/session"), ("POST", "/api/v1/csp-report")}
BLOCKED_ON_REMOTE = {("POST", "/api/v1/ha/bridge/ping"), ("POST", "/api/v1/ha/bridge/directory")}  # 404: the bridge's signed calls


def test_every_route_needs_a_remote_session(arx):
    from fastapi.routing import APIRoute, APIWebSocketRoute
    from starlette.websockets import WebSocketDisconnect

    from test_plan_routes_unique import _routers

    fresh = TestClient(arx.app)
    leaks = []
    checked = 0
    routes = [r for router in _routers().values() for r in router.routes]
    for route in routes:
        full = "/api/v1" + route.path
        path = "/".join("x" if seg.startswith("{") else seg for seg in full.split("/"))
        if isinstance(route, APIRoute):
            for method in sorted(route.methods - {"HEAD"}):
                if (method, full) in PUBLIC_ON_REMOTE:
                    continue
                checked += 1
                r = fresh.request(method, "/arx" + path, headers={"X-Remote-User-Id": "u-owner", "X-SW-Dev-User": "joni"})
                if r.status_code != (404 if (method, full) in BLOCKED_ON_REMOTE else 401):
                    leaks.append((method, full, r.status_code))
        elif isinstance(route, APIWebSocketRoute):
            checked += 1
            try:
                with fresh.websocket_connect("/arx" + path, headers=ORIGIN) as ws:
                    ws.receive_text()
                leaks.append(("WS", route.path, "accepted"))
            except WebSocketDisconnect:
                pass
    assert checked > 200
    assert leaks == [], leaks


# ---------------------------------------------------------------- security review round 1 (B1, M2, M3, M4, V1)

def _rotate_signing_key(client, **headers):
    return client.post("/arx/api/v1/evidence/signing/rotate", content=b"x", headers={"Content-Type": "text/plain", **headers})


@pytest.fixture()
def arx_admin(arx):
    arx.flag("u-owner")
    arx.bind("u-owner", "system_admin")
    assert arx.login(arx.owner).status_code == 200
    return arx


def test_csrf_foreign_origin_with_the_cookie_is_refused(arx_admin):
    arx = arx_admin
    r = _rotate_signing_key(arx.client, Origin="https://evil.example.com")
    assert r.status_code == 403 and r.json()["code"] == "csrf_refused"
    r = _rotate_signing_key(arx.client, **{"Sec-Fetch-Site": "same-site", "Origin": "http://testserver"})
    assert r.status_code == 403, "Sec-Fetch-Site wins over a matching Origin"
    row = arx.audit("auth.remote_csrf_refused")[0]
    assert row["actor_user_id"] == "u-owner" and json.loads(row["details_json"])["origin"] == "https://evil.example.com"
    assert arx.audit("evidence.signing.rotate") == [] or all(a["decision"] != "allowed" for a in arx.audit("evidence.signing.rotate"))


def test_csrf_cookie_without_origin_or_fetch_metadata_is_refused(arx_admin):
    arx = arx_admin
    bare = TestClient(arx.app)  # no Origin, no Sec-Fetch-Site
    bare.cookies.update(arx.client.cookies)
    assert _rotate_signing_key(bare).status_code == 403
    assert bare.delete("/arx/api/v1/auth/session").status_code == 403
    assert bare.get("/arx/api/v1/me").status_code == 200, "safe methods need no proof of origin"


def test_csrf_same_origin_passes(arx_admin):
    arx = arx_admin
    assert _rotate_signing_key(arx.client).status_code not in (401, 403)  # Origin http://testserver (the fixture's default)
    fresh = TestClient(arx.app)
    fresh.cookies.update(arx.client.cookies)
    assert _rotate_signing_key(fresh, **{"Sec-Fetch-Site": "same-origin"}).status_code not in (401, 403)
    assert _rotate_signing_key(fresh, Origin="https://testserver", **{"X-Forwarded-Proto": "https"}).status_code not in (401, 403)
    assert _rotate_signing_key(fresh, Origin="http://testserver.evil.com").status_code == 403


def test_csrf_bearer_only_requests_are_exempt(arx):
    arx.flag("u-owner")
    arx.bind("u-owner", "system_admin")
    token = arx.token(arx.owner)
    r = _rotate_signing_key(TestClient(arx.app), Authorization=f"Bearer {token}", Origin="https://elsewhere.example")
    assert r.status_code not in (401, 403), r.text


def test_rotation_ends_the_previous_session(arx):
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    old = arx.client.cookies.get("arx_session")
    assert arx.login(arx.viewer).status_code == 200  # the browser re-exchanges with its cookie
    new = arx.client.cookies.get("arx_session")
    assert old != new and hua.STORE.count() == 1
    stale = TestClient(arx.app)
    stale.cookies.set("arx_session", old)
    assert stale.get("/arx/api/v1/me").status_code == 401
    assert arx.client.get("/arx/api/v1/me").status_code == 200


def test_rotation_keeps_open_websockets(arx):
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    assert arx.login(arx.viewer).status_code == 200
    with arx.client.websocket_connect("/arx/api/v1/me/ws", headers=ORIGIN) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"
        assert arx.login(arx.viewer).status_code == 200
        asyncio.run(hua._close_sockets())
        assert list(hua.STORE._sockets.values())[0], "the socket moved to the new session"


def test_logout_ends_every_session_of_the_chain(arx):
    arx.flag("u-viewer")
    assert arx.login(arx.viewer).status_code == 200
    other = TestClient(arx.app, headers=ORIGIN)  # another browser of the same user
    assert other.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {arx.token(arx.viewer)}"}).status_code == 200
    assert arx.login(arx.viewer).status_code == 200
    assert hua.STORE.count() == 2
    assert arx.client.delete("/arx/api/v1/auth/session").status_code == 204
    assert hua.STORE.count() == 1 and other.get("/arx/api/v1/me").status_code == 200  # the other browser stays


def test_flag_off_forgets_cached_bearer_principals(arx):
    arx.flag("u-viewer")
    token = arx.token(arx.viewer)
    api = TestClient(arx.app)
    assert api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    admin = TestClient(arx.app)
    arx.bind("dev-joni", "system_admin")
    assert admin.put("/api/v1/access/users/u-viewer/remote-access", json={"enabled": False}).status_code == 200
    r = api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403 and r.json()["code"] == "remote_not_allowed"
    row = arx.audit("auth.remote_session.rejected")[-1]
    assert row["reason"] == "remote_not_allowed" and json.loads(row["details_json"])["via"] == "bearer"


def test_bearer_path_limits_per_user(arx, monkeypatch):
    monkeypatch.setattr(hua, "USER_LIMITS", [(60.0, 2)])
    arx.flag("u-viewer")
    api = TestClient(arx.app)
    codes = [api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(arx.viewer)}", "CF-Connecting-IP": f"198.51.100.{i}"}).status_code for i in range(3)]
    assert codes == [200, 200, 429]
    assert arx.audit("auth.remote_session.rejected")[-1]["reason"] == "rate_limited_user"


def test_websocket_accepts_a_bearer_without_cookie(arx):
    arx.flag("u-viewer")
    arx.bind("u-viewer", "viewer")
    with TestClient(arx.app).websocket_connect("/arx/api/v1/me/ws", headers={"Authorization": f"Bearer {arx.token(arx.viewer)}"}) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"


def test_remote_user_controls_a_light(settings, tmp_path, monkeypatch):
    """Security review M4: device control is the owner's main remote use - the remote principal acts through the bridge
    exactly like an Ingress one (signed with the HA user id), and the audit says channel=remote."""
    from smplwise.services import ha_bridge, ha_client, ha_sync

    states = [{"entity_id": "light.lobby", "state": "off", "attributes": {"friendly_name": "Lobby light", "supported_features": 44},
               "last_changed": "2026-09-15T10:00:00+00:00", "last_updated": "2026-09-15T10:00:00+00:00"}]
    monkeypatch.setattr(ha_client, "get_states", lambda _s: states)
    arx = Arx(settings, tmp_path, monkeypatch, ha_url="http://ha.local:8123", ha_token="t")
    try:
        ha_sync.STATE.connected = True
        ha_sync.snapshot(arx.app.state.db, arx.settings)
        admin = TestClient(arx.app)
        secret = admin.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
        admin.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.2.5"}))
        calls = []

        def fake_execute(_settings, payload, timeout=15.0):
            calls.append(ha_bridge.verify(secret, payload) or payload)
            return {"ok": True, "context_id": "ctx"}

        monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
        arx.flag("u-viewer")
        arx.bind("u-viewer", "operator")
        assert arx.login(arx.viewer).status_code == 200
        body = {"allowed_action_id": "light.turn_on", "arguments": {"brightness_pct": 40}, "expected_state_version": None, "confirmation_grant": None,
                "client_request_id": "arx-1", "expires_at": "2099-01-01T00:00:00Z"}
        r = arx.client.post("/arx/api/v1/ha/entities/light.lobby/actions", json=body)
        assert r.status_code == 202, r.text
        assert calls[-1]["user_id"] == "u-viewer" and calls[-1]["data"]["entity_id"] == "light.lobby"
        rows = [a for a in arx.audit("ha.action") if a["actor_user_id"] == "u-viewer"]
        assert rows and all(json.loads(a["details_json"])["channel"] == "remote" for a in rows)
        # a viewer without control is still refused, remote or not
        arx.flag("u-mfa")
        arx.bind("u-mfa", "viewer")
        assert arx.login(arx.mfa).status_code == 200
        assert arx.client.post("/arx/api/v1/ha/entities/light.lobby/actions", json={**body, "client_request_id": "arx-2"}).status_code == 403
    finally:
        hua.reset_for_tests()


def test_fake_login_flow_mirrors_ha_schemas():
    """V1: the fake refuses what HA core's login_flow / token views refuse (schemas read from HA core dev on
    2026-09-29), so the Playwright run against it proves the Arx client's requests are accepted."""
    core = FakeHaCore()
    base = {"client_id": "http://t/arx/", "handler": ["homeassistant", None], "redirect_uri": "http://t/arx/?auth_callback=1"}
    ch = "A" * 43
    assert core.start_flow({**base, "code_challenge": ch, "code_challenge_method": "S256"})[0] == 200
    assert core.start_flow({**base, "state": "x"})[0] == 400  # extra keys are refused
    assert core.start_flow({**base, "code_challenge": ch})[0] == 400  # a challenge without S256
    assert core.start_flow({**base, "code_challenge": ch, "code_challenge_method": "plain"})[0] == 400
    assert core.start_flow({**base, "code_challenge": "short", "code_challenge_method": "S256"})[0] == 400
    assert core.start_flow({**base, "handler": ["homeassistant"]})[0] == 400  # exactly two items
    assert core.start_flow({k: v for k, v in base.items() if k != "redirect_uri"})[0] == 400


def test_the_built_ui_contains_no_secrets():
    from pathlib import Path

    import re

    jwt = re.compile(r"eyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}\.")
    www = Path(__file__).resolve().parents[2] / "www"
    files = [f for f in www.rglob("*") if f.suffix in (".js", ".html", ".css", ".json")]
    assert files
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        assert not jwt.search(text), f"a JWT-shaped token in {f.name}"
        assert "sk-" + "proj-" not in text and "Bearer ey" not in text, f.name
