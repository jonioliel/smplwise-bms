"""Fixture backend for the real-action-route parts of tests/evidence-devices.spec.ts (CR-007 slice 2 review, item 10):
the REAL SMPLWISE backend - the real POST /ha/entities/{id}/actions route with its permission gate, allow-list,
validation, bridge signing, audit and confirmation poll - whose only fake is Home Assistant's side of the bridge.
No real Home Assistant can be reached from this process: HA_URL is forced to a `.test` host (a reserved name that never
resolves), the HA WebSocket is an in-process fake (below), and every REST call to that host is answered here; it
refuses to start inside the add-on.

The fake HA WebSocket (CR-007 HA refresh): the backend's real HA sync connects to it, lists its registries and
subscribes to `state_changed` and the registry-updated events. Its registries are whatever the spec last seeded via
`POST /ha/dev/registry`; a small control server (127.0.0.1, SW_FAKE_HA_CONTROL_PORT, default SW_PORT + 1) moves an
entity to another area the way HA's UI does and sends HA's `entity_registry_updated` event (or, `silent`, does not -
the manual refresh case). No states are listed: the spec seeds them through `POST /ha/dev/states` as before.

What the fake bridge does with `POST /api/services/smplwise_bridge/execute` (the add-on's only write path to HA):
- refuses a (domain, service) that is not in the bridge integration's own ALLOWED_SERVICES (read from
  custom_components/smplwise_bridge/__init__.py, as the real bridge would: `service_not_allowed`), so drift between the
  add-on's allow-list and the bridge's shows up here too;
- otherwise answers `{ok: true}` and, 0.4 s later, applies the effect the real device would report (state and
  attributes: a light's brightness, a cover's position, a climate target / fan mode, a player's mute) through the
  backend's own developer states endpoint - the same upsert + /ha/ws push the sync performs - so the confirmation the
  UI shows is the real poll seeing a real state change;
- never applies anything to an entity whose id contains `_stuck` (a device that accepts and does nothing);
- CR-010 (the alarm): an alarm panel arms / disarms like the real integration reports it; a disarm without a `code`
  answers `code_required` and a wrong code `invalid_code` (bridge 0.2.6's answers) - the right code is
  SW_FAKE_PANEL_CODE (default 1234, a fixture value, never a real one). POST /seed-alarm on the control server seeds the
  Risco (2 partitions, 8 zones) and PAI shapes of smplwise_vms/backend/tests/fake_alarm.py through the developer
  endpoints, for tests/evidence-alarm.spec.ts.

Camera card (owner 2026-09-30, tests/evidence-camera-card.spec.ts): `GET /api/camera_proxy/camera.*` on the fake HA host
answers a generated JPEG (and counts the calls: `GET /camera-proxy` on the control server), and `POST /seed-cameras
{model, cameras: [{channel, alias, status}]}` on the control server registers NVR channels in the camera catalogue and
stores the recorder model the Hikvision integration names its entities after - what a discovery against a real NVR
would have stored. No stream exists here: the spec fakes the browser's media stack, as the wall's live specs do.

On start it pairs the bridge (signed ping with the pairing code, as the integration's config flow does).

Run it (a fresh data dir each time):

    SW_PORT=8348 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <venv-python> frontend/tests/fixtures/devices_fake_ha.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_DEVICES_FIXTURE=1 SW_API_PORT=8348 SW_BASE_URL=http://127.0.0.1:4188/ \
        npx playwright test tests/evidence-devices.spec.ts --workers=1
"""
from __future__ import annotations

import ast
import asyncio
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

if os.environ.get("SUPERVISOR_TOKEN"):
    sys.exit("devices_fake_ha: refusing to run inside the Home Assistant add-on")

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
FAKE_HOST = "fake-devices.test"
os.environ["HA_URL"] = f"http://{FAKE_HOST}:8123"
os.environ["HA_TOKEN"] = "fake-fixture-token"
PORT = int(os.environ.get("SW_PORT", "8099"))
BASE = f"http://127.0.0.1:{PORT}/api/v1"

import httpx  # noqa: E402
import websockets  # noqa: E402


