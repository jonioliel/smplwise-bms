#!/usr/bin/env python3
"""Shadow-run comparison (GATESPEED-293): a normal (v1) gate report against a v2 / selection gate report of the SAME sha.

  python3 shadow_compare.py ~/smplwise-results/gate_<b>_<sha>.json <the shadow run's gate_*.json> [--record gate_schedule_evidence.json]

--record (GATEEFF-295): when the verdict is SAME, the reference is a PASS on the v1 schedule, the shadow is a PASS on the v2 schedule,
both ran the same sha and the shadow ran the full tier (no selection), the comparison is written as the evidence file that makes v2 the
default (release_gate.py reads gate_schedule_evidence.json next to itself). Anything else: exit 2 and nothing is written.
GATE_SCHEDULE=v1 / --schedule v1 still select the old schedule at any time.

Per category: passed (pass + flaky), failed, flaky, known, skipped of both runs. A category is OK when the shadow's passed count
is within the flaky + known slack of both runs of the reference (a test that flaked in one run may pass first time in the other),
and it has no FAIL that the reference does not have. Exit 0 = every category OK, 1 = a difference to look at, 2 = bad input.
A selection run compares only what it ran: its reduced categories are reported, not judged (the nightly audits them).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


LANES = ("fail", "quarantined", "pixel_review", "preexisting")
RED = ("FAIL", "QUARANTINED", "PIXEL_REVIEW", "PREEXISTING")


def passed(c: dict) -> int:
    return c.get("pass", 0) + c.get("flaky", 0) + c.get("pixel_review", 0)


def reds(c: dict) -> int:
    return sum(c.get(k, 0) for k in LANES)


def compare(ref: dict, shadow: dict) -> tuple[bool, list[str]]:
    reduced = set(((shadow.get("selection") or {}).get("reduced") or {}).keys())
    ok, lines = True, [f"reference: {ref.get('branch')} @ {ref.get('sha')} ({ref.get('schedule', 'v1')}, {ref.get('wall_seconds', 0) // 60} min)",
                       f"shadow:    {shadow.get('branch')} @ {shadow.get('sha')} ({shadow.get('schedule', 'v1')}, {shadow.get('wall_seconds', 0) // 60} min)"]
    if ref.get("sha") != shadow.get("sha"):
        lines.append(f"WARNING: different shas ({ref.get('sha')} vs {shadow.get('sha')}): counts may differ for real")
    rc, sc = ref.get("counts", {}), shadow.get("counts", {})
    ref_fail = {i["id"] for i in ref.get("items", []) if i.get("status") in RED}
    new_fail = [i for i in shadow.get("items", []) if i.get("status") in RED and i["id"] not in ref_fail]
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
        elif abs(diff) <= slack and not cat_new and reds(b) <= reds(a):
            state = "OK"
        else:
            state, ok = "DIFFERENT", False
        lines.append(f"| {cat} | {passed(a)} | {passed(b)} | {diff:+d} | {slack} | {reds(a)} | {reds(b)} | {state} |")
    if new_fail:
        lines.append("")
        lines.append(f"FAIL only in the shadow run ({len(new_fail)}):")
        lines += [f"- [{i['category']}] {i['id'][:180]} - {i.get('reason', '')[:120]}" for i in new_fail[:40]]
    lines.append("")
    lines.append("VERDICT: " + ("SAME (every category within the flaky slack)" if ok else "DIFFERENT (look at the rows above)"))
    return ok, lines


def evidence(ref: dict, shadow: dict, lines: list[str], today: str) -> tuple[dict | None, str]:
    """The evidence document for gate_schedule_evidence.json, or (None, why not)."""
    if ref.get("schedule", "v1") != "v1" or shadow.get("schedule") != "v2":
        return None, f"the reference must be a v1 gate and the shadow a v2 gate (got {ref.get('schedule', 'v1')} / {shadow.get('schedule')})"
    if ref.get("verdict") != "pass":
        return None, f"the reference gate is {ref.get('verdict')}, not a pass: it cannot validate anything"
    if shadow.get("verdict") not in ("pass", "review"):
        return None, f"the shadow gate is {shadow.get('verdict')}"
    if not ref.get("sha") or ref.get("sha") != shadow.get("sha"):
        return None, f"different shas ({ref.get('sha')} vs {shadow.get('sha')}): the same sha is required"
    if (shadow.get("selection") or {}).get("reduced"):
        return None, "the shadow gate ran a diff selection: only a full-tier v2 gate validates the schedule"
    if ref.get("tier") != shadow.get("tier"):
        return None, "different tiers"
    return {"default": "v2", "verdict": "SAME", "date": today, "tier": shadow.get("tier"),
            "reference": f"{ref.get('branch')}@{ref.get('sha')} v1 {ref.get('wall_seconds', 0) // 60} min",
            "shadow": f"{shadow.get('branch')}@{shadow.get('sha')} v2 {shadow.get('wall_seconds', 0) // 60} min",
            "resources": shadow.get("resources"), "comparison": lines}, ""


def main(argv: list[str]) -> int:
    args = list(argv)
    rec = None
    if "--record" in args:
        k = args.index("--record")
        rec = args[k + 1] if k + 1 < len(args) else ""
        del args[k:k + 2]
    if len(args) != 2 or rec == "":
        print(__doc__)
        return 2
    try:
        ref, shadow = (json.loads(Path(p).read_text(encoding="utf-8")) for p in args)
    except (OSError, ValueError) as e:
        print(f"cannot read the reports: {e}")
        return 2
    ok, lines = compare(ref, shadow)
    print("\n".join(lines))
    if rec:
        if not ok:
            print("not recorded: the comparison is DIFFERENT")
            return 2
        import time
        doc, why = evidence(ref, shadow, lines, time.strftime("%Y-%m-%d"))
        if doc is None:
            print("not recorded: " + why)
            return 2
        Path(rec).write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"recorded {rec}: release_gate.py now defaults to the v2 schedule (GATE_SCHEDULE=v1 or --schedule v1 goes back)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
