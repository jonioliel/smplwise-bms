"""RFQPAY2 (docs/changes/CR-RFQ-PAYMENT-SCHEDULE.md section 8; RFQ contract 20.11 - 20.13): the three items the owner approved after
v1.4.1 - a payment demand per approved instalment (manual, idempotent), the overdue-instalment notification, and a manager moving an
instalment's planned date after the award - over the REAL store, the real internal API and the real public app.

Negative cases first: no terms (switch off), the wrong person (no costs permission: an audited 403; another department: the uniform 404),
an instalment without a date, a past / malformed / out-of-order day, a stale revision, a demand action without a demand, a paid
demand cancelled, a zero instalment; then the flows. Every name and number here is invented."""
from __future__ import annotations

import datetime as dt
import json

from smplwise.services.tickets import rfq_notify, rfq_terms, store_rfq
from test_tickets_rfq_public import detail, pub, sent_rfq, token, vid, view
from test_tickets_rfq_terms import PLAN, _day, arrival, award, pquote, s4, switch  # noqa: F401 - s4 is the fixture
from tickets_s4_world import API


def _rows(s4, sql: str, *args):
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def _awarded(s4, plan=PLAN):
    switch(s4)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    assert pquote(c, tok, payment=plan).status_code == 201
    r = award(s4, d["id"], v1, payment_source="vendor")
    assert r.status_code == 201, r.text
    return d, v1, tok, c, r.json()["award"]


def move(s4, rid: str, aid: str, index: int, date, user: str = "kim", revision: int | None = None, **body):
    if revision is None:
        revision = next(a for a in detail(s4, rid, "kim")["awards"] if a["id"] == aid)["terms"]["revision"]
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/awards/{aid}/instalments/{index}/date", json={"date": date, "revision": revision, **body},
                     headers=s4.h(user))


def demand(s4, rid: str, aid: str, index: int, action: str = "create", user: str = "kim"):
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/awards/{aid}/instalments/{index}/demand", json={"action": action}, headers=s4.h(user))


def terms_of(s4, rid: str, user: str = "kim") -> dict:
    return detail(s4, rid, user)["awards"][0]["terms"]


def _key(d, a) -> str:
    return f"rfqpay:{d['id']}:{a['id']}"


# ---------------------------------------------------------------- negative first

def test_without_terms_the_payment_routes_answer_terms_not_found(s4):
    from test_tickets_rfq_public import QUOTE  # noqa: F401 - the default quote lines (via pquote)

    d = sent_rfq(s4)  # the switch is OFF (the default): the award has no terms
    v1 = vid(d, s4.vendor["id"])
    assert pquote(pub(s4), token(s4, v1)).status_code == 201
    a = award(s4, d["id"], v1).json()["award"]
    assert a["terms"] is None
    r = demand(s4, d["id"], a["id"], 0)
    assert r.status_code == 404 and r.json()["code"] == "terms_not_found", r.text
    r = move(s4, d["id"], a["id"], 0, _day(9), revision=1)
    assert r.status_code == 404 and r.json()["code"] == "terms_not_found", r.text
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/instalments/6/demand", json={"action": "create"}, headers=s4.h("kim"))
    assert r.status_code == 422  # the index range of the route
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/instalments/0/demand", json={"action": "pay", "amount": 1}, headers=s4.h("kim"))
    assert r.status_code == 422  # strict body: no amount is ever accepted from the client


