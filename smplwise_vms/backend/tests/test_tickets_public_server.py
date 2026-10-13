"""CR-038 public listener (services/tickets/public_server.py, spec 10.1) over a REAL socket on 127.0.0.1 (an ephemeral port):
the uvicorn configuration of the isolation table, no process-wide logging change, no signal capture, its own thread / loop /
4-token thread pool, start / stop, route enumeration and malformed / oversize / slow requests at the socket, keep-alive, the
16-connection cap, one upload in flight per link, and the main app having none of these routes. Nothing leaves 127.0.0.1;
every token and id is invented."""
from __future__ import annotations

import asyncio
import logging
import select
import signal
import socket
import threading
import time
import uuid

import anyio
import httpx
import pytest
import uvicorn
from fastapi import APIRouter

from smplwise.services.tickets import public_server as ps
from smplwise.services.tickets.public_http import ROUTES, RouteRule
from smplwise.services.tickets.public_log import ProtocolLog, PublicStats
from tests.tickets_public_fakes import build_world

UNIFORM = b'{"code":"link_unavailable"}'


def pool_router() -> APIRouter:
    r = APIRouter()

    @r.get("/t/api/test-pool")
    async def pool() -> dict:
        return {"thread": threading.current_thread().name,
                "tokens": anyio.to_thread.current_default_thread_limiter().total_tokens,
                "loop": id(asyncio.get_running_loop())}

    return r


TEST_RULES = tuple(RouteRule(r.method, r.pattern, r.template, r.kind, r.body, r.max_body, 1.0 if r.template == "/t/api/redeem" else r.deadline_s)
                   for r in ROUTES) + (RouteRule("GET", r"/t/api/test-pool", "/t/api/test-pool", "health"),)


@pytest.fixture()
def serve(tmp_path):
    listeners: list[ps.PublicListener] = []

    def start(*, trusted: tuple[str, ...] | None = None, head_timeout_s: float = ps.HEAD_TIMEOUT_S):
        world = build_world(tmp_path / f"w{len(listeners)}", routers=(pool_router(),), rules=TEST_RULES, trusted=trusted)
        lst = ps.PublicListener(f"tickets-public-test-{len(listeners)}")
        assert lst.start(world.app, host="127.0.0.1", port=0, head_timeout_s=head_timeout_s), lst.error
        listeners.append(lst)
        return world, lst

    yield start
    for lst in listeners:
        lst.stop()


def read_response(sock: socket.socket, timeout: float = 5.0) -> tuple[int, dict[str, str], bytes]:
    sock.settimeout(timeout)
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = sock.recv(65536)
        if not chunk:
            break
        data += chunk
    head, _, body = data.partition(b"\r\n\r\n")
    lines = head.decode("latin-1").split("\r\n")
    status = int(lines[0].split()[1]) if lines and len(lines[0].split()) > 1 else 0
    headers = {k.strip().lower(): v.strip() for k, _, v in (ln.partition(":") for ln in lines[1:])}
    n = int(headers.get("content-length", "0"))
    while len(body) < n:
        chunk = sock.recv(65536)
        if not chunk:
            break
        body += chunk
    return status, headers, body


def exchange(port: int, data: bytes, timeout: float = 5.0) -> tuple[int, dict[str, str], bytes]:
    with socket.create_connection(("127.0.0.1", port), timeout=timeout) as s:
        s.sendall(data)
        return read_response(s, timeout)


def closed_by_server(sock: socket.socket, within: float) -> bool:
    sock.settimeout(within)
    try:
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                return True
    except socket.timeout:
        return False
    except OSError:
        return True


# ---------------------------------------------------------------- configuration and isolation


