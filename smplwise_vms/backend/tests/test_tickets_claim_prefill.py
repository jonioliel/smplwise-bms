"""CR-CLAIM-PREFILL (docs/changes/CR-CLAIM-PREFILL.md): the vendor's payment demand is LOADED from the approved quote of his work order,
over the REAL store, the real internal API and the real public app.

Negative cases first (public surface): no token / a tampered token / an expired claim window are the uniform 404; another vendor's link
never sees the awarded vendor's quote; a tampered instalment index, an unknown key (a quote id, bank data), a reason without a demand
above the quote and a demand above it without a reason are refused with their field; then the flows - the prefill of an RFQ award (lines,
figures, window, schedule, the instalment a manager opened pre-selected), a demand equal to the quote / to an instalment (`same`), a
demand above it with a reason (`differs`, the reason shown to the manager), an ordinary assignment (nothing changes). Every name and
number here is invented."""
from __future__ import annotations

import json
import time
import uuid

from smplwise.services.tickets import money
from smplwise.services.tickets.public_http import UNIFORM_404
from test_tickets_rfq_instalments import _awarded, demand
from test_tickets_rfq_terms import s4  # noqa: F401 - the fixture (RFQ managers + the approver kim)
from tickets_s4_world import API, Clock, crid

PREFILL_KEYS = {"version", "partial", "currency", "vat_mode", "vat_rate_bp", "lines", "subtotal_minor", "vat_minor", "total_minor",
                "work_from", "work_to", "instalments", "instalment"}
LINE_KEYS = {"kind", "description", "total_minor", "hours", "rate_minor", "quantity", "unit_minor", "amount_minor"}


def hdr(tok: str) -> dict[str, str]:
    return {"x-ticket-token": tok}


def _ordered(s4, plan=None):
    """An RFQ award with an approved schedule, its work order, the vendor's handler link reported done -> (rfq, award, token, client,
    clock, order ticket id)."""
    d, v1, _tok, _c, a = _awarded(s4, plan) if plan is not None else _awarded(s4)
    o = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order", json={"request_key": f"ord-{uuid.uuid4().hex[:16]}"}, headers=s4.h("mona"))
    assert o.status_code == 201, o.text
    tid = o.json()["ticket"]["id"]
    tok = s4.token_of(tid)
    clock = Clock(time.time())
    client, _ = s4.public(clock)
    for st in ("acknowledged", "done"):
        r = client.post("/t/api/status", headers=hdr(tok), json={"status": st, "client_request_id": crid()})
        assert r.status_code == 200, r.text
    return d, a, tok, client, clock, tid


def _claim_page(client, tok) -> dict:
    r = client.get("/t/api/claim", headers=hdr(tok))
    assert r.status_code == 200, r.text
    return r.json()


def _lines_from(prefill: dict) -> list[dict]:
    """The prefill's lines in the claim's input shape (what the page builds from them)."""
    out = []
    for ln in prefill["lines"]:
        x = {"kind": ln["kind"]}
        if ln.get("description"):
            x["description"] = ln["description"]
        if ln["kind"] == "labor":
            x.update(hours=ln["hours"], rate=money.format_minor(ln["rate_minor"]))
        elif ln["kind"] == "parts":
            x.update(quantity=ln["quantity"], unit_price=money.format_minor(ln["unit_minor"]))
        else:
            x["amount"] = money.format_minor(ln["amount_minor"])
        out.append(x)
    return out


def _post(client, tok, lines, prefill, **body):
    return client.post("/t/api/claim", headers=hdr(tok), json={"lines": lines, "amounts_include_vat": prefill["vat_mode"] == "included",
                                                               "client_request_id": crid(), **body})


def _manager_claim(s4, tid) -> dict:
    r = s4.c.get(f"{API}/tickets/{tid}/costs", headers=s4.h("kim"))
    assert r.status_code == 200, r.text
    return r.json()["claims"][0]


# ---------------------------------------------------------------- negative first: the public surface

