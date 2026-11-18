# CR-NOSCROLL-LISTS-2443: measure the scroll candidates first; page the one that still overflows (the maintenance reminder log)

Branch `pilot/CR-NOSCROLL-LISTS-2443`, cut from `origin/release/2438-train` at `5bcea468d` (merge of FIX-2438-REDS).
Code review 2026-11-13: 06:SCROLL-1, 06:PLAY-2 (grid height), 08:F23. MASTER_PLAN row `pilot/CR-NOSCROLL-LISTS-2436`; owner decision
O12 = a (convert every list that really scrolls to pages); owner rules: a control screen never scrolls, long lists page, the
installation setting `ui.long_lists` (`paged` default | `scroll`, הגדרות › כללי › עיצוב הממשק) switches the lists back to scrolling
(round 32 Q-SYS-4 a, Q-SYS-5 a; DESIGN.md L1). REMAINING_WORK_2026-11-18 G8: "measure first".

## 1. Starting point

Most of this row already shipped in the train: `PAGING-SETTING-2439` (merged through `FE-WAVE2-COMBINED-2440`) built the setting and the
shared helpers (`api/long-lists.ts`, `components/page-fit.ts` `PageFit`), paged the maintenance lists and the emergency checklist,
capped the playback comparison grid (`7d33316fe`), moved the generator pickers' inline styles to classes, and made the multimedia trio
(paged since NOSCROLL-1366-2437) honour the setting. This branch measures every candidate the row names against the code on the train,
converts the one list that can still overflow a control screen, and adds the missing checks (the 2x2 grid at 1080p).

## 2. Measurements (from the code / CSS on the train and the existing evidence; no browser run tonight)

