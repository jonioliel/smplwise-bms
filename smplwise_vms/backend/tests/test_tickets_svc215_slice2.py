"""CR-SVC215 slice 2 over the REAL store (docs/changes/CR-SVC215.md sections 2.3, 5, 7; owner answers 2026-10-24): the list of requests
behind each number of the vendor card (permission-gated, visibility-filtered, audited, cut at an editable limit), the vendor columns of
the monthly CSV (present / absent by permission and by the editable numbers, empty cells for an empty base), the quote comparison's
`vendors[]` rows (the reputation strip and the document mark, only the request's own vendors) and the confirmation when a vendor with
a lapsed document is assigned (409 `document_confirm_required`, never a refusal). Every threshold read here is a `tickets.settings`
key. Every name and number is invented."""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import time

import pytest

from smplwise.db import set_setting
from smplwise.services.tickets import export, vendor_marks
from tickets_s4_world import API, Clock, build_s4, crid

UTC = dt.timezone.utc
QUOTE = [{"kind": "labor", "hours": "2", "rate": "150"}, {"kind": "parts", "description": "מדחס", "quantity": "1", "unit_price": "800"}]
MONTHLY = f"{API}/tickets/reports/monthly.csv"


@pytest.fixture()
def s4(settings, monkeypatch):
    export.reset_rate()
    return build_s4(settings, monkeypatch)


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


def put(s4, **blocks):
    r = s4.c.get(f"{API}/tickets/settings")
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], **blocks})
    assert r.status_code == 200, r.text
    return r


def listing(s4, contact_id: str, metric: str, user: str = "joni", **q):
    return s4.c.get(f"{API}/tickets/contacts/{contact_id}/stats/tickets", params={"metric": metric, **q}, headers=s4.h(user))


