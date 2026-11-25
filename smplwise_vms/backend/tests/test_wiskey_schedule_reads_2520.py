"""WISKEY-SCHED-READS-2520 (FAKES ONLY): Arx's consumer of WisKey's signed schedule inspection jobs, contract `wiskey-schedule-reads.v1`
(WisKey PRODUCT rc20 dcebb9f34c8f, docs/contracts/schedule-reads-v1). services/wiskey_schedule_reads.py, routers/access_control_schedule_reads.py.

Three layers:
- the closed schemas (start / status / result) and the 58 s cap, pure;
- the cycle against `Jobs`, this file's OWN model of WisKey's runtime-local job table (schedule_read_jobs.py as its README describes it:
  one admission per UUID, tombstones that outlive eviction, `schedule_read_request_reused`, status `unknown` for a missing record), behind
  a fake port - lost start acknowledgement, no replay, restart, eviction, refusals, schema rejection, unsupported;
- the same cycle over REAL signed frames: the in-memory direct server of tests/test_wkjoin_295.py (hello, signed connect, every request's
  envelope checked by that file's own code) extended here with the two commands, the proof-expiry check and the business contract block.
Nothing here contacts a network, Home Assistant, a station or WisKey."""
from __future__ import annotations

import asyncio
import copy
import time
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from support.apps import as_user, bind

from smplwise.db import Database
from smplwise.services import wiskey_direct_join as join
from smplwise.services import wiskey_media_bridge as bridge
from smplwise.services import wiskey_schedule_reads as sr
from smplwise.services import wiskey_schedule_writes as sw

API = "/api/v1/access-control/schedules/reads"
STATION = "entry-a"
PLAN = "0b7c9a52-3f1e-4c1a-9e55-2a1d3c4b5e6f"
SCHEDULE = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b"
OFFICE = {"name": "Office", "weekly": {d: [{"start": "08:00", "end": "17:00"}] for d in sw.DAYS}, "holidays": []}


# ================================================================ WisKey's job table, modelled independently

class Refused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


START_KEYS = {"request_id", "command", "parameters"}
SHAPES = {
    "schedules/readiness": {"station_id"}, "schedules/dependencies": {"station_id"}, "schedules/assess": {"station_id", "data"},
    "schedules/plan_preview": {"station_id", "schedule_id", "revision", "bindings"}, "schedules/plan_recheck": {"plan_id", "revision"},
    "schedules/operations_claim_preview": {"plan_id", "revision"},
}


class Jobs:
    """WisKey's runtime-local schedule read jobs: admitted once per UUID, a tombstone per admitted UUID that survives eviction, results
    `accepted` -> `running` -> `completed` / `refused` as the test drives them, `unknown` for an absent record."""

    def __init__(self) -> None:
        self.jobs: dict[str, dict[str, Any]] = {}
        self.tombstones: set[str] = set()
        self.started: list[dict[str, Any]] = []

    def start(self, params: dict[str, Any]) -> dict[str, Any]:
        if set(params) != START_KEYS or params["command"] not in SHAPES or set(params["parameters"]) != SHAPES[params["command"]]:
            raise Refused("invalid_fields")
        rid = params["request_id"]
        if rid in self.tombstones:
            raise Refused("schedule_read_request_reused")
        self.tombstones.add(rid)
        self.started.append(copy.deepcopy(params))
        self.jobs[rid] = {"operation": params["command"], "status": "accepted", "result": None, "error": None}
        return self.doc(rid)

    def status(self, params: dict[str, Any]) -> dict[str, Any]:
        if set(params) != {"request_id"}:
            raise Refused("invalid_fields")
        return self.doc(params["request_id"])

    def run(self, rid: str) -> None:
        self.jobs[rid]["status"] = "running"

    def finish(self, rid: str, result: dict[str, Any] | None = None, error: str | None = None) -> None:
        self.jobs[rid].update(status="refused" if error else "completed", result=None if error else result, error=error)

    def restart(self) -> None:
        """A WisKey process restart: every record is gone (tombstones too - the runtime is new); status answers unknown."""
        self.jobs.clear()
        self.tombstones.clear()

    def doc(self, rid: str) -> dict[str, Any]:
        job = self.jobs.get(rid)
        return {"contract": "wiskey-schedule-reads.v1", "request_id": rid, "status": job["status"] if job else "unknown",
                "operation": job["operation"] if job else None, "result": job["result"] if job else None, "error": job["error"] if job else None,
                "scope": "current_runtime_and_pairing", "history_complete": False, "replay_available": False, "max_status_wait_seconds": 0}


