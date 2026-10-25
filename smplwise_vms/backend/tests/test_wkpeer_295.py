"""WKPEER-295 - the Arx half of the WisKey peer / receipt seam (round 10 sections 2.4 / 2.6, round 11 R11-I4-02 / R11-I4-03 /
R11-I1-03 / R11-I1-04 / R11-I3-01..04). Fakes only (tests/fake_wiskey_peer.py): no WisKey, Home Assistant, station, reader or door.

(1) typed seam      `wiskey_peer`: VerifiedPeerRef / TransportAttestation are sealed types; act.principal, request_id, op_id, a
                    local signature (or any string / dict / Principal) is never a peer binding. (The historical draft1 receipt
                    verifier and OneCommitLedger were removed by PERSONWRITES-CLEANUP-295; the real read is in test_wkadapt_resolve_295.)
(2) registry client `wiskey_peer_registry`: binds verified_peer_ref to the dedicated query owner (owner pin) with peer_binding_ref /
                    revision / repository_id; revocation, rotation (never followed automatically), historical-read permission
(4) ACR5-01..04     `wiskey_acr5`: strict frozen-v1 consumers behind their own OFF switches; revision-bound revocation verdict;
                    six pending queues kept apart; mode / schedule / bindings judged together
Everything is OFF: GO_LIVE_PERMITTED False in all three modules, signed_capture_covered False."""
from __future__ import annotations

import copy
import re
import sqlite3
from pathlib import Path
from typing import Any

import pytest
from fake_wiskey_peer import (
    BINDING,
    OTHER_OWNER,
    OTHER_REPO,
    OWNER,
    PEER,
    PERSON,
    REPO,
    ROW,
    SCHEDULE,
    FakeNormalizer,
    FakeRegistry,
    access_state_frame,
    access_state_result,
    binding_row,
    failure,
    normalize_frame,
    plan,
)

from smplwise.services import access_grants, capture_lease, service_identity
from smplwise.services import wiskey_acr5 as a5
from smplwise.services import wiskey_peer as wp
from smplwise.services import wiskey_peer_registry as wr

BACKEND = Path(__file__).resolve().parents[1]
PKG = BACKEND / "smplwise"


@pytest.fixture()
def conn() -> sqlite3.Connection:
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT)")
    return c


def _set(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)", (key, value))


def _pin(**over: Any) -> wr.OwnerPin:
    base = {"query_owner_id": OWNER, "repository_id": REPO, "verified_peer_ref": PEER, "peer_binding_ref": BINDING, "peer_binding_revision": 2}
    base.update(over)
    return wr.OwnerPin(**base)


def _att(owner: str = OWNER) -> wp.TransportAttestation:
    return wp.attest_transport(authenticated_user_id=owner, connection_ref="conn-fixture-1")


def _client(reg: FakeRegistry | None = None, pin: wr.OwnerPin | None = None, att: wp.TransportAttestation | None = None) -> wr.RegistryClient:
    return wr.RegistryClient(reg or FakeRegistry(), pin or _pin(), att or _att())


def _peer(reg: FakeRegistry | None = None) -> wp.VerifiedPeerRef:
    verdict = _client(reg).current()
    assert verdict.ok, verdict.code
    return verdict.peer


# ------------------------------------------------------------------ everything is OFF

def test_the_permits_are_open_but_signed_capture_is_not_covered(conn):
    # ECCACT-295 (owner decision 2026-10-21): the permits are open; every switch still defaults OFF and signed capture stays uncovered
    assert wp.GO_LIVE_PERMITTED is True and wp.go_live_permitted() is True
    assert wr.GO_LIVE_PERMITTED is True
    assert a5.GO_LIVE_PERMITTED is True and a5.go_live_permitted() is True
    assert wp.mode(conn) == "off" and wp.enabled(conn) is False
    assert wp.SIGNED_CAPTURE_COVERED is False and wp.WISKEY_HALF_REVIEWED is False
    assert wp.signed_capture_covered() is False
    # the pre-existing locks are untouched
    assert access_grants.GO_LIVE_PERMITTED is True and capture_lease.GO_LIVE_PERMITTED is False  # Fable review 2: capture lease stays locked
    assert service_identity.EXTENDED_GO_LIVE_PERMITTED is False


