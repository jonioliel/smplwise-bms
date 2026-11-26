"""WISKEY-A2-EXEC-2530 (FAKES ONLY): the read-only status of WisKey's reviewed schedule execution, contract
`wiskey-schedule-execution.v1` (WisKey PRODUCT rc20 dcebb9f34c8f, docs/contracts/full-management-v1/schedules--operations_*_v1).
Owner 25.11, A2 option b: the owner approves in WisKey's own screen; Arx shows the status only and never approves, executes, previews
or cancels. services/wiskey_schedule_execution.py, routers/access_control_schedule_execution.py, wiskey_direct_catalog.direct_refusal.

Layers: the closed answers and the 58 s cap (pure); the phase rules; the status check against this file's own model of WisKey's
operations (job + deployment + in-memory reviews) behind a fake port; the never-sent commands on the direct session and on every classic
channel; the routes (switch default off, permissions, audit). Nothing here contacts a network, Home Assistant, a station or WisKey."""
from __future__ import annotations

import copy
import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from support.apps import as_user, bind

from smplwise.db import Database
from smplwise.services import wiskey_channels as wc
from smplwise.services import wiskey_direct_catalog as wdc
from smplwise.services import wiskey_schedule_execution as sx

API = "/api/v1/access-control/schedules/execution"
JOB = "job-1"
CURSOR = "1.3." + "a" * 64
FINGERPRINT = "f" * 64


# ================================================================ WisKey's operations, modelled independently

def job_doc(status: str = "blocked", **over: Any) -> dict[str, Any]:
    doc = {"id": JOB, "revision": 3, "plan_id": "plan-1", "plan_revision": 2, "station_id": "entry-a", "name": "Office",
           "resource_keys": ["weekly:1"], "created_at": "2026-11-25T08:00:00Z", "updated_at": "2026-11-25T08:01:00Z", "status": status,
           "error": None, "blockers": ["schedule_writes_unverified"] if status == "blocked" else [], "report": None, "journal_id": None,
           "ownership": "current"}
    doc.update(over)
    return doc


def deployment_doc(status: str = "ready", steps: list[str] | None = None, issue: str | None = None) -> dict[str, Any]:
    states = steps if steps is not None else ["pending", "intent"]
    return {"id": "dep-1", "revision": 1, "status": status, "issue": issue, "created_at": "2026-11-25T08:02:00Z",
            "updated_at": "2026-11-25T08:03:00Z",
            "steps": [{"key": f"weekly:{i}", "state": s, "attempted": s != "pending"} for i, s in enumerate(states, 1)]}


class Wiskey:
    """One job, its deployment record (or none) and the in-memory reviews of the execution contract, as schedule_execution_api.py
    answers them: status_v1 -> ScheduleExecutionStatus, pending_v1 -> every live review, review_v1 -> one review."""

    def __init__(self) -> None:
        self.job = job_doc()
        self.deployment: dict[str, Any] | None = None
        self.reviews: dict[str, dict[str, Any]] = {}
        self.missing = False

    def status(self, params: dict[str, Any]) -> dict[str, Any]:
        if set(params) != {"job_id"}:
            raise Refused("invalid_fields")
        if self.missing or params["job_id"] != self.job["id"]:
            raise Refused("schedule_operation_not_found")
        terminal = self.job["status"] in ("cancelled", "verified", "failed")
        return {"contract": sx.CONTRACT, "operation_id": self.job["id"], "cursor": CURSOR, "resume_state": "snapshot", "reason": None,
                "all_intermediate_events_delivered": False, "job": copy.deepcopy(self.job), "deployment": copy.deepcopy(self.deployment),
                "terminal": terminal, "physical_result": "unproven", "replay_available": False}

    def pending(self, params: dict[str, Any]) -> dict[str, Any]:
        if params:
            raise Refused("invalid_fields")
        return {"contract": sx.CONTRACT, "reviews": [
            {"review_id": rid, "operation_id": r["job"], "own_request": False, "remaining_seconds": 200} for rid, r in self.reviews.items()]}

    def review(self, params: dict[str, Any]) -> dict[str, Any]:
        r = self.reviews.get(params.get("review_id"))
        if r is None or r.get("expired"):
            raise Refused("review_expired")
        return {"contract": sx.CONTRACT, "review_id": params["review_id"], "operation_id": r["job"], "fingerprint": FINGERPRINT,
                "draft": {"name": "Office"}, "station_id": "entry-a", "resource_keys": ["weekly:1"], "own_request": False,
                "state": r["state"], "remaining_seconds": 200}


