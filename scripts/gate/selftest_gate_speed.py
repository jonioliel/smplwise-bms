#!/usr/bin/env python3
"""Self-test of GATE-SPEED-2320 with FAKE data only: no runner, no real test suite, no browser, no network, nothing outside a temp dir.

  python scripts/gate/selftest_gate_speed.py        (exit 0 = all OK; each case prints OK / BROKEN / SKIP)

Part A (pure Python, every OS): the time-limit rule of gate_budget.py (`limit`): max(derived cap, estimate high x 1.25), never below the
  estimate, full-mode budgets when the selection runs a side FULL, an explicit limit wins, fallbacks; the plan parser on the real
  ESTIMATE line format; the CLI.
Part B (pure Python + fake tools): early_check.py - GREEN / RED / NOT_RUN, every part (spec-lint, tsc, unit-rules, backend-lint,
  release_check, layout), parallel run, timeouts, the verdict files (Hebrew + English); and the REAL list (gate_early_check.json) against
  this checkout: every listed spec exists and is node-only, every backend test exists.
Part C (needs bash + git; Git Bash on Windows is enough): release_gate2.sh and branch_check.sh hand the engine the new limit (and an
  explicit GATE_TOTAL_SECS / ENTRY_TOTAL_SECS still wins), and branch_early.sh end to end on a throw-away git repository with a fake
  `flock` (busy first: it queues), fake npx / python: exit 0 / 1, entry_early_<branch>_<sha>.md + .json, NOT_RUN on the queue limit.
"""
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
TMP = Path(tempfile.mkdtemp(prefix="gate_speed_selftest_"))
for _k in [k for k in os.environ if k.startswith(("GATE_", "GATE2_", "ENTRY_", "EARLY_", "FAKE_"))]:
    del os.environ[_k]
os.environ["GATE_HOLDER_FILE"] = str(TMP / "holder.json")
sys.path.insert(0, str(HERE))
BAD = []

# the 31.10 plan output shape (gate2_select.py _print_plan), trimmed
PLAN_FULL_FE = """calibration: full tier on this tree, 12 slots + 6 shards -> planner 120 min vs the 2.19.0 pool phase 145 min measured (k = 1.21)
GATE2 dry-run: HEAD vs v2.29.0  (412 changed files; version-only ignored: 3)
  full backend : no
  full frontend: YES - frontend/tests/helpers/settle.ts
  pixel: True
  knobs for this run: GATE_BACKEND_SHARDS=6 GATE_PW_SLOTS=12 (closure depth 2)
  ESTIMATE gate2: ~117-142 min wall   (full tier on the same tree: ~121-148 min; 2.19.0 actual full v2 gate: 152 min)
"""
PLAN_SEL = PLAN_FULL_FE.replace("full frontend: YES - frontend/tests/helpers/settle.ts", "full frontend: no")
PLAN_SMALL = PLAN_SEL.replace("~117-142 min wall", "~18-24 min wall")


def check(name, cond, detail=""):
    print(("OK      " if cond else "BROKEN  ") + name + ("" if cond else f"  [{str(detail)[:700]}]"))
    if not cond:
        BAD.append(name)


def wj(p, d):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


PHASES = ["select", "modules", "backend-start", "tsc", "build", "release_check", "early-layout", "early-layout-settle",
          "playwright-pool", "playwright-settle", "backend-wait"]


def small_history(res: Path):
    """A passed, small select gate: every phase 100 s -> select cap = 11 x 125 x 1.5 = 2063 s (the 31.10 trap: a cap from a small run)."""
    wj(res / "gate_pilot-small_aaa1111.json", {"verdict": "pass", "tier": "L", "branch": "pilot/small", "sha": "aaa1111",
                                                "finished": "2026-10-30T10:00:00", "selection": {"reduced": {"preview": 3}},
                                                "phases": [{"name": n, "seconds": 100} for n in PHASES]})


