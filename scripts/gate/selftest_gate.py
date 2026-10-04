#!/usr/bin/env python3
"""Self-test of the release gate's false-green guards, with a tiny FAKE suite (a fake `npx playwright` and a fake pytest).

Runs on the runner (or any POSIX box with python3; the gate uses process groups). It never touches the real results directory,
the real worktrees or a real browser:  python3 scripts/gate/selftest_gate.py
Exit code 0 = every case behaved; 1 = a guard is broken. Each case prints OK / BROKEN.
"""
import json, os, stat, sys, tempfile, textwrap
from pathlib import Path

import atexit, shutil  # noqa: E402

TMP = Path(tempfile.mkdtemp(prefix="gate_selftest_"))
atexit.register(shutil.rmtree, TMP, True)
os.environ["GATE_HOME"] = str(TMP / "home")
os.environ["GATE_RESULTS_DIR"] = str(TMP / "results")
(TMP / "home").mkdir()
(TMP / "results").mkdir()
BIN = TMP / "bin"
BIN.mkdir()

# --- fake `npx`: "npx playwright test ..." writes the report the mode asks for to PLAYWRIGHT_JSON_OUTPUT_NAME
FAKE_NPX = r'''#!/usr/bin/env python3
import json, os, sys
mode = os.environ.get("FAKE_PW_MODE", "ok")
out = os.environ.get("PLAYWRIGHT_JSON_OUTPUT_NAME")
def spec(i, status="expected"):
    return {"title": f"t{i}", "file": "tests/a.spec.ts", "line": i, "tests": [{"projectName": "desktop", "status": status,
            "annotations": [], "results": [{"status": "passed" if status == "expected" else "failed", "error": {"message": "boom"} if status == "unexpected" else None}]}]}
def report(specs, errors=()):
    return {"config": {}, "suites": [{"title": "a.spec.ts", "specs": specs}] if specs else [], "errors": list(errors), "stats": {}}
def write(d):
    if out:
        open(out, "w").write(json.dumps(d))
if mode == "ok":
    write(report([spec(i) for i in range(1, 6)])); print("5 passed"); sys.exit(0)
if mode == "load_crash":      # the 0.1.157 incident: empty suites + errors[], exit 1
    write(report([], [{"message": "Error: Unsupported decorator location: field\n   at ../src/components/sw-icon.ts:3"}]))
    print("Error: Unsupported decorator location: field", file=sys.stderr); sys.exit(1)
if mode == "load_crash_partial":   # errors[] but some other specs did run and pass
    write(report([spec(1), spec(2)], [{"message": "Error: Unsupported decorator location: field"}])); sys.exit(1)
if mode == "zero_rc0":        # nothing selected, clean exit
    write(report([])); sys.exit(0)
if mode == "zero_rc1":        # "No tests found"
    write(report([])); print("Error: No tests found", file=sys.stderr); sys.exit(1)
if mode == "no_report":       # process died before writing anything
    print("Segmentation fault", file=sys.stderr); sys.exit(139)
if mode == "rc1_no_failure":  # exit 1 although every reported test passed
    write(report([spec(1), spec(2)])); sys.exit(1)
if mode == "rc_weird":
    write(report([spec(1)])); sys.exit(7)
sys.exit(99)
'''
npx = BIN / "npx"
npx.write_text(FAKE_NPX)
npx.chmod(npx.stat().st_mode | stat.S_IEXEC)
os.environ["PATH"] = f"{BIN}{os.pathsep}{os.environ['PATH']}"

# --- fake pytest shard: prints what the mode asks for and exits with the matching code
FAKE_PYTEST = r'''
import sys
m = sys.argv[1]
if m == "ok":
    print("...\n5 passed in 0.10s"); sys.exit(0)
if m == "zero":
    print("no tests ran in 0.01s"); sys.exit(5)
if m == "crash":
    print("Traceback (most recent call last):\nImportError: boom"); sys.exit(1)
if m == "interrupted":
    print("Interrupted: 1 error during collection\n1 error in 0.20s"); sys.exit(2)
if m == "rc1_nofail":
    print("5 passed in 0.10s"); sys.exit(1)
sys.exit(99)
'''
(TMP / "fake_pytest.py").write_text(FAKE_PYTEST)

