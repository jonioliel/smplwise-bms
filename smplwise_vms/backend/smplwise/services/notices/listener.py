"""CR-NOTICE106 section 4.1 / 4.2 option A - the LAN listener for the TV boards. The main application is reached only through
Home Assistant Ingress, which a TV browser cannot sign in to; this small read-only listener serves ONLY the TV page, its own asset
files and the two display routes, on container port 18094, when the add-on option `notice_boards` is on (config.yaml maps the
port to null: the owner also maps a host port, like the cast relay). Every other path is a 404; every method but GET / HEAD is a
405. The client address is used for the rate limits only and never logged; the path (the slug) is never logged either."""
from __future__ import annotations

import logging
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import time
from typing import Any, Callable

from ..lan_listener import CappedServer, RequestDeadline
from . import page
from .display import DisplayService, Reply, Request, not_found

log = logging.getLogger(__name__)
CONTAINER_PORT = 18094
SOCKET_TIMEOUT_S = 10.0  # a TV that stalls frees its thread after this long (it bounds ONE socket read)
# LISTENER-DEADLINE-2540 (follow-up of CAST-RELAY-HARDEN-2540, deep review V-02): the whole request - request line and headers (the
# listener reads no body) - must arrive within this deadline, so a slow-loris client that drips a byte inside SOCKET_TIMEOUT_S is cut
# off too (services/lan_listener.RequestDeadline). One request per connection (HTTP/1.0).
REQUEST_DEADLINE_S = 10.0
MAX_CONNECTIONS = 32  # simultaneous connections; more are closed at once (a TV retries on its own). The default of the editable setting
MAX_PER_ADDRESS = 8  # simultaneous connections from one client address (NOTICECAPS-295); the default of the editable setting
CAPS_TTL_S = 2.0  # the settings are re-read at most this often, so a flood of connections cannot become a flood of database reads


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
        if parts[5:] == ["transit"]:  # BUSTIMES-295
            return svc.transit(req)
        if parts[5:] == ["photo"]:  # NOTICESLIDES-295
            return svc.image(req, "photo")
        if parts[5:] == ["photo-night"]:  # LOBBY-STYLES-2300
            return svc.image(req, "photo-night")
        if len(parts) == 7 and parts[5] == "slide":
            return svc.image(req, "slide", parts[6])
        if len(parts) == 7 and parts[5] == "news-logo":  # NOTICERSS-295
            return svc.news_logo(req, parts[6])
    return not_found()


# CAST-RELAY-HARDEN-2540: the class moved to services/lan_listener.py (the cast relay reuses it); its old name stays here
_CappedServer = CappedServer


def cached_caps(read: Callable[[], tuple[int, int]], ttl: float = CAPS_TTL_S, clock: Callable[[], float] = time.monotonic) -> Callable[[], tuple[int, int]]:
    """Wraps a settings read so it runs at most once per `ttl` seconds (a raising read propagates; the server keeps the last good values)."""
    state: dict[str, Any] = {"at": None, "val": None}
    lock = threading.Lock()

    def get() -> tuple[int, int]:
        with lock:
            now = clock()
            if state["at"] is None or now - state["at"] >= ttl:
                state["val"] = read()
                state["at"] = now
            return state["val"]

    return get


def settings_caps(open_conn: Callable[[], Any]) -> Callable[[], tuple[int, int]]:
    """The caps as the administrator set them in the notice-board settings (clamped; the defaults when nothing is stored)."""
    from . import store

    def read() -> tuple[int, int]:
        with open_conn() as conn:
            s = store.settings(conn)
        return s["conn_total"], s["conn_per_address"]

    return read


class _Handler(RequestDeadline, BaseHTTPRequestHandler):
    timeout = SOCKET_TIMEOUT_S  # StreamRequestHandler applies it to the connection socket
    request_deadline_s = REQUEST_DEADLINE_S  # LISTENER-DEADLINE-2540: the whole request line + headers
    server_version = "SmplWise"
    sys_version = ""
    svc: DisplayService
    www_dir: Any = None

    def log_message(self, fmt: str, *args: Any) -> None:  # never the path (the slug) or the client address
        return

    def _do(self) -> None:
        self.clear_deadline()  # the request is in (no body is read): the answer is bounded by the socket timeout alone
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

    def start(self, svc: DisplayService, www_dir: Any, host: str = "0.0.0.0", port: int = CONTAINER_PORT,  # noqa: S104 - the LAN TVs
              caps: Callable[[], tuple[int, int]] | None = None) -> bool:
        if self._server is not None:
            return True
        handler = type("NoticeBoardHandler", (_Handler,), {"svc": svc, "www_dir": www_dir})
        try:
            server = _CappedServer((host, port), handler, caps=cached_caps(caps) if caps else None)
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
