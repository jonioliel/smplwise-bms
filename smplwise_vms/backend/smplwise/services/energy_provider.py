"""CR-023: the read-only interface the billing branch codes against - `EnergyReadingsProvider` and its implementation.

Binding contract: docs/architecture/ELECTRICITY_INTERFACES.md section 2. Energy is integer Wh; `None` means "no data",
never zero. Allocation by time at period boundaries (owner round 2, answer 5 = b); a meter that does not report is
allowed at issue with its last report date (answer 6 = a); history windows for the bill chart come from the daily
totals kept as long as bills (round 3).

    from smplwise.services.energy_provider import provider_for
    p = provider_for(conn, settings)   # conn: a main-DB connection of the caller (read or write mode)
"""
from __future__ import annotations

import calendar
import datetime as dt
import sqlite3
import time
from dataclasses import dataclass
from typing import Any, Literal, Protocol, Sequence
from zoneinfo import ZoneInfo

from ..db import get_setting
from . import energy_counter as ec
from . import energy_meters as meters
from . import energy_settings as es
from . import energy_store as st
from .timeutil import parse_utc, zone

Coverage = Literal["full", "partial", "none"]
MeterState = Literal["reporting", "not_reporting", "paused", "retired"]
UTC = dt.timezone.utc
EXACT_S = 900


@dataclass(frozen=True)
class MeterInfo:
    id: str
    display_name: str
    source_kind: str
    source_ref: str
    unit: str
    unit_factor: int
    area_id: str | None
    area_name: str | None
    status: str
    status_reason: str | None
    max_kw: float
    revision: int
    created_at: str
    retired_at: str | None


@dataclass(frozen=True)
class MeterStatus:
    meter_id: str
    state: MeterState
    last_report_at: dt.datetime | None
    last_value_wh: int | None
    stale_after_minutes: int


@dataclass(frozen=True)
class MeterEvent:
    at: dt.datetime
    kind: str          # reset | rebase | spike_dropped | jump_accepted | noise_ignored | replaced | unit_changed
    detail_wh: int | None


@dataclass(frozen=True)
class Consumption:
    meter_id: str
    start: dt.datetime
    end: dt.datetime
    wh: int | None
    coverage: Coverage
    covered_seconds: int
    total_seconds: int
    source: str
    events: tuple[MeterEvent, ...]


@dataclass(frozen=True)
class BoundaryReading:
    meter_id: str
    at: dt.datetime
    before_at: dt.datetime | None
    before_wh: int | None
    after_at: dt.datetime | None
    after_wh: int | None
    value_wh: int | None
    exact: bool
    epoch_id: str | None


@dataclass(frozen=True)
class EpochInfo:
    id: str
    started_at: dt.datetime
    ended_at: dt.datetime | None
    start_reading_wh: int | None
    end_reading_wh: int | None
    reason: str
    note: str | None


@dataclass(frozen=True)
class HistoryWindow:
    start: dt.date
    end: dt.date
    wh: int | None
    coverage: Coverage
    days_with_data: int
    days_total: int


@dataclass(frozen=True)
class MeterHistory:
    meter_id: str
    previous: tuple[HistoryWindow, ...]
    same_period_last_year: HistoryWindow


class EnergyReadingsProvider(Protocol):
    def get_meter(self, meter_id: str) -> MeterInfo | None: ...
    def list_meters(self, *, include_retired: bool = False) -> list[MeterInfo]: ...
    def find_meters(self, query: str, *, include_retired: bool = False) -> list[MeterInfo]: ...
    def meter_status(self, meter_id: str) -> MeterStatus: ...
    def last_report_at(self, meter_id: str) -> dt.datetime | None: ...
    def consumption(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> Consumption: ...
    def consumption_many(self, meter_ids: Sequence[str], start: dt.datetime, end: dt.datetime) -> dict[str, Consumption]: ...
    def reading_at(self, meter_id: str, at: dt.datetime) -> BoundaryReading: ...
    def epochs(self, meter_id: str, start: dt.datetime | None = None, end: dt.datetime | None = None) -> list[EpochInfo]: ...
    def daily(self, meter_id: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, int | None]]: ...
    def monthly(self, meter_id: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, int | None, Coverage]]: ...
    def history_windows(self, meter_ids: Sequence[str], period_start: dt.date, period_end: dt.date, tz: str, count: int = 12) -> dict[str, MeterHistory]: ...


