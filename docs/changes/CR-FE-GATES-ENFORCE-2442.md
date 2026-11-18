# CR-FE-GATES-ENFORCE-2442 - the frontend static checks become blocking (review wave 3B, step FE-6)

Branch: `pilot/CR-FE-GATES-ENFORCE-2442` (MASTER_PLAN section 3.5 names it `pilot/CR-FE-GATES-ENFORCE-2436`).
Base: `origin/pilot/CR-FE-DEAD-CODE-2442` (`9116a4199`, step FE-5; it already contains `origin/main` 2.43.7 `cc69447f1`).
Themes: T3 (bundle budget) and T6 (static checks in the gate) of `private/code-review-2026-11-13/MASTER_PLAN.md`; findings
07:F20, 07:F19, 06:DEAD-1. The report-only tools are those of `docs/changes/CR-FE-GATES-2436.md` (wave 1).

No product source file is changed (nothing under `frontend/src`), no backend file, no pixels, no PNG.

## What is blocking now

Three checks exit non-zero, and the gate engine runs them as failures of a new category `fe_static`:

| Check | Command (from `frontend/`) | Fails when | Baseline |
|---|---|---|---|
| ESLint | `npm run lint` = `eslint src --pass-on-unpruned-suppressions` | any report of `no-floating-promises`, `no-misused-promises` or the `eslint-plugin-lit` recommended set (all rules are errors now) above the count of its file and rule | `frontend/eslint-suppressions.json`: 27 reports in 20 files |
| Entry budget | `npm run gate:budget` = `node scripts/bundle-budget.mjs --dir dist --enforce` | the entry chunk of the build is over the budget (gzip or raw); a `*-mock` module is in the entry; there is no build | `frontend/scripts/gates-baseline.json`, `bundle` |
| Unused exports | `npm run gate:unused-exports` = `node scripts/unused-exports.mjs --enforce` | an export is on one of the two lists and not in the baseline | `frontend/scripts/gates-baseline.json`, `unusedExports`: 59 unreferenced, 55 file-local |

`npm run gates` runs the three (budget, unused exports, lint - the slow one last; it needs `npm run build` first).

Not made blocking (they are not clean on this head, or were not asked for):

- **Dictionary modules in the entry** (T3's deny-list, second half): 36 modules, 507.7 KB of source, still listed by the budget
  script as a report. A count baseline is one line in the script; it would turn every new label file that the shell imports into a
  red gate while 88 branches are open - a lead decision (below).
- **`scripts/api-client-check.mjs`**: report-only as before (1786 client calls, 1583 checked, 2 without an inventory route:
  `src/api/nvr-settings.ts:240`, `:242`).
- **Debug maps** (07:F7): counted only (314 `.map` files in `dist`); stopping them is owner decision Q-CODE-3, another branch.

### ESLint

`eslint.config.mjs`: the three rule groups are `error` (they were `warn`). The config is otherwise the one of wave 1.

On this head ESLint reports **27** problems in 1530 files (wave 1 had 29): `no-misused-promises` 14, `no-floating-promises` 12,
`lit/attribute-value-entities` 1. None was fixed here: every one of the 26 promise reports is a place where a rejected request is
dropped, and the fix is a decision per screen (what the user sees when it fails), with a test - not a mechanical `void`. They are
**baselined, counted per file and rule**, with ESLint's own bulk suppressions (`eslint src --suppress-all` wrote
`eslint-suppressions.json`; no hand-written list):

| File (`frontend/src/`) | Rule | Count |
|---|---|---|
| `access-external/identity-card.ts` | no-misused-promises | 1 |
| `calendars/view-calendar.ts` | no-misused-promises | 1 |
| `components/sw-live-player.ts` | no-floating-promises | 2 |
| `components/wk-door-tech.ts` | no-floating-promises | 1 |
| `electricity/elec-bill-page.ts` | no-misused-promises | 1 |
| `maintenance/round-run.ts` | no-floating-promises | 1 |
| `notice-tv/main.ts` | no-misused-promises | 1 |
| `notices/compose-dialog.ts` | no-misused-promises | 1 |
| `public-ticket/rfq/rfq-files.ts` | no-misused-promises | 2 |
| `public-ticket/rfq/rfq-page.ts` | no-floating-promises | 1 |
| `screens/automation-editor-base.ts` | no-floating-promises | 2 |
| `screens/explore-plan-editor.ts` | no-misused-promises | 1 |
| `screens/explore-sites.ts` | no-misused-promises | 1 |
| `screens/investigate-event-detail.ts` | no-misused-promises | 1 |
| `screens/system-diagnostics.ts` | lit/attribute-value-entities | 1 |
| `screens/wiskey-access-diag.ts` | no-misused-promises | 1 |
| `screens/wiskey-people.ts` | no-misused-promises | 1 |
| `shell/sw-home-personal.ts` | no-floating-promises | 5 |
| `temperature/report.ts` | no-misused-promises | 1 |
| `temperature/whatsapp.ts` | no-misused-promises | 1 |

