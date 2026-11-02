"""AREA-PRESENCE-LINE-2351: GET presence/area/{area_id} - the devices area screen's presence line.

The administrator's switch (`area_line`, OFF by default: nothing is read), the two parts and their own permissions (presence.building.view
for the tagged room sensors, presence.view for the people a beacon places in a plan room linked to the area), names only under the people
`show_names` setting, the floor-scoped people viewer, the opt-out, the denial for a caller with neither permission and the throttled
audit without names. Synthetic data only (the helpers of the WHOIN034 tests)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import building_presence as bp
from smplwise.services import ha_sync
from smplwise.services import presence as svc
from smplwise.services import presence_people as people_svc
from test_whoin034_295 import RECT, ack, beacon, enable, phone, send

API = "/api/v1"
AREA = "a_lobby"


@pytest.fixture(autouse=True)
def _reset():
    svc.reset_limits()
    people_svc.reset()
    yield
    svc.reset_limits()
    people_svc.reset()


@pytest.fixture()
def world(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    lobby = c.post(f"{API}/floors/{ids['floor2']}/zones", json={"name": "לובי", "polygon": RECT}).json()["id"]
    kitchen = c.post(f"{API}/floors/{ids['floor3']}/zones", json={"name": "מטבח", "polygon": RECT}).json()["id"]
    bind(c, settings, "dana", "operator", "floor", ids["floor2"])
    bind(c, settings, "vera", "viewer", "installation", "*")
    bind(c, settings, "sam", "site_admin", "installation", "*")  # presence.building.view, not presence.view
    bind(c, settings, "fay", "system_admin", "floor", ids["floor3"])  # presence.view on floor 3 only
    with app.state.db.connection() as conn:
        conn.execute("UPDATE spatial_zones SET ha_area_id = ? WHERE id = ?", (AREA, lobby))  # the plan room of the area
        conn.execute(
            "INSERT INTO ha_entities(entity_id, name, domain, device_class, area_id, area_name, state, last_changed, available, disabled, first_seen_at, updated_at)"
            " VALUES('binary_sensor.presence_lobby','presence_lobby','binary_sensor','occupancy',?,'לובי','on',?,1,0,?,?)",
            (AREA, svc.iso(svc.now_utc()), svc.iso(svc.now_utc()), svc.iso(svc.now_utc())),
        )
    return app, c, {**ids, "lobby": lobby, "kitchen": kitchen}


def line(c: TestClient, user: str | None = None, area: str = AREA):
    return c.get(f"{API}/presence/area/{area}", headers=as_user(user) if user else {})


def switch_on(c: TestClient, **more) -> None:
    r = c.put(f"{API}/presence/building/settings", json={"area_line": True, **more})
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["area_line"] is True


def sensors_on(c: TestClient) -> None:
    switch_on(c, enabled=True)
    assert c.put(f"{API}/presence/building/sensors", json={"entity_ids": ["binary_sensor.presence_lobby"]}).status_code == 200


def dana_in_the_lobby(c: TestClient, ids: dict) -> None:
    enable(c, ids)
    d, tok = phone(c, "dana", "dana0000-0000-0000-0000-000000000000")
    ack(c, d, tok)
    send(c, d, tok, [beacon("b1")])


def test_the_line_is_off_by_default_and_reads_nothing(world, monkeypatch):
    app, c, ids = world
    with app.state.db.connection(mode="read") as conn:
        assert bp.get_config(conn)["area_line"] is False
    called = []
    monkeypatch.setattr(people_svc, "people_view", lambda *a, **k: called.append(1) or {})
    monkeypatch.setattr(bp, "snapshot", lambda *a, **k: called.append(1) or {})
    out = line(c).json()
    assert out == {"area_id": AREA, "line": False, "sensors": None, "people": None} and called == []


def test_the_setting_is_validated_and_audited(world):
    app, c, ids = world
    assert c.put(f"{API}/presence/building/settings", json={"area_line": "maybe"}).status_code == 422
    assert c.put(f"{API}/presence/building/settings", json={"area_line": True}, headers=as_user("vera")).status_code == 403
    switch_on(c)
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'presence.building.settings'").fetchall()
    assert rows and json.loads(rows[-1]["details_json"])["area_line"] is True


def test_a_caller_with_neither_permission_is_refused_and_audited(world):
    app, c, ids = world
    switch_on(c)
    assert line(c, "vera").status_code == 403
    assert line(c, "dana").status_code == 403
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = ? AND decision = 'denied' AND resource_type = 'area'", (bp.VIEW,)).fetchone()[0] == 2
    assert line(c, area="x" * 121).status_code == 422


def test_sensors_part_follows_the_building_module(world, monkeypatch):
    app, c, ids = world
    monkeypatch.setattr(ha_sync.STATE, "connected", True)  # a fresh mirror (a stale one reads every sensor as unknown)
    switch_on(c)
    out = line(c).json()
    assert out["line"] is True and out["sensors"] is None  # the building module is still off
    sensors_on(c)
    out = line(c).json()
    assert out["sensors"]["status"] == "occupied" and out["sensors"]["sensors"] == 1
    assert line(c, area="a_elsewhere").json()["sensors"] is None  # no tagged sensor in that room
    monkeypatch.setattr(ha_sync.STATE, "connected", False)
    assert line(c).json()["sensors"]["status"] == "unknown"  # never read as empty


def test_people_with_names_count_only_and_scope(world):
    app, c, ids = world
    switch_on(c)
    dana_in_the_lobby(c, ids)
    out = line(c).json()
    assert out["people"] == {"count": 1, "names": ["dana"], "more": 0}
    # a site_admin holds presence.building.view but not presence.view: never the people part
    sam = line(c, "sam").json()
    assert sam["people"] is None and "dana" not in json.dumps(sam)
    # a presence.view holder on another floor does not see the lobby's people
    assert line(c, "fay").json()["people"] == {"count": 0, "names": [], "more": 0}
    # counts only
    assert c.put(f"{API}/presence/settings", json={"people": {"show_names": False}}).status_code == 200
    out = line(c).json()
    assert out["people"] == {"count": 1, "names": None, "more": 0} and "dana" not in json.dumps(out)


def test_an_opted_out_person_is_neither_named_nor_counted_in_the_area(world):
    app, c, ids = world
    switch_on(c)
    dana_in_the_lobby(c, ids)
    assert c.put(f"{API}/presence/people/me", json={"opted_out": True}, headers=as_user("dana")).status_code == 200
    out = line(c).json()
    assert out["people"] == {"count": 0, "names": [], "more": 0}


def test_an_area_without_a_linked_plan_room_has_no_people_part(world):
    app, c, ids = world
    switch_on(c)
    dana_in_the_lobby(c, ids)
    assert line(c, area="a_unlinked").json()["people"] is None


def test_the_people_read_is_audited_once_without_names(world):
    app, c, ids = world
    switch_on(c)
    dana_in_the_lobby(c, ids)
    line(c)
    line(c)
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'presence.people.view' AND resource_type = 'area'").fetchall()
    assert len(rows) == 1
    details = json.loads(rows[0]["details_json"])
    assert details["area"] == 1 and "dana" not in rows[0]["details_json"]


def test_the_line_never_counts_a_wifi_or_geofence_placement(world):
    app, c, ids = world
    switch_on(c)
    enable(c, ids)
    d, tok = phone(c, "dana", "dana0000-0000-0000-0000-000000000000")
    ack(c, d, tok)
    send(c, d, tok, [{"client_event_id": "g1", "type": "enter", "site_id": "site_main", "at": svc.iso(svc.now_utc() - dt.timedelta(minutes=1)), "source": "region"}])
    assert line(c).json()["people"] == {"count": 0, "names": [], "more": 0}
