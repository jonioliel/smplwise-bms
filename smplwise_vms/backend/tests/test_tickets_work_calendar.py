"""SLACAL (2.9.1): the working-hours calendar of the ticket timers.

Pure helpers first (working_minutes_between / add_working_time: overnight, weekends, holidays, zero length, DST in both directions, a window
start inside a spring-forward gap, the round trip), then the validator, then the wiring: stuck.evaluate / stuck.plan / sla.compute with a
calendar and - the default - exactly the old wall-clock numbers, the settings document, the monitor end to end and the RFQ question
reminder. October 2026 facts: Sun 18 .. Thu 22 are working days of the default week, Fri 23 / Sat 24 are not, and Israel falls back on
Sunday 25 October."""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

import pytest
from test_tickets_monitor import db, look, w  # noqa: F401 - `w` is the fixture
from test_tickets_rfq_public import token
from test_tickets_rfq_questions import ask, notif, s4, setup_two  # noqa: F401 - `s4` is the fixture
from tickets_world import API

from smplwise.services.tickets import rfq_questions, settings_doc, sla, stuck, work_calendar as wc

UTC = dt.timezone.utc
IL = ZoneInfo("Asia/Jerusalem")
NY = ZoneInfo("America/New_York")


def at(y: int, mo: int, d: int, h: int = 0, mi: int = 0, tz: ZoneInfo = IL) -> dt.datetime:
    """A local wall time as a UTC instant."""
    return dt.datetime(y, mo, d, h, mi, tzinfo=tz).astimezone(UTC)


def local(t: dt.datetime, tz: ZoneInfo = IL) -> str:
    return t.astimezone(tz).strftime("%Y-%m-%d %H:%M")


def cal(**kw) -> wc.Calendar:
    base = dict(enabled=True, zone="Asia/Jerusalem", weekdays=frozenset({6, 0, 1, 2, 3}), start=dt.time(8, 0), end=dt.time(17, 0))
    base.update(kw)
    return wc.Calendar(**base)


# ---------------------------------------------------------------- the default is the wall clock

def test_default_calendar_is_exactly_wall_clock():
    a, b = at(2026, 10, 22, 16), at(2026, 10, 26, 3)  # across a weekend and the DST change
    for c in (None, wc.WALL_CLOCK, cal(enabled=False)):
        assert wc.working_minutes_between(a, b, c) == (b - a).total_seconds() / 60
        assert wc.add_working_time(a, 1234, c) == a + dt.timedelta(minutes=1234)
    assert wc.WALL_CLOCK.is_24x7 and cal().is_24x7 is False
    assert wc.calendar_from_doc(None, "Asia/Jerusalem") is wc.WALL_CLOCK
    assert wc.calendar_from_doc(wc.DEFAULT_DOC, "Asia/Jerusalem") is wc.WALL_CLOCK, "the stored default is OFF"


# ---------------------------------------------------------------- working_minutes_between

def test_inside_one_day_and_outside_the_hours():
    c = cal()
    assert wc.working_minutes_between(at(2026, 10, 19, 9), at(2026, 10, 19, 11, 30), c) == 150
    assert wc.working_minutes_between(at(2026, 10, 19, 6), at(2026, 10, 19, 20), c) == 540, "clipped to 08:00-17:00"
    assert wc.working_minutes_between(at(2026, 10, 19, 17), at(2026, 10, 20, 8), c) == 0, "the whole night"


def test_overnight_and_weekend_and_holiday():
    c = cal()
    assert wc.working_minutes_between(at(2026, 10, 18, 16), at(2026, 10, 19, 9), c) == 120, "Sun 16:00 -> Mon 09:00: 1h + 1h"
    assert wc.working_minutes_between(at(2026, 10, 22, 16), at(2026, 10, 25, 9), c) == 120, "Thu 16:00 -> Sun 09:00: Fri and Sat are skipped"
    assert wc.working_minutes_between(at(2026, 10, 23, 0), at(2026, 10, 24, 23), c) == 0
    h = cal(holidays=frozenset({dt.date(2026, 10, 21)}))
    assert wc.working_minutes_between(at(2026, 10, 20, 16), at(2026, 10, 22, 9), h) == 120, "Wed 21 is a holiday"
    assert wc.working_minutes_between(at(2026, 10, 21, 8), at(2026, 10, 21, 17), h) == 0


