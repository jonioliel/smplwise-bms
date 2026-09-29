"""CR-008 P2 (SmplWise Arx remote-access hardening): the remote sessions list and its revocations, bearer sessions,
the per-user flag's impact, the audit channel filters, the per-session live cap and the CSP report endpoint."""
from __future__ import annotations

import asyncio
import json
import time

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from smplwise.services import ha_user_auth as hua
from test_remote_access import ORIGIN, Arx


@pytest.fixture()
def arx(settings, tmp_path, monkeypatch):
    a = Arx(settings, tmp_path, monkeypatch)
    a.flag("u-viewer")
    a.bind("u-viewer", "viewer")
    a.flag("u-owner")
    a.bind("u-owner", "system_admin")
    a.bind("dev-joni", "system_admin")  # the local (developer identity) administrator
    yield a
    hua.reset_for_tests()


def browser(arx: Arx, **headers) -> TestClient:
    return TestClient(arx.app, headers={**ORIGIN, **headers})


def sign_in(client: TestClient, arx: Arx, user, **headers):
    r = client.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {arx.token(user)}", **headers})
    assert r.status_code == 200, r.text
    return r


def next_token(arx: Arx, refresh_token: str) -> str:
    """A fresh access token of the same HA sign-in (what the browser's refresh does)."""
    status, body = arx.core.token({"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": "http://testserver/arx/"})
    assert status == 200
    return body["access_token"]


CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"
SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"


# ---------------------------------------------------------------- 1. the sessions list

def test_helpers_mask_and_family():
    assert hua.mask_address("203.0.113.77") == "203.0.113.0/24"
    assert hua.mask_address("2001:db8:1234:5678::1") == "2001:db8:1234::/48"
    assert hua.mask_address("not-an-ip") == ""
    assert hua.agent_family(CHROME_ANDROID) == "Chrome · Android"
    assert hua.agent_family(SAFARI_IOS) == "Safari · iOS"
    assert hua.agent_family("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/129.0") == "Edge · Windows"


def test_sessions_list_is_own_unless_admin(arx):
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer, **{"CF-Connecting-IP": "203.0.113.77", "CF-IPCountry": "IL", "User-Agent": CHROME_ANDROID})
    laptop = browser(arx)
    sign_in(laptop, arx, arx.viewer, **{"CF-Connecting-IP": "198.51.100.9", "User-Agent": SAFARI_IOS})
    owner = browser(arx)
    sign_in(owner, arx, arx.owner)

    r = phone.get("/arx/api/v1/auth/sessions", headers={"CF-Connecting-IP": "203.0.113.77", "CF-IPCountry": "IL", "User-Agent": CHROME_ANDROID})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["scope"] == "own" and body["can_manage"] is False and body["channel"] == "remote"
    rows = body["sessions"]
    assert {x["user_id"] for x in rows} == {"u-viewer"} and len(rows) == 2
    mine = next(x for x in rows if x["current"])
    assert mine["address"] == "203.0.113.0/24" and mine["country"] == "IL" and mine["agent"] == "Chrome · Android" and mine["channel"] == "cookie"
    other = next(x for x in rows if not x["current"])
    assert other["address"] == "198.51.100.0/24" and other["country"] is None and other["agent"] == "Safari · iOS"
    # the id is a hash of the sign-in, never the cookie value
    cookie = phone.cookies.get("arx_session")
    assert all(len(x["id"]) == 20 and x["id"] not in cookie and cookie not in json.dumps(body) for x in rows)
    assert set(mine) >= {"id", "user_id", "username", "created_at", "last_seen_at", "address", "country", "agent", "channel", "current", "live_streams"}

    # a viewer may not list everyone's (403, audited as a refusal)
    assert phone.get("/arx/api/v1/auth/sessions?scope=all").status_code == 403
    # an administrator sees all sign-ins, remotely and through the local channel
    assert {x["user_id"] for x in owner.get("/arx/api/v1/auth/sessions?scope=all").json()["sessions"]} == {"u-viewer", "u-owner"}
    local = TestClient(arx.app).get("/api/v1/auth/sessions?scope=all").json()
    assert local["channel"] == "local" and len(local["sessions"]) == 3 and not any(x["current"] for x in local["sessions"])
    # a rotation (the browser's refresh) stays ONE row, with its first sign-in time
    before = next(x for x in phone.get("/arx/api/v1/auth/sessions").json()["sessions"] if x["current"])
    sign_in(phone, arx, arx.viewer)
    after = next(x for x in phone.get("/arx/api/v1/auth/sessions").json()["sessions"] if x["current"])
    assert after["id"] == before["id"] and after["created_at"] == before["created_at"]
    assert len(phone.get("/arx/api/v1/auth/sessions").json()["sessions"]) == 2


