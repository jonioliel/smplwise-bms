"""CALENDARS-298 phase 1: calendars, members, bookings, conflicts, approvals, maintenance windows, guest details and retention, permissions and
the occurrence cache, through the real API on a temporary database. Owner answers of 2026-10-29 (contract section 1A) are pinned here:
the first confirmed entry holds a slot, a later request waits for the manager, maintenance does not automatically win, retention and the
purge are the owner's, the module is off by default."""
from __future__ import annotations

import datetime as dt
import json
import threading

import pytest
from fastapi.testclient import TestClient

from conftest import as_user, bind
from smplwise.config import Settings
from smplwise.main import create_app
from smplwise.db import Database
from smplwise.routers import calendar as cal_router
from smplwise.services.calendar import jobs, model, occ

API = "/api/v1"
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 5, 9, 0, tzinfo=UTC)  # a Monday, Israel summer time still on


def T(day: int, hh: int, mm: int = 0, month: int = 11) -> str:
    return f"2026-{month:02d}-{day:02d}T{hh:02d}:{mm:02d}:00Z"  # 2026-11-03 is a Tuesday


@pytest.fixture(scope="module")
def _app(tmp_path_factory):
    """ONE app for the module (an app start costs tens of seconds on a loaded workstation); `cc` wipes the calendar state between tests."""
    st = Settings(data_dir=tmp_path_factory.mktemp("cal2300") / "data", www_dir=None, in_addon=False, trusted_proxies=("172.30.32.2",), dev_user="joni",
                  bootstrap_admin_username="joni", nvr_host="nvr-placeholder.test", nvr_http_port=80, nvr_user=None, nvr_password=None, go2rtc_url=None,
                  log_level="warning", max_upload_bytes=5 * 1024 * 1024, max_pdf_pages=5, max_render_px=800, preview_px=300)
    c = TestClient(create_app(st))
    c.settings_obj = st
    c.get(f"{API}/me")  # the bootstrap administrator exists from here on
    return c


