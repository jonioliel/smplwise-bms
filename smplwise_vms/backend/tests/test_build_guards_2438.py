"""CR-BUILD-GUARDS-2438: no debug source map ships in the add-on (07:F7, owner Q-CODE-3 a) and the design-debt ratchet
(owner Q-CODE-4 a) blocks only a count that went up. Fake trees under tmp_path; the real repository is covered by
test_release_check.py (run_checks on the checkout)."""
from __future__ import annotations

import importlib.util
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


rc = _load("release_check_2438", "scripts/release_check.py")
dr = _load("design_ratchet_2438", "scripts/design_ratchet.py")

CLEAN = """import { css, html } from 'lit';
// a comment with #fff and 12px and window.confirm( is not counted
/* nor here: overflow: auto; <table> */
export const s = css`.a { color: var(--sw-text); gap: var(--sw-gap); }`;
export const t = html`<sw-toggle></sw-toggle>`;
"""
TOKENS = ":root { --sw-text: #111; --sw-gap: 4px; }\n"


def _tree(tmp_path: Path, files: dict[str, str]) -> Path:
    root = tmp_path / "repo"
    for rel, text in files.items():
        p = root / "frontend" / "src" / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    return root


# ---- source maps (07:F7)

def test_shipped_maps_are_findings(tmp_path):
    addon = tmp_path / "smplwise_vms"
    (addon / "www" / "assets").mkdir(parents=True)
    (addon / "www-public" / "assets").mkdir(parents=True)
    (addon / "www" / "assets" / "index-a.js").write_text("a();\n", encoding="utf-8")
    assert rc.shipped_source_maps(addon) == []
    (addon / "www" / "assets" / "index-a.js.map").write_text("{}", encoding="utf-8")
    (addon / "www-public" / "assets" / "p.js").write_text("p();\n//# sourceMappingURL=p.js.map\n", encoding="utf-8")
    assert rc.shipped_source_maps(addon) == ["www/assets/index-a.js.map", "www-public/assets/p.js (sourceMappingURL comment)"]


def test_the_checkout_ships_no_map():
    assert rc.shipped_source_maps(ROOT / "smplwise_vms") == []


def test_build_addon_moves_the_maps_out():
    pkg = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
    assert pkg["scripts"]["build:addon"].endswith("&& node scripts/sourcemaps-archive.mjs")
    assert (ROOT / "frontend" / "scripts" / "sourcemaps-archive.mjs").exists()
    ignore = (ROOT / "smplwise_vms" / ".dockerignore").read_text(encoding="utf-8").split()
    assert "www/**/*.map" in ignore and "www-public/**/*.map" in ignore


# ---- design-debt ratchet

def test_comments_are_not_counted_and_defined_tokens_are_fine(tmp_path):
    root = _tree(tmp_path, {"screens/a.ts": CLEAN, "design/tokens.css": TOKENS})
    t = dr.totals(dr.scan(root))
    assert t == {m: 0 for m in dr.METRICS}, t


def test_each_metric_counts(tmp_path):
    bad = """export const s = css`.a { color: #ff0000; background: rgba(0,0,0,.4); width: 12px; overflow-y: auto;
      color: var(--sw-nowhere); border: var(--sw-text); }`;
    export const t = html`<select></select><table></table><input type="checkbox"><div role="switch"></div>`;
    export function go() { if (window.confirm('x')) return; const ok = confirm('y'); }
    class K { confirm() { return 1; } }
    """
    root = _tree(tmp_path, {"screens/a.ts": bad, "design/tokens.css": TOKENS + ".x { color: #abc; width: 3px; }"})
    t = dr.totals(dr.scan(root))
    assert t == {"color-literal": 2, "px-literal": 1, "undefined-token": 1, "native-dialog": 2, "native-select": 1,
                 "native-table": 1, "hand-switch": 2, "scroll-container": 1}, t


def test_the_shared_primitives_are_exempt(tmp_path):
    root = _tree(tmp_path, {"components/sw-table.ts": "html`<table></table>`", "components/sw-toggle.ts": "html`<div role=\"switch\"></div>`"})
    t = dr.totals(dr.scan(root))
    assert t["native-table"] == 0 and t["hand-switch"] == 0


def test_ratchet_fails_only_when_a_count_goes_up(tmp_path):
    root = _tree(tmp_path, {"screens/a.ts": "css`.a { width: 10px; height: 20px; }`", "design/tokens.css": TOKENS})
    counts, refused = dr.update(root, allow_raise=True)
    assert counts["px-literal"] == 2 and refused == []
    assert dr.check(root, base=None)["ok"]
    # down: still green, and it says the baseline may be lowered
    (root / "frontend" / "src" / "screens" / "a.ts").write_text("css`.a { width: 10px; }`", encoding="utf-8")
    res = dr.check(root, base=None)
    assert res["ok"] and res["down"] == ["px-literal"]
    # update lowers, never raises without --allow-raise
    assert dr.update(root, allow_raise=False)[0]["px-literal"] == 1
    (root / "frontend" / "src" / "screens" / "b.ts").write_text("css`.b { width: 1px; color: #123456; }`", encoding="utf-8")
    res = dr.check(root, base=None)
    assert not res["ok"] and set(res["up"]) == {"px-literal", "color-literal"}, res
    counts, refused = dr.update(root, allow_raise=False)
    assert counts["px-literal"] == 1 and set(refused) == {"px-literal", "color-literal"}
    assert not dr.check(root, base=None)["ok"]


def test_ratchet_names_the_changed_file(tmp_path):
    root = _tree(tmp_path, {"screens/a.ts": "css`.a { width: 10px; }`"})

    def git(*a):
        subprocess.run(["git", "-C", str(root), *a], check=True, capture_output=True)
    git("init", "-q", "-b", "main")
    git("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A")
    dr.update(root, allow_raise=True)
    git("add", "-A")
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base")
    git("branch", "base")
    (root / "frontend" / "src" / "screens" / "a.ts").write_text("css`.a { width: 10px; height: 4px; }`", encoding="utf-8")
    res = dr.check(root, base="base")
    assert not res["ok"]
    assert res["where"]["px-literal"] == [{"file": "screens/a.ts", "base": 1, "now": 2}]


def test_no_frontend_is_not_applicable_and_a_missing_baseline_fails(tmp_path):
    assert dr.check(tmp_path, base=None)["ok"]
    root = _tree(tmp_path, {"screens/a.ts": CLEAN})
    assert not dr.check(root, base=None)["ok"]


def test_the_checkout_is_at_or_below_its_baseline():
    res = rc.design_ratchet(ROOT)
    assert res["ok"], res["detail"]
