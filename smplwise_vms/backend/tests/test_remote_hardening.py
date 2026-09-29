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
    from smplwise.routers import media

    media._cap_audited.clear()
    yield a
    hua.reset_for_tests()
    media._cap_audited.clear()


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
    phone_tokens = arx.core.issue("u-viewer")
    r = phone.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {phone_tokens['access_token']}", "CF-Connecting-IP": "203.0.113.77",
                                                        "CF-IPCountry": "IL", "User-Agent": CHROME_ANDROID})
    assert r.status_code == 200
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
    # a rotation (the browser's refresh: a fresh access token of the same sign-in) stays ONE row, with its first sign-in time
    before = next(x for x in phone.get("/arx/api/v1/auth/sessions").json()["sessions"] if x["current"])
    assert phone.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {next_token(arx, phone_tokens['refresh_token'])}"}).status_code == 200
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

def test_remote_live_cap_per_sign_in(arx, settings):
    from smplwise.routers import media

    admin = TestClient(arx.app)
    cam = admin.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    # the default is 16 (an 11-camera wall must play whole); this test pins the cap to 4 as an administrator would
    assert admin.get("/api/v1/settings").json()["settings"]["remote.max_live_streams"] == 16
    assert admin.patch("/api/v1/settings", json={"remote.max_live_streams": 4}).status_code == 200
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
            assert msg["type"] == "error" and msg["value"] == "remote_live_cap" and "4 במקביל" in msg["message"] and msg["max"] == 4
            with pytest.raises(WebSocketDisconnect) as exc:
                ws.receive_text()
            assert exc.value.code == 4429
        denied = [a for a in arx.audit("video.live") if a["reason"] == "remote_live_cap"]
        # review L2: one audit row per sign-in per minute (the socket refusal right after the HTTP one is counted, not written)
        assert len(denied) == 1 and json.loads(denied[0]["details_json"])["channel"] == "remote"
        media._cap_audited[chain] = (time.time() - media.CAP_AUDIT_EVERY_S - 1, media._cap_audited[chain][1])
        assert phone.get(f"/arx/api/v1/media/live/{cam['id']}").status_code == 429
        denied = [a for a in arx.audit("video.live") if a["reason"] == "remote_live_cap"]
        assert len(denied) == 2 and json.loads(denied[-1]["details_json"])["suppressed"] == 1
        # the wall shows a tile beyond the cap as a snapshot: the snapshot endpoint answers on the remote channel at the
        # cap and is not a live stream (the registry and the per-sign-in count are untouched)
        folder = settings.data_dir / "snapshots"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{cam['id']}.jpg").write_bytes(b"\xff\xd8\xff\xd9")
        snap = phone.get(f"/arx/api/v1/cameras/{cam['id']}/snapshot.jpg")
        assert snap.status_code == 200 and snap.headers["content-type"] == "image/jpeg", snap.text
        assert len(media.REGISTRY.sessions) == 4 and media.remote_live_by_chain()[chain] == 4
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


def test_remote_live_cap_default_is_16_and_a_saved_value_is_kept(arx):
    """Hotfix (11-camera wall): only the DEFAULT changed. A key nobody saved reads 16; a value an administrator saved
    (also the old default 4) is read back unchanged; the validation stays 1..32."""
    from smplwise.routers.settings import DEFAULTS, read_settings

    admin = TestClient(arx.app)
    assert DEFAULTS["remote.max_live_streams"] == "16" and DEFAULTS["media.max_live_sessions"] == "16"  # the wall budget is min(both)
    assert admin.get("/api/v1/settings").json()["settings"]["media.max_live_sessions"] == 16
    assert admin.patch("/api/v1/settings", json={"media.max_live_sessions": 8}).status_code == 200  # a saved value is kept
    assert admin.get("/api/v1/settings").json()["settings"]["media.max_live_sessions"] == 8
    assert admin.patch("/api/v1/settings", json={"media.max_live_sessions": 33}).status_code == 422
    assert admin.get("/api/v1/settings").json()["settings"]["remote.max_live_streams"] == 16
    assert admin.patch("/api/v1/settings", json={"remote.max_live_streams": 4}).status_code == 200
    assert admin.get("/api/v1/settings").json()["settings"]["remote.max_live_streams"] == 4
    assert admin.patch("/api/v1/settings", json={"remote.max_live_streams": 32}).status_code == 200
    assert admin.patch("/api/v1/settings", json={"remote.max_live_streams": 33}).status_code == 422
    assert admin.patch("/api/v1/settings", json={"remote.max_live_streams": 0}).status_code == 422


