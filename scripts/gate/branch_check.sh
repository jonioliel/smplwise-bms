#!/usr/bin/env bash
# ENTRY CHECK (ENTRY-CHECK-2310): may this branch board a release train?  Owner decision 30.10 night: no branch boards a train without
# a GREEN entry check = the change-based selection run of the branch against origin/main (~20-40 min, queued).
#   branch_check.sh <branch> [--max-wait SECS] [--dry-run]
#     <branch>     a PUSHED branch (the runner sees origin only), e.g. pilot/T123-foo; not main
#     --max-wait   how long to wait in the queue for the tests lock (default ENTRY_LOCK_WAIT or 43200 s = 12 h; 0 = no limit)
#     --dry-run    print the selection and the estimate only (release_gate2.sh --dry-run --base origin/main): no lock, no test
# It is NOT a release gate: it does not need ~/.gate_fast_enabled, it ignores the nightly state (printed for information only), it
# never touches the release gates' gate_status.json, and it does not tag or release anything.
# What a real run does (the engine and the selection are the release gate's own; nothing is forked):
#   1. waits (queues) for ~/.smplwise-tests.lock - it never fails because the machine is busy; it yields to a pending release gate
#      (~/.gate-pending) and a pending nightly (~/.nightly-pending); ~/smplwise-results/entry_status.json says "queued" meanwhile
#   2. holds the machine (gate_holder.py kind "entry": agent test runs through run_guarded.sh are refused while it runs)
#   3. stages the engine into this directory exactly like release_gate2.sh (release_gate.py + aux files from ~/, select_tests.py
#      as select_tests_v1.py; this directory's select_tests.py is the gate-2 shim)
#   4. runs release_gate.py <branch> --tier L --schedule v2 --select-base origin/main --no-visual with GATE_SELECT_ENABLE=1 and
#      GATE_RESULTS_DIR=~/smplwise-results/entry (the engine's full report: entry/gate_<b>_<sha>.{md,json,logs})
#   5. branch_check.py writes ~/smplwise-results/entry_<b>_<sha>.md (short, Hebrew + English) and entry_<b>_<sha>.json
# Verdict: GREEN (engine pass, or red only through ACTIVE quarantine entries) -> exit 0; RED or NOT_RUN -> exit 1; usage -> 2.
# Limit (GATE-SPEED-2320): ENTRY_TOTAL_SECS wins; else max(derived cap, plan ESTIMATE high x 1.25) - gate_budget.py limit.
# Install: scripts/gate/README_GATE_FAST.md ("Entry check"). Env: ENTRY_TOTAL_SECS (engine limit), ENTRY_LOCK_SLICE (poll, 30 s),
# GATE2_PYTHON, GATE2_REPO, GATE2_V1_DIR, GATE_RESULTS_DIR (the base results dir), ENTRY_SKIP_PLAN=1 (no shard/slot planning).
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:$PATH:/usr/local/bin:/usr/bin:/bin"
case "${1:-}" in -h|--help|"") sed -n 2,23p "$0"; exit 0;; esac
G="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
PY3="${GATE2_PYTHON:-python3}"
REPO="${GATE2_REPO:-$HOME/smplwisebms}"
V1="${GATE2_V1_DIR:-$HOME}"
RES="${GATE_RESULTS_DIR:-$HOME/smplwise-results}"
ERES="$RES/entry"
BASE="origin/main"
MAXW="${ENTRY_LOCK_WAIT:-43200}"
SLICE="${ENTRY_LOCK_SLICE:-30}"
BR="" DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --max-wait) MAXW="${2:-}"; shift 2;;
    --dry-run) DRY=1; shift;;
    -*) echo "unknown option $1 (see --help)"; exit 2;;
    *) BR="$1"; shift;;
  esac
done
[ -n "$BR" ] || { echo "usage: branch_check.sh <branch> [--max-wait SECS] [--dry-run]"; exit 2; }
BR="${BR#origin/}"
case "$BR" in main|HEAD) echo "branch_check: '$BR' is the base itself (the check compares a branch against origin/main)"; exit 2;; esac
case "$MAXW" in ''|*[!0-9]*) echo "--max-wait needs seconds"; exit 2;; esac
for f in branch_check.py gate2_verdict.py gate2_select.py; do
  [ -f "$G/$f" ] || { echo "$f must sit next to $0 ($G)"; exit 2; }
done
TAG="$(printf %s "$BR" | sed 's/[^A-Za-z0-9._-]/-/g')"
T0=$(date +%s)
STARTED="$(date -Iseconds 2>/dev/null || date)"
mkdir -p "$RES" "$ERES" "$HOME/work"