def test_revoke_one_session_closes_its_websocket_and_blocks_the_sign_in(arx):
    tokens = arx.core.issue("u-viewer")
    phone = browser(arx)
    assert phone.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {tokens['access_token']}"}).status_code == 200
    sid = next(x["id"] for x in phone.get("/arx/api/v1/auth/sessions").json()["sessions"])
    with phone.websocket_connect("/arx/api/v1/me/ws", headers=ORIGIN) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"
        # the administrator (local channel, same test client) revokes the phone's sign-in
        r = phone.delete(f"/api/v1/auth/sessions/{sid}")
        assert r.status_code == 200, r.text
        assert r.json() == {"sessions_ended": 1, "ha_sign_ins_ended": 0, "current_ended": False}
        with pytest.raises(WebSocketDisconnect) as exc:
            for _ in range(5):
                ws.receive_text()
        assert exc.value.code == 4401
    assert phone.get("/arx/api/v1/me").status_code == 401
    # the browser's refresh gives a fresh access token of the same sign-in: refused, it must sign in again
    r = phone.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {next_token(arx, tokens['refresh_token'])}"})
    assert r.status_code == 401 and r.json()["code"] == "remote_session_revoked" and "נותקה" in r.json()["user_message"]
    # an administrator's revoke ends the Arx access only: the HA sign-in itself is left to HA
    assert arx.core.deleted_refresh == [] and arx.core.refresh_tokens_of("u-viewer")
    # a new sign-in (a new refresh token) works
    sign_in(phone, arx, arx.viewer)
    row = arx.audit("auth.remote_session.revoked")[-1]
    details = json.loads(row["details_json"])
    assert row["actor_user_id"] == "dev-joni" and row["resource_id"] == "u-viewer" and row["reason"] == "revoked_by_admin" and row["decision"] == "allowed"
    assert details["sessions"] == 1 and details["ids"] == [sid]


def test_a_user_revokes_own_sessions_only(arx):
    phone, laptop, owner = browser(arx), browser(arx), browser(arx)
    sign_in(phone, arx, arx.viewer)
    sign_in(laptop, arx, arx.viewer)
    sign_in(owner, arx, arx.owner)
    owner_sid = owner.get("/arx/api/v1/auth/sessions").json()["sessions"][0]["id"]
    r = phone.delete(f"/arx/api/v1/auth/sessions/{owner_sid}")
    assert r.status_code == 403
    assert owner.get("/arx/api/v1/me").status_code == 200
    laptop_sid = next(x["id"] for x in phone.get("/arx/api/v1/auth/sessions").json()["sessions"] if not x["current"])
    r = phone.delete(f"/arx/api/v1/auth/sessions/{laptop_sid}")
    assert r.status_code == 200 and r.json()["current_ended"] is False and r.json()["ha_sign_ins_ended"] == 1  # own: HA sign-in too
    assert laptop.get("/arx/api/v1/me").status_code == 401 and phone.get("/arx/api/v1/me").status_code == 200
    assert phone.delete("/arx/api/v1/auth/sessions/" + "0" * 20).status_code == 404
    assert phone.delete("/arx/api/v1/auth/sessions/not-an-id").status_code == 404
    assert arx.audit("auth.remote_session.revoked")[-1]["reason"] == "revoked_by_user"


