"""CR-RFQ-PAYMENT-SCHEDULE (docs/changes/CR-RFQ-PAYMENT-SCHEDULE.md; RFQ contract section 20): the vendor's payment schedule and his
arrival confirmation, over the REAL store, the real internal API and the real public app.

Negative cases first: the installation switch OFF (the default - nothing changes, every new field is refused, the public route answers
`arrival_closed`), malformed plans, a schedule above the approved total, a vendor that was NOT awarded (he learns nothing), a pending
second approval, a write without the schedule acknowledgement, a manager decision without a proposal; then the flows - the proposal on
the vendor's quote, the approved schedule summing exactly to the approved total (percent rounding, partial approval), the confirmation /
alternative date / accept / reject, the reminder through existing purposes, the work order's dates and text (never an amount), the
payment demand checked against the schedule (flagged, never refused), retention. Every name and number here is invented (the
050-000-xxxx block, example.test hosts)."""
from __future__ import annotations

import datetime as dt
import json
import time
import uuid

import pytest
from conftest import bind

from smplwise.services.tickets import rfq_terms, store_rfq
from smplwise.services.tickets.costs import CostRefused
from test_tickets_rfq_public import QUOTE, detail, hdr, pub, sent_rfq, token, vid, view
from tickets_s4_world import API, Clock, build_s4, crid

DAY = 86400.0


def _day(days: int) -> str:
    """A plain day N days from TODAY IN THE INSTALLATION'S ZONE - the product's "today" (rfq_terms.today). TKGATEFIX8: it was the
    MACHINE's date (`date.today()`), which on the Etc/UTC test runner is the previous day between the installation's midnight and
    00:00 UTC (21:00 / 22:00 - 24:00 UTC for Asia/Jerusalem): `_day(0)` was then already past, and the gate failed only at night."""
    from zoneinfo import ZoneInfo

    from smplwise.services.tickets.messaging import DEFAULT_TZ

    return (dt.datetime.now(ZoneInfo(DEFAULT_TZ)).date() + dt.timedelta(days=days)).isoformat()


def _at(days: float) -> str:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


PLAN = {"items": [{"kind": "advance", "percent": "30", "due": "date", "date": _day(6)},
                  {"kind": "progress", "amount": "100", "due": "date", "date": _day(8)},
                  {"kind": "final", "due": "after_completion", "days": 30}]}


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    bind(world.c, settings, "kim", "system_admin", "installation", "*")  # the approver (tickets.costs + view)
    rev = world.c.get(f"{API}/tickets/channel").json()["revision"]
    assert world.c.put(f"{API}/tickets/channel", json={"revision": rev, "whatsapp": {"enabled": True}}).status_code == 200
    return world


def switch(s4, on: bool = True, hours: int | None = None) -> None:
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    body: dict = {"schedule_arrival": on}
    if hours is not None:
        body["arrival_reminder_hours"] = hours
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": body})
    assert r.status_code == 200, r.text
    assert r.json()["rfq"]["schedule_arrival"] is on


def pquote(c, tok: str, **body):
    return c.post("/t/api/rfq/quote", json={"lines": QUOTE, "base_version": None, "client_request_id": crid(), **body}, headers=hdr(tok))


def arrival(c, tok: str, action: str = "confirm", ack=True, **body):
    payload = {"action": action, "client_request_id": crid(), **body}
    if ack is not None:
        payload["acknowledge_schedule"] = ack
    return c.post("/t/api/rfq/arrival", json=payload, headers=hdr(tok))


def comparison(s4, rid: str) -> dict:
    r = s4.c.get(f"{API}/tickets/rfqs/{rid}/comparison", headers=s4.h("kim"))
    assert r.status_code == 200, r.text
    return r.json()


def award(s4, rid: str, vendor_id: str, user: str = "kim", **body):
    q = next(x for x in comparison(s4, rid)["quotes"] if x["vendor_id"] == vendor_id)
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/awards", json={"quote_id": q["quote_id"], "revision": q["revision"], **body}, headers=s4.h(user))


def terms_rows(s4) -> int:
    with s4.db.connection(mode="read") as conn:
        return int(conn.execute("SELECT COUNT(*) FROM ticket_rfq_award_terms").fetchone()[0])


# ---------------------------------------------------------------- the pure rules (no world)

FIRST = dt.date(2026, 11, 1)


