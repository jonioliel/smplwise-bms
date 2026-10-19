"""2.7.1 (owner 2026-10-17, RFQPAY2 follow-up): the instalment payment demands of the award a work order came from are listed, read-only,
in the work order's Costs tab - status, amount, due date - under the Costs tab's own rule (the ticket's full view + tickets.costs.view on
it). Negative first: a caller without costs.view gets an empty list (never an amount, never a status), another department the uniform 404,
a ticket that is not an RFQ work order an empty list; nothing is writable through it."""
from __future__ import annotations

from test_tickets_rfq_instalments import _awarded, _order, demand, s4  # noqa: F401 - s4 is the fixture
from test_tickets_rfq_terms import _day
from tickets_s4_world import API


def costs(s4, tid: str, user: str):
    return s4.c.get(f"{API}/tickets/{tid}/costs", headers=s4.h(user))


def test_without_costs_view_no_amount_and_without_an_rfq_the_list_is_empty(s4):  # noqa: F811
    d, _v1, _tok, _c, a = _awarded(s4)
    assert demand(s4, d["id"], a["id"], 0).status_code == 200
    tid = _order(s4, d, a, send=False)
    r = costs(s4, tid, "mona")  # sees the work order, holds no tickets.costs.view
    assert r.status_code == 200, r.text
    # COSTINST (owner 2026-10-19): dates and status, never an amount
    got = r.json()["instalment_demands"]
    assert got and all(x["amount_minor"] is None and x["currency"] is None and x["can_pay"] is False for x in got)
    assert costs(s4, tid, "cleo").status_code == 404, "another department: the uniform 404 of the ticket"
    plain = s4.ticket(title="קריאה רגילה")
    assert costs(s4, plain["id"], "kim").json()["instalment_demands"] == []


def test_a_costs_viewer_sees_each_demand_with_status_amount_and_due_date(s4):  # noqa: F811
    d, _v1, _tok, _c, a = _awarded(s4)
    first = demand(s4, d["id"], a["id"], 0).json()["demand"]
    assert demand(s4, d["id"], a["id"], 0, "paid").status_code == 200
    assert demand(s4, d["id"], a["id"], 2).status_code == 200  # the final instalment: no due day yet
    tid = _order(s4, d, a, send=False)
    got = costs(s4, tid, "kim").json()["instalment_demands"]
    # COSTINST: the whole approved schedule is listed; an instalment with no demand yet has status `none`
    assert [(x["index"], x["kind"], x["status"]) for x in got] == [(0, "advance", "paid"), (1, "progress", "none"), (2, "final", "open")]
    got = [x for x in got if x["status"] != "none"]
    assert got[0]["amount_minor"] == first["amount_minor"] > 0 and got[0]["due_date"] == _day(6) and got[0]["paid_at"]
    assert got[1]["due_date"] is None and got[0]["currency"]
