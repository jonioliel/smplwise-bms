"""CR-039 slice W0: the fake clock and the deterministic scheduler every door-windows fake runs on.

Nothing here reads the real clock or sleeps. Time only moves when a test calls `advance` / `run_until`; jobs run in a total
order (`(due, seq)`), so two runs of the same scenario produce the same command log, byte for byte.

- `FakeDoorwinClock`: a timezone-aware UTC instant (`now()`), `monotonic()` (seconds since the start, for code that measures
  intervals), `local(zone)` (the instant in an IANA zone - AGENTS.md: no fixed offsets) and `skewed(seconds)` (a view of the
  same clock that runs ahead / behind: the Home Assistant clock WisKey evaluates by, or a station's clock, CR-039 4.5).
- `DoorwinScheduler`: `call_at`, `call_later`, `every` (a periodic job, first run after one period unless `first_at`),
  `cancel`, `cancel_owner` (an owner tag per job: a restart of "arx" cancels every Arx job and nothing of an engine, which
  is how the harness proves SR-1 - the engine relocks with no Arx job alive), `advance(seconds)` and `run_until(instant)`.
  A job may schedule further jobs; jobs that fall due inside the same `advance` run in order with the clock set to their
  own due instant. `step()` runs exactly the next job (single-stepping a race).

Product slices plug in by taking a `now` callable (and, for a background family, a `tick()` entry point the harness calls
from `every(...)`) instead of reading `datetime.now` / starting threads.
"""
from __future__ import annotations

import datetime as dt
import heapq
import itertools
from dataclasses import dataclass, field
from typing import Any, Callable
from zoneinfo import ZoneInfo

UTC = dt.timezone.utc
# a fixed, synthetic start: Sunday 2026-11-01 06:00 UTC (08:00 in Asia/Jerusalem after the October DST change)
DEFAULT_START = dt.datetime(2026, 11, 1, 6, 0, 0, tzinfo=UTC)


def utc(*args: int) -> dt.datetime:
    """`utc(2026, 11, 1, 6, 0)` - a UTC instant (helper for readable tests)."""
    return dt.datetime(*args, tzinfo=UTC)


def at_local(zone: str, *args: int) -> dt.datetime:
    """A wall time in an IANA zone, as a UTC instant (`fold=0`: the first pass of a repeated hour)."""
    return dt.datetime(*args, tzinfo=ZoneInfo(zone)).astimezone(UTC)


class FakeDoorwinClock:
    """The one clock of a scenario. `now()` is always timezone-aware UTC."""

    def __init__(self, start: dt.datetime = DEFAULT_START) -> None:
        if start.tzinfo is None:
            raise ValueError("the fake clock needs a timezone-aware start")
        self._start = start.astimezone(UTC)
        self._now = self._start

    def now(self) -> dt.datetime:
        return self._now

    def now_iso(self) -> str:
        """ISO-8601 UTC text, the shape `db.now_iso` stores."""
        return self._now.isoformat()

    def monotonic(self) -> float:
        return (self._now - self._start).total_seconds()

    def local(self, zone: str) -> dt.datetime:
        return self._now.astimezone(ZoneInfo(zone))

    def skewed(self, seconds: float) -> "SkewedClock":
        return SkewedClock(self, seconds)

    def _set(self, instant: dt.datetime) -> None:
        if instant < self._now:
            raise AssertionError("the fake clock never runs backwards")
        self._now = instant


class SkewedClock:
    """A view of a `FakeDoorwinClock` that is `skew_s` seconds ahead (positive) or behind (negative). The skew may be
    changed at any time (a station whose clock drifts, CR-039 4.5 / T15)."""

    def __init__(self, base: FakeDoorwinClock, skew_s: float) -> None:
        self.base = base
        self.skew_s = skew_s

    def now(self) -> dt.datetime:
        return self.base.now() + dt.timedelta(seconds=self.skew_s)

    def local(self, zone: str) -> dt.datetime:
        return self.now().astimezone(ZoneInfo(zone))


