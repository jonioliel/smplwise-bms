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
from typing import Any, Protocol
from zoneinfo import ZoneInfo

from . import stride

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
