"""MGRDASH phase 2 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md sections 4, 5, 7, 10): GET /tickets/dashboard - the manager overview's
summary route. Negative first: the gate, the department filter (a refusal, never an empty answer), the module switch; then the leak
checks between departments (a handler shared by two departments, quotes, demands, requests for quotation); then the definitions
(services/tickets/dashboard.py): done / closed / returned per handler, the 14 days, waiting for my decision with amounts only for
tickets.costs.view, the RFQ stages, the second approval of the exact confirm rule, the department comparison, the 30-second cache, the
indexes of migration 0120. Every name and number here is invented."""
from __future__ import annotations

import datetime as dt

import pytest
from conftest import bind

from smplwise.db import Database, new_id
from smplwise.services.tickets import dashboard
from tickets_s4_world import API, build_s4, crid

QUOTE = [{"kind": "labor", "hours": "2", "rate": "150"}]


def _at(days: float = 0) -> str:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture()
def s4(settings, monkeypatch):
    dashboard.CACHE.clear()
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    yield world
    dashboard.CACHE.clear()


def dash(s4, user: str, fresh: bool = True, **q):
    if fresh:
        dashboard.CACHE.clear()
    return s4.c.get(f"{API}/tickets/dashboard", params=q, headers=s4.h(user))


def ok(s4, user: str, **q) -> dict:
    r = dash(s4, user, **q)
    assert r.status_code == 200, r.text
    return r.json()


def done_by(s4, ticket: dict, handler: str = "tom", manager: str = "mona") -> None:
    assert s4.w.assign(manager, ticket["id"], handler).status_code == 200
    assert s4.w.status(handler, ticket["id"], "in_progress").status_code == 200
    r = s4.w.status(handler, ticket["id"], "done")
    assert r.status_code == 200, r.text


def rows(d: dict) -> dict[str, dict]:
    return {r["key"]: r for r in d["throughput"]["rows"]}


# ---------------------------------------------------------------- the gate, the filter, the switch

@pytest.mark.parametrize("user,code", [("tom", 403), ("nora", 403), ("alda", 403), ("vic", 403), ("dina", 403), ("mona", 200), ("cleo", 200),
                                       ("joni", 200)])
def test_only_managers_get_the_summary(s4, user, code):
    r = dash(s4, user)
    assert r.status_code == code, (user, r.text)
    if code == 403:
        assert r.json()["code"] == "forbidden"


def test_a_department_the_caller_does_not_manage_is_refused_and_audited(s4):
    r = dash(s4, "mona", department_id=s4.w.cleaning)
    assert r.status_code == 403 and r.json()["code"] == "forbidden", "never an empty answer that says the department exists"
    with s4.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM audit_log WHERE action = 'ticket.dashboard' AND decision = 'denied' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row is not None and row["reason"] == "department_not_managed"
    assert dash(s4, "mona", department_id="dept-maintenance").status_code == 200
    assert dash(s4, "joni", department_id=s4.w.cleaning).status_code == 200, "the all-departments manager may filter to any department"


@pytest.mark.parametrize("period", ["1", "7", "week", "30", "7d ", "all", "TODAY"])
def test_period_outside_the_allow_list_is_refused(s4, period):
    assert dash(s4, "mona", period=period).status_code == 422


def test_module_off_is_the_uniform_404(s4):
    s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"})
    r = dash(s4, "mona")
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"


def test_the_default_period_is_the_handler_cards_period(s4):
    d = ok(s4, "mona")
    assert d["period"] == "7d" and d["days"] == 7
    assert ok(s4, "mona", period="today")["days"] == 1 and ok(s4, "mona", period="30d")["days"] == 30
    assert len(d["daily"]["days"]) == 14


# ---------------------------------------------------------------- throughput, the 14 days

