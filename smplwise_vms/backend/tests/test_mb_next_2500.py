"""MULTI-BUILDING-NEXT-2500 (owner decisions 22.11, Q67 / Q69 "then the filtering"; T119 rows MB-SCREENS-FILTER and MB-HA-AREA-SIGNAL).

- The building filter of the full interface's lists (energy meters, schedules, the calendar's shared rooms, the entity catalogue the plan
  editor searches, the global search): display only, it only ever NARROWS what the caller already sees, an item of the shared building
  serves every building, an item in no building shows under every building, an unknown building is 404.
- Switch off, the filter setting off, or one building: every answer is the answer of before (the new code never runs).
- The filter setting is the switch's own permission and audited.
- An area move in the home system while the mapping counts for reach re-scopes the open sockets at once and leaves one audit row."""
from __future__ import annotations

import json

from conftest import as_user, bind
from test_building_scope_control_2351 import _site
from test_devices import AREAS, ENTITY_REGISTRY, FLOORS, bulk_app, dev_app  # noqa: F401 - the fixtures of the bulk tests
from schedules_fixture import *  # noqa: F401,F403 - the schedules fixture's own fixtures
from schedules_fixture import sched_app  # noqa: F401

from smplwise.services import building_filter, revocation

API = "/api/v1"


def _multi(c, on: bool = True) -> None:
    body: dict = {"enabled": on}
    if on:
        body["check_digest"] = c.get(f"{API}/home/multi-building/check").json()["digest"]
    r = c.put(f"{API}/home/multi-building", json=body)
    assert r.status_code == 200, r.text


def _audit(app, action: str) -> list[dict]:
    with app.state.db.connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"] or "{}")
    return rows


def _three(c, app) -> dict[str, str]:
    """_site's two buildings with B made a plain building (office), plus the shared car park P holding the garden: A = lobby / empty_room,
    B = office, P (shared) = garden."""
    ids = _site(c, app)
    assert c.patch(f"{API}/buildings/{ids['B']}", json={"is_shared": False}).status_code == 200
    site = _site_of(app, ids["A"])
    p = c.post(f"{API}/sites/{site}/buildings", json={"name": "חניון"}).json()
    assert c.patch(f"{API}/buildings/{p['id']}", json={"is_shared": True}).status_code == 200
    with app.state.db.connection() as conn:
        conn.execute("UPDATE home_area_buildings SET building_id = ? WHERE area_id = 'garden'", (p["id"],))
    return {**ids, "P": p["id"]}


def _site_of(app, building_id: str) -> str:
    with app.state.db.connection() as conn:
        return conn.execute("SELECT site_id FROM buildings WHERE id = ?", (building_id,)).fetchone()[0]


