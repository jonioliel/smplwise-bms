"""T035 - the recorded pilot outage / safety run: disconnect scenarios on fakes (no lab, no device, no Home Assistant).

Every scenario walks one outage through its whole cycle - healthy, the fault, during the fault, recovery - on the real add-on
code, with only the far side faked (the scripted Home Assistant WebSocket of tests/test_intercom.py that WisKey answers
through, an httpx MockTransport for the bridge's `execute` and the NVR alert stream, the go2rtc fake of
tests/test_recordings.py, a SQLite connection that refuses writes for a full disk). Each one proves four things:

1. Arx degrades safely and no door opens (no unlock frame / no `execute` reaches the far side during the fault);
2. no write is replayed (nothing refused or cut off during the fault is sent again on reconnect, a resubmitted command id is
   refused or answered from its record);
3. the operator sees a clear state (the HTTP answer's code / `outcome`, the WisKey screen's feed state, the top-bar summary);
4. recovery happens without manual steps where it should (and where it cannot - a revoked token - the operator is told so).

Each test prints one `T035_SCENARIO {json}` line with what it observed; docs/changes/T035-OUTAGE-RUN-2405.md carries the table
and the runner receipt (`pytest -rA` shows the lines)."""
from __future__ import annotations

import asyncio
import collections
import copy
import json
import re
import sqlite3
import threading
import time
import uuid
from dataclasses import replace
from typing import Any, Callable

import httpx
import pytest
from fastapi.testclient import TestClient
from test_intercom import ACTIONS_OVERVIEW, CLOSE, STATION, UNLOCK, FakeHa, audit_rows, env, fail, feed, ha_config, normal, ok, sent  # noqa: F401 - `feed` is a fixture
from test_recordings import FakeGo2rtc

from smplwise import db as dbmod
from smplwise.db import Database
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.routers import access_control
from smplwise.services import autosync, events_ingest, go2rtc, ha_bridge, ha_client, ha_sync, health_report, intercom_sync, intercom_write_journal, nvr


def record(scenario: str, **observed: Any) -> None:
    print("T035_SCENARIO " + json.dumps({"scenario": scenario, **observed}, ensure_ascii=False, sort_keys=True, default=str))


@pytest.fixture(autouse=True)
def _fresh_relays():
    access_control.RELAYS.clear()
    yield
    access_control.RELAYS.clear()


# ---------------------------------------------------------------- the faked Home Assistant / WisKey side

class GatedHa(FakeHa):
    """FakeHa whose auth answer follows `gate["revoked"]` and which remembers its event loop, so the test can end the live
    session from its own thread (HA going away)."""

    def __init__(self, script: Callable[[dict[str, Any], FakeHa], list[Any]], gate: dict[str, Any]) -> None:
        super().__init__(script)
        self.gate = gate
        self.loop: asyncio.AbstractEventLoop | None = None

    async def send(self, raw: str) -> None:
        self.loop = asyncio.get_running_loop()
        msg = json.loads(raw)
        if msg.get("type") == "auth" and self.gate.get("revoked"):
            assert self.q
            self.sent.append(msg)
            self.q.put_nowait({"type": "auth_invalid", "message": "Invalid access"})
            return
        await super().send(raw)

    def drop(self) -> None:
        assert self.loop and self.q
        self.loop.call_soon_threadsafe(self.q.put_nowait, CLOSE)


def wiskey_script(gate: dict[str, Any]) -> Callable[[dict[str, Any], FakeHa], list[Any]]:
    """A Home Assistant with WisKey loaded; switches: `wiskey_loading` (WisKey's commands unknown), `ha_state` (HA's CoreState),
    `unlock_silent` (WisKey never answers the unlock)."""

    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        kind = msg["type"]
        if kind == UNLOCK:
            return [] if gate.get("unlock_silent") else [ok(msg, {"accepted": True})]
        if kind == "hikvision_intercom/overview" and gate.get("wiskey_loading"):
            return [fail(msg, "unknown_command")]
        if kind == "get_config":
            return [ha_config(msg, gate.get("ha_state", "RUNNING"))]
        return normal(msg, fake, gate.get("overview", ACTIONS_OVERVIEW))

    return script


def wire(monkeypatch, gate: dict[str, Any]) -> list[GatedHa]:
    """websockets.connect -> a GatedHa while `gate["down"]` is None; else it raises `gate["down"]()` (HA away)."""
    import websockets

    fakes: list[GatedHa] = []
    gate.setdefault("refused", 0)

    def connect(url: str, **_kw: Any) -> GatedHa:
        down = gate.get("down")
        if down is not None:
            gate["refused"] += 1
            raise down()
        fake = GatedHa(wiskey_script(gate), gate)
        fakes.append(fake)
        return fake

    monkeypatch.setattr(websockets, "connect", connect)
    return fakes


def wait_for(pred: Callable[[], bool], timeout: float = 8.0, what: str = "") -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met ({what}); feed state {intercom_sync.STATE.as_dict()}")


def start_feed(feed, monkeypatch, gate: dict[str, Any]) -> tuple[Any, Any, list[GatedHa], TestClient]:
    app, s, _install = feed
    fakes = wire(monkeypatch, gate)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready", what="ready")
    return app, s, fakes, TestClient(app, raise_server_exceptions=False)


