"""Progress figures for the owner's reports: task cards with implementation evidence per phase and overall.

Counts a card as evidenced when its status is DONE or when one of its evidence lines carries an implementation
marker. An IN_PROGRESS status alone no longer counts (owner decision 2026-11-04): work in flight is not evidence. Markers are matched exactly, not as loose substrings (REGISTRY-AUDIT-20261103
follow-up, owner decision 2026-11-04): see MARKER_RULES and `evidence_line_marker`. Prints a Markdown table (Hebrew
labels) and a weighted estimate; the numbers are evidence-based, not acceptance.

    python scripts/progress.py          # table + estimate
    python scripts/progress.py --json   # machine readable
    python scripts/progress.py --cards  # one line per non-excluded card: id, phase, counted, basis
"""
from __future__ import annotations

import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TASKS = ROOT / "management" / "tasks.json"
PHASES = OrderedDict([("G0", "G0 (הכנה)"), ("PILOT", "Pilot"), ("BETA", "Beta"), ("V1", "V1"), ("V2", "V2"), ("V3", "V3")])
WEIGHTS = {"G0": 1.0, "PILOT": 3.0, "BETA": 1.5, "V1": 1.0, "V2": 0.5, "V3": 0.25}
# weights for the single-number estimate: what the owner cares about now is the pilot

# --- exact marker matching -------------------------------------------------------------------------------------------
# The old matcher tested `marker in line` for the plain strings "pre-evidence", "partial", "fix (", "lab ", "PASS",
# "design SW A" and "commit ". That counted a card on "SELFTEST PASSED", on "the lab server" inside a NOT_RUN line and
# on "no merge commit named after it", and it counted work that exists only on an unmerged branch. The rules are now:
#  - a marker is a whole token: never inside a longer word or a hyphenated identifier (WXD7 is not WXD7R, T06 is not
#    T061, PASS is not PASSED or BYPASS);
#  - "commit" / "commits" must be followed by a commit id (7-40 hex characters, so "no merge commit named after it"
#    is not evidence; a YYYYMMDD date is not an id), the form the registry audit writes ("commit <sha> (release X, on origin/main)");
#  - a commit id annotated "(<branch>, not on origin/main, not released)" is work in flight: it is not implementation
#    evidence on its own (a second id on the same line that is on origin/main does count; a status of IN_PROGRESS does not);
#  - "PASS" does not count when negated ("not PASS", "no PASS", "never PASS");
#  - a line that states what is missing (NOT_RUN, Not done, Not proven, Open:, ...) never counts, whatever words it
#    contains; "lab", "fix (", "pre-evidence" and "design SW A" count only as the first words of a line, the way
#    evidence lines are written ("lab (2026-09-15): ...").
_NB = r"(?<![\w-])"                                   # not preceded by a word character or a hyphen
SHA = r"(?!20[0-9]{6}(?![\w-]))[0-9a-f]{7,40}(?![\w-])"   # not a YYYYMMDD date
_COMMIT_WORD = re.compile(_NB + r"commits?\s+(?=" + SHA + ")")
_SHA_REF = re.compile("(" + SHA + r")(?:\s*\(([^)]*)\))?")
_SHA_SEP = re.compile(r"\s*[;,]?\s*(?:also\s+|and\s+)?(?=" + SHA + ")")
_NOT_ON_MAIN = re.compile(r"not on origin/main", re.IGNORECASE)
MARKER_RULES = OrderedDict([
    ("pre-evidence", re.compile(r"^\s*pre-evidence(?!\w)")),
    ("partial", re.compile(_NB + r"partial(?= [-(:])")),
    ("fix (", re.compile(r"^\s*fix \(")),
    ("lab", re.compile(r"^\s*lab(?=[ :(])")),
    ("PASS", re.compile(r"(?<![\w-])PASS(?!\w)")),
    ("design SW A", re.compile(r"^\s*design SW A(?!\w)")),
])
MARKERS = tuple(MARKER_RULES) + ("commit",)
# a line that opens with one of these says what is NOT proven or NOT done; its other words are not evidence
NEGATIVE_LINE = re.compile(r"^\s*(?:NOT_RUN|NOT RUN|Not done|Not proven|Not verified|NOT verified|Open(?!\w)|BLOCKED|Missing(?!\w))")


def commit_evidence(line: str) -> bool:
    """True when the line names a commit id right after "commit"/"commits" (or in the "also <id>" / "and <id>" list
    that continues it) and at least one of those ids is not annotated as in flight. Ids further along the line (base
    commits, the same in-flight id repeated in the prose) are not looked at."""
    m = _COMMIT_WORD.search(line)
    if not m:
        return False
    pos = m.end()
    while True:
        ref = _SHA_REF.match(line, pos)
        if not ref:
            return False
        if not (ref.group(2) and _NOT_ON_MAIN.search(ref.group(2))):
            return True
        sep = _SHA_SEP.match(line, ref.end())
        if not sep:
            return False
        pos = sep.end()


