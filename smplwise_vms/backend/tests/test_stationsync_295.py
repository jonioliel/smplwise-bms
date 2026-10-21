"""STATIONSYNC-295 (FAKES ONLY): the WisKey round-11 alignment (private/planning/wiskey_round11_2026-10-20, R11-I2-01 and R11-I1-03).

(1) `person_from_raw().stations_synced` is the CENTRAL applied bookkeeping (desired / applied, WisKey's journal), never physical proof.
    True only when every enabled row has desired_revision == person.revision, applied_revision == desired_revision, sync_state
    "synced" and a valid last_sync_at; False only when a well-formed row is explicitly behind; everything else UNKNOWN (None).
    Physical proof stays UNKNOWN (`physical_proof` is None) until a device-side evidence contract exists.
(2) `Engine.revocation_pending(person_id, revision)` is bound to the revision of the fresh readback it judges, through a typed
    access_state consumer and a central revocation predicate. Absent / scoped 404 / empty assignments / empty arrays are never proof
    of cleanup; False needs presence=present at the SAME revision, all six pending arrays empty and the separate central predicate.

Nothing here contacts WisKey, Home Assistant, a station or a door: the engine is tests/fake_wiskey.FakeAccessEngine or a dict fake,
and the live engine stays refused (GO_LIVE_PERMITTED is False)."""
from __future__ import annotations

import inspect
from dataclasses import replace
from datetime import timedelta
from typing import Any

import pytest
from test_access_grants import T0, Env

from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services.access_grant_engine import EngineError, EnginePerson, WiskeyServiceEngine

SYNCED_AT = "2026-10-20T12:00:00+00:00"


def _row(**over: Any) -> dict:
    base = {"enabled": True, "allowed_locks": [1], "desired_revision": 4, "applied_revision": 4, "sync_state": "synced", "last_sync_at": SYNCED_AT}
    return {**base, **over}


def _raw(rows: dict | None = None, **over: Any) -> dict:
    base = {"id": "u", "revision": 4, "active": True, "group_ids": [], "permission_overrides": {}, "pin_configured": False,
            "assignments": {"st-a": _row()} if rows is None else rows}
    return {**base, **over}


def _synced(rows: dict | None = None, **over: Any) -> bool | None:
    return age.person_from_raw(_raw(rows, **over)).stations_synced


# ================================================================ (1) stations_synced = central applied bookkeeping


def test_all_four_conditions_give_true():
    assert _synced() is True
    assert _synced(last_sync_at=None) is True, "the record-level key is not the row's"
    assert _synced({"st-a": _row(last_sync_at="2026-10-20T12:00:00Z")}) is True


@pytest.mark.parametrize("bad", [None, "", "yesterday", "2026-13-40T00:00:00+00:00", "2026-10-20T12:00:00", 1729425600, True, ["x"]])
def test_a_missing_or_invalid_last_sync_at_is_unknown_not_synced(bad):
    assert _synced({"st-a": _row(last_sync_at=bad)}) is None


def test_an_absent_last_sync_at_key_is_unknown():
    row = _row()
    del row["last_sync_at"]
    assert _synced({"st-a": row}) is None


def test_a_row_synced_for_an_older_person_revision_is_unknown():
    """desired == applied == 3, "synced", but the person is at revision 4: that row proves the station took revision 3, nothing about 4."""
    assert _synced({"st-a": _row(desired_revision=3, applied_revision=3)}) is None


def test_bookkeeping_ahead_of_the_record_or_applied_ahead_of_desired_is_unknown():
    assert _synced({"st-a": _row(desired_revision=5, applied_revision=5)}) is None
    assert _synced({"st-a": _row(desired_revision=4, applied_revision=5)}) is None


def test_explicitly_behind_rows_are_false_even_without_a_sync_time():
    assert _synced({"st-a": _row(applied_revision=3, sync_state="pending", last_sync_at=None)}) is False
    assert _synced({"st-a": _row(applied_revision=3)}) is False, "applied < desired is behind whatever the state says"
    assert _synced({"st-a": _row(sync_state="error")}) is False
    assert _synced({"st-a": _row(applied_revision=None, sync_state="pending", last_sync_at=None)}) is False, "null = not applied yet"
    assert _synced({"st-a": _row(desired_revision=3, applied_revision=2, sync_state="pending")}) is False


def test_missing_or_unknown_bookkeeping_is_unknown_not_behind():
    row = _row()
    del row["applied_revision"]
    assert _synced({"st-a": row}) is None, "an absent key is not 'not applied yet'"
    row = _row()
    del row["desired_revision"]
    assert _synced({"st-a": row}) is None
    assert _synced({"st-a": _row(sync_state="quantum")}) is None
    assert _synced({"st-a": _row(sync_state=None)}) is None


