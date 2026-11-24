# RELEASE-2500-TRAIN - the 2.50.0 train

Branch `release/2500-train`, cut from `main` = tag `v2.49.0` (`d0c456399`) on 24.11.2026 by the release-assembly agent in the worktree
`C:\cloude\smplwise-2500train`. Owner standing rule (18.11): one train and one release gate per version, fix forward with targeted
re-runs. The merge order, the conflicts and the per-row pre-boarding notes come from the early trial (`origin/trial/2500`,
`docs/changes/TRIAL-2500.md`). Every head was checked against `origin` after `git fetch`; merges `--no-ff`, messages from UTF-8 files
without BOM. Generated files were regenerated, never hand-merged (`gen_wire_types.py`, `api_inventory.py`, the language pack index).
Most rows were based on 2.47.0 (`619f94d04`); the ADR-019 rows, NOTICE-WIRE-DRIFT, T068-EDGE, DOCS-GUIDE-REFRESH on 2.48.0
(`d6f09395e`), REVIEW-2490-FIXES on the 2.49 train (`f73c20728`).

## 1. What merged (in this order)

| # | Branch | Head | Merge | Conflicts and resolution |
|---|---|---|---|---|
| 1 | `pilot/ONVIF-DISCOVER-2500` | 5a729cbca | c00430f38 | none |
| 2 | `pilot/ONVIF-API-2500` | 004c0b695 | e9936300e | none |
| 3 | `pilot/ONVIF-CLIENT-2500` (migration 0217) | d58353161 | ec459f49e | none |
| 4 | `pilot/ONVIF-UI-2500` | 5cc014eda | e86dcb8d0 | `frontend/src/i18n/lang/en.ts` (generated pack index: 2.49 added `en/api/closed-errors`, the row `en/i18n/camera-discovery`, every `tN` shifts): regenerated from the files under `lang/en/` exactly as `scripts/i18n-split-langs.mjs` writes it (`ar.ts` / `ru.ts` unchanged) |
| 5 | `pilot/HOME-WALL-NIGHT-2500` | c0fb81e2e | 35e15d450 | 14 `docs/evidence/USR2/*.png` (login / local users / service identity, re-captured by the row as a side effect): the whole `docs/evidence/USR2` folder taken from `main` (TRIAL-2500 section 6) |
| 6 | `pilot/HOME-NEXT-2500` (on 5) | 87dbf121a | 2b6711335 | none |
| 7 | `pilot/HAND-SWITCH-HOME-PERSONAL-2500` (on 6) | ca28a964d | 0a0a60e69 | none |
| 8 | `pilot/HOME-FAVORITES-2500` | 7156c24ef | 081aa9708 | none (the trial's pixel refresh `7156c24ef` included) |
| 9 | `pilot/MULTI-BUILDING-SAFETY-2500` | d00aa3ede | aebb29f94 | `contracts/API_INVENTORY.md` (a 2.47.0 inventory committed by the row): `main` kept, regenerated at release time; `en/i18n/msg/system-b.ts`: both sides appended English keys at the table end - union, no duplicate key |
| 10 | `pilot/MULTI-BUILDING-HOME-2500` (migration 0218) | 63e7a7c02 | f9c01d66a | the six home-settings files of TRIAL-2500 section 2, now with HOME-NEXT's `wall_notice_new` as well: `InstallBody` (the wall_* fields + `wall_notice_new` + `building_all`), `services/home_interface.py` (`INSTALL_KEYS.update(wall_*)`, `INSTALL_TIMES`, `HM_RE`, then `building_all`; `effective()` keeps `wall` and the conditional `building_id`), `wire/home_interface.py` (`HomePolicy.wall` + `building_id`; `HomeInstallSettings` wall_* + `building_all`), `test_home_interface.py` (defaults = `WALL_DEFAULTS` + `building_all: hide`); `wire-home-interface.ts` / `wire-me.ts` regenerated (`gen_wire_types.py --check` exit 0) |
| 11 | `pilot/MULTI-BUILDING-NEXT-2500` (contains 9 and 10) | d3c0dc171 | 19310c147 | `contracts/API_INVENTORY.md`: `main` kept; `en/i18n/msg/components.ts`: union (2.48 announce key + the row's building filter keys); `screens/explore-plan-editor.ts` device search: 2.48 HAND-SWITCH made the "light entities too" check box an `sw-toggle`, the row added the building filter above it and still carried the old check box - the row's `sw-building-filter` + `main`'s `sw-toggle` line (native check box count = `main`'s); `routers/schedules.py` `list_schedules`: 2.49 wraps the answer in `_out()` (localize_for), the row passes `building_filter.prepare(conn, building)` - both |
| 12 | `pilot/ADR019-STEP0-2500` | 7a4328642 | 95331be30 | `errors.py` `validation_payload`: 2.49 I18N-BACKEND's per-language constraint tables and prefix + the row's `details.fields` / `details.problems` (the problems carry the constraint text in the requester's language; Hebrew unchanged); `routers/generator.py` imports: both |
| 13 | `pilot/ADR019-FAMILY2-2500` (on 12) | 4488de48c | a1be19272 | none |
| 14 | `pilot/REVIEW-2490-FIXES-2500` | 21e444071 | 71a71a1c0 | none |
| 15 | `pilot/NOTICE-WIRE-DRIFT-2490` | fb7acbd8c | 4e980289c | none |
| 16 | `pilot/T068-EDGE-2450` | 856b234af | 54967cb7e | `services/health_report.py`: 2.49 moved the storage check / top-bar texts to the `health.*` catalogue; the row added "a save was refused for lack of space" with two Hebrew literals - 2.49's `t()` texts + the row's logic; the two new texts are catalogue keys `health.storage.refused` and `health.sum.storage_refused` (`services/health_report_text.py`, Hebrew exactly the row's, English added), the detail suffix joined with the same " · " |
| 17 | `pilot/DOCS-GUIDE-REFRESH-2500` | f0c7bcc2e | 684715ed3 | none. Its 2.49.0 text was checked against the released 2.49.0 (CHANGELOG on `main`): the same six product rows (I18N-EN, settings keywords, backend texts, default names, generator units, tickets paging), RESPONSE-MODELS-E and MFA correctly absent - still matches |
| 18 | `pilot/ADR019-L14-OBSERVE-2500` | 4b2470ed9 | d17391f37 | none. Observe mode only: `RequestModel` is `extra="ignore"` and no request model uses it yet; production logs and counts an unknown key and accepts the request; `SW_REQUEST_STRICT=1` is set only by `tests/conftest.py` |

Migrations: `main` ends at 0216; 0217 (`camera_stream_sources.origin`, `onvif_json`) and 0218 (`home_interface_policy.building_id`,
`notice_boards.building_id`), unique and contiguous, both `ALTER TABLE ... ADD COLUMN`.

Still to board (in progress when the train was assembled; merged when pushed): see section 1b.

## 1b. Rows boarded later

| # | Branch | Head | Merge | Conflicts and resolution |
|---|---|---|---|---|
| 19 | `pilot/DOOR-PREVIEW-I18N-2500` (on REVIEW-2490-FIXES) | 8d512f1fd | 93b28da97 | none. Workstation: `test_wxd10_door_jobs` **16 passed**, ruff of the door files clean, `gen_wire_types.py --check` exit 0; its own runner job was cancelled by the lead, the train's full backend covers it |
| 20 | `pilot/HAND-SWITCH-HOME-EDIT-2500` (on HAND-SWITCH-HOME-PERSONAL) | 2c019f37f | 444dda163 | none. Workstation: `unit-hand-switch-home-edit-2500` **4 passed**; its `-shots` spec added to the train's runner list |
| 21 | `pilot/NOTICE-NEWS-EMPTY-2500` | 9cad89813 | 60fc78e3d | `routers/notices.py` `_board_out` and `wire/notices.py` `NoticeBoard`: the row's `news_unset` (+ its `_news_audit` helper) and MULTI-BUILDING-HOME's conditional `building_id` - both (the required field before the optional one); `wire-notices.ts` regenerated. Workstation: `test_notice_news_empty_2500` **6 passed** |
| 22 | `pilot/NOTICE-NEWS-FEEDS-2500` (cut from v2.49.0) | 0b08c1fe3, then the final head 2f0dcfd7f | cbc5951b1, db8920a06 | none (the board patch / preview of NOTICE-NEWS-EMPTY and the row's news-source routes / wire / editor kept). API inventory unchanged (1922). Its committed `API_INVENTORY.md` merged into the 2.50.0 one without a change |
| 23 | `pilot/HOME-NEXT-2500` again (a later commit of a row already on the train) | 966557e10 | d72ec0561 | none: its Linux pixel baselines and the runner verification note. One baseline differs on the merged tree - refreshed in caa206d62 (section 2) |

Not on this train: `pilot/RESPONSE-MODELS-E-2500` (54bc7c122) - lead decision 24.11: its full backend run was still running after 14 h; it
moves to 2.51. A trial merge onto the train (local only, not pushed) showed three conflicts (the generator list of `gen_wire_types.py` -
both blocks; `camera_sources.py` - merged by the recorded resolution; `wire-home-interface.ts` - regenerated) and the response-model
ratchet unchanged (901 unmodelled routes = its baseline: the 2.50 rows' new routes already have models). The 2.50.0 CHANGELOG does not
mention it.

## 2. Fix and housekeeping commits on the train

| Commit | What |
|---|---|
| 9c91fca72 | Design ratchet (`scripts/design_ratchet_baseline.json`) raised with `--update --allow-raise` in its own commit; **kept by the lead's decision (24.11)** - tokenising these literals is a later cleanup row, not a blocker. The rows were cut from 2.47.0 and checked against its baseline (color 2497, px 25485, hand-switch 359); 2.48.0 lowered it afterwards. Per file, `origin/main` (v2.49.0) -> train (`design_ratchet.py --files`, both trees): **color-literal 1984 -> 1986**: `home/home-styles-extra.ts` 0 -> 1 (HOME-FAVORITES-2500: the fallback shadow inside `var(--hs-shadow-3, 0 12px 32px rgb(0 0 0 / .35))` of the lifted favourite tile while dragging, Q77), `home/home-wall-rest-styles.ts` 0 -> 1 (HOME-WALL-NIGHT-2500: `#000` of the night dimming layer `.wdim`, Q73). **px-literal 25462 -> 25612**: `components/camera-discovery-dialog.ts` 0 -> 87 (ONVIF-UI-2500: the new "find cameras on the network" wizard), `home/home-wall-rest-styles.ts` 0 -> 43 (HOME-WALL-NIGHT-2500: the new wall panel rest screen and takeover), `home/home-styles-extra.ts` 68 -> 80 (HOME-FAVORITES-2500: the "+ add" hole cell and the drag lift / drop outline, Q77-Q78), `home/sw-home-admin.ts` 91 -> 99 (the wall panel settings tab: HOME-WALL-NIGHT-2500 +7, HOME-NEXT-2500 +1 for the "new for" setting). hand-switch was raised 161 -> 163 here (camera-discovery-dialog +3, sw-home-personal -1) and lowered back to 161 in c33d4cd4e. Every other count unchanged |
| 4377d886b | `en/i18n/msg/system-b.ts`: MULTI-BUILDING-NEXT-2500's building filter note ("the plan editor's device search") closed its single-quoted string early - a syntax error that breaks esbuild / vite on the merged tree and on the row itself (found by `unit-i18n-en-ratchet-2490`). Escaped. A TypeScript parse of the 104 frontend `.ts` files the train changes finds no other syntax error |
| c33d4cd4e | Design ratchet hand-switch 163 -> 161 (`--update`, as HAND-SWITCH-HOME-EDIT-2500's note recommends): that row turns the home editor's widget on / off check boxes into the compact switch, so the merged count equals the 2.49.0 baseline again. The camera wizard's "same user for all" box stays a check box for now (see section 5) |
| 38c1cfb21 | Static checks of the merged tree (runner job at a2786355e): `screens/devices-building.ts` - HAND-SWITCH-HOME-EDIT-2500 lost the space between `.draft=${d}` and `.candidates=` when it added `?busy=`, so lit bound `${d}.candidates=${...}` as one string to `.draft` and never set `.candidates` (a real bug; ESLint `lit/no-invalid-html`) - space restored. `unused-exports --enforce`: 6 new file-local exports (`BfChoice` MB-NEXT, `NoticeAge` HOME-NEXT, `NightDim` / `Takeover` / `ALARM_TAKEOVER` / `URGENT` HOME-WALL-NIGHT) - `export` dropped, no run-time change. `tsc -p tsconfig.tests.json` (test-only): `home-wall-night-2500.spec.ts` route callback typed `Promise<void>` while `page.route` answers `Promise<Disposable>` on Playwright 1.63 -> `Promise<unknown>`; `evidence-mb-home-2500.spec.ts` two `expect()` joined by `&&` -> two statements. Workstation after the fix: ESLint 0 errors, `unused-exports --enforce` OK (47 / 52) |
| 8bb9d9925 | Runner unit suite at 0aeb1e41f (5,224 passed, 2 failed), both count guards older than MULTI-BUILDING-HOME's base: `unit-icon-registries` - the home registry gained `building` (fixture + SHA-1 of its path data, 487 -> 488, as RESPONSE-HINTS-2480 did for the notify horn); `unit-modal-stack-guard-2442` - `home/sw-home.ts` draws 12 hand-built dialogs (+ the building picker, an overlay type of the same HandModal stack). Test-only |
| e02fc70aa | `tests/test_notice_news_feeds_2500.py`: two tests opened `Database(settings.db_path)` with only the `settings` fixture - no tables ("no such table: settings"); they now also take `client` (create_app migrates). Test-only; 24 passed (was 2 failed / 22) |
| 6bc957320 | `notices/news-model.ts`: `HealthKey` (NOTICE-NEWS-FEEDS) is file-local - `export` dropped (unused-exports `--enforce`) |
| a5b91b572 | Backend run 3 (section 4), the five that failed twice: `contracts/fixtures/app_session/exchange_validation.json` rewritten with `ARX_WRITE_FIXTURES=1` (ADR019-STEP0's additive `details.fields` / `problems`, the only diff); `docs/user-guide/he/46-tickets_HE.md` 2.49.0 section used the old item name ("טבלת הקריאות" -> "טבלת בקשות השירות", owner rename; `GUIDE_ALL_HE.html` rebuilt, `--check` up to date); `tests/ip_literal_allowlist.txt` + the camera-discovery guard tests (ONVIF-DISCOVER / API / CLIENT / UI) and the news-feed SSRF case (NOTICE-NEWS-FEEDS), with reasons - none of their addresses is a lab host (checked against the private lab file, 0 matches); design ratchet px-literal 25612 -> 25614 (lead decision: merged counts) - `screens/system-notices.ts` +2, NOTICE-NEWS-EMPTY's "news on without a source" alert (`margin-inline-start: 22px`, `flex: 1 1 220px`). Workstation: `test_app_session_fixtures_sx25::test_exchange_validation`, `test_tickets_naming`, `test_no_ip_literals`, `test_release_check`, `test_build_guards_2438` all pass |
| 8e1e42f63, abd271ecf | `tests/evidence-mb-next-2500.spec.ts` (never run before boarding; found by the compare agent at 6bc957320, 3 of 8 failed): meters - the building filter is a radio `sw-segmented`, whose key carries `aria-checked` only since A11Y-AUDIT-2490 (2.48), the spec read `aria-pressed`; rooms on the phone - a person who manages no calendar gets the resident flow there (CALENDARS-UI-2310 `phoneResident`, unchanged since 2.47), not the rooms view, so the mock user is now a calendar administrator. No product change: the filter selects (rooms / schedules narrowed the lists). Runner: 8 of 8 pass at 2d62885f6 |
| 2d62885f6 | `tests/hand-switch-home-personal-2500-shots.spec.ts` (compare captures, `SW_SHOTS=1` only): the phone has no rail, so the capture presses the bottom bar's "me" (`[data-nav-me]`) there |
| caa206d62 | `pixel-home-next-2500` "wall settings tab" (`home-next-wall-settings-1440-desktop-linux.png`): HOME-NEXT wrote it on its 2.47-based branch; on the train 516 px (1%) differ, all inside the segmented keys (2.48's segmented key look). Diff image reviewed; refreshed on the runner with `--update-snapshots=changed` for that one test, then verified without `-u`: desktop + mobile **10 passed**. The other 9 baselines of the row unchanged |

## 3. Release commits

| Commit | What |
|---|---|
| c73ca77b0 | release: 2.50.0 - version (`config.yaml`, `Dockerfile`, `smplwise/__init__.py`), bilingual CHANGELOG (new / improved / fixed / how to turn it on / install), API inventory 1910 -> 1922 routes. Migrations 0217 and 0218 (additive). Bridge unchanged (0.10.8): no home-system restart |
| fdec3124b | release: 2.50.0 - rebuilt UI at d72ec0561 (every row merged; the later commits change a pixel baseline and docs only - `frontend/src` and `smplwise/` are byte-identical to d72ec0561, so the shipped `www` matches the head): `~/work/build_ui2500.sh` (a copy of `build_ui2490.sh`, run as `rel2500_tests_buildui.sh` for the slot priority), archive sha256 `5c803f5639b3a9e25d5fff66e35a83b3e70b1f9ddb122f6e95047cf2972f80a4`, copied with `ssh` WITHOUT the `sed` redaction stage and verified after the copy; 0 `.map` files, 0 `sourceMappingURL` in `www` / `www-public` (358 maps archived on the runner, `smplwise-results/sourcemaps/2.50.0`) |


## 4. Checks before the gate

Workstation (Python 3.12, Node 24.21.0, `node_modules` junction to the main checkout - the package lock equals `main`'s):

| Check | At | Result |
|---|---|---|
| `scripts/gen_wire_types.py --check` (main `.venv`) | c73ca77b0 | exit 0 |
| `scripts/sync_integration.py --check` | c73ca77b0 | up to date |
| `scripts/api_inventory.py` | c73ca77b0 | 1922 routes (1910 on 2.49.0) |
| `PYTHONUTF8=1 scripts/design_ratchet.py` | d17391f37 / 9c91fca72 | UP (color 1986, px 25612, hand-switch 163) / ok after the raise (section 2) |
| `scripts/release_check.py` | c73ca77b0 | ready for the owner's approval (only "tag v2.50.0 not yet", as expected) |
| `ruff check` of the conflict-resolved backend files (home_interface x3, test_home_interface, schedules, errors, generator, health_report, health_report_text) | per merge | all checks passed |
| ESLint on the conflict-resolved / fixed frontend files (6) | 4377d886b | exit 0 |
| TypeScript syntax parse of every changed frontend `.ts` (104) | 4377d886b | 0 errors |
| Unit spec `unit-i18n-en-ratchet-2490` | c73ca77b0 / 4377d886b | 1 failed (the syntax error, section 2) / **5 passed** - no new English gap, no ratchet raise needed |
| Backend `test_error_envelope_step0_2500` | 4377d886b | **17 passed** |
| Backend `test_i18n_backend_2490` | 4377d886b | **14 passed** |
| Backend `test_soak_edges2_2450` | 4377d886b | **4 passed** |
| Backend `test_home_interface` (conflict-resolved) | 4377d886b | **29 passed** |
| Backend `test_mb_next_2500` (schedules / plan editor conflict area) | 4377d886b | **10 passed** |
| Backend `test_wxd10_door_jobs` (DOOR-PREVIEW-I18N) | 93b28da97 | **16 passed** |
| Unit spec `unit-hand-switch-home-edit-2500` | 444dda163 | **4 passed** |
| Backend `test_notice_news_empty_2500` | 60fc78e3d / e02fc70aa | **6 passed** / **6 passed** |
| Backend `test_notice_news_feeds_2500` | db8920a06 / e02fc70aa | 2 failed, 22 passed (tests without a migrated database) / **24 passed** |
| Unit specs `unit-modal-stack-guard-2442`, `unit-icon-registries` | 8bb9d9925 | **21 passed** |
| Backend `test_app_session_fixtures_sx25::test_exchange_validation`, `test_tickets_naming`, `test_no_ip_literals`, `test_release_check`, `test_build_guards_2438` | a5b91b572 | **all passed** |
| `unused-exports.mjs --enforce` | 6bc957320 | OK (unreferenced 47, file-local 52) |
| `project_status.py --write` | - | NOT_RUN: no `management/` file changed on this train (the lead owns those) |

Runner, slot B / C / D (`~/work/slotb.sh`, priority list `rel2500_tests`), own worktrees, every pytest / Playwright temp folder under the
job's own folder and removed on exit (the runner disk filled twice on 24.11 - section 5):

| Run | At | What | Result |
|---|---|---|---|
| 1 | a2786355e | tsc x3, build, budget, unused exports, ESLint, i18n pack / phone-skip / missing keys; then the disk filled | tsc tests 3 errors, unused 6, ESLint 1 - all fixed in 38c1cfb21; the rest **NOT_RUN** (ENOSPC) |
| 2 | 0aeb1e41f | tsc x3 / vite build / budget / unused exports / ESLint / i18n split dry run / phone-skip / missing keys | **all rc 0** |
| 2 | 0aeb1e41f | Node unit suite (`--workers=2`) | 5,224 passed, **2 failed** (fixed test-only in 8bb9d9925), 12 skipped |
| 2 | 0aeb1e41f | browser specs, desktop + mobile, `--workers=2`, never `-u`: 45 files on `vite preview` / 5 on `vite dev` (home, home v3, pixel-home, notices, tickets table, schedules, meters, multi-building home) | **543 passed / 87 passed, 0 failed** (403 / 17 skipped: the specs' own project guards). NOTE: the rows' own specs list was lost when this list was rebuilt (my error); the 7 missing files ran in run 4 |
| 2 | 0aeb1e41f | backend 4 shards | stopped at ~40%: the shards' basetemps had grown to 20 GB (disk 43 -> 19 GB free) |
| 3 | 60fc78e3d | **full backend**, 4 shards, `-m "not timing_lane"`, `tmp_path_retention_policy=failed` (1,055 files) | **44,869 passed, 9 failed** (shards: 3 / 2 / 1 / 3); retry of the 9: 4 passed, 5 failed - the 5 fixed in a5b91b572 and passed on the workstation. Passed on the retry (flaky, unchanged): `test_ingest_lock_bound` (timing), `test_plan_door_tool`, `test_wire_consumption_2450` / `test_wire_routers_b_2450` `test_the_generated_client_types_are_current` (order-dependent in a long shard, seen in 2.49 too; standalone `--check` exit 0) |
| 4a | e02fc70aa | tsc x3 / build / budget / ESLint; unit suite; 12 specs (NOTICE-NEWS-EMPTY / -FEEDS evidence, HAND-SWITCH-HOME-EDIT shots, the notices / board specs, home screen, multi-building home) | all rc 0 except unused exports (`HealthKey`, fixed in 6bc957320); **unit 5,228 passed, 0 failed**; **specs 152 passed, 0 failed** |
| 4b | 8e1e42f63 | unit suite + the 7 row specs run 2 missed (camera-discovery, evidence-onvif-ui, evidence-mb-safety, evidence-mb-next, evidence-mapping-assist, evidence-gen-units-en, hand-switch-home-personal shots) | unit **5,228 passed**; specs 47 passed, **5 failed**: mb-next rooms (phone, fixed in abd271ecf), hand-switch-home-personal phone captures x2 (fixed in 2d62885f6), camera-discovery "whole flow" desktop + mobile (axe colour-contrast inside the wizard) |
| 5 | 5cc014eda (the ONVIF-UI row alone) | camera-discovery | 10 passed - the row was clean before the merge |
| 5 | 2d62885f6 | camera-discovery + evidence-mb-next + hand-switch-home-personal shots | **22 passed, 0 failed** - the colour-contrast finding did not repeat on the train either: flaky (axe measured the wizard while it was still fading in under load in 4b), not changed |
| - | - | evidence-camera-card and the other gate fixture specs, the tablet project, pixel baselines refresh | NOT_RUN here (the gate runs them; no baseline written on the train) |

Compare-page captures (lead request): `~/work/rel2500-shots/` on the runner - `newsfeeds/` (4), `newsempty/after/` (12),
`hand-switch-home-edit/` (8), `hand-switch-home-personal/` (4), `mbnext/` (28), desktop + phone, light + dark.

## 5. Lead steps before the release gate

1. Design ratchet raise (section 2, `9c91fca72`, `a5b91b572`): DECIDED by the lead on 24.11 - colour-literal 1986 and px-literal 25614 (the merged counts) are kept;
   tokenising them is a later cleanup row. Follow-up for that row: the camera wizard's "same user for all" check box is an on/off option -
   under the HAND-SWITCH-2480 rule it should be the compact switch (a row change with its own compare page).
2. MULTI-BUILDING-NEXT-2500's own branch still has the syntax error fixed in `4377d886b` (only matters if the row is rebuilt).
3. **Gate disk setting.** One full backend run with pytest's default temp retention keeps every test's `tmp_path`: the 4 shards' basetemps
   reached 20 GB at about 40% (runner free space 43 -> 19 GB in an hour; earlier the same day the runner hit 100% and every job failed with
   ENOSPC). With `-o tmp_path_retention_policy=failed` (a passed test's folder is removed at its teardown) and the basetemp + `TMPDIR`
   inside the job's own folder removed on exit, run 3's whole backend stayed under 100 MB. Recommendation: give the gate's backend
   shards `-o tmp_path_retention_policy=failed` (and a `--basetemp` it removes), and start the gate with at least 40 GB free.
4. Flaky, not changed: camera-discovery "whole flow" axe colour-contrast inside the wizard (failed once under load in run 4b, passed alone
   at the row head and at the train head); the four backend ids of run 3 that passed on the retry.

## 6. Release gate

Gate 2 on the runner, full run at `bdf28fc37` (`~/gate2/release_gate2.sh release/2500-train --full`,
`GATE_BACKEND_SHARDS=4 GATE_PW_SLOTS=8 GATE_PW_MAX_WORKERS=4 GATE_MIN_FREE_MB=3000`), finished 2026-11-24 19:20 UTC.

**PASS in 173 min.** 0 likely-real failures, 0 run faults, 0 unclear, 5 flaky (passed alone), max load 43.0.

| Job | Passed | Failed | Flaky |
|---|---|---|---|
| tsc | 1 | 0 | 0 |
| build | 1 | 0 | 0 |
| fe_static | 3 | 0 | 0 |
| release_check | 1 | 0 | 0 |
| preview | 23814 | 0 | 4 |
| dev | 1126 | 0 | 0 |
| fixture | 28 | 0 | 0 |
| visual | 72 | 0 | 0 |
| pixel | 390 | 0 | 0 |
| addon_build | 1 | 0 | 0 |
| backend | 44901 | 0 | 1 |

Flaky (failed once, passed alone):
- preview `evidence-multibuilding-home-2330.spec.ts:124` [tablet]
- preview `evidence-nav-size.spec.ts:237` [tablet]
- preview `evidence-tickets-vendor-accounts.spec.ts:146` [desktop]
- preview `evidence-mb-home-2500.spec.ts:128` [desktop]
- backend `tests/test_wire_routers_b_2450.py::test_the_generated_client_types_are_current`

Quarantine list: 0 active. Gate report on the runner: `~/smplwise-results/gate_release-2500-train_bdf28fc37.gate2.md`.

Publish (tag `v2.50.0`, `main`, `#addon`) and lab install were approved in advance by the owner (2026-11-24),
conditional on this green gate. No Home Assistant restart (bridge 0.10.8 unchanged).
