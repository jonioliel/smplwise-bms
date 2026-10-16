"""TKRFQ5 - the RFQ managers' notifications (docs/tickets/RFQ_BACKEND_CONTRACT.md section 16.1) over the REAL store, the real public
vendor page and the real CR-018 engine.

Negative cases first: who is NOT told (a member, another department's manager, an all-departments viewer, the vendors), nothing when the
source is switched off or the module is off, no amount / vendor name / text / other vendor in any notification field, a deleted request
hides its rows. Then the flows: quote -> update -> withdraw fold into one row, "not interested", a question per vendor resolved by the
manager's answer, the deadline row (once; resolved by a later deadline), and every row resolved when the request is closed. Every name and
number here is invented (the 050-000-xxxx block, example.test hosts)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import bind

from smplwise.services import notify_policy
from smplwise.services.notify_visibility import Reach
from smplwise.services.tickets import rfq as rfq_mod
from smplwise.services.tickets import rfq_notify
from smplwise.services.tickets.access import Viewer
from smplwise.rbac import Principal
from test_tickets_rfq_public import QUOTE, detail, hdr, pub, quote, sent_rfq, token, vid, view
from tickets_s4_world import API, build_s4, crid

RFQ_SOURCES = ("rfq.quote_received", "rfq.declined", "rfq.question", "rfq.due_passed")


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    rev = world.c.get(f"{API}/tickets/channel").json()["revision"]
    assert world.c.put(f"{API}/tickets/channel", json={"revision": rev, "whatsapp": {"enabled": True}}).status_code == 200
    return world


def rows(s4, source: str | None = None) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        sql = "SELECT * FROM notifications WHERE source LIKE 'rfq.%'" + (" AND source = ?" if source else "") + " ORDER BY created_at, rowid"
        return [dict(r) for r in conn.execute(sql, (source,) if source else ()).fetchall()]


def recipients(s4, nid: str) -> set[str]:
    with s4.db.connection(mode="read") as conn:
        return {r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (nid,)).fetchall()}


def uid(s4, username: str) -> str:
    with s4.db.connection(mode="read") as conn:
        return conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()[0]


def inbox(s4, user: str) -> list[dict]:
    r = s4.c.get(f"{API}/notifications", headers=s4.h(user))
    assert r.status_code == 200, r.text
    return [n for n in r.json()["notifications"] if n["source"].startswith("rfq.")]


def set_policy(s4, source: str, **body) -> None:
    r = s4.c.put(f"{API}/notify/policies/{source}", json=body, headers=s4.h("joni"))
    assert r.status_code == 200, r.text


def text_of(n: dict, *, ids: bool = True) -> str:
    """What a notification row says (`ids`: also its origin, which carries ids only - random hex, so digit checks skip it)."""
    return " ".join(str(n.get(k) or "") for k in ("title", "body", "place", "params_json") + (("origin_json",) if ids else ()))


# ---------------------------------------------------------------- negative cases first

def test_a_vendor_quote_tells_only_the_rfq_managers(s4):
    for u in ("tom", "cleo", "alda", "vic"):  # make them known users
        s4.c.get(f"{API}/me", headers=s4.h(u))
    d = sent_rfq(s4)
    c = pub(s4)
    assert quote(c, token(s4, vid(d, s4.vendor["id"]))).status_code == 201
    (n,) = rows(s4, "rfq.quote_received")
    assert recipients(s4, n["id"]) == {uid(s4, "mona")}, "the creator and the department's manager - nobody else"
    assert n["subject_kind"] == "rfq" and n["subject_id"] == d["id"] and n["category"] == "tickets"
    assert n["link"] == f"#/tickets/rfqs?rfq={d['id']}"
    assert [x["id"] for x in inbox(s4, "mona")] == [n["id"]]
    for u in ("tom", "cleo", "alda", "vic", "joni"):
        assert inbox(s4, u) == [], u


def test_a_member_or_another_department_cannot_see_the_row_even_when_named(s4):
    d = sent_rfq(s4)
    c = pub(s4)
    assert quote(c, token(s4, vid(d, s4.vendor["id"]))).status_code == 201
    (n,) = rows(s4, "rfq.quote_received")
    with s4.db.connection(mode="read") as conn:
        note = {**n, "origin": json.loads(n["origin_json"]), "params": json.loads(n["params_json"])}
        for u, expected in (("mona", True), ("joni", True), ("cleo", False), ("vic", False), ("nora", False)):
            s4.c.get(f"{API}/me", headers=s4.h(u))
            p = Principal(user_id=uid(s4, u), username=u, display_name=u, source="ha")
            assert Reach(conn, p).can_see(note) is expected, u
        # the recipient rule itself: an RFQ manager needs tickets.external - mona has it, tom (a member) is no manager at all
        assert rfq_notify.managers_of(conn, rfq_mod.system_row(conn, d["id"])) == [uid(s4, "mona")]


def test_no_amount_no_vendor_name_no_text_and_no_other_vendor_in_any_field(s4):
    d = sent_rfq(s4)
    a, b = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    c = pub(s4)
    r = quote(c, token(s4, a), note="הערה סודית של הספק")
    assert r.status_code == 201, r.text
    total = r.json()["quote"]["total_minor"]
    assert c.post("/t/api/rfq/message", json={"text": "שאלה פרטית על החניה", "client_request_id": crid()}, headers=hdr(token(s4, b))).status_code == 201
    assert c.post("/t/api/rfq/decline", json={"reason": "עמוס מדי החודש", "client_request_id": crid()}, headers=hdr(token(s4, b))).status_code == 200
    all_rows = rows(s4)
    assert {n["source"] for n in all_rows} == {"rfq.quote_received", "rfq.question", "rfq.declined"}
    words = [s4.vendor["display_name"], s4.contact["display_name"], "קליימה", "משה", "הערה סודית", "שאלה פרטית", "חניה", "עמוס", d["title"]]
    digits = [str(total), f"{total / 100:.2f}", "1,100", "1100", "1298", "050", "972"]
    for n in all_rows:
        for word in words:
            assert word not in text_of(n), (n["source"], word)
        for word in digits:
            assert word not in text_of(n, ids=False), (n["source"], word)
    q = next(n for n in all_rows if n["source"] == "rfq.question")
    origin = json.loads(q["origin_json"])
    assert origin["rfq_vendor_id"] == b and a not in q["origin_json"], "the question row names only its own vendor (by id)"


def test_nothing_when_the_source_is_switched_off(s4):
    for src in RFQ_SOURCES:
        set_policy(s4, src, enabled=False)
    d = sent_rfq(s4)
    c = pub(s4)
    tok = token(s4, vid(d, s4.vendor["id"]))
    assert quote(c, tok).status_code == 201
    assert c.post("/t/api/rfq/message", json={"text": "שאלה", "client_request_id": crid()}, headers=hdr(tok)).status_code == 201
    with s4.db.connection() as conn:
        rfq_mod.tick(conn, dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=4))
    assert rows(s4) == []
    set_policy(s4, "rfq.question", enabled=True)  # the switch works both ways
    d2 = sent_rfq(s4)
    assert c.post("/t/api/rfq/message", json={"text": "עוד שאלה", "client_request_id": crid()},
                  headers=hdr(token(s4, vid(d2, s4.contact["id"])))).status_code == 201
    assert [n["source"] for n in rows(s4)] == ["rfq.question"]


def test_the_module_off_lists_no_rfq_source_and_emits_nothing(s4):
    with s4.db.connection() as conn:
        listed = {p["source"] for p in notify_policy.list_policies(conn)}
        assert set(RFQ_SOURCES) <= listed
        assert "rfq_managers" in notify_policy.RECIPIENT_RULES and "rfq" in notify_policy.SUBJECT_KINDS
        defaults = {p["source"]: p for p in notify_policy.list_policies(conn) if p["source"] in RFQ_SOURCES}
        assert all(p["channels"]["whatsapp"] is False for p in defaults.values()), "NOTIFWA: never WhatsApp by default"
        assert all(p["recipients"]["rule"] == "rfq_managers" for p in defaults.values())
        assert defaults["rfq.declined"]["channels"]["webpush"] is False and defaults["rfq.question"]["severity"] == "alert"
    d = sent_rfq(s4)
    with s4.db.connection() as conn:
        conn.execute("UPDATE settings SET value = 'false' WHERE key = 'tickets.enabled'")
    with s4.db.connection() as conn:
        assert not {p["source"] for p in notify_policy.list_policies(conn)} & set(RFQ_SOURCES)
        row = rfq_mod.system_row(conn, d["id"])
        assert rfq_notify.quote(conn, row, vid(d, s4.vendor["id"]), "new") is None
    assert rows(s4) == []


def test_a_deleted_request_hides_its_rows(s4):
    d = sent_rfq(s4)
    c = pub(s4)
    assert quote(c, token(s4, vid(d, s4.vendor["id"]))).status_code == 201
    assert len(inbox(s4, "mona")) == 1
    r = s4.c.delete(f"{API}/tickets/rfqs/{d['id']}", headers=s4.h("joni"))
    assert r.status_code in (200, 204), r.text
    assert inbox(s4, "mona") == []
    assert all(n["state"] == "resolved" for n in rows(s4))


# ---------------------------------------------------------------- the flows

def test_quote_update_and_withdraw_fold_into_one_row_of_the_request(s4):
    d = sent_rfq(s4)
    c = pub(s4)
    tok = token(s4, vid(d, s4.vendor["id"]))
    first = quote(c, tok)
    assert first.status_code == 201
    (n,) = rows(s4, "rfq.quote_received")
    assert n["title"] == f"{d['ref']}: התקבלה הצעת מחיר" and n["count"] == 1
    assert quote(c, tok, base=1).status_code == 201
    (n,) = rows(s4, "rfq.quote_received")
    assert n["title"] == f"{d['ref']}: הצעת מחיר עודכנה" and n["count"] == 2
    qid = view(c, tok)["quote"]["id"]
    assert c.post("/t/api/rfq/withdraw", json={"quote_id": qid, "client_request_id": crid()}, headers=hdr(tok)).status_code == 200
    (n,) = rows(s4, "rfq.quote_received")
    assert n["title"] == f"{d['ref']}: הצעת מחיר נמשכה" and n["count"] == 3 and n["state"] == "open"
    # a replayed write (same client_request_id) is answered from the claim: no second signal
    rid = crid()
    assert quote(c, tok, base=None, rid=rid).status_code == 201
    assert quote(c, tok, base=None, rid=rid).status_code == 201
    assert rows(s4, "rfq.quote_received")[0]["count"] == 4


def test_not_interested_and_a_question_per_vendor_resolved_by_the_managers_answer(s4):
    d = sent_rfq(s4)
    a, b = vid(d, s4.vendor["id"]), vid(d, s4.contact["id"])
    c = pub(s4)
    assert c.post("/t/api/rfq/decline", json={"reason": "עמוס", "client_request_id": crid()}, headers=hdr(token(s4, a))).status_code == 200
    (dn,) = rows(s4, "rfq.declined")
    assert dn["title"] == f"{d['ref']}: ספק השיב שאינו מעוניין" and recipients(s4, dn["id"]) == {uid(s4, "mona")}
    for tok in (token(s4, a), token(s4, b)):
        assert c.post("/t/api/rfq/message", json={"text": "שאלה", "client_request_id": crid()}, headers=hdr(tok)).status_code == 201
    qs = rows(s4, "rfq.question")
    assert len(qs) == 2 and {json.loads(q["origin_json"])["rfq_vendor_id"] for q in qs} == {a, b}
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{b}/messages", json={"text": "תשובה", "notify": False},
                     headers=s4.h("mona")).status_code == 201
    state = {json.loads(q["origin_json"])["rfq_vendor_id"]: q["state"] for q in rows(s4, "rfq.question")}
    assert state == {a: "open", b: "resolved"}


def test_the_deadline_row_is_raised_once_and_a_later_deadline_resolves_it(s4):
    d = sent_rfq(s4)
    c = pub(s4)
    assert quote(c, token(s4, vid(d, s4.vendor["id"]))).status_code == 201
    later = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=4)
    with s4.db.connection() as conn:
        assert rfq_mod.tick(conn, later) == 1
        assert rfq_mod.tick(conn, later) == 0
    (n,) = rows(s4, "rfq.due_passed")
    assert n["title"] == f"{d['ref']}: המועד להגשת הצעות עבר" and "1 מתוך 2 הגישו הצעה" in n["body"]
    assert recipients(s4, n["id"]) == {uid(s4, "mona")}
    due = (later + dt.timedelta(days=2)).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    r = s4.c.patch(f"{API}/tickets/rfqs/{d['id']}", json={"revision": detail(s4, d["id"])["revision"], "due_at": due}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert rows(s4, "rfq.due_passed")[0]["state"] == "resolved"


def test_closing_the_request_resolves_every_row(s4):
    d = sent_rfq(s4)
    c = pub(s4)
    tok = token(s4, vid(d, s4.vendor["id"]))
    assert quote(c, tok).status_code == 201
    assert c.post("/t/api/rfq/message", json={"text": "שאלה", "client_request_id": crid()}, headers=hdr(tok)).status_code == 201
    assert {n["state"] for n in rows(s4)} == {"open"}
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": detail(s4, d["id"])["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    assert {n["state"] for n in rows(s4)} == {"resolved"}


def test_texts_exist_in_hebrew_and_english_and_carry_only_ref_place_and_counts():
    for lang in ("he", "en"):
        assert set(rfq_notify.TEXTS[lang]) == set(rfq_notify.TEXTS["he"])
        for kind in rfq_notify.TEXTS[lang]:
            title, body = rfq_notify.render(kind, lang, ref="RFQ-07", place="קומה 3", invited=5, quoted=2)
            assert "RFQ-07" in title and "{" not in title + body
    assert rfq_notify.render("due_passed", "en", ref="RFQ-07", place="Floor 3", invited=5, quoted=2) == (
        "RFQ-07: the quote deadline passed", "Floor 3 · 2 of 5 quoted")
    from smplwise.services.tickets import notify_sources

    assert set(notify_sources.LABELS_EN) == set(RFQ_SOURCES)
