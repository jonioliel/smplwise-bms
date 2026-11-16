#!/usr/bin/env python3
"""Backend static check (CR-BE-GATES-2436; review findings 04:F06 and 01:F-17): ruff with the pyflakes rules only (`F`), as configured in
smplwise_vms/backend/pyproject.toml ([tool.ruff.lint] select = ["F"]). NON-BLOCKING lane: it reports the current count, it never fails a
gate. The fixes themselves come later (wave 3B, CR-PYFLAKES-ENFORCE flips the lane to blocking).

  lint_backend.py [--root <checkout>] [--json] [--strict]
    --root    the checkout to lint (default: GATE_LINT_ROOT, else the checkout this script sits in, else ~/smplwisebms)
    --json    print one JSON document instead of the text summary
    --strict  exit 1 when there is a finding (for the later blocking switch; the gate does not pass it today)

Exit codes: 0 always without --strict (also when ruff is not installed: the lane then reports NOT_RUN); with --strict 1 on a finding,
2 when the lint could not run. Reads files only, changes nothing.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = Path("smplwise_vms") / "backend"
PACKAGE = "smplwise"
TIMEOUT_S = 120


def default_root() -> Path:
    """GATE_LINT_ROOT, else the checkout this script sits in, else ~/smplwisebms (the runner installs the gate scripts by copy into ~ or
    ~/gate2, outside any checkout - README_GATE_FAST.md)."""
    env = os.environ.get("GATE_LINT_ROOT")
    if env:
        return Path(env)
    for cand in (HERE.parent.parent, Path.home() / "smplwisebms"):
        if (cand / BACKEND / "pyproject.toml").is_file():
            return cand
    return HERE.parent.parent


def ruff_command() -> list[str] | None:
    """The ruff executable on PATH, else `<this python> -m ruff` when the module is importable, else None."""
    exe = shutil.which("ruff")
    if exe:
        return [exe]
    probe = subprocess.run([sys.executable, "-m", "ruff", "--version"], capture_output=True, text=True)
    return [sys.executable, "-m", "ruff"] if probe.returncode == 0 else None


def area_of(rel: str) -> str:
    """The review area of a finding's file (rel to the backend dir): 'tickets' for services/tickets/* and routers/tickets*.py (review 01),
    'services/<pkg>' for a services sub-package, else the first directory ('services', 'routers', ...) or '(package root)'."""
    parts = Path(rel).parts
    if len(parts) < 3 or parts[0] != PACKAGE:
        return "(package root)"
    if parts[1:3] == ("services", "tickets") or (parts[1] == "routers" and parts[-1].startswith("tickets")):
        return "tickets"
    if parts[1] == "services" and len(parts) >= 4:
        return f"services/{parts[2]}"
    return parts[1]


def summarise(findings: list[dict], backend: Path) -> dict:
    by_code: Counter[str] = Counter()
    by_area: Counter[str] = Counter()
    for f in findings:
        by_code[str(f.get("code") or "?")] += 1
        try:
            rel = Path(f.get("filename", "")).resolve().relative_to(backend.resolve()).as_posix()
        except ValueError:
            rel = str(f.get("filename", ""))
        by_area[area_of(rel)] += 1
    return {"total": len(findings), "by_code": dict(sorted(by_code.items())), "by_area": dict(sorted(by_area.items(), key=lambda kv: (-kv[1], kv[0])))}


def run(root: Path) -> dict:
    backend = root / BACKEND
    if not (backend / "pyproject.toml").is_file() or not (backend / PACKAGE).is_dir():
        return {"state": "NOT_RUN", "why": f"no backend tree under {root}"}
    cmd = ruff_command()
    if cmd is None:
        return {"state": "NOT_RUN", "why": "ruff is not installed (pip install ruff)"}
    try:
        r = subprocess.run([*cmd, "check", "--output-format", "json", "--exit-zero", "--no-cache", PACKAGE],
                           cwd=backend, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=TIMEOUT_S)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"state": "NOT_RUN", "why": f"ruff did not finish: {exc.__class__.__name__}"}
    if r.returncode != 0:
        return {"state": "NOT_RUN", "why": f"ruff exit {r.returncode}: {(r.stderr or r.stdout).strip()[:300]}"}
    try:
        findings = json.loads(r.stdout or "[]")
    except ValueError:
        return {"state": "NOT_RUN", "why": "ruff output is not JSON"}
    version = subprocess.run([*cmd, "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.strip()
    out = {"state": "ok" if not findings else "findings", "ruff": version, **summarise(findings, backend)}
    out["sample"] = [f"{Path(f.get('filename', '')).name}:{(f.get('location') or {}).get('row', '?')} {f.get('code')} {f.get('message', '')}"[:160]
                     for f in findings[:10]]
    return out


def text(res: dict) -> str:
    if res["state"] == "NOT_RUN":
        return f"backend lint (ruff F, non-blocking): NOT_RUN - {res['why']}"
    lines = [f"backend lint (ruff F, non-blocking): {res['total']} finding(s) [{res.get('ruff', 'ruff')}]"]
    if res["total"]:
        lines.append("  by rule: " + ", ".join(f"{k} {v}" for k, v in res["by_code"].items()))
        lines.append("  by area: " + ", ".join(f"{k} {v}" for k, v in res["by_area"].items()))
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--strict", action="store_true")
    ns = ap.parse_args(argv)
    res = run(Path(ns.root) if ns.root else default_root())
    print(json.dumps(res, indent=1) if ns.json else text(res))
    if not ns.strict:
        return 0
    if res["state"] == "NOT_RUN":
        return 2
    return 1 if res["total"] else 0


if __name__ == "__main__":
    sys.exit(main())
