# DB-CONN-POOL-2343 - reuse SQLite connections between requests

**Status:** on `perf/DB-CONN-POOL-2343` (cut from `origin/release/2333-train` @ `8fa88bf66`, 2.33.3 - not yet on `main`),
not merged, no version bump, no migration. Owner-approved task (02.11, round 13, answer 6A). Default: **pool ON** (add-on option `db_conn_pool: true`); kill switch `db_conn_pool: false` or `SW_DB_CONN_POOL=0`.

## 1. Problem

`Database.connection()` / `write_aside()` opened a new SQLite connection for every request (and every worker
transaction) and closed it at the end. Opening is cheap; the **first statement** of a new connection is not: SQLite parses
the whole schema into the connection - 1256 objects (tables, indexes, triggers of 189 migrations). PERF-HOME-DEVICES-2342
(finding 8) measured ~40-50 ms per request for this on the workstation; it is the floor of every small call
(`/me`, `/settings`, `/presence/building` ...), and on an SD-card Home Assistant host it is larger.

## 2. Design

`smplwise/db.py`, section "connection reuse".

**Which handles pool.** Only the app's own long-lived handle: `main.create_app` builds `app.state.db` with
`Database(path, pool=True)` - every request dependency (`get_conn` / `get_read_conn`), `write_aside`, and every worker
that uses `app.state.db`. A `Database` made for one job keeps opening per transaction, as before: the backup drill's
scratch copy, the demo-file builder, `offbox_restore`'s check, `door_execute_guard` / `wiskey_native_feed` (one handle per
call), the energy store (`EnergyDatabase`, its own small schema). The first broad run caught why: the drill restores into
a scratch directory and removes it at once; idle pooled connections kept the files open (Windows refused the removal; on
Linux they would have stayed open on deleted files). `SW_DB_POOL_EVERY_HANDLE=1` makes every handle pool - the DB test set
was run both ways with it (section 5).

**Pool.** A pooling `Database` keeps idle connections per (database file, durability class): `durable=True` (FULL - user
actions, audit, reads) and `durable=False` (NORMAL - the HA mirror writes). Read and write transactions share the
durable list: a connection is reset to exactly what `_open()` leaves, and `connection(mode="read")` switches
`query_only` on per transaction as before. LIFO (the warmest connection first). Idle limits: 6 durable, 2 mirror
(`SW_DB_POOL_IDLE`, `SW_DB_POOL_IDLE_MIRROR`); more leases at once are opened as before and closed when they end.
Not per thread: a request's transaction is begun in one worker thread and committed in another (`CommitBeforeSend`),
so a per-thread pool would not fit the lifecycle; one shared list under a lock does.

**Lease, not the connection.** The caller gets a `PooledConnection` - a `sqlite3.Connection` subclass (so the product's
`isinstance(handle, sqlite3.Connection)` checks and the test helpers keep working) that forwards to the pooled
connection and never runs `sqlite3.Connection.__init__` itself. When the lease ends it is cut off. This keeps every
per-request semantic the code relied on:

- every lease is a new object, so `id(conn)` - the key of `_MODES`, the gate tokens, `_holders`, `_stray_logged`, the
  per-request caches - names one lease, never two requests (reusing the raw connection object would have let a
  per-request cache or a stray-detector mark outlive its request);
- a reference kept past the end (a background callback, a body that outlives its dependency) fails with
  "Cannot operate on a closed database", as a closed connection did, instead of silently running inside another
  request's transaction;
- **every cursor of the lease is closed at its end.** Verified on this machine before writing the code: a SELECT left
  half-read keeps its read snapshot even after `COMMIT` (`in_transaction` is False). On a pooled connection the next
  lease would read **old data** and no TRUNCATE checkpoint could pass it. The lease tracks its cursors by weak reference
  and closes the live ones.
- anything of `sqlite3.Connection` not forwarded explicitly fails loudly ("Base Connection.__init__ not called"). The
  rarely used connection-wide calls (`create_function`, `set_trace_callback`, `set_authorizer`, `executescript`,
  `backup`, `blobopen` ...) are forwarded but mark the lease *tainted*.

