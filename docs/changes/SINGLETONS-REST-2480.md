# SINGLETONS-REST-2480 - per-test resets for the remaining module-level tables (groups 1-5 done)

Branch `pilot/SINGLETONS-REST-2480`, base `origin/release/2450-train` + merge of `origin/pilot/CR-SINGLETON-RESETS-2460` (1f9ba5c01). Target 2.48.0.
22.11: `origin/release/2470-train` (2c211966d) merged in (678f9e8e5); conflicts only in the imports of routers/generator.py and
routers/notifications.py (the row's `test_reset` import next to the train's `wire` imports, both kept). The train moved again (2.47.0 release
commits, 4d244a419) and was merged once more (4325b027c, no conflicts; backend: only the version in smplwise/__init__.py).

## Done: group 1 (routers), commit bfffdb3e5
- 17 router modules register a per-test reset (`register_reset`) for 23 names: access_control_command.RELAYS, alarm._PASS_THROUGH, calendar_feeds._RATE,
  cameras._CAPS_CACHE/_ZONES_CACHE, cases._integrity_last, devices._last_refresh, frames.MEMO/_flights, frigate._ASSET_SEMS, generator._DETECT_CALLS,
  ha._INFLIGHT, health._EVENTS_COUNT/_RENDERER, media.REGISTRY/_cap_audited, notifications.ACTION_FAILURES/ACTION_GLOBAL, readiness._last_check,
  water.CSV_LIMIT/MANUAL_LIMIT, wiskey_installer_clock.CHECKS and wiskey_installer_technical.REPORTS (their existing `reset()` is registered unchanged).
  The 23 names left `tests/singletons_unregistered.txt`. Nothing changes at run time; only the test fixture calls the reset.
- Kept in the list: routers.calendar_feeds._FILTER (a stateless log filter), routers.transit._REFRESH / _CHECK (a handle to a possibly running refresh thread
  and its debounce; clearing could allow a second thread).

## Tests (workstation, venv Python 3.12, `-p no:xdist`)
- `tests/test_singletons_registered.py`: 4 passed, `ruff check smplwise`: passed - both run on the first edit, BEFORE the import path fix (`..test_reset`); NOT re-run on the committed head.
- 36 router-area files (+ the singleton test): PARTIAL / NOT_RUN to completion. The run was stopped on the lead's order at about 139 of roughly 1200 tests: 139 passed, 0 failed.
  No test needed a change so far.

## Done: group 2 (billing / energy / water), commit 3e08a43ba
- Resets registered for 9 names: bill_pdf._STATUS (back to its literal), energy_billing._LAST_AUTO/_LAST_RETENTION, energy_sampler._LAST, energy_store._STORES,
  water_billing._LAST/_OVERRIDE and water_runtime._LAST (existing `reset()` registered unchanged), water_sampler._LAST. Pure clears, nothing changes at run time.

## Done: group 3 (auth / session caches), commit ec54504ea
- Resets registered for 9 names: auth._gate_wait_limiters, ha_user_auth._rejected/_core_base/_xff_refused/_REVOKED_TABLE, local_identity._flag,
  local_passwords._dummy/_lists, and rbac._CUSTOM_CACHE (cleared inside the existing `_reset_grants`, attrs extended). All 18 names left `singletons_unregistered.txt`.

## Tests (workstation, venv Python 3.12, `-p no:xdist -o addopts=`; the PC was saturated by other agents, so runs were slow)
- `ruff check smplwise`: passed on the group 3 head.
- `tests/test_singletons_registered.py`: 4 passed (261 s) on the group 2 head. Group 3 head: 4 passed (inside the group 3 run below).
- Group 2 targeted (test_bill_pdf, test_energy_store, test_energy_billing_engine, test_water_billing_s3, test_energy_billing_api, test_energy_bill_pdf_pipeline), run on a `git archive` copy of the group 2 head: 151 passed, 34 skipped, 2 errors. Both errors are test_bill_pdf::test_logo_refusals SETUP errors on Windows (`ValueError: the environment variable is longer than 32767 characters`, PYTEST_CURRENT_TEST with a huge parametrize id) - not caused by this change; not re-run on the base to confirm.
- Group 3 targeted (singleton test, test_rbac, test_rbac_groups, test_ha_users, test_local_identity, test_local_identity_units, test_authrevoke_2435, test_authorize_active_2438), `git archive` copy of the group 3 head: 203 passed, 2 failed with FileNotFoundError (test_rbac::test_contract_authorization_vectors, test_ha_users::test_263_the_add_on_option_is_gone read repo files outside backend/, missing in the archive copy); re-run in the real worktree: 2 passed.
- NOT_RUN: the 36 router files, the wider billing/energy/water/auth areas, the runner.

## Done: group 4 (WisKey write limits and reviews), commit dc28c8eb8
- wiskey_door_tech, wiskey_installer, wiskey_schedule_writes, wiskey_station_ops, wiskey_triage, wiskey_profiles and wiskey_access_diag register
  their existing module `reset()` unchanged (10 names: LIMITS x5, PREVIEWS, SEEN, HEALTH, REVIEWS, AUDIT_GATE). The tests already called them in
  their own fixtures.

