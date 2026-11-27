#!/usr/bin/env bash
# Gate v2 (GATE2-295): the release gate with change-impact selection. docs/release/GATE_V2.md. Does NOT replace release_gate.sh.
#   release_gate2.sh <branch> [--base <ref>] [--after <red gate report .json>] [--full] [--keep-heavy] [--depth N]
#                    [--accept-stale-nightly] [--dry-run [--root <checkout>]] [-- <extra engine args>]
#     <branch>      pushed branch (the runner sees origin only), e.g. release/2200
#     --base        the last green release (default: the newest v* tag reachable from origin/<branch>)
#     --after       targeted re-run after a red gate: the failed tests' files of that report + what the fix touches + the core,
#                   base = that report's sha (replaces a full re-gate; the rest of the coverage is that report's). GATE-TRUST-2540
#                   (TR-09): only with a coverage anchor behind the head - a completed FULL run (green, or red on this branch) or a
#                   green nightly at an ancestor at most GATE2_ANCHOR_MAX_COMMITS (20) commits / GATE2_ANCHOR_MAX_HOURS (36) h /
#                   GATE2_ANCHOR_MAX_PRODUCT_FILES (40) product files behind (gate_entry.py anchor); without one the FULL tier runs,
#                   the reason is printed and kept in gate_<b>_<sha>.anchor.json and in the gate-2 summary
#     --accept-no-anchor "<reason>"  keep the targeted --after run without an anchor; the reason goes on record. Env: GATE2_ACCEPT_NO_ANCHOR
#     --full        no selection: the full tier L on the v2 schedule (what release_gate.sh --schedule v2 does) - in-place rollback
#     --keep-heavy  do not defer the heavy unchanged sweeps to the nightly (GATE2_DEFER_HEAVY=0)
#     --depth N     import-closure depth of the mapping (default 2; 0 = unlimited, the select_tests behaviour)
#     --accept-stale-nightly  select even when the newest full nightly on main is missing, older than 36 h or broken
#     --engine-drift-ok "<reason>"  GATE-HARDEN-2520 (TR-02): run although the installed engine differs from the tree's (a deliberate
#                   pin); the reason is written into gate_<b>_<sha>.engine.json. Env: GATE2_ENGINE_DRIFT_OK="<reason>"
#     --dry-run     print the selection and the estimate; takes NO lock, starts no test, writes only under /tmp; uses a temporary
#                   detached worktree of origin/<branch> (removed afterwards), or --root <an existing checkout of the head>
# What a real run does:
#   0. GATE-HARDEN-2520 (TR-02): engine_sync.py check - the sha256 of the installed engine (~/release_gate.py, ~/gate2/release_gate.py)
#      against scripts/gate/release_gate.py of origin/<branch>; a difference REFUSES the gate (exit 2) unless --engine-drift-ok;
#      the rest of the gate-2 tooling is compared and reported loudly; the record is gate_<b>_<sha>.engine.json
#   1. takes the same two locks as release_gate.sh (one gate at a time; the nightly/manual test lock)
#   2. refreshes ~/gate2/release_gate.py (+ gate_baselines.json, gate_durations.json, select_tests.py as select_tests_v1.py)
#      from the v1 install (GATE2_V1_DIR, default ~) - the engine is byte-identical to v1's, only select_tests.py is the gate-2 shim
#   3. checks the nightly safety net (gate2_select.py nightly); not healthy -> full tier, said in the output
#   3b. GATE-TRUST-2540 (TR-09): an --after run checks its coverage anchor (above); none -> the FULL tier
#   3c. GATE-TRUST-2540 (TR-05): the BLOCKING backend lint lane (ruff F) on the engine's own worktree, i.e. the branch under test
#      (gate_entry.py lint --root <worktree>; it used to lint ~/smplwisebms from gate_release.sh); record gate_<b>_<sha>.lint.json.
#      A blocking finding stops the gate before any test (exit 1); GATE_BACKEND_LINT=warn reports only, =0 switches it off
#   4. plans the run on the engine's own worktree (~/work/gate-<branch>): selection, GATE_BACKEND_SHARDS / GATE_PW_SLOTS split of
#      one CPU budget, --no-visual only when the plan says `visual: skip` (T074: no frontend/src, visual harness or baseline change
#      and no visual failure of an --after report; the visual step is BLOCKING by default, docs/changes/T074-VISUAL-METRICS-2405.md)
#   5. keeps an earlier report of the same branch+sha as gate_<b>_<sha>.pre-gate2.* (the engine would overwrite it)
#   6. runs the engine: --tier L --schedule v2 --select-base <base>, GATE_SELECT_ENABLE=1, total limit GATE_TOTAL_SECS
#      (explicit wins; else GATE-SPEED-2550: max(derived cap, plan ESTIMATE high x 1.25 x load factor) - gate_budget.py limit)
#   7. gate2_verdict.py: gate_<b>_<sha>.gate2.md (quarantine applied, next step); when EVERY failure is quarantined it re-runs
#      only those tests on the same sha once (the first report is kept as .gate2-first.json); quarantined VISUAL cases are re-checked
#      by the engine itself in that re-run (GATE2_RERUN_ONLY overrides the --no-visual below, T074)
# Exit: 0 pass, 1 fail (also: the backend lint blocks, TR-05), 2 usage or engine drift refused (TR-02), 3 lock busy.
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
case "${1:-}" in -h|--help|"") sed -n 2,44p "$0"; exit 0;; esac
G2="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
V1="${GATE2_V1_DIR:-$HOME}"
REPO="${GATE2_REPO:-$HOME/smplwisebms}"
RES="${GATE_RESULTS_DIR:-$HOME/smplwise-results}"
PY3="${GATE2_PYTHON:-python3}"
BR="" BASE="" AFTER="" FULL=0 DRY=0 ROOT="" STALE_OK=0 DEPTH="" PASS=() DRIFT_OK="${GATE2_ENGINE_DRIFT_OK:-}" NOANCHOR_OK="${GATE2_ACCEPT_NO_ANCHOR:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:-}"; shift 2;;
    --after) AFTER="${2:-}"; shift 2;;
    --full) FULL=1; shift;;
    --keep-heavy) export GATE2_DEFER_HEAVY=0; shift;;
    --resume) export GATE_RESUME=1; shift;;       # GATE-FAST-2291: reuse the finished units of an earlier run of the SAME sha (checkpoint file)
    --depth) DEPTH="${2:-}"; shift 2;;
    --accept-stale-nightly) STALE_OK=1; shift;;
    --engine-drift-ok) DRIFT_OK="${2:-}"; [ -n "$DRIFT_OK" ] || { echo "--engine-drift-ok needs a reason"; exit 2; }; shift 2;;
    --accept-no-anchor) NOANCHOR_OK="${2:-}"; [ -n "$NOANCHOR_OK" ] || { echo "--accept-no-anchor needs a reason"; exit 2; }; shift 2;;
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

