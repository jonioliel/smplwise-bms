"""Fixture backend for the live parts of the automations specs (CR-017, docs/architecture/AUTOMATIONS_API.md §5): the REAL SMPLWISE backend - the real
/automations routes with their permission gates, model, policy, trash, versions, audit and bridge signing - whose only fake is Home Assistant with its
automation / script / scene files and the bridge integration's `config_item` service, which here runs the REAL bridge code (config_service.py,
config_store.py, config_policy.py) against S2's `smplwise_vms/backend/tests/fake_ha_config.py`, populated with the S1 test world
(`tests/automations_transport.build_world`, from tests/automations_seed_s1.py). Everything is generic and anonymised;
nothing of a real installation is in here. No real Home Assistant can be reached from this process: HA_URL is forced to a `.test` host (a reserved name that
never resolves), the HA WebSocket is an in-process fake (below) and every REST call to that host is answered here. It refuses to start inside the add-on.

What the fake Home Assistant does:
- WebSocket: auth, `get_config`, the registry listings (the generic entities plus the loaded automations, scripts and scenes), `get_states`,
  `subscribe_events` (`state_changed`, the registry events, `automation_reloaded`, `scene_reloaded`, `automation_triggered`, `script_started`), and the
  read-only commands `automation/config`, `script/config`, `trace/list`, `trace/get`, `validate_config`, `get_services`.
- REST: `GET /api/config/{automation|script|scene}/config/{id}` (200 / 404 as Home Assistant answers), `GET /api/states/{entity}` and
  `POST /api/services/smplwise_bridge/config_item?return_response` (the add-on's only write path: the real bridge code over the in-memory files).

On start it pairs the bridge (signed ping, version 0.6.0), pushes the user directory (`joni` an HA administrator, `omer` and `vera` not) and sets the
Shabbat sensor. A small control server (127.0.0.1, SW_FAKE_HA_CONTROL_PORT, default SW_PORT + 1) is the spec's hand on the world: `POST /tick {seconds}`,
`POST /world {entity_id, state, attributes?}`, `POST /external {id, alias}` (an automation edited "in Home Assistant": the file changes, a reload event
is pushed), `POST /trace {domain, item_id, trigger?, result?, steps?, secret?}`, `POST /delegation {on}` (the options-flow switch and the directory
push that tells the add-on), `POST /load {ok}` (a reload that never registers a new item: the include line is missing), `POST /fail {service}` and
`POST /timeout` (the next bridge call fails / never answers), `POST /config-api {on}`, `GET /status` (counts, calls, bridge calls - never a secret).

Run it (a fresh data dir each time):

    SW_PORT=8350 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \\
        <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/automations_fake_ha.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_AUTOMATIONS_FIXTURE=1 SW_API_PORT=8350 SW_BASE_URL=http://127.0.0.1:4190/ \\
        npx playwright test tests/evidence-automations-live.spec.ts --workers=1
"""
from __future__ import annotations

import asyncio
import copy
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("automations_fake_ha: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests"))
FAKE_HOST = "fake-automations.test"
os.environ["HA_URL"] = f"http://{FAKE_HOST}:8123"
os.environ["HA_TOKEN"] = "fake-fixture-token"
PORT = int(os.environ.get("SW_PORT", "8099"))
BASE = f"http://127.0.0.1:{PORT}/api/v1"

import httpx  # noqa: E402
import websockets  # noqa: E402

import fake_scheduler  # noqa: E402
from automations_transport import FakeTransport, build_world  # noqa: E402
from smplwise.errors import ApiError  # noqa: E402

LOCK = threading.RLock()
FAKE = build_world()
TR = FakeTransport(FAKE, "")  # the add-on's calls into the fake (REST, WebSocket, the real bridge code); the pairing code is set once the backend is up
SECRET: dict[str, str] = {}  # the pairing code once the backend is up (the bridge's shared secret)
_prev: dict[str, dict[str, Any]] = {}


def _states() -> list[dict[str, Any]]:
    with LOCK:
        return copy.deepcopy(list(FAKE.states.values()))


