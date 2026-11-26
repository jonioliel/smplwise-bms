#!/usr/bin/env python3
"""LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-08, part "no coverage measurement"): a REPORT-ONLY line-coverage lane for the backend,
stdlib only (Python 3.12 `sys.monitoring`; no pytest-cov / coverage package, nothing to install on the runner).

Two halves:
- a pytest plugin (`-p coverage_lane`, this directory on PYTHONPATH): when SW_COVERAGE_OUT is set, records every line of the files under
  SW_COVERAGE_SRC that ran in this pytest process and writes {"src": ..., "files": {relpath: [lines]}} to SW_COVERAGE_OUT at the end.
  Each code location reports once (the callback answers DISABLE), so the overhead stays small. Without SW_COVERAGE_OUT it does nothing.
- `coverage_lane.py report --src <package dir> --out <report.md> [--json <summary.json>] shard.json ...`: merges the shards and writes a
  Markdown report (total, the least-covered modules, the modules no test imported). It NEVER fails a run: any problem is written into the
  report and the exit code is 0.

Counting: the executable lines of a file are the line numbers of its compiled code objects (`co_lines`), the executed ones the LINE
events seen. That is close to, not identical with, coverage.py's numbers (a `def` / decorator line counts when the module is
imported; a docstring-only line is not executable) - good enough to answer "which module has no test", which no gate could before.
Driven by `scripts/gate/coverage_lane.sh`; not part of any gate (report only).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import types
from pathlib import Path
from typing import Any

_ENV_OUT, _ENV_SRC = "SW_COVERAGE_OUT", "SW_COVERAGE_SRC"


def _norm(p: str | os.PathLike[str]) -> str:
    return os.path.normcase(os.path.abspath(os.fspath(p)))


class Recorder:
    """Line recorder on `sys.monitoring` for the files under `src`."""

    def __init__(self, src: str | os.PathLike[str]) -> None:
        self.src = _norm(src)
        self._prefix = self.src.rstrip(os.sep) + os.sep
        self.hits: dict[str, set[int]] = {}
        self.tool: int | None = None

    def _on_line(self, code: types.CodeType, line: int) -> Any:
        name = code.co_filename
        if _norm(name).startswith(self._prefix):
            self.hits.setdefault(_norm(name), set()).add(line)
        return sys.monitoring.DISABLE  # this location never reports again: the cost is one call per line, once

    def start(self) -> bool:
        mon = getattr(sys, "monitoring", None)
        if mon is None:
            return False
        for tool in (getattr(mon, "COVERAGE_ID", 1), 3, 4):  # a free tool id (a debugger or a nested recorder may hold one)
            if mon.get_tool(tool) is None:
                mon.use_tool_id(tool, "smplwise-coverage-lane")
                mon.register_callback(tool, mon.events.LINE, self._on_line)
                mon.set_events(tool, mon.events.LINE)
                self.tool = tool
                return True
        return False

    def stop(self) -> None:
        if self.tool is None:
            return
        mon = sys.monitoring
        mon.set_events(self.tool, mon.events.NO_EVENTS)
        mon.register_callback(self.tool, mon.events.LINE, None)
        mon.free_tool_id(self.tool)
        self.tool = None

    def data(self) -> dict[str, Any]:
        return {"src": self.src, "files": {os.path.relpath(f, self.src).replace(os.sep, "/"): sorted(v) for f, v in sorted(self.hits.items())}}


# ------------------------------------------------------------------------------------------------ the pytest plugin

_REC: Recorder | None = None


def pytest_configure(config: Any) -> None:  # noqa: ARG001 - pytest hook signature
    global _REC
    out, src = os.environ.get(_ENV_OUT), os.environ.get(_ENV_SRC)
    if not out or not src or _REC is not None:
        return
    rec = Recorder(src)
    if rec.start():
        _REC = rec


def pytest_unconfigure(config: Any) -> None:  # noqa: ARG001
    global _REC
    rec, _REC = _REC, None
    if rec is None:
        return
    rec.stop()
    out = Path(os.environ[_ENV_OUT])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rec.data()), encoding="utf-8")


# ------------------------------------------------------------------------------------------------ the report

def executable_lines(path: Path) -> set[int]:
    code = compile(path.read_text(encoding="utf-8"), str(path), "exec")
    lines: set[int] = set()
    stack = [code]
    while stack:
        c = stack.pop()
        lines.update(ln for _, _, ln in c.co_lines() if ln is not None and ln > 0)
        stack.extend(k for k in c.co_consts if isinstance(k, types.CodeType))
    return lines


def summarise(src: Path, shards: list[dict[str, Any]]) -> dict[str, Any]:
    hit: dict[str, set[int]] = {}
    for shard in shards:
        for rel, lines in (shard.get("files") or {}).items():
            hit.setdefault(rel, set()).update(int(x) for x in lines)
    rows, problems = [], []
    for path in sorted(src.rglob("*.py")):
        rel = path.relative_to(src).as_posix()
        if "__pycache__" in path.parts:
            continue
        try:
            exe = executable_lines(path)
        except (SyntaxError, UnicodeDecodeError, OSError) as exc:
            problems.append(f"{rel}: not compiled ({type(exc).__name__})")
            continue
        ran = hit.get(rel, set()) & exe
        rows.append({"module": rel, "lines": len(exe), "ran": len(ran), "pct": round(100.0 * len(ran) / len(exe), 1) if exe else 100.0})
    total = sum(r["lines"] for r in rows)
    ran = sum(r["ran"] for r in rows)
    return {"modules": len(rows), "lines": total, "ran": ran, "pct": round(100.0 * ran / total, 1) if total else 0.0,
            "never_imported": [r["module"] for r in rows if r["ran"] == 0 and r["lines"] > 0], "rows": rows, "problems": problems,
            "shards": len(shards)}


def markdown(s: dict[str, Any], *, least: int = 40, min_lines: int = 20) -> str:
    out = ["# Backend line coverage (report only - never fails a run)", "",
           f"- shards: {s['shards']}; modules: {s['modules']}; executable lines: {s['lines']}; ran: {s['ran']} (**{s['pct']} %**)",
           f"- modules no test imported (0 lines ran): {len(s['never_imported'])}", ""]
    worst = sorted((r for r in s["rows"] if r["lines"] >= min_lines), key=lambda r: (r["pct"], -r["lines"]))[:least]
    out += [f"## The {len(worst)} least-covered modules (at least {min_lines} lines)", "", "| module | lines | ran | % |", "|---|---:|---:|---:|"]
    out += [f"| `{r['module']}` | {r['lines']} | {r['ran']} | {r['pct']} |" for r in worst]
    out += ["", "## Modules no test imported", ""] + ([f"- `{m}`" for m in s["never_imported"]] or ["- none"])
    if s["problems"]:
        out += ["", "## Not measured", ""] + [f"- {p}" for p in s["problems"]]
    return "\n".join(out) + "\n"


def report(src: Path, shard_files: list[Path], out: Path, summary_json: Path | None = None) -> int:
    shards, notes = [], []
    for f in shard_files:
        try:
            shards.append(json.loads(f.read_text(encoding="utf-8")))
        except (OSError, ValueError) as exc:
            notes.append(f"shard {f.name}: unreadable ({type(exc).__name__}) - that shard's lines are missing")
    try:
        s = summarise(src, shards)
        s["problems"] = notes + s["problems"]
        text = markdown(s)
    except Exception as exc:  # noqa: BLE001 - report only: never fail the run
        s = {"error": type(exc).__name__}
        text = f"# Backend line coverage\n\nNOT MEASURED: the report failed ({type(exc).__name__}: {exc}).\n"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    if summary_json is not None:
        summary_json.write_text(json.dumps({k: v for k, v in s.items() if k != "rows"}, indent=1), encoding="utf-8")
    print(text.splitlines()[2] if len(text.splitlines()) > 2 else text.strip())
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("report")
    r.add_argument("--src", required=True, type=Path)
    r.add_argument("--out", required=True, type=Path)
    r.add_argument("--json", type=Path)
    r.add_argument("shards", nargs="*", type=Path)
    a = ap.parse_args(argv)
    try:
        return report(a.src, a.shards, a.out, a.json)
    except Exception as exc:  # noqa: BLE001 - report only
        print(f"coverage report not written: {type(exc).__name__}: {exc}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
