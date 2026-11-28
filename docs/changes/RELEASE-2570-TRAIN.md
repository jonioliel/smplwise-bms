# RELEASE-2570-TRAIN - the 2.57.0 train

Branch `release/2570-train`, worktree `C:\cloude\smplwise-2570train`, at `v2.56.0` (`6ea807b2e` = `origin/main`). Coordinator: the 2.57
train agent (merges, train fixes, version bump, draft changelog, registry, PC checks, runner checks, the UI rebuild at the end). The
release gate, the tag, `main` and the `addon` branch are the lead's; nothing was installed, no lab / Home Assistant / device / WisKey
contact. Rows join only when the lead names them.

## 1. Merge log

`git log --all --grep <ROW>` was checked first for each row: no row was merged anywhere else. `--no-ff`, in the lead's order; the newest
pushed head of each branch was fetched and taken (all equal to the heads the lead listed).

| # | row | head | merge commit | conflicts | notes |
|---|---|---|---|---|---|
| 1 | `pilot/FIX-WISKEY-2570` | `56a044e00` | `db08ae675` | none | WA-02, WA-03, SCR-51 (part); regenerated wire type |
| 2 | `pilot/FIX-COMMS-2570` | `f7f91d216` | `4cb3985b9` | none (`error_text_en.json` auto-merged, JSON valid, both new lines kept) | CU-01..CU-04 |
| 3 | `pilot/FIX-FE-2570` | `0c10305a3` | `a754be9bf` | none | FE-02, FE-05, FE2-17 guard; frontend only |
| 4 | `pilot/FIX-HOME-MAPS-2570` | `feaf0ba5f` | `2754db344` | none | MH-02..MH-04 |
| 5 | `pilot/FIX-CORE-DATA-2570` | `da32ee97c` | `72969b780` | none (`error_text_en.json` auto-merged, JSON valid) | CD-05, CD-02 second path, health-report counters, TR-08 part (`scripts/gate/nightly_tests.sh`: install step, section 5) |
| 6 | `pilot/FIX-FE2-2570` | `ac155879e` | `d6c7a0799` | none (`screens/devices-automations.ts` auto-merged with FIX-FE-2570's `decodeSegment`) | FE2-01..FE2-16, VD2-05; `api/run-confirm.ts`; additive `time_zone`, `bridge.integration_version`; regenerated wire types |
| 7 | `pilot/FIX-VIDEO-2570` | `5a73eb616` | `62e1ed6d7` | none (`devices-schedules.ts` and `error_text_en.json` auto-merged; FIX-FE-2570's `decodeSegment` at line 339 and FIX-VIDEO's `pageView()` both present; JSON valid) | VD-02 rest, VD-03 rest, SCR-29, SCR-54, alarm `expires_too_far`; its evidence spec ran on an earlier commit - re-run on the train (3.2) |
| 8 | `pilot/FIX-TICKETS2-2570` | `be7dce69a` | `20744741d` | none | TK2-01..TK2-04; the whole `test_tickets_costs.py` re-run on the train (3.2) |
| - | train fixes | - | `d8cf27b59`, next commit | - | section 2 |
| - | version bump / draft changelog / API inventory | - | `83927b8d2` | - | 2.57.0 in `config.yaml`, `Dockerfile` label, `smplwise/__init__.py`; CHANGELOG 2.57.0 section on top, DRAFT in an HTML comment (heading clean, as on the earlier trains), English with a Hebrew summary placeholder (the lead writes the bilingual text); `contracts/API_INVENTORY.md` version line |
| - | registry | - | `d832d0166` | - | section 4 |

## 2. Train fixes

- `d8cf27b59`: FIX-HOME-MAPS-2570's last commit (`feaf0ba5f`) also committed `m5.txt` at the repository root - the text of its own
  commit message (a leftover of `git commit -F`). Removed; nothing refers to it.
- unused-exports ratchet (runner, at `9a7540f68`): FIX-HOME-MAPS-2570 added three exports used only in their own file -
  `doorJammed` (`home/home-logic.ts`), `TargetSend` / `TargetZone` (`home/home-target.ts`). The `export` keyword dropped (file-local), as
  on the 2.56 train; no caller outside the file, none in the tests.
- PENDING (lead, 28.11; after FIX-MAPS2-2570 is merged): the simple home screen's scene buttons (`home/home-actions.ts`) move to
  FIX-FE2-2570's `api/run-confirm.ts` and the unknown-outcome classification (a lost answer = amber unknown, not a failure; after a run
  "request sent", not "scene ... ran"), with a unit test.

