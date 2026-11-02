"""MAPPING-IMPROVE-2351: the two limits of MAPPING-ASSIST-2330 closed.

1. "קומות ללא מפלס": a home-system floor with no level and no number in its name is asked about (a level, or "the same as an existing floor")
   instead of silently landing on a new floor of level 0; the answers live in the mapping state (state.levels) and travel with its versions.
2. Auto-insert in the background (services/mapping_auto.py): new names placed per the stored rules on a structure refresh and at startup -
   idempotent, never moving what the user already placed, audited, a version of kind `auto` with `auto_added` for the health card notice.
"""
from __future__ import annotations

import json

from conftest import seed_tree

from smplwise.services import mapping_auto
from smplwise.services import mapping_engine as eng

API = "/api/v1"

STATE = {"v": 1, "spec": {"position": "start", "seps": ["·"], "kind": "any", "marker": "בניין"}, "tokens": {}, "manual_tokens": [], "advanced": False, "rules": [], "decisions": {}}


def _db(settings):
    from smplwise.db import Database

    return Database(settings.db_path)


def _sql(settings, sql: str, args: tuple = ()) -> list:
    with _db(settings).connection() as conn:
        return [tuple(r) for r in conn.execute(sql, args).fetchall()]


def _floor(settings, fid: str, name: str, level: int | None) -> None:
    _sql(settings, "INSERT INTO ha_floors(floor_id, name, level, icon, position, updated_at) VALUES (?, ?, ?, NULL, 0, 'x')", (fid, name, level))


def _area(settings, aid: str, name: str, fid: str | None) -> None:
    _sql(settings, "INSERT INTO ha_areas(area_id, name, floor_id, icon, position, updated_at) VALUES (?, ?, ?, NULL, 0, 'x')", (aid, name, fid))


def _audits(settings, action: str) -> list[dict]:
    return [json.loads(r[0] or "{}") for r in _sql(settings, "SELECT details_json FROM audit_log WHERE action = ? AND decision = 'allowed' ORDER BY rowid", (action,))]


# ------------------------------------------------------------------------------------------------------------------------------- the engine

def _items(*xs: tuple) -> list[eng.Item]:
    out = []
    for x in xs:
        if x[0] == "f":
            out.append(eng.Item(id=x[1], kind="floor", name=x[2], level=x[3]))
        else:
            out.append(eng.Item(id=x[1], kind="area", name=x[2], floor_id=x[3]))
    return out


def test_engine_port_reads_marks_like_the_browser():
    spec = {"position": "start", "seps": ["·", "-", ":"], "kind": "any", "marker": "בניין"}
    assert eng.tokenize("א · לובי", None, spec) == ("א", "·", "לובי")
    assert eng.tokenize("ג-גג", None, spec) == ("ג", "-", "גג")
    assert eng.tokenize("חניון -1", None, spec) is None  # a minus sign is not a separator
    assert eng.tokenize("לובי · א", None, {**spec, "position": "end"}) == ("א", "·", "לובי")
    assert eng.tokenize("לובי בניין צפון", None, {**spec, "position": "word"}) == ("צפון", "", "לובי")
    assert eng.kind_ok("12", "number") and not eng.kind_ok("12345", "number") and eng.kind_ok("א", "letter") and not eng.kind_ok("אב", "letter")
    assert eng.level_from_name("קומה 2") == 2 and eng.level_from_name("קרקע") == 0 and eng.level_from_name("חניון -1") == -1 and eng.level_from_name("גלריה") is None
    b = [{"id": "bA", "name": "בניין א"}, {"id": "bB", "name": "ב"}]
    st = eng.state_of({**STATE, "tokens": {"ג": {"t": "none"}}, "decisions": {"a:x": {"t": "b", "id": "bB"}}})
    items = _items(("f", "f1", "א · קומה 1", 1), ("a", "a1", "לובי", "f1"), ("a", "x", "א · מחסן", None), ("a", "a3", "ג · חדר", None), ("a", "a4", "ז · חדר", None))
    res = eng.resolve(items, st, b, eng.SETTINGS_DEFAULT)
    assert res["f:f1"].to == {"t": "b", "id": "bA"} and res["a:a1"].src == "floor"  # floor inheritance (2A)
    assert res["a:x"].src == "manual" and res["a:x"].to == {"t": "b", "id": "bB"}  # manual beats the mark
    assert res["a:a3"].to == {"t": "none"} and not res["a:a3"].open
    assert res["a:a4"].open and res["a:a4"].conflict == "unknown_token"
    off = eng.resolve(items, st, b, {**eng.SETTINGS_DEFAULT, "floor_inherit": "off"})
    assert off["a:a1"].open


