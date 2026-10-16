"""TKRFQVP - the PUBLIC vendor quote page of a request for quotation (docs/tickets/RFQ_BACKEND_CONTRACT.md section 15), over the REAL
store and the real public app (driven through an ASGI test client, as the ticket handler page's tests do).

Negative cases first: a wrong token, a ticket token on the RFQ routes and the other way round, another vendor's quote, the deadline,
a cancelled request (read-only grace, then the uniform 404), a contact that became staff, a code required but missing, the write
budget (429), and no leakage of other vendors' data. Then the vendor's own flows: open, quote (idempotent, base_version), withdraw,
"not interested", the clarification thread, the awarded / closed states, the e-mail redeem form, and the manager's per-vendor code
switch (owner decision 16.10: OFF by default). Every name and number here is invented (the 050-000-xxxx block, example.test hosts)."""
from __future__ import annotations

import datetime as dt
import json
import time

import pytest
from conftest import bind

from smplwise.services.tickets import links, rfq_links, store_rfq
from smplwise.services.tickets.keyring import KEYS
from smplwise.services.tickets.public_http import UNIFORM_404
from tickets_s4_world import API, BASE_URL, Clock, build_s4, crid

QUOTE = [{"kind": "labor", "hours": "2", "rate": "150"}, {"kind": "parts", "description": "מדחס", "quantity": "1", "unit_price": "800"}]
DAY = 86400.0


def _at(days: float = 0) -> str:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    rev = world.c.get(f"{API}/tickets/channel").json()["revision"]
    assert world.c.put(f"{API}/tickets/channel", json={"revision": rev, "whatsapp": {"enabled": True}}).status_code == 200
    return world


def add_vendor(s4, name: str, phone: str, **extra) -> dict:
    r = s4.add_contact(kind="vendor", display_name=name, phone=phone, **extra)
    assert r.status_code == 201, r.text
    return r.json()