def _bridge_allowed() -> set[tuple[str, str]]:
    tree = ast.parse((ROOT / "custom_components" / "smplwise_bridge" / "__init__.py").read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "ALLOWED_SERVICES" for t in node.targets):
            return set(ast.literal_eval(node.value))
    raise SystemExit("devices_fake_ha: ALLOWED_SERVICES not found in the bridge integration")


ALLOWED = _bridge_allowed()
_executed: list[dict[str, Any]] = []
PANEL_CODE = os.environ.get("SW_FAKE_PANEL_CODE", "1234")  # CR-010: the fake panel's code (a fixture value)


def _effect(domain: str, service: str, data: dict[str, Any], state: str | None, attrs: dict[str, Any]) -> tuple[str | None, dict[str, Any]]:
    """What the device would report after the call: (new state, new attributes)."""
    a = dict(attrs)
    if service == "turn_on" and domain in ("light", "switch", "input_boolean", "fan", "media_player", "siren"):
        if domain == "light" and "brightness_pct" in data:
            a["brightness"] = round(data["brightness_pct"] * 255 / 100)
        if domain == "light":
            a.setdefault("brightness", 255)
        if domain == "fan" and "percentage" in data:
            a["percentage"] = data["percentage"]
        return "on", a
    if service == "turn_off" and domain in ("light", "switch", "input_boolean", "fan", "media_player", "siren", "climate"):
        if domain == "light":
            a.pop("brightness", None)
        return "off", a
    if domain == "cover":
        if service == "open_cover":
            a["current_position"] = 100
            return "open", a
        if service == "close_cover":
            a["current_position"] = 0
            return "closed", a
        if service == "set_cover_position":
            a["current_position"] = data["position"]
            return ("open" if data["position"] > 0 else "closed"), a
        # CR-007 slice 4: tilt - never changes the cover's own state (position drives it, not tilt)
        if service == "open_cover_tilt":
            a["current_tilt_position"] = 100
            return state, a
        if service == "close_cover_tilt":
            a["current_tilt_position"] = 0
            return state, a
        if service == "set_cover_tilt_position":
            a["current_tilt_position"] = data["tilt_position"]
            return state, a
        return state, a  # stop / stop_cover_tilt: nothing observable changes
    if domain == "climate":
        if service == "set_hvac_mode":
            return data["hvac_mode"], a
        if service == "set_temperature":
            a["temperature"] = data["temperature"]
        if service == "set_fan_mode":
            a["fan_mode"] = data["fan_mode"]
        # CR-007 slice 4
        if service == "set_preset_mode":
            a["preset_mode"] = data["preset_mode"]
        if service == "set_swing_mode":
            a["swing_mode"] = data["swing_mode"]
        if service == "set_humidity":
            a["humidity"] = data["humidity"]
        return state, a
    if domain == "humidifier":  # CR-007 slice 4
        if service == "set_humidity":
            a["humidity"] = data["humidity"]
        if service == "set_mode":
            a["mode"] = data["mode"]
        return state, a
    if domain == "fan" and service == "set_percentage":
        a["percentage"] = data["percentage"]
        return ("on" if data["percentage"] > 0 else "off"), a
    if domain == "media_player":
        if service == "media_play":
            return "playing", a
        if service == "media_pause":
            return "paused", a
        if service == "volume_mute":
            a["is_volume_muted"] = data["is_volume_muted"]
        if service == "volume_set":
            a["volume_level"] = data["volume_level"]
        return state, a
    if domain == "lock":
        return ("locked" if service == "lock" else "unlocked"), a
    if domain == "alarm_control_panel":  # CR-010
        if service == "alarm_disarm":
            return "disarmed", a
        if service.startswith("alarm_arm_"):
            return "armed_" + service[len("alarm_arm_"):], a
    return state, a


def _apply(domain: str, service: str, data: dict[str, Any]) -> None:
    eid = data["entity_id"]
    try:
        with httpx.Client(timeout=10) as c:
            cur = c.get(f"{BASE}/ha/entities/{eid}").json()
            state, attrs = _effect(domain, service, data, cur.get("state"), cur.get("attributes") or {})
            attrs = {k: v for k, v in attrs.items() if v is not None}
            c.post(f"{BASE}/ha/dev/states", json={"states": [{"entity_id": eid, "state": state, "attributes": attrs}]})
    except Exception as exc:  # noqa: BLE001
        print(f"devices_fake_ha: could not apply {domain}.{service} to {eid}: {exc}", flush=True)


