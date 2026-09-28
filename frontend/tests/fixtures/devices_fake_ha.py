"""Fixture backend for the real-action-route parts of tests/evidence-devices.spec.ts (CR-007 slice 2 review, item 10):
the REAL SMPLWISE backend - the real POST /ha/entities/{id}/actions route with its permission gate, allow-list,
validation, bridge signing, audit and confirmation poll - whose only fake is Home Assistant's side of the bridge.
No real Home Assistant can be reached from this process: HA_URL is forced to a `.test` host (a reserved name that never
resolves), the HA WebSocket refuses to connect (the sync just keeps retrying), and every REST call to that host is
answered here; it refuses to start inside the add-on.

What the fake bridge does with `POST /api/services/smplwise_bridge/execute` (the add-on's only write path to HA):
- refuses a (domain, service) that is not in the bridge integration's own ALLOWED_SERVICES (read from
  custom_components/smplwise_bridge/__init__.py, as the real bridge would: `service_not_allowed`), so drift between the
  add-on's allow-list and the bridge's shows up here too;
- otherwise answers `{ok: true}` and, 0.4 s later, applies the effect the real device would report (state and
  attributes: a light's brightness, a cover's position, a climate target / fan mode, a player's mute) through the
  backend's own developer states endpoint - the same upsert + /ha/ws push the sync performs - so the confirmation the
  UI shows is the real poll seeing a real state change;
- never applies anything to an entity whose id contains `_stuck` (a device that accepts and does nothing).

On start it pairs the bridge (signed ping with the pairing code, as the integration's config flow does).

Run it (a fresh data dir each time):

    SW_PORT=8348 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni \
        <repo>/.venv/Scripts/python.exe frontend/tests/fixtures/devices_fake_ha.py

then, from frontend/ (`npm run build` first):

    SW_LIVE=1 SW_DEVICES_FIXTURE=1 SW_API_PORT=8348 SW_BASE_URL=http://127.0.0.1:4188/ \
        npx playwright test tests/evidence-devices.spec.ts --workers=1
"""
from __future__ import annotations

import ast
import json
import os
import sys
import threading
import time
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
        return state, a  # stop: nothing observable changes
    if domain == "climate":
        if service == "set_hvac_mode":
            return data["hvac_mode"], a
        if service == "set_temperature":
            a["temperature"] = data["temperature"]
        if service == "set_fan_mode":
            a["fan_mode"] = data["fan_mode"]
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
    _executed.append({"domain": domain, "service": service, "data": data})
    if (domain, service) not in ALLOWED:
        return httpx.Response(200, json={"service_response": {"ok": False, "error": "service_not_allowed"}}, request=request)
    if "_stuck" not in str(data.get("entity_id", "")):
        threading.Timer(0.4, _apply, args=(domain, service, data)).start()
    return httpx.Response(200, json={"service_response": {"ok": True, "context_id": "fake-context"}}, request=request)


_real_handle = httpx.HTTPTransport.handle_request


def handle_request(self: httpx.HTTPTransport, request: httpx.Request) -> httpx.Response:
    if request.url.host == FAKE_HOST:
        if request.method == "POST" and request.url.path == "/api/services/smplwise_bridge/execute":
            return _execute(request)
        raise httpx.ConnectError(f"devices_fake_ha: no answer for {request.url.path}", request=request)
    return _real_handle(self, request)


httpx.HTTPTransport.handle_request = handle_request  # type: ignore[method-assign]


def _refuse_ws(url: str, **_kw: Any) -> Any:
    raise OSError(f"devices_fake_ha: no Home Assistant WebSocket here ({url})")


websockets.connect = _refuse_ws  # type: ignore[assignment]


def _pair() -> None:
    """The integration's config flow: read the pairing code, answer with a signed ping - once the server is up."""
    from smplwise.services import ha_bridge

    for _ in range(120):
        try:
            with httpx.Client(timeout=5) as c:
                r = c.get(f"{BASE}/ha/bridge/pairing")
                if r.status_code == 200:
                    code = r.json()["pairing_code"]
                    p = c.post(f"{BASE}/ha/bridge/ping", json=ha_bridge.sign(code, {"version": "0.2.4"}))
                    print(f"devices_fake_ha: bridge paired ({p.status_code})", flush=True)
                    return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    print("devices_fake_ha: the backend never came up; bridge not paired", flush=True)


def main() -> None:
    threading.Thread(target=_pair, name="devices-fixture-pair", daemon=True).start()
    print(f"devices_fake_ha: fake bridge for {len(ALLOWED)} allow-listed services; backend on {BASE}", flush=True)
    from smplwise.__main__ import main as serve

    serve()


if __name__ == "__main__":
    main()
