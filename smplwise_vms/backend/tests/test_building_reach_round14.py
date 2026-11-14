"""Round 14 (owner decision 02.11, answer B): a building-scoped role binding reaches a device placed on that building's floor maps OR whose
area the home mapping puts in that building - a union, decided in ONE place (services/ha_scope: FloorSet.mapped / mapping_decision) so
every route that asks ha_scope follows it. The installation setting "הרשאת בניין לפי" (security.building_reach: map_and_mapping by
default, or map) is changed only with rbac.roles.manage everywhere, audited. It counts only while the multi-building switch is on; off =
exactly the rule before. A mapping write that moves an area out of its building needs that building's edit too (RemapGuard)."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from test_building_scope_control_2351 import _site
from test_building_scope_single_2351 import _act, _multi_on
from test_devices import _bulk, _finish, bulk_app, dev_app  # noqa: F401 - the fixtures of the bulk tests

from smplwise.services import building_scope, ha_scope, revocation

API = "/api/v1"


def _reach(c, mode: str, headers: dict | None = None):
    return c.put(f"{API}/home/building-reach", json={"mode": mode}, headers=headers or {})


def _listed(c, who: str) -> set[str]:
    r = c.get(f"{API}/devices/items", params={"kind": "lights"}, headers=as_user(who))
    assert r.status_code == 200, r.text
    return {i["entity_id"] for f in r.json()["floors"] for a in f["areas"] for i in a["items"]}


def _users(c, s, ids) -> None:
    bind(c, s, "opa", "operator", "building", ids["A"])
    bind(c, s, "opb", "operator", "building", ids["B"])
    bind(c, s, "fla", "operator", "floor", ids["fA"])


def test_a_building_binding_reaches_its_mapped_devices_and_nothing_of_the_other_building(bulk_app):
    app, s, c, fake = bulk_app
    ids = _site(c, app)  # nothing is placed on any map: every reach below comes from the home mapping
    _users(c, s, ids)
    _multi_on(c)
    with app.state.db.connection() as conn:
        site_id = conn.execute("SELECT site_id FROM buildings WHERE id = ?", (ids["A"],)).fetchone()[0]
    m = c.get(f"{API}/sites/{site_id}/mapping").json()
    assert (m["building_reach"], m["can_set_reach"]) == ("map_and_mapping", True), "the owner's default"
    # the list, the single control, the entity detail
    assert _listed(c, "opa") == {"light.lobby", "light.lobby_spot", "light.garden"}, "A's floor areas and the area -> building row"
    assert _listed(c, "opb") == {"light.office"}
    assert _act(c, "light.lobby", "r14-1", headers=as_user("opa")).status_code == 202
    assert _act(c, "light.garden", "r14-2", headers=as_user("opa")).status_code == 202
    assert c.get(f"{API}/ha/entities/light.lobby", headers=as_user("opa")).status_code == 200
    for eid, rid in (("light.office", "r14-3"), ("switch.loose", "r14-4")):
        r = _act(c, eid, rid, action="switch.turn_on" if eid.startswith("switch.") else "light.turn_off", headers=as_user("opa"))
        assert (r.status_code, r.json()["code"]) == (403, "forbidden"), eid
    assert c.get(f"{API}/ha/entities/light.office", headers=as_user("opa")).status_code == 403
    assert sorted(p["data"]["entity_id"] for p in fake.calls) == ["light.garden", "light.lobby"]
    # the action's audit rows name the building binding it ran under
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT scope_type, scope_id FROM audit_log WHERE action = 'ha.action' AND reason = 'attempt' AND resource_id = 'light.lobby'").fetchone()
    assert (row["scope_type"], row["scope_id"]) == ("building", ids["A"])
    # a floor binding gains nothing from the mapping (only the placement rule): the same lobby is out of reach for it
    assert _listed(c, "fla") == set()
    assert _act(c, "light.lobby", "r14-5", headers=as_user("fla")).status_code == 403


def test_bulk_and_search_follow_the_same_reach(bulk_app):
    app, s, c, fake = bulk_app
    ids = _site(c, app)
    _multi_on(c)
    bind(c, s, "saa", "site_admin", "building", ids["A"])
    who = as_user("saa")
    prev = c.get(f"{API}/devices/actions/preview", params={"kind": "lights_off", "scope": "area", "id": "lobby"}, headers=who)
    assert prev.status_code == 200 and {t["entity_id"] for t in prev.json()["targets"]} == {"light.lobby"}
    run = c.post(f"{API}/devices/actions", json=_bulk(scope="area", id="lobby", kind="lights_off", preview_digest=prev.json()["digest"]), headers=who)
    assert run.status_code == 202, run.text
    _finish(c, run.json()["id"], headers=who)
    assert c.get(f"{API}/devices/actions/preview", params={"kind": "lights_off", "scope": "area", "id": "office"}, headers=who).status_code == 403
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('ui.global_search', 'all') ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    hits = c.get(f"{API}/search", params={"q": "light"}, headers=who)
    assert hits.status_code == 200, hits.text
    found = {h["id"] for h in hits.json()["results"] if h["kind"] == "entity"}
    assert "light.lobby" in found and "light.office" not in found, found


def test_the_setting_map_only_removes_the_mapping_reach_and_is_admin_only_and_audited(bulk_app):
    app, s, c, fake = bulk_app
    ids = _site(c, app)
    _users(c, s, ids)
    _multi_on(c)
    bind(c, s, "saa", "site_admin", "building", ids["A"])
    # not an administrator of roles: refused, audited, unchanged
    r = _reach(c, "map", headers=as_user("saa"))
    assert r.status_code == 403
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT 1 FROM audit_log WHERE action = 'rbac.roles.manage' AND decision = 'denied'").fetchone()
        assert building_scope.reach_mode(conn) == "map_and_mapping"
    gen = revocation.generation("dev-opa")
    assert _reach(c, "map").status_code == 200
    assert revocation.generation("dev-opa") > gen, "open sockets re-scope at once"
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'security.building_reach' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert json.loads(row["details_json"]) == {"mode": "map", "was": "map_and_mapping", "multi_building": True}
    assert _listed(c, "opa") == set()
    assert _act(c, "light.lobby", "m-1", headers=as_user("opa")).status_code == 403
    assert c.put(f"{API}/home/building-reach", json={"mode": "anything"}).status_code == 422
    # and back
    assert _reach(c, "map_and_mapping").status_code == 200
    assert _act(c, "light.lobby", "m-2", headers=as_user("opa")).status_code == 202


def test_remapping_an_area_moves_its_reach_at_once(bulk_app):
    app, s, c, fake = bulk_app
    ids = _site(c, app)
    _users(c, s, ids)
    _multi_on(c)
    assert "light.lobby" in _listed(c, "opa") and "light.lobby" not in _listed(c, "opb")
    gen = revocation.generation("dev-opb")
    r = c.put(f"{API}/floors/{ids['fB']}/home-link", json={"areas": {"lobby": "include"}})  # the administrator moves the lobby to B
    assert r.status_code == 200, r.text
    assert revocation.generation("dev-opb") > gen, "a socket opened before the remap re-scopes now"
    assert "light.lobby" not in _listed(c, "opa") and "light.lobby" in _listed(c, "opb")
    assert _act(c, "light.lobby", "rm-a", headers=as_user("opa")).status_code == 403
    assert _act(c, "light.lobby", "rm-b", headers=as_user("opb")).status_code == 202
    # an area taken off every floor by hand, with no area -> building row: no building, no extra reach for anyone
    assert c.put(f"{API}/floors/{ids['fB']}/home-link", json={"areas": {"lobby": "exclude"}}).status_code == 200
    assert "light.lobby" not in _listed(c, "opa") | _listed(c, "opb")


def test_an_explicit_deny_on_the_mapped_floor_wins(bulk_app):
    app, s, c, fake = bulk_app
    ids = _site(c, app)
    _users(c, s, ids)
    _multi_on(c)
    from smplwise.db import Database, new_id, now_iso, permission_revision

    with Database(s.db_path).connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'dev-opa', 'operator', 'floor', ?, 'deny', ?, 'test', ?)", (new_id(), ids["fA"], permission_revision(conn), now_iso()))
    assert _listed(c, "opa") == {"light.garden"}, "the floor's areas are denied; the area -> building row has no floor to deny"


def test_a_floor_editor_cannot_pull_another_buildings_area_into_his_building(bulk_app):
    """The RemapGuard: while the mapping counts for reach, an area leaving its building needs that building's edit too - audited 403, the
    rows untouched. With the switch off the same edit is today's (the mapping is no permission then)."""
    app, s, c, fake = bulk_app
    ids = _site(c, app)
    bind(c, s, "eda", "site_admin", "floor", ids["fA"])
    _multi_on(c)

    def area_row(aid: str):
        with app.state.db.connection() as conn:
            r = conn.execute("SELECT floor_id FROM home_area_links WHERE area_id = ?", (aid,)).fetchone()
        return r[0] if r else "absent"

    r = c.put(f"{API}/floors/{ids['fA']}/home-link", json={"areas": {"office": "include"}}, headers=as_user("eda"))
    assert r.status_code == 403, r.text
    assert area_row("office") == "absent", "nothing written"
    with app.state.db.connection() as conn:
        denied = conn.execute("SELECT resource_type, resource_id FROM audit_log WHERE action = 'site.content.configure' AND decision = 'denied' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert (denied["resource_type"], denied["resource_id"]) == ("floor", ids["fB"])
        assert not conn.execute("SELECT 1 FROM audit_log WHERE action = 'floor.home_link' AND actor_user_id = 'dev-eda'").fetchone()
    # his own building's areas: fine
    assert c.put(f"{API}/floors/{ids['fA']}/home-link", json={"areas": {"garden": "include"}}, headers=as_user("eda")).status_code == 200
    # the same pull with the switch off: as today
    assert c.put(f"{API}/home/multi-building", json={"enabled": False}).status_code == 200
    assert c.put(f"{API}/floors/{ids['fA']}/home-link", json={"areas": {"office": "include"}}, headers=as_user("eda")).status_code == 200
    assert area_row("office") == ids["fA"]


@pytest.mark.parametrize("state", ["multi_off", "map_only"])
def test_off_nothing_new_runs_and_reach_is_todays(bulk_app, monkeypatch, state):
    """The multi-building switch off (the default), or on with "מיקום במפה": the mapping code is never entered (it would raise here) and
    a building binding reaches exactly the placed devices, as before - lists, the single route, the entity detail, the catalogue, a remap."""
    app, s, c, fake = bulk_app
    ids = _site(c, app)
    _users(c, s, ids)
    from test_devices import _place, _publish_plan

    _publish_plan(c, ids["fA"])
    _place(c, ids["fA"], "light.lobby_spot")  # one device placed the old way
    if state == "map_only":
        _multi_on(c)
        assert _reach(c, "map").status_code == 200

    def never(*_a, **_k):
        raise AssertionError("the mapping must not count: the reach code must not run")

    for fn in ("entity_targets", "area_targets", "mapping_changed"):
        monkeypatch.setattr(building_scope, fn, never)
    with app.state.db.connection() as conn:
        wide, floors = ha_scope.visible_floors(conn, ha_scope_principal(conn, "dev-opa"), "devices.read")
        assert not wide and floors.mapped == frozenset()
    assert _listed(c, "opa") == {"light.lobby_spot"}
    assert _act(c, "light.lobby", "off-1", headers=as_user("opa")).status_code == 403
    assert _act(c, "light.lobby_spot", "off-2", headers=as_user("opa")).status_code == 202
    assert c.get(f"{API}/ha/entities/light.lobby", headers=as_user("opa")).status_code == 403
    cat = c.get(f"{API}/ha/entities", headers=as_user("opa"))
    assert cat.status_code == 200 and {e["entity_id"] for e in cat.json()["entities"]} == {"light.lobby_spot"}
    # a remap by the administrator: no guard, no signal - today's route
    assert c.put(f"{API}/floors/{ids['fB']}/home-link", json={"areas": {"lobby": "include"}}).status_code == 200


def ha_scope_principal(conn, user_id: str):
    from smplwise.rbac import Principal

    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return Principal(user_id=row["id"], username=row["username"], display_name=row["username"], source="dev")
