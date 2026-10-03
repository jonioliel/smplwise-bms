"""A fake add-on Supervisor for the CR-021 self-update tests (stdlib only, 127.0.0.1, an ephemeral port). No real infrastructure is ever reached.

Implements what S1 and S3 call: GET /addons/self/info, POST /store/reload (S1); POST /store/addons/{slug}/update, GET /jobs/info,
GET /core/info, POST /core/check, POST /core/restart, POST /addons/self/restart, POST /addons/self/options (S3). Every request is logged as
(method, path) and its JSON body in `bodies`; the Authorization header must be `Bearer <token>`.

Role table (`role`): the Supervisor's role regexes as summarised in the S3 design (second-hand; confirmed in the lab): `default` may read
`/addons/self/info`, `/core/info` and call `/addons/self/restart|options`; `/store/*`, `/jobs/*`, `/core/check` need `manager`;
`/core/restart` needs `homeassistant` or `manager`. Refused -> 403.

Switches (attributes, set from a test):
    installed, latest      the version strings the store reports; `store_stale` keeps `version_latest` at `stale_latest` until a reload
    store_stale            True: /addons/self/info reports `stale_latest` as the latest until POST /store/reload ran
    reload_status          status of POST /store/reload (200 ok, 403 = the add-on role is too low)
    info_status            status of GET /addons/self/info (200, 403, 500 ...)
    info_state             the add-on `state` (started, startup, ...)
    slug                   the add-on's own slug; `self_accepted` True lets the store route also resolve the literal `self`
    drop                   True: the connection is closed without an answer (an unreachable / dying infrastructure)
    junk                   True: /addons/self/info answers a non-JSON body
    latest_text            when not None, `version_latest` is this raw string (a hostile value)
    update_status          status of the update call (200, 400, 409, 500 ...)
    kill_on_update         True: the update call is received, then the connection closes without an answer (the container is replaced)
    update_job             True: the update answers `{"job_id": ...}`; `job_done` / `job_errors` / `job_backup_done` shape GET /jobs/info
    core_version, core_state, core_info_status   GET /core/info
    core_check_status      status of POST /core/check (400 = the configuration is invalid)
    core_restart_status    status of POST /core/restart; `core_restart_drop` closes the connection after receiving it
    core_down_polls        after an accepted restart, this many GET /core/info answer 502 (the core is down), then `running`

    with FakeSupervisor() as sup:
        sup.latest = "0.1.153"; sup.store_stale = True
        ... point services.self_update.BASE_URL at sup.url
"""
from __future__ import annotations

import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "fake-supervisor-token"
JOB_ID = "0123456789abcdef0123456789abcdef"

MANAGER_ONLY = (re.compile(r"^/store/.*"), re.compile(r"^/jobs/.*"), re.compile(r"^/core/check$"))
CORE_RESTART = re.compile(r"^/core/restart$")


