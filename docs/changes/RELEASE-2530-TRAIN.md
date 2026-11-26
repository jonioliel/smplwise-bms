# RELEASE-2530-TRAIN - the 2.53.0 train

Branch `release/2530-train`, worktree `C:\cloude\smplwise-2530train`, cut from `origin/release/2520-train` at `91de5c377` (2.52.0 not
released then; the 2.52 train was merged in three more times, last at its gate head `6d8fd71e1`). 2.52.0 was released on 26.11: `main` =
the `v2.52.0` tag = `bf4e6da76`, merged in `1c5183244`. Coordinator: the train agent (merges, version bump, train checks). No release gate was started here (the
lead's), nothing was installed, no lab, no Home Assistant, no WisKey contact. The 2.53 gate engine (GATE-FIXTURE-LANE-2530) is NOT installed
on the runner (lead: the 2.52 gate runs with the 2.52 engine; the lead installs the 2.53 engine with `engine_sync.py` after 2.52 is released).

## 1. Merge log

Every row merged with `--no-ff` in the lead's order; each merge commit names the row head.

| # | row | head | merge commit | base | conflicts | notes |
|---|---|---|---|---|---|---|
| 1 | `pilot/LOAD-BUDGET-2530` (T068) | `8c299c508` | `3fe6bf2c3` | `eadaa25b8` | none | test-and-docs only; the 14 h soak is NOT started |
| 2 | `pilot/NOTICE-TV-LASTSEEN-2530` | `b00fa2971` | `9ef72a575` | row 1 | none | Q1-Q3 = a |
| 3 | `pilot/HOME-T120-REST-2530` | `17c61a0b7` | `4f72e6438` | `eadaa25b8` | none | `msg/home.ts`, `sw-home.ts` merged cleanly (no duplicate key). Q1 = a: T120 closed (section 5) |
| 4 | `pilot/DOCS-ONBOARDING-2530` (T071) | `76873fac1` | `11cf23be5` | `eadaa25b8` | none | `sw-app.ts`, `settings_store.py`, `GUIDE_ALL_HE.html` merged cleanly; `build_guide.py --check` up to date |
| 5 | `pilot/MFA-T095-REST-2530` (T095) | `08e3ed5b6` | `46692b29e` | `eadaa25b8` | 4 files | see below; `API_INVENTORY.md` regenerated 1948 -> 1955 routes |
| 6 | `pilot/WISKEY-MEDIA-V2-2530` | `d29d9a1fd` | `6365fcb17` | `eadaa25b8` | none | train fixes `8dfd46115`, `f41473bbc` (section 2) |
| 7 | `pilot/WISKEY-NOFALLBACK-2-2530` | `a7997abbb` | `c74e485f1` | `76ee24bcb` (2.52 row 34) | none | only its own commits come in |
| - | version bump | - | `4c43d7619` | - | - | section 1.1 |
| - | `chore/ACCEPT-SWEEP-2530` | `1a12b953c` | `db79121bd` | `91de5c377` | none | registry only: 29 released REVIEW cards -> DONE; `project_status.py --write` PASS |
| - | sync `release/2520-train` | `8abc5d652` | `c9085c0ad` | - | generated views | GATE-HARDEN-2520, SCREENS-FIX-B2-2520 + fixes; views regenerated |
| 8 | `pilot/WISKEY-KNOWN-TREES-RC20-2530` | `8859b3fc7` | `0a4286b4c` | `c128c2f86` (2.52 train) | none | Q1 = a, Q2 = a |
| - | sync `release/2520-train` | `9fb8109fb` | `4cb8ed934` | - | none | the 2.52 fix of `test_error_contract_inventory_2490` / `gate_always_run.json` (run A failures 1 and 3) |
| 9 | `pilot/WISKEY-A2-EXEC-2530` | `4a5eb50c7` | `1ea525393` | `eadaa25b8` | 3 files | see below; `API_INVENTORY.md` 1955 -> 1958; train fix `7b888872e` |
| 10 | `pilot/GATE-FIXTURE-LANE-2530` | `d52a6e649` | `6329e4178` | `c128c2f86` | none | engine NOT installed (above); Q1-Q4 = a |
| - | sync `release/2520-train` | `6d8fd71e1` | `5bca84ee2` | - | generated views | SEC-FIX-2520, rows 43-44, `aefc33e70` (pairing catalogue, run A failure 7), the 2.52.0 UI rebuilds |
| 11 | `pilot/HOME-SCROLL-FIX-2530` | `c41c14ad0` | `2d674e581` | `9b659b361` (2.52 train) | none | Q1-Q3 = a; `evidence-home-screen` -> `"gate": true` waits for one 23/23 run (section 4) |
| - | `origin/main` = **v2.52.0** | `bf4e6da76` | `1c5183244` | - | `smplwise_vms/CHANGELOG.md` | 2.52.0 released. The 2.53.0 DRAFT section kept on top of main's final 2.52.0 text (the file now differs from main only by that section). Brings the 2.52 train's fix of its 17 unused exports (open point 1), the pixel spec name fix and the gate engine log-line fix (`522985143`) |
| 12 | `pilot/STALE-FIXTURE-SPECS-2530` | `9c0dc7310` | `1336cca07` | `d52a6e649` (row 10) | `test_fixture_job.py` | both sides' gate-set additions kept (evidence-home-screen + the row's four specs; the home spec asserted IN the gate); 13 gate fixture specs; Q1 = a, Q2 = a |
| 13 | `pilot/HOME-SCROLL-2-2530` | `4b20587d9` | `8ae83adfa` | `c41c14ad0` (row 11) | none | squeeze step for low screens; Q1-Q3 = a |
| 14 | `pilot/GEN-UNITS-ARRU-2530` | `367d36556` | `579652ec6` | `8ae83adfa` | none | ar / ru unit words and labels; `ar.ts` / `ru.ts` merged cleanly (`i18n-split-langs --dry` moved 0); Q1 = a, Q2 = a. Closes AT-GEN-UNITS-FIELD-2490-1 (section 5) |
| - | UI rebuild | - | `f73b4b270` | - | - | `npm run build:addon` at `579652ec6`, section 3.4 |
| - | gate run 1 fixes | - | `788bc6c5b` | - | - | section 8 |
| 15 | `pilot/TEST-STABILITY-2530` | `586de9471` | `4219db78d` | `8ae83adfa` | none | nvrless placement click; hermetic `selftest_engine_sync` (open point 4 / lead Q3 = a); `engine_sync.py` changed (install group, not STRICT) |
| 16 | `pilot/PLAYER-ERROR-TEXT-2530` | `df3d209eb` | `14383b9db` | `8ae83adfa` | none | relay error codes as sentences; 4 Linux baselines; describe title carries "pixel-stable" |
| 17 | `chore/REVIEW-FINDINGS-INDEX-2530` | `4eda5c3a2` | `b85eded27` | `bf4e6da76` | none | docs only |

