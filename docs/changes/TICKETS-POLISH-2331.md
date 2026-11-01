# TICKETS-POLISH-2331 - one compact toolbar for the request list and the manager board

Branch `pilot/TICKETS-POLISH-2331`, cut from `origin/main` (52a8d9129). No version bump, not merged.
Scope: `frontend/src/screens/tickets-list.ts`, `tickets-board.ts`, `tickets-table.ts` and their shared pieces
(`frontend/src/tickets/list-toolbar.ts` (new), `list-filter-row.ts`, `list-text.ts`, `my-numbers.ts`).
Skills: `impeccable` (context loaded with the launcher, polish + craft-floor references, `detect` clean on the changed files) and
`emil-design-eng` (motion and press rules). Design language: the polished service overview (POLISH-CONTROL-297, OVERVIEWFIT-297) and the
operator-screen kit of `docs/design/system/AUDIT_2026-10-27.md` §7.5. Tokens only.

## Critique (before)

Evidence: `docs/evidence/TICKETS-POLISH-2331/before/` (screenshots + `metrics-<project>.json`, same spec as after).

| Finding | Where | Measured |
| --- | --- | --- |
| Up to five rows of controls before the first request (audit P1-5): title + department chips, scope + six-way state strip + search + filter + new, the view switch alone on a third row, then the filter row | list, board | first card at 339 px (list 1440), 450 px (board 1440), 496 / 768 px (board 1024) |
| Phone: department chips, scope, the state strip in two rows, search row, view-switch row and a 2 x 2 KPI block | list, board | first card at 659 / 844 (list), 822 / 844 (board) |
| The board had two filter buttons ("סינון" for the floors tree, "סינון" for the card filters) and a tree toggle on the title row | board | - |
| The header faded its toolbar out while the inner region scrolled on a desktop (no room gained: the header never shrinks) | list, board | - |
| Search placeholder clipped at 1024 ("חיפוש לפי מספר, כותרת או ה") | board | - |
| The table card had its own `max-block-size: 100dvh - 300px` inside a scrolling region (two nested vertical scrollers) | table | - |
| Portrait tablets (768-1023) scrolled the whole page | list, board | - |
| Filter row: one wrapping line of labels, separators and chips; a narrowed list said so only while the row was open ("סינון" turned loud blue) | list, board | - |

## Changes

| Before | After | Why |
| --- | --- | --- |
| View switch + "+ חדשה" on the toolbar row (wrapped to a row of its own) | On the title row, at its inline end (page actions, audit §7.5.1) | frees the toolbar; the title row existed anyway |
| Department chips row on the title row (list), department segment row (board) | In the "סינון" panel, as chips with counts | §7.5.3: chip groups with counts go into the sheet |
| Six-way state strip on the list toolbar | In the panel (radio chips with counts); a non-default state shows as a chip "מצב: …" | one segmented scope per toolbar |
| Separate filter row under the header + a second "סינון" for the board's tree | ONE "סינון" panel anchored under its button: state / departments / floors tree (D19 chips + tree) / priority / handler / flags, each a titled section, with "איפוס כל המסננים" and "סגירה" | one place for everything that narrows |
| Active filters visible only inside the open row | Removable chips next to "סינון" (soft accent, x inside), "איפוס" when two or more; the button carries a small count badge instead of turning primary blue | a narrowed list always says so |
| Tree toggle on the title row | "הסתרת העץ" on the tree's own head; "הצגת העץ" in the toolbar while hidden | §7.5.9 |
| Header compacts while the inner region scrolls (toolbar hidden) | Compacts only when the page itself scrolls (phone) | the toolbar stays usable |
| Inner scroll region from 1024 px | From 768 px (portrait tablets no longer scroll the page) | owner rule, no page scroll on control screens |
| Table: nested scrollers, fixed max height | `tickets-table[fill]`: the table card fills the region, rows scroll under the sticky head, the region itself does not scroll | one scroller, sticky header kept |
| KPI ("שלי" numbers) label over a big number, 2 x 2 on a phone | Number beside its label on one compact row; a horizontal snap strip on a phone | §7.5.4, first request higher |
| Panel: no motion | 120 ms opacity + 4 px rise (`@starting-style`, token duration, zero under reduced motion); chips press `scale(0.97)`; hover only for `(hover: hover) and (pointer: fine)` | emil-design-eng: occasional surface, quick, interruptible |
| Phone: the old filter row in the page flow | A bottom sheet just above the dock (fixed, opaque, rises 8 px); the header does not compact while it is open | a panel inside the sticky header could not scroll (caught by evidence-tickets-ui4 on mobile) |
| Keyboard | Panel: focus moves to its first control on open, Escape closes and returns focus to "סינון", a press outside closes; chips are buttons with "הסרת המסנן …" labels | - |

