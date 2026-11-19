"""CR-HEALTH-POLLERS-2440 (review 03:F11, F13, F14, F21): the shared poller thread, the shared TTL cache, and the two health reads
that reuse the recorder-health poller's reading instead of a second device call."""
from __future__ import annotations

import logging
import threading
import time

import pytest

from smplwise.services import camera_image_health, camera_sources, health_report, recorder_health
from smplwise.services.poller import PeriodicWorker
from smplwise.services.ttl_cache import TtlCache

log = logging.getLogger("test.poller")


def _worker(tick, *, interval=0.01, first_delay=0.0, env_flag="SW_TEST_POLLER_2440", default_interval=0.01, interval_fn=None):
    return PeriodicWorker(name="test-poller-2440", env_flag=env_flag, first_delay=first_delay, tick=tick,
                          interval=interval_fn or (lambda db, settings: interval), default_interval=default_interval, log=log, what="test poller")


def _wait(cond, timeout=3.0):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if cond():
            return True
        time.sleep(0.005)
    return False


# ---------------------------------------------------------------- the worker

def test_the_worker_starts_once_and_stops_in_time():
    seen = []
    w = _worker(lambda db, settings: seen.append((db, settings)))
    try:
        w.start("db", "settings")
        first = w.thread
        w.start("db", "settings")  # already running: nothing new
        assert w.thread is first and first.name == "test-poller-2440" and first.daemon
        assert _wait(lambda: len(seen) >= 2) and seen[0] == ("db", "settings")
        assert sum(1 for t in threading.enumerate() if t.name == "test-poller-2440") == 1
    finally:
        t0 = time.monotonic()
        w.shutdown(timeout=3.0)
    assert time.monotonic() - t0 < 2.0 and not first.is_alive()


def test_the_worker_stops_during_the_first_wait_without_a_pass():
    seen = []
    w = _worker(lambda db, settings: seen.append(1), first_delay=60.0)
    w.start(None, None)
    t0 = time.monotonic()
    w.shutdown(timeout=3.0)
    assert time.monotonic() - t0 < 2.0 and not w.thread.is_alive() and seen == []


def test_the_worker_stops_during_a_long_interval_and_can_start_again():
    seen = []
    w = _worker(lambda db, settings: seen.append(1), interval=60.0)
    w.start(None, None)
    assert _wait(lambda: seen == [1])
    w.shutdown(timeout=3.0)
    first = w.thread
    assert not first.is_alive()
    w.start(None, None)  # a stopped worker starts a new thread (the stop event is cleared)
    try:
        assert w.thread is not first and _wait(lambda: len(seen) == 2)
    finally:
        w.shutdown(timeout=3.0)
    assert not w.thread.is_alive()


def test_the_worker_survives_a_raising_tick(caplog):
    calls = []

    def tick(db, settings):
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("one bad pass")

    w = _worker(tick)
    with caplog.at_level(logging.ERROR, logger="test.poller"):
        w.start(None, None)
        try:
            assert _wait(lambda: len(calls) >= 3), "the loop went on after the raising pass"
        finally:
            w.shutdown(timeout=3.0)
    assert any("test poller pass failed" in r.getMessage() for r in caplog.records)


def test_a_raising_interval_skips_the_pass_and_waits_the_default():
    ticks, asked = [], []

    def interval(db, settings):
        asked.append(1)
        if len(asked) == 1:
            raise RuntimeError("no database")
        return 0.01

    w = _worker(lambda db, settings: ticks.append(len(asked)), interval_fn=interval, default_interval=0.01)
    w.start(None, None)
    try:
        assert _wait(lambda: len(ticks) >= 1)
    finally:
        w.shutdown(timeout=3.0)
    assert ticks[0] == 2, "the first pass was skipped with its interval read; the second ran"


def test_the_environment_switch_keeps_the_worker_off(monkeypatch):
    monkeypatch.setenv("SW_TEST_POLLER_2440", "0")
    w = _worker(lambda db, settings: None)
    w.start(None, None)
    assert w.thread is None
    w.shutdown()  # nothing to join


