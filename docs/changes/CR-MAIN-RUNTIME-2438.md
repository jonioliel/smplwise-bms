# CR-MAIN-RUNTIME-2438 - request path and shutdown safety in `main.py`

Branch `pilot/CR-MAIN-RUNTIME-2438`, cut from `origin/main` (`0a8fb55e1`). Source: code review 2026-11-13,
`MASTER_PLAN.md` entry `CR-MAIN-RUNTIME` (planned as `-2436`), findings 05:P1-01, 05:P1-07, 05:P2-01, 05:P3-02.
Only `smplwise_vms/backend/smplwise/main.py` changes (middleware, exception handlers, shutdown sequence) plus three new
test files. No migration, no route, no setting, no frontend change, no device touched.

Overlap check with the held urgent branches: only `pilot/BACKEND-SAFETY-2435` touches `main.py`, and only inside
`janitor_tick` (plus a `_janitor_step` helper right after the `log = ...` line). This branch leaves those lines alone - its
helpers live at the bottom of the file - so the two merge without a conflict (checked with `git merge-tree`, see Tests).
`AUTH-REVOKE-GATE-2435`, `TICKETS-PERF-ERASE-2435` and `SESSION-DEMO-WS-2435` touch no file of this branch.
Owner decision O9 (go-live permits) belongs to `CR-ADMIN-GATE`, not to this branch: nothing here touches them.

## 1. 05:P1-01 - the early commit queued behind the gate's waiters (verified, fixed)

`CommitBeforeSend` committed the request's connections when the response starts through `run_in_threadpool`, i.e. AnyIO's
shared 40-token limiter. Writers park in pool threads inside `WriteGate.acquire` (a sync dependency, `auth.get_conn`), and
AnyIO hands tokens out in arrival order, so with 40 or more writers waiting, the gate holder's commit waited for a thread
that only a gate time-out frees.

**Reproduced before the fix** (`tests/test_commit_release_limiter.py`, gate wait shortened to 4 s): with the original
`main.py` the holder kept the write lock 4.2 s and writers failed with `database is locked` (`gate_timeouts` > 0).
With the fix the same test answers 46 x 200 with zero gate time-outs.

Fix: the commit runs through `anyio.to_thread.run_sync(release_conns, conns, limiter=...)` on a `CapacityLimiter` of its own
(`COMMIT_THREADS = 4`, one per event loop). Same function, same thread kind, same order; only the queue it waits in changes.
The limiter stays (the load test decided it).

