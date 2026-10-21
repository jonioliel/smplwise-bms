"""DOORWIN-295 (CR-039 4.3, 4.5, 5.4): the compile of door windows - rules -> one WisKey program per door -> occurrences.

Pure functions, no database, no app. The W0 fake's `policy_code` (WisKey's validation as Arx understands it) and `window_token` (WisKey's
executor's window test) are the oracles: every compiled program must be one WisKey accepts, and every occurrence must be exactly the
interval in which WisKey's executor holds the door - including on the Israeli DST change days of 2026 / 2027."""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

import pytest
from fake_doorwin_program import policy_code, window_token

from smplwise.errors import ApiError
from smplwise.services import door_windows as dw

UTC = dt.timezone.utc
TZ = ZoneInfo("Asia/Jerusalem")
DOOR = dw.Door("st-entry", 1, "כניסה", "לובי", "Asia/Jerusalem")
TODAY = dt.date(2026, 11, 2)  # a Monday


def rule(rid: str, periods: list[tuple], *, kind: str = "weekly", policy: str = "skip_holidays", doors=(("st-entry", 1),)) -> dw.RuleDoc:
    ps = tuple(dw.Period(p[0], None, p[1], p[2]) if kind == "weekly" else dw.Period(None, p[0], p[1], p[2]) for p in periods)
    return dw.RuleDoc(rid, rid, kind, "enabled", policy, tuple(doors), ps)


def body(**over):
    b = {"name": "בוקר", "kind": "weekly", "doors": [{"station_id": "st-entry", "relay": 1}], "periods": [{"weekday": 1, "start": "08:00", "end": "11:00"}]}
    b.update(over)
    return b


def validate(b, **kw):
    args = {"max_hours": 4, "max_per_day": 3, "quiet": ("22:00", "06:00"), "today": TODAY} | kw
    return dw.validate_rule(b, **args)


# ---------------------------------------------------------------- validation (SR-2 and the limits)

def test_a_valid_weekly_body_is_accepted():
    name, kind, policy, notes, doors, periods = validate(body())
    assert (name, kind, policy, doors) == ("בוקר", "weekly", "skip_holidays", [("st-entry", 1)])
    assert periods == [dw.Period(1, None, "08:00", "11:00")]


@pytest.mark.parametrize("over, code", [
    ({"periods": [{"weekday": 1, "start": "11:00", "end": "08:00"}]}, "invalid_time"),       # SR-2: no overnight period, end > start
    ({"periods": [{"weekday": 1, "start": "08:00", "end": "08:00"}]}, "invalid_time"),
    ({"periods": [{"weekday": 1, "start": "08:00", "end": "13:00"}]}, "window_too_long"),     # max_hours 4
    ({"periods": [{"weekday": 1, "start": "05:00", "end": "07:00"}]}, "quiet_hours"),         # touches 22:00-06:00
    ({"periods": [{"weekday": 1, "start": "21:00", "end": "23:00"}]}, "quiet_hours"),
    ({"periods": [{"weekday": 1, "start": "08:00", "end": "10:00"}, {"weekday": 1, "start": "09:00", "end": "11:00"}]}, "overlap"),
    ({"periods": [{"weekday": 7, "start": "08:00", "end": "10:00"}]}, "invalid_weekday"),
    ({"periods": [{"weekday": 1, "start": "8:00", "end": "10:00"}]}, "invalid_time"),
    ({"periods": [{"weekday": d, "start": h, "end": e} for d in [1] for h, e in (("07:00", "08:00"), ("09:00", "10:00"), ("11:00", "12:00"), ("13:00", "14:00"))]}, "too_many_per_day"),
    ({"kind": "once", "periods": [{"on_date": "2026-11-01", "start": "08:00", "end": "10:00"}]}, "invalid_date"),   # yesterday
    ({"kind": "once", "periods": [{"on_date": "2026-02-30", "start": "08:00", "end": "10:00"}]}, "invalid_date"),
    ({"doors": []}, "invalid_doors"),
    ({"doors": [{"station_id": "st-entry", "relay": 1}, {"station_id": "st-entry", "relay": 1}]}, "invalid_doors"),
    ({"doors": [{"station_id": "st-entry", "relay": True}]}, "invalid_doors"),
    ({"name": "  "}, "invalid_name"),
    ({"name": "x" * 61}, "invalid_name"),
    ({"kind": "event"}, "invalid_kind"),  # CR-039 9 is not built: an event rule cannot be saved
    ({"periods": []}, "invalid_periods"),
])
def test_invalid_bodies_are_refused_with_a_code(over, code):
    with pytest.raises(ApiError) as e:
        validate(body(**over))
    assert e.value.status == 422 and e.value.code == code