class FakePort:
    def __init__(self, jobs: Jobs | None = None, *, support: tuple[str, str | None] = ("supported", None)) -> None:
        self.jobs = jobs or Jobs()
        self.supported = support
        self.calls: list[tuple[str, dict[str, Any], float]] = []
        self.drop_start_reply = False  # WisKey admits the job, the acknowledgement never reaches Arx
        self.not_sent = False
        self.tamper: Any = None  # a function over the reply document
        self.fail: tuple[str, str] | None = None  # (code, outcome) of every call

    def support(self) -> tuple[str, str | None]:
        return self.supported

    def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> Any:
        self.calls.append((command, copy.deepcopy(parameters), timeout))
        if self.not_sent:
            raise sr.PortFailure("connection_closed", "not_sent")
        if self.fail is not None:
            raise sr.PortFailure(*self.fail)
        try:
            doc = self.jobs.start(parameters) if command == sr.START else self.jobs.status(parameters)
        except Refused as exc:
            raise sr.PortFailure(exc.code, "refused") from None
        if command == sr.START and self.drop_start_reply:
            raise sr.PortFailure("media_outcome_unknown", "unknown")
        return self.tamper(doc) if self.tamper else doc

    def sent(self, command: str) -> list[dict[str, Any]]:
        return [p for c, p, _t in self.calls if c == command]


@pytest.fixture()
def db(settings) -> Database:
    d = Database(settings.db_path)
    d.migrate()
    return d


def readiness_result() -> dict[str, Any]:
    return {"checked_at": "2026-11-25T08:00:00Z", "can_apply": False, "reason": "schedule_writes_unverified",
            "checks": [{"kind": "weekly", "advertised": True, "read_state": "readable", "coverage": "complete", "read": 4, "total": 4,
                        "capabilities": {"ids": [1, 32], "max_periods": 8}}]}


def plan_result(revision: int) -> dict[str, Any]:
    return {"id": PLAN, "revision": revision, "station_id": STATION, "name": "Office", "token": "one-use-plan-token",
            "report": {"checked_at": "2026-11-25T08:00:00Z", "blockers": ["schedule_writes_unverified"], "resources": []}}


# ================================================================ the closed schemas

def body(command: str = "schedules/readiness", **params: Any) -> dict[str, Any]:
    return {"request_id": str(uuid.uuid4()), "command": command, "parameters": params or {"station_id": STATION}}


@pytest.mark.parametrize("command,params", [
    ("schedules/readiness", {"station_id": STATION}),
    ("schedules/dependencies", {"station_id": STATION}),
    ("schedules/assess", {"station_id": STATION, "data": OFFICE}),
    ("schedules/plan_preview", {"station_id": STATION, "schedule_id": SCHEDULE, "revision": 3, "bindings": {"template": 1}}),
    ("schedules/plan_recheck", {"plan_id": PLAN, "revision": 3}),
    ("schedules/operations_claim_preview", {"plan_id": PLAN, "revision": 3}),
])
def test_start_schema_accepts_exactly_each_operations_parameter_set(command, params):
    b = body(command, **params)
    assert sr.check_start(b) == b


@pytest.mark.parametrize("mutate,where", [
    (lambda b: b.update(extra=1), "start"),
    (lambda b: b.pop("parameters"), "start"),
    (lambda b: b.update(request_id=b["request_id"].upper()), "request_id"),
    (lambda b: b.update(request_id="not-a-uuid"), "request_id"),
    (lambda b: b.update(command="schedules/read_start_v1"), "command"),  # no recursive dispatch
    (lambda b: b.update(command="schedules/operations_decide_v1"), "command"),  # no A2, no approval
    (lambda b: b.update(command="users/create"), "command"),
    (lambda b: b["parameters"].update(actor="x"), "parameters"),  # undeclared key: the whole body is rejected
    (lambda b: b.update(parameters={}), "parameters"),
    (lambda b: b.update(parameters={"station_id": 7}), "parameters.station_id"),
])
def test_start_schema_rejects_the_whole_body(mutate, where):
    b = body()
    mutate(b)
    with pytest.raises(sr.SchemaError) as exc:
        sr.check_start(b)
    assert exc.value.code == "schema_rejected" and exc.value.where == where


def test_start_schema_types_a_revision_strictly():
    for bad in (True, "3", 3.0):
        with pytest.raises(sr.SchemaError):
            sr.check_start(body("schedules/plan_recheck", plan_id=PLAN, revision=bad))


def test_status_schema_is_exactly_the_request_id():
    rid = str(uuid.uuid4())
    assert sr.check_status({"request_id": rid}) == {"request_id": rid}
    for bad in ({}, {"request_id": rid, "x": 1}, {"request_id": rid.upper()}, {"request_id": 5}):
        with pytest.raises(sr.SchemaError):
            sr.check_status(bad)


def good_doc(rid: str, **over: Any) -> dict[str, Any]:
    doc = Jobs().doc(rid)
    doc.update(status="running", operation="schedules/readiness")
    doc.update(over)
    return doc


def test_result_schema_accepts_the_contract_shape():
    rid = str(uuid.uuid4())
    assert sr.read_result(good_doc(rid), rid, "schedules/readiness")["status"] == "running"
    assert sr.read_result(good_doc(rid, status="unknown", operation=None), rid, "schedules/readiness")["status"] == "unknown"


