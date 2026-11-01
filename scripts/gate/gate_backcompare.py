#!/usr/bin/env python3
"""Back-comparison of past release gates against the change-based selection (GATE-FAST-2291, item 1). Runs NO test.

For every gate report in a results directory (gate_<branch>_<sha>.json, as written by release_gate.py) it answers:
  * what would gate 2 have selected for that sha against the previous release tag (gate2_select.select_gate2, read-only on git),
  * which of the files that really FAILED in that gate the selection would have missed (selected, full-tier trigger, deferred to
    the nightly, or MISSED) - a MISSED failing file is the number that matters,
  * how much of the suite the selection would have dropped (files; Playwright seconds from gate2_costs.json),
  * why the fast gate was not used: the state of the newest full nightly on main at the moment the gate started
    (gate_entry.judge_nightly: green / explained / red / stale / missing) and whether the report is a gate-2 report at all.

  gate_backcompare.py --results ~/smplwise-results --repo ~/smplwisebms [--last 8] [--out report.md]
                      [--selection-dir DIR]   use gate_<b>_<sha>.selection.json files instead of recomputing (no checkout needed)
                      [--bases sha=ref,...]   override the base ref of one gate (default: newest v* tag below the sha)
It checks each sha out in a temporary detached worktree of --repo (removed afterwards) and starts nothing else. Needs the repository
history (tags) and, for the nightly column, <results>/nightly/gate_main_*.json. Run it where those exist (the lead's checkout with
copies of the result files, or the runner when a gate is not running). The quarantine file used is the current one.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gate_entry as ge          # noqa: E402
import gate2_verdict as g2v      # noqa: E402

SKIP = (".checkpoint", ".pre-gate2", ".gate2-first", ".selection", ".early", "quarantine", "gate_status")


def reports(results: Path, last: int) -> list[tuple[Path, dict]]:
    out = []
    for p in Path(results).glob("gate_*.json"):
        if any(m in p.name for m in SKIP):
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(d, dict) and d.get("verdict") and d.get("sha") and d.get("tier") == "L":
            out.append((p, d))
    out.sort(key=lambda t: str(t[1].get("started") or ""))
    return out[-last:] if last else out


def failed_of(doc: dict) -> dict:
    """The failing test files of a report, in gate2_select.failed_files' terms (re-implemented: no import of the heavy selector)."""
    import re
    be, fe = set(), set()
    for i in doc.get("items", []):
        if i.get("status") != "FAIL":
            continue
        ident = i.get("id", "")
        m = re.match(r"tests/(test_[^:]+\.py)", ident)
        if i.get("category") == "backend" and m:
            be.add(m.group(1))
            continue
        m = re.match(r"([\w.-]+\.spec\.ts)", ident)
        if m:
            fe.add(m.group(1))
    return {"backend": be, "frontend": fe}


def git(repo: Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True, check=True).stdout.strip()


def base_tag(repo: Path, sha: str, bases: dict) -> str:
    if sha in bases:
        return bases[sha]
    tag = git(repo, "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", sha)
    if git(repo, "rev-list", "-n1", tag)[:7] == git(repo, "rev-parse", sha)[:7]:      # the sha IS the tag: use the one before
        tag = git(repo, "describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", sha + "^")
    return tag


def selection_for(doc: dict, repo: Path | None, selection_dir: Path | None, bases: dict) -> dict:
    sha, tag = doc["sha"], "".join(c if c.isalnum() or c in "._-" else "-" for c in str(doc.get("branch", "")))
    if selection_dir:
        f = Path(selection_dir) / f"gate_{tag}_{sha}.selection.json"
        if f.exists():
            return {**json.loads(f.read_text(encoding="utf-8")), "_source": f.name}
    if not repo:
        raise RuntimeError("no --repo and no stored selection for this gate")
    import gate2_select as g2s        # heavy import (select_tests): only when a selection really has to be computed
    base = base_tag(repo, sha, bases)
    tmp = Path(tempfile.mkdtemp(prefix="gate_backcompare_"))
    try:
        subprocess.run(["git", "-C", str(repo), "worktree", "add", "--detach", "-q", str(tmp / "wt"), sha], check=True, capture_output=True)
        costs = g2s.load_costs(None)
        sel = g2s.select_gate2(tmp / "wt", base, "HEAD", costs=costs)
        sel["_source"] = f"computed against {base}"
        return sel
    finally:
        subprocess.run(["git", "-C", str(repo), "worktree", "remove", "--force", str(tmp / "wt")], capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)


def judge(failing: set, sel_block: dict, full_hit: bool, deferred: dict) -> dict:
    sel, total = set(sel_block.get("selected", [])), sel_block.get("total", 0)
    out = {"failing": len(failing), "covered": [], "deferred": [], "missed": []}
    for f in sorted(failing):
        if full_hit or f in sel:
            out["covered"].append(f)
        elif f in deferred:
            out["deferred"].append(f)
        else:
            out["missed"].append(f)
    out["selected"] = total if full_hit else len(sel)
    out["total"] = total
    return out