## Done: group 5 (process-local caches, counters, limiters), commit dc28c8eb8
- New resets: alarm_codes.LOCKOUT (its existing `reset()`), bridge_keys.NONCES/REFUSALS (not `_BOOT_HW`), capture_lease.GUARDS (the three flags;
  not REG), access_service_writer.LAST (a fresh PathRecord; not the installed writer), live_codec.BUDGET, second_factor.FAILURES (the in-memory
  fallback), station_people.CACHE/PIN_BUDGET, tickets.dashboard.CACHE, events_cache.CACHE (entries + stats, not `enabled`), partner.core.USAGE
  (pending usage), tickets.public_log._LINES, exports.STATS, media_store.ARTWORK/QUEUE_CACHE.
- Extended resets: media_commands (+BUCKETS), ha_user_auth (+LIMITER, the sign-in hit windows, and +REFUSAL_AUDITS).
- 29 names left `singletons_unregistered.txt`.

## Constant objects (commit 487b10a49)
- notify_policy.BY_KEY, plan_ifc.STAR, semantic.LOCAL/EXTERNAL_TEMPLATE, tickets.public_store.NO_GRANT: counted by the class rule, never changed
  after import (grep) - moved to `singletons_constant_tables.txt` with their reason. The to-do list holds 107 names now (was 182 at the row's start).

## Still listed on purpose (after group 5)
- Threads, workers, pollers, servers and transports (WORKER, POLLER, RUNNER, SERVER, LISTENER, _TRANSPORT, the HA client pools): a reset would have
  to stop or replace a live object; their tests manage them.
- Registries with lifecycle: capture_lease.REG, intercom_* (BOOK, CAPTURES, MEDIA, LISTEN ...), wiskey_installer_lifecycle.FLOWS,
  media_store.INDEX (has a `loaded` flag the sync sets), events_ingest.EXTRA/_subscribers, tickets.keyring.KEYS.

## Tests 22.11 (PC, main checkout venv Python 3.12, `-p no:xdist -o addopts=`; the PC was at 100 % CPU from other agents throughout)
- `tests/test_singletons_registered.py`: 4 passed on the first merge (678f9e8e5) and 4 passed on 487b10a49 (groups 4-5 + constant list).
- `py -3.12 -m ruff check smplwise`: all checks passed on dc28c8eb8.
- Targeted, 48 files (every test file of the group 4-5 modules: the WisKey limits / station ops / profiles / triage / access diag / door tech /
  installer files, alarm, notify_sources, bridge key files, capture_lease files, live_h265, live_socket_caps, second_factor, events_cache,
  exports, media_commands, media_sync, media_review_fixes, tickets_mgrdash_*, tickets_public_server, partner_api_113, refusal_audit_throttle,
  block_counters_sec3, templink, ha_users, the singleton test), `-m "not timing_lane"`, on dc28c8eb8: 1646 passed, 2 skipped, 1 failed in 2 h 56 min.
  The failure, test_partner_api_113::test_sec217_global_failure_flood_never_locks_out_a_valid_token, asserts that 320 failed requests fill a
  60-second window (300 / minute); requests 301-320 still got 401, i.e. the 320 requests took longer than a minute on the loaded PC. The window is
  the per-instance `PartnerApp.limiter`, which no reset of this row touches. Re-run of the whole file alone on 487b10a49: 126 passed.
- Runner, full backend suite (4 niced shards, no xdist on the runner) on dc28c8eb8: STOPPED, not completed. It was ended when the 2.47.0 gate
  started (at about 10 %: 3144 passed, 0 failed, 0 errors so far); the lead then froze the runner, so the full run is NOT_RUN. Script for the re-run
  after the gate verdict: `private/planning/SINGLETONS-REST-2480_runner_be.sh <sha>` (records exact PIDs in ~/work/singrest-results/pids.txt).

- Kept on purpose: energy_billing_adapter._SETTINGS, announcements/cast_sessions _DB/_SETTINGS, playback._INSTANCE, remote_channel modes (start-up wiring: a
  per-test reset would break app fixtures that outlive one test); bridge_keys._BOOT_HW and revocation._generation/_marks (replay / revocation bookkeeping,
  not caches); local_identity._pending, local_reset._senders (pending logins, sender threads); app_session.CACHE, local_identity.CACHE/TIERS (hold sockets to
  close and ended keys); all of smplwise.db (lock / pool bookkeeping).

## Open questions (recommendation)
1. Run the full backend suite on the runner once the 2.47.0 gate verdict is in (recommended: yes, with the script above; it covers the 36 router
   files and the groups 2-5 areas that are NOT_RUN in full).
2. The partner flood test is wall-clock sensitive (320 requests inside 60 s); mark it `timing_lane` in a separate row (recommended: yes, not here).