"""WIRE-DRIFT-2550: four "response contract drift" errors the lab logged on 2.53.0 (smplwise.wire), each a model that did not describe
what its route really answers. The answers went out unchanged (production falls back to the route's dict); under SW_WIRE_STRICT=1 (the
backend tests) each payload below was refused before the fix:

1. AccessControlReadsStationsStationZone - a device zone carries `standard`, `delta`, `start`, `end` (undeclared keys);
2. AccessControlReadsEventsEventsRecord - `door` is null when WisKey names no door (int_type);
3. AccessControlReadsPeoplePeopleRecord - `valid_until` is null for a person without an end date (string_type);
4. WiskeyValidationRun - `finished_at` is null while the run is running (string_type).

The payloads are built by the real projections (WisKey's rc37 fixtures through services/intercom_adapter + the authority views, the
validation run through services/wiskey_live_validation on its own migration), with the null / unknown cases the lab hit."""
from __future__ import annotations

import copy
import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from smplwise.rbac import Principal
from smplwise.services import intercom_adapter as adapter
from smplwise.services import intercom_authority as ia
from smplwise.services import wiskey_live_validation as lv
from smplwise.wire import access_control_reads as W
from smplwise.wire import wiskey_validation as V

HERE = Path(__file__).resolve().parent
RC37 = HERE / "fixtures" / "wiskey_rc37"
MIGRATION = HERE.parent / "smplwise" / "migrations" / "0199_wiskey_live_validation.sql"


@pytest.fixture(autouse=True)
def _strict(monkeypatch):
    monkeypatch.setenv("SW_WIRE_STRICT", "1")  # drift raises (conftest sets it too; explicit here because the test is about it)


def _fixture(name: str) -> Any:
    return json.loads((RC37 / name).read_text(encoding="utf-8"))


class _Admin:
    """An authority that sees everything at the sensitive level (the views' field rules, no database)."""

    def unrestricted(self, permission: str) -> bool:
        return True

    def station_level(self, station_id: Any) -> str:
        return ia.TECHNICAL

    def person_level(self, ids: Any) -> str:
        return ia.SENSITIVE

    def employee_no_for(self, level: str) -> bool:
        return True

    def station(self, permission: str, station_id: Any) -> bool:
        return True

    def sync_errors(self, station_id: Any) -> bool:
        return True

    def person_editable(self, ids: Any) -> bool:
        return True

    def event_level(self, station_id: Any) -> str:
        return ia.SENSITIVE

    def event_portrait(self, station_id: Any) -> bool:
        return True


# ---------------------------------------------------------------- 1. the station clock's display zone


DEVICE_ZONE_DST = {"kind": "device", "name": "IST-2:00:00DST01:00:00,M3.4.4/26:00:00,M10.5.0/02:00:00",
                   "standard": 7200, "delta": 3600, "start": [3, 4, 4, 93600], "end": [10, 5, 0, 7200]}
DEVICE_ZONE_PLAIN = {"kind": "device", "name": "UTC+00:00:00", "standard": 0, "delta": 0, "start": None, "end": None}


@pytest.mark.parametrize("zone", [DEVICE_ZONE_DST, DEVICE_ZONE_PLAIN], ids=["dst", "no-dst"])
def test_a_device_zone_is_declared_key_for_key(zone):
    """WisKey's clock.device_zone() shape (seconds, `[month, week, weekday, second]` rules, null without DST)."""
    model = W.AccessControlReadsStationsStationZone.model_validate(zone)
    assert model.model_dump(exclude_unset=True) == zone


def test_an_iana_zone_stays_two_keys():
    zone = {"kind": "iana", "name": "Asia/Jerusalem"}
    assert W.AccessControlReadsStationsStationZone.model_validate(zone).model_dump(exclude_unset=True) == zone  # no null placeholders


def test_the_station_list_with_a_device_zone_validates():
    overview = _fixture("overview.json")
    station = copy.deepcopy(overview["stations"][0])
    station.setdefault("clock", {})["zone"] = DEVICE_ZONE_DST
    view = ia.view_station(_Admin(), {**adapter.intercom_sync._station(station), "technical": None})
    assert view is not None and view["zone"] == DEVICE_ZONE_DST
    W.AccessControlReadsStationsStation.model_validate(view)


# ---------------------------------------------------------------- 2. an event without a door


def _event(raw_patch: dict[str, Any]) -> dict[str, Any]:
    raw = {**copy.deepcopy(_fixture("events_list.json")["records"][0]), **raw_patch}
    event = adapter.project_event(raw)
    assert event is not None
    return event


