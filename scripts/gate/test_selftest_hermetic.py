#!/usr/bin/env python3
"""Proves selftest_gate_fast.py is hermetic: the same result with a clean machine and with a polluted one
(a HOME with a real-looking ~/smplwise-results, a fast-gate flag, GATE_* knobs in the environment, and a different
seed-budget file next to the script). Only fake data, no runner, no network.
  python scripts/gate/test_selftest_hermetic.py      (exit 0 = hermetic)
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run(work: Path, home: Path, extra_env: dict, polluted_seed: bool):
    g = work / "gate"
    shutil.copytree(HERE, g, ignore=shutil.ignore_patterns("__pycache__"))
    if polluted_seed:
        (g / "gate_phase_budgets.json").write_text("{}", encoding="utf-8")      # the runner's stale/empty copy
    env = {k: v for k, v in os.environ.items() if not k.startswith("GATE_")}
    env.update({"HOME": str(home), "USERPROFILE": str(home), **extra_env})
    p = subprocess.run([sys.executable, str(g / "selftest_gate_fast.py")], env=env, capture_output=True, text=True, timeout=600)
    return p.returncode, [l for l in p.stdout.splitlines() if l.startswith(("OK", "BROKEN", "SELFTEST"))], p.stderr[-400:]


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="hermetic_check_"))
    try:
        clean = tmp / "clean_home"
        clean.mkdir()
        dirty = tmp / "dirty_home"
        res = dirty / "smplwise-results"
        res.mkdir(parents=True)
        # a real-looking passed report with unrelated phases, a nightly dir, a fast-gate flag, a holder file
        (res / "gate_main_zzz9999.json").write_text(json.dumps({"verdict": "pass", "tier": "L", "finished": "2099-01-01T00:00:00+0000",
            "phases": [{"name": "tsc", "seconds": 1}], "selection": {"reduced": {"x": "1 of 2"}}}), encoding="utf-8")
        (res / "nightly").mkdir()
        (res / "nightly" / "gate_main_n.json").write_text(json.dumps({"verdict": "fail", "finished": "2099-01-01T00:00:00+0000", "items": []}), encoding="utf-8")
        (dirty / ".gate_fast_enabled").write_text("on", encoding="utf-8")
        (dirty / ".smplwise-machine-holder.json").write_text(json.dumps({"kind": "gate", "pid": os.getpid()}), encoding="utf-8")
        knobs = {"GATE_RESULTS_DIR": str(res), "GATE_HOME": str(dirty), "GATE_BUDGET_MARGIN": "9", "GATE_TOTAL_SECS": "1",
                 "GATE_EARLY_LAYOUT": "0", "GATE_SCHEDULE": "v2", "GATE_FAST_FLAG": str(dirty / ".gate_fast_enabled"),
                 "GATE_HOLDER_FILE": str(dirty / ".smplwise-machine-holder.json"), "GATE_CAP_MIN": "1"}
        a = run(tmp / "a", clean, {}, False)
        b = run(tmp / "b", dirty, knobs, True)
        for name, r in (("clean", a), ("polluted", b)):
            print(f"{name}: rc={r[0]} {r[1][-1] if r[1] else r[2]}")
        ok = a[0] == 0 and b[0] == 0 and a[1] == b[1]
        print("HERMETIC" if ok else "NOT HERMETIC")
        return 0 if ok else 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
