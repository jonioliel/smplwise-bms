"""BUSTIMES-295 - the data source behind an interface, so the real-time provider (pilot/BUSRT-295) plugs in later without touching the poller,
the cache, the digest or the screen.

A provider answers `arrivals(stop_code, window_start, window_end) -> list[Arrival]`, sorted by scheduled time. An Arrival is a plain dict:
  line, dest, agency, ride   what the row is
  at                          the SCHEDULED instant (UTC, `YYYY-MM-DDTHH:MM:SSZ`)
  est                         the ESTIMATED instant (same format) or None
  est_age_s                   how old the estimate was when the provider answered (None without one)
The digest decides the quality flag (`realtime` | `scheduled` | `stale`) from `est` and its age; a provider never has to. The scheduled provider
below (Open Bus Stride GTFS) never returns an estimate. A provider raises `stride.StrideError` when its source fails (the poller's breaker
reacts) and `UnknownStop` when it has no such stop today (not the source's failure)."""
from __future__ import annotations

import datetime as dt
import logging
from typing import Any, Protocol
from zoneinfo import ZoneInfo

from . import stride
from ..transit_realtime import Config as RtConfig
from ..transit_realtime import RealtimeEngine, ScheduledArrival
from ..transit_realtime.stride import PlanStore, StrideSource

log = logging.getLogger("smplwise.transit")

Arrival = dict[str, Any]
DEST_LOOKUPS_PER_PASS = 10


class UnknownStop(Exception):
    """The provider has no stop with this code today."""


class ArrivalProvider(Protocol):
    def arrivals(self, stop_code: int, window_start: dt.datetime, window_end: dt.datetime) -> list[Arrival]: ...


class ScheduledProvider:
    """Planned arrivals from Open Bus Stride (`gtfs_ride_stops`). Stop ids are a daily snapshot: resolved once per code per local day."""

    def __init__(self, fetch: stride.Fetch, tz: ZoneInfo | None = None) -> None:
        self.fetch = fetch
        self.tz = tz or ZoneInfo("Asia/Jerusalem")
        self._ids: dict[tuple[int, str], list[int]] = {}
        self._dest: dict[int, str] = {}  # ride id -> last stop name (the destination fallback)
        self._lookups = 0

    def new_pass(self) -> None:
        self._lookups = 0
        if len(self._dest) > 2000:
            self._dest.clear()

    def arrivals(self, stop_code: int, window_start: dt.datetime, window_end: dt.datetime) -> list[Arrival]:
        day = window_start.astimezone(self.tz).date()
        for key in [k for k in self._ids if k[1] != day.isoformat()]:
            del self._ids[key]
        ids = self._ids.get((stop_code, day.isoformat())) or stride.stop_ids(self.fetch, stop_code, day)
        if not ids:
            raise UnknownStop(str(stop_code))
        self._ids[(stop_code, day.isoformat())] = ids
        rows = stride.normalize_arrivals(stride.fetch_arrivals(self.fetch, ids, window_start, window_end))
        for row in rows:
            if not row["dest"] and row["ride"] is not None:
                if row["ride"] not in self._dest and self._lookups < DEST_LOOKUPS_PER_PASS:
                    self._lookups += 1
                    self._dest[row["ride"]] = stride.last_stop_name(self.fetch, row["ride"])
                row["dest"] = self._dest.get(row["ride"], "")
            row["est"], row["est_age_s"] = None, None
        return rows


def as_provider(source: Any, tz: ZoneInfo | None = None) -> ArrivalProvider:
    """A provider as it is, or a bare `Fetch` callable wrapped as the scheduled provider."""
    return source if hasattr(source, "arrivals") else ScheduledProvider(source, tz)


PLAN_LOOKUPS_PER_PASS = 12  # rides whose planned stop list is read per pass (cached for the day afterwards): a first pass never becomes a burst


