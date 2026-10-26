"""The real-time engine: planned arrivals in, honest per-arrival estimates out. Deterministic: every instant is passed
in (`now`) or comes from the injected clock; no network access except through the injected source.

Fallback ladder per arrival (never raises into the caller):
  fresh observation (age <= fresh_s)        -> source "realtime", estimated = prediction (clamped to now when overdue)
  older observation (<= stale_s)            -> source "stale",    estimated = the same prediction, age_s tells how old
  no / too old / unjoinable observation     -> source "scheduled", estimated None
  source failing                            -> last known observations are kept (they age out by the rule above); the
                                               stop is retried with exponential back-off (60, 120, 240, 480 s)
  cancelled                                 -> status "cancelled", estimated None
  still at its first stop                   -> status "not_departed", scheduled
  already past the stop                     -> status "departed" (omitted unless include_departed)

Cache and de-duplication: one entry per stop code, shared by every board and every caller; a fetch happens at most once
per `ttl_s` per stop, concurrent callers wait for the one in flight (single flight) and reuse its result."""
from __future__ import annotations

import threading
from collections import OrderedDict
from collections.abc import Callable, Sequence
from datetime import datetime, timedelta, timezone
from typing import Protocol

from .model import Arrival, Config, Observation, Result, ScheduledArrival

ScheduleProvider = Callable[[int, datetime, datetime], Sequence[ScheduledArrival]]
MAX_PLAUSIBLE_DELAY_S = 3 * 3600
UNCOVERED_REFETCH_S = 15


class RealtimeSource(Protocol):
    name: str

    def fetch(self, stop_code: int, now: datetime, rides: Sequence[ScheduledArrival]) -> list[Observation]: ...


class _Entry:
    __slots__ = ("obs", "covered", "fetched_at", "last_attempt", "next_try", "fails", "error", "lock")

    def __init__(self) -> None:
        self.obs: dict[tuple[int, int], Observation] = {}
        self.covered: dict[tuple[int, int], float] = {}
        self.fetched_at: datetime | None = None
        self.last_attempt: datetime | None = None
        self.next_try: datetime | None = None
        self.fails = 0
        self.error: str | None = None
        self.lock = threading.Lock()


def _key(line_ref: int, start: datetime) -> tuple[int, int]:
    return line_ref, int(start.astimezone(timezone.utc).timestamp())


def _utc(d: datetime) -> datetime:
    return d.astimezone(timezone.utc)


