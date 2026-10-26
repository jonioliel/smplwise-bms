"""WKADAPT-295 item 1 (FAKES ONLY): the receipt read follows WisKey's real `hikvision_intercom/peer_receipts/resolve`
(PEER_QUERY_V1_SPEC section 9, T05_EXACT_ORIGINAL_AND_WRITER, WisKey round 2 2026-10-23): parameters exactly
`{peer_binding_ref, peer_binding_revision, original}` with the closed seven-field original; result exactly
`{schema_version: 1, state: found | unknown, receipt}`. Owner decision 2026-10-23: UNKNOWN is never a licence to replay, and this
route never yields never_committed. Nothing contacts WisKey or Home Assistant; the frames are hand-built."""
from __future__ import annotations

import copy
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import wiskey_intents as wi
from smplwise.services import wiskey_peer as wp

MIG = Path(__file__).resolve().parents[1] / "smplwise" / "migrations" / "0145_wiskey_peer_intents_feature_registry.sql"
REPO = "11111111-2222-4333-8444-555555555555"
OWNER = "a" * 32
PEER_AT_WRITE = wp._mint_peer(value="peer-1", peer_binding_ref="bind-1", peer_binding_revision=3, repository_id=REPO, query_owner_id=OWNER)
PEER_NOW = wp._mint_peer(value="peer-1", peer_binding_ref="bind-2", peer_binding_revision=4, repository_id=REPO, query_owner_id=OWNER)
DESCRIPTOR = {"protocol": "wiskey-arx-generalized-w1-draft.3", "actor": {"kind": "user", "ref": "u1"}, "action": "users/update",
              "operation": {"id": "op-1"}, "request": {"id": "req-1"}, "issued_at": "2026-10-23T10:00:00Z", "list": [1, True, None]}
RECEIPT = {"central_state": "committed", "device_application": "unknown", "signed_capture_covered": False, "person_revision": 5}


@pytest.fixture()
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:")
    c.executescript(MIG.read_text(encoding="utf-8"))
    return c


def original() -> wp.ResolveOriginal:
    return wp.ResolveOriginal.of(PEER_AT_WRITE, descriptor_epoch="epoch-ref-7", descriptor=DESCRIPTOR)


def frame(result: Any) -> dict[str, Any]:
    return {"id": 9, "type": "result", "success": True, "result": result}


def found(receipt: Any = None) -> dict[str, Any]:
    return frame({"schema_version": 1, "state": "found", "receipt": copy.deepcopy(RECEIPT) if receipt is None else receipt})


# ---------------------------------------------------------------- the request shape

def test_the_parameters_are_exactly_the_real_resolve_shape():
    assert wp.RESOLVE_COMMAND == "hikvision_intercom/peer_receipts/resolve" and wp.RESOLVE_COMMAND_SUFFIX == "peer_receipts/resolve"
    p = wp.resolve_parameters(PEER_NOW, original())
    assert set(p) == {"peer_binding_ref", "peer_binding_revision", "original"} == wp.RESOLVE_PARAM_KEYS
    assert (p["peer_binding_ref"], p["peer_binding_revision"]) == ("bind-2", 4), "the outer pair is the CURRENT read binding"
    o = p["original"]
    assert set(o) == wp.RESOLVE_ORIGINAL_KEYS
    assert o == {"repository_id": REPO, "verified_peer_ref": "peer-1", "peer_binding_ref": "bind-1", "peer_binding_revision": 3,
                 "query_owner_id": OWNER, "descriptor_epoch": "epoch-ref-7", "original": DESCRIPTOR}, "the inner original is the FULL descriptor"
    for legacy in ("writer_epoch", "observed_epoch", "exclusive_writer_established", "request_id", "operation_binding_ref", "origin_ref", "hash", "sha256"):
        assert legacy not in o and legacy not in p


def test_the_stored_descriptor_cannot_be_changed_after_the_fact():
    d = copy.deepcopy(DESCRIPTOR)
    o = wp.ResolveOriginal.of(PEER_AT_WRITE, descriptor_epoch=7, descriptor=d)
    d["action"] = "users/delete"
    out = o.as_wire()["original"]
    assert out == DESCRIPTOR
    out["action"] = "x"
    assert o.as_wire()["original"] == DESCRIPTOR


@pytest.mark.parametrize("kw", [
    {"descriptor": {}}, {"descriptor": None}, {"descriptor": "text"}, {"descriptor": {"a": 1.5}}, {"descriptor": {"a": float("nan")}},
    {"descriptor": {1: "x"}}, {"descriptor": {"a": 2 ** 53}}, {"descriptor": {"a": {"b": {"c": {"d": {"e": {"f": {"g": {"h": {"i": {"j": {"k": {"l": {"m": {"n": {"o": {"p": {"q": {"r": 1}}}}}}}}}}}}}}}}}}},
    {"descriptor_epoch": None}, {"descriptor_epoch": True}, {"descriptor_epoch": ""}, {"descriptor_epoch": 0}, {"descriptor_epoch": 1.0},
])
def test_an_original_outside_the_rules_is_refused(kw):
    args = {"descriptor_epoch": "e1", "descriptor": DESCRIPTOR, **kw}
    with pytest.raises(wp.PeerSeamError) as e:
        wp.ResolveOriginal.of(PEER_AT_WRITE, **args)
    assert e.value.code == "invalid_original"


