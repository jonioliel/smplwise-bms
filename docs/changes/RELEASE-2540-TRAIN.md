# RELEASE-2540-TRAIN - the 2.54.0 train

Branch `release/2540-train`, worktree `C:\cloude\smplwise-2540train`, cut from `origin/main` = the `v2.53.0` tag = `3b4654f8b` (2.53.0
released 26.11). Coordinator: the train agent (merges, version bump, train checks, the UI rebuild). No release gate was started here (the
lead's), nothing was installed on the runner, no lab, no Home Assistant, no device, no WisKey contact. `main`, the tags and the `addon`
branch are untouched.

**The 2.54 gate engine is NOT installed.** GATE-TRUST-2540 (row 11) changes the gate engine in `scripts/gate` (`release_gate2.sh`,
`gate_release.sh`, `gate_entry.py`, `gate2_verdict.py`, `lint_backend.py`, `release_gate.py`, `gate_baselines.json`, `engine_sync.py`,
`selftest_gate.py`, the new `selftest_gate_trust.py`). `~/gate2`, `~/release_gate.py` and `~/nightly_tests.sh` were not touched. **The lead
installs it before the 2.54 gate** on an idle runner, with the steps in `docs/changes/GATE-TRUST-2540.md` ("Install on the runner"),
`origin/release/2540-train` as the source; once installed, the strict engine check refuses a gate of a branch without this engine unless
`--engine-drift-ok "<reason>"`. The engine's self-tests pass from the tree (section 3).

## 1. Merge log

Every row merged with `--no-ff` in the lead's order; each merge commit names the row head. `git log --all --grep` was checked for every
row first: none was merged anywhere else (the only hits were the rows' own internal merges and a mention in the 2.53 registry commit).

| # | row | head | merge commit | base | conflicts | notes |
|---|---|---|---|---|---|---|
| 1 | `pilot/HONEST-STATES-2540` | `3e73e2d00` | `98c52bfb4` | `aeb05ad3d` | none | frontend only |
| 2 | `pilot/CONTROLLED-TOGGLES-2540` | `feb6b19e0` | `7261730f2` | row 1 (`df8285ae8`) | none | Q1 = a, Q2 = a |
| 3 | `pilot/AREA-HONEST-COUNT-2540` | `ea3f03567` | `9f3d1670c` | row 1 | none | `DeviceCounts.locks_unknown` / `alarms_unknown` (additive); `wire-devices.ts` regenerated in the row |
| 4 | `pilot/PHYSICAL-CONFIRM-2540` | `465360eb4` | `a56d90414` | `aeb05ad3d` | none | frontend only; Q1-Q3 = a |
| 5 | `pilot/CAST-RELAY-HARDEN-2540` | `1ac7534d3` | `d71faa640` | `aeb05ad3d` | none | `wire/cast.py` `expires_at` nullable, `wire-cast.ts` regenerated in the row |
| 6 | `pilot/LISTENER-DEADLINE-2540` | `9829bb121` | `b70544b83` | row 5 + row 4 | none | contains rows 4 and 5 (checked: both heads are ancestors); only its own commits come in |
| 7 | `pilot/CORE-RELIABILITY-2540` | `abfd96a73` | `170191750` | `aeb05ad3d` | none | `services/backup.py` merged cleanly with the 2.53 train's `SETTINGS_KEEP` line |
| 8 | `pilot/STALE-ANSWERS-2540` | `14116a86a` | `e96a8666f` | `aeb05ad3d` | none | `devices-bulk.ts` (row 3), `investigate-playback.ts` merged cleanly; `client_request_id` additive |
| 9 | `pilot/TIME-CORRECT-2540` | `6ff195ab0` | `1b1341b59` | `aeb05ad3d` | `msg/home.ts` (en) | see below |
| 10 | `pilot/CLIENT-RESILIENCE-2540` | `397ca3484` | `f9b650a16` | `aeb05ad3d` | `api/client.ts` | see below |
| 11 | `pilot/GATE-TRUST-2540` | `181f673ef` | `f1fc6b088` | `aeb05ad3d` | none | engine NOT installed (above); `engine_sync.py`, `INSTALL_ON_RUNNER.md` merged cleanly with TEST-STABILITY-2530 |
| 12 | `pilot/HOME-SCROLL-3-2530` | `2bf0b098b` | `557859a3c` | `8ae83adfa` (2.53 train) | none | moved from 2.53 by the lead; `devices-building.ts` merged cleanly with row 3 |
| 13 | `chore/LAB-2540-RUNBOOKS` | `bb23c8fcc` | `6ba8c359b` | `91de5c377` | none | docs only (three Hebrew plans); checked: no host address, serial or credential (loopback / 0.0.0.0 only) |
| - | version bump | - | `174ff0469` | - | - | section 1.1 |
| - | train fix | - | `4c71dfbea` | - | - | section 2 |
| - | registry | - | `1ff111f25` | - | - | section 4 |
| 14 | `pilot/DST-TIMELINE-2540` | `02b2077e6` | `7eef2eb42` | row 9 + row 8 (`0d603c935`) | none | added by the lead after rows 8 and 9 were merged, so it was merged AFTER them (not instead of them); contains rows 8 and 9 - only its own three commits come in. Q1 = a |
| - | train fix | - | `8eafe5ac7` | - | - | section 2 |
| - | registry | - | `7524b85de` | - | - | section 4 |
| - | UI rebuild | - | `26e5d9030` | - | - | section 3.4 (the first build stamp; superseded by `bdae0aaaa`) |
| 15 | `pilot/HOME-SPEC-STABLE-2540` | `4f540f2b9` | `cf6fcae70` | row 12 (`2bf0b098b`) | none | merged AFTER row 12 (row 12 was already on the train); only its own four commits; the developer-only `POST /ha/dev/states` push after its commit; Q1-Q3 = a |
| 16 | `pilot/DATA-RULES-2540` | `878caeaa7` | `8a1e5e67b` | `aeb05ad3d` | `contracts/API_INVENTORY.md` | see below; `error_text_en.json`, `error_text_tpl_en.json`, `notify_policy*.py` merged cleanly (both JSON files load); billing golden refreshed in the row on purpose; Q1-Q4 = a |
| 17 | `pilot/MEDIUM-REST-2540` | `35332dd3a` | `edc766955` | row 1 (`3e73e2d00`) | `msg/home.ts` (en) | merged after rows 1, 4 and 6 as asked; only its own three commits; `explore-floor-map.ts`, `live-camera.ts`, `sw-home.ts`, the walls merged cleanly; Q1-Q3 = a |
| - | train fix | - | `d9e953b66` | - | - | section 2 (the generator alert drawer, lead's request) |
| - | train fix | - | `2fc1743b7` | - | - | section 2 (settle lint) |
| - | registry | - | `97f857e4f` | - | - | section 4 |
| - | train fix | - | `7e2c937aa` | - | - | section 2 (en.ts string) |
| - | UI rebuild | - | `bdae0aaaa` | - | - | section 3.4 (the shipped bundle of the train head) |

Conflicts:
- Row 9: `frontend/src/i18n/lang/en/i18n/msg/home.ts` - HONEST-STATES-2540's English block and TIME-CORRECT-2540's (SCR-34) were both
  appended at the end of the map; both kept, HEAD first; no duplicate key in the file (checked).
- Row 10: `frontend/src/api/client.ts` `fetchApi` - TIME-CORRECT-2540 (SCR-13) wrapped the fetch in `go()` to feed every answer's `Date`
  header to `server-clock.ts`; CLIENT-RESILIENCE-2540 replaced `go()` by `attempt()` (per-attempt deadline, the 401 `'unreachable'`
  outcome, the step-up replay window). Resolved: CLIENT-RESILIENCE's `attempt()` / `pause()` / `replayAllowed()`, and inside `attempt()`
  the `Date` header is noted after a fetch that answered (`sentAt` taken before the fetch; a thrown fetch teaches nothing), the response
  named `r` because `unit-time-correct-2540` pins the source text `noteDateHeader(r.headers.get('date')`. PC: `unit-time-correct-2540`
  9 passed, `unit-client-resilience-2540` 14 passed on the merged file.
- Row 16: `contracts/API_INVENTORY.md` (the train's version line 2.54.0 against the row's new `DELETE /generator/alerts/{alert_id}/mute`
  line) - regenerated with `scripts/api_inventory.py`: version 2.54.0, 1958 -> 1959 routes.
- Row 17: `frontend/src/i18n/lang/en/i18n/msg/home.ts` - TIME-CORRECT-2540's (SCR-34) English block and MEDIUM-REST-2540's (SCR-31) both
  appended at the end; both kept, HEAD first, no duplicate key.

No migration in any 2.54 row (the last stays 0226). Bridge unchanged (0.10.9).

All 2.54 rows are merged (the lead: no more rows). Row 14 (DST-TIMELINE-2540) was added by the lead after rows 8 and 9 were merged, so it
was merged after them (it contains both); rows 15-17 likewise after the rows they build on.

### 1.1 Version bump `174ff0469`

`smplwise_vms/config.yaml`, the `io.hass.version` label in `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` ->
`2.54.0` (the places the 2.53 train set); `contracts/API_INVENTORY.md` regenerated with `scripts/api_inventory.py` (version line 2.54.0;
1958 routes then; DATA-RULES-2540 made it 1959). CHANGELOG: a 2.54.0 section at the top, **DRAFT** - the mark is in the section's
comment, not the heading, as on the 2.52 / 2.53 trains (`release_check.changelog_head()` skips a heading marked DRAFT). Draft lines for
rows 1-17 and the fixes (`174ff0469`, `7524b85de`, `97f857e4f`), bilingual per line. `frontend/package.json` keeps `0.1.0` (never bumped by a train); the demo
version in `system-diagnostics.ts` is a demo constant (not bumped by trains either).

## 2. Train fixes

| commit | what | found by |
|---|---|---|
| `4c71dfbea` | `export` dropped from two file-local types: `PhysicalOutcome` (`api/physical-outcome.ts`, row 4) and `ClockSource` (`api/server-clock.ts`, row 9) | PC `unused-exports.mjs --enforce` (2 new) |
| `8eafe5ac7` | `export` dropped from DST-TIMELINE-2540's `HourKind`, `hourKind`, `AxisHour` (`calendars/model.ts`, used only inside the file) | PC `unused-exports.mjs --enforce` (3 new) after row 14 |
| (merge `f9b650a16`) | the `client.ts` conflict resolution above | merge |
| `d9e953b66` | **generator alert drawer and DATA-RULES-2540's mute rules** (lead's request; kept on the train, not a separate row - see open point 6 of section 5): a critical alert's mute refused (403, no `generator.manage`) now says why in the drawer ("ההתראה לא הושתקה: השתקה של התראה קריטית דורשת הרשאת ניהול גנרטור.") instead of the generic refusal line; a mute the server shortened (critical, 4 h cap) names its real end; "ביטול ההשתקה" on a running mute -> `DELETE /generator/alerts/{id}/mute` (`api/generator.ts` `unmuteAlert`) only after its own confirmation, focus on cancel (the shared `confirmDialog` `focusCancel` of PHYSICAL-CONFIRM-2540), then the alert is read again. Hebrew in `he.ts`, English in `en.ts`. Test `evidence-gen-mute-2540.spec.ts` (3 cases; `generator-mocks.ts` `muteRules`, opt-in, the other generator specs unchanged). Note: PHYSICAL-CONFIRM-2540 did NOT change `gen-alerts-page.ts` (no 2.54 commit in its log) - the confirmation is the shared dialog it extended | lead |
| `2fc1743b7` | `evidence-dst-timeline-2540` (row 14): `settle(page)` after the duration click before the bar's box is read (lines 103 / 120) | the gate's settle lint `lint_spec_waits.py --new-since 3b4654f8b`: 2 findings (run B) -> 0 in 33 files |
| `7e2c937aa` | `d9e953b66` left an unescaped apostrophe in an English string of `en.ts` (TS1005 / TS1002); reworded | the runner's `build:addon` at `97f857e4f` (rc 2, nothing committed from it) |

## 3. Checks

PC (one small process at a time): `gen_wire_types.py --check` 0; `error_contract_inventory.py --check` 0 (0 legacy 422 sites);
`i18n_backend_errors.py` 0 (0 without English, 0 run-time); `scripts/gate/lint_spec_waits.py --new-since 3b4654f8b` 0 findings in 24 files;
`api_inventory.py` 1958 routes; `release_check.py` - one version everywhere 2.54.0, CHANGELOG head 2.54.0, design ratchet holds; FAIL only
on the shipped UI bundle (2.53.0 build, no `build-stamp.json` yet) and the missing v2.54.0 tag (expected before the rebuild);
`unused-exports.mjs --enforce` OK after `4c71dfbea` and after `8eafe5ac7`; Node unit `unit-time-correct-2540` 9 passed,
`unit-client-resilience-2540` 14 passed, `unit-dst-timeline-2540` 8 passed.

### 3.1 Runner run A at `4c71dfbea` (rows 1-13 + version bump + first fix; `~/work/p2520_t2540_a.sh`, slot B, results `~/work/p2540a-out`)

| check | exit | result |
|---|---|---|
| `lint_spec_waits.py --new-since 3b4654f8b` | 0 | 0 findings in 24 files |
| `gen_wire_types --check` / `sync_integration --check` / `wire_ratchet` / `request_strict_ratchet --check` / `error_contract_inventory --check` | 0 each | match / up to date / 897 = baseline / 144 / 0 legacy 422 sites |
| `i18n_backend_errors` / `lint_backend --strict` / `design_ratchet` / `build_guide --check` / `ruff check smplwise` | 0 each | 0 without English, 0 run-time / 0 findings / no count above the baseline / up to date / clean |
| `release_check.py` | 1 | the UI bundle (2.53.0 build, no stamp) + the tag only (expected before the rebuild) |
| gate self-tests from the tree (no gate running; nothing installed): `selftest_gate`, `selftest_engine_sync`, `selftest_gate_fast`, `selftest_gate_trust` | 0 x 4 | SELFTEST PASSED x 4 |
| `node --test scripts/build-stamp.test.mjs` | 0 | pass |
| **the 2.53 gate's failed guard files**, one process each: `test_gate_speed` / `test_secfix_restore_settings_2520` / `test_t06_admission_295` / `test_build_guards_2438` | 0 x 4 | **19 / 21 / 64 passed + 3 xfailed / 11 passed** |
| the rows' new backend files, one process each: `test_area_honest_count_2540` 32, `test_cast_relay_harden_2540` 7, `test_cast_access_lost_2540` 8, `test_nvr_undo_changed_since_2540` 5, `test_listener_deadline_2540` 8, `test_nvr_forced_undo_record_2540` 2, `test_core_reliability_2540_sync` 5 / `_backup` 4 / `_bearer` 4 / `_app_factor` 12, `test_home_ticket_note_idem_2540` 3, `test_calendar_far_series_2540` 5, `test_client_resilience_2540` 1, `test_release_build_stamp_2540` 10, `test_version` 1 | 0 each | **107 passed** |
| neighbours, one process each: `test_cast_relay` 40, `test_cast_sessions` 35, `test_janitor` 12, `test_notice_caps_295` 12, `test_notices_security_295` 59, `test_provision_push_addon` 13, `test_nvr_write` 5, `test_backend_safety_2435` 10, `test_video_secfix_2520` 10, `test_backup` 8, `test_backup_sensitive` 32, `test_restore_safety` 11, `test_secfix_daily_backup_2520` 6, `test_remote_access` 66, `test_second_factor` 23, `test_app_session_295` 53, `test_mfa_devicekey_2490` 19, `test_session_cache_2438` 23, `test_home_v3_p2` 42, `test_i18n_errors_en_2520` 9, `test_error_envelope_family678_2520` 14, `test_singletons_registered` 4, `test_wire_ratchet_2480` 7, `test_wire_route_coverage_2460` 5, `test_routers_table_2440` 10, `test_gate_always_run` 19, `test_fixture_job` 16, `test_gate2_select` 17, `test_async_routes_hold_no_write_conn` 3 | 0 each | **584 passed** |
| `test_release_check` / `test_release_bundle_version_2520` | 1 / 1 | 1 failed + 2 passed / 1 failed + 5 passed - the UI bundle before the rebuild (green after it: run B and the PC) |
| `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` | 0 each | 0 / 0 errors; clean; built |
| `unused-exports --enforce` / bundle budget / lazy tags / api-client-check / i18n-split `--dry` | 0 each | no export outside the baseline / OK / OK / OK / OK |
| Node unit suite (2 workers) | 1 | **5427 passed, 3 failed**, 17 skipped - the 3 = `unit-mfa-passkeys-2490` (page tests with no server in a node-only run; the known harness, same as every train) |
| evidence, the 8 new specs (honest-states, controlled-toggles, area-honest-count, physical-confirm, nvr-undo-force, stale-answers, time-correct, client-resilience) desktop + mobile | 0 | **82 passed**, 40 skipped (their own project skips) |
| regression: incoming-call, confirm-dialog-2438, multi-nvr, area-row, automations-builder, unit-step-up-ui, unit-session-me-failure-2435, desktop + mobile | 0 | **121 passed**, 71 skipped |
| pixel: the 5 new pixel specs + `pixel-incoming-call` + `pixel-onboarding-2530`, with the gate's `--grep pixel-stable`, `--workers=1` | 0 | **43 passed**, 5 skipped (no "No tests found") |
| the same pixel specs without `--grep` | 0 | 53 passed, 5 skipped; no baseline file changed |
| `fixture_job.py evidence-home-screen --no-build` (desktop + mobile, the gate's fixture lane) | 0 | **25 passed, 0 unexpected, 0 flaky** |

### 3.2 Runner run B at `26e5d9030` (row 14, fix `8eafe5ac7`, the first UI rebuild; `~/work/p2520_t2540_b.sh`, results `~/work/p2540b-out`)

| check | exit | result |
|---|---|---|
| `lint_spec_waits.py --new-since 3b4654f8b` | **1** | **2 findings** in 27 files - `evidence-dst-timeline-2540.spec.ts` lines 103 / 120 -> `2fc1743b7` (PC re-run: 0 in 33 files) |
| generators / ratchets (as run A) | 0 each | as run A |
| `release_check.py` | 0 | **ready for the owner's approval** (both bundle rows ok; only the tag missing) |
| `test_release_check` 3, `test_release_bundle_version_2520` 6, `test_release_build_stamp_2540` 10, `test_build_guards_2438` 11, `test_version` 1 | 0 each | all passed |
| `tsc` / typecheck / lint / build / unused-exports / bundle budget / lazy tags / api-client / i18n-split | 0 each | 0 errors / clean / built / OK |
| Node unit suite | 1 | 5435 passed, 3 failed (`unit-mfa-passkeys-2490` x3, the known harness), 17 skipped |
| evidence dst-timeline + time-correct + stale-answers, desktop + mobile | 0 | 29 passed, 25 skipped |
| pixel dst-timeline + time-correct + round4-leftovers, `--grep pixel-stable` | 0 | 34 passed, 14 skipped; no baseline changed |

PC after rows 15-17: `gen_wire_types --check` 0, `i18n_backend_errors` 0 (0 without English; 2317 constant texts), `error_contract_inventory
--check` 0, `unused-exports --enforce` OK, `design_ratchet` holds, `lint_spec_waits` 0 findings in 33 files; `api_inventory.py` 1959
routes; TypeScript transpile of the six files of the generator fix: 0 diagnostics; `test_release_check` 3, `test_release_bundle_version_2520`
6, `test_release_build_stamp_2540` 9 passed + 1 skipped (after the first rebuild).

### 3.3 Runner run C at `7e2c937aa` (all 17 rows and the train fixes; `~/work/p2520_t2540_c.sh 7e2c937aa edc766955`, results `~/work/p2540c-out`)

| check | exit | result |
|---|---|---|
| **before** the generator drawer fix: `edc766955` built with the new `evidence-gen-mute-2540.spec.ts` + `generator-mocks.ts` copied in, desktop | 1 | **3 failed** (the refusal shows the generic line, no shortened-end line, no un-mute; the second case - a plain mute still works - fails there only on the new `data-muted` marker) |
| **after**: `evidence-gen-mute-2540` desktop + mobile | 0 | **6 passed** |
| `lint_spec_waits.py --new-since 3b4654f8b` | 0 | 0 findings in 33 files |
| generators / ratchets + `ruff check smplwise` | 0 each | wire match; mirror up to date; 897 = baseline; 144; 0 legacy 422 sites; 0 without English, 0 run-time (2317 constant texts); 0 lint findings; no count above the design baseline; guide up to date; clean |
| `release_check.py` | 1 | expected at this commit: the stamp row FAILS because `www` was still the `26e5d9030` build (stamp `9ab35df02da1` over 2126 files) while the sources had moved on - the new TR-04 check catching a stale bundle; rebuilt in `bdae0aaaa` right after (section 3.4), where it is ok |
| gate self-tests from the tree (nothing installed) | 0 x 4 | SELFTEST PASSED x 4 (`selftest_gate`, `selftest_engine_sync`, `selftest_gate_fast`, `selftest_gate_trust`) |
| **the 2.53 gate's failed guard files**: `test_gate_speed` / `test_secfix_restore_settings_2520` / `test_t06_admission_295` / `test_build_guards_2438` | 0 x 4 | **19 / 21 / 64 + 3 xfailed / 11 passed** |
| rows 15-16 backend, one process each: `test_dev_states_push_order_2540` 2, `test_ha` 5, `test_devices` 64, `test_data_rules_generator_2540` 9, `test_data_rules_billing_2540` 5, `test_data_rules_water_2540` 4, `test_bill_ledger_lifecycle_b` 25 (the refreshed golden), `test_bill_ledger_cross_kind` 11, `test_generator` 49, `test_energy_billing_api` 37, `test_water_billing_s3` 20, `test_notify_sources` 37, `test_notify_core` 27, `test_notify_recipient_lang_2520` 13 | 0 each | **308 passed** |
| guards, one process each: `test_i18n_errors_en_2520` 9, `test_error_envelope_family678_2520` 14, `test_singletons_registered` 4, `test_wire_ratchet_2480` 7, `test_wire_route_coverage_2460` 5, `test_routers_table_2440` 10, `test_gate_always_run` 19, `test_release_bundle_version_2520` 6, `test_release_build_stamp_2540` 10, `test_version` 1 | 0 each | 85 passed |
| `test_release_check` | 1 | 1 failed / 2 passed - the same stale-bundle row as `release_check.py` above; PC at `bdae0aaaa`: 3 passed (`test_release_bundle_version_2520` 6, `test_release_build_stamp_2540` 9 + 1 skipped) |
| `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` | 0 each | 0 / 0 errors; clean; built |
| `unused-exports --enforce` / bundle budget / lazy tags / api-client-check / i18n-split `--dry` | 0 each | no export outside the baseline / OK / OK / OK / OK |
| Node unit suite | 1 | **5460 passed, 3 failed** (`unit-mfa-passkeys-2490` x3, the known node-only harness), 17 skipped |
| evidence: generator, medium-rest-2540, honest-states-2540, physical-confirm-2540, nvr-undo-force-2540, client-resilience-2540, kiosk-polish, wall-answers-2400, nvr-encoding-batch, home-simple-2420, home-v3-p1, desktop + mobile | 0 | **138 passed**, 82 skipped |
| pixel: medium-rest-2540, honest-states-2540, wall-followups-2390, wall-plan, dst-timeline-2540, `--grep pixel-stable` | 0 | **31 passed**, 19 skipped; no baseline changed |
| `fixture_job.py evidence-home-screen --no-build` (with HOME-SPEC-STABLE-2540), twice | 0 / 0 | **25 passed, 0 unexpected, 0 flaky** each time |

### 3.4 The shipped UI (the 2.53 way, plus the build stamp)

`npm run build:addon` on the runner (`~/work/p2520_t2540_buildui.sh <sha>`: a detached worktree, the main checkout's `node_modules` linked,
`tar` of `www` / `www-public`, copied to the PC as base64, sha256 verified, both directories emptied and the archive extracted):
- `26e5d9030` = the build of `7524b85de` (rows 1-14): arx-shell-2.54.0, 0 maps, stamp 2126 files `9ab35df02da1...`.
- **`bdae0aaaa` = the build of `7e2c937aa` (all 17 rows and the train fixes; the shipped bundle now)**: rc 0; arx-shell-2.54.0; 0 `.map`
  files and 0 `sourceMappingURL` (maps archived under `~/smplwise-results/sourcemaps/2.54.0`); public chunk largest public-ticket 60.23 kB;
  **`www/build-stamp.json` written by GATE-TRUST-2540's last build step**: version 2.54.0, 2129 input files, inputs_sha256
  `09170a85a9e5...`, source_commit `7e2c937aa`; archive sha256 `e4ae43ca...a0fc`. `release_check.py` on the PC (the digest recomputed on
  this Windows checkout - CRLF-normalised, so it matches the Linux build): every check ok except the v2.54.0 tag -> "ready for the owner's
  approval".
- One build at `97f857e4f` stopped on `tsc` (the `en.ts` string, `7e2c937aa`); nothing of it was committed.

## 4. Registry

`management/tasks.json`: cards for the 2.54 rows (HONEST-STATES, CONTROLLED-TOGGLES, AREA-HONEST-COUNT, PHYSICAL-CONFIRM, CAST-RELAY-HARDEN,
LISTENER-DEADLINE, CORE-RELIABILITY, STALE-ANSWERS, TIME-CORRECT, CLIENT-RESILIENCE, GATE-TRUST, DST-TIMELINE, HOME-SPEC-STABLE, DATA-RULES,
MEDIUM-REST, all -2540, HOME-SCROLL-3-2530, LAB-2540-RUNBOOKS) as REVIEW with the row head and the merge commit (R-<id>-1 PLANNED, AT-<id>-1
NOT_RUN); RELEASE-2540-TRAIN IN_PROGRESS with evidence lines (`1ff111f25`, `7524b85de`, `97f857e4f`). `py -3.12 scripts/project_status.py
--write`: PASS (745 tasks, 859 requirements).

## 5. Open points

1. **The 2.54 gate engine** (GATE-TRUST-2540) - the lead installs it before the 2.54 gate (top of this note). Until then the installed
   engine is the 2.53 one and `engine_sync.py check --ref origin/release/2540-train` reports drift.
2. **The build stamp**: from 2.54.0 `release_check.py` FAILS without a matching `www/build-stamp.json`. The bundle at `bdae0aaaa` matches the
   sources of the head. ANY later change under `frontend/src`, `frontend/public`, the entry pages, the Vite configs, `package*.json` or
   `tsconfig.json` (a gate fix included) needs a new `npm run build:addon` before the release commit, or the gate's release_check fails.
3. **evidence-home-screen in the gate**: green in run A (25 / 0 / 0 at `4c71dfbea`, before HOME-SPEC-STABLE-2540) and in run C (section 3.3).
   HOME-SPEC-STABLE-2540's open questions 1-2 (a ResizeObserver on the page area; the settings direction picker, 1 failure in 32 loaded
   whole-file runs, cause unknown) are follow-up rows by the owner rule (a).
4. **Design ratchet** says `px-literal` can be lowered (25512 against its baseline); left for the release step (`--update` only lowers).
5. The rows' open questions: all answered by the owner's standing rule (unanswered = the recommendation, "a" everywhere), as listed in
   the merge commits; DATA-RULES-2540 Q1-Q4 = a by the lead.
6. **The generator alert drawer fix (`d9e953b66`)** was made on the train as the lead asked. a) keep it on the train (recommended: small,
   tested before / after, and DATA-RULES-2540's server rule ships in the same release) b) move it to a separate row. The battery-system
   control (DATA-RULES-2540 Q2) and the account continuity note (Q3) stay later rows.

7. **The one-frame scroll after a building switch** (found for gate failure B, present since before 2.54): a new fit key restarts the
   packing from its loosest step, so for one or two frames (~40 ms) the page area is 5-9 px too tall before it settles. a) a small
   follow-up row: start a changed key's packing from the previous step when the page still fits there, measured the same way
   (recommended - invisible today, but the cause of every "read once after a switch" test failure) b) leave it.

