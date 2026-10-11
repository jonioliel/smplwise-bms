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
if mode == "param_fail":      # a test() in a loop: two siblings share file:line, the first fails every time, the last passes
    a, b = spec(7, "unexpected"), spec(7)
    a["title"], b["title"] = "classic is pixel-stable", "bubble is pixel-stable"
    write(report([a, b])); sys.exit(1)
if mode == "argv":            # records its command line, then behaves like "ok"
    open(os.environ["FAKE_ARGV_OUT"], "a").write(json.dumps(sys.argv[1:]) + "\n")
    write(report([spec(i) for i in range(1, 6)])); sys.exit(0)
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

# ================================================================ parallel mode (opt-in): pure logic + the pool with the fake npx
import re as _re  # noqa: E402
import threading as _th  # noqa: E402
import time as _time  # noqa: E402

check("parallel: off by default (no GATE_PARALLEL), backend shards at the mode default, no subset",
      g.PARALLEL is False and g.BACKEND_SHARDS == 0 and g.subset_note() == "", (g.PARALLEL, g.BACKEND_SHARDS, g.subset_note()))

# gate_status.json written from several threads at once (heartbeat, tsc and build side by side): never a FileNotFoundError on the .tmp
errs = []


def _hammer():
    for _ in range(100):
        try:
            g.status("running", "selftest")
        except Exception as e:  # noqa: BLE001
            errs.append(repr(e))


ths = [_th.Thread(target=_hammer) for _ in range(8)]
[t.start() for t in ths]
[t.join() for t in ths]
check("status: 8 threads x 100 writes of gate_status.json raise nothing (the 2026-10-11 subset run died on the .tmp race)", not errs, errs[:2])

# run_pw: --output only when asked (the serial gate's command line is unchanged)
argv_out = TMP / "argv.txt"
logd = TMP / "logs_argv"
logd.mkdir()
g.run_pw(TMP, ["a.spec.ts"], ["desktop"], "http://127.0.0.1:1/", logd, "plain", env={"FAKE_PW_MODE": "argv", "FAKE_ARGV_OUT": str(argv_out)}, timeout=60)
g.run_pw(TMP, None, ["mobile"], "http://127.0.0.1:1/", logd, "unit", env={"FAKE_PW_MODE": "argv", "FAKE_ARGV_OUT": str(argv_out)}, workers=1,
         grep=g.title_grep(["d", "t [full]"]), line_args=["tests/a\\.spec\\.ts:7"], timeout=60, output=str(logd / "pwout" / "unit"))
lines = [json.loads(x) for x in argv_out.read_text().splitlines()]
check("run_pw: the default command line has no --output; a pool unit gets its own --output, workers=1, the line filter and its grep",
      not any(a.startswith("--output") for a in lines[0]) and "--workers=3" in lines[0]
      and any(a.startswith("--output=") for a in lines[1]) and "--workers=1" in lines[1] and "tests/a\\.spec\\.ts:7" in lines[1] and "-g" in lines[1], lines)

# list_tests: --list with the units' own --grep-invert (2026-10-11 subset run: the preview listing held the pixel-stable tests the
# preview units never run -> "No tests found" units and a coverage FAIL)
os.environ.update(FAKE_PW_MODE="argv", FAKE_ARGV_OUT=str(argv_out))
argv_out.write_text("")
lst = g.list_tests(TMP, [("preview", "a.spec.ts", "desktop")], "http://127.0.0.1:1/", logd, "lp", grep_invert="pixel-stable")
del os.environ["FAKE_PW_MODE"], os.environ["FAKE_ARGV_OUT"]
la = json.loads(argv_out.read_text().splitlines()[0])
check("list_tests: --list --reporter=json with the preview's --grep-invert pixel-stable; the listing keys by (file, project)",
      "--list" in la and la[la.index("--grep-invert") + 1] == "pixel-stable" and len(lst.get(("a.spec.ts", "desktop"), [])) == 5, (la, lst))