def test_shutdown_from_the_workers_own_thread_does_not_join_itself():
    done = threading.Event()
    box = {}

    def tick(db, settings):
        box["w"].shutdown()  # sets the stop event; joining the current thread would raise
        done.set()

    w = box["w"] = _worker(tick)
    w.start(None, None)
    assert done.wait(3.0)
    w.thread.join(3.0)
    assert not w.thread.is_alive()


@pytest.mark.parametrize(("mod", "name", "flag", "first"), [
    (recorder_health, "recorder-health", "SW_RECORDER_HEALTH", 15.0),
    (camera_image_health, "camera-image-health", "SW_CAMERA_IMAGE_HEALTH", 20.0),
    (camera_sources, "camera-source-health", "SW_CAMERA_SOURCE_HEALTH", 30.0),
])
def test_the_three_pollers_keep_their_names_switches_and_first_waits(mod, name, flag, first):
    p = mod.POLLER
    assert isinstance(p, PeriodicWorker) and (p.name, p.env_flag, p.first_delay) == (name, flag, first)
    p.start(None, None)  # conftest keeps the three switches off
    assert p.thread is None


def test_the_poller_passes_follow_the_modules_names(monkeypatch):
    """The pass and the tick are read from the module at each pass, so a patched `poll_once` / `TICK_S` is what runs."""
    seen = []
    monkeypatch.setattr(camera_sources, "check_once", lambda db, settings: seen.append("src"))
    monkeypatch.setattr(camera_image_health, "poll_once", lambda db, settings: seen.append("img"))
    monkeypatch.setattr(camera_sources, "TICK_S", 7.5)
    camera_sources.POLLER._tick("db", "s")
    camera_image_health.POLLER._tick("db", "s")
    assert seen == ["src", "img"] and camera_sources.POLLER._interval("db", "s") == 7.5
    assert recorder_health.POLLER._default_interval == recorder_health.THRESHOLDS["interval_s"][0]


# ---------------------------------------------------------------- the TTL cache

def test_ttl_cache_expires_and_keeps_the_stored_instant():
    clock = [100.0]
    c: TtlCache[str, dict] = TtlCache(10, clock=lambda: clock[0])
    assert c.entry("a") is None and c.get("a") is None and c.get("a", "x") == "x"
    assert c.put("a", {"v": 1}) == 100.0
    clock[0] = 109.9
    assert c.entry("a") == (100.0, {"v": 1}) and c.get("a") == {"v": 1}
    assert c.entry("a", ttl=5) is None, "a read may bring its own, shorter TTL"
    clock[0] = 110.0
    assert c.entry("a") is None and c.peek("a") == (100.0, {"v": 1}), "expired for a read, still there for peek"
    assert "a" in c and len(c) == 1
    assert c.pop("a") == {"v": 1} and c.pop("a", "gone") == "gone" and len(c) == 0


def test_ttl_cache_is_bounded_and_drops_the_oldest_quarter():
    clock = [0.0]
    c: TtlCache[int, int] = TtlCache(1000, maxsize=8, clock=lambda: clock[0])
    for i in range(8):
        clock[0] = float(i)
        c.put(i, i)
    assert len(c) == 8
    clock[0] = 8.0
    c.put(8, 8)
    assert len(c) == 7 and 0 not in c and 1 not in c and 2 in c and 8 in c
    assert c.discard(lambda k: k % 2 == 0) == 4 and sorted(k for k in range(9) if k in c) == [3, 5, 7]
    c.clear()
    assert len(c) == 0


def test_ttl_cache_load_runs_one_loader_for_concurrent_callers():
    c: TtlCache[str, int] = TtlCache(60)
    gate, started, calls, out = threading.Event(), threading.Event(), [], []

    def loader():
        calls.append(1)
        started.set()
        gate.wait(3.0)
        return 42

    threads = [threading.Thread(target=lambda: out.append(c.load("k", loader))) for _ in range(6)]
    for t in threads:
        t.start()
    assert started.wait(3.0)
    time.sleep(0.05)  # the followers reach the flight lock
    gate.set()
    for t in threads:
        t.join(3.0)
    assert out == [42] * 6 and len(calls) == 1
    assert c._flights == {}, "no flight lock is left behind"


