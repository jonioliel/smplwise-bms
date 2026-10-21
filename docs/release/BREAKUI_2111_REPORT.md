# BREAKUI-295: worst-case stress test of the 2.11 screens

Branch `pilot/BREAKUI-295` from `origin/release/2112`. Method: the break-ui idea (worst-case data, never a real device) on each screen's mocked
backend, at a phone width of 400 px (he, RTL, coarse pointer = the 44 px rule) and at 1440 px desktop, light and dark. Every measured state
fails on: horizontal page scroll, an element whose content is wider than its own box (text cut or pushed out sideways), a child sticking out of
its parent, the shared layout guard findings (`tests/layout-guard.ts`: escape / overflow / clipped), and, on the phone, any interactive element
under 44 px. Evidence PNGs (phone, light, after the fixes; regenerate dark and desktop shots with `SW_SHOTS=1`): `docs/design/evidence/BREAKUI-295/`. The before-state of each defect is the failing guard output quoted in the table; the before PNGs were overwritten by re-runs and are NOT kept.

Worst-case data used (all invented): 100-character Hebrew names, 90-character unbreakable Latin strings, 70 unbreakable Hebrew letters, a long
e-mail address, one-letter names, Arabic, Russian, mixed Hebrew / Latin / digits with parentheses, emoji with ZWJ sequences, bidi control characters
(RLO, RLI, RLM), empty and whitespace-only names, 60 doors, 40 rules, 40 trigger log rows, 400 holiday rows, 30 floors, 60 areas, 30 cameras,
12 accounts, 50 history rows, counters of 10^11, a 30-year wait, Arabic-Indic digits typed into numeric fields, a 99,999,999,999-minute duration.

## Defects found and fixed

| # | Screen | Defect (before) | Fix (after) |
|---|--------|-----------------|-------------|
| 1 | door windows, all cards | A chip with a long door label or automation id was cut at the card edge with no ellipsis (`text-overflow` does not apply to an inline-flex box): the end of the name was lost. | `.chip` wraps (`white-space: normal; overflow-wrap: anywhere; min-inline-size: 0`); radius `min(pill, 12px)` so a two-line chip does not clip its first letters in the corner. `door-windows/styles.ts` |
| 2 | event-rule editor | Door list: an unbreakable door or station name made the box scroll sideways (content 880 px in a 370 px box, labels cut on both sides). | `.doors` grid column `minmax(0, 1fr)`; labels, station captions and check labels `min-inline-size: 0; overflow-wrap: anywhere`. `door-windows/events-styles.ts` |
| 3 | open-for dialog, holiday confirm, rule confirm | The confirm sentence containing a long unbreakable door label ran out of the dialog (box 408 px, content 823 px). | `p { overflow-wrap: anywhere }` in the shared form styles. `door-windows/events-styles.ts` |
| 4 | privacy masks, camera rail (phone) | One camera with a long name made a single pill wider than the screen (12,777 px rail); the button was also 26 px wider than its list item (content-box). | Item `max-inline-size: 85%`, button `box-sizing: border-box; min-inline-size: 0`, the name span ellipsizes. |
| 5 | privacy masks, picture frame | The frame was 2 px wider than its column (100% + border), pushing the whole layout 2 px past the page. | `.frame` and the review thumbnails `box-sizing: border-box`. |
| 6 | privacy masks, review / results / confirm | Review step: the grid column grew with an unbreakable camera name (main scrollWidth 878 in a 400 px screen, review cards outside the page). Results and the confirm dialog list had the same problem. | `.main` and `.review` columns `minmax(0, 1fr)`; names in review cards, results and the confirm list wrap (`overflow-wrap: anywhere`). |
| 7 | WhatsApp pacing card | The numeric inputs of the rate and queue-limit rows were wider than their label (content-box, 177 vs 169 px) at 400 px even with plain data. Long account labels and 11-digit counters then pushed the whole settings screen to 929 px wide. | Inputs `box-sizing: border-box`; host and rows `min-inline-size: 0`; account label and counter cells wrap (`overflow-wrap: anywhere`). `screens/messaging-pacing-card.ts` |
| 8 | bridge key card | A 90-character key id, result code or error message pushed the card 389 px out of the Settings column. | Host `min-inline-size: 0`; label, value, note, error, ok text `overflow-wrap: anywhere`. |
| 9 | bridge key card, phone | The reminder select (36 px) and the resume / rotate / immediate-rotation buttons (36 px) were under the 44 px phone target. | Phone and coarse pointer only: select `min-block-size: 44px`, buttons `--sw-ctl-h-sm: 44px` (the hook sw-button documents for this). |
| 10 | floor / area pickers, list | A long area or floor name made the option row 829 px wide and the popover scroll sideways; the count was pushed out. | Option name span `min-inline-size: 0; overflow-wrap: anywhere`, count `flex: none`; desktop popover capped at 480 px. `screens/devices-area-nav.ts` |

## Cases tried and results

Legend: PASS = no finding after the fixes; BEFORE = a finding existed before and was fixed (numbers above).