NOT_RUN on the train: the release gate (the lead's), the full backend suite in one sweep (the touched areas only, section 3), the full
Playwright suites beyond the specs named, tablet, every lab / Home Assistant / device / WisKey check.

## 6. Gate run 1 (`f9217db8a`, the lead's): FAIL, 192 min, 0 hard failures, 9 test failures, 8 flaky

The new engine's lint lane on the gate's worktree: 0 findings. Summary `~/smplwise-results/gate_release-2540-train_f9217db8a.gate2.md`.
Two root causes, each found by measurement on the runner and bisected over the train's merges (`~/work/p2520_t2540_bisect.sh`, results
`~/work/p2540x-out`: a preview build per commit, the gate's two failing tests on tablet, plus a diagnostic spec that is never committed):

| commit | layout-worstcase tablet (classic + domus light worst) | multibuilding shared tablet x3 |
|---|---|---|
| `3b4654f8b` (v2.53.0) | 2 passed | 3 passed |
| `f1fc6b088` (rows 1-11) | 2 passed | 1 failed, 2 passed (Received 2) |
| `557859a3c` (+ row 12, HOME-SCROLL-3-2530) | **2 failed** (86 px in 81 px) | 3 passed |
| `cf6fcae70` / `8a1e5e67b` / `edc766955` / `f9217db8a` | 2 failed each | 3 passed / 3 passed / 1 failed / 3 passed |

| # | failure | root cause | fix |
|---|---|---|---|
| A | [preview] `layout-worstcase-screens-297.spec.ts:55` [tablet] x 8 (4 themes x worst / huge): "clipped div.al-t content 86px wider than box 81px (79px in domus)" | **HOME-SCROLL-3-2530** (row 12; first failing merge `557859a3c`). Measured with the worst data at 1024x768: the cards info style reaches fit 2 and squeezes (`data-squeeze`, layout hero); the squeezed band gives the medium alarm card four fifths of its basis (164 px) and the state "דרוכה (חוץ)" at 18 px is 86 px wide in its 81 px text box (`.al-s` `white-space: nowrap`). Not AREA-HONEST-COUNT-2540's grey label (it is in the area rows, not this card) | **product** `9c5fc334c`: `.al-s` stays on one line and ends in an ellipsis inside the card (`min-inline-size: 0`, `overflow: hidden`, `text-overflow: ellipsis`), the full state is the element's `title`; a state that fits looks as before. A wrapping variant was tried first and rejected: the card grew and the shared building's page scrolled (multibuilding 2 of 10 failed) |
| B | [preview] `evidence-multibuilding-home-2330.spec.ts:124` [tablet] "the shared building opens ..." `toBeLessThanOrEqual(1)` (also alone) | **not a 2.54 row** - present at v2.53.0. A per-frame trace of the page area after the building switch (8 repeats per commit): a new building is a new fit key, so the packing restarts from its loosest step and settles one or two frames after the crumb changed (`f9217db8a`: crumb "משותף" at 204 ms, fit 0 and 5 px over at 241 ms, fit 1 and 0 px at 280 ms; `3b4654f8b`: crumb at ~130 ms, 9 px over, 0 px a frame later; 8 of 8 repeats on each commit show the one frame). The test read the overflow once, right after the crumb: 1 of 10 at `3b4654f8b`, 1 of 10 at `f9217db8a` (tablet, `--repeat-each=10`); the gate's re-run alone met the same frame | **test** `7accbe97d`: the check is polled for 3 s, as the building test above it in the same file already is (DOMUS-DEFAULT-2439) |

Proof (runner, `~/work/p2520_t2540_fix.sh`, results `~/work/p2540y-out`):

| run | base `f9217db8a` | with the fix |
|---|---|---|
| `layout-worstcase-screens-297` tablet, all 16 cases | **8 failed**, 13 passed | **21 passed** |
| `evidence-multibuilding-home-2330` "the shared building" tablet `--repeat-each=10` | 1 failed, 9 passed (`3b4654f8b`: 1 failed, 9 passed) | **10 passed** |

The 8 flaky ones (failed once, passed alone) were not chased.

### 6.1 Run D at `7accbe97d` (the two fixes; `~/work/p2520_t2540_d.sh`, results `~/work/p2540d-out`)

| check | exit | result |
|---|---|---|
| `lint_spec_waits.py --new-since 3b4654f8b` / `design_ratchet` | 0 / 0 | 0 findings in 33 files / no count above the baseline |
| `tsc` app / typecheck / lint / build / `unused-exports --enforce` / bundle budget / lazy tags | 0 each | 0 / 0 errors; clean; built; no export outside the baseline; OK; OK |
| `layout-worstcase-screens-297` desktop + tablet + mobile | 0 | **63 passed** |
| `evidence-multibuilding-home-2330` all projects | 0 | **21 passed** |
| the shared building test, tablet `--repeat-each=20` | 0 | **20 passed** |
| building / home evidence: area-row, devices-tiles, home-295, homeinfo-295, home-quickcard-295, mb-home-2500, area-honest-count-2540, generator-home, elevators-home, home-polish; desktop + tablet + mobile | 0 | **86 passed**, 190 skipped (their own project skips) |
| `fixture_job.py evidence-home-screen --no-build` | 0 | 25 passed, 0 unexpected, 0 flaky |
| layout-devices-break-297, layout-widgets-break-297, layout-home-widgets-wide-298, layout-elevators-widget-297, layout-home-edit-bar-wp4 against the **preview** build | 1 | 35 failed, 32 passed - not a result: four of the five say "needs the Vite DEV server" (their harness imports `/src/`); re-run on the dev server in run E below |
| pixel home-gaps-2436, home-auditfix-2437, home-fb-2431, home-next-2500, area-honest-count-2540, home-account-2530, `--grep pixel-stable` | 1 | 43 passed, **3 failed** (home-auditfix "portrait tablet 768 ... dark", home-next "wall notice board, all dark", home-gaps "my notifications with the alarm code dark": two settle time-outs, one 41-pixel diff) - all three are the home INTERFACE (`home/*`), which does not use `home-widgets` (the changed component); base vs fix in run F below |
| visual-matrix home cases desktop + tablet | 1 | 11 passed, 1 failed: "devices-building ready dark" tablet - the screenshot timed out after 5 s (no picture compared); run F below |

### 6.2 Runs E and F (`~/work/p2520_t2540_ef.sh`; results `~/work/p2540e-out`, `~/work/p2540f-out`)

| check | base `f9217db8a` | head `c768bfc8a` |
|---|---|---|
| the five building / home layout specs on the **Vite dev server** (as the gate's dev lane), desktop + tablet + mobile | - | **67 passed**, 23 skipped, 0 failed |
| pixel home-auditfix-2437 / home-next-2500 / home-gaps-2436, desktop + mobile, `--grep pixel-stable`, `--repeat-each=2`, workers 1 | 50 passed, **2 failed** | 51 passed, **1 failed** |
| visual-matrix home cases desktop + tablet `--repeat-each=2` | 24 passed | 24 passed |

The one pixel test that fails in this harness - home-next "wall notice board, all dark" (41 pixels) - fails at the base too (2 of 2) and
passed in the gate at the same base (`pw_pixel_27.log`): a difference of this ad-hoc harness (a plain `vite build` + `vite preview`), not
of the fix; the home interface does not use the changed `home-widgets`. The run-D settle time-outs did not repeat.

UI rebuilt at `c768bfc8a` (the build of `7accbe97d`): arx-shell-2.54.0, 0 maps, build stamp 2129 files `683e70eff9b1...`, source_commit
`7accbe97d`, archive sha256 `fb65b61b...19d2`; `release_check.py` on the PC: "ready for the owner's approval" (only the tag).

## 7. Release gate result (lead, 27.11)

| Run | Head | Mode | Wall | Verdict |
|---|---|---|---|---|
| 1 | `f9217db8a` | full (new GATE-TRUST engine installed before it) | 192 min | FAIL - 0 hard, 9 test failures, 2 root causes (section 6) |
| 2 | `c768bfc8a` | `--after` run 1, 3 h cap | 41 min | FAIL - 1 hard: addon_build, `ghcr.io` TLS handshake timeout pulling the base image (infra; manifest reachable again right after), 0 test failures |
| 3 | `c768bfc8a` | `--after` run 1, 3 h cap | 37 min | **PASS** - 0 hard, 0 test failures, 0 flaky |

Coverage anchor (TR-09) for runs 2-3: the full run 1 at `f9217db8a`, 3 commits / 2 h behind, 2 product files changed. `bba451a5f`
after `c768bfc8a` is docs/management only. Final bilingual CHANGELOG by the lead (DRAFT marker removed, rollback note added).
Publishing waits for the owner's approval in chat.