def audits(s4, action: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


def stamp(days: float = 0) -> str:
    return (dt.datetime.now(UTC) + dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


def visit(s4, ticket_id: str, vid: str, state: str, late: int = 0, at: str | None = None, contact: str | None = None) -> None:
    at = at or stamp(-1)
    cid = contact or s4.contact["id"]
    with s4.db.connection() as conn:
        conn.execute("INSERT INTO ticket_visits(id, ticket_id, assignment_id, department_id, contact_id, vendor_id, planned_from, planned_to, source, "
                     "grace_min, state, late, created_by_kind, created_at, updated_at) VALUES (?, ?, NULL, 'dept-maintenance', ?, ?, ?, ?, 'manager', 60, ?, ?, "
                     "'system', ?, ?)", (vid, ticket_id, cid, cid, at, at, state, late, at, at))


def claim(s4, ticket_id: str, total: int, basis: int | None, approved_at: str, cid: str = "cl", contact: str | None = None) -> None:
    """An approved demand whose vendor revision named a quote basis (the input of the card's quote adherence)."""
    with s4.db.connection() as conn:
        aid = conn.execute("SELECT id FROM ticket_assignments WHERE ticket_id = ? ORDER BY assigned_at DESC LIMIT 1", (ticket_id,)).fetchone()[0]
        conn.execute("DELETE FROM ticket_cost_claims WHERE assignment_id = ?", (aid,))  # the assignment may already hold its (awaiting) claim row
        conn.execute("INSERT INTO ticket_cost_claims(id, ticket_id, department_id, assignment_id, contact_id, required, status, currency, current_revision_id, "
                     "approved_total_minor, approved_at, snapshot_json, created_at, updated_at) VALUES (?, ?, 'dept-maintenance', ?, ?, 1, 'approved', 'ILS', ?, ?, ?, '{}', ?, ?)",
                     (cid, ticket_id, aid, contact or s4.contact["id"], cid + "-r", total, approved_at, approved_at, approved_at))
        conn.execute("INSERT INTO ticket_cost_revisions(id, claim_id, seq, source, kind, lines_json, labor_minor, parts_minor, travel_minor, other_minor, subtotal_minor, "
                     "vat_mode, vat_rate_bp, vat_minor, total_minor, currency, created_by_kind, created_by, created_at, basis_json) VALUES "
                     "(?, ?, 1, 'vendor', 'submission', '[]', ?, 0, 0, 0, ?, 'none', 0, 0, ?, 'ILS', 'contact', ?, ?, ?)",
                     (cid + "-r", cid, total, total, total, contact or s4.contact["id"], approved_at,
                      json.dumps({"basis_minor": basis}) if basis else None))


def documents(s4, vendor_id: str, *docs: tuple[str, int, int], enabled: bool = True) -> None:
    """Vendor documents as MAINT215 stores them: (doc_type, days from today until it lapses, lead days)."""
    with s4.db.connection() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS maint_tasks (id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, vendor_id TEXT, doc_type TEXT, "
                     "due_date TEXT, lead_days INTEGER NOT NULL DEFAULT 30, active INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL DEFAULT 't', "
                     "created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '', deleted_at TEXT)")
        today = vendor_marks.today(conn)
        for i, (doc_type, left, lead) in enumerate(docs):
            conn.execute("INSERT INTO maint_tasks(id, kind, title, vendor_id, doc_type, due_date, lead_days, active, created_by, created_at, updated_at) "
                         "VALUES (?, 'vendor_document', ?, ?, ?, ?, ?, 1, 't', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                         (f"md-{vendor_id[:6]}-{i}", doc_type, vendor_id, doc_type, (today + dt.timedelta(days=left)).isoformat(), lead))
        set_setting(conn, "maintenance.enabled", "true" if enabled else "false")


# ---------------------------------------------------------------- the list behind a number

def test_the_list_route_switch_permission_and_validation(s4):
    cid = s4.contact["id"]
    assert listing(s4, cid, "done", user="tom").status_code == 403, "a member without tickets.manage"
    denied = audits(s4, "tickets.stats.list")
    assert denied[-1]["decision"] == "denied" and json.loads(denied[-1]["details_json"])["metric"] == "done"
    assert listing(s4, cid, "bogus").status_code == 422
    assert listing(s4, cid, "done", months=7).status_code == 422
    assert listing(s4, "no-such-contact", "done").status_code == 404
    emp = s4.add_contact(display_name="עובד אחזקה", phone="050-000-0077", employee=True)
    if emp.status_code == 201:
        assert listing(s4, emp.json()["id"], "done").status_code == 404, "staff are never measured here"
    put(s4, vendor_stats={"numbers": ["response", "arrival"]})
    r = listing(s4, cid, "done")
    assert r.status_code == 404 and r.json()["code"] == "metric_hidden", "the volume number is switched off"
    assert listing(s4, cid, "late").status_code == 200
    put(s4, vendor_stats={"enabled": False})
    r = listing(s4, cid, "late")
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"


def test_the_list_is_filtered_by_the_usual_ticket_visibility(s4):
    t1, _ = s4.sent()
    other = s4.ticket("cleo", title="של ניקיון", dept=s4.w.cleaning)
    assert s4.assign_contact(other["id"]).status_code == 200
    j = listing(s4, s4.contact["id"], "open", user="joni").json()
    assert j["total"] == 2 and {i["id"] for i in j["items"]} == {t1["id"], other["id"]}
    m = listing(s4, s4.contact["id"], "open", user="mona").json()
    assert m["total"] == 1 and [i["id"] for i in m["items"]] == [t1["id"]], "mona manages maintenance only: the cleaning request is neither listed nor counted"
    assert m["number"] == "volume" and "title" in m["items"][0] and "detail" in m["items"][0]
    ok = audits(s4, "tickets.stats.list")[-1]
    assert ok["decision"] == "allowed" and json.loads(ok["details_json"]) == {"metric": "open", "months": 12, "listed": 1, "total": 1}
    assert t1["title"] not in ok["details_json"], "the audit names counts, not requests"


def test_each_number_lists_the_requests_behind_it(s4):
    cid = s4.contact["id"]
    t, token = s4.sent()  # done, then reopened inside 30 days -> a repeat visit
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 200
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()}).status_code == 200
    t2, token2 = s4.sent()
    c2, _ = s4.public(Clock(time.time()))
    assert c2.post("/t/api/return", headers=hdr(token2), json={"kind": "cannot_handle", "reason": "חסר חלק", "client_request_id": crid()}).status_code == 200
    with s4.db.connection() as conn:
        conn.execute("INSERT INTO ticket_events(ticket_id, at, kind, actor_kind, via, from_status, to_status) VALUES (?, ?, 'status', 'user', 'app', 'done', 'in_progress')",
                     (t["id"], stamp(0.0001)))
    # the card and the list agree: every count of the card is the length of its list
    card = s4.c.get(f"{API}/tickets/contacts/{cid}/stats", headers=s4.h("joni")).json()["numbers"]
    assert listing(s4, cid, "returned").json()["total"] == card["returned"]["count"] == 1
    assert [i["id"] for i in listing(s4, cid, "returned").json()["items"]] == [t2["id"]]
    assert listing(s4, cid, "returned").json()["items"][0]["detail"] == {"kind": "cannot_handle"}
    assert listing(s4, cid, "done").json()["total"] == card["volume"]["done"] == 1
    rep = listing(s4, cid, "repeat").json()
    assert rep["total"] == card["repeat"]["count"] == 1 and rep["items"][0]["id"] == t["id"] and rep["items"][0]["detail"] == {"days": 30}
    resp = listing(s4, cid, "response").json()
    assert resp["total"] == card["response"]["base"] and all(set(i["detail"]) == {"minutes"} for i in resp["items"])
    ta, tb, tc = s4.ticket(), s4.ticket(), s4.ticket()
    visit(s4, ta["id"], "va", "arrived", 0)
    visit(s4, tb["id"], "vb", "arrived", 1)
    visit(s4, tc["id"], "vc", "missed", 0)
    visit(s4, s4.ticket()["id"], "vd", "planned", 0)  # a planned or cancelled visit is in no list
    card = s4.c.get(f"{API}/tickets/contacts/{cid}/stats", headers=s4.h("joni")).json()["numbers"]["arrival"]
    assert (card["on_time"], card["late"], card["missed"]) == (1, 1, 1)
    for metric, ticket in (("on_time", ta), ("late", tb), ("missed", tc)):
        r = listing(s4, cid, metric).json()
        assert [i["id"] for i in r["items"]] == [ticket["id"]] and r["number"] == "arrival", metric


def test_money_metrics_need_the_money_permission_and_carry_the_basis(s4):
    cid = s4.contact["id"]
    t1, _ = s4.sent()
    t2, _ = s4.sent()
    t3, _ = s4.sent()
    claim(s4, t1["id"], 10000, 10000, stamp(-3), "c1")      # at the quote
    claim(s4, t2["id"], 12000, 10000, stamp(-2), "c2")      # 20 % over
    claim(s4, t3["id"], 9000, None, stamp(-1), "c3")        # no basis: in neither list
    card = s4.c.get(f"{API}/tickets/contacts/{cid}/stats", headers=s4.h("joni")).json()["numbers"]["quote"]
    assert (card["kept"], card["base"], card["overshoot_median_bp"]) == (1, 2, 2000)
    k = listing(s4, cid, "kept").json()
    assert [i["id"] for i in k["items"]] == [t1["id"]] and k["money"] is True
    o = listing(s4, cid, "overshoot").json()
    assert [i["id"] for i in o["items"]] == [t2["id"]]
    assert o["items"][0]["detail"] == {"basis_minor": 10000, "total_minor": 12000, "currency": "ILS", "overshoot_bp": 2000}
    r = listing(s4, cid, "overshoot", user="mona")
    assert r.status_code == 403 and "total_minor" not in r.text, "mona manages but does not hold tickets.costs.view"
    last = audits(s4, "tickets.stats.list")[-1]
    assert last["decision"] == "denied" and last["reason"] == "money_permission_missing"
    assert listing(s4, cid, "returned", user="mona").status_code == 200, "the non-money lists stay open to the site manager"
    put(s4, vendor_stats={"money_permission": "tickets.configure"})
    assert listing(s4, cid, "kept", user="mona").status_code == 403, "owner answer 30: who sees money is editable"


def test_the_list_limit_is_a_setting(s4):
    cid = s4.contact["id"]
    for i in range(12):
        visit(s4, s4.ticket(title=f"t{i}")["id"], f"vm{i}", "arrived", 0, at=stamp(-1 - i / 100))
    r = listing(s4, cid, "on_time").json()
    assert r["total"] == 12 and r["limit"] == 50 and not r["truncated"]
    put(s4, vendor_stats={"list_limit": 10})
    r = listing(s4, cid, "on_time").json()
    assert (r["total"], len(r["items"]), r["limit"], r["truncated"]) == (12, 10, 10, True)
    bad = s4.c.put(f"{API}/tickets/settings", json={"revision": s4.c.get(f"{API}/tickets/settings").json()["revision"], "vendor_stats": {"list_limit": 5}})
    assert bad.status_code == 422, "the range is validated"


# ---------------------------------------------------------------- the monthly CSV

def month_world(s4):
    """One request in July 2026 assigned to the contact: acknowledged 30 minutes after the assignment, two ended visits (one on time, one
    missed) and an approved demand 20 % over its quote."""
    t, _ = s4.sent()
    with s4.db.connection() as conn:
        conn.execute("UPDATE tickets SET created_at = '2026-07-05T09:00:00Z' WHERE id = ?", (t["id"],))
        conn.execute("UPDATE ticket_assignments SET assigned_at = '2026-07-05T09:00:00Z', acknowledged_at = '2026-07-05T09:30:00Z' WHERE ticket_id = ?", (t["id"],))
    visit(s4, t["id"], "mv1", "arrived", 0, at="2026-07-06T08:00:00Z")
    visit(s4, t["id"], "mv2", "missed", 0, at="2026-07-07T08:00:00Z")
    claim(s4, t["id"], 12000, 10000, "2026-07-10T10:00:00Z", "mc1")
    return t


def csv_of(r):
    assert r.status_code == 200, r.text
    return list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))