@pytest.fixture()
def cc(_app, monkeypatch):
    monkeypatch.setattr(cal_router, "_now", lambda: NOW)
    with Database(_app.settings_obj.db_path).connection() as c:
        for t in ("cal_occurrences", "cal_guest_details", "cal_approvals", "cal_event_rooms", "cal_events", "cal_members", "cal_sync_map", "cal_sync_bindings", "cal_calendars"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM bindings WHERE assigned_by = 'test'")
        c.execute("DELETE FROM settings WHERE key LIKE 'calendar.%'")
    return _app


def enable(c, **over):
    doc = {"enabled": True, **over}
    r = c.put(f"{API}/calendar/settings", json=doc)
    assert r.status_code == 200, r.text
    return r.json()


def user(c, name, role="operator"):
    bind(c, c.settings_obj, name, role, "installation", "*")
    return as_user(name)


def room(c, name="חדר א", **kw):
    body = {"name": name, "type": "room", "color": "blue", "capacity": 10, "buffer_after_min": 0, **kw}
    r = c.post(f"{API}/calendar/calendars", json=body)
    assert r.status_code == 201, r.text
    return r.json()["calendar"]


def members(c, cal, rows):
    cal = c.get(f"{API}/calendar/calendars/{cal['id']}").json()["calendar"]
    r = c.put(f"{API}/calendar/calendars/{cal['id']}/members", json={"revision": cal["revision"], "members": rows})
    assert r.status_code == 200, r.text


def book(c, cal, start, end, who=None, **kw):
    body = {"calendar_id": cal["id"], "title": kw.pop("title", "ישיבה"), "start": start, "end": end, **kw}
    return c.post(f"{API}/calendar/events", json=body, headers=who or {})


def ok(r, code=200):
    assert r.status_code == code, r.text
    return r.json()


def db(c):
    return Database(c.settings_obj.db_path)


# ---------------------------------------------------------------- module switch, settings, migration

def test_module_is_off_by_default_and_gated(cc):
    assert ok(cc.get(f"{API}/calendar/module"))["enabled"] is False
    r = cc.get(f"{API}/calendar/calendars")
    assert r.status_code == 404 and r.json()["code"] == "feature_disabled"
    assert cc.post(f"{API}/calendar/events", json={}).status_code == 404
    assert cc.get(f"{API}/calendar/settings").status_code == 200  # the settings answer while it is off


def test_settings_defaults_validation_and_fail_closed(cc):
    s = ok(cc.get(f"{API}/calendar/settings"))["settings"]
    assert s["enabled"] is False and s["maintenance_overlap"] == "first_holds" and s["pending_holds_slot"] is False
    assert s["menu_position"] == "a" and s["holiday_eve_as_holiday"] is False and s["guest_retention_days"] == 30
    for bad in ({"menu_position": "c"}, {"guest_retention_days": 4000}, {"maintenance_overlap": "x"}, {"nope": 1}, {"enabled": "yes"}):
        assert cc.put(f"{API}/calendar/settings", json=bad).status_code == 422
    enable(cc, menu_position="b", guest_retention_days=0)
    assert ok(cc.get(f"{API}/calendar/module"))["menu_position"] == "b"
    with db(cc).connection() as c:  # a corrupt document reads as defaults with the module OFF
        c.execute("UPDATE settings SET value = '{broken' WHERE key = ?", (model.SETTINGS_KEY,))
    assert ok(cc.get(f"{API}/calendar/module"))["enabled"] is False


def test_migration_0183_creates_the_tables(cc):
    with db(cc).connection() as c:
        names = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cal_%'")}
        assert {"cal_calendars", "cal_events", "cal_event_rooms", "cal_members", "cal_approvals", "cal_guest_details", "cal_occurrences", "cal_connections", "cal_sync_bindings",
                "cal_sync_map", "cal_feeds"} <= names
        assert c.execute("SELECT 1 FROM schema_migrations WHERE version = 183").fetchone()


# ---------------------------------------------------------------- calendars and members

def test_calendar_crud_validation_and_visibility(cc):
    enable(cc)
    r = cc.post(f"{API}/calendar/calendars", json={"name": "x", "type": "room", "color": "green"})
    assert r.status_code == 422 and r.json()["details"]["field"] == "color"  # green is status only
    a = room(cc, "חדר ישיבות")
    assert a["my_role"] == "manage" and a["buffer_after_min"] == 0 and a["conflict_policy"] == "exclusive"
    assert cc.post(f"{API}/calendar/calendars", json={"name": " חדר   ישיבות ", "type": "room", "color": "rose"}).status_code == 409  # unique, case/space folded
    r = cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": a["revision"], "capacity": 12, "overlap_override": "override_notify"})
    assert ok(r)["calendar"]["capacity"] == 12 and r.json()["calendar"]["overlap_override"] == "override_notify"
    assert cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": a["revision"], "capacity": 3}).status_code == 409  # stale
    assert cc.post(f"{API}/calendar/calendars", json={"name": "צוות", "type": "team", "color": "violet", "capacity": 3}).status_code == 422  # capacity is for rooms
    # a viewer who is not a member does not see a members-only calendar, and its id answers the uniform 404
    v = user(cc, "vera", "viewer")
    assert ok(cc.get(f"{API}/calendar/calendars", headers=v))["calendars"] == []
    assert cc.get(f"{API}/calendar/calendars/{a['id']}", headers=v).status_code == 404
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-vera", "cal_role": "view"}])
    assert [c["id"] for c in ok(cc.get(f"{API}/calendar/calendars", headers=v))["calendars"]] == [a["id"]]
    assert ok(cc.get(f"{API}/calendar/calendars/{a['id']}", headers=v))["calendar"]["my_role"] == "view"
    # archive: refused with future entries unless cancel_future
    ev = ok(book(cc, a, T(3, 10), T(3, 11)), 201)["event"]
    cur = ok(cc.get(f"{API}/calendar/calendars/{a['id']}"))["calendar"]
    assert cc.post(f"{API}/calendar/calendars/{a['id']}/archive", json={"revision": cur["revision"]}).status_code == 409
    r = ok(cc.post(f"{API}/calendar/calendars/{a['id']}/archive", json={"revision": cur["revision"], "cancel_future": True}))
    assert r["cancelled"] == 1
    with db(cc).connection() as c:
        assert c.execute("SELECT state FROM cal_events WHERE id = ?", (ev["id"],)).fetchone()[0] == "cancelled"
    assert ok(cc.get(f"{API}/calendar/calendars"))["calendars"] == []


def test_owner_stays_a_manager_and_roles_need_permissions(cc):
    enable(cc)
    a = room(cc)
    ann = user(cc, "ann", "viewer")  # a book member WITHOUT the installation permission calendar.book is capped at view
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-ann", "cal_role": "book"}])
    assert ok(cc.get(f"{API}/calendar/calendars/{a['id']}", headers=ann))["calendar"]["my_role"] == "view"
    r = book(cc, a, T(3, 10), T(3, 11), ann)
    assert r.status_code == 403
    with db(cc).connection() as c:
        assert c.execute("SELECT 1 FROM audit_log WHERE action = 'calendar.book' AND decision = 'denied'").fetchone() or c.execute("SELECT 1 FROM audit_log WHERE decision = 'denied' AND resource_type = 'calendar'").fetchone()
    cur = ok(cc.get(f"{API}/calendar/calendars/{a['id']}"))["calendar"]
    ok(cc.put(f"{API}/calendar/calendars/{a['id']}/members", json={"revision": cur["revision"], "members": []}))
    rows = ok(cc.get(f"{API}/calendar/calendars/{a['id']}/members"))["members"]
    assert [(m["subject_id"], m["cal_role"]) for m in rows] == [("dev-joni", "manage")]


def test_non_manager_cannot_create_or_edit_calendars(cc):
    enable(cc)
    op = user(cc, "oren", "operator")
    assert cc.post(f"{API}/calendar/calendars", json={"name": "ח", "type": "room", "color": "blue"}, headers=op).status_code == 403
    a = room(cc)
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-oren", "cal_role": "edit"}])
    cur = ok(cc.get(f"{API}/calendar/calendars/{a['id']}"))["calendar"]
    assert cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": cur["revision"], "capacity": 2}, headers=op).status_code == 403  # edit is not manage


# ---------------------------------------------------------------- bookings, conflicts, buffers, the first-holds rule

def test_booking_and_touching_slots_are_not_conflicts(cc):
    enable(cc)
    a = room(cc)
    ok(book(cc, a, T(3, 10), T(3, 11)), 201)
    r = ok(book(cc, a, T(3, 11), T(3, 12)), 201)  # touching, no buffer
    assert r["state"] == "confirmed"
    assert ok(book(cc, a, T(3, 12), T(3, 13), title="אחר"), 201)["state"] == "confirmed"


def test_buffers_apply_on_both_sides(cc):
    enable(cc)
    a = room(cc, buffer_before_min=10, buffer_after_min=10)
    ok(book(cc, a, T(3, 10), T(3, 11)), 201)
    r = ok(book(cc, a, T(3, 11), T(3, 12)), 201)  # starts inside the 20 minutes the first one needs around it
    assert r["state"] == "pending" and r["event"]["contested"] is True
    assert ok(book(cc, a, T(3, 11, 30), T(3, 12, 30)), 201)["state"] == "confirmed"


def test_later_overlapping_request_waits_for_the_manager_and_the_first_one_keeps_the_slot(cc):
    enable(cc)
    a = room(cc)
    ann, bob = user(cc, "ann"), user(cc, "bob")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-ann", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-bob", "cal_role": "book"}])
    first = ok(book(cc, a, T(3, 10), T(3, 11), ann, title="ראשון"), 201)
    second = ok(book(cc, a, T(3, 10, 30), T(3, 11, 30), bob, title="שני"), 201)
    assert first["state"] == "confirmed" and second["state"] == "pending" and second["event"]["contested"] is True
    # the pending one holds nothing: a third request for a free neighbouring window is confirmed
    assert ok(book(cc, a, T(3, 12), T(3, 13), bob), 201)["state"] == "confirmed"
    # a fourth overlapping the pending one only is also queued only because of the first
    third = ok(book(cc, a, T(3, 10, 45), T(3, 11, 15), bob, title="שלישי"), 201)
    reqs = ok(cc.get(f"{API}/calendar/requests"))["requests"]
    assert {r["title"] for r in reqs} == {"שני", "שלישי"}
    assert all(r["competing_count"] == 2 and r["conflicts_now"] == 1 for r in reqs)  # how many requesters per window, how many entries hold it
    assert third["state"] == "pending"
    # approving over the holder needs an explicit decision
    sec = second["event"]
    r = cc.post(f"{API}/calendar/requests/{sec['id']}/decide", json={"decision": "approve", "revision": sec["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "slot_held"
    r = ok(cc.post(f"{API}/calendar/requests/{sec['id']}/decide", json={"decision": "approve", "displace_existing": True, "revision": sec["revision"]}))
    assert r["state"] == "confirmed"
    assert ok(cc.get(f"{API}/calendar/events/{first['event']['id']}"))["event"]["state"] == "displaced"  # kept, never deleted
    # a displaced entry no longer holds anything: its old window is free again up to the approved one
    assert ok(book(cc, a, T(3, 10), T(3, 10, 30), ann), 201)["state"] == "confirmed"
    assert ok(book(cc, a, T(3, 10, 45), T(3, 11, 0), ann), 201)["state"] == "pending"  # inside the approved second entry


def test_contested_requests_reject_mode_answers_409_with_suggestions(cc):
    enable(cc, contested_requests="reject")
    a = room(cc)
    ok(book(cc, a, T(3, 10), T(3, 11)), 201)
    r = book(cc, a, T(3, 10, 30), T(3, 11, 30))
    assert r.status_code == 409 and r.json()["code"] == "conflict"
    d = r.json()["details"]
    assert len(d["conflicts"]) == 1 and d["suggestions"][0]["start"] == T(3, 11)


def test_pending_holds_slot_setting_restores_the_old_behaviour(cc):
    enable(cc, pending_holds_slot=True)
    a = room(cc, approval_mode="always")
    op = user(cc, "oz")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-oz", "cal_role": "book"}])
    p1 = ok(book(cc, a, T(3, 10), T(3, 11), op), 201)
    assert p1["state"] == "pending"
    p2 = ok(book(cc, a, T(3, 10, 30), T(3, 11, 30), op), 201)
    assert p2["event"]["contested"] is True  # the pending one now blocks


def test_rules_hours_duration_step_capacity_lead_horizon(cc):
    enable(cc)
    a = room(cc, hours_mode="custom", hours_json={"weekdays": [1, 2, 3, 4, 7], "start": "08:00", "end": "18:00"}, min_minutes=30, max_minutes=120, lead_min=60,
             horizon_days=30, slot_step_min=15)
    op = user(cc, "ofer")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-ofer", "cal_role": "book"}])
    # 2026-11-03 is a Tuesday; local = UTC+2 -> 08:00Z = 10:00 local
    assert book(cc, a, T(3, 4), T(3, 5), op).status_code == 422  # 06:00 local: outside hours
    assert book(cc, a, T(3, 8), T(3, 8, 20), op).status_code == 422  # too short
    assert book(cc, a, T(3, 8), T(3, 11), op).status_code == 422  # too long
    r = book(cc, a, T(3, 8, 5), T(3, 9), op)
    assert r.status_code == 422 and r.json()["code"] == "slot_step"
    assert book(cc, a, T(3, 8), T(3, 9), op, headcount=11).json()["code"] == "capacity_exceeded"
    assert book(cc, a, T(12, 8, month=12), T(12, 9, month=12), op).json()["code"] == "outside_booking_window"  # beyond 30 days
    assert book(cc, a, "2026-10-05T09:30:00Z", "2026-10-05T10:30:00Z", op).json()["code"] == "outside_booking_window"  # inside the 60 minutes of notice
    assert ok(book(cc, a, T(3, 8), T(3, 9), op), 201)["state"] == "confirmed"
    # an editor / manager is not bound by duration, notice or hours
    assert ok(book(cc, a, T(3, 3), T(3, 6)), 201)["state"] == "confirmed"


def test_holiday_rule_closed_and_warn(cc):
    enable(cc)
    closed = room(cc, "סגור בחג", holiday_rule="closed", horizon_days=730)
    warn = room(cc, "אזהרה", holiday_rule="warn", color="rose", horizon_days=730)
    op = user(cc, "ora")
    members(cc, closed, [{"subject_kind": "user", "subject_id": "dev-ora", "cal_role": "book"}])
    members(cc, warn, [{"subject_kind": "user", "subject_id": "dev-ora", "cal_role": "book"}])
    # Rosh Hashana 5787 starts on the evening of 2026-09-11 -> 2026-09-12 is a holiday; use a holiday inside the booking window (Sukkot, 2026-09-26..)
    now_holiday = "2026-10-12"  # Simchat Torah 5787 (22 Tishrei) falls on 2026-10-03/04 - check against the generated calendar instead of hard-coding
    from smplwise.services import special_days
    days = [d for d, k in special_days.day_types("israel", dt.date(2026, 10, 6), dt.date(2027, 4, 30)).items() if k == "holiday"]
    assert days, "the generated calendar has holidays"
    h = dt.date.fromisoformat(days[0])
    s, e = f"{h.isoformat()}T08:00:00Z", f"{h.isoformat()}T09:00:00Z"
    r = book(cc, closed, s, e, op)
    assert r.status_code == 422 and r.json()["code"] == "holiday_closed"
    r = ok(book(cc, warn, s, e, op), 201)
    assert r["warnings"]["holiday_hits"] == [h.isoformat()]
    del now_holiday


def test_holiday_eve_is_a_regular_day_unless_the_setting_says_otherwise(cc):
    from smplwise.services import special_days
    eves = [d for d, k in special_days.day_types("israel", dt.date(2026, 10, 6), dt.date(2027, 4, 30)).items() if k == "holiday_eve"]
    assert eves
    with db(cc).connection() as c:
        regular = occ.holidays_between(c, model.parse_settings(None), dt.date.fromisoformat(eves[0]), dt.date.fromisoformat(eves[0]))
        eve_as_holiday = occ.holidays_between(c, {**model.parse_settings(None), "holiday_eve_as_holiday": True}, dt.date.fromisoformat(eves[0]), dt.date.fromisoformat(eves[0]))
    assert regular == set() and eve_as_holiday == {dt.date.fromisoformat(eves[0])}


# ---------------------------------------------------------------- approvals

def test_approval_flow_states_and_log(cc):
    enable(cc)
    a = room(cc, approval_mode="always")
    op = user(cc, "ofra")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-ofra", "cal_role": "book"}])
    p = ok(book(cc, a, T(3, 10), T(3, 11), op), 201)
    ev = p["event"]
    assert p["state"] == "pending"
    assert ok(cc.get(f"{API}/me/calendar", headers=op))["pending"][0]["event_id"] == ev["id"]
    assert cc.post(f"{API}/calendar/requests/{ev['id']}/decide", json={"decision": "approve", "revision": ev["revision"]}, headers=op).status_code == 403  # not a manager
    r = ok(cc.post(f"{API}/calendar/requests/{ev['id']}/decide", json={"decision": "approve", "revision": ev["revision"]}))
    assert r["state"] == "confirmed"
    assert cc.post(f"{API}/calendar/requests/{ev['id']}/decide", json={"decision": "approve", "revision": r["event"]["revision"]}).status_code == 409  # already decided
    # reject + reopen
    q = ok(book(cc, a, T(4, 10), T(4, 11), op), 201)["event"]
    ok(cc.post(f"{API}/calendar/requests/{q['id']}/decide", json={"decision": "reject", "note": "תפוס", "revision": q["revision"]}))
    cur = ok(cc.get(f"{API}/calendar/events/{q['id']}"))
    assert cur["event"]["state"] == "rejected" and [h["action"] for h in cur["history"]] == ["request", "reject"]
    ok(cc.post(f"{API}/calendar/requests/{q['id']}/reopen", json={"revision": cur["event"]["revision"]}))
    assert ok(cc.get(f"{API}/calendar/events/{q['id']}"))["event"]["state"] == "pending"
    # withdraw is the organizer's
    ev2 = ok(cc.get(f"{API}/calendar/events/{q['id']}"))["event"]
    assert cc.post(f"{API}/calendar/events/{q['id']}/withdraw", json={"revision": ev2["revision"]}).status_code == 403  # the admin is not the organizer
    ok(cc.post(f"{API}/calendar/events/{q['id']}/withdraw", json={"revision": ev2["revision"]}, headers=op))


def test_editor_bypasses_approval_and_it_is_a_setting(cc):
    enable(cc)
    a = room(cc, approval_mode="always")
    ed = user(cc, "edna")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-edna", "cal_role": "edit"}])
    assert ok(book(cc, a, T(3, 10), T(3, 11), ed), 201)["state"] == "confirmed"
    enable(cc, editors_bypass_approval=False)
    assert ok(book(cc, a, T(3, 12), T(3, 13), ed), 201)["state"] == "pending"


def test_on_behalf_approval_mode_and_permission(cc):
    enable(cc)
    a = room(cc, approval_mode="on_behalf")
    op = user(cc, "omer")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-omer", "cal_role": "book"}])
    assert book(cc, a, T(3, 10), T(3, 11), op, on_behalf={"kind": "team", "label": "צוות"}).status_code == 403  # needs calendar.book_for_others
    sa = user(cc, "sara", "site_admin")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-omer", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-sara", "cal_role": "book"}])
    r = ok(book(cc, a, T(3, 10), T(3, 11), sa, on_behalf={"kind": "class", "label": "חוג קרמיקה"}), 201)
    assert r["state"] == "confirmed"  # a site manager holds edit and bypasses
    assert r["event"]["on_behalf_label"] == "חוג קרמיקה"