def test_zero_length_and_reversed_ranges():
    c = cal()
    t = at(2026, 10, 19, 10)
    assert wc.working_minutes_between(t, t, c) == 0 and wc.working_minutes_between(t, t - dt.timedelta(hours=5), c) == 0
    assert wc.add_working_time(t, 0, c) == t and wc.add_working_time(t, -5, c) == t
    outside = at(2026, 10, 23, 12)  # a Friday
    assert wc.add_working_time(outside, 0, c) == outside, "zero minutes never moves the start, even outside the hours"


def test_naive_datetimes_are_read_as_utc():
    c = cal(zone="UTC")
    assert wc.working_minutes_between(dt.datetime(2026, 10, 19, 9), dt.datetime(2026, 10, 19, 10), c) == 60


# ---------------------------------------------------------------- add_working_time

def test_add_working_time_rolls_over_nights_weekends_and_holidays():
    c = cal()
    assert local(wc.add_working_time(at(2026, 10, 18, 16, 30), 60, c)) == "2026-10-19 08:30", "30 min today + 30 min tomorrow"
    assert local(wc.add_working_time(at(2026, 10, 23, 10), 30, c)) == "2026-10-25 08:30", "Friday: counting starts at the Sunday opening"
    assert local(wc.add_working_time(at(2026, 10, 19, 5), 60, c)) == "2026-10-19 09:00", "before opening: counting starts at 08:00"
    assert local(wc.add_working_time(at(2026, 10, 19, 16), 60, c)) == "2026-10-19 17:00", "a due that completes exactly at closing is the closing"
    assert local(wc.add_working_time(at(2026, 10, 19, 16), 61, c)) == "2026-10-20 08:01"
    h = cal(holidays=frozenset({dt.date(2026, 10, 21)}))
    assert local(wc.add_working_time(at(2026, 10, 20, 16), 120, h)) == "2026-10-22 09:00"
    assert local(wc.add_working_time(at(2026, 10, 19, 8), 5 * 540, c)) == "2026-10-25 17:00", "five working days = Mon..Thu + Sun"


def test_round_trip_between_and_add():
    c = cal(holidays=frozenset({dt.date(2026, 10, 20)}))
    starts = [at(2026, 10, 18, 7, 59), at(2026, 10, 19, 16, 45), at(2026, 10, 21, 12), at(2026, 10, 22, 17), at(2026, 10, 23, 9), at(2026, 10, 24, 23, 59)]
    for s in starts:
        for minutes in (1, 59, 60, 539, 540, 541, 2000, 10_000):
            t = wc.add_working_time(s, minutes, c)
            assert wc.working_minutes_between(s, t, c) == pytest.approx(minutes), (local(s), minutes)
            assert wc.working_minutes_between(s, t - dt.timedelta(seconds=1), c) < minutes, "the EARLIEST instant"


def test_no_working_time_at_all_never_blocks_a_timer(monkeypatch):
    monkeypatch.setattr(wc, "_LIMIT_DAYS", 10)
    every_day = frozenset(dt.date(2026, 10, 1) + dt.timedelta(days=i) for i in range(60))
    c = cal(holidays=every_day)
    t = at(2026, 10, 19, 9)
    assert wc.add_working_time(t, 60, c) == t + dt.timedelta(minutes=60), "falls back to the wall clock"


# ---------------------------------------------------------------- DST

def test_spring_forward_window_has_one_hour_less():
    c = cal(zone="America/New_York", weekdays=frozenset({6}), start=dt.time(1, 0), end=dt.time(4, 0))
    s, e = at(2026, 3, 8, 0, tz=NY), at(2026, 3, 9, 0, tz=NY)  # Sunday 8 March: 02:00 -> 03:00
    assert wc.working_minutes_between(s, e, c) == 120, "01:00 EST -> 04:00 EDT is two real hours"
    assert wc.working_minutes_between(at(2026, 3, 1, 0, tz=NY), at(2026, 3, 2, 0, tz=NY), c) == 180, "an ordinary Sunday"
    assert local(wc.add_working_time(at(2026, 3, 8, 1, 30, tz=NY), 90, c), NY) == "2026-03-08 04:00"


