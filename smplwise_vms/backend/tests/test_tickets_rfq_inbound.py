"""TKRFQ5 - a vendor's WhatsApp TEXT reply to an RFQ message (docs/tickets/RFQ_BACKEND_CONTRACT.md section 16.2), over the REAL store,
the real outbox worker and the real inbound matcher with a fake ha-whatsapp (no network, no Home Assistant, no phone).

Negative cases first: a stranger and a vendor whose request is closed / past its deadline / who was removed read exactly alike
(`unknown_sender`, nothing stored, nothing sent back); a replay is a duplicate; one vendor's reply never reaches another vendor's thread;
the reply is never shown on the vendor's public page (an unverified sender) and never moves a state; a vendor with a live ticket AND an
open request who names neither goes to the managers' ambiguous list. Then the match: the clarification lands in his thread, marked
"via WhatsApp (unverified sender)", the timeline row and the RFQ managers' notification follow, the envelope row keeps no text. Every
number, name and address is invented."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import bind

from fake_ha_whatsapp import FakeHaWhatsapp
from smplwise.services.tickets import inbound as inbound_mod
from test_tickets_s5b_channel import ENTRY_A, Env, env  # noqa: F401 - `env` is the slice-5b fixture (fake WhatsApp, mapped account)
from tickets_s4_world import PHONE_A_E164, crid

API = "/api/v1"
PHONE_B_E164 = "972500000032"
STRANGER = "972500000099"


@pytest.fixture()
def renv(env, settings):  # noqa: F811
    bind(env.s4.c, settings, "mona", "tickets_external", "installation", "*")
    return env


def _at(days: float) -> str:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def sent_rfq(e: Env, vendors: list[str] | None = None) -> dict:
    """A request sent by WhatsApp (channel auto) to the person contact (PHONE_A) and the vendor (PHONE_B), the invitations delivered."""
    s4 = e.s4
    ids = vendors if vendors is not None else [s4.contact["id"], s4.vendor["id"]]
    r = s4.c.post(f"{API}/tickets/rfqs", json={"department_id": "dept-maintenance", "title": "החלפת מזגן", "place_text": "קומה 3",
                                               "due_at": _at(3), "vendors": [{"contact_id": c} for c in ids], "client_request_id": crid()},
                  headers=s4.h("mona"))
    assert r.status_code == 201, r.text
    d = r.json()
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/send", json={"revision": d["revision"], "channel": "auto", "client_request_id": crid()},
                  headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    for _ in range(3):
        e.tick(seconds=30)
    return detail(e, d["id"])


def detail(e: Env, rid: str) -> dict:
    r = e.c.get(f"{API}/tickets/rfqs/{rid}", headers=e.h("mona"))
    assert r.status_code == 200, r.text
    return r.json()


def vid(d: dict, contact_id: str) -> str:
    return next(v["id"] for v in d["vendors"] if v["contact"]["id"] == contact_id)


def thread(e: Env, rid: str, rv: str) -> list[dict]:
    r = e.c.get(f"{API}/tickets/rfqs/{rid}/vendors/{rv}/messages", headers=e.h("mona"))
    assert r.status_code == 200, r.text
    return r.json()["items"]


def last_inbound(e: Env) -> dict:
    with e.s4.db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM ticket_inbound ORDER BY received_at DESC, rowid DESC LIMIT 1").fetchone())


def reply(e: Env, number: str, text: str, **kw) -> dict:
    e.clock.advance(seconds=20)
    e.inbound(FakeHaWhatsapp.received(number, text, at=e.clock(), entry_id=ENTRY_A, **kw))
    return last_inbound(e)


def rfq_messages(e: Env) -> int:
    with e.s4.db.connection(mode="read") as conn:
        return int(conn.execute("SELECT COUNT(*) FROM ticket_rfq_messages").fetchone()[0])


def rfq_rows(e: Env, source: str) -> list[dict]:
    with e.s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ?", (source,)).fetchall()]


def invitations_delivered(e: Env, d: dict) -> None:
    with e.s4.db.connection(mode="read") as conn:
        states = {r[0] for r in conn.execute("SELECT state FROM ticket_outbox WHERE rfq_id = ? AND purpose = 'rfq_invite'", (d["id"],)).fetchall()}
    assert states == {"sent"}, states


# ---------------------------------------------------------------- negative cases first

def test_a_stranger_and_a_vendor_of_a_closed_request_read_exactly_alike(renv):
    d = sent_rfq(renv)
    invitations_delivered(renv, d)
    stranger = reply(renv, STRANGER, "מה המחיר?")
    assert (stranger["result"], stranger["reason"], stranger["content"]) == ("unknown_sender", None, None)
    r = renv.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": detail(renv, d["id"])["revision"]}, headers=renv.h("mona"))
    assert r.status_code == 200, r.text
    vendor = reply(renv, PHONE_A_E164, "יש לי שאלה")
    assert (vendor["result"], vendor["reason"], vendor["content"]) == ("unknown_sender", None, None)
    assert rfq_messages(renv) == 0
    assert all(c["service"] != "send_message" or "יש לי שאלה" not in json.dumps(c, ensure_ascii=False) for c in renv.fake.calls), "no reply"


def test_a_request_past_its_deadline_or_a_removed_vendor_takes_no_reply(renv):
    d = sent_rfq(renv)
    a, b = vid(d, renv.s4.contact["id"]), vid(d, renv.s4.vendor["id"])
    r = renv.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{b}/remove", json={"revision": detail(renv, d["id"])["revision"]}, headers=renv.h("mona"))
    assert r.status_code == 200, r.text
    assert reply(renv, PHONE_B_E164, "שאלה")["result"] == "unknown_sender"
    with renv.s4.db.connection() as conn:  # the deadline passed on the worker's clock
        conn.execute("UPDATE ticket_rfqs SET due_at = ? WHERE id = ?", ((renv.clock() - dt.timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%SZ"), d["id"]))
    assert reply(renv, PHONE_A_E164, "שאלה")["result"] == "unknown_sender"
    assert thread(renv, d["id"], a) == [] and rfq_messages(renv) == 0


def test_a_replayed_event_is_a_duplicate_and_stores_once(renv):
    d = sent_rfq(renv)
    a = vid(d, renv.s4.contact["id"])
    renv.clock.advance(seconds=20)
    event = FakeHaWhatsapp.received(PHONE_A_E164, "האם צריך אישור כניסה?", at=renv.clock(), entry_id=ENTRY_A)
    renv.inbound(event)
    renv.inbound(event)
    assert last_inbound(renv)["result"] == "duplicate"
    assert [m["text"] for m in thread(renv, d["id"], a)] == ["האם צריך אישור כניסה?"]
    assert len(rfq_rows(renv, "rfq.question")) == 1


def test_one_vendors_reply_never_reaches_another_vendors_thread_or_his_public_page(renv):
    d = sent_rfq(renv)
    a, b = vid(d, renv.s4.contact["id"]), vid(d, renv.s4.vendor["id"])
    reply(renv, PHONE_B_E164, "שאלה של הספק השני")
    assert thread(renv, d["id"], a) == []
    assert [m["text"] for m in thread(renv, d["id"], b)] == ["שאלה של הספק השני"]
    from smplwise.services.tickets import rfq_vendor, store_rfq

    with renv.s4.db.connection(mode="read") as conn:
        assert rfq_vendor.present_messages(conn, store_rfq.vendor(conn, b)) == [], "never on the vendor page (an unverified sender)"
        v = store_rfq.vendor(conn, b)
    assert v["state"] == "sent", "a WhatsApp text never moves a state"


def test_a_vendor_with_a_live_ticket_and_an_open_request_who_names_neither_goes_to_the_managers(renv):
    t = renv.s4.ticket()
    assert renv.s4.assign_contact(t["id"]).status_code == 200
    d = sent_rfq(renv)
    amb = reply(renv, PHONE_A_E164, "מתי אתם צריכים?")
    assert (amb["result"], amb["reason"]) == ("ambiguous", "ticket_or_rfq")
    assert rfq_messages(renv) == 0
    named = reply(renv, PHONE_A_E164, f"לגבי {d['ref']}: מתי אתם צריכים?")
    assert (named["result"], named["reason"], named["ticket_id"], named["content"]) == ("note", "rfq", None, None)
    assert [m["text"] for m in thread(renv, d["id"], vid(d, renv.s4.contact["id"]))] == [f"לגבי {d['ref']}: מתי אתם צריכים?"]
    assert not any(e["kind"] == "inbound" for e in renv.s4.w.detail(t["id"])["events"]), "never a ticket note"


def test_several_open_requests_and_no_reference_are_never_guessed(renv):
    d1 = sent_rfq(renv, [renv.s4.contact["id"]])
    d2 = sent_rfq(renv, [renv.s4.contact["id"]])
    r = reply(renv, PHONE_A_E164, "שאלה")
    assert (r["result"], r["reason"], r["content"]) == ("ignored", "rfq_several", None)
    r = reply(renv, PHONE_A_E164, f"rfq {d2['number']} שאלה")
    assert (r["result"], r["reason"]) == ("note", "rfq")
    assert thread(renv, d1["id"], vid(d1, renv.s4.contact["id"])) == []
    assert len(thread(renv, d2["id"], vid(d2, renv.s4.contact["id"]))) == 1


# ---------------------------------------------------------------- the match

def test_a_text_reply_becomes_an_unverified_clarification_and_tells_the_rfq_managers(renv):
    d = sent_rfq(renv)
    a = vid(d, renv.s4.contact["id"])
    row = reply(renv, PHONE_A_E164, "האם יש חניה לרכב עבודה?")
    assert (row["result"], row["reason"], row["ticket_id"], row["content"]) == ("note", "rfq", None, None), "the envelope keeps no text"
    (m,) = thread(renv, d["id"], a)
    assert (m["direction"], m["text"], m["via"], m["unverified"], m["source"]) == ("in", "האם יש חניה לרכב עבודה?", "whatsapp", True, None)
    ev = [e for e in detail(renv, d["id"])["timeline"] if e["kind"] == "vendor_message"]
    assert ev and ev[-1]["vendor_id"] == a
    (n,) = rfq_rows(renv, "rfq.question")
    assert n["title"] == f"{d['ref']}: הודעה מספק בוואטסאפ" and "חניה" not in n["title"] + n["body"] + n["params_json"]
    with renv.s4.db.connection(mode="read") as conn:
        audit = conn.execute("SELECT details_json FROM audit_log WHERE action = 'ticket.inbound' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert audit is not None and "חניה" not in audit[0] and d["id"] in audit[0]
    # the manager's answer resolves the question row
    assert renv.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages", json={"text": "כן", "notify": False},
                       headers=renv.h("mona")).status_code == 201
    assert rfq_rows(renv, "rfq.question")[0]["state"] == "resolved"


def test_the_matcher_without_rfq_candidates_behaves_as_before():
    class Dir:
        def by_nonce(self, nonce):
            return None

        def candidates(self, sender_key, *, since, account_key):
            return []

    class Seen:
        def seen(self, key, now):
            return False

    now = dt.datetime(2026, 10, 16, 8, 0, tzinfo=dt.timezone.utc)
    proc = inbound_mod.InboundProcessor(key=b"k" * 32, directory=Dir(), dedupe=Seen())
    d = proc.process(FakeHaWhatsapp.received(PHONE_A_E164, "RFQ-07 שאלה", at=now, entry_id=ENTRY_A), now)
    assert d is not None and d.result == "unknown_sender" and d.rfq_id is None
    assert inbound_mod.RFQ_REF.findall("rfq-07, RFQ 12, RFQ#3, xrfq9, RFQ-") == ["7", "12", "3"]