def test_team_calendar_asks_a_room_and_the_rooms_manager_decides(cc):
    enable(cc)
    gym = room(cc, "מכון")
    team = ok(cc.post(f"{API}/calendar/calendars", json={"name": "צוות חוגים", "type": "team", "color": "cyan"}), 201)["calendar"]
    tm = user(cc, "tami")
    members(cc, team, [{"subject_kind": "user", "subject_id": "dev-tami", "cal_role": "book"}])
    members(cc, gym, [{"subject_kind": "user", "subject_id": "dev-tami", "cal_role": "view"}])
    r = ok(book(cc, team, T(3, 10), T(3, 11), tm, rooms=[gym["id"]]), 201)
    assert r["state"] == "confirmed" and r["requests"] == [{"room_calendar_id": gym["id"], "state": "pending", "contested": False}]
    ev = r["event"]
    reqs = ok(cc.get(f"{API}/calendar/requests"))["requests"]
    assert reqs[0]["room_calendar_id"] == gym["id"]
    ok(cc.post(f"{API}/calendar/requests/{ev['id']}/decide", json={"decision": "approve", "room_calendar_id": gym["id"], "revision": ev["revision"]}))
    occs = ok(cc.get(f"{API}/calendar/occurrences", params={"from": T(1, 0), "to": T(8, 0), "calendars": gym["id"]}))["occurrences"]
    assert len(occs) == 1 and occs[0]["state"] == "confirmed"


