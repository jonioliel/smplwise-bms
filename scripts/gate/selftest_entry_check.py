#!/usr/bin/env python3
"""Self-test of the ENTRY CHECK (ENTRY-CHECK-2310) and the 7-day quarantine rule, with FAKE data only: no runner, no real test
suite, no browser, no network, nothing outside a temp directory.

  python scripts/gate/selftest_entry_check.py        (exit 0 = all OK; each case prints OK / BROKEN / SKIP)

Part A (pure Python, every OS): the quarantine format (ticket + owner + reason + expiry <= 7 days after `added`), expired entries count
as failures again, the add / remove / check / md CLI, the quarantine section in the gate-2 report, the entry-check verdict
(GREEN / RED / NOT_RUN, Hebrew + English file, machine JSON), the 'entry' holder kind.
Part B (needs bash + git; Git Bash on Windows is enough): branch_check.sh end to end on a throw-away git repository with a fake
engine (a fake release_gate.py that writes a report) and a fake `flock` on PATH that reports "busy" a few times first: it queues
instead of failing, never needs ~/.gate_fast_enabled, ignores a red nightly, selects against origin/main, writes
entry_<branch>_<sha>.md + .json and exits 0 / 1.
"""
import datetime as dt
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
TMP = Path(tempfile.mkdtemp(prefix="entry_check_selftest_"))
for _k in [k for k in os.environ if k.startswith(("GATE_", "GATE2_", "ENTRY_"))]:
    del os.environ[_k]
for _k in ("HOME", "USERPROFILE"):
    os.environ[_k] = str(TMP / "home")
os.environ["GATE_HOLDER_FILE"] = str(TMP / "home" / "holder.json")
os.environ["GATE_LOCK_FILE"] = str(TMP / "home" / "gate.lock")
(TMP / "home").mkdir()
sys.path.insert(0, str(HERE))
BAD = []


def check(name, cond, detail=""):
    print(("OK      " if cond else "BROKEN  ") + name + ("" if cond else f"  [{str(detail)[:600]}]"))
    if not cond:
        BAD.append(name)


def wj(p, d):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


TODAY = dt.date(2026, 10, 30)