def release(c: TestClient, station: str = "entry-a", body: dict[str, Any] | None = None) -> httpx.Response:
    return c.post(f"/api/v1/intercom/stations/{station}/release", json=body or env(confirmed=True))


def unlocks(fakes: list[GatedHa]) -> int:
    return len(sent(fakes, "stations/test_unlock"))


def outcomes(s: Any) -> list[str]:
    return [r["details"]["outcome"] for r in audit_rows(s, "intercom.release", "outcome")]


def overview(c: TestClient) -> dict[str, Any]:
    return c.get("/api/v1/intercom/overview").json()


def summary_items(c: TestClient) -> dict[str, dict[str, str]]:
    return {i["id"]: i for i in c.get("/api/v1/health/summary").json()["items"]}


@pytest.fixture()
def ha_state_saved():
    """ha_sync.STATE is process-wide: the scenarios that set it put it back."""
    st = ha_sync.STATE
    saved = {k: getattr(st, k) for k in ("connected", "last_snapshot_at", "last_error")}
    yield st
    for k, v in saved.items():
        setattr(st, k, v)


# ---------------------------------------------------------------- the bridge `execute` side (device tiles, a non-WisKey lock)

STATES = [
    {"entity_id": "lock.front", "state": "locked", "attributes": {"friendly_name": "Front door", "device_class": "lock"},
     "last_changed": "2026-11-01T09:00:00+00:00", "last_updated": "2026-11-01T09:00:00+00:00"},
    {"entity_id": "light.lobby", "state": "off", "attributes": {"friendly_name": "Lobby light", "supported_features": 44},
     "last_changed": "2026-11-01T10:00:00+00:00", "last_updated": "2026-11-01T10:00:00+00:00"},
]


@pytest.fixture()
def bridge(settings, monkeypatch, ha_state_saved):
    """A paired bridge, the dev administrator holding `door.unlock` (a custom role), and Home Assistant's REST endpoint behind a
    MockTransport whose `mode` is: `ok`, `connect_error` (the connection is never made), `read_timeout` (the command left, no
    answer came back), `401` (Home Assistant refused the token)."""
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    c = TestClient(app, raise_server_exceptions=False)
    secret = c.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert c.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.1.0"})).status_code == 200
    opener = c.post("/api/v1/access/roles", json={"name": "פותח מנעולים", "permissions": ["map.read"], "sensitive": ["door.unlock"]}).json()
    assert c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-joni", "role_id": opener["id"], "scope_type": "installation", "scope_id": "*"}).status_code == 201
    far: dict[str, Any] = {"mode": "ok", "delivered": []}

    def handler(req: httpx.Request) -> httpx.Response:
        mode = far["mode"]
        if mode == "connect_error":
            raise httpx.ConnectError("connection refused", request=req)
        far["delivered"].append(json.loads(req.content))  # the request reached Home Assistant
        if mode == "read_timeout":
            raise httpx.ReadTimeout("no answer", request=req)
        if mode == "401":
            return httpx.Response(401, text="unauthorized")
        return httpx.Response(200, json={"service_response": {"ok": True, "context_id": "ctx-1"}})

    monkeypatch.setattr(ha_client, "_bridge_client", lambda _s: httpx.Client(transport=httpx.MockTransport(handler)))
    return app, s, c, far


def unlock_body(request_id: str | None = None) -> dict[str, Any]:
    return {"allowed_action_id": "lock.unlock", "arguments": {}, "expected_state_version": None, "confirmation_grant": "confirmed",
            "client_request_id": request_id or uuid.uuid4().hex[:16], "expires_at": "2099-01-01T00:00:00Z"}


def unlock(c: TestClient, request_id: str | None = None) -> httpx.Response:
    return c.post("/api/v1/ha/entities/lock.front/actions", json=unlock_body(request_id))


def action_rows(s: Any) -> list[dict[str, Any]]:
    with Database(s.db_path).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT id, client_request_id, status, error FROM ha_actions ORDER BY rowid").fetchall()]


# ================================================================ S01 - Home Assistant restarts