def test_one_behind_row_makes_the_person_false_one_unknown_row_makes_it_unknown():
    behind = _row(applied_revision=3, sync_state="pending")
    unknown = _row(last_sync_at=None)
    assert _synced({"st-a": _row(), "st-b": behind}) is False
    assert _synced({"st-a": _row(), "st-b": unknown}) is None
    assert _synced({"st-a": unknown, "st-b": behind}) is False
    assert _synced({"st-a": _row(), "st-b": _row(enabled=False, applied_revision=1, sync_state="error", last_sync_at=None)}) is True, "disabled rows are skipped"


def test_no_enabled_row_or_an_unknown_door_map_is_unknown():
    assert _synced({}) is None
    assert _synced({"st-a": _row(enabled=False)}) is None
    assert _synced(redacted_fields=["access"]) is None
    assert _synced(group_ids=None) is None


def test_physical_proof_is_never_claimed():
    p = age.person_from_raw(_raw())
    assert p.stations_synced is True and p.physical_proof is None
    assert EnginePerson(id="x", revision=1).physical_proof is None


def test_the_fake_engine_view_carries_a_sync_time():
    from fake_wiskey import FakeAccessEngine

    e = FakeAccessEngine()
    e.add_person("p1", doors={"st-a": [1]})
    assert e.get_person("p1").stations_synced is True


# ================================================================ (2) the access_state consumer (strict)


def _state(**over: Any) -> dict:
    base = {"schema_version": 1, "observation": "durable_repository_snapshot", "scope": "all_managed_stations", "user_id": "u",
            "person_revision": 4, "presence": "present", "revocation_pending": False, "stations_synced": None, "assignments": [],
            "timing_policy": None, "pending": {k: [] for k in ("bindings", "tombstones", "cards", "pins", "operations", "unverified")}}
    return {**base, **over}


def _pending(**over: list) -> dict:
    return {**{k: [] for k in ("bindings", "tombstones", "cards", "pins", "operations", "unverified")}, **over}


def test_a_well_formed_answer_parses_and_keeps_all_six_queues_and_unverified_apart():
    s = age.access_state_from_raw(_state(revocation_pending=True, pending=_pending(cards=["st-b"], unverified=["st-a"])), user_id="u")
    assert s.user_id == "u" and s.person_revision == 4 and s.presence == "present" and s.revocation_pending is True
    assert s.pending == {"bindings": (), "tombstones": (), "cards": ("st-b",), "pins": (), "operations": ()}
    assert s.unverified == ("st-a",)
    assert s.has_pending is True


@pytest.mark.parametrize("over", [
    {"schema_version": True}, {"schema_version": "1"}, {"schema_version": 2}, {"schema_version": None},
    {"observation": "cache"}, {"scope": "caller"}, {"user_id": "U"}, {"user_id": None},
    {"person_revision": True}, {"person_revision": 0}, {"person_revision": "4"}, {"person_revision": None},
    {"presence": "gone"}, {"revocation_pending": 0}, {"revocation_pending": "false"}, {"stations_synced": "yes"},
    {"pending": None}, {"pending": []}, {"pending": {"bindings": []}},
    {"pending": {**_pending(), "extra": []}}, {"pending": _pending(cards="st-a")}, {"pending": _pending(cards=["st-a", "st-a"])},
    {"pending": _pending(cards=[""])}, {"pending": _pending(cards=[7])},
])
def test_anything_off_contract_is_rejected(over):
    with pytest.raises(ValueError):
        age.access_state_from_raw(_state(**over), user_id="u")


def test_a_non_object_answer_is_rejected():
    for raw in (None, [], "ok", 1):
        with pytest.raises(ValueError):
            age.access_state_from_raw(raw, user_id="u")


def test_absence_carries_no_revision_and_present_must():
    assert age.access_state_from_raw(_state(presence="absent", person_revision=None, revocation_pending=None), user_id="u").person_revision is None
    with pytest.raises(ValueError):
        age.access_state_from_raw(_state(presence="absent", person_revision=4, revocation_pending=None), user_id="u")


def test_a_false_flag_beside_a_non_empty_queue_is_inconsistent():
    with pytest.raises(ValueError):
        age.access_state_from_raw(_state(pending=_pending(operations=["st-a"])), user_id="u")
    with pytest.raises(ValueError):
        age.access_state_from_raw(_state(pending=_pending(unverified=["st-a"])), user_id="u")
    with pytest.raises(ValueError):  # only a present person can be not-pending
        age.access_state_from_raw(_state(presence="absent", person_revision=None), user_id="u")


