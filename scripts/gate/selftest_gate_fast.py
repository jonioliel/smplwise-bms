#!/usr/bin/env python3
"""Self-test of the GATE-FAST-2291 tooling with FAKE data only (no runner, no browser, no test suite, no network):
phase budgets / derived cap / lateness, the entry rule (flag, green / explained / red / stale / missing nightly, tag rule),
the back-comparison table, the early layout stage picker, the engine's lateness hook and the early-stop report.
  python scripts/gate/selftest_gate_fast.py        (exit 0 = all OK; each case prints OK / BROKEN; works on Windows and POSIX)
"""
import datetime as dt
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
TMP = Path(tempfile.mkdtemp(prefix="gate_fast_selftest_"))
# HERMETIC: nothing of the machine the test runs on may leak in. Every GATE_* knob of the caller is dropped, HOME /
# USERPROFILE point into the temp dir (so ~/smplwise-results, ~/.gate_fast_enabled, the holder and lock files are never
# the real ones), and the seed budgets used by the assertions are the test's OWN fixture (not the file next to the script,
# which differs between the workstation and the runner).
for _k in [k for k in os.environ if k.startswith("GATE_")]:
    del os.environ[_k]
for _k in ("HOME", "USERPROFILE"):
    os.environ[_k] = str(TMP / "home")
os.environ["GATE_HOME"] = str(TMP / "home")
os.environ["GATE_RESULTS_DIR"] = str(TMP / "results")
os.environ["GATE_HOLDER_FILE"] = str(TMP / "home" / "holder.json")
os.environ["GATE_LOCK_FILE"] = str(TMP / "home" / "gate.lock")
os.environ["GATE_FAST_FLAG"] = str(TMP / "home" / "fast_flag")
(TMP / "home").mkdir()
(TMP / "results").mkdir()
sys.path.insert(0, str(HERE))
SEED = TMP / "seed_budgets.json"
SEED.write_text(json.dumps({"modes": {
    "full": {"tsc": 120, "build": 120, "playwright-pool": 9000, "backend-wait": 1800},
    "select": {"tsc": 120, "build": 120, "playwright-pool": 3300, "backend-wait": 900}}}), encoding="utf-8")
BAD = []


def check(name, cond, detail=""):
    print(("OK      " if cond else "BROKEN  ") + name + ("" if cond else f"  [{detail}]"))
    if not cond:
        BAD.append(name)


def wj(p, d):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(d), encoding="utf-8")


NOW = dt.datetime(2026, 10, 30, 12, 0, tzinfo=dt.timezone.utc)
def ts(h_ago):
    return (NOW - dt.timedelta(hours=h_ago)).strftime("%Y-%m-%dT%H:%M:%S%z")


