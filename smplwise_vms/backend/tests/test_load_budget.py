"""LOAD-BUDGET-2530 (T068): the resource-budget load run (tests/soak/load_budget.py) and its budget file (load_budget.json).

Fast checks always run (pure helpers, the budget evaluator, the window numbers from synthetic samples, the budget file's shape).
The short end-to-end run (backend process, fakes, the full client mix, the report) is opt-in, like the other soaks:

    SW_SOAK=1 python -m pytest tests/test_load_budget.py -s -p no:cacheprovider
    (SW_LOAD_BUDGET_MIN: minutes of measurement, default 1)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

SOAK = Path(__file__).resolve().parent / "soak"
if str(SOAK) not in sys.path:
    sys.path.insert(0, str(SOAK))

import load_budget as lb  # noqa: E402

DRAIN_KEYS = {"drain_ws_open", "drain_live_sessions", "drain_event_subscribers", "drain_go2rtc_media"}


def test_quantiles_slope_and_growth() -> None:
    assert lb.quantile_ms([], 0.5) is None
    vals = [0.001 * i for i in range(1, 101)]
    assert 49 <= lb.quantile_ms(vals, 0.5) <= 51 and 94 <= lb.quantile_ms(vals, 0.95) <= 96
    assert lb.slope_per_hour([(0, 1.0), (1, 2.0)]) is None  # too few points
    assert lb.slope_per_hour([(0, 5.0), (0, 6.0), (0, 7.0)]) is None  # no time spread
    assert lb.slope_per_hour([(0, 100.0), (1800, 105.0), (3600, 110.0)]) == 10.0
    assert lb.slope_per_hour([(0, 100.0), (1800, None), (3600, 100.0), (7200, 100.0)]) == 0.0
    assert lb.growth([None]) is None
    assert lb.growth([100, 101, 99, 140, 120, 121, 119]) == 20.0  # one noisy sample in the middle does not count
    assert lb.growth([10, 30]) == 20.0


def test_route_table_counts_errors_but_not_documented_states() -> None:
    routes = {"cameras": [0.01, 0.02, 0.03], "notices_display": [0.005, 0.006]}
    codes = {"cameras 200": 2, "cameras 500": 1, "notices_display 304": 1, "notices_display 200": 1, "live_info 409": 3,
             "me 404": 1, "me ConnectError": 2}
    t = lb.route_table(routes, codes)
    assert t["cameras"]["n"] == 3 and t["cameras"]["errors"] == 1 and t["cameras"]["max_ms"] == 30.0
    assert t["notices_display"]["errors"] == 0  # 304 Not Modified is the board's normal answer
    assert "live_info" not in t  # soak_long's documented 409 / 429: no error, and no latency kept in this table
    assert t["me"] == {"n": 0, "p50_ms": None, "p95_ms": None, "max_ms": None, "errors": 3}
    g = lb.group_latency(t, routes, ["cameras", "notices_display", "absent"])
    assert g["n"] == 5 and g["worst_route"] == "cameras" and g["worst_route_p95_ms"] == 30.0


def test_evaluate_statuses_and_restart_limits() -> None:
    budget = {"latency": {"screens": {"routes": ["a"], "p50_ms": 300, "p95_ms": 1500}},
              "checks": {"rss_growth_mb": {"max": 40, "max_with_restarts": 120}, "rss_slope_mb_per_h": {"max": 15, "min_window_min": 120},
                         "err_5xx": {"max": 0}, "cpu_avg_pct": {"max": 60}}}
    measured = {"window_s": 600, "latency_groups": {"screens": {"p50_ms": 120.0, "p95_ms": 1600.0}}, "rss_growth_mb": 80.0,
                "rss_slope_mb_per_h": 400.0, "err_5xx": 0, "cpu_avg_pct": None}
    rows = {r["line"]: r for r in lb.evaluate(budget, measured)}
    assert rows["screens.p50_ms"]["status"] == "PASS" and rows["screens.p95_ms"]["status"] == "FAIL"
    assert rows["rss_growth_mb"]["status"] == "FAIL" and rows["rss_growth_mb"]["limit"] == 40
    assert rows["rss_slope_mb_per_h"]["status"] == "SKIPPED"  # a 10 min window does not judge a leak slope
    assert rows["err_5xx"]["status"] == "PASS" and rows["cpu_avg_pct"]["status"] == "N/A"
    assert lb.verdict(list(rows.values())) == "FAIL"
    rows = {r["line"]: r for r in lb.evaluate(budget, {**measured, "window_s": 3 * 3600}, restarts=True)}
    assert rows["rss_growth_mb"]["status"] == "PASS" and rows["rss_growth_mb"]["limit"] == 120
    assert rows["rss_slope_mb_per_h"]["status"] == "FAIL"
    assert lb.verdict([{"status": "PASS"}, {"status": "N/A"}, {"status": "SKIPPED"}]) == "PASS"


def test_budget_file_lines_are_all_measured(tmp_path: Path) -> None:
    budget = json.loads(lb.BUDGET_FILE.read_text(encoding="utf-8"))
    assert budget["version"] >= 1
    for gname, spec in budget["latency"].items():
        assert spec["routes"] and any(k in spec for k in ("p50_ms", "p95_ms", "worst_route_p95_ms")), gname
    for name, spec in budget["checks"].items():
        assert isinstance(spec.get("max"), (int, float)) and spec.get("unit") and spec.get("what"), name
        if "max_with_restarts" in spec:
            assert spec["max_with_restarts"] >= spec["max"], name
    # every check is a value the run produces: the window numbers from synthetic samples, the drain numbers, the idle line
    a = lb.parse(["--run-dir", str(tmp_path), "--minutes", "1"])
    run = lb.LoadBudget(a)
    rows = [{"phase": "measure", "elapsed_s": 30 * i, "rss_mb": 200 + i, "private_mb": 180 + i, "cpu_pct": 20, "fds": 60, "threads": 40,
             "py_objects": 500000, "wal_bytes": 4 << 20, "loop_lag_p99_ms": 5, "loop_lag_max_ms": 9, "ws_live_open": 2, "ws_events_open": 3,
             "live_sessions": 2, "events_subscribers": 3, "go2rtc_streams": 8, "go2rtc_ws_open": 2, "backend_sockets": 30} for i in range(6)]
    w0 = {"cpu_s": 10.0, "rss_mb": 200, "stats": {"db_bytes": 10 << 20, "wal_bytes": 1 << 20}}
    w1 = {"cpu_s": 70.0, "rss_mb": 205, "stats": {"db_bytes": 15 << 20, "wal_bytes": 1 << 20}}
    m = run.window_numbers(rows, w0, w1, 300.0, {"log": {"database_is_locked": 0}, "db_write_lock": {"max_hold_s": 0.2}, "ingest": {"dropped": 0}})
    assert m["cpu_avg_pct"] == 20.0 and m["db_growth_mb"] == 5.0 and m["db_growth_mb_per_h"] == 60.0
    assert m["rss_growth_mb"] == 3.0 and m["go2rtc_media_over_viewers"] == -2 and m["sockets_growth"] == 0
    produced = set(m) | DRAIN_KEYS | {"rss_idle_mb", "stuck_client_threads"}
    assert set(budget["checks"]) <= produced, set(budget["checks"]) - produced


def test_reevaluate_a_finished_run(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    measured = {"window_s": 600, "rss_idle_mb": 120.0, "err_5xx": 0, "latency_groups": {}}
    (tmp_path / "budget_report.json").write_text(json.dumps({"measured": measured, "routes": {}}), encoding="utf-8")
    (tmp_path / "config.json").write_text(json.dumps({"restarts": False, "mix": {}}), encoding="utf-8")
    budget = tmp_path / "b.json"
    budget.write_text(json.dumps({"checks": {"rss_idle_mb": {"max": 150}}}), encoding="utf-8")
    assert lb.main(["--evaluate", str(tmp_path), "--budget", str(budget)]) == 0
    budget.write_text(json.dumps({"checks": {"rss_idle_mb": {"max": 100}}}), encoding="utf-8")
    assert lb.main(["--evaluate", str(tmp_path), "--budget", str(budget)]) == 1
    assert "| rss_idle_mb | 100 | 120.0 | " in capsys.readouterr().out


def test_parse_restarts_and_opt_in(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    a = lb.parse(["--run-dir", str(tmp_path), "--hours", "14", "--restarts"])
    assert (a.nvr_every, a.ha_every, a.go2rtc_every) == (1800.0, 2700.0, 3600.0)
    a = lb.parse(["--run-dir", str(tmp_path), "--minutes", "10"])
    assert (a.nvr_every, a.ha_every, a.go2rtc_every) == (0.0, 0.0, 0.0)
    with pytest.raises(SystemExit):
        lb.parse(["--run-dir", str(tmp_path)])
    monkeypatch.delenv("SW_SOAK", raising=False)
    with pytest.raises(SystemExit, match="SW_SOAK"):
        lb.main(["--run-dir", str(tmp_path), "--minutes", "1"])


@pytest.mark.skipif(os.environ.get("SW_SOAK") != "1", reason="opt-in load run (SW_SOAK=1)")
def test_short_load_budget_run(tmp_path: Path) -> None:
    minutes = float(os.environ.get("SW_LOAD_BUDGET_MIN", "1"))
    rc = lb.main(["--run-dir", str(tmp_path), "--minutes", str(minutes), "--idle-s", "20", "--warmup-s", "30", "--interval", "10",
                  "--kiosks", "3", "--home-walls", "2", "--boards", "3", "--operators", "2", "--viewers", "2", "--event-sockets", "2",
                  "--ha-sensors", "100", "--author-every", "20"])
    report = json.loads((tmp_path / "budget_report.json").read_text(encoding="utf-8"))
    assert rc in (0, 1), rc  # 2 = the run itself did not complete
    assert report["measured"]["reason"] == "duration"
    assert report["routes"]["notices_display"]["n"] > 0 and report["routes"]["health_summary"]["n"] > 0
    assert report["measured"]["drain_ws_open"] == 0 and report["measured"]["drain_live_sessions"] == 0
    assert (tmp_path / "budget_report.md").read_text(encoding="utf-8").startswith("# Load budget run - ")