@pytest.mark.parametrize("plan, field, code", [
    ({"items": []}, "payment.items", "count"),
    ({"items": [{"kind": "advance", "percent": "10", "due": "date", "date": "2026-11-02"}]}, "payment.items.0.kind", "final_last"),
    ({"items": [{"kind": "final", "due": "completion"}, {"kind": "final", "due": "completion"}]}, "payment.items.0.kind", "final_last"),
    ({"items": [{"kind": "progress", "percent": "10", "due": "date", "date": "2026-11-02"},
                {"kind": "advance", "percent": "10", "due": "date", "date": "2026-11-03"}, {"kind": "final", "due": "completion"}]},
     "payment.items.1.kind", "advance_first"),
    ({"items": [{"kind": "advance", "percent": "10", "amount": "5", "due": "date", "date": "2026-11-02"}, {"kind": "final", "due": "completion"}]},
     "payment.items.0", "share_required"),
    ({"items": [{"kind": "advance", "due": "date", "date": "2026-11-02"}, {"kind": "final", "due": "completion"}]}, "payment.items.0", "share_required"),
    ({"items": [{"kind": "final", "percent": "100", "due": "completion"}]}, "payment.items.0", "final_is_remainder"),
    ({"items": [{"kind": "advance", "percent": "101", "due": "date", "date": "2026-11-02"}, {"kind": "final", "due": "completion"}]},
     "payment.items.0.percent", "range"),
    ({"items": [{"kind": "advance", "percent": "12.345", "due": "date", "date": "2026-11-02"}, {"kind": "final", "due": "completion"}]},
     "payment.items.0.percent", "format"),
    ({"items": [{"kind": "advance", "percent": "60", "due": "date", "date": "2026-11-02"},
                {"kind": "progress", "percent": "50", "due": "date", "date": "2026-11-03"}, {"kind": "final", "due": "completion"}]},
     "payment.items", "exceeds_total"),
    ({"items": [{"kind": "advance", "amount": "1.234", "due": "date", "date": "2026-11-02"}, {"kind": "final", "due": "completion"}]},
     "payment.items.0.amount", "format"),
    ({"items": [{"kind": "advance", "amount": "0", "due": "date", "date": "2026-11-02"}, {"kind": "final", "due": "completion"}]},
     "payment.items.0.amount", "range"),
    ({"items": [{"kind": "advance", "percent": "10", "due": "completion"}, {"kind": "final", "due": "completion"}]}, "payment.items.0.due", "invalid"),
    ({"items": [{"kind": "advance", "percent": "10", "due": "date", "date": "2026-10-31"}, {"kind": "final", "due": "completion"}]},
     "payment.items.0.date", "range"),
    ({"items": [{"kind": "advance", "percent": "10", "due": "date", "date": "2028-01-01"}, {"kind": "final", "due": "completion"}]},
     "payment.items.0.date", "range"),
    ({"items": [{"kind": "advance", "percent": "10", "due": "date", "date": "1.11.2026"}, {"kind": "final", "due": "completion"}]},
     "payment.items.0.date", "format"),
    ({"items": [{"kind": "advance", "percent": "10", "due": "date", "date": "2026-11-05"},
                {"kind": "progress", "percent": "10", "due": "date", "date": "2026-11-04"}, {"kind": "final", "due": "completion"}]},
     "payment.items.1.date", "order"),
    ({"items": [{"kind": "advance", "percent": "10", "due": "date", "date": "2026-11-05"}, {"kind": "final", "due": "date", "date": "2026-11-04"}]},
     "payment.items.1.date", "order"),
    ({"items": [{"kind": "final", "due": "after_completion"}]}, "payment.items.0.days", "range"),
    ({"items": [{"kind": "final", "due": "after_completion", "days": 181}]}, "payment.items.0.days", "range"),
    ({"items": [{"kind": "final", "due": "completion", "days": 3}]}, "payment.items.0.days", "invalid"),
    ({"items": [{"kind": "final", "due": "completion", "iban": "IL00"}]}, "payment.items.0", "invalid"),  # no bank data, ever
    ({"items": [{"kind": "final", "due": "completion"}], "bank": "x"}, "payment", "invalid"),
])
def test_a_malformed_plan_is_refused_with_its_field(plan, field, code):
    with pytest.raises(CostRefused) as e:
        rfq_terms.parse_plan(plan, first_day=FIRST)
    assert (e.value.field, e.value.code) == (field, code)


def test_the_approved_schedule_sums_exactly_to_the_total_floor_to_final():
    plan = rfq_terms.parse_plan({"items": [{"kind": "advance", "percent": "33.33", "due": "date", "date": "2026-11-02"},
                                           {"kind": "progress", "percent": "33.33", "due": "date", "date": "2026-11-03"},
                                           {"kind": "final", "due": "completion"}]}, first_day=FIRST)
    for total in (1, 3, 99, 100, 101, 999_999, 1_234_567, 10_000_001, 99_999_999_999):
        try:
            s = rfq_terms.convert(plan, total, "ILS")
        except CostRefused as exc:
            assert exc.code == "zero_amount" and total < 4, total  # 33.33 % of a few agorot rounds to zero: refused, never a 0 instalment
            continue
        amounts = [it["amount_minor"] for it in s["items"]]
        assert sum(amounts) == total and all(isinstance(a, int) and a >= 0 for a in amounts), (total, amounts)
        assert amounts[0] == amounts[1] == total * 3333 // 10000 and s["rounding"] == "floor_final"
    assert rfq_terms.convert(None, 5000, "ILS")["items"] == [
        {"index": 0, "kind": "final", "amount_minor": 5000, "percent_bp": None, "due": "completion", "date": None, "days": None}]
    fixed = rfq_terms.parse_plan({"items": [{"kind": "advance", "amount": "60", "due": "date", "date": "2026-11-02"},
                                            {"kind": "final", "due": "completion"}]}, first_day=FIRST)
    with pytest.raises(CostRefused) as e:
        rfq_terms.convert(fixed, 5000, "ILS")  # 60.00 above a 50.00 approved total (a partial approval shrank it)
    assert e.value.code == "exceeds_total"
    full = rfq_terms.convert(rfq_terms.parse_plan({"items": [{"kind": "advance", "percent": "100", "due": "date", "date": "2026-11-02"},
                                                             {"kind": "final", "due": "completion"}]}, first_day=FIRST), 5000, "ILS")
    assert [it["amount_minor"] for it in full["items"]] == [5000, 0]


