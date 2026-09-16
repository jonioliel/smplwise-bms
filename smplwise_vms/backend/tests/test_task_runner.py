"""T073: the local task runner dispatches one invocation per task only after the CLI is validated, and enforces the
dependency gate, the attempt cap, the workspace allowlist, the budget bound, a hard timeout and a manual stop;
every run leaves an invocation and a result against a fixed schema; nothing is simulated in a dry run."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("task_runner", ROOT / "scripts" / "task_runner.py")
runner = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(runner)

FAKE_CLI = """import sys, time, json
if "--version" in sys.argv:
    print("fake-cli 1.0"); sys.exit(0)
mode = open(sys.argv[-1], encoding="utf-8").read() if sys.argv[-1].endswith(".md") else sys.argv[-1]
if "SLEEP" in mode:
    time.sleep(30)
if "FAIL" in mode:
    print("boom"); sys.exit(1)
print("working...")
print('RESULT: {"status": "done", "summary": "ok", "tests_run": ["x"], "changed_files": []}')
"""


def _repo(tmp_path: Path, title_suffix: str = "") -> Path:
    root = tmp_path / "repo"
    (root / "management").mkdir(parents=True)
    (root / "work").mkdir()
    (root / "secrets").mkdir()
    subprocess.run(["git", "init", "-q"], cwd=str(root), check=True)
    tasks = [
        {"id": "T001", "title": "base", "status": "DONE", "dependencies": [], "acceptance": ["a"], "evidence": ["e"], "phase": "G0", "priority": "P0", "owner_role": "dev", "model_policy": {}},
        {"id": "T002", "title": "with evidence only", "status": "BACKLOG", "dependencies": [], "acceptance": ["a"], "evidence": ["pre-evidence"], "phase": "G0", "priority": "P0", "owner_role": "dev", "model_policy": {}},
        {"id": "T010", "title": f"target{title_suffix}", "status": "BACKLOG", "dependencies": ["T001"], "acceptance": ["do it"], "evidence": [], "phase": "V2", "priority": "P1", "owner_role": "dev", "model_policy": {"escalation": "at most 2 repair attempts"}},
        {"id": "T011", "title": "gated", "status": "BACKLOG", "dependencies": ["T002"], "acceptance": ["do it"], "evidence": [], "phase": "V2", "priority": "P1", "owner_role": "dev", "model_policy": {}},
    ]
    (root / "management" / "tasks.json").write_text(json.dumps(tasks), encoding="utf-8")
    (root / "fake_cli.py").write_text(FAKE_CLI, encoding="utf-8")
    return root


def _argv(root: Path, marker: str = "") -> list[str]:
    # the fake CLI receives the prompt file; a marker file name switches its behaviour
    return [sys.executable, str(root / "fake_cli.py"), "{prompt_file}" if not marker else marker]


def test_validate_cli_and_dry_run(tmp_path):
    root = _repo(tmp_path)
    assert runner.validate_cli("definitely-not-a-cli-xyz")["ok"] is False
    v = runner.validate_cli(sys.executable)
    assert v["ok"] is True and v["version"].startswith("Python")
    res = runner.dispatch(root, "T010", sys.executable, model="m", effort="low", workspace=root / "work", budget_usd=1, timeout_s=10, argv_template=_argv(root), dry_run=True)
    assert res["status"] == "dry_run" and res["argv"][1].endswith("fake_cli.py") and res["workspace"] == "work" and res["budget_usd"] == 1
    assert not (root / "management" / "runs").exists(), "a dry run writes nothing"


def test_gates_workspace_budget_and_attempt_cap(tmp_path):
    root = _repo(tmp_path)
    common = dict(model="m", effort="low", workspace=root / "work", budget_usd=1, timeout_s=10, argv_template=_argv(root))
    assert runner.dispatch(root, "T999", sys.executable, **common)["reason"] == "unknown_task"
    assert runner.dispatch(root, "T011", sys.executable, **common)["reason"] == "dependency_gate"
    assert runner.dispatch(root, "T011", sys.executable, **{**common, "gate_mode": "evidence"})["status"] == "done", "evidence mode accepts a dependency that carries evidence"
    assert runner.dispatch(root, "T010", sys.executable, **{**common, "workspace": root / "secrets"})["reason"] == "workspace_denied"
    assert runner.dispatch(root, "T010", sys.executable, **{**common, "workspace": tmp_path})["reason"] == "workspace_denied"
    assert runner.dispatch(root, "T010", sys.executable, **{**common, "budget_usd": 0})["reason"] == "budget"
    assert runner.dispatch(root, "T010", sys.executable, **{**common, "budget_usd": 1000})["reason"] == "budget"
    assert runner.dispatch(root, "T010", "definitely-not-a-cli-xyz", **common)["reason"] == "cli_invalid"
    # two failed runs, then the cap: the third is refused for review, never retried automatically
    fail = dict(common, argv_template=_argv(root, "FAIL"))
    r1 = runner.dispatch(root, "T010", sys.executable, **fail)
    r2 = runner.dispatch(root, "T010", sys.executable, **fail)
    assert r1["status"] == "failed" and r1["exit_code"] == 1 and r2["status"] == "failed"
    r3 = runner.dispatch(root, "T010", sys.executable, **fail)
    assert r3["status"] == "refused" and r3["reason"] == "needs_review" and r3["failed_attempts"] == 2
    attempts = json.loads((root / "management" / "runs" / "T010" / "attempts.json").read_text(encoding="utf-8"))
    assert attempts["failed"] == 2 and len(attempts["runs"]) == 2


def test_successful_run_writes_schema_and_reads_the_report(tmp_path):
    root = _repo(tmp_path)
    res = runner.dispatch(root, "T010", sys.executable, model="m", effort="low", workspace=root / "work", budget_usd=2.5, timeout_s=20, argv_template=_argv(root))
    assert res["status"] == "done" and res["exit_code"] == 0 and res["cli_report"] == {"status": "done", "summary": "ok", "tests_run": ["x"], "changed_files": []}
    assert set(res) == set(runner.RESULT_KEYS) and res["schema"] == runner.SCHEMA and res["violations"] == []
    run_dir = root / "management" / "runs" / "T010" / res["run_id"]
    assert (run_dir / "prompt.md").is_file() and (run_dir / "invocation.json").is_file() and (run_dir / "result.json").is_file() and "working..." in (run_dir / "run.log").read_text(encoding="utf-8")
    prompt = (run_dir / "prompt.md").read_text(encoding="utf-8")
    assert "T010" in prompt and "never touch secrets/" in prompt and "RESULT:" in prompt
    inv = json.loads((run_dir / "invocation.json").read_text(encoding="utf-8"))
    assert inv["cli"]["ok"] and inv["budget_usd"] == 2.5 and inv["timeout_s"] == 20


def test_timeout_and_manual_stop(tmp_path):
    root = _repo(tmp_path)
    slow = _argv(root, "SLEEP")
    res = runner.dispatch(root, "T010", sys.executable, model="m", effort="low", workspace=root / "work", budget_usd=1, timeout_s=2, argv_template=slow, poll_s=0.2)
    assert res["timed_out"] is True and res["stopped_by"] == "timeout" and res["status"] == "failed" and res["seconds"] < 15
    # manual stop: a STOP file in the run directory ends the run
    root2 = _repo(tmp_path / "second")
    out: dict = {}

    def go():
        out["res"] = runner.dispatch(root2, "T010", sys.executable, model="m", effort="low", workspace=root2 / "work", budget_usd=1, timeout_s=60, argv_template=_argv(root2, "SLEEP"), poll_s=0.2)

    th = threading.Thread(target=go)
    th.start()
    deadline = time.time() + 10
    run_dirs = []
    while time.time() < deadline and not run_dirs:
        run_dirs = list((root2 / "management" / "runs" / "T010").glob("*T*Z")) if (root2 / "management" / "runs" / "T010").exists() else []
        time.sleep(0.2)
    assert run_dirs, "the run directory appears while the CLI runs"
    (run_dirs[0] / "STOP").write_text("stop", encoding="utf-8")
    th.join(timeout=30)
    assert out["res"]["stopped_by"] == "manual" and out["res"]["status"] == "stopped" and out["res"]["seconds"] < 20
