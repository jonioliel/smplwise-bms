"""TKRFQ4 - requests for quotation, stage C4: the WORK ORDER of an award, over the REAL store (docs/tickets/RFQ_BACKEND_CONTRACT.md
section 16; RFQ_SPEC_DRAFT.md section 9, owner decisions 16.10). Negative first: not awarded, a pending second approval, a declined
award, a vendor removed / turned staff, a closed request, a double create, another department, the permission matrix; then the order
itself - one service request per awarded vendor (linked), the awarded quote as the baseline, NO message until the manager's explicit
send (with a preview of the exact text), the vendor that was not selected never messaged, `ordered` once every award has its order.
Every name and number here is invented (the 050-000-xxxx block, example.test hosts)."""
from __future__ import annotations

import json
import uuid

import pytest

from smplwise.services.tickets import rfq as rfq_mod
from test_tickets_rfq import (CHEAP, award, compare, detail, kim, outbox_count, quote_row, quoted, s4, sent_rfq, vid,  # noqa: F401
                              whatsapp_on)
from tickets_s4_world import API


def key() -> str:
    return f"ord-{uuid.uuid4().hex[:16]}"


def awarded(s4, settings, *, split: bool = False, user: str = "kim") -> tuple[dict, dict]:
    """A sent request with two quotes; one award (the vendor), or a split by kind (labour -> the vendor, parts -> the person)."""
    kim(s4, settings)
    d = sent_rfq(s4)
    v1, v2 = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    quoted(s4, d["id"], v1)
    quoted(s4, d["id"], v2, lines=CHEAP)
    cmp = compare(s4, d["id"])
    if split:
        r = award(s4, d["id"], quote_row(cmp, v1), user=user, kinds=["labor"], finalize=False)
        assert r.status_code == 201, r.text
        r = award(s4, d["id"], quote_row(compare(s4, d["id"]), v2), user=user, kinds=["parts"], finalize=True)
    else:
        r = award(s4, d["id"], quote_row(cmp, v1), user=user)
    assert r.status_code == 201, r.text
    return detail(s4, d["id"]), {"v1": v1, "v2": v2}


def award_of(d: dict, vendor_id: str) -> dict:
    return next(a for a in d["awards"] if a["vendor_id"] == vendor_id and a["state"] == "approved")


def order(s4, rid: str, award_id: str, user: str = "mona", **body):
    payload = {"request_key": body.pop("request_key", None) or key(), **body}
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/awards/{award_id}/order", json=payload, headers=s4.h(user))


def ordered(s4, rid: str, award_id: str, user: str = "mona", **body) -> dict:
    r = order(s4, rid, award_id, user, **body)
    assert r.status_code == 201, r.text
    return r.json()


def outbox_rows(s4) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM ticket_outbox ORDER BY created_at, id")]