Conflicts:
- Row 5: `sw-step-up-dialog.ts` - the row's push / alarm-code body and the 2.52 train's MFA-RESET-CHANNEL-UI `pkElsewhere` hint, both
  kept; the hint now also counts the phone approval as "another way" (`listed && !pk && (code || dk || push)`).
  `sw-factor-policy-admin.ts` KEYS - the train's `security.factor_reset_channel` and the row's `security.push_approval` /
  `security.step_up_alarm_pin`. `msg/mfa.ts` - both appended blocks (HEAD first), no duplicate key. `contracts/API_INVENTORY.md` -
  regenerated with `scripts/api_inventory.py`.
- Row 9: `routers/__init__.py` (the SCHED-READS mount, then the execution mount), `scripts/gen_wire_types.py` (the
  `AccessControlScheduleReads` family, then `AccessControlScheduleExecution`), `wk-schedule-library.ts` (both imports;
  `<wk-schedule-reads>` then `<wk-schedule-exec>`) - both kept, HEAD first. `gen_wire_types --check` 0, `error_contract_inventory --check`
  0 legacy 422 sites, design ratchet holds, schedule-editor packs without duplicate keys.
- Syncs: only `PROJECT_BOARD.html` / `management/STATUS.md` (generated) - regenerated with `py -3.12 scripts/project_status.py --write`.

No migration in any 2.53 row (the 2.52 train ends at 0226).

### 1.1 Version bump `4c43d7619`

`smplwise_vms/config.yaml`, the `io.hass.version` label in `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` -> `2.53.0`
(the places the 2.52 train set); `contracts/API_INVENTORY.md` regenerated (version line 2.53.0). CHANGELOG: a 2.53.0 section at the top,
**DRAFT** - the mark is in the section's comment, not the heading, as on the 2.52 train (`928f05e64`): `release_check.changelog_head()`
skips a heading marked DRAFT, so with the version files at 2.53.0 a DRAFT heading fails "one version everywhere" and `test_release_check`.
Draft lines for rows 1-9 (`4c43d7619`, `af668a1c1`). Bridge stays 0.10.9. The UI bundle (`smplwise_vms/www`, `www-public`) is the 2.52.0
build until the 2.53 release step rebuilds it.

## 2. Train fixes

