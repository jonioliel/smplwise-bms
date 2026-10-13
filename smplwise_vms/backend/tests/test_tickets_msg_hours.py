"""CR-038 D4 / D28 / D29: vendor send hours with a fake clock, incl. DST days, and the urgent quiet-hours rule."""
from __future__ import annotations

import datetime as dt
import random
from zoneinfo import ZoneInfo

import pytest

from smplwise.services.tickets import hours

UTC = dt.timezone.utc
TZ = ZoneInfo("Asia/Jerusalem")
NY = ZoneInfo("America/New_York")
W = hours.parse_window({"from": "07:00", "to": "21:00"})


def local(y, m, d, hh, mm, tz=TZ):
    return dt.datetime(y, m, d, hh, mm, tzinfo=tz).astimezone(UTC)


@pytest.mark.parametrize("doc,code", [
    ({"from": "21:00", "to": "07:00"}, "window_across_midnight"), ({"from": "08:00", "to": "08:00"}, "window_empty"),
    ({"from": "7:00", "to": "21:00"}, "window_invalid"), ({"from": "24:00", "to": "21:00"}, "window_invalid"),
    ({"to": "21:00"}, "window_invalid"), ("not json", "window_invalid"), (None, "window_invalid")])
def test_window_validation(doc, code):
    with pytest.raises(hours.WindowError) as e:
        hours.parse_window(doc)
    assert e.value.code == code


def test_effective_window_prefers_a_valid_department_override():
    assert hours.effective_window({"from": "07:00", "to": "21:00"}, '{"from":"08:30","to":"17:00"}').as_doc() == {"from": "08:30", "to": "17:00"}
    assert hours.effective_window({"from": "06:00", "to": "22:00"}, {"from": "22:00", "to": "06:00"}).as_doc() == {"from": "06:00", "to": "22:00"}
    assert hours.effective_window("garbage", None).as_doc() == hours.DEFAULT_WINDOW


def test_inside_and_outside_the_window():
    assert hours.in_window(local(2026, 10, 13, 7, 0), W, TZ)
    assert hours.in_window(local(2026, 10, 13, 20, 59), W, TZ)
    assert not hours.in_window(local(2026, 10, 13, 21, 0), W, TZ)  # end exclusive
    assert not hours.in_window(local(2026, 10, 13, 6, 59), W, TZ)


def test_next_opening_tonight_and_early_morning():
    assert hours.next_opening(local(2026, 10, 13, 23, 30), W, TZ) == local(2026, 10, 14, 7, 0)
    assert hours.next_opening(local(2026, 10, 14, 2, 0), W, TZ) == local(2026, 10, 14, 7, 0)
    noon = local(2026, 10, 14, 12, 0)
    assert hours.next_opening(noon, W, TZ) == noon


def test_dst_days_use_the_zone_rules():
    # Israel: summer time ends on Sunday 2026-10-25 (02:00 -> 01:00) and starts on Friday 2026-03-27 (02:00 -> 03:00)
    assert hours.next_opening(local(2026, 10, 24, 22, 0), W, TZ) == dt.datetime(2026, 10, 25, 5, 0, tzinfo=UTC)  # 07:00 +02
    assert hours.next_opening(local(2026, 10, 23, 22, 0), W, TZ) == dt.datetime(2026, 10, 24, 4, 0, tzinfo=UTC)  # 07:00 +03
    assert hours.next_opening(local(2026, 3, 26, 22, 0), W, TZ) == dt.datetime(2026, 3, 27, 4, 0, tzinfo=UTC)  # after the jump
    # a window that opens inside the spring-forward gap opens at the end of the gap (03:00 local)
    gap = hours.parse_window({"from": "02:30", "to": "05:00"})
    opening = hours.next_opening(dt.datetime(2026, 3, 26, 22, 0, tzinfo=UTC), gap, TZ)
    assert opening == dt.datetime(2026, 3, 27, 0, 0, tzinfo=UTC) and opening.astimezone(TZ).strftime("%H:%M") == "03:00"
    # New York: 2026-11-01 02:00 -> 01:00; a 01:30 opening is the FIRST 01:30
    ny = hours.parse_window({"from": "01:30", "to": "03:00"})
    assert hours.next_opening(dt.datetime(2026, 11, 1, 4, 0, tzinfo=UTC), ny, NY) == dt.datetime(2026, 11, 1, 5, 30, tzinfo=UTC)


@pytest.mark.parametrize("purpose,held", [
    ("assign", True), ("reminder", True), ("closed", True), ("reassigned", True), ("reopened", True), ("update", True),
    ("cost_rejected", True), ("unknown_purpose", True), ("code", False), ("test", False)])
def test_who_waits_for_the_morning(purpose, held):
    night = local(2026, 10, 13, 23, 0)
    d = hours.decide(purpose, night, W, TZ)
    assert d.send is (not held)
    assert d.not_before == (local(2026, 10, 14, 7, 0) if held else night)


def test_send_now_releases_any_held_purpose():
    night = local(2026, 10, 13, 23, 0)
    assert hours.decide("assign", night, W, TZ, send_now=True).send
    assert hours.decide("reminder", night, W, TZ, send_now=True).send


def test_critical_priorities_still_wait_for_vendors_but_send_now_is_preselected():
    assert hours.default_send_now("critical") and not hours.default_send_now("alert")
    assert not hours.decide("reminder", local(2026, 10, 13, 2, 0), W, TZ).send  # review T21: also for critical


@pytest.mark.parametrize("inst,dept,expected", [(True, None, True), (False, None, False), (None, None, True), (True, 0, False),
                                                (False, 1, True), ("junk", None, True)])
def test_urgent_is_critical(inst, dept, expected):
    assert hours.urgent_is_critical(inst, dept) is expected


def test_signal_severity_caps_critical_only_when_off():
    assert hours.signal_severity("critical", True) == "critical"
    assert hours.signal_severity("critical", False) == "alert"
    assert hours.signal_severity("info", False) == "info"
    assert hours.signal_severity("weird", True) == "alert"


def test_property_next_opening_is_the_first_instant_inside():
    rng = random.Random(4)
    for _ in range(400):
        a, b = sorted(rng.sample(range(0, 24 * 60, 15), 2))
        window = hours.parse_window({"from": f"{a // 60:02d}:{a % 60:02d}", "to": f"{b // 60:02d}:{b % 60:02d}"})
        tz = rng.choice([TZ, NY, ZoneInfo("Europe/Moscow")])
        now = dt.datetime(2026, 1, 1, tzinfo=UTC) + dt.timedelta(minutes=rng.randrange(0, 365 * 24 * 60))
        opening = hours.next_opening(now, window, tz)
        assert opening >= now and hours.in_window(opening, window, tz)
        if opening > now:
            assert not hours.in_window(opening - dt.timedelta(seconds=1), window, tz) or opening - dt.timedelta(seconds=1) < now
            assert opening - now <= dt.timedelta(days=1, hours=1)