def test_only_a_costs_decider_may_demand_or_move_and_others_learn_nothing(s4):
    d, v1, tok, c, a = _awarded(s4)
    t = terms_of(s4, d["id"])
    assert t["can"]["demand"] is True and t["can"]["reschedule"] is True
    assert terms_of(s4, d["id"], "mona")["can"] == {"decide_arrival": False, "reschedule": False, "demand": False, "reschedule_arrival": False,
                                                    "notify_vendor": False}
    assert terms_of(s4, d["id"], "mona")["notice"] is None
    r = demand(s4, d["id"], a["id"], 0, user="mona")  # an RFQ manager without tickets.costs: an audited 403
    assert r.status_code == 403 and r.json()["details"]["reason"] == "costs_permission_missing", r.text
    r = move(s4, d["id"], a["id"], 0, _day(7), user="mona", revision=t["revision"])
    assert r.status_code == 403, r.text
    for user in ("cleo",):  # another department: the uniform 404 of the request
        assert demand(s4, d["id"], a["id"], 0, user=user).status_code == 404
        assert move(s4, d["id"], a["id"], 0, _day(7), user=user, revision=t["revision"]).status_code == 404
    denied = _rows(s4, "SELECT action FROM audit_log WHERE decision = 'denied' AND action LIKE 'ticket.rfq.instalment_%'")
    assert {x["action"] for x in denied} == {"ticket.rfq.instalment_demand", "ticket.rfq.instalment_reschedule"}
    assert _rows(s4, "SELECT id FROM ticket_rfq_instalment_demands") == []


def test_a_move_is_refused_for_an_undated_past_out_of_order_or_stale_instalment(s4):
    d, v1, tok, c, a = _awarded(s4)  # advance day 6, progress day 8, final 30 days after completion
    t = terms_of(s4, d["id"])
    rev = t["revision"]
    cases = [(2, _day(9), 409, "instalment_not_dated"), (0, _day(-1), 422, "range"), (0, "9.11.2026", 422, "format"),
             (0, _day(400), 422, "range"), (0, _day(9), 422, "order"), (1, _day(5), 422, "order"), (5, _day(7), 404, "instalment_not_found")]
    for index, day, status, code in cases:
        r = move(s4, d["id"], a["id"], index, day, revision=rev)
        got = r.json()["details"]["fields"][0]["code"] if status == 422 else r.json()["code"]
        assert (r.status_code, got) == (status, code), (index, day, r.text)
    r = move(s4, d["id"], a["id"], 0, _day(7), revision=rev + 5)
    assert r.status_code == 409 and r.json()["code"] == "rfq_stale"
    assert terms_of(s4, d["id"])["revision"] == rev and _rows(s4, "SELECT id FROM audit_log WHERE action = 'ticket.rfq.instalment_reschedule' "
                                                                      "AND decision = 'allowed'") == []


def test_demand_refusals_without_a_demand_after_payment_and_for_a_zero_instalment(s4):
    full = {"items": [{"kind": "advance", "percent": "100", "due": "date", "date": _day(6)}, {"kind": "final", "due": "completion"}]}
    d, v1, tok, c, a = _awarded(s4, full)
    for action in ("paid", "cancel"):
        r = demand(s4, d["id"], a["id"], 0, action)
        assert r.status_code == 404 and r.json()["code"] == "demand_not_found", r.text
    r = demand(s4, d["id"], a["id"], 1)  # the final instalment is 0 (100 % in advance)
    assert r.status_code == 409 and r.json()["code"] == "demand_zero_amount", r.text
    assert demand(s4, d["id"], a["id"], 0).status_code == 200
    assert demand(s4, d["id"], a["id"], 0, "paid").status_code == 200
    r = demand(s4, d["id"], a["id"], 0, "cancel")
    assert r.status_code == 409 and r.json()["code"] == "demand_paid", r.text
    r = move(s4, d["id"], a["id"], 0, _day(7))
    assert r.status_code == 409 and r.json()["code"] == "instalment_paid", r.text


# ---------------------------------------------------------------- the demand per instalment

