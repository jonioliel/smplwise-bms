"""CR-SVC215 slice 1 - vendor visits, the vendor's "I arrived" and the missed-arrival detector over the REAL store (docs/changes/CR-SVC215.md
sections 3, 4, 7, 8; owner answers 2026-10-24 items 31, 32, 35, 36). Negative first: the switch, the permissions, the window gate; then
the sources (manager, ETA), the claim and its undo, the detector (grace per department, once per visit, the backfill rule, the
department switch), the late arrival and the reschedule. Fakes only: the public app through an ASGI client, no message channel, every
name and number invented."""
from __future__ import annotations

import datetime as dt
import time

import pytest

from smplwise.services.tickets import visits
from smplwise.services.tickets.public_http import UNIFORM_404
from tickets_s4_world import API, Clock, build_s4, crid

UTC = dt.timezone.utc


@pytest.fixture()
def s4(settings, monkeypatch):
    w = build_s4(settings, monkeypatch)
    visits._LAST.clear()
    return w


def hdr(token: str) -> dict[str, str]:
    return {"x-ticket-token": token}


def z(v: dt.datetime) -> str:
    return v.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def now() -> dt.datetime:
    return dt.datetime.now(UTC).replace(microsecond=0)


def settings_put(s4, **blocks):
    r = s4.c.get(f"{API}/tickets/settings")
    assert r.status_code == 200, r.text
    r = s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], **blocks})
    assert r.status_code == 200, r.text
    return r.json()


def plan(s4, tid, start: dt.datetime, end: dt.datetime, user: str = "joni", **extra):
    return s4.c.post(f"{API}/tickets/{tid}/visits", json={"planned_from": z(start), "planned_to": z(end), **extra}, headers=s4.h(user))


def visits_of(s4, tid, user: str = "joni") -> list[dict]:
    r = s4.c.get(f"{API}/tickets/{tid}/visits", headers=s4.h(user))
    assert r.status_code == 200, r.text
    return r.json()["visits"]


def notes(s4, source: str) -> list[dict]:
    with s4.db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at, id", (source,)).fetchall()]


def events(s4, tid, kind: str) -> list[dict]:
    return [e for e in s4.w.detail(tid)["events"] if e["kind"] == kind]


# ---------------------------------------------------------------- switches and the module

def test_the_three_switches_default_on_and_the_module_answers_them(s4):
    f = s4.c.get(f"{API}/tickets/module").json()["features"]
    assert f == {"vendor_stats": True, "visits": True, "budgets": True}, "owner answer 36: all three ON by default"
    doc = s4.c.get(f"{API}/tickets/settings").json()
    assert doc["visits"]["grace_min"] == 60, "owner answer 32: 60 minutes"
    assert doc["visits"]["notify_vendor_on_miss"] is False, "owner answer 35: managers only by default"
    assert doc["visits"]["claim_counts"] is True and doc["visits"]["staff_can_undo_claim"] is True, "owner answer 31"


def test_switch_off_every_visit_route_is_feature_disabled_and_the_page_has_no_visit(s4):
    t, token = s4.sent()
    assert plan(s4, t["id"], now() - dt.timedelta(minutes=10), now() + dt.timedelta(hours=1)).status_code == 200
    settings_put(s4, visits={"enabled": False})
    for r in (s4.c.get(f"{API}/tickets/{t['id']}/visits"), plan(s4, t["id"], now(), now() + dt.timedelta(hours=1)),
              s4.c.get(f"{API}/tickets/admin/departments/dept-maintenance/visits")):
        assert r.status_code == 404 and r.json()["code"] == "feature_disabled", r.text
    client, _ = s4.public(Clock(time.time()))
    page = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert "visit" not in page
    r = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()})
    assert r.status_code == 404 and r.content == UNIFORM_404, "off = the uniform 404"
    assert s4.c.get(f"{API}/tickets/module").json()["features"]["visits"] is False
    assert visits.tick(s4.db, force=True, now=now() + dt.timedelta(days=1)) == 0, "the detector idles"


def test_the_public_arrival_kill_switch_closes_only_the_page_route(s4):
    t, token = s4.sent()
    assert plan(s4, t["id"], now() - dt.timedelta(minutes=10), now() + dt.timedelta(hours=1)).status_code == 200
    settings_put(s4, visits={"public_arrival": False})
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).json()["visit"]["can_arrive"] is False
    r = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()})
    assert r.status_code == 404 and r.content == UNIFORM_404
    assert s4.c.post(f"{API}/tickets/{t['id']}/visits/{visits_of(s4, t['id'])[0]['id']}/arrived", json={}).status_code == 200, "staff still mark it"