sys.path.insert(0, str(Path(__file__).resolve().parent))
import release_gate as g  # noqa: E402

FAILS = []


def reset():
    g.COUNTS.clear()
    g.ITEMS.clear()
    g.BASELINE_ROWS.clear()
    g.ALLOW_DROP = ""


def check(name, cond, detail=""):
    print(("OK      " if cond else "BROKEN  ") + name + ("" if cond else f"   <- {detail}"))
    if not cond:
        FAILS.append(name)


def pw_case(mode):
    reset()
    logd = TMP / f"logs_{mode}"
    logd.mkdir(exist_ok=True)
    rows, rc, to = g.run_pw(TMP, ["a.spec.ts"], ["desktop"], "http://127.0.0.1:1/", logd, "lab", env={"FAKE_PW_MODE": mode}, timeout=60)
    g.settle("preview", rows, rc, to, TMP, logd, "http://127.0.0.1:1/", {"FAKE_PW_MODE": mode}, "lab")
    return g.compute_verdict([]), g.COUNTS.get("preview", {}), [i["id"] for i in g.ITEMS]


def pytest_case(mode):
    reset()
    logd = TMP / f"logs_py_{mode}"
    logd.mkdir(exist_ok=True)
    log = logd / "backend_s1.log"
    p = g.spawn([sys.executable, str(TMP / "fake_pytest.py"), mode], TMP, log)
    g.backend_finish([(1, p, log)], TMP, logd)
    return g.compute_verdict([]), [i["reason"] for i in g.ITEMS]


# ---- Playwright
v, c, ids = pw_case("ok")
check("playwright: a normal run of 5 passing tests is green", v == "pass" and c.get("pass") == 5 and not ids, (v, c, ids))
v, c, ids = pw_case("load_crash")
check("playwright: load/transpile crash (empty report + errors[], rc=1) FAILS the gate", v == "fail" and c.get("fail", 0) >= 1, (v, c, ids))
check("playwright: the crash is named as a load error", any("load error" in i for i in ids), ids)
v, c, ids = pw_case("load_crash_partial")
check("playwright: load error next to passing specs still FAILS (the 865-of-3900 shape)", v == "fail" and c.get("pass") == 2, (v, c, ids))
v, c, ids = pw_case("zero_rc0")
check("playwright: ZERO tests with a clean exit FAILS", v == "fail" and any("zero tests" in i for i in ids), (v, c, ids))
v, c, ids = pw_case("zero_rc1")
check("playwright: ZERO tests ('No tests found', rc=1) FAILS", v == "fail", (v, c, ids))
v, c, ids = pw_case("no_report")
check("playwright: process died with no report FAILS", v == "fail", (v, c, ids))
v, c, ids = pw_case("rc1_no_failure")
check("playwright: rc=1 with no failed test reported FAILS", v == "fail" and any("exit code" in i for i in ids), (v, c, ids))
v, c, ids = pw_case("rc_weird")
check("playwright: an exit code other than 0/1 FAILS", v == "fail", (v, c, ids))

# ---- pytest shards
v, why = pytest_case("ok")
check("pytest: 5 passed, rc=0 is green", v == "pass", (v, why))
v, why = pytest_case("zero")
check("pytest: zero tests FAILS", v == "fail", (v, why))
v, why = pytest_case("crash")
check("pytest: crash with no summary FAILS", v == "fail", (v, why))
v, why = pytest_case("interrupted")
check("pytest: rc=2 (interrupted / collection error) FAILS", v == "fail", (v, why))
v, why = pytest_case("rc1_nofail")
check("pytest: rc=1 with no parsed failure FAILS", v == "fail", (v, why))

