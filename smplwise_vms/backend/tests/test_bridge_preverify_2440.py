"""CR-BRIDGE-PREVERIFY-2440 (review 05:P2-02, 05:P2-03, 05:P3-08).

P2-02  `POST /ha/bridge/ping` and `/ha/bridge/directory` are judged on a READ connection before the request takes the write gate:
       a call that proves no key (a bad signature, a stale or malformed message, no body at all) never takes a turn in the write
       queue (`db.lock_stats()["holds"]` does not move, and it is answered while another writer holds the gate). A signed call is
       answered exactly as before: the screen does not spend its nonce, and the handler still verifies it under the write lock.
P2-03  the routers that resolve an identity without `auth._principal` run its cross-cutting steps themselves
       (`auth.shared_steps(light=True)`); the two path gates are no-ops on their paths, which is what keeps this a pure refactor.
P3-08  the label of a request's connection carries the route template, never a path parameter.
"""
from __future__ import annotations

import threading
import time

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from smplwise import auth
from smplwise import db as db_mod
from smplwise.main import create_app
from smplwise.services import bridge_discovery, ha_bridge, home_interface, presence

API = "/api/v1"
PING, DIRECTORY = f"{API}/ha/bridge/ping", f"{API}/ha/bridge/directory"


@pytest.fixture()
def world(settings):
    app = create_app(settings)
    c = TestClient(app)
    secret = c.get(f"{API}/ha/bridge/pairing").json()["pairing_code"]
    return {"app": app, "c": c, "secret": secret, "db": app.state.db}


def _holds() -> int:
    return db_mod.lock_stats()["holds"]


def _bad_calls(secret: str) -> list[tuple[str, dict, int, str | None]]:
    """(path, request kwargs, status, error code) of calls that prove no key."""
    stale = ha_bridge.sign(secret, {"users": []}, ts=int(time.time()) - 3600)
    wrong = ha_bridge.sign("another code", {"users": []})
    tampered = {**ha_bridge.sign(secret, {"users": []}), "users": [{"id": "x"}]}
    return [
        (PING, {"json": ha_bridge.sign("another code", {"version": "0.10.7"})}, 401, "bridge_bad_signature"),
        (PING, {"json": {"version": "0.10.7"}}, 401, "bridge_stale"),  # unsigned: ts 0, as before
        (PING, {"json": {"purpose": "cast_origin", "ts": 1, "nonce": "n", "sig": "s"}}, 422, "bridge_bad_request"),
        (PING, {}, 422, None),  # no body
        (PING, {"json": [1, 2]}, 422, None),  # not an object
        (DIRECTORY, {"json": wrong}, 401, "bridge_bad_signature"),
        (DIRECTORY, {"json": tampered}, 401, "bridge_bad_signature"),
        (DIRECTORY, {"json": stale}, 401, "bridge_stale"),
        (DIRECTORY, {"json": {"users": []}}, 401, "bridge_stale"),
        (DIRECTORY, {}, 422, None),
    ]


def _code(r) -> str | None:
    body = r.json()
    if not isinstance(body, dict):
        return None
    err = body.get("error")
    return err.get("code") if isinstance(err, dict) else body.get("code")


def test_a_bad_signature_never_touches_the_write_gate(world):
    c = world["c"]
    for path, kwargs, status, code in _bad_calls(world["secret"]):
        before = _holds()
        r = c.post(path, **kwargs)
        assert r.status_code == status, (path, kwargs, r.status_code, r.text)
        if code is not None:
            assert _code(r) == code, (path, kwargs, r.text)
        assert _holds() == before, f"{path} {kwargs}: a refused bridge call opened a write transaction"


def test_a_bad_signature_is_answered_while_a_writer_holds_the_gate(world, monkeypatch):
    monkeypatch.setattr(db_mod, "BUSY_TIMEOUT_S", 20.0)  # a call that still queued for the gate would hang here, not fail fast
    c, holding, done = world["c"], threading.Event(), threading.Event()

    def hold() -> None:
        with world["db"].connection(label="test holder"):
            holding.set()
            done.wait(30)

    t = threading.Thread(target=hold)
    t.start()
    try:
        assert holding.wait(5)
        started = time.monotonic()
        for path, kwargs, status, _code_ in _bad_calls(world["secret"]):
            assert c.post(path, **kwargs).status_code == status
        assert time.monotonic() - started < 10.0
    finally:
        done.set()
        t.join(10)


