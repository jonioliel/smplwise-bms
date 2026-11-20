# CR-CMP2-TABLES-REST-2470

2.47.0 row, owner answer N10 (19.11: tables move to the shared components, screen by screen) with the 19.11 evening answers N21-N46
(shared status tones and shared 1024 / 768 breakpoints in tables; controls in cells move to shared components first). Continues
`CR-CMP2-TABLES-2450` (read its note first: `sw-table` row / cell hooks, cell kinds, `bare`, `static-rows`, `--sw-table-min: 0`, the empty
slot), `CR-CMP2-TABLES-CONSUMPTION-2450` (foot row, links in cells) and `CR-CMP2-TABLES-GENMAINT-2450`.

Branch `pilot/CR-CMP2-TABLES-REST-2470`, base `origin/release/2450-train` (521165ad4). One commit per screen, so the train can drop a part.

Scope: the remaining hand-built tables OUTSIDE electricity, water, generator, maintenance (done, or owned by `CR-CMP2-GEN-REST-2460`) and
home. Not touched: `components/sw-table.ts` and `components/table-logic.ts` (`CR-CMP2-GEN-REST-2460` extends them now - group heading
rows, `keep-columns`; no second branch edits them), segmented controls / selects / form fields, `shell/sw-app.ts`, `router.ts`,
`management/tasks.json`. Every move uses only what `sw-table` already offers on the base.

## 1. Inventory and order

The settings screens (`screens/system-*`) held the most hand-built tables (19 in 13 files), so they went first; then the shared
components of the intercom module (`wk-ops-charts`, `wk-installer-confirm`). Within the module: read-only tables first, then the ones
with keys in their cells (`sw-button` is already a shared component), never a table whose cells hold a screen's own select / input /
checkbox (rule: those controls become shared components first).

## 2. Screens moved

| Screen | Commit | Notes |
|---|---|---|
| announcements history (`system-announcements.ts`) | 78f6ffa9e | the table gains a header (4 titles in he / en / ru / ar); outcome = shared tone chip (spoken ok, failed bad, held back warn, on its way info); text cut at the old 280 px with its full text as the title; phone row template (< 600 px); row hooks `data-announce-row` / `data-status`; the spec counts the rows by the row hook (the header row is new) |
| schedules "who may do what" (`system-schedules.ts`) | 8d2e90eb3, 288a7ab86 | tick / dash through the `yes` / `no` parts; uses the shared `sw-table.set-matrix` (below) |
| presence registered devices (`system-presence.ts`) | 05dfbc063 | inside = shared tone chip; the sensors line truncated (220 px); never wider than the card (the old wrapper scrolled sideways); `data-presence-device` |
| intercom ops events report (`system-intercom-ops.ts`, 3 tables) | 875b8a714 | per station (figures), anomalies / methods (the two key / value tables gain a header from existing strings: the section title and "total"); `data-ev-stations` / `-anomalies` / `-methods` on the sw-table elements, rows `data-ev-station` / `-anomaly` / `-method` |
| wall users (`system-wall.ts`) | 8a18693bf | state keeps `sw-badge` (the cards use it too); overload warning through the `warn` part; cells wrap as before; the table / cards switch moves to the shared phone edge 768 px (was 721) and only one of them is drawn (matchMedia) - a hidden card's keys came first for a page query because the table's keys now sit in the table's shadow root; two specs follow the 767 px edge |
| notifications delivery log (`system-notifications.ts`) | 73d17a180 | outcome = shared tone chip (sent ok, failed / gone bad, the rest neutral); module frame + header band kept; notification and reason truncated; the channel pictogram is left out (the module svg icon is styled by the screen and does not reach the table); `data-log-row` / `data-log-status`, empty line slotted |
| automations "who may" (`system-automations.ts`) + `styles/settings.ts` | 288a7ab86 | `table.set-matrix` (shared settings look) becomes `sw-table.set-matrix`: base reading size, 10 / 8 px cells, never wider than the card, tick / dash parts; the device-test column marks its cells (`data-col-device-test`; the kavarnit spec checks a row cell instead of the header); `.yes` class kept as the spec hook |
| calendar permissions (`system-calendars.ts`) | e5d036cd2 | sensitive = shared warn chip; the approval table (a select per cell) stays |
| NVR notify matrix (`system-setup.ts`) | see git log | motion mark = the tinted yes / no chip through `yn` / `yn-on` / `yn-off` parts; camera names wrap; `data-nvr-channel` rows, `data-nvr-motion` cell hook |
| intercom chart number twins (`components/wk-ops-charts.ts`, 2 tables) | see git log | day chart (day, granted, denied) and trend (sampled at, count); still visually hidden until "show as table" (screen readers read it always) |
| installer confirm diff (`components/wk-installer-confirm.ts`) | see git log | changed row: new value in the heading ink; unchanged row quiet; `data-key` / `data-changed` row hooks |
| notice boards + a board's notices (`system-notices.ts`, 2 tables) | see git log | boards open through `row-select` (tab stop, Enter / Space, arrows; the hand-made `tabindex` + `activateKeydown` are gone; the keys stop their own click); state chip in the shared tones in the table (the phone cards keep the module badge); severity chip info / warn / bad; `data-board`, `data-board-notice` + `data-look` |

Test support: `tests/unit-tables-rest-2470.spec.ts` (new): the moved screens draw `sw-table` and keep no other hand-built table (or exactly
the ones left on purpose), the shared tones in the moved status cells, the shared `sw-table.set-matrix`, the wall's single list.
`unit-a11y-rows-2443`: the notices boards row check follows sw-table (as the incidents row did in CR-CMP2-TABLES-2450).

RESULTS_PLACEHOLDER
