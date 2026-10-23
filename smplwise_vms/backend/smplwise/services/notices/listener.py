"""CR-NOTICE106 section 4.1 / 4.2 option A - the LAN listener for the TV boards. The main application is reached only through
Home Assistant Ingress, which a TV browser cannot sign in to; this small read-only listener serves ONLY the TV page, its own asset
files and the two display routes, on container port 18094, when the add-on option `notice_boards` is on (config.yaml maps the
port to null: the owner also maps a host port, like the cast relay). Every other path is a 404; every method but GET / HEAD is a
405. The client address is used for the rate limits only and never logged; the path (the slug) is never logged either."""
from __future__ import annotations

import logging
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from . import page
from .display import DisplayService, Reply, Request, not_found

log = logging.getLogger(__name__)
CONTAINER_PORT = 18094
# SEC217 (finding 2.2): the listener shares the backend process, so its threads are bounded. A TV reads one feed every few seconds
# over HTTP/1.0 (one request per connection): 64 open connections in all and 16 per client address are far above any real lobby.
REQUEST_TIMEOUT_S = 10.0
MAX_CONNECTIONS = 64
MAX_PER_CLIENT = 16


def route(svc: DisplayService, www_dir: Any, method: str, path: str, headers: dict[str, str], client: str) -> Reply:
    """The whole listener as one pure function (tests call it directly)."""
    if method not in ("GET", "HEAD"):
        return Reply(405, b"", headers=[("Allow", "GET, HEAD")])
    path = path.split("?", 1)[0].split("#", 1)[0]
    parts = [p for p in path.split("/") if p]
    if len(parts) == 2 and parts[0] == "b":
        html = page.page_html(www_dir)
        return Reply(200, html, "text/html; charset=utf-8") if html else not_found()
    if len(parts) == 2 and parts[0] == "assets":
        got = page.asset(www_dir, parts[1])
        return Reply(200, got[0], got[1], [("Cache-Control", "public, max-age=31536000, immutable")]) if got else not_found()
    if len(parts) in (5, 7) and parts[:4] == ["api", "v1", "notices", "display"]:
        req = Request(slug=parts[4], token=headers.get("x-board-token"), if_none_match=headers.get("if-none-match"), client=client)
        if len(parts) == 5:
            return svc.feed(req)
        if parts[5:] == ["logo", "company"]:
            return svc.logo(req)
    return not_found()


class _Handler(BaseHTTPRequestHandler):
    server_version = "SmplWise"
    sys_version = ""
    svc: DisplayService
    www_dir: Any = None
    # SEC217 (security review 2.16.0, finding 2.2): a socket timeout for every read / write of a connection - a client that sends
    # its request one byte at a time, or nothing at all, is dropped instead of holding a thread for ever (slow-loris)
    timeout = REQUEST_TIMEOUT_S

    def log_message(self, fmt: str, *args: Any) -> None:  # never the path (the slug) or the client address
        return

    def _do(self) -> None:
        hdrs = {k.lower(): v for k, v in self.headers.items()}
        r = route(self.svc, self.www_dir, self.command, self.path, hdrs, self.client_address[0] if self.client_address else "")
        self.send_response(r.status)
        for k, v in r.all_headers():  # an asset's own caching replaces the no-store of the page and the feed (Reply.all_headers)
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(r.body)))
        self.end_headers()
        if self.command != "HEAD" and r.body:
            self.wfile.write(r.body)

    def do_GET(self) -> None:  # noqa: N802
        self._do()

    def do_HEAD(self) -> None:  # noqa: N802
        self._do()

    def do_POST(self) -> None:  # noqa: N802
        self._do()

    do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_POST


class BoundedServer(ThreadingHTTPServer):
    """ThreadingHTTPServer with a cap on open connections, in all and per client address (SEC217, finding 2.2). A connection over a
    cap is closed at once, before a thread exists for it; a slot is given back when its handler thread ends."""

    daemon_threads = True
    block_on_close = False

    def __init__(self, address: tuple[str, int], handler: type, *, max_connections: int | None = None, max_per_client: int | None = None) -> None:
        super().__init__(address, handler)
        self.max_connections = max_connections if max_connections is not None else MAX_CONNECTIONS
        self.max_per_client = max_per_client if max_per_client is not None else MAX_PER_CLIENT
        self._lock = threading.Lock()
        self._open = 0
        self._per: dict[str, int] = {}
        self.refused = 0

    @staticmethod
    def _ip(client_address: Any) -> str:
        return str(client_address[0]) if isinstance(client_address, (tuple, list)) and client_address else ""

    def _release(self, ip: str) -> None:
        with self._lock:
            self._open = max(0, self._open - 1)
            n = self._per.get(ip, 0) - 1
            if n > 0:
                self._per[ip] = n
            else:
                self._per.pop(ip, None)

    @property
    def open_connections(self) -> int:
        with self._lock:
            return self._open

    def process_request(self, request: Any, client_address: Any) -> None:
        ip = self._ip(client_address)
        with self._lock:
            ok = self._open < self.max_connections and self._per.get(ip, 0) < self.max_per_client
            if ok:
                self._open += 1
                self._per[ip] = self._per.get(ip, 0) + 1
            else:
                self.refused += 1
        if not ok:
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._release(ip)
            raise

    def process_request_thread(self, request: Any, client_address: Any) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._release(self._ip(client_address))


class BoardServer:
    def __init__(self) -> None:
        self._server: BoundedServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def running(self) -> bool:
        return self._server is not None

    @property
    def address(self) -> tuple[str, int] | None:
        return self._server.server_address[:2] if self._server is not None else None  # type: ignore[return-value]

    def start(self, svc: DisplayService, www_dir: Any, host: str = "0.0.0.0", port: int = CONTAINER_PORT) -> bool:  # noqa: S104 - the LAN TVs
        if self._server is not None:
            return True
        handler = type("NoticeBoardHandler", (_Handler,), {"svc": svc, "www_dir": www_dir})
        try:
            server = BoundedServer((host, port), handler)
        except OSError as exc:
            log.warning("notice board listener could not start: %s", type(exc).__name__)
            return False
        self._server = server
        self._thread = threading.Thread(target=server.serve_forever, name="notice-boards", daemon=True)
        self._thread.start()
        log.info("notice board listener on container port %s", port)
        return True

    def stop(self) -> None:
        if self._server is None:
            return
        self._server.shutdown()
        self._server.server_close()
        self._server = None


SERVER = BoardServer()