def test_a_demand_is_made_from_the_schedule_row_once_then_paid_or_cancelled_and_nothing_is_sent(s4):
    d, v1, tok, c, a = _awarded(s4)
    outbox_before = len(_rows(s4, "SELECT id FROM ticket_outbox WHERE rfq_id = ?", d["id"]))
    sched = terms_of(s4, d["id"])["schedule"]
    r1 = demand(s4, d["id"], a["id"], 0)
    assert r1.status_code == 200 and r1.json()["created"] is True, r1.text
    dm = r1.json()["demand"]
    assert dm["status"] == "open" and dm["amount_minor"] == sched["items"][0]["amount_minor"] and dm["due_date"] == _day(6)
    r2 = demand(s4, d["id"], a["id"], 0)  # the same row again (a double click, a second tab): the existing demand
    assert r2.status_code == 200 and r2.json()["created"] is False and r2.json()["demand"]["id"] == dm["id"]
    assert len(_rows(s4, "SELECT id FROM ticket_rfq_instalment_demands")) == 1
    assert len(_rows(s4, "SELECT id FROM audit_log WHERE action = 'ticket.rfq.instalment_demand' AND decision = 'allowed'")) == 1
    item = r2.json()["rfq"]["awards"][0]["terms"]["schedule"]["items"][0]
    assert item["demand"]["status"] == "open" and item["demand"]["id"] == dm["id"]
    # the final instalment (after completion, the job not done): a demand without a due day yet
    r = demand(s4, d["id"], a["id"], 2)
    assert r.status_code == 200 and r.json()["demand"]["due_date"] is None
    assert demand(s4, d["id"], a["id"], 2, "cancel").json()["demand"]["status"] == "cancelled"
    r = demand(s4, d["id"], a["id"], 2, "paid")
    assert r.status_code == 409 and r.json()["code"] == "demand_cancelled"
    r = demand(s4, d["id"], a["id"], 2)  # reopened from the row
    assert r.json()["created"] is True and r.json()["demand"]["status"] == "open"
    paid = demand(s4, d["id"], a["id"], 0, "paid")
    assert paid.status_code == 200 and paid.json()["demand"]["status"] == "paid" and paid.json()["demand"]["paid_at"]
    assert demand(s4, d["id"], a["id"], 0, "paid").status_code == 200  # again: no change
    kinds = [e["kind"] for e in detail(s4, d["id"], "mona")["timeline"]]
    assert kinds.count("instalment_demand_created") == 3 and kinds.count("instalment_paid") == 1 and kinds.count("instalment_demand_cancelled") == 1
    audits = [json.loads(x["details_json"]) for x in _rows(s4, "SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.instalment_demand'")]
    assert all("amount" not in json.dumps(x) and "total" not in json.dumps(x) for x in audits)  # ids and the action only
    assert len(_rows(s4, "SELECT id FROM ticket_outbox WHERE rfq_id = ?", d["id"])) == outbox_before  # nothing sent to anyone
    # a viewer without tickets.costs.view sees the status, never the amount
    mona = terms_of(s4, d["id"], "mona")["schedule"]["items"][0]["demand"]
    assert mona["status"] == "paid" and mona["amount_minor"] is None
    assert "demand" not in json.dumps(view(c, tok)["terms"])  # the vendor's page carries no demand data


# ---------------------------------------------------------------- moving an instalment's date

