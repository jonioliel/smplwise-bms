# CR-TSCONFIG-SPLIT-2443 - the type check is split into three programs, the gate runs all of them

Branch `pilot/CR-TSCONFIG-SPLIT-2443`, base `pilot/CR-FE-PROMISES-2442` @ `b3cc33d21` (contains main 2.43.7, `cc69447f1`).
Tooling only: configuration, gate scripts and type-only fixes in `.mjs` tools. No product code, no CSS, no pixels.

## Where the plan comes from

- Review 07:F20 (`private/code-review-2026-11-13/07-frontend-core.md`): "a second `tsconfig` for tests so the app check is fast".
- Master plan row `CR-FE-GATES-2436`: `frontend/tsconfig.json` + new `frontend/tsconfig.tests.json`.
- `docs/changes/CR-FE-GATES-2436.md` (Skipped): not done in wave 1 because the gate runs plain `tsc --noEmit`; the plan it wrote
  down: **"both files in one commit: `tsconfig.json` = app, `tsconfig.tests.json` = everything, the gate calls
  `tsc -p tsconfig.tests.json`"**.
- `docs/changes/CR-FE-GATES-ENFORCE-2442.md`, lead decision 7: not in the FE-6 row, needs its own row. This is that row.

## What changed

| File | Change |
|---|---|
| `frontend/tsconfig.json` | The app alone: `include` is `src`, `vite.config.ts`, `vite.public.config.ts`. Compiler options untouched. `npm run build`, `npm run build:addon`, the editor and type-aware ESLint (project service) use this program. |
| `frontend/tsconfig.tests.json` (new) | Extends `tsconfig.json`, no option overrides. `include`: everything the old `tsconfig.json` had (`src`, `tests`, the two vite configs, `playwright.config.ts`) plus `playwright.*.config.ts`; `exclude`: `tests/archive` as before. |
| `frontend/tsconfig.scripts.json` (new) | The `.mjs` tools (`scripts/**/*.mjs`, `eslint.config.mjs`) with `allowJs` + `checkJs`. Never type-checked before. `strict: false` (see below), `allowImportingTsExtensions` (two tools import `.ts` modules and run under Node's type stripping). |
| `frontend/package.json` | `typecheck` = `tsc --noEmit -p tsconfig.tests.json && tsc --noEmit -p tsconfig.scripts.json` (everything); new `typecheck:app` = the app alone. `build` / `build:addon` keep `tsc --noEmit` (now the app program). |
| `scripts/gate/release_gate.py` | New `tsc_commands(fe)`; the `tsc` phase runs each command into `tsc.log`: `tsc --noEmit -p tsconfig.tests.json`, then every other `frontend/tsconfig.*.json`. One `tsc` count and the item id `tsc --noEmit` as before (baselines, summaries and verdict rules are unchanged); the failing config is named in the reason. A tree without `tsconfig.tests.json` (every branch from before the split) gets plain `tsc --noEmit`, as today. |
| `scripts/gate/selftest_fe_static.py` | Four `tsc:` cases for `tsc_commands` (old tree, split tree, a config added later, this repository). |
| `scripts/gate/targeted_plan.py` | Docstring only (which config type-checks the specs). |
| `scripts/gate/INSTALL_ON_RUNNER.md` | Section "Type-check programs": what runs, and the install order. |
| `frontend/tests/unit-tsconfig-split.spec.ts` (new) | Node-only guard, 3 cases: the tests config extends the app config without overrides and includes every entry of it; every `tsconfig*.json` is in `npm run typecheck`; the engine runs the tests config and globs the rest. |
| `frontend/eslint.config.mjs`, `frontend/scripts/api-client-check.mjs`, `public-camera.test.mjs`, `settings-shots.mjs` | JSDoc type annotations / casts only (below). |

## Coverage: before and after (measured, `tsc --listFilesOnly`, `node_modules` left out)

| Program | Files |
|---|---|
| before: `tsconfig.json` | 2771 |
| after: `tsconfig.tests.json` (what the gate runs first) | 2775 = the same 2771 + `playwright.guide-live.config.ts`, `playwright.owner28.config.ts`, `playwright.public.config.ts`, `playwright.unit.config.ts` (+1 with this branch's new spec) |
| after: `tsconfig.json` (app) | 1534, every one of them inside the tests program |
| after: `tsconfig.scripts.json` | 13: `eslint.config.mjs`, the 10 `scripts/*.mjs`, and the two `.ts` modules they import |

Files dropped from the gate's check: **0** (`comm -23 before after` is empty). Added: 4 Playwright configs and 11 `.mjs` files.

## Type errors the wider coverage revealed

- The 4 added Playwright configs: 0 errors.
- The `.mjs` tools under `checkJs`: 213 errors with the app's `strict` options, 156 of them TS7006 (a parameter without a type -
  the tools are plain JavaScript without annotations) and most of the rest null-narrowing noise of the same kind. Annotating
  every parameter of ten tools is not a type fix, it is a rewrite, so the scripts program runs with `strict: false`. It still
  reports wrong imports, unknown names, wrong argument types against Node / Playwright / ESLint typings and misspelled members.
  Under that setting 7 errors remained; all 7 are fixed, **no baseline is needed**:
  - `eslint.config.mjs` (2): the plugin types `configs['flat/recommended']` as a union with the legacy shape - typed as
    `Linter.Config`;
  - `scripts/api-client-check.mjs` (1): `consts.helpers = ...` on a `Map` - the map's JSDoc type now names the extra member;
  - `scripts/public-camera.test.mjs` (3): the fake `window` / `document` are cast (they are stand-ins by design);
  - `scripts/settings-shots.mjs` (1): `colorScheme` is `'light' | 'dark'`, not `string`.
  Every fix is a JSDoc comment or a comment-cast; the emitted JavaScript is the same statements (one object literal gained
  parentheses). Making the scripts program strict is a possible follow-up (206 reports, mostly parameter annotations).

## Install order on the runner (the one thing that can go wrong)

The engine is installed on the runner from `~/`, not taken from the branch under test. An engine from **before** this change
runs plain `tsc --noEmit`; on a tree that carries the split that checks `src` and the vite configs only - the 1,237 files of
`tests/` would leave the gate's type check without any red. The new engine is safe for old trees (fallback above), so:
**install the new `release_gate.py` in `~/`, `~/gate2/` and `~/nightly-gate/` before this branch gets an entry check or joins a
train** (`INSTALL_ON_RUNNER.md`, "Type-check programs"). Not done here: this row does not use the runner.

Also for agents' local loop: `npx tsc --noEmit` is now the app alone. After touching a spec, run `npm run typecheck`
(or `npx tsc --noEmit -p tsconfig.tests.json`). The agent briefs still say `npx tsc --noEmit`.

## Tests actually run (workstation, Node 24.21.0, worktree at the committed tree)

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.tests.json` (everything) | exit 0, 0 errors (258 s) |
| `npx tsc --noEmit -p tsconfig.json` (app) | exit 0, 0 errors (142 s; the old single program took 258 s) |
| `npx tsc --noEmit -p tsconfig.scripts.json` | exit 0 after the 7 fixes (7 s) |
| The gate's `tsc` phase: the commands of `release_gate.tsc_commands(frontend)` run in order by a small driver | `-p tsconfig.tests.json` rc=0 (255 s), `-p tsconfig.scripts.json` rc=0 (7 s): PASS |
| `py -3.12 scripts/gate/selftest_fe_static.py` | SELFTEST OK, 26 cases OK (4 new `tsc:` cases), process cases SKIP (Windows) |
| `playwright test -c playwright.unit.config.ts tests/unit-tsconfig-split.spec.ts` | 3 passed |
| Node-only unit run: `playwright test -c playwright.unit.config.ts tests/unit- --workers=3` (489 files) | 4691 passed, 10 skipped, **7 failed - none from this branch** (it changes no file under `src/` and no existing spec): 5 in `unit-session-me-failure-2435.spec.ts` are page tests the node-only filter does not recognise ("Cannot navigate to invalid URL", no server); 2 (`unit-presence-compact-2310:36`, `unit-presence-count-2400:35`) hit a `document` stub another spec left in the shared worker (`src/i18n/presence.ts:149`) - both files alone, `--workers=1`: 32 passed |
| `npx vite build` (to a scratch folder) | exit 0, built in 2 m 11 s |
| `node scripts/bundle-budget.mjs --dir <that build> --enforce` | OK, exit 0 |
| `node scripts/unused-exports.mjs --enforce` | OK, no export outside the baseline, exit 0 |
| `node --test scripts/public-camera.test.mjs scripts/visual.test.mjs` (two of the edited / checked tools) | 11 passed |
| `node scripts/api-client-check.mjs` (edited tool) | runs, same report shape (1908 routes, 1484 reached) |
| `npx eslint src/main.ts src/api/client.ts` (project service on the narrowed `tsconfig.json`) | no report, exit 0 |
| `pytest tests/test_targeted_plan.py tests/test_gate_hygiene.py -p no:xdist` | 192 passed |

Two unit-run findings for a follow-up (not this row): the node-only filter of `playwright.unit.config.ts` misses the page tests
of `unit-session-me-failure-2435.spec.ts`, and one unit spec leaves a `document` global without `documentElement` behind.

## NOT_RUN

- Entry check / runner: not queued, by the row's instruction.
- The gate engine end to end (`release_gate.py` needs a POSIX machine); the `tsc` phase's commands were run locally through
  `tsc_commands`, the phase's count / item lines were not executed.
- The process cases of `selftest_fe_static.py` (POSIX + node): SKIP on Windows, as before this change.
- `npm run lint` over all of `src/` (about an hour on this workstation): two files were linted to prove that the project service
  resolves the narrowed `tsconfig.json`; the full run belongs to the gate.
- Playwright page / evidence / pixel suites: nothing they exercise changed.

## For the lead

1. Install the engine first (above).
2. `strict: false` for the `.mjs` tools: accept, or open a follow-up to annotate the tools (206 reports).
3. Update the agent briefs: the local check for a spec change is `npm run typecheck`.