try:
    import gate_budget as gb
    import gate_entry as ge
    import gate_backcompare as bc

    # ---- item 4: budgets, cap, lateness
    R = TMP / "results"
    seed_b = gb.derive_budgets(R, "select", SEED)
    check("seed budgets used without history", seed_b["playwright-pool"]["source"] == "seed" and seed_b["playwright-pool"]["budget_s"] == 3300)
    cap_seed = gb.total_cap(seed_b)
    check("cap = sum x 1.5 clamped", cap_seed == min(gb.CAP_MAX, max(gb.CAP_MIN, round(sum(v["budget_s"] for v in seed_b.values()) * 1.5))), str(cap_seed))
    wj(R / "gate_release-x_aaa1111.json", {"branch": "release/x", "sha": "aaa1111", "tier": "L", "verdict": "pass", "finished": ts(30),
        "selection": {"reduced": {"backend": "10 of 100"}}, "phases": [{"name": "tsc", "seconds": 100}, {"name": "playwright-pool", "seconds": 2000}]})
    wj(R / "gate_release-y_bbb2222.json", {"branch": "release/y", "sha": "bbb2222", "tier": "L", "verdict": "fail", "finished": ts(2),
        "selection": {"reduced": {"backend": "10 of 100"}}, "phases": [{"name": "tsc", "seconds": 9999}]})
    h = gb.derive_budgets(R, "select", SEED)
    check("history: previous passed run x 1.25, failed run ignored", h["tsc"]["budget_s"] == 125 and h["playwright-pool"]["budget_s"] == 2500, str(h["tsc"]))
    check("history of the other mode is not used for full", gb.derive_budgets(R, "full", SEED)["tsc"]["source"] == "seed")
    n = gb.late_note("tsc", 400, 125, load1=45.0, mem_mb=9000)
    check("lateness note names the overload cause", n["late_s"] == 275 and "overload" in n["cause"] and "מאחר" in n["he"])
    check("lateness note without load = more work", "more work" in gb.late_note("tsc", 400, 125, 5, 9000)["cause"])
    check("cap CLI exit 2 without data", gb.main(["cap", "--results", str(TMP / "none"), "--seed", str(TMP / "none.json")]) == 2)

    # ---- item 2: the entry rule
    flag = TMP / "flag"
    nd = R / "nightly"
    def night(name, h_ago, verdict, items=(), be=100):
        wj(nd / name, {"sha": "n" + name[-6:-5], "verdict": verdict, "finished": ts(h_ago), "counts": {"backend": {"pass": be}}, "items": list(items)})
    qf = TMP / "quarantine.json"
    wj(qf, {"entries": [{"match": "test_flaky.py", "category": "backend", "ticket": "T-1", "owner": "lead", "added": "2026-10-28", "expires": "2026-11-04", "reason": "x"}]})
    d = ge.decide(R, qf, NOW, flag=str(flag))
    check("flag absent -> FULL (default off)", d["mode"] == "full" and d["state"] == "fast-gate-off", str(d))
    flag.write_text("on")
    check("flag on, no nightly -> FULL missing", ge.decide(R, qf, NOW, flag=str(flag))["state"] == "missing")
    night("gate_main_g.json", 6, "pass")
    d = ge.decide(R, qf, NOW, flag=str(flag))
    check("green nightly -> SELECT", d["mode"] == "select" and d["state"] == "green", str(d))
    check("--full wins", ge.decide(R, qf, NOW, flag=str(flag), full_requested=True)["mode"] == "full")
    shutil.rmtree(nd)
    night("gate_main_e.json", 5, "fail", [{"category": "backend", "status": "FAIL", "id": "tests/test_flaky.py::test_a"}])
    d = ge.decide(R, qf, NOW, flag=str(flag))
    check("red only through quarantined tests -> SELECT explained", d["mode"] == "select" and d["state"] == "explained" and d["explained"], str(d))
    q13 = TMP / "quarantine13.json"      # ENTRY-CHECK-2310: a 13-day entry is invalid (max 7) and explains nothing
    wj(q13, {"entries": [{"match": "test_flaky.py", "category": "backend", "ticket": "T-1", "owner": "lead", "added": "2026-10-28", "expires": "2026-11-10", "reason": "x"}]})
    d13 = ge.decide(R, q13, NOW, flag=str(flag))
    check("a quarantine longer than 7 days explains nothing -> FULL red", d13["mode"] == "full" and d13["state"] == "red", str(d13))
    shutil.rmtree(nd)
    night("gate_main_r.json", 5, "fail", [{"category": "backend", "status": "FAIL", "id": "tests/test_flaky.py::test_a"},
                                           {"category": "preview", "status": "FAIL", "id": "layout-x.spec.ts:10 something"}])
    d = ge.decide(R, qf, NOW, flag=str(flag))
    check("red with a real failure -> FULL, named", d["mode"] == "full" and d["state"] == "red" and any("layout-x" in x for x in d["failing"]), str(d))
    shutil.rmtree(nd)
    night("gate_main_s.json", 50, "pass")
    check("stale nightly -> FULL", ge.decide(R, qf, NOW, flag=str(flag))["state"] == "stale")
    shutil.rmtree(nd)
    night("gate_main_b.json", 3, "pass", [{"category": "gate", "status": "FAIL", "id": "x"}])
    check("engine-level failure in the nightly -> FULL broken", ge.decide(R, qf, NOW, flag=str(flag))["state"] == "broken")
    shutil.rmtree(nd)
    night("gate_main_t.json", 24 * 3, "pass")
    check("tag rule: full green nightly within 7 days", ge.tag_ok(R, 7, NOW)["ok"] and not ge.tag_ok(R, 1, NOW)["ok"])
    check("rule text printed", "FULL tier" in ge.RULE_TEXT and "SELECT" in ge.RULE_TEXT)

    # ---- item 1: back-comparison with a stored (fake) selection
    doc = {"branch": "release/z", "sha": "ccc3333", "tier": "L", "verdict": "fail", "started": ts(10), "wall_seconds": 10740, "schedule": "v2",
           "items": [{"category": "backend", "status": "FAIL", "id": "tests/test_a.py::t"},
                     {"category": "preview", "status": "FAIL", "id": "layout-a.spec.ts:1 x"},
                     {"category": "preview", "status": "FAIL", "id": "layout-b.spec.ts:1 x"},
                     {"category": "preview", "status": "FAIL", "id": "heavy.spec.ts:1 x"}]}
    sel = {"full": {"backend": [], "frontend": []}, "deferred_to_nightly": {"heavy.spec.ts": 20.0},
           "backend": {"selected": ["test_a.py"], "total": 300}, "frontend": {"selected": ["layout-a.spec.ts"], "dropped": ["layout-b.spec.ts", "heavy.spec.ts"], "total": 200}}
    night("gate_main_p.json", 14, "pass")
    row = bc.compare_one(doc, sel, ge.nightly_reports(R), [])
    check("backcompare: covered / deferred / missed", row["frontend"]["covered"] == ["layout-a.spec.ts"] and row["frontend"]["deferred"] == ["heavy.spec.ts"]
          and row["frontend"]["missed"] == ["layout-b.spec.ts"] and row["backend"]["missed"] == [], str(row["frontend"]))
    check("backcompare: nightly state at gate start", row["nightly"]["state"] == "green")
    md = bc.to_markdown([row], [])
    check("backcompare: markdown has the MISSED total", "MISSED by the selection: 1" in md)
    check("backcompare: stored selection file is used", bc.selection_for({**doc, "branch": "release/z"}, None, TMP, {}) is not None if (TMP / "gate_release-z_ccc3333.selection.json").exists() else True)

    # ---- item 3 + 4 in the engine (import only; nothing is started)
    import release_gate as rg
    cls = {"rest": {n: {"projects": ["desktop"], "workers1": False, "one": False} for n in
                    ["layout-noscroll-297.spec.ts", "dropdown-capsule.spec.ts", "evidence-mobile.spec.ts", "layout-tickets-board.spec.ts", "layout-big.spec.ts"]},
           "dev": {}, "fixture": {}, "pixel": [], "fixture_other": {}, "tablet_dropped": []}
    costs = {"layout-noscroll-297.spec.ts": 100.0, "dropdown-capsule.spec.ts": 50.0, "evidence-mobile.spec.ts": 60.0, "layout-tickets-board.spec.ts": 99999.0}
    early = rg.pick_early(cls, costs)
    check("early picker takes layout / dropdown / mobile specs only", sorted(early) == ["dropdown-capsule.spec.ts", "evidence-mobile.spec.ts", "layout-noscroll-297.spec.ts"], str(sorted(early)))
    os.environ["GATE_EARLY_LAYOUT"] = "0"
    check("GATE_EARLY_LAYOUT=0 switches the stage off", rg.pick_early(cls, costs) == {})
    del os.environ["GATE_EARLY_LAYOUT"]
    ej = rg.plan_early_jobs(cls, early, costs)
    check("early jobs are labelled early_ and cover every early spec", ej and all(j["label"].startswith("early_") for j in ej)
          and sorted(x for j in ej for x in j["names"]) == sorted(early))
    # lateness hook of the engine
    rg.BUDGETS.update({"tsc": {"budget_s": 1, "source": "test"}})
    rg.STATE["sha"] = "ddd4444"
    rg.TAG = "release-z"
    with rg.Phase("tsc", "tsc"):
        import time as _t
        _t.sleep(2.2)
    check("engine records a late phase with budget and cause", rg.PHASES[-1].get("late_s", 0) >= 1 and rg.LATE and rg.LATE[-1]["phase"] == "tsc")
    st = json.loads((TMP / "results" / "gate_status.json").read_text(encoding="utf-8"))
    check("gate_status.json carries the late list at once", st.get("late") and "late" in st["late"][0])
    # running-phase lateness is reported once, without waiting for the end
    rg.LATE.clear(); rg.LATE_SEEN.clear(); rg.BUDGETS["build"] = {"budget_s": 1, "source": "test"}
    rg.STATE["phase"], rg.STATE["phase_t0"] = "build", _t.time() - 5
    rg.check_running_phase_late(); rg.check_running_phase_late()
    check("running phase past budget reported exactly once", len(rg.LATE) == 1 and rg.LATE[0]["running"])
    # early-stop report
    rg.BR = "release/z"
    rg.EARLY.update(specs=sorted(early))
    rg.write_early_report([{"category": "preview", "id": "layout-noscroll-297.spec.ts:20 no scroll [mobile]", "status": "FAIL", "reason": "page scrolls 14px"}])
    em = (TMP / "results" / "gate_release-z_ddd4444.early.md").read_text(encoding="utf-8")
    ej2 = json.loads((TMP / "results" / "gate_release-z_ddd4444.early.json").read_text(encoding="utf-8"))
    check("early report names the failing test and has no verdict key", "layout-noscroll-297" in em and "verdict" not in ej2 and ej2["failures"])
    check("early report is never read as a gate history report", rg.gate_history("x@y", []) is not None)
    # ---- item 5: checkpoint + resume (engine functions, no process started)
    rg.COUNTS.clear(); rg.ITEMS.clear()
    rg.RESUME = True
    rg.TAG, rg.BR = "release-c", "release/c"
    rg.STATE["sha"] = "eee5555"
    rg.TIER, rg.SELECT_BASE = "L", ""
    rg.ckpt_init("e" * 40)
    with rg.Recording("preview_a", "sigA"):
        rg.count("preview", "pass", 5); rg.count("preview", "fail"); rg.item("preview", "a.spec.ts:1 x", "FAIL", "failed again alone")
    with rg.Recording("backend", "bsig"):
        rg.count("backend", "pass", 100)
    try:
        with rg.Recording("crashed", "s"):
            raise RuntimeError("boom")
    except RuntimeError:
        pass
    check("a crashed unit is not committed", "crashed" not in rg.CKPT["units"])
    tot_before = (dict(rg.COUNTS["preview"]), len(rg.ITEMS))
    rg.COUNTS.clear(); rg.ITEMS.clear()
    rg.ckpt_init("e" * 40)      # a new run of the same sha with --resume loads the file
    check("same sha: units come back from the file", set(rg.CKPT["units"]) == {"preview_a", "backend"})
    check("reusable only with the same signature", rg.ckpt_reusable("backend", "bsig") and not rg.ckpt_reusable("backend", "other"))
    rg.ckpt_apply("preview_a"); rg.ckpt_apply("backend")
    check("resumed unit merges the same counts and items", rg.COUNTS["preview"] == tot_before[0] and len(rg.ITEMS) == tot_before[1] and rg.COUNTS["backend"]["pass"] == 100)
    rg.ckpt_init("f" * 40)
    check("different sha: nothing is reused", rg.CKPT["units"] == {})
    rg.ckpt_init("e" * 40)      # (the f-run overwrote the file with an empty unit list: write the units again)
    with rg.Recording("preview_a", "sigA"):
        rg.count("preview", "fail")
    with rg.Recording("backend", "bsig"):
        rg.count("backend", "pass", 1)
    rg.RERUN_FAILED = True
    rg.ckpt_init("e" * 40)
    check("rerun-failed: a unit with failures runs again, a clean one does not", not rg.ckpt_reusable("preview_a", "sigA") and rg.ckpt_reusable("backend", "bsig"))
    rg.RESUME = rg.RERUN_FAILED = False

    # ---- item 6: spec lint
    import lint_spec_waits as lw
    bad = "test('x', async ({page}) => {\n  await page.click('#open');\n  const r = await el.boundingBox();\n});\n"
    good = "test('x', async ({page}) => {\n  await page.click('#open');\n  await settle(page);\n  const r = await el.boundingBox();\n});\n"
    far = "test('x', async ({page}) => {\n  await page.click('#open');\n" + "  await foo();\n" * 9 + "  const r = await el.boundingBox();\n});\n"
    sup = "test('x', async ({page}) => {\n  await page.click('#open');\n  // lint-wait: ok\n  const r = await el.boundingBox();\n});\n"
    split = "test('a', async () => {\n  await page.click('#o');\n});\ntest('b', async () => {\n  const r = await el.boundingBox();\n});\n"
    check("lint flags a measure right after a click", len(lw.lint_text(bad)) == 1 and lw.lint_text(bad)[0][:2] == (2, 3))
    check("lint accepts settle(), distance, suppression, other test", not lw.lint_text(good) and not lw.lint_text(far) and not lw.lint_text(sup) and not lw.lint_text(split))

    # ---- item 9: Hebrew summary
    import gate_summary as gs
    rep = {"verdict": "fail", "resources": {"max_load1": 45.0}, "items": [
        {"category": "preview", "status": "FAIL", "id": "a.spec.ts:1", "reason": "page.goto: Timeout 30000ms exceeded"},
        {"category": "backend", "status": "FAIL", "id": "tests/test_x.py::t", "reason": "failed twice"},
        {"category": "preview", "status": "FLAKY", "id": "b.spec.ts:2", "reason": "own retry passed"},
        {"category": "dev", "status": "FAIL", "id": "c.spec.ts:3", "reason": "did not run (no time left to retry)"},
        {"category": "tsc", "status": "FAIL", "id": "tsc --noEmit", "reason": "rc=2"}]}
    sm = gs.summarize(rep)
    kinds = {i["id"]: gs.classify_item(i, 45.0)[0] for i in rep["items"]}
    check("summary: timeout under load 45 = run problem", kinds["a.spec.ts:1"] == "run")
    check("summary: failed twice = real, tsc = real, no time = run, flaky = run", kinds["tests/test_x.py::t"] == "real" and kinds["tsc --noEmit"] == "real"
          and kinds["c.spec.ts:3"] == "run" and kinds["b.spec.ts:2"] == "run")
    check("summary line is Hebrew and says likely", "כנראה" in sm["line"] and "אדום" in sm["line"] and "2 כשלים כנראה אמיתיים" in sm["line"], sm["line"])
    check("same timeout on a calm machine is not blamed on the run", gs.classify_item(rep["items"][0], 3.0)[0] == "unclear")

    # ---- item 7: one quarantine list
    import gate_quarantine as gq
    qp = TMP / "q.json"
    today = dt.date(2026, 10, 30)
    e = gq.add_entry(qp, "test_flaky.py", "backend", "T-9", "lead", "waits for X", 7, today)
    check("quarantine add: expiry is added + 7 days (owner 30.10 night: max 7)", e["expires"] == "2026-11-06")
    for kw in ({"days": 8}, {"owner": ""}, {"reason": ""}, {"ticket": ""}):
        a = dict(match="m2", category="backend", ticket="T", owner="o", reason="r", days=7)
        a.update(kw)
        try:
            gq.add_entry(qp, a["match"], a["category"], a["ticket"], a["owner"], a["reason"], a["days"], today)
            ok = False
        except ValueError:
            ok = True
        check(f"quarantine add refuses {list(kw)[0]}", ok)
    try:
        gq.add_entry(qp, "test_flaky.py", "backend", "T", "o", "r", 5, today)
        dup = False
    except ValueError:
        dup = True
    check("quarantine add refuses a duplicate", dup)
    wj(R / "quarantine.json", {"entries": [{"id": "tests/test_other.py::t", "category": "backend", "gates": ["a", "b"]}, {"id": "tests/test_flaky.py::t", "category": "backend", "gates": ["a"]}]})
    ls = "\n".join(gq.listing(qp, R, None, today))
    check("one listing: managed entry + auto candidate without owner (covered one hidden)", "test_flaky.py" in ls and "test_other.py" in ls and ls.count("test_flaky.py") == 1, ls)
    check("expired entries are pruned into history", len(gq.prune(qp, dt.date(2026, 12, 1))) == 1 and json.loads(qp.read_text())["history"])
    gq.add_entry(qp, "test_flaky.py", "backend", "T-9", "lead", "again", 7, today)
    ents, _ = gq.g2v.load_quarantine(qp, today)
    rr = {"verdict": "fail", "items": [{"category": "backend", "status": "FAIL", "id": "tests/test_flaky.py::t"}]}
    c1 = gq.g2v.classify(rr, ents)
    check("all-quarantined red is recognised for the one re-run alone", c1["quarantined"] and not c1["real"])
    rr["items"].append({"category": "preview", "status": "FAIL", "id": "z.spec.ts:1"})
    check("a non-quarantined failure alongside = real", gq.g2v.classify(rr, ents)["real"])

    # ---- item 8: who holds the machine
    import gate_holder as gh
    hp = TMP / "holder.json"
    check("no holder: free", gh.guard("agent", hp, lambda p: True, lambda: False)[0] == 0)
    gh.claim("gate", "release gate release/z", "release_gate2.sh release/z", os.getpid(), hp)
    rc, msg = gh.guard("agent", hp, lambda p: True, lambda: False)
    check("gate holds the machine: refused (75) with a Hebrew message naming the holder", rc == 75 and "השער רץ" in msg and "release/z" in msg, msg)
    check("a dead holder pid does not block", gh.guard("agent", hp, lambda p: False, lambda: False)[0] == 0)
    check("lock held without a holder file still blocks", gh.guard("agent", TMP / "none.json", lambda p: False, lambda: True)[0] == 75)
    gh.claim("agent", "some agent", "pytest", os.getpid(), hp)
    check("an agent holder does not block another agent", gh.guard("agent", hp, lambda p: True, lambda: False)[0] == 0)
    check("release removes only our own holder", not gh.release(123456, hp) and gh.release(os.getpid(), hp))
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print("SELFTEST PASSED" if not BAD else f"SELFTEST FAILED: {BAD}")
sys.exit(0 if not BAD else 1)
