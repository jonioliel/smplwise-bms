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
| 9 | `pilot/FIX-AUTOMATION-2570` | `0a95b58dd` | `a6f7d290d` | none (`routers/ha.py`, `error_text_en.json` auto-merged; JSON valid) | backend only; contract check with FIX-FE2-2570: section 2.1 |
| 10 | `pilot/FIX-WISKEY2-2570` | `9e5eb8f97` | `24cf3d2e9` | none | backend only: emergency release by the releaser, managed install restart, write lineage |
| 11 | `pilot/FIX-CORE2-2570` | `4bee4fbbf` | `077b7b87e` | none (`Dockerfile` auto-merged: the 2.57.0 label and the multi-arch default both present) | e-mail, monthly reports, access digest DST, legacy aliases, multi-arch `BUILD_FROM` default + `release_check.py` base-image rule, 0215 comment-only rollback note |
| 12 | `pilot/FIX-MAPS2-2570` | `f65f94aa5` | `3875ea848` | none (auto-merged: `routers/ha.py`, `wire/ha.py`, generated `wire-ha.ts`, `api/ha.ts`, `home/home-recordings.ts` (FE-05 `decodeSegment` and MH2-08 `flip` both kept), en `msg/screens.ts`, `error_text_en.json`); `gen_wire_types --check` 0 on the PC after the merge | MH2-01..MH2-09; based on FIX-HOME-MAPS-2570. Follow-up head `da5562f3f` (change note only: its backend tests re-ran at `f65f94aa5`, 124 passed) merged `7ad615768` |
| 13 | `pilot/FIX-VIDEO2-2570` | `164279e7d` | `768d0447b` | none (`routers/nvr_write.py` auto-merged: FIX-VIDEO-2570's settings-write outcome and FIX-VIDEO2's `set_smart` / `smart_partial_error` both present); `gen_wire_types --check` 0 on the PC after the merge | VD2-02, VD2-04, VD2-06..VD2-11 |
| - | train fixes | - | `d8cf27b59`, next commit | - | section 2 |
| - | version bump / draft changelog / API inventory | - | `83927b8d2` | - | 2.57.0 in `config.yaml`, `Dockerfile` label, `smplwise/__init__.py`; CHANGELOG 2.57.0 section on top, DRAFT in an HTML comment (heading clean, as on the earlier trains), English with a Hebrew summary placeholder (the lead writes the bilingual text); `contracts/API_INVENTORY.md` version line |
| - | registry | - | `d832d0166` | - | section 4 |

## 2. Train fixes

- `d8cf27b59`: FIX-HOME-MAPS-2570's last commit (`feaf0ba5f`) also committed `m5.txt` at the repository root - the text of its own
  commit message (a leftover of `git commit -F`). Removed; nothing refers to it.
- unused-exports ratchet (runner, at `9a7540f68`): FIX-HOME-MAPS-2570 added three exports used only in their own file -
  `doorJammed` (`home/home-logic.ts`), `TargetSend` / `TargetZone` (`home/home-target.ts`). The `export` keyword dropped (file-local), as
  on the 2.56 train; no caller outside the file, none in the tests.
- `1b29221ef` (FIX-AUTOMATION-2570 VD2-01): 403 `forbidden` / `scene_members_unknown` reused the generic sentence of
  `ascope.unknown_effects` ("the item has actions not known in advance ..."). New key `ascope.scene_members_unknown` (Hebrew + English,
  `services/automation_scope_text.py`): "לא ידוע אילו מכשירים הסצנה מפעילה (ההגדרה שלה אינה קריאה). הפעלתה דורשת הרשאה לשלוט במכשירים,
  לפתוח דלתות ולנטרל את האזעקה בכל ההתקנה." / "It is not known which devices this scene sets (its definition cannot be read). Running it
  needs the permissions to control devices, open doors and disarm the alarm in the whole installation." `unknown_scene_reasons` uses
  it; `test_vd2_01_...` asserts it (one added line).
- unused-exports ratchet (runner run 2 at `553194542`): two more file-local exports - `RunConfirmed` (`api/run-confirm.ts`, FIX-FE2-2570)
  and `CursorPage` (`tickets/late-answer.ts`, FIX-TICKETS2-2570); `export` dropped (types used only inside their file).