def _registry() -> list[dict[str, Any]]:
    with LOCK:
        return copy.deepcopy(FAKE.registry)


class _World:
    def __init__(self) -> None:
        self.sockets: list[_FakeSocket] = []
        self.lock = threading.Lock()

    def emit(self, event_type: str, data: dict[str, Any]) -> None:
        with self.lock:
            sockets = list(self.sockets)
        for s in sockets:
            s.deliver(event_type, data)


WORLD = _World()


def _push_changes(reloaded: bool = False) -> None:
    """After anything moved: `state_changed` for every entity whose state or attributes changed, the registry events for new / removed entities, and the reload events."""
    with LOCK:
        now = {e["entity_id"]: {"entity_id": e["entity_id"], "state": e["state"], "attributes": copy.deepcopy(e["attributes"])} for e in FAKE.states.values()}
    for eid, st in now.items():
        old = _prev.get(eid)
        if old is None:
            WORLD.emit("entity_registry_updated", {"action": "create", "entity_id": eid})
        if old != st:
            WORLD.emit("state_changed", {"entity_id": eid, "old_state": old, "new_state": {**st, "last_changed": "2026-10-01T10:10:00+00:00", "last_updated": "2026-10-01T10:10:00+00:00"}})
    for eid in list(_prev):
        if eid not in now:
            WORLD.emit("entity_registry_updated", {"action": "remove", "entity_id": eid})
    _prev.clear()
    _prev.update(now)
    if reloaded:
        WORLD.emit("automation_reloaded", {})
        WORLD.emit("scene_reloaded", {})


with LOCK:
    _prev.update({e["entity_id"]: {"entity_id": e["entity_id"], "state": e["state"], "attributes": copy.deepcopy(e["attributes"])} for e in FAKE.states.values()})


_real_handle = httpx.HTTPTransport.handle_request


def handle_request(self: httpx.HTTPTransport, request: httpx.Request) -> httpx.Response:
    if request.url.host == FAKE_HOST:
        path = request.url.path
        if request.method == "POST" and path == "/api/services/smplwise_bridge/config_item":
            body = json.loads(request.content or b"{}")
            with LOCK:
                try:
                    resp = TR.bridge(body)
                except ApiError as exc:
                    if exc.code != "config_timeout":
                        raise
                    raise httpx.ReadTimeout("automations_fake_ha: the bridge never answered", request=request) from None
            _push_changes(reloaded=body.get("op") in ("upsert", "delete"))
            return httpx.Response(200, json={"service_response": resp}, request=request)
        parts = path.strip("/").split("/")
        if request.method == "GET" and parts[:2] == ["api", "config"] and len(parts) == 5 and parts[3] == "config":
            with LOCK:
                status, data = TR.rest_config(parts[2], parts[4])
            if data is None:
                return httpx.Response(status, text="404: Not Found", request=request)
            return httpx.Response(status, json=data, request=request)
        if request.method == "GET" and parts[:2] == ["api", "states"] and len(parts) == 3:
            with LOCK:
                st = TR.state(parts[2])
            return httpx.Response(200 if st else 404, json=st or {"message": "Entity not found."}, request=request)
        if request.method == "GET" and path == "/api/config":
            return httpx.Response(200, json={"version": "fake-2026.9", "time_zone": "Asia/Jerusalem"}, request=request)
        raise httpx.ConnectError(f"automations_fake_ha: no answer for {path}", request=request)
    return _real_handle(self, request)


httpx.HTTPTransport.handle_request = handle_request  # type: ignore[method-assign]