def test_a_moved_date_is_audited_shown_to_the_vendor_as_changed_and_keeps_his_acknowledgement(s4):
    d, v1, tok, c, a = _awarded(s4)
    assert arrival(c, tok).status_code == 200  # he confirmed the arrival and acknowledged the schedule
    before = view(c, tok)["terms"]
    assert before["arrival"]["acknowledged_at"] and [i["date_changed"] for i in before["schedule"]["items"]] == [False, False, False]
    assert demand(s4, d["id"], a["id"], 1).status_code == 200  # an open demand follows the move
    r = move(s4, d["id"], a["id"], 1, _day(10), reason="הספק ביקש לדחות")
    assert r.status_code == 200, r.text
    item = r.json()["awards"][0]["terms"]["schedule"]["items"][1]
    assert item["date"] == _day(10) and item["agreed_date"] == _day(8) and item["date_changed_at"] and item["demand"]["due_date"] == _day(10)
    after = view(c, tok)["terms"]
    assert after["schedule"]["items"][1]["date"] == _day(10) and after["schedule"]["items"][1]["date_changed"] is True
    assert after["schedule"]["hash"] == before["schedule"]["hash"] and after["arrival"]["acknowledged_at"] == before["arrival"]["acknowledged_at"]
    assert set(after["schedule"]["items"][1]) == {"kind", "amount_minor", "due", "date", "days", "date_changed"}  # no agreed day, no reason
    ev = next(e for e in detail(s4, d["id"], "mona")["timeline"] if e["kind"] == "instalment_rescheduled")
    assert ev["data"]["from"] == _day(8) and ev["data"]["to"] == _day(10) and ev["data"]["reason"] == "הספק ביקש לדחות"
    audit = json.loads(_rows(s4, "SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.instalment_reschedule' AND decision = 'allowed'")[0]["details_json"])
    assert audit["from_date"] == _day(8) and audit["to_date"] == _day(10) and audit["has_reason"] is True and "amount" not in json.dumps(audit)
    with s4.db.connection(mode="read") as conn:
        q = json.loads(conn.execute("SELECT payment_schedule_json FROM ticket_quotes WHERE id = ?", (a["quote_id"],)).fetchone()[0])
    assert q["items"][1]["date"] == _day(10)  # the demand check's basis follows
    # a second move keeps the AGREED day; moving back to it clears the marker
    assert move(s4, d["id"], a["id"], 1, _day(12)).json()["awards"][0]["terms"]["schedule"]["items"][1]["agreed_date"] == _day(8)
    back = move(s4, d["id"], a["id"], 1, _day(8)).json()["awards"][0]["terms"]["schedule"]["items"][1]
    assert back["agreed_date"] is None and back["date_changed_at"] is None
    assert view(c, tok)["terms"]["schedule"]["items"][1]["date_changed"] is False
    with s4.db.connection(mode="read") as conn:
        t = store_rfq.terms(conn, a["id"])
        assert rfq_terms.schedule_hash(t) == before["schedule"]["hash"]


# ---------------------------------------------------------------- the overdue notification

def _backdate(s4, a: dict, index: int, days: int) -> None:
    """Move an approved instalment's day into the past directly in the store (the API refuses a past day by design)."""
    with s4.db.connection() as conn:
        t = store_rfq.terms(conn, a["id"])
        sched = json.loads(t["schedule_json"])
        sched["items"][index]["date"] = _day(days)
        sj = store_rfq.dumps(sched)
        conn.execute("UPDATE ticket_rfq_award_terms SET schedule_json = ? WHERE award_id = ?", (sj, a["id"]))
        conn.execute("UPDATE ticket_quotes SET payment_schedule_json = ? WHERE id = ?", (sj, a["quote_id"]))


def _tick(s4) -> int:
    with s4.db.connection() as conn:
        return rfq_terms.overdue_tick(conn, dt.datetime.now(dt.timezone.utc))


def _states(s4, key: str) -> list[str]:
    return [r["state"] for r in _rows(s4, "SELECT state FROM notifications WHERE dedupe_key = ? ORDER BY first_at, rowid", key)]