def test_vendor_csv_columns_follow_the_permission(s4):
    month_world(s4)
    q = "?from=2026-07-01&to=2026-07-31&group=vendor"
    rows = csv_of(s4.c.get(MONTHLY + q, headers=s4.h("joni")))
    assert rows[0] == ["חודש", "ספק", "נפתחו", "מתוכן סגורות", "חציון תגובה (דקות)", "הגעות בזמן", "ביקורים שהסתיימו", "ביקורים חוזרים", "בסיס לביקורים חוזרים",
                       "לפי ההצעה", "בסיס להצעות", "חריגה חציונית (נקודות בסיס)"]
    line = rows[1]
    assert line[:4] == ["2026-07", "משה אברהם", "1", "0"]
    assert line[4:] == ["30", "1", "2", "", "", "0", "1", "2000"], "an empty base is an empty cell, never 0; the quote kept is 0 of 1"
    export.reset_rate()
    en = csv_of(s4.c.get(MONTHLY + q + "&lang=en", headers=s4.h("joni")))
    assert en[0][4:] == ["response_median_min", "arrival_on_time", "arrival_total", "repeat_visits", "repeat_base", "quote_kept", "quote_base", "quote_overshoot_median_bp"]
    export.reset_rate()
    mona = csv_of(s4.c.get(MONTHLY + q, headers=s4.h("mona")))
    assert len(mona[0]) == 9 and "לפי ההצעה" not in mona[0] and "2000" not in mona[1], "the money columns are ABSENT (not blank) without tickets.costs.view"
    assert mona[1][4:] == ["30", "1", "2", "", ""]
    export.reset_rate()
    assert len(csv_of(s4.c.get(MONTHLY + "?from=2026-07-01&to=2026-07-31", headers=s4.h("joni")))[0]) == 4, "the department group is unchanged"
    export.reset_rate()
    ok = [a for a in audits(s4, "ticket.report_export") if a["decision"] == "allowed"]
    assert json.loads(ok[0]["details_json"])["vendor_columns"] is True and json.loads(ok[0]["details_json"])["money_columns"] is True
    assert json.loads(ok[2]["details_json"])["money_columns"] is False


