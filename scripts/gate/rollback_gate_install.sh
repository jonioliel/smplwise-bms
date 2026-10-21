#!/usr/bin/env bash
# GATEEFF2-295: one-command rollback of the GATEEFF-295 / GATEEFF2-295 install on the runner (docs/release/GATE_V2_ROLLOUT.md section 5).
#   ~/rollback_gate_install.sh [--dry-run] [BACKUP_DIR]       BACKUP_DIR defaults to the newest ~/gate-backup-* directory
# Restores every file the install step backed up (release_gate.sh/.py, nightly_tests.sh, select_tests.py, shadow_compare.py,
# gate_baselines.json, gate_durations.json, selftest_gate.py, and ~/nightly-gate/*), then removes the files that did not exist before the
# install (gate_policy.py, gate_quarantine.json, gate_schedule_evidence.json select_tests.py, shadow_compare.py, tier_domain_map.py).
# Refuses while a gate or a nightly is running. Never kills a process. Prints md5 of every restored file. Does not touch results,
# worktrees, ~/known_issues.json or the cron table.
set -uo pipefail
DRY=0; D=""
for a in "$@"; do case "$a" in --dry-run) DRY=1;; *) D="$a";; esac; done
[ -n "$D" ] || D="$(ls -d "$HOME"/gate-backup-* 2>/dev/null | sort | tail -1)"
[ -n "$D" ] && [ -d "$D" ] || { echo "no backup directory (looked for ~/gate-backup-*)"; exit 2; }
if [ -e "$HOME/.gate-pending" ]; then echo "refused: ~/.gate-pending exists"; exit 3; fi
if pgrep -f 'release_gate\.py|nightly_tests\.sh' >/dev/null 2>&1; then echo "refused: a gate or a nightly is running (pgrep)"; exit 3; fi
echo "backup: $D"
run() { if [ "$DRY" -eq 1 ]; then echo "DRY: $*"; else "$@"; fi; }
for f in "$D"/*; do
  [ -f "$f" ] || continue
  run cp -p "$f" "$HOME/$(basename "$f")" && echo "restored ~/$(basename "$f")  $(md5sum "$f" | cut -c1-12)"
done
if [ -d "$D/nightly-gate" ]; then
  for f in "$D"/nightly-gate/*; do
    [ -f "$f" ] || continue
    run cp -p "$f" "$HOME/nightly-gate/$(basename "$f")" && echo "restored ~/nightly-gate/$(basename "$f")  $(md5sum "$f" | cut -c1-12)"
  done
fi
for new in gate_policy.py gate_quarantine.json gate_schedule_evidence.json select_tests.py shadow_compare.py tier_domain_map.py; do
  for dir in "$HOME" "$HOME/nightly-gate"; do
    if [ -e "$dir/$new" ] && [ ! -e "$D/$([ "$dir" = "$HOME" ] || echo nightly-gate/)$new" ]; then run rm -f "$dir/$new" && echo "removed $dir/$new (did not exist before the install)"; fi
  done
done
chmod +x "$HOME/release_gate.sh" "$HOME/nightly_tests.sh" 2>/dev/null
[ "$DRY" -eq 1 ] && echo "dry run: nothing changed" || echo "rollback done; check: ~/nightly_tests.sh --dry-run"