def test_an_overdue_instalment_is_signalled_once_with_a_count_and_resolved_when_paid(s4):
    d, v1, tok, c, a = _awarded(s4)
    key = _key(d, a)
    _backdate(s4, a, 0, 0)
    assert _tick(s4) == 0 and _states(s4, key) == []  # the due day itself is not overdue
    _backdate(s4, a, 0, -2)
    assert _tick(s4) == 1
    assert _tick(s4) == 0  # nothing new: no second signal
    rows = _rows(s4, "SELECT * FROM notifications WHERE dedupe_key = ?", key)
    assert len(rows) == 1 and rows[0]["state"] == "open" and rows[0]["source"] == "rfq.instalment_overdue" and rows[0]["count"] == 1
    text = rows[0]["title"] + rows[0]["body"]
    names = [str(s4.vendor[k]) for k in ("company", "display_name", "first_name", "last_name", "name") if s4.vendor.get(k)]
    assert names and not any(n in text for n in names)  # never the vendor's name
    assert " 1 " in f" {rows[0]['body']} " and "₪" not in text  # a count, never an amount
    assert json.loads(rows[0]["origin_json"])["audience"] == "costs"
    assert terms_of(s4, d["id"])["schedule"]["items"][0]["overdue"] is True
    _backdate(s4, a, 1, -1)
    assert _tick(s4) == 1  # the progress instalment joins: raised again, with the new count
    rows = _rows(s4, "SELECT * FROM notifications WHERE dedupe_key = ? ORDER BY first_at, rowid", key)
    assert rows[-1]["state"] != "resolved" and " 2 " in f" {rows[-1]['body']} "
    # the manager's acts update the signal at once: paying one leaves one overdue (no new signal), paying the other resolves it
    assert demand(s4, d["id"], a["id"], 0).status_code == 200
    assert demand(s4, d["id"], a["id"], 0, "paid").status_code == 200
    with s4.db.connection(mode="read") as conn:
        assert store_rfq.terms(conn, a["id"])["overdue_key"] == "1"
    assert _states(s4, key)[-1] != "resolved"
    assert demand(s4, d["id"], a["id"], 1).status_code == 200
    assert demand(s4, d["id"], a["id"], 1, "paid").status_code == 200
    with s4.db.connection(mode="read") as conn:
        assert store_rfq.terms(conn, a["id"])["overdue_key"] is None
    assert set(_states(s4, key)) == {"resolved"}
    assert _tick(s4) == 0


def test_a_cancelled_demand_does_not_settle_but_a_later_date_does(s4):
    d, v1, tok, c, a = _awarded(s4)
    key = _key(d, a)
    _backdate(s4, a, 0, -1)
    assert demand(s4, d["id"], a["id"], 0).status_code == 200  # the manager's act itself brings the signal up to date
    assert _states(s4, key) == ["open"]
    assert demand(s4, d["id"], a["id"], 0, "cancel").status_code == 200
    assert _states(s4, key) == ["open"] and _tick(s4) == 0  # a withdrawn demand: the money is still owed (still signalled)
    assert move(s4, d["id"], a["id"], 0, _day(8)).status_code == 200  # moved to the progress day (in order): nothing overdue
    with s4.db.connection(mode="read") as conn:
        assert store_rfq.terms(conn, a["id"])["overdue_key"] is None
    assert set(_states(s4, key)) == {"resolved"}


def test_the_overdue_signal_reaches_only_managers_who_see_costs_and_ends_with_the_switch_or_a_cancel(s4):
    d, v1, tok, c, a = _awarded(s4)
    key = _key(d, a)
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_rfqs SET internal_owner_user_id = 'dev-kim' WHERE id = ?", (d["id"],))  # an RFQ manager who sees costs
        everyone = rfq_notify.recipient_users(conn, {"origin": {"rfq_id": d["id"]}})
        costs = rfq_notify.recipient_users(conn, {"origin": {"rfq_id": d["id"], "audience": "costs"}})
    assert {"dev-mona", "dev-kim"} <= set(everyone) and "dev-mona" not in costs and "dev-kim" in costs and set(costs) <= set(everyone)
    _backdate(s4, a, 0, -1)
    assert _tick(s4) == 1
    switch(s4, on=False)  # the switch off: the janitor resolves what it raised
    assert _tick(s4) == 0 and set(_states(s4, key)) == {"resolved"}
    switch(s4, on=True)
    assert _tick(s4) == 1
    with s4.db.connection() as conn:
        rfq_notify.payments_ended(conn, d["id"])  # what cancel / delete / purge call
    assert set(_states(s4, key)) == {"resolved"}


def test_the_retention_janitor_runs_the_overdue_scan(s4):
    d, v1, tok, c, a = _awarded(s4)
    _backdate(s4, a, 0, -1)
    from smplwise.services.tickets import rfq

    with s4.db.connection() as conn:
        out = rfq.retention(conn, dt.datetime.now(dt.timezone.utc))
    assert out["instalments_overdue"] == 1


# ---------------------------------------------------------------- owner decisions 2026-10-17: the optional vendor notice (20.13) and the
# ---------------------------------------------------------------- arrival window moved after the award (20.14)