# ------------------------------------------------------------------ part A: the limit rule
def part_a():
    import gate_budget as gb
    p = gb.parse_plan(PLAN_FULL_FE)
    check("plan parser: estimate 117-142, full tier 121-148, FULL frontend, not FULL backend",
          (p["est_low_min"], p["est_high_min"], p["full_low_min"], p["full_high_min"], p["full_frontend"], p["full_backend"])
          == (117, 142, 121, 148, True, False), p)
    check("plan parser: empty / foreign text -> no estimate", gb.parse_plan("")["est_high_min"] is None and gb.parse_plan("hello")["est_high_min"] is None)
    res = TMP / "resA"
    small_history(res)
    seed = HERE / "gate_phase_budgets.json"
    cap = gb.total_cap(gb.derive_budgets(res, "select", seed))
    check("fixture reproduces the trap: derived select cap ~34 min, far below the estimate", 1800 <= cap <= 2100, cap)

    r = gb.effective_limit(res, "select", gb.parse_plan(PLAN_SEL), seed=seed)
    check("31.10 case: limit = estimate high 142 min x 1.25 = 10650 s, not the 2063 s cap", r["limit_s"] == 10650 and r["rule"] == "estimate", r)
    check("the limit is never below the estimate high", r["limit_s"] >= r["estimate_high_s"] == 142 * 60, r)
    r2 = gb.effective_limit(res, "select", gb.parse_plan(PLAN_FULL_FE), seed=seed)
    check("selection FULL on a side -> full-mode budgets (cap of the full seed, clamped 14400) and the full-tier high",
          r2["derived_mode"] == "full" and r2["limit_s"] == max(gb.CAP_MAX, int(148 * 60 * 1.25)) and "FULL on frontend" in r2["why"], r2)
    r3 = gb.effective_limit(res, "select", gb.parse_plan(PLAN_SMALL), seed=seed)
    check("small estimate (24 min) -> the derived cap stays (it is larger)", r3["limit_s"] == cap and r3["rule"] == "derived", r3)
    r4 = gb.effective_limit(res, "select", gb.parse_plan(PLAN_SEL), explicit="1234", seed=seed)
    check("an explicit GATE_TOTAL_SECS / ENTRY_TOTAL_SECS wins (even below the estimate)", r4["limit_s"] == 1234 and r4["rule"] == "explicit", r4)
    check("explicit '' / 0 / junk is ignored", all(gb.effective_limit(res, "select", None, explicit=x, seed=seed)["rule"] != "explicit" for x in ("", "0", "abc", None)))
    r5 = gb.effective_limit(TMP / "nohist", "select", None, fallback=5400, seed=TMP / "noseed.json")
    check("no seed, no history, no plan -> the caller's fallback", r5["limit_s"] == 5400, r5)
    r6 = gb.effective_limit(TMP / "nohist", "select", gb.parse_plan(PLAN_SEL), fallback=5400, seed=TMP / "noseed.json")
    check("no seed, no history, but a plan -> max(fallback, estimate x 1.25)", r6["limit_s"] == 10650, r6)
    r7 = gb.effective_limit(res, "full", gb.parse_plan("  ESTIMATE gate2: ~60-70 min wall   (full tier on the same tree: ~170-200 min; x)"), seed=seed)
    check("--full run: the full-tier estimate high (200 min) is the floor x 1.25 = 15000 s", r7["limit_s"] == 15000 and r7["derived_mode"] == "full", r7)
    r8 = gb.effective_limit(res, "select", {"est_high_min": 110}, seed=seed)
    check("branch_check 31.10 case: ~110 min need vs 34 min cap -> 8250 s", r8["limit_s"] == 8250, r8)
    # the CLI as the wrappers call it: plan on stdin, the integer on stdout, the why on stderr
    pr = subprocess.run([sys.executable, str(HERE / "gate_budget.py"), "limit", "--results", str(res), "--mode", "select", "--plan", "-",
                         "--fallback", "7200", "--seed", str(seed), "--explain"], input=PLAN_SEL, capture_output=True, text=True, encoding="utf-8", errors="replace")
    check("CLI limit: stdout = one integer 10650, stderr = the why", pr.returncode == 0 and pr.stdout.strip() == "10650" and "estimate high 142" in pr.stderr, pr)
    pr = subprocess.run([sys.executable, str(HERE / "gate_budget.py"), "limit", "--results", str(res), "--mode", "select", "--plan", "-",
                         "--explicit", "999"], input=PLAN_SEL, capture_output=True, text=True, encoding="utf-8", errors="replace")
    check("CLI limit --explicit wins", pr.stdout.strip() == "999", pr)
    check("cap CLI unchanged (exit 2 without data)", gb.main(["cap", "--results", str(TMP / "none"), "--seed", str(TMP / "none.json")]) == 2)


