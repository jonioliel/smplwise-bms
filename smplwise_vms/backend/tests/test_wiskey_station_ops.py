"""WISKEY-STATION-OPS-2390 (plan 2026-11-03 T4): a station's maintenance from Arx - sync now, rescan, health refresh, clock check - and
the read-only health detail with the sporadic `authentication_failed`, end to end over the add-on's live service session against the
fake WisKey (tests/fake_wiskey.py, answered here for the four maintenance commands): nothing contacts a device, a station, Home
Assistant or WisKey.

What is proven:
- the exact frames: the four commands of the pinned catalog with `station_id` + `api_contract`, on the closed `maintenance` channel
  (no other channel lets them through, and that guard lets nothing else through);
- the gates: `access.stations.manage` anywhere before the body (audited 403), then on the station's chain (a deny there wins); a station
  the caller cannot see is the uniform 404; no confirmation, an expired or duplicate envelope -> refused, audited, nothing sent;
- honest results: `acknowledged` (sync queued) / `completed` (rescan, refresh, clock), WisKey's failure with its code (`refused`), no
  clear answer (`unknown`), nothing sent (`not_sent`) - never retried;
- Arx's own limits: the per-station cool-down (only after a send), the per-operator window, the in-flight cap;
- the audit rows: attempt + outcome with the actor, the station and WisKey's code;
- the read: no confirmation, the health detail only with the status page's rule, the authentication-failure step and time, the memo
  that keeps it after WisKey's ring buffer forgot it, the last run of each action from the audit rows."""
from __future__ import annotations

import copy
import json
import time
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX, FakeWiskey, fail, fixture, ok
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture

from smplwise.db import Database
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_sync, wiskey_channels
from smplwise.services import wiskey_station_ops as ops

API = "/api/v1/access-control/stations"
AUTH_ROWS = [
    {"timestamp": "2026-11-03T05:10:00+00:00", "station_ref": "aaaaaaaaaaaa", "user_ref": "bbbbbbbbbbbb", "step": "identity", "outcome": "failed",
     "error": "authentication_failed", "status_code": 4, "sub_status": "unauthorized"},
    {"timestamp": "2026-11-03T05:12:00+00:00", "station_ref": "aaaaaaaaaaaa", "user_ref": None, "step": "complete", "outcome": "succeeded"},
    {"timestamp": "2026-11-03T06:41:00+00:00", "station_ref": "aaaaaaaaaaaa", "user_ref": None, "step": "inventory", "outcome": "failed",
     "error": "authentication_failed", "status_code": 4, "sub_status": "secret-host-192.0.2.9"},
]


class OpsFake(FakeWiskey):
    """The fake WisKey with rc.10's answers to the four maintenance commands (websocket.py / health_api.py): `sync/station` and
    `stations/rescan` -> `{accepted: true}`; `health/refresh` -> the health report; `stations/clock_refresh` -> the clock. Per command a
    test may set a failure code (`fail_with`) or a missing answer (`silent`, the call never answers -> unknown)."""

    def __init__(self, *a: Any, **kw: Any) -> None:
        super().__init__(*a, **kw)
        self.fail_with: dict[str, str] = {}
        self.auth_rows: list[dict[str, Any]] = []
        self.answer_shape: dict[str, Any] = {}

    def report(self) -> dict[str, Any]:
        body = fixture("health_get.json")
        body["sync_diagnostics"]["recent"] = copy.deepcopy(self.auth_rows) or body["sync_diagnostics"]["recent"]
        return body

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command in ops.COMMANDS or command == "health/get":
            station = next((s for s in self.overview["stations"] if s["id"] == msg.get("station_id")), None)
            if station is None:
                return [fail(msg, "station_not_found")]
            if command in self.fail_with:
                return [fail(msg, self.fail_with[command])]
            if command in self.answer_shape:
                return [ok(msg, self.answer_shape[command])]
            if command in ("sync/station", "stations/rescan"):
                return [ok(msg, {"accepted": True})]
            if command in ("health/refresh", "health/get"):
                return [ok(msg, self.report())]
            if command == "stations/clock_refresh":
                clock = fixture("health_get.json")["clock"]
                clock.update(skew_seconds=-3.5, checked_at="2026-11-03T07:00:00+00:00", device_time="2026-11-03T09:00:00+02:00")
                return [ok(msg, clock)]
        return super()._answer(command, msg, auth)


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


def wait_for(pred: Any, timeout: float = 5.0) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    raise AssertionError(f"condition not met; feed state {intercom_sync.STATE.as_dict()}")


