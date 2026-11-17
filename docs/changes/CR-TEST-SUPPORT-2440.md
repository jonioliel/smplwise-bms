# CR-TEST-SUPPORT-2440 - shared test helpers, one per-test reset, clock tests without sleeps

Branch `pilot/CR-TEST-SUPPORT-2440`, from `origin/pilot/CR-WAVE2-COMBINED-2439` at 97080bbc4. Code-review master plan
2026-11-13, section 3.4 (wave 3A), findings 05:P2-16, 05:P2-17, 05:P2-18. Independent of my other branches of this batch
(CR-READCONN-B-2440, CR-DOCS-REGISTERS-2440). Test code, plus small edits in ten production modules that only register a reset
function (nothing in production calls it). No version bump, no migration, no API or UI change.

## 05:P2-16 - `tests/support/`

New package `smplwise_vms/backend/tests/support/`, imported by name:

| File | Holds |
|---|---|
| `support/apps.py` | `make_client`, `warm_routes`, `as_user`, `seed_tree`, `enable_search`, `bind`, `png_bytes`, `pdf_bytes` (moved from `conftest.py`, bodies unchanged) |
| `support/waiting.py` | `wait_for`, `wait_until`; `sw_time_factor`, `sw_load_factor`, `sw_perf_enabled`; `DAY_ANCHOR`, `day_now`, `datetime_shim` (moved, bodies unchanged) |
| `support/audit.py` | `audit_rows(settings, action)`, `audit_details(settings, action)` |

`tests/conftest.py` keeps the environment switches, the pytest hooks and the fixtures (443 -> 187 lines). Every name test
files import from `conftest` is still importable from it (re-exported), so none of the about 400 importing files changed.

The `wait_for` owners:

- the 12 files with the identical body (`test_fake_wiskey`, `test_intercom`, `test_intercom_adapter`,
  `test_intercom_writes_s11`, `test_wiskey_access_diag`, `test_wiskey_door_tech`, `test_wiskey_installer_clock`,
  `test_wiskey_ops_views_2400`, `test_wiskey_profiles`, `test_wiskey_schedule_writes`, `test_wiskey_station_ops`,
  `test_wiskey_triage_2400`) import `support.waiting.wait_for`; the now unused `import time` left nine of them;
- `test_outage_run_t035.py` keeps a two-line `wait_for` with its own default (8 s) over the shared one;
- `tickets_public_fakes.py` re-exports `support.waiting.wait_until` (its body moved);
- left local, because the body differs: `test_wiskey_visits_2407.py` (`wait_for` on the monotonic clock, no feed state) and
  `test_offbox_api.py` (`_wait` returns the value, 100 ms step).

`test_intercom_media.py` takes `audit_rows` from `support.audit` (same body; `test_wkaudin_295.py` still imports it from
there). The other about 30 local audit readers differ in what they take (`app`, `w`, `db`, `env`) and stay - a follow-up
can move them family by family.

