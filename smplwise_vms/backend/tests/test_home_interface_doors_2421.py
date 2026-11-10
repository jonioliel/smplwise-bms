"""HOME-SIMPLE-2421 (lab 2.42.0): the home interface's doors carry THE unlock reason (services/door_authority.unlock_reason) - an
intercom door the door map does not resolve says `door_not_mapped` there too, so the home interface never offers an open that the
door path refuses. Same fixtures as the devices panel's own check (test_unlock_reason_2370)."""
from __future__ import annotations

from test_unlock_reason_2370 import reasons
from test_wiskey_door_path import API, _clean, world  # noqa: F401 - the fixtures

from smplwise.services import ha_sync

AREAS = [{"area_id": "hall", "name": "Hall", "floor_id": "ground", "icon": None}]
FLOORS = [{"floor_id": "ground", "name": "Ground", "level": 0, "icon": None}]


def _in_hall(world) -> None:
    with world["db"].connection() as conn:
        ha_sync.apply_structure(conn, AREAS, FLOORS)
        conn.execute("UPDATE ha_entities SET area_id = 'hall' WHERE domain = 'lock'")


def test_overview_doors_say_door_not_mapped_like_the_devices_panel(world):
    c = world["c"]
    assert c.get(f"{API}/me").status_code == 200
    _in_hall(world)
    panel = reasons(c)
    ov = c.get(f"{API}/home/overview")
    assert ov.status_code == 200, ov.text
    hall = next(r for r in ov.json()["rooms"] if r["id"] == "hall")
    locks = {x["entity_id"]: x for x in hall["locks"]}
    assert set(locks) == {"lock.entrance", "lock.side", "lock.dock_gate", "lock.office"}
    for eid, row in locks.items():
        assert row["unlock_reason"] == panel[eid], eid
        assert row["can_unlock"] is (row["unlock_reason"] == "ok")
    assert locks["lock.entrance"]["unlock_reason"] == "door_not_mapped" and locks["lock.entrance"]["wiskey_door"] is True
    assert locks["lock.entrance"]["can_unlock"] is False
