#!/usr/bin/env python3
"""ONE quarantine list (GATE-FAST-2291, item 7). Edits and shows gate2_quarantine.json (the managed list that release_gate2.sh /
gate2_verdict.py already apply); the engine's automatic fix-ticket queue (<results>/quarantine.json, "failed on the first run in two
consecutive gates") is shown in the SAME listing as CANDIDATES that still need an owner, never as a second list with its own effect.

Semantics (implemented by gate2_verdict.py): a quarantined test ALWAYS runs. When every failure of a gate is quarantined the
wrapper re-runs only those tests once alone on the same sha; a second red is a real failure. Owner decision 30.10 night (ENTRY-CHECK-2310):
the list is for tests that fail only under load and pass alone; every entry needs a ticket (the fix ticket), an owner, a reason and an
expiry of at most 7 days after it was added (gate2_verdict.MAX_QUARANTINE_DAYS). An entry without them is ignored; an EXPIRED entry
explains nothing any more (its test counts as a failure again) and every gate / nightly / entry-check report lists it.

  gate_quarantine.py list   [--results DIR] [--file FILE] [--known known_issues.json]
  gate_quarantine.py add    --match <substring of the test id> --category backend|preview|dev|pixel|fixture|* --ticket T --owner O --reason R [--days 7]
  gate_quarantine.py remove --match <the entry's match> [--category C] --reason "<why: fixed in T / not flaky>"   -> moved to "history"
  gate_quarantine.py check  [--file FILE]      rc 0 = every entry valid and active; rc 1 = an invalid or expired entry (listed)
  gate_quarantine.py md     [--file FILE]      the markdown section the reports carry (nightly_tests.sh appends it)
  gate_quarantine.py prune  [--file FILE]      move expired entries to the "history" key (nothing is lost)
Exit 2 = refused (validation); the reason is printed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gate2_verdict as g2v      # noqa: E402

MAX_DAYS = g2v.MAX_QUARANTINE_DAYS
CATEGORIES = (*sorted(g2v.TEST_CATS), "*")


def _load(path: Path) -> dict:
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        d = {}
    d.setdefault("entries", [])
    return d


def add_entry(path: Path, match: str, category: str, ticket: str, owner: str, reason: str, days: int = MAX_DAYS, today: dt.date | None = None) -> dict:
    today = today or dt.date.today()
    match, ticket, owner, reason = (str(x or "").strip() for x in (match, ticket, owner, reason))
    if not (match and ticket and owner and reason):
        raise ValueError("match, ticket, owner and reason are all required")
    if category not in CATEGORIES:
        raise ValueError(f"category must be one of {', '.join(CATEGORIES)} (got {category!r})")
    if not 1 <= days <= MAX_DAYS:
        raise ValueError(f"expiry must be 1..{MAX_DAYS} days (got {days})")
    d = _load(path)
    act, _ = g2v.load_quarantine(path, today)
    if any(e["match"] == match and e.get("category") in (category, "*") for e in act):
        raise ValueError("an active entry with the same match already exists")
    e = {"match": match, "category": category, "ticket": ticket, "owner": owner, "added": today.isoformat(),
         "expires": (today + dt.timedelta(days=days)).isoformat(), "reason": reason}
    d["entries"].append(e)
    path.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return e


def remove_entry(path: Path, match: str, reason: str, category: str | None = None, today: dt.date | None = None) -> list[dict]:
    """Move the entries with this exact match (and category, when given) to "history" with the date and the reason."""
    today = today or dt.date.today()
    if not str(reason or "").strip():
        raise ValueError("a reason is required (e.g. 'fixed in <ticket>')")
    d = _load(path)
    hit = [e for e in d["entries"] if e.get("match") == match and (category is None or e.get("category", "*") == category)]
    if not hit:
        raise ValueError(f"no entry with match {match!r}" + (f" and category {category!r}" if category else ""))
    d["entries"] = [e for e in d["entries"] if not any(e is h for h in hit)]
    d.setdefault("history", []).extend({**e, "removed": today.isoformat(), "removed_reason": reason.strip()} for e in hit)
    path.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return hit


def markdown(path: Path, today: dt.date | None = None) -> list[str]:
    return g2v.quarantine_section(path, today)


def prune(path: Path, today: dt.date | None = None) -> list[dict]:
    today = today or dt.date.today()
    d = _load(path)
    keep, gone = [], []
    for e in d["entries"]:
        (gone if str(e.get("expires", "")) < today.isoformat() else keep).append(e)
    if gone:
        d["entries"] = keep
        d.setdefault("history", []).extend({**e, "pruned": today.isoformat()} for e in gone)
        path.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return gone


def listing(path: Path, results: Path | None, known: Path | None = None, today: dt.date | None = None) -> list[str]:
    today = today or dt.date.today()
    full = g2v.load_quarantine_full(path, today)
    act, probs = full["active"], full["problems"]
    out = [f"ACTIVE quarantine entries ({len(act)}): they run every gate; all-quarantined red -> one re-run alone, a second red is real"]
    for e in act:
        left = (dt.date.fromisoformat(e["expires"]) - today).days
        out.append(f"  {e['match']} [{e.get('category', '*')}] ticket {e['ticket']} owner {e['owner']} expires {e['expires']} ({left} d left): {e.get('reason', '')[:80]}")
    out += [f"  EXPIRED {e.get('expires')}: {e.get('match')} ticket {e.get('ticket')} - counts as a failure again (fix, renew or remove)" for e in full["expired"]]
    out += [f"  PROBLEM: {p}" for p in probs]
    cands = []
    if results:
        try:
            cands = json.loads((Path(results) / "quarantine.json").read_text(encoding="utf-8")).get("entries", [])
        except (OSError, ValueError):
            pass
    covered = lambda c: any(e["match"] in c.get("id", "") for e in act)   # noqa: E731
    open_c = [c for c in cands if not covered(c)]
    out.append(f"CANDIDATES from the engine's auto queue without an owner ({len(open_c)}): add them with `add` (ticket + owner + reason) or fix them")
    out += [f"  [{c.get('category')}] {c.get('id', '')[:140]} (failed first-run in: {', '.join(c.get('gates', [])[-3:])})" for c in open_c[:25]]
    if known:
        try:
            k = json.loads(Path(known).read_text(encoding="utf-8"))
            n = len(k if isinstance(k, list) else k.get("entries", k.get("known", [])))
            out.append(f"known_issues.json: {n} entries (the separate KNOWN allowlist; it hides failures, review it against this list)")
        except (OSError, ValueError):
            out.append("known_issues.json: unreadable")
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["list", "add", "remove", "check", "md", "prune"])
    ap.add_argument("--file", default=str(HERE / "gate2_quarantine.json"))
    ap.add_argument("--results", default=os.environ.get("GATE_RESULTS_DIR") or str(Path.home() / "smplwise-results"))
    ap.add_argument("--known")
    for a in ("match", "category", "ticket", "owner", "reason"):
        ap.add_argument(f"--{a}")
    ap.add_argument("--days", type=int, default=MAX_DAYS)
    ap.add_argument("--today", help="YYYY-MM-DD (tests)")
    ns = ap.parse_args(argv)
    p = Path(ns.file)
    today = dt.date.fromisoformat(ns.today) if ns.today else dt.date.today()
    if ns.cmd == "list":
        print("\n".join(listing(p, Path(ns.results), Path(ns.known) if ns.known else None, today)))
        return 0
    if ns.cmd == "md":
        print("\n".join(markdown(p, today)).lstrip("\n"))
        return 0
    if ns.cmd == "check":
        full = g2v.load_quarantine_full(p, today)
        bad = full["problems"] + [f"{e.get('match')}: expired {e.get('expires')}" for e in full["expired"]]
        print(f"quarantine {p}: {len(full['active'])} active, {len(full['expired'])} expired, {len(full['problems'])} invalid")
        for b in bad:
            print(f"  {b}")
        return 1 if bad else 0
    if ns.cmd == "prune":
        print(f"pruned {len(prune(p, today))} expired entries")
        return 0
    try:
        if ns.cmd == "remove":
            gone = remove_entry(p, ns.match or "", ns.reason or "", ns.category, today)
            print(f"removed {len(gone)} entr{'y' if len(gone) == 1 else 'ies'} with match {ns.match!r} (kept in history)")
            return 0
        e = add_entry(p, ns.match or "", ns.category or "*", ns.ticket or "", ns.owner or "", ns.reason or "", ns.days, today)
    except ValueError as ex:
        print(f"refused: {ex}")
        return 2
    print(f"added {e['match']} until {e['expires']} (ticket {e['ticket']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