def test_levels_step_engine_asks_then_follows_the_answer():
    b = [{"id": "bA", "name": "בניין א"}]
    ours = [{"id": "of2", "building_id": "bA", "name": "קומה 2", "level": 2}]
    items = _items(("f", "g", "א · גלריה", None), ("f", "k", "א · קומה 2", None), ("f", "same", "א · קומה 2 ", 2))
    links = {"floors": [], "areas": [], "buildings": []}
    st = eng.state_of(STATE)
    res = eng.resolve(items, st, b, eng.SETTINGS_DEFAULT)
    asked: list = []
    plan = eng.build_plan(items, res, b, ours, links, st["levels"], asked)
    # only the floor with no level anywhere is asked about ("קומה 2" carries its level in the name)
    assert [a["id"] for a in asked] == ["g"] and asked[0]["building"] == "bA" and asked[0]["rest"] == "גלריה" and asked[0]["answer"] is None
    # unanswered = the old behaviour (a new floor of level 0)
    assert plan["new_floors"] == [{"key": "f1", "building": "bA", "name": "גלריה", "level": 0}]
    # a level answer
    lv = eng.build_plan(items, res, b, ours, links, {"g": {"t": "level", "level": 7}})
    assert lv["new_floors"] == [{"key": "f1", "building": "bA", "name": "גלריה", "level": 7}]
    # the level of an existing floor = that floor
    lv2 = eng.build_plan(items, res, b, ours, links, {"g": {"t": "level", "level": 2}})
    assert {"ha_floor_id": "g", "floor": "of2"} in lv2["floors"] and lv2["new_floors"] == []
    # "זהה לקומה קיימת"
    same = eng.build_plan(items, res, b, ours, links, {"g": {"t": "floor", "id": "of2"}})
    assert {"ha_floor_id": "g", "floor": "of2"} in same["floors"] and same["new_floors"] == []
    # skip = level 0, as before
    skip = eng.build_plan(items, res, b, ours, links, {"g": {"t": "skip"}})
    assert skip["new_floors"][0]["level"] == 0
    # stored answers are normalized on read; junk is dropped
    st2 = eng.state_of({**STATE, "levels": {"g": {"t": "level", "level": 7}, "h": {"t": "level", "level": "x"}, "i": {"t": "floor", "id": "of2"}, "j": {"t": "skip"}, "k": {"t": "?"}}})
    assert st2["levels"] == {"g": {"t": "level", "level": 7}, "i": {"t": "floor", "id": "of2"}, "j": {"t": "skip"}}


def test_subset_plan_keeps_only_the_new_rows_it_names():
    plan = {"new_buildings": [{"key": "b1", "name": "x"}, {"key": "b2", "name": "y"}], "new_floors": [{"key": "f1", "building": "new:b1", "name": "a", "level": 1}, {"key": "f2", "building": "bA", "name": "b", "level": 2}],
            "floors": [{"ha_floor_id": "h1", "floor": "new:f1"}, {"ha_floor_id": "h2", "floor": "new:f2"}], "areas": [{"area_id": "a1", "floor": "keep", "building": "new:b2"}], "items": []}
    sub = eng.subset_plan(plan, {"f:h2"})
    assert sub["floors"] == [{"ha_floor_id": "h2", "floor": "new:f2"}] and [f["key"] for f in sub["new_floors"]] == ["f2"] and sub["new_buildings"] == [] and sub["areas"] == []


