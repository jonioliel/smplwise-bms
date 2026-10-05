"""CR-023 P1: the cumulative-counter rules of an electricity meter (pure functions, no I/O).

A meter is a cumulative counter (an odometer). For every new reading R at t1 and the last accepted reading P at t0 of
the same counter life (epoch) this module decides how much energy to count and over which time span, and keeps the
small processing state (`CounterState`). The store (services/energy_store.py) spreads the spans into 15-minute buckets.
Rules (docs/architecture/ELECTRICITY_INTERFACES.md section 4, CR-023 section 8, owner decision D7: bill only what was
measured, a gap loses nothing because the delta between readings stays correct):

- 0 <= R - P <= cap: accepted, spread over [t0, t1]. cap = max_kw x hours x 1.5 x 1000 + 50 Wh.
- R - P > cap: held (a possible spike). The next reading decides: it continues from R -> the jump was real (counted over
  [t0, tR]); it is back at the P level -> R was a spike and is dropped; otherwise the new reading is held instead.
- R < P: R <= 10% of P or R <= 1000 Wh -> a reset (the counter restarted; the energy since the restart, R, counts);
  a drop under 10% of P and under 1000 Wh -> noise, ignored (P stays the reference); any other drop is held, and when the
  next reading continues from it the counter is rebased with NO energy for that step (never invented).
- a change of `last_reset` (state_class total) -> a reset.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace

# reading flags (energy.db readings.flags)
F_RESET = 1
F_GLITCH = 2
F_AFTER_UNAVAILABLE = 4
F_NOISE = 8
F_SPIKE_DROPPED = 16
F_JUMP_ACCEPTED = 32
F_REBASE = 64
F_MANUAL = 128
F_LAST_RESET = 256
F_MANUAL_READING = 512  # EL6: a typed reading of the physical meter that closed or reshaped a reporting gap (not a replacement)

FLAG_NAMES = {F_RESET: "reset", F_GLITCH: "glitch", F_AFTER_UNAVAILABLE: "after_unavailable", F_NOISE: "noise", F_SPIKE_DROPPED: "spike_dropped",
              F_JUMP_ACCEPTED: "jump_accepted", F_REBASE: "rebase", F_MANUAL: "manual", F_LAST_RESET: "last_reset", F_MANUAL_READING: "manual_reading"}

# interval quality
Q_MEASURED = 0     # both readings within MEASURED_SPAN_S
Q_SPREAD = 1       # spread over a longer gap (still the exact delta of the counter)
Q_MANUAL = 4       # a typed reading (meter replacement, EL6 manual reading)
MEASURED_SPAN_S = 960

RESET_FRACTION = 0.10
RESET_ABS_WH = 1000
NOISE_FRACTION = 0.10
NOISE_ABS_WH = 1000
CAP_FACTOR = 1.5
CAP_SLACK_WH = 50


def flag_names(flags: int) -> list[str]:
    return [name for bit, name in FLAG_NAMES.items() if flags & bit]


@dataclass(frozen=True)
class Span:
    """Energy `wh` to spread linearly over [t0, t1] (epoch seconds). wh may be 0 (the span is still covered)."""

    t0: int
    t1: int
    wh: int
    quality: int


@dataclass(frozen=True)
class CounterState:
    last_ts: int | None = None
    last_value_wh: int | None = None
    held_ts: int | None = None
    held_value_wh: int | None = None
    held_kind: str | None = None  # 'up' | 'down'
    last_reset: str | None = None


@dataclass
class Outcome:
    state: CounterState
    spans: list[Span] = field(default_factory=list)
    flags: int = 0
    events: list[tuple[int, str, int | None]] = field(default_factory=list)  # (ts, kind, detail_wh)
    accepted: bool = False   # the reading became the new reference (or was a held one confirmed)


def cap_wh(max_kw: float, t0: int, t1: int) -> float:
    return max(0.0, max_kw) * max(0, t1 - t0) / 3600.0 * 1000.0 * CAP_FACTOR + CAP_SLACK_WH


def quality_of(t0: int, t1: int) -> int:
    return Q_MEASURED if t1 - t0 <= MEASURED_SPAN_S else Q_SPREAD


def _span(t0: int, t1: int, wh: int) -> Span:
    return Span(t0, t1, wh, quality_of(t0, t1))


def process(state: CounterState, ts: int, value_wh: int, max_kw: float, last_reset: str | None = None) -> Outcome:
    """Apply one reading. Out-of-order or duplicate readings (ts <= last accepted) change nothing."""
    if state.last_ts is None or state.last_value_wh is None:
        return Outcome(replace(state, last_ts=ts, last_value_wh=value_wh, held_ts=None, held_value_wh=None, held_kind=None, last_reset=last_reset), accepted=True)
    t0, p = state.last_ts, state.last_value_wh
    if ts <= t0 or (state.held_ts is not None and ts <= state.held_ts):
        return Outcome(state)
    if last_reset is not None and state.last_reset is not None and last_reset != state.last_reset:
        out = Outcome(replace(state, last_ts=ts, last_value_wh=value_wh, held_ts=None, held_value_wh=None, held_kind=None, last_reset=last_reset), accepted=True)
        out.spans.append(_span(t0, ts, max(0, value_wh)))
        out.flags |= F_RESET | F_LAST_RESET
        out.events.append((ts, "reset", max(0, value_wh)))
        return out
    if last_reset is not None:
        state = replace(state, last_reset=last_reset)

    if state.held_ts is not None and state.held_value_wh is not None:
        hts, hv = state.held_ts, state.held_value_wh
        cleared = replace(state, held_ts=None, held_value_wh=None, held_kind=None)
        if 0 <= value_wh - hv <= cap_wh(max_kw, hts, ts):  # the held reading is confirmed by this one
            out = Outcome(replace(cleared, last_ts=ts, last_value_wh=value_wh), accepted=True)
            if state.held_kind == "up":
                out.spans.append(Span(t0, hts, hv - p, Q_SPREAD))
                out.events.append((hts, "jump_accepted", hv - p))
                out.flags |= F_JUMP_ACCEPTED
            else:  # a drop that persists: rebase, the step [t0, hts] gets no energy and stays uncovered
                out.events.append((hts, "rebase", None))
                out.flags |= F_REBASE
            out.spans.append(_span(hts, ts, value_wh - hv))
            return out
        if 0 <= value_wh - p <= cap_wh(max_kw, t0, ts):  # back at the old level: the held reading was a spike
            out = Outcome(replace(cleared, last_ts=ts, last_value_wh=value_wh), accepted=True)
            out.spans.append(_span(t0, ts, value_wh - p))
            out.events.append((hts, "spike_dropped", hv - p))
            out.flags |= F_SPIKE_DROPPED
            return out
        state = cleared  # neither: judge this reading against P afresh (it may be held in turn)

    d = value_wh - p
    if d >= 0:
        if d <= cap_wh(max_kw, t0, ts):
            out = Outcome(replace(state, last_ts=ts, last_value_wh=value_wh), accepted=True)
            out.spans.append(_span(t0, ts, d))
            return out
        out = Outcome(replace(state, held_ts=ts, held_value_wh=value_wh, held_kind="up"))
        out.flags |= F_GLITCH
        return out
    if value_wh <= RESET_FRACTION * p or value_wh <= RESET_ABS_WH:
        energy = max(0, value_wh)
        out = Outcome(replace(state, last_ts=ts, last_value_wh=value_wh), accepted=True)
        out.spans.append(_span(t0, ts, energy))
        out.flags |= F_RESET
        out.events.append((ts, "reset", energy))
        return out
    if -d < NOISE_FRACTION * p and -d < NOISE_ABS_WH:
        out = Outcome(state)
        out.flags |= F_NOISE
        out.events.append((ts, "noise_ignored", -d))
        return out
    out = Outcome(replace(state, held_ts=ts, held_value_wh=value_wh, held_kind="down"))
    out.flags |= F_GLITCH
    return out


def bucket_split(t0: int, t1: int, wh: int, size: int = 900) -> list[tuple[int, int, int]]:
    """Spread `wh` over [t0, t1] into `size`-second buckets aligned to the UTC epoch: [(bucket_start, wh, covered_s)].
    Integer split on the cumulative line (share = floor(cum(end)) - floor(cum(start))), so the parts add up to `wh`
    exactly and ANY run of whole buckets (a day, a period) is within 1 Wh of its exact linear share."""
    if t1 <= t0:
        return []
    total = t1 - t0
    out: list[tuple[int, int, int]] = []
    b = t0 - (t0 % size)
    while b < t1:
        s, e = max(t0, b), min(t1, b + size)
        if e > s:
            share = (wh * (e - t0)) // total - (wh * (s - t0)) // total
            out.append((b, share, e - s))
        b += size
    return out
