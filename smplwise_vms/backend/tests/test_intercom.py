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
        t0 = time.monotonic()
        body = TestClient(app).get("/api/v1/intercom/people/u1").json()
        assert time.monotonic() - t0 < 1.0, "no blocking wait for a slot"
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
    for path, key in (("/api/v1/intercom/people/u1", "person"), ("/api/v1/intercom/people", "people")):
        body = c.get(path).json()
        assert (body["state"], body["last_error"], body[key], body["fetched_at"]) == ("error", "invalid_response", None, None), path
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
