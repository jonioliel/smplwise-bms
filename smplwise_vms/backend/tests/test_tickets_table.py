"""CR-038 slice 6b (D24, section 13.6) through the API: the board table's list (server-side sort, filters, keyset pagination, short
pages under the visibility check, cursor tampering), the RBAC matrix incl. the visibility holes (placeless any-scope, floor scope,
deny binding, another department, limited viewers' blank columns), bulk actions (per-item results, partial failure, own transactions,
audit, idempotency, caps), the CSV export (gate, 5,000 cap, formula injection, BOM, no invisible row, rate), saved views (private,
caps) and the `tickets.board` preference. The cast is tests/tickets_world.py."""
from __future__ import annotations

import csv
import io
import json
import re
from pathlib import Path

import pytest

from smplwise.db import Database
from smplwise.services.tickets import access, export, naming
from tickets_world import API, MAINT, build, rid

SMPLWISE = Path(__file__).resolve().parents[1] / "smplwise"


@pytest.fixture()
def w(settings):
    export.reset_rate()
    return build(settings)


def _db(w):
    return Database(w.settings.db_path)


def _set(w, ticket_id: str, **fields) -> None:
    with _db(w).connection() as conn:
        conn.execute(f"UPDATE tickets SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?", (*fields.values(), ticket_id))


def _page(w, user: str, query: str = "", status: int = 200) -> dict:
    r = w.c.get(f"{API}/tickets/table{query}", headers=w.h(user))
    assert r.status_code == status, (user, query, r.status_code, r.text)
    return r.json()


def _ids(w, user: str, query: str = "") -> list[str]:
    return [i["id"] for i in _page(w, user, query)["items"]]


def _all_pages(w, user: str, query: str) -> list[dict]:
    out: list[dict] = []
    cursor = None
    sep = "&" if "?" in query else "?"
    for _ in range(200):
        page = _page(w, user, query + (f"{sep}cursor={cursor}" if cursor else ""))
        out.extend(page["items"])
        cursor = page["next_cursor"]
        if not cursor:
            return out
    raise AssertionError("pagination did not end")


def _audit(w, action: str) -> list[dict]:
    with _db(w).connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY id", (action,)).fetchall()]


def _bulk(w, user: str, action: str, tickets: list[dict], params: dict | None = None, rid_: str | None = None, revisions: dict | None = None):
    items = [{"id": t["id"], "revision": (revisions or {}).get(t["id"]) or w.detail(t["id"])["revision"]} for t in tickets]
    return w.c.post(f"{API}/tickets/bulk", json={"action": action, "items": items, "params": params or {}, "client_request_id": rid_ or rid()}, headers=w.h(user))


# ---------------------------------------------------------------- the list: routes, order, filters

def test_the_routes_are_not_shadowed_by_ticket_id_and_follow_the_module_switch(w):
    w.create("tom")
    assert _page(w, "joni")["sort"] == "activity:desc"
    assert w.c.get(f"{API}/tickets/views", headers=w.h("tom")).status_code == 200
    w.c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    for method, path in (("GET", "/tickets/table"), ("GET", "/tickets/views"), ("GET", "/tickets/export.csv"), ("POST", "/tickets/bulk"),
                         ("POST", "/tickets/views"), ("PATCH", "/tickets/views/abc"), ("DELETE", "/tickets/views/abc")):
        r = w.c.request(method, API + path, json={} if method in ("POST", "PATCH") else None)
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", (method, path, r.text)


@pytest.mark.parametrize("query,field", [
    ("?sort=phone:asc", "sort"), ("?sort=number:asc,number:desc", "sort"), ("?sort=number:asc,title:asc,created:asc", "sort"),
    ("?limit=30", "limit"), ("?status=nope", "status"), ("?priority=critical", "priority"), ("?assignee=group:x", "assignee"),
    ("?scope=world", "scope"), ("?created_from=yesterday", "created_from"), ("?cursor=Zm9v", "cursor"),
])
def test_values_outside_the_whitelist_are_422_naming_the_field(w, query, field):
    r = w.c.get(f"{API}/tickets/table{query}")
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == field, r.text


