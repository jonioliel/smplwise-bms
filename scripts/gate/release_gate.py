"""Release gate engine (release_gate.sh is the wrapper: flock, total timeout, usage text).

False-green guards, added after the 0.1.157 gate passed with 865 instead of ~3900 preview tests: one Playwright process died at
load time ("Unsupported decorator location: field") and wrote an EMPTY report that the old code read as "nothing failed".
  * a Playwright process whose report carries load/transpile errors, has ZERO tests, hit the timeout, or exited non-zero without
    a single failed test is a FAIL (settle());
  * a pytest shard with no summary, an exit code other than 0/1, zero collected tests, or rc=1 without a parsed failure is a FAIL
    (backend_finish());
  * each category's passed count is compared with gate_baselines.json (the previous accepted release); below GATE_DROP_THRESHOLD
    (default 0.70) of the baseline is a FAIL unless the run started with --allow-count-drop "<reason>" (check_baselines());
  * M074 visual step, ON BY DEFAULT in every tier as a WARNING (differences are a report section, the verdict is unchanged);
    --visual-block makes differences fail the gate, --no-visual (or GATE_VISUAL=off) switches the step off, --visual-base <ref>
    (default origin/main) selects the touched screens: runs `visual.mjs run --touched` on the dist preview against the committed
    linux baselines; the matrix spec then leaves the pixel group;
  * the final report lists every category with its counts, its baseline and the ratio.
"""
import concurrent.futures as cf, glob, json, os, re, signal, socket, subprocess, sys, tempfile, threading, time, urllib.request
from pathlib import Path

HB_STOP = threading.Event()

BR, TIER = "", "L"        # set by main_cli()
def visual_from_env(v):
    """GATE_VISUAL: unset/'warn' -> warn (the default), 'block' -> block, 'off'/'none' -> step disabled."""
    v = (v or "").strip().lower()
    return "" if v in ("off", "none") else (v if v in ("warn", "block") else "warn")


VISUAL = visual_from_env(os.environ.get("GATE_VISUAL"))  # "warn" (default, --visual), "block" (--visual-block) or "" (--no-visual): the M074 visual-diff matrix step
VISUAL_BASE = os.environ.get("GATE_VISUAL_BASE", "origin/main")   # --touched is computed against this ref (the previous release)
VISUAL_INFO = {}          # filled by run_visual(); written to the report as a warning section
ALLOW_DROP = ""           # --allow-count-drop "<reason>": waives the baseline check; the waiver is written into the report
DROP_THRESHOLD = float(os.environ.get("GATE_DROP_THRESHOLD", "0.70"))
BASELINE_NAME = "gate_baselines.json"
BASELINE_ROWS = {}        # category -> {baseline, actual, ratio, state}, filled by check_baselines()
HERE = Path(__file__).resolve().parent
HOME = Path(os.environ.get("GATE_HOME") or Path.home())
BASE = HOME / "smplwisebms"
RES = Path(os.environ.get("GATE_RESULTS_DIR") or (HOME / "smplwise-results"))
WORK = HOME / "work"
PY = str(BASE / ".venv" / "bin" / "python")
KNOWN_FILE = HOME / "known_issues.json"
TOTAL = int(os.environ.get("GATE_TOTAL_SECS", "5400"))
T0 = time.time()
DEADLINE = T0 + TOTAL - 150
TAG = ""
PW_WORKERS = os.environ.get("GATE_PW_WORKERS", "3")
# specs that need a fake backend and are part of the gate's routine; any other spec that needs a fixture self-skips in the
# preview run and is listed under "fixture needed but not in the gate routine"
FIXTURE_SPECS = {"evidence-camera-card.spec.ts"}
STATUS = RES / "gate_status.json"
STARTED = time.strftime("%Y-%m-%dT%H:%M:%S%z")
GROUPS = []          # process groups started here (only these are ever killed)
ITEMS = []           # every non-pass finding {category,id,status,reason}
COUNTS = {}          # category -> {pass,fail,flaky,known,skipped}
PHASES = []          # [{name,seconds}]
STATE = {"sha": "", "phase": "start", "summary": ""}


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def write_json(p, d):
    tmp = Path(str(p) + ".tmp")
    tmp.write_text(json.dumps(d, indent=1, ensure_ascii=False))
    os.replace(tmp, p)


def status(state, summary=None, finished=None):
    if summary is not None:
        STATE["summary"] = summary
    write_json(STATUS, {"branch": BR, "sha": STATE["sha"], "tier": TIER, "state": state, "phase": STATE["phase"],
                        "started": STARTED, "finished": finished, "updated": now(), "pid": os.getpid(),
                        "elapsed_s": int(time.time() - T0), "summary": STATE["summary"]})


def left():
    return DEADLINE - time.time()


def kill_all():
    for pg in list(GROUPS):
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(pg, sig)
            except (ProcessLookupError, PermissionError):
                break
            if sig == signal.SIGTERM:
                time.sleep(1)
    GROUPS.clear()


def spawn(cmd, cwd, log, env=None):
    e = dict(os.environ)
    e.update(env or {})
    f = open(log, "ab")
    p = subprocess.Popen([str(c) for c in cmd], cwd=str(cwd), env=e, stdout=f, stderr=subprocess.STDOUT, start_new_session=True)
    GROUPS.append(p.pid)
    p._gate_log = f
    return p