def test_only_a_sealed_peer_can_build_or_ask():
    with pytest.raises(wp.PeerSeamError):
        wp.ResolveOriginal.of("peer-1", descriptor_epoch="e", descriptor=DESCRIPTOR)  # type: ignore[arg-type]
    with pytest.raises(wp.PeerSeamError):
        wp.resolve_parameters({"peer_binding_ref": "bind-2"}, original())  # type: ignore[arg-type]
    with pytest.raises(wp.PeerSeamError):
        wp.resolve_parameters(PEER_NOW, original().as_wire())  # type: ignore[arg-type]


@pytest.mark.parametrize("other", [
    dict(value="peer-2", repository_id=REPO, query_owner_id=OWNER),
    dict(value="peer-1", repository_id="99999999-2222-4333-8444-555555555555", query_owner_id=OWNER),
    dict(value="peer-1", repository_id=REPO, query_owner_id="b" * 32),
])
def test_a_current_binding_of_another_peer_repository_or_owner_is_never_used(other):
    cur = wp._mint_peer(peer_binding_ref="bind-9", peer_binding_revision=9, **other)
    with pytest.raises(wp.PeerSeamError) as e:
        wp.resolve_parameters(cur, original())
    assert e.value.code == "original_reference_mismatch"


def test_a_request_over_the_peer_query_limit_is_refused():
    big = wp.ResolveOriginal.of(PEER_AT_WRITE, descriptor_epoch="e", descriptor={"blob": "x" * wp.RESOLVE_REQUEST_MAX})
    with pytest.raises(wp.PeerSeamError) as e:
        wp.resolve_parameters(PEER_NOW, big)
    assert e.value.code == "request_too_large"


# ---------------------------------------------------------------- the result: found | unknown, never never_committed

def test_found_with_a_committed_receipt_settles_committed():
    v = wp.verify_resolution(found())
    assert (v.state, v.settles, v.code) == ("committed", True, "found") and v.receipt == RECEIPT
    assert v.replay_permitted is False and v.proves_create is False and v.device_attested is False


@pytest.mark.parametrize("result,code", [
    ({"schema_version": 1, "state": "unknown", "receipt": None}, "remote:unknown"),
    ({"schema_version": 1, "state": "unknown", "receipt": RECEIPT}, "contradiction"),
    ({"schema_version": 1, "state": "found", "receipt": None}, "contradiction"),
    ({"schema_version": 1, "state": "found", "receipt": {}}, "contradiction"),
    ({"schema_version": 1, "state": "found", "receipt": {**RECEIPT, "central_state": "pending"}}, "receipt_unverified"),
    ({"schema_version": 1, "state": "found", "receipt": {**RECEIPT, "device_application": "applied"}}, "receipt_unverified"),
    ({"schema_version": 1, "state": "found", "receipt": {**RECEIPT, "signed_capture_covered": True}}, "receipt_unverified"),
    ({"schema_version": 1, "state": "found", "receipt": {**RECEIPT, "signed_capture_covered": 0}}, "receipt_unverified"),
    ({"schema_version": 1, "state": "found", "receipt": {**RECEIPT, "x": 0.5}}, "contradiction"),
    ({"schema_version": 1, "state": "never_committed", "receipt": None}, "malformed:state"),
    ({"schema_version": 1, "state": "committed", "receipt": RECEIPT}, "malformed:state"),
    ({"schema_version": 2, "state": "found", "receipt": RECEIPT}, "unsupported_version"),
    ({"schema_version": True, "state": "found", "receipt": RECEIPT}, "unsupported_version"),
    ({"schema_version": 1, "state": "found"}, "fields"),
    ({"schema_version": 1, "state": "found", "receipt": RECEIPT, "extra": 1}, "fields"),
])
def test_everything_but_a_committed_found_is_unknown(result, code):
    v = wp.verify_resolution(frame(result))
    assert (v.state, v.settles, v.code) == ("unknown", False, code)
    assert v.state != "never_committed" and v.replay_permitted is False


@pytest.mark.parametrize("bad", [
    None, {}, {"id": 1, "type": "result", "success": False, "error": {"code": "original_reference_mismatch"}},
    {"id": 1, "type": "result", "success": False, "error": {"code": "Unauthorized"}}, {"id": True, "type": "result", "success": True, "result": {}},
    {"id": 1, "type": "result", "success": 1, "result": {}},
])
def test_error_envelopes_and_malformed_frames_are_unknown(bad):
    v = wp.verify_resolution(bad)
    assert v.state == "unknown" and not v.settles
    if isinstance(bad, dict) and bad.get("success") is False:
        assert v.code == f"error:{bad['error']['code']}", "a refusal (e.g. original_reference_mismatch) is UNKNOWN, never not-committed"