def test_remote_wall_profile_setting(arx):
    """The quality the camera wall plays on the remote channel: `sub` by default, `main` on choice, nothing else;
    `media.wall_profile` (LAN / Ingress) is a separate key and is not touched."""
    admin = TestClient(arx.app)
    s = admin.get("/api/v1/settings").json()["settings"]
    assert s["remote.wall_profile"] == "sub" and s["media.wall_profile"] == "sub"
    assert admin.patch("/api/v1/settings", json={"remote.wall_profile": "main"}).status_code == 200
    s = admin.get("/api/v1/settings").json()["settings"]
    assert s["remote.wall_profile"] == "main" and s["media.wall_profile"] == "sub"
    for bad in ("hd", "", "auto"):
        assert admin.patch("/api/v1/settings", json={"remote.wall_profile": bad}).status_code == 422
    # a viewer reads it (the wall needs it) but cannot change it
    viewer = browser(arx)
    sign_in(viewer, arx, arx.viewer)
    assert viewer.get("/arx/api/v1/settings").json()["settings"]["remote.wall_profile"] == "main"
    assert viewer.patch("/arx/api/v1/settings", json={"remote.wall_profile": "sub"}).status_code == 403


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


# ---------------------------------------------------------------- 6. an idle session revoked at HA, reused before the pass

def _age(seconds: float) -> None:
    for s in hua.STORE._sessions.values():
        s.last_validated -= seconds
        s.last_used -= seconds


def test_idle_session_revoked_at_ha_gets_no_request_through(arx):
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    _age(hua.STALE_AFTER_S + 5)  # idle: the background pass never re-checked it
    arx.core.revoke_user("u-viewer")  # the refresh token deleted in the HA profile meanwhile
    dials = len(arx.core.dials)
    r = phone.get("/arx/api/v1/me")  # no background pass has run
    assert r.status_code == 401 and r.json()["code"] == "remote_token_invalid"
    assert len(arx.core.dials) == dials + 1 and hua.STORE.count() == 0
    row = arx.audit("auth.remote_session.revoked")[-1]
    assert row["reason"] == "token_revoked" and json.loads(row["details_json"])["on_reuse"] is True


def test_idle_session_reused_over_a_websocket_is_rechecked(arx):
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    _age(hua.STALE_AFTER_S + 5)
    arx.flag("u-viewer", False)  # the policy changed while it was idle
    with pytest.raises(WebSocketDisconnect):
        with phone.websocket_connect("/arx/api/v1/me/ws", headers=ORIGIN) as ws:
            ws.receive_text()
    assert arx.audit("auth.remote_session.revoked")[-1]["reason"] == "remote_not_allowed"


def test_a_fresh_or_still_valid_idle_session_is_served(arx, monkeypatch):
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    dials = len(arx.core.dials)
    assert phone.get("/arx/api/v1/me").status_code == 200 and len(arx.core.dials) == dials  # fresh: no HA call
    _age(hua.STALE_AFTER_S + 5)
    assert phone.get("/arx/api/v1/me").status_code == 200 and len(arx.core.dials) == dials + 1  # re-checked once
    assert phone.get("/arx/api/v1/me").status_code == 200 and len(arx.core.dials) == dials + 1
    _age(hua.STALE_AFTER_S + 5)

    async def away(*_a, **_k):
        raise hua.HaUnavailable("down")

    monkeypatch.setattr(hua, "validate_token", away)
    assert phone.get("/arx/api/v1/me").status_code == 200  # HA briefly away: served, as the background pass does


def test_sign_in_record_masks_the_address(arx):
    sign_in(browser(arx), arx, arx.viewer, **{"CF-Connecting-IP": "203.0.113.5", "CF-IPCountry": "IL"})
    with arx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM remote_sign_ins WHERE user_id = 'u-viewer'").fetchone()
    assert row["last_address"] == "203.0.113.0/24" and row["last_country"] == "IL" and row["sign_ins"] == 1


# ---------------------------------------------------------------- security review of P2 (M1-M4, L1-L7)

def _bearer_get(arx: Arx, token: str, path: str = "/arx/api/v1/me"):
    return TestClient(arx.app).get(path, headers={"Authorization": f"Bearer {token}"})


