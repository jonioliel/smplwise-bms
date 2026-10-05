#!/usr/bin/env bash
# Disk housekeeping for the Ubuntu test runner (retention rules: scripts/gate/INSTALL_ON_RUNNER.md, "Retention").
#   runner_cleanup.sh            dry run: lists what WOULD be removed and the size, removes nothing
#   runner_cleanup.sh --apply    removes exactly the listed items (the list is also written to ~/smplwise-results/cleanup_<ts>.txt)
# Removes only provable leftovers of finished work:
#   A. pytest --basetemp scratch inside finished runs' log directories (~/smplwise-results/*.logs/tmp_b*, tmp_bretry, tmp1, tmp2)
#      older than 2 hours. pytest wipes a --basetemp at the start of every session anyway; reports (.md/.json), logs and the
#      pw_*.json files (read by release_gate.py prior_costs() for the --workers=1 balancing) are KEPT.
#   B. git worktrees under ~/work of the runner clone ~/smplwisebms whose HEAD is an ancestor of origin/main (merged), whose last
#      checkout is older than 12 hours, that no process uses as its working directory, and whose tracked modifications are only
#      regenerated test output (docs/design/, docs/evidence/, smplwise_vms/www/). Untracked files in them are run output
#      (.tmp_*, *.log, the frontend/node_modules symlink): the runner never authors commits, it checks out pushed branches.
#      Kept always: ~/work/main and the worktree of the newest passing gate (gate_status.json).
# Never runs while a release gate or a nightly/manual suite holds its lock, and stops at once if one starts. Never deletes remote
# branches, never touches ~/smplwisebms itself, never kills processes.
set -uo pipefail
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
RES="$HOME/smplwise-results"; WORK="$HOME/work"; BASE="$HOME/smplwisebms"
MIN_AGE_H="${CLEANUP_MIN_AGE_H:-12}"
ts=$(date +%Y%m%d-%H%M%S); LIST="$RES/cleanup_$ts.txt"

busy() {
  # anchored at the start of the command line, so an ssh command that merely mentions the names does not count
  pgrep -f '^(timeout .*)?python3 [^ ]*release_gate\.py' >/dev/null && return 0
  pgrep -f '^[^ ]*bash [^ ]*(nightly_tests|release_gate)\.sh' >/dev/null && return 0
  grep -q '"state": *"running"' "$RES/gate_status.json" 2>/dev/null && return 0
  return 1   # (no flock probe: taking the gate lock even briefly could make a gate that starts at that moment refuse to run)
}
if busy; then echo "a release gate or nightly run is active: nothing done"; exit 3; fi

cd "$BASE" || exit 2
git fetch -q origin main || { echo "git fetch failed: nothing done"; exit 2; }
keep_gate=""
if [ -f "$RES/gate_status.json" ]; then
  keep_gate=$(python3 -c "import json,sys;d=json.load(open('$RES/gate_status.json'));print('gate-'+d['branch'].replace('/','-') if d.get('state')=='pass' else '')" 2>/dev/null)
fi
inuse=$(for p in /proc/[0-9]*; do readlink "$p/cwd" 2>/dev/null; done | sort -u)
now=$(date +%s)
: > "${LIST}.tmp"

# A. pytest scratch in finished runs
for d in "$RES"/*.logs/tmp_b[0-9]* "$RES"/*.logs/tmp_bretry "$RES"/*.logs/tmp[0-9]; do
  [ -d "$d" ] || continue
  [ $(( (now - $(stat -c %Y "$d")) / 3600 )) -ge 2 ] || continue
  echo "A $(du -sm "$d" | cut -f1) $d" >> "${LIST}.tmp"
done

# B. merged, idle worktrees
git worktree list --porcelain | awk '/^worktree /{print $2}' | grep "^$WORK/" | while read -r wt; do
  n=$(basename "$wt")
  [ "$n" = "main" ] && continue
  [ -n "$keep_gate" ] && [ "$n" = "$keep_gate" ] && continue
  echo "$inuse" | grep -q "^$wt\(/\|$\)" && continue
  gd=$(git -C "$wt" rev-parse --git-dir 2>/dev/null) || continue
  age=$(( (now - $(stat -c %Y "$gd/HEAD")) / 3600 )); [ "$age" -ge "$MIN_AGE_H" ] || continue
  h=$(git -C "$wt" rev-parse HEAD 2>/dev/null) || continue
  git merge-base --is-ancestor "$h" origin/main 2>/dev/null || continue
  other=$(git -C "$wt" status --porcelain --untracked-files=no 2>/dev/null | cut -c4- | grep -v -E '^(docs/design/|docs/evidence/|smplwise_vms/www/)' | head -1)
  [ -z "$other" ] || continue
  echo "B $(du -sm "$wt" | cut -f1) $wt" >> "${LIST}.tmp"
done

total=$(awk '{s+=$2} END {print s+0}' "${LIST}.tmp")
sort -k1,1 -k3 "${LIST}.tmp"
echo "TOTAL ${total} MB in $(wc -l < "${LIST}.tmp") items"
if [ "$APPLY" -ne 1 ]; then rm -f "${LIST}.tmp"; echo "dry run: nothing removed (use --apply)"; exit 0; fi
mv "${LIST}.tmp" "$LIST"
while read -r kind mb path; do
  if busy; then echo "a release gate or nightly run started: stopped before $path"; exit 4; fi
  case "$kind" in
    A) rm -rf --one-file-system -- "$path" && echo "removed $path" ;;
    B) git -C "$BASE" worktree remove --force --force "$path" 2>/dev/null || rm -rf --one-file-system -- "$path"; echo "removed $path" ;;
  esac
done < "$LIST"
git -C "$BASE" worktree prune
df -h /
echo "list: $LIST"