@pytest.fixture()
def wx(settings, monkeypatch, station_scope):  # noqa: F811
    """The app with OpsFake as its WisKey and these principals: root (system_admin, installation: manages every station) - mia
    (site_admin on entry-a: sees the health there, runs nothing) - otto (operator: neither) - tech (a custom role at the installation:
    access.read + access.admin.read + access.stations.manage; access.stations.manage DENIED on entry-c)."""
    import websockets

    fake = OpsFake("admin", token="t")
    monkeypatch.setattr(websockets, "connect", fake.connect)
    monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
    monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
    for name in ("USER_BURST", "GLOBAL_BURST"):
        monkeypatch.setattr(intercom_sync, name, 1000.0)
    monkeypatch.setattr(ops, "COOLDOWN_SCALE", 1.0)
    ops.reset()
    intercom_sync.SYNC.reset()
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
    from smplwise.main import create_app

    c = TestClient(create_app(s))
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "otto", "operator", "installation", "*")
    c.get("/api/v1/me", headers=as_user("mia"))
    station_scope.bind("dev-mia", "site_admin", "entry-a")
    role = c.post("/api/v1/access/roles", json={"name": "station maintenance", "description": "T4 test", "permissions": ["access.read", "access.admin.read", "access.stations.read"],
                                                 "sensitive": [ia.STATIONS_MANAGE]})
    assert role.status_code == 201, role.text
    bind(c, s, "tech", role.json()["id"], "installation", "*")
    deny = c.post("/api/v1/access/roles", json={"name": "no station maintenance", "description": "T4 test", "permissions": [], "sensitive": [ia.STATIONS_MANAGE]})
    assert deny.status_code == 201, deny.text
    station_scope.bind("dev-tech", deny.json()["id"], "entry-c", effect="deny")  # removes the maintenance only: entry-c stays visible
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    yield fake, c, s
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    ops.reset()


def run(c: TestClient, station: str, action: str, user: str = "root", **body: Any) -> Any:
    return c.post(f"{API}/{station}/maintenance/{action}", json=env(**{"confirmed": True, **body}), headers=as_user(user))


def sent(fake: FakeWiskey, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def rows(settings: Any, action: str) -> list[dict[str, Any]]:
    with Database(settings.db_path).connection() as conn:
        out = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]
    for r in out:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return out


# ---------------------------------------------------------------- the channel

def test_the_maintenance_channel_is_exactly_the_four_commands_and_nothing_else_carries_them():
    assert wiskey_channels.MAINTENANCE == ops.COMMANDS == {"sync/station", "stations/rescan", "health/refresh", "stations/clock_refresh"}
    assert "maintenance" in wiskey_channels.ADAPTER_CHANNELS and wiskey_channels.HA_FRAMES["maintenance"] == frozenset()
    for channel in wiskey_channels.ALLOWLISTS:
        for command in ops.COMMANDS:
            assert wiskey_channels.allowed(channel, PREFIX + command) == (channel == "maintenance"), (channel, command)
    for other in ("sync/all", "sync/user", "clock/station_sync", "stations/test_unlock", "stations/technical_update", "health/get"):
        assert not wiskey_channels.allowed("maintenance", PREFIX + other), other
    assert not (wiskey_channels.MAINTENANCE & wiskey_channels.SERVICE_WRITES)


@pytest.mark.parametrize("action,command", [(a, op.command) for a, op in ops.OPS.items()])
def test_each_action_sends_its_one_frame_with_the_catalog_keys(wx, action, command):
    fake, c, s = wx
    r = run(c, "entry-a", action)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["action"] == action and body["status"] == ops.OPS[action].result and body["command_id"]
    frames = sent(fake, command)
    assert len(frames) == 1
    assert set(frames[0]) == {"id", "type", "station_id", "api_contract"} and frames[0]["station_id"] == "entry-a" and frames[0]["api_contract"] == 1
    trail = rows(s, ops.OPS[action].audit)
    assert [r["details"]["phase"] for r in trail] == ["attempt", "outcome"]
    assert trail[1]["details"]["outcome"] == "ok" and trail[1]["actor_user_id"] == "dev-root" and trail[1]["resource_id"] == "entry-a"
    assert "192.0.2" not in json.dumps(trail)