# ================================================================ (2) the verdict: False only at the same revision, present, all empty


def _verdict(raw: dict, revision: int = 4, person_id: str = "u") -> bool | None:
    return age.revocation_pending_verdict(age.access_state_from_raw(raw, user_id="u"), person_id=person_id, revision=revision)


def _evidence(raw: dict, revision: int = 4, person_id: str = "u") -> str | None:
    return age.revocation_evidence_verdict(age.access_state_from_raw(raw, user_id="u"), person_id=person_id, revision=revision)


def test_the_clean_looking_shape_is_only_for_present_same_revision_and_six_empty_arrays_and_is_never_a_proof():
    """WKV2B-295: what used to be False (proven clean) is now UNKNOWN as a verdict and `revoked_unverified` as evidence (v1 proves nothing)."""
    assert _verdict(_state()) is None
    assert _evidence(_state()) == "revoked_unverified"
    assert _evidence(_state(), revision=5) is None
    assert _evidence(_state(), person_id="v") is None


def test_a_revision_mismatch_is_unknown_never_false():
    assert _verdict(_state(), revision=5) is None
    assert _verdict(_state(), revision=3) is None
    assert _verdict(_state(person_revision=5, revocation_pending=True, pending=_pending(cards=["st-a"])), revision=4) is None


def test_absent_is_never_cleanup_proof():
    assert _verdict(_state(presence="absent", person_revision=None, revocation_pending=None)) is None


def test_delete_pending_and_any_central_queue_are_pending():
    assert _verdict(_state(presence="delete_pending", person_revision=None, revocation_pending=True, pending=_pending(tombstones=["st-a"]))) is True
    assert _verdict(_state(presence="delete_pending", person_revision=None, revocation_pending=None)) is True
    for key in ("bindings", "tombstones", "cards", "pins", "operations"):
        assert _verdict(_state(revocation_pending=True, pending=_pending(**{key: ["st-a"]}))) is True, key


def test_unverified_alone_is_unknown_not_cleared():
    assert _verdict(_state(revocation_pending=None, pending=_pending(unverified=["st-a"]))) is None


def test_a_flag_that_is_not_false_with_empty_queues_is_unknown():
    assert _verdict(_state(revocation_pending=None)) is None


def test_the_verdict_refuses_another_person():
    assert _verdict(_state(), person_id="v") is None


# ================================================================ (2) the reader seam and the engine port


def test_the_reader_seam_is_asked_for_the_exact_person_and_revision():
    asked: list = []

    def reader(user_id, revision):
        asked.append((user_id, revision))
        return _state()

    assert age.revocation_pending_from(reader, "u", 4) is None  # WKV2B-295: v1 never proves a revoke
    assert age.revocation_evidence_from(reader, "u", 4) == "revoked_unverified"
    assert asked == [("u", 4), ("u", 4)]


@pytest.mark.parametrize("revision", [True, 0, -1, "4", None, 4.0])
def test_an_unusable_revision_never_reaches_the_reader(revision):
    def reader(*_a):  # pragma: no cover - must not run
        raise AssertionError("called")

    assert age.revocation_pending_from(reader, "u", revision) is None


def test_no_reader_a_failing_reader_or_garbage_is_unknown():
    assert age.revocation_pending_from(None, "u", 4) is None

    def conflict(*_a):
        raise EngineError("revision_conflict")

    def boom(*_a):
        raise RuntimeError("x")

    assert age.revocation_pending_from(conflict, "u", 4) is None
    assert age.revocation_pending_from(boom, "u", 4) is None
    assert age.revocation_pending_from(lambda *_a: {"revocation_pending": False}, "u", 4) is None
    assert age.revocation_pending_from(lambda *_a: _state(user_id="v"), "u", 4) is None


def test_the_port_takes_the_revision():
    for cls in (age.Engine, WiskeyServiceEngine):
        assert list(inspect.signature(cls.revocation_pending).parameters) == ["self", "person_id", "revision"], cls


def test_the_live_engine_stays_refused_and_without_a_reader_is_unknown(monkeypatch):
    assert ag.GO_LIVE_PERMITTED is False
    eng = WiskeyServiceEngine(settings=None)
    with pytest.raises(EngineError) as err:
        eng.revocation_pending("u", 4)
    assert err.value.kind == "not_permitted"
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
    assert eng.access_state_reader is None
    assert eng.revocation_pending("u", 4) is None, "no access_state client is built: UNKNOWN, a live revoke stays revoking"


