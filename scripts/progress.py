"""Progress figures for the owner's reports: task cards with implementation evidence per phase and overall.

Counts a card as "done or in progress" when its status is DONE / IN_PROGRESS or when its evidence carries an
implementation line (pre-evidence, partial, fix, lab run). Prints a Markdown table (Hebrew labels) and a
weighted estimate; the numbers are evidence-based, not acceptance.

    python scripts/progress.py          # table + estimate
    python scripts/progress.py --json   # machine readable
"""
from __future__ import annotations

import json
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TASKS = ROOT / "management" / "tasks.json"
PHASES = OrderedDict([("G0", "G0 (הכנה)"), ("PILOT", "Pilot"), ("BETA", "Beta"), ("V1", "V1"), ("V2", "V2")])
MARKERS = ("pre-evidence", "partial", "fix (", "lab ", "PASS", "design SW A", "commit ")
# weights for the single-number estimate: what the owner cares about now is the pilot
WEIGHTS = {"G0": 1.0, "PILOT": 3.0, "BETA": 1.5, "V1": 1.0, "V2": 0.5}


def has_evidence(task: dict) -> bool:
    if task.get("status") in ("DONE", "IN_PROGRESS"):
        return True
    for line in task.get("evidence") or []:
        if isinstance(line, str) and any(m in line for m in MARKERS):
            return True
    return False


def is_excluded(task: dict) -> bool:
    """An owner decision took the card out of scope (T003/T004, 2026-09-22): recorded as an "EXCLUDED - owner
    decision" evidence line and an "Excluded" blocker. Such a card leaves the denominator and is shown apart -
    it is neither evidenced nor open."""
    if str(task.get("blocker") or "").startswith("Excluded"):
        return True
    return any(isinstance(line, str) and line.startswith("EXCLUDED") for line in task.get("evidence") or [])


def compute() -> dict:
    tasks = json.loads(TASKS.read_text(encoding="utf-8"))
    per = {k: {"done": 0, "total": 0, "excluded": 0} for k in PHASES}
    for t in tasks:
        ph = str(t.get("phase", "")).upper()
        if ph not in per:
            continue
        if is_excluded(t):
            per[ph]["excluded"] += 1
            continue
        per[ph]["total"] += 1
        if has_evidence(t):
            per[ph]["done"] += 1
    total_done = sum(v["done"] for v in per.values())
    total = sum(v["total"] for v in per.values())
    excluded = sum(v["excluded"] for v in per.values())
    wsum = sum(WEIGHTS[k] * v["total"] for k, v in per.items())
    wdone = sum(WEIGHTS[k] * v["done"] for k, v in per.items())
    return {
        "phases": {k: {**v, "pct": round(100 * v["done"] / v["total"]) if v["total"] else 0} for k, v in per.items()},
        "overall": {"done": total_done, "total": total, "excluded": excluded, "pct": round(100 * total_done / total) if total else 0},
        "weighted_pct": round(100 * wdone / wsum) if wsum else 0,
    }


def cell(v: dict) -> str:
    base = f"{v['done']} מתוך {v['total']}"
    return f"{base} (+{v['excluded']} הוחרגו בהחלטת הבעלים)" if v.get("excluded") else base


def main() -> None:
    r = compute()
    if "--json" in sys.argv:
        print(json.dumps(r, ensure_ascii=False, indent=1))
        return
    sys.stdout.reconfigure(encoding="utf-8")
    print("| שלב | כרטיסים עם ראיות | אחוז |")
    print("|---|---|---|")
    for k, label in PHASES.items():
        v = r["phases"][k]
        print(f"| {label} | {cell(v)} | {v['pct']}% |")
    o = r["overall"]
    print(f"| **סה\"כ** | **{cell(o)}** | **{o['pct']}%** |")
    print()
    print(f"הערכה משוקללת (פיילוט במשקל גבוה): {r['weighted_pct']}%. ראיות מימוש ≠ קבלה: הכרטיסים נשארים BACKLOG עד סגירת שערי G0 ובדיקת הבעלים.")


if __name__ == "__main__":
    main()