def part_a():
    import gate2_verdict as g2v
    import gate_quarantine as gq
    import gate_holder as gh
    import branch_check as bc

    # ---- quarantine format: ticket + owner + reason + expiry <= 7 days after added
    check("the maximum quarantine is 7 days (one constant)", g2v.MAX_QUARANTINE_DAYS == 7 and gq.MAX_DAYS == 7)
    q = TMP / "q.json"
    wj(q, {"entries": [
        {"match": "ok7", "category": "backend", "ticket": "T1", "owner": "lead", "reason": "load only", "added": "2026-10-28", "expires": "2026-11-04"},
        {"match": "eight", "category": "backend", "ticket": "T2", "owner": "lead", "reason": "r", "added": "2026-10-28", "expires": "2026-11-05"},
        {"match": "noticket", "category": "*", "owner": "lead", "reason": "r", "added": "2026-10-28", "expires": "2026-11-01"},
        {"match": "noreason", "category": "*", "ticket": "T3", "owner": "lead", "added": "2026-10-28", "expires": "2026-11-01"},
        {"match": "old", "category": "preview", "ticket": "T4", "owner": "lead", "reason": "r", "added": "2026-10-20", "expires": "2026-10-27"},
        {"match": "backwards", "category": "*", "ticket": "T5", "owner": "lead", "reason": "r", "added": "2026-10-29", "expires": "2026-10-28"}]})
    full = g2v.load_quarantine_full(q, TODAY)
    check("only the valid 7-day entry is active", [e["match"] for e in full["active"]] == ["ok7"], full)
    check("an expired entry is listed as EXPIRED, not dropped silently", [e["match"] for e in full["expired"]] == ["old"], full["expired"])
    probs = " | ".join(full["problems"])
    check("8 days, no ticket, no reason and expiry before added are each reported", all(s in probs for s in ("eight", "noticket", "noreason", "backwards")), probs)
    act, pr = g2v.load_quarantine(q, TODAY)
    check("load_quarantine keeps its old shape (active, problems)", [e["match"] for e in act] == ["ok7"] and any("old" in p for p in pr))

    rep = {"verdict": "fail", "branch": "release/x", "sha": "s1", "items": [
        {"category": "backend", "id": "tests/test_ok7.py::t", "status": "FAIL"},
        {"category": "preview", "id": "old.spec.ts:3 [desktop] t", "status": "FAIL"}]}
    c = g2v.classify(rep, act)
    check("an expired quarantine counts as a failure again", [i["id"] for i in c["real"]] == ["old.spec.ts:3 [desktop] t"]
          and len(c["quarantined"]) == 1, c)

    sec = "\n".join(g2v.quarantine_section(q, TODAY))
    check("report section lists active (ticket, expiry, days left) and EXPIRED entries",
          "Quarantine list" in sec and "ok7" in sec and "T1" in sec and "2026-11-04" in sec and "5 d left" in sec
          and "EXPIRED" in sec and "old" in sec and "counts as a failure again" in sec, sec)
    rp = TMP / "res" / "gate_release-x_s1.json"
    wj(rp, rep)
    with open(os.devnull, "w") as dn:
        so = sys.stdout
        sys.stdout = dn
        try:
            rc = g2v.main([str(rp), "--quarantine", str(q), "--today", TODAY.isoformat()])
        finally:
            sys.stdout = so
    md = (TMP / "res" / "gate_release-x_s1.gate2.md").read_text(encoding="utf-8")
    check("gate-2 report: expired one is a real failure (rc 1) and the quarantine list is in the report",
          rc == 1 and "Quarantine list" in md and "EXPIRED" in md, f"rc={rc}")

    # ---- the CLI: add / remove / check / md with validation
    q2 = TMP / "q2.json"
    def cli(*a):
        with open(os.devnull, "w") as dn:
            so = sys.stdout
            sys.stdout = dn
            try:
                return gq.main(list(a) + ["--file", str(q2), "--today", TODAY.isoformat()])
            finally:
                sys.stdout = so
    check("add with ticket/owner/reason/7 days -> rc 0", cli("add", "--match", "test_load.py", "--category", "backend", "--ticket", "ENT-1",
                                                             "--owner", "lead", "--reason", "fails under load only, passes alone") == 0)
    e = json.loads(q2.read_text(encoding="utf-8"))["entries"][0]
    check("added entry: added today, expires today + 7 by default", e["added"] == "2026-10-30" and e["expires"] == "2026-11-06", e)
    check("add refuses 8 days", cli("add", "--match", "m", "--category", "backend", "--ticket", "T", "--owner", "o", "--reason", "r", "--days", "8") == 2)
    check("add refuses a missing ticket", cli("add", "--match", "m", "--category", "backend", "--owner", "o", "--reason", "r") == 2)
    check("add refuses an unknown category", cli("add", "--match", "m", "--category", "bogus", "--ticket", "T", "--owner", "o", "--reason", "r") == 2)
    check("add refuses a duplicate active match", cli("add", "--match", "test_load.py", "--category", "backend", "--ticket", "T", "--owner", "o", "--reason", "r") == 2)
    check("check: a clean file -> rc 0", cli("check") == 0)
    d = json.loads(q2.read_text(encoding="utf-8"))
    d["entries"].append({"match": "z", "category": "*", "ticket": "T", "owner": "o", "reason": "r", "added": "2026-10-01", "expires": "2026-10-30"})
    wj(q2, d)
    check("check: an invalid (29-day) entry -> rc 1", cli("check") == 1)
    check("remove an unknown match -> rc 2", cli("remove", "--match", "nope", "--reason", "fixed") == 2)
    check("remove needs a reason", cli("remove", "--match", "test_load.py") == 2)
    check("remove a known match -> rc 0", cli("remove", "--match", "test_load.py", "--reason", "fixed in ENT-1") == 0)
    d = json.loads(q2.read_text(encoding="utf-8"))
    check("removed entry goes to history with the date and reason", not any(x["match"] == "test_load.py" for x in d["entries"])
          and any(h["match"] == "test_load.py" and h.get("removed") == "2026-10-30" and "ENT-1" in h.get("removed_reason", "") for h in d.get("history", [])), d)
    out = "\n".join(gq.markdown(q, TODAY))
    check("md command renders the same section for the nightly report", "Quarantine list" in out and "EXPIRED" in out)

    # ---- holder: the entry check holds the machine like a gate (agents are refused, with its own message)
    hp = TMP / "holder.json"
    gh.claim("entry", "entry check feature/x", "branch_check.sh feature/x", os.getpid(), hp)
    rc, msg = gh.guard("agent", hp, lambda p: True, lambda: False)
    check("entry-check holder refuses agent test runs (75) with a Hebrew message", rc == 75 and "בדיקת כניסה" in msg and "feature/x" in msg, msg)

    # ---- the verdict
    sel = {"base": "origin/main", "backend": {"selected": ["a.py"], "total": 10}, "frontend": {"selected": ["x.spec.ts", "y.spec.ts"], "total": 40},
           "full": {"backend": [], "frontend": []}, "deferred_to_nightly": {"heavy.spec.ts": 1200}}
    green = {"verdict": "pass", "branch": "feature/x", "sha": "abc1234", "wall_seconds": 1500,
             "counts": {"backend": {"pass": 50, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}}, "items": [
                 {"category": "preview", "id": "y.spec.ts:2 t", "status": "FLAKY"}]}
    v = bc.build_verdict(green, sel, act, [], branch="feature/x", sha="abc1234", base="origin/main", base_sha="def5678", waited_s=600,
                         nightly={"state": "red", "why": "nightly red"})
    check("engine pass -> GREEN, exit 0", v["verdict"] == "GREEN" and v["exit"] == 0, v)
    check("verdict JSON carries selection counts, flaky and the nightly as information only",
          v["selection"]["backend"] == "1/10" and v["selection"]["frontend"] == "2/40" and v["selection"]["deferred_to_nightly"] == 1
          and v["flaky"] == ["y.spec.ts:2 t"] and v["nightly"]["state"] == "red", v)
    qred = dict(green, verdict="fail", items=[{"category": "backend", "id": "tests/test_ok7.py::t", "status": "FAIL"}])
    v = bc.build_verdict(qred, sel, act, [], branch="feature/x", sha="abc1234", base="origin/main")
    check("red only through active quarantine -> GREEN, the quarantined test is listed", v["verdict"] == "GREEN" and v["quarantined"], v)
    v = bc.build_verdict(rep | {"branch": "feature/x"}, sel, act, [{"match": "old", "ticket": "T4", "expires": "2026-10-27"}],
                         branch="feature/x", sha="abc1234", base="origin/main")
    check("an expired quarantine -> RED, exit 1, failure named", v["verdict"] == "RED" and v["exit"] == 1 and "old.spec.ts:3 [desktop] t" in v["failures"], v)
    hard = dict(green, verdict="fail", items=[{"category": "tsc", "id": "tsc --noEmit", "status": "FAIL"}])
    check("a hard failure (tsc) -> RED", bc.build_verdict(hard, sel, act, [], branch="b", sha="s", base="origin/main")["verdict"] == "RED")
    v = bc.build_verdict(None, None, act, [], branch="b", sha="s", base="origin/main", reason="engine wrote no report (rc=1)")
    check("no engine report -> NOT_RUN, exit 1 (never green)", v["verdict"] == "NOT_RUN" and v["exit"] == 1 and "rc=1" in v["reason"], v)
    out = TMP / "out"
    v = bc.build_verdict(green, sel, act, [], branch="feature/x", sha="abc1234", base="origin/main", base_sha="def5678")
    md_p, js_p = bc.write_verdict(v, out)
    mdt = md_p.read_text(encoding="utf-8")
    check("file names entry_<branch-tag>_<sha>.md / .json", md_p.name == "entry_feature-x_abc1234.md" and js_p.name == "entry_feature-x_abc1234.json")
    check("the verdict file is short, Hebrew and English", len(mdt.splitlines()) <= 40 and "בדיקת כניסה" in mdt and "Entry check" in mdt
          and "GREEN" in mdt and "ירוק" in mdt, mdt)
    check("the machine JSON round-trips", json.loads(js_p.read_text(encoding="utf-8"))["verdict"] == "GREEN")
    with open(os.devnull, "w") as dn:
        so = sys.stdout
        sys.stdout = dn
        try:
            wj(TMP / "eng" / "gate_feature-x_abc1234.json", qred)
            rc_cli = bc.main(["verdict", "--report", str(TMP / "eng" / "gate_feature-x_abc1234.json"), "--branch", "feature/x", "--sha", "abc1234",
                              "--base", "origin/main", "--out-dir", str(out), "--quarantine", str(q), "--today", TODAY.isoformat()])
            rc_missing = bc.main(["verdict", "--report", str(TMP / "eng" / "missing.json"), "--branch", "feature/x", "--sha", "abc1234",
                                  "--base", "origin/main", "--out-dir", str(out), "--quarantine", str(q), "--why", "engine wrote no report"])
        finally:
            sys.stdout = so
    check("verdict CLI: quarantined-only red -> rc 0; missing report -> rc 1", rc_cli == 0 and rc_missing == 1, f"{rc_cli} {rc_missing}")