def test_done_closed_and_returned_are_credited_to_the_handler(s4):
    a = s4.ticket("mona", "מזגן")
    done_by(s4, a)
    assert s4.w.status("mona", a["id"], "closed").status_code == 200  # done -> closed: the manager's confirmation
    b = s4.ticket("mona", "דלת")
    done_by(s4, b)
    r = s4.w.status("mona", b["id"], "in_progress", note="חסר בורג")  # sent back: finished work came back
    assert r.status_code == 200, r.text
    d = ok(s4, "mona")
    tom = rows(d)["user:dev-tom"]
    assert (tom["done"], tom["closed"], tom["returned"]) == (1, 1, 1), tom
    assert tom["kind"] == "user" and tom["name"]
    assert tom["median_seconds"] is not None and tom["median_seconds"] >= 0
    assert d["throughput"]["total"]["done"] == 1 and d["throughput"]["total"]["closed"] == 1
    today = d["daily"]["days"][-1]
    assert today["opened"] >= 2 and today["closed"] == 1
    assert d["daily"]["net"] == sum(x["opened"] - x["closed"] for x in d["daily"]["days"])


def test_a_handler_shared_by_two_departments_is_counted_per_managed_department(s4):
    s4.w.member(s4.w.cleaning, "tom", "member")
    done_by(s4, s4.ticket("mona", "מזגן"))
    done_by(s4, s4.ticket("cleo", "רצפה", dept=s4.w.cleaning), manager="cleo")
    assert rows(ok(s4, "mona"))["user:dev-tom"]["done"] == 1, "the maintenance manager sees maintenance work only"
    assert rows(ok(s4, "cleo"))["user:dev-tom"]["done"] == 1, "the cleaning manager sees cleaning work only"
    assert rows(ok(s4, "joni"))["user:dev-tom"]["done"] == 2, "the all-departments manager sees the total"
    assert rows(ok(s4, "joni", department_id=s4.w.cleaning))["user:dev-tom"]["done"] == 1
    assert ok(s4, "cleo")["daily"]["days"][-1]["opened"] == 1


def test_an_old_completion_is_outside_today_but_inside_the_month(s4):
    a = s4.ticket("mona", "מזגן")
    done_by(s4, a)
    old = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=10)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    with Database(s4.w.settings.db_path).connection() as conn:
        conn.execute("UPDATE tickets SET done_at = ? WHERE id = ?", (old, a["id"]))
        conn.execute("UPDATE ticket_assignments SET assigned_at = ? WHERE ticket_id = ?", (old, a["id"]))
    assert "user:dev-tom" not in rows(ok(s4, "mona", period="7d"))
    assert rows(ok(s4, "mona", period="30d"))["user:dev-tom"]["done"] == 1


# ---------------------------------------------------------------- waiting for my decision

def _quote_and_claim(s4, ticket_id: str, contact_id: str) -> None:
    now = _at()
    with Database(s4.w.settings.db_path).connection() as conn:
        asg = conn.execute("SELECT id FROM ticket_assignments WHERE ticket_id = ? AND ended_at IS NULL", (ticket_id,)).fetchone()["id"]
        conn.execute(
            "INSERT INTO ticket_quotes (id, ticket_id, assignment_id, contact_id, department_id, version, source, state, currency, vat_mode, vat_rate_bp, "
            "lines_json, labor_minor, parts_minor, travel_minor, other_minor, subtotal_minor, vat_minor, total_minor, created_by_kind, created_by, "
            "created_at, updated_at) VALUES (?, ?, ?, ?, 'dept-maintenance', 1, 'vendor', 'submitted', 'ILS', 'none', 0, '[]', 30000, 0, 0, 0, 30000, 0, "
            "30000, 'contact', ?, ?, ?)", (new_id(), ticket_id, asg, contact_id, contact_id, now, now))
        cid, rid = new_id(), new_id()
        conn.execute(
            "INSERT INTO ticket_cost_claims (id, ticket_id, department_id, assignment_id, contact_id, required, status, currency, current_revision_id, "
            "snapshot_json, created_at, updated_at) VALUES (?, ?, 'dept-maintenance', ?, ?, 1, 'submitted', 'ILS', ?, '{}', ?, ?)",
            (cid, ticket_id, asg, contact_id, rid, now, now))
        conn.execute(
            "INSERT INTO ticket_cost_revisions (id, claim_id, seq, source, kind, lines_json, labor_minor, parts_minor, travel_minor, other_minor, "
            "subtotal_minor, vat_mode, vat_rate_bp, vat_minor, total_minor, currency, created_by_kind, created_by, created_at) "
            "VALUES (?, ?, 1, 'vendor', 'submission', '[]', 45000, 0, 0, 0, 45000, 'none', 0, 0, 45000, 'ILS', 'contact', ?, ?)", (rid, cid, contact_id, now))


