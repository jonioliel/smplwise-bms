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

Partial runs for the nightly (scripts/gate/nightly_tests.sh drives this engine; a release gate never sets them):
  GATE_SKIP_BACKEND=1   no backend shards (nightly --frontend-only); GATE_SKIP_DEV=1  no dev-server Playwright phase (--no-dev).
  A skipped category is left out of the baseline check (named in the warnings), so a partial run is not "0 of N".
  GATE_COSTS_DIR=<dir>  a second results directory whose gate_*.logs also feed the --workers=1 chunk balance (the nightly writes
  its reports to its own directory and borrows the release gates' per-file times).

Timing lane (GATELANES-297, docs/testing/GATE_LANES.md): tests tagged '@timing-lane' (Playwright) or marked timing_lane (pytest) are
left out of every gate and nightly run here; GATE_LANE=timing (set by timing_lane.sh only) runs ONLY them, non-blocking, after a gate.

Schedules (GATESPEED-293, docs/release/GATE_SPEED.md). `--schedule v1` (the default, GATE_SCHEDULE unset) is the 2.9.2 gate
unchanged. `--schedule v2` (or GATE_SCHEDULE=v2) keeps every spec, project, server kind, retry rule and false-green guard, and
only changes WHEN and HOW WIDE things run:
  * backend: GATE_BACKEND_SHARDS shards (v2: 6) balanced by the earlier gates' per-file pytest times (junit XML that v2 writes
    next to each shard log; seed `backend_seconds` in gate_durations.json; file size scaled to seconds otherwise); passed tests'
    tmp_path dirs are removed at teardown (tmp_path_retention_policy=failed); GATE_BACKEND_TMPFS=1 (v2 default) puts the shards'
    basetemp and TMPDIR on /dev/shm when it has GATE_TMPFS_MIN_GB (4) free, else on disk as in v1;
  * Playwright: the preview groups, the dev-server groups, the pixel specs, the fixture spec and the visual step are ONE pool of
    jobs under a worker budget (GATE_PW_SLOTS, 12), longest first; --workers=1 groups split into up to GATE_W1_MAX_CHUNKS (8)
    chunks of about GATE_CHUNK_TARGET_SECS (1500) each, parallel groups get up to GATE_PW_MAX_WORKERS (6) workers; every
    failure is retried alone AFTER the pool drained (the v1 rule).
`--plan --root <checkout>` prints the v1 and v2 plans with time estimates from the recorded costs and runs nothing.
"""
import concurrent.futures as cf, glob, json, math, os, re, shutil, signal, socket, subprocess, sys, tempfile, threading, time, urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

HB_STOP = threading.Event()
ABORT = threading.Event()   # set when main() leaves its run section (normally or by a signal) right before kill_all()

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
DURATIONS_NAME = "gate_durations.json"   # tracked seed of seconds per spec file (lowest priority in prior_costs())
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
# GATE-FAST-2291: per-phase budgets + lateness report (gate_budget.py) and the early layout stage (gate_early_layout.json); both optional files
try:
    sys.path.insert(0, str(HERE))
    import gate_budget as GB
except Exception:   # noqa: BLE001 - the engine runs without budgets when the helper is not installed next to it
    GB = None
BUDGETS = {}        # phase name -> {budget_s, source}, filled in main()
LATE = []           # lateness notes (gate_budget.late_note), reported at once in gate_status.json and at the end in the report
LATE_SEEN = set()   # phases already reported while running
EARLY = {}          # early layout stage facts (specs, seconds, failures, stopped), written to the report
EARLY_FILE = "gate_early_layout.json"
TAG = ""
PW_WORKERS = os.environ.get("GATE_PW_WORKERS", "3")
SKIP_BACKEND = os.environ.get("GATE_SKIP_BACKEND") == "1"
SKIP_DEV = os.environ.get("GATE_SKIP_DEV") == "1"
SKIPPED_CATS = ({"backend"} if SKIP_BACKEND else set()) | ({"dev"} if SKIP_DEV else set())
# GATELANES-297 timing lane (docs/testing/GATE_LANES.md). Wall-clock / load-sensitive tests carry a Playwright tag (LANE_TAG) or a
# pytest mark (LANE_MARK). A release gate or the nightly (GATE_LANE unset) never runs them: pytest -m "not timing_lane", Playwright
# --grep-invert @timing-lane. GATE_LANE=timing (set only by timing_lane.sh, its own results directory) runs ONLY them: no
# release_check, no visual step, no pixel step, no count-baseline check; its verdict is a report and never reaches a release gate.
LANE_TAG = "@timing-lane"
LANE_MARK = "timing_lane"
LANE = (os.environ.get("GATE_LANE") or "").strip().lower() == "timing"
LANE_MARK_RE = re.compile(r"@pytest\.mark\.timing_lane\b")


def lane_pytest_args():
    """The pytest selection of this run: a gate deselects the timing lane, the lane selects only it."""
    return ["-m", LANE_MARK if LANE else f"not {LANE_MARK}"]


def lane_grep(grep, grep_invert):
    """(grep, grep_invert) of one Playwright run: a gate leaves the lane's tagged tests out, the lane runs only them."""
    if LANE:
        return LANE_TAG, None
    return grep, (f"{grep_invert}|{LANE_TAG}" if grep_invert else LANE_TAG)


def lane_backend_files(bd):
    """The backend test files that carry the timing_lane mark (the lane runs only these files)."""
    return {os.path.basename(f) for f in glob.glob(str(Path(bd) / "tests" / "test_*.py"))
            if LANE_MARK_RE.search(Path(f).read_text(encoding="utf-8", errors="replace"))}
COSTS_DIR = os.environ.get("GATE_COSTS_DIR") or ""
SELECT_BASE = os.environ.get("GATE_SELECT_BASE") or ""   # --select-base <ref>: diff-based selection (select_tests.py); "" = full tier
REDUCED_CATS = {}        # category -> "n of m files" when a selection left files out (filled by apply_selection())
SELECTION = {}           # the select_tests.py result of this run
# specs that need a fake backend and are part of the gate's routine; any other spec that needs a fixture self-skips in the
# preview run and is listed under "fixture needed but not in the gate routine"
# One source with scripts/fixture_job.py (the runner's `fixture` job): frontend/tests/fixtures/fixture_specs.json, the specs with
# "gate": true. When the JSON is not next to the script (the gate copy in ~/ on the runner) the built-in default is used; both give
# the same set, a test (test_fixture_job.py) pins that.
FIXTURE_SPECS = {"evidence-camera-card.spec.ts", "evidence-curved-walls.spec.ts", "evidence-curve-points.spec.ts"}   # CURVEDGATE-297
try:
    _fx = json.loads((HERE.parent.parent / "frontend" / "tests" / "fixtures" / "fixture_specs.json").read_text(encoding="utf-8"))["groups"]
    FIXTURE_SPECS = {n for g in _fx.values() for n, s in g["specs"].items() if s.get("gate")} or FIXTURE_SPECS
except (OSError, ValueError, KeyError):
    pass
SCHEDULE = (os.environ.get("GATE_SCHEDULE") or "v1").strip().lower()   # v1 = the 2.9.2 gate; v2 = GATESPEED-293 (--schedule)
_LOCK = threading.RLock()     # count()/item() are called from the v2 pool's threads too
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
    tmp = Path(f"{p}.{threading.get_ident()}.tmp")   # per thread: the heartbeat and a phase can write gate_status.json at once
    tmp.write_text(json.dumps(d, indent=1, ensure_ascii=False))
    os.replace(tmp, p)