def _ents(c, headers=None, **q) -> dict:
    r = c.get(f"{API}/ha/entities", params=q, headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def _raise(*_a, **_k):
    raise AssertionError("the building filter ran although the list must stay as before")


# --------------------------------------------------------------------------------------------------------------- off = exactly before

def test_switch_off_setting_off_or_one_building_keep_every_list_of_before(bulk_app, monkeypatch):
    app, _s, c, _fake = bulk_app
    before = _ents(c)
    ids = _three(c, app)
    off = _ents(c)
    assert "building_filter" not in off and all("buildings" not in e for e in off["entities"])
    # the switch off: a `building` parameter changes nothing and the filter's code never runs
    monkeypatch.setattr(building_filter, "View", _raise)
    assert _ents(c, building=ids["B"]) == off
    assert {e["entity_id"] for e in off["entities"]} == {e["entity_id"] for e in before["entities"]}
    monkeypatch.undo()
    # the switch on, the filter setting off: the same
    _multi(c)
    assert c.put(f"{API}/home/multi-building/filter", json={"mode": "off"}).status_code == 200
    monkeypatch.setattr(building_filter, "View", _raise)
    assert _ents(c, building=ids["B"]) == off
    monkeypatch.undo()
    # on again: the filter appears
    assert c.put(f"{API}/home/multi-building/filter", json={"mode": "on"}).status_code == 200
    assert "building_filter" in _ents(c)
    # one live building left: no filter, the parameter ignored
    with app.state.db.connection() as conn:
        conn.execute("UPDATE buildings SET deleted_at = '2026-11-24T00:00:00Z' WHERE id IN (?, ?)", (ids["B"], ids["P"]))
    one = _ents(c, building=ids["B"])
    assert "building_filter" not in one and all("buildings" not in e for e in one["entities"])


# --------------------------------------------------------------------------------------------------------------- the rule of the filter

def test_the_catalogue_names_each_entitys_buildings_and_narrows_to_one(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _three(c, app)
    _multi(c)
    full = _ents(c)
    meta = full["building_filter"]
    assert [b["id"] for b in meta["buildings"]] == [ids["A"], ids["B"], ids["P"]], "the full interface's order, the shared building last"
    assert meta["building"] is None
    by = {e["entity_id"]: e["buildings"] for e in full["entities"]}
    assert by["light.lobby"] == [ids["A"]] and by["light.office"] == [ids["B"]]
    assert by["light.garden"] == [ids["A"], ids["B"], ids["P"]], "Q67: the shared building's item serves every building"
    assert by["switch.loose"] == [], "no area = no building"
    b = _ents(c, building=ids["B"])
    got = {e["entity_id"] for e in b["entities"]}
    assert "light.office" in got and "light.garden" in got and "switch.loose" in got, "its own, the shared building's, and the unplaced"
    assert "light.lobby" not in got and "cover.office" in got
    assert got <= set(by), "the filter never adds an entity"
    assert b["building_filter"]["building"] == ids["B"]
    p = _ents(c, building=ids["P"])
    assert "light.garden" in {e["entity_id"] for e in p["entities"]} and "light.office" not in {e["entity_id"] for e in p["entities"]}
    # an unknown or deleted building: the shared 404 of the building cut
    r = c.get(f"{API}/ha/entities", params={"building": "nope"})
    assert (r.status_code, r.json()["code"]) == (404, "building_not_found")


def test_the_filter_only_narrows_what_a_scoped_person_sees(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _three(c, app)
    _multi(c)
    bind(c, s, "resA", "operator", "building", ids["A"])
    who = as_user("resA")
    mine = _ents(c, who)
    seen = {e["entity_id"] for e in mine["entities"]}
    assert "light.office" not in seen, "building A's operator never reaches B's light"
    for b in (ids["A"], ids["B"], ids["P"]):
        r = c.get(f"{API}/ha/entities", params={"building": b}, headers=who)
        assert r.status_code == 200
        assert {e["entity_id"] for e in r.json()["entities"]} <= seen, "choosing a building never shows more than the person sees"
    # the choices are the buildings the person's own entities sit in - never a building they see nothing of
    meta = mine.get("building_filter")
    if meta is not None:
        assert ids["B"] not in {x["id"] for x in meta["buildings"]}


def test_the_energy_meters_follow_their_areas_buildings(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _three(c, app)
    with app.state.db.connection() as conn:
        for mid, area in (("mA", "lobby"), ("mB", "office"), ("mP", "garden"), ("m0", None)):
            conn.execute("""INSERT INTO energy_meters (id, source_kind, source_ref, display_name, unit, unit_factor, area_id, status, created_at, updated_at)
                            VALUES (?, 'ha_entity', ?, ?, 'kWh', 1000, ?, 'active', '2026-11-24T00:00:00Z', '2026-11-24T00:00:00Z')""", (mid, f"sensor.{mid}", mid, area))
    off = c.get(f"{API}/energy/meters").json()
    assert "building_filter" not in off and all("buildings" not in m for m in off["items"])
    _multi(c)
    on = c.get(f"{API}/energy/meters").json()
    by = {m["id"]: m["buildings"] for m in on["items"]}
    assert by == {"mA": [ids["A"]], "mB": [ids["B"]], "mP": [ids["A"], ids["B"], ids["P"]], "m0": []}
    a = c.get(f"{API}/energy/meters", params={"building": ids["A"]}).json()
    assert {m["id"] for m in a["items"]} == {"mA", "mP", "m0"} and a["building_filter"]["building"] == ids["A"]
    assert c.get(f"{API}/energy/meters", params={"building": "nope"}).status_code == 404


def test_the_global_search_narrows_its_hits_to_one_building(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _three(c, app)
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES ('ui.global_search', 'all') ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    off = c.get(f"{API}/search", params={"q": "light", "limit": 20}).json()
    assert "building_filter" not in off
    _multi(c)
    on = c.get(f"{API}/search", params={"q": "light", "limit": 20}).json()
    assert {r["id"] for r in on["results"]} == {r["id"] for r in off["results"]}, "no building chosen: the same hits"
    assert on["counts"] == off["counts"]
    b = c.get(f"{API}/search", params={"q": "light", "limit": 20, "building": ids["B"]}).json()
    got = {r["id"] for r in b["results"]}
    assert "light.office" in got and "light.garden" in got and "light.lobby" not in got
    assert got <= {r["id"] for r in off["results"]}
    assert b["counts"].get("entity", 0) == sum(1 for r in b["results"] if r["kind"] == "entity")
    # a building hit and a floor hit sit in their own building
    hits = c.get(f"{API}/search", params={"q": "קומה", "limit": 20, "building": ids["A"]}).json()["results"]
    assert {r["id"] for r in hits if r["kind"] == "floor"} == {ids["fA"]}


def test_the_calendar_rooms_and_the_view_place_a_floor_in_its_building(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _three(c, app)
    _multi(c)
    with app.state.db.connection() as conn:
        v = building_filter.prepare(conn, ids["A"])
        assert v is not None
        assert v.place(floors=[ids["fA"]]) == [ids["A"]] and v.place(floors=[ids["fB"]]) == [ids["B"]]
        assert v.place(floors=[None]) == [] and v.keep([]) and v.keep([ids["A"]]) and not v.keep([ids["B"]])
        assert v.meta() == {"buildings": [{"id": ids["A"], "name": "בניין א", "is_shared": False}, {"id": ids["B"], "name": "משותף", "is_shared": False}],
                            "building": ids["A"]}
        # nothing seen yet and nothing chosen: no filter key (the list is one building's anyway)
        assert building_filter.prepare(conn, None).meta() is None


def test_the_schedules_list_narrows_before_totals_and_paging(sched_app):
    app, _s, c, _fake, _tr = sched_app
    site = c.post(f"{API}/sites", json={"name": "מתחם"}).json()
    a = c.post(f"{API}/sites/{site['id']}/buildings", json={"name": "מגדל א"}).json()
    b = c.post(f"{API}/sites/{site['id']}/buildings", json={"name": "מגדל ב"}).json()
    fa = c.post(f"{API}/buildings/{a['id']}/floors", json={"name": "קרקע", "level": 0}).json()
    fb = c.post(f"{API}/buildings/{b['id']}/floors", json={"name": "עליונה", "level": 1}).json()
    assert c.put(f"{API}/floors/{fa['id']}/home-link", json={"ha_floor_ids": ["sch_ground"]}).status_code == 200
    assert c.put(f"{API}/floors/{fb['id']}/home-link", json={"ha_floor_ids": ["sch_upper"]}).status_code == 200
    off = c.get(f"{API}/schedules", params={"limit": 500}).json()
    assert "building_filter" not in off and all("buildings" not in s for s in off["items"])
    _multi(c)
    on = c.get(f"{API}/schedules", params={"limit": 500}).json()
    assert on["total"] == off["total"]
    served = {s["id"]: s["buildings"] for s in on["items"]}
    areas = {s["id"]: {e["area_id"] for e in s["entities"]} for s in on["items"]}
    for sid, bs in served.items():
        want = ([a["id"]] if areas[sid] & {"sch_living", "sch_gym", "sch_yard"} else []) + ([b["id"]] if "sch_bedrooms" in areas[sid] else [])
        assert bs == want, sid
    only_b = c.get(f"{API}/schedules", params={"limit": 500, "building": b["id"]}).json()
    kept = {s["id"] for s in only_b["items"]}
    assert kept == {sid for sid, bs in served.items() if not bs or b["id"] in bs}
    assert only_b["total"] == len(kept), "the total counts the building's schedules"
    page = c.get(f"{API}/schedules", params={"limit": 1, "building": b["id"]}).json()
    assert page["total"] == len(kept) and len(page["items"]) <= 1


# --------------------------------------------------------------------------------------------------------------- the filter setting

def test_the_filter_setting_is_the_switchs_permission_and_audited(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _three(c, app)
    site = _site_of(app, ids["A"])
    read = c.get(f"{API}/sites/{site}/mapping").json()
    assert read["filter_mode"] == "on" and read["can_set_filter"] is True, "on by default (the recommendation)"
    assert c.put(f"{API}/home/multi-building/filter", json={"mode": "sometimes"}).status_code == 422
    bind(c, s, "resA", "site_admin", "building", ids["A"])
    r = c.put(f"{API}/home/multi-building/filter", json={"mode": "off"}, headers=as_user("resA"))
    assert r.status_code == 403
    assert c.put(f"{API}/home/multi-building/filter", json={"mode": "off"}).status_code == 200
    rows = _audit(app, "home.multi_building.filter")
    assert rows[-1]["decision"] == "allowed" and rows[-1]["details"] == {"mode": "off", "was": "on", "multi_building": False}
    assert c.get(f"{API}/sites/{site}/mapping").json()["filter_mode"] == "off"


# --------------------------------------------------------------------------------------------------------------- an area move (G4)

def _registry(c, moves: dict[str, str | None]) -> None:
    reg = [{**e, "area_id": moves.get(e["entity_id"], e["area_id"])} for e in ENTITY_REGISTRY]
    r = c.post(f"{API}/ha/dev/registry", json={"entities": reg, "devices": [], "areas": AREAS, "floors": FLOORS})
    assert r.status_code == 200, r.text


def test_an_area_move_while_the_mapping_counts_rescopes_and_is_audited(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _three(c, app)
    # the switch off: the rule before - nothing signalled, nothing audited
    _registry(c, {"light.office": "lobby"})
    assert _audit(app, "home.mapping.area_moved") == []
    _registry(c, {})
    _multi(c)
    uid = "dev-someone"
    revocation.mark([uid])
    gen = revocation.generation(uid)
    _registry(c, {"light.office": "lobby"})
    rows = _audit(app, "home.mapping.area_moved")
    assert len(rows) == 1 and rows[0]["actor_user_id"] in (None, "")
    d = rows[0]["details"]
    assert d["entities"] == 1 and d["sample"] == ["light.office"] and set(d["buildings"]) == {ids["A"], ids["B"]} and d["reach_on"] is True
    with app.state.db.connection() as conn:
        users = [r[0] for r in conn.execute("SELECT id FROM users").fetchall()]
    if uid in users:
        assert revocation.generation(uid) > gen
    # a refresh that moves nothing: no row
    _registry(c, {"light.office": "lobby"})
    assert len(_audit(app, "home.mapping.area_moved")) == 1
    # "מיקום במפה": the mapping does not count for reach - an area move signals nothing
    assert c.put(f"{API}/home/building-reach", json={"mode": "map"}).status_code == 200
    _registry(c, {})
    assert len(_audit(app, "home.mapping.area_moved")) == 1


def test_the_signal_marks_every_user(bulk_app, monkeypatch):
    app, _s, c, _fake = bulk_app
    _three(c, app)
    _multi(c)
    marked: list[set[str]] = []
    monkeypatch.setattr(revocation, "mark", lambda ids: marked.append(set(ids)))
    _registry(c, {"light.office": "lobby"})
    with app.state.db.connection() as conn:
        users = {r[0] for r in conn.execute("SELECT id FROM users").fetchall()}
    assert marked and marked[-1] == users, "every open socket re-scopes at once"
