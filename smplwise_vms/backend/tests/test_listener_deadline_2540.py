"""LISTENER-DEADLINE-2540 (follow-up of CAST-RELAY-HARDEN-2540, deep review V-02): the notice-board listener and the Provision-ISR
alarm push listener get the cast relay's whole-request deadline (services/lan_listener.RequestDeadline), so a slow-loris client that
drips a byte inside the per-read socket timeout is cut off too; the push listener's deadline covers its body as well, and its
connection limiter is the shared `CappedServer`. Real listeners on 127.0.0.1 with short bounds; nothing else is contacted."""
from __future__ import annotations

import socket
import threading
import time

import httpx
import pytest

from smplwise.services import lan_listener
from smplwise.services.notices import listener as notices
from smplwise.services.recorders import provision_push as ppush
from smplwise.services.recorders.provision_push import PushListener, PushReceiver

STATUS = b"""<config version="1.0" xmlns="http://www.ipc.com/ver10"><alarmStatusInfo><motionAlarm type="boolean" id="3">true</motionAlarm></alarmStatusInfo></config>"""
READ_TIMEOUT = 1.0  # every byte below arrives well inside it
DEADLINE = 1.5


def _closed_within(s: socket.socket, seconds: float) -> float | None:
    """Seconds until the server closed `s` (read EOF or reset), None when it stayed open that long."""
    t0 = time.monotonic()
    s.settimeout(seconds)
    try:
        while True:
            data = s.recv(4096)
            if not data:
                return time.monotonic() - t0
    except (ConnectionResetError, ConnectionAbortedError):
        return time.monotonic() - t0
    except TimeoutError:
        return None


def _drip(s: socket.socket, data: bytes, every: float, stop: threading.Event) -> threading.Thread:
    def run() -> None:
        for b in data:
            if stop.is_set():
                return
            try:
                s.send(bytes([b]))
            except OSError:
                return
            time.sleep(every)

    th = threading.Thread(target=run, daemon=True)
    th.start()
    return th


def _wait(cond, seconds: float = 5.0) -> bool:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if cond():
            return True
        time.sleep(0.02)
    return cond()


def _slow_loris(port: int, payload: bytes, seconds: float = 8.0) -> float | None:
    s = socket.create_connection(("127.0.0.1", port), timeout=10)
    stop = threading.Event()
    th = _drip(s, payload, 0.3, stop)  # one byte every 0.3 s: each read is well inside the 1 s socket timeout
    try:
        return _closed_within(s, seconds)
    finally:
        stop.set()
        th.join(5)
        s.close()


# ---------------------------------------------------------------- the notice-board listener

@pytest.fixture()
def board():
    svc = type("S", (), {})()
    handler = type("H", (notices._Handler,), {"svc": svc, "www_dir": None, "timeout": READ_TIMEOUT, "request_deadline_s": DEADLINE})
    server = notices._CappedServer(("127.0.0.1", 0), handler, max_connections=8, max_per_address=4)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield server
    server.shutdown()
    server.server_close()


def test_the_notice_handler_declares_a_bounded_request_deadline():
    assert issubclass(notices._Handler, lan_listener.RequestDeadline)
    assert 0 < notices._Handler.request_deadline_s <= 30 and notices.REQUEST_DEADLINE_S == notices._Handler.request_deadline_s
    assert 0 < notices._Handler.timeout <= notices._Handler.request_deadline_s


def test_a_slow_loris_on_the_notice_listener_is_cut_off_by_the_request_deadline(board):
    port = board.server_address[1]
    took = _slow_loris(port, f"GET /b/slug HTTP/1.1\r\nHost: tv\r\nX-Pad: {'a' * 200}\r\n\r\n".encode())
    assert took is not None, "the server closed the dripping connection"
    assert took < 4, f"cut off by the whole-request deadline ({DEADLINE} s), not after the whole request ({took:.1f} s)"
    assert _wait(lambda: board.open_connections() == 0), "its slot (and thread) is released"