Not done here (the row's file list is `conftest.py`, the support files, the clock tests and the `wait_for` owners): the 937
`create_app(` call sites, the 30 local `client` / `app` fixtures and the other duplicated helper groups stay as they are.

## 05:P2-17 - one registry, one autouse fixture

New `smplwise_vms/backend/smplwise/test_reset.py`: `register_reset(module, attrs, reset)`, `reset_all()`, `registered()`. A
module that keeps process-wide state registers one function that puts it back; in production the call only stores the
function. `conftest.py` now has ONE autouse fixture, `_process_state_is_per_test`, that calls `reset_all()` before and after
every test, in place of the nine per-module autouse fixtures it carried. What those nine did is exactly what is registered:

| Module | Registered reset | Was in conftest as |
|---|---|---|
| `recorder_scope` | new `reset_for_tests()` (`DISABLED.clear()`, `WRITES.clear()`) | `_recorders_disabled_set_is_per_test` |
| `services/recorders/hikvision` | `clear_options_cache` | `_clear_stream_options_cache` |
| `services/bridge_discovery` | `reset_for_tests` | `_bridge_push_refusals_are_per_test` |
| `services/media_reach` | `REACH.reset` | `_media_reach_is_per_test` |
| `services/video_services` | `reset_for_tests` | `_media_reach_is_per_test` (second half) |
| `services/storage` | `invalidate` | `_storage_report_cache_is_per_test` |
| `services/ha_client` | `reset_refusals` | `_ha_token_refusals_are_per_test` |
| `services/intercom_sync` | new `reset_for_tests()` (the body of conftest's `_intercom_feed_idle`) | `_intercom_feed_state_is_per_test` |
| `services/ha_sync` | new `reset_link_for_tests()` (link flag + `disconnected_since` back to import-time values) | `_ha_sync_link_is_per_test` |
| `services/bridge_install` | new `reset_for_tests()` (`STATE` back to its import-time content, same object) | `_bridge_install_state_is_per_test` |

Behaviour of the suite is meant to be identical: the same resets, before and after each test. The 81 autouse fixtures inside
test files were NOT moved (a module-scoped fixture of some file may rely on its singleton surviving between that file's
tests; each family needs its own check). They are the to-do the new inventory records.

New `tests/test_singletons_registered.py` (2 tests):

1. every module-level singleton of the package - an object bound at module level whose class is defined in that same
   module, enum members / exceptions / tuples / frozen dataclasses / pydantic models left out - is registered or recorded
   in the new `tests/singletons_unregistered.txt`; a recorded name that is registered now or no longer exists fails
   (stale). 120 found on the base: 4 registered (`ha_sync.STATE`, `intercom_sync.STATE`, `intercom_sync.SYNC`,
   `media_reach.REACH`), 116 recorded;
2. every registered name exists in its module and `reset_all()` can run twice in a row.

## 05:P2-18 - clock tests

| Test | Was | Now |
|---|---|---|
| `test_intercom_media.py::test_a_reservation_never_attached_is_released_and_audited` | `RESERVE_S = 0.0`, `time.sleep(0.01)`, then production's strict `now - created_at > RESERVE_S` (the Windows clock steps 15.6 ms) | `RESERVE_S = -1.0`, no sleep |
| `test_wkaudin_295.py::test_a_reservation_never_attached_is_released_and_audited` | the same | the same |
| `test_read_mode.py::test_refusal_on_a_read_request_is_audited_and_touch_is_throttled` | two `time.sleep(1.1)` around the user-touch throttle | `auth.now_iso` patched to a later stamp: a rewrite inside the window would show; after the window the row holds exactly that stamp (assert tightened from `>=` to `==`) |
| `test_offbox_api.py::test_key_export_once_rotation_and_import` | `time.sleep(1.1)` so the second archive name differs | `backup.dt` patched with `datetime_shim` two seconds ahead |
| `test_offbox_restore.py::test_a_retried_restore_with_a_wrong_password_...` | `time.sleep(1.1)` | the same shim |
| `test_shared_spaces.py::test_history_and_camera_only_readers` | `time.sleep(1.1)` between `before` and the share | the share's stamp (`routers.zones.now_iso`) five seconds ahead for that one call |
| `test_wiskey_station_people_2390.py::test_a_station_lists_only_its_unmanaged_users_with_presence_never_values` | `time.sleep(1.1)` before the refresh | `station_people.now_iso` five seconds ahead for the re-read |

No production code changed for these. The 84 asserts that read a clock directly are not touched (not in the row).

## Tests

Run on the workstation on 2026-11-16 (Python 3.12, the repository venv, `pytest -p no:xdist`), on the branch as committed:

| Run | Result |
|---|---|
| the 21 touched test files (`test_singletons_registered`, `test_read_mode`, `test_offbox_api`, `test_offbox_restore`, `test_wkaudin_295`, `test_intercom_media`, `test_wiskey_station_people_2390`, `test_shared_spaces`, `test_fake_wiskey`, `test_intercom`, `test_intercom_adapter`, `test_intercom_writes_s11`, `test_outage_run_t035`, `test_wiskey_access_diag`, `test_wiskey_door_tech`, `test_wiskey_installer_clock`, `test_wiskey_ops_views_2400`, `test_wiskey_profiles`, `test_wiskey_schedule_writes`, `test_wiskey_station_ops`, `test_wiskey_triage_2400`) | 642 passed, 0 failed (57 min, the PC was shared with eleven other agents) |
| the seven changed clock tests, `--sw-repeat 50` | 350 passed, 0 failed |
| neighbours of the moved helpers and resets: `test_tickets_public_server`, `test_wa_template_send_w11` (import `wait_until` through `tickets_public_fakes`), `test_bridge_install`, `test_self_update`, `test_self_update_s3` (the leak the `bridge_install` reset was added for), `test_db_template`, `test_gate_always_run`, `test_build_guards_2438` | 229 passed, 2 failed - see below |

The two failures of the third run:

- `test_gate_always_run.py::test_every_package_scanner_is_listed_or_reviewed` named two files. `test_singletons_registered.py`
  is mine: it walks the package, so it is now listed under `backend` in `tests/gate_always_run.json` (it runs in every gate).
  Rerun: 18 passed, 1 failed - the remaining name, `test_active_user_rest_2438.py`, is a failure of the base (97080bbc4) that
  the newer tip of the base branch (4e52e5e4a) already fixes in the same file.
- `test_db_template.py::test_no_product_code_reads_the_schema_cookie`: a failure of the base too (it counts `PRAGMA
  schema_version` in `smplwise/db.py`, which this branch does not touch); 4e52e5e4a changes both that test and `db.py`.

Found when resuming (the previous account stopped mid-work): the code was complete and matched the row; what was missing was
this section, the commits and the `gate_always_run.json` entry above. Nothing was changed in the half-done work itself.

NOT_RUN: the full backend suite (the row's "the suite") - it belongs to the entry check of the combined branch; with the
conftest change every test file is affected, so that run is the real proof of "identical behaviour". Lint: `ruff check` over
the touched files reports only findings that are on the base as well (unused imports and fixture re-definitions in test files).

For the lead when merging up to 4e52e5e4a: `tests/gate_always_run.json` gains one line on each side (different places);
`tests/singletons_unregistered.txt` was recorded on 97080bbc4 - if the newer base adds or removes a module-level singleton,
`test_singletons_registered.py` names it and the list takes one line.

## Outside my rows

The ten production modules above gain a registration line (and four of them a small reset function that is the moved body
of a conftest fixture); the row announces this ("production gains no-op registrations"). `smplwise/test_reset.py` is new.
