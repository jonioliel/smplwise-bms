# CR-SINGLETON-RESETS-2460 - per-test resets for the module-level tables that had none

Branch `pilot/CR-SINGLETON-RESETS-2460`, based on `origin/pilot/CR-BE-COMPLEXITY-B-2450` (febb78d37). Target 2.46.0. Backend only
(services and one test list). Section 2 of docs/changes/CR-BE-COMPLEXITY-B-2450.md left "89 tables in modules with no reset function
yet"; this row adds the reset.

## What changed

- 83 names in 60 service modules (the "no reset function in the module yet" block of `tests/singletons_unregistered.txt`) now register a
  per-test reset with `smplwise.test_reset.register_reset` and leave the list. Of these, 49 modules had no reset: each gets a
  `_reset_for_tests()` placed at the end of the module that clears exactly its tables (`X.clear()`; for a counter dict, `clear()` then
  `update(<the literal it is defined with>)`, so it returns to the value of a fresh import). 11 modules already registered a reset for
  other tables (`camera_sources`, `ha_camera_streams`, `media_query`, `mobile_push`, `notify_sources`, `partner.webhooks`, `push`,
  `recorders.frigate_http`, `recorders.provision_playback`, `self_update`, `storage`): `register_reset` keeps one function per module, so
  each gets a `_reset_all_for_tests()` that calls the existing reset unchanged and then clears the remaining tables; the existing reset
  function is not edited (product code calls some of them).
- Nothing at run time changes: the only new call site is `register_reset(...)`, which stores the function; the test fixture calls it.
- Not touched, as briefed: routers, `db` lock / pool bookkeeping, auth / session / identity / RBAC, billing / electricity / water,
  `intercom_sync`, `wiskey_background_feed`, `wiskey_feed_session`, and the other recorded groups (start-up wiring, files other agents
  change). `tests/singletons_unregistered.txt` is 202 lines now (was 285 of which 83 were this block).
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

See the report of the run; numbers are filled in there.