def test_module_off_hides_the_visit_routes_and_the_features(s4):
    t, _token = s4.sent()
    assert s4.c.patch(f"{API}/settings", json={"tickets.enabled": "false"}).status_code == 200
    r = s4.c.get(f"{API}/tickets/{t['id']}/visits")
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"
    assert s4.c.get(f"{API}/tickets/module").json()["features"] == {"vendor_stats": False, "visits": False, "budgets": False}


# ---------------------------------------------------------------- permissions

def test_only_a_manager_plans_and_an_invisible_ticket_is_the_uniform_404(s4):
    t, _token = s4.sent()
    start, end = now() + dt.timedelta(hours=1), now() + dt.timedelta(hours=3)
    r = plan(s4, t["id"], start, end, user="tom")
    assert r.status_code == 403 and r.json()["details"]["reason"] == "not_manager", "a member is not a manager"
    assert plan(s4, t["id"], start, end, user="vic").status_code == 404, "no ticket permission: the ticket does not exist"
    assert plan(s4, t["id"], start, end, user="cleo").status_code == 404, "another department's manager"
    r = plan(s4, t["id"], start, end, user="mona")
    assert r.status_code == 200, r.text
    [v] = r.json()["visits"]
    assert v["state"] == "planned" and v["source"] == "manager" and v["grace_min"] == 60 and v["actions"]["cancel"] is True
    assert s4.c.put(f"{API}/tickets/admin/departments/dept-maintenance/visits", json={"grace_min": 15, "detect": True},
                    headers=s4.h("mona")).status_code == 403, "the department's grace is tickets.configure"


def test_a_ticket_without_an_external_assignment_cannot_get_a_visit(s4):
    t = s4.ticket()
    r = plan(s4, t["id"], now() + dt.timedelta(hours=1), now() + dt.timedelta(hours=2))
    assert r.status_code == 409 and r.json()["code"] == "no_vendor_assignment"


def test_window_validation(s4):
    t, _ = s4.sent()
    for a, b, code in ((now() + dt.timedelta(hours=2), now() + dt.timedelta(hours=1), "order"),
                       (now(), now() + dt.timedelta(days=20), "too_long"),
                       (now() - dt.timedelta(days=5), now() - dt.timedelta(days=4), "past")):
        r = plan(s4, t["id"], a, b)
        assert r.status_code == 422 and r.json()["details"]["fields"][0]["code"] == code, r.text


# ---------------------------------------------------------------- planning, moving, one planned per assignment

def test_planning_twice_moves_the_one_planned_visit_and_a_stale_move_is_409(s4):
    t, _ = s4.sent()
    a = now() + dt.timedelta(hours=1)
    assert plan(s4, t["id"], a, a + dt.timedelta(hours=2)).status_code == 200
    r = plan(s4, t["id"], a + dt.timedelta(days=1), a + dt.timedelta(days=1, hours=2))
    assert r.status_code == 200
    [v] = r.json()["visits"]
    assert v["planned_from"] == z(a + dt.timedelta(days=1)), "one planned visit per assignment: planning again moves it"
    stale = s4.c.patch(f"{API}/tickets/{t['id']}/visits/{v['id']}", json={"revision": v["revision"] - 1, "planned_from": z(a), "planned_to": z(a + dt.timedelta(hours=1))})
    assert stale.status_code == 409 and stale.json()["code"] == "visit_stale"
    ok = s4.c.patch(f"{API}/tickets/{t['id']}/visits/{v['id']}", json={"revision": v["revision"], "planned_from": z(a), "planned_to": z(a + dt.timedelta(hours=1)),
                                                                        "grace_min": 30})
    assert ok.status_code == 200 and ok.json()["visits"][0]["grace_min"] == 30
    assert {e["kind"] for e in s4.w.detail(t["id"])["events"]} >= {"visit_planned", "visit_moved"}
    assert len(notes(s4, "ticket.visit_planned")) == 1, "one row per visit (a move refolds it)"


