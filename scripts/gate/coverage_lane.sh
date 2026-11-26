#!/usr/bin/env bash
# LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-08): a REPORT-ONLY coverage lane. It never fails anything and is part of no gate: exit 0
# always, the findings are in the report. Three parts:
#   1. backend line coverage: the backend tests in shards (one pytest process per shard, like the gate), each with the stdlib recorder
#      of coverage_lane.py (`-p coverage_lane`, Python 3.12 sys.monitoring - nothing to install), then one merged Markdown report:
#      total, the least-covered modules, the modules no test imported;
#   2. the gate tooling's own selftests (selftest_*.py), which no gate or nightly runs: PASS / FAIL / TIMEOUT per file (TR-08 item 6);
#   3. the live-only Playwright specs (`SW_LIVE !== '1'` skip guards): they run only against the lab by hand (TR-08 item 5).
# Usage: coverage_lane.sh [--root <checkout>] [--out <dir>] [--shards N] [--no-selftests] [test file ...]
#   --root    the checkout (default: this script's repository); the backend tests run from <root>/smplwise_vms/backend
#   --out     the report directory (default: ~/smplwise-results/coverage/<date>_<sha>)
#   --shards  parallel pytest processes (default 2: the runner's 16 GB are shared with gates and agents)
#   test files: tests/test_x.py ... (default: every backend test file)
# On the runner, through the slot wrapper: ~/work/slotb.sh bash <checkout>/scripts/gate/coverage_lane.sh --root <checkout>
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"; OUT=""; SHARDS=2; SELF=1; FILES=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --root) ROOT="$(cd "$2" && pwd)"; shift 2;;
    --out) OUT="$2"; shift 2;;
    --shards) SHARDS="$2"; shift 2;;
    --no-selftests) SELF=0; shift;;
    -h|--help) sed -n '2,14p' "$0"; exit 0;;
    *) FILES+=("$1"); shift;;
  esac
done
case "$SHARDS" in ''|*[!0-9]*|0) SHARDS=2;; esac
BACKEND="$ROOT/smplwise_vms/backend"
SHA="$(git -C "$ROOT" rev-parse --short=9 HEAD 2>/dev/null || echo nosha)"
OUT="${OUT:-$HOME/smplwise-results/coverage/$(date +%F)_$SHA}"
mkdir -p "$OUT" || { echo "coverage lane: cannot create $OUT"; exit 0; }
PY=""
for c in "$ROOT/.venv/bin/python" "$HOME/smplwisebms/.venv/bin/python" "$(command -v python3 || true)"; do
  [ -n "$c" ] && [ -x "$c" ] && { PY="$c"; break; }
done
REPORT="$OUT/coverage.md"
if [ -z "$PY" ]; then echo "# Coverage lane: NOT RUN (no python)" > "$REPORT"; echo "coverage lane: no python"; exit 0; fi

# --- 1. backend line coverage
if [ "${#FILES[@]}" -eq 0 ]; then
  mapfile -t FILES < <(cd "$BACKEND" && ls -S tests/test_*.py 2>/dev/null)
fi
declare -a SH
for i in "${!FILES[@]}"; do k=$(( i % SHARDS )); SH[$k]="${SH[$k]:-} ${FILES[$i]}"; done
PIDS=()
for k in $(seq 0 $(( SHARDS - 1 ))); do
  [ -n "${SH[$k]:-}" ] || continue
  # shellcheck disable=SC2086 - the shard is a list of file names without spaces (tests/test_*.py)
  ( cd "$BACKEND" && SW_COVERAGE_OUT="$OUT/shard_$k.json" SW_COVERAGE_SRC="$BACKEND/smplwise" PYTHONPATH="$HERE${PYTHONPATH:+:$PYTHONPATH}" \
      "$PY" -m pytest -o addopts= -q -p no:cacheprovider -p coverage_lane -m "not timing_lane" --basetemp "$OUT/tmp_$k" ${SH[$k]} \
      > "$OUT/shard_$k.log" 2>&1; echo "$?" > "$OUT/shard_$k.rc" ) &
  PIDS+=("$!")
done
for p in "${PIDS[@]}"; do wait "$p"; done
rm -rf "$OUT"/tmp_* 2>/dev/null
"$PY" "$HERE/coverage_lane.py" report --src "$BACKEND/smplwise" --out "$REPORT" --json "$OUT/coverage.json" "$OUT"/shard_*.json
{
  echo; echo "## The pytest shards (their failures are the gate's business; listed so a broken shard is not read as low coverage)"; echo
  for f in "$OUT"/shard_*.log; do
    [ -f "$f" ] || continue
    n="$(basename "$f" .log)"; echo "- $n: exit $(cat "$OUT/$n.rc" 2>/dev/null || echo '?'); $(grep -E '[0-9]+ (passed|failed)' "$f" | tail -n 1)"
  done
} >> "$REPORT"

# --- 2. the gate tooling's own selftests
if [ "$SELF" -eq 1 ]; then
  { echo; echo "## Gate tooling selftests (scripts/gate/selftest_*.py; run by no gate or nightly)"; echo; } >> "$REPORT"
  for t in "$ROOT"/scripts/gate/selftest_*.py; do
    [ -f "$t" ] || continue
    n="$(basename "$t")"
    ( cd "$ROOT" && timeout -k 10 900 "$PY" "$t" > "$OUT/$n.log" 2>&1 ); rc=$?
    case "$rc" in 0) v=PASS;; 124|137) v=TIMEOUT;; *) v="FAIL (exit $rc)";; esac
    echo "- \`$n\`: $v" >> "$REPORT"
  done
fi

# --- 3. live-only Playwright specs
{
  echo; echo "## Live-only Playwright specs (skipped unless SW_LIVE=1: they run against the lab by hand)"; echo
  live=$(grep -l "SW_LIVE !== '1'" "$ROOT"/frontend/tests/*.spec.ts 2>/dev/null | xargs -r -n1 basename | sort)
  echo "- files: $(printf '%s\n' "$live" | grep -c . )"
  printf '%s\n' "$live" | sed '/^$/d; s/^/  - `/; s/$/`/'
} >> "$REPORT"
echo "coverage lane: report $REPORT"
exit 0
