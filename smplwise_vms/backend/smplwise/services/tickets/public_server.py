"""CR-038 section 10.1: the public listener - container port 18093, its own daemon thread, its own asyncio event loop, its own
worker-thread pool, its own connection budget. It serves the public app (public_app.create_public_app) and nothing else.

Isolation rules of spec 10.1 (review R1 / T17 / C1), and how each is met here:
- own daemon thread `tickets-public` running a FRESH asyncio loop (`asyncio.new_event_loop()`, never the main app's, never
  shared); the main app's loop, its threadpool and its websocket work are untouched;
- own threadpool limiter: anyio's default thread limiter is per event loop - set to THREADPOOL_TOKENS (6) on this loop, so
  public sync work (lookups, decodes, stores) can never take the main app's 40 tokens; uploads use at most two of them
  (public_app PROCESSING_SLOTS), so four always remain for lookups (code review V15);
- uvicorn Config: `access_log=False`, `server_header=False`, `date_header=False`, `log_config=None`, `proxy_headers=False`,
  `forwarded_allow_ips=""` (no uvicorn-side trust: the app decides, ratelimit.client_network), `limit_concurrency=None`,
  `timeout_keep_alive=5`, `h11_max_incomplete_event_size=16 KiB` (header floods), `ws="none"`, `lifespan="off"`,
  `backlog=64`, `timeout_graceful_shutdown=3`, and the h11 parser (strict; its incomplete-event cap needs it);
- connections (code review V5 and 5.2): uvicorn's `limit_concurrency` counted idle keep-alive connections - cloudflared's
  pool among them - and answered a bare text/plain 503; it is off. Instead: REQUESTS in progress are capped in the edge
  (public_http MAX_IN_FLIGHT, a JSON 503 with the security headers), and CONNECTIONS here, by ConnectionBudget when the TCP
  connection is made: more than PER_NETWORK_CONNECTIONS (8) open from one client /24 or /64 that is NOT a trusted proxy, or
  more than MAX_CONNECTIONS (64) in all -> that connection's request is answered `503 {"code": "busy"}` (the same JSON, the
  same headers) and it closes; more than HARD_MAX_CONNECTIONS (256) -> closed at once, nothing read (the process's file
  descriptors are shared with the main app). Trusted proxies are exempt from the per-network budget (cloudflared carries
  every client over its own connections) - the install guide caps the tunnel's pool instead (`keepAliveConnections` <= 8);
- PublicConfig never touches the process's logging: uvicorn 0.53 `Config.configure_logging` with `access_log=False` would
  empty the SHARED `uvicorn.access` logger and silence the main app's access log; here it is a no-op. The protocol class
  (PublicH11Protocol) logs through public_log.ProtocolLog and never writes an access line;
- `load()` keeps the app unwrapped: no ProxyHeadersMiddleware, and no MessageLoggerMiddleware even if someone sets the
  uvicorn log level to TRACE (it would log request bodies);
- slow clients: a request head must arrive within HEAD_TIMEOUT_S (uvicorn has no header-read timeout - a slowloris on headers
  would otherwise hold one of the 16 connections forever); a connection older than MAX_CONNECTION_S answers its next request
  with `connection: close` (closed outright only LIFETIME_GRACE_S later); keep-alive idles 5 s. Behind cloudflared the
  tunnel's own idle timeout towards the origin must be SHORTER than 5 s (`originRequest.keepAliveTimeout`, install guide):
  otherwise it can reuse a connection the listener is closing and a POST fails (UNVERIFIED on the owner's tunnel). The body
  read deadline (10 s JSON / 60 s upload) and the 5 s idle limit between body chunks are the edge's (public_http);
- slow readers: a response the client stops reading (a full send buffer that does not move for WRITE_STALL_S, 30 s) is
  aborted, and the lifetime backstop ABORTS (a plain close would wait for the unread buffer to flush - forever, if the client
  never reads: asyncio keeps the socket open until then);
- a malformed request gets uvicorn's 400 rebuilt with the public security headers and a JSON body;
- signals: none. `uvicorn.Server.capture_signals` already skips signal capture off the main thread (uvicorn 0.53; asserted by
  a test), and PublicServer overrides it to a no-op anyway - the add-on's SIGTERM stays the main server's;
- the socket is bound in `start()` (a busy port is reported to the caller, not swallowed by a thread) and handed to uvicorn;
  `stop()` sets `should_exit`, waits STOP_JOIN_S for the thread, then forces it;
- the listener starts on the add-on option `tickets_public` alone and answers the uniform 404 while the module is off (C8).

Wiring (one line each in main.py `_start_janitor` / `_stop_janitor`, done by slice 4 - see the notes): start next to the cast
relay when `settings.tickets_public` is on; stop next to `cast_relay.SERVER.stop()`."""
from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import socket
import threading
import time
from typing import Any, Iterator

