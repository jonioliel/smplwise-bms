"""CALENDARS-298 phase 1 (section 4): the recurrence expander - pure, no database. Golden expansions over DST, ordinals, last day, COUNT vs UNTIL,
EXDATE and holiday skips, the unsupported subset and the 2000 cap."""
from __future__ import annotations

import datetime as dt

import pytest

from smplwise.services.calendar.recurrence import RuleError, expand, parse_rule, series_end

UTC = dt.timezone.utc
W0 = dt.datetime(2026, 1, 1, tzinfo=UTC)
W1 = dt.datetime(2028, 1, 1, tzinfo=UTC)


def occs(rule, start, end, tz="Asia/Jerusalem", **kw):
    return expand(parse_rule(rule) if rule else None, dt.datetime.fromisoformat(start), dt.datetime.fromisoformat(end), tz, window_start=kw.pop("w0", W0), window_end=kw.pop("w1", W1), **kw)


def test_single_entry_is_one_occurrence():
    o = occs(None, "2026-11-03T18:00", "2026-11-03T20:00")
    assert len(o) == 1 and o[0].start_utc == dt.datetime(2026, 11, 3, 16, 0, tzinfo=UTC)


def test_weekly_tuesday_stays_18_00_across_the_autumn_change():
    # Israel leaves summer time on 2026-10-25: 18:00 local is 15:00Z before it and 16:00Z after it
    o = occs("FREQ=WEEKLY;BYDAY=TU;COUNT=3", "2026-10-20T18:00", "2026-10-20T20:00")
    assert [x.start_utc.hour for x in o] == [15, 16, 16]
    assert all(x.local_start.hour == 18 for x in o)


def test_london_autumn_change():
    o = occs("FREQ=WEEKLY;BYDAY=SU;COUNT=2", "2026-10-18T10:00", "2026-10-18T11:00", tz="Europe/London")
    assert [x.start_utc.hour for x in o] == [9, 10]  # BST (UTC+1) then GMT on 2026-10-25


def test_spring_forward_gap_resolves_to_first_instant_after_the_gap():
    # Israel 2027-03-26: 02:00 -> 03:00; a Friday 02:30 class has no 02:30, it starts at the end of the gap
    o = occs("FREQ=WEEKLY;BYDAY=FR;COUNT=2", "2027-03-19T02:30", "2027-03-19T03:30")
    assert o[0].start_utc == dt.datetime(2027, 3, 19, 0, 30, tzinfo=UTC)
    assert o[1].start_utc == dt.datetime(2027, 3, 26, 0, 0, tzinfo=UTC)  # 03:00 local = 00:00Z


def test_monthly_ordinal_and_last_friday():
    second_tue = occs("FREQ=MONTHLY;BYDAY=2TU;COUNT=3", "2026-11-10T09:00", "2026-11-10T10:00")
    assert [x.local_start.date().isoformat() for x in second_tue] == ["2026-11-10", "2026-12-08", "2027-01-12"]
    last_fri = occs("FREQ=MONTHLY;BYDAY=-1FR;COUNT=3", "2026-11-27T09:00", "2026-11-27T10:00")
    assert [x.local_start.date().isoformat() for x in last_fri] == ["2026-11-27", "2026-12-25", "2027-01-29"]


def test_monthly_31st_skips_short_months_and_minus_one_is_the_last_day():
    o = occs("FREQ=MONTHLY;BYMONTHDAY=31;COUNT=4", "2026-10-31T09:00", "2026-10-31T10:00")
    assert [x.local_start.date().isoformat() for x in o] == ["2026-10-31", "2026-12-31", "2027-01-31", "2027-03-31"]
    last = occs("FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3", "2026-11-30T09:00", "2026-11-30T10:00")
    assert [x.local_start.date().isoformat() for x in last] == ["2026-11-30", "2026-12-31", "2027-01-31"]


