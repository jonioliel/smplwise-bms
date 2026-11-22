# RELEASE-2450-TRAIN - the 2.45.0 train

Branch `release/2450-train`, cut from `origin/main` = tag `v2.44.0` (`51da93753`) on 19.11.2026 (~17:50 Israel) in the worktree
`C:\cloude\smplwise-2450train`. Owner standing rule (18.11 night): one train and one release gate per version, fix forward with targeted
re-runs. Phase 1 refreshed the pixel baselines of the UI leaf branches on the runner, inside each branch (owner rule 30.10); phase 2
assembled the train; phase 3 (the late heads, version, built UI, release gate) follows on the lead's go.

## 1. Phase 1 - the UI leaf branches on the runner

Runner, one worktree per leaf (`~/work/t2450-<leaf>`), `nice -n 19`, preview build, `--workers=2`, `--retries=1`, never `-u` in the check.
Every spec file with a Linux baseline (51-52 files, all projects) plus the leaf's own browser specs. Each failed screenshot looked at as
an expected / actual crop; `-u` only for the intended look of the branch, then re-verified without `-u`.

| Leaf | Head before -> after | Pixel check | Found | Baselines refreshed |
|---|---|---|---|---|
| `pilot/CR-CMP2-TABLES-CONSUMPTION-2450` | 9949182e8 -> 69f589cd9 | 799 passed, 518 skipped, 1 flaky, 2 failed (the expected AUDIT30-E pair) | **layout regressions at 768 / 1024 px**: the meters table 57 px and the accounts table 37-65 px wider than their cards (`layout-electricity-meters`, `layout-electricity` full sweep - the PC run had used the quick 4-width sweep). Fixed in the branch: 4da59fb3a, 9788c48c4, df9c0078c (the module's 1099 / 1100 px step-out edge, state cells and long titles may wrap) | `layout-audit30-e-infra` `audit30e-elec-meters-1440`, `audit30e-water-1440` (2) |
| `pilot/CR-CMP2-TABLES-GENMAINT-2450` | 66ab050fd -> eb580f6f2 (note only) | 801 passed, 518 skipped, 1 flaky, 0 failed | nothing; its NOT_RUN browser specs 123 passed / 1 flaky; `layout-noscroll-1366 -g generator` 4 passed | none |
| `pilot/CR-CMP2-SEGMENTED-C-2450` (contains SELECTS, SEGMENTED-B) | e2dbca4f4 -> c612c5ce1 | 744 passed, 518 skipped, 52 failed | 51 intended; **one regression**: visual-matrix devices-schedules at 1440 - the glass state strip's counts became pills, the toolbar wrapped and the list lost a row. Fixed in 3ccdd80c5 (`--sw-seg-count-fs / -pad / -min-w`, the glass mapping keeps plain figures) | 56 (list in the branch's note); after the refresh the 9 files without `-u`: 204 passed, 2 flaky, 0 failed |
| `pilot/CR-RESPONSE-MODELS-FOLLOWUP-2450` | 9aa95dd10 (unchanged) | 783 passed, 518 skipped, 1 flaky, 0 failed | the three home specs that timed out on the PC (`home-v3-followup-a:79/:118`, `home-v3-p3:109`) + both files and `home-v3-auditfix-2437`: 50 passed, 0 failed (desktop-only specs) | none |

The flaky ones were screenshot protocol errors / load (visual-matrix state-panels, devices-schedules dark at 9aa95dd10, wkwater,
maintenance empty states), each passed on retry. The shared SELECTS / TABLES specs agreed in every leaf (no train-level refresh needed).

## 2. Phase 2 - what merged (in this order)