# lpt_bins / backend shard plan
w = {"t1": 900.0, "t2": 800.0, "t3": 300.0, "t4": 200.0, "t5": 100.0, "t6": 100.0}
bins = g.lpt_bins(w, 3)
check("lpt: every item in exactly one bin; the two heaviest never share", sorted(x for b in bins for x in b) == sorted(w)
      and not any("t1" in b and "t2" in b for b in bins), bins)
sizes = {"tests/test_a.py": 1000, "tests/test_b.py": 1000, "tests/test_new.py": 4000, "tests/test_c.py": 500}
plan = g.backend_shard_plan(sizes, {"tests/test_a.py": 100.0, "tests/test_b.py": 300.0, "tests/test_c.py": 50.0}, 2)
check("backend shards: every file once; an untimed file is weighed by its size x the median s/byte (4000 x 0.1 = 400 s: shards 400+50 / 300+100, "
      "not 'new' alone as by size)", sorted(x for s in plan for x in s) == sorted(sizes)
      and plan == [["tests/test_new.py", "tests/test_c.py"], ["tests/test_b.py", "tests/test_a.py"]], plan)

# items, splitting, packing
table = {"heavy.spec.ts": {"projects": ["desktop"]}, "multi.spec.ts": {"projects": ["desktop", "tablet", "mobile"]},
         "s1.spec.ts": {"projects": ["desktop"]}, "s2.spec.ts": {"projects": ["desktop"]}, "s3.spec.ts": {"projects": ["desktop"]},
         "serial.spec.ts": {"projects": ["desktop"]}, "new.spec.ts": {"projects": ["desktop"]}}
fp = {("heavy.spec.ts", "desktop"): 1500.0, ("multi.spec.ts", "desktop"): 400.0, ("multi.spec.ts", "tablet"): 300.0, ("multi.spec.ts", "mobile"): 350.0,
      ("s1.spec.ts", "desktop"): 100.0, ("s2.spec.ts", "desktop"): 90.0, ("s3.spec.ts", "desktop"): 80.0, ("serial.spec.ts", "desktop"): 900.0}