# GATE-TRUST-2540: the two checks a real run and the dry run share
# anchor_check <repo> <head ref> <json out>: rc 0 = the targeted --after run has a coverage anchor (TR-09), else the FULL tier runs
anchor_check() {
  "$PY3" "$G2/gate_entry.py" anchor --results "$RES" --repo "$1" --head "$2" --branch "$BR" --after "$AFTER" --json "$3" \
    ${NOANCHOR_OK:+--accept "$NOANCHOR_OK"} > "$3.out" 2>&1
  local rc=$?
  "$PY3" -c 'import json,sys; d=json.load(open(sys.argv[1], encoding="utf-8")); print("  coverage anchor:", "OK" if d.get("ok") else "NONE", "-", d.get("why", ""))' "$3" 2>/dev/null \
    || { echo "  coverage anchor: the check could not run (rc=$rc):"; tail -n 3 "$3.out" | sed 's/^/    /'; }
  rm -f "$3.out"
  return $rc
}
# lint_lane <checkout> <json out>: rc 1 = a blocking backend lint finding in THAT checkout (TR-05); NOT_RUN / timeout never blocks
lint_lane() {
  [ "${GATE_BACKEND_LINT:-1}" != 0 ] || { echo "  backend lint: off (GATE_BACKEND_LINT=0)"; return 0; }
  [ -f "$G2/gate_entry.py" ] && [ -f "$G2/lint_backend.py" ] || { echo "  backend lint: NOT_RUN - gate_entry.py / lint_backend.py not installed in $G2 (not blocking)"; return 0; }
  GATE_LINT_ROOT="$1" timeout -k 5 300 nice -n 10 "$PY3" "$G2/gate_entry.py" lint --root "$1" --json "$2" 2>&1 | sed 's/^/  /'
  local rc=${PIPESTATUS[0]}
  case "$rc" in 0|1) return "$rc";; *) echo "  backend lint: NOT_RUN - exit $rc (timeout or crash; not blocking)"; return 0;; esac
}

