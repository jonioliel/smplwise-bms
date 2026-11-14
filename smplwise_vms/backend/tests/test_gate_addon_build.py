"""SUPERVISOR-BUILD-GATE-2341: the release gate's optional Supervisor build stage (scripts/gate/release_gate.py +
scripts/gate/addon_build_check.sh). PASS / FAIL follow the script; NOT_RUN (no docker, or a branch without the script) is a
skipped item with its reason and never a pass; GATE_ADDON_BUILD=require makes NOT_RUN a failure; =off starts nothing; the
optional category has no count baseline. The process tests use a fake `docker` and run where the gate runs (POSIX)."""
from __future__ import annotations

import importlib.util
import json
import os
import shutil
import stat
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
GATE = ROOT / "scripts" / "gate"
SCRIPT = GATE / "addon_build_check.sh"
posix = pytest.mark.skipif(os.name == "nt" or not shutil.which("bash") or not shutil.which("timeout") or not shutil.which("python3"),
                           reason="the gate engine and the build script run on the Linux runner (process groups, bash, timeout)")

FAKE_DOCKER = """#!/usr/bin/env bash
echo "docker $*" >> "$FAKE_DOCKER_ARGV"
m="${FAKE_DOCKER_MODE:-ok}"
case "$1" in
  version) [ "$m" = nodaemon ] && exit 1; echo 27.5.1; exit 0;;
  build) [ "$m" = buildfail ] && { echo "ERROR: process \\"/bin/sh -c pip install\\" did not complete successfully: exit code: 127"; exit 1; }; exit 0;;
  run) case "$*" in *healthz*) [ "$m" = nohealth ] && exit 4;; esac; exit 0;;
esac
exit 0
"""


