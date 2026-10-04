"""CR-025 P3: the Provision-ISR device wall clock <-> UTC (services/recorders/provision_time.py). The owner's NVR reports
`IST-2IDT,M3.5.5/2,M10.5.0/2` (live 2026-10-04); Israel's DST runs from the Friday before the last Sunday of March 02:00 to
the last Sunday of October 02:00."""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

import pytest

from smplwise.services.recorders import provision_time as pt

RULE = "IST-2IDT,M3.5.5/2,M10.5.0/2"
UTC = dt.timezone.utc
JLM = ZoneInfo("Asia/Jerusalem")


@pytest.fixture()
def tz() -> pt.PosixTz:
    return pt.PosixTz(RULE)


def u(*a: int) -> dt.datetime:
    return dt.datetime(*a, tzinfo=UTC)


def test_rule_parses_and_matches_israel_all_of_2026(tz):
    assert tz.std_offset == dt.timedelta(hours=2) and tz.dst_offset == dt.timedelta(hours=3)
    assert tz.transitions(2026) == (dt.datetime(2026, 3, 27, 2, 0), dt.datetime(2026, 10, 25, 2, 0))
    t = u(2026, 1, 1)
    while t.year == 2026:  # every 20 minutes of the year: same wall clock and fold as the IANA zone, and back again
        mine, ref = t.astimezone(tz), t.astimezone(JLM)
        assert (mine.replace(tzinfo=None), mine.fold) == (ref.replace(tzinfo=None), ref.fold), t
        assert pt.wall_to_utc(mine.replace(tzinfo=None), tz, mine.fold) == t
        t += dt.timedelta(minutes=20)


def test_spring_forward_gap_is_missing_and_shifted_forward(tz):
    gap = dt.datetime(2026, 3, 27, 2, 30)
    assert pt.is_missing(gap, tz) and not pt.is_ambiguous(gap, tz)
    assert pt.wall_to_utc(gap, tz) == u(2026, 3, 27, 0, 30), "read with the offset before the change = 03:30 IDT"
    assert pt.wall_to_utc("2026-03-27 01:59:59", tz) == u(2026, 3, 26, 23, 59, 59)
    assert pt.wall_to_utc("2026-03-27 03:00:00", tz) == u(2026, 3, 27, 0, 0)
    assert pt.utc_to_wall(u(2026, 3, 27, 0, 0), tz) == dt.datetime(2026, 3, 27, 3, 0)


def test_fall_back_hour_is_ambiguous_both_ways(tz):
    rep = dt.datetime(2026, 10, 25, 1, 30)
    assert pt.is_ambiguous(rep, tz) and not pt.is_missing(rep, tz)
    assert pt.wall_to_utc(rep, tz, 0) == u(2026, 10, 24, 22, 30), "first pass, IDT"
    assert pt.wall_to_utc(rep, tz, 1) == u(2026, 10, 24, 23, 30), "second pass, IST"
    first, second = u(2026, 10, 24, 22, 30).astimezone(tz), u(2026, 10, 24, 23, 30).astimezone(tz)
    assert first.replace(tzinfo=None) == second.replace(tzinfo=None) == rep and (first.fold, second.fold) == (0, 1)


def test_device_rule_and_iana_differ_in_2028_and_the_device_rule_wins(tz):
    """Last Sunday of March 2028 is the 26th: Israel moves on Friday the 24th, the device rule (last Friday) on the 31st.
    A recording the device stamped `2028-03-28 12:00:00` happened at 10:00 UTC (device still on IST), not 09:00."""
    periods = pt.divergence(tz, JLM, 2028)
    assert [(a.date(), b.date()) for a, b in periods] == [(dt.date(2028, 3, 24), dt.date(2028, 3, 31))]
    assert pt.divergence(tz, JLM, 2026) == [] and pt.divergence(tz, JLM, 2027) == []
    assert pt.wall_to_utc("2028-03-28 12:00:00", tz) == u(2028, 3, 28, 10, 0)
    assert pt.wall_to_utc("2028-03-28 12:00:00", JLM) == u(2028, 3, 28, 9, 0)


def test_device_zone_sources():
    tz, src = pt.device_zone(RULE, True, "Asia/Jerusalem")
    assert src == "device" and isinstance(tz, pt.PosixTz)
    tz, src = pt.device_zone(RULE, False, "Asia/Jerusalem")
    assert src == "device_std" and u(2026, 7, 1).astimezone(tz).utcoffset() == dt.timedelta(hours=2)
    assert pt.device_zone("garbage!!", True, "Asia/Jerusalem")[1] == "iana"
    assert pt.device_zone(None, None, "Europe/London")[1] == "iana"
    assert pt.device_zone("UTC0", True, None)[0].utcoffset(dt.datetime(2026, 1, 1)) == dt.timedelta(0)


