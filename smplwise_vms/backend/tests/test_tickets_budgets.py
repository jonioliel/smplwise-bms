"""CR-SVC215 slice 1 - budgets against approved costs over the REAL store (docs/changes/CR-SVC215.md section 6; owner answers 2026-10-24
items 33, 34, 36): the switch, the permissions (money = tickets.costs.view, writes = tickets.configure), validation (period starts, one
row per scope / period / currency), consumption per currency, the scopes beyond the department (the whole installation, a building),
the over-budget approval that asks for a confirmation and is NEVER refused, the audit's budget_state and the notifications once per
crossing, resolved on the way back. Every name and number is invented."""
from __future__ import annotations

import datetime as dt
import json
import time

import pytest

from smplwise.services.tickets import budgets, costs_report
from tickets_s4_world import API, Clock, build_s4, crid

LINES = [{"kind": "labor", "hours": "2", "rate": "150"}, {"kind": "parts", "description": "מדחס", "quantity": "1", "unit_price": "800"},
         {"kind": "travel", "amount": "50"}, {"kind": "other", "description": "פינוי", "amount": "25.50"}]
TOTAL = 138709  # the server's figure for LINES with VAT added (tests/test_tickets_costs.py)


@pytest.fixture()
def s4(settings, monkeypatch):
    costs_report.reset_rate()
    return build_s4(settings, monkeypatch)


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


def this_year(s4) -> str:
    with s4.db.connection(mode="read") as conn:
        return budgets.period_of("year", dt.datetime.now(dt.timezone.utc).astimezone(budgets._zone(conn)).date()).isoformat()


def create(s4, user: str = "joni", **body):
    payload = {"scope_kind": "department", "scope_id": "dept-maintenance", "period_kind": "year", "period_start": this_year(s4),
               "amount_minor": 100_000, "currency": "ILS", **body}
    return s4.c.post(f"{API}/tickets/costs/budgets", json=payload, headers=s4.h(user))


def submitted(s4):
    """A ticket sent to the contact, reported done, with the vendor's demand submitted (TOTAL)."""
    t, token = s4.sent(cost_claim="required")
    client, _ = s4.public(Clock(time.time()))
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()}).status_code == 200
    r = client.post("/t/api/claim", headers=hdr(token), json={"lines": LINES, "client_request_id": crid()})
    assert r.status_code == 201, r.text
    return t


def claim_of(s4, tid):
    r = s4.c.get(f"{API}/tickets/{tid}/costs")
    assert r.status_code == 200, r.text
    return r.json()["claims"][0]


def approve(s4, tid, **extra):
    c = claim_of(s4, tid)
    return s4.c.post(f"{API}/tickets/{tid}/costs/{c['id']}/approve", json={"revision": c["revision"], "revision_id": c["current_revision_id"], **extra})


def notes(s4, source: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at, id", (source,)).fetchall()]


# ---------------------------------------------------------------- switch and permissions

def test_switch_off_every_budget_route_is_feature_disabled_and_approvals_ask_nothing(s4):
    assert create(s4).status_code == 201
    r = s4.c.get(f"{API}/tickets/settings")
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "budgets": {"enabled": False}}).status_code == 200
    for r in (s4.c.get(f"{API}/tickets/costs/budgets"), s4.c.get(f"{API}/tickets/costs/budgets/summary"), create(s4, amount_minor=5)):
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", r.text
    t = submitted(s4)
    assert approve(s4, t["id"]).status_code == 200, "off: an approval over the (dormant) budget asks nothing"


def test_money_needs_costs_view_and_writes_need_configure(s4):
    r = s4.c.get(f"{API}/tickets/costs/budgets", headers=s4.h("mona"))
    assert r.status_code == 403 and r.json()["details"]["permission"] == "tickets.costs.view", "a manager without the money permission"
    r = create(s4, user="mona")
    assert r.status_code == 403
    assert create(s4).status_code == 201


def test_validation_and_one_row_per_scope_period_currency(s4):
    for body, field in (({"period_start": this_year(s4)[:5] + "02-01"}, "period_start"), ({"period_kind": "quarter", "period_start": this_year(s4)[:5] + "02-01"}, "period_start"),
                        ({"currency": "XXX"}, "currency"), ({"scope_id": "no-such-dept"}, "scope_id"), ({"amount_minor": 0}, "amount_minor"),
                        ({"warn_bp": 20000}, "warn_bp"), ({"scope_kind": "planet"}, "scope_kind")):
        r = create(s4, **body)
        assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == field, (body, r.text)
    assert create(s4).status_code == 201
    r = create(s4)
    assert r.status_code == 409 and r.json()["code"] == "budget_exists"
    assert create(s4, currency="USD").status_code == 201, "another currency is its own row"
    assert create(s4, scope_kind="installation", scope_id=None).status_code == 201, "owner answer 34: the whole building too"


def test_a_new_budget_reads_its_default_warning_threshold(s4):
    b = create(s4).json()
    assert b["warn_bp"] == 8000 and b["state"] == "ok" and b["approved_minor"] == 0 and b["remaining_minor"] == 100_000


