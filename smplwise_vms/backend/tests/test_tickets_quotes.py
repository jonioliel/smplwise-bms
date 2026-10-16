"""TK257 - the vendor's quote BEFORE the work, kept as the PUBLIC CONTRACT of the built vendor card (frontend public-ticket/claim/
quote-card.ts) after TKDETAILBE replaced the 2.5.7 implementation (migration 0088 moved 0085's rows into `ticket_quotes`): the public routes
GET/POST /t/api/quote over the real store and the handler link, the allowed line kinds (work + parts by default), server arithmetic,
idempotency, supersession, the manager's approve / correction request (tickets.costs; NOTHING is sent to the vendor), the vendor's
isolation from other vendors' quotes, the close after "done", and the purge. Every name and number here is invented."""
from __future__ import annotations

import time

import pytest

from smplwise.services.tickets import store
from tickets_s4_world import API, Clock, build_s4, crid

PHONE_OTHER = "050-000-0077"


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


LINES = [{"kind": "labor", "hours": "2", "rate": "150"}, {"kind": "parts", "description": "מדחס", "quantity": "1", "unit_price": "800"}]


def vendor_page(s4, **extra):
    t, token = s4.sent(**extra)
    client, _ = s4.public(Clock(time.time()))
    return t, token, client


def post_quote(client, token, **body):
    return client.post("/t/api/quote", headers=hdr(token), json={"lines": LINES, "client_request_id": crid(), **body})


def manager_quotes(s4, tid):
    r = s4.c.get(f"{API}/tickets/{tid}/costs", headers=s4.h("joni"))
    assert r.status_code == 200, r.text
    return r.json()["quotes"]


def decide(s4, tid, qid, action, **body):
    return s4.c.post(f"{API}/tickets/{tid}/costs/quotes/{qid}/{action}", headers=s4.h("joni"), json=body)


def outbox_rows(s4) -> int:
    with s4.db.connection(mode="read") as conn:
        return int(conn.execute("SELECT COUNT(*) FROM ticket_outbox").fetchone()[0])


def test_the_card_is_open_from_the_first_moment_with_work_and_parts_only(s4):
    _t, token, client = vendor_page(s4)
    r = client.get("/t/api/quote", headers=hdr(token))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["state"] == "none" and j["writable"] is True and j["quote"] is None
    assert j["allowed_kinds"] == ["labor", "parts"], "travel / other only when the request or the department allows them"
    assert j["form"]["vat"]["rate_bp"] >= 0 and j["form"]["limits"]["lines"] == 30


def test_the_server_computes_the_quote_and_refuses_client_totals(s4):
    _t, token, client = vendor_page(s4)
    r = post_quote(client, token)
    assert r.status_code == 201, r.text
    q = r.json()["quote"]
    assert q["state"] == "submitted" and q["seq"] == 1
    assert q["labor_minor"] == 30000 and q["parts_minor"] == 80000 and q["subtotal_minor"] == 110000
    assert q["total_minor"] == q["subtotal_minor"] + q["vat_minor"]
    bad = client.post("/t/api/quote", headers=hdr(token), json={"lines": LINES, "total_minor": 1, "client_request_id": crid()})
    assert bad.status_code == 422, "a client total is not even accepted"
    unknown = post_quote(client, token, currency="XXX")
    assert unknown.status_code == 422 and unknown.json()["fields"] == [{"field": "currency", "code": "unknown"}]
    assert post_quote(client, token, currency=q["currency"]).status_code == 201
    g = client.get("/t/api/quote", headers=hdr(token)).json()
    assert g["state"] == "submitted" and g["quote"]["total_minor"] == q["total_minor"]