def test_config_values_of_the_isolation_table_and_no_logging_side_effect():
    access, error = logging.getLogger("uvicorn.access"), logging.getLogger("uvicorn.error")
    before = (list(access.handlers), access.propagate, access.level, list(error.handlers), error.level, list(logging.getLogger().handlers))
    app = object()
    cfg = ps.build_config(app, host="127.0.0.1", port=0, public_log=ProtocolLog(PublicStats()))
    assert (cfg.access_log, cfg.server_header, cfg.date_header, cfg.proxy_headers, cfg.log_config) == (False, False, False, False, None)
    assert (cfg.limit_concurrency, cfg.timeout_keep_alive, cfg.h11_max_incomplete_event_size) == (16, 5, 16 * 1024)
    assert (cfg.ws, cfg.lifespan, cfg.http, cfg.backlog, cfg.timeout_graceful_shutdown) == ("none", "off", ps.PublicH11Protocol, 64, 3)
    assert cfg.forwarded_allow_ips == ""
    after = (list(access.handlers), access.propagate, access.level, list(error.handlers), error.level, list(logging.getLogger().handlers))
    assert after == before  # the main app's access / error logging is untouched (uvicorn would have emptied uvicorn.access)


def test_the_app_is_never_wrapped_even_at_trace_level(tmp_path):
    world = build_world(tmp_path)
    error = logging.getLogger("uvicorn.error")
    old = error.level
    error.setLevel(5)  # TRACE: uvicorn would wrap the app in its message logger (request bodies in the log)
    try:
        cfg = ps.build_config(world.app, host="127.0.0.1", port=0, public_log=ProtocolLog(PublicStats()))
        cfg.load()
        assert cfg.loaded_app is world.app
    finally:
        error.setLevel(old)


def test_no_signal_handler_is_ever_installed(serve):
    sigs = [signal.SIGINT, signal.SIGTERM]
    before = [signal.getsignal(s) for s in sigs]
    _world, lst = serve()
    assert [signal.getsignal(s) for s in sigs] == before
    assert lst.stop()
    assert [signal.getsignal(s) for s in sigs] == before
    # PublicServer never captures, even on the main thread ...
    server = ps.PublicServer(ps.build_config(object(), host="127.0.0.1", port=0, public_log=ProtocolLog(PublicStats())))
    with server.capture_signals():
        assert [signal.getsignal(s) for s in sigs] == before
    # ... and the pinned uvicorn (0.53) itself skips capture off the main thread, the property spec 10.1 rests on
    assert uvicorn.__version__ == "0.53.0"
    seen: list = []

    def probe():
        base = uvicorn.Server(uvicorn.Config(object(), log_config=None))
        with base.capture_signals():
            seen.append([signal.getsignal(s) for s in sigs])

    t = threading.Thread(target=probe)
    t.start()
    t.join(5)
    assert seen == [before]


def test_own_thread_own_loop_own_four_token_pool(serve):
    _world, lst = serve()
    with httpx.Client(base_url=f"http://127.0.0.1:{lst.port}") as c:
        info = c.get("/t/api/test-pool").json()
    assert info["thread"] == lst.name and info["tokens"] == ps.THREADPOOL_TOKENS
    assert lst.loop is not None and info["loop"] == id(lst.loop)
    with pytest.raises(RuntimeError):
        asyncio.get_running_loop()  # the test thread has no loop: the listener's is its own


def test_start_is_idempotent_stop_joins_and_closes_the_port(serve):
    _world, lst = serve()
    port = lst.port
    assert lst.running and lst.start(object(), host="127.0.0.1", port=0)  # a no-op while running
    assert lst.snapshot()["running"] is True and lst.snapshot()["port"] == port
    t0 = time.monotonic()
    assert lst.stop() is True and time.monotonic() - t0 < ps.STOP_JOIN_S
    assert not lst.running and lst.port is None and lst.stop() is True
    assert not any(t.name == lst.name and t.is_alive() for t in threading.enumerate())
    with pytest.raises(OSError):
        socket.create_connection(("127.0.0.1", port), timeout=1).close()


def test_a_busy_port_is_reported_not_swallowed(tmp_path):
    world = build_world(tmp_path)
    blocker = socket.socket()
    blocker.bind(("127.0.0.1", 0))
    blocker.listen(1)
    try:
        lst = ps.PublicListener("tickets-public-busy")
        assert lst.start(world.app, host="127.0.0.1", port=blocker.getsockname()[1]) is False
        assert lst.error in ("OSError", "PermissionError") and not lst.running
    finally:
        blocker.close()


# ---------------------------------------------------------------- at the socket