def test_window_start_inside_the_gap_resolves_after_it():
    c = cal(zone="America/New_York", weekdays=frozenset({6}), start=dt.time(2, 30), end=dt.time(4, 0))
    assert wc.working_minutes_between(at(2026, 3, 8, 0, tz=NY), at(2026, 3, 9, 0, tz=NY), c) == 60, "02:30 does not exist: it opens at 03:00"


def test_fall_back_window_has_one_hour_more():
    c = cal(zone="America/New_York", weekdays=frozenset({6}), start=dt.time(0, 30), end=dt.time(3, 30))
    assert wc.working_minutes_between(at(2026, 11, 1, 0, tz=NY), at(2026, 11, 2, 0, tz=NY), c) == 240, "01:00-02:00 happens twice"


def test_israel_fall_back_week_keeps_the_local_hours():
    c = cal()
    t = wc.add_working_time(at(2026, 10, 22, 16), 120, c)  # Thu 16:00 + 2h: 1h Thursday, then Sunday 25 October (clocks went back)
    assert local(t) == "2026-10-25 09:00"
    assert t == dt.datetime(2026, 10, 25, 7, 0, tzinfo=UTC), "09:00 at +02:00"
    assert wc.working_minutes_between(at(2026, 10, 25, 0), at(2026, 10, 26, 0), c) == 540


# ---------------------------------------------------------------- the stored document

def test_validate_doc_accepts_and_normalises():
    d = wc.validate_doc({"enabled": True, "weekdays": [3, 0, 6], "start": "07:30", "end": "16:00", "holidays": ["2026-10-21", "2026-09-20", "2026-10-21"],
                         "departments": {"d1": {"start": "09:00", "end": "13:00"}, "d2": {"enabled": False}}})
    assert d["weekdays"] == [0, 3, 6] and d["holidays"] == ["2026-09-20", "2026-10-21"]
    assert d["departments"] == {"d1": {"start": "09:00", "end": "13:00"}, "d2": {"enabled": False}}
    assert wc.validate_doc({}) == wc.DEFAULT_DOC and wc.DEFAULT_DOC["enabled"] is False


@pytest.mark.parametrize("bad", [
    "x", [], {"extra": 1}, {"enabled": 1}, {"weekdays": []}, {"weekdays": [7]}, {"weekdays": [1, 1]}, {"weekdays": [True]}, {"weekdays": "0"},
    {"start": "8:00", "end": "17:00"}, {"start": "17:00", "end": "08:00"}, {"start": "08:00", "end": "08:00"}, {"start": "00:00", "end": "24:00"},
    {"holidays": ["2026-02-30"]}, {"holidays": ["21/10/2026"]}, {"holidays": [20261021]}, {"holidays": ["2026-10-21"] * 401},
    {"departments": {"bad id!": {}}}, {"departments": {"d": {"zone": "UTC"}}}, {"departments": {"d": {"start": "18:00", "end": "09:00"}}},
    {"departments": {"d": {"enabled": "no"}}}, {"departments": []},
])
def test_validate_doc_refuses(bad):
    with pytest.raises(ValueError):
        wc.validate_doc(bad)


def test_department_override_rules():
    doc = wc.validate_doc({"enabled": True, "departments": {"night": {"start": "20:00", "end": "23:00"}, "always": {"enabled": False}}})
    base = wc.calendar_from_doc(doc, "Asia/Jerusalem")
    assert (base.start, base.end) == (dt.time(8, 0), dt.time(17, 0)) and base.zone == "Asia/Jerusalem"
    assert wc.calendar_from_doc(doc, "Asia/Jerusalem", "night").start == dt.time(20, 0)
    assert wc.calendar_from_doc(doc, "Asia/Jerusalem", "always") is wc.WALL_CLOCK, "the department opts out: 24x7"
    assert wc.calendar_from_doc(doc, "Asia/Jerusalem", "unknown-dept").start == dt.time(8, 0)
    off = wc.validate_doc({"enabled": False, "departments": {"night": {"start": "20:00", "end": "23:00"}}})
    assert wc.calendar_from_doc(off, "Asia/Jerusalem", "night") is wc.WALL_CLOCK, "an override of the hours never switches the calendar on"
    on_for_one = wc.validate_doc({"enabled": False, "departments": {"d": {"enabled": True}}})
    assert wc.calendar_from_doc(on_for_one, "Asia/Jerusalem", "d").enabled, "but a department may switch itself on explicitly"