git -C "$REPO" fetch -q --prune origin 2>/dev/null || echo "branch_check: git fetch failed; using the refs already fetched"
git -C "$REPO" rev-parse --verify -q "origin/$BR^{commit}" >/dev/null || { echo "branch_check: origin/$BR not found (push the branch first)"; exit 1; }
git -C "$REPO" rev-parse --verify -q "$BASE^{commit}" >/dev/null || { echo "branch_check: $BASE not found in $REPO"; exit 1; }
SHA0="$(git -C "$REPO" rev-parse --short "origin/$BR")"

if [ "$DRY" = 1 ]; then
  [ -x "$G/release_gate2.sh" ] || [ -f "$G/release_gate2.sh" ] || { echo "release_gate2.sh must sit next to $0 for --dry-run"; exit 2; }
  exec bash "$G/release_gate2.sh" "$BR" --base "$BASE" --dry-run
fi

verdict() {   # $1 = engine report (may not exist), $2 = sha, $3 = why (used when there is no report)
  "$PY3" "$G/branch_check.py" verdict --report "$1" --branch "$BR" --sha "$2" --base "$BASE" --base-sha "${BASE_SHA:-}" \
    --out-dir "$RES" --quarantine "$G/gate2_quarantine.json" --waited-s "${WAITED:-0}" --started "$STARTED" \
    --nightly-results "$RES" --why "$3"
  local rc=$?
  printf '{"state":"done","branch":"%s","sha":"%s","exit":%s,"time":"%s"}\n' "$BR" "$2" "$rc" "$(date -Iseconds 2>/dev/null || date)" > "$RES/entry_status.json"
  [ "$rc" = 0 ] && return 0 || return 1
}

# ------------------------------------------------------------------ 1. the queue: wait for the shared tests lock, never fail on busy
exec 8>"$HOME/.smplwise-tests.lock"
WAITED=0 LASTLOG=-1
while :; do
  PENDING=""
  [ -n "$(find "$HOME/.gate-pending" -mmin -240 2>/dev/null)" ] && PENDING="a release gate"
  [ -z "$PENDING" ] && [ -n "$(find "$HOME/.nightly-pending" -mmin -240 2>/dev/null)" ] && PENDING="the nightly"
  if [ -z "$PENDING" ] && flock -w "$SLICE" 8; then break; fi
  [ -n "$PENDING" ] && sleep "$SLICE"
  WAITED=$(( $(date +%s) - T0 ))
  if [ "$LASTLOG" -lt 0 ] || [ $(( WAITED - LASTLOG )) -ge 600 ]; then
    echo "branch_check: queued for the tests lock (${WAITED} s so far${PENDING:+, $PENDING goes first}); waiting, not failing"
    printf '{"state":"queued","branch":"%s","sha":"%s","since":"%s","waited_s":%s}\n' "$BR" "$SHA0" "$STARTED" "$WAITED" > "$RES/entry_status.json"
    LASTLOG=$WAITED
  fi
  if [ "$MAXW" -gt 0 ] && [ "$WAITED" -ge "$MAXW" ]; then
    verdict "$ERES/none.json" "$SHA0" "queue limit reached: waited ${WAITED} s for the tests lock (--max-wait $MAXW); nothing ran"
    exit 1
  fi
done
WAITED=$(( $(date +%s) - T0 ))
echo "branch_check: got the tests lock after ${WAITED} s"
printf '{"state":"running","branch":"%s","sha":"%s","since":"%s","waited_s":%s}\n' "$BR" "$SHA0" "$(date -Iseconds 2>/dev/null || date)" "$WAITED" > "$RES/entry_status.json"

# ------------------------------------------------------------------ 2. hold the machine
[ -f "$G/gate_holder.py" ] && "$PY3" "$G/gate_holder.py" claim --kind entry --who "entry check $BR" --what "branch_check.sh $BR" --pid $$ >/dev/null 2>&1
trap '[ -f "$G/gate_holder.py" ] && "$PY3" "$G/gate_holder.py" release --pid $$ >/dev/null 2>&1' EXIT

# ------------------------------------------------------------------ 3. stage the engine (the same copy release_gate2.sh makes)
for f in release_gate.py select_tests.py; do
  [ -f "$V1/$f" ] || { verdict "$ERES/none.json" "$SHA0" "the v1 gate is not installed in $V1 ($f missing)"; exit 1; }