# ---------------------------------------------------------------- helpers shared with the tests and the fake

def add_months(day: dt.date, months: int) -> dt.date:
    """`day` moved by whole months, the day clamped to the month's end (29.2 - 12 months -> 28.2)."""
    y, m = divmod(day.month - 1 + months, 12)
    year, month = day.year + y, m + 1
    return dt.date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def history_ranges(period_start: dt.date, period_end: dt.date, count: int) -> tuple[list[tuple[dt.date, dt.date]], tuple[dt.date, dt.date]]:
    """The previous `count` windows of the same size (newest first) and the same window a year earlier (contract 2.1.7)."""
    if period_end <= period_start:
        raise ValueError("period_invalid")
    windows: list[tuple[dt.date, dt.date]] = []
    months = (period_end.year - period_start.year) * 12 + period_end.month - period_start.month
    if period_start.day == period_end.day and months > 0:
        for k in range(1, count + 1):
            windows.append((add_months(period_start, -k * months), add_months(period_end, -k * months)))
    else:
        length = (period_end - period_start).days
        for k in range(1, count + 1):
            windows.append((period_start - dt.timedelta(days=k * length), period_end - dt.timedelta(days=k * length)))
    return windows, (add_months(period_start, -12), add_months(period_end, -12))


def window_from_daily(rows: dict[dt.date, tuple[int, int, int]], start: dt.date, end: dt.date) -> HistoryWindow:
    days_total = (end - start).days
    wh = 0
    with_data = 0
    full = True
    d = start
    while d < end:
        r = rows.get(d)
        if r is None or r[1] <= 0:
            full = False
        else:
            wh += r[0]
            with_data += 1
            if r[1] < r[2]:
                full = False
        d += dt.timedelta(days=1)
    if with_data == 0:
        return HistoryWindow(start, end, None, "none", 0, days_total)
    return HistoryWindow(start, end, wh, "full" if full else "partial", with_data, days_total)


def coverage_of(covered: int, total: int, wh: int | None) -> Coverage:
    if wh is None or covered <= 0:
        return "none"
    return "full" if covered >= total else "partial"


def _dt(ts: int | None) -> dt.datetime | None:
    return None if ts is None else dt.datetime.fromtimestamp(ts, UTC)


def _ts(value: dt.datetime) -> int:
    if value.tzinfo is None:
        raise ValueError("naive datetime")
    return int(value.timestamp())


EVENT_KINDS = ((ec.F_RESET, "reset"), (ec.F_REBASE, "rebase"), (ec.F_SPIKE_DROPPED, "spike_dropped"), (ec.F_JUMP_ACCEPTED, "jump_accepted"),
               (ec.F_NOISE, "noise_ignored"))


# ---------------------------------------------------------------- the implementation

