# CR-CORE-HELPERS-2438 - additive core helpers (db, errors, values)

Branch `pilot/CR-CORE-HELPERS-2438` (MASTER_PLAN entry `CR-CORE-HELPERS-2436`, wave 2), cut from `origin/main` (`0a8fb55e1`,
v2.43.5). Source: the code review of 2026-11-13 (`private/code-review-2026-11-13/`): 04:F16 step one, 04:F24 (module), 04:F25
(helper), the helper half of D8 (01:F-10, 05:P2-10) and 05:P3-04.

Base: no in-flight branch (`pilot/*2435..2438`, `CR-WAVE1B-COMBINED-2436` included) changes `db.py`, `errors.py`,
`services/wiskey_call_budget.py` or adds `services/values.py`, so `origin/main` is the base; nothing here depends on wave 1. This
branch is the single owner of `db.py` and `errors.py` for wave 2 (MASTER_PLAN 3.3).

Additive: **nothing adopts the new helpers in this branch** (CR-SCHEMA-PROBES, CR-BE-SMALL-UNIFY, CR-BE-TWINS and TK-STORE-TIDY
move the callers later). No migration, route, permission, setting or frontend change.

## What changed

1. **`errors.ServiceInvalid(ValueError)`** (04:F16 step one): one shape for the services' validation errors - `code`
   (default `validation`), `fields`, `message`, `details`, `status` (422) - and `to_api_error(message=None, *, status=None)`.
   Class-level defaults, so a class that adopts it later can keep its own constructor; `api_details()` is the override point for an
   endpoint whose envelope carries `details.field` / `details.key` instead of `details.fields` (envelope keys change only with a
   contract decision).
2. **`db.has_table(conn, name)` / `db.has_column(conn, table, column)`** (D8 helper half): the answer of the inline
   `sqlite_master` / `PRAGMA table_info` probes, cached per (database file, file identity, `PRAGMA schema_version`) - a migration,
   a runtime CREATE / ALTER, a restored file or the demo file each get a fresh answer. A write transaction's answer is cached only when
   its schema version is one the pool already saw committed (an uncommitted CREATE that is rolled back must not answer for a
   different change committed later under the same number - tested). A connection without a file is asked directly every time.
   `forget_schema_cache()` for tests.
3. **`db.update(conn, table, sets, where, params=())`** (04:F25): the `UPDATE t SET k = ?, ...` idiom with the table and every key
   checked against `^[a-z_][a-z0-9_]*$` before any SQL runs (ValueError), the values bound in order, then `params`; an empty `sets`
   runs nothing and answers 0; an empty WHERE is refused. Returns the row count.
4. **Call-budget hook** (05:P3-04): `_begin_immediate` and `Database._open` imported `services.wiskey_call_budget` on every BEGIN
   and every open (a core-to-service layer inversion). The module now registers itself at import (`db.set_call_budget`, two lines
   at the end of `services/wiskey_call_budget.py`); db.py keeps the module object, so a test that patches `active` or `_clock` is
   honoured. A budget is a context variable of that module, so before its import no budget can be active: "nothing registered"
   is "no budget", exactly as before.
5. **Remembered busy timeout** (05:P3-04): `_begin_immediate` read `PRAGMA busy_timeout` on every write. A pooled lease now
   remembers it: set when the pool hands out a reused connection (the value it has just set), read once on a freshly opened one,
   kept when `_begin_immediate` restores it after a shortened wait. Any statement of the lease that names `busy_timeout` forgets it,
   and the next BEGIN reads it again. A non-pooled connection (pool switched off) reads it every time, as before.
6. **`services/values.py`** (04:F24): only the copies that are identical - `clip` (= `_clip` in `notices/push.py`,
   `notify_policy.py`, `push.py`), `checked_setting(conn, registry, key)` (= `setting(conn, key)` in `offline_field.py`,
   `quiet_windows.py`, `readiness.py`, each over its own `SETTINGS`), `object_with_keys` (= `_object` in `area_row.py`,
   `home_screen_options.py`). The `_num` / `_int` / `_int_in` / `_bool` families differ between copies and stay.

## Tests

New `tests/test_core_helpers_2438.py` (14 tests): the envelope of `ServiceInvalid` and of a subclass that keeps its constructor or
never calls the base one; `has_table` / `has_column` against the inline probe, a committed CREATE / ALTER seen at once, a rolled
back CREATE never answering for a later one, a `:memory:` connection, the cache hit running no `sqlite_master` / `table_info`
statement; `update` (binding order, refused identifiers, empty sets, empty WHERE); the call budget registered and still refusing a
write once spent; a reused lease running no `busy_timeout` read, a lease that sets its own read again; each `values` helper equal to
every copy it names.

Run locally (`-p no:xdist -o addopts=""`, `.venv` Python 3.12, workstation saturated):
- `tests/test_core_helpers_2438.py` + `tests/test_db_gate.py` + `tests/test_db_conn_pool.py`: 72 passed, 1 failed (17 min).
- After the last db.py edit (cursor / tainting calls forget the remembered timeout): `tests/test_core_helpers_2438.py` +
  `tests/test_db_conn_pool.py` + the one failing gate test: 42 passed, 1 failed (9.5 min).
- The failing test is `test_db_gate.py::test_one_attempt_never_waits_longer_than_the_busy_timeout` (wall-clock bound: 1.97 s
  measured against `< 1.5`). The same test **also fails on the unchanged main checkout** on this machine at the same time (control
  run, 1 failed) - the workstation load, not this branch. It runs on a non-pooled handle, where `_begin_immediate` still reads
  `PRAGMA busy_timeout` exactly as before. The runner entry check is the verdict.

NOT_RUN locally (runner entry check): `tests/test_migrations*.py`, the WisKey budget tests (`test_wiskey_rc4_deadline_2310.py`,
`test_wiskey_m12_s3_maintenance.py`, `test_owner30_doors.py`), `test_db_locking.py`, `test_intercom.py`, the full suite.
