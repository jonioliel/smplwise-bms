# TICKETS-PAGING-2490: the tickets table pages instead of scrolling (owner decision Q20)

Branch `pilot/TICKETS-PAGING-2490`, cut from `main` at `619f94d04` (2.47.0). Owner rule 2026-10-24: a control screen never scrolls -
long lists page. Owner decision Q20 (SCROLL-AUDIT-2480 question 2 / offender 1): the tickets TABLE moves to pages; the case-details
dialog stays a scrolling document (not touched here). Same method and helpers as SCROLL-AUDIT-2480 (`components/page-fit.ts` +
`components/sw-pager.ts`, the installation's `ui.long_lists`); the tickets module keeps its own look (the table card, the toolbar
row, the bulk bar).

## 1. What changed (`screens/tickets-table.ts`)

| Before (2.47.0) | After |
|---|---|
| From a tablet up the table card took the room under the header and its rows scrolled inside it under the sticky head (`.tw { overflow-y: auto }`, TICKETS-POLISH-2331); "load more" at the bottom of the card | While the host gives the table its fixed region (`fill`, 768 px and up) the LOADED rows are cut into pages that fit the card: `PageFit` on `[data-table-wrap]`, rows `tr[data-fit-item]`, the table inside a `<section>` so the sticky head is counted on every page (page-fit.ts: a section's heading). `sw-pager [data-table-pager]` sits at the end of the toolbar row after the count (`<tickets-table-toolbar>` gained `<slot name="pager">`); "load more" moves beside it, on the last page, while the server has more |

- **The page is filled.** The pages are cut on the rows' natural heights; then, before the frame is painted, the rows of a page that is
  not the last are stretched over the room left (`--fit-row-h` = a row's minimum height, `fillHeight()` in tickets/table-model.ts:
  lower rows grow, a taller row keeps its height, quarter pixels, one pixel spare). The last page takes the same row height when it
  has the room. One page (few rows): nothing stretches, the card follows its rows as before, no pager.
- **The place is kept** (`PageFit` option `keep`, new): a resize, the bulk bar appearing / leaving, the 20 s poll, a deleted row and
  "load more" re-measure and show the page that holds the row first on screen (after "load more": the first new row). A new filter,
  sort, density, saved view or `fill` change starts at page 1. While re-measuring, the pager keeps the page count measured before
  (so the toolbar does not change height and restart the measure - seen at 820 px where the pager wraps the toolbar row).
- **The keyboard crosses pages**: ↑ ↓ Home End move the row focus across pages (`PageFit.reveal`); Tab reaches the focused row while
  it is on the page, else the page's first row.
- **The toast floats** (fixed, bottom centre, like the cards view's `.flt`) while the pages are in force: a toast pushing the card down
  would re-cut the pages twice in four seconds.
- `ui.long_lists = scroll` (הגדרות › כללי › עיצוב הממשק): the old inner scroll, every loaded row, "load more" inside the card.
- **Phone (< 768 px): unchanged** - the compact list, every loaded row, the page scrolls. Tried and dropped: at 390x844 the screen's
  header (tabs, title, view switch, scope, search, numbers, toolbar) takes ~590 of the 780 px above the bottom navigation, so a page
  held ONE compact row (40 pages for 40 tickets). Owner question 1 below; the capture is on the comparison page.

### Selection across pages (explicit)

| Gesture | Selects |
|---|---|
| a row's box, Space | that row (any page) |
| Shift + box / Shift + Space | the range from the anchor in list order, across pages |
| the header box (`selectPage`) | toggles the rows of the page ON SCREEN; the other pages keep their state (`togglePage` now adds / removes, it no longer replaces) |
| Ctrl/Cmd + A | the rows of the page on screen join the selection (the keyboard help already said "selects the page") |
| bulk bar "בחירת כל N {the_tickets}" (`data-bulk-all`, shown while there is more than one page and not all are selected) | every LOADED row. Rows the server has not sent yet (before "load more") are never selected - the bulk request names ids |
| Esc / "ביטול הבחירה" | clears everything |

The bulk bar counts every selected row and says how many are on other pages (`selectedOff`, `data-bulk-off`: "5 מהן בעמודים אחרים").
Changing page never clears the selection; a new query keeps only the rows still loaded (as before).

### Shared helper (`components/page-fit.ts`) - opt-in, the other screens unchanged

- `PageFitOptions.keep`: keep the place on a resize and on the same set growing / shrinking (`sync` with the same signature and another
  total); hold the page count while measuring again; a drawn page that still overflows is measured again from every item (twice at most,
  then split as before) instead of leaving a one-row page behind the split (seen when rows changed height after the first measure).
- `PageFitOptions.content`: measure the region's content box (inside its border and padding) - the table card has a 1 px border.
- `reveal(i)` (show the page that holds item i, now or after the next measure), `first` (the first item of the page), `refit()`
  (measure again; the table calls it when its shown columns change).
- Without options every existing user (maintenance lists, emergency, log, multimedia) behaves exactly as before: `sync` resets on any
  change, a resize goes to page 1, `pages` is 1 while measuring, the region's border box is measured.

## 2. Measured (40 rows, mocked backend, Chromium, classic light; `tests/layout-tickets-table-paging-2490.spec.ts`)

"room left" = between the last row and the card's content bottom on page 1; "row" = the drawn row height (natural 68 px, comfortable).

| Window | Before (2.47.0) | Rows per page | Pages | Row | Room left | Card / screen / shell overflow |
|---|---|---|---|---|---|---|
| 1280x800 | 40 rows, the card scrolls (2292 px) | 6 | 7 | 74 | 2 px | 0 / 0 / 0 |
| 1440x900 | 40 rows, the card scrolls (2192 px) | 7 | 6 | 77 | 2 px | 0 / 0 / 0 |
| 1920x1080 | 40 rows, the card scrolls (2012 px) | 10 | 4 | 72 | 3 px | 0 / 0 / 0 |
| 1024x768 (landscape tablet) | the card scrolls (2324 px) | 6 | 7 | 68 | 1 px | 0 / 0 / 0 |
| 820x1180 (portrait tablet) | the card scrolls (1908 px) | 11 | 4 | 71 | 1 px | 0 / 0 / 0 |
| 390x844 phone | compact list, the page scrolls (3807 px) | unchanged | - | - | - | page scrolls (as before) |

Before the row stretch (first pass): 1440x900 left 66 px under 7 rows, 1280x800 34 px, 1920x1080 40 px.

## 3. Tests

New `tests/layout-tickets-table-paging-2490.spec.ts` (10 cases; desktop project for 1280 / 1440 / 1920 / 1024x768 / 820x1180, mobile for
390x844): paged by default - in force, > 1 page, the card / tickets screen / shell main do not overflow, a full page ends within 3 px
of the card's bottom, every row on exactly one page (walks every page); `?long_lists=scroll` - every row drawn, no pager, the card
scrolls inside, the screen does not; phone - compact list unchanged, the page scrolls; a few rows - one page, no pager; selection across
pages (header box = this page, off-page count, Ctrl+A, "select all" = 40, header box clears this page only); keyboard across pages and
the place kept when the bulk bar appears; "load more" beside the pager on the last page shows the page of row 51.
`TKPAGE_SHOTS=<dir>` saves the captures, `TKPAGE_SHOTS_ONLY=1` skips the assertions (for the base build).
`tests/unit-tickets-table.spec.ts`: `togglePage` across pages, `fillHeight`.

Results: section 5.

## 4. Owner questions (recommendation first)

1. Phone: at 390x844 a page would hold one compact row. a) keep the phone's compact list with the page scroll, as today and as every
   other paged list on a phone (recommended) · b) page the phone too (one ticket per page) · c) page the phone after the phone header
   folds to one line (separate work on the screen header).
