# CR-CMP2-TABLES-CONSUMPTION-2450

2.45.0 row, the consumption half of owner answer N10 (19.11: tables move to the shared components, screen by screen) after
`CR-CMP2-TABLES-2450` gave `sw-table` its row / cell hooks and cell vocabulary. Scope: the hand-built tables of the ELECTRICITY and
WATER modules (`frontend/src/electricity/*`, `screens/electricity/*`, `screens/water/*`), one module at a time, one commit per screen.

Branch `pilot/CR-CMP2-TABLES-CONSUMPTION-2450`, base `origin/pilot/CR-CMP2-TABLES-2450` (86cae1832). Not touched: segmented controls and
non-table form fields (`CR-CMP2-SEGMENTED-B-2450`), generator / maintenance (later rows), `management/tasks.json`, the bill paper / PDF
(print path), `shell/sw-app.ts`, `router.ts`.

Decisions taken (recommended options; the owner page is pending): the shared status tones in table cells, the shared breakpoints
(1024 / 768 px instead of the module's 1100 px for the columns that step out).

## 1. `sw-table` additions (eed92c4a5) - all opt-in, no existing table changes

| Addition | Why |
|---|---|
| `TableColumn.foot` | a foot row (`<tfoot>`, bold under a strong rule) - the account's "total to bill" and the formula preview's result; an empty foot cell leaves the phone stack |
| `a.t1` / `a.lnk` in a cell | the row's link (names the row, its tab stop for `no-focus-rows` tables) and an accent link; no underline until hovered, a focus ring, the hit area through `--sw-table-link-h` |
| two-line truncate | `td.k-truncate .trunc > .t1 / .t2` each take their own ellipsis (the meter name over the sensor name) |

The module skin (`electricity/styles.ts`, shared by water): `sw-table.t` keeps the module's header band (`--sw-table-head-bg`), its
reading size and 12 px rows (water: 9 px, `water/styles.ts`), is never wider than its card (`--sw-table-min: 0`), links on
`--elec-touch`; cells wrap as `table.t`'s did (`::part(cell)`; figures, chips and keys stay on one line); a shared field in a cell
(`sw-field part="field"`) keeps the module's control height (ae8e014ae). Bespoke cell looks reach the shadow root through parts: `bad`
(danger ink), `up` / `down` (water change), `share` / `share-track` / `share-fill` (water usage bar), `tick` / `tick-on` / `code`
(permission matrix). A table that is the card itself carries `class="t card flush"` (the module's card wins over the table's own
frame); a table inside a card is `bare`. `electricity/table-tones.ts` maps the module chip classes onto the shared tones; the water chip
helpers carry both the module class and `data-tone`, so one helper serves cards, phone rows and cells.

## 2. Screens moved

| Screen | Commit | Notes |
|---|---|---|
| electricity meters (`screens/electricity/page-meters.ts`) | 5cf32b48f | the list's card + scroll box (header sticks); row-select opens the meter card (rows are tab stops, arrows walk); `data-meter` |
| electricity accounts list (`elec-account-list.ts`) | 3336f2ac3 | name link (`no-focus-rows`), formula truncated, steps out below 1024 px; `data-account-row` |
| electricity account page (`elec-account-page.ts`) | a8e9ad943 | meters of the formula + foot total; history (`data-history-row`, `data-status`) |
| electricity bills table (`elec-bills-table.ts`, 3 screens) | 922696bb2 | number link; `data-bill-row`, `data-bill-state`; issue date steps out below 1024 px |
| electricity bill page, time-of-use (`elec-bill-page.ts`) | 955614a3b | per-band (`data-band`) and daily (`data-day`) tables; the bill paper untouched |
| electricity formula preview (`elec-formula-editor.ts`) | 8a493fc05 | result in the foot row (`data-formula-result`) |
| electricity wizard next periods (`elec-wizard.ts`) | 39afcd304 | `data-periods` |
| electricity tariffs (`elec-settings.ts`) | 8f1f316d2 | manager rows open the tariff through row-select (now keyboard reachable); viewer rows static |
| electricity special days (`elec-settings-calendar.ts`) | 76c821346, ae8e014ae | the day-kind `<select>` moved into `sw-field` first (the phone list shares the cell); `data-day`, `data-kind` |
| electricity permission matrix (`permission-rows.ts`) | db5176d41 | `data-energy-row`, cell hook `data-role`; tick look through parts, `.tick.on` kept as the hook |
| water meters (`screens/water/page-meters.ts`) | f34d85913 | as electricity; `meters-page-base` drops the `table.t` sticky rule |
| water accounts screen (`page-accounts.ts`, 4 tables) | c74c9d80d | list, one account's meters, history, the bills table (also bills page / customer card) |
| water alerts (`page-alerts.ts`) | c8ffa00f2 | the fitbox scroll box under the tiles; ack / snooze in the actions column; `data-alert` (+ `data-closed`) |
| water usage (`page-usage.ts`) | 70635039f | fitbox; share bar + change through parts; `data-meter` |
| water customers (`page-customers.ts`) | dfa7902b7 | name link (`no-focus-rows`); `data-customer-row`; `unit-a11y-rows-2443` follows |
| water tariff versions (`page-settings.ts`) | b21139e12 | `data-version`; delete key in the actions column |

Tests: 22af7ab23 (`unit-sw-table`: foot row, links, two-line truncate, a guard that no hand-built data table comes back in the 16 moved
files). 168da9be0: `TableTone` file-local (unused-exports).

Not moved (recorded, not guessed): `elec-bill-paper.ts` and the water bill `.paper` table (print / PDF path, task rule),
`elec-chart.ts` (the chart's own number table: transposed, one row, one column per bar - not a list of records),
`elec-tou-editor.ts` prices (an editor grid of price inputs with a unit inside the frame; `sw-field` has no unit slot yet).

The train moved while the row ran: `origin/release/2440-train` (43ad4766e) merged in at 6973fc480 (no overlap with the moved tables).

## Baselines refreshed

NOT DONE in this session: the 2.44.0 release gate (`release/2440-train`) held the runner the whole afternoon (still in its playwright
phase after 2 h 30 min). The refresh is queued on the runner as `~/work/tablescons-run1.sh 6973fc480` (log `~/work/tablescons-run1.log`,
results `~/work/tablescons-out1/summary.txt`): it starts only when `gate_status.json` shows no gate running, and every step waits while
one runs (nice -n 19, `--workers=1`, own folder `~/work/tablescons`). It rewrites the changed AUDIT30-E shots, verifies the whole spec
without `-u`, checks the `sw-table` specimen unchanged, runs the tablet project of the meters / water specs, and packs the changed
images into `~/work/tablescons-out1/snaps.tgz` (to be committed into this branch).

Expected to change (the only pixel baselines that draw a moved table): `frontend/tests/layout-audit30-e-infra.spec.ts-snapshots/
audit30e-elec-meters-1440-desktop-linux.png` and `audit30e-water-1440-desktop-linux.png` (the meters tables: shared header caption,
shared chips). No visual-matrix screen covers electricity / water; `pixel-sw-table` is unchanged by construction (every addition is
opt-in).

## Tests actually run

Workstation (Windows), Vite dev server of this worktree on its own port and dependency cache, `--workers=1`:

- `npx tsc --noEmit -p tsconfig.json`: exit 0 (code head, and again after the train merge 6973fc480); `-p tsconfig.tests.json`: exit 0.
- ESLint (the repo config, plugins resolved from another worktree's full node_modules; this junction lacks `typescript-eslint`) on all
  23 touched source files: 0 errors, 0 warnings.
- `node scripts/unused-exports.mjs --enforce`: first run FAIL (`TableTone` file-local) - fixed in 168da9be0; rerun OK.
- Unit (`playwright.unit.config.ts`): `unit-sw-table`, `unit-a11y-rows-2443`, `unit-a11y-polished-lint`, `unit-dark-polish-beds`,
  `unit-empty-state-icons`, `unit-i18n-cal-elec-lint`, `unit-poll-screens-b-2440`, `unit-customer-form-2440`,
  `unit-electricity-customer-form`: 65 passed, 0 failed. After the field fix: `unit-sw-table` 16 passed; after the train merge:
  `unit-sw-table` + `unit-a11y-rows-2443` 26 passed.
- Browser, desktop: `electricity-meters`, `electricity-meter-device-name`, `electricity-meter-rename`, `electricity-accounts`,
  `electricity-bills`, `electricity-tou`, `electricity-wizard`: 83 passed, 0 failed. `layout-noscroll-297` + `layout-audit30-e-infra` +
  `evidence-wkwater-2331` + `evidence-tariff-names-en-2440` (filtered to the electricity / water cases): 37 passed, 1 skipped (a pixel
  shot without a win32 baseline), 0 failed.
- No-scroll / layout guards (owner rule): `layout-electricity-meters`: 1 passed. `layout-electricity` (`LAYOUT_QUICK=1`, 4 widths, every
  skin under test, light + dark, 336 checks per skin): run 1 FAILED 4 of 4 skins on one finding only - the special days' select in
  `sw-field` was 32 px tall at 820 px (< 44 touch); fixed in ae8e014ae; run 2: 4 passed, 0 findings, 0 page errors.
  `electricity-tou` after the fix: 4 passed.
- Browser, mobile: `electricity-meters`, `electricity-accounts`, `electricity-bills`, `electricity-tou`, `evidence-wkwater-2331`:
  73 passed, 2 skipped, 0 failed.
- Looked at in the browser (desktop, the electricity harness): accounts list, account status (foot row), history, special days, prices
  (dark, domus).

## NOT_RUN

- Runner: the AUDIT30-E pixel refresh and verification, the tablet project, the `sw-table` specimen check (queued, see above).
- `layout-electricity` full widths (10 widths; the quick 4-width sweep ran), the tablet project on the PC.
- Full unit / evidence / pixel suites, the visual matrix, the entry check (`branch_check.sh`) - not queued (gates first).
- No lab / device test (UI only).

## Open questions (recommendation taken, for the owner's page)

1. Status chips in the module tables take the shared tones (the module chip palette stays on cards and phone rows). Keep? Recommendation: yes.
2. Columns that step out use the shared 1024 px breakpoint (the module used 1100 px). Keep? Recommendation: yes.
3. The special-days select now sits in the shared field (it fills its column). Keep? Recommendation: yes.
4. Water alerts: a closed alert's row is a (dead) tab stop now (sw-table makes every row focusable once it listens to row-select).
   Recommendation: a later sw-table option for per-row focus (`rowFocusable(row)`), small.
5. The tou-editor price grid and the chart number table: leave as they are (recommendation), or give `sw-field` a unit slot first and
   move the editor grid in its own row.

## Release train 2.45.0, phase 1 - runner pass, layout fixes, baselines (RELEASE-2450-TRAIN agent, 19.11 evening)

The queued `~/work/tablescons-run1.sh` had run at 6973fc480 (14:05): build OK, AUDIT30-E 2 shots rewritten, spec verify 26 passed,
`pixel-sw-table` 9 passed, tablet evidence 30 passed / 2 skipped. Then the release-train pass (own worktree `~/work/t2450-cons`,
`nice -n 19`, preview build, `--retries=1`, no `-u`):

- Every spec file with a Linux baseline (52 files, all projects, `--workers=2`) at 9949182e8: 799 passed, 518 skipped (no baseline for
  that project), 1 flaky (`visual-matrix` state-panels dark mobile, a screenshot protocol error), **2 failed = the two expected AUDIT30-E
  shots**. Nothing else moved: the SELECTS / TABLES shared specs match the branch's baselines.
- `electricity-meters`, `evidence-wkwater-2331`, `layout-electricity-meters` (all projects): 87 passed, 6 skipped, 2 flaky (wkwater,
  load), **1 failed: `layout-electricity-meters` - 28 escape findings, the meters table 57 px wider than its card at 1024 px**
  (682 px in 625 px; every skin, sideways scroll inside the card). The quick sweep of the PC run (320 / 390 / 820 / 1440) skips 1024.
- `layout-electricity` (dev server, the full sweep of the gate: 4 skins x 2 themes x 10 widths): **76 findings per skin - the accounts
  table 37 px (768) and 65 px (1024) wider than its card**.

Fixes (three commits; cause: the move to `sw-table` changed the module's step-out width and its wrapping):

| Commit | What |
|---|---|
| 4da59fb3a | `MetersPageBase` follows `(max-width: 1099px)` (`narrow`, the old `.dsk` rule of both modules); the meters tables leave the floor and their secondary column (electricity: accounts, water: month) out there instead of at sw-table's 1023 px |
| 9788c48c4 | the meters table lets the column titles and the state cell take a second line when the card is too narrow (the chip never breaks) |
| df9c0078c | the module skin lets every state cell wrap (`sw-table.t::part(cell-status)`: the last bill's number / a stale meter's "since" note go under the chip, as `table.t`'s cells did); the accounts list follows `(max-width: 1100px)` (the old `.hide-tablet`) for the formula column |

Verified at df9c0078c (runner): `layout-electricity-meters` 720 checks, **0 findings**; `layout-electricity` 4 skins x 840 checks,
**0 findings, 4 passed**; preview `layout-audit30-e-infra` + `pixel-sw-table` + `electricity-meters` + `evidence-wkwater-2331` (all
projects): 131 passed, 50 skipped, 2 failed = the two AUDIT30-E shots below. Workstation: `tsc -p tsconfig.json` exit 0 and ESLint on
the touched files clean after each fix.

Baselines refreshed (looked at, old vs new; the intended look of the moved tables - the shared header band, the shared tone chips, the
rows' height):

- `frontend/tests/layout-audit30-e-infra.spec.ts-snapshots/audit30e-elec-meters-1440-desktop-linux.png`
- `frontend/tests/layout-audit30-e-infra.spec.ts-snapshots/audit30e-water-1440-desktop-linux.png` (its stale chip shows the clock time of
  the run; the spec's 2 % tolerance covers it, as before)
