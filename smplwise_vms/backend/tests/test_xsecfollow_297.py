"""XSECFOLLOW-297: the follow-ups of the XSECFIX-297 review (2026-10-27).

a  the required-sensors block (presence.enforce) and the service-account refusal now also apply to every WebSocket: all sockets resolve
   their caller in routers/media._principal_for_ws, which refuses a blocked user with one `{"type":"error","value":"presence_required"}`
   frame and close 4403 (never 4401 - that would read as "signed out"). The HTTP streaming routes (clips, downloads, snapshots) already go
   through auth._principal and are refused there.
b  a password change (own, by an administrator's link, by the self-service code) and a forced second factor (a `required` override for a
   user or a role) end the phone app's device token and push registration - presence.end_on_sign_out(everywhere=True), audited
   `presence.device.credentials_ended`; the device row stays and the same install re-registers through a session.
c  `?do=run` only opens the run confirmation: frontend/tests/unit-xsecfollow-297.spec.ts (a Node unit spec, the rule and a source guard).
Fakes only: no Home Assistant, no phone, no relay."""
from __future__ import annotations

import pytest
from conftest import as_user
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_app_refresh_295 import ARX, USERS
from test_local_identity import GOOD, GOOD2, Lx
from test_presence import API, APP_UA, WEB_UA, bearer, enable, register, world  # noqa: F401 - `world` is a fixture
from test_xsecfix_297 import RELAY, _alive, _app_client, _audited, _device, _ended, rx  # noqa: F401 - `rx` is a fixture

from smplwise.services import ha_user_auth as hua
from smplwise.services import presence as svc
from smplwise.services import service_identity


@pytest.fixture(autouse=True)
def _limits():
    svc.reset_limits()
    yield
    svc.reset_limits()


# ---------------------------------------------------------------- a: the block on the sockets

SOCKETS = ["/me/ws", "/events/ws", "/ha/ws", "/intercom/ws", "/media/live/cam1/ws", "/media/live-ha/camera.front/ws",
           "/playback/sessions/s1/ws", "/access-control/stations/st1/live/ws", "/access-control/talk/t1/ws", "/access-control/listen/l1/ws",
           "/wall/ws"]


def _blocked_dana(c: TestClient) -> None:
    _, _a = register(c, "dana")
    enable(c, required_sensors={"enabled": True, "sensors": ["location"]})
    assert c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()["presence_gate"]["blocked"] is True


def _refused(c: TestClient, url: str, headers: dict, code: str = "presence_required") -> None:
    with c.websocket_connect(url, headers=headers) as ws:
        frame = ws.receive_json()
        assert frame["type"] == "error" and frame["value"] == code, (url, frame)
        assert frame["message"]
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_text()
    assert closed.value.code == 4403, (url, closed.value.code)


def _mounted(app, path: str) -> bool:
    from starlette.routing import Match

    scope = {"type": "websocket", "path": API + path, "root_path": "", "headers": [], "query_string": b""}
    return any(r.matches(scope)[0] == Match.FULL for r in app.router.routes)


@pytest.mark.parametrize("path", SOCKETS)
def test_a_a_blocked_app_session_is_refused_on_every_socket(world, path):
    app, c, _ = world
    if not _mounted(app, path):
        pytest.skip(f"{path} is not mounted in this build")
    _blocked_dana(c)
    _refused(c, f"{API}{path}", {**as_user("dana"), **APP_UA})


def _gate_rows(app) -> list:
    with app.state.db.connection(mode="read") as conn:
        return conn.execute("SELECT reason, decision FROM audit_log WHERE action = 'presence.gate.refused'").fetchall()


def test_a_the_socket_refusal_is_audited_like_the_http_one(world):
    app, c, _ = world
    _blocked_dana(c)
    before = len(_gate_rows(app))
    svc.reset_limits()  # the audit is throttled per user: start a fresh window so the socket's own row is written
    _refused(c, f"{API}/me/ws", {**as_user("dana"), **APP_UA})
    rows = _gate_rows(app)
    assert len(rows) == before + 1 and rows[-1]["reason"] == "missing_sensors" and rows[-1]["decision"] == "denied"


