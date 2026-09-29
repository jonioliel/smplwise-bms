"""WisKey entry center (CR-005 phase 1a, T054): the `access.read` permission, the honest "not configured" /
"not installed" states, and a real `hikvision_intercom/overview` round trip through `ha_client.ws_session` against a
scripted Home Assistant WebSocket (auth handshake included). Reply shapes follow
docs/integrations/wiskey/WISKEY_SOURCE_EXTRACTION.md (types.ts `Overview` / `Station` / `LastAccess`, §0.3 errors,
§0.6 `subscribe`)."""
from __future__ import annotations

import asyncio
import copy
import json
import threading
import time
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable

import pytest
from conftest import as_user, bind, sw_perf_enabled, sw_time_factor
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


def fail(msg: dict[str, Any], code: str) -> dict[str, Any]:
    return {"id": msg["id"], "type": "result", "success": False, "error": {"code": code, "message": code}}


def ha_config(msg: dict[str, Any], state: str = "RUNNING") -> dict[str, Any]:
    """HA's `get_config` reply; `state` is HA's CoreState (NOT_RUNNING, STARTING, RUNNING, STOPPING ...)."""
    return ok(msg, {"state": state, "version": "2026.9.0", "components": []})


def normal(msg: dict[str, Any], _fake: FakeHa, overview: dict[str, Any] | None = None) -> list[Any]:
    """A healthy HA with WisKey loaded."""
    kind = msg["type"]
    if kind == "hikvision_intercom/overview":
        return [ok(msg, copy.deepcopy(overview or OVERVIEW))]
    if kind == "get_config":
        return [ha_config(msg)]
    return [ok(msg)]


def pushed_states(q: Any) -> list[str]:
    out = []
    while not q.empty():
        m = q.get_nowait()
        if m["type"] == "intercom_state":
            out.append(m["state"])
    return out


@pytest.fixture()
def feed(settings, monkeypatch):
    """App with Home Assistant configured; the feed thread is started by the test against a FakeHa."""
    import websockets

    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    intercom_sync.SYNC.reset()
    # the normal reconnect backoff, shortened so a test sees several attempts; RETRY_ABSENT_S stays five minutes
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    fakes: list[FakeHa] = []
    refused = {"n": 0}

    def install(script: Callable[[dict[str, Any], FakeHa], list[Any]], refuse_after: int | None = None) -> list[FakeHa]:
        """`refuse_after=N`: after N accepted connections every further connect fails (HA down)."""
        def connect(url: str, **_kw: Any) -> FakeHa:
            assert url == "ws://ha.local:8123/api/websocket"
            if refuse_after is not None and len(fakes) >= refuse_after:
                refused["n"] += 1
                raise OSError("connection refused")
            fake = FakeHa(script)
            fakes.append(fake)
            return fake

        monkeypatch.setattr(websockets, "connect", connect)
        return fakes

    app = create_app(s)
    install.refused = refused  # type: ignore[attr-defined]
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
    me = c.get("/api/v1/me", headers=as_user("vera")).json()
    assert "access.read" in me["permissions_installation"]
    # the viewer is accepted on the notice socket and gets the relayed notices (S5d)
    with c.websocket_connect("/api/v1/intercom/ws", headers=as_user("vera")) as ws:
        intercom_sync.publish({"type": "intercom_refresh", "sequence": 7})
        env = json.loads(ws.receive_text())
    assert env["type"] == "intercom_refresh" and env["payload"]["sequence"] == 7 and env["subscription_id"] == me["user"]["id"]
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
    """HA answers `unknown_command` for `hikvision_intercom/overview` when the integration is not loaded; with HA itself
    RUNNING (its `get_config` state) that means not installed."""
    app, s, install = feed

    def script(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        return [ha_config(msg)] if msg["type"] == "get_config" else [fail(msg, "unknown_command")]

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "not_installed")
    assert fakes[0].types() == ["auth", "hikvision_intercom/overview", "get_config"], "nothing else is attempted"
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["state"] == "not_installed" and body["configured"] is True
    assert body["overview"] is None and body["fresh"] is False and body["last_error"] == "unknown_command"
    time.sleep(0.4)
    assert len(fakes) == 1, "an absent integration is re-probed after RETRY_ABSENT_S, not on the short backoff"


def test_ha_restart_is_not_read_as_not_installed(feed):
    """B1: HA answers WebSocket commands while integrations are still loading, and WisKey registers its commands only
    after its access and event managers are up. A reconnect that lands in that window gets `unknown_command`: the feed
    must stay `connecting` on the short backoff and keep serving the last-known copy as not fresh - not report "not
    installed", drop the copy and wait five minutes."""
    app, s, install = feed
    loaded = {"yes": False}
    fakes: list[FakeHa] = []

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        first = fake is fakes[0]
        if msg["type"] == "hikvision_intercom/overview" and not first and not loaded["yes"]:
            return [fail(msg, "unknown_command")]
        if msg["type"] == "get_config":
            return [ha_config(msg, "STARTING")]
        frames = normal(msg, fake)
        if first and msg["type"] == "hikvision_intercom/subscribe":
            frames.append(CLOSE)  # HA restarts right after the feed was ready
        return frames

    q = intercom_sync.subscribe()
    try:
        fakes = install(script)
        intercom_sync.SYNC.start(s)
        wait_for(lambda: len(fakes) >= 4 and intercom_sync.STATE.state == "connecting", timeout=5)
        assert "get_config" in fakes[1].types(), "HA's own state is asked before concluding anything"
        body = TestClient(app).get("/api/v1/intercom/overview").json()
        assert body["state"] == "connecting" and body["last_error"] == "wiskey_loading"
        assert body["fresh"] is False and body["fetched_at"], "the last-known copy stays, marked not fresh"
        assert [st["id"] for st in body["overview"]["stations"]] == ["entry-a", "entry-b"]

        loaded["yes"] = True  # WisKey finished loading
        wait_for(lambda: intercom_sync.STATE.state == "ready", timeout=5)
        body = TestClient(app).get("/api/v1/intercom/overview").json()
        assert body["state"] == "ready" and body["fresh"] is True
        states = pushed_states(q)
        assert "not_installed" not in states and "connecting" in states and states[-1] == "ready", states
    finally:
        intercom_sync.unsubscribe(q)


def test_wiskey_gone_after_ready_is_concluded_after_a_few_quick_probes(feed):
    """HA's bootstrap can reach RUNNING past a slow integration: after a ready session, `unknown_command` with HA
    RUNNING is re-probed on the short backoff (copy kept) and only the ABSENT_AFTER_READY-th probe concludes it."""
    app, s, install = feed
    fakes: list[FakeHa] = []

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        first = fake is fakes[0]
        if msg["type"] == "hikvision_intercom/overview" and not first:
            return [fail(msg, "unknown_command")]
        frames = normal(msg, fake)
        if first and msg["type"] == "hikvision_intercom/subscribe":
            frames.append(CLOSE)
        return frames

    q = intercom_sync.subscribe()
    try:
        fakes = install(script)
        intercom_sync.SYNC.start(s)
        wait_for(lambda: intercom_sync.STATE.state == "not_installed", timeout=5)
        assert len(fakes) == 1 + intercom_sync.ABSENT_AFTER_READY
        states = pushed_states(q)
        assert states.index("connecting") < states.index("not_installed"), states
        body = TestClient(app).get("/api/v1/intercom/overview").json()
        assert body["overview"] is None and body["last_error"] == "unknown_command", "now it is gone: the copy is dropped"
        time.sleep(0.4)
        assert len(fakes) == 1 + intercom_sync.ABSENT_AFTER_READY, "and from here on the five-minute re-probe"
    finally:
        intercom_sync.unsubscribe(q)


def test_disconnect_serves_the_copy_as_not_fresh(feed):
    """S5a: HA goes away after a ready session: `ha_unavailable`, the last-known copy is still served with
    `fresh: false` (the stale banner), and reconnects keep being tried."""
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        frames = normal(msg, fake)
        return frames + [CLOSE] if msg["type"] == "hikvision_intercom/subscribe" else frames

    install(script, refuse_after=1)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: install.refused["n"] >= 2 and intercom_sync.STATE.state == "ha_unavailable")
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["state"] == "ha_unavailable" and body["configured"] is True and body["last_error"] == "OSError"
    assert body["fresh"] is False and body["fetched_at"] and body["sync"]["connected"] is False
    assert [st["name"] for st in body["overview"]["stations"]] == ["Main gate", "Side door"]
    assert intercom_sync.STATE.reconnects == 1


def test_error_state(feed):
    """S5b: WisKey answers with an error other than "not installed" / "refused": state `error` with the code, retried
    on the short backoff, and without a copy nothing is shown."""
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [fail(msg, "home_assistant_error")]
        return normal(msg, fake)

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "error" and len(fakes) >= 3)
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["state"] == "error" and body["last_error"] == "home_assistant_error"
    assert body["overview"] is None and body["fresh"] is False and body["fetched_at"] is None
    assert not any("get_config" in f.types() for f in fakes), "only unknown_command asks HA's own state"


def test_error_after_ready_keeps_the_copy(feed):
    """S5b: after a ready session, an `error` reply keeps the last-known copy, served as not fresh."""
    app, s, install = feed
    fakes: list[FakeHa] = []

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        first = fake is fakes[0]
        if msg["type"] == "hikvision_intercom/overview" and not first:
            return [fail(msg, "home_assistant_error")]
        frames = normal(msg, fake)
        return frames + [CLOSE] if first and msg["type"] == "hikvision_intercom/subscribe" else frames

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "error" and len(fakes) >= 3)
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["state"] == "error" and body["fresh"] is False and len(body["overview"]["stations"]) == 2


def test_subscribe_race_replays_held_events(feed):
    """S5c: the real frame order. `subscribe_entities` answers with its result and the initial entity snapshot right
    behind it, so the socket reader sees the event before the awaiting code knows the subscription id: it is held and
    replayed (one refetch). WisKey's own `subscribe` coalesces with a 0.25 s timer, so its first `refresh` push comes
    a quarter second after the confirmation and is a separate refetch."""
    app, s, install = feed
    calls: list[float] = []
    delivered: dict[str, float] = {}
    ringing = copy.deepcopy(OVERVIEW)
    ringing["stations"][0]["call_state"] = "ringing"

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        kind = msg["type"]
        if kind == "hikvision_intercom/overview":
            calls.append(time.monotonic())
            return [ok(msg, copy.deepcopy(OVERVIEW if len(calls) == 1 else ringing))]
        if kind == "subscribe_entities":
            states = {e: {"s": "ringing" if e.startswith("sensor.") else "on", "a": {}, "c": "01J0", "lc": 1790000000.0} for e in msg["entity_ids"]}
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"a": states}}]
        if kind == "hikvision_intercom/subscribe":
            def push() -> None:
                delivered["t"] = time.monotonic()
                assert fake.q
                fake.q.put_nowait({"id": msg["id"], "type": "event", "event": {"kind": "refresh"}})

            asyncio.get_running_loop().call_later(0.25, push)
            return [ok(msg)]
        return normal(msg, fake)

    install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready" and len(calls) >= 3 and "t" in delivered)
    assert calls[1] < delivered["t"], "the held entity snapshot was replayed and refetched before WisKey's first push"
    assert calls[2] >= delivered["t"], "WisKey's delayed refresh is its own refetch"
    assert not intercom_sync.SYNC._early, "every held frame was replayed"
    assert intercom_sync.STATE.sequence == 2, "one notice per actual change (idle -> ringing)"
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["overview"]["stations"][0]["call_state"] == "ringing"


def test_poll_only_while_someone_is_watching(feed, monkeypatch):
    """S2: every `overview` reply carries WisKey's whole user directory, so the 30 s poll runs only while a browser
    holds the notice socket or recently asked for the overview; a GET after an idle stretch refetches at once."""
    app, s, install = feed
    calls = {"n": 0}

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            calls["n"] += 1
        return normal(msg, fake)

    monkeypatch.setattr(intercom_sync, "POLL_S", 0.1)
    monkeypatch.setattr(intercom_sync, "VIEW_WINDOW_S", 0.3)
    install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    time.sleep(0.5)
    assert calls["n"] == 1, "nobody watching: no polling"

    q = intercom_sync.subscribe()
    try:
        wait_for(lambda: calls["n"] >= 3)
    finally:
        intercom_sync.unsubscribe(q)

    monkeypatch.setattr(intercom_sync, "POLL_S", 30.0)
    time.sleep(0.4)  # the poller finishes its short sleep and settles into a long one
    before = calls["n"]
    intercom_sync.SYNC._fetched_mono = time.monotonic() - 100  # the copy is older than one poll
    c = TestClient(app)
    c.get("/api/v1/intercom/overview")
    wait_for(lambda: calls["n"] == before + 1)
    c.get("/api/v1/intercom/overview")
    time.sleep(0.3)
    assert calls["n"] == before + 1, "only the first GET after an idle stretch refetches"


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
            "lock_count": 1, "locks": [{"physical_index": 1, "name": "Gate"}],  # WisKey's api_id stays behind
            "has_camera": True, "camera_entity": "camera.main_gate", "last_error": None, "last_seen": "2026-09-27T08:00:00+00:00",
            "pending_user_count": 0, "managed_user_count": 12, "zone": {"kind": "iana", "name": "Asia/Jerusalem"},
            "last_access": {"timestamp": "2026-09-27T07:59:00+03:00", "time_source": "device", "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted", "event_type": "access_granted", "recovered": False, "door": 1},
        }
        assert side["online"] is False and side["call_state"] == "unavailable" and side["last_access"] is None and side["zone"] is None and side["has_camera"] is False and side["camera_entity"] is None and side["pending_user_count"] == 2
        text = json.dumps(body)
        for private in ("192.0.2.10", "+972500000000", "****1234", "DS-KV6113", "users", "entities", "host", "lock.main_gate", "binary_sensor.", "sensor.main_gate"):
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


def test_loading_retries_on_the_short_interval(feed, monkeypatch):
    """Re-review nit a: while HA answers but WisKey is still loading, the feed re-probes every RETRY_S - it does not
    keep doubling the backoff (after an HA restart that had already climbed towards RETRY_MAX_S)."""
    app, s, install = feed
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 5.0)

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [fail(msg, "unknown_command")]
        if msg["type"] == "get_config":
            return [ha_config(msg, "STARTING")]
        return normal(msg, fake)

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    # doubling from 0.05 s would need about 3.5 s for 8 probes; a fixed 0.05 s interval needs well under one
    wait_for(lambda: len(fakes) >= 8, timeout=1.5)
    assert intercom_sync.STATE.state == "connecting" and intercom_sync.STATE.last_error == "wiskey_loading"


def test_a_get_during_setup_does_not_start_a_second_refresh(feed):
    """Re-review nit b: a GET that arrives while the session is still inside its own probe / subscribe must not kick a
    refresh (it would race on_ready's overview and subscribe_entities); once ready, an idle GET does."""

    class Loop:
        def __init__(self) -> None:
            self.calls = 0

        def call_soon_threadsafe(self, _fn: Any) -> None:
            self.calls += 1

    app, s, _install = feed
    loop = Loop()
    sync = intercom_sync.SYNC
    sync._event_loop = loop  # type: ignore[assignment]
    sync._call = object()  # type: ignore[assignment]  # a connection object exists, mid-setup
    intercom_sync.STATE.state = "connecting"
    c = TestClient(app)
    c.get("/api/v1/intercom/overview")
    assert loop.calls == 0, "not before the session is ready"
    sync._last_view = None  # idle again
    intercom_sync.STATE.state = "ready"
    c.get("/api/v1/intercom/overview")
    assert loop.calls == 1, "a ready session refetches for an idle GET"
    sync._call = None
    sync._event_loop = None


def test_a_socket_failure_during_the_ha_state_probe_is_ha_unavailable(feed):
    """Re-review nit c: losing the connection while asking HA's own state is `ha_unavailable`, not "still loading"."""
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [fail(msg, "unknown_command")]
        if msg["type"] == "get_config":
            raise ConnectionError("socket closed")
        return normal(msg, fake)

    install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ha_unavailable")
    body = TestClient(app).get("/api/v1/intercom/overview").json()
    assert body["state"] == "ha_unavailable" and body["last_error"] == "ConnectionError"


# ---------------------------------------------------------------- phase 1b: activity log and people directory

# one `events/list` row as event_manager.py builds it (WISKEY_SOURCE_EXTRACTION.md, Module events: row + evidence + portrait)
EVENT_ROW = {
    "id": "ev-2", "station_id": "entry-a", "timestamp": "2026-09-27T07:59:00+03:00", "received_at": "2026-09-27T04:59:01+00:00",
    "time_source": "device", "person_name": "Dana", "employee_no": "1001", "door": 1, "api_door": 1, "authentication": "card",
    "result": "granted", "event_type": "access_granted", "card": "•••• 1234", "recovered": False, "major": 5, "minor": 1, "source": "stream",
    "evidence": {"identity_state": "identified", "origin": "live", "arrival_delay_seconds": 1, "time_source": "device", "source": "stream", "live_automation": True},
    "portrait": {"user_id": "u1", "revision": 1},
}
EVENTS_PAGE = {
    "records": [EVENT_ROW, {**EVENT_ROW, "id": "ev-1", "person_name": None, "employee_no": None, "result": "denied", "event_type": "access_denied", "card": "••••", "portrait": None}],
    "next": "ev-1", "retention_days": 30, "capacity": 5000, "membership_basis": None, "storage_failed": False,
    "stations": {"entry-a": {"stream": "connected", "history": "recovered", "reconnects": 0, "last_frame_at": "2026-09-27T05:00:00+00:00", "telemetry": {"seen": 3}, "recovered_until": None}},
}
# WisKey's full public Person (ManagedUser.public() + timing_readbacks), PII included
PERSON = {
    "id": "u1", "employee_no": "1001", "display_name": "Dana", "phone": "+972500000000", "active": True, "user_type": "normal",
    "valid_from": None, "valid_until": "2027-01-01T00:00:00+00:00", "revision": 4, "created_at": "2026-01-01T00:00:00+00:00", "updated_at": "2026-09-01T00:00:00+00:00",
    "identity_locked": False, "profile": {"department": "Engineering", "id_number": "123456789"}, "group_ids": ["staff"],
    "permission_overrides": {"events": "deny"}, "photo_configured": True, "pin_configured": True,
    "cards": [{"id": "c1", "masked_number": "•••• 1234", "label": "Main", "card_type": "normalCard", "enabled": True}],
    "assignments": {
        "entry-b": {"config_entry_id": "entry-b", "enabled": False, "allowed_locks": [1], "schedule_template": None, "desired_revision": 2, "applied_revision": 1, "sync_state": "error", "last_sync_at": None, "last_error": "device_unavailable"},
        "entry-a": {"config_entry_id": "entry-a", "enabled": True, "allowed_locks": [2, 1], "schedule_template": None, "desired_revision": 4, "applied_revision": 4, "sync_state": "synced", "last_sync_at": "2026-09-01T00:00:00+00:00", "last_error": None},
    },
    "access_timing_draft": None, "access_timing_policy": {"mode": "ha", "schedule": {"mode": "weekly", "timezone": "Asia/Jerusalem", "days": ["sun"], "dates": [], "periods": []}, "bindings": {}},
    "timing_readbacks": {"entry-a": {"mode": "ha", "valid_from": None, "valid_until": None, "revision": 4, "checked_at": "2026-09-01T00:00:00+00:00"}},
}
PEOPLE_PAGE = {"records": [PERSON], "total": 1, "total_all": 12, "offset": 0, "limit": 50, "next_offset": None, "previous_offset": None, "snapshot": "abc123", "stale": False}
PROJECTED_PERSON = {
    "id": "u1", "employee_no": "1001", "display_name": "Dana", "active": True, "valid_from": None, "valid_until": "2027-01-01T00:00:00+00:00",
    "revision": 4, "group_ids": ["staff"],
    "stations": [
        {"station_id": "entry-a", "enabled": True, "doors": [1, 2], "sync_state": "synced"},
        {"station_id": "entry-b", "enabled": False, "doors": [1], "sync_state": "error"},
    ],
}
# must never reach the browser from the people / activity endpoints
PRIVATE = ("+972500000000", "1234", "Engineering", "123456789", "phone", "cards", "pin_configured", "profile", "photo", "permission_overrides", "timing", "device_unavailable", "portrait", "evidence", "card")


def ready_feed(feed, answer: Callable[[dict[str, Any]], list[Any] | None], refuse_after: int | None = None) -> tuple[Any, list[FakeHa]]:
    """Start the feed against a healthy HA whose one-off WisKey commands are answered by `answer` (None: the default)."""
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        frames = answer(msg)
        return frames if frames is not None else normal(msg, fake)

    fakes = install(script, refuse_after=refuse_after)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    return app, fakes


def sent(fakes: list[FakeHa], kind: str) -> list[dict[str, Any]]:
    return [m for f in fakes for m in f.sent if m.get("type") == f"hikvision_intercom/{kind}"]


def test_activity_and_people_require_access_read(settings):
    """Same gate as the overview (`access.read` at installation scope), checked before the query is validated."""
    intercom_sync.SYNC.reset()
    c = TestClient(create_app(settings))
    bind(c, settings, "wall", "kiosk", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    for path in ("/api/v1/intercom/events", "/api/v1/intercom/people", "/api/v1/intercom/people/u1"):
        r = c.get(path, headers=as_user("wall"))
        assert r.status_code == 403 and r.json()["code"] == "forbidden", path
        assert c.get(path, headers=as_user("nobody")).status_code == 403, f"{path}: no binding at all"
        assert c.get(path, headers=as_user("vera")).status_code == 200, path
    r = c.get("/api/v1/intercom/events?limit=999&door=7", headers=as_user("wall"))
    assert r.status_code == 403, "no permission: refused before the parameters are even looked at"
    assert c.get("/api/v1/intercom/events?limit=999", headers=as_user("vera")).status_code == 422


def test_activity_and_people_without_home_assistant(settings):
    """The dev / demo backend has no Home Assistant: the new endpoints report the same honest state, never a 5xx."""
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(settings)
    c = TestClient(create_app(settings))
    for path, key in (("/api/v1/intercom/events", "events"), ("/api/v1/intercom/people?query=dana", "people"), ("/api/v1/intercom/people/u1", "person")):
        r = c.get(path)
        assert r.status_code == 200, path
        body = r.json()
        assert body["state"] == "ha_not_configured" and body["configured"] is False and body["last_error"] == "ha_not_configured", path
        assert body[key] is None and body["fetched_at"] is None, path
    intercom_sync.SYNC.reset()


def test_events_list_round_trip_over_the_feed_session(feed):
    app, fakes = ready_feed(feed, lambda msg: [ok(msg, copy.deepcopy(EVENTS_PAGE))] if msg["type"] == "hikvision_intercom/events/list" else None)
    c = TestClient(app)
    body = c.get("/api/v1/intercom/events", params={
        "station_id": "entry-a", "person": "dana", "result": "granted", "authentication": "card", "door": 1,
        "start": "2026-09-26T00:00:00Z", "end": "2026-09-27T00:00:00+03:00", "limit": 20, "before": "ev-9",
        "current_group": "staff", "current_profile": ["id_number=123456789"],
    }).json()
    assert len(fakes) == 1, "the one-off read rode the feed's own connection; no second HA socket"
    [msg] = sent(fakes, "events/list")
    assert set(msg) == {"id", "type", "filters"}
    assert msg["filters"] == {
        "station_id": "entry-a", "person": "dana", "result": "granted", "authentication": "card", "door": 1,
        "start": "2026-09-26T00:00:00Z", "end": "2026-09-27T00:00:00+03:00", "limit": 20, "before": "ev-9",
        "current_group": "staff",
    }, "S1: current_profile is never forwarded - it would let a reader probe profile values (an ID number) via matches"
    assert body["state"] == "ready" and body["configured"] is True and body["last_error"] is None and body["fetched_at"]
    page = body["events"]
    assert page["next"] == "ev-1" and page["retention_days"] == 30 and page["capacity"] == 5000
    assert page["storage_failed"] is False and page["membership_basis"] is None
    assert page["stations"] == {"entry-a": {"stream": "connected", "history": "recovered"}}
    assert page["records"][0] == {
        "id": "ev-2", "station_id": "entry-a", "timestamp": "2026-09-27T07:59:00+03:00", "received_at": "2026-09-27T04:59:01+00:00",
        "time_source": "device", "person_name": "Dana", "employee_no": "1001", "authentication": "card", "result": "granted",
        "event_type": "access_granted", "recovered": False, "door": 1,
    }
    assert page["records"][1]["person_name"] is None and page["records"][1]["result"] == "denied"
    text = json.dumps(page)
    for private in ("1234", "portrait", "evidence", '"card":', "major", "api_door", "telemetry"):
        assert private not in text, f"{private} must not leave the feed"

    # defaults: only WisKey's page size; and bad parameters never reach WisKey
    c.get("/api/v1/intercom/events")
    assert sent(fakes, "events/list")[-1]["filters"] == {"limit": 100}
    for bad in ({"limit": 201}, {"door": 3}, {"result": "maybe"}, {"start": "2026-09-26T00:00:00"}, {"start": "2026-09-27T00:00:00Z", "end": "2026-09-26T00:00:00Z"}):
        assert c.get("/api/v1/intercom/events", params=bad).status_code == 422, bad
    assert len(sent(fakes, "events/list")) == 2
    assert intercom_sync.STATE.state == "ready"


def test_people_directory_strips_personal_data(feed):
    """`users/query` records are WisKey's full Person (phone, cards, PIN flag, profile values ...): only the projection a
    read-only list needs is served."""
    app, fakes = ready_feed(feed, lambda msg: [ok(msg, copy.deepcopy(PEOPLE_PAGE))] if msg["type"] == "hikvision_intercom/users/query" else None)
    c = TestClient(app)
    body = c.get("/api/v1/intercom/people", params={"query": "dana", "state": "active", "sort": "name", "offset": 0, "limit": 50}).json()
    assert len(fakes) == 1
    [msg] = sent(fakes, "users/query")
    # D1: the search text never reaches WisKey; SMPLWISE scans the filtered directory and matches it itself
    assert msg == {"id": msg["id"], "type": "hikvision_intercom/users/query", "query": "", "filters": {"state": "active", "sort": "name"}, "offset": 0, "limit": 200, "snapshot": ""}
    assert body["state"] == "ready" and body["fetched_at"]
    page = body["people"]
    assert page == {
        "records": [PROJECTED_PERSON], "total": 1, "total_all": 12, "offset": 0, "limit": 50, "next_offset": None, "previous_offset": None,
        "snapshot": "abc123", "stale": False, "complete": True, "incomplete_reason": None,
    }
    text = json.dumps(body)
    for private in PRIVATE:
        assert private not in text, f"{private} must not leave the feed"

    # the snapshot goes back to WisKey for the next page; the defaults are WisKey's own (employee sort, no filters)
    c.get("/api/v1/intercom/people", params={"offset": 50, "snapshot": "abc123", "station": "entry-a", "rights": "assigned"})
    last = sent(fakes, "users/query")[-1]
    assert (last["query"], last["offset"], last["limit"], last["snapshot"]) == ("", 50, 50, "abc123")
    assert last["filters"] == {"station": "entry-a", "rights": "assigned", "sort": "employee"}
    for bad in ({"limit": 201}, {"offset": -1}, {"credential": "pin", "state": "gone"}, {"query": "x" * 161}):
        assert c.get("/api/v1/intercom/people", params=bad).status_code == 422, bad
    c.get("/api/v1/intercom/people", params={"credential": "pin"})
    assert "credential" not in sent(fakes, "users/query")[-1]["filters"], "the PIN / card filter is not offered"


def test_person_detail_and_unknown_person(feed):
    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == "hikvision_intercom/users/get":
            return [ok(msg, copy.deepcopy(PERSON))] if msg["user_id"] == "u1" else [fail(msg, "user_not_found")]
        return None

    app, fakes = ready_feed(feed, answer)
    c = TestClient(app)
    body = c.get("/api/v1/intercom/people/u1").json()
    assert body["state"] == "ready" and body["person"] == PROJECTED_PERSON
    for private in PRIVATE:
        assert private not in json.dumps(body), f"{private} must not leave the feed"
    assert sent(fakes, "users/get")[0] == {"id": sent(fakes, "users/get")[0]["id"], "type": "hikvision_intercom/users/get", "user_id": "u1"}
    r = c.get("/api/v1/intercom/people/u404")
    assert r.status_code == 404 and r.json()["code"] == "intercom_person_not_found"
    assert intercom_sync.STATE.state == "ready" and len(fakes) == 1, "a request-level refusal leaves the feed alone"


def test_one_off_refusals_do_not_change_the_feed_state(feed):
    """WisKey may refuse the add-on's user a single area (e.g. no `events:view` while `overview` works), an older WisKey
    has no `users/query`, and its limiter can answer `rate_limited`: each is reported for that request only."""
    answers = {"events/list": "unauthorized", "users/query": "unknown_command", "users/get": "rate_limited"}

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        command = msg["type"].removeprefix("hikvision_intercom/")
        return [fail(msg, answers[command])] if command in answers else None

    app, fakes = ready_feed(feed, answer)
    c = TestClient(app)
    for path, key, state, code in (
        ("/api/v1/intercom/events", "events", "forbidden", "unauthorized"),
        ("/api/v1/intercom/people", "people", "unsupported", "unknown_command"),
        ("/api/v1/intercom/people/u1", "person", "error", "rate_limited"),
    ):
        body = c.get(path).json()
        assert (body["state"], body["last_error"], body[key]) == (state, code, None), path
        assert body["sync"]["state"] == "ready", "the feed itself is still fine"
    assert intercom_sync.STATE.state == "ready" and len(fakes) == 1
    assert c.get("/api/v1/intercom/overview").json()["state"] == "ready"


def test_degraded_feed_states_apply_to_the_new_endpoints(feed):
    """The new endpoints reuse the feed's state machine: WisKey absent means `not_installed` and nothing is sent."""
    app, s, install = feed

    def script(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        return [ha_config(msg)] if msg["type"] == "get_config" else [fail(msg, "unknown_command")]

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "not_installed")
    c = TestClient(app)
    for path, key in (("/api/v1/intercom/events", "events"), ("/api/v1/intercom/people", "people"), ("/api/v1/intercom/people/u1", "person")):
        body = c.get(path).json()
        assert body["state"] == "not_installed" and body["configured"] is True and body["last_error"] == "unknown_command", path
        assert body[key] is None and body["fetched_at"] is None, path
    assert fakes[0].types() == ["auth", "hikvision_intercom/overview", "get_config"], "no one-off command is attempted"
    assert len(fakes) == 1, "and no connection is opened for it"


def test_ha_unavailable_applies_to_the_new_endpoints(feed):
    """After a disconnect the new endpoints report `ha_unavailable` from the feed and open no connection of their own."""
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        frames = normal(msg, fake)
        return frames + [CLOSE] if msg["type"] == "hikvision_intercom/subscribe" else frames

    fakes = install(script, refuse_after=1)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: install.refused["n"] >= 2 and intercom_sync.STATE.state == "ha_unavailable")
    intercom_sync.SYNC.shutdown()  # stop the feed's own retries, so any further connect attempt would be the request's
    intercom_sync.SYNC.thread.join(timeout=5)
    refused = install.refused["n"]
    body = TestClient(app).get("/api/v1/intercom/people", params={"query": "dana"}).json()
    assert body["state"] == "ha_unavailable" and body["people"] is None and body["last_error"] == "OSError"
    assert len(fakes) == 1 and not sent(fakes, "users/query")
    assert install.refused["n"] == refused, "the request did not try to open a connection of its own"