2. Row height: a full page reaches the card's bottom by stretching its rows (68 -> 72-77 px depending on the window). a) stretch
   (recommended; as the approved alarm fix) · b) natural rows, up to one empty row at the bottom of the card.

Comparison page (local): `private/planning/tickets_paging_2490_compare_2026-11-23.html` (images in the sibling folder) - before = 2.47.0
(the `smplwise_vms/www` build at `619f94d04`), after = this branch; 1440x900 and 1920x1080 (page 1, page 2), phone 390x844 (unchanged +
the dropped paged option), 1280 / 1024 / 820 tablet and `long_lists=scroll`, the selection across pages.

## 5. Runs

| Run | Where | Outcome |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | workstation (twice, last on the final source) | exit 0 |
| `npx eslint` on the changed files (page-fit, tickets-table, table-bulk / toolbar / model / text, en table-text) | workstation | exit 0, no findings |
| `py -3.12 scripts/design_ratchet.py` | workstation | no count above the baseline (px-literal 25485, scroll-container 226 - the new rules use tokens and `overflow-y: hidden`) |
| `tests/unit-tickets-table.spec.ts` | workstation | 16 passed |
| new `tests/layout-tickets-table-paging-2490.spec.ts` (desktop + mobile) | workstation, Vite dev server of the branch | 10 passed (the numbers in section 2) |
| `evidence-tickets-table`, `evidence-tickets-ui4`, `evidence-tickets-polish-2331`, `evidence-small-ui-bugs-2343` (desktop + mobile) | workstation, Vite dev server | 56 passed, 3 failed, 17 skipped at `17ea71883` - all three in evidence-tickets-table and all from the pages (a selection count read while the pages were measured again; "load more" now on the last page's toolbar row); spec adapted (`363e0c253`), the 3 re-run: 4 passed |
| `evidence-tickets-delete` "the bulk bar" | workstation | 1 passed after `ff9badfbe` |
| full `npm run lint` | workstation | NOT_RUN to the end (stopped after ~30 min: the workstation was at 100 % CPU / 0.3 GB free); run on the runner instead |
| runner slot B `~/work/tkpage/run.sh` at `3318d09a8`: tsc, full `eslint src`, `vite build`, the 93 spec files `tests/*tickets*.spec.ts` + `evidence-small-ui-bugs-2343` on vite preview, all three projects, `--workers=2`, no `-u` | runner | tsc 0, lint 0, build 0; Playwright **1737 passed, 1 failed, 359 skipped** (21.0 min). The failure: `evidence-tickets-delete` "the bulk bar" ("expected 5 rows, received 7": the page refills) - fixed in `ff9badfbe`. The paging spec measured the same numbers as the workstation (1440x900: 7 per page, 6 pages, 2 px left); `layout-tickets-table` (the 4 skins under test x 2 themes x 11 screens x 10 widths = 880 checks): 0 findings, 0 page errors; the pixel baselines in the set (`evidence-audit30c-tickets`, the board) passed without `-u` - no baseline moved, none refreshed |
| runner slot B `~/work/tkpage/rerun.sh` at `ff9badfbe` (the delete fix): `evidence-tickets-delete`, the paging spec, `evidence-tickets-table`, `unit-tickets-table`, all projects | runner | queued behind other slot B jobs when this was written - result in `~/work/tkpage/run2.log` / `pw2.log` |
