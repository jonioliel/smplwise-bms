#!/usr/bin/env python3
"""The EARLY check (GATE-SPEED-2320): only the release gate's early stage, for one branch, in minutes instead of a 20-140 minute gate.

Owner decision 31.10: every agent runs early_local before pushing; the lead runs branch_early.sh on the runner before a branch joins a
train. The parts (the list is gate_early_check.json next to this file):

  spec-lint      the gate lint: a spec file ADDED since the base that reads geometry right after a click with no settle (lint_spec_waits.py)
  tsc            npx tsc --noEmit (frontend)
  unit-rules     the repository-wide "every X must Y" node-only unit specs (one Playwright run, playwright.unit.config.ts)
  backend-lint   the backend lint-style pytest files (test_upstream_watch, test_no_ip_literals, ...)
  release_check  scripts/release_check.py --root .
  layout         (runner only, --layout) vite build + the gate's early layout list (gate_early_layout.json) on the dist preview

All parts run in parallel. Verdict: GREEN = every part passed (exit 0); RED = any part failed (exit 1); NOT_RUN = a part could not run
(missing node_modules, no pytest, timeout) and nothing failed (exit 1, never green).

  early_check.py run --root <checkout> [--base origin/main] [--layout] [--branch B] [--sha S] [--out-dir DIR]
                     [--backend-python PY] [--modules-from <frontend dir>] [--only a,b] [--skip a,b] [--config FILE]
  early_check.py list                    print the parts and the unit specs of the list
  early_check.py discover --root <checkout>   unit specs that read the source tree but are not in the list (review candidates)

Files: <out-dir>/entry_early_<branch-tag>_<sha>.md (short, Hebrew + English) and .json, logs in entry_early_<tag>_<sha>.logs/.
Commands can be replaced for tests: EARLY_NPX (default npx / npx.cmd), EARLY_PYTHON (release_check), EARLY_TIMEOUT_SCALE.
"""
from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
CONFIG = HERE / "gate_early_check.json"
PARTS = ["spec-lint", "tsc", "unit-rules", "backend-lint", "release_check", "layout"]
# the unit config's own page-spec rule (frontend/playwright.unit.config.ts): such a spec needs a server and is not eligible here
PAGE_SPEC = re.compile(r"""goto\(\s*[`'"]/|\bconst\s+[A-Z_]+\s*=\s*['"`]/[?#]""")
READS_SOURCE = re.compile(r"\breaddirSync\(|\bglobSync\(|\breaddir\(")
NEEDS_BUILD = re.compile(r"""['"`/](dist|www)['"`/]|/assets/""")
HE = {"GREEN": "ירוק - הבדיקה המוקדמת עברה", "RED": "אדום - לתקן לפני דחיפה / לפני רכבת", "NOT_RUN": "לא רץ - לא ירוק, להריץ שוב"}
EN = {"GREEN": "GREEN - the early check passed", "RED": "RED - fix before pushing / before a train",
      "NOT_RUN": "NOT RUN - not green, run it again"}
PART_HE = {"spec-lint": "בדיקת המתנה בספקים חדשים", "tsc": "בדיקת טיפוסים", "unit-rules": "כללי מקור (unit)",
           "backend-lint": "בדיקות מקור בצד השרת", "release_check": "בדיקת שחרור", "layout": "פריסה מוקדמת"}


def tag_of(branch: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "-", branch)


def load_config(path: Path | None = None) -> dict:
    return json.loads(Path(path or CONFIG).read_text(encoding="utf-8"))


def npx() -> str:
    return os.environ.get("EARLY_NPX") or ("npx.cmd" if os.name == "nt" else "npx")


def scale() -> float:
    try:
        return max(0.001, float(os.environ.get("EARLY_TIMEOUT_SCALE", "1")))
    except ValueError:
        return 1.0


