# SCROLL-AUDIT-2480: every `overflow: auto | scroll` rule classified; three control-screen lists page; the ratchet counts only real debt

Branch `pilot/SCROLL-AUDIT-2480`, cut from `origin/release/2470-train` at `2c211966d`. Owner rule 2026-10-24: a control screen never
scrolls - long lists use pages (`sw-pager`), not scroll boxes; the installation's `ui.long_lists = scroll` (הגדרות › כללי › עיצוב
הממשק) switches the paged lists back to an inner scroll (round 32 Q-SYS-4 a / Q-SYS-5 a). Method and helpers as in
`docs/changes/CR-NOSCROLL-LISTS-2443.md`: `components/page-fit.ts` (`PageFit`, measured pages, `data-fit-item`, sections draw their
heading again), `components/sw-pager.ts`, `api/long-lists.ts`.

## 1. The audit

`py -3.12 scripts/design_ratchet.py --scroll-sites` lists every rule (226 on the base) with its file:line, its selector and its kind.
Each rule was read in its file and classified:

- **(a) legitimate - 213 rules**, by kind (the kinds are defined in `scripts/design_ratchet_scroll_allow.json`):
  dialog / sheet / drawer / popover body 45 · settings / setup / tool page (not a control screen, DESIGN L1) 26 · phone / tablet only 25 ·
  the long-lists `scroll` fallback of a paged list (or the base rule the paged mode overrides) 24 · sideways strip (tabs, chips, KPI row,
  timeline, the overview's snapping pages track) 20 · capped picker in a form / dialog / drawer 16 · editor panel 13 · narrow side panel
  or tree (< 55 % of the window) 11 · viewer (text, code, log, JSON, document, textarea) 9 · wide table / chart sideways 8 · the shell /
  section frame 5 · map overlay capped to the stage 4 · public page (login, welcome, public ticket) 3 · shared component contract
  (`sw-table` host, `sw-card fill`, `sw-fold-cards`) 3 · capped list inside one card 1.
- **(b) offenders - a control-screen list that scrolls in the default paged mode**: 16 found; 3 fixed here (section 2), **13 rules on
  10 screens remain** (section 3).
- **(c) dead CSS - none found.** Method: every class of every scroll rule's selector was searched in the templates of its component
  (or, for a shared style module, of every component that imports it, up to four levels); every attribute selector (`data-list-panel`,
  `data-pages`, `data-fit`, `data-long-lists`, ...) is set by code; every file that carries a scroll rule is imported. The only
  candidates the scan raised (`lay-panel`, `lay-libList`, `xpick`, `n-body`, `swq-flow`, `rows-card`, `.scr.editing`) are all used
  (dynamic class maps, other files). So no pixel-neutral removal was possible; nothing was removed.

## 2. What changed (visible only when a list has more rows than fit)

| Screen | Before | After |
|---|---|---|
| אבטחה › אזעקה - the sensors (`screens/security-alarm.ts`) | from 1024 px the sensors region scrolled inside itself (`.areas { overflow-y: auto }`, NOSCROLL-1366-2437) | `PageFit` on `.areas` (its default desktop edge 1024x560; the host carries `data-pages-on` while the pages are in force and the CSS clips the region on it): the sensors that fit are page 1, the rest on the next pages; a later page draws its area heading again; `sw-pager [data-alarm-pager]` at the end of the toolbar (after the cards / list switch). A new filter, view, panel or set of sensors starts at page 1; a live state change of the same sensors keeps the page |
| בקרת כניסה › גישה חיצונית - the grants list (`screens/access-external.ts`) | from 1024x600 the list scrolled inside its card (POLISH4-WP8) | `PageFit` on `.gl-body[role=list]` (edge 1024x560, `data-pages-on`; the card is height-bounded from 1024x600, below that the list is one page): `sw-pager [data-grants-pager]` at the end of the filters row, after the "shown" chip. A new filter / search / door / source / set of grants starts at page 1 |
| מפה › מי במבנה - the people list (`screens/explore-presence.ts`) | the list scrolled inside its side panel at every width | from 1024x560 (`FIT_MQ`) `PageFit` on `ul[data-presence-people]`; `sw-pager [data-presence-pager]` at the end of the list heading. The 30 s poll with the same people keeps the page. Tablet / phone unchanged |

`ui.long_lists = scroll` (and a desktop window shorter than 560 px): each region keeps its own `overflow-y: auto` and scrolls inside itself as before. No media-query strings were added (the px-literal ratchet stays at the train's count).
With few items (the demo data, every pixel baseline) nothing visible changes: one page, no pager.

### 2a. The alarm sensors: the page is the grid that fits (owner, 2026-11-22 comparison)

Owner decision on the first comparison: external grants and the people list ACCEPTED; the alarm sensors to be fixed first. What the
captures showed (42 sensors, 6 areas): in the cards view at 1440x900 page 1 held 4 sensors in ONE column and two thirds of the width
stayed empty; the list view stopped about a row above the region's bottom (60 px at 1440x900). Cause: `PageFit` pages whole rows in
reading order section by section, and the alarm's areas pack side by side (`.areas` is a grid of area columns) - the first area to
run out of height ended page 1.

Fix: `components/grid-fit.ts` (`GridFit`, new; the same desktop edge `FIT_MQ` and long-lists setting as `PageFit`, which now exports
`FIT_MQ`):
1. probe - every sensor drawn in the grouped (areas side by side) layout; if nothing overflows, that layout stays and nothing pages
   (a small installation and every pixel baseline look as before);
2. otherwise the screen draws the sensors in ONE grid (`.areas.flat`): the cards' columns come from the region's real width
   (`repeat(auto-fill, minmax(19em, 1fr))`, about 266 px - a usual sensor name is not cut), the rows from its real height
   (`floor((room + gap) / (card + gap))` at the cards' natural height), a page = columns x rows; the row height is stretched to
   `(room - gaps) / rows` (`--fit-row-h`) so every page but the last reaches the region's bottom edge. The list view: one column, the rows
   that fit the height, stretched the same way.
3. The one grid has no area headings: each sensor names its area in its second line (`.zarea`, after the state word). The second line
   stays one line in the grid (the state and the flags never shrink; area and time give way with an ellipsis), so all items have one
   height. Measured again on a region resize and a new set (filter, view, panel, sensors), never on a live state update.
Phone and portrait tablet: unchanged (below the desktop edge every sensor is drawn by area and the page scrolls, as in 2.47.0).
`ui.long_lists = scroll`: the grouped layout scrolling inside its region, as in 2.47.0.

Measured (42 sensors, mocked backend, Chromium; "room left" = between the lowest item and the region's content bottom):

| Window | Cards: first version | Cards: now | List: first version | List: now |
|---|---|---|---|---|
| 1280x800 | 3 per page, 1 column | 9 (3 x 3), 5 pages, room left 0 | 5 per page, 25 px left | 5, 9 pages, room left 0 (+1 px card border) |
| 1366x768 | 3 per page, 1 column | 12 (4 x 3), 4 pages | 4 per page, 57 px left | 5, 9 pages |
| 1440x900 | 4 per page, 1 column | 16 (4 x 4), 3 pages | 6 per page, 60 px left | 7, 6 pages |
| 1920x1080 | 6 per page, 1 column | 36 (6 x 6), 2 pages | 8 per page, 36 px left | 10, 5 pages |
| 1024x768 (landscape tablet, the desktop edge) | 2 per page, 1 column | 9 (3 x 3), 5 pages | 4 per page, 45 px left | 5, 9 pages |
| 390x844 phone | unchanged (all 42 by area, the page scrolls) | unchanged | unchanged | unchanged |

`tests/layout-scroll-audit-2480.spec.ts` now also asserts, for the alarm cases, at least 4 card columns and at most 3 px of room left
below a full page (both views).

Comparison page (local): `private/planning/scroll_alarm_2480_compare_2026-11-23.html` (images in the sibling folder): before = 2.47.0
(`619f94d04`, the region scrolls) / after, desktop 1440 + 1920 and phone 390, cards and list, with the numbers per window.

Owner decision Q20 (a later row, NOT in this branch): the tickets table pages as the next row; the case-details dialog stays a scrolling
document (question 2 below, answered a).

## 3. The offenders that remain (listed, not fixed - each needs its own page / section work)

Priority by how often operators use the screen:

1. `tickets/list-view-base.ts:90` `.scr` + `tickets/table-styles.ts:211-212` `.tw` - the tickets **table and calendar views** (the cards
   views already page; the table view is excluded from paging on purpose today, `view !== 'table'`). Recommendation: page the table rows
   with `PageFit` on the table card (sw-table rows carry `data-fit-item` through `rowAttrs`, CR-CMP2-TABLES-GENMAINT-2450).
2. `screens/tickets-overview.ts:335/339` `.paged .w > .wb` - a long overview widget scrolls inside its card. Recommendation: cap each
   widget to the rows that fit + "show all" link (the widgets are summaries).
3. `screens/wiskey-stations-css.ts:819` - WisKey stations: the cards view pages, the rows and table views scroll; and
   `components/wk-stations-maintenance.ts:96` (maintenance view, capped 40vh). Recommendation: the same `PageFit` for the other views.
4. `screens/wiskey-people.ts:1507` `.scroll` - the WisKey people table. Recommendation: page with `perPageFor` + `sw-pager`.
5. `screens/investigate-exports.ts:91` `.list` - the exports list (sticky day headers). Recommendation: `PageFit` with one `<section>`
   per day (the heading is drawn again).
6. `screens/meters-page-base.ts:183` (electricity / water meters list, from 900 px) and `water/styles.ts:274` (water usage / alerts
   tables). Recommendation: `PageFit` on the table card, as the maintenance lists.
7. `screens/investigate-cases.ts:495` `.cols > .col` - the case detail's main column. Recommendation: owner question 2 (a case is a
   document, not a list).
8. `screens/access-external.ts:302` `[data-pending-panel]` - pending technicians, capped at 38 % of the column (usually 0-3 rows).

## 4. The ratchet now counts only the real debt

`scripts/design_ratchet.py`: `scroll-container` no longer counts a rule on the reviewed allow-list
`scripts/design_ratchet_scroll_allow.json` (key = file + the rule's selector exactly as `--scroll-sites` prints it; kind, screen and
reason per entry). New: `--scroll-sites` (every rule with its kind or `DEBT`, plus stale allow-list entries). Baseline
`scroll-container` **229 -> 13** (only that line of `scripts/design_ratchet_baseline.json` changed; the other metrics that are lower on
this base - px-literal, native-table - were left for their own rows to lower, to avoid baseline conflicts between parallel branches).

What this means for other branches: a NEW `overflow: auto | scroll` rule, or a changed selector of an allowed one, now raises the count
(the ratchet names the file). If the rule is legitimate (a dialog body, a picker, a sideways strip, ...), add an entry to the allow-list
with its kind; a list on a control screen that scrolls must page instead. `test_scroll_allow_2480.py` also fails on a stale entry (a
selector that no longer exists), so the list stays exact.

## 5. Tests

| Run | Where | Outcome |
|---|---|---|
| `npx tsc --noEmit` (final tree incl. the new spec and the mock option) | workstation | exit 0 (three runs: before the merge, after the spec, after the 2.47.0 merge + data-pages-on fix) |
| `npx eslint` on the three screens | workstation | 0 errors, 0 warnings (the test files are outside the lint config) |
| `smplwise_vms/backend/tests/test_scroll_allow_2480.py` (4: selectors and line numbers, no allow-list = every rule counts, allowed rules / stale entries, the real list's consistency) + `test_build_guards_2438.py` (10, incl. "the checkout is at or below its baseline") | workstation, `.venv`, `-p no:xdist` | 14 passed (before the merge) and 14 passed again on the final tree (after the 2.47.0 merge and the data-pages-on fix) |
| `py -3.12 scripts/design_ratchet.py --base origin/release/2470-train` | workstation | no count above the baseline (scroll-container 13 of 13, px-literal 25486 = the train) |
| new `tests/layout-scroll-audit-2480.spec.ts` (8: alarm cards, alarm list, external grants, people list x 1366x768 / 1440x900; paged and `long_lists=scroll`; next page draws other items) | runner | **NOT_RUN** - built (head + base rc=0) at `7cd5dc301`, then the 2.47.0 release gate started and the runner stopped answering; the job waits in its gate loop. The later head only changes the 1024-wide short-window / 560-600 px edge, not these viewports |
| `tests/visual-matrix.spec.ts -g security-alarm` (6 baselines, no `-u`), `layout-noscroll-1366 -g alarm`, `evidence-polish4-wp8`, `evidence-whoin034-295`, `evidence-alarm` | runner | **NOT_RUN** (same job) |

Pixel baselines: none changed. Expected pixel-neutral: the demo data (6 sensors, the external mock's 14 grants at 1440x900, 3 people) fits
one page, so no pager is drawn and the region looks as before (a scroll region that did not overflow drew no scrollbar either). The
visual-matrix alarm baselines are the proof - NOT_RUN until the runner is free.

Comparison page (local): `private/planning/scroll_audit_compare_2026-11-22.html` - before (base `2c211966d`) / after paged / after with
`long_lists=scroll`, per screen and viewport; the images arrive from the runner job (placeholders until then).

## 6. Owner questions (recommendation first)

1. The people list in מי במבנה is a side panel beside the map. a) page it like the other lists (done, recommended) · b) keep its inner
   scroll (side panels may scroll, DESIGN L1).
2. The case detail's main column (חקירה › תיקים › תיק) is a document, not a list. a) keep it scrolling and allow-list it (recommended) ·
   b) split it into tabs.
3. The tickets table view is excluded from paging today. a) page it with PageFit as the next row (recommended) · b) keep the table
   scrolling as a deliberate exception and allow-list it.

