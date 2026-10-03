"""CR-023 P2 section 8 / owner decisions D7 and round 2 (Q5 = b, Q6 = a): what a meter consumed in a bill window.

Only measured energy is billed. A meter is a cumulative counter, delivered by the readings store as segments (pairs of
consecutive accepted readings, resets resolved). The energy of a segment that straddles a boundary is allocated BY TIME
(seconds of overlap / seconds of the segment). A meter that has not reported up to the end of the window is billed up to its
last reading; the next bill of the account starts exactly there ("carried"), so a late report is billed once, never lost.
All arithmetic is Decimal Wh; no reading is ever estimated beyond the last one received."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from decimal import Decimal

from .energy_billing_provider import BillingReadings, Segment

LONG_GAP = dt.timedelta(hours=24)  # a boundary allocated across a gap this long gets a data note
NEAR = dt.timedelta(minutes=15)  # a reading this close to a boundary is shown as "the reading" of the boundary


@dataclass
class Anchor:
    at: dt.datetime
    reading_wh: Decimal | None
    kind: str  # reading | interpolated | carried | last_report | none


@dataclass
class MeterWindow:
    meter_id: str
    pieces_wh: list[Decimal]  # energy per piece (the carried part is inside piece 0)
    carried_in_wh: Decimal
    start: Anchor
    end: Anchor
    resets: list[dt.datetime] = field(default_factory=list)
    reported_to_end: bool = True
    long_gaps: list[tuple[dt.datetime, dt.datetime]] = field(default_factory=list)

    @property
    def wh(self) -> Decimal:
        return sum(self.pieces_wh, Decimal(0))


def _secs(a: dt.datetime, b: dt.datetime) -> Decimal:
    return Decimal(str((b - a).total_seconds()))


def _overlap(s0: dt.datetime, s1: dt.datetime, a: dt.datetime, b: dt.datetime) -> tuple[dt.datetime, dt.datetime] | None:
    lo, hi = max(s0, a), min(s1, b)
    return (lo, hi) if hi > lo else None


def _value_at(seg: Segment, at: dt.datetime) -> Decimal:
    """Interpolated raw reading at `at` inside a segment (display only)."""
    if at <= seg.t0:
        return Decimal(seg.v0_wh)
    if at >= seg.t1:
        return Decimal(seg.v1_wh)
    frac = _secs(seg.t0, at) / _secs(seg.t0, seg.t1)
    if seg.reset:
        return Decimal(seg.v0_wh) + Decimal(seg.wh) * frac
    return Decimal(seg.v0_wh) + (Decimal(seg.v1_wh) - Decimal(seg.v0_wh)) * frac


def meter_window(provider: BillingReadings, meter_id: str, bounds: list[dt.datetime], carried_from: dt.datetime | None = None,
                 stop_at: dt.datetime | None = None) -> MeterWindow:
    """Energy of one meter in the window [bounds[0], bounds[-1]) split into pieces bounds[i]..bounds[i+1].

    `carried_from` (< bounds[0]): where the previous bill of the account stopped for this meter; the energy from there to
    bounds[0] is added to the first piece and reported as carried_in. `stop_at` (< bounds[-1]): nothing after it is billed
    here (a correction whose successor bill already starts from that point)."""
    w_start, w_end = bounds[0], bounds[-1]
    stopped = stop_at is not None and stop_at < w_end
    if stopped:
        w_end = max(stop_at, w_start)
        bounds = [min(b, w_end) for b in bounds]
    eff_start = carried_from if carried_from is not None and carried_from < w_start else w_start
    segs = sorted((s for s in provider.segments(meter_id, eff_start, w_end) if s.t1 > s.t0 and s.wh >= 0), key=lambda s: s.t0) if w_end > eff_start else []
    pieces = [Decimal(0)] * (len(bounds) - 1)
    carried = Decimal(0)
    resets: list[dt.datetime] = []
    gaps: list[tuple[dt.datetime, dt.datetime]] = []
    last_t1: dt.datetime | None = None
    start_seg: Segment | None = None
    end_seg: Segment | None = None
    for seg in segs:
        ov = _overlap(seg.t0, seg.t1, eff_start, w_end)
        if ov is None:
            continue
        total = _secs(seg.t0, seg.t1)
        wh = Decimal(seg.wh)
        if start_seg is None:
            start_seg = seg
        end_seg = seg
        last_t1 = seg.t1 if last_t1 is None or seg.t1 > last_t1 else last_t1
        if seg.reset and eff_start < seg.t1 <= w_end:
            resets.append(seg.t1)
        if (seg.t0 < w_start < seg.t1 or seg.t0 < w_end < seg.t1) and seg.t1 - seg.t0 >= LONG_GAP:
            gaps.append((seg.t0, seg.t1))
        # the carried part: [eff_start, w_start)
        if eff_start < w_start:
            c = _overlap(seg.t0, seg.t1, eff_start, w_start)
            if c is not None:
                part = wh * _secs(*c) / total
                carried += part
                pieces[0] += part
        for i in range(len(pieces)):
            if bounds[i + 1] <= bounds[i]:
                continue
            o = _overlap(seg.t0, seg.t1, bounds[i], bounds[i + 1])
            if o is not None:
                pieces[i] += wh * _secs(*o) / total
    # anchors (display)
    if start_seg is None:
        start = Anchor(eff_start, None, "carried" if eff_start < w_start else "none")
        end = Anchor(eff_start, None, "last_report")
        return MeterWindow(meter_id, pieces, carried, start, end, resets, False, gaps)
    if eff_start < w_start:
        start = Anchor(eff_start, _value_at(start_seg, max(eff_start, start_seg.t0)), "carried")
    elif start_seg.t0 >= w_start:
        # the first reading is inside the window: nothing measured before it (a new meter, or the store starts there)
        start = Anchor(start_seg.t0, Decimal(start_seg.v0_wh), "reading")
    else:
        near = min(abs(start_seg.t0 - w_start), abs(start_seg.t1 - w_start))
        start = Anchor(w_start, _value_at(start_seg, w_start), "reading" if near <= NEAR and (start_seg.t0 == w_start) else "interpolated")
    assert end_seg is not None and last_t1 is not None
    if last_t1 >= w_end:
        tail = next(s for s in reversed(segs) if s.t1 >= w_end and s.t0 < w_end)
        end = Anchor(w_end, _value_at(tail, w_end), "last_report" if stopped else ("reading" if tail.t1 == w_end else "interpolated"))
        reported = True
    else:
        end = Anchor(last_t1, Decimal(end_seg.v1_wh), "last_report")
        reported = False
    return MeterWindow(meter_id, pieces, carried, start, end, resets, reported, gaps)
