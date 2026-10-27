"""Gate v2 shim (GATE2-295). Installed as ~/gate2/select_tests.py next to an unchanged copy of release_gate.py.

The engine's --select-base path does `import select_tests; select_tests.select_diff(worktree, base, "HEAD")` from its own
directory. In ~/gate2/ that import lands here and returns the gate-2 selection (gate2_select.select_gate2) in the same JSON
shape, so the engine itself is not modified: same classification, pool, retries, false-green guards and reports as v1/v2.
The v1 helper sits next to it as select_tests_v1.py (gate2_select imports that one).

Environment (set by release_gate2.sh):
  GATE2_AFTER_REPORT  a red gate report (.json): its failed tests' files are added (the targeted re-run)
  GATE2_RERUN_ONLY=1  with GATE2_AFTER_REPORT: ONLY those files (no core, no mapping) - the automatic quarantine re-run
  GATE2_COSTS         the cost seed (default gate2_costs.json next to gate2_select.py)
  GATE2_HEAVY_SECS, GATE2_DEFER_HEAVY, GATE2_CLOSURE_DEPTH  see gate2_select.py
An exception here makes the engine run the full tier and say so in its report (compute_selection's error path).
"""
import os
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
for _p in (_HERE, _HERE.parent):          # ~/gate2/ on the runner; scripts/gate/ in the repository
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import gate2_select as _g2  # noqa: E402


def select_diff(root, base, head="HEAD"):
    after = None
    rep = os.environ.get("GATE2_AFTER_REPORT") or ""
    if rep:
        after = _g2.failed_files(Path(rep))
    costs = _g2.load_costs(Path(os.environ["GATE2_COSTS"]) if os.environ.get("GATE2_COSTS") else None)
    if after is not None and os.environ.get("GATE2_RERUN_ONLY") == "1":
        return _g2.rerun_only_selection(Path(root), after)
    return _g2.select_gate2(Path(root), base, head, after=after, costs=costs)
