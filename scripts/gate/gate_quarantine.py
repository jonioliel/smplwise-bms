#!/usr/bin/env python3
"""ONE quarantine list (GATE-FAST-2291, item 7). Edits and shows gate2_quarantine.json (the managed list that release_gate2.sh /
gate2_verdict.py already apply); the engine's automatic fix-ticket queue (<results>/quarantine.json, "failed on the first run in two
consecutive gates") is shown in the SAME listing as CANDIDATES that still need an owner, never as a second list with its own effect.

Semantics (implemented by gate2_verdict.py, unchanged): a quarantined test ALWAYS runs. When every failure of a gate is quarantined the
wrapper re-runs only those tests once alone on the same sha; a second red is a real failure. Every entry needs a reason, an owner, a ticket
and an expiry of at most 21 days after it was added; an entry without them, or past its expiry, is ignored (and reported by `list`).

  gate_quarantine.py list  [--results DIR] [--file FILE] [--known known_issues.json]
  gate_quarantine.py add   --match <substring of the test id> --category backend|preview|dev|pixel|fixture|* --ticket T --owner O --reason R [--days 21]
  gate_quarantine.py prune [--file FILE]       move expired entries to the "history" key (nothing is lost)
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

MAX_DAYS = 21


def _load(path: Path) -> dict:
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        d = {}
    d.setdefault("entries", [])
    return d


def add_entry(path: Path, match: str, category: str, ticket: str, owner: str, reason: str, days: int = MAX_DAYS, today: dt.date | None = None) -> dict:
    today = today or dt.date.today()
    if not (match and ticket and owner and reason):
        raise ValueError("match, ticket, owner and reason are all required")
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
    act, probs = g2v.load_quarantine(path, today)
    out = [f"ACTIVE quarantine entries ({len(act)}): they run every gate; all-quarantined red -> one re-run alone, a second red is real"]
    for e in act:
        left = (dt.date.fromisoformat(e["expires"]) - today).days
        out.append(f"  {e['match']} [{e.get('category', '*')}] ticket {e['ticket']} owner {e['owner']} expires {e['expires']} ({left} d left): {e.get('reason', '')[:80]}")
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
    ap.add_argument("cmd", choices=["list", "add", "prune"])
    ap.add_argument("--file", default=str(HERE / "gate2_quarantine.json"))
    ap.add_argument("--results", default=os.environ.get("GATE_RESULTS_DIR") or str(Path.home() / "smplwise-results"))
    ap.add_argument("--known")
    for a in ("match", "category", "ticket", "owner", "reason"):
        ap.add_argument(f"--{a}")
    ap.add_argument("--days", type=int, default=MAX_DAYS)
    ns = ap.parse_args(argv)
    p = Path(ns.file)
    if ns.cmd == "list":
        print("\n".join(listing(p, Path(ns.results), Path(ns.known) if ns.known else None)))
        return 0
    if ns.cmd == "prune":
        print(f"pruned {len(prune(p))} expired entries")
        return 0
    try:
        e = add_entry(p, ns.match or "", ns.category or "*", ns.ticket or "", ns.owner or "", ns.reason or "", ns.days)
    except ValueError as ex:
        print(f"refused: {ex}")
        return 2
    print(f"added {e['match']} until {e['expires']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
