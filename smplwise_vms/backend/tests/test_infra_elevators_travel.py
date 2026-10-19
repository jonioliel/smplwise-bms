"""ELEVTRAVEL-291: the per-elevator option "show travelling when not on standby and without a fault" (migration 0122). Default off = the states
exactly as before; on = active / moving states become `travelling`, never with a dead higher sensor, never over fire / fault / shutdown /
door / waiting / unknown. A fake mirror only."""
from __future__ import annotations

import pytest
from conftest import as_user  # noqa: F401  (fixtures shared with the other elevator specs)
from test_infra_elevators import API, add_entity, app, create, set_state  # noqa: F401
from smplwise.services import elevators as el

T, F, N = True, False, None


@pytest.mark.parametrize("values,state,reason,partial", [
    # the owner's integration: waiting + fault + fire + shutdown, no movement sensors
    ({"waiting": F, "fault": F, "fire_service": F, "out_of_service": F}, "travelling", "inferred_active", False),
    ({"waiting": T, "fault": F, "fire_service": F, "out_of_service": F}, "waiting", "waiting", False),   # standby wins
    ({"waiting": F, "fault": T}, "fault", "fault", False),
    ({"waiting": F, "fire_service": T, "fault": T}, "fire_service", "fire_service", False),
    ({"waiting": F, "out_of_service": T}, "out_of_service", "out_of_service", False),
    ({"waiting": F, "door_open": T}, "door_open", "door_open", False),
    ({"waiting": N, "fault": F}, "unknown", "insufficient", True),                                     # standby sensor offline
    ({"waiting": N, "fault": N}, "unknown", "no_live_sensor", False),
    ({"waiting": F, "fault": N}, "active", "inferred_active", True),                                      # a dead fault sensor: never travelling
    ({"waiting": F, "fire_service": N, "fault": F}, "active", "inferred_active", True),
    # with movement sensors
    ({"fault": F, "moving_up": T, "moving_down": F}, "travelling", "moving_up", False),
    ({"fault": F, "moving_up": F, "moving_down": T}, "travelling", "moving_down", False),
    ({"moving_up": T, "moving_down": T}, "unknown", "conflict", False),
    ({"fault": T, "moving_up": T}, "fault", "fault", False),
    ({"waiting": T, "moving_up": T}, "moving_up", "moving_up", False),                                    # contradictory standby: left as it was
    ({"moving_up": F, "moving_down": F}, "waiting", "inferred_idle", False),
])
def test_travel_priority_matrix(values, state, reason, partial):
    assert el.derive(values, travel=True) == {"state": state, "reason": reason, "partial": partial}


@pytest.mark.parametrize("values", [
    {"waiting": F, "fault": F}, {"waiting": T}, {"fault": T, "waiting": F}, {"waiting": N}, {"moving_up": T, "moving_down": F}, {},
])
def test_option_off_is_exactly_the_old_derivation(values):
    assert el.derive(values) == el.derive(values, travel=False) and el.derive(values)["state"] != "travelling"


def test_api_option_default_off_then_on(app):
    c, db, _ = app
    sensors = {"waiting": "binary_sensor.el1_idle", "fault": "binary_sensor.el1_fault"}
    made = create(c, sensors=sensors)
    assert made.status_code == 201 and made.json()["show_travel"] is False
    eid = made.json()["id"]
    set_state(db, "binary_sensor.el1_idle", "off")
    assert c.get(f"{API}/{eid}").json()["state"] == "active"
    assert c.get(f"{API}/{eid}").json()["uses_travel"] is False
    body = {"name": "מעלית A", "sensors": sensors, "show_travel": True}
    assert c.put(f"{API}/{eid}", json=body).json()["show_travel"] is True
    got = c.get(f"{API}/{eid}").json()
    assert got["state"] == "travelling" and got["uses_travel"] is True and got["since"]
    assert c.get(API).json()["summary"]["travelling"] == 1
    set_state(db, "binary_sensor.el1_fault", "on")
    assert c.get(f"{API}/{eid}").json()["state"] == "fault"
    set_state(db, "binary_sensor.el1_fault", "unavailable")
    got = c.get(f"{API}/{eid}").json()
    assert got["state"] == "active" and got["partial"] is True
    set_state(db, "binary_sensor.el1_fault", "off")
    set_state(db, "binary_sensor.el1_idle", "on")
    assert c.get(f"{API}/{eid}").json()["state"] == "waiting"
    set_state(db, "binary_sensor.el1_idle", "unavailable")
    set_state(db, "binary_sensor.el1_fault", "unavailable")
    assert c.get(f"{API}/{eid}").json()["state"] == "unknown"
    manage = c.get(f"{API}/manage").json()["elevators"][0]
    assert manage["show_travel"] is True


def test_history_records_travelling_and_a_stale_mirror_is_unknown(app):
    import time

    from smplwise.services import elevators_runtime as rt
    from smplwise.services import ha_sync

    c, db, _ = app
    sensors = {"waiting": "binary_sensor.el1_idle", "fault": "binary_sensor.el1_fault"}
    eid = create(c, sensors=sensors, show_travel=True).json()["id"]
    set_state(db, "binary_sensor.el1_idle", "off")
    rt.tick(db, time.time(), connected=True)
    with db.connection(mode="read") as conn:
        last = conn.execute("SELECT state FROM infra_elevator_states WHERE elevator_id = ? ORDER BY at DESC LIMIT 1", (eid,)).fetchone()
    assert last["state"] == "travelling"
    ha_sync.STATE.connected = False
    got = c.get(f"{API}/{eid}").json()
    assert got["state"] == "unknown" and got["stale"] is True