def detail(s4, rid: str, user: str = "joni") -> dict:
    r = s4.c.get(f"{API}/tickets/rfqs/{rid}", headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()


def sent_rfq(s4, vendors: list[dict] | None = None, **body) -> dict:
    """A request sent by WhatsApp to two vendors (personal links minted)."""
    vendors = vendors if vendors is not None else [{"contact_id": s4.vendor["id"]}, {"contact_id": s4.contact["id"]}]
    payload = {"department_id": "dept-maintenance", "title": "החלפת מזגן בחדר הישיבות", "description": "היחידה דולפת",
               "place_text": "קומה 3, חדר ישיבות", "due_at": _at(3), "work_from": _at(5), "work_to": _at(10), "vendors": vendors,
               "client_request_id": crid(), **body}
    r = s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    d = r.json()
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/send", json={"revision": d["revision"], "channel": "auto", "client_request_id": crid()},
                  headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    return detail(s4, d["id"])


def vid(d: dict, contact_id: str) -> str:
    return next(v["id"] for v in d["vendors"] if v["contact"]["id"] == contact_id)


def token(s4, rv_id: str) -> str:
    with s4.db.connection(mode="read") as conn:
        row = store_rfq.link_of_vendor(conn, rv_id)
    assert row is not None
    return rfq_links.token_of(row)


def pub(s4, clock: Clock | None = None):
    c, _app = s4.public(clock or Clock(time.time()))
    return c


def hdr(tok: str, session: str | None = None) -> dict[str, str]:
    h = {"x-ticket-token": tok}
    if session:
        h["x-ticket-session"] = session
    return h


def quote(c, tok: str, *, base=None, lines=None, rid: str | None = None, **body):
    return c.post("/t/api/rfq/quote", json={"lines": lines or QUOTE, "base_version": base, "client_request_id": rid or crid(), **body},
                  headers=hdr(tok))


def view(c, tok: str) -> dict:
    r = c.get("/t/api/rfq", headers=hdr(tok))
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- negative cases first

def test_a_wrong_token_and_tokens_of_the_other_domain_are_the_uniform_404(s4):
    d = sent_rfq(s4)
    tok = token(s4, vid(d, s4.vendor["id"]))
    _t, ticket_tok = s4.sent()
    c = pub(s4)
    answers = [c.get("/t/api/rfq", headers=hdr("A" * 32)), c.get("/t/api/rfq", headers=hdr(ticket_tok)), c.get("/t/api/rfq"),
               c.get("/t/api/ticket", headers=hdr(tok)), c.get("/t/api/quote", headers=hdr(tok)),
               c.post("/t/api/rfq/quote", json={"lines": QUOTE, "client_request_id": crid()}, headers=hdr(ticket_tok))]
    assert [a.status_code for a in answers] == [404] * 6
    assert {a.content for a in answers} == {UNIFORM_404}, "byte-identical: nothing tells a ticket link from an unknown one"
    assert c.get("/t/api/rfq", headers=hdr(tok)).status_code == 200


def test_another_vendors_quote_cannot_be_withdrawn_and_reads_like_a_closed_one(s4):
    d = sent_rfq(s4)
    a, b = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    c = pub(s4)
    qa = quote(c, token(s4, a))
    assert qa.status_code == 201, qa.text
    r = c.post("/t/api/rfq/withdraw", json={"quote_id": qa.json()["quote"]["id"], "client_request_id": crid()}, headers=hdr(token(s4, b)))
    assert r.status_code == 409 and r.json() == {"code": "quote_closed", "reason": "quote"}
    assert view(c, token(s4, a))["quote"]["state"] == "submitted"


def test_writes_stop_at_the_deadline(s4):
    d = sent_rfq(s4)
    tok = token(s4, vid(d, s4.vendor["id"]))
    clock = Clock(time.time())
    c = pub(s4, clock)
    assert quote(c, tok).status_code == 201
    clock.advance(4 * DAY)
    v = view(c, tok)
    assert v["page_state"] == "due_passed" and not any(v["can"].values()) and v["quote"]["state"] == "submitted"
    for r in (quote(c, tok, base=1), c.post("/t/api/rfq/decline", json={"client_request_id": crid()}, headers=hdr(tok)),
              c.post("/t/api/rfq/message", json={"text": "שאלה", "client_request_id": crid()}, headers=hdr(tok)),
              c.post("/t/api/rfq/withdraw", json={"quote_id": v["quote"]["id"], "client_request_id": crid()}, headers=hdr(tok))):
        assert r.status_code == 409 and r.json()["code"] == "rfq_due_passed", r.text


def test_a_cancelled_request_is_read_only_then_the_uniform_404(s4):
    d = sent_rfq(s4)
    tok = token(s4, vid(d, s4.vendor["id"]))
    clock = Clock(time.time())
    c = pub(s4, clock)
    assert quote(c, tok).status_code == 201
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/cancel", json={"revision": detail(s4, d["id"])["revision"], "reason": "סיבה פנימית",
                                                                "notify": False}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    v = view(c, tok)
    assert v["page_state"] == "cancelled" and v["read_only"] and v["read_only_until"]
    assert v["quote"] is None and v["messages"] == [] and "סיבה פנימית" not in json.dumps(v, ensure_ascii=False)
    w = quote(c, tok, base=1)
    assert w.status_code == 409 and w.json()["code"] == "read_only"
    clock.advance(25 * 3600)
    assert c.get("/t/api/rfq", headers=hdr(tok)).content == UNIFORM_404


def test_a_contact_that_became_staff_or_was_removed_is_the_uniform_404(s4):
    d = sent_rfq(s4)
    a, b = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    ta, tb = token(s4, a), token(s4, b)
    c = pub(s4)
    assert c.get("/t/api/rfq", headers=hdr(tb)).status_code == 200
    with s4.db.connection() as conn:  # the directory row turned into an employee after the invitation (fail closed)
        conn.execute("UPDATE ticket_contacts SET employee = 1 WHERE id = ?", (s4.contact["id"],))
    assert c.get("/t/api/rfq", headers=hdr(tb)).content == UNIFORM_404
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/remove", json={"revision": detail(s4, d["id"])["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert c.get("/t/api/rfq", headers=hdr(ta)).content == UNIFORM_404


