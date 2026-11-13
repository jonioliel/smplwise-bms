# CR-FE-GATES-2436 - frontend report-only gates (ESLint, entry budget, client-to-inventory, unused exports)

Branch `pilot/CR-FE-GATES-2436`, cut from `origin/main` 665ec8f24 (v2.43.4). Code review 2026-11-13, master plan section 3.2
(wave 1, frontend). **Report-only**: every tool prints counts and exits 0; nothing here can fail a gate. Turning them into failures
is `CR-FE-GATES-ENFORCE-2436` (wave 3B). No product source file is changed; no pixels.

## Findings covered

| Finding | What this branch does |
|---|---|
| 07:F20 (no lint, no budgets) | ESLint 10 + `typescript-eslint` (`no-floating-promises`, `no-misused-promises`, type-aware through `tsconfig.json`) + `eslint-plugin-lit` recommended set, all as warnings (`npm run lint`). Entry budget script. |
| 07:F8 step 1 (no client-to-backend contract check) | `scripts/api-client-check.mjs`: every client call in `src/` against `contracts/API_INVENTORY.md`. |
| 07:F7 (debug maps shipped) | Counted only: `bundle-budget.mjs` prints the number and bytes of `.map` files next to the JavaScript. The `sourcemap` setting in `vite.config.ts` is **not touched** (owner decision O3). |
| D3 / T3, budget part | `scripts/bundle-budget.mjs`: entry raw + gzip against a budget that starts at today's size, plus the deny-list (every `*-mock` and dictionary module in the entry, from its source map). `tests/unit-entry-chunk.spec.ts`. |
| 06:DEAD-1 / 07:F19, report part | `scripts/unused-exports.mjs`: unreferenced and file-local exports of `src/`. Nothing is removed. |

## Files

- `frontend/package.json` - three pinned dev dependencies; scripts `lint`, `report:budget`, `report:api-client`,
  `report:unused-exports`, `report:gates` (all report-only; `lint` ends in `|| exit 0`).
- `frontend/package-lock.json` - 96 added entries, no existing entry changed (checked entry by entry against `origin/main`).
- new `frontend/eslint.config.mjs`, `frontend/scripts/bundle-budget.mjs`, `frontend/scripts/api-client-check.mjs`,
  `frontend/scripts/unused-exports.mjs`, `frontend/tests/unit-entry-chunk.spec.ts`.

### New dev dependencies (pinned exactly, each at least two weeks old on 2026-11-13)

| Package | Version | Published |
|---|---|---|
| `eslint` | 10.13.0 | 2026-10-16 (10.14.0 of 2026-10-30 was skipped: exactly 14 days) |
| `typescript-eslint` | 8.72.1 | 2026-10-26 (peer: eslint ^10, typescript <6.1) |
| `eslint-plugin-lit` | 2.3.1 | 2026-05-11 |

Installed with `npm install --save-exact --before=2026-10-30T00:00:00Z`, so every transitive package resolved is also older than
two weeks. `@eslint/js` is not needed (no core recommended set is enabled).

## Today's numbers (committed build of v2.43.4 / the source at 665ec8f24)

- **Entry** `assets/index-BbQM-cPX.js`: raw 4,074,343 B, gzip (level 9) 1,156,938 B. This is the starting budget (`BUDGET` in
  the script). The review's 1,153,256 B gzip used another compression level; the raw size matches.
- **Deny-list in the entry**: 8 mock modules (329.9 KB of source; the review listed 7 - `device-activity-mock.ts` 4.7 KB is the
  eighth), 44 dictionary modules outside the base `i18n/he.ts` / `i18n/en.ts` (827.4 KB of source; largest
  `i18n/access-external.ts` 136.3 KB, `tickets/rfq-text.ts` 71.3 KB, `i18n/temperature.ts` 71.0 KB).
- **Debug maps** (07:F7): 247 `.map` files, 36,134 KB, against 247 `.js` files, 14,581 KB.
- **Client to inventory**: 1,802 client calls, 1,736 checked, 66 with a path built at run time (not checked). **2 calls match no
  inventory route** - verify: `POST nvr/recorders/{id}/channels` (`src/api/nvr-settings.ts:240`) and
  `DELETE nvr/cameras/{id}/channel` (`src/api/nvr-settings.ts:242`); no backend route with either path was found by grep.
  Inventory: 1,905 routes, 1,623 reached by some client call, 282 by none (tickets 40, access-control 31, identity 31, notices 19, ...).
- **Unused exports** (14,901 exported declarations in `src/`): 219 unreferenced (const 131, function 59, type 29), 2,356 file-local
  (type 1,584, const 519, function 251, class 2), 520 custom-element classes named nowhere else (reported apart, not counted).
- **ESLint** (`npx eslint src`): 29 warnings, 0 errors - `no-misused-promises` 16, `no-floating-promises` 12,
  `lit/attribute-value-entities` 1. Exit 0.

All four are heuristics where stated in their headers (string scans, not a type graph for the last two); every single item must be
verified before anyone acts on it.

## Tests

| Command (from `frontend/`) | Result |
|---|---|
| `npx playwright test -c playwright.unit.config.ts tests/unit-entry-chunk.spec.ts` | 7 passed (written before the script) |
| `npx tsc --noEmit` (the gate's type check; includes the new spec) | exit 0, no diagnostics |
| `npx playwright test -c playwright.unit.config.ts tests/unit-entry-chunk.spec.ts tests/unit-perf-home-devices.spec.ts` (the tooling area: lazy-tags guard, entry chunk) | 15 passed |
| `node --test scripts/visual.test.mjs scripts/public-camera.test.mjs` (the other script tests in `frontend/scripts`) | 11 passed, 0 failed |
| `node scripts/bundle-budget.mjs`, `node scripts/api-client-check.mjs`, `node scripts/unused-exports.mjs`, `npx eslint src` | each ran and exited 0 (numbers above) |

Timing is NOT measured meaningfully: the workstation was at 100 % CPU from other agents during this run (`tsc --noEmit` took
67 minutes wall time, `eslint src` 61 minutes, the unused-export report about 3 minutes, mostly file reading). Type-aware ESLint
over all of `src/` is the slow one; its run time on the runner should be measured before CR-FE-GATES-ENFORCE puts it in a lane.

## Skipped / NOT_RUN

- **`tsconfig.json` split and `tsconfig.tests.json` - skipped.** The row assumes the app check can be made fast by moving `tests/`
  into a second config. But the release gate runs `npx tsc --noEmit` on `tsconfig.json` (`scripts/gate/release_gate.py:2083`) and
  `scripts/gate/targeted_plan.py` relies on "specs are type-checked: tsconfig includes tests/". Splitting without changing those
  gate files would silently stop type-checking 1,194 spec files, and the gate scripts are outside this row. The split belongs with
  the gate-script change in `CR-FE-GATES-ENFORCE-2436` (both files in one commit: `tsconfig.json` = app, `tsconfig.tests.json` =
  everything, the gate calls `tsc -p tsconfig.tests.json`).
- **`vite.config.ts` - not touched** (source maps wait for owner decision O3; no other change was needed: the budget reads
  `index.html` and the entry's existing source map).
- **Gate wiring - not done**: the tools are npm scripts only; no lane in `scripts/gate/*` (not in this row's file list).
  `CR-FE-GATES-ENFORCE-2436` wires and enforces them.
- **No assertion that `www/assets` has no `.map`** (07:F7's test): it would fail today; the count is reported instead.
- Runner: not used (no pixels, no Linux-only spec). Runner entry check: not queued (the lead combines wave 1).