def move_arrival(s4, rid: str, aid: str, work_from, user: str = "kim", revision: int | None = None, **body):
    if revision is None:
        revision = next(a for a in detail(s4, rid, "kim")["awards"] if a["id"] == aid)["terms"]["revision"]
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/awards/{aid}/arrival/date", json={"work_from": work_from, "revision": revision, **body},
                     headers=s4.h(user))


def _outbox(s4, rid: str) -> list[str]:
    return [r["purpose"] for r in _rows(s4, "SELECT purpose FROM ticket_outbox WHERE rfq_id = ? ORDER BY rowid", rid)]


def _own(s4, rid: str, uid: str = "dev-kim") -> None:
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_rfqs SET internal_owner_user_id = ? WHERE id = ?", (uid, rid))


def test_an_arrival_move_is_refused_for_the_wrong_person_a_bad_window_a_stale_revision_or_a_finished_job(s4):
    import uuid

    from test_tickets_rfq_terms import _at

    d, v1, tok, c, a = _awarded(s4)
    rev = terms_of(s4, d["id"])["revision"]
    r = move_arrival(s4, d["id"], a["id"], _at(9), user="mona", revision=rev)  # an RFQ manager without tickets.costs
    assert r.status_code == 403 and r.json()["details"]["reason"] == "costs_permission_missing", r.text
    assert move_arrival(s4, d["id"], a["id"], _at(9), user="cleo", revision=rev).status_code == 404
    for body, code in ((_at(-2), "range"), (_at(400), "range"), ("nonsense", None)):
        r = move_arrival(s4, d["id"], a["id"], body, revision=rev)
        assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "work_from", (body, r.text)
        if code:
            assert r.json()["details"]["fields"][0]["code"] == code
    r = move_arrival(s4, d["id"], a["id"], _at(9), revision=rev, work_to=_at(8))
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "work_to", "code": "order"}], r.text
    r = move_arrival(s4, d["id"], a["id"], _at(9), revision=rev + 3)
    assert r.status_code == 409 and r.json()["code"] == "rfq_stale"
    r = move_arrival(s4, d["id"], a["id"], _at(9), revision=rev, message="שלום")  # a text without the tick would be dropped silently
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "message", "code": "not_allowed"}], r.text
    _own(s4, d["id"])
    r = move_arrival(s4, d["id"], a["id"], _at(9), revision=rev, notify_vendor=True, message="   ")
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "message", r.text
    t = terms_of(s4, d["id"])
    assert t["revision"] == rev and not t["arrival"]["changed_at"]  # nothing was written
    # the work was marked done: the arrival is history
    o = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order", json={"request_key": f"ord-{uuid.uuid4().hex[:16]}"}, headers=s4.h("mona"))
    assert o.status_code == 201, o.text
    with s4.db.connection() as conn:
        conn.execute("UPDATE tickets SET done_at = ? WHERE id = ?", (_at(0), o.json()["ticket"]["id"]))
    t = terms_of(s4, d["id"])
    assert t["can"]["reschedule_arrival"] is False
    r = move_arrival(s4, d["id"], a["id"], _at(9), revision=t["revision"])
    assert r.status_code == 409 and r.json()["code"] == "work_done", r.text