class Refused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class FakePort:
    def __init__(self, w: Wiskey | None = None, *, support: tuple[str, str | None, frozenset[str]] | None = None) -> None:
        self.w = w or Wiskey()
        self.supported = support or ("supported", None, frozenset(sx.READS))
        self.calls: list[tuple[str, dict[str, Any], float]] = []
        self.fail: dict[str, tuple[str, str]] = {}
        self.tamper: Any = None

    def support(self) -> tuple[str, str | None, frozenset[str]]:
        return self.supported

    def call(self, command: str, parameters: dict[str, Any], *, timeout: float) -> Any:
        self.calls.append((command, copy.deepcopy(parameters), timeout))
        assert command in sx.READS, command  # nothing but the three reads ever reaches the port
        if command in self.fail:
            raise sx.PortFailure(*self.fail[command])
        handler = {sx.STATUS: self.w.status, sx.PENDING: self.w.pending, sx.REVIEW: self.w.review}[command]
        try:
            doc = handler(parameters)
        except Refused as exc:
            raise sx.PortFailure(exc.code, "refused") from None
        return self.tamper(command, doc) if self.tamper else doc

    def sent(self) -> list[str]:
        return [c for c, _p, _t in self.calls]


@pytest.fixture(autouse=True)
def _clean():
    sx.reset()
    yield
    sx.reset()


# ================================================================ the closed answers

def test_a_valid_status_is_read_and_every_deviation_rejects_the_whole() -> None:
    w = Wiskey()
    w.deployment = deployment_doc()
    good = w.status({"job_id": JOB})
    assert sx.read_status(good, JOB)["job"]["status"] == "blocked"
    bad: list[Any] = []
    for key, value in (("contract", "wiskey-schedule-execution.v2"), ("operation_id", "job-2"), ("physical_result", "proven"),
                       ("replay_available", True), ("all_intermediate_events_delivered", True), ("terminal", 1),
                       ("cursor", "nope"), ("resume_state", "later"), ("reason", "other")):
        doc = copy.deepcopy(good)
        doc[key] = value
        bad.append(doc)
    extra = copy.deepcopy(good)
    extra["approved_by"] = "arx"
    missing = copy.deepcopy(good)
    del missing["deployment"]
    job_extra = copy.deepcopy(good)
    job_extra["job"]["approved"] = True
    job_enum = copy.deepcopy(good)
    job_enum["job"]["status"] = "executed"
    job_bool = copy.deepcopy(good)
    job_bool["job"]["revision"] = True  # a bool is not an integer
    step_extra = copy.deepcopy(good)
    step_extra["deployment"]["steps"][0]["by"] = "arx"
    dep_enum = copy.deepcopy(good)
    dep_enum["deployment"]["status"] = "done"
    bad += [extra, missing, job_extra, job_enum, job_bool, step_extra, dep_enum, [], None, "ok"]
    for doc in bad:
        with pytest.raises(sx.SchemaError) as exc:
            sx.read_status(doc, JOB)
        assert exc.value.code == "contract_mismatch"


def test_the_58_second_cap_is_checked_before_anything_is_sent() -> None:
    assert sx.check_timeout(58) == 58.0 and sx.check_timeout(0.5) == 0.5
    for t in (0, -1, 58.01, 120, True, "10", None):
        with pytest.raises(sx.ReadError) as exc:
            sx.check_timeout(t)
        assert (exc.value.code, exc.value.outcome) == ("timeout_exceeds_abi", "not_sent")
    port = FakePort()
    with pytest.raises(sx.ReadError):
        sx.check(JOB, port=port, timeout=59)
    with pytest.raises(sx.ReadError):
        sx.check(JOB, port=port, review_timeout=0)
    assert port.calls == []


