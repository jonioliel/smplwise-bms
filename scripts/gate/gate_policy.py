#!/usr/bin/env python3
"""GATEEFF-295: the release gate's POLICY layer. Pure functions, no process is started, nothing outside the arguments is read
(except the files the caller names), so every rule here is unit-tested on any OS (tests/test_gate_efficiency.py).

release_gate.py decides WHAT RAN and WHAT FAILED; this module decides what a failure MEANS:

  * managed quarantine   scripts/gate/gate_quarantine.json - every entry has id, kind, test selector, reason, owner, added,
                         expires (at most 14 days after `added`), ticket. A quarantined test still RUNS and is still retried alone;
                         if it keeps failing it is listed as QUARANTINED (never green, never hidden) and does not turn the gate red.
                         An expired or malformed entry turns the gate red. Nothing is ever quarantined automatically.
  * pixel lane           a screenshot mismatch that stays after the retry alone is PIXEL_REVIEW: the verdict becomes "review"
                         (neither pass nor fail) until a person accepts or rejects the images (release_gate.py --resolve-review).
  * base comparison      a failure that also fails on the base commit is PREEXISTING (reported, not caused by this diff).
  * flaky counter        a test that failed first and passed alone is FLAKY and counted across gates (flaky_counts.json).
  * nightly health       diff selection for a release gate is allowed only while the last full nightly on main finished.
  * schedule default     v2 is the default only when a recorded shadow comparison (gate_schedule_evidence.json) says SAME.
  * summary              the one-page file the lead reads first.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re
from pathlib import Path

QUARANTINE_NAME = "gate_quarantine.json"
EVIDENCE_NAME = "gate_schedule_evidence.json"
MAX_QUARANTINE_DAYS = 14
KINDS = ("backend", "playwright")
TICKET_RE = re.compile(r"^(https?://\S+|[A-Za-z][A-Za-z0-9]*-\d+|T\d{2,5})$")
REQUIRED = ("id", "kind", "reason", "owner", "added", "expires", "ticket")

# a Playwright failure whose first error line is a screenshot / snapshot comparison
PIXEL_RE = re.compile(r"(tohavescreenshot|screenshot comparison|tomatchsnapshot|snapshot comparison|pixels?\s*\(ratio|"
                      r"expected an image|a snapshot doesn't exist|image sizes? do(?:es)? not match)", re.I)

# statuses a finished item can carry that mean "this test did not pass on its first run"
RED_STATUSES = ("FAIL", "QUARANTINED", "PIXEL_REVIEW", "PREEXISTING")


# ------------------------------------------------------------------------------------------------ quarantine
def parse_date(s):
    try:
        return _dt.date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def validate_entry(e, today):
    """Problems of one entry (empty list = valid). Does not look at expiry vs today: see load_quarantine()."""
    if not isinstance(e, dict):
        return ["entry is not an object"]
    bad = []
    for k in REQUIRED:
        if not str(e.get(k) or "").strip():
            bad.append(f"missing {k}")
    if e.get("kind") not in KINDS:
        bad.append(f"kind must be one of {', '.join(KINDS)}")
    if e.get("kind") == "backend" and not str(e.get("nodeid") or "").strip():
        bad.append("a backend entry needs nodeid (tests/test_x.py::test_name; a parametrized test matches by prefix)")
    if e.get("kind") == "playwright":
        if not str(e.get("file") or "").endswith((".spec.ts", ".spec.js")):
            bad.append("a playwright entry needs file (x.spec.ts)")
        if not e.get("line") and not str(e.get("title_contains") or "").strip():
            bad.append("a playwright entry needs line or title_contains (a whole file is never quarantined)")
    t = str(e.get("ticket") or "").strip()
    if t and not TICKET_RE.match(t):
        bad.append("ticket must be a URL or a task id such as PHONE-295 / T123")
    a, x = parse_date(e.get("added")), parse_date(e.get("expires"))
    if e.get("added") and a is None:
        bad.append("added is not a date (YYYY-MM-DD)")
    if e.get("expires") and x is None:
        bad.append("expires is not a date (YYYY-MM-DD)")
    if a and x:
        if x < a:
            bad.append("expires is before added")
        elif (x - a).days > MAX_QUARANTINE_DAYS:
            bad.append(f"expires is {(x - a).days} days after added; the maximum is {MAX_QUARANTINE_DAYS}")
        if a > today:
            bad.append("added is in the future")
    return bad


def load_quarantine(path, today=None):
    """Read the managed quarantine file. Returns
    {source, sha256, entries (valid and not expired: they apply), expired [entries], invalid [(id, [problems])], error}.
    A missing file is an empty quarantine; an unreadable or malformed one is an `error` (the engine turns it into a red)."""
    today = today or _dt.date.today()
    out = {"source": str(path or ""), "sha256": "", "entries": [], "expired": [], "invalid": [], "error": ""}
    if not path:
        return out
    p = Path(path)
    if not p.exists():
        return out
    try:
        raw = p.read_bytes()
        out["sha256"] = hashlib.sha256(raw).hexdigest()[:16]
        doc = json.loads(raw.decode("utf-8-sig"))
        entries = doc["entries"] if isinstance(doc, dict) else doc
        if not isinstance(entries, list):
            raise ValueError("'entries' must be a list")
    except (OSError, ValueError, KeyError) as e:
        out["error"] = f"{type(e).__name__}: {e}"[:200]
        return out
    seen = set()
    for e in entries:
        problems = validate_entry(e, today)
        eid = str((e or {}).get("id") or "?") if isinstance(e, dict) else "?"
        if eid in seen:
            problems.append("duplicate id")
        seen.add(eid)
        if problems:
            out["invalid"].append((eid, problems))
            continue
        if parse_date(e["expires"]) < today:
            out["expired"].append(e)
            continue
        out["entries"].append(e)
    return out


def entry_matches(e, kind, nodeid="", file="", line=None, project="", title=""):
    if e.get("kind") != kind:
        return False
    if kind == "backend":
        want = str(e["nodeid"]).replace("\\", "/")
        n = str(nodeid).replace("\\", "/")
        b = n.split("[", 1)[0] if "[" not in want else n      # a parametrized test matches by its base id unless the entry names a parameter
        return b == want or b.endswith("/" + want)
    if e.get("file") != file:
        return False
    if e.get("project") not in (None, "", "*", project):
        return False
    if e.get("line") and int(e["line"]) != int(line or -1):
        return False
    if e.get("title_contains") and e["title_contains"] not in (title or ""):
        return False
    return True


def find_quarantine(q, kind, **meta):
    """The applying entry for a failed test, or None."""
    for e in (q or {}).get("entries", []):
        if entry_matches(e, kind, **meta):
            return e
    return None


def quarantine_unused(q, matched_ids):
    """Applying entries that matched no failure in this run: their test passed or did not run - the owner should remove them."""
    return [e for e in (q or {}).get("entries", []) if e["id"] not in matched_ids]


# ------------------------------------------------------------------------------------------------ classification
def is_pixel_diff(err):
    return bool(PIXEL_RE.search(err or ""))


def classify_final(q, kind, err="", pixel_lane=True, **meta):
    """A test failed and failed again alone (or could not be retried). -> (status, entry|None):
    QUARANTINED (an applying entry), PIXEL_REVIEW (screenshot mismatch) or FAIL."""
    e = find_quarantine(q, kind, **meta)
    if e:
        return "QUARANTINED", e
    if pixel_lane and kind == "playwright" and is_pixel_diff(err):
        return "PIXEL_REVIEW", None
    return "FAIL", None


_PW_ID = re.compile(r"^(?P<file>\S+?):(?P<line>\d+) \[(?P<project>[^\]]*)\] (?P<title>.*)$", re.S)


def test_key(ident, category=""):
    """A line-number-free key for a failed test (the base commit has other line numbers): playwright ids are
    (file, project, title), backend node ids stay as they are."""
    m = _PW_ID.match(ident or "")
    if m:
        return ("pw", m["file"], m["project"], m["title"])
    return ("be", ident)


def is_test_item(it):
    i = it.get("id", "")
    return it.get("category") in ("backend", "preview", "dev", "pixel", "fixture") and ("::" in i or _PW_ID.match(i) is not None)


def base_failures(reports):
    """From earlier gate reports OF THE BASE COMMIT: ({key: label} of tests that failed there, set of categories those reports
    ran completely, {key} of tests that were flaky/known there (inconclusive))."""
    failed, complete, soft = {}, set(), set()
    for label, d in reports:
        reduced = set(((d.get("selection") or {}).get("reduced") or {}).keys())
        for cat, c in (d.get("counts") or {}).items():
            if cat in reduced or cat in ("baseline", "quarantine"):
                continue
            if (c.get("pass", 0) + c.get("flaky", 0)) > 0:
                complete.add(cat)
        for it in d.get("items", []):
            if not is_test_item(it):
                continue
            k = test_key(it["id"], it.get("category"))
            if it.get("status") in RED_STATUSES:
                failed.setdefault(k, label)
            elif it.get("status") in ("FLAKY", "KNOWN"):
                soft.add(k)
    return failed, complete, soft


def reclassify(fail_items, base_failed, complete, soft, ran_on_base=None):
    """Decide NEW vs PREEXISTING for each FAIL item. ran_on_base = {key: 'fail'|'pass'|'missing'|'unverified'} from running the
    failed tests on the base commit. Returns {item_id: (cls, evidence)} with cls in new / preexisting / unverified."""
    ran_on_base = ran_on_base or {}
    out = {}
    for it in fail_items:
        k = test_key(it["id"], it.get("category"))
        if k in base_failed:
            out[it["id"]] = ("preexisting", f"failed in the gate report of the base ({base_failed[k]})")
        elif k in ran_on_base:
            r = ran_on_base[k]
            out[it["id"]] = {"fail": ("preexisting", "fails when run on the base commit"),
                             "pass": ("new", "passes on the base commit"),
                             "missing": ("new", "does not exist on the base commit"),
                             }.get(r, ("unverified", "could not be run on the base commit"))
        elif it.get("category") in complete and k not in soft:
            out[it["id"]] = ("new", "the base's own gate ran this category and this test did not fail there")
        else:
            out[it["id"]] = ("unverified", "no base result")
    return out


# ------------------------------------------------------------------------------------------------ flaky counter
def update_flaky_counter(doc, gate_label, flaky_ids, when):
    """doc = flaky_counts.json content. Every id that was FLAKY in this gate gets count+1 (once per gate label)."""
    doc = doc if isinstance(doc, dict) else {}
    tests = doc.setdefault("tests", {})
    for tid in flaky_ids:
        t = tests.setdefault(tid, {"count": 0, "first": when, "gates": []})
        if gate_label in t["gates"]:
            continue
        t["count"] += 1
        t["last"] = when
        t["gates"] = (t["gates"] + [gate_label])[-10:]
    doc["updated"] = when
    return doc


# ------------------------------------------------------------------------------------------------ nightly health, defaults
def nightly_health(nightly_dir, now, branch="main", max_age_h=48):
    """May a release gate use diff selection? Only while the FULL nightly on main finished recently: a report exists, is not older
    than max_age_h, was not terminated by its time budget, and no big category fell below its baseline (cut-off suites).
    -> {ok, reason, report}. The nightly's own reds do not matter here (selection audit and triage handle them)."""
    d = Path(nightly_dir) if nightly_dir else None
    if not d or not d.is_dir():
        return {"ok": False, "reason": "no nightly results directory", "report": ""}
    best = None
    for p in d.glob(f"gate_{branch}_*.json"):
        if p.name.endswith(".selection.json"):
            continue
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        fin = parse_date(str(doc.get("finished") or "")[:10])
        stamp = str(doc.get("finished") or "")
        if fin and (best is None or stamp > best[0]):
            best = (stamp, p, doc)
    if not best:
        return {"ok": False, "reason": "no nightly report for " + branch, "report": ""}
    stamp, p, doc = best
    try:
        age = (now - _dt.datetime.strptime(stamp[:19], "%Y-%m-%dT%H:%M:%S")).total_seconds() / 3600.0
    except ValueError:
        return {"ok": False, "reason": f"unreadable finish time in {p.name}", "report": p.name}
    if age > max_age_h:
        return {"ok": False, "reason": f"the last nightly ({p.name}) is {age:.0f} h old (max {max_age_h} h)", "report": p.name}
    for it in doc.get("items", []):
        if it.get("category") == "gate" and re.search(r"terminated|budget|exhausted|incomplete", it.get("id", "") + it.get("reason", ""), re.I):
            return {"ok": False, "reason": f"the last nightly ({p.name}) did not finish: {it.get('id', '')[:80]}", "report": p.name}
    for cat, row in (doc.get("baseline_check") or {}).items():
        if row.get("state") == "low" and cat in ("backend", "preview", "dev"):
            return {"ok": False, "reason": f"the last nightly ({p.name}) ran only {row.get('ratio', 0):.0%} of the {cat} baseline", "report": p.name}
    return {"ok": True, "reason": f"the last nightly {p.name} finished {age:.0f} h ago", "report": p.name}