class FakeSupervisor:
    def __init__(self) -> None:
        self.installed = "0.1.152"
        self.latest = "0.1.152"
        self.stale_latest = "0.1.152"
        self.store_stale = False
        self.reload_status = 200
        self.info_status = 200
        self.info_state = "started"
        self.slug = "a1b2c3d4_smplwise_vms"
        self.self_accepted = False
        self.role = "manager"
        self.drop = False
        self.junk = False
        self.latest_text: str | None = None
        self.update_status = 200
        self.kill_on_update = False
        self.update_job = True
        self.job_done = False
        self.job_errors: list[dict] = []
        self.job_backup_done = False
        self.core_version = "2026.10.0"
        self.core_state = "running"
        self.core_info_status = 200
        self.core_check_status = 200
        self.core_restart_status = 200
        self.core_restart_drop = False
        self.core_down_polls = 0
        self._down_left = 0
        self.log: list[tuple[str, str]] = []
        self.bodies: list[tuple[str, str, object]] = []
        self.auth_ok = True
        self.hook = None  # a test's callable(method, path), run when a request arrives (e.g. to prove no database lock is held)
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

            def _ok(self, data: object) -> None:
                self._answer(200, {"result": "ok", "data": data})

            def _err(self, status: int, message: str = "no") -> None:
                self._answer(status, {"result": "error", "message": message})

            def _allowed(self, path: str) -> bool:
                if outer.role == "manager":
                    return True
                if CORE_RESTART.match(path):
                    return outer.role == "homeassistant"
                return not any(p.match(path) for p in MANAGER_ONLY)

            def _handle(self, method: str) -> None:
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length) if length else b""
                body: object = None
                if raw:
                    try:
                        body = json.loads(raw)
                    except ValueError:
                        body = raw.decode("utf-8", "replace")
                outer.log.append((method, self.path))
                outer.bodies.append((method, self.path, body))
                if outer.hook is not None:
                    outer.hook(method, self.path)
                if self.headers.get("Authorization") != f"Bearer {TOKEN}":
                    outer.auth_ok = False
                    return self._answer(401, {"result": "error", "message": "unauthorized"})
                if outer.drop:
                    self.connection.close()
                    return
                if not self._allowed(self.path):
                    return self._err(403, "forbidden")
                key = (method, self.path)
                if key == ("GET", "/addons/self/info"):
                    if outer.info_status != 200:
                        return self._err(outer.info_status)
                    if outer.junk:
                        return self._answer(200, b"<html>not json</html>")
                    latest = outer.latest_text if outer.latest_text is not None else (outer.stale_latest if outer.store_stale else outer.latest)
                    return self._ok({"version": outer.installed, "version_latest": latest, "update_available": latest != outer.installed,
                                     "state": outer.info_state, "hassio_role": outer.role, "slug": outer.slug})
                if key == ("POST", "/store/reload"):
                    if outer.reload_status != 200:
                        return self._err(outer.reload_status, "forbidden")
                    outer.store_stale = False
                    return self._ok({})
                m = re.fullmatch(r"/store/addons/([^/]+)/update", self.path)
                if method == "POST" and m:
                    if m.group(1) != outer.slug and not (outer.self_accepted and m.group(1) == "self"):
                        return self._err(404, "addon not found")
                    if not isinstance(body, dict) or set(body) != {"backup", "background"} or not all(isinstance(v, bool) for v in body.values()):
                        return self._err(400, "schema")
                    if outer.update_status != 200:
                        return self._err(outer.update_status, "refused")
                    if outer.kill_on_update:
                        outer.installed = outer.latest
                        self.connection.close()
                        return
                    return self._ok({"job_id": JOB_ID} if outer.update_job else {})
                if key == ("GET", "/jobs/info"):
                    children = [{"uuid": "c" * 32, "name": "backup_manager_partial_backup", "done": outer.job_backup_done, "errors": [], "child_jobs": []}]
                    job = {"uuid": JOB_ID, "name": "addon_manager_update", "done": outer.job_done, "errors": outer.job_errors, "child_jobs": children}
                    return self._ok({"jobs": [job]})
                if key == ("GET", "/core/info"):
                    if outer._down_left > 0:
                        outer._down_left -= 1
                        return self._err(502, "core down")
                    if outer.core_info_status != 200:
                        return self._err(outer.core_info_status)
                    return self._ok({"version": outer.core_version, "state": outer.core_state})
                if key == ("POST", "/core/check"):
                    if outer.core_check_status != 200:
                        return self._err(outer.core_check_status, "Invalid config: secret detail that must never be echoed")
                    return self._ok({})
                if key == ("POST", "/core/restart"):
                    if outer.core_restart_status != 200:
                        return self._err(outer.core_restart_status, "refused")
                    outer._down_left = outer.core_down_polls
                    if outer.core_restart_drop:
                        self.connection.close()
                        return
                    return self._ok({})
                if key in (("POST", "/addons/self/restart"), ("POST", "/addons/self/options")):
                    return self._ok({})
                self._err(404, "unknown")

            def do_GET(self) -> None:
                self._handle("GET")

            def do_POST(self) -> None:
                self._handle("POST")

            def do_DELETE(self) -> None:
                self._handle("DELETE")

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