def test_vendor_csv_columns_are_editable_and_windowed(s4):
    month_world(s4)
    q = "?from=2026-07-01&to=2026-07-31&group=vendor"
    put(s4, vendor_stats={"numbers": ["arrival", "quote"]})
    rows = csv_of(s4.c.get(MONTHLY + q, headers=s4.h("joni")))
    assert rows[0][4:] == ["הגעות בזמן", "ביקורים שהסתיימו", "לפי ההצעה", "בסיס להצעות", "חריגה חציונית (נקודות בסיס)"], "hidden numbers drop their columns"
    export.reset_rate()
    put(s4, vendor_stats={"csv_columns": False})
    assert len(csv_of(s4.c.get(MONTHLY + q, headers=s4.h("joni")))[0]) == 4
    export.reset_rate()
    put(s4, vendor_stats={"csv_columns": True, "card_permission": "tickets.configure"})
    assert len(csv_of(s4.c.get(MONTHLY + q, headers=s4.h("mona")))[0]) == 4, "the card permission is editable: mona gets the plain file"
    export.reset_rate()
    # the report range cuts the window: a range that starts after the visits sees no arrival base and no quote base
    rows = csv_of(s4.c.get(MONTHLY + "?from=2026-07-05&to=2026-07-05&group=vendor", headers=s4.h("joni")))
    assert rows[1][2] == "1" and rows[1][4:] == [""] * 5, "numbers are arrival + quote: nothing ended inside that single day"