| # | Branch | Head | Merge | Conflicts |
|---|---|---|---|---|
| 1 | `pilot/CR-FEED-BASE-2450` | 90e84cef0 | d7b60057e | none |
| 2 | `pilot/CR-SHELL-EXTRACT-B-2450` | 36f1f259a | 046f79e29 | none |
| 3 | `pilot/T068-EDGE-2450` | ea11213fb | d4c753323 | none |
| 4 | `pilot/CR-FE-COMPLEXITY-2450` | 2e78ed54d | 1529833a0 | none |
| 5 | `pilot/CR-BE-COMPLEXITY-2450` | e5b7ab627 | aed422b09 | none |
| 6 | `pilot/CR-ROUTER-SQL-2450` | 0a5d0431e | c1481bc53 | none |
| 7 | `pilot/TASKS-SYNC-1911` | af6de42d2 | 0df679973 | none; `py -3.12 scripts/project_status.py --write` afterwards: PASS (623 tasks, 737 requirements), no view changed beyond the timestamp (not committed) |
| 8 | `pilot/CR-CMP2-TABLES-CONSUMPTION-2450` (contains SELECTS, TABLES) | 69f589cd9 | 4839f587a | none |
| 9 | `pilot/CR-CMP2-TABLES-GENMAINT-2450` | eb580f6f2 | 287b46065 | none |
| 10 | `pilot/CR-RESPONSE-MODELS-FOLLOWUP-2450` (contains RESPONSE-MODELS-CONSUMPTION) | 9aa95dd10 | 677080eee | 3 files, below |
| 11 | `pilot/CR-CMP2-SEGMENTED-C-2450` (contains SEGMENTED-B) | c612c5ce1 | 8f046f3b9 | 2 files, below |

Every head was checked against `origin` before its merge; `git rerere` recorded each resolution.

