"""GATEHYGIENE (2.9.1): a DETERMINISTIC guard of the manager dashboard's speed fix (MGRDASH phase 3, spec section 5) that runs in every gate.

The real speed check (test_tickets_mgrdash_perf.py, 20,000 requests against the 150 ms ceiling) is opt-in - a wall-clock budget is load-
flaky on the shared runner and seeds 220,000 rows. What makes the route fast is structural: visibility and assignments are read in BATCHES
(_Managed.prefetch -> access.visible_many, _Assignments.prefetch -> store_dash.assignments_of), never once per request. This test counts
the per-request fallbacks (access.visible_by_id, store_dash.assignment_at) on two seeds of different size and asserts the count does NOT
grow with the number of requests - a regression back to the per-ticket path fails here in seconds, on any machine, at any load.
The seed is the perf test's own cloning seed (invented data), sized down."""
from __future__ import annotations

import dataclasses

import pytest
from conftest import bind

import test_tickets_mgrdash_perf as perf
from smplwise.services.tickets import access, dashboard, store_dash
from tickets_s4_world import API, build_s4

PERIODS = ("today", "7d", "30d")


def _fallback_calls(settings, monkeypatch, tickets: int) -> dict[str, int]:
    monkeypatch.setattr(perf, "TICKETS", tickets)
    s4 = build_s4(settings, monkeypatch)
    bind(s4.c, settings, "mona", "tickets_external", "installation", "*")
    perf._seed(s4)
    calls = {"visible_by_id": 0, "assignment_at": 0}
    real_vis, real_asg = access.visible_by_id, store_dash.assignment_at

    def vis(*a, **kw):
        calls["visible_by_id"] += 1
        return real_vis(*a, **kw)

    def asg(*a, **kw):
        calls["assignment_at"] += 1
        return real_asg(*a, **kw)

    monkeypatch.setattr(access, "visible_by_id", vis)
    monkeypatch.setattr(store_dash, "assignment_at", asg)
    for user in ("mona", "joni"):
        for period in PERIODS:
            dashboard.CACHE.clear()
            r = s4.c.get(f"{API}/tickets/dashboard", params={"period": period}, headers=s4.h(user))
            assert r.status_code == 200, r.text
            if period == "30d":
                assert r.json()["throughput"]["total"]["done"] > 0, "the seed must put completions in the window (else nothing is measured)"
    monkeypatch.setattr(access, "visible_by_id", real_vis)
    monkeypatch.setattr(store_dash, "assignment_at", real_asg)
    return calls


@pytest.mark.parametrize("small,large", [(120, 360)])
def test_dashboard_per_request_reads_do_not_grow_with_the_requests(settings, tmp_path, monkeypatch, small, large):
    few = _fallback_calls(settings, monkeypatch, small)
    other = dataclasses.replace(settings, data_dir=tmp_path / "data_many")  # a second, empty installation
    many = _fallback_calls(other, monkeypatch, large)
    assert many == few, f"per-request fallback reads grew with the number of requests: {small} -> {few}, {large} -> {many}"
