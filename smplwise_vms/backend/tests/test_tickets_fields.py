"""CR-TK-MONEY-UTILS (code review 2026-11-13, 01:F-15): the shared field validators and the one rate limiter of the money modules.

`services/tickets/fields.py` replaced `_text` (costs.py = quotes.py), `_instant` (quotes.py, rfq.py), the CSV `_local` (export.py =
costs_report.py) and three per-user rate limiters (export.py, costs_report.py, deletion.py). The reference implementations below are
the pre-change text (v2.43.6), kept verbatim, so the helpers are pinned to the same answers, the same error codes and the same
waits - and the three limiters are pinned to stay three separate buckets. Pure unit tests: no database, every value invented."""
from __future__ import annotations

import collections
import datetime as dt
import itertools
import random
from zoneinfo import ZoneInfo

import pytest

from smplwise.errors import ApiError
from smplwise.services.tickets import costs, costs_report, deletion, export, fields, quotes, rfq
from smplwise.services.tickets.costs import CostRefused

UTC = dt.timezone.utc
NOW = dt.datetime(2026, 11, 16, 9, 30, tzinfo=UTC)


def _code(call) -> tuple[str, str | None]:
    """("ok", value) or ("refused", code:field) of a validator call."""
    try:
        return "ok", call()
    except CostRefused as exc:
        assert exc.status == 422
        return "refused", f"{exc.code}:{exc.field}"


# ---------------------------------------------------------------- _text (costs.py:441 = quotes.py:227 before the change)

def _old_text(value, field, max_len, *, multiline=False):
    if value is None:
        return None
    if not isinstance(value, str):
        raise CostRefused(422, "type", field)
    t = costs.clean_text(value, multiline=multiline)
    if len(t) > max_len:
        raise CostRefused(422, "too_long", field)
    return t or None


TEXTS = [None, "", "   ", "note", "  padded  ", "two\nlines", "x" * 20, "x" * 21, 7, 1.5, ["a"], {"a": 1}, True, "tab\tbed", "עברית"]


@pytest.mark.parametrize("module", [costs, quotes])
@pytest.mark.parametrize("multiline", [False, True])
def test_text_is_the_old_check(module, multiline):
    for value in TEXTS:
        old = _code(lambda: _old_text(value, "notes", 20, multiline=multiline))
        assert _code(lambda: module._text(value, "notes", 20, multiline=multiline)) == old, repr(value)


# ---------------------------------------------------------------- _instant (quotes.py:238, rfq.py:288 before the change)

def _old_quotes_instant(value, field, now):
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise CostRefused(422, "type", field)
    at = costs.parse(value)
    if at is None:
        raise CostRefused(422, "format", field)
    if at < now - dt.timedelta(days=1) or at > now + dt.timedelta(days=quotes.WORK_HORIZON_DAYS):
        raise CostRefused(422, "range", field)
    return costs.iso(at)


INSTANTS = [None, "", 5, ["2026-11-16T09:30:00Z"], "soon", "2026-13-45", "2026-11-16T09:30:00Z", "2026-11-16T11:30:00+02:00",
            "2026-11-15T09:30:00Z", "2026-11-15T09:29:59Z", "2026-11-16T09:30:01Z", "2026-11-16T09:29:59Z", "2027-11-17T09:30:00Z",
            "2027-11-17T09:30:01Z", "2027-11-16T09:30:00Z", "2026-11-20T12:00:00", "2031-01-01T00:00:00Z", "2020-01-01T00:00:00Z"]


def test_quotes_instant_is_the_old_check():
    for value in INSTANTS:
        assert _code(lambda: quotes._instant(value, "work_from", NOW)) == _code(lambda: _old_quotes_instant(value, "work_from", NOW)), repr(value)


