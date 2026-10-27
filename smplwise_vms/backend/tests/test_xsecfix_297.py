"""XSECFIX-297: the four medium findings of the 2026-10-27 security review of the phone app's server side.

M1 the required-sensors policy exempts a route by an exact / whole-segment prefix match on the path below the mount prefix and `/api/v1`,
   never by a substring (`/me` used to exempt `/media/live/...`, `/alarm/me/pin`, `/energy/meters`; `/health` exempted
   `/recorders/{id}/health`; a remote_path containing `/me` exempted everything on the remote channel).
M2 a sign-out ends the phone app's device token AND its push registration: "sign out everywhere" (own / an administrator's), ending one
   app sign-in from the sessions list, a sign-out made inside the app, removing the user's remote access; and on the remote channel a
   device token obeys the user's remote-access policy.
M3 the device-token failure limiter counts failures per source address only after a lookup failed: anonymous noise (random tokens,
   any volume, any number of sources) never refuses a valid token.
Fakes only: no Home Assistant, no phone, no relay."""
from __future__ import annotations

import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from test_app_refresh_295 import ARX, USERS, Rx
from test_presence import API, APP_UA, STATUS_ON, WEB_UA, bearer, enable, register, world  # noqa: F401 - `world` is a fixture
from test_remote_access import ORIGIN

from smplwise.services import app_refresh
from smplwise.services import ha_user_auth as hua
from smplwise.services import presence as svc

RELAY = "rt_0123456789abcdef0123"
INSTALL = "11111111-2222-3333-4444-555555555555"


@pytest.fixture(autouse=True)
def _limits():
    svc.reset_limits()
    yield
    svc.reset_limits()


# ---------------------------------------------------------------- M1: the exempt routes of the required-sensors policy

EXEMPT = ["/api/v1/me", "/api/v1/presence/config", "/api/v1/presence/devices/dev_x/events", "/api/v1/notifications/devices",
          "/api/v1/notifications/devices/dev_x", "/api/v1/notifications/app/msg_1", "/api/v1/notifications/categories",
          "/api/v1/auth/session", "/api/v1/auth/sessions/abc", "/api/v1/health", "/api/v1/csp-report"]
NOT_EXEMPT = ["/api/v1/media/live/cam1", "/api/v1/media/live/cam1/ws", "/api/v1/energy/meters", "/api/v1/energy/meters/m1/readings",
              "/api/v1/alarm/me/pin", "/api/v1/access/groups/g1/members", "/api/v1/automations/automation/a1/meta",
              "/api/v1/zones/z1/share/members", "/api/v1/recorders/r1/health", "/api/v1/sites/me", "/api/v1/mex", "/api/v1/me/../sites",
              "/api/v1/presence/../sites", "/api/v1//me", "/api/v1/presencex", "/api/v1/healthz", "/api/v1/notifications/devicesx",
              "/api/v1/notifications", "/api/v1/sites", "/me", "/presence/config", "/api/v2/me", "/x/api/v1/me", ""]


@pytest.mark.parametrize("path", EXEMPT)
def test_m1_the_routes_that_lead_out_of_the_block_are_exempt(path):
    assert svc.gate_exempt(path) is True
    assert svc.gate_exempt("/arx" + path, "/arx") is True  # the remote channel: scope path carries the root_path


@pytest.mark.parametrize("path", NOT_EXEMPT)
def test_m1_everything_else_is_not_exempt_whatever_it_contains(path):
    assert svc.gate_exempt(path) is False
    assert svc.gate_exempt("/arx" + path, "/arx") is False


def test_m1_a_remote_path_that_contains_an_exempt_word_exempts_nothing():
    # remote_path `/members` (or `/media`) contains `/me`: the old substring check exempted every route of the remote channel
    for root in ("/members", "/media", "/health", "/me", "/presence"):
        assert svc.gate_exempt(f"{root}/api/v1/sites", root) is False
        assert svc.gate_exempt(f"{root}/api/v1/media/live/cam1", root) is False
        assert svc.gate_exempt(f"{root}/api/v1/me", root) is True


