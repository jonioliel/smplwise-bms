#!/usr/bin/env python3
"""Gate v2 (GATE2-295) verdict post-processor: reads the engine's report of a gate-2 run and writes the gate-2 summary.

The engine's verdict is never edited. Gate 2 adds:
  * the managed QUARANTINE (gate2_quarantine.json, entries with a ticket and an expiry <= 7 days): a FAIL that matches an active entry is
    listed as QUARANTINED. Quarantined tests always run; the entry only changes what happens next: when EVERY failure of the run
    is quarantined, release_gate2.sh re-runs ONLY those tests once more on the same sha (rc 10 below). Two red runs in a row
    of a quarantined test = a real FAIL (the second report is read with --second).
  * the next step for a red run that is not all-quarantined: the exact targeted re-run command (`--after <this report>`) for
    after the fix, instead of a full re-gate (owner rule: a red only from stale tests -> targeted run on the release head);
  * the selection summary (selected / deferred to the nightly) from gate_<b>_<sha>.selection.json.

  gate2_verdict.py <gate report .json> [--quarantine <json>] [--second] [--branch <b>]
  gate2_verdict.py propose [--results <dir>] [--last 6]     candidates: first-run failures in >= 2 of the last N gates
Exit: 0 gate-2 pass, 1 fail, 10 fail but every FAIL is quarantined (the wrapper then re-runs only those), 2 usage/input error.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

TEST_CATS = {"backend", "preview", "dev", "pixel", "fixture"}


MAX_QUARANTINE_DAYS = 7      # owner decision 30.10 night (ENTRY-CHECK-2310): expiry at most 7 days after `added` (was 21)
QUARANTINE_FIELDS = ("match", "ticket", "owner", "reason")


def load_quarantine_full(path: Path, today: dt.date | None = None) -> dict:
    """{"active": [...], "expired": [...], "problems": [str]}. An entry: {"match": "<substring of the item id>", "category":
    "backend|preview|dev|pixel|fixture|*", "ticket": "...", "owner": "...", "reason": "...", "added": "YYYY-MM-DD",
    "expires": "YYYY-MM-DD"}. Only ACTIVE entries explain a failure. An EXPIRED entry explains nothing (its test counts as a
    failure again) and is listed by every report; an entry without match/ticket/owner/reason, without valid dates, with expiry
    before `added`, or longer than MAX_QUARANTINE_DAYS is ignored and reported as a problem."""
    today = today or dt.date.today()
    out: dict = {"active": [], "expired": [], "problems": []}
    try:
        doc = json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return out
    except ValueError as e:
        out["problems"].append(f"{path}: not JSON ({e})")
        return out
    for e in doc.get("entries", []) if isinstance(doc, dict) else []:
        tag = e.get("match", "?")
        try:
            added = dt.date.fromisoformat(e["added"])
            exp = dt.date.fromisoformat(e["expires"])
        except (KeyError, ValueError, TypeError):
            out["problems"].append(f"{tag}: no valid added/expires date - ignored"); continue
        missing = [k for k in QUARANTINE_FIELDS if not str(e.get(k) or "").strip()]
        if missing:
            out["problems"].append(f"{tag}: needs {', '.join(missing)} - ignored"); continue
        if exp < added:
            out["problems"].append(f"{tag}: expires {exp} before it was added {added} - ignored"); continue
        if (exp - added).days > MAX_QUARANTINE_DAYS:
            out["problems"].append(f"{tag}: longer than {MAX_QUARANTINE_DAYS} days ({added} -> {exp}) - ignored"); continue
        if exp < today:
            out["expired"].append(e); continue
        out["active"].append(e)
    return out


def load_quarantine(path: Path, today: dt.date | None = None) -> tuple[list[dict], list[str]]:
    """(active entries, problems) - the old shape; expired entries are reported among the problems."""
    f = load_quarantine_full(path, today)
    return f["active"], f["problems"] + [f"{e.get('match', '?')}: expired {e.get('expires')} - ignored, counts as a failure again "
                                         f"(fix the test or renew with a reason)" for e in f["expired"]]


def quarantine_section(path: Path, today: dt.date | None = None, heading: str = "##") -> list[str]:
    """The markdown section every gate / nightly / entry-check report carries: active entries with ticket, owner, expiry and days
    left; EXPIRED entries (their tests count as failures again); invalid entries."""
    today = today or dt.date.today()
    f = load_quarantine_full(path, today)
    out = ["", f"{heading} Quarantine list (active {len(f['active'])}, expired {len(f['expired'])}, invalid {len(f['problems'])}; "
               f"max {MAX_QUARANTINE_DAYS} days, ticket required)", ""]
    for e in f["active"]:
        left = (dt.date.fromisoformat(e["expires"]) - today).days
        out.append(f"- {e['match']} [{e.get('category', '*')}] ticket {e['ticket']}, owner {e['owner']}, added {e['added']}, "
                   f"expires {e['expires']} ({left} d left): {str(e.get('reason', ''))[:100]}")
    for e in f["expired"]:
        out.append(f"- EXPIRED {e['expires']}: {e.get('match')} [{e.get('category', '*')}] ticket {e.get('ticket')} - "
                   f"counts as a failure again; fix the test, or renew it with a new reason")
    out += [f"- INVALID: {p}" for p in f["problems"]]
    if len(out) == 3:
        out.append("- (empty)")
    return out


def quarantined(item: dict, entries: list[dict]) -> dict | None:
    for e in entries:
        if e.get("category", "*") not in ("*", item.get("category")):
            continue
        if e["match"] in item.get("id", ""):
            return e
    return None


def classify(report: dict, entries: list[dict]) -> dict:
    fails = [i for i in report.get("items", []) if i.get("status") == "FAIL"]
    hard = [i for i in fails if i.get("category") not in TEST_CATS]
    tests = [i for i in fails if i.get("category") in TEST_CATS]
    q = [(i, quarantined(i, entries)) for i in tests]
    return {"hard": hard, "quarantined": [(i, e) for i, e in q if e], "real": [i for i, e in q if not e],
            "flaky": [i for i in report.get("items", []) if i.get("status") == "FLAKY"]}


def summary_md(report: dict, sel: dict | None, c: dict, probs: list[str], branch: str, rpath: Path, second: bool,
               qsection: list[str] | None = None) -> str:
    v = report.get("verdict")
    if v == "pass":
        g2 = "PASS"
    elif not c["hard"] and not c["real"] and c["quarantined"]:
        g2 = "FAIL (quarantined tests only)" + ("" if second else " - re-run of only those tests follows")
    else:
        g2 = "FAIL"
    lines = [f"# Gate 2: {report.get('branch')} @ {report.get('sha')}", "",
             f"- gate-2 verdict: **{g2}** (engine verdict: {v}; wall {int(report.get('wall_seconds', 0)) // 60} min; schedule {report.get('schedule')})"]
    if sel:
        b, f = sel.get("backend", {}), sel.get("frontend", {})
        d = sel.get("deferred_to_nightly") or {}
        lines += [f"- selection ({sel.get('policy', 'select_tests')}, base {sel.get('base')}): backend {len(b.get('selected', []))}/{b.get('total')} files, "
                  f"frontend {len(f.get('selected', []))}/{f.get('total')} specs; full sides: backend={bool(sel.get('full', {}).get('backend'))} "
                  f"frontend={bool(sel.get('full', {}).get('frontend'))}",
                  f"- deferred to the nightly full run (heavy, unchanged): {len(d)} specs" + (": " + ", ".join(sorted(d)) if d else ""),
                  f"- pixel: {sel.get('pixel', '-')}",
                  "- NOT run in this gate: every dropped file above. The nightly full tier L on main is the coverage for them; "
                  "any red there after this release is a missed-selection incident (select_tests.py audit)."]
        if sel.get("error"):
            lines.append(f"- selection error (the engine ran the full tier): {sel['error']}")
    else:
        lines.append("- selection: none (full tier)")
    lines += ["", f"## Hard failures ({len(c['hard'])})", ""] + [f"- [{i['category']}] {i['id']} {i.get('reason', '')[:160]}" for i in c["hard"]] + ["- (none)"] * (not c["hard"])
    lines += ["", f"## Test failures ({len(c['real'])})", ""] + [f"- [{i['category']}] {i['id'][:160]} - {i.get('reason', '')[:120]}" for i in c["real"]] + ["- (none)"] * (not c["real"])
    lines += ["", f"## Quarantined failures ({len(c['quarantined'])})", ""] + \
             [f"- [{i['category']}] {i['id'][:150]} - ticket {e['ticket']}, expires {e['expires']}" for i, e in c["quarantined"]] + ["- (none)"] * (not c["quarantined"])
    lines += ["", f"## Flaky (failed once, passed alone): {len(c['flaky'])}", ""] + [f"- [{i['category']}] {i['id'][:160]}" for i in c["flaky"][:40]] + ["- (none)"] * (not c["flaky"])
    if qsection is not None:
        lines += qsection
    elif probs:
        lines += ["", "## Quarantine file problems", ""] + [f"- {p}" for p in probs]
    if g2 == "FAIL":
        if c["hard"]:
            lines += ["", "## Next step", "", "A hard failure (tsc / build / release_check / engine guard): fix it and run the gate again (a targeted re-run cannot prove a build)."]
        else:
            lines += ["", "## Next step (instead of a full re-gate)", "",
                      "Fix the failures (a stale test: test-only change; a real defect: product fix), push to the same branch, then:", "",
                      "```", f"~/gate2/release_gate2.sh {branch or report.get('branch')} --after {rpath}", "```", "",
                      "It runs the failed tests' files + everything the fix touches + the core, on the new head, with the same guards. "
                      "The release decision is this report plus that re-run; the full tier of the untouched rest is this report's."]
    return "\n".join(lines) + "\n"


def propose(results: Path, last: int) -> str:
    """Repeated first-run failures (FLAKY or FAIL) over the last `last` gate reports: quarantine CANDIDATES. The lead adds an
    entry by hand with a ticket; nothing is written here."""
    reps = []
    for p in sorted(results.glob("gate_*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        if p.name.endswith((".selection.json",)) or p.name == "gate_status.json":
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if "items" in d and "verdict" in d:
            reps.append((p.name, d))
        if len(reps) >= last:
            break
    seen: dict[str, list[str]] = {}
    for name, d in reps:
        ids = set()
        for i in d["items"]:
            if i.get("status") in ("FLAKY", "FAIL") and i.get("category") in TEST_CATS:
                ids.add(f"[{i['category']}] " + re.sub(r"\s+", " ", i["id"])[:140])
        for x in ids:
            seen.setdefault(x, []).append(name)
    rows = sorted(((x, n) for x, n in seen.items() if len(n) >= 2), key=lambda kv: -len(kv[1]))
    out = [f"# quarantine candidates: first-run failures in >= 2 of the last {len(reps)} gates", ""]
    out += [f"- {len(n)}x {x}" for x, n in rows] or ["- none"]
    return "\n".join(out) + "\n"


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv[:1] == ["propose"]:
        ap = argparse.ArgumentParser()
        ap.add_argument("cmd")
        ap.add_argument("--results", default=str(Path.home() / "smplwise-results"))
        ap.add_argument("--last", type=int, default=6)
        ns = ap.parse_args(argv)
        print(propose(Path(ns.results), ns.last))
        return 0
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("report")
    ap.add_argument("--quarantine", default=str(Path(__file__).resolve().parent / "gate2_quarantine.json"))
    ap.add_argument("--second", action="store_true", help="this report is the re-run of quarantined failures")
    ap.add_argument("--branch", default="")
    ap.add_argument("--today", help="YYYY-MM-DD (tests)")
    ns = ap.parse_args(argv)
    today = dt.date.fromisoformat(ns.today) if ns.today else None
    rp = Path(ns.report)
    try:
        report = json.loads(rp.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(f"gate2_verdict: cannot read {rp}: {e}")
        return 2
    sp = rp.with_name(rp.name[:-len(".json")] + ".selection.json")
    sel = None
    if sp.exists():
        try:
            sel = json.loads(sp.read_text(encoding="utf-8"))
        except ValueError:
            sel = None
    entries, probs = load_quarantine(Path(ns.quarantine), today)
    c = classify(report, entries)
    md = summary_md(report, sel, c, probs, ns.branch, rp, ns.second, quarantine_section(Path(ns.quarantine), today))
    out = rp.with_name(rp.name[:-len(".json")] + (".gate2-rerun.md" if ns.second else ".gate2.md"))
    out.write_text(md, encoding="utf-8")
    print(md)
    print(f"gate-2 summary: {out}")
    if report.get("verdict") == "pass":
        return 0
    if not c["hard"] and not c["real"] and c["quarantined"] and not ns.second:
        return 10
    return 1


if __name__ == "__main__":
    sys.exit(main())
