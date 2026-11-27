#!/usr/bin/env python3
"""Per-phase time budgets, the derived total cap and the lateness report of the release gate (GATE-FAST-2291, item 4).

Pure helpers, no test is started. Used by release_gate.py (budgets + lateness), release_gate.sh / release_gate2.sh (the cap).

  budgets   a phase budget = the previous accepted run's seconds for that phase x 1.25 (same mode: "full" or "select");
            a phase the history does not know gets the seed from gate_phase_budgets.json (an ESTIMATE, not measured)
  cap       total cap = sum of the phase budgets x 1.5, clamped to [GATE_CAP_MIN, GATE_CAP_MAX] seconds; an explicit
            GATE_TOTAL_SECS in the environment always wins (the old fixed 5400 / 7200 / 12000 defaults are the fallback
            when this module or the seed file is missing)
  lateness  a phase that ended (or is still running) past its budget is reported at once: "phase X is N s late, likely cause: ..."

  limit     GATE-SPEED-2320: the EFFECTIVE time limit a wrapper hands to `timeout` and the engine (GATE_TOTAL_SECS). The derived cap
            alone killed two gates on 31.10 (cap 2924 s from a small earlier selection vs an ESTIMATE of 117-142 min), so:
              * an explicit GATE_TOTAL_SECS / ENTRY_TOTAL_SECS (--explicit) always wins, as before;
              * a side the selection runs FULL ("full backend : YES" / "full frontend: YES" in the plan) uses the FULL-mode budgets,
                and a FULL frontend also takes the full-tier estimate high (the pool is the critical path);
              * limit = max(derived cap, estimate_high x 1.25) - never below the estimate (est. high = the plan's ESTIMATE line,
                gate2_select.py plan); without a plan the derived cap (else the caller's fallback) is the limit.
            GATE-SPEED-2550: the estimate part also carries the runner's load at the start (--load1 / --nproc, the wrapper passes
            /proc/loadavg and nproc): load factor = 1 + max(0, load1 - GATE_LOAD_FREE x nproc) / nproc, at most GATE_LOAD_FACTOR_MAX
            (1.6), so limit = max(derived cap, estimate_high x 1.25 x load factor). The planner's costs and calibration come from a
            gate that had the machine to itself; other work at the start (an entry check, an agent job) makes every test slower.
            The 2.53 run 2 (--after) was killed at its 67-minute derived cap (a cap from the small 2.52 --after run) while its
            plan said 91-105 min for 14 slots on a run that had 8 (run 3 took 125 min).

CLI:
  gate_budget.py cap --results DIR [--mode full|select] [--seed FILE]     prints the cap in seconds (one integer); rc 2 = no data
  gate_budget.py show --results DIR [--mode full|select] [--seed FILE]    prints the budgets table
  gate_budget.py limit --results DIR --mode full|select [--plan FILE|-] [--explicit SECS] [--fallback SECS] [--seed FILE] [--explain]
                      [--load1 X] [--nproc N]
            prints the effective limit in seconds (one integer, rc 0); --explain writes one line "why" to stderr
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
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


# ---------------------------------------------------------------- GATE-SPEED-2320: the effective limit (cap vs the plan's estimate)
EST_FACTOR = float(os.environ.get("GATE_EST_FACTOR", "1.25"))     # limit >= estimate high x 1.25
FALLBACK = {"select": 7200, "full": 12000}
_EST_RE = re.compile(r"ESTIMATE gate2:\s*~(\d+)-(\d+)\s*min wall(?:.*?full tier on the same tree:\s*~(\d+)-(\d+)\s*min)?")
_FULL_RE = {"backend": re.compile(r"^\s*full backend\s*:\s*YES", re.M), "frontend": re.compile(r"^\s*full frontend\s*:\s*YES", re.M)}
LOAD_FREE = float(os.environ.get("GATE_LOAD_FREE", "0.25"))             # GATE-SPEED-2550: load per core that counts as idle noise
LOAD_FACTOR_MAX = float(os.environ.get("GATE_LOAD_FACTOR_MAX", "1.6"))  # the load factor never exceeds this


def load_factor(load1=None, nproc=None) -> float:
    """GATE-SPEED-2550: how much slower the run will probably be because of other work on the runner at its start:
    1 + max(0, load1 - GATE_LOAD_FREE x nproc) / nproc, clamped to [1, GATE_LOAD_FACTOR_MAX]. 1.0 when either value is missing or
    not a number (no /proc: the old rule). Nice'd jobs count fully: a limit that is too high costs nothing unless a run hangs,
    one that is too low kills a valid gate (the 2.53 run 2)."""
    try:
        l, n = float(load1), int(nproc)
    except (TypeError, ValueError):
        return 1.0
    if n <= 0 or l != l or l < 0:
        return 1.0
    return round(min(max(1.0, LOAD_FACTOR_MAX), 1.0 + max(0.0, l - LOAD_FREE * n) / n), 2)


def parse_plan(text: str | None) -> dict:
    """The facts of a `gate2_select.py plan` output the limit needs: {est_low_min, est_high_min, full_low_min, full_high_min,
    full_backend, full_frontend}. Missing values are None / False (an empty or foreign text gives an all-empty dict)."""
    text = text or ""
    out = {"est_low_min": None, "est_high_min": None, "full_low_min": None, "full_high_min": None,
           "full_backend": bool(_FULL_RE["backend"].search(text)), "full_frontend": bool(_FULL_RE["frontend"].search(text))}
    m = None
    for m in _EST_RE.finditer(text):      # the last ESTIMATE line wins (a wrapper may print the plan twice)
        pass
    if m:
        out["est_low_min"], out["est_high_min"] = int(m.group(1)), int(m.group(2))
        if m.group(3):
            out["full_low_min"], out["full_high_min"] = int(m.group(3)), int(m.group(4))
    return out


def effective_limit(results: Path | None, mode: str, plan: dict | None = None, explicit=None, fallback: int | None = None,
                    seed: Path | None = None, load1=None, nproc=None) -> dict:
    """{"limit_s", "rule", "derived_s", "derived_mode", "estimate_high_s", "why"}: the time limit of one gate / entry check run.

    explicit (GATE_TOTAL_SECS / ENTRY_TOTAL_SECS) > 0 wins. Else derived = the cap of the derived budgets of `derived_mode` ("full" when
    mode is full or the plan runs a side FULL), falling back to `fallback` (default 7200 select / 12000 full) without seed or history.
    The estimate high (minutes, x 60) comes from the plan; a FULL frontend takes max(estimate high, full-tier high). The limit is
    max(derived, ceil(estimate_high x EST_FACTOR x load factor)) and never below the estimate high (GATE-SPEED-2550: load factor,
    load_factor(load1, nproc); "load_factor" in the result)."""
    plan = plan or {}
    try:
        ex = int(str(explicit).strip()) if explicit not in (None, "") else 0
    except ValueError:
        ex = 0
    if ex > 0:
        return {"limit_s": ex, "rule": "explicit", "derived_s": None, "derived_mode": None, "estimate_high_s": None, "load_factor": None,
                "why": f"explicit limit {ex} s (GATE_TOTAL_SECS / ENTRY_TOTAL_SECS) wins"}
    full_side = bool(plan.get("full_backend") or plan.get("full_frontend"))
    dmode = "full" if (mode == "full" or full_side) else "select"
    derived = total_cap(derive_budgets(Path(results), dmode, seed)) if results else 0
    dsrc = f"derived {dmode} cap"
    if not derived:
        derived = int(fallback if fallback else FALLBACK[dmode])
        dsrc = f"fixed {dmode} default"
    est_min = plan.get("est_high_min")
    if mode == "full" and plan.get("full_high_min"):
        est_min = max(est_min or 0, plan["full_high_min"])
    if plan.get("full_frontend") and plan.get("full_high_min"):
        est_min = max(est_min or 0, plan["full_high_min"])
    est_s = int(est_min * 60) if est_min else 0
    lf = load_factor(load1, nproc)
    by_est = int(math.ceil(est_s * EST_FACTOR * lf)) if est_s else 0
    limit = max(derived, by_est, est_s)
    rule = "estimate" if by_est > derived else "derived"
    lf_txt = f" x load factor {lf} (load1 {float(load1):.1f} on {int(nproc)} cores)" if lf > 1.0 else ""
    why = (f"limit {limit} s ({limit // 60} min) = max({dsrc} {derived} s, estimate high {est_s // 60} min x {EST_FACTOR}{lf_txt} = {by_est} s)"
           if est_s else f"limit {limit} s ({limit // 60} min) = {dsrc} (no plan estimate)")
    if full_side:
        why += " [selection FULL on " + "+".join(s for s in ("backend", "frontend") if plan.get(f"full_{s}")) + ": full-tier budgets]"
    return {"limit_s": int(limit), "rule": rule, "derived_s": int(derived), "derived_mode": dmode, "estimate_high_s": est_s,
            "load_factor": lf, "why": why}


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
    ap.add_argument("cmd", choices=["cap", "show", "limit"])
    ap.add_argument("--results", default=os.environ.get("GATE_RESULTS_DIR") or str(Path.home() / "smplwise-results"))
    ap.add_argument("--mode", choices=["full", "select"], default="full")
    ap.add_argument("--seed")
    ap.add_argument("--plan", help="limit: the gate2_select.py plan output (a file, or - for stdin)")
    ap.add_argument("--explicit", default="", help="limit: an explicit limit in seconds (wins when > 0)")
    ap.add_argument("--fallback", type=int, default=0, help="limit: seconds when there is neither seed nor history")
    ap.add_argument("--explain", action="store_true", help="limit: one 'why' line on stderr")
    ap.add_argument("--load1", default=None, help="limit: the 1-minute load average at the start (GATE-SPEED-2550)")
    ap.add_argument("--nproc", default=None, help="limit: the CPU count (with --load1)")
    ns = ap.parse_args(argv)
    if ns.cmd == "limit":
        text = ""
        if ns.plan == "-":
            text = sys.stdin.read()
        elif ns.plan:
            try:
                text = Path(ns.plan).read_text(encoding="utf-8", errors="replace")
            except OSError:
                text = ""
        r = effective_limit(Path(ns.results), ns.mode, parse_plan(text), ns.explicit, ns.fallback or None,
                            Path(ns.seed) if ns.seed else None, ns.load1, ns.nproc)
        print(r["limit_s"])
        if ns.explain:
            print("time limit: " + r["why"], file=sys.stderr)
        return 0
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
