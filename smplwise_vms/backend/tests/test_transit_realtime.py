"""BUSRT-295: the transit real-time engine. No third-party call is ever made: sources get recorded fixtures
(tests/fixtures/transit_realtime/, real public Stride data of line 25 Netanya recorded 2026-10-26) or hand-built
observations, and urlopen is blocked for the whole module."""
from __future__ import annotations

import json
import threading
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from smplwise.services.transit_realtime import Arrival, Config, Observation, RealtimeEngine, ScheduledArrival
from smplwise.services.transit_realtime.delay import Plan, crossing_time, delay_s, planned_time_at
from smplwise.services.transit_realtime.mot_siri import MotSiriSource, parse_stop_monitoring
from smplwise.services.transit_realtime.stride import PlanStore, StrideScheduleProvider, StrideSource, destination_from_route_name

FIX = json.loads((Path(__file__).parent / "fixtures" / "transit_realtime" / "stride_line25_2026-10-26.json").read_text(encoding="utf8"))
STOP = 33323
LINE_REF = 10278


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("a test tried to reach the network")
    monkeypatch.setattr(urllib.request, "urlopen", boom)


def T(hms: str) -> datetime:
    h, m, *s = hms.split(":")
    return datetime(2026, 10, 26, int(h), int(m), int(s[0]) if s else 0, tzinfo=timezone.utc)


class FakeStride:
    """Serves the recorded fixture the way the Stride API would; counts calls per path."""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self.fail = False

    def __call__(self, path, params):
        self.calls.append((path, dict(params)))
        if self.fail:
            raise ConnectionError("boom")
        if path == "/gtfs_ride_stops/list" and "gtfs_ride_ids" in params:
            return FIX["rides"].get(str(params["gtfs_ride_ids"]), [])
        if path == "/gtfs_ride_stops/list" and "gtfs_stop__code" in params:
            lo, hi = params["arrival_time_from"], params["arrival_time_to"]
            rows = [r for rows in FIX["rides"].values() for r in rows if r["gtfs_stop__code"] == params["gtfs_stop__code"]
                    and lo <= r["arrival_time"].replace("+00:00", "Z") <= hi]
            return sorted(rows, key=lambda r: r["arrival_time"])
        if path == "/siri_vehicle_locations/list":
            lo, hi = params["recorded_at_time_from"], params["recorded_at_time_to"]
            rows = [v for pts in FIX["locations"].values() for v in pts
                    if v["siri_route__line_ref"] == params["siri_routes__line_ref"]
                    and lo <= v["recorded_at_time"].replace("+00:00", "Z") <= hi]
            return sorted(rows, key=lambda v: v["recorded_at_time"], reverse=True)
        raise AssertionError(path)

    def count(self, path):
        return sum(1 for p, _ in self.calls if p == path)


def stride_engine(cfg=None):
    tr = FakeStride()
    plans = PlanStore(tr)
    cfg = cfg or Config()
    eng = RealtimeEngine(StrideSource(tr, plans, cfg), StrideScheduleProvider(tr, plans), cfg)
    return eng, tr


# ---------------------------------------------------------------- delay arithmetic

def test_plan_interpolates_and_clamps():
    p = Plan.build([(0, 1000), (1000, 1300), (3000, 1900)])
    assert planned_time_at(p, 500) == 1150
    assert planned_time_at(p, 2000) == 1600
    assert planned_time_at(p, -5) == 1000 and planned_time_at(p, 9999) == 1900
    assert delay_s(p, 1000, 1360) == 60
    assert delay_s(p, 1000, 1240) == -60


def test_plan_drops_missing_and_non_monotonic_distances():
    p = Plan.build([(None, 0), (100, 10), (90, 20), (100, 25), (300, 40)])
    assert p.dist == (100.0, 300.0) and p.time == (10.0, 40.0)
    assert Plan.build([(None, 0), (5, 1)]) is None


def test_crossing_time_interpolates_and_rejects_big_gaps():
    obs = [(0, 0), (60, 600), (1000, 700)]
    assert crossing_time(obs, 300) == 30
    assert crossing_time(obs, 650) is None  # bracketing samples are 940 s apart


def test_destination_from_route_name():
    assert destination_from_route_name("ת. רכבת נתניה-נתניה<->בית גיל הזהב/השקד-נתניה-2#") == "בית גיל הזהב/השקד"
    assert destination_from_route_name("a<->b-c-d-city-1#") == "b-c-d"
    assert destination_from_route_name("no arrow") == "no arrow"


# ---------------------------------------------------------------- Stride adapter on recorded data