def test_s01_ha_restart_door_path(feed, monkeypatch):
    """HA restarts under a ready WisKey feed: the socket drops, connects are refused, then HA answers while WisKey is still
    loading, then everything is back. No door command leaves while HA is away; the refused ones are never sent later; the
    WisKey screen keeps the last copy marked not fresh; the feed comes back by itself."""
    gate: dict[str, Any] = {}
    app, s, fakes, c = start_feed(feed, monkeypatch, gate)
    assert release(c).status_code == 200 and unlocks(fakes) == 1, "baseline: one release, one frame"

    gate["down"] = lambda: ConnectionRefusedError("HA restarting")
    fakes[-1].drop()
    wait_for(lambda: intercom_sync.STATE.state == "ha_unavailable" and gate["refused"] >= 2, what="HA away")
    during = release(c)
    view = overview(c)
    assert during.status_code == 503 and during.json()["details"]["outcome"] == "not_sent"
    assert view["state"] == "ha_unavailable" and view["fresh"] is False and view["overview"]["stations"], "the last copy, marked not fresh"
    assert ha_sync.classify_failure(ConnectionRefusedError()) == ha_sync.ERR_RESTARTING
    assert ha_sync.next_backoff(ha_sync.ERR_RESTARTING, 60.0, time.monotonic(), time.monotonic()) <= ha_sync.RESTART_BACKOFF_CAP_S, "quick retries while it restarts"

    gate.update(down=None, wiskey_loading=True, ha_state="STARTING")  # HA answers, WisKey not loaded yet
    wait_for(lambda: intercom_sync.STATE.state == "connecting" and intercom_sync.STATE.last_error == intercom_sync.LOADING, what="loading")
    loading = release(c)
    assert loading.status_code == 503 and loading.json()["details"]["outcome"] == "not_sent"

    gate.update(wiskey_loading=False, ha_state="RUNNING")
    wait_for(lambda: intercom_sync.STATE.state == "ready", what="recovered")
    time.sleep(0.3)  # a few poll cycles after the reconnect
    assert unlocks(fakes) == 1, "nothing refused during the restart was sent after it"
    after = release(c)
    assert after.status_code == 200 and unlocks(fakes) == 2
    assert outcomes(s) == ["ok", "not_sent", "not_sent", "ok"]
    record("S01 HA restart (door path)", during=[during.status_code, during.json()["code"], during.json()["user_message"]],
           loading=[loading.status_code, loading.json()["code"]], feed_states=["ha_unavailable", "connecting/wiskey_loading", "ready"],
           unlock_frames=unlocks(fakes), audit_outcomes=outcomes(s), recovered_without_manual_step=True)


# ================================================================ S02 - Home Assistant unreachable

def test_s02_ha_unreachable_door_path_and_summary(feed, monkeypatch, ha_state_saved):
    """The host cannot be reached at all (no route): the same refusal, the summary tells the operator entity states may be
    stale, and the feed reconnects once the network is back."""
    gate: dict[str, Any] = {}
    app, s, fakes, c = start_feed(feed, monkeypatch, gate)
    gate["down"] = lambda: OSError(113, "No route to host")
    fakes[-1].drop()
    wait_for(lambda: intercom_sync.STATE.state == "ha_unavailable" and gate["refused"] >= 2, what="unreachable")
    r = release(c)
    assert r.status_code == 503 and r.json()["details"]["outcome"] == "not_sent" and unlocks(fakes) == 0
    assert ha_sync.classify_failure(OSError(113, "No route to host")) == ha_sync.ERR_UNREACHABLE
    ha_state_saved.connected, ha_state_saved.last_snapshot_at, ha_state_saved.last_error = False, "2026-11-06T08:00:00Z", ha_sync.ERR_UNREACHABLE
    item = summary_items(c)["ha"]
    assert item["status"] == "warn" and "מיושנים" in item["label"]
    gate["down"] = None
    wait_for(lambda: intercom_sync.STATE.state == "ready", what="back")
    ha_state_saved.connected = True
    assert "ha" not in summary_items(c)
    assert unlocks(fakes) == 0 and release(c).status_code == 200 and unlocks(fakes) == 1
    record("S02 HA unreachable (door path)", release=[r.status_code, r.json()["code"]], summary_item=item, unlock_frames=unlocks(fakes),
           audit_outcomes=outcomes(s), recovered_without_manual_step=True)


def test_s02_bridge_execute_transport_failures_are_told_apart(bridge):
    """A device tile's unlock of a non-WisKey lock goes through the bridge's `execute`. A connection that is never made sent
    nothing (failed, retryable); a read timeout comes AFTER the command left - HA may have opened the lock - so the record is
    `unknown` and the answer is a non-retryable 504 that says so (T035 fix: it was recorded `failed`, shown "נכשל", and
    answered `retryable: true`). A resubmitted click is answered from its record; nothing is sent twice."""
    app, s, c, far = bridge
    far["mode"] = "connect_error"
    refused = unlock(c, "click-connect")
    assert refused.status_code == 503 and refused.json()["code"] == "ha_unavailable" and refused.json()["retryable"] is True
    assert far["delivered"] == [] and action_rows(s)[-1]["status"] == "failed", "never reached HA: failed is the truth"

    far["mode"] = "read_timeout"
    cut = unlock(c, "click-timeout")
    body = cut.json()
    assert cut.status_code == 504 and body["code"] == "action_outcome_unknown" and body["retryable"] is False, body
    assert body["details"]["outcome"] == "unknown" and "לא ידוע אם הפקודה בוצעה" in body["user_message"]
    row = c.get(f"/api/v1/ha/actions/{body['details']['action_id']}").json()
    assert row["status"] == "unknown" and row["error"] == "ha_unavailable" and len(far["delivered"]) == 1

    far["mode"] = "ok"
    again = unlock(c, "click-timeout")  # the same click resubmitted once the link is back
    assert again.json()["id"] == body["details"]["action_id"] and again.json()["status"] == "unknown" and len(far["delivered"]) == 1, "no replay"
    fresh = unlock(c)
    assert fresh.status_code == 202 and fresh.json()["status"] == "pending" and len(far["delivered"]) == 2
    record("S02 HA unreachable (bridge execute)", connect_error=[refused.status_code, refused.json()["code"], "failed", "retryable"],
           read_timeout=[cut.status_code, body["code"], row["status"], "not retryable"], delivered=len(far["delivered"]),
           rows=[(r["client_request_id"], r["status"]) for r in action_rows(s)])


# ================================================================ S03 - the Home Assistant token is revoked