def test_with_the_permit_open_a_switch_alone_turns_the_seam_and_the_consumers_on(conn):
    # ECCACT-295: the permits are open; only the installation switches decide (all default off)
    assert wp.enabled(conn) is False
    _set(conn, wp.FLAG_KEY, "on")
    assert wp.enabled(conn) is True
    for key, setting in a5.FLAGS.items():
        assert a5.consumer_on(conn, key) is False
        _set(conn, setting, "on")
        assert a5.consumer_on(conn, key) is True


def test_switches_default_off_and_cannot_be_turned_on_by_a_setting_while_the_permit_is_off(conn, monkeypatch):
    monkeypatch.setattr(wp, "GO_LIVE_PERMITTED", False)
    monkeypatch.setattr(a5, "GO_LIVE_PERMITTED", False)
    assert wp.mode(conn) == "off" and wp.enabled(conn) is False
    _set(conn, wp.FLAG_KEY, "on")
    assert wp.mode(conn) == "on" and wp.enabled(conn) is False  # the permit constant refuses
    for key, setting in a5.FLAGS.items():
        assert a5.consumer_mode(conn, key) == "off"
        _set(conn, setting, "on")
        assert a5.consumer_mode(conn, key) == "on" and a5.consumer_on(conn, key) is False
    _set(conn, wp.FLAG_KEY, "ON ")  # garbage is off
    assert wp.mode(conn) == "off"
    assert sorted(a5.FLAGS) == ["acr5_01", "acr5_02", "acr5_03", "acr5_04"]


def test_a_broken_settings_table_reads_off():
    c = sqlite3.connect(":memory:")  # no settings table at all
    assert wp.mode(c) == "off" and a5.consumer_mode(c, "acr5_01") == "off"


def test_signed_capture_needs_all_three_and_the_build_claims_none_of_the_halves(monkeypatch):
    assert wp.SIGNED_CAPTURE_COVERED is False and wp.WISKEY_HALF_REVIEWED is False and wp.signed_capture_covered() is False
    monkeypatch.setattr(wp, "SIGNED_CAPTURE_COVERED", True)
    assert wp.signed_capture_covered() is False  # the WisKey half is not reviewed
    monkeypatch.setattr(wp, "GO_LIVE_PERMITTED", False)
    monkeypatch.setattr(wp, "WISKEY_HALF_REVIEWED", True)
    assert wp.signed_capture_covered() is False  # both halves claimed, permit off
    monkeypatch.setattr(wp, "GO_LIVE_PERMITTED", True)
    assert wp.signed_capture_covered() is True  # only the AND of the three (all patched here, none in the build)


def test_registry_client_factory_returns_nothing_while_off(conn, monkeypatch):
    _set(conn, wr.PIN_KEY, wr.encode_pin(_pin()))
    assert wr.client_for(conn, FakeRegistry(), _att()) is None  # switch off
    _set(conn, wp.FLAG_KEY, "on")
    monkeypatch.setattr(wp, "GO_LIVE_PERMITTED", False)
    assert wr.client_for(conn, FakeRegistry(), _att()) is None  # permit off
    monkeypatch.setattr(wp, "GO_LIVE_PERMITTED", True)
    assert isinstance(wr.client_for(conn, FakeRegistry(), _att()), wr.RegistryClient)  # ECCACT-295: switch on + permit open


def test_the_live_registry_transport_refuses(conn, monkeypatch):
    with pytest.raises(wr.RegistryRefused) as exc:
        wr.LiveRegistryTransport().peer_binding_get(BINDING, 2)
    assert exc.value.code == "not_built"  # ECCACT-295: the permit is open; the wire read (peer_bindings/get) exists on neither side yet
    monkeypatch.setattr(wr, "GO_LIVE_PERMITTED", False)
    with pytest.raises(wr.RegistryRefused) as exc:
        wr.LiveRegistryTransport().peer_binding_get(BINDING, 2)
    assert exc.value.code == "not_permitted"


def test_acr5_04_plans_are_never_consumed(conn):
    parsed = a5.parse_feature_plan(plan())
    assert isinstance(parsed, a5.FeaturePlan) and parsed.executable is False
    with pytest.raises(a5.ConsumerOff) as exc:
        a5.consume_plan(conn, parsed)
    assert exc.value.code == "not_permitted"


# ------------------------------------------------------------------ (1) the typed seam

