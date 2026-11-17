"""CR-PERSON-PROJECTION-2440 (code review 02:P2-7): the two projections of one WisKey person record, held together key by key.

`intercom_sync.project_person` (the read people view, the base of the editor) and `intercom_adapter.project_person` (the closed
superset every read uses) take the record's containers from ONE reader, `intercom_sync.person_fields`. Their value rules differ on
purpose (the superset validates and clips, the people view shows what WisKey sent and marks it), so this file does not demand equal
outputs: it gives EVERY key either of them emits a rule - the same value in both, a stated relation, or deliberately on one side -
and fails when a key appears that has no rule (`test_every_key_is_classified`). A field one projection learns to read can then no
longer be silently missing in the other (`permission_overrides` once, tests/test_permovr_293.py).

Pure functions over fixture records: no WisKey, Home Assistant, station, door or lock."""
from __future__ import annotations

from typing import Any

import pytest

from smplwise.services import intercom_adapter, intercom_sync
from smplwise.services import intercom_authority as ia

_ROW = {"enabled": True, "allowed_locks": [1], "desired_revision": 4, "applied_revision": 4, "sync_state": "synced"}
_OFF = {"enabled": False, "allowed_locks": [2], "desired_revision": None, "applied_revision": None, "sync_state": "pending"}


def _raw(**over: Any) -> dict[str, Any]:
    base = {"id": "u1", "revision": 4, "display_name": "Dana", "employee_no": "E-7", "active": True, "group_ids": ["g1"],
            "permission_overrides": {}, "pin_configured": False, "assignments": {"st-a": dict(_ROW)}}
    return {**base, **over}


def _without(*keys: str, **over: Any) -> dict[str, Any]:
    raw = _raw(**over)
    for key in keys:
        raw.pop(key)
    return raw


# The fixture set: well formed, minimal, every redaction marker, absent and malformed containers. Scalar values stay inside WisKey's
# contract (the out-of-contract scalars have their own test at the end: there the two differ by design).
RECORDS: dict[str, dict[str, Any]] = {
    "well formed": _raw(),
    "minimal": {"id": "u2", "revision": 1},
    "two stations, one off": _raw(assignments={"st-a": dict(_ROW), "st-b": dict(_OFF)}),
    "both doors": _raw(assignments={"st-a": {**_ROW, "allowed_locks": [2, 1]}}),
    "no stations": _raw(assignments={}),
    "full record": _raw(valid_from="2026-01-01T00:00:00Z", valid_until="2026-12-31T00:00:00Z", access_category="visitor", user_type="normal",
                        identity_locked=True, phone="050-0000000", photo_configured=True, profile={"company": "Acme"}, archived_at=None,
                        responsible_person="u9", access_purpose="delivery", permission_overrides={"st-c": "deny", "st-a": "allow"},
                        cards=[{"id": "c1", "masked_number": "****1234", "label": "blue", "card_type": "normalCard", "enabled": True}],
                        pin_configured=True),
    "archived, inactive": _raw(active=False, archived_at="2026-05-01T00:00:00Z"),
    "no employee number": _without("employee_no"),
    "restricted, nothing withheld": _raw(redacted_fields=[], operator_editable=True),
    "restricted, not editable": _raw(operator_editable=False),
    "access withheld": _raw(redacted_fields=["access"], operator_editable=True, valid_from="2026-01-01T00:00:00Z", access_category="staff"),
    "assignments withheld by field name": _raw(redacted_fields=["assignments"]),
    "groups withheld by field name": _raw(redacted_fields=["group_ids"]),
    "overrides withheld by field name": _raw(redacted_fields=["permission_overrides"], permission_overrides={"st-c": "deny"}),
    "credentials withheld": _raw(redacted_fields=["credentials"]),
    "pin withheld by field name": _raw(redacted_fields=["pin_configured"]),
    "phone withheld": _raw(redacted_fields=["phone"], phone=""),
    "photo and profile withheld": _raw(redacted_fields=["photo", "profile"]),
    "marker is not a list": _raw(redacted_fields="access"),
    "marker holds a non-string": _raw(redacted_fields=["phone", 3]),
    "assignments absent": _without("assignments"),
    "assignments not a map": _raw(assignments=["st-a"]),
    "a row that is not an object": _raw(assignments={"st-a": dict(_ROW), "st-b": "enabled"}),
    "a row with an unsupported relay": _raw(assignments={"st-a": {**_ROW, "allowed_locks": [1, 3]}}),
    "a row with an unknown sync state": _raw(assignments={"st-a": {**_ROW, "sync_state": "teleporting"}}),
    "a station id Arx will not evaluate": _raw(assignments={"st-a": dict(_ROW), "x" * (ia.MAX_ID + 1): dict(_ROW)}),
    "groups absent": _without("group_ids"),
    "groups not a list": _raw(group_ids="g1"),
    "a group entry that is not an id": _raw(group_ids=["g1", " ", 7]),
    "overrides absent": _without("permission_overrides"),
    "overrides not a map": _raw(permission_overrides=["st-c"]),
    "an override with an unknown value": _raw(permission_overrides={"st-c": "maybe", "st-a": "allow"}),
    "cards not a list, profile not a map": _raw(cards="c1", profile="x"),
    "active missing": _without("active"),
    "revision zero": _raw(revision=0),
}

