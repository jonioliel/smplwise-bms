#!/usr/bin/env bash
# THE release-gate entry point (GATE-FAST-2291, item 2): one command, one rule. Runs the gate-2 wrapper (release_gate2.sh), which holds
# the locks, selects by change and runs the engine; this wrapper only decides FULL or SELECT first, with gate_entry.py.
#   gate_release.sh <branch> [--full] [--resume] [--base <ref>] [--after <red gate report .json>] [--accept-stale-nightly]
#                   [--dry-run [--root <checkout>]] [--depth N] [--keep-heavy] [-- <extra engine args>]
# The rule (gate_entry.py rule):
#   * the fast (change-based) gate is OFF until the lead creates the flag file ~/.gate_fast_enabled (owner answer 2A: only after the
#     Friday 30.10 full run ended green or with explained failures). Flag absent -> every gate is the FULL tier on the v2 schedule.
#   * flag present: newest full nightly on main  GREEN -> change-based selection;  RED only through quarantined tests (ticket + expiry)
#     -> selection, failures listed;  RED with a non-quarantined failure, STALE (> 36 h) or MISSING -> FULL tier, with the reason printed.
#   * --full always runs the full tier. --after <report> is the targeted re-run after a red gate; release_gate2.sh runs it only with
#     a coverage anchor behind the head (GATE-TRUST-2540, TR-09: a completed full run or a green nightly at a near ancestor), else FULL.
#   * the BLOCKING backend lint lane runs in release_gate2.sh on the worktree of the branch under test (GATE-TRUST-2540, TR-05).
#   * tagging a release additionally needs a FULL green nightly on main <= 7 days old: `python3 gate_entry.py tagcheck` (plan rule 3A).
# Exit codes are release_gate2.sh's: 0 pass, 1 fail, 2 usage, 3 lock busy.
# Install: scripts/gate/README_GATE_FAST.md (the lead installs it, never while a gate runs).
set -uo pipefail
export PATH="$HOME/smplwisebms/.venv/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
case "${1:-}" in -h|--help|"") sed -n 2,16p "$0"; exit 0;; esac
G="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
PY3="${GATE2_PYTHON:-python3}"
RES="${GATE_RESULTS_DIR:-$HOME/smplwise-results}"
[ -f "$G/release_gate2.sh" ] && [ -f "$G/gate_entry.py" ] || { echo "release_gate2.sh and gate_entry.py must sit next to $0 ($G)"; exit 2; }

HEAD_ARGS=() TAIL_ARGS=() FULL=0 AFTER=0 seen_dd=0
for a in "$@"; do
  if [ "$seen_dd" = 1 ]; then TAIL_ARGS+=("$a"); continue; fi
  case "$a" in
    --) seen_dd=1;;
    --full) FULL=1;;
    --after) AFTER=1; HEAD_ARGS+=("$a");;
    *) HEAD_ARGS+=("$a");;
  esac
done

# a targeted re-run after a red gate: no nightly decision here; release_gate2.sh checks its coverage anchor (TR-09) and lints (TR-05)
if [ "$AFTER" = 1 ] && [ "$FULL" = 0 ]; then
  echo "gate_release: targeted re-run (--after) -> release_gate2.sh (coverage anchor check, backend lint on its worktree)"
  exec "$G/release_gate2.sh" "${HEAD_ARGS[@]}" ${TAIL_ARGS[@]+-- "${TAIL_ARGS[@]}"}
fi

DEC="$("$PY3" "$G/gate_entry.py" decide --results "$RES" $([ "$FULL" = 1 ] && echo --full))"; DRC=$?
# CR-PYFLAKES-ENFORCE-2442: exit 3 = the backend lint lane blocks. Since GATE-TRUST-2540 (TR-05) `decide` no longer lints (it ran before any
# worktree existed and linted ~/smplwisebms); release_gate2.sh lints its own worktree. Kept for an older gate_entry.py.
if [ "$DRC" = 3 ]; then echo "gate_release: RED - the backend lint (ruff F) has findings; nothing was run. Fix them (GATE_BACKEND_LINT=warn reports without blocking)."; exit 1; fi
[ "$DRC" = 0 ] || { echo "gate_entry.py failed; running the FULL tier"; DEC='{"mode": "full", "state": "entry-error", "why": "gate_entry.py failed"}'; }
jget() { printf '%s' "$DEC" | "$PY3" -c 'import json,sys; print(json.load(sys.stdin).get(sys.argv[1], ""))' "$1"; }
MODE="$(jget mode)"; STATE="$(jget state)"; WHY="$(jget why)"
echo "gate_release: mode=$MODE (nightly/entry state: $STATE) - $WHY"
if [ "$STATE" = red ] || [ "$STATE" = broken ]; then
  printf '%s' "$DEC" | "$PY3" -c 'import json,sys; [print("  failing nightly test:", x) for x in json.load(sys.stdin).get("failing", [])]'
fi
if [ "$STATE" = explained ]; then
  printf '%s' "$DEC" | "$PY3" -c 'import json,sys; [print("  explained (quarantined):", x) for x in json.load(sys.stdin).get("explained", [])]'
  HEAD_ARGS+=(--accept-stale-nightly)    # the gate-2 wrapper itself only trusts a green nightly; this rule already judged the red one
fi
[ "$MODE" = full ] && HEAD_ARGS+=(--full)
exec "$G/release_gate2.sh" "${HEAD_ARGS[@]}" ${TAIL_ARGS[@]+-- "${TAIL_ARGS[@]}"}
