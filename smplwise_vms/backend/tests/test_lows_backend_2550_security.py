"""LOWS-BACKEND-2550 - the low security findings of the 2.52 deep review (docs/review/DEEP-REVIEW-2520-INDEX.md).

SEC-6  every WebSocket now passes the home-interface gate an HTTP request passes (routers/media._principal_for_ws): a home-only person
       whose "log" category is off is refused /events/ws (`home_module_off`, close 4403), a socket outside the home interface is refused
       (`home_interface_only`), and the home interface's own sockets (the door call's talk / listen included) stay open.
SEC-7  the Arx-only sign-in's per-account ceiling counts failures in the database (UPDATE ... RETURNING), so a failure that overlaps
       another inside the hashing time is not lost.
Fakes only: no Home Assistant, no device."""
from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_local_identity import Lx, _net

from smplwise.services import ha_user_auth as hua
from smplwise.services import home_interface as hi
from smplwise.services import local_identity as li
from smplwise.services import local_passwords as lp

API = "/api/v1"


# ---------------------------------------------------------------- SEC-6

@pytest.fixture()
def client(settings):
    hi.reset_state_for_tests()
    from smplwise.main import create_app

    c = TestClient(create_app(replace(settings)))
    assert c.get(f"{API}/me").status_code == 200  # joni: the bootstrap system administrator
    yield c, settings
    hi.reset_state_for_tests()


def _refused(c: TestClient, url: str, headers: dict, code: str) -> None:
    with c.websocket_connect(url, headers=headers) as ws:
        frame = ws.receive_json()
        assert frame["type"] == "error" and frame["value"] == code, (url, frame)
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_text()
    assert closed.value.code == 4403, (url, closed.value.code)


def _not_gated(c: TestClient, url: str, headers: dict) -> None:
    """The socket is not refused by the home-interface gate (it may still be refused later by its own permission check)."""
    try:
        with c.websocket_connect(url, headers=headers) as ws:
            frame = ws.receive_json()
    except WebSocketDisconnect:
        return
    assert frame.get("value") not in ("home_interface_only", "home_module_off"), (url, frame)


def test_sec6_a_home_only_person_is_refused_the_socket_of_a_hidden_category(client):
    c, s = client
    bind(c, s, "dana", "operator", "installation", "*")
    h = as_user("dana")
    assert c.put(f"{API}/home/policies/dev-dana", json={"home_only": True, "modules": ["lights", "cameras"]}).status_code == 200
    assert c.get(f"{API}/events", headers=h).json()["code"] == "home_module_off"  # the HTTP twin, unchanged
    _refused(c, f"{API}/events/ws", h, "home_module_off")
    _refused(c, f"{API}/wall/ws", h, "home_interface_only")  # not a home-interface socket at all
    # the category on again: the socket reaches its own checks
    assert c.put(f"{API}/home/policies/dev-dana", json={"modules": ["lights", "cameras", "log"]}).status_code == 200
    _not_gated(c, f"{API}/events/ws", h)


def test_sec6_a_person_not_home_only_is_not_judged(client):
    c, s = client
    bind(c, s, "dana", "operator", "installation", "*")
    assert c.put(f"{API}/home/policies/dev-dana", json={"modules": ["lights"]}).status_code == 200
    _not_gated(c, f"{API}/events/ws", as_user("dana"))


def test_sec6_the_home_interfaces_own_sockets_stay_allowed():
    for path in ("/me/ws", "/ha/ws", "/intercom/ws", "/events/ws", "/media/live/cam1/ws", "/media/live-ha/camera.x/ws",
                 "/playback/sessions/s1/ws", "/access-control/stations/st1/live/ws", "/access-control/talk/t1/ws",
                 "/access-control/listen/l1/ws"):
        assert hi.home_allowed(API + path), path
    for path in ("/wall/ws", "/access-control/talk/t1/stop", "/access-control/talk/a/b/ws", "/access-control/talkx/t1/ws"):
        assert not hi.home_allowed(API + path), path


# ---------------------------------------------------------------- SEC-7

@pytest.fixture()
def lx(settings, tmp_path, monkeypatch):
    a = Lx(settings, tmp_path, monkeypatch)
    yield a
    hua.reset_for_tests()


def test_sec7_overlapping_failures_all_count_toward_the_ceiling(lx, monkeypatch):
    """A failure booked by another request while this one was hashing (it read failed_count before) is kept: 1 + 1 = 2, not 1."""
    lx.enable()
    monkeypatch.setattr(li, "ACCOUNT_CEILING_WINDOW_S", 10 ** 9)  # one window for the whole test
    created, _c = lx.ready("maria")
    uid = created["user"]["id"]
    real_verify = lp.verify
    fired = {"n": 0}

    def overlapping_verify(password, phc):
        if fired["n"] == 0:  # another network's failure lands while this request hashes
            fired["n"] += 1
            import time

            with lx.db.connection() as conn:
                conn.execute("UPDATE auth_local_credentials SET failed_count = COALESCE(failed_count, 0) + 1, last_failed_at = ? WHERE user_id = ?",
                             (time.time(), uid))
        return real_verify(password, phc)

    monkeypatch.setattr(lp, "verify", overlapping_verify)
    assert lx.sign_in(lx.remote(**_net(30)), "maria", "not the password").status_code == 401
    row = lx.rows("SELECT failed_count FROM auth_local_credentials WHERE user_id = ?", (uid,))[0]
    assert row["failed_count"] == 2


def test_sec7_a_new_window_starts_the_count_again(lx, monkeypatch):
    lx.enable()
    created, _c = lx.ready("maria")
    uid = created["user"]["id"]
    with lx.db.connection() as conn:  # 40 failures, but in a window long gone
        conn.execute("UPDATE auth_local_credentials SET failed_count = 40, last_failed_at = 1000.0 WHERE user_id = ?", (uid,))
    assert lx.sign_in(lx.remote(**_net(31)), "maria", "not the password").status_code == 401
    row = lx.rows("SELECT failed_count, delay_until FROM auth_local_credentials WHERE user_id = ?", (uid,))[0]
    assert row == {"failed_count": 1, "delay_until": None}