def test_server_side_sort_by_every_key_and_the_id_tiebreak(w):
    a = w.create("joni", "בבב")
    b = w.create("joni", "אאא")
    c = w.create("joni", "גגג", dept=w.cleaning)
    w.c.patch(f"{API}/tickets/{a['id']}", json={"priority_id": next(p["id"] for p in w.c.get(f"{API}/tickets/meta").json()["departments"][0]["priorities"] if p["key"] == "urgent"),
                                               "revision": w.detail(a["id"])["revision"]})
    assert w.assign("joni", b["id"], "tom").status_code == 200
    num = lambda q: [i["number"] for i in _page(w, "joni", q)["items"]]  # noqa: E731
    assert num("?sort=number:asc") == sorted([a["number"], b["number"], c["number"]])
    assert num("?sort=number:desc") == sorted([a["number"], b["number"], c["number"]], reverse=True)
    assert [i["title"] for i in _page(w, "joni", "?sort=title:asc")["items"]] == ["אאא", "בבב", "גגג"]
    assert _ids(w, "joni", "?sort=priority:asc")[0] == a["id"], "urgent (rank 0) first"
    assert _ids(w, "joni", "?sort=status:desc")[0] == b["id"], "assigned after new in the lifecycle"
    assert _ids(w, "joni", "?sort=assignee:desc")[0] == b["id"], "the one with a handler"
    assert [i["department"]["name"] for i in _page(w, "joni", "?sort=department:asc,number:asc")["items"]] == ["אחזקה", "אחזקה", "ניקיון"]
    for key in ("place", "device", "created", "activity", "stuck", "sla"):
        assert len(_ids(w, "joni", f"?sort={key}:asc")) == 3, key
    assert _ids(w, "joni", "?sort=place:asc") == sorted([a["id"], b["id"], c["id"]]), "equal keys: the id breaks the tie (ascending with the key)"
    assert _ids(w, "joni", "?sort=place:desc") == sorted([a["id"], b["id"], c["id"]], reverse=True)


def test_keyset_pagination_is_stable_across_pages_and_inserts(w):
    made = [w.create("joni", f"פריט {i:02d}") for i in range(33)]
    full = [i["id"] for i in _page(w, "joni", "?sort=priority:asc,title:desc&limit=200")["items"]]
    assert len(full) == 33
    first = _page(w, "joni", "?sort=priority:asc,title:desc&limit=25")
    assert [i["id"] for i in first["items"]] == full[:25] and first["next_cursor"]
    w.create("joni", "פריט 99 חדש")  # a new row between the pages: no skip, no repeat of the rows already shown
    second = _page(w, "joni", f"?sort=priority:asc,title:desc&limit=25&cursor={first['next_cursor']}")
    rest = [i["id"] for i in second["items"]]
    assert rest == [x for x in full[25:]], rest
    assert second["next_cursor"] is None
    assert len({*full}) == len(made)


def test_short_pages_under_the_visibility_check_keep_a_cursor(w):
    older = [w.create("tom", f"ללא מקום {i}") for i in range(3)]
    for t in older:  # strictly older than the placed ones (tickets made in the same second tie and order by their random id)
        _set(w, t["id"], last_activity_at="2026-01-01T00:00:00Z")
    placed = [w.create("tom", f"קומה 2 #{i}") for i in range(130)]
    for t in placed:
        w.place(t["id"], "floor2")
    # gil: a maintenance member bound to floor 3 only - none of the 130 floor-2 tickets, all three placeless ones (any held scope)
    page = _page(w, "gil", "?limit=25")
    assert page["items"] == [] and page["next_cursor"], "125 invisible candidates scanned: a SHORT page with a cursor, not a slow one"
    rows = _all_pages(w, "gil", "?limit=25")
    assert sorted(r["id"] for r in rows) == sorted(t["id"] for t in older)
    assert len(_all_pages(w, "tom", "?limit=200")) == 133