def status(state, summary=None, finished=None):
    if summary is not None:
        STATE["summary"] = summary
    write_json(STATUS, {"branch": BR, "sha": STATE["sha"], "tier": TIER, "state": state, "phase": STATE["phase"],
                        "started": STARTED, "finished": finished, "updated": now(), "pid": os.getpid(),
                        "elapsed_s": int(time.time() - T0), "summary": STATE["summary"], "late": STATE.get("late", [])})


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
    if t < 20 or ABORT.is_set():   # ABORT: the gate is stopping; a v2 pool thread must not start a new process after kill_all()
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
    with _LOCK:
        COUNTS.setdefault(cat, {"pass": 0, "fail": 0, "flaky": 0, "known": 0, "skipped": 0})[key] += n


def item(cat, ident, st, reason=""):
    with _LOCK:
        ITEMS.append({"category": cat, "id": ident, "status": st, "reason": reason[:300]})


class Phase:
    def __init__(self, name, label):
        self.name, self.label = name, label

    def __enter__(self):
        STATE["phase"] = self.name
        self.t = time.time()
        STATE["phase_t0"] = self.t
        status("running", self.label)
        return self

    def __exit__(self, *a):
        secs = int(time.time() - self.t)
        ent = {"name": self.name, "seconds": secs}
        b = (BUDGETS.get(self.name) or {}).get("budget_s")
        if b:
            ent["budget_s"] = b
            if secs > b and GB:
                if self.name in LATE_SEEN:   # already reported while running: replace that note with the final one
                    LATE[:] = [n for n in LATE if n["phase"] != self.name]
                LATE.append(GB.late_note(self.name, secs, b, RESOURCES.get("max_load1"), RESOURCES.get("min_mem_available_mb")))
                ent["late_s"] = LATE[-1]["late_s"]
                note_late()
        PHASES.append(ent)
        return False


def note_late():
    """Publish the lateness notes at once in gate_status.json (dashboard) - the summary line carries the newest."""
    STATE["late"] = [n["en"] for n in LATE][-5:]
    status("running", LATE[-1]["en"] if LATE else None)


def check_running_phase_late():
    """Heartbeat hook: the phase that is running right now is already past its budget -> report it once, without waiting for its end."""
    name, t0 = STATE.get("phase"), STATE.get("phase_t0")
    b = (BUDGETS.get(name) or {}).get("budget_s") if name else None
    if not (GB and b and t0) or name in LATE_SEEN:
        return
    secs = int(time.time() - t0)
    if secs > b:
        LATE_SEEN.add(name)
        LATE.append(GB.late_note(name, secs, b, RESOURCES.get("max_load1"), RESOURCES.get("min_mem_available_mb"), running=True))
        note_late()


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
    wt = WORK / f"{'lane' if LANE else 'gate'}-{TAG}"   # the timing lane never shares (or resets) a gate's worktree
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
def backend_start(wt, logd, nshards=3, only=None):
    """only: a set of test file names (a --select-base run); None = every tests/test_*.py (the full tier)."""
    bd = wt / "smplwise_vms" / "backend"
    files = sorted(glob.glob(str(bd / "tests" / "test_*.py")), key=lambda f: -os.path.getsize(f))
    if only is not None:
        files = [f for f in files if os.path.basename(f) in only]
    shards = [[] for _ in range(nshards)]
    load = [0] * nshards
    for f in files:
        k = load.index(min(load))
        shards[k].append("tests/" + os.path.basename(f))
        load[k] += os.path.getsize(f)
    procs = []
    for k, fl in enumerate(shards, 1):
        if not fl:   # an empty shard would run pytest's testpaths (every file); the timing lane has two files
            continue
        log = logd / f"backend_s{k}.log"
        p = spawn([PY, "-m", "pytest", "-o", "addopts=", "-q", "-p", "no:cacheprovider", "-rfE", "--basetemp", str(logd / f"tmp_b{k}")]
                  + lane_pytest_args() + fl, bd, log)
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


# ---------------------------------------------------------------- quarantine (GATESPEED-293 phase 2)
QUARANTINE_CATS = ("backend", "preview", "dev", "pixel", "fixture")


def first_run_reds(items):
    """Test ids that failed on their first run in one gate (FLAKY = passed alone, FAIL = failed again); gate-level items
    (a shard, a process, a server) are not tests."""
    return {i["id"]: i["category"] for i in items if i.get("status") in ("FAIL", "FLAKY") and i.get("category") in QUARANTINE_CATS
            and ("::" in i["id"] or ".spec.ts:" in i["id"])}


def quarantine(history):
    """history = [(label, {id: category})], newest first (this gate first). A test is in quarantine when it failed on its first
    run in two consecutive gates, and stays until two consecutive gates ran it without a first-run failure. Quarantine never
    skips a test: it still runs, is retried once alone, and its result counts as usual; the list is the fix-ticket queue."""
    ids = {i: c for _, reds in history for i, c in reds.items()}
    out = []
    for tid, cat in ids.items():
        seq = [tid in reds for _, reds in history]
        pair = next((k for k in range(len(seq) - 1) if seq[k] and seq[k + 1]), None)
        if pair is None:
            continue
        last = seq.index(True)
        if last >= 2:          # two clean gates since the last first-run failure: released
            continue
        out.append({"id": tid, "category": cat, "gates": [lab for (lab, reds) in reversed(history) if tid in reds],
                    "streak_from": history[pair + 1][0]})
    return sorted(out, key=lambda e: (e["category"], e["id"]))


def gate_history(current_label, current_items, limit=10):
    """This gate plus the earlier release gates' reports in RES (gate_*.json with a verdict), newest first."""
    docs = []
    for p in RES.glob("gate_*.json"):
        if p.name.endswith(".selection.json") or p.name == STATUS.name:
            continue
        try:
            d = json.loads(p.read_text())
        except Exception:
            continue
        if "verdict" in d and "items" in d and f"{d.get('branch')}@{d.get('sha')}" != current_label:
            docs.append((d.get("finished") or "", f"{d.get('branch')}@{d.get('sha')}", first_run_reds(d["items"])))
    docs.sort(reverse=True)
    return [(current_label, first_run_reds(current_items))] + [(lab, reds) for _, lab, reds in docs[: limit - 1]]


# ---------------------------------------------------------------- diff-based selection (GATESPEED-293 phase 2, opt-in)
def compute_selection(wt, base):
    """select_tests.py (next to this script) on the worktree: base...HEAD. `base` is a ref name; origin/<base> is used when the
    worktree has no such local ref (the gate's worktree sees origin only)."""
    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    import select_tests
    ref = base
    if subprocess.run(["git", "-C", str(wt), "rev-parse", "--verify", "-q", f"{base}^{{commit}}"], capture_output=True).returncode != 0:
        ref = f"origin/{base}"
    return select_tests.select_diff(Path(wt), ref, "HEAD")


def backend_only(sel):
    """The backend file set of a selection, or None (full tier); notes the reduced category."""
    b = sel.get("backend") or {}
    if not sel or sel.get("error") or sel.get("full", {}).get("backend") or not b.get("dropped"):
        return None
    REDUCED_CATS["backend"] = f"{len(b['selected'])} of {b['total']} files"
    return set(b["selected"])


def filter_classification(cls, sel):
    """Keep only the selected spec files in every kind (rest / dev / fixture / pixel); notes the reduced categories."""
    f = sel.get("frontend") or {}
    if not sel or sel.get("error") or sel.get("full", {}).get("frontend") or not f.get("dropped"):
        return cls
    keep = set(f["selected"])
    for kind, cat in (("rest", "preview"), ("dev", "dev"), ("fixture", "fixture")):
        before = len(cls[kind])
        cls[kind] = {n: v for n, v in cls[kind].items() if n in keep}
        if len(cls[kind]) < before:
            REDUCED_CATS[cat] = f"{len(cls[kind])} of {before} spec files"
    before = len(cls["pixel"])
    cls["pixel"] = [n for n in cls["pixel"] if n in keep]
    if len(cls["pixel"]) < before:
        REDUCED_CATS["pixel"] = f"{len(cls['pixel'])} of {before} spec files"
    return cls


