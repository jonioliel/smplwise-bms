# CR-READCONN-A-2436 - access-area GET routes off the write lock

Branch `pilot/CR-READCONN-A-2436`, from `origin/main` at 665ec8f24 (v2.43.4). Code-review master plan 2026-11-13, section 3.2
(wave 1, backend), theme T1. No version bump, no migration, no frontend change, no pixel change. Route signatures only; no
handler body was edited.

## Findings covered

| Finding | What changed |
|---|---|
| 02:P1-3 | The 7 door-windows / emergency reads that opened BOTH connections (`current_principal` on `get_conn` + `get_read_conn`) now resolve the principal on the read connection (`current_principal_ro`). Same slip in `routers/quiet.py` (2 routes) fixed too. |
| 02:P1-4 | 42 access-area GET routes in total moved to `current_principal_ro` + `get_read_conn` (list below). 7 stay on the write connection because they write (allow-listed with the reason). |
| 02:P3-5 | `access_control._reader` (write twin of `_reader_ro`) lost its last user (`GET /intercom/background`) and is deleted. The `access_groups` twins (`_assign_holder` / `_assign_gate_ro`) both still have users (`_assign_holder`: `bind_group`, `unbind_group`, `group_impact` - POST/DELETE), so both stay. `access_control._credentials_admin` still serves `DELETE /intercom/stations/{id}/credentials` and stays; its read twin `_credentials_admin_ro` (already present) now serves the three GETs. |
| 05:P1-02 (access area) | Same as 02:P1-4; the rest of the application is CR-READCONN-B. |

## Route list (resolved)

Converted to the read connection (42):

- `routers/door_windows.py`: `GET /doors/windows/state`, `/doors/windows/calendar`, `/doors/windows/settings`,
  `/doors/emergency/state`, `/doors/emergency/grants`, `/doors/emergency/incidents/{id}`, `/doors/emergency/settings`
  (principal only - these already read on `get_read_conn`), and `/doors/windows/doors/{station_id}/{relay}/program/preview`
  (both; its body's `commit_now(conn)` ends the deferred read transaction and starts another - the engine read already
  runs on its own read connection).
- `routers/quiet.py`: `GET /quiet/windows`, `/quiet/settings` (principal only).
- `routers/schedules.py`: `GET /schedules/catalog`, `/schedules/scripts` (through `_manager`, whose only users are these two
  GETs - converted in place), `/schedules/condition-candidates`, `/schedules/trash` (through a new `_viewer_ro`).
- `routers/door_automations.py`: `GET /door-automations/status`, `/door-automations`, `/door-automations/doors`,
  `/door-automations/{block_id}`, `/door-automations/{block_id}/fires`.
- `routers/access_control.py`: `GET /intercom/overview`, `/intercom/background` (`_reader_ro`), `/intercom/diagnostics`,
  `/intercom/stations/credentials`, `/intercom/stations/{station_id}/credentials` (`_credentials_admin_ro`),
  `/intercom/tts/engines` (through `_caller`, whose only user is this GET - converted in place; the body's `unlocked(conn)`
  restarts a deferred read transaction in read mode, `tests/test_read_mode.py`).
- `routers/access.py`: `GET /identity/users`, `/access/roles`, `/access/bindings`, `/audit`, `/access/delegation`.
- `routers/doors.py`: `GET /intercom/door-map`, `/access/door-grants`, `/doors/settings`.
- `routers/local_identity.py`: `GET /identity/local-users`, `/identity/local-users/export`, `/identity/local-users/{user_id}`.
- `routers/wiskey_relay_map.py`: `GET /wiskey/relay-map`, `/wiskey/relay-map/export`, `/wiskey/relay-map/export/{seq}`.
- `routers/access_groups.py`: `GET /access/groups`.
- `routers/ha_users.py`: `GET /ha-users`.
- `routers/service_identity.py`: `GET /identity/service-identity`.

Kept on the write connection (`smplwise_vms/backend/tests/get_write_allowlist_access.txt`, 7): `GET /schedules/status`
(`store.MIRROR.ensure(conn, force=recheck)`, the known case of the plan), and `GET /schedules`, `/schedules/organisation`,
`/schedules/runs` (also `store.settle_runs`), `/schedules/review`, `/schedules/tags`, `/schedules/{schedule_id}` - all
through `_ctx(sync=True)` -> `store.MIRROR.ensure(conn)`, which pulls and rewrites the mirror cache on the request's
connection when it is stale. On a read connection that pull would either fail or (through its read-mode branch) leave the
request reading its pre-pull snapshot - a behaviour change, so they stay. `_viewer` (write) remains for them.