How the count behaves: a file with more reports of a rule than its count shows all of them and ESLint exits 1; a file that is
not in the list has a count of 0. A fixed report leaves a count that is too high: with `--pass-on-unpruned-suppressions` that is
not a failure (a branch that fixes one is not red for it); `npx eslint src --prune-suppressions` lowers the counts. Adding an entry
(`--suppress-rule <rule>` or `--suppress-all`) is a deliberate edit of the committed file and belongs in the change note of the
branch that does it.

### Entry budget

Measured by `node scripts/bundle-budget.mjs --dir dist` after `npx vite build` of this head (Windows workstation, 2026-11-17):
entry `assets/index-D5fIiES6.js` **raw 2,952,291 B, gzip (level 9) 856,557 B**; 0 mock modules in the entry.

Budget = measured x 1.03, rounded up to 1000 B: **gzip 883,000 B, raw 3,041,000 B** (headroom 26,443 B gzip / 88,709 B raw).
Margin 3 %: it covers a build on another machine and small additions to the shell; a screen-sized addition to the entry
(the on-demand chunks of wave 2 are 70 to 270 KB raw each) does not fit, which is the point. The numbers, the margin and the
date are in `scripts/gates-baseline.json` (`bundle.measured`, `bundle.marginPct`, `bundle.budget`); a unit spec checks that
the budget equals measured + margin, so the budget cannot be raised without the measurement next to it.

Before this branch the budget was the entry of v2.43.4: gzip 1,156,938 B, raw 4,074,343 B (report-only). The entry is 26 % smaller
now (waves 1 and 2: mocks, labels, shell, home, diagnostics loaded on demand), so the old budget guarded nothing.

**The committed add-on build** (`smplwise_vms/www`, the 2.43.7 build of `main`): entry raw 3,245,894 B, gzip 926,901 B - over the
new budget, because `main` does not have the frontend chain yet. The gate does not judge that folder (it builds `dist` and
measures it); `node scripts/bundle-budget.mjs --enforce` with no `--dir` would fail on it until the next release build.

`--enforce` also fails on **a mock module in the entry** (baseline 0, read from the entry's source map; when a build has no
source map - owner decision Q-CODE-3 - that rule is "not measured" and the byte budget decides alone) and on **no build**.

### Unused exports

`--enforce` compares the two lists of the report with `unusedExports` in `scripts/gates-baseline.json`, key `module#name`:
**59 unreferenced** (the kept rows of FE-5's table 2: 42 tagged "built ahead" + 17 kept) and **55 file-local** (FE-5's table 4).
An export on a list and not in the baseline fails with its file and line. The lists can only shrink: a baseline entry that is no
longer reported is printed as a note (not a failure), `node scripts/unused-exports.mjs --update-baseline` prunes it.

What a developer does on a failure: use the export, delete it, or drop the `export` keyword (file-local). Code built ahead of
its caller (owner decision O15 a) gets its task tag and a baseline entry, on purpose, with the reason in the change note.
The check is the heuristic it was (word match over `src/`, `tests/`, `scripts/`): it errs towards "used", so it does not
produce a false failure for a name that is mentioned anywhere; it cannot see a name used only outside `frontend/`.

## The gate script

`scripts/gate/release_gate.py` (the engine of the release gate, the entry check and the nightly):

- phase **`fe-static`**, right after `vite build`: the budget on `dist` (skipped when the build failed) and the unused-export
  baseline; seconds;
- phase **`fe-lint-start`** after `release_check`: ESLint over `src/` started in the background (`nice`, `timeout`
  `GATE_FE_LINT_SECS`, default 1800), collected in **`fe-lint-wait`** after Playwright - it costs CPU, not wall time;
  ESLint is called from `node_modules/eslint/bin/eslint.js` (never `npx`, nothing is downloaded);
- a non-zero exit is a `FAIL` item of category `fe_static` with the log tail, and the gate is red; the logs are
  `fe_static_bundle-budget.log`, `fe_static_unused-exports.log`, `fe_static_eslint.log`; the report has a section with the three
  results and their seconds;