def test_the_live_engine_passes_an_injected_fake_reader_through_the_predicate(monkeypatch):
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
    eng = WiskeyServiceEngine(settings=None, access_state_reader=lambda uid, rev: _state(user_id=uid, person_revision=rev))
    assert eng.revocation_pending("u", 4) is None  # WKV2B-295: v1 never proves a revoke
    assert eng.revocation_evidence("u", 4) == "revoked_unverified"
    eng = WiskeyServiceEngine(settings=None, access_state_reader=lambda uid, rev: _state(user_id=uid, person_revision=rev + 1))
    assert eng.revocation_pending("u", 4) is None and eng.revocation_evidence("u", 4) is None


# ================================================================ the central revocation predicate (separate, same readback)


def _revoked_person(**over: Any) -> EnginePerson:
    base = dict(id="u", revision=5, active=False, doors={}, doors_known=True, overrides={}, overrides_known=True, group_ids=(),
                pin_configured=False, pin_known=True)
    return EnginePerson(**{**base, **over})


def test_the_central_predicate_needs_every_field_known_and_cleared():
    assert age.central_revoked(_revoked_person()) is True
    for over in ({"active": True}, {"doors": {"st-a": [1]}}, {"doors_known": False}, {"overrides": {"st-a": "allow"}},
                 {"overrides_known": False}, {"group_ids": ("g",)}, {"pin_configured": True}, {"pin_known": False}):
        assert age.central_revoked(_revoked_person(**over)) is False, over


def test_revocation_is_proven_only_by_both_predicates_together():
    p = _revoked_person()
    assert age.revocation_proven(p, False) is True
    assert age.revocation_proven(p, None) is False and age.revocation_proven(p, True) is False
    assert age.revocation_proven(replace(p, active=True), False) is False, "a False status never stands in for the central predicate"
    assert ag.Worker._revoked(replace(p, overrides_known=False)) is False


# ================================================================ the worker with the fake engine


@pytest.fixture()
def env(settings, monkeypatch):
    e = Env(settings, monkeypatch)
    yield e
    ag.reset_for_tests()


def test_the_fake_answers_per_revision_and_the_worker_asks_for_the_readback_revision(env):
    gid = env.active_grant()
    asked: list = []
    original = env.engine.access_state

    def spy(uid, rev):
        asked.append((uid, rev))
        return original(uid, rev)

    env.engine.access_state_reader = spy
    env.post(f"/access-grants/{gid}/revoke")
    env.clock[0] = T0 + timedelta(minutes=10)
    env.run()
    pid = env.person_of(gid)["id"]
    assert env.grant(gid)["state"] == "revoked"
    assert asked and asked[-1] == (pid, env.engine.people[pid]["revision"])


def test_an_answer_for_another_revision_keeps_the_revoke_pending(env):
    gid = env.active_grant()
    original = env.engine.access_state
    env.engine.access_state_reader = lambda uid, rev: {**original(uid, env.engine.people[uid]["revision"]), "person_revision": rev + 1}
    env.post(f"/access-grants/{gid}/revoke")
    assert env.grant(gid)["state"] == "revoking"
    env.engine.access_state_reader = original
    env.clock[0] = T0 + timedelta(minutes=10)
    env.run()
    assert env.grant(gid)["state"] == "revoked"


def test_unverified_station_work_keeps_the_revoke_pending(env):
    gid = env.active_grant()
    pid = env.person_of(gid)["id"]
    env.engine.unverified[pid] = {"st-a"}
    env.post(f"/access-grants/{gid}/revoke")
    assert env.grant(gid)["state"] == "revoking", "a settled-only operation is not cleanup"
    env.engine.unverified.clear()
    env.clock[0] = T0 + timedelta(minutes=10)
    env.run()
    assert env.grant(gid)["state"] == "revoked"


def test_a_vanished_person_never_proves_cleanup(env):
    gid = env.active_grant()
    env.engine.sync_lag = True
    env.post(f"/access-grants/{gid}/revoke")
    pid = env.person_of(gid)["id"]
    env.engine.access_state_reader = lambda uid, rev: {**env.engine.access_state(uid, rev), "presence": "absent", "person_revision": None,
                                                        "revocation_pending": None, "pending": _pending()}
    env.engine.settle_revocations()
    env.clock[0] = T0 + timedelta(minutes=10)
    env.run()
    assert env.grant(gid)["state"] == "revoking", "absent with empty arrays is not proof"
    assert pid in env.engine.people
