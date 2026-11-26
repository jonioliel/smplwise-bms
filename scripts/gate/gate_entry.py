#!/usr/bin/env python3
"""The single release-gate entry point's decision logic (GATE-FAST-2291, item 2). Runs no test.

gate_release.sh <branch> is the ONE command for a release gate. It asks this module two things:

  1. is the fast (change-based) gate ENABLED?   Default OFF. Owner answer 2A: it is switched on by the lead only after the Friday
     30.10 full run ended green or with explained failures: `touch ~/.gate_fast_enabled` (or GATE_FAST_FLAG=<file>). Without the flag
     the entry runs the FULL tier (the v2 schedule), exactly as before.
  2. when it is enabled, what does the newest full nightly on main allow?  THE RULE (printed by `rule`):

       nightly GREEN (verdict pass, <= 36 h old, backend ran)                       -> SELECT: change-based gate
       nightly RED, every failing test is quarantined (ticket + owner + reason + expiry <= 7 d, gate2_quarantine.json)
                                                                                    -> SELECT, the explained failures are listed
       nightly RED with any failure that is not quarantined, or an engine-level failure -> FULL tier, the failing tests are named
       nightly STALE (> 36 h) or MISSING                                           -> FULL tier
       --full on the command line                                                   -> FULL tier
     Selection never skips the always-run core (docs/release/GATE_V2.md); the nightly stays the safety net for everything else.

CLI (all print JSON, except rule):
  gate_entry.py enabled [--flag FILE]                 rc 0 enabled / 1 not
  gate_entry.py decide  --results DIR [--quarantine FILE] [--max-age-h 36] [--now ISO] [--lint [--root CHECKOUT]]
  gate_entry.py tagcheck --results DIR [--days 7]     rc 0 when a FULL green nightly on main is <= N days old (plan rule 3A for tagging)
  gate_entry.py rule
  gate_entry.py lint [--root CHECKOUT] [--json OUT]    the backend static check (lint_backend.py); rc 1 when it blocks, else 0
  gate_entry.py anchor --results DIR --repo DIR --head REF --branch B --after REPORT [--max-commits 20] [--max-hours 36]
                       [--max-product-files 40] [--accept REASON] [--json OUT] [--now ISO]
                                                       rc 0 when a targeted --after run has a coverage anchor (TR-09), 1 when not

Backend lint lane (CR-BE-GATES-2436; BLOCKING since CR-PYFLAKES-ENFORCE-2442): the backend static check (ruff, the pyflakes rule set F
over the package smplwise/). A finding in a tree that carries the `# ruff-lane: blocking` marker (smplwise_vms/backend/pyproject.toml)
blocks; a tree without the marker is only reported; a missing ruff or a missing lint_backend.py next to this file prints NOT_RUN and
never blocks. GATE_BACKEND_LINT=0 switches the lane off, =warn keeps the report and never blocks.
GATE-TRUST-2540 (TR-05): the release gate runs the lane as `gate_entry.py lint --root <its own worktree>` in release_gate2.sh, right
after it checked out the branch under test (an --after run too, which skipped the lane before). `decide` no longer lints by default:
it runs before any worktree exists, so it linted whatever ~/smplwisebms had checked out. `decide --lint` keeps the old behaviour for a
manual call (summary on STDERR, exit LINT_BLOCK_RC = 3 when it blocks); the tree is --root / GATE_LINT_ROOT, else the checkout this
script sits in, else ~/smplwisebms, and every summary names the tree it linted.

Coverage anchor of a targeted re-run (GATE-TRUST-2540, TR-09): `release_gate2.sh --after <red report>` runs only the failed tests' files,
what the diff since that report touches, and the core. The rest of the suite is covered only by an earlier FULL run. `anchor` looks
for one behind the head: a FULL tier-L report (gate_*.json in --results, or a nightly in --results/nightly) whose sha is an ancestor of
the head, at most --max-commits commits and --max-hours hours behind it, with at most --max-product-files product source files
(frontend/src, smplwise_vms/backend/smplwise, custom_components) changed since. It qualifies when it is
  * a nightly judged green (or red only through quarantined tests), or
  * a release-gate FULL run that completed (the backend ran, no engine-level failure, no count-drop failure) and is either green or
    a run of the SAME branch (its failures are what the --after chain re-runs).
The --after report's own sha must be an ancestor of the head as well. No anchor -> rc 1, and release_gate2.sh runs the FULL tier
instead, with the reason printed and stored in gate_<b>_<sha>.anchor.json (gate2_verdict.py puts it into the gate-2 summary).
--accept "<reason>" (release_gate2.sh --accept-no-anchor) keeps the targeted run, with the reason on record.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gate2_verdict as g2v          # noqa: E402  (quarantine loader + matcher, one implementation)
import gate_budget as gb             # noqa: E402  (mode_of)

TEST_CATS = g2v.TEST_CATS
DEFAULT_FLAG = os.environ.get("GATE_FAST_FLAG") or str(Path.home() / ".gate_fast_enabled")
RULE_TEXT = __doc__.split("THE RULE (printed by `rule`):")[1].split("Selection never skips")[0].rstrip()


def parse_ts(s: str | None) -> dt.datetime | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            d = dt.datetime.strptime(s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)
        except ValueError:
            continue
    return None


def fast_enabled(flag: str | None = None) -> bool:
    return Path(flag or DEFAULT_FLAG).exists()


def nightly_reports(results: Path) -> list[tuple[dt.datetime, dict, str]]:
    """[(finished, doc, filename)] of nightly/gate_main_*.json, newest first. 'finished' falls back to the file mtime."""
    nd = Path(results) / "nightly"
    out = []
    for p in nd.glob("gate_main_*.json") if nd.is_dir() else []:
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(d, dict):
            continue
        fin = parse_ts(d.get("finished")) or dt.datetime.fromtimestamp(p.stat().st_mtime, dt.timezone.utc)
        out.append((fin, d, p.name))
    return sorted(out, key=lambda t: t[0], reverse=True)


def judge_nightly(doc: dict, finished: dt.datetime, now: dt.datetime, entries: list[dict], max_age_h: float = 36.0) -> dict:
    """{"state": green|explained|red|stale|broken, "ok": bool, "failing": [...], "explained": [...], "why": str}. ok = selection allowed."""
    age = (now - finished).total_seconds() / 3600
    c = doc.get("counts", {})
    ran_be = (c.get("backend") or {}).get("pass", 0)
    items = doc.get("items", [])
    hard = [i for i in items if i.get("category") == "gate" and i.get("status") == "FAIL"]
    fails = [i for i in items if i.get("status") == "FAIL" and i.get("category") in TEST_CATS]
    q = [(i, g2v.quarantined(i, entries)) for i in fails]
    real = [i for i, e in q if not e]
    expl = [i for i, e in q if e]
    base = {"age_h": round(age, 1), "sha": doc.get("sha"), "verdict": doc.get("verdict")}
    if age > max_age_h:
        return {**base, "state": "stale", "ok": False, "failing": [], "explained": [], "why": f"newest nightly is {age:.0f} h old (limit {max_age_h:.0f} h)"}
    if ran_be <= 0 or hard:
        return {**base, "state": "broken", "ok": False, "failing": [i["id"][:150] for i in hard], "explained": [],
                "why": "the nightly did not run the backend or has engine-level failures"}
    if doc.get("verdict") == "pass" and not real:
        return {**base, "state": "green", "ok": True, "failing": [], "explained": [i["id"][:150] for i in expl], "why": "nightly green"}
    if not real and (expl or doc.get("verdict") == "pass"):
        return {**base, "state": "explained", "ok": True, "failing": [], "explained": [i["id"][:150] for i in expl],
                "why": f"nightly red only through {len(expl)} quarantined test(s) (ticket + expiry)"}
    return {**base, "state": "red", "ok": False, "failing": [i["id"][:150] for i in real][:20], "explained": [i["id"][:150] for i in expl],
            "why": f"nightly red: {len(real)} failure(s) that are not quarantined" if real else "nightly red with no failing item listed"}


def decide(results: Path, quarantine: Path | None = None, now: dt.datetime | None = None, max_age_h: float = 36.0,
           flag: str | None = None, full_requested: bool = False) -> dict:
    now = now or dt.datetime.now(dt.timezone.utc)
    if full_requested:
        return {"mode": "full", "state": "requested", "why": "--full requested"}
    if not fast_enabled(flag):
        return {"mode": "full", "state": "fast-gate-off",
                "why": "the fast gate is not enabled (no flag file): owner answer 2A, enabled by the lead after the Friday 30.10 full run"}
    reps = nightly_reports(results)
    if not reps:
        return {"mode": "full", "state": "missing", "why": f"no nightly report in {Path(results) / 'nightly'}"}
    entries, probs = g2v.load_quarantine(quarantine or HERE / "gate2_quarantine.json", now.date())
    fin, doc, name = reps[0]
    j = judge_nightly(doc, fin, now, entries, max_age_h)
    j["report"] = name
    j["mode"] = "select" if j["ok"] else "full"
    if probs:
        j["quarantine_problems"] = probs
    return j


def tag_ok(results: Path, days: float = 7.0, now: dt.datetime | None = None) -> dict:
    """Plan rule 3A: tag a release only when a FULL (unselected) green nightly run on main is at most `days` old."""
    now = now or dt.datetime.now(dt.timezone.utc)
    for fin, doc, name in nightly_reports(results):
        age_d = (now - fin).total_seconds() / 86400
        if doc.get("verdict") == "pass" and gb.mode_of(doc) == "full" and age_d <= days:
            return {"ok": True, "report": name, "sha": doc.get("sha"), "age_days": round(age_d, 1)}
    return {"ok": False, "why": f"no full green nightly on main within {days:g} days"}


LINT_BLOCK_RC = 3   # `decide` exit code when the backend lint lane blocks (gate_release.sh stops on it)


def backend_lint_lane(stream=None, root=None, json_out=None) -> tuple[str, bool]:
    """Run the backend lint lane on `root` (default: lint_backend.default_root()) and print its summary to `stream` (stderr). Never
    raises. Returns (the text printed, blocked): blocked is True only for a finding in a tree that carries the blocking marker
    (lint_backend.blocks); a lane that could not run is NOT_RUN and does not block. `json_out` gets the result as JSON (the record
    release_gate2.sh keeps next to the gate report: gate_<b>_<sha>.lint.json)."""
    stream = stream if stream is not None else sys.stderr
    knob = os.environ.get("GATE_BACKEND_LINT", "1")
    if knob == "0":
        write_json(json_out, {"state": "OFF", "why": "GATE_BACKEND_LINT=0", "root": str(root or ""), "blocked": False})
        return "", False
    blocked = False
    try:
        import lint_backend as lb
        res = lb.run(Path(root) if root else lb.default_root())
        txt, blocked = lb.text(res), lb.blocks(res) and knob != "warn"
        res = {**res, "blocked": blocked, "knob": knob}
    except Exception as exc:  # noqa: BLE001  (a lane problem must never touch the gate decision)
        txt = f"backend lint (ruff F): NOT_RUN - {exc.__class__.__name__}: {str(exc)[:200]} (not blocking: the lint did not run)"
        res = {"state": "NOT_RUN", "why": txt, "root": str(root or ""), "blocked": False}
    write_json(json_out, res)
    print(txt, file=stream)
    return txt, blocked


def write_json(path, doc) -> None:
    if not path:
        return
    try:
        Path(path).write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
    except OSError as exc:
        print(f"gate_entry: could not write {path}: {exc}", file=sys.stderr)


# ---------------------------------------------------------------- coverage anchor of a targeted --after run (GATE-TRUST-2540, TR-09)
ANCHOR_MAX_COMMITS = int(os.environ.get("GATE2_ANCHOR_MAX_COMMITS", "20"))
ANCHOR_MAX_HOURS = float(os.environ.get("GATE2_ANCHOR_MAX_HOURS", "36"))
ANCHOR_MAX_PRODUCT_FILES = int(os.environ.get("GATE2_ANCHOR_MAX_PRODUCT_FILES", "40"))
PRODUCT_PATHS = ("frontend/src", "smplwise_vms/backend/smplwise", "custom_components")
# side files next to the reports that are not a run of their own. NOT skipped: the kept copies of real runs - `.pre-gate2.json` (an
# earlier run of the same sha, renamed when the sha is gated again) and `.gate2-first.json` (the full first run of a gate whose failures
# were all quarantined; the re-run then wrote a selection report under the plain name): either can be the anchor.
REPORT_SKIP = (".checkpoint", ".selection", ".engine", ".anchor", ".lint", ".early", "quarantine", "gate_status")


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, encoding="utf-8", errors="replace",
                          timeout=60, check=False)


def git_relation(repo: Path, sha: str, head: str) -> dict:
    """{"ancestor": bool, "commits": int|None, "product_files": int|None} of `sha` relative to `head` in `repo`."""
    none = {"ancestor": False, "commits": None, "product_files": None}
    if not sha:
        return none
    try:
        if _git(repo, "merge-base", "--is-ancestor", sha, head).returncode != 0:
            return none
        n = _git(repo, "rev-list", "--count", f"{sha}..{head}")
        d = _git(repo, "diff", "--name-only", sha, head, "--", *PRODUCT_PATHS)
    except (OSError, subprocess.SubprocessError):
        return none
    return {"ancestor": True, "commits": int(n.stdout.strip()) if n.returncode == 0 and n.stdout.strip().isdigit() else None,
            "product_files": len([x for x in d.stdout.splitlines() if x.strip()]) if d.returncode == 0 else None}


def run_reports(results: Path) -> list[tuple[dt.datetime, dict, str, str]]:
    """[(finished, doc, file name, kind)] of every run report under `results` (kind "gate") and `results`/nightly (kind "nightly"),
    newest first. Side files (.selection, .engine, .anchor, .lint, checkpoints, copies) are skipped."""
    out = []
    for kind, d in (("gate", Path(results)), ("nightly", Path(results) / "nightly")):
        for p in d.glob("gate_*.json") if d.is_dir() else []:
            if any(m in p.name for m in REPORT_SKIP):
                continue
            try:
                doc = json.loads(p.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if not isinstance(doc, dict) or "verdict" not in doc or not doc.get("sha"):
                continue
            fin = parse_ts(doc.get("finished")) or dt.datetime.fromtimestamp(p.stat().st_mtime, dt.timezone.utc)
            out.append((fin, doc, p.name, kind))
    return sorted(out, key=lambda t: t[0], reverse=True)


def full_run_completed(doc: dict) -> tuple[bool, str]:
    """A FULL tier-L run that really ran the suite: not a selection, the backend ran, no engine-level (`gate`) failure and no
    count-drop (`baseline`) failure. Its verdict may be red (its failures are listed)."""
    if doc.get("tier") != "L":
        return False, f"tier {doc.get('tier')}"
    if gb.mode_of(doc) != "full":
        return False, "a diff selection"
    if ((doc.get("counts") or {}).get("backend") or {}).get("pass", 0) <= 0:
        return False, "the backend did not run"
    bad = [i for i in doc.get("items", []) if i.get("status") == "FAIL" and i.get("category") in ("gate", "baseline")]
    if bad:
        return False, f"incomplete ({bad[0].get('category')}: {str(bad[0].get('id'))[:80]})"
    return True, "complete"


def anchor_check(results: Path, repo: Path, head: str, branch: str, after, now=None, max_commits: int = ANCHOR_MAX_COMMITS,
                 max_hours: float = ANCHOR_MAX_HOURS, max_product_files: int = ANCHOR_MAX_PRODUCT_FILES, quarantine=None,
                 accept: str = "") -> dict:
    """The coverage anchor of a targeted --after run (rule in the module doc). Returns {"ok", "why", "anchor"?, "after_sha", "limits",
    "rejected": [the nearest candidates and why]}; ok is also True, with "accepted", when `accept` (a reason) is given."""
    now = now or dt.datetime.now(dt.timezone.utc)
    limits = {"max_commits": max_commits, "max_hours": max_hours, "max_product_files": max_product_files}
    out: dict = {"ok": False, "head": head, "branch": branch, "limits": limits, "rejected": [], "checked_at": now.isoformat()}
    entries, _ = g2v.load_quarantine(Path(quarantine) if quarantine else HERE / "gate2_quarantine.json", now.date())
    if after is not None:
        try:
            adoc = json.loads(Path(after).read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            adoc = {}
            out["after_error"] = exc.__class__.__name__
        asha = str((adoc if isinstance(adoc, dict) else {}).get("sha") or "")
        out["after_sha"] = asha
        if not git_relation(Path(repo), asha, head)["ancestor"]:
            out["why"] = f"the --after report's sha {asha or '(none)'} is not an ancestor of {head}: its failures were measured on another line"
            return _accepted(out, accept)
    nearest = ""
    for fin, doc, name, kind in run_reports(results):
        age_h = (now - fin).total_seconds() / 3600
        if age_h > max_hours:
            break                                   # newest first: everything after this one is older still
        if kind == "nightly":
            j = judge_nightly(doc, fin, now, entries, max_hours)
            qual, what = j["state"] in ("green", "explained"), f"nightly {j['state']}"
        else:
            qual, what = full_run_completed(doc)
            if qual and doc.get("verdict") != "pass" and doc.get("branch") != branch:
                qual = False
            what = f"full run, verdict {doc.get('verdict')}"
        if not qual:
            continue
        rel = git_relation(Path(repo), str(doc.get("sha")), head)
        cand = {"report": name, "kind": kind, "sha": doc.get("sha"), "branch": doc.get("branch"), "verdict": doc.get("verdict"),
                "age_h": round(age_h, 1), "commits": rel["commits"], "product_files": rel["product_files"], "what": what}
        problems = []
        if not rel["ancestor"]:
            problems.append("not an ancestor of the head")
        else:
            if rel["commits"] is None or rel["commits"] > max_commits:
                problems.append(f"{rel['commits']} commits behind (limit {max_commits})")
            if rel["product_files"] is None or rel["product_files"] > max_product_files:
                problems.append(f"{rel['product_files']} product source files changed since (limit {max_product_files})")
        if not problems:
            out.update({"ok": True, "anchor": cand,
                        "why": f"coverage anchor {name} ({what}) @ {doc.get('sha')}: {rel['commits']} commit(s) and {age_h:.0f} h behind "
                               f"the head, {rel['product_files']} product source file(s) changed since"})
            return out
        cand["problems"] = problems
        if len(out["rejected"]) < 5:
            out["rejected"].append(cand)
        nearest = nearest or f"{name} @ {doc.get('sha')}: " + "; ".join(problems)
    out["why"] = ("no full run and no green nightly behind the head within the limits "
                  f"({max_commits} commits, {max_hours:g} h, {max_product_files} product source files)"
                  + (f"; nearest: {nearest}" if nearest else "; none qualifying finished in that time"))
    return _accepted(out, accept)


def _accepted(out: dict, accept: str) -> dict:
    if accept and not out.get("ok"):
        out.update({"ok": True, "accepted": accept, "why": out.get("why", "") + f" - ACCEPTED anyway: {accept}"})
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["enabled", "decide", "tagcheck", "rule", "lint", "anchor"])
    ap.add_argument("--results", default=os.environ.get("GATE_RESULTS_DIR") or str(Path.home() / "smplwise-results"))
    ap.add_argument("--quarantine")
    ap.add_argument("--flag")
    ap.add_argument("--max-age-h", type=float, default=36.0)
    ap.add_argument("--days", type=float, default=7.0)
    ap.add_argument("--now")
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--lint", action="store_true", help="decide: also run the backend lint lane (the behaviour before GATE-TRUST-2540)")
    ap.add_argument("--root", help="lint / decide --lint: the checkout to lint (the gate passes its own worktree)")
    ap.add_argument("--json", help="lint / anchor: also write the result as JSON here")
    ap.add_argument("--repo", help="anchor: the git repository (the gate's ~/smplwisebms)")
    ap.add_argument("--head", help="anchor: the head under test (a ref or a sha)")
    ap.add_argument("--branch", default="", help="anchor: the branch under test")
    ap.add_argument("--after", help="anchor: the red report the targeted run follows")
    ap.add_argument("--max-commits", type=int, default=ANCHOR_MAX_COMMITS)
    ap.add_argument("--max-hours", type=float, default=ANCHOR_MAX_HOURS)
    ap.add_argument("--max-product-files", type=int, default=ANCHOR_MAX_PRODUCT_FILES)
    ap.add_argument("--accept", default="", help="anchor: keep the targeted run without an anchor, with this reason on record")
    ns = ap.parse_args(argv)
    now = parse_ts(ns.now) if ns.now else None
    if ns.cmd == "rule":
        print(RULE_TEXT)
        return 0
    if ns.cmd == "enabled":
        return 0 if fast_enabled(ns.flag) else 1
    if ns.cmd == "lint":
        return 1 if backend_lint_lane(sys.stdout, ns.root, ns.json)[1] else 0
    if ns.cmd == "anchor":
        if not ns.repo or not ns.head:
            ap.error("anchor needs --repo and --head")
        r = anchor_check(Path(ns.results), Path(ns.repo), ns.head, ns.branch, Path(ns.after) if ns.after else None, now,
                         ns.max_commits, ns.max_hours, ns.max_product_files, ns.quarantine, ns.accept)
        write_json(ns.json, r)
        print(json.dumps(r, indent=1, ensure_ascii=False))
        return 0 if r["ok"] else 1
    if ns.cmd == "tagcheck":
        r = tag_ok(Path(ns.results), ns.days, now)
        print(json.dumps(r, indent=1))
        return 0 if r["ok"] else 1
    r = decide(Path(ns.results), Path(ns.quarantine) if ns.quarantine else None, now, ns.max_age_h, ns.flag, ns.full)
    print(json.dumps(r, indent=1, ensure_ascii=False))
    sys.stdout.flush()
    if not ns.lint:     # GATE-TRUST-2540 (TR-05): a release gate lints its own worktree in release_gate2.sh
        return 0
    return LINT_BLOCK_RC if backend_lint_lane(None, ns.root)[1] else 0


if __name__ == "__main__":
    sys.exit(main())
