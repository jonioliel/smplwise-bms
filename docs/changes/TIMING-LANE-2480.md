# TIMING-LANE-2480 - the eight load-sensitive backend tests of the 2.47.0 gate, made clock-free (one wall-clock budget to the lane)

Branch `pilot/TIMING-LANE-2480`, based on `origin/release/2470-train` (4d244a419). Target 2.48.0. Test-only: no product file changed, no
product constant changed, no timeout raised. No runner-side script changed (the gate change the lead may want is documented in
`docs/testing/GATE_LANES.md`, "Proposed gate change").

## Why

The 2.47.0 release gate run 1 (runner load up to ~250) failed eight backend tests that each pass alone. On the PC, under artificial load
(24 busy-loop processes + 2 fsync writers on 8 logical CPUs, started and stopped by exact PID), the unchanged tests reproduced three of
the eight in one pass: `test_sync_handlers_do_not_starve_behind_gate_waiters` ("database is locked": a gate time-out),
`test_baseline_on_the_synthetic_set` (`apartment` took 26 500 ms against the 15 000 ms budget) and
`test_sec217_global_failure_flood_never_locks_out_a_valid_token` (the 320 failures spread past one minute).

Rule applied: find the clock the test reads; pin it or wait on the event itself; keep every assertion; move a test (or the part of one)
to the timing lane only when a real wall-clock measurement is the point.

## Per test