def ticket(s4, ticket_id: str, user: str = "joni") -> dict:
    r = s4.c.get(f"{API}/tickets/{ticket_id}", headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- refusals first

def test_an_award_that_is_not_final_opens_nothing(s4, settings):
    kim(s4, settings, "kim", "lea")
    r = s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": 100000})
    assert r.status_code == 200
    d = sent_rfq(s4)
    v = vid(d, s4.vendor["id"])
    quoted(s4, d["id"], v)
    a = award(s4, d["id"], quote_row(compare(s4, d["id"]), v), user="kim").json()["award"]
    assert a["state"] == "pending_second"
    r = order(s4, d["id"], a["id"])
    assert r.status_code == 409 and r.json()["code"] == "award_pending", r.text
    assert detail(s4, d["id"], "mona")["awards"][0]["can"]["order"] is False
    # declined by the second approver: no order either
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/decline", json={"revision": a["revision"], "reason": "יקר מדי"}, headers=s4.h("lea"))
    assert r.status_code == 200, r.text
    r = order(s4, d["id"], a["id"])
    assert r.status_code == 409 and r.json()["code"] == "rfq_invalid_transition"
    assert order(s4, d["id"], "no-such-award").json()["code"] == "award_not_found"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == 0


def test_a_request_without_an_award_or_closed_opens_nothing(s4, settings):
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": d["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["state"] == "closed"
    r = order(s4, d["id"], a["id"])
    assert r.status_code == 409 and r.json()["code"] == "rfq_invalid_transition" and r.json()["details"]["from"] == "closed"
    assert detail(s4, d["id"], "mona")["can"]["order"] is False


def test_a_removed_vendor_or_a_contact_that_became_staff_is_refused(s4, settings):
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET employee = 1 WHERE id = ?", (s4.vendor["id"],))
    r = order(s4, d["id"], a["id"])
    assert r.status_code == 409 and r.json()["code"] == "vendor_not_allowed" and r.json()["details"]["reason"] == "employee", r.text
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_contacts SET employee = 0 WHERE id = ?", (s4.vendor["id"],))
        conn.execute("UPDATE ticket_rfq_vendors SET state = 'removed' WHERE id = ?", (vs["v1"],))
    r = order(s4, d["id"], a["id"])
    assert r.status_code == 409 and r.json()["details"]["reason"] == "vendor_state"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM ticket_assignments").fetchone()[0] == 0


def test_the_permission_matrix_and_another_department(s4, settings):
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    for user in ("cleo", "nora", "vic"):  # another department's manager, a non-member, no ticket permission: the uniform 404
        r = order(s4, d["id"], a["id"], user)
        assert r.status_code in (403, 404), (user, r.text)
        if r.status_code == 404:
            assert r.json()["code"] in ("rfq_not_found", "feature_disabled"), user
    for user in ("tom", "alda"):  # a member; all departments without manage / external: an audited 403
        r = order(s4, d["id"], a["id"], user)
        assert r.status_code == 403, (user, r.text)
        assert detail(s4, d["id"], user)["can"]["order"] is False
    r = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/preview", headers=s4.h("tom"))
    assert r.status_code == 403
    with s4.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ticket.rfq.order' AND decision = 'denied'").fetchone()[0]
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == 0
    assert denied >= 2
    assert detail(s4, d["id"], "mona")["can"]["order"] is True
    assert order(s4, d["id"], a["id"], "mona").status_code == 201


def test_a_double_create_replays_or_is_refused(s4, settings):
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    k = key()
    first = ordered(s4, d["id"], a["id"], request_key=k)
    again = order(s4, d["id"], a["id"], request_key=k)
    assert again.status_code == 201 and again.json()["ticket"] == first["ticket"] and again.json()["replayed"] is True
    other = order(s4, d["id"], a["id"])
    assert other.status_code == 409 and other.json()["code"] == "order_exists" and other.json()["details"]["ticket_id"] == first["ticket"]["id"]
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == 1


def test_bad_dates_are_refused_before_anything_is_written(s4, settings):
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    r = order(s4, d["id"], a["id"], work_from="2099-13-40", work_to=None)
    assert r.status_code == 422
    from test_tickets_rfq import _at

    r = order(s4, d["id"], a["id"], work_from=_at(days=6), work_to=_at(days=5))
    assert r.status_code == 422 and r.json()["details"]["fields"][0] == {"field": "work_to", "code": "order"}
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0] == 0


# ---------------------------------------------------------------- the order: the request, the baseline, no message