def test_filters(w):
    t1 = w.create("joni", "מזגן")
    t2 = w.create("joni", "נורה")
    t3 = w.create("joni", "חלון", dept=w.cleaning)
    assert w.assign("joni", t2["id"], "tom").status_code == 200
    urgent = next(p["id"] for p in w.c.get(f"{API}/tickets/meta").json()["departments"][0]["priorities"] if p["key"] == "urgent")
    w.c.patch(f"{API}/tickets/{t1['id']}", json={"priority_id": urgent, "revision": w.detail(t1["id"])["revision"]})
    ids = lambda q, u="joni": set(_ids(w, u, q))  # noqa: E731
    assert ids("?priority=urgent") == {t1["id"]}
    assert ids(f"?department={w.cleaning}") == {t3["id"]}
    assert ids(f"?department={MAINT},{w.cleaning}") == {t1["id"], t2["id"], t3["id"]}
    assert ids("?assignee=none") == {t1["id"], t3["id"]}
    assert ids("?assignee=user:dev-tom") == {t2["id"]}
    assert ids("?assignee=me", "tom") == {t2["id"]}
    assert ids("?status=assigned") == {t2["id"]} and ids("?status=new,assigned") == {t1["id"], t2["id"], t3["id"]}
    assert ids("?waiting=manager") == {t1["id"], t3["id"]}
    assert ids("?q=נורה") == {t2["id"]} and ids(f"?q=%23{t3['number']}") == {t3["id"]}
    _set(w, t3["id"], stuck_kind="stuck", stuck_level=1)
    assert ids("?stuck=any") == {t3["id"]} and ids("?stuck=ack") == set()
    _set(w, t1["id"], created_at="2026-01-01T08:00:00Z")
    assert ids("?created_to=2026-02-01T00:00:00Z") == {t1["id"]}
    assert t1["id"] not in ids("?created_from=2026-02-01T00:00:00Z")
    _set(w, t2["id"], floor_id=w.floors["floor2"], building_id=None, site_id=None)
    assert ids(f"?floor={w.floors['floor2']}") == {t2["id"]}


# ---------------------------------------------------------------- RBAC: every row through visible()

def test_the_table_carries_only_visible_tickets_for_every_member_of_the_cast(w):
    a = w.create("nora", "א")  # maintenance, placeless, by a non-member
    b = w.create("cleo", "ב", dept=w.cleaning)
    c = w.create("tom", "ג")
    d = w.create("fred", "ד")  # placeless, by a floor-2 user who is not a member
    e = w.create("tom", "ה")
    w.place(e["id"], "floor2")
    expect = {
        "joni": (a, b, c, d, e), "mona": (a, c, d, e), "tom": (a, c, d, e), "nora": (a,), "fred": (d,), "gil": (a, c, d),
        "cleo": (b,), "alda": (a, b, c, d, e),
    }
    for user, want in expect.items():
        got = set(_ids(w, user, "?status=all&limit=200"))
        assert got == {t["id"] for t in want}, (user, got)
    assert w.c.get(f"{API}/tickets/table", headers=w.h("vic")).status_code == 403
    assert w.c.get(f"{API}/tickets/table", headers=w.h("dina")).status_code == 403, "a member whose tickets.view is denied everywhere"
    assert w.c.get(f"{API}/tickets/table?scope=all", headers=w.h("mona")).status_code == 403
    assert set(_ids(w, "alda", "?scope=all")) == {t["id"] for t in (a, b, c, d, e)}
    assert set(_ids(w, "tom", "?scope=mine")) == {c["id"], e["id"]}
    # a deny on the place chain removes a placed row from tom's table (deny beats allow)
    w.deny("tom", "tickets_view", "floor", w.floors["floor2"])
    assert e["id"] not in _ids(w, "tom")


def test_a_forged_cursor_only_moves_inside_the_callers_visible_set(w):
    mine = [w.create("cleo", f"ניקיון {i}", dept=w.cleaning) for i in range(3)]
    [w.create("tom", f"אחזקה {i}") for i in range(5)]
    from smplwise.services.tickets import table

    sort = table.parse_sort("number:asc")
    for start in (0, 10**9 - 1, -5):
        # TK251 R2 A-3: the cursor is bound to its caller and filter set - forged here with cleo's own binding (the strongest forgery)
        fp = table.filters_fingerprint(table.from_query_params({"sort": "number:asc"})[0])
        forged = table.encode_cursor(sort, [start], "0", uid="dev-cleo", fingerprint=fp)
        got = _ids(w, "cleo", f"?sort=number:asc&cursor={forged}")
        assert set(got) <= {t["id"] for t in mine}, "a forged position never reveals another department's row"


