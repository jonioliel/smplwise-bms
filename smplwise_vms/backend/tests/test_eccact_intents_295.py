"""ECCACT-295 stage 2 (FAKES ONLY): the durable WisKey fence intents and the exact-original create resolution.
Nothing contacts WisKey or Home Assistant; the answers are hand-built frames following the PROPOSED create-resolution shape."""
from __future__ import annotations

import copy
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import wiskey_intents as wi
from smplwise.services import wiskey_peer as wp

MIG = Path(__file__).resolve().parents[1] / "smplwise" / "migrations" / "0137_wiskey_peer_intents_feature_registry.sql"
REPO = "11111111-2222-4333-8444-555555555555"
OWNER = "a" * 32
PEER = wp._mint_peer(value="peer-1", peer_binding_ref="bind-1", peer_binding_revision=3, repository_id=REPO, query_owner_id=OWNER)


@pytest.fixture()
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:")
    c.executescript(MIG.read_text(encoding="utf-8"))
    return c


def admit_create(conn, n: int = 1, **over: Any) -> wi.ExactOriginal:
    kw = dict(peer=PEER, operation_id=f"op-{n}", request_id=f"req-{n}", origin_ref=f"grant:{n}:1", operation_binding_ref=f"opb-{n}", issued_epoch=7, command="users/create")
    kw.update(over)
    return wi.admit(conn, **kw)


def admit_update(conn, n: int = 1, **over: Any) -> wi.ExactOriginal:
    kw = dict(peer=PEER, operation_id=f"up-{n}", request_id=f"ureq-{n}", origin_ref=f"editor:{n}", operation_binding_ref=f"uopb-{n}", issued_epoch=7,
              command="users/update", user_id="person-a", revision_before=4)
    kw.update(over)
    return wi.admit(conn, **kw)


def answer(o: wi.ExactOriginal, **over: Any) -> dict[str, Any]:
    res = {"schema_version": 1, "protocol": wi.CREATE_PROTOCOL, "repository_id": o.repository_id, "observed_epoch": 7, "query_owner_id": o.query_owner_ref,
           "peer_binding_ref": o.peer_binding_ref, "peer_binding_revision": o.peer_binding_revision, "request_id": o.request_id,
           "operation_id": o.operation_id, "operation_binding_ref": o.operation_binding_ref, "origin_ref": o.origin_ref,
           "exclusive_writer_established": True, "state": "committed", "terminal": True, "created": {"user_id": "person-new", "revision_after": 1},
           "reason_code": None, "error_code": None, "scope": wi.CREATE_SCOPE, "device_state": "not_attested"}
    res.update(over)
    return {"id": 9, "type": "result", "success": True, "result": res}


# ---------------------------------------------------------------- admission and the state machine

def test_admission_is_unique_per_operation_request_and_origin(conn):
    admit_create(conn)
    for over in (dict(), dict(operation_id="op-x"), dict(operation_id="op-y", request_id="req-y")):
        with pytest.raises(wi.IntentError) as e:
            admit_create(conn, 1, **over)
        assert e.value.code == "duplicate"
    admit_create(conn, 2)


def test_only_an_intent_can_be_sent_and_only_once(conn):
    o = admit_create(conn)
    wi.mark_sent(conn, o)
    with pytest.raises(wi.IntentError):
        wi.mark_sent(conn, o)
    assert wi.state(conn, o) == "sent"


def test_a_create_and_an_update_have_different_shapes(conn):
    with pytest.raises(wi.IntentError):
        admit_update(conn, user_id=None)  # revision without a user is neither
    with pytest.raises(wi.IntentError):
        admit_create(conn, operation_id="")
    assert admit_update(conn).is_create is False and admit_create(conn).is_create is True


