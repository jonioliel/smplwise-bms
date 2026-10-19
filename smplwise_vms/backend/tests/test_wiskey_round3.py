"""WisKey round 3 (R3-03 .. R3-08; `private/planning/wiskey_reply3_answer_2026-10-18/`, WisKey's STATIC reading of the Arx service
channel and its own pinned source c0b2d94c - NOT_RUN against any WisKey, station or door). Unit tests with fakes only: no socket, no
Home Assistant, no device. The end-to-end paths (editor routes, grants worker) are in tests/test_intercom.py,
tests/test_intercom_writes_s11.py and tests/test_access_grants.py."""
from __future__ import annotations

import asyncio
from concurrent.futures import Future
from typing import Any

import pytest

from smplwise.errors import ApiError
from smplwise.services import access_grant_engine as age
from smplwise.services import access_grants as ag
from smplwise.services import intercom_adapter, intercom_client, intercom_sync
from smplwise.services import intercom_writes as iw
from smplwise.services.access_grant_engine import EngineError, WiskeyServiceEngine
from smplwise.services.intercom_client import IntercomError, UnclearAnswer


def _person(**over: Any) -> dict[str, Any]:
    """A `ManagedUser.public()`-shaped record (unrestricted: neither `redacted_fields` nor `operator_editable`)."""
    base = {
        "id": "u1", "revision": 3, "display_name": "Dana", "employee_no": "123456789", "phone": "050", "active": True,
        "valid_from": "2026-10-22T05:00:00Z", "valid_until": "2026-10-22T14:00:00Z", "access_category": "contractor",
        "responsible_person": "Avi", "access_purpose": "maintenance", "pin_configured": True, "photo_configured": False, "cards": [],
        "group_ids": ["g1"], "permission_overrides": {}, "identity_locked": False,
        "assignments": {"st-a": {"config_entry_id": "st-a", "enabled": True, "allowed_locks": [1], "desired_revision": 3,
                                 "applied_revision": 3, "sync_state": "synced", "last_error": None}},
    }
    return {**base, **over}


# WisKey's operator_scope.project_person for a caller without `access` / `credentials` / `phone`: the blanks it puts in their place
ACCESS_BLANKED = {"assignments": {}, "permission_overrides": {}, "group_ids": [], "valid_from": None, "valid_until": None,
                  "access_category": "staff", "responsible_person": "", "access_purpose": ""}


# ---------------------------------------------------------------- R3-03: unknown / redacted scope survives the projection

def test_r3_03_an_unrestricted_record_is_complete_evidence():
    p = intercom_sync.project_person(_person())
    assert p["access_known"] and p["stations_known"] and p["access_category"] == "contractor"
    assert p["redacted_fields"] == [] and p["operator_editable"] is None
    assert [s["station_id"] for s in p["stations"]] == ["st-a"]
    e = intercom_sync.project_person_editor(_person(pin_configured=False))
    assert e["pin_configured"] is False and e["credentials_known"] is True, "a readable false is evidence"


def test_r3_03_a_withheld_access_category_is_unknown_never_empty():
    raw = _person(**ACCESS_BLANKED, redacted_fields=["access"], operator_editable=True)
    p = intercom_sync.project_person(raw)
    assert p["stations"] == [] and p["stations_known"] is False and p["access_known"] is False
    assert p["valid_from"] is None and p["access_category"] is None, "WisKey's blank 'staff' is not the person's category"
    assert p["redacted_fields"] == ["access"] and p["operator_editable"] is True
    extras = iw.project_editor_extras(raw)
    assert extras["access_category"] == "unknown" and extras["responsible_person"] is None and extras["access_purpose"] is None


def test_r3_03_a_station_scoped_view_is_never_the_complete_station_list():
    """A station-scoped caller gets assignments filtered to its stations and possibly an EMPTY redacted_fields."""
    p = intercom_sync.project_person(_person(redacted_fields=[], operator_editable=False))
    assert p["access_known"] is True and p["stations_known"] is False
    q = age.person_from_raw(_person(redacted_fields=[], operator_editable=False))
    assert q.doors_known is False and q.doors == {}


def test_r3_03_withheld_credentials_and_phone_are_null_not_false_or_blank():
    raw = _person(cards=[], pin_configured=False, phone="", redacted_fields=["credentials", "phone"], operator_editable=True)
    e = intercom_sync.project_person_editor(raw)
    assert e["pin_configured"] is None and e["credentials_known"] is False and e["phone"] is None
    assert intercom_sync.project_person_editor(_person(pin_configured="yes"))["pin_configured"] is None, "not a boolean: unknown"
    missing = _person()
    del missing["pin_configured"]
    assert intercom_sync.project_person_editor(missing)["pin_configured"] is None