def test_a_a_desktop_browser_and_an_unblocked_user_keep_their_sockets(world):
    _, c, _ = world
    _blocked_dana(c)
    # the policy targets the app (the default channel): the same user in a desktop browser is not blocked
    with c.websocket_connect(f"{API}/me/ws", headers={**as_user("dana"), **WEB_UA}) as ws:
        assert ws.receive_json()["type"] == "hello"
    # another user (no required sensors missing for an administrator / a user the policy does not reach) is untouched
    with c.websocket_connect(f"{API}/me/ws", headers={**as_user("vera"), **WEB_UA}) as ws:
        assert ws.receive_json()["type"] == "hello"


def test_a_without_the_policy_the_app_socket_is_unchanged(world):
    _, c, _ = world
    register(c, "dana")
    with c.websocket_connect(f"{API}/me/ws", headers={**as_user("dana"), **APP_UA}) as ws:
        assert ws.receive_json()["type"] == "hello"


def test_a_the_service_account_is_refused_on_a_socket_too(rx, monkeypatch):
    # the refusal applies to Ingress / remote principals (never the developer identity): a remote sign-in, then the account becomes
    # the configured service identity
    cl = _app_client(rx, "dana")
    monkeypatch.setattr(service_identity, "is_service_user", lambda conn, uid: uid == USERS["dana"])
    me = cl.get(f"{ARX}/me")
    assert me.status_code == 403 and me.json()["code"] == "service_account"
    _refused(cl, f"{ARX}/me/ws", {}, code="service_account")


def test_a_http_streaming_routes_of_a_blocked_user_are_refused_before_the_handler(world):
    _, c, _ = world
    _blocked_dana(c)
    h = {**as_user("dana"), **APP_UA}
    for path in ("/exports/e1/download", "/cameras/cam1/snapshot.jpg", "/backups/b1/download",
                 "/frigate/r1/cameras/c1/clip.mp4?start=2026-10-27T10:00:00Z&end=2026-10-27T10:01:00Z",
                 "/frigate/r1/cameras/c1/playback/index.m3u8?start=2026-10-27T10:00:00Z&end=2026-10-27T10:01:00Z"):
        r = c.get(f"{API}{path}", headers=h)
        assert r.status_code == 403 and r.json()["code"] == "presence_required", (path, r.status_code, r.text[:200])


def test_a_on_the_remote_channel_a_blocked_app_socket_is_refused(rx):
    cl = _app_client(rx, "dana")
    _device(rx, cl)
    r = rx.c.put(f"{API}/presence/settings", json={"enabled": True, "notice_text": "הודעה לעובדים: המערכת אוספת מיקום לצורך נוכחות.",
                                                    "required_sensors": {"enabled": True, "sensors": ["location"]}})
    assert r.status_code == 200, r.text
    for path in ("/me/ws", "/events/ws"):
        _refused(cl, f"{ARX}{path}", {})
    assert cl.get(f"{ARX}/me").status_code == 200  # the way out still answers


# ---------------------------------------------------------------- b: a password change / reset and a forced factor end the phone credential

