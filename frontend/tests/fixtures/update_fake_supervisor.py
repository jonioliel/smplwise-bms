"""A fake add-on Supervisor for the CR-021 self-update tests (stdlib only, 127.0.0.1, an ephemeral port). No real infrastructure is ever reached.

Implements what slice S1 calls: GET /addons/self/info and POST /store/reload (S3 adds POST /store/addons/self/update, POST /core/restart,
GET /jobs/info, POST /backups/new/partial). Every request is logged as (method, path); the Authorization header must be `Bearer <token>`.

Switches (attributes, set from a test):
    installed, latest      the version strings the store reports; `store_stale` keeps `version_latest` at `stale_latest` until a reload
    store_stale            True: /addons/self/info reports `stale_latest` as the latest until POST /store/reload ran
    reload_status          status of POST /store/reload (200 ok, 403 = the add-on role is too low)
    info_status            status of GET /addons/self/info (200, 403, 500 ...)
    drop                   True: the connection is closed without an answer (an unreachable / dying infrastructure)
    junk                   True: /addons/self/info answers a non-JSON body
    latest_text            when not None, `version_latest` is this raw string (a hostile value)

    with FakeSupervisor() as sup:
        sup.latest = "0.1.153"; sup.store_stale = True
        ... point services.self_update.BASE_URL at sup.url
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "fake-supervisor-token"


class FakeSupervisor:
    def __init__(self) -> None:
        self.installed = "0.1.152"
        self.latest = "0.1.152"
        self.stale_latest = "0.1.152"
        self.store_stale = False
        self.reload_status = 200
        self.info_status = 200
        self.drop = False
        self.junk = False
        self.latest_text: str | None = None
        self.log: list[tuple[str, str]] = []
        self.auth_ok = True
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a) -> None:  # silence
                pass

            def _answer(self, status: int, body: object | bytes) -> None:
                raw = body if isinstance(body, bytes) else json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def _handle(self, method: str) -> None:
                outer.log.append((method, self.path))
                if self.headers.get("Authorization") != f"Bearer {TOKEN}":
                    outer.auth_ok = False
                    return self._answer(401, {"result": "error", "message": "unauthorized"})
                if outer.drop:
                    self.connection.close()
                    return
                if (method, self.path) == ("GET", "/addons/self/info"):
                    if outer.info_status != 200:
                        return self._answer(outer.info_status, {"result": "error", "message": "no"})
                    if outer.junk:
                        return self._answer(200, b"<html>not json</html>")
                    latest = outer.latest_text if outer.latest_text is not None else (outer.stale_latest if outer.store_stale else outer.latest)
                    return self._answer(200, {"result": "ok", "data": {"version": outer.installed, "version_latest": latest, "update_available": latest != outer.installed,
                                                                        "state": "started", "hassio_role": "default"}})
                if (method, self.path) == ("POST", "/store/reload"):
                    if outer.reload_status != 200:
                        return self._answer(outer.reload_status, {"result": "error", "message": "forbidden"})
                    outer.store_stale = False
                    return self._answer(200, {"result": "ok", "data": {}})
                self._answer(404, {"result": "error", "message": "unknown"})

            def do_GET(self) -> None:
                self._handle("GET")

            def do_POST(self) -> None:
                self._handle("POST")

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self._server.server_address[1]}"

    def calls(self, method: str, path: str) -> int:
        return sum(1 for c in self.log if c == (method, path))

    def __enter__(self) -> "FakeSupervisor":
        self._thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self._server.shutdown()
        self._server.server_close()