# ---------------------------------------------------------------- maintenance windows (owner: maintenance does NOT automatically win)

def _maint_setup(cc, **settings):
    enable(cc, **settings)
    a = room(cc)
    m = ok(cc.post(f"{API}/calendar/calendars", json={"name": "אחזקה", "type": "maintenance", "color": "orange"}), 201)["calendar"]
    ev = ok(book(cc, a, T(3, 10), T(3, 11), title="הזמנה קיימת"), 201)["event"]
    return a, m, ev


def maint(cc, m, a, **kw):
    return cc.post(f"{API}/calendar/maintenance", json={"calendar_id": m["id"], "title": "צביעה", "rooms": [a["id"]], "start": T(3, 10, 30), "end": T(3, 11, 30), **kw})


def test_maintenance_default_does_not_win_it_waits_for_the_manager(cc):
    a, m, ev = _maint_setup(cc)
    pre = ok(cc.post(f"{API}/calendar/maintenance/preview", json={"calendar_id": m["id"], "rooms": [a["id"]], "start": T(3, 10, 30), "end": T(3, 11, 30)}))
    assert pre["mode"] == "first_holds" and [o["event_id"] for o in pre["overlaps"]] == [ev["id"]]
    r = ok(maint(cc, m, a), 201)
    assert r["event"]["state"] == "pending" and r["displaced"] == []
    assert ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]["state"] == "confirmed"  # the earlier entry keeps its slot
    reqs = ok(cc.get(f"{API}/calendar/requests"))["requests"]
    assert [x["kind"] for x in reqs] == ["maintenance"] and reqs[0]["conflicts_now"] == 1


