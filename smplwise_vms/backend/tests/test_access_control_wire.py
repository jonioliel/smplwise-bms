"""CR-036 S8 / S10: the wire shapes the native screens are built on.

The screens (entry log, Settings status page and groups view) are tested in Playwright against a MOCKED backend whose answers come from
`frontend/tests/fixtures/access_control_wire.json` (frontend/tests/access-control-mocks.ts). A mock that quietly drifts from the server would
prove nothing, so this test asks the REAL typed endpoints (routers/access_control_reads.py, over the add-on's live service session against the
fake WisKey of tests/fake_wiskey.py - nothing here contacts a device, a station, Home Assistant or WisKey) and checks that every reply in the
fixture has exactly the keys and value types the server produces:

- dict keys must be the same set (a key the server stopped sending, or one the mock invents, fails);
- a scalar must have the same type (string / number / bool); a `null` in either side stands for "any scalar" (optional values are null in
  one reply and set in another), an empty list matches any list;
- the dicts whose KEYS are data, not schema (a station id, a sync state, an error code), are compared by the shape of their values.

The fixture's INVENTED values (names, stations, times) are not compared - only the shape.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import pytest
from intercom_station_scope import station_scope  # noqa: F401 - a fixture
from test_intercom_adapter import ac, get  # noqa: F401 - ac is a fixture

from smplwise.services import intercom_adapter

FIXTURE = Path(__file__).resolve().parents[3] / "frontend" / "tests" / "fixtures" / "access_control_wire.json"

# paths (dotted, from the top of a reply) whose dict KEYS are data: compared by the merged shape of their values
FREE_KEYS = {
    "events.stations",  # station id -> {stream, history}
    "alerts.station_thresholds_seconds",  # station id -> {offline, sync_stalled, event_gap}
    "health.access.assignment_states",  # sync state -> count
    "health.access.errors",  # error code -> count
}

# fixture key -> (endpoint, query) of the real reply it stands for
ENDPOINTS: dict[str, tuple[str, dict[str, Any]]] = {
    "features": ("/features", {}),
    "stations": ("/stations", {}),
    "events": ("/events", {"limit": 3}),
    "event_detail": ("/events/ev-7", {}),
    "status_stations": ("/status/stations", {}),
    "health": ("/stations/entry-a/health", {}),
    "health_history": ("/stations/entry-a/health/history", {}),
    "status_sync": ("/status/sync", {}),
    "status_conflicts": ("/status/conflicts", {}),
    "status_alerts": ("/status/alerts", {}),
    "status_audit": ("/status/audit", {}),
    "groups": ("/groups", {}),
    "group_versions": ("/groups/versions", {}),
    # CR-036 S9: the schedules screen (per station: door programs, public-code presence; installation-wide: library, proposals, checks)
    "programs": ("/stations/entry-a/programs", {}),
    "codes": ("/stations/entry-a/codes", {}),
    "schedules_library": ("/schedules", {}),
    "schedules_plans": ("/schedules/plans", {}),
    "schedules_operations": ("/schedules/operations", {}),
}


def shape(value: Any, path: str = "") -> Any:
    if value is None:
        return "any"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return ["empty"] if not value else [merge_all([shape(v, path) for v in value])]
    if isinstance(value, dict):
        if path in FREE_KEYS:
            return {"*": merge_all([shape(v, path + ".*") for v in value.values()]) if value else "any"}
        return {k: shape(v, f"{path}.{k}" if path else k) for k, v in value.items()}
    raise AssertionError(f"not JSON: {type(value)}")


def merge2(a: Any, b: Any) -> Any:
    if a == "any":
        return b
    if b == "any":
        return a
    if a == ["empty"]:
        return b
    if b == ["empty"]:
        return a
    if isinstance(a, dict) and isinstance(b, dict):
        return {k: merge2(a[k], b[k]) if k in a and k in b else a.get(k, b.get(k)) for k in {**a, **b}}
    if isinstance(a, list) and isinstance(b, list):
        return [merge2(a[0], b[0])]
    return a if a == b else "|".join(sorted(set(str(a).split("|")) | set(str(b).split("|"))))


def merge_all(items: list[Any]) -> Any:
    out = items[0]
    for item in items[1:]:
        out = merge2(out, item)
    return out


def mismatches(real: Any, mock: Any, path: str = "") -> list[str]:
    """Differences between two shapes ("any" matches anything, an empty list matches any list)."""
    if real == "any" or mock == "any":
        return []
    if isinstance(real, dict) and isinstance(mock, dict):
        if set(real) != set(mock):
            return [f"{path or '<root>'}: keys differ - only in the server: {sorted(set(real) - set(mock))}, only in the mock: {sorted(set(mock) - set(real))}"]
        return [m for k in real for m in mismatches(real[k], mock[k], f"{path}.{k}" if path else k)]
    if isinstance(real, list) and isinstance(mock, list):
        if real == ["empty"] or mock == ["empty"]:
            return []
        return mismatches(real[0], mock[0], path + "[]")
    return [] if real == mock else [f"{path}: the server sends {real}, the mock {mock}"]


def read(c: Any, path: str, user: str, **params: Any) -> dict[str, Any]:
    """One typed read, retried while WisKey's own rate limit says wait (the fake models it; a shape test is not a load test)."""
    for _ in range(40):
        r = get(c, path, user, **params)
        assert r.status_code == 200, (path, r.status_code, r.text)
        body = r.json()
        if body.get("last_error") not in ("rate_limited", "busy"):
            return body
        time.sleep(0.25)
    raise AssertionError(f"{path}: still rate limited")


