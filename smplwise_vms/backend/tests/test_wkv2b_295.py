"""WKV2B-295 (FAKES ONLY; owner decision 2026-10-21, the revoke-proof middle path): a WisKey v1 access_state answer never proves a revoke.

A v1 answer in the clean-looking shape is the distinct result "revoked, not verified by the other side" (`revoked_unverified`), never the
verified clean one; only a v2 answer is `verified_clean`. The grant ends as before (`revoked` / `ended`) but records `revoke_proof`.
Nothing here contacts WisKey, a station or a door; GO_LIVE stays False and no switch is turned on."""
from __future__ import annotations

import copy
from datetime import timedelta

import pytest
from test_access_grants import T0, env  # noqa: F401 - `env`: the access-grants world over FakeAccessEngine
from test_wkv2_295 import A, AB, PERSON, REV, frame, fx, v1

from smplwise.services import access_external as axe
from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services import wiskey_access_state as was
from smplwise.services import wiskey_acr5 as a5

UNV, VER, PEN = was.EVIDENCE_UNVERIFIED, was.EVIDENCE_VERIFIED, was.EVIDENCE_PENDING


# ================================================================ the pure evidence


def test_the_three_evidences_are_distinct_constants():
    assert len({UNV, VER, PEN}) == 3 and set(was.EVIDENCES) == {UNV, VER, PEN}


@pytest.mark.parametrize("name,known,expected", [
    ("present_revoked_disabled_row_applied", A, VER), ("present_revoked_two_disabled_rows_applied", AB, VER),
    ("present_revoked_disabled_row_applied", None, None), ("present_revoked_disabled_row_applied", AB, None),
    ("present_empty_bookkeeping", A, None), ("present_revoked_pin_pending", A, PEN), ("delete_pending", A, PEN), ("absent", A, None),
])
def test_engine_v2_evidence(name, known, expected):
    assert age.revocation_evidence_from(lambda uid, rev: fx(name), PERSON, REV, last_known_stations=known) == expected


def test_engine_v1_clean_looking_shape_is_unverified_never_verified():
    for known in (None, A, AB, frozenset()):
        assert age.revocation_evidence_from(lambda uid, rev: v1(), PERSON, REV, last_known_stations=known) == UNV
        assert age.revocation_pending_from(lambda uid, rev: v1(), PERSON, REV, last_known_stations=known) is None
    # owed work is still pending; anything else (other revision, unverified work, absent) is unknown
    owed = v1(revocation_pending=True, pending={**v1()["pending"], "cards": ["station-a"]})
    assert age.revocation_evidence_from(lambda uid, rev: owed, PERSON, REV) == PEN
    assert age.revocation_pending_from(lambda uid, rev: owed, PERSON, REV) is True
    assert age.revocation_evidence_from(lambda uid, rev: v1(), PERSON, 5) is None
    unv_work = v1(revocation_pending=None, pending={**v1()["pending"], "unverified": ["station-a"]})
    assert age.revocation_evidence_from(lambda uid, rev: unv_work, PERSON, REV) is None
    gone = v1(presence="absent", person_revision=None, revocation_pending=None)
    assert age.revocation_evidence_from(lambda uid, rev: gone, PERSON, REV) is None


@pytest.mark.parametrize("bad", [None, "x", {"schema_version": 9}, {"revocation_pending": False}])
def test_garbage_and_failures_have_no_evidence(bad):
    assert age.revocation_evidence_from(lambda uid, rev: bad, PERSON, REV) is None

    def boom(*_a):
        raise RuntimeError("x")

    assert age.revocation_evidence_from(boom, PERSON, REV) is None
    assert age.revocation_evidence_from(None, PERSON, REV) is None
    assert age.revocation_evidence_from(lambda uid, rev: v1(), PERSON, True) is None


def test_the_live_engine_evidence_follows_the_same_gates(monkeypatch):
    eng = age.WiskeyServiceEngine(settings=None, access_state_reader=lambda uid, rev: v1(), last_known_stations=lambda pid: A)
    with pytest.raises(age.EngineError) as err:
        eng.revocation_evidence(PERSON, REV)
    assert err.value.kind == "not_permitted"
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)  # RAM only, this test
    assert eng.revocation_evidence(PERSON, REV) == UNV and eng.revocation_pending(PERSON, REV) is None
    eng.access_state_reader = lambda uid, rev: fx("present_revoked_disabled_row_applied")
    assert eng.revocation_evidence(PERSON, REV) == VER and eng.revocation_pending(PERSON, REV) is False
    eng.access_state_reader = None
    assert eng.revocation_evidence(PERSON, REV) is None


# ================================================================ the ACR5 caller


class _Port:
    def __init__(self, answer):
        self.answer = answer

    def access_state(self, user_id, revision):
        return self.answer


def test_acr5_v1_is_pending_or_unknown_as_a_boolean_and_unverified_as_evidence():
    s = a5.parse_access_state(frame(v1()), user_id=PERSON, revision=REV)
    assert a5.revocation_verdict(s, requested_revision=REV, central_revoked_at=REV) is None
    assert a5.revocation_evidence(s, requested_revision=REV, central_revoked_at=REV) == UNV
    assert a5.revocation_evidence(s, requested_revision=REV, central_revoked_at=None) is None  # Arx's own predicate missing
    assert a5.revocation_evidence(s, requested_revision=REV, central_revoked_at=3) is None
    assert a5.revocation_evidence(a5.Unknown("x"), requested_revision=REV, central_revoked_at=REV) is None
    owed = a5.parse_access_state(frame(v1(revocation_pending=True)), user_id=PERSON, revision=REV)
    assert a5.revocation_verdict(owed, requested_revision=REV, central_revoked_at=REV) is True
    assert a5.revocation_evidence(owed, requested_revision=REV, central_revoked_at=REV) == PEN


