#!/usr/bin/env python3
"""GATEHYGIENE (2.9.1): the "fast tier" planner and the red-gate rule, mechanically.

Owner rule (2026-10-20): a red release gate may be resolved by a TARGETED run instead of a whole new gate ONLY when
  (1) every failure is demonstrably stale (the test, not the product, was wrong), and
  (2) the diff from the red gate's commit to the fixed commit is TEST-ONLY (tests, test helpers, docs, gate tooling) - no product byte.
This script checks (2), checks that every named failure lives in a file the fix touched (1, the mechanical half), and prints exactly what
the targeted run must contain. The human half of (1) - WHY the test was stale - goes into the integration notes.

    python scripts/gate/targeted_plan.py --base <red gate sha> [--head HEAD] [--failed <pytest node id | spec file[:line]> ...] [--json]

Exit codes: 0 = a targeted run is allowed (the plan is printed), 2 = a full gate is required (product files changed, a failure is not
addressed by the diff, or a change reaches every test - conftest.py / the Playwright config), 3 = usage / git error.

The plan (what a targeted run must hold, all on the fixed commit):
  * release_check.py (always - seconds);
  * tsc --noEmit when any file under frontend/ changed (specs are type-checked: tsconfig includes tests/);
  * every changed backend test file, every backend test file that imports a changed helper module of tests/, tests/test_gate_hygiene.py;
  * every changed Playwright spec, every spec that imports a changed spec helper (./tickets-mocks etc.), each on the server its header asks
    for (release_gate.classify rules: dev server / fixture / preview), all projects the header allows;
  * the named failures themselves (they must pass).
Nothing here runs anything; it is a pure function of the git diff (unit-tested in smplwise_vms/backend/tests/test_targeted_plan.py)."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND_TESTS = "smplwise_vms/backend/tests/"
FRONTEND_TESTS = "frontend/tests/"
ALWAYS_BACKEND = ["tests/test_gate_hygiene.py"]

# paths that never ship in the add-on and cannot change product behaviour
TEST_PREFIXES = (BACKEND_TESTS, FRONTEND_TESTS)
TOOLING_PREFIXES = ("scripts/gate/",)
DOC_PREFIXES = ("docs/", "management/", "private/")
DOC_SUFFIXES = (".md",)
# test files OUTSIDE the test folders (Playwright configs are test tooling; vite configs are NOT - they build the product)
TEST_FILES = {"frontend/playwright.config.ts", "frontend/playwright.unit.config.ts", "frontend/playwright.public.config.ts",
              "frontend/playwright.guide-live.config.ts"}
# a change here reaches every test of its suite: a targeted run cannot cover it
SUITE_WIDE = {BACKEND_TESTS + "conftest.py": "backend", "frontend/playwright.config.ts": "frontend"}
# product files under docs/ that the add-on serves at run time (none today: the user guide is built into docs/user-guide and served from
# the repository, and release_check.py - which reads docs/release + docs/operations - runs in every targeted run anyway)
PRODUCT_DOCS: tuple[str, ...] = ()


def kind_of(path: str) -> str:
    """'test' | 'tooling' | 'doc' | 'product' for one repo-relative path (forward slashes)."""
    if path in TEST_FILES or path.startswith(TEST_PREFIXES):
        return "test"
    if path.startswith(TOOLING_PREFIXES):
        return "tooling"
    if path.startswith(PRODUCT_DOCS):
        return "product"
    if path.startswith(DOC_PREFIXES) or (path.endswith(DOC_SUFFIXES) and "/" not in path.strip("/")):
        return "doc"
    return "product"


def _module_of(path: str) -> str:
    return Path(path).stem


def backend_importers(helper: str, sources: dict[str, str]) -> list[str]:
    """Backend test files (tests/test_*.py, keyed by their file name) that import the helper module `helper` (a stem)."""
    pat = re.compile(rf"^\s*(from\s+{re.escape(helper)}\s+import|import\s+{re.escape(helper)}\b)", re.M)
    return sorted(n for n, text in sources.items() if n.startswith("test_") and pat.search(text))


def spec_importers(helper: str, sources: dict[str, str]) -> list[str]:
    """Playwright specs (*.spec.ts) that import ./<helper> (a stem, e.g. 'tickets-mocks')."""
    pat = re.compile(rf"""from\s+['"]\./{re.escape(helper)}(\.ts|\.js)?['"]""")
    return sorted(n for n, text in sources.items() if n.endswith(".spec.ts") and pat.search(text))


def _failure_file(fid: str) -> str:
    """The file a named failure lives in: 'tests/test_x.py::test_y[p]' -> 'test_x.py'; 'evidence-x.spec.ts:12' -> 'evidence-x.spec.ts'."""
    head = fid.split("::", 1)[0]
    head = re.sub(r":\d+$", "", head)
    return Path(head).name


