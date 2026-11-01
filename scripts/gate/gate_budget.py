#!/usr/bin/env python3
"""Per-phase time budgets, the derived total cap and the lateness report of the release gate (GATE-FAST-2291, item 4).

Pure helpers, no test is started. Used by release_gate.py (budgets + lateness), release_gate.sh / release_gate2.sh (the cap).

  budgets   a phase budget = the previous accepted run's seconds for that phase x 1.25 (same mode: "full" or "select");
            a phase the history does not know gets the seed from gate_phase_budgets.json (an ESTIMATE, not measured)
  cap       total cap = sum of the phase budgets x 1.5, clamped to [GATE_CAP_MIN, GATE_CAP_MAX] seconds; an explicit
            GATE_TOTAL_SECS in the environment always wins (the old fixed 5400 / 7200 / 12000 defaults are the fallback
            when this module or the seed file is missing)
  lateness  a phase that ended (or is still running) past its budget is reported at once: "phase X is N s late, likely cause: ..."

CLI:
  gate_budget.py cap --results DIR [--mode full|select] [--seed FILE]     prints the cap in seconds (one integer); rc 2 = no data
  gate_budget.py show --results DIR [--mode full|select] [--seed FILE]    prints the budgets table
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEED_NAME = "gate_phase_budgets.json"
MARGIN = float(os.environ.get("GATE_BUDGET_MARGIN", "1.25"))      # budget = previous seconds x 1.25
CAP_FACTOR = float(os.environ.get("GATE_CAP_FACTOR", "1.5"))      # cap = sum of budgets x 1.5
CAP_MIN = int(os.environ.get("GATE_CAP_MIN", "1800"))
CAP_MAX = int(os.environ.get("GATE_CAP_MAX", "14400"))
HIGH_LOAD = float(os.environ.get("GATE_LATE_LOAD1", "30"))       # plan: load above 30 = a probable run fault, not a bug
LOW_MEM_MB = 2500
SKIP_MARKS = (".checkpoint", ".pre-gate2", ".gate2-first", ".selection", "quarantine", "gate_status", ".early")


def mode_of(doc: dict) -> str:
    """"select" when the report ran a diff selection that dropped files, else "full"."""
    return "select" if ((doc.get("selection") or {}).get("reduced")) else "full"


def load_seed(seed: Path | None = None) -> dict:
    p = Path(seed) if seed else HERE / SEED_NAME
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def history(results: Path, mode: str) -> dict | None:
    """The newest PASSED tier-L report of this mode (gate_*.json directly in `results`), or None."""
    best, best_key = None, ""
    for p in Path(results).glob("gate_*.json"):
        if any(m in p.name for m in SKIP_MARKS):
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(d, dict) or d.get("verdict") != "pass" or d.get("tier") != "L" or not d.get("phases") or mode_of(d) != mode:
            continue
        key = str(d.get("finished") or "")
        if key >= best_key:
            best, best_key = d, key
    return best


def phase_seconds(doc: dict) -> dict:
    out: dict = {}
    for ph in doc.get("phases", []):
        out[ph["name"]] = out.get(ph["name"], 0) + int(ph.get("seconds", 0))
    return out


def derive_budgets(results: Path | None, mode: str, seed: Path | None = None) -> dict:
    """{phase: {"budget_s": int, "source": "history:<branch>@<sha>" | "seed"}}. Seed phases the history lacks are kept."""
    sd = (load_seed(seed).get("modes") or {}).get(mode) or {}
    out = {n: {"budget_s": int(v), "source": "seed"} for n, v in sd.items() if not n.startswith("_")}
    h = history(results, mode) if results else None
    if h:
        for n, s in phase_seconds(h).items():
            out[n] = {"budget_s": max(15, int(round(s * MARGIN))), "source": f"history:{h.get('branch')}@{h.get('sha')}"}
    return out


def total_cap(budgets: dict) -> int:
    s = sum(b["budget_s"] for b in budgets.values())
    return int(min(CAP_MAX, max(CAP_MIN, round(s * CAP_FACTOR)))) if s else 0


def probable_cause(load1, mem_mb) -> str:
    if load1 is not None and load1 > HIGH_LOAD:
        return f"machine overload (max load {load1:.0f} > {HIGH_LOAD:.0f}): probably a run fault, not a product bug"
    if mem_mb is not None and mem_mb < LOW_MEM_MB:
        return f"low memory (min {mem_mb} MB free): probably a run fault"
    return "no overload seen: the phase simply has more work than last time (check the diff size)"


def late_note(name: str, seconds: int, budget: int, load1=None, mem_mb=None, running: bool = False) -> dict:
    late = int(seconds - budget)
    cause = probable_cause(load1, mem_mb)
    en = f"phase {name} {'is' if running else 'was'} {late} s late ({seconds} s vs budget {budget} s): {cause}"
    he = f"השלב {name} מאחר ב-{late} שניות ({seconds} מול תקציב {budget}). סיבה סבירה: {cause}"
    return {"phase": name, "seconds": int(seconds), "budget_s": int(budget), "late_s": late, "running": running, "cause": cause, "en": en, "he": he}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["cap", "show"])
    ap.add_argument("--results", default=os.environ.get("GATE_RESULTS_DIR") or str(Path.home() / "smplwise-results"))
    ap.add_argument("--mode", choices=["full", "select"], default="full")
    ap.add_argument("--seed")
    ns = ap.parse_args(argv)
    b = derive_budgets(Path(ns.results), ns.mode, Path(ns.seed) if ns.seed else None)
    cap = total_cap(b)
    if ns.cmd == "cap":
        if not cap:
            return 2          # no seed, no history: the caller keeps its fixed default
        print(cap)
        return 0
    for n, v in b.items():
        print(f"{n:24} {v['budget_s']:6d} s  {v['source']}")
    print(f"total cap = sum x {CAP_FACTOR} = {cap} s ({cap // 60} min)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