@pytest.mark.parametrize("over", [
    {"redacted_fields": ["access"]}, {"redacted_fields": ["credentials"]}, {"operator_editable": True}, {"redacted_fields": []},
    {"redacted_fields": "access"}, {"redacted_fields": [1]}, {"assignments": None},
])
def test_r3_03_the_grant_engine_never_reads_a_restricted_record_as_revoked(over):
    """The revoke-complete predicate (Worker._revoked) needs a complete, unredacted readback - the category names WisKey really sends
    (`access`, `credentials`) count, and so does any restriction marker."""
    blank = {**ACCESS_BLANKED, "active": False, "pin_configured": False, "cards": []}
    person = age.person_from_raw(_person(**{**blank, **over}))
    assert ag.Worker._revoked(person) is False, over
    assert ag.Worker._revoked(age.person_from_raw(_person(**blank))) is True, "the complete unredacted readback still counts"


# ---------------------------------------------------------------- R3-04: the profile codes are pre-storage refusals (422)

@pytest.mark.parametrize("code, own", [("profile_required", "intercom_profile_required"), ("profile_value_invalid", "intercom_profile_invalid"),
                                       ("profile_value_not_unique", "intercom_profile_not_unique")])
def test_r3_04_profile_codes_are_refusals_with_a_validation_answer(code, own):
    for command in ("users/create", "users/update", "users/archive", "users/unarchive", "users/set_active", "users/temporary_cancel", "cards/add",
                    "cards/remove", "cards/capture_confirm"):
        assert intercom_client.refusal_is_pre_device(command, code), (command, code)
    assert not intercom_client.refusal_is_pre_device("users/delete", code), "the delete keeps its own, smaller table"
    err = intercom_sync.action_error({"state": "error", "last_error": code}, "refused", "config")
    assert (err.status, err.code, err.details["outcome"]) == (422, own, "refused")


def test_r3_04_the_helper_name_is_not_a_wire_code():
    assert not intercom_client.refusal_is_pre_device("users/update", "profile_issue")
    frame = {"success": False, "error": {"code": "profile_issue"}}
    with pytest.raises(UnclearAnswer):
        intercom_client._action_result(frame, "users/update")
    with pytest.raises(IntercomError) as e:
        intercom_client._action_result({"success": False, "error": {"code": "profile_required"}}, "users/update")
    assert e.value.code == "profile_required"


# ---------------------------------------------------------------- R3-08: strict boolean success on reads

def _call(frame: Any):
    async def call(_type: str, **_kw: Any) -> Any:
        return frame
    return call


@pytest.mark.parametrize("frame", [{"success": 1, "result": {"id": "u1", "revision": 1}}, {"success": "yes", "result": {"id": "u1"}},
                                   {"result": {"id": "u1"}}, {"success": None, "result": {}}, "not a frame"])
def test_r3_08_a_truthy_non_boolean_success_is_never_a_read_result(frame):
    with pytest.raises(IntercomError) as e:
        asyncio.run(intercom_client.users_get(_call(frame), "u1"))
    assert e.value.code == "invalid_response"
    with pytest.raises(IntercomError) as e:
        asyncio.run(intercom_adapter.users_get(_call(frame), "u1"))
    assert e.value.code == "invalid_response"


def test_r3_08_boolean_success_and_failure_still_read_as_before():
    assert asyncio.run(intercom_client.users_get(_call({"success": True, "result": {"id": "u1"}}), "u1")) == {"id": "u1"}
    with pytest.raises(IntercomError) as e:
        asyncio.run(intercom_client.users_get(_call({"success": False, "error": {"code": "user_not_found"}}), "u1"))
    assert e.value.code == "user_not_found"


def test_r3_08_a_committed_write_whose_answer_cannot_be_used_is_unknown_never_refused():
    f: Future = Future()
    f.set_result("not a person")
    assert intercom_sync._late_outcome(f, intercom_writes_project) == ("unknown", "invalid_response")


def intercom_writes_project(raw: Any) -> dict[str, Any]:
    return iw.project_editor(raw)


# ---------------------------------------------------------------- R3-06: fresh readback before any retry; late results reconciled

@pytest.fixture()
def sync():
    return intercom_sync.IntercomSync()