# ------------------------------------------------------------------ part B: early_check.py with fake tools
FAKE_TOOL = r'''import json, os, sys, time
kind, args = sys.argv[1], sys.argv[2:]
log = os.environ.get("FAKE_TOOL_LOG")
if log:      # one file per call: concurrent appends to one file lose lines on Windows
    os.makedirs(log, exist_ok=True)
    with open(os.path.join(log, "%d_%d.json" % (time.time_ns(), os.getpid())), "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"kind": kind, "args": args, "cwd": os.getcwd(), "base_url": os.environ.get("SW_BASE_URL"), "t": time.time()}) + "\n")
if kind == "npm":
    os.makedirs("node_modules", exist_ok=True)
    sys.exit(0)
if kind == "npx":
    key = {"tsc": "tsc", "vite": "build"}.get(args[0]) or ("unit" if "playwright.unit.config.ts" in args else "layout")
else:
    key = "backend" if args[:2] == ["-m", "pytest"] else "release_check"
time.sleep(float(os.environ.get("FAKE_SLEEP_" + key.upper(), os.environ.get("FAKE_SLEEP", "0"))))
if key in os.environ.get("FAKE_FAIL", "").split(","):
    print({"tsc": "src/x.ts(1,1): error TS2322: Type 'a' is not assignable", "unit": "  1) [unit] > tests/unit-a.spec.ts:3:1 > every screen keeps the rule",
           "layout": "  1) [desktop] > tests/layout-noscroll-a.spec.ts:2:1 > no scroll", "build": "vite: build error",
           "backend": "FAILED tests/test_lint_a.py::test_x - boom", "release_check": "release_check: versions differ - FAIL"}[key])
    sys.exit(1)
print("ok")
'''


def make_tools(d: Path) -> dict:
    d.mkdir(parents=True, exist_ok=True)
    (d / "fake_tool.py").write_text(FAKE_TOOL, encoding="utf-8")
    out = {}
    for kind in ("npx", "npm", "py"):
        if os.name == "nt":
            p = d / f"fake{kind}.cmd"
            p.write_text(f'@"{sys.executable}" "{d / "fake_tool.py"}" {kind} %*\r\n', encoding="utf-8")
        else:
            p = d / f"fake{kind}"
            p.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{d / "fake_tool.py"}" {kind} "$@"\n', encoding="utf-8")
            p.chmod(p.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
        out[kind] = str(p)
    return out


def git(*a, cwd=None):
    env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid", "GIT_COMMITTER_NAME": "t",
           "GIT_COMMITTER_EMAIL": "t@example.invalid"}
    return subprocess.run(["git", *a], cwd=cwd, env=env, capture_output=True, text=True)


def fake_tree(root: Path, node_modules=True):
    """A tiny checkout: two node-only unit rule specs, one page spec, one layout spec, two backend lint tests, release_check.py."""
    t = root / "frontend" / "tests"
    t.mkdir(parents=True)
    (t / "unit-a.spec.ts").write_text("import { test } from '@playwright/test';\nimport { readdirSync } from 'node:fs';\n", encoding="utf-8")
    (t / "unit-b.spec.ts").write_text("import { test } from '@playwright/test';\n", encoding="utf-8")
    (t / "unit-page.spec.ts").write_text("test('x', async ({ page }) => { await page.goto('/#/home'); });\n", encoding="utf-8")
    (t / "unit-new-rule.spec.ts").write_text("import { readdirSync } from 'node:fs';\nreaddirSync('src');\n", encoding="utf-8")
    (t / "layout-noscroll-a.spec.ts").write_text("test('a', async () => {});\n", encoding="utf-8")
    (root / "frontend" / "package-lock.json").write_text("{}\n", encoding="utf-8")
    if node_modules:
        (root / "frontend" / "node_modules").mkdir()
    b = root / "smplwise_vms" / "backend" / "tests"
    b.mkdir(parents=True)
    (b / "test_lint_a.py").write_text("def test_x():\n    pass\n", encoding="utf-8")
    (b / "test_lint_b.py").write_text("def test_y():\n    pass\n", encoding="utf-8")
    (root / "scripts").mkdir()
    (root / "scripts" / "release_check.py").write_text("print('ok')\n", encoding="utf-8")


def fake_config(p: Path, specs=("unit-a.spec.ts", "unit-b.spec.ts"), backend=("test_lint_a.py", "test_lint_b.py")):
    cfg = json.loads((HERE / "gate_early_check.json").read_text(encoding="utf-8"))
    cfg.update(unit_specs=list(specs), backend_tests=list(backend))
    wj(p, cfg)
    return p


