"""AREA-HONEST-COUNT-2540 (deep review SCR-10 / SCR-09, the full interface): the area / floor / building counts never count a lock
whose state is not known as "not locked", and the `alarm` summary of several panels is the most urgent KNOWN state - one unreadable
panel no longer hides an armed or triggered one, nor turns a known "disarmed" into "unavailable". Additive (ADR-015): `locks_unknown`
and `alarms_unknown` beside the old fields."""
from __future__ import annotations

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from smplwise.services import devices as svc
from smplwise.services import ha_client, ha_sync


def _e(domain: str, state: str | None, available: bool = True) -> dict:
    return {"entity_id": f"{domain}.x", "domain": domain, "state": state, "available": available}


def _counts(*entities: dict) -> dict:
    c = svc.empty_counts()
    for e in entities:
        svc.count_into(c, e)
    return c


def test_empty_counts_carry_the_new_fields_and_keep_the_old_ones():
    c = svc.empty_counts()
    assert c["locks_unknown"] == 0 and c["alarms_unknown"] == 0
    assert c["locks"] == 0 and c["locks_locked"] == 0 and c["alarm"] is None


@pytest.mark.parametrize(
    ("state", "available", "locked", "unknown"),
    [
        ("locked", True, 1, 0),
        ("unlocked", True, 0, 0),
        ("jammed", True, 0, 0),
        ("open", True, 0, 0),
        ("unavailable", False, 0, 1),
        ("unknown", True, 0, 1),
        (None, True, 0, 1),
        ("", True, 0, 1),
        ("weird", True, 0, 1),
        # an offline lock whose last state was "locked" is not vouched for as locked
        ("locked", False, 0, 1),
    ],
)
def test_a_lock_is_locked_unlocked_or_unknown(state, available, locked, unknown):
    c = _counts(_e("lock", state, available))
    assert (c["locks"], c["locks_locked"], c["locks_unknown"]) == (1, locked, unknown)


def test_an_offline_lock_is_not_counted_as_not_locked():
    c = _counts(_e("lock", "locked"), _e("lock", "unavailable", False), _e("lock", "unlocked"))
    assert c["locks"] == 3 and c["locks_locked"] == 1 and c["locks_unknown"] == 1
    # what the area row calls "not locked": the total minus the locked minus the unknown
    assert c["locks"] - c["locks_locked"] - c["locks_unknown"] == 1


@pytest.mark.parametrize(
    ("panels", "summary", "unknown"),
    [
        # one unreadable panel does not hide an armed one - in either order
        ([("unavailable", False), ("armed_away", True)], "armed_away", 1),
        ([("armed_away", True), ("unavailable", False)], "armed_away", 1),
        ([("unknown", True), ("triggered", True)], "triggered", 1),
        # ... nor turns a known "disarmed" into "unavailable"
        ([("disarmed", True), ("unavailable", False)], "disarmed", 1),
        ([("unavailable", False), ("disarmed", True)], "disarmed", 1),
        # urgency among known states
        ([("armed_home", True), ("triggered", True)], "triggered", 0),
        ([("armed_home", True), ("pending", True)], "pending", 0),
        ([("disarmed", True), ("arming", True)], "arming", 0),
        ([("arming", True), ("armed_night", True)], "armed_night", 0),
        ([("disarmed", True), ("disarming", True)], "disarming", 0),
        ([("armed_home", True), ("armed_away", True)], "armed_home", 0),  # equal ranks keep the first
        ([("disarmed", True), ("armed_custom", True)], "armed_custom", 0),  # a state no table names is never hidden behind disarmed
        # nothing known: "unknown" before "unavailable"
        ([("unavailable", False), ("unknown", True)], "unknown", 2),
        ([("unavailable", False), ("unavailable", False)], "unavailable", 2),
        ([(None, True)], "unknown", 1),
        # an offline panel is unavailable whatever its stale state says
        ([("armed_away", False)], "unavailable", 1),
        ([("armed_away", False), ("disarmed", True)], "disarmed", 1),
    ],
)
def test_the_alarm_summary_is_the_most_urgent_known_state(panels, summary, unknown):
    c = _counts(*[_e("alarm_control_panel", s, a) for s, a in panels])
    assert c["alarm"] == summary and c["alarms_unknown"] == unknown


