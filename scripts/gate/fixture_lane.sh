#!/usr/bin/env bash
# Fixture lane for SmplWise Arx (GATE-FIXTURE-LANE-2530, docs/testing/GATE_LANES.md section 5): the Playwright specs that need a
# throwaway fixture backend (frontend/tests/fixtures/fixture_specs.json, the "gate": true specs), on their own, the way a tier-L
# release gate runs them. A tier-L gate already runs the same groups in its fixture phase / pool; this script is for a run WITHOUT
# a gate: proving a branch's fixture groups, re-running after a fix, or the specs a diff-selected gate left out.
#   fixture_lane.sh <branch> [--groups a,b] [--now]
#     --groups  only these groups of the JSON (GATE_FIXTURE_GROUPS); default every group with a "gate": true spec
#     --now     do not wait for a quiet machine (the lock rule below still applies)
# What it does:
#   1. waits (up to LANE_WAIT_SECS, default 3600) until no release gate holds ~/.smplwise-gate.lock; gives up with a "not run" line
#   2. takes ~/.smplwise-tests.lock SHARED (like the timing lane and run_remote.sh fixture; a gate or the nightly hold it exclusively)
#   3. runs the gate ENGINE (release_gate.py next to this script, or GATE_ENGINE=<path>) with GATE_LANE=fixture: its own worktree
#      ~/work/fxlane-<branch>, node modules + vite build, then every fixture group - its backend (none for "script": null) on free
#      ports with its own data dir, a vite preview proxying to it, its specs with the group's env, each failure retried alone
#      (FLAKY rule), `then` stages on the same data dir - GATE_FIXTURE_SLOTS (default 2) groups at a time; budget LANE_TOTAL_SECS
#      (default 3600)
#   4. report: ~/smplwise-results/fixture-lane/gate_<branch>_<sha>.{json,md} (never the gate's own gate_status.json)
# Exit: the engine's (0 = every fixture test that ran passed and at least one ran per Playwright process - since FIX-GATE-2570 an
# all-skipped process, an unreadable fixture_specs.json or a --groups list that matches no group is a FAIL; 1 = a failure); 0 when
# not run (busy machine). No real Home Assistant, WisKey, NVR, go2rtc or camera is reached: every fixture forces `.test` hosts and
# refuses to start inside the add-on.
# Install: copy next to release_gate.py on the runner (~/), INSTALL_ON_RUNNER.md; engine_sync.py maps it.
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
case "${1:-}" in -h|--help|"") sed -n 2,24p "$0"; exit 0;; esac
BR="$1"; shift
NOW=0; GROUPS_ARG=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --now) NOW=1; shift;;
    --groups) GROUPS_ARG="${2:?--groups needs a list}"; shift 2;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ENGINE="${GATE_ENGINE:-$DIR/release_gate.py}"
[ -f "$ENGINE" ] || { echo "fixture lane: no engine at $ENGINE"; exit 2; }
OUT="${GATE_RESULTS_DIR:-$HOME/smplwise-results/fixture-lane}"; mkdir -p "$OUT" "$HOME/work"
say() { echo "$(date '+%F %T') fixture lane $BR: $*"; }

if [ "$NOW" -eq 0 ]; then
  END=$((SECONDS + ${LANE_WAIT_SECS:-3600}))
  until flock -n "$HOME/.smplwise-gate.lock" true 2>/dev/null; do
    if [ "$SECONDS" -ge "$END" ]; then say "NOT RUN - a release gate held its lock"; exit 0; fi
    sleep 60
  done
fi
exec 8>"$HOME/.smplwise-tests.lock"
flock -s -w "${LANE_LOCK_WAIT:-900}" 8 || { say "NOT RUN - a gate/nightly held ~/.smplwise-tests.lock for ${LANE_LOCK_WAIT:-900}s"; exit 0; }
TOTAL="${LANE_TOTAL_SECS:-3600}"
say "start (engine $ENGINE, groups ${GROUPS_ARG:-all}, budget ${TOTAL}s)"
GATE_LANE=fixture GATE_RESULTS_DIR="$OUT" GATE_VISUAL=off GATE_TOTAL_SECS="$TOTAL" GATE_FIXTURE_GROUPS="$GROUPS_ARG" \
  timeout -k 30 "$TOTAL" python3 "$ENGINE" "$BR" --tier L --no-visual
RC=$?
say "done, engine rc=$RC; reports in $OUT"
exit "$RC"