# ------------------------------------------------------------------ part B: branch_check.sh end to end with fakes
FAKE_ENGINE = r'''#!/usr/bin/env python3
import json, os, subprocess, sys, time
from pathlib import Path
args = sys.argv[1:]
br = args[0]
res = Path(os.environ["GATE_RESULTS_DIR"]); res.mkdir(parents=True, exist_ok=True)
tag = "".join(c if c.isalnum() or c in "._-" else "-" for c in br)
home = Path(os.environ.get("GATE_HOME") or Path.home())
wt = home / "work" / f"gate-{tag}"
sha = subprocess.run(["git", "-C", str(wt), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
log = {"argv": args, "select_enable": os.environ.get("GATE_SELECT_ENABLE"), "results": str(res), "costs": os.environ.get("GATE_COSTS_DIR")}
(home / "engine_calls.jsonl").open("a").write(json.dumps(log) + "\n")
mode = os.environ.get("FAKE_ENGINE_MODE", "pass")
items = [] if mode == "pass" else [{"category": "backend", "id": "tests/test_real.py::t", "status": "FAIL", "reason": "boom"}]
rep = {"verdict": "pass" if mode == "pass" else "fail", "branch": br, "sha": sha, "wall_seconds": 60, "items": items,
       "counts": {"backend": {"pass": 3, "fail": len(items), "flaky": 0, "known": 0, "skipped": 0}}}
(res / f"gate_{tag}_{sha}.json").write_text(json.dumps(rep))
(res / f"gate_{tag}_{sha}.selection.json").write_text(json.dumps({"base": "origin/main", "backend": {"selected": ["test_a.py"], "total": 9},
    "frontend": {"selected": [], "total": 4}, "full": {"backend": [], "frontend": []}, "deferred_to_nightly": {}}))
sys.exit(0 if mode == "pass" else 1)
'''

