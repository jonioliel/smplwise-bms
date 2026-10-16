"""TKDETAILBE - the service-request detail backend over the REAL store (docs/tickets/DETAIL_BACKEND_CONTRACT.md; owner decisions
15.10): the internal owner and its history, the allowed line kinds, quotes before the work (vendor through the link, on behalf,
versions, partial approval, fix requests, self-approval), the payment demand against the approved quote (exceptional lines, approve
without them), the cost-flow stage, the unified timeline and its filters, writing to the vendor and forwarding an internal note,
decision drafts that are NEVER sent automatically, the permission matrix and the purge. Every name and number here is invented."""
from __future__ import annotations

import datetime as dt
import re
import shutil
import time

import pytest
from conftest import bind

from smplwise.db import MIGRATIONS_DIR
from smplwise.services.tickets import store
from tickets_s4_world import API, Clock, build_s4, crid


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")  # the maintenance manager may send outside
    return world


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


_SOON = dt.datetime.now(dt.timezone.utc).replace(hour=6, minute=0, second=0, microsecond=0) + dt.timedelta(days=5)
SOON = _SOON.strftime("%Y-%m-%dT%H:%M:%SZ")
SOON_END = (_SOON + dt.timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")
SOON_DAY = _SOON.strftime("%d.%m.%Y")  # 06:00 UTC is the same day in the installation's zone

QUOTE = [{"kind": "labor", "hours": "2", "rate": "150"}, {"kind": "parts", "description": "מדחס", "quantity": "1", "unit_price": "800"}]


def sent(s4, **extra):
    t, token = s4.sent(**extra)
    client, _ = s4.public(Clock(time.time()))
    return t, token, client


def vendor_status(client, token, *states):
    for st in states:
        r = client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()})
        assert r.status_code == 200, r.text


def vendor_quote(client, token, lines=None, **body):
    return client.post("/t/api/quote", headers=hdr(token), json={"lines": lines or QUOTE, "client_request_id": crid(), **body})