def test_quiet_hours_that_do_not_wrap_midnight():
    with pytest.raises(ApiError):
        validate(body(periods=[{"weekday": 1, "start": "12:00", "end": "14:00"}]), quiet=("13:00", "15:00"))
    validate(body(periods=[{"weekday": 1, "start": "10:00", "end": "13:00"}]), quiet=("13:00", "15:00"))  # touching the edge is allowed


# ---------------------------------------------------------------- the union and the program document

def test_overlapping_and_touching_periods_become_one_hold():
    assert dw.merge([(480, 600, "a"), (540, 660, "b"), (660, 700, "c"), (800, 900, "a")]) == [(480, 700, ("a", "b", "c")), (800, 900, ("a",))]


def test_two_rules_on_one_door_compile_into_one_program_wiskey_accepts():
    c = dw.compile_door([rule("r1", [(1, "08:00", "10:00")]), rule("r2", [(1, "09:30", "11:00"), (3, "12:00", "13:00")])], DOOR, {}, TODAY)
    assert c.errors == [] and policy_code(c.policy) is None
    sched = c.policy["schedule"]
    assert sched["name"].startswith("Arx ") and len(sched["name"]) <= 32
    assert sched["weekly"]["Monday"] == [{"start": "08:00", "end": "11:00"}]  # sun0 1 = Monday
    assert sched["weekly"]["Wednesday"] == [{"start": "12:00", "end": "13:00"}]
    assert sched["weekly"]["Sunday"] == [] and sched["holidays"] == []
    assert c.policy["timezone"] == "Asia/Jerusalem"


def test_a_rule_for_another_door_is_not_compiled_into_this_one():
    c = dw.compile_door([rule("r1", [(1, "08:00", "10:00")], doors=(("st-side", 1),))], DOOR, {}, TODAY)
    assert c.policy is None and c.sha is None


def test_the_compile_is_deterministic_so_an_unchanged_program_is_never_written_twice():
    rules = [rule("r1", [(1, "08:00", "10:00"), (2, "08:00", "10:00")])]
    assert dw.compile_door(rules, DOOR, {}, TODAY).sha == dw.compile_door(list(rules), DOOR, {}, TODAY).sha
    assert dw.compile_door(rules, DOOR, {"2026-11-10": "holiday"}, TODAY).sha != dw.compile_door(rules, DOOR, {}, TODAY).sha


def test_a_one_off_window_is_a_date_exception_that_keeps_the_weekly_periods_of_that_day():
    rules = [rule("r1", [(1, "08:00", "10:00")]), rule("o1", [("2026-11-09", "12:00", "14:00")], kind="once")]
    c = dw.compile_door(rules, DOOR, {}, TODAY)
    assert policy_code(c.policy) is None
    assert c.policy["schedule"]["holidays"] == [{"name": "Arx one-off", "start": "2026-11-09", "end": "2026-11-09",
                                                 "periods": [{"start": "08:00", "end": "10:00"}, {"start": "12:00", "end": "14:00"}]}]


