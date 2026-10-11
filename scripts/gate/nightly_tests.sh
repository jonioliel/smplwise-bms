#!/usr/bin/env bash
# Test run for SmplWise Arx - nightly (cron 02:00 Asia/Jerusalem) AND on demand. Installed on the runner as ~/nightly_tests.sh;
# the engine it drives is installed next to it as ~/nightly-gate/{release_gate.py,gate_baselines.json} (see INSTALL_ON_RUNNER.md).
# Usage: nightly_tests.sh [--backend-only] [--frontend-only] [--no-dev] [branch ...]   [--dry-run]   (default: origin/main only)
#   --backend-only  only the backend (two shards, the old quick path)
#   --frontend-only tsc + build + every Playwright phase, no backend (engine: GATE_SKIP_BACKEND=1)
#   --no-dev        skip the dev-server Playwright phase (engine: GATE_SKIP_DEV=1)
#   --dry-run       print the branches and limits that would be used and exit (no lock, no fetch, nothing run)
#
# NIGHTLY-speed (2026-10-09): the 2026-10-09 nightly hit its own 150 min limit with the preview pass at test 3627 of 10434. Cause
# (pw_preview.log of that run): the old script ran EVERY spec file on the dist preview on all three projects with --workers=2,
# including the 46 specs that need the Vite dev server (their header says so; the old dev-spec filter only grepped "/src/"). On the
# preview those hang until the 60 s test timeout: 151 tests x 60 s plus one 40 min layout-electricity sweep = about 3.2 h of
# worker time, 71 percent of all the worker time spent. The release gate classifies the specs (dev / one project / fixture / pixel
# / rest), runs the groups as parallel Playwright processes with --workers=3 and finishes the same suite in about 60 min.
# So the nightly now runs the release gate ENGINE (tier L, no visual step) for each branch, with its own results directory
# (~/smplwise-results/nightly/: never the dashboard's gate_status.json or gate_*.md) and a per-branch budget inside the hard limit.
#
# Hard limit (FIX1, 2026-10-08): the whole run (after the lock is won) is killed after SW_NIGHTLY_MAX_MIN minutes (default 150): the
# run's own process group is terminated, the lock is released, and <date>_nightly-TIMEOUT.md + nightly_status.json record it.
# The engine has its own deadline (GATE_TOTAL_SECS, set below to what is left minus a margin), so it normally stops itself first
# and still writes a report.
# One run at a time (flock): a second start waits or exits. Never kills processes by name (only the PIDs/process groups it started).
# Writes a summary per branch to ~/smplwise-results/<date>_<branch>.md (the dashboard reads the newest 20*.md).
set -uo pipefail
BO=0; FO=0; ND=0; DRY=0; ARGS=(); ORIG=("$@")
for a in "$@"; do case "$a" in --backend-only) BO=1;; --frontend-only) FO=1;; --no-dev) ND=1;; --dry-run) DRY=1;; *) ARGS+=("$a");; esac; done
set -- "${ARGS[@]+"${ARGS[@]}"}"
DIR="$HOME/smplwisebms"; RESULTS="$HOME/smplwise-results"; NRES="$RESULTS/nightly"
ENGINE="${SW_NIGHTLY_ENGINE:-$HOME/nightly-gate/release_gate.py}"
MAX_MIN="${SW_NIGHTLY_MAX_MIN:-150}"
BRANCH_MAX_MIN="${SW_NIGHTLY_BRANCH_MAX_MIN:-120}"   # engine budget per branch (the gate itself needs about 60 min)
if [ "$DRY" -eq 1 ]; then
  if [ "$#" -gt 0 ]; then echo "branches: $*"; else echo "branches: main"; fi
  echo "flags: backend-only=$BO frontend-only=$FO no-dev=$ND; hard limit ${MAX_MIN} min; per-branch engine budget ${BRANCH_MAX_MIN} min; lock wait ${SW_NIGHTLY_LOCK_WAIT:-10800} s"
  echo "engine: $ENGINE ($([ -f "$ENGINE" ] && echo present || echo MISSING)); workers per Playwright process: ${GATE_PW_WORKERS:-3}"; exit 0