def test_a_required_code_hides_the_request_and_blocks_every_write(s4):
    d = sent_rfq(s4)
    a = vid(d, s4.vendor["id"])
    tok = token(s4, a)
    c = pub(s4)
    assert view(c, tok)["code_required"] is False, "owner decision 16.10: the code is OFF by default"
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/options", json={"revision": detail(s4, d["id"])["revision"], "require_code": True},
                  headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert next(v for v in r.json()["vendors"] if v["id"] == a)["require_code"] is True
    v = view(c, tok)
    assert v["code_required"] is True and v["code_ok"] is False
    assert set(v) == {"kind", "ref", "organization", "department", "lang", "dir", "theme", "time_zone", "code_required", "code_ok",
                      "read_only", "read_only_until", "code_locked_s"}, "a forwarded link alone shows only that a request exists"
    w = quote(c, tok)
    assert w.status_code == 403 and w.json()["code"] == "code_required"
    bad = c.post("/t/api/rfq/code/verify", json={"code": "123456"}, headers=hdr(tok))
    assert bad.status_code == 422 and bad.json()["code"] in ("code_missing", "code_invalid")
    fake = c.get("/t/api/rfq", headers=hdr(tok, "S" * 43))
    assert fake.status_code == 200 and fake.json()["code_ok"] is False


def test_the_code_routes_answer_code_not_required_when_it_is_off(s4):
    d = sent_rfq(s4)
    tok = token(s4, vid(d, s4.vendor["id"]))
    c = pub(s4)
    for path, body in (("/t/api/rfq/code/send", {}), ("/t/api/rfq/code/verify", {"code": "123456"})):
        r = c.post(path, json=body, headers=hdr(tok))
        assert r.status_code == 409 and r.json()["code"] == "code_not_required"


def test_the_write_budget_is_the_ticket_routes_one(s4):
    d = sent_rfq(s4)
    tok = token(s4, vid(d, s4.vendor["id"]))
    c = pub(s4)
    codes = [c.post("/t/api/rfq/message", json={"text": f"שאלה {i}", "client_request_id": crid()}, headers=hdr(tok)).status_code
             for i in range(21)]
    assert codes[:20] == [201] * 20 and codes[20] == 429, codes
    r = c.post("/t/api/rfq/message", json={"text": "x", "client_request_id": crid()}, headers=hdr(tok))
    assert r.status_code == 429 and "retry-after" in r.headers


def test_no_answer_leaks_another_vendor_or_an_internal_field(s4, settings):
    other = add_vendor(s4, "אקלים פלוס בע״מ", "050-000-0077")
    d = sent_rfq(s4, vendors=[{"contact_id": s4.vendor["id"]}, {"contact_id": other["id"]}])
    a, b = vid(d, s4.vendor["id"]), vid(d, other["id"])
    c = pub(s4)
    assert quote(c, token(s4, b), lines=[{"kind": "labor", "hours": "3", "rate": "777"}]).status_code == 201
    m = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{b}/messages", json={"text": "תשובה פרטית לספק השני", "notify": False},
                  headers=s4.h("mona"))
    assert m.status_code == 201, m.text
    body = json.dumps(view(c, token(s4, a)), ensure_ascii=False)
    for secret in ("אקלים פלוס", "233100", "777", "תשובה פרטית", b, other["id"], "mona", "Mona", "kpis", "lowest", "awards", "vendors",
                   "internal_owner", "created_by", "source_ticket", "floor_id", "key_id", "token"):
        assert secret not in body, secret


# ---------------------------------------------------------------- the vendor's own flows

def test_open_quote_replay_and_a_stale_form(s4):
    d = sent_rfq(s4)
    a = vid(d, s4.vendor["id"])
    tok = token(s4, a)
    c = pub(s4)
    v = view(c, tok)
    assert v["kind"] == "rfq" and v["ref"] == d["ref"] and v["page_state"] == "open" and v["quote"] is None
    assert v["rfq"]["title"] == "החלפת מזגן בחדר הישיבות" and v["rfq"]["place_text"] == "קומה 3, חדר ישיבות" and v["rfq"]["attachments"] == []
    assert v["can"] == {"quote": True, "withdraw": False, "decline": True, "ask": True}
    dd = detail(s4, d["id"])
    assert dd["state"] == "collecting" and next(x for x in dd["vendors"] if x["id"] == a)["state"] == "opened"
    rid = crid()
    first = quote(c, tok, rid=rid, valid_until=_at(30), vendor_ref="Q-2026-17", note="כולל פינוי", work_from=_at(6), work_to=_at(7))
    again = quote(c, tok, rid=rid, valid_until=_at(30), vendor_ref="Q-2026-17", note="כולל פינוי", work_from=_at(6), work_to=_at(7))
    assert first.status_code == again.status_code == 201 and first.json() == again.json()
    q = first.json()["quote"]
    assert q["version"] == 1 and q["state"] == "submitted" and q["total_minor"] > 0 and q["in_window"] is True and q["valid_until"]
    with s4.db.connection(mode="read") as conn:
        rows = store_rfq.quotes_of_vendor(conn, a)
    assert len(rows) == 1 and rows[0]["source"] == "vendor" and rows[0]["created_by_kind"] == "contact"
    stale = quote(c, tok, base=None)
    assert stale.status_code == 409 and stale.json() == {"code": "quote_changed", "version": 1}
    second = quote(c, tok, base=1, work_from=_at(20))
    assert second.status_code == 201 and second.json()["quote"]["version"] == 2 and second.json()["quote"]["in_window"] is False
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    assert [(x["vendor_id"], x["version"], x["source"]) for x in cmp["quotes"]] == [(a, 2, "vendor")]
    bad = quote(c, tok, base=2, lines=[{"kind": "travel", "amount": "50"}])
    assert bad.status_code == 422 and bad.json()["fields"][0]["code"] == "kind_not_allowed"
    totals = quote(c, tok, base=2, total_minor=1)
    assert totals.status_code == 422, "client totals are not even accepted"