def test_sign_out_everywhere(arx):
    phone, laptop = browser(arx), browser(arx)
    sign_in(phone, arx, arx.viewer)
    sign_in(laptop, arx, arx.viewer)
    api = TestClient(arx.app)
    assert api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(arx.viewer)}"}).status_code == 200  # a bearer client
    owner = browser(arx)
    sign_in(owner, arx, arx.owner)
    assert len(phone.get("/arx/api/v1/auth/sessions").json()["sessions"]) == 3
    r = phone.delete("/arx/api/v1/auth/sessions")
    assert r.status_code == 200, r.text
    assert r.json() == {"sessions_ended": 3, "ha_sign_ins_ended": 3, "current_ended": True}
    assert "arx_session=" in r.headers.get("set-cookie", "")  # this browser's cookie is cleared too
    assert laptop.get("/arx/api/v1/me").status_code == 401 and phone.get("/arx/api/v1/me").status_code == 401
    assert arx.core.refresh_tokens_of("u-viewer") == []  # every HA sign-in of the user ended (their own request)
    assert owner.get("/arx/api/v1/me").status_code == 200  # nobody else's
    row = arx.audit("auth.remote_session.revoked")[-1]
    assert row["reason"] == "signed_out_everywhere" and json.loads(row["details_json"])["sessions"] == 3


def test_admin_ends_every_session_of_a_user(arx):
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    owner = browser(arx)
    sign_in(owner, arx, arx.owner)
    assert phone.delete("/arx/api/v1/auth/sessions?user_id=u-owner").status_code == 403
    r = owner.delete("/arx/api/v1/auth/sessions?user_id=u-viewer")
    assert r.status_code == 200 and r.json()["sessions_ended"] == 1 and r.json()["current_ended"] is False
    assert phone.get("/arx/api/v1/me").status_code == 401 and owner.get("/arx/api/v1/me").status_code == 200
    assert arx.audit("auth.remote_session.revoked")[-1]["reason"] == "revoked_all_by_admin"


# ---------------------------------------------------------------- 1b. bearer sessions (the security review's nit)

def test_bearer_requests_are_one_listed_session_per_sign_in(arx):
    tokens = arx.core.issue("u-viewer")
    api = TestClient(arx.app)
    ua = {"User-Agent": "SmplWiseArx/1.0"}
    for token in (tokens["access_token"], next_token(arx, tokens["refresh_token"])):
        assert api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {token}", **ua}).status_code == 200
    rows = api.get("/arx/api/v1/auth/sessions", headers={"Authorization": f"Bearer {tokens['access_token']}", **ua}).json()["sessions"]
    assert len(rows) == 1 and rows[0]["channel"] == "bearer" and rows[0]["current"] is True and rows[0]["agent"] == "SmplWiseArx"
    assert len(arx.audit("auth.remote_session.created")) == 1  # the next access token is not a new sign-in


def test_revoking_a_bearer_session_closes_its_websocket(arx):
    tokens = arx.core.issue("u-viewer")
    api = TestClient(arx.app)
    bearer = {"Authorization": f"Bearer {tokens['access_token']}"}
    with api.websocket_connect("/arx/api/v1/me/ws", headers=bearer) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"
        rows = api.get("/api/v1/auth/sessions?scope=all").json()["sessions"]  # the local administrator
        assert [x["channel"] for x in rows] == ["bearer"]
        assert api.delete(f"/api/v1/auth/sessions/{rows[0]['id']}").status_code == 200
        with pytest.raises(WebSocketDisconnect) as exc:
            for _ in range(5):
                ws.receive_text()
        assert exc.value.code == 4401
    r = api.get("/arx/api/v1/me", headers=bearer)
    assert r.status_code == 401
    r = api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {next_token(arx, tokens['refresh_token'])}"})
    assert r.status_code == 401 and r.json()["code"] == "remote_session_revoked"
    rejected = arx.audit("auth.remote_session.rejected")[-1]
    assert rejected["reason"] == "remote_session_revoked" and json.loads(rejected["details_json"])["via"] == "bearer"