def test_the_vendor_eta_makes_the_visit_and_clearing_it_cancels(s4):
    t, token = s4.sent()
    clock = Clock(time.time())
    client, _ = s4.public(clock)
    assert client.post("/t/api/status", headers=hdr(token), json={"status": "acknowledged", "client_request_id": crid()}).status_code == 200
    eta = now() + dt.timedelta(hours=3)
    r = client.post("/t/api/eta", headers=hdr(token), json={"eta_at": z(eta), "client_request_id": crid()})
    assert r.status_code == 200, r.text
    [v] = visits_of(s4, t["id"])
    assert v["source"] == "vendor_eta" and v["planned_from"] == z(eta) and v["planned_to"] == z(eta + dt.timedelta(minutes=60))
    page = client.get("/t/api/ticket", headers=hdr(token)).json()
    assert page["visit"]["state"] == "planned" and page["visit"]["can_arrive"] is False, "three hours ahead: the button is not open yet"
    assert set(page["visit"]) == {"state", "planned_from", "planned_to", "can_arrive", "arrived_at", "late"}, "the page learns its own window only"
    assert client.post("/t/api/eta", headers=hdr(token), json={"eta_at": None, "client_request_id": crid()}).status_code == 200
    assert visits_of(s4, t["id"])[0]["state"] == "cancelled"


# ---------------------------------------------------------------- the vendor's "I arrived"

def test_the_vendor_press_inside_the_window_is_a_claim_idempotent_and_audited(s4):
    t, token = s4.sent()
    assert plan(s4, t["id"], now() - dt.timedelta(minutes=10), now() + dt.timedelta(hours=1)).status_code == 200
    client, _ = s4.public(Clock(time.time()))
    assert client.get("/t/api/ticket", headers=hdr(token)).json()["visit"]["can_arrive"] is True
    rid = crid()
    r1 = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": rid})
    assert r1.status_code == 200 and r1.json()["state"] == "arrived" and r1.json()["late"] is False, r1.text
    r2 = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": rid})
    assert r2.status_code == 200 and r2.json() == r1.json(), "a replay answers the first answer"
    r3 = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()})
    assert r3.status_code == 200 and r3.json()["state"] == "arrived", "a second press changes nothing"
    [v] = visits_of(s4, t["id"])
    assert v["state"] == "arrived" and v["arrived_by"] == "vendor_link" and v["claim"] is True
    assert len(events(s4, t["id"], "arrived")) == 1
    assert len(notes(s4, "ticket.arrived")) == 1
    bad = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid(), "note": "x"})
    assert bad.status_code == 422, "no body text of any kind"


def test_the_entry_code_pointer_is_off_by_default_and_never_creates_a_grant(s4):
    """VENDORARRIVAL126B-295: `visits.offer_access_request` (default off) only adds a boolean pointer to the arrived page block."""
    assert s4.c.get(f"{API}/tickets/settings").json()["visits"]["offer_access_request"] is False
    t, token = s4.sent()
    assert plan(s4, t["id"], now() - dt.timedelta(minutes=10), now() + dt.timedelta(hours=1)).status_code == 200
    client, _ = s4.public(Clock(time.time()))
    assert client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()}).status_code == 200
    assert "offer_access" not in client.get("/t/api/ticket", headers=hdr(token)).json()["visit"], "off: the block is unchanged"
    settings_put(s4, visits={"offer_access_request": True})
    with s4.db.connection(mode="read") as conn:
        before = conn.execute("SELECT COUNT(*) FROM access_grants").fetchone()[0]
    block = client.get("/t/api/ticket", headers=hdr(token)).json()["visit"]
    assert block["state"] == "arrived" and isinstance(block["offer_access"], bool)
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM access_grants").fetchone()[0] == before, "a pointer, never a grant"
    bad = s4.c.put(f"{API}/tickets/settings", json={"revision": s4.c.get(f"{API}/tickets/settings").json()["revision"], "visits": {"offer_access_request": "yes"}})
    assert bad.status_code == 422


def test_the_vendor_press_outside_the_window_is_422_and_without_a_visit_409(s4):
    t, token = s4.sent()
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()})
    assert r.status_code == 409 and r.json()["code"] == "no_visit"
    assert plan(s4, t["id"], now() + dt.timedelta(hours=5), now() + dt.timedelta(hours=6)).status_code == 200
    r = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()})
    assert r.status_code == 422 and r.json()["code"] == "outside_window"
    assert visits_of(s4, t["id"])[0]["state"] == "planned", "a refused press writes nothing"