# ---------------------------------------------------------------- the rule of every key

# the same value in both projections
SAME = {"id", "display_name", "active", "valid_from", "valid_until", "revision", "access_category", "redacted_fields", "operator_editable"}
# in both, held by a stated relation (the functions below)
RELATED = {"employee_no", "group_ids", "access_known", "stations_known"}
# only in the read people view: the superset carries the same rows as `assignments` (compared row by row below)
READ_ONLY = {"stations"}
# only in the closed superset: the people view deliberately never shows these (its docstring: never phones, cards, PIN flags,
# profile values or photos), or has no use for them
SUPERSET_ONLY = {"archived", "user_type", "identity_locked", "assignments", "override_stations", "timing", "phone", "phone_set",
                 "credentials", "photo_configured", "profile", "responsible_person", "access_purpose"}
# what the editor adds on top of the read people view
EDITOR_ADDS = {"phone", "identity_locked", "pin_configured", "credentials_known", "cards", "permission_overrides", "has_timing"}

CASES = pytest.mark.parametrize("raw", list(RECORDS.values()), ids=list(RECORDS))


def _pair(raw: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    read, superset = intercom_sync.project_person(raw), intercom_adapter.project_person(raw)
    assert superset is not None
    return read, superset


def _keepable(raw: dict[str, Any]) -> bool:
    """Every assignment row is one the superset keeps (an object under a station id Arx evaluates)."""
    rows = raw.get("assignments")
    return isinstance(rows, dict) and all(isinstance(a, dict) and ia.valid_id(sid) for sid, a in rows.items())


def test_every_key_is_classified():
    read_keys: set[str] = set()
    superset_keys: set[str] = set()
    for raw in RECORDS.values():
        read, superset = _pair(raw)
        read_keys |= set(read)
        superset_keys |= set(superset)
    assert not (SAME & RELATED) and not ((SAME | RELATED) & (READ_ONLY | SUPERSET_ONLY))
    assert read_keys == SAME | RELATED | READ_ONLY, "a key of the read people view without a parity rule (add it to one of the sets above)"
    assert superset_keys == SAME | RELATED | SUPERSET_ONLY, "a key of the closed superset without a parity rule"


@CASES
def test_the_shape_does_not_depend_on_the_record(raw):
    read, superset = _pair(raw)
    assert set(read) == SAME | RELATED | READ_ONLY
    assert set(superset) == SAME | RELATED | SUPERSET_ONLY


@CASES
def test_same_keys_have_the_same_value(raw):
    read, superset = _pair(raw)
    assert {k: read[k] for k in SAME} == {k: superset[k] for k in SAME}


@CASES
def test_related_keys_keep_their_relation(raw):
    read, superset = _pair(raw)
    # the people view answers "" for a missing text, the superset null
    assert read["employee_no"] == (superset["employee_no"] or "")
    # the superset withholds the groups with the access category (null) and keeps only valid ids; the people view shows what was sent
    if superset["group_ids"] is None:
        assert intercom_sync.person_scope(raw)["access_readable"] is False
    else:
        assert superset["group_ids"] == [g for g in read["group_ids"] if intercom_adapter._id(g)]
    # the superset never claims more than the people view, and less only when it had to drop a row
    for key in ("access_known", "stations_known"):
        assert superset[key] is (read[key] and _keepable(raw)), key


@CASES
def test_stations_and_assignments_are_the_same_rows(raw):
    read, superset = _pair(raw)
    if superset["assignments"] is None:  # withheld, absent or not a map: unknown, never "none"
        assert superset["access_known"] is False and superset["stations_known"] is False
        return
    stations = {s["station_id"]: s for s in read["stations"]}
    assert [a["station_id"] for a in superset["assignments"]] == [sid for sid in sorted(stations) if ia.valid_id(sid)]
    for row in superset["assignments"]:
        station = stations[row["station_id"]]
        assert row["enabled"] is station["enabled"]
        assert row["doors"] == [d for d in station["doors"] if d in (1, 2)]  # the superset keeps doors 1 / 2 only
        assert row["sync_state"] == intercom_adapter._enum(station["sync_state"], intercom_adapter.ASSIGNMENT_SYNC_STATES)


@CASES
def test_the_editor_is_the_people_view_plus_its_own_fields(raw):
    if intercom_sync._int(raw.get("revision")) is None:
        return
    read, superset = _pair(raw)
    editor = intercom_sync.project_person_editor(raw)
    assert set(editor) == set(read) | EDITOR_ADDS
    assert {k: editor[k] for k in set(read) - {"stations"}} == {k: read[k] for k in set(read) - {"stations"}}
    assert [{k: s[k] for k in station} for s, station in zip(editor["stations"], read["stations"], strict=True)] == read["stations"]
    # the earlier drift (PERMOVR-293): whenever the superset knows the override stations, they are the editor's overrides
    if superset["override_stations"] is not None:
        assert sorted(editor["permission_overrides"]) == superset["override_stations"]
    assert editor["identity_locked"] is superset["identity_locked"]


# ---------------------------------------------------------------- the one reader


def test_person_fields_keeps_absent_apart_from_empty():
    empty = intercom_sync.person_fields({"assignments": {}, "group_ids": [], "permission_overrides": {}, "cards": [], "profile": {}})
    assert (empty["assignments"], empty["group_ids"], empty["permission_overrides"], empty["cards"], empty["profile"]) == ({}, [], {}, [], {})
    for raw in ({}, {"assignments": [], "group_ids": {}, "permission_overrides": "x", "cards": {}, "profile": []}, None, "person"):
        fields = intercom_sync.person_fields(raw)
        assert {k: v for k, v in fields.items() if k != "scope"} == dict.fromkeys(("assignments", "group_ids", "permission_overrides", "cards", "profile"))
        assert fields["scope"] == intercom_sync.person_scope(raw)


def test_person_fields_hands_out_the_records_own_containers():
    raw = _raw(cards=[], profile={})
    fields = intercom_sync.person_fields(raw)
    assert set(fields) == {"scope", "assignments", "group_ids", "permission_overrides", "cards", "profile"}
    assert all(fields[k] is raw[k] for k in fields if k != "scope")


# ---------------------------------------------------------------- what stays per projection, on purpose


def test_out_of_contract_scalars_differ_by_design():
    """Pinned so a later "unification" of the value rules is a decision, not an accident: the superset is closed (unknown enum ->
    "unknown", an over-long or control-character text -> null), the people view shows what WisKey sent or null."""
    read, superset = _pair(_raw(access_category="vip", display_name="D" * 200, employee_no="E\n7"))
    assert (read["access_category"], superset["access_category"]) == (None, intercom_adapter.UNKNOWN)
    assert (read["display_name"], superset["display_name"]) == ("D" * 200, "")
    assert (read["employee_no"], superset["employee_no"]) == ("E\n7", None)
