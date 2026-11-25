"""WISKEY-R4-2520 (plan docs/changes/WISKEY-RESYNC-2520.md row R4, master id B7): the station sync's numbered form `sync/station_v1`
(WisKey PRODUCT 2.0.1-rc.19, contract station-sync-request-v1; WisKey's synthetic examples copied unchanged into
tests/fixtures/wiskey_rc19/station-sync-request-v1/), end to end over the add-on's live service session against the fake WisKey
(tests/fake_wiskey.py with the two rc.19 commands added here). Nothing contacts a device, a station, Home Assistant or WisKey.

What is proven:
- the channel: `sync/station_v1` rides only `station_sync_v1`, which carries nothing else; the `maintenance` channel is unchanged;
- the selection BEFORE sending: the numbered form only when WisKey lists it AND `system/status_v1`; otherwise the classic `sync/station`
  exactly as before; a refusal of the numbered form is final - the classic command is never sent after it;
- the frame: exactly the contract's request keys (`station_id`, `api_contract: 1`);
- the answer: checked against the contract's constants (WisKey's valid / wrong / missing / extra examples); `accepted` is reported as
  queued, never done (`effect_proven: false` kept); a non-conforming answer is UNKNOWN, never success;
- UNKNOWN: the station's sync is held (memory + the durable journal) - the next sync, numbered OR classic, is refused before sending -
  until a `system/status_v1` read that started after the call was over has answered; a status read that WisKey refuses, does not list or
  that breaks its contract settles nothing; nothing is ever replayed;
- the status read: Arx's own request id matched against WisKey's pending / active / last result (`queued` / `running` / `finished` /
  `not_observed`), unknown values kept;
- permission and audit: the same gates as the sync (`access.stations.manage` on the station), the read's gate, `sync_mode` and the
  request id on the audit rows."""
from __future__ import annotations

import copy
import json
import uuid
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pytest
from conftest import as_user, bind
from fake_wiskey import PREFIX, fail, ok
from fastapi.testclient import TestClient
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_wiskey_station_ops import OpsFake

from smplwise.db import Database
from smplwise.services import intercom_authority as ia
from smplwise.services import intercom_sync, intercom_write_journal, wiskey_channels
from smplwise.services import wiskey_station_ops as ops
from smplwise.services import wiskey_system_status as ss
from support.waiting import wait_for

API = "/api/v1/access-control/stations"
RC19 = Path(__file__).parent / "fixtures" / "wiskey_rc19"
CONTRACT = RC19 / "station-sync-request-v1"


def example(name: str) -> Any:
    return json.loads((CONTRACT / name).read_text(encoding="utf-8"))


def status_example() -> dict[str, Any]:
    return json.loads((RC19 / "system-status-v1.result.valid.json").read_text(encoding="utf-8"))


