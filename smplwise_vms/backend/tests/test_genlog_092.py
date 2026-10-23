"""GENLOG092-295 (board row r092): the generator run log - runs (test / mains failure / manual / other), run hours, fuel used, refills and
unexplained drops, the test cadence, the settings (every threshold and window) and the default-off switch of its page. A FAKE controller
in the registry mirror and a fake clock only: no infrastructure, no device, and nothing is ever sent to a controller."""
from __future__ import annotations

import datetime as dt

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from generator_world import make_generator, set_state

from smplwise.db import Database
from smplwise.services import generator_alerts as alerts
from smplwise.services import generator_core as core
from smplwise.services import generator_log as glog
from smplwise.services import generator_runtime as runtime

API = "/api/v1/generator"
T0 = dt.datetime(2026, 10, 5, 9, 0, tzinfo=dt.timezone.utc).timestamp()
CFG = {k: s[1] for k, s in glog.LOG_SPECS.items()}


def V(**kw):
    """Live values as read_values_bulk shapes them."""
    return {k: {"value": v, "unit": "", "available": v is not None, "updated_at": None} for k, v in kw.items()}


# ---------------------------------------------------------------- pure

@pytest.mark.parametrize("values,expect", [
    (V(generator_running=True, engine_state="stopped"), True),   # the flag wins over the engine state
    (V(engine_state="running"), True),
    (V(engine_state="cooling"), True),
    (V(engine_state="fault"), False),
    (V(engine_state="starting"), None),                          # cranking: not a run yet, not a stop either
    (V(engine_state="other", rpm=1500.0), True),
    (V(rpm=40.0), False),
    (V(engine_state=None), None),
    ({}, None),
])
def test_running_of(values, expect):
    assert glog.running_of(values, 100.0) is expect


def test_mains_and_load_and_reason():
    assert glog.mains_of(V(mains_available=False), 207) is False
    assert glog.mains_of(V(mains_v_l1=230.0, mains_v_l2=0.0), 207) is True
    assert glog.mains_of(V(mains_v_l1=12.0), 207) is False
    assert glog.mains_of({}, 207) is None
    assert glog.on_load_of(V(ats_position="generator")) and glog.on_load_of(V(load_pct=40.0)) and not glog.on_load_of(V(load_pct=0.0, gen_kw=0.0))
    assert glog.start_reason_kind("Scheduled exercise") == "test" and glog.start_reason_kind("Mains failure") == "mains_failure"
    assert glog.start_reason_kind("Remote start") == "manual" and glog.start_reason_kind("") is None and glog.start_reason_kind(None) is None


def test_decide_sticky_order_and_unloaded():
    d = lambda pk, pr, obs, **kw: glog.decide(pk, pr, obs, cfg=CFG, **{"took_load": False, "mains_present": True, "duration_s": 60, **kw})  # noqa: E731
    assert d("other", None, None) == ("test", "unloaded")
    assert d("other", None, None, took_load=True) == ("other", "none")
    assert d("other", None, None, duration_s=61 * 60) == ("other", "none")      # longer than test_max_minutes (60)
    assert d("test", "mode_test", ("mains_failure", "mains_lost")) == ("mains_failure", "mains_lost")  # stronger replaces
    assert d("mains_failure", "mains_lost", ("test", "mode_test")) == ("mains_failure", "mains_lost")  # weaker never replaces
    assert d("manual", "mode_manual", None) == ("manual", "mode_manual")
    off = {**CFG, "classify_unloaded_as_test": False}
    assert glog.decide("other", None, None, took_load=False, mains_present=True, duration_s=60, cfg=off) == ("other", "none")


def test_settings_validation():
    assert glog.validate({"min_run_s": 30, "drop_min_pct": 2.5, "classify_unloaded_as_test": False}) == {"min_run_s": 30, "drop_min_pct": 2.5, "classify_unloaded_as_test": False}
    for bad in ({"min_run_s": 5}, {"min_run_s": 30.5}, {"nope": 1}, {"classify_unloaded_as_test": 1}, {"refill_min_pct": float("nan")}, {"test_interval_days": True}):
        with pytest.raises(glog.Invalid):
            glog.validate(bad)


# ---------------------------------------------------------------- the tracker on a fake controller

@pytest.fixture()
def world(settings):
    from smplwise.main import create_app
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = False
    alerts.reset()
    runtime.reset()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    db = Database(settings.db_path)
    make_generator(db, "full")
    with db.connection() as conn:
        core.jset(conn, "generator.integration_domains", ["genset_ctl"])
        core.detect(conn)
        gid = conn.execute("SELECT id FROM generator_devices").fetchone()["id"]
    return c, db, settings, gid


def track(db, ts):
    with db.connection() as conn:
        return glog.track(conn, ts)


def runs(db):
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM generator_run_log ORDER BY start_ts").fetchall()]


def fuel_events(db):
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM generator_fuel_events ORDER BY start_ts").fetchall()]


