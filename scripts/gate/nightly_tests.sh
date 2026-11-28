#!/usr/bin/env bash
# Test run for SmplWise Arx - nightly (cron 02:00 Asia/Jerusalem, via --local-hour=02) AND on demand. Installed on the runner as ~/nightly_tests.sh;
# the engine it drives is installed next to it as ~/nightly-gate/{release_gate.py,gate_baselines.json} (see INSTALL_ON_RUNNER.md).
# Usage: nightly_tests.sh [--backend-only] [--frontend-only] [--no-dev] [--local-hour=HH] [branch ...]   [--dry-run]   (default: origin/main only)
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
# So the nightly now runs the release gate ENGINE (tier L; since T074 with the visual step on every screen) for each branch, with its own results directory
# (~/smplwise-results/nightly/: never the dashboard's gate_status.json or gate_*.md) and a per-branch budget inside the hard limit.
#
# Hard limit (FIX1, 2026-10-08): the whole run (after the lock is won) is killed after SW_NIGHTLY_MAX_MIN minutes (default 240): the
# run's own process group is terminated, the lock is released, and <date>_nightly-TIMEOUT.md + nightly_status.json record it.
# The engine has its own deadline (GATE_TOTAL_SECS, set below to what is left minus a margin), so it normally stops itself first
# and still writes a report.
# GATESPEED-293 (2026-10-20): 150 / 120 min no longer fit the suite. Every nightly of 10-15..10-20 stopped at its 117 min engine
# budget with the backend shards cut (3564 of ~12000 tests on 10-20) and the dev-server phase cut (571 of ~916). The tier-L
# gate takes ~151 min and the nightly runs evidence specs on tablet too, so the defaults are now 240 / 225 min (about 160 min
# expected on v1, less with the test database template; SW_NIGHTLY_SCHEDULE=v2 shortens it further). The nightly is the safety
# net of diff selection: it has to FINISH.
# One run at a time (flock): a second start waits or exits. Never kills processes by name (only the PIDs/process groups it started).
# Writes a summary per branch to ~/smplwise-results/<date>_<branch>.md (the dashboard reads the newest 20*.md).
#
# Coverage lane (FIX-CORE-DATA-2570, deep review TR-08): after the engine, on main only (not with --backend-only / --frontend-only), the
# report-only coverage lane scripts/gate/coverage_lane.sh of the tree under test runs (backend line coverage in shards, the gate
# tooling's selftests, the list of live-only specs; it never changes the verdict). Its runtime is bounded so the nightly stays inside
# its hard limit: it runs once a week by default (SW_NIGHTLY_COVERAGE=weekly, on SW_NIGHTLY_COVERAGE_DAY, `date +%u` in
# Asia/Jerusalem, default 6 = the Saturday 02:00 run; =daily every night; =off never), under `timeout` of SW_NIGHTLY_COVERAGE_MAX_MIN
# (default 60) minutes or what is left before the engine's end mark (RUN_END), whichever is less, and not at all with less than
# 20 minutes left. Its shards: SW_NIGHTLY_COVERAGE_SHARDS (default 2). The summary gets one line: the report path, TIMEOUT or
# NOT_RUN with the reason. Expected: the backend in 2 shards with the stdlib recorder, about 40-60 min next to a ~160 min engine run.
#
# arm64 Dockerfile check (FIX-GATE-2570, deep review CD2-08): on main, after the coverage lane, a STATIC check of the add-on
# Dockerfile for the aarch64 image - `docker buildx build --check --platform linux/arm64` in smplwise_vms/ with NO build args, the way
# a Supervisor that passes no BUILD_FROM reads it (nothing is built or pushed; BuildKit only evaluates the Dockerfile and its build
# checks, e.g. a base image of another platform). Report only, never the verdict: one line in the summary (OK, the warnings, FAIL with
# the first error line, TIMEOUT or NOT_RUN with the reason), the full output in arm64_check.log. Bounded by SW_NIGHTLY_ARM64_CHECK_SECS
# (default 300) or what is left before the end mark; SW_NIGHTLY_ARM64_CHECK=off switches it off.
set -uo pipefail
BO=0; FO=0; ND=0; DRY=0; LOCAL_HOUR=""; ARM64_ONLY=""; ARGS=(); ORIG=("$@")
for a in "$@"; do case "$a" in --backend-only) BO=1;; --frontend-only) FO=1;; --no-dev) ND=1;; --dry-run) DRY=1;; --local-hour=*) LOCAL_HOUR="${a#--local-hour=}";; --arm64-check=*) ARM64_ONLY="${a#--arm64-check=}";; *) ARGS+=("$a");; esac; done
set -- "${ARGS[@]+"${ARGS[@]}"}"
# LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-14): the runner's cron ignores CRON_TZ=Asia/Jerusalem, so `0 2 * * *` started at 02:00 UTC
# (04:00 local in winter) and held the tests lock into the morning. --local-hour=HH runs only when it IS HH:xx in Asia/Jerusalem and
# otherwise exits 0 at once (no lock, no fetch, nothing written): the cron line fires at both UTC hours that can be 02:00 local
# (`0 23,0 * * *`: 00:00 UTC in winter, 23:00 UTC in summer) and the wrong one of the two does nothing - DST handled by the zone data, not
# by editing the crontab twice a year. SW_NIGHTLY_NOW=<epoch> replaces "now" (tests only). The inner run (SW_NIGHTLY_INNER) never checks.
if [ -n "$LOCAL_HOUR" ] && [ -z "${SW_NIGHTLY_INNER:-}" ]; then
  case "$LOCAL_HOUR" in [01][0-9]|2[0-3]) ;; *) echo "nightly: --local-hour needs two digits 00-23, got '$LOCAL_HOUR'"; exit 2;; esac
  HOUR_IL=$(TZ=Asia/Jerusalem date -d "@${SW_NIGHTLY_NOW:-$(date +%s)}" +%H)
  if [ "$HOUR_IL" != "$LOCAL_HOUR" ]; then
    echo "$(date -Is) nightly: it is ${HOUR_IL}:xx in Asia/Jerusalem, not ${LOCAL_HOUR}:xx - the other daylight-saving slot of the cron line; nothing run"
    exit 0
  fi