class V1Fake(OpsFake):
    """OpsFake plus WisKey rc.19's `sync/station_v1` (websocket.py: `manager.request(station, require_attached=True)` - one pending id per
    station that later requests share, `station_offline` when the station is not attached) and `system/status_v1` (the station rows'
    `sync.request` observation built from that state). `status_shape` replaces the status document; `fail_with` works for both."""

    def __init__(self, *a: Any, listed: bool = True, status_listed: bool = True, **kw: Any) -> None:
        super().__init__(*a, **kw)
        if listed:
            self.commands["sync/station_v1"] = self._entry({"station_id": {"type": "string"}, "api_contract": {"const": 1, "type": "integer"}},
                                                           ["id", "type", "station_id", "api_contract"], "sync/station_v1")
        if status_listed:
            self.commands["system/status_v1"] = self._entry({}, ["id", "type"], "system/status_v1")
        self.pending: dict[str, str] = {}
        self.active: dict[str, str] = {}
        self.last: dict[str, dict[str, Any]] = {}
        self.status_shape: Any = None

    @staticmethod
    def _entry(props: dict[str, Any], required: list[str], command: str) -> dict[str, Any]:
        return {"request": {"type": "object", "properties": {"id": {"type": "integer"}, "type": {"const": PREFIX + command}, **props},
                            "required": required, "additionalProperties": False},
                "permission": {"alternative_area_grants": [["stations", "manage"]], "administrator_only_by_base_mapping": False},
                "max_request_bytes": 65536}

    def status_doc(self) -> dict[str, Any]:
        doc = status_example()
        doc["stations"] = [{
            "station_id": s["id"], "loaded": True, "connection": "offline" if s["id"] in self.offline else "connected",
            "last_authenticated_at": None, "last_failure": None, "firmware": None,
            "sync": {"state": "pending" if s["id"] in self.pending else "synced", "last_reconciled_at": None,
                     "request": {"scope": "current_attached_runtime_only", "pending_request_id": self.pending.get(s["id"]),
                                 "active_request_id": self.active.get(s["id"]), "last_result": self.last.get(s["id"])},
                     "last_intent": None},
        } for s in self.overview["stations"]]
        return doc

    def _answer(self, command: str, msg: dict[str, Any], auth: dict[str, Any]) -> list[Any]:
        if command == "sync/station_v1":
            sid = msg.get("station_id")
            if sid not in {s["id"] for s in self.overview["stations"]}:
                return [fail(msg, "station_not_found")]
            if command in self.fail_with:
                return [fail(msg, self.fail_with[command])]
            if sid in self.offline:
                return [fail(msg, "station_offline")]
            if command in self.answer_shape:
                return [ok(msg, copy.deepcopy(self.answer_shape[command]))]
            rid = self.pending.setdefault(sid, str(uuid.uuid4()))
            return [ok(msg, {"contract": "wiskey-station-sync-request.v1", "request_id": rid, "station_id": sid, "accepted": True,
                             "scope": "current_attached_runtime_only", "effect_proven": False})]
        if command == "system/status_v1":
            if command in self.fail_with:
                return [fail(msg, self.fail_with[command])]
            return [ok(msg, copy.deepcopy(self.status_shape) if self.status_shape is not None else self.status_doc())]
        return super()._answer(command, msg, auth)

    def run_batch(self, station_id: str, state: str = "synced") -> None:
        """WisKey's worker takes the pending batch and finishes it (the id moves pending -> last result)."""
        rid = self.pending.pop(station_id)
        self.last[station_id] = {"request_id": rid, "state": state, "observed_at": "2026-11-25T08:00:00+00:00", "code": None, "effect_proven": False}