def test_a_corrupt_stored_calendar_is_the_wall_clock():
    assert wc.calendar_from_doc({"enabled": True, "weekdays": [9]}, "Asia/Jerusalem") is wc.WALL_CLOCK
    assert wc.Calendar(zone="Not/AZone").tz.key == "Asia/Jerusalem"


# ---------------------------------------------------------------- stuck.evaluate / stuck.plan / sla.compute

RULE = {"unassigned_after_min": 15, "link_unopened_min": 1440, "ack_within_min": 30, "stuck_after_min": 60, "stuck_waiting_min": 1440,
        "resolve_within_min": 480, "remind_every_min": 30, "max_reminders": 2, "manager_alert_after_steps": 1}


def z(t: dt.datetime) -> str:
    return stuck.iso(t) or ""


def row(status: str, created: dt.datetime, last: dt.datetime | None = None, eta: dt.datetime | None = None) -> dict:
    held = status not in ("new", "returned")
    return {"id": "t1", "status": status, "created_at": z(created), "last_activity_at": z(last or created), "eta_at": z(eta) if eta else None,
            "current_assignment_id": "a1" if held else None, "asg_kind": "user" if held else None, "asg_at": z(created) if held else None,
            "asg_ended_at": None}


def test_evaluate_without_a_calendar_is_unchanged():
    r = row("in_progress", at(2026, 10, 22, 16))
    assert stuck.evaluate(r, RULE, at(2026, 10, 23, 0)).dues == stuck.evaluate(r, RULE, at(2026, 10, 23, 0), cal=wc.WALL_CLOCK).dues
    assert stuck.evaluate(r, RULE, at(2026, 10, 23, 0)).dues["stuck"] == at(2026, 10, 22, 17)


def test_evaluate_counts_working_minutes_for_every_threshold():
    c = cal()
    t = at(2026, 10, 22, 16, 30)  # Thursday 16:30; Friday and Saturday are off
    r = row("in_progress", t)
    assert stuck.evaluate(r, RULE, at(2026, 10, 22, 18)).crossed.kind == "stuck", "wall clock: stuck since 17:30"
    ev = stuck.evaluate(r, RULE, at(2026, 10, 22, 18), cal=c)
    assert ev.crossed is None
    assert local(ev.dues["stuck"]) == "2026-10-25 08:30", "60 working minutes: 30 on Thursday + 30 on Sunday"
    assert local(ev.dues["overdue"]) == "2026-10-25 15:30", "480 min: 30 on Thursday + 450 on Sunday"
    ev2 = stuck.evaluate(r, RULE, at(2026, 10, 25, 8, 30), cal=c)
    assert ev2.crossed == stuck.Crossing("stuck", at(2026, 10, 25, 8, 30))
    ack = stuck.evaluate(row("assigned", at(2026, 10, 22, 16, 45)), RULE, at(2026, 10, 23, 12), cal=c)
    assert ack.crossed is None and local(ack.dues["ack"]) == "2026-10-25 08:15"
    new = stuck.evaluate(row("new", at(2026, 10, 23, 10)), RULE, at(2026, 10, 25, 8, 10), cal=c)
    assert new.crossed is None and local(new.dues["unassigned"]) == "2026-10-25 08:15", "created on Friday: counts from the Sunday opening"
    waiting = stuck.evaluate(row("waiting_part", t), RULE, t, cal=c)
    assert local(waiting.dues["waiting"]) == "2026-10-27 13:30", "1440 min = 30 + 540 + 540 + 330"


def test_an_eta_is_an_absolute_instant_even_with_a_calendar():
    eta = at(2026, 10, 23, 12)  # Friday noon: not a working time, still a promise
    ev = stuck.evaluate(row("in_progress", at(2026, 10, 22, 8), eta=eta), RULE, at(2026, 10, 22, 12), cal=cal())
    assert ev.dues["stuck"] == eta