def test_the_old_draft_contracts_are_gone_and_resolve_is_the_only_receipt_read():
    """PERSONWRITES-CLEANUP-295 (W-026): the never-shipped draft1 reads (signed_person_writes/status, person_writes/resolve_create)
    were removed; peer_receipts/resolve is the one receipt read and never answers never_committed."""
    for gone in ("RECEIPT_COMMAND", "RECEIPT_PROTOCOL", "verify_receipt", "ReceiptExpectation", "OneCommitLedger", "FenceContext"):
        assert not hasattr(wp, gone), gone
    for gone in ("PROPOSED_CREATE_COMMAND", "CREATE_PROTOCOL", "verify_create_resolution", "settle_create", "CreateExpectation"):
        assert not hasattr(wi, gone), gone
    assert wi.RESOLVE_COMMAND == wp.RESOLVE_COMMAND == "hikvision_intercom/peer_receipts/resolve"
    assert "never_committed" not in {wp.verify_resolution(found()).state}


# ---------------------------------------------------------------- settling the durable intent

def _admit(conn, n: int, *, create: bool) -> wi.ExactOriginal:
    kw: dict[str, Any] = dict(peer=PEER_AT_WRITE, operation_id=f"op-{n}", request_id=f"req-{n}", origin_ref=f"o:{n}", operation_binding_ref=f"opb-{n}",
                              issued_epoch=7, command="users/create" if create else "users/update")
    if not create:
        kw.update(user_id=f"person-{n}", revision_before=4)
    return wi.admit(conn, **kw)


@pytest.mark.parametrize("create", [True, False])
def test_found_settles_an_intent_once_and_a_later_unknown_never_reopens_it(conn, create):
    o = _admit(conn, 1, create=create)
    wi.mark_sent(conn, o)
    wi.mark_unknown(conn, o, "timeout")
    rec = {**RECEIPT, "person_revision": 1, "user_id": "person-new"} if create else RECEIPT
    assert wi.settle_resolution(conn, o, wp.verify_resolution(found(rec))) == "settled" and wi.state(conn, o) == "committed"
    row = conn.execute("SELECT created_user_id, revision_after, reason_code FROM wiskey_fence_intents").fetchone()
    assert row == (("person-new", 1, "resolved_found") if create else (None, 5, "resolved_found"))
    assert wi.settle_resolution(conn, o, wp.verify_resolution(found(rec))) == "duplicate"
    assert wi.settle_resolution(conn, o, wp.verify_resolution(frame({"schema_version": 1, "state": "unknown", "receipt": None}))) == "open"
    assert wi.state(conn, o) == "committed", "a terminal intent is never moved back"


@pytest.mark.parametrize("create", [True, False])
def test_unknown_keeps_the_intent_open_never_never_committed_and_never_sendable_again(conn, create):
    o = _admit(conn, 2, create=create)
    wi.mark_sent(conn, o)
    for f in (frame({"schema_version": 1, "state": "unknown", "receipt": None}), None,
              {"id": 1, "type": "result", "success": False, "error": {"code": "original_reference_mismatch"}}, found({**RECEIPT, "central_state": "x"})):
        assert wi.settle_resolution(conn, o, wp.verify_resolution(f)) == "open"
        assert wi.state(conn, o) == "unknown"
    with pytest.raises(wi.IntentError) as e:
        wi.mark_sent(conn, o)  # an UNKNOWN is not a licence to replay
    assert e.value.code == "not_sendable"
    assert conn.execute("SELECT COUNT(*) FROM wiskey_fence_intents WHERE state = 'never_committed'").fetchone()[0] == 0
    assert [x.operation_id for x in wi.open_intents(conn)] == [o.operation_id]


@pytest.mark.parametrize("create,receipt", [
    (False, {k: v for k, v in RECEIPT.items() if k != "person_revision"}), (False, {**RECEIPT, "person_revision": 4}),
    (False, {**RECEIPT, "person_revision": True}), (True, {**RECEIPT, "person_revision": 1}),
    (True, {**RECEIPT, "person_revision": 2, "user_id": "person-new"}),
])
def test_a_found_receipt_that_cannot_be_recorded_stays_unknown_and_open(conn, create, receipt):
    """Migration 0145 needs revision_after (and the created person for a create): without them the intent is not settled - and not replayed."""
    o = _admit(conn, 4, create=create)
    wi.mark_sent(conn, o)
    assert wi.settle_resolution(conn, o, wp.verify_resolution(found(receipt))) == "open"
    assert wi.state(conn, o) == "unknown"
    assert conn.execute("SELECT reason_code FROM wiskey_fence_intents").fetchone()[0] == "receipt_incomplete"


def test_settle_resolution_accepts_only_a_resolution_verdict(conn):
    o = _admit(conn, 3, create=False)
    with pytest.raises(wi.IntentError):
        wi.settle_resolution(conn, o, wp.ReceiptVerdict("never_committed", True, "pre_effect_refused"))  # type: ignore[arg-type]
    assert wi.state(conn, o) == "intent"


def test_the_live_resolve_read_is_still_not_built():
    with pytest.raises(wp.PeerSeamError) as e:
        wi.LiveResolveTransport().resolve(PEER_NOW, original())
    assert e.value.code == "not_built"