def test_withdraw_decline_and_quote_again(s4):
    d = sent_rfq(s4)
    a = vid(d, s4.vendor["id"])
    tok = token(s4, a)
    c = pub(s4)
    q = quote(c, tok).json()["quote"]
    r = c.post("/t/api/rfq/decline", json={"reason": "עמוס", "client_request_id": crid()}, headers=hdr(tok))
    assert r.status_code == 409 and r.json()["code"] == "quote_exists"
    assert c.post("/t/api/rfq/withdraw", json={"quote_id": q["id"], "client_request_id": crid()}, headers=hdr(tok)).status_code == 200
    assert view(c, tok)["quote"]["state"] == "withdrawn"
    assert c.post("/t/api/rfq/decline", json={"reason": "עמוס החודש", "client_request_id": crid()}, headers=hdr(tok)).status_code == 200
    v = view(c, tok)
    assert v["page_state"] == "declined" and v["declined"]["reason"] == "עמוס החודש" and v["can"]["quote"] and not v["can"]["decline"]
    assert next(x for x in detail(s4, d["id"])["vendors"] if x["id"] == a)["state"] == "declined"
    assert quote(c, tok).status_code == 201
    assert view(c, tok)["page_state"] == "open"


def test_a_clarification_is_stored_only_and_the_answer_reaches_the_page(s4):
    d = sent_rfq(s4)
    a = vid(d, s4.vendor["id"])
    tok = token(s4, a)
    c = pub(s4)
    with s4.db.connection(mode="read") as conn:
        before = conn.execute("SELECT COUNT(*) FROM ticket_outbox").fetchone()[0]
    r = c.post("/t/api/rfq/message", json={"text": "האם יש חניה?", "client_request_id": crid()}, headers=hdr(tok))
    assert r.status_code == 201 and r.json()["message"]["mine"] is True
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_outbox").fetchone()[0] == before, "nothing is sent anywhere"
    items = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages", headers=s4.h("joni")).json()["items"]
    assert [(i["direction"], i["text"]) for i in items] == [("in", "האם יש חניה?")]
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages", json={"text": "כן, בחניון התחתון", "notify": False},
                     headers=s4.h("mona")).status_code == 201
    msgs = view(c, tok)["messages"]
    assert [(m["mine"], m["text"]) for m in msgs] == [(True, "האם יש חניה?"), (False, "כן, בחניון התחתון")]
    assert set(msgs[1]) == {"id", "mine", "text", "at"}, "no author name"
    empty = c.post("/t/api/rfq/message", json={"text": "   ", "client_request_id": crid()}, headers=hdr(tok))
    assert empty.status_code == 422


def test_the_awarded_vendor_sees_his_award_and_the_others_only_a_closed_request(s4, settings):
    bind(s4.c, settings, "kim", "system_admin", "installation", "*")
    d = sent_rfq(s4)
    a, b = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    c = pub(s4)
    assert quote(c, token(s4, a)).status_code == 201
    assert quote(c, token(s4, b), lines=[{"kind": "labor", "hours": "1", "rate": "99"}]).status_code == 201
    cmp = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    qa = next(x for x in cmp["quotes"] if x["vendor_id"] == a)
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards", json={"quote_id": qa["quote_id"], "revision": qa["revision"]}, headers=s4.h("kim"))
    assert r.status_code == 201, r.text
    va, vb = view(c, token(s4, a)), view(c, token(s4, b))
    assert va["page_state"] == "awarded" and va["quote"]["state"] == "awarded" and va["quote"]["approved"]["total_minor"] == qa["total_minor"]
    assert vb["page_state"] == "closed" and vb["quote"] is None and vb["messages"] == [] and not any(vb["can"].values())
    assert str(qa["total_minor"]) not in json.dumps(vb)