# ---------------------------------------------------------------- the unit spec list
def unit_specs(root: Path, cfg: dict) -> tuple[list[str], list[str]]:
    """(runnable specs, problems): a listed spec that is missing, or that is a page spec (needs a server), is a problem, not run."""
    tests = Path(root) / "frontend" / "tests"
    ok, bad = [], []
    for name in cfg.get("unit_specs", []):
        p = tests / name
        if not p.is_file():
            bad.append(f"{name}: listed in gate_early_check.json but missing")
            continue
        if PAGE_SPEC.search(p.read_text(encoding="utf-8", errors="replace")):
            bad.append(f"{name}: a page spec (needs a server), not eligible")
            continue
        ok.append(name)
    return ok, bad


def discover(root: Path, cfg: dict) -> list[str]:
    """Node-only unit specs that read the source tree (readdirSync / globSync) and are not listed: candidates for review."""
    tests = Path(root) / "frontend" / "tests"
    listed = set(cfg.get("unit_specs", []))
    out = []
    for p in sorted(tests.glob("unit-*.spec.ts")):
        t = p.read_text(encoding="utf-8", errors="replace")
        if p.name in listed or PAGE_SPEC.search(t) or not READS_SOURCE.search(t) or NEEDS_BUILD.search(t):
            continue
        out.append(p.name)
    return out


# ---------------------------------------------------------------- the layout list (runner)
def layout_groups(root: Path, cfg: dict) -> tuple[dict, str]:
    """({projects tuple: [spec files]}, how): the gate's own pick (release_gate.classify + pick_early) when the engine is importable,
    else the fnmatch patterns of gate_early_layout.json on frontend/tests (every project)."""
    try:
        lay = json.loads((HERE / cfg.get("layout", "gate_early_layout.json")).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return {}, f"no layout list ({type(e).__name__})"
    fe = Path(root) / "frontend"
    groups: dict = {}
    try:
        import release_gate as rg       # the staged engine next to this file (branch_early.sh stages it like branch_check.sh)
        rg.TIER = "L"
        costs = {}
        try:
            import gate2_select as gs
            costs = dict(gs.load_costs(None).get("seconds", {}))
        except Exception:               # noqa: BLE001 - costs only shape the cap
            pass
        cls = rg.classify(fe, "L")
        early = rg.pick_early(cls, costs)
        for name, ent in early.items():
            groups.setdefault(tuple(ent.get("projects") or ["desktop", "tablet", "mobile"]), []).append(name)
        how = f"engine pick (release_gate.pick_early): {len(early)} specs"
    except Exception as e:              # noqa: BLE001
        names = sorted(p.name for p in (fe / "tests").glob("*.spec.ts"))
        pick = []
        for pat in lay.get("include", []):
            pick += [n for n in names if fnmatch.fnmatch(n, pat) and n not in pick]
        if pick:
            groups[("desktop", "tablet", "mobile")] = pick
        how = f"pattern pick ({len(pick)} specs; engine not importable: {type(e).__name__})"
    return {k: sorted(v) for k, v in groups.items()}, how


# ---------------------------------------------------------------- process helpers
def _kill_tree(p: subprocess.Popen) -> None:
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], capture_output=True)
        else:
            os.killpg(p.pid, signal.SIGKILL)
    except Exception:                   # noqa: BLE001
        try:
            p.kill()
        except Exception:               # noqa: BLE001
            pass


def run_cmd(cmd: list[str], cwd: Path, log: Path, timeout: float, env: dict | None = None) -> tuple[int | None, str]:
    """(rc, output); rc None = timed out (killed), -127 = the command does not exist."""
    e = dict(os.environ)
    e.update(env or {})
    kw = {"start_new_session": True} if os.name != "nt" else {}
    log.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(log, "w", encoding="utf-8", errors="replace") as fh:
            fh.write("$ " + " ".join(cmd) + f"\n# cwd {cwd}\n")
            fh.flush()
            p = subprocess.Popen(cmd, cwd=str(cwd), env=e, stdout=fh, stderr=subprocess.STDOUT, **kw)
            try:
                rc = p.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                _kill_tree(p)
                p.wait()
                rc = None
    except (FileNotFoundError, PermissionError, NotADirectoryError) as ex:
        log.write_text(f"$ {' '.join(cmd)}\ncannot start: {ex}\n", encoding="utf-8")
        return -127, str(ex)
    return rc, log.read_text(encoding="utf-8", errors="replace")