**Transactions and the write gate are unchanged.** A lease begins (`_begin_immediate`), commits (`_finish`,
`commit_now`, `release`), rolls back and hands the gate on through the same functions with the same bookkeeping; only the
last line - `conn.close()` - now ends the lease. The order stays "the lock is free before the gate is handed on":
`close()` rolls back anything still open on the SQLite connection first, then `_drop_hold` releases the gate. The
WRITE-GATE-EVENTS-2341 branch (`_finishing` / `_ending`) merges cleanly on top (`git merge-tree` checked: no conflict).

**Reset on return** (only after `connection()` / `write_aside()` ended the transaction): cursors closed; no transaction
open; `row_factory = sqlite3.Row`, `text_factory = str`, `isolation_level None`; `query_only=0` (read mode and
`release()` switch it on); `busy_timeout` (set again when leased, at the current `BUSY_TIMEOUT_S`); `foreign_keys=ON`;
`synchronous` FULL/NORMAL by class; `secure_delete` back to the build default (`bridge_keys` / `wiskey_camera` switch it
on for their deletes).

**Closed instead of pooled** (`/health` → `db.write_lock.conn_pool.discarded_by` counts each reason):

| Reason | Why |
|---|---|
| `tainted` | connection-wide state touched (functions, callbacks, authorizer, `executescript`, `isolation_level` / `autocommit` changed) |
| `state` | an ATTACHed database or TEMP objects on it |
| `error` | the lease ended in a database error other than "busy", an interrupt / cancellation (any non-`Exception`), or the rollback failed. A busy database ("database is locked") and ordinary exceptions (`ApiError`, a bug's `ValueError`) leave a clean connection after the rollback and are reused |
| `open_transaction` | a transaction still open at the end (a failed COMMIT, a lease closed by hand mid-transaction): rolled back, as closing did |
| `schema_change` | `PRAGMA schema_version` differs from what the pool last saw for the file: every idle connection of the file is dropped, and leases still out are closed when they end (generation bump). SQLite itself re-prepares after a schema change, so this is belt and braces |
| `stale` | the pool was invalidated meanwhile, the handle no longer serves that file (demo mode), or the file on disk is another file (device + inode changed) |
| `off` | the kill switch was turned off while the lease was out |

**Invalidation.** `migrate()` and `ensure_migration_objects()` (when they changed anything), `switch_path()` (demo mode
in / out: on Windows an idle connection would also keep the demo file from being removed), `invalidate_pool()`, and app
shutdown (`close_pool()`, last in the shutdown hook) close every idle connection. A checkout compares the file identity
(`os.stat` device + inode) with what the idle connections were opened on. The backup restore writes through the
request's connection (rows, not the file), so it needs no invalidation; nothing in the product replaces the database file
in place.

**Kill switch.** Add-on option `db_conn_pool` (default `true`, `config.yaml` options + schema, `self_update` schema,
DOCS / DOCS_HE) and `SW_DB_CONN_POOL=0`, which wins (same pattern as `db_write_gate`). Off, `_lease()` returns
`self._open()` - the exact previous code path, a plain `sqlite3.Connection` per transaction. `create_app` sets
`db.CONN_POOL` and logs a warning when it is off.

**Observability.** `/health` → `db.write_lock.conn_pool`: `opened` (new connections - each one parsed the schema),
`reused`, `pooled`, `closed` (over the idle limit), `discarded` + `discarded_by`, `invalidated`, `enabled`.

## 3. Numbers

`tests/bench_db_pool.py` (new; not collected by pytest), the dataset of PERF-HOME-DEVICES-2342: 300 areas, 2000 entities,
16 cameras, 1256 schema objects; TestClient in one process, Windows workstation low on memory (absolute numbers are slow,
compare the columns). The pool is switched with the kill switch inside the same process.

**The per-connection floor** (one read-mode `connection()` with one small SELECT, 50 calls):

| | p50 ms | p95 ms |
|---|---:|---:|
| pool off (a new connection: schema parsed) | 27.7 | 36.2 |
| pool on (a reused connection) | **0.5** | 1.3 |

**Sequential requests** (30 calls per mode, the pool switched off / on for every other call so the machine's drift hits
both alike; requests per second = 1 / mean):

| Endpoint | off p50 / p95 ms | on p50 / p95 ms | off req/s | on req/s |
|---|---:|---:|---:|---:|
| `GET /settings` | 46.1 / 57.5 | **18.4 / 23.2** | 21.5 | **55.9** |
| `GET /me` | 45.2 / 68.4 | **14.5 / 20.9** | 17.5 | **70.2** |
| `GET /devices/tree` | 267 / 329 | 215 / 498 | 3.7 | 4.0 |
| `GET /devices/areas/ar7` | 336 / 600 | 325 / 445 | 2.6 | 3.1 |
| `GET /devices/items?kind=lights&scope=building` | 332 / 490 | 297 / 560 | 2.9 | 3.2 |

**Four clients at once** (per mode, 4 threads x 7 calls; requests per second over the wall time):

| Endpoint | off p50 / p95 ms | on p50 / p95 ms | off req/s | on req/s |
|---|---:|---:|---:|---:|
| `GET /settings` | 106 / 169 | 79 / 248 | 34.1 | 38.3 |
| `GET /me` | 107 / 153 | 55 / 186 | 35.1 | **56.7** |
| `GET /devices/tree` | 2243 / 3002 | 3267 / 3703 | 1.7 | 1.3 |
| `GET /devices/areas/ar7` | 3492 / 3916 | 3500 / 4402 | 1.1 | 1.2 |
| `GET /devices/items?kind=lights&scope=building` | 3271 / 3744 | 3247 / 3940 | 1.2 | 1.3 |

Reading the numbers honestly:
- The small calls - the shell's `/me`, `/settings`, presence, links, every 401/403 path - lose the whole floor: 2.5-4x
  the sequential throughput, p95 down by two thirds.
- The heavy device screens save the same ~30 ms per request, which on this base is under 10 % of them: they are
  dominated by loading and parsing 2000 entities (PERF-HOME-DEVICES-2342 findings 1 and 9; that branch's fixes are not
  in this base). Sequentially they come out 3-20 % faster at p50, within the noise at p95.
- With four clients at once the heavy calls are bound by Python itself (one interpreter lock) and show no gain. A
  dedicated A/B (three rounds per mode, alternating order, 4 threads x 6 calls) gave p50 means of 3.31 s on / 3.20 s
  off for the tree and 3.51 s / 3.34 s for the area - 3-5 % slower with the pool, inside the run-to-run spread of
  either mode (off alone ranged 3.06-3.36 s). Not explained; recorded, not hidden. A plausible cause is that a reused
  connection no longer spends ~28 ms per request inside SQLite with the interpreter lock released, so the other
  threads get less of it.
- Working set per connection that parsed the schema: **~1.4 MB**. Idle limit 6 + 2 per file: at most ~11 MB kept.
- `/health` counters at the end of the run: 35 connections opened for 619 reuses.

**Opt-in stress tests** (60 s each, Windows workstation, three runs per mode, `SW_DB_CONN_POOL=0` for "off"):

| | `test_db_contention` (SW_DB_LOAD=1): ops in 60 s | probe p50 s | probe max s (bound 5.0) | result |
|---|---|---|---|---|
| on | 2285 / 3137 / 3480 | 0.073 / 0.038 / 0.031 | 5.15 / 3.55 / 4.12 | fail / pass / pass |
| off | 1821 / 1780 / 1727 | 0.161 / 0.154 / 0.163 | 3.06 / 3.81 / 5.02 | pass / pass / fail |

| | `test_db_lock_storm` (SW_PERF=1): writes | write p50 s | write p99 s (bound 1.0) | reads by 3 HTTP readers | result |
|---|---|---|---|---|---|
| on | 1013 / 1497 / 1167 | 0.224 / 0.110 / 0.176 | 1.63 / 0.63 / 0.73 | 678 / 1077 / 804 | fail / pass / pass |
| off | 1070 / 1097 / 1054 | 0.208 / 0.193 / 0.207 | 0.78 / 1.09 / 0.90 | 603 / 598 / 561 | pass / fail / pass |

No "database is locked", no gate timeout, no other error in any of the twelve runs. With the pool the same harness does
1.8-2x the operations in the mixed-load test and ~1.3x the reads in the storm, and the innocent writer's median wait
drops 2-5x. The wall-clock bounds (one write wait under 5 s; write p99 under 1 s) failed once per mode on this loaded
workstation: they are machine-sensitive, and no failure is specific to the pool. The first pool run in each test was
the slowest.

## 4. Risks and how they are covered

| Risk | Mitigation | Test (`tests/test_db_conn_pool.py` unless named) |
|---|---|---|
| State of one request leaks into the next (query_only, busy_timeout, row factory, pragmas) | full reset on return; anything not resettable closes the connection | `test_state_is_reset_before_the_connection_is_pooled`, `test_foreign_keys_..._on_again`, `test_secure_delete_...`, `test_connection_wide_state_is_never_pooled[function,trace,temp-table,attach]`, `test_executescript_...` |
| A stale reference acts inside another request | lease objects, cut off at the end | `test_a_lease_kept_past_its_end_fails_like_a_closed_connection` |
| Old read snapshot carried over (half-read cursor) | cursors closed at the end | `test_a_half_read_cursor_is_closed_so_no_old_snapshot_survives` |
| Gate or lock kept by a pooled connection | unchanged gate code; pooled only with no transaction; `_drop_hold` after | `test_the_gate_is_handed_on_and_no_stray_is_reported`, `test_a_lease_closed_by_hand_...`, the whole `test_db_gate*` / `test_db_locking` set |
| A broken connection reused | closed on database errors / interrupts / failed rollback | `test_errors_decide_reuse` |
| Schema change / migration / demo file / replaced file | invalidation, generation, file identity | `test_a_schema_change_and_a_migration_drop_the_idle_connections`, `test_a_lease_from_before_an_invalidation_...`, `test_demo_switch_...`, `test_a_file_replaced_on_disk_...` |
| Concurrency | one lock around the idle lists; leases exclusive | `test_concurrent_readers_and_writers_lose_nothing` (4 writers + 4 readers) and the opt-in stress tests |
| Memory | idle limit 6 + 2 per file; ~1.4 MB per connection measured, at most ~11 MB idle | bench |
| Open files keep a scratch / demo file or a test directory | only the app handle pools; idle closed on demo switch and shutdown | `test_a_handle_for_one_job_opens_per_transaction_unless_asked`, `test_requests_reuse_connections_and_health_reports_it` (shutdown empties the pool), `test_backup_drill.py` |
| Pool misbehaves in the field | kill switch, counters in `/health` | `test_db_conn_pool_is_an_addon_option_default_on_and_the_env_wins`, `test_kill_switch_*` |

Changed tests: `test_db_gate.py::test_mirror_writers_use_normal_and_user_actions_stay_full` spied on `Database._open`
(a reused connection is not opened again); it now spies on `Database._lease` - the connection a transaction actually
gets - and asserts the same `synchronous` values. `test_db_template.py::test_no_product_code_reads_the_schema_cookie`
allows exactly one read in `db.py`: the pool only compares two reads of the same file in one process, never the value.

Not covered / residual risk: code that keeps a *cursor* (not the connection) past its transaction inside one request is
unaffected; code that keeps one past the end of the request now gets "closed cursor" instead of "closed database" (the
same failure). Any third-party call that needs a real `sqlite3.Connection` at C level (`src.backup(target=lease)`) fails
loudly; there is none in the product.

## 5. Tests run

All on the Windows workstation, single process (`-o addopts="" -q`), Python 3.12.10, SQLite 3.49.1. The runner was not
used (release gates tonight).

| Run | Result |
|---|---|
| DB set, final code: `test_db_gate`, `test_db_locking`, `test_db_contention`, `test_db_io_guard`, `test_db_lock_storm`, `test_db_template`, `test_db_conn_pool` (new, 26), `test_read_mode`, `test_secrets_transitional_263`, `test_self_update_s3_fixes`, `test_health_process_stats`, `test_health_report` | **131 passed, 2 skipped** (the two opt-in stress tests) |
| The same set before the opt-in-per-handle change (every `Database` pooled, `e699d1e28`) | 130 passed, 2 skipped |
| `test_db_gate_stray_detector` + `test_db_gate` with `SW_DB_POOL_EVERY_HANDLE=1`, on a local merge with `origin/fix/WRITE-GATE-EVENTS-2341` | 36 passed |
| `test_db_gate_stray_detector`, `test_db_conn_pool`, `test_db_gate`, `test_db_locking` on that merge (default mode) | 83 passed |
| Broad backend selection, 40 files (read mode, devices, settings, remote / auth-first, RBAC, events, backup / drill / offbox / restore safety, demo mode, health, self-update switch, shared spaces, presence, exports, bundle import, crash guard, capture-lease events, calendar connect, tickets payments, access grants hardening, energy store, HA sync 1000, playback release, Frigate, fleet / readiness) | 613 passed, 1 skipped, **2 failed - both also fail with the pool off** (below) |
| Earlier, separately: `test_access_grants` 68 passed, `test_automations_access` 6, `test_access` 4, `test_backup` 8, `test_backup_drill` 13 (after the fix) | passed |
| Opt-in stress, 60 s each, 3 runs per mode (section 3) | on: 2 of 3 pass in each test; off: 2 of 3 pass in each test; no lock / gate / other errors in any run |

The two broad-run failures, not caused by this change:
- `test_readiness_96.py::test_a_demo_runs_on_a_separate_database_and_leaves_the_real_one_untouched` - the demo directory is
  still there after the stop on Windows. Fails the same with `SW_DB_CONN_POOL=0` and on the main checkout (2.32.0,
  `f28f9b6f6`): the stop request's own connection, opened on the demo file, is still open when `_leave` removes the
  directory (`ignore_errors=True`; "the next boot clears it"). Pre-existing, Windows only.
- `test_remote_auth_first.py::test_the_flood_does_not_queue_behind_a_writer_nor_delay_the_next_one` - the wall-clock
  bound (`flood_s < 5 s x load factor`): 10.3 / 9.0 s with the pool, 9.0 s with `SW_DB_CONN_POOL=0`; the gate assertions
  of the test (nobody of the flood queued, no acquire) passed. Machine load.

The first broad run (101 files, stopped at ~2 % because it would have taken hours) found the one real problem - the
backup drill's scratch directory kept open by idle connections - fixed by opting in per handle (`8209da89f`).

NOT_RUN: the full backend suite (795 files; the train gate runs it); the runner (busy with release gates); a Linux /
SD-card host measurement; frontend (no frontend change).

## 6. For the owner

- Default is **on**. Every non-timing test passes; the only failures seen are two pre-existing ones and wall-clock
  bounds that fail in both modes on this machine. If anything misbehaves in the field: add-on option `db_conn_pool: false`
  (or `SW_DB_CONN_POOL=0`) and restart - the old per-request connections, exactly.
- Watch `/health` → `db.write_lock.conn_pool`: `opened` should stay small next to `reused`; `discarded_by.error` /
  `open_transaction` growing would mean something ends its transactions unusually.
- Merging with `fix/WRITE-GATE-EVENTS-2341` and `perf/HOME-DEVICES-LOAD-2342`: `db.py` merges cleanly with both
  (`git merge-tree`); the perf branch conflicts only in its own release files (version, changelog, API inventory).