@pytest.fixture(scope="module")
def wire() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.mark.parametrize("name", sorted(ENDPOINTS))
def test_the_mock_reply_has_the_shape_of_the_real_endpoint(ac, wire, name):  # noqa: F811
    _fake, c, _s = ac
    path, params = ENDPOINTS[name]
    real = read(c, path, "root", **params)
    mock = {**wire[name], "sync": wire["sync"]}
    assert real["state"] == "ready", f"{name}: the fake answered {real['state']} ({real['last_error']})"
    problems = mismatches(shape(real), shape(mock))
    assert not problems, f"{name} ({path}) drifted from the server:\n  " + "\n  ".join(problems)


def test_the_mock_events_cover_the_row_variants_the_screen_words(ac, wire):  # noqa: F811
    """The rows the screen has words for (granted / denied / a ring / a door record / an unnamed person / a recovered row) are all in the
    fixture, with the enum values the server's closed projection allows - so the specs exercise real values, not invented ones."""
    rows = wire["events"]["events"]["records"]
    assert {r["result"] for r in rows} <= intercom_adapter.RESULTS
    assert {r["authentication"] for r in rows} <= intercom_adapter.AUTHENTICATIONS
    assert {r["event_type"] for r in rows} <= intercom_adapter.EVENT_TYPES
    assert {r["time_source"] for r in rows} <= intercom_adapter.TIME_SOURCES
    assert {"granted", "denied", "unknown"} == {r["result"] for r in rows}
    assert any(r["event_type"] == "ring" for r in rows) and any(r["person_name"] is None and r["result"] == "denied" for r in rows)
    assert any(r["recovered"] for r in rows) and any(r["portrait"] is True for r in rows) and any(r["portrait"] is False for r in rows)
    assert all(r["door"] in (1, 2, None) for r in rows)
    ev = wire["event_detail"]["event"]["evidence"]
    assert ev["identity_state"] in intercom_adapter.IDENTITY_STATES and ev["origin"] in intercom_adapter.ORIGINS


def test_the_mock_status_enums_are_the_servers(ac, wire):  # noqa: F811
    for item in wire["status_alerts"]["alerts"]["items"]:
        assert item["kind"] in intercom_adapter.ALERT_KINDS and item["severity"] in ("warning", "error")
        assert item["sync_state"] in intercom_adapter.STATION_SYNC_STATES
        if item["suppression"]:
            assert item["suppression"]["reason"] in intercom_adapter.SUPPRESSION_REASONS
    for station in wire["status_sync"]["sync_status"]["stations"]:
        assert station["sync_state"] in intercom_adapter.STATION_SYNC_STATES
        assert set(station["operations"]) == set(intercom_adapter.OPERATION_STATES)
    for record in wire["group_versions"]["versions"]["records"]:
        assert record["action"] in intercom_adapter.VERSION_ACTIONS
    for field in wire["groups"]["groups"]["fields"]:
        assert field["type"] in intercom_adapter.FIELD_TYPES


