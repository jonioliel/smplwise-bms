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

## Baselines refreshed

(filled at the end of the row)

## Tests actually run

(filled at the end of the row)

## Open questions (recommendation taken, for the owner's page)

1. Status chips in the module tables take the shared tones (the module chip palette stays on cards and phone rows). Keep? Recommendation: yes.
2. Columns that step out use the shared 1024 px breakpoint (the module used 1100 px). Keep? Recommendation: yes.
3. The special-days select now sits in the shared field (it fills its column). Keep? Recommendation: yes.
4. Water alerts: a closed alert's row is a (dead) tab stop now (sw-table makes every row focusable once it listens to row-select).
   Recommendation: a later sw-table option for per-row focus (`rowFocusable(row)`), small.
5. The tou-editor price grid and the chart number table: leave as they are (recommendation), or give `sw-field` a unit slot first and
   move the editor grid in its own row.
