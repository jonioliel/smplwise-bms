# CR-W3B-FE-COMBINED-2443 - the wave 3B frontend chain on the 2.43.8 train

Branch: `pilot/CR-W3B-FE-COMBINED-2443` (the inventory `private/planning/REMAINING_WORK_2026-11-18.md` section A3 names it
`CR-W3B-FE-COMBINED-2444`). Worktree `C:\cloude\smplwise-w3bfe`. Candidate for 2.43.9.

Base: `origin/release/2438-train` at `c68904139` (release: 2.43.8 - rebuilt UI at 04f735276), the head while the 2.43.8 release
gate runs on it. Later fix commits on the train are merged in by the lead.

## Merges (each `git merge --no-ff`)

| # | Branch | Head | Conflicted files | Hunks | Commit |
|---|---|---|---|---|---|
| 1 | `pilot/CR-FE-PROMISES-2442` (FE-1 CSS-FRAGMENTS-TAIL -> FE-2 GLASS-HELPER -> FE-3 STRUCT-CSS-SPLIT -> FE-4 FE-NITS -> FE-5 FE-DEAD-CODE -> FE-6 FE-GATES-ENFORCE -> FE-7 FE-PROMISES, base W3-FE `68db28df0`) | `b3cc33d21` | 156 (155 content + 1 modify/delete) | 194 | `69429caeb` |
| 2 | `pilot/CR-FE-DEAD-CSS-2443` (FE-8) | `a885939d9` | 0 | 0 | `f7cfd4438` |
| 3 | `pilot/CR-TSCONFIG-SPLIT-2443` | `905498deb` | 0 | 0 | `50f41b148` |

git rerere had no earlier resolution for any of the 156 files (the resolutions are recorded now).

## Merge 1 - how the 194 hunks were resolved

Almost every conflict is the same shape: the train (I18N-COMBINED-C, I18N-COMBINED, DOMUS, MODAL-STACK-B, ...) edited a line that
the FE chain also edited mechanically (FE-5 un-exported or deleted it, FE-1 replaced `toISOString().replace(...)` with `isoZ`,
FE-2/FE-1 swapped a value for a token or a fragment, FE-4 tidied a helper). Rule: keep the train's behaviour and text, and apply
the FE chain's mechanical edit on top.

