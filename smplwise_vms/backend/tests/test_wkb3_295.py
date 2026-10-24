"""WKB3-295 (FAKES ONLY): WisKey requirement A04 (Q03) - the per-station removal proof is judged on the station's own row and queues.
Ported from pilot/WKB-295 (af47229a9061b30a294deb3062971ffadb257907, 812b49a1df5f8b0ca31803754d114066ed56d6a1; the A04 part only) plus the
regrant / late ACK / detach / reopen / aggregate-guard cases. Nothing contacts WisKey, Home Assistant or a station; every answer is hand-built."""
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import access_grant_engine as age
from smplwise.services import wiskey_access_state as was

PERSON, REV = "person-a", 4
PRED = was.CENTRAL_REVOCATION_PREDICATE
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "wiskey_access_state_v2" / "a_current_b_pending.json"


def _row(sid: str, *, enabled: bool = False, applied: bool | None = True, applied_rev: int | None = REV, sync: str | None = "synced",
         rev: int = REV) -> dict[str, Any]:
    return {"station_id": sid, "enabled": enabled, "allowed_locks": [1], "desired_revision": rev, "applied_revision": applied_rev,
            "sync_state": sync, "applied": applied}


def _answer(rows: list[dict[str, Any]], *, operations=(), unverified=(), pins=(), central_revoked: bool | None = None,
            presence: str = "present", rev: int = REV) -> dict[str, Any]:
    queues = {"bindings": [], "tombstones": [], "cards": [], "pins": sorted(pins), "operations": sorted(operations), "unverified": sorted(unverified)}
    removal = any(queues[q] for q in was.REMOVAL_QUEUES)
    enabled = [r["applied"] for r in rows if r["enabled"]]
    synced = None if not enabled else False if False in enabled else None if None in enabled else True
    if central_revoked is None:
        central_revoked = not any(r["enabled"] for r in rows)
    return {"schema_version": 2, "observation": was.OBSERVATION, "scope": was.SCOPE, "user_id": PERSON, "person_revision": rev,
            "presence": presence, "revocation_pending": True if removal else (None if queues["unverified"] else False),
            "stations_synced": synced, "assignments": rows, "timing_policy": None, "pending": queues,
            "central_revocation_predicate": PRED, "central_revoked": central_revoked}


def _parse(raw: dict[str, Any], rev: int = REV) -> was.AccessState:
    return was.parse_result(raw, user_id=PERSON, revision=rev, expect=2)


def _station(st: was.AccessState, sid: str, rev: int = REV) -> bool | None:
    return was.station_removal_verdict_v2(st, person_id=PERSON, revision=rev, station_id=sid)


def _person(st: was.AccessState, known: frozenset[str], rev: int = REV) -> bool | None:
    return was.revocation_verdict_v2(st, person_id=PERSON, revision=rev, last_known_stations=known)


def a_current_b_pending() -> dict[str, Any]:
    """ONE answer, ONE revision. A: disabled, applied at this revision, synced. B: disabled, still behind, owed in `operations`."""
    return _answer([_row("station-a"), _row("station-b", applied=False, applied_rev=REV - 1, sync="pending")], operations=["station-b"])


# ---------------------------------------------------------------- the shared case and the fixture


def test_a_current_b_pending_a_is_clean_b_pending_aggregate_unchanged():
    st = _parse(a_current_b_pending())
    assert st.revocation_pending is True
    assert _station(st, "station-a") is False
    assert _station(st, "station-b") is True
    assert _station(st, "station-c") is None  # no row and no queue: UNKNOWN, a row is never invented
    assert _person(st, frozenset({"station-a", "station-b"})) is True  # aggregate not weakened
    assert _person(st, frozenset({"station-a"})) is True