def test_the_review_answer_keeps_only_the_state() -> None:
    w = Wiskey()
    w.reviews["r1"] = {"job": JOB, "state": "approved"}
    doc = w.review({"review_id": "r1"})
    assert sx.read_review(doc, "r1", JOB) == "approved"
    other = dict(doc, operation_id="job-9")
    with pytest.raises(sx.SchemaError):
        sx.read_review(other, "r1", JOB)
    with pytest.raises(sx.SchemaError):
        sx.read_review(dict(doc, state="maybe"), "r1", JOB)
    with pytest.raises(sx.SchemaError):
        sx.read_pending({"contract": sx.CONTRACT, "reviews": [{"review_id": "r1"}]})


# ================================================================ the phase

def _phase(job: dict[str, Any], dep: dict[str, Any] | None = None, **reviews: int) -> tuple[str, str | None]:
    return sx.phase_of({"job": job, "deployment": dep, "terminal": False}, reviews)


def test_phases() -> None:
    assert _phase(job_doc("blocked")) == ("waiting_owner", "schedule_writes_unverified")
    assert _phase(job_doc("ready")) == ("waiting_owner", None)
    assert _phase(job_doc("ready"), pending=1) == ("review_pending", None)
    assert _phase(job_doc("ready"), pending=1, approved=1) == ("approved", None)
    assert _phase(job_doc("ready"), rejected=1) == ("rejected", None)
    assert _phase(job_doc("checking"), deployment_doc("ready")) == ("executing", None)
    assert _phase(job_doc("checking"), deployment_doc("recovery_required", issue="write_uncertain")) == ("attention", "write_uncertain")
    assert _phase(job_doc("interrupted"), deployment_doc("ready")) == ("attention", "schedule_operation_interrupted")
    assert _phase(job_doc("interrupted")) == ("attention", "schedule_operation_interrupted")
    assert _phase(job_doc("failed", error="station_offline"), deployment_doc("ready")) == ("failed", "station_offline")
    assert _phase(job_doc("checking"), deployment_doc("conflict", issue="resource_changed")) == ("failed", "resource_changed")
    assert _phase(job_doc("cancelled")) == ("cancelled", None)
    assert _phase(job_doc("verified"), deployment_doc("verified", ["verified", "verified"])) == ("executed", None)
    # executed needs WisKey's read-back of every step; a verified job WITHOUT a deployment record (the legacy path) is never executed
    assert _phase(job_doc("verified"), deployment_doc("verified", ["verified", "intent"])) == ("unknown", "deployment_steps_unverified")
    assert _phase(job_doc("verified"), deployment_doc("verified", [])) == ("unknown", "deployment_steps_unverified")
    assert _phase(job_doc("verified")) == ("unknown", "deployment_missing")
    assert set(sx.PHASES) >= {_phase(job_doc(s))[0] for s in sx.JOB_STATUSES}


# ================================================================ the status check

def test_a_check_sends_only_reads_with_capped_timeouts_and_shows_waiting_for_the_owner() -> None:
    port = FakePort()
    port.w.reviews["r-other"] = {"job": "job-9", "state": "pending"}  # another job's review is not this job's
    r = sx.check(JOB, port=port)
    assert r["status_read"] == {"outcome": "ok", "code": None}
    assert r["job"]["phase"] == "waiting_owner" and r["job"]["code"] == "schedule_writes_unverified"
    assert r["job"]["reviews"] == {"pending": 0, "approved": 0, "rejected": 0} and r["job"]["reviews_read"] is True
    assert port.sent() == [sx.STATUS, sx.PENDING]  # no review of another job was read
    assert all(0 < t <= sx.MAX_TIMEOUT_S for _c, _p, t in port.calls)
    assert port.calls[0][1] == {"job_id": JOB}
    assert not set(port.sent()) & sx.NEVER
    assert r["job"]["physical_result"] == "unproven" and r["job"]["final"] is False


