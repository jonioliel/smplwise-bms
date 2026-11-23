"""MULTI-BUILDING-HOME-2500 (owner decisions 22.11, Q64-Q68): the home interface and the lobby boards on a multi-building site.

- Q64: "כל הבניינים" is hidden; the installation setting `building_all` = allow offers it.
- Q65: the building the home interface opens on - an administrator sets it per person (display only, never a grant); a wall panel uses
  its room's building; not set = the device's last choice (decided by the browser).
- Q66: "כבה הכל" acts on the chosen building only: the bulk route with `building` (services/building_scope cuts it) - the overview's room
  buildings agree with that cut.
- Q67: an item serving two buildings shows in each: the overview places the areas the caller already sees in their buildings (never an area
  the caller does not see).
- Q68: a lobby board belongs to a building and greets with its name.
Switch off, or fewer than two buildings reached: every answer is the answer of before (the new code is replaced by functions that raise)."""
from __future__ import annotations

import json

import pytest
from conftest import as_user, bind
from test_building_scope_control_2351 import _site
from test_devices import _bulk, _finish, bulk_app, dev_app  # noqa: F401 - the fixtures of the bulk tests

from smplwise.services import building_scope, home_buildings

API = "/api/v1"


def _multi(c, on: bool = True) -> None:
    r = c.put(f"{API}/home/multi-building", json={"enabled": on})
    assert r.status_code == 200, r.text