items = g.par_items("dev", table, fp)
check("items: one per (file, project); an unknown file weighs the median of the known ones",
      len(items) == 9 and next(i for i in items if i["file"] == "new.spec.ts")["cost"] == sorted(fp.values())[len(fp) // 2], [(i["file"], i["cost"]) for i in items])
listing = {("heavy.spec.ts", "desktop"): [(10, ["guard", "home [full]"]), (10, ["guard", "home [lite]"]), (40, ["guard", "players"])],
           ("serial.spec.ts", "desktop"): [(5, ["a"]), (9, ["b"])]}
tcost = {("heavy.spec.ts", "desktop", 10, "guard > home [full]"): 800.0, ("heavy.spec.ts", "desktop", 10, "guard > home [lite]"): 600.0}
split, splits = g.split_items(items, listing, tcost, 600.0, lambda n: n != "serial.spec.ts")
hv = [i for i in split if i["file"] == "heavy.spec.ts"]
check("split: a heavy file becomes one unit per test line, parametrised siblings one per title (with the measured seconds; an unmeasured test "
      "gets the file's mean)", len(hv) == 3 and sorted(i["cost"] for i in hv) == [500.0, 600.0, 800.0]
      and sum(1 for i in hv if i["grep"]) == 2 and any(i["line"] == 40 and i["grep"] is None for i in hv), hv)
check("split: a spec that may not be split (serial / beforeAll / afterAll / GATE_PAR_NO_SPLIT) stays whole; a file below the threshold too",
      [i["line"] for i in split if i["file"] == "serial.spec.ts"] == [None] and [i["line"] for i in split if i["file"] == "s1.spec.ts"] == [None])
check("split: the coverage set lists every test of the split file", splits == {("dev", "heavy.spec.ts", "desktop"): [(10, "guard > home [full]"), (10, "guard > home [lite]"), (40, "guard > players")]}, splits)
amb = [["x"], ["a", "x"]]
check("split: siblings whose greps would overlap stay ONE line unit", g.grep_safe(amb) is False and g.grep_safe([["g", "home [full]"], ["g", "home [lite]"]]) is True)
s2, _ = g.split_items(g.par_items("dev", {"heavy.spec.ts": {"projects": ["desktop"]}}, fp), {("heavy.spec.ts", "desktop"): [(10, ["x"]), (10, ["a", "x"])]}, {}, 600.0, lambda n: True)
check("split: ...and a file whose only line is such a pair is not split at all", len(s2) == 1 and s2[0]["line"] is None, s2)
gp = g.title_grep(["guard (a|b)", "home [full] 1.5 * x/y"])
pyre = _re.compile(gp[1:-1])
check("title grep: slash form (case-sensitive, no 'g' state), special characters escaped, matches Playwright's grep title with tags after it",
      gp.startswith("/(^| )") and gp.endswith("(?: @\\S+)*$/") and pyre.search(" desktop tests/x.spec.ts guard (a|b) home [full] 1.5 * x/y @slow")
      and pyre.search(" desktop tests/x.spec.ts guard (a|b) @area home [full] 1.5 * x/y") and pyre.search("guard (a|b) home [full] 1.5 * x/y")
      and not pyre.search(" desktop tests/x.spec.ts guard a home [full] 1.5 * x/y") and not pyre.search("xguard (a|b) home [full] 1.5 * x/y"), gp)
units = g.pack_units(split, 300.0)
cover = sorted((u["cat"], u["project"], a) for u in units for a in u["args"])
want = sorted(("dev", i["project"], g.file_arg(i["file"], i["line"])) for i in split)
check("pack: every item is in exactly one unit; a unit holds one category and one project", cover == want and all(len({u["project"]}) == 1 for u in units), (cover, want))
check("pack: an item of chunk_secs or more, and every title-grep item, is a unit of its own; packed units stay within chunk_secs",
      all(len(u["args"]) == 1 for u in units if u["grep"] or u["cost"] >= 300.0) and all(u["cost"] <= 300.0 for u in units if len(u["args"]) > 1),
      [(u["label"], u["cost"], u["args"]) for u in units])

# dispatch rule and simulation
U = lambda lab, c, w=1, prio=1, ex=False: {"label": lab, "cost": c, "weight": w, "prio": prio, "exclusive": ex, "cat": "x"}
us = [U("a", 100), U("b", 60), U("c", 50), U("d", 40), U("px", 10, 4, 9, True), U("vis", 20, 3, 0)]
ms, span = g.simulate(us, 4, overhead=0)
check("simulate: the visual unit starts first and holds its slots; the exclusive pixel unit runs after everything else, alone",
      span["vis"][0] == 0 and span["px"][0] >= max(e for lab, (s, e) in span.items() if lab != "px") and ms == span["px"][1], span)
check("simulate: longest first onto the free slots (a=100 starts at 0 next to vis)", span["a"][0] == 0, span)
check("pick_next: an exclusive unit waits while anything runs", g.pick_next([U("px", 1, 4, 9, True)], 4, 1, 4) is None
      and g.pick_next([U("px", 1, 4, 9, True)], 4, 0, 4)["label"] == "px")

# the executor: never more than `slots` at once, exclusive alone, memory admission
live, peak, lock, seen_ex = [0], [0], _th.Lock(), []


def fake_launch(u):
    with lock:
        live[0] += u["weight"] if not u["exclusive"] else 4
        peak[0] = max(peak[0], live[0])
        if u["exclusive"]:
            seen_ex.append(live[0])
    _time.sleep(0.05)
    with lock:
        live[0] -= u["weight"] if not u["exclusive"] else 4
    return ("done", u["label"])


g.T0 = _time.time()
pool = [U(f"u{i}", 10 + i) for i in range(10)] + [U("px", 1, 4, 9, True), U("vis", 5, 2, 0)]
res, tl = g.execute_units(pool, 4, fake_launch, mem=lambda: None)
check("execute: every unit ran once; never more than 4 slots busy; the exclusive unit ran alone",
      sorted(res) == sorted(u["label"] for u in pool) and peak[0] <= 4 and seen_ex == [4], (sorted(res), peak, seen_ex))
live[0], peak[0] = 0, 0
g.MEMSTAT.clear()
g.PAR_MEM_FLOOR_MB, g.PAR_MB_PER_SLOT = 3072, 700
res, _ = g.execute_units([U(f"m{i}", 1) for i in range(4)], 4, fake_launch, mem=lambda: 3500)
check("execute: below the memory floor a unit starts only when nothing of the pool runs (no deadlock, waits counted)",
      len(res) == 4 and peak[0] == 1 and g.MEMSTAT.get("admission_waits", 0) >= 1, (peak, g.MEMSTAT))
check("memory admission: 3 GB floor + 700 MB per starting worker + what started in the last 30 s",
      g.mem_admits(1, [], mem=lambda: 3800) and not g.mem_admits(2, [], mem=lambda: 4000)
      and not g.mem_admits(1, [(_time.time(), 1)], mem=lambda: 4400) and g.mem_admits(1, [(_time.time() - 60, 1)], mem=lambda: 4400))
res, _ = g.execute_units([U("boom", 1)], 2, lambda u: 1 / 0, mem=lambda: None)
check("execute: a launcher that raises is recorded as an error (settled as a failure), the pool does not hang", res["boom"][0] == "error", res)

# the pool with the fake npx: the classification is the serial gate's (pass / load error / exit code), unit by unit
reset()
logd = TMP / "logs_pool"
logd.mkdir()
modes = {"p_ok1": "ok", "p_ok2": "ok", "p_crash": "load_crash", "p_rc": "rc1_no_failure"}
res, _ = g.execute_units([U(k, 1) for k in modes], 3,
                         lambda u: g.run_pw(TMP, ["a.spec.ts"], ["desktop"], "http://127.0.0.1:1/", logd, u["label"], env={"FAKE_PW_MODE": modes[u["label"]]},
                                            workers=1, timeout=60, output=str(logd / "pwout" / u["label"])), mem=lambda: None)
for lab in sorted(res):
    rows, rc, to = res[lab]
    g.settle("preview", rows, rc, to, TMP, logd, "http://127.0.0.1:1/", {"FAKE_PW_MODE": modes[lab]}, lab)
check("pool + settle: 10 passes counted, the load crash and the rc=1-without-failure each FAIL the gate (guards unchanged under the pool)",
      g.COUNTS["preview"]["pass"] >= 10 and g.compute_verdict([]) == "fail"
      and any("p_crash: load error" in i["id"] for i in g.ITEMS) and any("p_rc: exit code" in i["id"] for i in g.ITEMS), (g.COUNTS, [i["id"] for i in g.ITEMS]))

# split coverage
spl = {("dev", "heavy.spec.ts", "desktop"): [(10, "g > a"), (10, "g > b"), (40, "g > c")]}
ua, ub = {"cat": "dev", "keys": [("dev", "heavy.spec.ts", "desktop")]}, {"cat": "dev", "keys": [("dev", "heavy.spec.ts", "desktop")]}
row = lambda line, t: {"file": "heavy.spec.ts", "project": "desktop", "line": line, "title": t}
check("coverage: every listed test reported once is clean", g.split_coverage(spl, [(ua, [row(10, "g > a"), row(10, "g > b")]), (ub, [row(40, "g > c")])]) == [])
pr = g.split_coverage(spl, [(ua, [row(10, "g > a"), row(10, "g > a")]), (ub, [row(40, "g > c")])])
check("coverage: a missing test and a test reported twice are named (a FAIL in the gate)", len(pr) == 1 and "1 listed test(s) not reported, 1 reported more than once" in pr[0][1], pr)
check("coverage: a split key with a unit that wrote no report is left to that unit's own failure", g.split_coverage(spl, [(ua, None), (ub, [row(40, "g > c")])]) == [])

# cost sources: durations txt and a gate .logs dir (retry reports excluded, the newer source wins per file+project)
txt = TMP / "durations.txt"
txt.write_text("FILE pw_x.json a.spec.ts desktop 50.0 3\nTEST a.spec.ts desktop 7 20.5 d > t1\nTEST a.spec.ts desktop 9 29.5 d > t2\n", encoding="utf-8")
gd = TMP / "gate_old.logs"
gd.mkdir()
(gd / "pw_dev_desktop.json").write_text(json.dumps({"suites": [{"title": "a.spec.ts", "file": "a.spec.ts", "specs": [
    {"title": "t9", "file": "a.spec.ts", "line": 3, "tests": [{"projectName": "desktop", "results": [{"duration": 99000}]}]},
    {"title": "t8", "file": "b.spec.ts", "line": 4, "tests": [{"projectName": "mobile", "results": [{"duration": 12000}]}]}]}]}))
(gd / "pw_dev_desktop_retry_desktop.json").write_text(json.dumps({"suites": [{"title": "b", "specs": [
    {"title": "t8", "file": "b.spec.ts", "line": 4, "tests": [{"projectName": "mobile", "results": [{"duration": 500000}]}]}]}]}))
cc = g.load_costs([txt, gd])
check("costs: the txt's file+project time wins over the older dir; the dir adds b.spec.ts; the retry report is ignored; listing from TEST lines",
      cc["fp"][("a.spec.ts", "desktop")] == 50.0 and cc["fp"][("b.spec.ts", "mobile")] == 12.0
      and cc["listing"][("a.spec.ts", "desktop")] == [(7, ["d", "t1"]), (9, ["d", "t2"])], cc)

# --plan on a toy frontend: classifies, splits, prints a timeline, runs nothing
fe = TMP / "fe"
(fe / "tests").mkdir(parents=True)
(fe / "tests" / "layout-x.spec.ts").write_text("// Needs the Vite DEV server\nimport { test } from '@playwright/test';\n")
(fe / "tests" / "b.spec.ts").write_text("import { test } from '@playwright/test';\n")
ptxt = TMP / "plan_costs.txt"
ptxt.write_text("TEST layout-x.spec.ts desktop 5 700 g > a [full]\nTEST layout-x.spec.ts desktop 5 650 g > a [lite]\nTEST b.spec.ts desktop 3 40 t\n"
                "TEST b.spec.ts tablet 3 40 t\nTEST b.spec.ts mobile 3 40 t\n"
                "TEST b.spec.ts desktop 9 700 g > classic is pixel-stable\nTEST b.spec.ts desktop 9 700 g > domus is pixel-stable\n", encoding="utf-8")
import io, contextlib  # noqa: E401,E402
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    rc = g.main_cli(["--plan", "--costs", str(ptxt), "--frontend", str(fe), "--slots", "4", "--no-visual"])
out = buf.getvalue()
check("--plan: prints the split of the heavy dev file into its two title units and a timeline per slot count, rc 0",
      rc == 0 and "split dev layout-x.spec.ts [desktop]: 2 tests" in out and "slots= 4" in out, out)
check("--plan: a preview file is not split by its pixel-stable tests (the preview units grep them out)",
      "split preview b.spec.ts" not in out and "not split (no listing or a single test): b.spec.ts [desktop]" in out, out)

print()
print("SELFTEST " + ("PASSED" if not FAILS else f"FAILED: {len(FAILS)} case(s): " + "; ".join(FAILS)))
sys.exit(0 if not FAILS else 1)