## 7. The full audit (226 rules on the train after this branch; line numbers of this branch)

`class`: a = legitimate (allow-listed, kind as in `scripts/design_ratchet_scroll_allow.json`), b = offender (counted debt). The 3 lists
fixed here keep one rule each as their `scroll` fallback (kind long-lists-scroll).

| # | file:line | screen | class | kind | reason |
|---|---|---|---|---|---|
| 1 | `components/wk-stations-maintenance.ts:96` `.list` | WisKey stations - maintenance view | b | offender | capped at 40vh on the stations page; page it |
| 2 | `screens/access-external.ts:302` `.main > [data-pending-panel]` | external access (pending technicians) | b | offender | capped at 38 % of the column; usually 0-3 rows - page it when it grows |
| 3 | `screens/investigate-cases.ts:495` `.cols > .col` | cases - case detail | b | offender | the main column of a case (notes, files, timeline) scrolls from 1000 px |
| 4 | `screens/investigate-exports.ts:91` `.list` | investigate - exports list | b | offender | the primary list scrolls in its panel (sticky day headers) - page it with PageFit sections |
| 5 | `screens/meters-page-base.ts:183` `.mlist > .scrollx, .mlist > .cards` | electricity / water meters list | b | offender | the meters list scrolls in its card from 900 px |
| 6 | `screens/tickets-overview.ts:335` `.paged .w > .wb` | tickets - overview widgets | b | offender | a long widget scrolls inside its own card |
| 7 | `screens/tickets-overview.ts:339` `.paged .wgrid.top > .w > .wb` | tickets - overview top widgets | b | offender | a long widget scrolls inside its own card |
| 8 | `screens/wiskey-people.ts:1507` `.scroll` | WisKey people table | b | offender | the people table scrolls (both ways) in its card |
| 9 | `screens/wiskey-stations-css.ts:819` `.main > .grid, .main > .rows-card, .main > sw-table` | WisKey stations / devices | b | offender | the cards view pages; the rows and table views scroll |
| 10 | `tickets/list-view-base.ts:90` `.scr` | tickets lists (table and calendar views) | b | offender | the cards views page (.scr.paged); the table and calendar views scroll the region |
| 11 | `tickets/table-styles.ts:211` `.tw` | tickets - table view | b | offender | the table card scrolls (sideways and down, max 100dvh - 300px) |
| 12 | `tickets/table-styles.ts:212` `.tw` | tickets - table view | b | offender | the table card scrolls (sideways and down, max 100dvh - 300px) |
| 13 | `water/styles.ts:274` `.page.fit > .fitbox` | water - usage / alerts tables | b | offender | the table card scrolls inside from 900 px |
| 14 | `access-external/identity-card.ts:78` `.plist` | external access - identity card (drawer) | a | picker | person picker inside the grant drawer |
| 15 | `access-external/request-dialog.ts:79` `.plist` | external access - new request dialog | a | dialog | person picker in the dialog |
| 16 | `access-external/request-dialog.ts:119` `.ntext` | external access - new request dialog | a | viewer | the notice text preview |
| 17 | `arx/arx-login.ts:79` `:host` | login page | a | public |  |
| 18 | `arx/arx-welcome.ts:31` `:host` | welcome page | a | public |  |
| 19 | `calendars/attendee-picker.ts:35` `[role='listbox']` | calendars - attendee picker | a | dialog | suggestion popover |
| 20 | `calendars/connect-dialogs.ts:50` `.list` | calendars - connect dialog | a | dialog |  |
| 21 | `calendars/grid-overlays.ts:53` `.sheet` | calendars - grid sheet | a | dialog |  |
| 22 | `calendars/resident.ts:39` `:host([data-long-lists='scroll']) .list` | calendars - resident view | a | long-lists-scroll |  |
| 23 | `calendars/resident.ts:40` `:host([data-long-lists='scroll']) .slots` | calendars - resident view | a | long-lists-scroll |  |
| 24 | `calendars/resident.ts:124` `.sheet .body` | calendars - resident booking sheet | a | dialog |  |
| 25 | `calendars/view-approvals.ts:38` `:host([data-long-lists='scroll']) .list` | calendars - approvals | a | long-lists-scroll |  |
| 26 | `calendars/view-maint.ts:31` `:host([data-long-lists='scroll']) .list` | calendars - maintenance view | a | long-lists-scroll |  |
| 27 | `calendars/view-manage.ts:43` `:host([data-long-lists='scroll']) .list` | calendars - manage | a | long-lists-scroll |  |
| 28 | `calendars/view-manage.ts:44` `:host([data-long-lists='scroll']) .tablewrap` | calendars - manage | a | long-lists-scroll |  |
| 29 | `calendars/view-rooms.ts:28` `:host([data-long-lists='scroll']) .rows` | calendars - rooms | a | long-lists-scroll |  |
| 30 | `components/architect-request-dialog.ts:28` `.txt` | architect request dialog | a | dialog |  |
| 31 | `components/device-activity.ts:966` `.pbody` | device activity (device sheet) | a | dialog | capped list in the device sheet; a phone lets the sheet scroll |
| 32 | `components/device-activity.ts:976` `.fchips` | device activity | a | phone | filter chips on a phone |
| 33 | `components/media-bulk-dialog.ts:75` `ul` | multimedia bulk dialog | a | dialog |  |
| 34 | `components/media-group-dialog.ts:84` `ul` | multimedia group dialog | a | dialog |  |
| 35 | `components/media-library-browse.ts:108` `.chips` | media library browser | a | strip-x |  |
| 36 | `components/media-preset-editor.ts:66` `.list` | media preset editor (dialog) | a | dialog |  |
| 37 | `components/media-remote-css.ts:518` `.recent` | media remote | a | strip-x | recent items strip |
| 38 | `components/notify-center.ts:255` `.nfilt` | notification centre | a | strip-x | filter chips |
| 39 | `components/notify-center.ts:287` `.nbody` | notification centre (drawer) | a | dialog |  |
| 40 | `components/notify-detail.ts:47` `.ndet` | notification detail | a | dialog |  |
| 41 | `components/sw-card.ts:141` `:host([fill]) .body` | sw-card fill | a | component | live overview cards (recent events = 6 items + "show all", attention list); system-calendars tab card |
| 42 | `components/sw-cast-picker.ts:158` `.body` | cast picker | a | dialog |  |
| 43 | `components/sw-cast-pill.ts:98` `.tray` | cast pill tray (popover) | a | dialog |  |
| 44 | `components/sw-dialog.ts:146` `.body` | sw-dialog | a | dialog |  |
| 45 | `components/sw-drawer.ts:204` `.body` | sw-drawer | a | dialog |  |
| 46 | `components/sw-dropdown.ts:269` `.lb` | sw-dropdown list box | a | dialog |  |
| 47 | `components/sw-fold-cards.ts:103` `::slotted([data-fold-scroll])` | sw-fold-cards | a | component | only an unfolded card taller than its room |
| 48 | `components/sw-partner-api-card.ts:72` `.list` | settings - partner API card | a | settings |  |
| 49 | `components/sw-sheet.ts:205` `.body` | sw-sheet | a | dialog |  |
| 50 | `components/sw-steps.ts:15` `:host` | sw-steps | a | strip-x |  |
| 51 | `components/sw-table.ts:139` `:host` | sw-table | a | component | sideways overflow of a wide table; the screens page the rows (PageFit / perPage) |
| 52 | `components/sw-tabs.ts:123` `.vp` | sw-tabs | a | strip-x |  |
| 53 | `components/wk-door-tech.ts:135` `.tabs` | WisKey door technician tabs | a | strip-x |  |
| 54 | `components/wk-ops-charts.ts:133` `.tw` | WisKey operations charts | a | table-x |  |
| 55 | `components/wk-schedule-draft-form.ts:220` `sw-week-grid` | WisKey schedule draft form | a | table-x |  |
| 56 | `door-windows/events-styles.ts:29` `.doors` | doors & windows - rule form | a | picker | door choice list |
| 57 | `electricity/elec-chart.ts:180` `.tw` | electricity chart table | a | table-x |  |
| 58 | `electricity/meter-picker.ts:95` `.scroll` | electricity meter picker | a | picker |  |
| 59 | `electricity/styles.ts:565` `.scrollx` | electricity tables | a | table-x |  |
| 60 | `electricity/styles.ts:1060` `.menu` | electricity menu (popover) | a | dialog |  |
| 61 | `elevators/elevator-alerts.ts:37` `.opts.scroll` | elevators - alert settings | a | picker |  |
| 62 | `generator/gen-styles.ts:777` `.chooser.users` | generator settings | a | settings | user chooser (capped 220 px) |
| 63 | `generator/gen-styles.ts:783` `.list.picklist` | generator settings | a | settings | pick list (capped 300 px) |
| 64 | `home/home-styles-v3.ts:98` `.n-body` | home - notice text | a | viewer | the owner's home look; not touched |
| 65 | `insights/styles.ts:171` `.tw` | insights tables | a | table-x |  |
| 66 | `insights/styles.ts:258` `.scrollbox` | insights - check list in a form | a | picker |  |
| 67 | `maintenance/emergency-config.ts:22` `.scroller` | settings - emergency contacts / thresholds | a | settings |  |
| 68 | `maintenance/emergency-page.ts:53` `.scroller` | maintenance - emergency readiness | a | long-lists-scroll | paged (PAGING-SETTING-2439); the base rule the paged mode overrides |
| 69 | `maintenance/log-page.ts:49` `.scroller` | maintenance - reminder log | a | long-lists-scroll | paged (CR-NOSCROLL-LISTS-2443) |
| 70 | `maintenance/round-run.ts:43` `.pb` | maintenance - round run sheet | a | dialog |  |
| 71 | `maintenance/styles.ts:53` `.cols > .tree-w` | maintenance - places tree | a | side-panel | 240 px column |
| 72 | `maintenance/styles.ts:55` `.cols > .panel.flush > .scrollx, .cols > .panel.flush > .cards-m` | maintenance lists | a | long-lists-scroll | paged (PAGING-SETTING-2439) |
| 73 | `maintenance/styles.ts:96` `.scrollx` | maintenance tables | a | table-x |  |
| 74 | `maintenance/styles.ts:180` `.seg` | maintenance | a | phone | segmented row on a phone |
| 75 | `maintenance/tags-page.ts:87` `.tagscroll` | maintenance - QR / NFC stickers | a | settings | managers only, a print page (owner question 1 of CR-NOSCROLL-LISTS-2443 still open) |
| 76 | `map/sw-plan-3d.ts:619` `.strip` | 3D plan floor strip | a | map-overlay |  |
| 77 | `map/walk-hud.ts:244` `.walkbar` | 3D walk bar | a | strip-x |  |
| 78 | `map/walk-hud.ts:273` `.sheet .body` | 3D walk sheet | a | dialog |  |
| 79 | `notices/news-sources.ts:22` `.list` | notices - news sources (configure only) | a | settings |  |
| 80 | `notices/reads-sheet.ts:37` `.list` | notices - who read it (sheet) | a | dialog |  |
| 81 | `public-ticket/claim/claim.css:591` `.swq .swq-flow` | public ticket page | a | public | the quote steps strip on a phone |
| 82 | `screens/access-external.ts:299` `.tcard.grants > .gl-body` | external access (grants) | a | long-lists-scroll | FIXED here: paged on a desktop (data-pages-on clips it); this rule = the long-lists scroll setting and 1024x560-600 |
| 83 | `screens/access-external.ts:303` `.side` | external access | a | side-panel | the side column (visits, templates), 290-360 px |
| 84 | `screens/area-quick-sheet-css.ts:347` `.body` | area quick sheet | a | dialog |  |
| 85 | `screens/area-quick-sheet-css.ts:785` `.ed-main` | area quick sheet editor | a | editor |  |
| 86 | `screens/automation-block-forms.ts:583` `.lockcode` | automation editor - code block | a | viewer |  |
| 87 | `screens/automation-code.ts:115` `textarea` | automation code editor | a | viewer |  |
| 88 | `screens/automation-drawer.ts:184` `.runchips` | automation drawer - run chips | a | strip-x |  |
| 89 | `screens/automation-editor-base.ts:327` `.shb` | automation editor | a | editor |  |
| 90 | `screens/automation-editor-base.ts:571` `.typepop` | automation editor - type popover | a | dialog |  |
| 91 | `screens/automation-entity-picker.ts:79` `.pb` | automation entity picker | a | dialog |  |
| 92 | `screens/devices-area-nav.ts:214` `.menu` | devices - area menu (popover) | a | dialog |  |
| 93 | `screens/devices-area.ts:452` `:host([data-pages][data-long-lists='scroll']) .fitbox` | devices - area | a | long-lists-scroll |  |
| 94 | `screens/devices-automations.ts:175` `:host([data-list-panel]) .lwrap` | automations list | a | long-lists-scroll | data-list-panel is set only when the lists scroll |
| 95 | `screens/devices-automations.ts:437` `.dh-det .stf` | automations | a | phone |  |
| 96 | `screens/devices-building-css.ts:751` `.fh-chips` | devices - building | a | phone |  |
| 97 | `screens/devices-building-css.ts:958` `.planfloors` | devices - building floors strip | a | strip-x |  |
| 98 | `screens/devices-building-css.ts:1014` `nav.tree` | devices - building tree | a | side-panel |  |
| 99 | `screens/devices-bulk.ts:176` `.panel` | devices - bulk menu | a | dialog |  |
| 100 | `screens/devices-bulk.ts:590` `details ul, .list` | devices - bulk dialog | a | dialog |  |
| 101 | `screens/devices-camera-picker.ts:73` `[role='listbox']` | devices - camera picker | a | dialog |  |
| 102 | `screens/devices-layout-css.ts:319` `.lay-panel` | devices - layout editor panel | a | editor |  |
| 103 | `screens/devices-layout-css.ts:549` `.lay-libList` | devices - layout editor library | a | editor |  |
| 104 | `screens/devices-schedules-css.ts:27` `:host([data-list-panel]) .groups` | schedules list | a | long-lists-scroll | data-list-panel is set only when the lists scroll |
| 105 | `screens/devices-synoptic-phone-css.ts:56` `.plist, .pbl, .cl` | devices - synoptic (phone) | a | phone |  |
| 106 | `screens/devices-tiles-panel.ts:379` `.la-list` | devices - tiles layout panel | a | editor |  |
| 107 | `screens/door-windows.ts:111` `.doors` | doors & windows - settings drawer | a | picker | door choice list |
| 108 | `screens/explore-floor-map.ts:390` `.floorbtns` | floor map - floor buttons | a | map-overlay |  |
| 109 | `screens/explore-floor-map.ts:446` `.tools` | floor map - tools (phone / short window) | a | phone |  |
| 110 | `screens/explore-floor-map.ts:654` `.panel` | floor map - layers panel | a | map-overlay | owner bug 2026-09-30: capped to the stage |
| 111 | `screens/explore-floor-map.ts:771` `.shared-members` | floor map - shared floor members | a | map-overlay |  |
| 112 | `screens/explore-floor-map.ts:820` `.sidelist .body` | floor map - side list | a | side-panel |  |
| 113 | `screens/explore-floor-map.ts:1151` `.pickbar` | floor map - pick bar | a | phone |  |
| 114 | `screens/explore-floor-map.ts:1193` `.tools` | floor map - tools (phone / short window) | a | phone |  |
| 115 | `screens/explore-plan-editor-css.ts:381` `.list` | plan editor | a | editor |  |
| 116 | `screens/explore-plan-editor-css.ts:563` `.vlist` | plan editor | a | editor |  |
| 117 | `screens/explore-plan-editor-css.ts:617` `.ditems` | plan editor | a | editor |  |
| 118 | `screens/explore-plan-import.ts:286` `.mapwrap` | plan import | a | editor |  |
| 119 | `screens/explore-presence.ts:124` `ul` | who is in the building - people list | a | long-lists-scroll | FIXED here: paged on a desktop; this rule = scroll setting, tablet and phone |
| 120 | `screens/explore-presence.ts:139` `.counts` | who is in the building - counts only | a | side-panel | one row per floor / site (names switched off) |
| 121 | `screens/home-edit-drawer.ts:200` `.he-db` | home edit drawer | a | dialog |  |
| 122 | `screens/home-screen-css.ts:550` `.pfl .segs` | home screen - segments | a | strip-x |  |
| 123 | `screens/home-screen-css.ts:613` `.hsheet` | home screen - sheet | a | dialog |  |
| 124 | `screens/home-widgets-css.ts:1305` `:host([layout='snap']) .wrap` | home widgets - snap layout | a | strip-x | a sideways snapping track (layout option) |
| 125 | `screens/infra-elevators.ts:130` `.hist` | elevators - history dialog | a | dialog |  |
| 126 | `screens/infra-temperature.ts:250` `:host([data-long-lists='scroll']) [data-temp-grid], :host([data-long-lists='scroll']) [data-temp-groups]` | temperature | a | long-lists-scroll |  |
| 127 | `screens/installer-platform.ts:117` `.scroll` | installer platform table | a | settings |  |
| 128 | `screens/investigate-cases.ts:208` `.files` | cases - import files list (dialog) | a | picker |  |
| 129 | `screens/investigate-event-detail.ts:158` `.side` | event detail - side column | a | side-panel |  |
| 130 | `screens/investigate-history-map.ts:583` `.layout.ts .panel` | history map - side panel | a | side-panel |  |
| 131 | `screens/investigate-history-map.ts:903` `.layers` | history map | a | phone |  |
| 132 | `screens/investigate-history-map.ts:935` `.details` | history map | a | phone |  |
| 133 | `screens/investigate-playback.ts:445` `.stage .bar .inner` | playback - control bar | a | strip-x |  |
| 134 | `screens/investigate-reviews.ts:434` `.layers` | reviews - layer chips | a | strip-x |  |
| 135 | `screens/investigate-reviews.ts:811` `.filters` | reviews | a | phone |  |
| 136 | `screens/investigate-rules.ts:443` `.dry` | rules - dry-run output | a | viewer |  |
| 137 | `screens/kiosk-wall.ts:454` `.stats` | kiosk wall | a | phone |  |
| 138 | `screens/live-camera-css.ts:350` `.stage-side` | live camera - side column | a | side-panel |  |
| 139 | `screens/live-wall.ts:204` `.settings-rows` | video wall - settings popover | a | dialog |  |
| 140 | `screens/mapping-assistant-css.ts:371` `.scroll` | mapping assistant (setup) | a | settings |  |
| 141 | `screens/meters-page-base.ts:170` `.cols > .tree-card` | meters - tree | a | side-panel |  |
| 142 | `screens/multimedia-groups.ts:545` `:host([data-fit][data-long-lists='scroll']) .scr` | multimedia - groups | a | long-lists-scroll |  |
| 143 | `screens/multimedia-groups.ts:560` `:host([data-fit]) .gcard .members` | multimedia - groups | a | capped-in-card | a group card's member list |
| 144 | `screens/multimedia-players.ts:81` `.dh-det sw-segmented::part(track)` | multimedia - players | a | phone |  |
| 145 | `screens/multimedia-players.ts:180` `.scr` | multimedia - players | a | long-lists-scroll | paged by PageFit (NOSCROLL-1366-2437); the base rule the paged mode overrides |
| 146 | `screens/multimedia-players.ts:222` `.scr.editing .edit-cards` | multimedia - players layout editing | a | editor |  |
| 147 | `screens/multimedia-screens.ts:76` `:host` | multimedia - screens | a | phone | below the desktop edge only (the cards region pages from 1024x560) |
| 148 | `screens/multimedia-screens.ts:148` `.rooms` | multimedia - screens rooms strip | a | strip-x |  |
| 149 | `screens/multimedia-screens.ts:414` `.edit-side` | multimedia - screens layout editing | a | editor |  |
| 150 | `screens/multimedia-screens.ts:495` `.dh-det sw-segmented::part(track)` | multimedia - screens | a | phone |  |
| 151 | `screens/multimedia-screens.ts:548` `:host([data-fit][data-long-lists='scroll']) .scr` | multimedia - screens | a | long-lists-scroll |  |
| 152 | `screens/nvr-batch-shell.ts:41` `.vl` | NVR batch tool | a | settings |  |
| 153 | `screens/nvr-confirm.ts:61` `ul.names` | NVR confirm dialog | a | dialog |  |
| 154 | `screens/nvr-verify-report.ts:72` `.list` | NVR verify report | a | settings |  |
| 155 | `screens/plan-studio-panel.ts:2053` `.dlist` | plan studio | a | editor |  |
| 156 | `screens/scenario-recipients.ts:26` `.pop` | scenario recipients popover | a | dialog |  |
| 157 | `screens/schedule-conditions.ts:186` `.cands` | schedule conditions picker | a | picker |  |
| 158 | `screens/schedule-table-view.ts:60` `.wrap` | schedule table view | a | table-x |  |
| 159 | `screens/security-alarm.ts:946` `.areas` | alarm - sensors | a | long-lists-scroll | FIXED here: paged from 1024x560 (data-pages-on clips it); this rule = the long-lists scroll setting and a short desktop window |
| 160 | `screens/system-access.ts:409` `.members` | settings - access | a | settings |  |
| 161 | `screens/system-alarm.ts:203` `.scroll` | settings - alarm | a | settings |  |
| 162 | `screens/system-brand-installer.ts:59` `.tabs` | settings - brand installer tabs | a | settings |  |
| 163 | `screens/system-brand-logos.ts:103` `.tabs` | settings - brand logos tabs | a | settings |  |
| 164 | `screens/system-calendar-sync.ts:64` `:host([data-long-lists='scroll']) .flags` | settings - calendar sync | a | long-lists-scroll |  |
| 165 | `screens/system-calendars.ts:126` `:host([data-long-lists='scroll']) .fitbox` | settings - calendars | a | long-lists-scroll |  |
| 166 | `screens/system-devices.ts:268` `:host([data-long-lists='scroll']) .stage > sw-table` | system health / devices | a | long-lists-scroll |  |
| 167 | `screens/system-fleet-report.ts:327` `pre.json` | fleet report JSON | a | viewer |  |
| 168 | `screens/system-nav.ts:45` `:host` | settings navigation | a | shell |  |
| 169 | `screens/system-notifications.ts:291` `.mxw` | settings - notifications matrix | a | settings |  |
| 170 | `screens/system-readiness.ts:517` `.kpis` | settings - readiness | a | settings |  |
| 171 | `screens/system-readiness.ts:619` `.col` | settings - readiness | a | settings |  |
| 172 | `screens/system-security-cameras.ts:180` `.wrap` | settings - security cameras | a | settings |  |
| 173 | `screens/system-security-privacy-masks.ts:160` `.cams` | settings - privacy masks | a | settings |  |
| 174 | `screens/system-security-privacy-masks.ts:571` `sw-dialog ul` | settings - privacy masks | a | settings |  |
| 175 | `screens/system-security-privacy-masks.ts:893` `.layout > .cams` | settings - privacy masks | a | settings |  |
| 176 | `screens/system-security-privacy-masks.ts:898` `.layout > .insp` | settings - privacy masks | a | settings |  |
| 177 | `screens/system-security-privacy-masks.ts:916` `.main[data-pm-step='review'], .main[data-pm-step='done']` | settings - privacy masks | a | settings |  |
| 178 | `screens/system-transit.ts:37` `.res` | settings - transit | a | settings |  |
| 179 | `screens/system-video-conn-test.ts:114` `pre.report` | video connection test report | a | viewer |  |
| 180 | `screens/system-wizard.ts:283` `.rail` | setup wizard rail | a | settings |  |
| 181 | `screens/tickets-board.ts:214` `.scr.paged .side` | tickets - board side tree | a | side-panel |  |
| 182 | `screens/tickets-maintenance.ts:49` `.body > *` | tickets - maintenance section frame | a | shell | the maintenance pages inside page their own lists |
| 183 | `screens/tickets-overview.ts:327` `.paged .wpages` | tickets - overview pages track | a | strip-x | the pages sit side by side and snap page by page (that is the pager) |
| 184 | `screens/tickets-overview.ts:332` `.paged.scrolls .wpages` | tickets - overview | a | long-lists-scroll |  |
| 185 | `screens/tickets-overview.ts:342` `.paged .dh-det .depts` | tickets - overview departments strip | a | strip-x |  |
| 186 | `screens/tickets-overview.ts:394` `.rooms` | tickets - overview | a | phone |  |
| 187 | `screens/water/page-meters.ts:63` `.cand` | water - meter candidates | a | picker |  |
| 188 | `screens/wiskey-bulk-people.ts:115` `.rows` | WisKey bulk people dialog | a | dialog |  |
| 189 | `screens/wiskey-embed.ts:389` `nav.tools` | WisKey embed tools | a | strip-x |  |
| 190 | `screens/wiskey-events.ts:814` `.chips` | WisKey events | a | phone |  |
| 191 | `screens/wiskey-people.ts:1665` `.filters` | WisKey people | a | phone |  |
| 192 | `screens/wiskey-profiles.ts:692` `.tabs` | WisKey profiles tabs | a | strip-x |  |
| 193 | `screens/wiskey-stations-css.ts:807` `.treecol` | WisKey stations tree | a | side-panel |  |
| 194 | `screens/wiskey-stations-css.ts:847` `.chips` | WisKey stations | a | phone |  |
| 195 | `shell/sw-app.ts:241` `nav.rail` | navigation rail | a | shell |  |
| 196 | `shell/sw-app.ts:329` `main` | the shell main (page body) | a | shell | NOSCROLL guards assert it never scrolls on control screens |
| 197 | `shell/sw-app.ts:392` `.subnav` | shell sub-navigation | a | phone |  |
| 198 | `shell/sw-app.ts:692` `.results` | shell search results (popover) | a | dialog |  |
| 199 | `shell/sw-app.ts:3376` `style=""` | embedded mode main | a | shell |  |
| 200 | `shell/sw-user-menu.ts:133` `.panel` | user menu | a | dialog |  |
| 201 | `styles/media-glass.ts:591` `.pop` | media glass popover | a | dialog |  |
| 202 | `styles/media-page.ts:17` `:host` | media pages (automations, schedules, multimedia groups / players, notifications) | a | phone | below the desktop edge (the pages fit from 1024 px) |
| 203 | `styles/media-page.ts:89` `.rooms` | media pages rooms strip | a | strip-x |  |
| 204 | `styles/media-page.ts:343` `.edit-side` | media pages layout editing | a | editor |  |
| 205 | `styles/media-page.ts:415` `.dh-det .seg` | media pages | a | phone |  |
| 206 | `styles/settings.ts:451` `nav.tabs` | settings tabs | a | strip-x |  |
| 207 | `temperature/report.ts:66` `.ulist` | temperature report - unit list | a | picker |  |
| 208 | `temperature/whatsapp.ts:61` `.plist` | temperature WhatsApp - people list | a | picker |  |
| 209 | `temperature/wizard.ts:74` `.slist` | temperature wizard | a | picker |  |
| 210 | `temperature/wizard.ts:92` `.opts.scroll` | temperature wizard | a | picker |  |
| 211 | `tickets/calendar-view.ts:385` `.leg` | tickets - calendar legend | a | phone |  |
| 212 | `tickets/cost-styles.ts:379` `.stage` | tickets - cost document viewer | a | viewer |  |
| 213 | `tickets/list-toolbar.ts:253` `.fpop` | tickets - filter popover | a | dialog |  |
| 214 | `tickets/list-toolbar.ts:349` `.fpop ticket-board-tree` | tickets - filter popover tree | a | dialog |  |
| 215 | `tickets/map-element.ts:158` `.list` | tickets - map picker | a | picker |  |
| 216 | `tickets/my-numbers.ts:35` `.kpis` | tickets - my numbers | a | phone |  |
| 217 | `tickets/rfq-styles.ts:543` `.cmpwrap` | RFQ comparison | a | table-x |  |
| 218 | `tickets/rfq-styles.ts:856` `.vlist` | RFQ - vendor choice | a | picker |  |
| 219 | `tickets/rfq-styles.ts:1001` `.thread` | RFQ message thread (dialog) | a | viewer |  |
| 220 | `tickets/rfq-styles.ts:1157` `.bar2 .sum` | RFQ | a | phone |  |
| 221 | `tickets/settings-styles.ts:303` `.gridwrap` | tickets settings grid | a | settings |  |
| 222 | `tickets/styles.ts:230` `.pop.ov` | tickets popover | a | dialog |  |
| 223 | `tickets/styles.ts:621` `.pick.xpick` | tickets - external assign vendor list | a | picker |  |
| 224 | `tickets/table-styles.ts:50` `.pop .plist` | tickets table popover | a | dialog |  |
| 225 | `tickets/table-styles.ts:403` `.pop.ov` | tickets table popover | a | dialog |  |
| 226 | `tickets/ticket-detail.ts:299` `.pop.ov` | ticket detail popover | a | dialog |  |