def test_owner_reviews_are_read_and_their_material_never_kept() -> None:
    port = FakePort()
    port.w.job = job_doc("ready")
    port.w.reviews["r1"] = {"job": JOB, "state": "pending"}
    port.w.reviews["r2"] = {"job": JOB, "state": "approved"}
    port.w.reviews["r3"] = {"job": JOB, "state": "pending", "expired": True}  # expired between the two reads: skipped
    r = sx.check(JOB, port=port)
    assert r["job"]["phase"] == "approved" and r["job"]["reviews"] == {"pending": 1, "approved": 1, "rejected": 0}
    text = json.dumps(r)
    assert FINGERPRINT not in text and "r1" not in text and "Office" not in text  # no fingerprint, review id or draft is kept
    assert sx.REVIEW in port.sent() and not set(port.sent()) & sx.NEVER


def test_without_the_review_reads_listed_only_the_status_is_read() -> None:
    port = FakePort(support=("supported", None, frozenset({sx.STATUS})))
    port.w.reviews["r1"] = {"job": JOB, "state": "approved"}
    r = sx.check(JOB, port=port)
    assert port.sent() == [sx.STATUS] and r["job"]["phase"] == "waiting_owner" and r["job"]["reviews_read"] is False


def test_unsupported_or_unavailable_sends_nothing() -> None:
    for sup in (("unsupported", "not_listed", frozenset()), ("unavailable", "wiskey_direct_not_connected", frozenset())):
        port = FakePort(support=sup)
        r = sx.check(JOB, port=port)
        assert port.calls == [] and r["job"] is None and r["status_read"]["outcome"] == "not_sent"
        assert r["support"]["state"] == sup[0]
    assert sx.support()["state"] in ("unavailable", "supported", "unsupported")  # the real provider never raises


def test_execution_progress_and_the_final_result_is_not_read_again() -> None:
    port = FakePort()
    port.w.job = job_doc("checking")
    port.w.deployment = deployment_doc("ready", ["intent", "pending"])
    assert sx.check(JOB, port=port)["job"]["phase"] == "executing"
    port.w.job = job_doc("verified")
    port.w.deployment = deployment_doc("verified", ["verified", "verified"])
    done = sx.check(JOB, port=port)["job"]
    assert done["phase"] == "executed" and done["final"] and done["steps_verified"] == done["steps_total"] == 2
    port.calls.clear()
    port.w.missing = True  # even an eviction later can never turn the known result back
    again = sx.check(JOB, port=port)
    assert port.calls == [] and again["status_read"] == {"outcome": "not_needed", "code": "final"} and again["job"]["phase"] == "executed"


def test_a_failed_read_never_downgrades_what_was_known() -> None:
    port = FakePort()
    port.w.job = job_doc("checking")
    port.w.deployment = deployment_doc("ready")
    known = sx.check(JOB, port=port)["job"]
    for outcome in ("unknown", "not_sent", "refused"):
        port.fail = {sx.STATUS: ("bridge_outcome_unknown", outcome)}
        r = sx.check(JOB, port=port)
        assert r["status_read"]["outcome"] == outcome and r["job"] == known
    port.fail = {}
    port.tamper = lambda c, d: dict(d, replay_available=True)
    r = sx.check(JOB, port=port)
    assert r["status_read"] == {"outcome": "error", "code": "contract_mismatch"} and r["job"] == known
    assert sx.known(JOB) == known


def test_an_unknown_first_read_says_unknown_and_is_settled_by_a_status_read_of_the_same_job() -> None:
    port = FakePort()
    port.fail = {sx.STATUS: ("media_outcome_unknown", "unknown")}
    first = sx.check(JOB, port=port)
    assert first["job"]["phase"] == "unknown" and first["job"]["code"] == "media_outcome_unknown"
    port.fail = {}
    settled = sx.check(JOB, port=port)
    assert settled["job"]["phase"] == "waiting_owner"
    assert [p for c, p, _t in port.calls if c == sx.STATUS] == [{"job_id": JOB}, {"job_id": JOB}]  # the same id, nothing else