@pytest.mark.parametrize("spec,when,offset_h", [
    ("EST5EDT,M3.2.0,M11.1.0", dt.datetime(2026, 7, 1, 12), -4),
    ("EST5EDT,M3.2.0,M11.1.0", dt.datetime(2026, 1, 1, 12), -5),
    ("AEST-10AEDT,M10.1.0,M4.1.0/3", dt.datetime(2026, 1, 15, 12), 11),  # southern hemisphere: DST across the new year
    ("AEST-10AEDT,M10.1.0,M4.1.0/3", dt.datetime(2026, 7, 15, 12), 10),
    ("<+0530>-5:30", dt.datetime(2026, 7, 15, 12), 5.5),
    ("CET-1CEST,M3.5.0,M10.5.0/3", dt.datetime(2026, 3, 29, 2, 30), 1),  # gap, fold 0
])
def test_other_posix_rules(spec, when, offset_h):
    assert pt.PosixTz(spec).utcoffset(when) == dt.timedelta(hours=offset_h)


@pytest.mark.parametrize("bad", ["", "IST", "IST-2IDT", "IST-99", "IST-2IDT,M13.5.5,M10.5.0", "IST-2IDT,M3.6.5,M10.5.0", "rm -rf"])
def test_bad_rules_are_refused(bad):
    with pytest.raises(ValueError):
        pt.PosixTz(bad)


def test_parse_wall_accepts_the_live_unpadded_form_and_refuses_junk():
    assert pt.parse_wall("2026-9-19 7:05:03") == dt.datetime(2026, 9, 19, 7, 5, 3)
    assert pt.parse_date("2026-9-19") == dt.date(2026, 9, 19)
    for junk in ("", "2026-10-04", "yesterday", "2026-13-01 00:00:00", "2026-10-04T25:00:00"):
        with pytest.raises(ValueError):
            pt.parse_wall(junk)


def test_wall_window_is_plain_away_from_dst_and_widened_near_it(tz):
    ws, we, widened = pt.wall_window(u(2026, 10, 4, 5, 0), u(2026, 10, 4, 6, 0), tz)
    assert (ws, we, widened) == (dt.datetime(2026, 10, 4, 8, 0), dt.datetime(2026, 10, 4, 9, 0), False)
    # 22:30Z (01:30 IDT) .. 23:10Z (01:10 IST): the plain wall window would be inverted
    ws, we, widened = pt.wall_window(u(2026, 10, 24, 22, 30), u(2026, 10, 24, 23, 10), tz)
    assert widened and ws < we and ws <= dt.datetime(2026, 10, 25, 0, 10) and we >= dt.datetime(2026, 10, 25, 2, 30)


def S(start: str, seconds: int, end: str | None = None) -> pt.Section:
    return pt.Section(start_raw=start, seconds=seconds, rec_type="motion", end_raw=end)


def test_fall_back_sections_are_placed_by_their_device_end_time(tz):
    """v2 shape: the device's own `endtime` decides the pass. 01:50 + 1200 s ends 01:10 wall only on the first pass."""
    first, second = pt.resolve_sections([S("2026-10-25 01:50:00", 1200, "2026-10-25 01:10:00"), S("2026-10-25 01:50:00", 600, "2026-10-25 02:00:00")], tz)
    assert (first.start, first.ambiguous) == (u(2026, 10, 24, 22, 50), False)
    assert (second.start, second.ambiguous) == (u(2026, 10, 24, 23, 50), False)


def test_fall_back_sections_are_placed_by_order_without_end_time(tz):
    """v1 shape (no endtime): a later item never starts before the previous one ended."""
    out = pt.resolve_sections([S("2026-10-25 01:20:00", 1800), S("2026-10-25 01:10:00", 300), S("2026-10-25 02:30:00", 60)], tz)
    assert out[0].start == u(2026, 10, 24, 22, 20) and out[0].ambiguous, "the first in the repeated hour is a guess (earlier pass)"
    assert out[1].start == u(2026, 10, 24, 23, 10) and not out[1].ambiguous, "01:10 after a segment ending 01:50 IDT is the IST pass"
    assert out[2].start == u(2026, 10, 25, 0, 30)
    assert all(b.start >= a.start for a, b in zip(out, out[1:]))


def test_spring_gap_section_is_flagged_shifted_and_duration_is_real_time(tz):
    (sec,) = pt.resolve_sections([S("2026-03-27 01:59:00", 120)], tz)
    assert sec.end - sec.start == dt.timedelta(seconds=120) and not sec.shifted
    assert pt.utc_to_wall(sec.end, tz) == dt.datetime(2026, 3, 27, 3, 1), "two real minutes across the jump end at 03:01 wall"
    (gap,) = pt.resolve_sections([S("2026-03-27 02:15:00", 60)], tz)
    assert gap.shifted and gap.start == u(2026, 3, 27, 0, 15)


def test_malformed_sections_are_dropped(tz):
    assert pt.resolve_sections([S("not a time", 10), S("2026-10-04 10:00:00", -1)], tz) == []