def part_b():
    import early_check as ec
    tools = make_tools(TMP / "tools")
    os.environ.update({"EARLY_NPX": tools["npx"], "EARLY_NPM": tools["npm"], "EARLY_PYTHON": tools["py"], "FAKE_TOOL_LOG": str(TMP / "tool.log")})
    root = TMP / "treeB"
    fake_tree(root)
    if shutil.which("git"):
        git("init", "-q", "-b", "main", str(root))
        git("add", ".", cwd=root)
        git("commit", "-q", "-m", "base", cwd=root)
    cfgp = fake_config(TMP / "cfgB.json")
    out = TMP / "outB"

    def run(*extra, cfg=cfgp, rroot=root, layout=False):
        shutil.rmtree(TMP / "tool.log", ignore_errors=True)
        argv = ["run", "--root", str(rroot), "--base", "HEAD", "--branch", "feature/x", "--sha", "abc1234", "--out-dir", str(out),
                "--backend-python", tools["py"], "--config", str(cfg), *extra] + (["--layout"] if layout else [])
        with open(os.devnull, "w", encoding="utf-8") as dn:
            so = sys.stdout
            sys.stdout = dn
            try:
                rc = ec.main(argv)
            finally:
                sys.stdout = so
        js = out / "entry_early_feature-x_abc1234.json"
        return rc, (json.loads(js.read_text(encoding="utf-8")) if js.exists() else {})

    def calls():
        p = TMP / "tool.log"
        return [json.loads(f.read_text(encoding="utf-8")) for f in sorted(p.glob("*.json"))] if p.is_dir() else []

    os.environ["FAKE_SLEEP"] = "1"
    t0 = time.time()
    rc, v = run()
    wall = time.time() - t0
    os.environ.pop("FAKE_SLEEP")
    parts = {p["part"]: p["status"] for p in v.get("parts", [])}
    check("all parts pass -> GREEN, exit 0", rc == 0 and v.get("verdict") == "GREEN", v)
    check("local run = spec-lint, tsc, unit-rules, backend-lint, release_check (no layout)",
          list(parts) == ["spec-lint", "tsc", "unit-rules", "backend-lint", "release_check"] and set(parts.values()) == {"PASS"}, parts)
    check("the parts run in parallel (4 x 1 s fake tools in well under 4 s)", wall < 3.5, f"{wall:.1f} s")
    cs = calls()
    unit = [c for c in cs if c["kind"] == "npx" and "playwright.unit.config.ts" in c["args"]]
    check("ONE unit Playwright run with the listed specs, the unit config, line reporter",
          len(unit) == 1 and "tests/unit-a.spec.ts" in unit[0]["args"] and "tests/unit-b.spec.ts" in unit[0]["args"]
          and "--reporter=line" in unit[0]["args"], unit)
    be = [c for c in cs if c["kind"] == "py" and c["args"][:2] == ["-m", "pytest"]]
    check("backend lints: one pytest run in smplwise_vms/backend with the listed files",
          len(be) == 1 and be[0]["args"][-2:] == ["tests/test_lint_a.py", "tests/test_lint_b.py"] and be[0]["cwd"].replace("\\", "/").endswith("smplwise_vms/backend"), be)
    md = (out / "entry_early_feature-x_abc1234.md").read_text(encoding="utf-8")
    check("verdict file entry_early_<branch>_<sha>.md: short, Hebrew + English", "בדיקה מוקדמת" in md and "Early check" in md and "ירוק" in md
          and "GREEN" in md and len(md.splitlines()) <= 40, md)

    for key, part, needle in (("tsc", "tsc", "error TS2322"), ("unit", "unit-rules", "every screen keeps the rule"),
                              ("backend", "backend-lint", "FAILED tests/test_lint_a.py::test_x"), ("release_check", "release_check", "FAIL")):
        os.environ["FAKE_FAIL"] = key
        rc, v = run()
        p = next((x for x in v.get("parts", []) if x["part"] == part), {})
        check(f"{part} fails -> RED, exit 1, the failure named", rc == 1 and v.get("verdict") == "RED" and p.get("status") == "FAIL"
              and any(needle in f for f in p.get("failures", [])), p)
    os.environ.pop("FAKE_FAIL")
    md = (out / "entry_early_feature-x_abc1234.md").read_text(encoding="utf-8")
    check("a RED verdict file says what to do next, in Hebrew and English", "אדום" in md and "next" in md and "release_check" in md, md)

    os.environ.update(FAKE_SLEEP_TSC="5", EARLY_TIMEOUT_SCALE="0.002")
    rc, v = run()
    os.environ.pop("FAKE_SLEEP_TSC")
    os.environ.pop("EARLY_TIMEOUT_SCALE")
    p = next((x for x in v.get("parts", []) if x["part"] == "tsc"), {})
    check("a part over its time limit is killed -> NOT_RUN, exit 1 (never green)", rc == 1 and v.get("verdict") == "NOT_RUN"
          and p.get("status") == "NOT_RUN" and "timed out" in p.get("why", ""), v)

    root2 = TMP / "treeB2"
    fake_tree(root2, node_modules=False)
    rc, v = run(rroot=root2)
    parts = {p["part"]: p["status"] for p in v.get("parts", [])}
    check("no frontend/node_modules (local) -> tsc / unit-rules NOT_RUN, backend still runs, exit 1",
          rc == 1 and v.get("verdict") == "NOT_RUN" and parts.get("tsc") == "NOT_RUN" and parts.get("unit-rules") == "NOT_RUN"
          and parts.get("backend-lint") == "PASS", parts)

    rc, v = run(cfg=fake_config(TMP / "cfgB3.json", specs=("unit-a.spec.ts", "unit-page.spec.ts", "unit-gone.spec.ts")))
    p = next((x for x in v.get("parts", []) if x["part"] == "unit-rules"), {})
    check("a listed page spec or a missing spec fails unit-rules (the list must stay runnable)", rc == 1 and p.get("status") == "FAIL"
          and any("unit-page.spec.ts" in f for f in p["failures"]) and any("unit-gone.spec.ts" in f for f in p["failures"]), p)
    rc, v = run(cfg=fake_config(TMP / "cfgB4.json", backend=("test_lint_a.py", "test_gone.py")))
    p = next((x for x in v.get("parts", []) if x["part"] == "backend-lint"), {})
    check("a listed backend test that does not exist fails backend-lint", p.get("status") == "FAIL" and "test_gone.py" in p.get("failures", []), p)
    check("discover lists an unlisted unit spec that reads the source tree (not page specs, not listed ones)",
          ec.discover(root, json.loads(cfgp.read_text(encoding="utf-8"))) == ["unit-new-rule.spec.ts"])

    if shutil.which("git"):
        (root / "frontend" / "tests" / "layout-new.spec.ts").write_text(
            "test('w', async ({ page }) => {\n  await page.locator('#b').click();\n  const box = await page.locator('#m').boundingBox();\n});\n", encoding="utf-8")
        git("add", ".", cwd=root)
        git("commit", "-q", "-m", "new spec", cwd=root)
        rc, v = run("--base", "HEAD~1")
        p = next((x for x in v.get("parts", []) if x["part"] == "spec-lint"), {})
        check("spec-lint: a NEW spec reading geometry right after a click -> RED", rc == 1 and p.get("status") == "FAIL"
              and any("layout-new.spec.ts:3" in f for f in p.get("failures", [])), p)
        git("rm", "-q", "frontend/tests/layout-new.spec.ts", cwd=root)
        git("commit", "-q", "-m", "drop", cwd=root)
    else:
        print("SKIP    spec-lint case: git not found")

    rc, v = run(layout=True)
    parts = {p["part"]: p["status"] for p in v.get("parts", [])}
    cs = calls()
    lay = [c for c in cs if c["kind"] == "npx" and c["args"][:2] == ["playwright", "test"] and "playwright.unit.config.ts" not in c["args"]]
    build = [c for c in cs if c["kind"] == "npx" and c["args"][:1] == ["vite"]]
    check("--layout (runner): vite build, then the early layout specs on the preview (SW_BASE_URL), GREEN",
          rc == 0 and parts.get("layout") == "PASS" and build and lay and any("tests/layout-noscroll-a.spec.ts" in c["args"] for c in lay)
          and all((c["base_url"] or "").startswith("http://127.0.0.1:") for c in lay), (parts, lay))
    os.environ["FAKE_FAIL"] = "layout"
    rc, v = run(layout=True)
    os.environ.pop("FAKE_FAIL")
    p = next((x for x in v.get("parts", []) if x["part"] == "layout"), {})
    check("a failing early layout spec -> RED, the test named", rc == 1 and p.get("status") == "FAIL" and any("no scroll" in f for f in p["failures"]), p)
    os.environ["FAKE_FAIL"] = "build"
    rc, v = run(layout=True)
    os.environ.pop("FAKE_FAIL")
    p = next((x for x in v.get("parts", []) if x["part"] == "layout"), {})
    check("a failing vite build fails the layout part (no Playwright run)", p.get("status") == "FAIL" and "vite build" in p.get("why", ""), p)

    # NOT_RUN file when nothing ran (the shell wrapper's queue limit)
    with open(os.devnull, "w", encoding="utf-8") as dn:
        so = sys.stdout
        sys.stdout = dn
        try:
            rc = ec.main(["verdict", "--branch", "feature/y", "--sha", "def5678", "--out-dir", str(out), "--why", "queue limit reached"])
        finally:
            sys.stdout = so
    j = json.loads((out / "entry_early_feature-y_def5678.json").read_text(encoding="utf-8"))
    check("verdict command (nothing ran) -> NOT_RUN file, exit 1", rc == 1 and j["verdict"] == "NOT_RUN" and "queue limit" in j["reason"], j)

    # the REAL list against this checkout
    cfg = ec.load_config()
    ok, problems = ec.unit_specs(REPO_ROOT, cfg)
    check("real list: every listed unit spec exists and is node-only", not problems and len(ok) == len(cfg["unit_specs"]), problems)
    must = {"unit-uxfix-rtl.spec.ts", "unit-empty-state-icons.spec.ts", "unit-date-format-module.spec.ts", "unit-lead-reserve.spec.ts",
            "unit-tabset-registry.spec.ts", "unit-tabs-config.spec.ts", "unit-token-lint.spec.ts"}
    check("real list: the owner's named rule specs are all in it", must <= set(cfg["unit_specs"]), must - set(cfg["unit_specs"]))
    bt = REPO_ROOT / "smplwise_vms" / "backend" / "tests"
    check("real list: backend lints exist (test_upstream_watch, test_no_ip_literals, ...)",
          {"test_upstream_watch.py", "test_no_ip_literals.py"} <= set(cfg["backend_tests"]) and all((bt / n).is_file() for n in cfg["backend_tests"]), cfg["backend_tests"])
    check("real list: the layout part uses the gate's own early layout list", cfg.get("layout") == "gate_early_layout.json" and (HERE / cfg["layout"]).is_file())


