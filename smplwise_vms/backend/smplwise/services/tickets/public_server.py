"""CR-038 section 10.1: the public listener - container port 18093, its own daemon thread, its own asyncio event loop, its own
worker-thread pool, its own connection budget. It serves the public app (public_app.create_public_app) and nothing else.

Isolation rules of spec 10.1 (review R1 / T17 / C1), and how each is met here:
- own daemon thread `tickets-public` running a FRESH asyncio loop (`asyncio.new_event_loop()`, never the main app's, never
  shared); the main app's loop, its threadpool and its websocket work are untouched;
- own threadpool limiter: anyio's default thread limiter is per event loop - set to THREADPOOL_TOKENS (4) on this loop, so
  public sync work (lookups, decodes, stores) can never take the main app's 40 tokens;
- uvicorn Config: `access_log=False`, `server_header=False`, `date_header=False`, `log_config=None`, `proxy_headers=False`,
  `forwarded_allow_ips=""` (no uvicorn-side trust: the app decides, ratelimit.client_network), `limit_concurrency=16`,
  `timeout_keep_alive=5`, `h11_max_incomplete_event_size=16 KiB` (header floods), `ws="none"`, `lifespan="off"`,
  `backlog=64`, `timeout_graceful_shutdown=3`, and the h11 parser (strict; its incomplete-event cap needs it);
- PublicConfig never touches the process's logging: uvicorn 0.53 `Config.configure_logging` with `access_log=False` would
  empty the SHARED `uvicorn.access` logger and silence the main app's access log; here it is a no-op. The protocol class
  (PublicH11Protocol) logs through public_log.ProtocolLog and never writes an access line;
- `load()` keeps the app unwrapped: no ProxyHeadersMiddleware, and no MessageLoggerMiddleware even if someone sets the
  uvicorn log level to TRACE (it would log request bodies);
- slow clients: a request head must arrive within HEAD_TIMEOUT_S (uvicorn has no header-read timeout - a slowloris on headers
  would otherwise hold one of the 16 connections forever), a connection is closed between requests once it is older than
  MAX_CONNECTION_S (and in any case LIFETIME_GRACE_S later), keep-alive idles 5 s; the body read deadline (10 s JSON / 60 s
  upload) is the edge's (public_http);
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

from .public_http import SECURITY_HEADERS
from .public_log import ProtocolLog, PublicStats

log = logging.getLogger("smplwise.tickets.public")

CONTAINER_PORT = 18093
LIMIT_CONCURRENCY = 16
KEEP_ALIVE_S = 5
MAX_INCOMPLETE_EVENT_SIZE = 16 * 1024
THREADPOOL_TOKENS = 4
HEAD_TIMEOUT_S = 10.0
MAX_CONNECTION_S = 300.0
LIFETIME_GRACE_S = 120.0  # past MAX_CONNECTION_S + this, a connection closes even mid-request (an upload's own deadline is 60 s)
GRACEFUL_SHUTDOWN_S = 3
STOP_JOIN_S = 5.0
BACKLOG = 64
THREAD_NAME = "tickets-public"
_BAD_REQUEST = b'{"code":"bad_request"}'


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
        self._born = 0.0
        self._head_since: float | None = None
        self._seen_cycle: Any = None
        self._watch: asyncio.TimerHandle | None = None

    def connection_made(self, transport: Any) -> None:  # type: ignore[override]
        super().connection_made(transport)
        self._born = self.loop.time()
        self._head_since = self._born
        self._arm()

    def _arm(self) -> None:
        self._watch = self.loop.call_later(min(1.0, self._head_timeout / 2), self._tick)

    def _waiting_for_head(self) -> bool:
        return self.cycle is None or self.cycle.response_complete

    def _note_cycle(self) -> None:
        if self.cycle is not None and self.cycle is not self._seen_cycle:
            self._seen_cycle = self.cycle  # a request head was parsed: its clock stops
            self._head_since = None

    def _tick(self) -> None:
        self._watch = None
        if self.transport is None or self.transport.is_closing():
            return
        self._note_cycle()
        now = self.loop.time()
        idle = self._waiting_for_head()
        too_slow = idle and self._head_since is not None and now - self._head_since > self._head_timeout
        # the lifetime cap is applied between requests (never in the middle of an upload), with an absolute backstop
        too_old = (idle and now - self._born > self._max_connection) or now - self._born > self._max_connection + LIFETIME_GRACE_S
        if too_slow or too_old:
            stats = getattr(self.logger, "stats", None)
            if stats is not None:  # counted for health, never a log line per connection (a flood would fill the log)
                stats.bump("slow_heads_closed" if too_slow else "lifetime_closed")
            self.transport.close()
            return
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
                 max_connection_s: float = MAX_CONNECTION_S, **kwargs: Any) -> None:
        self.public_log = public_log
        self.head_timeout_s = head_timeout_s
        self.max_connection_s = max_connection_s
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
                 max_connection_s: float = MAX_CONNECTION_S) -> PublicConfig:
    return PublicConfig(
        app, public_log=public_log, head_timeout_s=head_timeout_s, max_connection_s=max_connection_s,
        host=host, port=port, http=PublicH11Protocol, ws="none", lifespan="off", loop="none",
        log_config=None, access_log=False, server_header=False, date_header=False, proxy_headers=False, forwarded_allow_ips="",
        limit_concurrency=LIMIT_CONCURRENCY, timeout_keep_alive=KEEP_ALIVE_S, h11_max_incomplete_event_size=MAX_INCOMPLETE_EVENT_SIZE,
        backlog=BACKLOG, timeout_graceful_shutdown=GRACEFUL_SHUTDOWN_S,
    )


def _bind(host: str, port: int) -> socket.socket:
    family = socket.AF_INET6 if ":" in host else socket.AF_INET
    sock = socket.socket(family, socket.SOCK_STREAM)
    try:
        if os.name != "nt":  # on Windows SO_REUSEADDR would let a second process take a port that is in use
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        sock.set_inheritable(True)
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
              max_connection_s: float = MAX_CONNECTION_S, ready_timeout_s: float = 5.0) -> bool:
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
            config = build_config(app, host=host, port=port, public_log=ProtocolLog(stats), head_timeout_s=head_timeout_s,
                                  max_connection_s=max_connection_s)
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
        if not ended:
            log.warning("tickets public listener thread did not end within %.0f s", timeout_s)
        return ended

    def snapshot(self) -> dict[str, Any]:
        """Health (spec 17): running, port, last error, the listener's counters."""
        return {"running": self.running, "port": self.port, "error": self.error, "stats": self.stats.snapshot() if self.stats else None}


SERVER = PublicListener()