fi
mkdir -p "$RESULTS"
# Lock wait (2026-10-06): used to be `flock -n || exit 3`, so the 02:00 run silently did not happen on 4-6 Oct whenever
# an agent/watcher run held the (shared) lock. Now it WAITS, bounded (SW_NIGHTLY_LOCK_WAIT seconds, default 3 h; 0 = the old
# immediate exit 3 for on-demand callers). While waiting it keeps ~/.nightly-pending fresh so the push watcher starts no new
# runs (the watcher's shared lock would otherwise starve this exclusive request), and it yields to a pending release gate
# (~/.gate-pending younger than 4 h). On give-up it leaves a dashboard-readable note (<date>_nightly-SKIPPED.md, newest 20*.md)
# and nightly_status.json instead of exiting without a trace.
LOCK_WAIT="${SW_NIGHTLY_LOCK_WAIT:-10800}"; WAIT0=$(date +%s)
[ -n "${SW_NIGHTLY_INNER:-}" ] || exec 9>"$HOME/.smplwise-tests.lock"
nightly_skip() { # $1 = reason
  local note="$RESULTS/$(date +%F)_nightly-SKIPPED.md"
  { echo "# Nightly SKIPPED: lock busy ($(date '+%F %H:%M'))"; echo "- reason: $1"; echo "- waited: $(( $(date +%s) - WAIT0 )) s of $LOCK_WAIT s for ~/.smplwise-tests.lock"; echo "- holder: $(fuser -v "$HOME/.smplwise-tests.lock" 2>&1 | tr -s ' ' | tail -n +2 | head -5 | tr '
' ';')"; } > "$note"
  printf '{"state":"skipped","reason":"lock busy","time":"%s","epoch":%s,"waited_s":%s}
' "$(date -Is)" "$(date +%s)" "$(( $(date +%s) - WAIT0 ))" > "$RESULTS/nightly_status.json"
  rm -f "$HOME/.nightly-pending"; echo "$1"; exit 3
}
if [ -n "${SW_NIGHTLY_INNER:-}" ]; then :  # inner run: the outer process already holds ~/.smplwise-tests.lock (fd 9 inherited)
elif [ "$LOCK_WAIT" -le 0 ]; then flock -n 9 || nightly_skip "another test run is in progress"; else
  touch "$HOME/.nightly-pending"; LASTLOG=0; trap 'rm -f "$HOME/.nightly-pending"' EXIT
  while :; do
    GATE=0; [ -n "$(find "$HOME/.gate-pending" -mmin -240 2>/dev/null)" ] && GATE=1
    SLICE=$(( LOCK_WAIT - ($(date +%s) - WAIT0) )); [ "$SLICE" -gt 30 ] && SLICE=30; [ "$SLICE" -lt 1 ] && SLICE=1
    if [ "$GATE" -eq 0 ] && flock -w "$SLICE" 9; then break; fi
    [ "$GATE" -eq 1 ] && sleep "$SLICE"
    touch "$HOME/.nightly-pending"; NOW=$(date +%s)
    if [ $((NOW-LASTLOG)) -ge 600 ]; then echo "$(date -Is) waiting for the tests lock ($((NOW-WAIT0)) s, gate pending=$GATE)"; LASTLOG=$NOW; fi
    [ $((NOW-WAIT0)) -ge "$LOCK_WAIT" ] && nightly_skip "skipped: lock busy after ${LOCK_WAIT}s (a gate or a test run kept ~/.smplwise-tests.lock)"
  done
  trap - EXIT; rm -f "$HOME/.nightly-pending"; echo "$(date -Is) got the tests lock after $(( $(date +%s) - WAIT0 )) s"
fi
rm -f "$RESULTS/nightly_status.json"
if [ -z "${SW_NIGHTLY_INNER:-}" ]; then
  # outer process: holds the lock, runs the real work under `timeout` (own process group, so every child is stopped), then releases
  export SW_NIGHTLY_INNER=1 SW_NIGHTLY_T0; T0=$(date +%s); SW_NIGHTLY_T0=$T0
  timeout -k 60 "${MAX_MIN}m" bash "$0" "${ORIG[@]+"${ORIG[@]}"}"; RC=$?
  if [ "$RC" -eq 124 ] || [ "$RC" -eq 137 ]; then
    { echo "# Nightly TIMEOUT ($(date '+%F %H:%M'))"; echo "- the run exceeded the hard limit of ${MAX_MIN} min and was stopped; the tests lock is released"; echo "- started: $(date -d @"$T0" '+%F %H:%M')"; } > "$RESULTS/$(date +%F)_nightly-TIMEOUT.md"
    printf '{"state":"timeout","limit_min":%s,"time":"%s","epoch":%s}
' "$MAX_MIN" "$(date -Is)" "$(date +%s)" > "$RESULTS/nightly_status.json"
    echo "nightly stopped by the ${MAX_MIN} min limit"
  fi
  exit "$RC"
fi
RUN_END=$(( ${SW_NIGHTLY_T0:-$(date +%s)} + MAX_MIN * 60 - 300 ))   # the engine must be done 5 min before the hard limit
cd "$DIR"; git fetch --all --prune >/dev/null 2>&1
if [ "$#" -gt 0 ]; then BRANCHES=("$@"); else
  # default (FIX1): origin/main only; pass branch names to test others
  BRANCHES=("main")
fi
export PATH="$DIR/.venv/bin:$PATH"
# the nightly clone is ours: drop leftovers of the previous run, put it on origin/main and refresh its node_modules (the engine's
# worktrees symlink them when their package-lock.json is identical, else they run their own npm ci)
git reset -q --hard 2>/dev/null; git clean -fdq 2>/dev/null
git checkout -q --detach origin/main 2>/dev/null
[ "$BO" -eq 1 ] || ( cd "$DIR/frontend" && npm ci >/dev/null 2>&1 )
mkdir -p "$NRES"
for BR in "${BRANCHES[@]}"; do
  TAG="$(date +%F)_$(echo "$BR" | tr '/' '-')"; OUT="$RESULTS/$TAG.md"; LOGD="$RESULTS/$TAG.logs"; mkdir -p "$LOGD"
  START=$(date +%s)
  if [ "$BO" -eq 1 ]; then
    # --- backend only: two parallel shards in the nightly clone (the old quick path)
    git reset -q --hard 2>/dev/null; git clean -fdq 2>/dev/null
    git checkout -q --detach "origin/$BR" || { echo "cannot checkout $BR" > "$OUT"; continue; }
    SHA=$(git rev-parse --short HEAD); PIDS=()
    cd "$DIR/smplwise_vms/backend"
    ls tests/test_*.py | sort > "$LOGD/all.txt"; N=$(wc -l < "$LOGD/all.txt"); H=$((N/2))
    head -n "$H" "$LOGD/all.txt" > "$LOGD/s1.txt"; tail -n +$((H+1)) "$LOGD/all.txt" > "$LOGD/s2.txt"
    for k in 1 2; do
      "$DIR/.venv/bin/python" -m pytest -o addopts="" -q -p no:cacheprovider --basetemp="$LOGD/tmp$k" $(tr '\n' ' ' < "$LOGD/s$k.txt") > "$LOGD/backend_s$k.log" 2>&1 &
      PIDS+=($!)
    done
    for p in "${PIDS[@]}"; do wait "$p" 2>/dev/null; done
    cd "$DIR"; END=$(date +%s)
    {
      echo "# Nightly $BR @ $SHA  ($(date '+%F %H:%M'), $(( (END-START)/60 )) min, backend only)"
      for k in 1 2; do echo "- backend shard $k: $(grep -E ' passed| failed' "$LOGD/backend_s$k.log" | tail -1)"; done
      echo; echo "## Backend failures"; grep -hE '^FAILED' "$LOGD"/backend_s*.log | head -40
    } > "$OUT"
    continue
  fi
  # --- everything else: the release gate engine (tier L: backend in 3 shards next to tsc/build/release_check, Playwright groups
  # classified like the gate: preview, fixture, pixel, dev server; failed tests retried alone; known issues; count-drop guard)
  BUDGET=$(( RUN_END - $(date +%s) )); [ "$BUDGET" -gt $((BRANCH_MAX_MIN * 60)) ] && BUDGET=$((BRANCH_MAX_MIN * 60))
  if [ ! -f "$ENGINE" ]; then echo "# Nightly $BR: NOT RUN - the engine $ENGINE is missing (see scripts/gate/INSTALL_ON_RUNNER.md)" > "$OUT"; continue; fi
  if [ "$BUDGET" -lt 1200 ]; then echo "# Nightly $BR: NOT RUN - only $((BUDGET/60)) min left of the ${MAX_MIN} min limit" > "$OUT"; continue; fi
  SHA=$(git -C "$DIR" rev-parse --short "origin/$BR" 2>/dev/null)
  REP="$NRES/gate_$(echo "$BR" | sed 's/[^A-Za-z0-9._-]/-/g')_$SHA"
  rm -f "$REP.json" "$REP.md"   # a crash must not leave last night's report (same sha) looking like tonight's
  GATE_RESULTS_DIR="$NRES" GATE_COSTS_DIR="$RESULTS" GATE_TOTAL_SECS="$BUDGET" GATE_VISUAL=off \
  GATE_SKIP_BACKEND=$([ "$FO" -eq 1 ] && echo 1 || echo 0) GATE_SKIP_DEV=$([ "$ND" -eq 1 ] && echo 1 || echo 0) \
    timeout -k 30 "$BUDGET" python3 "$ENGINE" "$BR" --tier L --no-visual > "$LOGD/engine.log" 2>&1; ERC=$?
  END=$(date +%s)
  # pytest scratch of the finished run (about 3 GB; runner_cleanup.sh only sweeps the top-level *.logs)
  rm -rf "$REP.logs"/tmp_b* 2>/dev/null
  PART=""; [ "$FO" -eq 1 ] && PART="$PART, no backend"; [ "$ND" -eq 1 ] && PART="$PART, no dev-server phase"
  python3 - "$REP.json" "$BR" "$SHA" "$(( (END-START)/60 ))" "$ERC" "$REP.md" "$LOGD/engine.log" "$PART" > "$OUT" <<'P'
import json, sys, time
path, br, sha, mins, erc, md, elog, part = sys.argv[1:9]
print(f"# Nightly {br} @ {sha}  ({time.strftime('%Y-%m-%d %H:%M')}, {mins} min{part})")
try:
    d = json.load(open(path))
except Exception:
    print(f"- verdict: NO REPORT - the engine wrote no {path} (rc={erc}); see {elog}"); sys.exit(0)
print(f"- verdict: {d['verdict'].upper()} (engine rc={erc}, wall {d['wall_seconds'] // 60} min); full report: {md}")
c = d.get("counts", {})
def line(k, label):
    v = c.get(k)
    return f"- {label}: " + (f"{v['pass']} passed, {v['fail']} failed, {v['flaky']} flaky, {v['known']} known, {v['skipped']} skipped" if v else "not run")
print("- tsc: " + ("OK" if c.get("tsc", {}).get("pass") else "FAILED"))
for k, label in (("backend", "backend (3 shards)"), ("preview", "playwright preview"), ("dev", "playwright dev-server specs"),
                 ("fixture", "playwright fixture specs"), ("pixel", "pixel baselines"), ("release_check", "release_check")):
    print(line(k, label))
print("- phases (min): " + ", ".join(f"{p['name']} {p['seconds'] // 60}" for p in d.get("phases", [])))
fails = [i for i in d.get("items", []) if i["status"] == "FAIL"]
print(); print(f"## Failures ({len(fails)}, first 40)")
for i in fails[:40]:
    print(f"- [{i['category']}] {i['id'][:180]}" + (f" - {i['reason'][:160]}" if i.get("reason") else ""))
fl = [i for i in d.get("items", []) if i["status"] == "FLAKY"]
if fl:
    print(); print(f"## Flaky ({len(fl)}, first 20)")
    for i in fl[:20]:
        print(f"- [{i['category']}] {i['id'][:180]}")
P
  cd "$DIR"
done