def _fails(part: str, out: str) -> list[str]:
    if part == "tsc":
        f = [l.strip() for l in out.splitlines() if "error TS" in l]
    elif part in ("unit-rules", "layout"):
        f = [m.group(1).strip() for m in re.finditer(r"^\s*\d+\)\s+(.+)$", out, re.M)]
    elif part == "backend-lint":
        f = [l.strip() for l in out.splitlines() if l.startswith(("FAILED ", "ERROR "))]
    else:
        f = [l.strip() for l in out.splitlines() if re.search(r"\bfail|missing|differ", l, re.I)]
    return list(dict.fromkeys(f))[:40]


def _result(part, status, t0, why="", failures=None, log=None, extra=None) -> dict:
    r = {"part": part, "status": status, "seconds": int(time.time() - t0), "why": why, "failures": failures or [],
         "log": str(log) if log else ""}
    r.update(extra or {})
    return r


def _proc_part(part, cmd, cwd, log, timeout, env=None, extra=None) -> dict:
    t0 = time.time()
    rc, out = run_cmd(cmd, cwd, log, timeout * scale(), env)
    if rc == -127:
        return _result(part, "NOT_RUN", t0, f"cannot start {cmd[0]}: {out}"[:200], log=log, extra=extra)
    if rc is None:
        return _result(part, "NOT_RUN", t0, f"timed out after {int(timeout * scale())} s (killed)", _fails(part, out), log, extra)
    if rc == 0:
        return _result(part, "PASS", t0, "", log=log, extra=extra)
    if part == "backend-lint" and rc in (4, 5):
        return _result(part, "NOT_RUN", t0, f"pytest rc={rc} (usage / nothing collected)", log=log, extra=extra)
    if part == "backend-lint" and re.search(r"No module named (pytest|'pytest')", out):
        return _result(part, "NOT_RUN", t0, "pytest is not installed for this python (--backend-python)", log=log, extra=extra)
    f = _fails(part, out)
    return _result(part, "FAIL", t0, f"rc={rc}" + ("" if f else " (see the log)"), f, log, extra)


# ---------------------------------------------------------------- the parts
def part_spec_lint(root: Path, base: str, logd: Path) -> dict:
    t0 = time.time()
    try:
        import lint_spec_waits as L
    except ImportError:
        return _result("spec-lint", "NOT_RUN", t0, "lint_spec_waits.py is not next to early_check.py")
    files = L.new_specs(root, base)
    found = []
    for f in files:
        for c, m, txt in L.lint_text(f.read_text(encoding="utf-8", errors="replace")):
            found.append(f"{f.name}:{m}: geometry read {m - c} line(s) after a click with no animation wait (settle(page)); {txt}"[:300])
    log = logd / "spec-lint.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(f"new spec files since {base}: {len(files)}\n" + "\n".join(found) + "\n", encoding="utf-8")
    return _result("spec-lint", "FAIL" if found else "PASS", t0, f"{len(found)} finding(s) in {len(files)} new spec file(s)" if found else
                   f"{len(files)} new spec file(s), no finding", found, log)


def ensure_modules(fe: Path, modules_from: Path | None, logd: Path, timeout: float) -> str:
    """'' when frontend/node_modules is usable, else why not. Runner: link the main checkout's node_modules when package-lock.json is
    identical (what the engine does), else npm ci."""
    nm = fe / "node_modules"
    if nm.exists():
        return ""
    if modules_from:
        try:
            if (fe / "package-lock.json").read_bytes() == (Path(modules_from) / "package-lock.json").read_bytes() and (Path(modules_from) / "node_modules").is_dir():
                os.symlink(Path(modules_from) / "node_modules", nm, target_is_directory=True)
                return ""
        except OSError:
            pass
        npm = os.environ.get("EARLY_NPM") or ("npm.cmd" if os.name == "nt" else "npm")
        rc, _ = run_cmd([npm, "ci", "--no-audit", "--no-fund"], fe, logd / "modules.log", timeout * scale())
        return "" if rc == 0 else f"npm ci failed (rc={rc}, see modules.log)"
    return f"{nm} is missing (local: link it to a checkout that has node_modules, see README_GATE_FAST.md)"


