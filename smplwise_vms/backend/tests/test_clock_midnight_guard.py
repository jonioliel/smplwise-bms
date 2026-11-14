"""SMALLA-295: the helper that keeps a day-counting ticket test away from the installation's midnight (no sleeps, no real wall clock)."""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

import pytest

from smplwise.services.tickets.messaging import DEFAULT_TZ
from test_tickets_rfq_terms import _day  # noqa: F401 - the day helper the guarded tests use
from tickets_s4_world import midnight_safe_offset, pin_day_away_from_midnight

TZ = ZoneInfo(DEFAULT_TZ)


def _local(hh: int, mm: int, ss: int = 0) -> dt.datetime:
    return dt.datetime(2026, 3, 10, hh, mm, ss, tzinfo=TZ).astimezone(dt.timezone.utc)


@pytest.mark.parametrize("at,shifted", [
    (_local(12, 0), False), (_local(0, 6), False), (_local(23, 54, 59), False),
    (_local(23, 55), True), (_local(23, 59, 59), True), (_local(0, 0), True), (_local(0, 4, 59), True),
])
def test_the_offset_is_one_hour_back_only_near_midnight(at, shifted):
    off = midnight_safe_offset(at, TZ)
    assert off == (-dt.timedelta(hours=1) if shifted else dt.timedelta(0))
    # the shifted instant is never closer to a midnight than the margin, so a few seconds of test never cross one
    local = (at + off).astimezone(TZ)
    since = local - local.replace(hour=0, minute=0, second=0, microsecond=0)
    assert dt.timedelta(minutes=5) <= since <= dt.timedelta(days=1) - dt.timedelta(minutes=5)


def test_every_clock_the_day_tests_read_agrees_at_23_59_59(monkeypatch):
    import test_tickets_rfq_terms as terms
    from smplwise.routers import tickets_board
    from smplwise.services.tickets import costs

    base = _local(23, 59, 59)
    off = pin_day_away_from_midnight(monkeypatch, real_now=lambda: base)
    assert off == -dt.timedelta(hours=1)
    # the server's clock (costs.now_utc, the dashboard router) and the test's day builder see the same installation day,
    # and `_day(6)` is exactly six days after it
    today = costs.now_utc().astimezone(TZ).date()
    assert tickets_board.dt.datetime.now(dt.timezone.utc).astimezone(TZ).date() == today == dt.date(2026, 3, 10)
    assert terms._day(0) == today.isoformat() and terms._day(6) == (today + dt.timedelta(days=6)).isoformat()