@dataclass(order=True)
class _Job:
    due: dt.datetime
    seq: int
    fn: Callable[[], Any] = field(compare=False)
    owner: str = field(compare=False, default="test")
    name: str = field(compare=False, default="")
    period_s: float | None = field(compare=False, default=None)
    cancelled: bool = field(compare=False, default=False)


class DoorwinScheduler:
    """Deterministic jobs on a `FakeDoorwinClock`. Every job carries an `owner` ("wiskey", "station", "arx", "test", ...)."""

    def __init__(self, clock: FakeDoorwinClock) -> None:
        self.clock = clock
        self._heap: list[_Job] = []
        self._seq = itertools.count()
        self.ran: list[tuple[str, str, str]] = []  # (instant iso, owner, name) of every job that ran
        self.errors: list[tuple[str, str, BaseException]] = []  # a job that raised: recorded, the run continues

    # ------------------------------------------------------------ scheduling
    def call_at(self, when: dt.datetime, fn: Callable[[], Any], *, owner: str = "test", name: str = "") -> _Job:
        if when.tzinfo is None:
            raise ValueError("call_at needs a timezone-aware instant")
        job = _Job(max(when.astimezone(UTC), self.clock.now()), next(self._seq), fn, owner, name or getattr(fn, "__name__", "job"))
        heapq.heappush(self._heap, job)
        return job

    def call_later(self, seconds: float, fn: Callable[[], Any], *, owner: str = "test", name: str = "") -> _Job:
        return self.call_at(self.clock.now() + dt.timedelta(seconds=seconds), fn, owner=owner, name=name)

    def every(self, period_s: float, fn: Callable[[], Any], *, owner: str = "test", name: str = "", first_at: dt.datetime | None = None) -> _Job:
        if period_s <= 0:
            raise ValueError("a periodic job needs a positive period")
        when = first_at if first_at is not None else self.clock.now() + dt.timedelta(seconds=period_s)
        job = self.call_at(when, fn, owner=owner, name=name)
        job.period_s = period_s
        return job

    def cancel(self, job: _Job) -> None:
        job.cancelled = True

    def cancel_owner(self, owner: str) -> int:
        """Cancel every pending job of one owner (a process restart). Returns how many were cancelled."""
        n = 0
        for job in self._heap:
            if job.owner == owner and not job.cancelled:
                job.cancelled = True
                n += 1
        return n

    def pending(self, owner: str | None = None) -> list[_Job]:
        return sorted(j for j in self._heap if not j.cancelled and (owner is None or j.owner == owner))

    # ------------------------------------------------------------ running
    def step(self) -> bool:
        """Run the next due job (moving the clock to its instant). Returns False when nothing is pending."""
        while self._heap:
            job = heapq.heappop(self._heap)
            if job.cancelled:
                continue
            self.clock._set(job.due)
            self._run(job)
            return True
        return False

    def run_until(self, instant: dt.datetime) -> int:
        """Run every job due at or before `instant`, then set the clock to `instant`. Returns how many jobs ran."""
        n = 0
        while self._heap:
            job = self._heap[0]
            if job.cancelled:
                heapq.heappop(self._heap)
                continue
            if job.due > instant:
                break
            heapq.heappop(self._heap)
            self.clock._set(job.due)
            self._run(job)
            n += 1
        self.clock._set(max(instant, self.clock.now()))
        return n

    def advance(self, seconds: float) -> int:
        return self.run_until(self.clock.now() + dt.timedelta(seconds=seconds))

    def _run(self, job: _Job) -> None:
        self.ran.append((job.due.isoformat(), job.owner, job.name))
        try:
            job.fn()
        except Exception as exc:  # noqa: BLE001 - a fake engine's failure is data for the test, never a crash of the run
            self.errors.append((job.due.isoformat(), job.name, exc))
        if job.period_s is not None and not job.cancelled:
            job.due = job.due + dt.timedelta(seconds=job.period_s)
            job.seq = next(self._seq)
            heapq.heappush(self._heap, job)
