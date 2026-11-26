"""CAST-RELAY-HARDEN-2540 (deep review V-02): the cast relay - the add-on's one unauthenticated listener - has the socket bounds of the
other LAN listeners: a per-read socket timeout, a deadline for each whole request (so a slow-loris client that drips a byte at a time
is cut off too), a cap on simultaneous connections in total and per client address (over it the socket is closed without a thread),
and a capped list of HLS ids per token. The real listener runs on 127.0.0.1 with a fake go2rtc; nothing else is contacted."""
from __future__ import annotations

import socket
import threading
import time

import httpx
import pytest

from smplwise.services import cast_relay as cr
from smplwise.services import lan_listener

TOKEN = "e" * 32
SESSION = "f" * 32
STREAM = "smplwise_nvr-1_ch1_sub"
MEDIA = b"#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:1.0,\nsegment.m4s?id=Hx01&n=1\n"


class FakeGo2rtc:
    def __init__(self) -> None:
        self.n = 0

    def __call__(self, path: str, params: dict[str, str]) -> tuple[int, bytes]:
        if path == "/api/stream.m3u8":
            self.n += 1  # every master names a new go2rtc HLS session, as go2rtc does after its own session expired
            return 200, f"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nhls/playlist.m3u8?id=Hx{self.n:02d}\n".encode()
        if path == "/api/hls/playlist.m3u8":
            return 200, MEDIA.replace(b"Hx01", params["id"].encode())
        return 200, b"\x00\x00\x00\x18ftypmp42"


@pytest.fixture()
def relay(monkeypatch):
    """A relay of its own (not the module's SERVER) with short bounds, so the test takes seconds."""
    monkeypatch.setattr(cr._Handler, "timeout", 1.0)
    monkeypatch.setattr(cr._Handler, "request_deadline_s", 1.5)
    monkeypatch.setattr(cr, "MAX_CONNECTIONS", 6)
    monkeypatch.setattr(cr, "MAX_PER_ADDRESS", 3)
    cr.INDEX.put(TOKEN, SESSION, STREAM, None)
    server = cr.RelayServer()
    assert server.start(FakeGo2rtc(), host="127.0.0.1", port=0)
    yield server
    server.stop()
    cr.INDEX.drop(SESSION)


def _connect(server) -> socket.socket:
    s = socket.create_connection(("127.0.0.1", server.port), timeout=10)
    return s


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


def _open(server) -> int:
    return server._server.open_connections()  # type: ignore[union-attr]


def _wait(cond, seconds: float = 5.0) -> bool:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if cond():
            return True
        time.sleep(0.02)
    return cond()


def test_a_connection_that_sends_nothing_is_closed_and_frees_its_thread(relay):
    s = _connect(relay)
    assert _wait(lambda: _open(relay) == 1)
    took = _closed_within(s, 6)
    assert took is not None and took < 4, "an idle connection is closed after the socket timeout"
    assert _wait(lambda: _open(relay) == 0), "its slot (and thread) is released"
    s.close()


def test_a_slow_loris_that_drips_a_byte_inside_the_read_timeout_is_cut_off_by_the_request_deadline(relay):
    s = _connect(relay)
    request = f"GET /cast/{TOKEN}/index.m3u8 HTTP/1.1\r\nHost: tv\r\nX-Pad: {'a' * 200}\r\n\r\n".encode()
    stop = threading.Event()
    cut_at: list[float] = []
    t0 = time.monotonic()

    def drip() -> None:
        for b in request:  # one byte every 0.3 s: each read is well inside the 1 s socket timeout
            if stop.is_set():
                return
            try:
                s.send(bytes([b]))
            except OSError:
                cut_at.append(time.monotonic() - t0)
                return
            time.sleep(0.3)

    th = threading.Thread(target=drip, daemon=True)
    th.start()
    took = _closed_within(s, 8)
    stop.set()
    th.join(5)
    s.close()
    assert took is not None, "the server closed the dripping connection"
    assert took < 4, f"cut off by the whole-request deadline (1.5 s), not after the whole request ({took:.1f} s)"
    assert _wait(lambda: _open(relay) == 0)