def part_layout(root: Path, cfg: dict, logd: Path, to: dict) -> dict:
    t0 = time.time()
    fe = root / "frontend"
    groups, how = layout_groups(root, cfg)
    if not groups:
        return _result("layout", "NOT_RUN", t0, f"no early layout spec picked: {how}")
    rc, out = run_cmd([npx(), "vite", "build"], fe, logd / "layout-build.log", to.get("build", 900) * scale())
    if rc != 0:
        st = "NOT_RUN" if rc in (None, -127) else "FAIL"
        return _result("layout", st, t0, f"vite build rc={rc} (see layout-build.log)", log=logd / "layout-build.log")
    port = os.environ.get("EARLY_PREVIEW_PORT", "4191")
    env = {"SW_BASE_URL": f"http://127.0.0.1:{port}/"}
    workers = str(int(os.environ.get("EARLY_LAYOUT_WORKERS") or cfg.get("layout_workers", 6)))
    fails, sts, n = [], [], 0
    left = to.get("layout", 1500) * scale()
    for k, (projs, specs) in enumerate(sorted(groups.items())):
        n += len(specs)
        cmd = [npx(), "playwright", "test", "--reporter=line", f"--workers={workers}"] + [f"--project={p}" for p in projs] + [f"tests/{s}" for s in specs]
        t1 = time.time()
        r = _proc_part("layout", cmd, fe, logd / f"layout-{k + 1}.log", max(30.0, left) / scale(), env)
        left -= time.time() - t1
        fails += r["failures"]
        sts.append(r["status"])
    status = "FAIL" if "FAIL" in sts else ("NOT_RUN" if "NOT_RUN" in sts else "PASS")
    return _result("layout", status, t0, f"{n} specs in {len(groups)} project group(s), {workers} workers; {how}" + ("" if status == "PASS" else f"; {len(fails)} failing"),
                   fails, logd / "layout-1.log", {"specs": n})


def run_all(root: Path, base: str, cfg: dict, logd: Path, *, layout: bool, backend_python: str, modules_from: Path | None,
            only: set | None = None, skip: set | None = None) -> list[dict]:
    root = Path(root).resolve()
    fe, be = root / "frontend", root / "smplwise_vms" / "backend"
    to = cfg.get("timeouts_s", {})
    want = [p for p in PARTS if (p != "layout" or layout) and (not only or p in only) and not (skip and p in skip)]
    want = [p for p in want if (p != "tsc" or cfg.get("tsc", True)) and (p != "spec-lint" or cfg.get("spec_lint", True))
            and (p != "release_check" or cfg.get("release_check", True))]
    results: dict = {}
    mod_why = ""
    if any(p in want for p in ("tsc", "unit-rules", "layout")):
        mod_why = ensure_modules(fe, modules_from, logd, to.get("modules", 900))
    specs, spec_problems = unit_specs(root, cfg)
    py_rc = os.environ.get("EARLY_PYTHON") or backend_python or sys.executable

    def job(part):
        t0 = time.time()
        if part in ("tsc", "unit-rules", "layout") and mod_why:
            return _result(part, "NOT_RUN", t0, mod_why)
        if part == "spec-lint":
            return part_spec_lint(root, base, logd)
        if part == "tsc":
            return _proc_part("tsc", [npx(), "tsc", "--noEmit"], fe, logd / "tsc.log", to.get("tsc", 600))
        if part == "unit-rules":
            if not specs:
                return _result(part, "NOT_RUN", t0, "no runnable unit spec in the list", spec_problems)
            w = str(int(os.environ.get("EARLY_UNIT_WORKERS") or cfg.get("unit_workers", 4)))
            r = _proc_part(part, [npx(), "playwright", "test", "-c", "playwright.unit.config.ts", "--reporter=line", f"--workers={w}"]
                           + [f"tests/{s}" for s in specs], fe, logd / "unit-rules.log", to.get("unit", 600), extra={"specs": len(specs)})
            if spec_problems and r["status"] == "PASS":
                r.update(status="FAIL", why="the list names specs that cannot run", failures=spec_problems)
            return r
        if part == "backend-lint":
            names = [n for n in cfg.get("backend_tests", []) if (be / "tests" / n).is_file()]
            missing = [n for n in cfg.get("backend_tests", []) if n not in names]
            if not names:
                return _result(part, "NOT_RUN", t0, "no backend test of the list exists", missing)
            r = _proc_part(part, [backend_python, "-m", "pytest", "-o", "addopts=", "-q", "-p", "no:cacheprovider", "-rfE"]
                           + [f"tests/{n}" for n in names], be, logd / "backend-lint.log", to.get("backend", 600), extra={"files": len(names)})
            if missing and r["status"] == "PASS":
                r.update(status="FAIL", why="the list names backend tests that do not exist", failures=missing)
            return r
        if part == "release_check":
            return _proc_part(part, [py_rc, "scripts/release_check.py", "--root", "."], root, logd / "release_check.log", to.get("release_check", 300))
        if part == "layout":
            return part_layout(root, cfg, logd, to)
        return _result(part, "NOT_RUN", t0, "unknown part")

    def wrap(part):
        try:
            results[part] = job(part)
        except Exception as e:      # noqa: BLE001 - a crash of one part is NOT_RUN, never green
            results[part] = _result(part, "NOT_RUN", time.time(), f"crashed: {type(e).__name__}: {e}"[:200])

    threads = [threading.Thread(target=wrap, args=(p,), daemon=True) for p in want]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return [results[p] for p in want]