def test_travel_and_other_are_refused_unless_the_request_allows_them(s4):
    t, token, client = vendor_page(s4)
    travel = [*LINES, {"kind": "travel", "amount": "50"}]
    r = post_quote(client, token, lines=travel)
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "lines.2.kind", "code": "kind_not_allowed"}], r.text
    r = s4.c.put(f"{API}/tickets/{t['id']}/allowed-line-kinds", json={"kinds": ["labor", "parts", "travel", "other"]})
    assert r.status_code == 200, r.text
    assert client.get("/t/api/quote", headers=hdr(token)).json()["allowed_kinds"] == ["labor", "parts", "travel", "other"]
    assert post_quote(client, token, lines=travel).status_code == 201
    no_desc = post_quote(client, token, lines=[{"kind": "other", "amount": "10"}])
    assert no_desc.status_code == 422 and no_desc.json()["fields"][0]["field"] == "lines.0.description", "'other' needs a description"
    assert post_quote(client, token, lines=[{"kind": "other", "description": "פינוי פסולת", "amount": "10"}]).status_code == 201


def test_a_department_default_allows_travel(s4):
    """TKDETAILBE: the request -> department -> installation chain (labour always; parts may be left out on purpose)."""
    t, token, client = vendor_page(s4)
    assert s4.c.put(f"{API}/tickets/costs/departments/dept-maintenance", json={"allowed_line_kinds": ["labor", "parts", "travel"]}).status_code == 200
    assert client.get("/t/api/quote", headers=hdr(token)).json()["allowed_kinds"] == ["labor", "parts", "travel"]
    assert s4.c.put(f"{API}/tickets/{t['id']}/allowed-line-kinds", json={"kinds": ["labor", "other"]}).status_code == 200
    assert client.get("/t/api/quote", headers=hdr(token)).json()["allowed_kinds"] == ["labor", "other"], "the request wins over the department"


def test_a_repeated_request_id_is_one_quote_and_a_new_quote_supersedes_the_open_one(s4):
    t, token, client = vendor_page(s4)
    same = crid()
    first = post_quote(client, token, client_request_id=same)
    again = post_quote(client, token, client_request_id=same)
    assert first.status_code == 201 and again.status_code == 201 and again.json() == first.json()
    assert len(manager_quotes(s4, t["id"])) == 1
    second = post_quote(client, token, lines=[{"kind": "labor", "hours": "1", "rate": "100"}])
    assert second.status_code == 201 and second.json()["quote"]["seq"] == 2
    states = [q["state"] for q in manager_quotes(s4, t["id"])]
    assert states == ["superseded", "submitted"]


def test_approving_sends_nothing_and_closes_the_quote(s4):
    t, token, client = vendor_page(s4)
    qid = post_quote(client, token).json()["quote"]["id"]
    before = outbox_rows(s4)
    r = decide(s4, t["id"], qid, "approve")
    assert r.status_code == 200, r.text
    assert [q["state"] for q in r.json()["quotes"]] == ["approved"]
    assert r.json()["quotes"][0]["decision"]["by"], "the manager sees who decided"
    assert r.json()["message_draft"]["text"], "a draft is offered - never sent"
    assert outbox_rows(s4) == before, "approving a quote never sends an automatic message"
    g = client.get("/t/api/quote", headers=hdr(token)).json()
    assert g["state"] == "approved" and g["writable"] is False and "decided_by" not in g["quote"], "the vendor never sees who decided"
    closed = post_quote(client, token)
    assert closed.status_code == 409 and closed.json()["code"] == "quote_closed"


def test_a_correction_request_needs_a_reason_and_lets_the_vendor_resubmit(s4):
    t, token, client = vendor_page(s4)
    qid = post_quote(client, token).json()["quote"]["id"]
    assert decide(s4, t["id"], qid, "reject").status_code == 422
    before = outbox_rows(s4)
    assert decide(s4, t["id"], qid, "reject", reason="חסר מחיר הובלה").status_code == 200
    assert outbox_rows(s4) == before
    g = client.get("/t/api/quote", headers=hdr(token)).json()
    assert g["state"] == "rejected" and g["writable"] is True and g["quote"]["reason"] == "חסר מחיר הובלה"
    assert post_quote(client, token).status_code == 201
    assert decide(s4, t["id"], qid, "approve").status_code == 409, "a decided / superseded quote cannot be decided again"


