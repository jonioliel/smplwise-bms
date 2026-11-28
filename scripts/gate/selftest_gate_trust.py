#!/usr/bin/env python3
"""Self-test of GATE-TRUST-2540 (review findings TR-05, TR-07, TR-09), with FAKE data only: a throw-away git repository and fake gate
reports in a temp directory. No runner, no real suite, no network; works on Windows (Git for Windows) and Linux.

  python3 scripts/gate/selftest_gate_trust.py      -> one OK / BROKEN line per case, last line "SELFTEST PASSED", exit 0 (1 = broken)

TR-05  the blocking backend lint lane lints the tree it is given (the gate's worktree), says which tree, `decide` no longer lints
       ~/smplwisebms, and release_gate2.sh runs the lane on its worktree after the checkout (for an --after run too).
TR-07  the count-drop baseline: the tracked file is a floor, raised per category by the newest GREEN FULL run in the results
       directories; per-category thresholds (backend 0.90 ...); the 26.11 nightly case (31,941 of 44,902 backend) is RED.
TR-09  a targeted --after run needs a coverage anchor: a completed full run (green, or red of the same branch) or a green nightly at an
       ancestor within N commits / H hours / F product files; otherwise release_gate2.sh runs the FULL tier and says why.
"""
import datetime as dt
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
TMP = Path(tempfile.mkdtemp(prefix="gate_trust_selftest_"))
for _k in [k for k in os.environ if k.startswith(("GATE_", "GATE2_"))]:
    del os.environ[_k]
os.environ["GATE_HOME"] = str(TMP / "home")
os.environ["GATE_RESULTS_DIR"] = str(TMP / "results")
(TMP / "home").mkdir()
(TMP / "results").mkdir()
sys.path.insert(0, str(HERE))
BAD = []


def check(name, cond, detail=""):
    print(("OK      " if cond else "BROKEN  ") + name + ("" if cond else f"   <- {str(detail)[:700]}"))
    if not cond:
        BAD.append(name)


def wj(p, d):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(d), encoding="utf-8")


NOW = dt.datetime(2026, 11, 26, 12, 0, tzinfo=dt.timezone.utc)


