"""ECCACT-295 stage 1 (FAKES ONLY): v1 never proves a revocation, capability negotiation, the readback channel, the live reader
against a fake SYNC, the 2^53-1 revision bound. Nothing contacts WisKey, Home Assistant or a station."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from smplwise.services import access_grant_engine as age
from smplwise.services import wiskey_access_state as was
from smplwise.services import wiskey_acr5 as a5
from smplwise.services import wiskey_channels as ch
from smplwise.services import wiskey_peer as wp
from smplwise.services import wiskey_readback as rb

FIX = Path(__file__).resolve().parent / "fixtures" / "wiskey_access_state_v2"
PERSON, REV = "person-a", 4
LISTED = ["users/access_state", "users/access_state_v2", "schedules/normalize_user", "users/get"]
CAPS = ["person_access_state_v1", "person_access_state_v2"]


def fx(name: str) -> dict[str, Any]:
    return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


def v1_clean() -> dict[str, Any]:
    raw = {k: v for k, v in fx("present_empty_bookkeeping").items() if k not in ("central_revocation_predicate", "central_revoked")}
    raw["schema_version"] = 1
    return raw


# ---------------------------------------------------------------- v1 never proves a revocation (WKV2B)

def test_a_clean_v1_answer_is_unknown_not_false_in_the_engine_and_the_consumer():
    st = age.access_state_from_raw(v1_clean(), user_id=PERSON, revision=REV)
    assert age.revocation_pending_verdict(st, person_id=PERSON, revision=REV) is None
    parsed = a5.parse_access_state({"id": 1, "type": "result", "success": True, "result": v1_clean()}, user_id=PERSON, revision=REV)
    assert a5.revocation_verdict(parsed, requested_revision=REV, central_revoked_at=REV) is None


def test_v1_still_reports_work_that_is_owed():
    raw = v1_clean()
    raw["revocation_pending"] = True
    st = age.access_state_from_raw(raw, user_id=PERSON, revision=REV)
    assert age.revocation_pending_verdict(st, person_id=PERSON, revision=REV) is True


def test_v2_can_still_prove_with_full_evidence():
    st = age.access_state_from_raw(fx("present_revoked_disabled_row_applied"), user_id=PERSON, revision=REV)
    sid = st.parsed.assignments[0].station_id
    assert age.revocation_pending_verdict(st, person_id=PERSON, revision=REV, last_known_stations=frozenset({sid})) is False
    # a past station with no row at all stays UNKNOWN (WisKey 2026-10-21: no applied=true invented from assignments={})
    assert age.revocation_pending_verdict(st, person_id=PERSON, revision=REV, last_known_stations=frozenset({sid, "gone-station"})) is None


# ---------------------------------------------------------------- negotiation

def test_negotiation_prefers_v2_and_needs_command_and_capability():
    n = was.negotiate(LISTED, CAPS)
    assert (n.version, n.command, n.can_prove_revocation) == (2, "hikvision_intercom/users/access_state_v2", True)
    only1 = was.negotiate(["users/access_state"], ["person_access_state_v1"])
    assert only1.version == 1 and only1.can_prove_revocation is False
    assert was.negotiate(LISTED, []).version is None and was.negotiate(LISTED, []).reason == "capability_missing"
    assert was.negotiate(["users/get"], CAPS).reason == "unsupported"
    assert was.negotiate(None, CAPS).reason == "not_listed" and was.negotiate(LISTED, "x").reason == "not_listed"
    assert was.negotiate([1], CAPS).version is None
    # v2 listed but only the v1 capability: v1 may be read (never proves), v2 is not assumed
    assert was.negotiate(LISTED, ["person_access_state_v1"]).version == 1


# ---------------------------------------------------------------- the channel

def test_the_readback_channel_holds_exactly_three_reads_and_no_write():
    assert ch.READBACK == {"users/access_state", "users/access_state_v2", "schedules/normalize_user"}
    assert not (ch.READBACK & ch.SERVICE_WRITES) and "readback" in ch.ADAPTER_CHANNELS and "readback" in ch.UNPINNED_CHANNELS
    assert ch.allowed("readback", "hikvision_intercom/users/access_state_v2")
    assert not ch.allowed("readback", "hikvision_intercom/users/update") and not ch.allowed("read", "hikvision_intercom/users/access_state_v2")


# ---------------------------------------------------------------- the live reader against a fake SYNC

class FakeSync:
    def __init__(self, commands=LISTED, caps=CAPS, answer=None, fail=False):
        self.commands, self.caps, self.answer, self.fail = commands, caps, answer, fail
        self.calls: list[tuple[str, str]] = []

    def command(self, settings, key, send, project, who="", channel="service", **kw):
        self.calls.append((key, channel))
        if self.fail:
            raise RuntimeError("boom")
        if key == "readback_api":
            return {"state": "ready", key: project({"api": {"commands": self.commands, "capabilities": self.caps}})}
        if self.answer is None:
            return {"state": "error", "last_error": "timeout", key: None}
        return {"state": "ready", key: self.answer}


def test_the_reader_negotiates_then_asks_v2_and_pins_the_schema():
    answer = fx("present_revoked_disabled_row_applied")
    sync = FakeSync(answer=answer)
    reader = rb.LiveReadback(None, sync=sync)
    result, schema = reader(PERSON, REV)
    assert schema == 2 and result == answer and ("access_state", "readback") in sync.calls
    sid = answer["assignments"][0]["station_id"]
    assert age.revocation_pending_from(reader, PERSON, REV, last_known_stations=frozenset({sid})) is False


def test_a_v1_answer_to_a_v2_question_is_refused_not_downgraded():
    sync = FakeSync(answer=v1_clean())
    assert age.revocation_pending_from(rb.LiveReadback(None, sync=sync), PERSON, REV, last_known_stations=frozenset()) is None


@pytest.mark.parametrize("kw", [dict(commands=["users/get"]), dict(caps=[]), dict(answer=None), dict(fail=True)])
def test_every_failure_is_unknown(kw):
    reader = rb.LiveReadback(None, sync=FakeSync(**kw))
    assert age.revocation_pending_from(reader, PERSON, REV, last_known_stations=frozenset()) is None


def test_negotiation_is_cached_for_a_short_ttl_only():
    sync = FakeSync(answer=fx("present_empty_bookkeeping"))
    now = [0.0]
    reader = rb.LiveReadback(None, sync=sync, clock=lambda: now[0])
    reader.negotiate(); reader.negotiate()
    assert [c for c in sync.calls if c[0] == "readback_api"] == [("readback_api", "service")]
    now[0] = rb.NEGOTIATION_TTL_S + 1
    reader.negotiate()
    assert len([c for c in sync.calls if c[0] == "readback_api"]) == 2


# ---------------------------------------------------------------- the JSON-safe revision bound

def test_revisions_are_bounded_to_2_pow_53_minus_1():
    assert wp.is_pos_int(2 ** 53 - 1) and not wp.is_pos_int(2 ** 53) and not wp.is_pos_int(0) and not wp.is_pos_int(True)
    assert a5._pos_int(2 ** 53 - 1) and not a5._pos_int(2 ** 53)
    with pytest.raises(ValueError):
        a5.access_state_request("u", 2 ** 53)


# ---------------------------------------------------------------- the engine end to end (permit open, fake transport)

def _engine(sync, known):
    return age.WiskeyServiceEngine(None, access_state_reader=rb.LiveReadback(None, sync=sync), last_known_stations=lambda pid: known)


def test_the_engine_proves_a_revocation_only_through_a_negotiated_v2_answer():
    from smplwise.services import access_grants as ag

    assert ag.GO_LIVE_PERMITTED is True  # the engine guard is open (ECCACT-295); every installation switch is still off by default
    answer = fx("present_revoked_disabled_row_applied")
    sid = answer["assignments"][0]["station_id"]
    assert _engine(FakeSync(answer=answer), frozenset({sid})).revocation_pending(PERSON, REV) is False
    # a past station without a row stays UNKNOWN (no applied=true is invented from an empty assignments list)
    assert _engine(FakeSync(answer=answer), frozenset({sid, "past-station"})).revocation_pending(PERSON, REV) is None
    # a WisKey that only offers v1: it can report work still owed, but never a clean revocation
    only_v1 = dict(commands=["users/access_state"], caps=["person_access_state_v1"])
    assert _engine(FakeSync(answer=v1_clean(), **only_v1), frozenset()).revocation_pending(PERSON, REV) is None
    owed = v1_clean(); owed["revocation_pending"] = True
    assert _engine(FakeSync(answer=owed, **only_v1), frozenset()).revocation_pending(PERSON, REV) is True
    # a WisKey that lists nothing usable
    assert _engine(FakeSync(answer=answer, commands=["users/get"]), frozenset({sid})).revocation_pending(PERSON, REV) is None


# ---------------------------------------------------------------- one station's removal (a station block), v2 only

def _v2_state(name: str):
    return was.parse_result(fx(name), user_id=PERSON, revision=REV, expect=2)


def test_station_removal_is_proven_only_by_a_disabled_applied_row_of_that_station_in_a_v2_answer():
    st = _v2_state("present_revoked_disabled_row_applied")
    sid = st.assignments[0].station_id
    assert was.station_removal_verdict_v2(st, person_id=PERSON, revision=REV, station_id=sid) is False
    assert was.station_removal_verdict_v2(st, person_id=PERSON, revision=REV, station_id="other") is None  # no row: UNKNOWN, never invented
    assert was.station_removal_verdict_v2(st, person_id=PERSON, revision=REV + 1, station_id=sid) is None
    assert was.station_removal_verdict_v2(st, person_id="someone", revision=REV, station_id=sid) is None
    assert was.station_removal_verdict_v2(st, person_id=PERSON, revision=True, station_id=sid) is None
    enabled = _v2_state("present_enabled_row_synced")
    assert was.station_removal_verdict_v2(enabled, person_id=PERSON, revision=REV, station_id=enabled.assignments[0].station_id) is None


def test_station_removal_reports_work_that_names_the_station_and_never_trusts_v1():
    owed = _v2_state("present_revoked_pin_pending")
    named = [s for ids in owed.pending.removal_queues().values() for s in ids]
    if named:
        assert was.station_removal_verdict_v2(owed, person_id=PERSON, revision=REV, station_id=named[0]) is True
    v1 = was.parse_result(v1_clean(), user_id=PERSON, revision=REV, expect=1)
    assert was.station_removal_verdict_v2(v1, person_id=PERSON, revision=REV, station_id="station-a") is None
    assert was.station_removal_verdict_v2(None, person_id=PERSON, revision=REV, station_id="station-a") is None


def test_the_engine_port_for_one_station_follows_the_same_rules():
    answer = fx("present_revoked_disabled_row_applied")
    sid = answer["assignments"][0]["station_id"]
    eng = _engine(FakeSync(answer=answer), frozenset())
    assert eng.station_removal_pending(PERSON, REV, sid) is False
    assert eng.station_removal_pending(PERSON, REV, "unknown-station") is None
    assert _engine(FakeSync(answer=v1_clean(), commands=["users/access_state"], caps=["person_access_state_v1"]), frozenset()).station_removal_pending(PERSON, REV, sid) is None
    assert age.WiskeyServiceEngine(None).station_removal_pending(PERSON, REV, sid) is None  # no reader