def test_m1_sign_out_everywhere_deletes_only_arx_sign_ins_at_ha(arx):
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)  # an Arx sign-in (client http://testserver/arx/)
    long_lived = arx.core.issue("u-viewer", client_id=None, token_type="long_lived_access_token")
    companion = arx.core.issue("u-viewer", client_id="https://home-assistant.io/iOS")
    for t in (long_lived, companion):  # both used on the bearer path
        assert _bearer_get(arx, t["access_token"]).status_code == 200
    before = set(arx.core.refresh_tokens_of("u-viewer"))
    r = phone.delete("/arx/api/v1/auth/sessions")
    assert r.status_code == 200 and r.json()["sessions_ended"] == 3 and r.json()["ha_sign_ins_ended"] == 1
    left = set(arx.core.refresh_tokens_of("u-viewer"))
    assert left == before - {t for t in before if t not in (long_lived["refresh_token"], companion["refresh_token"])}
    assert long_lived["refresh_token"] in left and companion["refresh_token"] in left  # never touched at HA
    assert len(arx.core.deleted_refresh) == 1


def test_m1_ha_down_keeps_the_local_revoke_and_answers_in_time(arx, monkeypatch):
    phone, laptop = browser(arx), browser(arx)
    sign_in(phone, arx, arx.viewer)
    sign_in(laptop, arx, arx.viewer)

    async def hanging(*_a, **_k):
        await asyncio.sleep(30)

    monkeypatch.setattr(hua, "_dial", hanging)
    monkeypatch.setattr(hua, "HA_DELETE_TIMEOUT_S", 0.5)
    started = time.monotonic()
    r = phone.delete("/arx/api/v1/auth/sessions")
    assert time.monotonic() - started < 5
    assert r.status_code == 200 and r.json()["sessions_ended"] == 2 and r.json()["ha_sign_ins_ended"] == 0
    assert laptop.get("/arx/api/v1/me").status_code == 401 and hua.STORE.count() == 0


def test_m2_a_sign_in_racing_a_revoke_is_refused(arx, monkeypatch):
    tokens = arx.core.issue("u-viewer")
    real = hua.policy_refusal
    raced = {"done": False}

    def policy_then_revoke(conn, principal, ha_user):
        if not raced["done"]:  # the administrator's revoke lands after the exchange's revoked-chain check
            raced["done"] = True
            hua.STORE.revoke_sign_ins({hua.iss_hash(tokens["access_token"])}, [])
        return real(conn, principal, ha_user)

    monkeypatch.setattr(hua, "policy_refusal", policy_then_revoke)
    r = browser(arx).post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert r.status_code == 401 and r.json()["code"] == "remote_session_revoked" and hua.STORE.count() == 0
    assert "set-cookie" not in r.headers
    # the bearer path too
    other = arx.core.issue("u-viewer")
    raced["done"] = False
    tokens = other
    r = _bearer_get(arx, other["access_token"])
    assert r.status_code == 401 and r.json()["code"] == "remote_session_revoked" and hua.STORE.count() == 0


def test_m2_revalidation_drops_a_revoked_sign_in_without_asking_ha(arx):
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    s = next(iter(hua.STORE._sessions.values()))
    hua.STORE.load_revoked({s.iss_hash})  # e.g. loaded from remote_revoked_chains at start-up
    s.last_validated -= hua.REVALIDATE_EVERY_S + 1
    dials = len(arx.core.dials)
    assert asyncio.run(hua.revalidate_once(arx.db, arx.settings)) == 1
    assert len(arx.core.dials) == dials and phone.get("/arx/api/v1/me").status_code == 401
    assert arx.audit("auth.remote_session.revoked")[-1]["reason"] == "remote_session_revoked"


def test_m2_revoked_sign_ins_load_at_start_up(arx):
    tokens = arx.core.issue("u-viewer")
    phone = browser(arx)
    assert phone.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {tokens['access_token']}"}).status_code == 200
    assert TestClient(arx.app).delete("/api/v1/auth/sessions?user_id=u-viewer").status_code == 200
    hua.reset_for_tests()
    assert hua.load_revoked(arx.db) == 1 and hua.STORE.is_revoked(hua.iss_hash(tokens["access_token"]))


def test_m2_a_socket_attached_after_its_session_vanished_is_refused(arx, monkeypatch):
    assert hua.STORE.attach_socket("no-such-session", object()) is False
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    monkeypatch.setattr(hua.STORE, "attach_socket", lambda *_a: False)  # revoked between the lookup and the attach
    with pytest.raises(WebSocketDisconnect) as exc:
        with phone.websocket_connect("/arx/api/v1/me/ws", headers=ORIGIN) as ws:
            ws.receive_text()
    assert exc.value.code == 4401


