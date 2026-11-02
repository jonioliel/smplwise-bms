# WRITE-GATE-EVENTS-2341 - "write gate held by events_ingest._write outside a transaction"

**Status:** fixed on `fix/WRITE-GATE-EVENTS-2341`, not merged, no version bump. Owner-approved task, 2026-11-01.

## 1. Symptom

The add-on log repeatedly showed

    ERROR smplwise.db: write gate held by events_ingest._write outside a transaction (a manual COMMIT? use db.commit_now); <waiter> waits

## 2. Where it comes from

`smplwise/db.py::_report_stray_holders`, the stray-holder detector. When a writer has waited one second for the
FIFO write gate (`WriteGate.acquire(on_slow=...)`), it looks at every connection holding a gate token and reports one
whose `conn.in_transaction` is False: that pattern is a manual `conn.execute("COMMIT")`, which keeps the token while
the connection no longer writes. `events_ingest._write` is the alert stream's per-alert write
(`AlertStreamListener._handle` -> `retry_locked(_write)` -> `db.connection()`; FULL durability).

## 3. Root cause: the detector misread a holder that was committing

The alert-stream code path itself was clean: `_write` opens `db.connection()` (BEGIN IMMEDIATE), runs `store_alert`
and `rules.evaluate_event(..., deliver=False)` (database only; notifications are savepoints inside the same
transaction), and leaves; the zone is read before and `deliver_pending` (the HA notification, the notifier wake-up)
runs after the commit. No manual COMMIT, no network I/O under the gate.

What the detector did not account for:

1. **COMMIT in progress.** SQLite clears its autocommit flag (`sqlite3_get_autocommit`, which `in_transaction` reads)
   in `OP_AutoCommit`, *before* the commit writes the WAL frames and fsyncs. During the whole commit the holder reads
   as "outside a transaction". The alert stream commits with `synchronous=FULL` once per alert, so on the add-on's
   storage the commit is the longest part of its hold, and a waiter whose one-second mark fell inside it logged the
   error. Pinned by `test_sqlite_reports_no_transaction_while_a_commit_is_still_running` (a 2000-row commit sampled
   from another thread reads `in_transaction == False` throughout).
2. **COMMIT returned, gate not yet handed on** (`_finish` -> `_end_hold`), the same in `commit_now`, `release`,
   `rollback_and_restart` and between `conn.close()` and `_drop_hold`.
3. **Gate taken, BEGIN not started**: the token was recorded in `_gate_tokens` before the connection was marked
   `_beginning`.
4. **Stale snapshot**: the detector iterates a copy of `_gate_tokens`; a holder that finished, handed the gate on and
   closed meanwhile read as "closed, so outside a transaction" (logged with the label `?`, the burst test caught it
   after 1-3 were fixed).

The error was a false alarm: the gate was handed on correctly every time. The same mislabel could name any writer
(the burst test also caught `other writer`); the alert stream showed up because it is the busiest FULL committer.

## 4. Fix (`smplwise/db.py`)

- `_ending` (set) + `_finishing(conn)` context: a connection is marked from the moment its COMMIT / ROLLBACK starts
  until the gate is handed on - in `_finish`, `commit_now`, `release`, `rollback_and_restart`, and around the
  `conn.close()` of `connection()` / `write_aside()` (cleared in `_drop_hold`).
- `_begin_immediate` marks the connection `_beginning` *before* it waits for and records the gate token (the whole
  begin is now inside one try/finally).
- `_report_stray_holders` reports a holder only when it is "settled" (`_settled`: holds the very same token, not
  `_beginning`, not `_ending`) both before and after `in_transaction` is read, and the flag says no transaction; a
  closed connection is skipped (its gate is always handed on by `_drop_hold`). A finishing holder drops its token
  before it leaves `_ending`, so the double check cannot miss a commit that ended in between. A real manual COMMIT is still reported
  (`test_a_manual_commit_is_still_reported_by_the_detector`, existing `test_a_gate_kept_after_a_manual_commit_is_reported`).
- No behaviour change to the gate itself (order, timeouts, hand-over) or to durability.

Also, `services/events_derive.run_once` read the camera list on a write connection (taking the gate for a SELECT);
it now uses `mode="read"`. Its NVR search already ran outside any connection.

## 5. Other callers checked

- `events_ingest._gap` (coverage gap row): one short write after the connect, no I/O inside.
- `events_derive`: device search outside the connection; store in a short `durable=False` transaction.
- `rules.evaluate_event` / `notify.emit_full`: database only, savepoints inside the caller's transaction; HA calls in
  `deliver_pending` after the commit.
- `ha_sync._write`: no network I/O inside. The one slow hold seen on the owner's install (below) is the start-up
  snapshot chunk, database work only - not part of this task.
- The `test_no_manual_transaction_control_outside_db_py` guard (no `COMMIT` / `ROLLBACK` / `BEGIN IMMEDIATE` by hand
  outside db.py) still passes.

## 6. Live evidence (owner's home install, read-only)

Read the Arx add-on log through the Supervisor API (`/api/hassio/addons/<slug>/logs`, GET only; no writes, no
restart). Add-on 2.33.0, state started; ~94k log lines covering 2026-10-25 .. 2026-11-01:

- `write gate held by ... outside a transaction`: **0** occurrences in that window (the log is cut at the last
  restarts; the message seen by the owner is older or from another install).
- `database is locked`: 0. `write lock held 7.4 s by ha_sync._write`: 1 (2026-10-25, at the HA sync start-up snapshot).

So the frequency could not be measured on that install; the cause is shown by the tests below instead.

## 7. Tests

New `tests/test_db_gate_stray_detector.py` (6 tests), run locally (Windows, single process):

- With origin/main's `db.py`: **3 failed, 3 passed**. The detector logged the field message
  "write gate held by events_ingest._write outside a transaction" 7503 times in the burst test (every sighting
  counted), plus 9 stale-snapshot sightings labelled `?`.
- With the fix: **6 passed**.
- Existing suites with the fix: `test_db_gate_stray_detector + test_db_gate + test_db_locking + test_db_contention +
  test_db_io_guard + test_db_lock_storm` = 59 passed, 2 skipped; `test_events + test_backpressure + test_rules +
  test_multi_nvr + test_events_cache + test_db_gate` = 83 passed.

- `test_an_alert_burst_never_reads_as_a_stray_holder`: 120 alerts through `AlertStreamListener._handle` with a
  contending writer and the detector running continuously; a rule with an HA notification fires on each alert and
  asserts the alert stream holds neither the write lock nor the gate during the HA call.
- `test_the_commit_to_hand_on_window_is_not_a_stray`: deterministic, every exit path.
- `test_a_holder_in_the_middle_of_its_commit_is_not_a_stray`: large FULL commits under a continuous detector.