# ---------------------------------------------------------------- the approval over budget

def test_an_approval_over_budget_asks_for_confirmation_and_is_never_refused(s4):
    b = create(s4).json()
    t = submitted(s4)
    c = claim_of(s4, t["id"])
    check = s4.c.get(f"{API}/tickets/{t['id']}/costs/{c['id']}/budget-check")
    assert check.status_code == 200 and check.json()["confirm_required"] is True
    [row] = check.json()["budgets"]
    assert row["after"] == "exceeded" and row["overrun_minor"] == TOTAL - 100_000
    r = approve(s4, t["id"])
    assert r.status_code == 409 and r.json()["code"] == "budget_confirm_required", r.text
    [over] = r.json()["details"]["budgets"]
    assert over["id"] == b["id"] and over["overrun_minor"] == TOTAL - 100_000
    assert claim_of(s4, t["id"])["status"] == "submitted", "nothing was approved without the confirmation"
    r = approve(s4, t["id"], budget_confirm=True)
    assert r.status_code == 200, r.text
    assert claim_of(s4, t["id"])["status"] == "approved"
    with s4.db.connection(mode="read") as conn:
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.cost.approve' ORDER BY id DESC LIMIT 1").fetchone()
    d = json.loads(row[0])
    assert d["budget_state"] == "exceeded" and d["budget_confirmed"] is True and d["budget_ids"] == [b["id"]]
    s = s4.c.get(f"{API}/tickets/costs/budgets/summary").json()["rows"]
    assert [x["state"] for x in s] == ["exceeded"] and s[0]["approved_minor"] == TOTAL
    [n] = notes(s4, "ticket.budget_exceeded")
    assert n["state"] != "resolved" and str(TOTAL) not in json.dumps(n, ensure_ascii=False), "no amount in a notification"


def test_require_confirmation_off_records_only(s4):
    create(s4)
    r = s4.c.get(f"{API}/tickets/settings")
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "budgets": {"require_confirmation": False}}).status_code == 200
    t = submitted(s4)
    assert approve(s4, t["id"]).status_code == 200


def test_raising_the_amount_resolves_the_exceeded_row(s4):
    b = create(s4).json()
    t = submitted(s4)
    assert approve(s4, t["id"], budget_confirm=True).status_code == 200
    assert notes(s4, "ticket.budget_exceeded")[0]["state"] != "resolved"
    stale = s4.c.patch(f"{API}/tickets/costs/budgets/{b['id']}", json={"revision": b["revision"] + 1, "amount_minor": 1_000_000})
    assert stale.status_code == 409 and stale.json()["code"] == "budget_stale"
    r = s4.c.patch(f"{API}/tickets/costs/budgets/{b['id']}", json={"revision": b["revision"], "amount_minor": 1_000_000})
    assert r.status_code == 200, r.text  # the alert-state writes never move the revision (no 409 for the person editing)
    assert r.json()["state"] == "ok"
    assert notes(s4, "ticket.budget_exceeded")[0]["state"] == "resolved"


def test_a_warning_crossing_notifies_once(s4):
    create(s4, amount_minor=160_000)  # TOTAL is 86.7 %: over the 80 % warning, under the amount
    t = submitted(s4)
    assert approve(s4, t["id"]).status_code == 200, "under the amount: no confirmation"
    assert len(notes(s4, "ticket.budget_warning")) == 1
    assert notes(s4, "ticket.budget_exceeded") == []


def test_currencies_are_never_summed_and_a_building_budget_counts_only_its_requests(s4):
    create(s4, currency="USD", amount_minor=10)
    create(s4, scope_kind="building", scope_id=_building(s4), amount_minor=10)
    t = submitted(s4)  # placeless, in ILS
    assert approve(s4, t["id"]).status_code == 200, "neither the USD budget nor the building's covers it"
    rows = s4.c.get(f"{API}/tickets/costs/budgets").json()["budgets"]
    assert all(r["approved_minor"] == 0 for r in rows)


def _building(s4) -> str:
    with s4.db.connection(mode="read") as conn:
        return conn.execute("SELECT id FROM buildings ORDER BY id LIMIT 1").fetchone()[0]


def test_delete_needs_the_revision_and_resolves(s4):
    b = create(s4).json()
    r = s4.c.delete(f"{API}/tickets/costs/budgets/{b['id']}?revision=99")
    assert r.status_code == 409
    assert s4.c.delete(f"{API}/tickets/costs/budgets/{b['id']}?revision={b['revision']}").status_code == 204
    assert s4.c.get(f"{API}/tickets/costs/budgets").json()["budgets"] == []


def test_period_maths():
    assert budgets.period_end("quarter", dt.date(2026, 10, 1)) == dt.date(2027, 1, 1)
    assert budgets.period_end("month", dt.date(2026, 12, 1)) == dt.date(2027, 1, 1)
    assert budgets.period_of("quarter", dt.date(2026, 8, 15)) == dt.date(2026, 7, 1)
    assert budgets.state_of(100, 80, 8000) == "warning" and budgets.state_of(100, 79, 8000) == "ok" and budgets.state_of(100, 101, 8000) == "exceeded"