class EnergyProvider:
    def __init__(self, conn: sqlite3.Connection, store: st.EnergyStore, *, tz_name: str | None = None, now: float | None = None):
        self.conn = conn
        self.store = store
        self.tz_name = tz_name or get_setting(conn, "time.zone", "Asia/Jerusalem") or "Asia/Jerusalem"
        self.tz: ZoneInfo = zone(self.tz_name)
        self._now = now

    def now(self) -> int:
        return int(self._now if self._now is not None else time.time())

    # meters
    @staticmethod
    def _info(r: sqlite3.Row) -> MeterInfo:
        return MeterInfo(r["id"], r["display_name"], r["source_kind"], r["source_ref"], r["unit"], r["unit_factor"], r["eff_area_id"], r["area_name"],
                         r["status"], r["status_reason"], float(r["max_kw"]), int(r["revision"]), r["created_at"], r["retired_at"])

    def get_meter(self, meter_id: str) -> MeterInfo | None:
        r = meters.get(self.conn, meter_id)
        return self._info(r) if r is not None else None

    def list_meters(self, *, include_retired: bool = False) -> list[MeterInfo]:
        return [self._info(r) for r in meters.list_rows(self.conn, include_retired)]

    def find_meters(self, query: str, *, include_retired: bool = False) -> list[MeterInfo]:
        q = (query or "").strip().casefold()
        return [m for m in self.list_meters(include_retired=include_retired) if q and q in m.display_name.casefold()]

    def _stale_s(self) -> int:
        return int(es.value(self.conn, "energy.stale_after_minutes")) * 60

    def meter_status(self, meter_id: str) -> MeterStatus:
        return self.statuses([meter_id])[meter_id]

    def statuses(self, meter_ids: Sequence[str]) -> dict[str, MeterStatus]:
        stale = self._stale_s()
        info = self.store.cursor_info(meter_ids)
        now = self.now()
        out: dict[str, MeterStatus] = {}
        for mid in meter_ids:
            row = meters.get(self.conn, mid)
            c = info.get(mid)
            seen = c.seen_ts if c else None
            if row is None or row["status"] == "retired":
                state: MeterState = "retired"
            elif row["status"] == "paused":
                state = "paused"
            elif seen is not None and now - seen <= stale:
                state = "reporting"
            else:
                state = "not_reporting"
            out[mid] = MeterStatus(mid, state, _dt(seen), c.seen_value_wh if c else None, stale // 60)
        return out

    def last_report_at(self, meter_id: str) -> dt.datetime | None:
        c = self.store.cursor_info([meter_id]).get(meter_id)
        return _dt(c.seen_ts) if c else None

    # consumption
    def interval_floor(self) -> int:
        months = int(es.value(self.conn, "energy.interval_retention_months"))
        floor = self.now() - int(months * es.DAYS_PER_MONTH * 86400)
        return floor - floor % st.BUCKET_S + st.BUCKET_S

    def consumption(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> Consumption:
        a, b = _ts(start), _ts(end)
        if b < a:
            raise ValueError("range_invalid")
        res = self.store.consumption(meter_id, a, b, tz=self.tz, interval_floor=self.interval_floor())
        return Consumption(meter_id, start.astimezone(UTC), end.astimezone(UTC), res["wh"], coverage_of(res["covered_s"], res["total_s"], res["wh"]),
                           int(res["covered_s"]), int(res["total_s"]), res["source"], tuple(self.events(meter_id, start, end)))

    def consumption_many(self, meter_ids: Sequence[str], start: dt.datetime, end: dt.datetime) -> dict[str, Consumption]:
        return {m: self.consumption(m, start, end) for m in meter_ids}

    def consumption_windows(self, meter_id: str, windows: Sequence[tuple[dt.datetime, dt.datetime]]) -> list[Consumption]:
        """EL5: `consumption` of many windows of one meter (time-of-use band segments) with one read of the quarter-hour
        buckets and one read of the events. Identical results to calling `consumption` per window; a window older than the
        quarter-hour retention falls back to `consumption` (the daily totals: local-midnight edges only, else ValueError)."""
        if not windows:
            return []
        spans = [(_ts(a), _ts(b)) for a, b in windows]
        if any(b < a for a, b in spans):
            raise ValueError("range_invalid")
        floor = self.interval_floor()
        if min(a for a, _ in spans) < floor:
            return [self.consumption(meter_id, a, b) for a, b in windows]
        res = self.store.consumption_windows(meter_id, spans)
        lo, hi = min(windows, key=lambda w: w[0])[0], max(windows, key=lambda w: w[1])[1]
        evs = self.events(meter_id, lo, hi)
        out: list[Consumption] = []
        for (a, b), r in zip(windows, res):
            mine = tuple(e for e in evs if a <= e.at < b)
            out.append(Consumption(meter_id, a.astimezone(UTC), b.astimezone(UTC), r["wh"], coverage_of(r["covered_s"], r["total_s"], r["wh"]),
                                   int(r["covered_s"]), int(r["total_s"]), r["source"], mine))
        return out

    def reporting_gaps(self, meter_id: str, start: dt.datetime, end: dt.datetime, min_gap: dt.timedelta) -> list[tuple[dt.datetime, dt.datetime, int]]:
        """EL5: pairs of consecutive accepted readings at least `min_gap` apart that overlap [start, end) and carry energy
        (> 0 Wh): the store spread that energy evenly over the gap, so a time-of-use split inside it is by time, not measured.
        Only raw readings are inspected (kept `energy.raw_retention_days`); older periods answer []."""
        rows = self.store.accepted_window(meter_id, _ts(start), _ts(end))
        out: list[tuple[dt.datetime, dt.datetime, int]] = []
        need = int(min_gap.total_seconds())
        for (t0, v0, _f0), (t1, v1, _f1) in zip(rows, rows[1:]):
            if t1 - t0 >= need and v1 > v0 and t1 > _ts(start) and t0 < _ts(end):
                out.append((_dt(t0), _dt(t1), v1 - v0))  # type: ignore[arg-type]
        return out

    def events(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> list[MeterEvent]:
        a, b = _ts(start), _ts(end)
        out: list[MeterEvent] = []
        for ts, value, flags in self.store.events(meter_id, a, b):
            if flags & ec.F_MANUAL:
                continue  # replacement rows: reported from the epochs below
            for bit, kind in EVENT_KINDS:
                if flags & bit:
                    out.append(MeterEvent(_dt(ts), kind, value if kind == "reset" else None))
        for e in meters.epochs(self.conn, meter_id):
            if e["reason"] == "first":
                continue
            at = parse_utc(e["started_at"])
            if a <= at.timestamp() < b:
                out.append(MeterEvent(at, "replaced", e["start_reading_wh"]))
        out.sort(key=lambda e: e.at)
        return out

    def reading_at(self, meter_id: str, at: dt.datetime) -> BoundaryReading:
        t = _ts(at)
        before, after = self.store.reading_around(meter_id, t)
        value: int | None = None
        exact = False
        if before is not None and t - before[0] <= EXACT_S:
            exact = True
        if after is not None and after[0] - t <= EXACT_S:
            exact = True
        if before is not None and after is not None and after[1] >= before[1] and after[0] > before[0]:
            value = before[1] + int(round((after[1] - before[1]) * (t - before[0]) / (after[0] - before[0])))
        elif before is not None and t - before[0] <= EXACT_S:
            value = before[1]
        elif after is not None and before is None and after[0] - t <= EXACT_S:
            value = after[1]
        epoch_id = None
        for e in meters.epochs(self.conn, meter_id):
            if parse_utc(e["started_at"]).timestamp() <= t and (e["ended_at"] is None or t < parse_utc(e["ended_at"]).timestamp()):
                epoch_id = e["id"]
        return BoundaryReading(meter_id, at.astimezone(UTC), _dt(before[0]) if before else None, before[1] if before else None,
                               _dt(after[0]) if after else None, after[1] if after else None, value, exact, epoch_id)

    def epochs(self, meter_id: str, start: dt.datetime | None = None, end: dt.datetime | None = None) -> list[EpochInfo]:
        out: list[EpochInfo] = []
        for e in meters.epochs(self.conn, meter_id):
            s = parse_utc(e["started_at"])
            f = parse_utc(e["ended_at"]) if e["ended_at"] else None
            if end is not None and s >= end:
                continue
            if start is not None and f is not None and f <= start:
                continue
            out.append(EpochInfo(e["id"], s, f, e["start_reading_wh"], e["end_reading_wh"], e["reason"], e["note"]))
        return out

    # daily / monthly / history
    def daily(self, meter_id: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, int | None]]:
        rows = self.store.daily(meter_id, start, end)
        out: list[tuple[dt.date, int | None]] = []
        d = start
        while d < end:
            r = rows.get(d)
            out.append((d, r[0] if r and r[1] > 0 else None))
            d += dt.timedelta(days=1)
        return out

    def monthly(self, meter_id: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, int | None, Coverage]]:
        first = start.replace(day=1)
        rows = self.store.daily(meter_id, first, end)
        out: list[tuple[dt.date, int | None, Coverage]] = []
        m = first
        while m < end:
            nxt = add_months(m, 1)
            w = window_from_daily(rows, m, nxt)
            out.append((m, w.wh, w.coverage))
            m = nxt
        return out

    def history_windows(self, meter_ids: Sequence[str], period_start: dt.date, period_end: dt.date, tz: str, count: int = 12) -> dict[str, MeterHistory]:
        windows, last_year = history_ranges(period_start, period_end, count)
        lo = min([w[0] for w in windows] + [last_year[0]])
        hi = max([w[1] for w in windows] + [last_year[1]])
        out: dict[str, MeterHistory] = {}
        for mid in meter_ids:
            rows = self.store.daily(mid, lo, hi)
            out[mid] = MeterHistory(mid, tuple(window_from_daily(rows, a, b) for a, b in windows), window_from_daily(rows, *last_year))
        return out


def provider_for(conn: sqlite3.Connection, settings: Any, *, now: float | None = None) -> EnergyProvider:
    return EnergyProvider(conn, st.store_for(settings), now=now)
