"""LOWS-BACKEND-2550 - the low security findings of the 2.52 deep review (docs/review/DEEP-REVIEW-2520-INDEX.md).

SEC-6  every WebSocket now passes the home-interface gate an HTTP request passes (routers/media._principal_for_ws): a home-only person
       whose "log" category is off is refused /events/ws (`home_module_off`, close 4403), a socket outside the home interface is refused
       (`home_interface_only`), and the home interface's own sockets (the door call's talk / listen included) stay open.
SEC-7  the Arx-only sign-in's per-account ceiling counts failures in the database (UPDATE ... RETURNING), so a failure that overlaps
       another inside the hashing time is not lost.
SEC-8  (owner Q1a) adding / editing / testing an off-box target and the key export are refused on the remote channel (403
       `offbox_local_only`, audited); the local channel is unchanged.
D-12   (owner Q6a) mapping an area that resolved to no building INTO one needs the route's permission installation-wide.
Fakes only: no Home Assistant, no device."""
from __future__ import annotations

from dataclasses import replace

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_devices import bulk_app, dev_app  # noqa: F401 - the fixtures of the device tests
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


# ---------------------------------------------------------------- SEC-8 (owner Q1a): off-box administration is local-only

OFFBOX = "backups/offbox"


@pytest.fixture()
def arx(settings, tmp_path, monkeypatch):
    from test_remote_access import Arx

    a = Arx(settings, tmp_path, monkeypatch)
    yield a
    hua.reset_for_tests()


def _local_target_body(share) -> dict:
    return {"name": "USB", "kind": "local", "enabled": True, "config": {"path": str(share)}}


def test_sec8_target_create_update_test_and_key_export_are_refused_remotely(arx, tmp_path):
    share = tmp_path / "share"
    share.mkdir()
    local = TestClient(arx.app)  # the local channel (Ingress), the developer identity joni - the bootstrap system administrator
    assert local.get(f"{API}/me").status_code == 200
    made = local.post(f"{API}/{OFFBOX}/targets", json=_local_target_body(share))
    assert made.status_code == 201, made.text
    tid = made.json()["id"]
    arx.flag("u-owner")
    arx.bind("u-owner", "system_admin")
    assert arx.login(arx.owner).status_code == 200
    remote = arx.client
    assert remote.get(f"/arx{API}/{OFFBOX}").status_code == 200  # the listing stays remote
    refused = [
        remote.post(f"/arx{API}/{OFFBOX}/targets", json=_local_target_body(share)),
        remote.put(f"/arx{API}/{OFFBOX}/targets/{tid}", json=_local_target_body(share)),
        remote.post(f"/arx{API}/{OFFBOX}/targets/{tid}/test"),
        remote.post(f"/arx{API}/{OFFBOX}/key/export", json={"confirm": "EXPORT"}),
    ]
    for r in refused:
        assert r.status_code == 403 and r.json()["code"] == "offbox_local_only", r.text
        assert "SWXB-KEY" not in r.text
    with arx.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM backup_offbox_targets").fetchone()[0] == 1  # nothing created remotely
        denied = {(r["action"], r["reason"]) for r in conn.execute("SELECT action, reason FROM audit_log WHERE decision = 'denied' AND reason = 'local_only'")}
    assert denied == {("backup.offbox.target_create", "local_only"), ("backup.offbox.target_update", "local_only"), ("backup.offbox.test", "local_only"),
                      ("backup.offbox.key_export", "local_only")}
    # the same four from the local channel are allowed
    assert local.put(f"{API}/{OFFBOX}/targets/{tid}", json={**_local_target_body(share), "name": "USB 2"}).status_code == 200
    assert local.post(f"{API}/{OFFBOX}/targets/{tid}/test").status_code == 200
    exp = local.post(f"{API}/{OFFBOX}/key/export", json={"confirm": "EXPORT"})
    assert exp.status_code == 200 and exp.json()["key"].startswith("SWXB-KEY-1:")


# ---------------------------------------------------------------- D-12 (owner Q6a): mapping an unmapped area into a building

def test_d12_an_unmapped_area_goes_into_a_building_only_with_installation_wide_permission(bulk_app):
    from test_building_scope_control_2351 import _site
    from test_building_scope_single_2351 import _multi_on

    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "eda", "site_admin", "floor", ids["fA"])
    _multi_on(c)
    with app.state.db.connection() as conn:  # the garden resolves to no building now
        conn.execute("DELETE FROM home_area_buildings WHERE area_id = 'garden'")

    def area_row(aid: str):
        with app.state.db.connection() as conn:
            r = conn.execute("SELECT floor_id FROM home_area_links WHERE area_id = ?", (aid,)).fetchone()
        return r[0] if r else "absent"

    r = c.put(f"{API}/floors/{ids['fA']}/home-link", json={"areas": {"garden": "include"}}, headers=as_user("eda"))
    assert r.status_code == 403, r.text
    assert area_row("garden") == "absent", "nothing written"
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT resource_type, resource_id FROM audit_log WHERE action = 'site.content.configure' AND decision = 'denied' "
                              "ORDER BY rowid DESC LIMIT 1").fetchone()
    assert (denied["resource_type"], denied["resource_id"]) == ("installation", "*")
    # an installation-wide administrator maps it
    assert c.put(f"{API}/floors/{ids['fA']}/home-link", json={"areas": {"garden": "include"}}).status_code == 200
    assert area_row("garden") == ids["fA"]