def test_session_lost_mid_request_is_ha_unavailable(feed):
    """HA drops the socket while a one-off read is waiting: that request reports `ha_unavailable` (the pending call is
    cancelled with the session) and the feed's own loop takes it from there."""
    app, fakes = ready_feed(feed, lambda msg: [CLOSE] if msg["type"] == "hikvision_intercom/events/list" else None, refuse_after=1)
    body = TestClient(app).get("/api/v1/intercom/events").json()
    assert body["state"] == "ha_unavailable" and body["events"] is None
    assert len(sent(fakes, "events/list")) == 1
    wait_for(lambda: intercom_sync.STATE.state == "ha_unavailable")


# ---------------------------------------------------------------- phase 1b review fixes (S2, S3, N1-N3)

def test_local_rate_buckets_refuse_before_calling_wiskey(feed, monkeypatch):
    """S2a: WisKey's per-HA-user budget is shared with the feed, so one-off reads spend SMPLWISE's own tokens first -
    per SMPLWISE user and in total - and an empty bucket is answered without calling WisKey at all."""
    monkeypatch.setattr(intercom_sync, "USER_BURST", 2.0)
    monkeypatch.setattr(intercom_sync, "USER_RATE", 0.0)
    monkeypatch.setattr(intercom_sync, "GLOBAL_BURST", 3.0)
    monkeypatch.setattr(intercom_sync, "GLOBAL_RATE", 0.0)
    app, fakes = ready_feed(feed, lambda msg: [ok(msg, copy.deepcopy(EVENTS_PAGE))] if msg["type"] == "hikvision_intercom/events/list" else None)
    intercom_sync.SYNC._buckets_reset()
    c = TestClient(app)
    bind(c, feed[1], "vera", "viewer", "installation", "*")

    def get(headers: dict[str, str] | None = None) -> dict[str, Any]:
        return c.get("/api/v1/intercom/events", headers=headers or {}).json()

    assert get()["state"] == "ready" and get()["state"] == "ready"
    mine = get()
    assert (mine["state"], mine["last_error"], mine["events"]) == ("error", "rate_limited", None), "the caller's own bucket is empty"
    assert get(as_user("vera"))["state"] == "ready", "another user still has tokens of their own"
    total = get(as_user("vera"))
    assert (total["state"], total["last_error"]) == ("error", "rate_limited"), "and the shared bucket is empty now"
    assert len(sent(fakes, "events/list")) == 3, "a refused request never reaches WisKey"
    assert intercom_sync.STATE.state == "ready" and len(fakes) == 1


def test_rate_limited_refresh_keeps_the_session(feed, monkeypatch):
    """S2b: WisKey answering the feed's own overview refetch with `rate_limited` is temporary: the session, the copy
    and the state stay; the refetch is retried after RATE_RETRY_S instead of tearing the feed down and reconnecting."""
    monkeypatch.setattr(intercom_sync, "RATE_RETRY_S", 0.1)
    app, s, install = feed
    calls = {"overview": 0}
    ringing = copy.deepcopy(OVERVIEW)
    ringing["stations"][0]["call_state"] = "ringing"

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            calls["overview"] += 1
            if calls["overview"] == 2:
                return [fail(msg, "rate_limited")]
            return [ok(msg, copy.deepcopy(OVERVIEW if calls["overview"] == 1 else ringing))]
        if msg["type"] == "hikvision_intercom/subscribe":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"kind": "refresh"}}]  # triggers refetch #2
        return normal(msg, fake)

    q = intercom_sync.subscribe()
    try:
        fakes = install(script)
        intercom_sync.SYNC.start(s)
        wait_for(lambda: calls["overview"] >= 3 and intercom_sync.STATE.sequence >= 2)
        assert len(fakes) == 1 and intercom_sync.STATE.reconnects == 0, "no reconnect"
        assert intercom_sync.STATE.state == "ready" and intercom_sync.STATE.connected
        assert pushed_states(q) == ["ready"], "the feed never left ready"
        body = TestClient(app).get("/api/v1/intercom/overview").json()
        assert body["fresh"] is True and body["overview"]["stations"][0]["call_state"] == "ringing", "the retry refetched"
        assert not intercom_sync.SYNC._retry_pending
    finally:
        intercom_sync.unsubscribe(q)


def test_busy_is_answered_at_once(feed):
    """S3: with every in-flight slot taken, a request is answered `busy` immediately - it never parks a worker thread."""
    app, fakes = ready_feed(feed, lambda msg: None)
    slot = intercom_sync.SYNC._inflight = threading.BoundedSemaphore(1)
    assert slot.acquire(blocking=False)
    try:
        client = TestClient(app)  # constructed before the clock starts: app start-up is not what is measured
        t0 = time.monotonic()
        body = client.get("/api/v1/intercom/people/u1").json()
        # A blocking wait would last COMMAND_TIMEOUT_S; an immediate `busy` answer is an order of magnitude faster
        # even on a loaded workstation (a 1 s bound failed four times on 2026-09-28 under 70-90 % CPU, passing alone).
        assert time.monotonic() - t0 < intercom_sync.COMMAND_TIMEOUT_S / 2, "no blocking wait for a slot"
        assert (body["state"], body["last_error"], body["person"]) == ("error", "busy", None)
        assert not sent(fakes, "users/get")
    finally:
        slot.release()


def test_timeout_keeps_the_slot_until_wiskey_answers(feed, monkeypatch):
    """N3 + the timeout path: the browser request gives up after COMMAND_TIMEOUT_S, but WisKey's handler is still
    running, so the in-flight slot stays taken until WisKey's answer arrives."""
    monkeypatch.setattr(intercom_sync, "COMMAND_TIMEOUT_S", 0.2)
    held: list[tuple[dict[str, Any], FakeHa]] = []

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/users/get":
            if not held:
                held.append((msg, fake))
                return []  # WisKey is slow: no answer yet
            return [ok(msg, copy.deepcopy(PERSON))]
        return normal(msg, fake)

    app, s, install = feed
    install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    intercom_sync.SYNC._inflight = threading.BoundedSemaphore(1)
    c = TestClient(app)
    body = c.get("/api/v1/intercom/people/u1").json()
    assert (body["state"], body["last_error"], body["person"]) == ("error", "timeout", None)
    assert c.get("/api/v1/intercom/people/u1").json()["last_error"] == "busy", "WisKey has not answered: the slot is still taken"
    msg, fake = held[0]
    assert intercom_sync.SYNC._event_loop and fake.q
    intercom_sync.SYNC._event_loop.call_soon_threadsafe(fake.q.put_nowait, ok(msg, copy.deepcopy(PERSON)))  # the late answer
    wait_for(lambda: intercom_sync.SYNC._inflight._value == 1)
    body = c.get("/api/v1/intercom/people/u1").json()
    assert body["state"] == "ready" and body["person"] == PROJECTED_PERSON
    assert intercom_sync.STATE.state == "ready"


def test_malformed_replies_are_invalid_response(feed):
    """A WisKey reply of an unexpected shape is `error` / `invalid_response` for that request, never a lost connection."""
    broken = copy.deepcopy(PEOPLE_PAGE)
    broken["records"][0]["assignments"]["entry-a"]["allowed_locks"] = 5  # not a list

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == "hikvision_intercom/users/get":
            return [ok(msg, ["not", "a", "person"])]
        if msg["type"] == "hikvision_intercom/users/query":
            return [ok(msg, copy.deepcopy(broken))]
        return None

    app, fakes = ready_feed(feed, answer)
    c = TestClient(app)
    # the search path projects inside the scan: a bad record there must read the same, not as "HA unreachable"
    for path, key in (("/api/v1/intercom/people/u1", "person"), ("/api/v1/intercom/people", "people"), ("/api/v1/intercom/people?query=dana", "people")):
        body = c.get(path).json()
        assert (body["state"], body["last_error"], body[key], body["fetched_at"]) == ("error", "invalid_response", None, None), path
    broken["records"] = "not a list"
    body = c.get("/api/v1/intercom/people", params={"query": "dana"}).json()
    assert (body["state"], body["last_error"], body["people"]) == ("error", "invalid_response", None)
    assert intercom_sync.STATE.state == "ready" and len(fakes) == 1


def test_session_gone_before_the_command_runs_reports_the_feed_state(feed, monkeypatch):
    """N1: the request thread saw `ready`, but by the time the command reached the feed's loop the feed had concluded
    something else (here WisKey revoked access): the reply carries that state, not a generic `ha_unavailable`."""
    app, fakes = ready_feed(feed, lambda msg: None)
    real = asyncio.run_coroutine_threadsafe

    def racing(coro: Any, loop: Any) -> Any:
        if loop is intercom_sync.SYNC._event_loop:  # only the command's hop (TestClient's portal may use this too)
            intercom_sync.STATE.state, intercom_sync.STATE.last_error = "forbidden", "unauthorized"
        return real(coro, loop)

    monkeypatch.setattr(asyncio, "run_coroutine_threadsafe", racing)
    body = TestClient(app).get("/api/v1/intercom/people/u1").json()
    assert (body["state"], body["last_error"], body["person"]) == ("forbidden", "unauthorized", None)
    assert not sent(fakes, "users/get"), "nothing was sent over a session that is no longer usable"


def test_expired_cursor_has_its_own_code(feed):
    """N2: WisKey's `invalid_fields` for a paged request (`before` sent) is the pruned cursor; without `before` it is a
    generic refusal."""
    app, _fakes = ready_feed(feed, lambda msg: [fail(msg, "invalid_fields")] if msg["type"] == "hikvision_intercom/events/list" else None)
    c = TestClient(app)
    r = c.get("/api/v1/intercom/events", params={"before": "ev-gone"})
    assert r.status_code == 422 and r.json()["code"] == "intercom_cursor_expired"
    r = c.get("/api/v1/intercom/events", params={"station_id": "entry-a"})
    assert r.status_code == 422 and r.json()["code"] == "intercom_invalid_request"
    assert intercom_sync.STATE.state == "ready"


# ---------------------------------------------------------------- D1: people search stays in SMPLWISE

def directory(n: int) -> list[dict[str, Any]]:
    """`n` WisKey people (full public Person, phones and cards included), in WisKey's own order."""
    out = []
    for i in range(1, n + 1):
        person = copy.deepcopy(PERSON)
        person.update(id=f"u{i}", employee_no=f"E{i:04d}", display_name=f"Person {i}", phone=f"+9725{i:08d}", cards=[{"id": f"c{i}", "masked_number": f"•••• {9000 + i}", "label": "", "card_type": "normalCard", "enabled": True}])
        out.append(person)
    return out


def wiskey_directory(people: list[dict[str, Any]], snapshot: str = "snap-1") -> Callable[[dict[str, Any]], list[Any] | None]:
    """A `users/query` that behaves like WisKey's own (user_directory.py): paging by offset / limit with next_offset, and
    - should SMPLWISE ever send a text - WisKey's real matching, which includes phone digits and card last-4."""

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] != "hikvision_intercom/users/query":
            return None
        text = msg["query"].casefold()
        digits = "".join(ch for ch in text if ch.isdigit())

        def hit(p: dict[str, Any]) -> bool:
            if text in f"{p['display_name']} {p['employee_no']} {p['phone']}".casefold():
                return True
            if len(digits) >= 3 and digits in "".join(ch for ch in p["phone"] if ch.isdigit()):
                return True
            return len(text) == 4 and text.isdigit() and any(c["masked_number"].endswith(text) for c in p["cards"])

        rows = [p for p in people if hit(p)] if text else people
        off, lim = msg["offset"], msg["limit"]
        page = rows[off:off + lim]
        return [ok(msg, {
            "records": copy.deepcopy(page), "total": len(rows), "total_all": len(people), "offset": off, "limit": lim,
            "next_offset": off + lim if off + lim < len(rows) else None, "previous_offset": max(0, off - lim) if off else None,
            "snapshot": snapshot, "stale": bool(msg["snapshot"]) and msg["snapshot"] != snapshot,
        })]

    return answer


@pytest.fixture()
def roomy_buckets(monkeypatch):
    """Rate buckets large enough that a test making many requests measures paging, not throttling."""
    monkeypatch.setattr(intercom_sync, "USER_BURST", 1000.0)
    monkeypatch.setattr(intercom_sync, "GLOBAL_BURST", 1000.0)
    yield lambda: intercom_sync.SYNC._buckets_reset()


def test_search_never_matches_or_forwards_phone_and_card(feed, roomy_buckets):
    """D1: a text that matches a person's phone or card digits - but not their name or employee number - finds nobody,
    and no users/query ever carries the text. The fake WisKey implements WisKey's own phone / card matching, so
    forwarding the text would make this test fail."""
    people = directory(3)
    app, fakes = ready_feed(feed, wiskey_directory(people))
    roomy_buckets()
    c = TestClient(app)
    probes = ("+97250000000", "500000002", "00000002", "9002", "9725")  # phone (full / partial digits), card last-4
    for probe in probes:
        body = c.get("/api/v1/intercom/people", params={"query": probe}).json()
        assert body["state"] == "ready", probe
        assert body["people"]["records"] == [] and body["people"]["total"] == 0, f"{probe} must match nobody"
        assert body["people"]["total_all"] == 3 and body["people"]["complete"] is True
    for text, ids in (("person 2", ["u2"]), ("e0003", ["u3"]), ("PERSON", ["u1", "u2", "u3"])):
        body = c.get("/api/v1/intercom/people", params={"query": text}).json()
        assert [p["id"] for p in body["people"]["records"]] == ids, text
    queries = sent(fakes, "users/query")
    assert queries and all(m["query"] == "" for m in queries), "the search text never reaches WisKey"
    assert not any(probe in json.dumps(m) for m in queries for probe in probes)
    text = json.dumps(c.get("/api/v1/intercom/people", params={"query": "person"}).json())
    assert "+9725" not in text and "•" not in text, "and the reply still carries no phone or card"


def test_search_paging_counts_local_matches(feed, roomy_buckets):
    """D1 pagination: SMPLWISE scans WisKey's filtered directory (pages of SCAN_PAGE) and pages over its own match
    list - `total` counts matches, offsets index matches, past-the-end is clamped to the last page."""
    people = directory(450)  # three WisKey pages of 200
    app, fakes = ready_feed(feed, wiskey_directory(people))
    roomy_buckets()
    c = TestClient(app)
    expected = [p["id"] for p in people if "person 1" in p["display_name"].casefold()]  # 1, 10-19, 100-199: 111
    assert len(expected) == 111

    page = c.get("/api/v1/intercom/people", params={"query": "Person 1", "limit": 50, "state": "active"}).json()["people"]
    scan = sent(fakes, "users/query")
    assert [(m["offset"], m["limit"]) for m in scan] == [(0, 200), (200, 200), (400, 200)], "the whole filtered directory, once"
    assert all(m["filters"] == {"state": "active", "sort": "employee"} for m in scan), "the other filters still go to WisKey"
    assert [m["snapshot"] for m in scan] == ["", "snap-1", "snap-1"], "later pages pin the first page's snapshot"
    assert [p["id"] for p in page["records"]] == expected[:50]
    assert (page["total"], page["total_all"], page["offset"], page["next_offset"], page["previous_offset"]) == (111, 450, 0, 50, None)
    assert page["complete"] is True and page["incomplete_reason"] is None and page["snapshot"] == "snap-1"

    page = c.get("/api/v1/intercom/people", params={"query": "Person 1", "limit": 50, "offset": 100}).json()["people"]
    assert [p["id"] for p in page["records"]] == expected[100:]
    assert (page["total"], page["offset"], page["next_offset"], page["previous_offset"]) == (111, 100, None, 50)
    page = c.get("/api/v1/intercom/people", params={"query": "Person 1", "limit": 50, "offset": 5000}).json()["people"]
    assert page["offset"] == 100 and len(page["records"]) == 11, "past the end: clamped to the last page, as WisKey does"
    page = c.get("/api/v1/intercom/people", params={"query": "nobody here", "offset": 50}).json()["people"]
    assert (page["records"], page["total"], page["offset"], page["next_offset"], page["previous_offset"]) == ([], 0, 0, None, None)
    page = c.get("/api/v1/intercom/people", params={"query": "Person 1", "snapshot": "snap-0"}).json()["people"]
    assert page["stale"] is True, "an out-of-date snapshot from the caller is reported"

    # without a text: WisKey's own paging, one page, unchanged
    before = len(sent(fakes, "users/query"))
    page = c.get("/api/v1/intercom/people", params={"limit": 50, "offset": 400}).json()["people"]
    assert len(sent(fakes, "users/query")) == before + 1
    assert (page["total"], page["offset"], len(page["records"]), page["next_offset"], page["complete"]) == (450, 400, 50, None, True)


def test_search_scan_is_bounded(feed, monkeypatch):
    """D1 + S2: one browser request never loops over WisKey unbounded - the scan stops at MAX_SCAN_PAGES, or as soon as
    the caller's rate bucket cannot pay for the next page, and says so (`complete: false`, a lower-bound `total`)."""
    people = directory(450)
    app, fakes = ready_feed(feed, wiskey_directory(people))
    c = TestClient(app)
    monkeypatch.setattr(intercom_sync, "MAX_SCAN_PAGES", 2)
    page = c.get("/api/v1/intercom/people", params={"query": "Person 1"}).json()["people"]
    assert len(sent(fakes, "users/query")) == 2
    assert page["complete"] is False and page["incomplete_reason"] == "scan_limit"
    assert page["total"] == len([p for p in people[:400] if "person 1" in p["display_name"].casefold()])

    monkeypatch.setattr(intercom_sync, "MAX_SCAN_PAGES", 10)
    monkeypatch.setattr(intercom_sync, "USER_BURST", 2.0)
    monkeypatch.setattr(intercom_sync, "USER_RATE", 0.0)
    intercom_sync.SYNC._buckets_reset()
    before = len(sent(fakes, "users/query"))
    body = c.get("/api/v1/intercom/people", params={"query": "Person 1"}).json()
    assert body["state"] == "ready" and len(sent(fakes, "users/query")) == before + 2, "one token per WisKey page"
    assert body["people"]["complete"] is False and body["people"]["incomplete_reason"] == "rate_limited"
    body = c.get("/api/v1/intercom/people", params={"query": "Person 1"}).json()
    assert (body["state"], body["last_error"]) == ("error", "rate_limited") and len(sent(fakes, "users/query")) == before + 2


def test_search_skips_people_seen_twice_when_the_directory_shifts(feed, roomy_buckets):
    """A directory change mid-scan can move a person onto the next WisKey page as well: flagged `stale`, and still
    listed once."""
    people = directory(250)

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] != "hikvision_intercom/users/query":
            return None
        if msg["offset"] == 0:
            rows, stale = people[0:200], False
        else:  # someone was deleted near the top meanwhile: everything shifted up by one, person 200 appears again
            rows, stale = people[199:250], True
        return [ok(msg, {"records": copy.deepcopy(rows), "total": 250, "total_all": 250, "offset": msg["offset"], "limit": msg["limit"],
                         "next_offset": 200 if msg["offset"] == 0 else None, "previous_offset": None, "snapshot": "snap-2" if stale else "snap-1", "stale": stale})]

    app, _fakes = ready_feed(feed, answer)
    roomy_buckets()
    page = TestClient(app).get("/api/v1/intercom/people", params={"query": "person", "limit": 200, "offset": 200}).json()["people"]
    assert page["total"] == 250 and page["stale"] is True
    ids = [p["id"] for p in page["records"]]
    assert ids == [f"u{i}" for i in range(201, 251)], "person 200 is not listed a second time"


def test_session_already_gone_is_session_ended(feed, monkeypatch):
    """The feed still says `ready`, but the session ended between the request's check and the command reaching the
    feed's loop: `ha_unavailable` with `last_error` `session_ended`, and nothing is sent."""
    app, fakes = ready_feed(feed, lambda msg: None)
    sync = intercom_sync.SYNC
    live = sync._call
    real = asyncio.run_coroutine_threadsafe

    def racing(coro: Any, loop: Any) -> Any:
        if loop is sync._event_loop:
            sync._call = None  # the session's own `finally` got there first
        return real(coro, loop)

    monkeypatch.setattr(asyncio, "run_coroutine_threadsafe", racing)
    try:
        body = TestClient(app).get("/api/v1/intercom/people/u1").json()
    finally:
        sync._call = live
    assert (body["state"], body["last_error"], body["person"]) == ("ha_unavailable", "session_ended", None)
    assert not sent(fakes, "users/get")


def test_busy_costs_no_rate_token(feed, monkeypatch):
    """A `busy` refusal never reached WisKey, so it must not spend the caller's rate budget."""
    monkeypatch.setattr(intercom_sync, "USER_BURST", 1.0)
    monkeypatch.setattr(intercom_sync, "USER_RATE", 0.0)
    app, fakes = ready_feed(feed, lambda msg: [ok(msg, copy.deepcopy(PERSON))] if msg["type"] == "hikvision_intercom/users/get" else None)
    intercom_sync.SYNC._buckets_reset()
    slot = intercom_sync.SYNC._inflight = threading.BoundedSemaphore(1)
    c = TestClient(app)
    assert slot.acquire(blocking=False)
    try:
        for _ in range(3):
            assert c.get("/api/v1/intercom/people/u1").json()["last_error"] == "busy"
    finally:
        slot.release()
    body = c.get("/api/v1/intercom/people/u1").json()
    assert body["state"] == "ready" and body["person"] == PROJECTED_PERSON, "the single token was still there"
    assert c.get("/api/v1/intercom/people/u1").json()["last_error"] == "rate_limited"
    assert len(sent(fakes, "users/get")) == 1 and slot._value == 1, "a refused token gives the slot back"


def test_events_client_never_sends_current_profile():
    """S1 at the client layer too: whatever a caller passes, only EVENT_FILTER_KEYS reach WisKey."""
    from smplwise.services import intercom_client

    seen: list[dict[str, Any]] = []

    async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
        seen.append({"type": msg_type, **kw})
        return {"success": True, "result": {"records": []}}

    asyncio.run(intercom_client.events_list(call, {"station_id": "entry-a", "current_profile": {"id_number": "123456789"}, "person": None, "surprise": 1}))
    assert seen == [{"type": "hikvision_intercom/events/list", "filters": {"station_id": "entry-a"}}]


# ---------------------------------------------------------------- phase 3: physical actions (access.release)

import datetime as _dt  # noqa: E402
import logging  # noqa: E402
import sqlite3  # noqa: E402
import uuid  # noqa: E402

from smplwise.db import Database  # noqa: E402
from smplwise.routers import access_control  # noqa: E402
from smplwise.routers.access import SENSITIVE  # noqa: E402


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    """A physical request body with a fresh command envelope (client_request_id + expires_at, as routers/ha.py)."""
    expires = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"client_request_id": str(uuid.uuid4()), "expires_at": expires, **fields}


def action_paths() -> tuple[tuple[str, str, dict[str, Any] | None], ...]:
    return (
        ("post", "/api/v1/intercom/stations/entry-a/release", env(confirmed=True)),
        ("post", "/api/v1/intercom/stations/entry-a/call", env(command="answer")),
        ("get", "/api/v1/intercom/tts/engines", None),
        ("post", "/api/v1/intercom/stations/entry-a/tts", env(engine_id="tts.piper", language="he", message="שלום")),
    )


# WisKey's CallResult (client/media.py:163-171) and tts/engines reply (audio_tts.py:256-269), as WisKey sends them
SIGNAL_RESULT = {"command": "answer", "acknowledged": True, "physical_result": "unverified", "before_state": "ringing", "observed_state": "in_call", "observation": "state_changed", "checked_at": "2026-09-27T08:01:00+00:00"}
TTS_ENGINES = {"default": "tts.piper", "engines": [
    {"engine_id": "tts.piper", "name": "Piper", "supported_languages": ["en", "he"], "default_language": "he"},
    {"engine_id": "tts.google_translate_en_com", "name": "Google Translate", "supported_languages": ["en", "iw"], "default_language": "en"},
    {"name": "no id, dropped"},
]}
# a station with two relays, online, ringing (the call controls' case)
TWO_LOCKS = {**copy.deepcopy(STATION), "id": "entry-c", "name": "Loading dock", "call_state": "ringing", "integrated_locks": [{"physical_index": 1, "api_id": 1, "name": "Gate"}, {"physical_index": 2, "api_id": 7, "name": "Barrier"}]}
ACTIONS_OVERVIEW = {**copy.deepcopy(OVERVIEW), "stations": [STATION, OFFLINE, TWO_LOCKS]}
UNLOCK = "hikvision_intercom/stations/test_unlock"