def test_maintenance_modes_block_ask_and_override(cc):
    a, m, ev = _maint_setup(cc, maintenance_overlap="block")
    r = maint(cc, m, a)
    assert r.status_code == 409 and r.json()["code"] == "maintenance_overlap" and r.json()["details"]["alternatives"]
    enable(cc, maintenance_overlap="ask")
    r = maint(cc, m, a)
    assert r.status_code == 422 and r.json()["code"] == "overlap_decision_required"
    assert maint(cc, m, a, overlap_decision="block").status_code == 409
    r = ok(maint(cc, m, a, overlap_decision="override_notify"), 201)
    assert r["event"]["state"] == "confirmed" and r["displaced"] == [ev["id"]]
    assert ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]["state"] == "displaced"
    enable(cc, maintenance_overlap="override_notify")
    a2 = room(cc, "חדר ב", color="rose")
    e2 = ok(book(cc, a2, T(4, 10), T(4, 11)), 201)["event"]
    ok(cc.post(f"{API}/calendar/maintenance", json={"calendar_id": m["id"], "title": "תיקון", "rooms": [a2["id"]], "start": T(4, 10), "end": T(4, 11)}), 201)
    assert ok(cc.get(f"{API}/calendar/events/{e2['id']}"))["event"]["state"] == "displaced"