FAKE_FLOCK = r'''#!/usr/bin/env bash
# fake flock: "busy" for the first $FAKE_FLOCK_BUSY calls (counted in a file), then free
n=$(cat "$FAKE_FLOCK_COUNT" 2>/dev/null || echo 0); n=$((n+1)); echo "$n" > "$FAKE_FLOCK_COUNT"
echo "flock $*" >> "$FAKE_FLOCK_LOG"
[ "$n" -le "${FAKE_FLOCK_BUSY:-0}" ] && { sleep 0.2; exit 1; }
exit 0
'''


def sh(cmd, cwd=None, env=None):
    return subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=300)


def part_b():
    bash = shutil.which("bash")
    git = shutil.which("git")
    if not bash or not git:
        print("SKIP    part B: bash or git not found")
        return
    home = TMP / "bhome"
    home.mkdir()
    origin = TMP / "origin.git"
    seed = TMP / "seed"
    sh([git, "init", "-q", "--bare", "-b", "main", str(origin)])
    sh([git, "init", "-q", "-b", "main", str(seed)])
    genv = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.invalid", "GIT_COMMITTER_NAME": "t",
            "GIT_COMMITTER_EMAIL": "t@example.invalid"}
    (seed / "a.txt").write_text("1\n")
    sh([git, "add", "."], cwd=seed, env=genv)
    sh([git, "commit", "-q", "-m", "base"], cwd=seed, env=genv)
    sh([git, "tag", "v1.0.0"], cwd=seed, env=genv)
    sh([git, "checkout", "-q", "-b", "feature/x"], cwd=seed, env=genv)
    (seed / "b.txt").write_text("2\n")
    sh([git, "add", "."], cwd=seed, env=genv)
    sh([git, "commit", "-q", "-m", "feature"], cwd=seed, env=genv)
    sh([git, "remote", "add", "origin", str(origin)], cwd=seed, env=genv)
    sh([git, "push", "-q", "origin", "main", "feature/x"], cwd=seed, env=genv)
    repo = home / "smplwisebms"
    sh([git, "clone", "-q", str(origin), str(repo)])
    fsha = sh([git, "-C", str(repo), "rev-parse", "--short", "origin/feature/x"]).stdout.strip()

    g2 = home / "gate2"              # the install dir: a copy of scripts/gate (as ~/gate2 on the runner)
    shutil.copytree(HERE, g2, ignore=shutil.ignore_patterns("__pycache__", "tests"))
    shutil.copy(HERE / "gate2" / "select_tests.py", g2 / "select_tests.py")      # the gate-2 shim, as installed
    v1 = home                        # the v1 engine dir (~): the fake engine
    (v1 / "release_gate.py").write_text(FAKE_ENGINE, encoding="utf-8")
    shutil.copy(HERE / "select_tests.py", v1 / "select_tests.py")
    res = home / "smplwise-results"
    wj(res / "nightly" / "gate_main_zzz.json", {"verdict": "fail", "finished": "2026-10-29T02:00:00+0000", "items": [
        {"category": "backend", "id": "x", "status": "FAIL"}]})            # a RED nightly must not matter
    wj(g2 / "gate2_quarantine.json", {"entries": []})
    fbin = TMP / "fakebin"
    fbin.mkdir()
    (fbin / "flock").write_text(FAKE_FLOCK, encoding="utf-8", newline="\n")
    pyreal = sys.executable
    (fbin / "python3").write_text(f'#!/usr/bin/env bash\nexec "{Path(pyreal).as_posix()}" "$@"\n', encoding="utf-8", newline="\n")
    for f in fbin.iterdir():
        f.chmod(f.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

    def run(mode, busy, extra=None, args=("feature/x",)):
        (TMP / "flock_count").unlink(missing_ok=True)
        env = {k: v for k, v in os.environ.items() if not k.startswith(("GATE", "ENTRY_"))}
        env.update({"HOME": str(home), "USERPROFILE": str(home), "GATE_HOME": str(home), "GATE2_PYTHON": "python3",
                    "PATH": f"{fbin.as_posix()}:{os.environ.get('PATH', '')}" if os.name != "nt" else f"{fbin}{os.pathsep}{os.environ.get('PATH', '')}",
                    "FAKE_FLOCK_BUSY": str(busy), "FAKE_FLOCK_COUNT": str(TMP / "flock_count"), "FAKE_FLOCK_LOG": str(TMP / "flock.log"),
                    "FAKE_ENGINE_MODE": mode, "ENTRY_LOCK_SLICE": "1", "ENTRY_SKIP_PLAN": "1",
                    "GATE_HOLDER_FILE": str(home / "holder.json"), "GATE_LOCK_FILE": str(home / "gate.lock"), **(extra or {})})
        p = subprocess.run([bash, str(g2 / "branch_check.sh"), *args], env=env, capture_output=True, text=True, timeout=300)
        return p.returncode, p.stdout + p.stderr

    rc, out = run("pass", 2)
    vmd = res / f"entry_feature-x_{fsha}.md"
    vjs = res / f"entry_feature-x_{fsha}.json"
    check("branch_check.sh: green run -> exit 0", rc == 0, out[-1500:])
    check("queued while the tests lock was busy (waited, did not fail)", int((TMP / "flock_count").read_text()) >= 3 and "queued" in out, out[-800:])
    check("no ~/.gate_fast_enabled needed, red nightly ignored (information only)", not (home / ".gate_fast_enabled").exists() and rc == 0)
    calls = [json.loads(l) for l in (home / "engine_calls.jsonl").read_text().splitlines()]
    a = calls[-1]["argv"]
    check("engine ran with --select-base origin/main, GATE_SELECT_ENABLE=1, separate results dir",
          "--select-base" in a and a[a.index("--select-base") + 1] == "origin/main" and calls[-1]["select_enable"] == "1"
          and Path(calls[-1]["results"]).name == "entry", calls[-1])
    check("verdict files entry_<branch>_<sha>.md + .json in ~/smplwise-results", vmd.exists() and vjs.exists(), sorted(p.name for p in res.iterdir()))
    if vjs.exists():
        j = json.loads(vjs.read_text(encoding="utf-8"))
        check("verdict JSON: GREEN, base origin/main, the queue wait recorded", j["verdict"] == "GREEN" and j["base"] == "origin/main" and j["waited_s"] >= 0, j)
    check("dashboard status of release gates untouched", not (res / "gate_status.json").exists())
    check("holder released after the run", not (home / "holder.json").exists())

    rc, out = run("fail", 0)
    j = json.loads(vjs.read_text(encoding="utf-8")) if vjs.exists() else {}
    check("red run -> exit 1, failure named in the JSON", rc == 1 and j.get("verdict") == "RED" and "tests/test_real.py::t" in j.get("failures", []), out[-1500:])

    rc, out = run("pass", 0, args=("no/such-branch",))
    check("unknown branch -> exit 1 with a clear message, no engine call", rc == 1 and "not found" in out, out[-600:])
    rc, out = run("pass", 0, args=("main",))
    check("main itself is refused (nothing to compare)", rc != 0 and "main" in out, out[-600:])
    rc, out = run("pass", 99, extra={"ENTRY_LOCK_WAIT": "2"})
    j = json.loads(vjs.read_text(encoding="utf-8")) if vjs.exists() else {}
    check("queue limit reached -> NOT_RUN verdict, exit 1 (never green)", rc == 1 and j.get("verdict") == "NOT_RUN", out[-800:])
    (home / ".gate-pending").write_text("")
    rc, out = run("pass", 0, extra={"ENTRY_LOCK_WAIT": "2"})
    n_flock = int((TMP / "flock_count").read_text()) if (TMP / "flock_count").exists() else 0
    check("a pending release gate goes first (the lock is not even tried)", rc == 1 and n_flock == 0 and "a release gate goes first" in out, out[-600:])
    (home / ".gate-pending").unlink()
    print("        sample verdict file:\n" + "\n".join("        | " + l for l in vmd.read_text(encoding="utf-8").splitlines()) if vmd.exists() else "")


try:
    part_a()
    part_b()
except Exception as e:   # noqa: BLE001
    import traceback
    traceback.print_exc()
    check("selftest crashed", False, f"{type(e).__name__}: {e}")
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print("SELFTEST PASSED" if not BAD else f"SELFTEST FAILED: {BAD}")
sys.exit(0 if not BAD else 1)