@pytest.mark.parametrize("request_line", [
    b"GET / HTTP/1.1", b"GET /docs HTTP/1.1", b"GET /openapi.json HTTP/1.1", b"GET //t/ HTTP/1.1", b"GET /t HTTP/1.1",
    b"GET /T/ HTTP/1.1", b"GET /t/../t/healthz HTTP/1.1", b"GET /t/%2e%2e/etc/passwd HTTP/1.1", b"GET /t/healthz/ HTTP/1.1",
    b"GET http://evil.example/t/healthz HTTP/1.1", b"OPTIONS /t/api/ticket HTTP/1.1", b"PUT /t/ HTTP/1.1", b"TRACE /t/ HTTP/1.1",
    b"PATCH /t/api/note HTTP/1.1", b"GET /api/v1/me HTTP/1.1", b"GET /arx/ HTTP/1.1",
])
def test_route_enumeration_at_the_socket(serve, request_line):
    _world, lst = serve()
    status, headers, body = exchange(lst.port, request_line + b"\r\nHost: t.example\r\nConnection: close\r\n\r\n")
    assert (status, body) == (404, UNIFORM) or status == 400, (request_line, status, body)
    assert "content-security-policy" in headers and "server" not in headers and "date" not in headers


@pytest.mark.parametrize("garbage", [b"GARBAGE\r\n\r\n", b"GET /t/ HTTP/1.1\r\nNoColonHeader\r\n\r\n",
                                     b"GET /t/ HTTP/1.1\r\nHost: a\r\nContent-Length: 5\r\nContent-Length: 6\r\n\r\n",
                                     b"\x16\x03\x01\x02\x00\x01\x00\x01\xfc\x03\x03" + b"\x00" * 40])
def test_malformed_requests_get_a_json_400_with_the_headers(serve, garbage):
    world, lst = serve()
    status, headers, body = exchange(lst.port, garbage)
    assert status == 400 and body == b'{"code":"bad_request"}' and headers.get("content-security-policy")
    assert headers.get("connection") == "close"
    assert world.app.stats.snapshot()["counters"].get("invalid_requests", 0) >= 1


def test_a_header_flood_is_cut_at_16_kib(serve):
    world, lst = serve()
    flood = b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\nX-Flood: " + b"a" * (20 * 1024) + b"\r\n\r\n"
    # a complete oversize head in one segment: h11 parses it, the edge refuses it
    status, headers, body = exchange(lst.port, flood)
    assert (status, body) == (431, b'{"code":"headers_too_large"}') and headers.get("connection") == "close"
    many = b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n" + b"".join(b"X-H%d: 1\r\n" % i for i in range(80)) + b"\r\n"
    assert exchange(lst.port, many)[0] == 431
    # the same head trickling in: h11's incomplete-event cap (16 KiB) cuts it before it is complete; the client stops sending
    # once an answer is readable (a server that closes on unread bytes may RESET the client, which proves the cut as well)
    got: object = None
    with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
        try:
            for i in range(0, len(flood) - 4, 1024):
                s.sendall(flood[i:i + 1024])
                time.sleep(0.005)
                if select.select([s], [], [], 0)[0]:
                    got = read_response(s)
                    break
            else:
                got = read_response(s)
        except OSError:
            got = "reset"
    assert got == "reset" or (got[0], got[2]) == (400, b'{"code":"bad_request"}'), got  # type: ignore[index]
    assert world.app.stats.snapshot()["counters"].get("headers_too_large") == 2
    assert world.app.stats.snapshot()["counters"].get("invalid_requests", 0) >= 1


def test_a_slow_request_head_is_closed(serve):
    world, lst = serve(head_timeout_s=1.0)
    with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
        s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.ex")  # never finishes its head
        assert closed_by_server(s, within=4.0)
    with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:  # a silent connection too
        assert closed_by_server(s, within=4.0)
    assert world.app.stats.snapshot()["counters"].get("slow_heads_closed", 0) >= 2