def test_sync_is_acknowledged_not_claimed_done_and_the_clock_is_a_read(wx):
    fake, c, _s = wx
    r = run(c, "entry-a", "sync")
    assert r.json()["status"] == "acknowledged" and r.json()["data"] == {"accepted": True}
    clock = run(c, "entry-a", "clock_refresh").json()
    assert clock["status"] == "completed" and clock["data"]["skew_seconds"] == -3.5 and clock["data"]["status"] == "ready"
    assert "device_time" not in clock["data"]
    assert not sent(fake, "clock/station_sync"), "the clock is never set"


def test_health_refresh_returns_the_report_with_the_authentication_failure(wx):
    fake, c, _s = wx
    fake.auth_rows = AUTH_ROWS
    r = run(c, "entry-a", "health_refresh")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["health"]["online"] is True and data["health"]["access"]["sync_state"] == "synced"
    auth = data["auth"]
    assert auth["last_failure"] == {"source": "sync", "step": "inventory", "at": "2026-11-03T06:41:00+00:00", "status_code": 4, "sub_status": "other"}
    assert auth["retained"] == 2 and auth["steps"] == {"identity": 1, "inventory": 1} and auth["last_sync_ok_at"] == "2026-11-03T05:12:00+00:00"
    assert "user_ref" not in json.dumps(data) and "bbbbbbbbbbbb" not in json.dumps(data) and "192.0.2.9" not in json.dumps(data)


# ---------------------------------------------------------------- the gates

def test_without_stations_manage_the_gate_refuses_before_the_body(wx):
    fake, c, s = wx
    for user in ("otto", "mia"):
        r = c.post(f"{API}/entry-a/maintenance/sync", content=b"not json", headers={**as_user(user), "content-type": "text/plain"})
        assert r.status_code == 403, (user, r.text)
    assert not sent(fake, "sync/station")
    with Database(s.db_path).connection() as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied'", (ia.STATIONS_MANAGE,)).fetchone()[0]
    assert denied == 2


def test_a_deny_on_the_station_wins_and_an_unseen_station_is_not_found(wx):
    fake, c, s = wx
    assert run(c, "entry-a", "sync", "tech").status_code == 200
    r = run(c, "entry-c", "sync", "tech")
    assert r.status_code == 403 and r.json()["details"]["outcome"] == "not_sent"
    unknown = run(c, "no-such-station", "sync")
    assert unknown.status_code == 404 and unknown.json()["code"] == "intercom_station_not_found"
    assert [m["station_id"] for m in sent(fake, "sync/station")] == ["entry-a"]
    assert [r["details"].get("phase") for r in rows(s, "intercom.station_sync")][-2:] == ["refused", "refused"]


def test_no_confirmation_expired_or_duplicate_is_refused_and_nothing_sent(wx):
    fake, c, s = wx
    no = c.post(f"{API}/entry-a/maintenance/rescan", json=env(), headers=as_user("root"))
    assert no.status_code == 409 and no.json()["code"] == "confirmation_required"
    stale = c.post(f"{API}/entry-a/maintenance/rescan", json=env(ttl=-5, confirmed=True), headers=as_user("root"))
    assert stale.status_code == 409 and stale.json()["code"] == "expired"
    body = env(confirmed=True)
    assert c.post(f"{API}/entry-a/maintenance/clock_refresh", json=body, headers=as_user("root")).status_code == 200
    again = c.post(f"{API}/entry-a/maintenance/clock_refresh", json=body, headers=as_user("root"))
    assert again.status_code == 409 and again.json()["code"] == "intercom_duplicate_command"
    assert not sent(fake, "stations/rescan") and len(sent(fake, "stations/clock_refresh")) == 1
    bad = c.post(f"{API}/entry-a/maintenance/format_disk", json=env(confirmed=True), headers=as_user("root"))
    assert bad.status_code == 404


def test_an_offline_station_gets_no_device_read_but_its_sync_can_be_queued(wx):
    fake, c, _s = wx
    r = run(c, "entry-b", "rescan")
    assert r.status_code == 409 and r.json()["code"] == "intercom_station_offline" and r.json()["details"]["outcome"] == "not_sent"
    assert run(c, "entry-b", "sync").status_code == 200
    assert not sent(fake, "stations/rescan") and len(sent(fake, "sync/station")) == 1


# ---------------------------------------------------------------- honest outcomes

def test_a_wiskey_failure_is_failed_with_its_reason_and_never_retried(wx):
    fake, c, s = wx
    fake.fail_with["stations/rescan"] = "authentication_failed"
    r = run(c, "entry-a", "rescan")
    assert r.status_code == 502 and r.json()["code"] == "station_ops_failed"
    assert r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == "authentication_failed"
    assert len(sent(fake, "stations/rescan")) == 1
    outcome = rows(s, "intercom.station_rescan")[-1]
    assert outcome["details"]["outcome"] == "refused" and outcome["reason"] == "authentication_failed"