def test_bearer_actions_are_audited_as_bearer(arx):
    arx.bind("u-viewer", "system_admin")
    api = TestClient(arx.app)
    bearer = {"Authorization": f"Bearer {arx.token(arx.viewer)}"}
    assert api.patch("/arx/api/v1/settings", json={"remote.idle_lock_minutes": 60}, headers=bearer).status_code == 200
    details = json.loads(arx.audit("settings.update")[-1]["details_json"])
    assert details["channel"] == "remote" and details["via"] == "bearer"


def test_revalidation_covers_bearer_sessions(arx):
    api = TestClient(arx.app)
    assert api.get("/arx/api/v1/me", headers={"Authorization": f"Bearer {arx.token(arx.viewer)}"}).status_code == 200
    arx.core.revoke_user("u-viewer")
    for s in hua.STORE._sessions.values():
        s.last_validated -= hua.REVALIDATE_EVERY_S + 1
    assert asyncio.run(hua.revalidate_once(arx.db, arx.settings)) == 1
    assert hua.STORE.count() == 0
    assert json.loads(arx.audit("auth.remote_session.revoked")[-1]["details_json"])["via"] == "bearer"


def test_revoked_chains_survive_a_restart(arx):
    tokens = arx.core.issue("u-viewer")
    phone = browser(arx)
    assert phone.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {tokens['access_token']}"}).status_code == 200
    assert phone.delete("/api/v1/auth/sessions?user_id=u-viewer").status_code == 200
    hua.reset_for_tests()  # the in-memory store and caches are gone, the database remembers
    r = phone.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {next_token(arx, tokens['refresh_token'])}"})
    assert r.status_code == 401 and r.json()["code"] == "remote_session_revoked"
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM remote_revoked_chains").fetchone()
    assert row["user_id"] == "u-viewer" and row["reason"] == "revoked_all_by_admin" and len(row["iss_hash"]) == 64
    assert tokens["refresh_token"][:12] not in json.dumps(dict(row))


# ---------------------------------------------------------------- 2. the roles screen: flag, last sign-in, active count

def test_directory_shows_remote_sign_ins_and_the_flag_impact(arx):
    admin = TestClient(arx.app)  # the local administrator (dev-joni)
    users = {u["id"]: u for u in admin.get("/api/v1/identity/users").json()["users"]}
    assert users["u-viewer"]["remote_sessions"] == 0 and users["u-viewer"]["remote_last_sign_in"] is None
    phone, laptop = browser(arx), browser(arx)
    sign_in(phone, arx, arx.viewer)
    sign_in(laptop, arx, arx.viewer)
    sign_in(phone, arx, arx.viewer)  # a rotation is not a new sign-in
    body = admin.get("/api/v1/identity/users").json()
    assert body["remote_policy"] == "flag"
    viewer = {u["id"]: u for u in body["users"]}["u-viewer"]
    assert viewer["remote_access"] is True and viewer["remote_sessions"] == 2 and viewer["remote_last_sign_in"]
    with arx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT sign_ins FROM remote_sign_ins WHERE user_id = 'u-viewer'").fetchone()[0] == 2

    # turning the flag off ends both sign-ins and closes their WebSockets in the same request
    with phone.websocket_connect("/arx/api/v1/me/ws", headers=ORIGIN) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"
        r = phone.put("/api/v1/access/users/u-viewer/remote-access", json={"enabled": False})  # same client: the local admin
        assert r.status_code == 200 and r.json()["sessions_ended"] == 2
        with pytest.raises(WebSocketDisconnect) as exc:
            for _ in range(5):
                ws.receive_text()
        assert exc.value.code == 4401
    assert json.loads(arx.audit("remote.access_flag")[-1]["details_json"]) == {"before": True, "after": False, "sessions_ended": 2}
    viewer = {u["id"]: u for u in admin.get("/api/v1/identity/users").json()["users"]}["u-viewer"]
    assert viewer["remote_sessions"] == 0 and viewer["remote_last_sign_in"]