- `GATE_FE_STATIC=auto` (default): a check that could not finish - ESLint over its budget, or eslint / typescript-eslint
  missing from `node_modules` - is a skipped `NOT_RUN` item with its reason, never counted as passed; `=require`: `NOT_RUN`
  fails the gate; `=off`: nothing runs;
- a branch **without `frontend/scripts/gates-baseline.json`** (every branch older than this one) and the timing lane run none of
  them, so the new engine does not turn older branches red;
- `fe_static` is an optional category (no count baseline) and `gate_summary.py` classes its failures as deterministic ("real").

`scripts/gate/selftest_fe_static.py` (new): the verdict, skip and record rules. `scripts/gate/INSTALL_ON_RUNNER.md`: the copy
commands.

**The runner was not touched.** `~/gate2` (and `~/`, `~/nightly-gate`) still have the old engine: until the lead copies
`release_gate.py` and `gate_summary.py` there after the merge, no gate runs these checks, and they block only where somebody runs
`npm run gates`.

## Files

- `frontend/eslint.config.mjs` - rules are errors.
- `frontend/eslint-suppressions.json` (new) - the 27 counted reports.
- `frontend/scripts/gates-baseline.json` (new) - the budget with its measurement and margin; the two export lists.
- `frontend/scripts/bundle-budget.mjs` - `--enforce`, `failures()`, the budget read from the baseline file.
- `frontend/scripts/unused-exports.mjs` - `--enforce`, `--update-baseline`, `--baseline`, `--root`, `compare()`.
- `frontend/package.json` - `lint` is blocking (no `|| exit 0`); new `gate:budget`, `gate:unused-exports`, `gates`;
  `report:gates` keeps the three reports (no lint). No dependency is added or changed; `package-lock.json` is untouched.
- `frontend/tests/unit-entry-chunk.spec.ts` - 7 new cases for `--enforce`; `frontend/tests/unit-unused-exports.spec.ts` (new, 9 cases).
- `scripts/gate/release_gate.py`, `scripts/gate/gate_summary.py`, `scripts/gate/selftest_fe_static.py` (new),
  `scripts/gate/INSTALL_ON_RUNNER.md`.

## Tests actually run (this workstation, final tree unless said otherwise)

1. **`npm ci`** in this worktree's `frontend/` (its own `node_modules`, no junction: `typescript-eslint` is declared in
   `package.json` / `package-lock.json` but is not in the shared `node_modules` of the main checkout): exit 0. No dependency added.
2. **ESLint, whole `src/`**:
   - before the change (rules as warnings, `npx eslint src -f json`): 27 warnings, 0 errors, 1530 files, exit 0 (497 s next to a build);
   - `node node_modules/eslint/bin/eslint.js src --suppress-all` (rules as errors): exit 0, wrote the 27 counts in 20 files (428 s);
   - **`npm run lint`** on the final tree: **exit 0, no report** (235 s);
   - a new file with one floating promise, linted alone: 1 error, **exit 1** (temporary file, removed);
   - a second floating promise appended to `components/wk-door-tech.ts` (count 1): both reported, **exit 1**; the untouched file
     alone: exit 0 (the file was restored with `git checkout`).
3. **Entry budget**: `npx vite build` exit 0 (3 min 7 s), then `node scripts/bundle-budget.mjs --dir dist --enforce`:
   raw 2,952,291 B, gzip 856,557 B, within the budget, 0 mocks, **exit 0**. With `--budget-gzip 10`: exit 1. On the committed
   `smplwise_vms/www` (the build of `main`): over by 43,901 B gzip / 204,894 B raw, exit 1 (expected, see above). A folder with
   no build: exit 1 with `--enforce`, exit 0 without.
4. **Unused exports**: `node scripts/unused-exports.mjs --enforce` on the final tree: 12805 exported declarations,
   **59 unreferenced, 55 file-local, nothing outside the baseline, exit 0**; without `--enforce` the same counts as FE-5.
5. **`npx tsc --noEmit`** (project config, includes the two specs): **exit 0, no output**.
6. **Full node-only unit run** (`npx playwright test -c playwright.unit.config.ts tests/unit- --workers=2`, `dist` built first):
   **4679 passed, 6 failed, 8 skipped** (13.9 min). FE-5 had 4663 passed; the 16 more are the new cases. The 6 failures are the
   known base failures of the chain: 5 x `unit-session-me-failure-2435` (`:44`, `:76`, `:101`, `:110`, `:121`; a page spec the
   node-only config starts without a server) and `unit-presence-compact-2310:36`. The 18 PNGs the run rewrote under
   `docs/evidence/` were restored.