import h11
import uvicorn
from uvicorn.protocols.http.h11_impl import H11Protocol

from .public_http import BUSY_503, SECURITY_HEADERS, final_headers
from .public_log import ProtocolLog, PublicStats
from .ratelimit import Network, network_key, parse_address

log = logging.getLogger("smplwise.tickets.public")

CONTAINER_PORT = 18093
MAX_CONNECTIONS = 64  # open connections; past it a new connection's request is answered 503 busy (JSON, headers) and it closes
HARD_MAX_CONNECTIONS = 256  # past it a new connection is closed at once (file descriptors are the process's)
PER_NETWORK_CONNECTIONS = 8  # open connections per client /24 or /64 that is not a trusted proxy
KEEP_ALIVE_S = 5
MAX_INCOMPLETE_EVENT_SIZE = 16 * 1024
THREADPOOL_TOKENS = 6
HEAD_TIMEOUT_S = 10.0
MAX_CONNECTION_S = 300.0
LIFETIME_GRACE_S = 120.0  # past MAX_CONNECTION_S + this, a connection is aborted even mid-request (an upload's deadline is 60 s)
WRITE_STALL_S = 30.0  # a non-empty send buffer that does not move for this long: the client stopped reading - aborted
GRACEFUL_SHUTDOWN_S = 3
STOP_JOIN_S = 5.0
BACKLOG = 64
THREAD_NAME = "tickets-public"
_BAD_REQUEST = b'{"code":"bad_request"}'


class ConnectionBudget:
    """The listener's connection caps (see the module docstring), shared by its protocol instances. A lock, although the
    protocol callbacks all run on the listener's loop: cheap, and correct whatever calls it."""

    def __init__(self, *, soft: int = MAX_CONNECTIONS, hard: int = HARD_MAX_CONNECTIONS, per_network: int = PER_NETWORK_CONNECTIONS,
                 trusted: tuple[Network, ...] = ()) -> None:
        self.soft = soft
        self.hard = max(hard, soft)
        self.per_network = per_network
        self.trusted = tuple(trusted)
        self.open = 0
        self.by_network: dict[str, int] = {}
        self._lock = threading.Lock()

    def admit(self, peer: str | None) -> tuple[str, str | None]:
        """('ok' | 'busy' | 'drop', the network key to release later or None). Every admit is paired with one release."""
        addr = parse_address(peer)
        key = None
        if addr is None or not any(addr in n for n in self.trusted if n.version == addr.version):
            key = network_key(addr)
        with self._lock:
            self.open += 1
            if key is not None:
                self.by_network[key] = self.by_network.get(key, 0) + 1
            if self.open > self.hard:
                return "drop", key
            if self.open > self.soft or (key is not None and self.by_network[key] > self.per_network):
                return "busy", key
            return "ok", key

    def release(self, key: str | None) -> None:
        with self._lock:
            self.open -= 1
            if key is not None:
                n = self.by_network.get(key, 0) - 1
                if n <= 0:
                    self.by_network.pop(key, None)
                else:
                    self.by_network[key] = n