# ------------------------------------------------------------------ part C: the shell wrappers with fakes
FAKE_ENGINE = r'''#!/usr/bin/env python3
import json, os, subprocess, sys
from pathlib import Path
args = sys.argv[1:]
br = args[0]
home = Path(os.environ.get("GATE_HOME") or Path.home())
res = Path(os.environ.get("GATE_RESULTS_DIR") or (home / "smplwise-results")); res.mkdir(parents=True, exist_ok=True)
tag = "".join(c if c.isalnum() or c in "._-" else "-" for c in br)
sha = subprocess.run(["git", "-C", str(home / "work" / f"gate-{tag}"), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
(home / "engine_calls.jsonl").open("a").write(json.dumps({"argv": args, "total": os.environ.get("GATE_TOTAL_SECS")}) + "\n")
rep = {"verdict": "pass", "branch": br, "sha": sha, "wall_seconds": 60, "items": [], "tier": "L",
       "counts": {"backend": {"pass": 3, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}}}
(res / f"gate_{tag}_{sha}.json").write_text(json.dumps(rep))
'''
FAKE_SELECT = r'''#!/usr/bin/env python3
import os, sys
if sys.argv[1] == "nightly":
    print('{\n "ok": true,\n "why": "fake nightly green"\n}')
    sys.exit(0)
print(open(os.environ["FAKE_PLAN_FILE"], encoding="utf-8").read())
'''
FAKE_FLOCK = r'''#!/usr/bin/env bash
n=$(cat "$FAKE_FLOCK_COUNT" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$FAKE_FLOCK_COUNT"
[ "$n" -le "${FAKE_FLOCK_BUSY:-0}" ] && { sleep 0.2; exit 1; }
exit 0
'''