# ------------------------------------------------------------------------------------------------------------------------------- levels state

def test_level_answers_persist_in_the_state_and_its_versions(client, settings):
    ids = seed_tree(client)
    _floor(settings, "hf_g", "א · גלריה", None)
    url = f"{API}/sites/{ids['site']}/mapping"
    st = {**STATE, "levels": {"hf_g": {"t": "level", "level": 7}}}
    r = client.put(f"{url}/state", json={"state": st, "revision": 0})
    assert r.status_code == 200 and r.json()["revision"] == 1
    assert client.get(url).json()["state"]["levels"] == {"hf_g": {"t": "level", "level": 7}}
    plan = {"new_floors": [{"key": "f1", "building": ids["building"], "name": "גלריה", "level": 7}], "floors": [{"ha_floor_id": "hf_g", "floor": "new:f1"}], "items": ["f:hf_g"]}
    r = client.post(f"{url}/apply", json={"state": st, "revision": 1, "plan": plan})
    assert r.status_code == 200, r.text
    assert _sql(settings, "SELECT level FROM floors WHERE name = 'גלריה'") == [(7,)]
    # the answer changes; restoring version 1 brings the old answer back with its rows
    st2 = {**STATE, "levels": {"hf_g": {"t": "floor", "id": ids["floor2"]}}}
    assert client.put(f"{url}/state", json={"state": st2, "revision": 2}).status_code == 200
    assert client.post(f"{url}/versions/1/restore").status_code == 200
    assert client.get(url).json()["state"]["levels"] == {"hf_g": {"t": "level", "level": 7}}
    assert json.loads(_sql(settings, "SELECT state_json FROM home_mapping_versions WHERE number = 1")[0][0])["levels"]["hf_g"]["level"] == 7


# ------------------------------------------------------------------------------------------------------------------------------- the job

def _applied_site(client, settings) -> dict[str, str]:
    """A site mapped once (version 1 saw every name), auto-insert on."""
    ids = seed_tree(client)
    _floor(settings, "hf_a2", "א · קומה 2", 2)
    _area(settings, "lobby", "א · לובי", "hf_a2")
    url = f"{API}/sites/{ids['site']}/mapping"
    plan = {"floors": [{"ha_floor_id": "hf_a2", "floor": ids["floor2"]}], "items": ["f:hf_a2", "a:lobby"]}
    assert client.post(f"{url}/apply", json={"state": STATE, "plan": plan}).status_code == 200
    assert client.put(f"{url}/settings", json={"auto_insert": "on"}).status_code == 200
    return ids


def test_job_places_new_names_once_and_is_idempotent(client, settings):
    ids = _applied_site(client, settings)
    url = f"{API}/sites/{ids['site']}/mapping"
    _area(settings, "store", "א · מחסן", "hf_a2")  # inherits its floor: placed, no row needed
    _area(settings, "bikes", "א · אופניים", None)  # no platform floor: an area -> building row
    _floor(settings, "hf_a4", "א · קומה 4", 4)  # a floor of a level we lack: a new floor (level 4)
    _area(settings, "mystery", "ז · חדר", None)  # an unknown mark: a question - not placed
    out = mapping_auto.run(_db(settings), "test")
    assert out == {ids["site"]: 2}
    m = client.get(url).json()
    v = m["versions"][0]
    assert v["kind"] == "auto" and v["summary"]["auto_added"] == 3 and v["summary"]["auto_areas"] == 2 and v["summary"]["auto_floors"] == 1
    assert {"a:store", "a:bikes", "f:hf_a4"} <= set(m["seen"]) and "a:mystery" not in m["seen"]
    links = m["links"]
    assert {"area_id": "bikes", "building_id": ids["building"]} in links["buildings"]
    new_floor = _sql(settings, "SELECT id FROM floors WHERE building_id = ? AND level = 4", (ids["building"],))
    assert len(new_floor) == 1 and {"ha_floor_id": "hf_a4", "floor_id": new_floor[0][0]} in links["floors"]
    assert all(a["area_id"] != "store" for a in links["areas"])  # follows its floor, no override row
    a = _audits(settings, "home.mapping.apply")[-1]
    assert a["kind"] == "auto" and a["version"] == 2 and set(a["added"]) == {"a:store", "a:bikes", "f:hf_a4"}
    assert _audits(settings, "floor.create")[-1]["via"] == "home.mapping.auto"
    # the auto version's audit row has no user (the system)
    assert _sql(settings, "SELECT actor_user_id FROM audit_log WHERE action = 'home.mapping.apply' ORDER BY rowid DESC LIMIT 1") == [(None,)]
    # idempotent: nothing new, nothing written
    assert mapping_auto.run(_db(settings), "test") == {}
    assert len(client.get(url).json()["versions"]) == 2
    assert len(_sql(settings, "SELECT 1 FROM floors WHERE level = 4")) == 1