def env(ttl: float = 15.0, **fields: Any) -> dict[str, Any]:
    return {"client_request_id": uuid.uuid4().hex, "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=ttl)).strftime("%Y-%m-%dT%H:%M:%SZ"), **fields}


@pytest.fixture()
def make(settings, monkeypatch, station_scope):  # noqa: F811
    """The app with a V1Fake WisKey (switches as keyword arguments) and the principals of tests/test_wiskey_station_ops.py: root (manages
    every station), mia (site_admin on entry-a: status rule there, no maintenance), otto (operator: neither), tech (installation-wide
    maintenance, DENIED on entry-c)."""
    import websockets

    started: list[Any] = []

    def build(**switches: Any) -> tuple[V1Fake, TestClient, Any]:
        fake = V1Fake("admin", token="t", **switches)
        monkeypatch.setattr(websockets, "connect", fake.connect)
        monkeypatch.setattr(intercom_sync, "RETRY_S", 0.05)
        monkeypatch.setattr(intercom_sync, "RETRY_MAX_S", 0.2)
        for name in ("USER_BURST", "GLOBAL_BURST"):
            monkeypatch.setattr(intercom_sync, name, 1000.0)
        monkeypatch.setattr(ops, "COOLDOWN_SCALE", 0.0)  # the cool-down is test_wiskey_station_ops.py's; here every click reaches the gate
        ops.reset()
        intercom_sync.SYNC.reset()
        s = replace(settings, ha_url="http://ha.local:8123", ha_token="t", ha_core_url="http://ha.local:8123")
        from smplwise.main import create_app

        c = TestClient(create_app(s))
        # the durable side of the per-target gate, as main.py installs it at start-up (the TestClient here runs no lifespan)
        monkeypatch.setattr(intercom_sync.SYNC, "journal", intercom_write_journal.WriteJournal(c.app.state.db))
        bind(c, s, "root", "system_admin", "installation", "*")
        bind(c, s, "otto", "operator", "installation", "*")
        c.get("/api/v1/me", headers=as_user("mia"))
        station_scope.bind("dev-mia", "site_admin", "entry-a")
        role = c.post("/api/v1/access/roles", json={"name": "station maintenance", "description": "R4 test", "permissions": ["access.read", "access.admin.read", "access.stations.read"],
                                                     "sensitive": [ia.STATIONS_MANAGE]})
        assert role.status_code == 201, role.text
        bind(c, s, "tech", role.json()["id"], "installation", "*")
        deny = c.post("/api/v1/access/roles", json={"name": "no station maintenance", "description": "R4 test", "permissions": [], "sensitive": [ia.STATIONS_MANAGE]})
        assert deny.status_code == 201, deny.text
        station_scope.bind("dev-tech", deny.json()["id"], "entry-c", effect="deny")
        intercom_sync.SYNC.start(s)
        wait_for(lambda: intercom_sync.STATE.state == "ready")
        started.append(True)
        return fake, c, s

    yield build
    if started:
        intercom_sync.SYNC.shutdown()
        if intercom_sync.SYNC.thread is not None:
            intercom_sync.SYNC.thread.join(timeout=5)
    intercom_sync.SYNC.reset()
    ops.reset()


def sync(c: TestClient, station: str = "entry-a", user: str = "root") -> Any:
    return c.post(f"{API}/{station}/maintenance/sync", json=env(confirmed=True), headers=as_user(user))


def status(c: TestClient, station: str = "entry-a", user: str = "root") -> Any:
    return c.get(f"{API}/{station}/maintenance/sync-request", headers=as_user(user))


def sent(fake: Any, command: str) -> list[dict[str, Any]]:
    return [m for m in fake.received if m.get("type") == PREFIX + command]


def rows(settings: Any, action: str = "intercom.station_sync") -> list[dict[str, Any]]:
    with Database(settings.db_path).connection() as conn:
        out = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]
    for r in out:
        r["details"] = json.loads(r["details_json"]) if r["details_json"] else {}
    return out


def journal(settings: Any, target: str) -> list[dict[str, Any]]:
    with Database(settings.db_path).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT target, op, lane, state FROM intercom_write_ops WHERE target = ? ORDER BY started_ts", (target,)).fetchall()]


# ---------------------------------------------------------------- the channel and the pure parts

def test_the_numbered_sync_rides_only_its_own_channel_and_the_maintenance_channel_is_unchanged():
    assert wiskey_channels.STATION_SYNC_V1 == ops.COMMANDS_V1 == {"sync/station_v1"}
    assert ops.CHANNEL_V1 in wiskey_channels.ALLOWLISTS and ops.CHANNEL_V1 in wiskey_channels.ADAPTER_CHANNELS
    for channel in wiskey_channels.ALLOWLISTS:
        assert wiskey_channels.allowed(channel, PREFIX + "sync/station_v1") == (channel == ops.CHANNEL_V1), channel
    for other in ("sync/station", "sync/all", "sync/user", "system/status_v1", "stations/rescan", "overview"):
        assert not wiskey_channels.allowed(ops.CHANNEL_V1, PREFIX + other), other
    assert wiskey_channels.HA_FRAMES[ops.CHANNEL_V1] == frozenset()
    assert wiskey_channels.MAINTENANCE == ops.COMMANDS == {"sync/station", "stations/rescan", "health/refresh", "stations/clock_refresh"}
    assert ops.STATUS_READ == "system/status_v1" and wiskey_channels.allowed(ss.CHANNEL, PREFIX + ops.STATUS_READ)


