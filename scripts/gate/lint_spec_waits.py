#!/usr/bin/env python3
"""Spec lint (GATE-FAST-2291, item 6): flags a Playwright spec that MEASURES size or position right after a click without waiting for
animations. HEURISTIC: it catches the common shape, not every case, and it can flag a harmless line (suppress with `// lint-wait: ok`
on the measuring line or the line above). Reads files only, starts nothing.

A finding: a click/tap (`.click(`, `.tap(`, `.dblclick(`, `.press(`, `.hover(`) followed within WINDOW lines (default 8, same test)
by a geometry read (`boundingBox(`, `getBoundingClientRect`, `offsetWidth/Height`, `clientWidth/Height`, `scrollWidth/Height`,
`scrollTop`, `getComputedStyle(...)` of width/height/transform) with NO wait in between (`settle(` from helpers/settle.ts,
`waitForTimeout(`, `waitForFunction(`, `getAnimations`, `expect.poll(`, `toHaveCSS(`, `toPass(`, `requestAnimationFrame`).
Why: a dropdown that opens from scale(0.97) reads 232.8 instead of 240 px when measured at once (GATE-FIX-2270).

  lint_spec_waits.py --new-since <ref> [--root <checkout>]   only spec files ADDED since <ref> (what the gate runs); exit 1 on a finding
  lint_spec_waits.py --all [--root <checkout>]               every spec, report only (exit 0), to see the size of the old debt
  lint_spec_waits.py <file.spec.ts> ...                      the given files, exit 1 on a finding
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

WINDOW = 8
CLICK = re.compile(r"\.(click|tap|dblclick|press|hover)\(")
MEASURE = re.compile(r"boundingBox\(|getBoundingClientRect|\b(offset|client|scroll)(Width|Height)\b|\bscrollTop\b|"
                     r"getComputedStyle\([^)]*\)[^;\n]*\b(width|height|transform|top|left)\b")
WAIT = re.compile(r"\bsettle\(|waitForTimeout\(|waitForFunction\(|getAnimations|expect\.poll\(|toHaveCSS\(|\.toPass\(|requestAnimationFrame")
TEST_START = re.compile(r"^\s*(test|it)(\.\w+)*\(")
OK = "lint-wait: ok"


def lint_text(text: str) -> list[tuple[int, int, str]]:
    """[(click line, measure line, the measuring line)] (1-based)."""
    lines = text.splitlines()
    out, last_click = [], None
    for n, line in enumerate(lines, 1):
        code = line.split("//", 1)[0] if OK not in line else ""
        if TEST_START.match(line):
            last_click = None
        if WAIT.search(code):
            last_click = None
        if MEASURE.search(code) and last_click is not None and n - last_click <= WINDOW and OK not in line and not (n > 1 and OK in lines[n - 2]):
            out.append((last_click, n, line.strip()[:120]))
            last_click = None
            continue
        if CLICK.search(code):
            last_click = n
    return out


def new_specs(root: Path, ref: str) -> list[Path]:
    r = subprocess.run(["git", "-C", str(root), "diff", "--name-only", "--diff-filter=A", f"{ref}...HEAD", "--", "frontend/tests"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        r = subprocess.run(["git", "-C", str(root), "diff", "--name-only", "--diff-filter=A", ref, "HEAD", "--", "frontend/tests"], capture_output=True, text=True)
    return [root / p for p in r.stdout.split() if p.endswith(".spec.ts") and "/archive/" not in p]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("files", nargs="*")
    ap.add_argument("--new-since")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--root", default=".")
    ns = ap.parse_args(argv)
    root = Path(ns.root)
    if ns.new_since:
        files = new_specs(root, ns.new_since)
    elif ns.all:
        files = sorted((root / "frontend" / "tests").glob("*.spec.ts"))
    else:
        files = [Path(f) for f in ns.files]
    total = 0
    for f in files:
        try:
            hits = lint_text(f.read_text(encoding="utf-8", errors="replace"))
        except OSError:
            continue
        for c, m, txt in hits:
            total += 1
            print(f"{f.name}:{m}: geometry read {m - c} line(s) after the click at line {c} with no animation wait (use settle(page) from helpers/settle.ts): {txt}")
    print(f"spec lint: {total} finding(s) in {len(files)} file(s)")
    return 0 if (ns.all or total == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