def test_job_never_moves_what_the_user_placed(client, settings):
    ids = _applied_site(client, settings)
    b2 = client.post(f"{API}/sites/{ids['site']}/buildings", json={"name": "ב"}).json()
    _area(settings, "placed", "א · חדר", None)
    _area(settings, "placed2", "א · ארכיון", "hf_a2")
    _floor(settings, "hf_x", "א · קומה 9", 9)
    # the user placed them by hand (the floor dialog / an earlier apply) before the job ran
    _sql(settings, "INSERT INTO home_area_buildings(area_id, building_id, updated_at, updated_by) VALUES ('placed', ?, 'x', 'u')", (b2["id"],))
    _sql(settings, "INSERT INTO home_area_links(area_id, floor_id, updated_at, updated_by) VALUES ('placed2', NULL, 'x', 'u')")
    _sql(settings, "INSERT INTO home_floor_links(ha_floor_id, floor_id, updated_at, updated_by) VALUES ('hf_x', ?, 'x', 'u')", (ids["floor3"],))
    _area(settings, "fresh", "א · מטבח", None)
    assert mapping_auto.run(_db(settings), "test") == {ids["site"]: 2}
    assert _sql(settings, "SELECT building_id, updated_by FROM home_area_buildings WHERE area_id = 'placed'") == [(b2["id"], "u")]
    assert _sql(settings, "SELECT floor_id, updated_by FROM home_area_links WHERE area_id = 'placed2'") == [(None, "u")]
    assert _sql(settings, "SELECT floor_id, updated_by FROM home_floor_links WHERE ha_floor_id = 'hf_x'") == [(ids["floor3"], "u")]
    a = _audits(settings, "home.mapping.apply")[-1]
    assert a["added"] == ["a:fresh"] and set(a["kept"]) == {"a:placed", "a:placed2", "f:hf_x"}
    # the kept ones stay "new" for the user to look at; the job does not write again for them
    seen = set(client.get(f"{API}/sites/{ids['site']}/mapping").json()["seen"])
    assert "a:fresh" in seen and not ({"a:placed", "a:placed2", "f:hf_x"} & seen)
    assert mapping_auto.run(_db(settings), "test") == {}


def test_job_waits_for_a_level_answer_and_respects_the_setting(client, settings):
    ids = _applied_site(client, settings)
    url = f"{API}/sites/{ids['site']}/mapping"
    _floor(settings, "hf_g", "א · גלריה", None)
    _area(settings, "gal", "פינת קריאה", "hf_g")  # no mark: would inherit the floor - but the floor waits
    assert mapping_auto.run(_db(settings), "test") == {}
    assert _sql(settings, "SELECT 1 FROM floors WHERE name = 'גלריה'") == []
    # the answer comes from the assistant's "קומות ללא מפלס" step
    rev = client.get(url).json()["revision"]
    assert client.put(f"{url}/state", json={"state": {**STATE, "levels": {"hf_g": {"t": "level", "level": 7}}}, "revision": rev}).status_code == 200
    # setting off: nothing
    assert client.put(f"{url}/settings", json={"auto_insert": "off"}).status_code == 200
    assert mapping_auto.run(_db(settings), "test") == {}
    assert client.put(f"{url}/settings", json={"auto_insert": "on"}).status_code == 200
    assert mapping_auto.run(_db(settings), "test") == {ids["site"]: 2}
    assert _sql(settings, "SELECT level FROM floors WHERE name = 'גלריה'") == [(7,)]
    m = client.get(url).json()
    assert m["versions"][0]["summary"]["auto_added"] == 2 and {"f:hf_g", "a:gal"} <= set(m["seen"])


