#!/usr/bin/env bash
# Gate v2 (GATE2-295): the release gate with change-impact selection. docs/release/GATE_V2.md. Does NOT replace release_gate.sh.
#   release_gate2.sh <branch> [--base <ref>] [--after <red gate report .json>] [--full] [--keep-heavy] [--depth N]
#                    [--accept-stale-nightly] [--dry-run [--root <checkout>]] [-- <extra engine args>]
#     <branch>      pushed branch (the runner sees origin only), e.g. release/2200
#     --base        the last green release (default: the newest v* tag reachable from origin/<branch>)
#     --after       targeted re-run after a red gate: the failed tests' files of that report + what the fix touches + the core,
#                   base = that report's sha (replaces a full re-gate; the rest of the coverage is that report's)
#     --full        no selection: the full tier L on the v2 schedule (what release_gate.sh --schedule v2 does) - in-place rollback
#     --keep-heavy  do not defer the heavy unchanged sweeps to the nightly (GATE2_DEFER_HEAVY=0)
#     --depth N     import-closure depth of the mapping (default 2; 0 = unlimited, the select_tests behaviour)
#     --accept-stale-nightly  select even when the newest full nightly on main is missing, older than 36 h or broken
#     --dry-run     print the selection and the estimate; takes NO lock, starts no test, writes only under /tmp; uses a temporary
#                   detached worktree of origin/<branch> (removed afterwards), or --root <an existing checkout of the head>
# What a real run does:
#   1. takes the same two locks as release_gate.sh (one gate at a time; the nightly/manual test lock)
#   2. refreshes ~/gate2/release_gate.py (+ gate_baselines.json, gate_durations.json, select_tests.py as select_tests_v1.py)
#      from the v1 install (GATE2_V1_DIR, default ~) - the engine is byte-identical to v1's, only select_tests.py is the gate-2 shim
#   3. checks the nightly safety net (gate2_select.py nightly); not healthy -> full tier, said in the output
#   4. plans the run on the engine's own worktree (~/work/gate-<branch>): selection, GATE_BACKEND_SHARDS / GATE_PW_SLOTS split of
#      one CPU budget, --no-visual when no frontend/src file changed
#   5. keeps an earlier report of the same branch+sha as gate_<b>_<sha>.pre-gate2.* (the engine would overwrite it)
#   6. runs the engine: --tier L --schedule v2 --select-base <base>, GATE_SELECT_ENABLE=1, total limit GATE_TOTAL_SECS
#      (default 7200 s; 12000 s for --full)
#   7. gate2_verdict.py: gate_<b>_<sha>.gate2.md (quarantine applied, next step); when EVERY failure is quarantined it re-runs
#      only those tests on the same sha once (the first report is kept as .gate2-first.json)
# Exit: 0 pass, 1 fail, 2 usage, 3 lock busy.
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
case "${1:-}" in -h|--help|"") sed -n 2,31p "$0"; exit 0;; esac
G2="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
V1="${GATE2_V1_DIR:-$HOME}"
REPO="${GATE2_REPO:-$HOME/smplwisebms}"
RES="${GATE_RESULTS_DIR:-$HOME/smplwise-results}"
PY3="${GATE2_PYTHON:-python3}"
BR="" BASE="" AFTER="" FULL=0 DRY=0 ROOT="" STALE_OK=0 DEPTH="" PASS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:-}"; shift 2;;
    --after) AFTER="${2:-}"; shift 2;;
    --full) FULL=1; shift;;
    --keep-heavy) export GATE2_DEFER_HEAVY=0; shift;;
    --depth) DEPTH="${2:-}"; shift 2;;
    --accept-stale-nightly) STALE_OK=1; shift;;
    --dry-run) DRY=1; shift;;
    --root) ROOT="${2:-}"; shift 2;;
    --) shift; PASS=("$@"); break;;
    -*) echo "unknown option $1 (see --help)"; exit 2;;
    *) BR="$1"; shift;;
  esac
done
[ -n "$BR" ] || { echo "usage: release_gate2.sh <branch> [options]  (--help)"; exit 2; }
[ -z "$DEPTH" ] || export GATE2_CLOSURE_DEPTH="$DEPTH"
TAG="$(printf %s "$BR" | sed 's/[^A-Za-z0-9._-]/-/g')"
[ -f "$G2/gate2_select.py" ] && [ -f "$G2/gate2_verdict.py" ] || { echo "gate2_select.py / gate2_verdict.py must sit next to $0"; exit 2; }
if [ -n "$AFTER" ]; then
  [ -f "$AFTER" ] || { echo "--after: no such report $AFTER"; exit 2; }
  ASHA="$("$PY3" -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("sha",""))' "$AFTER")"
  [ -n "$ASHA" ] || { echo "--after: the report has no sha"; exit 2; }
  BASE="$ASHA"
