"""SCROLL-AUDIT-2480: the design ratchet's scroll-container metric counts only the real debt - a rule on the reviewed allow-list
(scripts/design_ratchet_scroll_allow.json: dialogs, pickers, sideways strips, viewers, the shell, the long-lists `scroll` fallback,
settings / editors, side panels, phone-only rules) is not counted. Fake trees under tmp_path, plus the real allow-list's consistency."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def _load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


dr = _load("design_ratchet_2480", "scripts/design_ratchet.py")

SCREEN = """import { css, html } from 'lit';
export const s = css`
  .dlg .body { overflow: auto; }
  @media (min-width: 1024px) {
    :host([data-long-lists='scroll']) .list { overflow-y: auto; }
    .list { overflow: hidden; }
  }
  /* overflow: auto in a comment is not a rule */
  .feed { max-block-size: 300px; overflow-y: auto; }
`;
export const t = html`<main style="block-size:100dvh;overflow:auto"></main>`;
"""


def _tree(tmp_path: Path, files: dict[str, str], allow: list[dict[str, str]] | None) -> Path:
    root = tmp_path / "repo"
    for rel, text in files.items():
        p = root / "frontend" / "src" / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    if allow is not None:
        (root / "scripts").mkdir(parents=True, exist_ok=True)
        (root / "scripts" / "design_ratchet_scroll_allow.json").write_text(json.dumps({"allow": allow}), encoding="utf-8")
    return root


def test_selectors_of_the_scroll_rules():
    text = dr.strip_comments_keep_offsets(SCREEN)
    sels = [sel for _, sel in dr.scroll_sites(text)]
    assert sels == [".dlg .body", ":host([data-long-lists='scroll']) .list", ".feed", 'style=""'], sels
    # the line numbers are the file's (comments are blanked, not removed)
    lines = [text.count("\n", 0, pos) + 1 for pos, _ in dr.scroll_sites(text)]
    assert lines == [3, 5, 9, 11], lines


def test_without_an_allow_list_every_rule_counts(tmp_path):
    root = _tree(tmp_path, {"screens/a.ts": SCREEN}, None)
    assert dr.totals(dr.scan(root))["scroll-container"] == 4


def test_allowed_rules_are_not_debt_and_stale_entries_are_reported(tmp_path):
    allow = [
        {"file": "screens/a.ts", "selector": ".dlg .body", "kind": "dialog"},
        {"file": "screens/a.ts", "selector": ":host([data-long-lists='scroll']) .list", "kind": "long-lists-scroll"},
        {"file": "screens/a.ts", "selector": 'style=""', "kind": "shell"},
        {"file": "screens/a.ts", "selector": ".gone", "kind": "dialog"},
        {"file": "screens/b.ts", "selector": ".feed", "kind": "dialog"},  # the same selector in another file does not count
    ]
    root = _tree(tmp_path, {"screens/a.ts": SCREEN}, allow)
    assert dr.totals(dr.scan(root))["scroll-container"] == 1  # .feed: a list that scrolls
    rows, stale = dr.scroll_site_rows(root)
    assert [(r["selector"], bool(r["allow"])) for r in rows] == [
        (".dlg .body", True), (":host([data-long-lists='scroll']) .list", True), (".feed", False), ('style=""', True)]
    assert {e["selector"] for e in stale} == {".gone", ".feed"}


def test_the_real_allow_list_is_consistent():
    doc = json.loads((ROOT / "scripts" / "design_ratchet_scroll_allow.json").read_text(encoding="utf-8"))
    kinds = set(doc["kinds"])
    keys = [(e["file"], e["selector"]) for e in doc["allow"]]
    assert len(keys) == len(set(keys)), "duplicate allow-list entries"
    assert all(e["kind"] in kinds for e in doc["allow"]), "an entry with an unknown kind"
    assert all(e.get("screen") for e in doc["allow"]), "every entry names its screen"
    _, stale = dr.scroll_site_rows(ROOT)
    assert stale == [], f"allow-list entries that match no rule (selector changed?): {stale}"