@pytest.mark.parametrize("policy, day_type, expected", [
    ("skip_holidays", "holiday", []),
    ("holidays_like_friday", "holiday", [{"start": "09:00", "end": "10:00"}]),
    ("ignore_calendar", "holiday", None),                      # same as the weekday: no exception at all
    ("skip_holidays", "holiday_eve", [{"start": "09:00", "end": "10:00"}]),  # a holiday eve is a Friday
    ("ignore_calendar", "holiday_eve", None),
    ("ignore_calendar", "closed", []),                         # closed drops every window of every rule
    ("skip_holidays", "regular", None),
])
def test_calendar_policies(policy, day_type, expected):
    r = rule("r1", [(2, "08:00", "11:00"), (5, "09:00", "10:00")], policy=policy)  # Tuesday 08-11, Friday 09-10
    c = dw.compile_door([r], DOOR, {"2026-11-10": day_type}, TODAY)  # 2026-11-10 is a Tuesday
    exc = {h["start"]: h["periods"] for h in c.policy["schedule"]["holidays"]}
    if expected is None:
        assert "2026-11-10" not in exc
    else:
        assert exc["2026-11-10"] == expected
    assert policy_code(c.policy) is None


def test_a_closed_day_also_drops_a_one_off_window():
    c = dw.compile_door([rule("o1", [("2026-11-10", "12:00", "14:00")], kind="once")], DOOR, {"2026-11-10": "closed"}, TODAY)
    assert c.policy["schedule"]["holidays"] == [] or all(h["periods"] == [] for h in c.policy["schedule"]["holidays"])


def test_the_union_may_not_exceed_the_per_day_cap():
    rules = [rule(f"r{i}", [(1, f"{8 + i:02d}:00", f"{8 + i:02d}:30")]) for i in range(4)]
    c = dw.compile_door(rules, DOOR, {}, TODAY, max_per_day=3)
    assert c.errors == ["too_many_per_day"] and c.policy is None


def test_past_and_far_calendar_days_are_not_compiled():
    c = dw.compile_door([rule("r1", [(2, "08:00", "11:00")])], DOOR, {"2026-11-01": "holiday", "2028-12-31": "holiday"}, TODAY)
    assert c.policy["schedule"]["holidays"] == []


# ---------------------------------------------------------------- occurrences = WisKey's window token, DST included

def _inside(occ: dw.Planned, policy: dict, step_min: int = 7) -> None:
    """Every sampled instant of the occurrence is inside the token's window, and the instants just outside are not."""
    t = occ.start_at
    while t < occ.end_at:
        assert window_token(policy, t) == occ.token, (t, occ)
        t += dt.timedelta(minutes=step_min)
    assert window_token(policy, occ.end_at) != occ.token
    assert window_token(policy, occ.start_at - dt.timedelta(minutes=1)) != occ.token


def test_occurrences_on_a_normal_day_match_the_executor():
    c = dw.compile_door([rule("r1", [(1, "08:00", "11:00"), (1, "14:00", "24:00")])], DOOR, {}, TODAY)
    occ = dw.plan(c, TODAY, 1)
    assert [(o.start_at, o.end_at, o.token) for o in occ] == [
        (dt.datetime(2026, 11, 2, 6, 0, tzinfo=UTC), dt.datetime(2026, 11, 2, 9, 0, tzinfo=UTC), "2026-11-02/08:00/11:00"),
        (dt.datetime(2026, 11, 2, 12, 0, tzinfo=UTC), dt.datetime(2026, 11, 2, 22, 0, tzinfo=UTC), "2026-11-02/14:00/24:00")]
    for o in occ:
        _inside(o, c.policy)