# ---------------------------------------------------------------- the quote comparison

def new_rfq_with_two_quotes(s4):
    from datetime import timedelta
    due = (dt.datetime.now(UTC) + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    r = s4.c.post(f"{API}/tickets/rfqs", json={"department_id": "dept-maintenance", "title": "החלפת מזגן", "description": "דולף", "due_at": due,
                                              "work_from": stamp(5), "work_to": stamp(10),
                                              "vendors": [{"contact_id": s4.vendor["id"]}, {"contact_id": s4.contact["id"]}], "client_request_id": crid()},
                  headers=s4.h("joni"))
    assert r.status_code == 201, r.text
    d = r.json()
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/send", json={"revision": d["revision"], "channel": "manual", "client_request_id": crid()}, headers=s4.h("joni"))
    assert r.status_code == 200, r.text
    d = r.json()
    for v in d["vendors"]:
        q = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v['id']}/quotes", json={"lines": QUOTE}, headers=s4.h("joni"))
        assert q.status_code == 201, q.text
    return d


def compare(s4, rid: str, user: str = "joni"):
    return s4.c.get(f"{API}/tickets/rfqs/{rid}/comparison", headers=s4.h(user))


def test_the_comparison_carries_the_reputation_strip_and_the_document_mark(s4):
    visit(s4, s4.ticket()["id"], "cv1", "arrived", 0, contact=s4.vendor["id"])
    visit(s4, s4.ticket()["id"], "cv2", "missed", 0, contact=s4.vendor["id"])
    documents(s4, s4.vendor["id"], ("insurance", -10, 30), ("electrician_license", 12, 30), ("work_at_height", 200, 30))
    d = new_rfq_with_two_quotes(s4)
    body = compare(s4, d["id"]).json()
    by = {v["contact_id"]: v for v in body["vendors"]}
    assert set(by) == {s4.vendor["id"], s4.contact["id"]} and {v["vendor_id"] for v in body["vendors"]} == {q["vendor_id"] for q in body["quotes"]}
    mine = by[s4.vendor["id"]]
    assert mine["documents"]["state"] == "expired"
    assert [x["doc_type"] for x in mine["documents"]["expired"]] == ["insurance"] and [x["doc_type"] for x in mine["documents"]["expiring"]] == ["electrician_license"]
    assert mine["stats"]["months"] == 12 and set(mine["stats"]["numbers"]) == {"arrival", "repeat"}, "the strip is arrival and repeat by default, and never money"
    assert mine["stats"]["numbers"]["arrival"] == {"on_time": 1, "late": 0, "missed": 1, "base": 2, "share_bp": 5000}
    assert by[s4.contact["id"]]["documents"] is None, "no document: no mark"
    assert "file" not in json.dumps(body["vendors"]) and "title" not in json.dumps(mine["documents"])
    # the numbers of the strip are editable; money only for the money permission
    put(s4, vendor_stats={"strip_numbers": ["arrival", "quote"]})
    mine = {v["contact_id"]: v for v in compare(s4, d["id"]).json()["vendors"]}[s4.vendor["id"]]
    assert set(mine["stats"]["numbers"]) == {"arrival", "quote"}
    put(s4, vendor_stats={"numbers": ["arrival", "repeat"]})
    mine = {v["contact_id"]: v for v in compare(s4, d["id"]).json()["vendors"]}[s4.vendor["id"]]
    assert set(mine["stats"]["numbers"]) == {"arrival"}, "a number hidden on the card is hidden in the strip"