def test_limited_viewers_get_blank_management_columns(w):
    t = w.create("nora")
    _set(w, t["id"], stuck_kind="stuck", stuck_level=2, stuck_due_at="2026-01-01T00:00:00Z", resolve_due_at="2026-01-02T00:00:00Z")
    full = _page(w, "mona")["items"][0]
    assert full["stuck"]["kind"] == "stuck" and full["sla"] == {"kind": "stuck", "due_at": "2026-01-01T00:00:00Z", "overdue": True}
    limited = _page(w, "nora")["items"][0]
    assert limited["view"] == "limited" and limited["stuck"] is None and limited["sla"] is None
    assert limited["transitions"] == [] and limited["can"] == {"manage": False, "assign": False, "assign_external": False}
    assert {x["to"] for x in full["transitions"]} >= {"closed", "cancelled"} and full["can"]["assign"] is True


# ---------------------------------------------------------------- bulk actions

def test_bulk_close_is_per_ticket_not_all_or_nothing(w):
    ok1 = w.create("tom", "סגירה 1")
    ok2 = w.create("tom", "סגירה 2")
    stale = w.create("tom", "גרסה ישנה")
    other = w.create("cleo", "של ניקיון", dept=w.cleaning)
    closed = w.create("tom", "כבר סגורה")
    assert w.status("mona", closed["id"], "closed", note="נסגרה").status_code == 200
    revisions = {stale["id"]: w.detail(stale["id"])["revision"] - 0}
    w.c.post(f"{API}/tickets/{stale['id']}/notes", json={"text": "x"})  # a note does not move the revision ...
    w.c.patch(f"{API}/tickets/{stale['id']}", json={"title": "גרסה חדשה", "revision": revisions[stale["id"]]})  # ... an edit does
    r = _bulk(w, "mona", "close", [ok1, stale, other, closed, ok2], {"note": "טופל בסבב"}, revisions=revisions)
    assert r.status_code == 200, r.text
    res = {x["id"]: x["result"] for x in r.json()["results"]}
    assert res == {ok1["id"]: "ok", stale["id"]: "stale", other["id"]: "not_found", closed["id"]: "invalid_transition", ok2["id"]: "ok"}, res
    assert r.json()["done"] == 2 and r.json()["total"] == 5 and r.json()["counts"] == {"ok": 2, "stale": 1, "not_found": 1, "invalid_transition": 1}
    assert w.detail(ok1["id"])["status"] == "closed" and w.detail(ok2["id"])["status"] == "closed"
    assert w.detail(stale["id"])["status"] == "new" and w.detail(other["id"])["status"] == "new"
    assert "number" not in next(x for x in r.json()["results"] if x["id"] == other["id"]), "an invisible ticket's number is not told"
    summary = _audit(w, "ticket.bulk")
    assert len(summary) == 1 and json.loads(summary[0]["details_json"])["counts"]["ok"] == 2
    closes = _audit(w, "ticket.close")
    assert {(a["resource_id"], a["decision"]) for a in closes} >= {(ok1["id"], "allowed"), (ok2["id"], "allowed"), (other["id"], "denied"), (closed["id"], "denied")}
    # a note is required for a bulk close
    r = _bulk(w, "mona", "close", [w.create("tom")], {})
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "params.note"


def test_bulk_needs_manager_rights_per_ticket(w):
    t = w.create("tom")
    assert _bulk(w, "tom", "close", [t], {"note": "x"}).status_code == 403, "a member without tickets.manage"
    assert _bulk(w, "alda", "close", [t], {"note": "x"}).status_code == 403, "all departments but no manage"
    assert _bulk(w, "vic", "close", [t], {"note": "x"}).status_code == 403
    seen_not_managed = w.create("cleo", "פתחה קליאו באחזקה")  # cleo created it (limited view) but manages cleaning only
    r = _bulk(w, "cleo", "close", [seen_not_managed], {"note": "x"})
    assert r.json()["results"][0]["result"] == "forbidden" and w.detail(seen_not_managed["id"])["status"] == "new"


