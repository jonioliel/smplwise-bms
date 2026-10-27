#!/usr/bin/env bash
# Timing lane for SmplWise Arx (GATELANES-297, docs/testing/GATE_LANES.md): the wall-clock / load-sensitive tests that the release
# gate leaves out (Playwright tag '@timing-lane', pytest mark timing_lane), run when the test machine is QUIET. NON-BLOCKING: the
# verdict is a report in ~/smplwise-results/timing-lane/, this script always exits 0 after a run, and nothing here changes a gate.
#   timing_lane.sh <branch> [--now]
#     --now   do not wait for a quiet machine (a manual run; the lock rule below still applies)
# What it does:
#   1. waits (up to LANE_WAIT_SECS, default 14400 = 4 h) until no release gate holds ~/.smplwise-gate.lock AND the 1-minute load
#      average is under LANE_MAX_LOAD (default: half the CPUs); gives up with a "not run" line otherwise (exit 0)
#   2. takes ~/.smplwise-tests.lock SHARED (like run_remote.sh visual / fixture jobs; a gate or the nightly hold it exclusively),
#      waiting up to LANE_LOCK_WAIT s (900)
#   3. runs the gate ENGINE (release_gate.py next to this script) with GATE_LANE=timing: its own worktree ~/work/lane-<branch>,
#      tsc + build, then only the tagged Playwright tests (dist preview / dev server by the same classification) and only the marked
#      backend tests, each failure retried alone (FLAKY rule) - budget LANE_TOTAL_SECS (default 2700 = 45 min)
#   4. report: ~/smplwise-results/timing-lane/gate_<branch>_<sha>.{json,md}; the last run's output in timing-lane/lane_last.log
# Started by release_gate.sh in the background after every gate (GATE_TIMING_LANE=off switches that off); by hand for a branch:
#   nohup ~/timing_lane.sh <branch> >/dev/null 2>&1 &
# Install: copy next to release_gate.sh / release_gate.py on the runner (~/ is the convention; INSTALL_ON_RUNNER.md).
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
case "${1:-}" in -h|--help|"") sed -n 2,20p "$0"; exit 0;; esac
BR="$1"; shift
NOW=0; for a in "$@"; do [ "$a" = "--now" ] && NOW=1; done
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
[ -f "$DIR/release_gate.py" ] || { echo "timing lane: release_gate.py must sit next to timing_lane.sh ($DIR)"; exit 2; }
OUT="$HOME/smplwise-results/timing-lane"; mkdir -p "$OUT" "$HOME/work"
MAX_LOAD="${LANE_MAX_LOAD:-$(( $(nproc) / 2 ))}"
WAIT="${LANE_WAIT_SECS:-14400}"
say() { echo "$(date '+%F %T') timing lane $BR: $*"; }

quiet() {   # no release gate running and the 1-minute load under the limit
  flock -n "$HOME/.smplwise-gate.lock" true 2>/dev/null || return 1
  awk -v m="$MAX_LOAD" '{ exit !($1 < m) }' /proc/loadavg
}
if [ "$NOW" -eq 0 ]; then
  END=$((SECONDS + WAIT))
  until quiet; do
    if [ "$SECONDS" -ge "$END" ]; then say "NOT RUN - the machine was not quiet for ${WAIT}s (load limit $MAX_LOAD, or a gate held its lock)"; exit 0; fi
    sleep 60
  done
fi
exec 8>"$HOME/.smplwise-tests.lock"
flock -s -w "${LANE_LOCK_WAIT:-900}" 8 || { say "NOT RUN - a gate/nightly held ~/.smplwise-tests.lock for ${LANE_LOCK_WAIT:-900}s"; exit 0; }
say "start (load $(cut -d' ' -f1 /proc/loadavg), limit $MAX_LOAD)"
TOTAL="${LANE_TOTAL_SECS:-2700}"
GATE_LANE=timing GATE_RESULTS_DIR="$OUT" GATE_VISUAL=off GATE_TOTAL_SECS="$TOTAL" \
  timeout -k 30 "$TOTAL" python3 "$DIR/release_gate.py" "$BR" --tier L --no-visual
RC=$?
say "done, engine rc=$RC ($([ "$RC" -eq 0 ] && echo PASS || echo 'FAIL - see the report; NON-BLOCKING')); reports in $OUT"
exit 0