fi
DIR="$HOME/smplwisebms"; RESULTS="$HOME/smplwise-results"; NRES="$RESULTS/nightly"
ENGINE="${SW_NIGHTLY_ENGINE:-$HOME/nightly-gate/release_gate.py}"
MAX_MIN="${SW_NIGHTLY_MAX_MIN:-240}"
BRANCH_MAX_MIN="${SW_NIGHTLY_BRANCH_MAX_MIN:-225}"   # engine budget per branch (the tier-L gate itself needs about 151 min)
# NIGHTLY-2250-297: the nightly runs the v2 schedule by default (SW_NIGHTLY_SCHEDULE=v1 is the rollback). v1 runs the preview phase
# and the dev-server phase one after the other, so one slow dev phase (120 min on 2026-10-27 against 39 on 10-28: the heavy layout
# specs and their alone-retries) pushed the run into the 225 min engine budget ("budget exhausted"). v2 (6 backend shards, one
# Playwright pool, dev specs as pool jobs, largest first) has been the release gates' schedule in the 2.23.0 to 2.25.0 gates (full runs 84-131 min).
SCHEDULE="${SW_NIGHTLY_SCHEDULE:-v2}"
# FIX-CORE-DATA-2570 (TR-08): the coverage lane's schedule and time cap (see the header)
COV_MODE="${SW_NIGHTLY_COVERAGE:-weekly}"; COV_DAY="${SW_NIGHTLY_COVERAGE_DAY:-6}"; COV_MAX_MIN="${SW_NIGHTLY_COVERAGE_MAX_MIN:-60}"
case "$COV_MAX_MIN" in ''|*[!0-9]*) COV_MAX_MIN=60;; esac
case "$COV_DAY" in [1-7]) ;; *) COV_DAY=6;; esac
coverage_today() { # prints "run", or "skip: <reason>"
  case "$COV_MODE" in
    off) echo "skip: SW_NIGHTLY_COVERAGE=off";;
    daily) echo "run";;
    *) local d; d=$(TZ=Asia/Jerusalem date -d "@${SW_NIGHTLY_NOW:-$(date +%s)}" +%u)
       if [ "$d" = "$COV_DAY" ]; then echo "run"; else echo "skip: weekly lane on day $COV_DAY, today is day $d"; fi;;
  esac
}
# FIX-GATE-2570 (CD2-08): the static arm64 Dockerfile check (see the header). Prints ONE summary line; never changes the verdict.
# Uses DIR (the tree under test, checked out at the branch), SHA, LOGD and RUN_END of the caller.
ARM64_MODE="${SW_NIGHTLY_ARM64_CHECK:-on}"; ARM64_SECS="${SW_NIGHTLY_ARM64_CHECK_SECS:-300}"
case "$ARM64_SECS" in ''|*[!0-9]*) ARM64_SECS=300;; esac
arm64_base_image() { # the image of the Dockerfile's first FROM with the ARG defaults filled in (what a Supervisor without build args uses)
  awk '
    function lit(str, from, to,   i) { while ((i = index(str, from)) > 0) str = substr(str, 1, i - 1) to substr(str, i + length(from)); return str }
    toupper($1) == "ARG" { n = index($2, "="); if (n > 1) def[substr($2, 1, n - 1)] = substr($2, n + 1); next }
    toupper($1) == "FROM" { img = $2; if ($2 ~ /^--platform/) img = $3
      for (k in def) { img = lit(img, "${" k "}", def[k]); if (img == "$" k) img = def[k] }
      print img; exit }' "$1"
}
arm64_check_line() {
  local df="$DIR/smplwise_vms/Dockerfile" log="$LOGD/arm64_check.log" cap="$ARM64_SECS" left rc img plat
  left=$(( ${RUN_END:-$(( $(date +%s) + cap ))} - $(date +%s) )); [ "$cap" -gt "$left" ] && cap=$left
  if [ "$ARM64_MODE" = "off" ]; then echo "- arm64 Dockerfile check: NOT_RUN (SW_NIGHTLY_ARM64_CHECK=off)"; return; fi
  if [ ! -f "$df" ]; then echo "- arm64 Dockerfile check: NOT_RUN (no smplwise_vms/Dockerfile at ${SHA:-?})"; return; fi
  if ! docker buildx version >/dev/null 2>&1; then echo "- arm64 Dockerfile check: NOT_RUN (docker buildx is not available)"; return; fi
  if [ "$cap" -lt 30 ]; then echo "- arm64 Dockerfile check: NOT_RUN (only ${left} s left of the ${MAX_MIN} min limit)"; return; fi
  # 1) BuildKit's static checks for linux/arm64 with NO --build-arg (the Dockerfile's own defaults); --check builds nothing
  ( cd "$DIR/smplwise_vms" && timeout -k 10 "$cap" docker buildx build --check --platform linux/arm64 -f Dockerfile . ) > "$log" 2>&1; rc=$?
  # 2) --check does NOT compare the base image's platforms (an amd64-only default passes it - runner, 28.11): the default base image
  #    must itself list linux/arm64 (registry manifest only, nothing pulled)
  img="$(arm64_base_image "$df")"; plat=""
  if [ -n "$img" ] && [ "$rc" -ne 124 ] && [ "$rc" -ne 137 ]; then
    { echo; echo "== docker buildx imagetools inspect $img"; } >> "$log"
    timeout -k 10 120 docker buildx imagetools inspect "$img" >> "$log" 2>&1 && plat="$(sed -n '/== docker buildx imagetools inspect/,$p' "$log" | grep -oE 'Platform: +[a-z0-9]+/[a-z0-9]+' | awk '{print $2}' | sort -u | tr '\n' ' ')"
  fi
  case "$rc" in
    124|137) echo "- arm64 Dockerfile check (report only): TIMEOUT after ${cap} s; see $log"; return;;
  esac
  local chk="build checks OK"
  if [ "$rc" -ne 0 ] || grep -qiE '^WARNING|[1-9][0-9]* warnings? found' "$log"; then
    chk="build checks rc=$rc: $(grep -m1 -iE 'warnings? found|^WARNING|error' "$log" | cut -c1-160)"
  fi
  if [ -z "$img" ]; then echo "- arm64 Dockerfile check (report only): FAIL - no FROM image found; $chk; see $log"
  elif [ -z "$plat" ]; then echo "- arm64 Dockerfile check (report only): FAIL - the default base image $img could not be inspected; $chk; see $log"
  elif ! printf '%s' " $plat" | grep -q ' linux/arm64 '; then
    echo "- arm64 Dockerfile check (report only): FAIL - the default base image $img has no linux/arm64 (platforms: ${plat% }) - an aarch64 Supervisor without BUILD_FROM builds on it; $chk; see $log"
  elif [ "$chk" = "build checks OK" ]; then echo "- arm64 Dockerfile check (report only): OK - default base $img has linux/arm64; build checks found nothing (nothing built)"
  else echo "- arm64 Dockerfile check (report only): WARNINGS - default base $img has linux/arm64; $chk; see $log"
  fi
}
if [ -n "$ARM64_ONLY" ]; then   # FIX-GATE-2570: the check alone on a checkout (selftest / by hand); prints the summary line
  DIR="$ARM64_ONLY"; SHA="$(git -C "$DIR" rev-parse --short HEAD 2>/dev/null || echo '?')"; LOGD="${SW_NIGHTLY_ARM64_LOGD:-$(mktemp -d)}"
  arm64_check_line; exit 0