# ---------------------------------------------------------------- v2 schedule (GATESPEED-293): knobs and the backend shards
def knob(name, v1, v2, cast=int):
    """An integer/float knob: the environment wins, else the default of the active schedule (v1 = the 2.9.2 gate's value)."""
    raw = os.environ.get(name)
    if raw not in (None, ""):
        try:
            return cast(raw)
        except ValueError:
            pass
    return v2 if SCHEDULE == "v2" else v1


def _junit_file(classname):
    """'tests.test_x' / 'tests.test_x.TestY' -> 'test_x.py' (the backend tests are flat under tests/)."""
    parts = (classname or "").split(".")
    if parts and parts[0] == "tests":
        parts = parts[1:]
    return (parts[0] + ".py") if parts and parts[0] else ""


def junit_costs(path):
    """Seconds per test file from one pytest junit XML (setup + call + teardown, as pytest's default junit_duration_report)."""
    out = {}
    try:
        for _, el in ET.iterparse(str(path)):
            if el.tag == "testcase":
                f = _junit_file(el.get("classname", ""))
                try:
                    t = float(el.get("time") or 0)
                except ValueError:
                    t = 0.0
                if f:
                    out[f] = out.get(f, 0.0) + t
                el.clear()
    except (OSError, ET.ParseError):
        return {}
    return out


_BCOSTS = None


def backend_prior_costs():
    """Seconds per backend test file: the newest of the last 10 gates' backend_s*.xml wins per file, then the seed
    `backend_seconds` of gate_durations.json next to this script. {} when neither exists (the split then weighs by size)."""
    global _BCOSTS
    if _BCOSTS is not None:
        return _BCOSTS
    _BCOSTS = {}
    mine = f"gate_{TAG}_{STATE['sha']}.logs"
    roots = [RES] + ([Path(COSTS_DIR)] if COSTS_DIR and Path(COSTS_DIR).resolve() != RES.resolve() else [])
    dirs = sorted((d for r in roots if r.is_dir() for d in r.glob("gate_*.logs") if d.is_dir() and not (r == RES and d.name == mine)),
                  key=lambda d: d.stat().st_mtime, reverse=True)
    for d in dirs[:10]:
        costs = {}
        for xp in d.glob("backend_s*.xml"):
            for f, v in junit_costs(xp).items():
                costs[f] = costs.get(f, 0.0) + v
        for f, v in costs.items():
            if v > 0:
                _BCOSTS.setdefault(f, v)
    for f, v in (_seed().get("backend_seconds") or {}).items():
        if isinstance(v, (int, float)) and v > 0:
            _BCOSTS.setdefault(f, float(v))
    return _BCOSTS


def _seed():
    try:
        return json.loads((HERE / DURATIONS_NAME).read_text(encoding="utf-8"))
    except Exception:
        return {}