def _blocked_dana(c: TestClient) -> None:
    _, a = register(c, "dana")
    enable(c, required_sensors={"enabled": True, "sensors": ["location"]})
    assert c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()["presence_gate"]["blocked"] is True


def test_m1_a_blocked_app_session_is_refused_live_video_meters_and_the_alarm_pin(world):
    _, c, _ = world
    _blocked_dana(c)
    h = {**as_user("dana"), **APP_UA}
    for method, path, body in (("GET", "/media/live/cam1", None), ("GET", "/energy/meters", None), ("PUT", "/alarm/me/pin", {"pin": "1234"}),
                               ("GET", "/sites", None)):
        r = c.request(method, f"{API}{path}", headers=h, json=body)
        assert r.status_code == 403 and r.json()["code"] == "presence_required", (path, r.status_code, r.text[:200])
    # the routes that lead out still answer
    assert c.get(f"{API}/me", headers=h).status_code == 200
    assert c.get(f"{API}/presence/config", headers=h).status_code == 200
    assert c.get(f"{API}/notifications/categories", headers=h).status_code != 403


# ---------------------------------------------------------------- M3: failures per source, never before the lookup

def test_m3_random_tokens_from_one_source_are_throttled_but_a_valid_token_from_it_is_not(world, monkeypatch):
    monkeypatch.setattr(svc, "_now", lambda: 1000.0)
    _, c, _ = world
    _, a = register(c, "dana")
    good = bearer(a["device_token"])
    for i in range(svc.TOKEN_FAILURES_PER_MIN):  # a fresh random token every time: the bucket is the address, not the token
        assert c.get(f"{API}/presence/config", headers=bearer("arxd_" + f"{i:02d}" + "q" * 41)).status_code == 401
    r = c.get(f"{API}/presence/config", headers=bearer("arxd_" + "z" * 43))
    assert r.status_code == 429 and r.json()["code"] == "rate_limited"
    assert c.get(f"{API}/presence/config", headers=good).status_code == 200  # the same source, a valid token: never blocked
    assert c.post(f"{API}/presence/devices/{a['device_id']}/ack", json={"notice_version": 1}, headers=good).status_code != 429


def test_m3_an_installation_wide_flood_never_refuses_anyone(world, monkeypatch, caplog):
    monkeypatch.setattr(svc, "_now", lambda: 1000.0)
    _, c, _ = world
    _, a = register(c, "dana")
    for i in range(svc.TOKEN_FAILURES_GLOBAL + 50):  # failures from many other sources (one each)
        svc.token_failure_seen(f"ip:198.51.100.{i % 250}/{i}")
    assert svc.TOKEN_FAILURES_ALL.blocked("all")  # over the global count ...
    assert c.get(f"{API}/presence/config", headers=bearer(a["device_token"])).status_code == 200  # ... a valid token still works
    assert c.get(f"{API}/presence/config", headers=bearer("arxd_" + "y" * 43)).status_code == 401  # and an unknown one from a clean source is a 401, not 429
    assert any("failed device-token lookups" in rec.getMessage() for rec in caplog.records)


def test_m3_the_bucket_is_the_forwarded_address_behind_the_tunnel(monkeypatch):
    from smplwise.routers import presence as router_mod

    class Req:
        def __init__(self, cf: str) -> None:
            self.client = type("C", (), {"host": "172.30.32.2"})()
            self.headers = {"cf-connecting-ip": cf}

    monkeypatch.setattr(hua, "_believes_forwarded_headers", lambda peer: True)
    assert router_mod._client_key(Req("203.0.113.7")) == "ip:203.0.113.7"
    # one IPv6 subscriber prefix is one bucket
    assert router_mod._client_key(Req("2001:db8:1:2::1")) == router_mod._client_key(Req("2001:db8:1:2:ffff::9"))


# ---------------------------------------------------------------- M2: a sign-out ends the device token and its push registration

@pytest.fixture()
def rx(settings, tmp_path, monkeypatch):
    app_refresh.reset_limits()
    r = Rx(settings, tmp_path, monkeypatch)
    yield r
    app_refresh.reset_limits()
    hua.reset_for_tests()