def plan(changed: list[str], backend_sources: dict[str, str], spec_sources: dict[str, str], failed: list[str] | None = None) -> dict:
    """The decision and the run list for `changed` (repo-relative paths, the diff base..head). `backend_sources` maps every backend tests/
    file name to its text, `spec_sources` every frontend/tests/ file name to its text (at head)."""
    failed = failed or []
    kinds = {p: kind_of(p) for p in changed}
    product = sorted(p for p, k in kinds.items() if k == "product")
    reasons: list[str] = []
    if product:
        reasons.append(f"{len(product)} product file(s) changed: " + ", ".join(product[:8]) + (" ..." if len(product) > 8 else ""))
    wide = sorted({SUITE_WIDE[p] for p in changed if p in SUITE_WIDE})
    for w in wide:
        reasons.append(f"a {w} suite-wide test file changed ({', '.join(p for p in changed if SUITE_WIDE.get(p) == w)}): the whole {w} suite must run")
    backend, specs = set(), set()
    for p in changed:
        if p.startswith(BACKEND_TESTS) and p.endswith(".py"):
            name = p[len(BACKEND_TESTS):]
            if "/" in name:
                continue  # fixtures/ sub-folder: picked up through the importers of the helper that loads it (or a full run)
            if name.startswith("test_"):
                if name in backend_sources:  # deleted test files are not run
                    backend.add(name)
            elif name != "conftest.py":
                backend.update(backend_importers(_module_of(name), backend_sources))
        elif p.startswith(FRONTEND_TESTS) and p.endswith(".ts"):
            name = p[len(FRONTEND_TESTS):]
            if "/" in name:
                continue
            if name.endswith(".spec.ts"):
                if name in spec_sources:
                    specs.add(name)
            else:
                specs.update(spec_importers(name[:-3], spec_sources))
    touched_files = {Path(p).name for p in changed}
    unaddressed = [f for f in failed if _failure_file(f) not in touched_files]
    if unaddressed:
        reasons.append("failure(s) in files this diff does not touch (not shown stale by the diff): " + ", ".join(unaddressed))
    for f in failed:  # the named failures run too, whatever else is selected
        fn = _failure_file(f)
        if fn.endswith(".py") and fn in backend_sources:
            backend.add(fn)
        elif fn.endswith(".spec.ts") and fn in spec_sources:
            specs.add(fn)
    frontend_changed = any(p.startswith("frontend/") for p in changed)
    return {
        "allowed": not reasons,
        "reasons": reasons,
        "kinds": {k: sorted(p for p, v in kinds.items() if v == k) for k in ("test", "tooling", "doc", "product")},
        "run": {
            "release_check": True,
            "tsc": frontend_changed,
            "backend": sorted({"tests/" + n for n in backend} | {a for a in ALWAYS_BACKEND if a[len("tests/"):] in backend_sources}),
            "playwright": sorted(specs),
            "failed": failed,
        },
    }


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True, encoding="utf-8").stdout


def _sources(ref: str, folder: str, suffixes: tuple[str, ...]) -> dict[str, str]:
    """{file name: text} of the top-level files of `folder` at `ref`, read in ONE `git cat-file --batch` (600+ specs)."""
    blobs = []
    for line in _git("ls-tree", f"{ref}:{folder}").splitlines():
        meta, name = line.split("\t", 1)
        _mode, kind, sha = meta.split()
        if kind == "blob" and name.endswith(suffixes):
            blobs.append((name, sha))
    if not blobs:
        return {}
    raw = subprocess.run(["git", "cat-file", "--batch"], cwd=ROOT, input="\n".join(s for _n, s in blobs).encode() + b"\n",
                         capture_output=True, check=True).stdout
    out, pos = {}, 0
    for name, _sha in blobs:
        nl = raw.index(b"\n", pos)
        size = int(raw[pos:nl].split()[2])
        out[name] = raw[nl + 1:nl + 1 + size].decode("utf-8", errors="replace")
        pos = nl + 1 + size + 1
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--base", required=True, help="the commit the red gate ran on")
    ap.add_argument("--head", default="HEAD", help="the fixed commit (default HEAD)")
    ap.add_argument("--failed", nargs="*", default=[], help="the gate's FAIL ids (pytest node ids, spec file[:line])")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    try:
        changed = [p for p in _git("diff", "--name-only", f"{a.base}..{a.head}").splitlines() if p]
        back = _sources(a.head, BACKEND_TESTS, (".py",))
        specs = _sources(a.head, FRONTEND_TESTS, (".ts",))
    except subprocess.CalledProcessError as e:
        print(f"git failed: {e.stderr or e}", file=sys.stderr)
        return 3
    p = plan(changed, back, specs, a.failed)
    if a.json:
        print(json.dumps(p, indent=2, ensure_ascii=False))
    else:
        print(f"diff {a.base}..{a.head}: " + ", ".join(f"{k} {len(v)}" for k, v in p["kinds"].items()))
        if not p["allowed"]:
            print("FULL GATE REQUIRED:")
            for r in p["reasons"]:
                print("  - " + r)
        else:
            r = p["run"]
            print("TARGETED RUN ALLOWED (test-only diff). It must contain, on the fixed commit:")
            print("  release_check.py" + ("; tsc --noEmit" if r["tsc"] else ""))
            print("  backend (from smplwise_vms/backend): python -m pytest -o addopts= -q -p no:cacheprovider " + " ".join(r["backend"]))
            if r["playwright"]:
                print("  playwright (each on the server its header asks for, all projects it allows): " + " ".join(r["playwright"]))
            if r["failed"]:
                print("  and the named failures must pass: " + " ".join(r["failed"]))
    return 0 if p["allowed"] else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