Reference viewports: 1366x768, 1440x900 (NOSCROLL-1366 / PAGING-SETTING guards), 1920x1080 (the row's "2x2 at 1080p"). The shell has
no top bar (`--sw-topbar-h: 0px`). "Page-sized" = covers >= 55 % of the viewport (the audit's rule in `layout-noscroll-1366.spec.ts`).

| Candidate (finding) | File | How it scrolls on the train | Measurement | Verdict |
|---|---|---|---|---|
| Multimedia screens / groups / players (06:SCROLL-1) | `screens/multimedia-screens.ts`, `multimedia-players.ts` | from 1024x560 the cards region is paged by `PageFit` (`sw-pager [data-mm-pager]`); the host's `overflow: auto` applies only below that edge (tablet / phone) | PAGING-SETTING-2439 / NOSCROLL-1366 layout runs: page, main and screen overflow 0 at 1366x768 and 1440x900 in every skin, also with `long_lists=scroll` (region scrolls inside itself) | done - no change |
| Playback comparison grid (06:PLAY-2) | `screens/investigate-playback.ts` | the grid takes the single video's budget `max(200px, 100dvh - 560px)`; its width is capped so the rows end within it | 2x2 (rows2 cap `(h - 18) * 16/9 + 18`): 1920x1080 -> budget 520 px, grid <= 910 x 520 px; 1440x900 -> 340 px, <= 590 x 340 px; 1366x768 -> 208 px, <= 356 x 208 px. Height never exceeds the budget (new unit computes it from the stylesheet) | done in `7d33316fe`; the layout check at 1080p was missing -> added (section 4) |
| Maintenance lists: ledger / plans / rounds (08:F23) | `maintenance/list-page.ts`, `styles.ts` | paged (`[data-maint-pager]`); `scroll` = the table scrolls in its panel | PAGING-SETTING-2439 | done - no change |
| Emergency readiness checklist (08:F23) | `maintenance/emergency-page.ts` | paged (`[data-emerg-pager]`), print draws every row | PAGING-SETTING-2439 | done - no change |
| **Maintenance reminder log** (08:F23) | `maintenance/log-page.ts` | **the whole table scrolled inside `.scroller`** | the log reads up to **200** rows (`limit: 200`, kept `keep_days`). At 1366x768: body ~680 px (768 - 30 padding - 58 tabs), page head ~67 px, toolbar ~59 px (+ ~50 px when reminders are off), table head ~37 px -> **~517 px for rows**; a row is ~58 px (two-line task cell, 10 px padding) -> **~8 rows** fit (~7 with the "reminders are off" note). 1440x900: ~11 rows. 1920x1080: ~14 rows. The panel (~1100 x 554 px) covers ~58 % of a 1366x768 window: a page-sized scroller by the audit's rule | **can overflow -> converted to pages** (section 3) |
| Maintenance stickers (QR / NFC tags) (08:F23) | `maintenance/tags-page.ts` | `.tagscroll` scrolls (stickers grid + table) | can overflow with many tags. Managers only (`access.manage`), a setup page whose purpose is printing every sticker | kept as an inner scroller (setup / print page; DESIGN L1: settings may scroll) - **owner question 1** |
| Emergency contacts / thresholds (08:F23) | `maintenance/emergency-config.ts` | `.scroller` panel | settings panels (הגדרות › תשתיות) | kept (settings may scroll, L1) |
| Maintenance tree beside the lists | `maintenance/styles.ts` `.cols > .tree-w` | the places tree scrolls in its 240 px column | a narrow side panel (< 55 %), unbounded data (buildings / floors) | kept (an inner panel, L1) |
| Temperature unit drawer body (08:F23) | `temperature/detail.ts` | the drawer's body (`sw-drawer`) scrolls | a drawer, not a list page | kept |
| Generator pickers (08:F23) | `generator/gen-routing.ts`, `gen-settings.ts`, `gen-styles.ts` | `.chooser.users` max 220 px, `.list.picklist` max 300 px, inside settings drawers / cards (inline styles moved to classes by PAGING-SETTING-2439) | capped boxes, far below 55 % | kept (settings) |

## 3. What changed

- `frontend/src/maintenance/log-page.ts`: the reminder log uses the shared measured-pages helper exactly as the maintenance lists do:
  `PageFit` on `.scroller`, rows marked `data-fit-item`, the table inside `<section class="fitsec">` (a later page draws the table
  head again), `fit.sync(count, filter + ids)` (a new filter or new rows start at page 1; the 60 s re-read with the same rows keeps the
  page), the pager at the end of the toolbar (`sw-pager [data-maint-log-pager]`), `data-fit` on the host. From 1024x560 with
  `ui.long_lists = paged` (default) `.scroller` clips and shows the rows that fit; with `scroll` the table scrolls inside its panel as
  before. Phone / tablet (below the edge): unchanged (cards, inner scroll). With up to ~8 rows nothing visible changes (no pager).
- No other source change: the other candidates were measured as done or as allowed inner scrollers (table above).

## 4. Tests

| Run | Where | Outcome |
|---|---|---|
| `npx tsc --noEmit` (final tree, incl. the new specs and the mock option) | workstation | exit 0 |
| new `tests/unit-noscroll-lists-2443.spec.ts` (3: the 2x2 grid height computed from the stylesheet at 1920x1080 / 1440x900 / 1366x768 for two content widths each; the log's paging wiring; the kept inner scrollers and the paged screens' helper) + `tests/unit-long-lists-2439.spec.ts` (7), unit config, `--workers=1` | workstation | 10 passed |
| `tests/unit-noscroll-lists-2443.spec.ts` + `tests/unit-poll-features.spec.ts` (reads `log-page.ts`), `--workers=1` | workstation | 21 passed (3 + 18) |
| `py -3.12 scripts/design_ratchet.py` | workstation | no count above the baseline (scroll-container unchanged at 230) |
| new `tests/layout-playback-grid-2443.spec.ts` (the 2x2 grid at 1920x1080, 1440x900, 1366x768 against `playback-stall-mock.ts`: grid height <= budget, document / main / screen do not scroll, the timeline ends inside the window) | - | **NOT_RUN** - refresh on the runner after 2.43.8 |
| `tests/evidence-maintenance.spec.ts` (the log case: 4 rows, filter, no page scroll - fits on one page, so no pager), `layout-noscroll-297`, `layout-noscroll-1366`, `evidence-noscroll-295` | - | **NOT_RUN** - refresh on the runner after 2.43.8 |
| new `tests/layout-maint-log-2443.spec.ts` (64 log lines via the new `longLog` option of `tests/maintenance-mocks.ts`; 1366x768 and 1440x900: paged - fewer rows drawn, panel clips, pager moves to other rows, no page / panel overflow; `long_lists=scroll` - all 64 rows, no pager, the panel scrolls, the page does not) | - | **NOT_RUN** - refresh on the runner after 2.43.8 |

Pixel impact: no compared baseline covers the maintenance log (it has evidence screenshots only). A log with more rows than fit now
shows a pager and no inner scrollbar - expected. Nothing else moves.
