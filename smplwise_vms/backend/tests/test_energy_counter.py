"""CR-023 P1: the cumulative-counter rules (pure) - normal increase, reset to 0 / to a small value, noise dip, spike then
return, persisting jump, persisting drop (rebase, no energy invented), last_reset change, out-of-order, and the exact
integer split into 15-minute buckets."""
from __future__ import annotations

import random

from smplwise.services import energy_counter as ec

T0 = 1_790_000_100  # an arbitrary UTC instant (not bucket aligned)


def feed(points, max_kw=10.0, state=None, last_resets=None):
    state = state or ec.CounterState()
    spans, flags, events = [], [], []
    for i, (t, v) in enumerate(points):
        lr = last_resets[i] if last_resets else None
        out = ec.process(state, t, v, max_kw, lr)
        state = out.state
        spans += out.spans
        flags.append(out.flags)
        events += out.events
    return state, spans, flags, events


def energy(spans):
    return sum(s.wh for s in spans)


def test_first_reading_is_reference_only():
    st, spans, _f, _e = feed([(T0, 5000)])
    assert spans == [] and st.last_value_wh == 5000 and st.last_ts == T0


def test_normal_increase_spread_over_the_span():
    st, spans, flags, _e = feed([(T0, 1000), (T0 + 60, 1050), (T0 + 120, 1100)])
    assert energy(spans) == 100 and flags == [0, 0, 0]
    assert all(s.quality == ec.Q_MEASURED for s in spans)


def test_long_gap_counts_the_whole_delta_marked_spread():
    # owner D7: a gap loses nothing - three days offline, the counter delta is counted in full
    st, spans, _f, _e = feed([(T0, 10_000), (T0 + 3 * 86400, 40_000)], max_kw=5)
    assert energy(spans) == 30_000 and spans[-1].quality == ec.Q_SPREAD


def test_reset_to_zero_counts_energy_since_restart():
    st, spans, flags, events = feed([(T0, 500_000), (T0 + 60, 500_040), (T0 + 120, 30)])
    assert energy(spans) == 40 + 30
    assert flags[-1] & ec.F_RESET and events[-1][1] == "reset" and st.last_value_wh == 30


def test_reset_to_small_value_below_ten_percent():
    st, spans, flags, _e = feed([(T0, 900_000), (T0 + 600, 50_000)], max_kw=1000)
    assert flags[-1] & ec.F_RESET and energy(spans) == 50_000


def test_small_dip_is_noise_and_ignored():
    st, spans, flags, events = feed([(T0, 100_000), (T0 + 60, 99_500), (T0 + 120, 100_200)])
    assert flags[1] & ec.F_NOISE and st.last_value_wh == 100_200
    assert energy(spans) == 200  # measured from the old reference, the dip changed nothing


def test_spike_then_return_is_dropped():
    st, spans, flags, events = feed([(T0, 10_000), (T0 + 60, 9_999_999), (T0 + 120, 10_010)], max_kw=10)
    assert flags[1] & ec.F_GLITCH
    assert flags[2] & ec.F_SPIKE_DROPPED and energy(spans) == 10
    assert any(e[1] == "spike_dropped" for e in events)


def test_jump_that_persists_is_accepted():
    st, spans, flags, events = feed([(T0, 10_000), (T0 + 60, 500_000), (T0 + 120, 500_005)], max_kw=10)
    assert flags[2] & ec.F_JUMP_ACCEPTED
    assert energy(spans) == 490_000 + 5 and st.last_value_wh == 500_005


def test_persisting_drop_is_rebased_without_energy():
    st, spans, flags, events = feed([(T0, 800_000), (T0 + 60, 500_000), (T0 + 120, 500_020)], max_kw=10)
    assert flags[1] & ec.F_GLITCH and flags[2] & ec.F_REBASE
    assert energy(spans) == 20  # never invented: the step 800000 -> 500000 counts nothing
    assert st.last_value_wh == 500_020


def test_last_reset_change_is_a_reset():
    st, spans, flags, _e = feed([(T0, 5_000), (T0 + 60, 5_100), (T0 + 120, 40)], last_resets=["2026-10-01", "2026-10-01", "2026-10-02"])
    assert flags[-1] & ec.F_LAST_RESET and energy(spans) == 100 + 40


def test_out_of_order_and_duplicate_change_nothing():
    st, spans, _f, _e = feed([(T0, 1000), (T0 + 120, 1100), (T0 + 60, 1050), (T0 + 120, 1200)])
    assert energy(spans) == 100 and st.last_value_wh == 1100


def test_bucket_split_is_exact_and_aligned():
    rnd = random.Random(7)
    for _ in range(300):
        t0 = rnd.randint(0, 10**6)
        t1 = t0 + rnd.randint(1, 5 * 86400)
        wh = rnd.randint(0, 10**7)
        parts = ec.bucket_split(t0, t1, wh)
        assert sum(p[1] for p in parts) == wh
        assert sum(p[2] for p in parts) == t1 - t0
        assert all(p[0] % 900 == 0 for p in parts)


def test_bucket_split_proportional():
    parts = ec.bucket_split(0, 1800, 1000)
    assert parts == [(0, 500, 900), (900, 500, 900)]
    parts = ec.bucket_split(450, 1350, 1000)
    assert [p[1] for p in parts] == [500, 500] and [p[2] for p in parts] == [450, 450]
