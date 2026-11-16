# PAGING-SETTING-2439: the long-lists setting, one paging helper, the remaining scrolling lists paged

Branch `pilot/PAGING-SETTING-2439`, cut from `origin/pilot/AUDIT30-COMBINED-2435` (`ef7f57c07`), because most of the screen files are
held by that branch (MASTER_PLAN Appendix A).

Inputs: owner round 32 - Q-SYS-4 **a** (control screens whose whole page scrolls: fix all; only an inner panel may scroll, the page
itself never moves), Q-SYS-5 **a** (long lists in control screens become pages) with the owner's note "a system setting lets the admin
switch back to scrolling; default = pages". Code review MASTER_PLAN O12 (owner: a): 06:SCROLL-1, 06:PLAY-2 (grid height), 08:F23.
Design rulebook (`origin/pilot/DESIGN-RULEBOOK-2438`, `docs/design/system/DESIGN.md` L1 and Appendix A.12).

## 1. The setting

- Key: `ui.long_lists` - `paged` (default) | `scroll`. It already existed in the backend (`routers/settings.py`, POLISH-CONTROL-297,
  pattern `^(paged|scroll)$`, system.configure) and in the home-screen card of הגדרות › חשמל והתקנים, but **no screen read it**
  (Appendix A.12: "only the home screen reads it").
- Moved to the system-level display card: הגדרות › כללי › עיצוב הממשק, row "רשימות ארוכות במסכי השליטה" / "Long lists on the control
  screens" (`data-long-lists-row`, `select[data-set-long-lists]`), saved with the card's "שמור עיצוב"; open screens follow at once
  (`setLongListsMode` after the save). The duplicate row in the home-screen card was removed (one setting, one place).
- Labels: `i18n/he.ts` + `i18n/en.ts`, section `longLists` (label, hint, paged, scroll).
- `ProductSettings` (`api/media.ts`) now types the key.
- `?long_lists=paged|scroll` in the address pins the mode for one page load (specs, demo pages; like `?fit=off`).

What `scroll` means: every item of the list is drawn and the pager disappears. Where the screen already has an inner list panel, that
panel scrolls and the page stays (Q-SYS-4). Where the screen's own scroller was the only scroller before paging (see the table), the
screen's own box scrolls as it did before paging - noted per row.

## 2. The shared helper (one pattern, not a second one)

