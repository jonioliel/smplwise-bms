"""CR-038 public listener (services/tickets/public_server.py, spec 10.1) over a REAL socket on 127.0.0.1 (an ephemeral port):
the uvicorn configuration of the isolation table, no process-wide logging change, no signal capture, its own thread / loop /
6-token thread pool, start / stop, route enumeration and malformed / oversize / slow requests at the socket, keep-alive, the
request cap and the connection budget (JSON 503 with the headers), the drain rules (code review V1), upload starvation and
trickles (V2), slow readers and the lifetime backstop, one upload in flight per link, and the main app having none of these
routes. Nothing leaves 127.0.0.1; every token and id is invented."""
from __future__ import annotations

import asyncio
import logging
import secrets
import select
import signal
import socket
import threading
import time
import uuid

import os

import anyio
import httpx
import pytest
import uvicorn
from conftest import sw_time_factor
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from smplwise.services.tickets import links
from smplwise.services.tickets import public_server as ps
from smplwise.services.tickets.public_http import ROUTES, RouteRule
from smplwise.services.tickets.public_log import ProtocolLog, PublicStats
from tests.tickets_public_fakes import build_world, wait_until

UNIFORM = b'{"code":"link_unavailable"}'
BUSY = b'{"code":"busy","retry_after_s":1}'
HOLD = threading.Event()


def pool_router() -> APIRouter:
    r = APIRouter()

    @r.get("/t/api/test-pool")
    async def pool() -> dict:
        return {"thread": threading.current_thread().name,
                "tokens": anyio.to_thread.current_default_thread_limiter().total_tokens,
                "loop": id(asyncio.get_running_loop())}

    @r.get("/t/api/test-hold")
    async def hold() -> dict:  # a request that stays in flight until the test lets it go
        while not HOLD.is_set():
            await asyncio.sleep(0.01)
        return {"held": True}

    @r.get("/t/api/test-big")
    async def big() -> StreamingResponse:  # 32 MiB, produced only as fast as the client reads (flow control)
        async def chunks():
            for _ in range(128):
                yield b"x" * 262144

        return StreamingResponse(chunks(), media_type="application/octet-stream")

    return r


def _test_rule(r: RouteRule) -> RouteRule:
    deadline = 1.0 if r.template == "/t/api/redeem" else r.deadline_s
    idle = 1.0 if r.kind in ("photo", "claim_file") else r.idle_s  # production: 5 s
    return RouteRule(r.method, r.pattern, r.template, r.kind, r.body, r.max_body, deadline, idle)


TEST_RULES = tuple(_test_rule(r) for r in ROUTES) + (
    RouteRule("GET", r"/t/api/test-pool", "/t/api/test-pool", "health"),
    RouteRule("GET", r"/t/api/test-hold", "/t/api/test-hold", "health"),
    RouteRule("GET", r"/t/api/test-big", "/t/api/test-big", "health"),
)


@pytest.fixture()
def serve(tmp_path):
    listeners: list[ps.PublicListener] = []
    HOLD.clear()

    def start(*, trusted: tuple[str, ...] | None = None, head_timeout_s: float = ps.HEAD_TIMEOUT_S, **kw):
        world = build_world(tmp_path / f"w{len(listeners)}", routers=(pool_router(),), rules=TEST_RULES, trusted=trusted)
        lst = ps.PublicListener(f"tickets-public-test-{len(listeners)}")
        kw.setdefault("per_network_connections", 64)  # every test client is 127.0.0.1; the budget has its own tests
        assert lst.start(world.app, host="127.0.0.1", port=0, head_timeout_s=head_timeout_s, **kw), lst.error
        listeners.append(lst)
        return world, lst

    yield start
    HOLD.set()
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
    # uvicorn's own cap is off (it counted idle keep-alive connections and answered a bare 503): the edge and the budget cap
    assert (cfg.limit_concurrency, cfg.timeout_keep_alive, cfg.h11_max_incomplete_event_size) == (None, 5, 16 * 1024)
    budget = cfg.connection_budget
    assert (budget.soft, budget.hard, budget.per_network) == (ps.MAX_CONNECTIONS, ps.HARD_MAX_CONNECTIONS, ps.PER_NETWORK_CONNECTIONS)
    assert (cfg.lifetime_grace_s, cfg.write_stall_s) == (ps.LIFETIME_GRACE_S, ps.WRITE_STALL_S)
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


