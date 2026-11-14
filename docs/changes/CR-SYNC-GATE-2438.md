# CR-SYNC-GATE-2438 - the write-gate wait leaves the shared thread pool

Branch `pilot/CR-SYNC-GATE-2438`, based on `pilot/CR-MAIN-RUNTIME-2438` @ `68a5a6bbc` (that branch's entry check is
queued; this follow-up adds no commit to it). Lead decision on the finding reported in `CR-MAIN-RUNTIME-2438.md`
(section 1, "New finding"): option a - the wait for the database write gate moves out of AnyIO's shared thread pool.

## The problem

`auth.get_conn` was a sync generator dependency, so FastAPI opened the request's write connection - and with it waited
in the `WriteGate` FIFO queue (up to `BUSY_TIMEOUT_S`) - in a thread of the shared 40-token pool. The gate holder's own
sync (`def`) body and its sync dependencies (`current_principal`, ...) run in the same pool, and AnyIO hands its tokens out
in arrival order. With 40 or more writers parked in the gate, the holder waited for a thread that only a gate time-out
freed: a burst of "database is locked" with no slow holder. `CR-MAIN-RUNTIME-2438` took the early commit off that pool;
the holder's body still starved.

## The change (`smplwise/auth.py` only)

- `get_conn` is now an `async` generator dependency. The `Database.connection(...)` context manager is the same object
  as before; only the threads change:
  - `__enter__` (the gate wait, `BEGIN IMMEDIATE`) runs through `anyio.to_thread.run_sync(..., limiter=...)` on a
    limiter of its own, `GATE_WAIT_THREADS = 64` (one per event loop) - more than the 40 writers the shared pool could
    ever park, so no ordinary burst queues before the gate.
  - `__exit__` runs exactly like FastAPI's own exit for a sync dependency (`contextmanager_in_threadpool`): a thread on a
    one-off limiter, never behind a full pool; a handler's exception is passed in, so `Database.connection` decides as
    before (an `ApiError` commits its audit rows, anything else rolls back) and the error is re-raised.
  - A cancelled request (a `BaseException` such as cancellation) now rolls back under a shielded scope and hands the
    gate on at once; before, the sync generator was left to the garbage collector.
  - `resolve_remote_first` (the remote channel's authentication before the gate) still runs first, in the shared pool
    (`run_in_threadpool`), exactly where it ran before; a 401 still never touches the gate.
- Unchanged: the gate (FIFO order, priority, `BUSY_TIMEOUT_S` budget, time-out accounting), the request label, the
  connection tracking for `CommitBeforeSend`, dependency caching and order (`current_principal` depends on `get_conn` as
  before; `test_raw_body_order.py` and the dependency-identity check in `test_intercom_adapter.py` still find
  `auth.get_conn`). A writer beyond 64 concurrent ones waits for a thread in arrival order - as the 41st did in the shared
  pool before - so the order of the queue is kept.

## Scope note

This covers the request write connection (`Depends(get_conn)`, the default of most write routes). Code that opens its own
write transaction *inside* a sync handler (`db.write_aside`, a service's `db.connection()`) still waits for the gate in
the thread it runs on; those are short side writes on read-mode requests and background workers, and are not changed here.

## Tests

- New `tests/test_sync_gate_wait.py`:
  - `test_sync_handlers_do_not_starve_behind_gate_waiters`: a holder plus 45 writers with **sync** bodies, arriving one by
    one; asserts zero `gate_timeouts`, 46 x 200, and that the writers ran in arrival order.
  - `test_commit_and_rollback_rules_are_unchanged`: success commits, an `ApiError` still commits, a bug rolls back, and the
    gate is free afterwards.
  - `test_get_conn_waits_for_the_gate_off_the_shared_pool`: the limiter is larger than the shared pool.
- `tests/test_commit_release_limiter.py` (from CR-MAIN-RUNTIME): the shortened gate wait in the test goes from 4 s to 8 s and
  the wall-clock bound from 4 s to 8 s. On the saturated workstation one run of 45 serial writes legitimately took
  4.6 s; the assertion that matters (zero gate time-outs) is unchanged.

RESULTS (actually run, 2026-11-14, workstation, `.venv` Python, `pytest -p no:xdist`):

- Reproduction: `test_sync_handlers_do_not_starve_behind_gate_waiters` against the ORIGINAL `auth.py` (stashed): **FAILED**
  with `sqlite3.OperationalError: database is locked` (gate time-outs). With the change: passed.
- `tests/test_sync_gate_wait.py` + `tests/test_commit_release_limiter.py` three times in a row after the change: **5 passed**
  each time.
- Existing gate / lock / outage / remote-auth tests in one run - `test_db_gate.py`, `test_db_gate_stray_detector.py`,
  `test_db_locking.py`, `test_db_contention.py`, `test_remote_auth_first.py`, `test_raw_body_order.py`,
  `test_outage_run_t035.py`, `test_error_envelope_unexpected.py`, `test_shutdown_safely.py`, `test_correlation.py`:
  **106 passed, 1 skipped, 0 failed**.

NOT_RUN locally (runner entry check): the full backend suite, `tests/test_db_lock_storm.py` (SW_PERF), `test_remote_access.py`,
`test_intercom_adapter.py`; no UI change, so no pixel run.