def ts(hours_ago):
    return (NOW - dt.timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%S%z")


def report(sha, branch="release/2540-train", verdict="pass", full=True, hours_ago=1, items=(), backend=100, tier="L"):
    d = {"branch": branch, "sha": sha, "tier": tier, "verdict": verdict, "finished": ts(hours_ago),
         "counts": {"backend": {"pass": backend, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}}, "items": list(items)}
    if not full:
        d["selection"] = {"base": "v2.53.0", "reduced": {"backend": "10 of 1000 files"}}
    return d


def main_part_tr05():
    import gate_entry as ge
    import lint_backend as lb
    seen = []
    orig = lb.run
    lb.run = lambda root: (seen.append(Path(root)), {"state": "findings", "blocking": True, "total": 1, "by_code": {"F821": 1},
                                                     "by_area": {"routers": 1}, "sample": ["x.py:1 F821 undefined name"], "root": str(root)})[1]
    try:
        wt = TMP / "work" / "gate-release-2540-train"
        buf = io.StringIO()
        txt, blocked = ge.backend_lint_lane(buf, wt, TMP / "lint.json")
        check("TR-05 lint lane: lints the tree it is given (the gate's worktree), not the default ~/smplwisebms", seen == [wt], seen)
        check("TR-05 lint lane: a finding in a tree with the marker blocks", blocked is True, txt)
        rec = json.loads((TMP / "lint.json").read_text(encoding="utf-8"))
        check("TR-05 lint lane: the JSON record names the tree and says it blocked", rec.get("root") == str(wt) and rec.get("blocked") is True, rec)
        os.environ["GATE_BACKEND_LINT"] = "warn"
        check("TR-05 lint lane: GATE_BACKEND_LINT=warn reports and never blocks", ge.backend_lint_lane(io.StringIO(), wt)[1] is False)
        del os.environ["GATE_BACKEND_LINT"]
        seen.clear()
        old_out = sys.stdout
        sys.stdout = io.StringIO()
        try:
            rc = ge.main(["decide", "--results", str(TMP / "results"), "--flag", str(TMP / "no-flag")])
        finally:
            sys.stdout = old_out
        check("TR-05 decide: no longer lints (it ran before any worktree existed and linted ~/smplwisebms)", rc == 0 and seen == [], (rc, seen))
        sys.stdout = io.StringIO()
        old_err, sys.stderr = sys.stderr, io.StringIO()
        try:
            rc = ge.main(["decide", "--results", str(TMP / "results"), "--flag", str(TMP / "no-flag"), "--lint", "--root", str(wt)])
        finally:
            sys.stdout, sys.stderr = old_out, old_err
        check("TR-05 decide --lint --root: the old lane on an explicit tree, exit 3 when it blocks", rc == ge.LINT_BLOCK_RC and seen == [wt], (rc, seen))
    finally:
        lb.run = orig
    t = lb.text({"state": "ok", "blocking": True, "total": 0, "by_code": {}, "by_area": {}, "root": "/home/sw/work/gate-x"})
    check("TR-05 lint text: the summary names the tree it linted", "in /home/sw/work/gate-x" in t, t)
    # release_gate2.sh: the lane runs on $WT after the checkout and before the engine; gate_release.sh no longer asks decide to lint
    sh = (HERE / "release_gate2.sh").read_text(encoding="utf-8")
    i_co, i_lint, i_eng = sh.find('SHA="$(git -C "$WT" rev-parse --short HEAD)"'), sh.find('lint_lane "$WT"'), sh.find('timeout -k 30 "$GATE_TOTAL_SECS"')
    check("TR-05 release_gate2.sh: lint_lane \"$WT\" right after the worktree checkout, before the engine", 0 < i_co < i_lint < i_eng, (i_co, i_lint, i_eng))
    check("TR-05 release_gate2.sh: the lane passes the worktree as --root and GATE_LINT_ROOT",
          'GATE_LINT_ROOT="$1"' in sh and 'lint --root "$1"' in sh, "")
    gr = (HERE / "gate_release.sh").read_text(encoding="utf-8")
    dec = [ln for ln in gr.splitlines() if "gate_entry.py\" decide" in ln]
    check("TR-05 gate_release.sh: decide is called without --lint", dec and all("--lint" not in ln for ln in dec), dec)


def git(repo, *a):
    return subprocess.run(["git", "-C", str(repo), "-c", "user.email=t@t", "-c", "user.name=t", *a], capture_output=True, text=True, check=True).stdout.strip()


def main_part_tr09():
    import gate_entry as ge
    import gate2_verdict as g2v
    repo = TMP / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", str(repo)], check=True)
    git(repo, "config", "core.autocrlf", "false")
    shas = []
    for i in range(6):
        p = repo / "frontend" / "src" / f"f{i}.ts"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f"export const v{i} = {i};\n", encoding="utf-8")
        git(repo, "add", "-A")
        git(repo, "commit", "-qm", f"c{i}")
        shas.append(git(repo, "rev-parse", "--short", "HEAD"))
    git(repo, "checkout", "-q", "-b", "side", shas[2])
    (repo / "docs.txt").write_text("side\n", encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "side")
    side = git(repo, "rev-parse", "--short", "HEAD")
    head = shas[5]
    BR = "release/2540-train"

    def res(name, docs):
        d = TMP / "anchor" / name
        for fn, doc in docs.items():
            wj(d / fn, doc)
        return d

    def run(d, after_sha=None, **kw):
        after = TMP / "anchor" / "after.json"
        wj(after, report(after_sha or shas[3], full=False, verdict="fail"))
        return ge.anchor_check(d, repo, head, BR, after, NOW, quarantine=TMP / "no_quarantine.json", **kw)

    sel_only = {f"gate_x_{shas[3]}.json": report(shas[3], full=False, verdict="fail"), f"gate_x_{shas[4]}.json": report(shas[4], full=False)}
    r = run(res("sel_only", sel_only))
    check("TR-09 only diff-selection runs behind the head (the 2.51.0 shape without its full run) -> no anchor", not r["ok"] and "no full run" in r["why"], r)
    red_same = {f"gate_release-2540-train_{shas[2]}.json": report(shas[2], verdict="fail", hours_ago=5), **sel_only}
    r = run(res("red_same", red_same))
    check("TR-09 a completed RED full run of the same branch 3 commits back is the anchor (the normal full-red -> --after flow)",
          r["ok"] and r["anchor"]["sha"] == shas[2] and r["anchor"]["commits"] == 3 and r["anchor"]["product_files"] == 3, r)
    red_other = {f"gate_release-2530-train_{shas[2]}.json": report(shas[2], branch="release/2530-train", verdict="fail")}
    r = run(res("red_other", red_other))
    check("TR-09 a RED full run of ANOTHER branch is not an anchor (its failures are re-run by nobody)", not r["ok"], r)
    green_other = {f"gate_release-2530-train_{shas[2]}.json": report(shas[2], branch="release/2530-train")}
    check("TR-09 a GREEN full run of another branch at an ancestor is an anchor", run(res("green_other", green_other))["ok"])
    old = {f"gate_release-2540-train_{shas[2]}.json": report(shas[2], hours_ago=40)}
    r = run(res("old", old))
    check("TR-09 a full run older than 36 h is not an anchor", not r["ok"] and "36 h" in r["why"], r)
    r = run(res("far", {f"gate_release-2540-train_{shas[0]}.json": report(shas[0])}), max_commits=3)
    check("TR-09 a full run too many commits behind is not an anchor, and the summary says how far", not r["ok"] and "5 commits behind (limit 3)" in r["why"], r)
    r = run(res("prod", {f"gate_release-2540-train_{shas[1]}.json": report(shas[1])}), max_product_files=2)
    check("TR-09 too many product source files changed since the full run -> no anchor", not r["ok"] and "product source files changed" in r["why"], r)
    r = run(res("notanc", {f"gate_release-2540-train_{side}.json": report(side)}))
    check("TR-09 a full run on another line (not an ancestor) is not an anchor", not r["ok"] and "not an ancestor" in r["why"], r)
    broken = {f"gate_release-2540-train_{shas[2]}.json": report(shas[2], verdict="fail", items=[{"category": "gate", "id": "90-minute budget exhausted", "status": "FAIL"}])}
    check("TR-09 a full run that did not complete (engine-level failure) is not an anchor", not run(res("broken", broken))["ok"])
    # FIX-GATE-2570 (CD2-01): a red full run with a crashed backend shard - its tests ran in no run
    shard_items = [{"category": "backend", "id": "shard 3", "status": "FAIL", "reason": "no pytest summary"}]
    crashed = {f"gate_release-2540-train_{shas[2]}.json": report(shas[2], verdict="fail", items=shard_items)}
    r = run(res("crashed", crashed))
    check("CD2-01 a red full run with a crashed shard is no anchor for another --after report, and the summary says why",
          not r["ok"] and "process-level failure" in r["why"] and "shard 3" in r["why"], r)
    named_doc = report(shas[2], verdict="fail", items=[dict(shard_items[0], files=["test_a.py", "test_b.py"])])
    named = res("crashed_named", {f"gate_release-2540-train_{shas[2]}.json": named_doc})
    after_self = TMP / "anchor" / "after_self.json"
    wj(after_self, named_doc)
    r = ge.anchor_check(named, repo, head, BR, after_self, NOW, quarantine=TMP / "no_quarantine.json")
    check("CD2-01 ... it is the anchor when it IS the --after report and the shard named its files (they are re-selected whole)",
          r["ok"] and r["anchor"]["sha"] == shas[2], r)
    bare_doc = report(shas[2], verdict="fail", items=shard_items)
    wj(after_self, bare_doc)
    r = ge.anchor_check(res("crashed_bare", {f"gate_release-2540-train_{shas[2]}.json": bare_doc}), repo, head, BR, after_self, NOW,
                        quarantine=TMP / "no_quarantine.json")
    check("CD2-01 ... but not when the shard item names no files (a report of an older engine): FULL tier", not r["ok"] and "names no files" in r["why"], r)
    nobe = {f"gate_release-2540-train_{shas[2]}.json": report(shas[2], backend=0)}
    check("TR-09 a full run in which the backend did not run is not an anchor", not run(res("nobe", nobe))["ok"])
    ngreen = {f"nightly/gate_main_{shas[1]}.json": report(shas[1], branch="main", hours_ago=10)}
    r = run(res("ngreen", ngreen))
    check("TR-09 a GREEN nightly at an ancestor is an anchor", r["ok"] and r["anchor"]["kind"] == "nightly", r)
    nred = {f"nightly/gate_main_{shas[1]}.json": report(shas[1], branch="main", verdict="fail", hours_ago=10,
                                                            items=[{"category": "preview", "id": "a.spec.ts:1 [mobile] t", "status": "FAIL"}])}
    check("TR-09 a RED nightly is not an anchor", not run(res("nred", nred))["ok"])
    r = run(res("red_same2", red_same), after_sha=side)
    check("TR-09 an --after report from another line (not an ancestor of the head) -> no anchor", not r["ok"] and "--after report" in r["why"], r)
    r = run(res("sel_only2", sel_only), accept="lead: docs-only fix, nightly covers it")
    check("TR-09 --accept-no-anchor keeps the targeted run, with the reason on record", r["ok"] and "docs-only" in r.get("accepted", "") and "ACCEPTED" in r["why"], r)
    side_files = {f"gate_x_{shas[3]}.engine.json": {"verdict": "pass", "sha": shas[3], "tier": "L"}, f"gate_x_{shas[3]}.anchor.json": {"ok": True}}
    check("TR-09 side records (.engine/.anchor json) never count as a run", not run(res("side", side_files))["ok"])
    # the CLI as release_gate2.sh calls it: rc and the JSON record
    out = TMP / "anchor" / "cli.anchor.json"
    after = TMP / "anchor" / "after.json"
    old_out, sys.stdout = sys.stdout, io.StringIO()
    try:
        rc1 = ge.main(["anchor", "--results", str(TMP / "anchor" / "sel_only"), "--repo", str(repo), "--head", head, "--branch", BR,
                       "--after", str(after), "--json", str(out), "--now", NOW.strftime("%Y-%m-%dT%H:%M:%S%z"),
                       "--quarantine", str(TMP / "no_quarantine.json")])
        rec1 = json.loads(out.read_text(encoding="utf-8"))
        rc0 = ge.main(["anchor", "--results", str(TMP / "anchor" / "red_same"), "--repo", str(repo), "--head", head, "--branch", BR,
                       "--after", str(after), "--json", str(out), "--now", NOW.strftime("%Y-%m-%dT%H:%M:%S%z"),
                       "--quarantine", str(TMP / "no_quarantine.json")])
    finally:
        sys.stdout = old_out
    check("TR-09 CLI: rc 1 + JSON record without an anchor, rc 0 with one", rc1 == 1 and rec1["ok"] is False and rc0 == 0, (rc1, rc0, rec1))
    # the gate-2 summary names the decision
    rp = TMP / "anchor" / f"gate_release-2540-train_{head}.json"
    wj(rp, report(head))
    wj(rp.with_name(rp.name[:-5] + ".anchor.json"), rec1)
    wj(rp.with_name(rp.name[:-5] + ".lint.json"), {"state": "ok", "total": 0, "root": "/home/sw/work/gate-release-2540-train", "blocked": False})
    lines = g2v.side_records(rp)
    check("TR-09 / TR-05 gate-2 summary: says the targeted run became FULL and why, and which tree the lint lane linted",
          any("FULL tier instead" in x and "no full run" in x for x in lines) and any("gate-release-2540-train" in x and "ok" in x for x in lines), lines)
    sh = (HERE / "release_gate2.sh").read_text(encoding="utf-8")
    i_an, i_nh, i_plan = sh.find('if ! anchor_check "$REPO"'), sh.find('NH="$("$PY3" "$G2/gate2_select.py" nightly'), sh.find('PLAN="$("$PY3" "$G2/gate2_select.py" plan')
    check("TR-09 release_gate2.sh: the anchor check runs before the selection; no anchor -> FULL=1 and no --after",
          0 < i_an < i_nh < i_plan and 'FULL=1; AFTER=""' in sh[i_an:i_nh], (i_an, i_nh, i_plan))