def test_job_skips_a_site_never_applied(client, settings):
    ids = seed_tree(client)
    _floor(settings, "hf_a2", "א · קומה 2", 2)
    assert client.put(f"{API}/sites/{ids['site']}/mapping/settings", json={"auto_insert": "on"}).status_code == 200
    assert mapping_auto.run(_db(settings), "test") == {}  # no version yet: the assistant decides first
    assert _sql(settings, "SELECT 1 FROM home_mapping_versions") == []


def test_job_writes_nothing_from_a_stale_snapshot(client, settings):
    ids2 = _applied_site(client, settings)
    _area(settings, "fresh", "א · מטבח", None)
    with _db(settings).connection(mode="read") as conn:
        r = conn.execute("SELECT site_id, state_json, settings_json FROM home_mapping_state WHERE site_id = ?", (ids2["site"],)).fetchone()
        snap = mapping_auto._snapshot(conn, r["site_id"], r["state_json"], r["settings_json"])
    work = mapping_auto.compute(snap)
    assert work and work.added == ["a:fresh"]
    rev = client.get(f"{API}/sites/{ids2['site']}/mapping").json()["revision"]
    assert client.put(f"{API}/sites/{ids2['site']}/mapping/state", json={"state": {**STATE, "decisions": {"a:fresh": {"t": "none"}}}, "revision": rev}).status_code == 200
    with _db(settings).connection() as conn:
        assert mapping_auto._write(conn, snap, work, "test") is None
    assert _sql(settings, "SELECT 1 FROM home_area_buildings WHERE area_id = 'fresh'") == []


def test_job_reads_the_synced_labels_like_the_browser(client, settings):
    """2360 train (HA-LABELS-SYNC-2351 x MAPPING-IMPROVE-2351): the job reads the label mirror, so a label that points to another building
    leaves the name open (a "label" conflict, as the assistant shows it) instead of placing it by its mark."""
    ids = _applied_site(client, settings)
    b2 = client.post(f"{API}/sites/{ids['site']}/buildings", json={"name": "ב"}).json()
    _area(settings, "clash", "א · מחסן", None)  # the mark says א, the label says ב
    _area(settings, "agree", "א · ארכיון", None)  # the label agrees with the mark
    _sql(settings, "INSERT INTO ha_labels(label_id, name, color, icon, description, position, updated_at) VALUES ('lb', 'ב', NULL, NULL, NULL, 0, 'x'), ('la', 'א', NULL, NULL, NULL, 1, 'x')")
    _sql(settings, "INSERT INTO ha_area_labels(area_id, label_id, position) VALUES ('clash', 'lb', 0), ('agree', 'la', 0)")
    with _db(settings).connection(mode="read") as conn:
        r = conn.execute("SELECT site_id, state_json, settings_json FROM home_mapping_state WHERE site_id = ?", (ids["site"],)).fetchone()
        snap = mapping_auto._snapshot(conn, r["site_id"], r["state_json"], r["settings_json"])
    by_id = {it.id: it for it in snap.items}
    assert by_id["clash"].labels == ["ב"] and by_id["agree"].labels == ["א"] and by_id["lobby"].labels == []
    assert mapping_auto.run(_db(settings), "test") == {ids["site"]: 2}
    assert _audits(settings, "home.mapping.apply")[-1]["added"] == ["a:agree"]
    assert _sql(settings, "SELECT 1 FROM home_area_buildings WHERE area_id = 'clash'") == []
    assert b2["id"]
