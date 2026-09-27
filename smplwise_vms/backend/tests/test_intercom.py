"""WisKey entry center (CR-005 phase 1a, T054): the `access.read` permission, the honest "not configured" /
"not installed" states, and a real `hikvision_intercom/overview` round trip through `ha_client.ws_session` against a
scripted Home Assistant WebSocket (auth handshake included). Reply shapes follow
docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md (types.ts `Overview` / `Station` / `LastAccess`, §0.3 errors,
§0.6 `subscribe`)."""
from __future__ import annotations

import asyncio
import copy
import json
import time
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS
from smplwise.services import intercom_sync

ROOT = Path(__file__).resolve().parents[3]

STATION = {
    "id": "entry-a",
    "sync_reference": "ref-a",
    "name": "Main gate",
    "lock_enabled": True,
    "loaded": True,
    "online": True,
    "call_state": "idle",
    "sync_state": "synced",
    "last_error": None,
    "scanned_at": None,
    "scanning": False,
    "scan_error": None,
    "observations": {"call_status": True},
    "integrated_locks": [{"physical_index": 1, "api_id": 1, "name": "Gate"}],
    "event_status": {"stream": "connected", "history": "idle", "reconnects": 0, "recovered_until": None},
    "reconciled_at": None,
    "managed_user_count": 12,
    "pending_user_count": 0,
    "last_seen": "2026-09-27T08:00:00+00:00",
    "last_poll_ms": 40,
    "last_access": {"timestamp": "2026-09-27T07:59:00+03:00", "time_source": "device", "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted", "event_type": "access_granted", "recovered": False, "door": 1},
    "user_count": 12,
    "card_count": 9,
    "unmanaged_count": 0,
    "model": "DS-KV6113",
    "firmware": "V2.2",
    "host": "192.0.2.10",
    "entities": {"camera": "camera.main_gate", "lock": "lock.main_gate", "online": "binary_sensor.main_gate_online", "ringing": "binary_sensor.main_gate_ringing", "call_status": "sensor.main_gate_call_status"},
    "capabilities": {"max_users": 500, "max_cards": 500, "cards_per_person": 5, "pin_writable": True, "pin_min": 4, "pin_max": 8, "name_max": 32, "schedules": True},
    "clock": {"source": "device", "zone": {"kind": "iana", "name": "Asia/Jerusalem"}, "device_zone": None, "device_time": None, "checked_at": None, "status": "ok", "error": None, "skew_seconds": 1, "time_mode": "ntp"},
}
OFFLINE = {**copy.deepcopy(STATION), "id": "entry-b", "name": "Side door", "online": False, "call_state": "unavailable", "sync_state": "offline", "lock_enabled": False, "integrated_locks": [], "pending_user_count": 2, "last_access": None, "clock": None, "entities": {"online": "binary_sensor.side_door_online"}}
OVERVIEW = {
    "access": {"allowed": True, "is_admin": True, "revision": 3, "areas": {"overview": "manage", "users": "manage", "events": "manage", "stations": "manage", "management": "manage"}},
    "user_count": 1,
    "api": {"version": 1, "min_client": 0, "capabilities": ["panel_permissions"], "commands": ["overview", "subscribe"]},
    "default_zone": {"kind": "iana", "name": "Asia/Jerusalem"},
    "version": "4.2.0",
    "users": [{"id": "u1", "employee_no": "1001", "display_name": "Dana", "active": True, "pin_configured": True, "phone": "+972500000000", "cards": [{"masked_number": "****1234", "label": "Main", "card_type": "normal", "enabled": True}], "assignments": {}, "revision": 1, "identity_locked": False, "valid_from": None, "valid_until": None}],
    "stations": [STATION, OFFLINE],
    "tombstones": [],
    "revocations": [],
    "card_removals": [],
    "pin_removals": [],
    "sync_operations": [],
}

CLOSE = object()


