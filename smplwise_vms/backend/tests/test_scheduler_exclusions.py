"""CR-014 (SCHEDULER_API.md 5.5): the Scheduler component's own switches (`switch.schedule_*`, platform `scheduler`) are not
devices. They have an HA device (V-LIVE), so without these rules they would appear in the devices tree / area / tiles, be
protected / unprotected from group actions (CR-019), be reached by a bulk action, take a general entity action, be dropped on a map or turn up in
search. Synthetic entities only."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import replace

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient
from test_devices import AREAS, ENTITY_REGISTRY, FLOORS, STATES, _body, _pair, _publish_plan, _reg

from smplwise.rbac import Principal
from smplwise.services import device_bulk, ha_client, ha_sync
from smplwise.services import devices as svc

SCHED = "switch.schedule_shbt_slvn"  # platform scheduler (with a device and, here, even an area)
SCHED_FRESH = "switch.schedule_a1b2c3"  # state only: no registry row yet (platform still unknown)
ORDINARY = "switch.lobby_sign"

EXTRA_STATES = [
    {"entity_id": SCHED, "state": "on", "attributes": {"friendly_name": "Scheduler Lobby Shabbat", "icon": "mdi:calendar-clock", "next_trigger": "2026-10-03T00:00:00+03:00"},
     "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": SCHED_FRESH, "state": "off", "attributes": {"friendly_name": "Scheduler Lobby Fresh"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    # look-alikes that are NOT schedules: the prefix rule must not match them
    {"entity_id": "switch.schedulexfoo", "state": "on", "attributes": {"friendly_name": "Lobby lookalike one"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
    {"entity_id": "switch.lobby_schedule_lamp", "state": "on", "attributes": {"friendly_name": "Lobby lookalike two"}, "last_changed": "2026-09-28T10:00:00+00:00", "last_updated": "2026-09-28T10:00:00+00:00"},
]
REGISTRY = [
    *ENTITY_REGISTRY,
    {**_reg(SCHED, "lobby"), "platform": "scheduler", "device_id": "dev-scheduler"},
    {**_reg("switch.lobby_schedule_lamp", "lobby"), "platform": "template"},
    {**_reg("switch.schedulexfoo", "lobby"), "platform": "template"},
]


@pytest.fixture()
def sched_app(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES + EXTRA_STATES)
    from smplwise.main import create_app

    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        ha_sync.apply_registry(conn, ha_client.registry_maps(REGISTRY, [], AREAS, FLOORS))
        ha_sync.apply_structure(conn, AREAS, FLOORS)
    return app, s, TestClient(app)


def _admin() -> Principal:
    return Principal(user_id="dev-joni", username="joni", display_name="joni", source="dev")


# ---------------------------------------------------------------- the rule itself


@pytest.mark.parametrize("entity_id,platform,expected", [
    (SCHED, "scheduler", True), ("switch.anything", "scheduler", True), (SCHED_FRESH, None, True), ("switch.schedule_", None, True),
    ("switch.schedule_shbt", "template", False), ("switch.schedulexfoo", None, False), ("switch.lobby_schedule_lamp", None, False), ("light.schedule_x", None, False),
    (ORDINARY, None, False), (ORDINARY, "template", False),
])
def test_is_scheduler_entity(entity_id, platform, expected):
    assert svc.is_scheduler_entity(entity_id, platform) is expected


def test_the_sql_fragment_agrees_with_the_helper_including_null_platforms():
    db = sqlite3.connect(":memory:")
    db.execute("CREATE TABLE ha_entities (entity_id TEXT NOT NULL, platform TEXT)")
    rows = [(SCHED, "scheduler"), ("switch.x", "scheduler"), (SCHED_FRESH, None), ("switch.schedulexfoo", None), ("switch.schedule_b", "template"), (ORDINARY, None), (ORDINARY, "template"), ("light.schedule_x", None)]
    db.executemany("INSERT INTO ha_entities VALUES (?, ?)", rows)
    schedulers = {r[0] + "|" + str(r[1]) for r in db.execute("SELECT entity_id, platform FROM ha_entities WHERE " + svc.IS_SCHEDULER_SQL)}
    others = {r[0] + "|" + str(r[1]) for r in db.execute("SELECT entity_id, platform FROM ha_entities WHERE " + svc.NOT_SCHEDULER_SQL)}
    expected = {e + "|" + str(p) for e, p in rows if svc.is_scheduler_entity(e, p)}
    assert schedulers == expected
    assert others == {e + "|" + str(p) for e, p in rows} - expected, "NOT must not drop NULL-platform rows (three-valued logic)"


# ---------------------------------------------------------------- the devices area never shows them


def test_devices_area_tree_items_and_tiles_leave_schedules_out(sched_app):
    app, s, c = sched_app
    with app.state.db.connection() as conn:
        rows = {r["entity_id"]: r["platform"] for r in conn.execute("SELECT entity_id, platform FROM ha_entities WHERE entity_id LIKE 'switch.sch%' OR entity_id LIKE 'switch.lobby_sch%'").fetchall()}
        assert rows[SCHED] == "scheduler" and rows[SCHED_FRESH] is None, "the fixture has one of each kind"
        listed = {e["entity_id"] for e in svc.load_entities(conn)}
    assert SCHED not in listed and SCHED_FRESH not in listed
    assert {"switch.schedulexfoo", "switch.lobby_schedule_lamp", ORDINARY} <= listed, "look-alikes stay"
    # the tree counts switches: the scheduler switch (with a lobby area) is not one of them
    lobby = c.get("/api/v1/devices/areas/lobby").json()
    assert {r["entity_id"] for r in lobby["cards"]["switches"]["entities"]} == {ORDINARY, "switch.schedulexfoo", "switch.lobby_schedule_lamp"}
    t = c.get("/api/v1/devices/tree").json()
    ground_lobby = next(a for f in t["floors"] for a in f["areas"] if a["area_id"] == "lobby")
    assert ground_lobby["counts"]["switches"] == 3
    ids = {r["entity_id"] for f in c.get("/api/v1/devices/items", params={"kind": "switches"}).json()["floors"] for a in f["areas"] for r in a["items"]}
    assert SCHED not in ids and SCHED_FRESH not in ids and ORDINARY in ids
    unassigned = {r["entity_id"] for r in c.get("/api/v1/devices/areas/unassigned").json()["cards"]["switches"]["entities"]}
    assert unassigned == {"switch.loose"}


def test_protection_list_and_routes_refuse_schedules_and_reconcile_skips_them(sched_app):
    """CR-019: a schedule's switch is not a device - the protection routes refuse it (not_markable), the list leaves it out
    and the classifier never judges it."""
    app, s, c = sched_app
    from smplwise.services import switch_protection

    assert c.put(f"/api/v1/devices/entities/{ORDINARY}/bulk-protected", json={"protected": True}).status_code == 200
    for eid in (SCHED, SCHED_FRESH):
        r = c.put(f"/api/v1/devices/entities/{eid}/bulk-protected", json={"protected": True})
        assert r.status_code == 422 and r.json()["code"] == "not_markable" and "תזמון" in r.json()["user_message"], eid
        assert c.put(f"/api/v1/devices/entities/{eid}/bulk-protected", json={"protected": False}).status_code == 422, "not even to clear"
    for action in ("protect", "unprotect", "approve"):
        r = c.post("/api/v1/devices/bulk-protected", json={"entity_ids": [SCHED, ORDINARY, SCHED_FRESH, "switch.loose"], "action": action})
        assert r.status_code == 200, r.text
        got = {x["entity_id"]: x for x in r.json()["results"]}
        assert got[SCHED] == {"entity_id": SCHED, "ok": False, "reason": "not_markable", "changed": False} and got[SCHED_FRESH]["reason"] == "not_markable"
        assert got["switch.loose"]["ok"] is True
    lst = {x["entity_id"] for x in c.get("/api/v1/devices/bulk-protected").json()["switches"]}
    assert SCHED not in lst and SCHED_FRESH not in lst and {ORDINARY, "switch.loose"} <= lst
    with app.state.db.connection() as conn:
        switch_protection.reconcile(conn, switch_protection.present_from_mirror(conn))
        judged = {r[0] for r in conn.execute("SELECT entity_id FROM device_bulk_protected UNION SELECT entity_id FROM device_switch_classified").fetchall()}
    assert judged.isdisjoint({SCHED, SCHED_FRESH}) and {"switch.schedulexfoo", "switch.lobby_schedule_lamp"} <= judged, "look-alikes are judged like any switch"


def test_bulk_never_reaches_a_schedule_even_unprotected_or_unclassified(sched_app):
    app, s, c = sched_app
    from smplwise.services import switch_protection

    assert c.get("/api/v1/devices/tree").status_code == 200  # the developer administrator's binding exists after a first request
    with app.state.db.connection() as conn:
        _wide, _in_scope, permitted = device_bulk.bulk_scope(conn, _admin())
        assert permitted(SCHED) is False and permitted(SCHED_FRESH) is False, "unclassified: refused before any protection rule"
        switch_protection.set_protected(conn, _admin(), SCHED, False)  # judged and unprotected, forced in behind the routes
        switch_protection.set_protected(conn, _admin(), ORDINARY, False)
        _wide, _in_scope, permitted = device_bulk.bulk_scope(conn, _admin())
        assert permitted(ORDINARY) is True
        assert permitted(SCHED) is False and permitted(SCHED_FRESH) is False, "refused explicitly, by catalogue platform and by id prefix"
        assert permitted("switch.schedule_zzzzzz") is False, "an id the catalogue has never seen is refused by prefix too"
    p = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "switches_off"}).json()
    named = {t["entity_id"] for t in p["targets"]} | {x["entity_id"] for x in p["excluded"]}
    assert ORDINARY in {t["entity_id"] for t in p["targets"]} and SCHED not in named and SCHED_FRESH not in named
    p2 = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "switches_on"}).json()
    assert SCHED not in {t["entity_id"] for t in p2["targets"]} | {x["entity_id"] for x in p2["excluded"]}
    p3 = c.get("/api/v1/devices/actions/preview", params={"scope": "building", "id": "*", "kind": "all_off"}).json()
    assert SCHED not in {t["entity_id"] for t in p3["targets"]}


# ---------------------------------------------------------------- the entity catalogue and the general action route


def test_catalogue_lists_schedule_switches_read_only(sched_app):
    app, s, c = sched_app
    got = {e["entity_id"]: e for e in c.get("/api/v1/ha/entities", params={"domain": "switch"}).json()["entities"]}
    assert SCHED in got and SCHED_FRESH in got, "kept listed"
    for eid in (SCHED, SCHED_FRESH):
        assert got[eid]["actions"] == [] and got[eid]["schedule_entity"] is True, eid
    assert got[ORDINARY]["schedule_entity"] is False and {a["id"] for a in got[ORDINARY]["actions"]} == {"switch.turn_on", "switch.turn_off"}
    assert got["switch.schedulexfoo"]["schedule_entity"] is False
    one = c.get(f"/api/v1/ha/entities/{SCHED}").json()
    assert one["actions"] == [] and one["schedule_entity"] is True and one["entity_id"] == SCHED
    fresh = c.get(f"/api/v1/ha/entities/{SCHED_FRESH}").json()
    assert fresh["actions"] == [] and fresh["schedule_entity"] is True
    plain = c.get(f"/api/v1/ha/entities/{ORDINARY}").json()
    assert plain["schedule_entity"] is False and plain["actions"]


def test_general_action_route_refuses_a_schedule_switch_after_the_permission_check(sched_app, monkeypatch):
    app, s, c = sched_app
    calls = _pair(c, monkeypatch)
    for eid in (SCHED, SCHED_FRESH):
        for action in ("switch.turn_off", "switch.turn_on"):
            r = c.post(f"/api/v1/ha/entities/{eid}/actions", json=_body(allowed_action_id=action, client_request_id=f"r-{eid}-{action}"))
            assert r.status_code == 409 and r.json()["code"] == "use_schedules_screen" and r.json()["user_message"] == "התזמון מנוהל במסך התזמונים.", (eid, action, r.text)
    assert calls == [], "nothing reached the bridge"
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT decision, reason, resource_id FROM audit_log WHERE action = 'ha.action' AND reason = 'use_schedules_screen' ORDER BY rowid").fetchall()
        assert len(rows) == 4 and {r["decision"] for r in rows} == {"denied"} and {r["resource_id"] for r in rows} == {SCHED, SCHED_FRESH}
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE entity_id IN (?, ?)", (SCHED, SCHED_FRESH)).fetchone()[0] == 0, "no action row is created"
    # an ordinary switch still works through the same route
    ok = c.post(f"/api/v1/ha/entities/{ORDINARY}/actions", json=_body(allowed_action_id="switch.turn_off", client_request_id="r-ordinary"))
    assert ok.status_code == 202, ok.text
    assert [(x["domain"], x["service"]) for x in calls] == [("switch", "turn_off")]
    # order of the checks: a caller with no control keeps the audited 403, they do not learn it is a schedule (409)
    bind(c, s, "ron", "viewer", "installation", "*")
    r = c.post(f"/api/v1/ha/entities/{SCHED}/actions", json=_body(allowed_action_id="switch.turn_on", client_request_id="r-viewer"), headers=as_user("ron"))
    assert r.status_code == 403, r.text
    assert len(calls) == 1


# ---------------------------------------------------------------- map placement and search


def test_a_schedule_cannot_be_placed_on_a_map(sched_app):
    app, s, c = sched_app
    ids = seed_tree(c)
    _publish_plan(c, ids["floor2"])
    for eid in (SCHED, SCHED_FRESH):
        r = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": eid, "x": 0.2, "y": 0.2})
        assert r.status_code == 422 and r.json()["code"] == "not_placeable", (eid, r.text)
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": ORDINARY, "x": 0.2, "y": 0.2}).status_code == 201
    assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "switch.schedulexfoo", "x": 0.4, "y": 0.2}).status_code == 201
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM map_anchors WHERE resource_id IN (?, ?)", (SCHED, SCHED_FRESH)).fetchone()[0] == 0


def test_search_leaves_schedule_switches_out(sched_app):
    app, s, c = sched_app

    def entity_ids(q: str) -> set[str]:
        return {h["id"] for h in c.get("/api/v1/search", params={"q": q}).json()["results"] if h["kind"] == "entity"}

    assert entity_ids("lookalike") == {"switch.schedulexfoo", "switch.lobby_schedule_lamp"}
    assert entity_ids("lobby_sign") == {ORDINARY}
    # "schedule_" is in the id of a look-alike and of both schedule switches: only the look-alike is found
    assert entity_ids("schedule_") == {"switch.lobby_schedule_lamp"}
    assert entity_ids("Scheduler") == set(), "the schedules' own names find nothing"
