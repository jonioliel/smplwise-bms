# FIX-UNIT-PAGES-CONFIG-2440 - the unit config recognises baseURL-relative page specs

Branch `pilot/FIX-UNIT-PAGES-CONFIG-2440`, cut from `origin/release/2438-train` @ `4679923b4`. Test harness only
(`frontend/playwright.unit.config.ts`) plus a node-only regression spec: no product code, no version bump, no CHANGELOG entry, no
pixel change.

## What failed

`frontend/tests/unit-session-me-failure-2435.spec.ts` drives the preview build in a browser and navigates relative to the baseURL
(`page.goto('./#/devices')`). `playwright.unit.config.ts` counts a unit-* spec as a page spec only when it navigates to an absolute
app address (`goto('/...')`) or names one in a constant, so this spec stayed in the default node-only run, which has no baseURL:
5 of its 6 tests failed there ("Cannot navigate to invalid URL"), and the page run (`SW_UNIT_PAGES=1`) never picked it up.

## Fix

- The page-spec rule (`PAGE_SPEC`) accepts `./` as well as `/` before the app address, in `goto(...)` and in the named-constant form.
  It is exported (with `UNIT_SPEC`) for the regression spec.
- The node-only mode gets `testMatch: 'unit-*.spec.ts'`: a bare `npx playwright test -c playwright.unit.config.ts` no longer collects
  the evidence-* / layout-* / pixel-* / other specs of `tests/` (they need `playwright.config.ts`'s preview server and projects).
  The page mode already took only unit-* page specs.
- New `frontend/tests/unit-unit-config-pages-2440.spec.ts` (node-only, 4 tests): relative and absolute app addresses are page specs,
  an own origin / about:blank / a relative import are not, unit-session-me-failure-2435 is a page spec, and the node-only mode
  matches unit-* only and ignores the page specs. Its sample addresses are built by concatenation so it is not a page spec itself.

Not changed: the runner's own copy of the rule in `~/gate2/early_check.py` (`PAGE_SPEC`, runner-only, not in the repository). It
decides which listed unit specs are eligible for the early check; none of its 23 listed specs uses a relative address, so it is
unaffected today. Recommendation: align it with this rule when the gate scripts are next touched.

## Tests actually run

Workstation (Windows):
- `npx tsc --noEmit` (frontend; tests are included and import the config): PASS.
- `npx playwright test -c playwright.unit.config.ts tests/unit-unit-config-pages-2440.spec.ts --workers=1`: 4 passed.

Runner (a fresh clone in `~/work/unitcfg2440` at `e2b4ae2ef`, nice -n 10, results in `~/work/run2440-results/`):
- BEFORE (the base config `4679923b4`), node-only: `unit-session-me-failure-2435.spec.ts` -> **5 failed, 1 passed** (the reported fault).
- AFTER, node-only: the same spec is no longer collected ("No tests found" - it is a page spec now).
- AFTER, node-only: `unit-unit-config-pages-2440.spec.ts` -> 4 passed.
- AFTER, page mode against `vite preview` of the branch build (`SW_UNIT_PAGES=1 SW_BASE_URL=http://127.0.0.1:4391/`):
  `unit-session-me-failure-2435.spec.ts` -> **6 passed**.
- AFTER, page mode, every page spec (26 files, `--workers=4`): **123 passed, 8 skipped, 0 failed** (5.5 min).
- Selection (`--list`): node-only bare run BEFORE = 12340 tests in 1114 files (503 unit-*, 410 evidence-*, 92 layout-*, 38 pixel-*,
  ...); AFTER = 4823 tests in 503 files, all unit-*. Page mode BEFORE = 125 tests in 25 files; AFTER = 131 tests in 26 files
  (+ unit-session-me-failure-2435, 6 tests); no non-unit file in either mode.

NOT_RUN: the full node-only unit run (503 files, the gate's job), the release gate / entry check (not queued, per the task).

## Rollback

Revert the commit; only the unit-test harness changes.