fi

# ------------------------------------------------------------------ dry run: no lock, no test, nothing written outside /tmp
if [ "$DRY" = 1 ]; then
  TMPW=""
  if [ -z "$ROOT" ]; then
    git -C "$REPO" rev-parse --verify -q "origin/$BR^{commit}" >/dev/null || { echo "origin/$BR not found in $REPO (fetch first)"; exit 2; }
    TMPW="$(mktemp -d /tmp/gate2-dry-XXXXXX)"
    nice -n 19 git -C "$REPO" worktree add --detach -q "$TMPW/wt" "origin/$BR" || { rm -rf "$TMPW"; exit 2; }
    ROOT="$TMPW/wt"
    trap 'git -C "$REPO" worktree remove --force "$TMPW/wt" >/dev/null 2>&1; git -C "$REPO" worktree prune >/dev/null 2>&1; rm -rf "$TMPW"' EXIT
  fi
  if [ -z "$BASE" ]; then
    BASE="$(git -C "$ROOT" describe --tags --abbrev=0 --match 'v[0-9]*' HEAD 2>/dev/null)" || { echo "no v* tag below the head; pass --base"; exit 2; }
  fi
  echo "gate2 dry-run: branch $BR (head $(git -C "$ROOT" rev-parse --short HEAD)), base $BASE, checkout $ROOT"
  "$PY3" "$G2/gate2_select.py" nightly --results "$RES" 2>/dev/null | sed -n 's/^ *"\(ok\|why\)": /  nightly safety net: \1 = /p'
  ARGS=(plan --root "$ROOT" --base "$BASE" --head HEAD --json "${TMPDIR:-/tmp}/gate2_dry_${TAG}.selection.json")
  [ -z "$AFTER" ] || ARGS+=(--after "$AFTER")
  [ "${GATE2_DEFER_HEAVY:-1}" = 0 ] && ARGS+=(--no-defer-heavy)
  nice -n 19 "$PY3" "$G2/gate2_select.py" "${ARGS[@]}"
  rc=$?
  echo "selection JSON: ${TMPDIR:-/tmp}/gate2_dry_${TAG}.selection.json"
  exit $rc
fi

# ------------------------------------------------------------------ real run
mkdir -p "$RES" "$HOME/work"
exec 9>"$HOME/.smplwise-gate.lock"
flock -n 9 || { echo "another release gate is running"; exit 3; }
exec 8>"$HOME/.smplwise-tests.lock"
flock -n 8 || { echo "the nightly/manual test run holds ~/.smplwise-tests.lock"; exit 3; }
MADE_PENDING=0
if [ ! -e "$HOME/.gate-pending" ]; then touch "$HOME/.gate-pending"; MADE_PENDING=1; fi
trap '[ "$MADE_PENDING" = 1 ] && rm -f "$HOME/.gate-pending"' EXIT

for f in release_gate.py select_tests.py; do
  [ -f "$V1/$f" ] || { echo "the v1 gate is not installed in $V1 ($f missing)"; exit 2; }
done
cp -p "$V1/release_gate.py" "$G2/release_gate.py"
cp -p "$V1/select_tests.py" "$G2/select_tests_v1.py"
for f in gate_baselines.json gate_durations.json; do [ -f "$V1/$f" ] && cp -p "$V1/$f" "$G2/$f"; done
[ -f "$G2/select_tests.py" ] || { echo "the gate-2 shim $G2/select_tests.py is missing (install step, GATE_V2.md section 7)"; exit 2; }
grep -q "gate2_select" "$G2/select_tests.py" || { echo "$G2/select_tests.py is not the gate-2 shim"; exit 2; }

git -C "$REPO" fetch -q --all --prune
git -C "$REPO" rev-parse --verify -q "origin/$BR^{commit}" >/dev/null || { echo "origin/$BR not found (push the branch first)"; exit 2; }
if [ -z "$BASE" ]; then
  BASE="$(git -C "$REPO" describe --tags --abbrev=0 --match 'v[0-9]*' "origin/$BR" 2>/dev/null)" || { echo "no v* tag below origin/$BR; pass --base"; exit 2; }
fi