def compare_one(doc: dict, sel: dict, nightlies: list, entries: list) -> dict:
    fails = failed_of(doc)
    started = ge.parse_ts(doc.get("started")) or dt.datetime.now(dt.timezone.utc)
    prior = [(f, d, n) for f, d, n in nightlies if f <= started]
    night = ge.judge_nightly(prior[0][1], prior[0][0], started, entries) if prior else {"state": "missing", "ok": False, "why": "no nightly report before this gate"}
    full = sel.get("full", {})
    deferred = sel.get("deferred_to_nightly", {})
    res_be = judge(fails["backend"], sel.get("backend", {}), bool(full.get("backend")), {})
    res_fe = judge(fails["frontend"], sel.get("frontend", {}), bool(full.get("frontend")), deferred)
    secs = (sel.get("frontend") or {}).get("dropped", [])
    return {"branch": doc.get("branch"), "sha": doc.get("sha"), "verdict": doc.get("verdict"), "wall_min": (doc.get("wall_seconds") or 0) // 60,
            "schedule": doc.get("schedule", "v1"), "gate2_report": bool(doc.get("selection")), "nightly": night, "backend": res_be, "frontend": res_fe,
            "full_triggers": {k: v[:3] for k, v in full.items() if v}, "dropped_frontend_files": len(secs), "source": sel.get("_source", "")}


def to_markdown(rows: list[dict], errors: list[str]) -> str:
    L = ["# Back-comparison: what the change-based selection would have done on past gates", "",
         "| gate | verdict | wall | backend selected/total | frontend selected/total | failing files | MISSED | deferred | nightly then | gate-2 report |",
         "|---|---|---|---|---|---|---|---|---|---|"]
    tm = td = tf = 0
    for r in rows:
        b, f = r["backend"], r["frontend"]
        miss, dfr, fl = b["missed"] + f["missed"], f["deferred"], b["failing"] + f["failing"]
        tm, td, tf = tm + len(miss), td + len(dfr), tf + fl
        L.append(f"| {r['branch']} @ {r['sha']} | {r['verdict']} | {r['wall_min']} min | {b['selected']}/{b['total']} | {f['selected']}/{f['total']} | {fl} | "
                 f"{len(miss)} | {len(dfr)} | {r['nightly']['state']} | {'yes' if r['gate2_report'] else 'no'} |")
    L += ["", f"Totals: {tf} failing test files over {len(rows)} gates; MISSED by the selection: {tm}; deferred to the nightly: {td}.", ""]
    for r in rows:
        miss = r["backend"]["missed"] + r["frontend"]["missed"]
        L += [f"## {r['branch']} @ {r['sha']} ({r['verdict']}, {r['wall_min']} min, {r['schedule']})", "",
              f"- selection: {r['source']}; full-tier triggers: {r['full_triggers'] or 'none'}; frontend files dropped: {r['dropped_frontend_files']}",
              f"- nightly on main when the gate started: **{r['nightly']['state']}** - {r['nightly'].get('why', '')}"
              + ("" if r["nightly"].get("ok") else "  -> the fast gate would NOT have been allowed (full tier)"),
              f"- failing files missed by the selection: {', '.join(miss) if miss else 'none'}"]
        if r["frontend"]["deferred"]:
            L.append(f"- failing files deferred to the nightly (heavy sweeps): {', '.join(r['frontend']['deferred'])}")
        L.append("")
    if errors:
        L += ["## Not compared", ""] + [f"- {e}" for e in errors]
    return "\n".join(L) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--results", required=True)
    ap.add_argument("--repo")
    ap.add_argument("--last", type=int, default=8)
    ap.add_argument("--out")
    ap.add_argument("--selection-dir")
    ap.add_argument("--bases", default="")
    ns = ap.parse_args(argv)
    bases = dict(kv.split("=", 1) for kv in ns.bases.split(",") if "=" in kv)
    repo = Path(ns.repo) if ns.repo else None
    entries, _ = g2v.load_quarantine(HERE / "gate2_quarantine.json")
    nightlies = ge.nightly_reports(Path(ns.results))
    rows, errors = [], []
    for p, d in reports(Path(ns.results), ns.last):
        try:
            sel = selection_for(d, repo, Path(ns.selection_dir) if ns.selection_dir else None, bases)
            rows.append(compare_one(d, sel, nightlies, entries))
        except Exception as e:   # noqa: BLE001 - one unreadable gate never stops the table
            errors.append(f"{p.name}: {type(e).__name__}: {str(e)[:160]}")
    md = to_markdown(rows, errors)
    if ns.out:
        Path(ns.out).write_text(md, encoding="utf-8")
    print(md)
    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())