def test_an_unclear_answer_is_unknown_not_failed(wx):
    fake, c, _s = wx
    fake.fail_with["health/refresh"] = "action_failed"
    r = run(c, "entry-a", "health_refresh")
    assert r.status_code == 504 and r.json()["code"] == "station_ops_outcome_unknown" and r.json()["details"]["outcome"] == "unknown"
    fake.answer_shape["sync/station"] = {"queued": "maybe"}
    r2 = run(c, "entry-a", "sync")
    assert r2.status_code == 504 and r2.json()["details"]["outcome"] == "unknown"


def test_wiskey_refusing_the_service_identity_is_shown_as_a_failure(wx):
    fake, c, _s = wx
    fake.set_forbidden(["stations/clock_refresh"])
    r = run(c, "entry-a", "clock_refresh")
    assert r.status_code == 502 and r.json()["details"]["wiskey_code"] == "unauthorized"


def test_a_feed_that_is_down_says_not_sent(wx):
    fake, c, _s = wx
    intercom_sync.SYNC.shutdown()
    if intercom_sync.SYNC.thread is not None:
        intercom_sync.SYNC.thread.join(timeout=5)
    r = run(c, "entry-a", "sync")
    assert r.status_code in (409, 503) and r.json()["details"]["outcome"] == "not_sent"
    assert not sent(fake, "sync/station")


# ---------------------------------------------------------------- Arx's own limits

def test_the_cooldown_starts_after_a_send_and_refuses_the_next_one_not_sent(wx):
    fake, c, s = wx
    assert run(c, "entry-a", "sync").status_code == 200
    again = run(c, "entry-a", "sync")
    assert again.status_code == 429 and again.json()["code"] == "station_ops_cooldown" and again.json()["details"]["retry_after_s"] > 0
    assert again.json()["details"]["outcome"] == "not_sent"
    assert run(c, "entry-c", "sync").status_code == 200, "another station is not cooled down"
    assert run(c, "entry-a", "clock_refresh").status_code == 200, "another action is not cooled down"
    assert len(sent(fake, "sync/station")) == 2
    view = c.get(f"{API}/entry-a/maintenance", headers=as_user("root")).json()
    assert view["actions"]["sync"]["cooldown_s"] > 0 and view["actions"]["rescan"]["cooldown_s"] == 0


def test_a_command_that_was_not_sent_starts_no_cooldown(wx):
    fake, c, _s = wx
    assert run(c, "entry-b", "rescan").status_code == 409
    assert ops.LIMITS.cooldown_left("entry-b", "rescan") == 0


def test_the_per_operator_window_and_the_inflight_cap(wx, monkeypatch):
    fake, c, _s = wx
    monkeypatch.setattr(ops, "USER_MAX", 2)
    monkeypatch.setattr(ops, "COOLDOWN_SCALE", 0.0)
    assert run(c, "entry-a", "sync").status_code == 200
    assert run(c, "entry-c", "sync").status_code == 200
    third = run(c, "entry-a", "clock_refresh")
    assert third.status_code == 429 and third.json()["code"] == "station_ops_rate_limited"
    ops.LIMITS.reset()
    ops.LIMITS._inflight = ops.MAX_INFLIGHT
    busy = run(c, "entry-a", "sync")
    assert busy.status_code == 429 and busy.json()["code"] == "station_ops_busy"
    ops.LIMITS.reset()
    assert len(sent(fake, "sync/station")) == 2


# ---------------------------------------------------------------- the read

def test_the_read_needs_no_confirmation_and_shows_the_health_detail(wx):
    fake, c, _s = wx
    fake.auth_rows = AUTH_ROWS
    r = c.get(f"{API}/entry-a/maintenance", headers=as_user("root"))
    assert r.status_code == 200, r.text
    v = r.json()
    assert v["health_hidden"] is False and v["online"] is True and v["report"]["state"] == "ready"
    assert v["report"]["auth"]["last_failure"]["step"] == "inventory" and v["report"]["auth"]["last_failure"]["at"] == "2026-11-03T06:41:00+00:00"
    assert v["auth_seen"]["step"] == "inventory"
    assert v["technical"]["event_status"]["stream"] == "connected"
    assert all(a["allowed"] for a in v["actions"].values())
    assert len(sent(fake, "health/get")) == 1 and not any(sent(fake, cmd) for cmd in ops.COMMANDS), "a read sends no maintenance command"
    c.get(f"{API}/entry-a/maintenance", headers=as_user("root"))
    assert len(sent(fake, "health/get")) == 1, "cached for a few seconds"