def raw_exchange(port: int, data: bytes, timeout: float = 5.0) -> bytes:
    """Every byte the server sends until it closes (the whole answer, headers in their order)."""
    with socket.create_connection(("127.0.0.1", port), timeout=timeout) as s:
        s.sendall(data)
        out = b""
        try:
            while True:
                chunk = s.recv(65536)
                if not chunk:
                    break
                out += chunk
        except OSError:
            pass
        return out


ACCEPTED_SCANS = [
    b"GET http://evil.example/t/healthz HTTP/1.1",  # absolute form: h11 accepts it; the edge matches the path - not a route
    b"GET t/healthz HTTP/1.1",  # no leading slash: accepted by h11, matches nothing
    b"GET / HTTP/1.1", b"GET /docs HTTP/1.1", b"GET /openapi.json HTTP/1.1", b"GET //t/ HTTP/1.1", b"GET /t HTTP/1.1",
    b"GET /T/ HTTP/1.1", b"GET /t/../t/healthz HTTP/1.1", b"GET /t/%2e%2e/etc/passwd HTTP/1.1", b"GET /t/healthz/ HTTP/1.1",
    b"OPTIONS /t/api/ticket HTTP/1.1", b"PUT /t/ HTTP/1.1", b"TRACE /t/ HTTP/1.1", b"PATCH /t/api/note HTTP/1.1",
    b"GET /api/v1/me HTTP/1.1", b"GET /arx/ HTTP/1.1", b"DELETE /t/api/photo/a1b2c3d4 HTTP/1.1", b"GET /t/api/ticket?x=1 HTTP/1.1",
]
# request lines h11 itself refuses: the protocol's own JSON 400, these exact bytes
REFUSED_SCANS = [b"GET /t/\x00 HTTP/1.1", b"GET /t/ x HTTP/1.1", b"GET /t/\x7f HTTP/1.1", b"GET /t/\xff HTTP/1.1"]


def test_route_enumeration_at_the_socket(serve):
    """Code review section 2: every scan h11 accepts answers EXACTLY the bytes of the reference uniform 404 (status, headers
    in order, body) - an unknown path, another method, a trailing slash, an absolute-form target, a query on a token route;
    the lines h11 refuses answer exactly the protocol's JSON 400. Compared byte for byte, not "404 or 400"."""
    _world, lst = serve()
    tail = b"\r\nHost: t.example\r\nConnection: close\r\n\r\n"
    reference = raw_exchange(lst.port, b"GET /t/no-such-route HTTP/1.1" + tail)
    assert reference.startswith(b"HTTP/1.1 404 ") and reference.endswith(UNIFORM) and b"content-security-policy" in reference
    assert b"server:" not in reference.lower() and b"date:" not in reference.lower()
    for line in ACCEPTED_SCANS:
        assert raw_exchange(lst.port, line + tail) == reference, line
    bad = raw_exchange(lst.port, b"GARBAGE\r\n\r\n")
    assert bad.startswith(b"HTTP/1.1 400 ") and bad.endswith(b'{"code":"bad_request"}')
    for line in REFUSED_SCANS:
        assert raw_exchange(lst.port, line + tail) == bad, line


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
    if os.name == "nt":  # Windows resets a socket closed on unread bytes, which may destroy the 400 - the cut is proved either way
        assert got == "reset" or (got[0], got[2]) == (400, b'{"code":"bad_request"}'), got  # type: ignore[index]
    else:  # Linux (the add-on): the 400 with its headers must arrive
        assert got != "reset" and (got[0], got[2]) == (400, b'{"code":"bad_request"}'), got  # type: ignore[index]
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