class FakeHa:
    """A scripted Home Assistant Core WebSocket: `auth_required` -> `auth` -> `auth_ok`, then `script(msg, fake)`
    answers every command with the frames to queue (results and subscription events)."""

    def __init__(self, script: Callable[[dict[str, Any], "FakeHa"], list[Any]]) -> None:
        self.script = script
        self.sent: list[dict[str, Any]] = []
        self.q: asyncio.Queue | None = None

    async def __aenter__(self) -> "FakeHa":
        self.q = asyncio.Queue()
        self.q.put_nowait({"type": "auth_required", "ha_version": "2026.9.0"})
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    async def recv(self) -> str:
        assert self.q
        return json.dumps(await self.q.get())

    async def send(self, raw: str) -> None:
        assert self.q
        msg = json.loads(raw)
        self.sent.append(msg)
        if msg.get("type") == "auth":
            self.q.put_nowait({"type": "auth_ok" if msg.get("access_token") == "t" else "auth_invalid"})
            return
        for frame in self.script(msg, self):
            self.q.put_nowait(frame)

    def __aiter__(self) -> "FakeHa":
        return self

    async def __anext__(self) -> str:
        assert self.q
        item = await self.q.get()
        if item is CLOSE:
            raise StopAsyncIteration
        return json.dumps(item)

    def types(self) -> list[str]:
        return [m.get("type", "") for m in self.sent]


def ok(msg: dict[str, Any], result: Any = None) -> dict[str, Any]:
    return {"id": msg["id"], "type": "result", "success": True, "result": result}


@pytest.fixture()
def feed(settings, monkeypatch):
    """App with Home Assistant configured; the feed thread is started by the test against a FakeHa."""
    import websockets

    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    intercom_sync.SYNC.reset()
    fakes: list[FakeHa] = []

    def install(script: Callable[[dict[str, Any], FakeHa], list[Any]]) -> list[FakeHa]:
        def connect(url: str, **_kw: Any) -> FakeHa:
            assert url == "ws://ha.local:8123/api/websocket"
            fake = FakeHa(script)
            fakes.append(fake)
            return fake

        monkeypatch.setattr(websockets, "connect", connect)
        return fakes

    app = create_app(s)
    yield app, s, install
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()