def test_per_calendar_override_works_in_both_directions(cc):
    a, m, ev = _maint_setup(cc, maintenance_overlap="override_notify")
    cur = ok(cc.get(f"{API}/calendar/calendars/{a['id']}"))["calendar"]
    ok(cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": cur["revision"], "overlap_override": "block"}))  # stricter than the installation value
    assert maint(cc, m, a).status_code == 409
    cur = ok(cc.get(f"{API}/calendar/calendars/{a['id']}"))["calendar"]
    ok(cc.patch(f"{API}/calendar/calendars/{a['id']}", json={"revision": cur["revision"], "overlap_override": "first_holds"}))
    enable(cc, maintenance_overlap="block")  # looser than the installation value
    assert ok(maint(cc, m, a), 201)["event"]["state"] == "pending"


def test_maintenance_needs_the_permission_and_view_of_the_rooms(cc):
    a, m, ev = _maint_setup(cc)
    op = user(cc, "omri")
    r = cc.post(f"{API}/calendar/maintenance", json={"calendar_id": m["id"], "title": "x", "rooms": [a["id"]], "start": T(5, 10), "end": T(5, 11)}, headers=op)
    assert r.status_code == 404  # the maintenance calendar is not visible to him at all
    members(cc, m, [{"subject_kind": "user", "subject_id": "dev-omri", "cal_role": "view"}])
    r = cc.post(f"{API}/calendar/maintenance", json={"calendar_id": m["id"], "title": "x", "rooms": [a["id"]], "start": T(5, 10), "end": T(5, 11)}, headers=op)
    assert r.status_code == 403  # calendar.maintenance is not an operator permission


# ---------------------------------------------------------------- recurrence through the API

def test_series_occurrence_following_and_series_edits(cc):
    enable(cc)
    a = room(cc)
    r = ok(book(cc, a, T(3, 16), T(3, 17), title="שיעור", rrule="FREQ=WEEKLY;BYDAY=TU;COUNT=6"), 201)
    ev = r["event"]
    lst = lambda: ok(cc.get(f"{API}/calendar/occurrences", params={"from": T(1, 0), "to": T(31, 0, month=12), "calendars": a["id"]}))["occurrences"]  # noqa: E731
    assert len(lst()) == 6
    # cancel ONE occurrence
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": ev["revision"], "scope": "occurrence", "occurrence_start": "2026-11-10T18:00"}))
    assert [o["start"][:10] for o in lst()] == ["2026-11-03", "2026-11-17", "2026-11-24", "2026-12-01", "2026-12-08"]
    # move one occurrence (an override row)
    ev = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    out = ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"], "scope": "occurrence", "occurrence_start": "2026-11-17T18:00", "title": "שיעור מיוחד",
                                                               "start": T(17, 17), "end": T(17, 18)}))
    assert out["event"]["override_of"] == ev["id"]
    titles = {o["start"][:13]: o["title"] for o in lst()}
    assert titles["2026-11-17T17"] == "שיעור מיוחד" and "2026-11-17T16" not in titles
    # edit this and the following: new title from 2026-12-01 on
    ev = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"], "scope": "following", "occurrence_start": "2026-12-01T18:00", "title": "חורף"}))
    t = {o["start"][:10]: o["title"] for o in lst()}
    assert t["2026-11-24"] == "שיעור" and t["2026-12-01"] == "חורף" and t["2026-12-08"] == "חורף"
    # series edit of the first series with an override listed as orphan when the rule moves
    ev = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    r = cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"], "scope": "series", "rrule": "FREQ=WEEKLY;BYDAY=WE;COUNT=3"})
    assert r.status_code == 409 and r.json()["code"] == "orphaned_overrides"


def test_series_conflicts_are_per_occurrence_and_past_is_immutable(cc):
    enable(cc)
    a = room(cc)
    ok(book(cc, a, T(10, 16), T(10, 17), title="חד פעמי"), 201)
    r = ok(book(cc, a, T(3, 16), T(3, 17), rrule="FREQ=WEEKLY;BYDAY=TU;COUNT=3"), 201)
    assert r["state"] == "pending"  # the second occurrence meets the single entry
    assert book(cc, a, T(3, 16), T(3, 17), rrule="FREQ=HOURLY").status_code == 422
    assert book(cc, a, T(3, 16), T(3, 17), rrule="FREQ=WEEKLY;BYDAY=TU;COUNT=2", holiday_skip=True).status_code in (201, 422)
    # a past single entry only accepts notes
    old = ok(book(cc, a, T(3, 10), T(3, 11), title="יחיד"), 201)["event"]
    seed = NOW
    cal_router._now = lambda: seed + dt.timedelta(days=60)  # noqa: SLF001 - the fixture restores it
    cur = ok(cc.get(f"{API}/calendar/events/{old['id']}"))["event"]
    assert cc.patch(f"{API}/calendar/events/{old['id']}", json={"revision": cur["revision"], "title": "חדש"}).json()["code"] == "past_immutable"
    ok(cc.patch(f"{API}/calendar/events/{old['id']}", json={"revision": cur["revision"], "notes": "סיכום"}))
    assert cc.post(f"{API}/calendar/events/{old['id']}/cancel", json={"revision": cur["revision"] + 1}).json()["code"] == "past_immutable"


def test_stale_revision_and_visibility_levels(cc):
    enable(cc)
    a = room(cc, visibility="busy_to_all")
    ev = ok(book(cc, a, T(3, 10), T(3, 11), title="פרטי", notes="סודי"), 201)["event"]
    assert cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"] + 5, "title": "x"}).status_code == 409
    v = user(cc, "vic", "viewer")
    occs = ok(cc.get(f"{API}/calendar/occurrences", params={"from": T(1, 0), "to": T(8, 0)}, headers=v))["occurrences"]
    assert occs and occs[0]["title"] is None and occs[0]["organizer"] is None  # busy only
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-vic", "cal_role": "view"}])
    o = ok(cc.get(f"{API}/calendar/occurrences", params={"from": T(1, 0), "to": T(8, 0)}, headers=v))["occurrences"][0]
    assert o["title"] == "פרטי"
    assert ok(cc.get(f"{API}/calendar/events/{ev['id']}", headers=v))["event"]["notes"] is None  # a view member never sees the notes


# ---------------------------------------------------------------- availability and the day view

def test_availability_and_room_day(cc):
    enable(cc)
    a = room(cc, "קטן", capacity=4, equipment=["screen"])
    b = room(cc, "גדול", capacity=20, equipment=["screen", "projector"], color="rose")
    ok(book(cc, b, T(3, 10), T(3, 11)), 201)
    r = ok(cc.post(f"{API}/calendar/availability", json={"from": T(3, 10), "to": T(3, 12), "duration_min": 60, "headcount": 10, "equipment": ["projector"]}))
    assert [x["calendar_id"] for x in r["free"]] == [b["id"]] and r["free"][0]["start"] == T(3, 11)
    assert ok(cc.post(f"{API}/calendar/availability", json={"from": T(3, 10), "to": T(3, 11), "duration_min": 60, "headcount": 10, "equipment": ["projector"]}))["free"] == []
    day = ok(cc.get(f"{API}/calendar/rooms/day", params={"date": "2026-11-03"}))["rooms"]
    assert {x["name"] for x in day} == {"קטן", "גדול"} and sum(len(x["entries"]) for x in day) == 1


