"""Fakes for the electricity billing tests (CR-023 P2): an in-memory readings store with the semantics of the meters
branch's EnergyReadingsProvider (docs/architecture/ELECTRICITY_INTERFACES.md section 2.1: allocation by time, additive
consumption, only covered time counts, None = no data), a pinned clock and a fake PDF renderer. No device, no Home
Assistant, no real customer data."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from smplwise.services.energy_billing_provider import BoundaryReading, Consumption, MeterEvent, MeterInfo

UTC = dt.timezone.utc
NEAR = dt.timedelta(minutes=15)


def utc(*args: int) -> dt.datetime:
    return dt.datetime(*args, tzinfo=UTC)


@dataclass
class _Seg:
    t0: dt.datetime
    t1: dt.datetime
    wh: int
    v0: int
    v1: int
    reset: bool


@dataclass
class FakeMeter:
    name: str
    readings: list[tuple[dt.datetime, int, bool]] = field(default_factory=list)  # (at, cumulative Wh, reset before this reading)
    status: str = "active"
    last_report: dt.datetime | None = None  # None = the last reading


class FakeReadings:
    def __init__(self) -> None:
        self.m: dict[str, FakeMeter] = {}
        self.calls = 0

    def add_meter(self, mid: str, name: str) -> FakeMeter:
        self.m[mid] = FakeMeter(name)
        return self.m[mid]

    def read(self, mid: str, at: dt.datetime, wh: int, reset: bool = False) -> None:
        meter = self.m[mid]
        meter.readings.append((at, wh, reset))
        meter.readings.sort(key=lambda r: r[0])

    def linear(self, mid: str, start: dt.datetime, end: dt.datetime, wh_start: int, wh_per_hour: int, step: dt.timedelta = dt.timedelta(hours=1)) -> int:
        at, wh = start, wh_start
        while at <= end:
            self.read(mid, at, wh)
            at += step
            wh += int(wh_per_hour * step.total_seconds() / 3600)
        return wh

    def _segs(self, mid: str) -> list[_Seg]:
        r = self.m[mid].readings
        out = []
        for (t0, v0, _), (t1, v1, reset) in zip(r, r[1:]):
            rs = reset or v1 < v0
            out.append(_Seg(t0, t1, v1 if rs else v1 - v0, v0, v1, rs))
        return out

    # ---- the provider subset billing uses
    def get_meter(self, meter_id: str):
        m = self.m.get(meter_id)
        return MeterInfo(meter_id, m.name, m.status) if m else None

    def list_meters(self, *, include_retired: bool = False):
        return [MeterInfo(i, m.name, m.status) for i, m in self.m.items() if include_retired or m.status != "retired"]

    def last_report_at(self, meter_id: str):
        m = self.m.get(meter_id)
        if not m or not m.readings:
            return None
        return m.last_report or m.readings[-1][0]

    def consumption(self, meter_id: str, start: dt.datetime, end: dt.datetime) -> Consumption:
        self.calls += 1
        if meter_id not in self.m or not self.m[meter_id].readings:
            return Consumption(meter_id, start, end, None, "none")
        segs = self._segs(meter_id)
        total = Decimal(0)
        covered = dt.timedelta(0)
        events = []
        for s in segs:
            lo, hi = max(s.t0, start), min(s.t1, end)
            if hi <= lo:
                continue
            covered += hi - lo
            total += Decimal(s.wh) * Decimal((hi - lo).total_seconds()) / Decimal((s.t1 - s.t0).total_seconds())
            if s.reset and start < s.t1 <= end:
                events.append(MeterEvent(s.t1, "reset", s.v1))
        if covered == dt.timedelta(0):
            return Consumption(meter_id, start, end, None, "none")
        cov = "full" if covered >= end - start else "partial"
        return Consumption(meter_id, start, end, int(total.quantize(Decimal(1), rounding=ROUND_HALF_UP)), cov, tuple(events))

    def reading_at(self, meter_id: str, at: dt.datetime) -> BoundaryReading:
        r = self.m[meter_id].readings if meter_id in self.m else []
        before = [x for x in r if x[0] <= at]
        after = [x for x in r if x[0] > at]
        b = before[-1] if before else None
        a = after[0] if after else None
        value = None
        if b and a:
            seg = next(s for s in self._segs(meter_id) if s.t0 == b[0])
            frac = Decimal((at - seg.t0).total_seconds()) / Decimal((seg.t1 - seg.t0).total_seconds())
            value = int(Decimal(seg.v0) + (Decimal(seg.wh) if seg.reset else Decimal(seg.v1 - seg.v0)) * frac)
        elif b and b[0] == at:
            value = b[1]
        elif b and not a:
            value = b[1] if at - b[0] <= NEAR else None
        exact = bool((b and at - b[0] <= NEAR) or (a and a[0] - at <= NEAR))
        if b and not a and at - b[0] > NEAR:
            value = b[1] if at == self.last_report_at(meter_id) else value
        return BoundaryReading(meter_id, at, b[0] if b else None, b[1] if b else None, a[0] if a else None, a[1] if a else None, value, exact)

    def history_wh(self, *a, **k):  # pragma: no cover - not part of the protocol billing uses
        raise NotImplementedError


class Clock:
    def __init__(self, at: dt.datetime) -> None:
        self.at = at

    def __call__(self) -> dt.datetime:
        return self.at


def fake_pdf(snapshot, *, logo=None, watermark=None) -> bytes:
    return b"%PDF-1.7\n% fake " + (snapshot["bill"]["number"] or "draft").encode() + b" " + (watermark or "-").encode() + b"\n%%EOF"