**New finding, not fixed here (for the lead):** the same starvation exists for a *sync* (`def`) handler body. A writer that
got the gate runs its body through the shared pool too, behind the writers parked in that pool waiting for the gate; with
40+ parked writers the holder's body waits until one of them times out. Observed with this test's first draft (sync
writers): even with the commit fix, `gate_timeouts` > 0 and a holder held the lock 2.4 s. The test now uses an `async`
body to isolate P1-01. Fix candidates (each a design decision): take the gate wait off the shared pool (an async gate
acquisition before the dependency's thread), or size the default thread limiter above the longest gate queue.

## 2. 05:P1-07 - unexpected errors and a busy database leave the error model (fixed)

- `sqlite3.OperationalError` that is busy (`db.is_busy`: "database is locked" after the write-lock wait) now answers the
  envelope `{code: "database_busy", retryable: true, details: {retry_after_s: 2}}` with `Retry-After: 2`, logged as a
  warning with the correlation id and the traceback (the database layer has already logged the holder).
- **Lead decision L1 - status 500, not 503.** The frontend gives 503 meanings of its own: `access-messaging.ts:57` maps 503 to
  "not sent" and other 5xx to "uncertain"; `bakes.ts:91` retries a 503 upload; `events-logic.ts:269` (intercom unavailable),
  `camera-reboot-logic.ts:39` (source unavailable), `system-security-cameras.ts:1192` ("the NVR is unavailable"),
  `update-run.ts:20` (the add-on is restarting). A busy database answering 503 would borrow those meanings, so it keeps 500
  with the envelope; `Retry-After` is only a hint.
- A new `Exception` handler answers every other unexpected error with the envelope `internal_error` (status 500, a Hebrew
  user message, the correlation id in the body and in the `X-Correlation-Id` header - this answer leaves outside the
  correlation middleware). Starlette re-raises the exception after this answer, so the server still logs the full trace and
  a `TestClient` still raises it, exactly as before. Non-busy, non-full database errors keep their old path (re-raised) and
  so end here too.
- Disk full (507 `storage_full`, T035) is unchanged.
- **No functional loss on the client (one frontend line).** A bare 500 used to reach the client as the fallback code
  `http_500`; the update screen (`components/update-run.ts`, `isOutageError`) treats `http_5*` as "the system is down or
  restarting". It now also treats a 500 with `internal_error` / `database_busy` that way, so an update run polled through a
  busy restart keeps waiting exactly as before. The predicate moved to `components/update-run-logic.ts` (node unit test) and
  is still exported from `update-run.ts`. Every other client path keys on the status (`>= 500`), not on `http_500`
  (checked with a search of `frontend/src`); `sw-state-panel` already hides a bare machine code, and now shows the Hebrew
  message instead of "Internal Server Error". Not in the AUDIT30 held-file list (Appendix A).

## 3. 05:P2-01 - the shutdown sequence was not exception-safe (fixed)

Each of the ~40 stops of `_stop_janitor` now runs through `_shutdown_step(name, fn, *args)` (loop) or `_in_thread_step`
(worker thread): a stop that raises is logged as `shutdown step <name> failed` with the traceback and the sequence goes on,
so the capture-lease revocation and `close_pool` (still last) always run. Same order, same calls. The rate-limiter flush
keeps its own guard (now through the same helper).

- The start-up discovery task (`app.state.discovery`) joins the cancel list.
- The start-up warm-up is a daemon *thread*, not a task, so it cannot be cancelled: when it is still alive at shutdown it is
  joined for at most `WARMUP_JOIN_S = 2.0` s before `close_pool`, so it never opens a connection behind the pool close.
  (It is off in tests, `SW_STARTUP_WARMUP=0`.)

## 4. 05:P3-02 - the correlation middleware was a `BaseHTTPMiddleware` (fixed)

`CorrelationId` is now a pure ASGI class like `CommitBeforeSend`, added at the same place in the stack (innermost of ours):
the id goes into `scope["state"]` (`request.state.correlation_id`), and the header is set on `http.response.start`. Same
SX-17 rule (`correlation_id.resolve` on every header value). No extra task per request, streamed bodies pass straight
through. The unhandled-error answer gets its header from the new `Exception` handler (section 2).

## Tests

Run locally (workstation, `.venv` Python, `pytest -p no:xdist`):

- `tests/test_commit_release_limiter.py` (new, 2 tests): see the RESULTS block below.
- `tests/test_error_envelope_unexpected.py` (new, 6 tests).
- `tests/test_shutdown_safely.py` (new, 3 tests).
- Existing: `tests/test_correlation.py`, `tests/test_correlation_id_sx17.py`, `tests/test_db_gate.py`,
  `tests/test_outage_run_t035.py`, `tests/test_asgi_wiskey_295.py`.

- Frontend: `tests/unit-update-run-outage-2438.spec.ts` (new, 2 tests, `playwright.unit.config.ts`, `--workers=1`).

RESULTS (actually run, 2026-11-14, workstation):

- P1-01 test against the ORIGINAL `main.py` (fix stashed): **FAILED** as expected (gate time-outs, holder kept the lock
  4.2 s) - the finding is reproduced. With the fix: passed.
- All eight backend files above in one run: **116 passed, 0 failed** (`pytest -p no:xdist`).
- The three new backend files again after the last text-only edit (two Hebrew user messages), on the committed code:
  this line: **11 passed, 0 failed**.
- Frontend unit spec: **2 passed**. `npx tsc --noEmit`: clean (no output).
- `git merge-tree` of this branch with each of `BACKEND-SAFETY-2435`, `AUTH-REVOKE-GATE-2435`, `TICKETS-PERF-ERASE-2435`,
  `SESSION-DEMO-WS-2435`: no conflict. (`AUDIT30-COMBINED-2435` conflicts only in `frontend/src/screens/live-camera.ts`,
  which is the same conflict it already has with `origin/main`; not a file of this branch.)

NOT_RUN locally (runner entry check): the full backend suite, `tests/test_db_lock_storm.py` (SW_PERF), pixel suites (no UI
change).
