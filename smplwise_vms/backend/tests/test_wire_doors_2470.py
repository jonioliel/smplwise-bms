"""CR-RESPONSE-MODELS-C-2470: the WisKey door administration API (routers/doors.py) answers through its response models
(smplwise/wire/doors.py). The one JSON route no other test answered successfully - clearing a door mapping - goes through the wire
oracle here (status, refusal, audit, idempotent second clear). Fakes only (test_wiskey_door_path.py's world: a served WisKey copy,
three WisKey lock entities, no bridge, no door)."""
from __future__ import annotations

from conftest import as_user, bind
from support import wire_oracle
from test_wiskey_door_path import API, DOCK, _clean, map_all, rows, world  # noqa: F401 - the fixtures


def test_clearing_a_door_mapping(world):  # noqa: F811 - the imported fixture
    before = dict(wire_oracle.CHECKED)
    c = world["c"]
    map_all(c)
    # an operator may not clear a mapping (system.configure): the audited 403, the mapping stays
    bind(c, world["settings"], "ofer", "operator", "installation", "*")
    r = c.delete(f"{API}/intercom/door-map/lock.dock_gate", headers=as_user("ofer"))
    assert r.status_code == 403, r.text
    locks = {lk["entity_id"]: lk for lk in c.get(f"{API}/intercom/door-map").json()["locks"]}
    assert locks["lock.dock_gate"]["mapping"]["station_id"] == DOCK
    r = c.delete(f"{API}/intercom/door-map/lock.dock_gate")
    assert r.status_code == 200 and r.json() == {"removed": True}, r.text
    locks = {lk["entity_id"]: lk for lk in c.get(f"{API}/intercom/door-map").json()["locks"]}
    assert locks["lock.dock_gate"]["mapping"] is None
    # a second clear changes nothing and says so
    assert c.delete(f"{API}/intercom/door-map/lock.dock_gate").json() == {"removed": False}
    assert [(a["resource_id"], a["details"]) for a in rows(world["db"], "intercom.door.unmapped")] == [
        ("lock.dock_gate", {"removed": True}), ("lock.dock_gate", {"removed": False})]
    key = "DELETE /api/v1/intercom/door-map/{entity_id}"
    assert wire_oracle.CHECKED.get(key, 0) >= before.get(key, 0) + 2
