# Runner lock hygiene (2026-10-06 / 07)

The runner scripts live under `private/runner` (gitignored) and in `~` on the runner. This page records what was
changed on the evening of 2026-10-06, the backups, what is only proposed, and the lock protocol as it is now.
The deployed changes are also stored as a patch: `RUNNER_LOCKS.deployed.patch` (workstation copy vs its backup).

## Lock protocol (after this change)

| File | Meaning | Holder / writer |
|---|---|---|
| `~/.smplwise-tests.lock` | the shared tests lock | **shared** (`flock -s`): the push watcher pass, `run_remote.sh visual`. **Exclusive**: the release gate and the nightly run |
| `~/.gate-pending` | a gate is queued or running; start no new automatic runs | `~/gateNNN.sh` creates it, removes it at its end |
| `~/.nightly-pending` (new) | the nightly is waiting for the exclusive lock | `nightly_tests.sh`; removed when it gets the lock, gives up or exits |
| `~/smplwise-results/watch/GATE_WAITING` | legacy flag, still honoured (3 h) | gate scripts, optional |
| `~/.smplwise-watch.lock` | one watcher at a time | `push_watch.py` |

`push_watch.py` ignores `.gate-pending` older than 6 h and `.nightly-pending` older than 4 h (a crashed waiter must not block
it for ever). `run_remote.sh spec|backend|tsc` (the agents' runs) take NO lock; they are not gated, only counted.

## Findings

1. Nightly misses: `cron.log` shows "another test run is in progress" for the 02:00 runs of 4, 5 and 6 Oct. The nightly did
   `flock -n` for the EXCLUSIVE lock, and a watcher pass (shared lock, up to 3 branches x 25 min) or a gate was holding it. The
   nightly exited with code 3 and left no trace. (The holder at each of those times is inferred, not recorded.)
2. Gate waiting: the watcher already skipped new passes while `.gate-pending` existed (added 2026-10-05), but a pass that had started
   earlier kept the shared lock for up to 75 min (3 branches x 25 min cap) and never looked at the flag again. The gate polls
   `flock -n` every 30 s (`gate221.sh`), so it can only start in the gap between passes. Observed: a pass started 20:00 UTC was still
   running at 20:56 while the gate had been pending since 20:05.
3. `unit-devices-tiles:116 [mobile]` (deep link) failed once in the 2.2.0 gate and left no evidence: the reporter is `list` and the
   spec captured nothing. Diagnostics added (below); nothing else changed.
4. Stale waiters: four `bash -c until ... pgrep -f ...` loops, parent pid 1, 38-52 h old. The EL8 loops
   (`pgrep -u sw -f "pytest.*pilot-EL8"`) match THEIR OWN command line (the pattern text is part of the `bash -c` string), so they can
   never finish; the multi-nvr loop has the same self-match.

## Deployed on the runner (dry-run tested; backups next to the originals)

Tested on the runner under a throw-away `HOME` / `SW_LOCKDIR` with a stub runner and a local bare origin (`~/lockhyg-test`, removed
afterwards). The running gate (`gate221.sh`), its lock waits and the in-flight watcher pass were not touched (the in-flight pass already
had the old code loaded; the new code is used from the next cron start).

| Runner file | Backup (same directory) | Change |
|---|---|---|
| `~/watcher/push_watch.py` | `push_watch.py.bak-20261006-lockhyg` | see below |
| `~/watcher/watchlib.py` | `watchlib.py.bak-20261006-lockhyg` | new pure helpers `debounce()` and `flag_active()` |
| `~/nightly_tests.sh` | `nightly_tests.sh.bak-20261006-lockhyg` | bounded lock wait, skip note, status file |

Workstation copies (gitignored): `private/runner/{nightly_tests.sh,watcher/push_watch.py,watcher/watchlib.py,watcher/tests/test_watchlib.py}`
with `.bak-20261006-lockhyg` backups beside them (the workstation `push_watch.py` was first re-synced to the version deployed on 5 Oct,
which already had the `.gate-pending` check and the shared lock).

### push_watch.py

* No pass starts while `.gate-pending`, `.nightly-pending` or `GATE_WAITING` is active.
* A running pass re-checks the flags before every branch and between `tsc` and `backend`. When one appears it lets the step in flight
  finish (nothing is killed), skips the rest, does NOT record the branch as tested (it runs on the next pass), and exits, which
  releases the shared lock. Worst-case extra wait for a gate: one step (the 25 min per-branch cap is unchanged).
* Debounce / coalescing: a branch runs only after its tip stayed unchanged for `SW_DEBOUNCE_S` (240 s; the first sighting starts the
  clock; state in `~/smplwise-results/watch/debounce.json`). A burst of pushes gives one run, for the newest sha. With the 5-minute
  cron a branch is tested on the second pass after its last push.
* Concurrency caps: one watcher (flock, as before); at most `SW_MAX_BRANCHES` (3) branches per pass; a pass budget of `SW_BUDGET_S`
  (45 min; it was effectively 75 min) with no new branch in its last 2 minutes; the pass is skipped while `SW_MAX_REMOTE` (4)
  `run_remote.sh` jobs (agents) already run.
* `SW_LOCKDIR` (default `~`) relocates lock and flag files, for dry runs.

### nightly_tests.sh

* Waits for the exclusive lock up to `SW_NIGHTLY_LOCK_WAIT` seconds (default 10800 = 3 h; `0` = the old immediate exit 3). While
  waiting it keeps `~/.nightly-pending` fresh (so the watcher stops starting runs and the shared lock drains), and it yields to a
  pending gate (`.gate-pending` younger than 4 h): it does not take the lock while a gate is queued.
* On give-up it writes `~/smplwise-results/<date>_nightly-SKIPPED.md` (the dashboard reads the newest `20*.md`, so it shows
  "Nightly SKIPPED: lock busy" with the waited seconds and holder PIDs) and `~/smplwise-results/nightly_status.json`
  (`{"state":"skipped","reason":"lock busy",...}`), then exits 3. The status file is removed when a run does start.
* Cron is unchanged (`0 2 * * *`, `CRON_TZ=Asia/Jerusalem`).

### Tests that ran

* `watcher/tests/test_watchlib.py`: 23 tests OK on the workstation (4 new, for `debounce` / `flag_active`).
* Runner, `nightly_tests.sh` under a fake HOME: A) lock held 25 s, wait 6 s -> skipped, note and json written, rc 3;
  B) lock held 8 s, wait 60 s -> acquired after 7 s; C) wait 0 -> old behaviour, rc 3; D) fresh `.gate-pending`, lock free -> yields, skipped.
