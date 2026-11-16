"""AUTH-REVOKE-GATE-2435 (code review 2026-11-13, 02 backend access / intercom, P1-1, P1-2, P1-6).

P1-1: a local (USR2) or app web-view (SESSIONEXCH2) session revoked between the awaited thread-pool `resolve` and the socket attach
must not keep or open a WebSocket - the same "review M2" rule ha_user_auth.STORE.attach_socket already applies to HA sessions.

P1-2 / P1-6: the WisKey lineage administration routes gate through rbac.require("system.configure") before is_system_admin, so an
inactive administrator and one with an explicit deny are refused like on every sibling administrator route; the async resolve route
does its database work off the event loop."""
from __future__ import annotations

import json
import uuid

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from test_app_refresh_295 import rx  # noqa: F401 - the shared fixture
from test_app_session_295 import signed_in
from test_local_identity import lx  # noqa: F401 - the shared fixture
from test_remote_access import ORIGIN

from smplwise.db import bump_permission_revision, new_id, now_iso
from smplwise.services import app_session as xs
from smplwise.services import local_identity as li
from smplwise.services import wiskey_direct_join as wkj

WS = "/arx/api/v1/me/ws"


def _refused(client: TestClient) -> int:
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(WS, headers=ORIGIN) as ws:
            ws.receive_text()
    return exc.value.code


# ---------------------------------------------------------------- P1-1: local sessions

def test_local_socket_of_a_session_revoked_between_resolve_and_attach_is_refused(lx, monkeypatch):
    lx.enable()
    _created, c = lx.ready("maria")
    real = li.resolve

    def resolve_then_revoke(db, settings, conn_like, cookie_value, **kw):
        s = real(db, settings, conn_like, cookie_value, **kw)
        if s is not None:
            with db.connection(label="test revoke") as conn:
                assert li.revoke_chain(conn, s.chain_id, "admin") == 1  # the administrator's revoke lands in the window
        return s

    monkeypatch.setattr(li, "resolve", resolve_then_revoke)
    assert _refused(c) == 4401
    assert li.CACHE._sockets == {}  # nothing attached that no revocation pass would ever close


def test_local_socket_of_a_live_session_still_attaches(lx):
    lx.enable()
    _created, c = lx.ready("maria")
    with c.websocket_connect(WS, headers=ORIGIN) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"
        assert sum(len(v) for v in li.CACHE._sockets.values()) == 1


def test_local_attach_follows_a_rotation_of_the_same_chain(lx):
    """A concurrent HTTP request may rotate the chain between resolve and attach: the old entry is gone, the chain is still live."""
    lx.enable()
    _created, c = lx.ready("maria")
    import dataclasses

    class Sock:
        pass

    s = next(iter(li.CACHE._by_sid.values()))
    li.CACHE.drop(s.sid_hash)
    assert li.CACHE.attach(s.sid_hash, s.chain_id, Sock()) is False  # no live entry of the chain at all
    li.CACHE.put(dataclasses.replace(s, sid_hash="f" * len(s.sid_hash)))  # the rotated successor of the same chain
    assert li.CACHE.attach(s.sid_hash, s.chain_id, Sock()) is True
    li.CACHE.drop_chains({s.chain_id})
    assert li.CACHE.attach(s.sid_hash, s.chain_id, Sock()) is False  # the chain revoked


# ---------------------------------------------------------------- P1-1: app web-view sessions

def test_app_socket_of_a_session_ended_between_resolve_and_attach_is_refused(rx, monkeypatch):
    _dev, _out, _key, wv = signed_in(rx)
    real = xs.resolve

    def resolve_then_end(db, conn_like, cookie_value, **kw):
        s = real(db, conn_like, cookie_value, **kw)
        if s is not None:
            with db.connection(label="test revoke") as conn:
                assert xs._end_where(conn, "sid_hash = ?", (s.sid_hash,), "revoked_by_admin") == 1
        return s

    monkeypatch.setattr(xs, "resolve", resolve_then_end)
    assert _refused(wv) == 4401
    assert xs.CACHE._sockets == {}


def test_app_socket_of_a_live_session_still_attaches(rx):
    _dev, _out, _key, wv = signed_in(rx)
    with wv.websocket_connect(WS, headers=ORIGIN) as ws:
        assert json.loads(ws.receive_text())["type"] == "hello"
        assert sum(len(v) for v in xs.CACHE._sockets.values()) == 1