@pytest.mark.parametrize("door", [None, 0, 3, "1"], ids=["absent", "zero", "out-of-range", "text"])
def test_an_event_row_without_a_known_door_validates(door):
    """A ring / station-level event has no door; any value other than 1 or 2 is projected to null (never a string)."""
    view = ia.view_event(_Admin(), _event({"event_type": "ring", "door": door}))
    assert view is not None and view["door"] is None
    W.AccessControlReadsEventsEventsRecord.model_validate(view)


def test_an_event_row_keeps_unknown_times_and_source_null():
    view = ia.view_event(_Admin(), _event({"timestamp": None, "received_at": "not a time" * 10, "time_source": None, "door": None}))
    assert view is not None and view["timestamp"] is None and view["received_at"] is None and view["time_source"] is None
    W.AccessControlReadsEventsEventsRecord.model_validate(view)


def test_the_event_detail_without_a_door_validates():
    detail = copy.deepcopy(_fixture("events_detail.json"))
    detail["record"].update({"door": None, "person_name": None, "employee_no": None})
    event = adapter.project_event_detail(detail)
    view = ia.view_event(_Admin(), event, detail=True)
    view.pop("portrait", None)  # as IntercomAdapter.event_detail: the detail read carries no picture reference (rc.37)
    assert view is not None and view["door"] is None and view["person_name"] is None
    W.AccessControlReadsEventDetailEvent.model_validate(view)


# ---------------------------------------------------------------- 3. a person without an end date


def _person(raw_patch: dict[str, Any]) -> dict[str, Any]:
    raw = {**copy.deepcopy(_fixture("users_query.json")["records"][0]), **raw_patch}
    person = adapter.project_person(raw)
    assert person is not None
    return person


def test_a_people_row_without_an_end_date_validates():
    view = ia.view_person(_Admin(), _person({"valid_until": None}), detail=False)
    assert view is not None and view["valid_until"] is None
    W.AccessControlReadsPeoplePeopleRecord.model_validate(view)


def test_a_people_row_keeps_unknown_category_type_and_revision_null():
    view = ia.view_person(_Admin(), _person({"valid_until": None, "user_type": "visitor-2099", "revision": None}), detail=False)
    assert view is not None and view["revision"] is None
    W.AccessControlReadsPeoplePeopleRecord.model_validate(view)


def test_one_person_without_an_end_date_or_a_sync_time_validates():
    raw = copy.deepcopy(_fixture("users_query.json")["records"][0])
    raw["valid_until"] = None
    raw["employee_no"] = None
    raw["assignments"]["entry-a"]["last_sync_at"] = None  # never synced yet
    view = ia.view_person(_Admin(), _person(raw), detail=True)
    assert view is not None and view["valid_until"] is None and view["employee_no"] is None
    assert any(s["last_sync_at"] is None for s in view["stations"])
    assert set(view["profile"]) == {"department", "id_number"}  # the administrator's own fields (rc37), not a fixed set
    W.AccessControlReadsPersonPerson.model_validate(view)


# ---------------------------------------------------------------- 4. a validation run that is still running


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(MIGRATION.read_text(encoding="utf-8"))
    return conn


def test_a_running_validation_run_validates():
    conn = _db()
    actor = Principal(user_id="dev-joni", username="", display_name="", source="dev")  # no name: created_by_name is NULL
    rid = lv.create_run(conn, kind="checks", scope="one", stations=[("entry-a", "")], actor=actor, checks=("identity", "door_read"))
    lv.create_run(conn, kind="pulse", scope="one", stations=[("entry-a", "")], actor=actor, parent_run_id=rid, checks=("pulse",))
    view = lv.run_view(conn, rid)
    assert view is not None and view["state"] == "running" and view["finished_at"] is None and view["created_by_name"] is None
    assert view["stations"][0]["name"] is None and view["pulses"] and view["pulses"][0]["finished_at"] is None
    V.WiskeyValidationRun.model_validate(view)
    for run in lv.list_runs(conn):
        V.WiskeyValidationOverviewRun.model_validate(run)


def test_a_finished_validation_run_still_validates():
    conn = _db()
    actor = Principal(user_id="dev-joni", username="joni", display_name="Joni", source="dev")
    rid = lv.create_run(conn, kind="checks", scope="one", stations=[("entry-a", "Entry A")], actor=actor, checks=("identity",))
    lv.finish_run(conn, rid, "interrupted")
    view = lv.run_view(conn, rid)
    assert view is not None and isinstance(view["finished_at"], str)
    V.WiskeyValidationRun.model_validate(view)