def _ov(c, headers=None) -> dict:
    r = c.get(f"{API}/home/overview", headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def _audit(app, action: str) -> list[dict]:
    with app.state.db.connection() as conn:
        rows = [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]
    for r in rows:
        r["details"] = json.loads(r["details_json"] or "{}")
    return rows


def _raise(*_a, **_k):
    raise AssertionError("the multi-building code ran although the home interface must stay as before")


# ------------------------------------------------------------------------------------------------------------- switch off = as before

def test_switch_off_or_one_building_reached_keeps_the_overview_of_before(bulk_app, monkeypatch):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    off = _ov(c)
    for k in ("buildings", "area_buildings", "building_all", "entry_building"):
        assert k not in off, k
    assert all("building_id" not in r for r in off["rooms"])
    assert "buildings" not in c.get(f"{API}/home/policies").json(), "the switch off: no building picker"
    # the switch off: the new code never runs
    monkeypatch.setattr(home_buildings, "overview_extra", _raise)
    monkeypatch.setattr(home_buildings, "meter_areas", _raise)
    assert _ov(c) == off
    monkeypatch.undo()
    # the switch on, but a person whose rooms are all in building A: exactly the answer of before (no chip, no building names)
    _multi(c)
    bind(c, s, "resA", "operator", "building", ids["A"])
    who = as_user("resA")
    mine = _ov(c, who)
    assert mine["rooms"] and {r["id"] for r in mine["rooms"]} <= {"lobby", "garden", "empty_room"}
    for k in ("buildings", "area_buildings", "building_all", "entry_building"):
        assert k not in mine, k
    assert all("building_id" not in r for r in mine["rooms"])
    # an administrator's policy building of B never widens what A's resident sees or may switch off
    uid = "dev-resA"  # conftest.bind: a developer-mode user's id
    assert c.put(f"{API}/home/policies/{uid}", json={"building_id": ids["B"]}).status_code == 200
    again = _ov(c, who)
    assert {r["id"] for r in again["rooms"]} == {r["id"] for r in mine["rooms"]} and "buildings" not in again
    r = c.get(f"{API}/devices/actions/preview", params={"kind": "lights_off", "scope": "area", "id": "office", "building": ids["B"]}, headers=who)
    assert r.status_code in (403, 404), "the person's building is display only: it grants nothing in building B"


# ------------------------------------------------------------------------------------------------------------- the building level

def test_the_overview_names_the_buildings_and_each_rooms_building(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _site(c, app)
    _multi(c)
    ov = _ov(c)
    assert [b["id"] for b in ov["buildings"]] == [ids["A"], ids["B"]], "the shared building last"
    assert [b["is_shared"] for b in ov["buildings"]] == [False, True]
    by_room = {r["id"]: r.get("building_id") for r in ov["rooms"]}
    assert by_room["lobby"] == ids["A"] and by_room["office"] == ids["B"]
    if "garden" in by_room:
        assert by_room["garden"] == ids["A"], "an area -> building row places a floorless area"
    assert ov["building_all"] is False, "Q64: hidden by default"
    assert ov["entry_building"] is None, "Q65: nothing set - the device decides"
    # Q66: the rooms the home interface turns off for one building are exactly the server's cut of that building
    with app.state.db.connection() as conn:
        for b in (ids["A"], ids["B"]):
            cut = building_scope.cut(conn, b)
            assert {rid for rid, bid in by_room.items() if bid == b} == {rid for rid in by_room if cut.area_in(rid)}
    # and the house-off of building B (scope building + building) reaches B only
    p = c.get(f"{API}/devices/actions/preview", params={"kind": "lights_off", "scope": "building", "id": "*", "building": ids["B"]}).json()
    assert {t["entity_id"] for t in p["targets"]} == {"light.office"} and p["name"]


def test_area_buildings_name_only_the_areas_the_caller_sees(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    _multi(c)
    admin = _ov(c)
    assert {"lobby", "office"} <= set(admin["area_buildings"]) and admin["area_buildings"]["office"] == ids["B"]
    # a person bound to both buildings sees their rooms, each placed in its building
    bind(c, s, "two", "operator", "building", ids["A"])
    bind(c, s, "two", "operator", "building", ids["B"])
    mine = _ov(c, as_user("two"))
    seen = {r["id"] for r in mine["rooms"]}
    assert {"office", "lobby"} <= seen and len(mine["buildings"]) == 2
    # the rule itself: only the rooms and the visible entities' areas are named - the garden resolves to A but nobody here sees it
    with app.state.db.connection() as conn:
        rooms = [{"id": "lobby"}, {"id": "office"}]
        extra = home_buildings.overview_extra(conn, rooms=rooms, entities=[{"area_id": "lobby"}, {"area_id": "office"}], pol={})
    assert extra is not None and set(extra["area_buildings"]) == {"lobby", "office"}
    assert "garden" not in extra["area_buildings"], "an area the caller does not see is never named"
    assert [r["building_id"] for r in rooms] == [ids["A"], ids["B"]]
    # a room the mapping puts in no building is null (shown with every building, never switched off with one)
    with app.state.db.connection() as conn:
        rooms = [{"id": "lobby"}, {"id": "office"}, {"id": "nowhere"}]
        home_buildings.overview_extra(conn, rooms=rooms, entities=[], pol={})
    assert rooms[2]["building_id"] is None


def test_meter_areas_follow_the_energy_view_permission(bulk_app):
    app, s, c, _fake = bulk_app
    _site(c, app)
    with app.state.db.connection() as conn:
        conn.execute("""INSERT INTO energy_meters (id, source_kind, source_ref, display_name, unit, unit_factor, area_id, status, created_at, updated_at)
                        VALUES ('m1', 'ha_entity', 'sensor.shared_meter', 'מונה משותף', 'kWh', 1000, 'garden', 'active', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z')""")
        from smplwise.rbac import Principal

        admin = Principal(user_id="dev-admin", username="admin", display_name="", source="dev")
        nobody = Principal(user_id="dev-nobody", username="nobody", display_name="", source="dev")
        assert "garden" in home_buildings.meter_areas(conn, admin) or home_buildings.meter_areas(conn, admin) == set()
        assert home_buildings.meter_areas(conn, nobody) == set(), "no energy.view: no meter area"


# ------------------------------------------------------------------------------------------------------------- Q64 / Q65 settings

def test_q64_building_all_is_an_installation_setting(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _site(c, app)
    _multi(c)
    got = c.get(f"{API}/home/settings").json()
    assert got["settings"]["building_all"] == "hide" and got["values"]["building_all"] == ["hide", "allow"]
    assert c.put(f"{API}/home/settings", json={"building_all": "maybe"}).status_code == 422
    r = c.put(f"{API}/home/settings", json={"building_all": "allow"})
    assert r.status_code == 200 and r.json()["settings"]["building_all"] == "allow"
    row = _audit(app, "home_interface.settings.set")[-1]
    assert row["details"] == {"before": {"building_all": "hide"}, "after": {"building_all": "allow"}}
    assert _ov(c)["building_all"] is True
    assert ids


def test_q65_the_persons_building_is_set_by_an_administrator(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    _multi(c)
    c.get(f"{API}/me", headers=as_user("dana"))
    uid = "dev-dana"
    before = c.get(f"{API}/home/interface", headers=as_user("dana")).json()
    assert "building_id" not in before, "not set: the policy answer of before"
    # a regular person may not set it (rbac.assign)
    bind(c, s, "dana", "operator", "installation", "*")
    assert c.put(f"{API}/home/policies/{uid}", json={"building_id": ids["B"]}, headers=as_user("dana")).status_code == 403
    # unknown / deleted building: 422
    r = c.put(f"{API}/home/policies/{uid}", json={"building_id": "no-such"})
    assert (r.status_code, r.json()["code"]) == (422, "building_not_found")
    r = c.put(f"{API}/home/policies/{uid}", json={"building_id": ids["B"]})
    assert r.status_code == 200 and r.json()["building_id"] == ids["B"]
    row = _audit(app, "home_interface.policy.set")[-1]
    assert row["details"]["building"] == {"before": None, "after": ids["B"]}
    assert c.get(f"{API}/home/interface", headers=as_user("dana")).json()["building_id"] == ids["B"]
    assert _ov(c, as_user("dana"))["entry_building"] == ids["B"]
    page = c.get(f"{API}/home/policies").json()
    listed = {u["user_id"]: u for u in page["users"]}
    assert listed[uid]["building_id"] == ids["B"]
    assert [b["id"] for b in page["buildings"]] == [ids["A"], ids["B"]], "the administrator's picker, shared last"
    assert all("building_id" not in u for k, u in listed.items() if k != uid), "a person without a building: the row of before"
    # another field changed later keeps the building
    assert c.put(f"{API}/home/policies/{uid}", json={"may_switch": False}).json()["building_id"] == ids["B"]
    # "" clears it
    r = c.put(f"{API}/home/policies/{uid}", json={"building_id": ""})
    assert r.status_code == 200 and "building_id" not in r.json()
    assert _ov(c, as_user("dana"))["entry_building"] is None
    # a deleted building is never an entry
    assert c.put(f"{API}/home/policies/{uid}", json={"building_id": ids["A"]}).status_code == 200
    with app.state.db.connection() as conn:
        conn.execute("UPDATE buildings SET deleted_at = '2026-11-23T00:00:00Z' WHERE id = ?", (ids["A"],))
    ov = _ov(c, as_user("dana"))
    assert ov.get("entry_building") is None


def test_q65_a_wall_panel_opens_on_its_rooms_building(bulk_app):
    app, s, c, _fake = bulk_app
    ids = _site(c, app)
    _multi(c)
    bind(c, s, "panel", "operator", "installation", "*")
    c.get(f"{API}/me", headers=as_user("panel"))
    r = c.put(f"{API}/home/policies/dev-panel", json={"kiosk": True, "kiosk_area_id": "office", "building_id": ids["A"]})
    assert r.status_code == 200, r.text
    assert _ov(c, as_user("panel"))["entry_building"] == ids["B"], "the panel's room decides, not the person's building"


# ------------------------------------------------------------------------------------------------------------- Q68 lobby boards

def _board(c) -> tuple[str, str]:
    assert c.patch(f"{API}/notices/settings", json={"enabled": True}).status_code == 200
    made = c.post(f"{API}/notices/boards", json={"name": "לוח הלובי", "slug": "lobby"}).json()
    return made["board"]["id"], made["token"]


def _greeting(c, token: str) -> str:
    r = c.get(f"{API}/notices/display/lobby", headers={"X-Board-Token": token})
    assert r.status_code == 200, r.text
    return r.json()["board"]["building"]


def test_q68_a_board_belongs_to_a_building_and_greets_with_its_name(bulk_app):
    app, _s, c, _fake = bulk_app
    ids = _site(c, app)
    bid, token = _board(c)
    plain = _greeting(c, token)
    listed = c.get(f"{API}/notices/boards").json()
    assert "buildings" not in listed, "the switch off: no picker"
    assert all("building_id" not in b for b in listed["boards"])
    _multi(c)
    listed = c.get(f"{API}/notices/boards").json()
    assert [b["id"] for b in listed["buildings"]] == [ids["A"], ids["B"]]
    r = c.patch(f"{API}/notices/boards/{bid}", json={"building_id": "no-such"})
    assert (r.status_code, r.json()["code"]) == (422, "building_not_found")
    r = c.patch(f"{API}/notices/boards/{bid}", json={"building_id": ids["B"]})
    assert r.status_code == 200 and r.json()["board"]["building_id"] == ids["B"]
    assert "building_id" in _audit(app, "notices.board.update")[-1]["details"]["keys"]
    with app.state.db.connection() as conn:
        name_b = conn.execute("SELECT name FROM buildings WHERE id = ?", (ids["B"],)).fetchone()[0]
    assert _greeting(c, token) == name_b
    # a rename shows at once (read live)
    assert c.patch(f"{API}/buildings/{ids['B']}", json={"name": "מגדל ב"}).status_code == 200
    assert _greeting(c, token) == "מגדל ב"
    # the switch off: the greeting of before, the building kept
    _multi(c, False)
    assert _greeting(c, token) == plain
    _multi(c)
    assert _greeting(c, token) == "מגדל ב"
    # "" = the whole site
    r = c.patch(f"{API}/notices/boards/{bid}", json={"building_id": ""})
    assert r.status_code == 200 and "building_id" not in r.json()["board"]
    assert _greeting(c, token) == plain


def test_q68_a_board_without_a_building_never_runs_the_new_code(bulk_app, monkeypatch):
    app, _s, c, _fake = bulk_app
    _site(c, app)
    _bid, token = _board(c)
    _multi(c)
    plain = _greeting(c, token)
    monkeypatch.setattr(home_buildings, "board_building", _raise)
    assert _greeting(c, token) == plain


@pytest.mark.parametrize("value", ["hide", "allow"])
def test_building_all_reads_unknown_as_hidden(bulk_app, value):
    app, _s, c, _fake = bulk_app
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO settings(key, value) VALUES('home.building_all', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (value,))
        assert home_buildings.building_all(conn) == value
        conn.execute("UPDATE settings SET value = 'garbage' WHERE key = 'home.building_all'")
        assert home_buildings.building_all(conn) == "hide"