def test_a_test_run_with_hours_and_fuel(world):
    _c, db, _s, _g = world
    assert track(db, T0) == {"started": 0, "closed": 0, "fuel": 0}
    set_state(db, "sensor.gen_engine_state", "Running")
    set_state(db, "sensor.gen_mode", "Test")
    assert track(db, T0 + 60)["started"] == 1
    set_state(db, "sensor.gen_hours", "1284.75")
    set_state(db, "sensor.gen_fuel", "90")
    track(db, T0 + 60 * 15)
    set_state(db, "sensor.gen_engine_state", "Stopped")
    assert track(db, T0 + 60 * 16)["closed"] == 1
    (r,) = runs(db)
    assert (r["kind"], r["kind_reason"], r["end_reason"], r["mode_at_start"]) == ("test", "mode_test", "stopped", "test")
    out = glog.run_out(r, int(T0 + 3600), CFG)
    assert out["hours"] == 0.25 and out["hours_from_counter"] and out["fuel_used_pct"] == 2.0 and out["duration_s"] == 900 and not out["short"]
    assert fuel_events(db) == []  # consumption while running is not a "drop"


def test_a_mains_failure_run_and_the_lookback(world):
    _c, db, _s, _g = world
    set_state(db, "binary_sensor.gen_mains_ok", "off")
    track(db, T0)                                   # mains lost, engine still at rest
    set_state(db, "binary_sensor.gen_mains_ok", "on")
    set_state(db, "sensor.gen_engine_state", "Running")
    track(db, T0 + 90)                              # 90 s later the engine runs: inside the 120 s lookback
    set_state(db, "sensor.gen_engine_state", "Stopped")
    track(db, T0 + 600)
    (r,) = runs(db)
    assert (r["kind"], r["kind_reason"]) == ("mains_failure", "mains_lost")


def test_a_test_turns_into_mains_failure_when_the_mains_fail_during_it(world):
    _c, db, _s, _g = world
    set_state(db, "sensor.gen_engine_state", "Running")
    set_state(db, "sensor.gen_mode", "Test")
    track(db, T0)
    set_state(db, "binary_sensor.gen_mains_ok", "off")
    set_state(db, "sensor.gen_load", "60")
    track(db, T0 + 300)
    (r,) = runs(db)
    assert (r["kind"], r["kind_reason"], r["took_load"], r["peak_load_pct"]) == ("mains_failure", "mains_lost", 1, 60.0)


def test_unloaded_runs_short_long_and_manual(world):
    _c, db, _s, _g = world
    set_state(db, "sensor.gen_engine_state", "Running")
    track(db, T0)
    set_state(db, "sensor.gen_engine_state", "Stopped")
    track(db, T0 + 12 * 60)
    set_state(db, "sensor.gen_engine_state", "Running")
    track(db, T0 + 3600)
    set_state(db, "sensor.gen_engine_state", "Stopped")
    track(db, T0 + 3600 + 70 * 60)                 # 70 min unloaded: longer than test_max_minutes, not a test
    set_state(db, "sensor.gen_mode", "Manual")
    set_state(db, "sensor.gen_engine_state", "Running")
    track(db, T0 + 4 * 3600)
    set_state(db, "sensor.gen_engine_state", "Stopped")
    track(db, T0 + 4 * 3600 + 120)
    assert [(r["kind"], r["kind_reason"]) for r in runs(db)] == [("test", "unloaded"), ("other", "none"), ("manual", "mode_manual")]
    short = glog.run_out(runs(db)[2], int(T0 + 5 * 3600), CFG)
    assert short["short"] is False  # manual, not a test


def test_a_blip_is_not_kept_and_no_data_closes_at_the_last_reading(world):
    _c, db, _s, _g = world
    set_state(db, "sensor.gen_engine_state", "Running")
    track(db, T0)
    set_state(db, "sensor.gen_engine_state", "Stopped")
    track(db, T0 + 30)                              # 30 s < min_run_s (60)
    assert runs(db) == []
    set_state(db, "sensor.gen_engine_state", "Running")
    track(db, T0 + 600)
    track(db, T0 + 900)
    set_state(db, "sensor.gen_engine_state", "unavailable")
    set_state(db, "sensor.gen_rpm", "unavailable")
    track(db, T0 + 900 + 29 * 60)                   # unknown, not yet 30 minutes
    assert runs(db)[0]["end_ts"] is None
    track(db, T0 + 900 + 31 * 60)
    (r,) = runs(db)
    assert (r["end_ts"], r["end_reason"]) == (int(T0 + 900), "no_data")


def test_refill_is_folded_and_a_drop_at_rest_is_logged(world):
    _c, db, _s, _g = world
    set_state(db, "sensor.gen_fuel", "30")
    ts = T0
    track(db, ts)
    for v in ("40", "55", "70"):
        ts += 60
        set_state(db, "sensor.gen_fuel", v)
        track(db, ts)
    assert fuel_events(db) == []                    # still rising: one refill in progress
    for _ in range(11):
        ts += 60
        track(db, ts)
    (f,) = fuel_events(db)
    assert (f["kind"], f["from_pct"], f["to_pct"]) == ("refill", 30.0, 70.0)
    ts += 3600
    set_state(db, "sensor.gen_fuel", "64")
    track(db, ts)                                   # 6 % gone while the engine rests (>= drop_min_pct 5)
    assert [(e["kind"], e["from_pct"], e["to_pct"]) for e in fuel_events(db)][-1] == ("drop", 70.0, 64.0)


