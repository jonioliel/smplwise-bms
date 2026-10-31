#!/usr/bin/env bash
# LOCAL early check (GATE-SPEED-2320): what every agent runs on the workstation BEFORE pushing - no runner, ~3-5 min.
#   scripts/gate/early_local.sh [--base <ref>] [--only a,b] [--skip a,b]
# Runs, in parallel, on the current checkout: spec-lint (new specs since the base), tsc, the repository-wide unit rule specs
# (gate_early_check.json), the backend lint tests and release_check. The early layout list is runner only (branch_early.sh).
# Needs frontend/node_modules (a worktree: link it to a checkout that has one) and a python with pytest for the backend part
# (EARLY_BACKEND_PYTHON, else <repo>/.venv, else the main checkout's .venv, else python3). Exit 0 GREEN, 1 RED / NOT_RUN.
# Files: $TMPDIR/smplwise-early/entry_early_<branch>_<sha>.md + .json (EARLY_OUT_DIR to change).
set -uo pipefail
case "${1:-}" in -h|--help) sed -n 2,8p "$0"; exit 0;; esac
G="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$G" rev-parse --show-toplevel)" || { echo "early_local: not inside a git checkout"; exit 2; }
BASE="origin/main" EXTRA=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:-}"; shift 2;;
    --only|--skip) EXTRA+=("$1" "${2:-}"); shift 2;;
    *) echo "unknown option $1 (see --help)"; exit 2;;
  esac
done
pick_py() {
  local c common
  for c in "${EARLY_BACKEND_PYTHON:-}" "$ROOT/.venv/bin/python" "$ROOT/.venv/Scripts/python.exe"; do [ -n "$c" ] && [ -x "$c" ] && { echo "$c"; return; }; done
  common="$(cd "$ROOT" && cd "$(git rev-parse --git-common-dir)/.." && pwd)"
  for c in "$common/.venv/bin/python" "$common/.venv/Scripts/python.exe"; do [ -x "$c" ] && { echo "$c"; return; }; done
  command -v python3 || command -v python
}
BPY="$(pick_py)"
PY3="${GATE2_PYTHON:-$BPY}"
OUT="${EARLY_OUT_DIR:-${TMPDIR:-/tmp}/smplwise-early}"
T0=$(date +%s)
"$PY3" "$G/early_check.py" run --root "$ROOT" --base "$BASE" --where local --out-dir "$OUT" --backend-python "$BPY" "${EXTRA[@]}"
rc=$?
echo "early_local: wall time $(( $(date +%s) - T0 )) s"
exit $rc