def test_an_over_age_connection_answers_its_next_request_then_closes(tmp_path):
    """The lifetime cap never closes a socket a proxy may be reusing right now: the next request is answered in full and the
    connection closes after it (review finding 11)."""
    world = build_world(tmp_path)
    lst = ps.PublicListener("tickets-public-lifetime")
    assert lst.start(world.app, host="127.0.0.1", port=0, max_connection_s=1.0)
    try:
        with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
            s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
            assert read_response(s)[0] == 200
            # over age, still inside the 5 s keep-alive (the 1 s tick may fire a timer-resolution early: wait for it)
            assert wait_until(lambda: world.app.stats.snapshot()["counters"].get("lifetime_retired") == 1, timeout=3.5)
            s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
            status, _h, body = read_response(s)
            assert (status, body) == (200, b'{"ok":true}')
            assert closed_by_server(s, within=3.0)
    finally:
        lst.stop()


def test_early_refusals_never_wait_for_a_body_unless_the_token_proved_valid(serve):
    """Review finding 1 and code review V1: a refusal with an announced body that never comes is answered at once and the
    connection closes - no token, a dead token (its lookup failed), the module off, an unknown path. Only a token that
    proved valid gets the short drain (a 409 on a read-only link here), at most 2 s."""
    world, lst = serve()
    head = (b"POST /t/api/photo HTTP/1.1\r\nHost: t.example\r\nContent-Type: multipart/form-data; boundary=b\r\n"
            b"Content-Length: 65536\r\n\r\n")

    def timed(data: bytes) -> tuple[int, dict, bytes, float]:
        with socket.create_connection(("127.0.0.1", lst.port), timeout=10) as s:
            t0 = time.monotonic()
            s.sendall(data)
            status, headers, body = read_response(s)
            return status, headers, body, time.monotonic() - t0

    status, headers, body, took = timed(head)  # no token
    assert (status, body, headers.get("connection")) == (404, UNIFORM, "close") and took < 1.0 * sw_time_factor()
    link, tok = world.links.add()
    world.links.replace(link, revoked=True)
    dead = (b"POST /t/api/code/send HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + tok.encode() +
            b"\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{")
    status, headers, body, took = timed(dead)  # a dead token: looked up, failed - never drained
    assert (status, body, headers.get("connection")) == (404, UNIFORM, "close") and took < 1.0 * sw_time_factor()
    status, headers, body, took = timed(b"POST /t/nowhere HTTP/1.1\r\nHost: t.example\r\nContent-Length: 1000\r\n\r\n{")
    assert (status, body, headers.get("connection")) == (404, UNIFORM, "close") and took < 1.0 * sw_time_factor()
    world.switch.on = False
    status, headers, body, took = timed(dead)  # the module off
    assert (status, body, headers.get("connection")) == (404, UNIFORM, "close") and took < 1.0 * sw_time_factor()
    world.switch.on = True
    _ro, ro_tok = world.links.add(grace_until=world.clock() + 3600)
    status, headers, body, took = timed(  # a VALID token, refused before its body (read-only): drained for at most 2 s
        b"POST /t/api/photo HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + ro_tok.encode() +
        b"\r\nContent-Type: multipart/form-data; boundary=b\r\nContent-Length: 1000\r\n\r\n--b")
    assert (status, body) == (409, b'{"code":"read_only"}') and headers.get("connection") == "close"
    assert 1.5 <= took < 4.0 * sw_time_factor()
    counters = world.app.stats.snapshot()["counters"]
    assert counters.get("drains") == 1 and counters.get("drain_timeouts") == 1


