"""Data contract of the transit real-time engine (BUSRT-295). All instants are timezone-aware datetimes; the engine
converts to UTC internally and returns UTC. Display (local time, minutes, clock) is the caller's job."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

Source = Literal["realtime", "stale", "scheduled"]
Status = Literal["on_time", "late", "early", "cancelled", "not_departed", "departed", "unknown"]


@dataclass(frozen=True)
class ScheduledArrival:
    """One planned boarding at a stop. Produced by the scheduled-times feature (or StrideScheduleProvider)."""
    stop_code: int
    line_ref: int                       # the numeric route key shared by GTFS and SIRI (Stride: gtfs_route__line_ref)
    line: str                           # what the passenger reads on the bus, e.g. "25"
    destination: str
    scheduled: datetime                 # planned arrival/departure at this stop
    ride_id: int | None = None          # GTFS ride id (needed by the Stride adapter to fetch the planned distances)
    ride_start: datetime | None = None  # planned time of the ride's first stop; the join key to real-time (None -> scheduled only)


@dataclass(frozen=True)
class Observation:
    """What a real-time source knows about one ride at one stop. `expected` is None when the source only knows the
    vehicle is somewhere (no usable prediction)."""
    line_ref: int
    ride_start: datetime
    recorded_at: datetime               # when the vehicle position / prediction was made (NOT when we fetched it)
    expected: datetime | None
    cancelled: bool = False
    passed: bool = False                # the vehicle already went by this stop
    not_departed: bool = False          # known, but still at / before its first stop
    vehicle_ref: str | None = None
    origin: str = ""                    # which adapter produced it: "stride" | "mot_siri"


@dataclass(frozen=True)
class Arrival:
    """The engine's answer for one planned arrival."""
    stop_code: int
    line_ref: int
    line: str
    destination: str
    scheduled: datetime
    estimated: datetime | None          # None unless source in (realtime, stale)
    source: Source                      # realtime: fresh prediction; stale: prediction older than fresh_s; scheduled: no usable prediction
    status: Status
    delay_s: int | None                 # estimated - scheduled, seconds (negative = early); None when estimated is None
    age_s: int | None                   # now - observation.recorded_at; None when there is no observation

    @property
    def best(self) -> datetime:
        return self.estimated or self.scheduled


@dataclass(frozen=True)
class Result:
    """arrivals() output: rows inside the window plus the health of the real-time layer for this stop."""
    stop_code: int
    now: datetime
    arrivals: tuple[Arrival, ...]
    realtime_state: Literal["live", "degraded", "down", "off"]   # live: fresh data; degraded: only stale data; down: source failing, nothing usable; off: no source configured
    fetched_age_s: int | None           # age of the last successful source fetch
    last_error: str | None = None
    matched: int = 0                    # arrivals that carry real-time information (estimate or cancellation); 0 with state live = feed reachable, nothing joined


@dataclass
class Config:
    fresh_s: int = 120                  # observation younger than this -> source "realtime"
    stale_s: int = 600                  # between fresh_s and this -> "stale" (prediction shown with its age); older -> scheduled only
    ttl_s: int = 60                     # minimum seconds between source fetches for one stop (cache + de-duplication)
    backoff_max_s: int = 480            # failure back-off ceiling (60, 120, 240, 480)
    early_late_s: int = 60              # |delay| within this -> on_time
    horizon_s: int = 5400               # the observation fetch always covers now .. now + horizon (wider than any display window)
    lookback_s: int = 900               # planned arrivals up to this long ago are still tracked (a bus that is late)
    overdue_s: int = 60                 # a stale prediction this far in the past is not trusted
    max_entries: int = 64               # stops kept in the cache (least recently used out)