def test_audit_channel_filters_and_remote_views(arx, monkeypatch):
    admin = TestClient(arx.app)  # dev-joni (system_admin: audit.read)
    assert admin.patch("/api/v1/settings", json={"remote.idle_lock_minutes": 30}).status_code == 200  # a local change
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    owner = browser(arx)
    sign_in(owner, arx, arx.owner)
    assert owner.patch("/arx/api/v1/settings", json={"remote.idle_lock_minutes": 40}).status_code == 200  # a remote change
    api = TestClient(arx.app)
    arx.bind("u-viewer", "system_admin")
    assert api.patch("/arx/api/v1/settings", json={"remote.idle_lock_minutes": 50}, headers={"Authorization": f"Bearer {arx.token(arx.viewer)}"}).status_code == 200
    # refusals: a user without the flag, a cross-site request, a rate limit
    arx.bind("u-mfa", "viewer")
    assert arx.login(arx.mfa).status_code == 403
    assert TestClient(arx.app, headers={"Origin": "https://evil.example"}, cookies=phone.cookies).post(
        "/arx/api/v1/evidence/signing/rotate", content=b"x", headers={"Content-Type": "text/plain"}).status_code == 403
    monkeypatch.setattr(hua, "IP_LIMITS", [(60.0, 0)])
    assert arx.login(arx.viewer, **{"CF-Connecting-IP": "198.51.100.66"}).status_code == 429

    def rows(**q):
        r = admin.get("/api/v1/audit", params={"prefix": "", **q})
        assert r.status_code == 200, r.text
        return r.json()["rows"]

    settings_rows = {r["details"].get("remote.idle_lock_minutes"): r for r in rows(prefix="settings.")}
    assert set(settings_rows) >= {30, 40, 50}
    assert [r["details"]["remote.idle_lock_minutes"] for r in rows(prefix="settings.", channel="local")] == [30]
    assert sorted(r["details"]["remote.idle_lock_minutes"] for r in rows(prefix="settings.", channel="remote")) == [40, 50]
    assert [r["details"]["remote.idle_lock_minutes"] for r in rows(prefix="settings.", channel="bearer")] == [50]
    assert all(r["action"].startswith("auth.remote") or r["details"].get("channel") == "remote" for r in rows(channel="remote"))
    assert not any(r["action"].startswith("auth.remote") for r in rows(channel="local"))

    sign_ins = rows(view="remote_sign_ins")
    assert sign_ins and all(r["action"].startswith("auth.remote") for r in sign_ins)
    assert {"auth.remote_session.created", "auth.remote_session.rejected", "auth.remote_csrf_refused"} <= {r["action"] for r in sign_ins}
    refusals = rows(view="remote_refusals")
    assert refusals and all(r["decision"] == "denied" for r in refusals)
    reasons = {r["reason"] for r in refusals}
    assert {"remote_not_allowed", "csrf_refused", "rate_limited_ip"} <= reasons
    assert all(r["action"] != "settings.update" for r in refusals)
    # the quick view composes with the channel filter; bad values are refused
    assert all(r["details"].get("via") == "bearer" for r in rows(view="remote_sign_ins", channel="bearer"))
    assert admin.get("/api/v1/audit", params={"channel": "ingress"}).status_code == 422
    assert admin.get("/api/v1/audit", params={"view": "everything"}).status_code == 422
    # a viewer without audit.read gets nothing
    viewer = TestClient(arx.app, headers={"X-SW-Dev-User": "dana"})
    arx.bind("dev-dana", "viewer")
    assert viewer.get("/api/v1/audit", params={"view": "remote_refusals"}).status_code == 403