7. **The two tool specs alone** (`tests/unit-entry-chunk.spec.ts`, `tests/unit-unused-exports.spec.ts`): 23 passed.
8. **`python scripts/gate/selftest_fe_static.py`** (Python 3.12, Windows): 22 cases OK, `SELFTEST OK`; the 4 process cases
   printed SKIP (they need a POSIX machine). **`python scripts/gate/selftest_gate_fast.py`**: `SELFTEST PASSED`.
   `python -m py_compile` of the three changed gate files: OK.
9. **`node scripts/lazy-tags-check.mjs`**: OK (1529 files, 550 tags, 102 route screens). **`node scripts/api-client-check.mjs`**:
   the report-only numbers above.

## NOT_RUN

- **The gate engine with the new phases on a real gate**: NOT_RUN. The runner was not used (instruction for this step), and the
  engine's process code (`os.killpg`) does not run on Windows. What ran is the pure logic (verdicts, skip rules, counts, items,
  report classification). Not exercised anywhere: `fe_static_sync` and `fe_lint_start` / `fe_lint_finish` starting real
  processes, the three new phases inside `main()`, the Hebrew report section.
- **The 4 process cases of `selftest_fe_static.py`**: NOT_RUN (POSIX only) - they have never been executed; run them on the
  runner with the sync.
- **`scripts/gate/selftest_gate.py`**: NOT_RUN (Linux; it was not changed).
- **ESLint run time and memory on the runner**: not measured.
- **The entry size of a Linux build**: not measured (the budget was measured on Windows; the 3 % margin is the allowance).
- **Runner entry check**: not queued (instruction for this step). No pixel run, no browser spec, no backend test: nothing under
  `frontend/src` or `smplwise_vms/` changed.
- **`build:public`** (`vite.public.config.ts`): not run - no source file changed since FE-5 ran it.

## Lead decisions

1. **Sync the runner after the merge** (idle runner, backup first; commands in `scripts/gate/INSTALL_ON_RUNNER.md`, last
   section): `release_gate.py` and `gate_summary.py` to `~/`, `~/gate2`, `~/nightly-gate`, then `python3 ~/selftest_fe_static.py`.
2. **ESLint on the runner**: its run time there is not known (here 7 to 8 minutes next to other work; wave 1 measured 61 minutes
   on a saturated workstation). The default is `auto` - over 1800 s it is a visible NOT_RUN, not a red gate. After two gates that
   show it finishing, set `GATE_FE_STATIC=require` in the gate's environment. The runner's `node_modules` must come from this
   `package-lock.json` (the shared `node_modules` of the workstation's main checkout has no `typescript-eslint`; a runner copy in
   the same state gives NOT_RUN "not in frontend/node_modules").
3. **Margin 3 %** for the entry budget: confirm, or name another number (one line in `gates-baseline.json`; the unit spec
   accepts up to 5 %).
4. **Stale baseline entries are a note, not a failure** (ESLint `--pass-on-unpruned-suppressions`, unused exports "gone"):
   chosen so that a branch that fixes something is not red for it while many branches are open. The strict form (drop the flag;
   make "gone" fail) is a small change once the queue is merged.
5. **Dictionary modules in the entry** (36): add a count baseline now, or leave as a report until `CR-I18N-LAZY-LANG`.
6. **The 27 baselined ESLint reports**: a follow-up per module (decide what the user sees when the request fails, with a test).
   `shell/sw-home-personal.ts` (5) and `components/sw-live-player.ts` (2) are the ones on every user's path.
7. **`tsconfig.json` split** (`tsconfig.tests.json`; `docs/changes/CR-FE-GATES-2436.md` moved it to this step): not done - it is
   not in the FE-6 row, and it changes what `tsc --noEmit` covers in the gate and in `targeted_plan.py`. Needs its own row.
8. **The design-regression guard of owner decision Q-CODE-4 a** (a check that fails on a hand-built component or a colour outside
   the kit): the colour / type / radius part exists and already blocks (`tests/unit-token-lint.spec.ts`, DU1). A guard for
   hand-built components is not in this branch - it needs the list of kit components and of allowed exceptions from the design
   track. This branch is the "blocking now" half for code checks only.
9. **The next release build**: `smplwise_vms/www` is over the new budget until it is rebuilt from a tree with the frontend chain.