| Screen and state | Phone 400 light | Phone 400 dark | Desktop light | Desktop dark |
|---|---|---|---|---|
| Door windows list, 60 doors / 40 event rules / 40 log rows, all name kinds | BEFORE 1 -> PASS | PASS | PASS | PASS |
| Door windows list, zero doors, rules and log (empty states) | PASS | PASS | PASS | PASS |
| Event-rule editor, 60 doors, 160-char name, 181-char automation id, 99,999,999,999 duration, Arabic-Indic digits, validation error shown | BEFORE 2 -> PASS | PASS | PASS | PASS |
| Event-rule editor with zero doors | PASS | PASS | PASS | PASS |
| Holiday drawer, 400 rows, 9 name kinds incl. bidi and empty, manual and generated chips | PASS | PASS | PASS | PASS |
| Holiday confirm dialog (change of a day kind) | PASS | PASS | PASS | PASS |
| Holiday drawer, empty list | PASS | PASS | PASS | PASS |
| "Open for N hours", 60 doors, up to 24 hour buttons, choose step | PASS | PASS | PASS | PASS |
| "Open for N hours", confirm step with the longest door label | BEFORE 3 -> PASS | PASS | PASS | PASS |
| "Open for N hours", no doors (empty) | not reachable in that state (button hidden, like the product) | | | |
| Privacy masks, 30 cameras, ready state | BEFORE 4, 5 -> PASS | PASS | PASS | PASS |
| Privacy masks, a camera at the 4-region limit | PASS | PASS | PASS | PASS |
| Privacy masks, review step, confirm dialog, results with one failed write | BEFORE 6 -> PASS | PASS | PASS | PASS |
| Privacy masks, mask read fails / no picture / no cameras / no write permission / write switch off | PASS | n/a | PASS | n/a |
| WhatsApp pacing card, 12 accounts, huge counters, 30-year wait, backoff, budget | BEFORE 7 -> PASS | PASS | PASS | PASS |
| Pacing card, reader without manage (inputs disabled), pacing off, pacing read fails with a long message, no accounts | BEFORE 7 -> PASS | PASS | PASS | PASS |
| Messaging screen with 12 long account labels and 10 long department names | BEFORE 7 -> PASS | PASS | PASS | PASS |
| Bridge key card: long key id / generation 10^11 / unknown codes / 50 history rows | BEFORE 8, 9 -> PASS | PASS | PASS | PASS |
| Bridge key card: repair needed, rotating, off and not permitted, read error with long text, confirm panel | BEFORE 8, 9 -> PASS | PASS | PASS | PASS |
| Floor / area pickers, 30 floors, 60 areas, counts 10^11, closed and both menus open, phone choice "list" and "sheet" | BEFORE 10 -> PASS | PASS | PASS | PASS |
| Floor / area pickers: empty tree, tree read fails, single floor and area, one-letter and emoji names | PASS | PASS | PASS | PASS |

Checked by eye on screenshots: mixed Hebrew / Latin / digits keep their order (numbers, times and codes are isolated left-to-right), disabled
controls (undo changes, delete region, save with no change) are visibly dimmed, and empty and error states exist for every screen above.
Layout shift on loading was NOT measured (NOT_RUN).

## Not changed / reported

* The camera rail of the mask editor on the phone scrolls sideways by design (a swipe rail); the guard treats a row flex scroller as such.
* The shared `sw-toggle` is 42 x 24 px inside its own larger hit area; it is excluded from the 44 px rule in the guard, as in
  `layout-messaging-accounts.spec.ts`.
* Camera names in the mask rail are truncated with an ellipsis (a pill on one line); the full name is on the review and results steps.
* Desktop controls under 44 px are not findings (the 44 px rule is the phone's).
* Overlap with `pilot/MASKSWITCH-295`: this branch edits only CSS rules in `system-security-privacy-masks.ts` (the `.cams li`, `.cam`, `.frame`,
  `.main`, `.results .name`, `.review`, `.rv-card .name`, `.thumb` rules and one new `[data-pm-confirm-cameras] li` rule). MASKSWITCH's hunks
  touch the imports, a block right after `.bar .count` (about line 220), a block near line 534 and one at 614; no line is edited by both, but
  the `.frame` rule is within a few lines of its CSS insertion, so a textual merge conflict near it is possible. No template, switch row or word was changed.
* `tests/messaging-mocks.ts`: `baseView` is now exported (one word) so the stress spec can start from the standard view.

## Specs added

`tests/breakui-worst.ts` (worst-case strings + a self-contained in-page clip detector), `tests/evidence-breakui-doorwin.spec.ts`,
`evidence-breakui-masks.spec.ts`, `evidence-breakui-messaging.spec.ts`, `evidence-breakui-bridgekey.spec.ts`, `evidence-breakui-areanav.spec.ts`.
Each fails on a finding. Run on a Vite dev server: `SW_BASE_URL=http://127.0.0.1:<port>/ SW_SHOTS=1 npx playwright test tests/evidence-breakui-<x>.spec.ts --project=mobile|desktop --workers=1`.

## Checks

Nothing was run on the runner; everything ran locally on a Vite dev server (junction to the main checkout's node_modules, removed afterwards).

PASS (after the fixes): evidence-breakui-doorwin (phone and desktop, 4 + 4), evidence-breakui-masks (phone and desktop, 7 + 7), evidence-breakui-messaging
(phone and desktop, 8 + 8), evidence-breakui-bridgekey (phone and desktop, 10 + 10), evidence-breakui-areanav (phone and desktop, 16 + 16).
Regression, existing specs: evidence-doorwin-295 33 passed (all projects); evidence-bridge-key 21 passed; unit-door-windows-events 30 passed;
unit-privacy-mask 30 passed; unit-messaging-pacing 27 passed; evidence-maskui-295 mobile project 14 passed; its tablet "change history" test timed out once under machine load and
passed on a re-run alone (1 passed); the desktop project of that spec was interrupted by the tool time limit (the first 6+ tests passed,
no failure seen) - treat the desktop and tablet projects as NOT_RUN in full.
NOT_RUN: layout shift measurement, Arabic / Russian / English UI language
(only the data text was Arabic / Russian; the UI stayed Hebrew), the other skins, widths other than 400 px and 1440 px.
Defects found but not fixed: none open. Known limits: the mask-rail name is truncated with an ellipsis; very long numbers (11 digits) in the
pacing counters wrap mid-number instead of being abbreviated.