# ---------------------------------------------------------------- guest details and retention

def test_guest_details_are_sealed_permissioned_and_audited_without_content(cc):
    enable(cc)
    a = room(cc)
    sa = user(cc, "sigal", "site_admin")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-sigal", "cal_role": "book"}])
    guests = [{"name": "דנה כהן", "phone": "050-123-4567"}]
    r = ok(book(cc, a, T(3, 10), T(3, 11), sa, on_behalf={"kind": "customer", "label": "לקוח"}, guests=guests), 201)
    eid = r["event"]["id"]
    with db(cc).connection() as c:
        row = c.execute("SELECT * FROM cal_guest_details WHERE event_id = ?", (eid,)).fetchone()
        assert row["name_sealed"].startswith("v1:") and "דנה" not in row["name_sealed"] and row["phone_sealed"].startswith("v1:")
        dump = json.dumps([dict(x) for x in c.execute("SELECT * FROM cal_events")], ensure_ascii=False) + json.dumps([dict(x) for x in c.execute("SELECT details_json FROM audit_log")], ensure_ascii=False)
        assert "דנה" not in dump and "1234567" not in dump and "123-4567" not in dump
    assert "דנה" not in json.dumps(r, ensure_ascii=False)
    # reading: the organizer is not enough; calendar.guests or a manager of that calendar
    assert cc.get(f"{API}/calendar/events/{eid}/guests", headers=sa).status_code == 403
    g = ok(cc.get(f"{API}/calendar/events/{eid}/guests"))
    assert g["guests"] == [{"seq": 1, "name": "דנה כהן", "phone": "+972501234567"}]
    with db(cc).connection() as c:
        reads = c.execute("SELECT details_json FROM audit_log WHERE action = 'calendar.guests.read'").fetchall()
        assert reads and "דנה" not in str(reads[0][0])
    # booking guests needs calendar.book_for_others and an allowed kind
    op = user(cc, "ofir")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-sigal", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-ofir", "cal_role": "book"}])
    assert book(cc, a, T(4, 10), T(4, 11), op, guests=guests).status_code == 422  # a self booking carries no guests
    assert book(cc, a, T(4, 10), T(4, 11), op, on_behalf={"kind": "customer", "label": "ל"}, guests=guests).status_code == 403
    assert book(cc, a, T(4, 10), T(4, 11), sa, on_behalf={"kind": "vendor", "label": "ל"}, guests=guests).json()["code"] == "guests_not_allowed"
    assert book(cc, a, T(4, 10), T(4, 11), sa, on_behalf={"kind": "customer", "label": "ל"}, guests=[{"name": "א", "phone": "abc"}]).status_code == 422
    # erase on request
    assert cc.delete(f"{API}/calendar/events/{eid}/guests").status_code == 204
    assert ok(cc.get(f"{API}/calendar/events/{eid}/guests"))["guests"] == []


def test_retention_janitor_setting_and_purge_all(cc):
    enable(cc, guest_retention_days=30)
    a = room(cc)
    guests = [{"name": "גיל", "phone": "0501111111"}]
    mk = lambda day: ok(book(cc, a, T(day, 10), T(day, 11), on_behalf={"kind": "class", "label": "חוג"}, guests=guests), 201)["event"]["id"]  # noqa: E731
    e1, e2 = mk(3), mk(4)
    with db(cc).connection() as c:
        due = c.execute("SELECT erase_after FROM cal_guest_details WHERE event_id = ?", (e1,)).fetchone()[0]
        assert due == "2026-12-03T11:00:00Z"  # end of the entry + 30 days
    assert jobs.run(Database(cc.settings_obj.db_path), NOW + dt.timedelta(days=5))["erased"] == 0
    # the setting is the owner's: changing it recomputes and previews what would be erased
    r = ok(cc.put(f"{API}/calendar/settings", json={"enabled": True, "guest_retention_days": 0}))
    assert r["erase_preview"] == 0  # both entries are still in the future
    with db(cc).connection() as c:
        assert c.execute("SELECT erase_after FROM cal_guest_details WHERE event_id = ?", (e1,)).fetchone()[0] == "2026-11-03T11:00:00Z"  # 0 = erased when the entry ends
    out = jobs.run(Database(cc.settings_obj.db_path), dt.datetime(2026, 11, 3, 12, 0, tzinfo=UTC))
    assert out["erased"] == 1
    with db(cc).connection() as c:
        assert c.execute("SELECT erased_at, name_sealed FROM cal_guest_details WHERE event_id = ?", (e1,)).fetchone()["name_sealed"] is None
        assert c.execute("SELECT name_sealed FROM cal_guest_details WHERE event_id = ?", (e2,)).fetchone()[0] is not None
        a1 = c.execute("SELECT details_json FROM audit_log WHERE action = 'calendar.guests.erase'").fetchall()
        assert a1 and "גיל" not in str(a1[0][0])
    # destroy everything now
    assert ok(cc.post(f"{API}/calendar/guests/purge"))["erased"] == 1
    with db(cc).connection() as c:
        assert c.execute("SELECT COUNT(*) FROM cal_guest_details WHERE name_sealed IS NOT NULL OR phone_sealed IS NOT NULL").fetchone()[0] == 0
    assert cc.post(f"{API}/calendar/guests/purge", headers=user(cc, "olga", "operator")).status_code == 403