def test_stride_late_bus_gets_a_realtime_estimate():
    eng, _ = stride_engine()
    res = eng.arrivals(STOP, T("06:10"), T("06:40"), now=T("06:17:40"))
    a = [x for x in res.arrivals if x.scheduled == T("06:15:18")][0]
    assert a.line == "25" and a.destination == "בית גיל הזהב/השקד"
    assert a.source == "realtime" and a.status == "late" and a.age_s == 8  # newest position 06:17:32
    # the recorded bus really reached the stop (1708 m) between 06:18:36 (1679 m) and 06:19:31 (1861 m)
    assert T("06:18:30") <= a.estimated <= T("06:19:30")
    assert a.delay_s is not None and 150 <= a.delay_s <= 250
    assert res.realtime_state == "live" and res.matched == 1
    # the other ride (06:30) has no position yet: scheduled, honestly marked
    b = [x for x in res.arrivals if x.scheduled == T("06:35:18")][0]
    assert (b.source, b.estimated, b.status, b.age_s) == ("scheduled", None, "unknown", None)


def test_stride_prediction_error_against_recorded_crossing():
    # ground truth from the same fixture: when did ride 06:10 cross the stop (1708 m)?
    pts = [(datetime.fromisoformat(v["recorded_at_time"]).timestamp(), v["distance_from_journey_start"]) for v in FIX["locations"]["2026-10-26T06:10:00+00:00"]]
    truth = datetime.fromtimestamp(crossing_time(pts, 1708), timezone.utc)
    eng, _ = stride_engine()
    errs = []
    for now in (T("06:16:20"), T("06:17:40"), T("06:18:40")):
        a = [x for x in eng.arrivals(STOP, T("06:10"), T("06:40"), now=now + timedelta(seconds=0)).arrivals if x.scheduled == T("06:15:18")][0]
        errs.append(abs((a.estimated - truth).total_seconds()))
        eng = stride_engine()[0]  # fresh cache for each instant
    assert max(errs) < 75  # the delay-carry predictor is within ~1 minute here; scheduled would be off by ~3.5 minutes
    assert abs((T("06:15:18") - truth).total_seconds()) > 180


def test_stride_bus_that_passed_is_departed_and_omitted():
    eng, _ = stride_engine()
    res = eng.arrivals(STOP, T("06:10"), T("06:40"), now=T("06:22:40"))
    assert all(x.scheduled != T("06:15:18") for x in res.arrivals)
    kept = eng.annotate(STOP, eng._schedule(STOP, T("06:10"), T("06:40")), T("06:22:40"), include_departed=True)
    dep = [x for x in kept.arrivals if x.scheduled == T("06:15:18")][0]
    assert dep.status == "departed" and dep.estimated is None


def test_stride_not_departed_waits_at_origin():
    eng, _ = stride_engine()
    res = eng.arrivals(STOP, T("06:30"), T("06:50"), now=T("06:26:00"))
    a = res.arrivals[0]
    assert (a.source, a.status, a.estimated) == ("scheduled", "not_departed", None)


def test_stride_old_position_is_stale_then_scheduled():
    cfg = Config(fresh_s=20)
    eng, _ = stride_engine(cfg)
    res = eng.arrivals(STOP, T("06:30"), T("06:50"), now=T("06:38:50"))  # newest position 06:38:22, 28 s old
    a = [x for x in res.arrivals if x.scheduled == T("06:35:18")]
    assert not a or a[0].status != "departed"
    b = res.arrivals[0]
    assert b.source == "stale" and b.estimated is not None and b.age_s == 28 and res.realtime_state == "degraded"
    # the same ride 20 minutes after its last position is not shown as live, nor as stale
    eng2, _ = stride_engine(Config(stale_s=60, fresh_s=20))
    res2 = eng2.arrivals(STOP, T("06:30"), T("07:30"), now=T("07:10"))
    assert all(x.source == "scheduled" for x in res2.arrivals)


def test_stride_unjoined_siri_ride_is_ignored():
    eng, tr = stride_engine()
    # the 05:23 SIRI ride has no planned counterpart in the fixture; nothing breaks and nothing is invented
    res = eng.arrivals(STOP, T("05:00"), T("05:30"), now=T("05:26"))
    assert res.arrivals == ()


def test_plan_requests_are_cached_per_ride():
    eng, tr = stride_engine()
    for now in (T("06:17:40"), T("06:19:50")):
        eng.arrivals(STOP, T("06:10"), T("06:40"), now=now)
    ride_calls = [p for p in tr.calls if p[0] == "/gtfs_ride_stops/list" and "gtfs_ride_ids" in p[1]]
    assert len(ride_calls) == len({c[1]["gtfs_ride_ids"] for c in ride_calls}) == 2


# ---------------------------------------------------------------- engine semantics with hand-built observations

class FakeSource:
    name = "fake"

    def __init__(self, obs=None):
        self.obs = list(obs or [])
        self.fail = False
        self.calls = 0
        self.gate: threading.Event | None = None

    def fetch(self, stop_code, now, rides):
        self.calls += 1
        if self.gate is not None:
            self.gate.wait(2)
        if self.fail:
            raise TimeoutError("down")
        return list(self.obs)


