"""CR-038 slice 6 - the manager board and the facet counts through the API (sections 8.1, 13.5-13.7):

- the gate: manager members and all-department managers only (an audited 403 for a member, a viewer, an all-departments viewer
  without tickets.manage); the uniform 404 while the module is off;
- every row through access.visible(): a manager sees the departments they manage, never another's; a deny binding or a floor scope
  removes tickets from the board AND from every count (facets, chips, tree);
- the sections (waiting for me / stuck / in handling by assignee / recently closed), the state strip's counts (D21: this week / all),
  the state filter, the department chips, the floors tree (D19) and the place filter;
- the display settings D19-D21 and D28 in `tickets.settings` (validated, revision-checked, served by GET /tickets/module) and the
  per-user tree choice of D30 in /me/prefs."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.db import Database
from smplwise.services.tickets import monitor, stuck
from tickets_world import API, MAINT, build


@pytest.fixture()
def w(settings):
    return build(settings)


def board(w, user: str, **q):
    return w.c.get(f"{API}/tickets/board", params=q, headers=w.h(user))


def facets(w, user: str, **q):
    return w.c.get(f"{API}/tickets/facets", params=q, headers=w.h(user))


@pytest.fixture()
def scene(w):
    """maintenance: a new unassigned ticket (waiting for the manager), one with tom (in handling), one stuck with tom, one closed;
    cleaning: one ticket of cleo's."""
    s = {}
    s["new"] = w.create("nora", "שקע")
    s["handling"] = w.create("mona", "מזגן")
    w.assign("mona", s["handling"]["id"], "tom")
    s["stuck"] = w.create("mona", "דלת")
    w.assign("mona", s["stuck"]["id"], "tom")
    with Database(w.settings.db_path).connection() as conn:  # the stuck one was assigned long ago (acknowledge within 1 day)
        conn.execute("UPDATE ticket_assignments SET assigned_at = '2026-01-01T00:00:00Z' WHERE ticket_id = ?", (s["stuck"]["id"],))
        monitor.look(conn, s["stuck"]["id"], dt.datetime.now(dt.timezone.utc))
    s["closed"] = w.create("mona", "נורה")
    assert w.status("mona", s["closed"]["id"], "closed", note="כפול").status_code == 200
    s["cleaning"] = w.create("cleo", "רצפה", dept=w.cleaning)
    return s


# ---------------------------------------------------------------- the gate

@pytest.mark.parametrize("user,code", [("mona", 200), ("cleo", 200), ("joni", 200), ("tom", 403), ("nora", 403), ("alda", 403), ("vic", 403)])
def test_the_board_is_for_managers(w, user, code):
    r = board(w, user)
    assert r.status_code == code, (user, r.text)
    if code == 403:
        assert r.json()["code"] == "forbidden"


def test_module_off_is_the_uniform_404(w):
    w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    for path in ("tickets/board", "tickets/facets"):
        r = w.c.get(f"{API}/{path}", headers=w.h("mona"))
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled"


def test_board_is_not_a_ticket_id_route(w):
    """`/tickets/board` and `/tickets/facets` are mounted before `/tickets/{ticket_id}` (an id pattern would swallow them)."""
    assert board(w, "mona").json().get("items") is not None
    assert facets(w, "mona").json().get("status") is not None


# ---------------------------------------------------------------- what a manager sees

def test_sections_counts_and_chips_of_a_department_manager(w, scene):
    r = board(w, "mona").json()
    ids = {it["id"]: it for it in r["items"]}
    assert set(ids) == {scene["new"]["id"], scene["handling"]["id"], scene["stuck"]["id"]}, "maintenance only, open only"
    assert ids[scene["new"]["id"]]["group"] == "waiting" and ids[scene["new"]["id"]]["waiting_reason"] == "unassigned"
    assert ids[scene["handling"]["id"]]["group"] == "handling"
    st = ids[scene["stuck"]["id"]]
    assert st["group"] == "stuck" and st["stuck"]["kind"] == "ack" and st["stuck"]["since"] == "2026-01-02T00:00:00Z"
    assert st["sla_cell"]["over"] is True
    assert r["counts"] == {"all": 3, "waiting": 1, "stuck": 1, "unassigned": 1, "closed_week": 1, "closed_all": 1}
    assert [c["id"] for c in r["closed"]] == [scene["closed"]["id"]]
    assert [it["id"] for it in r["items"]][0] == scene["new"]["id"], "waiting for me first, then stuck, then the rest"
    assert [h["name"] for h in r["handling"]] and r["handling"][0]["count"] == 1 and r["handling"][0]["key"] == "user:dev-tom"
    assert [d["id"] for d in r["departments"]] == [MAINT] and r["departments"][0]["count"] == 3
    c = board(w, "cleo").json()
    assert [it["id"] for it in c["items"]] == [scene["cleaning"]["id"]], "a manager of another department sees only their own"


