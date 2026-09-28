#!/usr/bin/env python3
"""Report drift between English operational docs and their Hebrew mirrors (T091 / R182).

Two checks, both informational (this script never fails the build — see main()):

1. Every existing Hebrew mirror (docs/**/*_HE.md, or anything under docs/he/**) is expected to carry a header
   line "Source: <path> @ <commit>" naming the English file it mirrors and the commit it was translated from.
   For every mirror that has such a header, this script reports whether the source has changed since that
   commit (`git log <commit>..HEAD -- <source>`), so drift shows up instead of silently going stale. A mirror
   without the header is reported separately ("no header") rather than silently skipped - most of today's
   *_HE.md files predate this convention (T091 introduces it going forward); they are not drift errors, just
   not yet checkable.

2. SOURCE_GLOBS below (a plain, editable list - the "configurable list" R182 asks for) names the English docs
   that are expected to eventually have a Hebrew mirror. For each one, this script looks for either sibling
   convention: "<name>_HE.md" next to the source, or a mirrored path under docs/he/<same relative path>. A
   source with neither is reported as "no mirror yet".

Both docs/legacy/ and docs/archive/ are excluded in both directions (AGENTS.md / the T091 card: "Archive and
legacy audits stay English").

Usage: python scripts/docs_he_check.py [--root PATH]
Exit code is always 0 (see the docstring on main()) - this is a visibility tool, not a gate.

TODO(T091): scripts/project_status.py has no plug-in point for an extra summary line - `generate()` builds
STATUS.md/TRACEABILITY.md/the task cards/PROJECT_BOARD.html as one hand-written sequence of writes, and
`main()` prints one fixed PASS/ERROR message with no hook for other scripts to contribute a line. Wiring this
script's summary into that output would mean editing project_status.py's control flow, which is out of scope
for a docs/scripts-only task. Once project_status.py grows a real extension point (e.g. a list of
`(label, callable) -> str` summary contributors), add one line here: `status.append('- Hebrew docs: ' +
summarize(root))`.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Part 2's configurable list: English docs expected to eventually carry a Hebrew mirror. Glob patterns are
# relative to the repo root. Edit this list as new operational docs are added.
SOURCE_GLOBS = [
    "smplwise_vms/README.md",
    "smplwise_vms/DOCS.md",
    "docs/operations/*.md",
    "docs/release/*.md",
    "docs/security/*.md",
    "docs/changes/CR-*.md",
]

EXCLUDE_DIR_PARTS = ("legacy", "archive")
HEADER_RE = re.compile(r"^Source:\s*(\S+)\s*@\s*([0-9a-fA-F]{7,40})\s*$", re.MULTILINE)


def _excluded(path: Path) -> bool:
    parts = path.parts
    return any(p in EXCLUDE_DIR_PARTS for p in parts)


def _git(root: Path, *args: str) -> str | None:
    try:
        r = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, check=False)
    except OSError:
        return None
    if r.returncode != 0:
        return None
    return r.stdout.strip()


@dataclass
class MirrorReport:
    mirror: str
    source: str | None = None
    commit: str | None = None
    status: str = ""  # 'ok' | 'drift' | 'no-header' | 'unknown-commit' | 'source-missing'
    detail: str = ""


@dataclass
class MissingMirror:
    source: str


def find_mirrors(root: Path) -> list[Path]:
    found: set[Path] = set()
    for p in root.glob("docs/**/*_HE.md"):
        if not _excluded(p.relative_to(root)):
            found.add(p)
    he_dir = root / "docs" / "he"
    if he_dir.is_dir():
        for p in he_dir.rglob("*.md"):
            if not _excluded(p.relative_to(root)):
                found.add(p)
    return sorted(found)


def check_mirror(root: Path, mirror: Path) -> MirrorReport:
    rel = mirror.relative_to(root).as_posix()
    try:
        text = mirror.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return MirrorReport(mirror=rel, status="unknown-commit", detail=f"could not read: {e}")
    head_lines = "\n".join(text.splitlines()[:12])
    m = HEADER_RE.search(head_lines)
    if not m:
        return MirrorReport(mirror=rel, status="no-header", detail="no 'Source: <path> @ <commit>' header in the first 12 lines")
    source, commit = m.group(1), m.group(2)
    source_path = root / source
    if not source_path.is_file():
        return MirrorReport(mirror=rel, source=source, commit=commit, status="source-missing", detail="named source file does not exist")
    resolved = _git(root, "rev-parse", "--verify", "--quiet", commit)
    if resolved is None:
        return MirrorReport(mirror=rel, source=source, commit=commit, status="unknown-commit", detail="header commit is not a known object in this repo (rewritten history?)")
    latest = _git(root, "log", "-1", "--format=%H", "--", source)
    if latest is None:
        return MirrorReport(mirror=rel, source=source, commit=commit, status="unknown-commit", detail="git log failed for the source path")
    if latest == resolved:
        return MirrorReport(mirror=rel, source=source, commit=commit, status="ok", detail="mirror matches the source's latest commit")
    count = _git(root, "rev-list", "--count", f"{resolved}..HEAD", "--", source)
    n = count if count and count.isdigit() else "?"
    return MirrorReport(mirror=rel, source=source, commit=commit, status="drift", detail=f"source changed {n} commit(s) since {commit[:12]}")


def find_missing_mirrors(root: Path) -> list[MissingMirror]:
    missing: list[MissingMirror] = []
    seen: set[Path] = set()
    for pattern in SOURCE_GLOBS:
        for p in root.glob(pattern):
            if p in seen or not p.is_file():
                continue
            seen.add(p)
            rel = p.relative_to(root)
            if _excluded(rel) or p.name.endswith("_HE.md"):
                continue
            sibling = p.with_name(p.stem + "_HE" + p.suffix)
            mirrored = root / "docs" / "he" / rel
            if sibling.is_file() or mirrored.is_file():
                continue
            missing.append(MissingMirror(source=rel.as_posix()))
    return missing


def print_table(rows: list[list[str]], headers: list[str]) -> None:
    widths = [max(len(h), *(len(r[i]) for r in rows)) if rows else len(h) for i, h in enumerate(headers)]
    def fmt(cols: list[str]) -> str:
        return " | ".join(c.ljust(widths[i]) for i, c in enumerate(cols))
    print(fmt(headers))
    print("-+-".join("-" * w for w in widths))
    for r in rows:
        print(fmt(r))


def main() -> int:
    """Always returns 0: this is a visibility report (like a linter's --no-error mode), not a release gate.
    A future caller that wants a hard gate on drift can check the printed DRIFT/no-header counts itself."""
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows console codepages mangle the em dash otherwise
    except (AttributeError, OSError):
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", type=Path, default=ROOT)
    args = ap.parse_args()
    root = args.root.resolve()

    mirrors = find_mirrors(root)
    reports = [check_mirror(root, m) for m in mirrors]
    print(f"## Hebrew mirrors ({len(reports)} found under docs/**/*_HE.md and docs/he/**)\n")
    if reports:
        print_table(
            [[r.mirror, r.source or "—", (r.commit or "—")[:12], r.status, r.detail] for r in reports],
            ["mirror", "source", "commit", "status", "detail"],
        )
    else:
        print("(none found)")
    drift = [r for r in reports if r.status == "drift"]
    no_header = [r for r in reports if r.status == "no-header"]

    missing = find_missing_mirrors(root)
    print(f"\n## English docs with no Hebrew mirror yet ({len(missing)} of {sum(len(list(root.glob(g))) for g in SOURCE_GLOBS)} tracked source globs)\n")
    if missing:
        print_table([[m.source] for m in missing], ["source"])
    else:
        print("(none — every tracked source has a mirror)")

    print(f"\nSummary: {len(drift)} mirror(s) drifted, {len(no_header)} mirror(s) without a header, {len(missing)} source(s) with no mirror yet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
