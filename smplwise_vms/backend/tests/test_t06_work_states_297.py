"""WISKEYNEXT-297 slice A (board r152 / WisKey W-031 "T06"): the WORK-STATE half of the admission mapping.

WisKey's open note on T06: "a static status.active is not proof; admitted / pending / running are not accepted". The identity + role +
scope half is pinned by tests/test_t06_admission_295.py (one row per signed command). This file pins the other half, end to end on the
direct feature client and the emergency engine, against the fake WisKey host tests/wkcap_fakes.FakeDirectPort:

  WisKey answer                                   -> Arx durable intent             -> what a caller is told
  features/start  closed `admitted` ack           -> `sent` (NOT accepted)          -> StartOutcome("admitted")
  features/start  any other state / shape         -> `unknown`                      -> StartOutcome("unknown")
  features/result `running`                       -> stays `sent`                   -> DoorOutcome("unknown", "running"); never retried while live
  features/result admitted|pending|accepted|...   -> nothing settled by the read    -> FeatureWireError(unknown)
  features/result `finished`, target outcome not
                  acknowledged|denied|superseded  -> `unknown` (receipt_unknown)    -> DoorOutcome("unknown", "receipt_unknown")
  features/result `finished`, `acknowledged`      -> `accepted`                     -> DoorOutcome("acknowledged"); physical_confirmed stays False
  features/status (any body, `active: true`)      -> nothing                        -> no production caller reads it as a go-live or a result

FAKES ONLY: nothing here contacts WisKey, Home Assistant, a station or a door."""
from __future__ import annotations

import ast
import uuid
from pathlib import Path

import pytest
from test_wkcap_295 import MANUAL, Env, adapters, engine_for, intents, prep, starts  # helpers only (no test functions imported)
from wkcap_fakes import FakeDirectPort

from smplwise.services import door_windows_engine as dwe
from smplwise.services import wiskey_feature_direct as fd
from smplwise.services import wiskey_feature_exec as fx

SERVICES = Path(__file__).resolve().parents[1] / "smplwise"

# Every work-state word seen in WisKey's contracts and replies (features, people_csv jobs, capture, operations) plus the usual "success" words.
NOT_ACCEPTED_STATES = ("admitted", "pending", "running", "queued", "active", "attempted", "in_progress", "accepted", "ok", "success", "succeeded",
                       "completed", "done", "true")
CLOSED_ACK = {"schema_version": 1, "operation_ref": "op-x", "state": "admitted", "execution_result": "pending", "replay_available": False}


@pytest.fixture()
def env(settings):
    e = Env(settings)
    e.admin = e.principal("joni")
    with e.db.connection() as conn:
        fx.set_relay_map(conn, station_id="st-a", api_relay=1, physical_relay=2, confirmed_by=e.admin.user_id, expected_revision=0)
        fx.set_relay_map(conn, station_id="st-a", api_relay=2, physical_relay=1, confirmed_by=e.admin.user_id, expected_revision=0)  # WISKEY-RC5-2310: a door is its PHYSICAL relay; the crossed map covers both
    return e


# ================================================================ the readers: only the closed shapes mean anything

def test_the_closed_admitted_ack_is_the_only_admission_and_it_is_not_an_acceptance():
    assert fd.read_start_ack(dict(CLOSED_ACK)) == "op-x"
    for missing in CLOSED_ACK:
        with pytest.raises(fd.FeatureWireError):
            fd.read_start_ack({k: v for k, v in CLOSED_ACK.items() if k != missing})


@pytest.mark.parametrize("state", [s for s in NOT_ACCEPTED_STATES if s != "admitted"])
def test_an_ack_with_any_other_state_is_unknown(state):
    with pytest.raises(fd.FeatureWireError) as exc:
        fd.read_start_ack({**CLOSED_ACK, "state": state})
    assert (exc.value.code, exc.value.outcome) == ("invalid_response", "unknown")


@pytest.mark.parametrize("execution_result", ["accepted", "succeeded", "done", "acknowledged", "finished", True, None])
def test_an_ack_that_claims_an_execution_result_is_unknown(execution_result):
    with pytest.raises(fd.FeatureWireError) as exc:
        fd.read_start_ack({**CLOSED_ACK, "execution_result": execution_result})
    assert exc.value.outcome == "unknown"


@pytest.mark.parametrize("extra", [{"active": True}, {"status": {"active": True}}, {"accepted": True}, {"physical_result": "opened"}])
def test_an_ack_that_carries_a_static_active_or_accepted_flag_is_unknown(extra):
    with pytest.raises(fd.FeatureWireError) as exc:
        fd.read_start_ack({**CLOSED_ACK, **extra})
    assert exc.value.outcome == "unknown"


@pytest.mark.parametrize("state", [s for s in NOT_ACCEPTED_STATES if s != "running"])
def test_a_result_with_a_state_outside_the_closed_four_is_unknown(state):
    with pytest.raises(fd.FeatureWireError) as exc:
        fd.read_result({"schema_version": 1, "operation_ref": "op-x", "state": state}, "op-x")
    assert exc.value.outcome == "unknown"


def test_running_is_read_as_running_and_finished_is_a_native_receipt_never_a_physical_observation():
    running = fd.read_result({"schema_version": 1, "operation_ref": "op-x", "state": "running"}, "op-x")
    assert running.state == "running" and running.receipt is None and running.physical_confirmed is False
    finished = fd.read_result({"schema_version": 1, "operation_ref": "op-x", "state": "finished", "receipt": {}, "replay_available": False}, "op-x")
    assert finished.state == "finished" and finished.physical_confirmed is False
    with pytest.raises(fd.FeatureWireError):
        fd.read_result({"schema_version": 1, "operation_ref": "op-x", "state": "running", "active": True}, "op-x")
    with pytest.raises(fd.FeatureWireError):
        fd.read_result({"schema_version": 1, "operation_ref": "op-other", "state": "running"}, "op-x")


