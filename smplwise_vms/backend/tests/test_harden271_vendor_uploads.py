"""2.7.1 hardening of the RFQ vendor uploads (Fable review RELEASE_270_REVIEW_VENDOR_UPLOAD, F3 and F5; negative first, real store and
real public listener app). F1 (one costs.view rule for every vendor file) and F2 (the per-network upload window) are pinned in
tests/test_tickets_rfq_vendor_uploads.py next to the tests they changed.

- F3: a file bound to a question that was already answered (or read) used to leave no trace a manager would see. The question is now
  pending and unread again, so the badge, the pending card and the thread show it.
- F5: erasing a vendor contact "also from the history" left his name on the RFQ timeline rows and the names he typed for his own files.
  Both are rewritten (the files' bytes stay: they are the quote's record)."""
from __future__ import annotations

import json

from test_tickets_cost_files import pdf
from test_tickets_rfq_public import detail, s4, vid  # noqa: F401 - s4 is a fixture
from test_tickets_rfq_vendor_uploads import ask, up, world
from tickets_s4_world import API

TYPED = "quote-Yossi-Cohen-0500000077.pdf"


def _question(s4, mid: str) -> dict:
    with s4.db.connection(mode="read") as conn:
        return dict(conn.execute("SELECT * FROM ticket_rfq_messages WHERE id = ?", (mid,)).fetchone())


def test_f3_a_file_on_an_answered_question_makes_it_pending_and_unread_again(s4):  # noqa: F811
    d, c, _ta, _qid, tb = world(s4)
    mid = ask(c, tb)
    rv_b = vid(d, s4.contact["id"])
    r = s4.c.post(f"{API}/tickets/rfqs/{d['id']}/vendors/{rv_b}/messages", json={"text": "כן, התוכנית מצורפת", "notify": False}, headers=s4.h("mona"))
    assert r.status_code in (200, 201), r.text
    q = _question(s4, mid)
    assert q["answered_at"] and q["read_at"], "answered (and so read) by the manager's reply"
    before = next(v for v in detail(s4, d["id"], "joni")["vendors"] if v["id"] == rv_b)["questions"]
    assert before == {"pending": 0, "unread": 0}
    f = up(c, tb, None, pdf(), message_id=mid)
    assert f.status_code == 201, f.text
    q = _question(s4, mid)
    assert q["answered_at"] is None and q["read_at"] is None, "the late file is not missed"
    det = detail(s4, d["id"], "joni")
    assert next(v for v in det["vendors"] if v["id"] == rv_b)["questions"] == {"pending": 1, "unread": 1}
    pend = next(p for p in det["questions"]["items"] if p["id"] == mid)
    assert [x["id"] for x in pend["files"]] == [f.json()["file"]["id"]]


def test_f5_erasing_the_vendor_from_the_history_reaches_the_rfq_timeline_and_his_file_names(s4):  # noqa: F811
    d, c, _ta, _qid, tb = world(s4)
    mid = ask(c, tb)
    assert up(c, tb, None, pdf(), message_id=mid, name=TYPED).status_code == 201
    person = s4.contact
    with s4.db.connection(mode="read") as conn:
        named = [r[0] for r in conn.execute("SELECT actor_name FROM ticket_rfq_events WHERE actor_kind = 'contact'").fetchall()]
    assert named and any(n for n in named), "his name is on the vendor events before the erase"
    r = s4.c.post(f"{API}/tickets/contacts/{person['id']}/erase", json={"confirm": True, "history": True})
    assert r.status_code == 200, r.text
    with s4.db.connection(mode="read") as conn:
        rv = vid(d, person["id"])
        names = [r[0] for r in conn.execute("SELECT actor_name FROM ticket_rfq_events WHERE actor_kind = 'contact' AND rfq_vendor_id = ?", (rv,)).fetchall()]
        files = [dict(r) for r in conn.execute("SELECT name, path FROM ticket_rfq_vendor_files WHERE rfq_vendor_id = ?", (rv,)).fetchall()]
        tomb = conn.execute("SELECT display_name FROM ticket_contacts WHERE id = ?", (person["id"],)).fetchone()[0]
    assert names and set(names) == {tomb}, names
    assert [f["name"] for f in files] == ["file.pdf"] and files[0]["path"], "the name is neutral, the bytes stay"
    with s4.db.connection(mode="read") as conn:
        blob = json.dumps([dict(r) for r in conn.execute("SELECT * FROM ticket_rfq_vendor_files").fetchall()], ensure_ascii=False)
    assert "Yossi" not in blob and "0500000077" not in blob