# ------------------------------------------------------------------ dry run: no lock, no test, nothing written outside /tmp
if [ "$DRY" = 1 ]; then
  # the selector imports select_tests_v1 and the estimate imports release_gate: stage the v1 copies (inside $G2 only; the dry run holds no lock)
  for f in release_gate.py gate_baselines.json gate_durations.json; do [ -f "$V1/$f" ] && [ ! -f "$G2/$f" ] && cp -p "$V1/$f" "$G2/$f"; done
  [ -f "$G2/select_tests_v1.py" ] || { [ -f "$V1/select_tests.py" ] && cp -p "$V1/select_tests.py" "$G2/select_tests_v1.py"; }
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
  [ -f "$G2/engine_sync.py" ] && "$PY3" "$G2/engine_sync.py" check --repo "$REPO" --ref "origin/$BR" --warn-only
  "$PY3" "$G2/gate2_select.py" nightly --results "$RES" 2>/dev/null | sed -n 's/^ *"\(ok\|why\)": /  nightly safety net: \1 = /p'
  if [ -n "$AFTER" ]; then
    anchor_check "$ROOT" "$(git -C "$ROOT" rev-parse HEAD)" "${TMPDIR:-/tmp}/gate2_dry_${TAG}.anchor.json" \
      || echo "  -> a real run would run the FULL tier instead of the targeted --after selection (TR-09)"
  fi
  lint_lane "$ROOT" "${TMPDIR:-/tmp}/gate2_dry_${TAG}.lint.json" || echo "  -> a real run would stop here: the backend lint blocks (TR-05)"
  ARGS=(plan --root "$ROOT" --base "$BASE" --head HEAD --json "${TMPDIR:-/tmp}/gate2_dry_${TAG}.selection.json")
  [ -z "$AFTER" ] || ARGS+=(--after "$AFTER")
  [ "${GATE2_DEFER_HEAVY:-1}" = 0 ] && ARGS+=(--no-defer-heavy)
  DPLAN="$(nice -n 19 "$PY3" "$G2/gate2_select.py" "${ARGS[@]}" 2>&1)"
  rc=$?
  printf '%s\n' "$DPLAN"
  # GATE-SPEED-2550: the time limit a real run would get now (explicit GATE_TOTAL_SECS, else gate_budget.py limit; nothing is started)
  printf '%s\n' "$DPLAN" | "$PY3" "$G2/gate_budget.py" limit --results "$RES" --mode "$([ "$FULL" = 1 ] && echo full || echo select)" --plan - \
    --fallback "$([ "$FULL" = 1 ] && echo 12000 || echo 7200)" --explicit "${GATE_TOTAL_SECS:-}" \
    --load1 "$(cut -d' ' -f1 /proc/loadavg 2>/dev/null)" --nproc "$(nproc 2>/dev/null)" --explain 2>&1 >/dev/null | sed 's/^/  /' || true
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
# GATE-FAST-2291 (item 8): say who holds the machine; agent test runs (run_guarded.sh / gate_holder.py guard) are refused meanwhile
[ -f "$G2/gate_holder.py" ] && "$PY3" "$G2/gate_holder.py" claim --kind gate --who "release gate $BR" --what "release_gate2.sh $BR" --pid $$ >/dev/null 2>&1
trap '[ "$MADE_PENDING" = 1 ] && rm -f "$HOME/.gate-pending"; [ -f "$G2/gate_holder.py" ] && "$PY3" "$G2/gate_holder.py" release --pid $$ >/dev/null 2>&1' EXIT