def test_only_a_member_with_the_costs_permission_decides(s4):
    t, token, client = vendor_page(s4)
    qid = post_quote(client, token).json()["quote"]["id"]
    r = s4.c.post(f"{API}/tickets/{t['id']}/costs/quotes/{qid}/approve", headers=s4.h("mona"), json={})
    assert r.status_code == 403, r.text
    assert manager_quotes(s4, t["id"])[0]["state"] == "submitted"


def test_a_vendor_never_sees_another_vendors_quote(s4):
    t1, token1, client = vendor_page(s4)
    other = s4.add_contact(display_name="דנה לוי", phone=PHONE_OTHER)
    assert other.status_code == 201, other.text
    t2 = s4.ticket(title="נזילה בצנרת")
    assert s4.assign_contact(t2["id"], other.json()["id"]).status_code == 200
    token2 = s4.token_of(t2["id"])
    assert post_quote(client, token1).status_code == 201
    g2 = client.get("/t/api/quote", headers=hdr(token2)).json()
    assert g2["state"] == "none" and g2["quote"] is None
    assert post_quote(client, token2, lines=[{"kind": "labor", "hours": "1", "rate": "10"}]).status_code == 201
    assert client.get("/t/api/quote", headers=hdr(token1)).json()["quote"]["total_minor"] != client.get("/t/api/quote", headers=hdr(token2)).json()["quote"]["total_minor"]


def test_a_request_with_costs_off_has_no_quote_card(s4):
    _t, token, client = vendor_page(s4, cost_claim="off")
    g = client.get("/t/api/quote", headers=hdr(token)).json()
    assert g["enabled"] is False and g["writable"] is False and g["state"] == "none"
    r = post_quote(client, token)
    assert r.status_code == 409 and r.json()["code"] == "quote_closed"
    _t2, token2, client2 = vendor_page(s4, cost_claim="optional")
    assert client2.get("/t/api/quote", headers=hdr(token2)).json()["enabled"] is True


def test_the_quote_closes_when_the_work_is_done(s4):
    t, token, client = vendor_page(s4)
    qid = post_quote(client, token).json()["quote"]["id"]
    assert decide(s4, t["id"], qid, "approve").status_code == 200
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()}).status_code == 200
    g = client.get("/t/api/quote", headers=hdr(token)).json()
    assert g["writable"] is False and g["state"] == "approved", "the approved quote stays visible as the reference of the payment demand"
    t2, token2, client2 = vendor_page(s4)
    for st in ("acknowledged", "done"):
        assert client2.post("/t/api/status", headers=hdr(token2), json={"status": st, "client_request_id": crid()}).status_code == 200
    r = post_quote(client2, token2)
    assert r.status_code == 409 and r.json()["code"] == "quote_closed", r.text
    assert t2["id"]


def test_the_purge_removes_the_quotes(s4):
    t, token, client = vendor_page(s4)
    assert post_quote(client, token).status_code == 201
    with s4.db.connection() as conn:
        gone = store.purge_ticket(conn, t["id"])
        assert gone.get("ticket_quotes") == 1
        assert conn.execute("SELECT COUNT(*) FROM ticket_quotes").fetchone()[0] == 0


def test_the_2_5_7_table_is_replaced(s4):
    """0088 moved the 2.5.7 rows into `ticket_quotes` and dropped `ticket_cost_quotes` (test_tickets_detail covers the copy)."""
    with s4.db.connection(mode="read") as conn:
        assert {r["name"] for r in conn.execute("PRAGMA table_info(ticket_quotes)")} >= {"assignment_id", "state", "total_minor", "vat_mode"}
        assert not conn.execute("SELECT 1 FROM sqlite_master WHERE name = 'ticket_cost_quotes'").fetchone()