@pytest.mark.parametrize("source_value", [
    "a" * 32,  # act.principal.user_id
    "req-01HZZZZZZZZZZZZZZZZZZZZZZZ",  # request_id
    "op_01HZZZZZZZZZZZZZZZZZZZZZZZ",  # local op_id
    "3f" * 32,  # a local signature / body sha256
    {"peer_ref": PEER, "owner_id": OWNER},  # a caller-supplied context dict
    PEER,  # even the right string, when it does not come out of the registry
])
def test_nothing_but_a_sealed_verified_peer_ref_is_a_peer_binding(source_value):
    with pytest.raises(wp.PeerSeamError) as exc:
        wp.as_peer_binding(source_value)
    assert exc.value.code == "not_a_peer_binding"


def test_a_principal_object_is_not_a_peer_binding():
    from smplwise.rbac import Principal

    fields = {f: None for f in getattr(Principal, "__dataclass_fields__", {})}
    try:
        principal = Principal(**{**fields, "user_id": OWNER})  # type: ignore[arg-type]
    except TypeError:
        principal = object()
    with pytest.raises(wp.PeerSeamError):
        wp.as_peer_binding(principal)


@pytest.mark.parametrize("source", sorted(wp.FORBIDDEN_PEER_SOURCES))
def test_forbidden_sources_are_refused_by_name(source):
    with pytest.raises(wp.PeerSeamError) as exc:
        wp.refuse_as_peer(source)
    assert exc.value.code == "not_a_peer_binding"
    assert {"act.principal", "request_id", "op_id", "local_signature"} <= wp.FORBIDDEN_PEER_SOURCES


def test_sealed_types_cannot_be_built_directly():
    with pytest.raises(wp.PeerSeamError) as exc:
        wp.VerifiedPeerRef(value=PEER, peer_binding_ref=BINDING, peer_binding_revision=2, repository_id=REPO, query_owner_id=OWNER)
    assert exc.value.code == "sealed"
    with pytest.raises(wp.PeerSeamError):
        wp.TransportAttestation(query_owner_id=OWNER, connection_ref="x")


def test_sealed_values_cannot_be_forged_by_replace_pickle_or_new():
    import dataclasses
    import pickle

    peer = _peer()
    with pytest.raises(TypeError):
        dataclasses.replace(peer, value="vpr-other")  # type: ignore[type-var]
    with pytest.raises(TypeError):
        pickle.dumps(peer)
    with pytest.raises(AttributeError):
        peer.value = "vpr-other"  # type: ignore[misc]
    with pytest.raises(wp.PeerSeamError):
        wp.as_peer_binding(object.__new__(wp.VerifiedPeerRef))


def test_a_registry_peer_is_accepted_by_the_seam():
    peer = _peer()
    assert wp.as_peer_binding(peer) is peer
    assert (peer.value, peer.peer_binding_ref, peer.peer_binding_revision, peer.repository_id, peer.query_owner_id) == (PEER, BINDING, 2, REPO, OWNER)
    assert copy.copy(peer) == peer and wp.as_peer_binding(copy.deepcopy(peer)) == peer  # a copy of a sealed value stays sealed


@pytest.mark.parametrize("bad", ["", "ABCDEF" * 6, "g" * 32, OWNER + "0", None, 7])
def test_transport_attestation_needs_an_ha_user_id(bad):
    with pytest.raises(wp.PeerSeamError) as exc:
        wp.attest_transport(authenticated_user_id=bad, connection_ref="c1")  # type: ignore[arg-type]
    assert exc.value.code == "invalid_attestation"


def test_only_the_seam_modules_mint_sealed_values():
    """No product module outside wiskey_peer*.py calls attest_transport or passes the seal: the seam has no other door."""
    offenders = []
    for path in PKG.rglob("*.py"):
        if path.name in ("wiskey_peer.py", "wiskey_peer_registry.py"):
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(r"attest_transport\(|_SEAL\b|_mint_peer\(", text):
            offenders.append(path.relative_to(PKG).as_posix())
    assert offenders == []


def test_no_product_path_presents_a_local_identifier_as_a_peer():
    """The existing signed / journal paths never import the seam (nothing is wired yet) and never name a verified_peer_ref."""
    for rel in ("routers/access_control.py", "services/intercom_sync.py", "services/intercom_write_journal.py", "services/capture_lease.py",
                "services/access_grants.py", "services/access_grant_engine.py"):
        text = (PKG / rel).read_text(encoding="utf-8")
        assert "verified_peer_ref" not in text and "wiskey_peer" not in text, rel


