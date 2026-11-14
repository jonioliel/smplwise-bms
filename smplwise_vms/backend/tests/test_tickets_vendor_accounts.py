"""TK258 - the vendors account screen ("חשבון ספקים") over the REAL store: GET /tickets/costs/claims (one row per claim of the report's
filters, amounts per currency, the vendor / department filters and their options), the vendor / department filters of the report and
the CSV export, and POST /tickets/costs/mark-paid (a result per item, idempotent, per-item permission and visibility, content-free
audit). Every name, number and address here is invented."""
from __future__ import annotations

import json

import pytest
from conftest import bind
from hygiene import installation_day
from test_tickets_costs import _claim, decide, done, submit
from tickets_s4_world import API, build_s4

from smplwise.services.tickets import costs_report


@pytest.fixture()
def s4(settings, monkeypatch):
    costs_report.reset_rate()
    return build_s4(settings, monkeypatch)




def _two_currencies(s4):
    r = s4.c.get(f"{API}/tickets/settings")
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "costs": {"currencies": ["ILS", "USD"]}}).status_code == 200


def _approved(s4, **body):
    t, token, client, _ = done(s4)
    assert submit(client, token, **body).status_code == 201
    assert decide(s4, t["id"], "approve").status_code == 200
    return t


def _submitted(s4, **body):
    t, token, client, _ = done(s4)
    assert submit(client, token, **body).status_code == 201
    return t


def claims(s4, qs: str = "", user: str = "joni"):
    return s4.c.get(f"{API}/tickets/costs/claims{qs}", headers=s4.h(user))


def mark(s4, items, user: str = "joni", ref: str = "העברה 7781", day: str | None = None):
    day = day or installation_day()  # GATEHYGIENE: the installation's day AT THE CALL, never the machine's (tests/hygiene.py) and never the collection day
    return s4.c.post(f"{API}/tickets/costs/mark-paid", json={"items": items, "payment_ref": ref, "payment_date": day}, headers=s4.h(user))


def item(s4, t, **extra):
    c = _claim(s4, t["id"])
    return {"ticket_id": t["id"], "claim_id": c["id"], "revision": c["revision"], **extra}


# ---------------------------------------------------------------- GET /tickets/costs/claims

def test_claim_rows_carry_each_amount_in_its_own_currency_and_the_filters_apply(s4):
    _two_currencies(s4)
    a = _approved(s4)
    b = _submitted(s4, currency="USD", lines=[{"kind": "other", "description": "תיקון", "amount": "10"}])
    r = claims(s4)
    assert r.status_code == 200, r.text
    body = r.json()
    rows = {x["ticket_id"]: x for x in body["rows"]}
    assert set(rows) == {a["id"], b["id"]} and body["truncated"] is False and body["can_mark_paid"] is True
    ra, rb = rows[a["id"]], rows[b["id"]]
    assert (ra["status"], ra["currency"], ra["amount_minor"], ra["can_mark_paid"]) == ("approved", "ILS", 138709, True)
    assert (rb["status"], rb["currency"], rb["amount_minor"], rb["can_mark_paid"]) == ("submitted", "USD", 1180, False)
    assert ra["number"] == a["number"] and ra["revision"] == _claim(s4, a["id"])["revision"] and ra["department_id"] == "dept-maintenance"
    assert ra["vendor_key"] == rb["vendor_key"] == s4.contact["id"]
    assert body["vendors"] == [{"key": s4.contact["id"], "label": ra["vendor"]}]
    assert [d["id"] for d in body["departments"]] == ["dept-maintenance"]
    # the filters: status, currency, vendor, department (the options stay: they come from the OTHER filters)
    assert [x["ticket_id"] for x in claims(s4, "?status=approved").json()["rows"]] == [a["id"]]
    assert [x["ticket_id"] for x in claims(s4, "?currency=USD").json()["rows"]] == [b["id"]]
    assert len(claims(s4, f"?vendor={s4.contact['id']}").json()["rows"]) == 2
    none = claims(s4, "?vendor=nobody-here").json()
    assert none["rows"] == [] and none["vendors"] == body["vendors"], "picking a vendor never empties its own list"
    assert claims(s4, f"?department={s4.w.cleaning}").json()["rows"] == []
    assert claims(s4, "?department=dept-maintenance").json()["departments"] == body["departments"]
    # bad values are 422, never a silent "all"
    assert claims(s4, "?vendor=../x").status_code == 422
    assert claims(s4, "?status=open").status_code == 422
    assert claims(s4, "?currency=XXX").status_code == 422


def test_claim_rows_need_costs_view_and_the_report_takes_the_same_filters(s4):
    _approved(s4)
    assert claims(s4, user="mona").status_code == 403
    rep = s4.c.get(f"{API}/tickets/costs/report?group_by=vendor&vendor={s4.contact['id']}").json()
    assert rep["claims"] == 1 and rep["totals"][0]["approved_minor"] == 138709
    assert s4.c.get(f"{API}/tickets/costs/report?group_by=vendor&vendor=nobody-here").json()["claims"] == 0
    bind(s4.c, s4.w.settings, "mona", "tickets_costs_view", "installation", "*")
    r = claims(s4, user="mona")
    assert r.status_code == 200 and r.json()["can_mark_paid"] is False and r.json()["rows"][0]["can_mark_paid"] is False