| commit | what | found by |
|---|---|---|
| `8dfd46115` | WISKEY-MEDIA-V2-2530's switch refusals: the 403 text's English in `error_text_en.json`, the 409 f-string -> `tpl()` + its English template (same Hebrew, same details) | `i18n_backend_errors.py` (1 without English, 1 run-time) and run A `test_i18n_errors_en_2520` (the 2.52 train had the ratchet at 0 / 0) |
| `f41473bbc` | the same two refusals in the ADR-019 field envelope: `field_error([key], status=403 / 409, legacy={"field": key}, extra=...)` - every key the row sent stays, `fields` added | run A `test_error_envelope_family678_2520::test_families_six_seven_eight_have_no_legacy_422_left` |
| `7b888872e` | WISKEY-A2-EXEC-2530's four constant refusals: English added | `i18n_backend_errors.py --missing` (4) |
| `b2f3ae668` | `export` dropped from four file-local declarations of rows 3 / 4 (`AccountTab`, `accountOk`, `accountTab`, `OnboardingState`) | run A `unused-exports.mjs --enforce` (21 new; 17 are the 2.52 train's, left to it) |
| `548e81acf` | three Node unit guards: `home/home-styles-extra.ts` as a reviewed opaque menu-token bridge (`MENU_TOKEN_SETTERS`), `home/home-account.ts` on the modal stack via `home/sw-home.ts`, DOCS-ONBOARDING's four English path strings with ‹ like the other English paths | run A Node unit suite (`unit-menu-lint`, `unit-modal-stack-guard-2442`, `unit-uxfix-rtl`) |
| `8cf1444db` | `pixel-onboarding-2530`: a fixed '0.0.0' stand-in for the interface version before the screenshot (the mask box width followed the version text, 283 px after 2.52.0 -> 2.53.0) | run A every-pixel run |
| `0d76a0980` | `export` dropped from WISKEY-A2-EXEC's two file-local types (`ExecPhase`, `ExecSupportState`) | run B `unused-exports --enforce` |
| `014ee92ae` | the refreshed Support baseline (desktop); `evidence-home-screen` `"gate": true` (section 4) | run B |
| (the baselines commit) | the 6 refreshed Linux baselines of `pixel-wiskey-schedule-exec-2530` (made on the train, run C) | run B every-pixel run |

## 3. Checks

PC (one small process at a time): `gen_wire_types.py --check` 0 (after rows 5, 8, 9); `build_guide.py --check` up to date (after rows 4, 5 and
the syncs); `api_inventory.py` 1955 (row 5) / 1958 (row 9) routes; `release_check.py` - one version everywhere 2.53.0, CHANGELOG head 2.53.0;
FAIL only on the shipped UI bundle (2.51.0 / 2.52.0 build, release step) and the missing v2.53.0 tag (expected).
`test_wiskey_media_v2_2530` 39 passed, `test_i18n_errors_en_2520` 9 passed, `test_error_envelope_family678_2520` 14 passed,
`test_settings_patch_audit_order` 8 passed, `test_fixture_job.py` 16 passed, `test_wkjoin_295` 23 passed (alone); `error_contract_inventory
--check` 0; `i18n_backend_errors.py` 0 without English / 0 run-time (after `7b888872e`); ruff clean on the changed modules.
On `577061172` (the 2.52 head, a throw-away worktree): `test_wiskey_pairing_i18n_2520` 1 failed / 46 passed - reported to the lead,
fixed on the 2.52 train by `aefc33e70`, picked up by the sync `5bca84ee2`.

### 3.1 Runner run A at `0a4286b4c` (rows 1-8 + version + first sync; `~/work/p2520_t2530_run.sh`, slot B, results `~/work/p2530-out`)

| check | exit | result |
|---|---|---|
| `gen_wire_types --check` / `sync_integration --check` / `wire_ratchet` / `request_strict_ratchet --check` / `error_contract_inventory --check` | 0 each | match / up to date / 897 = baseline / 144 / 0 legacy 422 sites |
| `i18n_backend_errors.py` | 0 | **1 without English, 1 run-time** (row 6) -> `8dfd46115` |
| `lint_backend.py --strict` / `design_ratchet.py` / `build_guide --check` / `ruff check smplwise` | 0 each | 0 findings / no count above the baseline / up to date / clean |
| `release_check.py` | 1 | UI bundle + tag only (expected) |
| `api_inventory.py` | 0 | 1955 routes, no diff |
| backend: `test_notify_channels` alone + 146 files in 15 groups of 10 (`SW_WIRE_STRICT=1`; every file the 2.53 rows' notes name, plus the WisKey / MFA / notify / wire / error-envelope / backup / settings neighbours) | see | **4863 passed, 8 failed, 3 skipped, 3 xfailed** |
| `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` | 0 / 0 / 0 / 0 | 0 errors / 0 errors / clean / built |
| `lazy-tags-check` / `bundle-budget --enforce` / `api-client-check` / `i18n-split-langs --dry` | 0 each | OK |
| `unused-exports --enforce` | 1 | 21 new: 4 rows 3 / 4 -> `b2f3ae668`; 17 the 2.52 train's |
| Node unit suite (`playwright.unit.config.ts`, 2 workers) | 1 | **5318 passed, 7 failed, 13 skipped** |
| `home-account-2530` desktop | 0 | 8 passed |
| 12 specs (home-simple-2420 / 2421, home-v3-gaps-2436, unit-mfa-t095-rest-2530, unit-mfa-passkeys-2490, unit-mfa-train-2500, unit-step-up-ui, evidence-mfa-screens-2510, evidence-mfa-factor-harden-2520, evidence-second-factor, evidence-arx-second-factor, evidence-mfa-reset-channel-ui-2520) desktop + mobile, localhost preview | 0 | **139 passed**, 67 skipped |
| `layout-setup-wizard` + `evidence-setup-wizard` desktop (`LAYOUT_QUICK=1`) | 0 | 12 passed, 2 skipped |
| every pixel spec (52 files) desktop + mobile, no `-u` | 1 | **536 passed, 1 failed**, 86 skipped; no baseline file changed |

Backend failures (8), each classified:
1. `test_error_contract_inventory_2490::test_the_inventory_runs_on_the_real_code` - the 2.52 train's (ADR-019 Step 1 done); fixed there by `9fb8109fb`, synced `4cb8ed934`.
2. `test_error_envelope_family678_2520::test_families_six_seven_eight_have_no_legacy_422_left` - row 6 -> `f41473bbc`.
3. `test_gate_always_run::test_every_package_scanner_is_listed_or_reviewed` - the 2.52 train's gate list; `9fb8109fb`, synced.
4. `test_i18n_errors_en_2520::test_every_constant_refusal_has_its_english_and_run_time_texts_only_go_down` - row 6 -> `8dfd46115`.
5. `test_release_bundle_version_2520::test_run_checks_reports_the_bundle_row_on_this_tree` and
6. `test_release_check::test_repository_is_release_consistent` - the shipped UI bundle is not built for 2.53.0 (the release step rebuilds it; the same two fail on any train before its UI rebuild).
7. `test_wiskey_pairing_i18n_2520::test_every_server_text_has_the_same_hebrew_and_an_english_sentence` - the 2.52 train's `c128c2f86`; fixed there by `aefc33e70`, synced `5bca84ee2`.
8. `test_wkjoin_295::test_a_native_people_write_commits_over_the_direct_socket` - outcome `unknown` instead of `committed` inside group 14 on a busy runner; the file alone: PC 23 passed at the train head, runner run B (below). Not a row's change (row 7's own run of this file: 23 passed).

Node unit failures (7): `unit-menu-lint`, `unit-modal-stack-guard-2442`, `unit-uxfix-rtl` -> `548e81acf` (rows 3 / 4);
`unit-mfa-passkeys-2490` x3 - page tests with no server in a node-only run (known harness; they pass under `playwright.config.ts` on a
preview: 139-passed line above); `unit-public-portal` (vendor-portal pin) - the 2.52 train's, its pin `9d06b64cc` synced in `5bca84ee2`.
Pixel failure (1): `pixel-onboarding-2530` Support desktop, 283 px inside the masked version box -> `8cf1444db` (+ baselines, run B).

### 3.2 Runner run B at `8cf1444db` (after rows 9-11, the syncs and the train fixes; `~/work/p2520_t2530_b.sh`, results `~/work/p2530b-out`)

| check | exit | result |
|---|---|---|
| generators / ratchets (as run A) + `ruff check smplwise` | 0 each | wire match; 897 = baseline; 144; 0 legacy 422 sites; **0 without English, 0 run-time**; 0 findings; no count above the baseline; guide up to date; 1958 routes, no diff; clean |
| `scripts/gate/selftest_gate.py` / `selftest_gate_fast.py` (from the merged tree; the installed engine untouched) | 0 / 0 | SELFTEST PASSED x2 |
| `scripts/gate/selftest_engine_sync.py` | 1, then 0 | the first run fell while the 2.52 release gate's `release_gate` processes ran (00:18Z; the gate ended 00:19:54Z): its install step correctly refused (`busy()` probes the real machine with `pgrep`, rc 3) and the selftest then read a manifest that was never written. Re-run in the same worktree with no gate running: **SELFTEST PASSED** (PC: SELFTEST PASSED too). Open point 5 |
| `bash -n scripts/gate/fixture_lane.sh` | 0 | syntax ok |
| backend, one process per file (36 files: A2's `test_wiskey_schedule_execution_2530` and its neighbours, the wire / error-envelope / i18n files run A failed on, MEDIA-V2, KNOWN-TREES (`test_wiskey_known_trees_rc20_2530` 33, `test_wiskey_native_bundle_2272` 7, `test_wiskey_managed_install_2382` 73), `test_fixture_job` 16, `test_wkjoin_295` 23, `test_get_routes_read_conn` 743) | 0 x 35, 1 x 1 | **1830 passed, 1 failed, 8 skipped**: the one failure is `test_release_check::test_repository_is_release_consistent` (UI bundle, expected). Every run-A backend failure that belonged to a row or to the 2.52 train is green here (`test_error_contract_inventory_2490` 7, `test_error_envelope_family678_2520` 14, `test_gate_always_run` 19, `test_i18n_errors_en_2520` 9, `test_wkjoin_295` 23 alone) |
| `tsc` app / `npm run typecheck` / `npm run lint` / `npm run build` / lazy-tags / bundle budget / api-client / i18n-split `--dry` | 0 each | 0 errors / 0 errors / clean / built / OK |
| `unused-exports --enforce` | 1 | 19 new: 2 WISKEY-A2-EXEC -> `0d76a0980`; 17 the 2.52 train's (open point 1) |
| Node unit suite | 1 | **5327 passed, 3 failed** (only `unit-mfa-passkeys-2490` x3, the known node-only harness), 13 skipped |
| `evidence-wiskey-schedule-exec-2530`, `evidence-wiskey-schedule-writes`, `evidence-wiskey-schedule-reads-2520`, `layout-audit30wk-components` desktop + mobile | 0 | 41 passed, 1 skipped |
| `pixel-onboarding-2530` Support `-u` (that test only) | 0 | 2 passed; desktop baseline rewritten, phone byte-identical -> committed `014ee92ae` |
| every pixel spec desktop + mobile, no `-u` | 1 | **539 passed, 6 failed**, 86 skipped: all six `pixel-wiskey-schedule-exec-2530` (A2's baselines were made on `eadaa25b8`; on the train the block is 1 px taller with the same content - the 2.52 train's later card styling; checked visually) -> refreshed in run C |
| `scripts/fixture_job.py evidence-home-screen --no-build` (devices fixture backend, desktop + mobile, one run) | 0 | **23 passed**, 21 skipped (the other project's) -> section 4 |

**Run C at `014ee92ae`** (`~/work/p2520_t2530_c.sh`, results `~/work/p2530c-out`): `tsc` app / tests 0 / 0 errors; build;
`unused-exports --enforce` 17 new (exactly the 2.52 train's; none of the 2.53 rows' left); `pixel-wiskey-schedule-exec-2530 -u` 8 passed,
6 of the 8 Linux baselines rewritten (2 byte-identical) -> committed; re-check twice without `-u` (`pixel-wiskey-schedule-exec-2530` +
`pixel-onboarding-2530`, desktop + mobile): **23 passed, 1 skipped** both times.

### 3.3 Runner run E at `8ae83adfa` (after main = v2.52.0 and rows 12-13; `~/work/p2520_t2530_e.sh`, results `~/work/p2530e-out`)

| check | exit | result |
|---|---|---|
| generators / ratchets + `ruff check smplwise` | 0 each | as run B: match, 897 = baseline, 144, 0 legacy 422 sites, 0 without English / 0 run-time, 0 lint findings, no count above the design baseline, guide up to date, 1958 routes no diff, clean |
| gate self-tests from the tree (no gate process running) | 0 x 3 | `selftest_gate`, `selftest_engine_sync`, `selftest_gate_fast`: SELFTEST PASSED x3 |
| backend, one process per file: `test_media_groups` 22, `test_media_players_commands` 20, `test_media_players_api` 23, `test_bridge_media_players` 17, `test_media_commands` 59, `test_media_fake_ha` 75, `test_fixture_job` 16, `test_singletons_registered` 4, `test_gate_always_run` 19, `test_i18n_errors_en_2520` 9 | 0 each | all passed. `test_release_check` 1 failed / 2 passed and `test_release_bundle_version_2520` 1 failed / 5 passed: the UI bundle before the rebuild (both green after `f73b4b270`, PC 3 / 6 passed) |
| `tsc` app / tests + scripts; `npm run lint`; `npm run build`; lazy-tags; bundle budget | 0 each | 0 / 0 errors; clean; built; OK; OK |
| **`unused-exports --enforce`** | **0** | **no export outside the baseline** (the v2.52.0 merge brought the 2.52 rows' fix) |
| Node unit suite | 1 | 5327 passed, **3 failed** = `unit-mfa-passkeys-2490` x3 (the known node-only harness), 13 skipped |
| `fixture_job.py` evidence-home-screen, evidence-media-players-live, evidence-wiskey-people / -editor / -capture (the JSON's projects, their fixture backends) | 0 | home screen 24 / 0 (desktop + mobile); media_ma 49 / 0, media_sonos 44 / 0 (desktop / tablet / mobile); wiskey 22 / 0; no_ha 5 / 0 - every gate fixture spec the train added, 0 unexpected, 0 flaky |
| `visual-matrix` home cases desktop + tablet | 0 | 12 passed (baselines unchanged) |
| **every pixel spec desktop + mobile, no `-u`** | **0** | **545 passed, 0 failed**, 86 skipped; no baseline changed |

### 3.4 Run F at `579652ec6` (row 14 and the UI rebuild; `~/work/p2520_t2530_f.sh`, results `~/work/p2530f-out`)

`i18n-split-langs --dry` 0 (moved 0); `tsc` app / tests 0 / 0 errors; lint clean; `unused-exports --enforce` OK; unit
`unit-gen-units-arru-2530`, `unit-genlog-tempexplain`, `unit-generator`, `unit-i18n-lang-packs-2443`, `unit-i18n-core`,
`unit-i18n-en-ratchet-2490`: **61 passed**; build; `evidence-gen-units-arru-2530` + `evidence-gen-units-en-2490` +
`evidence-gen-units-routing-2520` desktop / tablet / mobile: **33 passed, 0 failed**.
Then `npm run build:addon` (`~/work/p2520_t2530_buildui.sh 579652ec6`): rc 0; `www/arx-sw.js` arx-shell-2.53.0; 0 `.map` files and 0
`sourceMappingURL` in www / www-public (369 maps archived under `smplwise-results/sourcemaps/2.53.0`); public chunk largest
public-ticket 60.23 kB (budget 62 KB). Archive sha256 `a67809ee...a7b7`, copied as base64 and verified, extracted over
`smplwise_vms/www` / `www-public` -> `f73b4b270`. `release_check.py`: every check ok except the v2.53.0 tag -> "ready for the owner's
approval"; PC `test_release_check` 3 passed, `test_release_bundle_version_2520` 6 passed.

## 4. HOME-SCROLL-FIX-2530 question 1 (evidence-home-screen in the gate)

Run B (`8cf1444db`, section 3.2): `scripts/fixture_job.py evidence-home-screen --no-build` on the merged train (GATE-FIXTURE-LANE-2530's
fixture job + HOME-SCROLL-FIX-2530's layout fix), devices fixture backend, the JSON's projects (desktop + mobile), one run: rc 0, **23
passed, 0 failed**. So `frontend/tests/fixtures/fixture_specs.json` now has `evidence-home-screen.spec.ts` `"gate": true` (`014ee92ae`;
the stale `_why_not_gate` dropped), `test_fixture_job.py`'s expected gate set + 1 (PC 16 passed), `docs/testing/GATE_LANES.md` updated. It
takes effect in the first gate with the 2.53 engine (open point 2). The row's own queued run (`~/work/p2520_homescroll_final.out`, at the
row's branch) had not started when this was written; the train run above is the one-run 23/23 the lead asked for. That queued run finished later (00:08Z, at the row's branch): 22 passed, **1 failed** - "edit mode: ... the order by drag" (the drag the row's note already calls intermittent: its run 1 failed it, run 2 passed). So the train measured it once more - run D at `88c6b675b`, `fixture_job.py evidence-home-screen --project=desktop --no-build` four times in a row: **17 / 17 passed each time** (0 unexpected, 0 flaky). On the train: 5 of 5 runs green; at the row's branch: 2 of 3 runs lost the drag. The flag stays `true`; open point 6.

## 5. Registry

`management/tasks.json`: cards for the 2.53 rows (LOAD-BUDGET, NOTICE-TV-LASTSEEN, HOME-T120-REST, DOCS-ONBOARDING, MFA-T095-REST,
WISKEY-MEDIA-V2, WISKEY-NOFALLBACK-2, WISKEY-KNOWN-TREES-RC20, WISKEY-A2-EXEC, GATE-FIXTURE-LANE, HOME-SCROLL-FIX, all -2530) as REVIEW
with the row head and the merge commit (R-<id>-1 PLANNED, AT-<id>-1 NOT_RUN), RELEASE-2530-TRAIN IN_PROGRESS; evidence lines on T068,
T071, T095 (status unchanged). **GEN-UNITS-FIELD-2490 -> DONE** (lead): AT-GEN-UNITS-FIELD-2490-1 PASS at `579652ec6` (run F: Hebrew / English / Arabic / Russian
evidence, section 3.4), card commit = that acceptance commit (the 2.49 implementation is `bd551962d`); card GEN-UNITS-ARRU-2530 REVIEW.
Cards STALE-FIXTURE-SPECS-2530 and HOME-SCROLL-2-2530 REVIEW. **T120 -> DONE** (HOME-T120-REST-2530 Q1 = a): acceptance lines 1 and 4 (and R-T120-1 / R-T120-4, AT-T120-1 /
-4 expected) updated to the owner decisions (`home.default_mode`, default `full_all`, HOME-SIMPLE-2421; scenes by whoever holds scene
management, Q75); AT-T120-1..5 PASS at `0a4286b4c` with the run-A receipts (section 3.1) and the row's own runner receipts; known limits
(no lab / real device checks - a separate lab card, Q3 = a) and rollback in the card. `py -3.12 scripts/project_status.py --write`: PASS.

## 6. Open points

1. ~~**Inherited from the 2.52 train**~~ - RESOLVED by the v2.52.0 merge `1c5183244` (lead decision: Q1 resolved by the merge). Was: 17 `unused-exports --enforce` items of the 2.52 rows (`STARTABLE`, `jobCounts`,
   `WkReadState`, `SupportState`, `WkTiles`, `RequestLine`, `SERVICE_GRANT_COMMANDS`, `ScheduleReadAction`, `SyncMode` / `SyncGate` /
   `SyncMatch`, `WkLastResult`, `EnterAnswer`, `WfsReason`, `WpsLine`, `OfflineLang`, `InventoryLine`; the gate's `fe_static` step enforces
   it; reported to the lead 26.11): a) the 2.52 train drops the `export`s or records them in the baseline with a reason, and the 2.53 train
   takes it with the next sync (recommended) b) the 2.53 train does it after 2.52 is released.
2. **The 2.53 gate engine** (GATE-FIXTURE-LANE-2530) - installed after 2.52.0 by the lead's order, section 7. Was: merged but not installed; the 2.53 gate needs `engine_sync.py install --apply` by the
   lead after 2.52 is released (the drift check refuses otherwise).
3. **Design ratchet** says `px-literal` can be lowered (rows' token work); left for the release step (`design_ratchet.py --update` only lowers).
4. **`selftest_engine_sync.py` is not hermetic against a running gate** (lead decision Q3 = a: a small GATE row later) (`engine_sync.busy()` probes the machine with `pgrep`, so
   the selftest fails while any `release_gate` process runs - run B): a) a GATE row lets the selftest pass a fake `busy` (or `--force-busy`
   for its own fake home) (recommended) b) run the selftest only when no gate runs.
6. **`evidence-home-screen` drag test** (lead decision Q2 = a: keep the spec in the gate; quarantine only the drag test with a ticket and an expiry if it fails a gate) ("edit mode ... the order by drag", line ~549): green 5 / 5 on the train, lost 2 of 3 times at the row's branch. a) keep `"gate": true`; if the 2.53 gate shows it, quarantine that one test with a ticket and an expiry (owner rule) and make the drag wait for the drop's settle (recommended) b) set `"gate": false` again until a `--repeat-each=10` run is clean.
7. **`~/gate2/gate_budget.py` is newer than the repository** (section 7; warn-only drift): a) a GATE row commits the installed
   GATE-SPEED-2320 version to `scripts/gate/gate_budget.py` (recommended) b) leave the warning.