def test_the_demand_check_flags_and_never_refuses(s4, monkeypatch):
    from smplwise.services.tickets import store_costs

    sched = {"currency": "ILS", "total_minor": 100000, "rounding": "floor_final", "items": [
        {"index": 0, "kind": "advance", "amount_minor": 30000, "percent_bp": 3000, "due": "date", "date": "2020-01-01", "days": None},
        {"index": 1, "kind": "final", "amount_minor": 70000, "percent_bp": None, "due": "after_completion", "date": None, "days": 30}]}
    base = {"payment_schedule_json": json.dumps(sched)}
    claim = {"ticket_id": "t-1", "created_at": "2026-10-01T08:00:00Z", "status": "submitted"}
    ticket = {"id": "t-1", "done_at": "2026-10-01T07:00:00Z"}
    monkeypatch.setattr(store_costs, "ticket_row", lambda conn, tid: ticket if tid == "t-1" else None)
    with s4.db.connection(mode="read") as conn:
        early = rfq_terms.check_demand(conn, claim, base, {"total_minor": 100000, "currency": "ILS", "created_at": "2026-10-02T08:00:00Z"})
        assert early["status"] == "flagged" and early["flags"] == ["ahead_of_schedule"] and early["due_minor"] == 30000
        assert [i["is_due"] for i in early["items"]] == [True, False] and early["items"][1]["due_date"] == "2026-10-31"
        late = rfq_terms.check_demand(conn, claim, base, {"total_minor": 100000, "currency": "ILS", "created_at": "2026-11-05T08:00:00Z"})
        assert late["status"] == "ok" and late["flags"] == [] and late["due_minor"] == 100000
        above = rfq_terms.check_demand(conn, claim, base, {"total_minor": 100001, "currency": "ILS", "created_at": "2026-11-05T08:00:00Z"})
        assert above["flags"] == ["above_total", "ahead_of_schedule"]
        other = rfq_terms.check_demand(conn, claim, base, {"total_minor": 5, "currency": "USD", "created_at": "2026-11-05T08:00:00Z"})
        assert other["flags"] == ["currency"]
        assert rfq_terms.check_demand(conn, claim, {"payment_schedule_json": None}, {"total_minor": 1, "currency": "ILS", "created_at": "x"}) is None


def test_a_demand_before_the_job_is_done_is_flagged_for_the_default_schedule(s4, monkeypatch):
    """Review F2: while the ticket's done_at is NULL nothing due on / after completion is due - the claim's creation is NOT the
    completion. The default schedule (one final instalment on completion) flags any demand `before_completion` until the job is done."""
    from smplwise.services.tickets import quotes, store_costs

    sched = rfq_terms.convert(None, 100000, "ILS")
    base = {"payment_schedule_json": json.dumps(sched)}
    ticket = {"id": "t-2", "done_at": None}
    monkeypatch.setattr(store_costs, "ticket_row", lambda conn, tid: ticket if tid == "t-2" else None)
    claim = {"ticket_id": "t-2", "created_at": "2026-10-01T08:00:00Z", "status": "submitted"}
    demand = {"total_minor": 100000, "currency": "ILS", "created_at": "2026-10-01T08:00:00Z"}
    with s4.db.connection(mode="read") as conn:
        open_job = rfq_terms.check_demand(conn, claim, base, demand)
        assert open_job["status"] == "flagged" and open_job["flags"] == ["before_completion"], open_job
        assert open_job["due_minor"] == 0 and open_job["completed_on"] is None
        assert open_job["items"][0]["is_due"] is False and open_job["items"][0]["due_date"] is None
        assert rfq_terms.check_demand(conn, {**claim, "ticket_id": None}, base, demand)["flags"] == ["before_completion"]  # no ticket = not done
        # a dated advance is due; the remainder (on completion) is not while the job is open
        dated = rfq_terms.convert(rfq_terms.parse_plan({"items": [{"kind": "advance", "percent": "30", "due": "date", "date": "2026-11-02"},
                                                                  {"kind": "final", "due": "completion"}]}, first_day=FIRST), 100000, "ILS")
        b2 = {"payment_schedule_json": json.dumps(dated)}
        assert rfq_terms.check_demand(conn, claim, b2, {**demand, "total_minor": 30000, "created_at": "2026-11-03T08:00:00Z"})["status"] == "ok"
        assert rfq_terms.check_demand(conn, claim, b2, {**demand, "total_minor": 30001, "created_at": "2026-11-03T08:00:00Z"})["flags"] == ["before_completion"]
        ticket["done_at"] = "2026-11-04T08:00:00Z"
        done = rfq_terms.check_demand(conn, claim, base, {**demand, "created_at": "2026-11-05T08:00:00Z"})
        assert done["status"] == "ok" and done["completed_on"] == "2026-11-04"
        ticket["done_at"] = None
        # the flag sets needs_review on the managers' claim view (never refuses)
        quote = {**base, "id": "q-2", "version": 1, "state": "approved", "currency": "ILS", "approved_total_minor": None}
        monkeypatch.setattr(quotes.store_quotes, "quote", lambda conn, qid: quote if qid == "q-2" else None)
        out = quotes.demand_view(conn, {**claim, "quote_id": "q-2", "current_revision_id": "r1", "approved_revision_id": None},
                                 [{"id": "r1", "total_minor": 100000, "currency": "ILS", "created_at": "2026-10-01T08:00:00Z", "labor_minor": 100000,
                                   "parts_minor": 0, "travel_minor": 0, "other_minor": 0, "exceptional": 0}])
        assert out["schedule_check"]["flags"] == ["before_completion"] and out["needs_review"] is True


# ---------------------------------------------------------------- the switch OFF (the default): nothing changes

