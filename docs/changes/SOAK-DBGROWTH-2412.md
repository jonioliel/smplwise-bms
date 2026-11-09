# SOAK-DBGROWTH-2412 - API latency that grew with the database, and the write-lock holders of the saturated hours

Branch `fix/SOAK-DBGROWTH-2412` from `origin/main` @ `9e6a8d62c` (v2.41.1). No version bump, not merged into a train.

Source: the 17.7 h soak of the 2.40.7 backend on the test runner (`scripts/soak/t068_long_soak.sh`, harness
`tests/soak/soak_long.py`; run `long-20261108b`, 08.11 10:18Z - 09.11 04:00Z, 1062 one-minute samples). The run data stays
on the runner (`~/soak/t068-2407/long-20261108b/`); the numbers below are copied from it, camera / entity ids left out.

## Finding 1 - api_p95_ms rose with db_bytes while the host was idle

### Evidence

| Sample (UTC) | host load | db_bytes | api_p95_ms | api_max_ms |
|---|---|---|---|---|
| 08.11 10:19 | 0.2 | 6.8 MB | 30.7 | 41.7 |
| 08.11 15:04 | 0.3 | 183 MB | 199.5 | 209.3 |
| 08.11 20:34 | 0.4 | 390 MB | 478.7 | 491.5 |
| 09.11 01:20 | 0.5 | 569 MB | 698.6 | 735.3 |

- `api_max_ms` grows linearly with the database at idle; `api_p95_ms` alternates between ~50 ms and the max from minute to
  minute. A p95 of ~115 requests per minute is the 6th slowest: one route asked ~6.5 times a minute sits right on that
  boundary. (The ":19 / :49" look of the spikes is that alternation sampled every 15 minutes, not a periodic job.)
- Every soak route timed against a copy of the final database (669 MB, 677k events, 1.22M HA history rows) with the
  2.40.7 code, the events cache cleared before each call (runner, `nice 10`, idle host):

| route | median |
|---|---|
| `GET /events/facets` | **505.9 ms** |
| `GET /cameras/{id}/events` (timeline) | 29.4 ms |
| `GET /events/windows` | 26.2 ms |
| `GET /health` | 16.6 ms |
| `GET /ha/entities` | 15.0 ms |
| the other 10 routes | 4.5 - 7.7 ms each |

- The facets query, `SELECT type, source, severity, camera_id, COUNT(*) FROM events WHERE occurred_at >= <90 days ago>
  GROUP BY ...`: plan `SEARCH events USING INDEX idx_events_time (occurred_at>?)` + `USE TEMP B-TREE FOR GROUP BY`, 490 ms -
  a walk of every event of the period. The events cache does not help: the facets are keyed on the `events_rows` counter,
  and the soak adds a row every few hundred milliseconds (6 alerts/s from the fake NVR, 20 HA state changes/s).

### Root cause

`/events/facets` counted every event of the last 90 days per request; the cost is linear in the table and the result is
invalidated by every new row. Retention did not and should not have bounded it within the run: `events.retention_days`
defaults to 30 (pruned by the hourly housekeeping, `events_derive.prune`), HA history to 30 days (`ha_history.RETENTION_DAYS`),
so nothing in a 17.7 h run is old enough to prune. Real installations reach the same table size slowly (several hundred
thousand events within the 30 days on a busy site), so the cost was a production issue, only compressed by the soak's rate.

A covering index alone (`events(type, source, severity, camera_id, occurred_at)`) was measured too: 57 ms instead of 490 ms,
still linear. Not taken.

### Fix

- Migration `0210_events_facet_days.sql`: `events_facet_days(day, type, source, severity, camera_key, n)` (WITHOUT ROWID),
  backfilled from the events table, kept by three triggers on `events` (insert, delete, update of the facet columns) in the
  same transaction as the write - the pattern of 0031's cache counters. `camera_key` is `''` for a camera-less event.
- `routers/events.py` `_facet_rows(conn, since)`: whole UTC days after the first one from `events_facet_days`, the first
  (partial) day counted from the events table (`occurred_at >= since AND occurred_at < <next day>`, served by
  `idx_events_time`). Same numbers as the old query; work bounded by one day of events. Used by the facets and by the
  events list's "this type never occurred" note (`_types_present`, the same GROUP BY over 90 days).
- The cache keys and counters are unchanged (`events_rows` still bumps on the same writes).

### Result on the soak database (runner, same copy)

- `_facet_rows` vs the old query: 0.05-0.10 ms vs 488-491 ms, identical rows (checked on every run).
- `GET /events/facets` through the app: 505.9 ms -> 4.7 ms median. All 15 soak routes are now <= 31 ms.
- Migration 0210 on the 677k-row table: about 1 s for 0209 + 0210 together (one-time backfill at start-up).
- Insert cost of the trigger: 2000 inserts in one transaction 28 ms with it, 23 ms without (on the soak copy).

## Finding 2 - "database is locked" only in the saturated hours

### Evidence

- 109 `database is locked` and 25 request errors, all in 12:30-14:00Z and 02:00-04:00Z, when release gates drove the
  runner to load 38-47; none in the 12 idle hours. The soak backend runs under `nice -n 19`, `ionice -c3` (idle I/O class)
  and `taskset` on two cores, so during the gates it got almost no CPU and almost no disk.