def test_a_job_wiskey_does_not_know_is_not_found() -> None:
    port = FakePort()
    port.w.missing = True
    r = sx.check(JOB, port=port)
    assert r["job"]["phase"] == "not_found" and r["status_read"]["outcome"] == "ok"


def test_a_bad_review_answer_falls_back_to_waiting_for_the_owner() -> None:
    port = FakePort()
    port.w.reviews["r1"] = {"job": JOB, "state": "approved"}
    port.tamper = lambda c, d: dict(d, fingerprint=None, extra=1) if c == sx.REVIEW else d
    r = sx.check(JOB, port=port)
    assert r["job"]["phase"] == "waiting_owner" and r["job"]["reviews_read"] is False


def test_one_check_per_job_at_a_time() -> None:
    port = FakePort()
    sx._BUSY.add(JOB)
    with pytest.raises(sx.ReadError) as exc:
        sx.check(JOB, port=port)
    assert exc.value.code == "schedule_status_busy" and port.calls == []
    with pytest.raises(ValueError):
        sx.check("bad\nid", port=port)


def test_memory_is_bounded() -> None:
    port = FakePort()
    for i in range(sx.KEEP + 5):
        port.w.job = job_doc(id=f"job-{i}")
        sx.check(f"job-{i}", port=port)
    rows = sx.known_all()
    assert len(rows) == sx.KEEP and rows[0]["job_id"] == f"job-{sx.KEEP + 4}"


# ================================================================ never sent

def test_the_approval_execution_preview_and_cancel_never_travel_on_the_direct_envelope() -> None:
    from smplwise.services import wiskey_direct_join as join
    from smplwise.services import wiskey_media_bridge as bridge

    assert wdc.SCHEDULE_EXECUTION_OWNER_ONLY == sx.NEVER
    for command in sorted(sx.NEVER):
        assert wdc.direct_refusal(command) == "owner_action_in_wiskey"
    for command in sx.READS:
        assert wdc.direct_refusal(command) is None

    class NoSocket:
        opened = 0

        async def connect(self, purpose: str) -> Any:
            NoSocket.opened += 1
            raise AssertionError("no socket may be needed to refuse")

    session = join.DirectCommandSession(NoSocket())  # type: ignore[arg-type]
    try:
        for command in sorted(sx.NEVER):
            with pytest.raises(bridge.MediaBridgeError) as exc:
                session.run_sync(session.call(command, {"job_id": JOB}, timeout=5), 10)
            assert (exc.value.code, exc.value.outcome) == ("owner_action_in_wiskey", "not_sent")
        assert NoSocket.opened == 0
    finally:
        session.close()

    jp = sx.JoinPort(SimpleNamespace(session=None))
    for command in sorted(sx.NEVER):
        with pytest.raises(sx.PortFailure) as pf:
            jp.call(command, {}, timeout=5)
        assert (pf.value.code, pf.value.outcome) == ("owner_action_in_wiskey", "not_sent")


def test_no_classic_channel_carries_the_execution_family() -> None:
    family = set(sx.NEVER) | set(sx.READS)
    for channel, commands in wc.ALLOWLISTS.items():
        assert not family & set(commands), channel


def test_join_port_support_follows_the_current_connection() -> None:
    class Session:
        def __init__(self, refusal: str | None) -> None:
            self.refusal = refusal

        def transport_refusal(self, command: str) -> str | None:
            return self.refusal

    def join(listed: set[str], configured: bool = True, refusal: str | None = "command_not_discovered") -> Any:
        return SimpleNamespace(configured=lambda: configured, selected=lambda c=None: c in listed, session=Session(refusal))

    assert sx.JoinPort(join(set(sx.READS))).support() == ("supported", None, frozenset(sx.READS))
    assert sx.JoinPort(join({sx.STATUS})).support() == ("supported", None, frozenset({sx.STATUS}))
    assert sx.JoinPort(join(set())).support()[:2] == ("unsupported", "not_listed")
    assert sx.JoinPort(join(set(), refusal=None)).support()[:2] == ("unavailable", "wiskey_direct_not_connected")
    assert sx.JoinPort(join(set(sx.READS), configured=False)).support()[:2] == ("unavailable", "direct_not_selected")