def wait_for(pred: Callable[[], bool], timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


# ---------------------------------------------------------------- permission

def test_access_read_permission_catalogue(settings):
    for role in ("viewer", "operator", "editor", "site_admin", "system_admin"):
        assert "access.read" in ROLES[role], role
    assert ROLES["kiosk"] == ["map.read", "video.live"], "the kiosk role stays live + map only (T057)"
    assert PERMISSION_LABELS["access.read"]
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"]: "access.read" in r["permissions"] for r in contract["roles"]} == {r["id"]: "access.read" in ROLES[r["id"]] for r in contract["roles"]}


def test_overview_requires_access_read(settings):
    intercom_sync.SYNC.reset()
    c = TestClient(create_app(settings))
    bind(c, settings, "wall", "kiosk", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    r = c.get("/api/v1/intercom/overview", headers=as_user("wall"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert c.get("/api/v1/intercom/overview", headers=as_user("nobody")).status_code == 403, "no binding at all"
    assert c.get("/api/v1/intercom/overview", headers=as_user("vera")).status_code == 200
    assert "access.read" in c.get("/api/v1/me", headers=as_user("vera")).json()["permissions_installation"]
    with pytest.raises(WebSocketDisconnect) as exc:
        with c.websocket_connect("/api/v1/intercom/ws", headers=as_user("wall")) as ws:
            ws.receive_text()
    assert exc.value.code == 4403


# ---------------------------------------------------------------- honest states

def test_not_configured_without_home_assistant(settings):
    """The dev / demo backend has no Home Assistant: a clear state, no station data, never a 5xx."""
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(settings)
    assert intercom_sync.SYNC.thread is None, "no socket thread without HA access"
    c = TestClient(create_app(settings))
    r = c.get("/api/v1/intercom/overview")
    assert r.status_code == 200
    body = r.json()
    assert body["state"] == "ha_not_configured" and body["configured"] is False
    assert body["overview"] is None and body["fresh"] is False and body["fetched_at"] is None
    assert body["last_error"] == "ha_not_configured"
    intercom_sync.SYNC.reset()


def test_not_installed_when_wiskey_is_absent(feed):
    """HA answers `unknown_command` for `hikvision_intercom/overview` when the integration is not loaded."""
    app, s, install = feed

    def script(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        return [{"id": msg["id"], "type": "result", "success": False, "error": {"code": "unknown_command", "message": "Unknown command."}}]

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "not_installed")
    assert fakes[0].types() == ["auth", "hikvision_intercom/overview"], "nothing else is attempted"
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["state"] == "not_installed" and body["configured"] is True
    assert body["overview"] is None and body["fresh"] is False and body["last_error"] == "unknown_command"


# ---------------------------------------------------------------- the real round trip

def test_overview_round_trip_and_live_refresh(feed):
    app, s, install = feed
    calls = {"overview": 0}
    ringing = copy.deepcopy(OVERVIEW)
    ringing["stations"][0]["call_state"] = "ringing"

    def script(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        kind = msg["type"]
        if kind == "hikvision_intercom/overview":
            assert set(msg) == {"id", "type"}, "overview takes no fields (the command schema forbids extra keys)"
            calls["overview"] += 1
            return [ok(msg, copy.deepcopy(OVERVIEW if calls["overview"] == 1 else ringing))]
        if kind == "subscribe_entities":
            return [ok(msg)]
        if kind == "hikvision_intercom/subscribe":
            # WisKey's push is data-free: the feed must refetch
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "refresh"}}]
        return [{"id": msg["id"], "type": "result", "success": False, "error": {"code": "unknown_command"}}]

    fakes = install(script)
    q = intercom_sync.subscribe()
    try:
        intercom_sync.SYNC.start(s)
        wait_for(lambda: intercom_sync.STATE.state == "ready" and calls["overview"] >= 2 and intercom_sync.STATE.sequence >= 2)
        fake = fakes[0]
        watch = next(m for m in fake.sent if m["type"] == "subscribe_entities")
        assert watch["entity_ids"] == ["binary_sensor.main_gate_online", "binary_sensor.main_gate_ringing", "binary_sensor.side_door_online", "sensor.main_gate_call_status"]
        assert "hikvision_intercom/subscribe" in fake.types()
        assert not any(t.startswith("hikvision_intercom/") and t not in ("hikvision_intercom/overview", "hikvision_intercom/subscribe") for t in fake.types()), "read-only: no other WisKey command"

        c = TestClient(app)
        body = c.get("/api/v1/intercom/overview").json()
        assert body["state"] == "ready" and body["fresh"] is True and body["configured"] is True and body["fetched_at"]
        ov = body["overview"]
        assert ov["version"] == "4.2.0" and ov["api_version"] == 1 and ov["user_count"] == 1
        assert ov["default_zone"] == {"kind": "iana", "name": "Asia/Jerusalem"}
        gate, side = ov["stations"]
        assert gate == {
            "id": "entry-a", "name": "Main gate", "online": True, "call_state": "ringing", "sync_state": "synced", "lock_enabled": True,
            "lock_count": 1, "has_camera": True, "last_error": None, "last_seen": "2026-09-27T08:00:00+00:00", "pending_user_count": 0,
            "managed_user_count": 12, "zone": {"kind": "iana", "name": "Asia/Jerusalem"},
            "last_access": {"timestamp": "2026-09-27T07:59:00+03:00", "time_source": "device", "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted", "event_type": "access_granted", "recovered": False, "door": 1},
        }
        assert side["online"] is False and side["call_state"] == "unavailable" and side["last_access"] is None and side["zone"] is None and side["has_camera"] is False and side["pending_user_count"] == 2
        text = json.dumps(body)
        for private in ("192.0.2.10", "+972500000000", "****1234", "DS-KV6113", "users", "entities", "host"):
            assert private not in text, f"{private} must not leave the feed"

        pushed = []
        while not q.empty():
            pushed.append(q.get_nowait())
        assert {"type": "intercom_state", "state": "ready"} in pushed
        assert [m["sequence"] for m in pushed if m["type"] == "intercom_refresh"] == [1, 2], "one notice per actual change"

        # the browser relay forwards the notices of the permitted user
        with c.websocket_connect("/api/v1/intercom/ws") as ws:
            intercom_sync.publish({"type": "intercom_refresh", "sequence": 99})
            env = json.loads(ws.receive_text())
        assert env["type"] == "intercom_refresh" and env["payload"]["sequence"] == 99 and env["version"] == 1
    finally:
        intercom_sync.unsubscribe(q)


def test_access_revoked_drops_the_copy(feed):
    app, s, install = feed

    def script(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [ok(msg, copy.deepcopy(OVERVIEW))]
        if msg["type"] == "hikvision_intercom/subscribe":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "access_revoked"}}]
        return [ok(msg)]

    install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "forbidden")
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["state"] == "forbidden" and body["overview"] is None and body["last_error"] == "unauthorized"
