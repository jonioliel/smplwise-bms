"""PERSONWRITES-CLEANUP-295 (W-026, owner option A: code / tests / docs only, no table or row touched).

The historical WisKey person-write reads that WisKey never shipped (`hikvision_intercom/signed_person_writes/status`,
`hikvision_intercom/person_writes/resolve_create`) were removed from `wiskey_peer` / `wiskey_intents`. These tests prove the cleanup did
not change anything Arx says to WisKey: the command catalog, the receipt read and its refusal codes are byte-identical to the
pre-cleanup head (release/2200 @ 47ca1a2c0), and migration 0145 / `wiskey_fence_intents` is untouched."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

import pytest

from smplwise.services import wiskey_channels as ch
from smplwise.services import wiskey_command_port as cp
from smplwise.services import wiskey_intents as wi
from smplwise.services import wiskey_peer as wp

BACKEND = Path(__file__).resolve().parents[1]
PKG = BACKEND / "smplwise"
REPO_ROOT = BACKEND.parents[1]
HISTORICAL = ("signed_person_writes", "person_writes/resolve_create", "wiskey-signed-person-completion-draft1",
              "wiskey-create-resolution-draft1", "signed_person_completion_read_v1", "person_create_resolution_v1")

# sha256 of the canonical command catalog, computed on release/2200 @ 47ca1a2c0 BEFORE the cleanup
CATALOG_SHA256 = "0fdcbd37b67f8506178c35a8aea233f0080a0ed5895259c7430aa16f7f1abafe"
PEOPLE_CATALOG_FIXTURE_SHA256 = "92ffc92b384fe0f667b66221076cfaf6b8259ffb28dd50c4c8cc2d7f83cf5e68"
MIGRATION_0145_SHA256 = "b0fb6fd086a47430fc170008f233d2aa753d8d2140bf8c7bebbe60ab74aefa3f"


def _catalog() -> dict:
    return {"allowlists": {k: sorted(v) for k, v in sorted(ch.ALLOWLISTS.items())}, "lease_signed": sorted(ch.LEASE_SIGNED),
            "w10": sorted(ch.W10_COMMANDS), "peer_query": sorted(cp.PEER_QUERY_COMMANDS), "codes": [ch.NOT_ALLOWED, ch.RESERVED_KEY]}


def test_the_command_catalog_is_byte_identical_to_before_the_cleanup():
    text = json.dumps(_catalog(), sort_keys=True, separators=(",", ":"))
    assert hashlib.sha256(text.encode()).hexdigest() == CATALOG_SHA256
    assert cp.PEER_QUERY_COMMANDS == frozenset({"peer_bindings/get", "peer_bindings/history", "peer_protocol/get", "peer_receipts/resolve"})
    fixture = BACKEND / "tests" / "fixtures" / "wiskey_round4" / "people_command_catalog.json"
    assert hashlib.sha256(fixture.read_bytes()).hexdigest() == PEOPLE_CATALOG_FIXTURE_SHA256


def test_no_catalog_or_product_module_names_a_historical_person_write_command():
    hits = []
    for path in PKG.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        hits += [f"{path.relative_to(PKG).as_posix()}:{h}" for h in HISTORICAL if h in text]
    for path in [*(BACKEND / "tests" / "fixtures").rglob("*.json"), *(REPO_ROOT / "contracts").rglob("*.json")]:
        text = path.read_text(encoding="utf-8", errors="replace")
        hits += [f"{path.name}:{h}" for h in HISTORICAL if h in text]
    assert hits == []
    for name in sorted(set().union(*_catalog()["allowlists"].values()) | cp.PEER_QUERY_COMMANDS):
        assert "person_writes" not in name, name


def test_the_receipt_read_constants_are_unchanged():
    assert wp.RESOLVE_COMMAND == wi.RESOLVE_COMMAND == "hikvision_intercom/peer_receipts/resolve"
    assert wp.RESOLVE_COMMAND_SUFFIX == "peer_receipts/resolve"
    assert wp.RESOLVE_PARAM_KEYS == frozenset({"peer_binding_ref", "peer_binding_revision", "original"})
    assert wp.RESOLVE_ORIGINAL_KEYS == frozenset({"repository_id", "verified_peer_ref", "peer_binding_ref", "peer_binding_revision",
                                                  "query_owner_id", "descriptor_epoch", "original"})
    assert wp.RESOLVE_RESULT_KEYS == frozenset({"schema_version", "state", "receipt"})
    assert (wp.RESOLVE_REQUEST_MAX, wp.RESOLVE_DEPTH_MAX, wp.MAX_JSON_INT) == (65536, 16, 2 ** 53 - 1)


@pytest.mark.parametrize("frame,code", [
    (None, "malformed_envelope"), ([], "malformed_envelope"), ({"id": 1, "type": "event", "success": True}, "malformed_envelope"),
    ({"id": True, "type": "result", "success": True, "result": {}}, "malformed_envelope"),
    ({"id": 1, "type": "result", "success": 1, "result": {}}, "malformed_envelope"),
    ({"id": 1, "type": "result", "success": True, "result": []}, "malformed_envelope"),
    ({"id": 1, "type": "result", "success": False, "error": {"code": "original_reference_mismatch"}}, "error:original_reference_mismatch"),
    ({"id": 1, "type": "result", "success": False, "error": {"code": ""}}, "error"),
    ({"id": 1, "type": "result", "success": False, "error": "x"}, "error"),
    ({"id": 1, "type": "result", "success": True, "result": {"schema_version": 1, "state": "found"}}, "fields"),
])
def test_the_envelope_refusal_codes_are_byte_identical(frame, code):
    """`_result_of` (kept: verify_resolution reads every envelope through it) still yields exactly these codes."""
    v = wp.verify_resolution(frame)
    assert (v.state, v.settles, v.code) == ("unknown", False, code)


def test_the_intent_refusal_codes_are_unchanged():
    mig = PKG / "migrations" / "0145_wiskey_peer_intents_feature_registry.sql"
    conn = sqlite3.connect(":memory:")
    conn.executescript(mig.read_text(encoding="utf-8"))
    peer = wp._mint_peer(value="peer-1", peer_binding_ref="bind-1", peer_binding_revision=3, repository_id="11111111-2222-4333-8444-555555555555",
                         query_owner_id="a" * 32)
    create = wi.admit(conn, peer=peer, operation_id="op-1", request_id="req-1", origin_ref="o:1", operation_binding_ref="opb-1", issued_epoch=7,
                      command="users/create")
    with pytest.raises(wi.IntentError) as e:
        wi.settle_update(conn, create, wp.ReceiptVerdict("unknown", False, "timeout"))
    assert e.value.code == "create_needs_create_resolution"
    with pytest.raises(wi.IntentError) as e:
        wi.settle_resolution(conn, create, wp.ReceiptVerdict("unknown", False, "timeout"))  # type: ignore[arg-type]
    assert e.value.code == "not_a_resolution"


def test_migration_0145_and_the_intent_table_are_untouched():
    """Option A: no table is dropped or altered and no migration is added for W-026; 0145 is byte-identical."""
    mig = PKG / "migrations" / "0145_wiskey_peer_intents_feature_registry.sql"
    assert hashlib.sha256(mig.read_bytes()).hexdigest() == MIGRATION_0145_SHA256
    assert "wiskey_fence_intents" in mig.read_text(encoding="utf-8")
    later = [p.name for p in (PKG / "migrations").glob("*.sql") if "wiskey_fence_intents" in p.read_text(encoding="utf-8") and p != mig]
    assert later == []
