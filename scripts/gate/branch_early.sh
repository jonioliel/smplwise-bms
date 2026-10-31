#!/usr/bin/env bash
# EARLY CHECK per branch (GATE-SPEED-2320): only the release gate's EARLY stage for a pushed branch vs origin/main, ~5-8 min, queued.
#   branch_early.sh <branch> [--max-wait SECS] [--no-layout]
#     <branch>     a PUSHED branch (the runner sees origin only), e.g. pilot/T123-foo; not main
#     --max-wait   how long to wait in the queue for the tests lock (default EARLY_LOCK_WAIT or 43200 s = 12 h; 0 = no limit)
#     --no-layout  skip the early layout list (vite build + dist preview): only the source rules, tsc, the backend lints, release_check
# Parts (early_check.py, list in gate_early_check.json): spec-lint (new specs: geometry read after a click with no settle), tsc, the
# repository-wide unit rule specs, the backend lint tests, release_check, and the gate's early layout list (gate_early_layout.json).
# The lead runs it before a branch joins a train (owner 31.10); every agent runs early_local.(ps1|sh) on the workstation before pushing.
# What a run does:
#   1. waits (queues) for ~/.smplwise-tests.lock exactly like branch_check.sh (never fails on busy; a pending release gate / nightly goes
#      first); ~/smplwise-results/early_status.json says queued / running / done
#   2. holds the machine (gate_holder.py kind "entry"): agent runs through run_guarded.sh are refused meanwhile
#   3. stages the engine next to this file (release_gate.py from ~/, for the gate's own early-layout pick) like branch_check.sh
#   4. checks out origin/<branch> in ~/work/early-<branch-tag>, links ~/smplwisebms/frontend/node_modules when package-lock.json is the
#      same (else npm ci), runs early_check.py run --layout (all parts in parallel)
#   5. writes ~/smplwise-results/entry_early_<branch-tag>_<sha>.md (Hebrew + English) and .json
# Verdict: GREEN -> exit 0; RED or NOT_RUN -> exit 1; usage -> 2. It is not a gate: no gate_status.json, no tag, no nightly decision.
# Env: EARLY_TOTAL_SECS (whole run, 1800), EARLY_LOCK_SLICE (poll, 30 s), EARLY_LAYOUT_WORKERS, EARLY_PREVIEW_PORT (4191), GATE2_PYTHON,
# GATE2_REPO, GATE2_V1_DIR, GATE_RESULTS_DIR, EARLY_BACKEND_PYTHON (default ~/smplwisebms/.venv/bin/python).
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:$PATH:/usr/local/bin:/usr/bin:/bin"
case "${1:-}" in -h|--help|"") sed -n 2,21p "$0"; exit 0;; esac
G="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
PY3="${GATE2_PYTHON:-python3}"
REPO="${GATE2_REPO:-$HOME/smplwisebms}"
V1="${GATE2_V1_DIR:-$HOME}"
RES="${GATE_RESULTS_DIR:-$HOME/smplwise-results}"
BASE="origin/main"
MAXW="${EARLY_LOCK_WAIT:-43200}"
SLICE="${EARLY_LOCK_SLICE:-30}"
TOTAL="${EARLY_TOTAL_SECS:-1800}"
BPY="${EARLY_BACKEND_PYTHON:-$REPO/.venv/bin/python}"
[ -x "$BPY" ] || BPY="$PY3"
BR="" LAYOUT=(--layout)
while [ $# -gt 0 ]; do
  case "$1" in
    --max-wait) MAXW="${2:-}"; shift 2;;
    --no-layout) LAYOUT=(); shift;;
    -*) echo "unknown option $1 (see --help)"; exit 2;;
    *) BR="$1"; shift;;
  esac
done
[ -n "$BR" ] || { echo "usage: branch_early.sh <branch> [--max-wait SECS] [--no-layout]"; exit 2; }
BR="${BR#origin/}"
case "$BR" in main|HEAD) echo "branch_early: '$BR' is the base itself (the check compares a branch against origin/main)"; exit 2;; esac
case "$MAXW" in ''|*[!0-9]*) echo "--max-wait needs seconds"; exit 2;; esac
for f in early_check.py gate_early_check.json lint_spec_waits.py; do
  [ -f "$G/$f" ] || { echo "$f must sit next to $0 ($G)"; exit 2; }
