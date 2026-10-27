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
if mode == "argv":            # GATELANES-297: record the command line, then a normal passing report
    open(os.environ["FAKE_PW_ARGV"], "w").write(json.dumps(sys.argv[1:]))
    write(report([spec(i) for i in range(1, 3)])); sys.exit(0)
if mode == "param_fail":      # a test() in a loop: two siblings share file:line, the first fails every time, the last passes
    a, b = spec(7, "unexpected"), spec(7)
    a["title"], b["title"] = "classic is pixel-stable", "bubble is pixel-stable"
    write(report([a, b])); sys.exit(1)
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

v, c, ids = pw_case("param_fail")
check("playwright: a failing parametrized sibling (same file:line) is not 'flaky' because the last sibling passed alone",
      v == "fail" and c.get("flaky", 0) == 0 and c.get("fail") == 1, (v, c, ids))

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

# ---- M074 visual step: differences are a warning section, the verdict stays green (warn mode); block mode counts them
reset()
c = g.summarize_visual([{"screen": "sites", "state": "ready", "scheme": "dark", "project": "desktop", "status": "diff"},
                        {"screen": "sites", "state": "ready", "scheme": "light", "project": "desktop", "status": "pass"},
                        {"screen": "map-floor", "state": "ready", "scheme": "light", "project": "mobile", "status": "no-baseline"}])