def test_the_mock_schedule_enums_are_the_servers(ac, wire):  # noqa: F811
    """CR-036 S9: the schedules screen words every state the closed projections allow - the fixture uses only those values, and
    a proposal names its library schedule by id (draft_id), which the projection keeps for exactly that join."""
    for p in wire["programs"]["programs"]["programs"]:
        assert p["execution"]["status"] in intercom_adapter.EXECUTION_STATUSES and p["door"] in (1, 2)
        assert set(p["policy"]["weekly"]) == set(intercom_adapter.WEEKDAYS)
    assert wire["codes"]["codes"]["public_pin_state"] in intercom_adapter.PUBLIC_PIN_STATES
    library_ids = {s["id"] for s in wire["schedules_library"]["schedules"]}
    for plan in wire["schedules_plans"]["schedules"]:
        assert plan["source_state"] in intercom_adapter.PLAN_SOURCE_STATES and plan["draft_id"] in library_ids
        for r in (plan["report"] or {}).get("resources", []):
            assert r["kind"] in intercom_adapter.RESOURCE_KINDS and r["coverage"] in intercom_adapter.COVERAGES and r["state"] in intercom_adapter.RESOURCE_STATES
    plan_ids = {p["id"] for p in wire["schedules_plans"]["schedules"]}
    for job in wire["schedules_operations"]["schedules"]["jobs"]:
        assert job["status"] in intercom_adapter.JOB_STATUSES and job["plan_id"] in plan_ids and job["ownership"] in intercom_adapter.OWNERSHIP
    assert wire["schedules_operations"]["schedules"]["writes_enabled"] is False


def test_the_plan_projection_keeps_the_library_link_and_nothing_personal():
    """S9 added `draft_id` / `draft_revision` to the proposal projection (ids only): a non-id draft id is dropped, the device-user
    counts of the report stay out."""
    raw = [{"id": "p1", "station_id": "entry-a", "draft_id": "sch-1", "draft_revision": 2, "name": "x", "report": {"users": {"state": "complete", "error": None, "read": 412, "explicit": 3}}},
           {"id": "p2", "station_id": "entry-a", "draft_id": "not an id!", "draft_revision": "2"}]
    out = intercom_adapter.project_schedule_plans(raw)
    assert (out[0]["draft_id"], out[0]["draft_revision"]) == ("sch-1", 2)
    assert (out[1]["draft_id"], out[1]["draft_revision"]) == (None, None)
    assert out[0]["report"]["users"] == {"state": "complete", "error": None}


def test_the_mock_error_bodies_are_the_servers(ac, wire):  # noqa: F811
    _fake, c, _s = ac
    real: dict[str, dict[str, Any]] = {}
    r = get(c, "/events", "sara", before="c.forged")
    assert r.status_code == 422 and r.json()["code"] == "intercom_cursor_expired"
    real["cursor_expired"] = r.json()
    r = get(c, "/events/export.csv", "sam")
    assert r.status_code == 422 and r.json()["code"] == "intercom_export_station_required"
    real["export_station_required"] = r.json()
    r = get(c, "/events", "vera")
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    real["forbidden"] = r.json()
    r = None
    for _ in range(40):
        r = get(c, "/events/ev-9/portrait", "root", station_id="entry-c", at="2026-09-27T09:00:00Z")
        if r.status_code != 503:
            break
        time.sleep(0.25)
    assert r is not None and r.status_code == 404 and r.json()["code"] == "intercom_photo_not_found"
    real["photo_not_found"] = r.json()
    for key, body in real.items():
        mock = wire["errors"][key]
        assert mock["code"] == body["code"], key
        assert not mismatches(shape(body), shape(mock)), key
    # the answer for "the integration is busy / not reachable" carries the state and the reason in `details`
    assert wire["errors"]["unavailable"]["code"] == "intercom_unavailable" == intercom_adapter._unavailable({"state": "error", "last_error": "rate_limited"}).code
    assert set(wire["errors"]["unavailable"]["details"]) == {"state", "last_error"}
