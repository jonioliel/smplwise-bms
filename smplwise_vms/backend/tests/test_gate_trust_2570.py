"""FIX-GATE-2570 (second deep review of 2.57, CD2-01 / CD2-03 / CD2-09 / CD2-10): the release-gate trust fixes.

CD2-01  a process-level failure (crashed / timed-out backend shard, Playwright process with no report / timeout / zero tests, a fixture
        group that never started, a crashed pool job) names the files it owned; the targeted --after re-run re-selects them, takes
        the full side when a failure names no file, and never counts the red run as a coverage anchor unless it is the --after
        report with every file named; a re-run that would re-check nothing raises (-> the full tier).
CD2-03  an all-skipped fixture / pixel Playwright process is a FAIL; an unreadable fixture_specs.json is a FAIL (gate and lane).
CD2-09  the coverage lane records module-level lines of modules the initial conftest.py imports.
CD2-10  fixture_job.py with nothing to run is exit 1, not FIXTURE_PASS.
Fake data only: temp directories, fake processes, no runner, no Playwright, no git.
"""
from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
GATE = ROOT / "scripts" / "gate"
if str(GATE) not in sys.path:
    sys.path.insert(0, str(GATE))

import gate2_select as g2s  # noqa: E402
import gate_entry as ge  # noqa: E402


