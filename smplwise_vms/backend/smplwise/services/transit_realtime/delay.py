"""Pure delay arithmetic: a vehicle position (metres from the start of its journey) against the planned timetable of
the same ride (per stop: shape_dist_traveled metres and planned time) gives the delay of the vehicle right now.
No I/O, no clock: every function takes explicit instants (epoch seconds, UTC)."""
from __future__ import annotations

from bisect import bisect_right
from dataclasses import dataclass


@dataclass(frozen=True)
class Plan:
    """The planned timetable of one ride, reduced to the stops that carry a distance. `dist` is strictly increasing
    after construction (non-monotonic or duplicate distances are dropped); `time` is non-decreasing."""
    dist: tuple[float, ...]
    time: tuple[float, ...]

    @staticmethod
    def build(points: list[tuple[float | None, float]]) -> "Plan | None":
        """points = (shape_dist_traveled or None, planned epoch seconds) in stop order. None when fewer than two usable stops."""
        d: list[float] = []
        t: list[float] = []
        for dist, when in points:
            if dist is None:
                continue
            if d and (dist <= d[-1] or when < t[-1]):
                continue
            d.append(float(dist))
            t.append(float(when))
        if len(d) < 2:
            return None
        return Plan(tuple(d), tuple(t))


def planned_time_at(plan: Plan, dist_m: float) -> float:
    """Planned epoch seconds at a distance along the ride (linear between stops, clamped to the ends)."""
    d, t = plan.dist, plan.time
    if dist_m <= d[0]:
        return t[0]
    if dist_m >= d[-1]:
        return t[-1]
    i = bisect_right(d, dist_m)
    span = d[i] - d[i - 1]
    f = (dist_m - d[i - 1]) / span
    return t[i - 1] + f * (t[i] - t[i - 1])


def delay_s(plan: Plan, dist_m: float, recorded_at: float) -> float:
    """Positive = running late. The vehicle is `dist_m` along the ride at `recorded_at`."""
    return recorded_at - planned_time_at(plan, dist_m)


def crossing_time(obs: list[tuple[float, float]], dist_m: float, max_gap_s: float = 300.0) -> float | None:
    """Ground truth for evaluation: when did the vehicle pass `dist_m`? obs = (epoch, dist) sorted by time. Linear
    interpolation between the two samples that bracket the distance; None when they are more than max_gap_s apart."""
    for (t0, d0), (t1, d1) in zip(obs, obs[1:]):
        if d0 <= dist_m <= d1 and d1 > d0:
            if t1 - t0 > max_gap_s:
                return None
            return t0 + (dist_m - d0) / (d1 - d0) * (t1 - t0)
    return None