def sched(hms="10:10", line="7", start="10:00", ref=1):
    return ScheduledArrival(STOP, ref, line, "Dest", T(hms), 1, T(start))


def ob(expected, rec, start="10:00", ref=1, **kw):
    return Observation(ref, T(start), T(rec), T(expected) if expected else None, **kw)


def run(obs, now, rows=None, cfg=None, **kw):
    src = FakeSource(obs)
    eng = RealtimeEngine(src, config=cfg or Config(), clock=lambda: T(now))
    return eng.annotate(STOP, rows or [sched()], T(now), **kw), eng, src


def test_realtime_late_early_on_time():
    r, _, _ = run([ob("10:14", "10:05:30")], "10:06")
    a = r.arrivals[0]
    assert (a.source, a.status, a.delay_s, a.age_s) == ("realtime", "late", 240, 30)
    r, *_ = run([ob("10:07", "10:05:30")], "10:06")
    assert r.arrivals[0].status == "early" and r.arrivals[0].delay_s == -180
    r, *_ = run([ob("10:10:30", "10:05:30")], "10:06")
    assert r.arrivals[0].status == "on_time"


def test_cancelled_has_no_estimate():
    r, *_ = run([ob(None, "10:05:30", cancelled=True)], "10:06")
    a = r.arrivals[0]
    assert (a.status, a.estimated, a.source) == ("cancelled", None, "realtime")


def test_overdue_prediction_is_clamped_when_fresh_and_dropped_when_stale():
    r, *_ = run([ob("10:05", "10:05:50")], "10:06")  # predicted 10:05 but now 10:06 and the bus is still reported
    assert r.arrivals[0].estimated == T("10:06")
    r, *_ = run([ob("10:05", "10:01")], "10:06:30")  # 5.5 min old prediction in the past -> not trusted
    assert r.arrivals[0].source == "scheduled" and r.arrivals[0].estimated is None


def test_absurd_delay_is_a_bad_join():
    r, *_ = run([ob("14:10", "10:05:50")], "10:06")
    assert r.arrivals[0].source == "scheduled"


def test_age_thresholds_realtime_stale_scheduled():
    for rec, src in (("10:04", "realtime"), ("10:00:30", "stale"), ("09:50", "scheduled")):
        r, *_ = run([ob("10:12", rec)], "10:05")
        assert r.arrivals[0].source == src, rec


def test_window_uses_estimated_time_and_sorts():
    rows = [sched("10:10", "7", "10:00", 1), sched("10:20", "8", "10:10", 2)]
    # line 7 is 15 minutes late -> leaves a 10:00-10:20 window? it is at 10:25 (outside); line 8 is early at 10:18
    obs = [ob("10:25", "10:05", "10:00", 1), ob("10:18", "10:05", "10:10", 2)]
    r, *_ = run(obs, "10:06", rows, window=(T("10:00"), T("10:20")))
    assert [a.line for a in r.arrivals] == ["8"]


def test_no_source_is_scheduled_only_and_off():
    eng = RealtimeEngine(None, clock=lambda: T("10:00"))
    r = eng.annotate(STOP, [sched()], T("10:00"))
    assert r.realtime_state == "off" and r.arrivals[0].source == "scheduled"


def test_row_without_join_key_stays_scheduled():
    r, *_ = run([ob("10:14", "10:05:30")], "10:06", rows=[ScheduledArrival(STOP, 1, "7", "Dest", T("10:10"))])
    assert r.arrivals[0].source == "scheduled"


# ---------------------------------------------------------------- failure and staleness of the source

def test_source_failure_keeps_last_known_then_expires_and_backs_off():
    src = FakeSource([ob("10:14", "10:05:30")])
    eng = RealtimeEngine(src, config=Config())
    r = eng.annotate(STOP, [sched()], T("10:06"))
    assert r.arrivals[0].source == "realtime" and src.calls == 1
    src.fail = True
    r = eng.annotate(STOP, [sched()], T("10:07:05"))  # ttl passed -> fetch fails
    a = r.arrivals[0]
    assert r.realtime_state == "down" and "TimeoutError" in (r.last_error or "")
    assert a.source == "realtime" and a.estimated == T("10:14") and a.age_s == 95  # last known, still within fresh_s
    assert src.calls == 2
    eng.annotate(STOP, [sched()], T("10:07:30"))
    assert src.calls == 2  # back-off: first retry only after 60 s
    r = eng.annotate(STOP, [sched()], T("10:08:10"))
    assert src.calls == 3 and r.arrivals[0].source == "stale" and r.arrivals[0].age_s == 160  # last known, shown with its age
    eng.annotate(STOP, [sched()], T("10:09:30"))
    assert src.calls == 3  # 2nd failure -> 120 s back-off
    r = eng.annotate(STOP, [sched()], T("10:17"))  # observation is 11.5 min old > stale_s -> scheduled only
    assert r.arrivals[0].source == "scheduled" and r.arrivals[0].estimated is None and r.realtime_state == "down"
    src.fail = False
    r = eng.annotate(STOP, [sched()], T("10:30"))
    assert r.last_error is None and src.calls >= 4