# ---- baselines (the 865-vs-3917 case)
base = {"tiers": {"L": {"preview": 3917, "backend": 3934, "tsc": 1}}}
reset()
g.COUNTS["preview"] = {"pass": 865, "fail": 0, "flaky": 0, "known": 0, "skipped": 485}
g.COUNTS["backend"] = {"pass": 3934, "fail": 0, "flaky": 0, "known": 0, "skipped": 3}
g.COUNTS["tsc"] = {"pass": 1, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
g.check_baselines(base, "L")
check("baseline: preview 865 vs 3917 (22 percent) is RED", g.compute_verdict([]) == "fail" and g.BASELINE_ROWS["preview"]["state"] == "low", g.BASELINE_ROWS)
check("baseline: the healthy categories stay ok", g.BASELINE_ROWS["backend"]["state"] == "ok" and g.BASELINE_ROWS["tsc"]["state"] == "ok")
reset()
g.COUNTS["preview"] = {"pass": 865, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
g.ALLOW_DROP = "selftest: intended drop"
g.check_baselines(base, "L")
check("baseline: --allow-count-drop waives it, with the reason on record", g.compute_verdict([]) == "pass" and g.BASELINE_ROWS["preview"]["state"] == "waived"
      and any(i["status"] == "WAIVED" and "intended drop" in i["reason"] for i in g.ITEMS), g.ITEMS)
reset()
g.COUNTS["preview"] = {"pass": 2800, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}   # 71 percent: inside the threshold
g.check_baselines({"tiers": {"L": {"preview": 3917}}}, "L")
check("baseline: 71 percent of the baseline is still green", g.compute_verdict([]) == "pass", g.BASELINE_ROWS)
reset()
g.COUNTS["preview"] = {"pass": 2600, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}   # 66 percent
g.check_baselines({"tiers": {"L": {"preview": 3917}}}, "L")
check("baseline: 66 percent of the baseline is RED", g.compute_verdict([]) == "fail", g.BASELINE_ROWS)
reset()
g.check_baselines({"tiers": {"L": {"dev": 218}}}, "L")
check("baseline: a category that vanished entirely (0 of 218) is RED", g.compute_verdict([]) == "fail")
reset()
w = g.check_baselines(base, "M")
check("baseline: a tier without a baseline warns instead of failing", g.compute_verdict([]) == "pass" and w, w)
shipped = json.loads((Path(__file__).resolve().parent / "gate_baselines.json").read_text())
check("baseline: the shipped gate_baselines.json parses and has tier L", bool(shipped.get("tiers", {}).get("L", {}).get("preview")))

# ---- the report lists every category with counts
reset()
g.COUNTS["preview"] = {"pass": 5, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
g.BR, g.TAG = "selftest", "selftest"
g.check_baselines({"tiers": {"L": {"preview": 5, "dev": 3}}}, "L")
fin, bp = g.write_reports("abc1234", g.compute_verdict([]), {"baseline_warnings": []})
md = Path(str(bp) + ".md").read_text()
check("report: the md lists each category (also the vanished one) with counts and baseline", "| preview | 5 |" in md and "| dev | 0 |" in md and "100%" in md, md[:600])

# ---- workers=1 chunks are balanced by the earlier gates' times (0.1.162: round-robin gave 46 / 16 / 27 minutes)
g._COSTS = {"heavy1.spec.ts": 1200.0, "heavy2.spec.ts": 1100.0, "mid.spec.ts": 600.0, "a.spec.ts": 60.0, "b.spec.ts": 50.0, "c.spec.ts": 40.0}
names = ["a.spec.ts", "b.spec.ts", "c.spec.ts", "heavy1.spec.ts", "heavy2.spec.ts", "mid.spec.ts", "new.spec.ts"]
parts = g.balance(names, 3)
loads = [sum(g._COSTS.get(x, 60.0) for x in p) for p in parts]
check("balance: every file lands in exactly one chunk", sorted(x for p in parts for x in p) == sorted(names), parts)
check("balance: the two heaviest files never share a chunk", not any("heavy1.spec.ts" in p and "heavy2.spec.ts" in p for p in parts), parts)
check("balance: the longest chunk is the heaviest single file plus at most the light ones", max(loads) <= 1200 + 60 + 60, loads)
g._COSTS = None

print()
print("SELFTEST " + ("PASSED" if not FAILS else f"FAILED: {len(FAILS)} case(s): " + "; ".join(FAILS)))
sys.exit(0 if not FAILS else 1)