class RealtimeEngine:
    def __init__(self, source: RealtimeSource | None, schedule: ScheduleProvider | None = None, config: Config | None = None,
                 clock: Callable[[], datetime] | None = None):
        self._source, self._schedule, self.cfg = source, schedule, config or Config()
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._entries: OrderedDict[int, _Entry] = OrderedDict()
        self._guard = threading.Lock()
        self.fetch_count = 0  # source calls made (observability / tests)

    # ---- public interface -------------------------------------------------------------------------------------
    def arrivals(self, stop_code: int, window_from: datetime, window_to: datetime, now: datetime | None = None,
                 include_departed: bool = False) -> Result:
        """Convenience: the engine asks its ScheduleProvider for the planned rows (widened by lookback so a late bus is not lost)."""
        if self._schedule is None:
            raise RuntimeError("arrivals() needs a ScheduleProvider; use annotate() with your own scheduled rows")
        now = _utc(now or self._clock())
        pad = timedelta(seconds=self.cfg.lookback_s)
        rows = self._schedule(stop_code, _utc(window_from) - pad, _utc(window_to) + pad)
        return self.annotate(stop_code, rows, now, window=(window_from, window_to), include_departed=include_departed)

    def annotate(self, stop_code: int, scheduled: Sequence[ScheduledArrival], now: datetime | None = None,
                 window: tuple[datetime, datetime] | None = None, include_departed: bool = False) -> Result:
        """Main entry for the scheduled-times feature: pass its own planned rows, get Arrival rows back (never raises)."""
        now = _utc(now or self._clock())
        entry = self._refresh(stop_code, scheduled, now)
        rows = [self._classify(s, entry.obs.get(_key(s.line_ref, s.ride_start)) if (entry and s.ride_start) else None, now) for s in scheduled]
        if not include_departed:
            rows = [r for r in rows if r.status != "departed"]
        if window is not None:
            lo, hi = _utc(window[0]), _utc(window[1])
            rows = [r for r in rows if lo <= r.best <= hi]
        rows.sort(key=lambda r: (r.best, r.line))
        return Result(stop_code, now, tuple(rows), self._state(entry, rows, now),
                      int((now - entry.fetched_at).total_seconds()) if entry and entry.fetched_at else None,
                      entry.error if entry else None, sum(1 for r in rows if r.estimated is not None or r.status == "cancelled"))

    # ---- cache / fetch ----------------------------------------------------------------------------------------
    def _entry(self, stop_code: int) -> _Entry:
        with self._guard:
            e = self._entries.get(stop_code)
            if e is None:
                e = self._entries[stop_code] = _Entry()
                while len(self._entries) > self.cfg.max_entries:
                    self._entries.popitem(last=False)
            self._entries.move_to_end(stop_code)
            return e

    def _due(self, e: _Entry, rides: Sequence[ScheduledArrival], now: datetime) -> bool:
        if e.next_try is not None and now < e.next_try:
            return False  # failure back-off
        if e.last_attempt is None or (now - e.last_attempt).total_seconds() >= self.cfg.ttl_s:
            return True
        # a new ride (not in the last fetch) may be refetched early, but at most every UNCOVERED_REFETCH_S
        lo, hi = now - timedelta(seconds=self.cfg.lookback_s), now + timedelta(seconds=self.cfg.horizon_s)
        unc = any(lo <= _utc(s.scheduled) <= hi and _key(s.line_ref, s.ride_start) not in e.covered for s in rides)
        return unc and (now - e.last_attempt).total_seconds() >= UNCOVERED_REFETCH_S

    def _refresh(self, stop_code: int, scheduled: Sequence[ScheduledArrival], now: datetime) -> _Entry | None:
        if self._source is None:
            return None
        e = self._entry(stop_code)
        tracked = [s for s in scheduled if s.ride_start is not None]
        if not self._due(e, tracked, now):
            return e
        with e.lock:  # single flight: a second caller waits here, then finds the entry fresh
            if not self._due(e, tracked, now):
                return e
            horizon = now + timedelta(seconds=self.cfg.horizon_s)
            floor = now - timedelta(seconds=self.cfg.lookback_s)
            rides = [s for s in tracked if floor <= _utc(s.scheduled) <= horizon]
            self.fetch_count += 1
            try:
                got = self._source.fetch(stop_code, now, rides)
            except Exception as exc:  # any adapter failure degrades to last known / scheduled
                e.last_attempt = now
                e.fails += 1
                e.error = f"{type(exc).__name__}: {str(exc)[:120]}"
                e.next_try = now + timedelta(seconds=min(self.cfg.ttl_s * 2 ** (e.fails - 1), self.cfg.backoff_max_s))
                return e
            e.last_attempt = now  # set after the fetch: callers arriving meanwhile still see the entry as due and wait on the lock
            e.error, e.fails, e.next_try, e.fetched_at = None, 0, None, now
            fresh: dict[tuple[int, int], Observation] = {}
            for o in got:
                k = _key(o.line_ref, o.ride_start)
                if k not in fresh or o.recorded_at > fresh[k].recorded_at:
                    fresh[k] = o
            # a ride that was fetched but returned nothing keeps no stale observation; rides outside this fetch keep theirs
            covered = {_key(s.line_ref, s.ride_start): _utc(s.scheduled).timestamp() for s in rides}
            for k in covered:
                e.obs.pop(k, None)
            e.obs.update(fresh)
            e.covered = {k: t for k, t in {**e.covered, **covered}.items() if t >= floor.timestamp()}
            cutoff = now - timedelta(seconds=self.cfg.stale_s * 3)
            for k in [k for k, o in e.obs.items() if o.recorded_at < cutoff]:
                del e.obs[k]
            return e

    # ---- classification ---------------------------------------------------------------------------------------
    def _classify(self, s: ScheduledArrival, o: Observation | None, now: datetime) -> Arrival:
        cfg = self.cfg
        sched = _utc(s.scheduled)

        def plain(status="unknown", age=None) -> Arrival:
            return Arrival(s.stop_code, s.line_ref, s.line, s.destination, sched, None, "scheduled", status, None, age)

        if o is None:
            return plain()
        age = max(0, int((now - o.recorded_at).total_seconds()))
        if age > cfg.stale_s:
            return plain(age=age)
        src = "realtime" if age <= cfg.fresh_s else "stale"
        if o.cancelled:
            return Arrival(s.stop_code, s.line_ref, s.line, s.destination, sched, None, src, "cancelled", None, age)
        if o.passed:
            return Arrival(s.stop_code, s.line_ref, s.line, s.destination, sched, None, src, "departed", None, age)
        if o.not_departed:
            return plain("not_departed", age)
        if o.expected is None:
            return plain(age=age)
        est = _utc(o.expected)
        if abs((est - sched).total_seconds()) > MAX_PLAUSIBLE_DELAY_S:
            return plain(age=age)  # a bad join must never show an absurd time
        if est < now:
            if src == "stale" and (now - est).total_seconds() > cfg.overdue_s:
                return plain(age=age)  # an old prediction that should have happened already is not trusted
            est = now
        d = int((est - sched).total_seconds())
        status = "on_time" if abs(d) <= cfg.early_late_s else ("late" if d > 0 else "early")
        return Arrival(s.stop_code, s.line_ref, s.line, s.destination, sched, est, src, status, d, age)

    def _state(self, e: _Entry | None, rows: list[Arrival], now: datetime) -> str:
        if self._source is None or e is None:
            return "off"
        if e.error is not None:
            return "down"
        if any(r.source == "realtime" for r in rows):
            return "live"
        if any(r.source == "stale" for r in rows):
            return "degraded"
        return "live" if e.fetched_at is not None else "down"