def test_a_never_valid_token_cannot_hold_the_connections_with_an_announced_body(serve):
    """Code review V1: an early refusal for a well-formed token that never proved valid (here a 415) used to drain an
    announced 64 KiB body for 2 s, counted nowhere - 16 such connections held every slot and the next request met the cap.
    Such a refusal now never waits for the body: answered at once, connection closed, its network pays one failure."""
    world, lst = serve()
    held: list[socket.socket] = []
    try:
        for _ in range(16):
            s = socket.create_connection(("127.0.0.1", lst.port), timeout=5)
            s.sendall(b"POST /t/api/note HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + secrets.token_urlsafe(24).encode() +
                      b"\r\nContent-Type: text/plain\r\nContent-Length: 65536\r\n\r\n")  # the body never comes
            held.append(s)
        time.sleep(0.3)  # every head is in
        t0 = time.monotonic()
        status, _headers, body = exchange(lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\nConnection: close\r\n\r\n")
        assert (status, body) == (200, b'{"ok":true}'), (status, body)
        assert time.monotonic() - t0 < 1.0 * sw_time_factor()
        for s in held:
            status, headers, body = read_response(s, timeout=1.0 * sw_time_factor())
            assert (status, body) == (415, b'{"code":"unsupported_media_type"}') and headers.get("connection") == "close"
    finally:
        for s in held:
            s.close()
    assert world.links.lookups == 0
    assert world.app.gate.limiter.count("fail:127.0.0.0/24", 60) == 16
    assert world.app.stats.snapshot()["counters"].get("drains", 0) == 0


def _jpeg(size: tuple[int, int] = (64, 48)) -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", size, (1, 2, 3)).save(buf, "JPEG")
    return buf.getvalue()


def _start_trickle(port: int, tok: str, boundary: bytes = b"xYz123boundary", length: int = 8_000_000) -> socket.socket:
    s = socket.create_connection(("127.0.0.1", port), timeout=10)
    s.sendall(b"POST /t/api/photo HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + tok.encode() +
              b"\r\nContent-Type: multipart/form-data; boundary=" + boundary + b"\r\nContent-Length: " + str(length).encode() +
              b"\r\n\r\n--" + boundary + b"\r\n")
    return s


def test_two_trickling_uploads_cannot_starve_every_other_vendors_upload(serve):
    """Code review V2: an upload took one of TWO upload slots before its body was read, the body could trickle for the 60 s
    deadline, and the 408 spent no photo budget - two forwarded links answered every other vendor's upload 429 `busy`. The
    memory bound is now bytes (UPLOAD_MEMORY_BYTES for the declared bodies), so two tricklers leave room for others."""
    world, lst = serve()
    tricklers: list[socket.socket] = []
    stop = threading.Event()
    try:
        for _ in range(2):
            _link, tok = world.links.add()
            tricklers.append(_start_trickle(lst.port, tok))

        def keep_trickling() -> None:  # one byte per trickler every 0.5 s: never idle long enough to be cut
            while not stop.wait(0.5):
                for s in tricklers:
                    try:
                        s.sendall(b"x")
                    except OSError:
                        pass

        feeder = threading.Thread(target=keep_trickling, daemon=True)
        feeder.start()
        time.sleep(0.5)
        _third, tok3 = world.links.add()
        with httpx.Client(base_url=f"http://127.0.0.1:{lst.port}", timeout=20) as c:
            r = c.post("/t/api/photo", headers={"x-ticket-token": tok3}, files={"file": ("a.jpg", _jpeg(), "image/jpeg")},
                       data={"client_request_id": str(uuid.uuid4())})
        assert r.status_code == 201, r.text
    finally:
        stop.set()
        for s in tricklers:
            s.close()


def test_transfer_encoding_with_content_length_is_refused_at_the_socket(serve):
    world, lst = serve()
    status, headers, body = exchange(lst.port, b"POST /t/api/redeem HTTP/1.1\r\nHost: t.example\r\nContent-Type: application/json\r\n"
                                               b"Content-Length: 4\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n")
    assert (status, body) == (400, b'{"code":"bad_request"}') and headers.get("connection") == "close"
    assert world.redeems.rows == {}


def test_a_trickling_body_meets_the_read_deadline(serve):
    world, lst = serve()  # the test rules give /t/api/redeem a 1 s deadline (10 s in production)
    with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
        s.sendall(b"POST /t/api/redeem HTTP/1.1\r\nHost: t.example\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{\"ri")
        status, headers, body = read_response(s, timeout=5)
        assert status == 408 and body == b'{"code":"body_timeout"}' and headers.get("connection") == "close"
        assert closed_by_server(s, within=3)
    assert world.app.stats.snapshot()["counters"].get("body_timeouts") == 1


def test_a_client_that_leaves_mid_body_is_not_a_server_error(serve, caplog):
    world, lst = serve()
    caplog.set_level(logging.DEBUG, logger="smplwise.tickets.public.http")
    for expect in (True, False):
        with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
            s.sendall(b"POST /t/api/redeem HTTP/1.1\r\nHost: t.example\r\nContent-Type: application/json\r\nContent-Length: 40\r\n" +
                      (b"Expect: 100-continue\r\n" if expect else b"") + b"\r\n" + (b"" if expect else b'{"rid":'))
            if expect:
                s.settimeout(3)
                assert b"100 Continue" in s.recv(4096)
        # the socket closes here, before the body is complete
    assert wait_until(lambda: world.app.stats.snapshot()["counters"].get("client_disconnects", 0) == 2)
    snap = world.app.stats.snapshot()
    assert snap["last_5xx_at"] is None and "unhandled_errors" not in snap["counters"]
    assert "unhandled error" not in caplog.text


def test_a_large_unread_body_closes_the_connection(serve):
    _world, lst = serve()
    with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
        s.sendall(b"POST /t/api/photo HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + b"Q" * 32 +
                  b"\r\nContent-Type: multipart/form-data; boundary=b\r\nContent-Length: 200000\r\n\r\n" + b"--b\r\n" + b"x" * 1000)
        status, headers, body = read_response(s)
        assert status == 404 and body == UNIFORM and headers.get("connection") == "close"
        assert closed_by_server(s, within=3)


def test_a_small_unread_body_of_a_valid_token_is_drained_so_the_answer_arrives_and_the_connection_lives(serve):
    """An early answer to a VALID token (a write on a read-only link: 409 before the body is read): the edge reads and discards
    the small body first - closing a socket with unread bytes makes the kernel send a RESET that can destroy the answer - and
    the kept-alive connection serves the next request. The same request with an unknown token is answered and closed at once
    (code review V1: a stranger's request is never waited for)."""
    world, lst = serve()
    _link, tok = world.links.add(grace_until=world.clock() + 3600)
    body = b"--b\r\n" + b"y" * 3000 + b"\r\n--b--\r\n"
    for token, keeps in ((tok, True), ("Q" * 32, False)):
        with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
            s.sendall(b"POST /t/api/photo HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + token.encode() +
                      b"\r\nContent-Type: multipart/form-data; boundary=b\r\nContent-Length: " + str(len(body)).encode() +
                      b"\r\n\r\n" + body)
            status, headers, _answer = read_response(s)
            assert status == (409 if keeps else 404)
            if keeps:
                assert "connection" not in headers
                s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
                assert read_response(s)[:1] == (200,)
            else:
                assert headers.get("connection") == "close" and closed_by_server(s, within=3)
    assert world.app.stats.snapshot()["counters"].get("drains") == 1


def test_keep_alive_idles_out_after_five_seconds(serve):
    _world, lst = serve()
    with socket.create_connection(("127.0.0.1", lst.port), timeout=10) as s:
        s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
        assert read_response(s)[0] == 200
        t0 = time.monotonic()
        assert closed_by_server(s, within=8.0 * sw_time_factor())
        assert 4.0 <= time.monotonic() - t0 <= 7.5 * sw_time_factor()


def test_idle_keep_alive_connections_no_longer_count_against_the_request_cap(serve):
    """Code review V5: uvicorn's cap counted idle keep-alive connections (cloudflared keeps a pool of them) - 15 idle ones
    answered every new request with a bare 503. The cap now counts requests in progress."""
    _world, lst = serve()
    held: list[socket.socket] = []
    try:
        for _ in range(20):
            s = socket.create_connection(("127.0.0.1", lst.port), timeout=5)
            s.sendall(b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
            assert read_response(s)[0] == 200
            held.append(s)  # kept alive, idle
        assert exchange(lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\nConnection: close\r\n\r\n")[0] == 200
    finally:
        for s in held:
            s.close()


def _busy_answer(status: int, headers: dict, body: bytes) -> None:
    assert (status, body) == (503, BUSY), (status, body)
    assert headers.get("content-type") == "application/json" and headers.get("retry-after") == "1"
    assert headers.get("content-security-policy") and headers.get("x-frame-options") == "DENY" and "server" not in headers


def test_sixteen_requests_in_flight_then_a_json_503_with_the_security_headers(serve):
    world, lst = serve()
    held: list[socket.socket] = []
    try:
        for _ in range(16):
            s = socket.create_connection(("127.0.0.1", lst.port), timeout=5)
            s.sendall(b"GET /t/api/test-hold HTTP/1.1\r\nHost: t.example\r\n\r\n")
            held.append(s)
        assert wait_until(lambda: world.app.edge.in_flight == 16)
        status, headers, body = exchange(lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\nConnection: close\r\n\r\n")
        _busy_answer(status, headers, body)
        assert world.app.stats.snapshot()["counters"].get("busy_refusals") == 1
        HOLD.set()
        assert all(read_response(s)[0] == 200 for s in held)
    finally:
        HOLD.set()
        for s in held:
            s.close()
    assert wait_until(lambda: world.app.edge.in_flight == 0)


def test_the_per_network_connection_budget_at_the_protocol_layer(serve):
    """Code review 5.2: more than PER_NETWORK_CONNECTIONS open from one client network that is not a trusted proxy - that
    connection's request is answered the JSON 503 and it closes, before any route runs. A trusted proxy is exempt (it carries
    every client over its own connections)."""
    world, lst = serve(per_network_connections=3)
    held: list[socket.socket] = []
    try:
        for _ in range(3):
            held.append(socket.create_connection(("127.0.0.1", lst.port), timeout=5))
        time.sleep(0.2)
        status, headers, body = exchange(lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\n\r\n")
        _busy_answer(status, headers, body)
        assert headers.get("connection") == "close"
        assert world.app.stats.snapshot()["counters"].get("connections_busy") == 1
    finally:
        for s in held:
            s.close()
    time.sleep(0.3)
    assert exchange(lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\nConnection: close\r\n\r\n")[0] == 200
    _w2, trusted_lst = serve(trusted=("127.0.0.0/8",), per_network_connections=3)
    held = [socket.create_connection(("127.0.0.1", trusted_lst.port), timeout=5) for _ in range(5)]
    try:
        time.sleep(0.2)
        assert exchange(trusted_lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\nConnection: close\r\n\r\n")[0] == 200
    finally:
        for s in held:
            s.close()


def test_past_the_hard_connection_cap_a_connection_is_closed_at_once(serve):
    world, lst = serve(max_connections=2, hard_max_connections=3)
    held = [socket.create_connection(("127.0.0.1", lst.port), timeout=5) for _ in range(3)]
    try:
        time.sleep(0.2)
        with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
            assert closed_by_server(s, within=2.0)  # nothing read, nothing answered
        assert world.app.stats.snapshot()["counters"].get("connections_dropped") == 1
    finally:
        for s in held:
            s.close()
    time.sleep(0.3)
    assert exchange(lst.port, b"GET /t/healthz HTTP/1.1\r\nHost: t.example\r\nConnection: close\r\n\r\n")[0] == 200


def test_a_client_that_stops_reading_is_aborted(serve):
    """A response the client never reads (a full send buffer that does not move for write_stall_s) is aborted - a plain close
    would wait for the buffer to flush, forever - and its request leaves the in-flight count."""
    world, lst = serve(write_stall_s=1.0)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 4096)
    try:
        s.connect(("127.0.0.1", lst.port))
        s.sendall(b"GET /t/api/test-big HTTP/1.1\r\nHost: t.example\r\n\r\n")  # and never read
        assert wait_until(lambda: world.app.stats.snapshot()["counters"].get("write_stalls_aborted") == 1, timeout=15)
        assert wait_until(lambda: world.app.edge.in_flight == 0)
    finally:
        s.close()


def test_the_lifetime_backstop_aborts_even_mid_request(tmp_path):
    """MAX_CONNECTION_S + LIFETIME_GRACE_S is the absolute bound (review section 2: never exercised before): a body that keeps
    trickling under the idle limit, on a link whose route waits for it, is cut when the connection reaches the bound."""
    world = build_world(tmp_path, rules=TEST_RULES)
    lst = ps.PublicListener("tickets-public-backstop")
    assert lst.start(world.app, host="127.0.0.1", port=0, max_connection_s=1.0, lifetime_grace_s=0.5, per_network_connections=64)
    try:
        _link, tok = world.links.add(require_code=True)
        with socket.create_connection(("127.0.0.1", lst.port), timeout=5) as s:
            t0 = time.monotonic()
            s.sendall(b"POST /t/api/code/send HTTP/1.1\r\nHost: t.example\r\nX-Ticket-Token: " + tok.encode() +
                      b"\r\nContent-Type: application/json\r\nContent-Length: 200\r\n\r\n{")
            cut = False
            for _ in range(40):  # one byte every 0.2 s: never idle for the 5 s limit, far from the 10 s deadline
                time.sleep(0.2)
                try:
                    s.sendall(b" ")
                except OSError:
                    cut = True
                    break
                if select.select([s], [], [], 0)[0]:
                    cut = closed_by_server(s, within=0.5)
                    break
            assert cut and time.monotonic() - t0 < 4.0 * sw_time_factor()
        assert world.app.stats.snapshot()["counters"].get("lifetime_closed") == 1
    finally:
        lst.stop()


def test_one_upload_in_flight_per_link_at_the_socket(serve):
    """A second upload of the same link while the first is in its body phase: 429 `busy` at once, and it costs nothing (only
    the first one entered its body phase). The first one, once its client stops sending, is cut by the idle limit (1 s in
    the test rules, 5 s in production) - not the 60 s deadline - and it has paid its unit (code review V2)."""
    world, lst = serve()
    link, tok = world.links.add()
    key = links.limiter_key(links.token_hash(tok))
    first = _start_trickle(lst.port, tok, length=200000)
    stop = threading.Event()

    def feed() -> None:
        while not stop.wait(0.3):
            try:
                first.sendall(b"x")
            except OSError:
                return

    feeder = threading.Thread(target=feed, daemon=True)
    feeder.start()
    try:
        assert wait_until(lambda: world.app.gate.limiter.count("p:" + key, 3600) == 1)  # the first one's body phase
        with httpx.Client(base_url=f"http://127.0.0.1:{lst.port}") as c:
            r = c.post("/t/api/photo", headers={"x-ticket-token": tok}, files={"file": ("a.jpg", _jpeg(), "image/jpeg")},
                       data={"client_request_id": str(uuid.uuid4())})
        assert r.status_code == 429 and r.json()["code"] == "busy"
        assert world.app.gate.limiter.count("p:" + key, 3600) == 1  # the busy refusal cost nothing
        assert world.app.stats.snapshot()["links"][link.link_id[:12]].get("busy") == 1
        stop.set()  # the client goes quiet: cut by the idle limit
        t0 = time.monotonic()
        status, headers, body = read_response(first, timeout=10)
        assert (status, body) == (408, b'{"code":"body_timeout"}') and headers.get("connection") == "close"
        assert time.monotonic() - t0 < 3.0 * sw_time_factor()
    finally:
        stop.set()
        first.close()
    assert world.app.gate.limiter.count("p:" + key, 3600) == 1
    snap = world.app.stats.snapshot()
    assert snap["counters"].get("body_idle_timeouts") == 1 and snap["links"][link.link_id[:12]].get("wasted") == 1


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
    base = f"http://127.0.0.1:{lst.port}"
    clients = [httpx.Client(base_url=base, timeout=20) for _ in range(5)]  # created before any clock: a client loads CA files
    entered = threading.Event()
    real_reencode = ii.reencode

    def signalling_reencode(*a, **kw):  # the route looks reencode up at call time
        entered.set()
        return real_reencode(*a, **kw)

    ii.reencode = signalling_reencode
    assert ii._DECODE.acquire(timeout=5)  # noqa: SLF001 - someone else is decoding
    try:
        def up(client: httpx.Client, tok: str) -> None:
            r = client.post("/t/api/photo", headers={"x-ticket-token": tok}, data={"client_request_id": str(uuid.uuid4())},
                            files={"file": ("a.jpg", buf.getvalue(), "image/jpeg")})
            results.append(r.status_code)

        threads = [threading.Thread(target=up, args=(clients[i], tok)) for i, tok in enumerate(tokens)]
        for t in threads:
            t.start()
        assert entered.wait(10)  # one upload waits for the decoder in a worker thread ...
        time.sleep(0.3)  # ... and the other three have queued behind it (on the loop, or - without the admission - in threads)
        t0 = time.monotonic()
        for _ in range(5):
            assert clients[4].get("/t/api/photo/ffffffffffffffff", headers={"x-ticket-token": tokens[0]}).status_code == 404
        assert time.monotonic() - t0 < 1.0 * sw_time_factor()  # a stalled pool waits out the 3 s decode wait (4.3 s seen)
    finally:
        ii._DECODE.release()  # noqa: SLF001
        ii.reencode = real_reencode
    for t in threads:
        t.join(20)
    for c in clients:
        c.close()
    lst.stop()
    assert sorted(results) and all(code in (201, 429) for code in results) and 201 in results


def test_uploads_blocked_in_a_held_write_gate_never_stall_lookups(tmp_path):
    """Code review section 2: the other stall the pool claim names - a held SQLite write gate (or a slow disk) under
    PhotoSink.record. Six uploads (six links) whose record blocks: at most PROCESSING_SLOTS (2) of them may hold a worker
    thread, the rest wait on the loop - and token lookups keep answering. Event-driven: a stalled pool would make the lookups
    time out, not merely run slower."""
    from smplwise.services.tickets.public_app import PROCESSING_SLOTS

    world = build_world(tmp_path)
    lst = ps.PublicListener("tickets-public-writegate")
    assert lst.start(world.app, host="127.0.0.1", port=0, per_network_connections=64)
    entered = threading.Semaphore(0)
    release = threading.Event()
    real_record = world.photos.record

    def held_record(*a, **kw):
        entered.release()
        release.wait(30)
        return real_record(*a, **kw)

    world.photos.record = held_record  # type: ignore[assignment]
    tokens = [world.links.add()[1] for _ in range(6)]
    base = f"http://127.0.0.1:{lst.port}"
    clients = [httpx.Client(base_url=base, timeout=40) for _ in range(7)]
    results: list[int] = []
    photo = _jpeg()

    def up(client: httpx.Client, tok: str) -> None:
        r = client.post("/t/api/photo", headers={"x-ticket-token": tok}, data={"client_request_id": str(uuid.uuid4())},
                        files={"file": ("a.jpg", photo, "image/jpeg")})
        results.append(r.status_code)

    threads = [threading.Thread(target=up, args=(clients[i], tok)) for i, tok in enumerate(tokens)]
    try:
        for t in threads:
            t.start()
        for _ in range(PROCESSING_SLOTS):
            assert entered.acquire(timeout=10)  # two uploads hold the "write gate" in worker threads ...
        assert not entered.acquire(timeout=1.0)  # ... and no third one reaches it: the rest wait on the loop
        for _ in range(8):  # every lookup still finds a free worker thread
            r = clients[6].get("/t/api/photo/ffffffffffffffff", headers={"x-ticket-token": tokens[0]}, timeout=5)
            assert r.status_code == 404
    finally:
        release.set()
        for t in threads:
            t.join(40)
        for c in clients:
            c.close()
        lst.stop()
    assert sorted(results) == [201] * 6


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
