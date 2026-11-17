#!/usr/bin/env python3
"""Design-debt ratchet for frontend/src (CR-BUILD-GUARDS-2438, owner decision Q-CODE-4 a).

Counts the patterns that are design debt in this UI, compares every count with the committed baseline
(scripts/design_ratchet_baseline.json) and FAILS only when a count went UP. A count that went down is good news: the
baseline may be lowered (`--update`), it is never required. The existing debt is not judged here; new debt is refused.

Metrics (string scans of frontend/src/**/*.ts|css after the comments are removed; heuristics, counted the same way every run):
  color-literal      a hex colour (#abc, #aabbcc, #aabbccdd) or rgb()/rgba()/hsl()/hsla() outside the token and palette
                     definitions (src/design/) and demo data (src/fixtures/, *-mock.ts) - use a --sw-* token
  px-literal         a number with px outside src/design/, src/fixtures/, *-mock.ts - use a spacing / size token
  undefined-token    var(--sw-x) with no fallback where --sw-x is defined nowhere in src/ (review 07:F9: the declaration is dropped)
  native-dialog      window.confirm / alert / prompt (and the bare calls) - use sw-dialog / the confirm pattern
  native-select      <select ...> in a template - use the shared picker components
  native-table       <table ...> outside components/sw-table.ts - use sw-table
  hand-switch        role="switch" or type="checkbox" outside components/sw-toggle.ts - use sw-toggle
  scroll-container   overflow / overflow-x / overflow-y: auto | scroll - control screens use pages, not scrolling

Usage:
  python scripts/design_ratchet.py                 check (exit 0 = no count above the baseline, 1 = a count went up, 2 = usage)
  python scripts/design_ratchet.py --json out.json also write the result
  python scripts/design_ratchet.py --files METRIC  list the files that carry METRIC, with counts (largest first)
  python scripts/design_ratchet.py --update        lower the baseline to today's counts (never raises one)
  python scripts/design_ratchet.py --update --allow-raise   write today's counts even where higher (an owner-approved exception;
                                                   the diff of the baseline file is what the reviewer sees)
On a failure the report lists, for the metric that went up, the files changed against the merge base with origin/main
(--base to change) with their count there and here, so the new occurrence is easy to find.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

BASELINE_REL = Path("scripts") / "design_ratchet_baseline.json"
SRC_REL = Path("frontend") / "src"

_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.S)
_LINE_COMMENT = re.compile(r"^\s*//.*$", re.M)
_TRAILING_COMMENT = re.compile(r"(?<![:'\"`\\/])//\s.*$", re.M)   # `code; // note` - not `http://`, not inside a quoted '//'

_HEX = re.compile(r"(?<![\w&/#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])")
_FUNC_COLOR = re.compile(r"(?<![\w-])(?:rgba?|hsla?)\(")
_PX = re.compile(r"(?<![\w.-])-?\d+(?:\.\d+)?px\b")
_NATIVE_DIALOG = re.compile(
    r"\b(?:window|globalThis|self)\.(?:confirm|alert|prompt)\s*\("
    r"|(?:[(!=&|?,;:]|\breturn|\bawait|\bvoid)\s*(?:confirm|alert|prompt)\s*\(")
_SELECT = re.compile(r"<select\b")
_TABLE = re.compile(r"<table\b")
_SWITCH = re.compile(r"role\s*=\s*[\"']switch[\"']|type\s*=\s*[\"']checkbox[\"']")
_SCROLL = re.compile(r"overflow(?:-[xy])?\s*:\s*(?:auto|scroll)\b")
_VAR_NOFALLBACK = re.compile(r"var\(\s*(--sw-[\w-]+)\s*\)")
_DEFINED_TOKEN = re.compile(r"(--sw-[\w-]+)\s*:")
_DEFINED_TOKEN_JS = re.compile(r"[\"'`](--sw-[\w-]+)[\"'`]")   # tokens set from code: setProperty('--sw-x', ...), {'--sw-x': ...}


def _not_design_or_data(rel: str) -> bool:
    return not (rel.startswith("design/") or rel.startswith("fixtures/") or rel.endswith("-mock.ts"))


METRICS: dict[str, tuple[re.Pattern[str] | None, Callable[[str], bool], str]] = {
    "color-literal": (None, _not_design_or_data, "hex / rgb() / hsl() colour outside src/design (use a --sw-* token)"),
    "px-literal": (_PX, _not_design_or_data, "px value outside src/design (use a size / spacing token)"),
    "undefined-token": (None, lambda rel: True, "var(--sw-x) without a fallback where --sw-x is defined nowhere"),
    "native-dialog": (_NATIVE_DIALOG, lambda rel: True, "window.confirm / alert / prompt (use sw-dialog)"),
    "native-select": (_SELECT, lambda rel: True, "<select> in a template (use the shared pickers)"),
    "native-table": (_TABLE, lambda rel: rel != "components/sw-table.ts", "<table> outside sw-table"),
    "hand-switch": (_SWITCH, lambda rel: rel != "components/sw-toggle.ts", "hand-built switch / checkbox outside sw-toggle"),
    "scroll-container": (_SCROLL, lambda rel: True, "overflow: auto | scroll (control screens use pages)"),
}


def strip_comments(text: str) -> str:
    text = _BLOCK_COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    text = _LINE_COMMENT.sub("", text)
    return _TRAILING_COMMENT.sub("", text)


def source_files(src: Path) -> list[Path]:
    return sorted(p for p in src.rglob("*") if p.is_file() and p.suffix in (".ts", ".css"))


def defined_tokens(texts: dict[str, str]) -> set[str]:
    out: set[str] = set()
    for t in texts.values():
        out.update(_DEFINED_TOKEN.findall(t))
        out.update(_DEFINED_TOKEN_JS.findall(t))
    return out


def count_text(rel: str, text: str, tokens: set[str]) -> dict[str, int]:
    """The metric counts of one source file (text already without comments); rel is the path below frontend/src."""
    out: dict[str, int] = {}
    for name, (rx, applies, _) in METRICS.items():
        if not applies(rel):
            continue
        if name == "color-literal":
            n = len(_HEX.findall(text)) + len(_FUNC_COLOR.findall(text))
        elif name == "undefined-token":
            n = sum(1 for t in _VAR_NOFALLBACK.findall(text) if t not in tokens)
        else:
            assert rx is not None
            n = len(rx.findall(text))
        if n:
            out[name] = n
    return out


def scan(root: Path) -> dict[str, dict[str, int]]:
    """{metric: {file (relative to frontend/src): count}} for the checkout at root."""
    src = root / SRC_REL
    texts = {p.relative_to(src).as_posix(): strip_comments(p.read_text(encoding="utf-8", errors="replace")) for p in source_files(src)}
    tokens = defined_tokens(texts)
    per: dict[str, dict[str, int]] = {m: {} for m in METRICS}
    for rel, text in texts.items():
        for m, n in count_text(rel, text, tokens).items():
            per[m][rel] = n
    return per


def totals(per: dict[str, dict[str, int]]) -> dict[str, int]:
    return {m: sum(per.get(m, {}).values()) for m in METRICS}


def load_baseline(root: Path) -> dict[str, Any] | None:
    p = root / BASELINE_REL
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def _git(root: Path, *args: str) -> str | None:
    try:
        r = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 else None


def changed_file_deltas(root: Path, base: str, metrics: list[str], per: dict[str, dict[str, int]]) -> dict[str, list[dict[str, Any]]]:
    """For each metric that went up: the src files changed since merge-base(base, HEAD) whose count grew, with both counts."""
    mb = (_git(root, "merge-base", base, "HEAD") or "").strip()
    if not mb:
        return {}
    names = (_git(root, "diff", "--name-only", f"{mb}", "--", SRC_REL.as_posix()) or "").split()
    src_prefix = SRC_REL.as_posix() + "/"
    rels = [n[len(src_prefix):] for n in names if n.startswith(src_prefix) and n.endswith((".ts", ".css"))]
    tokens = _all_tokens_cache(root)
    out: dict[str, list[dict[str, Any]]] = {m: [] for m in metrics}
    for rel in rels:
        old_text = _git(root, "show", f"{mb}:{SRC_REL.as_posix()}/{rel}")
        old = count_text(rel, strip_comments(old_text), tokens) if old_text is not None else {}
        for m in metrics:
            now = per.get(m, {}).get(rel, 0)
            if now > old.get(m, 0):
                out[m].append({"file": rel, "base": old.get(m, 0), "now": now})
    return out


_TOKENS: dict[str, set[str]] = {}


def _all_tokens_cache(root: Path) -> set[str]:
    key = str(root)
    if key not in _TOKENS:
        src = root / SRC_REL
        _TOKENS[key] = defined_tokens({p.as_posix(): strip_comments(p.read_text(encoding="utf-8", errors="replace")) for p in source_files(src)})
    return _TOKENS[key]


def check(root: Path, base: str | None = "origin/main") -> dict[str, Any]:
    """The ratchet verdict: ok, per-metric rows, and (when a count went up) where."""
    if not (root / SRC_REL).is_dir():
        return {"ok": True, "applicable": False, "detail": "no frontend/src in this checkout (not applicable)", "rows": []}
    baseline = load_baseline(root)
    if baseline is None:
        return {"ok": False, "applicable": True, "detail": f"no baseline {BASELINE_REL.as_posix()} (run --update --allow-raise once)", "rows": []}
    per = scan(root)
    now = totals(per)
    base_counts: dict[str, int] = baseline.get("counts", {})
    rows = []
    for m in METRICS:
        b = base_counts.get(m)
        n = now[m]
        state = "new-metric" if b is None else ("up" if n > b else ("down" if n < b else "same"))
        rows.append({"metric": m, "baseline": b, "now": n, "state": state, "what": METRICS[m][2]})
    up = [r["metric"] for r in rows if r["state"] in ("up", "new-metric") and r["now"] > (r["baseline"] or 0)]
    where = changed_file_deltas(root, base, up, per) if (up and base) else {}
    down = [r["metric"] for r in rows if r["state"] == "down"]
    if up:
        detail = "UP: " + ", ".join(f"{r['metric']} {r['baseline']}->{r['now']}" for r in rows if r["metric"] in up)
    else:
        detail = "no count above the baseline (" + ", ".join(f"{r['metric']} {r['now']}" for r in rows) + ")"
        if down:
            detail += "; lower the baseline with --update: " + ", ".join(down)
    return {"ok": not up, "applicable": True, "detail": detail, "rows": rows, "up": up, "where": where, "down": down}


def update(root: Path, allow_raise: bool) -> tuple[dict[str, int], list[str]]:
    now = totals(scan(root))
    old = (load_baseline(root) or {}).get("counts", {})
    refused = [m for m in METRICS if m in old and now[m] > old[m] and not allow_raise]
    counts = {m: (old[m] if m in refused else now[m]) for m in METRICS}
    doc = {
        "about": "Design-debt ratchet baseline (scripts/design_ratchet.py, CR-BUILD-GUARDS-2438). A check fails when a count goes "
                 "above its number here. Lower it with --update after removing debt; raising needs --allow-raise and the owner's approval.",
        "counts": counts,
    }
    (root / BASELINE_REL).parent.mkdir(parents=True, exist_ok=True)
    (root / BASELINE_REL).write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8", newline="\n")
    return counts, refused


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument("--json", help="write the result as JSON here")
    ap.add_argument("--base", default="origin/main", help="where to look for the files that added debt (merge base with HEAD)")
    ap.add_argument("--files", metavar="METRIC", help="list the files carrying METRIC")
    ap.add_argument("--update", action="store_true", help="lower the baseline to today's counts")
    ap.add_argument("--allow-raise", action="store_true", help="with --update: also raise (owner-approved exception)")
    a = ap.parse_args(argv)
    root = Path(a.root)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    if a.files:
        if a.files not in METRICS:
            print(f"unknown metric {a.files}; one of {', '.join(METRICS)}")
            return 2
        rows = sorted(scan(root)[a.files].items(), key=lambda kv: (-kv[1], kv[0]))
        for rel, n in rows:
            print(f"{n:6d}  {rel}")
        print(f"{sum(n for _, n in rows)} in {len(rows)} files")
        return 0
    if a.update:
        counts, refused = update(root, a.allow_raise)
        print("baseline written:", ", ".join(f"{m} {n}" for m, n in counts.items()))
        if refused:
            print("NOT raised (needs --allow-raise):", ", ".join(refused))
        return 0
    res = check(root, a.base)
    if a.json:
        Path(a.json).write_text(json.dumps(res, indent=1), encoding="utf-8")
    print("Design-debt ratchet - frontend/src")
    for r in res["rows"]:
        print(f"  [{'UP' if r['metric'] in res.get('up', []) else 'ok'}] {r['metric']}: {r['now']} (baseline {r['baseline']}) - {r['what']}")
    for m, items in res.get("where", {}).items():
        for it in items:
            print(f"    {m}: {it['file']} {it['base']} -> {it['now']}")
    print("RESULT:", res["detail"])
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
