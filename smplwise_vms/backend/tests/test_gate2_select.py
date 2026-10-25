"""GATE2-295: unit tests of the gate-2 selection policy and verdict post-processor (pure functions; no git, no runner)."""
import datetime as dt
import json
import sys
from pathlib import Path

GATE = Path(__file__).resolve().parents[3] / "scripts" / "gate"
if str(GATE) not in sys.path:
    sys.path.insert(0, str(GATE))

import gate2_select as g  # noqa: E402
import gate2_verdict as v  # noqa: E402


def test_py_aliases_resolve_relative_imports_and_as_names():
    text = "from .services import announcements as announcements_svc, quiet\nasync def f():\n    from .services.notices import news_sources\n"
    a = g.py_aliases(text)
    assert a["announcements_svc"] == "smplwise.services.announcements"
    assert a["quiet"] == "smplwise.services.quiet"
    assert a["news_sources"] == "smplwise.services.notices.news_sources"


def test_line_modules_uses_aliases_and_dotted_paths_but_not_hubs():
    mods = {"smplwise.services.announcements": Path("a.py"), "smplwise.services.notices": Path("n.py"),
            "smplwise.services.notices.news_sources": Path("ns.py"), "smplwise.db": Path("db.py")}
    aliases = {"announcements_svc": "smplwise.services.announcements", "db": "smplwise.db"}
    assert g._line_modules("announcements_svc.release_queued(db, settings)", aliases, mods) == {"smplwise.services.announcements"}
    assert g._line_modules("from .services.notices import news_sources", {}, mods) == {"smplwise.services.notices"}


def test_migration_tables():
    sql = ("CREATE TABLE IF NOT EXISTS announcements_new (id INTEGER);\nINSERT INTO announcements_new SELECT * FROM announcements;\n"
           "DROP TABLE announcements;\nALTER TABLE announcements_new RENAME TO announcements;\nCREATE INDEX ix_a ON announcements(id);")
    assert g.migration_tables(sql) == {"announcements", "announcements_new"}


def test_roles_doc_parses_and_tolerates_garbage():
    doc = json.dumps({"roles": [{"id": "viewer", "permissions": ["map.read"]}, {"id": "x"}]})
    assert g._roles_doc(doc) == {"viewer": {"map.read"}, "x": set()}
    assert g._roles_doc("{not json") == {}


def test_rerun_only_selection_keeps_only_existing_failed_files(tmp_path):
    (tmp_path / g.BE / "tests").mkdir(parents=True)
    (tmp_path / g.FE / "tests").mkdir(parents=True)
    for n in ("test_a.py", "test_b.py"):
        (tmp_path / g.BE / "tests" / n).write_text("")
    for n in ("x.spec.ts", "y.spec.ts"):
        (tmp_path / g.FE / "tests" / n).write_text("")
    sel = g.rerun_only_selection(tmp_path, {"backend": {"test_a.py", "test_gone.py"}, "frontend": {"y.spec.ts"}})
    assert sel["backend"]["selected"] == ["test_a.py"] and sel["backend"]["dropped"] == ["test_b.py"]
    assert sel["frontend"]["selected"] == ["y.spec.ts"] and sel["frontend"]["dropped"] == ["x.spec.ts"]
    assert not sel["full"]["backend"] and not sel["full"]["frontend"]


def test_failed_files_reads_backend_and_spec_items(tmp_path):
    rep = {"sha": "abc123", "items": [
        {"category": "backend", "id": "tests/test_x.py::test_y", "status": "FAIL"},
        {"category": "preview", "id": "evidence-a.spec.ts:12 [desktop] t", "status": "FAIL"},
        {"category": "preview", "id": "evidence-b.spec.ts:3 [mobile] t", "status": "FLAKY"},
        {"category": "tsc", "id": "tsc --noEmit", "status": "FAIL"}]}
    p = tmp_path / "r.json"
    p.write_text(json.dumps(rep))
    f = g.failed_files(p)
    assert f["backend"] == {"test_x.py"} and f["frontend"] == {"evidence-a.spec.ts"} and f["sha"] == "abc123"


def test_quarantine_rules(tmp_path):
    today = dt.date(2026, 10, 25)
    q = {"entries": [
        {"match": "test_ok", "category": "backend", "ticket": "T1", "owner": "lead", "added": "2026-10-20", "expires": "2026-11-05"},
        {"match": "old", "ticket": "T2", "owner": "lead", "added": "2026-10-01", "expires": "2026-10-10"},
        {"match": "long", "ticket": "T3", "owner": "lead", "added": "2026-10-20", "expires": "2026-12-30"},
        {"match": "noticket", "owner": "lead", "added": "2026-10-20", "expires": "2026-10-30"}]}
    p = tmp_path / "q.json"
    p.write_text(json.dumps(q))
    active, probs = v.load_quarantine(p, today)
    assert [e["match"] for e in active] == ["test_ok"] and len(probs) == 3


def test_verdict_classification_and_exit_codes(tmp_path):
    entries = [{"match": "test_flaky", "category": "*", "ticket": "T", "owner": "o", "added": "2026-10-20", "expires": "2026-11-01"}]
    rep = {"verdict": "fail", "branch": "release/x", "sha": "s", "items": [
        {"category": "backend", "id": "tests/test_flaky.py::t", "status": "FAIL", "reason": ""}]}
    c = v.classify(rep, entries)
    assert len(c["quarantined"]) == 1 and not c["real"] and not c["hard"]
    rep2 = dict(rep, items=rep["items"] + [{"category": "build", "id": "vite build", "status": "FAIL", "reason": ""}])
    assert len(v.classify(rep2, entries)["hard"]) == 1
    qp = tmp_path / "q.json"
    qp.write_text(json.dumps({"entries": [dict(entries[0], expires="2099-01-01", added="2099-01-01")]}))
    # an entry dated in the future is still valid (added <= expires, <= 21 days)
    rp = tmp_path / "gate_release-x_s.json"
    rp.write_text(json.dumps(rep))
    assert v.main([str(rp), "--quarantine", str(qp)]) == 10           # all failures quarantined -> re-run only those
    assert v.main([str(rp), "--quarantine", str(qp), "--second"]) == 1  # red again on the re-run -> a real FAIL
    rp.write_text(json.dumps(dict(rep, verdict="pass", items=[])))
    assert v.main([str(rp), "--quarantine", str(qp)]) == 0
    assert (tmp_path / "gate_release-x_s.gate2.md").exists()