@pytest.fixture()
def rg(monkeypatch, tmp_path):
    """A fresh copy of the engine (module globals are state), with an empty results directory."""
    for k in [k for k in os.environ if k.startswith("GATE_")]:
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GATE_RESULTS_DIR", str(tmp_path / "results"))
    monkeypatch.setenv("GATE_HOME", str(tmp_path / "home"))
    (tmp_path / "results").mkdir()
    spec = importlib.util.spec_from_file_location("release_gate_trust_2570", GATE / "release_gate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _write(p: Path, doc) -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(doc), encoding="utf-8")
    return p


def _tree(tmp_path: Path, tests=("test_a.py", "test_b.py", "test_x.py"), specs=("x.spec.ts", "y.spec.ts")) -> Path:
    root = tmp_path / "tree"
    for n in tests:
        (root / "smplwise_vms" / "backend" / "tests").mkdir(parents=True, exist_ok=True)
        (root / "smplwise_vms" / "backend" / "tests" / n).write_text("def test_ok():\n    pass\n", encoding="utf-8")
    for n in specs:
        (root / "frontend" / "tests").mkdir(parents=True, exist_ok=True)
        (root / "frontend" / "tests" / n).write_text("// spec\n", encoding="utf-8")
    return root


# ------------------------------------------------------------------------------------------------ CD2-01: the --after selection

RED = {"branch": "release/2570-train", "sha": "abc1234", "tier": "L", "verdict": "fail", "finished": "2026-11-28T10:00:00+0000",
       "counts": {"backend": {"pass": 900, "fail": 2, "flaky": 0, "known": 0, "skipped": 0}}}


def test_failed_files_selects_the_files_a_crashed_shard_and_a_timed_out_chunk_owned(tmp_path):
    rep = _write(tmp_path / "red.json", {**RED, "items": [
        {"category": "backend", "id": "shard 3", "status": "FAIL", "reason": "no pytest summary", "files": ["test_a.py", "test_b.py"]},
        {"category": "preview", "id": "preview_desktop_c2: timeout", "status": "FAIL", "reason": "time limit", "files": ["y.spec.ts"]},
        {"category": "backend", "id": "tests/test_x.py::test_one", "status": "FAIL", "reason": "assert"},
    ]})
    got = g2s.failed_files(rep)
    assert got["backend"] == {"test_a.py", "test_b.py", "test_x.py"}
    assert got["frontend"] == {"y.spec.ts"}
    assert got["full"] == {"backend": [], "frontend": []} and got["failures"] == 3


def test_a_process_failure_without_files_makes_its_side_full(tmp_path):
    rep = _write(tmp_path / "red.json", {**RED, "items": [
        {"category": "backend", "id": "shard 3", "status": "FAIL", "reason": "timeout"},              # a report of an older engine
        {"category": "preview", "id": "vite preview", "status": "FAIL", "reason": "did not start"},
        {"category": "tsc", "id": "tsc --noEmit", "status": "FAIL", "reason": "hard, not a test"},
    ]})
    got = g2s.failed_files(rep)
    assert got["backend"] == set() and got["frontend"] == set()
    assert any("shard 3" in w for w in got["full"]["backend"]) and any("vite preview" in w for w in got["full"]["frontend"])
    assert got["failures"] == 2


def test_select_gate2_takes_the_full_side_for_an_unmappable_after_failure(tmp_path, monkeypatch):
    root = _tree(tmp_path)
    monkeypatch.setattr(g2s.st, "changed_files", lambda *a, **k: [])
    monkeypatch.setattr(g2s.st, "select", lambda root, ch: {
        "backend": {"selected": [], "dropped": ["test_a.py", "test_b.py", "test_x.py"], "why": {}},
        "frontend": {"selected": [], "dropped": ["x.spec.ts", "y.spec.ts"], "why": {}}})
    after = {"backend": set(), "frontend": set(), "visual": set(), "failures": 1,
             "full": {"backend": ["--after: backend 'shard 3' failed and names no test file"], "frontend": []}}
    sel = g2s.select_gate2(root, "base", "HEAD", after=after, costs={}, defer_heavy=False)
    assert sel["full"]["backend"] and set(sel["backend"]["selected"]) == {"test_a.py", "test_b.py", "test_x.py"}
    assert sel["after"]["full"]["backend"]          # the selection JSON says why
    json.dumps(sel)                                  # still serialisable (sets were sorted)


def test_the_quarantine_rerun_selects_the_shard_files_or_the_full_side_and_never_nothing(tmp_path):
    root = _tree(tmp_path)
    after = {"backend": {"test_a.py"}, "frontend": set(), "visual": set(), "failures": 1, "full": {"backend": [], "frontend": []}}
    sel = g2s.rerun_only_selection(root, after)
    assert sel["backend"]["selected"] == ["test_a.py"] and sel["full"] == {"backend": [], "frontend": []}
    after = {"backend": set(), "frontend": set(), "visual": set(), "failures": 1, "full": {"backend": [], "frontend": ["--after: x"]}}
    sel = g2s.rerun_only_selection(root, after)
    assert sel["frontend"]["selected"] == ["x.spec.ts", "y.spec.ts"] and sel["full"]["frontend"]
    after = {"backend": {"test_gone.py"}, "frontend": set(), "visual": set(), "failures": 1, "full": {"backend": [], "frontend": []}}
    with pytest.raises(g2s.NothingToRerun):          # CD2-01 (c): the engine turns a selection error into the full tier
        g2s.rerun_only_selection(root, after)


def test_a_run_with_a_process_failure_is_an_anchor_only_as_the_after_report_with_its_files():
    crashed = {**RED, "items": [{"category": "backend", "id": "shard 3", "status": "FAIL", "reason": "timeout"}]}
    ok, why = ge.full_run_completed(crashed)
    assert not ok and "process-level failure" in why and "shard 3" in why
    assert not ge.full_run_completed(crashed, is_after=True)[0]                        # no file list: nothing to re-select
    named = {**RED, "items": [{"category": "backend", "id": "shard 3", "status": "FAIL", "reason": "timeout", "files": ["test_a.py"]},
                              {"category": "preview", "id": "x.spec.ts:3 [desktop] t", "status": "FAIL", "reason": "assert"}]}
    assert not ge.full_run_completed(named)[0]                                          # another report's crash: ran in no run
    assert ge.full_run_completed(named, is_after=True) == (True, "complete")
    plain = {**RED, "items": [{"category": "preview", "id": "x.spec.ts:3 [desktop] t", "status": "FAIL", "reason": "assert"}]}
    assert ge.full_run_completed(plain) == (True, "complete")                           # test-level failures: unchanged (TR-09)
    assert ge._same_report(named, dict(named)) and not ge._same_report(named, {**named, "finished": "x"})


# ------------------------------------------------------------------------------------------------ CD2-01: the engine names the files

class _Proc:
    def __init__(self, rc, pid=999999):
        self.returncode, self.pid = rc, pid

    def wait(self, timeout=None):
        return self.returncode


def test_a_crashed_backend_shard_names_its_files_and_the_after_run_selects_them(rg, tmp_path):
    logd = tmp_path / "logs"
    logd.mkdir()
    rg.DEADLINE = 10 ** 12
    (logd / "backend_s1.log").write_text("....\n3 passed in 1.00s\n", encoding="utf-8")
    (logd / "backend_s2.log").write_text("Killed\n", encoding="utf-8")                  # no pytest summary: crashed
    rg.SHARD_FILES.update({1: ["test_x.py"], 2: ["test_a.py", "test_b.py"]})
    rg.backend_finish([(1, _Proc(0), logd / "backend_s1.log"), (2, _Proc(-9), logd / "backend_s2.log")], tmp_path, logd)
    shard = [i for i in rg.ITEMS if i["id"] == "shard 2"]
    assert shard and shard[0]["status"] == "FAIL" and shard[0]["files"] == ["test_a.py", "test_b.py"]
    got = g2s.failed_files(_write(tmp_path / "r.json", {**RED, "items": rg.ITEMS}))
    assert got["backend"] == {"test_a.py", "test_b.py"} and not got["full"]["backend"]


def test_backend_start_v2_records_each_shard_s_files(rg, tmp_path, monkeypatch):
    root = _tree(tmp_path)
    monkeypatch.setattr(rg, "spawn", lambda *a, **k: _Proc(None))
    procs, n, plan = rg.backend_start_v2(root, tmp_path, 2)
    assert n == 3 and sorted(f for k, _p, _l in procs for f in rg.SHARD_FILES[k]) == ["test_a.py", "test_b.py", "test_x.py"]


def test_a_timed_out_playwright_process_names_its_specs(rg, tmp_path, monkeypatch):
    logd = tmp_path / "logs"
    logd.mkdir()
    monkeypatch.setattr(rg, "run", lambda *a, **k: (124, True))
    rows, rc, to = rg.run_pw(tmp_path, ["x.spec.ts", "y.spec.ts"], ["desktop"], "http://x/", logd, "preview_desktop_c2", timeout=1)
    assert rows is None and to
    rg.settle("preview", rows, rc, to, tmp_path, logd, "http://x/", {}, "preview_desktop_c2")
    it = [i for i in rg.ITEMS if i["id"] == "preview_desktop_c2: no report"]
    assert it and it[0]["files"] == ["x.spec.ts", "y.spec.ts"] and rg.compute_verdict([]) == "fail"
    got = g2s.failed_files(_write(tmp_path / "r.json", {**RED, "items": rg.ITEMS}))
    assert got["frontend"] == {"x.spec.ts", "y.spec.ts"} and not got["full"]["frontend"]


def test_a_crashed_visual_job_is_a_hard_visual_run_failure_not_a_visual_case():
    src = (GATE / "release_gate.py").read_text(encoding="utf-8")
    assert 'jcat = VISUAL_RUN_CAT if j["kind"] == "visual" else j["cat"]' in src


# ------------------------------------------------------------------------------------------------ CD2-03: all skipped, broken JSON

def _skipped(n, project="desktop"):
    return [{"file": "evidence-a.spec.ts", "line": i, "project": project, "title": f"t{i}", "status": "skipped", "error": "",
             "norun": False} for i in range(n)]


def test_an_all_skipped_fixture_process_is_a_fail(rg, tmp_path):
    rg.PROC_FILES["fixture_devices_desktop"] = {"evidence-a.spec.ts"}
    rg.settle("fixture", _skipped(3), 0, False, tmp_path, tmp_path, "http://x/", {}, "fixture_devices_desktop")
    assert rg.COUNTS["fixture"]["fail"] == 1 and rg.compute_verdict([]) == "fail"
    it = [i for i in rg.ITEMS if i["status"] == "FAIL"]
    assert it[0]["id"] == "fixture_devices_desktop: all skipped" and "zero tests ran" in it[0]["reason"]
    assert it[0]["files"] == ["evidence-a.spec.ts"]


def test_an_all_skipped_pixel_process_is_a_fail_and_preview_stays_allowed(rg, tmp_path):
    rg.settle("pixel", _skipped(2), 0, False, tmp_path, tmp_path, "http://x/", {}, "pixel_4")
    assert rg.COUNTS["pixel"]["fail"] == 1
    rg.COUNTS.clear(); rg.ITEMS.clear()
    rg.settle("preview", _skipped(4), 0, False, tmp_path, tmp_path, "http://x/", {}, "preview_desktop-mobile")
    assert rg.compute_verdict([]) == "pass" and rg.COUNTS["preview"]["skipped"] == 4
    assert [i["status"] for i in rg.ITEMS] == ["SKIPPED_ALL"]
    rg.COUNTS.clear(); rg.ITEMS.clear()
    rows = _skipped(2) + [dict(_skipped(1)[0], status="expected", line=9)]
    rg.settle("fixture", rows, 0, False, tmp_path, tmp_path, "http://x/", {}, "fixture_devices_desktop")
    assert rg.compute_verdict([]) == "pass" and rg.COUNTS["fixture"]["pass"] == 1     # one ran: not "all skipped"


def test_an_unreadable_fixture_json_is_a_fail_and_a_missing_one_is_the_fallback(rg, tmp_path):
    assert list(rg.fixture_groups(tmp_path / "nojson")) == ["devices"] and rg.FIXTURE_JSON_ERRORS == []
    assert not rg.fixture_json_failure()
    fe = tmp_path / "fe"
    (fe / "tests" / "fixtures").mkdir(parents=True)
    (fe / "tests" / "fixtures" / "fixture_specs.json").write_text('{"groups": {"a": ', encoding="utf-8")
    assert list(rg.fixture_groups(fe)) == ["devices"]
    assert rg.FIXTURE_JSON_ERRORS and rg.fixture_json_failure()
    it = [i for i in rg.ITEMS if i["status"] == "FAIL"]
    assert it[0]["id"] == "fixture_specs.json: unreadable" and "does not parse" in it[0]["reason"] and rg.compute_verdict([]) == "fail"


def test_the_fixture_lane_stops_on_an_unreadable_json(rg, tmp_path, monkeypatch):
    fe = tmp_path / "fe"
    (fe / "tests" / "fixtures").mkdir(parents=True)
    (fe / "tests" / "fixtures" / "fixture_specs.json").write_text("not json", encoding="utf-8")
    monkeypatch.setattr(rg, "need_modules", lambda *a: True)
    monkeypatch.setattr(rg, "run", lambda *a, **k: (0, False))
    ran = []
    monkeypatch.setattr(rg, "fixture_block", lambda *a, **k: ran.append(a))
    rg.fixture_lane_run(tmp_path, fe, tmp_path, {}, [])
    assert ran == [] and rg.compute_verdict([]) == "fail"
    assert any(i["id"] == "fixture_specs.json: unreadable" for i in rg.ITEMS)


# ------------------------------------------------------------------------------------------------ CD2-09: the coverage lane

@pytest.mark.skipif(not hasattr(sys, "monitoring"), reason="sys.monitoring needs Python 3.12")
def test_the_coverage_lane_records_modules_the_conftest_imports(tmp_path):
    proj = tmp_path / "proj"
    (proj / "pkg").mkdir(parents=True)
    (proj / "pkg" / "__init__.py").write_text("", encoding="utf-8")
    (proj / "pkg" / "app.py").write_text("CONST = 41\n\n\ndef never():\n    return CONST + 1\n", encoding="utf-8")
    (proj / "conftest.py").write_text("import pkg.app  # noqa: F401  (like tests/conftest.py imports smplwise.main)\n", encoding="utf-8")
    (proj / "test_one.py").write_text("def test_one():\n    assert True\n", encoding="utf-8")
    (proj / "pytest.ini").write_text("[pytest]\n", encoding="utf-8")
    out = tmp_path / "shard.json"
    env = {k: v for k, v in os.environ.items() if not k.startswith(("PYTEST_", "SW_COVERAGE"))}
    env.update({"SW_COVERAGE_OUT": str(out), "SW_COVERAGE_SRC": str(proj / "pkg"),
                "PYTHONPATH": os.pathsep.join([str(GATE), str(proj)])})
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "-p", "coverage_lane", "test_one.py"],
                       cwd=str(proj), env=env, capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr
    lines = json.loads(out.read_text(encoding="utf-8"))["files"].get("app.py", [])
    assert 1 in lines and 4 in lines and 5 not in lines   # module-level CONST and def ran at import; the body never ran