@pytest.fixture(autouse=True)
def _fresh_relays():
    access_control.RELAYS.clear()
    yield
    access_control.RELAYS.clear()


def audit_rows(settings: Any, action: str, phase: str | None = None) -> list[dict[str, Any]]:
    with Database(settings.db_path).connection() as conn:
        rows = conn.execute("SELECT actor_user_id, actor_username, action, decision, resource_type, resource_id, reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()
    out = [{**dict(r), "details": json.loads(r["details_json"]) if r["details_json"] else None} for r in rows]
    return [r for r in out if phase is None or (r["details"] or {}).get("phase") == phase]


def actions_feed(feed, answer: Callable[[dict[str, Any]], list[Any] | None], refuse_after: int | None = None, overview: dict[str, Any] | None = None) -> tuple[Any, list[FakeHa], TestClient]:
    """A ready feed over ACTIONS_OVERVIEW, a site_admin `sam` (installation) and a viewer `vera` bound."""
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        frames = answer(msg)
        if frames is not None:
            return frames
        return normal(msg, fake, overview or ACTIONS_OVERVIEW)

    fakes = install(script, refuse_after=refuse_after)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    c = TestClient(app)
    bind(c, s, "sam", "site_admin", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    return app, fakes, c


def accept_unlock(msg: dict[str, Any]) -> list[Any] | None:
    return [ok(msg, {"accepted": True})] if msg["type"] == UNLOCK else None


def release(c: TestClient, station: str = "entry-a", user: str = "sam", **fields: Any) -> Any:
    body = env(**{"confirmed": True, **fields})
    return c.post(f"/api/v1/intercom/stations/{station}/release", json=body, headers=as_user(user))


def test_access_release_permission_catalogue():
    """`access.release` is its own, sensitive permission: only site_admin and system_admin hold it by default (the
    decision recorded at routers/access.py PERMISSION_LABELS), it is never implied, and the design catalogue agrees."""
    assert {r for r, perms in ROLES.items() if "access.release" in perms} == {"site_admin", "system_admin"}
    for role in ("viewer", "kiosk", "operator", "editor"):
        assert "access.release" not in ROLES[role], role
    assert "access.release" in SENSITIVE and "door.unlock" in SENSITIVE
    assert PERMISSION_LABELS["access.release"]
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"]: "access.release" in r["permissions"] for r in contract["roles"]} == {r["id"]: "access.release" in ROLES[r["id"]] for r in contract["roles"]}
    assert "access.release" in contract["sensitive_permissions_not_implied"]


def test_physical_actions_require_access_release(settings):
    """`access.read` is not enough: a viewer (and an operator, an editor, a kiosk, a site-scoped site_admin) gets 403
    on every physical endpoint, before the body is even validated and before anything could be sent."""
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(settings)
    c = TestClient(create_app(settings))
    for user, role in (("vera", "viewer"), ("otto", "operator"), ("eddie", "editor"), ("wall", "kiosk")):
        bind(c, settings, user, role, "installation", "*")
    site = c.post("/api/v1/sites", json={"name": "T054 site"}).json()["id"]
    bind(c, settings, "sally", "site_admin", "site", site)
    bind(c, settings, "sam", "site_admin", "installation", "*")
    assert c.get("/api/v1/intercom/overview", headers=as_user("vera")).status_code == 200, "vera does hold access.read"
    for user in ("vera", "otto", "eddie", "wall", "sally", "nobody"):
        for method, path, body in action_paths():
            r = c.request(method, path, json=body, headers=as_user(user))
            assert r.status_code == 403 and r.json()["code"] == "forbidden", (user, path)
    r = c.post("/api/v1/intercom/stations/entry-a/call", json={"command": "open sesame"}, headers=as_user("vera"))
    assert r.status_code == 403, "no permission: refused before the body is looked at"
    assert c.post("/api/v1/intercom/stations/entry-a/call", json=env(command="open sesame"), headers=as_user("sam")).status_code == 422
    with Database(settings.db_path).connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'access.release' AND decision = 'denied' AND actor_username = 'vera'").fetchone()[0]
        refused = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action LIKE 'intercom.%' AND actor_username = 'vera'").fetchone()[0]
    assert denied == len(action_paths()) + 1, "every permission refusal is audited under the real caller"
    assert refused == 0, "a caller without the permission never reaches the action's own audit"
    assert "access.release" in c.get("/api/v1/me", headers=as_user("sam")).json()["permissions_installation"]
    assert "access.release" not in c.get("/api/v1/me", headers=as_user("sally")).json()["permissions_installation"]
    intercom_sync.SYNC.reset()


def test_release_round_trip_is_confirmed_single_and_audited(feed):
    """Door release: refused without the explicit confirmation, then sent once with WisKey's exact shape
    ({station_id, lock, api_contract: 1}), answered `accepted` - served as accepted, never as "opened" - and audited
    under the real caller: an attempt row committed before sending and an outcome row after."""
    app, fakes, c = actions_feed(feed, accept_unlock)
    s = feed[1]
    for confirmed in (None, False, "yes", 1):
        body = env() if confirmed is None else env(confirmed=confirmed)
        r = c.post("/api/v1/intercom/stations/entry-a/release", json=body, headers=as_user("sam"))
        assert r.status_code == 409 and r.json()["code"] == "confirmation_required", confirmed
        assert r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fakes, "stations/test_unlock"), "nothing reaches WisKey without the confirmation"

    r = release(c)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "ready" and body["release"] == {"accepted": True} and body["command_id"]
    assert "אינו אישור שהדלת נפתחה" in body["note"], "accepted is not opened"
    [msg] = sent(fakes, "stations/test_unlock")
    assert msg == {"id": msg["id"], "type": UNLOCK, "station_id": "entry-a", "lock": 1, "api_contract": 1}
    assert len(fakes) == 1, "the action rode the feed's own connection"
    [attempt] = audit_rows(s, "intercom.release", "attempt")
    [outcome] = audit_rows(s, "intercom.release", "outcome")
    for row in (attempt, outcome):
        assert (row["actor_user_id"], row["actor_username"], row["decision"], row["resource_type"], row["resource_id"], row["reason"]) == ("dev-sam", "sam", "allowed", "intercom_station", "entry-a", None)
        assert row["details"]["command_id"] == body["command_id"] and row["details"]["lock"] == 1 and row["details"]["station_name"] == "Main gate"
    assert outcome["details"]["outcome"] == "ok" and outcome["details"]["result"] == {"accepted": True}
    assert "outcome" not in attempt["details"]

    # a two-relay station: the relay must be named, and must be one it has
    assert release(c, "entry-c").json()["code"] == "intercom_lock_required"
    assert release(c, "entry-c", lock=3).json()["code"] == "intercom_lock_unknown"
    assert release(c, "entry-c", lock=True).status_code == 422, "bool is not a relay"
    assert release(c, "entry-c", lock=2).status_code == 200
    assert sent(fakes, "stations/test_unlock")[-1]["lock"] == 2
    # no lock / unknown station: refused before sending
    assert release(c, "entry-b").json()["code"] == "intercom_no_lock"
    r = release(c, "nope")
    assert r.status_code == 404 and r.json()["code"] == "intercom_station_not_found"
    assert len(sent(fakes, "stations/test_unlock")) == 2


def test_every_refused_release_is_audited(feed, monkeypatch):
    """B1: every request that passed the permission check leaves a row, including those refused before anything was
    sent - missing / false confirmation, a malformed body, an unknown station, no such relay, an offline station, a
    release of that relay still in flight, an expired or duplicate command."""
    offline_lock = {**copy.deepcopy(STATION), "id": "entry-d", "name": "Store room", "online": False, "call_state": "unavailable"}
    held: list[tuple[dict[str, Any], FakeHa]] = []

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == UNLOCK and msg["station_id"] == "entry-c":
            return []  # WisKey is slow: the entry-c release stays in flight
        return accept_unlock(msg)

    monkeypatch.setattr(intercom_sync, "ACTION_TIMEOUT_S", 0.3)
    app, fakes, c = actions_feed(feed, answer, overview={**copy.deepcopy(ACTIONS_OVERVIEW), "stations": [STATION, OFFLINE, TWO_LOCKS, offline_lock]})
    s = feed[1]
    dup = env(confirmed=True)
    assert c.post("/api/v1/intercom/stations/entry-a/release", json=dup, headers=as_user("sam")).status_code == 200
    assert release(c, "entry-c", lock=1).status_code == 504  # unanswered: the relay stays busy
    cases = [
        (env(), "entry-a", 409, "confirmation_required"),
        (env(confirmed=False), "entry-a", 409, "confirmation_required"),
        ({"confirmed": True}, "entry-a", 422, "validation"),  # no command envelope
        (env(confirmed=True, lock="one"), "entry-a", 422, "validation"),
        (env(confirmed=True), "nope", 404, "intercom_station_not_found"),
        (env(confirmed=True, lock=9), "entry-c", 422, "intercom_lock_unknown"),
        (env(confirmed=True), "entry-d", 409, "intercom_station_offline"),
        (env(confirmed=True), "entry-b", 409, "intercom_no_lock"),
        (env(confirmed=True, lock=1), "entry-c", 409, "intercom_release_in_progress"),
        (env(ttl=-5, confirmed=True), "entry-a", 409, "expired"),
        (env(ttl=3600, confirmed=True), "entry-a", 422, "expires_too_far"),
        (dup, "entry-a", 409, "intercom_duplicate_command"),
    ]
    for body, station, status, code in cases:
        r = c.post(f"/api/v1/intercom/stations/{station}/release", json=body, headers=as_user("sam"))
        assert (r.status_code, r.json()["code"]) == (status, code), (station, body, r.text)
        assert r.json()["details"]["outcome"] == "not_sent", code
    refused = audit_rows(s, "intercom.release", "refused")
    assert [(r["reason"], r["resource_id"]) for r in refused] == [(code, station) for _b, station, _s, code in cases]
    for row in refused:
        assert (row["actor_username"], row["decision"], row["details"]["outcome"]) == ("sam", "denied", "not_sent")
    assert refused[-1]["details"]["client_request_id"] == dup["client_request_id"]
    assert len(sent(fakes, "stations/test_unlock")) == 2, "none of the refused requests reached WisKey"
    # the two that were sent: attempt + outcome each
    assert [r["details"]["outcome"] for r in audit_rows(s, "intercom.release", "outcome")] == ["ok", "unknown"]


def test_outcome_audit_failure_under_a_locked_database_keeps_the_result_and_the_attempt(feed, monkeypatch, caplog):
    """B1, the contention case: the attempt row is committed BEFORE the command is sent and the request's own write
    transaction is not re-taken afterwards. With another writer holding the database while WisKey answers, the outcome
    row cannot be written: the caller still gets the real result (200 accepted, not a 500), the attempt row stands, and
    the loss is logged."""
    real_open = Database._open

    def quick_open(self: Database) -> sqlite3.Connection:
        conn = real_open(self)
        conn.execute("PRAGMA busy_timeout=300")  # the production 10 s, shortened for the test
        return conn

    monkeypatch.setattr(Database, "_open", quick_open)
    s = feed[1]
    blockers: list[sqlite3.Connection] = []

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == UNLOCK:
            blocker = sqlite3.connect(s.db_path, isolation_level=None, check_same_thread=False)
            blocker.execute("BEGIN IMMEDIATE")  # another writer takes the database right as WisKey answers
            blockers.append(blocker)
            return [ok(msg, {"accepted": True})]
        return None

    app, fakes, c = actions_feed(feed, answer)
    with caplog.at_level(logging.ERROR, logger="smplwise.intercom"):
        r = release(c)
    for b in blockers:
        b.execute("ROLLBACK")
        b.close()
    assert r.status_code == 200 and r.json()["release"] == {"accepted": True}, r.text
    [attempt] = audit_rows(s, "intercom.release", "attempt")
    assert attempt["details"]["command_id"] == r.json()["command_id"] and attempt["actor_username"] == "sam"
    assert audit_rows(s, "intercom.release", "outcome") == [], "the outcome could not be written while the database was held"
    assert any("could not be recorded" in rec.getMessage() for rec in caplog.records)


def test_accepted_but_unexpected_answer_is_unknown_never_refused(feed, monkeypatch):
    """B2: once WisKey said `success: true` the command was carried out as far as WisKey knows. An answer of a shape
    SMPLWISE does not expect - or a frame that is neither success nor failure - is "outcome unknown" (504), never
    "refused, not performed" (502)."""
    answers = iter([
        lambda m: [ok(m, None)],
        lambda m: [ok(m, "accepted")],
        lambda m: [ok(m, {"accepted": "yes"})],
        lambda m: [ok(m, {"queued": True})],
        lambda m: [{"id": m["id"], "type": "result"}],  # no `success` at all
    ])

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == UNLOCK:
            return next(answers)(msg)
        if msg["type"] == "hikvision_intercom/media/signal":
            return [ok(msg, ["not", "a", "call", "result"])]
        return None

    monkeypatch.setattr(intercom_sync, "ACTION_USER_BURST", 100.0)
    monkeypatch.setattr(intercom_sync, "ACTION_GLOBAL_BURST", 100.0)
    app, fakes, c = actions_feed(feed, answer)
    intercom_sync.SYNC._buckets_reset()
    s = feed[1]
    for n in range(5):
        access_control.RELAYS.clear()  # each unknown outcome holds the relay (S1); this test is about the classification
        r = release(c)
        assert r.status_code == 504 and r.json()["code"] == "intercom_outcome_unknown", (n, r.text)
        assert r.json()["details"]["outcome"] == "unknown" and r.json()["details"]["wiskey_code"] == "invalid_response", n
        assert "ייתכן שבוצעה" in r.json()["user_message"]
    r = c.post("/api/v1/intercom/stations/entry-c/call", json=env(command="answer"), headers=as_user("sam"))
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown"
    outcomes = audit_rows(s, "intercom.release", "outcome")
    assert [row["details"]["outcome"] for row in outcomes] == ["unknown"] * 5 and not any(row["details"]["outcome"] == "refused" for row in outcomes)


def test_genuine_refusals_stay_refused(feed):
    """WisKey refusing the add-on's user (`unauthorized`), a signal already running at the station (`device_busy`), an
    older WisKey without the command, and WisKey's own limiter: all pre-device, so HTTP errors with outcome `refused`,
    audited, and the feed itself stays ready."""
    answers = {"stations/test_unlock": "unauthorized", "media/signal": "device_busy", "tts/start": "rate_limited", "tts/engines": "unknown_command"}

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        command = msg["type"].removeprefix("hikvision_intercom/")
        return [fail(msg, answers[command])] if command in answers else None

    app, fakes, c = actions_feed(feed, answer)
    s = feed[1]
    r = release(c)
    assert r.status_code == 502 and r.json()["code"] == "intercom_action_refused"
    assert r.json()["details"] == {"outcome": "refused", "state": "forbidden", "wiskey_code": "unauthorized"}
    r = c.post("/api/v1/intercom/stations/entry-c/call", json=env(command="answer"), headers=as_user("sam"))
    assert r.status_code == 502 and r.json()["details"]["wiskey_code"] == "device_busy" and r.json()["details"]["outcome"] == "refused"
    r = c.post("/api/v1/intercom/stations/entry-a/tts", json=env(engine_id="tts.piper", message="hi"), headers=as_user("sam"))
    assert r.status_code == 429 and r.json()["code"] == "intercom_rate_limited" and r.json()["details"]["outcome"] == "refused"
    body = c.get("/api/v1/intercom/tts/engines", headers=as_user("sam")).json()
    assert (body["state"], body["last_error"], body["tts"]) == ("unsupported", "unknown_command", None)
    assert [(r["reason"], r["details"]["outcome"]) for r in audit_rows(s, "intercom.release", "outcome")] == [("unauthorized", "refused")]
    assert audit_rows(s, "intercom.call", "outcome")[0]["details"]["error"] == "intercom_action_refused"
    assert intercom_sync.STATE.state == "ready" and len(fakes) == 1
    # a refused release frees its relay at once: WisKey said no, so nothing is ambiguous
    assert release(c).status_code == 502, "a second attempt right away is allowed (and refused by WisKey again)"


def test_release_of_an_offline_station_is_refused(feed):
    offline_lock = {**copy.deepcopy(STATION), "online": False, "call_state": "unavailable"}
    app, fakes, c = actions_feed(feed, lambda msg: None, overview={**copy.deepcopy(OVERVIEW), "stations": [offline_lock]})
    r = release(c)
    assert r.status_code == 409 and r.json()["code"] == "intercom_station_offline"
    assert not sent(fakes, "stations/test_unlock")


def test_call_signal_round_trip_and_audit(feed):
    """Answer / reject / hang up: WisKey's exact shape ({station_id, command, api_contract: 1}), its CallResult served
    as sent (acknowledgement, observed state, physical_result "unverified"), audited under the real caller."""
    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == "hikvision_intercom/media/signal":
            return [ok(msg, {**SIGNAL_RESULT, "command": msg["command"], "device_serial": "must not leave"})]
        return None

    app, fakes, c = actions_feed(feed, answer)
    s = feed[1]
    body = c.post("/api/v1/intercom/stations/entry-c/call", json=env(command="answer"), headers=as_user("sam")).json()
    assert body["state"] == "ready" and body["call"] == SIGNAL_RESULT and body["command_id"]
    [msg] = sent(fakes, "media/signal")
    assert msg == {"id": msg["id"], "type": "hikvision_intercom/media/signal", "station_id": "entry-c", "command": "answer", "api_contract": 1}
    assert c.post("/api/v1/intercom/stations/entry-c/call", json=env(command="hangUp"), headers=as_user("sam")).json()["call"]["command"] == "hangUp"
    for bad in (env(command="open"), env(command="HANGUP"), env()):
        r = c.post("/api/v1/intercom/stations/entry-c/call", json=bad, headers=as_user("sam"))
        assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent", bad
    assert c.post("/api/v1/intercom/stations/entry-b/call", json=env(command="reject"), headers=as_user("sam")).json()["code"] == "intercom_station_offline"
    assert len(sent(fakes, "media/signal")) == 2
    outcomes = audit_rows(s, "intercom.call", "outcome")
    assert [(r["actor_username"], r["details"]["signal"], r["details"]["outcome"]) for r in outcomes] == [("sam", "answer", "ok"), ("sam", "hangUp", "ok")]
    assert outcomes[0]["details"]["result"]["acknowledged"] is True and outcomes[0]["details"]["station_name"] == "Loading dock"
    assert [r["reason"] for r in audit_rows(s, "intercom.call", "refused")] == ["validation", "validation", "validation", "intercom_station_offline"]


def test_tts_engines_and_announcement_lifecycle(feed):
    """TTS: the engines list (exact key set, no api_contract), then an announcement - sent with WisKey's exact key set
    and the message collapsed as WisKey collapses it - followed through its subscription events (the first one racing
    the result frame), relayed as `intercom_tts` notices, released with `unsubscribe_events` only after the terminal
    event, and audited with the text that was spoken."""
    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == "hikvision_intercom/tts/engines":
            return [ok(msg, copy.deepcopy(TTS_ENGINES))]
        if msg["type"] == "hikvision_intercom/tts/start":
            fmt = {"format": "hikvision_intercom.tts"}
            return [
                ok(msg),
                {"id": msg["id"], "type": "event", "event": {**fmt, "state": "generating"}},
                {"id": msg["id"], "type": "event", "event": {**fmt, "state": "speaking", "duration_seconds": 2.1, "packet_count": 21}},
                {"id": msg["id"], "type": "event", "event": {**fmt, "state": "completed", "duration_seconds": 2.1, "bytes_written": 16800, "physical_result": "unverified"}},
            ]
        return None

    app, fakes, c = actions_feed(feed, answer)
    s = feed[1]
    body = c.get("/api/v1/intercom/tts/engines", headers=as_user("sam")).json()
    assert body["state"] == "ready" and body["tts"]["default"] == "tts.piper"
    assert [e["engine_id"] for e in body["tts"]["engines"]] == ["tts.piper", "tts.google_translate_en_com"], "an engine without an id is dropped"
    [msg] = sent(fakes, "tts/engines")
    assert set(msg) == {"id", "type"}, "exact key set: no api_contract"

    q = intercom_sync.subscribe()
    try:
        r = c.post("/api/v1/intercom/stations/entry-a/tts", json=env(engine_id="tts.piper", language="he", message="  נא   להמתין\nליד השער  "), headers=as_user("sam"))
        assert r.status_code == 200, r.text
        assert r.json()["tts"]["station_id"] == "entry-a" and r.json()["tts"]["state"] in ("started", "generating", "speaking", "completed")
        [start] = sent(fakes, "tts/start")
        assert start == {"id": start["id"], "type": "hikvision_intercom/tts/start", "station_id": "entry-a", "engine_id": "tts.piper", "language": "he", "message": "נא להמתין ליד השער"}
        wait_for(lambda: (intercom_sync.SYNC.tts_status("entry-a") or {}).get("state") == "completed")
        wait_for(lambda: any(m.get("type") == "unsubscribe_events" for m in fakes[0].sent))
        unsub = [m for m in fakes[0].sent if m.get("type") == "unsubscribe_events" and m.get("subscription") == start["id"]]
        assert len(unsub) == 1, "the subscription is released after the terminal event, and only then"
        states = []
        while not q.empty():
            m = q.get_nowait()
            if m["type"] == "intercom_tts":
                states.append(m["state"])
                last = m
        assert states == ["started", "generating", "speaking", "completed"], states
        assert last["physical_result"] == "unverified" and last["station_id"] == "entry-a"
        assert "message" not in last and "נא" not in json.dumps(last), "the notices carry progress, never the text"
    finally:
        intercom_sync.unsubscribe(q)
    for row in audit_rows(s, "intercom.tts", "attempt") + audit_rows(s, "intercom.tts", "outcome"):
        assert (row["actor_username"], row["resource_id"]) == ("sam", "entry-a")
        assert row["details"]["message"] == "נא להמתין ליד השער" and row["details"]["engine_id"] == "tts.piper" and row["details"]["language"] == "he"
    assert audit_rows(s, "intercom.tts", "outcome")[0]["details"]["outcome"] == "ok"

    # validation before anything is sent - and audited, with the text that was NOT spoken
    for bad in (env(engine_id="tts.piper", message="   "), env(engine_id="tts.piper", message="x" * 501), env(engine_id="", message="hi")):
        r = c.post("/api/v1/intercom/stations/entry-a/tts", json=bad, headers=as_user("sam"))
        assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent", bad
    assert c.post("/api/v1/intercom/stations/entry-b/tts", json=env(engine_id="tts.piper", message="hi"), headers=as_user("sam")).json()["code"] == "intercom_station_offline"
    refused = audit_rows(s, "intercom.tts", "refused")
    assert len(refused) == 4 and refused[-1]["details"]["message"] == "hi"
    assert len(sent(fakes, "tts/start")) == 1


def test_tts_cut_by_a_lost_connection_is_reported_closed(feed):
    """HA drops a connection's subscriptions with it, which cancels the playback: the announcement is reported
    `closed` / `connection_lost`, never left "speaking"."""
    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == "hikvision_intercom/tts/start":
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"state": "speaking"}}, CLOSE]
        return None

    app, fakes, c = actions_feed(feed, answer, refuse_after=1)
    r = c.post("/api/v1/intercom/stations/entry-a/tts", json=env(engine_id="tts.piper", language=None, message="hello"), headers=as_user("sam"))
    assert r.status_code == 200
    wait_for(lambda: (intercom_sync.SYNC.tts_status("entry-a") or {}).get("state") == "closed")
    assert intercom_sync.SYNC.tts_status("entry-a")["reason"] == "connection_lost"


def test_a_refresh_failure_during_an_announcement_does_not_cut_it(feed, monkeypatch):
    """S6: an overview refetch that WisKey answers with an error while an announcement is playing keeps the session
    (the copy is served as not fresh) until the announcement ends; after that the same failure ends the session as
    before."""
    monkeypatch.setattr(intercom_sync, "DEFER_RETRY_S", 0.2)
    calls = {"overview": 0}
    held: dict[str, Any] = {}

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        kind = msg["type"]
        if kind == "hikvision_intercom/overview":
            calls["overview"] += 1
            if calls["overview"] >= 2:
                return [fail(msg, "home_assistant_error")]
            return [ok(msg, copy.deepcopy(ACTIONS_OVERVIEW))]
        if kind == "hikvision_intercom/subscribe":
            held["wiskey"] = (msg["id"], fake)
            return [ok(msg)]
        if kind == "hikvision_intercom/tts/start":
            held["tts"] = (msg["id"], fake)
            return [ok(msg), {"id": msg["id"], "type": "event", "event": {"state": "speaking"}}]
        return normal(msg, fake, ACTIONS_OVERVIEW)

    app, s, install = feed
    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    c = TestClient(app)
    bind(c, s, "sam", "site_admin", "installation", "*")
    assert c.post("/api/v1/intercom/stations/entry-a/tts", json=env(engine_id="tts.piper", message="hello"), headers=as_user("sam")).status_code == 200
    wait_for(lambda: (intercom_sync.SYNC.tts_status("entry-a") or {}).get("state") == "speaking")
    loop = intercom_sync.SYNC._event_loop
    sub, fake = held["wiskey"]
    loop.call_soon_threadsafe(fake.q.put_nowait, {"id": sub, "type": "event", "event": {"kind": "refresh"}})  # -> a failing refetch
    wait_for(lambda: calls["overview"] >= 3, timeout=5)  # failed, deferred, retried (and failed again)
    assert intercom_sync.STATE.state == "ready" and len(fakes) == 1, "the session - and the announcement - survived"
    assert intercom_sync.SYNC.tts_status("entry-a")["state"] == "speaking"
    assert c.get("/api/v1/intercom/overview").json()["fresh"] is False, "the copy is not served as current meanwhile"
    tts_id, _ = held["tts"]
    loop.call_soon_threadsafe(fake.q.put_nowait, {"id": tts_id, "type": "event", "event": {"state": "completed", "physical_result": "unverified"}})
    wait_for(lambda: intercom_sync.SYNC.tts_status("entry-a")["state"] == "completed")
    wait_for(lambda: intercom_sync.STATE.state == "error", timeout=5)  # announcement over: the next failure ends the session
    assert intercom_sync.STATE.last_error == "home_assistant_error"


def test_physical_actions_without_home_assistant_are_not_sent_and_audited(settings):
    """The dev backend has no Home Assistant: every action is a 503 `intercom_unavailable` saying it was NOT sent
    (never a 200 with a state field that could be read as done), audited as an attempt with outcome not_sent; the
    engines list is the read shape, with the honest state."""
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(settings)
    access_control.RELAYS.clear()
    c = TestClient(create_app(settings))
    for method, path, body in action_paths():
        r = c.request(method, path, json=body)
        if method == "get":
            assert r.status_code == 200 and r.json()["state"] == "ha_not_configured" and r.json()["tts"] is None
            continue
        assert r.status_code == 503, path
        err = r.json()
        assert err["code"] == "intercom_unavailable" and err["details"]["outcome"] == "not_sent" and err["details"]["state"] == "ha_not_configured", path
        assert "לא נשלחה" in err["user_message"]
    for action in ("intercom.release", "intercom.call", "intercom.tts"):
        assert len(audit_rows(settings, action, "attempt")) == 1, action
        [row] = audit_rows(settings, action, "outcome")
        assert row["actor_username"] == "joni" and row["details"]["outcome"] == "not_sent" and row["reason"] == "ha_not_configured", action
    intercom_sync.SYNC.reset()


def test_physical_actions_in_degraded_feed_states(feed):
    """not installed / HA unavailable: the action is not sent (503, outcome not_sent) and opens no connection."""
    app, s, install = feed

    def absent(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        return [ha_config(msg)] if msg["type"] == "get_config" else [fail(msg, "unknown_command")]

    fakes = install(absent)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "not_installed")
    c = TestClient(app)
    for method, path, body in action_paths():
        r = c.request(method, path, json=body)
        if method == "get":
            assert r.json()["state"] == "not_installed" and r.json()["tts"] is None
            continue
        assert r.status_code == 503 and r.json()["details"] == {"outcome": "not_sent", "state": "not_installed", "wiskey_code": "unknown_command"}, path
    assert fakes[0].types() == ["auth", "hikvision_intercom/overview", "get_config"] and len(fakes) == 1