check("visual: summarize_visual counts pass/diff/no-baseline", (c["pass"], c["diff"], c["nobase"], len(c["diffs"])) == (1, 1, 1, 1), c)
g.COUNTS["preview"] = {"pass": 5, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
g.BR, g.TAG, g.VISUAL = "selftest", "selftest", "warn"
g.VISUAL_INFO.update(mode="warn", base="origin/main", counts={k: v for k, v in c.items() if k != "diffs"}, diffs=c["diffs"], report="x/summary.md")
fin, bp = g.write_reports("abc1234", g.compute_verdict([]), {})
md = Path(str(bp) + ".md").read_text()
check("visual: warn mode lists the difference in the report and does not fail the verdict", "sites / ready / dark / desktop" in md and "## פסק דין: **עבר**" in md, md[:500])
g.VISUAL, g.VISUAL_INFO = "", {}
check("visual: warn by default, block / off from GATE_VISUAL", (g.visual_from_env(None), g.visual_from_env("block"), g.visual_from_env("off")) == ("warn", "block", ""), "")

# ---- nightly partial runs: a skipped category is not "0 of N"; GATE_COSTS_DIR feeds the chunk balance
reset()
g.COUNTS["preview"] = {"pass": 5, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
g.SKIPPED_CATS = {"backend"}
w = g.check_baselines({"tiers": {"L": {"preview": 5, "backend": 3934}}}, "L")
check("partial run: a skipped backend is left out of the baseline check (with a warning)", g.compute_verdict([]) == "pass"
      and "backend" not in g.BASELINE_ROWS and any("backend" in x for x in w), (g.BASELINE_ROWS, w))
g.SKIPPED_CATS = set()
reset()
w = g.check_baselines({"tiers": {"L": {"backend": 3934}}}, "L")
check("partial run: without the skip flag a missing backend is still RED", g.compute_verdict([]) == "fail", g.BASELINE_ROWS)
other = TMP / "other_results"
(other / "gate_x_abc.logs").mkdir(parents=True)
(other / "gate_x_abc.logs" / "pw_preview_desktop.json").write_text(json.dumps({"suites": [{"specs": [{"file": "tests/far.spec.ts",
    "tests": [{"results": [{"duration": 7000}]}]}]}]}))
g._COSTS, g.COSTS_DIR, g.STATE["sha"] = None, str(other), "zzz"
check("costs: GATE_COSTS_DIR's gate logs feed the balance", g.prior_costs().get("far.spec.ts") == 7.0, g._COSTS)
g._COSTS, g.COSTS_DIR = None, ""

# ---- gate_durations.json: a committed seed that fills only the files no earlier gate timed (lowest priority)
seeds = TMP / "seed_here"
seeds.mkdir()
(seeds / "gate_durations.json").write_text(json.dumps({"seconds": {"far.spec.ts": 99.0, "seed-only.spec.ts": 12.5, "bad.spec.ts": "x", "zero.spec.ts": 0}}))
g._COSTS, g.COSTS_DIR, g.STATE["sha"], here0 = None, str(other), "zzz", g.HERE
g.HERE = seeds
c = g.prior_costs()
check("costs: the seed fills a file no gate timed, a gate's own time wins, junk entries are ignored",
      c.get("seed-only.spec.ts") == 12.5 and c.get("far.spec.ts") == 7.0 and "bad.spec.ts" not in c and "zero.spec.ts" not in c, c)
g._COSTS, g.HERE = None, TMP / "no_seed_here"
check("costs: a missing seed file changes nothing", "seed-only.spec.ts" not in g.prior_costs() and g._COSTS.get("far.spec.ts") == 7.0, g._COSTS)
g._COSTS, g.COSTS_DIR, g.HERE = None, "", here0
real = json.loads((here0 / "gate_durations.json").read_text(encoding="utf-8")) if (here0 / "gate_durations.json").exists() else {}
check("the committed gate_durations.json loads, all values are positive numbers", bool(real.get("seconds")) and all(isinstance(v, (int, float)) and v > 0 for v in real["seconds"].values()), len(real.get("seconds", {})))
rb = json.loads((here0 / "gate_baselines.json").read_text(encoding="utf-8"))
check("the committed gate_baselines.json loads and has the eight tier-L categories",
      set(rb["tiers"]["L"]) == {"tsc", "build", "preview", "pixel", "dev", "fixture", "backend", "release_check"}, rb["tiers"])
g._COSTS = None

# ---- GATESPEED-293 v2 schedule: v1 stays the default; the pool keeps every false-green guard (settled after the pool)
check("schedule: v1 is the default (GATE_SCHEDULE unset)", os.environ.get("GATE_SCHEDULE") or g.SCHEDULE == "v1", g.SCHEDULE)
reset()
pl = TMP / "logs_pool"
pl.mkdir()
pjobs = [{"label": "pool_ok", "mode": "ok", "workers": 2, "est": 5.0}, {"label": "pool_crash", "mode": "load_crash", "workers": 2, "est": 4.0},
         {"label": "pool_zero", "mode": "zero_rc0", "workers": 1, "est": 1.0}]
pres = g.run_pool(pjobs, 3, lambda j: g.run_pw(TMP, ["a.spec.ts"], ["desktop"], "http://127.0.0.1:1/", pl, j["label"],
                                                env={"FAKE_PW_MODE": j["mode"]}, timeout=60), min_free_mb=0)
for j in g._order(pjobs):
    rows, rc, to = pres[j["label"]][0]
    g.settle("preview", rows, rc, to, TMP, pl, "http://127.0.0.1:1/", {"FAKE_PW_MODE": j["mode"]}, j["label"])
ids = [i["id"] for i in g.ITEMS]
check("v2 pool: a load crash and a zero-test job in the pool still FAIL; the healthy job's 5 passes count",
      g.compute_verdict([]) == "fail" and g.COUNTS["preview"]["pass"] == 5 and any("load error" in i for i in ids) and any("zero tests" in i for i in ids), (g.COUNTS, ids))
shm = TMP / "shm"
(shm / "smplwise-gate-stale-1").mkdir(parents=True)
os.environ["GATE_TMPFS_DIR"], os.environ["GATE_TMPFS_MIN_GB"] = str(shm), "0"
d = g.tmpfs_root("selftest")
check("v2 tmpfs: a fresh scratch dir, the stale one swept", d is not None and d.is_dir() and not (shm / "smplwise-gate-stale-1").exists(), d)
os.environ["GATE_TMPFS_MIN_GB"] = "1000000"
check("v2 tmpfs: under the free-space floor it falls back to disk (None)", g.tmpfs_root("selftest") is None)
for k in ("GATE_TMPFS_DIR", "GATE_TMPFS_MIN_GB"):
    os.environ.pop(k, None)

# ---- GATELANES-297: the timing lane is left out of every gate run and is all the lane runs; tests/archive/ is never classified
def pw_argv(**kw):
    logd = TMP / "logs_lane"
    logd.mkdir(exist_ok=True)
    af = TMP / "argv.json"
    g.run_pw(TMP, ["a.spec.ts"], ["desktop"], "http://127.0.0.1:1/", logd, "lane", env={"FAKE_PW_MODE": "argv", "FAKE_PW_ARGV": str(af)}, timeout=60, **kw)
    return json.loads(af.read_text())


lane0 = g.LANE
g.LANE = False
a = pw_argv(grep_invert="pixel-stable")
check("lane: a gate's preview run inverts pixel-stable AND @timing-lane", a[a.index("--grep-invert") + 1] == "pixel-stable|@timing-lane", a)
a = pw_argv()
check("lane: a gate's dev / retry run inverts @timing-lane", a[a.index("--grep-invert") + 1] == "@timing-lane" and "-g" not in a, a)
a = pw_argv(grep="pixel-stable")
check("lane: the pixel step keeps --grep pixel-stable and leaves the lane out", a[a.index("-g") + 1] == "pixel-stable" and "--grep-invert" in a, a)
bc = g.backend_cmd(["test_x.py"], TMP, 1, TMP / "bt", False)
check("lane: a gate's pytest shard deselects the timing_lane mark", bc[bc.index("-m") + 1] == "not timing_lane", bc)
g.LANE = True
a = pw_argv(grep_invert="pixel-stable")
check("lane: the lane's Playwright run greps @timing-lane only, inverts nothing", a[a.index("-g") + 1] == "@timing-lane" and "--grep-invert" not in a, a)
bc = g.backend_cmd(["test_x.py"], TMP, 1, TMP / "bt", False)
check("lane: the lane's pytest selects only the timing_lane mark", bc[bc.index("-m") + 1] == "timing_lane", bc)
lfe = TMP / "lane_fe"
(lfe / "tests" / "archive" / "old").mkdir(parents=True)
(lfe / "tests" / "unit-a.spec.ts").write_text("test('a', async () => {});\n")
(lfe / "tests" / "unit-b.spec.ts").write_text("test('b', { tag: '@timing-lane' }, async () => {});\ntest('c', async () => {});\n")
(lfe / "tests" / "pixel-c.spec.ts").write_text("test('p is pixel-stable', async ({ page }) => { await expect(page).toHaveScreenshot('x.png'); });\n")
(lfe / "tests" / "archive" / "old" / "evidence-owner-round1.spec.ts").write_text("test('old', async () => {});\n")
(lfe / "tests" / "archive" / "evidence-x.spec.ts").write_text("test('old', async () => {});\n")
names = lambda c: set(c["rest"]) | set(c["dev"]) | set(c["fixture"]) | set(c["pixel"])  # noqa: E731
g.LANE = False
c = g.classify(lfe, "L")
check("archive: a gate classifies the top-level specs only, never tests/archive/", names(c) == {"unit-a.spec.ts", "unit-b.spec.ts", "pixel-c.spec.ts"} and c["pixel"] == ["pixel-c.spec.ts"], c)
g.LANE = True
c = g.classify(lfe, "L")
check("lane: the lane classifies only the files with a tagged test, no pixel step", names(c) == {"unit-b.spec.ts"} and c["pixel"] == [], c)
lbd = TMP / "lane_be"
(lbd / "tests").mkdir(parents=True)
(lbd / "tests" / "test_a.py").write_text("import pytest\n\n@pytest.mark.timing_lane\ndef test_t():\n    pass\n")
(lbd / "tests" / "test_b.py").write_text("def test_u():\n    pass  # timing_lane in a comment is not a mark\n")
check("lane: the lane's backend files are the ones with @pytest.mark.timing_lane", g.lane_backend_files(lbd) == {"test_a.py"}, g.lane_backend_files(lbd))
g.LANE = lane0
real_be = Path(__file__).resolve().parents[2] / "smplwise_vms" / "backend"
if real_be.is_dir():
    check("lane: the shipped backend has timing_lane tests (the door slot recovery, LAT1)", {"test_f3a_doorwin_dw03_295.py", "test_lat1_toggle_latency.py"} <= g.lane_backend_files(real_be), g.lane_backend_files(real_be))

print()
print("SELFTEST " +("PASSED" if not FAILS else f"FAILED: {len(FAILS)} case(s): " + "; ".join(FAILS)))
sys.exit(0 if not FAILS else 1)