# ---------------------------------------------------------------- 4. the live-stream cap per remote sign-in

def test_remote_live_cap_per_sign_in(arx):
    from smplwise.routers import media

    admin = TestClient(arx.app)
    cam = admin.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    assert admin.get("/api/v1/settings").json()["settings"]["remote.max_live_streams"] == 4
    phone, laptop = browser(arx), browser(arx)
    sign_in(phone, arx, arx.viewer)
    sign_in(laptop, arx, arx.viewer)
    info = phone.get(f"/arx/api/v1/media/live/{cam['id']}")
    assert info.status_code == 200, info.text
    assert info.json()["remote_live"] == {"max": 4, "active": 0}
    phone_row = next(x for x in phone.get("/arx/api/v1/auth/sessions").json()["sessions"] if x["current"])
    chain = next(e["chain"] for e in hua.STORE.chains("u-viewer") if hua.public_id(e["chain"]) == phone_row["id"])
    try:
        for i in range(4):  # four streams already running under the phone's sign-in
            media.REGISTRY.sessions[f"t{i}"] = media.LiveSession(id=f"t{i}", camera_id=cam["id"], stream="s", user_id="u-viewer", username="dana", remote_chain=chain)
        r = phone.get(f"/arx/api/v1/media/live/{cam['id']}")
        assert r.status_code == 429 and r.json()["code"] == "remote_live_cap"
        assert "מכסת הזרמים החיים בגישה מרחוק" in r.json()["user_message"] and r.json()["details"] == {"max": 4, "active": 4}
        # the WebSocket start: accepted, told why in Hebrew, closed 4429 - before any upstream connection
        with phone.websocket_connect(f"/arx/api/v1/media/live/{cam['id']}/ws?profile=sub", headers=ORIGIN) as ws:
            msg = json.loads(ws.receive_text())
            assert msg["type"] == "error" and msg["value"] == "remote_live_cap" and "4 במקביל" in msg["message"]
            with pytest.raises(WebSocketDisconnect) as exc:
                ws.receive_text()
            assert exc.value.code == 4429
        denied = [a for a in arx.audit("video.live") if a["reason"] == "remote_live_cap"]
        assert len(denied) == 2 and all(json.loads(a["details_json"])["channel"] == "remote" for a in denied)
        # the sessions list and /health count them
        assert next(x for x in phone.get("/arx/api/v1/auth/sessions").json()["sessions"] if x["current"])["live_streams"] == 4
        remote = admin.get("/api/v1/health").json()["remote"]
        assert remote["live_streams"] == 4 and remote["max_live_streams_per_sign_in"] == 4 and remote["sign_ins"] == 2 and remote["cookie"] == 2
        assert "chain" not in json.dumps(remote) and chain not in json.dumps(remote)
        # another sign-in of the same user has its own budget; the local channel is not capped by it
        assert laptop.get(f"/arx/api/v1/media/live/{cam['id']}").status_code == 200
        assert admin.get(f"/api/v1/media/live/{cam['id']}").status_code == 200
        # a higher cap lets the next one through
        assert admin.patch("/api/v1/settings", json={"remote.max_live_streams": 5}).status_code == 200
        assert phone.get(f"/arx/api/v1/media/live/{cam['id']}").status_code == 200
        assert admin.patch("/api/v1/settings", json={"remote.max_live_streams": 0}).status_code == 422
    finally:
        media.REGISTRY.sessions.clear()


def test_health_remote_block_is_for_administrators_only(arx):
    arx.bind("dev-dana", "viewer")
    assert "remote" not in TestClient(arx.app, headers={"X-SW-Dev-User": "dana"}).get("/api/v1/health").json()
    assert TestClient(arx.app).get("/api/v1/health").json()["remote"]["enabled"] is True


# ---------------------------------------------------------------- 5. CSP: report-only, the report sink, enforcing