def test_r3_06_no_write_to_the_target_until_a_read_sent_after_the_call_answered(sync):
    target = intercom_sync.person_target("u1")
    seen: list[dict[str, Any]] = []
    f: Future = Future()
    sync._follow_unknown(f, "person", "config", iw.project_editor, target, True, seen.append)
    assert sync.write_gate(target) == "outcome_pending" and sync.write_gate(intercom_sync.person_target("u2")) is None
    early = sync._tick()
    sync.note_readback(target, early)
    assert sync.write_gate(target) == "outcome_pending", "a read while the write is still out settles nothing"
    f.set_result(_person())  # WisKey saved it after all - after this side's 35 s
    assert sync.write_gate(target) == "readback_required"
    sync.note_readback(target, early)
    assert sync.write_gate(target) == "readback_required", "a read sent before the call was over settles nothing either"
    late = sync.late_results()[-1]
    assert (late["key"], late["lane"], late["target"], late["outcome"], late["code"]) == ("person", "config", target, "ok", None)
    assert seen and seen[-1]["outcome"] == "ok"
    sync.note_readback(target, sync._tick())
    assert sync.write_gate(target) is None


def test_r3_06_an_unknown_answered_in_time_needs_only_the_readback(sync):
    target = intercom_sync.person_target("u3")
    f: Future = Future()
    f.set_exception(UnclearAnswer("users/update", "storage_write_failed"))
    sync._follow_unknown(f, "person", "config", iw.project_editor, target, False, None)
    assert sync.write_gate(target) == "readback_required" and sync.late_results() == [], "not a late answer: nothing to classify"
    sync.note_readback(target, sync._tick())
    assert sync.write_gate(target) is None


@pytest.mark.parametrize("exc, expected", [
    (IntercomError("revision_conflict", "users/update"), ("refused", "revision_conflict")),
    (UnclearAnswer("users/update", "manager_closed"), ("unknown", "manager_closed")),
    (ConnectionResetError(), ("unknown", "ConnectionResetError")),
])
def test_r3_06_late_answers_are_classified_like_answers_in_time(exc, expected):
    f: Future = Future()
    f.set_exception(exc)
    assert intercom_sync._late_outcome(f, iw.project_editor) == expected
    g: Future = Future()
    g.cancel()
    assert intercom_sync._late_outcome(g, iw.project_editor) == ("unknown", "cancelled")


def test_r3_06_the_refusal_says_not_sent_and_reload():
    for code in intercom_sync.UNSETTLED_CODES:
        err = intercom_sync.action_error({"state": "error", "last_error": code}, "not_sent", "config")
        assert (err.status, err.code, err.details["outcome"], err.details["wiskey_code"]) == (409, "intercom_outcome_pending", "not_sent", code)
        assert "טענו מחדש" in err.user_message
        assert WiskeyServiceEngine._map(err).kind == "not_sent", "the grants engine reads it as nothing sent - retried by a later pass"


def test_r3_06_the_engine_refuses_to_decide_on_a_read_while_its_write_is_out(monkeypatch):
    monkeypatch.setattr(ag, "GO_LIVE_PERMITTED", True)
    target = intercom_sync.person_target("wk-1")
    f: Future = Future()
    try:
        intercom_sync.SYNC._follow_unknown(f, "person", "config", age.person_from_raw_dict, target, True, None)
        with pytest.raises(EngineError) as e:
            WiskeyServiceEngine(settings=None).get_person("wk-1")
        assert (e.value.kind, e.value.code) == ("not_sent", "outcome_pending")
    finally:
        f.cancel()
        intercom_sync.SYNC.reset()


def test_r3_06_a_user_not_found_answer_is_a_readback_too(sync, monkeypatch):
    """After an unknown delete, WisKey's `user_not_found` on the fresh read is an answer about the person (gone, or out of scope)."""
    target = intercom_sync.person_target("u4")
    f: Future = Future()
    f.set_exception(UnclearAnswer("users/delete", "manager_closed"))
    sync._follow_unknown(f, "deleted", "config", intercom_sync.project_accepted, target, False, None)

    def refuse(*_a: Any, **_kw: Any) -> Any:
        raise ApiError(404, "intercom_person_not_found", "x", details={"wiskey_code": "user_not_found"})

    monkeypatch.setattr(sync, "_execute", refuse)
    with pytest.raises(ApiError):
        sync.command(None, "person", lambda call: None, lambda raw: raw, target=target)  # type: ignore[arg-type]
    assert sync.write_gate(target) is None