def _execute(request: httpx.Request) -> httpx.Response:
    body = json.loads(request.content or b"{}")
    domain, service, data = body.get("domain"), body.get("service"), body.get("data") or {}
    _executed.append({"domain": domain, "service": service, "data": {k: v for k, v in data.items() if k != "code"}})  # never keep a code
    if (domain, service) not in ALLOWED:
        return httpx.Response(200, json={"service_response": {"ok": False, "error": "service_not_allowed"}}, request=request)
    if domain == "alarm_control_panel":  # CR-010: the panel checks its code as the integration would
        code = data.get("code")
        if service == "alarm_disarm" and not code:
            return httpx.Response(200, json={"service_response": {"ok": False, "error": "code_required"}}, request=request)
        if code and code != PANEL_CODE:
            return httpx.Response(200, json={"service_response": {"ok": False, "error": "invalid_code"}}, request=request)
    if "_stuck" not in str(data.get("entity_id", "")):
        threading.Timer(0.4, _apply, args=(domain, service, data)).start()
    return httpx.Response(200, json={"service_response": {"ok": True, "context_id": "fake-context"}}, request=request)


def _set_entity_area(request: httpx.Request) -> httpx.Response:
    """CR-007 slice 4: the bridge's one registry write. The real add-on already checked the entity and the area
    exist (routers/devices.py assign_area) before it ever calls this, so the fake bridge only has to say yes - the
    add-on itself updates its own registry mirror from the answer."""
    body = json.loads(request.content or b"{}")
    _executed.append({"domain": "smplwise_bridge", "service": "set_entity_area", "data": {"entity_id": body.get("entity_id"), "area_id": body.get("area_id")}})
    return httpx.Response(200, json={"service_response": {"ok": True, "context_id": None, "request_id": body.get("request_id")}}, request=request)


_camera_proxy_calls: dict[str, int] = {}


