# POLISH4-WP3-SERVICE-2370: the service area (polish round 4, release 2.37.0)

Branch `pilot/POLISH4-WP3-SERVICE-2370`. Package WP3 of `private/planning/POLISH_ROUND4_SURVEY_2026-11-02.md`: ticket full screen,
handlers, vendor accounts, tickets overview, maintenance pages, tickets table overflow. Refinement only: no menu, tab, widget, title or
control order moved. No version bump, no merge, no tag.

Base: first cut from `origin/release/2360-train` @ 44b8383c2 (v2.34.2 was not in it yet), then re-based (clean, no conflicts) onto
`origin/release/2360-train` @ eb9525d9b, which contains v2.34.2 / 2.35.0. All SHAs below are the re-based ones; the runner results marked
"re-based" ran on `ed224951e`.

Commits (re-based): `6a1e903a5` D3 + D6 (+ hover / radius tokens), `a752acda9` D4, `8ce12b74f` D5, `aa365b8f1` guard fixes
(icon first on empty panels, no token fallbacks), `ed224951e` evidence specs, then this document.

## Defects

| # | Before | After | Files |
|---|---|---|---|
| D3 | `#/tickets/<id>`: while the module answered the page was an empty `aria-busy` div (a blank page); off and error were a private `.statebox` with no retry (the module read could not be repeated at all) | a skeleton of the real page (back key, head, status block, three rows) in the ticket frame's padding; off = `sw-state-panel` (empty, ticket icon); error = `sw-state-panel` with "נסו שוב" that repeats the module read; the ticket's own gone / failed states on the full screen are the panel too (the drawer keeps its small box until the shared `bare` variant exists) | `screens/tickets-detail.ts`, `tickets/ticket-detail.ts` |
| D3 (overview) | off / forbidden / empty / error were the private box (the error one with a bare retry button) | one `sw-state-panel` per state (error with retry, empty with the "new request" link in the panel's slot); `data-overview-state` hooks kept | `screens/tickets-overview.ts` |
| D4 | the handlers page had its own header toolbar (segments, a row of department chips, period, search, new) and showed receipt / error as inline lines under the header | stands on `tickets/list-toolbar.ts`: the list's toolbar frame and phone rules; the departments behind the "סינון" panel with the removable active chip (the chips keep `data-handlers-dept` inside the panel); control order kept (segments, filter, period, search, new); on a phone "new" is the plus key on the search row (44 px, aria-label); receipt and error are toasts in view (the TKSET recipe: the error stays until dismissed) | `screens/tickets-handlers.ts`, spec `evidence-tickets-handlers.spec.ts` |
| D5 | no `@media` at all; first load was the spinner panel | skeleton of the page on first load; on a phone the six filters take two to a row, filter inputs and the select-all line are 44 px, the actions stack as full-width keys (the two tables are cards already, `sw-table`) | `tickets/vendor-accounts.ts` |
| D6 (tickets) | "(דרך Home Assistant)" in the public-link note | "זמין רק בגישה מקומית" (English twin too); the evidence spec follows | `tickets/text-s4.ts`, `tests/evidence-tickets-s4.spec.ts` |
| D27 | sideways scroll at 1440 with the default columns | **already fixed by the 1440 column setting** (`fitColumns`, `9b3d1306a`): the default set (1,092 px, 1,144 with the checkbox) fits the 1440 card and drops department, place, priority below it. Verified by `unit-small-ui-bugs-2343` (default columns at 1440 and 1280). `fitTable` is untouched. | none |
| D29 | phone buttons 44 px | resolved in 2.34.2 (`PHONE-BUTTONS-44-2342`); not redone | none |

Smaller polish in the exclusive files: hover only under `(hover:hover) and (pointer:fine)` (overview `.tl`, ticket menu items, table popover /
chip / row hovers, maintenance log / emergency links); pill and swatch radii from tokens (`--sw-r-pill`, `--sw-r-2xs`, `--sw-r-lg`) in
overview-tab, ticket-detail sizes, table-styles chips, the legend swatch and the KPI skeleton.

## Left for others (outside the exclusive files)

- `maintenance/styles.ts` (shared by the maintenance pages): ungated `.btn.pri:hover` and `table.t tbody tr.go:hover td`.
- `tickets/handlers-glass.ts`: ungated `.hcard:hover`; the `.hcard` hover shadow.
- The ticket drawer keeps the private `.statebox` (card-in-card) until WP1's `sw-state-panel bare` lands; then both states in
  `ticket-detail.ts stateBox()` can use it.
- Maintenance pages already have skeleton / empty / error-with-retry on `sw-state-panel`; no change needed.

## Tests

| Where | What | Result |
|---|---|---|
| workstation | `tsc --noEmit -p .` (src + tests), after the re-base | exit 0, no output |
| workstation | `playwright.unit.config.ts --workers=1 tests/unit-` (the whole unit tier), before the re-base | **3651 passed, 1 skipped, 0 failed** |
| workstation | after the re-base: `unit-small-ui-bugs-2343`, `unit-tickets-*`, `unit-token-lint`, `unit-empty-state-icons`, `unit-a11y-polished-lint`, `unit-dark-polish-beds`, `unit-menu-lint`, `unit-overview-pages-297` | **446 passed, 0 failed** |
| runner, preview, `--workers=1`, re-based `ed224951e` | `evidence-polish4-wp3-service` (new), `evidence-tickets-handlers`, `-vendor-accounts` (+ the new phone test), `-overview`, `-table`, `-s4`, `-needs-review`, `-ui6`, `tk260-expand-nav` | 240 listed: **143 passed, 97 skipped, 0 failed** (the skips are the specs' own tablet / phone-only / desktop-only gates) |
| runner, preview, re-based `ed224951e` | `layout-tickets-table` (the layout guard over the table: 4 skins x light / dark x widths 320-1440) | **4 passed** |
| runner, preview, before the re-base (`103b314f0` .. `4e2b57a19`) | `evidence-tickets-handlers`, `-vendor-accounts`, `-overview` | 102 listed: 68 passed, 34 skipped, 0 failed |
| runner, before the re-base | `evidence-tickets-s4`, `-needs-review`, `-ui6`, `-overview-p3`, `-overview-p4`, `-table`, `tk260-expand-nav`, `layout-overview-pages-297` | 82 passed, 67 skipped, **1 failed**: `evidence-tickets-table` column chooser (reset expects the department column). Cause: not this branch; the 2360 train lacked the GATE2342 spec fix for the 1440 column setting (the department column steps aside at 1440 with the sentence column). Gone on the re-based base (the same spec is in the 143 passed above) |
| runner, before the re-base | `layout-tickets-s4`, `layout-tickets` (+ the other `layout-tickets-*` sweeps), desktop | 60 listed: 47 passed, 9 skipped, **4 failed**: `layout-tickets-table` x4 skins, "[clipped] the created column cuts the running clock". Cause: GATE2342-B (the 148 px created column + wrap), on main, not yet on the 2360 train. Gone on the re-based base (4 passed above) |

New evidence in the branch: `tests/evidence-polish4-wp3-service.spec.ts` (ticket full screen: skeleton while the module answers, error panel
with "try again" that repeats the read; handlers: no department chip row, the filter panel stays inside the screen, the active chip
filters and removes, Escape closes; on a phone the search / filter / new keys share one 44 px row and stay on screen; light and dark) and
one phone test in `evidence-tickets-vendor-accounts.spec.ts` (two dates share a row, filters / csv / mark / select-all are 44 px, no
sideways scroll). Spec changes that follow the product: `evidence-tickets-handlers.spec.ts` opens the "סינון" panel before picking a
department; `evidence-tickets-s4.spec.ts` expects the neutral note.

## Baselines

No pixel or visual-matrix baseline covers these screens (no `*-linux.png` or matrix entry for handlers, vendor accounts, ticket full screen or
overview): none expected, none refreshed.

## NOT_RUN

- A visual review of the screenshots: the evidence specs write them on the runner and run_smart does not copy them back; layout was
  checked by the specs' measurements and the layout guard instead (no sideways scroll, panel inside the screen, 44 px keys).
- The full unit tier was not repeated after the re-base (the 446-test subset was); `tsc` was.
- Handlers / ticket full screen / overview at 1180 and 1024 were not measured one by one; `layout-tickets-s4` / `layout-tickets` (widths 320-1440,
  four skins, light / dark) passed on the pre-rebase branch, and were not repeated on the re-based one (only `layout-tickets-table` was).
- RTL is the app's own direction on every run above; no LTR / English pass.
- Tablet project: the service evidence specs skip it by design.