LEGACY = {"csp-report": {"document-uri": "https://example.test/arx/#/live?secret=1", "effective-directive": "style-src-elem",
                         "violated-directive": "style-src-elem", "blocked-uri": "inline", "disposition": "report",
                         "script-sample": "body{background:url(https://evil.example/x?leak=", "original-policy": "…"}}


def test_csp_headers_report_only_then_enforced(arx):
    from smplwise import remote_channel

    h = arx.client.get("/arx/").headers
    assert "style-src 'self' 'unsafe-inline'" in h["content-security-policy"]  # the enforced base policy
    ro = h["content-security-policy-report-only"]
    assert "style-src-elem 'self'" in ro and "style-src-attr 'unsafe-inline'" in ro and "'unsafe-inline'; style-src-elem" not in ro
    assert "script-src 'self'" in ro and "unsafe-inline" not in ro.split("script-src")[1].split(";")[0]
    for policy in (h["content-security-policy"], ro):
        assert "report-uri /arx/api/v1/csp-report" in policy and "report-to arx-csp" in policy
    assert h["reporting-endpoints"] == 'arx-csp="/arx/api/v1/csp-report"'
    assert "content-security-policy-report-only" not in TestClient(arx.app).get("/api/v1/me").headers  # the local channel

    admin = TestClient(arx.app)
    assert admin.patch("/api/v1/settings", json={"remote.csp_enforce": "true"}).status_code == 200
    assert remote_channel.csp_enforcing() is True
    h = arx.client.get("/arx/").headers
    assert "style-src-elem 'self'" in h["content-security-policy"] and "content-security-policy-report-only" not in h
    assert admin.get("/api/v1/csp-reports").json()["mode"] == "enforce"
    assert admin.patch("/api/v1/settings", json={"remote.csp_enforce": "maybe"}).status_code == 422
    assert admin.patch("/api/v1/settings", json={"remote.csp_enforce": "false"}).status_code == 200
    assert "content-security-policy-report-only" in arx.client.get("/arx/").headers
    # the mode follows the database after a restore (the background pass re-reads it)
    arx.setting("remote.csp_enforce", "true")
    remote_channel.load_csp_mode(arx.db)
    assert remote_channel.csp_enforcing() is True


def test_a_route_keeps_its_own_csp_on_the_remote_channel(arx):
    from fastapi.responses import PlainTextResponse

    @arx.app.get("/api/v1/_test/sandboxed")
    def sandboxed():  # like an evidence file (routers/cases.py: "sandbox; default-src 'none'")
        return PlainTextResponse("x", headers={"Content-Security-Policy": "sandbox"})

    arx.app.router.routes.insert(0, arx.app.router.routes.pop())  # ahead of the static files mount
    r = arx.client.get("/arx/api/v1/_test/sandboxed")
    policies = r.headers.get_list("content-security-policy")
    assert "sandbox" in policies and any("frame-ancestors 'self'" in p for p in policies)