def test_no_token_a_tampered_token_and_an_expired_window_are_the_uniform_404(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    assert client.get("/t/api/claim").content == UNIFORM_404
    tampered = tok[:-2] + ("AA" if not tok.endswith("AA") else "BB")
    assert client.get("/t/api/claim", headers=hdr(tampered)).content == UNIFORM_404
    assert client.post("/t/api/claim", headers=hdr(tampered), json={"lines": [], "instalment_index": 0, "client_request_id": crid()}).content == UNIFORM_404
    # the work order's ticket closed and the claim window over: nothing of the quote is served any more
    assert s4.w.status("joni", tid, "closed", override_claim_reason="נסגר").status_code == 200
    gone, _ = s4.public(Clock(clock() + 60 * 86400))
    assert gone.get("/t/api/claim", headers=hdr(tok)).content == UNIFORM_404


def test_another_vendor_never_sees_the_awarded_quote(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    mine = _claim_page(client, tok)["prefill"]
    assert mine is not None
    # the other invited vendor (not selected) works on an ordinary request through his own link: no prefill, nothing of the award
    t, other_tok = s4.sent(cost_claim="required")
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(other_tok), json={"status": st, "client_request_id": crid()}).status_code == 200
    page = client.get("/t/api/claim", headers=hdr(other_tok))
    assert page.status_code == 200 and page.json()["prefill"] is None
    text = page.text
    assert str(mine["total_minor"]) not in text and "instalments" not in text
    # his link cannot name the awarded vendor's instalment either (he has no approved quote)
    r = client.post("/t/api/claim", headers=hdr(other_tok), json={"lines": [{"kind": "travel", "amount": "10"}], "instalment_index": 0,
                                                                  "client_request_id": crid()})
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "instalment_index", "code": "not_allowed"}], r.text


def test_tampered_fields_and_unknown_keys_are_refused_before_anything_is_stored(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    p = _claim_page(client, tok)["prefill"]
    lines = _lines_from(p)
    cases = [
        ({"instalment_index": 5}, "instalment_index", "invalid"),  # no such instalment in HIS schedule
        ({"instalment_index": True}, None, None),  # strict: a bool is not an index
        ({"instalment_index": "0"}, None, None),
        ({"instalment_index": -1}, None, None),
        ({"quote_id": "q-other"}, None, None),  # the basis is the server's - never named by the client
        ({"iban": "IL000000000000000000000"}, None, None),  # no bank data, ever
        ({"above_reason": "יקר יותר"}, "above_reason", "not_allowed"),  # not above the approved total
        ({"above_reason": "x" * 1001}, None, None),
        ({"total_minor": 1}, None, None),  # client totals are not accepted
    ]
    for extra, field, code in cases:
        r = _post(client, tok, lines, p, **extra)
        assert r.status_code == 422, (extra, r.text)
        if field:
            assert r.json()["fields"] == [{"field": field, "code": code}], (extra, r.text)
    # above the approved total without a reason
    above = lines + [{"kind": "labor", "hours": "1", "rate": "100"}]
    r = _post(client, tok, above, p)
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "above_reason", "code": "required"}], r.text
    r = _post(client, tok, above, p, above_reason="y" * 501)
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "above_reason", "code": "too_long"}], r.text
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_cost_revisions").fetchone()[0] == 0


# ---------------------------------------------------------------- the flows

