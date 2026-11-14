"""SECFIX2-295 / PUB-04 step zero (docs/security/PROPOSAL_PUB04_PORTAL_START_TIMING.md section 3): MEASURE the known-versus-unknown
number difference of `POST /t/api/portal/start` before anyone decides on `vendor_portal.start_worker` (owner 2026-10-21: the switch stays
OFF; the measurement is a documented step, not a flip).

Skipped unless `SW_MEASURE_PORTAL_START=1`. Run it on the runner, alone (no gate, no other job: the numbers are timing):

    SW_MEASURE_PORTAL_START=1 SW_MEASURE_N=500 ~/run_remote.sh backend <branch> tests/test_secfix2_pub04_timing_measure.py -s

What is measured, per mode (the default BackgroundTask, then the worker): the wall time of the WHOLE ASGI call as the in-process test
client sees it (Starlette's test client returns after the background task finished - the same span the edge's in-flight slot and the
keep-alive connection are held), N calls with a known number and N with an unknown one, interleaved. Printed and written as JSON to
`SW_MEASURE_OUT` (default: the pytest tmp dir): median, p95 and the median difference known - unknown in milliseconds. Through
cloudflared the noise is larger; this is the in-process upper bound of the signal. Record the printed line in CR-VENDOR-PORTAL section 6.
The test asserts nothing about the size of the difference - only that both modes answered every call with the same 202."""
from __future__ import annotations

import json
import os
import statistics
import time
from pathlib import Path

import pytest
from test_tickets_vendor_portal import UNKNOWN, assigned, env, portal_on, public, settings_put  # noqa: F401 - `env` is a fixture
from tickets_s4_world import PHONE_A

from smplwise.services.tickets import public_portal, vendor_portal

pytestmark = pytest.mark.skipif(os.environ.get("SW_MEASURE_PORTAL_START") != "1", reason="timing measurement: opt-in (SW_MEASURE_PORTAL_START=1)")


def _p95(xs: list[float]) -> float:
    s = sorted(xs)
    return s[min(len(s) - 1, int(round(0.95 * (len(s) - 1))))]


def _measure(env, n: int) -> dict[str, float]:
    c, _ = public(env)
    known: list[float] = []
    unknown: list[float] = []
    bodies = set()
    for i in range(n):
        for phone, bucket in ((PHONE_A, known), (UNKNOWN, unknown)) if i % 2 == 0 else ((UNKNOWN, unknown), (PHONE_A, known)):
            t0 = time.perf_counter()
            r = c.post("/t/api/portal/start", json={"phone": phone})
            bucket.append((time.perf_counter() - t0) * 1000.0)
            bodies.add((r.status_code, r.content))
    assert bodies == {(202, b'{"code":"sent_if_registered"}')}, bodies
    return {"known_median_ms": statistics.median(known), "unknown_median_ms": statistics.median(unknown),
            "known_p95_ms": _p95(known), "unknown_p95_ms": _p95(unknown),
            "median_diff_ms": statistics.median(known) - statistics.median(unknown), "n": n}


def test_measure_portal_start_known_vs_unknown(env, monkeypatch, tmp_path):
    n = int(os.environ.get("SW_MEASURE_N", "200"))
    portal_on(env)
    assigned(env)
    # the edge's per-network / installation limits and the per-number caps would refuse or short-cut a long run: lift them for the
    # measurement only, so every known-number call walks the full path (lookup, code row, outbox insert) like a first request does
    import dataclasses
    import datetime as dt

    from smplwise.services.tickets import ratelimit

    original = ratelimit.PublicLimits
    big = ((3600.0, 10 ** 9),)
    monkeypatch.setattr(ratelimit, "PublicLimits", lambda: dataclasses.replace(original(), portal_start_per_network=big, portal_start_global=big))
    monkeypatch.setattr(vendor_portal, "COOLDOWN", dt.timedelta(0))
    monkeypatch.setattr(vendor_portal, "PER_NUMBER_HOUR", 10 ** 9)
    monkeypatch.setattr(vendor_portal, "PER_NUMBER_DAY", 10 ** 9)
    monkeypatch.setattr(vendor_portal, "SENT_PER_DAY", 10 ** 9)
    results = {"background_task": _measure(env, n)}
    assert settings_put(env, vendor_portal={"start_worker": True}).status_code == 200
    results["worker"] = _measure(env, n)
    public_portal.worker_for(env.s4.db).wait_idle(30.0)
    assert settings_put(env, vendor_portal={"start_worker": False}).status_code == 200, "the switch is left OFF (owner 2026-10-21)"
    out = Path(os.environ.get("SW_MEASURE_OUT") or tmp_path / "pub04_timing.json")
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print("PUB04_TIMING " + json.dumps(results))
