"""Adapter 1: Open Bus Stride (public, no key). Stride carries no ETA field: it stores SIRI vehicle positions. The
estimate is derived: the newest position of the ride (metres from the journey start) is compared with the planned
timetable of the same ride (GTFS shape_dist_traveled per stop) to get the vehicle's delay, and the delay is carried
to the stop: expected = planned_at_stop + delay. Join key: (line_ref, planned start time of the ride).
Honest limit, measured 2026-10-26: Stride's newest positions were 3-25 minutes old (its ETL runs behind the feed and
skips snapshots), so most upcoming buses come out `stale` or `scheduled`. See docs/design/BUS_REALTIME_NOTE.md.

No network access happens here: every call goes through the injected `transport(path, params) -> parsed JSON`."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from collections import OrderedDict
from collections.abc import Callable, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any

from .delay import Plan, delay_s
from .model import Config, Observation, ScheduledArrival

Transport = Callable[[str, dict[str, Any]], Any]
BASE_URL = "https://open-bus-stride-api.hasadna.org.il"
PASSED_MARGIN_M = 50.0
AT_ORIGIN_M = 50.0


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s).astimezone(timezone.utc)


def _z(d: datetime) -> str:
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def urllib_transport(base_url: str = BASE_URL, user_agent: str = "smplwise-arx-transit/1", timeout: float = 10.0) -> Transport:
    """The only code that touches the network. Used in production wiring, never in tests."""
    def call(path: str, params: dict[str, Any]) -> Any:
        url = base_url + path + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": user_agent, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    return call


def destination_from_route_name(long_name: str) -> str:
    """'origin<->destination-city-2#' -> 'destination'. A convention, not a contract: falls back to the text after '<->'."""
    if "<->" not in long_name:
        return long_name.strip()
    tail = long_name.split("<->", 1)[1].rstrip("#").strip()
    parts = tail.rsplit("-", 2)
    return parts[0].strip() if len(parts) == 3 else tail


class RidePlan:
    __slots__ = ("plan", "start", "stop_dist", "stop_planned")

    def __init__(self, plan: Plan | None, start: datetime, stop_dist: float | None, stop_planned: datetime | None):
        self.plan, self.start, self.stop_dist, self.stop_planned = plan, start, stop_dist, stop_planned


class PlanStore:
    """Planned stop list of rides (static for the day): one request per ride, kept in an LRU."""

    def __init__(self, transport: Transport, max_rides: int = 512):
        self._t, self._max = transport, max_rides
        self._rides: OrderedDict[int, list[dict]] = OrderedDict()

    def has(self, ride_id: int) -> bool:
        return ride_id in self._rides

    def rows(self, ride_id: int) -> list[dict]:
        if ride_id in self._rides:
            self._rides.move_to_end(ride_id)
            return self._rides[ride_id]
        rows = self._t("/gtfs_ride_stops/list", {"gtfs_ride_ids": ride_id, "order_by": "stop_sequence asc", "limit": 400})
        rows = sorted(rows, key=lambda r: r["stop_sequence"])
        self._rides[ride_id] = rows
        while len(self._rides) > self._max:
            self._rides.popitem(last=False)
        return rows

    def ride(self, ride_id: int, stop_code: int) -> RidePlan | None:
        rows = self.rows(ride_id)
        if not rows:
            return None
        start = _dt(rows[0]["arrival_time"])
        # the first stop of a ride carries a null shape_dist_traveled in the feed: it is the origin, 0 m (otherwise Plan.build drops it and a bus
        # 50-1000 m from the origin is timed against stop 2, up to ~3 minutes early)
        plan = Plan.build([(0.0 if (r.get("shape_dist_traveled") is None and r is rows[0]) else r.get("shape_dist_traveled"), _dt(r["arrival_time"]).timestamp()) for r in rows])
        at = next((r for r in rows if r.get("gtfs_stop__code") == stop_code and r.get("pickup_type", 0) == 0), None)
        return RidePlan(plan, start, at.get("shape_dist_traveled") if at else None, _dt(at["arrival_time"]) if at else None)


class StrideScheduleProvider:
    """Default scheduled rows from Stride (the scheduled-times feature has its own; this one lets the engine run alone)."""

    def __init__(self, transport: Transport, plans: PlanStore):
        self._t, self._plans = transport, plans

    def __call__(self, stop_code: int, start: datetime, end: datetime) -> list[ScheduledArrival]:
        rows = self._t("/gtfs_ride_stops/list", {"gtfs_stop__code": stop_code, "arrival_time_from": _z(start), "arrival_time_to": _z(end),
                                                 "order_by": "arrival_time asc", "limit": 500})
        out = []
        for r in rows:
            if r.get("pickup_type", 0) != 0:
                continue  # terminus: nobody boards
            rp = self._plans.ride(r["gtfs_ride_id"], stop_code)
            out.append(ScheduledArrival(stop_code, r["gtfs_route__line_ref"], r["gtfs_route__route_short_name"],
                                        destination_from_route_name(r["gtfs_route__route_long_name"]), _dt(r["arrival_time"]),
                                        r["gtfs_ride_id"], rp.start if rp else None))
        return out


class StrideSource:
    name = "stride"

    def __init__(self, transport: Transport, plans: PlanStore, config: Config | None = None):
        self._t, self._plans, self._cfg = transport, plans, config or Config()

    def fetch(self, stop_code: int, now: datetime, rides: Sequence[ScheduledArrival]) -> list[Observation]:
        by_line: dict[int, list[ScheduledArrival]] = {}
        for a in rides:
            if a.ride_id is not None and a.ride_start is not None:
                by_line.setdefault(a.line_ref, []).append(a)
        out: list[Observation] = []
        since = now - timedelta(seconds=self._cfg.stale_s + 120)
        for line_ref, arrs in by_line.items():
            locs = self._t("/siri_vehicle_locations/list", {
                "siri_routes__line_ref": line_ref, "recorded_at_time_from": _z(since), "recorded_at_time_to": _z(now),
                "order_by": "recorded_at_time desc", "limit": 2000})
            newest: dict[int, dict] = {}
            for v in locs:  # newest first: the first row of a ride wins
                if v.get("distance_from_journey_start") is None:
                    continue
                newest.setdefault(int(_dt(v["siri_ride__scheduled_start_time"]).timestamp()), v)
            for a in arrs:
                v = newest.get(int(a.ride_start.astimezone(timezone.utc).timestamp()))
                if v is None:
                    continue
                rp = self._plans.ride(a.ride_id, stop_code)
                if rp is None or rp.plan is None or rp.stop_dist is None or rp.stop_planned is None:
                    continue
                rec = _dt(v["recorded_at_time"])
                dist = float(v["distance_from_journey_start"])
                base = dict(line_ref=line_ref, ride_start=a.ride_start, recorded_at=rec, vehicle_ref=v.get("siri_ride__vehicle_ref"), origin="stride")
                if dist > rp.stop_dist + PASSED_MARGIN_M:
                    out.append(Observation(expected=None, passed=True, **base))
                elif dist < AT_ORIGIN_M:
                    out.append(Observation(expected=None, not_departed=True, **base))  # waiting at the first stop: its delay says nothing yet
                else:
                    d = delay_s(rp.plan, dist, rec.timestamp())
                    out.append(Observation(expected=rp.stop_planned + timedelta(seconds=d), distance_m=max(0.0, rp.stop_dist - dist), **base))
        return out