def test_the_csv_export_honours_the_vendor_and_department_filters(s4):
    _approved(s4)
    r = s4.c.get(f"{API}/tickets/costs/export.csv?vendor=nobody-here")
    assert r.status_code == 200
    assert len([ln for ln in r.content.decode("utf-8").split("\r\n") if ln]) == 1, "the header only"
    costs_report.reset_rate()
    r = s4.c.get(f"{API}/tickets/costs/export.csv?department=dept-maintenance&vendor={s4.contact['id']}")
    assert len([ln for ln in r.content.decode("utf-8").split("\r\n") if ln]) == 2


# ---------------------------------------------------------------- POST /tickets/costs/mark-paid

def test_bulk_mark_paid_answers_per_item_and_is_idempotent(s4):
    a, b = _approved(s4), _approved(s4)
    c = _submitted(s4)
    items = [item(s4, a), item(s4, b, revision=_claim(s4, b["id"])["revision"] + 5), item(s4, c),
             {"ticket_id": a["id"], "claim_id": "no-such-claim"}, {"ticket_id": "no-such-ticket", "claim_id": "x1"}]
    r = mark(s4, items)
    assert r.status_code == 200, r.text
    res = r.json()
    assert [x["result"] for x in res["results"]] == ["paid", "stale", "not_approved", "not_found", "not_found"]
    assert (res["paid"], res["already_paid"], res["failed"]) == (1, 0, 4)
    paid = _claim(s4, a["id"])
    assert paid["status"] == "paid" and paid["payment_ref"] == "העברה 7781" and paid["payment_date"] == installation_day()
    assert _claim(s4, b["id"])["status"] == "approved" and _claim(s4, c["id"])["status"] == "submitted"
    # the same request again changes nothing: already_paid (also with the old revision), no second decision
    again = mark(s4, [items[0], items[0]]).json()
    assert [x["result"] for x in again["results"]] == ["already_paid"] and again["failed"] == 0
    decisions = [d["action"] for d in _claim(s4, a["id"])["decisions"]]
    assert decisions.count("mark_paid") == 1
    assert any(e["kind"] == "cost_decision" for e in s4.w.detail(a["id"])["events"])


def test_bulk_mark_paid_audit_is_content_free(s4):
    a = _approved(s4)
    assert mark(s4, [item(s4, a)], ref="REF-SECRET-42").status_code == 200
    with s4.db.connection(mode="read") as conn:
        rows = [dict(r) for r in conn.execute("SELECT action, details_json FROM audit_log WHERE action IN ('ticket.cost.mark_paid', 'ticket.costs.mark_paid_bulk')")]
    assert {r["action"] for r in rows} == {"ticket.cost.mark_paid", "ticket.costs.mark_paid_bulk"}
    assert not any("REF-SECRET" in (r["details_json"] or "") for r in rows)
    one = json.loads(next(r["details_json"] for r in rows if r["action"] == "ticket.cost.mark_paid"))
    assert one["status"] == "paid" and one["bulk"] is True and one["total_minor"] == 138709
    summary = json.loads(next(r["details_json"] for r in rows if r["action"] == "ticket.costs.mark_paid_bulk"))
    assert summary == {"items": 1, "paid": 1}


def test_bulk_mark_paid_permissions_and_validation(s4):
    a = _approved(s4)
    it = item(s4, a)
    assert mark(s4, [it], user="mona").status_code == 403, "no tickets.costs anywhere"
    bind(s4.c, s4.w.settings, "mona", "tickets_costs_view", "installation", "*")
    assert mark(s4, [it], user="mona").status_code == 403, "view alone cannot mark"
    # cleo holds the cost permissions but cannot see a maintenance ticket: the uniform not_found, nothing written
    bind(s4.c, s4.w.settings, "cleo", "tickets_costs_view", "installation", "*")
    bind(s4.c, s4.w.settings, "cleo", "tickets_costs", "installation", "*")
    r = mark(s4, [it], user="cleo")
    assert r.status_code == 200 and r.json()["results"][0]["result"] == "not_found"
    assert _claim(s4, a["id"])["status"] == "approved"
    # the shared fields once: a missing reference, a future date, too many items
    assert mark(s4, [it], ref="  ").status_code == 422
    future = installation_day(5)
    assert mark(s4, [it], day=future).status_code == 422
    assert mark(s4, [it] * 201).status_code == 422
    assert mark(s4, []).status_code == 422
    bind(s4.c, s4.w.settings, "mona", "tickets_costs", "installation", "*")
    r = mark(s4, [it], user="mona")
    assert r.status_code == 200 and r.json()["results"][0]["result"] == "paid"