def test_the_open_worklist_is_intent_sent_and_unknown_only(conn):
    a, b, c = admit_create(conn, 1), admit_create(conn, 2), admit_create(conn, 3)
    wi.mark_sent(conn, b); wi.mark_sent(conn, c); wi.mark_unknown(conn, c, "timeout")
    assert {o.operation_id for o in wi.open_intents(conn)} == {"op-1", "op-2", "op-3"}
    exp = wi.CreateExpectation(c, PEER)
    wi.settle_create(conn, exp, wi.verify_create_resolution(answer(c), exp))
    assert {o.operation_id for o in wi.open_intents(conn)} == {"op-1", "op-2"} and a.operation_id == "op-1"


# ---------------------------------------------------------------- exact-original create resolution

def test_a_valid_committed_answer_settles_once_and_records_the_created_person(conn):
    o = admit_create(conn); wi.mark_sent(conn, o); wi.mark_unknown(conn, o, "timeout")
    exp = wi.CreateExpectation(o, PEER)
    v = wi.verify_create_resolution(answer(o), exp)
    assert (v.state, v.settles, v.created) == ("committed", True, {"user_id": "person-new", "revision_after": 1})
    assert wi.settle_create(conn, exp, v) == "settled" and wi.state(conn, o) == "committed"
    assert wi.settle_create(conn, exp, v) == "duplicate"
    other = wi.verify_create_resolution(answer(o, state="never_committed", created=None, reason_code="pre_effect_refused", error_code="refused"), exp)
    assert wi.settle_create(conn, exp, other) == "conflict" and wi.state(conn, o) == "committed"
    row = conn.execute("SELECT created_user_id, revision_after FROM wiskey_fence_intents").fetchone()
    assert row == ("person-new", 1)


def test_two_creates_can_never_claim_the_same_person(conn):
    a, b = admit_create(conn, 1), admit_create(conn, 2)
    ea, eb = wi.CreateExpectation(a, PEER), wi.CreateExpectation(b, PEER)
    assert wi.settle_create(conn, ea, wi.verify_create_resolution(answer(a), ea)) == "settled"
    assert wi.settle_create(conn, eb, wi.verify_create_resolution(answer(b), eb)) == "conflict"
    assert wi.state(conn, b) == "intent"


@pytest.mark.parametrize("key", ["repository_id", "query_owner_id", "peer_binding_ref", "request_id", "operation_id", "operation_binding_ref", "origin_ref"])
def test_every_exact_reference_must_match_byte_for_byte(conn, key):
    o = admit_create(conn); exp = wi.CreateExpectation(o, PEER)
    for wrong in (answer(o)["result"][key].upper() + "x", " " + answer(o)["result"][key], ""):
        v = wi.verify_create_resolution(answer(o, **{key: wrong}), exp)
        assert v.state == "unknown" and not v.settles and v.code == f"mismatch:{key}"


def test_an_answer_for_another_create_or_the_same_person_by_similarity_is_not_accepted(conn):
    a, b = admit_create(conn, 1), admit_create(conn, 2)
    exp = wi.CreateExpectation(a, PEER)
    assert not wi.verify_create_resolution(answer(b), exp).settles  # b's references, asked about a


@pytest.mark.parametrize("mut", [
    lambda r: r.pop("origin_ref"), lambda r: r.update(extra=1), lambda r: r.update(schema_version=2), lambda r: r.update(protocol="x"),
    lambda r: r.update(scope="central_capture_person_commit"), lambda r: r.update(device_state="applied"), lambda r: r.update(observed_epoch=True),
    lambda r: r.update(observed_epoch=6), lambda r: r.update(peer_binding_revision=2 ** 53), lambda r: r.update(created=None),
    lambda r: r.update(created={"user_id": "p", "revision_after": 0}), lambda r: r.update(created={"user_id": "p"}),
    lambda r: r.update(terminal=False), lambda r: r.update(exclusive_writer_established=False), lambda r: r.update(reason_code="x"),
    lambda r: r.update(state="weird"), lambda r: r.update(error_code=5)])