# ------------------------------------------------------------------------------------------------ CD2-10: fixture_job.py

def test_fixture_job_with_nothing_to_run_fails(monkeypatch, capsys, tmp_path):
    spec = importlib.util.spec_from_file_location("fixture_job_2570", ROOT / "scripts" / "fixture_job.py")
    fj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fj)
    groups = {"devices": {"script": "x.py", "specs": {"a.spec.ts": {"gate": False}}}}   # the JSON lost its "gate": true flags
    monkeypatch.setattr(fj, "load_specs", lambda: groups)
    (tmp_path / "dist").mkdir()
    (tmp_path / "dist" / "index.html").write_text("x", encoding="utf-8")
    monkeypatch.setattr(fj, "FE", tmp_path)                                         # --no-build with a dist: no build is started
    monkeypatch.setattr(fj.subprocess, "run", lambda *a, **k: (_ for _ in ()).throw(AssertionError("nothing may run")))
    assert fj.main(["--gate", "--no-build"]) == 1
    out = capsys.readouterr().out
    assert "nothing to run" in out and "FIXTURE_PASS" not in out


# ------------------------------------------------------------------------------------------------ SA2-05 a: product requirements

def test_a_missing_or_unimportable_product_requirement_fails_the_gate(rg, tmp_path):
    wt = tmp_path / "wt"
    (wt / "smplwise_vms" / "backend").mkdir(parents=True)
    (wt / "smplwise_vms" / "backend" / "requirements.txt").write_text(
        "# comment\npytest>=7\nsmplwise-no-such-pkg-2570==1.0\nuvloop==0.22.1; sys_platform == \"never-a-platform\"\n", encoding="utf-8")
    logd = tmp_path / "logs"
    logd.mkdir()
    rg.PY = sys.executable
    extra = {}
    rg.product_requirements_check(wt, logd, extra)
    fails = [i for i in rg.ITEMS if i["status"] == "FAIL"]
    assert [i["id"] for i in fails] == ["smplwise-no-such-pkg-2570: not installed"] and fails[0]["category"] == "requirements"
    assert rg.compute_verdict([]) == "fail" and extra["product_requirements"]["state"] == "FAIL"
    assert extra["product_requirements"]["not_for_this_platform"] == ["uvloop"]      # its marker does not apply: not checked
    assert rg.PRODUCT_MODULES["smplwise_no_such_pkg_2570"] == "smplwise-no-such-pkg-2570" and rg.PRODUCT_MODULES.get("pytest") == "pytest"
    rg.COUNTS.clear(); rg.ITEMS.clear()
    (wt / "smplwise_vms" / "backend" / "requirements.txt").write_text("pytest>=7\n", encoding="utf-8")
    rg.product_requirements_check(wt, logd, extra)
    assert rg.compute_verdict([]) == "pass" and rg.COUNTS["requirements"]["pass"] == 1 and extra["product_requirements"]["state"] == "ok"
    assert "-rfEs" in rg.backend_cmd(["test_a.py"], logd, 1, tmp_path / "bt", True)   # the shards print their skip reasons