class PublicH11Protocol(H11Protocol):
    """uvicorn's h11 protocol with the public listener's logging (ProtocolLog: never an access line, never a client address,
    never request bytes), a request-head deadline, a connection lifetime cap and a 400 that carries the security headers."""

    def __init__(self, config: Any, server_state: Any, app_state: Any, _loop: Any = None) -> None:
        super().__init__(config, server_state, app_state, _loop)
        plog = getattr(config, "public_log", None) or ProtocolLog(PublicStats())
        self.logger = plog  # type: ignore[assignment]
        self.access_logger = plog  # type: ignore[assignment]
        self.access_log = False
        self._head_timeout = float(getattr(config, "head_timeout_s", HEAD_TIMEOUT_S))
        self._max_connection = float(getattr(config, "max_connection_s", MAX_CONNECTION_S))
        self._grace = float(getattr(config, "lifetime_grace_s", LIFETIME_GRACE_S))
        self._write_stall = float(getattr(config, "write_stall_s", WRITE_STALL_S))
        self._budget: ConnectionBudget | None = getattr(config, "connection_budget", None)
        self._budget_key: str | None = None
        self._budgeted = False
        self._born = 0.0
        self._head_since: float | None = None
        self._seen_cycle: Any = None
        self._watch: asyncio.TimerHandle | None = None
        self._retire = False
        self._buffered = 0
        self._buffered_since: float | None = None

    def connection_made(self, transport: Any) -> None:  # type: ignore[override]
        super().connection_made(transport)
        self._born = self.loop.time()
        self._head_since = self._born
        if self._budget is not None:
            verdict, self._budget_key = self._budget.admit(self.client[0] if self.client else None)
            self._budgeted = True
            if verdict == "drop":
                self._bump("connections_dropped")
                transport.abort()  # nothing read, nothing answered: connection_lost releases the budget
                return
            if verdict == "busy":
                self._bump("connections_busy")
                self.app = self._busy  # this connection's request is answered 503 busy, then it closes
        self._arm()

    async def _busy(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        """The answer of a connection over the budget: the edge's JSON 503, with the security headers, closing."""
        if scope.get("type") != "http":
            return
        stats = getattr(self.logger, "stats", None)
        if stats is not None:
            stats.request(503)
        headers = final_headers([(b"content-type", b"application/json"), (b"content-length", str(len(BUSY_503)).encode("ascii")),
                                 (b"retry-after", b"1")], close=True)
        await send({"type": "http.response.start", "status": 503, "headers": headers})
        await send({"type": "http.response.body", "body": BUSY_503})

    def _arm(self) -> None:
        self._watch = self.loop.call_later(min(1.0, self._head_timeout / 2), self._tick)

    def _waiting_for_head(self) -> bool:
        return self.cycle is None or self.cycle.response_complete

    def _note_cycle(self) -> None:
        if self.cycle is not None and self.cycle is not self._seen_cycle:
            self._seen_cycle = self.cycle  # a request head was parsed: its clock stops
            self._head_since = None
            if self._retire:
                self.cycle.keep_alive = False  # an over-age connection answers this request with `connection: close`

    def _bump(self, name: str) -> None:
        stats = getattr(self.logger, "stats", None)
        if stats is not None:  # counted for health, never a log line per connection (a flood would fill the log)
            stats.bump(name)

    def _write_stalled(self, now: float) -> bool:
        """True when the send buffer is non-empty and has not changed for `write_stall_s`: the client stopped reading (with the
        app's writes paused by flow control, only the client can move the buffer)."""
        try:
            size = self.transport.get_write_buffer_size()
        except Exception:  # noqa: BLE001 - a transport without the call: never judged stalled
            return False
        if size == 0 or size != self._buffered:
            self._buffered, self._buffered_since = size, (now if size else None)
            return False
        return self._buffered_since is not None and now - self._buffered_since > self._write_stall

    def _tick(self) -> None:
        self._watch = None
        t = self.transport
        if t is None:
            return
        now = self.loop.time()
        if now - self._born > self._max_connection + self._grace:  # the absolute backstop, whatever runs - even a closing
            self._bump("lifetime_closed")                           # socket that waits for a client that never reads
            t.abort()
            return
        if self._write_stalled(now):
            self._bump("write_stalls_aborted")
            t.abort()
            return
        if t.is_closing():
            self._arm()  # closing, its buffer still flushing: the two checks above bound how long
            return
        self._note_cycle()
        idle = self._waiting_for_head()
        if idle and self._head_since is not None and now - self._head_since > self._head_timeout:
            self._bump("slow_heads_closed")
            t.close()
            self._arm()  # a close waits for the send buffer: keep watching until connection_lost (backstop, stall)
            return
        if not self._retire and now - self._born > self._max_connection:
            # over age: the NEXT answer carries `connection: close` (closing an idle socket here would race with a proxy -
            # cloudflared - that reuses it for a request the client cannot safely retry); an idle one ends with keep-alive
            self._retire = True
            self._bump("lifetime_retired")
            if not idle and self.cycle is not None:
                self.cycle.keep_alive = False
        self._arm()

    def data_received(self, data: bytes) -> None:
        if self._waiting_for_head() and self._head_since is None:
            self._head_since = self.loop.time()  # the first byte of the next request on a kept-alive connection
        super().data_received(data)
        self._note_cycle()

    def connection_lost(self, exc: Exception | None) -> None:
        if self._watch is not None:
            self._watch.cancel()
            self._watch = None
        if self._budgeted and self._budget is not None:
            self._budgeted = False
            self._budget.release(self._budget_key)
        super().connection_lost(exc)

    def send_400_response(self, msg: str) -> None:
        headers = [(b"content-type", b"application/json"), (b"content-length", str(len(_BAD_REQUEST)).encode("ascii")),
                   (b"cache-control", b"no-store"), *SECURITY_HEADERS, (b"connection", b"close")]
        try:
            self.transport.write(self.conn.send(h11.Response(status_code=400, headers=headers, reason=b"Bad Request")))
            self.transport.write(self.conn.send(h11.Data(data=_BAD_REQUEST)))
            self.transport.write(self.conn.send(h11.EndOfMessage()))
        except h11.LocalProtocolError:
            pass
        self.transport.close()


class PublicConfig(uvicorn.Config):
    """A uvicorn Config that never reconfigures the process's logging and never wraps the app."""

    def __init__(self, app: Any, *, public_log: ProtocolLog, head_timeout_s: float = HEAD_TIMEOUT_S,
                 max_connection_s: float = MAX_CONNECTION_S, lifetime_grace_s: float = LIFETIME_GRACE_S,
                 write_stall_s: float = WRITE_STALL_S, connection_budget: ConnectionBudget | None = None, **kwargs: Any) -> None:
        self.public_log = public_log
        self.head_timeout_s = head_timeout_s
        self.max_connection_s = max_connection_s
        self.lifetime_grace_s = lifetime_grace_s
        self.write_stall_s = write_stall_s
        self.connection_budget = connection_budget
        super().__init__(app, **kwargs)

    def configure_logging(self) -> None:  # noqa: D102 - deliberately nothing (see the module docstring)
        return

    def load(self) -> None:
        super().load()
        self.loaded_app = self.app  # the edge itself: no proxy-header or message-logger wrapper, whatever the log level


class PublicServer(uvicorn.Server):
    @contextlib.contextmanager
    def capture_signals(self) -> Iterator[None]:  # never install a signal handler (spec 10.1)
        yield


def build_config(app: Any, *, host: str, port: int, public_log: ProtocolLog, head_timeout_s: float = HEAD_TIMEOUT_S,
                 max_connection_s: float = MAX_CONNECTION_S, lifetime_grace_s: float = LIFETIME_GRACE_S,
                 write_stall_s: float = WRITE_STALL_S, connection_budget: ConnectionBudget | None = None) -> PublicConfig:
    if connection_budget is None:
        connection_budget = ConnectionBudget(trusted=tuple(getattr(app, "trusted", ()) or ()))
    return PublicConfig(
        app, public_log=public_log, head_timeout_s=head_timeout_s, max_connection_s=max_connection_s,
        lifetime_grace_s=lifetime_grace_s, write_stall_s=write_stall_s, connection_budget=connection_budget,
        host=host, port=port, http=PublicH11Protocol, ws="none", lifespan="off", loop="none",
        log_config=None, access_log=False, server_header=False, date_header=False, proxy_headers=False, forwarded_allow_ips="",
        limit_concurrency=None, timeout_keep_alive=KEEP_ALIVE_S, h11_max_incomplete_event_size=MAX_INCOMPLETE_EVENT_SIZE,
        backlog=BACKLOG, timeout_graceful_shutdown=GRACEFUL_SHUTDOWN_S,
    )


def _bind(host: str, port: int) -> socket.socket:
    family = socket.AF_INET6 if ":" in host else socket.AF_INET
    sock = socket.socket(family, socket.SOCK_STREAM)
    try:
        if os.name != "nt":  # on Windows SO_REUSEADDR would let a second process take a port that is in use
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))  # not inheritable (the default): a child process never keeps 18093 open after stop()
    except BaseException:
        sock.close()
        raise
    return sock