def _app_client(rx, name: str) -> TestClient:
    """`name` signed in on the remote channel from inside the phone app (its user agent)."""
    cl = TestClient(rx.app, headers=ORIGIN)
    cl.headers["user-agent"] = APP_UA["User-Agent"]  # replace the test client's own user agent (constructor headers would add a second one)
    token = rx.arx.core.issue(USERS[name])["access_token"]
    assert cl.post(f"{ARX}/auth/session", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    return cl


def _device(rx, cl: TestClient, install_id: str = INSTALL, name: str = "הנייד של דנה") -> dict:
    r = cl.post(f"{ARX}/presence/devices", json={"name": name, "platform": "android", "install_id": install_id, "app_version": "1.0.0"})
    assert r.status_code in (200, 201), r.text
    body = r.json()
    with rx.db.connection() as conn:  # the push registration (the relay itself is out of scope here)
        conn.execute("UPDATE mobile_devices SET push_relay_token = ?, push_platform = 'android' WHERE id = ?", (RELAY + body["device_id"][-4:], body["device_id"]))
    assert rx.c.get(f"{ARX}/presence/config", headers=bearer(body["device_token"])).status_code == 200
    return body


def _ended(rx, dev: dict) -> None:
    assert rx.c.get(f"{ARX}/presence/config", headers=bearer(dev["device_token"])).status_code == 401
    assert rx.c.get(f"{API}/presence/config", headers=bearer(dev["device_token"])).status_code == 401
    with rx.db.connection(mode="read") as conn:
        row = conn.execute("SELECT push_relay_token, push_platform, revoked_at FROM mobile_devices WHERE id = ?", (dev["device_id"],)).fetchone()
    assert row["push_relay_token"] is None and row["push_platform"] is None
    assert row["revoked_at"] is None  # the row stays: the same install re-registers through a session and gets a new token


def _alive(rx, dev: dict) -> None:
    assert rx.c.get(f"{ARX}/presence/config", headers=bearer(dev["device_token"])).status_code == 200
    with rx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT push_relay_token FROM mobile_devices WHERE id = ?", (dev["device_id"],)).fetchone()[0]


def _audited(rx, reason: str) -> None:
    with rx.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT reason FROM audit_log WHERE action = 'presence.device.credentials_ended'").fetchall()
    assert reason in [r[0] for r in rows]


def test_m2_sign_out_everywhere_ends_the_device_token_and_push(rx):
    cl = _app_client(rx, "dana")
    dev = _device(rx, cl)
    browser = rx.user("dana")
    r = browser.delete(f"{ARX}/auth/sessions")  # "sign out everywhere", from a desktop browser
    assert r.status_code == 200, r.text
    _ended(rx, dev)
    _audited(rx, "signed_out_everywhere")
    # the same install registers again through a new sign-in: a new token, the old one stays dead
    again = _device(rx, _app_client(rx, "dana"))
    assert again["device_id"] == dev["device_id"] and again["device_token"] != dev["device_token"]
    assert rx.c.get(f"{ARX}/presence/config", headers=bearer(dev["device_token"])).status_code == 401


def test_m2_an_administrator_ending_all_sign_ins_ends_the_device_token_and_push(rx):
    dev = _device(rx, _app_client(rx, "dana"))
    other = _device(rx, _app_client(rx, "vera"), install_id="22222222-2222-3333-4444-555555555555", name="הנייד של ורה")
    r = rx.c.delete(f"{API}/auth/sessions", params={"user_id": USERS["dana"]})
    assert r.status_code == 200, r.text
    _ended(rx, dev)
    _alive(rx, other)  # another user's phone is untouched
    _audited(rx, "revoked_all_by_admin")


def test_m2_an_administrator_ending_the_app_sign_in_from_the_list_ends_the_device(rx):
    cl = _app_client(rx, "dana")
    dev = _device(rx, cl)
    browser = rx.user("dana")  # a desktop sign-in of the same user
    rows = rx.c.get(f"{API}/auth/sessions", params={"scope": "all"}).json()["sessions"]
    target = None
    for s in rows:
        sessions = hua.STORE.sessions_of({s["id"]}) if s.get("user_id") == USERS["dana"] else []
        if sessions and all(svc.is_app_user_agent(x.user_agent) for x in sessions):
            target = s["id"]
    assert target, rows
    r = rx.c.delete(f"{API}/auth/sessions/{target}")
    assert r.status_code == 200, r.text
    _ended(rx, dev)
    _audited(rx, "revoked_by_admin")
    assert browser.get(f"{ARX}/me").status_code == 200  # the desktop sign-in is another sign-in: it stays


def test_m2_a_sign_out_inside_the_app_ends_the_device_but_a_desktop_sign_out_does_not(rx):
    cl = _app_client(rx, "dana")
    dev = _device(rx, cl)
    browser = rx.user("dana")
    assert browser.delete(f"{ARX}/auth/session").status_code == 204  # a desktop browser signs out: the phone keeps working
    _alive(rx, dev)
    assert cl.delete(f"{ARX}/auth/session").status_code == 204  # the sign-out inside the app
    _ended(rx, dev)
    _audited(rx, "logout")


def test_m2_removing_the_remote_access_ends_the_device_token_and_push(rx):
    dev = _device(rx, _app_client(rx, "dana"))
    r = rx.c.put(f"{API}/access/users/{USERS['dana']}/remote-access", json={"enabled": False})
    assert r.status_code == 200, r.text
    _ended(rx, dev)
    _audited(rx, "remote_access_removed")


def test_m2_on_the_remote_channel_a_device_token_obeys_the_remote_access_policy(rx):
    dev = _device(rx, _app_client(rx, "dana"))
    with rx.db.connection() as conn:  # the flag disappears without any hook (a raw row, a policy switch, a restore)
        conn.execute("DELETE FROM remote_access_users WHERE user_id = ?", (USERS["dana"],))
    r = rx.c.get(f"{ARX}/presence/config", headers=bearer(dev["device_token"]))
    assert r.status_code == 403 and r.json()["code"] == "remote_not_allowed"
    assert rx.c.get(f"{API}/presence/config", headers=bearer(dev["device_token"])).status_code == 200  # the local channel has no remote policy
    rx.arx.flag(USERS["dana"])
    assert rx.c.get(f"{ARX}/presence/config", headers=bearer(dev["device_token"])).status_code == 200


def test_m2_the_device_token_survives_nothing_but_a_desktop_sign_out(rx):
    """The helper's own rule, directly: everywhere / device ids / an app user agent - nothing else."""
    dev = _device(rx, _app_client(rx, "dana"))
    with rx.db.connection() as conn:
        assert svc.end_on_sign_out(conn, USERS["dana"], "logout", user_agents=(WEB_UA["User-Agent"], "")) == 0
        assert svc.end_on_sign_out(conn, USERS["dana"], "logout", device_ids=["dev_other"]) == 0
    _alive(rx, dev)
    with rx.db.connection() as conn:
        assert svc.end_on_sign_out(conn, USERS["dana"], "logout", device_ids=[dev["device_id"]]) == 1
    _ended(rx, dev)


def test_m1_on_the_remote_channel_a_blocked_app_session_is_refused_the_alarm_pin_and_meters(rx):
    cl = _app_client(rx, "dana")
    _device(rx, cl)
    r = rx.c.put(f"{API}/presence/settings", json={"enabled": True, "notice_text": "הודעה לעובדים: המערכת אוספת מיקום לצורך נוכחות.",
                                                    "required_sensors": {"enabled": True, "sensors": ["location"]}})
    assert r.status_code == 200, r.text
    for method, path in (("PUT", "/alarm/me/pin"), ("GET", "/energy/meters"), ("GET", "/media/live/cam1")):
        r = cl.request(method, f"{ARX}{path}", json={"pin": "1234"} if method == "PUT" else None)
        assert r.status_code == 403 and r.json()["code"] == "presence_required", (path, r.status_code, r.text[:200])
    assert cl.get(f"{ARX}/me").status_code == 200