def test_shared_attach_helper_refuses_without_a_live_entry():
    import threading
    import weakref

    from smplwise.services import session_cache

    lock = threading.Lock()
    sockets: dict[str, weakref.WeakSet] = {}

    class Sock:
        pass

    s = Sock()
    assert session_cache.attach_if_live(lock, sockets, "k", s, live=lambda: False) is False and sockets == {}
    assert session_cache.attach_if_live(lock, sockets, "k", s, live=lambda: True) is True and s in sockets["k"]


# ---------------------------------------------------------------- P1-2 / P1-6: the lineage administration gate

BASE = "/api/v1/access-control/wiskey-lineage"
OP = str(uuid.uuid4())
POSTS = [
    (f"{BASE}/{OP}/resolve", None),
    (f"{BASE}/{OP}/close", {"code": "operator_closed", "confirm": True}),
    (f"{BASE}/reinitialise", {"confirm": "אתחול"}),
]


@pytest.fixture()
def lin(settings, monkeypatch):
    from smplwise.main import create_app

    app = create_app(settings)
    c = TestClient(app)
    assert c.get("/api/v1/me").status_code == 200  # joni bootstraps as system administrator
    monkeypatch.setattr(wkj, "JOIN", None)  # no installed join: past the gate every route answers without touching anything
    c.db = app.state.db
    return c


def _denied_rows(c, action_prefix: str) -> list[dict]:
    with c.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT action, decision, reason FROM audit_log WHERE decision = 'denied' AND action LIKE ?",
                                              (action_prefix + "%",)).fetchall()]


def test_an_active_system_administrator_passes_the_gate_on_all_four_routes(lin):
    assert lin.get(BASE).json() == {"installed": False, "lineage": None}
    for path, body in POSTS:
        r = lin.post(path, json=body) if body is not None else lin.post(path)
        assert r.status_code == 409 and r.json()["code"] == "wiskey_direct_not_installed", (path, r.text)


def test_an_inactive_system_administrator_is_refused_on_all_four_routes(lin):
    with lin.db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = 'dev-joni'")
    assert lin.get(BASE).status_code == 403
    for path, body in POSTS:
        r = lin.post(path, json=body) if body is not None else lin.post(path)
        assert r.status_code == 403, (path, r.text)
    reasons = {r["reason"] for r in _denied_rows(lin, "system.configure")}
    assert reasons == {"user_inactive"}


def test_an_explicitly_denied_system_administrator_is_refused_on_all_four_routes(lin):
    now = now_iso()
    with lin.db.connection() as conn:
        conn.execute("INSERT INTO custom_roles(id, name_he, permissions_json, created_at, updated_at) VALUES ('cr-noconf', 'ללא הגדרות', ?, ?, ?)",
                     (json.dumps(["system.configure"]), now, now))
        conn.execute("""INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, created_at)
                        VALUES (?, 'user', 'dev-joni', 'cr-noconf', 'installation', '*', 'deny', 1, ?)""", (new_id(), now))
        bump_permission_revision(conn)
    assert lin.get(BASE).status_code == 403
    for path, body in POSTS:
        r = lin.post(path, json=body) if body is not None else lin.post(path)
        assert r.status_code == 403, (path, r.text)
    assert {r["reason"] for r in _denied_rows(lin, "system.configure")} == {"explicit_deny"}


def test_a_non_administrator_refusal_of_the_view_is_audited(lin):
    from conftest import as_user

    assert lin.get(BASE, headers=as_user("plain")).status_code == 403
    rows = _denied_rows(lin, "")
    assert rows, "the GET refusal writes an audit row"


def test_the_async_resolve_route_does_its_database_work_off_the_event_loop(lin, monkeypatch):
    import threading

    from smplwise.routers import wiskey_lineage as router

    seen: list[int] = []
    real = router._admin

    def spy(*a, **kw):
        seen.append(threading.get_ident())
        return real(*a, **kw)

    monkeypatch.setattr(router, "_admin", spy)
    loop_ids: list[int] = []

    real_join = router._join

    def join_spy():
        loop_ids.append(threading.get_ident())  # _join runs in the coroutine itself: the loop thread
        return real_join()

    monkeypatch.setattr(router, "_join", join_spy)
    assert lin.post(f"{BASE}/{OP}/resolve").status_code == 409
    assert seen and loop_ids and seen[0] != loop_ids[0], "the gate's database write ran on the event loop"