def test_retention_runs_even_while_the_module_is_off(cc):
    enable(cc, guest_retention_days=0)
    a = room(cc)
    eid = ok(book(cc, a, T(3, 10), T(3, 11), on_behalf={"kind": "class", "label": "חוג"}, guests=[{"name": "יוסי", "phone": ""}]), 201)["event"]["id"]
    ok(cc.put(f"{API}/calendar/settings", json={"enabled": False, "guest_retention_days": 0}))
    assert jobs.run(Database(cc.settings_obj.db_path), dt.datetime(2026, 11, 4, tzinfo=UTC))["erased"] == 1
    with db(cc).connection() as c:
        assert c.execute("SELECT name_sealed FROM cal_guest_details WHERE event_id = ?", (eid,)).fetchone()[0] is None


def test_cancelled_request_guest_data_is_kept_only_from_the_decision(cc):
    enable(cc, guest_retention_days=10)
    a = room(cc, approval_mode="always")
    sa = user(cc, "shai", "operator")
    sa2 = user(cc, "shira", "site_admin")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-shira", "cal_role": "book"}])
    ev = ok(book(cc, a, T(20, 10), T(20, 11), sa2, on_behalf={"kind": "customer", "label": "ל"}, guests=[{"name": "נ", "phone": ""}]), 201)
    del sa
    # site_admin has edit and bypasses approval; withdraw is only for pending, so cancel it
    e = ev["event"]
    ok(cc.post(f"{API}/calendar/events/{e['id']}/cancel", json={"revision": e["revision"]}, headers=sa2))
    with db(cc).connection() as c:
        assert c.execute("SELECT erase_after FROM cal_guest_details WHERE event_id = ?", (e["id"],)).fetchone()[0] == "2026-10-15T09:00:00Z"  # the decision time (NOW) + 10 days


# ---------------------------------------------------------------- expiry, the cache, concurrency

def test_pending_requests_expire_before_their_start(cc):
    enable(cc)
    a = room(cc, approval_mode="always", approval_timeout_h=2)
    op = user(cc, "orit")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-orit", "cal_role": "book"}])
    ev = ok(book(cc, a, T(3, 10), T(3, 11), op), 201)["event"]
    d = Database(cc.settings_obj.db_path)
    assert jobs.run(d, dt.datetime(2026, 11, 3, 7, 0, tzinfo=UTC))["expired"] == 0
    assert jobs.run(d, dt.datetime(2026, 11, 3, 8, 30, tzinfo=UTC))["expired"] == 1  # 2 hours before 10:00Z
    assert ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]["state"] == "expired"
    done = ok(book(cc, a, T(3, 12), T(3, 13)), 201)["event"]
    assert jobs.run(d, dt.datetime(2026, 11, 4, tzinfo=UTC))["done"] == 1
    assert ok(cc.get(f"{API}/calendar/events/{done['id']}"))["event"]["state"] == "done"


def test_occurrence_cache_is_rebuildable(cc):
    enable(cc)
    a = room(cc)
    ev = ok(book(cc, a, T(3, 16), T(3, 17), rrule="FREQ=WEEKLY;BYDAY=TU;COUNT=5"), 201)["event"]
    ok(cc.post(f"{API}/calendar/events/{ev['id']}/cancel", json={"revision": ev["revision"], "scope": "occurrence", "occurrence_start": "2026-11-10T18:00"}))
    ev = ok(cc.get(f"{API}/calendar/events/{ev['id']}"))["event"]
    ok(cc.patch(f"{API}/calendar/events/{ev['id']}", json={"revision": ev["revision"], "scope": "occurrence", "occurrence_start": "2026-11-17T18:00", "start": T(17, 17), "end": T(17, 18)}))
    snap = lambda c: sorted(tuple(r) for r in c.execute("SELECT event_id, holder_calendar_id, occ_start, occ_end, local_start, state FROM cal_occurrences"))  # noqa: E731
    with db(cc).connection() as c:
        before = snap(c)
        s = model.read_settings(c)
        c.execute("DELETE FROM cal_occurrences")
        for (eid,) in c.execute("SELECT id FROM cal_events WHERE override_of IS NULL").fetchall():
            occ.rebuild(c, eid, s, NOW)
        assert snap(c) == before and len(before) == 4


def test_two_concurrent_bookings_of_one_slot_confirm_exactly_one(cc):
    enable(cc)
    a = room(cc)
    ann, bob = user(cc, "ann"), user(cc, "bob")
    members(cc, a, [{"subject_kind": "user", "subject_id": "dev-ann", "cal_role": "book"}, {"subject_kind": "user", "subject_id": "dev-bob", "cal_role": "book"}])
    results: list[dict] = []
    barrier = threading.Barrier(2)

    def go(who):
        barrier.wait()
        r = book(cc, a, T(3, 10), T(3, 11), who)
        results.append({"status": r.status_code, "state": r.json().get("state")})

    ts = [threading.Thread(target=go, args=(w,)) for w in (ann, bob)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(x["state"] for x in results) == ["confirmed", "pending"] and all(x["status"] == 201 for x in results)


def test_permissions_catalogue_and_roles(cc):
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE
    for p in model.ALL_PERMS:
        assert p in PERMISSION_LABELS
    assert {"calendar.maintenance", "calendar.guests", "calendar.connect"} <= set(SENSITIVE)
    roles = {r["id"]: set(r["permissions"]) for r in json.loads((__import__("pathlib").Path(__import__("smplwise").__file__).parent / "roles.json").read_text(encoding="utf-8"))["roles"]}
    assert "calendar.view" in roles["viewer"] and "calendar.book" in roles["operator"] and "calendar.manage" in roles["site_admin"]
    assert roles["calendar_connect"] == {"calendar.connect"} and "calendar.connect" not in roles["site_admin"]