@pytest.mark.parametrize("facts,mode,why", [
    (None, "classic", "no_copy"),
    ({"commands": None}, "classic", "commands_unknown"),
    ({"commands": ["sync/station_v1", "system/status_v1"], "min_client": 2}, "classic", "api_incompatible"),
    ({"commands": ["sync/station", "system/status_v1"]}, "classic", "not_listed"),
    ({"commands": ["sync/station", "sync/station_v1"]}, "classic", "status_not_listed"),
    ({"commands": ["sync/station_v1", "system/status_v1"], "min_client": 1}, "request_id", None),
])
def test_the_form_is_chosen_from_discovery_before_sending(facts, mode, why):
    assert ops.sync_mode(facts) == (mode, why)


def test_the_answer_is_checked_against_wiskeys_contract_examples():
    project = ops.project_sync_v1("synthetic-station")
    assert project(example("result.valid.json")) == {"accepted": True, "request_id": "00000000-0000-4000-8000-000000000001",
                                                     "scope": "current_attached_runtime_only", "effect_proven": False}
    assert project(example("result.extra.json")) == project(example("result.valid.json")), "an extra key is dropped, never kept"
    for bad in ("result.wrong.json", "result.missing.json"):
        with pytest.raises(ValueError):
            project(example(bad))
    valid = example("result.valid.json")
    for key, value in (("station_id", "another-station"), ("accepted", "true"), ("effect_proven", 0), ("contract", "wiskey-station-sync-request.v2"),
                       ("request_id", "req-1"), ("scope", "durable")):
        with pytest.raises(ValueError):
            project({**valid, key: value})
    with pytest.raises(ValueError):
        project(["not", "an", "object"])


def test_match_places_arxs_request_id_in_wiskeys_observation():
    obs = {"request": {"scope": "current_attached_runtime_only", "pending_request_id": "B", "active_request_id": "a",
                       "last_result": {"request_id": "c", "state": "error", "effect_proven": False}}}
    assert ops.match("A", obs) == "running" and ops.match("b", obs) == "queued" and ops.match("C", obs) == "finished"
    assert ops.match("d", obs) == "not_observed" and ops.match("d", {"request": None}) == "not_observed"
    assert ops.match(None, obs) is None and ops.match("a", None) is None


# ---------------------------------------------------------------- the numbered form, end to end

def test_listed_the_sync_sends_one_numbered_frame_and_reports_accepted_not_done(make):
    fake, c, s = make()
    view = c.get(f"{API}/entry-a/maintenance", headers=as_user("root")).json()
    assert view["sync_mode"] == "request_id" and view["sync_gate"] is None
    r = sync(c)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "acknowledged", "accepted is queued, never done"
    data = body["data"]
    assert data["effect_proven"] is False and data["scope"] == "current_attached_runtime_only" and data["request_id"] == fake.pending["entry-a"]
    frames = sent(fake, "sync/station_v1")
    assert len(frames) == 1 and not sent(fake, "sync/station")
    assert set(frames[0]) == set(example("request.valid.json")) and frames[0]["api_contract"] == 1 and frames[0]["station_id"] == "entry-a"
    trail = rows(s)
    assert [r["details"]["phase"] for r in trail] == ["attempt", "outcome"] and all(r["details"]["sync_mode"] == "request_id" for r in trail)
    assert trail[1]["details"]["result"] == {"accepted": True, "request_id": data["request_id"]} and trail[1]["actor_user_id"] == "dev-root"
    last = c.get(f"{API}/entry-a/maintenance", headers=as_user("root")).json()["last_runs"]["sync"]
    assert last["status"] == "acknowledged" and last["request_id"] == data["request_id"] and last["mode"] == "request_id"


@pytest.mark.parametrize("switches,why", [({"listed": False}, "not_listed"), ({"status_listed": False}, "status_not_listed")])
def test_unlisted_the_classic_sync_is_sent_exactly_as_before(make, switches, why):
    fake, c, s = make(**switches)
    r = sync(c)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "acknowledged" and r.json()["data"] == {"accepted": True}
    assert len(sent(fake, "sync/station")) == 1 and not sent(fake, "sync/station_v1")
    outcome = rows(s)[-1]["details"]
    assert outcome["sync_mode"] == "classic" and outcome["sync_mode_reason"] == why
    assert c.get(f"{API}/entry-a/maintenance", headers=as_user("root")).json()["sync_mode"] == "classic"