def test_the_shared_case_through_the_engine_port():
    raw = a_current_b_pending()
    reader = lambda pid, rev: (copy.deepcopy(raw), 2)  # noqa: E731 - a fake readback
    assert age.station_removal_from(reader, PERSON, REV, "station-a") is False
    assert age.station_removal_from(reader, PERSON, REV, "station-b") is True
    assert age.revocation_pending_from(reader, PERSON, REV, last_known_stations=frozenset({"station-a", "station-b"})) is True


def test_shared_fixture_matches_the_builder_and_carries_provenance():
    data = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert data["answer"] == a_current_b_pending()
    prov = data["PROVENANCE"]
    assert prov["fix_commits"] == ["af47229a9061b30a294deb3062971ffadb257907", "812b49a1df5f8b0ca31803754d114066ed56d6a1"]
    assert prov["defective_blob"] == "5090a9e64d74f32170c7adb7ea750b48578eb9e5"
    st = _parse(data["answer"])
    assert {k: _station(st, k) for k in ("station-a", "station-b", "station-c")} == data["expected_station_verdicts"]
    assert _person(st, frozenset({"station-a", "station-b"})) is data["expected_aggregate"]


# ---------------------------------------------------------------- unverified, queues, still-active person


def test_unknown_at_another_station_does_not_block_a_but_unknown_at_a_stays_blocked():
    other = _parse(_answer([_row("station-a"), _row("station-b", applied=None)], unverified=["station-b"]))
    assert other.revocation_pending is None
    assert _station(other, "station-a") is False
    assert _station(other, "station-b") is None  # UNKNOWN never becomes clean
    assert _person(other, frozenset({"station-a", "station-b"})) is None
    own = _parse(_answer([_row("station-a")], unverified=["station-a"]))
    assert _station(own, "station-a") is None


@pytest.mark.parametrize("queue", ["operations", "pins", "unverified"])
def test_queue_only_orphan_keeps_other_stations_unknown(queue):
    st = _parse(_answer([_row("station-a")], **{queue: ["station-gone"]}))
    assert _station(st, "station-a") is None
    assert _station(st, "station-gone") is (None if queue == "unverified" else True)  # queue without row: pending (True), never invented


def test_a_station_proof_for_a_still_active_person_is_not_a_person_clean():
    st = _parse(_answer([_row("station-a"), _row("station-c", enabled=True)]))
    assert _station(st, "station-a") is False
    assert _station(st, "station-c") is None
    assert _person(st, frozenset({"station-a", "station-c"})) is None


@pytest.mark.parametrize("queue", ["bindings", "tombstones", "cards", "pins", "operations"])
def test_any_removal_queue_naming_a_is_pending_even_with_an_applied_row(queue):
    raw = _answer([_row("station-a")])
    raw["pending"][queue] = ["station-a"]
    raw["revocation_pending"] = True
    assert _station(_parse(raw), "station-a") is True


def test_whole_person_states_still_block_every_station():
    dp = _parse({**_answer([]), "presence": "delete_pending", "person_revision": None, "revocation_pending": True, "central_revoked": None,
                 "stations_synced": None})
    assert _station(dp, "station-a") is True
    absent = {**_answer([]), "presence": "absent", "person_revision": None, "revocation_pending": None, "central_revoked": None,
              "stations_synced": None}
    assert _station(_parse(absent), "station-a") is None
    assert was.station_removal_verdict_v2(_parse(a_current_b_pending()), person_id=PERSON, revision=REV + 1, station_id="station-a") is None


def test_v1_still_never_proves_one_station():
    raw = {k: v for k, v in a_current_b_pending().items() if k not in ("central_revocation_predicate", "central_revoked")}
    raw["schema_version"] = 1
    assert _station(was.parse_result(raw, user_id=PERSON, revision=REV, expect=1), "station-a") is None


# ---------------------------------------------------------------- regrant