fi
if [ "$DRY" -eq 1 ]; then
  if [ "$#" -gt 0 ]; then echo "branches: $*"; else echo "branches: main"; fi
  echo "flags: backend-only=$BO frontend-only=$FO no-dev=$ND; hard limit ${MAX_MIN} min; per-branch engine budget ${BRANCH_MAX_MIN} min; schedule ${SCHEDULE}; lock wait ${SW_NIGHTLY_LOCK_WAIT:-10800} s"
  echo "engine: $ENGINE ($([ -f "$ENGINE" ] && echo present || echo MISSING)); workers per Playwright process: ${GATE_PW_WORKERS:-3}"
  echo "coverage lane: $(coverage_today) (mode $COV_MODE, day $COV_DAY, cap ${COV_MAX_MIN} min, main only, after the engine)"
  echo "arm64 Dockerfile check: $ARM64_MODE (cap ${ARM64_SECS} s, main only, after the coverage lane, report only)"; exit 0
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
# NIGHTLYFIX-295: disk preflight. On 2026-10-21 the runner disk was at 100 percent (0 bytes free): a full run writes about 8 GB
# (pytest scratch of three shards, Playwright reports, a build) and would die half way with an unreadable error. Refuse early and say
# why (runner_cleanup.sh cannot be called from here: it stays out of the way while a nightly runs). SW_NIGHTLY_MIN_FREE_GB=0 disables.
MIN_FREE_GB="${SW_NIGHTLY_MIN_FREE_GB:-25}"
FREE_GB=$(df -Pk "$RESULTS" 2>/dev/null | awk 'NR==2 {print int($4/1048576)}')
if [ "$MIN_FREE_GB" -gt 0 ] && [ -n "$FREE_GB" ] && [ "$FREE_GB" -lt "$MIN_FREE_GB" ]; then
  { echo "# Nightly NOT RUN: disk almost full ($(date '+%F %H:%M'))"; echo "- free: ${FREE_GB} GB on the results volume, needed: ${MIN_FREE_GB} GB"; echo "- run ~/runner_cleanup.sh --apply (and clear stale ~/work worktrees / caches), then start the nightly again"; } > "$RESULTS/$(date +%F)_nightly-NODISK.md"
  printf '{"state":"nodisk","free_gb":%s,"need_gb":%s,"time":"%s","epoch":%s}
