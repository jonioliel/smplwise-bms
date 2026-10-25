# NOSCROLL-295: control screen list views fit the viewport (audit and fit-to-height paging)

Branch `pilot/NOSCROLL-295`, based on `release/2201` @ `8aa101a4d` with `pilot/FIX2200-295` @ `2087620163` merged.
Owner rule 2026-10-24: control screens never scroll; they fit the viewport. Reference viewport 1366x768; also checked at 1440x900,
1180x820 (landscape tablet) and 390x844 (phone).

## 1. What changed

- `frontend/src/api/screen-display.ts`: FIX2200's `measureFit()` (schedules rows view) is lifted into a shared
  `measureFitItems({ host, list, itemSelector, pager, padded })`. It keeps the same inputs: the screen's bottom, the pager band (44 px
  when no pager is shown yet), the page and host padding, the list's own padding, the item pitch. Two things change:
  - It counts **rows where they are**: the bottom of each row of items against the screen's bottom, extrapolating by the pitch only
    beyond the last item shown. FIX2200's `list height / pitch` holds only for uniform rows. Cards differ in height, so with that
    ratio the fit moved with the cards shown and flipped between two values without end (the phone automations cards view froze).
  - It handles a grid of cards: whole rows times the grid's column count.

  The screens take a new fit only when it is **smaller** than the one in force. A window resize, a change of view or a change of
  segment resets it, so it cannot oscillate. `fittedPageSize(setting, fit)` applies it, so **the page size setting stays the maximum**:
  `ui.page_size.*` and their defaults are unchanged (10 / 7 schedules, 12 / 9 automations). The fit never drops below one row
  (FIX2200's floor was PAGE_SIZE_MIN = 3 rows; one tall card on a phone needs less). `?fit=off` in the address turns the fit off for
  that page; it is used by the evidence specs that read every item on one page (see section 4).
- `devices-schedules.ts`: the fit now covers the **table** and **cards** views as well as rows (ungrouped list only, as in FIX2200).
  The fit is re-measured when the view changes.
- `devices-automations.ts`: the same fit for the automations **rows** and **cards** views, re-measured on window resize, segment change
  and view change. It waits for the row and card elements to render before measuring. The **scripts** segment is now paged too
  (`sw-pager`, the same `lfoot` band). Scripts have no page size setting, so the fit alone decides and every script stays on one page
  when they fit.

## 2. Audit table: vertical page overflow in px, before -> after

Demo mode (every `/api/v1` call aborted, `?design=a`), clock pinned to 2026-10-05 12:00 Asia/Jerusalem, measured by a throwaway
Playwright script. Overflow is max(scrollHeight - clientHeight) of the document, the shell's `main`, the screen's wrapper and the screen
element. 0 means no page scroll. "Fixed" rows are the ones this branch changes.

| Screen | 1366x768 | 1440x900 | 1180x820 | 390x844 | Status |
|---|---|---|---|---|---|
| Schedules, rows (FIX2200) | 0 | 0 | 0 | 0 | already fitted by FIX2200 |
| Schedules, table | 464 -> 0 | 284 -> 0 | 412 -> 0 | 1110 -> 0 | fixed |
| Schedules, cards | 437 -> 0 | 257 -> 0 | 591 -> 0 | 1122 -> 0 | fixed |
| Schedules, week | 1307 | 833 | 1255 | 2611 | section 3 |
| Automations, rows | 107 -> 0 | 0 | 103 -> 0 | 81 -> 0 | fixed |
| Automations, cards | 439 -> 0 | 307 -> 0 | 822 -> 0 | 1620 -> 0 | fixed |
| Scripts | 0 | 0 | 0 | 82 -> 0 | fixed |
| Scenes | 322 | 190 | 270 | 810 | section 3 |
| Home (overview) | 0 | 0 | 0 | 337 | phone only: section 3 |
| Notice board | 0 | 0 | 0 | 0 | fits |
| Announcements | 0 | 0 | 0 | 0 | fits |
| Settings, notice boards | 0 | 0 | 0 | 0 | fits |
| Access, overview | 0 | 0 | 0 | 221 | phone only: section 3 |
| Access, people | 0 | 0 | 0 | 0 | fits |
| Access, events | 0 | 0 | 0 | 0 | fits |
| Access, stations | 73 | 0 | 0 | 496 | section 3 |
| Access, schedules | 0 | 0 | 0 | 0 | fits |
| Tickets, mine | 0 | 0 | 0 | 43 | phone only: section 3 |
| Tickets, all | 50 | 0 | 89 | 1146 | section 3 |
| Tickets, maintenance | 0 | 0 | 0 | 43 | phone only: section 3 |
| Tickets, board | 808 | 632 | 885 | 1760 | section 3 |
| Tickets, overview | 1021 | 889 | 1547 | 1482 | section 3 |
| Tickets, RFQs | 86 | 0 | 34 | 834 | section 3 |
| Tickets, handlers and vendors | 183 | 51 | 179 | 763 | section 3 |
| Investigate, events | 0 | 0 | 0 | 1779 | phone only: section 3 |
| Investigate, incidents | 0 | 0 | 0 | 0 | fits |
| Investigate, cases | 0 | 0 | 0 | 257 | phone only: section 3 |
| Investigate, reviews | 0 | 0 | 38 | 794 | section 3 |
| Settings, users and permissions | 0 | 0 | 0 | 998 | phone only: section 3 |
| Presence | 0 | 0 | 0 | 0 | fits |
| Electricity meters | 111 | 0 | 206 | 580 | section 3 |
| Water meters | 0 | 0 | 0 | 0 | fits |
| Elevators | 0 | 0 | 0 | 0 | fits |
| Temperature | 0 | 0 | 0 | 0 | fits |
| Generator | 0 | 0 | 0 | 0 | fits |
| Multimedia, screens | 508 | 405 | 527 | 975 | section 3 |
| Multimedia, players | 1520 | 992 | 1468 | 2595 | section 3 |
| Live, saved views | 0 | 0 | 0 | 954 | phone only: section 3 |
| Alarm | 81 | 0 | 0 | 450 | section 3 |

Caveats: these numbers come from the demo data. A "fits" row with 0 is only as good as the demo's content. The notice board,
announcements, notice board settings, elevators and temperature screens drew no list text in demo mode (a state panel or an empty
module), so a real installation with many entries still needs to be checked on the lab. The schedules rows view already reads 0 before
this branch because FIX2200 is merged into the base.

## 3. Not fixed: needs a design decision

The fit mechanism needs a paged list. These screens either have no pager or are not lists, so fitting them means a layout or product
choice:

- **Scenes** (322 / 190 / 270 / 810): the grid is grouped by area with favourites first, plus a hidden-scenes section. Paging would cut
  groups mid-way. A design decision is needed (pages per group, collapsed groups, or a flat paged grid).
- **Schedules week view** (1307 / 833 / 1255 / 2611): a 24-hour × 7-day grid. It needs a fit-to-height hour scale or a scrollable time
  window inside the grid, which is a design choice.
- **Tickets lists** (`#/tickets/all` 50 / 89 at 1366 / 1180, phone 1146; mine / maintenance 43 on the phone): the cards view uses
  "load more" (a server cursor), not pages. Moving to pages changes the list model.
- **Tickets board** (kanban, 808 / 632 / 885), **tickets overview** (dashboard, 1021 / 889 / 1547), **handlers and vendors**
  (183 / 51 / 179), **requests for quotation** (86 at 1366, 34 at 1180): these are boards and dashboards, or unpaged lists with
  several sections.
- **Multimedia screens / players** (508 / 405 / 527 and 1520 / 992 / 1468): unpaged card grids grouped by room.
- **Non-list screens with a small overflow at 1366x768**: the alarm (81), electricity meters (111; 206 at 1180), door stations (73),
  reviews (38 at 1180). These need a layout pass (spacing or header density), not paging.
- **Phone (390x844)**: most screens other than those fixed here scroll on a phone (home 337, events 1779, users 998, live views 954,
  ...). Whether the no-scroll rule applies to phone layouts needs an owner decision. If it does, it is a per-screen redesign.

## 4. Tests

- New: `frontend/tests/evidence-noscroll-295.spec.ts`, parameterised over the 6 fixed views × 4 viewports (desktop project; the test sets
  the viewport). It asserts no vertical scroll. One more test checks that a tall 1440 window still gets the full 10 schedules and 12
  automations a page (the setting stays the maximum).
- `evidence-automations-list`, `evidence-schedules-list` and `evidence-kavarnit` read every card on one page (`page_size=50`) or a full
  page of 12 cards at viewports where they no longer fit. Their demo URLs now add `&fit=off` (only the URL changes).
- Run locally on this branch (workstation, own preview on port 4797, demo mode; not on the runner), results by exit code:
  `tsc --noEmit` 0; `vite build` 0; `unit-screen-display` 5 passed; `evidence-noscroll-295` (desktop) 25 passed;
  `evidence-polish-295`, `evidence-kavarnit`, `evidence-schedules-list`, `evidence-automations-list`: desktop 102 passed, tablet + mobile
  202 passed and 2 skipped (by the specs' own rules). Not run: the pixel matrix and the full gate.
- Pixel baselines were not regenerated. The visual matrix (`frontend/tests/visual/matrix.json`) covers only `devices-schedules` in its
  default rows view. FIX2200 already fitted that view, and this branch changes it only for windows where fewer than 3 rows fit (the
  floor is now one row), so no change is expected in
  `frontend/tests/visual-matrix.spec.ts-snapshots/devices-schedules-ready-{light,dark}-{desktop,tablet,mobile}-linux.png`. These six
  should be re-checked by the next pixel run (NOT_RUN here; the runner is busy with a release gate). The automations, scripts and the
  schedules cards / table views have no pixel baseline. The evidence screenshots of `evidence-polish-295` and
  `evidence-automations-list` (in `docs/design/evidence/`) are regenerated by those specs when they run; they are not pixel baselines.