def test_spring_forward_a_window_partly_in_the_gap_is_held_for_the_part_that_exists():
    # Israel 2027: 02:00 -> 03:00 on Friday 26 March. A 01:30-02:30 window exists from 01:30 (+02) to the jump (00:00 UTC).
    day = dt.date(2027, 3, 26)
    c = dw.compile_door([rule("r1", [(5, "01:30", "02:30")])], DOOR, {}, day)
    (o,) = dw.plan(c, day, 1)
    assert o.start_at == dt.datetime(2027, 3, 25, 23, 30, tzinfo=UTC) and o.end_at == dt.datetime(2027, 3, 26, 0, 0, tzinfo=UTC)
    _inside(o, c.policy, step_min=1)


def test_spring_forward_a_window_wholly_in_the_gap_does_not_exist():
    day = dt.date(2027, 3, 26)
    c = dw.compile_door([rule("r1", [(5, "02:10", "02:50")])], DOOR, {}, day)
    assert dw.plan(c, day, 1) == []
    t = dt.datetime(2027, 3, 25, 23, 0, tzinfo=UTC)
    while t < dt.datetime(2027, 3, 26, 2, 0, tzinfo=UTC):  # the executor never holds it either
        assert window_token(c.policy, t) is None
        t += dt.timedelta(minutes=1)


def test_fall_back_a_window_across_the_repeated_hour_is_one_occurrence():
    # Israel 2026: 02:00 -> 01:00 on Sunday 25 October. 01:30-02:30 runs from the FIRST 01:30 (+03) to 02:30 (+02): one token, one hold.
    day = dt.date(2026, 10, 25)
    c = dw.compile_door([rule("r1", [(0, "01:30", "02:30")])], DOOR, {}, day)
    (o,) = dw.plan(c, day, 1)
    assert o.start_at == dt.datetime(2026, 10, 24, 22, 30, tzinfo=UTC) and o.end_at == dt.datetime(2026, 10, 25, 0, 30, tzinfo=UTC)
    assert o.token == "2026-10-25/01:30/02:30"
    # the executor's token is the same string wherever it holds inside the occurrence (it is not held during the repeated 01:00-01:29)
    t = o.start_at
    while t < o.end_at:
        assert window_token(c.policy, t) in (o.token, None)
        t += dt.timedelta(minutes=1)
    assert window_token(c.policy, o.end_at) is None


def test_no_fixed_offsets_the_same_wall_window_moves_in_utc_across_the_change():
    before, after = dt.date(2026, 10, 19), dt.date(2026, 10, 26)  # Mondays around 25 October 2026
    c = dw.compile_door([rule("r1", [(1, "08:00", "11:00")])], DOOR, {}, before)
    (a,), (b,) = dw.plan(c, before, 1), dw.plan(c, after, 1)
    assert a.start_at.hour == 5 and b.start_at.hour == 6  # 08:00 is 05:00 UTC in summer, 06:00 UTC in winter


def test_wall_instant_of_24_00_is_the_next_local_midnight():
    assert dw.wall_instant(dt.date(2026, 11, 2), "24:00", TZ) == dt.datetime(2026, 11, 2, 22, 0, tzinfo=UTC)


def test_a_station_in_another_zone_compiles_in_its_own_zone():
    door = dw.Door("st-x", 1, "x", "", "Europe/London")
    c = dw.compile_door([rule("r1", [(1, "08:00", "09:00")], doors=(("st-x", 1),))], door, {}, TODAY)
    (o,) = dw.plan(c, TODAY, 1)
    assert c.policy["timezone"] == "Europe/London" and o.start_at == dt.datetime(2026, 11, 2, 8, 0, tzinfo=UTC)


def test_a_compiled_year_of_exceptions_stays_far_below_the_message_cap():
    import json

    cal = {(TODAY + dt.timedelta(days=i * 6)).isoformat(): "holiday" for i in range(60)}
    rules = [rule(f"r{d}", [(d, "08:00", "09:00"), (d, "10:00", "11:00"), (d, "12:00", "13:00")]) for d in range(7)]
    c = dw.compile_door(rules, DOOR, cal, TODAY)
    assert c.errors == [] and policy_code(c.policy) is None
    assert len(json.dumps(c.policy)) < 64 * 1024 // 4