for f in release_gate.py select_tests.py; do
  [ -f "$V1/$f" ] || { echo "the v1 gate is not installed in $V1 ($f missing)"; exit 2; }
done
cp -p "$V1/release_gate.py" "$G2/release_gate.py"
cp -p "$V1/select_tests.py" "$G2/select_tests_v1.py"
for f in gate_baselines.json gate_durations.json gate_budget.py gate_phase_budgets.json gate_early_layout.json; do [ -f "$V1/$f" ] && cp -p "$V1/$f" "$G2/$f"; done   # GATE-FAST-2291: budgets + early layout list travel with the engine
[ -f "$G2/select_tests.py" ] || { echo "the gate-2 shim $G2/select_tests.py is missing (install step, GATE_V2.md section 7)"; exit 2; }
grep -q "gate2_select" "$G2/select_tests.py" || { echo "$G2/select_tests.py is not the gate-2 shim"; exit 2; }

git -C "$REPO" fetch -q --all --prune
git -C "$REPO" rev-parse --verify -q "origin/$BR^{commit}" >/dev/null || { echo "origin/$BR not found (push the branch first)"; exit 2; }
# GATE-HARDEN-2520 (TR-02): before any test - is the engine we are about to run the engine of the tree under test?
HSHA="$(git -C "$REPO" rev-parse --short "origin/$BR")"
if [ -f "$G2/engine_sync.py" ]; then
  "$PY3" "$G2/engine_sync.py" check --repo "$REPO" --ref "origin/$BR" --home "$HOME" --json "$RES/gate_${TAG}_${HSHA}.engine.json" \
    ${DRIFT_OK:+--allow-drift "$DRIFT_OK"}
  src=$?
  if [ "$src" = 4 ]; then echo "gate2: REFUSED - engine drift (see above); nothing was run"; exit 2; fi
  [ "$src" = 0 ] || echo "gate2: WARNING - the engine drift check could not run (rc=$src); the engine was NOT verified"
else
  echo "gate2: WARNING - $G2/engine_sync.py is not installed: the engine was NOT compared with the tree (GATE-HARDEN-2520 install step)"
fi
if [ -z "$BASE" ]; then
  BASE="$(git -C "$REPO" describe --tags --abbrev=0 --match 'v[0-9]*' "origin/$BR" 2>/dev/null)" || { echo "no v* tag below origin/$BR; pass --base"; exit 2; }
fi

# GATE-TRUST-2540 (TR-09): a targeted --after run trusts an earlier FULL run for everything it does not select - is there one?
rm -f "$RES/gate_${TAG}_${HSHA}.anchor.json"      # never let an earlier run's record speak for this one
if [ -n "$AFTER" ] && [ "$FULL" = 0 ]; then
  echo "gate2: targeted re-run after $(basename "$AFTER") - checking the coverage anchor (TR-09)"
  if ! anchor_check "$REPO" "$(git -C "$REPO" rev-parse "origin/$BR")" "$RES/gate_${TAG}_${HSHA}.anchor.json"; then
    echo "gate2: no coverage anchor behind the head -> FULL tier instead of the targeted selection (--accept-no-anchor \"<reason>\" keeps it)"
    FULL=1; AFTER=""
  fi
fi

