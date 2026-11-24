"""ADR019-FAMILY2-2500: ADR-019 (one field-error envelope, L2) Step 1 for family 2 - presence and mobile.

* `services/presence.py` and `services/mobile_push.py` raise `errors.field_error()` (with `cls=PresenceError` where the presence router
  catches that class): `details.fields` next to the legacy `details.field` and the endpoint's own keys (`known`, `client_event_id`,
  `sensor`, `contract_version`); the contract v2.2 strict value refusal adds `problems` (`{field, code: <reason>}`).
* the 400 refusals of the phone-app routes that name a field (`invalid_name`, `invalid_platform`, `invalid_event`, ...) carry the same
  canonical keys (D1: "422, and the few 400 / 409 refusals that name a field"); statuses and envelope codes are unchanged.
The API tests of the family routes assert `details.fields` in their own files (presence, presence contract v2.2, WHOIN034, mobile push).
No app is started here: the service helpers the routes call are exercised directly."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from smplwise.errors import ApiError, field_error
from smplwise.services import mobile_push
from smplwise.services import presence as svc
from smplwise.services import presence_values as pv

REPO = Path(__file__).resolve().parents[3]


def _inventory():
    spec = importlib.util.spec_from_file_location("error_contract_inventory", REPO / "scripts" / "error_contract_inventory.py")
    m = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(m)
    return m


def test_field_error_builds_the_familys_own_class():
    e = field_error("x", ["name"], code="invalid_name", status=400, cls=svc.PresenceError, legacy={"field": "name"})
    assert type(e) is svc.PresenceError and isinstance(e, ApiError)
    assert (e.status, e.code, e.details) == (400, "invalid_name", {"field": "name", "fields": ["name"]})
    assert type(field_error("x", ["a"])) is ApiError  # the default stays ApiError


def test_family_two_has_no_legacy_only_field_refusal_left():
    """Every presence / mobile refusal the scan reads that names a field carries the canonical `fields` (the legacy key rides along)."""
    inv = _inventory()
    err = inv.scan_errors(REPO / "smplwise_vms" / "backend" / "smplwise")
    left = [f'{s["module"]}:{s["line"]}' for s in err["sites"]
            if inv.family_of(s["module"]) in {"presence", "mobile"} and isinstance(s["details"], list) and "field" in s["details"]
            and "fields" not in s["details"]]
    assert left == []


def _raises(fn, *args):
    with pytest.raises(svc.PresenceError) as ex:
        fn(*args)
    return ex.value


def test_settings_refusals_keep_field_and_add_fields():
    e = _raises(svc._validate_sites, [{"id": "x", "lat": 95, "lon": 0}])
    assert (e.status, e.code, e.details) == (422, "validation", {"field": "sites", "fields": ["sites"]})
    e = _raises(svc._validate_beacons, None, [{"uuid": "bad", "site_id": "s"}], {"s"})
    assert e.details == {"field": "beacons.uuid", "fields": ["beacons.uuid"]}
    with pytest.raises(svc.PresenceError) as ex:
        svc._normalize_required({"sensors": ["microphone"]}, strict=True)
    assert ex.value.details == {"field": "required_sensors.sensors", "fields": ["required_sensors.sensors"]}


def test_people_refusals_name_the_people_path():
    with pytest.raises(svc.PresenceError) as ex:
        svc._normalize_people({"colour": 1}, strict=True)
    assert ex.value.details == {"field": "people.colour", "fields": ["people.colour"]}
    with pytest.raises(svc.PresenceError) as ex:
        svc._normalize_people("x", strict=True)
    assert ex.value.details == {"field": "people.*", "fields": ["people"]}  # the whole object: the canonical name is `people`


def test_device_refusals_400_keep_their_codes():
    e = _raises(svc.clean_name, "א")
    assert (e.status, e.code, e.details) == (400, "invalid_name", {"field": "name", "fields": ["name"]})
    st = {"sensors_allowed": ["location", "battery"], "value_check": "off"}
    with pytest.raises(svc.PresenceError) as ex:
        svc._validate_event({"client_event_id": "c1", "type": "fix", "at": "2026-10-05T10:00:00Z", "lat": 95, "lon": 0}, st)
    assert (ex.value.status, ex.value.code) == (400, "invalid_event")
    assert ex.value.details == {"field": "lat/lon", "client_event_id": "c1", "fields": ["lat", "lon"]}
    with pytest.raises(svc.PresenceError) as ex:
        svc._validate_event({"client_event_id": "c2", "type": "teleport", "at": "2026-10-05T10:00:00Z"}, st)
    assert ex.value.details == {"field": "type", "client_event_id": "c2", "fields": ["type"]}


def test_strict_value_refusal_adds_problems_and_keeps_the_v22_keys():
    found = pv.problems("battery", {"level_percent": 50, "charging_state": "sideways"})
    assert found, "the fixture value must be refused by the v2.2 table"
    key, reason = found[0]
    with pytest.raises(svc.PresenceError) as ex:
        svc._check_value("battery", {"level_percent": 50, "charging_state": "sideways"}, "strict", "s1")
    field = f"value.{key}"
    assert (ex.value.status, ex.value.code) == (400, "invalid_event")
    assert ex.value.details == {"field": field, "reason": reason, "sensor": "battery", "client_event_id": "s1", "contract_version": pv.CONTRACT_VERSION,
                                "fields": [field], "problems": [{"field": field, "code": reason}]}


def test_mobile_push_refusals():
    with pytest.raises(ApiError) as ex:
        mobile_push.register(None, {"id": "d"}, "windows", "rt_0123456789abcdef0123", None)  # type: ignore[arg-type]
    assert (ex.value.status, ex.value.code, ex.value.details) == (400, "invalid_platform", {"field": "platform", "fields": ["platform"]})
    with pytest.raises(ApiError) as ex:
        mobile_push.set_muted(None, {"id": "d"}, ["spam"])  # type: ignore[arg-type]
    assert ex.value.status == 422 and ex.value.details["fields"] == ["muted"] and ex.value.details["field"] == "muted" and "known" in ex.value.details
