"""Run the Plan Studio detection metrics on private scans (T086, ruling 1): real plans stay in private-evidence/ and
never enter the repository; this script scores them with the same harness as the committed synthetic set and prints
numbers only (names of the plan files, no paths, no pictures, no error messages), for the release evidence.

    python scripts/plan_detect_private.py                      # private-evidence/plan_detect/
    python scripts/plan_detect_private.py <folder>             # any folder of <name>.png + <name>.json ground truth
    python scripts/plan_detect_private.py --anon [<folder>]    # plan-1, plan-2 ... instead of the file names

A folder without plans (or absent) prints "skipped: no private plans", one whose pictures have no ground truth prints
"skipped: no scored plans (N pictures without ground truth)"; both exit 0, so the release checklist can run it on any
workstation. A plan the detector fails on prints "<name>: error <exception type>" and the others still run; a folder
that cannot be read prints "error <exception type> reading the plans" and exits 1. Pictures without ground truth
next to scored plans are counted on an "unscored:" line."""
from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend" / "tests"))


def _row(pm: Any, detect: Any, name: str, gt: dict[str, Any], png: bytes, calibrated: bool) -> dict[str, Any]:
    """One plan scored as plan_detect_metrics.run_set scores it."""
    t0 = time.perf_counter()
    result = detect(png, scale_m_per_px=gt["scale_m_per_px"] if calibrated else None)
    ms = int((time.perf_counter() - t0) * 1000)
    return {"name": name, "ms": ms, **pm.evaluate(gt, result, pm.TOLERANCE_PX.get(name, 10.0)), "hint": result.get("calibration_hint"), "counts": {"walls": len(result["walls"]), "openings": len(result["openings"])}}


def main(argv: list[str]) -> int:
    import plan_detect_metrics as pm  # noqa: E402 - after the path setup
    from smplwise.services import plan_detect as pd  # noqa: E402

    args = [a for a in argv[1:] if a != "--anon"]
    anon = "--anon" in argv[1:]
    folder = Path(args[0]) if args else ROOT / "private-evidence" / "plan_detect"
    try:  # inside the try: an OSError message would hold the path
        pictures = sorted(folder.glob("*.png")) if folder.is_dir() else []
        plans = pm.load_set(folder) if pictures else []
    except Exception as exc:  # noqa: BLE001 - the type only, never the message
        print(f"error {type(exc).__name__} reading the plans")
        return 1
    if not pictures:
        print("skipped: no private plans")
        return 0
    if not plans:
        print(f"skipped: no scored plans ({len(pictures)} pictures without ground truth)")
        return 0
    rows: list[dict[str, Any]] = []
    uncal: list[dict[str, Any]] = []
    for k, (stem, gt, png) in enumerate(plans, 1):
        name = f"plan-{k}" if anon else stem
        try:
            r = _row(pm, pd.detect, name, gt, png, True)
            uncal.append(_row(pm, pd.detect, name, gt, png, False))
        except Exception as exc:  # noqa: BLE001 - one broken plan must not stop the evidence run; the type only (a message may hold a path)
            print(f"{name}: error {type(exc).__name__}")
            continue
        rows.append(r)
        print(f"{name}: walls recall {r['walls']['recall']:.3f} precision {r['walls']['precision']:.3f}; doors {r['doors']['found']}/{r['doors']['total']} "
              f"(as doors {r['doors']['kind_recall']:.2f}, false {r['doors']['false']}); windows {r['windows']['found']}/{r['windows']['total']} (false {r['windows']['false']}); {r['ms']} ms")
    print(pm.summary_line(rows))
    if len(pictures) > len(plans):
        print(f"unscored: {len(pictures) - len(plans)} pictures without ground truth")
    hints = [r for r in uncal if r["hint"]]
    print(f"uncalibrated: {len(hints)}/{len(uncal)} plans offered a door-width hint")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