@pytest.mark.parametrize("over,where", [
    ({"extra": 1}, "extra"),
    ({"contract": "wiskey-schedule-reads.v2"}, "contract"),
    ({"status": "done"}, "status"),
    ({"operation": "schedules/plan_save"}, "operation"),
    ({"operation": "schedules/dependencies"}, "operation"),  # another operation than the one started
    ({"operation": None}, "operation"),  # null operation is only for an unknown status
    ({"result": []}, "result"),
    ({"error": 5}, "error"),
    ({"scope": "installation"}, "scope"),
    ({"history_complete": True}, "history_complete"),
    ({"replay_available": True}, "replay_available"),
    ({"max_status_wait_seconds": 0.0}, "max_status_wait_seconds"),
    ({"max_status_wait_seconds": 5}, "max_status_wait_seconds"),
])
def test_result_schema_rejects_the_whole_answer(over, where):
    rid = str(uuid.uuid4())
    with pytest.raises(sr.SchemaError) as exc:
        sr.read_result(good_doc(rid, **over), rid, "schedules/readiness")
    assert exc.value.code == "contract_mismatch" and exc.value.where == where


def test_result_schema_rejects_a_missing_key_and_another_request_id():
    rid = str(uuid.uuid4())
    doc = good_doc(rid)
    del doc["scope"]
    with pytest.raises(sr.SchemaError):
        sr.read_result(doc, rid, "schedules/readiness")
    with pytest.raises(sr.SchemaError) as exc:
        sr.read_result(good_doc(str(uuid.uuid4())), rid, "schedules/readiness")
    assert exc.value.where == "request_id"


def test_every_call_timeout_is_capped_at_58_seconds():
    assert sr.check_timeout(58) == 58.0 and sr.check_timeout(0.5) == 0.5
    for bad in (58.01, 0, -1, True, "10", None):
        with pytest.raises(sr.ReadError) as exc:
            sr.check_timeout(bad)
        assert exc.value.code == "timeout_exceeds_abi" and exc.value.outcome == "not_sent"
    assert sr.START_TIMEOUT_S <= sr.MAX_TIMEOUT_S and sr.STATUS_TIMEOUT_S <= sr.MAX_TIMEOUT_S == bridge.MAX_CALL_TIMEOUT_S


# ================================================================ the cycle (fake port)

def test_unsupported_sends_nothing_and_persists_nothing(db):
    for support in (("unsupported", "not_listed"), ("unsupported", "contract_mismatch"), ("unavailable", "wiskey_direct_not_connected")):
        port = FakePort(support=support)
        out = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)
        assert out["read"] is None and out["support"]["state"] == support[0] and out["support"]["reason"] == support[1]
        assert port.calls == [] and sr.recent(db) == []


def test_no_installed_direct_join_is_unavailable_and_sends_nothing(db, monkeypatch):
    monkeypatch.setattr(join, "JOIN", None)
    out = sr.start(db, "root", "readiness", {"station_id": STATION})
    assert out == {"support": {"state": "unavailable", "reason": "direct_not_installed", "contract": sr.CONTRACT}, "read": None}
    assert sr.recent(db) == []


def test_the_request_id_is_persisted_before_the_start_frame(db):
    port = FakePort()
    seen: list[Any] = []
    real = port.call

    def spy(command, parameters, *, timeout):
        seen.append(sr.get(db, parameters["request_id"]))  # what is committed at the moment the frame goes out
        return real(command, parameters, timeout=timeout)

    port.call = spy  # type: ignore[method-assign]
    out = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)
    assert seen[0] is not None and seen[0]["state"] == "sending" and seen[0]["requested_by"] == "root"
    assert seen[0]["request_id"] == out["read"]["request_id"] and sr.canonical_uuid(out["read"]["request_id"])


def test_full_cycle_accepted_running_completed_keeps_the_projection_without_tokens(db):
    port = FakePort()
    read = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]
    rid = read["request_id"]
    assert read["state"] == "accepted" and read["start_outcome"] == "ok" and read["can_check"] and not read["final"]
    assert port.sent(sr.START) == [{"request_id": rid, "command": "schedules/readiness", "parameters": {"station_id": STATION}}]
    port.jobs.run(rid)
    assert sr.status(db, rid, port=port)["read"]["state"] == "running"
    port.jobs.finish(rid, readiness_result())
    out = sr.status(db, rid, port=port)
    assert out["status_read"] == {"outcome": "ok", "code": None}
    done = out["read"]
    assert done["state"] == "completed" and done["final"] and not done["can_check"] and done["status_reads"] == 2
    assert done["data"]["checks"][0]["read_state"] == "readable" and done["data"]["can_apply"] is False
    assert len(port.sent(sr.START)) == 1 and port.sent(sr.STATUS) == [{"request_id": rid}] * 2
    assert all(t <= sr.MAX_TIMEOUT_S for _c, _p, t in port.calls)