@pytest.mark.parametrize("code", ["unauthorized", "station_offline", "unknown_command", "api_incompatible"])
def test_a_refusal_of_the_numbered_form_is_final_and_never_followed_by_the_classic_command(make, code):
    fake, c, s = make()
    fake.fail_with["sync/station_v1"] = code
    for _ in range(2):  # the second click asks the numbered form again - never the classic one
        r = sync(c)
        assert r.status_code == 502 and r.json()["code"] == "station_ops_failed"
        assert r.json()["details"]["outcome"] == "refused" and r.json()["details"]["wiskey_code"] == code
    assert len(sent(fake, "sync/station_v1")) == 2 and not sent(fake, "sync/station")
    assert intercom_sync.SYNC.write_gate(ops.sync_target("entry-a")) is None, "a definite refusal holds nothing"
    assert rows(s)[-1]["reason"] == code


def test_an_offline_station_is_refused_by_wiskey_not_queued_and_not_sent_classic(make):
    fake, c, _s = make()
    fake.set_offline("entry-b")
    r = sync(c, "entry-b")
    assert r.status_code == 502 and r.json()["details"]["wiskey_code"] == "station_offline"
    assert not sent(fake, "sync/station") and "entry-b" not in fake.pending


# ---------------------------------------------------------------- UNKNOWN: held until a status read, never replayed

def test_an_unclear_answer_is_unknown_and_holds_the_station_until_a_status_read(make):
    fake, c, s = make()
    fake.answer_shape["sync/station_v1"] = {**example("result.valid.json"), "station_id": "entry-a", "effect_proven": True}
    r = sync(c)
    assert r.status_code == 504 and r.json()["code"] == "station_ops_outcome_unknown"
    assert r.json()["details"]["outcome"] == "unknown" and r.json()["details"]["gate"] == "readback_required"
    assert rows(s)[-1]["details"]["outcome"] == "unknown"
    target = ops.sync_target("entry-a")
    assert [j["state"] for j in journal(s, target)] == ["unknown"], "the durable journal keeps the hold across a restart"

    again = sync(c)
    assert again.status_code == 409 and again.json()["code"] == "station_sync_unsettled"
    assert again.json()["details"] == {"outcome": "not_sent", "gate": "readback_required"}
    assert len(sent(fake, "sync/station_v1")) == 1, "nothing replayed"
    assert rows(s)[-1]["details"]["phase"] == "refused"
    view = c.get(f"{API}/entry-a/maintenance", headers=as_user("root")).json()
    assert view["sync_gate"] == "readback_required" and view["last_runs"]["sync"]["status"] == "not_sent"
    fake.answer_shape.clear()
    assert sync(c, "entry-c").status_code == 200, "another station is not held"
    assert sync(c).status_code == 409, "a clear answer elsewhere does not settle this station"

    st = status(c)
    assert st.status_code == 200, st.text
    body = st.json()
    assert body["state"] == "ready" and body["gate_before"] == "readback_required" and body["gate"] is None
    assert body["last_request"]["status"] == "unknown" and body["last_request"]["request_id"] is None and body["match"] is None
    assert body["observation"]["request"]["scope"] == "current_attached_runtime_only"
    assert [j["state"] for j in journal(s, target)] == ["reconciled"]
    assert len(sent(fake, "system/status_v1")) == 1 and len(sent(fake, "sync/station_v1")) == 2, "the read sends no sync"

    assert sync(c).status_code == 200, "after the status read the operator may decide to sync again"
    assert len(sent(fake, "sync/station_v1")) == 3


def test_while_held_the_classic_command_is_not_sent_either(make):
    fake, c, _s = make()
    fake.fail_with["sync/station_v1"] = "timeout"  # an unclear code: sent, no clear answer
    assert sync(c).status_code == 504
    fake.commands.pop("sync/station_v1")  # WisKey stops listing the numbered form
    fake.push("refresh")
    wait_for(lambda: ops.sync_mode(intercom_sync.SYNC.api_facts(intercom_sync.SYNC.settings))[0] == "classic")
    r = sync(c)
    assert r.status_code == 409 and r.json()["code"] == "station_sync_unsettled"
    assert not sent(fake, "sync/station"), "no fallback to the older command while the numbered one is unknown"