def _camera_proxy(request: httpx.Request) -> httpx.Response:
    """HA's `GET /api/camera_proxy/<entity>`: a generated JPEG (a colour per entity, the entity id written on it)."""
    import io

    from PIL import Image, ImageDraw

    entity = request.url.path.rsplit("/", 1)[-1]
    _camera_proxy_calls[entity] = _camera_proxy_calls.get(entity, 0) + 1
    hue = sum(entity.encode()) % 200
    im = Image.new("RGB", (640, 360), (40 + hue // 2, 90 + hue // 3, 140))
    draw = ImageDraw.Draw(im)
    for y in range(0, 360, 40):
        draw.line([(0, y), (640, y + 40)], fill=(255, 255, 255), width=1)
    draw.text((20, 20), entity, fill=(255, 255, 255))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80)
    return httpx.Response(200, content=buf.getvalue(), headers={"Content-Type": "image/jpeg"}, request=request)


_real_handle = httpx.HTTPTransport.handle_request


def handle_request(self: httpx.HTTPTransport, request: httpx.Request) -> httpx.Response:
    if request.url.host == FAKE_HOST:
        if request.method == "POST" and request.url.path == "/api/services/smplwise_bridge/execute":
            return _execute(request)
        if request.method == "POST" and request.url.path == "/api/services/smplwise_bridge/set_entity_area":
            return _set_entity_area(request)
        if request.method == "GET" and request.url.path.startswith("/api/camera_proxy/camera."):
            return _camera_proxy(request)
        raise httpx.ConnectError(f"devices_fake_ha: no answer for {request.url.path}", request=request)
    return _real_handle(self, request)


httpx.HTTPTransport.handle_request = handle_request  # type: ignore[method-assign]


class _World:
    """Home Assistant's registries as far as the fake WebSocket tells them. They follow whatever the spec last seeded
    through the backend's own `POST /ha/dev/registry` ("HA's registry is now this" - see `_registry_maps`), so the real
    sync's refreshes never undo a seed; the control server then changes them the way a user does in HA's UI."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.entities: list[dict[str, Any]] = []
        self.devices: list[dict[str, Any]] = []
        self.areas: list[dict[str, Any]] = []
        self.floors: list[dict[str, Any]] = []
        self.sockets: list[_FakeSocket] = []

    def listing(self, kind: str) -> list[dict[str, Any]]:
        with self.lock:
            return json.loads(json.dumps(getattr(self, kind)))

    def emit(self, event_type: str, data: dict[str, Any]) -> int:
        with self.lock:
            sockets = list(self.sockets)
        n = 0
        for s in sockets:
            n += s.deliver(event_type, data)
        return n


WORLD = _World()


class _FakeSocket:
    """The HA WebSocket API as the sync uses it: auth, get_config, get_states, subscribe_events and the four registry
    listings. Registry-updated events are delivered to the subscriptions that asked for them."""

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
        listings = {"config/entity_registry/list": "entities", "config/device_registry/list": "devices", "config/area_registry/list": "areas", "config/floor_registry/list": "floors"}
        if kind == "get_config":
            result: Any = {"version": "fake-2026.9"}
        elif kind == "get_states":
            result = []  # the spec seeds states through /ha/dev/states
        elif kind == "subscribe_events":
            self.subs[mid] = msg.get("event_type") or "*"
            result = None
        elif kind in listings:
            result = WORLD.listing(listings[kind])
        else:
            self.inbox.put_nowait(json.dumps({"id": mid, "type": "result", "success": False, "error": {"code": "unknown_command"}}))
            return
        self.inbox.put_nowait(json.dumps({"id": mid, "type": "result", "success": True, "result": result}))

    def deliver(self, event_type: str, data: dict[str, Any]) -> int:
        n = 0
        for sid, et in self.subs.items():
            if et in (event_type, "*"):
                frame = json.dumps({"id": sid, "type": "event", "event": {"event_type": event_type, "data": data}})
                self.loop.call_soon_threadsafe(self.inbox.put_nowait, frame)
                n += 1
        return n

    async def recv(self) -> str:
        return await self.inbox.get()

    def __aiter__(self) -> "_FakeSocket":
        return self

    async def __anext__(self) -> str:
        return await self.inbox.get()


def _connect(url: str, **_kw: Any) -> Any:
    # only the HA sync gets the fake Home Assistant; the WisKey (intercom) feed, which rides the same HA socket in
    # production, keeps finding no Home Assistant here, as before
    if threading.current_thread().name == "ha-sync":
        return _FakeSocket()
    raise OSError(f"devices_fake_ha: no Home Assistant WebSocket here ({url})")


websockets.connect = _connect  # type: ignore[assignment]

from smplwise.services import ha_client  # noqa: E402

_real_registry_maps = ha_client.registry_maps


def _registry_maps(entities: list[dict[str, Any]], devices: list[dict[str, Any]], areas: list[dict[str, Any]], floors: list[dict[str, Any]]) -> dict[str, Any]:
    """Every registry the backend maps becomes the fake HA's registry: the dev seed sets it, and the sync's own refresh
    maps exactly what the fake just listed (so recording it again changes nothing)."""
    with WORLD.lock:
        WORLD.entities, WORLD.devices = json.loads(json.dumps(entities)), json.loads(json.dumps(devices))
        WORLD.areas, WORLD.floors = json.loads(json.dumps(areas)), json.loads(json.dumps(floors))
    return _real_registry_maps(entities, devices, areas, floors)


ha_client.registry_maps = _registry_maps  # type: ignore[assignment]


class _Control(BaseHTTPRequestHandler):
    """The spec's hand on Home Assistant's UI, on 127.0.0.1 only:
    POST /move {entity_id, area_id, silent?} - the entity is moved to another area in HA's entity registry; unless
    `silent`, HA's `entity_registry_updated` event goes out on every subscribed socket (silent = the event was missed,
    which only the manual refresh or the periodic one then catches). GET /status - sockets and subscriptions."""

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
        if self.path == "/camera-proxy":
            self._reply(200, {"calls": dict(_camera_proxy_calls)})
            return
        with WORLD.lock:
            self._reply(200, {"sockets": len(WORLD.sockets), "subscriptions": sorted({et for s in WORLD.sockets for et in s.subs.values()})})

    def do_POST(self) -> None:  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        if self.path == "/seed-alarm":
            self._reply(200, _seed_alarm())
            return
        if self.path == "/seed-cameras":
            self._reply(200, _seed_cameras(body))
            return
        if self.path != "/move" or not isinstance(body.get("entity_id"), str):
            self._reply(404, {"error": "unknown"})
            return
        eid, area = body["entity_id"], body.get("area_id")
        with WORLD.lock:
            entry = next((e for e in WORLD.entities if e.get("entity_id") == eid), None)
            if entry is None:
                entry = {"entity_id": eid}
                WORLD.entities.append(entry)
            old = entry.get("area_id")
            entry["area_id"] = area
        delivered = 0 if body.get("silent") else WORLD.emit("entity_registry_updated", {"action": "update", "entity_id": eid, "changes": {"area_id": old}})
        self._reply(200, {"ok": True, "delivered": delivered})


def _seed_cameras(body: dict[str, Any]) -> dict[str, Any]:
    """The camera card's NVR: the channels through the backend's own registration route, then what only a discovery
    stores - the recorder's model and each channel's status - straight into the throwaway database of this fixture."""
    import sqlite3

    ids: dict[str, str] = {}
    with httpx.Client(timeout=30) as c:
        for cam in body.get("cameras", []):
            r = c.post(f"{BASE}/cameras", json={"channel": int(cam["channel"]), "alias": str(cam["alias"])})
            ids[str(cam["channel"])] = r.json()["id"]
    db = sqlite3.connect(str(Path(os.environ["SW_DATA_DIR"]) / "smplwise.db"), timeout=30)
    try:
        db.execute("UPDATE recorders SET model = ? WHERE id = 'nvr-1'", (str(body.get("model") or ""),))
        for cam in body.get("cameras", []):
            db.execute("UPDATE cameras SET status = ?, enabled = ? WHERE id = ?", (cam.get("status", "online"), 0 if cam.get("enabled") is False else 1, ids[str(cam["channel"])]))
        db.commit()
    finally:
        db.close()
    return {"ok": True, "cameras": ids}


def _seed_alarm() -> dict[str, Any]:
    """CR-010: the alarm fixtures (tests/fake_alarm.py of the backend) through the backend's own developer endpoints."""
    sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests"))
    import fake_alarm  # noqa: PLC0415

    reg, devs, states = fake_alarm.everything()
    with httpx.Client(timeout=30) as c:
        r = c.post(f"{BASE}/ha/dev/registry", json={"entities": reg, "devices": devs, "areas": fake_alarm.AREAS, "floors": fake_alarm.FLOORS})
        for i in range(0, len(states), 40):
            chunk = [{"entity_id": s["entity_id"], "state": s["state"], "attributes": s["attributes"]} for s in states[i : i + 40]]
            c.post(f"{BASE}/ha/dev/states", json={"states": chunk})
    return {"ok": r.status_code == 200, "entities": len(reg), "states": len(states)}