def test_never_raises_into_the_caller_even_for_an_unexpected_adapter_error():
    class Bad:
        name = "bad"

        def fetch(self, *a):
            raise ValueError("schema changed")
    r = RealtimeEngine(Bad()).annotate(STOP, [sched()], T("10:00"))
    assert r.arrivals[0].source == "scheduled" and r.realtime_state == "down"


# ---------------------------------------------------------------- cache and de-duplication

def test_boards_share_one_fetch_per_ttl():
    r, eng, src = run([ob("10:14", "10:05:30")], "10:06")
    for _ in range(5):
        eng.annotate(STOP, [sched()], T("10:06:20"))
    assert src.calls == 1
    eng.annotate(STOP, [sched()], T("10:07:05"))
    assert src.calls == 2


def test_concurrent_callers_single_flight():
    src = FakeSource([ob("10:14", "10:05:30")])
    src.gate = threading.Event()
    eng = RealtimeEngine(src, config=Config())
    results = []
    ts = [threading.Thread(target=lambda: results.append(eng.annotate(STOP, [sched()], T("10:06")))) for _ in range(6)]
    for t in ts:
        t.start()
    src.gate.set()
    for t in ts:
        t.join()
    assert src.calls == 1 and len(results) == 6 and all(r.arrivals[0].source == "realtime" for r in results)


def test_new_ride_triggers_an_early_refetch_but_not_more_than_every_15s():
    src = FakeSource([])
    eng = RealtimeEngine(src, config=Config())
    eng.annotate(STOP, [sched()], T("10:06"))
    more = [sched(), sched("10:20", "8", "10:10", 2)]
    eng.annotate(STOP, more, T("10:06:05"))
    assert src.calls == 1
    eng.annotate(STOP, more, T("10:06:20"))
    assert src.calls == 2
    eng.annotate(STOP, more, T("10:06:40"))
    assert src.calls == 2


def test_cache_is_bounded():
    src = FakeSource([])
    eng = RealtimeEngine(src, config=Config(max_entries=3))
    for code in range(10):
        eng.annotate(code, [], T("10:00"))
    assert len(eng._entries) == 3


# ---------------------------------------------------------------- Ministry SIRI-SM adapter (synthetic structure, UNVERIFIED live)

SIRI_SAMPLE = {"Siri": {"ServiceDelivery": {"StopMonitoringDelivery": [{"MonitoredStopVisit": [
    {"RecordedAtTime": "2026-10-26T12:05:30+02:00", "MonitoredVehicleJourney": {
        "LineRef": "1", "VehicleRef": "123", "OriginAimedDepartureTime": "2026-10-26T12:00:00+02:00",
        "MonitoredCall": {"StopPointRef": "33323", "ExpectedArrivalTime": "2026-10-26T12:14:00+02:00"}}},
    {"RecordedAtTime": "2026-10-26T12:05:30+02:00", "MonitoredVehicleJourney": {
        "LineRef": "2", "OriginAimedDepartureTime": "2026-10-26T12:10:00+02:00", "Cancellation": True,
        "MonitoredCall": {"StopPointRef": "33323"}}},
    {"RecordedAtTime": "garbage", "MonitoredVehicleJourney": {"LineRef": "3"}},
    {"MonitoredVehicleJourney": {"LineRef": "4", "OriginAimedDepartureTime": "2026-10-26T12:00:00+02:00", "MonitoredCall": {"StopPointRef": "99999"}}},
]}]}}}


def test_mot_siri_parse_is_tolerant():
    obs = parse_stop_monitoring(SIRI_SAMPLE, STOP)
    assert [o.line_ref for o in obs] == [1, 2]
    assert obs[0].expected == T("10:14") and obs[0].recorded_at == T("10:05:30") and obs[1].cancelled
    assert parse_stop_monitoring({"nope": 1}, STOP) == [] and parse_stop_monitoring(None, STOP) == []


def test_mot_siri_through_the_engine():
    eng = RealtimeEngine(MotSiriSource(lambda code: SIRI_SAMPLE))
    r = eng.annotate(STOP, [sched("10:10", "x", "10:00", 1), sched("10:20", "y", "10:10", 2)], T("10:06"))
    a, b = r.arrivals
    assert (a.source, a.status, a.delay_s) == ("realtime", "late", 240)
    assert b.status == "cancelled"