def test_the_comparison_switches(s4):
    documents(s4, s4.vendor["id"], ("insurance", -3, 30))
    d = new_rfq_with_two_quotes(s4)
    put(s4, vendor_stats={"enabled": False})
    body = compare(s4, d["id"]).json()
    assert all("stats" not in v for v in body["vendors"]) and next(v for v in body["vendors"] if v["contact_id"] == s4.vendor["id"])["documents"]["state"] == "expired"
    put(s4, vendor_stats={"enabled": True}, vendor_documents={"comparison_marks": False})
    body = compare(s4, d["id"]).json()
    assert all(v["documents"] is None for v in body["vendors"]) and all("stats" in v for v in body["vendors"])
    put(s4, vendor_documents={"comparison_marks": True})
    documents(s4, s4.vendor["id"], enabled=False)
    assert all(v["documents"] is None for v in compare(s4, d["id"]).json()["vendors"]), "empty while the maintenance module is off"
    put(s4, vendor_stats={"card_permission": "tickets.configure"})
    assert compare(s4, d["id"], user="joni").status_code == 200
    assert compare(s4, d["id"], user="mona").status_code == 403, "the comparison itself stays tickets.costs.view"


def test_a_vendor_outside_the_request_never_appears(s4):
    stranger = s4.add_contact(kind="vendor", display_name="ספק אחר", phone="050-000-0066").json()
    visit(s4, s4.ticket()["id"], "sv1", "arrived", 0, contact=stranger["id"])
    documents(s4, stranger["id"], ("insurance", -3, 30))
    d = new_rfq_with_two_quotes(s4)
    blob = compare(s4, d["id"]).text
    assert stranger["id"] not in blob and "ספק אחר" not in blob


# ---------------------------------------------------------------- the lapsed document confirmation on assign