def test_acr5_v2_evidence_is_verified_only_with_both_central_predicates():
    s = a5.parse_access_state(frame(fx("present_revoked_disabled_row_applied")), user_id=PERSON, revision=REV, expect=2)
    assert a5.revocation_evidence(s, requested_revision=REV, central_revoked_at=REV, last_known_stations=A) == VER
    assert a5.revocation_evidence(s, requested_revision=REV, central_revoked_at=None, last_known_stations=A) is None
    assert a5.revocation_evidence(s, requested_revision=REV, central_revoked_at=REV) is None


def test_acr5_port_evidence_and_the_v1_refusal_for_a_v2_question():
    assert a5.revocation_evidence_at(_Port(frame(v1())), PERSON, REV, central_revoked_at=REV) == UNV
    assert a5.revocation_pending_at(_Port(frame(v1())), PERSON, REV, central_revoked_at=REV) is None
    assert a5.revocation_evidence_at(_Port(frame(v1())), PERSON, REV, central_revoked_at=REV, expect=2, last_known_stations=A) is None
    ok = _Port(frame(fx("present_revoked_disabled_row_applied")))
    assert a5.revocation_evidence_at(ok, PERSON, REV, central_revoked_at=REV, expect=2, last_known_stations=A) == VER

    def boom(*_a):
        raise RuntimeError("x")

    class Broken:
        access_state = staticmethod(boom)

    assert a5.revocation_evidence_at(Broken(), PERSON, REV, central_revoked_at=REV) is None


# ================================================================ the grant: the result is recorded and shown


def _v2_reader(env, station="st-a"):
    """The fake's v1 answer for the person, rebuilt as the consistent v2 answer of a revoked person (one disabled, applied row)."""
    original = env.engine.access_state

    def reader(uid, rev):
        raw = copy.deepcopy(original(uid, rev))
        raw.update(schema_version=2, central_revocation_predicate=was.CENTRAL_REVOCATION_PREDICATE, central_revoked=True,
                   assignments=[{"station_id": station, "enabled": False, "allowed_locks": [], "desired_revision": rev, "applied_revision": rev,
                                 "sync_state": "synced", "applied": True}])
        return raw

    return reader


def test_a_revoke_proven_only_by_a_v1_answer_ends_revoked_but_is_recorded_as_not_verified(env):
    gid = env.active_grant()
    assert env.grant(gid)["revoke_proof"] is None
    assert env.post(f"/access-grants/{gid}/revoke").status_code == 200
    g = env.grant(gid)
    assert g["state"] == "revoked" and g["revoke_proof"] == "unverified"
    assert env.person_of(gid)["active"] is False
    assert ag.sync_status(g)["revoke_proof"] == "unverified"
    assert axe.ui_state({"state": "revoked", "revoke_proof": "unverified"}) == "revoked_unverified"
    assert axe.ui_state({"state": "ended", "revoke_proof": "unverified"}) == "revoked_unverified"
    assert axe.ui_state({"state": "revoked", "revoke_proof": "verified"}) == "revoked"
    assert axe.ui_state({"state": "revoked", "revoke_proof": None}) == "revoked"
    assert axe.ui_state({"state": "revoking", "revoke_proof": "unverified"}) == "revoking"
    assert axe.STATE_TEXT["he"]["revoked_unverified"] != axe.STATE_TEXT["he"]["revoked"]
    assert axe.STATE_TEXT["en"]["revoked_unverified"] == "Revoked · not verified by the other side"


def test_a_revoke_proven_by_a_v2_answer_is_recorded_verified(env):
    gid = env.active_grant()
    env.engine.access_state_reader = _v2_reader(env)
    env.engine.last_known_stations = lambda pid: frozenset({"st-a"})
    assert env.post(f"/access-grants/{gid}/revoke").status_code == 200
    g = env.grant(gid)
    assert g["state"] == "revoked" and g["revoke_proof"] == "verified" and ag.sync_status(g)["revoke_proof"] == "verified"
    assert axe.ui_state({"state": "revoked", **ag.sync_status(g)}) == "revoked"


def test_a_v2_answer_without_proof_never_falls_back_to_the_v1_middle_path(env):
    gid = env.active_grant()
    env.engine.access_state_reader = _v2_reader(env)
    env.engine.last_known_stations = lambda pid: frozenset({"st-a", "st-b"})  # st-b is missing from the answer: not verified
    env.post(f"/access-grants/{gid}/revoke")
    assert env.grant(gid)["state"] == "revoking" and env.grant(gid)["revoke_proof"] is None


def test_pending_work_or_an_unknown_status_keeps_the_revoke_open_even_with_v1(env):
    gid = env.active_grant()
    env.engine.sync_lag = True  # the stripped person still has a pending revocation: v1 answers owed work
    env.post(f"/access-grants/{gid}/revoke")
    assert env.grant(gid)["state"] == "revoking" and env.grant(gid)["revoke_proof"] is None
    env.engine.settle_revocations()
    env.clock[0] = T0 + timedelta(minutes=20)
    env.run()
    assert env.grant(gid)["state"] == "revoked" and env.grant(gid)["revoke_proof"] == "unverified"
    gid2 = env.active_grant()
    env.engine.status_unknown = True
    env.post(f"/access-grants/{gid2}/revoke")
    assert env.grant(gid2)["state"] == "revoking" and env.grant(gid2)["revoke_proof"] is None


def test_the_live_engine_stays_refused_and_no_switch_is_on():
    assert ag.GO_LIVE_PERMITTED is False and a5.GO_LIVE_PERMITTED is False