# ------------------------------------------------------------------ (2) the registry client

def test_current_binding_resolves_to_the_pinned_dedicated_owner():
    reg = FakeRegistry()
    v = _client(reg).current()
    assert v.ok and v.code == "ok" and v.peer.query_owner_id == OWNER
    assert reg.calls == [(BINDING, 2)]


def test_a_connection_not_authenticated_as_the_dedicated_principal_is_refused_before_any_lookup():
    reg = FakeRegistry()
    v = _client(reg, att=_att(OTHER_OWNER)).current()
    assert (v.ok, v.code) == (False, "owner_mismatch") and reg.calls == []


@pytest.mark.parametrize("over,code", [
    ({"query_owner_id": OTHER_OWNER}, "binding_mismatch"),  # bound to another principal: no automatic rebind
    ({"repository_id": OTHER_REPO}, "binding_mismatch"),
    ({"verified_peer_ref": "vpr-other"}, "binding_mismatch"),
    ({"allowed_read_scope": "everything"}, "malformed"),
    ({"state": "revoked", "active": False}, "revoked"),
    ({"state": "active", "active": False}, "malformed"),  # contradictory
    ({"state": "rotated", "active": False, "successor": {"peer_binding_ref": BINDING, "peer_binding_revision": 3}}, "rotation_pending"),
    ({"schema_version": 2}, "malformed"),
    ({"peer_binding_revision": True}, "malformed"),
    ({"historical_read": "yes"}, "malformed"),
    ({"extra": 1}, "malformed"),
])
def test_current_binding_refusals(over, code):
    reg = FakeRegistry(binding_row(**over)) if "peer_binding_revision" not in over else FakeRegistry()
    if "peer_binding_revision" in over:
        reg.frame_override = {"id": 7, "type": "result", "success": True, "result": binding_row(**over)}
    v = _client(reg).current()
    assert (v.ok, v.code) == (False, code)
    assert v.peer is None


def test_transport_failures_are_unknown():
    reg = FakeRegistry()
    reg.fail = "unauthorized"
    assert _client(reg).current().code == "unknown"
    reg.fail = None
    reg.raise_exc = TimeoutError()
    assert _client(reg).current().code == "unknown"
    reg.raise_exc = None
    reg.frame_override = {"id": 7, "type": "result", "success": True}
    assert _client(reg).current().code == "unknown"


def test_a_missing_or_malformed_pin_means_no_client(conn):
    _set(conn, wp.FLAG_KEY, "on")
    for text in ("", "{}", "not json", wr.encode_pin(_pin())[:-2], '{"query_owner_id": 1}'):
        _set(conn, wr.PIN_KEY, text)
        assert wr.read_pin(conn) is None
    _set(conn, wr.PIN_KEY, wr.encode_pin(_pin()))
    assert wr.read_pin(conn) == _pin()


def test_pin_values_are_validated():
    for bad in ({"query_owner_id": "A" * 32}, {"repository_id": "not-a-uuid"}, {"peer_binding_revision": 0},
                {"peer_binding_revision": True}, {"verified_peer_ref": ""}, {"peer_binding_ref": "x\u0001"}):
        with pytest.raises(ValueError):
            _pin(**bad)


def test_rotation_is_never_followed_automatically_and_the_old_receipt_needs_historical_read():
    reg = FakeRegistry(binding_row(2, state="rotated", active=False, successor={"peer_binding_ref": BINDING, "peer_binding_revision": 3}),
                       binding_row(3))
    client = _client(reg)
    assert client.current().code == "rotation_pending"  # the owner re-pins to revision 3; Arx does not follow
    hist = client.for_receipt(BINDING, 2)
    assert (hist.ok, hist.code) == (False, "historical_read_denied")
    reg.put(binding_row(2, state="rotated", active=False, historical_read=True, successor={"peer_binding_ref": BINDING, "peer_binding_revision": 3}))
    hist = client.for_receipt(BINDING, 2)
    assert hist.ok and hist.historical is True and hist.peer.peer_binding_revision == 2


def test_revoked_binding_blocks_new_queries_and_historical_reads_need_permission():
    reg = FakeRegistry(binding_row(state="revoked", active=False))
    client = _client(reg)
    assert client.current().code == "revoked"
    assert client.for_receipt(BINDING, 2).code == "historical_read_denied"
    reg.put(binding_row(state="revoked", active=False, historical_read=True))
    assert client.for_receipt(BINDING, 2).ok is True