if [ "$FULL" = 0 ] && [ -z "$AFTER" ] && [ "$STALE_OK" = 0 ]; then
  NH="$("$PY3" "$G2/gate2_select.py" nightly --results "$RES")"
  if ! printf %s "$NH" | grep -q '"ok": true'; then
    echo "gate2: the nightly safety net is not healthy -> FULL tier (use --accept-stale-nightly to select anyway):"
    printf '%s\n' "$NH" | sed -n 's/^ *"why": /  /p'
    FULL=1
  fi
fi

# GATE-FAST-2291 (item 4): the total cap is derived = sum of the per-phase budgets x 1.5 (gate_budget.py); an explicit GATE_TOTAL_SECS wins;
# without the helper / seed the old fixed defaults apply (7200 select, 12000 full)
derived_cap() { local c; c="$("$PY3" "$G2/gate_budget.py" cap --results "$RES" --mode "$1" 2>/dev/null)" && [ -n "$c" ] && printf %s "$c" || printf %s "$2"; }
# GATE-SPEED-2320 + GATE-SPEED-2550: the limit = max(derived cap, the plan's ESTIMATE high x 1.25 x the load factor at the start), never
# below the estimate; a side the selection runs FULL uses the full-mode budgets (gate_budget.py limit). An explicit GATE_TOTAL_SECS wins
# (the callers keep `: "${GATE_TOTAL_SECS:=...}"`). An older gate_budget.py without `limit`: the derived cap, else the fixed default.
effective_limit() {   # $1 mode, $2 fallback seconds; the plan text on stdin; prints seconds (the "why" line goes to the terminal)
  local c; c="$("$PY3" "$G2/gate_budget.py" limit --results "$RES" --mode "$1" --plan - --fallback "$2" \
                --load1 "$(cut -d' ' -f1 /proc/loadavg 2>/dev/null)" --nproc "$(nproc 2>/dev/null)" --explain)" && [ -n "$c" ] \
    && printf %s "$c" || derived_cap "$1" "$2"
}
WT="$HOME/work/gate-$TAG"         # the engine's own worktree path; we hold the gate lock, so nobody else uses it
if [ ! -e "$WT/.git" ]; then
  git -C "$REPO" worktree prune
  git -C "$REPO" worktree add --detach -f -q "$WT" "origin/$BR" || exit 2
else
  git -C "$WT" checkout -q -f --detach "origin/$BR" || exit 2
fi
SHA="$(git -C "$WT" rev-parse --short HEAD)"
# GATE-TRUST-2540 (TR-05): the blocking backend lint lane on THIS worktree (the branch under test), before any test
echo "gate2: backend lint lane on $WT"
if ! lint_lane "$WT" "$RES/gate_${TAG}_${SHA}.lint.json"; then
  echo "gate2: RED - the backend lint (ruff F) of origin/$BR @ $SHA has findings; nothing was run. Fix them (GATE_BACKEND_LINT=warn reports without blocking)."
  exit 1
fi
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
  printf '%s\n' "$PLAN" | grep -q "^  visual: skip" && ENGINE+=(--no-visual)   # T074 (was: "pixel: no frontend/src change")
  ENGINE+=(--select-base "$BASE")
  export GATE_SELECT_ENABLE=1
  : "${GATE_TOTAL_SECS:=$(printf '%s\n' "$PLAN" | effective_limit select 7200)}"
else
  # the full tier: the plan's own "full tier on the same tree" estimate is a floor too (GATE-SPEED-2320; seconds, no test is started)
  if [ -z "${GATE_TOTAL_SECS:-}" ]; then
    FPLAN="$("$PY3" "$G2/gate2_select.py" plan --root "$WT" --base "$BASE" --head HEAD 2>/dev/null | grep -E 'ESTIMATE|full (backend|frontend)')" || FPLAN=""
    GATE_TOTAL_SECS="$(printf '%s\n' "$FPLAN" | effective_limit full 12000)"
  fi
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