def test_bulk_assign_priority_and_remind(w):
    a, b = w.create("tom", "א"), w.create("tom", "ב")
    r = _bulk(w, "mona", "assign", [a, b], {"assignee": {"kind": "user", "id": "dev-tom"}})
    assert [x["result"] for x in r.json()["results"]] == ["ok", "ok"]
    assert w.detail(a["id"])["assignee"]["id"] == "dev-tom"
    r = _bulk(w, "mona", "assign", [a], {"assignee": {"kind": "user", "id": "dev-tom"}})
    assert r.json()["results"][0]["result"] == "unchanged"
    r = _bulk(w, "mona", "assign", [b], {"assignee": {"kind": "user", "id": "dev-cleo"}})
    assert r.json()["results"][0]["result"] == "assignee_not_allowed", "not a member of the department"
    assert _bulk(w, "mona", "assign", [b], {"assignee": {"kind": "contact", "id": "c1"}}).json()["results"][0]["result"] == "forbidden", "no tickets.external"
    assert _bulk(w, "joni", "assign", [b], {"assignee": {"kind": "contact", "id": "c1"}}).json()["results"][0]["result"] == "unavailable", "no public page yet (slice 4)"
    # priority by key, mapped per department; the same priority is "unchanged"
    r = _bulk(w, "mona", "priority", [a, b], {"priority_key": "urgent"})
    assert [x["result"] for x in r.json()["results"]] == ["ok", "ok"] and w.detail(a["id"])["priority"]["key"] == "urgent"
    assert _bulk(w, "mona", "priority", [a], {"priority_key": "urgent"}).json()["results"][0]["result"] == "unchanged"
    assert _bulk(w, "mona", "priority", [a], {"priority_key": "critical"}).status_code == 422
    # remind: an internal assignee, at most once an hour per ticket; not for an unassigned ticket
    r = _bulk(w, "mona", "remind", [a, w.create("tom", "ללא מטפל")])
    assert [x["result"] for x in r.json()["results"]] == ["ok", "invalid_transition"]
    events = [e for e in w.detail(a["id"])["events"] if e["kind"] == "reminder"]
    assert len(events) == 1 and events[0]["data"] == {"manual": True}
    assert _bulk(w, "mona", "remind", [a]).json()["results"][0]["result"] == "too_soon"
    assert len(_audit(w, "ticket.remind")) == 2  # one allowed, one denied (too_soon)


