"""T074: the visual-regression step BLOCKS the release gate, with a flaky-render policy and the gate-2 quarantine
(docs/changes/T074-VISUAL-METRICS-2405.md). The engine's visual functions run with the visual.mjs call faked; the gate-2 verdict,
quarantine tool and selector are pure; the wrappers are pinned by their text. No browser, no runner."""
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

import gate2_select as g2s  # noqa: E402
import gate2_verdict as g2v  # noqa: E402
import gate_quarantine as gq  # noqa: E402


@pytest.fixture()
def g(monkeypatch, tmp_path):
    """A fresh engine module per test (its globals are state), an empty results directory, no GATE_VISUAL / re-run env."""
    for k in ("GATE_VISUAL", "GATE_VISUAL_BASE", "GATE_VISUAL_SCOPE", "GATE2_RERUN_ONLY", "GATE2_AFTER_REPORT", "GATE_LANE", "GATE_SCHEDULE"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GATE_RESULTS_DIR", str(tmp_path / "results"))
    monkeypatch.setenv("GATE_HOME", str(tmp_path / "home"))
    spec = importlib.util.spec_from_file_location("release_gate_t074", GATE / "release_gate.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    (tmp_path / "results").mkdir()
    mod.DEADLINE = 1e12
    return mod


def row(screen, status, state="ready", scheme="light", project="desktop"):
    return {"screen": screen, "state": state, "scheme": scheme, "project": project, "status": status}


def cid(screen, state="ready", scheme="light", project="desktop"):
    return f"{screen} / {state} / {scheme} / {project}"


def fake_runs(g, monkeypatch, *results):
    """visual.mjs runs in order: each result is a rows list or None (no results.json). Records the selection arguments."""
    calls, it = [], iter(results)

    def _rows(fe, logd, sel_args, name, base_url):
        calls.append((name, list(sel_args)))
        r = next(it)
        return r, (0 if r is not None else 1), False, ("visual: no screen is touched by this change" if r == "untouched" else "")

    def wrapped(*a):
        r = _rows(*a)
        return (None,) + r[1:] if r[0] == "untouched" else r

    monkeypatch.setattr(g, "_visual_rows", wrapped)
    return calls


# ---------------------------------------------------------------- engine: default, policy, report

def test_block_is_the_default_and_warn_is_the_rollback(g):
    assert g.VISUAL == "block"
    assert (g.visual_from_env(None), g.visual_from_env(""), g.visual_from_env("warn"), g.visual_from_env("off"), g.visual_from_env("junk")) == \
        ("block", "block", "warn", "", "block")
    assert "visual" in g.OPTIONAL_CATS and g.VISUAL_RUN_CAT in g.OPTIONAL_CATS, "the visual count follows the touched screens: no count baseline"


def test_judge_visual_flaky_fail_and_no_baseline():
    spec = importlib.util.spec_from_file_location("rg_pure_t074", GATE / "release_gate.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    first = [row("a", "pass"), row("b", "diff"), row("c", "diff"), row("d", "no-baseline"), row("e", "error"), row("f", "diff")]
    j = m.judge_visual(first, [row("b", "pass"), row("c", "diff"), row("e", "pass")])
    assert j["pass"] == 1 and j["flaky"] == [cid("b"), cid("e")] and j["nobase"] == [cid("d")]
    assert [x for x, _ in j["fail"]] == [cid("c"), cid("f")]
    assert "missing on the retry" in dict(j["fail"])[cid("f")]
    assert [x for x, _ in m.judge_visual([row("b", "diff")], None)["fail"]] == [cid("b")], "a retry without results proves nothing"
    assert m.parse_visual_case(cid("live-wall", project="mobile")) == {"screen": "live-wall", "state": "ready", "scheme": "light", "project": "mobile"}
    assert m.parse_visual_case("visual matrix: no results") is None
    assert m.visual_selection_args([cid("b"), cid("a", project="mobile"), cid("b", scheme="dark")]) == ["--screens", "a,b", "--projects", "desktop,mobile"]


def test_a_render_that_matches_on_the_retry_is_flaky_and_the_gate_stays_green(g, monkeypatch, tmp_path):
    calls = fake_runs(g, monkeypatch, [row("sites", "pass"), row("sites", "diff", scheme="dark")], [row("sites", "pass", scheme="dark"), row("sites", "pass")])
    g.run_visual(tmp_path, tmp_path, "http://x/", tmp_path)
    assert calls == [("visual", ["--touched", "--base", "origin/main"]), ("visual-retry", ["--screens", "sites", "--projects", "desktop"])]
    assert g.COUNTS["visual"] == {"pass": 1, "fail": 0, "flaky": 1, "known": 0, "skipped": 0}
    assert [(i["status"], i["id"]) for i in g.ITEMS] == [("FLAKY", cid("sites", scheme="dark"))]
    assert g.compute_verdict([]) == "pass"
    assert g.VISUAL_INFO["flaky"] == [cid("sites", scheme="dark")] and g.VISUAL_INFO["retry"]["results"] is True


def test_a_case_that_differs_twice_fails_the_gate_as_a_quarantinable_visual_item(g, monkeypatch, tmp_path):
    fake_runs(g, monkeypatch, [row("sites", "diff"), row("live-wall", "no-baseline")], [row("sites", "diff")])
    g.run_visual(tmp_path, tmp_path, "http://x/", tmp_path)
    assert g.compute_verdict([]) == "fail"
    fails = [i for i in g.ITEMS if i["status"] == "FAIL"]
    assert [(i["category"], i["id"]) for i in fails] == [("visual", cid("sites"))]
    assert [(i["status"], i["id"]) for i in g.ITEMS if i["status"].startswith("SKIPPED")] == [("SKIPPED_NO_BASELINE", cid("live-wall"))]
    assert g.COUNTS["visual"]["skipped"] == 1
    g.BR, g.TAG = "t074", "t074"
    _, base = g.write_reports("abc1234", g.compute_verdict([]), {})
    md = Path(str(base) + ".md").read_text()   # the engine writes it in the platform encoding (UTF-8 on the runner)
    assert "חוסם (T074)" in md and f"כשל ויזואלי: {cid('sites')}" in md and f"בלי baseline של linux (לא הושווה): {cid('live-wall')}" in md


def test_a_step_that_cannot_run_is_a_hard_failure_in_block_mode_and_nothing_in_warn_mode(g, monkeypatch, tmp_path):
    fake_runs(g, monkeypatch, None)
    g.run_visual(tmp_path, tmp_path, "http://x/", tmp_path)
    assert [(i["category"], i["status"]) for i in g.ITEMS] == [("visual-run", "FAIL")] and g.compute_verdict([]) == "fail"
    assert "visual-run" not in g2v.TEST_CATS, "a step that did not run can never be quarantined"
    g.ITEMS.clear(); g.COUNTS.clear(); g.VISUAL_INFO.clear()
    g.VISUAL = "warn"
    fake_runs(g, monkeypatch, None)
    g.run_visual(tmp_path, tmp_path, "http://x/", tmp_path)
    assert g.ITEMS == [] and g.compute_verdict([]) == "pass" and "error" in g.VISUAL_INFO
    g.VISUAL_INFO.clear()
    fake_runs(g, monkeypatch, [row("sites", "diff")])
    g.run_visual(tmp_path, tmp_path, "http://x/", tmp_path)
    assert g.ITEMS == [] and g.VISUAL_INFO["diffs"] == [cid("sites")], "warn mode: a report section, no retry, no count"


def test_no_touched_screen_is_neither_a_failure_nor_a_pass(g, monkeypatch, tmp_path):
    fake_runs(g, monkeypatch, "untouched")
    g.run_visual(tmp_path, tmp_path, "http://x/", tmp_path)
    assert g.ITEMS == [] and g.COUNTS == {} and g.VISUAL_INFO["touched"] == 0


def test_the_quarantine_rerun_re_checks_exactly_the_first_runs_visual_failures(g, monkeypatch, tmp_path):
    first = tmp_path / "gate_x_abc.gate2-first.json"
    first.write_text(json.dumps({"sha": "abc", "items": [
        {"category": "visual", "id": cid("sites"), "status": "FAIL"},
        {"category": "visual", "id": cid("map-floor", project="mobile"), "status": "FAIL"},
        {"category": "visual", "id": cid("live-wall"), "status": "FLAKY"},
        {"category": "visual-run", "id": "visual matrix: no results", "status": "FAIL"},
        {"category": "backend", "id": "tests/test_x.py::t", "status": "FAIL"}]}), encoding="utf-8")
    assert g.rerun_visual_cases(first) == [cid("map-floor", project="mobile"), cid("sites")]
    monkeypatch.setenv("GATE2_RERUN_ONLY", "1")
    monkeypatch.setenv("GATE2_AFTER_REPORT", str(first))
    assert g.main_cli(["release/2405", "--no-visual", "--tier", "X"]) == 2      # stops at the tier check, after the flags are settled
    assert g.VISUAL == "block" and g.VISUAL_RERUN_CASES == [cid("map-floor", project="mobile"), cid("sites")], "--no-visual is overridden"
    # the re-run captures those screens on those projects; only the two cases are judged; one the run did not produce is an error
    calls = fake_runs(g, monkeypatch, [row("sites", "pass"), row("sites", "diff", scheme="dark"), row("map-floor", "pass", project="desktop")],
                      [row("map-floor", "diff", project="mobile")])
    g.run_visual(tmp_path, tmp_path, "http://x/", tmp_path)
    assert calls[0] == ("visual", ["--screens", "map-floor,sites", "--projects", "desktop,mobile"])
    assert [(i["status"], i["id"]) for i in g.ITEMS] == [("FAIL", cid("map-floor", project="mobile"))]
    assert g.COUNTS["visual"]["pass"] == 1, "the dark case of sites was captured but is not one of the re-run's cases"


def test_a_rerun_without_visual_failures_has_no_visual_step(g, monkeypatch, tmp_path):
    first = tmp_path / "first.json"
    first.write_text(json.dumps({"sha": "abc", "items": [{"category": "backend", "id": "tests/test_x.py::t", "status": "FAIL"}]}), encoding="utf-8")
    monkeypatch.setenv("GATE2_RERUN_ONLY", "1")
    monkeypatch.setenv("GATE2_AFTER_REPORT", str(first))
    assert g.main_cli(["release/2405", "--tier", "X"]) == 2
    assert g.VISUAL == "" and g.VISUAL_RERUN_CASES == []


def test_the_preview_not_starting_fails_a_blocking_step(g, monkeypatch, tmp_path):
    monkeypatch.setattr(g, "free_port", lambda pair=False: 1)
    monkeypatch.setattr(g, "start_vite", lambda *a: (None, False))
    monkeypatch.setattr(g, "reap", lambda p: None)
    g.visual_block(tmp_path, tmp_path, tmp_path, 2)
    assert [(i["category"], i["status"]) for i in g.ITEMS] == [("visual-run", "FAIL")]


# ---------------------------------------------------------------- gate 2: verdict, quarantine, selection, wrappers

def _quarantine(tmp_path, match, category="visual"):
    q = tmp_path / "q.json"
    q.write_text(json.dumps({"entries": [{"match": match, "category": category, "ticket": "T074-Q1", "owner": "lead", "reason": "flakes twice under load",
                                          "added": "2026-11-05", "expires": "2026-11-10"}]}), encoding="utf-8")
    return q


def test_a_visual_failure_is_a_test_failure_that_a_ticketed_entry_can_quarantine(tmp_path):
    rep = {"branch": "release/2405", "sha": "abc", "verdict": "fail", "items": [{"category": "visual", "id": cid("sites"), "status": "FAIL", "reason": "x"}]}
    c = g2v.classify(rep, [])
    assert not c["hard"] and [i["id"] for i in c["real"]] == [cid("sites")]
    rp = tmp_path / "gate_r_abc.json"
    rp.write_text(json.dumps(rep), encoding="utf-8")
    assert g2v.main([str(rp), "--quarantine", str(_quarantine(tmp_path, "sites / ready")), "--today", "2026-11-06"]) == 10, "all quarantined -> re-run"
    assert g2v.main([str(rp), "--quarantine", str(_quarantine(tmp_path, "sites / ready")), "--today", "2026-11-06", "--second"]) == 1, "second red is real"
    assert g2v.main([str(rp), "--quarantine", str(_quarantine(tmp_path, "sites / ready", "pixel")), "--today", "2026-11-06"]) == 1, "category must match"
    md = (tmp_path / "gate_r_abc.gate2.md").read_text(encoding="utf-8")
    assert "Visual failures (T074)" in md and "visual.mjs accept --screens" in md
    hard = dict(rep, items=[{"category": "visual-run", "id": "visual matrix: no results", "status": "FAIL"}])
    assert g2v.classify(hard, [{"match": "visual", "category": "*", "ticket": "t", "owner": "o", "reason": "r", "expires": "2099-01-01"}])["hard"]


def test_the_quarantine_tool_accepts_the_visual_category(tmp_path):
    q = tmp_path / "q.json"
    e = gq.add_entry(q, cid("sites"), "visual", "T074-Q1", "lead", "font hinting flakes twice", days=3, today=dt.date(2026, 11, 6))
    assert e["category"] == "visual" and e["expires"] == "2026-11-09"
    with pytest.raises(ValueError):
        gq.add_entry(q, "x", "visual-run", "T", "lead", "r", today=dt.date(2026, 11, 6))


def test_the_selector_keeps_the_visual_step_on_when_something_it_compares_changed(tmp_path):
    assert g2s.visual_decision(["frontend/src/screens/explore-sites.ts"], True, None).startswith("run:")
    assert g2s.visual_decision(["frontend/tests/visual-matrix.spec.ts-snapshots/sites-ready-light-desktop-linux.png"], False, None).startswith("run:")
    assert g2s.visual_decision(["frontend/tests/visual/matrix.json"], False, None).startswith("run:")
    assert g2s.visual_decision(["docs/a.md"], False, {"visual": {cid("sites")}}).startswith("run:")
    assert g2s.visual_decision(["smplwise_vms/backend/smplwise/main.py", "docs/a.md"], False, {"visual": set()}).startswith("skip:")
    rep = tmp_path / "r.json"
    rep.write_text(json.dumps({"sha": "abc", "items": [{"category": "visual", "id": cid("sites"), "status": "FAIL"},
                                                       {"category": "visual", "id": cid("x"), "status": "FLAKY"}]}), encoding="utf-8")
    f = g2s.failed_files(rep)
    assert f["visual"] == {cid("sites")} and f["frontend"] == set() and f["backend"] == set()
    (tmp_path / g2s.BE / "tests").mkdir(parents=True)
    (tmp_path / g2s.FE / "tests").mkdir(parents=True)
    sel = g2s.rerun_only_selection(tmp_path, f)
    assert sel["after"]["visual"] == [cid("sites")] and sel["visual"].startswith("run:")


def test_the_wrappers_pass_no_visual_only_on_the_selectors_skip():
    rg2 = (GATE / "release_gate2.sh").read_text(encoding="utf-8")
    bc = (GATE / "branch_check.sh").read_text(encoding="utf-8")
    sel = (GATE / "gate2_select.py").read_text(encoding="utf-8")
    assert 'grep -q "^  visual: skip" && ENGINE+=(--no-visual)' in rg2 and 'grep -q "pixel: no frontend/src change"' not in rg2
    assert 'grep -q "^  visual: skip" && VIS=(--no-visual)' in bc
    engine_line = next(x for x in bc.splitlines() if '"$G/release_gate.py" "$BR"' in x)
    assert "--no-visual" not in engine_line and '${VIS[@]+"${VIS[@]}"}' in engine_line
    assert 'print(f"  visual: {sel.get(' in sel, "the line the wrappers grep for"


def test_the_nightly_compares_every_screen_blocking_and_reports_the_video_timing(g, monkeypatch, tmp_path):
    g.VISUAL_SCOPE = "all"
    calls = fake_runs(g, monkeypatch, [row("sites", "pass")])
    g.run_visual(tmp_path, tmp_path, "http://x/", tmp_path)
    assert calls == [("visual", ["--all"])] and g.VISUAL_INFO["scope"] == "all"
    nt = (GATE / "nightly_tests.sh").read_text(encoding="utf-8")
    assert 'VMODE="${SW_NIGHTLY_VISUAL:-block}"' in nt and 'GATE_VISUAL="$VMODE" GATE_VISUAL_SCOPE=all' in nt
    assert "GATE_VISUAL=off" not in nt, "the old unconditional switch-off is gone (SW_NIGHTLY_VISUAL=off is the rollback)"
    vt_line = next(x for x in nt.splitlines() if 'python3 "$VT" report' in x)
    assert '"${VARGS[@]}"' in vt_line and "--enforce" not in vt_line, "report only while the limits are provisional"
    assert "NOT_RUN - no input in" in nt