class PublicListener:
    """start / stop of the public listener (one per process: SERVER). Thread safe; `start` is a no-op while it runs."""

    def __init__(self, name: str = THREAD_NAME) -> None:
        self.name = name
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._server: PublicServer | None = None
        self._sock: socket.socket | None = None
        self.port: int | None = None
        self.error: str | None = None
        self.stats: PublicStats | None = None
        self.loop: asyncio.AbstractEventLoop | None = None
        self.config: PublicConfig | None = None

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self, app: Any, *, host: str = "0.0.0.0", port: int = CONTAINER_PORT, head_timeout_s: float = HEAD_TIMEOUT_S,
              max_connection_s: float = MAX_CONNECTION_S, lifetime_grace_s: float = LIFETIME_GRACE_S,
              write_stall_s: float = WRITE_STALL_S, max_connections: int = MAX_CONNECTIONS,
              hard_max_connections: int = HARD_MAX_CONNECTIONS, per_network_connections: int = PER_NETWORK_CONNECTIONS,
              ready_timeout_s: float = 5.0) -> bool:
        with self._lock:
            if self.running:
                return True
            try:
                sock = _bind(host, port)
            except OSError as exc:
                self.error = type(exc).__name__
                log.warning("tickets public listener could not listen on port %s: %s", port, self.error)
                return False
            stats = getattr(app, "stats", None) or PublicStats()
            stats.started_at = time.time()
            budget = ConnectionBudget(soft=max_connections, hard=hard_max_connections,
                                      per_network=per_network_connections, trusted=tuple(getattr(app, "trusted", ()) or ()))
            config = build_config(app, host=host, port=port, public_log=ProtocolLog(stats), head_timeout_s=head_timeout_s,
                                  max_connection_s=max_connection_s, lifetime_grace_s=lifetime_grace_s,
                                  write_stall_s=write_stall_s, connection_budget=budget)
            server = PublicServer(config)
            ready = threading.Event()
            thread = threading.Thread(target=self._run, args=(server, sock, ready), name=self.name, daemon=True)
            self._server, self._sock, self._thread, self.stats, self.config = server, sock, thread, stats, config
            self.port, self.error = sock.getsockname()[1], None
            thread.start()
        if not ready.wait(ready_timeout_s) or not server.started:
            self.stop()
            self.error = self.error or "not_started"
            log.warning("tickets public listener did not start: %s", self.error)
            return False
        log.info("tickets public listener on container port %s", self.port)
        return True

    def _run(self, server: PublicServer, sock: socket.socket, ready: threading.Event) -> None:
        loop = asyncio.new_event_loop()
        self.loop = loop
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._serve(server, sock, ready))
        except BaseException as exc:  # noqa: BLE001 - uvicorn's startup failure is a SystemExit; the thread must report, not vanish
            self.error = type(exc).__name__
        finally:
            ready.set()
            try:
                pending = [t for t in asyncio.all_tasks(loop) if not t.done()]
                for t in pending:
                    t.cancel()
                if pending:
                    loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
                loop.run_until_complete(loop.shutdown_asyncgens())
            except BaseException:  # noqa: BLE001
                pass
            finally:
                asyncio.set_event_loop(None)
                loop.close()

    async def _serve(self, server: PublicServer, sock: socket.socket, ready: threading.Event) -> None:
        import anyio.to_thread

        anyio.to_thread.current_default_thread_limiter().total_tokens = THREADPOOL_TOKENS  # this loop's pool only

        async def announce() -> None:
            while not server.started and not server.should_exit:
                await asyncio.sleep(0.01)
            ready.set()

        watcher = asyncio.ensure_future(announce())
        try:
            await server.serve(sockets=[sock])
        finally:
            watcher.cancel()

    def stop(self, timeout_s: float = STOP_JOIN_S) -> bool:
        """Ask the server to exit and wait for its thread; True when it ended. Idempotent."""
        with self._lock:
            server, thread, sock = self._server, self._thread, self._sock
            self._server = self._thread = self._sock = None
            self.port = None
        if server is None:
            return True
        server.should_exit = True
        ended = True
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout_s)
            if thread.is_alive():
                server.force_exit = True
                thread.join(1.0)
            ended = not thread.is_alive()
        if sock is not None:
            with contextlib.suppress(OSError):
                sock.close()
        try:  # SECFIX2-295 / PUB-04: the portal start worker (if the switch ever started one) stops with the listener
            from .public_portal import stop_workers

            stop_workers(timeout_s=2.0)
        except Exception as exc:  # noqa: BLE001 - stopping the listener never fails because of the worker
            log.warning("portal start worker did not stop cleanly (%s)", type(exc).__name__)
        if not ended:
            log.warning("tickets public listener thread did not end within %.0f s", timeout_s)
        return ended

    def snapshot(self) -> dict[str, Any]:
        """Health (spec 17): running, port, last error, open connections, the listener's counters."""
        budget = getattr(self.config, "connection_budget", None) if self.running else None
        return {"running": self.running, "port": self.port, "error": self.error,
                "connections_open": budget.open if budget is not None else None,
                "stats": self.stats.snapshot() if self.stats else None,
                # PUBCOUNT-295 (D-04): the vendor portal start worker's accepted / dropped counters (counts only; all zero while the switch is off)
                "portal_start": _portal_start_stats()}


def _portal_start_stats() -> dict[str, Any] | None:
    try:
        from .public_portal import worker_stats

        return worker_stats()
    except Exception:  # noqa: BLE001 - the listener's health never fails because of the worker's counters
        return None


SERVER = PublicListener()