- Who HELD the lock (backend.log, `write lock held` and `the write lock is held by`):

| holder | slow holds | longest | waiters it made fail |
|---|---|---|---|
| `notify.faults` (notification monitor, camera / storage pass, every 30 s) | 10 | **61.9 s** | 59 (media, HA state update, alert stream, escalation, generator, elevators, user touch, exports, thumbnails, live) |
| `GET /api/v1/health` | 4 | 22.2 s | 19 |
| `ha_sync._write` (HA state update itself) | 10 | 6.5 s | - |

  The "HA state update" and "alert stream" writers named in the summary were the victims, not the cause.
- On the same database copy at idle: the `notify.faults` camera query 108-120 ms, `GET /health` 15-17 ms - both under
  BEGIN IMMEDIATE.

### Root cause

Not pure starvation: two holders did read work inside the write transaction whose size grows with the events table, and
starvation then stretched that work by two to three orders of magnitude (idle-class I/O on a disk the gates were busy with).

1. `notify_sources.cameras_tick` (label `notify.faults`) looks up each camera's open video-loss row with `e.camera_id = c.id
   AND source = 'alertstream' AND type = 'offline' AND state = 'active' AND occurred_at >= <24 h>`. The planner served it from
   `idx_events_camera_time` - every event of the camera in the last 24 h (~8k per camera in the soak, two subqueries x 8
   cameras), with a table lookup per row to test source / type / state. Under the write lock, every 30 s.
2. `GET /health` used `get_conn` (BEGIN IMMEDIATE) although it writes nothing, and runs `SELECT COUNT(*) FROM events` (a walk
   of the whole time index) inside.

`ha_sync._write` holding 4-6.5 s is the starvation of a short transaction (one state row, a correlation row, rule checks);
it is left as it is.

### Fix

- `cameras_tick`: the lookup is written so the planner walks `idx_events_alert_open` (migration 0207, the partial index of
  open alert-stream rows by kind, camera and last-seen time) - `COALESCE(e.camera_id, '') = +c.id` (unary `+`: no column
  affinity, otherwise the expression index is not usable), the implied `COALESCE(e.ended_at, e.occurred_at) >= cutoff`, and
  `ORDER BY +e.occurred_at` so the time index is not chosen for the sort. Same rows, same answers: the extra term is implied
  by `occurred_at >= cutoff` (ended_at is never before occurred_at), and a camera id is never `''`.
- `GET /health`: `current_principal_ro` + `get_read_conn` (deferred, query-only). A spy on `_begin_immediate` confirms it
  opens no write transaction for an administrator or a viewer.

### Result on the soak database

- `cameras_tick` with the new code 0.17-1.7 ms; the 2.40.7 code 111-120 ms on the same copy (plan: `SEARCH e USING INDEX
  idx_events_alert_open`).

## Tests

New: `smplwise_vms/backend/tests/test_soak_dbgrowth_2412.py` (7 tests).

- facets: same rows as the old GROUP BY through inserts, facet-column updates (type, camera, occurred_at, camera to NULL),
  non-facet updates and deletes, for 1 / 7 / 30 / 90 / 365 days; no zero rows; per-day table equal to the events table;
- migration 0210 backfills a table emptied as before 0210 and is idempotent (run twice, three triggers);
- facets work (SQLite VM steps) on 20k rows within a small constant of 500 rows, while the old query is > 10x;
- `/events/facets` and the `type` filter note through the API;
- camera pass: plan on `idx_events_alert_open`, never `idx_events_camera_time`, answers equal to the old query (open loss,
  older open loss, closed loss, loss older than 24 h, device-level loss, no loss); work constant from 200 to 12k rows;
- `/health`: no write transaction (spy), and it answers while another writer holds the lock.

With the three code files reverted (stash) the new tests fail: 5 failed (facets helper missing, plan / work bounds, the
write transaction of /health).

Runs (workstation, Windows, Python 3.12):

- `pytest tests/test_soak_dbgrowth_2412.py`: 7 passed.
- Related suites (backup / restore / privacy, db gate / locking / lock storm / contention / pool / template, events /
  events cache / search / spatial search / rbac camera scope, health / health report / summary / process stats, ingest lock,
  notify core / sources, migrations + 263 upgrade, autosync, backpressure, capabilities, NVR-less, multi-NVR, push, remote
  hardening, stream codecs, camera sources, security reviews CR-022 / XSECFIX-297), 42 files including the new one, one
  serial run: exit code 0, 853 tests, 850 passed, 3 skipped, 0 failed (counted from the progress output; the summary line
  was cut by the output filter). About 75 min on the workstation.

## NOT_RUN

- The full backend suite and the gate (owner rule: no gate started from this task).
- A new soak with the fix.
- The UI: no UI change.

## Notes

- A later migration that rebuilds the `events` table must recreate the triggers of 0210 (and of 0031).
- `events_derive.prune` deletes all expired events in one transaction; with the 0031 and 0210 triggers the delete costs a
  few trigger statements per row under the write lock. At a real installation's rate (a day's worth per hourly pass) that
  is small; at the soak's rate it would be ~900k rows per day. Not changed here.