def test_all_department_manager_sees_every_department_and_filters(w, scene):
    r = board(w, "joni").json()
    assert {it["id"] for it in r["items"]} == {scene[k]["id"] for k in ("new", "handling", "stuck", "cleaning")}
    assert {d["id"] for d in r["departments"]} == {MAINT, w.cleaning}
    r = board(w, "joni", department_id=w.cleaning).json()
    assert [it["id"] for it in r["items"]] == [scene["cleaning"]["id"]]
    assert {d["id"]: d["count"] for d in r["departments"]} == {MAINT: 3, w.cleaning: 1}, "chips count every department"


@pytest.mark.parametrize("state,keys", [("waiting", {"new"}), ("stuck", {"stuck"}), ("unassigned", {"new"}), ("closed", {"closed"}),
                                        ("all", {"new", "handling", "stuck"})])
def test_the_state_strip_filters(w, scene, state, keys):
    r = board(w, "mona", state=state).json()
    assert {it["id"] for it in r["items"]} == {scene[k]["id"] for k in keys}


def test_more_filters_priority_assignee_text(w, scene):
    assert {it["id"] for it in board(w, "mona", assignee="user:dev-tom").json()["items"]} == {scene["handling"]["id"], scene["stuck"]["id"]}
    assert {it["id"] for it in board(w, "mona", assignee="none").json()["items"]} == {scene["new"]["id"]}
    assert board(w, "mona", priority="urgent").json()["items"] == []
    assert {it["id"] for it in board(w, "mona", priority="normal,urgent").json()["items"]} == {scene[k]["id"] for k in ("new", "handling", "stuck")}
    assert [it["id"] for it in board(w, "mona", q="מזגן").json()["items"]] == [scene["handling"]["id"]]
    assert board(w, "mona", priority="bogus").status_code == 422
    assert board(w, "mona", place="room:1").status_code == 422


def test_the_floors_tree_and_the_place_filter(w, scene):
    w.place(scene["handling"]["id"], "floor2")
    w.place(scene["stuck"]["id"], "floor3")
    r = board(w, "mona").json()
    nodes = {n["key"]: n for n in r["tree"]}
    f2, f3 = f"floor:{w.floors['floor2']}", f"floor:{w.floors['floor3']}"
    assert nodes[f2]["count"] == 1 and nodes[f3]["count"] == 1 and nodes["none"]["count"] == 1
    assert nodes[f2]["parent"] and nodes[nodes[f2]["parent"]]["kind"] == "building" and nodes[f2]["name"]
    assert [it["id"] for it in board(w, "mona", place=f2).json()["items"]] == [scene["handling"]["id"]]
    assert [it["id"] for it in board(w, "mona", place="none").json()["items"]] == [scene["new"]["id"]]
    assert {n["key"] for n in board(w, "mona", place=f2).json()["tree"]} >= {f2, f3}, "the tree itself ignores the place filter"


# ---------------------------------------------------------------- visibility of every count

def test_a_deny_binding_removes_a_ticket_from_the_board_and_every_count(w, scene):
    w.place(scene["handling"]["id"], "floor2")
    w.deny("mona", "operator", "floor", w.floors["floor2"])
    w.deny("mona", "tickets_manage", "floor", w.floors["floor2"])
    r = board(w, "mona").json()
    assert scene["handling"]["id"] not in {it["id"] for it in r["items"]}
    assert r["counts"]["all"] == 2 and all(n["key"] != f"floor:{w.floors['floor2']}" for n in r["tree"])
    f = facets(w, "mona", status="open").json()
    assert f["total"] == 2


