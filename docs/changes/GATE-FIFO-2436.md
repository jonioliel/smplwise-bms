# GATE-FIFO-2436 - FIFO queue for the runner entry check

Branch `pilot/GATE-FIFO-2436` (from `origin/main` @ ab7894837). Tooling only: `scripts/gate/`, no product code, no UI.

## Problem

`branch_check.sh` waited for `~/.smplwise-tests.lock` with `flock -w 30` in a loop. Every waiter retried the same lock, so the order
was a lottery: on 2026-11-12 a check queued at 21:53 the evening before had waited about 10 h while checks queued later ran first.
Its `--max-wait` (12 h default) would then end it as NOT_RUN ("queue limit reached"). Seven checks were waiting.

## Change

- `scripts/gate/branch_check.sh`: a FIFO block (between `# >>> FIFO queue` and `# <<< FIFO queue`, functions only) replaces the loop.
  - Each check writes a ticket `~/.smplwise-queue/<epoch_ns>-<pid>-<branch>`; only the oldest live ticket calls `flock -w`; the others
    sleep `ENTRY_LOCK_SLICE`. The ticket is kept while the check runs (position 1) and removed by the EXIT trap.
  - Pruning: a ticket whose pid is dead, or whose pid now runs something that is not a branch check (`/proc/<pid>/cmdline` does not
    match `ENTRY_PROC_PAT`), is removed by the next waiter and logged ("pruned N stale queue ticket(s)").
  - Pre-FIFO checks (started by the old script, no ticket): found with `ps -eo pid,ppid,etimes,args`; the top process of each check
    (not a child of a branch check, not a ticket holder or its wrapper such as `timeout` / `bash -c`) that started earlier than this
    one counts as ahead. They are not starved; among themselves they still use the old lottery until they are gone.
  - Unchanged: the yields to `~/.gate-pending` and `~/.nightly-pending`, `--max-wait` (-> NOT_RUN, the verdict text now also names
    the position), the "got the tests lock" / "running" / "done" lines and states.
  - The "queued" log line and `entry_status.json` add `position`, `queue_len`, `legacy_ahead`; logged when the position or the queue
    length changes and every 10 min. A waiter no longer overwrites a `running` state in the shared `entry_status.json` (it did every
    10 min before). New `~/smplwise-results/entry_queue.json`: the tickets in order (pid, branch, queued_ns).
  - Env: `ENTRY_QUEUE_DIR`, `ENTRY_PROC_PAT` (default `branch_check\.sh`), `ENTRY_LEGACY_SCAN=0`.
- Release gates and the nightly: checked, unchanged. `release_gate.sh` / `release_gate2.sh` take the tests lock with `flock -n` (no
  wait; "lock busy" exit 3 while a check runs, as before). `nightly_tests.sh` waits with its own `flock -w` loop, keeps
  `~/.nightly-pending` fresh, and entry checks yield to it; the FIFO head yields to both pending files exactly as the old loop did.
- `scripts/gate/tests/test_branch_check_fifo.sh` (new, plain bash like `test_runner_tmp_clean.sh`): sources the real queue block into
  fake waiters on a temp HOME, with a unique `ENTRY_PROC_PAT` so real checks on the machine are ignored. 14 checks: 3 waiters behind a
  held lock run A, B, C; positions 2/3 of 3 logged; `entry_status.json` and `entry_queue.json` content; dead-pid and reused-pid tickets
  pruned; an older pre-FIFO process goes first, a younger one does not; `--max-wait` path removes the ticket; a `running` status is
  not overwritten. Linux only (flock, ps, /proc); it prints SKIP elsewhere.
- `scripts/gate/selftest_entry_check.py`: part B sets `ENTRY_LEGACY_SCAN=0` so it is hermetic on a runner where real checks run.
- `scripts/gate/README_GATE_FAST.md`: the FIFO queue and the safe install (`.new` + `mv -f`).

## Tests (run, on the runner, in a temp directory, under load ~36)

- `bash scripts/gate/tests/test_branch_check_fifo.sh`: 17 runs. The first run had 1 FAIL ("younger pre-FIFO check is not ahead",
  13 of 14 passed; the output then did not show the order). The test was changed to close the held lock fd in the fake processes and
  to print the order and logs on a failure; the next 16 runs all passed (6 + 10), plus 1 run of the installed copy in `~/gate2/tests/`.
  The cause of that one failure is not proven.
- `python3 selftest_entry_check.py` (temp copy of `scripts/gate`): SELFTEST PASSED.
- Read-only check against the real process table: the queue block counted 7 pre-FIFO checks ahead of a new check, matching the 7
  running `branch_check.sh` processes.
- Live, after the install: this branch's entry check (`~/pre/entry_gatefifo.log` on the runner) logged "position 8 of 8, 7 older
  pre-FIFO check(s) ahead" and wrote `position`/`queue_len`/`legacy_ahead` to `entry_status.json` and its ticket to `entry_queue.json`.
- Not run: the entry check of this branch itself (queued behind the 7 old checks); a real FIFO handover between two
  real entry checks (happens once new checks queue).

## Install on the runner (done 2026-11-12)

`~/gate2/branch_check.sh` backed up as `branch_check.sh.pre-fifo-2436`; the new file written as `branch_check.sh.new` and moved over
with `mv -f` (the 7 running checks keep the old inode and were not stopped). Same for `~/gate2/selftest_entry_check.py`, plus
`~/gate2/tests/test_branch_check_fifo.sh`. No check, gate or nightly was stopped or restarted.

## Rollback

`mv -f ~/gate2/branch_check.sh.pre-fifo-2436 ~/gate2/branch_check.sh` (atomic; waiting FIFO checks keep their inode and still work,
the old-style ones simply ignore tickets). `rm -rf ~/.smplwise-queue ~/smplwise-results/entry_queue.json` when nothing waits.
In Git: revert the commit.

## Known limits

- Pre-FIFO checks still race among themselves; the 10 h waiter may still reach its 12 h limit if another old check wins the lock first.
- Detection of old checks is by command line (`branch_check.sh`); a different launch name would be missed (then it is a plain lottery
  participant, as before).
- `etimes` has 1 s resolution: an old check started in the same second as a new one is not counted as ahead.