def test_bulk_caps_duplicates_and_idempotency(w):
    t = w.create("tom")
    body = lambda n, key=None: {"action": "remind", "items": [{"id": t["id"], "revision": 1}] * n, "params": {}, "client_request_id": key or rid()}  # noqa: E731
    assert w.c.post(f"{API}/tickets/bulk", json=body(2), headers=w.h("mona")).json()["details"]["fields"][0] == {"field": "items", "code": "duplicate"}
    many = {"action": "close", "items": [{"id": f"x{i:015d}", "revision": 1} for i in range(51)], "params": {"note": "x"}, "client_request_id": rid()}
    r = w.c.post(f"{API}/tickets/bulk", json=many, headers=w.h("mona"))
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "items", "code": "too_many"}
    assert w.c.post(f"{API}/tickets/bulk", json={**many, "action": "delete"}, headers=w.h("mona")).status_code == 422
    key = rid()
    once = _bulk(w, "mona", "close", [t], {"note": "x"}, rid_=key)
    again = _bulk(w, "mona", "close", [t], {"note": "x"}, rid_=key, revisions={t["id"]: 1})
    assert once.json() == again.json() and once.json()["results"][0]["result"] == "ok", "a retry replays the first answer"
    assert len(_audit(w, "ticket.bulk")) == 1
    r = w.c.post(f"{API}/tickets", json={"department_id": MAINT, "title": "x", "client_request_id": key}, headers=w.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "request_id_reused"


def test_a_failing_item_undoes_only_its_own_writes(w, monkeypatch):
    from smplwise.services.tickets import bulk, service

    a, b, c = w.create("tom", "1"), w.create("tom", "2"), w.create("tom", "3")
    real = service.change_status

    def explode_on_b(conn, viewer, seen, *args, **kw):
        real(conn, viewer, seen, *args, **kw)  # the timeline row and the audit row ARE written ...
        if seen.row["id"] == b["id"]:
            raise service.stale(conn, seen.row)  # ... and then the item fails

    monkeypatch.setattr(bulk.service, "change_status", explode_on_b)
    r = _bulk(w, "mona", "close", [a, b, c], {"note": "x"})
    assert [x["result"] for x in r.json()["results"]] == ["ok", "stale", "ok"]
    assert w.detail(b["id"])["status"] == "new" and [e["kind"] for e in w.detail(b["id"])["events"]] == ["created"], "its savepoint undid it all"
    assert w.detail(a["id"])["status"] == "closed" and w.detail(c["id"])["status"] == "closed"


# ---------------------------------------------------------------- CSV export

def _csv(r) -> list[list[str]]:
    assert r.content.startswith("﻿".encode()), "UTF-8 with a BOM"
    return list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"), newline="")))


def test_export_gate_columns_bom_zone_and_no_invisible_rows(w):
    t = w.create("tom", "מזגן")
    w.create("cleo", "של ניקיון", dept=w.cleaning)
    assert w.c.get(f"{API}/tickets/export.csv", headers=w.h("tom")).status_code == 403, "a member without manager rights"
    assert w.c.get(f"{API}/tickets/export.csv", headers=w.h("alda")).status_code == 403, "all departments without tickets.manage"
    r = w.c.get(f"{API}/tickets/export.csv?columns=number,title,status,department", headers=w.h("mona"))
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv") and "attachment" in r.headers["content-disposition"]
    rows = _csv(r)
    number_header = naming.render(export.HEADERS["he"]["number"], naming.DEFAULTS["he"])  # the configured (here: default) name, whatever it is
    assert rows[0] == [number_header, "כותרת", "מצב", "מחלקה"], rows[0]
    assert rows[1:] == [[str(t["number"]), "מזגן", "חדש", "אחזקה"]], "mona does not see the cleaning ticket"
    assert r.headers["x-export-rows"] == "1"
    audit = _audit(w, "ticket.export")
    assert audit[-1]["decision"] == "allowed" and json.loads(audit[-1]["details_json"])["rows"] == 1
    assert "מזגן" not in audit[-1]["details_json"], "the audit names the filter and the count, never a row"
    _set(w, t["id"], created_at="2026-07-01T09:30:00Z")
    export.reset_rate()
    rows = _csv(w.c.get(f"{API}/tickets/export.csv?columns=number,created", headers=w.h("mona")))
    assert rows[1][1] == "2026-07-01 12:30", "times in the installation's zone (Asia/Jerusalem, summer)"
    export.reset_rate()
    assert w.c.get(f"{API}/tickets/export.csv?columns=number,phone", headers=w.h("mona")).status_code == 422


def test_export_guards_every_cell_against_formula_injection(w):
    for title in ("=HYPERLINK(\"http://x\")", "+972", "-27 מעלות", "@SUM(A1)", "רגיל"):
        w.create("tom", title)
    rows = _csv(w.c.get(f"{API}/tickets/export.csv?columns=title&sort=number:asc", headers=w.h("mona")))
    assert [r[0] for r in rows[1:]] == ["'=HYPERLINK(\"http://x\")", "'+972", "'-27 מעלות", "'@SUM(A1)", "רגיל"]
    raw = w.c.get(f"{API}/tickets/export.csv?columns=title", headers=w.h("joni")).content.decode("utf-8-sig")
    assert raw.splitlines()[0] == '"כותרת"', "every cell quoted"
    assert not re.search(r"\d{9,}", raw), "no phone-like number anywhere"


def test_export_cap_rate_and_rename(w, monkeypatch):
    for i in range(3):
        w.create("tom", f"t{i}")
    monkeypatch.setattr(access, "EXPORT_MAX_ROWS", 2)
    r = w.c.get(f"{API}/tickets/export.csv", headers=w.h("mona"))
    assert r.status_code == 413 and r.json()["code"] == "export_too_large"
    monkeypatch.setattr(access, "EXPORT_MAX_ROWS", 5000)
    assert w.c.get(f"{API}/tickets/export.csv", headers=w.h("mona")).status_code == 200, "a refused export does not count against the rate"
    r = w.c.get(f"{API}/tickets/export.csv", headers=w.h("mona"))
    assert r.status_code == 429 and r.json()["details"]["retry_after_s"] >= 1
    assert w.c.get(f"{API}/tickets/export.csv", headers=w.h("joni")).status_code == 200, "the rate is per user"
    # D33: the header names the module with its configured name
    rev = w.c.get(f"{API}/tickets/module").json()["name_revision"]
    assert w.c.put(f"{API}/tickets/name", json={"revision": rev, "he": {"one": "תקלה", "many": "תקלות", "gender": "f"}}).status_code == 200
    export.reset_rate()
    assert _csv(w.c.get(f"{API}/tickets/export.csv?columns=number", headers=w.h("mona")))[0] == ["מס׳ תקלה"]


# ---------------------------------------------------------------- saved views and the preference

def test_saved_views_are_private_validated_and_capped(w):
    body = {"name": "דחופות שלי", "view": {"filters": {"priority": "urgent"}, "sort": "sla:asc", "columns": ["status", "sla"], "density": "compact"}}
    r = w.c.post(f"{API}/tickets/views", json=body, headers=w.h("mona"))
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["view"]["columns"] == ["number", "title", "status", "sla"] and v["view"]["filters"]["priority"] == ["urgent"]
    assert w.c.post(f"{API}/tickets/views", json=body, headers=w.h("mona")).json()["code"] == "view_name_taken"
    assert [x["id"] for x in w.c.get(f"{API}/tickets/views", headers=w.h("mona")).json()["items"]] == [v["id"]]
    assert w.c.get(f"{API}/tickets/views", headers=w.h("tom")).json()["items"] == [], "private to the user"
    for method in ("PATCH", "DELETE"):
        r = w.c.request(method, f"{API}/tickets/views/{v['id']}", json={"name": "x"} if method == "PATCH" else None, headers=w.h("tom"))
        assert r.status_code == 404 and r.json()["code"] == "view_not_found", "another user's view is the same 404 as an unknown one"
    r = w.c.patch(f"{API}/tickets/views/{v['id']}", json={"name": "  שם‮ חדש ", "view": {"density": "comfortable"}}, headers=w.h("mona"))
    assert r.status_code == 200 and r.json()["name"] == "שם חדש" and r.json()["view"]["density"] == "comfortable"
    bad = w.c.post(f"{API}/tickets/views", json={"name": "x", "view": {"filters": {"phone": "1"}}}, headers=w.h("mona"))
    assert bad.status_code == 422 and bad.json()["details"]["fields"][0]["field"] == "view.filters.phone"
    assert w.c.post(f"{API}/tickets/views", json={"name": "   ", "view": {}}, headers=w.h("mona")).status_code == 422
    for i in range(19):
        assert w.c.post(f"{API}/tickets/views", json={"name": f"תצוגה {i}", "view": {}}, headers=w.h("mona")).status_code == 201
    assert w.c.post(f"{API}/tickets/views", json={"name": "עשרים ואחת", "view": {}}, headers=w.h("mona")).json()["code"] == "too_many_views"
    assert w.c.delete(f"{API}/tickets/views/{v['id']}", headers=w.h("mona")).status_code == 200
    assert w.c.get(f"{API}/tickets/views", headers=w.h("vic")).status_code == 403


def test_the_board_preference_is_stored_per_user(w):
    r = w.c.put(f"{API}/me/prefs", json={"tickets.board": {"view": "table", "columns": ["status"], "sort": "number:desc", "density": "compact"}}, headers=w.h("tom"))
    assert r.status_code == 200, r.text
    assert r.json()["prefs"]["tickets.board"] == {"view": "table", "columns": ["number", "title", "status"], "sort": "number:desc", "density": "compact"}
    assert w.c.get(f"{API}/me/prefs", headers=w.h("mona")).json()["prefs"]["tickets.board"] is None
    assert w.c.put(f"{API}/me/prefs", json={"tickets.board": {"sort": "phone:asc"}}, headers=w.h("tom")).status_code == 422
    assert w.c.put(f"{API}/me/prefs", json={"tickets.board": None}, headers=w.h("tom")).json()["prefs"]["tickets.board"] is None


# ---------------------------------------------------------------- guards

def test_only_the_access_module_reads_table_rows_unchecked():
    offenders = []
    for path in SMPLWISE.rglob("*.py"):
        rel = path.relative_to(SMPLWISE).as_posix()
        if rel in ("services/tickets/access.py", "services/tickets/store.py"):
            continue
        if re.search(r"\btable_rows_unchecked\s*\(", path.read_text(encoding="utf-8")):
            offenders.append(rel)
    assert offenders == [], f"a table row read around access.visible(): {offenders}"


def test_the_table_router_does_not_hardcode_the_module_name_and_holds_no_sql():
    src = (SMPLWISE / "routers" / "tickets_table.py").read_text(encoding="utf-8")
    code = re.sub(r'"""[\s\S]*?"""', '""', src)
    code = "\n".join(line.split("#", 1)[0] for line in code.splitlines())
    assert not re.search(r"קריא(ה|ות|ת)|בקש(ה|ת|ות) שירות|ניהול השירות|\bTickets?\b", code)
    assert not re.search(r"\b(FROM|INTO|UPDATE)\s+ticket", src)


# ---------------------------------------------------------------- monthly counts CSV (section 18A backlog item)

MONTHLY = f"{API}/tickets/reports/monthly.csv"


def test_monthly_report_gate_range_bom_visibility_and_audit(w):
    a = w.create("tom", "מזגן")
    b = w.create("tom", "מעלית")
    c = w.create("cleo", "של ניקיון", dept=w.cleaning)
    _set(w, c["id"], created_at="2026-07-05T09:30:00Z")
    _set(w, a["id"], created_at="2026-07-01T09:30:00Z")
    _set(w, b["id"], created_at="2026-07-20T09:30:00Z", status="closed")
    q = "?from=2026-07-01&to=2026-07-31"
    assert w.c.get(MONTHLY + q, headers=w.h("tom")).status_code == 403, "a member without manager rights"
    assert w.c.get(MONTHLY + q, headers=w.h("alda")).status_code == 403, "all departments without tickets.manage"
    for bad in ("", "?from=2026-07-01", "?to=2026-07-31", "?from=x&to=2026-07-31", "?from=2026-08-01&to=2026-07-01", "?from=2025-01-01&to=2026-07-31"):
        r = w.c.get(MONTHLY + bad, headers=w.h("mona"))
        assert r.status_code == 422, (bad, r.status_code)
    r = w.c.get(MONTHLY + q, headers=w.h("mona"))
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv") and "attachment" in r.headers["content-disposition"]
    assert _csv(r) == [["חודש", "מחלקה", "נפתחו", "מתוכן סגורות"], ["2026-07", "אחזקה", "2", "1"]], "mona does not see the cleaning ticket"
    audit = _audit(w, "ticket.report_export")
    assert audit[-1]["decision"] == "allowed" and json.loads(audit[-1]["details_json"])["tickets"] == 2
    assert "מזגן" not in audit[-1]["details_json"]
    assert _audit(w, "ticket.report_export")[0]["decision"] == "denied"
    assert w.c.get(MONTHLY + q, headers=w.h("mona")).status_code == 429, "one per minute per user"
    r = w.c.get(MONTHLY + q + "&lang=en", headers=w.h("joni"))
    assert _csv(r)[0] == ["Month", "Department", "Opened", "Of them closed"] and len(_csv(r)) == 3, "joni sees both departments"
    export.reset_rate()
    assert len(_csv(w.c.get(MONTHLY + "?from=2026-08-01&to=2026-08-31", headers=w.h("mona")))) == 1, "outside the range: header only"


def test_monthly_report_vendor_group_and_formula_guard(w):
    a = w.create("tom", "אחד")
    b = w.create("tom", "שניים")
    assert w.assign("joni", a["id"], "tom").status_code == 200
    _set(w, a["id"], created_at="2026-07-03T09:30:00Z")
    _set(w, b["id"], created_at="2026-07-04T09:30:00Z")
    with _db(w).connection() as conn:
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute("UPDATE ticket_assignments SET assignee_kind = 'contact', contact_id = 'c-fake', assignee_name = '=ספק' WHERE ticket_id = ?", (a["id"],))
    rows = _csv(w.c.get(MONTHLY + "?from=2026-07-01&to=2026-07-31&group=vendor", headers=w.h("mona")))
    assert rows == [["חודש", "ספק", "נפתחו", "מתוכן סגורות"], ["2026-07", "'=ספק", "1", "0"], ["2026-07", "ללא ספק חיצוני", "1", "0"]]


def test_monthly_report_cap_returns_413(w, monkeypatch):
    for i in range(3):
        w.create("tom", f"t{i}")
    monkeypatch.setattr(access, "EXPORT_MAX_ROWS", 2)
    # yesterday..tomorrow: the report counts by the INSTALLATION's day, which differs from the machine's local date near midnight
    # (2.9.0 gate: a runner on UTC at 22:xx while the installation zone was already on the next day -> 0 rows, 200 instead of 413)
    today = __import__("datetime").date.today()
    one = __import__("datetime").timedelta(days=1)
    r = w.c.get(f"{MONTHLY}?from={(today - one).isoformat()}&to={(today + one).isoformat()}", headers=w.h("mona"))
    assert r.status_code == 413 and r.json()["code"] == "export_too_large"