def test_historical_reads_never_rebind_to_another_principal_or_repository():
    reg = FakeRegistry(binding_row(1, state="rotated", active=False, historical_read=True, query_owner_id=OTHER_OWNER,
                                   successor={"peer_binding_ref": BINDING, "peer_binding_revision": 2}),
                       binding_row(2))
    assert _client(reg).for_receipt(BINDING, 1).code == "binding_mismatch"
    reg.put(binding_row(1, state="rotated", active=False, historical_read=True, repository_id=OTHER_REPO,
                        successor={"peer_binding_ref": BINDING, "peer_binding_revision": 2}))
    assert _client(reg).for_receipt(BINDING, 1).code == "binding_mismatch"


def test_historical_reads_cannot_reach_a_revision_newer_than_the_pin_or_another_binding():
    reg = FakeRegistry(binding_row(2), binding_row(3), binding_row(2, peer_binding_ref="peer-binding-other"))
    client = _client(reg)
    assert client.for_receipt(BINDING, 3).code == "not_pinned"
    assert client.for_receipt("peer-binding-other", 2).code == "not_pinned"
    assert client.for_receipt(BINDING, 2).ok is True and client.for_receipt(BINDING, 2).historical is False


def test_after_rotation_the_current_peer_is_the_new_revision_never_the_rotated_one():
    reg = FakeRegistry(binding_row(2, state="rotated", active=False, historical_read=True,
                                   successor={"peer_binding_ref": BINDING, "peer_binding_revision": 3}), binding_row(3))
    current = _client(reg, pin=_pin(peer_binding_revision=3)).current()
    assert current.ok and current.peer.peer_binding_revision == 3


# ------------------------------------------------------------------ (4) ACR5-01 users/access_state

def test_access_state_request_is_strict():
    assert a5.access_state_request(PERSON, 5) == {"type": "hikvision_intercom/users/access_state", "user_id": PERSON, "revision": 5}
    for uid, rev in ((PERSON, 0), (PERSON, True), (PERSON, "5"), ("", 5), ("x\u0000", 5), ("x" * 129, 5)):
        with pytest.raises(ValueError):
            a5.access_state_request(uid, rev)


def test_a_complete_present_answer_parses_with_six_separate_queues():
    s = a5.parse_access_state(access_state_frame(pending={"bindings": ["st-a"], "tombstones": [], "cards": ["st-b"], "pins": [],
                                                          "operations": [], "unverified": ["st-c"]}), user_id=PERSON, revision=5)
    assert isinstance(s, a5.AccessState)
    assert s.pending.bindings == ("st-a",) and s.pending.cards == ("st-b",) and s.pending.unverified == ("st-c",)
    assert set(s.pending.removal_queues()) == {"bindings", "tombstones", "cards", "pins", "operations"}  # unverified kept apart
    with pytest.raises(TypeError):
        bool(s.pending)  # never collapsed into a boolean


@pytest.mark.parametrize("over", [
    {"schema_version": 2}, {"schema_version": True}, {"observation": "live"}, {"scope": "some_stations"},
    {"user_id": PERSON + " "}, {"user_id": "u-" + PERSON}, {"person_revision": True}, {"person_revision": 0}, {"presence": "gone"},
    {"revocation_pending": "false"}, {"stations_synced": 1}, {"assignments": {}}, {"timing_policy": []},
    {"pending": {"bindings": [], "tombstones": [], "cards": [], "pins": [], "operations": []}},
    {"pending": {"bindings": ["st-a", "st-a"], "tombstones": [], "cards": [], "pins": [], "operations": [], "unverified": []}},
    {"pending": {"bindings": [""], "tombstones": [], "cards": [], "pins": [], "operations": [], "unverified": []}},
    {"assignments": [{**ROW, "enabled": "yes"}]}, {"assignments": [{**ROW, "allowed_locks": [3]}]},
    {"assignments": [{**ROW, "allowed_locks": [1, 1]}]}, {"assignments": [{**ROW, "desired_revision": 0}]},
    {"assignments": [{**ROW, "sync_state": "done"}]}, {"assignments": [{k: v for k, v in ROW.items() if k != "applied"}]},
    {"timing_policy": {"mode": "ha", "schedule": SCHEDULE}},  # bindings missing: the triple is required together
    {"timing_policy": {"mode": "ha", "schedule": SCHEDULE, "bindings": {"x": 1}}},  # ha requires bindings {}
    {"presence": "absent"},  # absent with a person_revision
])
def test_malformed_access_state_is_unknown(over):
    assert isinstance(a5.parse_access_state(access_state_frame(**over), user_id=PERSON, revision=5), a5.Unknown), over


