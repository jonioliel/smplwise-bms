#!/usr/bin/env python3
"""Optional local runner for task cards (T073): one invocation of a local coding CLI per task, with gates.

    python scripts/task_runner.py validate --cli claude
    python scripts/task_runner.py run T0xx --cli claude --model claude-sonnet-5 --effort medium --budget-usd 5 --timeout-s 1800
    python scripts/task_runner.py stop T0xx
    python scripts/task_runner.py status T0xx

What it enforces, in this order, before anything runs:
  1. the CLI answers `--version` (no dispatch without a validated local CLI);
  2. dependency gate: the card's dependencies are DONE (or, with --gate evidence, carry evidence);
  3. attempt cap: after `--max-attempts` failed runs the task needs an explicit review (no endless repair loops);
  4. workspace allowlist: the workspace is inside the repository and outside secrets/, private-evidence/, legacy/, data/;
  5. budget: a positive budget per run, capped, recorded; nothing here can authorise more spend.
While it runs: a hard timeout kills the process; a STOP file in the run directory stops it by hand.
Afterwards: stdout/stderr, the exit code, the elapsed time, the files the run changed (from git) and any write
under a denied prefix are written to result.json against a fixed schema; a violation is reported, never hidden.
Nothing is simulated: without a real CLI the dry run only prints what would be invoked."""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any

DENIED_PREFIXES = ("secrets", "private-evidence", "legacy", "data", ".git", ".venv", "node_modules")
DEFAULT_ARGV = ["{cli}", "--print", "--model", "{model}", "{prompt}"]
MAX_BUDGET_USD = 25.0
RESULT_KEYS = ("schema", "task", "run_id", "cli", "model", "effort", "workspace", "budget_usd", "started_at", "ended_at", "seconds", "exit_code", "timed_out", "stopped_by", "changed_files", "violations", "cli_report", "status")
SCHEMA = "smplwise-task-run/1"


def load_tasks(root: Path) -> list[dict[str, Any]]:
    data = json.loads((root / "management" / "tasks.json").read_text(encoding="utf-8"))
    return data["tasks"] if isinstance(data, dict) else data


def validate_cli(cli: str, timeout_s: float = 20.0) -> dict[str, Any]:
    """The CLI must exist and answer --version; otherwise nothing is dispatched."""
    try:
        p = subprocess.run([cli, "--version"], capture_output=True, text=True, timeout=timeout_s, encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return {"ok": False, "error": "cli_not_found", "cli": cli}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "cli_timeout", "cli": cli}
    except OSError as exc:
        return {"ok": False, "error": f"cli_error_{type(exc).__name__}", "cli": cli}
    if p.returncode != 0:
        return {"ok": False, "error": "cli_exit", "cli": cli, "exit_code": p.returncode, "stderr": (p.stderr or "")[:400]}
    return {"ok": True, "cli": cli, "version": (p.stdout or p.stderr or "").strip().splitlines()[0][:120] if (p.stdout or p.stderr) else ""}


def gate(task: dict[str, Any], tasks: list[dict[str, Any]], mode: str = "done") -> list[str]:
    """Unmet dependencies: DONE required by default; 'evidence' accepts cards that carry evidence."""
    index = {t["id"]: t for t in tasks}
    unmet: list[str] = []
    for dep in task.get("dependencies", []):
        d = index.get(dep)
        if d is None:
            unmet.append(f"{dep} (unknown)")
        elif mode == "done" and d.get("status") != "DONE":
            unmet.append(f"{dep} ({d.get('status')})")
        elif mode == "evidence" and d.get("status") != "DONE" and not d.get("evidence"):
            unmet.append(f"{dep} (no evidence)")
    return unmet


def allowed_workspace(root: Path, workspace: Path) -> tuple[bool, str]:
    try:
        rel = workspace.resolve().relative_to(root.resolve())
    except ValueError:
        return False, "workspace outside the repository"
    first = rel.parts[0] if rel.parts else ""
    if first in DENIED_PREFIXES:
        return False, f"workspace under a denied prefix: {first}/"
    return True, str(rel.as_posix() or ".")


