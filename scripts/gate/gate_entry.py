#!/usr/bin/env python3
"""The single release-gate entry point's decision logic (GATE-FAST-2291, item 2). Runs no test.

gate_release.sh <branch> is the ONE command for a release gate. It asks this module two things:

  1. is the fast (change-based) gate ENABLED?   Default OFF. Owner answer 2A: it is switched on by the lead only after the Friday
     30.10 full run ended green or with explained failures: `touch ~/.gate_fast_enabled` (or GATE_FAST_FLAG=<file>). Without the flag
     the entry runs the FULL tier (the v2 schedule), exactly as before.
  2. when it is enabled, what does the newest full nightly on main allow?  THE RULE (printed by `rule`):

       nightly GREEN (verdict pass, <= 36 h old, backend ran)                       -> SELECT: change-based gate
       nightly RED, every failing test is quarantined (ticket + owner + expiry <= 21 d, gate2_quarantine.json)
                                                                                    -> SELECT, the explained failures are listed
       nightly RED with any failure that is not quarantined, or an engine-level failure -> FULL tier, the failing tests are named
       nightly STALE (> 36 h) or MISSING                                           -> FULL tier
       --full on the command line                                                   -> FULL tier
     Selection never skips the always-run core (docs/release/GATE_V2.md); the nightly stays the safety net for everything else.

CLI (all print JSON, except rule):
  gate_entry.py enabled [--flag FILE]                 rc 0 enabled / 1 not
  gate_entry.py decide  --results DIR [--quarantine FILE] [--max-age-h 36] [--now ISO]
  gate_entry.py tagcheck --results DIR [--days 7]     rc 0 when a FULL green nightly on main is <= N days old (plan rule 3A for tagging)
  gate_entry.py rule
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


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cmd", choices=["enabled", "decide", "tagcheck", "rule"])
    ap.add_argument("--results", default=os.environ.get("GATE_RESULTS_DIR") or str(Path.home() / "smplwise-results"))
    ap.add_argument("--quarantine")
    ap.add_argument("--flag")
    ap.add_argument("--max-age-h", type=float, default=36.0)
    ap.add_argument("--days", type=float, default=7.0)
    ap.add_argument("--now")
    ap.add_argument("--full", action="store_true")
    ns = ap.parse_args(argv)
    now = parse_ts(ns.now) if ns.now else None
    if ns.cmd == "rule":
        print(RULE_TEXT)
        return 0
    if ns.cmd == "enabled":
        return 0 if fast_enabled(ns.flag) else 1
    if ns.cmd == "tagcheck":
        r = tag_ok(Path(ns.results), ns.days, now)
        print(json.dumps(r, indent=1))
        return 0 if r["ok"] else 1
    r = decide(Path(ns.results), Path(ns.quarantine) if ns.quarantine else None, now, ns.max_age_h, ns.flag, ns.full)
    print(json.dumps(r, indent=1, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
