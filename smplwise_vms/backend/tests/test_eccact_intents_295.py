"""ECCACT-295 stage 2 (FAKES ONLY): the durable WisKey fence intents (migration 0145) and their state machine.
Nothing contacts WisKey or Home Assistant. The never-shipped create-resolution proposal (`person_writes/resolve_create`) and its tests
were removed by PERSONWRITES-CLEANUP-295; a create intent settles through the real peer_receipts/resolve verdict here."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import wiskey_intents as wi
from smplwise.services import wiskey_peer as wp

MIG = Path(__file__).resolve().parents[1] / "smplwise" / "migrations" / "0145_wiskey_peer_intents_feature_registry.sql"
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


def found_create(user_id: str = "person-new") -> wp.ResolutionVerdict:
    """A verified peer_receipts/resolve `found` for a create: the created person and its first revision."""
    receipt = {"central_state": "committed", "device_application": "unknown", "signed_capture_covered": False, "person_revision": 1,
               "user_id": user_id}
    return wp.verify_resolution({"id": 9, "type": "result", "success": True, "result": {"schema_version": 1, "state": "found", "receipt": receipt}})


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
    assert wi.settle_resolution(conn, c, found_create()) == "settled"
    assert {o.operation_id for o in wi.open_intents(conn)} == {"op-1", "op-2"} and a.operation_id == "op-1"


# ---------------------------------------------------------------- one created person per create (migration 0145 unique index)

def test_two_creates_can_never_claim_the_same_person(conn):
    a, b = admit_create(conn, 1), admit_create(conn, 2)
    assert wi.settle_resolution(conn, a, found_create()) == "settled"
    assert wi.settle_resolution(conn, b, found_create()) == "conflict"
    assert wi.state(conn, b) == "intent"
    assert conn.execute("SELECT created_user_id, revision_after FROM wiskey_fence_intents WHERE operation_id='op-1'").fetchone() == ("person-new", 1)


def test_the_live_resolve_transport_is_not_built(conn):
    with pytest.raises(wp.PeerSeamError) as e:
        wi.LiveResolveTransport().resolve(PEER, wp.ResolveOriginal.of(PEER, descriptor_epoch="e1", descriptor={"request": {"id": "r"}}))
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
