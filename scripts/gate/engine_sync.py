#!/usr/bin/env python3
"""GATE-HARDEN-2520 (TR-02): install the gate tooling on the runner from one checkout, and detect drift between what is installed
and the repository.

The runner keeps three hand-copied engine copies (`~/release_gate.py`, `~/gate2/release_gate.py`, `~/nightly-gate/release_gate.py`)
plus the gate-2 tooling in `~/gate2/`. Until 2.52 nothing compared them with the tree under test: the 2.48.0 - 2.51.0 release gates
ran an engine without GATE-ONEPROJECT-2480 (c4ff2bdc8) while the nightly ran the fixed one. This script is the one installer and the
drift check that `release_gate2.sh` runs before anything else.

  engine_sync.py check   --repo DIR --ref REF [--home DIR] [--json OUT] [--allow-drift REASON] [--warn-only]
      Compares the sha256 of every installed file in the CHECK map with `git show REF:<repo path>`. The ENGINE (release_gate.py in
      `~` and `~/gate2`, the copies a release gate runs) is STRICT: a difference exits 4 ("refused") unless --allow-drift "<reason>"
      (the reason goes into the record) or --warn-only (the nightly). Every other file is reported loudly and never refuses.
      Exit: 0 in sync (or drift allowed / warn-only), 4 strict drift refused, 2 usage (no such ref, no repo).
  engine_sync.py install --src CHECKOUT [--home DIR] [--files a,b,...] [--suffix .bak_2511] [--apply] [--force-busy]
      Dry run by default: lists what would be copied where. --apply backs up every target that exists and differs
      (`<target><suffix>`, an existing backup is never overwritten), copies the source file (mode kept), and writes
      `~/gate_install_manifest.json` (source commit, sha256 of every installed file, backups). Refuses while a release gate, an entry
      check or the nightly runs (gate_status.json "running", a `release_gate` / `nightly_tests` process) unless --force-busy.
      Default file set = the engine group: release_gate.py (3 places), release_gate2.sh + engine_sync.py (~/gate2), selftest_gate.py (~).
  engine_sync.py hash FILE...      prints "<sha256>  <file>" (what the reports and the manifest carry)

Python 3.8+, standard library only; POSIX for the busy probe (pgrep). The selftest is scripts/gate/selftest_engine_sync.py.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# repo path (under scripts/gate/) -> installed locations relative to the runner home. The engine group is the default install set.
INSTALL_MAP: dict[str, list[str]] = {
    "release_gate.py": ["release_gate.py", "gate2/release_gate.py", "nightly-gate/release_gate.py"],
    "release_gate2.sh": ["gate2/release_gate2.sh"],
    "engine_sync.py": ["gate2/engine_sync.py", "engine_sync.py"],
    "selftest_gate.py": ["selftest_gate.py"],
    "gate_release.sh": ["gate2/gate_release.sh"],
    "gate2_select.py": ["gate2/gate2_select.py"],
    "gate2_verdict.py": ["gate2/gate2_verdict.py"],
    "gate_entry.py": ["gate2/gate_entry.py"],
    "gate_quarantine.py": ["gate2/gate_quarantine.py"],
    "gate_summary.py": ["gate_summary.py", "gate2/gate_summary.py", "nightly-gate/gate_summary.py"],
    "lint_backend.py": ["gate2/lint_backend.py"],
    "lint_spec_waits.py": ["lint_spec_waits.py", "gate2/lint_spec_waits.py"],
    "gate_holder.py": ["gate_holder.py", "gate2/gate_holder.py"],
    "select_tests.py": ["select_tests.py", "gate2/select_tests_v1.py", "nightly-gate/select_tests.py"],
    "gate2/select_tests.py": ["gate2/select_tests.py"],
    "nightly_tests.sh": ["nightly_tests.sh"],
}
ENGINE_GROUP = ["release_gate.py", "release_gate2.sh", "engine_sync.py", "selftest_gate.py"]

# what a release gate checks: (repo path, installed path, strict). STRICT = the engine a release gate runs.
CHECK_RELEASE: list[tuple[str, str, bool]] = [
    ("release_gate.py", "release_gate.py", True),
    ("release_gate.py", "gate2/release_gate.py", True),
    ("release_gate2.sh", "gate2/release_gate2.sh", False),
    ("gate_release.sh", "gate2/gate_release.sh", False),
    ("gate2_select.py", "gate2/gate2_select.py", False),
    ("gate2_verdict.py", "gate2/gate2_verdict.py", False),
    ("gate_entry.py", "gate2/gate_entry.py", False),
    ("gate_quarantine.py", "gate2/gate_quarantine.py", False),
    ("gate_summary.py", "gate2/gate_summary.py", False),
    ("gate_budget.py", "gate2/gate_budget.py", False),
    ("lint_backend.py", "gate2/lint_backend.py", False),
    ("gate2/select_tests.py", "gate2/select_tests.py", False),
    ("select_tests.py", "select_tests.py", False),
]
# what the nightly checks (warn only: main may be older than an engine installed ahead of its release)
CHECK_NIGHTLY: list[tuple[str, str, bool]] = [
    ("release_gate.py", "nightly-gate/release_gate.py", True),
    ("gate_summary.py", "nightly-gate/gate_summary.py", False),
    ("select_tests.py", "nightly-gate/select_tests.py", False),
]
CHECK_SETS = {"release": CHECK_RELEASE, "nightly": CHECK_NIGHTLY}


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(p: Path) -> str | None:
    try:
        return sha256_bytes(p.read_bytes())
    except OSError:
        return None


def git_blob(repo: Path, ref: str, rel: str) -> bytes | None:
    r = subprocess.run(["git", "-C", str(repo), "show", f"{ref}:scripts/gate/{rel}"], capture_output=True, check=False)
    return r.stdout if r.returncode == 0 else None


def git_rev(repo: Path, ref: str) -> str | None:
    r = subprocess.run(["git", "-C", str(repo), "rev-parse", "--verify", "-q", f"{ref}^{{commit}}"], capture_output=True, text=True, check=False)
    return r.stdout.strip() if r.returncode == 0 else None


def compare(repo: Path, ref: str, home: Path, rows: list[tuple[str, str, bool]]) -> list[dict]:
    out = []
    for rel, inst, strict in rows:
        blob = git_blob(repo, ref, rel)
        want = sha256_bytes(blob) if blob is not None else None
        have = sha256_file(home / inst)
        if want is None and have is None:
            state = "absent"            # neither side has it (an older tree / an optional file)
        elif want is None:
            state = "not-in-tree"       # installed, but the tree under test has no such file (an older branch)
        elif have is None:
            state = "missing"           # the tree has it, the runner does not
        else:
            state = "same" if want == have else "DIFFERENT"
        out.append({"repo": f"scripts/gate/{rel}", "installed": f"~/{inst}", "strict": strict, "state": state,
                    "installed_sha256": have, "tree_sha256": want})
    return out


def cmd_check(a: argparse.Namespace) -> int:
    repo, home = Path(a.repo).expanduser(), Path(a.home).expanduser()
    rev = git_rev(repo, a.ref)
    if not rev:
        print(f"engine_sync: {a.ref} not found in {repo}", file=sys.stderr)
        return 2
    rows = compare(repo, a.ref, home, CHECK_SETS[a.set])
    bad_strict = [r for r in rows if r["strict"] and r["state"] in ("DIFFERENT", "missing", "not-in-tree")]
    bad_other = [r for r in rows if not r["strict"] and r["state"] in ("DIFFERENT", "missing")]
    refused = bool(bad_strict) and not a.allow_drift and not a.warn_only
    rec = {"checked_at": _dt.datetime.now(_dt.UTC).isoformat(timespec="seconds"), "set": a.set, "ref": a.ref, "commit": rev,
           "home": str(home), "rows": rows, "strict_drift": len(bad_strict), "other_drift": len(bad_other),
           "allowed": a.allow_drift or "", "warn_only": bool(a.warn_only), "refused": refused}
    if a.json:
        try:
            Path(a.json).write_text(json.dumps(rec, indent=1), encoding="utf-8")
        except OSError as e:
            print(f"engine_sync: could not write {a.json}: {e}", file=sys.stderr)
    eng = next((r for r in rows if r["strict"]), None)
    if eng:
        print(f"engine_sync: engine ~/{eng['installed'][2:]} sha256 {str(eng['installed_sha256'])[:16]}  tree {rev[:9]} "
              f"{eng['repo']} sha256 {str(eng['tree_sha256'])[:16]}")
    if not bad_strict and not bad_other:
        print(f"engine_sync: installed gate tooling matches {a.ref} ({rev[:9]})")
        return 0
    bar = "!" * 100
    if bad_strict:
        print(bar)
        print(f"engine_sync: ENGINE DRIFT - the installed engine is NOT the engine of the tree under test ({a.ref} @ {rev[:9]}):")
        for r in bad_strict:
            print(f"  {r['state']:<11} {r['installed']}  vs  {r['repo']}")
        if refused:
            print("  REFUSED. Install the tree's engine (scripts/gate/engine_sync.py install --src <checkout> --apply, idle runner),")
            print("  or run with --engine-drift-ok \"<reason>\" for a deliberate pin (the reason is written into the record).")
        elif a.allow_drift:
            print(f"  ALLOWED by --engine-drift-ok: {a.allow_drift}")
        else:
            print("  warn-only run: continuing")
        print(bar)
    for r in bad_other:
        print(f"engine_sync: WARNING drift {r['state']:<9} {r['installed']}  vs  {r['repo']} @ {rev[:9]}")
    return 4 if refused else 0


def busy(home: Path) -> str:
    """Why the runner is not quiet ('' = quiet): a gate / entry check / nightly status says running, or such a process exists."""
    for st in (home / "smplwise-results" / "gate_status.json", home / "smplwise-results" / "nightly" / "gate_status.json",
               home / "smplwise-results" / "entry_status.json"):
        try:
            if json.loads(st.read_text(encoding="utf-8")).get("state") == "running":
                return f"{st} says running"
        except (OSError, ValueError, AttributeError):
            pass
    for pat in ("[r]elease_gate", "[n]ightly_tests", "[b]ranch_check.sh"):
        try:
            r = subprocess.run(["pgrep", "-af", pat], capture_output=True, text=True, check=False)
        except FileNotFoundError:   # no pgrep (not the runner): the status files above are the only probe
            continue
        # our own command line (and the shell that started it) may name release_gate.py in --files: never count those
        pids = [ln.split()[0] for ln in r.stdout.splitlines() if ln.strip() and "engine_sync" not in ln and ln.split()[0] != str(os.getpid())]
        if pids:
            return f"a process matching {pat!r} runs (pid {', '.join(pids[:5])})"
    return ""


def cmd_install(a: argparse.Namespace) -> int:
    src, home = Path(a.src).expanduser(), Path(a.home).expanduser()
    gate_dir = src / "scripts" / "gate"
    files = [f.strip() for f in (a.files.split(",") if a.files else ENGINE_GROUP) if f.strip()]
    unknown = [f for f in files if f not in INSTALL_MAP]
    if unknown:
        print(f"engine_sync: not in the install map: {', '.join(unknown)}", file=sys.stderr)
        return 2
    rev = git_rev(src, "HEAD") or "unknown"
    dirty = subprocess.run(["git", "-C", str(src), "status", "--porcelain", "--", "scripts/gate"], capture_output=True, text=True, check=False).stdout.strip()
    plan = []
    for f in files:
        s = gate_dir / f
        if not s.is_file():
            print(f"engine_sync: the source has no {s}", file=sys.stderr)
            return 2
        sh = sha256_file(s)
        for t in INSTALL_MAP[f]:
            tp = home / t
            if not tp.parent.is_dir():
                plan.append({"file": f, "target": str(tp), "action": "skip (no such directory)", "sha256": sh})
                continue
            th = sha256_file(tp)
            plan.append({"file": f, "target": str(tp), "action": "same" if th == sh else ("new" if th is None else "replace"),
                         "sha256": sh, "old_sha256": th})
    for p in plan:
        print(f"  {p['action']:<26} {p['target']}  <- scripts/gate/{p['file']}  {p['sha256'][:16]}")
    if dirty:
        print(f"engine_sync: WARNING the source checkout has uncommitted changes under scripts/gate:\n{dirty}")
    if not a.apply:
        print("engine_sync: dry run (nothing copied); add --apply")
        return 0
    why = busy(home)
    if why and not a.force_busy:
        print(f"engine_sync: REFUSED - the runner is busy: {why}. Wait for a quiet window.", file=sys.stderr)
        return 3
    backups, installed = [], []
    for p in plan:
        if p["action"] not in ("new", "replace"):
            if p["action"] == "same":
                installed.append({"target": p["target"], "sha256": p["sha256"], "changed": False})
            continue
        tp, s = Path(p["target"]), gate_dir / p["file"]
        if p["action"] == "replace":
            bak = Path(str(tp) + a.suffix)
            if not bak.exists():
                shutil.copy2(tp, bak)
                backups.append({"target": str(tp), "backup": str(bak), "sha256": p["old_sha256"]})
            else:
                backups.append({"target": str(tp), "backup": str(bak), "sha256": sha256_file(bak), "note": "backup existed, kept"})
        tmp = Path(str(tp) + ".engine_sync.tmp")
        shutil.copy2(s, tmp)
        os.replace(tmp, tp)       # atomic: a process that opens the file sees the old or the new one, never half of it
        got = sha256_file(tp)
        if got != p["sha256"]:
            print(f"engine_sync: VERIFY FAILED {tp}: {got} != {p['sha256']}", file=sys.stderr)
            return 1
        installed.append({"target": str(tp), "sha256": got, "changed": True})
    man = {"installed_at": _dt.datetime.now(_dt.UTC).isoformat(timespec="seconds"), "source": str(src), "source_commit": rev,
           "source_dirty": bool(dirty), "files": installed, "backups": backups}
    mp = home / "gate_install_manifest.json"
    try:
        old = json.loads(mp.read_text(encoding="utf-8")) if mp.exists() else {}
    except (OSError, ValueError):
        old = {}
    hist = (old.get("history") or [])[-19:] + ([{k: old[k] for k in ("installed_at", "source_commit") if k in old}] if old.get("installed_at") else [])
    man["history"] = hist
    mp.write_text(json.dumps(man, indent=1), encoding="utf-8")
    print(f"engine_sync: installed {sum(1 for i in installed if i['changed'])} file(s) from {rev[:9]}; {len(backups)} backup(s); manifest {mp}")
    return 0


def cmd_hash(a: argparse.Namespace) -> int:
    rc = 0
    for f in a.files:
        h = sha256_file(Path(f))
        print(f"{h or 'MISSING':<64}  {f}")
        rc |= h is None
    return rc


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("--repo", default=str(Path.home() / "smplwisebms"))
    c.add_argument("--ref", required=True)
    c.add_argument("--home", default=str(Path.home()))
    c.add_argument("--set", choices=sorted(CHECK_SETS), default="release")
    c.add_argument("--json")
    c.add_argument("--allow-drift", default="")
    c.add_argument("--warn-only", action="store_true")
    i = sub.add_parser("install")
    i.add_argument("--src", required=True)
    i.add_argument("--home", default=str(Path.home()))
    i.add_argument("--files", default="")
    i.add_argument("--suffix", default=".bak_" + _dt.date.today().strftime("%d%m"))
    i.add_argument("--apply", action="store_true")
    i.add_argument("--force-busy", action="store_true")
    h = sub.add_parser("hash")
    h.add_argument("files", nargs="+")
    a = ap.parse_args(argv)
    return {"check": cmd_check, "install": cmd_install, "hash": cmd_hash}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