' "$FREE_GB" "$MIN_FREE_GB" "$(date -Is)" "$(date +%s)" > "$RESULTS/nightly_status.json"
  echo "nightly not run: only ${FREE_GB} GB free (need ${MIN_FREE_GB})"; exit 5
fi
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
  # GATESPEED-293: SW_NIGHTLY_SCHEDULE=v2 runs the nightly on the v2 schedule (6 shards on tmpfs, one Playwright pool); default v1.
  # The nightly is the safety net of --select-base, so it must FINISH: in 2026-10-16..20 every nightly hit the 117 min engine
  # budget (the backend was cut, e.g. 3564 of ~12000 tests on 10-20); raise SW_NIGHTLY_MAX_MIN / SW_NIGHTLY_BRANCH_MAX_MIN or use v2
  # T074: the visual matrix runs as the engine's visual step on EVERY screen (GATE_VISUAL_SCOPE=all) and all three viewports, with the
  # flaky-render retry. Before, with --no-visual, visual-matrix.spec.ts ran inside the pixel group (desktop + mobile, no retry), also
  # blocking - so the nightly stays as strict and gains tablet and the retry. SW_NIGHTLY_VISUAL=warn makes it a report section only,
  # SW_NIGHTLY_VISUAL=off is the rollback (the old run: --no-visual, the spec back in the pixel group).
  VMODE="${SW_NIGHTLY_VISUAL:-block}"; NV=(); case "$VMODE" in warn|block) ;; *) VMODE=off; NV=(--no-visual);; esac
  # GATE-HARDEN-2520 (TR-02): record whether the nightly engine is the tree's (warn only: main may be older than an engine that was
  # installed ahead of its release); the record sits next to the report, the line goes into the engine log
  if [ -f "$HOME/gate2/engine_sync.py" ] && [ "$ENGINE" = "$HOME/nightly-gate/release_gate.py" ]; then
    python3 "$HOME/gate2/engine_sync.py" check --set nightly --warn-only --repo "$DIR" --ref "origin/$BR" --home "$HOME" --json "$REP.engine.json" > "$LOGD/engine_sync.log" 2>&1
  fi
  # owner 25.11 (Q11 a): lighter nightly - same parallelism as the release gate, so it no longer fills RAM + swap
  GATE_PW_SLOTS="${SW_NIGHTLY_PW_SLOTS:-8}" GATE_BACKEND_SHARDS="${SW_NIGHTLY_SHARDS:-4}" GATE_PW_MAX_WORKERS="${SW_NIGHTLY_PW_MAX_WORKERS:-4}" GATE_MIN_FREE_MB="${SW_NIGHTLY_MIN_FREE_MB:-3000}" \
  GATE_SCHEDULE="$SCHEDULE" GATE_TABLET_FULL=1 GATE_RESULTS_DIR="$NRES" GATE_COSTS_DIR="$RESULTS" GATE_TOTAL_SECS="$BUDGET" GATE_VISUAL="$VMODE" GATE_VISUAL_SCOPE=all \
  GATE_SKIP_BACKEND=$([ "$FO" -eq 1 ] && echo 1 || echo 0) GATE_SKIP_DEV=$([ "$ND" -eq 1 ] && echo 1 || echo 0) \
    timeout -k 30 "$BUDGET" python3 "$ENGINE" "$BR" --tier L ${NV[@]+"${NV[@]}"} > "$LOGD/engine.log" 2>&1; ERC=$?
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
v = d.get("visual") or {}
if v.get("counts"):   # T074: every screen against the linux baselines (block: a twice-differing case fails, a retry-match is FLAKY)
    vc = v["counts"]
    print(f"- visual matrix ({v.get('mode')}, {v.get('scope')} screens): first run {vc['pass']} pass, {vc['diff']} differ, {vc['error']} error, "
          f"{vc['nobase']} without a linux baseline; flaky {len(v.get('flaky', []))}, failed {len(v.get('failed', []))}"
          + (f"; differing: {', '.join(v.get('diffs', [])[:8])}" if v.get("diffs") else ""))