def split_backend(files, n, costs):
    """files = [(name, size_bytes)]. Longest-processing-time split into n shards: a file's weight is its recorded seconds, else
    its size times the median seconds-per-byte of the timed files, else its size (the v1 rule). Returns [(names, weight)]."""
    ratios = sorted(costs[f] / s for f, s in files if f in costs and s > 0)
    rate = ratios[len(ratios) // 2] if ratios else None
    weight = {f: (costs[f] if f in costs else (s * rate if rate else float(s))) for f, s in files}
    bins = [[0.0, i, []] for i in range(max(1, n))]
    for f in sorted(weight, key=lambda x: (-weight[x], x)):
        b = min(bins, key=lambda b: (b[0], b[1]))
        b[0] += weight[f]
        b[2].append(f)
    return [(sorted(b[2]), b[0]) for b in bins]


def tmpfs_root(tag):
    """A fresh directory on /dev/shm for the backend scratch, or None (no tmpfs, not writable, or under GATE_TMPFS_MIN_GB free)."""
    shm = Path(os.environ.get("GATE_TMPFS_DIR", "/dev/shm"))
    try:
        st = os.statvfs(shm)
        # a gate killed by `timeout -k` leaves its scratch behind; the gate holds the gate lock and the tests lock exclusively,
        # so no other engine can be using one of these right now
        for old in shm.glob("smplwise-gate-*"):
            shutil.rmtree(old, ignore_errors=True)
        st = os.statvfs(shm)
        if st.f_bavail * st.f_frsize < knob("GATE_TMPFS_MIN_GB", 4, 4, float) * 1e9:
            return None
        d = Path(tempfile.mkdtemp(prefix=f"smplwise-gate-{tag}-", dir=str(shm)))
        return d
    except (OSError, AttributeError):
        return None


def backend_cmd(names, logd, k, basetemp, v2):
    cmd = [PY, "-m", "pytest", "-o", "addopts=", "-q", "-p", "no:cacheprovider", "-rfE", "--basetemp", str(basetemp)] + lane_pytest_args()
    if v2:   # per-file times for the next gate's split; a passed test's tmp_path is removed at its teardown
        cmd += ["-o", "tmp_path_retention_policy=failed", "--junitxml", str(logd / f"backend_s{k}.xml")]
    return cmd + ["tests/" + x for x in names]


def backend_start_v2(wt, logd, n, shm=None, only=None):
    """The v2 shards: the same pytest command as v1 (plus junit XML and the tmp_path retention), n shards balanced by time.
    With `shm` the basetemp and TMPDIR of every shard live there (one filesystem, as /tmp and the home are on the runner)."""
    bd = wt / "smplwise_vms" / "backend"
    files = [(os.path.basename(f), os.path.getsize(f)) for f in sorted(glob.glob(str(bd / "tests" / "test_*.py")))]
    if only is not None:
        files = [(f, s) for f, s in files if f in only]
    parts = split_backend(files, n, backend_prior_costs())
    procs, plan = [], []
    for k, (names, w) in enumerate(parts, 1):
        if not names:
            continue
        env = {}
        base = logd
        if shm:
            base = shm / f"s{k}"
            (base / "tmp").mkdir(parents=True, exist_ok=True)
            env["TMPDIR"] = str(base / "tmp")
        log = logd / f"backend_s{k}.log"
        p = spawn(backend_cmd(names, logd, k, base / f"tmp_b{k}", True), bd, log, env=env)
        procs.append((k, p, log))
        plan.append({"shard": k, "files": len(names), "weight": round(w, 1)})
    return procs, len(files), plan


def last_backend_seconds():
    """Summed pytest wall seconds of the newest gate's shards ('in 9051.15s'), else the seed's backend_shard_seconds_total."""
    dirs = sorted((d for d in RES.glob("gate_*.logs") if d.is_dir() and list(d.glob("backend_s*.log"))) if RES.is_dir() else [],
                  key=lambda d: d.stat().st_mtime, reverse=True)
    for d in dirs[:1]:
        tot = 0.0
        for lg in d.glob("backend_s*.log"):
            m = re.findall(r" in ([\d.]+)s", lg.read_text(errors="replace"))
            tot += float(m[-1]) if m else 0.0
        if tot:
            return tot, d.name
    v = _seed().get("backend_shard_seconds_total")
    return (float(v), "gate_durations.json") if isinstance(v, (int, float)) else (0.0, "")


# ---------------------------------------------------------------- spec classification
DEV_HDR = re.compile(r"needs? the vite dev|on the vite dev|drives the app on the vite dev", re.I)
SRC_IMPORT = re.compile(r"""['"`]/src['"`/]""")
ALL_PROJECTS = ["desktop", "tablet", "mobile"]
TABLET_ALLOWLIST_NAME = "gate_tablet_allowlist.json"   # in frontend/tests of the tested branch (E4): evidence specs reviewed as not needing 1024
TABLET_FULL = os.environ.get("GATE_TABLET_FULL") == "1"   # nightly: every project for every spec, the allowlist is ignored


def tablet_skip_set(fe):
    """Names of evidence specs reviewed as 'desktop + mobile is enough' (E4). Empty when the file is missing/invalid or in a
    GATE_TABLET_FULL run (the nightly): then nothing changes, every spec keeps the tablet project."""
    if TABLET_FULL:
        return set()
    try:
        d = json.loads((fe / "tests" / TABLET_ALLOWLIST_NAME).read_text(encoding="utf-8"))
        keep = set(d.get("tablet", []))
        return {n for n in d.get("desktop_mobile", []) if n.startswith("evidence-") and n not in keep}
    except (OSError, ValueError, AttributeError):
        return set()


def classify(fe, tier):
    out = {"rest": {}, "dev": {}, "fixture": {}, "pixel": [], "fixture_other": {}, "tablet_dropped": []}
    no_tablet = tablet_skip_set(fe)
    # top level only: tests/archive/ (retired specs, GATELANES-297) and tests/helpers/ are never classified
    for f in sorted((fe / "tests").glob("*.spec.ts")):
        if tier == "S" and not f.name.startswith("unit-"):
            continue
        text = f.read_text(errors="replace")
        if LANE and LANE_TAG not in text:   # the timing lane: only the files with a tagged test
            continue
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
            if f.name in no_tablet and not flags and not one:   # E4: reviewed, desktop + mobile is enough (a header --project= wins)
                projs = [p for p in ALL_PROJECTS if p != "tablet"]
                out["tablet_dropped"].append(f.name)
        if fixtures and f.name not in FIXTURE_SPECS:
            out["fixture_other"][f.name] = fixtures[0]
        if "toHaveScreenshot(" in text and not LANE and not (VISUAL and f.name == "visual-matrix.spec.ts"):  # the visual step owns that spec
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
    grep, grep_invert = lane_grep(grep, grep_invert)   # GATELANES-297: every run of a gate leaves the timing lane out
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
        # keyed by title too: parametrized tests (one test() in a loop: four skins, three screens) share file:line, and a
        # (file, line) key let the last sibling's result (usually a pass) stand for all of them - a real failure became "flaky"
        res2 = {(r2["file"], r2["line"], r2["title"]): r2 for r2 in (rows2 or [])}
        for r in lst:
            r2 = res2.get((r["file"], r["line"], r["title"]))
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
    balanced by. Files no gate has timed fall back to gate_durations.json next to this script (a committed seed, refreshed after
    each release). {} when there is neither."""
    global _COSTS
    if _COSTS is not None:
        return _COSTS
    _COSTS = {}
    mine = f"gate_{TAG}_{STATE['sha']}.logs"
    roots = [RES] + ([Path(COSTS_DIR)] if COSTS_DIR and Path(COSTS_DIR).resolve() != RES.resolve() else [])
    dirs = sorted((d for r in roots for d in r.glob("gate_*.logs") if d.is_dir() and not (r == RES and d.name == mine)),
                  key=lambda d: d.stat().st_mtime, reverse=True)
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
    try:        # the tracked seed (gate_durations.json next to this script): only for files no earlier gate on this runner has timed
        for f, v in (json.loads((HERE / DURATIONS_NAME).read_text(encoding="utf-8")).get("seconds") or {}).items():
            if isinstance(v, (int, float)) and v > 0:
                _COSTS.setdefault(f, float(v))
    except Exception:
        pass
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


def fixture_block(wt, fe, logd, cls):
    """The fixture specs against the fake backend (own data dir, own preview), settled in place. v1 runs it as its own phase,
    v2 as one job of the pool."""
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


def visual_block(wt, fe, logd, dead):
    """The M074 visual step on its own preview server (warn by default)."""
    port = free_port()
    vp, ok = start_vite(fe, "preview", port, logd, dead)
    if not ok:
        VISUAL_INFO.update(mode=VISUAL, error="vite preview did not start for the visual step")
    else:
        status("running", f"visual matrix ({VISUAL})")
        run_visual(wt, fe, f"http://127.0.0.1:{port}/", logd)
    reap(vp)


# ---------------------------------------------------------------- v2 schedule: one Playwright pool under a worker budget
def plan_pw_jobs(cat, table, costs, target, max_chunks, max_workers, base_workers):
    """The Playwright jobs of one server kind. Same groups as v1 (group_by_run: projects + the --workers=1 header); a
    --workers=1 group is split into ceil(total/target) chunks (at most max_chunks, balanced by recorded time), a parallel group
    gets ceil(total/target) workers (at least base_workers, at most max_workers). est = expected wall seconds."""
    known = sorted(costs[x] for x in table if x in costs)
    dflt = known[len(known) // 2] if known else 60.0
    jobs = []
    for (projs, w1), names in group_by_run(table).items():
        tag = f"{cat}_{'-'.join(projs)}{'_w1' if w1 else ''}"
        total = sum(costs.get(x, dflt) for x in names)
        if w1:
            n = max(1, min(max_chunks, len(names), math.ceil(total / max(target, 1))))
            chunks = balance(names, n) if n > 1 else [sorted(names)]
            for i, part in enumerate(chunks):
                if part:
                    jobs.append({"kind": "pw", "cat": cat, "label": tag + (f"_c{i}" if n > 1 else ""), "names": part,
                                 "projects": list(projs), "workers": 1, "est": sum(costs.get(x, dflt) for x in part)})
        else:
            w = max(int(base_workers), min(max_workers, math.ceil(total / max(target, 1))))
            unit = max((costs.get(x, dflt) / max(1, len(projs)) for x in names), default=0.0)
            jobs.append({"kind": "pw", "cat": cat, "label": tag, "names": sorted(names), "projects": list(projs), "workers": w,
                         "est": max(total / w, unit)})
    return jobs


def _fits(cost, free, slots):
    """A job starts when its workers fit in the free slots, or when the pool is empty (a job wider than the budget runs alone)."""
    return cost <= free or free >= slots


def _order(jobs):
    """Largest area (expected seconds x workers) first: on the 2.9.2 costs it packs 12 slots in ~75 min against ~84 min for
    plain longest-first (the lower bound, work / slots, is ~72 min)."""
    return sorted(jobs, key=lambda j: (-j["est"] * j["workers"], -j["est"], j["label"]))


def mem_available_mb():
    """MemAvailable from /proc/meminfo in MB; None where there is no /proc (the guard is then off)."""
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) // 1024
    except (OSError, ValueError, IndexError):
        pass
    return None


def load1():
    try:
        return os.getloadavg()[0]
    except (OSError, AttributeError):
        return None


RESOURCES = {"samples": 0, "max_load1": None, "min_mem_available_mb": None}


def sample_resources():
    """One heartbeat sample (every 30 s): the report's resources line, for tuning GATE_PW_SLOTS / GATE_BACKEND_SHARDS."""
    l, m = load1(), mem_available_mb()
    with _LOCK:
        RESOURCES["samples"] += 1
        if l is not None:
            RESOURCES["max_load1"] = round(max(l, RESOURCES["max_load1"] or 0.0), 1)
        if m is not None:
            RESOURCES["min_mem_available_mb"] = m if RESOURCES["min_mem_available_mb"] is None else min(m, RESOURCES["min_mem_available_mb"])


def simulate_pool(jobs, slots):
    """Expected makespan of run_pool(): the same greedy longest-first list scheduling, with est as the duration.
    Returns (makespan_seconds, {label: start_seconds})."""
    pending, running, t, free, starts = _order(jobs), [], 0.0, slots, {}
    while pending or running:
        pick = next((j for j in pending if _fits(j["workers"], free, slots)), None)
        if pick is not None:
            pending.remove(pick)
            free -= pick["workers"]
            starts[pick["label"]] = t
            running.append((t + pick["est"], pick["workers"]))
            continue
        running.sort()
        end, w = running.pop(0)
        t, free = end, free + w
    return t, starts


def run_pool(jobs, slots, runner, min_free_mb=None, mem=mem_available_mb):
    """Run every job (runner(job) in a thread) in _order() while the workers of the running jobs fit in `slots`. Memory guard:
    while MemAvailable is under min_free_mb (GATE_MIN_FREE_MB, 1500) no further job starts unless the pool is empty.
    Returns {label: (result, start_offset_s, wall_s)}; an exception of a job is its result."""
    pending, threads, out = _order(jobs), [], {}
    cond = threading.Condition()
    state = {"free": slots}
    t0 = time.time()
    min_free_mb = knob("GATE_MIN_FREE_MB", 1500, 1500) if min_free_mb is None else min_free_mb

    def low_memory():
        m = mem()
        return m is not None and m < min_free_mb and state["free"] < slots

    def wrap(j, st):
        try:
            r = runner(j)
        except BaseException as e:   # recorded, the pool goes on; the caller turns it into a FAIL
            r = e
        with cond:
            state["free"] += j["workers"]
            out[j["label"]] = (r, round(st - t0), round(time.time() - st))
            cond.notify_all()

    with cond:
        while pending:
            pick = None if low_memory() else next((j for j in pending if _fits(j["workers"], state["free"], slots)), None)
            if pick is None:
                cond.wait(timeout=10)
                continue
            pending.remove(pick)
            state["free"] -= pick["workers"]
            th = threading.Thread(target=wrap, args=(pick, time.time()), daemon=True)
            th.start()
            threads.append(th)
    for th in threads:
        th.join()
    return out


def v2_jobs(cls, costs, tier, skip_dev):
    """Every Playwright job of a v2 gate (the plan only, nothing runs). The same classification as v1."""
    target = knob("GATE_CHUNK_TARGET_SECS", 1500, 1500)
    max_chunks = knob("GATE_W1_MAX_CHUNKS", 3, 8)
    max_workers = knob("GATE_PW_MAX_WORKERS", int(PW_WORKERS), 6)
    jobs = plan_pw_jobs("preview", cls["rest"], costs, target, max_chunks, max_workers, int(PW_WORKERS))
    if cls["dev"] and not skip_dev:
        jobs += plan_pw_jobs("dev", cls["dev"], costs, target, max_chunks, max_workers, int(PW_WORKERS))
    if tier == "L" and cls["pixel"]:
        jobs.append({"kind": "pixel", "cat": "pixel", "label": "pixel", "names": list(cls["pixel"]), "projects": ["desktop", "mobile"],
                     "workers": 1, "est": pixel_estimate(len(cls["pixel"]))})
    if cls["fixture"]:
        jobs.append({"kind": "fixture", "cat": "fixture", "label": "fixture", "names": list(cls["fixture"]), "projects": [], "workers": 1,
                     "est": sum(costs.get(x, 75.0) for x in cls["fixture"])})
    if VISUAL:
        jobs.append({"kind": "visual", "cat": "visual", "label": "visual", "names": [], "projects": [], "workers": 4, "est": 90.0})
    return jobs


def pixel_estimate(nspecs):
    """The pixel specs run one Playwright process per file, one worker: the seed's pixel_phase_seconds (the last gate's pixel
    stretch), else 4 s per spec file (at least a minute)."""
    v = _seed().get("pixel_phase_seconds")
    return float(v) if isinstance(v, (int, float)) and v > 0 else max(60.0, 4.0 * nspecs)


def v1_estimate(cls, costs, tier, skip_dev, pixel_est):
    """The v1 Playwright wall time from the same costs: preview groups side by side, then pixel, fixture, visual, then dev."""
    def phase(cat, table):
        if not table:
            return 0.0
        js = []
        for (projs, w1), names in group_by_run(table).items():
            n = min(3, max(1, len(names) // 4)) if w1 else 1
            for part in (balance(names, n) if n > 1 else [names]):
                tot = sum(costs.get(x, 60.0) for x in part)
                js.append(tot if w1 else tot / int(PW_WORKERS))
        return max(js or [0.0])
    fx = sum(costs.get(x, 75.0) for x in cls["fixture"])
    return phase("preview", cls["rest"]) + (pixel_est if tier == "L" else 0) + fx + (90.0 if VISUAL else 0) + (0.0 if skip_dev else phase("dev", cls["dev"]))


def run_frontend_v2(wt, fe, logd, cls, dead):
    """v2: preview and dev servers up together, every job in one pool, then every failure settled (retried alone) in order."""
    slots = knob("GATE_PW_SLOTS", 12, 12)
    costs = prior_costs()
    early = pick_early(cls, costs)                 # GATE-FAST-2291: the early layout stage runs first, the main pool without it
    cls_main = dict(cls, rest={k: v for k, v in cls["rest"].items() if k not in early}) if early else cls
    jobs = v2_jobs(cls_main, costs, TIER, SKIP_DEV)
    early_jobs = plan_early_jobs(cls, early, costs)
    urls, servers = {}, []
    if early_jobs or any(j["cat"] in ("preview", "pixel") for j in jobs):
        port = free_port()
        vp, ok = start_vite(fe, "preview", port, logd, dead)
        servers.append(vp)
        if ok:
            urls["preview"] = urls["pixel"] = f"http://127.0.0.1:{port}/"
        else:
            item("preview", "vite preview", "FAIL", "did not start"); count("preview", "fail")
    if any(j["cat"] == "dev" for j in jobs):
        port = free_port()
        vp, ok = start_vite(fe, "dev", port, logd, dead)
        servers.append(vp)
        if ok:
            urls["dev"] = f"http://127.0.0.1:{port}/"
        else:
            item("dev", "vite dev server", "FAIL", "did not start"); count("dev", "fail")
    jobs = [j for j in jobs if j["kind"] in ("fixture", "visual") or j["cat"] in urls]

    def runner(j):
        if j["kind"] == "pw":
            rows, rc, to = run_pw(fe, j["names"], j["projects"], urls[j["cat"]], logd, j["label"], workers=j["workers"],
                                  grep_invert="pixel-stable" if j["cat"] == "preview" else None, timeout=left())
            return [(j["cat"], rows, rc, to, j["label"])]
        if j["kind"] == "pixel":
            out = []
            for i, name in enumerate(j["names"]):
                snap = fe / "tests" / f"{name}-snapshots"
                if not (snap.is_dir() and any(snap.glob("*-linux.png"))):
                    count("pixel", "skipped"); item("pixel", name, "SKIPPED_NO_BASELINE", "no *-linux.png baseline in " + snap.name)
                    continue
                lab = f"pixel_{i}"
                rows, rc, to = run_pw(fe, [name], ["desktop", "mobile"], urls["pixel"], logd, lab, workers=1, grep="pixel-stable", timeout=left())
                out.append(("pixel", rows, rc, to, lab))
            return out
        if j["kind"] == "fixture":
            fixture_block(wt, fe, logd, cls)
            return []
        visual_block(wt, fe, logd, dead)
        return []

    def settle_jobs(jl, res_):
        for j in _order(jl):
            r = res_.get(j["label"], (None, 0, 0))[0]
            if isinstance(r, BaseException):
                count(j["cat"], "fail"); item(j["cat"], j["label"], "FAIL", f"job crashed: {type(r).__name__}: {str(r)[:150]}")
                continue
            for cat, rows, rc, to, lab in r or []:
                settle(cat, rows, rc, to, fe, logd, urls[cat], {}, lab)

    try:
        early_jobs = [j for j in early_jobs if j["cat"] in urls]
        if early_jobs:    # the early layout stage: first in the queue, in parallel with the backend shards already running
            first = len(ITEMS)
            EARLY.update(specs=sorted(early), jobs=[j["label"] for j in early_jobs], failfast=EARLY_FAILFAST, stopped=False)
            status("running", f"early layout stage: {len(early)} specs, {len(early_jobs)} jobs")
            with Phase("early-layout", "early layout stage (Playwright, dist preview)"):
                res_e = run_pool(early_jobs, slots, runner)
            with Phase("early-layout-settle", "early layout stage: retry failures alone"):
                settle_jobs(early_jobs, res_e)
            bad = [i for i in ITEMS[first:] if i["status"] == "FAIL"]
            EARLY.update(seconds=int(time.time() - T0), failures=len(bad),
                         jobs_detail=[{"label": j["label"], "workers": j["workers"], "files": len(j["names"]),
                                       "wall_s": res_e.get(j["label"], (0, None, None))[2]} for j in _order(early_jobs)])
            if bad and EARLY_FAILFAST == "stop":
                EARLY["stopped"] = True
                write_early_report(bad)
                raise SystemExit(f"early layout stage failed ({len(bad)} failing test(s) after one retry alone): the gate stopped at once, "
                                 f"see gate_{TAG}_{STATE['sha']}.early.md")
        status("running", f"Playwright pool: {len(jobs)} jobs, {slots} worker slots")
        with Phase("playwright-pool", "Playwright pool (v2)"):
            res = run_pool(jobs, slots, runner)
        with Phase("playwright-settle", "Playwright: retry failures alone"):
            settle_jobs(jobs, res)
    finally:
        for vp in servers:
            reap(vp)
    return {"slots": slots, "early": len(early_jobs),
            "jobs": [{"label": j["label"], "cat": j["cat"], "workers": j["workers"], "files": len(j["names"]),
                      "est_s": round(j["est"]), "start_s": res.get(j["label"], (0, None, None))[1],
                      "wall_s": res.get(j["label"], (0, None, None))[2]} for j in _order(jobs)]}


EARLY_FAILFAST = (os.environ.get("GATE_EARLY_FAILFAST") or "stop").strip().lower()   # stop (owner answer 1A) | continue


def pick_early(cls, costs):
    """{spec file: classification entry} of the early layout stage: the dist-preview specs matching gate_early_layout.json, in the
    pattern order, until max_worker_seconds of recorded cost (60 s for a spec nobody timed). {} when the stage is off or the file is
    missing. Pure: reads the JSON next to the engine only."""
    import fnmatch
    if os.environ.get("GATE_EARLY_LAYOUT", "1") == "0" or LANE or TIER == "S":
        return {}
    try:
        cfg = json.loads((HERE / EARLY_FILE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    cap, used, out = float(cfg.get("max_worker_seconds", 3300)), 0.0, {}
    for pat in cfg.get("include", []):
        for name in sorted(cls["rest"]):
            if name in out or not fnmatch.fnmatch(name, pat):
                continue
            c = costs.get(name, 60.0)
            if used + c > cap:
                continue
            out[name] = cls["rest"][name]
            used += c
    return out


def plan_early_jobs(cls, early, costs):
    """Playwright jobs of the early stage (labels early_*): the same grouping as the main pool, but a short chunk target so
    the stage runs wide and ends in minutes."""
    if not early:
        return []
    target = knob("GATE_EARLY_TARGET_SECS", 240, 240)
    jobs = plan_pw_jobs("preview", early, costs, target, knob("GATE_W1_MAX_CHUNKS", 3, 8), knob("GATE_PW_MAX_WORKERS", int(PW_WORKERS), 6), int(PW_WORKERS))
    for j in jobs:
        j["label"] = "early_" + j["label"]
    return jobs


def write_early_report(bad):
    """The immediate report of a failed early layout stage: gate_<tag>_<sha>.early.md/.json. NOT a gate verdict file (no verdict key)."""
    sha = STATE["sha"]
    base = RES / f"gate_{TAG}_{sha}.early"
    elapsed = int(time.time() - T0)
    doc = {"early_layout_report": True, "branch": BR, "sha": sha, "elapsed_s": elapsed, "failfast": EARLY_FAILFAST,
           "specs": EARLY.get("specs", []), "failures": [{"category": i["category"], "id": i["id"], "reason": i.get("reason", "")} for i in bad],
           "resources": dict(RESOURCES), "started": STARTED, "written": now()}
    write_json(Path(str(base) + ".json"), doc)
    md = [f"# שלב פריסה מוקדם נכשל: {BR} @ {sha}", "",
          f"- השער נעצר מיד (fail-fast, החלטת הבעלים 1א). זמן מתחילת השער: {elapsed // 60} דקות {elapsed % 60} שניות.",
          f"- {len(bad)} כשלים אחרי ריצה חוזרת אחת לבד, מתוך {len(EARLY.get('specs', []))} קבצי פריסה בשלב.",
          f"- עומס מרבי {RESOURCES.get('max_load1')}, זיכרון פנוי מינימלי {RESOURCES.get('min_mem_available_mb')} MB "
          f"(עומס מעל 30 עם פסק זמן טעינה = כנראה תקלת ריצה, לא באג).", "",
          "## הכשלים", ""] + [f"- [{i['category']}] {i['id']}" + (f" - {i.get('reason', '')}" if i.get("reason") else "") for i in bad] + \
         ["", "בדיקות השרת והדפדפן המלא לא הושלמו. אחרי התיקון: הרצה חוזרת ממוקדת (--after) או שער מחדש.",
          "To keep collecting failures instead of stopping: GATE_EARLY_FAILFAST=continue."]
    Path(str(base) + ".md").write_text("\n".join(md) + "\n", encoding="utf-8")


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
        if cat in SKIPPED_CATS:
            warns.append(f"category {cat} was not run in this partial run (GATE_SKIP_*): its baseline was NOT checked")
            continue
        if cat in REDUCED_CATS:   # --select-base: fewer files on purpose; the per-process zero-test / crash guards still apply
            warns.append(f"category {cat} ran a diff selection ({REDUCED_CATS[cat]}): its baseline ratio was NOT checked")
            BASELINE_ROWS[cat] = {"baseline": exp, "actual": passed_of(cat), "ratio": round(passed_of(cat) / exp, 3) if exp else 1.0, "state": "selection"}
            continue
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
    title = "מסלול התזמון (לא חוסם, GATELANES-297)" if LANE else "שער שחרור"
    md = [f"# {title}: {BR} @ {sha}", "", f"## פסק דין: **{heb}**", "",
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
    md += ["", "## שלבים", ""] + [f"- {p['name']}: {p['seconds']} שניות" + (f" (תקציב {p['budget_s']}" + (f", איחור {p['late_s']}" if p.get("late_s") else "") + ")" if p.get("budget_s") else "")
                                 for p in PHASES]
    if LATE:
        md += ["", f"## איחורים לעומת התקציב: {len(LATE)}", ""] + [f"- {n['he']}" for n in LATE]
        if extra.get("budgets"):
            b = extra["budgets"]
            md += [f"- תקרה כוללת בשימוש: {b.get('used_cap_s')} שניות; תקרה נגזרת מסכום התקציבים: {b.get('total_cap_s')} שניות"]
    if extra.get("early_layout"):
        e = extra["early_layout"]
        md += ["", "## שלב פריסה מוקדם", "", f"- {len(e.get('specs', []))} קבצים, כשלים אחרי ריצה חוזרת: {e.get('failures', 0)}, מדיניות כשל: {e.get('failfast')}"
               + (", **השער נעצר בשלב זה**" if e.get("stopped") else "")]
    if extra.get("selection"):
        s = extra["selection"]
        md += ["", "## בחירת בדיקות לפי השינוי (selection)", ""]
        if s.get("error"):
            md += [f"> אזהרה: הבחירה נכשלה ({s['error']}), השער רץ במלואו"]
        else:
            md += [f"- base: {s['base']} | full backend: {', '.join(s['full'].get('backend', [])[:3]) or 'no'} | full frontend: {', '.join(s['full'].get('frontend', [])[:3]) or 'no'}",
                   f"- reduced: {s['reduced'] or 'nothing (full tier)'} | the dropped files: {s['file']}",
                   "> the nightly full run on main is the safety net (select_tests.py audit)"]
    if extra.get("quarantine"):
        q = extra["quarantine"]
        md += ["", f"## הסגר (quarantine): {len(q)} - failed on the first run in two consecutive gates; a fix ticket each, never skipped", ""]
        md += [f"- [{e['category']}] {e['id'][:180]} ({', '.join(e['gates'][-3:])})" for e in q]
    md += ["", f"- תזמון (schedule): {extra.get('schedule', 'v1')}"]
    if extra.get("resources"):
        r = extra["resources"]
        md += [f"- resources (every 30 s, {r['samples']} samples): max load1 {r['max_load1']}, min MemAvailable {r['min_mem_available_mb']} MB"]
    if extra.get("backend_shards"):
        md += [f"- backend: {len(extra['backend_shards'])} shards, scratch: {extra.get('backend_scratch', 'disk')}"]
    if extra.get("pool"):
        p = extra["pool"]
        md += [f"- Playwright pool: {p['slots']} worker slots, {len(p['jobs'])} jobs (label / workers / files / est s / start s / wall s):"]
        md += [f"  - {j['label']} / {j['workers']} / {j['files']} / {j['est_s']} / {j['start_s']} / {j['wall_s']}" for j in p["jobs"]]
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
                sample_resources()
                check_running_phase_late()
            except Exception:
                pass

    threading.Thread(target=heartbeat, daemon=True).start()
    wt, sha = setup_worktree()
    STATE["sha"] = sha
    if GB:   # GATE-FAST-2291: budgets = the last passed report of this mode x 1.25, else the seed (estimates); lateness is reported, never fatal
        try:
            BUDGETS.update(GB.derive_budgets(RES, "select" if SELECT_BASE else "full", HERE / GB.SEED_NAME))
        except Exception as e:   # noqa: BLE001
            BUDGETS.clear()
            print(f"phase budgets unavailable: {type(e).__name__}: {e}")
    logd = RES / f"gate_{TAG}_{sha}.logs"
    logd.mkdir(exist_ok=True)
    for old in logd.glob("*"):
        if old.is_file():
            old.unlink()
    fe = wt / "frontend"
    extra = {"schedule": SCHEDULE}
    procs = None
    nbackend = 0
    hard_fail = []
    shm = None
    only = None
    if SELECT_BASE:
        with Phase("select", f"diff selection against {SELECT_BASE}"):
            try:
                SELECTION.update(compute_selection(wt, SELECT_BASE))
            except Exception as e:   # no selection = the full tier, said in the report
                SELECTION.update(error=f"{type(e).__name__}: {str(e)[:200]}")
            write_json(RES / f"gate_{TAG}_{sha}.selection.json", SELECTION)
            only = backend_only(SELECTION)
    if LANE:   # the timing lane: only the backend files with a timing_lane test (pytest -m timing_lane inside them)
        only = lane_backend_files(wt / "smplwise_vms" / "backend")
        extra["lane"] = {"name": "timing", "backend_files": sorted(only), "tag": LANE_TAG, "mark": LANE_MARK, "blocking": False}
    try:
        with Phase("modules", "node modules"):
            if not need_modules(wt, logd / "npm.log"):
                hard_fail.append("npm ci failed")
        if TIER in ("M", "L") and not SKIP_BACKEND:
            if SCHEDULE == "v2":
                n = max(1, knob("GATE_BACKEND_SHARDS", 3, 6))
                with Phase("backend-start", f"backend: {n} shards started (v2)"):
                    if knob("GATE_BACKEND_TMPFS", 0, 1):
                        shm = tmpfs_root(TAG)
                        extra["backend_scratch"] = str(shm) if shm else "disk (tmpfs unavailable or under GATE_TMPFS_MIN_GB free)"
                    else:
                        extra["backend_scratch"] = "disk"
                    procs, nbackend, extra["backend_shards"] = backend_start_v2(wt, logd, n, shm, only=only)
            else:
                with Phase("backend-start", "backend: 3 shards started"):
                    procs, nbackend = backend_start(wt, logd, only=only)
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
        if not LANE:   # the timing lane checks no release (GATELANES-297)
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
        if SELECTION:
            cls = filter_classification(cls, SELECTION)
            extra["selection"] = {"base": SELECT_BASE, "error": SELECTION.get("error"), "full": SELECTION.get("full"),
                                  "reduced": dict(REDUCED_CATS), "file": f"gate_{TAG}_{sha}.selection.json"}
        extra["classification"] = {
            "rest": f"{len(cls['rest'])} spec files on the dist preview",
            "dev": f"{len(cls['dev'])} on the Vite dev server: " + ", ".join(f"{k}({'/'.join(v['projects'])})" for k, v in cls["dev"].items()),
            "fixture": f"{len(cls['fixture'])}: " + ", ".join(cls["fixture"]),
            "pixel": ", ".join(cls["pixel"]) or "-",
            "evidence specs without the tablet project (E4, gate_tablet_allowlist.json; the nightly runs them on tablet too)": str(len(cls["tablet_dropped"])),
            "fixture needed but not in the gate routine (self-skip in the preview run)": ", ".join(f"{k}->{v}" for k, v in cls["fixture_other"].items()) or "-",
        }
        dead = free_port()   # nothing listens here: the app falls back to demo mode, as the specs' headers require
        if COUNTS.get("build", {}).get("pass", 0) == 1 and SCHEDULE == "v2":
            extra["pool"] = run_frontend_v2(wt, fe, logd, cls, dead)
        elif COUNTS.get("build", {}).get("pass", 0) == 1:
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
                    fixture_block(wt, fe, logd, cls)
            if VISUAL:
                with Phase("visual-matrix", "M074 visual matrix (--touched)"):
                    visual_block(wt, fe, logd, dead)
            if cls["dev"] and not SKIP_DEV:
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
        ABORT.set()
        kill_all()
        if shm:   # v2 tmpfs scratch: RAM, never left behind (a failed test's dir goes with it; its log line stays in backend_sN.log)
            shutil.rmtree(shm, ignore_errors=True)
    if left() < 0:
        # the budget is GATE_TOTAL_SECS (90 min for a gate, ~225 min for the nightly): say the real one (GATEAUDIT-297)
        hard_fail.append(f"{TOTAL // 60}-minute budget exhausted: the run is incomplete")
    extra["resources"] = dict(RESOURCES)
    if EARLY:
        extra["early_layout"] = dict(EARLY)
    if BUDGETS:
        extra["budgets"] = {"mode": "select" if SELECT_BASE else "full", "phases": BUDGETS,
                            "total_cap_s": GB.total_cap(BUDGETS) if GB else None, "used_cap_s": TOTAL, "late": list(LATE)}
    try:   # the fix-ticket queue: first-run failures in two consecutive gates (report section + ~/smplwise-results/quarantine.json)
        extra["quarantine"] = quarantine(gate_history(f"{BR}@{sha}", ITEMS))
        write_json(RES / "quarantine.json", {"updated": now(), "gate": f"{BR}@{sha}", "entries": extra["quarantine"]})
    except Exception as e:  # noqa: BLE001 - a report helper never changes the verdict
        extra["quarantine_error"] = f"{type(e).__name__}: {e}"[:200]
    baseline, bsrc = (None, "") if LANE else load_baseline(wt)
    extra["baseline_file"] = bsrc or "(none found)"
    if LANE:   # a handful of tagged tests: the release counts do not apply (GATELANES-297)
        extra["baseline_warnings"] = ["timing lane: no count-baseline check (non-blocking lane, docs/testing/GATE_LANES.md)"]
    else:
        if EARLY.get("stopped"):   # the early stage stopped the gate: the other categories never ran, a count drop would only be noise
            extra["baseline_warnings"] = ["early layout stage failed (fail-fast): the gate stopped early, the count-drop check was NOT applied"]
        else:
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


def plan(root, tier):
    """--plan: what v1 and v2 would run on the checkout `root`, with time estimates from the recorded costs. Runs nothing,
    starts no process, writes nothing. Costs: the gate logs under GATE_RESULTS_DIR (+ GATE_COSTS_DIR), then gate_durations.json."""
    global SCHEDULE
    root = Path(root).resolve()
    fe, bd = root / "frontend", root / "smplwise_vms" / "backend"
    cls = classify(fe, tier)
    costs = prior_costs()
    lines = [f"plan for {root} (tier {tier}); {len(costs)} spec files timed; schedule knobs from the environment",
             f"classification: rest {len(cls['rest'])}, dev {len(cls['dev'])}, fixture {len(cls['fixture'])}, pixel {len(cls['pixel'])}, "
             f"tablet dropped (E4) {len(cls['tablet_dropped'])}"]
    pix = pixel_estimate(len(cls["pixel"]))
    v1_fe = v1_estimate(cls, costs, tier, SKIP_DEV, pix)
    btot, bsrc = last_backend_seconds()
    files = [(os.path.basename(f), os.path.getsize(f)) for f in sorted(glob.glob(str(bd / "tests" / "test_*.py")))]
    bcosts = backend_prior_costs()
    if not bcosts and btot and files:   # no per-file times yet: scale the sizes to the last gate's total
        tsize = sum(s for _, s in files) or 1
        bcosts = {f: btot * s / tsize for f, s in files}
    out = {}
    for sched, nsh in (("v1", 3), ("v2", None)):
        keep, SCHEDULE = SCHEDULE, sched
        try:
            n = nsh or max(1, knob("GATE_BACKEND_SHARDS", 3, 6))
            shards = split_backend(files, n, bcosts) if files else []
            b_est = max((w for _, w in shards), default=0.0)
            if sched == "v1":
                fe_est, extra_lines = v1_fe, []
            else:
                slots = knob("GATE_PW_SLOTS", 12, 12)
                jobs = v2_jobs(cls, costs, tier, SKIP_DEV)
                fe_est, starts = simulate_pool(jobs, slots)
                work = sum(j["est"] * j["workers"] for j in jobs)
                extra_lines = [f"  pool: {slots} slots, {len(jobs)} jobs, {work / 3600:.1f} worker-hours, longest job {max((j['est'] for j in jobs), default=0) / 60:.0f} min"]
                extra_lines += [f"    {j['label']:<44} w={j['workers']} files={len(j['names']):>3} est={j['est'] / 60:5.1f} min start={starts.get(j['label'], 0) / 60:5.1f}"
                                for j in _order(jobs)]
            out[sched] = {"frontend_s": fe_est, "backend_s": b_est}
            lines += [f"{sched}: Playwright ~{fe_est / 60:.0f} min, backend {len(shards)} shards ~{b_est / 60:.0f} min (largest shard; "
                      f"backend total {btot / 60:.0f} shard-min from {bsrc or 'sizes only'}), critical path ~{max(fe_est, b_est) / 60:.0f} min"
                      " + ~1 min tsc/build/release_check + retries"] + extra_lines
        finally:
            SCHEDULE = keep
    lines.append("estimates use the recorded per-file times of earlier gates as they ran then (under that gate's load); v2 runs more at once,"
                 " so expect individual tests to be slower; the backend estimate assumes the shards scale (disk); tmpfs is not counted")
    print("\n".join(lines))
    return out


def seed_from(logs_dir, source):
    """--seed-from <gate_*.logs> ["<source line>"]: the refreshed gate_durations.json (stdout) from one gate's logs: Playwright
    seconds per spec file (pw_*.json, retries excluded, as prior_costs()), backend seconds per test file (backend_s*.xml, v2
    gates), the shards' summed pytest seconds; pixel_phase_seconds is kept from the current seed (a v2 report has it per job)."""
    d = Path(logs_dir)
    sec = {}
    for jp in sorted(d.glob("pw_*.json")):
        if "_retry_" in jp.name:
            continue
        try:
            rep = json.loads(jp.read_text(encoding="utf-8"))
        except Exception:
            continue

        def walk(s):
            for sp in s.get("specs", []):
                f = os.path.basename(sp.get("file", ""))
                for t in sp.get("tests", []):
                    sec[f] = sec.get(f, 0.0) + sum((r.get("duration") or 0) for r in t.get("results", [])) / 1000.0
            for c in s.get("suites", []):
                walk(c)
        for s in rep.get("suites", []):
            walk(s)
    bsec = {}
    for xp in sorted(d.glob("backend_s*.xml")):
        for f, v in junit_costs(xp).items():
            bsec[f] = bsec.get(f, 0.0) + v
    tot = 0.0
    for lg in d.glob("backend_s*.log"):
        m = re.findall(r" in ([\d.]+)s", lg.read_text(encoding="utf-8", errors="replace"))
        tot += float(m[-1]) if m else 0.0
    cur = _seed()
    doc = dict(cur)
    doc["source"] = source or f"gate logs {d.name}"
    doc["seconds"] = {k: round(v, 1) for k, v in sorted(sec.items()) if round(v, 1) > 0}
    if bsec:
        doc["backend_seconds"] = {k: round(v, 1) for k, v in sorted(bsec.items()) if round(v, 1) > 0}
    if tot:
        doc["backend_shard_seconds_total"] = round(tot, 1)
    print(json.dumps(doc, indent=2, ensure_ascii=False))
    return 0


def main_cli(argv):
    if argv[:1] == ["--seed-from"] and len(argv) >= 2:
        return seed_from(argv[1], argv[2] if len(argv) > 2 else "")
    global BR, TIER, TAG, ALLOW_DROP, VISUAL, VISUAL_BASE, SCHEDULE, SELECT_BASE
    args = list(argv)
    plan_root = None
    while args:
        a = args.pop(0)
        if a == "--schedule":
            SCHEDULE = (args.pop(0) if args else "").strip().lower()
            continue
        if a == "--select-base":
            SELECT_BASE = (args.pop(0) if args else "").strip()
            if not SELECT_BASE:
                print("--select-base needs a ref (the previous release, e.g. main or v2.9.2)")
                return 2
            continue
        if a == "--plan":
            plan_root = plan_root or "."
            continue
        if a == "--root":
            plan_root = args.pop(0) if args else "."
            continue
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
    if LANE:   # GATELANES-297: the timing lane runs only its tagged tests - no visual step, no diff selection
        VISUAL, SELECT_BASE = "", ""
    if SCHEDULE not in ("v1", "v2"):
        print("--schedule must be v1 (the 2.9.2 gate, default) or v2 (GATESPEED: more shards, one Playwright pool)")
        return 2
    if TIER not in ("S", "M", "L"):
        print("tier must be S, M or L")
        return 2
    if plan_root is not None:
        plan(plan_root, TIER)
        return 0
    if SELECT_BASE and os.environ.get("GATE_SELECT_ENABLE") != "1":
        # lead 2026-10-20: selection stays OFF for release gates until the full nightly on main finishes reliably (its safety
        # net); a run that really wants it sets GATE_SELECT_ENABLE=1 on purpose (docs/release/GATE_SPEED.md 5.2)
        print("--select-base is disabled for release gates (set GATE_SELECT_ENABLE=1 only after the nightly safety net is proven)")
        return 2
    if not BR:
        print('usage: release_gate.sh <branch> [--tier S|M|L] [--schedule v1|v2] [--select-base <ref>] [--allow-count-drop "<reason>"] [--visual | --visual-block | --no-visual] [--visual-base <ref>]\n'
              '       release_gate.py --plan --root <checkout> [--tier L]   (estimates only, runs nothing)')
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
