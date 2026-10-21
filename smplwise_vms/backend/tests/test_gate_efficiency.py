"""GATEEFF-295: the release gate's policy layer (scripts/gate/gate_policy.py and its wiring in release_gate.py).

These tests are about the GATE TOOLING only. They never weaken or skip a product test: they prove that a failure is classified
and reported in exactly one visible lane, that nothing is quarantined without an owner / ticket / expiry, and that an expired or
malformed policy file turns the gate red instead of silently excusing anything."""
from __future__ import annotations

import datetime as dt
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
GATE = ROOT / "scripts" / "gate"
if str(GATE) not in sys.path:
    sys.path.insert(0, str(GATE))
import gate_policy as pol  # noqa: E402

TODAY = dt.date(2026, 10, 21)


def _load(name, fname):
    spec = importlib.util.spec_from_file_location(name, GATE / fname)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture()
def g(monkeypatch, tmp_path):
    for k in ("GATE_SCHEDULE", "GATE_SELECT", "GATE_SELECT_ENABLE", "GATE_FULL", "GATE_PIXEL_LANE", "GATE_BASE_VERIFY", "GATE_PREEXISTING"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GATE_RESULTS_DIR", str(tmp_path / "results"))
    monkeypatch.setenv("GATE_HOME", str(tmp_path / "home"))
    (tmp_path / "results").mkdir()
    mod = _load("release_gate_eff", "release_gate.py")
    mod.BR, mod.TAG = "pilot/X", "pilot-X"
    return mod


def entry(**kw):
    e = {"id": "Q-1", "kind": "backend", "nodeid": "tests/test_a.py::test_x", "reason": "stale since the NVRLESS change", "owner": "lead",
         "added": "2026-10-20", "expires": "2026-11-01", "ticket": "GATEEFF-295"}
    e.update(kw)
    return e


def qfile(tmp_path, entries, name="gate_quarantine.json"):
    p = tmp_path / name
    p.write_text(json.dumps({"entries": entries}), encoding="utf-8")
    return p


# ---------------------------------------------------------------- the managed quarantine file
def test_a_complete_entry_is_valid_and_every_field_is_required():
    assert pol.validate_entry(entry(), TODAY) == []
    for k in pol.REQUIRED:
        bad = entry()
        bad.pop(k)
        assert any(k in p for p in pol.validate_entry(bad, TODAY)), k
    assert pol.validate_entry(entry(owner="  "), TODAY)


def test_expiry_is_at_most_14_days_after_added_and_never_before_it():
    assert pol.validate_entry(entry(added="2026-10-20", expires="2026-11-03"), TODAY) == []          # exactly 14 days
    assert any("maximum is 14" in p for p in pol.validate_entry(entry(added="2026-10-20", expires="2026-11-04"), TODAY))
    assert any("before added" in p for p in pol.validate_entry(entry(added="2026-10-20", expires="2026-10-19"), TODAY))
    assert any("future" in p for p in pol.validate_entry(entry(added="2026-10-25", expires="2026-10-30"), TODAY))
    assert any("not a date" in p for p in pol.validate_entry(entry(expires="soon"), TODAY))


def test_a_ticket_must_be_a_link_or_a_task_id():
    for ok in ("https://tracker.example/T-12", "GATEEFF-295", "T123"):
        assert pol.validate_entry(entry(ticket=ok), TODAY) == [], ok
    for bad in ("later", "see chat", "123"):
        assert pol.validate_entry(entry(ticket=bad), TODAY), bad


def test_a_whole_playwright_file_is_never_quarantined():
    pw = entry(kind="playwright", file="x.spec.ts")
    pw.pop("nodeid")
    assert any("whole file" in p for p in pol.validate_entry(pw, TODAY))
    assert pol.validate_entry({**pw, "title_contains": "opens the drawer"}, TODAY) == []
    assert pol.validate_entry({**pw, "line": 40}, TODAY) == []
    assert any("needs nodeid" in p for p in pol.validate_entry(entry(nodeid=""), TODAY))


def test_load_splits_active_expired_and_invalid_and_hashes_the_file(tmp_path):
    p = qfile(tmp_path, [entry(id="A"), entry(id="B", added="2026-09-01", expires="2026-09-10"), entry(id="C", owner=""), entry(id="A")])
    q = pol.load_quarantine(p, TODAY)
    assert [e["id"] for e in q["entries"]] == ["A"]
    assert [e["id"] for e in q["expired"]] == ["B"]
    assert {i for i, _ in q["invalid"]} == {"C", "A"} and any("duplicate" in w for _, ws in q["invalid"] for w in ws)
    assert len(q["sha256"]) == 16 and q["error"] == ""


def test_a_missing_file_is_an_empty_quarantine_but_a_broken_one_is_an_error(tmp_path):
    assert pol.load_quarantine(tmp_path / "none.json", TODAY)["entries"] == []
    bad = tmp_path / "bad.json"
    bad.write_text("{not json", encoding="utf-8")
    assert pol.load_quarantine(bad, TODAY)["error"]
    bad.write_text(json.dumps({"entries": "x"}), encoding="utf-8")
    assert pol.load_quarantine(bad, TODAY)["error"]


def test_the_shipped_quarantine_file_is_valid_and_empty_of_surprises():
    q = pol.load_quarantine(GATE / pol.QUARANTINE_NAME, dt.date.today())
    assert q["error"] == "" and q["invalid"] == [], "the committed gate_quarantine.json must always validate"


def test_matching_backend_ids_by_exact_id_or_param_prefix_and_playwright_by_file_plus_selector():
    e = entry()
    assert pol.entry_matches(e, "backend", nodeid="tests/test_a.py::test_x")
    assert pol.entry_matches(e, "backend", nodeid="tests/test_a.py::test_x[param-1]")
    assert pol.entry_matches(e, "backend", nodeid="smplwise_vms/backend/tests/test_a.py::test_x")
    assert not pol.entry_matches(e, "backend", nodeid="tests/test_a.py::test_xy")
    assert not pol.entry_matches(e, "backend", nodeid="tests/test_b.py::test_x")
    pw = {**entry(kind="playwright", file="x.spec.ts", title_contains="drawer", project="desktop"), "id": "Q-2"}
    pw.pop("nodeid")
    assert pol.entry_matches(pw, "playwright", file="x.spec.ts", line=9, project="desktop", title="a > opens the drawer")
    assert not pol.entry_matches(pw, "playwright", file="x.spec.ts", line=9, project="mobile", title="a > opens the drawer")
    assert not pol.entry_matches(pw, "playwright", file="y.spec.ts", line=9, project="desktop", title="a > opens the drawer")
    assert not pol.entry_matches(pw, "playwright", file="x.spec.ts", line=9, project="desktop", title="something else")
    assert not pol.entry_matches(e, "playwright", file="x.spec.ts")


# ---------------------------------------------------------------- classification of a final failure
def test_classify_final_quarantine_beats_pixel_and_pixel_beats_fail(tmp_path):
    q = pol.load_quarantine(qfile(tmp_path, [entry()]), TODAY)
    assert pol.classify_final(q, "backend", nodeid="tests/test_a.py::test_x")[0] == "QUARANTINED"
    assert pol.classify_final(q, "backend", nodeid="tests/test_a.py::test_other")[0] == "FAIL"
    shot = "Error: expect(page).toHaveScreenshot(expected) Screenshot comparison failed: 1200 pixels (ratio 0.02 of all image pixels) are different"
    assert pol.classify_final(q, "playwright", err=shot, file="x.spec.ts", line=1, project="desktop", title="t")[0] == "PIXEL_REVIEW"
    assert pol.classify_final(q, "playwright", err="expect(locator).toBeVisible() failed", file="x.spec.ts", line=1, project="desktop", title="t")[0] == "FAIL"
    assert pol.classify_final(q, "playwright", err=shot, pixel_lane=False, file="x.spec.ts", line=1, project="desktop", title="t")[0] == "FAIL"
    assert pol.classify_final(q, "backend", err=shot, nodeid="tests/other.py::t")[0] == "FAIL"       # backend never has a pixel lane


def test_expired_entries_do_not_apply():
    q = {"entries": []}
    assert pol.classify_final(q, "backend", nodeid="tests/test_a.py::test_x")[0] == "FAIL"


# ---------------------------------------------------------------- the engine: lanes, counts, verdict
def test_red_counts_each_lane_and_only_a_real_fail_turns_the_verdict_red(g, tmp_path):
    g.QUARANTINE = pol.load_quarantine(qfile(tmp_path, [entry()]), dt.date.today().replace(year=2026, month=10, day=21))
    g.QUARANTINE_HIT.clear()
    assert g.red("backend", "tests/test_a.py::test_x", "AssertionError", "backend", nodeid="tests/test_a.py::test_x") == "QUARANTINED"
    assert g.compute_verdict([]) == "pass" and g.final_verdict([]) == "pass"
    it = g.ITEMS[-1]
    assert it["status"] == "QUARANTINED" and "owner lead" in it["reason"] and "GATEEFF-295" in it["reason"] and it["quarantine_id"] == "Q-1"
    assert g.QUARANTINE_HIT == {"Q-1"}
    assert g.red("pixel", "s.spec.ts:3 [desktop] t", "Screenshot comparison failed", "playwright", err="Screenshot comparison failed",
                 file="s.spec.ts", line=3, project="desktop", title="t") == "PIXEL_REVIEW"
    assert g.compute_verdict([]) == "pass" and g.final_verdict([]) == "review"
    assert g.red("backend", "tests/test_b.py::test_y", "boom", "backend", nodeid="tests/test_b.py::test_y") == "FAIL"
    assert g.final_verdict([]) == "fail"
    c = g.COUNTS
    assert c["backend"]["quarantined"] == 1 and c["backend"]["fail"] == 1 and c["pixel"]["pixel_review"] == 1


def test_a_pixel_review_test_still_counts_as_run_for_the_baseline_ratio(g):
    g.COUNTS["pixel"] = {"pass": 84, "fail": 0, "flaky": 0, "known": 0, "skipped": 0, "pixel_review": 104}
    g.check_baselines({"tiers": {"L": {"pixel": 188}}}, "L")
    assert g.BASELINE_ROWS["pixel"]["state"] == "ok" and g.BASELINE_ROWS["pixel"]["actual"] == 188


def _fake_pw(g, monkeypatch, rows_first, rows_retry):
    calls = []

    def fake(fe, specs, projects, base_url, logd, label, **kw):
        calls.append(label)
        return (rows_retry, 0 if all(r["status"] != "unexpected" for r in rows_retry) else 1, False)
    monkeypatch.setattr(g, "run_pw", fake)
    return calls


def _row(status="unexpected", err="boom", title="t", file="a.spec.ts", line=5, **kw):
    return {"file": file, "line": line, "project": "desktop", "title": title, "status": status, "error": err, "norun": False, "seconds": 1.0, "images": [], **kw}


def test_settle_retries_alone_and_a_pass_on_retry_is_flaky_not_red(g, monkeypatch, tmp_path):
    calls = _fake_pw(g, monkeypatch, None, [_row("expected")])
    g.settle("preview", [_row()], 1, False, tmp_path, tmp_path, "http://x/", {}, "lab")
    assert calls == ["lab_retry_desktop"]
    assert g.COUNTS["preview"]["flaky"] == 1 and g.COUNTS["preview"].get("fail", 0) == 0 and g.final_verdict([]) == "pass"
    assert g.ITEMS[0]["status"] == "FLAKY"


def test_settle_a_failure_that_repeats_alone_is_red_and_a_screenshot_diff_goes_to_the_review_lane(g, monkeypatch, tmp_path):
    _fake_pw(g, monkeypatch, None, [_row(err="expect(locator).toBeVisible() failed")])
    g.settle("preview", [_row()], 1, False, tmp_path, tmp_path, "http://x/", {}, "lab")
    assert g.COUNTS["preview"]["fail"] == 1 and g.ITEMS[0]["status"] == "FAIL" and "failed again alone" in g.ITEMS[0]["reason"]
    g.COUNTS.clear(); g.ITEMS.clear()
    shot = "Error: expect(page).toHaveScreenshot(expected) Screenshot comparison failed: 9 pixels"
    img = tmp_path / "diff.png"
    img.write_bytes(b"png")
    _fake_pw(g, monkeypatch, None, [_row(err=shot, images=[str(img)])])
    g.settle("pixel", [_row(err=shot)], 1, False, tmp_path, tmp_path, "http://x/", {}, "lab")
    assert g.COUNTS["pixel"]["pixel_review"] == 1 and g.COUNTS["pixel"].get("fail", 0) == 0 and g.final_verdict([]) == "review"
    kept = g.ITEMS[0]["images"]
    assert kept and (tmp_path / kept[0]).read_bytes() == b"png"          # copied before the next run could wipe the output directory


def test_settle_quarantine_needs_the_failure_to_repeat_alone_first(g, monkeypatch, tmp_path):
    pw = {**entry(kind="playwright", file="a.spec.ts", title_contains="t"), "id": "Q-9"}
    pw.pop("nodeid")
    g.QUARANTINE = pol.load_quarantine(qfile(tmp_path, [pw]), TODAY)
    g.QUARANTINE_HIT.clear()
    _fake_pw(g, monkeypatch, None, [_row("expected")])
    g.settle("preview", [_row()], 1, False, tmp_path, tmp_path, "http://x/", {}, "lab")
    assert g.ITEMS[0]["status"] == "FLAKY" and not g.QUARANTINE_HIT       # passed alone: flaky, the entry is not used
    g.COUNTS.clear(); g.ITEMS.clear()
    _fake_pw(g, monkeypatch, None, [_row()])
    g.settle("preview", [_row()], 1, False, tmp_path, tmp_path, "http://x/", {}, "lab")
    assert g.ITEMS[0]["status"] == "QUARANTINED" and g.QUARANTINE_HIT == {"Q-9"} and g.final_verdict([]) == "pass"


def test_load_managed_quarantine_turns_expired_invalid_and_unreadable_into_reds(g, tmp_path):
    wt = tmp_path / "wt"
    (wt / "scripts" / "gate").mkdir(parents=True)
    today = dt.date.today()
    old = (today - dt.timedelta(days=20)).isoformat()
    older = (today - dt.timedelta(days=25)).isoformat()
    qfile(wt / "scripts" / "gate", [entry(id="OLD", added=older, expires=old), entry(id="BAD", owner=""), entry(id="OK", added=today.isoformat(), expires=(today + dt.timedelta(days=3)).isoformat())])
    meta, new = g.load_managed_quarantine(wt)
    assert meta["active"] == 1 and meta["expired"] == 1 and meta["invalid"] == 1
    ids = {i["id"]: i for i in g.ITEMS}
    assert ids["OLD"]["status"] == "FAIL" and "EXPIRED" in ids["OLD"]["reason"] and "BAD" in ids and g.compute_verdict([]) == "fail"
    g.COUNTS.clear(); g.ITEMS.clear()
    (wt / "scripts" / "gate" / "gate_quarantine.json").write_text("{oops", encoding="utf-8")
    meta, _ = g.load_managed_quarantine(wt)
    assert meta["error"] and g.compute_verdict([]) == "fail"


# ---------------------------------------------------------------- base comparison
def test_test_key_ignores_line_numbers():
    a = pol.test_key("a.spec.ts:10 [desktop] x > y")
    b = pol.test_key("a.spec.ts:99 [desktop] x > y")
    assert a == b and a != pol.test_key("a.spec.ts:10 [mobile] x > y")
    assert pol.test_key("tests/t.py::n") == ("be", "tests/t.py::n")


def _items():
    return [{"category": "backend", "id": "tests/t.py::old_red", "status": "FAIL"},
            {"category": "backend", "id": "tests/t.py::new_red", "status": "FAIL"},
            {"category": "preview", "id": "a.spec.ts:7 [desktop] flaky on base", "status": "FAIL"},
            {"category": "preview", "id": "a.spec.ts:8 [desktop] fresh", "status": "FAIL"}]


def test_reclassify_uses_the_base_report_then_the_category_then_a_run_on_the_base():
    base_doc = {"counts": {"backend": {"pass": 100}, "preview": {"pass": 50}},
                "items": [{"category": "backend", "id": "tests/t.py::old_red", "status": "FAIL"},
                          {"category": "preview", "id": "a.spec.ts:70 [desktop] flaky on base", "status": "FLAKY"}]}
    bf, complete, soft = pol.base_failures([("main@abc", base_doc)])
    res = pol.reclassify(_items(), bf, complete, soft)
    assert res["tests/t.py::old_red"][0] == "preexisting"
    assert res["tests/t.py::new_red"][0] == "new"                                           # the base ran backend completely and it did not fail there
    assert res["a.spec.ts:7 [desktop] flaky on base"][0] == "unverified"                    # flaky on the base: inconclusive, must be run
    assert res["a.spec.ts:8 [desktop] fresh"][0] == "new"
    ran = {pol.test_key("a.spec.ts:7 [desktop] flaky on base"): "fail"}
    assert pol.reclassify(_items(), bf, complete, soft, ran)["a.spec.ts:7 [desktop] flaky on base"][0] == "preexisting"
    assert pol.reclassify(_items(), {}, set(), set(), {pol.test_key("tests/t.py::new_red"): "missing"})["tests/t.py::new_red"][0] == "new"
    assert pol.reclassify(_items(), {}, set(), set())["tests/t.py::new_red"][0] == "unverified"   # no evidence = it stays red


def test_a_reduced_base_report_does_not_vouch_for_a_category():
    d = {"counts": {"backend": {"pass": 100}}, "selection": {"reduced": {"backend": "40 of 500 files"}}, "items": []}
    _, complete, _ = pol.base_failures([("main@x", d)])
    assert "backend" not in complete


def test_base_verify_moves_preexisting_failures_to_their_own_lane(g, monkeypatch, tmp_path):
    g.count("backend", "fail", 2)
    g.item("backend", "tests/t.py::old_red", "FAIL", "boom", kind="backend", nodeid="tests/t.py::old_red")
    g.item("backend", "tests/t.py::new_red", "FAIL", "boom", kind="backend", nodeid="tests/t.py::new_red")
    monkeypatch.setattr(g, "_resolve_ref", lambda wt, ref: ("origin/main", "b" * 40))
    monkeypatch.setattr(g, "base_reports", lambda sha: [])
    monkeypatch.setattr(g, "left", lambda: 4000)
    monkeypatch.setattr(g, "run_on_base", lambda wt, ref, todo, logd, info: {pol.test_key("tests/t.py::old_red"): "fail", pol.test_key("tests/t.py::new_red"): "pass"})
    info = g.base_verify(tmp_path, "a" * 9, tmp_path)
    st = {i["id"]: i["status"] for i in g.ITEMS}
    assert st == {"tests/t.py::old_red": "PREEXISTING", "tests/t.py::new_red": "FAIL"}
    assert g.COUNTS["backend"]["fail"] == 1 and g.COUNTS["backend"]["preexisting"] == 1
    assert info["preexisting"] == 1 and info["new"] == 1 and g.final_verdict([]) == "fail"       # the new red still blocks
    reason = next(i for i in g.ITEMS if i["status"] == "PREEXISTING")
    assert "PRE-EXISTING" in reason["reason"] and reason["base"] == "preexisting"


def test_base_verify_keeps_everything_red_when_it_cannot_verify(g, monkeypatch, tmp_path):
    g.count("backend", "fail")
    g.item("backend", "tests/t.py::x", "FAIL", "boom", kind="backend", nodeid="tests/t.py::x")
    monkeypatch.setattr(g, "_resolve_ref", lambda wt, ref: ("origin/main", "b" * 40))
    monkeypatch.setattr(g, "base_reports", lambda sha: [])
    monkeypatch.setattr(g, "left", lambda: 4000)

    def boom(*a, **k):
        raise RuntimeError("no worktree")
    monkeypatch.setattr(g, "run_on_base", boom)
    info = g.base_verify(tmp_path, "a" * 9, tmp_path)
    assert g.ITEMS[0]["status"] == "FAIL" and info["unverified"] == 1 and any("unverified failures stay red" in n for n in info["notes"])
    g.ITEMS[0]["status"] = "FAIL"
    monkeypatch.setattr(g, "_resolve_ref", lambda wt, ref: ("origin/main", "a" * 40))       # the branch IS the base (main / nightly)
    info = g.base_verify(tmp_path, "a" * 9, tmp_path)
    assert g.ITEMS[0]["status"] == "FAIL" and any("no distinct base" in n for n in info["notes"])
    monkeypatch.setattr(g, "BASE_VERIFY_MAX", 0)
    monkeypatch.setattr(g, "_resolve_ref", lambda wt, ref: ("origin/main", "b" * 40))
    assert any("not compared" in n for n in g.base_verify(tmp_path, "a" * 9, tmp_path)["notes"])


def test_the_preexisting_policy_can_block(g, monkeypatch, tmp_path):
    g.count("backend", "fail")
    g.item("backend", "tests/t.py::x", "FAIL", "boom", kind="backend", nodeid="tests/t.py::x")
    monkeypatch.setattr(g, "_resolve_ref", lambda wt, ref: ("origin/main", "b" * 40))
    monkeypatch.setattr(g, "base_reports", lambda sha: [("main@b", {"counts": {"backend": {"pass": 5}}, "items": [{"category": "backend", "id": "tests/t.py::x", "status": "FAIL"}]})])
    monkeypatch.setattr(g, "PREEXISTING_BLOCKS", True)
    g.base_verify(tmp_path, "a" * 9, tmp_path)
    assert g.ITEMS[0]["status"] == "FAIL" and g.ITEMS[0]["base"] == "preexisting" and g.final_verdict([]) == "fail"


# ---------------------------------------------------------------- flaky counter
def test_the_flaky_counter_counts_gates_not_repeats_within_one_gate():
    d = pol.update_flaky_counter({}, "b@1", ["t1", "t2"], "2026-10-21T01:00:00")
    d = pol.update_flaky_counter(d, "b@1", ["t1"], "2026-10-21T01:05:00")      # the same gate again
    d = pol.update_flaky_counter(d, "b@2", ["t1"], "2026-10-22T01:00:00")
    assert d["tests"]["t1"]["count"] == 2 and d["tests"]["t2"]["count"] == 1 and d["tests"]["t1"]["gates"] == ["b@1", "b@2"]


# ---------------------------------------------------------------- nightly health and selection
def _nightly(dirp, sha, finished, items=(), baseline=None):
    (dirp).mkdir(exist_ok=True)
    (dirp / f"gate_main_{sha}.json").write_text(json.dumps({"branch": "main", "sha": sha, "finished": finished, "items": list(items), "baseline_check": baseline or {}}))


def test_nightly_health_needs_a_recent_finished_full_nightly(tmp_path):
    now = dt.datetime(2026, 10, 21, 12, 0, 0)
    assert not pol.nightly_health(tmp_path / "none", now)["ok"]
    n = tmp_path / "nightly"
    n.mkdir()
    assert "no nightly report" in pol.nightly_health(n, now)["reason"]
    _nightly(n, "aaa1111", "2026-10-21T03:00:00+0000")
    assert pol.nightly_health(n, now)["ok"]
    _nightly(n, "bbb2222", "2026-10-18T03:00:00+0000")
    assert pol.nightly_health(n, now)["ok"], "the newest report decides"
    for f in n.glob("*.json"):
        f.unlink()
    _nightly(n, "ccc3333", "2026-10-18T03:00:00+0000")
    assert "old" in pol.nightly_health(n, now)["reason"]
    _nightly(n, "ddd4444", "2026-10-21T03:00:00+0000", items=[{"category": "gate", "id": "terminated (time budget): signal 15", "status": "FAIL", "reason": ""}])
    assert "did not finish" in pol.nightly_health(n, now)["reason"]
    _nightly(n, "ddd4444", "2026-10-21T03:00:00+0000", baseline={"backend": {"state": "low", "ratio": 0.3}})
    assert "30%" in pol.nightly_health(n, now)["reason"]


def test_decide_selection_is_full_unless_the_nightly_is_healthy_and_never_for_nightly_or_main(g, monkeypatch):
    nightly = g.RES / "nightly"
    # no nightly: full tier, with the reason on record
    assert "full tier: selection not allowed" in g.decide_selection() and g.SELECT_BASE == ""
    now = dt.datetime.now().strftime("%Y-%m-%dT%H:%M:%S+0000")
    _nightly(nightly, "ok12345", now)
    assert g.decide_selection().startswith("diff selection against") and g.SELECT_BASE == g.BASE_REF
    g.SELECT_BASE = ""
    monkeypatch.setattr(g, "FULL", True)
    assert g.decide_selection() == "full tier (--full)" and g.SELECT_BASE == ""
    monkeypatch.setattr(g, "FULL", False)
    monkeypatch.setattr(g, "TABLET_FULL", True)                                                 # the nightly
    assert "nightly" in g.decide_selection() and g.SELECT_BASE == ""
    monkeypatch.setattr(g, "TABLET_FULL", False)
    monkeypatch.setattr(g, "TIER", "M")
    assert "non-L" in g.decide_selection()
    monkeypatch.setattr(g, "TIER", "L")
    g.BR = "main"
    assert "main" in g.decide_selection()
    g.BR = "pilot/X"
    monkeypatch.setenv("GATE_SELECT", "off")
    assert g.decide_selection() == "full tier (GATE_SELECT=off)"


def test_an_explicit_select_base_without_a_healthy_nightly_falls_back_to_the_full_tier(g, monkeypatch):
    g.SELECT_BASE = "v2.9.2"
    assert "full tier: selection not allowed" in g.decide_selection() and g.SELECT_BASE == ""
    g.SELECT_BASE = "v2.9.2"
    monkeypatch.setenv("GATE_SELECT_ENABLE", "1")
    assert g.decide_selection().startswith("diff selection against v2.9.2") and g.SELECT_BASE == "v2.9.2"


def test_cli_no_longer_exits_for_select_base_and_has_full_and_a_usage_without_branch(g):
    assert g.main_cli(["--select-base"]) == 2              # a ref is still required
    assert g.main_cli(["--full"]) == 2                     # no branch: usage
    assert g.FULL is True


# ---------------------------------------------------------------- the schedule default
def test_v2_becomes_the_default_only_with_recorded_evidence_and_a_flag_always_wins(tmp_path):
    ev = tmp_path / "ev.json"
    assert pol.resolve_schedule("", None, ev)[0] == "v1"
    ev.write_text(json.dumps({"default": "v2", "verdict": "SAME", "shadow": "b@s v2 80 min", "reference": "b@s v1 150 min", "date": "2026-10-22"}))
    s, why = pol.resolve_schedule("", None, ev)
    assert s == "v2" and "SAME" in why
    assert pol.resolve_schedule("v1", None, ev)[0] == "v1" and pol.resolve_schedule("", "V1", ev)[0] == "v1"
    ev.write_text(json.dumps({"default": "v2", "verdict": "DIFFERENT"}))
    assert pol.resolve_schedule("", None, ev)[0] == "v1"
    ev.write_text("garbage")
    assert pol.resolve_schedule("", None, ev)[0] == "v1"


def test_shadow_record_writes_evidence_only_for_a_same_full_v1_vs_v2_pair(tmp_path):
    sc = _load("shadow_compare_eff", "shadow_compare.py")
    counts = {"backend": {"pass": 100, "fail": 0, "flaky": 0, "known": 0}, "preview": {"pass": 50, "fail": 0, "flaky": 1, "known": 0}}
    ref = {"branch": "integ", "sha": "abc", "tier": "L", "verdict": "pass", "schedule": "v1", "wall_seconds": 9000, "counts": counts, "items": []}
    sh = {**ref, "schedule": "v2", "wall_seconds": 4800, "resources": {"samples": 3}}
    rp, sp, out = tmp_path / "r.json", tmp_path / "s.json", tmp_path / "ev.json"
    rp.write_text(json.dumps(ref)); sp.write_text(json.dumps(sh))
    assert sc.main([str(rp), str(sp), "--record", str(out)]) == 0
    ev = json.loads(out.read_text())
    assert ev["default"] == "v2" and ev["verdict"] == "SAME" and "v1 150 min" in ev["reference"] and "v2 80 min" in ev["shadow"]
    assert pol.resolve_schedule("", None, out)[0] == "v2"
    out.unlink()
    for bad_sh, why in (({**sh, "sha": "other"}, "shas"), ({**sh, "schedule": "v1"}, "schedule"),
                        ({**sh, "selection": {"reduced": {"backend": "1 of 2"}}}, "selection"),
                        ({**sh, "counts": {**counts, "backend": {"pass": 10, "fail": 0, "flaky": 0, "known": 0}}}, "different")):
        sp.write_text(json.dumps(bad_sh))
        assert sc.main([str(rp), str(sp), "--record", str(out)]) == 2, why
        assert not out.exists(), why
    rp.write_text(json.dumps({**ref, "verdict": "fail"}))
    sp.write_text(json.dumps(sh))
    assert sc.main([str(rp), str(sp), "--record", str(out)]) == 2 and not out.exists()


def test_shadow_compare_counts_every_red_lane_as_a_fail():
    sc = _load("shadow_compare_lanes", "shadow_compare.py")
    ref = {"sha": "s", "counts": {"preview": {"pass": 50, "fail": 0, "flaky": 0, "known": 0}}, "items": []}
    sh = {"sha": "s", "counts": {"preview": {"pass": 49, "fail": 0, "flaky": 0, "known": 0, "quarantined": 1}},
          "items": [{"category": "preview", "id": "x.spec.ts:1 [desktop] t", "status": "QUARANTINED"}]}
    ok, lines = sc.compare(ref, sh)
    assert not ok and any("FAIL only in the shadow run" in l for l in lines)


# ---------------------------------------------------------------- the one-page summary and the pixel review
def _doc(**kw):
    d = {"branch": "integ/2101", "sha": "300881f0f", "tier": "L", "verdict": "fail", "wall_seconds": 5000, "wall_target_min": 90, "schedule": "v2",
         "counts": {"backend": {"pass": 100, "fail": 1, "flaky": 2, "known": 0, "skipped": 3, "quarantined": 1}, "pixel": {"pass": 80, "fail": 0, "flaky": 0, "known": 0, "skipped": 0, "pixel_review": 2}},
         "items": [{"category": "backend", "id": "tests/t.py::new_red", "status": "FAIL", "reason": "AssertionError"},
                   {"category": "backend", "id": "tests/t.py::q", "status": "QUARANTINED", "reason": "stale | quarantine Q-1"},
                   {"category": "backend", "id": "tests/t.py::fl1", "status": "FLAKY", "reason": ""},
                   {"category": "pixel", "id": "s.spec.ts:3 [desktop] a", "status": "PIXEL_REVIEW", "reason": ""},
                   {"category": "pixel", "id": "s.spec.ts:4 [desktop] b", "status": "PIXEL_REVIEW", "reason": ""},
                   {"category": "backend", "id": "tests/t.py::old", "status": "PREEXISTING", "reason": "fails on the base"}],
         "phases": [{"name": "playwright-pool", "seconds": 3000}]}
    d.update(kw)
    return d


def test_the_summary_fits_one_page_and_names_each_class_and_the_reds_that_matter():
    txt = pol.render_summary(_doc(), {"tests": {"tests/t.py::fl1": {"count": 3}}})
    assert len(txt.splitlines()) <= 60
    for needle in ("-> FAIL", "NEW red", "PRE-EXISTING", "QUARANTINED", "PIXEL REVIEW", "FLAKY", "tests/t.py::new_red", "(x3)", "within the 90 min target",
                   "--resolve-review"):
        assert needle in txt, needle
    assert "OVER the 90 min" in pol.render_summary(_doc(wall_seconds=6000))
    assert "(none)" in pol.render_summary(_doc(verdict="pass", items=[])) and "REVIEW NEEDED" in pol.render_summary(_doc(verdict="review"))
    many = _doc(items=[{"category": "backend", "id": f"tests/t.py::r{i}", "status": "FAIL", "reason": "x"} for i in range(80)])
    assert len(pol.render_summary(many).splitlines()) <= 60 and "and 55 more" in pol.render_summary(many)


def test_write_reports_writes_the_summary_before_the_long_report_and_marks_a_review_verdict(g):
    g.COUNTS["pixel"] = {"pass": 5, "fail": 0, "flaky": 0, "known": 0, "skipped": 0, "pixel_review": 1}
    g.ITEMS.append({"category": "pixel", "id": "s.spec.ts:3 [desktop] a", "status": "PIXEL_REVIEW", "reason": "", "kind": "playwright"})
    v = g.final_verdict([])
    assert v == "review"
    fin, base = g.write_reports("abc1234", v, {"schedule": "v2", "selection_policy": "full tier (--full)"})
    sm = Path(str(base) + ".summary.md")
    assert sm.exists() and (g.RES / "LATEST_SUMMARY.md").exists() and "REVIEW NEEDED" in sm.read_text(encoding="utf-8")
    md = Path(str(base) + ".md").read_text(encoding="utf-8")
    assert "דורש סקירה" in md and "הבדלי פיקסלים" in md
    assert json.loads(Path(str(base) + ".json").read_text())["verdict"] == "review"


def test_resolve_review_accepts_or_rejects_with_a_name_and_a_note(g):
    g.COUNTS["pixel"] = {"pass": 5, "fail": 0, "flaky": 0, "known": 0, "skipped": 0, "pixel_review": 1}
    g.ITEMS.append({"category": "pixel", "id": "s.spec.ts:3 [desktop] a", "status": "PIXEL_REVIEW", "reason": "", "kind": "playwright"})
    fin, base = g.write_reports("abc1234", "review", {"schedule": "v1"})
    jp = str(base) + ".json"
    assert g.main_cli(["--resolve-review", jp, "--accept"]) == 2                 # name and note are mandatory
    assert g.main_cli(["--resolve-review", jp, "--accept", "--by", "lead"]) == 2
    assert json.loads(Path(jp).read_text())["verdict"] == "review"
    assert g.main_cli(["--resolve-review", jp, "--accept", "--by", "lead", "--note", "reviewed 1 image, heading style"]) == 0
    d = json.loads(Path(jp).read_text())
    assert d["verdict"] == "pass" and d["review"]["by"] == "lead" and d["items"][0]["status"] == "PIXEL_ACCEPTED"
    assert g.main_cli(["--resolve-review", jp, "--accept", "--by", "lead", "--note", "again"]) == 2   # no longer 'review'
    # reject
    g.COUNTS.clear(); g.ITEMS.clear()
    g.COUNTS["pixel"] = {"pass": 5, "fail": 0, "flaky": 0, "known": 0, "skipped": 0, "pixel_review": 1}
    g.ITEMS.append({"category": "pixel", "id": "s.spec.ts:9 [mobile] b", "status": "PIXEL_REVIEW", "reason": "", "kind": "playwright"})
    fin, base = g.write_reports("def5678", "review", {})
    jp2 = str(base) + ".json"
    assert g.main_cli(["--resolve-review", jp2, "--reject", "--by", "lead", "--note", "layout regression"]) == 1
    d2 = json.loads(Path(jp2).read_text())
    assert d2["verdict"] == "fail" and d2["counts"]["pixel"]["fail"] == 1 and d2["counts"]["pixel"]["pixel_review"] == 0 and d2["items"][0]["status"] == "FAIL"


def test_collect_pw_reports_duration_and_failure_images(g, tmp_path):
    rep = {"suites": [{"title": "a.spec.ts", "specs": [{"title": "t", "file": "tests/a.spec.ts", "line": 4, "tests": [
        {"projectName": "desktop", "status": "unexpected", "annotations": [],
         "results": [{"duration": 1500, "error": {"message": "Screenshot comparison failed"},
                      "attachments": [{"name": "actual", "path": "/x/actual.png", "contentType": "image/png"}, {"name": "trace", "path": "/x/t.zip", "contentType": "application/zip"}]}]}]}]}]}
    p = tmp_path / "r.json"
    p.write_text(json.dumps(rep))
    rows = g.collect_pw(p)
    assert rows[0]["seconds"] == 1.5 and rows[0]["images"] == ["/x/actual.png"]


def test_slow_passing_tests_are_listed(g, monkeypatch, tmp_path):
    g.settle("preview", [_row("expected", seconds=99.0), _row("expected", seconds=1.0, title="quick")], 0, False, tmp_path, tmp_path, "http://x/", {}, "lab")
    assert [s["id"] for s in g.SLOW] == ["a.spec.ts:5 [desktop] t"] and g.COUNTS["preview"]["pass"] == 2


def test_the_playwright_per_test_budget_is_an_option_and_off_by_default(g, monkeypatch, tmp_path):
    seen = []
    monkeypatch.setattr(g, "run", lambda cmd, cwd, log, env=None, timeout=None: (seen.append(cmd) or (0, False)))
    g.run_pw(tmp_path, ["a.spec.ts"], ["desktop"], "http://x/", tmp_path, "l")
    assert not any(a.startswith("--timeout") for a in seen[0])
    monkeypatch.setattr(g, "PW_TEST_TIMEOUT_S", "40")
    g.run_pw(tmp_path, ["a.spec.ts"], ["desktop"], "http://x/", tmp_path, "l")
    assert "--timeout=40000" in seen[1]


def test_the_plan_states_the_wall_clock_target_and_the_schedule_in_force(g, monkeypatch, capsys):
    monkeypatch.setattr(g, "WALL_TARGET_MIN", 90)
    g.plan(str(ROOT), "L")
    out = capsys.readouterr().out
    assert "against the 90 min target" in out and "schedule used by a gate started now" in out