def find_bash():
    b = shutil.which("bash")
    if not b and os.name == "nt":
        for c in (r"C:\Program Files\Git\bin\bash.exe", r"C:\Program Files (x86)\Git\bin\bash.exe"):
            if Path(c).exists():
                b = c
    return b


def part_c():
    bash, g = find_bash(), shutil.which("git")
    if not bash or not g:
        print("SKIP    part C: bash or git not found")
        return
    home = TMP / "chome"
    home.mkdir()
    origin, seed = TMP / "origin.git", TMP / "seed"
    git("init", "-q", "--bare", "-b", "main", str(origin))
    git("init", "-q", "-b", "main", str(seed))
    fake_tree(seed, node_modules=False)
    (seed / ".gitignore").write_text("node_modules/\n", encoding="utf-8")
    git("add", ".", cwd=seed)
    git("commit", "-q", "-m", "base", cwd=seed)
    git("tag", "v1.0.0", cwd=seed)
    git("checkout", "-q", "-b", "feature/x", cwd=seed)
    (seed / "b.txt").write_text("2\n")
    git("add", ".", cwd=seed)
    git("commit", "-q", "-m", "feature", cwd=seed)
    git("remote", "add", "origin", str(origin), cwd=seed)
    git("push", "-q", "--tags", "origin", "main", "feature/x", cwd=seed)
    repo = home / "smplwisebms"
    git("clone", "-q", str(origin), str(repo))
    (repo / "frontend" / "node_modules").mkdir(parents=True, exist_ok=True)
    fsha = git("-C", str(repo), "rev-parse", "--short", "origin/feature/x").stdout.strip()

    g2 = home / "gate2"
    shutil.copytree(HERE, g2, ignore=shutil.ignore_patterns("__pycache__", "tests"))
    shutil.copy(HERE / "gate2" / "select_tests.py", g2 / "select_tests.py")
    (g2 / "gate2_select.py").write_text(FAKE_SELECT, encoding="utf-8")
    (home / "release_gate.py").write_text(FAKE_ENGINE, encoding="utf-8")
    shutil.copy(HERE / "select_tests.py", home / "select_tests.py")
    wj(g2 / "gate2_quarantine.json", {"entries": []})
    fake_config(g2 / "gate_early_check.json")
    res = home / "smplwise-results"
    small_history(res)
    fbin = TMP / "fakebin"
    fbin.mkdir()
    (fbin / "flock").write_text(FAKE_FLOCK, encoding="utf-8", newline="\n")
    (fbin / "python3").write_text(f'#!/usr/bin/env bash\nexec "{Path(sys.executable).as_posix()}" "$@"\n', encoding="utf-8", newline="\n")
    for f in fbin.iterdir():
        f.chmod(f.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    tools = make_tools(TMP / "ctools")
    plan_file = TMP / "plan.txt"

    def run(script, args, plan=PLAN_SEL, busy=0, extra=None):
        plan_file.write_text(plan, encoding="utf-8")
        (TMP / "flock_count").unlink(missing_ok=True)
        env = {k: v for k, v in os.environ.items() if not k.startswith(("GATE", "ENTRY_", "EARLY_", "FAKE_"))}
        path = os.pathsep.join([str(fbin), os.environ.get("PATH", "")]) if os.name == "nt" else f"{fbin}:{os.environ.get('PATH', '')}"
        env.update({"HOME": str(home), "USERPROFILE": str(home), "GATE_HOME": str(home), "GATE2_PYTHON": "python3", "PATH": path,
                    "FAKE_FLOCK_BUSY": str(busy), "FAKE_FLOCK_COUNT": str(TMP / "flock_count"), "FAKE_PLAN_FILE": str(plan_file),
                    "ENTRY_LOCK_SLICE": "1", "EARLY_LOCK_SLICE": "1", "GATE_HOLDER_FILE": str(home / "holder.json"),
                    "EARLY_NPX": tools["npx"], "EARLY_NPM": tools["npm"], "EARLY_PYTHON": tools["py"],
                    "EARLY_BACKEND_PYTHON": Path(tools["py"]).as_posix(), **(extra or {})})
        p = subprocess.run([bash, str(g2 / script), *args], env=env, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=300)
        return p.returncode, p.stdout + p.stderr

    def last_total():
        lines = (home / "engine_calls.jsonl").read_text().splitlines() if (home / "engine_calls.jsonl").exists() else []
        return json.loads(lines[-1])["total"] if lines else None

    rc, out = run("release_gate2.sh", ["feature/x"])
    check("release_gate2.sh: the engine gets limit 10650 s (estimate 142 min x 1.25), not the 2063 s derived cap",
          rc == 0 and last_total() == "10650" and "limit 10650s" in out, out[-1500:])
    check("release_gate2.sh prints why (time limit: ... estimate high 142 min ...)", "time limit:" in out and "estimate high 142" in out, out[-800:])
    rc, out = run("release_gate2.sh", ["feature/x"], plan=PLAN_FULL_FE)
    check("release_gate2.sh: FULL frontend -> full-mode budgets (14400 s)", rc == 0 and last_total() == "14400", out[-1200:])
    rc, out = run("release_gate2.sh", ["feature/x"], extra={"GATE_TOTAL_SECS": "777"})
    check("release_gate2.sh: an explicit GATE_TOTAL_SECS still wins", last_total() == "777", out[-800:])
    rc, out = run("branch_check.sh", ["feature/x"], plan=PLAN_SEL.replace("~117-142", "~95-110"))
    check("branch_check.sh: the entry limit is the estimate (110 min x 1.25 = 8250 s), not the 34 min cap",
          rc == 0 and last_total() == "8250" and "limit 8250s" in out, out[-1500:])
    rc, out = run("branch_check.sh", ["feature/x"], extra={"ENTRY_TOTAL_SECS": "4321"})
    check("branch_check.sh: an explicit ENTRY_TOTAL_SECS wins", last_total() == "4321", out[-800:])

    # branch_early.sh end to end
    rc, out = run("branch_early.sh", ["feature/x"], busy=2)
    vjs = res / f"entry_early_feature-x_{fsha}.json"
    vmd = res / f"entry_early_feature-x_{fsha}.md"
    j = json.loads(vjs.read_text(encoding="utf-8")) if vjs.exists() else {}
    check("branch_early.sh: green -> exit 0, entry_early_<branch>_<sha>.md + .json in ~/smplwise-results",
          rc == 0 and vmd.exists() and j.get("verdict") == "GREEN" and j.get("where") == "runner", out[-2000:])
    check("branch_early.sh queued while the tests lock was busy (waited, did not fail)", "queued" in out
          and int((TMP / "flock_count").read_text()) >= 3, out[-800:])
    check("branch_early.sh ran the layout part on the runner", [p["part"] for p in j.get("parts", [])][-1:] == ["layout"], j.get("parts"))
    st = json.loads((res / "early_status.json").read_text(encoding="utf-8")) if (res / "early_status.json").exists() else {}
    check("early_status.json done, exit 0; holder released; gate_status.json untouched",
          st.get("state") == "done" and st.get("exit") == 0 and not (home / "holder.json").exists() and not (res / "gate_status.json").exists(), st)
    rc, out = run("branch_early.sh", ["feature/x", "--no-layout"], extra={"FAKE_FAIL": "tsc"})
    j = json.loads(vjs.read_text(encoding="utf-8")) if vjs.exists() else {}
    check("branch_early.sh: tsc red -> exit 1, RED, no layout part with --no-layout",
          rc == 1 and j.get("verdict") == "RED" and "layout" not in [p["part"] for p in j.get("parts", [])], out[-1500:])
    rc, out = run("branch_early.sh", ["feature/x"], busy=99, extra={"EARLY_LOCK_WAIT": "2"})
    j = json.loads(vjs.read_text(encoding="utf-8")) if vjs.exists() else {}
    check("branch_early.sh: queue limit -> NOT_RUN, exit 1 (never green)", rc == 1 and j.get("verdict") == "NOT_RUN", out[-800:])
    rc, out = run("branch_early.sh", ["main"])
    check("branch_early.sh: main itself is refused", rc == 2 and "base itself" in out, out[-400:])
    rc, out = run("branch_early.sh", ["no/such"])
    check("branch_early.sh: unknown branch -> exit 1 with a clear message", rc == 1 and "not found" in out, out[-400:])
    rc, out = run("early_local.sh", ["--help"])
    check("early_local.sh --help works", rc == 0 and "LOCAL early check" in out, out[-400:])


try:
    part_a()
    part_b()
    part_c()
except Exception as e:   # noqa: BLE001
    import traceback
    traceback.print_exc()
    check("selftest crashed", False, f"{type(e).__name__}: {e}")
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print("SELFTEST PASSED" if not BAD else f"SELFTEST FAILED: {BAD}")
sys.exit(0 if not BAD else 1)