* Runner, `push_watch.py` with a stub runner and a local bare origin: first sighting is debounced; a pending flag skips the pass;
  `SW_MAX_BRANCHES=2` runs two; two quick pushes with a long debounce run nothing; a flag appearing during `tsc` yields without marking
  the branch; the `SW_MAX_REMOTE` skip; the next pass runs the yielded branch. The `backend` step was not exercised (no mapped tests in the toy repo).

## Process cleanup (2026-10-06, about 21:05 UTC)

Removed by exact PID (`kill <pid>`, no pkill) after re-checking the command line, parent pid 1 and that every child was a `sleep`:

| pid | age | command (shortened) | why dead |
|---|---|---|---|
| 4005517 | 38.6 h | `bash -c until ! pgrep -u sw -f "pytest.*pilot-EL8" ...; do sleep 10` | `~/work/pilot-EL8-bill-pdf/.backend_s{1,2}.log` final since 5 Oct 06:52; no pytest of that branch; the loop matched itself |
| 4055995 | 38.4 h | same | same |
| 4052556 | 38.4 h | same (+ a trailing `head`) | same |
| 2387295 | 52.2 h | `bash -c until grep -qE '^  [0-9]+ (passed\|failed)' ~/smplwise-results/multinvr_regress_1.log && ! pgrep -f 'run_remote.sh spec pilot/multi-nvr' ...; do sleep 15` | the log has had its summary line since 4 Oct 16:55; only the loop itself matched the pgrep |

Left alone: `gate221.sh` (pid 71371) and its waits, the watcher pass holding the shared lock, the agents' `run_remote.sh backend pilot/apk-in-addon`,
the soak sampler, the cron jobs.

Waiter pattern that cannot match itself: `until ! pgrep -u sw -f "[p]ytest.*pilot-EL8" >/dev/null; do sleep 10; done`, or better
`while kill -0 <pid> 2>/dev/null; do sleep 10; done` on the PID of the job.

## Proposals (NOT deployed)

1. **Gate waits on the lock instead of polling.** `release_gate.sh` line 43 (`flock -n 8 || ... exit 3`) becomes a bounded blocking wait, so
   the gate takes the lock the moment the last shared holder leaves (`.gate-pending` already stops new watcher passes):
   ```diff
   -flock -n 8 || { echo "the nightly/manual test run holds ~/.smplwise-tests.lock"; exit 3; }
   +flock -w "${SW_GATE_LOCK_WAIT:-5400}" 8 || { echo "the tests lock stayed busy for ${SW_GATE_LOCK_WAIT:-5400}s"; exit 3; }
   ```
   Not applied: a gate is queued right now and its copy lives in `~/gate221/`.
2. **Preempt the watcher's own step when a gate is pending** (opt-in `SW_PREEMPT=1`): in `push_watch.py::timed`, poll `waiting_flag()`
   every 15 s and, after a 120 s grace, terminate the step's whole process group (own PIDs only) and record the step as `preempted`.
   It needs `run_remote.sh backend` to run pytest in its own session first; otherwise an orphan pytest keeps burning CPU during the gate.
3. **Agents' runs take the shared lock** (`run_remote.sh spec|backend`): add near the top
   `exec 7>"$HOME/.smplwise-tests.lock"; flock -s -w "${SW_LOCK_WAIT:-900}" 7 || exit 3` as the `visual` mode already does, and refuse
   to start while `~/.gate-pending` is fresh. This is what actually keeps agents out of a gate; it changes every agent's run, so it needs
   an announcement first.
4. **Nightly cron**: set `SW_NIGHTLY_LOCK_WAIT=14400` in the crontab line if 3 h proves too short. The dashboard shows the SKIPPED note
   through the newest `20*.md`; it does not read `nightly_status.json` unless its card is extended.
5. **Flaky `unit-devices-tiles:116 [mobile]`**: wait for the next occurrence; the evidence is in the `TILES-DIAG` stdout line and the
   `tiles-panel-diagnostics.json` attachment (`test-results/`). Things to read in it: the order of `panel-changed` / `close` against
   `hashchange`, and whether the panel's `open` attribute flips back after the hash is set.

## Test diagnostics (tracked change)

`frontend/tests/unit-devices-tiles.spec.ts`: `open()` now arms a recorder; a file-level `afterEach` acts only for a failed test and
attaches `tiles-panel-diagnostics.json` and prints one `TILES-DIAG` line with: URL and hash, history length, all attributes of
`devices-tiles-panel` and its `sw-drawer`, an event log (capture listeners on `document` for `panel-changed`, `panel-close`,
`panel-filter`, `panel-navigate`, `open`, `close`, plus `hashchange` / `popstate`, with timestamps), console messages and page errors.
No assertion, selector or timing changed.
