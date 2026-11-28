"""FIX-MH01-2560 (deep review 2.56, MH-01 high): every write that changes which building an area resolves to runs the round-14
RemapGuard of POST /plan/area-links. A plan room's area link (spatial_zones.ha_area_id) is the FIRST source of an area's building
(building_scope.area_targets), so:

- PATCH /zones/{id} with `area_id` (the plan editor's own "אזור" field) is refused - audited 403 `forbidden`, nothing written - for a floor
  editor of building A pulling building B's area onto his floor, exactly like /plan/area-links; an installation-wide admin may; with the
  multi-building switch off the route is today's.
- The writes that drop a room's link (room delete, "replace automatic rooms", floor delete, building delete with its area -> building rows)
  run the same guard: the area falls back to its next mapping row and open sockets re-scope (mapping_changed). Their own permission check
  already covers the building the area leaves, so the guard cannot refuse a caller who passed it; switch off = nothing of it runs."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from test_building_scope_control_2351 import _site
from test_building_scope_single_2351 import _multi_on
from test_devices import bulk_app, dev_app  # noqa: F401 - the fixtures

from smplwise.services import building_scope, revocation

API = "/api/v1"
RECT = [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.4}, {"x": 0.1, "y": 0.4}]


def _building_of(app, area_id: str) -> str | None:
    with app.state.db.connection() as conn:
        return building_scope.area_buildings(conn).get(area_id)


def _zone(app, zone_id: str):
    with app.state.db.connection() as conn:
        return conn.execute("SELECT ha_area_id, revision, deleted_at FROM spatial_zones WHERE id = ?", (zone_id,)).fetchone()


def _room(c, floor_id: str, area_id: str | None = None) -> str:
    """A room on the floor (by the administrator), linked to `area_id` when given."""
    r = c.post(f"{API}/floors/{floor_id}/zones", json={"name": "חדר", "polygon": RECT})
    assert r.status_code == 201, r.text
    zid = r.json()["id"]
    if area_id:
        assert c.patch(f"{API}/zones/{zid}", json={"revision": 1, "area_id": area_id}).status_code == 200
    return zid


def _no_mapping_code(monkeypatch) -> None:
    def never(*_a, **_k):
        raise AssertionError("switch off: the mapping guard must not run")

    for fn in ("area_targets", "mapping_changed"):
        monkeypatch.setattr(building_scope, fn, never)


# ------------------------------------------------------------------------------------------------ PATCH /zones/{id} area_id (MH-01)

def test_patch_zone_area_refused_for_a_floor_editor_pulling_another_buildings_area(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "eda", "site_admin", "floor", ids["fA"])
    _multi_on(c)
    zid = _room(c, ids["fA"])
    assert _building_of(app, "office") == ids["B"]
    who = as_user("eda")
    # the guarded route refuses it ...
    r = c.post(f"{API}/plan/area-links", json={"links": [{"zone_id": zid, "area_id": "office"}]}, headers=who)
    assert (r.status_code, r.json()["code"]) == (403, "forbidden"), r.text
    # ... and now the room field refuses it the same way: audited 403, nothing written
    r = c.patch(f"{API}/zones/{zid}", json={"revision": 1, "area_id": "office"}, headers=who)
    assert (r.status_code, r.json()["code"]) == (403, "forbidden"), r.text
    z = _zone(app, zid)
    assert (z["ha_area_id"], z["revision"]) == (None, 1), "nothing written"
    assert _building_of(app, "office") == ids["B"]
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT resource_type, resource_id FROM audit_log WHERE action = 'placement.edit' AND decision = 'denied' "
                              "AND actor_user_id = 'dev-eda' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert (denied["resource_type"], denied["resource_id"]) == ("floor", ids["fB"])
        assert not conn.execute("SELECT 1 FROM audit_log WHERE action = 'zone.update' AND actor_user_id = 'dev-eda'").fetchone()
    # his own building's area: fine (and the other fields of the room are untouched by the guard)
    r = c.patch(f"{API}/zones/{zid}", json={"revision": 1, "area_id": "lobby", "name": "לובי"}, headers=who)
    assert r.status_code == 200, r.text
    assert _zone(app, zid)["ha_area_id"] == "lobby"
    # a patch without area_id never enters the guard
    assert c.patch(f"{API}/zones/{zid}", json={"revision": 2, "name": "לובי 2"}, headers=who).status_code == 200


def test_patch_zone_area_allowed_for_an_installation_admin_and_sockets_rescope(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "opb", "operator", "building", ids["B"])
    _multi_on(c)
    zid = _room(c, ids["fA"])
    gen = revocation.generation("dev-opb")
    r = c.patch(f"{API}/zones/{zid}", json={"revision": 1, "area_id": "office"})  # the administrator (installation-wide)
    assert r.status_code == 200, r.text
    assert _building_of(app, "office") == ids["A"]
    assert revocation.generation("dev-opb") > gen, "B's holders lose the office now: open sockets re-scope"


def test_patch_zone_area_with_the_switch_off_is_todays_route(bulk_app, monkeypatch):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "eda", "site_admin", "floor", ids["fA"])
    zid = _room(c, ids["fA"])
    _no_mapping_code(monkeypatch)
    r = c.patch(f"{API}/zones/{zid}", json={"revision": 1, "area_id": "office"}, headers=as_user("eda"))
    assert r.status_code == 200, r.text
    assert _zone(app, zid)["ha_area_id"] == "office"


# ------------------------------------------------------------------------------------------------ the writes that drop a room's link

def _drop(c, ids, path: str):
    """Link the office to a room on building A (by the administrator) and return the call that drops that link, by the editor the
    route itself requires: the room's floor editor for a room delete / "replace automatic rooms", building A's editor for a floor delete."""
    if path == "zone_delete":
        zid = _room(c, ids["fA"], "office")
        return lambda: c.delete(f"{API}/zones/{zid}", headers=as_user("eda"))
    if path == "replace_auto":
        r = c.post(f"{API}/floors/{ids['fA']}/zones/accept", json={"candidates": [{"polygon": RECT}]})
        assert r.status_code == 201, r.text
        zid = r.json()["created"][0]
        assert c.patch(f"{API}/zones/{zid}", json={"revision": 1, "area_id": "office"}).status_code == 200
        return lambda: c.post(f"{API}/floors/{ids['fA']}/zones/accept", json={"candidates": [{"polygon": RECT}], "replace_auto": True}, headers=as_user("eda"))
    f2 = c.post(f"{API}/buildings/{ids['A']}/floors", json={"name": "קומה 1", "level": 1}).json()["id"]
    _room(c, f2, "office")
    return lambda: c.delete(f"{API}/floors/{f2}", headers=as_user("bea"))


def _editors(c, s, ids) -> None:
    bind(c, s, "eda", "site_admin", "floor", ids["fA"])
    bind(c, s, "bea", "site_admin", "building", ids["A"])
    bind(c, s, "opb", "operator", "building", ids["B"])


@pytest.mark.parametrize("path", ["zone_delete", "replace_auto", "floor_delete"])
def test_dropping_a_room_link_runs_the_guard_and_the_area_falls_back(bulk_app, path):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    _editors(c, s, ids)
    _multi_on(c)
    drop = _drop(c, ids, path)
    assert _building_of(app, "office") == ids["A"], "the room link wins over the platform floor's row"
    gen = revocation.generation("dev-opb")
    r = drop()
    assert r.status_code in (201, 204), r.text
    assert _building_of(app, "office") == ids["B"], "the office falls back to its platform floor's row (building B)"
    assert revocation.generation("dev-opb") > gen, "the area's building changed: open sockets re-scope (mapping_changed)"


@pytest.mark.parametrize("path", ["zone_delete", "replace_auto", "floor_delete"])
def test_dropping_a_room_link_with_the_switch_off_is_todays_route(bulk_app, monkeypatch, path):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    _editors(c, s, ids)
    drop = _drop(c, ids, path)
    real = building_scope.area_targets
    calls: list[int] = []

    def counted(*a, **k):
        calls.append(1)
        return real(*a, **k)

    monkeypatch.setattr(building_scope, "area_targets", counted)
    r = drop()
    assert r.status_code in (201, 204), r.text
    assert calls == [], "switch off: the guard never reads the mapping"


def test_building_delete_runs_the_guard_for_its_area_building_rows(bulk_app, monkeypatch):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "opa", "operator", "building", ids["A"])
    _multi_on(c)
    with app.state.db.connection() as conn:
        site_id = conn.execute("SELECT site_id FROM buildings WHERE id = ?", (ids["A"],)).fetchone()[0]
    cb = c.post(f"{API}/sites/{site_id}/buildings", json={"name": "בניין ג"}).json()["id"]
    with app.state.db.connection() as conn:
        conn.execute("UPDATE home_area_buildings SET building_id = ? WHERE area_id = 'garden'", (cb,))
    assert _building_of(app, "garden") == cb
    gen = revocation.generation("dev-opa")
    assert c.delete(f"{API}/buildings/{cb}").status_code == 204
    assert _building_of(app, "garden") is None
    assert revocation.generation("dev-opa") > gen, "the garden left building C: open sockets re-scope"
    # switch off: the guard never reads the mapping
    cd = c.post(f"{API}/sites/{site_id}/buildings", json={"name": "בניין ד"}).json()["id"]
    assert c.put(f"{API}/home/multi-building", json={"enabled": False}).status_code == 200
    _no_mapping_code(monkeypatch)
    assert c.delete(f"{API}/buildings/{cd}").status_code == 204