class _FakeSocket:
    def __init__(self) -> None:
        self.inbox: asyncio.Queue[str] = asyncio.Queue()
        self.loop = asyncio.get_running_loop()
        self.subs: dict[int, str] = {}

    async def __aenter__(self) -> "_FakeSocket":
        self.inbox.put_nowait(json.dumps({"type": "auth_required", "ha_version": "fake"}))
        with WORLD.lock:
            WORLD.sockets.append(self)
        return self

    async def __aexit__(self, *_exc: Any) -> None:
        with WORLD.lock:
            if self in WORLD.sockets:
                WORLD.sockets.remove(self)

    async def send(self, raw: str) -> None:
        msg = json.loads(raw)
        if msg.get("type") == "auth":
            self.inbox.put_nowait(json.dumps({"type": "auth_ok", "ha_version": "fake"}))
            return
        mid, kind = msg.get("id"), msg.get("type")
        listings = {"config/device_registry/list": [], "config/area_registry/list": fake_scheduler.AREAS, "config/floor_registry/list": fake_scheduler.FLOORS}
        if kind == "get_config":
            result: Any = {"version": "fake-2026.9"}
        elif kind == "get_states":
            result = _states()
        elif kind == "subscribe_events":
            self.subs[mid] = msg.get("event_type") or "*"
            result = None
        elif kind == "config/entity_registry/list":
            result = _registry()
        elif kind in listings:
            result = listings[kind]
        else:
            with LOCK:
                reply = FAKE.ws({k: v for k, v in msg.items() if k != "id"})
            self.inbox.put_nowait(json.dumps({"id": mid, "type": "result", **reply}))
            return
        self.inbox.put_nowait(json.dumps({"id": mid, "type": "result", "success": True, "result": result}))

    def deliver(self, event_type: str, data: dict[str, Any]) -> None:
        for sid, et in self.subs.items():
            if et in (event_type, "*"):
                self.loop.call_soon_threadsafe(self.inbox.put_nowait, json.dumps({"id": sid, "type": "event", "event": {"event_type": event_type, "data": data, "time_fired": "2026-10-01T10:10:00+00:00"}}))

    async def recv(self) -> str:
        return await self.inbox.get()

    def __aiter__(self) -> "_FakeSocket":
        return self

    async def __anext__(self) -> str:
        return await self.inbox.get()


def _connect(url: str, **_kw: Any) -> Any:
    if threading.current_thread().name == "ha-sync":
        return _FakeSocket()
    raise OSError(f"automations_fake_ha: no Home Assistant WebSocket here ({url})")


websockets.connect = _connect  # type: ignore[assignment]


def _directory(delegated: bool) -> None:
    from smplwise.services import ha_bridge

    users = [{"id": "dev-joni", "name": "joni", "username": "joni", "is_active": True, "is_admin": True, "group_ids": []},
             {"id": "dev-omer", "name": "omer", "username": "omer", "is_active": True, "is_admin": False, "group_ids": []},
             {"id": "dev-vera", "name": "vera", "username": "vera", "is_active": True, "is_admin": False, "group_ids": []}]
    body = ha_bridge.sign(SECRET.get("code", ""), {"users": users, "version": "0.6.0", "delegated_authoring": delegated, "delegated_changed_at": "2026-10-01T09:00:00Z" if delegated else None, "config_item": True})
    with httpx.Client(timeout=5) as c:
        c.post(f"{BASE}/ha/bridge/directory", json=body)


