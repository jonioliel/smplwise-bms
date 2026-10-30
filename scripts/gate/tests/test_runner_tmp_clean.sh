#!/usr/bin/env bash
# Test for scripts/gate/runner_tmp_clean.sh on a temp directory tree: bash scripts/gate/tests/test_runner_tmp_clean.sh
set -u
S="$(cd "$(dirname "$0")/.." && pwd)/runner_tmp_clean.sh"
T=$(mktemp -d); export RUNNER_HOME="$T/home"; trap 'rm -rf "$T"' EXIT
R="$RUNNER_HOME/smplwise-results"; fail=0
ok() { if eval "$2"; then echo "PASS $1"; else echo "FAIL $1"; fail=1; fi; }
mk() { mkdir -p "$1"; head -c 200000 /dev/zero > "$1/f.bin"; touch -d '3 hours ago' "$1/f.bin" "$1"; }
mk "$R/gate_a.logs/tmp_b1"; mk "$R/gate_a.logs/tmp_b3"; mk "$R/gate_a.logs/tmp_bretry"
mk "$R/gate_a.logs/tmp_b2"; head -c 5000 /dev/zero > "$R/gate_a.logs/tmp_b2/new.bin"       # fresh content inside -> kept
echo '# summary' > "$R/gate_a.md"; echo '{}' > "$R/pw_1.json"; echo x > "$R/gate_a.logs/run.log"
mk "$RUNNER_HOME/work/w1/.tmp_s1"; mk "$RUNNER_HOME/work/w1/.tmp_s2"; mk "$RUNNER_HOME/gate2/g/.tmp_s1"
mk "$RUNNER_HOME/work/w1/.tmp_s3"; mk "$T/outside/.tmp_s1"
ln -s "$T/outside" "$RUNNER_HOME/work/link"
touch -d '3 hours ago' "$R/gate_a.logs"/tmp_b2
out=$(bash "$S" --dry-run); echo "$out" | tail -1
ok "dry-run removes nothing" '[ -d "$R/gate_a.logs/tmp_b1" ] && [ -d "$RUNNER_HOME/work/w1/.tmp_s1" ]'
ok "dry-run lists items" 'echo "$out" | grep -q "would remove.*tmp_b1"'
echo '{"state": "running"}' > "$R/gate_status.json"
bash "$S" >/dev/null; rc=$?
ok "running gate blocks (rc=3)" '[ $rc -eq 3 ] && [ -d "$R/gate_a.logs/tmp_b1" ]'
echo '{"state": "pass"}' > "$R/gate_status.json"
out=$(bash "$S"); echo "$out" | tail -1
ok "old gate temp removed" '[ ! -d "$R/gate_a.logs/tmp_b1" ] && [ ! -d "$R/gate_a.logs/tmp_b3" ] && [ ! -d "$R/gate_a.logs/tmp_bretry" ]'
ok ".tmp_s1/.tmp_s2 removed" '[ ! -d "$RUNNER_HOME/work/w1/.tmp_s1" ] && [ ! -d "$RUNNER_HOME/work/w1/.tmp_s2" ] && [ ! -d "$RUNNER_HOME/gate2/g/.tmp_s1" ]'
ok "fresh content kept" '[ -f "$R/gate_a.logs/tmp_b2/new.bin" ]'
ok "summaries/logs kept" '[ -f "$R/gate_a.md" ] && [ -f "$R/pw_1.json" ] && [ -f "$R/gate_a.logs/run.log" ] && [ -f "$R/gate_status.json" ]'
ok "other names kept" '[ -d "$RUNNER_HOME/work/w1/.tmp_s3" ]'
ok "outside home / symlink untouched" '[ -d "$T/outside/.tmp_s1" ]'
ok "freed size printed" 'echo "$out" | grep -q "^freed [0-9]* MB in 6 items"'
exit $fail