def test_a_lost_start_acknowledgement_is_unknown_and_settled_only_by_status(db):
    port = FakePort()
    port.drop_start_reply = True
    read = sr.start(db, "root", "dependencies", {"station_id": STATION}, port=port)["read"]
    rid = read["request_id"]
    assert read["state"] == "unknown" and read["start_outcome"] == "unknown" and read["can_check"]
    port.drop_start_reply = False
    port.jobs.finish(rid, {"checked_at": "2026-11-25T08:00:00Z", "users_checked": True, "mapping_complete": True,
                           "users": {"state": "complete", "read": 12, "explicit": 3, "implicit": 9, "malformed": 0}, "checks": []})
    done = sr.status(db, rid, port=port)["read"]
    assert done["state"] == "completed" and done["start_outcome"] == "unknown" and done["data"]["users"]["read"] == 12
    assert len(port.sent(sr.START)) == 1  # never resent to find out


def test_replay_never_happens_across_unknown_status_restart_and_a_new_start(db):
    port = FakePort()
    port.drop_start_reply = True
    rid = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]["request_id"]
    port.drop_start_reply = False
    port.jobs.restart()  # WisKey restarted: the record is gone
    for _ in range(3):
        out = sr.status(db, rid, port=port)
        assert out["read"]["state"] == "unknown" and out["status_read"]["outcome"] == "ok"
    # an Arx restart: a fresh port over the same database still only asks for status
    port2 = FakePort(port.jobs)
    assert sr.status(db, rid, port=port2)["read"]["state"] == "unknown" and port2.sent(sr.START) == []
    # an operator's new start is a NEW request id, never the old one
    again = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port2)["read"]
    assert again["request_id"] != rid
    starts = port.sent(sr.START) + port2.sent(sr.START)
    assert [s["request_id"] for s in starts] == [rid, again["request_id"]]


def test_a_known_result_is_never_turned_back_into_unknown_by_eviction(db):
    port = FakePort()
    rid = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]["request_id"]
    port.jobs.finish(rid, readiness_result())
    assert sr.status(db, rid, port=port)["read"]["state"] == "completed"
    port.jobs.jobs.clear()  # WisKey evicted the result
    before = len(port.calls)
    out = sr.status(db, rid, port=port)
    assert out["status_read"] == {"outcome": "not_needed", "code": "final"} and out["read"]["state"] == "completed"
    assert len(port.calls) == before


def test_a_status_after_wiskey_restart_stays_unknown_never_not_sent(db):
    port = FakePort()
    rid = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]["request_id"]
    port.jobs.run(rid)
    sr.status(db, rid, port=port)
    port.jobs.restart()
    read = sr.status(db, rid, port=port)["read"]
    assert read["state"] == "unknown" and read["wiskey_code"] == "status_unknown" and read["can_check"]


def test_start_refusals_definite_unclear_and_not_sent(db):
    port = FakePort()
    port.fail = ("pairing_authentication_required", "refused")
    r = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]
    assert r["state"] == "refused" and r["wiskey_code"] == "pairing_authentication_required" and r["final"]
    port.fail = ("bridge_outcome_unknown", "refused")  # says nothing about admission: unknown, status settles it
    r = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]
    assert r["state"] == "unknown" and r["can_check"]
    port.fail = ("Unauthorized", "refused")
    assert sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]["state"] == "unknown"
    port.fail = None
    port.not_sent = True
    r = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]
    assert r["state"] == "not_sent" and r["final"] and not r["can_check"]
    before = len(port.calls)
    out = sr.status(db, r["request_id"], port=port)
    assert out["status_read"] == {"outcome": "not_needed", "code": "never_sent"} and len(port.calls) == before


def test_a_job_refused_by_wiskey_keeps_its_code(db):
    port = FakePort()
    rid = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]["request_id"]
    port.jobs.finish(rid, error="station_offline")
    read = sr.status(db, rid, port=port)["read"]
    assert read["state"] == "refused" and read["wiskey_code"] == "station_offline" and read["data"] is None


def test_an_out_of_contract_start_answer_is_unknown_and_a_bad_status_changes_nothing(db):
    port = FakePort()
    port.tamper = lambda d: {**d, "debug": True}
    read = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]
    assert read["state"] == "unknown" and read["wiskey_code"] == "contract_mismatch"  # sent: never "not sent"
    rid = read["request_id"]
    port.jobs.finish(rid, readiness_result())
    out = sr.status(db, rid, port=port)
    assert out["status_read"] == {"outcome": "error", "code": "contract_mismatch"} and out["read"]["state"] == "unknown"
    port.tamper = lambda d: {**d, "request_id": str(uuid.uuid4())}
    assert sr.status(db, rid, port=port)["status_read"]["outcome"] == "error"
    port.tamper = None
    assert sr.status(db, rid, port=port)["read"]["state"] == "completed"


