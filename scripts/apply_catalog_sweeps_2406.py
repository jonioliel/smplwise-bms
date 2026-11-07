"""CATALOG-APPLY-2406: apply the COVERED receipts of CATALOG-SWEEP-A/B/C-2406 to management/test_catalog.json.

Only entries still NOT_RUN change. Each becomes PASS with the receipts the sweep recorded: the runner nightly (tier L, main
@ eab715e53, 2026-11-06) and the test files / test ids that prove it. LAB, OWNER, PARTLY, MISSING, TODO and BLOCKED-WISKEY
entries are left as they are. Re-running is a no-op.

    python scripts/apply_catalog_sweeps_2406.py [--dry-run]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "management" / "test_catalog.json"
RECEIPTS = ROOT / "docs" / "changes" / "receipts"
NIGHTLY_SHA = "eab715e53"
NIGHTLY_REPORT = "runner:~/smplwise-results/nightly/gate_main_eab715e53.md"
ENVIRONMENT = "Runner nightly, tier L, main @ eab715e53 (2026-11-06 02:00-04:08 UTC, PASS in 127m; Ubuntu runner, fakes only, no lab device)"


def _tests_text(tests: list) -> str:
    parts = []
    for t in tests:
        if isinstance(t, str):
            parts.append(t)
        elif isinstance(t, dict):
            n = t.get("nightly") or {}
            parts.append(f"{t.get('file')} (nightly {n.get('pass', '?')} passed / {n.get('fail', '?')} failed)" if n else str(t.get("file")))
    return "; ".join(parts)


def covered() -> dict[str, tuple[str, str]]:
    """id -> (sweep, evidence text)."""
    out: dict[str, tuple[str, str]] = {}
    for sweep, name in (("A", "CATALOG-SWEEP-A-2406"), ("B", "CATALOG-SWEEP-B-2406"), ("B2", "CATALOG-SWEEP-B2-2407")):
        path = RECEIPTS / f"{name}.json"
        if not path.is_file():
            continue
        for e in json.loads(path.read_text(encoding="utf-8")):
            if e.get("class") == "COVERED":
                out[e["id"]] = (name, f"{_tests_text(e.get('tests') or [])}. {e.get('note') or ''}".strip())
    c = json.loads((RECEIPTS / "CATALOG-SWEEP-C-2406.json").read_text(encoding="utf-8"))
    for e in c["entries"]:
        if e.get("class") == "COVERED-AUTO":
            rec = "; ".join(f"{r.get('kind')}: {r.get('report') or r.get('tag') or r.get('file') or json.dumps(r, ensure_ascii=False)}{' ' + r['verdict'] if r.get('verdict') else ''}" for r in (e.get("receipts") or []))
            out[e["id"]] = ("CATALOG-SWEEP-C-2406", f"{rec}. {e.get('reason') or ''}".strip())
    return out


def main(argv: list[str]) -> int:
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    cov = covered()
    changed = skipped = 0
    for t in cat:
        hit = cov.get(t["id"])
        if not hit:
            continue
        if t.get("status") != "NOT_RUN":
            skipped += 1
            continue
        sweep, ev = hit
        t["status"] = "PASS"
        t["commit"] = NIGHTLY_SHA
        t["environment"] = ENVIRONMENT
        t["evidence"] = f"{sweep} receipts (docs/changes/receipts/{sweep}.json), {NIGHTLY_REPORT}: {ev}"[:1800]
        t["executed_at"] = "2026-11-06"
        note = f"2026-11-07 (CATALOG-APPLY-2406): COVERED by automated tests in the nightly, classified by {sweep}; nothing run against the lab."
        t["notes"] = f"{t['notes']} | {note}" if t.get("notes") else note
        changed += 1
    missing = sorted(set(cov) - {t["id"] for t in cat})
    print(f"covered receipts {len(cov)} | set PASS {changed} | already not NOT_RUN {skipped} | ids not in catalog {len(missing)} {missing[:5]}")
    if "--dry-run" not in argv[1:]:
        CATALOG.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
