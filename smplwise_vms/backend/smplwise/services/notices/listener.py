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
SOCKET_TIMEOUT_S = 10.0  # a TV that stalls (or a slow-loris client) frees its thread after this long
MAX_CONNECTIONS = 32  # simultaneous connections; more are closed at once (a TV retries on its own)


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
    if len(parts) in (5, 6, 7) and parts[:4] == ["api", "v1", "notices", "display"]:
        req = Request(slug=parts[4], token=headers.get("x-board-token"), if_none_match=headers.get("if-none-match"), client=client)
        if len(parts) == 5:
            return svc.feed(req)
        if parts[5:] == ["logo", "company"]:
            return svc.logo(req)
        if parts[5:] == ["photo"]:  # NOTICESLIDES-295
            return svc.image(req, "photo")
        if len(parts) == 7 and parts[5] == "slide":
            return svc.image(req, "slide", parts[6])
        if len(parts) == 7 and parts[5] == "news-logo":  # NOTICERSS-295
            return svc.news_logo(req, parts[6])
    return not_found()


class _CappedServer(ThreadingHTTPServer):
    """ThreadingHTTPServer with a ceiling on simultaneous connections: over the cap the socket is closed without a thread."""

    daemon_threads = True

    def __init__(self, *args: Any, max_connections: int = MAX_CONNECTIONS, **kw: Any) -> None:
        super().__init__(*args, **kw)
        self._slots = threading.BoundedSemaphore(max_connections)

    def process_request(self, request: Any, client_address: Any) -> None:
        if not self._slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._slots.release()
            raise

    def process_request_thread(self, request: Any, client_address: Any) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._slots.release()


class _Handler(BaseHTTPRequestHandler):
    timeout = SOCKET_TIMEOUT_S  # StreamRequestHandler applies it to the connection socket
    server_version = "SmplWise"
    sys_version = ""
    svc: DisplayService
    www_dir: Any = None

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


class BoardServer:
    def __init__(self) -> None:
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def running(self) -> bool:
        return self._server is not None

    def start(self, svc: DisplayService, www_dir: Any, host: str = "0.0.0.0", port: int = CONTAINER_PORT) -> bool:  # noqa: S104 - the LAN TVs
        if self._server is not None:
            return True
        handler = type("NoticeBoardHandler", (_Handler,), {"svc": svc, "www_dir": www_dir})
        try:
            server = _CappedServer((host, port), handler)
        except OSError as exc:
            log.warning("notice board listener could not start: %s", type(exc).__name__)
            return False
        server.daemon_threads = True
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
