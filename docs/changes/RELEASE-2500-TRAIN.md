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
| - | `pilot/NOTICE-NEWS-EMPTY-2500` | - | - | not pushed yet |
| - | `pilot/NOTICE-NEWS-FEEDS-2500` | - | - | not pushed yet |
| - | `pilot/RESPONSE-MODELS-E-2500` | - | - | not pushed yet |

## 2. Fix and housekeeping commits on the train

| Commit | What |
|---|---|
| 9c91fca72 | Design ratchet (`scripts/design_ratchet_baseline.json`) raised with `--update --allow-raise` in its own commit; **kept by the lead's decision (24.11)** - tokenising these literals is a later cleanup row, not a blocker. The rows were cut from 2.47.0 and checked against its baseline (color 2497, px 25485, hand-switch 359); 2.48.0 lowered it afterwards. Per file, `origin/main` (v2.49.0) -> train (`design_ratchet.py --files`, both trees): **color-literal 1984 -> 1986**: `home/home-styles-extra.ts` 0 -> 1 (HOME-FAVORITES-2500: the fallback shadow inside `var(--hs-shadow-3, 0 12px 32px rgb(0 0 0 / .35))` of the lifted favourite tile while dragging, Q77), `home/home-wall-rest-styles.ts` 0 -> 1 (HOME-WALL-NIGHT-2500: `#000` of the night dimming layer `.wdim`, Q73). **px-literal 25462 -> 25612**: `components/camera-discovery-dialog.ts` 0 -> 87 (ONVIF-UI-2500: the new "find cameras on the network" wizard), `home/home-wall-rest-styles.ts` 0 -> 43 (HOME-WALL-NIGHT-2500: the new wall panel rest screen and takeover), `home/home-styles-extra.ts` 68 -> 80 (HOME-FAVORITES-2500: the "+ add" hole cell and the drag lift / drop outline, Q77-Q78), `home/sw-home-admin.ts` 91 -> 99 (the wall panel settings tab: HOME-WALL-NIGHT-2500 +7, HOME-NEXT-2500 +1 for the "new for" setting). hand-switch was raised 161 -> 163 here (camera-discovery-dialog +3, sw-home-personal -1) and lowered back to 161 in c33d4cd4e. Every other count unchanged |
| 4377d886b | `en/i18n/msg/system-b.ts`: MULTI-BUILDING-NEXT-2500's building filter note ("the plan editor's device search") closed its single-quoted string early - a syntax error that breaks esbuild / vite on the merged tree and on the row itself (found by `unit-i18n-en-ratchet-2490`). Escaped. A TypeScript parse of the 104 frontend `.ts` files the train changes finds no other syntax error |
| c33d4cd4e | Design ratchet hand-switch 163 -> 161 (`--update`, as HAND-SWITCH-HOME-EDIT-2500's note recommends): that row turns the home editor's widget on / off check boxes into the compact switch, so the merged count equals the 2.49.0 baseline again. The camera wizard's "same user for all" box stays a check box for now (see section 5) |
| 38c1cfb21 | Static checks of the merged tree (runner job at a2786355e): `screens/devices-building.ts` - HAND-SWITCH-HOME-EDIT-2500 lost the space between `.draft=${d}` and `.candidates=` when it added `?busy=`, so lit bound `${d}.candidates=${...}` as one string to `.draft` and never set `.candidates` (a real bug; ESLint `lit/no-invalid-html`) - space restored. `unused-exports --enforce`: 6 new file-local exports (`BfChoice` MB-NEXT, `NoticeAge` HOME-NEXT, `NightDim` / `Takeover` / `ALARM_TAKEOVER` / `URGENT` HOME-WALL-NIGHT) - `export` dropped, no run-time change. `tsc -p tsconfig.tests.json` (test-only): `home-wall-night-2500.spec.ts` route callback typed `Promise<void>` while `page.route` answers `Promise<Disposable>` on Playwright 1.63 -> `Promise<unknown>`; `evidence-mb-home-2500.spec.ts` two `expect()` joined by `&&` -> two statements. Workstation after the fix: ESLint 0 errors, `unused-exports --enforce` OK (47 / 52) |

## 3. Release commits

| Commit | What |
|---|---|
| c73ca77b0 | release: 2.50.0 - version (`config.yaml`, `Dockerfile`, `smplwise/__init__.py`), bilingual CHANGELOG (new / improved / fixed / how to turn it on / install), API inventory 1910 -> 1922 routes. Migrations 0217 and 0218 (additive). Bridge unchanged (0.10.8): no home-system restart |
| - | release: 2.50.0 - rebuilt UI (pending: after the last row boards) |

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
| `project_status.py --write` | - | NOT_RUN: no `management/` file changed on this train (the lead owns those) |

Runner (slot B/C via `~/work/slotb.sh ~/work/rel2500_tests.sh origin/release/2500-train ~/work/rel2500_specs.txt`, own worktree
`~/work/rel2500`, results `~/work/rel2500-out/`), run 1 at a2786355e, started 11:30Z (after ~1.5 h in the slot queue):

| Check | Result |
|---|---|
| `tsc -p tsconfig.json` / `tsconfig.scripts.json` | exit 0 / 0 |
| `tsc -p tsconfig.tests.json` | 3 errors (two stale spec typings) - fixed in 38c1cfb21, NOT re-run |
| `vite build` / bundle budget | rc 0 (29 s) / OK |
| `unused-exports.mjs --enforce` | FAIL (6 file-local) - fixed in 38c1cfb21, OK on the workstation |
| ESLint `src` | 1 error (devices-building.ts, a real bug) - fixed in 38c1cfb21 |
| `i18n-split-langs.mjs --dry` | 0 tables to move (the pack index regenerated at the ONVIF-UI merge is current) |
| `check:phone-skip` / `i18n_missing_keys.mjs` | ok / rc 0 |
| Node unit suite, rows' browser specs (50 files, desktop + mobile), full backend in 4 shards | **NOT_RUN - BLOCKED: the runner's disk is full** (`/` 100%, 72 MB - 889 MB free; `ENOSPC` on every write; the backend shards answered `E` on every test that writes). The job was stopped and its temp folders and `dist` removed; nothing else touched (the space is held by `~/work` ~159 GB and `/tmp/pytest-of-sw` 7.6 GB of other jobs) |

## 5. Lead steps before the release gate

1. Design ratchet raise (section 2, `9c91fca72`): DECIDED by the lead on 24.11 - colour-literal 1986 and px-literal 25612 are kept;
   tokenising them is a later cleanup row. Follow-up for that row: the camera wizard's "same user for all" check box is an on/off option -
   under the HAND-SWITCH-2480 rule it should be the compact switch (a row change with its own compare page).
2. MULTI-BUILDING-NEXT-2500's own branch still has the syntax error fixed in `4377d886b` (only matters if the row is rebuilt).
