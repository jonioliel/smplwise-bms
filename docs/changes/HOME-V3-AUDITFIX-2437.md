# HOME-V3-AUDITFIX-2437 - home interface v3: the round-30 design audit fixes

Branch `pilot/HOME-V3-AUDITFIX-2437` from `origin/pilot/HOME-V3-GAPS-2436` (437e25c41), which builds the v3 gaps and shares
`sw-home.ts` / `home-notif.ts` with this branch. Spec: `private/design-system-2026-10-27/round30/home-audit/FIXES.md` and its page
(`index.html`, break-ui table, 7 owner questions). Frontend only: no migration, no API change, no version bump, no CHANGELOG.
Nothing in `private/`, `secrets/`, `management/*.json` or the lab was touched.

The generated mockup ports (`home-styles.ts`, `home-styles-v3.ts`, `home-p3-styles.ts`) were hand-edited only where FIXES.md names their
lines (the phone / wide boundary queries, the phone day stepper, two easing fallbacks); each file's header says so. Every other style is in
`home-styles-extra.ts` under the `HOME-V3-AUDITFIX-2437` block.

## Owner questions (round 30 page) - what was assumed

| Q | Subject | Done here |
|---|---|---|
| 1 | Portrait tablet layout | recommended option (phone layout with the bottom bar, roomier) - item 2 |
| 2 | Calendar week strip | recommended option = as built (rolling 7 days): no change - item 20 |
| 3 | Camera with no live video | recommended option ("תמונה", grey dot, interval in the title) - item 5 |
| 4 | Line under "הבית שלי" | skipped: the home / site name is not in the home overview; needs a backend field - item 21 |
| 5 | Phone recordings header | recommended option (day only; the camera is chosen on the cameras screen) - item 1 |
| 6 | Screen-entry motion | skipped (owner's choice of motion); the motion notes that do not depend on it are done |
| 7 | When to fix | not a code question: everything that does not wait on Q4 / Q6 is in this branch |

## FIXES.md, item by item

| # | Item | Status | How / why |
|---|---|---|---|
| 1 | Phone recordings: no day choice | done | `.hs-head .cf-nav:not(.pb-days)` hidden only; the day stepper takes its own row, 48 px arrows, centred day word (`home-styles-v3.ts`, `home-styles-extra.ts`) |
| 2 | Portrait tablet 701-899 squeezed | done (Q1 recommended) | every phone query became `(max-width: 700px), (max-width: 899px) and (orientation: portrait)`, every wide query its complement (a landscape phone 701-899 keeps the wide layout, as before); `sw-home.ts` `HOME_PHONE_MQ` + `matchMedia` replaces `innerWidth <= 700`. The 701-899 portrait band: `--hit` 56, larger type, main area max 760 centred, hub 4x3 (same 12 tiles per page as the phone's 3x4). Not done: widget / card grids at 4 columns (FIXES sketch) - the JS paging capacity is the phone's 3x5 / one-column lists, 4 columns would leave half-empty pages |
| 3 | Phone alarm icon clipped | done | FIXES CSS (state pane from the top, content height; zones pane the rest), the status line clamps to 2 lines |
| 4 | Locked wall panel "יומן" chip spills | done | chip children shrink and ellipsize; `MoreLine.chip` / `title`: a title longer than 14 characters makes the chip say `הבא ב-HH:MM`, the full line in `title` |
| 5 | Still camera labelled "חי" | done (Q3 recommended) | `camPic`: live tile = "מתחבר" (no dot) until its player reports `playing` ("חי"), a still fallback = "תמונה"; the cameras screen's refreshing stills = "תמונה" with the offline dot, "מתעדכנת כל 30 שנ׳" in the title. `sw-camera-tile` `noLabel` (new, default off) drops its own still label in home tiles, so nothing sits under the star |
| 6 | Broken-image glyph | done | `sw-camera-tile`: a failed poster is hidden (`visibility`), shown again on the next successful still; `color: transparent` as the belt |
| 7 | Blank cool-grey first frame | done | `public/home-paint.js` (classic script file - the remote channel CSP is `script-src 'self'`) paints the stored home background (`arx-home-paint`: theme, scheme, `--hs-bg`, written by `sw-home` after each layout apply) when the address is the home's; `sw-home` takes the stored theme / scheme until the prefs arrive and hands the page background back. The loading state (`.empty.loading`) already existed |
| 8 | Room screen orphan row | skipped | the room grid is the person's own favourites in the order they set in "הגדרות › מועדפים" (move up / down); re-ordering by tile type would override that order. The grid already packs `row dense`. Needs an owner decision |
| 9 | Four identical chevrons | done | the camera stepper names the camera (`.pbc`, max 18ch, ellipsis, `title`), 16 px between the groups; the wide title no longer repeats the name |
| 10 | Announce: one-option segment | done | one target = a plain row "איפה · כל הבית"; two = the segment |
| 11 | Phone electricity title cut | done | energy and water heads: the actions take the next row, the reading never truncates |
| 12 | Gendered slash | done | `callResult`: `הדלת נפתחה · <name>`, `נענתה · <name>`; the doors screen now uses `callResult` too (was its own copy) |
| 13 | Locked wall panel renders any route | done | `route()` maps every name outside the panel's own links (room, its categories, the bottom bar, media, notices, calendar; cameras only when the room has one) to the room |
| 14 | "מי הגיע" result wraps | done | one line, ellipsis, full text in `title` |
| 15 | Latin names truncated at their start | done | `.clamp1/.clamp2` (not `.num`), chip and room titles: `unicode-bidi: plaintext; text-align: match-parent` - each name takes its own direction (= `dir="auto"` everywhere at once) and stays right-aligned; plus `dir="auto"` on the names touched here |
| 16 | "(אני)" cut, negative count | done | the name and the mark are separate (`.me-mark` never shrinks); both header numbers from the list |
| 17 | Unformatted extremes | done | `num1` (`Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 })`) for water month, energy totals and room rows (rows carry "קוט״ש"); above 999 % "הרבה יותר מיום רגיל" (`diffWords`) |
| 18 | Sheet type | done | `.ovl { font-size: var(--f-body); line-height: 1.5; color: var(--hs-text) }` |
| 19 | 43 px day buttons in sheets | see test | measured by the spec (`19:`); the existing `.ovl .week.mini` rule already spreads the 7 buttons over the sheet width |
| 20 | Week strip from today | no change (Q2 recommended = as built) | |
| 21 | Line under "הבית שלי" | skipped (Q4) | no home / site name in the home overview; needs a backend field and the owner's choice |
| 22 | Active media source not marked | done | `.hs .md-src .chip2[aria-pressed="true"]` (accent-soft, accent-text, 600); `aria-pressed` was already there |
| 23 | Ticket icon tints | done | received = accent, in progress = warning, done = neutral |
| 24 | Category chips without icons | done | icon from the category's name (drop, bolt, thermometer, door, sparkle, dots) |
| 25 | "מאז היום 07:23" | done | today drops the day word |
| 26 | Alarm with no sensors | done | the standard `.empty` block |
| 27 | Music with no devices offers "כריזה" | done | the empty media screen's head has no announce / stop buttons |
| 28 | Truncated text without `title` | done | `sw-home` `titleHint`: on mouse hover a truncated `.clamp*`, `.ellip`, chip line or call result gets its full text as `title` (measured only on hover; a title the screen set is kept) |
| 29 | Long first name greeting | done | above 14 characters the greeting stands alone; the heading clamps to 2 lines |
| M1 | Rise on every navigation | skipped (Q6) | |
| M2 | Sheets unmount at once | done | `ghostOverlay`: a copy of the closing sheet, in its own closed shadow root with the same sheets (queries / tests never see two), takes the mockup's own `.out` exit classes (140-200 ms) and removes itself; not for sheets holding a live element (a copy would open a stream), not under reduced motion |
| M3 | Easing fallbacks | done | `cubic-bezier(.23,1,.32,1)` / `cubic-bezier(.77,0,.175,1)` |

## Break-ui table (index.html)

| # | Finding | Status |
|---|---|---|
| 1 | Phone recordings, no other day | done (item 1) |
| 2 | Alarm with a 40-character name | done (item 3) |
| 3 | Wall chip event spill | done (item 4) |
| 4 | LG-OLED / Kitchen-Island names cut at the start | done (item 15) |
| 5 | Doors result wraps | done (item 14) |
| 6 | "(אני)" cut | done (item 16) |
| 7 | Water 305979 % / 98000.0 | done (item 17) |
| 8 | Energy rows 12480.5 | done (item 17) |
| 9 | Broken snapshot glyph | done (item 6) |
| 10 | Negative "בחוץ" | done (item 16) |
| 11 | Long first-name greeting | done (item 29) |
| 12 | No full text for cut names | done (item 28) |

## Tests

Spec: `frontend/tests/home-v3-auditfix-2437.spec.ts` (desktop project, sizes per test; mocked backend, stamps relative to the clock).
Existing specs updated for the new call-log words: `home-v3-p1.spec.ts`, `unit-home-v3-p1.spec.ts`.

Results: see the section below (filled from the actual runs).