def test_with_the_switch_off_every_new_field_is_refused_and_nothing_is_stored(s4):
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    v = view(c, tok)
    assert v["form"]["payment"] is None and v["terms"] is None
    r = pquote(c, tok, payment=PLAN)
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "payment", "code": "disabled"}], r.text
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v1}/quotes", json={"lines": QUOTE, "payment": PLAN}, headers=s4.h("joni"))
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["code"] == "disabled", r.text
    assert pquote(c, tok).status_code == 201
    for body in ({"payment": PLAN}, {"arrival": {"work_from": _at(6)}}, {"payment_source": "vendor"}):
        r = award(s4, d["id"], v1, **body)
        assert r.status_code == 422 and r.json()["details"]["fields"][0]["code"] == "disabled", r.text
    meta = s4.c.get(f"{API}/tickets/rfqs/meta", headers=s4.h("mona")).json()
    assert meta["schedule_arrival"] is False and meta["settings"]["schedule_arrival"] is False
    r = award(s4, d["id"], v1)
    assert r.status_code == 201, r.text
    assert r.json()["award"]["terms"] is None and "מועד ההגעה" not in r.json()["message_draft"]["text"]
    assert all(a["terms"] is None for a in detail(s4, d["id"])["awards"])
    v = view(c, tok)
    assert v["page_state"] == "awarded" and v["terms"] is None
    r = arrival(c, tok)
    assert r.status_code == 409 and r.json() == {"code": "arrival_closed"}
    assert terms_rows(s4) == 0
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_quotes WHERE payment_plan_json IS NOT NULL OR payment_schedule_json IS NOT NULL").fetchone()[0] == 0


# ---------------------------------------------------------------- the switch ON

def test_a_vendor_who_was_not_awarded_learns_nothing_and_cannot_write(s4):
    switch(s4)
    d = sent_rfq(s4)
    v1, v2 = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    t1, t2 = token(s4, v1), token(s4, v2)
    c = pub(s4)
    assert view(c, t1)["form"]["payment"] == {"max_items": 6, "days_max": 180, "horizon_days": 366}
    assert pquote(c, t1, payment=PLAN).status_code == 201
    assert pquote(c, t2).status_code == 201
    assert award(s4, d["id"], v1, payment_source="vendor").status_code == 201
    other = view(c, t2)
    assert other["page_state"] == "closed" and other["terms"] is None and other["quote"] is None
    for body in ({"action": "confirm"}, {"action": "propose", "work_from": _at(7)}):
        r = arrival(c, t2, **body)
        assert r.status_code == 409 and r.json() == {"code": "arrival_closed"}, r.text  # the same answer as "no terms at all"
    raw = json.dumps(other, ensure_ascii=False)
    assert "schedule" not in raw and "planned_from" not in raw and "arrival" not in raw


def test_a_pending_second_approval_shows_nothing_and_a_decline_drops_the_terms(s4, settings):
    switch(s4)
    bind(s4.c, settings, "lea", "system_admin", "installation", "*")
    assert s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": 100}).status_code == 200
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    assert pquote(c, tok, payment=PLAN).status_code == 201
    r = award(s4, d["id"], v1, payment_source="vendor")
    a = r.json()["award"]
    assert a["state"] == "pending_second" and a["terms"]["schedule"]["source"] == "vendor", r.text
    assert terms_rows(s4) == 1
    v = view(c, tok)
    assert v["terms"] is None and v["page_state"] == "open"
    assert arrival(c, tok).json() == {"code": "arrival_closed"}
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT payment_schedule_json FROM ticket_quotes WHERE id = ?", (a["quote_id"],)).fetchone()[0] is None
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/decline", json={"revision": a["revision"], "reason": "יקר"}, headers=s4.h("lea"))
    assert r.status_code == 200, r.text
    assert terms_rows(s4) == 0


