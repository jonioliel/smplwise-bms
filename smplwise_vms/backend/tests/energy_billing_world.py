"""Fakes for the electricity billing tests (CR-023 P2): a readings store built from synthetic cumulative readings, a pinned
clock and a fake PDF renderer. No device, no Home Assistant, no real customer data."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from smplwise.services.energy_billing_provider import MeterInfo, Segment

UTC = dt.timezone.utc


def utc(*args: int) -> dt.datetime:
    return dt.datetime(*args, tzinfo=UTC)


@dataclass
class FakeMeter:
    name: str
    readings: list[tuple[dt.datetime, int, bool]] = field(default_factory=list)  # (at, cumulative Wh, reset before this reading)
    last_report_at: dt.datetime | None = None
    status: str = "active"


class FakeReadings:
    """Segments are consecutive readings; a reset reading counts its own value as the energy since the restart."""

    def __init__(self) -> None:
        self.m: dict[str, FakeMeter] = {}

    def add_meter(self, mid: str, name: str) -> FakeMeter:
        self.m[mid] = FakeMeter(name)
        return self.m[mid]

    def read(self, mid: str, at: dt.datetime, wh: int, reset: bool = False) -> None:
        meter = self.m[mid]
        meter.readings.append((at, wh, reset))
        meter.readings.sort(key=lambda r: r[0])
        if meter.last_report_at is None or at > meter.last_report_at:
            meter.last_report_at = at

    def linear(self, mid: str, start: dt.datetime, end: dt.datetime, wh_start: int, wh_per_hour: int, step: dt.timedelta = dt.timedelta(hours=1)) -> int:
        at, wh = start, wh_start
        while at <= end:
            self.read(mid, at, wh)
            at += step
            wh += int(wh_per_hour * step.total_seconds() / 3600)
        return wh

    # ---- the protocol
    def meters(self, meter_ids=None) -> dict[str, MeterInfo]:
        ids = list(self.m) if meter_ids is None else [i for i in meter_ids if i in self.m]
        return {i: MeterInfo(i, self.m[i].name, self.m[i].status, self.m[i].last_report_at) for i in ids}

    def _segments(self, mid: str) -> list[Segment]:
        r = self.m[mid].readings
        out = []
        for (t0, v0, _), (t1, v1, reset) in zip(r, r[1:]):
            wh = v1 if reset or v1 < v0 else v1 - v0
            out.append(Segment(t0, t1, wh, v0, v1, reset or v1 < v0))
        return out

    def segments(self, meter_id, start, end):
        if meter_id not in self.m:
            return []
        return [s for s in self._segments(meter_id) if s.t1 > start and s.t0 < end]

    def history_wh(self, meter_id, start, end):
        if meter_id not in self.m:
            return None
        segs = [s for s in self._segments(meter_id) if s.t0 >= start and s.t1 <= end]
        if not segs:
            return None
        total = sum(s.wh for s in segs)
        complete = segs[0].t0 <= start + dt.timedelta(hours=2) and segs[-1].t1 >= end - dt.timedelta(hours=2)
        return total, complete


class Clock:
    def __init__(self, at: dt.datetime) -> None:
        self.at = at

    def __call__(self) -> dt.datetime:
        return self.at


def fake_pdf(snapshot, *, logo=None, watermark=None) -> bytes:
    return b"%PDF-1.7\n% fake " + (snapshot["bill"]["number"] or "draft").encode() + b" " + (watermark or "-").encode() + b"\n%%EOF"