def test_a_tv_on_the_notice_listener_is_still_answered(board):
    r = httpx.get(f"http://127.0.0.1:{board.server_address[1]}/nothing-here", timeout=5)
    assert r.status_code == 404  # the routing is unchanged: an unknown path is a 404, answered after the deadline was cleared
    r = httpx.post(f"http://127.0.0.1:{board.server_address[1]}/b/slug", timeout=5)
    assert r.status_code == 405


# ---------------------------------------------------------------- the Provision-ISR alarm push listener

@pytest.fixture()
def push(monkeypatch):
    monkeypatch.setattr(ppush, "HANDLER_TIMEOUT_S", READ_TIMEOUT)
    monkeypatch.setattr(ppush, "REQUEST_DEADLINE_S", DEADLINE, raising=False)  # raising=False: the before-run (no deadline) is behavioural
    got: list[str] = []
    rx = PushReceiver("nvr-2")
    lst = PushListener({}, lambda rid, alerts: got.append(rid), host="127.0.0.1", port=0, tokens={"tok": (rx, None)})
    lst.start()
    lst.got = got  # type: ignore[attr-defined]
    yield lst
    lst.stop()


def test_the_push_listener_uses_the_shared_limiter_and_a_bounded_deadline():
    assert 0 < ppush.REQUEST_DEADLINE_S <= 60 and ppush.HANDLER_TIMEOUT_S <= ppush.REQUEST_DEADLINE_S
    lst = PushListener({}, lambda rid, alerts: None, host="127.0.0.1", port=0)
    try:
        assert isinstance(lst._server, lan_listener.CappedServer)
        assert lst._server._current_caps() == (ppush.MAX_CONNECTIONS, ppush.MAX_PER_SOURCE)
    finally:
        lst._server.server_close()


def test_a_slow_loris_on_the_push_headers_is_cut_off_by_the_request_deadline(push):
    took = _slow_loris(push.port, f"POST /tok/SendAlarmStatus HTTP/1.0\r\nHost: x\r\nX-Pad: {'a' * 200}\r\n".encode())
    assert took is not None and took < 4, took
    assert _wait(lambda: push._server.open_connections() == 0)


def test_a_dripped_push_body_is_cut_off_and_never_reaches_the_sink(push):
    body = STATUS * 4
    s = socket.create_connection(("127.0.0.1", push.port), timeout=10)
    s.sendall(f"POST /tok/SendAlarmStatus HTTP/1.0\r\nHost: x\r\nContent-Length: {len(body)}\r\n\r\n".encode())  # headers at once
    stop = threading.Event()
    th = _drip(s, body, 0.3, stop)  # then the body a byte at a time, each inside the read timeout
    try:
        took = _closed_within(s, 8)
    finally:
        stop.set()
        th.join(5)
        s.close()
    assert took is not None and took < 4, "the deadline covers the body too"
    assert push.got == [], "a cut-off push is never handled"
    assert _wait(lambda: push._server.open_connections() == 0)


def test_a_recorder_push_is_still_answered_and_handled(push):
    with httpx.Client(timeout=5) as c:
        r = c.post(f"http://127.0.0.1:{push.port}/tok/SendAlarmStatus", content=STATUS)
    assert r.status_code == 200 and r.http_version == "HTTP/1.0"
    assert _wait(lambda: push.got == ["nvr-2"])


def test_the_push_per_source_cap_closes_the_extra_socket_and_counts_it(monkeypatch, push):
    monkeypatch.setattr(ppush, "MAX_PER_SOURCE", 2)  # read at every connection
    held = [socket.create_connection(("127.0.0.1", push.port), timeout=5) for _ in range(2)]
    try:
        assert _wait(lambda: push._server.open_connections() == 2)
        extra = socket.create_connection(("127.0.0.1", push.port), timeout=5)
        took = _closed_within(extra, 2)
        extra.close()
        assert took is not None and took < 1, "over the cap the socket is closed at once"
        assert push.limited >= 1 and push._server.refused >= 1
    finally:
        for s in held:
            s.close()
    assert _wait(lambda: push._server.open_connections() == 0)