def test_anything_off_contract_is_unknown(conn, mut):
    o = admit_create(conn); exp = wi.CreateExpectation(o, PEER)
    frame = copy.deepcopy(answer(o)); mut(frame["result"])
    v = wi.verify_create_resolution(frame, exp)
    assert v.state == "unknown" and not v.settles


def test_envelopes_errors_and_in_flight_never_settle(conn):
    o = admit_create(conn); exp = wi.CreateExpectation(o, PEER)
    for frame in (None, {}, {"id": 1, "type": "result", "success": False, "error": {"code": "unauthorized"}}, {"id": 1, "type": "result", "success": 1, "result": {}}):
        assert not wi.verify_create_resolution(frame, exp).settles
    flight = answer(o, state="in_flight", terminal=False, created=None, reason_code="handler_active", exclusive_writer_established=False)
    v = wi.verify_create_resolution(flight, exp)
    assert v.state == "in_flight" and not v.settles
    assert wi.settle_create(conn, exp, v) == "open" and wi.state(conn, o) == "intent"


def test_recovered_uncommitted_needs_a_fresh_exclusive_writer_context(conn):
    o = admit_create(conn); exp = wi.CreateExpectation(o, PEER)
    frame = answer(o, state="never_committed", created=None, reason_code="recovered_uncommitted")
    assert wi.verify_create_resolution(frame, exp).code == "ownership_unproven"
    ctx = wp.FenceContext(repository_id=REPO, writer_epoch=7, owner_id=OWNER, exclusive_writer_established=True)
    v = wi.verify_create_resolution(frame, exp, context=ctx)
    assert (v.state, v.settles, v.code) == ("never_committed", True, "recovered_uncommitted")
    assert wi.verify_create_resolution(frame, exp, context=wp.FenceContext(REPO, 8, OWNER, True)).code == "ownership_unproven"


def test_the_expectation_refuses_an_update_intent_or_another_peer(conn):
    u = admit_update(conn)
    with pytest.raises(wi.IntentError):
        wi.CreateExpectation(u, PEER)
    o = admit_create(conn)
    other = wp._mint_peer(value="peer-1", peer_binding_ref="bind-1", peer_binding_revision=4, repository_id=REPO, query_owner_id=OWNER)
    with pytest.raises(wi.IntentError):
        wi.CreateExpectation(o, other)


def test_the_resolve_request_carries_only_the_original_references(conn):
    req = admit_create(conn).as_request()
    assert set(req) == {"repository_id", "operation_id", "request_id", "origin_ref", "operation_binding_ref", "peer_binding_ref", "peer_binding_revision"}
    text = repr(req).lower()
    assert not any(w in text for w in ("pin", "card", "name", "employee", "phone"))


def test_the_live_resolve_transport_is_not_built(conn):
    with pytest.raises(wp.PeerSeamError) as e:
        wi.LiveResolveTransport().resolve(admit_create(conn))
    assert e.value.code == "not_built"


# ---------------------------------------------------------------- updates through the receipt verdict

def test_an_update_settles_from_a_verified_receipt_verdict_and_one_transition_per_revision(conn):
    a, b = admit_update(conn, 1), admit_update(conn, 2)
    committed = wp.ReceiptVerdict("committed", True, "committed", {"user_id": "person-a", "revision_before": 4, "revision_after": 5})
    assert wi.settle_update(conn, a, committed) == "settled"
    assert wi.settle_update(conn, a, committed) == "duplicate"
    assert wi.settle_update(conn, b, committed) == "conflict"  # a second operation claiming the same transition
    unknown = wp.ReceiptVerdict("unknown", False, "timeout")
    c = admit_update(conn, 3, user_id="person-b")
    wi.mark_sent(conn, c)
    assert wi.settle_update(conn, c, unknown) == "open" and wi.state(conn, c) == "unknown"
    with pytest.raises(wi.IntentError):
        wi.settle_update(conn, admit_create(conn, 9), committed)
