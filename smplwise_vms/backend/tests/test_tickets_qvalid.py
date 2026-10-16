"""TKQVALID: the 'valid until' of a ticket quote - on the manager's behalf and through the vendor's link, negative cases first."""
from __future__ import annotations

import datetime as dt

import pytest
from test_tickets_detail import QUOTE, _staff_assignment, decide_quote, hdr, quotes_of, s4, sent, vendor_quote  # noqa: F401 (s4 is the fixture)
from tickets_s4_world import API


def _at(days: float) -> str:
    return (dt.datetime.now(dt.timezone.utc).replace(microsecond=0) + dt.timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _day(days: int) -> str:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days)).strftime("%Y-%m-%d")


def on_behalf(s4, tid, **body):
    return s4.c.post(f"{API}/tickets/{tid}/quotes", json={"lines": QUOTE, **body})


@pytest.mark.parametrize("value,code", [
    ("not-a-date", "format"), ("2026-13-45", "format"), ("2026-02-30", "format"),
    (_at(-3), "range"),            # past by more than a day
    (_at(400), "range"),           # more than 366 days ahead
    (_day(-3), "range"), (_day(500), "range"),
])
def test_invalid_validity_is_refused_on_behalf_and_through_the_link_and_stores_nothing(s4, value, code):
    t, token, client = sent(s4)
    r = on_behalf(s4, t["id"], valid_until=value)
    assert r.status_code == 422, r.text
    assert quotes_of(s4, t["id"])["quotes"] == [], "a refused quote is not stored"
    r = vendor_quote(client, token, valid_until=value)
    assert r.status_code == 422 and r.json()["fields"] == [{"field": "valid_until", "code": code}], r.text
    assert quotes_of(s4, t["id"])["quotes"] == []


def test_the_wrong_type_and_unknown_fields_are_refused(s4):
    t, token, client = sent(s4)
    assert on_behalf(s4, t["id"], valid_until=12345).status_code == 422
    assert on_behalf(s4, t["id"], validity="x").status_code == 422, "extra = forbid"
    assert vendor_quote(client, token, valid_until=12345).status_code == 422


def test_a_date_is_the_end_of_that_day_and_an_instant_is_kept(s4):
    t, token, client = sent(s4)
    r = on_behalf(s4, t["id"], valid_until=_day(10))
    assert r.status_code == 201, r.text
    assert r.json()["quotes"][-1]["valid_until"] == _day(10) + "T23:59:59Z"
    at = _at(5)
    assert on_behalf(s4, t["id"], valid_until=at).json()["quotes"][-1]["valid_until"] == at
    assert on_behalf(s4, t["id"]).json()["quotes"][-1]["valid_until"] is None
    assert on_behalf(s4, t["id"], valid_until="").json()["quotes"][-1]["valid_until"] is None


def test_a_just_lapsed_quote_is_accepted_and_the_far_boundary_holds(s4):
    t, token, client = sent(s4)
    assert on_behalf(s4, t["id"], valid_until=_at(-0.5)).status_code == 201
    assert on_behalf(s4, t["id"], valid_until=_at(365)).status_code == 201
    assert on_behalf(s4, t["id"], valid_until=_at(367)).status_code == 422


def test_the_vendor_sees_only_his_own_validity(s4):
    t, token, client = sent(s4)
    first = _at(20)
    assert on_behalf(s4, t["id"], valid_until=first).status_code == 201
    v = client.get("/t/api/quote", headers=hdr(token)).json()
    assert v["quotes"][-1]["valid_until"] == first and v["quote"]["valid_until"] == first
    second = _at(9)
    assert vendor_quote(client, token, valid_until=second).status_code == 201
    v = client.get("/t/api/quote", headers=hdr(token)).json()
    assert [q["valid_until"] for q in v["quotes"]] == [first, second]
    t2, token2, client2 = sent(s4)  # another request, another link: nothing of the first one's validity reaches it
    v2 = client2.get("/t/api/quote", headers=hdr(token2)).json()
    assert v2["quotes"] == [] and v2["quote"] is None and first not in str(v2) and second not in str(v2)
    assert first not in str(client2.get("/t/api/ticket", headers=hdr(token2)).json())


def test_the_manager_card_carries_the_validity_only_with_costs_view(s4):
    t, token, client = sent(s4)
    at = _at(20)
    assert on_behalf(s4, t["id"], valid_until=at).status_code == 201
    assert quotes_of(s4, t["id"])["quotes"][-1]["valid_until"] == at
    assert "valid_until" not in quotes_of(s4, t["id"], user="mona")["quotes"][-1], "no amounts, no validity without tickets.costs.view"


def test_a_staff_assignment_takes_no_quote_and_so_no_validity(s4):
    t, e, asg = _staff_assignment(s4)
    r = on_behalf(s4, t["id"], valid_until=_at(5))
    assert r.status_code == 409 and r.json()["code"] == "quote_not_open", r.text


def _expire(s4, quote_id):
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_quotes SET valid_until = ? WHERE id = ?", (_at(-2), quote_id))


def test_approving_an_expired_quote_needs_the_explicit_confirmation(s4):
    t, token, client = sent(s4)
    assert vendor_quote(client, token, valid_until=_at(3)).status_code == 201
    _expire(s4, quotes_of(s4, t["id"])["quotes"][-1]["id"])
    q = quotes_of(s4, t["id"])["quotes"][-1]
    r = decide_quote(s4, t["id"], "approve", quote=q)
    assert r.status_code == 409 and r.json()["code"] == "quote_expired", r.text
    assert quotes_of(s4, t["id"])["quotes"][-1]["state"] == "submitted", "nothing changed by the refusal"
    assert decide_quote(s4, t["id"], "approve", quote=q, confirm_expired="maybe").status_code == 422
    r = decide_quote(s4, t["id"], "approve", quote=q, confirm_expired=True)
    assert r.status_code == 200 and r.json()["quotes"][-1]["state"] == "approved", r.text


def test_an_expired_quote_can_still_be_rejected_without_the_flag(s4):
    t, token, client = sent(s4)
    assert vendor_quote(client, token, valid_until=_at(3)).status_code == 201
    _expire(s4, quotes_of(s4, t["id"])["quotes"][-1]["id"])
    assert decide_quote(s4, t["id"], "reject", reason="פג תוקף").status_code == 200


def test_a_quote_with_a_future_or_no_validity_approves_without_the_flag(s4):
    t, token, client = sent(s4)
    assert vendor_quote(client, token, valid_until=_at(3)).status_code == 201
    assert decide_quote(s4, t["id"], "approve").status_code == 200
    t2, token2, client2 = sent(s4)
    assert vendor_quote(client2, token2).status_code == 201
    assert decide_quote(s4, t2["id"], "approve").status_code == 200