def test_a_test_skipped_for_a_missing_product_requirement_is_a_fail(rg, tmp_path):
    proj = tmp_path / "be"
    (proj / "tests").mkdir(parents=True)
    (proj / "pytest.ini").write_text("[pytest]\n", encoding="utf-8")
    (proj / "tests" / "test_req_skip.py").write_text(
        "import pytest\n\nsftp = pytest.importorskip('smplwise_no_such_mod_2570')\n\n\ndef test_push():\n    assert sftp\n", encoding="utf-8")
    (proj / "tests" / "test_optional_skip.py").write_text(
        "import pytest\n\n\ndef test_tool():\n    pytest.importorskip('some_optional_tool_2570')\n", encoding="utf-8")
    (proj / "tests" / "test_fine.py").write_text("def test_ok():\n    assert True\n", encoding="utf-8")
    logd = tmp_path / "logs"
    logd.mkdir()
    rg.PY = sys.executable
    cmd = rg.backend_cmd(["test_req_skip.py", "test_optional_skip.py", "test_fine.py"], logd, 1, tmp_path / "bt", False)
    env = {k: v for k, v in os.environ.items() if not k.startswith("PYTEST_")}
    r = subprocess.run(cmd, cwd=str(proj), env=env, capture_output=True, text=True, timeout=120)
    (logd / "backend_s1.log").write_text(r.stdout + r.stderr, encoding="utf-8")
    assert r.returncode == 0, r.stdout + r.stderr                                      # pytest itself: green, 2 skipped
    rg.PRODUCT_MODULES.update({"smplwise_no_such_mod_2570": "smplwise-no-such-mod-2570"})
    assert rg.requirement_skips(r.stdout) == [("tests/test_req_skip.py", "smplwise_no_such_mod_2570", "smplwise-no-such-mod-2570")]
    rg.DEADLINE = 10 ** 12
    rg.SHARD_FILES[1] = ["test_req_skip.py", "test_optional_skip.py", "test_fine.py"]
    rg.backend_finish([(1, _Proc(0), logd / "backend_s1.log")], tmp_path, logd)
    fails = [i for i in rg.ITEMS if i["status"] == "FAIL"]
    assert len(fails) == 1 and fails[0]["id"].startswith("tests/test_req_skip.py: skipped - product requirement smplwise-no-such-mod-2570")
    assert fails[0]["files"] == ["test_req_skip.py"] and rg.compute_verdict([]) == "fail"
    got = g2s.failed_files(_write(tmp_path / "r.json", {**RED, "items": rg.ITEMS}))
    assert got["backend"] == {"test_req_skip.py"}                                      # the --after re-run re-checks that file