def test_staff_undo_the_claim_and_the_setting_can_forbid_it(s4):
    t, token = s4.sent()
    assert plan(s4, t["id"], now() - dt.timedelta(minutes=5), now() + dt.timedelta(hours=1)).status_code == 200
    client, _ = s4.public(Clock(time.time()))
    assert client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()}).status_code == 200
    [v] = visits_of(s4, t["id"])
    assert v["actions"]["undo_claim"] is True
    r = s4.c.post(f"{API}/tickets/{t['id']}/visits/{v['id']}/undo-claim", json={"revision": v["revision"]}, headers=s4.h("tom"))
    assert r.status_code == 403
    r = s4.c.post(f"{API}/tickets/{t['id']}/visits/{v['id']}/undo-claim", json={"revision": v["revision"]})
    assert r.status_code == 200, r.text
    v2 = r.json()["visits"][0]
    assert v2["state"] == "planned" and v2["arrived_at"] is None
    assert client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()}).status_code == 200
    settings_put(s4, visits={"staff_can_undo_claim": False})
    v3 = visits_of(s4, t["id"])[0]
    r = s4.c.post(f"{API}/tickets/{t['id']}/visits/{v3['id']}/undo-claim", json={"revision": v3["revision"]})
    assert r.status_code == 403 and r.json()["code"] == "undo_not_allowed"


def test_claim_counts_off_a_press_is_reported_until_staff_confirm(s4):
    settings_put(s4, visits={"claim_counts": False})
    t, token = s4.sent()
    assert plan(s4, t["id"], now() - dt.timedelta(minutes=5), now() + dt.timedelta(hours=1)).status_code == 200
    client, _ = s4.public(Clock(time.time()))
    r = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()})
    assert r.status_code == 200 and r.json()["state"] == "reported", r.text
    [v] = visits_of(s4, t["id"])
    assert v["state"] == "reported"
    assert visits.tick(s4.db, force=True, now=now() + dt.timedelta(hours=5)) == 0, "a reported visit is not missed"
    r = s4.c.post(f"{API}/tickets/{t['id']}/visits/{v['id']}/arrived", json={})
    assert r.status_code == 200 and r.json()["visits"][0]["state"] == "arrived" and r.json()["visits"][0]["arrived_by"] == "staff"


def test_in_progress_through_the_link_is_a_claim_for_an_open_window(s4):
    t, token = s4.sent()
    assert plan(s4, t["id"], now() - dt.timedelta(minutes=5), now() + dt.timedelta(hours=1)).status_code == 200
    client, _ = s4.public(Clock(time.time()))
    for st in ("acknowledged", "in_progress"):
        assert client.post("/t/api/status", headers=hdr(token), json={"status": st, "client_request_id": crid()}).status_code == 200
    v = visits_of(s4, t["id"])[0]
    assert v["state"] == "arrived" and v["arrived_by"] == "vendor_link"


# ---------------------------------------------------------------- the detector

def test_the_detector_marks_a_miss_once_notifies_and_a_late_press_resolves(s4):
    t, token = s4.sent()
    start = now() - dt.timedelta(hours=3)
    assert plan(s4, t["id"], start, start + dt.timedelta(hours=1)).status_code == 200  # ended 2 h ago, grace 60: due 1 h ago
    assert visits.tick(s4.db, force=True, now=now()) == 1
    assert visits.tick(s4.db, force=True, now=now()) == 0, "once per visit"
    [v] = visits_of(s4, t["id"])
    assert v["state"] == "missed" and v["actions"]["reschedule"] is True
    [n] = notes(s4, "ticket.arrival_missed")
    assert n["state"] != "resolved" and n["severity"] == "alert"
    assert s4.w.detail(t["id"])["status"] == "assigned", "the detector never changes the ticket's status"
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'tickets.visit.missed'").fetchone()[0] == 1
    client, _ = s4.public(Clock(time.time()))
    page = client.get("/t/api/ticket", headers=hdr(token)).json()
    if page["visit"]["can_arrive"]:  # the same local day: a late press is still recorded as late
        r = client.post("/t/api/arrived", headers=hdr(token), json={"client_request_id": crid()})
        assert r.status_code == 200 and r.json()["late"] is True
        assert notes(s4, "ticket.arrival_missed")[0]["state"] == "resolved", "the arrival resolves the miss"


