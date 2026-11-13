#!/usr/bin/env bash
# FIFO queue test for scripts/gate/branch_check.sh (GATE-FIFO-2436): bash scripts/gate/tests/test_branch_check_fifo.sh
# Sources the REAL queue block of branch_check.sh (between its markers) into fake waiters on a temp HOME and proves: FIFO order of
# 3 waiters, the queue position in the log and entry_status.json, pruning of dead / reused-pid tickets, an older pre-FIFO check (no
# ticket) counted as ahead, a younger one not, and --max-wait. Needs flock, ps, timeout and /proc (Linux: run it on the runner).
# Only this test's own processes match ENTRY_PROC_PAT, so real branch checks running on the machine are ignored and untouched.
set -u
S="$(cd "$(dirname "$0")/.." && pwd)/branch_check.sh"
for c in flock ps timeout; do command -v "$c" >/dev/null 2>&1 || { echo "SKIP: $c not found (run on the runner)"; exit 0; }; done
[ -r "/proc/$$/cmdline" ] || { echo "SKIP: no /proc (run on the runner)"; exit 0; }
T=$(mktemp -d); PIDS=()
trap 'for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; rm -rf "$T"' EXIT
export HOME="$T/home"; mkdir -p "$HOME/res"
ID="fifow$$"
export ENTRY_PROC_PAT="${ID}_" BLOCK="$T/block.sh"
QD="$HOME/.smplwise-queue"
fail=0
ok() { if eval "$2"; then echo "PASS $1"; else echo "FAIL $1 (order: $(order))"; for l in "$T"/*.log; do [ -s "$l" ] && sed "s|^|   ${l##*/}: |" "$l"; done; fail=1; fi; }
order() { tr '\n' ' ' < "$HOME/order" 2>/dev/null; }
nq() { ls -A "$QD" 2>/dev/null | wc -l | tr -d ' '; }
sed -n '/^# >>> FIFO queue/,/^# <<< FIFO queue/p' "$S" > "$BLOCK"
ok "queue block found between the markers in branch_check.sh" '[ "$(grep -c "^q_wait()" "$BLOCK")" = 1 ]'

cat > "$T/${ID}_waiter.sh" <<'W'
#!/usr/bin/env bash
# a fake branch check around the real queue: $1 name, $2 seconds to hold the lock, $3 max wait (0 = none)
set -u
BR="$1" TAG="$1" SHA0=abc STARTED=now RES="$HOME/res" SLICE=0.2 MAXW="${3:-0}" T0=$(date +%s)
source "$BLOCK"
exec 8>"$HOME/.smplwise-tests.lock"
trap q_leave EXIT
if q_wait; then echo "$1" >> "$HOME/order"; sleep "$2"; exit 0; fi
echo "$1-maxwait" >> "$HOME/order"; exit 1
W
cat > "$T/${ID}_legacy.sh" <<'L'
#!/usr/bin/env bash
# a fake pre-FIFO branch check: no ticket, just alive for $1 seconds
sleep "$1"; echo "$2" >> "$HOME/order"
L
waiter() { timeout 60 bash "$T/${ID}_waiter.sh" "$@" > "$T/$1.log" 2>&1 9>&- & PIDS+=($!); }   # timeout = a wrapper, as on the runner
legacy() { timeout 60 bash "$T/${ID}_legacy.sh" "$@" 9>&- & PIDS+=($!); }
waitall() { local p; for p in "${PIDS[@]}"; do wait "$p" 2>/dev/null; done; PIDS=(); }
hold() { exec 9>"$HOME/.smplwise-tests.lock"; flock 9; }        # "a running check / gate" holds the tests lock
free() { flock -u 9; exec 9>&-; }

# 1. FIFO: A, B, C queue behind a held lock, in this order; the lock is released; they must run A, B, C
hold
waiter A 0.6; sleep 0.4; waiter B 0.6; sleep 0.4; waiter C 0.6; sleep 1
ok "three live tickets while queued" '[ "$(nq)" = 3 ]'
ok "B logged position 2 of 3, C position 3 of 3" 'grep -q "position 2 of 3" "$T/B.log" && grep -q "position 3 of 3" "$T/C.log"'
ok "entry_status.json carries position and queue_len" 'grep -q "\"state\":\"queued\".*\"position\":[0-9]*,\"queue_len\":3" "$HOME/res/entry_status.json"'
ok "entry_queue.json lists A, B, C in order" 'tr -d "\n" < "$HOME/res/entry_queue.json" | grep -q "\"pos\":1,[^}]*\"branch\":\"A\".*\"pos\":2,[^}]*\"branch\":\"B\".*\"pos\":3,[^}]*\"branch\":\"C\""'
free; waitall
ok "FIFO order A B C" '[ "$(order)" = "A B C " ]'
ok "all tickets removed after the runs" '[ "$(nq)" = 0 ]'

# 2. stale tickets: a dead pid and a live pid that is not a branch check (reused) are pruned; the waiter behind them is not blocked
: > "$HOME/order"
bash -c 'exit 0' & dp=$!; wait "$dp"
sleep 30 & rp=$!; PIDS+=("$rp")
: > "$QD/0000000000000000001-$dp-dead"; : > "$QD/0000000000000000002-$rp-reused"
waiter D 0; wait "${PIDS[-1]}"; kill "$rp" 2>/dev/null; PIDS=()
ok "waiter behind dead tickets got the lock" '[ "$(order)" = "D " ]'
ok "two stale tickets pruned and logged" 'grep -q "pruned 2 stale queue ticket" "$T/D.log" && [ "$(nq)" = 0 ]'

# 3. a pre-FIFO check that started earlier (no ticket, found via ps) is ahead; one that started later is not
: > "$HOME/order"
legacy 3 old-done; sleep 1.5; waiter E 0; waitall
ok "older pre-FIFO check goes first" '[ "$(order)" = "old-done E " ]'
ok "E logged it: position 2 of 2, 1 older pre-FIFO check ahead" 'grep -q "position 2 of 2, 1 older pre-FIFO check(s) ahead" "$T/E.log"'
: > "$HOME/order"
hold; waiter F 0; sleep 1.5; legacy 3 young-done; sleep 0.5; free; waitall
ok "younger pre-FIFO check is not ahead" '[ "$(order)" = "F young-done " ]'

# 4. --max-wait still ends the wait (NOT_RUN in the real script) and removes the ticket
: > "$HOME/order"
echo '{"state":"running","branch":"X"}' > "$HOME/res/entry_status.json"
hold; waiter G 0 1; waitall; free
ok "max wait reached -> rc 1 path, ticket removed" '[ "$(order)" = "G-maxwait " ] && [ "$(nq)" = 0 ]'
ok "a waiter does not overwrite the running check in entry_status.json" 'grep -q "\"state\":\"running\",\"branch\":\"X\"" "$HOME/res/entry_status.json"'

[ "$fail" = 0 ] && echo "FIFO TEST PASSED" || echo "FIFO TEST FAILED"
exit $fail
