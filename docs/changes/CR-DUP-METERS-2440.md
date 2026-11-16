# CR-DUP-METERS-2440 - one meters page base and one meter card base for electricity and water

Branch `pilot/CR-DUP-METERS-2440`, based on `origin/release/2437-train` at `32c4a2275` (frontend base of batch -2440).
Plan row: `pilot/CR-DUP-METERS-2436` in `private/code-review-2026-11-13/MASTER_PLAN.md` (D16 = 06:DUP-2 + the meter card of 08:F25).
Behaviour change: none. Pixels: none expected.

## What and why

The code review found the electricity and water meters pages to be the same page written twice (203 identical lines), and the two
meter cards to be the same drawer written twice. A fix in one had to be repeated by hand in the other (NOSCROLL-297, GATEFIX2240,
AUDIT30-E5 were each applied twice).

### The meters page - `frontend/src/screens/meters-page-base.ts` (new)

`MetersPageBase<M, A>` owns what both pages did identically:

- the shell contract (`segments`, `params`), the list state (`meters`, `phase`, `error`, `q`, `view`, `collapsed`, `notice`, `access`);
- the life cycle: the permission subscription, the first load, the 60-second poll, the guarded `load(initial)`;
- the address-bar filters (`setParams`, `?area=`, `?meter=`, `?add=1`), the stored view / collapsed-floors choices (`stored` / `store`);
- the search + area filter (`visible()`), the keyboard opening of a row (`onKey`);
- the head row (search, cards / table, the phone's area select, the add button), the areas tree (`sw-place-tree` rows);
- the frame: forbidden / loading skeleton / error / empty / no results / ready (`render()`);
- the layout rules, as two style fragments: `metersGridCss` (the two-column grid, the cards grid, the meter card tile) and
  `metersResponsiveCss` (the phone rules, the NOSCROLL-297 desktop rules with the GATEFIX2240 note).

A module supplies (abstract members): its config (storage keys, route, permission readers), its words (`texts()`), `fetchMeters()` and
the optional `afterLoad()`, the areas tree, the area and search predicates, `openMeter` / `openAdd`, and its own templates - the frame
`<div data-<module>="meters">`, the forbidden panel, the skeleton row, the two empty panels, the tiles, the table, the cards, the phone
rows, the add dialog and the meter card.

`screens/electricity/page-meters.ts` (498 -> 311 lines) and `screens/water/page-meters.ts` (457 -> 293 lines) are now those adapters.

### The meter card - `frontend/src/electricity/meter-card-base.ts` (new)

`MeterCardBase<D, K>` owns: `meterId` / `canManage`, the card state (`detail`, `phase`, `error`, `range`, `chartError`, `dlg`, `busy`,
`actionError`), the guarded load (a newer meter wins), the quiet `refresh()`, the chart's range arithmetic and load (`loadSeries`), the
`close` / `changed` events, the drawer that steps aside while a dialog is open, the range switch (`rangeSeg`), the actions row
(`actionsRow`) and the card's layout rules (`meterCardCss`). `electricity/meter-card.ts` (446 -> 387 lines) and `water/meter-card.ts`
(371 -> 300 lines) keep their API calls, facts, chart, dialogs and words.

The file sits in `electricity/` because the water module already imports its formats and styles from there.

## How "identical" was kept

- **DOM**: every element, attribute, `data-*` hook and text is unchanged. Two notes: (1) the page's outer `<div data-elec|data-water="meters">`
  is now ONE template whose `data-state` changes, so the same element lives across loading -> ready instead of being replaced (attributes per
  state are the same: `aria-busy` only while loading, the inline style / `class="page"` only when ready); (2) the electricity card's HTML
  comment above the drawer became a code comment.
- **CSS**: a script compared, per selector and media query, the final declarations of the old style sheet with the new composition
  (`base fragment + own rules`) for the four elements: identical, except that each page now also carries the other module's
  `[data-<module>='meters'][data-state='ready']` selector (it matches nothing there). The cascade ORDER matters in three places and is kept by
  the order of the fragments: electricity's `.head .inp` base rule stays before the phone rule of the shared fragment; the shared
  `.cards { display: grid }` stays before electricity's phone `.desk-only { display: none }`; the phone `.phone-only` rules stay in order.
- **Behaviour**: the same requests in the same order. Water: the open alerts are applied in the same synchronous step as the list (kept in
  `afterLoad`, which runs before the first `await`). The search and area predicates are the two original expressions, moved as they were
  (they differ between the modules: electricity also matches the floor NAME as a floor key, water keys a floor-less meter as `''`).
- The base method is named `matchesSearch`, not `matches`: `matches` is `Element.matches` (tsc caught it).

## Resolved file list

New: `frontend/src/screens/meters-page-base.ts`, `frontend/src/electricity/meter-card-base.ts`.
Changed: `frontend/src/screens/electricity/page-meters.ts`, `frontend/src/screens/water/page-meters.ts`,
`frontend/src/electricity/meter-card.ts`, `frontend/src/water/meter-card.ts`.

## Outside my rows

- `frontend/src/electricity/meter-card-base.ts` is a new file the row does not name (the row lists only the two card files; a shared base
  needs a home).
- Nothing else. In particular `frontend/src/water/ui.ts` is untouched (see "Left for later").

## Left for later (closing chain / follow-up)

- `water/ui.ts` still exports its own `stored` / `store` (other water pages use them; identical to the pair now in
  `meters-page-base.ts`) and `waterBarChart`, the superset twin of `barChart` in `electricity/meter-card.ts`. Folding them needs
  `water/ui.ts`, which is not in this row.
- The customers-page helpers of 08:F25 (`electricity/elec-customers.ts` / `screens/water/page-customers.ts`) are not in this row.

## Tests actually run (workstation)

Node 24, Windows; browser specs against the Vite dev server of this worktree (`SW_BASE_URL=http://127.0.0.1:5441/`), `--workers=1`.

| What | Result |
|---|---|
| `npx tsc --noEmit` | clean (0 errors) |
| CSS comparison script (old sheet vs `base + own`, per selector and media query; 4 elements) | identical, plus the expected extra `[data-<other module>]` selector on each page |
| `playwright.unit.config.ts`: `unit-empty-state-icons`, `unit-dark-polish-beds`, `unit-a11y-polished-lint`, `unit-water-nav`, `unit-water-billing`, `unit-electricity-readings` | **33 passed** |
| desktop: `electricity-meters.spec.ts`, `electricity-meter-rename.spec.ts`, `electricity-meter-device-name.spec.ts` (30 tests) | **29 passed, 1 failed** on the first run (`electricity-meter-device-name.spec.ts:35`, the first test against the cold dev server); that file alone again: **2 passed** |
| desktop: `electricity-readings.spec.ts`, `evidence-wkwater-2331.spec.ts`, `layout-noscroll-297.spec.ts`, `layout-audit30-e-infra.spec.ts`, filtered with `-g "electricity: \|meters: table, cards\|states: empty, error\|electricity-meters\|elec-meters\|water"` (29 tests) | **28 passed, 1 skipped** (the spec's own skip) |
| mobile: `electricity-meters.spec.ts` + `evidence-wkwater-2331.spec.ts`, `-g "meters overview\|the meter card\|adding a meter\|meters: table, cards\|states: empty"` (14 tests) | **13 passed, 1 skipped** |

The screenshots `evidence-wkwater-2331.spec.ts` wrote (`docs/evidence/WKWATER-POLISH-2331/after/`) were deleted, not committed.

## NOT_RUN

- The full frontend suite, the pixel suites and the tablet project (runner only; no entry check in this batch).
- `evidence-electricity-meters.spec.ts`, `layout-electricity-meters.spec.ts`, `evidence-media-polish.spec.ts`,
  `evidence-insights-polish-2331.spec.ts` (screenshot / layout sweeps of the same screens; left to the runner).
- `npm run build` (not needed by the row).

## Pixels to refresh

None expected (same DOM, same computed styles). No PNG was regenerated or committed.