| Test | Timing dependence | Fix | Kind |
|---|---|---|---|
| `test_f3a_doorwin_dw03_295.py::test_four_hung_doors_do_not_hold_back_the_other_four` | the four answering doors had to answer inside a real 0.5 s per-call deadline (thread start, claim write); `elapsed < 4.5 s`; a 0.2 s sleep before "late answers change nothing" | `DeadlineClock` in the test file: door_emergency's OWN `threading.Event` (the `threading` name of that module only), its `futures_wait` and the call budget's `_clock` run on a clock the test moves. The test waits (event) until 4 calls answered while 4 timed waits are in flight, asserts the incident is still `applying` and that no answering door was sent behind a hung door on the same worker (claim order, stricter than before), then advances past `ENGINE_DEADLINE_S`: hung four `unknown/deadline`, the other four acknowledged, `in_effect_partial` without the dispatcher's grace running out; retry path unchanged; the late answers are awaited (`late == 4`) instead of slept for | clock-free, blocking |
| `test_lat1_toggle_latency.py::test_a_command_whose_record_cannot_be_written_in_time_is_never_sent` | the write lock was held `PENDING_WAIT_S + 2` s of wall clock; a request that reached its record wait late found the lock free -> 202, sent | `_hold_write_lock(app, None)`: held until the request answered (`HANG_GUARD_S` = 120 s only frees a hung test). The product's own 2 s record budget still decides the 503 | event-driven, blocking |
| `test_sync_gate_wait.py::test_sync_handlers_do_not_starve_behind_gate_waiters` | writers timed out in the gate (`BUSY_TIMEOUT_S` 8 s) while the 45 were still being queued; 1 s per-writer cap (order); `holding.wait(5)` unchecked; `elapsed < 8 s` | the gate queue entry's wait is untimed for this test (`_UntimedGateEvent` on db.py's own `threading` name; it gives up after 120 s like a time-out, which the test then counts); every wait event-driven and asserted; the starvation itself is asserted: while writers are parked the shared AnyIO limiter keeps a free thread, and once all 45 are parked it lends at most 1 (the holder's body). Mutation check (temporary, not committed): `auth._gate_wait_limiter` returning the shared limiter (the pre-fix behaviour) fails at once with "writer 38: the gate waiters took every shared thread (40 of 40)" | clock-free, blocking |
| `test_soak_edges_2450.py::test_d1_ha_websocket_drop_and_reconnect_three_cycles` | the "no thread left over per reconnect" check compared every live thread after each cycle. Two transient kinds made the lists differ: (1) AnyIO's worker threads - the test client's summary / report requests run their sync routes on them and an idle one exits ~10 s later (`WorkerThread.MAX_IDLE_TIME`), so under load it is alive in one snapshot and gone in the next: REPRODUCED on the PC under load, cycle 0 `['AnyIO worker thread', 'MainThread', 'ha-sync']`, later cycles without it -> "threads change per reconnect"; (2) a daemon thread an EARLIER test of the same gate shard left behind, ending between two snapshots | `own_threads(started_before)`: AnyIO workers are pool workers like `asyncio_*` / `ThreadPoolExecutor*` (already left out), and threads alive before the test began are not this test's. A thread the sync leaks per reconnect still fails the check. Proof for (2): a temporary test (not committed) starts a daemon thread before D1 and ends it right after cycle 0's snapshot: the old helper FAILS ("threads change per reconnect", cycle 0 lists `leftover-of-an-earlier-test`), the new one passes. The `wait_for` guards (5 / 10 s event polls) are unchanged | cross-test, blocking |
| `test_wiskey_door_tech.py::test_the_view_says_who_may_write_what_this_wiskey_offers_and_the_recent_writes` | the second hold had to come within the 3 s cool-down | `_pinned_cooldown_clock`: services/wiskey_door_tech.py's `time.monotonic()` is a `ManualClock`. Same fix for the sibling `test_the_cooldown_after_a_send_and_not_after_a_refusal` (same dependence), which now also proves the window's end (2.9 s refused, 3.1 s sent) | clock-free, blocking |
| `test_plan_detect_baseline.py::test_baseline_on_the_synthetic_set` | the per-plan 15 s budget was wall clock | split: the blocking baseline keeps every quality bound and checks the SAME budget as CPU time (`cpu_ms`, `time.process_time`, new column of `plan_detect_metrics.run_set`); the new `@pytest.mark.timing_lane` `test_every_plan_finishes_inside_the_wall_clock_budget` keeps the wall-clock budget (T086 / AT172 is a real latency budget) | split, lane |
| `test_partner_api_113.py::test_sec217_global_failure_flood_never_locks_out_a_valid_token` | 320 failures had to fall inside one minute of wall clock | `PartnerApp(db, clock=lambda: at)` (the existing constructor seam): one pinned instant | clock-free, blocking |
| `test_setup_wizard.py::test_unknown_step_rate_limit_and_audit` | the second check had to come within 5 s of the first live check | services/setup_wizard.py's `time.monotonic()` is a `ManualClock`; the test also proves the slot frees after `CHECK_EVERY_S` (4.9 s: 429, 5.1 s: 200, audited) | clock-free, blocking |

Helpers (`tests/support/waiting.py`): `ManualClock` and `time_shim(monotonic=..., wall=...)` (patch one module's `import time`, like
`datetime_shim` does for `datetime`).

## Tests run (PC only; the runner was not used - the 2.47.0 gate holds it)

`py -3.12` = the main checkout's `.venv`, `-p no:xdist`, each test 20 times in one pytest process (a scratch repeat plugin). "Load" =
24 busy-loop Python processes + 2 fsync writers on the 8-CPU PC, started and stopped by exact PID (another agent's pytest also ran on
the PC part of the time).

| Test | 20x under load | 20x idle | Load run wall time per run |
|---|---|---|---|
| DW-03 four hung doors | 20 / 20 PASS | 20 / 20 PASS | ~23 s |
| LAT1 never sent | 20 / 20 PASS | 20 / 20 PASS | ~18 s |
| sync gate wait | 20 / 20 PASS | 20 / 20 PASS | ~41 s (the old bound was 8 s) |
| D1 HA websocket x3 | 20 / 20 PASS | 20 / 20 PASS | ~37 s |
| door tech view | 20 / 20 PASS | 20 / 20 PASS | ~23 s |
| door tech cool-down (sibling) | 20 / 20 PASS | 20 / 20 PASS | ~17 s |
| plan detect baseline | 20 / 20 PASS | 20 / 20 PASS | ~94 s (6 plans; the wall-clock budget would fail, the CPU budget holds) |
| partner flood | 20 / 20 PASS | 20 / 20 PASS | ~92 s (the old 60 s window would fail every run) |
| setup wizard rate limit | 20 / 20 PASS | 20 / 20 PASS | ~17 s |

Before the change, one pass of the eight under the same load: 3 FAILED (sync gate wait, plan detect, partner flood), 5 passed.

Whole files touched (idle, `-m "not timing_lane"`, as a gate shard selects): dw03, lat1, sync gate, soak edges, door tech, plan detect
baseline + walls, partner 113, setup wizard, gate hygiene - 409 passed, 0 failed. The same files `-m timing_lane`: 3 passed (including
the new plan-detect wall-clock test), 1 failed: the pre-existing `test_the_recorded_command_leaves_promptly_once_the_write_lock_is_free`
(not touched here; 5 / 5 failed again on the PC, ~2.2 s against its 1.9 s bound - see the report's open question).

Mutation checks (temporary tests, not committed): the gate wait back in the shared pool fails the sync-gate test ("writer 38 ... 40 of
40"); `LANE_MAX = 1` (doors sent one at a time) fails the DW-03 test (the answering doors never answer while the hung four are in
flight); the old D1 helper fails with a leftover thread ending mid-test, the new one passes.