def test_count_and_until_and_interval():
    assert len(occs("FREQ=DAILY;COUNT=5", "2026-11-01T09:00", "2026-11-01T10:00")) == 5
    u = occs("FREQ=DAILY;UNTIL=20261105", "2026-11-01T09:00", "2026-11-01T10:00")
    assert u[-1].local_start.date().isoformat() == "2026-11-05" and len(u) == 5  # UNTIL is inclusive
    every_other = occs("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=3", "2026-11-02T09:00", "2026-11-02T10:00")
    assert [x.local_start.date().isoformat() for x in every_other] == ["2026-11-02", "2026-11-16", "2026-11-30"]


def test_yearly_and_leap_day():
    y = occs("FREQ=YEARLY;COUNT=2", "2026-11-05T09:00", "2026-11-05T10:00")
    assert [x.local_start.year for x in y] == [2026, 2027]
    leap = occs("FREQ=YEARLY;COUNT=2", "2028-02-29T09:00", "2028-02-29T10:00", w1=dt.datetime(2040, 1, 1, tzinfo=UTC))
    assert [x.local_start.year for x in leap] == [2028, 2032]


def test_exdates_and_holiday_skip_do_not_reduce_count():
    o = occs("FREQ=DAILY;COUNT=4", "2026-11-01T09:00", "2026-11-01T10:00", exdates={"2026-11-02T09:00"})
    assert [x.local_start.day for x in o] == [1, 3, 4]  # COUNT=4 means the 4th occurrence is Nov 4, EXDATE or not
    o = occs("FREQ=DAILY;COUNT=3", "2026-11-01T09:00", "2026-11-01T10:00", holidays={dt.date(2026, 11, 1)})
    assert [x.local_start.day for x in o] == [2, 3]


def test_window_clips_an_open_series():
    o = occs("FREQ=DAILY", "2026-11-01T09:00", "2026-11-01T10:00", w0=dt.datetime(2026, 11, 10, tzinfo=UTC), w1=dt.datetime(2026, 11, 13, tzinfo=UTC))
    assert [x.local_start.day for x in o] == [10, 11, 12]


def test_wall_clock_duration_over_a_change_night():
    o = occs("FREQ=WEEKLY;BYDAY=SA;COUNT=2", "2026-10-24T22:00", "2026-10-25T03:00")  # Saturday night into the change at 01:00 -> 00:00
    assert (o[0].end_utc - o[0].start_utc) == dt.timedelta(hours=6)  # 22:00 -> 03:00 wall clock, one real hour longer


@pytest.mark.parametrize("rule", ["FREQ=HOURLY", "FREQ=DAILY;BYHOUR=3", "FREQ=WEEKLY;BYSETPOS=1", "FREQ=DAILY;COUNT=2;UNTIL=20261231", "FREQ=DAILY;INTERVAL=0",
                                  "FREQ=DAILY;COUNT=501", "FREQ=MONTHLY;BYDAY=TU", "FREQ=DAILY;BYDAY=MO", "", "FREQ=WEEKLY;RDATE=20261201"])
def test_unsupported_rules_are_refused(rule):
    with pytest.raises(RuleError) as e:
        parse_rule(rule)
    assert e.value.code == "rrule_unsupported"


def test_series_too_large():
    with pytest.raises(RuleError) as e:
        occs("FREQ=DAILY", "2026-01-01T09:00", "2026-01-01T10:00", w1=dt.datetime(2036, 1, 1, tzinfo=UTC))
    assert e.value.code == "series_too_large"


def test_series_end_of_a_closed_series_and_none_for_an_open_one():
    end = series_end(parse_rule("FREQ=WEEKLY;BYDAY=TU;COUNT=3"), dt.datetime(2026, 11, 3, 18), dt.datetime(2026, 11, 3, 20), "Asia/Jerusalem", 400)
    assert end == dt.datetime(2026, 11, 17, 18, 0, tzinfo=UTC)
    assert series_end(parse_rule("FREQ=DAILY"), dt.datetime(2026, 11, 3, 18), dt.datetime(2026, 11, 3, 20), "Asia/Jerusalem", 400) is None