- `frontend/src/api/long-lists.ts`: the mode, `onLongLists`, `ensureLongLists` (one read per page load from the shared settings cache),
  `perPageFor(paged, perPage, total)` (every item on one page in `scroll`, so `pageCount` / `clampPage` / `pageSlice` of
  `api/screen-display.ts` need no second path), and `LongListsController` (Lit controller: `.paged`, the host attribute
  `data-long-lists="paged|scroll"` for the screen's CSS, a re-render and a reset callback on a change).
- `frontend/src/components/page-fit.ts`: the NOSCROLL-1366 `PageFit` controller moved here from `screens/multimedia-page-fit.ts`
  (git rename) as the measured-pages helper of every card/row region. It now carries a `LongListsController`: `fits` (the screen takes
  the window height) vs `on` (fits and paged); a region without `<section>` is one section; the desktop media query is a parameter.
- The other existing paging code (POLISH-295 `measureFitItems`/`pageSlice`, NOSCROLL-1366 per-screen fits, `tickets-pages.ts`) is
  kept and only gated by the controller.

## 3. Screens

"Before" = on `origin/pilot/AUDIT30-COMBINED-2435` at a desktop size (1366x768 / 1440x900). "After (paged)" is the default.
Nothing below the desktop edge (tablet, phone) changed.

| Screen | File(s) | Before | After (paged, default) | After (`scroll`) |
|---|---|---|---|---|
| Multimedia screens | `screens/multimedia-screens.ts` | pages (NOSCROLL-1366) | pages (unchanged) | cards region scrolls inside itself, header stays |
| Multimedia groups | `screens/multimedia-groups.ts` | pages (NOSCROLL-1366) | pages (unchanged) | cards region scrolls inside itself |
| Multimedia players | `screens/multimedia-players.ts` | pages (NOSCROLL-1366) | pages (unchanged) | cards region scrolls inside itself (its pre-1366 inner scroller) |
| Schedules | `screens/devices-schedules.ts` | pages (POLISH-295 + fit) | pages (unchanged) | every row drawn; from 1024 px only the list panel (`.groups`) scrolls, the title, chips, toolbar and the upcoming strip stay (`data-list-panel`; not the week view, trash, review) - measured |
| Automations / scripts | `screens/devices-automations.ts` | pages (POLISH-295 + fit) | pages (unchanged) | every row/card drawn; from 1024 px only the list panel (`.lwrap`) scrolls - measured |
| Area (devices) | `screens/devices-area.ts` | pages (NOSCROLL-1366 bands) | pages (unchanged) | cards region (`.fitbox`) scrolls inside itself |
| Building presence sensors (settings) | `screens/system-building-presence.ts` | pages of 6 / 5 | pages (unchanged) | every sensor in the card (a settings page, may scroll) |
| Camera health | `screens/system-devices.ts` | table rows paged (NOSCROLL-1366) | pages (unchanged) | table scrolls inside the stage |
| Temperatures | `screens/infra-temperature.ts` | cards paged (NOSCROLL-1366) | pages (unchanged) | every card drawn; the cards region scrolls inside the page box, rows keep their content height (`grid-auto-rows: max-content`; without it the clipped cards shrank to fit) - measured with 15 units |
| Service management, mine | `screens/tickets-list.ts` | cards paged (NOSCROLL-1366) | pages (unchanged) | the list region (`.scr`) scrolls inside itself |
| Manager board | `screens/tickets-board.ts` | groups paged (NOSCROLL-1366) | pages (unchanged) | the board region (`.scr`) scrolls inside itself |
| WisKey stations | `screens/wiskey-stations.ts` | cards paged (NOSCROLL-1366) | pages (unchanged) | the stations box scrolls inside itself |
| **Maintenance lists** (ledger / plans / rounds) | `maintenance/list-page.ts` | **inner scroll**: the table scrolled inside its panel (08:F23) | **pages**: whole table rows that fit, pager at the end of the toolbar (`[data-maint-pager]`, its place kept so the table never moves) | the table scrolls inside its panel (as before) |
| **Emergency readiness checklist** | `maintenance/emergency-page.ts` | **inner scroll**: the checklist scrolled inside its panel (08:F23) | **pages**: whole rows, a group that runs over repeats its heading; a foot band in the panel holds the hidden-rows note and the pager (`[data-emerg-pager]`) | the checklist scrolls inside its panel (as before). Print always draws every row |
| **Playback comparison grid** | `screens/investigate-playback.ts` | **no height cap**: two rows of 16:9 tiles pushed the timeline below the window (06:PLAY-2) | the grid takes the single video's height budget (`max(200px, 100dvh - 560px)`): its width is capped so its rows end within it, centred (`data-pb-grid`) | same |
| Maintenance log | `maintenance/log-page.ts` | inner scroll | inner scroll (kept: a log may scroll, DESIGN L1) | same |
| Maintenance tags (stickers) | `maintenance/tags-page.ts` | inner scroll | inner scroll (kept: a manager's setup page with print) | same |
| Emergency contacts / settings panels | `maintenance/emergency-config.ts` | inner scroll | inner scroll (kept: settings) | same |
| Temperature unit drawer body | `temperature/detail.ts` | inner scroll (drawer) | inner scroll (kept: a drawer, not a list page) | same |
| Generator pickers (route users, devices to register) | `generator/gen-routing.ts`, `gen-settings.ts`, `gen-styles.ts` | inner scroll via inline `style=` | inner scroll, the inline styles moved to `.chooser.users` / `.list.picklist` (08:F23) | same |

06:SCROLL-1 (`multimedia-screens.ts` / `multimedia-players.ts` host scroll) was already closed by NOSCROLL-1366 (2.43.5) on the desktop;
this branch only makes those pages honour the setting. Appendix A.12's other screens (single camera, generator live, alarm, live
overview) hold no long list: unchanged.

Also wired (lead's follow-up, same branch):

| Screen | File(s) | Paged (default) | `scroll` |
|---|---|---|---|
| Calendars: approvals, maintenance windows, manage (calendars and members), rooms timeline, resident (rooms, slots, mine) | `calendars/view-approvals.ts`, `view-maint.ts`, `view-manage.ts`, `view-rooms.ts`, `resident.ts` | unchanged (`pageOf` + `rowsThatFit`) | every `pageOf()` takes `perPageFor(...)`; the list box (`.list`, `.tablewrap`, `.rows`, `.slots`) scrolls inside itself; the always-drawn pagers of approvals / manage / maintenance are hidden (this last change was made after the browser run: tsc only) |
| Calendars settings, sync flags | `screens/system-calendars.ts`, `screens/system-calendar-sync.ts` | unchanged | the same (`.fitbox`, `.flags` up to 40vh) |
| Calendar day view columns | `calendars/view-calendar.ts` | unchanged | unchanged: columns of a time grid, not a list |
| Tickets overview | `screens/tickets-overview.ts` | unchanged (side-by-side pages of two widget rows) | the desktop keeps its box; every widget on one page, rows of `minmax(300px, 38vh)`, the track scrolls vertically; header and numbers stay - measured |

## 4. Tests

| Run | Where | Outcome |
|---|---|---|
| `npx tsc --noEmit` | workstation | exit 0 |
| new `tests/unit-long-lists-2439.spec.ts` (7 tests: defaults, `perPageFor` with the page helpers, subscriptions, the address pin, `ensureLongLists` in Node, the controller on a fake host, he/en labels), `--workers=1` | workstation | 7 passed |
| `tests/layout-noscroll-1366.spec.ts` new describe "the long lists set to scroll: the page still never scrolls" - the 13 screens plus temperatures with 15 units (`temperature-many`, also asserts the list panel really scrolls), schedules, automations, tickets overview (`installOverviewMock` worst case), calendars approvals / manage / rooms; x 1366x768 and 1440x900, classic light | workstation, Vite dev server, `--project=desktop --workers=1` | first run 38 passed (4.0 min); after the temperature row fix: temperature cases 6 passed (incl. the original block's 10 skin runs), schedules / automations / overview 6 passed. Page overflow 0 everywhere; inner panels scrolled e.g. temperatures 728 / 750 px, overview track 1417 / 1285 px, schedules `.groups` 143 px (1440x900), automations `.lwrap` 79 px (1366x768), manage `.list` 351 / 219 px |
| one-off headless check (`long_lists=paged` vs `scroll`, demo, 1366x620) | workstation | schedules: paged = pager, no scroller; scroll = only `div.groups` scrolls (+471 px). Automations: only `div.lwrap` (+227 px). Page, main, screen 0 in both modes |
| evidence / layout / pixel suites | - | **NOT_RUN** (no runner entry check queued, by instruction) |

Expected baseline impact: none of the compared pixel baselines covers the changed
surfaces in paged mode (visual-matrix: schedules, multimedia screens and the diagnostics health tab are unchanged in paged mode).
Surfaces that do change and have no compared baseline: the General settings tab with a backend (new row), the Devices settings tab
(row removed), the playback grid in compare mode, the maintenance ledger toolbar (pager place) and the emergency checklist (foot band).