- Merge 10, `electricity/elec-account-list.ts`, `elec-account-page.ts`, `elec-bills-table.ts`: TABLES-CONSUMPTION moved these tables to
  `sw-table`, FOLLOWUP changed the same cells of the hand-built tables to the null-safe formatters. The sw-table side, with FOLLOWUP's
  values in the column renders (`customerName()`, `f2or()`, `ilsOr()`, the phone list's end reading through `readingText()`).
- Merge 11, `electricity/elec-wizard.ts`: the customer key on `sw-segmented` (SEGMENTED-C) with the edit note's name through
  `customerName()` (FOLLOWUP). `generator/gen-log-page.ts`: SEGMENTED-C dropped `.lg .seg button`, GENMAINT dropped `.lg td .why` -
  both rules gone.

## 3. Fix commits on the train

| Commit | What |
|---|---|
| (this note's commit) | unused-exports gate on the merged tree: `ChipChoiceOption` (sw-chip-choice) file-local; `styles/fragments.ts` `segTrackStyles` removed (its three screens draw `sw-segmented`; tsc TS6133 once file-local) |

## 4. Tests actually run (phase 2)

Python 3.12 (main checkout `.venv`), Node 24.21.0, `frontend/node_modules` junction to the main checkout (it now has ESLint).

| Check | At | Result |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` / `tsconfig.tests.json` / `tsconfig.scripts.json` (PC) | 0df679973 (non-UI merges) | exit 0 / 0 / 0 |
| ESLint `eslint src --pass-on-unpruned-suppressions`, `unused-exports --enforce` (PC) | 0df679973 | exit 0; OK |
| tsc app + ESLint on the conflict files (PC) | 677080eee, 8f046f3b9 | exit 0; clean |
| tsc tests / scripts, ESLint `src`, `i18n-split-langs.mjs`, `unused-exports --enforce` (PC) | 8f046f3b9 | exit 0 / 0; clean; moved 0 tables; **FAIL** 2 new file-local exports -> e0ae5185b -> OK |
| Runner (`~/work/t2450-train`, nice 19): `ruff check smplwise`, `scripts/gate/lint_backend.py --gate` | 8f046f3b9 | All checks passed; 0 findings |
| Runner: every spec file with a Linux baseline (52 files, all projects, workers 2, retries 1) | 8f046f3b9 | **804 passed, 518 skipped, 1 flaky, 0 failed** (24.7 min; flaky: `evidence-wiskey-installer:269` desktop) |
| Runner: Playwright unit config, all `unit-*.spec.ts`, workers 2, retries 1 | 8f046f3b9 | **5048 passed, 8 skipped, 1 flaky, 0 failed** (5.4 min; flaky: `unit-video-sub-fallback-2402:68`, `document.baseURI` under a parallel worker) |
| Runner: backend in 2 shards, nice 19 | 8f046f3b9 | NOT_RUN to the end: at nice 19 under the other agents' load it reached ~2 % in 31 min; stopped by me (my processes) - the release gate runs the full backend (`--full`) |
| `scripts/gen_wire_types.py --check` (PC, `.venv`) | d52b07e37 (after the late merges) | exit 0 (the generated client types are current) |
| backend `test_version` + `test_release_notes_marker` | 04cf44d1b | 9 passed |
| tsc app / tests, `unused-exports --enforce`, ESLint `src` (PC) | 04cf44d1b | exit 0 / 0; OK; clean |
| `bundle-budget.mjs --dir ../smplwise_vms/www --enforce` | 521165ad4 | entry raw 2,810,141 B, gzip 807,666 B (2.44.0: 801,784 B); budget gzip 1,102,000 - OK; 0 `.map` |

## 5. Phase 3 - the late heads, version, built UI

Lead's go (19.11 evening): ROUTER-SQL-C and ROUTER-SQL-HA move to 2.46.0.

| # | Branch | Head | Merge | Conflicts |
|---|---|---|---|---|
| 12 | `pilot/CR-ROUTER-SQL-B-2450` | 205434ecc | 41cf1fbae | none |
| 13 | `pilot/CR-RESPONSE-MODELS-B-2450` (contains RESPONSE-MODELS-CONSUMPTION, based on ROUTER-SQL) | 06ac1f108 | 6e700fd2c | none |
| 14 | `pilot/CR-BE-COMPLEXITY-B-2450` | febb78d37 | d52b07e37 | none |

| Commit | What |
|---|---|
| 04cf44d1b | release: 2.45.0 - version (`config.yaml`, `Dockerfile`, `smplwise/__init__.py`), CHANGELOG (bilingual), API inventory (1910 routes, unchanged). No migration (0216 stays the last); bridge stays 0.10.7 |
| 521165ad4 | release: 2.45.0 - rebuilt UI at 04cf44d1b (`~/work/build_ui2450.sh`, rc=0; 324 maps archived to `~/smplwise-results/sourcemaps/2.45.0`; tarball sha256 `c3d2a426...ff99970c5b` checked after the copy; 0 `.map`, 0 `sourceMappingURL`) |

## 6. Release gate

Run 1: `~/wait_gate_2450.sh` -> `GATE_EARLY_FAILFAST=continue GATE_TOTAL_SECS=12000 nice -n 10 ~/gate2/release_gate2.sh release/2450-train
--full` (base v2.44.0, no selection: the full tier L with the full backend, as the lead asked for BE-COMPLEXITY-B's per-test resets) on
521165ad4, started 18:58 UTC after push_watch released the shared tests lock (~4 min).

**Run 1 result (521165ad4, 182 min wall, load up to ~36): FAIL** - 0 hard failures, 11 test failures, 57 flaky (failed once, passed
alone). Counts: preview 22,948 passed; dev 1,122; fixture 28; visual 72 (0 changed); pixel 368; backend 27,519 passed, 2 failed, 6
flaky; tsc, build, fe_static (ESLint, bundle budget, unused exports), release_check, addon_build (Supervisor-like image) PASS.

| Failure | Cause | Fix |
|---|---|---|
| backend `test_singletons_registered` (twice) | merge interaction: `smplwise.wire._REPORTED` (the response-model package's once-per-drift log set, RESPONSE-MODELS-CONSUMPTION / -B) is module state; BE-COMPLEXITY-B's inventory now sees module-level tables | bbe953488: registered with `test_reset` |
| backend `test_fake_doorwin_closed_rule_sr1::test_open_primitives_are_pinned` (twice) | merge interaction: `smplwise/wire/elevators.py` names `door_open` - the `ElevatorState` literal of the response type (RESPONSE-MODELS-B); reviewed against SR-1: sends nothing | bbe953488: pinned beside `services/elevators.py` |
| backend `test_rbac_camera_scope::test_audit_grant_is_the_one_behind_the_action`, `test_health_report_char_2450` (flaky: failed in the shard, passed alone) | order leaks: a grant left in the main context by an earlier `require()`; a job state left failed by an earlier test (`default_no_probe` came out `error`) | bbe953488: `rbac._GRANTS` registered with `test_reset`; the characterisation starts the four unregistered job states from import-time values |
| backend `test_wire_consumption_2450` water replace (422 "replacement before the counter life began"), `test_plan_detect_baseline` (60 s against a 15 s budget) | flaky: passed alone (timing / load) | not changed |
| `evidence-audit30g-video:118` /investigate/incidents, 3 projects x light / dark | stale spec: it counted the filled `sw-badge` in the screen's shadow root; the recent-incidents table is `sw-table` (CR-CMP2-TABLES-2450) and draws its badges inside the table's shadow root | 2fc919837: the spec reads both roots (still checks every badge's contrast) |
| `evidence-events-polish:106` desktop + tablet (`tr.selected` stayed on e21 after Down) | **product regression** (merge of TABLES into the event centre's keyboard rule): the focused `sw-table` row walks the rows and marks Up / Down handled; the screen's window handler skipped handled keys, so Down no longer moved to the next event with the drawer open | 2fc919837: the screen still moves the selection on Up / Down from its `sw-table` (focus and selection move together); Enter / Escape unchanged |
| `evidence-temperature:579` mobile (a 28 px key, 44 px expected) | **product regression** of SEGMENTED-C: the report's language / layout keys on `sw-segmented` lost the 44 px phone key of the hand-built `.seg` | 2fc919837: `--sw-seg-h: 44px` under 600 px |

Fix forward, verified before the re-run: PC - the four backend files + `test_wire_consumption_2450` + `test_rbac`: 132 passed; ruff on the
four files clean; ESLint on the two source files clean; `tsc -p tsconfig.tests.json` exit 0. Runner (`~/work/t2450-train` at 2fc919837,
preview build): `evidence-events-polish`, `evidence-temperature`, `evidence-audit30g-video`, all projects: 138 passed, 6 skipped, 0 failed.
b643e8e7a: UI rebuilt at 2fc919837 (`build_ui2450.sh` rc=0, 324 maps archived, tarball sha256 `8e40a7b1...4327cff3`, 0 `.map`, entry gzip
807,673 B, budget OK).

The 57 flaky ones of run 1 (each passed alone; listed in `gate_release-2450-train_521165ad4.gate2.md`) were mostly timeouts and
visibility waits of a 3-hour run at load 25-36 (tickets evidence, the design-foundation mobile matrix, 3D plan, frigate review layout,
dropdown first paint, calendars messages, ...).

| Run | Sha | Result |
|---|---|---|
| 1 - `release_gate2.sh release/2450-train --full` (base v2.44.0, full tier, full backend) | 521165ad4 | **FAIL** (above) |
| fix forward | bbe953488 (backend), 2fc919837 (frontend), b643e8e7a (UI rebuilt) | - |
| 2 - targeted (`--after gate_release-2450-train_521165ad4.json`, base 521165ad4; selection: backend 1016 / 1016 files, frontend 122 / 1184 specs, pixel 3 mapped specs) | b643e8e7a | **PASS** in 47 min: 0 hard, 0 test failures, 1 flaky; backend 27,526 passed, 1 flaky; preview 2,629; dev 24; visual 72 (0 changed); pixel 7; tsc, build, fe_static, release_check, addon_build PASS |

Run 2's flaky one: `test_singletons_registered` failed in its shard and passed alone - `smplwise.services.wiskey_readback._LAST` is `None`
at import and a dict after a negotiation, so the inventory saw it only after another test had set it. Fixed on
`pilot/FIX-SINGLETON-READBACK-2460` (6a4523308, a per-test reset; `test_singletons_registered.py` 4 passed) for 2.46.0 - left out of this
train because the gate had already passed and it changes tests only.

Release decision basis: run 1 (full tier) + run 2 (targeted on the fixes), the gate tool's own rule (as 2.43.8 / 2.43.9 / 2.44.0).
`scripts/release_check.py` at b643e8e7a: only `[FAIL] git tag v2.45.0 not yet`; RESULT: ready for the owner's approval.

## 7. Release - NOT done by this agent

Main push, tag `v2.45.0`, `#addon` refresh and the lab install + read-only probe: the lead runs them (the owner pre-approved 2.45.0,
"מאושר", relayed by the lead). Same steps as 2.44.0: `git push origin release/2450-train:main` (fast-forward from 51da93753), `git tag -a
v2.45.0` on the train head + push, `#addon` refresh (strip only `//# sourceMappingURL` lines), lab install + read-only probe.

Not in 2.45.0 (lead): `pilot/CR-ROUTER-SQL-C-2450`, `pilot/CR-ROUTER-SQL-HA-2450` -> 2.46.0.