def test_quotes_and_demands_wait_for_the_manager_with_amounts_only_for_cost_viewers(s4):
    t, _token = s4.sent("מזגן דולף")
    _quote_and_claim(s4, t["id"], s4.contact["id"])
    ap = ok(s4, "mona")["approvals"]
    assert ap["quotes"]["count"] == 1 and ap["claims"]["count"] == 1
    q, c = ap["quotes"]["items"][0], ap["claims"]["items"][0]
    assert q["ticket"]["id"] == t["id"] and q["vendor"]
    assert (q["amount_minor"], q["currency"], c["amount_minor"], c["currency"]) == (None, None, None, None), "no tickets.costs.view: counts only"
    bind(s4.c, s4.w.settings, "mona", "tickets_costs_view", "installation", "*")
    ap = ok(s4, "mona")["approvals"]
    assert (ap["quotes"]["items"][0]["amount_minor"], ap["claims"]["items"][0]["amount_minor"]) == (30000, 45000)
    assert ap["claims"]["items"][0]["currency"] == "ILS"
    other = ok(s4, "cleo")["approvals"]
    assert other["quotes"]["count"] == 0 and other["claims"]["count"] == 0, "another department's manager sees nothing of it"


def _rfq(s4, user: str = "mona") -> dict:
    payload = {"department_id": "dept-maintenance", "title": "החלפת מזגן בחדר הישיבות", "due_at": _at(3), "work_from": _at(5), "work_to": _at(10),
               "vendors": [{"contact_id": s4.vendor["id"]}, {"contact_id": s4.contact["id"]}], "client_request_id": crid()}
    r = s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h(user))
    assert r.status_code == 201, r.text
    d = r.json()
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/send", json={"revision": d["revision"], "channel": "manual", "client_request_id": crid()},
                  headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()


def test_open_requests_with_their_stage_and_unanswered_questions(s4):
    d = _rfq(s4)
    rows_ = ok(s4, "mona")["rfqs"]
    assert rows_["count"] == 1
    it = rows_["items"][0]
    assert (it["id"], it["stage"], it["invited"], it["quoted"], it["questions"]) == (d["id"], "collecting", 2, 0, 0)
    vid = d["vendors"][0]["id"]
    with Database(s4.w.settings.db_path).connection() as conn:
        conn.execute("INSERT INTO ticket_rfq_messages (id, rfq_id, rfq_vendor_id, direction, body, author_kind, author_id, created_at) "
                     "VALUES (?, ?, ?, 'in', 'האם כולל פירוק?', 'contact', ?, ?)", (new_id(), d["id"], vid, s4.vendor["id"], _at()))
    out = ok(s4, "mona")["rfqs"]
    assert out["items"][0]["stage"] == "questions" and out["items"][0]["questions"] == 1 and out["questions"] == 1
    assert "body" not in out["items"][0] and "text" not in out["items"][0], "a count, never the question's text"
    assert ok(s4, "cleo")["rfqs"]["count"] == 0, "another department's manager does not see the request"
    with Database(s4.w.settings.db_path).connection() as conn:
        conn.execute("UPDATE ticket_rfqs SET due_at = ? WHERE id = ?", (_at(-1), d["id"]))
    assert ok(s4, "mona")["rfqs"]["items"][0]["stage"] == "decide", "the deadline passed: the manager decides"