def test_ttl_cache_load_does_not_cache_a_raising_loader_and_frees_the_flight():
    c: TtlCache[str, int] = TtlCache(60)

    def bad():
        raise RuntimeError("device down")

    with pytest.raises(RuntimeError):
        c.load("k", bad)
    assert "k" not in c and c._flights == {}
    assert c.load("k", lambda: 7) == 7 and c.load("k", bad) == 7


# ---------------------------------------------------------------- 03:F14: one reading, not a second device call

@pytest.fixture
def clean_health():
    recorder_health.reset()
    health_report.invalidate()
    yield
    recorder_health.reset()
    health_report.invalidate()


def test_recent_online_serves_only_a_young_reachable_reading(clean_health):
    assert recorder_health.recent_online("nvr-1", 10) is None
    st = recorder_health.state_of("nvr-1")
    recorder_health.record(st, reachable=True, error=None, latency_ms=12, reading=None, now_ts=1000.0, model="M", firmware="F")
    assert recorder_health.recent_online("nvr-1", 10, now_ts=1005.0) == {"model": "M", "firmware": "F", "latency_ms": 12, "checked_at": 1000.0}
    assert recorder_health.recent_online("nvr-1", 10, now_ts=1010.0) is None, "as old as the TTL: ask the device"
    assert recorder_health.recent_online("nvr-1", 10, now_ts=999.0) is None, "a reading from the future (clock moved back) is not trusted"
    recorder_health.record(st, reachable=False, error="timeout", latency_ms=None, reading=None, now_ts=1020.0)
    assert recorder_health.recent_online("nvr-1", 10, now_ts=1021.0) is None, "an unreachable reading is never served: the device is asked"


def test_the_report_probe_reuses_a_fresh_poller_reading(settings, monkeypatch, clean_health):
    import dataclasses

    from smplwise.services import nvr

    calls = []

    def device_info(s):
        calls.append(1)
        return {"model": "DEV", "firmware": "9"}

    monkeypatch.setattr(nvr, "device_info", device_info)
    s = dataclasses.replace(settings, nvr_user="u", nvr_password="p")
    out = health_report._probe_nvr(s)
    assert len(calls) == 1 and out["status"] == "ok" and out["model"] == "DEV", "no reading yet: the device is asked"
    st = recorder_health.state_of("nvr-1")
    recorder_health.record(st, reachable=True, error=None, latency_ms=31, reading=None, now_ts=recorder_health._now_ts(), model="POLL", firmware="1.2")
    out = health_report._probe_nvr(s)
    assert len(calls) == 1, "no second device call while the poller's reading is fresh"
    assert out == {"status": "ok", "detail": "מחובר · POLL · קושחה 1.2", "configured": True, "model": "POLL", "firmware": "1.2", "ms": 31}
    recorder_health.record(st, reachable=False, error="unreachable", latency_ms=None, reading=None, now_ts=recorder_health._now_ts())
    health_report._probe_nvr(s)
    assert len(calls) == 2, "an unreachable reading sends the probe to the device"
    recorder_health.record(st, reachable=True, error=None, latency_ms=5, reading=None, now_ts=recorder_health._now_ts() - health_report.PROBE_TTL_S - 1)
    health_report._probe_nvr(s)
    assert len(calls) == 3, "an old reading sends the probe to the device"


def test_cached_status_reads_the_last_probe_and_never_probes(clean_health):
    assert health_report.cached_status("go2rtc") is None
    calls = []

    def probe():
        calls.append(1)
        return {"status": "ok", "detail": "x"}

    assert health_report._cached("go2rtc", probe)["status"] == "ok"
    assert health_report._cached("go2rtc", probe)["status"] == "ok" and len(calls) == 1, "inside the TTL: one probe"
    assert health_report.cached_status("go2rtc") == "ok"
    health_report.invalidate()
    assert health_report.cached_status("go2rtc") is None
