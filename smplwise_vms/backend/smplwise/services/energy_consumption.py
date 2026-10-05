"""CR-023 P2 section 8 / owner decisions D7 and round 2 (Q5 = b, Q6 = a): what a meter consumed in a bill window.

Only measured energy is billed. The readings store allocates the energy between two readings BY TIME and answers
`consumption(meter, start, end)` (additive; only covered time counts). A meter that has not reported up to the end of the
window is billed up to its last report; the next bill of the account starts exactly there ("carried"), so energy reported
late is billed once - in the next bill - never lost and never twice. Decimal Wh; nothing is estimated."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from .energy_billing_provider import BillingReadings

LONG_GAP = dt.timedelta(hours=24)  # a boundary allocated across a reporting gap this long gets a data note
RESET_KINDS = ("reset", "replaced")


@dataclass
class Anchor:
    at: dt.datetime
    reading_wh: Decimal | None
    kind: str  # reading | interpolated | carried | last_report | none


@dataclass
class MeterWindow:
    meter_id: str
    pieces_wh: list[Decimal]  # energy per piece (the carried part is inside piece 0, unless carried_pieces_wh is set)
    carried_in_wh: Decimal
    start: Anchor
    end: Anchor
    resets: list[dt.datetime] = field(default_factory=list)
    reported_to_end: bool = True
    long_gaps: list[tuple[dt.datetime, dt.datetime]] = field(default_factory=list)
    partial: bool = False
    carried_pieces_wh: list[Decimal] | None = None  # EL5: the carried energy split by `carried_bounds` (kept OUT of pieces_wh)

    @property
    def wh(self) -> Decimal:
        return sum(self.pieces_wh, Decimal(0)) + (sum(self.carried_pieces_wh, Decimal(0)) if self.carried_pieces_wh is not None else Decimal(0))


def _wh(c: Any) -> Decimal:
    v = getattr(c, "wh", None)
    return Decimal(int(v)) if v is not None else Decimal(0)


def _value(br: Any) -> Decimal | None:
    v = getattr(br, "value_wh", None)
    return Decimal(int(v)) if v is not None else None


def _gap(br: Any) -> tuple[dt.datetime, dt.datetime] | None:
    if getattr(br, "exact", False):
        return None  # a reading at the boundary: nothing was allocated across it
    b, a = getattr(br, "before_at", None), getattr(br, "after_at", None)
    if b is not None and a is not None and a - b >= LONG_GAP:
        return (b, a)
    return None


def _consumptions(provider: BillingReadings, meter_id: str, windows: list[tuple[dt.datetime, dt.datetime]]) -> list[Any]:
    """`consumption` of every window. A provider with `consumption_windows` (the real store: one read of the quarter-hour
    buckets for many windows, EL5) answers in one call with the same semantics; any other provider is asked per window."""
    if not windows:
        return []
    batch = getattr(provider, "consumption_windows", None)
    if batch is not None and len(windows) > 1:
        return list(batch(meter_id, windows))
    return [provider.consumption(meter_id, a, b) for a, b in windows]


def meter_window(provider: BillingReadings, meter_id: str, bounds: list[dt.datetime], carried_from: dt.datetime | None = None,
                 stop_at: dt.datetime | None = None, carried_bounds: list[dt.datetime] | None = None) -> MeterWindow:
    """Energy of one meter in [bounds[0], bounds[-1]) split into pieces bounds[i]..bounds[i+1].

    `carried_from` (< bounds[0]): where the previous bill of the account stopped for this meter; the energy from there to
    bounds[0] is added to the first piece and reported as carried_in. `stop_at` (< bounds[-1]): nothing after it is billed
    here (a correction whose successor bill already starts from that point).

    EL5 (time-of-use): `carried_bounds` = [carried_from, ..., bounds[0]] splits the carried energy by those instants into
    `carried_pieces_wh` (so each part can take the band of the time it was used) instead of adding it to piece 0."""
    w_start, w_end = bounds[0], bounds[-1]
    stopped = stop_at is not None and stop_at < w_end
    if stopped:
        w_end = max(stop_at, w_start)
        bounds = [min(b, w_end) for b in bounds]
    eff_start = carried_from if carried_from is not None and carried_from < w_start else w_start
    last = provider.last_report_at(meter_id)
    if last is not None and last >= w_end:
        until = w_end
    elif last is not None:
        until = min(max(last, eff_start), w_end)
    else:
        until = eff_start
    pieces = [Decimal(0)] * (len(bounds) - 1)
    carried = Decimal(0)
    carried_pieces: list[Decimal] | None = None
    events: list[Any] = []
    partial = False
    split = carried_bounds is not None and len(carried_bounds) >= 2 and eff_start < w_start
    if split:
        cb = [max(min(b, w_start), eff_start) for b in carried_bounds]  # type: ignore[union-attr]
        carried_pieces = [Decimal(0)] * (len(cb) - 1)
        wins = [(i, cb[i], min(cb[i + 1], until)) for i in range(len(cb) - 1)]
        wins = [w for w in wins if w[2] > w[1]]
        for (i, _a, _b), c in zip(wins, _consumptions(provider, meter_id, [(a, b) for _i, a, b in wins])):
            carried_pieces[i] = _wh(c)
            events += list(getattr(c, "events", ()) or ())
        carried = sum(carried_pieces, Decimal(0))
    elif eff_start < w_start and until > eff_start:
        c = provider.consumption(meter_id, eff_start, min(w_start, until))
        carried = _wh(c)
        pieces[0] += carried
        events += list(getattr(c, "events", ()) or ())
    wins = [(i, bounds[i], min(bounds[i + 1], until)) for i in range(len(pieces))]
    wins = [w for w in wins if w[2] > w[1]]
    for (i, _a, _b), c in zip(wins, _consumptions(provider, meter_id, [(a, b) for _i, a, b in wins])):
        pieces[i] += _wh(c)
        partial = partial or getattr(c, "coverage", "full") != "full"
        events += list(getattr(c, "events", ()) or ())
    gaps: list[tuple[dt.datetime, dt.datetime]] = []
    if eff_start < w_start:
        br = provider.reading_at(meter_id, eff_start)
        start = Anchor(eff_start, _value(br), "carried")
    else:
        br = provider.reading_at(meter_id, w_start)
        v = _value(br)
        start = Anchor(w_start, v, "none" if v is None else ("reading" if getattr(br, "exact", False) else "interpolated"))
        g = _gap(br)
        if g:
            gaps.append(g)
    reported = until >= w_end and not stopped
    if reported:
        br = provider.reading_at(meter_id, w_end)
        end = Anchor(w_end, _value(br), "reading" if getattr(br, "exact", False) else "interpolated")
        g = _gap(br)
        if g and g not in gaps:
            gaps.append(g)
    else:
        br = provider.reading_at(meter_id, until)
        end = Anchor(until, _value(br), "last_report")
    resets = sorted({e.at for e in events if getattr(e, "kind", "") in RESET_KINDS and eff_start < e.at <= until})
    return MeterWindow(meter_id, pieces, carried, start, end, resets, until >= w_end, gaps, partial, carried_pieces)
