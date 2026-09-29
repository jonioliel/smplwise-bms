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


def test_sign_in_record_masks_the_address(arx):
    sign_in(browser(arx), arx, arx.viewer, **{"CF-Connecting-IP": "203.0.113.5", "CF-IPCountry": "IL"})
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM remote_sign_ins WHERE user_id = 'u-viewer'").fetchone()
    assert row["last_address"] == "203.0.113.0/24" and row["last_country"] == "IL" and row["sign_ins"] == 1
