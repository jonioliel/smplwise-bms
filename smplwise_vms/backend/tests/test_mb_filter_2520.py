"""MULTI-BUILDING-FILTER-2520 (2.52, T119 MB-HOME-IFACE step 7): the building filter of the notice board's reader list
(`GET /notices?scope=mine&building=`), which the home interface's notice board reads.

- Display only, it only ever NARROWS what the reader already sees: a notice's buildings are the buildings of its audience floors (and of
  its audience areas' floors); a notice with no floor in its audience (everyone / groups / roles) shows under every building; a floor of
  the shared building serves every building; an unknown building is the shared 404.
- Switch off, the filter setting off, or one building: the answer of before (the filter's code never runs).
- The managers' list (`scope=all`) never changes."""
from __future__ import annotations

from conftest import as_user, bind
from test_devices import AREAS, ENTITY_REGISTRY, FLOORS, bulk_app, dev_app  # noqa: F401 - the fixtures of the bulk tests
from test_mb_next_2500 import _multi, _raise, _three

from smplwise.services import building_filter

API = "/api/v1"


def _on(c) -> None:
    r = c.patch(f"{API}/notices/settings", json={"enabled": True})
    assert r.status_code == 200, r.text


def _notice(c, title: str, audience: dict) -> str:
    r = c.post(f"{API}/notices", json={"title": title, "body": "", "severity": "info", "publish": True, "audience": audience})
    assert r.status_code == 200, r.text
    return r.json()["notice"]["id"]


def _mine(c, headers=None, **q) -> dict:
    r = c.get(f"{API}/notices", params={"scope": "mine", **q}, headers=headers or {})
    assert r.status_code == 200, r.text
    out = r.json()
    out.pop("now")  # the clock of the answer, not part of the list
    return out


def _world(c, app) -> tuple[dict[str, str], dict[str, str]]:
    """Building A (floor fA), building B (floor fB), the shared car park P (its own floor fP); one notice per place and one for everyone."""
    ids = _three(c, app)
    fp = c.post(f"{API}/buildings/{ids['P']}/floors", json={"name": "חניון -1", "level": -1}).json()["id"]
    _on(c)
    n = {
        "a": _notice(c, "מעלית א", {"floors": [ids["fA"]]}),
        "b": _notice(c, "מעלית ב", {"floors": [ids["fB"]]}),
        "ab": _notice(c, "שני המגדלים", {"floors": [ids["fA"], ids["fB"]]}),
        "p": _notice(c, "החניון", {"floors": [fp]}),
        "all": _notice(c, "לכולם", {"everyone": True}),
    }
    return {**ids, "fP": fp}, n


def test_off_setting_off_or_one_building_keep_the_list_of_before(bulk_app, monkeypatch):
    app, _s, c, _fake = bulk_app
    ids, _n = _world(c, app)
    before = _mine(c)
    assert "building_filter" not in before and all("buildings" not in x for x in before["notices"])
    # the switch off: the parameter changes nothing and the filter's code never runs
    monkeypatch.setattr(building_filter, "View", _raise)
    assert _mine(c, building=ids["B"]) == before
    monkeypatch.undo()
    # the switch on, the filter setting off: the same
    _multi(c)
    assert c.put(f"{API}/home/multi-building/filter", json={"mode": "off"}).status_code == 200
    monkeypatch.setattr(building_filter, "View", _raise)
    off = _mine(c, building=ids["B"])
    assert off["notices"] == before["notices"] and "building_filter" not in off
    monkeypatch.undo()
    assert c.put(f"{API}/home/multi-building/filter", json={"mode": "on"}).status_code == 200
    assert "building_filter" in _mine(c)
    # one live building left: no filter key, the parameter ignored
    with app.state.db.connection() as conn:
        conn.execute("UPDATE buildings SET deleted_at = '2026-11-25T00:00:00Z' WHERE id IN (?, ?)", (ids["B"], ids["P"]))
    one = _mine(c, building=ids["B"])
    assert "building_filter" not in one and all("buildings" not in x for x in one["notices"])


def test_each_notice_names_its_audiences_buildings_and_the_list_narrows_to_one(bulk_app):
    app, _s, c, _fake = bulk_app
    ids, n = _world(c, app)
    _multi(c)
    full = _mine(c)
    meta = full["building_filter"]
    assert [b["id"] for b in meta["buildings"]] == [ids["A"], ids["B"], ids["P"]], "the full interface's order, the shared building last"
    assert meta["building"] is None
    by = {x["id"]: x["buildings"] for x in full["notices"]}
    assert by[n["a"]] == [ids["A"]] and by[n["b"]] == [ids["B"]]
    assert by[n["ab"]] == [ids["A"], ids["B"]], "a notice for both towers shows in each"
    assert by[n["p"]] == [ids["A"], ids["B"], ids["P"]], "the shared building's notice serves every building"
    assert by[n["all"]] == [], "no floor in the audience = no building: shown under every building"
    got = {x["id"] for x in _mine(c, building=ids["B"])["notices"]}
    assert got == {n["b"], n["ab"], n["p"], n["all"]}
    assert got <= set(by), "the filter never adds a notice"
    assert _mine(c, building=ids["B"])["building_filter"]["building"] == ids["B"]
    r = c.get(f"{API}/notices", params={"scope": "mine", "building": "nope"})
    assert (r.status_code, r.json()["code"]) == (404, "building_not_found")


def test_the_managers_list_is_unchanged(bulk_app):
    app, _s, c, _fake = bulk_app
    ids, _n = _world(c, app)
    before = c.get(f"{API}/notices", params={"scope": "all"}).json()
    _multi(c)
    after = c.get(f"{API}/notices", params={"scope": "all", "building": ids["B"]}).json()
    assert "building_filter" not in after and all("buildings" not in x for x in after["notices"])
    assert [x["id"] for x in after["notices"]] == [x["id"] for x in before["notices"]]


def test_a_building_a_reader_only_ever_gets_a_subset(bulk_app):
    app, s, c, _fake = bulk_app
    ids, n = _world(c, app)
    _multi(c)
    bind(c, s, "resA", "viewer", "building", ids["A"])
    who = as_user("resA")
    mine = _mine(c, who)
    seen = {x["id"] for x in mine["notices"]}
    assert n["b"] not in seen, "building A's reader never reads B's notice"
    for b in (ids["A"], ids["B"], ids["P"]):
        r = c.get(f"{API}/notices", params={"scope": "mine", "building": b}, headers=who)
        assert r.status_code == 200
        assert {x["id"] for x in r.json()["notices"]} <= seen, "choosing a building never shows more than the reader sees"
    assert seen == {n["a"], n["ab"], n["all"]}, "the floor audiences of A (and of A + B) and everyone; never B's or the car park's own"
    # the choices are the buildings the reader's own notices sit in: A, and B through the notice for both towers - never the car park,
    # which the reader reads nothing of
    assert [x["id"] for x in mine["building_filter"]["buildings"]] == [ids["A"], ids["B"]]