def test_facets_count_the_visible_set_of_each_caller(w, scene):
    f = facets(w, "tom", scope="department", status="open").json()
    assert f["total"] == 3 and f["groups"]["unassigned"] == 1 and f["groups"]["handling"] == 2 and f["stuck"] == {"ack": 1} and f["waiting"] == 1
    assert f["departments"] == {MAINT: 3}
    n = facets(w, "nora", status="all").json()
    assert n["total"] == 1 and n["status"] == {"new": 1}, "a non-member creator counts only what she may see"
    assert facets(w, "vic").status_code == 403
    a = facets(w, "alda", scope="all", status="all").json()
    assert a["total"] == 5 and a["status"]["closed"] == 1
    assert facets(w, "cleo", scope="all").status_code == 403, "scope=all needs tickets.all_departments"


# ---------------------------------------------------------------- the display settings and the personal tree choice

def test_display_settings_d19_d21_and_d28(w):
    m = w.c.get(f"{API}/tickets/module", headers=w.h("tom")).json()
    assert m["ui"] == {"detail": "drawer_fullscreen", "new_ticket": "sheet", "board_floors": "tree", "grouping": "no_status_filter", "closed_strip": "all",
                       "detail_tab": "overview", "drawer_size": "wide", "phone_sheet": "full", "handled_days": 7,
                       # MGRDASH phase 1: the manager overview's display choices (owner defaults)
                       "dash_handler_numbers": "own", "dash_vendors": "tagged", "dash_busy": 8, "dash_busy_departments": {}, "dash_compare": "below_numbers",
                       # MGRDASH phase 5: the morning summary's hour and the busy-department threshold (the alerts are off by default)
                       "dash_digest_hour": 8, "dash_dept_stuck": 10}
    doc = w.c.get(f"{API}/tickets/settings").json()
    assert doc["urgent_is_critical"] is True
    body = {"revision": doc["revision"], "ui": {"board_floors": "chips", "grouping": "never", "closed_strip": "week"}, "urgent_is_critical": False}
    r = w.c.put(f"{API}/tickets/settings", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["ui"]["board_floors"] == "chips" and r.json()["urgent_is_critical"] is False
    assert w.c.get(f"{API}/tickets/module", headers=w.h("tom")).json()["ui"]["grouping"] == "never"
    assert w.c.put(f"{API}/tickets/settings", json=body).status_code == 409, "revision-checked"
    rev = r.json()["revision"]
    assert w.c.put(f"{API}/tickets/settings", json={"revision": rev, "ui": {"grouping": "sometimes"}}).status_code == 422
    assert w.c.put(f"{API}/tickets/settings", json={"revision": rev, "urgent_is_critical": "no"}).status_code == 422
    assert w.c.put(f"{API}/tickets/settings", json={"revision": rev, "ui": {"closed_strip": "hidden"}}, headers=w.h("mona")).status_code == 403


def test_closed_strip_week_shows_only_this_weeks_closed(w, scene):
    with Database(w.settings.db_path).connection() as conn:
        conn.execute("UPDATE tickets SET closed_at = '2026-01-01T00:00:00Z' WHERE id = ?", (scene["closed"]["id"],))
    r = board(w, "mona").json()
    assert r["counts"]["closed_week"] == 0 and r["counts"]["closed_all"] == 1 and len(r["closed"]) == 1
    rev = w.c.get(f"{API}/tickets/settings").json()["revision"]
    w.c.put(f"{API}/tickets/settings", json={"revision": rev, "ui": {"closed_strip": "week"}})
    r = board(w, "mona").json()
    assert r["closed"] == [] and r["ui"]["closed_strip"] == "week"


def test_the_tree_choice_is_personal(w):
    r = w.c.put(f"{API}/me/prefs", json={"tickets.board.tree_hidden": "hidden"}, headers=w.h("mona"))
    assert r.status_code == 200, r.text
    assert w.c.get(f"{API}/me/prefs", headers=w.h("mona")).json()["prefs"]["tickets.board.tree_hidden"] == "hidden"
    assert w.c.get(f"{API}/me/prefs", headers=w.h("tom")).json()["prefs"]["tickets.board.tree_hidden"] is None
    assert w.c.put(f"{API}/me/prefs", json={"tickets.board.tree_hidden": "maybe"}, headers=w.h("mona")).status_code == 422