def test_ladder_cadence_and_manager_alert_count_working_time():
    c = cal()
    due = at(2026, 10, 22, 16, 45)
    r = row("in_progress", due - dt.timedelta(minutes=60))
    state = stuck.LadderState(kind="stuck", level=1, reminders=1, due=z(due), last_reminder_at=z(due))
    ev = stuck.evaluate(r, RULE, at(2026, 10, 22, 17, 30), cal=c)
    p = stuck.plan(state, ev, RULE, at(2026, 10, 22, 17, 30), assignee="user", cal=c)
    assert not p.remind and not p.alert, "wall clock: reminder 2 and the manager alert would both be due at 17:15"
    p = stuck.plan(state, ev, RULE, at(2026, 10, 25, 8, 14), assignee="user", cal=c)
    assert not p.remind and not p.alert
    p = stuck.plan(state, ev, RULE, at(2026, 10, 25, 8, 15), assignee="user", cal=c)
    assert p.remind and p.alert, "15 min before closing + 15 min after the Sunday opening = one cadence"
    p = stuck.plan(state, ev, RULE, at(2026, 10, 22, 17, 30), assignee="user")
    assert p.remind and p.alert, "no calendar: exactly the old behaviour"


def test_sla_compute_follows_the_calendar_and_keeps_calendar_days_for_auto_close():
    kw = dict(status="in_progress", created_at=z(at(2026, 10, 22, 16)), last_activity_at=z(at(2026, 10, 22, 16)), unassigned_since=None,
              assigned_at=None, eta_at=None, done_at=None, rule=RULE, auto_close_after_days=None)
    wall = sla.compute(**kw)
    assert wall.stuck_due_at == z(at(2026, 10, 22, 17)) and wall.resolve_due_at == z(at(2026, 10, 23, 0))
    c = cal()
    on = sla.compute(**kw, cal=c)
    assert on.stuck_due_at == z(at(2026, 10, 22, 17)) and on.resolve_due_at == z(at(2026, 10, 25, 15))
    assert on.next_check_at == on.stuck_due_at
    done = sla.compute(**{**kw, "status": "done", "done_at": z(at(2026, 10, 22, 16)), "auto_close_after_days": 2}, cal=c)
    assert done.next_check_at == z(at(2026, 10, 24, 16)), "the automatic close counts calendar days"


# ---------------------------------------------------------------- the settings document

def test_settings_default_save_and_refusals(w):  # noqa: F811
    with db(w).connection() as conn:
        assert settings_doc.read(conn)["calendar"] == wc.DEFAULT_DOC
        assert wc.load(conn, "any") is wc.WALL_CLOCK
    rev = w.c.get(f"{API}/tickets/settings").json()["revision"]
    assert w.c.get(f"{API}/tickets/settings").json()["calendar"]["enabled"] is False
    doc = {"enabled": True, "weekdays": [0, 1, 2, 3, 4], "start": "09:00", "end": "18:00", "holidays": ["2026-10-21"], "departments": {}}
    r = w.c.put(f"{API}/tickets/settings", json={"revision": rev, "calendar": doc})
    assert r.status_code == 200, r.text
    assert r.json()["calendar"]["weekdays"] == [0, 1, 2, 3, 4]
    with db(w).connection() as conn:
        c = wc.load(conn, "any")
        assert c.enabled and c.start == dt.time(9, 0) and c.holidays == frozenset({dt.date(2026, 10, 21)}) and c.zone == "Asia/Jerusalem"
    for bad in ({"enabled": True, "start": "18:00", "end": "09:00"}, {"weekdays": []}, {"holidays": ["nope"]}, {"unknown": 1}):
        bad_r = w.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "calendar": bad})
        assert bad_r.status_code == 422, (bad, bad_r.text)


def test_the_installation_zone_is_the_calendars_zone(w):  # noqa: F811
    from smplwise.db import set_setting

    rev = w.c.get(f"{API}/tickets/settings").json()["revision"]
    assert w.c.put(f"{API}/tickets/settings", json={"revision": rev, "calendar": {"enabled": True}}).status_code == 200
    with db(w).connection() as conn:
        set_setting(conn, "time.zone", "Europe/London")
        assert wc.load(conn, None).zone == "Europe/London"


