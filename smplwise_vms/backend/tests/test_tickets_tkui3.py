"""TKUI3 (release 2.6.0): two small backend additions the Costs tab and the handler page read.

1. `GET /t/api/ticket` (handler_actions.view) carries an explicit `kind`: `staff` for a no-money link (an employee's staff link, a staff
   contact without an account), `vendor` otherwise - only after the code gate, never on the minimal answer of a code-protected link.
2. `GET /tickets/{id}/costs` › `external_assignments[].quote_capable` (quotes.quote_capable): false for a staff contact without an account,
   so the manager's Costs tab never offers a quote, a payment demand or a requirement for it (staff have no money surface).
Negative cases first. Every name and number is invented (the 050-000-xxxx block); fake ha-whatsapp only."""
from __future__ import annotations

import time

from test_tickets_s5b_channel import env  # noqa: F401 - the slice 5b environment (fake ha-whatsapp, mapped account)
from test_tickets_staff_links import code_session, hdr, staff_row, staff_ticket
from tickets_s4_world import Clock

API = "/api/v1"


def _employee(env):
    r = env.c.post(f"{API}/tickets/contacts", json={"kind": "employee", "display_name": "יוסי טכנאי", "phone": "050-000-0077", "lang": "he",
                                                     "departments": ["dept-maintenance"]})
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------- 1. the explicit kind of the handler page


def test_a_code_protected_link_says_no_kind_before_the_code(env):
    t, _ = staff_ticket(env)
    token = env.s4.token_of(t["id"])
    client, _ = env.s4.public(Clock(time.time()))
    r = client.get("/t/api/ticket", headers=hdr(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["code_required"] is True and body["code_ok"] is False
    assert "kind" not in body, "a forwarded link alone discloses nothing about the assignment"


def test_a_staff_link_is_kind_staff_after_the_code(env):
    t, _ = staff_ticket(env)
    link = staff_row(env, t["id"])
    token = env.s4.token_of(t["id"])
    client, _ = env.s4.public(Clock(time.time()))
    session = code_session(env, client, token, link)
    body = client.get("/t/api/ticket", headers=hdr(token, session)).json()
    assert body["kind"] == "staff"
    assert "claim" not in body and "quote" not in body


def test_a_staff_contact_without_an_account_is_kind_staff(env):
    e = _employee(env)
    t = env.s4.ticket()
    assert env.s4.assign_contact(t["id"], e["id"], user="mona").status_code == 200
    token = env.s4.token_of(t["id"])
    client, _ = env.s4.public(Clock(time.time()))
    body = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert body["kind"] == "staff", "an employee row is internal staff, never a vendor"
    assert "claim" not in body


def test_a_vendor_contact_link_is_kind_vendor(env):
    _, token = env.s4.sent()
    client, _ = env.s4.public(Clock(time.time()))
    body = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert body["kind"] == "vendor"
    assert "claim" in body, "the vendor page keeps its cost surface"


# ---------------------------------------------------------------- 2. quote_capable on the manager's costs answer


def test_a_staff_contact_assignment_is_not_quote_capable(env):
    e = _employee(env)
    t = env.s4.ticket()
    assert env.s4.assign_contact(t["id"], e["id"], user="mona").status_code == 200
    r = env.c.get(f"{API}/tickets/{t['id']}/costs")
    assert r.status_code == 200, r.text
    rows = r.json()["external_assignments"]
    assert len(rows) == 1 and rows[0]["quote_capable"] is False


def test_a_vendor_assignment_is_quote_capable(env):
    t, _ = env.s4.sent()
    r = env.c.get(f"{API}/tickets/{t['id']}/costs")
    assert r.status_code == 200, r.text
    rows = r.json()["external_assignments"]
    assert len(rows) == 1 and rows[0]["quote_capable"] is True