done
if [ "$(readlink -f "$V1")" != "$G" ]; then
  cp -p "$V1/release_gate.py" "$G/release_gate.py"
  cp -p "$V1/select_tests.py" "$G/select_tests_v1.py"
  for f in gate_baselines.json gate_durations.json gate_budget.py gate_phase_budgets.json gate_early_layout.json; do [ -f "$V1/$f" ] && cp -p "$V1/$f" "$G/$f"; done
fi
grep -q "gate2_select" "$G/select_tests.py" 2>/dev/null || { verdict "$ERES/none.json" "$SHA0" "$G/select_tests.py is not the gate-2 shim (install step)"; exit 1; }

# ------------------------------------------------------------------ 4. the engine's worktree, the plan, the run
WT="$HOME/work/gate-$TAG"          # the engine's own path for this branch; release gates need the same tests lock, so no overlap
if [ ! -e "$WT/.git" ]; then
  git -C "$REPO" worktree prune
  git -C "$REPO" worktree add --detach -f -q "$WT" "origin/$BR" || { verdict "$ERES/none.json" "$SHA0" "git worktree add failed"; exit 1; }
else
  git -C "$WT" checkout -q -f --detach "origin/$BR" || { verdict "$ERES/none.json" "$SHA0" "git checkout in $WT failed"; exit 1; }
fi
SHA="$(git -C "$WT" rev-parse --short HEAD)"
BASE_SHA="$(git -C "$WT" rev-parse --short "$(git -C "$WT" merge-base HEAD "$BASE" 2>/dev/null || echo "$BASE")" 2>/dev/null)"
if [ "${ENTRY_SKIP_PLAN:-0}" != 1 ]; then
  PLAN="$(nice -n 10 "$PY3" "$G/gate2_select.py" plan --root "$WT" --base "$BASE" --head HEAD 2>&1)"
  printf '%s\n' "$PLAN" | sed -n '/^GATE2 dry-run/,/ESTIMATE/p' | head -30
  KN="$(printf '%s\n' "$PLAN" | sed -n 's/.*knobs for this run: GATE_BACKEND_SHARDS=\([0-9]*\) GATE_PW_SLOTS=\([0-9]*\).*/\1 \2/p')"
  if [ -n "$KN" ]; then
    : "${GATE_BACKEND_SHARDS:=${KN% *}}"; : "${GATE_PW_SLOTS:=${KN#* }}"
    export GATE_BACKEND_SHARDS GATE_PW_SLOTS
  fi
fi
# GATE-SPEED-2320: limit = max(derived cap, the plan's ESTIMATE high x 1.25), never below the estimate; full-mode budgets when the selection runs
# a side FULL; an explicit ENTRY_TOTAL_SECS wins. Older gate_budget.py without `limit`: the derived select cap, else 5400 s.
TOTAL="$(printf '%s\n' "${PLAN:-}" | "$PY3" "$G/gate_budget.py" limit --results "$RES" --mode select --plan - --fallback 5400 \
         --explicit "${ENTRY_TOTAL_SECS:-}" --explain)" && [ -n "$TOTAL" ] || {
  CAP="$("$PY3" "$G/gate_budget.py" cap --results "$RES" --mode select 2>/dev/null)" || CAP=""
  TOTAL="${ENTRY_TOTAL_SECS:-${CAP:-5400}}"
}
R="$ERES/gate_${TAG}_${SHA}"
for e in json md selection.json; do [ -e "$R.$e" ] && mv -f "$R.$e" "$R.prev.$e"; done
[ -d "$R.logs" ] && { rm -rf "$R.prev.logs"; mv "$R.logs" "$R.prev.logs"; }
export GATE_RESULTS_DIR="$ERES" GATE_COSTS_DIR="$RES" GATE_SELECT_ENABLE=1 GATE_SCHEDULE=v2 GATE_TOTAL_SECS="$TOTAL" \
       GATE2_COSTS="${GATE2_COSTS:-$G/gate2_costs.json}"
echo "branch_check: $BR @ $SHA vs $BASE ($BASE_SHA), shards=${GATE_BACKEND_SHARDS:-default} slots=${GATE_PW_SLOTS:-default}, limit ${TOTAL}s"
timeout -k 30 "$TOTAL" "$PY3" "$G/release_gate.py" "$BR" --tier L --schedule v2 --select-base "$BASE" --no-visual
erc=$?

# ------------------------------------------------------------------ 5. the verdict
verdict "$R.json" "$SHA" "the engine wrote no report (rc=$erc)"
exit $?