def test_s03_token_revoked(feed, monkeypatch, ha_state_saved):
    """HA refuses the add-on's token: every reconnect is answered `auth_invalid`. Nothing is sent, the summary says the access
    was refused (an error, not "reconnecting" - waiting does not heal a revoked token), and once a valid token is back the feed
    returns by itself, without a replay."""
    gate: dict[str, Any] = {}
    app, s, fakes, c = start_feed(feed, monkeypatch, gate)
    gate["revoked"] = True
    fakes[-1].drop()
    wait_for(lambda: intercom_sync.STATE.state == "ha_unavailable" and intercom_sync.STATE.last_error == "ha_forbidden", what="refused")
    r = release(c)
    assert r.status_code == 503 and r.json()["details"]["outcome"] == "not_sent" and unlocks(fakes) == 0
    assert ha_sync.classify_failure(ApiError(503, "ha_forbidden", "x")) == "ha_forbidden"
    ha_state_saved.connected, ha_state_saved.last_snapshot_at, ha_state_saved.last_error = False, "2026-11-06T08:00:00Z", "ha_forbidden"
    item = summary_items(c)["ha"]
    assert item["status"] == "error" and "דחתה את הרשאת הגישה" in item["label"], item
    tries = len(fakes)
    time.sleep(0.5)
    assert len(fakes) > tries, "it keeps trying on its backoff (it does not give up)"
    gate["revoked"] = False  # a valid token again (the add-on restarted with a fresh Supervisor token / the owner's new token)
    wait_for(lambda: intercom_sync.STATE.state == "ready", what="token back")
    ha_state_saved.connected, ha_state_saved.last_error = True, None
    assert "ha" not in summary_items(c) and unlocks(fakes) == 0
    record("S03 HA token revoked (door path)", release=[r.status_code, r.json()["code"]], feed_last_error="ha_forbidden", summary_item=item,
           unlock_frames=unlocks(fakes), recovered_after_token_restored=True, manual_step="a valid token (add-on restart / owner's new token)")


def test_s03_bridge_execute_refused_token(bridge):
    """The bridge call answered 401: HA refused it, nothing happened - `failed` / `ha_forbidden`, and the same click is not resent."""
    app, s, c, far = bridge
    far["mode"] = "401"
    r = unlock(c, "click-401")
    assert r.status_code == 503 and r.json()["code"] == "ha_forbidden"
    assert action_rows(s)[-1]["status"] == "failed" and action_rows(s)[-1]["error"] == "ha_forbidden"
    far["mode"] = "ok"
    assert unlock(c, "click-401").json()["status"] == "failed" and len(far["delivered"]) == 1
    record("S03 HA token revoked (bridge execute)", answer=[r.status_code, r.json()["code"]], row="failed/ha_forbidden", delivered=len(far["delivered"]))


# ================================================================ S04 - WisKey unavailable or restarting

def test_s04_wiskey_restarting(feed, monkeypatch):
    """WisKey reloads while HA keeps RUNNING. (a) back within the re-probe window: the feed stays `connecting` with the copy and
    returns to ready by itself; (b) away longer: concluded `not_installed` (copy dropped), re-probed on RETRY_ABSENT_S (five
    minutes in production, shortened here) and back by itself. Every release in between is refused, never sent later."""
    monkeypatch.setattr(intercom_sync, "ABSENT_AFTER_READY", 1000)
    gate: dict[str, Any] = {}
    app, s, fakes, c = start_feed(feed, monkeypatch, gate)
    gate["wiskey_loading"] = True
    fakes[-1].drop()
    wait_for(lambda: intercom_sync.STATE.state == "connecting", what="reloading")
    a = release(c)
    view_a = overview(c)
    assert a.status_code == 503 and a.json()["details"]["outcome"] == "not_sent" and view_a["fresh"] is False and view_a["overview"]
    gate["wiskey_loading"] = False
    wait_for(lambda: intercom_sync.STATE.state == "ready", what="reloaded")

    monkeypatch.setattr(intercom_sync, "ABSENT_AFTER_READY", 2)
    monkeypatch.setattr(intercom_sync, "RETRY_ABSENT_S", 0.6)
    gate["wiskey_loading"] = True
    fakes[-1].drop()
    wait_for(lambda: intercom_sync.STATE.state == "not_installed", what="absent")
    b = release(c)
    view_b = overview(c)
    assert b.status_code == 503 and b.json()["details"]["outcome"] == "not_sent" and view_b["overview"] is None
    gate["wiskey_loading"] = False
    wait_for(lambda: intercom_sync.STATE.state == "ready", what="re-probed")
    assert unlocks(fakes) == 0 and release(c).status_code == 200 and unlocks(fakes) == 1
    record("S04 WisKey restarting", within_window=[a.status_code, a.json()["details"].get("state"), "copy kept, not fresh"],
           beyond_window=[b.status_code, b.json()["details"].get("state"), "copy dropped"], unlock_frames=unlocks(fakes),
           recovered_without_manual_step=True, known_limit=f"beyond the window the re-probe waits RETRY_ABSENT_S (production {300.0:.0f} s)")