def resolve_schedule(cli, env, evidence_path):
    """-> (schedule, why). Precedence: --schedule, GATE_SCHEDULE, recorded shadow evidence (default v2), else v1."""
    for src, v in (("--schedule", cli), ("GATE_SCHEDULE", env)):
        if v and str(v).strip():
            return str(v).strip().lower(), f"set by {src}"
    try:
        ev = json.loads(Path(evidence_path).read_text(encoding="utf-8"))
        if ev.get("default") == "v2" and ev.get("verdict") == "SAME":
            return "v2", f"default v2: shadow comparison SAME ({ev.get('shadow', '?')} vs {ev.get('reference', '?')}, {ev.get('date', '?')})"
    except (OSError, ValueError, AttributeError):
        pass
    return "v1", "default v1: no recorded shadow comparison yet (python3 shadow_compare.py --record ...)"


# ------------------------------------------------------------------------------------------------ the one-page summary
def _short(s, n=150):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"


def render_summary(doc, flaky_counts=None, running=False):
    """One page, English. `doc` is the gate's report dict (counts, items, verdict, ...). Lists the reds that matter first."""
    items = doc.get("items", [])
    counts = doc.get("counts", {})

    def n(key):
        return sum(c.get(key, 0) for c in counts.values())

    by = lambda st: [i for i in items if i.get("status") == st]   # noqa: E731
    new_red = [i for i in by("FAIL")]
    verdict = doc.get("verdict", "?")
    head = {"pass": "PASS", "fail": "FAIL", "review": "REVIEW NEEDED (pixel lane)", "running": "RUNNING"}.get(verdict, verdict.upper())
    lines = [f"# Gate summary: {doc.get('branch')} @ {doc.get('sha')}  ->  {head}", ""]
    wall = int(doc.get("wall_seconds", 0))
    target = int(doc.get("wall_target_min", 90))
    lines.append(f"tier {doc.get('tier')} | schedule {doc.get('schedule', 'v1')} | wall {wall // 60} min "
                 f"({'within' if wall <= target * 60 else 'OVER'} the {target} min target)"
                 + (f" | base {doc['base_ref']}" if doc.get("base_ref") else "") + (" | still running" if running else ""))
    lines += ["", "| class | count | does it block? |", "|---|---|---|",
              f"| NEW red (caused by this diff, or not shown to be old) | {len(new_red)} | YES |",
              f"| gate-level problems (crash, timeout, count drop, expired quarantine) | {len([i for i in new_red if i.get('category') in ('gate', 'baseline', 'quarantine', 'tsc', 'build', 'release_check')])} | YES (included above) |",
              f"| PRE-EXISTING (also failing on the base commit) | {len(by('PREEXISTING'))} | no (listed, ticket needed) |",
              f"| QUARANTINED (managed list, owner + expiry) | {len(by('QUARANTINED'))} | no (listed) |",
              f"| PIXEL REVIEW (screenshot differs, needs a person) | {len(by('PIXEL_REVIEW'))} | verdict becomes REVIEW |",
              f"| FLAKY (failed first, passed alone) | {n('flaky')} | no (counted across gates) |",
              f"| KNOWN (runner allowlist) | {n('known')} | no |",
              f"| passed / skipped | {n('pass')} / {n('skipped')} | |"]
    lines += ["", "## Reds that matter" + (" (none)" if not new_red else "")]
    for i in new_red[:25]:
        lines.append(f"- [{i['category']}] {_short(i['id'], 110)} - {_short(i.get('reason', ''), 120)}")
    if len(new_red) > 25:
        lines.append(f"- ... and {len(new_red) - 25} more, see the full report")
    if by("PREEXISTING"):
        lines += ["", "## Pre-existing (not this diff's fault; file or link a ticket)"]
        lines += [f"- [{i['category']}] {_short(i['id'], 100)} - {_short(i.get('reason', ''), 110)}" for i in by("PREEXISTING")[:15]]
    if by("QUARANTINED"):
        lines += ["", "## Quarantined failures (each has an owner, a ticket and an expiry)"]
        lines += [f"- [{i['category']}] {_short(i['id'], 100)} - {_short(i.get('reason', ''), 110)}" for i in by("QUARANTINED")[:15]]
    if by("PIXEL_REVIEW"):
        pr = by("PIXEL_REVIEW")
        lines += ["", f"## Pixel review lane: {len(pr)} screenshot difference(s)",
                  "Look at the images in the pixel_review folder next to the report, then:",
                  "`release_gate.py --resolve-review <report.json> --accept --by NAME --note TEXT` (intended; regenerate the baselines on the branch)",
                  "or `--reject` (a real regression: the verdict becomes FAIL)."]
        lines += [f"- {_short(i['id'], 120)}" for i in pr[:10]]
        if len(pr) > 10:
            lines.append(f"- ... and {len(pr) - 10} more")
    fl = by("FLAKY")
    if fl:
        lines += ["", f"## Flaky ({len(fl)}; the count after the name = gates in which it flaked)"]
        tests = (flaky_counts or {}).get("tests", {})
        for i in fl[:12]:
            lines.append(f"- [{i['category']}] {_short(i['id'], 100)} (x{tests.get(i['id'], {}).get('count', 1)})")
        if len(fl) > 12:
            lines.append(f"- ... and {len(fl) - 12} more")
    if doc.get("quarantine_unused"):
        lines += ["", "## Quarantine entries that did not fail in this run (remove them?)"]
        lines += [f"- {e}" for e in doc["quarantine_unused"][:10]]
    if doc.get("quarantine_new_in_branch"):
        lines += ["", "## Quarantine entries ADDED by the tested branch (the lead must read them)"]
        lines += [f"- {e}" for e in doc["quarantine_new_in_branch"][:10]]
    sel = doc.get("selection") or {}
    pol = doc.get("selection_policy") or ""
    if pol or sel:
        red = (sel.get("reduced") or {}) if isinstance(sel, dict) else {}
        lines += ["", "## Selection", f"- {pol or 'selection ran'}" + (f"; reduced: {', '.join(f'{k} {v}' for k, v in red.items())}" if red else "; full tier")]
    ph = sorted(doc.get("phases", []), key=lambda p: -p.get("seconds", 0))[:4]
    if ph:
        lines += ["", "slowest phases: " + ", ".join(f"{p['name']} {p['seconds'] // 60} min" for p in ph)]
    if doc.get("slow_tests"):
        lines += ["slowest tests: " + "; ".join(f"{_short(s['id'], 60)} {s['seconds']:.0f}s" for s in doc["slow_tests"][:5])]
    return "\n".join(lines) + "\n"
