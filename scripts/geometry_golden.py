"""Regenerate contracts/fixtures/plan_geometry/sample-v2.primitives.json from sample-v2.json with the backend renderer.
Run it after an intentional change to the primitives; frontend/tests/unit-geometry.spec.ts compares its own output with
this file, so the map and the exports keep drawing the same shapes. `--check` exits 1 when the file is stale."""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))

from smplwise.services import plan_geometry_render as render  # noqa: E402

FIX = ROOT / "contracts" / "fixtures" / "plan_geometry"


def main() -> int:
    doc = json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))
    out = {"width": 1000, "height": 800, "all": render.structure_primitives(doc, 1000, 800), "level_L1": render.structure_primitives(doc, 1000, 800, "L1")}
    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    target = FIX / "sample-v2.primitives.json"
    if "--check" in sys.argv:
        if target.exists() and target.read_text(encoding="utf-8") == text:
            return 0
        print(f"stale: {target.relative_to(ROOT)} - run scripts/geometry_golden.py to regenerate")
        return 1
    target.write_text(text, encoding="utf-8", newline="\n")
    print(f"written {target.relative_to(ROOT)}: {len(out['all'])} primitives")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