class RealtimeProvider:
    """Planned arrivals (`ScheduledProvider`) annotated by the real-time engine of pilot/BUSRT-295: for each ride the newest Stride vehicle position
    is compared with the ride's timetable, which gives an ESTIMATED time and the road distance to the stop. A row keeps `ride` (gtfs_ride_id),
    `ride_start` (the join key) and gets `est`, `est_age_s` (= the age of the vehicle position), `distance_m`. Any failure of the estimate layer
    (an unreachable positions endpoint, an unjoinable ride) leaves the row scheduled - it never raises into the poller and never trips its breaker;
    only the planned-arrivals request does. `window_start` is taken as "now" (the poller passes its own clock)."""

    def __init__(self, fetch: stride.Fetch, tz: ZoneInfo | None = None, config: RtConfig | None = None) -> None:
        self.inner = ScheduledProvider(fetch, tz)
        self.plans = PlanStore(fetch)
        cfg = config or RtConfig()
        self.engine = RealtimeEngine(StrideSource(fetch, self.plans, cfg), None, cfg)
        self._budget = PLAN_LOOKUPS_PER_PASS
        self.last_error: str | None = None

    def configure(self, *, position_fresh_s: int, poll_s: int) -> None:
        cfg = self.engine.cfg
        cfg.fresh_s = position_fresh_s
        cfg.stale_s = max(cfg.stale_s, position_fresh_s * 3)
        cfg.ttl_s = max(5, int(poll_s * 0.8))  # a pass every poll_s must reach the source, not the engine's cache

    def new_pass(self) -> None:
        self.inner.new_pass()
        self._budget = PLAN_LOOKUPS_PER_PASS

    def arrivals(self, stop_code: int, window_start: dt.datetime, window_end: dt.datetime) -> list[Arrival]:
        now = window_start.astimezone(dt.timezone.utc)
        pad = dt.timedelta(seconds=self.engine.cfg.lookback_s)
        rows = self.inner.arrivals(stop_code, now - pad, window_end)  # a late bus is still planned in the past
        for r in rows:
            r.setdefault("ride_start", None)
        try:
            self._annotate(stop_code, rows, now)
            self.last_error = None
        except Exception as exc:  # noqa: BLE001 - the estimate layer degrades to the schedule, never to an error
            self.last_error = type(exc).__name__
            log.warning("transit estimates unavailable: %s", type(exc).__name__)
            for r in rows:
                r.update(est=None, est_age_s=None, distance_m=None)
        return [r for r in rows if r.get("status") != "cancelled"]

    def _annotate(self, stop_code: int, rows: list[Arrival], now: dt.datetime) -> None:
        horizon = now + dt.timedelta(seconds=self.engine.cfg.horizon_s)
        sched: list[ScheduledArrival] = []
        by_key: dict[tuple[int, int], Arrival] = {}
        for r in rows:
            at = stride.parse_time(r["at"])
            if at is None or r.get("ride") is None or r.get("line_ref") is None:
                continue
            if not self.plans.has(r["ride"]):
                if at > horizon or self._budget <= 0:
                    continue  # beyond the horizon or over this pass's budget: scheduled until a later pass reads its plan
                self._budget -= 1
            try:
                rp = self.plans.ride(r["ride"], stop_code)
            except Exception:  # noqa: BLE001 - one unreadable plan leaves one row scheduled
                continue
            if rp is None:
                continue
            r["ride_start"] = stride.parse_time(rp.start.isoformat()).strftime("%Y-%m-%dT%H:%M:%SZ")
            sched.append(ScheduledArrival(stop_code, r["line_ref"], r["line"], r["dest"], at, r["ride"], rp.start))
            by_key.setdefault((r["line_ref"], int(at.timestamp())), r)
        res = self.engine.annotate(stop_code, sched, now)
        for r in rows:
            r.update(est=None, est_age_s=None, distance_m=None)
        kept = set()
        for a in res.arrivals:
            r = by_key.get((a.line_ref, int(a.scheduled.timestamp())))
            if r is None:
                continue
            kept.add(id(r))
            if a.status == "cancelled":
                r["status"] = "cancelled"
            elif a.estimated is not None:
                r.update(est=a.estimated.strftime("%Y-%m-%dT%H:%M:%SZ"), est_age_s=a.age_s, distance_m=a.distance_m)
        passed = {id(r) for r in by_key.values()} - kept  # joined rides the engine dropped: the vehicle already went by
        rows[:] = [r for r in rows if id(r) not in passed]
