"""GATESPEED-293 phase 2: diff-based test selection (scripts/gate/select_tests.py), the quarantine list and the shadow-run
comparison. A tiny synthetic repository (real git) stands in for the product tree."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
GATE = ROOT / "scripts" / "gate"


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, GATE / file)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


st = _load("select_tests_ut", "select_tests.py")
sc = _load("shadow_compare_ut", "shadow_compare.py")

FILES = {
    "smplwise_vms/backend/smplwise/__init__.py": '__version__ = "1.0.0"\n',
    "smplwise_vms/backend/smplwise/main.py": "from .routers import things\n",
    "smplwise_vms/backend/smplwise/db.py": "def now(): pass\n",
    "smplwise_vms/backend/smplwise/routers/__init__.py": "",
    "smplwise_vms/backend/smplwise/routers/things.py": "from ..services import bar\n@router.get(\"/things/{id}\")\ndef get(): pass\n",
    "smplwise_vms/backend/smplwise/services/__init__.py": "",
    "smplwise_vms/backend/smplwise/services/foo.py": "X = 1\n",
    "smplwise_vms/backend/smplwise/services/bar.py": "from .foo import X\nfrom ..db import now\n",
    "smplwise_vms/backend/smplwise/services/lonely.py": "Y = 2\n",
    "smplwise_vms/backend/smplwise/migrations/0001_init.sql": "CREATE TABLE a(x);\n",
    "smplwise_vms/backend/tests/conftest.py": "",
    "smplwise_vms/backend/tests/world_helper.py": "W = 1\n",
    "smplwise_vms/backend/tests/test_foo_direct.py": "from smplwise.services.foo import X\n",
    "smplwise_vms/backend/tests/test_bar.py": "from smplwise.services import bar\n",
    "smplwise_vms/backend/tests/test_api_things.py": "def test_x(client):\n    client.get('/api/v1/things/1')\n",
    "smplwise_vms/backend/tests/test_unrelated.py": "from smplwise.db import now\n",
    "smplwise_vms/backend/tests/test_uses_helper.py": "from world_helper import W\n",
    "smplwise_vms/backend/tests/test_rbac_matrix.py": "",
    "smplwise_vms/backend/tests/test_migrations.py": "",
    "frontend/src/main.ts": "import './shell/nav';\n",
    "frontend/src/shell/nav.ts": "import '../feature/widget';\n",
    "frontend/src/feature/logic.ts": "export const L = 1;\n",
    "frontend/src/feature/widget.ts": "import { L } from './logic';\n@customElement('feature-widget')\nclass W {}\n",
    "frontend/src/other/panel.ts": "@customElement('other-panel')\nclass P {}\n",
    "frontend/tests/unit-core.spec.ts": "test('x', () => {});\n",
    "frontend/tests/evidence-thing.spec.ts": "await page.waitForSelector('sw-app feature-widget');\n",
    "frontend/tests/layout-elsewhere.spec.ts": "await page.waitForSelector('other-panel');\n",
    "frontend/tests/layout-uses-mocks.spec.ts": "import { M } from './thing-mocks';\n",
    "frontend/tests/thing-mocks.ts": "export const M = 1;\n",
    "frontend/tests/evidence-permissions-x.spec.ts": "",
}


def git(repo, *a):
    return subprocess.run(["git", "-C", str(repo), *a], check=True, capture_output=True, text=True).stdout


@pytest.fixture()
def repo(tmp_path):
    r = tmp_path / "repo"
    for p, t in FILES.items():
        f = r / p
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(t, encoding="utf-8")
    git(r.parent, "init", "-q", str(r))
    git(r, "config", "user.email", "t@t"); git(r, "config", "user.name", "t"); git(r, "config", "core.autocrlf", "false")
    git(r, "add", "-A"); git(r, "commit", "-qm", "base")
    git(r, "tag", "base")
    return r


def change(repo, path, text):
    f = repo / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(text, encoding="utf-8")
    git(repo, "add", "-A"); git(repo, "commit", "-qm", "c")
    return st.select_diff(repo, "base", "HEAD")


def test_a_service_change_selects_importers_transitively_and_api_tests_through_the_router(repo):
    s = change(repo, "smplwise_vms/backend/smplwise/services/foo.py", "X = 3\n")
    sel = set(s["backend"]["selected"])
    assert {"test_foo_direct.py", "test_bar.py", "test_api_things.py"} <= sel       # import, closure (bar -> foo), API path
    assert "test_unrelated.py" not in sel and "test_uses_helper.py" not in sel
    assert {"test_rbac_matrix.py", "test_migrations.py"} <= sel                      # security suite + smoke always
    assert not s["full"]["backend"] and not s["full"]["frontend"]
    # no frontend file changed: only the smoke and security specs run
    assert set(s["frontend"]["selected"]) == {"unit-core.spec.ts", "evidence-permissions-x.spec.ts"}


def test_the_closure_does_not_walk_through_the_core_hubs(repo):
    s = change(repo, "smplwise_vms/backend/smplwise/services/lonely.py", "Y = 3\n")
    assert "test_unrelated.py" not in s["backend"]["selected"]                       # imports db only


def test_a_migration_or_shared_fixture_means_the_full_backend(repo):
    s = change(repo, "smplwise_vms/backend/smplwise/migrations/0002_more.sql", "CREATE TABLE b(y);\n")
    assert s["full"]["backend"] and s["backend"]["dropped"] == []
    s2 = change(repo, "smplwise_vms/backend/tests/conftest.py", "# changed\n")
    assert s2["full"]["backend"]


def test_a_test_helper_selects_its_importers(repo):
    s = change(repo, "smplwise_vms/backend/tests/world_helper.py", "W = 2\n")
    assert "test_uses_helper.py" in s["backend"]["selected"] and "test_unrelated.py" not in s["backend"]["selected"]


def test_every_added_or_modified_test_file_runs(repo):
    s = change(repo, "smplwise_vms/backend/tests/test_brand_new.py", "def test_x(): pass\n")
    assert "test_brand_new.py" in s["backend"]["selected"]
    s2 = change(repo, "frontend/tests/layout-elsewhere.spec.ts", "// edited\nawait page.waitForSelector('other-panel');\n")
    assert "layout-elsewhere.spec.ts" in s2["frontend"]["selected"]


def test_a_frontend_logic_change_reaches_the_specs_using_its_element(repo):
    s = change(repo, "frontend/src/feature/logic.ts", "export const L = 2;\n")
    sel = set(s["frontend"]["selected"])
    assert "evidence-thing.spec.ts" in sel                    # widget imports logic, the spec uses <feature-widget>
    assert "layout-elsewhere.spec.ts" not in sel and "layout-uses-mocks.spec.ts" not in sel


def test_a_spec_helper_selects_the_specs_importing_it(repo):
    s = change(repo, "frontend/tests/thing-mocks.ts", "export const M = 2;\n")
    assert "layout-uses-mocks.spec.ts" in s["frontend"]["selected"] and "layout-elsewhere.spec.ts" not in s["frontend"]["selected"]


def test_nav_or_build_config_means_the_full_frontend(repo):
    s = change(repo, "frontend/src/shell/nav.ts", "import '../feature/widget';\n// nav entry\n")
    assert s["full"]["frontend"] and s["frontend"]["dropped"] == []
    s2 = change(repo, "frontend/package.json", '{"dependencies": {"lit": "3"}}\n')
    assert s2["full"]["frontend"]


def test_a_version_bump_alone_triggers_nothing(repo):
    s = change(repo, "smplwise_vms/backend/smplwise/__init__.py", '__version__ = "1.0.1"\n')
    assert s["version_only_ignored"] == ["smplwise_vms/backend/smplwise/__init__.py"] and not s["full"]["backend"]
    s2 = change(repo, "smplwise_vms/backend/smplwise/__init__.py", '__version__ = "1.0.2"\nDEBUG = True\n')
    assert s2["full"]["backend"]                              # a real change in the same file is not ignored


def test_audit_lists_nightly_reds_in_dropped_files(tmp_path):
    nightly = tmp_path / "n.json"
    nightly.write_text(json.dumps({"branch": "main", "sha": "abc", "items": [
        {"category": "backend", "id": "tests/test_unrelated.py::test_a", "status": "FAIL"},
        {"category": "preview", "id": "layout-elsewhere.spec.ts:12 [desktop] t", "status": "FLAKY"},
        {"category": "backend", "id": "tests/test_bar.py::test_b", "status": "FAIL"}]}))
    sel = tmp_path / "gate_x_1.selection.json"
    sel.write_text(json.dumps({"backend": {"dropped": ["test_unrelated.py"]}, "frontend": {"dropped": ["layout-elsewhere.spec.ts"]}}))
    md = st.audit(nightly, [sel])
    assert "would have been missed by a selection run: 2" in md and "test_unrelated.py::test_a" in md and "test_bar" not in md


def test_estimate_uses_the_seed(repo):
    s = change(repo, "smplwise_vms/backend/smplwise/services/foo.py", "X = 4\n")
    est = st.estimate(repo, s, here=GATE)
    assert est["backend_shard_min"][0] <= est["backend_shard_min"][1] and est["frontend_worker_min"][0] <= est["frontend_worker_min"][1]


# ---------------------------------------------------------------- the engine side: selection filters, quarantine
@pytest.fixture()
def g(monkeypatch, tmp_path):
    monkeypatch.setenv("GATE_RESULTS_DIR", str(tmp_path / "results"))
    (tmp_path / "results").mkdir()
    return _load("release_gate_sel", "release_gate.py")


def test_filters_keep_only_selected_files_and_mark_reduced_categories(g):
    cls = {"rest": {"a.spec.ts": {}, "b.spec.ts": {}}, "dev": {"d.spec.ts": {}}, "fixture": {"f.spec.ts": {}}, "pixel": ["a.spec.ts", "p.spec.ts"]}
    sel = {"full": {"backend": [], "frontend": []}, "frontend": {"selected": ["a.spec.ts", "f.spec.ts"], "dropped": ["b.spec.ts", "d.spec.ts", "p.spec.ts"]},
           "backend": {"selected": ["test_a.py"], "dropped": ["test_b.py"], "total": 2}}
    out = g.filter_classification(cls, sel)
    assert list(out["rest"]) == ["a.spec.ts"] and out["dev"] == {} and list(out["fixture"]) == ["f.spec.ts"] and out["pixel"] == ["a.spec.ts"]
    assert set(g.REDUCED_CATS) == {"preview", "dev", "pixel"}
    assert g.backend_only(sel) == {"test_a.py"} and "backend" in g.REDUCED_CATS
    assert g.backend_only({"full": {"backend": ["x"]}, "backend": {"selected": [], "dropped": ["t"]}}) is None
    assert g.backend_only({"error": "boom"}) is None


def test_selection_is_refused_for_a_release_gate_unless_explicitly_enabled(g, monkeypatch):
    monkeypatch.delenv("GATE_SELECT_ENABLE", raising=False)
    assert g.main_cli(["integ/293", "--select-base", "v2.9.2"]) == 2
    assert g.main_cli(["integ/293", "--select-base"]) == 2       # a ref is required as well


def test_a_reduced_category_is_reported_not_judged_by_the_baseline(g):
    g.REDUCED_CATS["preview"] = "1 of 2 spec files"
    g.COUNTS["preview"] = {"pass": 10, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
    g.COUNTS["dev"] = {"pass": 1, "fail": 0, "flaky": 0, "known": 0, "skipped": 0}
    w = g.check_baselines({"tiers": {"L": {"preview": 11000, "dev": 900}}}, "L")
    assert g.BASELINE_ROWS["preview"]["state"] == "selection" and any("diff selection" in x for x in w)
    assert g.BASELINE_ROWS["dev"]["state"] == "low"            # an unreduced category still meets the 70 percent guard


def test_quarantine_after_two_consecutive_first_run_failures_and_release_after_two_clean_gates(g):
    a, b = "tests/test_x.py::test_a", "tests/test_y.py::test_b"
    hist = [("g4", {a: "backend"}), ("g3", {a: "backend", b: "backend"}), ("g2", {}), ("g1", {b: "backend"})]
    q = g.quarantine(hist)
    assert [e["id"] for e in q] == [a]                          # b failed in g1 and g3, never twice in a row
    hist2 = [("g6", {}), ("g5", {}), ("g4", {a: "backend"}), ("g3", {a: "backend"})]
    assert g.quarantine(hist2) == []                            # two clean gates release it
    hist3 = [("g5", {}), ("g4", {a: "backend"}), ("g3", {a: "backend"})]
    assert [e["id"] for e in g.quarantine(hist3)] == [a]        # one clean gate is not enough


def test_first_run_reds_ignore_gate_level_items(g):
    items = [{"category": "backend", "id": "shard 1", "status": "FAIL"},
             {"category": "preview", "id": "a.spec.ts:3 [desktop] t", "status": "FLAKY"},
             {"category": "backend", "id": "tests/t.py::x", "status": "KNOWN"},
             {"category": "gate", "id": "npm ci failed", "status": "FAIL"}]
    assert g.first_run_reds(items) == {"a.spec.ts:3 [desktop] t": "preview"}


def test_gate_history_reads_earlier_reports_newest_first(g):
    for i, fin in ((1, "2026-10-01T00:00:00"), (2, "2026-10-02T00:00:00")):
        (g.RES / f"gate_b_{i}.json").write_text(json.dumps({"branch": "b", "sha": str(i), "verdict": "pass", "finished": fin,
                                                             "items": [{"category": "backend", "id": f"tests/t.py::t{i}", "status": "FLAKY"}]}))
    (g.RES / "gate_b_2.selection.json").write_text("{}")
    h = g.gate_history("b@3", [])
    assert [lab for lab, _ in h] == ["b@3", "b@2", "b@1"]


# ---------------------------------------------------------------- shadow-run comparison
def _rep(sha, counts, items=(), sel=None):
    return {"branch": "integ", "sha": sha, "counts": counts, "items": list(items), "selection": sel}


def test_shadow_same_counts_within_the_flaky_slack_is_same():
    ref = _rep("s", {"backend": {"pass": 100, "fail": 0, "flaky": 2, "known": 0}, "preview": {"pass": 50, "fail": 0, "flaky": 0, "known": 0}})
    sh = _rep("s", {"backend": {"pass": 101, "fail": 0, "flaky": 0, "known": 0}, "preview": {"pass": 50, "fail": 0, "flaky": 0, "known": 0}})
    ok, lines = sc.compare(ref, sh)
    assert ok and "VERDICT: SAME" in lines[-1]


def test_shadow_missing_tests_or_a_new_fail_is_different():
    ref = _rep("s", {"preview": {"pass": 50, "fail": 0, "flaky": 0, "known": 0}})
    ok, _ = sc.compare(ref, _rep("s", {"preview": {"pass": 40, "fail": 0, "flaky": 0, "known": 0}}))
    assert not ok
    ok2, lines = sc.compare(ref, _rep("s", {"preview": {"pass": 50, "fail": 1, "flaky": 0, "known": 0}},
                                      [{"category": "preview", "id": "x.spec.ts:1 [desktop] t", "status": "FAIL"}]))
    assert not ok2 and any("FAIL only in the shadow run" in l for l in lines)


def test_shadow_selection_categories_are_reported_not_judged():
    ref = _rep("s", {"preview": {"pass": 50, "fail": 0, "flaky": 0, "known": 0}})
    ok, lines = sc.compare(ref, _rep("s", {"preview": {"pass": 5, "fail": 0, "flaky": 0, "known": 0}}, sel={"reduced": {"preview": "1 of 10"}}))
    assert ok and any("selection (not judged)" in l for l in lines)