def _git_changed(root: Path) -> list[str]:
    try:
        p = subprocess.run(["git", "status", "--porcelain"], cwd=str(root), capture_output=True, text=True, timeout=30, encoding="utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        return []
    out: list[str] = []
    for line in (p.stdout or "").splitlines():
        if len(line) > 3:
            out.append(line[3:].strip().replace("\\", "/"))
    return out


def build_prompt(task: dict[str, Any], workspace_rel: str, effort: str) -> str:
    acc = "\n".join(f"- {a}" for a in task.get("acceptance", []))
    policy = task.get("model_policy", {})
    return (
        f"# Task {task['id']}: {task['title']}\n\n"
        f"Phase: {task.get('phase')} · Priority: {task.get('priority')} · Effort: {effort} · Owner role: {task.get('owner_role')}\n\n"
        f"## Acceptance\n{acc}\n\n"
        f"## Rules (from AGENTS.md)\n- Work only inside `{workspace_rel}`; never touch secrets/, private-evidence/, legacy/ or data/.\n"
        "- Read-only against devices; no NVR writes, no HA user changes, no physical actions, no spending.\n"
        "- Never claim a test passed unless it ran; report NOT_RUN / BLOCKED honestly.\n"
        f"- Escalation policy: {policy.get('escalation', 'at most 2 repair attempts, then explicit review')}\n\n"
        "## Output\nEnd with a line `RESULT:` followed by one JSON object: {\"status\": \"done|blocked|failed\", \"summary\": \"...\", \"tests_run\": [\"...\"], \"changed_files\": [\"...\"]}.\n"
    )


def _parse_report(stdout: str) -> dict[str, Any] | None:
    m = re.search(r"RESULT:\s*(\{.*\})\s*$", stdout, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(1))
        return obj if isinstance(obj, dict) else None
    except ValueError:
        return None


def attempts_path(root: Path, task_id: str) -> Path:
    return root / "management" / "runs" / task_id / "attempts.json"


def load_attempts(root: Path, task_id: str) -> dict[str, Any]:
    p = attempts_path(root, task_id)
    if not p.exists():
        return {"failed": 0, "runs": []}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except ValueError:
        return {"failed": 0, "runs": []}


def dispatch(root: Path, task_id: str, cli: str, *, model: str, effort: str, workspace: Path, budget_usd: float, timeout_s: int,
             argv_template: list[str] | None = None, dry_run: bool = False, gate_mode: str = "done", max_attempts: int = 2, poll_s: float = 1.0) -> dict[str, Any]:
    tasks = load_tasks(root)
    task = next((t for t in tasks if t["id"] == task_id), None)
    if task is None:
        return {"status": "refused", "reason": "unknown_task", "task": task_id}
    unmet = gate(task, tasks, gate_mode)
    if unmet:
        return {"status": "refused", "reason": "dependency_gate", "task": task_id, "unmet": unmet}
    attempts = load_attempts(root, task_id)
    if attempts.get("failed", 0) >= max_attempts:
        return {"status": "refused", "reason": "needs_review", "task": task_id, "failed_attempts": attempts["failed"], "note": "the attempt cap was reached; a person reviews before any further run"}
    ok, ws_rel = allowed_workspace(root, workspace)
    if not ok:
        return {"status": "refused", "reason": "workspace_denied", "task": task_id, "detail": ws_rel}
    if not (0 < budget_usd <= MAX_BUDGET_USD):
        return {"status": "refused", "reason": "budget", "task": task_id, "detail": f"budget must be within (0, {MAX_BUDGET_USD}] USD per run; nothing here authorises more"}
    v = validate_cli(cli)
    if not v["ok"]:
        return {"status": "refused", "reason": "cli_invalid", "task": task_id, "detail": v}
    run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = root / "management" / "runs" / task_id / run_id
    prompt = build_prompt(task, ws_rel, effort)
    argv = [a.format(cli=cli, model=model, effort=effort, prompt=prompt, prompt_file=str(run_dir / "prompt.md"), workspace=str(workspace)) for a in (argv_template or DEFAULT_ARGV)]
    invocation = {"schema": SCHEMA, "task": task_id, "run_id": run_id, "cli": v, "argv": [a if a != prompt else "<prompt>" for a in argv], "model": model, "effort": effort, "workspace": ws_rel, "budget_usd": budget_usd, "timeout_s": timeout_s, "gate": gate_mode}
    if dry_run:
        return {"status": "dry_run", **invocation}
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "prompt.md").write_text(prompt, encoding="utf-8")
    (run_dir / "invocation.json").write_text(json.dumps(invocation, ensure_ascii=False, indent=2), encoding="utf-8")
    before = set(_git_changed(root))
    started = time.time()
    log = (run_dir / "run.log").open("w", encoding="utf-8")
    proc = subprocess.Popen(argv, cwd=str(workspace), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    chunks: list[str] = []

    def pump() -> None:
        assert proc.stdout is not None
        for line in proc.stdout:
            chunks.append(line)
            log.write(line)
            log.flush()

    t = threading.Thread(target=pump, daemon=True)
    t.start()
    stopped_by = None
    timed_out = False
    while proc.poll() is None:
        if (run_dir / "STOP").exists():
            stopped_by = "manual"
            proc.terminate()
            break
        if time.time() - started > timeout_s:
            timed_out = True
            stopped_by = "timeout"
            proc.terminate()
            break
        time.sleep(poll_s)
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
    t.join(timeout=5)
    log.close()
    ended = time.time()
    after = _git_changed(root)
    changed = sorted(set(after) - before)
    violations = [f for f in changed if f.split("/")[0] in DENIED_PREFIXES or not f.startswith(ws_rel.rstrip("/") + "/") and ws_rel != "."]
    report = _parse_report("".join(chunks))
    exit_code = proc.returncode
    status = "done" if exit_code == 0 and not timed_out and stopped_by is None and not violations and (report or {}).get("status", "done") == "done" else "failed"
    if stopped_by == "manual":
        status = "stopped"
    result = {
        "schema": SCHEMA, "task": task_id, "run_id": run_id, "cli": v, "model": model, "effort": effort, "workspace": ws_rel, "budget_usd": budget_usd,
        "started_at": dt.datetime.fromtimestamp(started, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "ended_at": dt.datetime.fromtimestamp(ended, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "seconds": round(ended - started, 1), "exit_code": exit_code, "timed_out": timed_out, "stopped_by": stopped_by, "changed_files": changed, "violations": violations, "cli_report": report, "status": status,
    }
    assert set(result) == set(RESULT_KEYS), "result schema drift"
    (run_dir / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    attempts["runs"].append({"run_id": run_id, "status": status, "seconds": result["seconds"]})
    if status != "done":
        attempts["failed"] = attempts.get("failed", 0) + 1
    attempts_path(root, task_id).parent.mkdir(parents=True, exist_ok=True)
    attempts_path(root, task_id).write_text(json.dumps(attempts, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Local task runner with gates (T073).")
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate")
    v.add_argument("--cli", required=True)
    r = sub.add_parser("run")
    r.add_argument("task")
    r.add_argument("--cli", required=True)
    r.add_argument("--model", default="claude-sonnet-5")
    r.add_argument("--effort", default="medium")
    r.add_argument("--workspace", default=".")
    r.add_argument("--budget-usd", type=float, required=True)
    r.add_argument("--timeout-s", type=int, default=1800)
    r.add_argument("--argv", help="JSON list template; placeholders {cli} {model} {effort} {prompt} {prompt_file} {workspace}")
    r.add_argument("--gate", choices=["done", "evidence"], default="done")
    r.add_argument("--max-attempts", type=int, default=2)
    r.add_argument("--dry-run", action="store_true")
    s = sub.add_parser("stop")
    s.add_argument("task")
    st = sub.add_parser("status")
    st.add_argument("task")
    args = ap.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    if args.cmd == "validate":
        res = validate_cli(args.cli)
    elif args.cmd == "run":
        res = dispatch(root, args.task, args.cli, model=args.model, effort=args.effort, workspace=Path(args.workspace).resolve(), budget_usd=args.budget_usd, timeout_s=args.timeout_s,
                       argv_template=json.loads(args.argv) if args.argv else None, dry_run=args.dry_run, gate_mode=args.gate, max_attempts=args.max_attempts)
    elif args.cmd == "stop":
        runs = sorted((root / "management" / "runs" / args.task).glob("*T*Z")) if (root / "management" / "runs" / args.task).exists() else []
        if not runs:
            res = {"status": "no_run"}
        else:
            (runs[-1] / "STOP").write_text("stop", encoding="utf-8")
            res = {"status": "stop_requested", "run_id": runs[-1].name}
    else:
        res = load_attempts(root, args.task)
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0 if res.get("status") not in ("refused", "failed") else 1


if __name__ == "__main__":
    sys.exit(main())