def test_the_manager_moves_the_arrival_the_vendor_sees_it_marked_and_is_told_only_when_chosen(s4):
    from test_tickets_rfq_terms import _at

    d, v1, tok, c, a = _awarded(s4)
    assert arrival(c, tok).status_code == 200  # he confirmed the planned window
    before = _outbox(s4, d["id"]).count("rfq_update")
    r = move_arrival(s4, d["id"], a["id"], _at(9), reason="שינוי בלוח הזמנים")  # default: the vendor is NOT told
    assert r.status_code == 200, r.text
    ar = r.json()["awards"][0]["terms"]["arrival"]
    assert ar["planned_from"] == _at(9) and ar["state"] == "confirmed" and ar["confirmed_by"] == "manager" and ar["changed_at"]
    assert _outbox(s4, d["id"]).count("rfq_update") == before
    v = view(c, tok)["terms"]["arrival"]
    assert v["changed"] is True and v["planned_from"] == _at(9)
    ev = next(e for e in detail(s4, d["id"], "mona")["timeline"] if e["kind"] == "arrival_rescheduled")
    assert ev["data"]["to"] == _at(9) and ev["data"]["reason"] == "שינוי בלוח הזמנים"
    audit = json.loads(_rows(s4, "SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.arrival_reschedule' AND decision = 'allowed'")[0]["details_json"])
    assert audit["to_date"] == _at(9) and audit["has_reason"] is True and audit["vendor_notified"] is False
    rev = terms_of(s4, d["id"])["revision"]
    assert move_arrival(s4, d["id"], a["id"], _at(9)).status_code == 200 and terms_of(s4, d["id"])["revision"] == rev  # same window: no write
    # the chosen notice: the manager's edited text in the thread + the templated rfq_update (the F7 path), in the same act
    _own(s4, d["id"])
    notice = terms_of(s4, d["id"])["notice"]
    assert notice["arrival"] and notice["notify_default"] is False and "₪" not in notice["arrival"]
    r = move_arrival(s4, d["id"], a["id"], _at(11), notify_vendor=True, message=notice["arrival"] + " תודה.")
    assert r.status_code == 200, r.text
    assert _outbox(s4, d["id"]).count("rfq_update") == before + 1
    bodies = [m["body"] for m in _rows(s4, "SELECT body FROM ticket_rfq_messages WHERE rfq_vendor_id = ? AND direction = 'out' ORDER BY rowid", v1)]
    assert bodies[-1] == notice["arrival"] + " תודה."
    audits = [json.loads(x["details_json"]) for x in _rows(s4, "SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.arrival_reschedule' "
                                                               "AND decision = 'allowed' ORDER BY rowid")]
    assert audits[-1]["vendor_notified"] is True


def test_moving_the_arrival_supersedes_a_pending_proposal(s4):
    from test_tickets_rfq_terms import _at

    d, v1, tok, c, a = _awarded(s4)
    assert arrival(c, tok, action="propose", work_from=_at(12)).status_code == 200
    key = f"rfq:{d['id']}:arrival:{v1}"
    assert _rows(s4, "SELECT state FROM notifications WHERE dedupe_key = ?", key)[-1]["state"] != "resolved"
    r = move_arrival(s4, d["id"], a["id"], _at(10))
    assert r.status_code == 200, r.text
    ar = r.json()["awards"][0]["terms"]["arrival"]
    assert ar["state"] == "awaiting" and ar["proposed_from"] is None and ar["planned_from"] == _at(10)
    assert all(x["state"] == "resolved" for x in _rows(s4, "SELECT state FROM notifications WHERE dedupe_key = ?", key))
    v = view(c, tok)["terms"]
    assert v["can"]["confirm"] is True and v["arrival"]["changed"] is True  # he confirms the new window