def test_the_prefill_carries_his_approved_quote_and_schedule_only(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    page = _claim_page(client, tok)
    p = page["prefill"]
    assert set(p) == PREFILL_KEYS and all(set(ln) <= LINE_KEYS for ln in p["lines"])
    assert p["total_minor"] == a["total_minor"] and p["partial"] is False and [ln["kind"] for ln in p["lines"]] == ["labor", "parts"]
    assert sum(i["amount_minor"] for i in p["instalments"]) == p["total_minor"] and len(p["instalments"]) == 3
    assert [i["kind"] for i in p["instalments"]] == ["advance", "progress", "final"] and p["instalment"] is None
    assert p["instalments"][2]["due_date"] is not None  # the order's ticket is done: "30 days after completion" resolves
    assert page["form"]["limits"]["above_reason"] == 500
    lowered = json.dumps(p, ensure_ascii=False).lower()
    for word in ("iban", "bank", "account", "contact", "vendor", "rfq", "quote_id", "\"id\""):
        assert word not in lowered, word
    # a manager opens a demand for the progress instalment (RFQPAY2): the page pre-selects it
    assert demand(s4, d["id"], a["id"], 1).status_code == 200
    assert _claim_page(client, tok)["prefill"]["instalment"] == 1
    assert demand(s4, d["id"], a["id"], 0).status_code == 200
    assert _claim_page(client, tok)["prefill"]["instalment"] == 0  # the earliest open one
    assert demand(s4, d["id"], a["id"], 0, "cancel").status_code == 200
    assert _claim_page(client, tok)["prefill"]["instalment"] == 1


def test_a_demand_equal_to_the_quote_is_same_and_one_above_it_differs_with_his_reason(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    p = _claim_page(client, tok)["prefill"]
    r = _post(client, tok, _lines_from(p), p)
    assert r.status_code == 201, r.text
    assert r.json()["revision"]["total_minor"] == p["total_minor"]
    assert r.json()["revision"]["basis"] == {"basis": "total", "instalment_index": None, "basis_minor": p["total_minor"], "above_reason": None}
    qc = _manager_claim(s4, tid)["quote_check"]
    assert qc["status"] == "same" and qc["flags"] == [] and qc["delta_minor"] == 0
    # a corrected demand above the quote, with a reason (control and direction characters are cleaned)
    above = _lines_from(p) + [{"kind": "labor", "hours": "1", "rate": "100"}]
    r = _post(client, tok, above, p, above_reason="‮עבודה נוספת\u0007 בגג")
    assert r.status_code == 201, r.text
    basis = r.json()["revision"]["basis"]
    assert basis["above_reason"] and "‮" not in basis["above_reason"] and "\u0007" not in basis["above_reason"]
    claim = _manager_claim(s4, tid)
    qc = claim["quote_check"]
    assert qc["status"] == "differs" and qc["flags"] == ["above_quote", "lines_differ"] and qc["delta_minor"] > 0
    assert qc["above_reason"] == basis["above_reason"] and qc["basis"] == "total"
    assert claim["revisions"][-1]["basis"]["above_reason"] == basis["above_reason"]
    with s4.db.connection(mode="read") as conn:
        audit = [r[0] for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.cost.submit'")]
    assert audit and all("עבודה" not in x for x in audit)  # the reason is never copied into the audit row
    # below the quote: accepted as it is, flagged for the manager
    r = _post(client, tok, _lines_from(p)[:1], p)
    assert r.status_code == 201, r.text
    assert _manager_claim(s4, tid)["quote_check"]["flags"] == ["below_quote", "lines_differ"]


def test_an_instalment_demand_is_compared_with_that_instalment(s4):
    d, a, tok, client, clock, tid = _ordered(s4)
    p = _claim_page(client, tok)["prefill"]
    adv = p["instalments"][0]
    one = [{"kind": "labor", "hours": "1", "rate": money.format_minor(adv["amount_minor"])}]
    r = client.post("/t/api/claim", headers=hdr(tok), json={"lines": one, "amounts_include_vat": True, "instalment_index": 0,
                                                            "client_request_id": crid()})
    assert r.status_code == 201, r.text
    assert r.json()["revision"]["total_minor"] == adv["amount_minor"]
    qc = _manager_claim(s4, tid)["quote_check"]
    assert qc == {**qc, "status": "same", "flags": [], "basis": "instalment", "instalment_index": 0, "basis_minor": adv["amount_minor"]}
    # above the instalment (still below the whole quote) needs the reason
    more = [{"kind": "labor", "hours": "1", "rate": money.format_minor(adv["amount_minor"] + 100)}]
    r = client.post("/t/api/claim", headers=hdr(tok), json={"lines": more, "amounts_include_vat": True, "instalment_index": 0,
                                                            "client_request_id": crid()})
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "above_reason", "code": "required"}], r.text


def test_basis_refuses_a_zero_or_missing_instalment_and_no_charge(s4, monkeypatch):
    from smplwise.services.tickets import claim_prefill
    from smplwise.services.tickets.costs import CostRefused

    sched = [{"index": 0, "kind": "advance", "amount_minor": 5000, "due": "date", "date": "2026-11-02", "days": None, "due_date": "2026-11-02"},
             {"index": 1, "kind": "final", "amount_minor": 0, "due": "completion", "date": None, "days": None, "due_date": None}]
    monkeypatch.setattr(claim_prefill, "_schedule", lambda conn, q: sched)
    base = {"id": "q-1", "approved_total_minor": 5000, "currency": "ILS"}
    for body, kw, field, code in (({"instalment_index": 1}, {}, "instalment_index", "invalid"),
                                  ({"instalment_index": 0}, {"no_charge": True}, "instalment_index", "not_allowed"),
                                  ({"above_reason": 5}, {}, "above_reason", "type")):
        args = {"total_minor": 5000, "currency": "ILS", "no_charge": False, **kw}
        try:
            claim_prefill.basis(None, {}, base, body=body, vendor=True, **args)
        except CostRefused as exc:
            assert (exc.field, exc.code) == (field, code), body
        else:
            raise AssertionError(body)
    # another currency cannot be compared: no reason needed, the manager sees `currency`
    b = claim_prefill.basis(None, {}, base, total_minor=999999, currency="USD", no_charge=False, body={}, vendor=True)
    assert b["basis_minor"] == 5000 and b["above_reason"] is None
    # a manager's on-behalf demand above the quote is not refused for a missing reason
    assert claim_prefill.basis(None, {}, base, total_minor=6000, currency="ILS", no_charge=False, body={}, vendor=False)["basis"] == "total"


def test_q6_a_partial_award_prefills_and_references_the_approved_part_only(s4):
    from test_tickets_rfq_public import pub, sent_rfq, token, vid
    from test_tickets_rfq_terms import PLAN, award, pquote, switch

    switch(s4)
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    q = pquote(pub(s4), token(s4, v1), payment=PLAN)
    assert q.status_code == 201, q.text
    quoted_total = q.json()["quote"]["total_minor"]
    r = award(s4, d["id"], v1, kinds=["labor"], payment_source="vendor")  # labour only: a partial approval
    assert r.status_code == 201, r.text
    a = r.json()["award"]
    assert a["total_minor"] < quoted_total
    o = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order", json={"request_key": f"ord-{uuid.uuid4().hex[:16]}"}, headers=s4.h("mona"))
    assert o.status_code == 201, o.text
    tid = o.json()["ticket"]["id"]
    tok = s4.token_of(tid)
    client, _ = s4.public(Clock(time.time()))
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(tok), json={"status": st, "client_request_id": crid()}).status_code == 200
    p = _claim_page(client, tok)["prefill"]
    assert p["partial"] is True and p["total_minor"] == a["total_minor"] and [ln["kind"] for ln in p["lines"]] == ["labor"]
    # what the quote card's "according to the approved quote" reads (quote.approved.total_minor) is the approved part too
    card = client.get("/t/api/quote", headers=hdr(tok)).json()["quote"]
    assert card["approved"]["total_minor"] == a["total_minor"] != card["total_minor"]
    # and the manager's "against quote version N" line
    assert _post(client, tok, _lines_from(p), p).status_code == 201
    claim = _manager_claim(s4, tid)
    assert claim["baseline"]["total_minor"] == a["total_minor"] and claim["quote_check"]["status"] == "same"


