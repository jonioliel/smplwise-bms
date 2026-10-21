"""DOORWIN2-295 (CR-039 5.4): the generated Israeli holiday list behind door windows - `special_days` over the energy calendar's arithmetic, the
manager's overrides on top (regular / closed / holiday), the three calendar policies, the horizon and the size cap, and the end-to-end plan on a
Pesach week. Pure calendar arithmetic and fakes; nothing is contacted."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from fake_doorwin_adapters import ProductWorld
from fake_doorwin_world import DoorwinWorld

from smplwise.services import door_windows as dw
from smplwise.services import energy_calendar as ec
from smplwise.services import special_days

UTC = dt.timezone.utc
D = dt.date


@pytest.fixture()
def pw(settings, monkeypatch):
    world = DoorwinWorld(start=dt.datetime(2026, 11, 2, 5, 0, tzinfo=UTC))
    p = ProductWorld(settings, monkeypatch, world=world)
    p.windows_on()
    return p


def conn_of(p):
    return p.db.connection(mode="read")


def sunday_to_thursday(start="08:00", end="11:00", policy="skip_holidays", doors=((("e", 1)),)):
    return dw.RuleDoc("r1", "בוקר", "weekly", "enabled", policy, tuple(doors), tuple(dw.Period(wd, None, start, end) for wd in range(0, 5)))


DOOR = dw.Door("e", 1, "כניסה", "לובי", "Asia/Jerusalem")


# ---------------------------------------------------------------- the generated list

def test_the_generated_list_is_the_energy_calendars_and_is_cut_by_the_generator():
    days = special_days.generated("israel", D(2027, 4, 1), D(2027, 6, 30))
    assert days["2027-04-22"]["kind"] == "holiday" and days["2027-04-22"]["name_he"] == "פסח"       # 15 Nisan 5787, a Thursday
    assert days["2027-04-21"]["kind"] == "holiday_eve"
    assert days["2027-06-11"]["kind"] == "holiday" and days["2027-06-10"]["kind"] == "holiday_eve"   # Shavuot
    assert set(days) == {s.date.isoformat() for s in ec.israel_special_days(2027) if D(2027, 4, 1) <= s.date <= D(2027, 6, 30)}
    assert special_days.generated("none", D(2027, 4, 1), D(2027, 6, 30)) == {}
    assert special_days.generated("klingon", D(2027, 4, 1), D(2027, 6, 30)) == {}
    assert special_days.day_types("israel", D(2027, 4, 21), D(2027, 4, 22)) == {"2027-04-21": "holiday_eve", "2027-04-22": "holiday"}


def test_the_energy_calendar_file_is_not_touched():
    """DOORWIN2-295 wraps the arithmetic instead of moving it: one source of truth and no shared-file churn."""
    from pathlib import Path

    src = Path(special_days.__file__).read_text(encoding="utf-8")
    assert "hebrew_to_date" not in src and "israel_special_days" not in src.replace("ec.Calendar", ""), "no second copy of the arithmetic"


def test_the_generator_setting_defaults_to_israel_and_is_validated(pw):
    s = pw.get("/doors/windows/settings").json()["settings"]
    assert s["doors.windows.calendar_generator"] == "israel"
    assert pw.put("/doors/windows/settings", changes={"doors.windows.calendar_generator": "mars"}, confirmed=True).status_code == 422
    assert pw.put("/doors/windows/settings", changes={"doors.windows.calendar_generator": "none"}, confirmed=True).status_code == 200
    with conn_of(pw) as conn:
        assert dw.calendar_for(conn, "e", D(2027, 4, 1), 400) == {}


def test_calendar_for_merges_the_generated_days_under_the_overrides(pw):
    with conn_of(pw) as conn:
        cal = dw.calendar_for(conn, "e", D(2027, 4, 15), 20)
    assert cal["2027-04-22"] == "holiday" and cal["2027-04-21"] == "holiday_eve"
    assert pw.put("/doors/windows/calendar", days=[{"on_date": "2027-04-22", "day_type": "regular", "label": "פתוח"},
                                                    {"on_date": "2027-04-27", "day_type": "closed", "label": "יום סגור"}], confirmed=True).status_code == 200
    with conn_of(pw) as conn:
        cal = dw.calendar_for(conn, "e", D(2027, 4, 15), 20)
    assert cal["2027-04-22"] == "regular", "a manager's override wins over the generated holiday"
    assert cal["2027-04-27"] == "closed" and cal["2027-04-21"] == "holiday_eve"


def test_the_holiday_list_route_shows_generated_and_manual_days(pw):
    pw.world.run_until(dt.datetime(2027, 4, 1, 5, 0, tzinfo=UTC))  # the route lists from "yesterday" on the product clock
    pw.put("/doors/windows/calendar", days=[{"on_date": "2027-04-22", "day_type": "regular", "label": "פתוח"},
                                             {"on_date": "2027-05-03", "day_type": "closed", "label": "יום סגור"}], confirmed=True)
    body = pw.get("/doors/windows/calendar").json()
    assert body["generator"] == "israel" and body["holidays"]
    by = {h["date"]: h for h in body["holidays"]}
    assert by["2027-04-21"]["source"] == "generated" and by["2027-04-21"]["kind"] == "holiday_eve"
    assert by["2027-04-22"] == {"date": "2027-04-22", "kind": "regular", "name_he": "פתוח", "source": "manual", "generated_kind": "holiday"}, "a cancelled holiday stays listed"
    assert by["2027-05-03"]["kind"] == "closed" and by["2027-05-03"]["generated_kind"] is None
    assert [h["date"] for h in body["holidays"]] == sorted(by)
    pw.put("/doors/windows/calendar", days=[{"on_date": "2027-04-22", "day_type": "none"}], confirmed=True)
    assert {h["date"]: h for h in pw.get("/doors/windows/calendar").json()["holidays"]}["2027-04-22"]["kind"] == "holiday"


def test_the_list_needs_a_visible_door_or_the_manage_permission(pw):
    pw.bind("v", "kiosk")
    assert pw.get("/doors/windows/calendar", "v").status_code == 403


# ---------------------------------------------------------------- the compile on the generated days

def compiled(rule, today=D(2027, 4, 18), policy_cal=None):
    cal = policy_cal or special_days.day_types("israel", today, today + dt.timedelta(days=dw.HORIZON_DAYS))
    return dw.compile_door([rule], DOOR, cal, today)


def test_a_holiday_has_no_window_and_its_eve_is_a_friday():
    c = compiled(sunday_to_thursday())
    assert c.errors == []
    assert c.exceptions["2027-04-22"] == [] and c.exceptions["2027-04-21"] == [], "Pesach (Thursday) is skipped; its eve (Wednesday) uses Friday - and this rule has no Friday"
    assert "2027-04-20" not in c.exceptions and "2027-04-25" not in c.exceptions
    days = {p.start_at.astimezone(dt.timezone(dt.timedelta(hours=3))).date().isoformat() for p in dw.plan(c, D(2027, 4, 17), 9)}
    assert days == {"2027-04-18", "2027-04-19", "2027-04-20", "2027-04-25"}


def test_holidays_like_friday_and_ignore_calendar():
    rule = dw.RuleDoc("r2", "שישי", "weekly", "enabled", "holidays_like_friday", (("e", 1),),
                      (dw.Period(4, None, "08:00", "11:00"), dw.Period(5, None, "08:00", "10:00")))
    c = compiled(rule)
    assert [(s, e) for s, e, _ in c.exceptions["2027-04-22"]] == [(8 * 60, 10 * 60)], "a holiday takes Friday's hours"
    assert [(s, e) for s, e, _ in c.exceptions["2027-04-21"]] == [(8 * 60, 10 * 60)], "so does its eve"
    ignoring = dw.RuleDoc("r3", "רגיל", "weekly", "enabled", "ignore_calendar", (("e", 1),), (dw.Period(4, None, "08:00", "11:00"),))
    assert compiled(ignoring).exceptions == {}, "the calendar is ignored: every day is a regular day"


def test_a_closed_day_drops_every_window_and_a_regular_override_restores_it():
    cal = special_days.day_types("israel", D(2027, 4, 18), D(2027, 5, 31))
    cal["2027-04-20"] = "closed"
    cal["2027-04-22"] = "regular"
    c = dw.compile_door([sunday_to_thursday()], DOOR, cal, D(2027, 4, 18))
    assert c.exceptions["2027-04-20"] == [] and "2027-04-22" not in c.exceptions


def test_the_program_with_a_year_of_holidays_fits_the_caps():
    c = compiled(sunday_to_thursday(), today=D(2026, 11, 2))
    assert c.errors == [] and 8 <= len(c.exceptions) <= dw.MAX_EXCEPTIONS
    assert len(json.dumps(c.policy, ensure_ascii=False).encode("utf-8")) < 32 * 1024, "far below WisKey's 64 KiB message cap (T14)"
    assert c.sha and c.sha == dw.policy_sha(c.policy)


# ---------------------------------------------------------------- end to end on a Pesach week

def test_the_pesach_week_is_planned_and_written_to_the_engine(settings, monkeypatch):
    world = DoorwinWorld(start=dt.datetime(2027, 4, 18, 5, 0, tzinfo=UTC))      # Sunday 08:00 local (UTC+3 after 26.3)
    p = ProductWorld(settings, monkeypatch, world=world)
    p.windows_on()
    assert p.rule(periods=[{"weekday": d, "start": "08:00", "end": "11:00"} for d in range(0, 5)], enable=True).status_code == 201
    p.sync()
    starts = sorted(o["start_at"][:10] for o in p.occurrences(station_id=p.ENTRY) if o["state"] != "cancelled")
    assert starts == ["2027-04-18", "2027-04-19", "2027-04-20", "2027-04-25"], "no occurrence on the holiday (Thu 22) nor on its eve (Wed 21, a Friday)"
    prog = world.programs.program(p.ENTRY, 1)
    ex = {h["start"]: h["periods"] for h in prog["policy"]["schedule"]["holidays"]}
    assert ex["2027-04-22"] == [] and ex["2027-04-21"] == [], "the engine carries the exception: a holiday is honoured even if Arx is down that day"
    p.put("/doors/windows/calendar", days=[{"on_date": "2027-04-22", "day_type": "regular"}], confirmed=True)
    p.sync()
    assert "2027-04-22" in {o["start_at"][:10] for o in p.occurrences(station_id=p.ENTRY) if o["state"] != "cancelled"}, "the manager re-opened the day"