def test_connection_lifetime_cap_applies_between_requests(tmp_path):
    world = build_world(tmp_path)
    lst = ps.PublicListener("tickets-public-lifetime")
    assert lst.start(world.app, host="127.0.0.1", port=0, max_connection_s=1.0)
    try:
        with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
            s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
            assert read_response(s)[0] == 200
            time.sleep(1.2)
            s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")  # answered or closed - never cut halfway
            try:
                status = read_response(s)[0]
            except OSError:
                status = 0
            assert status in (200, 0)
            assert closed_by_server(s, within=3.0)
        assert world.app.stats.snapshot()["counters"].get("lifetime_closed", 0) >= 1
    finally:
        lst.stop()


def test_a_trickling_body_meets_the_read_deadline(serve):
    world, lst = serve()  # the test rules give /t/api/redeem a 1 s deadline (10 s in production)
    with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
        s.sendall(b"POST /t/api/redeem HTTP/1.1\r\nHost: t.example\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{\"ri")
        status, headers, body = read_response(s, timeout=5)
        assert status == 408 and body == b'{"code":"body_timeout"}' and headers.get("connection") == "close"
        assert closed_by_server(s, within=3)
    assert world.app.stats.snapshot()["counters"].get("body_timeouts") == 1


def test_a_large_unread_body_closes_the_connection(serve):
    _world, lst = serve()
    with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
        s.sendall(b"POST /t/api/photo HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + b"Q" * 32 +
                  b"\r\nContent-Type: multipart/form-data; boundary=b\r\nContent-Length: 200000\r\n\r\n" + b"--b\r\n" + b"x" * 1000)
        status, headers, body = read_response(s)
        assert status == 404 and body == UNIFORM and headers.get("connection") == "close"
        assert closed_by_server(s, within=3)


def test_a_small_unread_body_is_drained_so_the_answer_arrives_and_the_connection_lives(serve):
    """An early answer (here the uniform 404 of an unknown token) on a request whose small body was not needed: the edge reads
    and discards the body first - closing a socket with unread bytes makes the kernel send a RESET that can destroy the
    answer - and the kept-alive connection serves the next request."""
    _world, lst = serve()
    with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
        body = b'{"text":"' + b"y" * 3000 + b'"}'
        s.sendall(b"POST /t/api/note HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + b"Q" * 32 +
                  b"\r\nContent-Type: application/json\r\nContent-Length: " + str(len(body)).encode() + b"\r\n\r\n" + body)
        status, headers, answer = read_response(s)
        assert status == 404 and answer == UNIFORM and "connection" not in headers
        s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
        assert read_response(s)[:1] == (200,)


def test_keep_alive_idles_out_after_five_seconds(serve):
    _world, lst = serve()
    with socket.create_connection(("127.0.0.1", lst.port), timeout=10) as s:
        s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
        assert read_response(s)[0] == 200
        t0 = time.monotonic()
        assert closed_by_server(s, within=8.0)
        assert 4.0 <= time.monotonic() - t0 <= 7.5