if [ "$FULL" = 0 ] && [ -z "$AFTER" ] && [ "$STALE_OK" = 0 ]; then
  NH="$("$PY3" "$G2/gate2_select.py" nightly --results "$RES")"
  if ! printf %s "$NH" | grep -q '"ok": true'; then
    echo "gate2: the nightly safety net is not healthy -> FULL tier (use --accept-stale-nightly to select anyway):"
    printf '%s\n' "$NH" | sed -n 's/^ *"why": /  /p'
    FULL=1
  fi
fi

WT="$HOME/work/gate-$TAG"         # the engine's own worktree path; we hold the gate lock, so nobody else uses it
if [ ! -e "$WT/.git" ]; then
  git -C "$REPO" worktree prune
  git -C "$REPO" worktree add --detach -f -q "$WT" "origin/$BR" || exit 2
else
  git -C "$WT" checkout -q -f --detach "origin/$BR" || exit 2
fi
SHA="$(git -C "$WT" rev-parse --short HEAD)"
ENGINE=("$BR" --tier L --schedule v2)
if [ "$FULL" = 0 ]; then
  PLAN="$("$PY3" "$G2/gate2_select.py" plan --root "$WT" --base "$BASE" --head HEAD ${AFTER:+--after "$AFTER"} \
          $([ "${GATE2_DEFER_HEAVY:-1}" = 0 ] && echo --no-defer-heavy) 2>&1)"
  printf '%s\n' "$PLAN"
  KN="$(printf '%s\n' "$PLAN" | sed -n 's/.*knobs for this run: GATE_BACKEND_SHARDS=\([0-9]*\) GATE_PW_SLOTS=\([0-9]*\).*/\1 \2/p')"
  if [ -n "$KN" ]; then
    : "${GATE_BACKEND_SHARDS:=${KN% *}}"; : "${GATE_PW_SLOTS:=${KN#* }}"
    export GATE_BACKEND_SHARDS GATE_PW_SLOTS
  fi
  printf '%s\n' "$PLAN" | grep -q "pixel: no frontend/src change" && ENGINE+=(--no-visual)
  ENGINE+=(--select-base "$BASE")
  export GATE_SELECT_ENABLE=1
  : "${GATE_TOTAL_SECS:=7200}"
else
  : "${GATE_TOTAL_SECS:=12000}"
fi
[ -z "$AFTER" ] || export GATE2_AFTER_REPORT="$(readlink -f "$AFTER")"
export GATE_SCHEDULE=v2 GATE_TOTAL_SECS GATE2_COSTS="${GATE2_COSTS:-$G2/gate2_costs.json}"

R="$RES/gate_${TAG}_${SHA}"
if [ -e "$R.json" ] || [ -d "$R.logs" ]; then        # an earlier gate of the same sha: keep it (the engine overwrites it)
  for e in json md selection.json; do [ -e "$R.$e" ] && mv -f "$R.$e" "$R.pre-gate2.$e"; done
  [ -d "$R.logs" ] && { rm -rf "$R.pre-gate2.logs"; mv "$R.logs" "$R.pre-gate2.logs"; }
fi

echo "gate2: $BR @ $SHA, base $BASE, full=$FULL, shards=${GATE_BACKEND_SHARDS:-default} slots=${GATE_PW_SLOTS:-default}, limit ${GATE_TOTAL_SECS}s"
timeout -k 30 "$GATE_TOTAL_SECS" "$PY3" "$G2/release_gate.py" "${ENGINE[@]}" "${PASS[@]}"
erc=$?
[ -f "$R.json" ] || { echo "gate2: the engine wrote no report (rc=$erc)"; exit 1; }
"$PY3" "$G2/gate2_verdict.py" "$R.json" --branch "$BR"
vrc=$?
if [ "$vrc" = 10 ]; then
  echo "gate2: every failure is quarantined -> re-running ONLY those tests on $SHA"
  cp -p "$R.json" "$R.gate2-first.json"; cp -p "$R.md" "$R.gate2-first.md" 2>/dev/null
  [ -e "$R.selection.json" ] && cp -p "$R.selection.json" "$R.gate2-first.selection.json"
  GATE2_AFTER_REPORT="$R.gate2-first.json" GATE2_RERUN_ONLY=1 GATE_SELECT_ENABLE=1 \
    timeout -k 30 1800 "$PY3" "$G2/release_gate.py" "$BR" --tier L --schedule v2 --no-visual --select-base "$SHA"
  "$PY3" "$G2/gate2_verdict.py" "$R.json" --branch "$BR" --second
  vrc=$?
fi
[ "$vrc" = 0 ] && exit 0 || exit 1