5. **More rows** will join this train; each one cut from `eadaa25b8` should be checked against the 2.52 ratchets that reached 0 later
   (backend refusal English / run-time, ADR-019 field envelope, Node unit guards) - rows 6 and 9 needed train fixes for exactly this.

NOT_RUN on the train: the release gate (the lead's), the full backend suite in one sweep (the touched areas above only), the full Playwright
suites beyond the specs named, tablet, the 14 h soak (LOAD-BUDGET), any lab / live WisKey / Home Assistant check.

## 7. The 2.53 gate engine on the runner (lead's order, after 2.52.0)

Installed on 26.11 with no gate, entry check or nightly running (status files `pass` / `fail` / `done`, no `release_gate` /
`nightly_tests` process), from a clean detached worktree `~/work/p2530eng` at `origin/release/2530-train` = `8ae83adfa`:
`python3 scripts/gate/engine_sync.py install --src ~/work/p2530eng --apply --suffix .bak_2611` -> 5 files (`release_gate.py` in `~`,
`~/gate2`, `~/nightly-gate`; `engine_sync.py` in `~` and `~/gate2`; `release_gate2.sh` and `selftest_gate.py` were already the same), 5
backups `*.bak_2611`; `--files fixture_lane.sh --apply` -> `~/fixture_lane.sh` (new). Manifest `~/gate_install_manifest.json`: source
commit `8ae83adfa`, not dirty.

Drift check `python3 ~/engine_sync.py check --repo ~/smplwisebms --ref origin/release/2530-train`: **exit 0** - the engine
(`~/release_gate.py`, sha256 `49141c6fbf06ae08...`) equals the train's `scripts/gate/release_gate.py`. One warn-only line, pre-existing
and not from this train: `~/gate2/gate_budget.py` DIFFERENT - the installed copy is NEWER than the repository (GATE-SPEED-2320's
effective-limit code, installed by hand 31.10, never committed; the same warning against `origin/main`). Not replaced (the repository
version would drop that limit logic). Open point 7. Against `origin/main` the strict check now exits 4, as expected (the nightly runs it
warn-only). No later train commit changes `scripts/gate/release_gate.py`, so the drift check stays clean at the train's head.

## 8. Gate run 1 (`aeb05ad3d`, the lead's): FAIL, 211 min, 0 hard failures, 6 test failures

Fixed in `788bc6c5b`, each at its root cause (41 flaky ones - failed once, passed alone - not chased, as the lead asked):

| # | failure | root cause | fix |
|---|---|---|---|
| 1 | [preview] `electricity-meter-rename.spec.ts:145` desktop, height 34.67 < 36 (also alone) | the field was measured while the `sw-dialog` box was still landing from `scale(0.96)` (36 x 0.963 = 34.67); FLAKY-FIX-2520 made that entrance really apply, the test predates it | the spec settles the page's finite animations (`helpers/settle`) before reading the geometry; product unchanged |
| 2-3 | [pixel] `pixel_55` "No tests found" / zero tests | the 56th spec of the engine's pixel list, `pixel-wiskey-schedule-exec-2530.spec.ts` (WISKEY-A2-EXEC-2530), had no "pixel-stable" in its case titles; the pixel step runs `--grep pixel-stable` (2.52's `pixel_53` class) | the four titles carry it; screenshot names / baselines unchanged. Every other spec with `toHaveScreenshot` has the tag or `pixelTitle()` (checked); row 16's spec carries it in its describe title |
| 4 | `test_gate_speed::test_v2_jobs_cover_exactly_the_v1_specs_and_projects` | it expected ONE fixture job with every fixture spec; GATE-FIXTURE-LANE-2530 made one job per fixture group | the test checks one `fixture_<group>` job per group and that together they run exactly the classified fixture specs (PC 18 passed) |
| 5 | `test_secfix_restore_settings_2520::...classified_keep_or_travel` | `access.station_media_direct_v2` (WISKEY-MEDIA-V2-2530) in the `access.station_*` policy family, unnamed | named in `services/backup.py` `SETTINGS_KEEP` (behaviour unchanged - the family already failed closed); PC 21 passed |
| 6 | `test_t06_admission_295::...signing_call_are_the_known_ones` | new caller `services/wiskey_schedule_execution.py` (WISKEY-A2-EXEC-2530) | reviewed legitimate: signs only through the installed direct join's own session (as SCHED-READS) and only its three READS; decide / execute / preview / cancel refused before any byte. Added with that reason + pin test `test_the_2530_schedule_execution_caller_sends_only_its_three_reads`; PC 64 passed, 3 xfailed |

