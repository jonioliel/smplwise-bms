"""GATESPEED-293: the release gate's v2 schedule (scripts/gate/release_gate.py) keeps v1 as the default and never drops a spec,
a project or a backend test file; only the order, the width and the scratch location change."""
from __future__ import annotations

import importlib.util
import io
import json
import os
import threading
import time
from contextlib import redirect_stdout
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
FE = ROOT / "frontend"
GATE = ROOT / "scripts" / "gate"


@pytest.fixture()
def g(monkeypatch, tmp_path):
    """A fresh copy of the engine per test (module globals are state), with an empty results directory."""
    monkeypatch.delenv("GATE_SCHEDULE", raising=False)
    for k in ("GATE_BACKEND_SHARDS", "GATE_PW_SLOTS", "GATE_W1_MAX_CHUNKS", "GATE_CHUNK_TARGET_SECS", "GATE_PW_MAX_WORKERS",
              "GATE_BACKEND_TMPFS", "GATE_TMPFS_MIN_GB", "GATE_TMPFS_DIR", "GATE_MIN_FREE_MB", "GATE_COSTS_DIR", "GATE_LANE"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GATE_RESULTS_DIR", str(tmp_path / "results"))
    monkeypatch.setenv("GATE_HOME", str(tmp_path / "home"))
    spec = importlib.util.spec_from_file_location("release_gate_speed", GATE / "release_gate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    (tmp_path / "results").mkdir()
    return mod


def test_v1_is_the_default_and_its_knobs_are_the_292_values(g):
    assert g.SCHEDULE == "v1"
    assert g.knob("GATE_BACKEND_SHARDS", 3, 6) == 3
    assert g.knob("GATE_W1_MAX_CHUNKS", 3, 8) == 3
    assert g.knob("GATE_BACKEND_TMPFS", 0, 1) == 0
    g.SCHEDULE = "v2"
    assert g.knob("GATE_BACKEND_SHARDS", 3, 6) == 6


def test_an_environment_knob_wins_and_junk_falls_back(g, monkeypatch):
    monkeypatch.setenv("GATE_PW_SLOTS", "9")
    assert g.knob("GATE_PW_SLOTS", 12, 12) == 9
    monkeypatch.setenv("GATE_PW_SLOTS", "lots")
    assert g.knob("GATE_PW_SLOTS", 12, 12) == 12


def test_cli_refuses_an_unknown_schedule(g):
    assert g.main_cli(["some-branch", "--schedule", "v3"]) == 2


def test_backend_command_v1_unchanged_v2_adds_junit_and_retention(g, tmp_path):
    v1 = g.backend_cmd(["test_a.py"], tmp_path, 1, tmp_path / "tmp_b1", False)
    # GATELANES-297: a gate run (GATE_LANE unset) deselects the non-blocking timing lane
    assert v1[1:] == ["-m", "pytest", "-o", "addopts=", "-q", "-p", "no:cacheprovider", "-rfE", "--basetemp", str(tmp_path / "tmp_b1"),
                      "-m", "not timing_lane", "tests/test_a.py"]
    v2 = g.backend_cmd(["test_a.py"], tmp_path, 2, tmp_path / "tmp_b2", True)
    assert "tmp_path_retention_policy=failed" in v2 and str(tmp_path / "backend_s2.xml") in v2 and v2[-1] == "tests/test_a.py"


def _v1_split(files, n):
    """The v1 rule of backend_start(): biggest file first onto the lightest shard (first on ties)."""
    shards, load = [[] for _ in range(n)], [0] * n
    for f, s in sorted(files, key=lambda x: -x[1]):
        k = load.index(min(load))
        shards[k].append(f)
        load[k] += s
    return [sorted(x) for x in shards]


def test_split_without_times_is_the_v1_size_split():
    files = [(os.path.basename(p), p.stat().st_size) for p in sorted((ROOT / "smplwise_vms" / "backend" / "tests").glob("test_*.py"))]
    spec = importlib.util.spec_from_file_location("rg_split", GATE / "release_gate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    got = [names for names, _ in mod.split_backend(files, 3, {})]
    assert sorted(map(tuple, got)) == sorted(map(tuple, _v1_split(files, 3)))


def test_split_uses_times_and_scales_untimed_files_by_the_median_rate(g):
    files = [("test_slow.py", 100), ("test_fast.py", 100), ("test_new.py", 1000), ("test_x.py", 10)]
    parts = g.split_backend(files, 2, {"test_slow.py": 900.0, "test_fast.py": 10.0, "test_x.py": 1.0})
    names = sorted(n for p, _ in parts for n in p)
    assert names == sorted(f for f, _ in files)          # every file exactly once
    # median rate of the timed files = 0.1 s/byte -> test_new weighs 100 s; test_slow (900 s) is alone on its shard,
    # the other shard carries 100 + 10 + 1 s
    assert sorted((p, round(w)) for p, w in parts) == [(["test_fast.py", "test_new.py", "test_x.py"], 111), (["test_slow.py"], 900)]


def test_junit_costs_sum_per_file_with_classes(g, tmp_path):
    xml = tmp_path / "backend_s1.xml"
    xml.write_text('<testsuites><testsuite><testcase classname="tests.test_a" name="t1" time="1.5"/>'
                   '<testcase classname="tests.test_a.TestX" name="t2" time="2"/><testcase classname="tests.test_b" name="t" time="0.25"/>'
                   '</testsuite></testsuites>', encoding="utf-8")
    assert g.junit_costs(xml) == {"test_a.py": 3.5, "test_b.py": 0.25}
    (tmp_path / "bad.xml").write_text("<testsuites><testcase", encoding="utf-8")
    assert g.junit_costs(tmp_path / "bad.xml") == {}


def test_backend_costs_newest_gate_wins_and_the_seed_fills(g, tmp_path):
    old, new = g.RES / "gate_a_1.logs", g.RES / "gate_b_2.logs"
    for d, t in ((old, "9"), (new, "4")):
        d.mkdir()
        (d / "backend_s1.xml").write_text(f'<testsuite><testcase classname="tests.test_a" name="t" time="{t}"/></testsuite>', encoding="utf-8")
    os.utime(old, (time.time() - 100, time.time() - 100))
    seed = tmp_path / "seed"
    seed.mkdir()
    (seed / "gate_durations.json").write_text(json.dumps({"seconds": {}, "backend_seconds": {"test_a.py": 50, "test_z.py": 7, "test_bad.py": "x"}}))
    g.HERE, g._BCOSTS = seed, None
    c = g.backend_prior_costs()
    assert c == {"test_a.py": 4.0, "test_z.py": 7.0}


def _table():
    spec = importlib.util.spec_from_file_location("rg_cls", GATE / "release_gate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.TABLET_FULL = False
    return mod.classify(FE, "L")


def test_v2_jobs_cover_exactly_the_v1_specs_and_projects(g):
    """No coverage change: every (spec, project) pair v1 runs on the preview / dev server is in exactly one v2 job, with the
    same --workers=1 rule; pixel, fixture and visual stay jobs of their own."""
    g.SCHEDULE = "v2"
    cls = _table()
    jobs = g.v2_jobs(cls, g.prior_costs(), "L", False)
    for cat, table in (("preview", cls["rest"]), ("dev", cls["dev"])):
        want = sorted((n, p) for n, v in table.items() for p in v["projects"])
        got = sorted((n, p) for j in jobs if j["cat"] == cat for n in j["names"] for p in j["projects"])
        assert got == want, cat
        for j in (j for j in jobs if j["cat"] == cat):
            flags = {bool(table[n]["workers1"]) for n in j["names"]}
            assert len(flags) == 1, j["label"]                      # a job never mixes --workers=1 specs with parallel ones
            if flags == {True}:
                assert j["workers"] == 1, j["label"]                # the header's --workers=1 is kept
            assert all(j["projects"] == table[n]["projects"] for n in j["names"]), j["label"]
    assert [j for j in jobs if j["kind"] == "pixel"][0]["names"] == cls["pixel"]
    assert [j for j in jobs if j["kind"] == "fixture"][0]["names"] == list(cls["fixture"])
    labels = [j["label"] for j in jobs]
    assert len(labels) == len(set(labels))     # one Playwright JSON report per job


def test_w1_groups_chunk_by_time_and_parallel_groups_widen_within_bounds(g):
    table = {f"s{i}.spec.ts": {"projects": ["desktop"], "workers1": True, "one": False} for i in range(20)}
    table.update({f"p{i}.spec.ts": {"projects": ["desktop", "mobile"], "workers1": False, "one": False} for i in range(10)})
    costs = {f"s{i}.spec.ts": 600.0 for i in range(20)} | {f"p{i}.spec.ts": 900.0 for i in range(10)}
    g._COSTS = costs
    jobs = g.plan_pw_jobs("preview", table, costs, target=1500, max_chunks=8, max_workers=6, base_workers=3)
    w1 = [j for j in jobs if j["label"].startswith("preview_desktop_w1")]
    assert len(w1) == 8 and all(j["workers"] == 1 for j in w1)           # 12000 s / 1500 = 8 chunks
    par = [j for j in jobs if j["label"] == "preview_desktop-mobile"][0]
    assert par["workers"] == 6 and par["est"] == pytest.approx(9000 / 6)   # ceil(9000/1500) = 6, capped at 6
    small = g.plan_pw_jobs("dev", {"a.spec.ts": table["p0.spec.ts"]}, costs | {"a.spec.ts": 10.0}, 1500, 8, 6, 3)
    assert small[0]["workers"] == 3                                        # never narrower than GATE_PW_WORKERS


def test_simulated_pool_respects_bounds_and_runs_a_too_wide_job_alone(g):
    jobs = [{"label": f"j{i}", "workers": 1, "est": 100.0} for i in range(6)] + [{"label": "wide", "workers": 5, "est": 50.0}]
    span, starts = g.simulate_pool(jobs, 4)
    # the wide job has the largest area (250): it goes first and alone (5 workers > 4 slots), the rest start after it
    assert starts["wide"] == 0.0 and all(starts[f"j{i}"] >= 50.0 for i in range(6))
    assert span == 250.0 and span >= sum(j["est"] * j["workers"] for j in jobs) / 4
    span1, _ = g.simulate_pool([{"label": "a", "workers": 8, "est": 10.0}], 4)
    assert span1 == 10.0


def test_run_pool_never_exceeds_the_slots_and_records_crashes(g):
    live, peak, lock = [0], [0], threading.Lock()

    def runner(j):
        with lock:
            live[0] += j["workers"]
            peak[0] = max(peak[0], live[0])
        time.sleep(0.05)
        with lock:
            live[0] -= j["workers"]
        if j["label"] == "boom":
            raise RuntimeError("job crashed")
        return j["label"]

    jobs = [{"label": f"j{i}", "workers": 1 + i % 3, "est": float(10 - i)} for i in range(9)] + [{"label": "boom", "workers": 1, "est": 1.0}]
    out = g.run_pool(jobs, 4, runner, min_free_mb=0, mem=lambda: None)
    assert peak[0] <= 4 and set(out) == {j["label"] for j in jobs}
    assert isinstance(out["boom"][0], RuntimeError) and out["j0"][0] == "j0"


def test_run_pool_memory_guard_runs_one_job_at_a_time_when_memory_is_low(g):
    live, peak, lock = [0], [0], threading.Lock()

    def runner(j):
        with lock:
            live[0] += 1
            peak[0] = max(peak[0], live[0])
        time.sleep(0.03)
        with lock:
            live[0] -= 1

    g.run_pool([{"label": f"j{i}", "workers": 1, "est": 1.0} for i in range(4)], 8, runner, min_free_mb=1500, mem=lambda: 100)
    assert peak[0] == 1


@pytest.mark.skipif(not hasattr(os, "statvfs"), reason="tmpfs scratch is POSIX only (the runner)")
def test_tmpfs_root_sweeps_old_scratch_and_honours_the_free_space_floor(g, monkeypatch, tmp_path):
    shm = tmp_path / "shm"
    (shm / "smplwise-gate-old-123").mkdir(parents=True)
    (shm / "other").mkdir()
    monkeypatch.setenv("GATE_TMPFS_DIR", str(shm))
    monkeypatch.setenv("GATE_TMPFS_MIN_GB", "0")
    d = g.tmpfs_root("integ-1")
    assert d is not None and d.parent == shm and d.name.startswith("smplwise-gate-integ-1-")
    assert not (shm / "smplwise-gate-old-123").exists() and (shm / "other").exists()
    monkeypatch.setenv("GATE_TMPFS_MIN_GB", "1000000")
    assert g.tmpfs_root("integ-1") is None


def test_plan_runs_nothing_and_prints_both_schedules(g, monkeypatch):
    import subprocess

    def no_process(*a, **k):
        raise AssertionError("--plan must not start a process")

    monkeypatch.setattr(subprocess, "Popen", no_process)
    buf = io.StringIO()
    with redirect_stdout(buf):
        out = g.plan(ROOT, "L")
    text = buf.getvalue()
    assert "v1: Playwright" in text and "v2: Playwright" in text and "pool:" in text
    assert out["v2"]["frontend_s"] < out["v1"]["frontend_s"]
    assert g.SCHEDULE == "v1"     # the plan restores the schedule it borrowed


def test_seed_from_a_gates_logs(g, tmp_path):
    d = tmp_path / "gate_x_1.logs"
    d.mkdir()
    (d / "pw_preview_desktop.json").write_text(json.dumps({"suites": [{"specs": [{"file": "tests/a.spec.ts", "tests": [{"results": [{"duration": 2500}]}]}]}]}))
    (d / "pw_preview_desktop_retry_desktop.json").write_text(json.dumps({"suites": [{"specs": [{"file": "tests/a.spec.ts", "tests": [{"results": [{"duration": 99000}]}]}]}]}))
    (d / "backend_s1.xml").write_text('<testsuite><testcase classname="tests.test_a" name="t" time="3.5"/></testsuite>', encoding="utf-8")
    (d / "backend_s1.log").write_text("....\n4 passed in 120.50s (0:02:00)\n", encoding="utf-8")
    buf = io.StringIO()
    with redirect_stdout(buf):
        assert g.main_cli(["--seed-from", str(d), "gate x @ 1"]) == 0
    doc = json.loads(buf.getvalue())
    assert doc["seconds"] == {"a.spec.ts": 2.5}            # the retry report is not a cost
    assert doc["backend_seconds"] == {"test_a.py": 3.5}
    assert doc["backend_shard_seconds_total"] == 120.5 and doc["source"] == "gate x @ 1"


def test_the_seed_carries_the_v2_planning_numbers():
    d = json.loads((GATE / "gate_durations.json").read_text(encoding="utf-8"))
    assert d["backend_shard_seconds_total"] > 0 and d["pixel_phase_seconds"] > 0
    assert isinstance(d["backend_seconds"], dict)
    assert all(isinstance(v, (int, float)) and v > 0 for v in d["seconds"].values())
