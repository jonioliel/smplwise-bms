"""RFQQUESTIONS - a vendor's question is a visible, answerable item (docs/tickets/RFQ_BACKEND_CONTRACT.md section 21), over the REAL store,
the real public vendor page and the real CR-018 engine.

Negative cases first: who may NOT answer (a plain member, an invisible request, a message of another request, an outbound message), the
limits (the answer, the question sent with a quote - a refused question stores no quote), a second answer, privacy between vendors (a
question and a vendor-only answer never reach another vendor; an answer to everyone names the asking vendor only when the manager says
so), audit rows without text, the preview writes nothing, a handled-without-reply question sends nothing. Then the flows: the quote form's
own question, pending / unread counts on the detail, the list and the comparison, the navigation badge (managers only), read, answer one
vendor, answer every vendor, the reminder after N hours, and the badges once the request is closed. Every name and number here is
invented (the 050-000-xxxx block, example.test hosts)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import bind

from smplwise.services.tickets import rfq_questions
from test_tickets_rfq_public import detail, hdr, pub, quote, sent_rfq, token, vid, view
from tickets_s4_world import API, crid


@pytest.fixture()
def s4(settings, monkeypatch):
    from tickets_s4_world import build_s4

    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    rev = world.c.get(f"{API}/tickets/channel").json()["revision"]
    assert world.c.put(f"{API}/tickets/channel", json={"revision": rev, "whatsapp": {"enabled": True}}).status_code == 200
    return world


def ask(c, tok: str, text: str = "האם המחיר כולל פינוי של היחידה הישנה?"):
    return c.post("/t/api/rfq/message", json={"text": text, "client_request_id": crid()}, headers=hdr(tok))


def setup_two(s4) -> tuple[dict, str, str, object]:
    d = sent_rfq(s4)
    return d, vid(d, s4.vendor["id"]), vid(d, s4.contact["id"]), pub(s4)


def question_id(s4, rid: str, user: str = "mona") -> str:
    items = detail(s4, rid, user)["questions"]["items"]
    assert items, "a pending question"
    return items[0]["id"]


def answer(s4, rid: str, mid: str, user: str = "mona", **body):
    payload = {"text": "כן, הפינוי כלול.", "notify": False, "client_request_id": crid(), **body}
    return s4.c.post(f"{API}/tickets/rfqs/{rid}/questions/{mid}/answer", json=payload, headers=s4.h(user))


def messages_count(s4, rid: str) -> int:
    with s4.db.connection(mode="read") as conn:
        return int(conn.execute("SELECT COUNT(*) FROM ticket_rfq_messages WHERE rfq_id = ?", (rid,)).fetchone()[0])


def audits(s4, prefix: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY rowid", (prefix + "%",)).fetchall()]


def notif(s4, source: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at, rowid", (source,)).fetchall()]


# ---------------------------------------------------------------- negative cases first

def test_only_an_rfq_manager_answers_and_unknown_ids_are_404(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    mid = question_id(s4, d["id"])
    # an invisible request is the uniform 404 for an outsider; a member who sees it is refused by role (audited)
    s4.c.get(f"{API}/me", headers=s4.h("vic"))
    r = answer(s4, d["id"], mid, user="vic")
    assert r.status_code == 404 and r.json()["code"] == "rfq_not_found"
    r = answer(s4, d["id"], mid, user="tom")  # a member of the department: sees the request, is no RFQ manager
    assert r.status_code == 403 and r.json()["details"]["reason"] == "not_manager", r.text
    assert any(x["decision"] == "denied" for x in audits(s4, "ticket.rfq.answer"))
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/questions/{mid}/preview", json={"text": "x"}, headers=s4.h("tom"))
    assert r.status_code == 403
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/questions/{mid}/resolve", headers=s4.h("tom")).status_code == 403
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages/read", headers=s4.h("tom")).status_code == 403
    assert detail(s4, d["id"], "tom")["can"]["answer"] is False
    for path in (f"questions/{mid}/resolve", f"vendors/{a}/messages/read"):
        assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/{path}", headers=s4.h("vic")).status_code == 404
    # another request's message, an outbound message and a made-up id: 404 message_not_found
    other = sent_rfq(s4)
    assert ask(c, token(s4, vid(other, s4.vendor["id"])), "שאלה אחרת").status_code == 201
    foreign = question_id(s4, other["id"])
    r = answer(s4, d["id"], foreign)
    assert r.status_code == 404 and r.json()["code"] == "message_not_found"
    out = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages", json={"text": "הודעה יוצאת", "notify": False}, headers=s4.h("mona")).json()["item"]["id"]
    assert answer(s4, d["id"], out).json()["code"] == "message_not_found"
    assert answer(s4, d["id"], "0" * 32).status_code == 404


def test_limits_and_a_refused_question_stores_no_quote(s4):
    d, a, _b, c = setup_two(s4)
    tok = token(s4, a)
    r = quote(c, tok, question="ש" * 2001)
    assert r.status_code == 422 and r.json()["fields"][0]["field"] == "question"
    assert view(c, tok)["quote"] is None and messages_count(s4, d["id"]) == 0, "nothing stored"
    assert ask(c, tok).status_code == 201
    mid = question_id(s4, d["id"])
    r = answer(s4, d["id"], mid, text="ת" * 2001)
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "text"
    r = answer(s4, d["id"], mid, text="   ")
    assert r.status_code == 422
    r = answer(s4, d["id"], mid, scope="all", question_text="ש" * 1001)
    assert r.status_code == 422 and r.json()["details"]["fields"][0]["field"] == "question_text"
    r = answer(s4, d["id"], mid, scope="everyone")
    assert r.status_code == 422


def test_a_question_is_answered_once(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    mid = question_id(s4, d["id"])
    assert answer(s4, d["id"], mid).status_code == 201
    r = answer(s4, d["id"], mid)
    assert r.status_code == 409 and r.json()["code"] == "question_answered"
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/questions/{mid}/resolve", headers=s4.h("mona")).json()["code"] == "question_answered"


def test_a_vendor_never_sees_another_vendors_question_or_its_private_answer(s4):
    d, a, b, c = setup_two(s4)
    secret = "האם אפשר לעבוד בשבת? אני משה מקליימה"
    assert ask(c, token(s4, a), secret).status_code == 201
    assert view(c, token(s4, b))["messages"] == []
    assert answer(s4, d["id"], question_id(s4, d["id"]), text="לא, רק בימי חול.").status_code == 201
    mine = view(c, token(s4, a))["messages"]
    assert [m["mine"] for m in mine] == [True, False] and mine[0]["answered"] is True and mine[1]["text"] == "לא, רק בימי חול."
    assert view(c, token(s4, b))["messages"] == [], "a vendor-only answer is the asker's only"


def test_an_answer_to_everyone_shows_the_question_without_the_askers_name_unless_chosen(s4):
    d, a, b, c = setup_two(s4)
    assert ask(c, token(s4, a), "האם צריך אישור כניסה לחניון?").status_code == 201
    mid = question_id(s4, d["id"])
    pv = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/questions/{mid}/preview", json={"text": "כן, נשלח אישור.", "scope": "all", "notify": True},
                   headers=s4.h("mona"))
    assert pv.status_code == 200, pv.text
    by = {r["vendor_id"]: r for r in pv.json()["recipients"]}
    assert set(by) == {a, b} and by[a]["asker"] and not by[b]["asker"]
    assert by[a]["text"] == "כן, נשלח אישור."
    assert by[b]["text"] == "שאלה שהתקבלה מספק: האם צריך אישור כניסה לחניון?\nתשובה: כן, נשלח אישור."
    assert s4.vendor["display_name"] not in json.dumps(pv.json()["recipients"][1]["text"], ensure_ascii=False)
    assert messages_count(s4, d["id"]) == 1, "the preview stores nothing"
    r = answer(s4, d["id"], mid, text="כן, נשלח אישור.", scope="all", question_text="האם צריך אישור כניסה?")
    assert r.status_code == 201, r.text
    assert r.json()["answer"]["scope"] == "all" and len(r.json()["answer"]["items"]) == 2 and r.json()["answer"]["broadcast_id"]
    other = view(c, token(s4, b))["messages"]
    assert [m["text"] for m in other] == ["שאלה שהתקבלה מספק: האם צריך אישור כניסה?\nתשובה: כן, נשלח אישור."]
    assert "קליימה" not in other[0]["text"]
    # a second question, the manager names the vendor this time
    assert ask(c, token(s4, a), "מה שעות העבודה?").status_code == 201
    mid2 = question_id(s4, d["id"])
    assert answer(s4, d["id"], mid2, text="8-16", scope="all", name_asker=True).status_code == 201
    assert view(c, token(s4, b))["messages"][-1]["text"].startswith(f"שאלה מ{s4.vendor['display_name']}: מה שעות העבודה?")


def test_audit_and_timeline_rows_carry_ids_only(s4):
    d, a, _b, c = setup_two(s4)
    words = ("פינוי", "סודי", "הודעה פנימית")
    assert quote(c, token(s4, a), question="פינוי סודי?").status_code == 201
    mid = question_id(s4, d["id"])
    assert answer(s4, d["id"], mid, text="הודעה פנימית", scope="all").status_code == 201
    rows = audits(s4, "ticket.rfq.")
    assert {"ticket.rfq.vendor_message", "ticket.rfq.answer"} <= {x["action"] for x in rows}
    for x in rows:
        blob = json.dumps(x, ensure_ascii=False)
        for w in words:
            assert w not in blob, (x["action"], w)
    for e in detail(s4, d["id"])["timeline"]:
        for w in words:
            assert w not in json.dumps(e["data"], ensure_ascii=False)


def test_handled_without_a_reply_sends_nothing(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    mid = question_id(s4, d["id"])
    with s4.db.connection(mode="read") as conn:
        before = conn.execute("SELECT COUNT(*) FROM ticket_outbox WHERE rfq_id = ?", (d["id"],)).fetchone()[0]
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/questions/{mid}/resolve", headers=s4.h("mona"))
    assert r.status_code == 200 and r.json()["questions"]["pending"] == 0
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM ticket_outbox WHERE rfq_id = ?", (d["id"],)).fetchone()[0] == before
    assert messages_count(s4, d["id"]) == 1
    assert view(c, token(s4, a))["messages"][0]["answered"] is False, "the vendor is not told 'answered' without an answer"
    assert notif(s4, "rfq.question")[0]["state"] == "resolved"


def test_a_plain_viewer_has_no_badge(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    assert s4.c.get(f"{API}/tickets/rfqs/questions/summary", headers=s4.h("tom")).json() == {"pending": 0, "unread": 0, "requests": 0}
    s4.c.get(f"{API}/me", headers=s4.h("vic"))
    assert s4.c.get(f"{API}/tickets/rfqs/questions/summary", headers=s4.h("vic")).status_code == 403, "no tickets.view at all"
    assert s4.c.get(f"{API}/tickets/rfqs/questions/summary", headers=s4.h("mona")).json() == {"pending": 1, "unread": 1, "requests": 1}


# ---------------------------------------------------------------- the flows

def test_the_quote_forms_question_is_a_pending_unread_item_everywhere(s4):
    d, a, b, c = setup_two(s4)
    r = quote(c, token(s4, a), note="המחיר לא כולל מנוף", question="האם יש מעלית משא?")
    assert r.status_code == 201, r.text
    qid = r.json()["quote"]["id"]
    full = detail(s4, d["id"], "mona")
    assert full["questions"]["pending"] == 1 and full["questions"]["unread"] == 1 and full["can"]["answer"] is True
    (item,) = full["questions"]["items"]
    assert item["vendor_id"] == a and item["text"] == "האם יש מעלית משא?" and item["quote"] == {"id": qid, "version": 1}
    assert item["read"] is False and item["via"] == "page"
    va = next(v for v in full["vendors"] if v["id"] == a)
    assert va["questions"] == {"pending": 1, "unread": 1}
    assert next(v for v in full["vendors"] if v["id"] == b)["questions"] == {"pending": 0, "unread": 0}
    row = next(i for i in s4.c.get(f"{API}/tickets/rfqs?state=all", headers=s4.h("mona")).json()["items"] if i["id"] == d["id"])
    assert row["questions"] == {"pending": 1, "unread": 1}
    cmp_ = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/comparison", headers=s4.h("joni")).json()
    col = next(q for q in cmp_["quotes"] if q["vendor_id"] == a)
    assert col["questions"] == {"pending": 1, "unread": 1} and col["note"] == "המחיר לא כולל מנוף"
    assert next(v for v in detail(s4, d["id"], "joni")["vendors"] if v["id"] == a)["quote"]["has_note"] is True
    msgs = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages", headers=s4.h("mona")).json()["items"]
    assert msgs[0]["question"]["state"] == "pending" and msgs[0]["question"]["quote_id"] == qid
    assert notif(s4, "rfq.question")[0]["state"] == "open"
    # the manager opens the thread: no longer new, still pending
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages/read", headers=s4.h("mona")).json() == {"read": 1}
    assert detail(s4, d["id"], "mona")["questions"] | {"items": None} == {"pending": 1, "unread": 0, "items": None}
    assert s4.c.get(f"{API}/tickets/rfqs/questions/summary", headers=s4.h("mona")).json() == {"pending": 1, "unread": 0, "requests": 1}


def test_answer_to_the_vendor_only_marks_answered_and_resolves_the_notification(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    mid = question_id(s4, d["id"])
    r = answer(s4, d["id"], mid, notify=True)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["answer"]["scope"] == "vendor" and [i["vendor_id"] for i in body["answer"]["items"]] == [a]
    assert body["answer"]["notified"] == 1, "the templated 'new message' notice is queued (never the text)"
    assert body["rfq"]["questions"]["pending"] == 0 and body["rfq"]["questions"]["items"] == []
    with s4.db.connection(mode="read") as conn:
        (purpose, ) = conn.execute("SELECT purpose FROM ticket_outbox WHERE rfq_id = ? ORDER BY created_at DESC LIMIT 1", (d["id"],)).fetchone()
    assert purpose == "rfq_update"
    assert notif(s4, "rfq.question")[0]["state"] == "resolved"
    assert s4.c.get(f"{API}/tickets/rfqs/questions/summary", headers=s4.h("mona")).json()["pending"] == 0
    # a repeated press (the same client_request_id) answers the first answer and stores nothing twice
    assert ask(c, token(s4, a), "שאלה נוספת").status_code == 201
    mid2 = question_id(s4, d["id"])
    fixed = crid()
    first = answer(s4, d["id"], mid2, client_request_id=fixed)
    n = messages_count(s4, d["id"])
    again = answer(s4, d["id"], mid2, client_request_id=fixed)
    assert first.status_code == 201 and again.status_code == 201 and again.json()["replayed"] is True
    assert again.json()["answer"] == first.json()["answer"] and messages_count(s4, d["id"]) == n


def test_the_vendor_message_route_also_answers_his_open_questions(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    assert ask(c, token(s4, a), "ועוד שאלה").status_code == 201
    assert detail(s4, d["id"])["questions"]["pending"] == 2
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages", json={"text": "תשובה לשתיהן", "notify": False}, headers=s4.h("mona"))
    assert r.status_code == 201
    assert detail(s4, d["id"])["questions"]["pending"] == 0
    assert all(m["answered"] for m in view(c, token(s4, a))["messages"] if m["mine"])


def test_the_reminder_is_raised_once_after_n_hours_and_resolved_by_the_answer(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    now = dt.datetime.now(dt.timezone.utc)
    with s4.db.connection() as conn:
        assert rfq_questions.remind(conn, now + dt.timedelta(hours=2)) == 0, "not yet"
        assert rfq_questions.remind(conn, now + dt.timedelta(hours=25)) == 1
        assert rfq_questions.remind(conn, now + dt.timedelta(hours=50)) == 0, "once per question"
    (n,) = notif(s4, "rfq.question_unanswered")
    assert n["state"] == "open" and n["title"] == f"{d['ref']}: שאלת ספק ממתינה לתשובה" and "24 שעות" in n["body"]
    assert "פינוי" not in n["title"] + n["body"]
    assert answer(s4, d["id"], question_id(s4, d["id"])).status_code == 201
    assert notif(s4, "rfq.question_unanswered")[0]["state"] == "resolved"


def test_the_reminder_is_off_at_zero_hours(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    r = s4.c.get(f"{API}/tickets/settings")
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "rfq": {"question_reminder_hours": 0}})
    assert r.status_code == 200, r.text
    with s4.db.connection() as conn:
        assert rfq_questions.remind(conn, dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=3)) == 0


def test_badges_end_with_the_request(s4):
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/close", json={"revision": detail(s4, d["id"])["revision"]}, headers=s4.h("mona"))
    assert r.status_code == 200, r.text
    after = detail(s4, d["id"], "mona")
    assert after["questions"] == {"pending": 0, "unread": 0, "items": []}
    assert s4.c.get(f"{API}/tickets/rfqs/questions/summary", headers=s4.h("mona")).json()["pending"] == 0
    msgs = s4.c.get(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages", headers=s4.h("mona")).json()["items"]
    assert msgs[0]["question"]["state"] == "pending", "the thread still says it was never answered"
    r = answer(s4, d["id"], msgs[0]["id"], scope="all")
    assert r.status_code == 409 and r.json()["code"] == "rfq_invalid_transition", "no broadcast on an ended request"


def test_the_migration_backfill_counts_a_later_manager_message_as_the_answer(s4):
    """0104 (provisional 0106): before it, a manager's message to the vendor resolved his question; the backfill stores exactly that (and nothing else)."""
    from pathlib import Path

    from smplwise import db as dbmod

    d, a, b, c = setup_two(s4)
    assert ask(c, token(s4, a), "שאלה ישנה").status_code == 201
    assert s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{a}/messages", json={"text": "תשובה ישנה", "notify": False}, headers=s4.h("mona")).status_code == 201
    assert ask(c, token(s4, b), "שאלה ישנה בלי תשובה").status_code == 201
    sql = (Path(dbmod.MIGRATIONS_DIR) / "0104_ticket_rfq_questions.sql").read_text(encoding="utf-8")
    updates = [st.strip() for st in sql.split(";") if st.strip().upper().lstrip("- \n").startswith("UPDATE") or "\nUPDATE" in st]
    with s4.db.connection() as conn:
        conn.execute("UPDATE ticket_rfq_messages SET answered_at = NULL, answered_by = NULL, answer_id = NULL, read_at = NULL, read_by = NULL")
        for st in updates:
            conn.execute(st[st.index("UPDATE"):])
        rows = {r["body"]: dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_messages WHERE rfq_id = ?", (d["id"],)).fetchall()}
    old, out, open_ = rows["שאלה ישנה"], rows["תשובה ישנה"], rows["שאלה ישנה בלי תשובה"]
    assert old["answer_id"] == out["id"] and old["answered_at"] == out["created_at"] and old["read_at"]
    assert open_["answered_at"] is None and open_["answer_id"] is None, "another vendor's question is not answered by this message"
    assert out["answered_at"] is None, "outbound rows are untouched"