def test_s04_wiskey_unavailable_station_offline_and_no_answer(feed, monkeypatch):
    """WisKey up but a station offline: refused before sending. WisKey stops answering mid-command: 504 outcome unknown, the
    relay stays held (a second press is 409), exactly one frame, and the reconnect replays nothing."""
    monkeypatch.setattr(intercom_sync, "ACTION_TIMEOUT_S", 0.4)
    store_room = {**copy.deepcopy(STATION), "id": "entry-d", "name": "Store room", "online": False, "call_state": "unavailable"}
    gate: dict[str, Any] = {"overview": {**copy.deepcopy(ACTIONS_OVERVIEW), "stations": [*ACTIONS_OVERVIEW["stations"], store_room]}}
    app, s, fakes, c = start_feed(feed, monkeypatch, gate)
    offline = release(c, "entry-d")
    assert offline.status_code == 409 and offline.json()["details"]["outcome"] == "not_sent" and unlocks(fakes) == 0

    gate["unlock_silent"] = True
    cut = release(c)
    assert cut.status_code == 504 and cut.json()["details"]["outcome"] == "unknown" and cut.json()["details"]["retry_after_s"] > 0
    second = release(c)
    assert second.status_code == 409 and second.json()["code"] == "intercom_release_in_progress" and unlocks(fakes) == 1
    fakes[-1].drop()  # WisKey's side restarts
    wait_for(lambda: intercom_sync.STATE.state in ("ha_unavailable", "connecting", "ready") and len(fakes) >= 2, what="reconnect")
    wait_for(lambda: intercom_sync.STATE.state == "ready", what="ready again")
    time.sleep(0.3)
    assert unlocks(fakes) == 1, "the unanswered command is never resent"
    record("S04 WisKey unavailable", station_offline=[offline.status_code, offline.json()["code"]], no_answer=[cut.status_code, cut.json()["code"]],
           second_press=[second.status_code, second.json()["code"]], unlock_frames=unlocks(fakes), audit_outcomes=outcomes(s))


# ================================================================ S05 - NVR and go2rtc down

HEARTBEAT = ("<EventNotificationAlert version=\"2.0\" xmlns=\"http://www.hikvision.com/ver20/XMLSchema\"><channelID>1</channelID>"
             "<dateTime>2026-11-06T10:00:00+02:00</dateTime><activePostCount>0</activePostCount><eventType>videoloss</eventType>"
             "<eventState>inactive</eventState><eventDescription>videoloss alarm</eventDescription></EventNotificationAlert>")


class _QuickStop(threading.Event):
    """The listener's back-off waits on its stop event; capped so the test sees reconnects in milliseconds."""

    def wait(self, timeout: float | None = None) -> bool:
        return super().wait(0.05 if timeout is None else min(timeout, 0.05))


@pytest.fixture()
def ingest_state_saved():
    st = events_ingest.STATE
    keys = ("connected", "disconnected_since", "last_heartbeat_at", "last_error", "reconnects")
    saved = {k: getattr(st, k) for k in keys}
    auto = dict(autosync.STATE)
    yield st
    for k, v in saved.items():
        setattr(st, k, v)
    autosync.STATE.clear()
    autosync.STATE.update(auto)