def _serve_control() -> None:
    port = int(os.environ.get("SW_FAKE_HA_CONTROL_PORT", str(PORT + 1)))
    server = ThreadingHTTPServer(("127.0.0.1", port), _Control)
    print(f"devices_fake_ha: fake Home Assistant control on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()


def _pair() -> None:
    """The integration's config flow: read the pairing code, answer with a signed ping - once the server is up."""
    from smplwise.services import ha_bridge

    for _ in range(120):
        try:
            with httpx.Client(timeout=5) as c:
                r = c.get(f"{BASE}/ha/bridge/pairing")
                if r.status_code == 200:
                    code = r.json()["pairing_code"]
                    p = c.post(f"{BASE}/ha/bridge/ping", json=ha_bridge.sign(code, {"version": "0.2.5"}))
                    print(f"devices_fake_ha: bridge paired ({p.status_code})", flush=True)
                    return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    print("devices_fake_ha: the backend never came up; bridge not paired", flush=True)


def main() -> None:
    threading.Thread(target=_pair, name="devices-fixture-pair", daemon=True).start()
    threading.Thread(target=_serve_control, name="devices-fixture-control", daemon=True).start()
    print(f"devices_fake_ha: fake bridge for {len(ALLOWED)} allow-listed services; backend on {BASE}", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