def test_a_missing_required_key_or_a_wrong_revision_is_unknown():
    for key in list(access_state_result()):
        frame = access_state_frame()
        del frame["result"][key]
        assert isinstance(a5.parse_access_state(frame, user_id=PERSON, revision=5), a5.Unknown), key
    u = a5.parse_access_state(access_state_frame(), user_id=PERSON, revision=6)
    assert isinstance(u, a5.Unknown) and u.code == "revision_conflict"
    assert a5.parse_access_state(failure("revision_conflict"), user_id=PERSON, revision=5).code == "revision_conflict"
    assert a5.parse_access_state(failure("readback_unavailable"), user_id=PERSON, revision=5).code == "readback_unavailable"


def test_additive_fields_are_ignored_and_never_strengthen():
    s = a5.parse_access_state(access_state_frame(device_confirmed=True), user_id=PERSON, revision=5)
    assert isinstance(s, a5.AccessState) and not hasattr(s, "device_confirmed")


def test_revocation_false_needs_present_same_revision_and_the_central_predicate():
    revoked = access_state_frame(assignments=[], timing_policy=None, stations_synced=None)
    s = a5.parse_access_state(revoked, user_id=PERSON, revision=5)
    # WKV2B-295: a v1 answer never proves a revoke - the verdict is UNKNOWN, the evidence is "revoked, not verified by the other side"
    assert a5.revocation_verdict(s, requested_revision=5, central_revoked_at=5) is None
    assert a5.revocation_evidence(s, requested_revision=5, central_revoked_at=5) == "revoked_unverified"
    assert a5.revocation_evidence(s, requested_revision=5, central_revoked_at=None) is None  # no central proof
    assert a5.revocation_evidence(s, requested_revision=5, central_revoked_at=4) is None  # proof at another revision
    assert a5.revocation_evidence(s, requested_revision=6, central_revoked_at=6) is None  # the answer is for another revision


def test_revocation_true_and_unknown_cases():
    pend = {"bindings": [], "tombstones": ["st-a"], "cards": [], "pins": [], "operations": [], "unverified": []}
    s = a5.parse_access_state(access_state_frame(revocation_pending=True, pending=pend), user_id=PERSON, revision=5)
    assert a5.revocation_verdict(s, requested_revision=5, central_revoked_at=5) is True
    s = a5.parse_access_state(access_state_frame(revocation_pending=None), user_id=PERSON, revision=5)
    assert a5.revocation_verdict(s, requested_revision=5, central_revoked_at=5) is None
    # WisKey says false but a queue is still tracked: contradiction -> unknown
    s = a5.parse_access_state(access_state_frame(pending=pend), user_id=PERSON, revision=5)
    assert a5.revocation_verdict(s, requested_revision=5, central_revoked_at=5) is None
    # unverified alone also blocks a false
    unv = {"bindings": [], "tombstones": [], "cards": [], "pins": [], "operations": [], "unverified": ["st-z"]}
    s = a5.parse_access_state(access_state_frame(pending=unv), user_id=PERSON, revision=5)
    assert a5.revocation_verdict(s, requested_revision=5, central_revoked_at=5) is None
    assert a5.revocation_verdict(a5.Unknown("timeout"), requested_revision=5, central_revoked_at=5) is None


def test_absence_is_never_a_false_and_never_cleanup_proof():
    pend = {"bindings": [], "tombstones": ["st-a"], "cards": [], "pins": [], "operations": [], "unverified": []}
    for presence, pending, expected in (("delete_pending", None, True), ("absent", pend, True), ("absent", None, None)):
        frame = access_state_frame(presence=presence, person_revision=None, revocation_pending=None if expected is None else True,
                                   stations_synced=None, assignments=[], timing_policy=None, **({"pending": pending} if pending else {}))
        s = a5.parse_access_state(frame, user_id=PERSON, revision=5)
        assert isinstance(s, a5.AccessState), presence
        assert a5.revocation_verdict(s, requested_revision=5, central_revoked_at=5) is expected
        assert a5.presence_diagnostic(s) == presence and a5.is_cleanup_proof(s) is False
    frame = access_state_frame(presence="absent", person_revision=None, revocation_pending=False, stations_synced=None, assignments=[],
                               timing_policy=None)
    assert isinstance(a5.parse_access_state(frame, user_id=PERSON, revision=5), a5.Unknown)  # absent + false is malformed
    assert a5.presence_diagnostic(a5.Unknown("x")) is None