def test_s05_nvr_down_alert_stream(settings, monkeypatch, ingest_state_saved):
    """The NVR stops answering: the alert stream fails, the summary says "NVR מנותק" (error), the listener keeps retrying on its
    own, and when the NVR is back the outage is recorded as a coverage gap (NVR continuity) and the error clears. Only reads
    ever go to the NVR."""
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc.test:1984")
    app = create_app(s)
    c = TestClient(app)
    st = ingest_state_saved
    st.connected, st.disconnected_since, st.last_heartbeat_at, st.last_error = False, None, None, None
    autosync.STATE.update(cameras_last_error=None, streams_last_error=None)
    monkeypatch.setattr(events_ingest, "GAP_AFTER_S", 0)
    dev: dict[str, Any] = {"down": True, "requests": [], "hold": threading.Event()}

    def handler(req: httpx.Request) -> httpx.Response:
        dev["requests"].append((req.method, req.url.path))
        if dev["down"]:
            raise httpx.ConnectError("no route to host", request=req)

        def stream():
            yield HEARTBEAT.encode() + b" " * 4096  # a full read chunk, so the reader sees it at once
            dev["hold"].wait(30)  # the NVR keeps the stream open

        return httpx.Response(200, content=stream())

    real = httpx.Client
    monkeypatch.setattr(events_ingest.httpx, "Client", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    listener = events_ingest.AlertStreamListener()
    listener.stop = _QuickStop()
    t0 = time.monotonic()
    listener.start(app.state.db, s, lambda: "Asia/Jerusalem")
    try:
        wait_for(lambda: len(dev["requests"]) >= 3 and not st.connected, what="NVR down")
        t_down = time.monotonic() - t0
        item = summary_items(c)["nvr"]
        assert item["status"] == "error" and "NVR מנותק" in item["label"]
        dev["down"] = False
        wait_for(lambda: st.connected and st.last_heartbeat_at is not None, what="NVR back")
        t_back = time.monotonic() - t0
        assert "nvr" not in summary_items(c)
        with app.state.db.connection(mode="read") as conn:
            gaps = [dict(r) for r in conn.execute("SELECT type, details_json FROM events WHERE type = 'coverage_gap'").fetchall()]
    finally:
        listener.shutdown()
        dev["hold"].set()
        if listener.thread is not None:
            listener.thread.join(timeout=3)
    assert len(gaps) == 1 and json.loads(gaps[0]["details_json"])["reason"] == "ConnectError"
    assert {m for m, _p in dev["requests"]} == {"GET"} and {p for _m, p in dev["requests"]} == {"/ISAPI/Event/notification/alertStream"}
    record("S05 NVR down (alert stream)", summary_item=item, attempts_while_down=sum(1 for _ in dev["requests"]) - 1, coverage_gap=json.loads(gaps[0]["details_json"]),
           device_requests=sorted({f"{m} {p}" for m, p in dev["requests"]}), recovered_without_manual_step=True,
           seconds={"down_seen": round(t_down, 2), "back_seen": round(t_back, 2), "total": round(time.monotonic() - t0, 2)})


class _Go2rtcDown:
    def __init__(self, *a: Any, **k: Any) -> None:
        pass

    def _down(self, *a: Any, **k: Any) -> Any:
        raise ApiError(503, "go2rtc_unavailable", "go2rtc down", retryable=True)

    list_streams = ensure_stream = delete_stream = info = _down


def test_s05_nvr_and_go2rtc_down_discovery_and_streams(settings, monkeypatch, ingest_state_saved):
    """Discovery with the NVR down keeps the last camera list (warn, "using the previous list"); a go2rtc outage fails the stream
    sync (warn) and the administrator's report says go2rtc is unavailable; the next periodic run heals both. Foreign go2rtc
    streams (the intercom project's) are never touched."""
    s = replace(settings, nvr_host="nvr.test", nvr_user="u", nvr_password="p", go2rtc_url="http://go2rtc.test:1984")
    st = ingest_state_saved
    st.connected, st.disconnected_since, st.last_heartbeat_at = True, None, "2026-11-06T08:00:00Z"
    info = {"model": "DS-7616", "firmware": "V4.84", "device_type": "NVR"}
    nvr_up = {"on": True}

    def device_info(_s):
        if not nvr_up["on"]:
            raise ApiError(503, "source_unavailable", "down", retryable=True)
        return info

    monkeypatch.setattr(nvr, "device_info", device_info)
    monkeypatch.setattr(nvr, "discover_channels", lambda _s: [nvr.DiscoveredChannel(channel=1, name="Entrance", online=True, main_track=101, sub_track=102)])
    monkeypatch.setattr(nvr, "fetch_stream_encodings", lambda _s: {})
    FakeGo2rtc.store = {"intercom_door_1": ["rtsp://door"]}
    FakeGo2rtc.deleted = []
    monkeypatch.setattr(go2rtc, "Go2rtc", FakeGo2rtc)
    app = create_app(s)
    c = TestClient(app)
    autosync.run_once(app.state.db, s, reason="startup")
    assert autosync.STATE["cameras_last_error"] is None and autosync.STATE["streams_last_error"] is None

    nvr_up["on"] = False
    autosync.run_once(app.state.db, s, reason="periodic")
    disc = summary_items(c)["discovery"]
    cams = c.get("/api/v1/cameras").json()["cameras"]
    assert disc["status"] == "warn" and len(cams) == 1, "the previous camera list stays"

    nvr_up["on"] = True
    monkeypatch.setattr(go2rtc, "Go2rtc", _Go2rtcDown)
    autosync.run_once(app.state.db, s, reason="periodic")
    items = summary_items(c)
    health_report.invalidate()
    report = {ch["id"]: ch for ch in c.get("/api/v1/health/report").json()["checks"]}
    assert items["go2rtc"]["status"] == "warn" and "discovery" not in items
    assert report["go2rtc"]["status"] == "error" and "go2rtc אינו זמין" in report["go2rtc"]["detail"]

    monkeypatch.setattr(go2rtc, "Go2rtc", FakeGo2rtc)
    autosync.run_once(app.state.db, s, reason="periodic")
    healed = summary_items(c)
    assert "go2rtc" not in healed and "discovery" not in healed
    assert FakeGo2rtc.store["intercom_door_1"] == ["rtsp://door"] and not [n for n in FakeGo2rtc.deleted if not n.startswith("smplwise_")]
    record("S05 NVR + go2rtc down (discovery / streams)", nvr_down=disc, go2rtc_down_summary=items["go2rtc"], go2rtc_down_report=report["go2rtc"]["detail"],
           cameras_kept=len(cams), foreign_streams_untouched=True, recovered_without_manual_step=True)


# ================================================================ S06 - the remote tunnel drops

def test_s06_tunnel_drop_door_path(feed, monkeypatch):
    """A remote guard's release reached Arx but the answer was lost when the tunnel dropped. When the tunnel is back the app
    resubmits the same envelope: refused as a duplicate (nothing sent). A command whose expiry passed while the tunnel was
    down is refused as expired - never queued. A fresh command works."""
    gate: dict[str, Any] = {}
    app, s, fakes, c = start_feed(feed, monkeypatch, gate)
    body = env(confirmed=True)
    first = release(c, body=body)  # delivered; the client never saw this answer
    assert first.status_code == 200 and unlocks(fakes) == 1
    resent = release(c, body=body)
    assert resent.status_code == 409 and resent.json()["code"] == "intercom_duplicate_command" and resent.json()["details"]["outcome"] == "not_sent"
    stale = env(ttl=0.5, confirmed=True)
    time.sleep(1.2)  # the tunnel was down longer than the command's life
    expired = release(c, body=stale)
    assert expired.status_code == 409 and expired.json()["code"] == "expired" and unlocks(fakes) == 1
    fresh = release(c)
    assert fresh.status_code == 200 and unlocks(fakes) == 2
    record("S06 remote tunnel drop (door path)", resubmitted=[resent.status_code, resent.json()["code"], resent.json()["user_message"]],
           expired=[expired.status_code, expired.json()["code"]], unlock_frames=unlocks(fakes), recovered_without_manual_step=True)


def test_s06_tunnel_drop_device_action(bridge):
    """The same for a device tile: the resubmitted click id is answered from its record, the bridge is called once."""
    app, s, c, far = bridge
    first = unlock(c, "remote-click")
    again = unlock(c, "remote-click")
    assert first.status_code == 202 and again.json()["id"] == first.json()["id"] and len(far["delivered"]) == 1
    record("S06 remote tunnel drop (device action)", first=first.json()["status"], resubmitted_same_record=True, delivered=len(far["delivered"]))


# ================================================================ S07 - the data disk is full

_WRITE = re.compile(r"^\s*(INSERT|UPDATE|DELETE|REPLACE)\b", re.IGNORECASE)
DISK = {"full": False}


class _FullDisk(sqlite3.Connection):
    """Every write statement fails as SQLite fails on a full disk (SQLITE_FULL); reads work, as they do on a full disk."""

    @staticmethod
    def _check(sql: str) -> None:
        if DISK["full"] and _WRITE.match(sql or ""):
            exc = sqlite3.OperationalError("database or disk is full")
            exc.sqlite_errorcode = dbmod.SQLITE_FULL  # type: ignore[attr-defined]
            raise exc

    def execute(self, sql: str, *a: Any, **k: Any) -> sqlite3.Cursor:  # type: ignore[override]
        self._check(sql)
        return super().execute(sql, *a, **k)

    def executemany(self, sql: str, *a: Any, **k: Any) -> sqlite3.Cursor:  # type: ignore[override]
        self._check(sql)
        return super().executemany(sql, *a, **k)


class _Sqlite3Shim:
    def __getattr__(self, name: str) -> Any:
        return getattr(sqlite3, name)

    @staticmethod
    def connect(*a: Any, **k: Any) -> sqlite3.Connection:
        return sqlite3.connect(*a, factory=_FullDisk, **k)


@pytest.fixture()
def full_disk(monkeypatch):
    """Arx's database connections refuse writes while DISK["full"]; `shutil.disk_usage` reports 100 MB free meanwhile."""
    import shutil

    real_usage = shutil.disk_usage
    Usage = collections.namedtuple("Usage", "total used free")
    monkeypatch.setattr(dbmod, "sqlite3", _Sqlite3Shim())
    monkeypatch.setattr(health_report.shutil, "disk_usage", lambda p: Usage(32 * 1024**3, 32 * 1024**3 - 100 * 1024**2, 100 * 1024**2) if DISK["full"] else real_usage(p))
    DISK["full"] = False
    yield DISK
    DISK["full"] = False


def test_s07_disk_full(feed, monkeypatch, full_disk, bridge):
    """The data disk fills up: the door release cannot write its attempt row, so nothing is sent (no record, no command); the
    device tile cannot write its pending row, so nothing is sent; both answer 507 `storage_full` in plain words (T035 fix: a
    bare 500 and a misleading "busy"); the top bar says the disk is full (T035 fix: only the administrator's report did).
    Once space is freed everything works again, and nothing refused while full is sent afterwards."""
    gate: dict[str, Any] = {}
    app, s, fakes, c = start_feed(feed, monkeypatch, gate)
    b_app, b_s, b_c, far = bridge
    full_disk["full"] = True
    app.state.db.invalidate_pool()
    b_app.state.db.invalidate_pool()
    door = release(c)
    tile = unlock(b_c, "full-click")
    pill = c.get("/api/v1/health/summary")
    assert door.status_code == 507 and door.json()["code"] == "storage_full", door.text
    assert tile.status_code == 507 and tile.json()["code"] == "storage_full" and tile.json()["details"]["sent"] is False, tile.text
    assert unlocks(fakes) == 0 and far["delivered"] == []
    assert pill.status_code == 200, "the operator can still read the state while the disk is full"
    storage = {i["id"]: i for i in pill.json()["items"]}["storage"]
    assert storage["status"] == "error" and "אחסון התוסף כמעט מלא" in storage["label"]

    full_disk["full"] = False  # space freed
    app.state.db.invalidate_pool()
    b_app.state.db.invalidate_pool()
    assert "storage" not in summary_items(c)
    assert unlocks(fakes) == 0 and far["delivered"] == [], "nothing refused while full was sent later"
    assert release(c).status_code == 200 and unlocks(fakes) == 1
    assert unlock(b_c, "full-click").status_code == 202 and len(far["delivered"]) == 1, "the refused click left no record: it may be pressed again"
    record("S07 disk full", door=[door.status_code, door.json()["code"], door.json()["user_message"]],
           tile=[tile.status_code, tile.json()["code"], tile.json()["user_message"]], summary_item=storage, unlock_frames=unlocks(fakes),
           delivered=len(far["delivered"]), recovered_without_manual_step="yes, once space is freed (freeing space is the owner's step)")


# ================================================================ S08 - the add-on restarts in the middle of a write

class ProcessKilled(Exception):
    """Stands for the process dying at that line (SIGKILL / a container restart): nothing after it runs."""


def test_s08_restart_mid_door_release(feed, monkeypatch):
    """The process dies after WisKey accepted the release and before the outcome row was written. After the restart: nothing
    is sent at start-up, the audit keeps the attempt row (the honest "may have been sent"), and the app resubmitting the same
    envelope is refused as a duplicate - the open is never repeated."""
    gate: dict[str, Any] = {}
    app, s, fakes, c = start_feed(feed, monkeypatch, gate)
    body = env(confirmed=True)
    real_outcome = access_control._Action.outcome

    def die(self, outcome, reason, fields):  # noqa: ANN001
        raise ProcessKilled()

    monkeypatch.setattr(access_control._Action, "outcome", die)
    crashed = release(c, body=body)
    assert crashed.status_code == 500 and unlocks(fakes) == 1
    monkeypatch.setattr(access_control._Action, "outcome", real_outcome)

    # the restart: a new process on the same database, nothing kept in memory
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    access_control.RELAYS.clear()
    gate2: dict[str, Any] = {}
    fakes2 = wire(monkeypatch, gate2)
    app2 = create_app(s)
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready", what="after restart")
    c2 = TestClient(app2, raise_server_exceptions=False)
    time.sleep(0.3)
    assert unlocks(fakes2) == 0, "the restart sends nothing"
    attempts = audit_rows(s, "intercom.release", "attempt")
    assert len(attempts) == 1 and audit_rows(s, "intercom.release", "outcome") == [], "attempt without outcome: may have been sent"
    resent = release(c2, body=body)
    assert resent.status_code == 409 and resent.json()["code"] == "intercom_duplicate_command" and unlocks(fakes2) == 0
    record("S08 add-on restart mid-write (door release)", crashed_answer=crashed.status_code, frames_before_restart=unlocks(fakes),
           frames_after_restart=unlocks(fakes2), audit="attempt row only", resubmitted=[resent.status_code, resent.json()["code"]])


def test_s08_restart_mid_device_action(bridge, monkeypatch):
    """The process dies with the tile's pending row committed and the call out. After the restart nothing re-sends it; once the
    confirmation window has passed the row reads `unknown` (never `confirmed` without HA's report, never `failed`), and the same
    click resubmitted is answered from the record."""
    app, s, c, far = bridge

    def die(_settings, payload, timeout=15.0):  # noqa: ANN001
        far["delivered"].append(payload)
        raise ProcessKilled()

    monkeypatch.setattr(ha_client, "call_bridge_execute", die)
    crashed = unlock(c, "crash-click")
    assert crashed.status_code == 500
    [row] = [r for r in action_rows(s) if r["client_request_id"] == "crash-click"]
    assert row["status"] == "pending"
    calls_after: list[Any] = []
    monkeypatch.setattr(ha_client, "call_bridge_execute", lambda *a, **k: calls_after.append(a) or {"ok": True})
    app2 = create_app(s)  # the restart
    c2 = TestClient(app2, raise_server_exceptions=False)
    with Database(s.db_path).connection() as conn:  # the restart took longer than the confirmation window
        conn.execute("UPDATE ha_actions SET requested_at = '2026-11-06T00:00:00Z' WHERE id = ?", (row["id"],))
    seen = c2.get(f"/api/v1/ha/actions/{row['id']}").json()
    again = c2.post("/api/v1/ha/entities/lock.front/actions", json=unlock_body("crash-click")).json()
    assert seen["status"] == "unknown" and again["id"] == row["id"] and again["status"] == "unknown" and calls_after == []
    record("S08 add-on restart mid-write (device action)", crashed_answer=crashed.status_code, row_after_restart=seen["status"], resent_after_restart=len(calls_after))


def test_s08_restart_mid_wiskey_person_write(settings):
    """A WisKey person write was out on the wire when the process ended: the durable journal row (another boot's `dispatched`)
    holds the next write to that person - first `outcome_pending` while the old call could still commit, then
    `readback_required` - and only a readback that started after the hold settles it. Nothing is sent meanwhile."""
    app = create_app(settings)
    db: Database = app.state.db
    now = {"t": 1_800_000_000.0}
    clock = lambda: now["t"]  # noqa: E731
    old = intercom_write_journal.WriteJournal(db, boot_id="boot-before", clock=clock)
    blocked, op = old.admit("person:u1", "users/update", "config")
    assert blocked is None and op
    new = intercom_write_journal.WriteJournal(db, boot_id="boot-after", clock=clock)  # the restarted process
    first, none1 = new.admit("person:u1", "users/update", "config")
    now["t"] += intercom_write_journal.HOLD_S + 1
    second, none2 = new.admit("person:u1", "users/update", "config")
    assert (first, none1, second, none2) == ("outcome_pending", None, "readback_required", None)
    assert new.readback("person:u1", started_ts=now["t"]) == 1
    third, op3 = new.admit("person:u1", "users/update", "config")
    assert third is None and op3
    record("S08 add-on restart mid-write (WisKey person write)", right_after_restart=first, after_hold=second, after_readback="admitted")
