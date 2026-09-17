#!/usr/bin/env python3
"""Release consistency check for the SMPLWISE VMS add-on (T072).

Verifies what a release must get right before the owner signs it: one version everywhere (config.yaml, Dockerfile
label, backend __version__, CHANGELOG head, API inventory), the bridge integration's two copies identical and
their version consistent (manifest + const), a contiguous migration sequence, the built UI present in the add-on,
the release package document and the known-limits sources present, and whether a git tag already exists for the
version. Prints a checklist; exits 1 when a check fails. With --tag it prints the tag commands to run after the
owner's approval (it never creates the tag itself).

Usage: python scripts/release_check.py [--root .] [--json out.json] [--tag]
"""
from __future__ import annotations

import argparse
import filecmp
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def find(pattern: str, text: str) -> str | None:
    m = re.search(pattern, text, re.M)
    return m.group(1) if m else None


def dir_identical(a: Path, b: Path) -> tuple[bool, list[str]]:
    diffs: list[str] = []

    def walk(x: Path, y: Path, rel: str) -> None:
        cmp = filecmp.dircmp(x, y, ignore=["__pycache__"])
        for name in cmp.left_only + cmp.right_only:
            diffs.append(f"{rel}{name} (only on one side)")
        for name in cmp.diff_files:
            diffs.append(f"{rel}{name} (differs)")
        for name, sub in cmp.subdirs.items():
            walk(Path(sub.left), Path(sub.right), f"{rel}{name}/")

    if not a.is_dir() or not b.is_dir():
        return False, ["missing copy"]
    walk(a, b, "")
    return not diffs, diffs


def git_tags(root: Path) -> list[str]:
    try:
        out = subprocess.run(["git", "tag", "--list"], cwd=root, capture_output=True, text=True, timeout=20)
        return [t.strip() for t in out.stdout.splitlines() if t.strip()]
    except (OSError, subprocess.SubprocessError):
        return []


def run_checks(root: Path) -> dict[str, Any]:
    addon = root / "smplwise_vms"
    checks: list[dict[str, Any]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "ok": bool(ok), "detail": detail})

    cfg_v = find(r'^version:\s*"([^"]+)"', read(addon / "config.yaml"))
    docker_v = find(r'io\.hass\.version="([^"]+)"', read(addon / "Dockerfile"))
    py_v = find(r'^__version__\s*=\s*"([^"]+)"', read(addon / "backend" / "smplwise" / "__init__.py"))
    ch_v = find(r"^## (\d+\.\d+\.\d+)", read(addon / "CHANGELOG.md"))
    inv_v = find(r"^Version (\d+\.\d+\.\d+)", read(root / "contracts" / "API_INVENTORY.md"))
    versions = {"config.yaml": cfg_v, "Dockerfile": docker_v, "__init__.py": py_v, "CHANGELOG head": ch_v, "API inventory": inv_v}
    same = cfg_v is not None and all(v == cfg_v for v in versions.values())
    check("one version everywhere", same, ", ".join(f"{k}={v}" for k, v in versions.items()))

    b1 = root / "custom_components" / "smplwise_bridge"
    b2 = addon / "integration" / "smplwise_bridge"
    ident, diffs = dir_identical(b1, b2)
    check("bridge integration copies identical", ident, "identical" if ident else "; ".join(diffs[:6]))
    man_v = None
    try:
        man_v = json.loads(read(b1 / "manifest.json")).get("version")
    except ValueError:
        pass
    const_v = find(r'^VERSION\s*=\s*"([^"]+)"', read(b1 / "const.py"))
    check("bridge version consistent (manifest = const)", bool(man_v) and man_v == const_v, f"manifest={man_v}, const={const_v}")

    mig = sorted(p.name for p in (addon / "backend" / "smplwise" / "migrations").glob("*.sql"))
    nums = [int(n[:4]) for n in mig if n[:4].isdigit()]
    contiguous = nums == list(range(1, len(nums) + 1)) and bool(nums)
    check("migrations contiguous", contiguous, f"{len(mig)} files, last {mig[-1] if mig else '—'}")

    www = addon / "www"
    built = (www / "index.html").exists() and any((www / "assets").glob("index-*.js")) if (www / "assets").exists() else False
    check("built UI present in the add-on (www)", built, str(www))

    pkg = root / "docs" / "release" / "RELEASE_PACKAGE_V1.md"
    check("release package document present", pkg.exists(), str(pkg))
    limits = [root / "docs" / "operations" / "RESOURCE_BUDGET.md", root / "docs" / "operations" / "LIVE_REVIEW_2026-09-17_HE.md", addon / "DOCS.md"]
    check("known-limits sources present", all(p.exists() for p in limits), ", ".join(p.name for p in limits))

    tags = git_tags(root)
    tag = f"v{cfg_v}" if cfg_v else None
    check("git tag for this version", tag in tags if tag else False, f"{tag} {'exists' if tag in tags else 'not yet (created after the owner approves)'}")
    tests = root / "smplwise_vms" / "backend" / "tests"
    check("backend tests present", tests.is_dir() and len(list(tests.glob("test_*.py"))) > 30, f"{len(list(tests.glob('test_*.py')))} test files")

    required_ok = all(c["ok"] for c in checks if c["name"] != "git tag for this version")
    return {"version": cfg_v, "checks": checks, "ok": required_ok, "tag": tag, "tag_exists": tag in tags if tag else False}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument("--json", help="write the checklist as JSON here")
    ap.add_argument("--tag", action="store_true", help="print the tag commands to run after approval")
    args = ap.parse_args(argv)
    root = Path(args.root)
    res = run_checks(root)
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except AttributeError:
        pass
    print(f"Release check — SMPLWISE VMS {res['version']}")
    for c in res["checks"]:
        print(f"  [{'ok' if c['ok'] else 'FAIL'}] {c['name']}: {c['detail']}")
    print("RESULT:", "ready for the owner's approval" if res["ok"] else "NOT ready")
    if args.tag and res["tag"]:
        print(f"\nAfter approval:\n  git tag -a {res['tag']} -m \"SMPLWISE VMS {res['version']} — approved release\"\n  git push origin {res['tag']}")
    if args.json:
        Path(args.json).write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
