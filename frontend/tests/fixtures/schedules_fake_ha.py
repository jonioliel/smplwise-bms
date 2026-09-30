"""Fixture backend for the live parts of the schedules specs (CR-014, docs/architecture/SCHEDULER_API.md §9): the REAL
SMPLWISE backend - the real /schedules routes with their permission gates, validation, safety rules, trash, audit and
bridge signing - whose only fake is Home Assistant with its scheduler component and the bridge integration's
`schedule` service. Everything is generic and anonymised (`smplwise_vms/backend/tests/fake_scheduler.py`); nothing of a real
installation is in here. No real Home Assistant can be reached from this process: HA_URL is forced to a `.test` host (a
reserved name that never resolves), the HA WebSocket is an in-process fake (below) and every REST call to that host is
answered here. It refuses to start inside the add-on.

What the fake Home Assistant does:
- WebSocket: auth, `get_config`, the four registry listings (the generic entities plus one `scheduler` platform switch
  per schedule), `get_states`, `subscribe_events` (`state_changed` and the registry events), and the component's own
  commands `scheduler`, `scheduler/item`, `scheduler/tags`, `manifest/get`, `scheduler_updated` (its `item_created` /
  `item_updated` / `item_removed` events are pushed on every change, so the mirror follows like the real one).
- REST: `POST /api/services/smplwise_bridge/schedule?return_response` (the add-on's only write path, HTTP form of §9.6)
  is answered by `FakeScheduler.bridge_schedule` with the real HMAC check, the add-on's own allow-list, the sensitive
  flag, the registry check and the id diff. A schedule's switch changes state after a change and when a slot fires.

On start it pairs the bridge (signed ping, version 0.3.0), switches the feature on and sets the Shabbat sensor, and marks
the generic bulk-safe switch. A small control server (127.0.0.1, SW_FAKE_HA_CONTROL_PORT, default SW_PORT + 1) is the
spec's hand on the world: `POST /tick {seconds}` (the fake clock moves, slots fire WITH their conditions), `POST /world
{entity_id, state, attributes?}` (a sensor turns on / becomes unavailable), `POST /fail {op, error}` and `POST /timeout
{op}` (the next bridge call of that op is refused / never answered), `POST /component {installed}` (the component goes
missing), `POST /external {name}` (a schedule created "in the card": events only), `GET /status` (counts, calls, bridge calls
- never a secret).

Run it (a fresh data dir each time):

    SW_PORT=8349 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/schedules_fake_ha.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_SCHEDULES_FIXTURE=1 SW_API_PORT=8349 SW_BASE_URL=http://127.0.0.1:4189/ \
        npx playwright test tests/evidence-schedules-live.spec.ts --workers=1
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
    sys.exit("schedules_fake_ha: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests"))
FAKE_HOST = "fake-schedules.test"
os.environ["HA_URL"] = f"http://{FAKE_HOST}:8123"
os.environ["HA_TOKEN"] = "fake-fixture-token"
PORT = int(os.environ.get("SW_PORT", "8099"))
BASE = f"http://127.0.0.1:{PORT}/api/v1"

import httpx  # noqa: E402
import websockets  # noqa: E402

import fake_scheduler  # noqa: E402

LOCK = threading.RLock()
FAKE = fake_scheduler.FakeScheduler()
fake_scheduler.seed_live_like(FAKE)
SECRET: dict[str, str] = {}  # the pairing code once the backend is up (the bridge's shared secret)
_prev_states: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------- the world as Home Assistant lists it

def _states() -> list[dict[str, Any]]:
    t0 = "2026-09-30T10:00:00+00:00"
    with LOCK:
        world = [{"entity_id": eid, "state": s["state"], "attributes": s["attributes"], "last_changed": t0, "last_updated": t0} for eid, s in FAKE.world.items()]
        switches = [{"entity_id": s["entity_id"], "state": s["state"], "attributes": copy.deepcopy(s["attributes"]), "last_changed": t0, "last_updated": t0} for s in FAKE.states.values()]
    return copy.deepcopy(world + switches)


def _entity_registry() -> list[dict[str, Any]]:
    reg = fake_scheduler.world_registry()
    with LOCK:
        for r in FAKE.registry:
            reg.append({"id": f"reg-{r['entity_id']}", "entity_id": r["entity_id"], "unique_id": r["unique_id"], "platform": "scheduler", "config_entry_id": "ce-scheduler",
                        "device_id": r["device_id"], "area_id": None, "entity_category": None, "original_name": None, "name": None, "disabled_by": None, "hidden_by": None})
    return reg


class _World:
    def __init__(self) -> None:
        self.sockets: list[_FakeSocket] = []
        self.lock = threading.Lock()

    def emit(self, event_type: str, data: dict[str, Any]) -> None:
        with self.lock:
            sockets = list(self.sockets)
        for s in sockets:
            s.deliver(event_type, data)

    def emit_component(self, frames: list[dict[str, Any]]) -> None:
        with self.lock:
            sockets = list(self.sockets)
        for s in sockets:
            for f in frames:
                s.push(f)


WORLD = _World()


def _push_changes() -> None:
    """After anything moved: the component's own events, `state_changed` for every switch that changed, and the registry
    event when a schedule appeared or went (a new switch)."""
    with LOCK:
        frames = FAKE.pop_events()
        now = {sid: {"entity_id": s["entity_id"], "state": s["state"], "attributes": copy.deepcopy(s["attributes"])} for sid, s in FAKE.states.items()}
    WORLD.emit_component(frames)
    for sid, st in now.items():
        old = _prev_states.get(sid)
        if old is None:
            WORLD.emit("entity_registry_updated", {"action": "create", "entity_id": st["entity_id"]})
        if old != st:
            WORLD.emit("state_changed", {"entity_id": st["entity_id"], "old_state": old, "new_state": {**st, "last_changed": "2026-09-30T10:10:00+00:00", "last_updated": "2026-09-30T10:10:00+00:00"}})
    for sid in list(_prev_states):
        if sid not in now:
            WORLD.emit("entity_registry_updated", {"action": "remove", "entity_id": _prev_states[sid]["entity_id"]})
    _prev_states.clear()
    _prev_states.update(now)


with LOCK:
    _prev_states.update({sid: {"entity_id": s["entity_id"], "state": s["state"], "attributes": copy.deepcopy(s["attributes"])} for sid, s in FAKE.states.items()})


# ---------------------------------------------------------------- REST: the bridge's `schedule` service

_real_handle = httpx.HTTPTransport.handle_request


def handle_request(self: httpx.HTTPTransport, request: httpx.Request) -> httpx.Response:
    if request.url.host == FAKE_HOST:
        if request.method == "POST" and request.url.path == "/api/services/smplwise_bridge/schedule":
            body = json.loads(request.content or b"{}")
            with LOCK:
                try:
                    resp = FAKE.bridge_schedule(body, SECRET.get("code", ""))
                except httpx.ReadTimeout:
                    raise httpx.ReadTimeout("schedules_fake_ha: the bridge never answered", request=request) from None
            _push_changes()
            return httpx.Response(200, json={"service_response": resp}, request=request)
        raise httpx.ConnectError(f"schedules_fake_ha: no answer for {request.url.path}", request=request)
    return _real_handle(self, request)


httpx.HTTPTransport.handle_request = handle_request  # type: ignore[method-assign]


# ---------------------------------------------------------------- WebSocket: the HA API as the sync and the mirror use it

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

    def push(self, frame: dict[str, Any]) -> None:
        if frame.get("id") in (None, FAKE.subscription_id) and FAKE.subscription_id in self.subs:
            self.loop.call_soon_threadsafe(self.inbox.put_nowait, json.dumps({**frame, "id": FAKE.subscription_id}))

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
            result = _entity_registry()
        elif kind in listings:
            result = listings[kind]
        elif kind in ("scheduler", "scheduler/item", "scheduler/tags", "manifest/get", "scheduler_updated", "get_services"):
            with LOCK:
                frames = FAKE.ws(msg)
            if kind == "scheduler_updated":
                self.subs[mid] = "scheduler_updated"
            for f in frames:
                self.inbox.put_nowait(json.dumps(f))
            return
        else:
            self.inbox.put_nowait(json.dumps({"id": mid, "type": "result", "success": False, "error": {"code": "unknown_command"}}))
            return
        self.inbox.put_nowait(json.dumps({"id": mid, "type": "result", "success": True, "result": result}))

    def deliver(self, event_type: str, data: dict[str, Any]) -> None:
        for sid, et in self.subs.items():
            if et in (event_type, "*"):
                self.loop.call_soon_threadsafe(self.inbox.put_nowait, json.dumps({"id": sid, "type": "event", "event": {"event_type": event_type, "data": data}}))

    async def recv(self) -> str:
        return await self.inbox.get()

    def __aiter__(self) -> "_FakeSocket":
        return self

    async def __anext__(self) -> str:
        return await self.inbox.get()


def _connect(url: str, **_kw: Any) -> Any:
    if threading.current_thread().name == "ha-sync":
        return _FakeSocket()
    raise OSError(f"schedules_fake_ha: no Home Assistant WebSocket here ({url})")


websockets.connect = _connect  # type: ignore[assignment]


# ---------------------------------------------------------------- the control server

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
            body = {"schedules": len(FAKE.items), "sockets": len(WORLD.sockets), "installed": FAKE.installed, "now": FAKE.now().isoformat(),
                    "calls": [{"domain": c["domain"], "service": c["service"]} for c in FAKE.calls], "bridge_calls": [{"op": c.get("op"), "schedule_id": c.get("schedule_id")} for c in FAKE.bridge_calls],
                    "fired": len(FAKE.actions_fired)}
        self._reply(200, body)

    def do_POST(self) -> None:  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        with LOCK:
            if self.path == "/tick":
                FAKE.tick(float(body.get("seconds", 60)))
            elif self.path == "/world":
                w = FAKE.world.setdefault(body["entity_id"], {"entity_id": body["entity_id"], "state": None, "attributes": {}})
                w["state"] = body["state"]
                w["attributes"] = {**(w.get("attributes") or {}), **(body.get("attributes") or {})}
            elif self.path == "/fail":
                FAKE.fail_next[body["op"]] = body.get("error", "service_not_allowed")
            elif self.path == "/timeout":
                FAKE.timeout_next.add(body["op"])
            elif self.path == "/component":
                FAKE.installed = bool(body.get("installed", True))
            elif self.path == "/external":
                FAKE._add({"name": body.get("name", "Created in the card"), "repeat_type": "repeat", "timeslots": [
                    {"start": "09:00:00", "stop": None, "actions": [{"service": "light.turn_on", "entity_id": "light.office", "service_data": {"brightness": 60}}]}]})
            else:
                self._reply(404, {"error": "unknown"})
                return
        if self.path == "/world":
            with LOCK:
                w = FAKE.world[body["entity_id"]]
                new = {"entity_id": body["entity_id"], "state": w["state"], "attributes": w.get("attributes") or {}, "last_changed": "2026-09-30T10:10:00+00:00", "last_updated": "2026-09-30T10:10:00+00:00"}
            WORLD.emit("state_changed", {"entity_id": body["entity_id"], "old_state": None, "new_state": new})
        _push_changes()
        self._reply(200, {"ok": True})


def _serve_control() -> None:
    port = int(os.environ.get("SW_FAKE_HA_CONTROL_PORT", str(PORT + 1)))
    server = ThreadingHTTPServer(("127.0.0.1", port), _Control)
    print(f"schedules_fake_ha: fake Home Assistant control on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


def _pair() -> None:
    """The integration's config flow (a signed ping at bridge 0.3.0), then the feature on with the Shabbat sensor set."""
    from smplwise.services import ha_bridge

    for _ in range(120):
        try:
            with httpx.Client(timeout=5) as c:
                r = c.get(f"{BASE}/ha/bridge/pairing")
                if r.status_code == 200:
                    SECRET["code"] = r.json()["pairing_code"]
                    p = c.post(f"{BASE}/ha/bridge/ping", json=ha_bridge.sign(SECRET["code"], {"version": "0.3.0"}))
                    print(f"schedules_fake_ha: bridge paired ({p.status_code})", flush=True)
                    for _ in range(120):  # the sync must have mirrored the entities before a switch can be marked bulk-safe
                        if c.get(f"{BASE}/ha/entities/switch.hall_lights").status_code == 200:
                            break
                        time.sleep(0.5)
                    mark = c.put(f"{BASE}/devices/entities/switch.hall_lights/bulk-safe", json={"bulk_safe": True})
                    s = c.patch(f"{BASE}/settings", json={"schedules.enabled": "true", "schedules.shabbat_sensor": fake_scheduler.SHABBAT, "schedules.shabbat_sensor_force": True})
                    print(f"schedules_fake_ha: feature on ({s.status_code}), bulk-safe switch ({mark.status_code})", flush=True)
                    return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    print("schedules_fake_ha: the backend never came up; bridge not paired", flush=True)


def main() -> None:
    threading.Thread(target=_pair, name="schedules-fixture-pair", daemon=True).start()
    threading.Thread(target=_serve_control, name="schedules-fixture-control", daemon=True).start()
    print(f"schedules_fake_ha: fake scheduler with {len(FAKE.items)} schedules; backend on {BASE}", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