_NEGATED = re.compile(r"(?:^|[^\w-])(?:not|NOT|no|never)\s+$")


def _pass_evidence(line: str) -> bool:
    """A whole-word PASS that is not negated by the words right before it ("not PASS", "no PASS", "never PASS")."""
    return any(not _NEGATED.search(line[: m.start()]) for m in MARKER_RULES["PASS"].finditer(line))


def evidence_line_marker(line: str) -> str | None:
    """The marker an evidence line carries, or None. Exact matching, see the rules above."""
    if not isinstance(line, str) or NEGATIVE_LINE.match(line):
        return None
    for name, rx in MARKER_RULES.items():
        if name == "PASS":
            if _pass_evidence(line):
                return name
        elif rx.search(line):
            return name
    if commit_evidence(line):
        return "commit"
    return None


def evidence_basis(task: dict) -> str | None:
    """Why the card counts: "status:DONE", the marker of its first qualifying evidence line, or None."""
    if task.get("status") == "DONE":
        return "status:DONE"
    for line in task.get("evidence") or []:
        marker = evidence_line_marker(line)
        if marker:
            return "marker:" + marker
    return None


def has_evidence(task: dict) -> bool:
    return evidence_basis(task) is not None


def is_excluded(task: dict) -> bool:
    """An owner decision took the card out of scope (T003/T004, 2026-09-22): recorded as an "EXCLUDED - owner
    decision" evidence line and an "Excluded" blocker. Such a card leaves the denominator and is shown apart -
    it is neither evidenced nor open."""
    if str(task.get("blocker") or "").startswith("Excluded"):
        return True
    return any(isinstance(line, str) and line.startswith("EXCLUDED") for line in task.get("evidence") or [])


def compute() -> dict:
    tasks = json.loads(TASKS.read_text(encoding="utf-8"))
    per = {k: {"done": 0, "total": 0, "excluded": 0} for k in PHASES}
    for t in tasks:
        ph = str(t.get("phase", "")).upper()
        if ph not in per:
            continue
        if is_excluded(t):
            per[ph]["excluded"] += 1
            continue
        per[ph]["total"] += 1
        if has_evidence(t):
            per[ph]["done"] += 1
    total_done = sum(v["done"] for v in per.values())
    total = sum(v["total"] for v in per.values())
    excluded = sum(v["excluded"] for v in per.values())
    wsum = sum(WEIGHTS[k] * v["total"] for k, v in per.items())
    wdone = sum(WEIGHTS[k] * v["done"] for k, v in per.items())
    return {
        "phases": {k: {**v, "pct": round(100 * v["done"] / v["total"]) if v["total"] else 0} for k, v in per.items()},
        "overall": {"done": total_done, "total": total, "excluded": excluded, "pct": round(100 * total_done / total) if total else 0},
        "weighted_pct": round(100 * wdone / wsum) if wsum else 0,
    }


def cell(v: dict) -> str:
    base = f"{v['done']} מתוך {v['total']}"
    return f"{base} (+{v['excluded']} הוחרגו בהחלטת הבעלים)" if v.get("excluded") else base


def main() -> None:
    r = compute()
    if "--cards" in sys.argv:
        sys.stdout.reconfigure(encoding="utf-8")
        for t in json.loads(TASKS.read_text(encoding="utf-8")):
            if is_excluded(t) or str(t.get("phase", "")).upper() not in PHASES:
                continue
            basis = evidence_basis(t)
            print(f"{t['id']}	{t.get('phase')}	{t.get('status')}	{'counted' if basis else 'open'}	{basis or '-'}")
        return
    if "--json" in sys.argv:
        print(json.dumps(r, ensure_ascii=False, indent=1))
        return
    sys.stdout.reconfigure(encoding="utf-8")
    print("| שלב | כרטיסים עם ראיות | אחוז |")
    print("|---|---|---|")
    for k, label in PHASES.items():
        v = r["phases"][k]
        print(f"| {label} | {cell(v)} | {v['pct']}% |")
    o = r["overall"]
    print(f"| **סה\"כ** | **{cell(o)}** | **{o['pct']}%** |")
    print()
    print(f"הערכה משוקללת (פיילוט במשקל גבוה): {r['weighted_pct']}%. ראיות מימוש ≠ קבלה: הכרטיסים נשארים BACKLOG עד סגירת שערי G0 ובדיקת הבעלים.")


if __name__ == "__main__":
    main()