def test_csp_report_sink_counts_without_content(arx):
    sink = TestClient(arx.app)  # a browser's report: no cookie needed, no identity
    r = sink.post("/arx/api/v1/csp-report", content=json.dumps(LEGACY), headers={"Content-Type": "application/csp-report"})
    assert r.status_code == 204
    batch = [{"type": "csp-violation", "age": 1, "url": "https://example.test/arx/?x=1", "body": {
        "documentURL": "https://example.test/arx/?token=abc", "effectiveDirective": "img-src", "blockedURL": "https://tracker.example/p.gif?u=dana",
        "disposition": "enforce", "sample": ""}}, {"type": "deprecation", "body": {}}]
    assert sink.post("/arx/api/v1/csp-report", content=json.dumps(batch), headers={"Content-Type": "application/reports+json"}).status_code == 204
    assert sink.post("/arx/api/v1/csp-report", content=json.dumps(LEGACY), headers={"Content-Type": "application/csp-report"}).status_code == 204
    # a report posted with the Arx cookie and no fetch metadata is still accepted (the CSRF gate exempts the sink)
    assert arx.client.post("/arx/api/v1/csp-report", content=json.dumps(LEGACY), headers={"Content-Type": "application/csp-report", "Origin": "null"}).status_code == 204

    admin = TestClient(arx.app)
    body = admin.get("/api/v1/csp-reports").json()
    rows = {(r["disposition"], r["directive"], r["blocked"]): r["count"] for r in body["rows"]}
    assert rows == {("report", "style-src-elem", "inline"): 3, ("enforce", "img-src", "https://tracker.example"): 1}
    assert body["total"] == 4 and body["mode"] == "report_only" and "style-src-elem" in body["policy"]["report_only"]
    with arx.db.connection(mode="read") as conn:
        stored = json.dumps([dict(r) for r in conn.execute("SELECT * FROM csp_reports").fetchall()])
    for secret in ("secret=1", "leak=", "token=abc", "u=dana", "p.gif", "evil.example"):
        assert secret not in stored

    # bounds: type, size, garbage, rate; remote channel only; the admin view needs system.configure
    assert sink.post("/arx/api/v1/csp-report", content=b"x", headers={"Content-Type": "text/plain"}).status_code == 415
    assert sink.post("/arx/api/v1/csp-report", content=b"{" + b" " * (17 * 1024) + b"}", headers={"Content-Type": "application/json"}).status_code == 413
    assert sink.post("/arx/api/v1/csp-report", content=b"{not json", headers={"Content-Type": "application/json"}).status_code == 400
    assert TestClient(arx.app).post("/api/v1/csp-report", content=json.dumps(LEGACY), headers={"Content-Type": "application/csp-report"}).status_code == 404
    arx.bind("dev-dana", "viewer")
    assert TestClient(arx.app, headers={"X-SW-Dev-User": "dana"}).get("/api/v1/csp-reports").status_code == 403
    r = admin.delete("/api/v1/csp-reports")
    assert r.status_code == 200 and r.json()["cleared"] == 2 and admin.get("/api/v1/csp-reports").json()["rows"] == []
    assert arx.audit("remote.csp_reports_cleared")


def test_csp_report_sink_is_rate_limited_and_row_bounded(arx, monkeypatch):
    from smplwise.routers import remote

    monkeypatch.setattr(remote, "CSP_IP_LIMITS", [(60.0, 3)])
    sink = TestClient(arx.app)
    codes = [sink.post("/arx/api/v1/csp-report", content=json.dumps(LEGACY), headers={"Content-Type": "application/csp-report", "CF-Connecting-IP": "198.51.100.3"}).status_code for _ in range(4)]
    assert codes == [204, 204, 204, 429]
    monkeypatch.setattr(remote, "CSP_IP_LIMITS", [(60.0, 1000)])
    monkeypatch.setattr(remote, "CSP_ROWS_MAX", 3)
    for i in range(6):
        report = {"csp-report": {"effective-directive": "img-src", "blocked-uri": f"https://host{i}.example/a.png", "disposition": "report"}}
        assert sink.post("/arx/api/v1/csp-report", content=json.dumps(report), headers={"Content-Type": "application/csp-report"}).status_code == 204
    with arx.db.connection(mode="read") as conn:
        rows = {(r["directive"], r["blocked"]): r["count"] for r in conn.execute("SELECT * FROM csp_reports").fetchall()}
    assert len(rows) == 4 and rows[("other", "other")] == 4  # 3 distinct counters (inline + 2 hosts), the rest in "other"


def test_sign_in_record_masks_the_address(arx):
    sign_in(browser(arx), arx, arx.viewer, **{"CF-Connecting-IP": "203.0.113.5", "CF-IPCountry": "IL"})
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM remote_sign_ins WHERE user_id = 'u-viewer'").fetchone()
    assert row["last_address"] == "203.0.113.0/24" and row["last_country"] == "IL" and row["sign_ins"] == 1