def test_physical_actions_when_ha_is_unavailable(feed):
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        frames = normal(msg, fake)
        return frames + [CLOSE] if msg["type"] == "hikvision_intercom/subscribe" else frames

    fakes = install(script, refuse_after=1)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: install.refused["n"] >= 2 and intercom_sync.STATE.state == "ha_unavailable")
    c = TestClient(app)
    r = c.post("/api/v1/intercom/stations/entry-a/release", json=env(confirmed=True))
    assert r.status_code == 503 and r.json()["details"]["state"] == "ha_unavailable" and r.json()["details"]["outcome"] == "not_sent"
    assert "תשתית המערכת אינה זמינה" in r.json()["user_message"]
    assert not sent(fakes, "stations/test_unlock")


def test_rate_limit_and_busy_refuse_physical_actions_loudly(feed, monkeypatch):
    """The action lane's own protections - and a dropped action is a 429 that says it was NOT sent, never a silently
    swallowed request. A refusal that was never sent frees the relay at once."""
    monkeypatch.setattr(intercom_sync, "ACTION_USER_BURST", 1.0)
    monkeypatch.setattr(intercom_sync, "ACTION_USER_RATE", 0.0)
    app, fakes, c = actions_feed(feed, accept_unlock)
    intercom_sync.SYNC._buckets_reset()
    assert release(c).status_code == 200
    r = release(c)
    assert r.status_code == 429 and r.json()["code"] == "intercom_rate_limited"
    assert r.json()["details"]["outcome"] == "not_sent" and r.json()["retryable"] is True and "לא נשלחה" in r.json()["user_message"]
    assert len(sent(fakes, "stations/test_unlock")) == 1, "the refused one never reached WisKey"
    assert audit_rows(feed[1], "intercom.release", "outcome")[-1]["details"]["outcome"] == "not_sent"
    assert release(c, user="joni").status_code == 200, "another caller's own bucket; and the rate refusal freed the relay"

    slot = intercom_sync.SYNC._action_inflight = threading.BoundedSemaphore(1)
    assert slot.acquire(blocking=False)
    try:
        r = c.post("/api/v1/intercom/stations/entry-c/call", json=env(command="answer"), headers=as_user("joni"))
        assert r.status_code == 429 and r.json()["code"] == "intercom_busy" and r.json()["details"]["outcome"] == "not_sent"
    finally:
        slot.release()


def test_read_traffic_cannot_starve_physical_actions(feed, monkeypatch):
    """S5: with every read slot taken and the read buckets empty - a heavy people search, say - a release still goes
    through on the action lane."""
    monkeypatch.setattr(intercom_sync, "GLOBAL_BURST", 1.0)
    monkeypatch.setattr(intercom_sync, "GLOBAL_RATE", 0.0)
    app, fakes, c = actions_feed(feed, accept_unlock)
    intercom_sync.SYNC._buckets_reset()
    assert c.get("/api/v1/intercom/people/u1").json()["state"] in ("ready", "error")  # spends the only read token
    assert c.get("/api/v1/intercom/people/u1", headers=as_user("vera")).json()["last_error"] == "rate_limited", "reads are exhausted"
    reads = intercom_sync.SYNC._inflight = threading.BoundedSemaphore(1)
    assert reads.acquire(blocking=False)
    try:
        assert c.get("/api/v1/intercom/people/u1", headers=as_user("vera")).json()["last_error"] == "busy", "and every read slot is taken"
        r = release(c)
        assert r.status_code == 200 and r.json()["release"] == {"accepted": True}
    finally:
        reads.release()


def test_unanswered_action_is_outcome_unknown_and_not_retried(feed, monkeypatch):
    """No answer within ACTION_TIMEOUT_S, or the session lost mid-request: 504 `intercom_outcome_unknown` - it may or
    may not have happened - and the command was sent exactly once."""
    monkeypatch.setattr(intercom_sync, "ACTION_TIMEOUT_S", 0.3)
    app, fakes, c = actions_feed(feed, lambda msg: [] if msg["type"] == UNLOCK else None)
    r = release(c)
    assert r.status_code == 504 and r.json()["code"] == "intercom_outcome_unknown"
    details = r.json()["details"]
    assert {k: details[k] for k in ("outcome", "state", "wiskey_code")} == {"outcome": "unknown", "state": "error", "wiskey_code": "timeout"}
    # still unanswered: the relay stays held for the rest of ha_client's 60 s limit plus the 10 s hold
    assert access_control.CALL_LIMIT_S < details["retry_after_s"] <= access_control.CALL_LIMIT_S + access_control.UNKNOWN_HOLD_S
    assert "ייתכן שבוצעה וייתכן שלא" in r.json()["user_message"]
    assert len(sent(fakes, "stations/test_unlock")) == 1, "never retried"
    assert audit_rows(feed[1], "intercom.release", "outcome")[0]["details"]["outcome"] == "unknown"


def test_session_lost_mid_action_is_outcome_unknown(feed):
    app, fakes, c = actions_feed(feed, lambda msg: [CLOSE] if msg["type"] == "hikvision_intercom/media/signal" else None, refuse_after=1)
    r = c.post("/api/v1/intercom/stations/entry-c/call", json=env(command="reject"), headers=as_user("sam"))
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown" and r.json()["details"]["state"] == "ha_unavailable"
    assert len(sent(fakes, "media/signal")) == 1


def test_a_second_release_of_the_same_relay_is_refused_while_the_first_is_out(feed, monkeypatch):
    """Never queued: while a release of a relay waits for WisKey, another release of that relay is a 409."""
    monkeypatch.setattr(intercom_sync, "ACTION_TIMEOUT_S", 1.5)
    app, fakes, c = actions_feed(feed, lambda msg: [] if msg["type"] == UNLOCK else None)
    results: list[int] = []
    first = threading.Thread(target=lambda: results.append(release(c).status_code))
    first.start()
    wait_for(lambda: len(sent(fakes, "stations/test_unlock")) == 1)
    r = release(c, user="joni")
    assert r.status_code == 409 and r.json()["code"] == "intercom_release_in_progress"
    first.join(timeout=5)
    assert results == [504] and len(sent(fakes, "stations/test_unlock")) == 1


def test_after_a_timeout_the_relay_stays_held_until_wiskey_answers_and_a_little_longer(feed, monkeypatch):
    """S1: the HTTP request gives up at ACTION_TIMEOUT_S with "outcome unknown", but WisKey's handler is still running.
    The relay stays busy until WisKey's own answer arrives, and UNKNOWN_HOLD_S longer - a guard pressing release again
    straight after the 504 gets a 409 and no second frame is sent. Then a legitimate next release goes through."""
    monkeypatch.setattr(intercom_sync, "ACTION_TIMEOUT_S", 0.3)
    monkeypatch.setattr(access_control, "UNKNOWN_HOLD_S", 0.6)
    held: list[tuple[dict[str, Any], FakeHa]] = []

    def script_answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == UNLOCK:
            if not held:
                held.append((msg, None))
                return []  # the first release: no answer yet
            return [ok(msg, {"accepted": True})]
        return None

    app, fakes, c = actions_feed(feed, script_answer)
    assert release(c).status_code == 504
    r = release(c)
    assert r.status_code == 409 and r.json()["code"] == "intercom_release_in_progress" and r.json()["details"]["outcome"] == "not_sent"
    assert len(sent(fakes, "stations/test_unlock")) == 1, "no second frame while the first is unresolved"
    msg = held[0][0]
    fake = fakes[0]
    intercom_sync.SYNC._event_loop.call_soon_threadsafe(fake.q.put_nowait, ok(msg, {"accepted": True}))  # WisKey's late answer
    time.sleep(0.2)
    assert release(c).status_code == 409, "answered, but the unknown outcome's hold is still running"
    time.sleep(0.6)
    r = release(c)
    assert r.status_code == 200, "the hold is over: a deliberate next release goes through"
    assert len(sent(fakes, "stations/test_unlock")) == 2


def test_after_a_refusal_or_not_sent_the_relay_is_free_at_once(feed):
    """S1, the other side: when WisKey refused, or nothing was sent, nothing is ambiguous - the next release is not held."""
    answers = iter(["release_in_progress", None])  # a genuine pre-device refusal for a release

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == UNLOCK:
            code = next(answers)
            return [fail(msg, code)] if code else [ok(msg, {"accepted": True})]
        return None

    app, fakes, c = actions_feed(feed, answer)
    assert release(c).status_code == 502
    assert release(c).status_code == 200


def test_command_envelope_expiry_and_duplicates(feed, monkeypatch):
    """S2: a stale request is refused, a request whose expiry is too far ahead is refused, a replay of a command id
    that was already handed on is refused - and the expiry is checked again right before the frame is written: a
    command that reaches that point too late is not sent."""
    app, fakes, c = actions_feed(feed, accept_unlock)
    s = feed[1]
    body = env(confirmed=True)
    assert c.post("/api/v1/intercom/stations/entry-a/release", json=body, headers=as_user("sam")).status_code == 200
    r = c.post("/api/v1/intercom/stations/entry-a/release", json=body, headers=as_user("sam"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_duplicate_command"
    assert c.post("/api/v1/intercom/stations/entry-a/release", json=body, headers=as_user("joni")).status_code == 200, "ids are per caller"
    assert c.post("/api/v1/intercom/stations/entry-a/release", json=env(ttl=-1, confirmed=True), headers=as_user("sam")).json()["code"] == "expired"
    assert c.post("/api/v1/intercom/stations/entry-a/release", json=env(ttl=120, confirmed=True), headers=as_user("sam")).json()["code"] == "expires_too_far"
    for bad in ({"client_request_id": "short", "expires_at": env()["expires_at"]}, {"client_request_id": "a%b_c" * 3, "expires_at": env()["expires_at"]}, {"client_request_id": str(uuid.uuid4()), "expires_at": "2026-09-27T08:00:00"}):
        assert c.post("/api/v1/intercom/stations/entry-a/release", json={**bad, "confirmed": True}, headers=as_user("sam")).status_code == 422, bad
    assert len(sent(fakes, "stations/test_unlock")) == 2

    # the send-time check: the command is handed over, but by the time it reaches the feed's loop it is too late
    monkeypatch.setattr(access_control, "SEND_WITHIN_S", -1.0)  # deterministic: the deadline is already in the past
    r = release(c, user="joni")
    assert r.status_code == 409 and r.json()["code"] == "expired" and r.json()["details"]["outcome"] == "not_sent"
    assert len(sent(fakes, "stations/test_unlock")) == 2, "not sent"
    assert audit_rows(s, "intercom.release", "outcome")[-1]["details"]["outcome"] == "not_sent"
    monkeypatch.setattr(access_control, "SEND_WITHIN_S", 15.0)
    assert release(c, user="joni").status_code == 200, "and it did not hold the relay"


def test_physical_client_wrappers_send_wiskeys_exact_shapes():
    """The client layer on its own: api_contract only where WisKey's panel sends it, strict relay typing, no call
    command outside WisKey's three, tts/start's `language` key present even when null - and after `success: true` the
    result is returned as it came (the caller's projection judges it), while only `success: false` raises."""
    from smplwise.services import intercom_client

    seen: list[dict[str, Any]] = []
    replies: dict[str, dict[str, Any]] = {}

    async def call(msg_type: str, **kw: Any) -> dict[str, Any]:
        seen.append({"type": msg_type, **kw})
        return replies.get(msg_type, {"id": 9, "success": True, "result": None})

    replies[UNLOCK] = {"id": 8, "success": True, "result": "odd"}
    assert asyncio.run(intercom_client.release_door(call, "entry-a", 2)) == "odd", "no shape judgement after success: true"
    assert asyncio.run(intercom_client.tts_start(call, "entry-a", "tts.piper", None, "hi")) == 9
    assert seen == [
        {"type": UNLOCK, "station_id": "entry-a", "lock": 2, "api_contract": 1},
        {"type": "hikvision_intercom/tts/start", "station_id": "entry-a", "engine_id": "tts.piper", "language": None, "message": "hi"},
    ]
    replies[UNLOCK] = {"id": 8, "success": False, "error": {"code": "release_in_progress"}}  # pre-device: a refusal
    with pytest.raises(intercom_client.IntercomError) as exc:
        asyncio.run(intercom_client.release_door(call, "entry-a", 1))
    assert exc.value.code == "release_in_progress"
    for code in ("release_unconfirmed", "action_failed", "device_busy"):  # may have reached the device: not a refusal
        replies[UNLOCK] = {"id": 8, "success": False, "error": {"code": code}}
        with pytest.raises(intercom_client.UnclearAnswer) as unclear:
            asyncio.run(intercom_client.release_door(call, "entry-a", 1))
        assert unclear.value.code == code
    replies[UNLOCK] = {"id": 8, "type": "result"}
    with pytest.raises(intercom_client.UnclearAnswer):
        asyncio.run(intercom_client.release_door(call, "entry-a", 1))
    n = len(seen)
    for bad in (lambda: intercom_client.release_door(call, "entry-a", True), lambda: intercom_client.media_signal(call, "entry-a", "open")):
        with pytest.raises(intercom_client.IntercomError) as exc:
            asyncio.run(bad())
        assert exc.value.code == "invalid_fields"
    assert len(seen) == n, "refused locally, nothing sent"
    assert intercom_client.collapse("  a \n\t b  ") == "a b"


# ---------------------------------------------------------------- final review round (B-1, S-1..S-3, nits)

from smplwise.services import intercom_client  # noqa: E402

COMMON_REFUSED = {"unauthorized": 502, "invalid_fields": 422, "api_incompatible": 502, "request_too_large": 502, "rate_limited": 429, "unknown_command": 502}
# per command: pre-device codes (refused) and codes that can come after the command reached the device (unknown)
CLASSIFICATION = {
    "stations/test_unlock": {
        "refused": {**COMMON_REFUSED, "station_offline": 502, "connection_closed": 502, "lock_not_managed": 502, "release_in_progress": 502},
        "unknown": ["release_unconfirmed", "action_failed", "device_unavailable", "device_busy", "home_assistant_error", "unknown_error", "timeout", "a_code_nobody_documented", ""],
    },
    "media/signal": {
        "refused": {**COMMON_REFUSED, "device_busy": 502},
        # station_unloaded: not provably pre-device for media/signal (final confirmation S-1), so unknown
        "unknown": ["station_unloaded", "device_unavailable", "action_failed", "home_assistant_error", "unknown_error", "timeout", "release_unconfirmed", "a_code_nobody_documented"],
    },
    "tts/start": {
        "refused": {**COMMON_REFUSED, "tts_invalid_message": 502, "tts_engine_unavailable": 502, "station_unloaded": 502, "audio_busy": 502},
        "unknown": ["action_failed", "home_assistant_error", "unknown_error", "timeout", "device_unavailable", "a_code_nobody_documented"],
    },
}
ENDPOINTS = {
    "stations/test_unlock": ("intercom.release", "/api/v1/intercom/stations/entry-a/release", lambda: env(confirmed=True)),
    "media/signal": ("intercom.call", "/api/v1/intercom/stations/entry-c/call", lambda: env(command="answer")),
    "tts/start": ("intercom.tts", "/api/v1/intercom/stations/entry-a/tts", lambda: env(engine_id="tts.piper", message="hello")),
}


@pytest.mark.parametrize("command", list(CLASSIFICATION))
def test_wiskey_failure_codes_are_refused_only_when_pre_device(feed, monkeypatch, command):
    """Final review B-1: a `success: false` is "refused, not carried out" ONLY for the command's pre-device allow-list
    (intercom_client.PRE_DISPATCH + PRE_DEVICE). Every other code - `release_unconfirmed` (the device call errored
    after the open may have reached the device, or the runtime closed AFTER a successful open), `action_failed`,
    `device_unavailable` for a call, Home Assistant's own errors, and any undocumented code - is "outcome unknown"
    (504), audited as unknown, and for a release holds the relay. Each code is checked end to end, including the
    audit's outcome (S-2: an explicit `invalid_fields` refusal is audited `refused`, not `unknown`)."""
    monkeypatch.setattr(intercom_sync, "ACTION_USER_BURST", 1000.0)
    monkeypatch.setattr(intercom_sync, "ACTION_GLOBAL_BURST", 1000.0)
    current = {"code": ""}

    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] == f"hikvision_intercom/{command}":
            return [fail(msg, current["code"])]
        return None

    app, fakes, c = actions_feed(feed, answer)
    intercom_sync.SYNC._buckets_reset()
    action, path, body = ENDPOINTS[command]
    s = feed[1]
    table = CLASSIFICATION[command]
    for code, status in table["refused"].items():
        access_control.RELAYS.clear()
        current["code"] = code
        r = c.post(path, json=body(), headers=as_user("sam"))
        assert r.status_code == status and r.json()["details"]["outcome"] == "refused", (command, code, r.text)
        assert r.json()["details"]["wiskey_code"] == code
        assert audit_rows(s, action, "outcome")[-1]["details"]["outcome"] == "refused", (command, code)
        assert intercom_client.refusal_is_pre_device(command, code)
    for code in table["unknown"]:
        access_control.RELAYS.clear()
        current["code"] = code
        r = c.post(path, json=body(), headers=as_user("sam"))
        assert r.status_code == 504 and r.json()["code"] == "intercom_outcome_unknown", (command, code, r.text)
        assert r.json()["details"]["outcome"] == "unknown" and r.json()["details"]["wiskey_code"] == (code or "action_failed"), (command, code)
        assert "ייתכן שבוצעה וייתכן שלא" in r.json()["user_message"] and "לא בוצעה." not in r.json()["user_message"]
        row = audit_rows(s, action, "outcome")[-1]
        assert row["details"]["outcome"] == "unknown" and row["details"]["outcome"] != "refused", (command, code)
        if command == "stations/test_unlock":
            again = c.post(path, json=body(), headers=as_user("sam"))
            assert again.status_code == 409 and again.json()["code"] == "intercom_release_in_progress", f"{code}: the relay is held"
            assert again.json()["details"]["retry_after_s"] > 0
            assert r.json()["details"]["retry_after_s"] > 0, "the caller is told how long the relay stays held"
    expected = len(table["refused"]) + len(table["unknown"])
    assert len(sent(fakes, command)) == expected, "each attempt was sent once; no held relay let a second frame through"
    assert intercom_sync.STATE.state == "ready"


def test_release_unconfirmed_twice_can_never_become_three_frames(feed):
    """The reviewer's probe, pinned: WisKey answers `release_unconfirmed` (the door may have opened). A second press
    straight away must not send a second frame - the relay is held."""
    def answer(msg: dict[str, Any]) -> list[Any] | None:
        return [fail(msg, "release_unconfirmed")] if msg["type"] == UNLOCK else None

    app, fakes, c = actions_feed(feed, answer)
    first = release(c)
    assert first.status_code == 504 and first.json()["details"]["outcome"] == "unknown"
    for _ in range(2):
        r = release(c)
        assert r.status_code == 409 and r.json()["code"] == "intercom_release_in_progress"
    assert len(sent(fakes, "stations/test_unlock")) == 1
    assert [row["details"]["outcome"] for row in audit_rows(feed[1], "intercom.release", "outcome")] == ["unknown"]


def test_send_time_expiry_is_deterministic(feed, monkeypatch):
    """Final review S-1: the deadline check is `>=` and does not depend on the wall clock's resolution (Windows ticks
    in ~15.6 ms steps). A deadline equal to "now" is expired; the send-time check is exercised many times in a row."""
    import datetime as dt

    frozen = dt.datetime(2026, 9, 28, 8, 0, 0, tzinfo=dt.timezone.utc)

    class FrozenClock(dt.datetime):
        @classmethod
        def now(cls, tz: Any = None) -> "dt.datetime":
            return frozen

    app, fakes, c = actions_feed(feed, accept_unlock)
    # a context of its own: undoing it reverts ONLY the frozen clock, never the `feed` fixture's own patches
    # (websockets.connect, RETRY_S ...) that share the test's monkeypatch (T054 final confirmation S-2)
    with monkeypatch.context() as m:
        m.setattr(intercom_sync.datetime, "datetime", FrozenClock)
        loop = intercom_sync.SYNC._event_loop
        for _ in range(20):
            coro = intercom_sync.SYNC._one_off(lambda call: asyncio.sleep(0, result="sent"), not_after=frozen)
            with pytest.raises(intercom_sync._Expired):
                asyncio.run_coroutine_threadsafe(coro, loop).result(timeout=5)
        coro = intercom_sync.SYNC._one_off(lambda call: asyncio.sleep(0, result="sent"), not_after=frozen + dt.timedelta(microseconds=1))
        assert asyncio.run_coroutine_threadsafe(coro, loop).result(timeout=5) == "sent"
    import websockets

    assert websockets.connect is not None and intercom_sync.RETRY_S == 0.05, "the feed fixture's patches are intact"
    assert intercom_sync.datetime.datetime is dt.datetime, "and the clock is real again"
    monkeypatch.setattr(access_control, "SEND_WITHIN_S", -1.0)
    for _ in range(5):
        r = release(c, user="joni")
        assert r.status_code == 409 and r.json()["code"] == "expired" and r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fakes, "stations/test_unlock")


def test_overview_carries_the_server_clock(settings):
    """Final review S-3: the UI derives `expires_at` from the server's clock, so the overview says what it is."""
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(settings)
    body = TestClient(create_app(settings)).get("/api/v1/intercom/overview").json()
    assert abs(body["server_time_ms"] - time.time() * 1000) < 5000
    intercom_sync.SYNC.reset()


def test_malformed_requests_are_audited_and_permission_comes_first(feed):
    """Nit: a body that is not JSON, and a station id over 128 characters, are audited refusals for a caller with
    access.release - and a 403 (never a 422) for a caller without it, whatever they sent."""
    app, fakes, c = actions_feed(feed, accept_unlock)
    s = feed[1]
    long_id = "x" * 200
    for user, status in (("vera", 403), ("sam", 422)):
        r = c.post("/api/v1/intercom/stations/entry-a/release", content=b"{not json", headers={**as_user(user), "Content-Type": "application/json"})
        assert r.status_code == status, (user, r.text)
        r = c.post(f"/api/v1/intercom/stations/{long_id}/release", json=env(confirmed=True), headers=as_user(user))
        assert r.status_code == status, (user, r.text)
        r = c.post("/api/v1/intercom/stations/entry-a/tts", content=b"hello", headers={**as_user(user), "Content-Type": "text/plain"})
        assert r.status_code == (403 if user == "vera" else 415), (user, r.text)
    refused = audit_rows(s, "intercom.release", "refused")
    assert [(row["reason"], row["details"]["outcome"], len(row["resource_id"])) for row in refused] == [("validation", "not_sent", 7), ("validation", "not_sent", 128)]
    assert audit_rows(s, "intercom.tts", "refused")[0]["reason"] == "unsupported_media_type"
    assert not sent(fakes, "stations/test_unlock") and not sent(fakes, "tts/start")