# ================================================================ the durable intent: admitted is `sent`, never `accepted`

def test_an_admitted_start_leaves_the_intent_sent(env):
    port = FakeDirectPort()
    ad, body, snap = prep(env, port, "live_validation")
    with env.db.connection() as conn:
        out = ad.start(conn, body, snap)
        assert out.state == "admitted" and out.operation_ref
        assert fx.intent_state(conn, body["request_id"]) == "sent"


@pytest.mark.parametrize("state", ["accepted", "running", "pending", "finished", "active"])
def test_a_start_answer_with_another_state_settles_the_intent_unknown_and_is_never_resent(env, state):
    port = FakeDirectPort()
    port.queue["features/start"] = [{**CLOSED_ACK, "state": state}]
    ad, body, snap = prep(env, port, "live_validation", request_id=str(uuid.uuid4()))
    with env.db.connection() as conn:
        out = ad.start(conn, body, snap)
        assert out.state == "unknown" and out.operation_ref is None
        assert fx.intent_state(conn, body["request_id"]) == "unknown"
        with pytest.raises(fx.FeatureError):
            ad.start(conn, body, snap)
    assert len(starts(port)) == 1


def test_the_intent_store_refuses_every_state_but_the_three_settled_ones(env):
    port = FakeDirectPort()
    ad, body, snap = prep(env, port, "live_validation")
    with env.db.connection() as conn:
        ad.start(conn, body, snap)
        for state in ("admitted", "pending", "running", "sent", "active"):
            with pytest.raises(fx.FeatureError):
                fx.settle_feature(conn, body["request_id"], state)
        assert fx.intent_state(conn, body["request_id"]) == "sent"


# ================================================================ the emergency engine: the only production caller of a feature result

def test_running_at_the_host_keeps_the_intent_sent_and_the_door_unknown(env):
    port = FakeDirectPort()
    port.result_mode = "running"
    eng = engine_for(env, port)
    assert eng.apply("open", "st-a", 1, "req-1:st-a:1", "") == dwe.DoorOutcome("unknown", "running")
    assert [r["state"] for r in intents(env)] == ["sent"]


@pytest.mark.parametrize("outcome", ["admitted", "pending", "running", "accepted", "active", "ok", "opened"])
def test_a_finished_receipt_whose_target_is_not_a_closed_outcome_is_unknown_never_acknowledged(env, outcome):
    port = FakeDirectPort()
    port.result_outcome = outcome
    eng = engine_for(env, port)
    out = eng.apply("open", "st-a", 1, f"req-{outcome}:st-a:1", "")
    assert out == dwe.DoorOutcome("unknown", "receipt_unknown")
    (row,) = intents(env)
    assert (row["state"], row["code"]) == ("unknown", "receipt_unknown")


def test_only_an_acknowledged_target_settles_accepted(env):
    port = FakeDirectPort()
    eng = engine_for(env, port)
    assert eng.apply("open", "st-a", 1, "req-ok:st-a:1", "") == dwe.DoorOutcome("acknowledged", "acknowledged")
    (row,) = intents(env)
    assert (row["state"], row["code"]) == ("accepted", "acknowledged")


def test_the_manual_context_is_arx_own_and_never_read_from_the_wire(env):
    ctx = MANUAL(env)
    assert ctx.actor == {"kind": "human", "user_id": env.admin.user_id} and ctx.principals == (env.admin,)


# ================================================================ a static status is never proof

def test_no_production_module_reads_features_status_as_a_result_or_a_go_live():
    """`DirectFeatureClient.status()` returns WisKey's raw capability map. A static `active: true` there proves nothing, so no product code may
    call it; a future caller must be reviewed against this note (WisKey T06) and added here deliberately."""
    callers = []
    for path in SERVICES.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        if not any(k in text for k in ("wiskey_feature_direct", "DirectFeatureClient", "FeatureAdapters", "features/status")):
            continue  # only modules that can reach the feature client (a generic `.status()` elsewhere is unrelated)
        tree = ast.parse(text)
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "status" and not node.args and not node.keywords:
                callers.append(f"{path.relative_to(SERVICES).as_posix()}:{node.lineno}")
            if isinstance(node, ast.Constant) and node.value == "features/status":
                callers.append(f"{path.relative_to(SERVICES).as_posix()}:{node.lineno}:literal")
    allowed = {"services/wiskey_feature_direct.py"}  # the client itself (COMMANDS tuple + status())
    foreign = sorted(c for c in callers if c.split(":")[0] not in allowed)
    assert foreign == [], foreign


def test_a_status_answer_claiming_active_changes_no_intent(env):
    port = FakeDirectPort()
    port.queue["features/status"] = [{"schema_version": 1, "active": True, "features": {"emergency_buttons": {"active": True, "state": "accepted"}}}]
    ad, body, snap = prep(env, port, "live_validation")
    with env.db.connection() as conn:
        ad.start(conn, body, snap)
        before = fx.intent_state(conn, body["request_id"])
    assert adapters(port).client.status()["active"] is True
    with env.db.connection(mode="read") as conn:
        assert fx.intent_state(conn, body["request_id"]) == before == "sent"