## 3. Checks

### 3.1 PC (Windows 11, venv of the main checkout, one process at a time)

Batch 1 (rows 1-4, at `d832d0166`):

| check | exit | result |
|---|---|---|
| `gen_wire_types --check` / `error_contract_inventory --check` / `i18n_backend_errors` / `wire_ratchet` / `request_strict_ratchet --check` | 0 each | match / 0 legacy 422 sites / 2332 texts, 0 without English / 897 = baseline / 144 tolerant models |
| `sync_integration --check` / `build_guide --check` / `design_ratchet` / `migration_downgrade_check --from origin/release/2570-train` | 0 each | up to date / up to date / no count above baseline / PASS (no migration added) |

tsc, typecheck, eslint, unused-exports, vite build, ruff and all tests: on the runner (3.2), not on the PC (memory).

### 3.2 Runner (`~/work/p2570_train_check.sh <ref>`, then `p2570_train_check2.sh`, slot B)

Run 1 at `9a7540f68` (rows 1-5): `tsc` app 0 errors, `npm run typecheck` 0, `npm run lint` 0, `vite build` 0; **unused-exports FAILED**
(3 new file-local exports of FIX-HOME-MAPS-2570 - fixed in the train, section 2); the Node unit specs did NOT run (the job used
`playwright.config.ts`, which waits for its web server - a harness fault of the job, corrected in `p2570_train_check2.sh`:
`-c playwright.unit.config.ts`); page specs `fix-fe-2570` + `ha-feed-counters-2570` (desktop, vite preview): 6 passed. Backend, one
process per file, all exit 0: `test_fix_wiskey_2570` 7, `test_calendar_far_series_fail_closed_2570` 3, `test_comms_utilities_fix_2570` 6,
`test_i18n_errors_en_2520` 9, `test_i18n_runtime_errors_2520` 8, `test_area_honest_count_2540` 35, `test_area_row` 34,
`test_wiskey_schedule_execution_2530` 21, `test_wiskey_visit_filters_2560` 6, `test_fix_core_data_2570` 14,
`test_nightly_coverage_lane_2570` 3, `test_legacy_import_2550` 18, `test_ha_state_reconcile_2550` 10, `test_core10_eventloop_2560` 11,
`test_singletons_registered` 4, `test_version` 1, `test_release_notes_marker` 8 passed. `ruff check smplwise`: all checks passed.

Run 2: PENDING

## 4. Registry

`management/tasks.json`, `requirements.json`, `test_catalog.json`: the rows as REVIEW (R-<id>-1 PLANNED, AT-<id>-1 NOT_RUN) with row
head and merge commit; RELEASE-2570-TRAIN IN_PROGRESS. `py -3.12 scripts/project_status.py --write`: PASS (784 tasks, 898 requirements after row 5);
regenerated views committed.

## 5. Install steps (the lead, before the gate / the next nightly)

1. FIX-CORE-DATA-2570 changed `scripts/gate/nightly_tests.sh` (the report-only coverage lane, TR-08 part): refresh the runner's
   installed copy `~/nightly_tests.sh` from the repository (the row did not install it). Until then the nightly runs without the lane.

## 6. Open points

1. More fix rows from the lead (FIX-MAPS2, FIX-GATE, FIX-AUTOMATION, FIX-CORE2, FIX-WISKEY2, FIX-VIDEO2, maybe the review-2 rows); each adds CHANGELOG lines and a registry entry.
2. UI rebuild (`npm run build:addon` on the runner) only after the lead's "all rows in", then the gate (the lead's).
3. RELEASE-2560-TRAIN is still IN_PROGRESS in the registry although 2.56.0 is released; left to the lead.