`lint_spec_waits.py --new-since bf4e6da76` (the settle lint of the gate): 0 findings in 15 files (PC). Runner run G: section 9.

## 9. Runner run G at `b85eded27` (after the fixes and rows 15-17; `~/work/p2520_t2530_g.sh`, results `~/work/p2530g-out`)

| check | exit | result |
|---|---|---|
| `lint_spec_waits.py --new-since bf4e6da76` (the gate's settle lint) | 0 | 0 findings in 15 files |
| `gen_wire_types --check` / `error_contract_inventory --check` / `i18n_backend_errors` / `lint_backend --strict` / `design_ratchet` / `release_check` | 0 each | match / 0 legacy 422 / 0 without English, 0 run-time / 0 findings / no count above the baseline / ready for the owner's approval |
| gate self-tests from the tree | 0 x 3 | SELFTEST PASSED x3 (engine_sync hermetic since row 15) |
| the gate's three failed backend files, one process each: `test_gate_speed` / `test_secfix_restore_settings_2520` / `test_t06_admission_295` | 0 / 0 / 0 | **19 passed / 21 passed / 64 passed, 3 xfailed** |
| `test_fixture_job` 16, `test_backup` 8, `test_backup_sensitive` 32, `test_wiskey_schedule_execution_2530` 21, `test_release_check` 3, `test_release_bundle_version_2520` 6 | 0 each | all passed |
| `tsc` app / tests + scripts; `npm run lint`; build | 0 each | 0 / 0 errors; clean; built |
| **`unused-exports --enforce`** / bundle budget / lazy tags / i18n-split `--dry` | 0 each | **no export outside the baseline** / OK / OK / moved 0 |
| Node unit suite | 1 | 5343 passed, 3 failed = `unit-mfa-passkeys-2490` x3 (the known node-only harness), 13 skipped |
| `electricity-meter-rename` desktop + mobile `--repeat-each=3` | 0 | **42 passed** |
| `evidence-player-error-text-2530` + `unit-player-error-text-2530` desktop + mobile | 0 | 25 passed, 7 skipped |
| `pixel-wiskey-schedule-exec-2530` / `pixel-player-error-text-2530` with the gate's own `--grep pixel-stable`, `--workers=1` | 0 / 0 | **8 passed / 4 passed** (was "No tests found" for the first) |
| `fixture_job.py evidence-nvrless-cameras-2412` (all its groups, desktop / tablet / mobile) | 0 | nvrless_cameras 14 / 0, its stage s1 and nvrless_recorder PASS, 0 flaky |

Then the shipped UI rebuilt at `130ca5213` (the code of `b85eded27`), commit after this note - archive sha256 `ad50c457...0014`, arx-shell-2.53.0, 0
maps; `release_check.py` "ready for the owner's approval". HOME-SCROLL-3-2530 is NOT on this train (lead: to 2.54, its spec is flaky).


## 10. Release gate result and release (lead, 26.11)

| Run | Head | Mode | Wall | Verdict |
|---|---|---|---|---|
| 1 | `aeb05ad3d` | full | 211 min | FAIL - 0 hard, 6 test failures (fixed in `788bc6c5b`, section 8) |
| 2 | `5613a0ace` | `--after` run 1, default derived cap 4059 s | 65 min | FAIL - budget exhausted under runner load (every failure a timeout / no report; no test assertion failed) |
| 3 | `5613a0ace` | `--after` run 1, `GATE_TOTAL_SECS=10800` | 125 min | **PASS** - 0 hard, 0 test failures, 24 flaky (failed once, passed alone) |

Run 3 summary: `~/smplwise-results/gate_release-2530-train_5613a0ace.gate2.md` (selection 477/1120 backend files, 490/1301 specs,
36/64 pixel specs; 17 heavy unchanged specs deferred to the nightly full run).

- Owner approval (chat, 26.11): "כן, לפרסם ולהתקין" - publish and lab install. No migration, bridge unchanged (0.10.9), no Home
  Assistant restart.
- Final bilingual CHANGELOG written by the lead (DRAFT marker removed; the home-scroll line now says "in the default information
  style", since the "cards" style still scrolled at 1024x768 before HOME-SCROLL-3-2530, which moved to 2.54; a Fixed line for
  PLAYER-ERROR-TEXT-2530; the rollback note).
- `scripts/release_check.py`: ready for the owner's approval (only the tag missing).