def test_the_order_opens_one_request_with_the_baseline_and_sends_nothing(s4, settings, monkeypatch):
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    whatsapp_on(s4)  # a channel exists: the assignment WOULD queue its message - the order must not
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    assert award_of(detail(s4, d["id"], "tom"), vs["v1"])["can"]["order"] is False, "the board flags are per viewer"
    mine = award_of(detail(s4, d["id"], "mona"), vs["v1"])
    assert mine["can"]["order"] is True and mine["order"] is None and mine["order_defaults"]["work_from"]
    assert mine["scope"]["kind"] == "all"
    before = outbox_count(s4)
    out = ordered(s4, d["id"], a["id"], documents="נוהל עבודה בגובה, אישור כניסת קבלנים")
    assert outbox_count(s4) == before, "creating the order never sends anything (owner rule)"
    tid = out["ticket"]["id"]
    assert out["rfq"]["state"] == "ordered" and out["award"]["order"]["ticket"]["id"] == tid and out["award"]["can"]["send_order"] is True
    t = ticket(s4, tid, "mona")
    assert t["status"] == "assigned" and t["assignments"][-1]["kind"] == "contact"
    assert t["rfq_origin"]["ref"] == d["ref"] and t["rfq_origin"]["id"] == d["id"] and t["rfq_origin"]["siblings"] == []
    assert d["ref"] in t["description"] and "נוהל עבודה בגובה" in t["description"] and "1,298" not in t["description"]
    assert t["internal_owner"]["source"] == "rfq"
    q = s4.c.get(f"{API}/tickets/{tid}/quotes").json()
    assert q["baseline"]["quote_id"] == a["quote_id"] and q["flow"]["stage"] == "quote_approved", q
    with s4.db.connection(mode="read") as conn:
        link = conn.execute("SELECT sent_via FROM ticket_links WHERE ticket_id = ?", (tid,)).fetchone()
        audit_rows = [r[0] for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.order'")]
    assert link is not None and link[0] is None, "the handler link exists; it has not left yet"
    assert "נוהל" not in json.dumps(audit_rows, ensure_ascii=False), "audit rows carry ids only"


def test_the_explicit_send_previews_the_exact_text_and_messages_only_the_awarded_vendor(s4, settings, monkeypatch):
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    whatsapp_on(s4)
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    out = ordered(s4, d["id"], a["id"])
    tid = out["ticket"]["id"]
    pv = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/preview", headers=s4.h("mona"))
    assert pv.status_code == 200, pv.text
    p = pv.json()
    assert p["refusals"] == [] and p["channel"] == "whatsapp" and p["sent"] is False
    assert d["title"] in p["text"] and "[קישור]" in p["text"] and "₪" not in p["text"] and "1298" not in p["text"].replace(",", "")
    before = outbox_count(s4)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/send", headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert r.json()["notified"]["queued"] is True and r.json()["award"]["order"]["sent"]["channel"] == "whatsapp"
    again = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/send", headers=s4.h("mona"))
    assert again.status_code == 200 and again.json()["notified"]["already"] is True
    rows = outbox_rows(s4)
    new = rows[before:]
    assert len(new) == 1, "one message, one click"
    row = new[0]
    assert (row["purpose"], row["ticket_id"], row["rfq_id"], row["contact_id"]) == ("rfq_order", tid, d["id"], s4.vendor["id"])
    with s4.db.connection(mode="read") as conn:
        link_id = conn.execute("SELECT id FROM ticket_links WHERE ticket_id = ?", (tid,)).fetchone()[0]
    assert row["link_id"] == link_id
    params = json.loads(row["params_json"])
    assert set(params) <= {"name", "number", "title", "place", "department", "organization", "due", "window"}
    assert all(r["contact_id"] != s4.contact["id"] or r["purpose"] == "rfq_invite" for r in rows), "the vendor not selected gets no order"
    assert not any(r["purpose"] in ("assign", "rfq_order") and r["contact_id"] == s4.contact["id"] for r in rows)
    assert not any(r["purpose"] == "assign" for r in rows), "the assignment's own message was never queued"
    assert s4.c.get(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/preview", headers=s4.h("mona")).json()["sent"] is True


def test_without_a_channel_the_send_is_refused_and_says_why(s4, settings):
    d, vs = awarded(s4, settings)  # WhatsApp off, no e-mail: the manager copies the link from the request
    a = award_of(d, vs["v1"])
    ordered(s4, d["id"], a["id"])
    p = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/preview", headers=s4.h("mona")).json()
    assert "order_channel_unavailable" in p["refusals"] and p["text"]
    before = outbox_count(s4)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/send", headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] == "order_channel_unavailable"
    assert outbox_count(s4) == before
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/no-such/order/send", headers=s4.h("mona"))
    assert r.status_code == 404


def test_a_send_before_the_order_or_after_the_request_closed_is_refused(s4, settings, monkeypatch):
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    whatsapp_on(s4)
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/send", headers=s4.h("mona"))
    assert r.status_code == 404 and r.json()["code"] == "order_not_found"
    tid = ordered(s4, d["id"], a["id"])["ticket"]["id"]
    rev = ticket(s4, tid)["revision"]
    r = s4.c.post(f"{API}/tickets/{tid}/status", json={"to": "cancelled", "note": "בוטל", "revision": rev}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    before = outbox_count(s4)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/order/send", headers=s4.h("mona"))
    assert r.status_code == 409 and r.json()["code"] in ("order_ticket_closed", "order_link_unavailable"), r.text
    assert outbox_count(s4) == before


def test_a_split_award_opens_one_request_per_vendor_linked_to_each_other(s4, settings, monkeypatch):
    monkeypatch.setattr(rfq_mod, "VENDOR_PAGE", True)
    whatsapp_on(s4)
    d, vs = awarded(s4, settings, split=True)
    a1, a2 = award_of(d, vs["v1"]), award_of(d, vs["v2"])
    mine = detail(s4, d["id"], "mona")
    assert award_of(mine, vs["v1"])["scope"] == {"kind": "kinds", "kinds": ["labor"], "lines": 1}
    before = outbox_count(s4)
    t1 = ordered(s4, d["id"], a1["id"])
    assert t1["rfq"]["state"] == "awarded", "one order of two: still awarded"
    t2 = ordered(s4, d["id"], a2["id"])
    assert t2["rfq"]["state"] == "ordered"
    assert outbox_count(s4) == before
    id1, id2 = t1["ticket"]["id"], t2["ticket"]["id"]
    assert id1 != id2
    o1, o2 = ticket(s4, id1, "mona")["rfq_origin"], ticket(s4, id2, "mona")["rfq_origin"]
    assert [s["id"] for s in o1["siblings"]] == [id2] and [s["id"] for s in o2["siblings"]] == [id1]
    assert "עבודה" in ticket(s4, id1)["description"] and "חלקים" in ticket(s4, id2)["description"]
    q1 = s4.c.get(f"{API}/tickets/{id1}/quotes").json()["baseline"]
    q2 = s4.c.get(f"{API}/tickets/{id2}/quotes").json()["baseline"]
    assert q1["line_kinds"] == ["labor"] and q2["line_kinds"] == ["parts"]


def test_a_limited_viewer_learns_nothing_about_the_rfq_and_a_deletion_keeps_the_request(s4, settings):
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    tid = ordered(s4, d["id"], a["id"])["ticket"]["id"]
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}")
    assert r.status_code == 200, r.text
    t = ticket(s4, tid)
    assert t["rfq_origin"] is None
    q = s4.c.get(f"{API}/tickets/{tid}/quotes").json()
    assert q["baseline"]["quote_id"] == a["quote_id"], "the baseline stays with the request"


def test_the_order_rows_carry_ids_and_dates_only(s4, settings):
    d, vs = awarded(s4, settings)
    a = award_of(d, vs["v1"])
    ordered(s4, d["id"], a["id"], documents="תוכנית קומה סודית")
    with s4.db.connection(mode="read") as conn:
        events = [dict(r) for r in conn.execute("SELECT kind, data_json FROM ticket_rfq_events WHERE kind LIKE 'order_%'")]
    assert [e["kind"] for e in events] == ["order_created"]
    data = json.loads(events[0]["data_json"])
    assert set(data) == {"award_id", "ticket_id", "ticket_number", "assignment_id", "quote_id", "work_from", "work_to", "documents"}
    assert data["documents"] is True and "סודית" not in events[0]["data_json"]
    kinds = [e["kind"] for e in detail(s4, d["id"])["timeline"]]
    assert "order_created" in kinds