def test_an_instalment_move_tells_the_vendor_only_when_chosen_and_only_by_a_manager_who_may_message(s4, monkeypatch):
    from smplwise.services.tickets import access

    d, v1, tok, c, a = _awarded(s4)
    sent = _outbox(s4, d["id"]).count("rfq_update")
    with monkeypatch.context() as m:  # a costs decider who is NOT an RFQ manager of this request (the vendor-message rule)
        m.setattr(access.Viewer, "is_manager", lambda self, row: False)
        assert terms_of(s4, d["id"])["notice"] is None and terms_of(s4, d["id"])["can"]["notify_vendor"] is False
        r = move(s4, d["id"], a["id"], 0, _day(7), notify_vendor=True, message="x")
        assert r.status_code == 403 and r.json()["details"]["reason"] == "not_manager", r.text
        assert move(s4, d["id"], a["id"], 0, _day(7)).status_code == 200  # without the tick the costs permission is enough
    assert terms_of(s4, d["id"])["schedule"]["items"][0]["date"] == _day(7)
    assert _outbox(s4, d["id"]).count("rfq_update") == sent
    t = terms_of(s4, d["id"])
    notice = t["notice"]
    assert notice["instalment"] and t["can"]["notify_vendor"] is True
    r = move(s4, d["id"], a["id"], 0, _day(6), notify_vendor=True, message="   ")  # the edited text is a real message (all or nothing)
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "message", r.text
    assert terms_of(s4, d["id"])["schedule"]["items"][0]["date"] == _day(7)
    r = move(s4, d["id"], a["id"], 1, _day(9), notify_vendor=True, message=notice["instalment"])
    assert r.status_code == 200, r.text
    assert _outbox(s4, d["id"]).count("rfq_update") == sent + 1
    bodies = [m["body"] for m in _rows(s4, "SELECT body FROM ticket_rfq_messages WHERE rfq_vendor_id = ? AND direction = 'out' ORDER BY rowid", v1)]
    assert bodies[-1] == notice["instalment"]
    keys = [k["idempotency_key"] for k in _rows(s4, "SELECT idempotency_key FROM ticket_outbox WHERE rfq_id = ? AND purpose = 'rfq_update'", d["id"])]
    assert keys and all(k.startswith(("rfqmsg:", "rfqarr:")) for k in keys)  # the existing message key - one notice per thread message


# ---------------------------------------------------------------- owner decision 2026-10-17: the overdue reminder is not annoying

def _set_rfq(s4, **keys):
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    return s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": keys})


def test_the_reminder_interval_setting_refuses_out_of_range_values_and_defaults_to_24(s4):
    for bad in (169, -1, "24", 2.5, True):
        r = _set_rfq(s4, instalment_reminder_hours=bad)
        assert r.status_code == 422, (bad, r.text)
    assert s4.c.get(f"{API}/tickets/settings").json()["rfq"]["instalment_reminder_hours"] == 24
    r = _set_rfq(s4, instalment_reminder_hours=0)
    assert r.status_code == 200 and r.json()["rfq"]["instalment_reminder_hours"] == 0, r.text


def test_the_overdue_signal_repeats_only_after_the_interval_and_0_means_once(s4):
    d, v1, tok, c, a = _awarded(s4)
    assert _set_rfq(s4, instalment_reminder_hours=12).status_code == 200
    _backdate(s4, a, 0, -1)
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)

    def tick(hours: float) -> int:
        with s4.db.connection() as conn:
            return rfq_terms.overdue_tick(conn, now + dt.timedelta(hours=hours))

    assert tick(0) == 1
    assert tick(1) == 0 and tick(11.5) == 0  # still overdue, the interval has not passed: no re-notify
    assert tick(12) == 1  # the interval passed and it is still overdue: notified again
    assert tick(13) == 0 and tick(23.9) == 0
    assert tick(24.1) == 1
    with s4.db.connection(mode="read") as conn:
        assert store_rfq.terms(conn, a["id"])["overdue_notified_at"]
    rows = _rows(s4, "SELECT count, state FROM notifications WHERE dedupe_key = ?", _key(d, a))
    assert rows and rows[-1]["state"] != "resolved" and sum(r["count"] for r in rows) >= 3  # through the engine, folded per award
    # 0 = once only: no repeat however long it stays overdue; a NEW overdue instalment still notifies
    assert _set_rfq(s4, instalment_reminder_hours=0).status_code == 200
    assert tick(100) == 0 and tick(150) == 0  # (before the progress instalment's own day, 8 days out)
    _backdate(s4, a, 1, -1)
    assert tick(501) == 1 and tick(900) == 0
    # paid: resolved, and the memory of the last notice is cleared
    for i in (0, 1):
        assert demand(s4, d["id"], a["id"], i).status_code == 200
        assert demand(s4, d["id"], a["id"], i, "paid").status_code == 200
    with s4.db.connection(mode="read") as conn:
        t = store_rfq.terms(conn, a["id"])
        assert t["overdue_key"] is None and t["overdue_notified_at"] is None
