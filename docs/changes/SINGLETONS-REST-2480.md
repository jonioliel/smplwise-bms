# SINGLETONS-REST-2480 - per-test resets for the remaining module-level tables (groups 1-3 done)

Branch `pilot/SINGLETONS-REST-2480`, base `origin/release/2450-train` + merge of `origin/pilot/CR-SINGLETON-RESETS-2460` (1f9ba5c01). Target 2.48.0.

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

- Kept on purpose: energy_billing_adapter._SETTINGS, announcements/cast_sessions _DB/_SETTINGS, playback._INSTANCE, remote_channel modes (start-up wiring: a
  per-test reset would break app fixtures that outlive one test); bridge_keys._BOOT_HW and revocation._generation/_marks (replay / revocation bookkeeping,
  not caches); local_identity._pending, local_reset._senders (pending logins, sender threads); app_session.CACHE, local_identity.CACHE/TIERS (hold sockets to
  close and ended keys); all of smplwise.db (lock / pool bookkeeping).

## Open questions (recommendation)
1. Run the 36-file router set and the groups 2-3 areas on the runner when a slot is free (recommended: yes).