def test_replay_r3_repo_lint_is_core():
    assert "test_no_ip_literals.py" in g.CORE_BACKEND
    assert g.REPO_SCAN_BE_RE.search("subprocess.run(['git', 'ls-files'], ...)")


def test_replay_r2_tree_scanner_detection():
    assert g.TREE_SCAN_FE_RE.search("for (const f of readdirSync(path.join(HERE, '../src'), { recursive: true }))")
    assert not g.TREE_SCAN_FE_RE.search("await page.goto('/'); expect(1).toBe(1)")


def test_replay_r4_esbuild_string_imports_are_resolved(tmp_path):
    fe = tmp_path / "frontend"
    (fe / "src" / "arx").mkdir(parents=True)
    (fe / "src" / "design").mkdir(parents=True)
    (fe / "tests").mkdir(parents=True)
    (fe / "src" / "arx" / "arx-login.ts").write_text("export const x = 1;\n")
    (fe / "src" / "arx" / "auth.ts").write_text("export const y = 1;\n")
    (fe / "src" / "design" / "boot.ts").write_text("export {};\n")
    spec = fe / "tests" / "unit-brand-login.spec.ts"
    spec.write_text(
        "import { build } from 'esbuild';\n"
        "const r = await build({ stdin: { contents: \"import '../design/boot';\\nimport './arx-login';\\n\", "
        "resolveDir: path.join(HERE, '../src/arx'), loader: 'ts' }, bundle: true });\n"
        "const s = await build({ entryPoints: [path.join(HERE, '../src/arx/auth.ts')], bundle: true });\n")
    deps = {p.name for p in g.esbuild_deps(spec, fe)}
    assert deps == {"arx-login.ts", "boot.ts", "auth.ts"}
    plain = fe / "tests" / "x.spec.ts"
    plain.write_text("import { test } from '@playwright/test';\n")
    assert g.esbuild_deps(plain, fe) == set()


def _repo(tmp_path):
    import subprocess
    r = tmp_path / "repo"
    for d in ("smplwise_vms/backend/smplwise", "smplwise_vms/backend/tests", "frontend/src", "frontend/tests"):
        (r / d).mkdir(parents=True)
    (r / "smplwise_vms/backend/smplwise/x.py").write_text("X = 1\n")
    (r / "smplwise_vms/backend/tests/test_x.py").write_text("from smplwise import x\n")
    (r / "frontend/src/a.ts").write_text("export const a = 1;\n")
    (r / "frontend/vite.config.ts").write_text("export default {};\n")
    (r / "frontend/tests/unit-a.spec.ts").write_text("import { a } from '../src/a';\n")
    (r / "frontend/tests/layout-heavy.spec.ts").write_text("import { test } from '@playwright/test';\n")
    (r / "frontend/tests/unit-scan.spec.ts").write_text("readdirSync(path.join(HERE, '../src'))\n")

    def git(*a):
        subprocess.run(["git", "-C", str(r), "-c", "user.email=t@t", "-c", "user.name=t", *a], check=True, capture_output=True)
    git("init", "-q"); git("add", "-A"); git("commit", "-q", "-m", "base"); git("tag", "base")
    return r, git


def test_unit_spec_reached_by_the_closure_is_kept_and_tree_scanner_runs(tmp_path):
    r, git = _repo(tmp_path)
    (r / "frontend/src/a.ts").write_text("export const a = 2;\n")
    git("commit", "-q", "-am", "change")
    sel = g.select_gate2(r, "base", "HEAD", costs={"seconds": {"layout-heavy.spec.ts": 5000}})
    f = sel["frontend"]
    assert "unit-a.spec.ts" in f["selected"] and f["why"]["unit-a.spec.ts"] == "imports a changed file"
    assert "unit-scan.spec.ts" in f["selected"]          # R2
    assert "layout-heavy.spec.ts" not in f["selected"] and "layout-heavy.spec.ts" not in sel["deferred_to_nightly"]


def test_r1_no_heavy_deferral_on_a_full_tier_side(tmp_path):
    r, git = _repo(tmp_path)
    (r / "frontend/vite.config.ts").write_text("export default { x: 1 };\n")
    git("commit", "-q", "-am", "config")
    sel = g.select_gate2(r, "base", "HEAD", costs={"seconds": {"layout-heavy.spec.ts": 5000}})
    assert sel["full"]["frontend"] and sel["deferred_to_nightly"] == {}
    assert "layout-heavy.spec.ts" in sel["frontend"]["selected"]


def test_cost_seed_is_tracked_and_has_both_sides():
    c = g.load_costs(None)
    assert len(c.get("seconds", {})) > 100 and len(c.get("backend_seconds", {})) > 100


def test_wall_range_is_ordered_and_includes_fixed_phases():
    est = {"pw_makespan_s": 1800.0, "backend_wall_s": 1200.0}
    full = {"pw_makespan_s": 8000.0, "backend_wall_s": 5700.0}
    lo, hi = g.wall_range(est, full)
    assert 0 < lo <= hi
    assert lo >= (1800 * 0.85) / 60