class _Control(BaseHTTPRequestHandler):
    def log_message(self, *_args: Any) -> None:
        return

    def _reply(self, code: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:  # noqa: N802
        with LOCK:
            body = {"automations": len(FAKE.automations), "scripts": len(FAKE.scripts), "scenes": len(FAKE.scenes), "sockets": len(WORLD.sockets),
                    "now": FAKE.now().isoformat(), "calls": [{"domain": c["domain"], "service": c["service"], "user_id": c["user_id"]} for c in FAKE.calls],
                    "bridge_calls": [{"op": c.get("op"), "kind": c.get("kind"), "profile": c.get("profile")} for c in TR.bridge_calls], "delegated": TR.delegated}
        self._reply(200, body)

    def do_POST(self) -> None:  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        reloaded = False
        with LOCK:
            if self.path == "/tick":
                FAKE.advance(float(body.get("seconds", 60)))
            elif self.path == "/world":
                w = FAKE.states.setdefault(body["entity_id"], {"entity_id": body["entity_id"], "state": None, "attributes": {}})
                w["state"] = body["state"]
                w["attributes"] = {**(w.get("attributes") or {}), **(body.get("attributes") or {})}
            elif self.path == "/external":
                item = next(i for i in FAKE.automations if str(i.get("id")) == body["id"])
                item["alias"] = body.get("alias", item.get("alias"))
                FAKE.reload_automation(body["id"])
                reloaded = True
            elif self.path == "/trace":
                dom, iid = body["domain"], body["item_id"]
                cfg = FAKE.scripts.get(iid) if dom == "script" else next(i for i in FAKE.automations if str(i.get("id")) == iid)
                base = "action" if dom == "automation" else "sequence"
                FAKE.add_run(dom, iid, cfg, variables={"api_key": "abc-not-real", "level": 3} if body.get("secret") else None,
                             fail_step=f"{base}/{max(0, int(body.get('steps', 2)) - 1)}" if body.get("result") == "error" else None, conditions_pass=body.get("result") != "failed_conditions")
            elif self.path == "/delegation":
                TR.delegated = bool(body.get("on"))
            elif self.path == "/load":
                FAKE.include_loaded = bool(body.get("ok", True))
            elif self.path == "/fail":
                FAKE.fail_next[f"call:{body['service']}"] = RuntimeError("service failed")
            elif self.path == "/timeout":
                TR.fail_next["timeout"] = True
            elif self.path == "/config-api":
                FAKE.config_api = bool(body.get("on", True))
            else:
                self._reply(404, {"error": "unknown"})
                return
        if self.path == "/delegation":
            _directory(bool(body.get("on")))
        if self.path == "/world":
            with LOCK:
                w = FAKE.states[body["entity_id"]]
                new = {"entity_id": body["entity_id"], "state": w["state"], "attributes": w.get("attributes") or {}, "last_changed": "2026-10-01T10:10:00+00:00", "last_updated": "2026-10-01T10:10:00+00:00"}
            WORLD.emit("state_changed", {"entity_id": body["entity_id"], "old_state": None, "new_state": new})
        _push_changes(reloaded)
        self._reply(200, {"ok": True})


def _serve_control() -> None:
    port = int(os.environ.get("SW_FAKE_HA_CONTROL_PORT", str(PORT + 1)))
    server = ThreadingHTTPServer(("127.0.0.1", port), _Control)
    print(f"automations_fake_ha: fake Home Assistant control on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


def _pair() -> None:
    """The integration's config flow (a signed ping at bridge 0.6.0), the user directory, then the Shabbat sensor."""
    from smplwise.services import ha_bridge

    for _ in range(120):
        try:
            with httpx.Client(timeout=5) as c:
                r = c.get(f"{BASE}/ha/bridge/pairing")
                if r.status_code == 200:
                    SECRET["code"] = r.json()["pairing_code"]
                    TR.secret = SECRET["code"]
                    p = c.post(f"{BASE}/ha/bridge/ping", json=ha_bridge.sign(SECRET["code"], {"version": "0.6.0"}))
                    print(f"automations_fake_ha: bridge paired ({p.status_code})", flush=True)
                    _directory(False)
                    s = c.patch(f"{BASE}/settings", json={"automations.enabled": "true", "schedules.shabbat_sensor": fake_scheduler.SHABBAT, "schedules.shabbat_sensor_force": True,
                                                         "automations.notify_targets": ["notify.mobile_app_phone_a"]})
                    print(f"automations_fake_ha: feature on ({s.status_code})", flush=True)
                    return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    print("automations_fake_ha: the backend never came up; bridge not paired", flush=True)


def main() -> None:
    threading.Thread(target=_pair, name="automations-fixture-pair", daemon=True).start()
    threading.Thread(target=_serve_control, name="automations-fixture-control", daemon=True).start()
    print(f"automations_fake_ha: fake Home Assistant with {len(FAKE.automations)} automations, {len(FAKE.scripts)} scripts, {len(FAKE.scenes)} scenes; backend on {BASE}", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