def main_part_tr07():
    import release_gate as g
    res = TMP / "results"
    g.RES = res

    def full_report(name, sha, cand, rows_state="ok", verdict="pass", days_ago=1, reduced=False, tier="L"):
        doc = {"branch": "release/x", "sha": sha, "tier": tier, "verdict": verdict,
               "finished": (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days_ago)).strftime("%Y-%m-%dT%H:%M:%S%z"),
               "baseline_candidate": cand, "baseline_check": {k: {"state": rows_state} for k in cand}}
        if reduced:
            doc["selection"] = {"reduced": {"backend": "1 of 2"}}
        wj(res / name, doc)

    # 2.50.0's green full gate (24.11), a newer red full run (must not count), a newer selection run (must not count), an older green
    full_report("gate_release-2500-train_bdf28fc37.json", "bdf28fc37", {"backend": 44902, "preview": 23818, "dev": 1126, "pixel": 390, "fixture": 28}, days_ago=2)
    full_report("gate_release-2510-train_df3ee6d12.json", "df3ee6d12", {"backend": 45401, "preview": 23907}, verdict="fail", days_ago=1)
    full_report("gate_release-2520-train_20fc43ef9.json", "20fc43ef9", {"backend": 4254, "preview": 4161}, rows_state="selection", reduced=True, days_ago=0.5)
    full_report("gate_release-2490-train_f73c20728.json", "f73c20728", {"backend": 44636, "preview": 23435}, days_ago=3)
    full_report("gate_release-2400-train_aaaaaaaaa.json", "aaaaaaaaa", {"backend": 99999}, days_ago=40)                 # too old
    full_report("gate_release-2540-train_bbbbbbbbb.selection.json", "bbbbbbbbb", {"backend": 88888}, days_ago=0.1)    # a side file
    full_report("gate_release-2540-train_ccccccccc.json", "ccccccccc", {"backend": 77777}, tier="M", days_ago=0.1)       # another tier
    ref = g.reference_baseline("L")
    check("TR-07 reference: the newest GREEN FULL tier-L run per category (red, selection, old, side files, other tier ignored)",
          ref.get("backend", {}).get("value") == 44902 and ref["backend"]["report"].startswith("gate_release-2500") and ref.get("dev", {}).get("value") == 1126, ref)
    floor = {"tiers": {"L": {"tsc": 1, "preview": 14971, "backend": 17611, "dev": 935, "pixel": 175, "fixture": 15}}}
    eff, warns = g.effective_baseline(floor, "L", ref)
    check("TR-07 effective baseline: the month-old tracked file is only a floor, raised by the green full run",
          eff["tiers"]["L"]["backend"] == 44902 and eff["tiers"]["L"]["tsc"] == 1 and "bdf28fc37" in eff["sources"]["backend"], eff)
    lower = {"tiers": {"L": {"backend": 50000}}}
    check("TR-07 effective baseline: a floor above the reference stays", g.effective_baseline(lower, "L", ref)[0]["tiers"]["L"]["backend"] == 50000)

    def counts(**kw):
        g.COUNTS.clear(); g.ITEMS.clear(); g.BASELINE_ROWS.clear(); g.ALLOW_DROP = ""
        for k, v in kw.items():
            g.COUNTS[k] = {"pass": v, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}

    # the 26.11 nightly on main @ 3d71fb183: backend 31,941 (71 percent of 44,902)
    counts(tsc=1, preview=24033, backend=31941, dev=1135, pixel=396, fixture=28)
    g.check_baselines({**floor, "thresholds": {"backend": 0.70}}, "L")
    check("TR-07 the old rule for comparison: against the stale floor (17,611) at 0.70 a 31,941-test backend passes",
          g.BASELINE_ROWS["backend"]["state"] == "ok", g.BASELINE_ROWS)
    counts(tsc=1, preview=24033, backend=31941, dev=1135, pixel=396, fixture=28)
    g.check_baselines(eff, "L")
    check("TR-07 after: 31,941 of 44,902 backend tests (71 percent) is RED under the backend threshold 0.90",
          g.compute_verdict([]) == "fail" and g.BASELINE_ROWS["backend"]["state"] == "low" and g.BASELINE_ROWS["backend"]["threshold"] == 0.90
          and "bdf28fc37" in g.BASELINE_ROWS["backend"]["source"], g.BASELINE_ROWS.get("backend"))
    counts(tsc=1, preview=23435, backend=44636, dev=1126, pixel=380, fixture=28)       # 2.49.0's real green full counts: inside every threshold
    g.check_baselines(eff, "L")
    check("TR-07 the real green full runs (2.49.0 vs 2.50.0) stay green under the per-category thresholds", g.compute_verdict([]) == "pass", g.BASELINE_ROWS)
    counts(tsc=1, preview=23818, backend=44902, dev=1126, pixel=340, fixture=28)       # pixel 87 percent: inside 0.85
    g.check_baselines(eff, "L")
    check("TR-07 per lane: pixel at 87 percent passes its 0.85 threshold", g.compute_verdict([]) == "pass" and g.BASELINE_ROWS["pixel"]["threshold"] == 0.85, g.BASELINE_ROWS["pixel"])
    os.environ["GATE_DROP_THRESHOLD_BACKEND"] = "0.5"
    check("TR-07 GATE_DROP_THRESHOLD_<CATEGORY> overrides one lane", g.drop_threshold("backend", eff) == 0.5 and g.drop_threshold("preview", eff) == 0.90)
    del os.environ["GATE_DROP_THRESHOLD_BACKEND"]
    check("TR-07 the baseline file's thresholds win over the engine defaults", g.drop_threshold("preview", {"thresholds": {"preview": 0.8}}) == 0.8)
    os.environ["GATE_DROP_THRESHOLD"] = "0.6"
    check("TR-07 GATE_DROP_THRESHOLD still sets every lane (the old knob)", g.drop_threshold("backend", {"thresholds": {"backend": 0.95}}) == 0.6)
    del os.environ["GATE_DROP_THRESHOLD"]
    counts(tsc=1, preview=23818, backend=30000, dev=1126, pixel=390, fixture=28)
    g.ALLOW_DROP = "selftest: suite split on purpose"
    g.check_baselines(eff, "L")
    check("TR-07 --allow-count-drop still waives, with the reason", g.compute_verdict([]) == "pass" and g.BASELINE_ROWS["backend"]["state"] == "waived")
    # a waived green full run becomes the new reference (the lead accepted the new count)
    full_report("gate_release-2550-train_ddddddddd.json", "ddddddddd", {"backend": 30000}, rows_state="waived", days_ago=0.2)
    check("TR-07 a waived green full run is the new reference for that category", g.reference_baseline("L")["backend"]["value"] == 30000)
    empty = TMP / "empty_results"
    empty.mkdir()
    _, w = g.effective_baseline(floor, "L", g.reference_baseline("L", dirs=[empty]))
    check("TR-07 no green full run in 30 days: the floor only, with a warning in the report", any("tracked floor only" in x for x in w), w)
    g.RES = res / "nightly"
    check("TR-07 the nightly (results in .../nightly) also reads the release gates' runs", res in g.baseline_ref_dirs() and (res / "nightly") in g.baseline_ref_dirs(), g.baseline_ref_dirs())
    tracked = json.loads((HERE / "gate_baselines.json").read_text(encoding="utf-8"))
    check("TR-07 the tracked floor is today's suite (2.50.0 green full run), with per-lane thresholds",
          tracked["tiers"]["L"]["backend"] >= 44000 and tracked["tiers"]["L"]["preview"] >= 23000 and tracked["thresholds"]["backend"] == 0.90, tracked["tiers"])


try:
    for part in (main_part_tr05, main_part_tr09, main_part_tr07):
        try:
            part()
        except Exception as exc:  # noqa: BLE001 - a crash is a broken part, not a pass; the other parts still run
            check(f"{part.__name__} crashed: {type(exc).__name__}: {str(exc)[:300]}", False)
finally:
    shutil.rmtree(TMP, ignore_errors=True)
print("SELFTEST PASSED" if not BAD else f"SELFTEST FAILED ({len(BAD)}): " + "; ".join(BAD))
sys.exit(0 if not BAD else 1)
