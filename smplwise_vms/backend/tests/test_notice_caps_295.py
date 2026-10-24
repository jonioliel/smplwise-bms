"""NOTICECAPS-295: the notice-board listener's total and per-address connection caps are settings an administrator edits
(`notices.boards.conn_total`, `notices.boards.conn_per_address`): defaults, validation, permission, read at connection time,
over-cap rejection. Loopback sockets only; no lab, no network."""
from __future__ import annotations

import socket
import threading
import time

import pytest

from conftest import as_user, bind
from smplwise.db import Database
from smplwise.services.notices import listener, model, store

API = "/api/v1"
HOLD = b"GET /b/x HTTP/1.1\r\nHost: x\r\n"  # an unfinished request keeps its slot


def _serve(**kw):
    svc = type("S", (), {})()
    handler = type("H", (listener._Handler,), {"svc": svc, "www_dir": None, "timeout": 5.0})
    server = listener._CappedServer(("127.0.0.1", 0), handler, **kw)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def _open_held(server, n):
    socks = []
    for _ in range(n):
        s = socket.create_connection(server.server_address, timeout=5)
        s.sendall(HOLD)
        socks.append(s)
    time.sleep(0.3)
    return socks


def _refused(server) -> bool:
    s = socket.create_connection(server.server_address, timeout=5)
    try:
        s.sendall(HOLD + b"\r\n")
        return s.recv(100) == b""
    except ConnectionError:
        return True
    finally:
        s.close()


def _stop(server, socks=()):
    for s in socks:
        s.close()
    server.shutdown()
    server.server_close()


# ---------------------------------------------------------------- defaults and validation (no server)

def test_defaults_keep_the_existing_total_and_add_a_per_address_default():
    assert listener.MAX_CONNECTIONS == 32 and listener.MAX_PER_ADDRESS == 8
    doc = model.settings_doc(lambda k, d: d)
    assert doc["conn_total"] == 32 and doc["conn_per_address"] == 8


@pytest.mark.parametrize("field,good,bad", [
    ("conn_total", [4, 32, 256], [3, 257, 0, -1, True, "32", 32.5]),
    ("conn_per_address", [1, 8, 64], [0, 65, -1, True, "8", 8.5]),
])
def test_validation_bounds(field, good, bad):
    for v in good:
        assert model.settings_values({field: v}) == {model.SETTINGS_FIELDS[field]: str(v)}
    for v in bad:
        with pytest.raises(model.Invalid):
            model.settings_values({field: v})


def test_a_stored_out_of_range_value_is_clamped_when_read():
    doc = model.settings_doc(lambda k, d: {"notices.boards.conn_total": "100000", "notices.boards.conn_per_address": "junk"}.get(k, d))
    assert doc["conn_total"] == 256 and doc["conn_per_address"] == 8


def test_settings_caps_reads_the_stored_values(client, settings):
    db = Database(settings.db_path)
    read = listener.settings_caps(lambda: db.connection(mode="read", label="test"))
    assert read() == (32, 8)
    with db.connection() as conn:
        store.write_settings(conn, model.settings_values({"conn_total": 12, "conn_per_address": 3}))
    assert read() == (12, 3)


def test_cached_caps_reads_at_most_once_per_ttl():
    now = [0.0]
    calls = []

    def read():
        calls.append(1)
        return (len(calls), 1)

    get = listener.cached_caps(read, ttl=2.0, clock=lambda: now[0])
    assert get() == (1, 1) and get() == (1, 1) and len(calls) == 1
    now[0] = 2.5
    assert get() == (2, 1)


# ---------------------------------------------------------------- the API: validation and permission

def test_api_edit_validation_and_permission(client, settings):
    got = client.get(f"{API}/notices/settings").json()["settings"]
    assert got["conn_total"] == 32 and got["conn_per_address"] == 8
    r = client.patch(f"{API}/notices/settings", json={"conn_total": 64, "conn_per_address": 4})
    assert r.status_code == 200 and (r.json()["settings"]["conn_total"], r.json()["settings"]["conn_per_address"]) == (64, 4)
    assert client.patch(f"{API}/notices/settings", json={"conn_total": 3}).status_code == 422
    assert client.patch(f"{API}/notices/settings", json={"conn_total": 257}).status_code == 422
    assert client.patch(f"{API}/notices/settings", json={"conn_per_address": 0}).status_code == 422
    assert client.patch(f"{API}/notices/settings", json={"conn_per_address": 65}).status_code == 422
    assert client.get(f"{API}/notices/settings").json()["settings"]["conn_total"] == 64  # refusals changed nothing
    bind(client, settings, "dana", "viewer", "installation", "*")
    assert client.patch(f"{API}/notices/settings", json={"conn_total": 10}, headers=as_user("dana")).status_code == 403


# ---------------------------------------------------------------- the listener: over-cap rejection and runtime change

def test_total_cap_rejects_over_the_cap():
    server = _serve(max_connections=2, max_per_address=50)
    held = _open_held(server, 2)
    try:
        assert _refused(server)
    finally:
        _stop(server, held)


def test_per_address_cap_rejects_over_the_cap_while_total_has_room():
    server = _serve(max_connections=50, max_per_address=2)
    held = _open_held(server, 2)
    try:
        assert _refused(server)  # all loopback clients share one address
    finally:
        _stop(server, held)
    assert server._total == 0 and not server._by_addr


def test_slots_come_back_after_connections_close():
    server = _serve(max_connections=2, max_per_address=2)
    held = _open_held(server, 2)
    for s in held:
        s.close()
    time.sleep(0.5)
    held2 = _open_held(server, 2)
    try:
        assert server._total == 2 and server._by_addr == {"127.0.0.1": 2}
    finally:
        _stop(server, held2)


def test_caps_change_at_runtime_without_a_restart():
    caps = [(2, 2)]
    server = _serve(caps=lambda: caps[0])
    held = _open_held(server, 2)
    try:
        assert _refused(server)
        caps[0] = (10, 10)  # the administrator raised the caps: the very next connection is admitted
        extra = _open_held(server, 1)
        assert server._total == 3
        held += extra
        caps[0] = (3, 1)  # lowered again: new connections are refused, the ones already open are left alone
        assert _refused(server)
        assert server._total == 3
    finally:
        _stop(server, held)


def test_a_failing_caps_read_keeps_the_last_good_values():
    state = {"fail": False}

    def caps():
        if state["fail"]:
            raise RuntimeError("db busy")
        return (2, 2)

    server = _serve(caps=caps)
    held = _open_held(server, 2)
    try:
        state["fail"] = True
        assert _refused(server)  # the failure did not open the gate
    finally:
        _stop(server, held)