def test_a_second_approval_waits_only_for_an_eligible_approver(s4):
    for n in ("kim", "lea"):
        bind(s4.c, s4.w.settings, n, "system_admin", "installation", "*")
    assert s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": 100}).status_code == 200
    d = _rfq(s4)
    vid = next(v["id"] for v in d["vendors"] if v["contact"]["id"] == s4.vendor["id"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{vid}/quotes", json={"lines": QUOTE}, headers=s4.h("joni"))
    assert r.status_code == 201, r.text
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    q = next(x for x in cmp["quotes"] if x["vendor_id"] == vid)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards", json={"quote_id": q["quote_id"], "revision": q["revision"]}, headers=s4.h("kim"))
    assert r.status_code == 201 and r.json()["award"]["state"] == "pending_second", r.text
    lea = ok(s4, "lea")["approvals"]["second"]
    assert lea["count"] == 1 and lea["items"][0]["rfq"]["id"] == d["id"] and lea["items"][0]["amount_minor"] is not None
    for user in ("kim", "joni", "mona"):  # the first approver, the one who entered the quote, the requester
        assert ok(s4, user)["approvals"]["second"]["count"] == 0, user
    assert ok(s4, "mona")["rfqs"]["items"][0]["stage"] == "second"


# ---------------------------------------------------------------- the department comparison, the cache, the indexes

def test_the_comparison_is_for_the_all_departments_manager_only(s4):
    done_by(s4, s4.ticket("mona", "מזגן"))
    s4.ticket("cleo", "רצפה", dept=s4.w.cleaning)
    assert ok(s4, "mona")["departments"] is None and ok(s4, "mona")["all_departments"] is False
    deps = {x["id"]: x for x in ok(s4, "joni")["departments"]}
    assert deps["dept-maintenance"]["done_7d"] == 1 and deps["dept-maintenance"]["waiting"] == 1, deps
    assert deps[s4.w.cleaning]["open"] == 1 and deps[s4.w.cleaning]["waiting"] == 1


def test_busy_handlers_follow_the_department_threshold(s4):
    for title in ("א", "ב"):
        t = s4.ticket("mona", title)
        assert s4.w.assign("mona", t["id"], "tom").status_code == 200
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "ui": {"dash_busy_departments": {"dept-maintenance": 2}}})
    assert r.status_code == 200, r.text
    deps = {x["id"]: x for x in ok(s4, "joni")["departments"]}
    assert deps["dept-maintenance"]["busy_handlers"] == 1


def test_the_answer_is_kept_thirty_seconds_per_caller(s4):
    first = ok(s4, "mona")
    s4.ticket("mona", "חדש")
    again = dash(s4, "mona", fresh=False).json()
    assert again["generated_at"] == first["generated_at"] and again["daily"] == first["daily"], "served from the 30-second cache"
    other = dash(s4, "cleo", fresh=False).json()
    assert other["daily"]["days"][-1]["opened"] == 0, "the cache is per caller: cleo never gets mona's answer"
    assert ok(s4, "mona")["daily"]["days"][-1]["opened"] == first["daily"]["days"][-1]["opened"] + 1


def test_an_allowed_open_is_audited_at_most_once_in_ten_minutes(s4):
    dashboard.CACHE.clear()
    for _ in range(3):
        assert dash(s4, "mona", fresh=False).status_code == 200
    with s4.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.dashboard' AND decision = 'allowed'").fetchone()[0]
    assert n == 1


def test_0120_adds_the_two_indexes(s4):
    with s4.db.connection(mode="read") as conn:
        names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
        plan = " ".join(str(r[3]) for r in conn.execute(
            "EXPLAIN QUERY PLAN SELECT id FROM ticket_events WHERE to_status IN ('closed') AND at >= '2026-01-01' AND at <= '2026-02-01'"))
    assert {"idx_ticket_events_status_at", "idx_tickets_done_at"} <= names
    assert "idx_ticket_events_status_at" in plan