def test_status_transport_failures_leave_the_row_unchanged(db):
    port = FakePort()
    rid = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]["request_id"]
    for code, outcome in (("media_outcome_unknown", "unknown"), ("connection_closed", "not_sent"), ("Unauthorized", "refused")):
        port.fail = (code, outcome)
        out = sr.status(db, rid, port=port)
        assert out["status_read"] == {"outcome": outcome, "code": code} and out["read"]["state"] == "accepted"
    port.fail = None
    port.supported = ("unsupported", "not_listed")  # discovery changed: nothing sent
    before = len(port.calls)
    out = sr.status(db, rid, port=port)
    assert out["status_read"] == {"outcome": "not_sent", "code": "not_listed"} and len(port.calls) == before


def test_the_timeout_cap_refuses_before_anything_is_persisted_or_sent(db):
    port = FakePort()
    with pytest.raises(sr.ReadError) as exc:
        sr.start(db, "root", "readiness", {"station_id": STATION}, port=port, timeout=59)
    assert exc.value.code == "timeout_exceeds_abi" and port.calls == [] and sr.recent(db) == []
    rid = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]["request_id"]
    with pytest.raises(sr.ReadError):
        sr.status(db, rid, port=port, timeout=120)
    assert port.sent(sr.STATUS) == []


def test_the_returned_plan_revision_is_kept_whatever_it_is(db):
    port = FakePort()
    for returned in (7, 5, 4):  # requested 5: it may grow, stay or (for WisKey's own reasons) differ - never assumed
        rid = sr.start(db, "root", "plan_recheck", {"plan_id": PLAN, "revision": 5}, port=port)["read"]["request_id"]
        port.jobs.finish(rid, plan_result(returned))
        read = sr.status(db, rid, port=port)["read"]
        assert read["revision"] == 5 and read["plan_revision"] == returned
        assert "token" not in str(read["data"])  # the one-use token never kept
    rid = sr.start(db, "root", "claim_preview", {"plan_id": PLAN, "revision": 7}, port=port)["read"]["request_id"]
    port.jobs.finish(rid, {"token": "claim-token", "plan_id": PLAN, "plan_revision": 8, "resource_keys": ["weekly:1"], "report": None})
    read = sr.status(db, rid, port=port)["read"]
    assert read["plan_revision"] == 8 and "claim-token" not in str(read)


def test_an_unreadable_completed_result_is_completed_without_data(db):
    port = FakePort()
    rid = sr.start(db, "root", "plan_recheck", {"plan_id": PLAN, "revision": 2}, port=port)["read"]["request_id"]
    port.jobs.finish(rid, {"no_id": True})
    read = sr.status(db, rid, port=port)["read"]
    assert read["state"] == "completed" and read["data"] is None and read["wiskey_code"] == "result_unrecognised"


def test_a_start_interrupted_mid_send_becomes_unknown_and_is_settled_by_status(db):
    port = FakePort()
    rid = str(uuid.uuid4())
    old = (datetime.now(timezone.utc) - timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with db.write_aside() as w:
        w.execute("INSERT INTO wiskey_schedule_reads(request_id, action, operation, subject, state, requested_by, created_at, updated_at) "
                  "VALUES (?, 'readiness', 'schedules/readiness', ?, 'sending', 'root', ?, ?)", (rid, STATION, old, old))
    fresh = str(uuid.uuid4())
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with db.write_aside() as w:
        w.execute("INSERT INTO wiskey_schedule_reads(request_id, action, operation, subject, state, requested_by, created_at, updated_at) "
                  "VALUES (?, 'readiness', 'schedules/readiness', ?, 'sending', 'root', ?, ?)", (fresh, STATION, now, now))
    rows = {r["request_id"]: r for r in sr.listing(db)["reads"]}
    assert rows[rid]["state"] == "unknown" and rows[rid]["wiskey_code"] == "start_outcome_lost"
    assert rows[fresh]["state"] == "sending" and not rows[fresh]["can_check"]
    assert sr.status(db, fresh, port=port)["status_read"] == {"outcome": "not_sent", "code": "start_in_flight"}
    assert sr.status(db, rid, port=port)["read"]["state"] == "unknown" and port.sent(sr.START) == []


def test_retention_drops_final_rows_first(db, monkeypatch):
    monkeypatch.setattr(sr, "KEEP_ROWS", 3)
    port = FakePort()
    port.drop_start_reply = True
    keep = sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)["read"]["request_id"]  # an open UNKNOWN
    port.drop_start_reply = False
    port.not_sent = True
    for _ in range(4):
        sr.start(db, "root", "readiness", {"station_id": STATION}, port=port)
    ids = [r["request_id"] for r in sr.recent(db, 50)]
    assert len(ids) == 3 and keep in ids


def test_listing_with_an_unknown_port_state_is_unavailable(db, monkeypatch):
    monkeypatch.setattr(sr, "PORT_PROVIDER", lambda: FakePort(support=("maybe", None)))
    assert sr.listing(db)["support"] == {"state": "unavailable", "reason": "support_unreadable", "contract": sr.CONTRACT}


# ================================================================ the routes