def test_stations_synced_is_bookkeeping_from_the_revision_bound_answer():
    s = a5.parse_access_state(access_state_frame(), user_id=PERSON, revision=5)
    assert a5.stations_synced_verdict(s) is True
    behind = {**ROW, "desired_revision": 4, "applied_revision": 4}  # rows synced to an older person revision
    s = a5.parse_access_state(access_state_frame(assignments=[behind]), user_id=PERSON, revision=5)
    assert a5.stations_synced_verdict(s) is None  # WisKey says True but the rows contradict it
    s = a5.parse_access_state(access_state_frame(stations_synced=False, assignments=[{**ROW, "applied_revision": 4, "sync_state": "pending"}]),
                              user_id=PERSON, revision=5)
    assert a5.stations_synced_verdict(s) is False
    s = a5.parse_access_state(access_state_frame(stations_synced=None), user_id=PERSON, revision=5)
    assert a5.stations_synced_verdict(s) is None
    assert a5.stations_synced_verdict(a5.Unknown("x")) is None


def test_pending_station_ids_are_filtered_by_the_actor_scope():
    pend = {"bindings": ["st-a", "st-b"], "tombstones": [], "cards": ["st-b"], "pins": [], "operations": [], "unverified": ["st-c"]}
    s = a5.parse_access_state(access_state_frame(pending=pend), user_id=PERSON, revision=5)
    view = a5.visible_pending(s.pending, frozenset({"st-a"}))
    assert view.queues["bindings"] == ("st-a",) and view.queues["cards"] == () and view.queues["unverified"] == ()
    assert view.complete is False  # something was withheld; no count of what
    assert a5.visible_pending(s.pending, None) is None  # unknown scope: nothing is shown
    full = a5.visible_pending(s.pending, a5.ALL_STATIONS)
    assert full.complete is True and full.queues["unverified"] == ("st-c",)


def test_revision_bound_port_failures_are_unknown():
    class Port:
        def __init__(self, frame: Any = None, exc: Exception | None = None) -> None:
            self.frame, self.exc, self.calls = frame, exc, []

        def access_state(self, user_id: str, revision: int) -> Any:
            self.calls.append((user_id, revision))
            if self.exc:
                raise self.exc
            return self.frame

    revoked = access_state_frame(assignments=[], timing_policy=None, stations_synced=None)
    port = Port(revoked)
    assert a5.revocation_pending_at(port, PERSON, 5, central_revoked_at=5) is None  # WKV2B-295: v1 never proves a revoke
    assert a5.revocation_evidence_at(port, PERSON, 5, central_revoked_at=5) == "revoked_unverified"
    assert port.calls == [(PERSON, 5), (PERSON, 5)]  # the revision travels with the question
    assert a5.revocation_pending_at(Port(exc=TimeoutError()), PERSON, 5, central_revoked_at=5) is None
    assert a5.revocation_pending_at(Port(failure("feature_disabled")), PERSON, 5, central_revoked_at=5) is None


def test_capabilities_must_be_advertised_with_the_command():
    assert a5.capability_ok({"person_access_state_v1"}, "acr5_01") and a5.capability_ok({"person_access_state_v1"}, "acr5_03")
    assert not a5.capability_ok(set(), "acr5_01") and not a5.capability_ok({"person_access_state_v2"}, "acr5_01")
    assert a5.capability_ok({"user_schedule_normalization_v1"}, "acr5_02")
    assert not a5.capability_ok({"user_schedule_normalization_v1"}, "acr5_04")  # no capability exists for draft plans


# ------------------------------------------------------------------ (4) ACR5-02 normalize_user + policy triple