done
T0=$(date +%s)
mkdir -p "$RES" "$HOME/work"
status() { printf '{"state":"%s","branch":"%s","sha":"%s","time":"%s","waited_s":%s%s}\n' "$1" "$BR" "$2" "$(date -Iseconds 2>/dev/null || date)" "${WAITED:-0}" "${3:-}" > "$RES/early_status.json"; }
notrun() {   # $1 sha, $2 why: a NOT_RUN verdict file, exit 1
  "$PY3" "$G/early_check.py" verdict --branch "$BR" --sha "$1" --base "$BASE" --out-dir "$RES" --where runner --waited-s "${WAITED:-0}" --why "$2"
  status done "$1" ',"exit":1'
  exit 1
}

git -C "$REPO" fetch -q --prune origin 2>/dev/null || echo "branch_early: git fetch failed; using the refs already fetched"
git -C "$REPO" rev-parse --verify -q "origin/$BR^{commit}" >/dev/null || { echo "branch_early: origin/$BR not found (push the branch first)"; exit 1; }
git -C "$REPO" rev-parse --verify -q "$BASE^{commit}" >/dev/null || { echo "branch_early: $BASE not found in $REPO"; exit 1; }
SHA0="$(git -C "$REPO" rev-parse --short "origin/$BR")"

# ------------------------------------------------------------------ 1. the queue (the same lock and courtesy rules as branch_check.sh)
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
    echo "branch_early: queued for the tests lock (${WAITED} s so far${PENDING:+, $PENDING goes first}); waiting, not failing"
    status queued "$SHA0"
    LASTLOG=$WAITED
  fi
  if [ "$MAXW" -gt 0 ] && [ "$WAITED" -ge "$MAXW" ]; then
    notrun "$SHA0" "queue limit reached: waited ${WAITED} s for the tests lock (--max-wait $MAXW); nothing ran"
  fi
done
WAITED=$(( $(date +%s) - T0 ))
echo "branch_early: got the tests lock after ${WAITED} s"
status running "$SHA0"

# ------------------------------------------------------------------ 2. hold the machine
[ -f "$G/gate_holder.py" ] && "$PY3" "$G/gate_holder.py" claim --kind entry --who "early check $BR" --what "branch_early.sh $BR" --pid $$ >/dev/null 2>&1
trap '[ -f "$G/gate_holder.py" ] && "$PY3" "$G/gate_holder.py" release --pid $$ >/dev/null 2>&1' EXIT

# ------------------------------------------------------------------ 3. stage the engine (only for the gate's own early-layout pick; optional)
if [ "$(readlink -f "$V1")" != "$G" ] && [ -f "$V1/release_gate.py" ]; then
  cp -p "$V1/release_gate.py" "$G/release_gate.py"
  for f in gate_baselines.json gate_durations.json gate_budget.py gate_phase_budgets.json gate_early_layout.json; do [ -f "$V1/$f" ] && cp -p "$V1/$f" "$G/$f"; done
fi

# ------------------------------------------------------------------ 4. the worktree and the run
TAG="$(printf %s "$BR" | sed 's/[^A-Za-z0-9._-]/-/g')"
WT="$HOME/work/early-$TAG"
if [ ! -e "$WT/.git" ]; then
  git -C "$REPO" worktree prune
  git -C "$REPO" worktree add --detach -f -q "$WT" "origin/$BR" || notrun "$SHA0" "git worktree add failed"
else
  git -C "$WT" checkout -q -f --detach "origin/$BR" || notrun "$SHA0" "git checkout in $WT failed"
fi
SHA="$(git -C "$WT" rev-parse --short HEAD)"
BASE_SHA="$(git -C "$WT" rev-parse --short "$(git -C "$WT" merge-base HEAD "$BASE" 2>/dev/null || echo "$BASE")" 2>/dev/null)"
echo "branch_early: $BR @ $SHA vs $BASE ($BASE_SHA), limit ${TOTAL}s${LAYOUT[*]:+, with the early layout list}"
timeout -k 30 "$TOTAL" "$PY3" "$G/early_check.py" run --root "$WT" --base "$BASE" "${LAYOUT[@]}" --branch "$BR" --sha "$SHA" \
  --base-sha "$BASE_SHA" --out-dir "$RES" --where runner --waited-s "$WAITED" --backend-python "$BPY" --modules-from "$REPO/frontend"
rc=$?
if [ "$rc" = 124 ] || [ "$rc" = 137 ]; then
  notrun "$SHA" "the whole early check passed its limit (${TOTAL} s, EARLY_TOTAL_SECS) and was stopped"
fi
status done "$SHA" ",\"exit\":$([ "$rc" = 0 ] && echo 0 || echo 1)"
[ "$rc" = 0 ] && exit 0 || exit 1
