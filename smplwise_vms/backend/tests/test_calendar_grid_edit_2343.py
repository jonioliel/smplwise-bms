"""CAL-GRID-EDIT-2343: the server side of Outlook-style editing on the calendar grid (owner answers 02.11, round 13).

Every move / resize of the grid goes through PATCH /calendar/events/{id}; the server stays the authority: permissions (bookers their own,
editors and managers everything, viewers nothing), the calendar's rules (step, hours, length, past), the overlap policy, maintenance windows
through the maintenance-overlap mode, and the per-calendar `approved_move` (owner answer 3C: default re-approval - the approved slot stays
held, dotted, until the decision and comes back on reject). "בטל" after a delete is POST .../restore, and a cancel / move notice to the
organizer is held back `cancel_notice_delay_s` (default 6 s) so an undo never sends "cancelled" followed by "booked again"."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from fastapi.testclient import TestClient

from conftest import as_user, bind
from smplwise.config import Settings
from smplwise.db import Database
from smplwise.main import create_app
from smplwise.routers import calendar as cal_router
from smplwise.services.calendar import decisions, model, notices

API = "/api/v1"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 5, 9, 0, tzinfo=UTC)  # a Monday


def T(day: int, hh: int, mm: int = 0, month: int = 11) -> str:
    return f"2026-{month:02d}-{day:02d}T{hh:02d}:{mm:02d}:00Z"


@pytest.fixture(scope="module")
def _app(tmp_path_factory):
    st = Settings(data_dir=tmp_path_factory.mktemp("calgrid2343") / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                  bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
                  log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    c = TestClient(create_app(st))
    c.settings_obj = st
    c.get(f"{API}/me")
    return c


@pytest.fixture()
def cc(_app, monkeypatch):
    clock = {"now": NOW}
    monkeypatch.setattr(cal_router, "_now", lambda: clock["now"])
    _app.clock = clock
    with Database(_app.settings_obj.db_path).connection() as c:
        for t in ("cal_notices", "cal_occurrences", "cal_guest_details", "cal_approvals", "cal_event_rooms", "cal_events", "cal_members", "cal_sync_map", "cal_sync_bindings", "cal_calendars"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM bindings WHERE assigned_by = 'test'")
        c.execute("DELETE FROM settings WHERE key LIKE 'calendar.%'")
    r = _app.put(f"{API}/calendar/settings", json={"enabled": True})
    assert r.status_code == 200, r.text
    return _app


def ok(r, code=200):
    assert r.status_code == code, r.text
    return r.json()


def db(c):
    return Database(c.settings_obj.db_path)


def user(c, name, role="operator"):
    bind(c, c.settings_obj, name, role, "installation", "*")
    return as_user(name)


def room(c, name="חדר א", **kw):
    return ok(c.post(f"{API}/calendar/calendars", json={"name": name, "type": "room", "color": "blue", "capacity": 10, "buffer_after_min": 0, **kw}), 201)["calendar"]


def members(c, cal, rows):
    cur = c.get(f"{API}/calendar/calendars/{cal['id']}").json()["calendar"]
    ok(c.put(f"{API}/calendar/calendars/{cal['id']}/members", json={"revision": cur["revision"], "members": rows}))


def book(c, cal, start, end, who=None, **kw):
    return c.post(f"{API}/calendar/events", json={"calendar_id": cal["id"], "title": kw.pop("title", "ישיבה"), "start": start, "end": end, **kw}, headers=who or {})


def get(c, eid, who=None):
    return ok(c.get(f"{API}/calendar/events/{eid}", headers=who or {}))["event"]


def move(c, eid, start, end, who=None, **kw):
    ev = get(c, eid)
    return c.patch(f"{API}/calendar/events/{eid}", json={"revision": ev["revision"], "start": start, "end": end, **kw}, headers=who or {})


def occs(c, cal, who=None, day=3):
    return ok(c.get(f"{API}/calendar/occurrences", params={"from": T(day, 0), "to": T(day + 1, 0), "calendars": cal["id"]}, headers=who or {}))["occurrences"]


def audits(c, action):
    with db(c).connection() as x:
        return [dict(r) for r in x.execute("SELECT * FROM audit_log WHERE action = ? ORDER BY rowid", (action,)).fetchall()]


# ---------------------------------------------------------------- settings and what the grid reads

def test_settings_carry_the_grid_choices_and_validate(cc):
    s = ok(cc.get(f"{API}/calendar/settings"))["settings"]
    assert s["grid_edit"] == "drag" and s["cancel_notice_delay_s"] == 6 and s["undo_window_s"] == 120
    assert ok(cc.get(f"{API}/calendar/module"))["ui"]["grid_edit"] == "drag"
    for bad in ({"grid_edit": "move"}, {"cancel_notice_delay_s": 61}, {"undo_window_s": 5}):
        assert cc.put(f"{API}/calendar/settings", json={"enabled": True, **bad}).status_code == 422
    ok(cc.put(f"{API}/calendar/settings", json={"enabled": True, "grid_edit": "create_only"}))
    assert ok(cc.get(f"{API}/calendar/module"))["ui"]["grid_edit"] == "create_only"


def test_calendar_carries_approved_move_and_open_hours(cc):
    a = room(cc, hours_mode="custom", hours_json={"weekdays": [1, 2, 3, 4, 5], "start": "07:00", "end": "21:00"})
    assert a["approved_move"] == "reapproval" and a["open_hours"] == {"weekdays": [1, 2, 3, 4, 5], "start": "07:00", "end": "21:00"}
    assert cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": a["revision"], "approved_move": "nobody"}).status_code == 422
    b = ok(cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": a["revision"], "approved_move": "managers"}))["calendar"]
    assert b["approved_move"] == "managers"
    assert room(cc, "חדר ב")["open_hours"] is None  # always open


def test_occurrences_say_who_may_drag(cc):
    a = room(cc)
    bo = user(cc, "bina")
    vi = user(cc, "vika")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-bina", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-vika", "cal_role": "view"}])
    mine = ok(book(cc, a, T(3, 10), T(3, 11), bo), 201)["event"]
    other = ok(book(cc, a, T(3, 12), T(3, 13)), 201)["event"]
    by = {o["event_id"]: o for o in occs(cc, a, bo)}
    assert by[mine["id"]]["can_edit"] is True and by[other["id"]]["can_edit"] is False
    assert by[mine["id"]]["revision"] == mine["revision"] and by[mine["id"]]["local_start"]
    assert all(o["can_edit"] for o in occs(cc, a))  # the calendar's manager
    assert not any(o["can_edit"] for o in occs(cc, a, vi))


# ---------------------------------------------------------------- move / resize rules

def test_move_and_resize_respect_permissions_and_rules(cc):
    a = room(cc, slot_step_min=15, max_minutes=120)
    bo = user(cc, "boaz")
    ze = user(cc, "zeev")
    vi = user(cc, "vered")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-boaz", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-zeev", "cal_role": "book"},
                    {"subject_kind": "user", "subject_id": "dev-vered", "cal_role": "view"}])
    ev = ok(book(cc, a, T(3, 10), T(3, 11), bo), 201)["event"]
    r = ok(move(cc, ev["id"], T(3, 12), T(3, 13), bo))
    assert r["event"]["start"] == T(3, 12) and r["event"]["state"] == "confirmed"
    au = audits(cc, "calendar.event.update")[-1]
    det = json.loads(au["details_json"])
    assert det["moved"] is True and det["from"][1] == T(3, 10) and det["to"][1] == T(3, 12)
    assert move(cc, ev["id"], T(3, 14), T(3, 15), ze).status_code == 403  # another booker's entry
    assert move(cc, ev["id"], T(3, 14), T(3, 15), vi).status_code == 403  # a viewer
    assert ok(move(cc, ev["id"], T(3, 14), T(3, 15)))["event"]["start"] == T(3, 14)  # the calendar's manager moves anything
    r = move(cc, ev["id"], T(3, 14, 5), T(3, 15), bo)
    assert r.status_code == 422 and r.json()["code"] == "slot_step"  # the calendar's own step (owner answer 2C)
    r = move(cc, ev["id"], T(3, 14), T(3, 17), bo)
    assert r.status_code == 422 and r.json()["code"] == "duration_out_of_bounds"
    assert ok(move(cc, ev["id"], T(3, 14), T(3, 17)))["event"]["end"] == T(3, 17)  # the manager may exceed the length
    r = move(cc, ev["id"], T(4, 8, month=10), T(4, 9, month=10))
    assert r.status_code == 422 and r.json()["code"] == "past_start"  # never into the past, also for a manager


def test_a_started_entry_keeps_its_start_but_its_end_may_change(cc):
    a = room(cc)
    ev = ok(book(cc, a, T(5, 8, 30, month=10), T(5, 9, 30, month=10)), 201)["event"]  # running at NOW (the manager may book it)
    assert ok(move(cc, ev["id"], T(5, 8, 30, month=10), T(5, 10, month=10)))["event"]["end"] == T(5, 10, month=10)
    r = move(cc, ev["id"], T(5, 9, 30, month=10), T(5, 10, 30, month=10))
    assert r.status_code == 422 and r.json()["code"] == "started_immutable"


def test_outside_hours_is_refused_for_a_booker(cc):
    a = room(cc, hours_mode="custom", hours_json={"weekdays": [1, 2, 3, 4, 5, 6, 7], "start": "07:00", "end": "21:00"})
    bo = user(cc, "bella")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-bella", "cal_role": "book"}])
    ev = ok(book(cc, a, T(3, 8), T(3, 9), bo), 201)["event"]  # 10:00-11:00 local
    r = move(cc, ev["id"], T(3, 18, 30), T(3, 19, 30), bo)  # 20:30-21:30 local
    assert r.status_code == 422 and r.json()["code"] == "outside_hours"


def test_move_to_another_room_needs_booking_there(cc):
    a, b, c = room(cc), room(cc, "חדר ב"), room(cc, "חדר ג")
    bo = user(cc, "bat")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-bat", "cal_role": "book"}])
    members(cc, b, [{"subject_kind": "user", "subject_id": "dev-bat", "cal_role": "book"}])
    members(cc, c, [{"subject_kind": "user", "subject_id": "dev-bat", "cal_role": "view"}])
    ev = ok(book(cc, a, T(3, 10), T(3, 11), bo), 201)["event"]
    r = ok(move(cc, ev["id"], T(3, 10), T(3, 11), bo, calendar_id=b["id"]))
    assert r["event"]["calendar_id"] == b["id"]
    assert [o["event_id"] for o in occs(cc, b)] == [ev["id"]] and occs(cc, a) == []
    assert move(cc, ev["id"], T(3, 10), T(3, 11), bo, calendar_id=c["id"]).status_code == 403  # view only there
    # a confirmed booking in the target holds the time: the move is a contested request (queue), as a new booking would be
    ok(book(cc, a, T(3, 12), T(3, 13)), 201)
    r = ok(move(cc, ev["id"], T(3, 12), T(3, 13), bo, calendar_id=a["id"]))
    assert r["event"]["state"] == "pending" and r["event"]["contested"] is True and r["event"]["held"]["calendar_id"] == b["id"]


# ---------------------------------------------------------------- an approved booking in an approval room (owner answer 3C)

def _approval_room(cc, **kw):
    a = room(cc, approval_mode="always", **kw)
    bo = user(cc, "bracha")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-bracha", "cal_role": "book"}])
    ev = ok(book(cc, a, T(3, 10), T(3, 11), bo), 201)["event"]
    ok(cc.post(f"{API}/calendar/requests/{ev['id']}/decide", json={"decision": "approve", "revision": ev["revision"]}))
    return a, bo, get(cc, ev["id"])


def test_moving_an_approved_booking_holds_the_old_slot_until_the_decision(cc):
    a, bo, ev = _approval_room(cc)
    assert ev["state"] == "confirmed"
    r = ok(move(cc, ev["id"], T(3, 14), T(3, 15), bo))["event"]
    assert r["state"] == "pending" and r["held"] == {"calendar_id": a["id"], "start": T(3, 10), "end": T(3, 11)}
    day = occs(cc, a)
    held = [o for o in day if o.get("held_slot")]
    assert len(held) == 1 and held[0]["start"] == T(3, 10) and held[0]["state"] == "confirmed" and held[0]["can_edit"] is False
    # the held slot still holds: someone else asking for it is a contested request, not a free booking
    other = user(cc, "ofer")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-bracha", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-ofer", "cal_role": "book"}])
    asked = ok(book(cc, a, T(3, 10), T(3, 11), other), 201)
    assert asked["event"]["contested"] is True
    req = [x for x in ok(cc.get(f"{API}/calendar/requests"))["requests"] if x["event_id"] == ev["id"]][0]
    assert req["change_of"] == {"calendar_id": a["id"], "start": T(3, 10), "end": T(3, 11)} and req["conflicts_now"] == 0
    # reject: the booking returns to the approved slot
    cur = get(cc, ev["id"])
    r = ok(cc.post(f"{API}/calendar/requests/{ev['id']}/decide", json={"decision": "reject", "revision": cur["revision"]}))
    assert r["state"] == "confirmed" and r["change_rejected"] is True
    back = get(cc, ev["id"])
    assert (back["start"], back["end"], back["state"], back["held"]) == (T(3, 10), T(3, 11), "confirmed", None)
    assert not any(o.get("held_slot") for o in occs(cc, a))


def test_an_approved_change_releases_the_old_slot(cc):
    a, bo, ev = _approval_room(cc)
    ok(move(cc, ev["id"], T(3, 14), T(3, 15), bo))
    cur = get(cc, ev["id"])
    ok(cc.post(f"{API}/calendar/requests/{ev['id']}/decide", json={"decision": "approve", "revision": cur["revision"]}))
    done = get(cc, ev["id"])
    assert (done["start"], done["state"], done["held"]) == (T(3, 14), "confirmed", None)
    assert ok(book(cc, a, T(3, 10), T(3, 11)), 201)["state"] == "confirmed"  # the old time is free again


def test_undo_of_a_move_and_withdraw_of_a_change_restore_the_approved_slot(cc):
    a, bo, ev = _approval_room(cc)
    ok(move(cc, ev["id"], T(3, 14), T(3, 15), bo))
    r = ok(move(cc, ev["id"], T(3, 10), T(3, 11), bo))  # the grid's "בטל": back onto the held slot
    assert r["change_withdrawn"] is True and r["event"]["state"] == "confirmed" and r["event"]["held"] is None
    ok(move(cc, ev["id"], T(3, 16), T(3, 17), bo))
    cur = get(cc, ev["id"], bo)
    r = ok(cc.post(f"{API}/calendar/events/{ev['id']}/withdraw", json={"revision": cur["revision"]}, headers=bo))
    assert r["change_withdrawn"] is True and (r["event"]["start"], r["event"]["state"]) == (T(3, 10), "confirmed")


def test_a_change_that_expires_returns_to_the_approved_slot(cc):
    a, bo, ev = _approval_room(cc, approval_timeout_h=2)
    ok(move(cc, ev["id"], T(3, 8), T(3, 9), bo))  # the decision is due 2 h before 08:00; the approved 10:00 has not passed yet
    with db(cc).connection() as c:
        decisions.expire_and_finish(c, model.read_settings(c), dt.datetime(2026, 11, 3, 6, 30, tzinfo=UTC))
    back = get(cc, ev["id"])
    assert (back["start"], back["state"], back["held"]) == (T(3, 10), "confirmed", None)


def test_approved_move_managers_refuses_a_booker_but_not_the_manager(cc):
    a, bo, ev = _approval_room(cc, approved_move="managers")
    r = move(cc, ev["id"], T(3, 14), T(3, 15), bo)
    assert r.status_code == 409 and r.json()["code"] == "change_needs_manager"
    assert get(cc, ev["id"])["start"] == T(3, 10)  # nothing was written
    r = ok(move(cc, ev["id"], T(3, 14), T(3, 15)))  # the manager bypasses the approval
    assert r["event"]["state"] == "confirmed" and r["event"]["held"] is None


# ---------------------------------------------------------------- delete + undo, the delayed notice

def test_cancel_by_someone_else_holds_the_notice_back_and_restore_withdraws_it(cc):
    a = room(cc)
    bo = user(cc, "bilha")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-bilha", "cal_role": "book"}])
    ev = ok(book(cc, a, T(3, 10), T(3, 11), bo), 201)["event"]
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": get(cc, ev["id"])["revision"]}))  # the manager deletes it
    with db(cc).connection() as c:
        rows = notices.pending_for(c, ev["id"])
        assert len(rows) == 1 and rows[0]["kind"] == "calendar.booking.cancelled" and rows[0]["recipient_user_id"] == "dev-bilha"
        assert rows[0]["due_at"] == model.iso(NOW + dt.timedelta(seconds=6))
        assert notices.deliver_due(c, NOW + dt.timedelta(seconds=3)) == 0  # still inside the undo window
    cur = get(cc, ev["id"])
    assert cur["state"] == "cancelled" and cur["can"]["restore"] is True
    r = ok(cc.post(f"{API}/calendar/events/{ev['id']}/restore", json={"revision": cur["revision"]}))  # "בטל"
    assert r["state"] == "confirmed"
    with db(cc).connection() as c:
        assert notices.pending_for(c, ev["id"]) == []
        assert notices.deliver_due(c, NOW + dt.timedelta(seconds=30)) == 0  # never "cancelled" then "booked again"
    assert audits(cc, "calendar.event.restore")
    # without an undo the notice goes out after the delay
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": get(cc, ev["id"])["revision"]}))
    with db(cc).connection() as c:
        assert notices.deliver_due(c, NOW + dt.timedelta(seconds=7)) == 1
        assert c.execute("SELECT COUNT(*) FROM cal_notices WHERE event_id = ? AND sent_at IS NOT NULL", (ev["id"],)).fetchone()[0] == 1
    assert audits(cc, "calendar.notice.sent")


def test_the_organizer_cancelling_his_own_entry_is_not_told(cc):
    a = room(cc)
    bo = user(cc, "benny")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-benny", "cal_role": "book"}])
    ev = ok(book(cc, a, T(3, 10), T(3, 11), bo), 201)["event"]
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": ev["revision"]}, headers=bo))
    with db(cc).connection() as c:
        assert notices.pending_for(c, ev["id"]) == []


def test_a_move_by_the_manager_is_told_late_and_undo_withdraws_it(cc):
    a = room(cc)
    bo = user(cc, "batel")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-batel", "cal_role": "book"}])
    ev = ok(book(cc, a, T(3, 10), T(3, 11), bo), 201)["event"]
    ok(move(cc, ev["id"], T(3, 12), T(3, 13)))
    with db(cc).connection() as c:
        assert [r["kind"] for r in notices.pending_for(c, ev["id"])] == ["calendar.booking.changed"]
    ok(move(cc, ev["id"], T(3, 10), T(3, 11)))  # undo = a move back: one notice, the latest, supersedes the first
    with db(cc).connection() as c:
        assert len(notices.pending_for(c, ev["id"])) == 1


def test_restore_refuses_a_taken_slot_and_a_closed_window(cc):
    a = room(cc)
    ev = ok(book(cc, a, T(3, 10), T(3, 11)), 201)["event"]
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": ev["revision"]}))
    ok(book(cc, a, T(3, 10), T(3, 11), title="אחר"), 201)
    r = cc.post(f"{API}/calendar/events/{ev['id']}/restore", json={"revision": get(cc, ev["id"])["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "conflict"
    e2 = ok(book(cc, a, T(4, 10), T(4, 11)), 201)["event"]
    ok(cc.post(f"{API}/calendar/events/{e2['id']}/cancel", json={"revision": e2["revision"]}))
    cc.clock["now"] = NOW + dt.timedelta(seconds=121)
    r = cc.post(f"{API}/calendar/events/{e2['id']}/restore", json={"revision": get(cc, e2["id"])["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "undo_expired"


# ---------------------------------------------------------------- maintenance windows through the maintenance-overlap mode

def _maint(cc, a):
    m = ok(cc.post(f"{API}/calendar/calendars", json={"name": "אחזקה", "type": "maintenance", "color": "orange"}), 201)["calendar"]
    ok(cc.post(f"{API}/calendar/maintenance", json={"calendar_id": m["id"], "title": "צביעה", "rooms": [a["id"]], "start": T(3, 13), "end": T(3, 14)}), 201)


def test_a_booking_onto_a_maintenance_window_follows_the_overlap_mode(cc):
    a = room(cc)
    _maint(cc, a)
    ev = ok(book(cc, a, T(3, 10), T(3, 11)), 201)["event"]
    r = ok(move(cc, ev["id"], T(3, 13), T(3, 14)))  # first_holds (default): the window holds, the move waits for the manager
    assert r["event"]["state"] == "pending" and r["event"]["contested"] is True
    ok(cc.put(f"{API}/calendar/settings", json={"enabled": True, "maintenance_overlap": "override_notify"}))
    e2 = ok(book(cc, a, T(3, 16), T(3, 17)), 201)["event"]
    r = move(cc, e2["id"], T(3, 13, 30), T(3, 14, 30))
    assert r.status_code == 409 and r.json()["code"] == "maintenance_window"
    assert book(cc, a, T(3, 13), T(3, 13, 30)).status_code == 409  # the same rule for a new booking