def test_the_memo_keeps_the_failure_after_wiskey_forgot_it(wx):
    fake, c, _s = wx
    fake.auth_rows = AUTH_ROWS
    c.get(f"{API}/entry-a/maintenance", headers=as_user("root"))
    fake.auth_rows = [AUTH_ROWS[1]]  # WisKey's ring buffer rolled over
    ops.HEALTH.reset()
    v = c.get(f"{API}/entry-a/maintenance", headers=as_user("root")).json()
    assert v["report"]["auth"]["last_failure"] is None and v["report"]["auth"]["retained"] == 0
    assert v["auth_seen"] == {"source": "sync", "step": "inventory", "at": "2026-11-03T06:41:00+00:00", "status_code": 4, "sub_status": "other"}


def test_the_event_stream_failure_is_seen_without_a_device_time(wx):
    fake, c, _s = wx
    for st in fake.overview["stations"]:
        if st["id"] == "entry-c":
            st["event_status"]["stream"] = "authentication_failed"
    fake.push("refresh")

    def stream() -> Any:
        found = [x for x in intercom_sync.SYNC.stations_superset(intercom_sync.SYNC.settings)["stations"] or [] if x["id"] == "entry-c"]
        return ((found[0].get("technical") or {}).get("event_status") or {}).get("stream") if found else None

    wait_for(lambda: stream() == "authentication_failed")
    v = c.get(f"{API}/entry-c/maintenance", headers=as_user("root")).json()
    assert v["auth_seen"]["source"] == "event_stream" and v["auth_seen"]["observed"] is True and v["auth_seen"]["step"] is None


def test_who_sees_what_in_the_read(wx):
    fake, c, _s = wx
    mia = c.get(f"{API}/entry-a/maintenance", headers=as_user("mia")).json()
    assert mia["health_hidden"] is False and not any(a["allowed"] for a in mia["actions"].values())
    assert c.get(f"{API}/entry-c/maintenance", headers=as_user("mia")).status_code == 404, "outside her station: not found"
    assert c.get(f"{API}/entry-a/maintenance", headers=as_user("otto")).status_code == 403
    tech_c = c.get(f"{API}/entry-c/maintenance", headers=as_user("tech")).json()
    assert not any(a["allowed"] for a in tech_c["actions"].values()), "the deny on entry-c removes the actions"


def test_the_last_run_of_each_action_comes_from_the_audit_rows(wx):
    fake, c, _s = wx
    fake.fail_with["stations/rescan"] = "connection_failed"
    run(c, "entry-a", "sync")
    run(c, "entry-a", "rescan")
    v = c.get(f"{API}/entry-a/maintenance", headers=as_user("root")).json()
    assert v["last_runs"]["sync"]["status"] == "acknowledged"
    assert v["last_runs"]["rescan"] == {"status": "failed", "at": v["last_runs"]["rescan"]["at"], "code": "connection_failed"}
    assert v["last_runs"]["health_refresh"] is None


# ---------------------------------------------------------------- pure parts

def test_auth_summary_is_closed_and_tolerates_junk():
    assert ops.auth_summary(None)["last_failure"] is None
    junk = {"sync_diagnostics": {"recent": ["x", {"error": "authentication_failed", "step": "<script>", "timestamp": 5}]}, "events": {"stream": "authentication_failed"}}
    s = ops.auth_summary(junk)
    assert s["last_failure"] == {"source": "sync", "step": "other", "at": None, "status_code": None, "sub_status": None} and s["event_stream_now"] is True


def test_result_of_reads_failures_honestly():
    from smplwise.services.intercom_client import IntercomError, UnclearAnswer

    assert ops.result_of({"success": True, "result": {"accepted": True}}, "sync/station") == {"accepted": True}
    with pytest.raises(IntercomError):
        ops.result_of({"success": False, "error": {"code": "station_offline"}}, "stations/rescan")
    for code in ("action_failed", "", "not a code!"):
        with pytest.raises(UnclearAnswer):
            ops.result_of({"success": False, "error": {"code": code}}, "health/refresh")
    with pytest.raises(UnclearAnswer):
        ops.result_of({"weird": 1}, "health/refresh")
