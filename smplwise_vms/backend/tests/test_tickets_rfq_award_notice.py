"""CR-AWARD-NOTICE (docs/changes/CR-AWARD-NOTICE.md; RFQ contract 20.16 / 20.17) over the REAL store, the real internal API and the real
public app: (1) the award notice - "your quote is approved and BINDING; give notice in advance through the link if you postpone" - a
fixed, code-owned variant of the `rfq_update` outbox purpose, behind `rfq.award_notice` (confirm by default / auto / off), once per award;
(2) the vendor's postponement notice through his link (POST /t/api/rfq/arrival `action: postpone`).

PUBLIC SURFACE - negative cases first: a wrong token / another domain's token (the uniform 404), before the award, a vendor that was not
awarded, a pending second approval, after the work is done, an over-long / missing reason, a past date, foreign fields, a replay, a second
open notice, the edge's write budget (429). Text hygiene: the reason is cleaned and never reaches a notification, an audit row, the
timeline or the outbox. Every name and number here is invented (the 050-000-xxxx block, example.test hosts)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import bind

from smplwise.services.tickets import message_templates as mt
from smplwise.services.tickets import rfq_award_notice, rfq_postpone, store_rfq
from smplwise.services.tickets.public_http import UNIFORM_404
from test_tickets_rfq_public import detail, hdr, pub, sent_rfq, token, vid, view
from test_tickets_rfq_terms import _at, award, pquote, switch
from tickets_s4_world import API, crid

REASON = "הספק של המדחס דחה את המשלוח בשבוע"


@pytest.fixture()
def s4(settings, monkeypatch):
    from tickets_s4_world import build_s4

    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    bind(world.c, settings, "kim", "system_admin", "installation", "*")  # the approver (tickets.costs + view)
    rev = world.c.get(f"{API}/tickets/channel").json()["revision"]
    assert world.c.put(f"{API}/tickets/channel", json={"revision": rev, "whatsapp": {"enabled": True}}).status_code == 200
    return world


def mode(s4, value: str) -> None:
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"award_notice": value}})
    assert r.status_code == 200, r.text
    assert r.json()["rfq"]["award_notice"] == value


def rows(s4, sql: str, *args) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def notices(s4, rid: str) -> list[dict]:
    return rows(s4, "SELECT * FROM ticket_outbox WHERE rfq_id = ? AND idempotency_key LIKE 'rfqaward:%' ORDER BY rowid", rid)


def quoted(s4):
    d = sent_rfq(s4)
    v1 = vid(d, s4.vendor["id"])
    tok = token(s4, v1)
    c = pub(s4)
    assert pquote(c, tok, work_from=_at(6), work_to=_at(7)).status_code == 201
    return d, v1, tok, c


def awarded(s4, **body):
    d, v1, tok, c = quoted(s4)
    r = award(s4, d["id"], v1, **body)
    assert r.status_code == 201, r.text
    return d, v1, tok, c, r.json()


def postpone(c, tok: str, *, rid: str | None = None, **body):
    payload = {"action": "postpone", "work_from": _at(9), "reason": REASON, "client_request_id": rid or crid(), **body}
    return c.post("/t/api/rfq/arrival", json={k: v for k, v in payload.items() if v is not None}, headers=hdr(tok))


def events(s4, rid: str, kind: str) -> list[dict]:
    return [e for e in detail(s4, rid, "kim")["timeline"] if e["kind"] == kind]


# ================================================================ (1) the award notice

def test_the_code_owned_text_is_a_valid_link_message_in_every_language_with_no_amount_or_free_text():
    own, texts = mt.CODE_VARIANTS[mt.AWARD_NOTICE]
    assert own == "rfq_update" and set(texts) == set(mt.LANGS)
    for lang, body in texts.items():
        assert mt.problems("rfq_update", body) == [], lang  # {link} present, no foreign URL, no control character, short enough
        assert "{link}" in body and not any(ch.isdigit() for ch in body)
        assert mt.variant_by_id(f"starter:{mt.AWARD_NOTICE}:{lang}", "rfq_update").body == body
    assert mt.variant_by_id(f"starter:{mt.AWARD_NOTICE}:he", "rfq_order") is None  # a variant renders only for its own purpose
    assert mt.variant_by_id("starter:nope:he", "rfq_update") is None and mt.variant_by_id(None) is None
    assert "מחייבת" in texts["he"] and "מראש" in texts["he"] and "binding" in texts["en"] and "in advance" in texts["en"]
    for lang in mt.LANGS:  # the page sentence (binding.text) says the same in every language
        assert rfq_award_notice.page_text(lang) and not any(ch.isdigit() for ch in rfq_award_notice.page_text(lang))


def test_the_setting_is_confirm_by_default_and_validated(s4):
    assert s4.c.get(f"{API}/tickets/settings").json()["rfq"]["award_notice"] == "confirm"
    assert s4.c.get(f"{API}/tickets/rfqs/meta", headers=s4.h("kim")).json()["award_notice"] == "confirm"
    rev = s4.c.get(f"{API}/tickets/settings").json()["revision"]
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": rev, "rfq": {"award_notice": "always"}})
    assert r.status_code == 422, r.text


def test_off_refuses_the_tick_before_anything_is_written_and_never_sends(s4):
    mode(s4, "off")
    d, v1, tok, c = quoted(s4)
    r = award(s4, d["id"], v1, award_notice=True)
    assert r.status_code == 422 and r.json()["details"]["fields"] == [{"field": "award_notice", "code": "disabled"}], r.text
    assert rows(s4, "SELECT id FROM ticket_rfq_awards WHERE rfq_id = ?", d["id"]) == []  # nothing stored
    r = award(s4, d["id"], v1)
    assert r.status_code == 201 and r.json()["award_notice"] is None, r.text
    assert notices(s4, d["id"]) == [] and events(s4, d["id"], "award_notice") == []
    a = detail(s4, d["id"], "kim")["awards"][0]
    assert a["notice"]["mode"] == "off" and a["notice"]["can"]["send"] is False
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/notice", headers=s4.h("kim"))
    assert r.status_code == 409 and r.json()["code"] == "award_notice_off", r.text


def test_confirm_without_the_tick_sends_nothing_an_award_never_sends_silently(s4):
    d, v1, tok, c, body = awarded(s4)  # an older client: no field at all
    assert body["award_notice"] is None and notices(s4, d["id"]) == []
    a = detail(s4, d["id"], "kim")["awards"][0]
    assert a["notice"]["state"] == "none" and a["notice"]["can"]["send"] is True
    assert events(s4, d["id"], "award_notice") == []


def test_the_preview_is_the_exact_text_with_no_side_effect_and_only_for_deciders_or_managers(s4):
    d, v1, tok, c = quoted(s4)
    before = rows(s4, "SELECT COUNT(*) AS n FROM ticket_outbox")[0]["n"]
    r = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{v1}/award-notice", headers=s4.h("kim"))
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["mode"] == "confirm" and p["lang"] == "he" and p["channel"] == "whatsapp" and p["refusals"] == [] and p["notify_default"] is True
    assert "מחייבת" in p["text"] and "[קישור]" in p["text"] and d["title"] in p["text"] and "מגדלי הדר" in p["text"]
    assert "http" not in p["text"] and p["sent"] is False
    assert rows(s4, "SELECT COUNT(*) AS n FROM ticket_outbox")[0]["n"] == before  # no side effect
    assert s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{v1}/award-notice", headers=s4.h("cleo")).status_code == 404  # another department
    assert s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{'f' * 32}/award-notice", headers=s4.h("kim")).status_code == 404


def test_confirm_with_the_tick_queues_one_templated_notice_and_a_repeat_queues_nothing(s4):
    switch(s4)  # the arrival terms: a queued notice starts the confirmation clock
    d, v1, tok, c, body = awarded(s4, award_notice=True)
    a = body["award"]
    assert body["award_notice"]["queued"] is True and body["award_notice"]["channel"] == "whatsapp", body["award_notice"]
    out = notices(s4, d["id"])
    assert len(out) == 1
    row = out[0]
    assert row["purpose"] == "rfq_update" and row["template_id"] == f"starter:{mt.AWARD_NOTICE}:he" and row["idempotency_key"] == f"rfqaward:{a['id']}"
    assert row["link_id"] and "link" not in json.loads(row["params_json"])  # the secret link is passed at send time only
    with s4.db.connection(mode="read") as conn:
        assert store_rfq.terms(conn, a["id"])["requested_at"]  # the vendor was told
    ev = events(s4, d["id"], "award_notice")
    assert len(ev) == 1 and ev[0]["data"]["queued"] is True and ev[0]["data"]["award_id"] == a["id"]
    audit = rows(s4, "SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.award_notice'")
    assert len(audit) == 1 and "מחייבת" not in audit[0]["details_json"] and REASON not in audit[0]["details_json"]
    n = detail(s4, d["id"], "kim")["awards"][0]["notice"]
    assert n["state"] == "queued" and n["channel"] == "whatsapp" and n["can"]["send"] is False
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/notice", headers=s4.h("kim"))
    assert r.status_code == 200 and r.json()["award_notice"]["already"] is True, r.text
    assert len(notices(s4, d["id"])) == 1 and len(events(s4, d["id"], "award_notice")) == 1  # once per award
    # the worker renders the code-owned variant whatever the template store holds
    from smplwise.services.tickets.messaging import DbTemplates

    class _IO:
        def read(self):
            return s4.db.connection(mode="read")

    tpl = DbTemplates(_IO()).pick(purpose="rfq_update", lang="he", department_id=row["department_id"], template_id=row["template_id"])
    assert tpl is not None and tpl.body == mt.CODE_VARIANTS[mt.AWARD_NOTICE][1]["he"]


def test_a_ticked_notice_that_cannot_go_refuses_the_award_first_in_confirm_mode(s4):
    d, v1, tok, c = quoted(s4)
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{v1}/link/revoke", headers=s4.h("mona")).status_code == 200
    p = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{v1}/award-notice", headers=s4.h("kim")).json()
    assert p["refusals"] == ["link"] and p["notify_default"] is False
    r = award(s4, d["id"], v1, award_notice=True)
    assert r.status_code == 409 and r.json()["code"] == "award_notice_unavailable" and r.json()["details"]["reason"] == "link", r.text
    assert rows(s4, "SELECT id FROM ticket_rfq_awards WHERE rfq_id = ?", d["id"]) == []
    assert award(s4, d["id"], v1, award_notice=False).status_code == 201  # unticked: the award goes on, nothing is sent
    assert notices(s4, d["id"]) == []


def test_auto_queues_with_the_award_records_an_unreachable_vendor_and_honours_an_explicit_opt_out(s4):
    mode(s4, "auto")
    d, v1, tok, c, body = awarded(s4)  # no field: auto sends
    assert body["award_notice"]["queued"] is True and len(notices(s4, d["id"])) == 1
    d2, w1, tok2, c2 = quoted(s4)
    assert award(s4, d2["id"], w1, award_notice=False).json()["award_notice"] is None
    assert notices(s4, d2["id"]) == []
    d3, x1, tok3, c3 = quoted(s4)
    assert s4.c.post(f"{API}/tickets/rfqs/{d3['id']}/vendors/{x1}/link/revoke", headers=s4.h("mona")).status_code == 200
    r = award(s4, d3["id"], x1)  # auto never refuses an award: the failure is recorded
    assert r.status_code == 201 and r.json()["award_notice"]["queued"] is False and r.json()["award_notice"]["reason"] == "link", r.text
    ev = events(s4, d3["id"], "award_notice")
    assert len(ev) == 1 and ev[0]["data"]["queued"] is False and ev[0]["data"]["reason"] == "link"
    assert detail(s4, d3["id"], "kim")["awards"][0]["notice"]["state"] == "not_sent"


def test_a_pending_second_approval_sends_nothing_and_the_confirm_sends_the_first_approvers_tick(s4, settings):
    bind(s4.c, settings, "lea", "system_admin", "installation", "*")
    assert s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": 100}).status_code == 200
    d, v1, tok, c, body = awarded(s4, award_notice=True)
    a = body["award"]
    assert a["state"] == "pending_second" and body["award_notice"] is None and notices(s4, d["id"]) == []
    n = detail(s4, d["id"], "kim")["awards"][0]["notice"]
    assert n["state"] == "pending" and n["requested"] is True
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"]}, headers=s4.h("lea"))
    assert r.status_code == 200, r.text
    assert r.json()["award_notice"]["queued"] is True and len(notices(s4, d["id"])) == 1
    assert events(s4, d["id"], "award_notice")[0]["data"]["via"] == "confirm"


def test_the_second_approver_may_untick(s4, settings):
    bind(s4.c, settings, "lea", "system_admin", "installation", "*")
    assert s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": 100}).status_code == 200
    d, v1, tok, c, body = awarded(s4, award_notice=True)
    a = body["award"]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"], "award_notice": False},
                  headers=s4.h("lea"))
    assert r.status_code == 200 and r.json()["award_notice"] is None and notices(s4, d["id"]) == [], r.text


def test_the_later_send_needs_a_final_award_and_a_reachable_vendor(s4):
    d, v1, tok, c, body = awarded(s4)
    a = body["award"]
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/notice", headers=s4.h("cleo")).status_code == 404
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{'e' * 32}/notice", headers=s4.h("kim")).status_code == 404
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/notice", headers=s4.h("mona"))  # an RFQ manager may send it
    assert r.status_code == 200 and r.json()["award_notice"]["queued"] is True, r.text
    assert len(notices(s4, d["id"])) == 1


# ================================================================ (2) the postponement notice - PUBLIC SURFACE, negative first

def test_bad_tokens_are_the_uniform_404_and_store_nothing(s4):
    d, v1, tok, c, body = awarded(s4)
    _t, ticket_tok = s4.sent()
    answers = [postpone(c, "A" * 32), postpone(c, ticket_tok), c.post("/t/api/rfq/arrival", json={"action": "postpone", "client_request_id": crid()})]
    assert [a.status_code for a in answers] == [404] * 3
    assert {a.content for a in answers} == {UNIFORM_404}
    assert rows(s4, "SELECT id FROM ticket_rfq_postponements") == []


def test_before_the_award_or_for_a_vendor_that_was_not_awarded_it_is_one_closed_answer(s4):
    d, v1, tok, c = quoted(s4)
    r = postpone(c, tok)
    assert r.status_code == 409 and r.json() == {"code": "postpone_closed"}, r.text
    other = vid(d, s4.contact["id"])
    tok2 = token(s4, other)
    assert pquote(c, tok2).status_code == 201
    assert award(s4, d["id"], v1).status_code == 201
    r = postpone(c, tok2)  # he never learns that anyone was awarded
    assert r.status_code == 409 and r.json() == {"code": "postpone_closed"}
    assert view(c, tok2)["binding"] is None
    assert rows(s4, "SELECT id FROM ticket_rfq_postponements") == []


def test_a_pending_second_approval_or_a_done_job_closes_it(s4, settings):
    bind(s4.c, settings, "lea", "system_admin", "installation", "*")
    assert s4.c.put(f"{API}/tickets/rfqs/departments/dept-maintenance", json={"second_approval_minor": 100}).status_code == 200
    d, v1, tok, c, body = awarded(s4)
    assert body["award"]["state"] == "pending_second"
    assert postpone(c, tok).json() == {"code": "postpone_closed"}
    a = body["award"]
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/confirm", json={"revision": a["revision"]}, headers=s4.h("lea")).status_code == 200
    assert view(c, tok)["binding"]["can"]["postpone"] is True
    t, _tt = s4.sent()  # any request stands in for the order's service request, marked done
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_quotes SET ticket_id = ? WHERE id = ?", (t["id"], a["quote_id"]))
        conn.execute("UPDATE tickets SET done_at = ? WHERE id = ?", (_at(0), t["id"]))
    assert view(c, tok)["binding"]["can"]["postpone"] is False
    assert postpone(c, tok).json() == {"code": "postpone_closed"}
    assert rows(s4, "SELECT id FROM ticket_rfq_postponements") == []


@pytest.mark.parametrize("body, field, code", [
    ({"reason": "x" * 501}, "reason", "too_long"),
    ({"reason": "   "}, "reason", "required"),
    ({"reason": None}, "reason", "required"),
    ({"work_from": None}, "work_from", "required"),
    ({"work_from": "next tuesday"}, "work_from", "format"),
    ({"work_from": _at(400)}, "work_from", "range"),
    ({"work_to": _at(5), "work_from": _at(9)}, "work_to", "order"),
    ({"acknowledge_schedule": True}, "acknowledge_schedule", "not_allowed"),
])
def test_invalid_input_is_refused_before_anything_is_stored(s4, body, field, code):
    d, v1, tok, c, _b = awarded(s4)
    r = postpone(c, tok, **body)
    assert r.status_code == 422 and r.json()["code"] == "invalid" and r.json()["fields"] == [{"field": field, "code": code}], r.text
    assert rows(s4, "SELECT id FROM ticket_rfq_postponements") == []


def test_a_past_day_and_foreign_fields_are_refused(s4):
    d, v1, tok, c, _b = awarded(s4)
    yesterday = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=30)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    r = postpone(c, tok, work_from=yesterday)
    assert r.status_code == 422 and r.json()["fields"][0]["field"] == "work_from", r.text
    r = c.post("/t/api/rfq/arrival", json={"action": "postpone", "work_from": _at(9), "reason": REASON, "late": True, "client_request_id": crid()},
               headers=hdr(tok))
    assert r.status_code == 422  # strict body: no unknown key
    r = c.post("/t/api/rfq/arrival", json={"action": "confirm", "acknowledge_schedule": True, "reason": "x", "client_request_id": crid()},
               headers=hdr(tok))
    assert r.status_code in (409, 422)  # a reason on confirm / propose is never silently dropped (or the terms are closed)
    assert rows(s4, "SELECT id FROM ticket_rfq_postponements") == []


def test_a_replay_answers_the_first_answer_and_a_second_open_notice_is_refused(s4):
    d, v1, tok, c, _b = awarded(s4)
    rid = crid()
    r1 = postpone(c, tok, rid=rid)
    assert r1.status_code == 200, r1.text
    r2 = postpone(c, tok, rid=rid)
    assert r2.status_code == 200 and r2.json() == r1.json()
    assert len(rows(s4, "SELECT id FROM ticket_rfq_postponements")) == 1
    r3 = postpone(c, tok, work_from=_at(12))
    assert r3.status_code == 409 and r3.json() == {"code": "postponement_open"}, r3.text
    assert len(rows(s4, "SELECT id FROM ticket_rfq_postponements")) == 1


def test_the_edge_write_budget_limits_it(s4):
    d, v1, tok, c = quoted(s4)
    for i in range(19):  # the quote spent one unit; 19 questions spend the rest of the hour's 20
        assert c.post("/t/api/rfq/message", json={"text": f"שאלה {i}", "client_request_id": crid()}, headers=hdr(tok)).status_code == 201
    assert award(s4, d["id"], v1).status_code == 201
    r = postpone(c, tok)
    assert r.status_code == 429 and "retry-after" in r.headers, r.text
    assert rows(s4, "SELECT id FROM ticket_rfq_postponements") == []


def test_the_lifetime_cap_per_award(s4, monkeypatch):
    monkeypatch.setattr(rfq_postpone, "POSTPONE_MAX", 1)
    d, v1, tok, c, b = awarded(s4)
    assert postpone(c, tok).status_code == 200
    p = rows(s4, "SELECT id FROM ticket_rfq_postponements")[0]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{b['award']['id']}/postponement/ack", json={"postponement_id": p["id"]}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert view(c, tok)["binding"]["can"]["postpone"] is False
    assert postpone(c, tok).json() == {"code": "postponement_limit"}


# ================================================================ the postponement notice - the flow

def test_a_notice_records_the_lead_time_tells_the_managers_content_free_and_moves_no_date(s4):
    switch(s4)
    d, v1, tok, c, b = awarded(s4)
    a = b["award"]
    with s4.db.connection(mode="read") as conn:
        planned = store_rfq.terms(conn, a["id"])["planned_from"]
    v = view(c, tok)
    assert v["binding"]["text"] == rfq_award_notice.page_text("he") and v["binding"]["can"]["postpone"] is True
    assert v["binding"]["scheduled_from"] == planned and v["binding"]["postponement"] is None
    evil = REASON + "‮​"
    r = postpone(c, tok, reason=evil)
    assert r.status_code == 200, r.text
    assert r.json()["binding"]["postponement"]["state"] == "open" and r.json()["binding"]["can"]["postpone"] is False
    p = rows(s4, "SELECT * FROM ticket_rfq_postponements")[0]
    assert p["reason"] == REASON  # text hygiene: control / bidi / zero-width characters removed
    assert p["scheduled_from"] == planned and p["state"] == "open"
    start = dt.datetime.fromisoformat(planned.replace("Z", "+00:00"))
    created = dt.datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))
    assert p["lead_seconds"] == int((start - created).total_seconds())  # a fact, no judgement
    with s4.db.connection(mode="read") as conn:
        assert store_rfq.terms(conn, a["id"])["planned_from"] == planned  # the agreed date does not move by itself
    n = rows(s4, "SELECT * FROM notifications WHERE source = 'rfq.vendor_postponement'")
    assert len(n) == 1 and n[0]["state"] == "open"
    said = " ".join(str(n[0].get(k) or "") for k in ("title", "body", "place", "params_json"))
    assert d["ref"] in said and REASON not in said and "מדחס" not in said and "קליימה" not in said
    assert not any(ch.isdigit() for ch in said.replace(d["ref"], "").replace("קומה 3", ""))  # no date, no lead time, no phone (the place has "3")
    ev = events(s4, d["id"], "vendor_postponement")
    assert len(ev) == 1 and REASON not in json.dumps(ev[0], ensure_ascii=False) and ev[0]["data"]["lead_seconds"] == p["lead_seconds"]
    audit = rows(s4, "SELECT details_json FROM audit_log WHERE action = 'ticket.rfq.vendor_postponement'")
    assert len(audit) == 1 and REASON not in audit[0]["details_json"]
    assert rows(s4, "SELECT id FROM ticket_outbox WHERE params_json LIKE ?", f"%{REASON[:6]}%") == []  # never travels outside
    block = detail(s4, d["id"], "kim")["awards"][0]["postponement"]
    assert block["open"]["reason"] == REASON and block["can"]["acknowledge"] is True and block["count"] == 1


def test_a_manager_acknowledges_it_and_the_vendor_may_give_a_new_one(s4):
    d, v1, tok, c, b = awarded(s4)
    a = b["award"]
    assert postpone(c, tok).status_code == 200
    p = rows(s4, "SELECT id FROM ticket_rfq_postponements")[0]
    url = f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/postponement/ack"
    assert s4.c.post(url, json={"postponement_id": p["id"]}, headers=s4.h("cleo")).status_code == 404  # another department
    r = s4.c.post(url, json={"postponement_id": "a" * 32}, headers=s4.h("mona"))
    assert r.status_code == 404 and r.json()["code"] == "postponement_not_found"
    r = s4.c.post(url, json={"postponement_id": p["id"]}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert r.json()["awards"][0]["postponement"]["open"] is None
    assert rows(s4, "SELECT state FROM notifications WHERE source = 'rfq.vendor_postponement'")[0]["state"] == "resolved"
    assert len(events(s4, d["id"], "postponement_acknowledged")) == 1
    assert view(c, tok)["binding"]["postponement"]["state"] == "acknowledged"
    assert postpone(c, tok, work_from=_at(14)).status_code == 200  # a new notice after the last one was handled


def test_the_arrival_date_change_answers_the_open_notice(s4):
    switch(s4)
    d, v1, tok, c, b = awarded(s4)
    a = b["award"]
    assert postpone(c, tok, work_from=_at(11)).status_code == 200
    rev = next(x for x in detail(s4, d["id"], "kim")["awards"] if x["id"] == a["id"])["terms"]["revision"]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/awards/{a['id']}/arrival/date", json={"work_from": _at(11), "revision": rev}, headers=s4.h("kim"))
    assert r.status_code == 200, r.text
    assert rows(s4, "SELECT state FROM ticket_rfq_postponements")[0]["state"] == "rescheduled"
    assert rows(s4, "SELECT state FROM notifications WHERE source = 'rfq.vendor_postponement'")[0]["state"] == "resolved"
    moved = [e for e in detail(s4, d["id"], "kim")["timeline"] if e["kind"] == "arrival_rescheduled"]
    assert moved and moved[-1]["data"]["postponement_id"]


def test_close_ends_the_notice_and_the_purge_removes_it(s4):
    d, v1, tok, c, b = awarded(s4)
    assert postpone(c, tok).status_code == 200
    rev = detail(s4, d["id"], "mona")["revision"]
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": rev}, headers=s4.h("mona")).status_code == 200
    assert rows(s4, "SELECT state FROM ticket_rfq_postponements")[0]["state"] == "ended"
    assert rows(s4, "SELECT state FROM notifications WHERE source = 'rfq.vendor_postponement'")[0]["state"] == "resolved"
    assert postpone(c, tok).status_code == 409  # the read-only grace: no write (409 read_only)
    assert s4.c.delete(f"{API}/tickets/rfqs/{d['id']}", headers=s4.h("joni")).status_code in (200, 204)
    assert rows(s4, "SELECT id FROM ticket_rfq_postponements") == []
