# CR-SINGLETON-RESETS-2460 - per-test resets for the module-level tables that had none

Branch `pilot/CR-SINGLETON-RESETS-2460`, based on `origin/pilot/CR-BE-COMPLEXITY-B-2450` (febb78d37). Target 2.46.0. Backend only
(services and one test list). Section 2 of docs/changes/CR-BE-COMPLEXITY-B-2450.md left "89 tables in modules with no reset function
yet"; this row adds the reset.

## What changed

- 83 names in 62 service modules (the "no reset function in the module yet" block of `tests/singletons_unregistered.txt`) now register a
  per-test reset with `smplwise.test_reset.register_reset` and leave the list. Of these, 51 modules had no reset: each gets a
  `_reset_for_tests()` placed at the end of the module that clears exactly its tables (`X.clear()`; for a counter dict, `clear()` then
  `update(<the literal it is defined with>)`, so it returns to the value of a fresh import). 11 modules already registered a reset for
  other tables (`camera_sources`, `ha_camera_streams`, `media_query`, `mobile_push`, `notify_sources`, `partner.webhooks`, `push`,
  `recorders.frigate_http`, `recorders.provision_playback`, `self_update`, `storage`): `register_reset` keeps one function per module, so
  each gets a `_reset_all_for_tests()` that calls the existing reset unchanged and then clears the remaining tables; the existing reset
  function is not edited (product code calls some of them).
- Nothing at run time changes: the only new call site is `register_reset(...)`, which stores the function; the test fixture calls it.
- Not touched, as briefed: routers, `db` lock / pool bookkeeping, auth / session / identity / RBAC, billing / electricity / water,
  `intercom_sync`, `wiskey_background_feed`, `wiskey_feed_session`, and the other recorded groups (start-up wiring, files other agents
  change). `tests/singletons_unregistered.txt` lists 182 names now (was 265; the 83 are this block).
- Thread dictionaries (`nvr_batch._live`, `nvr_verify._running`, `wiskey_live_validation._ACTIVE`, `intercom_media._LEASE_TIMERS`) are
  only emptied, never joined or cancelled: a reset must not start doing work.

## Commits (one per area)

1. alarm / automation / scenarios / door / building report / calendar_sync (11 modules)
2. autosync / go2rtc / cast / frigate / provision events / nvr / source_policy / thumbnails / playback_groups (14)
3. tickets (12)
4. intercom_media / media_commands / notices / transit / wall / wiskey / user_events / zone_counts / others (19)
5. the 11 modules that already had a reset
6. `media_query._NAMES` comment line

## Tests
Workstation (Python 3.12, the main checkout venv, `pytest -p no:xdist -p no:cacheprovider`, worktree at the head of this branch):

| Run | Result |
|---|---|
| `tests/test_singletons_registered.py` (4 tests), final state | **4 passed** |
| 28 files named after the changed modules (singleton inventory, alarm_managed_cache, automations_mirror, autosync, calendar_connect, cast_relay, door_automation, door_engine_live, frigate_control, frigate_events, go2rtc_owned_streams, intercom_media, media_commands, media_query, mobile_push, notify_sources, nvr_write, push, secrets_store, self_update, source_policy, storage, thumbnails, tickets_monitor, tickets_visits, wall, wiskey_join_live, camera_sources) | **878 passed, 0 failed** (1 h 01 min: the workstation was at 100 % CPU) |
| ruff check on `smplwise` | all checks passed |

NOT_RUN: the other roughly 350 test files that import the 62 modules (a 379-file run did not fit the loaded workstation; three
parallel shards produced no output in hours). No test needed a change: no test relied on leaked state in the files that ran.
Recommended: one full backend run on the runner when a gate slot is free.