@pytest.fixture()
def g(monkeypatch, tmp_path):
    for k in ("GATE_ADDON_BUILD", "GATE_ADDON_BUILD_SECS", "GATE_LANE", "GATE_SCHEDULE"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GATE_RESULTS_DIR", str(tmp_path / "results"))
    monkeypatch.setenv("GATE_HOME", str(tmp_path / "home"))
    spec = importlib.util.spec_from_file_location("release_gate_abuild", GATE / "release_gate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    (tmp_path / "results").mkdir()
    return mod


@pytest.fixture()
def fake_docker(monkeypatch, tmp_path):
    b = tmp_path / "bin"
    b.mkdir()
    d = b / "docker"
    d.write_text(FAKE_DOCKER, encoding="utf-8")
    d.chmod(d.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PATH", f"{b}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("FAKE_DOCKER_ARGV", str(tmp_path / "argv.txt"))
    monkeypatch.setenv("ADDON_BUILD_LOCK", "static")   # PY-CONSTRAINTS-LOCK-2407: hermetic - the offline lock check only
    return tmp_path / "argv.txt"


def test_defaults_auto_ten_minutes_and_an_optional_category(g):
    assert g.addon_build_mode() == "auto" and g.ADDON_BUILD_SECS == 600
    assert g.ADDON_BUILD_CAT in g.OPTIONAL_CATS
    g.ADDON_BUILD = "sometimes"
    assert g.addon_build_mode() == "auto"
    base = json.loads((GATE / "gate_baselines.json").read_text(encoding="utf-8"))
    assert all("addon_build" not in t for t in base["tiers"].values()), "an optional NOT_RUN stage must never meet a count baseline"


def test_settle_maps_exit_codes(g):
    assert g.addon_build_settle(0, False, {"result": "PASS", "reason": "built"}, "")["status"] == "pass"
    f = g.addon_build_settle(1, False, {"reason": "step build failed (rc=1)"}, "a\nexit code: 127\n")
    assert f["result"] == "FAIL" and "127" in f["reason"] and "step build failed" in f["reason"]
    n = g.addon_build_settle(3, False, {"reason": "no container engine (docker) answered"}, "")
    assert n == {"result": "NOT_RUN", "status": "skipped", "reason": "no container engine (docker) answered"}
    assert g.addon_build_settle(3, False, {}, "", "require")["result"] == "FAIL"
    assert g.addon_build_settle(124, False, {}, "")["result"] == "FAIL", "the outer timeout is a failure"
    assert g.addon_build_settle(0, True, {}, "")["result"] == "FAIL"
    assert g.addon_build_settle(0, False, {"result": "FAIL"}, "")["result"] == "FAIL", "a PASS exit with a FAIL file is not a pass"
    assert g.addon_build_settle(9, False, {}, "")["result"] == "FAIL"


def test_off_and_missing_script_are_not_run_without_a_process(g, tmp_path):
    g.ADDON_BUILD = "off"
    h = g.addon_build_start(ROOT, tmp_path)
    assert "done" in h and not g.GROUPS
    ex = {}
    out = g.addon_build_finish(h, ex)
    assert out["result"] == "NOT_RUN" and g.compute_verdict([]) == "pass" and ex["addon_build"]["mode"] == "off"
    g.ADDON_BUILD = "require"
    g.COUNTS.clear(); g.ITEMS.clear()
    out = g.addon_build_finish(g.addon_build_start(tmp_path, tmp_path), {})
    assert out["result"] == "FAIL" and "has no" in out["reason"], "require: an old branch without the script cannot pass"
    g.ADDON_BUILD = "require"
    g.LANE = True
    g.COUNTS.clear(); g.ITEMS.clear()
    assert g.addon_build_finish(g.addon_build_start(ROOT, tmp_path), {})["result"] == "NOT_RUN", "the timing lane never builds"


def test_optional_category_has_no_baseline_warning(g):
    g.COUNTS["addon_build"] = {"pass": 0, "fail": 0, "flaky": 0, "known": 0, "skipped": 1}
    g.COUNTS["tsc"] = {"pass": 1, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
    w = g.check_baselines({"tiers": {"L": {"tsc": 1}}}, "L")
    assert not any("addon_build" in x for x in w) and "addon_build" not in g.BASELINE_ROWS


def test_report_has_the_stage_section(g, tmp_path):
    g.BR, g.TAG = "b", "b"
    ex = {"addon_build": {"result": "FAIL", "reason": "step build failed (rc=1)", "mode": "auto", "seconds": 12, "engine": "docker",
                          "builder": "plain", "steps": [{"name": "build", "result": "FAIL", "seconds": "11"}], "log_tail": ["exit code: 127"]}}
    _, base = g.write_reports("abc", "fail", ex)
    md = Path(str(base) + ".md").read_text()
    assert "addon_build): FAIL" in md and "exit code: 127" in md and "build: FAIL" in md


def test_main_wires_the_stage_after_release_check_and_before_the_backend():
    src = (GATE / "release_gate.py").read_text(encoding="utf-8")
    m = src[src.index("def main():"):src.index("def on_term(")]
    assert m.index('Phase("release_check"') < m.index("addon_build_start(") < m.index("addon_build_finish(") < m.index('Phase("backend-wait"')
    assert "if not LANE:" in m[:m.index("addon_build_start(")][-2500:], "the stage starts inside the release_check block (never in the lane)"


@posix
@pytest.mark.parametrize("mode,result,verdict", [("ok", "PASS", "pass"), ("buildfail", "FAIL", "fail"), ("nohealth", "FAIL", "fail"),
                                                 ("nodaemon", "NOT_RUN", "pass")])
def test_real_script_with_a_fake_docker(g, fake_docker, monkeypatch, tmp_path, mode, result, verdict):
    monkeypatch.setenv("FAKE_DOCKER_MODE", mode)
    logd = tmp_path / "logs"
    logd.mkdir()
    ex = {}
    out = g.addon_build_finish(g.addon_build_start(ROOT, logd), ex)
    assert out["result"] == result and g.compute_verdict([]) == verdict, out
    argv = fake_docker.read_text() if fake_docker.exists() else ""
    if mode == "ok":
        by = (ROOT / "smplwise_vms" / "build.yaml").read_text(encoding="utf-8")
        amd = next(ln.split(":", 1)[1].strip() for ln in by.splitlines() if ln.strip().startswith("amd64:"))
        build = next(ln for ln in argv.splitlines() if ln.startswith("docker build "))
        assert f"BUILD_FROM={amd}" in build and "BUILD_ARCH=amd64" in build and "BUILD_VERSION=" in build
        assert "--no-cache" not in build and build.rstrip().endswith(str(ROOT / "smplwise_vms")), "cached layers; the add-on folder is the context"
        assert all("--network none" in ln for ln in argv.splitlines() if ln.startswith("docker run ")), "smoke steps never reach the network"
        assert [s["name"] for s in out["steps"]] == ["lock_static", "lock_wheels", "lock_pip", "build", "import_smplwise", "import_server",
                                                     "server_healthz", "system_tools", "constraints_match"]
        assert [s["result"] for s in out["steps"]][:3] == ["PASS", "NOT_RUN", "NOT_RUN"], "ADDON_BUILD_LOCK=static: offline only"
        assert "open('/app/constraints.txt'" in argv, "constraints_match reads the lock inside the image"
    if mode == "buildfail":
        assert any("exit code: 127" in ln for ln in out["log_tail"])
    if mode == "nodaemon":
        assert "docker" in out["reason"] and g.ITEMS[-1]["status"] == "SKIPPED_NOT_RUN"
        assert "docker build" not in argv, "nothing is built (or installed) without an engine"
        assert [s["name"] for s in out["steps"]][:1] == ["lock_static"] and "lock_static:PASS" in out["reason"], "the lock is checked anyway"


@posix
def test_script_detect_only_and_usage(fake_docker, monkeypatch, tmp_path):
    import subprocess
    monkeypatch.setenv("FAKE_DOCKER_MODE", "ok")
    r = subprocess.run(["bash", str(SCRIPT), "--detect-only"], capture_output=True, text=True, timeout=60)
    assert r.returncode == 0 and "detect only" in r.stdout.splitlines()[-1]
    assert "docker build" not in fake_docker.read_text()
    monkeypatch.setenv("FAKE_DOCKER_MODE", "nodaemon")
    r = subprocess.run(["bash", str(SCRIPT), "--detect-only"], capture_output=True, text=True, timeout=60)
    assert r.returncode == 3 and "apt-get install -y docker.io" in r.stdout and r.stdout.splitlines()[-1].startswith("ADDON_BUILD: NOT_RUN")
    assert subprocess.run(["bash", str(SCRIPT), "--bogus"], capture_output=True, text=True, timeout=30).returncode == 2