def test_normalized_schedule_parses_strictly():
    assert a5.parse_normalized(normalize_frame()) == SCHEDULE
    for over in ({"schema_version": 2}, {"normalization": "wiskey-user-schedule-v2"}, {"schedule": {**SCHEDULE, "extra": 1}},
                 {"schedule": {k: v for k, v in SCHEDULE.items() if k != "dates"}}):
        assert isinstance(a5.parse_normalized(normalize_frame(**over)), a5.Unknown), over
    assert isinstance(a5.parse_normalized(failure("invalid_user_timing")), a5.Unknown)
    with pytest.raises(ValueError):
        a5.normalize_request({"mode": "weekly"})


def test_identical_schedule_alone_is_not_policy_equivalence():
    norm = FakeNormalizer()
    ha = {"mode": "ha", "schedule": SCHEDULE, "bindings": {}}
    native = {"mode": "native", "schedule": SCHEDULE, "bindings": {}}
    native_bound = {"mode": "native", "schedule": SCHEDULE, "bindings": {"st-a": "plan-1"}}
    assert a5.policy_equivalent(ha, native, norm) is False
    assert a5.policy_equivalent(native, native_bound, norm) is False  # same mode, same schedule, other bindings
    assert norm.calls == 0  # mode / bindings decide before any schedule comparison
    # mode ha with bindings is not a valid v1 policy at all: UNKNOWN, never equivalent
    assert a5.policy_equivalent(ha, {"mode": "ha", "schedule": SCHEDULE, "bindings": {"st-a": "plan-1"}}, norm) is None
    assert a5.policy_equivalent(ha, copy.deepcopy(ha), norm) is True


def test_reordered_schedules_are_equivalent_only_through_the_normalizer():
    norm = FakeNormalizer()
    reordered = {**SCHEDULE, "days": ["Tuesday", "Monday"]}
    ha = {"mode": "ha", "schedule": SCHEDULE, "bindings": {}}
    assert a5.policy_equivalent(ha, {"mode": "ha", "schedule": reordered, "bindings": {}}, norm) is True
    assert norm.calls == 2
    norm.fail = "invalid_user_timing"
    assert a5.policy_equivalent(ha, {"mode": "ha", "schedule": reordered, "bindings": {}}, norm) is None
    other = {**SCHEDULE, "timezone": "Europe/London"}
    norm.fail = None
    assert a5.policy_equivalent(ha, {"mode": "ha", "schedule": other, "bindings": {}}, norm) is False


def test_no_policy_and_partial_policies():
    norm = FakeNormalizer()
    assert a5.policy_equivalent(None, None, norm) is True
    assert a5.policy_equivalent(None, {"mode": "ha", "schedule": SCHEDULE, "bindings": {}}, norm) is False
    assert a5.policy_equivalent({"mode": "ha", "schedule": SCHEDULE}, {"mode": "ha", "schedule": SCHEDULE, "bindings": {}}, norm) is None


def test_grant_proof_requires_ha_mode_and_empty_bindings():
    norm = FakeNormalizer()
    assert a5.grant_policy_proven(SCHEDULE, {"mode": "ha", "schedule": SCHEDULE, "bindings": {}}, norm) is True
    assert a5.grant_policy_proven(SCHEDULE, {"mode": "native", "schedule": SCHEDULE, "bindings": {}}, norm) is False
    assert a5.grant_policy_proven(SCHEDULE, {"mode": "native", "schedule": SCHEDULE, "bindings": {"x": 1}}, norm) is False
    assert a5.grant_policy_proven(SCHEDULE, {"mode": "ha", "schedule": SCHEDULE, "bindings": {"x": 1}}, norm) is None  # malformed v1
    assert a5.grant_policy_proven(None, None, norm) is True


# ------------------------------------------------------------------ (4) ACR5-04 draft plans

@pytest.mark.parametrize("over", [
    {"execution_available": True}, {"authority_verified": True}, {"status": "ready"}, {"schema_version": 2},
    {"feature": "Door Windows"}, {"draft": None}, {"execution_available": 0},
])
def test_a_plan_that_claims_any_capability_is_unknown(over):
    assert isinstance(a5.parse_feature_plan(plan(**over)), a5.Unknown), over


def test_a_draft_plan_is_never_executable():
    for feature in ("people_csv", "door_windows", "emergency_lock", "automation_door", "live_media", "live_validation"):
        p = a5.parse_feature_plan(plan(feature))
        assert isinstance(p, a5.FeaturePlan) and p.executable is False and p.feature == feature