## Behaviour

Identical answers: the same queries on a deferred, query-only connection. Differences that are by design of the read
connection (`auth.get_read_conn`, documented in `auth.py`, `audit.py`):

- The per-request user touch and a refusal's audit row are written through `db.write_aside()` (a short side transaction)
  instead of inside the request's transaction.
- Two converted routes record an audit row on SUCCESS: `GET /intercom/diagnostics` (`intercom.diagnostics.read`) and
  `GET /identity/local-users/export` (`identity.local.user.exported`). The row is now written aside, just before the answer,
  exactly as a refusal is on every read route. The request no longer holds the write lock while `wiskey_diagnostics.collect`
  talks to WisKey.
- A handler that would write fails loudly on the read connection (`query_only`): see the write-attempt sweep below.

## Tests

New (written first; red before the conversion, see below):

- `smplwise_vms/backend/tests/test_get_routes_read_conn.py`
  - inventory: every GET route of the in-scope routers whose dependency tree reaches `auth.get_conn` must be listed in
    `tests/get_write_allowlist_*.txt`; an entry whose route is gone or no longer reaches `get_conn` fails as stale. Scope =
    the 12 access-area routers; once `tests/get_write_allowlist_rest.txt` exists (CR-READCONN-B) the scope becomes every
    router module and every allow-list file is read - READCONN-B adds its file and does not need to edit the test. Routes
    are read from each router module's own `APIRouter` objects (as `test_plan_routes_unique.py`), because FastAPI 0.141
    includes routers lazily (`_IncludedRouter`), so `app.routes` does not list them.
  - parametrised: each in-scope GET route that is not allow-listed answers (status < 500, within the read-mode bound of
    `test_read_mode.py`) while another connection holds the write lock. The two success-audit routes above are left out of
    this check (their aside audit row waits for the lock by design) and are covered by the inventory test.
- `smplwise_vms/backend/tests/get_write_allowlist_access.txt` (7 entries with reasons).

Results (local, Windows, Python 3.12.10, the main checkout's `.venv`; the workstation was CPU-saturated by other sessions):

- Red first: before the conversion, `test_get_routes_on_the_write_connection_are_allow_listed` FAILED listing exactly the 42
  routes above (2 tests run: 1 passed, 1 failed).
- `python -m pytest tests/test_get_routes_read_conn.py`: **55 passed** (2 inventory tests + 53 parametrised GET routes: the 42
  converted ones and the 11 that already were on the read connection).
- Focused area run: every test function in the touched area that calls one of the converted GET URLs (245 functions, picked
  by scanning the 156 area test files for the URLs, 255 items with parameters) plus `tests/test_read_mode.py` (4):
  **259 passed in 50:30**, run with a diagnostic pytest plugin (not committed) that installs an SQLite authorizer on every
  read-mode request connection labelled `GET ...` and records each INSERT / UPDATE / DELETE / CREATE prepared on it - even one
  whose "readonly" error a caller swallows (e.g. `local_reset.channel_ready`'s `except Exception`). **0 write attempts
  recorded.** A positive control (an INSERT on a read connection labelled `GET /control`) was recorded, so the probe works.

NOT_RUN:

- The rest of the touched area's suite (156 files, about 3,100 test functions). A full run was started and stopped by me
  after 50 minutes at about 81 tests (about 37 s per test on the saturated machine); one of those 81 showed `E` (error), and
  the run was stopped before pytest printed which one, so it is unidentified - it is not claimed as related or unrelated.
  The named globs of the row (`test_access.py`, `test_rbac*.py`, `test_schedules_*.py`, `test_doorwin*.py`,
  `test_ha_users.py`, `test_local_identity.py`, `test_read_mode.py`) ran only through the focused selection above, not as
  whole files. The lead's combined runner entry check covers them.

## Skipped / not run

- No runner entry check (the lead combines wave-1 branches). No pixel run (no UI change).
- Static review of every converted handler and its direct helpers for writes; deeper helper chains are covered by the
  dynamic sweep only where a test reaches them.
- `02:P3-5` for `access_groups`: no twin was removed (both still have users).