def test_the_award_approves_an_edited_schedule_and_the_vendor_confirms_the_planned_window(s4):
    switch(s4)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    q = pquote(c, tok, payment=PLAN, work_from=_at(6), work_to=_at(7))
    assert q.status_code == 201 and q.json()["quote"]["payment"]["items"][0] == {
        "kind": "advance", "due": "date", "date": _day(6), "days": None, "percent": "30", "amount_minor": None}, q.text
    cmp = comparison(s4, d["id"])
    assert cmp["quotes"][0]["payment_proposal"]["items"][1]["amount_minor"] == 10000
    # refusals before any write: a fixed instalment above the APPROVED (partial: labour only = 300.00 + VAT) total
    too_much = {"items": [{"kind": "advance", "amount": "5000", "due": "date", "date": _day(6)}, {"kind": "final", "due": "completion"}]}
    r = award(s4, d["id"], v1, kinds=["labor"], payment=too_much)
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "payment.items", "code": "exceeds_total"}], r.text
    r = award(s4, d["id"], v1, kinds=["labor"], payment_source="vendor", arrival={"work_from": _at(6), "work_to": _at(5)})
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "arrival.work_to", "code": "order"}
    assert terms_rows(s4) == 0 and not detail(s4, d["id"])["awards"]
    edited = {"items": [{"kind": "advance", "percent": "33.33", "due": "date", "date": _day(6)}, {"kind": "final", "due": "completion"}]}
    r = award(s4, d["id"], v1, kinds=["labor"], payment=edited)
    assert r.status_code == 201, r.text
    body = r.json()
    a = body["award"]
    sched = a["terms"]["schedule"]
    assert sched["source"] == "manager" and sched["total_minor"] == a["total_minor"]
    assert sum(i["amount_minor"] for i in sched["items"]) == a["total_minor"]
    assert sched["items"][0]["amount_minor"] == a["total_minor"] * 3333 // 10000
    assert a["terms"]["arrival"]["state"] == "awaiting" and a["terms"]["arrival"]["planned_from"] == q.json()["quote"]["work_from"]
    assert "מועד ההגעה" in body["message_draft"]["text"]
    # the vendor's page: HIS schedule and window; the write needs the acknowledgement
    v = view(c, tok)
    assert v["page_state"] == "awarded" and v["terms"]["can"] == {"confirm": True, "propose": True}
    assert [i["amount_minor"] for i in v["terms"]["schedule"]["items"]] == [i["amount_minor"] for i in sched["items"]]
    assert set(v["terms"]["arrival"]) == {"state", "planned_from", "planned_to", "proposed_from", "proposed_to", "rejected", "confirmed_at",
                                         "acknowledged_at", "changed"}  # + RFQPAY2 20.14
    r = arrival(c, tok, ack=False)
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "acknowledge_schedule", "code": "required"}]
    r = arrival(c, tok, action="confirm", ack=True, work_from=_at(9))
    assert r.status_code == 422
    rid = crid()
    r1 = c.post("/t/api/rfq/arrival", json={"action": "confirm", "acknowledge_schedule": True, "client_request_id": rid}, headers=hdr(tok))
    r2 = c.post("/t/api/rfq/arrival", json={"action": "confirm", "acknowledge_schedule": True, "client_request_id": rid}, headers=hdr(tok))
    assert r1.status_code == r2.status_code == 200 and r1.json() == r2.json(), r2.text  # replayed, not applied twice
    assert r1.json()["terms"]["arrival"]["state"] == "confirmed" and r1.json()["terms"]["arrival"]["acknowledged_at"]
    assert arrival(c, tok, action="propose", work_from=_at(9)).json() == {"code": "arrival_closed"}
    dd = detail(s4, d["id"], "mona")
    kinds = [e["kind"] for e in dd["timeline"]]
    assert "terms_set" in kinds and kinds.count("arrival_confirmed") == 1
    assert dd["awards"][0]["terms"]["arrival"]["confirmed_by"] == "vendor"
    with s4.db.connection(mode="read") as conn:
        stored = json.loads(conn.execute("SELECT payment_schedule_json FROM ticket_quotes WHERE id = ?", (a["quote_id"],)).fetchone()[0])
        audit = [json.loads(r[0]) for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.vendor_arrival'")]
    assert sum(i["amount_minor"] for i in stored["items"]) == a["total_minor"]
    assert audit and all("amount_minor" not in json.dumps(x) and "total" not in json.dumps(x) for x in audit)  # ids only on the public side


def test_an_alternative_date_is_rejected_then_accepted_and_the_order_uses_it(s4):
    switch(s4)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    assert pquote(c, tok).status_code == 201  # no proposal: one final instalment on completion
    r = award(s4, d["id"], v1)
    a = r.json()["award"]
    assert [(i["kind"], i["due"], i["amount_minor"]) for i in a["terms"]["schedule"]["items"]] == [("final", "completion", a["total_minor"])]
    assert a["terms"]["schedule"]["source"] == "default"
    # a decision with nothing proposed
    rev = a["terms"]["revision"]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival", json={"action": "accept", "revision": rev}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "arrival_not_proposed"
    r = arrival(c, tok, action="propose", work_from=_at(12), work_to=_at(11))
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "work_to", "code": "order"}]
    r = arrival(c, tok, action="propose", work_from=_at(12))
    assert r.status_code == 200 and r.json()["terms"]["arrival"]["state"] == "proposed", r.text
    t = detail(s4, d["id"], "mona")["awards"][0]["terms"]
    assert t["can"]["decide_arrival"] is True
    for user in ("tom", "cleo"):  # a plain member: an audited 403; another department: the uniform 404
        r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival", json={"action": "reject", "revision": t["revision"]}, headers=s4.h(user))
        assert r.status_code in (403, 404), (user, r.text)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival", json={"action": "reject", "revision": t["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    v = view(c, tok)
    assert v["terms"]["arrival"]["state"] == "awaiting" and v["terms"]["arrival"]["rejected"] is True
    later = _at(14)
    assert arrival(c, tok, action="propose", work_from=later).status_code == 200
    t = detail(s4, d["id"], "mona")["awards"][0]["terms"]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival", json={"action": "accept", "revision": t["revision"] - 1}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "rfq_stale"
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival", json={"action": "accept", "revision": t["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    aw = r.json()["awards"][0]
    assert aw["terms"]["arrival"]["state"] == "confirmed" and aw["terms"]["arrival"]["planned_from"] == later
    assert aw["order_defaults"]["work_from"] == later  # the work order takes the confirmed date
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order", json={"request_key": f"ord-{uuid.uuid4().hex[:16]}"}, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    tk = s4.c.get(f"{API}/tickets/{r.json()['ticket']['id']}", headers=s4.h("joni")).json()
    assert "מועד הגעה" in tk["description"] and "אושר" in tk["description"] and "לוח תשלומים מאושר: תשלום סופי - בסיום העבודה" in tk["description"]
    assert "₪" not in tk["description"] and str(a["total_minor"] // 100) not in tk["description"]


def test_the_reminder_uses_the_existing_purpose_and_stops_after_two(s4):
    switch(s4, hours=24)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    assert pquote(c, tok).status_code == 201
    body = award(s4, d["id"], v1).json()
    a = body["award"]
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    with s4.db.connection() as conn:
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=48)) == 0  # never messaged yet: no clock, no reminder
    draft = body["message_draft"]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v1}/messages", json={"text": draft["text"], "notify": True,
                                                                              "source": draft["send"]["source"]}, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    with s4.db.connection() as conn:
        assert store_rfq.terms(conn, a["id"])["requested_at"]
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=23)) == 0
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=25)) == 1
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=26)) == 0  # spaced by the same delay
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=50)) == 1
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=100)) == 0  # at most two
        purposes = [r[0] for r in conn.execute("SELECT purpose FROM ticket_outbox WHERE rfq_id = ? ORDER BY created_at", (d["id"],))]
    assert purposes.count("rfq_update") == 3 and set(purposes) <= {"rfq_invite", "rfq_update"}  # the award notice + two reminders
    v = view(c, tok)
    assert sum(1 for m in v["messages"] if not m["mine"]) == 3
    assert arrival(c, tok).status_code == 200
    with s4.db.connection() as conn:
        store_rfq.update_terms(conn, a["id"], {"reminders": 0, "reminded_at": None})
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=200)) == 0  # confirmed: never reminded


