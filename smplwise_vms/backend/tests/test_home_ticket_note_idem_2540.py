"""STALE-ANSWERS-2540 (review SCR-39): the home ticket note takes an optional idempotency key (ADR-015, additive).

The same `client_request_id` again - a double tap, a retry after a lost answer - returns the first answer and adds no second note; the
same key used for another ticket is refused; a note without a key behaves as before (each call is a note)."""
from __future__ import annotations

from tickets_world import build as tickets_build
from tickets_world import rid

API = "/api/v1"


def _notes(w, ticket_id: str) -> list[str]:
    return [e.get("body") for e in w.detail(ticket_id)["events"] if e["kind"] == "note"]


def _open(w, title: str = "נזילה במטבח") -> str:
    r = w.c.post(f"{API}/home/tickets", json={"department_id": "dept-maintenance", "title": title, "where": "מטבח", "text": "מטפטף",
                                             "client_request_id": rid()}, headers=w.h("nora"))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_the_same_request_id_twice_adds_one_note_and_answers_the_first_result(settings):
    w = tickets_build(settings)
    mine = _open(w)
    key = rid()
    first = w.c.post(f"{API}/home/tickets/{mine}/notes", json={"text": "עדיין מטפטף", "client_request_id": key}, headers=w.h("nora"))
    assert first.status_code == 201, first.text
    again = w.c.post(f"{API}/home/tickets/{mine}/notes", json={"text": "עדיין מטפטף", "client_request_id": key}, headers=w.h("nora"))
    assert again.status_code == 201, again.text
    assert again.json() == first.json()
    assert _notes(w, mine) == ["עדיין מטפטף"]
    # a new key is a new note
    other = w.c.post(f"{API}/home/tickets/{mine}/notes", json={"text": "ועכשיו יותר", "client_request_id": rid()}, headers=w.h("nora"))
    assert other.status_code == 201, other.text
    assert _notes(w, mine) == ["עדיין מטפטף", "ועכשיו יותר"]


def test_the_same_request_id_on_another_ticket_is_refused_and_adds_nothing(settings):
    w = tickets_build(settings)
    a, b = _open(w, "נזילה"), _open(w, "נורה שרופה")
    key = rid()
    assert w.c.post(f"{API}/home/tickets/{a}/notes", json={"text": "הערה", "client_request_id": key}, headers=w.h("nora")).status_code == 201
    r = w.c.post(f"{API}/home/tickets/{b}/notes", json={"text": "הערה", "client_request_id": key}, headers=w.h("nora"))
    assert r.status_code == 409 and r.json()["code"] == "request_id_reused", r.text
    assert _notes(w, b) == []


def test_without_a_request_id_each_call_is_a_note_as_before_and_a_bad_key_is_refused(settings):
    w = tickets_build(settings)
    mine = _open(w)
    for _ in range(2):
        assert w.c.post(f"{API}/home/tickets/{mine}/notes", json={"text": "שוב"}, headers=w.h("nora")).status_code == 201
    assert _notes(w, mine) == ["שוב", "שוב"]
    bad = w.c.post(f"{API}/home/tickets/{mine}/notes", json={"text": "x", "client_request_id": "bad id!"}, headers=w.h("nora"))
    assert bad.status_code == 422, bad.text