def test_a_signed_call_is_answered_as_before_and_is_spent_once(world):
    c, secret = world["c"], world["secret"]
    ping = ha_bridge.sign(secret, {"version": "0.10.7"})
    before = _holds()
    r = c.post(PING, json=ping)
    assert r.status_code == 200 and r.json()["ok"] is True and r.json()["paired_at"]
    assert _holds() > before  # the real verification and the writes run under the write lock, as before
    assert c.post(PING, json=ping).status_code == 401 and _code(c.post(PING, json=ping)) == "bridge_replay"
    push = ha_bridge.sign(secret, {"users": [{"id": "u1", "name": "A", "username": "a", "is_active": True, "is_admin": False, "group_ids": []}], "version": "0.10.7"})
    r = c.post(DIRECTORY, json=push)
    assert r.status_code == 200 and r.json()["users"] == 1
    replay = c.post(DIRECTORY, json=push)
    assert replay.status_code == 401 and _code(replay) == "bridge_replay"


def test_the_screen_does_not_spend_the_nonce_and_refuses_like_the_real_check(world):
    secret, db = world["secret"], world["db"]
    msg = ha_bridge.sign(secret, {"users": []})
    with db.connection(mode="read", label="test") as conn:
        for _ in range(3):
            ha_bridge.verify_message(conn, msg, screen_only=True)  # never a replay: nothing is recorded
        with pytest.raises(ha_bridge.ApiError) as exc:
            ha_bridge.verify_message(conn, {**msg, "sig": "0" * 64}, screen_only=True)
        assert exc.value.code == "bridge_bad_signature"
    with db.connection(label="test") as conn:
        ha_bridge.verify_message(conn, msg)  # the real one still passes once ...
        with pytest.raises(ha_bridge.ApiError) as exc:
            ha_bridge.verify_message(conn, msg)  # ... and only once
        assert exc.value.code == "bridge_replay"


def test_a_refused_directory_push_is_counted_once_for_the_diagnostics(world):
    c = world["c"]
    assert bridge_discovery.directory_refusals() is None
    assert c.post(DIRECTORY, json=ha_bridge.sign("another code", {"users": []})).status_code == 401
    seen = bridge_discovery.directory_refusals()
    assert seen is not None and seen["count"] == 1 and seen["code"] == "bridge_bad_signature"
    assert c.post(DIRECTORY, json=ha_bridge.sign(world["secret"], {"users": []})).status_code == 200
    assert bridge_discovery.directory_refusals() is None


def test_while_revoked_the_screen_answers_what_the_handler_answered(world):
    from smplwise.services import bridge_key_revocation as bkr

    c, secret = world["c"], world["secret"]
    assert c.post(PING, json=ha_bridge.sign(secret, {"version": "0.10.7"})).status_code == 200
    with world["db"].connection(label="test") as conn:
        bkr._save(conn, {"state": "revoked"})
        assert bkr.is_revoked(conn)
    before = _holds()
    r = c.post(DIRECTORY, json=ha_bridge.sign(secret, {"users": []}))
    assert r.status_code == 401 and _code(r) == bkr.REVOKED_CODE and _holds() == before


# ---------------------------------------------------------------- P3-08: the connection label

class _Req:
    def __init__(self, method: str, path: str, template: str | None, params: dict) -> None:
        self.method = method
        self.url = type("U", (), {"path": path})()
        self.scope = {"path_params": params}
        if template is not None:
            self.scope["route"] = type("R", (), {"path": template})()