Kept: every feature and data hook (`data-scope-seg`, `data-status-filter`, `data-dept`, `data-state-strip`, `data-filter-toggle`,
`data-filter-row`, `data-filter-btn` (board, D19 chips + tree), `data-filter-panel`, `data-tree-toggle`, `data-assignee-filter`,
`data-f-clear` (now the panel's reset), `data-new`, `data-view-switch`), counts, intake / inbound chips (now at the toolbar's end),
settings (D18-D22, D30, D33), the table's own toolbar (columns, saved views, its server-side filters, density, export).

## Tests (workstation, fake data through the mock layer, vite preview build on port 4200)

| Run | Result |
| --- | --- |
| `npx tsc --noEmit` (final code) | 0 errors |
| `unit-token-lint`, `unit-lead-reserve`, `unit-uxfix-rtl` (final code, `--workers=1`) | 25 passed |
| `evidence-tickets-polish-2331.spec.ts`, desktop + tablet + mobile (build before the phone-sheet change) | 15 passed |
| `evidence-tickets`, `serviceia2-list`, `tickets-calendar`, `tickets-ui4`, `tickets-board`, `tickets-table`, desktop + mobile (same build) | 97 passed, 21 skipped, 2 failed (ui4 mobile: the filter row test and the board filter row test - the panel inside the sticky header could not scroll; fixed by the phone bottom sheet, NOT re-run) |
| Everything on the final build (the phone sheet), `layout-tickets*`, `unit-tickets-*`, pixel baselines | NOT_RUN (workstation out of memory; the coordinator stopped local builds and browser runs - they run on the runner gate) |

- New: `frontend/tests/evidence-tickets-polish-2331.spec.ts` (desktop 1440 + 1920, tablet 1024 + 1180, phone 390): measures the first
  request's top, the toolbar's rows and the page scroll (`SW_SHOT_TAG=before|after`); asserts one toolbar row from 768 px, no page
  scroll from 1024 px, the panel, chips, reset, Escape returning focus; captures the empty and error states.
- Updated for the panel (state and departments are one click deeper): `evidence-tickets.spec.ts`, `evidence-serviceia2-list.spec.ts`,
  `evidence-tickets-calendar.spec.ts`, `evidence-tickets-ui4.spec.ts` (and the compact-title test: from a tablet up the header no longer
  compacts while the region scrolls).

### Measured (first request top / toolbar rows; `docs/evidence/TICKETS-POLISH-2331/{before,after}/metrics-*.json`)

| Screen @ size | Before | After |
| --- | --- | --- |
| list cards 1440x900 | 339 px / 2 rows | 237 px / 1 row |
| list table 1440x900 | 439 px / 2 rows (+ table toolbar) | 337 px / 1 row (+ table toolbar) |
| board 1440x900 | 450 px / 2 rows | 388 px / 1 row |
| board 1024x768 | 496 px / 3 rows | 388 px / 1 row |
| list cards 390x844 | 659 px / 4 rows | 358 px / 2 rows |
| board 390x844 | 822 px / 4 rows | 681 px / 2 rows |

The after screenshots predate the phone bottom sheet: `list-filter-open-390x844.png` shows the old in-flow panel.

## Pixel baselines likely affected

Every tickets list / board / table capture: `layout-tickets.spec.ts`, `layout-tickets-board.spec.ts`, `layout-tickets-table.spec.ts`,
`layout-tickets-calendar.spec.ts`, `layout-tickets-tabs.spec.ts`, the tickets screens of the design-audit sweep and the visual baselines
under `frontend/tests/visual*/` that include `#/tickets/mine`, `#/tickets/department`, `#/tickets/all`, `#/tickets/board`
(cards, table, calendar, board, filter row, empty). Refresh on the runner before the branch boards a train (owner rule 30.10).

## Left

- The table view still shows two "סינון" buttons: the page's (state, department) and the table toolbar's own server-side filters
  (priority, handler, waiting, stuck, dates). Folding the table's filters into the one panel needs the toolbar's filter state lifted into
  the host; not done here.
- The table's horizontal overflow at 1440 with the default columns (the place column is cut, scrolls sideways) is unchanged.
- Rollback: revert the branch commits; no data, settings or API change.
