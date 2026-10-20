#!/usr/bin/env python3
"""Shadow-run comparison (GATESPEED-293): a normal (v1) gate report against a v2 / selection gate report of the SAME sha.

  python3 shadow_compare.py ~/smplwise-results/gate_<b>_<sha>.json <the shadow run's gate_*.json>

Per category: passed (pass + flaky), failed, flaky, known, skipped of both runs. A category is OK when the shadow's passed count
is within the flaky + known slack of both runs of the reference (a test that flaked in one run may pass first time in the other),
and it has no FAIL that the reference does not have. Exit 0 = every category OK, 1 = a difference to look at, 2 = bad input.
A selection run compares only what it ran: its reduced categories are reported, not judged (the nightly audits them).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def passed(c: dict) -> int:
    return c.get("pass", 0) + c.get("flaky", 0)


def compare(ref: dict, shadow: dict) -> tuple[bool, list[str]]:
    reduced = set(((shadow.get("selection") or {}).get("reduced") or {}).keys())
    ok, lines = True, [f"reference: {ref.get('branch')} @ {ref.get('sha')} ({ref.get('schedule', 'v1')}, {ref.get('wall_seconds', 0) // 60} min)",
                       f"shadow:    {shadow.get('branch')} @ {shadow.get('sha')} ({shadow.get('schedule', 'v1')}, {shadow.get('wall_seconds', 0) // 60} min)"]
    if ref.get("sha") != shadow.get("sha"):
        lines.append(f"WARNING: different shas ({ref.get('sha')} vs {shadow.get('sha')}): counts may differ for real")
    rc, sc = ref.get("counts", {}), shadow.get("counts", {})
    ref_fail = {i["id"] for i in ref.get("items", []) if i.get("status") == "FAIL"}
    new_fail = [i for i in shadow.get("items", []) if i.get("status") == "FAIL" and i["id"] not in ref_fail]
    lines.append("| category | ref passed | shadow passed | diff | slack | ref fail | shadow fail | state |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for cat in sorted(set(rc) | set(sc)):
        if cat == "baseline":
            continue
        a, b = rc.get(cat, {}), sc.get(cat, {})
        slack = a.get("flaky", 0) + b.get("flaky", 0) + a.get("known", 0) + b.get("known", 0)
        diff = passed(b) - passed(a)
        cat_new = [i for i in new_fail if i.get("category") == cat]
        if cat in reduced:
            state = "selection (not judged)"
        elif abs(diff) <= slack and not cat_new and b.get("fail", 0) <= a.get("fail", 0):
            state = "OK"
        else:
            state, ok = "DIFFERENT", False
        lines.append(f"| {cat} | {passed(a)} | {passed(b)} | {diff:+d} | {slack} | {a.get('fail', 0)} | {b.get('fail', 0)} | {state} |")
    if new_fail:
        lines.append("")
        lines.append(f"FAIL only in the shadow run ({len(new_fail)}):")
        lines += [f"- [{i['category']}] {i['id'][:180]} - {i.get('reason', '')[:120]}" for i in new_fail[:40]]
    lines.append("")
    lines.append("VERDICT: " + ("SAME (every category within the flaky slack)" if ok else "DIFFERENT (look at the rows above)"))
    return ok, lines


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    try:
        ref, shadow = (json.loads(Path(p).read_text(encoding="utf-8")) for p in argv)
    except (OSError, ValueError) as e:
        print(f"cannot read the reports: {e}")
        return 2
    ok, lines = compare(ref, shadow)
    print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