# ================================================================ the routes

@pytest.fixture()
def app(settings, monkeypatch):
    from smplwise.main import create_app

    port = FakePort()
    support_calls: list[int] = []
    real_support = port.support

    def counted() -> tuple[str, str | None, frozenset[str]]:
        support_calls.append(1)
        return real_support()

    port.support = counted  # type: ignore[method-assign]
    monkeypatch.setattr(sx, "PORT_PROVIDER", lambda: port)
    c = TestClient(create_app(settings))
    bind(c, settings, "root", "system_admin", "installation", "*")
    bind(c, settings, "otto", "operator", "installation", "*")
    yield SimpleNamespace(c=c, port=port, support_calls=support_calls, db=Database(settings.db_path))


def audit_rows(a: Any, action: str) -> list[dict[str, Any]]:
    with a.db.connection(mode="read") as conn:
        conn.row_factory = None
        rows = conn.execute("SELECT decision, reason, details_json FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()
    return [{"decision": r[0], "reason": r[1], "details": json.loads(r[2] or "{}")} for r in rows]


def test_the_switch_is_off_by_default_and_nothing_is_read(app) -> None:
    v = app.c.get(API, headers=as_user("root"))
    assert v.status_code == 200, v.text
    body = v.json()
    assert body["enabled"] is False and body["support"]["state"] == "off" and body["jobs"] == [] and body["can_configure"] is True
    r = app.c.post(f"{API}/{JOB}/status", headers=as_user("root"))
    assert r.status_code == 409 and r.json()["code"] == "feature_disabled"
    assert app.port.calls == [] and app.support_calls == []


def test_only_a_system_administrator_turns_it_on_and_it_is_audited(app) -> None:
    assert app.c.put(f"{API}/settings", json={"enabled": True}, headers=as_user("otto")).status_code == 403
    assert app.c.put(f"{API}/settings", json={"enabled": "yes"}, headers=as_user("root")).status_code == 422
    assert app.c.put(f"{API}/settings", json={"enabled": True, "x": 1}, headers=as_user("root")).status_code == 422
    on = app.c.put(f"{API}/settings", json={"enabled": True}, headers=as_user("root"))
    assert on.status_code == 200, on.text
    assert on.json()["enabled"] is True
    assert on.json()["support"]["state"] == "supported"
    rows = audit_rows(app, sx.AUDIT_SETTINGS)
    assert rows[-1]["decision"] == "allowed" and rows[-1]["details"] == {"key": sx.SWITCH_KEY, "before": "off", "after": "on"}
    assert all(r["decision"] == "allowed" for r in rows)  # the refusal is audited by the administrator gate itself


def test_status_reads_through_the_route(app) -> None:
    app.c.put(f"{API}/settings", json={"enabled": True}, headers=as_user("root"))
    assert app.c.get(API, headers=as_user("otto")).status_code == 403
    assert app.c.post(f"{API}/{JOB}/status", headers=as_user("otto")).status_code == 403
    r = app.c.post(f"{API}/{JOB}/status", headers=as_user("root"))
    assert r.status_code == 200, r.text
    assert r.json()["job"]["phase"] == "waiting_owner" and r.json()["status_read"]["outcome"] == "ok"
    listed = app.c.get(API, headers=as_user("root")).json()
    assert [j["job_id"] for j in listed["jobs"]] == [JOB]
    assert app.c.post(f"{API}/bad%20id/status", headers=as_user("root")).status_code == 422
    assert not set(app.port.sent()) & sx.NEVER
    off = app.c.put(f"{API}/settings", json={"enabled": False}, headers=as_user("root")).json()
    assert off["enabled"] is False and off["jobs"] == [] and sx.known_all() == []
