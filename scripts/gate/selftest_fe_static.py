#!/usr/bin/env python3
"""Self-test of the frontend static checks of the gate engine (CR-FE-GATES-ENFORCE-2442): the verdict rules, the skip rules and
the count / item records of release_gate.py's fe_static_* functions. No runner, no network, no real frontend.
  python3 scripts/gate/selftest_fe_static.py      (exit 0 = every case OK)
The verdict cases are pure functions and run everywhere. The process cases (a fake frontend with one-line scripts) need a POSIX
machine (the engine kills process groups) and `node`; elsewhere they print SKIP.
"""
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
for k in [k for k in os.environ if k.startswith("GATE_")]:   # hermetic: no knob of the machine reaches the engine
    os.environ.pop(k)
sys.path.insert(0, str(HERE))
import release_gate as g  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    print(("OK      " if cond else "BROKEN  ") + name + ("" if cond else f"   <- {detail}"))
    if not cond:
        FAILS.append(name)


def reset(mode="auto"):
    g.COUNTS.clear()
    g.ITEMS.clear()
    g.FE_STATIC = mode
    g.LANE = False


TMP = Path(tempfile.mkdtemp(prefix="fe_static_selftest_"))
try:
    # ---- the verdict of one check
    s = g.fe_static_settle
    check("settle: exit 0 is a PASS", s(0, False, "ok") == {"result": "PASS", "status": "pass", "reason": ""})
    out = s(1, False, "a\nFAIL: entry gzip 900 B is 17 B over the budget 883 B\n-> FAIL")
    check("settle: a non-zero exit is a FAIL with the log tail", out["result"] == "FAIL" and out["status"] == "fail" and "over the budget" in out["reason"] and "rc=1" in out["reason"], out)
    check("settle: ESLint's exit 2 (a crash, a broken config) is a FAIL, never a pass", s(2, False, "Oops")["result"] == "FAIL")
    out = s(124, True, "")
    check("settle: over its budget is NOT_RUN (skipped), never a pass", out["result"] == "NOT_RUN" and out["status"] == "skipped", out)
    check("settle: rc 124 / 137 without the flag is NOT_RUN too", s(124, False, "")["result"] == "NOT_RUN" and s(137, False, "")["result"] == "NOT_RUN")
    out = s(124, True, "", "require")
    check("settle: GATE_FE_STATIC=require turns NOT_RUN into a FAIL", out["result"] == "FAIL" and "require" in out["reason"], out)
    out = s(0, False, "", "auto", not_run="eslint is not installed")
    check("settle: a check that could not start is NOT_RUN with its reason", out["result"] == "NOT_RUN" and out["reason"] == "eslint is not installed", out)
    check("settle: ... and a FAIL under require", s(0, False, "", "require", not_run="x")["result"] == "FAIL")

    # ---- the records: counts, items, the verdict of the gate
    reset()
    ex = {}
    g.fe_static_record("bundle-budget", "budget", s(0, False, ""), ex, 3)
    check("record: a PASS counts one pass, no item, the gate stays green",
          g.COUNTS[g.FE_STATIC_CAT]["pass"] == 1 and not g.ITEMS and g.compute_verdict([]) == "pass" and ex["fe_static"]["bundle-budget"]["seconds"] == 3, (g.COUNTS, g.ITEMS))
    g.fe_static_record("unused-exports", "unused", s(1, False, "NEW unreferenced const x"), ex)
    check("record: a FAIL is a FAIL item of category fe_static and the gate is red",
          g.compute_verdict([]) == "fail" and [(i["category"], i["status"]) for i in g.ITEMS] == [("fe_static", "FAIL")] and "NEW unreferenced" in g.ITEMS[0]["reason"], g.ITEMS)
    reset()
    g.fe_static_record("eslint", "eslint", s(124, True, ""), {})
    check("record: NOT_RUN is a skipped item, the gate is not red and nothing counts as passed",
          g.compute_verdict([]) == "pass" and g.COUNTS[g.FE_STATIC_CAT] == {"pass": 0, "fail": 0, "flaky": 0, "known": 0, "skipped": 1}
          and [i["status"] for i in g.ITEMS] == ["SKIPPED_NOT_RUN"], (g.COUNTS, g.ITEMS))
    w = g.check_baselines({"tiers": {"L": {}}}, "L")
    check("baseline: fe_static is an optional category (no 'no baseline entry' warning)", not any("fe_static" in x for x in w), w)
    import gate_summary as gs
    check("summary: a fe_static failure is a real (deterministic) failure", gs.classify_item({"category": "fe_static", "status": "FAIL", "reason": "rc=1"}, 50.0)[0] == "real")

    # ---- which worktrees get the checks
    old = TMP / "old_branch"
    (old / "frontend" / "scripts").mkdir(parents=True)
    new = TMP / "new_branch"
    (new / "frontend" / "scripts").mkdir(parents=True)
    (new / g.FE_STATIC_MARK).write_text("{}", encoding="utf-8")
    reset()
    check("skip: a branch without the baseline file runs nothing", "has no" in g.fe_static_skip(old) and g.fe_lint_start(old, old / "frontend", TMP) is None)
    ex = {}
    g.fe_static_sync(old, old / "frontend", TMP, ex)
    check("skip: ... and records the reason, no count, no item", "has no" in ex["fe_static"]["not_run"] and not g.COUNTS and not g.ITEMS, (ex, g.COUNTS))
    check("skip: a branch with the baseline file runs them", g.fe_static_skip(new) == "")
    reset("off")
    check("skip: GATE_FE_STATIC=off runs nothing", g.fe_static_skip(new) == "GATE_FE_STATIC=off" and g.fe_lint_start(new, new / "frontend", TMP) is None)
    reset("junk")
    check("mode: junk is auto", g.fe_static_mode() == "auto")
    reset()
    g.LANE = True
    check("skip: the timing lane runs nothing", "timing lane" in g.fe_static_skip(new))
    reset()
    h = g.fe_lint_start(new, new / "frontend", TMP)
    check("eslint: not installed in node_modules -> a handle that settles as NOT_RUN (nothing is downloaded)", h is not None and "done" in h and "node_modules" in h["done"], h)
    out = g.fe_lint_finish(h, {})
    check("eslint: ... NOT_RUN in auto", out["result"] == "NOT_RUN" and g.compute_verdict([]) == "pass", out)
    reset("require")
    out = g.fe_lint_finish(h, {})
    check("eslint: ... a FAIL under require", out["result"] == "FAIL" and g.compute_verdict([]) == "fail", out)

    # ---- the process cases: a fake frontend whose two scripts exit as told
    if not (hasattr(os, "killpg") and shutil.which("node")):
        print("SKIP    process cases: need a POSIX machine and node")
    else:
        fe = new / "frontend"
        logd = TMP / "logs"
        logd.mkdir()
        g.DEADLINE = time.time() + 600

        def sync_case(budget_rc, unused_rc, built=True):
            reset()
            (fe / "scripts" / "bundle-budget.mjs").write_text(f"console.log('budget says {budget_rc}'); process.exit({budget_rc});\n", encoding="utf-8")
            (fe / "scripts" / "unused-exports.mjs").write_text(f"console.log('unused says {unused_rc}'); process.exit({unused_rc});\n", encoding="utf-8")
            ex = {}
            g.fe_static_sync(new, fe, logd, ex, built=built)
            return ex.get("fe_static", {}), g.compute_verdict([]), [i["id"] for i in g.ITEMS if i["status"] == "FAIL"]

        fs_, v, bad = sync_case(0, 0)
        check("sync: both scripts exit 0 -> two passes, green", v == "pass" and fs_["bundle-budget"]["result"] == "PASS" and fs_["unused-exports"]["result"] == "PASS" and not bad, fs_)
        fs_, v, bad = sync_case(1, 0)
        check("sync: an entry over the budget fails the gate", v == "fail" and len(bad) == 1 and "budget" in bad[0] and "budget says 1" in fs_["bundle-budget"]["reason"], fs_)
        fs_, v, bad = sync_case(0, 1)
        check("sync: a new unused export fails the gate", v == "fail" and len(bad) == 1 and "unused" in bad[0], fs_)
        fs_, v, bad = sync_case(1, 0, built=False)
        check("sync: without a build the budget is not run (the build already failed); unused exports still run", "bundle-budget" not in fs_ and fs_["unused-exports"]["result"] == "PASS", fs_)
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print()
print("SELFTEST " + ("OK" if not FAILS else f"BROKEN ({len(FAILS)}): " + "; ".join(FAILS)))
sys.exit(1 if FAILS else 0)