def test_rfq_instant_is_the_old_check(monkeypatch):
    """rfq.py's copy had the extra `future` flag, its own horizon and its own 422 envelope: all three survive the shared check."""
    monkeypatch.setattr(rfq, "invalid", lambda conn, field_name, code: ApiError(422, "validation", "x", details={"fields": [{"field": field_name, "code": code}]}))

    def old(value, field_name, now, *, future=False):
        if value is None or value == "":
            return None
        if not isinstance(value, str):
            raise rfq.invalid(None, field_name, "type")
        at = costs.parse(value)
        if at is None:
            raise rfq.invalid(None, field_name, "format")
        if (future and at <= now) or at < now - dt.timedelta(days=1) or at > now + dt.timedelta(days=rfq.DUE_HORIZON_DAYS):
            raise rfq.invalid(None, field_name, "range")
        return costs.iso(at)

    def run(call):
        try:
            return "ok", call()
        except ApiError as exc:
            return "refused", (exc.status, exc.code, exc.details)

    horizon_edge = (NOW + dt.timedelta(days=rfq.DUE_HORIZON_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    past_edge = (NOW + dt.timedelta(days=rfq.DUE_HORIZON_DAYS, seconds=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    for value, future in itertools.product([*INSTANTS, horizon_edge, past_edge], (False, True)):
        assert run(lambda: rfq._instant(None, value, "due_at", NOW, future=future)) == run(lambda: old(value, "due_at", NOW, future=future)), (value, future)


def test_the_horizon_is_read_at_call_time(monkeypatch):
    far = "2027-06-01T00:00:00Z"
    assert quotes._instant(far, "work_to", NOW) == far
    monkeypatch.setattr(quotes, "WORK_HORIZON_DAYS", 30)
    assert _code(lambda: quotes._instant(far, "work_to", NOW)) == ("refused", "range:work_to")


# ---------------------------------------------------------------- _local (export.py:83 = costs_report.py:257 before the change)

def test_csv_local_time():
    tz = ZoneInfo("Asia/Jerusalem")
    for module in (export, costs_report):
        assert module._local is fields.local_minute
        assert module._local("2026-11-16T09:30:00Z", tz) == "2026-11-16 11:30"
        assert module._local("2026-07-01T21:45:10Z", tz) == "2026-07-02 00:45"
        assert module._local(None, tz) == "" and module._local("", tz) == "" and module._local("not a time", tz) == ""


def test_local_text():
    tz = ZoneInfo("Asia/Jerusalem")
    assert fields.local_text(None, tz, "%H:%M") is None
    assert fields.local_text(NOW, tz, "%d.%m.%Y %H:%M") == "16.11.2026 11:30"
    assert fields.local_text(NOW, UTC, "%d.%m.%Y %H:%M") == "16.11.2026 09:30"


# ---------------------------------------------------------------- the limiters (export.py:63, costs_report.py:311, deletion.py:59)

class _OldCooldown:
    """export.py / costs_report.py before the change: the time of the user's last successful export."""

    def __init__(self, rate_s: float) -> None:
        self.rate_s, self.last = rate_s, {}

    def check(self, user_id, now):
        last = self.last.get(user_id)
        return 0.0 if last is None else max(0.0, self.rate_s - (now - last))

    def mark(self, user_id, now):
        self.last[user_id] = now


class _OldWindow:
    """deletion.py before the change: the user's deletions of the last hour."""

    def __init__(self, per_hour: int, window_s: float) -> None:
        self.per_hour, self.window_s, self.rate = per_hour, window_s, {}

    def wait(self, user_id, n, now):
        q = self.rate.setdefault(user_id, collections.deque())
        while q and now - q[0] >= self.window_s:
            q.popleft()
        if len(q) + n <= self.per_hour:
            return 0.0
        if n > self.per_hour:
            return self.window_s
        return max(0.0, self.window_s - (now - q[len(q) + n - self.per_hour - 1]))

    def mark(self, user_id, now):
        self.rate.setdefault(user_id, collections.deque()).append(now)


@pytest.fixture(autouse=True)
def _fresh_limiters():
    for module in (export, costs_report, deletion):
        module.reset_rate()
    yield
    for module in (export, costs_report, deletion):
        module.reset_rate()


@pytest.mark.parametrize("module", [export, costs_report])
def test_export_limiter_is_the_old_cooldown(module):
    """A random walk on a monotonic clock: every check answers what the old single-timestamp limiter answered - including marks
    made without a check (two requests that both passed it)."""
    rng = random.Random(2440)
    old = _OldCooldown(module.RATE_S)
    now = 1000.0
    for _ in range(600):
        now += rng.choice((0.0, 0.5, 7.0, 29.0, 30.0, 59.999, 60.0, 61.0, 200.0))
        user = rng.choice(("u1", "u2", "u3"))
        assert module.rate_check(user, now) == pytest.approx(old.check(user, now), abs=1e-9)
        if rng.random() < 0.45:
            module.mark(user, now)
            old.mark(user, now)
    assert module.rate_check("never-seen", now) == 0.0


def test_deletion_limiter_is_the_old_window():
    rng = random.Random(2441)
    old = _OldWindow(deletion.RATE_PER_HOUR, deletion.RATE_WINDOW_S)
    now = 5000.0
    for _ in range(1500):
        now += rng.choice((0.0, 1.0, 20.0, 240.0, 900.0, 3599.0, 3600.0))
        user = rng.choice(("u1", "u2"))
        n = rng.choice((1, 1, 2, 5, deletion.RATE_PER_HOUR, deletion.RATE_PER_HOUR + 1, deletion.BULK_MAX))
        assert deletion.rate_wait(user, n, now) == pytest.approx(old.wait(user, n, now), abs=1e-9)
        if rng.random() < 0.6:
            for _i in range(rng.choice((1, 1, 3))):
                deletion.rate_mark(user, now)
                old.mark(user, now)


def test_the_limiters_do_not_share_a_bucket():
    """Plan row: "limiter instances stay separate (limits do not start sharing a bucket)"."""
    assert len({id(export._RATE), id(costs_report._RATE), id(deletion._RATE)}) == 3
    export.mark("u1", 100.0)
    assert export.rate_check("u1", 101.0) > 0
    assert costs_report.rate_check("u1", 101.0) == 0.0 and deletion.rate_wait("u1", 1, 101.0) == 0.0
    costs_report.mark("u1", 100.0)
    for _ in range(deletion.RATE_PER_HOUR):
        deletion.rate_mark("u2", 100.0)
    assert deletion.rate_wait("u2", 1, 101.0) > 0 and export.rate_check("u2", 101.0) == 0.0 and costs_report.rate_check("u2", 101.0) == 0.0
    export.reset_rate()
    assert export.rate_check("u1", 101.0) == 0.0 and costs_report.rate_check("u1", 101.0) > 0 and deletion.rate_wait("u2", 1, 101.0) > 0


def test_the_limits_are_read_at_call_time(monkeypatch):
    export.mark("u1", 100.0)
    assert export.rate_check("u1", 130.0) == pytest.approx(30.0)
    monkeypatch.setattr(export, "RATE_S", 10.0)
    assert export.rate_check("u1", 105.0) == pytest.approx(5.0)
    monkeypatch.setattr(deletion, "RATE_PER_HOUR", 2)
    deletion.rate_mark("u1", 100.0)
    deletion.rate_mark("u1", 100.0)
    assert deletion.rate_wait("u1", 1, 101.0) > 0