def test_the_floor_and_building_sums_use_the_same_rule():
    lobby = _counts(_e("alarm_control_panel", "unavailable", False), _e("lock", "unknown"))
    office = _counts(_e("alarm_control_panel", "armed_away"), _e("lock", "locked"))
    hall = _counts(_e("alarm_control_panel", "disarmed"))
    total = svc._sum_counts([lobby, office, hall])
    assert total["alarm"] == "armed_away" and total["alarms_unknown"] == 1
    assert (total["locks"], total["locks_locked"], total["locks_unknown"]) == (2, 1, 1)
    assert svc._sum_counts([lobby, hall])["alarm"] == "disarmed"
    assert svc._sum_counts([lobby])["alarm"] == "unavailable"
    assert svc._sum_counts([svc.empty_counts()])["alarm"] is None


# ------------------------------------------------------------------------------------------------ through the API

def _state(eid: str, state: str, name: str) -> dict:
    return {"entity_id": eid, "state": state, "attributes": {"friendly_name": name}, "last_changed": "2026-11-26T10:00:00+00:00", "last_updated": "2026-11-26T10:00:00+00:00"}


STATES = [
    _state("lock.ahc_front", "locked", "Front door"),
    _state("lock.ahc_back", "unavailable", "Back door"),
    _state("lock.ahc_gate", "unknown", "Gate"),
    _state("alarm_control_panel.ahc_a", "unavailable", "Panel A"),
    _state("alarm_control_panel.ahc_b", "armed_home", "Panel B"),
    _state("lock.ahc_office", "unlocked", "Office door"),
    _state("alarm_control_panel.ahc_office", "disarmed", "Office panel"),
]
FLOORS = [{"floor_id": "ahc_ground", "name": "קרקע", "level": 0, "icon": None}]
AREAS = [
    {"area_id": "ahc_lobby", "name": "לובי", "floor_id": "ahc_ground", "icon": None},
    {"area_id": "ahc_office", "name": "משרד", "floor_id": "ahc_ground", "icon": None},
]
REGISTRY = [
    {"entity_id": s["entity_id"], "id": f"reg-{s['entity_id']}", "area_id": "ahc_office" if "office" in s["entity_id"] else "ahc_lobby", "device_id": None, "entity_category": None}
    for s in STATES
]


@pytest.fixture()
def ahc_app(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    from smplwise.main import create_app

    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        ha_sync.apply_registry(conn, ha_client.registry_maps(REGISTRY, [], AREAS, FLOORS))
        ha_sync.apply_structure(conn, AREAS, FLOORS)
    return app


def test_the_tree_counts_unknown_locks_apart_and_keeps_the_armed_panel(ahc_app):
    t = TestClient(ahc_app).get("/api/v1/devices/tree").json()
    ground = next(f for f in t["floors"] if f["floor_id"] == "ahc_ground")
    lobby = next(a for a in ground["areas"] if a["area_id"] == "ahc_lobby")["counts"]
    assert (lobby["locks"], lobby["locks_locked"], lobby["locks_unknown"]) == (3, 1, 2)
    assert lobby["alarm"] == "armed_home" and lobby["alarms_unknown"] == 1
    office = next(a for a in ground["areas"] if a["area_id"] == "ahc_office")["counts"]
    assert (office["locks"], office["locks_locked"], office["locks_unknown"]) == (1, 0, 0)
    assert office["alarm"] == "disarmed" and office["alarms_unknown"] == 0
    # the floor and the building: the same rule over the areas
    for c in (ground["counts"], t["building"]):
        assert (c["locks"], c["locks_locked"], c["locks_unknown"]) == (4, 1, 2)
        assert c["alarm"] == "armed_home" and c["alarms_unknown"] == 1


def test_one_area_carries_the_same_counts(ahc_app):
    c = TestClient(ahc_app).get("/api/v1/devices/areas/ahc_lobby").json()["counts"]
    assert (c["locks"], c["locks_locked"], c["locks_unknown"]) == (3, 1, 2)
    assert c["alarm"] == "armed_home" and c["alarms_unknown"] == 1


@pytest.mark.parametrize("state", ["jammed", "locking", "unlocking"])
def test_a_jammed_or_moving_lock_is_never_counted_as_open_or_locked(state):
    """FIX-HOME-MAPS-2570 (MH-03): jammed / locking / unlocking say neither "locked" nor "open"."""
    c = _counts(_e("lock", state))
    assert (c["locks"], c["locks_locked"], c["locks_unknown"]) == (1, 0, 1)
    assert c["locks"] - c["locks_locked"] - c["locks_unknown"] == 0