def reap(p):
    try:
        p._gate_log.close()
    except Exception:
        pass
    if p.pid in GROUPS:
        try:
            os.killpg(p.pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
        GROUPS.remove(p.pid)


def run(cmd, cwd, log, env=None, timeout=None):
    """Run to completion (bounded by the global deadline); returns (rc, timed_out)."""
    t = min(timeout or 1e9, left())
    if t < 20:
        return 124, True
    p = spawn(cmd, cwd, log, env)
    try:
        rc = p.wait(timeout=t)
        to = False
    except subprocess.TimeoutExpired:
        to, rc = True, 124
        try:
            os.killpg(p.pid, signal.SIGTERM)
            time.sleep(3)
            os.killpg(p.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        p.wait()
    reap(p)
    return rc, to


def free_port(pair=False):
    for _ in range(50):
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        if not pair:
            return port
        s2 = socket.socket()
        try:
            s2.bind(("127.0.0.1", port + 1))
            s2.close()
            return port
        except OSError:
            continue
    raise RuntimeError("no free port pair")


def wait_http(url, secs):
    end = time.time() + secs
    while time.time() < end:
        try:
            with urllib.request.urlopen(url, timeout=10) as r:
                if r.status < 500:
                    return True
        except Exception:
            time.sleep(1)
    return False


def count(cat, key, n=1):
    COUNTS.setdefault(cat, {"pass": 0, "fail": 0, "flaky": 0, "known": 0, "skipped": 0})[key] += n


def item(cat, ident, st, reason=""):
    ITEMS.append({"category": cat, "id": ident, "status": st, "reason": reason[:300]})


class Phase:
    def __init__(self, name, label):
        self.name, self.label = name, label

    def __enter__(self):
        STATE["phase"] = self.name
        self.t = time.time()
        status("running", self.label)
        return self

    def __exit__(self, *a):
        PHASES.append({"name": self.name, "seconds": int(time.time() - self.t)})
        return False


# ---------------------------------------------------------------- known issues
def load_known():
    try:
        return json.loads(KNOWN_FILE.read_text())
    except Exception:
        return []


KNOWN = load_known()


TIMEDEP = []   # known entries that applied only because of the time of day (shown as a warning in the verdict)


def when_applies(k):
    """An entry may carry "when_local": {"tz","from","to"} (e.g. the quiet-hours tests): it only applies inside that local window."""
    w = k.get("when_local")
    if not w:
        return True
    try:
        from zoneinfo import ZoneInfo
        import datetime as _dt
        t = _dt.datetime.now(ZoneInfo(w.get("tz", "Asia/Jerusalem"))).strftime("%H:%M")
        a, b = w.get("from", "00:00"), w.get("to", "00:00")
        return (a <= t or t < b) if a > b else (a <= t < b)
    except Exception:
        return True


def known_reason(kind, file=None, line=None, project=None, title="", nodeid=""):
    for k in KNOWN:
        if k.get("kind") != kind or not when_applies(k):
            continue
        if kind == "playwright":
            if k.get("file") and k["file"] != file:
                continue
            if k.get("line") and int(k["line"]) != int(line or -1):
                continue
            if k.get("project") not in (None, "*", project):
                continue
            if k.get("title_contains") and k["title_contains"] not in title:
                continue
        else:
            if not k.get("nodeid_contains") or k["nodeid_contains"] not in nodeid:
                continue
        if k.get("when_local"):
            TIMEDEP.append(nodeid or f"{file}:{line}")
        return k.get("reason") or k.get("id") or "known"
    return None


# ---------------------------------------------------------------- worktree
def setup_worktree():
    subprocess.run(["git", "fetch", "--all", "--prune", "-q"], cwd=BASE, timeout=180)
    rc = subprocess.run(["git", "rev-parse", "--verify", "-q", f"origin/{BR}^{{commit}}"], cwd=BASE, capture_output=True, text=True)
    if rc.returncode != 0:
        raise SystemExit(f"origin/{BR} not found (push the branch first)")
    wt = WORK / f"gate-{TAG}"
    if not (wt / ".git").exists():
        subprocess.run(["git", "worktree", "prune"], cwd=BASE)
        subprocess.run(["git", "worktree", "add", "--detach", "-f", str(wt), f"origin/{BR}", "-q"], cwd=BASE, check=True)
    else:
        subprocess.run(["git", "-C", str(wt), "checkout", "-q", "-f", "--detach", f"origin/{BR}"], check=True)
        subprocess.run(["git", "-C", str(wt), "clean", "-fdq", "-e", "node_modules"], check=False)
    sha = subprocess.run(["git", "-C", str(wt), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    return wt, sha


def need_modules(wt, log):
    fe, bfe = wt / "frontend", BASE / "frontend"
    try:
        same = (fe / "package-lock.json").read_bytes() == (bfe / "package-lock.json").read_bytes()
    except OSError:
        same = False
    if same:
        if not (fe / "node_modules").exists():
            os.symlink(bfe / "node_modules", fe / "node_modules")
        return True
    if (fe / "node_modules").is_symlink():
        (fe / "node_modules").unlink()
    rc, _ = run(["npm", "ci"], fe, log, timeout=900)
    return rc == 0


# ---------------------------------------------------------------- backend
def backend_start(wt, logd, nshards=3):
    bd = wt / "smplwise_vms" / "backend"
    files = sorted(glob.glob(str(bd / "tests" / "test_*.py")), key=lambda f: -os.path.getsize(f))
    shards = [[] for _ in range(nshards)]
    load = [0] * nshards
    for f in files:
        k = load.index(min(load))
        shards[k].append("tests/" + os.path.basename(f))
        load[k] += os.path.getsize(f)
    procs = []
    for k, fl in enumerate(shards, 1):
        log = logd / f"backend_s{k}.log"
        p = spawn([PY, "-m", "pytest", "-o", "addopts=", "-q", "-p", "no:cacheprovider", "-rfE", "--basetemp", str(logd / f"tmp_b{k}")] + fl, bd, log)
        procs.append((k, p, log))
    return procs, len(files)


def parse_pytest(text):
    c = {}
    for line in reversed(text.splitlines()):
        if re.search(r"\bin [\d.]+s", line) and re.search(r"\b(passed|failed|error)", line):
            for n, w in re.findall(r"(\d+) (passed|failed|skipped|errors?|xfailed|xpassed|deselected)", line):
                c["error" if w == "errors" else w] = int(n)
            break
    fails = []
    for line in text.splitlines():
        m = re.match(r"(FAILED|ERROR) (\S+)(?: - (.*))?", line)
        if m:
            fails.append((m.group(2), (m.group(3) or "")))
    return c, fails


def backend_finish(procs, wt, logd):
    allfails = []
    tot = {"passed": 0, "failed": 0, "skipped": 0, "error": 0}
    for k, p, log in procs:
        try:
            p.wait(timeout=max(left(), 1))
        except subprocess.TimeoutExpired:
            item("backend", f"shard {k}", "FAIL", "timeout")
            count("backend", "fail")
        reap(p)
        text = log.read_text(errors="replace")
        c, fails = parse_pytest(text)
        for w in tot:
            tot[w] += c.get(w, 0)
        rc = p.returncode
        if not c:
            item("backend", f"shard {k}", "FAIL", "no pytest summary (crash or timeout); see " + log.name)
            count("backend", "fail")
        elif rc is not None:
            ran = c.get("passed", 0) + c.get("failed", 0) + c.get("error", 0)
            if rc not in (0, 1):
                item("backend", f"shard {k}", "FAIL", f"pytest exited with rc={rc} (interrupted / collection or usage error); see {log.name}")
                count("backend", "fail")
            elif ran == 0:
                item("backend", f"shard {k}", "FAIL", f"pytest ran zero tests (rc={rc}); see {log.name}")
                count("backend", "fail")
            elif rc == 1 and not fails:
                item("backend", f"shard {k}", "FAIL", f"pytest rc=1 but no FAILED/ERROR line was parsed; see {log.name}")
                count("backend", "fail")
        allfails += fails
    count("backend", "pass", tot["passed"])
    count("backend", "skipped", tot["skipped"])
    seen, uniq = set(), []
    for nid, why in allfails:
        if nid not in seen:
            seen.add(nid)
            uniq.append((nid, why))
    todo = []
    for nid, why in uniq:
        kr = known_reason("backend", nodeid=nid)
        if kr:
            count("backend", "known"); item("backend", nid, "KNOWN", kr)
        else:
            todo.append((nid, why))
    if todo and left() > 120:
        bd = wt / "smplwise_vms" / "backend"
        log = logd / "backend_retry.log"
        ids = [n for n, _ in todo]
        run([PY, "-m", "pytest", "-o", "addopts=", "-q", "-p", "no:cacheprovider", "-rfE", "--basetemp", str(logd / "tmp_bretry")] + ids, bd, log, timeout=900)
        _, still = parse_pytest(log.read_text(errors="replace"))
        still_ids = {n for n, _ in still}
        for nid, why in todo:
            if nid in still_ids:
                count("backend", "fail"); item("backend", nid, "FAIL", why or "failed twice")
            else:
                count("backend", "flaky"); item("backend", nid, "FLAKY", "failed in the shard run, passed alone")
    else:
        for nid, why in todo:
            count("backend", "fail"); item("backend", nid, "FAIL", (why or "") + " (no time left to retry)")


# ---------------------------------------------------------------- spec classification
DEV_HDR = re.compile(r"needs? the vite dev|on the vite dev|drives the app on the vite dev", re.I)
SRC_IMPORT = re.compile(r"""['"`]/src['"`/]""")
ALL_PROJECTS = ["desktop", "tablet", "mobile"]


def classify(fe, tier):
    out = {"rest": {}, "dev": {}, "fixture": {}, "pixel": [], "fixture_other": {}}
    for f in sorted((fe / "tests").glob("*.spec.ts")):
        if tier == "S" and not f.name.startswith("unit-"):
            continue
        text = f.read_text(errors="replace")
        header = "\n".join(text.splitlines()[:70])
        flags = list(dict.fromkeys(re.findall(r"--project=(desktop|tablet|mobile)", header)))
        one = re.search(r"one project", header, re.I) is not None
        workers1 = "--workers=1" in header
        fixtures = re.findall(r"fixtures/(\w+)\.py", header)
        dev = bool(DEV_HDR.search(header) and "fresh build" not in header) or bool(SRC_IMPORT.search(text))
        if f.name in FIXTURE_SPECS and tier == "L":
            kind, projs = "fixture", (flags or ALL_PROJECTS)
        elif dev:
            kind, projs = "dev", (flags or ["desktop"])
            if one:
                projs = projs[:1]
        else:
            kind = "rest"
            projs = (flags[:1] or ["desktop"]) if one else ALL_PROJECTS
        if fixtures and f.name not in FIXTURE_SPECS:
            out["fixture_other"][f.name] = fixtures[0]
        if "toHaveScreenshot(" in text and not (VISUAL and f.name == "visual-matrix.spec.ts"):  # the visual step owns that spec
            out["pixel"].append(f.name)
        out[kind][f.name] = {"projects": projs, "workers1": workers1, "one": one}
    return out


def collect_pw(json_path):
    """Parse the Playwright JSON report into [{file,line,project,title,status,error}]; None when there is no report."""
    try:
        d = json.loads(Path(json_path).read_text())
    except Exception:
        return None
    rows = []

    def walk(suite, path):
        t = path + ([suite["title"]] if suite.get("title") and not suite["title"].endswith((".ts", ".js")) else [])
        for sp in suite.get("specs", []):
            for tst in sp.get("tests", []):
                res = tst.get("results") or [{}]
                last = res[-1]
                st = tst.get("status")
                err = ""
                if st == "unexpected":
                    e = (last.get("error") or {}).get("message", "") or ((last.get("errors") or [{}])[0].get("message", ""))
                    e = re.sub(r"\x1b\[[0-9;]*m", "", e).strip()
                    err = e.splitlines()[0][:200] if e else str(last.get("status") or "failed")
                ann = [a.get("type") for a in tst.get("annotations", [])]
                rows.append({"file": os.path.basename(sp.get("file", "")), "line": sp.get("line"), "project": tst.get("projectName"),
                             "title": " > ".join(x for x in t + [sp.get("title", "")] if x), "status": st, "error": err,
                             "norun": st == "skipped" and "skip" not in ann and "fixme" not in ann})
        for s in suite.get("suites", []):
            walk(s, t)

    for s in d.get("suites", []):
        walk(s, [])
    return rows


def pw_load_errors(json_path):
    """Top-level errors of a Playwright JSON report (load/transpile failures, global setup errors): a list of one-line messages."""
    try:
        d = json.loads(Path(json_path).read_text())
    except Exception:
        return []
    out = []
    for e in d.get("errors") or []:
        m = re.sub(r"\x1b\[[0-9;]*m", "", (e or {}).get("message", "") or str(e)).strip()
        out.append(m.splitlines()[0][:160] if m else "unknown error")
    return out


def file_arg(name, line=None):
    return "tests/" + name.replace(".", "\\.") + (f":{line}" if line else "$")


def run_pw(fe, specs, projects, base_url, logd, label, env=None, workers=None, grep=None, grep_invert=None, line_args=None, timeout=None):
    jp = logd / f"pw_{label}.json"
    if jp.exists():
        jp.unlink()
    e = {"SW_BASE_URL": base_url, "PLAYWRIGHT_JSON_OUTPUT_NAME": str(jp)}
    e.update(env or {})
    cmd = ["npx", "playwright", "test"] + (line_args if line_args is not None else [file_arg(s) for s in specs])
    cmd += [f"--project={p}" for p in projects] + [f"--workers={workers or PW_WORKERS}", "--reporter=list,json"]
    if grep:
        cmd += ["-g", grep]
    if grep_invert:
        cmd += ["--grep-invert", grep_invert]
    rc, to = run(cmd, fe, logd / f"pw_{label}.log", env=e, timeout=timeout)
    return collect_pw(jp), rc, to


def ident_of(r):
    return f"{r['file']}:{r['line']} [{r['project']}] {r['title']}"


def settle(cat, rows, rc, to, fe, logd, base_url, retry_env, label):
    """Count a Playwright result set: known / retry once alone / flaky / fail. A test that "did not run" because an earlier test
    of its serial group failed is never counted as skipped: its file is re-run alone with the failed one."""
    if rows is None:
        count(cat, "fail")
        item(cat, f"{label}: no report", "FAIL", "Playwright produced no JSON report" + (" (timeout)" if to else f" (rc={rc})") + f"; see pw_{label}.log")
        return
    # FALSE-GREEN GUARDS: an empty or error-carrying report is never "nothing failed"
    lerrs = pw_load_errors(logd / f"pw_{label}.json")
    if lerrs:
        count(cat, "fail")
        item(cat, f"{label}: load error", "FAIL", f"{len(lerrs)} load/transpile error(s) in the Playwright report, first: {lerrs[0]}; see pw_{label}.log")
    if to:
        count(cat, "fail")
        item(cat, f"{label}: timeout", "FAIL", f"Playwright hit the time limit (rc={rc}); the report is incomplete; see pw_{label}.log")
    elif not rows:
        count(cat, "fail")
        item(cat, f"{label}: zero tests", "FAIL", f"Playwright reported 0 tests (rc={rc}); a process that runs nothing is not a pass; see pw_{label}.log")
    elif rc not in (0, 1):
        count(cat, "fail")
        item(cat, f"{label}: exit code", "FAIL", f"Playwright exited with rc={rc} (not 0/1); see pw_{label}.log")
    elif rc == 1 and not lerrs and not any(r["status"] == "unexpected" for r in rows):
        count(cat, "fail")
        item(cat, f"{label}: exit code", "FAIL", "Playwright exited with rc=1 but reported no failed test; see pw_{label}.log")
    failed, norun, known_files = [], [], set()
    for r in rows:
        if r["status"] == "skipped":
            if r.get("norun"):
                norun.append(r)
            else:
                count(cat, "skipped")
        elif r["status"] == "expected":
            count(cat, "pass")
        elif r["status"] == "flaky":
            count(cat, "flaky"); item(cat, ident_of(r), "FLAKY", "Playwright's own retry passed")
        else:
            kr = known_reason("playwright", file=r["file"], line=r["line"], project=r["project"], title=r["title"])
            if kr:
                count(cat, "known"); item(cat, ident_of(r), "KNOWN", kr)
                known_files.add((r["file"], r["project"]))
            else:
                failed.append(r)
    pend = []
    for r in norun:
        if (r["file"], r["project"]) in known_files:
            count(cat, "skipped"); item(cat, ident_of(r), "SKIPPED_NOT_RUN", "an earlier test of its serial group failed (known issue)")
        else:
            pend.append(r)
    if not failed and not pend:
        return
    if left() < 180:
        for r in failed:
            count(cat, "fail"); item(cat, ident_of(r), "FAIL", r["error"] + " (no time left to retry)")
        for r in pend:
            count(cat, "fail"); item(cat, ident_of(r), "FAIL", "did not run (no time left to retry)")
        return
    whole = {(r["file"], r["project"]) for r in pend}
    byproj = {}
    for r in failed + pend:
        byproj.setdefault(r["project"], []).append(r)
    for proj, lst in byproj.items():
        args = sorted({file_arg(r["file"]) if (r["file"], proj) in whole else file_arg(r["file"], r["line"]) for r in lst})
        rows2, rc2, to2 = run_pw(fe, None, [proj], base_url, logd, f"{label}_retry_{proj}", env=retry_env, workers=1, line_args=args, timeout=min(1500, left()))
        res2 = {(r2["file"], r2["line"]): r2 for r2 in (rows2 or [])}
        for r in lst:
            r2 = res2.get((r["file"], r["line"]))
            good = r2 is not None and r2["status"] in ("expected", "flaky")
            if r in pend:
                if good:
                    count(cat, "pass")
                elif r2 is not None and r2["status"] == "skipped" and not r2.get("norun"):
                    count(cat, "skipped")
                else:
                    count(cat, "fail"); item(cat, ident_of(r), "FAIL", "did not run in the full run (a serial group stopped) and not verified alone: " + (r2["error"] if r2 and r2["error"] else "no result"))
            elif good:
                count(cat, "flaky"); item(cat, ident_of(r), "FLAKY", "failed in the full run (" + r["error"][:120] + "), passed alone")
            elif r2 is None and (to2 or rows2 is None):
                # the retry process was stopped (time budget) or wrote no report: nothing was verified, say so (0.1.162 gate said "failed again")
                count(cat, "fail"); item(cat, ident_of(r), "FAIL", r["error"] + " (retry alone not completed: " + ("time limit" if to2 else f"no report, rc={rc2}") + ")")
            else:
                count(cat, "fail"); item(cat, ident_of(r), "FAIL", r["error"] + " (failed again alone)")


def group_by_run(table):
    g = {}
    for name, v in table.items():
        key = (tuple(sorted(v["projects"], key=ALL_PROJECTS.index)), v["workers1"])
        g.setdefault(key, []).append(name)
    return g


_COSTS = None


def prior_costs():
    """Seconds per spec file from the earlier gates' Playwright reports (summed over tests and projects, the retry reports
    excluded; per file the newest gate that ran it wins, the last 10 gates are read): the weights the `--workers=1` chunks are
    balanced by. {} when there is no earlier gate."""
    global _COSTS
    if _COSTS is not None:
        return _COSTS
    _COSTS = {}
    mine = f"gate_{TAG}_{STATE['sha']}.logs"
    dirs = sorted((d for d in RES.glob("gate_*.logs") if d.is_dir() and d.name != mine), key=lambda d: d.stat().st_mtime, reverse=True)
    for d in dirs[:10]:
        costs = {}
        for jp in d.glob("pw_*.json"):
            if "_retry_" in jp.name:
                continue
            try:
                rep = json.loads(jp.read_text())
            except Exception:
                continue

            def walk(s):
                for sp in s.get("specs", []):
                    f = os.path.basename(sp.get("file", ""))
                    for t in sp.get("tests", []):
                        costs[f] = costs.get(f, 0.0) + sum((r.get("duration") or 0) for r in t.get("results", [])) / 1000.0
                for c in s.get("suites", []):
                    walk(c)
            for s in rep.get("suites", []):
                walk(s)
        for f, v in costs.items():
            _COSTS.setdefault(f, v)
    return _COSTS


def balance(names, n):
    """Split spec files into n chunks of about equal expected time (longest first onto the lightest chunk). A file without a
    recorded time weighs the median of the known ones. 0.1.162 gate: round-robin put the heaviest layout sweeps into one chunk
    (46 min against 16 and 27) and the run ran out of its budget."""
    costs = prior_costs()
    known = sorted(costs[x] for x in names if x in costs)
    dflt = known[len(known) // 2] if known else 60.0
    bins = [[0.0, i, []] for i in range(n)]
    for name in sorted(names, key=lambda x: (-costs.get(x, dflt), x)):
        b = min(bins, key=lambda b: (b[0], b[1]))
        b[0] += costs.get(name, dflt)
        b[2].append(name)
    return [sorted(b[2]) for b in bins]


def run_groups(cat, table, fe, logd, base_url, grep_invert=None):
    """Run the spec groups of one server side by side (a `--workers=1` group does not hold the others back; every group is
    its own Playwright process on the same server), then settle each: known / retry alone / flaky / fail."""
    groups = []
    for (projs, w1), names in group_by_run(table).items():
        # a "--workers=1" header keeps ONE worker per Playwright process; a big such group is split into up to 3 processes
        # (files are independent in demo mode) so it does not serialise the whole run, balanced by the previous gate's times
        n = min(3, max(1, len(names) // 4)) if w1 else 1
        chunks = balance(names, n) if n > 1 else [names]
        for i, part in enumerate(chunks):
            if part:
                groups.append(((projs, w1, i if n > 1 else None), part))
    status("running", f"Playwright {cat}: {len(groups)} process(es), {len(table)} files")

    def one(g):
        (projs, w1, chunk), names = g
        lab = f"{cat}_{'-'.join(projs)}{'_w1' if w1 else ''}{'' if chunk is None else '_c%d' % chunk}"
        rows, rc, to = run_pw(fe, names, projs, base_url, logd, lab, workers=1 if w1 else None, grep_invert=grep_invert, timeout=left())
        return lab, rows, rc, to

    with cf.ThreadPoolExecutor(max_workers=max(1, len(groups))) as ex:
        futs = [ex.submit(one, g) for g in groups]
        results = [fu.result() for fu in futs]     # wait for ALL groups: the retries below then really run alone
    for lab, rows, rc, to in results:
        settle(cat, rows, rc, to, fe, logd, base_url, {}, lab)


def start_vite(fe, mode, port, logd, api_port):
    args = ["npx", "vite"] + (["preview"] if mode == "preview" else []) + ["--host", "127.0.0.1", "--port", str(port), "--strictPort"]
    p = spawn(args, fe, logd / f"vite_{mode}_{port}.log", env={"SW_API_PORT": str(api_port)})
    ok = wait_http(f"http://127.0.0.1:{port}/", 90)
    return p, ok


def summarize_visual(rows):
    """rows = visual.mjs results.json. Returns {pass, diff, error, nobase, diffs:[label,...]}."""
    c = {"pass": 0, "diff": 0, "error": 0, "nobase": 0, "diffs": []}
    for r in rows:
        st = r.get("status")
        if st == "pass":
            c["pass"] += 1
        elif st == "no-baseline":
            c["nobase"] += 1
        else:
            c["error" if st == "error" else "diff"] += 1
            c["diffs"].append(f"{r.get('screen')} / {r.get('state')} / {r.get('scheme')} / {r.get('project')}")
    return c


def run_visual(wt, fe, base_url, logd):
    """Optional M074 step: the visual matrix for the screens this branch touches (vs VISUAL_BASE) against the committed linux baselines.
    Warn mode (default) never changes the verdict: differences are a report section only. Block mode counts them as failures."""
    out = logd / "visual"
    rc, to = run(["node", "scripts/visual.mjs", "run", "--touched", "--base", VISUAL_BASE, "--out", str(out)], fe, logd / "visual.log",
                 env={"SW_BASE_URL": base_url}, timeout=min(1500, left()))
    rj = out / "results.json"
    if not rj.exists():
        txt = (logd / "visual.log").read_text(errors="replace") if (logd / "visual.log").exists() else ""
        if "no screen is touched" in txt:
            VISUAL_INFO.update(mode=VISUAL, touched=0, summary="no screen touched by this change")
            return
        VISUAL_INFO.update(mode=VISUAL, error=f"visual.mjs produced no results (rc={rc}, timeout={to}); see visual.log")
        if VISUAL == "block":
            count("visual", "fail"); item("visual", "visual matrix", "FAIL", VISUAL_INFO["error"])
        return
    c = summarize_visual(json.loads(rj.read_text()))
    VISUAL_INFO.update(mode=VISUAL, base=VISUAL_BASE, counts={k: v for k, v in c.items() if k != "diffs"}, diffs=c["diffs"], report=str(out / "summary.md"), html=str(out / "index.html"))
    if VISUAL == "block":
        count("visual", "pass", c["pass"]); count("visual", "skipped", c["nobase"])
        for d in c["diffs"]:
            count("visual", "fail"); item("visual", d, "FAIL", "pixel difference vs baseline (see visual/index.html)")


def load_baseline(wt=None):
    """gate_baselines.json of the branch under test (scripts/gate/), else the copy next to this script. Returns (dict, source)."""
    cands = ([Path(wt) / "scripts" / "gate" / BASELINE_NAME] if wt else []) + [HERE / BASELINE_NAME]
    for c in cands:
        try:
            return json.loads(c.read_text()), str(c)
        except Exception:
            continue
    return {}, ""


def passed_of(cat):
    v = COUNTS.get(cat) or {}
    return v.get("pass", 0) + v.get("flaky", 0)       # flaky = failed once, passed alone: it did run and pass


def check_baselines(baseline, tier):
    """Compare every baselined category's passed count with the previous accepted release. Returns warnings (strings)."""
    BASELINE_ROWS.clear()
    warns = []
    base = (baseline or {}).get("tiers", {}).get(tier)
    if not base:
        warns.append(f"no baseline for tier {tier}: the count-drop check was NOT applied")
        return warns
    for cat, exp in base.items():
        act = passed_of(cat)
        ratio = (act / exp) if exp else 1.0
        low = act < DROP_THRESHOLD * exp
        state = "ok"
        if low and ALLOW_DROP:
            state = "waived"
            item("baseline", cat, "WAIVED", f"{act} passed vs baseline {exp} ({ratio:.0%}) - waived by --allow-count-drop: {ALLOW_DROP}")
        elif low:
            state = "low"
            count("baseline", "fail")
            item("baseline", cat, "FAIL", f"{act} passed vs baseline {exp} ({ratio:.0%}), below {DROP_THRESHOLD:.0%}: a suite that lost most of its tests is not a pass "
                 f"(re-run with --allow-count-drop \"<reason>\" only when the drop is intended)")
        BASELINE_ROWS[cat] = {"baseline": exp, "actual": act, "ratio": round(ratio, 3), "state": state}
    for cat in COUNTS:
        if cat not in base and cat != "baseline":
            warns.append(f"category {cat} has no baseline entry")
    return warns


def write_reports(sha, verdict, extra):
    fin = now()
    dur = int(time.time() - T0)
    base = RES / f"gate_{TAG}_{sha}"
    doc = {"branch": BR, "sha": sha, "tier": TIER, "verdict": verdict, "time_dependent_known": len(TIMEDEP), "started": STARTED, "finished": fin, "wall_seconds": dur,
           "counts": COUNTS, "baseline_check": BASELINE_ROWS, "drop_threshold": DROP_THRESHOLD, "count_drop_waiver": ALLOW_DROP,
           "baseline_candidate": {k: passed_of(k) for k in COUNTS if k != "baseline"},
           "phases": PHASES, "items": ITEMS, **extra}
    write_json(Path(str(base) + ".json"), doc)
    heb = "עבר" if verdict == "pass" else "נכשל"
    md = [f"# שער שחרור: {BR} @ {sha}", "", f"## פסק דין: **{heb}**", "",
          f"- דרגה: {TIER} | התחלה: {STARTED} | סיום: {fin} | משך: {dur // 60} דקות {dur % 60} שניות", ""]
    if TIMEDEP:
        md += [f"> **אזהרה:** {len(TIMEDEP)} בדיקות תלויות-שעה (שעות שקט) נכשלו בגלל שעת ההרצה ולכן סומנו KNOWN ולא נבדקו באמת. להריץ את השער שוב בשעות היום לפני שחרור.", ""]
    if ALLOW_DROP:
        md += [f"> **אזהרה:** בדיקת ירידת הספירה נוטרלה ב-`--allow-count-drop`: {ALLOW_DROP}", ""]
    md += ["## ספירה לפי קטגוריה", "", f"| קטגוריה | עבר | נכשל | FLAKY | KNOWN | דולג | בסיס (שחרור קודם) | יחס (סף {DROP_THRESHOLD:.0%}) |", "|---|---|---|---|---|---|---|---|"]
    zero = {"pass": 0, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
    for k in list(COUNTS) + [c for c in BASELINE_ROWS if c not in COUNTS]:
        v = COUNTS.get(k, zero)
        b = BASELINE_ROWS.get(k)
        bcols = f"{b['baseline']} | {b['ratio']:.0%} ({b['state']})" if b else "- | -"
        md.append(f"| {k} | {v['pass']} | {v['fail']} | {v['flaky']} | {v['known']} | {v['skipped']} | {bcols} |")
    for w in extra.get("baseline_warnings", []):
        md += ["", f"> אזהרה: {w}"]
    md += ["", "## שלבים", ""] + [f"- {p['name']}: {p['seconds']} שניות" for p in PHASES]
    for st, title in (("FAIL", "נכשלו"), ("WAIVED", "ויתור מפורש"),("FLAKY", "FLAKY (נכשל ועבר בהרצה חוזרת בודדת)"), ("KNOWN", "KNOWN (ברשימת הבעיות המוכרות)"), ("SKIPPED", "דולגו")):
        lst = [i for i in ITEMS if i["status"].startswith(st)]
        md += ["", f"## {title}: {len(lst)}", ""]
        md += [f"- [{i['category']}] {i['id']}" + (f" - {i['reason']}" if i["reason"] else "") for i in lst] or ["- (אין)"]
    if VISUAL_INFO:
        v = VISUAL_INFO
        md += ["", f"## ויזואלי (M074, מצב {v.get('mode')}{' - לא חוסם' if v.get('mode') == 'warn' else ''})", ""]
        if v.get("error"):
            md += [f"> אזהרה: {v['error']}"]
        elif "counts" in v:
            c = v["counts"]
            md += [f"- עבר {c['pass']} | שונה {c['diff']} | שגיאה {c['error']} | בלי baseline {c['nobase']} | מול {v.get('base')}", f"- דוח: {v.get('report')} (index.html לצידו)"]
            md += [f"> אזהרה: הבדל ויזואלי: {d}" for d in v.get("diffs", [])]
        else:
            md += [f"- {v.get('summary')}"]
    if "release_check_output" in extra:
        md += ["", "## release_check", "", "```", extra["release_check_output"][-4000:], "```"]
    if "classification" in extra:
        md += ["", "## סיווג אוטומטי של ה-specs", ""] + [f"- {a}: {b}" for a, b in extra["classification"].items()]
    Path(str(base) + ".md").write_text("\n".join(md) + "\n")
    return fin, base


def compute_verdict(hard_fail):
    return "pass" if sum(v["fail"] for v in COUNTS.values()) == 0 and not hard_fail else "fail"


def main():
    RES.mkdir(exist_ok=True)
    STATE["sha"] = "?"
    status("running", "starting")

    def heartbeat():  # the dashboard calls a run "stuck" when gate_status.json is not rewritten for 15 minutes
        while not HB_STOP.wait(30):
            try:
                status("running")
            except Exception:
                pass

    threading.Thread(target=heartbeat, daemon=True).start()
    wt, sha = setup_worktree()
    STATE["sha"] = sha
    logd = RES / f"gate_{TAG}_{sha}.logs"
    logd.mkdir(exist_ok=True)
    for old in logd.glob("*"):
        if old.is_file():
            old.unlink()
    fe = wt / "frontend"
    extra = {}
    procs = None
    nbackend = 0
    hard_fail = []
    try:
        with Phase("modules", "node modules"):
            if not need_modules(wt, logd / "npm.log"):
                hard_fail.append("npm ci failed")
        if TIER in ("M", "L"):
            with Phase("backend-start", "backend: 3 shards started"):
                procs, nbackend = backend_start(wt, logd)
        with Phase("tsc", "tsc --noEmit"):
            rc, to = run(["npx", "tsc", "--noEmit"], fe, logd / "tsc.log", timeout=900)
            count("tsc", "pass" if rc == 0 else "fail")
            if rc != 0:
                item("tsc", "tsc --noEmit", "FAIL", f"rc={rc} (see tsc.log)")
        with Phase("build", "vite build"):
            rc, to = run(["npx", "vite", "build"], fe, logd / "build.log", timeout=900)
            count("build", "pass" if rc == 0 else "fail")
            if rc != 0:
                item("build", "vite build", "FAIL", f"rc={rc} (see build.log)")
        # 0.1.162 gate: release_check (seconds, reads the tree only) runs right after the build, before any Playwright run -
        # at the end it was starved by the budget (rc=124 without running) and it saw the docs the evidence specs rewrite
        with Phase("release_check", "release_check.py"):
            rlog = logd / "release_check.log"
            rc, to = run([PY, "scripts/release_check.py", "--root", ".", "--json", str(logd / "release_check.json")], wt, rlog, timeout=300)
            txt = rlog.read_text(errors="replace") if rlog.exists() else ""
            extra["release_check_output"] = txt
            extra["release_check_rc"] = rc
            count("release_check", "pass" if rc == 0 else "fail")
            if rc != 0:
                item("release_check", "scripts/release_check.py", "FAIL", f"rc={rc}; " + " | ".join(l.strip() for l in txt.splitlines() if re.search(r"fail|missing|differ", l, re.I))[:220])
        cls = classify(fe, TIER)
        extra["classification"] = {
            "rest": f"{len(cls['rest'])} spec files on the dist preview",
            "dev": f"{len(cls['dev'])} on the Vite dev server: " + ", ".join(f"{k}({'/'.join(v['projects'])})" for k, v in cls["dev"].items()),
            "fixture": f"{len(cls['fixture'])}: " + ", ".join(cls["fixture"]),
            "pixel": ", ".join(cls["pixel"]) or "-",
            "fixture needed but not in the gate routine (self-skip in the preview run)": ", ".join(f"{k}->{v}" for k, v in cls["fixture_other"].items()) or "-",
        }
        dead = free_port()   # nothing listens here: the app falls back to demo mode, as the specs' headers require
        if COUNTS.get("build", {}).get("pass", 0) == 1:
            if cls["rest"] or cls["pixel"]:
                with Phase("playwright-preview", "Playwright on the dist preview"):
                    port = free_port()
                    vp, ok = start_vite(fe, "preview", port, logd, dead)
                    base_url = f"http://127.0.0.1:{port}/"
                    if not ok:
                        item("preview", "vite preview", "FAIL", "did not start"); count("preview", "fail")
                    else:
                        run_groups("preview", cls["rest"], fe, logd, base_url, grep_invert="pixel-stable")
                        if TIER == "L":
                            for name in cls["pixel"]:
                                snap = fe / "tests" / f"{name}-snapshots"
                                has = snap.is_dir() and any(snap.glob("*-linux.png"))
                                if not has:
                                    count("pixel", "skipped"); item("pixel", name, "SKIPPED_NO_BASELINE", "no *-linux.png baseline in " + snap.name)
                                else:
                                    status("running", f"pixel baselines: {name}")
                                    rows, rc, to = run_pw(fe, [name], ["desktop", "mobile"], base_url, logd, "pixel", workers=1, grep="pixel-stable", timeout=left())
                                    settle("pixel", rows, rc, to, fe, logd, base_url, {}, "pixel")
                    reap(vp)
            # 0.1.162 gate: the fixture spec (about a minute) runs BEFORE the long dev-server sweep, so a slow sweep can no longer
            # starve it of the budget (it used to run last and got 3 s)
            if cls["fixture"]:
                with Phase("playwright-fixture", "Playwright with the fake-backend fixture"):
                    api = free_port(pair=True)
                    data = Path(tempfile.mkdtemp(prefix="gate_data_", dir=str(logd)))
                    fx = spawn([PY, "frontend/tests/fixtures/devices_fake_ha.py"], wt, logd / "fixture_devices.log",
                               env={"SW_PORT": str(api), "SW_DATA_DIR": str(data), "SW_DEV_USER": "joni", "SW_BOOTSTRAP_ADMIN": "joni"})
                    up = wait_http(f"http://127.0.0.1:{api}/healthz", 90)
                    port = free_port()
                    vp, ok = (None, False)
                    if up:
                        vp, ok = start_vite(fe, "preview", port, logd, api)
                    if not (up and ok):
                        count("fixture", "fail"); item("fixture", "fake backend / preview", "FAIL", f"did not start (fixture backend up={up} preview up={ok}); see fixture_devices.log")
                    else:
                        base_url = f"http://127.0.0.1:{port}/"
                        fenv = {"SW_LIVE": "1", "SW_DEVICES_FIXTURE": "1", "SW_API_PORT": str(api)}
                        for (projs, w1), names in group_by_run(cls["fixture"]).items():
                            lab = f"fixture_{'-'.join(projs)}"
                            status("running", f"Playwright fixture specs: {', '.join(names)}")
                            rows, rc, to = run_pw(fe, names, projs, base_url, logd, lab, env=fenv, workers=1, timeout=left())
                            settle("fixture", rows, rc, to, fe, logd, base_url, fenv, lab)
                    if vp:
                        reap(vp)
                    reap(fx)
            if VISUAL:
                with Phase("visual-matrix", "M074 visual matrix (--touched)"):
                    port = free_port()
                    vp, ok = start_vite(fe, "preview", port, logd, dead)
                    if not ok:
                        VISUAL_INFO.update(mode=VISUAL, error="vite preview did not start for the visual step")
                    else:
                        status("running", f"visual matrix ({VISUAL})")
                        run_visual(wt, fe, f"http://127.0.0.1:{port}/", logd)
                    reap(vp)
            if cls["dev"]:
                with Phase("playwright-dev", "Playwright on the Vite dev server"):
                    port = free_port()
                    vp, ok = start_vite(fe, "dev", port, logd, dead)
                    base_url = f"http://127.0.0.1:{port}/"
                    if not ok:
                        item("dev", "vite dev server", "FAIL", "did not start"); count("dev", "fail")
                    else:
                        run_groups("dev", cls["dev"], fe, logd, base_url)
                    reap(vp)
        else:
            hard_fail.append("build failed: Playwright not run")
        if procs:
            with Phase("backend-wait", "backend: collecting"):
                backend_finish(procs, wt, logd)
                procs = None
                extra["backend_files"] = nbackend
    except SystemExit as e:
        hard_fail.append(str(e))
    except BaseException as e:  # incl. the SIGTERM that `timeout` sends (turned into KeyboardInterrupt)
        hard_fail.append(("terminated (time budget)" if isinstance(e, KeyboardInterrupt) else type(e).__name__) + ": " + str(e)[:150])
    finally:
        kill_all()
    if left() < 0:
        hard_fail.append("90-minute budget exhausted: the run is incomplete")
    baseline, bsrc = load_baseline(wt)
    extra["baseline_file"] = bsrc or "(none found)"
    extra["baseline_warnings"] = check_baselines(baseline, TIER) if baseline else ["no gate_baselines.json found: the count-drop check was NOT applied"]
    verdict = compute_verdict(hard_fail)
    for h in hard_fail:
        item("gate", h, "FAIL", "")
    parts = [f"{k} {v['pass']}p/{v['fail']}f/{v['flaky']}flaky/{v['known']}known"
             + (f"/{BASELINE_ROWS[k]['ratio']:.0%}of-baseline" if k in BASELINE_ROWS else "") for k, v in COUNTS.items()]
    if ALLOW_DROP:
        parts.append("count-drop check WAIVED")
    dur = int(time.time() - T0)
    summary = f"{'PASS' if verdict == 'pass' else 'FAIL'} in {dur // 60}m: " + "; ".join(parts)
    if VISUAL_INFO.get("diffs") and VISUAL != "block":
        summary += f" | WARNING (non-blocking): {len(VISUAL_INFO['diffs'])} visual difference(s), see the report's visual section"
    if TIMEDEP:
        summary += f" | WARNING: {len(TIMEDEP)} time-of-day (quiet hours) tests not really verified, re-run in daytime"
    if hard_fail:
        summary += " | " + "; ".join(hard_fail)[:160]
    fin, base = write_reports(sha, verdict, extra)
    HB_STOP.set()
    STATE["phase"] = "done"
    status("pass" if verdict == "pass" else "fail", summary, finished=fin)
    print(summary)
    print(f"report: {base}.md")
    return 0 if verdict == "pass" else 1


def on_term(sig, frm):
    raise KeyboardInterrupt(f"signal {sig}")


def main_cli(argv):
    global BR, TIER, TAG, ALLOW_DROP, VISUAL, VISUAL_BASE
    args = list(argv)
    while args:
        a = args.pop(0)
        if a == "--tier":
            TIER = args.pop(0) if args else "L"
        elif a == "--allow-count-drop":
            ALLOW_DROP = (args.pop(0) if args else "").strip()
            if not ALLOW_DROP:
                print('--allow-count-drop needs a reason, e.g. --allow-count-drop "removed the legacy specs on purpose"')
                return 2
        elif a == "--visual":
            VISUAL = "warn"
        elif a == "--no-visual":
            VISUAL = ""
        elif a == "--visual-block":
            VISUAL = "block"
        elif a == "--visual-base":
            VISUAL_BASE = args.pop(0) if args else VISUAL_BASE
        elif a in ("-h", "--help"):
            print(__doc__)
            return 0
        else:
            BR = a
    if not BR:
        print('usage: release_gate.sh <branch> [--tier S|M|L] [--allow-count-drop "<reason>"] [--visual | --visual-block | --no-visual] [--visual-base <ref>]')
        return 2
    if TIER not in ("S", "M", "L"):
        print("tier must be S, M or L")
        return 2
    TAG = re.sub(r"[^A-Za-z0-9._-]", "-", BR)
    signal.signal(signal.SIGTERM, on_term)
    try:
        return main()
    except SystemExit:
        raise
    except BaseException as e:
        HB_STOP.set()
        kill_all()
        status("fail", "gate crashed: " + (type(e).__name__ + " " + str(e))[:200], finished=now())
        raise


if __name__ == "__main__":
    sys.exit(main_cli(sys.argv[1:]))