def test_an_ordinary_assignment_changes_nothing(s4):
    t, tok = s4.sent(cost_claim="required")
    client, _ = s4.public(Clock(time.time()))
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(tok), json={"status": st, "client_request_id": crid()}).status_code == 200
    page = _claim_page(client, tok)
    assert page["prefill"] is None
    r = client.post("/t/api/claim", headers=hdr(tok), json={"lines": [{"kind": "labor", "hours": "2", "rate": "150"}], "client_request_id": crid()})
    assert r.status_code == 201 and r.json()["revision"]["basis"] is None, r.text
    claim = _manager_claim(s4, t["id"])
    assert claim["quote_check"] is None and claim["baseline"] is None


def test_quote_check_compares_a_total_demand_with_the_stored_basis_not_the_live_baseline_review_f2():
    from smplwise.services.tickets import claim_prefill

    base = {"approved_total_minor": 150_000, "currency": "ILS", "version": 2}  # the quote was revised after the demand
    rev = {"total_minor": 100_000, "currency": "ILS", "no_charge": 0, "lines_json": "[]",
           "basis_json": '{"basis": "total", "basis_minor": 100000, "instalment_index": null, "above_reason": null}'}
    qc = claim_prefill.check(base, rev)
    assert qc["basis_minor"] == 100_000 and qc["delta_minor"] == 0 and "below_quote" not in qc["flags"]
    # a revision without a stored basis keeps the live baseline
    qc = claim_prefill.check(base, {**rev, "basis_json": None})
    assert qc["basis_minor"] == 150_000 and "below_quote" in qc["flags"]