| Kind | Hunks | Resolution |
|---|---|---|
| Import lines only on all three sides | 61 | 3-way merge of the named imports per module: base + names either side added - names either side removed (e.g. the train's `tr` import next to FE-1's `isoZ`, FE-5's dropped unused name). `tsc` (noUnusedLocals) checked the result. |
| FE-5 dropped `export` on a declaration the train edited (mostly `tr(...)` texts) | 107 | the train's line with `export ` removed, for the same declaration names (45 in `i18n/`, 28 `screens/`, 16 `api/`) |
| By hand | 26 | below |

By hand:

- **STRUCT-CSS-SPLIT screens** (the recipe of `docs/changes/CR-STRUCT-CSS-SPLIT-2442.md`): `devices-schedules.ts` and
  `mapping-assistant.ts` keep `static styles = <name>;`; the train's CSS changes in the moved sheet were applied inside
  `devices-schedules-css.ts` / `mapping-assistant-css.ts` by a 3-way merge of the moved sheet (base = the merge-base sheet,
  other = the train's sheet, current = the `-css.ts`), 0 conflicts:
  - `devices-schedules-css.ts`: DOMUS-DEFAULT `.rc[aria-pressed='true']` -> `${chipSelected}` + the `::before` check mark;
  - `mapping-assistant-css.ts`: DIALOG-DRAWER-ONE assistant box (menu surface, hairline, `--sw-r-lg`, header border) and the DOMUS
    `.ch[aria-pressed='true']` chip fragment.
  The `chip-selected` import the train added to the two screens moved to the two `-css.ts` files (the screens no longer use it).
  The other five split screens (`explore-plan-editor`, `devices-building`, `home-widgets`, `area-quick-sheet`, `live-camera`):
  the train changed no CSS inside their moved ranges (checked with `git diff -U0 68db28df0 c68904139`), so nothing to re-apply.
- **Deleted by FE-5, translated by the train, used nowhere in `src/`, `tests/`, `scripts/`** -> deleted (FE-5's decision stands):
  `RUN_RESULT_LABEL` (api/automations), `FAILURES_AUDIENCE_LABEL`, `doorOpenBusy` (api/notifications), `fieldLabel`
  (api/nvr-settings), `REPEAT_LABEL` (api/schedules), `STAIR_SHAPE_LABEL` (map/geometry), `LIST_WIDGETS` (api/home-config),
  `DRAFT_FIELDS`, `streamsLabel` (screens/nvr-encoding-logic), `CIT_KEYS`/`CIT_TABLES` (i18n/camera-image-health; the train's
  `registerCatalogue(...)` line kept). `doorOpenResultText`, `inStreams`: un-exported (still used in their file).
- **`screens/placeholder-screen.ts`** (modify/delete): FE-5 deleted the orphan file, the train translated it. No importer in
  `src/`; deleted, with its two keys and its name in the header of `i18n/msg/screens.ts`.
- **FE-5 exports restored** (the train uses them): `actionSentence` (api/automations) and `parshaText` (api/home-config) are
  exported again - `tests/unit-i18n-locale.spec.ts` (I18N-COMBINED-C) calls them; `InstallerText` (i18n/wiskey-installer) is
  kept as a local type (the train's English table is typed with it).
- `components/sw-chip.ts`: the train's side (DOMUS moved the chip fragments to `styles/chip-selected.ts` and re-exports
  `chipSelected`, `chipSelectedHover`, `chipSelectedCheck`); FE-5 had deleted `chipSelectedHover`, the train uses it.
- `components/update-run.ts`: the train's side (`isOutageError` moved to `update-run-logic.ts`, re-exported) with FE-5's
  un-export of the three wait constants.
- `automation-drawer.ts`, `system-automations.ts`: the DOMUS `${chipSelected}` fragment wins over FE-1's
  `font-weight: var(--sw-fw-semibold)` in the same replaced block.
- `temperature/ticket-dialog.ts`: the train's `.bar` and the train's removal of the phone `@media` block (modal stack) + FE-1's
  `${errLineStyles}` fragment.
- Both sides kept: `area-quick-sheet.ts` (`removeLayer(this)` + FE-4's `resizeFrame.cancel()`), `live-wall.ts` (FE-4's resize
  watch in `connectedCallback` + the train's `tr()` label), `system-wall.ts` (both imports).
- Train text + FE edit in one line pair: `devices-layout.ts` (train `tr()` hint, FE-4's `setPickAll(v)` without the unused list
  callback), `devices-schedules.ts` (train `tr()` label, FE-4's `readStoredJson` / `storedText`), `investigate-events.ts`
  (FE-1's `isoZ`, train `tr()`), `schedule-editor.ts` (train `tr()`, FE-4 inlined `allDays`), `tests/evidence-audit30i-devices.spec.ts`
  (FE-3's `devices-schedules-css.ts` path, DOMUS's comment).

## Merges 2 and 3

No text conflict. Merge 2 (FE-8 dead CSS) was checked against the train's templates: the train adds no element with the deleted
classes (`.seg`, `.note`, `.tagrow` in their screens, `td.name` in wiskey-people, `.thumb` / `shimmer` in investigate-events),
and `bakeCancel` is not used again. Merge 3 also merged `package.json` cleanly: the train's `build:addon` (with
`sourcemaps-archive.mjs`) and `sourcemaps:test` are kept, with the split's `typecheck` / `typecheck:app`.

## Baselines re-measured

| Baseline | Before (FE-6, measured before the 2.43.8 train) | Now | How |
|---|---|---|---|
| Entry budget `frontend/scripts/gates-baseline.json` `bundle` | measured gzip 856,557 / raw 2,952,291 -> budget gzip 883,000 / raw 3,041,000 | measured gzip **1,069,016** / raw **3,609,730** -> budget (x1.03, up to 1000) gzip **1,102,000** / raw **3,719,000** | `vite build` of this head, `node scripts/bundle-budget.mjs --dir dist --enforce` |
| Unused exports `unusedExports` | 59 unreferenced / 55 file-local | **56 / 88** | `node scripts/unused-exports.mjs --enforce` (43 new names, 13 gone), then `--update-baseline` |
| ESLint suppressions `frontend/eslint-suppressions.json` | `{}` | `{}` (unchanged) | `eslint src --pass-on-unpruned-suppressions`: 0 reports |
| Design ratchet `scripts/design_ratchet_baseline.json` | color-literal 2500 | unchanged, measured **2500** | `py -3.12 scripts/design_ratchet.py`; px-literal 25557 (b. 25911), undefined-token 13 (14), native-select 549 (582) are lower and were NOT lowered (lead: the other metrics keep their margin until the queue empties) |

Why the entry rose by 212 KB gzip: it is the train, not this branch. The train's own 2.43.8 build (`smplwise_vms/www`, built on
the runner at `04f735276`) has entry gzip 1,069,859 / raw 3,612,094 - the same size (this branch's build is 843 B smaller in
gzip). The budget script lists 64 dictionary modules (1178.7 KB source) in the entry, against 36 (507.7 KB) when FE-6 measured:
I18N-COMBINED / -C put the English tables in the entry. Lowering it is the I18N-LAZY-LANG row (inventory section B, G12).

The 43 new unused-export names are exports the train added before FE-5's clean-up (dictionary `*_DEV_MARKED` constants,
confirm-dialog / confirm-words / core types, modal-stack option types, `map-text` keys, `LIGHT_MOODS`, `LOOKUP_WIDE_WORD`,
`SAVE_WORD` / `REMOVE_WORD`, ...). They were baselined, not un-exported, so this branch does not edit more train files (the lead
still merges train fixes into it). Dropping them is a small follow-up (`--update-baseline` prunes as they go).

## Runner prerequisites (unchanged, from FE-6 and TSCONFIG-SPLIT)

Before this branch gets an entry check or boards a train: install the new `scripts/gate/release_gate.py` and `gate_summary.py`
in `~/`, `~/gate2`, `~/nightly-gate` and run `selftest_fe_static.py` there (`scripts/gate/INSTALL_ON_RUNNER.md`); then
`GATE_FE_STATIC=auto`, `require` after two gates. Nothing was run on the runner for this branch and no entry was queued.

## Tests actually run (this workstation)

`frontend\node_modules` is a junction to `C:\cloude\smplwise-fe7\frontend\node_modules` (FE-7's `npm ci`; the main checkout's
`node_modules` has no `eslint` / `typescript-eslint`). `package-lock.json` is the same on the train and the chain.

1. `tsc --noEmit -p tsconfig.json` after merge 1: 4 errors (`InstallerText` x2, `actionSentence`, `parshaText`) -> fixed above.
2. After merge 3: `tsc --noEmit -p tsconfig.tests.json` (src + tests + vite/playwright configs, the full program): **exit 0**
   (7 min 13 s); `tsc --noEmit -p tsconfig.scripts.json` (the `.mjs`, incl. the train's `sourcemaps-archive.mjs`): **exit 0**.
   `tsconfig.json` (app only) is a subset of the first and was not run again separately.
3. ESLint `node node_modules/eslint/bin/eslint.js src --pass-on-unpruned-suppressions`: **exit 0, no report** (7 min 26 s).
4. `vite build` (dist): **exit 0** (3 min 21 s). `bundle-budget.mjs --dir dist --enforce`: FAIL against the old budget (+186,016 B
   gzip) -> baseline re-measured -> **exit 0**.
5. `unused-exports.mjs --enforce`: FAIL (43 new) -> `--update-baseline` -> **exit 0**.
6. `py -3.12 scripts/design_ratchet.py`: **no count above the baseline**, color-literal 2500.
7. Backend `pytest tests/test_build_guards_2438.py -p no:xdist` (main checkout `.venv`): **10 passed**.
8. `py -3.12 scripts/gate/selftest_fe_static.py`: **SELFTEST OK**.
9. Node-only unit suite: see below.

## NOT_RUN

- Any runner job (entry check, release gate, pixel, evidence on Linux) - by the evening brief (no entry before the 2.43.8 gate is
  done and the runner gate scripts are upgraded).
- Playwright evidence / layout / pixel specs (browser) - not run locally (RAM; the FE chain branches ran theirs, the train runs
  the release gate). STRUCT-CSS-SPLIT re-applied CSS (devices-schedules, mapping-assistant) is text-identical to the train's sheets
  by construction, but no rendered comparison was made here.
- `npm run build:addon` (the add-on build is the release step on the runner).