def test_regrant_a_proven_at_rev4_is_none_at_rev5_and_a_stale_proof_is_never_reused():
    proven = _parse(_answer([_row("station-a")]))
    assert _station(proven, "station-a") is False
    assert _station(proven, "station-a", rev=REV + 1) is None  # the revision-4 answer asked at revision 5
    regrant = _parse(_answer([_row("station-a", enabled=True, rev=REV + 1, applied_rev=REV + 1)], rev=REV + 1), rev=REV + 1)
    assert regrant.central_revoked is False
    assert _station(regrant, "station-a", rev=REV + 1) is None  # an enabled row is never a removal proof


# ---------------------------------------------------------------- late ACK


def test_late_ack_b_behind_then_real_ack():
    behind = _parse(_answer([_row("station-a"), _row("station-b", applied=False, applied_rev=3, sync="pending")], operations=["station-b"]))
    assert _station(behind, "station-b") is True
    assert _station(behind, "station-a") is False
    # the same row claiming applied=True with applied_revision 3 is refused by the parser, and the engine port reads it as UNKNOWN
    lie = _answer([_row("station-a"), _row("station-b", applied=True, applied_rev=3, sync="synced")])
    with pytest.raises(was.AccessStateError):
        _parse(lie)
    assert age.station_removal_from(lambda pid, rev: (lie, 2), PERSON, REV, "station-b") is None
    # the real ACK at revision 4: both stations proven, nothing owed
    acked = _parse(_answer([_row("station-a"), _row("station-b")]))
    assert _station(acked, "station-b") is False
    assert _person(acked, frozenset({"station-a", "station-b"})) is False  # central_revoked True and F-02 holds


# ---------------------------------------------------------------- detach


def test_detach_no_row_but_queued_is_pending_no_row_no_queue_is_unknown():
    queued = _parse(_answer([_row("station-b")], operations=["station-a"]))
    assert _station(queued, "station-a") is True
    nothing = _parse(_answer([_row("station-b")]))
    assert _station(nothing, "station-a") is None
    assert _station(nothing, "station-b") is False
    other_queued = _parse(_answer([_row("station-b")], operations=["station-x"]))
    assert _station(other_queued, "station-a") is None
    assert _station(other_queued, "station-b") is None  # orphan rule: station-x cannot be attributed


# ---------------------------------------------------------------- reopen / restart


def test_reopen_restart_voids_positives_and_delete_pending_then_present():
    restart = _parse(_answer([_row("station-a", applied=None)], unverified=["station-a"]))
    assert _station(restart, "station-a") is None
    dp = _parse({**_answer([]), "presence": "delete_pending", "person_revision": None, "revocation_pending": True, "central_revoked": None,
                 "stations_synced": None})
    assert _station(dp, "station-a") is True
    reopened = _parse(_answer([_row("station-a", rev=REV + 1, applied_rev=REV + 1)], rev=REV + 1), rev=REV + 1)
    assert _station(reopened, "station-a", rev=REV) is None  # the old revision is never proven by the new answer
    assert _station(reopened, "station-a", rev=REV + 1) is False


# ---------------------------------------------------------------- aggregate guard


def test_aggregate_is_never_false_while_a_last_known_station_verdict_is_true_or_unknown():
    cases = [
        (a_current_b_pending(), {"station-a", "station-b"}),
        (_answer([_row("station-a"), _row("station-b", applied=None)], unverified=["station-b"]), {"station-a", "station-b"}),
        (_answer([_row("station-a")], operations=["station-gone"]), {"station-a", "station-gone"}),
        (_answer([_row("station-b")], operations=["station-a"]), {"station-a", "station-b"}),
        (_answer([_row("station-b")]), {"station-a", "station-b"}),
        (_answer([_row("station-a"), _row("station-c", enabled=True)]), {"station-a", "station-c"}),
        (_answer([_row("station-a", applied=None)], unverified=["station-a"]), {"station-a"}),
    ]
    for raw, known in cases:
        st = _parse(raw)
        verdicts = [_station(st, sid) for sid in known]
        if any(v is not False for v in verdicts):
            assert _person(st, frozenset(known)) is not False, raw