def test_the_per_address_cap_closes_the_extra_connection_without_a_thread_and_a_tv_is_served_after(relay):
    held = [_connect(relay) for _ in range(3)]
    assert _wait(lambda: _open(relay) == 3)
    extra = _connect(relay)
    took = _closed_within(extra, 2)
    assert took is not None and took < 1, "over the per-address cap the socket is closed at once"
    assert _open(relay) == 3 and relay._server.refused >= 1  # type: ignore[union-attr]
    extra.close()
    for s in held:
        s.close()
    assert _wait(lambda: _open(relay) == 0)
    r = httpx.get(f"http://127.0.0.1:{relay.port}/cast/{TOKEN}/index.m3u8", timeout=5)
    assert r.status_code == 200 and b"hls/playlist.m3u8?id=" in r.content


def test_the_total_cap_holds_whatever_the_address(monkeypatch):
    server = lan_listener.CappedServer(("127.0.0.1", 0), cr._Handler, max_connections=2, max_per_address=10)
    server.fetch = lambda p, q: (404, b"")  # type: ignore[attr-defined]
    monkeypatch.setattr(cr._Handler, "timeout", 1.0)
    monkeypatch.setattr(cr._Handler, "request_deadline_s", 3.0)
    th = threading.Thread(target=server.serve_forever, daemon=True)
    th.start()
    try:
        port = server.server_address[1]
        held = [socket.create_connection(("127.0.0.1", port), timeout=5) for _ in range(2)]
        assert _wait(lambda: server.open_connections() == 2)
        extra = socket.create_connection(("127.0.0.1", port), timeout=5)
        took = _closed_within(extra, 2)
        assert took is not None and took < 1
        extra.close()
        for s in held:
            s.close()
    finally:
        server.shutdown()
        server.server_close()


def test_a_kept_alive_tv_is_served_request_after_request_and_its_idle_connection_ends(relay):
    with httpx.Client(timeout=5) as tv:
        base = f"http://127.0.0.1:{relay.port}/cast/{TOKEN}"
        for _ in range(3):
            r = tv.get(f"{base}/index.m3u8")
            assert r.status_code == 200
            hls = r.text.strip().splitlines()[-1]
            assert tv.get(f"{base}/{hls}").status_code == 200
            time.sleep(0.4)  # a TV's poll gap, inside the deadline: the kept-alive connection serves the next request
        assert _open(relay) == 1, "one kept-alive connection for the whole run"
    assert _wait(lambda: _open(relay) == 0)


def test_the_hls_ids_of_a_long_lived_token_are_capped_newest_kept(monkeypatch):
    monkeypatch.setattr(cr, "PLAYLIST_RATE", (1000.0, 1000.0))  # the days of a permanent cast in a moment (the rate limit has its own test)
    index = cr.Index()
    index.put(TOKEN, SESSION, STREAM, None)
    g = FakeGo2rtc()
    for _ in range(cr.HLS_IDS_MAX + 4):
        assert cr.handle("GET", f"/cast/{TOKEN}/index.m3u8", g, index=index).status == 200
    entry = index.lookup(TOKEN)
    assert entry is not None and len(entry.hls_ids) == cr.HLS_IDS_MAX
    newest = f"Hx{g.n:02d}"
    oldest = "Hx01"
    assert cr.handle("GET", f"/cast/{TOKEN}/hls/playlist.m3u8?id={newest}", g, index=index).status == 200
    assert cr.handle("GET", f"/cast/{TOKEN}/hls/playlist.m3u8?id={oldest}", g, index=index).status == 403, "an id dropped from the list is refused"


def test_the_notice_listener_keeps_its_capped_server():
    from smplwise.services.notices import listener

    assert listener._CappedServer is lan_listener.CappedServer
