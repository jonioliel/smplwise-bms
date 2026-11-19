"""Waiting for a condition, wall-clock bounds, and pinned clocks.

Rule of thumb: a test that needs "later" moves the clock the code reads (`datetime_shim`, a module's own `_monotonic` /
`now_iso` seam, a negative grace constant) instead of sleeping; a test that waits for another thread polls with `wait_for`."""
from __future__ import annotations

import datetime as _dt
import os
import time
import types as _types
from collections.abc import Callable
from typing import Any


def wait_for(pred: Callable[[], Any], timeout: float = 5.0, what: str = "") -> None:
    """Poll `pred` every 20 ms until it is true; AssertionError after `timeout` seconds, with the WisKey feed's state (most
    callers wait for that feed) and `what` when given."""
    end = time.time() + timeout
    while time.time() < end:
        if pred():
            return
        time.sleep(0.02)
    from smplwise.services import intercom_sync

    raise AssertionError(f"condition not met{f' ({what})' if what else ''}; feed state {intercom_sync.STATE.as_dict()}")


def wait_until(pred: Callable[[], Any], timeout: float = 5.0, step: float = 0.01) -> bool:
    """Poll `pred` until it is true or `timeout` passed; returns its last answer (the caller asserts)."""
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if pred():
            return True
        time.sleep(step)
    return pred()


# ---------------------------------------------------------------- wall-clock bounds

def sw_time_factor() -> float:
    """Multiplier for the generous (default) side of a wall-clock performance bound in a test.

    A handful of tests assert a property that is really about behaviour ("does not slow the detector down",
    "does not wait for the worker", "reads do not block on a writer") but can only observe it by timing
    something. Their default bound is deliberately loose so a busy workstation - another agent's build, a second
    pytest worker, antivirus - does not turn a behavioural check into a flaky one. Set `SW_TEST_TIME_FACTOR` (a
    float, default 1) to loosen it further on a machine or CI runner that is reliably slower or busier; values
    below 1 are ignored. See `sw_perf_enabled` for the tight bound each of these tests keeps available on request.
    """
    try:
        factor = float(os.environ.get("SW_TEST_TIME_FACTOR", "1"))
    except ValueError:
        return 1.0
    return factor if factor > 1.0 else 1.0


def sw_load_factor(samples: int = 5, spin_s: float = 0.05, cap: float = 12.0) -> float:
    """How much slower than an idle core this thread is being run right now (>= 1, capped), for the few bounds that are
    really about wall-clock time (a latency, a throughput) and so cannot be made clock-free.

    Spins the calling thread for `spin_s` of wall time and compares it with the CPU time the thread actually got
    (`time.thread_time`, per thread - other threads of the test do not count). On an idle machine the two are equal; when the
    runner carries other jobs the thread is descheduled and wall/CPU grows by about the factor the code under test is slowed.
    The median of `samples` spins is used, multiplied with `sw_time_factor()` (the manual override). Call it AFTER the
    measured work so it sees the load the work saw. It never loosens a bound on an idle machine (returns 1.0 there)."""
    ratios: list[float] = []
    for _ in range(samples):
        w0, c0 = time.perf_counter(), time.thread_time()
        while time.perf_counter() - w0 < spin_s:
            pass
        wall, cpu = time.perf_counter() - w0, time.thread_time() - c0
        ratios.append(wall / cpu if cpu > 0 else 1.0)
    ratios.sort()
    return min(max(ratios[len(ratios) // 2], 1.0), cap) * sw_time_factor()


def sw_perf_enabled() -> bool:
    """True when `SW_PERF=1` asks for the strict, original wall-clock bound on a performance test.

    These bounds are tight enough to catch a real regression (an accidental O(n^2) merge, a lock that starts
    blocking readers) but only hold on a quiet machine, so they are opt-in rather than the default assertion.
    """
    return os.environ.get("SW_PERF") == "1"


# ---------------------------------------------------------------- pinned clocks

# 12:00 on a Monday in Asia/Jerusalem (UTC+3 until 2026-10-25): outside the default quiet hours (22:00-07:00).
DAY_ANCHOR = _dt.datetime(2026, 10, 5, 9, 0, tzinfo=_dt.timezone.utc)
_DAY_T0 = time.monotonic()


def day_now() -> _dt.datetime:
    """The pinned daytime clock: starts at DAY_ANCHOR and runs forward with the test run (so ordering still holds)."""
    return DAY_ANCHOR + _dt.timedelta(seconds=time.monotonic() - _DAY_T0)


def datetime_shim(now_fn) -> _types.SimpleNamespace:
    """A stand-in for a module's `datetime as dt` whose `dt.datetime.now(tz)` reads `now_fn()` (an aware UTC datetime); every
    other name of the datetime module is the real one. Patch it over one module (`monkeypatch.setattr(mod, "dt", datetime_shim(f))`)
    to pin the wall clock a router or service reads, with no change to production code (the seam `daytime_clock` uses too)."""

    class _Datetime(_dt.datetime):
        @classmethod
        def now(cls, tz=None):
            at = now_fn()
            return at.astimezone(tz) if tz is not None else at.astimezone(_dt.timezone.utc).replace(tzinfo=None)

    shim = _types.SimpleNamespace(**{k: v for k, v in vars(_dt).items() if not k.startswith("__")})
    shim.datetime = _Datetime
    return shim