@pytest.fixture()
def lx(settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    yield a
    hua.reset_for_tests()


def _local_device(lx: Lx, c: TestClient, install_id: str = "33333333-2222-3333-4444-555555555555") -> dict:
    r = c.post(f"{ARX}/presence/devices", json={"name": "הנייד של מריה", "platform": "android", "install_id": install_id, "app_version": "1.0.0"},
               headers=APP_UA)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    with lx.db.connection() as conn:
        conn.execute("UPDATE mobile_devices SET push_relay_token = ?, push_platform = 'android' WHERE id = ?", (RELAY + body["device_id"][-4:], body["device_id"]))
    assert lx.admin.get(f"{API}/presence/config", headers=bearer(body["device_token"])).status_code == 200
    return body


def _local_ended(lx: Lx, dev: dict) -> None:
    assert lx.admin.get(f"{API}/presence/config", headers=bearer(dev["device_token"])).status_code == 401
    row = lx.rows("SELECT push_relay_token, push_platform, revoked_at FROM mobile_devices WHERE id = ?", (dev["device_id"],))[0]
    assert row["push_relay_token"] is None and row["push_platform"] is None and row["revoked_at"] is None


def _local_audited(lx: Lx, reason: str) -> None:
    assert reason in [r["reason"] for r in lx.rows("SELECT reason FROM audit_log WHERE action = 'presence.device.credentials_ended'")]


def test_b_changing_the_own_password_ends_every_phone_credential(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    dev = _local_device(lx, c)
    r = c.put(f"{ARX}/auth/local/password", json={"current_password": GOOD, "new_password": GOOD2})
    assert r.status_code == 200, r.text
    _local_ended(lx, dev)
    _local_audited(lx, "password_changed")
    # the kept session re-registers the same install: a new token, the old one stays dead
    again = _local_device(lx, c)
    assert again["device_id"] == dev["device_id"] and again["device_token"] != dev["device_token"]
    assert lx.admin.get(f"{API}/presence/config", headers=bearer(dev["device_token"])).status_code == 401


def test_b_a_refused_password_change_ends_nothing(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    dev = _local_device(lx, c)
    r = c.put(f"{ARX}/auth/local/password", json={"current_password": "wrong one here", "new_password": GOOD2})
    assert r.status_code == 400
    assert lx.admin.get(f"{API}/presence/config", headers=bearer(dev["device_token"])).status_code == 200


def test_b_a_password_reset_link_ends_every_phone_credential(lx):
    lx.enable()
    created, c = lx.ready("maria")
    uid = created["user"]["id"]
    dev = _local_device(lx, c)
    r = lx.admin.post(f"/api/v1/identity/local-users/{uid}/link", json={"purpose": "reset"})
    assert r.status_code in (200, 201), r.text
    token = r.json()["link"]["path"].split("t=")[1]
    assert lx.set_password(token, GOOD2).status_code == 200
    _local_ended(lx, dev)
    _local_audited(lx, "password_changed")


def test_b_a_self_service_reset_ends_every_phone_credential(settings, tmp_path, monkeypatch):
    from test_local_reset import NEW_PW, Rx as ResetRx

    from smplwise.services import local_reset as lr

    x = ResetRx(settings, tmp_path, monkeypatch)
    lr.reset_for_tests()
    try:
        x.enable()
        x.map_account()
        x.eligible("maria")
        c = x.remote()
        assert x.sign_in(c, "maria").status_code == 200
        dev = _local_device(x, c)
        x.request("maria")
        r = x.confirm("maria", x.last_code())
        assert r.status_code == 200, r.text
        _local_ended(x, dev)
        _local_audited(x, "password_changed")
        assert x.sign_in(x.remote(), "maria", NEW_PW).status_code == 200
    finally:
        hua.reset_for_tests()
        lr.reset_for_tests()


def test_b_a_required_factor_override_ends_the_phone_credential_of_a_user_without_one(rx):
    dev = _device(rx, _app_client(rx, "dana"))
    other = _device(rx, _app_client(rx, "vera"), install_id="22222222-2222-3333-4444-555555555555", name="הנייד של ורה")
    r = rx.c.put(f"{API}/auth/second-factor/overrides/user/{USERS['dana']}", json={"policy": "required"})
    assert r.status_code == 200, r.text
    _ended(rx, dev)
    _alive(rx, other)  # another user is untouched
    _audited(rx, "second_factor_required")
    with rx.db.connection(mode="read") as conn:
        import json

        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'auth.second_factor.policy_override' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert json.loads(row[0])["device_credentials_ended"] == 1


def test_b_an_optional_override_ends_nothing(rx):
    dev = _device(rx, _app_client(rx, "dana"))
    r = rx.c.put(f"{API}/auth/second-factor/overrides/user/{USERS['dana']}", json={"policy": "optional"})
    assert r.status_code == 200, r.text
    _alive(rx, dev)


def test_b_a_required_role_override_ends_the_phone_credentials_of_its_members(rx):
    dev = _device(rx, _app_client(rx, "dana"))
    with rx.db.connection(mode="read") as conn:
        roles = [r[0] for r in conn.execute("SELECT DISTINCT role_id FROM bindings WHERE subject_kind = 'user' AND subject_id = ?", (USERS["dana"],)).fetchall()]
    if not roles:
        pytest.skip("dana holds no role binding in this fixture")
    r = rx.c.put(f"{API}/auth/second-factor/overrides/role/{roles[0]}", json={"policy": "required"})
    assert r.status_code == 200, r.text
    _ended(rx, dev)
    _audited(rx, "second_factor_required")