# ---------------------------------------------------------------- the verdict
def build_verdict(parts: list[dict], *, branch: str, sha: str, base: str, base_sha: str = "", where: str = "local", wall_s: int = 0,
                  waited_s: int = 0, reason: str = "") -> dict:
    v = {"kind": "early-check", "where": where, "branch": branch, "sha": sha, "base": base, "base_sha": base_sha,
         "finished": dt.datetime.now().astimezone().isoformat(timespec="seconds"), "wall_s": int(wall_s), "waited_s": int(waited_s),
         "parts": parts}
    st = [p["status"] for p in parts]
    if not parts:
        v.update(verdict="NOT_RUN", exit=1, reason=reason or "nothing ran")
    elif "FAIL" in st:
        v.update(verdict="RED", exit=1, reason=reason or "failed: " + ", ".join(p["part"] for p in parts if p["status"] == "FAIL"))
    elif "NOT_RUN" in st:
        v.update(verdict="NOT_RUN", exit=1, reason=reason or "did not run: " + ", ".join(p["part"] for p in parts if p["status"] == "NOT_RUN"))
    else:
        v.update(verdict="GREEN", exit=0, reason=reason or "every part passed")
    return v


def render_md(v: dict) -> str:
    lines = [f"# בדיקה מוקדמת / Early check ({v['where']}): {v['branch']} @ {v['sha']}", "",
             f"- תוצאה: **{HE[v['verdict']]}**",
             f"- Verdict: **{EN[v['verdict']]}** ({v.get('reason', '')})",
             f"- בסיס / base: {v['base']}" + (f" @ {v['base_sha']}" if v.get("base_sha") else "")
             + (f"; המתנה בתור / queued {v['waited_s'] // 60} min" if v.get("waited_s") else "") + f"; ריצה / run {v['wall_s']} s", "",
             "| חלק / part | תוצאה / result | s | |", "|---|---|---|---|"]
    for p in v["parts"]:
        lines.append(f"| {PART_HE.get(p['part'], p['part'])} / {p['part']} | {p['status']} | {p['seconds']} | {str(p.get('why', ''))[:110]} |")
    for p in v["parts"]:
        if p["status"] != "PASS" and p.get("failures"):
            fl = p["failures"]
            lines += ["", f"## {p['part']} ({len(fl)})"] + [f"- {x[:200]}" for x in fl[:8]] + ([f"- ... +{len(fl) - 8}"] if len(fl) > 8 else [])
            if p.get("log"):
                lines.append(f"- log: {p['log']}")
    if v["verdict"] != "GREEN":
        lines += ["", "מה עכשיו / next: לתקן ולהריץ שוב (early_local לפני דחיפה; branch_early.sh לפני רכבת) / fix and run it again."]
    return "\n".join(lines) + "\n"