def test_purge_removes_the_terms_and_an_ordered_quote_keeps_its_schedule(s4):
    switch(s4)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    assert pquote(c, tok, payment=PLAN).status_code == 201
    a = award(s4, d["id"], v1, payment_source="vendor").json()["award"]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order", json={"request_key": f"ord-{uuid.uuid4().hex[:16]}"}, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    assert "טרם אושר על ידי הספק" in s4.c.get(f"{API}/tickets/{r.json()['ticket']['id']}", headers=s4.h("joni")).json()["description"]
    assert arrival(c, tok).status_code == 200
    with s4.db.connection(mode="read") as conn:
        kinds = [r[0] for r in conn.execute("SELECT kind FROM ticket_events WHERE ticket_id = ?", (r.json()["ticket"]["id"],))]
    assert "rfq_arrival_confirmed" in kinds  # the confirmation reaches the order's timeline
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}")
    assert r.status_code in (200, 204), r.text
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_rfq_award_terms").fetchone()[0] == 0
        kept = conn.execute("SELECT payment_schedule_json FROM ticket_quotes WHERE id = ?", (a["quote_id"],)).fetchone()[0]
    assert json.loads(kept)["total_minor"] == a["total_minor"]


def test_the_settings_reject_bad_values_and_the_public_route_is_on_the_edge(s4):
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    for bad in ({"schedule_arrival": "yes"}, {"arrival_reminder_hours": 500}, {"arrival_reminder_hours": -1}):
        assert s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": bad}).status_code == 422, bad
    doc = s4.c.get(f"{API}/tickets/settings").json()
    assert doc["rfq"]["schedule_arrival"] is False and doc["rfq"]["arrival_reminder_hours"] == 24
    from smplwise.services.tickets import public_http

    assert any(r.method == "POST" and r.regex.fullmatch("/t/api/rfq/arrival") and r.kind == "token_write" for r in public_http.ROUTES)
    c = pub(s4, Clock(time.time()))
    r = c.post("/t/api/rfq/arrival", json={"action": "confirm", "acknowledge_schedule": True, "client_request_id": crid()}, headers=hdr("A" * 32))
    assert r.status_code == 404 and r.json() == {"code": "link_unavailable"}


# ---------------------------------------------------------------- review RELEASE_264_REVIEW_RFQPAY fixes (negative first)

def _rows(s4, sql: str, *args):
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def test_f1_an_award_over_a_proposal_must_carry_an_explicit_payment_choice(s4):
    """F1: when the vendor proposed instalments, silence never approves them - the body carries `payment` (an explicit plan) or
    `payment_source` (`vendor` = his proposal as is, `default` = one final instalment); omission is 422 `payment` `required`."""
    switch(s4)
    d = sent_rfq(s4)
    v1, v2 = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    c = pub(s4)
    assert pquote(c, token(s4, v1), payment=PLAN).status_code == 201
    assert pquote(c, token(s4, v2)).status_code == 201  # no proposal
    r = award(s4, d["id"], v1)  # a stale tab / an old client: no explicit choice
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "payment", "code": "required"}], r.text
    r = award(s4, d["id"], v1, payment=PLAN, payment_source="vendor")
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "payment_source", "code": "conflict"}], r.text
    r = award(s4, d["id"], v1, payment_source="proposal")
    assert r.status_code == 422, r.text  # the router's strict literal
    r = award(s4, d["id"], v2, payment_source="vendor")
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "payment_source", "code": "no_proposal"}], r.text
    assert terms_rows(s4) == 0 and not detail(s4, d["id"])["awards"]
    r = award(s4, d["id"], v1, payment_source="default")
    assert r.status_code == 201, r.text
    sched = r.json()["award"]["terms"]["schedule"]
    assert sched["source"] == "default" and [i["kind"] for i in sched["items"]] == ["final"]


def test_f1_accepting_the_proposal_explicitly_approves_it(s4):
    switch(s4)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    assert pquote(pub(s4), token(s4, v1), payment=PLAN).status_code == 201
    r = award(s4, d["id"], v1, payment_source="vendor")
    assert r.status_code == 201, r.text
    assert r.json()["award"]["terms"]["schedule"]["source"] == "vendor"
    assert [i["kind"] for i in r.json()["award"]["terms"]["schedule"]["items"]] == ["advance", "progress", "final"]