@pytest.mark.parametrize("content_type", ["text/plain", "text/plain;charset=UTF-8", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x", None])
def test_only_json_content_types_reach_a_door(feed, content_type):
    """Final confirmation B-1: a perfectly valid release / call / announcement payload sent as `text/plain` or a form
    body - CORS "simple requests" a browser sends cross-site without a preflight - or with no Content-Type at all, is a
    415 audited refusal and never reaches WisKey. `application/json` (with a charset) and `+json` subtypes are read."""
    app, fakes, c = actions_feed(feed, accept_unlock)
    s = feed[1]
    headers = {**as_user("sam"), **({"Content-Type": content_type} if content_type else {})}
    for path, body, action in (
        ("/api/v1/intercom/stations/entry-a/release", env(confirmed=True), "intercom.release"),
        ("/api/v1/intercom/stations/entry-c/call", env(command="answer"), "intercom.call"),
        ("/api/v1/intercom/stations/entry-a/tts", env(engine_id="tts.piper", message="hello"), "intercom.tts"),
    ):
        r = c.post(path, content=json.dumps(body).encode("utf-8"), headers=headers)
        assert r.status_code == 415 and r.json()["code"] == "unsupported_media_type", (content_type, path, r.text)
        assert r.json()["details"]["outcome"] == "not_sent"
        [row] = audit_rows(s, action, "refused")
        assert (row["reason"], row["actor_username"], row["decision"]) == ("unsupported_media_type", "sam", "denied")
    assert not sent(fakes, "stations/test_unlock") and not sent(fakes, "media/signal") and not sent(fakes, "tts/start"), "nothing reached WisKey"
    assert c.post("/api/v1/intercom/stations/entry-a/release", content=json.dumps(env(confirmed=True)), headers={**as_user("vera"), **({"Content-Type": content_type} if content_type else {})}).status_code == 403, "permission first"


def test_json_content_types_are_accepted(feed):
    app, fakes, c = actions_feed(feed, accept_unlock)
    for content_type in ("application/json", "application/json; charset=utf-8", "Application/JSON", "application/merge-patch+json"):
        access_control.RELAYS.clear()
        r = c.post("/api/v1/intercom/stations/entry-a/release", content=json.dumps(env(confirmed=True)), headers={**as_user("sam"), "Content-Type": content_type})
        assert r.status_code == 200, (content_type, r.text)
    assert len(sent(fakes, "stations/test_unlock")) == 4


def test_a_deeply_nested_body_is_an_audited_refusal_not_a_500(feed):
    """N-1: json.loads raises RecursionError (not ValueError) on a pathologically nested body."""
    app, fakes, c = actions_feed(feed, accept_unlock)
    deep = b"[" * 100_000 + b"]" * 100_000
    r = c.post("/api/v1/intercom/stations/entry-a/release", content=deep, headers={**as_user("sam"), "Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent", r.text
    [row] = audit_rows(feed[1], "intercom.release", "refused")
    assert row["reason"] == "validation"
    assert not sent(fakes, "stations/test_unlock")


def test_camera_entity_is_kept_only_as_a_well_formed_camera_id():
    """The projection keeps the camera's HA entity id next to `has_camera` (owner report 2026-09-28: the entry center
    must be able to show each station's camera); a malformed id is dropped, and none of the station's other entity ids
    is kept."""
    raw = {**copy.deepcopy(STATION), "entities": {"camera": "camera.x/../../api/states", "lock": "lock.main_gate"}}
    ov = intercom_sync.project_overview({"stations": [STATION, raw, OFFLINE]})
    assert [s["camera_entity"] for s in ov["stations"]] == ["camera.main_gate", None, None]
    assert [s["has_camera"] for s in ov["stations"]] == [True, True, False], "has_camera itself is unchanged"
    assert "lock.main_gate" not in json.dumps(ov) and "binary_sensor" not in json.dumps(ov)


# ---------------------------------------------------------------- station camera stills through go2rtc (owner rule 2026-09-28)

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60 + b"\xff\xd9"
SNAP = "/api/v1/intercom/stations/{}/camera-snapshot.jpg"
CREDS = "/api/v1/intercom/stations/{}/credentials"
GO2RTC = "http://go2rtc.test:1984"
# a camera on every kind of station the endpoint must tell apart
CAM_OVERVIEW = {
    **OVERVIEW,
    "stations": [
        STATION,  # entry-a: online, camera.main_gate, host 192.0.2.10
        {**copy.deepcopy(OFFLINE), "entities": {"camera": "camera.side_door", "online": "binary_sensor.side_door_online"}},  # entry-b: offline
        {**copy.deepcopy(STATION), "id": "entry-c", "name": "No host", "host": None},
        {**copy.deepcopy(STATION), "id": "entry-d", "name": "Bad host", "host": "http://198.51.100.1/x"},
        {**copy.deepcopy(STATION), "id": "entry-e", "name": "No camera", "entities": {"online": "binary_sensor.e_online"}},
    ],
}


@pytest.fixture()
def fake_go2rtc(monkeypatch):
    """go2rtc's HTTP API as services/go2rtc.py uses it: every httpx.Client there gets a MockTransport, so the real
    request (path, query, auth) is what the test sees. `answer` is swapped per case. Home Assistant is only the scripted
    WebSocket (FakeHa): any REST request to it would show up here and fail the test.

    Like go2rtc's GetOrPatch, `state["streams"]` holds the in-memory streams: a raw `rtsp://` src with a `name` registers
    (or re-points) that name; a bare name it does not know is a 404 (clearing it = a go2rtc restart). The process-wide
    registration map in services/go2rtc.py starts empty for every test."""
    import httpx

    from smplwise.services import go2rtc as g2

    seen: list[httpx.Request] = []
    streams: dict[str, str] = {}
    state: dict[str, Any] = {"answer": lambda req: httpx.Response(200, content=JPEG, headers={"Content-Type": "image/jpeg"}), "streams": streams}

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        src = req.url.params.get("src", "")
        if src.startswith("rtsp://"):
            streams[req.url.params.get("name") or src] = src
        elif src not in streams:
            return httpx.Response(404, text="streams: source not supported")
        return state["answer"](req)

    real = httpx.Client
    monkeypatch.setattr(g2.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(g2, "_REGISTERED", {}, raising=False)
    return seen, state


def camera_feed(feed, overview: dict[str, Any] | None = None, **settings_over: Any) -> tuple[TestClient, Any]:
    """A ready feed on CAM_OVERVIEW, and an app whose settings name go2rtc and the shared WisKey account."""
    app, s, install = feed
    install(lambda msg, fake: normal(msg, fake, overview or CAM_OVERVIEW))
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    s2 = replace(s, **{"go2rtc_url": GO2RTC, "wiskey_user": "door", "wiskey_password": "p@ss word", **settings_over})
    return TestClient(create_app(s2)), s2


def test_station_host_is_kept_server_side_only(feed):
    c, s = camera_feed(feed)
    assert intercom_sync.SYNC.station_host(s, "entry-a") == "192.0.2.10"
    assert intercom_sync.SYNC.station_host(s, "entry-c") is None
    body = c.get("/api/v1/intercom/overview").json()
    assert "192.0.2.10" not in json.dumps(body) and "198.51.100.1" not in json.dumps(body), "the host is never served"
    assert body["camera_access"] == {"entry-a": "ready", "entry-b": "ready", "entry-c": "no_host", "entry-d": "ready"}
    intercom_sync.SYNC._drop()
    assert intercom_sync.SYNC.station_host(s, "entry-a") is None, "dropped with the copy"


def test_camera_snapshot_comes_from_go2rtc_with_the_shared_account(feed, fake_go2rtc):
    seen, _state = fake_go2rtc
    c, s = camera_feed(feed, go2rtc_user="g", go2rtc_password="gp")
    intercom_sync.SYNC._last_view = None
    r = c.get(SNAP.format("entry-a"))
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "image/jpeg" and r.content == JPEG
    assert r.headers["x-snapshot-age"] == "0" and r.headers["cache-control"] == "private, max-age=60"
    [req] = seen
    assert req.method == "GET" and req.url.host == "go2rtc.test" and req.url.path == "/api/frame.jpeg"
    assert dict(req.url.params) == {"src": "rtsp://door:p%40ss%20word@192.0.2.10:554/Streaming/Channels/101", "name": "smplwise_wiskey_entry-a"}
    assert req.headers["authorization"].startswith("Basic "), "go2rtc's own API credentials, as for the NVR streams"
    assert intercom_sync.SYNC._last_view is None, "a camera still is not someone looking: it keeps no overview polling alive"
    assert c.get(SNAP.format("entry-a")).content == JPEG and len(seen) == 1, "served from the cache within max_age"
    # stations the still cannot come from: honest errors, go2rtc never asked
    for sid, status, code in (("entry-e", 404, "intercom_no_camera"), ("nope", 404, "intercom_station_not_found"),
                              ("entry-c", 503, "intercom_camera_host_unknown"), ("entry-d", 503, "intercom_camera_host_unknown"),
                              ("entry-b", 503, "intercom_station_offline")):
        r = c.get(SNAP.format(sid))
        assert (r.status_code, r.json()["code"]) == (status, code), (sid, r.text)
    assert len(seen) == 1


def test_camera_snapshot_configuration_gaps_are_named(feed, fake_go2rtc):
    seen, _state = fake_go2rtc
    c, s = camera_feed(feed, wiskey_password=None)
    r = c.get(SNAP.format("entry-a"))
    assert r.status_code == 503 and r.json()["code"] == "source_not_configured"
    assert c.get("/api/v1/intercom/overview").json()["camera_access"]["entry-a"] == "no_credentials"
    c2 = TestClient(create_app(replace(s, go2rtc_url=None, wiskey_password="x")))
    r = c2.get(SNAP.format("entry-a"))
    assert r.status_code == 503 and r.json()["code"] == "media_not_configured"
    assert c2.get("/api/v1/intercom/overview").json()["camera_access"]["entry-a"] == "no_media"
    assert seen == []


def test_camera_snapshot_go2rtc_failures_are_honest(feed, fake_go2rtc, monkeypatch):
    """Like the NVR snapshot (routers/cameras.py): with a cached copy a failed refresh serves it flagged stale; without
    one it is a 503 with the reason - never a 200 with an empty or non-JPEG body."""
    import os

    import httpx

    from smplwise.services import go2rtc as g2

    seen, state = fake_go2rtc
    c, s = camera_feed(feed)
    assert c.get(SNAP.format("entry-a")).status_code == 200
    [path] = list((s.data_dir / "snapshots" / "intercom").glob("*.jpg"))
    os.utime(path, (time.time() - 100, time.time() - 100))
    state["answer"] = lambda req: httpx.Response(500, text="exec: ffmpeg failed")
    r = c.get(SNAP.format("entry-a"))
    assert r.status_code == 200 and r.content == JPEG
    assert r.headers["x-snapshot-stale"] == "true" and r.headers["x-snapshot-error"] == "snapshot_unavailable"
    assert r.headers["cache-control"] == "private, max-age=10"

    def refused(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=req)

    cases = [
        (lambda req: httpx.Response(500), "snapshot_unavailable"),  # go2rtc: transcode failed
        (lambda req: httpx.Response(404, text="stream not found"), "snapshot_unavailable"),  # go2rtc: source failed
        (lambda req: httpx.Response(200, content=b"<html></html>"), "snapshot_unavailable"),
        (lambda req: httpx.Response(200, content=b""), "snapshot_unavailable"),
        (lambda req: httpx.Response(401), "media_error"),
        (refused, "media_unavailable"),
    ]
    for answer, code in cases:
        path.unlink(missing_ok=True)
        state["answer"] = answer
        r = c.get(SNAP.format("entry-a"))
        assert r.status_code == 503 and r.json()["code"] == code, (code, r.status_code, r.text)
        assert "p@ss" not in r.text and "door:" not in r.text, "no credential in an error body"
        assert not path.exists()
    monkeypatch.setattr(g2, "FRAME_MAX", 16)
    state["answer"] = lambda req: httpx.Response(200, content=JPEG)
    r = c.get(SNAP.format("entry-a"))
    assert r.status_code == 503 and r.json()["details"]["reason"] == "too_large"


def test_station_credential_override_is_write_only_audited_and_wins(feed, fake_go2rtc):
    import os

    seen, _state = fake_go2rtc
    c, s = camera_feed(feed)
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    for who in ("vera", "sam", "nobody"):
        assert c.get(CREDS.format("entry-a"), headers=as_user(who)).status_code == 403, who
        assert c.put(CREDS.format("entry-a"), json={"username": "u", "password": "p"}, headers=as_user(who)).status_code == 403, who
        assert c.delete(CREDS.format("entry-a"), headers=as_user(who)).status_code == 403, who
    assert c.get(CREDS.format("entry-a")).json() == {"station_id": "entry-a", "override": False, "override_updated_at": None, "default_configured": True, "effective": "default"}
    r = c.put(CREDS.format("entry-a"), json={"username": "gate-admin", "password": "s3cret!"})
    assert r.status_code == 200 and r.json()["override"] is True and r.json()["effective"] == "override"
    assert "gate-admin" not in r.text and "s3cret" not in r.text, "never echoed"
    for bad in ({"username": "", "password": "p"}, {"username": "u"}, {"username": "u", "password": "x" * 257}):
        assert c.put(CREDS.format("entry-a"), json=bad).status_code == 422, bad
    # the override is what go2rtc is given for that station; others keep the shared account
    c.get(SNAP.format("entry-a"))
    assert dict(seen[-1].url.params)["src"] == "rtsp://gate-admin:s3cret%21@192.0.2.10:554/Streaming/Channels/101"
    # audited without the secret
    rows = c.get("/api/v1/audit?prefix=intercom.credentials&limit=50").json()["rows"]
    assert [row["action"] for row in rows if row["decision"] == "allowed"] == ["intercom.credentials.set"]
    assert "gate-admin" not in json.dumps(rows) and "s3cret" not in json.dumps(rows)
    assert any(row["decision"] == "denied" for row in c.get("/api/v1/audit?prefix=system.configure&limit=50").json()["rows"])
    # cleared: back to the shared account (the cached still is dropped first so a new frame is asked for)
    r = c.delete(CREDS.format("entry-a"))
    assert r.json()["override"] is False and r.json()["effective"] == "default"
    for p in (s.data_dir / "snapshots" / "intercom").glob("*.jpg"):
        os.utime(p, (time.time() - 100, time.time() - 100))
    c.get(SNAP.format("entry-a"))
    assert dict(seen[-1].url.params)["src"].startswith("rtsp://door:")
    # a station override alone is enough when there is no shared account
    c2 = TestClient(create_app(replace(s, wiskey_user=None, wiskey_password=None)))
    c2.put(CREDS.format("entry-a"), json={"username": "only", "password": "one"})
    body = c2.get("/api/v1/intercom/overview").json()
    assert body["camera_access"]["entry-a"] == "ready" and body["camera_access"]["entry-d"] == "no_credentials"
    assert "only" not in json.dumps(body["camera_access"])


def test_station_credentials_are_not_in_project_backups(feed):
    from smplwise.services import backup

    c, s = camera_feed(feed)
    c.put(CREDS.format("entry-a"), json={"username": "gate-admin", "password": "s3cret!"})
    with c.app.state.db.connection() as conn:
        data = backup.snapshot(conn, include_access=True, include_audit=True, include_events=True)
    assert "wiskey_station_credentials" not in data
    assert "s3cret" not in json.dumps(data, default=str)


CREDS_LIST = "/api/v1/intercom/stations/credentials"


def test_station_credentials_listing_names_every_station_and_stale_rows(feed, fake_go2rtc):
    """The admin screen's list (GET .../stations/credentials): system.configure only; every station the feed knows in
    the feed's order, then any override row whose station the feed no longer lists (`known: false`) - and that row can
    still be cleared. No username, password or host is ever in the reply."""
    c, s = camera_feed(feed)
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    for who in ("vera", "sam", "nobody"):
        r = c.get(CREDS_LIST, headers=as_user(who))
        assert r.status_code == 403 and r.json()["code"] == "forbidden", who
    body = c.get(CREDS_LIST).json()
    assert body["state"] == "ready" and body["default_configured"] is True
    assert [(x["station_id"], x["name"], x["has_camera"], x["known"], x["override"], x["override_updated_at"]) for x in body["stations"]] == [
        ("entry-a", "Main gate", True, True, False, None),
        ("entry-b", "Side door", True, True, False, None),
        ("entry-c", "No host", True, True, False, None),
        ("entry-d", "Bad host", True, True, False, None),
        ("entry-e", "No camera", False, True, False, None),
    ]
    assert "192.0.2.10" not in json.dumps(body) and "\"host\"" not in json.dumps(body), "the host is never served"
    # one override on a known station, one stored for a station the feed does not list (set by id)
    assert c.put(CREDS.format("entry-a"), json={"username": "gate-admin", "password": "s3cret!"}).status_code == 200
    assert c.put(CREDS.format("gone-1"), json={"username": "old-admin", "password": "old-pass"}).status_code == 200
    r = c.get(CREDS_LIST)
    for secret in ("gate-admin", "s3cret", "old-admin", "old-pass", "p@ss", "rtsp://"):
        assert secret not in r.text, secret
    rows = r.json()["stations"]
    assert [x["station_id"] for x in rows] == ["entry-a", "entry-b", "entry-c", "entry-d", "entry-e", "gone-1"], "stale rows after the feed's stations"
    assert rows[0]["override"] is True and rows[0]["known"] is True and rows[0]["override_updated_at"]
    assert rows[-1] == {"station_id": "gone-1", "name": None, "has_camera": False, "known": False, "override": True, "override_updated_at": rows[-1]["override_updated_at"]}
    # the stale row is clearable (no feed check on DELETE), and clearing what is not there is still a 200
    d = c.delete(CREDS.format("gone-1"))
    assert d.status_code == 200 and d.json()["override"] is False
    assert [x["station_id"] for x in c.get(CREDS_LIST).json()["stations"]] == ["entry-a", "entry-b", "entry-c", "entry-d", "entry-e"]
    assert c.delete(CREDS.format("gone-1")).status_code == 200
    rows = c.get("/api/v1/audit?prefix=intercom.credentials&limit=50").json()["rows"]
    assert [row["resource_id"] for row in rows if row["action"] == "intercom.credentials.clear"] == ["gone-1", "gone-1"]
    assert "old-admin" not in json.dumps(rows) and "old-pass" not in json.dumps(rows)


def test_station_credentials_listing_without_a_feed_shows_only_stored_rows(settings):
    """No Home Assistant at all: the list still answers (state `ha_not_configured`, nothing from the feed) so a stored
    row can be seen and cleared."""
    intercom_sync.SYNC.reset()
    c = TestClient(create_app(settings))
    assert c.get(CREDS_LIST).json() == {"state": "ha_not_configured", "default_configured": False, "stations": []}
    assert c.put(CREDS.format("entry-a"), json={"username": "u", "password": "p"}).status_code == 200
    body = c.get(CREDS_LIST).json()
    assert body["state"] == "ha_not_configured" and body["default_configured"] is False
    [row] = body["stations"]
    assert row == {"station_id": "entry-a", "name": None, "has_camera": False, "known": False, "override": True, "override_updated_at": row["override_updated_at"]}
    assert c.delete(CREDS.format("entry-a")).status_code == 200
    assert c.get(CREDS_LIST).json()["stations"] == []


def test_camera_snapshot_requires_access_read(settings):
    """`access.read` first (before the path is even validated); without Home Assistant a clear 503 - no image."""
    intercom_sync.SYNC.reset()
    c = TestClient(create_app(settings))
    bind(c, settings, "wall", "kiosk", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    r = c.get(SNAP.format("entry-a"), headers=as_user("wall"))
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert c.get(SNAP.format("entry-a"), headers=as_user("nobody")).status_code == 403, "no binding at all"
    assert c.get(SNAP.format("x" * 200), headers=as_user("wall")).status_code == 403, "refused before the path is validated"
    r = c.get(SNAP.format("entry-a"), headers=as_user("vera"))
    assert r.status_code == 503 and r.json()["code"] == "ha_not_configured"


def test_camera_snapshot_without_a_served_copy(feed, fake_go2rtc):
    """WisKey absent (or refusing the add-on): the copy and the hosts are dropped - 503 `intercom_unavailable`."""
    seen, _state = fake_go2rtc
    app, s, install = feed

    def script(msg: dict[str, Any], _fake: FakeHa) -> list[Any]:
        return [ha_config(msg)] if msg["type"] == "get_config" else [fail(msg, "unknown_command")]

    install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "not_installed")
    c = TestClient(create_app(replace(s, go2rtc_url=GO2RTC, wiskey_user="door", wiskey_password="x")))
    r = c.get(SNAP.format("entry-a"))
    assert r.status_code == 503 and r.json()["code"] == "intercom_unavailable" and r.json()["details"]["state"] == "not_installed"
    assert seen == []


def test_wiskey_account_options(tmp_path, monkeypatch):
    from smplwise.config import load_settings

    opts = tmp_path / "options.json"
    opts.write_text(json.dumps({"wiskey_username": "door", "wiskey_password": "pw"}), encoding="utf-8")
    s = load_settings(opts)
    assert (s.wiskey_user, s.wiskey_password) == ("door", "pw")
    monkeypatch.setenv("WISKEY_USER", "env-door")
    monkeypatch.setenv("WISKEY_PASSWORD", "env-pw")
    s = load_settings(tmp_path / "missing.json")
    assert (s.wiskey_user, s.wiskey_password) == ("env-door", "env-pw")
    cfg = (ROOT / "smplwise_vms" / "config.yaml").read_text(encoding="utf-8")
    assert 'wiskey_username: ""' in cfg and "wiskey_password: password?" in cfg


# ---------------------------------------------------------------- security review round (S1-S3, N2, N4a)

def _expire_stills(s: Any) -> None:
    import os

    for p in (s.data_dir / "snapshots" / "intercom").glob("*.jpg"):
        os.utime(p, (time.time() - 100, time.time() - 100))


def _raw(req: Any) -> bool:
    return req.url.params.get("src", "").startswith("rtsp://")


def test_frame_source_with_credentials_is_sent_once_then_the_name_only(feed, fake_go2rtc):
    """S1: go2rtc < 1.9.14 logs the whole source URL whenever GetOrPatch creates or re-points a stream. The raw source
    (credentials included) goes out once per registration; every other grab is `src=<name>` alone. A changed override
    re-registers exactly once; a go2rtc restart (it forgot the stream: by-name 404) re-registers exactly once."""
    seen, state = fake_go2rtc
    c, s = camera_feed(feed)
    name = "smplwise_wiskey_entry-a"
    assert c.get(SNAP.format("entry-a")).status_code == 200
    assert [_raw(r) for r in seen] == [True] and dict(seen[0].url.params)["name"] == name
    for _ in range(3):
        _expire_stills(s)
        assert c.get(SNAP.format("entry-a")).status_code == 200
    assert [dict(r.url.params) for r in seen[1:]] == [{"src": name}] * 3, "by name only: no credentials in the query"

    # a new override: the cached still is dropped (N4a) and the new source registered exactly once
    before = len(seen)
    assert c.put(CREDS.format("entry-a"), json={"username": "gate-admin", "password": "s3cret!"}).status_code == 200
    assert c.get(SNAP.format("entry-a")).status_code == 200, "no max_age wait: the override dropped the cached still"
    _expire_stills(s)
    c.get(SNAP.format("entry-a"))
    assert [_raw(r) for r in seen[before:]] == [True, False]
    assert "gate-admin" in dict(seen[before].url.params)["src"]

    # go2rtc restarted: its in-memory streams are gone -> by-name 404, one re-registration (which is the retry)
    state["streams"].clear()
    before = len(seen)
    _expire_stills(s)
    r = c.get(SNAP.format("entry-a"))
    assert r.status_code == 200 and r.content == JPEG
    assert [(_raw(q), dict(q.url.params).get("name")) for q in seen[before:]] == [(False, None), (True, name)]
    _expire_stills(s)
    c.get(SNAP.format("entry-a"))
    assert not _raw(seen[-1])
    assert sum(_raw(q) for q in seen) == 3, "initial registration, the override, the restart - nothing else"

    # clearing the override drops the still and registers the shared account once
    before = len(seen)
    c.delete(CREDS.format("entry-a"))
    c.get(SNAP.format("entry-a"))
    assert [_raw(q) for q in seen[before:]] == [True] and "door:" in dict(seen[-1].url.params)["src"]


def test_concurrent_cache_misses_never_share_a_temp_file(feed, fake_go2rtc):
    """S2: two requests missing the cache for one station at once each write their own temp file; none fails."""
    import httpx

    seen, state = fake_go2rtc
    n = 6
    together = threading.Barrier(n, timeout=10)

    def at_once(req: httpx.Request) -> httpx.Response:
        together.wait()  # every grab answers at the same instant: all requests reach the cache write together
        return httpx.Response(200, content=JPEG, headers={"Content-Type": "image/jpeg"})

    state["answer"] = at_once
    c, s = camera_feed(feed)
    results: list[Any] = []
    errors: list[BaseException] = []

    def get() -> None:
        try:
            results.append(c.get(SNAP.format("entry-a")))
        except BaseException as exc:  # noqa: BLE001 - an unhandled server error surfaces here in the TestClient
            errors.append(exc)

    threads = [threading.Thread(target=get) for _ in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors, errors
    assert [r.status_code for r in results] == [200] * n, [r.text for r in results if r.status_code != 200]
    assert all(r.content == JPEG for r in results)
    assert not list((s.data_dir / "snapshots" / "intercom").glob("*.tmp")), "no temp file left behind"


def test_credentials_permission_comes_before_the_body(feed):
    """S3: a caller without system.configure gets an audited 403 whatever the body is; for the administrator a
    non-JSON content type is 415 and a malformed body 422, each an audited refusal."""
    c, s = camera_feed(feed)
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    for who in ("vera", "sam", "nobody"):
        r = c.put(CREDS.format("entry-a"), content=b"{bad", headers={**as_user(who), "Content-Type": "application/json"})
        assert r.status_code == 403 and r.json()["code"] == "forbidden", (who, r.text)
        r = c.put(CREDS.format("x" * 300), content=b"{bad", headers={**as_user(who), "Content-Type": "text/plain"})
        assert r.status_code == 403, who
    denied = [row for row in c.get("/api/v1/audit?prefix=system.configure&limit=100").json()["rows"] if row["decision"] == "denied"]
    assert len(denied) >= 6
    r = c.put(CREDS.format("entry-a"), content=b'{"username": "u", "password": "p"}', headers={"Content-Type": "text/plain"})
    assert r.status_code == 415 and r.json()["code"] == "unsupported_media_type"
    r = c.put(CREDS.format("entry-a"), content=b"{bad", headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["body"]
    r = c.put(CREDS.format("entry-a"), content=b'{"username": "u"}', headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["password"]
    refused = [row for row in c.get("/api/v1/audit?prefix=intercom.credentials&limit=50").json()["rows"] if row["decision"] == "denied"]
    assert sorted(row["reason"] for row in refused) == ["unsupported_media_type", "validation", "validation"]
    assert c.get(CREDS.format("entry-a")).json()["override"] is False, "nothing was stored"
    r = c.put(CREDS.format("entry-a"), content=b'{"username": "u", "password": "p"}', headers={"Content-Type": "application/json; charset=utf-8"})
    assert r.status_code == 200 and r.json()["override"] is True


def test_station_host_with_a_trailing_newline_is_refused():
    """N2: `$` also matches before a trailing newline; the host check is a full match."""
    from smplwise.services import go2rtc as g2

    assert g2.rtsp_host("door-1.local") == "door-1.local"
    for bad in ("door-1.local\n", "192.0.2.10\n", "door 1", "a/b", "user@host"):
        assert g2.rtsp_host(bad) is None, repr(bad)


# ---------------------------------------------------------------- phase 2 slice A1: the person editor (access.people.manage)

MANAGE = "access.people.manage"
EDITOR_PATHS = (
    ("get", "/api/v1/intercom/people-editor/context", None),
    ("get", "/api/v1/intercom/people/u1/editor", None),
    ("post", "/api/v1/intercom/people/pin-generate", {"user_id": ""}),
    ("post", "/api/v1/intercom/people", None),
    ("put", "/api/v1/intercom/people/u1", None),
    ("post", "/api/v1/intercom/people/u1/delete", None),
)
CARD_ID = "3f0b1c2d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
# WisKey's overview with the editor context's fields (api.commands / capabilities, access.areas, station capabilities)
EDITOR_OVERVIEW = {
    **copy.deepcopy(ACTIONS_OVERVIEW),
    "api": {"version": 1, "min_client": 0, "capabilities": ["panel_permissions", "user_directory_query", "identity_lifecycle"], "commands": ["overview", "subscribe", "users/get", "users/create", "users/update", "users/delete", "users/pin_generate"]},
    "profile_settings": {"revision": 3, "fields": [{"id": "department"}], "groups": [{"id": "staff", "label": "Staff", "station_ids": ["entry-a"]}], "photo_enabled": False, "templates": []},
}
# WisKey's answer to a save: the person's public record (never a PIN value, cards masked) - plus two keys a rogue
# reply might carry, which the projection must drop
SAVED = {**copy.deepcopy(PERSON), "id": "u9", "employee_no": "700112233", "display_name": "Noa", "revision": 1, "phone": "050-777-1234", "pin_configured": True,
         "cards": [{"id": CARD_ID, "masked_number": "•••• 0042", "label": "Badge", "card_type": "normalCard", "enabled": True}],
         "assignments": {"entry-a": {"config_entry_id": "entry-a", "enabled": True, "allowed_locks": [1], "schedule_template": None, "desired_revision": 1, "applied_revision": None, "sync_state": "pending", "last_sync_at": None, "last_error": None}},
         "access_timing_policy": None, "pin": "4321", "photo": "data:image/jpeg;base64,AAAA"}
NEW_PERSON = {"display_name": "Noa", "employee_no": "700112233", "phone": "050-777-1234", "active": True, "valid_from": None, "valid_until": None, "pin": "4321",
              "cards": [{"card_no": "ABC0042", "label": "Badge", "enabled": True}], "permission_overrides": {"entry-a": "allow"}, "door_permissions": {"entry-a": [1]}, "access_policy_revision": 3}
# values that must never appear in an audit row or in a reply after a save
DRAFT_SECRETS = ("4321", "ABC0042", "050-777-1234", "0507771234", "base64", "Engineering", "123456789")


def editor_feed(feed, answer: Callable[[dict[str, Any]], list[Any] | None] = lambda msg: None, overview: dict[str, Any] | None = None) -> tuple[Any, list[FakeHa], TestClient]:
    """A ready feed over EDITOR_OVERVIEW with `users/get` answering PERSON, the saves answering SAVED and a delete
    `accepted` unless `answer` says otherwise; sam (site_admin) and vera (viewer) bound."""
    def script(msg: dict[str, Any]) -> list[Any] | None:
        frames = answer(msg)
        if frames is not None:
            return frames
        kind = msg["type"]
        if kind == "hikvision_intercom/users/get":
            return [ok(msg, copy.deepcopy(PERSON))]
        if kind in ("hikvision_intercom/users/create", "hikvision_intercom/users/update"):
            return [ok(msg, copy.deepcopy(SAVED))]
        if kind == "hikvision_intercom/users/delete":
            return [ok(msg, {"accepted": True})]
        return None

    return actions_feed(feed, script, overview=overview or EDITOR_OVERVIEW)


def create(c: TestClient, user: str = "sam", data: dict[str, Any] | None = None, **fields: Any) -> Any:
    return c.post("/api/v1/intercom/people", json=env(data=NEW_PERSON if data is None else data, **fields), headers=as_user(user))


def update(c: TestClient, user_id: str = "u1", user: str = "sam", data: dict[str, Any] | None = None, revision: int = 4, **fields: Any) -> Any:
    return c.put(f"/api/v1/intercom/people/{user_id}", json=env(data={"display_name": "Dana K"} if data is None else data, revision=revision, **fields), headers=as_user(user))


def delete(c: TestClient, user_id: str = "u1", user: str = "sam", revision: int = 4, **fields: Any) -> Any:
    return c.post(f"/api/v1/intercom/people/{user_id}/delete", json=env(**{"revision": revision, "confirmed": True, **fields}), headers=as_user(user))


def holds_secret(text: str) -> list[str]:
    return [s for s in DRAFT_SECRETS if s in text]


def test_access_people_manage_permission_catalogue(settings):
    """`access.people.manage` follows `access.release` exactly (owner decision 2026-09-28, answer 1): site_admin and
    system_admin only by default, never implied (sensitive), labelled, in the design catalogue, and grantable to one
    person through a custom role that names it among its sensitive permissions."""
    assert {r for r, perms in ROLES.items() if MANAGE in perms} == {"site_admin", "system_admin"}
    for role in ("viewer", "kiosk", "operator", "editor"):
        assert MANAGE not in ROLES[role], role
    assert MANAGE in SENSITIVE and "access.release" in SENSITIVE
    assert PERMISSION_LABELS[MANAGE]
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"]: MANAGE in r["permissions"] for r in contract["roles"]} == {r["id"]: MANAGE in ROLES[r["id"]] for r in contract["roles"]}
    assert MANAGE in contract["sensitive_permissions_not_implied"]
    intercom_sync.SYNC.reset()
    c = TestClient(create_app(settings))
    body = {"name": "עורך אנשים WisKey", "description": "one person's grant", "permissions": ["access.read"], "sensitive": [MANAGE]}
    assert c.post("/api/v1/access/roles", json={**body, "permissions": ["access.read", MANAGE], "sensitive": []}).json()["code"] == "sensitive_in_permissions"
    r = c.post("/api/v1/access/roles", json=body)
    assert r.status_code == 201, r.text
    assert r.json()["sensitive_included"] == [MANAGE]
    bind(c, settings, "pat", r.json()["id"], "installation", "*")
    me = c.get("/api/v1/me", headers=as_user("pat")).json()
    assert MANAGE in me["permissions_installation"] and "access.release" not in me["permissions_installation"]
    assert c.get("/api/v1/intercom/people-editor/context", headers=as_user("pat")).status_code == 200, "the custom role opens the editor"
    intercom_sync.SYNC.reset()


def test_person_editor_requires_access_people_manage(settings):
    """`access.read` is not enough - and neither is `access.release`: every editor endpoint is 403 for a viewer, an
    operator, an editor, a kiosk, a site-scoped site_admin and nobody, before the body is looked at, and no
    `intercom.person.*` audit row is ever written for them."""
    intercom_sync.SYNC.reset()
    intercom_sync.SYNC.start(settings)
    c = TestClient(create_app(settings))
    for user, role in (("vera", "viewer"), ("otto", "operator"), ("eddie", "editor"), ("wall", "kiosk")):
        bind(c, settings, user, role, "installation", "*")
    site = c.post("/api/v1/sites", json={"name": "A1 site"}).json()["id"]
    bind(c, settings, "sally", "site_admin", "site", site)
    bind(c, settings, "sam", "site_admin", "installation", "*")
    assert c.get("/api/v1/intercom/people/u1", headers=as_user("vera")).status_code != 403, "vera does hold access.read"
    for user in ("vera", "otto", "eddie", "wall", "sally", "nobody"):
        for method, path, body in EDITOR_PATHS:
            r = c.request(method, path, json=body if body is not None else env(data=NEW_PERSON, revision=4, confirmed=True), headers=as_user(user))
            assert r.status_code == 403 and r.json()["code"] == "forbidden", (user, path, r.text)
        r = c.post("/api/v1/intercom/people", content=b"{not json", headers={**as_user(user), "Content-Type": "application/json"})
        assert r.status_code == 403, "permission before the body"
    with Database(settings.db_path).connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied' AND actor_username = 'vera'", (MANAGE,)).fetchone()[0]
        own = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action LIKE 'intercom.person.%' AND actor_username != 'sam'").fetchone()[0]
    assert denied == len(EDITOR_PATHS) + 1, "every permission refusal is audited under the real caller"
    assert own == 0
    assert MANAGE in c.get("/api/v1/me", headers=as_user("sam")).json()["permissions_installation"]
    assert MANAGE not in c.get("/api/v1/me", headers=as_user("sally")).json()["permissions_installation"]
    intercom_sync.SYNC.reset()


def test_editor_projection_is_separate_and_the_read_projection_is_unchanged(feed):
    """Brief A.5: the editor gets phone, the PIN flag, WisKey's masked cards, overrides, identity_locked and the
    assignments' bookkeeping - and NOTHING that looks like a PIN value, a full card number, a profile value or a photo,
    even when WisKey's reply carries one. The `access.read` projection stays byte-for-byte what it was."""
    rogue = {**copy.deepcopy(PERSON), "pin": "9999", "photo": "data:image/jpeg;base64,QUJD",
             "cards": [*PERSON["cards"], {"id": CARD_ID, "masked_number": "ABCD5678", "card_no": "ABCD5678", "label": "Spare", "card_type": "normalCard", "enabled": False}]}
    app, fakes, c = editor_feed(feed, lambda msg: [ok(msg, copy.deepcopy(rogue))] if msg["type"] == "hikvision_intercom/users/get" else None)
    r = c.get("/api/v1/intercom/people/u1", headers=as_user("vera"))
    assert r.status_code == 200 and r.json()["person"] == PROJECTED_PERSON, "the read projection did not grow"
    assert not [p for p in PRIVATE if p in r.text], "no editor field leaks to access.read"
    r = c.get("/api/v1/intercom/people/u1/editor", headers=as_user("sam"))
    assert r.status_code == 200, r.text
    p = r.json()["person"]
    assert {k: p[k] for k in PROJECTED_PERSON if k != "stations"} == {k: v for k, v in PROJECTED_PERSON.items() if k != "stations"}, "the editor projection extends the read one"
    assert [{k: s[k] for k in PROJECTED_PERSON["stations"][0]} for s in p["stations"]] == PROJECTED_PERSON["stations"]
    assert (p["phone"], p["pin_configured"], p["identity_locked"], p["has_timing"], p["permission_overrides"]) == ("+972500000000", True, False, True, {"events": "deny"})
    assert p["cards"] == [
        {"id": "c1", "masked_number": "•••• 1234", "label": "Main", "card_type": "normalCard", "enabled": True},
        {"id": CARD_ID, "masked_number": "••••", "label": "Spare", "card_type": "normalCard", "enabled": False},  # a full number is never passed on
    ]
    assert p["stations"][0] == {"station_id": "entry-a", "enabled": True, "doors": [1, 2], "sync_state": "synced", "last_error": None, "desired_revision": 4, "applied_revision": 4}
    assert p["stations"][1]["last_error"] == "device_unavailable"
    assert "pin" not in p and "photo" not in p and "profile" not in p and "card_no" not in r.text
    for secret in ("9999", "ABCD5678", "QUJD", "Engineering", "123456789", "access_timing"):
        assert secret not in r.text, secret
    assert len(fakes) == 1, "over the feed's own session"


def test_person_create_round_trip_and_audit(feed):
    """Create: the draft is validated locally, sent ONCE with WisKey's exact shape ({data, sync_now, api_contract: 1}),
    the answer is served in the editor projection ("WisKey accepted it into its store", the stations follow), and the
    audit under the real caller - attempt row before, outcome row after - records field names and counts, never the
    PIN, the card number or the phone."""
    app, fakes, c = editor_feed(feed)
    s = feed[1]
    r = create(c)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "ready" and body["command_id"] and "WisKey שמר" in body["note"]
    assert body["person"]["id"] == "u9" and body["person"]["pin_configured"] is True and body["person"]["cards"] == [{"id": CARD_ID, "masked_number": "•••• 0042", "label": "Badge", "card_type": "normalCard", "enabled": True}]
    assert body["person"]["stations"] == [{"station_id": "entry-a", "enabled": True, "doors": [1], "sync_state": "pending", "last_error": None, "desired_revision": 1, "applied_revision": None}]
    assert not [x for x in ("4321", "ABC0042", "base64") if x in r.text], "the reply carries WisKey's masked record only"
    [msg] = sent(fakes, "users/create")
    assert msg == {
        "id": msg["id"], "type": "hikvision_intercom/users/create", "api_contract": 1, "sync_now": True,
        "data": {"display_name": "Noa", "employee_no": "700112233", "phone": "050-777-1234", "active": True, "valid_from": None, "valid_until": None, "pin": "4321",
                 "cards": [{"card_no": "ABC0042", "label": "Badge", "card_type": "normalCard", "enabled": True}],
                 "permission_overrides": {"entry-a": "allow"}, "door_permissions": {"entry-a": [1]}, "access_policy_revision": 3},
    }
    [attempt] = audit_rows(s, "intercom.person.create", "attempt")
    [outcome] = audit_rows(s, "intercom.person.create", "outcome")
    for row in (attempt, outcome):
        assert (row["actor_user_id"], row["actor_username"], row["decision"], row["resource_type"], row["resource_id"], row["reason"]) == ("dev-sam", "sam", "allowed", "intercom_person", "new", None)
        d = row["details"]
        assert d["command_id"] == body["command_id"] and d["sync_now"] is True and d["pin_change"] == "set"
        assert d["fields"] == ["access_policy_revision", "active", "cards", "display_name", "door_permissions", "employee_no", "permission_overrides", "phone", "pin", "valid_from", "valid_until"]
        assert (d["card_count"], d["enabled_cards"], d["new_cards"]) == (1, 1, 1)
        assert (d["door_permissions"], d["permission_overrides"], d["access_policy_revision"]) == ({"entry-a": [1]}, {"entry-a": "allow"}, 3)
        assert not holds_secret(json.dumps(d, ensure_ascii=False)), d
    assert outcome["details"]["outcome"] == "ok" and outcome["details"]["result"] == {
        "id": "u9", "employee_no": "700112233", "display_name": "Noa", "revision": 1, "active": True, "pin_configured": True, "card_count": 1, "enabled_cards": 1,
        "assignments": {"entry-a": {"enabled": True, "allowed_locks": [1]}},
    }
    # a new person needs a name and an employee number: refused locally, audited (with its command id), nothing sent
    body = env(data={"phone": "050-777-1234"})
    r = c.post("/api/v1/intercom/people", json=body, headers=as_user("sam"))
    assert r.status_code == 422 and r.json()["details"] == {"outcome": "not_sent", "fields": ["display_name", "employee_no"]}
    [refused] = audit_rows(s, "intercom.person.create", "refused")
    assert refused["reason"] == "validation" and refused["details"]["client_request_id"] == body["client_request_id"] and not holds_secret(json.dumps(refused["details"]))
    assert len(sent(fakes, "users/create")) == 1
    # "Save" without sync: WisKey's periodic reconciliation carries it
    assert create(c, sync_now=False).status_code == 200
    assert sent(fakes, "users/create")[-1]["sync_now"] is False


def test_person_update_and_delete_round_trip(feed):
    """Update is a patch, compare-and-set on the loaded revision ({user_id, revision, data, sync_now, api_contract});
    a saved card travels by id only (WisKey keeps its number); `pin: null` removes the PIN. Delete needs the
    dialog's `confirmed: true` and sends {user_id, revision, api_contract}; WisKey's `accepted` is served as queued,
    never as removed from the stations."""
    app, fakes, c = editor_feed(feed)
    s = feed[1]
    patch = {"display_name": "Dana K", "pin": None, "cards": [{"id": CARD_ID, "label": "Main", "enabled": False}, {"card_no": "NEW77", "label": ""}],
             "permission_overrides": {"entry-a": "deny", "entry-c": "allow", "events": "deny"}, "door_permissions": {"entry-c": [2, 1]}}
    r = update(c, data=patch, sync_now=False)
    assert r.status_code == 200, r.text
    assert r.json()["person"]["id"] == "u9" and r.json()["command_id"]
    [msg] = sent(fakes, "users/update")
    assert msg == {
        "id": msg["id"], "type": "hikvision_intercom/users/update", "user_id": "u1", "revision": 4, "sync_now": False, "api_contract": 1,
        "data": {"display_name": "Dana K", "pin": None,
                 "cards": [{"id": CARD_ID, "label": "Main", "card_type": "normalCard", "enabled": False}, {"card_no": "NEW77", "label": "", "card_type": "normalCard", "enabled": True}],
                 "permission_overrides": {"entry-a": "deny", "entry-c": "allow", "events": "deny"}, "door_permissions": {"entry-c": [1, 2]}},
    }
    [attempt] = audit_rows(s, "intercom.person.update", "attempt")
    assert (attempt["resource_type"], attempt["resource_id"]) == ("intercom_person", "u1")
    d = attempt["details"]
    assert (d["revision"], d["pin_change"], d["card_count"], d["enabled_cards"], d["new_cards"], d["fields"]) == (4, "removed", 2, 1, 1, ["cards", "display_name", "door_permissions", "permission_overrides", "pin"])
    assert "NEW77" not in json.dumps(d) and "Dana K" not in json.dumps(d), "values stay out of the attempt row"
    assert audit_rows(s, "intercom.person.update", "outcome")[0]["details"]["result"]["id"] == "u9"
    # nothing to change: refused locally
    r = update(c, data={})
    assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent"
    # delete: confirmation first
    for confirmed in (None, False, "yes", 1):
        r = delete(c, confirmed=confirmed)
        assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and r.json()["details"]["outcome"] == "not_sent", confirmed
    assert not sent(fakes, "users/delete")
    r = delete(c)
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] == {"accepted": True} and "מתוזמנת" in r.json()["note"]
    [msg] = sent(fakes, "users/delete")
    assert msg == {"id": msg["id"], "type": "hikvision_intercom/users/delete", "user_id": "u1", "revision": 4, "api_contract": 1}
    [outcome] = audit_rows(s, "intercom.person.delete", "outcome")
    assert (outcome["resource_id"], outcome["details"]["revision"], outcome["details"]["outcome"], outcome["details"]["result"]) == ("u1", 4, "ok", {"accepted": True})
    assert len(audit_rows(s, "intercom.person.delete", "refused")) == 4
    # bool is not a revision, and a revision below 1 is not one either
    assert delete(c, revision=True).status_code == 422 and delete(c, revision=0).status_code == 422


# WisKey's failure codes for the people writes and how SMPLWISE answers them (intercom_client.PRE_STORAGE, brief A.4):
# refused = proven pre-storage (status by intercom_sync.WRITE_REFUSALS / WRITE_INVALID_PREFIXES); everything else unknown.
WRITE_REFUSED = {
    **{code: 502 for code in ("unauthorized", "api_incompatible", "request_too_large", "unknown_command")}, "invalid_fields": 422, "rate_limited": 429,
    "revision_conflict": 409, "pin_conflict": 409, "employee_conflict": 409, "card_conflict": 409, "pin_removal_pending": 409, "card_removal_pending": 409,
    "identity_migration_required": 409, "group_policy_changed": 409, "user_not_found": 404, "storage_stopping": 503,
    "invalid_pin": 422, "invalid_cards": 422, "duplicate_card": 422, "invalid_phone": 422, "invalid_validity": 422, "invalid_text": 422, "invalid_identifier": 422,
    "unmanaged_lock": 422, "station_not_found": 422, "station_has_no_managed_lock": 422, "card_capacity": 422, "pin_exceeds_capabilities": 422,
    "pin_device_managed": 422, "person_exceeds_capabilities": 422, "card_exceeds_capabilities": 422, "photo_storage_full": 422, "profile_settings_unavailable": 422,
    "schedule_overlap": 422, "invalid_user_timing": 422,
}
WRITE_UNKNOWN = ["storage_write_failed", "manager_closed", "action_failed", "device_unavailable", "invalid_storage", "home_assistant_error", "a_code_nobody_documented", ""]
DELETE_REFUSED = {**{code: WRITE_REFUSED[code] for code in ("unauthorized", "api_incompatible", "request_too_large", "unknown_command", "invalid_fields", "rate_limited")},
                  "revision_conflict": 409, "user_not_found": 404, "storage_stopping": 503}
# for a delete, a build_user / collision code is NOT on the allow-list (it cannot come from _delete_user): unknown, the safe side
DELETE_UNKNOWN = [*WRITE_UNKNOWN, "pin_conflict", "employee_conflict", "invalid_pin"]
WRITES = {
    "users/create": ("intercom.person.create", lambda c: create(c), WRITE_REFUSED, WRITE_UNKNOWN),
    "users/update": ("intercom.person.update", lambda c: update(c), WRITE_REFUSED, WRITE_UNKNOWN),
    "users/delete": ("intercom.person.delete", lambda c: delete(c), DELETE_REFUSED, DELETE_UNKNOWN),
}


@pytest.mark.parametrize("command", list(WRITES))
def test_people_write_failure_codes_are_refused_only_when_pre_storage(feed, monkeypatch, command):
    """Brief A.4 / §0.1: a `success: false` is "refused - WisKey did not save it" ONLY for a code the source proves is
    raised before `_commit` saves (PRE_DISPATCH + PRE_STORAGE), each answered by name with `details.outcome`
    `refused` and audited so. `storage_write_failed` (inside the atomic write), `manager_closed` (after the commit),
    `action_failed`, `device_unavailable` (unproven), an undocumented code or an empty one are "outcome unknown"
    (504) - the UI must reload the person and compare the revision, never retry blindly."""
    monkeypatch.setattr(intercom_sync, "CONFIG_USER_BURST", 1000.0)
    monkeypatch.setattr(intercom_sync, "CONFIG_GLOBAL_BURST", 1000.0)
    current = {"code": ""}
    app, fakes, c = editor_feed(feed, lambda msg: [fail(msg, current["code"])] if msg["type"] == f"hikvision_intercom/{command}" else None)
    intercom_sync.SYNC._buckets_reset()
    action, send, refused, unknown = WRITES[command]
    s = feed[1]
    for code, status in refused.items():
        current["code"] = code
        r = send(c)
        assert r.status_code == status and r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == code, (command, code, r.text)
        assert audit_rows(s, action, "outcome")[-1]["details"]["outcome"] == "refused", (command, code)
        assert intercom_client.refusal_is_pre_device(command, code)
    for code in unknown:
        current["code"] = code
        r = send(c)
        assert r.status_code == 504 and r.json()["code"] == "intercom_outcome_unknown", (command, code, r.text)
        assert r.json()["details"]["outcome"] == "unknown" and r.json()["details"]["wiskey_code"] == (code or "action_failed"), (command, code)
        assert "טענו מחדש" in r.json()["user_message"] and "במצלמה" not in r.json()["user_message"], "a save's advice: reload, not the camera"
        assert audit_rows(s, action, "outcome")[-1]["details"]["outcome"] == "unknown", (command, code)
        assert not intercom_client.refusal_is_pre_device(command, code)
    assert len(sent(fakes, command)) == len(refused) + len(unknown), "each attempt was sent exactly once"
    assert intercom_sync.STATE.state == "ready"
    # by name: the ones the editor handles specially
    if command != "users/delete":
        current["code"] = "pin_conflict"
        assert send(c).json()["code"] == "intercom_pin_conflict"
    current["code"] = "revision_conflict"
    assert send(c).json()["code"] == "intercom_revision_conflict"
    current["code"] = "unauthorized"
    assert "users:manage" in send(c).json()["user_message"], "the add-on's HA user lacks WisKey's users area"


def test_people_write_unanswered_or_malformed_answer_is_unknown(feed, monkeypatch):
    """No answer within CONFIG_TIMEOUT_S, or `success: true` with an answer of an unexpected shape: 504 unknown, sent
    once, audited unknown - and the single config slot stays taken until WisKey (or ha_client's limit) settles it."""
    monkeypatch.setattr(intercom_sync, "CONFIG_TIMEOUT_S", 0.3)
    held: list[tuple[dict[str, Any], FakeHa]] = []
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/users/create":
            held.append((msg, fake))
            return []
        if msg["type"] == "hikvision_intercom/users/delete":
            return [ok(msg, {"accepted": "later"})]
        if msg["type"] == "hikvision_intercom/users/update":
            return [ok(msg, "not a person")]
        return normal(msg, fake, EDITOR_OVERVIEW)

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    c = TestClient(app)
    bind(c, s, "sam", "site_admin", "installation", "*")
    r = create(c)
    assert r.status_code == 504 and r.json()["details"] == {"outcome": "unknown", "state": "error", "wiskey_code": "timeout"}, r.text
    assert delete(c).json()["code"] == "intercom_busy", "the unanswered save holds the config lane's only slot"
    msg, fake = held[0]
    assert intercom_sync.SYNC._event_loop and fake.q
    intercom_sync.SYNC._event_loop.call_soon_threadsafe(fake.q.put_nowait, ok(msg, copy.deepcopy(SAVED)))  # the late answer
    wait_for(lambda: intercom_sync.SYNC._config_inflight._value == 1)
    for send, code in ((delete, "intercom.person.delete"), (update, "intercom.person.update")):
        r = send(c)
        assert r.status_code == 504 and r.json()["details"]["wiskey_code"] == "invalid_response", r.text
        assert audit_rows(s, code, "outcome")[-1]["details"]["outcome"] == "unknown"
    assert audit_rows(s, "intercom.person.create", "outcome")[0]["details"]["outcome"] == "unknown"
    assert len(sent(fakes, "users/create")) == 1, "never retried"


def test_people_config_lane_is_separate_from_the_action_lane(feed, monkeypatch):
    """Brief §0.3: a people save WisKey holds occupies the config lane's single slot - a second save is `busy` at once
    - while a door release still goes through on the action lane, and reads on theirs."""
    monkeypatch.setattr(intercom_sync, "CONFIG_TIMEOUT_S", 0.2)
    held: list[tuple[dict[str, Any], FakeHa]] = []
    app, s, install = feed

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/users/update":
            held.append((msg, fake))
            return []  # WisKey is slow
        if msg["type"] == UNLOCK:
            return [ok(msg, {"accepted": True})]
        if msg["type"] == "hikvision_intercom/users/get":
            return [ok(msg, copy.deepcopy(PERSON))]
        return normal(msg, fake, EDITOR_OVERVIEW)

    fakes = install(script)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    c = TestClient(app)
    bind(c, s, "sam", "site_admin", "installation", "*")
    r = update(c)
    assert r.status_code == 504 and r.json()["details"]["wiskey_code"] == "timeout"
    r = update(c)
    assert r.status_code == 429 and r.json()["code"] == "intercom_busy" and r.json()["details"]["outcome"] == "not_sent", "the single config slot is still taken"
    assert release(c).status_code == 200, "a release is not blocked by the held save"
    assert c.get("/api/v1/intercom/people/u1/editor", headers=as_user("sam")).json()["state"] == "ready", "nor a read"
    # and the other way round: every action slot taken, a save still goes (its own lane)
    actions = intercom_sync.SYNC._action_inflight = threading.BoundedSemaphore(1)
    assert actions.acquire(blocking=False)
    try:
        assert release(c).json()["code"] == "intercom_busy"
        msg, fake = held[0]
        assert intercom_sync.SYNC._event_loop and fake.q
        intercom_sync.SYNC._event_loop.call_soon_threadsafe(fake.q.put_nowait, ok(msg, copy.deepcopy(SAVED)))  # the late answer
        wait_for(lambda: intercom_sync.SYNC._config_inflight._value == 1)
        assert update(c).status_code == 504, "sent again (a new request) on the freed config slot, the action lane full"
    finally:
        actions.release()
    assert len(held) == 2 and len(sent(fakes, "users/update")) == 2
    assert intercom_sync.STATE.state == "ready"


@pytest.mark.parametrize("draft, field", [
    ({**NEW_PERSON, "profile": {"department": "x"}}, "data.profile"),
    ({**NEW_PERSON, "photo": None}, "data.photo"),
    ({**NEW_PERSON, "access_timing_draft": None}, "data.access_timing_draft"),
    ({**NEW_PERSON, "group_ids": ["staff"]}, "data.group_ids"),
    ({**NEW_PERSON, "user_type": "normal"}, "data.user_type"),
    ({**NEW_PERSON, "active": 1}, "data.active"),
    ({**NEW_PERSON, "pin": "12a"}, "data.pin"),
    ({**NEW_PERSON, "pin": 4321}, "data.pin"),
    ({**NEW_PERSON, "employee_no": "no spaces"}, "data.employee_no"),
    ({**NEW_PERSON, "display_name": "x" * 33}, "data.display_name"),
    ({**NEW_PERSON, "display_name": "tab\there"}, "data"),
    ({**NEW_PERSON, "phone": "call me"}, "data"),
    ({**NEW_PERSON, "phone": "+972 5"}, "data"),
    ({**NEW_PERSON, "valid_from": "2026-01-01T00:00:00Z"}, "data"),
    ({**NEW_PERSON, "valid_from": "2027-01-01T00:00:00Z", "valid_until": "2026-01-01T00:00:00Z"}, "data"),
    ({**NEW_PERSON, "valid_from": "2026-01-01T00:00:00", "valid_until": "2027-01-01T00:00:00"}, "data"),
    ({**NEW_PERSON, "valid_from": "2026-01-01T00:00:00Z", "valid_until": "2038-01-01T00:00:00Z"}, "data"),
    ({**NEW_PERSON, "cards": [{"id": CARD_ID, "card_no": "ABC"}]}, "data.cards.0"),
    ({**NEW_PERSON, "cards": [{"label": "no number"}]}, "data.cards.0"),
    ({**NEW_PERSON, "cards": [{"id": "c1"}]}, "data.cards.0"),
    ({**NEW_PERSON, "cards": [{"card_no": "bad card!"}]}, "data.cards.0.card_no"),
    ({**NEW_PERSON, "cards": [{"card_no": "A1", "card_type": "cpu"}]}, "data.cards.0.card_type"),
    ({**NEW_PERSON, "cards": [{"card_no": "A1", "enabled": "yes"}]}, "data.cards.0.enabled"),
    ({**NEW_PERSON, "cards": [{"card_no": "A1"}, {"card_no": "A1"}]}, "data"),
    # station access: WisKey's legacy absolute `assignments` is refused (review B1: it cannot remove a relay), and the
    # overrides / door_permissions pair is checked as group_permissions.prepare checks it
    ({**NEW_PERSON, "assignments": {"entry-a": {"enabled": True, "allowed_locks": [1]}}}, "data.assignments"),
    ({k: v for k, v in NEW_PERSON.items() if k != "permission_overrides"}, "data"),
    ({k: v for k, v in NEW_PERSON.items() if k != "door_permissions"}, "data"),
    ({**NEW_PERSON, "door_permissions": {"entry-a": [3]}}, "data"),
    ({**NEW_PERSON, "door_permissions": {"entry-a": []}}, "data"),
    ({**NEW_PERSON, "door_permissions": {"entry-a": [1, 1]}}, "data"),
    ({**NEW_PERSON, "door_permissions": {"entry-a": [True]}}, "data.door_permissions.entry-a.0"),
    ({**NEW_PERSON, "permission_overrides": {"entry-a": "maybe"}}, "data.permission_overrides.entry-a"),
    ({**NEW_PERSON, "permission_overrides": {"": "allow"}}, "data"),
    ({**NEW_PERSON, "permission_overrides": {"entry-a": "deny"}, "door_permissions": {"entry-a": [1]}}, "data"),
    ({**NEW_PERSON, "access_policy_revision": "3"}, "data.access_policy_revision"),
    ({**NEW_PERSON, "access_policy_revision": True}, "data.access_policy_revision"),
])
def test_person_draft_is_validated_locally_before_anything_is_sent(feed, draft, field):
    """Brief A.6: the draft mirrors WisKey's USER_FIELDS / CARD_FIELDS with strict types and no extra keys, so a
    malformed draft - including the keys of slices A2 / A3 (profile, photo, timing, groups) - is an audited `not_sent`
    refusal that never reaches WisKey; the refusal names the field and carries no value."""
    app, fakes, c = editor_feed(feed)
    r = create(c, data=draft)
    assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent", (field, r.text)
    assert field in r.json()["details"]["fields"], (field, r.json()["details"]["fields"])
    assert not sent(fakes, "users/create")
    [row] = audit_rows(feed[1], "intercom.person.create", "refused")
    assert row["reason"] == "validation" and not holds_secret(json.dumps(row["details"], ensure_ascii=False))
    assert c.put("/api/v1/intercom/people/u1", json=env(data=draft, revision=4), headers=as_user("sam")).status_code == 422
    assert not sent(fakes, "users/update")


def test_station_access_is_sent_as_wiskeys_own_editor_payload(feed):
    """Review B1: WisKey's `group_permissions.prepare` keeps an already-allowed station's PREVIOUS relays unless
    `door_permissions` names the station, so SMPLWISE sends what WisKey's own editor sends - overrides, the enabled
    stations' relays, the policy revision - and refuses the legacy `assignments`. The pair goes together, a denied
    station carries no relays, a station left to its group has no override, and the revision is optional (a WisKey
    without a profile policy would answer `group_policy_changed` to any revision)."""
    app, fakes, c = editor_feed(feed)
    # a relay removed from an existing two-relay assignment (entry-a is [1, 2] on PERSON): named in door_permissions
    r = update(c, data={"permission_overrides": {"entry-a": "allow", "entry-b": "deny"}, "door_permissions": {"entry-a": [1]}})
    assert r.status_code == 200, r.text
    assert sent(fakes, "users/update")[-1]["data"] == {"permission_overrides": {"entry-a": "allow", "entry-b": "deny"}, "door_permissions": {"entry-a": [1]}}
    # a group-granted station left alone: in door_permissions (it is enabled) but not in the overrides
    r = update(c, data={"permission_overrides": {}, "door_permissions": {"entry-a": [2]}, "access_policy_revision": 0})
    assert r.status_code == 200, r.text
    assert sent(fakes, "users/update")[-1]["data"] == {"permission_overrides": {}, "door_permissions": {"entry-a": [2]}, "access_policy_revision": 0}
    # everything disabled: empty door_permissions, the denies alone
    r = update(c, data={"permission_overrides": {"entry-a": "deny"}, "door_permissions": {}})
    assert r.status_code == 200, r.text
    assert sent(fakes, "users/update")[-1]["data"] == {"permission_overrides": {"entry-a": "deny"}, "door_permissions": {}}
    assert "assignments" not in json.dumps([m["data"] for m in sent(fakes, "users/update")])
    r = update(c, data={"assignments": {"entry-a": {"enabled": True, "allowed_locks": [1]}}})
    assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent" and "data.assignments" in r.json()["details"]["fields"]
    assert len(sent(fakes, "users/update")) == 3


def test_people_write_bodies_forbid_unknown_top_level_keys(feed):
    """N1: a stray top-level key - a `pin` outside `data`, a `data2`, a `confirmed` on a save - is an audited refusal,
    never silently ignored."""
    app, fakes, c = editor_feed(feed)
    for extra in ({"pin": "4321"}, {"data2": {}}, {"confirmed": True}, {"user_id": "u1"}):
        r = c.post("/api/v1/intercom/people", json=env(data=NEW_PERSON, **extra), headers=as_user("sam"))
        assert r.status_code == 422 and r.json()["details"]["outcome"] == "not_sent" and list(extra) == r.json()["details"]["fields"], (extra, r.text)
        r = c.put("/api/v1/intercom/people/u1", json=env(data={"active": False}, revision=4, **extra), headers=as_user("sam"))
        assert r.status_code == 422 and list(extra) == r.json()["details"]["fields"], (extra, r.text)
    r = c.post("/api/v1/intercom/people/u1/delete", json=env(revision=4, confirmed=True, data={"active": False}), headers=as_user("sam"))
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["data"]
    assert not sent(fakes, "users/create") and not sent(fakes, "users/update") and not sent(fakes, "users/delete")
    assert not holds_secret(json.dumps([row["details"] for row in audit_rows(feed[1], "intercom.person.create", "refused")]))


def test_people_writes_take_json_only_and_honour_the_envelope(feed):
    """The physical actions' body rules apply unchanged: a `text/plain` body is a 415 audited refusal, a bad JSON a
    422, an expired or duplicated command id a 409 - and nothing reaches WisKey. `sync_now` is a strict bool."""
    app, fakes, c = editor_feed(feed)
    s = feed[1]
    for path, action in (("/api/v1/intercom/people", "intercom.person.create"), ("/api/v1/intercom/people/u1/delete", "intercom.person.delete")):
        r = c.post(path, content=json.dumps(env(data=NEW_PERSON, revision=4, confirmed=True)), headers={**as_user("sam"), "Content-Type": "text/plain"})
        assert r.status_code == 415 and r.json()["details"]["outcome"] == "not_sent", r.text
        [row] = audit_rows(s, action, "refused")
        assert row["reason"] == "unsupported_media_type" and row["actor_username"] == "sam"
    r = c.put("/api/v1/intercom/people/u1", content=b"{nope", headers={**as_user("sam"), "Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["body"]
    assert create(c, sync_now="yes").status_code == 422
    body = env(data=NEW_PERSON)
    assert c.post("/api/v1/intercom/people", json=body, headers=as_user("sam")).status_code == 200
    r = c.post("/api/v1/intercom/people", json=body, headers=as_user("sam"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_duplicate_command"
    assert c.post("/api/v1/intercom/people", json=env(ttl=-1, data=NEW_PERSON), headers=as_user("sam")).json()["code"] == "expired"
    assert c.post("/api/v1/intercom/people", json=env(ttl=120, data=NEW_PERSON), headers=as_user("sam")).json()["code"] == "expires_too_far"
    assert len(sent(fakes, "users/create")) == 1 and not sent(fakes, "users/update") and not sent(fakes, "users/delete")
    long_id = "x" * 200
    r = c.put(f"/api/v1/intercom/people/{long_id}", json=env(data={"active": False}, revision=1), headers=as_user("sam"))
    assert r.status_code == 422 and r.json()["details"]["fields"] == ["user_id"]
    assert len(audit_rows(s, "intercom.person.update", "refused")[-1]["resource_id"]) == 128


def test_editor_context_and_pin_generate(feed):
    """The editor context: per station the relays and whether a keypad PIN can be written, WisKey's capabilities,
    whether the people-write commands are listed for the add-on's HA user, whether a profile policy exists - no
    users, no hosts. `users/pin_generate` (a read, but with `api_contract`) answers a PIN shown once and never
    written to the audit log; its refusals are honest."""
    def answer(msg: dict[str, Any]) -> list[Any] | None:
        if msg["type"] != "hikvision_intercom/users/pin_generate":
            return None
        if msg["user_id"] == "gone":
            return [fail(msg, "user_not_found")]
        if msg["user_id"] == "full":
            return [fail(msg, "pin_generation_failed")]
        if msg["user_id"] == "odd":
            return [ok(msg, {"pin": "12ab"})]
        return [ok(msg, {"pin": "246810"})]

    app, fakes, c = editor_feed(feed, answer)
    s = feed[1]
    r = c.get("/api/v1/intercom/people-editor/context", headers=as_user("sam"))
    assert r.status_code == 200, r.text
    ctx = r.json()["context"]
    assert ctx["stations"][0] == {"id": "entry-a", "name": "Main gate", "online": True, "lock_enabled": True, "locks": [{"physical_index": 1, "name": "Gate"}], "pin_writable": True}
    assert ctx["stations"][1]["lock_enabled"] is False and ctx["stations"][2]["locks"][1] == {"physical_index": 2, "name": "Barrier"}
    assert ctx["default_zone"] == {"kind": "iana", "name": "Asia/Jerusalem"}
    assert ctx["capabilities"] == ["panel_permissions", "user_directory_query", "identity_lifecycle"]
    assert ctx["writes_listed"] is True and ctx["users_manage"] is True
    assert ctx["profile_policy"] == {"revision": 3, "groups": 1, "fields": 1}
    assert "users" not in ctx and "192.0.2." not in r.text and "Dana" not in r.text and "host" not in r.text
    assert ctx["stations"][0].keys() == {"id", "name", "online", "lock_enabled", "locks", "pin_writable"}
    # a WisKey that lists no commands / areas: unknown, not assumed
    bare = intercom_sync.project_editor_context({**copy.deepcopy(OVERVIEW), "api": {"version": 1}, "access": {}})
    assert bare["writes_listed"] is None and bare["users_manage"] is None and bare["profile_policy"] is None and bare["stations"][0]["pin_writable"] is True
    listed = intercom_sync.project_editor_context({"stations": [{**copy.deepcopy(STATION), "capabilities": None}], "api": {"commands": ["overview"]}, "access": {"is_admin": False, "areas": {"users": "view"}}})
    assert listed["writes_listed"] is False and listed["users_manage"] is False and listed["stations"][0]["pin_writable"] is None
    # PIN generate: the value is served once and is nowhere in the audit log
    r = c.post("/api/v1/intercom/people/pin-generate", json={"user_id": ""}, headers=as_user("sam"))
    assert r.status_code == 200 and r.json()["pin"] == {"pin": "246810"}, r.text
    [msg] = sent(fakes, "users/pin_generate")
    assert msg == {"id": msg["id"], "type": "hikvision_intercom/users/pin_generate", "user_id": "", "api_contract": 1}
    with Database(s.db_path).connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE details_json LIKE '%246810%' OR reason LIKE '%246810%'").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action LIKE 'intercom.person.%'").fetchone()[0] == 0, "a read is not audited as a write"
    assert c.post("/api/v1/intercom/people/pin-generate", content=b"user_id=", headers={**as_user("sam"), "Content-Type": "text/plain"}).status_code == 415
    assert c.post("/api/v1/intercom/people/pin-generate", json={"user_id": "u1", "pin": "1"}, headers=as_user("sam")).status_code == 422, "no extra keys"
    r = c.post("/api/v1/intercom/people/pin-generate", json={"user_id": "gone"}, headers=as_user("sam"))
    assert r.status_code == 404 and r.json()["code"] == "intercom_person_not_found"
    r = c.post("/api/v1/intercom/people/pin-generate", json={"user_id": "full"}, headers=as_user("sam"))
    assert r.status_code == 200 and r.json()["last_error"] == "pin_generation_failed" and r.json()["pin"] is None
    r = c.post("/api/v1/intercom/people/pin-generate", json={"user_id": "odd"}, headers=as_user("sam"))
    assert r.json()["last_error"] == "invalid_response" and r.json()["pin"] is None, "not digits: not served"


def test_people_writes_without_home_assistant_are_not_sent(settings):
    intercom_sync.SYNC.reset()
    c = TestClient(create_app(settings))
    bind(c, settings, "sam", "site_admin", "installation", "*")
    r = create(c)
    assert r.status_code == 503 and r.json()["code"] == "intercom_unavailable" and r.json()["details"]["outcome"] == "not_sent"
    ctx = c.get("/api/v1/intercom/people-editor/context", headers=as_user("sam")).json()
    assert ctx["state"] == "ha_not_configured" and ctx["context"] is None
    [row] = audit_rows(settings, "intercom.person.create", "outcome")
    assert row["details"]["outcome"] == "not_sent"
    intercom_sync.SYNC.reset()


# ---------------------------------------------------------------- phase 2 slice A2: card capture (access.cards.capture)

from smplwise.services import intercom_capture  # noqa: E402

CAPTURE_PERM = "access.cards.capture"
CAP = "hikvision_intercom/cards/"
CAPTURED_NUMBER = "QRSTWXYZ"  # the number the fake reader "reads": it must never leave the fake WisKey
CAPTURED_MASK = "•••• WXYZ"


class FakeEnrollment:
    """WisKey's CardEnrollment (access/enrollment.py) as a script: sessions in memory, one per station, three in all;
    `preparing` -> `waiting` on the first status read; `present()` is the person holding a card to the reader. The
    collected number stays here - status answers only `CapturedCard.public()` (masked)."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.sessions: dict[str, dict[str, Any]] = {}
        self.fail: dict[str, str] = {}  # command -> the code it answers with
        self.hold: set[str] = set()  # commands that get no answer at all (WisKey slow / the answer lost)
        self.raw: dict[str, Any] = {}  # command -> a success result of this exact value
        self.readers: dict[str, Any] = {"readers": [0], "card_min": 1, "card_max": 32}

    def present(self, number: str = CAPTURED_NUMBER, technology: str = "TypeA_M1", sid: str | None = None) -> None:
        with self.lock:
            for key, s in self.sessions.items():
                if sid in (None, key) and s["state"] in ("preparing", "waiting"):
                    s.update(state="captured", number=number, card={"masked_number": "•••• " + number[-4:], "technology": technology, "reader_id": 1})

    def expire(self, sid: str | None = None, error: str = "capture_timeout") -> None:
        with self.lock:
            for key, s in self.sessions.items():
                if sid in (None, key):
                    s.update(state="error", error=error, card=None)

    @staticmethod
    def public(sid: str, s: dict[str, Any]) -> dict[str, Any]:
        return {"session_id": sid, "station_id": s["station_id"], "user_id": s["user_id"], "revision": s["revision"], "state": s["state"], "error": s.get("error"), "card": s.get("card")}

    def answer(self, msg: dict[str, Any]) -> list[Any] | None:
        kind = msg["type"]
        if not kind.startswith(CAP):
            return None
        command = kind.removeprefix("hikvision_intercom/")
        if command in self.hold:
            return []
        if command in self.fail:
            return [fail(msg, self.fail[command])]
        if command in self.raw:
            return [ok(msg, copy.deepcopy(self.raw[command]))]
        with self.lock:
            if command == "cards/reader_capabilities":
                return [ok(msg, copy.deepcopy(self.readers))]
            if command == "cards/capture_start":
                if any(s["station_id"] == msg["station_id"] for s in self.sessions.values()):
                    return [fail(msg, "capture_station_busy")]
                if len(self.sessions) >= 3:
                    return [fail(msg, "capture_limit")]
                sid = uuid.uuid4().hex
                self.sessions[sid] = {"station_id": msg["station_id"], "user_id": msg["user_id"], "revision": msg["revision"], "state": "preparing"}
                return [ok(msg, self.public(sid, self.sessions[sid]))]
            if command == "cards/capture_status":
                s = self.sessions.get(msg["session_id"])
                if s is None:
                    return [fail(msg, "capture_not_found")]
                frame = ok(msg, self.public(msg["session_id"], s))
                if s["state"] == "preparing":
                    s["state"] = "waiting"
                return [frame]
            if command == "cards/capture_cancel":
                s = self.sessions.get(msg["session_id"])
                if s is not None and s["state"] == "applying":
                    return [fail(msg, "capture_applying")]
                self.sessions.pop(msg["session_id"], None)
                return [ok(msg, {"cancelled": True})]
            if command == "cards/capture_confirm":
                s = self.sessions.get(msg["session_id"])
                if s is None:
                    return [fail(msg, "capture_not_found")]
                if s["state"] != "captured":
                    return [fail(msg, "capture_not_ready")]
                del self.sessions[msg["session_id"]]
                person = copy.deepcopy(PERSON)
                person["revision"] += 1
                person["cards"].append({"id": CARD_ID, "masked_number": s["card"]["masked_number"], "label": msg["label"].strip(), "card_type": "normalCard", "enabled": True})
                return [ok(msg, person)]
        return None


@pytest.fixture()
def fast_capture(monkeypatch):
    """The poller at test speed and roomy capture buckets; no session outlives the test."""
    monkeypatch.setattr(intercom_capture, "POLL_S", 0.05)
    monkeypatch.setattr(intercom_capture, "CAPTURED_POLL_S", 0.1)
    monkeypatch.setattr(intercom_capture, "POLL_BUSY_S", 0.08)
    for name in ("CAPTURE_USER_BURST", "CAPTURE_GLOBAL_BURST", "CAPTURE_USER_RATE", "CAPTURE_GLOBAL_RATE", "CONFIG_USER_BURST", "CONFIG_GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    intercom_capture.CAPTURES.clear()
    yield
    intercom_capture.CAPTURES.clear()


def capture_feed(feed, fake: FakeEnrollment, extra: Callable[[dict[str, Any]], list[Any] | None] = lambda msg: None, overview: dict[str, Any] | None = None) -> tuple[Any, list[FakeHa], TestClient]:
    """editor_feed with the fake enrollment; sam (site_admin), sid (system_admin) and vera (viewer) bound."""
    def answer(msg: dict[str, Any]) -> list[Any] | None:
        frames = extra(msg)
        return frames if frames is not None else fake.answer(msg)

    app, fakes, c = editor_feed(feed, answer, overview=overview)
    bind(c, feed[1], "sid", "system_admin", "installation", "*")
    intercom_sync.SYNC._buckets_reset()
    return app, fakes, c


def cap_start(c: TestClient, user: str = "sam", station: str = "entry-a", person: str = "u1", revision: int = 4, reader: int = 0, **fields: Any) -> Any:
    body = env(**{"station_id": station, "reader_id": reader, "revision": revision, "confirmed": True, **fields})
    return c.post(f"/api/v1/intercom/people/{person}/card-capture", json=body, headers=as_user(user))


def cap_status(c: TestClient, sid: str, user: str = "sam") -> Any:
    return c.get(f"/api/v1/intercom/card-capture/{sid}", headers=as_user(user))


def cap_cancel(c: TestClient, sid: str, user: str = "sam") -> Any:
    return c.post(f"/api/v1/intercom/card-capture/{sid}/cancel", json={}, headers=as_user(user))


def cap_confirm(c: TestClient, sid: str, user: str = "sam", label: str = "תג ראשי", **fields: Any) -> Any:
    return c.post(f"/api/v1/intercom/card-capture/{sid}/confirm", json=env(**{"label": label, "confirmed": True, **fields}), headers=as_user(user))


def wait_state(c: TestClient, sid: str, state: str, user: str = "sam", timeout: float = 5.0) -> dict[str, Any]:
    seen: dict[str, Any] = {}

    def reached() -> bool:
        seen.update(cap_status(c, sid, user).json().get("capture") or {})
        return seen.get("state") == state

    wait_for(reached, timeout)
    return seen


def capture_rows(settings: Any) -> list[dict[str, Any]]:
    with Database(settings.db_path).connection() as conn:
        rows = conn.execute("SELECT action, decision, resource_type, resource_id, reason, details_json, actor_username FROM audit_log WHERE action LIKE 'intercom.card_capture.%' ORDER BY rowid").fetchall()
    return [{**dict(r), "details": json.loads(r["details_json"]) if r["details_json"] else None} for r in rows]


def no_card_digits_in_audit(settings: Any) -> None:
    with Database(settings.db_path).connection() as conn:
        hits = conn.execute("SELECT COUNT(*) FROM audit_log WHERE details_json LIKE '%WXYZ%' OR reason LIKE '%WXYZ%' OR details_json LIKE '%QRST%'").fetchone()[0]
    assert hits == 0, "the collected card's number - not even its masked last four - is never in the audit log"


CAPTURE_PATHS = (
    ("get", "/api/v1/intercom/stations/entry-a/card-readers", None),
    ("post", "/api/v1/intercom/people/u1/card-capture", "start"),
    ("get", "/api/v1/intercom/card-capture/0123456789abcdef", None),
    ("post", "/api/v1/intercom/card-capture/0123456789abcdef/cancel", {}),
    ("post", "/api/v1/intercom/card-capture/0123456789abcdef/confirm", "confirm"),
)


def test_access_cards_capture_permission_catalogue(settings):
    """`access.cards.capture` follows `access.release` / `access.people.manage` (owner decision 2026-09-28, answer 2):
    site_admin and system_admin only, sensitive, labelled, in the design catalogue, grantable per person."""
    assert {r for r, perms in ROLES.items() if CAPTURE_PERM in perms} == {"site_admin", "system_admin"}
    for role in ("viewer", "kiosk", "operator", "editor"):
        assert CAPTURE_PERM not in ROLES[role], role
    assert CAPTURE_PERM in SENSITIVE and PERMISSION_LABELS[CAPTURE_PERM]
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"]: CAPTURE_PERM in r["permissions"] for r in contract["roles"]} == {r["id"]: CAPTURE_PERM in ROLES[r["id"]] for r in contract["roles"]}
    assert CAPTURE_PERM in contract["sensitive_permissions_not_implied"]


def test_card_capture_needs_its_own_permission_on_top_of_people_manage(settings):
    """Every capture endpoint is 403 for a viewer / operator / editor / kiosk, for a custom role holding
    `access.people.manage` WITHOUT `access.cards.capture` and for one holding the capture permission without people
    management - before the body is read, audited, and no `intercom.card_capture.*` row is written for them."""
    intercom_sync.SYNC.reset()
    intercom_capture.CAPTURES.clear()
    intercom_sync.SYNC.start(settings)
    c = TestClient(create_app(settings))
    for user, role in (("vera", "viewer"), ("otto", "operator"), ("eddie", "editor"), ("wall", "kiosk")):
        bind(c, settings, user, role, "installation", "*")
    people_only = c.post("/api/v1/access/roles", json={"name": "people only", "description": "A1 without A2", "permissions": ["access.read"], "sensitive": [MANAGE]}).json()["id"]
    capture_only = c.post("/api/v1/access/roles", json={"name": "capture only", "description": "A2 without A1", "permissions": ["access.read"], "sensitive": [CAPTURE_PERM]}).json()["id"]
    both = c.post("/api/v1/access/roles", json={"name": "people + capture", "description": "one person's grant", "permissions": ["access.read"], "sensitive": [MANAGE, CAPTURE_PERM]}).json()["id"]
    bind(c, settings, "polly", people_only, "installation", "*")
    bind(c, settings, "cora", capture_only, "installation", "*")
    bind(c, settings, "bea", both, "installation", "*")
    assert c.get("/api/v1/intercom/people-editor/context", headers=as_user("polly")).status_code == 200, "polly does edit people"
    for user in ("vera", "otto", "eddie", "wall", "polly", "cora", "nobody"):
        for method, path, body in CAPTURE_PATHS:
            payload = env(station_id="entry-a", reader_id=0, revision=4, confirmed=True) if body == "start" else env(label="x", confirmed=True) if body == "confirm" else body
            r = c.request(method, path, json=payload, headers=as_user(user))
            assert r.status_code == 403 and r.json()["code"] == "forbidden", (user, path, r.text)
        r = c.post("/api/v1/intercom/people/u1/card-capture", content=b"{not json", headers={**as_user(user), "Content-Type": "application/json"})
        assert r.status_code == 403, "permission before the body"
    with Database(settings.db_path).connection() as conn:
        polly = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied' AND actor_username = 'polly'", (CAPTURE_PERM,)).fetchone()[0]
        cora = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied' AND actor_username = 'cora'", (MANAGE,)).fetchone()[0]
        own = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action LIKE 'intercom.card_capture.%'").fetchone()[0]
    assert polly == len(CAPTURE_PATHS) + 1 and cora == len(CAPTURE_PATHS) + 1, "the missing permission is named in each refusal"
    assert own == 0
    # both permissions (a custom role, the per-person grant path): through to the feed (not configured here)
    r = c.get("/api/v1/intercom/stations/entry-a/card-readers", headers=as_user("bea"))
    assert r.status_code == 200 and r.json()["state"] == "ha_not_configured" and r.json()["readers"] is None
    intercom_sync.SYNC.reset()


def test_card_capture_round_trip(feed, fast_capture):
    """Readers -> start (WisKey's exact frame, confirmed, audited attempt + outcome) -> the backend's poller follows the
    session (preparing -> waiting) -> a card is presented -> the owner sees it masked -> confirm (WisKey's exact frame,
    config lane) -> the person comes back with the new card masked. The number is never in a reply beyond WisKey's
    masked form, never in the audit log."""
    fake = FakeEnrollment()
    fake.readers = {"readers": [1, 2], "card_min": 4, "card_max": 32}
    app, fakes, c = capture_feed(feed, fake)
    s = feed[1]
    r = c.get("/api/v1/intercom/stations/entry-a/card-readers", headers=as_user("sam"))
    assert r.status_code == 200 and r.json()["readers"] == {"readers": [1, 2], "card_min": 4, "card_max": 32}, r.text
    [msg] = sent(fakes, "cards/reader_capabilities")
    assert msg == {"id": msg["id"], "type": CAP + "reader_capabilities", "station_id": "entry-a", "api_contract": 1}
    r = cap_start(c, reader=2)
    assert r.status_code == 200, r.text
    body = r.json()
    view = body["capture"]
    sid = view["session_id"]
    assert view["state"] == "preparing" and view["active"] is True and view["card"] is None and view["station_name"] == "Main gate"
    assert 20 < view["collect_remaining_s"] <= 30, "the reader's own 30 s wait (WisKey's device deadline), not the 70 s bound"
    assert view["session_remaining_s"] > 110 and view["reader_may_be_collecting"] is True and view["reason"] is None
    assert body["command_id"] and "שום כרטיס לא יתווסף" in body["note"]
    [msg] = sent(fakes, "cards/capture_start")
    assert msg == {"id": msg["id"], "type": CAP + "capture_start", "station_id": "entry-a", "user_id": "u1", "revision": 4, "reader_id": 2, "api_contract": 1}
    [attempt] = audit_rows(s, "intercom.card_capture.start", "attempt")
    [outcome] = audit_rows(s, "intercom.card_capture.start", "outcome")
    assert (attempt["actor_username"], attempt["resource_type"], attempt["resource_id"]) == ("sam", "intercom_person", "u1")
    assert (attempt["details"]["station_id"], attempt["details"]["reader_id"], attempt["details"]["revision"], attempt["details"]["station_name"]) == ("entry-a", 2, 4, "Main gate")
    assert outcome["details"]["outcome"] == "ok" and outcome["details"]["result"] == {"session_id": sid, "state": "preparing"}
    wait_state(c, sid, "waiting")
    status = sent(fakes, "cards/capture_status")
    assert status and status[0] == {"id": status[0]["id"], "type": CAP + "capture_status", "session_id": sid, "api_contract": 1}
    fake.present()
    view = wait_state(c, sid, "captured")
    assert view["card"] == {"masked_number": CAPTURED_MASK, "technology": "TypeA_M1", "reader_id": 1}
    assert view["collect_remaining_s"] is None and view["reader_may_be_collecting"] is False
    wait_for(lambda: len(audit_rows(s, "intercom.card_capture.result")) == 1)
    [result] = audit_rows(s, "intercom.card_capture.result")
    assert result["actor_username"] == "sam" and result["details"]["outcome"] == "captured" and result["details"]["technology"] == "TypeA_M1"
    # approval: only with the explicit confirmation, then WisKey's exact frame
    r = cap_confirm(c, sid, confirmed=None)
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fakes, "cards/capture_confirm")
    r = cap_confirm(c, sid, label="  תג ראשי ")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["person"]["revision"] == 5 and body["person"]["cards"][-1] == {"id": CARD_ID, "masked_number": CAPTURED_MASK, "label": "תג ראשי", "card_type": "normalCard", "enabled": True}
    assert body["capture"]["state"] == "confirmed" and body["capture"]["card"] is None and body["capture"]["active"] is False
    [msg] = sent(fakes, "cards/capture_confirm")
    assert msg == {"id": msg["id"], "type": CAP + "capture_confirm", "session_id": sid, "label": "  תג ראשי ", "api_contract": 1}
    [attempt] = audit_rows(s, "intercom.card_capture.confirm", "attempt")
    [outcome] = audit_rows(s, "intercom.card_capture.confirm", "outcome")
    assert attempt["details"]["cards_added"] == 1 and attempt["details"]["label_set"] is True and attempt["details"]["session_id"] == sid
    assert outcome["details"]["result"]["card_count"] == 2 and "cards" not in outcome["details"]["result"]
    assert CAPTURED_NUMBER not in r.text and "WXYZ" not in json.dumps(capture_rows(s), ensure_ascii=False)
    no_card_digits_in_audit(s)
    # the session is over: nothing left to cancel or confirm
    assert cap_cancel(c, sid).json()["code"] == "intercom_capture_over"
    assert cap_confirm(c, sid).json()["code"] == "intercom_capture_not_ready"
    assert len(sent(fakes, "cards/capture_confirm")) == 1 and not sent(fakes, "cards/capture_cancel")


def test_card_capture_start_requires_confirmation_and_the_envelope(feed, fast_capture):
    """A physical action on a reader at a door: no `confirmed: true`, an expired / too-far / duplicate command, a
    non-JSON body, a reader outside 0..8 or a bool, an unknown / offline / lockless station - each an audited `not_sent`
    refusal, nothing sent to WisKey."""
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake)
    s = feed[1]
    for confirmed in (None, False, "yes", 1):
        body = env(station_id="entry-a", reader_id=0, revision=4) if confirmed is None else env(station_id="entry-a", reader_id=0, revision=4, confirmed=confirmed)
        r = c.post("/api/v1/intercom/people/u1/card-capture", json=body, headers=as_user("sam"))
        assert r.status_code == 409 and r.json()["code"] == "confirmation_required" and r.json()["details"]["outcome"] == "not_sent", confirmed
    assert cap_start(c, ttl=-1).json()["code"] == "expired"
    assert cap_start(c, ttl=120).json()["code"] == "expires_too_far"
    for reader in (9, -1, True, "0"):
        r = cap_start(c, reader=reader)
        assert r.status_code == 422 and "reader_id" in r.json()["details"]["fields"], reader
    assert cap_start(c, revision=True).status_code == 422
    assert cap_start(c, extra="x").status_code == 422, "no extra keys"
    r = c.post("/api/v1/intercom/people/u1/card-capture", content=json.dumps(env(station_id="entry-a", reader_id=0, revision=4, confirmed=True)), headers={**as_user("sam"), "Content-Type": "text/plain"})
    assert r.status_code == 415
    assert cap_start(c, station="nowhere").json()["code"] == "intercom_station_not_found"
    assert cap_start(c, station="entry-b").json()["code"] == "intercom_no_lock", "entry-b has no managed lock (and is offline)"
    assert not sent(fakes, "cards/capture_start")
    refused = audit_rows(s, "intercom.card_capture.start", "refused")
    assert len(refused) == 4 + 2 + 4 + 2 + 1 + 2 and all(r["details"]["outcome"] == "not_sent" for r in refused)
    body = env(station_id="entry-a", reader_id=0, revision=4, confirmed=True)
    assert c.post("/api/v1/intercom/people/u1/card-capture", json=body, headers=as_user("sam")).status_code == 200
    sid = [x for x in intercom_capture.CAPTURES._sessions][0]
    assert cap_cancel(c, sid).status_code == 200
    r = c.post("/api/v1/intercom/people/u1/card-capture", json=body, headers=as_user("sam"))
    assert r.status_code == 409 and r.json()["code"] == "intercom_duplicate_command"
    assert len(sent(fakes, "cards/capture_start")) == 1


def test_card_capture_sessions_belong_to_the_user_who_started_them(feed, fast_capture):
    """WisKey sees every SMPLWISE user as the add-on's one HA user, so SMPLWISE keeps the owner: another administrator
    (with both permissions) gets a 404 for the status, the cancel and the confirm of someone else's session - audited
    for the writes - and WisKey is never asked on their behalf."""
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake)
    s = feed[1]
    sid = cap_start(c).json()["capture"]["session_id"]
    fake.present()
    wait_state(c, sid, "captured")
    r = cap_status(c, sid, user="sid")
    assert r.status_code == 404 and r.json()["code"] == "intercom_capture_not_found"
    assert CAPTURED_MASK not in r.text
    r = cap_cancel(c, sid, user="sid")
    assert r.status_code == 404 and r.json()["details"]["outcome"] == "not_sent"
    r = cap_confirm(c, sid, user="sid")
    assert r.status_code == 404
    assert not sent(fakes, "cards/capture_cancel") and not sent(fakes, "cards/capture_confirm")
    denied = [row for row in capture_rows(s) if row["actor_username"] == "sid"]
    assert [(row["action"], row["decision"], row["reason"]) for row in denied] == [
        ("intercom.card_capture.cancel", "denied", "intercom_capture_not_found"), ("intercom.card_capture.confirm", "denied", "intercom_capture_not_found")]
    assert cap_status(c, sid).json()["capture"]["state"] == "captured", "still sam's, untouched"
    assert cap_status(c, "not-a-session").status_code == 404
    r = cap_cancel(c, sid)
    assert r.status_code == 200 and r.json()["capture"]["state"] == "cancelled" and r.json()["cancelled"] == {"cancelled": True}
    [msg] = sent(fakes, "cards/capture_cancel")
    assert msg == {"id": msg["id"], "type": CAP + "capture_cancel", "session_id": sid, "api_contract": 1}
    [outcome] = audit_rows(s, "intercom.card_capture.cancel", "outcome")
    assert outcome["actor_username"] == "sam" and outcome["details"]["outcome"] == "ok" and outcome["details"]["person_id"] == "u1"
    no_card_digits_in_audit(s)


def test_one_active_capture_per_station_and_per_user(feed, fast_capture):
    """SMPLWISE's own limits, refused before anything is sent: a second capture of the same user anywhere, a second
    capture at the same station by anyone. WisKey's own (`capture_station_busy` for a session opened outside SMPLWISE,
    `capture_limit`) come back as clean refusals."""
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake)
    first = cap_start(c).json()["capture"]["session_id"]
    r = cap_start(c, station="entry-c")
    assert r.status_code == 409 and r.json()["code"] == "intercom_capture_user_busy" and r.json()["details"]["outcome"] == "not_sent"
    r = cap_start(c, user="sid")
    assert r.status_code == 409 and r.json()["code"] == "intercom_capture_station_busy"
    assert len(sent(fakes, "cards/capture_start")) == 1
    other = cap_start(c, user="sid", station="entry-c")
    assert other.status_code == 200, "another user at another station"
    assert cap_cancel(c, first).status_code == 200
    # a session WisKey holds for someone else (WisKey's own panel): WisKey refuses, nothing is followed, the slot is free
    with fake.lock:
        fake.sessions["foreign"] = {"station_id": "entry-a", "user_id": "u9", "revision": 1, "state": "waiting"}
    r = cap_start(c)
    assert r.status_code == 409 and r.json()["code"] == "intercom_capture_station_busy" and r.json()["details"]["outcome"] == "refused"
    fake.fail["cards/capture_start"] = "capture_limit"
    r = cap_start(c)
    assert r.status_code == 409 and r.json()["code"] == "intercom_capture_limit" and r.json()["details"]["outcome"] == "refused", r.text
    del fake.fail["cards/capture_start"]


def test_card_capture_timeout_expiry_and_abandonment(feed, fast_capture, monkeypatch):
    """WisKey's collector gives up (`error: capture_timeout`) -> the session is over, audited `timeout`; WisKey's 120 s
    session TTL passed -> `expired`; the owner's browser stopped asking -> the backend cancels the session itself,
    audited with `trigger: abandoned`.

    The tight windows (`SESSION_S`, `EXPIRE_GRACE_S`, `ABANDON_S`) are shrunk through the module's own seams rather
    than by sleeping, but the poller that notices them is a real background thread ticking on the wall clock, so the
    bound each `wait_for`/`wait_state` allows it is generous by default (scaled further by SW_TEST_TIME_FACTOR) for a
    busy workstation - another agent's build or soak, a second pytest worker. SW_PERF=1 checks the original tight
    bound (5 s) on a quiet machine."""
    bound = 5.0 if sw_perf_enabled() else 30.0 * sw_time_factor()
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake)
    s = feed[1]
    sid = cap_start(c).json()["capture"]["session_id"]
    wait_state(c, sid, "waiting", timeout=bound)
    fake.expire(sid, "capture_timeout")
    view = wait_state(c, sid, "error", timeout=bound)
    assert view["error"] == "capture_timeout" and view["active"] is False and view["card"] is None
    wait_for(lambda: any(r["details"]["outcome"] == "timeout" for r in audit_rows(s, "intercom.card_capture.result")), bound)
    [timeout] = audit_rows(s, "intercom.card_capture.result")
    assert timeout["reason"] == "capture_timeout" and timeout["details"]["cleanup"] == "cancelled", "WisKey's failed session is let go, freeing its station slot"
    [cleanup] = sent(fakes, "cards/capture_cancel")
    assert cleanup["session_id"] == sid
    assert cap_start(c).status_code == 200, "the owner's slot and WisKey's station slot are free again"
    assert cap_cancel(c, [k for k, v in intercom_capture.CAPTURES._sessions.items() if v.state in intercom_capture.ACTIVE][0]).status_code == 200
    assert cap_start(c, station="entry-c").status_code == 200
    sid2 = [k for k, v in intercom_capture.CAPTURES._sessions.items() if v.state in intercom_capture.ACTIVE][0]
    # the session outlives WisKey's own TTL (here shortened): expired, without WisKey being asked to cancel it
    monkeypatch.setattr(intercom_capture, "SESSION_S", 0.5)
    monkeypatch.setattr(intercom_capture, "EXPIRE_GRACE_S", 0.1)
    view = wait_state(c, sid2, "expired", timeout=bound)
    assert view["session_remaining_s"] == 0 and view["reader_may_be_collecting"] is False
    monkeypatch.setattr(intercom_capture, "SESSION_S", 120.0)
    assert len(sent(fakes, "cards/capture_cancel")) == 2, "an expired session is not cancelled (WisKey dropped it itself)"
    # abandoned: nobody asks for the session any more
    monkeypatch.setattr(intercom_capture, "ABANDON_S", 0.4)
    sid3 = cap_start(c).json()["capture"]["session_id"]
    wait_for(lambda: len(sent(fakes, "cards/capture_cancel")) == 3, bound)
    msg = sent(fakes, "cards/capture_cancel")[-1]
    assert msg["session_id"] == sid3
    wait_for(lambda: intercom_capture.CAPTURES._sessions[sid3].state == "cancelled", bound)
    rows = [r for r in capture_rows(s) if r["action"] == "intercom.card_capture.cancel"]
    assert rows[-1]["details"]["trigger"] == "abandoned" and rows[-1]["details"]["outcome"] == "ok" and rows[-1]["actor_username"] == "sam"
    view = intercom_capture.CAPTURES.view(intercom_capture.CAPTURES._sessions[sid3])
    assert (view["state"], view["reason"]) == ("cancelled", "abandoned"), "the dialog can say why: it stopped asking"
    outcomes = [r["details"]["outcome"] for r in capture_rows(s) if r["action"] == "intercom.card_capture.result"]
    assert outcomes == ["timeout", "expired"]


# refused vs unknown per capture command (intercom_client.PRE_CAPTURE, verified against WisKey's enrollment.py)
START_REFUSED = {
    **{code: WRITE_REFUSED[code] for code in ("unauthorized", "api_incompatible", "request_too_large", "unknown_command", "invalid_fields", "rate_limited")},
    "manager_closed": 503, "station_not_found": 404, "station_offline": 409, "station_has_no_managed_lock": 409, "user_not_found": 404,
    "revision_conflict": 409, "capture_station_busy": 409, "capture_limit": 409,
}
START_UNKNOWN = ["action_failed", "device_unavailable", "capture_unsupported", "storage_write_failed", "a_code_nobody_documented", ""]


@pytest.mark.parametrize("code", list(START_REFUSED))
def test_capture_start_refusals_are_proven_pre_device(feed, fast_capture, code):
    """A start WisKey refuses with a code raised before its collector exists: `refused` (nothing reached the reader),
    by name, the owner's and the station's slots free again at once."""
    fake = FakeEnrollment()
    fake.fail["cards/capture_start"] = code
    app, fakes, c = capture_feed(feed, fake)
    r = cap_start(c)
    assert r.status_code == START_REFUSED[code] and r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == code, r.text
    assert intercom_client.refusal_is_pre_device("cards/capture_start", code)
    assert audit_rows(feed[1], "intercom.card_capture.start", "outcome")[-1]["details"]["outcome"] == "refused"
    del fake.fail["cards/capture_start"]
    assert cap_start(c).status_code == 200, "nothing held after a refusal"


@pytest.mark.parametrize("code", START_UNKNOWN)
def test_capture_start_without_a_clear_answer_is_unknown_and_holds_the_station(feed, fast_capture, code):
    """Anything else - `action_failed`, `device_unavailable` (unproven), an unknown code, no code - is "outcome
    unknown": the reader may be collecting under a session SMPLWISE cannot see, so the station is held for the rest of
    WisKey's 120 s (a start there is refused locally, with the wait), the owner may start elsewhere, and nothing is
    ever added without the confirm."""
    fake = FakeEnrollment()
    fake.fail["cards/capture_start"] = code
    app, fakes, c = capture_feed(feed, fake)
    r = cap_start(c)
    assert r.status_code == 504 and r.json()["code"] == "intercom_outcome_unknown" and r.json()["details"]["outcome"] == "unknown", r.text
    assert "עד שתי דקות" in r.json()["user_message"] and "בלי אישורכם" in r.json()["user_message"]
    assert 100 < r.json()["details"]["retry_after_s"] <= 120
    assert not intercom_client.refusal_is_pre_device("cards/capture_start", code)
    assert audit_rows(feed[1], "intercom.card_capture.start", "outcome")[-1]["details"]["outcome"] == "unknown"
    del fake.fail["cards/capture_start"]
    r = cap_start(c)
    assert r.status_code == 409 and r.json()["code"] == "intercom_capture_station_busy" and r.json()["details"]["retry_after_s"] > 100
    assert cap_start(c, station="entry-c").status_code == 200, "the owner is free to start elsewhere"
    assert len(sent(fakes, "cards/capture_start")) == 2, "the held station was refused locally"


def test_capture_start_answers_of_an_unexpected_shape_or_none_are_unknown(feed, fast_capture, monkeypatch):
    """`success: true` without a usable session id, and no answer at all within CAPTURE_TIMEOUT_S: unknown, never
    refused - and never retried."""
    fake = FakeEnrollment()
    fake.raw["cards/capture_start"] = {"session_id": 7, "state": "preparing"}
    app, fakes, c = capture_feed(feed, fake)
    r = cap_start(c)
    assert r.status_code == 504 and r.json()["details"] == {"outcome": "unknown", "state": "error", "wiskey_code": "invalid_response", "retry_after_s": r.json()["details"]["retry_after_s"]}
    monkeypatch.setattr(intercom_sync, "CAPTURE_TIMEOUT_S", 0.3)
    del fake.raw["cards/capture_start"]
    fake.hold.add("cards/capture_start")
    r = cap_start(c, station="entry-c")
    assert r.status_code == 504 and r.json()["details"]["wiskey_code"] == "timeout"
    assert len(sent(fakes, "cards/capture_start")) == 2


def test_capture_cancel_and_confirm_refused_vs_unknown(feed, fast_capture, monkeypatch):
    """Cancel: `capture_applying` is refused (nothing cancelled, the session unchanged); no clear answer is unknown ->
    `cancel_unknown`, the station held (WisKey may still have the session). Confirm: refused before WisKey touched its
    session (`capture_not_ready`, `invalid_text`, a pre-dispatch code) -> the card still waits for approval; refused
    after (revision / card conflict, a pre-storage code) -> `closed`; `storage_write_failed` / `manager_closed` / no
    answer -> `unconfirmed` (reload the person and look for the card)."""
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake)
    s = feed[1]
    for code in intercom_client.CAPTURE_CANCEL_REFUSED | intercom_client.PRE_DISPATCH:
        assert intercom_client.refusal_is_pre_device("cards/capture_cancel", code)
    for code in ("action_failed", "device_unavailable", "manager_closed", ""):
        assert not intercom_client.refusal_is_pre_device("cards/capture_cancel", code)
    sid = cap_start(c).json()["capture"]["session_id"]
    wait_state(c, sid, "waiting")
    fake.fail["cards/capture_cancel"] = "capture_applying"
    r = cap_cancel(c, sid)
    assert r.status_code == 409 and r.json()["code"] == "intercom_capture_applying" and r.json()["details"]["outcome"] == "refused"
    assert r.json()["details"]["capture"]["state"] == "waiting"
    fake.fail["cards/capture_cancel"] = "action_failed"
    r = cap_cancel(c, sid)
    assert r.status_code == 504 and r.json()["details"]["outcome"] == "unknown" and "עד שתי דקות" in r.json()["user_message"]
    assert r.json()["details"]["capture"]["state"] == "cancel_unknown" and r.json()["details"]["capture"]["reader_may_be_collecting"] is True
    assert cap_start(c, user="sid").json()["code"] == "intercom_capture_station_busy", "held after an unknown cancel"
    del fake.fail["cards/capture_cancel"]
    assert [r["details"]["outcome"] for r in audit_rows(s, "intercom.card_capture.cancel", "outcome")] == ["refused", "unknown"]
    # confirm: the table
    for code in intercom_client.CAPTURE_CONFIRM_REFUSED:
        assert intercom_client.refusal_is_pre_device("cards/capture_confirm", code)
    for code in ("storage_write_failed", "manager_closed", "action_failed", "device_unavailable", ""):
        assert not intercom_client.refusal_is_pre_device("cards/capture_confirm", code)
    cases = [("capture_not_ready", 409, "refused", "captured"), ("invalid_text", 422, "refused", "captured"), ("rate_limited", 429, "refused", "captured"),
             ("card_conflict", 409, "refused", "closed"), ("revision_conflict", 409, "refused", "closed"), ("card_capacity", 422, "refused", "closed"),
             ("capture_not_found", 404, "refused", "lost"), ("storage_write_failed", 504, "unknown", "unconfirmed"), ("manager_closed", 504, "unknown", "unconfirmed")]
    station = iter(["entry-c", "entry-a", "entry-c", "entry-a", "entry-c", "entry-a", "entry-c", "entry-a"])
    intercom_capture.CAPTURES._holds.clear()
    with fake.lock:
        fake.sessions.clear()  # the session whose cancel went unanswered: WisKey let it go meanwhile
    current = None
    for code, status, outcome, after in cases:
        if current is None:
            current = cap_start(c, station=next(station)).json()["capture"]["session_id"]
            fake.present(sid=current)
            wait_state(c, current, "captured")
        fake.fail["cards/capture_confirm"] = code
        r = cap_confirm(c, current)
        assert r.status_code == status and r.json()["details"]["outcome"] == outcome, (code, r.text)
        assert r.json()["details"]["capture"]["state"] == after, code
        if outcome == "unknown":
            assert "טענו מחדש" in r.json()["user_message"]
        if after != "captured":
            with fake.lock:
                fake.sessions.pop(current, None)  # WisKey dropped it
            intercom_capture.CAPTURES._holds.clear()
            current = None
    del fake.fail["cards/capture_confirm"]
    confirm_outcomes = [r["details"]["outcome"] for r in audit_rows(s, "intercom.card_capture.confirm", "outcome")]
    assert confirm_outcomes == [o for _c, _s, o, _a in cases]
    no_card_digits_in_audit(s)


def test_a_capture_never_blocks_a_door_release(feed, fast_capture, monkeypatch):
    """Lane isolation (brief §0.3): a capture start WisKey holds occupies the capture lane's single slot - a second
    capture is `busy` - while a door release still goes through on the action lane and a people save on the config
    lane; a capture being followed by the poller does not take an action slot either."""
    monkeypatch.setattr(intercom_sync, "CAPTURE_TIMEOUT_S", 0.3)
    monkeypatch.setattr(intercom_sync, "CAPTURE_SLOT_WAIT_S", 0.1)
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake, lambda msg: [ok(msg, {"accepted": True})] if msg["type"] == UNLOCK else None)
    sid = cap_start(c).json()["capture"]["session_id"]
    wait_state(c, sid, "waiting")
    assert release(c).status_code == 200, "a capture being followed does not block a release"
    fake.hold.add("cards/capture_start")
    r = cap_start(c, user="sid", station="entry-c")
    assert r.status_code == 504 and r.json()["details"]["wiskey_code"] == "timeout"
    assert intercom_sync.SYNC._capture_inflight._value == 0, "the unanswered start still holds the capture slot"
    r = cap_start(c, user="sid", station="entry-c")
    assert r.json()["code"] in ("intercom_capture_station_busy", "intercom_busy") and r.json()["details"]["outcome"] == "not_sent"
    assert release(c, station="entry-a").status_code in (200, 409), "the action lane is untouched"
    assert release(c, station="entry-c", lock=1).status_code == 200
    assert update(c).status_code == 200, "and so is the config lane"
    assert intercom_sync.SYNC._action_inflight._value == intercom_sync.ACTION_INFLIGHT


def test_card_readers_errors_are_honest(feed, fast_capture):
    """A station that advertises no card collection, an offline one: the read's state says WisKey's code; an answer
    that is not a reader list is `invalid_response`."""
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake)
    for code in ("capture_unsupported", "station_offline", "device_unavailable"):
        fake.fail["cards/reader_capabilities"] = code
        r = c.get("/api/v1/intercom/stations/entry-a/card-readers", headers=as_user("sam"))
        assert r.status_code == 200 and r.json()["state"] == "error" and r.json()["last_error"] == code and r.json()["readers"] is None
    del fake.fail["cards/reader_capabilities"]
    fake.readers = {"readers": [], "card_min": 1, "card_max": 32}
    assert c.get("/api/v1/intercom/stations/entry-a/card-readers", headers=as_user("sam")).json()["last_error"] == "invalid_response"
    assert c.get(f"/api/v1/intercom/stations/{'x' * 200}/card-readers", headers=as_user("sam")).status_code == 422


def test_capture_projections_never_pass_a_full_number():
    """The masked form only: a status whose card carries a full-looking number is served as the bare mask; an unknown
    technology or reader id is dropped; an answer without a string session id or a known state raises (unknown)."""
    view = intercom_sync.project_capture_session({"session_id": "a" * 32, "state": "captured", "error": None, "card": {"masked_number": "ABCD5678", "technology": "Magic", "reader_id": 12, "card_no": "ABCD5678"}})
    assert view["card"] == {"masked_number": "••••", "technology": None, "reader_id": None}
    assert "ABCD" not in json.dumps(view)
    for bad in (None, {}, {"session_id": 5, "state": "preparing"}, {"session_id": "x y", "state": "preparing"}, {"session_id": "abc", "state": "done"}):
        with pytest.raises(ValueError):
            intercom_sync.project_capture_session(bad)
    assert intercom_sync.project_capture_session({"session_id": "abc", "state": "error", "error": "Device said: <xml>"})["error"] == "capture_failed"
    with pytest.raises(ValueError):
        intercom_sync.project_readers({"readers": [9]})
    with pytest.raises(ValueError):
        intercom_sync.project_cancelled({"cancelled": "yes"})


def test_capture_polling_never_spends_user_tokens_and_a_cancel_is_never_refused_locally(feed, fast_capture, monkeypatch):
    """Review round 1 (M1): the poller's status reads come from a bucket of their own, so two sessions followed for a
    long while leave their owners' (and the lane's shared) capture buckets exactly as the starts left them; and a
    cancel spends no token at all - with the capture buckets empty, a third user's cancel still reaches WisKey.

    "A long while" (60+ status reads) is real background-thread activity on the wall clock, not a fixed timeout, so
    it cannot be driven by a fake clock; instead the wait_for bound is generous by default (scaled further by
    SW_TEST_TIME_FACTOR) so a busy machine has time to reach the count at `fast_capture`'s ordinary cadence. SW_PERF=1
    keeps the original tight bound (15 s) on a quiet machine. The cancel below is raced by the poller's reads at that
    same fast cadence: it records `cancelled` before the lane's slot is freed (T054, see
    test_capture_cancel_is_recorded_before_the_lane_slot_is_freed), so no read can report the session `lost` first."""
    for name in ("CAPTURE_USER_RATE", "CAPTURE_GLOBAL_RATE"):
        monkeypatch.setattr(intercom_sync, name, 0.0)  # no refill: any spend would show
    monkeypatch.setattr(intercom_sync, "CAPTURE_USER_BURST", 3.0)
    monkeypatch.setattr(intercom_sync, "CAPTURE_GLOBAL_BURST", 3.0)
    monkeypatch.setattr(intercom_sync, "CAPTURE_POLL_BURST", 1000.0)
    monkeypatch.setattr(intercom_sync, "CAPTURE_POLL_RATE", 1000.0)
    poll_timeout = 15.0 if sw_perf_enabled() else 60.0 * sw_time_factor()
    fourth = {**copy.deepcopy(STATION), "id": "entry-d", "name": "Back door"}
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake, overview={**copy.deepcopy(EDITOR_OVERVIEW), "stations": [*EDITOR_OVERVIEW["stations"], fourth]})
    bind(c, feed[1], "tess", "site_admin", "installation", "*")
    first = cap_start(c).json()["capture"]["session_id"]
    second = cap_start(c, user="sid", station="entry-c").json()["capture"]["session_id"]
    third = cap_start(c, user="tess", station="entry-d").json()["capture"]["session_id"]
    sync = intercom_sync.SYNC
    buckets = {who: sync._capture_user_buckets[f"dev-{who}"].tokens for who in ("sam", "sid", "tess")}
    assert buckets == {"sam": 2.0, "sid": 2.0, "tess": 2.0} and sync._capture_global_bucket.tokens == 0.0, "each start spent one token"
    wait_for(lambda: len(sent(fakes, "cards/capture_status")) >= 60, poll_timeout)  # many polls of three sessions (the owners keep reading)
    for sid, who in ((first, "sam"), (second, "sid")):
        assert cap_status(c, sid, who).json()["capture"]["state"] == "waiting"
    assert {who: sync._capture_user_buckets[f"dev-{who}"].tokens for who in ("sam", "sid", "tess")} == buckets, "polling spent no user token"
    assert sync._capture_global_bucket.tokens == 0.0, "nor the lane's shared ones"
    r = cap_cancel(c, third, user="tess")
    assert r.status_code == 200 and r.json()["capture"]["state"] == "cancelled", r.text
    assert [m["session_id"] for m in sent(fakes, "cards/capture_cancel")] == [third]


def test_capture_cancel_is_recorded_before_the_lane_slot_is_freed(feed, fast_capture, monkeypatch):
    """T054 regression: the capture lane's one slot stays the cancel's until the cancel's own outcome is recorded. It
    used to be freed by the WisKey call's done-callback (on the feed's loop) while the request thread had yet to record
    `cancelled`; a poller status read due in that gap took the slot, found the session WisKey had just dropped
    (`capture_not_found`) and recorded `lost` - and the cancel's reply then said `lost`.

    Deterministic, no sleeps: the fake WisKey answers the cancel, and the test holds the request thread right there
    (inside the projection of that answer, before anything is recorded), lets the feed's loop finish handing the answer
    over (so every done-callback has run), and drives one poller read that is due right now. The old code sends that
    read and records `lost`; now the read finds the slot taken and skips its tick."""
    monkeypatch.setattr(intercom_sync, "CAPTURE_POLL_BURST", 1000.0)  # the poller's own bucket never decides the read below
    monkeypatch.setattr(intercom_sync, "CAPTURE_POLL_RATE", 1000.0)
    fake = FakeEnrollment()
    app, fakes, c = capture_feed(feed, fake)
    sid = cap_start(c).json()["capture"]["session_id"]
    wait_state(c, sid, "waiting")  # the background poller keeps reading at `fast_capture`'s cadence throughout
    capture = intercom_capture.CAPTURES._sessions[sid]
    sync = intercom_sync.SYNC
    real = intercom_sync.project_cancelled
    gap: dict[str, Any] = {}

    def project_cancelled(raw: Any) -> dict[str, Any]:
        # WisKey answered the cancel (and dropped the session); this request thread has the answer but recorded nothing yet
        asyncio.run_coroutine_threadsafe(asyncio.sleep(0), sync._event_loop).result(timeout=5)  # the loop's hand-over (and its done-callbacks) is over
        before = len(sent(fakes, "cards/capture_status"))
        capture.last_poll = time.monotonic() - 10_000.0  # a poller read is due right now
        intercom_capture.CAPTURES._tick(capture, time.monotonic())
        gap.update(reads=len(sent(fakes, "cards/capture_status")) - before, state=capture.state)
        return real(raw)

    monkeypatch.setattr(intercom_sync, "project_cancelled", project_cancelled)
    r = cap_cancel(c, sid)
    assert gap == {"reads": 0, "state": "waiting"}, "a poller read due in the gap finds the slot still the cancel's and skips its tick"
    assert r.status_code == 200 and r.json()["capture"]["state"] == "cancelled", r.text
    assert not [row for row in capture_rows(feed[1]) if row["action"] == "intercom.card_capture.result"], "no `lost` result is recorded for a cancelled session"
    monkeypatch.setattr(intercom_sync, "project_cancelled", real)
    r = cap_start(c)
    assert r.status_code == 200, "the slot is free again once the cancel is recorded and WisKey's call is over"


def test_capture_poller_backs_off_with_several_sessions():
    """One read per session every POLL_S (2 s), every POLL_BUSY_S (3 s) while more than one session is followed: three
    sessions cost WisKey at most one read a second."""
    assert intercom_capture.POLL_S == 2.0 and intercom_capture.POLL_BUSY_S == 3.0 and intercom_capture.COLLECT_S == 30.0
    assert 3 / intercom_capture.POLL_BUSY_S <= intercom_sync.CAPTURE_POLL_RATE <= 1.0 and intercom_sync.CAPTURE_POLL_BURST >= 3
