#!/usr/bin/env bash
# Release gate for SmplWise Arx: the whole tier-L check on the test machine, one command, one verdict.
#   release_gate.sh <branch> [--tier S|M|L] [--allow-count-drop "<reason>"]
#     (default tier L; the branch must be pushed: the machine sees origin only)
#     S  tsc + build + the unit-* specs + release_check
#     M  S + the whole backend suite + every Playwright spec on the dist preview (no dev-server / fixture / pixel groups)
#     L  everything (backend in 3 shards, preview, dev-server specs, fixture specs, pixel baselines, release_check)
#   (S and M are the reduced tiers of docs/release/TEST_POLICY.md only in spirit: S/M do not map changed files.)
# What it does (L):
#   1. own git worktree ~/work/gate-<branch> of origin/<branch> (never the nightly clone, never another agent's worktree)
#   2. backend: all tests/test_*.py in 3 parallel shards (size-balanced), running while tsc + build run
#   3. frontend: tsc, vite build, then the specs CLASSIFIED AUTOMATICALLY from their own header / source:
#        dev     specs that import '/src/...' or whose header says they need the Vite DEV server -> dev server, desktop
#                (plus the projects the header lists with --project=, and --workers=1 when the header says so)
#        one     header says "one project only" / "one project (desktop)" -> only that project
#        fixture specs that need a fake backend (FIXTURE_SPECS: evidence-camera-card = SW_LIVE=1 SW_DEVICES_FIXTURE=1 against
#                tests/fixtures/devices_fake_ha.py on a free port, its own empty data dir, torn down afterwards)
#        pixel   toHaveScreenshot specs: the 'pixel-stable' tests run only when a *-linux.png baseline exists, else SKIPPED_NO_BASELINE
#        rest    dist preview (vite preview on a free port), all three projects
#   4. RETRY: every failed test is re-run once alone (workers=1); passes on retry -> FLAKY (not a failure)
#   5. ~/known_issues.json allowlist: listed failures are KNOWN, not FAIL (a known test is not retried)
#   6. scripts/release_check.py from the worktree with the repo venv
#   7. FALSE-GREEN GUARDS (see release_gate.py): a Playwright/pytest process that crashed at load time, ran zero tests, timed out or
#      exited non-zero without a failed test is a FAIL; every category's passed count is compared with gate_baselines.json (the
#      previous accepted release) and below 70 percent (GATE_DROP_THRESHOLD) it is a FAIL unless --allow-count-drop "<reason>" is given
#   8. outputs: ~/smplwise-results/gate_<branch>_<sha>.{json,md} (Hebrew verdict header; per-category counts + baseline + ratio) and
#      gate_status.json (dashboard hook, updated at every phase); logs in gate_<branch>_<sha>.logs/
# After a GREEN gate of a release, refresh scripts/gate/gate_baselines.json from "baseline_candidate" in that gate's .json.
# One gate at a time (flock; it also holds the nightly lock, so cron's nightly/watcher skip meanwhile); total timeout 90 min
# (GATE_TOTAL_SECS to change). Never kills by name: only process groups this script started. Free ports only.
# Install: copy release_gate.sh, release_gate.py and gate_baselines.json to the same directory on the runner (~/ is the convention);
# see scripts/gate/INSTALL_ON_RUNNER.md. The self-test is scripts/gate/selftest_gate.py.
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
case "${1:-}" in -h|--help|"") sed -n 2,33p "$0"; exit 0;; esac
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
[ -f "$DIR/release_gate.py" ] || { echo "release_gate.py must sit next to release_gate.sh ($DIR)"; exit 2; }
mkdir -p "$HOME/smplwise-results" "$HOME/work"
exec 9>"$HOME/.smplwise-gate.lock"
flock -n 9 || { echo "another release gate is running"; exit 3; }
exec 8>"$HOME/.smplwise-tests.lock"
flock -n 8 || { echo "the nightly/manual test run holds ~/.smplwise-tests.lock"; exit 3; }
TOTAL="${GATE_TOTAL_SECS:-5400}"
exec timeout -k 30 "$TOTAL" python3 "$DIR/release_gate.py" "$@"