def quotes_of(s4, tid, user="joni"):
    r = s4.c.get(f"{API}/tickets/{tid}/quotes", headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()


def decide_quote(s4, tid, action, user="joni", quote=None, **body):
    q = quote or quotes_of(s4, tid)["quotes"][-1]
    return s4.c.post(f"{API}/tickets/{tid}/quotes/{q['id']}/{action}", json={"revision": q["revision"], **body}, headers=s4.h(user))


def outbox_count(s4) -> int:
    with s4.db.connection(mode="read") as conn:
        return int(conn.execute("SELECT COUNT(*) FROM ticket_outbox").fetchone()[0])


def timeline(s4, tid, user="joni", **params):
    r = s4.c.get(f"{API}/tickets/{tid}/timeline", params=params, headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- the migration

def test_0087_creates_the_tables_and_drops_only_the_2_5_7_quote_table(s4):
    sql = (MIGRATIONS_DIR / "0087_ticket_detail.sql").read_text(encoding="utf-8")
    assert re.findall(r"^DROP TABLE\s+(\w+)", sql, re.I | re.M) == ["ticket_cost_quotes"] and "CR-038" in sql.splitlines()[0]
    with s4.db.connection(mode="read") as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        assert {"ticket_quotes", "ticket_quote_decisions", "ticket_owner_changes"} <= tables
        cols = {r[1] for r in conn.execute("PRAGMA table_info(tickets)")}
        assert {"internal_owner_user_id", "allowed_line_kinds"} <= cols
        assert "quote_mode" in {r[1] for r in conn.execute("PRAGMA table_info(ticket_assignments)")}
        assert "quote_id" in {r[1] for r in conn.execute("PRAGMA table_info(ticket_cost_claims)")}
        assert "exceptional_json" in {r[1] for r in conn.execute("PRAGMA table_info(ticket_cost_revisions)")}
        assert "ticket_cost_quotes" not in tables, "one quote implementation: the 2.5.7 table is gone"


def test_0087_moves_the_2_5_7_quotes_and_line_kinds_into_this_design(settings, tmp_path, monkeypatch):
    from smplwise import db as dbmod

    real = dbmod.MIGRATIONS_DIR
    older = tmp_path / "older"
    older.mkdir()
    for f in real.glob("*.sql"):
        if int(f.name.split("_", 1)[0]) < 87:
            shutil.copy(f, older / f.name)
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", older)
    database = dbmod.Database(settings.db_path)
    database.migrate()
    now = "2026-10-16T08:00:00Z"
    lines = ('[{"kind":"labor","description":"","total_minor":30000,"hours":"2","rate_minor":15000},'
             '{"kind":"parts","description":"x","total_minor":80000,"quantity":"1","unit_minor":80000}]')
    with database.connection() as conn:
        prio = conn.execute("SELECT id FROM ticket_priorities WHERE department_id = 'dept-maintenance' LIMIT 1").fetchone()[0]
        conn.execute("UPDATE ticket_departments SET cost_line_kinds = 'travel' WHERE id = 'dept-maintenance'")
        for n, tid in enumerate(("t1", "t2"), start=1):
            conn.execute("INSERT INTO tickets(id, number, department_id, priority_id, title, status, origin, created_by, last_activity_at, "
                         "created_at, updated_at) VALUES (?, ?, 'dept-maintenance', ?, 'x', 'assigned', 'manual', 'u', ?, ?, ?)",
                         (tid, 900 + n, prio, now, now, now))
            conn.execute("INSERT INTO ticket_assignments(id, ticket_id, assignee_kind, contact_id, assignee_name, channel, assigned_by, "
                         "assigned_at, cost_line_kinds) VALUES (?, ?, 'contact', 'c1', 'v', 'manual', 'u', ?, ?)",
                         (f"a{n}", tid, now, "other, travel" if n == 1 else None))
        rows = (("q1", "t1", "a1", 1, "superseded", None, None, None), ("q2", "t1", "a1", 2, "approved", None, "u1", now),
                ("q3", "t2", "a2", 1, "rejected", "missing parts price", "u1", now))
        for qid, tid, aid, seq, state, reason, by, at in rows:
            conn.execute("INSERT INTO ticket_cost_quotes(id, ticket_id, assignment_id, contact_id, seq, state, lines_json, labor_minor, "
                         "parts_minor, travel_minor, other_minor, subtotal_minor, vat_mode, vat_rate_bp, vat_minor, total_minor, currency, notes, "
                         "reason, decided_by, decided_at, created_at) VALUES (?, ?, ?, 'c1', ?, ?, ?, 30000, 80000, 0, 0, 110000, 'excluded', "
                         "1800, 19800, 129800, 'ILS', 'n', ?, ?, ?, ?)", (qid, tid, aid, seq, state, lines, reason, by, at, now))
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real)
    assert dbmod.Database(settings.db_path).migrate()[0] == 87  # (0089 TKRFQ1 follows it in the real set)
    with database.connection(mode="read") as conn:
        q = {r["id"]: dict(r) for r in conn.execute("SELECT * FROM ticket_quotes")}
        assert {k: (v["version"], v["state"]) for k, v in q.items()} == {"q1": (1, "superseded"), "q2": (2, "approved"), "q3": (1, "fix_requested")}
        assert q["q2"]["approved_lines_json"] == "[0,1]" and q["q2"]["approved_total_minor"] == 129800 and q["q2"]["supersedes_id"] == "q1"
        assert q["q3"]["decision_reason"] == "missing parts price" and q["q2"]["note"] == "n" and q["q2"]["department_id"] == "dept-maintenance"
        d = [(r["quote_id"], r["action"]) for r in conn.execute("SELECT * FROM ticket_quote_decisions ORDER BY quote_id")]
        assert d == [("q2", "approve"), ("q3", "request_fix")]
        kinds = {r[0]: r[1] for r in conn.execute("SELECT id, allowed_line_kinds FROM tickets")}
        assert kinds == {"t1": '["labor","parts","travel","other"]', "t2": None}
        dept = conn.execute("SELECT allowed_line_kinds FROM ticket_departments WHERE id = 'dept-maintenance'").fetchone()[0]
        assert dept == '["labor","parts","travel"]'
        assert not conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'ticket_cost_quotes'").fetchone()


# ---------------------------------------------------------------- the internal owner

def test_the_owner_defaults_to_the_internal_handler_at_the_handoff(s4):
    t = s4.ticket()
    assert s4.w.assign("joni", t["id"], "tom").status_code == 200
    assert s4.assign_contact(t["id"], user="mona").status_code == 200
    d = s4.w.detail(t["id"])
    assert d["internal_owner"]["id"] == "dev-tom" and d["internal_owner"]["source"] == "handoff"
    ev = [e for e in d["events"] if e["kind"] == "owner_changed"]
    assert len(ev) == 1 and ev[0]["external"] is False and ev[0]["data"]["source"] == "handoff"
    # a hand-off to another vendor keeps the owner
    other = s4.add_contact(display_name="יוסי לוי", phone="050-000-0039").json()
    assert s4.assign_contact(t["id"], other["id"], user="mona").status_code == 200
    assert s4.w.detail(t["id"])["internal_owner"]["id"] == "dev-tom"
    assert len(s4.c.get(f"{API}/tickets/{t['id']}/owner").json()["history"]) == 1


def test_without_an_internal_handler_the_manager_who_hands_over_is_the_owner(s4):
    t = s4.ticket()
    assert s4.assign_contact(t["id"], user="mona").status_code == 200
    assert s4.w.detail(t["id"])["internal_owner"]["id"] == "dev-mona"


def test_a_manager_changes_the_owner_with_history_and_others_cannot(s4):
    t, _token, _client = sent(s4)
    tid = t["id"]
    o = s4.c.get(f"{API}/tickets/{tid}/owner", headers=s4.h("mona")).json()
    assert o["owner"]["id"] == "dev-joni" and {"dev-tom", "dev-mona"} <= {c["id"] for c in o["candidates"]}
    assert "dev-dina" not in {c["id"] for c in o["candidates"]}, "a member denied tickets.view is never a candidate"
    rev = s4.w.detail(tid)["revision"]
    r = s4.c.put(f"{API}/tickets/{tid}/owner", json={"user_id": "dev-tom", "revision": rev}, headers=s4.h("tom"))
    assert r.status_code == 403
    r = s4.c.put(f"{API}/tickets/{tid}/owner", json={"user_id": "dev-nora", "revision": rev}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "owner_not_allowed"
    r = s4.c.put(f"{API}/tickets/{tid}/owner", json={"user_id": "dev-tom", "revision": rev + 5}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "ticket_stale"
    r = s4.c.put(f"{API}/tickets/{tid}/owner", json={"user_id": "dev-tom", "reason": "חזר מחופשה", "revision": rev}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["owner"]["id"] == "dev-tom" and body["owner"]["source"] == "manual"
    assert [h["source"] for h in body["history"]] == ["handoff", "manual"] and body["history"][1]["reason"] == "חזר מחופשה"
    assert body["history"][1]["by"] and body["history"][1]["from"]["id"] == "dev-joni"
    r = s4.c.put(f"{API}/tickets/{tid}/owner", json={"user_id": "dev-tom", "revision": body["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "owner_unchanged"
    with s4.db.connection(mode="read") as conn:
        audits = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.owner.change'").fetchall()
    assert audits and "חזר מחופשה" not in str([a[0] for a in audits]), "the audit row carries ids only"


def test_a_limited_viewer_sees_the_owner_but_not_its_history(s4):
    t = s4.ticket(user="nora")
    assert s4.assign_contact(t["id"], user="mona").status_code == 200
    o = s4.c.get(f"{API}/tickets/{t['id']}/owner", headers=s4.h("nora")).json()
    assert o["owner"]["id"] == "dev-mona" and o["history"] == [] and o["candidates"] == [] and o["can"]["change"] is False


def test_waiting_for_a_part_is_a_sub_state_of_in_progress(s4):
    t, token, client = sent(s4)
    vendor_status(client, token, "acknowledged", "in_progress", "waiting_part")
    d = s4.w.detail(t["id"])
    assert d["status"] == "waiting_part" and d["status_view"] == {"stage": "in_progress", "sub_state": "waiting_part"}
    st = [i for i in timeline(s4, t["id"], filter="status")["items"] if i["kind"] == "status"]
    assert st[-1]["status"]["to"] == "in_progress" and st[-1]["status"]["sub_state"] == "waiting_part" and st[-1]["status"]["stored_to"] == "waiting_part"
    q = quotes_of(s4, t["id"])
    assert q["flow"]["sub_state"] == "waiting_part"


# ---------------------------------------------------------------- allowed line kinds

def test_allowed_kinds_default_to_labor_and_parts_and_follow_request_department_installation(s4):
    t, token, client = sent(s4)
    vendor_status(client, token, "acknowledged")
    q = quotes_of(s4, t["id"])
    assert q["allowed_line_kinds"] == {"kinds": ["labor", "parts"], "level": "installation"}
    r = vendor_quote(client, token, lines=QUOTE + [{"kind": "travel", "amount": "50"}])
    assert r.status_code == 422 and r.json()["fields"][0] == {"field": "lines.2.kind", "code": "kind_not_allowed"}
    r = s4.c.put(f"{API}/tickets/costs/departments/dept-maintenance", json={"allowed_line_kinds": ["labor", "parts", "travel"]})
    assert r.status_code == 200, r.text
    dept = next(d for d in r.json()["departments"] if d["id"] == "dept-maintenance")
    assert dept["allowed_line_kinds"] == ["labor", "parts", "travel"]
    assert quotes_of(s4, t["id"])["allowed_line_kinds"]["level"] == "department"
    # a department PUT without the field keeps it
    assert s4.c.put(f"{API}/tickets/costs/departments/dept-maintenance", json={"cost_claim": "optional"}).status_code == 200
    assert quotes_of(s4, t["id"])["allowed_line_kinds"]["kinds"] == ["labor", "parts", "travel"]
    r = s4.c.put(f"{API}/tickets/{t['id']}/allowed-line-kinds", json={"kinds": ["parts"]})
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["code"] == "labor_required"
    r = s4.c.put(f"{API}/tickets/{t['id']}/allowed-line-kinds", json={"kinds": ["other", "labor"]})
    assert r.status_code == 200 and r.json()["allowed_line_kinds"] == {"kinds": ["labor", "other"], "level": "request"}
    r = vendor_quote(client, token, lines=[{"kind": "other", "amount": "10"}])
    assert r.status_code == 422 and r.json()["fields"][0]["code"] == "required", "'other' always needs a description"
    assert s4.c.put(f"{API}/tickets/{t['id']}/allowed-line-kinds", headers=s4.h("mona"), json={"kinds": None}).status_code == 403
    assert s4.c.put(f"{API}/tickets/{t['id']}/allowed-line-kinds", json={"kinds": None}).json()["allowed_line_kinds"]["level"] == "department"


def test_the_installation_default_is_a_setting(s4):
    r = s4.c.get(f"{API}/tickets/settings")
    assert r.json()["costs"]["allowed_line_kinds"] == ["labor", "parts"] and r.json()["costs"]["notify_vendor_approved"] is False
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "costs": {"allowed_line_kinds": ["travel", "labor"]}})
    assert r.status_code == 200, r.text
    assert r.json()["costs"]["allowed_line_kinds"] == ["labor", "travel"]


# ---------------------------------------------------------------- quotes

def test_the_vendor_quotes_through_the_link_and_versions_supersede(s4):
    t, token, client = sent(s4)
    r = client.get("/t/api/quote", headers=hdr(token))
    assert r.status_code == 200, r.text
    f = r.json()
    assert f["writable"] is True and f["mode"] == "optional" and f["form"]["allowed_kinds"] == ["labor", "parts"] and f["quotes"] == []
    page = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert page["quote"] == {"mode": "optional", "enabled": True, "state": "none", "state_detail": None, "version": None, "writable": True}
    r = vendor_quote(client, token, amounts_include_vat=False, work_from=SOON, work_to=SOON_END, note="כולל פירוק")
    assert r.status_code == 201, r.text
    q1 = r.json()["quote"]
    assert (q1["subtotal_minor"], q1["vat_minor"], q1["total_minor"], q1["state"], q1["version"]) == (110000, 19800, 129800, "submitted", 1)
    r = vendor_quote(client, token, lines=[{"kind": "labor", "hours": "1", "rate": "150"}])
    assert r.status_code == 201 and r.json()["quote"]["version"] == 2
    full = quotes_of(s4, t["id"])
    assert [(q["version"], q["state"]) for q in full["quotes"]] == [(1, "superseded"), (2, "submitted")]
    assert full["quotes"][1]["vendor"] and full["quotes"][1]["can"]["decide"] is True and full["flow"]["stage"] == "quote_submitted"
    ev = [i for i in timeline(s4, t["id"], filter="costs")["items"]]
    assert [i["cost"]["version"] for i in ev] == [1, 2] and "129800" not in str(ev), "cost rows never carry an amount"


def test_amounts_need_costs_view_and_decisions_need_costs(s4):
    t, token, client = sent(s4)
    assert vendor_quote(client, token).status_code == 201
    q = quotes_of(s4, t["id"], user="mona")
    assert set(q["quotes"][0]) == {"id", "version", "state", "source", "created_at", "assignment_id"} and "baseline" not in q
    assert decide_quote(s4, t["id"], "approve", user="mona", quote={"id": q["quotes"][0]["id"], "revision": 1}).status_code == 403
    bind(s4.c, s4.w.settings, "mona", "tickets_costs_view", "installation", "*")
    q = quotes_of(s4, t["id"], user="mona")
    assert q["quotes"][0]["total_minor"] == 129800 and q["quotes"][0]["can"]["decide"] is False
    bind(s4.c, s4.w.settings, "mona", "tickets_costs", "installation", "*")
    assert decide_quote(s4, t["id"], "approve", user="mona").status_code == 200


def test_partial_approval_is_the_baseline_and_returns_a_draft_but_sends_nothing(s4):
    t, token, client = sent(s4)
    vendor_status(client, token, "acknowledged")
    assert vendor_quote(client, token, work_from=SOON).status_code == 201
    before = outbox_count(s4)
    r = decide_quote(s4, t["id"], "approve", line_indexes=[0])
    assert r.status_code == 200, r.text
    body = r.json()
    q = body["quotes"][-1]
    assert q["state"] == "partially_approved" and q["approved"] == {"line_indexes": [0], "subtotal_minor": 30000, "vat_minor": 5400, "total_minor": 35400}
    assert [ln["approved"] for ln in q["lines"]] == [True, False]
    assert body["baseline"]["quote_id"] == q["id"] and body["baseline"]["line_kinds"] == ["labor"] and body["baseline"]["total_minor"] == 35400
    d = body["message_draft"]
    assert d["lang"] == "he" and "מזגן לא מקרר" in d["text"] and "עבודה" in d["text"] and SOON_DAY in d["text"]
    assert "354" not in d["text"] and "300" not in d["text"], "a draft never carries an amount"
    assert d["send"]["source"] == {"kind": "quote", "id": q["id"]} and d["notify_default"] is True
    assert outbox_count(s4) == before, "an approval never sends a message"
    assert body["flow"]["stage"] == "quote_approved"
    vendor_status(client, token, "in_progress")
    assert quotes_of(s4, t["id"])["flow"]["stage"] == "work"
    r = vendor_quote(client, token)
    assert r.status_code == 409 and r.json()["code"] == "quote_closed" and r.json()["reason"] == "quote_already_approved"
    v = client.get("/t/api/quote", headers=hdr(token)).json()
    assert v["writable"] is False and v["quotes"][0]["approved"]["total_minor"] == 35400 and "decision" not in v["quotes"][0]


def test_request_fix_and_reject_need_a_reason_and_the_vendor_sees_it(s4):
    t, token, client = sent(s4)
    assert vendor_quote(client, token).status_code == 201
    assert decide_quote(s4, t["id"], "request-fix").status_code == 422
    r = decide_quote(s4, t["id"], "request-fix", reason="חסר פירוט חלקים")
    assert r.status_code == 200 and r.json()["quotes"][-1]["state"] == "fix_requested" and "חסר פירוט חלקים" in r.json()["message_draft"]["text"]
    assert quotes_of(s4, t["id"])["flow"]["stage"] == "quote_fix_requested"
    v = client.get("/t/api/quote", headers=hdr(token)).json()
    assert (v["quotes"][0]["state"], v["quotes"][0]["state_detail"]) == ("rejected", "fix_requested") and v["quotes"][0]["reason"] == "חסר פירוט חלקים" and v["writable"] is True
    assert vendor_quote(client, token).status_code == 201
    r = decide_quote(s4, t["id"], "reject", reason="יקר מדי")
    assert r.status_code == 200 and r.json()["quotes"][-1]["state"] == "rejected"
    stale = quotes_of(s4, t["id"])["quotes"][-1]
    r = s4.c.post(f"{API}/tickets/{t['id']}/quotes/{stale['id']}/approve", json={"revision": stale["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "quote_not_submitted"
    r = s4.c.post(f"{API}/tickets/{t['id']}/quotes/{stale['id']}/approve", json={"revision": 1})
    assert r.status_code == 409 and r.json()["code"] == "quote_stale"


def test_a_quote_entered_on_behalf_needs_a_second_person(s4):
    t, token, client = sent(s4)
    r = s4.c.post(f"{API}/tickets/{t['id']}/quotes", json={"lines": QUOTE, "amounts_include_vat": True})
    assert r.status_code == 201, r.text
    q = r.json()["quotes"][-1]
    assert q["source"] == "manager" and q["total_minor"] == 110000 and q["vat_mode"] == "included"
    r = decide_quote(s4, t["id"], "approve")
    assert r.status_code == 409 and r.json()["code"] == "self_approval"
    bind(s4.c, s4.w.settings, "mona", "tickets_costs_view", "installation", "*")
    bind(s4.c, s4.w.settings, "mona", "tickets_costs", "installation", "*")
    assert decide_quote(s4, t["id"], "approve", user="mona").json()["quotes"][-1]["state"] == "approved"


def test_a_quote_needs_an_active_external_assignment_and_the_mode(s4):
    t = s4.ticket()
    r = s4.c.post(f"{API}/tickets/{t['id']}/quotes", json={"lines": QUOTE})
    assert r.status_code == 409 and r.json()["code"] == "quote_not_open"
    t, token, client = sent(s4)
    asg = s4.w.detail(t["id"])["assignments"][-1]["id"]
    assert s4.c.post(f"{API}/tickets/{t['id']}/quotes/requirement", json={"assignment_id": asg, "mode": "required"}, headers=s4.h("tom")).status_code == 403
    r = s4.c.post(f"{API}/tickets/{t['id']}/quotes/requirement", json={"assignment_id": asg, "mode": "required"}, headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["flow"]["stage"] == "quote_requested" and r.json()["quote_mode"] == "required"
    assert s4.c.post(f"{API}/tickets/{t['id']}/quotes/requirement", json={"assignment_id": asg, "mode": "off"}, headers=s4.h("mona")).status_code == 200
    r = vendor_quote(client, token)
    assert r.status_code == 409 and r.json()["code"] == "quote_closed" and r.json()["reason"] == "quote_off"
    assert client.get("/t/api/ticket", headers=hdr(token)).json()["quote"] is None


# ---------------------------------------------------------------- the payment demand against the baseline

def _approved_labor_only(s4):
    t, token, client = sent(s4, cost_claim="required")
    vendor_status(client, token, "acknowledged")
    assert vendor_quote(client, token).status_code == 201
    assert decide_quote(s4, t["id"], "approve", line_indexes=[0]).status_code == 200
    vendor_status(client, token, "in_progress", "done")
    return t, token, client


def test_a_demand_line_outside_the_approved_quote_is_exceptional_and_approve_can_exclude_it(s4):
    t, token, client = _approved_labor_only(s4)
    assert quotes_of(s4, t["id"])["flow"]["stage"] == "demand_awaiting"
    r = client.post("/t/api/claim", headers=hdr(token), json={"lines": [{"kind": "labor", "hours": "2", "rate": "150"},
                                                                         {"kind": "travel", "amount": "50"}], "client_request_id": crid()})
    assert r.status_code == 422 and r.json()["fields"][0] == {"field": "lines.1.description", "code": "exceptional_description_required"}
    lines = [{"kind": "labor", "hours": "2", "rate": "150"}, {"kind": "parts", "description": "מסנן", "quantity": "1", "unit_price": "100"}]
    r = client.post("/t/api/claim", headers=hdr(token), json={"lines": lines, "amounts_include_vat": False, "client_request_id": crid()})
    assert r.status_code == 201, r.text
    assert r.json()["revision"]["exceptional"][0]["kind"] == "parts" and r.json()["revision"]["exceptional"][0]["review"] == "pending"
    c = s4.c.get(f"{API}/tickets/{t['id']}/costs").json()
    claim = c["claims"][0]
    assert claim["needs_review"] is True and claim["baseline"]["total_minor"] == 35400
    assert claim["delta_minor"] == 47200 - 35400 and claim["kind_deltas"] == {"labor": 0, "parts": 10000, "travel": 0, "other": 0}
    assert c["flow"]["stage"] == "demand_submitted"
    before = outbox_count(s4)
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/{claim['id']}/approve",
                  json={"revision": claim["revision"], "revision_id": claim["current_revision_id"], "exceptional": "exclude"})
    assert r.status_code == 200, r.text
    after = r.json()
    approved = after["claims"][0]
    assert approved["status"] == "approved" and approved["approved_total_minor"] == 35400 and approved["needs_review"] is False
    assert approved["revisions"][0]["exceptional"][0]["review"] == "excluded" and approved["revisions"][1]["kind"] == "adjustment"
    assert after["message_draft"]["send"]["source"]["kind"] == "claim" and "חלקים" in after["message_draft"]["text"]
    assert outbox_count(s4) == before
    assert not [e for e in s4.w.detail(t["id"])["events"] if e["kind"] == "cost_message"], "nothing is sent on approval"
    page = client.get("/t/api/claim", headers=hdr(token)).json()
    assert page["approved"]["total_minor"] == 35400 and page["approved"]["adjusted"] is True


def test_exceptional_is_only_for_approve(s4):
    t, token, client = _approved_labor_only(s4)
    lines = [{"kind": "labor", "hours": "2", "rate": "150"}]
    assert client.post("/t/api/claim", headers=hdr(token), json={"lines": lines, "client_request_id": crid()}).status_code == 201
    claim = s4.c.get(f"{API}/tickets/{t['id']}/costs").json()["claims"][0]
    assert claim["needs_review"] is False and claim["delta_minor"] == 0
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/{claim['id']}/reject",
                  json={"revision": claim["revision"], "revision_id": claim["current_revision_id"], "reason": "x", "exceptional": "exclude"})
    assert r.status_code == 422
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/{claim['id']}/approve",
                  json={"revision": claim["revision"], "revision_id": claim["current_revision_id"], "exceptional": "exclude"})
    assert r.status_code == 200 and r.json()["claims"][0]["approved_total_minor"] == 35400 and r.json()["message_draft"]
    assert r.json()["flow"]["stage"] == "demand_approved"


def test_without_a_quote_a_travel_line_is_flagged_but_accepted(s4):
    t, token, client = sent(s4, cost_claim="required")
    vendor_status(client, token, "acknowledged", "done")
    r = client.post("/t/api/claim", headers=hdr(token), json={"lines": [{"kind": "travel", "amount": "50"}], "client_request_id": crid()})
    assert r.status_code == 201, r.text
    ex = r.json()["revision"]["exceptional"]
    assert ex == [{"index": 0, "kind": "travel", "description": "", "total_minor": 5000, "reason": "kind_not_allowed", "review": "pending"}]
    claim = s4.c.get(f"{API}/tickets/{t['id']}/costs").json()["claims"][0]
    assert claim["baseline"] is None and claim["delta_minor"] is None and claim["needs_review"] is True


# ---------------------------------------------------------------- the timeline

def test_the_timeline_merges_messages_notes_status_and_costs(s4):
    t, token, client = sent(s4)
    tid = t["id"]
    assert s4.c.post(f"{API}/tickets/{tid}/notes", json={"text": "לבדוק אחריות", "external": False}).status_code in (200, 201)
    assert s4.c.post(f"{API}/tickets/{tid}/notes", json={"text": "נא להגיע עד 10", "external": True}).status_code in (200, 201)
    assert client.post("/t/api/note", headers=hdr(token), json={"text": "אגיע ב-9", "client_request_id": crid()}).status_code == 200
    vendor_status(client, token, "acknowledged")
    assert vendor_quote(client, token).status_code == 201
    tl = timeline(s4, tid)
    types = {(i["type"], i["kind"]) for i in tl["items"]}
    assert ("internal_note", "note") in types and ("message", "note") in types and ("status_event", "status") in types
    assert ("quote", "quote_submitted") in types and ("owner_change", "owner_changed") in types and ("status_event", "created") in types
    msgs = [i for i in tl["items"] if i["type"] == "message" and i["kind"] == "note"]
    # (the public app's test clock is fixed at the hand-off, so the vendor's row sorts first by time)
    assert sorted((m["message"]["direction"], m["message"]["channel"], m["body"]) for m in msgs) == [("in", "page", "אגיע ב-9"),
                                                                                                    ("out", "page", "נא להגיע עד 10")]
    internal = next(i for i in tl["items"] if i["type"] == "internal_note")
    assert internal["can"]["forward"] is True and internal["body"] == "לבדוק אחריות"
    assert tl["counts"]["notes"] == 1 and tl["counts"]["messages"] == 2 and tl["counts"]["costs"] == 1
    only = timeline(s4, tid, filter="messages")["items"]
    assert {i["type"] for i in only} == {"message"}
    page = timeline(s4, tid, limit=2)
    assert len(page["items"]) == 2 and page["next_before"]
    older = timeline(s4, tid, limit=2, before=page["next_before"])
    assert older["items"] and older["items"][-1]["at"] <= page["items"][0]["at"]
    assert not ({i["id"] for i in older["items"]} & {i["id"] for i in page["items"]})


def test_a_limited_viewer_gets_only_external_rows_and_the_timeline_is_404_for_strangers(s4):
    t = s4.ticket(user="nora")
    assert s4.assign_contact(t["id"], user="mona").status_code == 200
    assert s4.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "פנימי", "external": False}, headers=s4.h("mona")).status_code in (200, 201)
    tl = timeline(s4, t["id"], user="nora")
    assert all(i["type"] != "internal_note" for i in tl["items"]) and all(not i["can"]["forward"] for i in tl["items"])
    for user in ("vic", "dina", "cleo"):
        for path in ("timeline", "owner", "quotes"):
            r = s4.c.get(f"{API}/tickets/{t['id']}/{path}", headers=s4.h(user))
            assert r.status_code == 404 and r.json()["code"] == "ticket_not_found", (user, path)


# ---------------------------------------------------------------- writing to the vendor

def test_forwarding_an_internal_note_sends_a_copy_and_keeps_the_note_internal(s4):
    t, token, client = sent(s4)
    tid = t["id"]
    assert s4.c.post(f"{API}/tickets/{tid}/notes", json={"text": "הלקוח מבקש להגיע אחרי 16:00", "external": False}).status_code in (200, 201)
    note = next(i for i in timeline(s4, tid)["items"] if i["type"] == "internal_note")
    nid = int(note["id"][3:])
    assert s4.c.post(f"{API}/tickets/{tid}/notes/{nid}/forward", json={}, headers=s4.h("tom")).status_code == 403
    r = s4.c.post(f"{API}/tickets/{tid}/notes/{nid}/forward", json={"notify": False})
    assert r.status_code == 201, r.text
    item = r.json()["item"]
    assert item["type"] == "message" and item["message"]["direction"] == "out" and item["message"]["from_note_id"] == note["id"]
    assert item["body"] == "הלקוח מבקש להגיע אחרי 16:00" and r.json()["notified"] == {"queued": False, "channel": None}
    assert next(i for i in timeline(s4, tid)["items"] if i["id"] == note["id"])["type"] == "internal_note"
    vendor_page = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert "הלקוח מבקש להגיע אחרי 16:00" in [e.get("body") for e in vendor_page["timeline"]]
    r = s4.c.post(f"{API}/tickets/{tid}/notes/{int(item['id'][3:])}/forward", json={})
    assert r.status_code == 409 and r.json()["code"] == "note_already_external"
    assert s4.c.post(f"{API}/tickets/{tid}/notes/999999/forward", json={}).status_code == 404


def test_the_vendor_message_needs_an_active_external_assignment(s4):
    t = s4.ticket()
    r = s4.c.post(f"{API}/tickets/{t['id']}/vendor-message", json={"text": "שלום"})
    assert r.status_code == 409 and r.json()["code"] == "no_external_assignment"
    t, token, client = sent(s4)
    r = s4.c.post(f"{API}/tickets/{t['id']}/vendor-message", json={"text": "ההצעה אושרה", "source": {"kind": "quote", "id": "q1"}})
    assert r.status_code == 201, r.text
    assert r.json()["item"]["message"]["channel"] == "page" and r.json()["item"]["external"] is True
    assert s4.c.post(f"{API}/tickets/{t['id']}/vendor-message", json={"text": "  "}).status_code == 422
    assert s4.c.post(f"{API}/tickets/{t['id']}/vendor-message", json={"text": "x"}, headers=s4.h("tom")).status_code == 403
    assert s4.w.detail(t["id"])["can"]["vendor_message"] is True


def test_drafts_follow_the_vendor_language_and_never_send(s4):
    rc = s4.contact_rev(s4.contact["id"])
    assert s4.c.patch(f"{API}/tickets/contacts/{s4.contact['id']}", json={"lang": "en", "revision": rc}).status_code == 200
    t, token, client = sent(s4)
    assert vendor_quote(client, token).status_code == 201
    q = quotes_of(s4, t["id"])["quotes"][-1]
    before = outbox_count(s4)
    for decision, needle in (("approved", "was approved"), ("rejected", "was not approved")):
        r = s4.c.post(f"{API}/tickets/{t['id']}/message-drafts", json={"subject": "quote", "id": q["id"], "decision": decision})
        assert r.status_code == 200, r.text
        assert r.json()["lang"] == "en" and needle in r.json()["text"]
    r = s4.c.post(f"{API}/tickets/{t['id']}/message-drafts", json={"subject": "quote", "id": q["id"], "decision": "approved"}, headers=s4.h("mona"))
    assert r.status_code == 403
    r = s4.c.post(f"{API}/tickets/{t['id']}/message-drafts", json={"subject": "claim", "id": "nope", "decision": "approved"})
    assert r.status_code == 404
    assert outbox_count(s4) == before


def test_every_draft_language_renders(s4):
    from smplwise.services.tickets import quotes

    assert set(quotes.DRAFTS) == {"he", "en", "ar", "ru"}
    keys = set(quotes.DRAFTS["he"])
    for lang, texts in quotes.DRAFTS.items():
        assert set(texts) == keys, lang
        for key, value in texts.items():
            value.format(name="N", title="T", window="", kinds="K", reason="R")
    for word in ("קריאה", "קריאות", "קריאת"):
        assert all(word not in v for v in quotes.DRAFTS["he"].values())


def test_every_detail_route_answers_the_uniform_404_while_the_module_is_off(s4):
    from fastapi.routing import APIRoute

    from smplwise.routers import tickets_detail

    t = s4.ticket()
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    routes = [(m, r.path) for r in tickets_detail.router.routes if isinstance(r, APIRoute) for m in r.methods]
    assert len(routes) == 11
    for method, path in routes:
        url = API + path.replace("{ticket_id}", t["id"]).replace("{quote_id}", "q1").replace("{action}", "approve").replace("{event_id}", "1")
        r = s4.c.request(method, url, json={})
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", (method, path, r.text)


# ---------------------------------------------------------------- the purge

def test_the_purge_removes_quotes_decisions_and_owner_history(s4):
    t, token, client = sent(s4)
    assert vendor_quote(client, token).status_code == 201
    assert decide_quote(s4, t["id"], "reject", reason="לא").status_code == 200
    with s4.db.connection() as conn:
        removed = store.purge_ticket(conn, t["id"])
        assert removed.get("ticket_quotes") == 1 and removed.get("ticket_quote_decisions") == 1 and removed.get("ticket_owner_changes") == 1
        assert store.ticket_rows_left(conn, t["id"]) == {}