def test_the_sixteen_connection_cap(serve):
    """uvicorn's limit_concurrency counts the arriving connection itself: with 15 kept-alive connections open, the 16th
    connection's request is answered 503 and nothing more is served until connections go."""
    world, lst = serve()
    held: list[socket.socket] = []
    statuses: list[int] = []
    try:
        for _ in range(16):
            s = socket.create_connection(("127.0.0.1", lst.port), timeout=5)
            s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
            statuses.append(read_response(s)[0])
            held.append(s)  # kept alive
        assert statuses == [200] * 15 + [503]
        assert world.app.stats.snapshot()["counters"].get("concurrency_refusals") == 1
    finally:
        for s in held:
            s.close()
    time.sleep(0.3)
    assert exchange(lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\nConnection: close\r\n\r\n")[0] == 200


def test_one_upload_in_flight_per_link_at_the_socket(serve):
    world, lst = serve()
    link, tok = world.links.add()
    boundary = b"xYz123boundary"
    head = (b"POST /t/api/photo HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + tok.encode() +
            b"\r\nContent-Type: multipart/form-data; boundary=" + boundary + b"\r\nContent-Length: 200000\r\n\r\n")
    first = socket.create_connection(("127.0.0.1", lst.port), timeout=5)
    try:
        first.sendall(head + b"--" + boundary + b"\r\n")  # a slow upload: the rest never comes
        time.sleep(0.5)
        with httpx.Client(base_url=f"http://127.0.0.1:{lst.port}") as c:
            r = c.post("/t/api/photo", headers={"x-ticket-token": tok}, files={"file": ("a.jpg", b"\xff\xd8\xff", "image/jpeg")},
                       data={"client_request_id": str(uuid.uuid4())})
        assert r.status_code == 429 and r.json()["code"] == "busy"
    finally:
        first.close()


def test_lookups_stay_answered_while_uploads_wait_for_a_held_decoder(tmp_path):
    """Four uploads (four links) meet a decoder held elsewhere (e.g. an internal upload). Only ONE may wait inside a worker
    thread; the others wait on the listener's loop - so the four-token pool still serves every token lookup meanwhile."""
    import io

    from PIL import Image

    from smplwise.services.tickets import image_intake as ii

    world = build_world(tmp_path, decode_wait_s=3.0)
    lst = ps.PublicListener("tickets-public-decode")
    assert lst.start(world.app, host="127.0.0.1", port=0)
    buf = io.BytesIO()
    Image.new("RGB", (64, 48), (1, 2, 3)).save(buf, "JPEG")
    tokens = [world.links.add()[1] for _ in range(4)]
    results: list[int] = []
    assert ii._DECODE.acquire(timeout=5)  # noqa: SLF001 - someone else is decoding
    try:
        def up(tok: str) -> None:
            with httpx.Client(base_url=f"http://127.0.0.1:{lst.port}", timeout=20) as c:
                r = c.post("/t/api/photo", headers={"x-ticket-token": tok}, data={"client_request_id": str(uuid.uuid4())},
                           files={"file": ("a.jpg", buf.getvalue(), "image/jpeg")})
                results.append(r.status_code)

        threads = [threading.Thread(target=up, args=(t,)) for t in tokens]
        for t in threads:
            t.start()
        time.sleep(0.8)  # every upload has reached the decode stage by now
        t0 = time.monotonic()
        with httpx.Client(base_url=f"http://127.0.0.1:{lst.port}") as c:
            for _ in range(5):
                assert c.get("/t/api/photo/ffffffffffffffff", headers={"x-ticket-token": tokens[0]}).status_code == 404
        assert time.monotonic() - t0 < 2.0
    finally:
        ii._DECODE.release()  # noqa: SLF001
    for t in threads:
        t.join(20)
    lst.stop()
    assert sorted(results) and all(code in (201, 429) for code in results) and 201 in results


def test_cf_connecting_ip_over_the_socket_with_a_trusted_local_peer(serve):
    world, lst = serve(trusted=("127.0.0.0/8",))
    path = "/t/api/photo/a1b2c3d4e5f60718"  # a token route that resolves its link (one lookup each)
    with httpx.Client(base_url=f"http://127.0.0.1:{lst.port}") as c:
        for _ in range(20):
            assert c.get(path, headers={"x-ticket-token": "Z" * 32, "cf-connecting-ip": "198.51.100.77"}).status_code == 404
        assert world.links.lookups == 20
        assert c.get(path, headers={"x-ticket-token": "Z" * 32, "cf-connecting-ip": "198.51.100.99"}).status_code == 429
        assert world.links.lookups == 20  # refused before the lookup
        assert c.get(path, headers={"x-ticket-token": "Z" * 32, "cf-connecting-ip": "203.0.113.9"}).status_code == 404


# ---------------------------------------------------------------- the main app has none of it


def test_the_main_app_serves_no_public_route(settings):
    from fastapi.testclient import TestClient

    from smplwise.main import create_app

    with TestClient(create_app(settings)) as c:
        for path in ("/t/", "/t/healthz", "/t/api/ticket", f"/t/r/{'a' * 32}", "/api/v1/public/ticket", "/arx/t/"):
            r = c.get(path, headers={"x-ticket-token": "A" * 32})
            assert r.status_code == 404, path
        assert c.post("/t/api/redeem", json={"rid": "a" * 32}).status_code in (404, 405)
