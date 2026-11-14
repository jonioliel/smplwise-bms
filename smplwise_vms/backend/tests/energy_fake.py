"""CR-023: an in-memory `EnergyReadingsProvider` for tests of the billing branch (contract section 2.2).

    fake = FakeEnergyProvider(tz="Asia/Jerusalem")
    fake.add_meter("m1", "לוח ראשי")
    fake.add_readings("m1", [(datetime(2026, 9, 30, 21, 0, tzinfo=UTC), 1_000_000), (datetime(2026, 10, 31, 22, 0, tzinfo=UTC), 1_776_200)])
    fake.consumption("m1", start, end).wh

The readings are taken as accepted counter values (no reset / spike rules - feed the deltas you want); consumption is the
same allocation by time as the real store (linear between readings, exact integer split into 15-minute buckets)."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Sequence
from zoneinfo import ZoneInfo

from smplwise.services import energy_counter as ec
from smplwise.services.energy_provider import (
    BoundaryReading, Consumption, EpochInfo, HistoryWindow, MeterEvent, MeterHistory, MeterInfo, MeterStatus, add_months, coverage_of,
    history_ranges, window_from_daily,
)

UTC = dt.timezone.utc


@dataclass
class _Meter:
    info: MeterInfo
    readings: list[tuple[int, int]] = field(default_factory=list)
    status: str = "reporting"
    events: list[MeterEvent] = field(default_factory=list)


class FakeEnergyProvider:
    def __init__(self, tz: str = "Asia/Jerusalem", now: dt.datetime | None = None, stale_after_minutes: int = 60):
        self.tz = ZoneInfo(tz)
        self._meters: dict[str, _Meter] = {}
        self._now = now or dt.datetime.now(UTC)
        self.stale = stale_after_minutes

    def add_meter(self, meter_id: str, name: str, *, status: str = "active", area_name: str | None = None) -> MeterInfo:
        info = MeterInfo(meter_id, name, "ha_entity", f"sensor.{meter_id}_energy", "kWh", 1000, None, area_name, status, None, 100.0, 1, "2026-01-01T00:00:00Z", None)
        self._meters[meter_id] = _Meter(info)
        return info

    def add_readings(self, meter_id: str, readings: Sequence[tuple[dt.datetime, int]]) -> None:
        m = self._meters[meter_id]
        m.readings.extend((int(t.timestamp()), wh) for t, wh in readings)
        m.readings.sort()

    def add_event(self, meter_id: str, at: dt.datetime, kind: str, detail_wh: int | None = None) -> None:
        self._meters[meter_id].events.append(MeterEvent(at, kind, detail_wh))

    # buckets
    def _buckets(self, meter_id: str) -> dict[int, list[int]]:
        out: dict[int, list[int]] = {}
        r = self._meters[meter_id].readings
        for (t0, v0), (t1, v1) in zip(r, r[1:]):
            for b, wh, cov in ec.bucket_split(t0, t1, max(0, v1 - v0)):
                acc = out.setdefault(b, [0, 0])
                acc[0] += wh
                acc[1] += cov
        return out

    # protocol
    def get_meter(self, meter_id: str) -> MeterInfo | None:
        m = self._meters.get(meter_id)
        return m.info if m else None

    def list_meters(self, *, include_retired: bool = False) -> list[MeterInfo]:
        return [m.info for m in self._meters.values() if include_retired or m.info.status != "retired"]

    def find_meters(self, query: str, *, include_retired: bool = False) -> list[MeterInfo]:
        q = query.strip().casefold()
        return [i for i in self.list_meters(include_retired=include_retired) if q and q in i.display_name.casefold()]

    def last_report_at(self, meter_id: str) -> dt.datetime | None:
        r = self._meters[meter_id].readings
        return dt.datetime.fromtimestamp(r[-1][0], UTC) if r else None

    def meter_status(self, meter_id: str) -> MeterStatus:
        m = self._meters[meter_id]
        last = self.last_report_at(meter_id)
        if m.info.status in ("paused", "retired"):
            state = m.info.status
        elif last is not None and (self._now - last).total_seconds() <= self.stale * 60:
            state = "reporting"
        else:
            state = "not_reporting"
        return MeterStatus(meter_id, state, last, m.readings[-1][1] if m.readings else None, self.stale)

    def consumption(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> Consumption:
        a, b = int(start.timestamp()), int(end.timestamp())
        num, cov = 0, 0
        for bkt, (wh, c) in self._buckets(meter_id).items():
            ov = min(b, bkt + 900) - max(a, bkt)
            if ov <= 0:
                continue
            num += wh * ov
            cov += c if ov == 900 else round(c * ov / 900)
        wh_total = int(round(num / 900)) if cov else None
        events = tuple(e for e in self._meters[meter_id].events if start <= e.at < end)
        return Consumption(meter_id, start, end, wh_total, coverage_of(cov, b - a, wh_total), min(cov, b - a), b - a, "intervals", events)

    def consumption_many(self, meter_ids: Sequence[str], start: dt.datetime, end: dt.datetime) -> dict[str, Consumption]:
        return {m: self.consumption(m, start, end) for m in meter_ids}

    def reading_at(self, meter_id: str, at: dt.datetime) -> BoundaryReading:
        t = int(at.timestamp())
        r = self._meters[meter_id].readings
        before = max((x for x in r if x[0] <= t), default=None)
        after = min((x for x in r if x[0] > t), default=None)
        value = None
        if before and after:
            value = before[1] + round((after[1] - before[1]) * (t - before[0]) / (after[0] - before[0]))
        elif before and t - before[0] <= 900:
            value = before[1]
        exact = bool((before and t - before[0] <= 900) or (after and after[0] - t <= 900))
        f = lambda x: dt.datetime.fromtimestamp(x, UTC)  # noqa: E731
        return BoundaryReading(meter_id, at, f(before[0]) if before else None, before[1] if before else None, f(after[0]) if after else None,
                               after[1] if after else None, value, exact, None)

    def epochs(self, meter_id: str, start: dt.datetime | None = None, end: dt.datetime | None = None) -> list[EpochInfo]:
        return [EpochInfo(f"{meter_id}-e1", dt.datetime(2026, 1, 1, tzinfo=UTC), None, None, None, "first", None)]

    def _daily_rows(self, meter_id: str) -> dict[dt.date, tuple[int, int, int]]:
        rows: dict[dt.date, list[int]] = {}
        for bkt, (wh, c) in self._buckets(meter_id).items():
            d = dt.datetime.fromtimestamp(bkt, UTC).astimezone(self.tz).date()
            acc = rows.setdefault(d, [0, 0])
            acc[0] += wh
            acc[1] += c
        out = {}
        for d, (wh, c) in rows.items():
            a = dt.datetime(d.year, d.month, d.day, tzinfo=self.tz)
            n = d + dt.timedelta(days=1)
            day_s = int(dt.datetime(n.year, n.month, n.day, tzinfo=self.tz).timestamp() - a.timestamp())
            out[d] = (wh, min(c, day_s), day_s)
        return out

    def daily(self, meter_id: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, int | None]]:
        rows = self._daily_rows(meter_id)
        out, d = [], start
        while d < end:
            r = rows.get(d)
            out.append((d, r[0] if r and r[1] else None))
            d += dt.timedelta(days=1)
        return out

    def monthly(self, meter_id: str, start: dt.date, end: dt.date):
        rows = self._daily_rows(meter_id)
        out, m = [], start.replace(day=1)
        while m < end:
            w = window_from_daily(rows, m, add_months(m, 1))
            out.append((m, w.wh, w.coverage))
            m = add_months(m, 1)
        return out

    def history_windows(self, meter_ids: Sequence[str], period_start: dt.date, period_end: dt.date, tz: str, count: int = 12) -> dict[str, MeterHistory]:
        windows, last_year = history_ranges(period_start, period_end, count)
        out = {}
        for mid in meter_ids:
            rows = self._daily_rows(mid)
            out[mid] = MeterHistory(mid, tuple(window_from_daily(rows, a, b) for a, b in windows), window_from_daily(rows, *last_year))
        return out


__all__ = ["FakeEnergyProvider", "HistoryWindow"]


def seed_account(conn, account_id: str, name: str, meter_ids: Sequence[str], *, status: str = "active", draft_period: tuple[str, str] | None = None) -> None:
    """A customer, a tariff and an account using `meter_ids` in the real billing tables (migration 0055), optionally with a
    draft bill of [period_start, period_end) - what the meters side's guards (meter in use, retention) look at."""
    now = "2026-10-04T00:00:00Z"
    conn.execute("INSERT OR IGNORE INTO energy_customers(id, customer_number, name, created_at, updated_at) VALUES ('c-seed', '9999', 'לקוח', ?, ?)", (now, now))
    conn.execute("INSERT OR IGNORE INTO energy_tariffs(id, name, created_at, updated_at) VALUES ('t-seed', 'תעריף', ?, ?)", (now, now))
    conn.execute("INSERT INTO energy_accounts(id, name, customer_id, formula_json, tariff_id, period_months, period_anchor_day, first_period_start, timezone, status, created_at, updated_at) "
                 "VALUES (?, ?, 'c-seed', '{}', 't-seed', 1, 1, '2026-01-01', 'Asia/Jerusalem', ?, ?, ?)", (account_id, name, status, now, now))
    for m in meter_ids:
        conn.execute("INSERT INTO energy_account_meters(account_id, meter_id) VALUES (?, ?)", (account_id, m))
    if draft_period:
        conn.execute("INSERT INTO energy_bills(id, account_id, customer_id, period_start, period_end, state, snapshot_json, created_at, updated_at) "
                     "VALUES (?, ?, 'c-seed', ?, ?, 'draft', '{}', ?, ?)", (f"b-{account_id}", account_id, draft_period[0], draft_period[1], now, now))