def write_verdict(v: dict, out_dir: Path) -> tuple[Path, Path]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    base = f"entry_early_{tag_of(v['branch'])}_{v['sha']}"
    md, js = out_dir / f"{base}.md", out_dir / f"{base}.json"
    md.write_text(render_md(v), encoding="utf-8")
    js.write_text(json.dumps(v, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return md, js


def _git(root: Path, *a) -> str:
    r = subprocess.run(["git", "-C", str(root), *a], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["run", "list", "discover", "verdict"])
    ap.add_argument("--root", default=".")
    ap.add_argument("--base", default="origin/main")
    ap.add_argument("--layout", action="store_true", help="also the early layout list (vite build + dist preview): the runner")
    ap.add_argument("--branch", default="")
    ap.add_argument("--sha", default="")
    ap.add_argument("--base-sha", default="")
    ap.add_argument("--out-dir", default="")
    ap.add_argument("--where", default="")
    ap.add_argument("--waited-s", type=int, default=0)
    ap.add_argument("--why", default="", help="verdict: the reason when nothing ran")
    ap.add_argument("--backend-python", default="")
    ap.add_argument("--modules-from", default="", help="a frontend dir whose node_modules may be linked (runner: ~/smplwisebms/frontend)")
    ap.add_argument("--only", default="")
    ap.add_argument("--skip", default="")
    ap.add_argument("--config", default="")
    ns = ap.parse_args(argv)
    cfg = load_config(Path(ns.config) if ns.config else None)
    root = Path(ns.root).resolve()
    if ns.cmd == "list":
        print("parts: " + ", ".join(PARTS) + " (layout on the runner only)")
        print("unit specs: " + ", ".join(cfg.get("unit_specs", [])))
        print("backend tests: " + ", ".join(cfg.get("backend_tests", [])))
        return 0
    if ns.cmd == "discover":
        c = discover(root, cfg)
        print(f"{len(c)} unit spec(s) read the source tree but are not in gate_early_check.json (review; add only whole-repo rules):")
        for n in c:
            print("  " + n)
        return 0
    branch = ns.branch or _git(root, "rev-parse", "--abbrev-ref", "HEAD") or "local"
    sha = ns.sha or _git(root, "rev-parse", "--short", "HEAD") or "nosha"
    out = Path(ns.out_dir) if ns.out_dir else Path(tempfile.gettempdir()) / "smplwise-early"
    where = ns.where or ("runner" if ns.layout else "local")
    if ns.cmd == "verdict":        # nothing ran (queue limit, missing branch): a NOT_RUN file, exit 1
        v = build_verdict([], branch=branch, sha=sha, base=ns.base, base_sha=ns.base_sha, where=where, waited_s=ns.waited_s, reason=ns.why)
        md, _ = write_verdict(v, out)
        print(render_md(v))
        print(f"early check verdict: {v['verdict']} -> {md}")
        return 1
    logd = out / f"entry_early_{tag_of(branch)}_{sha}.logs"
    if logd.exists():
        shutil.rmtree(logd, ignore_errors=True)
    bpy = ns.backend_python or sys.executable
    t0 = time.time()
    only = {x for x in ns.only.split(",") if x} or None
    skip = {x for x in ns.skip.split(",") if x} or None
    parts = run_all(root, ns.base, cfg, logd, layout=ns.layout, backend_python=bpy,
                    modules_from=Path(ns.modules_from) if ns.modules_from else None, only=only, skip=skip)
    base_sha = ns.base_sha or _git(root, "rev-parse", "--short", ns.base)
    v = build_verdict(parts, branch=branch, sha=sha, base=ns.base, base_sha=base_sha, where=where, wall_s=int(time.time() - t0), waited_s=ns.waited_s)
    md, js = write_verdict(v, out)
    print(render_md(v))
    print(f"early check verdict: {v['verdict']} in {v['wall_s']} s -> {md} (+ {js.name})")
    return v["exit"]


if __name__ == "__main__":
    sys.exit(main())