elif v:
    print(f"- visual matrix: {v.get('error') or v.get('summary')}")
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
  # ENTRY-CHECK-2310 (owner 30.10 night): every nightly report lists the ONE quarantine list - active entries (ticket, expiry <= 7 days),
  # EXPIRED ones (their tests count as failures again) and invalid ones. Information only here: the engine verdict above is unchanged.
  GQ="${SW_GATE2_DIR:-$HOME/gate2}/gate_quarantine.py"
  if [ -f "$GQ" ]; then
    { echo; python3 "$GQ" md --file "${SW_QUARANTINE_FILE:-$(dirname "$GQ")/gate2_quarantine.json}"; } >> "$OUT" 2>>"$LOGD/engine.log"
  fi
  # T074 (docs/changes/T074-VISUAL-METRICS-2405.md): time to camera / time to recording, from what the lead dropped into
  # ~/smplwise-results/video_timing/ (an add-on log *.log, audit API exports *.json, a database copy *.sqlite; read-only, no device is
  # touched). Report only - no --enforce while the limits are PROVISIONAL; no input = a NOT_RUN line, never a pass.
  VT="${SW_VIDEO_TIMING_PY:-$(dirname "$ENGINE")/video_timing.py}"; VTIN="${SW_VIDEO_TIMING_DIR:-$RESULTS/video_timing}"
  if [ "$BR" = "main" ] && [ -f "$VT" ]; then
    VARGS=(); VFILES=""
    for f in "$VTIN"/*.log "$VTIN"/*.json "$VTIN"/*.sqlite; do
      [ -f "$f" ] || continue
      case "$f" in *.log) VARGS+=(--log "$f");; *.json) VARGS+=(--audit-json "$f");; *.sqlite) VARGS+=(--db "$f");; esac
      VFILES="$VFILES $(basename "$f") ($(date -r "$f" +%F))"
    done
    if [ "${#VARGS[@]}" -gt 0 ]; then
      { echo; python3 "$VT" report "${VARGS[@]}" --json "$NRES/video_timing_$(date +%F).json"; echo "- input files:$VFILES"; } >> "$OUT" 2>>"$LOGD/engine.log"
    else
      { echo; echo "## Time to camera / time to recording (T074): NOT_RUN - no input in $VTIN"; } >> "$OUT"
    fi
  fi
  # GATESPEED-293 safety net: this FULL run (no selection) against the release gates that ran a diff selection
  # (--select-base): every nightly red in a file such a run dropped is listed in <date>_selection-audit.md
  SEL="$(dirname "$ENGINE")/select_tests.py"
  if [ "$BR" = "main" ] && [ -f "$SEL" ] && [ -f "$REP.json" ] && ls "$RESULTS"/gate_*.selection.json >/dev/null 2>&1; then
    python3 "$SEL" audit --nightly "$REP.json" --selections-dir "$RESULTS" --out "$RESULTS/$(date +%F)_selection-audit.md" \
      >> "$LOGD/engine.log" 2>&1 && echo "- selection audit: $RESULTS/$(date +%F)_selection-audit.md" >> "$OUT"
  fi
  # FIX-CORE-DATA-2570 (deep review TR-08): the report-only coverage lane, bounded (see the header); one line in the summary
  if [ "$BR" = "main" ] && [ "$FO" -eq 0 ]; then
    COV="$(coverage_today)"; COVSH="$DIR/scripts/gate/coverage_lane.sh"
    LEFT=$(( RUN_END - $(date +%s) )); CAP=$(( COV_MAX_MIN * 60 )); [ "$CAP" -gt "$LEFT" ] && CAP=$LEFT
    if [ "$COV" != "run" ]; then echo "- coverage lane: NOT_RUN (${COV#skip: })" >> "$OUT"
    elif [ ! -f "$COVSH" ]; then echo "- coverage lane: NOT_RUN (no scripts/gate/coverage_lane.sh at $SHA)" >> "$OUT"
    elif [ "$CAP" -lt 1200 ]; then echo "- coverage lane: NOT_RUN (only $(( LEFT / 60 )) min left of the ${MAX_MIN} min limit)" >> "$OUT"
    else
      COVOUT="$RESULTS/coverage/$(date +%F)_$SHA"; C0=$(date +%s)
      ( cd "$DIR" && timeout -k 30 "$CAP" bash "$COVSH" --root "$DIR" --out "$COVOUT" --shards "${SW_NIGHTLY_COVERAGE_SHARDS:-2}" ) > "$LOGD/coverage_lane.log" 2>&1; CRC=$?
      case "$CRC" in
        124|137) echo "- coverage lane: TIMEOUT after $(( CAP / 60 )) min (report only; partial files in $COVOUT)";;
        *) echo "- coverage lane (report only, never the verdict): $COVOUT/coverage.md ($(( ($(date +%s) - C0) / 60 )) min)";;
      esac >> "$OUT"
    fi
  fi
  # FIX-GATE-2570 (CD2-08): the static arm64 Dockerfile check, report only, bounded (see the header); one line in the summary
  if [ "$BR" = "main" ]; then
    arm64_check_line >> "$OUT"
  fi
  cd "$DIR"
done