def test_the_grace_per_department_and_the_department_switch(s4):
    t, _ = s4.sent()
    start = now() - dt.timedelta(minutes=90)
    assert plan(s4, t["id"], start, start + dt.timedelta(minutes=60)).status_code == 200  # ended 30 min ago
    assert visits.tick(s4.db, force=True, now=now()) == 0, "inside the 60-minute grace"
    r = s4.c.put(f"{API}/tickets/admin/departments/dept-maintenance/visits", json={"grace_min": 10, "detect": False})
    assert r.status_code == 200 and r.json()["effective_grace_min"] == 10
    t2, _ = s4.sent()
    assert plan(s4, t2["id"], start, start + dt.timedelta(minutes=60)).status_code == 200
    assert visits_of(s4, t2["id"])[0]["grace_min"] == 10, "a new visit takes the department's grace"
    assert visits.tick(s4.db, force=True, now=now()) == 0, "the department switched the detector off"
    assert s4.c.put(f"{API}/tickets/admin/departments/dept-maintenance/visits", json={"grace_min": None, "detect": True}).status_code == 200
    assert visits.tick(s4.db, force=True, now=now()) == 1, "back on: the 10-minute visit is missed, the 60-minute one not yet"


def test_an_old_window_is_missed_silently_and_a_closed_ticket_cancels(s4):
    t, _ = s4.sent()
    start = now() - dt.timedelta(hours=20)
    assert plan(s4, t["id"], start, start + dt.timedelta(hours=1)).status_code == 200
    later = now() + dt.timedelta(days=10)  # the window is 10 days old for the detector: past backfill_days (7)
    assert visits.tick(s4.db, force=True, now=later) == 1
    assert notes(s4, "ticket.arrival_missed") == [], "no mass notification on a backfill"
    t2, _ = s4.sent()
    assert plan(s4, t2["id"], start, start + dt.timedelta(hours=1)).status_code == 200
    with s4.db.connection() as conn:  # the request ended meanwhile (closed by any route)
        conn.execute("UPDATE tickets SET status = 'closed' WHERE id = ?", (t2["id"],))
    assert visits.tick(s4.db, force=True, now=now()) == 0
    with s4.db.connection(mode="read") as conn:
        assert conn.execute("SELECT state FROM ticket_visits WHERE ticket_id = ?", (t2["id"],)).fetchone()[0] == "cancelled", "silently, no miss"


def test_a_new_visit_after_a_miss_reschedules_it(s4):
    t, _ = s4.sent()
    start = now() - dt.timedelta(hours=3)
    assert plan(s4, t["id"], start, start + dt.timedelta(hours=1)).status_code == 200
    assert visits.tick(s4.db, force=True, now=now()) == 1
    r = plan(s4, t["id"], now() + dt.timedelta(days=1), now() + dt.timedelta(days=1, hours=2))
    assert r.status_code == 200
    old, new = sorted(r.json()["visits"], key=lambda v: v["planned_from"])
    assert old["state"] == "missed" and old["rescheduled_to"] == new["id"] and new["state"] == "planned"
    assert notes(s4, "ticket.arrival_missed")[0]["state"] == "resolved", "the reschedule ends the miss"


def test_the_notification_sources_follow_their_switch(s4):
    from smplwise.services.tickets import notify_sources

    with s4.db.connection(mode="read") as conn:
        assert notify_sources.listed(conn, "ticket.arrival_missed") and notify_sources.listed(conn, "ticket.budget_exceeded")
    settings_put(s4, visits={"enabled": False})
    with s4.db.connection(mode="read") as conn:
        assert not notify_sources.listed(conn, "ticket.arrival_missed") and not notify_sources.listed(conn, "ticket.visit_planned")
        assert notify_sources.listed(conn, "ticket.budget_exceeded") and notify_sources.listed(conn, "ticket.stuck")


def test_a_purge_removes_the_visits(s4):
    from smplwise.services.tickets import store

    t, _ = s4.sent()
    assert plan(s4, t["id"], now() + dt.timedelta(hours=1), now() + dt.timedelta(hours=2)).status_code == 200
    with s4.db.connection() as conn:
        out = store.purge_ticket(conn, t["id"])
        assert out.get("ticket_visits") == 1
        assert conn.execute("SELECT COUNT(*) FROM ticket_visits").fetchone()[0] == 0
