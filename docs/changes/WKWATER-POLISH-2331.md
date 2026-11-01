# WKWATER-POLISH-2331 - stations and doors, water pages: polish wave 3

Branch `pilot/WKWATER-POLISH-2331` from `origin/main` @ 52a8d9129. Visual and structural polish only: no WisKey behaviour, no door-opening
logic, no API, no setting changed. One bug fix on the way (water bills list, below).

Scope: `frontend/src/screens/wiskey-stations-css.ts` (the stations screen's own sheet; `wiskey-stations.ts`, `-views.ts`, `-actions.ts`
untouched), `frontend/src/screens/water/page-*.ts`, and the water module's own helpers `frontend/src/water/styles.ts`, `water/ui.ts`
and the water module shell `frontend/src/screens/infra-water.ts` (one CSS block, the twin of `infra-electricity.ts`'s NOSCROLL-297 rule).
No shared design tokens or `sw-*` components were edited.

## Evidence

- Mock backend for the water module: `frontend/tests/wkwater-mocks.ts` (invented building, meters, accounts, bills, customers; no device).
- Evidence spec: `frontend/tests/evidence-wkwater-2331.spec.ts` - desktop 1440x900, tablet 1024x768, phone 390x844 (`WKW_SIZES=1` adds
  1920x1080 and 1180x820). It asserts that the control screens do not scroll the page (document and the shell's `<main>`): water meters,
  usage and alerts at desktop and tablet, the stations screen at desktop.
- Screenshots: `docs/evidence/WKWATER-POLISH-2331/before/` (the build of 52a8d9129, taken locally). The `after/` set was NOT taken
  locally: the workstation ran out of memory and the coordinator stopped local builds / previews / Playwright evidence runs. The spec
  writes `after/` by default - run it on the runner gate against this branch.

## Critique (before)

Measured at 1440, 1024 and 390 wide (1920 and 1180 for the meters and the stations), against the electricity pages after
R5-MEDIA-ENERGY-297 / NOSCROLL-297 and the R5-SYSTEM / POLISH-CONTROL language.

Water, all pages
1. The water pages share the electricity sheet but missed the page-level R5 work done on the electricity meters: the selected area in the
   tree was a pale tint (electricity: a filled accent field), the tree buttons and the meter cards had no press feedback, hover was not
   gated to fine pointers, and the meter card's figure was a smaller, lighter numeral.
2. NOSCROLL (owner rule): the meters page scrolled the page at 1024x768 (41 px) and the usage page at 1024x768; at 1440x900 the meters list
   left half the window empty instead of filling it. Electricity fits these pages to the window and scrolls the list inside.
3. Inline styles carried colour and layout (alarm tile colours, phone-row end columns, skeleton rows, the usage amount) - not themable
   per page and repeated per file.
4. Keyboard: the alerts phone rows were click-only (no role, no tabindex, no key); the alerts table opened on Enter only (not Space);
   focus rings on clickable table rows / list rows were the browser default or missing.

Water, per page
5. Bills (bug): opening `#/infra/water/bills` directly never loaded the list - the page compared the first route ('' ) with its initial
   "shown" value ('') and skipped the load, so the list stayed in its skeleton. Only arriving from a bill loaded it.
6. Usage: the daily chart was drawn 560 px wide and sat in one half of a 1200 px card, the other half empty.
7. Alerts: the rule tile's time window "01:00-05:00" broke at its dash on a phone and read backwards in RTL ("01:00-" / "05:00").
8. Accounts / customers: in the edit sheet the save / cancel row was below the fold at 1440x900 (the form is longer than the sheet) - the
   actions were not visible without scrolling.
9. Bills: the state filter (six segments with counts) plus the search overflowed the head row on tablet widths.
10. The account sheet shows the page through it (the classic skin's translucent sheet surface) - see proposals.

Stations and doors
11. NOSCROLL: at 1440x900 the cards view scrolled the whole page (the title, the search, the filters went away with it); the second row
   of cards was cut by the window edge.
12. The toolbar and the columns below touched (no gap between the search row and the filter chips / tree).
13. List rows had no hover tone (the cards and chips do) and the station part no press feedback.
14. Phone list: a row with buttons (a ringing station: the call pill, answer, open) pushed its chevron onto a line of its own.
15. Cards of one row have equal heights, but the technical row floated in the middle of a shorter card instead of its foot.

Not changed (kept by decision): the cards' media ratio, the drawer's sections and their order, the door buttons and confirmation
(behaviour), the table columns and tiers, the feed badge in the header actions.

## Changes

Water
- `page-meters.ts`: the electricity meters' R5 rules - filled accent for the chosen area (count on it), press scale and fine-pointer hover
  on the tree, focus ring; the card's figure is the display numeral (4xl / 800, tabular) and the card answers the press; NOSCROLL-297:
  the tree and the list fill the height under the tiles, the table (sticky header), the cards and the tree scroll in their own boxes.
  Inline styles replaced by classes.
- `infra-water.ts`: the meters, usage and alerts pages take the height under the tab rows at >= 900 px (as `infra-electricity.ts`).
- `page-usage.ts` + `water/ui.ts`: the chart is drawn at the measured width of its box (ResizeObserver; 640 by default for the meter card),
  so it fills the card at every width; the per-meter table shrinks to the room left and scrolls inside (sticky header).
- `page-alerts.ts`: the same fit for the alerts table; phone rows are buttons for the keyboard (role, tabindex, Enter / Space), the
  table rows open on Space too; the rule's time window is one LTR unit.
- `page-bills.ts`: the list loads on a direct visit (fix of 5); the state filter scrolls sideways inside its row below 1100 px.
- `page-accounts.ts`, `page-customers.ts`: the form's save / cancel / delete row sticks to the foot of the sheet.
- `water/styles.ts`: the shared rules of the above (`.tile .v.alarm`, `.rowend`, `.li .amt`, `.skrow`, `.formacts`, `.page.fit`,
  `.scroll-seg`, focus rings on clickable rows and list items).

Stations and doors (`wiskey-stations-css.ts` only)
- NOSCROLL-297 above 1100 px: the screen takes the shell's height; title, toolbar and filters stay; the cards / list / table scroll in
  their own box (with room for the ringing pulse), the places tree in its column.
- A spacing token between the toolbar and the columns; list rows get the hover tone and the station part the press scale; on a phone the
  row's chevron is hidden (the whole row opens the drawer); a card's technical row is pushed to the card's foot (`margin-block-start: auto`;
  effective only where the card body fills the card - not verified visually, see Tests).

## Proposals (shared components, not edited here)

- `sw-sheet` (classic skin): the sheet surface is translucent enough that the page's figures read through a long form; a solid surface for
  sheets that hold forms would remove the noise. Shared component - for the owner of the design system.
- `sw-sheet`: a `footer` slot (as `sw-dialog` has) would make "actions always visible" structural instead of the page-level sticky row.

## Pixel baselines likely affected

- `frontend/tests/pixel-wiskey-stations.spec.ts-snapshots/*` - all (toolbar gap; desktop: the screen fits the window, the list / cards box).
- `frontend/tests/pixel-wiskey-station-media.spec.ts-snapshots/*` - the screen behind the drawer (same reasons).
- No water pixel baselines exist.

## Tests

- `npx tsc --noEmit`: PASS (exit 0) on the final source.
- Unit specs (`playwright.unit.config.ts`): unit-token-lint, unit-lead-reserve, unit-uxfix-rtl, unit-water-nav, unit-water-billing,
  unit-wiskey-stations, unit-wiskey-stations-nav - 87 passed, 0 failed, on the final source.
- `vite build` of the branch: PASS (31 min on the loaded workstation).
- `tests/evidence-wkwater-2331.spec.ts` BEFORE (build of 52a8d9129): 45 tests; final state 40 passed, 5 failed - the failures are the
  findings: meters and usage scroll the page at 1024x768 (41 px and more), and the bills list never loads on a direct visit
  (desktop, tablet, phone).
- `tests/evidence-wkwater-2331.spec.ts` AFTER: NOT_RUN (workstation memory; runner gate).
- `tests/evidence-wiskey-stations.spec.ts`, `layout-wiskey-stations.spec.ts`, `pixel-wiskey-stations.spec.ts`,
  `pixel-wiskey-station-media.spec.ts`, `evidence-wiskey-stations-skins.spec.ts`: NOT_RUN (same reason). The pixel baselines listed
  above need a refresh on the runner before this branch boards a train.
