# RELEASE-2530-TRAIN - the 2.53.0 train

Branch `release/2530-train`, worktree `C:\cloude\smplwise-2530train`, cut from `origin/release/2520-train` at `91de5c377` (2.52.0 not
released yet; the 2.52 train was then merged in three more times, last at its gate head `6d8fd71e1`). When 2.52.0 is released, `main` /
the `v2.52.0` tag are merged in. Coordinator: the train agent (merges, version bump, train checks). No release gate was started here (the
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
T071, T095 (status unchanged). **T120 -> DONE** (HOME-T120-REST-2530 Q1 = a): acceptance lines 1 and 4 (and R-T120-1 / R-T120-4, AT-T120-1 /
-4 expected) updated to the owner decisions (`home.default_mode`, default `full_all`, HOME-SIMPLE-2421; scenes by whoever holds scene
management, Q75); AT-T120-1..5 PASS at `0a4286b4c` with the run-A receipts (section 3.1) and the row's own runner receipts; known limits
(no lab / real device checks - a separate lab card, Q3 = a) and rollback in the card. `py -3.12 scripts/project_status.py --write`: PASS.

## 6. Open points

1. **Inherited from the 2.52 train, not fixed here:** 17 `unused-exports --enforce` items of the 2.52 rows (`STARTABLE`, `jobCounts`,
   `WkReadState`, `SupportState`, `WkTiles`, `RequestLine`, `SERVICE_GRANT_COMMANDS`, `ScheduleReadAction`, `SyncMode` / `SyncGate` /
   `SyncMatch`, `WkLastResult`, `EnterAnswer`, `WfsReason`, `WpsLine`, `OfflineLang`, `InventoryLine`; the gate's `fe_static` step enforces
   it; reported to the lead 26.11): a) the 2.52 train drops the `export`s or records them in the baseline with a reason, and the 2.53 train
   takes it with the next sync (recommended) b) the 2.53 train does it after 2.52 is released.
2. **The 2.53 gate engine** (GATE-FIXTURE-LANE-2530) is merged but not installed; the 2.53 gate needs `engine_sync.py install --apply` by the
   lead after 2.52 is released (the drift check refuses otherwise).
3. **Design ratchet** says `px-literal` can be lowered (rows' token work); left for the release step (`design_ratchet.py --update` only lowers).
4. **`selftest_engine_sync.py` is not hermetic against a running gate** (`engine_sync.busy()` probes the machine with `pgrep`, so
   the selftest fails while any `release_gate` process runs - run B): a) a GATE row lets the selftest pass a fake `busy` (or `--force-busy`
   for its own fake home) (recommended) b) run the selftest only when no gate runs.
6. **`evidence-home-screen` drag test** ("edit mode ... the order by drag", line ~549): green 5 / 5 on the train, lost 2 of 3 times at the row's branch. a) keep `"gate": true`; if the 2.53 gate shows it, quarantine that one test with a ticket and an expiry (owner rule) and make the drag wait for the drop's settle (recommended) b) set `"gate": false` again until a `--repeat-each=10` run is clean.
5. **More rows** will join this train; each one cut from `eadaa25b8` should be checked against the 2.52 ratchets that reached 0 later
   (backend refusal English / run-time, ADR-019 field envelope, Node unit guards) - rows 6 and 9 needed train fixes for exactly this.

NOT_RUN on the train: the release gate (the lead's), the full backend suite in one sweep (the touched areas above only), the full Playwright
suites beyond the specs named, tablet, the 14 h soak (LOAD-BUDGET), any lab / live WisKey / Home Assistant check.