# ---------------------------------------------------------------- the monitor, end to end

def enable_all_week(w, **extra) -> None:  # noqa: F811
    rev = w.c.get(f"{API}/tickets/settings").json()["revision"]
    doc = {"enabled": True, "weekdays": [0, 1, 2, 3, 4, 5, 6], "start": "08:00", "end": "16:00", **extra}
    assert w.c.put(f"{API}/tickets/settings", json={"revision": rev, "calendar": doc}).status_code == 200


def test_monitor_stuck_timer_waits_for_working_time(w):  # noqa: F811
    t = w.create("mona", "y")
    w.assign("mona", t["id"], "tom")
    w.status("tom", t["id"], "acknowledged")
    start = stuck.parse(w.detail(t["id"])["last_activity_at"])
    day = 24 * 60
    enable_all_week(w)  # every day 08:00-16:00 = 480 working minutes a day, so "3 days" of stuck takes 9 days
    with db(w).connection() as conn:
        sla.refresh_all_open(conn)
        cal_now = wc.load(conn, None)
    p = look(w, t["id"], start + dt.timedelta(minutes=3 * day + 1))
    assert p is not None and p.actions == [], "wall clock would have called it stuck"
    due = wc.add_working_time(start, 3 * day, cal_now)
    assert due > start + dt.timedelta(minutes=3 * day)
    p = look(w, t["id"], due + dt.timedelta(minutes=1))
    assert p.actions == ["started", "remind"]
    assert len(notif_rows(w, "ticket.reminder", t["id"])) == 1


def notif_rows(w, source: str, tid: str) -> list[dict]:  # noqa: F811
    with db(w).connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? AND subject_id = ?", (source, tid)).fetchall()]


def test_monitor_default_calendar_changes_nothing(w):  # noqa: F811
    t = w.create("mona", "y")
    w.assign("mona", t["id"], "tom")
    w.status("tom", t["id"], "acknowledged")
    start = stuck.parse(w.detail(t["id"])["last_activity_at"])
    assert look(w, t["id"], start + dt.timedelta(minutes=3 * 24 * 60 + 1)).actions == ["started", "remind"]


def test_changing_the_calendar_recomputes_the_stored_dues(w):  # noqa: F811
    t = w.create("mona", "z")
    with db(w).connection() as conn:
        before = conn.execute("SELECT resolve_due_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()[0]
    enable_all_week(w)
    with db(w).connection() as conn:
        after = conn.execute("SELECT resolve_due_at FROM tickets WHERE id = ?", (t["id"],)).fetchone()[0]
    assert before and after and after > before, "working minutes are slower than wall minutes"


# ---------------------------------------------------------------- the RFQ question reminder

def test_question_reminder_counts_working_hours(s4):  # noqa: F811
    d, a, _b, c = setup_two(s4)
    assert ask(c, token(s4, a)).status_code == 201
    r = s4.c.get(f"{API}/tickets/settings")
    # every day 00:00-... cannot be 24h, so use 08:00-16:00 every day: 24 working hours take three days
    doc = {"enabled": True, "weekdays": [0, 1, 2, 3, 4, 5, 6], "start": "08:00", "end": "16:00"}
    assert s4.c.put(f"{API}/tickets/settings", json={"revision": r.json()["revision"], "calendar": doc}).status_code == 200
    now = dt.datetime.now(UTC)
    with s4.db.connection() as conn:
        cal_now = wc.load(conn, None)
        assert rfq_questions.remind(conn, now + dt.timedelta(hours=25)) == 0, "25 wall hours are at most 9 working hours"
        due = wc.add_working_time(now - dt.timedelta(minutes=1), 24 * 60, cal_now)
        assert rfq_questions.remind(conn, due - dt.timedelta(minutes=30)) == 0, "just before the 24th working hour"
        assert rfq_questions.remind(conn, due + dt.timedelta(days=1)) == 1
        assert rfq_questions.remind(conn, due + dt.timedelta(days=10)) == 0, "once per question"
    assert len(notif(s4, "rfq.question_unanswered")) == 1