@pytest.mark.parametrize("path,template,params,label", [
    ("/api/v1/sites", "/sites", {}, "POST /api/v1/sites"),
    ("/arx/api/v1/sites", "/sites", {}, "POST /arx/api/v1/sites"),  # a route without parameters: exactly as before
    ("/api/v1/ha/entities/light.lobby", "/ha/entities/{entity_id}", {"entity_id": "light.lobby"}, "POST /api/v1/ha/entities/{entity_id}"),
    ("/arx/api/v1/notices/display/SECRET/slide/7", "/notices/display/{slug}/slide/{slide_id}", {"slug": "SECRET", "slide_id": 7},
     "POST /arx/api/v1/notices/display/{slug}/slide/{slide_id}"),
    ("/api/v1/files/a/b/c", "/files/{name:path}", {"name": "a/b/c"}, "POST /api/v1/files/{name:path}"),
    ("/api/v1/x/a%20b", "/x/{name}", {"name": "a b"}, "POST /x/{name}"),  # the value cannot be placed: the template alone
    ("/api/v1/x/abc", "/x/{name}", {}, "POST /x/{name}"),
    ("/api/v1/x/abc", None, {}, "POST /api/v1/x/abc"),  # no matched route (a mounted app): as before
])
def test_conn_label_carries_the_route_template(path, template, params, label):
    assert auth.conn_label(_Req("POST", path, template, params)) == label


def test_a_path_parameter_never_reaches_the_connection_label(world, monkeypatch):
    labels: list[str] = []
    real = world["db"].connection

    def connection(*a, **kw):
        labels.append(str(kw.get("label")))
        return real(*a, **kw)

    monkeypatch.setattr(world["db"], "connection", connection)
    c = world["c"]
    c.get(f"{API}/ha/entities/light.token_like_value")
    c.get(f"{API}/ha/actions/TOKENLIKE123")
    assert f"GET {API}/ha/entities/{{entity_id}}" in labels and f"GET {API}/ha/actions/{{action_id}}" in labels
    assert not any("token_like_value" in x or "TOKENLIKE123" in x for x in labels), labels


# ---------------------------------------------------------------- P2-03: the light identity runs the shared steps

def _building_presence_routes() -> list[tuple[str, str]]:
    from smplwise.routers import building_presence

    out = []
    for r in building_presence.router.routes:
        assert isinstance(r, APIRoute)
        for m in sorted(set(r.methods or ()) - {"HEAD"}):
            out.append((m, API + r.path.replace("{area_id}", "a1")))
    assert len(out) == 8
    return out


def test_the_two_path_gates_are_noops_on_the_light_routes():
    """What makes `shared_steps(light=True)` a pure refactor there: both gates return before they read anything."""
    for method, path in _building_presence_routes():
        assert presence.gate_exempt(path), path
        assert home_interface.home_allowed(path, "", method) and home_interface.module_route(path) is None, (method, path)
        assert not home_interface.kiosk_refused_write(path, "", method), (method, path)
        assert presence.gate_exempt("/arx" + path, "/arx") and home_interface.home_allowed("/arx" + path, "/arx", method)


def test_the_light_routes_run_the_shared_steps_on_their_own_connection(world, monkeypatch):
    calls: list[tuple[str, str]] = []
    real_presence, real_home, real_refuse, real_boot = presence.enforce, home_interface.enforce, None, auth.maybe_bootstrap
    from smplwise.services import service_identity

    real_refuse = service_identity.refuse_service_principal
    monkeypatch.setattr(presence, "enforce", lambda *a, **kw: (calls.append(("presence", a[2])), real_presence(*a, **kw))[1])
    monkeypatch.setattr(home_interface, "enforce", lambda *a, **kw: (calls.append(("home", a[2])), real_home(*a, **kw))[1])
    monkeypatch.setattr(service_identity, "refuse_service_principal", lambda *a, **kw: (calls.append(("service", "")), real_refuse(*a, **kw))[1])
    monkeypatch.setattr(auth, "maybe_bootstrap", lambda *a, **kw: (calls.append(("bootstrap", "")), real_boot(*a, **kw))[1])
    c = world["c"]
    for method, path in _building_presence_routes():
        calls.clear()
        r = c.request(method, path, json={"entity_id": "binary_sensor.x"} if path.endswith("/room") else {} if method == "PUT" else None)
        assert r.status_code != 401
        assert calls == [("presence", path), ("home", path)], (method, path, calls)  # the gates, and never the two steps these routes never ran
    calls.clear()
    assert c.get(f"{API}/me").status_code == 200
    assert [k for k, _ in calls] == ["service", "bootstrap", "presence", "home"]  # the full identity: every step, in the old order