@pytest.fixture()
def app(settings, monkeypatch):
    from smplwise.main import create_app

    port = FakePort()
    monkeypatch.setattr(sr, "PORT_PROVIDER", lambda: port)
    monkeypatch.setattr(sw, "COOLDOWN_SCALE", 0.0)
    sw.reset()
    c = TestClient(create_app(settings))
    bind(c, settings, "root", "system_admin", "installation", "*")
    bind(c, settings, "otto", "operator", "installation", "*")
    yield SimpleNamespace(c=c, port=port, settings=settings, db=Database(settings.db_path))
    sw.reset()


def audit_rows(a: Any, action: str) -> list[dict[str, Any]]:
    import json as _json

    with a.db.connection(mode="read") as conn:
        conn.row_factory = None
        rows = conn.execute("SELECT decision, reason, details_json FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()
    return [{"decision": r[0], "reason": r[1], "details": _json.loads(r[2] or "{}")} for r in rows]


def test_only_the_schedules_administrator_reaches_the_routes(app):
    c = app.c
    rid = str(uuid.uuid4())
    assert c.get(API, headers=as_user("otto")).status_code == 403
    assert c.post(API, json={"action": "readiness", "parameters": {"station_id": STATION}}, headers=as_user("otto")).status_code == 403
    assert c.post(f"{API}/{rid}/status", headers=as_user("otto")).status_code == 403
    assert app.port.calls == []
    denied = audit_rows(app, "access.schedules.manage")
    assert denied and all(r["decision"] == "denied" and r["reason"] == "schedules_admin_required" for r in denied)


def test_route_cycle_start_status_completed_and_audited(app):
    c = app.c
    listed = c.get(API, headers=as_user("root"))
    assert listed.status_code == 200 and listed.json() == {"support": {"state": "supported", "reason": None, "contract": sr.CONTRACT}, "reads": []}
    r = c.post(API, json={"action": "readiness", "parameters": {"station_id": STATION}}, headers=as_user("root"))
    assert r.status_code == 200, r.text
    read = r.json()["read"]
    assert read["state"] == "accepted" and read["action"] == "readiness" and read["subject"] == STATION
    rid = read["request_id"]
    app.port.jobs.finish(rid, readiness_result())
    s = c.post(f"{API}/{rid}/status", headers=as_user("root"))
    assert s.status_code == 200 and s.json()["read"]["state"] == "completed" and s.json()["status_read"]["outcome"] == "ok"
    assert [x["request_id"] for x in c.get(API, headers=as_user("root")).json()["reads"]] == [rid]
    rows = audit_rows(app, "intercom.schedule_read_start")
    assert rows[-1]["decision"] == "allowed" and rows[-1]["details"]["request_id"] == rid and rows[-1]["details"]["outcome"] == "accepted"
    assert "token" not in str(rows)


def test_route_unsupported_sends_nothing_and_says_why(app):
    app.port.supported = ("unsupported", "not_listed")
    r = app.c.post(API, json={"action": "dependencies", "parameters": {"station_id": STATION}}, headers=as_user("root"))
    assert r.status_code == 200 and r.json() == {"support": {"state": "unsupported", "reason": "not_listed", "contract": sr.CONTRACT}, "read": None}
    assert app.port.calls == [] and app.c.get(API, headers=as_user("root")).json()["reads"] == []
    assert audit_rows(app, "intercom.schedule_read_start")[-1]["reason"] == "not_listed"


@pytest.mark.parametrize("payload", [
    {"action": "readiness", "parameters": {"station_id": STATION, "actor": "x"}},  # undeclared key
    {"action": "readiness", "parameters": {}},
    {"action": "readiness", "parameters": {"station_id": "../x"}},
    {"action": "plan_recheck", "parameters": {"plan_id": PLAN, "revision": True}},
    {"action": "plan_recheck", "parameters": {"plan_id": "x", "revision": 2}},
    {"action": "deploy", "parameters": {}},
    {"action": "readiness", "parameters": {"station_id": STATION}, "request_id": str(uuid.uuid4())},  # Arx makes the id, never the browser
    {"action": "assess", "parameters": {"station_id": STATION, "data": {**OFFICE, "weekly": {}}}},
    {"action": "plan_preview", "parameters": {"station_id": STATION, "schedule_id": SCHEDULE, "revision": 1, "bindings": {"template": "1"}}},
])
def test_route_rejects_a_body_outside_the_contract_before_anything_is_sent(app, payload):
    r = app.c.post(API, json=payload, headers=as_user("root"))
    assert r.status_code == 422, r.text
    assert r.json()["details"]["outcome"] == "not_sent" and app.port.calls == []


def test_route_status_of_an_id_arx_never_started_is_404_and_nothing_is_sent(app):
    r = app.c.post(f"{API}/{uuid.uuid4()}/status", headers=as_user("root"))
    assert r.status_code == 404 and app.port.calls == []
    assert app.c.post(f"{API}/NOT-A-UUID-NOT-A-UUID-NOT-A-UUID-1234/status", headers=as_user("root")).status_code == 422


def test_route_lost_start_then_status_never_resends_start(app):
    app.port.drop_start_reply = True
    read = app.c.post(API, json={"action": "readiness", "parameters": {"station_id": STATION}}, headers=as_user("root")).json()["read"]
    assert read["state"] == "unknown"
    app.port.drop_start_reply = False
    app.port.jobs.finish(read["request_id"], readiness_result())
    s = app.c.post(f"{API}/{read['request_id']}/status", headers=as_user("root")).json()
    assert s["read"]["state"] == "completed" and len(app.port.sent(sr.START)) == 1


# ================================================================ real signed frames (the direct join over the in-memory direct server)

from test_wkjoin_295 import JoinServer  # noqa: E402 - the shared fake direct server with its own envelope check
from w10_fake_station import SECRET  # noqa: E402


class ReadJobsServer(JoinServer):
    """JoinServer plus the two commands: each request's envelope is checked by JoinServer's own code (HMAC, fresh nonce, kind, subject,
    0 < TTL <= 15 s), then here the proof must not be expired at the SERVER's clock (`skew_s`), then `Jobs` answers."""

    def __init__(self, *, list_commands: bool = True, contracts: Any = "default", **kw: Any) -> None:
        super().__init__(**kw)
        self.jobs = Jobs()
        self.skew_s = 0.0
        self.drop_start_reply = False
        self.list_commands = list_commands
        self.contracts = contracts
        self.frames: list[dict[str, Any]] = []
        from smplwise.services import wiskey_direct_catalog as wdc

        base = {e.command for e in wdc.load().entries() if e.discovered}
        self.discovered = base | ({sr.START, sr.STATUS} if list_commands else set())

    def capabilities_doc(self) -> dict[str, Any]:
        doc = super().capabilities_doc()
        if self.contracts == "default":
            doc["business_contracts"] = {sr.START: {"contract": sr.CONTRACT}, sr.STATUS: {"contract": sr.CONTRACT}}
        elif self.contracts is not None:
            doc["business_contracts"] = self.contracts
        return doc

    def expired(self, bridge_body: dict[str, Any]) -> bool:
        now = datetime.now(timezone.utc) + timedelta(seconds=self.skew_s)
        return now >= datetime.fromisoformat(bridge_body["expires_at"])

    async def _dispatch(self, dc: Any, message: dict[str, Any]) -> None:
        command = message["type"].removeprefix("hikvision_intercom/")
        if command not in (sr.START, sr.STATUS):
            return await super()._dispatch(dc, message)
        command, kind, params = self._check(dc, message)
        self.received.append((command, kind, params))
        self.frames.append(copy.deepcopy(message))
        mid = message["id"]
        if self.expired(message["bridge"]):
            await dc.send_frame({"id": mid, "type": "result", "success": False, "error": {"code": "Unauthorized", "message": "x"}})
            return
        try:
            doc = self.jobs.start(params) if command == sr.START else self.jobs.status(params)
        except Refused as exc:
            await dc.send_frame({"id": mid, "type": "result", "success": False, "error": {"code": exc.code, "message": "x"}})
            return
        if command == sr.START and self.drop_start_reply:
            return  # admitted; the acknowledgement is lost
        await dc.send_frame({"id": mid, "type": "result", "success": True, "result": doc})


@pytest.fixture()
def wire_env(db, monkeypatch):
    made: list[Any] = []

    def build(**kw: Any) -> SimpleNamespace:
        server = ReadJobsServer(**kw)
        transport = bridge.DirectApiTransport(server.opener, lambda: SECRET)
        session = join.DirectCommandSession(transport)
        j = join.DirectJoin(session, provider_ok=lambda: True, key_ok=lambda: True)
        made.append((server, session))
        return SimpleNamespace(server=server, session=session, port=sr.JoinPort(j), db=db)

    yield build
    for server, session in made:
        try:
            session.run_sync(server.stop(), 5)
        except Exception:  # noqa: BLE001
            pass
        session.close()


def sent_frames(server: ReadJobsServer, command: str) -> list[dict[str, Any]]:
    return [f for f in server.frames if f["type"] == "hikvision_intercom/" + command]


def test_wire_not_listed_or_another_contract_sends_no_schedule_command(wire_env):
    for kw, reason in (({"list_commands": False}, "not_listed"), ({"contracts": None}, "contract_mismatch"),
                       ({"contracts": {sr.START: {"contract": "wiskey-schedule-reads.v2"}, sr.STATUS: {"contract": sr.CONTRACT}}}, "contract_mismatch")):
        e = wire_env(**kw)
        out = sr.start(e.db, "root", "readiness", {"station_id": STATION}, port=e.port)
        assert out["read"] is None and out["support"] == {"state": "unsupported", "reason": reason, "contract": sr.CONTRACT}
        assert e.server.frames == [] and {c for c, _k, _p in e.server.received} <= {"direct/capabilities", "direct/time"}


def test_wire_full_cycle_signed_frames_each_with_a_fresh_proof(wire_env):
    e = wire_env()
    read = sr.start(e.db, "root", "readiness", {"station_id": STATION}, port=e.port)["read"]
    rid = read["request_id"]
    assert read["state"] == "accepted"
    e.server.jobs.run(rid)
    assert sr.status(e.db, rid, port=e.port)["read"]["state"] == "running"
    e.server.jobs.finish(rid, readiness_result())
    assert sr.status(e.db, rid, port=e.port)["read"]["state"] == "completed"
    starts, statuses = sent_frames(e.server, sr.START), sent_frames(e.server, sr.STATUS)
    assert len(starts) == 1 and len(statuses) == 2
    assert starts[0]["bridge"]["parameters"] == {"request_id": rid, "command": "schedules/readiness", "parameters": {"station_id": STATION}}
    assert all(f["bridge"]["parameters"] == {"request_id": rid} for f in statuses)
    proofs = [f["bridge"] for f in starts + statuses]
    assert len({p["nonce"] for p in proofs}) == 3 and len({p["sig"] for p in proofs}) == 3  # a new proof per request
    assert all(p["kind"] == "wiskey-bridge-command.v1" and p["query_owner_id"] == e.server.subject for p in proofs)


def test_wire_status_after_the_start_proof_expired_carries_a_fresh_valid_proof(wire_env):
    e = wire_env()
    read = sr.start(e.db, "root", "readiness", {"station_id": STATION}, port=e.port)["read"]
    rid = read["request_id"]
    start_proof = sent_frames(e.server, sr.START)[0]["bridge"]
    # 11 s later on both clocks (WisKey's own test: the original 10 s proof window has genuinely expired)
    e.server.skew_s = 11.0
    link = e.session._link
    link.signer._clock = lambda: time.time() + 11.0
    assert e.server.expired(start_proof)  # the start's proof would be refused now (a replay could never pass)
    e.server.jobs.run(rid)
    out = sr.status(e.db, rid, port=e.port)
    assert out["status_read"]["outcome"] == "ok" and out["read"]["state"] == "running"
    status_proof = sent_frames(e.server, sr.STATUS)[-1]["bridge"]
    assert not e.server.expired(status_proof) and status_proof["nonce"] != start_proof["nonce"]
    assert datetime.fromisoformat(status_proof["issued_at"]) >= datetime.fromisoformat(start_proof["expires_at"])
    assert len(sent_frames(e.server, sr.START)) == 1


def test_wire_a_stale_proof_refusal_is_reported_and_changes_nothing(wire_env):
    e = wire_env()
    rid = sr.start(e.db, "root", "readiness", {"station_id": STATION}, port=e.port)["read"]["request_id"]
    e.server.skew_s = 30.0  # WisKey's clock is far ahead: Arx's proof arrives expired
    out = sr.status(e.db, rid, port=e.port)
    assert out["status_read"] == {"outcome": "refused", "code": "Unauthorized"} and out["read"]["state"] == "accepted"
    assert len(sent_frames(e.server, sr.START)) == 1


def test_wire_lost_start_reply_is_unknown_then_status_settles_it_without_replay(wire_env):
    e = wire_env()
    e.server.drop_start_reply = True
    read = sr.start(e.db, "root", "readiness", {"station_id": STATION}, port=e.port, timeout=0.5)["read"]
    rid = read["request_id"]
    assert read["state"] == "unknown" and read["start_outcome"] == "unknown"
    e.server.drop_start_reply = False
    e.server.jobs.finish(rid, readiness_result())
    assert sr.status(e.db, rid, port=e.port)["read"]["state"] == "completed"
    assert len(sent_frames(e.server, sr.START)) == 1 and e.server.jobs.started[0]["request_id"] == rid


def test_wire_reusing_an_admitted_id_is_wiskeys_refusal_and_arx_never_does_it(wire_env):
    """Arx has no path that sends start for an existing row; WisKey's own guard is modelled here to show what a reuse would meet."""
    e = wire_env()
    rid = sr.start(e.db, "root", "readiness", {"station_id": STATION}, port=e.port)["read"]["request_id"]
    with pytest.raises(sr.PortFailure) as exc:
        e.port.call(sr.START, {"request_id": rid, "command": "schedules/readiness", "parameters": {"station_id": STATION}}, timeout=5)
    assert exc.value.outcome == "refused" and exc.value.code == "schedule_read_request_reused"


def test_no_schedule_read_ever_goes_over_the_home_assistant_channel():
    """WisKey answers both commands only to a signed pairing principal (`pairing_authentication_required` on the classic socket):
    the schedule reads are not on any WebSocket channel of Arx's live session."""
    from smplwise.services import wiskey_channels as ch

    assert not any(c in cmds for cmds in ch.ALLOWLISTS.values() for c in (sr.START, sr.STATUS))
    assert asyncio.iscoroutinefunction(join.DirectCommandSession.call)
