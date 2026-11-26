#!/usr/bin/env python3
"""Private-repository migration: READ-ONLY readiness check (PRIVATE-REPO-PREP-2550).

Lists every place that hard-codes the public GitHub repository (jonioliel/smplwise-bms), the app-store `addon` branch
(`#addon`, `origin/addon`, a push to `addon`, the `smplwise-addonbr` worktree) or the add-on store URL, and sorts each hit
into what the cutover has to do with it. Runbook: docs/operations/PRIVATE_REPO_MIGRATION.md.

The script never writes, fetches, pushes or contacts GitHub. It reads:
  * tracked files at --ref (default HEAD) with `git grep` (git objects, not the working tree);
  * optional --extra PATH folders/files that are not in git (for example private/runner on the workstation, or ~/gate2,
    ~/work/slotb.sh, ~/lab1311 and ~/nightly_tests.sh on the runner); for those only the file, line and the matched token
    are printed, never the rest of the line (they may hold lab values);
  * the remote URLs of the repository (and of every --repo CLONE given), which all its worktrees share;
  * with --crontab, the output of `crontab -l` (runner).

Categories:
  CUTOVER   must change when development moves to the private repository (remotes, fresh-clone URLs, the addon-branch
            refresh routine, scripts that push to the public repository)
  REVIEW    documentation to update in the same docs commit after the cutover
  PUBLIC    correct as is: the public store URL that HA users add (repository.yaml, config.yaml url, bridge manifests,
            DOCS); must keep exactly https://github.com/jonioliel/smplwise-bms
  SELF      the migration tooling itself (this check, the publish step, the runbook): counted only
  HISTORY   change receipts, task registry, handoff logs, changelogs: records of the past, never rewritten

Usage:
  python scripts/private_repo_readiness.py                                  # tracked files at HEAD + this clone's remotes
  python scripts/private_repo_readiness.py --ref origin/main --extra private/runner --extra private/planning
  python3 scripts/private_repo_readiness.py --extra ~/gate2 --extra ~/work/slotb.sh --extra ~/lab1311 --crontab  # runner
  python scripts/private_repo_readiness.py --expect-origin https://github.com/jonioliel/smplwise-arx-dev.git  # after cutover
  --json OUT writes every hit; --strict exits 1 while a CUTOVER item is open.

Exit codes: 0 report written; 1 --strict and CUTOVER items remain (or a remote differs from --expect-origin); 2 usage error.
Python 3.9+, standard library only.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_SLUG = "jonioliel/smplwise-bms"

# (label, regex). Order matters only for the label shown; a line is reported once with every label that matched.
PATTERNS: list[tuple[str, str]] = [
    ("public-url", r"github\.com[:/]jonioliel/smplwise-bms"),
    ("repo-slug", r"(?<![\w.-])jonioliel/smplwise-bms(?![\w-])"),
    ("addon-fragment", r"smplwise-bms(\.git)?#addon"),
    ("addon-shorthand", r"(?<![\w/.-])#addon(?![\w-])"),
    ("addon-ref", r"origin/addon(?![\w-])|refs/heads/addon(?![\w-])"),
    ("addon-push", r"git\s+(-C\s+\S+\s+)?push\b[^\n]*\s(HEAD:)?(refs/heads/)?addon(?![\w-])"),
    ("addon-worktree", r"smplwise-addonbr"),
]
# coarse POSIX ERE for `git grep` (no look-arounds there); the Python patterns above decide what is reported
GREP_RE = r"jonioliel/smplwise-bms|#addon|origin/addon|refs/heads/addon|smplwise-addonbr|push.*addon"
COMPILED = [(label, re.compile(p, re.IGNORECASE)) for label, p in PATTERNS]

# Path rules for tracked files, first match wins (POSIX globs against the repository-relative path).
RULES: list[tuple[str, str, str]] = [
    # the tooling of this migration itself
    ("scripts/private_repo_readiness.py", "SELF", "this check (names the public URL on purpose)"),
    ("scripts/publish_public_addon.py", "SELF", "publish step: builds the public tree for the public URL"),
    ("docs/operations/PRIVATE_REPO_MIGRATION.md", "SELF", "the runbook"),
    ("docs/operations/PRIVATE_REPO_PLAN*.md", "HISTORY", "the 2.40.7 plan (superseded by the runbook)"),
    # what Home Assistant users see: must keep the public URL
    ("repository.yaml", "PUBLIC", "store metadata; the public repository root carries it"),
    ("hacs.json", "PUBLIC", "manual HACS bridge path"),
    ("smplwise_vms/config.yaml", "PUBLIC", "add-on url shown in the store"),
    ("smplwise_vms/DOCS*.md", "PUBLIC", "install instructions for users"),
    ("smplwise_vms/README*.md", "PUBLIC", "add-on readme"),
    ("*/manifest.json", "PUBLIC", "bridge documentation / issue_tracker links"),
    ("smplwise_vms/www/*", "PUBLIC", "built UI bundle (rebuilt from frontend/)"),
    ("smplwise_vms/backend/smplwise/*", "REVIEW", "runtime code naming the repository: check it means the public one"),
    ("frontend/src/*", "REVIEW", "UI source naming the repository: check it means the public one"),
    # records of the past
    ("docs/changes/*", "HISTORY", "change receipt"),
    ("management/tasks.json", "HISTORY", "task registry text"),
    ("management/requirements.json", "HISTORY", "requirements registry text"),
    ("management/test_catalog.json", "HISTORY", "test registry text"),
    ("management/tasks/*", "HISTORY", "generated task card"),
    ("management/*.md", "HISTORY", "generated status view"),
    ("PROJECT_BOARD.html", "HISTORY", "generated board"),
    ("*CHANGELOG*.md", "HISTORY", "release notes"),
    ("private/handoff-package/*", "HISTORY", "handoff log"),
    ("private/planning/*", "HISTORY", "planning page"),
    # must change
    ("management/upstream_watch.json", "CUTOVER", "our_repository: which repository the upstream watch reports on"),
    ("management/project.json", "REVIEW", "project metadata: repository link"),
    ("scripts/*", "CUTOVER", "script: decide public (publish) or private (development) repository"),
    ("private/runner/*", "CUTOVER", "runner setup: fresh clone URL must become the private repository"),
    ("docs/operations/SECOND_COMPUTER_SETUP*.md", "CUTOVER", "clone command for a new computer"),
    ("docs/*", "REVIEW", "documentation"),
]
EXTRA_DEFAULT = ("CUTOVER", "untracked file outside git (runner / private): check by hand")
ADDON_ROUTINE = {"addon-push", "addon-worktree"}

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", ".pytest_cache", "dist", "test-results",
             "playwright-report", ".logs"}
MAX_BYTES = 4 * 1024 * 1024


def classify(path: str, labels: set[str]) -> tuple[str, str]:
    for glob, cat, why in RULES:
        if fnmatch.fnmatch(path, glob):
            # an addon refresh routine inside a living script is always a cutover item
            if cat in ("REVIEW",) and labels & ADDON_ROUTINE:
                return "CUTOVER", why + "; contains the addon-branch refresh routine"
            return cat, why
    return ("CUTOVER", "unclassified tracked file: decide") if labels & ADDON_ROUTINE else ("REVIEW", "unclassified")


def labels_of(text: str) -> tuple[set[str], list[str]]:
    found: set[str] = set()
    tokens: list[str] = []
    for label, rx in COMPILED:
        for m in rx.finditer(text):
            found.add(label)
            tokens.append(m.group(0).strip())
    return found, sorted(set(tokens))


def run(args: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=str(cwd) if cwd else None, capture_output=True)


def tracked_hits(ref: str) -> list[dict]:
    r = run(["git", "-C", str(ROOT), "grep", "-I", "-n", "-i", "-E", GREP_RE, ref, "--"])
    if r.returncode not in (0, 1):
        raise SystemExit(f"git grep failed: {r.stderr.decode(errors='replace').strip()}")
    hits = []
    prefix = f"{ref}:"
    for raw in r.stdout.decode("utf-8", errors="replace").splitlines():
        if not raw.startswith(prefix):
            continue
        rest = raw[len(prefix):]
        path, _, rest = rest.partition(":")
        line_no, _, text = rest.partition(":")
        labels, tokens = labels_of(text)
        if not labels:
            continue
        cat, why = classify(path, labels)
        hits.append({"source": "tracked", "path": path, "line": int(line_no or 0), "labels": sorted(labels),
                     "tokens": tokens, "category": cat, "why": why, "text": text.strip()[:160]})
    return hits


def iter_files(base: Path):
    if base.is_file():
        yield base
        return
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for f in filenames:
            yield Path(dirpath) / f


def repo_relative(f: Path) -> str:
    """Repository-relative POSIX path, also for a file of another worktree of the same repository (its private/ folder)."""
    p = f.resolve()
    try:
        return p.relative_to(ROOT).as_posix()
    except ValueError:
        pass
    posix = p.as_posix()
    for marker in ("/private/", "/private-evidence/", "/scripts/", "/docs/"):
        i = posix.find(marker)
        if i >= 0:
            return posix[i + 1:]
    return ""


def extra_hits(paths: list[str]) -> list[dict]:
    hits = []
    for p in paths:
        base = Path(os.path.expanduser(p))
        if not base.exists():
            hits.append({"source": "extra", "path": str(base), "line": 0, "labels": [], "tokens": [],
                         "category": "INFO", "why": "path not found (nothing scanned)", "text": ""})
            continue
        for f in iter_files(base):
            try:
                if f.stat().st_size > MAX_BYTES:
                    continue
                data = f.read_bytes()
            except OSError:
                continue
            if b"\0" in data[:8192]:
                continue
            for i, line in enumerate(data.decode("utf-8", errors="replace").splitlines(), 1):
                labels, tokens = labels_of(line)
                if not labels:
                    continue
                rel = repo_relative(f)
                cat, why = classify(rel, labels) if rel else EXTRA_DEFAULT
                if not rel or why == "unclassified":
                    rel = rel or f.as_posix()
                    cat, why = EXTRA_DEFAULT
                # never print the rest of an untracked line: it may carry lab values
                hits.append({"source": "extra", "path": rel, "line": i, "labels": sorted(labels), "tokens": tokens,
                             "category": cat, "why": why, "text": ""})
    return hits


def crontab_hits() -> list[dict]:
    r = run(["crontab", "-l"]) if os.name != "nt" else None
    if r is None or r.returncode != 0:
        return [{"source": "crontab", "path": "crontab -l", "line": 0, "labels": [], "tokens": [], "category": "INFO",
                 "why": "no crontab readable here", "text": ""}]
    hits = []
    for i, line in enumerate(r.stdout.decode(errors="replace").splitlines(), 1):
        labels, tokens = labels_of(line)
        if labels:
            hits.append({"source": "crontab", "path": "crontab -l", "line": i, "labels": sorted(labels),
                         "tokens": tokens, "category": "CUTOVER", "why": "scheduled job names the public repo / addon",
                         "text": ""})
    return hits


def remote_hits(repos: list[Path], expect: str | None) -> tuple[list[dict], bool]:
    hits, mismatch = [], False
    for repo in repos:
        r = run(["git", "-C", str(repo), "config", "--get-regexp", r"^remote\..*\.(url|pushurl)$"])
        wt = run(["git", "-C", str(repo), "worktree", "list", "--porcelain"])
        n_wt = sum(1 for ln in wt.stdout.decode(errors="replace").splitlines() if ln.startswith("worktree "))
        if r.returncode != 0:
            hits.append({"source": "remote", "path": str(repo), "line": 0, "labels": [], "tokens": [],
                         "category": "INFO", "why": "not a git clone or no remotes", "text": ""})
            continue
        for ln in r.stdout.decode(errors="replace").splitlines():
            key, _, url = ln.partition(" ")
            public = bool(re.search(r"jonioliel/smplwise-bms(\.git)?/?$", url.strip(), re.IGNORECASE))
            if expect is not None:
                ok = url.strip().rstrip("/") == expect.rstrip("/")
                if key == "remote.origin.url" and not ok:
                    mismatch = True
                cat = "OK" if ok else ("CUTOVER" if key.startswith("remote.origin.") else "INFO")
                why = f"expected {expect}" if not ok else "points to the expected repository"
            else:
                cat = "CUTOVER" if public else "INFO"
                why = (f"`{key}` = the public repository; repoint with `git remote set-url` (shared by {n_wt} worktrees)"
                       if public else f"`{key}` (not the public repository)")
            if expect is not None and public and not key.startswith("remote.origin."):
                cat, why = "CUTOVER", (f"`{key}` = the public repository inside a development clone: its v* tags collide "
                                       "with the development tags (gate base, nightly `fetch --all`); use a separate clone")
            hits.append({"source": "remote", "path": str(repo), "line": 0, "labels": ["remote"], "tokens": [key],
                         "category": cat, "why": why, "text": url.strip() if public or expect else ""})
        hits += addon_worktrees(repo, wt.stdout.decode(errors="replace"))
    return hits, mismatch


def addon_worktrees(repo: Path, porcelain: str) -> list[dict]:
    """Worktrees of this clone that hold the app-store tree (branch `addon` or a commit of its orphan history): after the
    remote is repointed, a `git push origin ...addon` from them lands in the PRIVATE repository and the store goes stale."""
    roots = run(["git", "-C", str(repo), "rev-list", "--max-parents=0", "refs/remotes/origin/addon"])
    if roots.returncode != 0 or not roots.stdout.strip():
        return []
    root = roots.stdout.decode().split()[0]
    out, cur = [], {}
    for ln in porcelain.splitlines() + [""]:
        if ln.startswith("worktree "):
            cur = {"path": ln[9:]}
        elif ln.startswith("HEAD "):
            cur["head"] = ln[5:]
        elif ln.startswith("branch "):
            cur["branch"] = ln[7:]
        elif not ln and cur.get("head"):
            # cheap first: a development commit has frontend/ (the store tree never does); only then walk the history
            dev = run(["git", "-C", str(repo), "rev-parse", "-q", "--verify", f"{cur['head']}:frontend"]).returncode == 0
            is_addon = cur.get("branch") == "refs/heads/addon" or (not dev and run(
                ["git", "-C", str(repo), "merge-base", "--is-ancestor", root, cur["head"]]).returncode == 0)
            if is_addon:
                out.append({"source": "worktree", "path": cur["path"], "line": 0, "labels": ["addon-worktree"],
                            "tokens": [cur.get("branch", "detached " + cur["head"][:9])], "category": "CUTOVER",
                            "why": "app-store refresh worktree shares this clone's origin: retire it and refresh the "
                                   "store from a separate clone of the public repository", "text": ""})
            cur = {}
    return out


def release_facts(ref: str) -> list[str]:
    out = []
    cfg = run(["git", "-C", str(ROOT), "show", f"{ref}:smplwise_vms/config.yaml"])
    m = re.search(rb'^version:\s*"?([^"\s]+)"?', cfg.stdout, re.MULTILINE) if cfg.returncode == 0 else None
    version = m.group(1).decode() if m else "?"
    out.append(f"add-on version at {ref}: {version}")
    tag = run(["git", "-C", str(ROOT), "rev-parse", "-q", "--verify", f"refs/tags/v{version}^{{commit}}"])
    head = run(["git", "-C", str(ROOT), "rev-parse", f"{ref}^{{commit}}"])
    if tag.returncode == 0:
        same = tag.stdout.strip() == head.stdout.strip()
        out.append(f"tag v{version}: present{' (= ' + ref + ')' if same else ' (not ' + ref + ')'}")
    else:
        out.append(f"tag v{version}: MISSING locally")
    pub = run(["git", "-C", str(ROOT), "cat-file", "-e", f"{ref}:scripts/publish_public_addon.py"])
    out.append("publish step scripts/publish_public_addon.py: " + ("present" if pub.returncode == 0 else "MISSING at ref"))
    addon = run(["git", "-C", str(ROOT), "rev-parse", "-q", "--verify", "refs/remotes/origin/addon^{commit}"])
    if addon.returncode == 0:
        av = run(["git", "-C", str(ROOT), "show", "refs/remotes/origin/addon:smplwise_vms/config.yaml"])
        am = re.search(rb'^version:\s*"?([^"\s]+)"?', av.stdout, re.MULTILINE)
        out.append(f"origin/addon (fetched copy): {addon.stdout.decode().strip()[:9]}, add-on "
                   f"{am.group(1).decode() if am else '?'}")
    else:
        out.append("origin/addon: not fetched here")
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--ref", default="HEAD", help="tree to scan (default HEAD)")
    ap.add_argument("--extra", action="append", default=[], help="untracked folder/file to scan too (repeatable)")
    ap.add_argument("--repo", action="append", default=[], help="another clone whose remotes to check (repeatable)")
    ap.add_argument("--crontab", action="store_true", help="also scan `crontab -l` (runner)")
    ap.add_argument("--expect-origin", help="after the cutover: the private URL every clone's origin must have")
    ap.add_argument("--show", default="CUTOVER,REVIEW,PUBLIC", help="categories listed line by line (rest: counts)")
    ap.add_argument("--json", help="write every hit to this file")
    ap.add_argument("--strict", action="store_true", help="exit 1 while a CUTOVER item is open")
    a = ap.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):   # Hebrew docs on a Windows console (cp1255) must not crash the report
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    if run(["git", "-C", str(ROOT), "rev-parse", "--verify", "-q", f"{a.ref}^{{commit}}"]).returncode != 0:
        print(f"unknown ref {a.ref}", file=sys.stderr)
        return 2

    hits = tracked_hits(a.ref) + extra_hits(a.extra)
    if a.crontab:
        hits += crontab_hits()
    rhits, mismatch = remote_hits([ROOT] + [Path(os.path.expanduser(r)) for r in a.repo], a.expect_origin)
    hits += rhits

    show = {c.strip().upper() for c in a.show.split(",") if c.strip()}
    order = ["CUTOVER", "REVIEW", "PUBLIC", "SELF", "HISTORY", "OK", "INFO"]
    print(f"private_repo_readiness: ref {a.ref}; extra {a.extra or '-'}; repos {[str(ROOT)] + a.repo}")
    for fact in release_facts(a.ref):
        print(f"  {fact}")
    for cat in order:
        sel = [h for h in hits if h["category"] == cat]
        if not sel:
            continue
        files = sorted({h["path"] for h in sel})
        print(f"\n== {cat}: {len(sel)} line(s) in {len(files)} place(s)")
        if cat not in show and cat not in ("OK", "INFO"):
            for f in files:
                n = sum(1 for h in sel if h["path"] == f)
                print(f"   {n:4d}  {f}")
            continue
        for f in files:
            fh = [h for h in sel if h["path"] == f]
            print(f"  {f}  [{fh[0]['source']}] - {fh[0]['why']}")
            for h in fh[:12]:
                loc = f"L{h['line']}" if h["line"] else "  "
                detail = h["text"] if h["text"] else ", ".join(h["tokens"])
                print(f"      {loc:>6} {','.join(h['labels']) or '-':<28} {detail}")
            if len(fh) > 12:
                print(f"      ... {len(fh) - 12} more")
    n_cut = sum(1 for h in hits if h["category"] == "CUTOVER")
    print(f"\nSUMMARY: CUTOVER {n_cut}, REVIEW {sum(1 for h in hits if h['category'] == 'REVIEW')}, "
          f"PUBLIC {sum(1 for h in hits if h['category'] == 'PUBLIC')}, "
          f"HISTORY {sum(1 for h in hits if h['category'] == 'HISTORY')}"
          + (f"; origin mismatch vs {a.expect_origin}" if mismatch else ""))
    print("This check only reads; it changed nothing.")
    if a.json:
        Path(a.json).write_text(json.dumps(hits, indent=1, ensure_ascii=False), encoding="utf-8")
    if mismatch or (a.strict and n_cut):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