class _FakeRequest:
    def __init__(self, app):
        self.app = app
        self.headers = {"cf-connecting-ip": "198.51.100.7"}
        self.client = None


def test_m3_one_ha_call_for_concurrent_requests_of_a_stale_session(arx, monkeypatch):
    import threading

    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    s = next(iter(hua.STORE._sessions.values()))
    s.last_validated -= hua.STALE_AFTER_S + 5
    calls = []

    async def slow_ok(settings, token, ip=None):
        calls.append(time.monotonic())
        await asyncio.sleep(0.3)
        return s.ha_user

    monkeypatch.setattr(hua, "validate_token", slow_ok)
    results = []
    threads = [threading.Thread(target=lambda: results.append(hua._recheck_sync(_FakeRequest(arx.app), arx.settings, s))) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1 and len(results) == 6 and all(r is s for r in results)


def test_m3_waiters_do_not_hold_a_thread_while_ha_is_slow(arx, monkeypatch):
    """Follow-up: a request waiting for another's re-check waits at most RECHECK_WAIT_S (1 s) and is then served with
    the last-known session - a slow HA must not pin worker threads."""
    import threading

    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    s = next(iter(hua.STORE._sessions.values()))
    s.last_validated -= hua.STALE_AFTER_S + 5
    calls = []

    async def very_slow(settings, token, ip=None):
        calls.append(1)
        await asyncio.sleep(3)
        return s.ha_user

    monkeypatch.setattr(hua, "validate_token", very_slow)
    took: list[float] = []

    def one():
        t0 = time.monotonic()
        assert hua._recheck_sync(_FakeRequest(arx.app), arx.settings, s) is s
        took.append(time.monotonic() - t0)

    first = threading.Thread(target=one)
    first.start()
    time.sleep(0.2)  # the first request is now asking HA
    waiters = [threading.Thread(target=one) for _ in range(4)]
    for t in waiters:
        t.start()
    for t in waiters:
        t.join()
    assert len(took) == 4 and max(took) < 2.0 and len(calls) == 1  # served after ~1 s, no second HA call
    first.join()
    assert len(calls) == 1 and max(took) >= 2.5  # the first one did the (slow) re-check itself


def test_m3_ha_down_backs_off_for_30_seconds(arx, monkeypatch):
    phone = browser(arx)
    sign_in(phone, arx, arx.viewer)
    s = next(iter(hua.STORE._sessions.values()))
    s.last_validated -= hua.STALE_AFTER_S + 5
    calls = []

    async def down(*_a, **_k):
        calls.append(1)
        raise hua.HaUnavailable("down")

    monkeypatch.setattr(hua, "validate_token", down)
    assert phone.get("/arx/api/v1/me").status_code == 200 and len(calls) == 1  # served while HA is away
    assert phone.get("/arx/api/v1/me").status_code == 200 and len(calls) == 1  # no retry within the window
    assert s.recheck_after > time.time() + hua.HA_BACKOFF_S - 5
    s.recheck_after = time.time() - 1  # the window passed
    assert phone.get("/arx/api/v1/me").status_code == 200 and len(calls) == 2


def test_m4_no_inline_style_elements_in_the_app():
    """The strict CSP refuses inline <style> ELEMENTS (style-src-elem 'self'): the app must render none. Allowed: the
    worker's offline page (its own document, served without this policy) and the style WisKey's embed injects into HA's
    own page (another document, HA's policy)."""
    import re
    from pathlib import Path

    src = Path(__file__).resolve().parents[3] / "frontend" / "src"
    allowed = {"pwa/offline-page.ts", "screens/wiskey-embed.ts"}
    pattern = re.compile(r"<style[\s>]|createElement\(\s*['\"]style['\"]\s*\)")
    comments = re.compile(r"/\*.*?\*/|^\s*//.*$|\s//\s.*$", re.S | re.M)
    offenders = [f.relative_to(src).as_posix() for f in src.rglob("*.ts") if pattern.search(comments.sub("", f.read_text(encoding="utf-8")))]
    assert sorted(set(offenders) - allowed) == [], offenders
    assert "screens/live-camera.ts" not in offenders


def test_l1_two_chains_of_one_sign_in_share_one_row_and_one_cap(arx):
    from smplwise.routers import media

    admin = TestClient(arx.app)
    cam = admin.post("/api/v1/cameras", json={"channel": 1, "alias": "a"}).json()
    assert admin.patch("/api/v1/settings", json={"remote.max_live_streams": 4}).status_code == 200  # the default is 16 now
    tokens = arx.core.issue("u-viewer")
    first, second = browser(arx), browser(arx)  # the second exchanges a fresh token of the SAME sign-in without the cookie
    assert first.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {tokens['access_token']}"}).status_code == 200
    assert second.post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {next_token(arx, tokens['refresh_token'])}"}).status_code == 200
    rows = first.get("/arx/api/v1/auth/sessions").json()["sessions"]
    assert len(rows) == 1 and rows[0]["current"] is True
    key = next(iter(hua.STORE._sessions.values())).sign_in()
    try:
        for i in range(4):
            media.REGISTRY.sessions[f"t{i}"] = media.LiveSession(id=f"t{i}", camera_id=cam["id"], stream="s", user_id="u-viewer", username="dana", remote_chain=key)
        assert second.get(f"/arx/api/v1/media/live/{cam['id']}").status_code == 429  # the budget of the sign-in, not the cookie
    finally:
        media.REGISTRY.sessions.clear()


def test_l4_revoke_audit_names_the_actors_channel(arx):
    phone, laptop = browser(arx), browser(arx)
    sign_in(phone, arx, arx.viewer)
    sign_in(laptop, arx, arx.viewer)
    laptop_id = next(x["id"] for x in phone.get("/arx/api/v1/auth/sessions").json()["sessions"] if not x["current"])
    assert TestClient(arx.app).delete(f"/api/v1/auth/sessions/{laptop_id}").status_code == 200  # the local administrator
    local = json.loads(arx.audit("auth.remote_session.revoked")[-1]["details_json"])
    assert local["channel"] == "local" and local["ended_via"] == ["cookie"] and "via" not in local
    assert phone.delete("/arx/api/v1/auth/sessions").status_code == 200  # the user, remotely
    remote = json.loads(arx.audit("auth.remote_session.revoked")[-1]["details_json"])
    assert remote["channel"] == "remote" and remote["ended_via"] == ["cookie"]


def test_l6_revoked_chain_check_fails_closed_once_the_table_exists(arx):
    import sqlite3

    class Broken:
        def execute(self, *_a):
            raise sqlite3.OperationalError("disk I/O error")

    token = arx.token(arx.viewer)
    hua._REVOKED_TABLE["seen"] = False
    assert hua.chain_revoked(Broken(), token) is False  # before migration 0035 (no table known)
    assert hua.load_revoked(arx.db) == 0 and hua._REVOKED_TABLE["seen"] is True  # start-up finds the table
    # a database error now refuses the sign-in - as a retryable 503, never as "revoked" (the browser would then revoke its
    # own HA sign-in), and nothing is remembered as rejected
    with pytest.raises(hua.ApiError) as exc:
        hua.chain_revoked(Broken(), token)
    assert exc.value.status == 503 and exc.value.code == "remote_unavailable" and exc.value.retryable is True
    assert not hua.was_rejected(token)


def test_l6_transient_db_error_answers_503_on_the_exchange(arx, monkeypatch):
    import sqlite3

    real = hua.chain_revoked
    broken = {"on": True}

    def flaky(conn, token):
        if broken["on"]:
            class Broken:
                def execute(self, *_a):
                    raise sqlite3.OperationalError("database is locked")

            return real(Broken(), token)
        return real(conn, token)

    hua._REVOKED_TABLE["seen"] = True
    monkeypatch.setattr(hua, "chain_revoked", flaky)
    token = arx.token(arx.viewer)
    r = browser(arx).post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 503 and r.json()["code"] == "remote_unavailable" and r.json()["retryable"] is True
    assert "Home Assistant" not in r.json()["user_message"] and hua.STORE.count() == 0
    assert _bearer_get(arx, token).status_code == 503  # the bearer path too
    broken["on"] = False  # the database is back: the SAME token signs in (no negative cache)
    assert browser(arx).post("/arx/api/v1/auth/session", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_l3_csp_report_keeps_host_and_port_only(arx):
    report = {"csp-report": {"effective-directive": "img-src", "blocked-uri": "https://user:secret@evil.example:8443/x.png?q=1", "disposition": "report"}}
    assert TestClient(arx.app).post("/arx/api/v1/csp-report", content=json.dumps(report), headers={"Content-Type": "application/csp-report"}).status_code == 204
    rows = TestClient(arx.app).get("/api/v1/csp-reports").json()["rows"]
    assert [r["blocked"] for r in rows] == ["https://evil.example:8443"]