def test_f3_f4_a_proposal_that_no_longer_fits_is_refused_with_a_specific_code(s4):
    """F3: the stored proposal's dates are re-checked at the award (a date now in the past is refused, as an edit would be). F4: a
    proposal that cannot convert on the APPROVED total answers `proposal_*` on its field, so the dialog opens the editor."""
    switch(s4)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    big = {"items": [{"kind": "advance", "amount": "5000", "due": "date", "date": _day(6)}, {"kind": "final", "due": "completion"}]}
    assert pquote(pub(s4), token(s4, v1), payment=big).status_code == 201
    r = award(s4, d["id"], v1, kinds=["labor"], payment_source="vendor")  # partial: labour only, below the fixed advance
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "payment.items", "code": "proposal_exceeds_total"}], r.text
    with s4.db.connection() as conn:
        qid = conn.execute("SELECT id FROM ticket_quotes WHERE rfq_vendor_id = ? AND state = 'submitted'", (v1,)).fetchone()[0]
        past = {"items": [{"kind": "advance", "percent_bp": 1000, "due": "date", "date": _day(-2)}, {"kind": "final", "due": "completion"}]}
        conn.execute("UPDATE ticket_quotes SET payment_plan_json = ? WHERE id = ?", (json.dumps(past), qid))
    r = award(s4, d["id"], v1, payment_source="vendor")
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "payment.items.0.date", "code": "proposal_date_passed"}], r.text
    with s4.db.connection() as conn:
        late_final = {"items": [{"kind": "final", "due": "date", "date": _day(-1)}]}
        conn.execute("UPDATE ticket_quotes SET payment_plan_json = ? WHERE id = ?", (json.dumps(late_final), qid))
    r = award(s4, d["id"], v1, payment_source="vendor")
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "payment.items.0.date", "code": "proposal_date_passed"}], r.text
    assert terms_rows(s4) == 0 and not detail(s4, d["id"])["awards"]


def _awarded_and_messaged(s4, notify: bool = True):
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    assert pquote(c, tok).status_code == 201
    body = award(s4, d["id"], v1).json()
    draft = body["message_draft"]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v1}/messages", json={"text": draft["text"], "notify": notify,
                                                                              "source": draft["send"]["source"]}, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    return d, v1, tok, c, body["award"]


def test_f6_the_clock_starts_only_on_a_notice_that_was_queued_and_a_final_award(s4, settings):
    switch(s4, hours=24)
    d, v1, tok, c, a = _awarded_and_messaged(s4, notify=False)  # written to the thread only: the vendor was not told
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    with s4.db.connection() as conn:
        assert store_rfq.terms(conn, a["id"])["requested_at"] is None
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=100)) == 0
    # a pending second approval: an award-sourced message never starts the clock
    bind(s4.c, settings, "lea", "system_admin", "installation", "*")
    assert s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": 100}).status_code == 200
    d2 = sent_rfq(s4)
    w1 = vid(d2, s4.vendor["id"])
    assert pquote(c, token(s4, w1)).status_code == 201
    a2 = award(s4, d2["id"], w1).json()["award"]
    assert a2["state"] == "pending_second"
    r = s4.c.post(f"{API}/tickets/rfqs/{d2['id']}/vendors/{w1}/messages", json={"text": "שלום", "notify": True,
                                                                               "source": {"kind": "award", "id": a2["id"]}}, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    with s4.db.connection() as conn:
        assert store_rfq.terms(conn, a2["id"])["requested_at"] is None


def test_f5_the_reminder_candidates_skip_exhausted_closed_and_recently_reminded_rows(s4):
    switch(s4, hours=24)
    d, v1, tok, c, a = _awarded_and_messaged(s4)
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=30)
    before = later - dt.timedelta(hours=24)
    from smplwise.services.tickets.costs import iso

    with s4.db.connection() as conn:
        assert [t["award_id"] for t in store_rfq.terms_waiting(conn, iso(before))] == [a["id"]]
        store_rfq.update_terms(conn, a["id"], {"reminded_at": iso(later)})  # reminded after `before`: not a candidate (spacing in SQL)
        assert store_rfq.terms_waiting(conn, iso(before)) == []
        store_rfq.update_terms(conn, a["id"], {"reminded_at": None, "reminders": rfq_terms.MAX_REMINDERS})
        assert store_rfq.terms_waiting(conn, iso(before)) == []  # exhausted rows never fill the batch
        store_rfq.update_terms(conn, a["id"], {"reminders": 0})
        conn.execute("UPDATE ticket_rfqs SET state = 'closed' WHERE id = ?", (d["id"],))
        assert store_rfq.terms_waiting(conn, iso(before)) == []  # a closed request is not a candidate
        conn.execute("UPDATE ticket_rfqs SET state = 'awarded' WHERE id = ?", (d["id"],))
        assert len(store_rfq.terms_waiting(conn, iso(before))) == 1


def test_f7_f9_reject_resets_the_reminders_offers_a_notice_and_a_past_window_cannot_be_accepted(s4):
    switch(s4, hours=24)
    d, v1, tok, c, a = _awarded_and_messaged(s4)
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    with s4.db.connection() as conn:
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=25)) == 1
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=50)) == 1  # both reminders spent before he proposed
    assert arrival(c, tok, action="propose", work_from=_at(12)).status_code == 200
    t = detail(s4, d["id"], "mona")["awards"][0]["terms"]
    assert t["draft"] is None  # nothing to tell him yet
    # F9: a proposed window that is already in the past is never confirmed
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_rfq_award_terms SET proposed_from = ? WHERE award_id = ?", (_at(-2), a["id"]))
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival", json={"action": "accept", "revision": t["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "arrival_date_passed", r.text
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival", json={"action": "reject", "revision": t["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    t = r.json()["awards"][0]["terms"]
    assert t["arrival"]["reminders"] == 0 and t["arrival"]["requested_at"] is None and t["arrival"]["state"] == "awaiting"
    draft = t["draft"]  # F7: the manager is offered the notice - nothing was sent by the reject itself
    assert draft["send"]["source"] == {"kind": "award", "id": a["id"]} and draft["text"]

    def outbox() -> list[str]:
        return [r["purpose"] for r in _rows(s4, "SELECT purpose FROM ticket_outbox WHERE rfq_id = ?", d["id"])]

    sent_before = outbox().count("rfq_update")
    with s4.db.connection() as conn:
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=200)) == 0  # no clock until he is told
    assert outbox().count("rfq_update") == sent_before
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v1}/messages", json={"text": draft["text"], "notify": True, "source": draft["send"]["source"]},
                  headers=s4.h("mona"))
    assert r.status_code == 201 and r.json()["notified"]["queued"] is True, r.text
    assert outbox().count("rfq_update") == sent_before + 1
    t = detail(s4, d["id"], "mona")["awards"][0]["terms"]
    assert t["draft"] is None and t["arrival"]["requested_at"]  # the clock restarts on the notice he actually got
    later = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    with s4.db.connection() as conn:
        assert rfq_terms.tick(conn, later + dt.timedelta(hours=25)) == 1  # one more nudge after the rejection


