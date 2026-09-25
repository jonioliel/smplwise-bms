"""Run the Plan Studio detection metrics on private scans (T086, ruling 1): real plans stay in private-evidence/ and
never enter the repository; this script scores them with the same harness as the committed synthetic set and prints
numbers only (names of the plan files, no paths, no pictures), for the release evidence.

    python scripts/plan_detect_private.py                      # private-evidence/plan_detect/
    python scripts/plan_detect_private.py <folder>             # any folder of <name>.png + <name>.json ground truth

A folder without plans (or absent) prints "skipped: no private plans" and exits 0, so the release checklist can run it
on any workstation."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests"))


def main(argv: list[str]) -> int:
    import plan_detect_metrics as pm  # noqa: E402 - after the path setup
    from smplwise.services import plan_detect as pd  # noqa: E402

    folder = Path(argv[1]) if len(argv) > 1 else ROOT / "private-evidence" / "plan_detect"
    if not folder.is_dir() or not pm.load_set(folder):
        print("skipped: no private plans")
        return 0
    rows = pm.run_set(pd.detect, folder)
    for r in rows:
        print(f"{r['name']}: walls recall {r['walls']['recall']:.3f} precision {r['walls']['precision']:.3f}; doors {r['doors']['found']}/{r['doors']['total']} "
              f"(as doors {r['doors']['kind_recall']:.2f}, false {r['doors']['false']}); windows {r['windows']['found']}/{r['windows']['total']} (false {r['windows']['false']}); {r['ms']} ms")
    print(pm.summary_line(rows))
    uncal = pm.run_set(pd.detect, folder, calibrated=False)
    hints = [r for r in uncal if r["hint"]]
    print(f"uncalibrated: {len(hints)}/{len(uncal)} plans offered a door-width hint")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