def test_a_run_whose_environment_lacked_a_product_requirement_is_no_anchor():
    doc = {**RED, "items": [{"category": "requirements", "id": "paramiko: not installed", "status": "FAIL", "reason": "x"}]}
    ok, why = ge.full_run_completed(doc, is_after=True)
    assert not ok and "requirements" in why


# ------------------------------------------------------------------------------------------------ lead 28.11: the nightly arm64 check

FAKE_DOCKER = """#!/bin/bash
echo "$*" >> "$FAKE_DOCKER_LOG"
case "$1 $2" in
  "buildx version") echo "github.com/docker/buildx 0.30.1"; exit 0;;
  "buildx build") echo "Check complete, no warnings found."; exit 0;;
  "buildx imagetools")
    echo "MediaType: application/vnd.oci.image.index.v1+json"; echo "  Platform:    linux/amd64"
    case "$4" in *amd64-*) ;; *) echo "  Platform:    linux/arm64";; esac; exit 0;;
esac
exit 3
"""


@pytest.mark.skipif(sys.platform == "win32" or not shutil.which("bash"), reason="the nightly runs on the Linux runner")
@pytest.mark.parametrize(("base", "want"), [("ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22", "FAIL - the default base image"),
                                            ("ghcr.io/home-assistant/base-python:3.12-alpine3.22", "OK - default base")])
