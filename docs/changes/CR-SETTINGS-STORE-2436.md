# CR-SETTINGS-STORE-2436 - the settings registry moves to `services/settings_store.py`; `setting_value` for one plain key

Branch `pilot/CR-SETTINGS-STORE-2436`, from `origin/main` at 665ec8f24 (v2.43.4). Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.2, wave 1, theme T8. No version bump, no migration, no
frontend change, no pixel change.

## Findings covered

- **05:P1-10 step 1** - `routers/settings.py` was the backend's settings registry; 19 `services/` imports and `main.py` pulled a
  router (FastAPI route registration) into every worker that only wanted a setting. `DEFAULTS`, `SCHEDULE_CLASSES`,
  `INT_KEYS`, `FROZEN_SKINS` / `FROZEN_FALLBACK_SKIN`, `stored_skin`, `PRIVATE_KEYS`, `read_settings`, every `_stored_*`
  normaliser, `PLAN_SURFACES` / `stored_plan_surfaces`, `CLASSES_REV_KEY` / `stored_schedule_classes`, the `ui.tabs`
  constants, `_stored_tabs` and `normalize_tabs` now live in `services/settings_store.py`, moved verbatim.
  `routers/settings.py` re-exports every one of these names (the same objects), so **no caller changes** in this step.
  The PATCH-only constants (`ALLOW_DISARM_WORD`, `LOCAL_PURGE_WORD`, `DEVICE_THEMES`, the field patterns), `SettingsPatch`
  and both handlers stay in the router.
- **05:P1-03 (the helper only)** - new `settings_store.setting_value(conn, key)`: exactly the plain-key line of
  `read_settings` (`stored or default`, `int` for `INT_KEYS`) with one `SELECT`. It raises `KeyError` for a key outside
  `DEFAULTS` and for a key in the new `NORMALISED_KEYS` (every key `read_settings` answers through a normaliser, a JSON
  object or a derived value); those keep using `read_settings`. The call sites are converted later by
  `CR-SETTING-CALLERS` / `CR-TIMEUTIL` / `CR-JANITOR-REGISTRY` (wave 2), not here.
- **T1 (adopter)** - `GET /settings` now depends on `current_principal_ro` + `get_read_conn` (deferred, query-only), so it no
  longer queues behind the single write lock. Everything it calls only reads (`authorize`, `read_settings`,
  `search_allowed`, `_capacity_info`); a write would fail loudly on the read connection (`query_only`).

Only differences in the moved text (everything else is byte-identical, checked with `diff`):
- `read_settings` imports `routers.ui_background` at call time (it used the router module's top-level import), so
  importing `services.settings_store` loads no router and no FastAPI (checked: `sys.modules` has no `smplwise.routers.*`
  and no `fastapi` after `import smplwise.services.settings_store`). `ui_background.stored_stamps` itself is untouched
  (the file is not in this row).
- `_stored_favourites` imports `media_store` as `from . import media_store` (same module).
- The store imports only the services it uses (`home_config` was only named in a comment, `nvr_capacity` is router-only).
  The router keeps its own import lines unchanged, and keeps `get_settings_many` as a module attribute because
  `tests/test_perf_home_devices.py` patches it there.

## Files

- new `smplwise_vms/backend/smplwise/services/settings_store.py`
- `smplwise_vms/backend/smplwise/routers/settings.py` (registry removed, re-exports, `GET /settings` on the read connection)
- new `smplwise_vms/backend/tests/test_setting_value_parity.py`
- this note

## Tests

New `tests/test_setting_value_parity.py` (written first; it failed at collection before the move, as expected):
- the router's names are the store's objects (26 names);
- the store imports no router at module level;
- `setting_value == read_settings(...)[key]` (value and type) for every plain key, parametrised **stored / missing / empty**
  (more than 150 plain keys each);
- `NORMALISED_KEYS` is complete (a stored odd value that read_settings changes must be in the list) and every listed
  key is refused, as are the derived `doors.ui.tab`, `home.multi_building` and an unknown key;
- the bulk read equals the per-key read through the store's own `get_settings_many` seam (see "Known limits");
- `GET /settings` answers, with the same body, while another connection holds the write lock.

Runs (local Windows, `C:\cloude\smplwisebms\.venv` Python 3.12.10, from the worktree):

| Run | Result |
|---|---|
| baseline before the move: `test_settings_cards_accordion_2402`, `test_settings_intercom_cards_2401`, `test_settings_nav_pref`, `test_perf_home_devices`, `test_read_mode` | 20 passed |
| `test_setting_value_parity.py` after the move | 8 passed |
| touched area after the move (23 files, below) | 436 passed, 5 skipped, 1 failed (1:27:24 wall time on a loaded workstation) |
| the one failure, `test_read_mode.py::test_reads_do_not_wait_for_a_writer`, rerun alone | 1 passed |

The 23 files: the three `test_settings*.py`, `test_perf_home_devices`, `test_read_mode`, every other test module that imports
`routers.settings` (`test_asyncio_default_2342`, `test_body_limit`, `test_f3c_g03_295`, `test_remote_hardening`,
`test_restore_safety`, `test_site_location`, `test_startup_warmup_2421`, `test_tickets_module`, `test_tts_default_engine_2400`,
`test_ui_settings`, `test_ui_tabs_config`, `test_wall_phone_bar`, `test_wiskey_media_v11`, `test_wiskey_rc7_adopt_2331`,
`test_wkaudin_295`), and the suites that override the principal dependency around `/settings`
(`test_schedules_scope`, `test_schedules_followup`, `test_service_identity_extended`).

The failure was a timing bound: `GET /cameras` + `GET /health/summary` together took 9.0 s against the 8 s bound while a
writer held the lock; the workstation was saturated (that single test took 125 s alone on the rerun). It passed in the
baseline before the move and alone after it; this branch does not change either route (`/cameras` reads `read_settings`
on the read connection, as before). Recorded as a load flake, not a pass of the area run.

NOT_RUN locally: the full backend suite (about 115 test modules call `/api/v1/settings`); it runs in the lead's combined
wave-1 runner entry check. No runner, pixel or lab action was taken.

## Known limits / skipped

- `tests/test_perf_home_devices.py::test_read_settings_identical_to_the_per_key_read` patches
  `routers.settings.get_settings_many`; after the move `read_settings` reads through `services.settings_store`, so that patch
  no longer reaches it and the test compares the bulk read with itself (it still passes, but proves less). The file is
  outside this row; the same comparison now lives in `test_setting_value_parity.py` against the store's seam. Suggested
  follow-up (owner of that file): patch `settings_store.get_settings_many` instead.
- The write-lock test was not mutation-checked against the old `get_conn` dependency (local runs are slow); it relies on
  `get_conn` taking `BEGIN IMMEDIATE`.
- No caller was converted to `setting_value` (row: "no caller changes here").
