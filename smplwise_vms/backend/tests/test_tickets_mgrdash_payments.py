"""MGRDASH phase 4 (docs/design/MANAGER_DASHBOARD_SPEC_HE.md cards 9-10, section 9 "payment due tomorrow", section 10 phase 4):
GET /tickets/dashboard/payments - the manager overview's payments board, and the `rfq.instalment_due_tomorrow` alert.

Negative first: the board's gate, the payment permissions (an audited 403, never an empty answer), a department the caller does not
manage, the schedule switch off; then the leak checks (another department's manager with the same permissions sees nothing; a request
manager without tickets.costs is refused); then the lists (overdue / upcoming instalments, the paid one leaves, approved claims not
paid); then the cost guards: the visibility is read in ONE batch (the per-row readers are never called) and the number of SQL statements
does not grow with the number of approved schedules; then the alert (off by default, once per award and day, only to the payers).
Every name and number here is invented."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import bind

from smplwise.db import Database, new_id
from smplwise.services.notify_visibility import principal_of
from smplwise.services.tickets import access, dashboard, dashboard_alerts, dashboard_pay, rfq
from smplwise.services.tickets.access import Viewer
from test_tickets_rfq_instalments import _awarded, demand
from test_tickets_rfq_terms import _day, s4 as _s4_terms  # noqa: F401 - the fixture of the RFQ terms tests
from tickets_s4_world import API


@pytest.fixture()
def s4(_s4_terms):
    dashboard_pay.CACHE.clear()
    yield _s4_terms
    dashboard_pay.CACHE.clear()


def pay(s4, user: str, **q):
    dashboard_pay.CACHE.clear()
    return s4.c.get(f"{API}/tickets/dashboard/payments", params=q, headers=s4.h(user))


def ok(s4, user: str, **q) -> dict:
    r = pay(s4, user, **q)
    assert r.status_code == 200, r.text
    return r.json()


def _set_dates(s4, rfq_id: str, dates: dict[int, str]) -> None:
    """Moves instalment days directly in the store (a past day cannot be set through the route)."""
    with Database(s4.w.settings.db_path).connection() as conn:
        for row in conn.execute("SELECT award_id, schedule_json FROM ticket_rfq_award_terms WHERE rfq_id = ?", (rfq_id,)).fetchall():
            sched = json.loads(row["schedule_json"])
            for it in sched["items"]:
                if int(it["index"]) in dates:
                    it["date"] = dates[int(it["index"])]
            conn.execute("UPDATE ticket_rfq_award_terms SET schedule_json = ? WHERE award_id = ?", (json.dumps(sched), row["award_id"]))


# ---------------------------------------------------------------- the gate, the permissions, the filter, the switch

@pytest.mark.parametrize("user", ["tom", "nora", "vic"])
def test_non_managers_are_refused(s4, user):
    r = pay(s4, user)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"


def test_a_manager_without_the_payment_permissions_is_refused_and_audited(s4):
    r = pay(s4, "mona")
    assert r.status_code == 403 and r.json()["code"] == "forbidden", "never an empty answer"
    with s4.db.connection(mode="read") as conn:
        row = conn.execute("SELECT reason FROM audit_log WHERE action = 'ticket.dashboard.payments' AND decision = 'denied' "
                           "ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row is not None and row["reason"] == "costs_permission_missing"
    bind(s4.c, s4.w.settings, "mona", "tickets_costs_view", "installation", "*")
    assert pay(s4, "mona").status_code == 403, "viewing costs is not paying: tickets.costs is needed too"
    bind(s4.c, s4.w.settings, "mona", "tickets_costs", "installation", "*")
    assert pay(s4, "mona").status_code == 200


def test_a_department_the_caller_does_not_manage_is_refused(s4):
    for role in ("tickets_costs_view", "tickets_costs"):
        bind(s4.c, s4.w.settings, "mona", role, "installation", "*")
    r = pay(s4, "mona", department_id=s4.w.cleaning)
    assert r.status_code == 403 and r.json()["code"] == "forbidden"
    assert pay(s4, "mona", department_id="dept-maintenance").status_code == 200


def test_with_the_switch_off_there_are_no_instalments(s4):
    d = ok(s4, "kim")
    assert d["schedule_on"] is False and d["overdue"]["count"] == 0 and d["upcoming"]["count"] == 0


# ---------------------------------------------------------------- the lists and the leaks

def test_upcoming_and_overdue_instalments_only_where_the_caller_may_pay(s4):
    d, _v1, _tok, _c, a = _awarded(s4)  # advance day 6, progress day 8, final 30 days after completion (no day yet)
    out = ok(s4, "kim")
    assert out["schedule_on"] is True and out["overdue"]["count"] == 0
    up = out["upcoming"]
    assert up["count"] == 2 and [x["due_date"] for x in up["items"]] == [_day(6), _day(8)]
    first = up["items"][0]
    assert first["rfq"]["id"] == d["id"] and first["kind"] == "instalment" and first["instalment_kind"] == "advance"
    assert first["amount_minor"] > 0 and first["currency"] and first["demand"] == "none" and first["days"] == 6
    assert "vendor" in first and "rfq_vendor_id" not in first
    # a request manager of the same department without tickets.costs: refused; with both permissions: the same rows
    assert pay(s4, "mona").status_code == 403
    for role in ("tickets_costs_view", "tickets_costs"):
        bind(s4.c, s4.w.settings, "mona", role, "installation", "*")
        bind(s4.c, s4.w.settings, "cleo", role, "installation", "*")
    assert ok(s4, "mona")["upcoming"]["count"] == 2
    other = ok(s4, "cleo")
    assert other["upcoming"]["count"] == 0 and other["overdue"]["count"] == 0, "another department's manager sees nothing of it"
    # the advance day passed: overdue; marked paid: gone
    _set_dates(s4, d["id"], {0: _day(-2)})
    out = ok(s4, "kim")
    assert out["overdue"]["count"] == 1 and out["overdue"]["items"][0]["days"] == -2 and out["upcoming"]["count"] == 1
    assert demand(s4, d["id"], a["id"], 0, "create").status_code == 200
    assert ok(s4, "kim")["overdue"]["items"][0]["demand"] == "open"
    assert demand(s4, d["id"], a["id"], 0, "paid").status_code == 200
    out = ok(s4, "kim")
    assert out["overdue"]["count"] == 0 and out["upcoming"]["count"] == 1
    assert ok(s4, "kim", department_id=s4.w.cleaning)["upcoming"]["count"] == 0


def test_approved_claims_not_paid_wait_for_a_manager_who_may_pay(s4):
    t, _token = s4.sent("מזגן דולף")
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    with Database(s4.w.settings.db_path).connection() as conn:
        asg = conn.execute("SELECT id FROM ticket_assignments WHERE ticket_id = ? AND ended_at IS NULL", (t["id"],)).fetchone()["id"]
        conn.execute(
            "INSERT INTO ticket_cost_claims (id, ticket_id, department_id, assignment_id, contact_id, required, status, currency, "
            "approved_total_minor, approved_by, approved_at, snapshot_json, created_at, updated_at) "
            "VALUES (?, ?, 'dept-maintenance', ?, ?, 1, 'approved', 'ILS', 45000, 'dev-kim', ?, '{}', ?, ?)",
            (new_id(), t["id"], asg, s4.contact["id"], now, now, now))
    claims = ok(s4, "kim")["claims"]
    assert claims["count"] == 1 and claims["items"][0]["ticket"]["id"] == t["id"] and claims["items"][0]["amount_minor"] == 45000
    for role in ("tickets_costs_view", "tickets_costs"):
        bind(s4.c, s4.w.settings, "cleo", role, "installation", "*")
    assert ok(s4, "cleo")["claims"]["count"] == 0, "another department's manager does not see the claim"
    with Database(s4.w.settings.db_path).connection() as conn:
        conn.execute("UPDATE ticket_cost_claims SET status = 'paid' WHERE ticket_id = ?", (t["id"],))
    assert ok(s4, "kim")["claims"]["count"] == 0


def test_the_answer_is_kept_thirty_seconds_and_an_open_is_audited_once(s4):
    first = ok(s4, "kim")
    again = s4.c.get(f"{API}/tickets/dashboard/payments", headers=s4.h("kim")).json()
    assert again["generated_at"] == first["generated_at"]
    dashboard_pay.CACHE.clear()
    with s4.db.connection() as conn:
        conn.execute("DELETE FROM audit_log WHERE action = 'ticket.dashboard.payments'")
    for _ in range(3):
        assert s4.c.get(f"{API}/tickets/dashboard/payments", headers=s4.h("kim")).status_code == 200
    with s4.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.dashboard.payments' AND decision = 'allowed'").fetchone()[0]
    assert n == 1


# ---------------------------------------------------------------- the cost guards (batched visibility, statements independent of size)

def _clone_awards(s4, rfq_id: str, n: int) -> None:
    """n more approved schedules: clones of the real request, its award and its terms (new ids and numbers)."""
    with Database(s4.w.settings.db_path).connection() as conn:
        r0 = dict(conn.execute("SELECT * FROM ticket_rfqs WHERE id = ?", (rfq_id,)).fetchone())
        a0 = dict(conn.execute("SELECT * FROM ticket_rfq_awards WHERE rfq_id = ? AND state = 'approved'", (rfq_id,)).fetchone())
        t0 = dict(conn.execute("SELECT * FROM ticket_rfq_award_terms WHERE award_id = ?", (a0["id"],)).fetchone())
        q0 = dict(conn.execute("SELECT * FROM ticket_quotes WHERE id = ?", (a0["quote_id"],)).fetchone())
        number = int(conn.execute("SELECT COALESCE(MAX(number), 0) FROM ticket_rfqs").fetchone()[0])
        for _ in range(n):
            number += 1
            rid, aid, qid = new_id(), new_id(), new_id()
            for table, row in (("ticket_rfqs", {**r0, "id": rid, "number": number}),
                               ("ticket_quotes", {**q0, "id": qid, "ticket_id": None}),
                               ("ticket_rfq_awards", {**a0, "id": aid, "rfq_id": rid, "quote_id": qid}),
                               ("ticket_rfq_award_terms", {**t0, "award_id": aid, "rfq_id": rid})):
                cols = list(row)
                conn.execute(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", tuple(row[c] for c in cols))


def _statements(s4, user: str) -> tuple[int, dict]:
    db = Database(s4.w.settings.db_path)
    with db.connection(mode="read") as conn:
        seen: list[str] = []
        conn.set_trace_callback(seen.append)
        out = dashboard_pay.payments(conn, Viewer(conn, principal_of(conn, f"dev-{user}")), department_id=None,
                                     now=dt.datetime.now(dt.timezone.utc), tz=dt.timezone.utc)
        conn.set_trace_callback(None)
    return len(seen), out


def test_visibility_is_read_in_one_batch_never_per_row(s4, monkeypatch):
    d, *_ = _awarded(s4)
    _clone_awards(s4, d["id"], 5)

    def per_row(*_a, **_k):
        raise AssertionError("a per-row visibility read")

    monkeypatch.setattr(access, "visible_by_id", per_row)
    monkeypatch.setattr(rfq, "visible_by_id", per_row)
    out = ok(s4, "kim")
    assert out["upcoming"]["count"] == 12


def test_the_statement_count_does_not_grow_with_the_schedules(s4):
    d, *_ = _awarded(s4)
    small, out = _statements(s4, "kim")
    assert out["upcoming"]["count"] == 2
    _clone_awards(s4, d["id"], 120)
    big, out = _statements(s4, "kim")
    assert out["upcoming"]["count"] == 2 * 121
    # every clone shares the vendor: its label is read once; the rows of the answer are capped at 50 per list
    assert big <= small + 12, f"{small} statements for 1 schedule, {big} for 121 - a per-row read crept in"


# ---------------------------------------------------------------- the alert: payment due tomorrow

def _enable(s4, source: str) -> None:
    with Database(s4.w.settings.db_path).connection() as conn:
        from smplwise.services import notify_policy

        notify_policy.ensure_defaults(conn)
        conn.execute("UPDATE notify_policies SET enabled = 1 WHERE source = ?", (source,))


def _rows(s4, source: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at", (source,)).fetchall()]


def _tick(s4) -> dict:
    with Database(s4.w.settings.db_path).connection() as conn:
        return dashboard_alerts.payments_tick(conn, dt.datetime.now(dt.timezone.utc))


def test_payment_due_tomorrow_is_off_by_default_then_once_per_award_and_day(s4):
    d, _v1, _tok, _c, a = _awarded(s4)
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_rfqs SET internal_owner_user_id = 'dev-kim' WHERE id = ?", (d["id"],))  # an RFQ manager who may pay
    _set_dates(s4, d["id"], {0: _day(1)})
    _tick(s4)
    assert _rows(s4, "rfq.instalment_due_tomorrow") == [], "off by default"
    _enable(s4, "rfq.instalment_due_tomorrow")
    _tick(s4)
    _tick(s4)
    rows = _rows(s4, "rfq.instalment_due_tomorrow")
    assert len(rows) == 1 and rows[0]["count"] == 1, "raised once, never folded again by the next ticks"
    assert "₪" not in rows[0]["body"] and "ILS" not in rows[0]["body"], "never an amount"
    with s4.db.connection(mode="read") as conn:
        users = {r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (rows[0]["id"],))}
    assert "dev-kim" in users and "dev-mona" not in users, "only those who may mark the payment (tickets.costs + view)"
    assert demand(s4, d["id"], a["id"], 0, "create").status_code == 200
    assert demand(s4, d["id"], a["id"], 0, "paid").status_code == 200
    _tick(s4)
    assert _rows(s4, "rfq.instalment_due_tomorrow")[0]["state"] == "resolved", "paid: the alert is over"