def test_the_email_form_redeems_an_rfq_link(s4):
    d = sent_rfq(s4)
    a = vid(d, s4.vendor["id"])
    with s4.db.connection() as conn:
        row = store_rfq.link_of_vendor(conn, a)
        url = rfq_links.redeem_url(conn, row["id"], dt.datetime.now(dt.timezone.utc))
    assert url and url.startswith(f"{BASE_URL}/support/r/"), "the TK255 public prefix, like a ticket link"
    rid = url.rsplit("/", 1)[1]
    c = pub(s4)
    r = c.post("/t/api/redeem", json={"rid": rid})
    assert r.status_code == 200 and r.json() == {"token": token(s4, a), "kind": "rfq"}
    assert view(c, r.json()["token"])["kind"] == "rfq"
    assert c.post("/t/api/redeem", json={"rid": "0" * 32}).content == UNIFORM_404


def test_the_invitation_url_marks_an_rfq_link(s4):
    d = sent_rfq(s4)
    with s4.db.connection() as conn:
        row = store_rfq.link_of_vendor(conn, vid(d, s4.vendor["id"]))
        url = rfq_links.url(conn, row)
    tok = links.derive_token(KEYS.get(row["key_id"]), row["id"], int(row["generation"]), domain="rfq")
    assert url == f"{BASE_URL}/support/#q.{tok}"


# ---------------------------------------------------------------- the manager's per-vendor options (contract 15.6)

def test_meta_announces_vendor_options_and_create_takes_the_code_choice(s4):
    assert s4.c.get(f"{API}/tickets/rfqs/meta", headers=s4.h("mona")).json()["vendor_options"] is True
    payload = {"department_id": "dept-maintenance", "title": "בדיקת לוח חשמל", "due_at": _at(3), "client_request_id": crid(),
               "vendors": [{"contact_id": s4.vendor["id"], "channel": "manual", "require_code": True}, {"contact_id": s4.contact["id"]}]}
    r = s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    vs = {v["contact"]["id"]: v for v in r.json()["vendors"]}
    assert (vs[s4.vendor["id"]]["require_code"], vs[s4.vendor["id"]]["channel_choice"]) == (True, "manual")
    assert (vs[s4.contact["id"]]["require_code"], vs[s4.contact["id"]]["channel_choice"]) == (False, "auto"), "off by default"
    d = r.json()
    s = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/send", json={"revision": d["revision"], "channel": "auto", "client_request_id": crid()},
                  headers=s4.h("mona"))
    assert s.status_code == 200 and s.json()["sent"]["channels"] == {"manual": 1, "whatsapp": 1}, s.text


def test_a_code_the_directory_demands_cannot_be_lowered(s4):
    strict = add_vendor(s4, "חשמל בטוח", "050-000-0066", require_code=True)
    payload = {"department_id": "dept-maintenance", "title": "בדיקת לוח חשמל", "due_at": _at(3), "client_request_id": crid(),
               "vendors": [{"contact_id": strict["id"], "require_code": False}]}
    r = s4.c.post(f"{API}/tickets/rfqs", json=payload, headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    v = r.json()["vendors"][0]
    assert v["require_code"] is True
    o = s4.c.post(f"{API}/tickets/rfqs/{r.json()['id']}/vendors/{v['id']}/options", json={"revision": r.json()["revision"], "require_code": False},
                  headers=s4.h("mona"))
    assert o.status_code == 409 and o.json()["code"] == "vendor_code_locked"


def test_the_vendor_options_route_needs_an_rfq_manager(s4):
    d = sent_rfq(s4)
    a = vid(d, s4.vendor["id"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/options", json={"revision": d["revision"], "require_code": True},
                  headers=s4.h("tom"))
    assert r.status_code in (403, 404)
    ch = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/options", json={"revision": d["revision"], "channel": "email"},
                   headers=s4.h("mona"))
    assert ch.status_code == 409 and ch.json()["code"] == "rfq_field_locked", "the channel is fixed once the vendor was invited"