def test_the_nightly_arm64_check_reads_the_default_base_without_build_args(tmp_path, base, want):
    tree = tmp_path / "tree"
    (tree / "smplwise_vms").mkdir(parents=True)
    (tree / "smplwise_vms" / "Dockerfile").write_text(f"ARG BUILD_FROM={base}\nFROM ${{BUILD_FROM}}\nRUN true\n", encoding="utf-8")
    bin_ = tmp_path / "bin"
    bin_.mkdir()
    (bin_ / "docker").write_text(FAKE_DOCKER, encoding="utf-8")
    (bin_ / "docker").chmod(0o755)
    env = {k: v for k, v in os.environ.items() if not k.startswith("SW_NIGHTLY")}
    env.update(HOME=str(tmp_path), PATH=f"{bin_}:{env.get('PATH', '')}", FAKE_DOCKER_LOG=str(tmp_path / "docker.log"),
               SW_NIGHTLY_ARM64_LOGD=str(tmp_path))
    r = subprocess.run(["bash", str(ROOT / "scripts" / "gate" / "nightly_tests.sh"), f"--arm64-check={tree}"], capture_output=True,
                       text=True, timeout=60, env=env)
    assert r.returncode == 0 and want in r.stdout and r.stdout.startswith("- arm64 Dockerfile check (report only):"), r.stdout + r.stderr
    calls = (tmp_path / "docker.log").read_text(encoding="utf-8")
    assert "buildx build --check --platform linux/arm64 -f Dockerfile ." in calls and "--build-arg" not in calls
    assert f"buildx imagetools inspect {base}" in calls
    (tree / "smplwise_vms" / "Dockerfile").unlink()
    r = subprocess.run(["bash", str(ROOT / "scripts" / "gate" / "nightly_tests.sh"), f"--arm64-check={tree}"], capture_output=True,
                       text=True, timeout=60, env=env)
    assert "NOT_RUN (no smplwise_vms/Dockerfile" in r.stdout


