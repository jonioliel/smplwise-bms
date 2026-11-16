# CR-SCHEMA-PROBES-2440 - run-time schema probes outside tickets move to the cached helper

Branch `pilot/CR-SCHEMA-PROBES-2440`, based on `origin/pilot/CR-WAVE2-COMBINED-2439` (`4e52e5e4a`). Code review 2026-11-13,
MASTER_PLAN section 3.4 row `CR-SCHEMA-PROBES-2436`: report 05 P2-10 (D8 outside tickets), P2-11, P3-05. Behaviour is
identical: each probe gets the answer its own SQL gave; **no fallback was removed**.

`db.has_table(conn, name)` / `db.has_column(conn, table, column)` already exist at this base (`CR-CORE-HELPERS-2438`): the answer
of the same `sqlite_master` / `PRAGMA table_info` question, cached per database file and schema version (a schema change gets
a fresh answer; an uncommitted change is answered but not remembered; a database with no file is asked directly). This branch
is the adoption.

## Resolved list of probe sites (recorded first)

28 sites in 21 files outside `services/tickets/` at this base (`grep` for `sqlite_master`, `PRAGMA table_info`), plus the
helper's own 6 lines in `db.py`.

### Moved to the helper (11 sites, 11 files)

| File | Probe | Now |
|---|---|---|
| `services/autosync.py` | `_has_column(conn, table, column)` | `has_column` |
| `services/bridge_rotation.py` | `_has_tables` (`bridge_keys`) | `has_table` |
| `services/capture_lease.py` | `tables_present` (count of two tables = 2) | `has_table` and `has_table`; still `False` on `sqlite3.Error` |
| `services/energy_calibration.py` | `has_tables` (`energy_meter_calibrations`) | `has_table`; still `False` on `sqlite3.Error` |
| `services/events_ingest.py` | `_has_recorder_column` (`events.recorder_id`) | `has_column` |
| `services/fleet_report.py` | `_table(conn, name)` | `has_table` |
| `services/local_identity.py` | janitor gate (`auth_local_sessions`) | `has_table` |
| `services/local_reset.py` | janitor gate (`auth_local_reset_codes`) | `has_table` |
| `services/media_store.py` | `ha_devices.parent_device_id` | `has_column` |
| `services/plan_bakes.py` | `sweep_orphans` gate (`plan_bakes`) | `has_table` |
| `services/water_billing.py` | janitor gate (`water_bills`; the old SQL had no `type = 'table'` filter - no index or view carries that name) | `has_table` |

The wrapper functions keep their names (callers and tests use them). Most of these run on a timer (the janitor every 30 s, the
event ingest per event), which is where the cached answer pays.

### Skipped - owned by another 3A branch (left for 3B)

| File | Site | Owner |
|---|---|---|
| `services/energy_sampler.py:131` | two tables of the billing branch | `CR-BE-TWINS` |
| `services/health_report.py:212` | `ha_users` | `CR-HEALTH-POLLERS` |
| `services/ha_user_auth.py:1067` | `remote_revoked_chains` | edited by `CR-REDACT` (its resolved list) |

### Not a "does it exist" question - left as they are

| File | What it does |
|---|---|
| `services/backup.py:318, 322` | lists every table / the ordered columns of a **backup file** being checked or restored (another database) |
| `services/demo_mode.py:112` | the table set of the demo database while it is built |
| `services/energy_store.py:732, 750` | its own readings file, during its own schema upgrade |
| `services/local_privacy.py:84, 88` | the whole table / column set for the personal-data export (iterated, not asked once) |
| `routers/energy_meters.py:495` | a router, not a service file (the row's scope); it needs the column set for two columns. For 3B (`has_table` + two `has_column`) |
| `db.py:934` | the `temp` schema of a pooled connection |

### Run-time DDL outside migrations (05:P2-11) - why each still exists; none changed

| Site | Why it exists | Status |
|---|---|---|
| `db.ensure_migration_objects` (`db.py`, called once at start) | migrations 0036 / 0037 share their numbers with another branch's; a database that recorded those numbers from the other numbering never runs ours, so the objects themselves are checked | kept: not proven dead (needs proof that no installed database carries the other numbering) |
| `shared_spaces.ensure_schema` (`shared_spaces.py:92-117`, called once at start) | migration 0038 changed while its branch was open (a column, the members table, the WisKey station member kind) | kept: same reason; a development-database repair |
| `wiskey_service_write.py` (`CREATE TABLE IF NOT EXISTS wiskey_service_write_journal`) | a journal created on first use | kept; candidate for a migration |
| `wiskey_write_lineage.py` (`CREATE TABLE IF NOT EXISTS ...` x4) | a database file of its own, not the product database | fine as it is (like `energy_store.py`) |

Folding the two start-up repairs into one documented start-up step is what `startup_steps.AFTER_MIGRATE` of
`CR-MAIN-ROUTERS-TABLE-2440` already does (they are its steps 3 and 4, with their reasons); this branch does not touch `main.py`.

### "Older database" fallbacks (05:P2-10) - all kept

The plan allows removing a fallback only where a test proves it unreachable. No such proof was produced here (the upgrade suites
were not run to that end on this workstation), so nothing was removed. `audit.py:65-67` (the insert retried without the columns
of migration 0032) is marked in place as "kept, verify": an upgrade from below 0032 can audit before `migrate()`.
The remaining fallbacks of the report's count (59 sites in 39 files, not itemised there) are for the closing chain, each with
its own upgrade test.

## Lead decision L3 (05:P3-05, faster fresh install) - not done

The row allows `synchronous=NORMAL` for the migrations of an empty database only after checking the Supervisor watchdog
time-out. That check needs the Home Assistant host; this batch has no device or HA access. Recommendation unchanged: do it only
after that check. Left for the lead.

## Resolved file list

Edited: the 11 service files above, `smplwise/audit.py` (a comment only). New: `tests/test_schema_probes_2440.py`.
`db.py` and `services/shared_spaces.py` are in the row and unchanged.

Outside my rows: nothing.

## Tests (workstation, Windows, Python 3.12 venv, `-p no:xdist`)

TESTS_PLACEHOLDER

`ruff check` (rule set F) on the 11 service files: the same single pre-existing finding before and after
(`energy_calibration.py`: unused `now_iso`).

NOT_RUN locally: the full backend suite and the whole upgrade set - left to the combined branch's entry check.
