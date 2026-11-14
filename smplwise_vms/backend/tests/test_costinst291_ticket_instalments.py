"""2.9.1 COSTINST (backlog tickets-costs-tab-instalments): a work order's Costs tab lists the whole approved payment schedule of the award it
came from - each instalment with its day, amount, status (`none` / `open` / `paid` / `cancelled`), `timing` (paid / late / soon / later)
and `can_pay` (the manager dashboard payments card's rule). Negative first: a caller without tickets.costs.view gets dates and status but no
amount, currency, id or pay flag (owner decision 2026-10-19); a viewer of costs who may not pay gets `can_pay: false`; another department the uniform 404. Every name and
number here is invented."""
from __future__ import annotations

from conftest import bind

from test_tickets_mgrdash_payments import _set_dates
from test_tickets_rfq_instalments import _awarded, _order, demand, s4  # noqa: F401 - s4 is the fixture
from test_tickets_rfq_terms import _day
from tickets_s4_world import API


def costs(s4, tid: str, user: str):
    return s4.c.get(f"{API}/tickets/{tid}/costs", headers=s4.h(user))


def rows(s4, tid: str, user: str = "kim") -> list[dict]:
    r = costs(s4, tid, user)
    assert r.status_code == 200, r.text
    return r.json()["instalment_demands"]


def test_no_costs_view_means_dates_and_status_but_never_an_amount(s4):  # noqa: F811
    d, _v1, _tok, _c, a = _awarded(s4)
    assert demand(s4, d["id"], a["id"], 0).status_code == 200
    tid = _order(s4, d, a, send=False)
    full = rows(s4, tid, "kim")
    r = costs(s4, tid, "mona")  # sees the work order, holds no tickets.costs.view (owner decision 2026-10-19)
    assert r.status_code == 200, r.text
    got = r.json()["instalment_demands"]
    assert [(x["index"], x["kind"], x["status"], x["timing"], x["due_date"]) for x in got] == [
        (x["index"], x["kind"], x["status"], x["timing"], x["due_date"]) for x in full]
    assert got[0]["due_date"] == _day(6)
    for x in got:
        assert x["amount_minor"] is None and x["currency"] is None and x["can_pay"] is False
        assert x["award_id"] is None and x["rfq_id"] is None
    assert costs(s4, tid, "cleo").status_code == 404, "another department: the uniform 404"


def test_the_whole_schedule_with_timing_and_the_pay_flag(s4):  # noqa: F811
    d, _v1, _tok, _c, a = _awarded(s4)  # advance day 6, progress day 8, final 30 days after completion (no day yet)
    tid = _order(s4, d, a, send=False)
    got = rows(s4, tid)
    assert [(x["index"], x["kind"], x["status"], x["timing"]) for x in got] == [
        (0, "advance", "none", "soon"), (1, "progress", "none", "soon"), (2, "final", "none", "later")]
    assert all(x["amount_minor"] > 0 and x["currency"] and x["can_pay"] is True for x in got)
    assert got[2]["due_date"] is None and got[0]["due_date"] == _day(6) and got[0]["award_id"] == a["id"] and got[0]["rfq_id"] == d["id"]
    _set_dates(s4, d["id"], {0: _day(-2), 1: _day(40)})
    got = rows(s4, tid)
    assert [x["timing"] for x in got] == ["late", "later", "later"]
    assert demand(s4, d["id"], a["id"], 0).status_code == 200 and demand(s4, d["id"], a["id"], 0, "paid").status_code == 200
    got = rows(s4, tid)
    assert (got[0]["status"], got[0]["timing"], got[0]["can_pay"]) == ("paid", "paid", False) and got[0]["paid_at"]
    assert demand(s4, d["id"], a["id"], 1).status_code == 200 and demand(s4, d["id"], a["id"], 1, "cancel").status_code == 200
    assert rows(s4, tid)[1]["status"] == "cancelled" and rows(s4, tid)[1]["can_pay"] is True, "a cancelled demand does not settle it"


def test_a_costs_viewer_who_may_not_pay_sees_amounts_but_no_pay_flag(s4):  # noqa: F811
    d, _v1, _tok, _c, a = _awarded(s4)
    tid = _order(s4, d, a, send=False)
    bind(s4.c, s4.w.settings, "mona", "tickets_costs_view", "installation", "*")
    got = rows(s4, tid, "mona")
    assert len(got) == 3 and all(x["amount_minor"] > 0 and x["can_pay"] is False for x in got)
    bind(s4.c, s4.w.settings, "mona", "tickets_costs", "installation", "*")
    assert all(x["can_pay"] is True for x in rows(s4, tid, "mona"))


def test_a_zero_instalment_is_not_listed_and_the_marking_still_goes_through_the_rfq_route(s4):  # noqa: F811
    d, _v1, _tok, _c, a = _awarded(s4)
    tid = _order(s4, d, a, send=False)
    assert all(x["amount_minor"] > 0 for x in rows(s4, tid))
    # the tab's action is the RFQ route (create, then paid): a viewer without tickets.costs is refused there too
    assert demand(s4, d["id"], a["id"], 0, "create", user="mona").status_code == 403
    assert demand(s4, d["id"], a["id"], 0, "create").status_code == 200
    assert demand(s4, d["id"], a["id"], 0, "paid").status_code == 200
    assert rows(s4, tid)[0]["status"] == "paid"
    with s4.db.connection(mode="read") as conn:  # both steps (create, then paid) are audited
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.rfq.instalment_demand'").fetchone()[0]
    assert n >= 2
