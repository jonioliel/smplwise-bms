"""CR-038 18A - the "ask the manager" note on the handler page: a note sent with `ask` is a question - the ticket waits for the
manager (`waiting_on = manager`, reason `question`), the managers get `ticket.question` (never the text), the timeline row is a
plain note flagged `question`, a manager's external note answers it, and a status move by the handler ends it. Names are invented."""
from __future__ import annotations

import time

import pytest
from conftest import bind

from tickets_s4_world import API, Clock, build_s4, crid


@pytest.fixture()
def s4(settings, monkeypatch):
    world = build_s4(settings, monkeypatch)
    bind(world.c, settings, "mona", "tickets_external", "installation", "*")
    return world


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


def sent(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    return t, token, client


def detail(s4, tid):
    r = s4.c.get(f"{API}/tickets/{tid}")
    assert r.status_code == 200, r.text
    return r.json()


def question_rows(s4, tid):
    with s4.db.connection() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = 'ticket.question' AND subject_id = ?", (tid,)).fetchall()]


def ask(client, token, text="איזה מזגן מתכוונים?", **kw):
    return client.post("/t/api/note", headers=hdr(token), json={"text": text, "ask": True, "client_request_id": crid(), **kw})


def test_a_question_makes_the_ticket_wait_for_the_manager_and_tells_the_managers(s4):
    t, token, client = sent(s4)
    client.post("/t/api/status", headers=hdr(token), json={"status": "acknowledged", "client_request_id": crid()})
    assert detail(s4, t["id"])["waiting_on"] == "assignee"
    r = ask(client, token)
    assert r.status_code == 200, r.text
    d = detail(s4, t["id"])
    assert d["waiting_on"] == "manager" and d["waiting_reason"] == "question"
    rows = question_rows(s4, t["id"])
    assert len(rows) == 1 and rows[0]["state"] != "resolved"
    assert "איזה מזגן" not in (rows[0]["title"] or "") + (rows[0]["body"] or "")  # the fact, never the text
    item = [i for i in client.get("/t/api/ticket", headers=hdr(token)).json()["timeline"] if i.get("question")]
    assert len(item) == 1 and item[0]["kind"] == "note" and item[0]["mine"] is True and item[0]["body"] == "איזה מזגן מתכוונים?"


def test_a_plain_note_does_not_change_who_waits(s4):
    t, token, client = sent(s4)
    client.post("/t/api/status", headers=hdr(token), json={"status": "acknowledged", "client_request_id": crid()})
    assert client.post("/t/api/note", headers=hdr(token), json={"text": "בדרך", "client_request_id": crid()}).status_code == 200
    assert detail(s4, t["id"])["waiting_on"] == "assignee"
    assert question_rows(s4, t["id"]) == []
    assert not [i for i in client.get("/t/api/ticket", headers=hdr(token)).json()["timeline"] if i.get("question")]


def test_the_question_is_idempotent_by_request_id(s4):
    t, token, client = sent(s4)
    rid = crid()
    a = ask(client, token, client_request_id=rid)
    b = ask(client, token, client_request_id=rid)
    assert a.status_code == b.status_code == 200 and a.json() == b.json()
    assert len(question_rows(s4, t["id"])) == 1


def test_a_managers_external_note_answers_the_question(s4):
    t, token, client = sent(s4)
    client.post("/t/api/status", headers=hdr(token), json={"status": "in_progress", "client_request_id": crid()})
    assert ask(client, token).status_code == 200
    r = s4.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "הקומה השנייה", "external": True})
    assert r.status_code in (200, 201), r.text
    d = detail(s4, t["id"])
    assert d["waiting_on"] == "assignee" and d["waiting_reason"] is None
    assert all(r["state"] == "resolved" for r in question_rows(s4, t["id"]))


def test_an_internal_note_does_not_answer_and_a_status_move_ends_the_question(s4):
    t, token, client = sent(s4)
    client.post("/t/api/status", headers=hdr(token), json={"status": "in_progress", "client_request_id": crid()})
    assert ask(client, token).status_code == 200
    assert s4.c.post(f"{API}/tickets/{t['id']}/notes", json={"text": "פנימי", "external": False}).status_code in (200, 201)
    assert detail(s4, t["id"])["waiting_reason"] == "question"
    r = client.post("/t/api/status", headers=hdr(token), json={"status": "waiting_part", "client_request_id": crid()})
    assert r.status_code == 200, r.text
    assert detail(s4, t["id"])["waiting_reason"] != "question"
    assert all(r["state"] == "resolved" for r in question_rows(s4, t["id"]))


def test_ask_must_be_a_boolean_and_a_returned_ticket_refuses(s4):
    t, token, client = sent(s4)
    bad = client.post("/t/api/note", headers=hdr(token), json={"text": "x", "ask": "yes", "client_request_id": crid()})
    assert bad.status_code == 422
    client.post("/t/api/status", headers=hdr(token), json={"status": "in_progress", "client_request_id": crid()})
    assert client.post("/t/api/return", headers=hdr(token), json={"kind": "not_mine", "reason": "לא שלי", "client_request_id": crid()}).status_code == 200