@pytest.mark.parametrize("setup,state,reason", [
    (lambda f: f.set_forbidden(["system/status_v1"]), "forbidden", "wiskey_refused"),
    (lambda f: setattr(f, "status_shape", {**status_example(), "writes": {**status_example()["writes"], "writes_enabled": True}}), "error", "contract_mismatch"),
    (lambda f: f.fail_with.__setitem__("system/status_v1", "storage_or_internal_error"), "error", "storage_or_internal_error"),
])
def test_a_status_read_that_did_not_answer_settles_nothing(make, setup, state, reason):
    fake, c, _s = make()
    fake.answer_shape["sync/station_v1"] = {"accepted": True}  # the classic shape: not the contract -> unknown
    assert sync(c).status_code == 504
    setup(fake)
    body = status(c).json()
    assert body["state"] == state and body["reason"] == reason and body["observation"] is None
    assert body["gate"] == "readback_required" and sync(c).status_code == 409


def test_without_the_status_read_listed_nothing_is_sent_and_nothing_settles(make):
    fake, c, _s = make()
    fake.answer_shape["sync/station_v1"] = {"queued": "maybe"}
    assert sync(c).status_code == 504
    fake.commands.pop("system/status_v1")
    fake.push("refresh")
    wait_for(lambda: "system/status_v1" not in (intercom_sync.SYNC.api_facts(intercom_sync.SYNC.settings) or {}).get("commands", []))
    body = status(c).json()
    assert body["state"] == "unsupported" and body["reason"] == "not_listed" and body["gate"] == "readback_required"
    assert not sent(fake, "system/status_v1")


# ---------------------------------------------------------------- the status read: where Arx's request stands

def test_the_status_read_follows_arxs_request_id_through_wiskeys_batches(make):
    fake, c, _s = make()
    rid = sync(c).json()["data"]["request_id"]
    assert status(c).json()["match"] == "queued"
    assert sync(c).json()["data"]["request_id"] == rid, "a request for the same pending batch shares its id (WisKey coalesces)"
    fake.active["entry-a"] = fake.pending.pop("entry-a")
    assert status(c).json()["match"] == "running"
    fake.pending["entry-a"] = fake.active.pop("entry-a")
    fake.run_batch("entry-a", state="error")
    body = status(c).json()
    assert body["match"] == "finished" and body["observation"]["request"]["last_result"]["state"] == "error"
    assert body["observation"]["request"]["last_result"]["effect_proven"] is False
    fake.last.clear()  # WisKey's runtime restarted: its in-memory ids are gone
    assert status(c).json()["match"] == "not_observed"
    assert body["last_request"] == {"status": "acknowledged", "request_id": rid, "at": body["last_request"]["at"], "code": None}


def test_a_station_wiskey_does_not_report_is_unknown_not_idle(make):
    fake, c, _s = make()
    sync(c)
    fake.status_shape = {**fake.status_doc(), "stations": []}
    body = status(c).json()
    assert body["state"] == "ready" and body["observation"] is None and body["match"] is None


def test_who_may_read_the_sync_request(make):
    fake, c, _s = make()
    assert status(c, "entry-a", "mia").status_code == 200, "the status page's rule on the station"
    assert status(c, "entry-c", "mia").status_code == 404, "outside her station"
    assert status(c, "entry-a", "otto").status_code == 403
    assert status(c, "no-such-station").status_code == 404
    assert status(c, "entry-c", "tech").status_code == 200, "the maintenance deny on entry-c leaves the status rule"
    assert sync(c, "entry-a", "mia").status_code == 403 and sync(c, "entry-c", "tech").status_code == 403
    assert not sent(fake, "sync/station_v1")
    assert len(sent(fake, "system/status_v1")) == 2