def test_assigning_a_vendor_with_an_expired_document_asks_and_never_refuses(s4):
    documents(s4, s4.vendor["id"], ("insurance", -10, 30), ("work_at_height", 400, 30))
    tech = s4.add_contact(display_name="טכנאי קליימה", phone="050-000-0078", vendor_id=s4.vendor["id"])
    assert tech.status_code == 201, tech.text
    t = s4.ticket()
    before = s4.w.detail(t["id"])
    r = s4.assign_contact(t["id"], tech.json()["id"])
    assert r.status_code == 409 and r.json()["code"] == "document_confirm_required", r.text
    docs = r.json()["details"]["documents"]
    assert [(x["doc_type"], x["state"]) for x in docs] == [("insurance", "expired")] and r.json()["details"]["vendor"]["id"] == s4.vendor["id"]
    after = s4.w.detail(t["id"])
    assert (after["revision"], after["status"]) == (before["revision"], before["status"]), "nothing was written"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_assignments WHERE ticket_id = ?", (t["id"],)).fetchone()[0] == 0
    denied = audits(s4, "tickets.assign.lapsed_document")
    assert len(denied) == 1 and denied[0]["decision"] == "denied" and denied[0]["reason"] == "confirm_required"
    r = s4.assign_contact(t["id"], tech.json()["id"], document_confirm=True)
    assert r.status_code == 200, r.text
    rows = audits(s4, "tickets.assign.lapsed_document")
    assert [x["decision"] for x in rows] == ["denied", "allowed"]
    det = json.loads(rows[1]["details_json"])
    assert det["contact_id"] == tech.json()["id"] and [x["doc_type"] for x in det["documents"]] == ["insurance"]
    assert "insurance" in rows[1]["details_json"] and "file" not in rows[1]["details_json"], "types and dates, never a file"


def test_the_confirmation_is_driven_by_editable_settings_and_by_real_lapses(s4):
    documents(s4, s4.vendor["id"], ("insurance", 12, 30))  # inside its lead, not yet expired
    t = s4.ticket()
    r = s4.assign_contact(t["id"], s4.vendor["id"])
    assert r.status_code == 200, "an expiring document does not ask by default"
    put(s4, vendor_documents={"confirm_expiring": True})
    t2 = s4.ticket()
    r = s4.assign_contact(t2["id"], s4.vendor["id"])
    assert r.status_code == 409 and r.json()["details"]["documents"][0]["state"] == "expiring"
    put(s4, vendor_documents={"confirm_on_assign": False})
    assert s4.assign_contact(t2["id"], s4.vendor["id"]).status_code == 200, "the whole check is a switch"
    # no document, a confirmed flag on a clean vendor: nothing to audit
    clean = s4.add_contact(kind="vendor", display_name="ספק נקי", phone="050-000-0055").json()
    before = len(audits(s4, "tickets.assign.lapsed_document"))
    assert s4.assign_contact(s4.ticket()["id"], clean["id"], document_confirm=True).status_code == 200
    assert len(audits(s4, "tickets.assign.lapsed_document")) == before
    # the maintenance module off: the helper answers empty, so nothing asks
    put(s4, vendor_documents={"confirm_on_assign": True})
    documents(s4, s4.vendor["id"], ("insurance", -30, 30), enabled=False)
    assert s4.assign_contact(s4.ticket()["id"], s4.vendor["id"]).status_code == 200


def test_document_confirm_is_for_an_outside_contact_only(s4):
    t = s4.ticket()
    rev = s4.w.detail(t["id"])["revision"]
    r = s4.c.post(f"{API}/tickets/{t['id']}/assign", json={"assignee": {"kind": "user", "id": "dev-tom"}, "document_confirm": True, "revision": rev},
                  headers=s4.h("joni"))
    assert r.status_code in (422, 404), r.text
    if r.status_code == 422:
        assert r.json()["details"]["fields"][0]["field"] == "document_confirm"


def test_the_new_settings_keys_are_audited_and_validated(s4):
    r = put(s4, vendor_documents={"confirm_expiring": True}, vendor_stats={"strip_numbers": ["volume", "arrival"], "csv_columns": False})
    doc = s4.c.get(f"{API}/tickets/settings").json()
    assert doc["vendor_documents"] == {"confirm_on_assign": True, "confirm_expiring": True, "comparison_marks": True}
    assert doc["vendor_stats"]["strip_numbers"] == ["arrival", "volume"] and doc["vendor_stats"]["csv_columns"] is False and doc["vendor_stats"]["list_limit"] == 50
    rev = doc["revision"]
    bad = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "vendor_stats": {"strip_numbers": ["score"]}})
    assert bad.status_code == 422
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "vendor_documents": {"confirm_on_assign": "yes"}}).status_code == 422
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "vendor_documents": {"bogus": True}}).status_code == 422
    assert r.status_code == 200