def test_runtime_tick_feeds_the_log_and_the_janitor_prunes(world):
    _c, db, settings, _g = world
    set_state(db, "sensor.gen_engine_state", "Running")
    out = runtime.tick(db, settings, T0, require_connection=False)
    assert out["run_log"]["started"] == 1  # release/2160: "runs" is the CR-INSIGHT215 recorder
    set_state(db, "sensor.gen_engine_state", "Stopped")
    runtime.tick(db, settings, T0 + 600, require_connection=False)
    assert runs(db)[0]["end_ts"] == int(T0 + 600)
    assert runtime.janitor(db, T0 + 800 * 86400)["run_log"]["runs"] == 1  # past the 730-day retention


# ---------------------------------------------------------------- the API: switch, settings, permissions

def test_api_switch_settings_and_summary(world):
    c, db, settings, g = world
    assert c.get(f"{API}/devices").json()["log_enabled"] is False  # default OFF: the page is not offered
    r = c.get(f"{API}/devices/{g}/runs")
    assert r.status_code == 409 and r.json()["code"] == "generator_log_off"
    s = c.get(f"{API}/settings").json()
    assert s["log_enabled"] is False and s["log"]["test_interval_days"] == 7 and s["log_specs"]["min_run_s"] == {"type": "int", "default": 60, "min": 10, "max": 900}
    bad = c.put(f"{API}/settings", json={"log": {"min_run_s": 2}})
    assert bad.status_code == 422 and bad.json()["details"]["fields"] == ["log.min_run_s"]
    assert c.put(f"{API}/settings", json={"log": {"nope": 1}}).status_code == 422
    ok = c.put(f"{API}/settings", json={"log_enabled": True, "log": {"test_interval_days": 14, "min_run_s": 30}})
    assert ok.status_code == 200 and ok.json()["log_enabled"] is True and ok.json()["log"]["test_interval_days"] == 14
    assert c.put(f"{API}/settings", json={"log": {"refill_min_pct": 12}}).json()["log"]["min_run_s"] == 30  # a partial save keeps the rest
    now = int(dt.datetime.now(dt.timezone.utc).timestamp())
    with db.connection() as conn:
        for i, (kind, start, dur) in enumerate((("test", now - 3 * 86400, 900), ("mains_failure", now - 86400, 3600), ("test", now - 400 * 86400, 600))):
            conn.execute("""INSERT INTO generator_run_log(id, device_id, start_ts, end_ts, end_reason, kind, kind_reason, took_load, hours_start, hours_end, fuel_start_pct, fuel_end_pct, last_run_ts)
                            VALUES (?,?,?,?, 'stopped', ?, 'mode_test', 0, 100, ?, 80, 78, ?)""", (f"r{i}", g, start, start + dur, kind, 100 + dur / 3600, start + dur))
        conn.execute("INSERT INTO generator_fuel_events(id, device_id, kind, start_ts, end_ts, from_pct, to_pct) VALUES ('f1', ?, 'refill', ?, ?, 40, 90)", (g, now - 2 * 86400, now - 2 * 86400 + 600))
    body = c.get(f"{API}/devices/{g}/runs?range=30d&page_size=1").json()
    assert body["total"] == 2 and body["pages"] == 2 and body["runs"][0]["kind"] == "mains_failure"
    sm = body["summary"]
    assert sm["by_kind"] == {"test": 1, "mains_failure": 1, "manual": 0, "other": 0} and sm["hours"] == 1.25 and sm["fuel_used_pct"] == 4.0
    assert sm["refills"] == 1 and sm["refilled_pct"] == 50.0 and sm["last_test"]["id"] == "r0" and sm["test_interval_days"] == 14 and sm["test_overdue"] is False
    assert body["fuel_events"][0]["delta_pct"] == 50.0
    assert c.get(f"{API}/devices/{g}/runs?range=30d&kind=test").json()["total"] == 1
    assert c.get(f"{API}/devices/{g}/runs?range=custom&from=2026-01-01T00:00:00Z&to=2025-01-01T00:00:00Z").status_code == 422
    assert c.get(f"{API}/devices/nope/runs").status_code == 404
    # the operator (generator.view) reads the log; the viewer (no generator.view) does not; settings stay manage-only
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    assert c.get(f"{API}/devices/{g}/runs", headers=as_user("ops")).status_code == 200
    assert c.get(f"{API}/devices/{g}/runs", headers=as_user("vera")).status_code == 403
    assert c.put(f"{API}/settings", json={"log_enabled": False}, headers=as_user("ops")).status_code == 403


def test_no_route_of_the_log_writes_to_the_controller():
    """Read-only by construction: the only new route is a GET, and the tracker never calls the infrastructure."""
    import inspect

    from smplwise.routers import generator as gr

    src = inspect.getsource(glog)
    assert "call_service" not in src and "ha_client" not in src and "websocket" not in src.lower()
    assert [r for r in gr.router.routes if getattr(r, "path", "").endswith("/runs")][0].methods == {"GET"}
