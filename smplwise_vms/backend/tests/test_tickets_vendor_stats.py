"""CR-SVC215 slice 1 - the computed vendor card over the REAL store (docs/changes/CR-SVC215.md section 2; owner answers 2026-10-24 items
28 and 30): the switch, who opens the card (the site manager) and who sees money on it (cost viewers), both editable; the six numbers
against hand-built rows (response, arrival, repeat on the same device only, quote adherence, returned, volume); empty bases read as
null, never "0 %"; the money field is absent, not null; an employee row has no card; a technician counts for his company; the view is
audited. Every name and number is invented."""
from __future__ import annotations

import datetime as dt
import json
import time

import pytest

from smplwise.services.tickets import vendor_stats
from tickets_s4_world import API, Clock, build_s4, crid

UTC = dt.timezone.utc


@pytest.fixture()
def s4(settings, monkeypatch):
    return build_s4(settings, monkeypatch)


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


def stats(s4, contact_id: str, user: str = "joni", **q):
    return s4.c.get(f"{API}/tickets/contacts/{contact_id}/stats", params=q, headers=s4.h(user))


def put(s4, **blocks):
    r = s4.c.get(f"{API}/tickets/settings")
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], **blocks})
    assert r.status_code == 200, r.text


def test_switch_off_is_feature_disabled(s4):
    put(s4, vendor_stats={"enabled": False})
    r = stats(s4, s4.contact["id"])
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"


def test_who_opens_the_card_and_who_sees_money_editable(s4):
    r = stats(s4, s4.contact["id"], user="tom")
    assert r.status_code == 403, "a member without tickets.manage"
    m = stats(s4, s4.contact["id"], user="mona")
    assert m.status_code == 200, m.text
    assert m.json()["money"] is False and "quote" not in m.json()["numbers"], "money absent (not null) without tickets.costs.view"
    j = stats(s4, s4.contact["id"])
    assert j.json()["money"] is True and "quote" in j.json()["numbers"]
    put(s4, vendor_stats={"card_permission": "tickets.configure"})
    assert stats(s4, s4.contact["id"], user="mona").status_code == 403, "owner answer 30: editable"
    with s4.db.connection(mode="read") as conn:
        n = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'tickets.stats.view' AND decision = 'allowed'").fetchone()[0]
    assert n == 2, "each open is audited"


def test_the_numbers_shown_are_editable_and_there_is_never_a_score(s4):
    put(s4, vendor_stats={"numbers": ["response", "repeat"]})
    body = stats(s4, s4.contact["id"]).json()
    assert set(body["numbers"]) == {"response", "repeat"} and body["shown"] == ["response", "repeat"]
    assert "score" not in json.dumps(body)


def test_an_empty_card_reads_null_not_zero(s4):
    body = stats(s4, s4.contact["id"]).json()
    n = body["numbers"]
    assert n["response"]["median_min"] is None and n["arrival"]["share_bp"] is None and n["repeat"]["share_bp"] is None
    assert n["returned"]["share_bp"] is None and n["volume"] == {"done": 0, "open_now": 0}
    assert stats(s4, s4.contact["id"], months=7).status_code == 422


def test_response_returned_volume_and_repeat_from_real_actions(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).status_code == 200  # the first open: the response signal
    for st in ("acknowledged", "done"):
        assert client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()}).status_code == 200
    t2, token2 = s4.sent()
    c2, _ = s4.public(Clock(time.time()))
    assert c2.post("/t/api/return", headers=hdr(token2), json={"kind": "cannot_handle", "reason": "חסר חלק", "client_request_id": crid()}).status_code == 200
    n = stats(s4, s4.contact["id"]).json()["numbers"]
    assert n["response"]["base"] >= 1 and n["response"]["median_min"] is not None
    assert n["returned"] == {"count": 1, "base": 2, "share_bp": 5000}
    assert n["volume"]["done"] == 1
    assert n["repeat"] == {"count": 0, "base": 1, "share_bp": 0, "days": 30}
    with s4.db.connection() as conn:  # a reopen within 30 days counts once
        conn.execute("INSERT INTO ticket_events(ticket_id, at, kind, actor_kind, via, from_status, to_status) VALUES (?, ?, 'status', 'user', 'app', 'done', 'in_progress')",
                     (t["id"], (dt.datetime.now(UTC) + dt.timedelta(seconds=5)).strftime("%Y-%m-%dT%H:%M:%SZ")))
    future = dt.datetime.now(UTC) + dt.timedelta(minutes=1)
    with s4.db.connection(mode="read") as conn:
        out = vendor_stats.compute(conn, s4.contact["id"], months=12, now=future, money=True)
    assert out["numbers"]["repeat"]["count"] == 1


def test_arrival_share_counts_visits_that_ended(s4):
    t, _token = s4.sent()
    now = dt.datetime.now(UTC).replace(microsecond=0)
    with s4.db.connection() as conn:
        for i, (state, late) in enumerate((("arrived", 0), ("arrived", 1), ("missed", 0), ("planned", 0), ("cancelled", 0))):
            at = (now - dt.timedelta(days=i + 1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            conn.execute("INSERT INTO ticket_visits(id, ticket_id, assignment_id, department_id, contact_id, vendor_id, planned_from, planned_to, source, "
                         "grace_min, state, late, created_by_kind, created_at, updated_at) VALUES (?, ?, NULL, 'dept-maintenance', ?, ?, ?, ?, 'manager', 60, ?, ?, "
                         "'system', ?, ?)", (f"v{i}", t["id"], s4.contact["id"], s4.contact["id"], at, at, state, late, at, at))
    a = stats(s4, s4.contact["id"]).json()["numbers"]["arrival"]
    assert a == {"on_time": 1, "late": 1, "missed": 1, "base": 3, "share_bp": 3333}


def test_an_employee_has_no_card_and_a_technician_counts_for_his_company(s4):
    emp = s4.add_contact(display_name="עובד אחזקה", phone="050-000-0077", employee=True)
    if emp.status_code == 201:
        assert stats(s4, emp.json()["id"]).status_code == 404, "staff are never measured here"
    tech = s4.add_contact(display_name="טכנאי", phone="050-000-0078", vendor_id=s4.vendor["id"])
    if tech.status_code == 201:
        body = stats(s4, tech.json()["id"]).json()
        assert body["unit_id"] == s4.vendor["id"]
    assert stats(s4, "no-such-contact").status_code == 404