# ------------------------------------------------------------------------------------------------ lead 28.11: Q1 a, Q2 a, Q3 a

def test_a_red_full_run_anchors_only_as_the_after_report_itself(tmp_path, monkeypatch):
    monkeypatch.setattr(ge, "git_relation", lambda repo, a, b: {"ancestor": True, "commits": 2, "product_files": 1})
    now = ge.parse_ts(RED["finished"])
    red = {**RED, "items": [{"category": "preview", "id": "x.spec.ts:3 [desktop] t", "status": "FAIL", "reason": "assert"}]}
    res = tmp_path / "results"
    _write(res / "gate_release-2570-train_abc1234.json", red)
    other_after = _write(tmp_path / "after_other.json", {**red, "sha": "def5678", "finished": "2026-11-28T11:00:00+0000",
                                                         "selection": {"base": "v2.56.0", "reduced": {"backend": "1 of 2"}}})
    r = ge.anchor_check(res, tmp_path, "head", RED["branch"], other_after, now, quarantine=tmp_path / "noq.json")
    assert not r["ok"] and "not the --after report" in r["why"]                        # before: accepted (same branch)
    self_after = _write(tmp_path / "after_self.json", red)
    r = ge.anchor_check(res, tmp_path, "head", RED["branch"], self_after, now, quarantine=tmp_path / "noq.json")
    assert r["ok"] and r["anchor"]["sha"] == "abc1234"


def test_a_version_other_than_the_constraints_pin_is_a_hard_failure(rg, tmp_path):
    import importlib.metadata as md
    wt = tmp_path / "wt"
    be = wt / "smplwise_vms" / "backend"
    be.mkdir(parents=True)
    (be / "requirements.txt").write_text("pytest>=7\n", encoding="utf-8")
    real = md.version("pytest")
    (be / "constraints.txt").write_text(f"# generated\npytest==0.0.1\niniconfig=={md.version('iniconfig')}\n"
                                        "smplwise-not-installed-2570==1.0\n", encoding="utf-8")
    logd = tmp_path / "logs"
    logd.mkdir()
    rg.PY = sys.executable
    extra = {}
    rg.product_requirements_check(wt, logd, extra)
    fails = [i for i in rg.ITEMS if i["status"] == "FAIL"]
    assert [i["id"] for i in fails] == ["pytest: version differs from the pin"] and fails[0]["category"] == "requirements"
    assert f"pytest {real} (constraints.txt pins 0.0.1)" in fails[0]["reason"] and rg.compute_verdict([]) == "fail"
    pr = extra["product_requirements"]
    assert pr["state"] == "FAIL" and pr["constraints"] == 3 and pr["constraint_not_installed"] == ["smplwise-not-installed-2570"]
    rg.COUNTS.clear(); rg.ITEMS.clear()
    (be / "constraints.txt").write_text(f"pytest=={real}\n", encoding="utf-8")
    rg.product_requirements_check(wt, logd, extra)
    assert rg.compute_verdict([]) == "pass" and extra["product_requirements"]["state"] == "ok"


def test_the_sftp_tests_import_paramiko_plainly():
    src = (ROOT / "smplwise_vms" / "backend" / "tests" / "test_offbox_sftp.py").read_text(encoding="utf-8")
    assert "\nimport paramiko\n" in src and "importorskip" not in src.split('"""', 2)[2]