def test_f8_the_arrival_notification_is_resolved_on_confirmation_and_on_a_decision(s4):
    switch(s4)
    d, v1, tok, c, a = _awarded_and_messaged(s4)
    key = f"rfq:{d['id']}:arrival:{v1}"
    assert arrival(c, tok, action="propose", work_from=_at(12)).status_code == 200
    rows = _rows(s4, "SELECT state FROM notifications WHERE dedupe_key = ?", key)
    assert rows and rows[-1]["state"] != "resolved"  # waiting for a decision: open
    t = detail(s4, d["id"], "mona")["awards"][0]["terms"]
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival", json={"action": "reject", "revision": t["revision"]},
                     headers=s4.h("mona")).status_code == 200
    assert all(r["state"] == "resolved" for r in _rows(s4, "SELECT state FROM notifications WHERE dedupe_key = ?", key))
    assert arrival(c, tok).status_code == 200  # he confirms the planned window
    rows = _rows(s4, "SELECT state FROM notifications WHERE dedupe_key = ? ORDER BY created_at, rowid", key)
    assert len(rows) == 2 and all(r["state"] == "resolved" for r in rows)  # told, and nothing left open in the inbox


def test_f10_the_acknowledgement_is_bound_to_the_schedule_hash(s4):
    switch(s4)
    d, v1, tok, c, a = _awarded_and_messaged(s4)
    terms = view(c, tok)["terms"]
    h = terms["schedule"]["hash"]
    assert isinstance(h, str) and len(h) == 64
    r = arrival(c, tok, schedule_hash="0" * 64)  # he saw other terms (a stale page): nothing is acknowledged
    assert r.status_code == 409 and r.json() == {"code": "terms_changed"}, r.text
    with s4.db.connection(mode="read") as conn:
        assert store_rfq.terms(conn, a["id"])["acknowledged_at"] is None
    r = arrival(c, tok, schedule_hash=h)
    assert r.status_code == 200 and r.json()["terms"]["arrival"]["acknowledged_at"], r.text
    with s4.db.connection() as conn:
        assert store_rfq.terms(conn, a["id"])["acknowledged_hash"] == h
        conn.execute("UPDATE ticket_rfq_award_terms SET schedule_json = ? WHERE award_id = ?",
                     (json.dumps({**json.loads(store_rfq.terms(conn, a["id"])["schedule_json"]), "rounding": "changed"}), a["id"]))
    assert view(c, tok)["terms"]["arrival"]["acknowledged_at"] is None  # a changed schedule is not acknowledged
    assert detail(s4, d["id"], "mona")["awards"][0]["terms"]["arrival"]["acknowledged_at"] is None


def test_an_unconfirmed_arrival_after_both_reminders_is_escalated_once_and_the_order_is_not_blocked(s4):
    """Owner decision (lead, 2026-10-17): no confirmation one delay after the second reminder -> the RFQ managers are notified once;
    the work order can still be created."""
    switch(s4, hours=24)
    d, v1, tok, c, a = _awarded_and_messaged(s4)
    key = f"rfq:{d['id']}:arrival:{v1}"
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    with s4.db.connection() as conn:
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=25)) == 1
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=50)) == 1
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=60)) == 0  # not yet one delay after the last reminder
    assert _rows(s4, "SELECT id FROM notifications WHERE dedupe_key = ?", key) == []
    with s4.db.connection() as conn:
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=75)) == 0  # no third reminder ...
        assert store_rfq.terms(conn, a["id"])["escalated_at"]  # ... but the managers are told
        assert rfq_terms.tick(conn, now + dt.timedelta(hours=200)) == 0
    rows = _rows(s4, "SELECT state, title FROM notifications WHERE dedupe_key = ?", key)
    assert len(rows) == 1 and rows[0]["state"] != "resolved", rows  # once
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order", json={"request_key": f"ord-{uuid.uuid4().hex[:16]}"}, headers=s4.h("mona"))
    assert r.status_code == 201, r.text  # never blocked
    assert arrival(c, tok).status_code == 200
    assert all(x["state"] == "resolved" for x in _rows(s4, "SELECT state FROM notifications WHERE dedupe_key = ?", key))


def test_the_reminder_message_has_a_distinct_system_author(s4):
    """rfq-thread-system-author: the manager's thread shows the system's own message under a 'System' author, not a user id."""
    from smplwise.services.tickets import rfq

    switch(s4, hours=24)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    with s4.db.connection() as conn:
        at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
        sysm = store_rfq.insert_message(conn, {"rfq_id": d["id"], "rfq_vendor_id": v1, "direction": "out", "body": "reminder",
                                               "author_kind": "user", "author_id": "system", "source_kind": "award", "source_id": None, "created_at": at})
        shown = rfq.present_message(conn, next(m for m in store_rfq.messages_of_vendor(conn, v1) if m["id"] == sysm))
    assert shown["system"] is True and shown["by"] == "מערכת"