- Design ratchet (PC at `553194542`): px-literal 25513 -> 25516 - FIX-FE2-2570's `.scene-note` (`margin-block-start: 6px`,
  `screens/area-quick-sheet-css.ts`) and FIX-CORE-DATA-2570's counters list (`margin:6px ...;padding-inline-start:18px`,
  `screens/system-diagnostics.ts`). Written on the spacing scale with the same values (`calc(var(--sw-s-1) * 1.5)` = 6px,
  `calc(var(--sw-s-3) * 1.5)` = 18px): no look change, ratchet back to 25513 without a baseline raise. (Run with `PYTHONUTF8=1` on the PC:
  without it the ratchet's per-file lines read the base files as cp1255 and print wrong "0 -> n" counts; the total is right either way.)
- Home screen scene buttons (lead, 28.11; after FIX-MAPS2-2570): new pure helper `home/home-scene-run.ts runHomeScene` = FIX-FE2-2570's
  `api/run-confirm.ts runConfirmed` + `api/physical-outcome.ts` (a lost answer - no answer, 504 `config_timeout` with
  `details.outcome = unknown`, a 5xx - is `unknown`, never "did not run", never re-sent; a refusal carries the server's sentence).
  `home-actions.ts applyScene(s, ask)` uses it (it used to send `confirm` only for a scene the list marked sensitive, with no answer to a
  409); `HScene.unknownEffects` (from the list's `unknown_effects`) is asked about first like `sensitive`. `sw-home.ts a_scene`: the home's
  own question overlay is the `ask` (asked before the press for a sensitive / unknown-effects scene; for a 409 `confirmation_required` the
  overlay opens and "close" answers no - the `ask` overlay gained an optional `no`); after a run the toast says "הבקשה להפעלת {name}
  נשלחה" (was "סצנת {name} הופעלה"; the English entry replaced), an unknown outcome an amber toast "לא ידוע אם הסצנה הופעלה · בדקו
  במקום" (`toast(text, undo, 'warn')` -> `.toast2[data-tone="warn"]`, an em outline of the home's warning colour; no px literal). The
  resting look is unchanged (no baseline refresh). Test: `frontend/tests/unit-release-2570-home-scene.spec.ts` (node: ask / 409 /
  unknown / refusal paths, one send each, and the wiring in the two files).

### 2.1 The scene / script contract, FIX-AUTOMATION-2570 (server) against FIX-FE2-2570 (client), read on the merged train

| server answer | client (scenes panel, launcher, area quick sheet; scripts panel) |
|---|---|
| request field `confirm: true`, same `client_request_id` | `api/run-confirm.ts runConfirmed`: asks first for a `sensitive` / `unknown_effects` item; otherwise sends once and, on 409 `confirmation_required`, asks and sends ONE more time with `confirm: true` and the same id; "no" sends nothing |
| 403 `grant_required` (`details.grant`, `entity_id`, `path`) | `mapAutomationError` (`api/automations.ts`) reads `grant` / `path`; red refusal with the server's sentence (`physicalOutcome` = refused) |
| 403 `step_up_required` | the global step-up dialog of `api/client.ts` / `shell/step-up.ts` (FE2-03: a late confirmation answers "press again", nothing re-sent) |
| 403 `forbidden`, `details.reason = scene_members_unknown` | red refusal with the server's `user_message` - now its own sentence (train fix above), Hebrew / English by the request language |
| 504 `config_timeout`, `details.outcome = unknown` | `physicalOutcome` -> `unknown` (the structured outcome wins): amber "לא ידוע אם הסצנה הופעלה · בדקו במקום" (scenes), `.l-note.warn` (launcher), `qcSceneUnknown` (quick sheet); `runConfirmed` never re-sends it |

The simple home screen's own scene buttons follow the same rule since the train fix in section 2.

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
2. FIX-CORE2-2570 changed `scripts/release_check.py` (base-image rule: the Dockerfile default must be the multi-arch
   `base-python:<build.yaml tag>`) - an engine file of the gate; install it with the gate engine as on the 2.56 train.

## 6. Open points

1. Rows still to come (the lead's list, 28.11): FIX-GATE-2570, FIX-AUTOMATION2-2570 (based on FIX-AUTOMATION), FIX-CALENDAR-2570 and FIX-UTIL-A-2570 (both based on FIX-COMMS), FIX-UTIL-B-2570, FIX-SECURITY2-2570, FIX-PHONEKEY-2570; each adds CHANGELOG lines and a registry entry.
2. UI rebuild (`npm run build:addon` on the runner) only after the lead's "all rows in", then the gate (the lead's).
3. RELEASE-2560-TRAIN is still IN_PROGRESS in the registry although 2.56.0 is released; left to the lead.
