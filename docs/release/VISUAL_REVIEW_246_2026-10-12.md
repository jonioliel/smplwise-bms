# Visual review of the 2.4.6 tier-L gate comparison (VISDIFF-246) - 2026-10-12

Branch `pilot/VISDIFF-246-review`. Reviewer: Claude Code (front-end QA pass), reading the gate's expected / actual / diff images of
`private/handoff-package/agents-1012/visual-246/` (72 screens: 25 equal, 47 differ, 0 error, 0 without a baseline) and checking the
causes in the code. Image numbers below are the `NNN-` prefixes of the files in that report's `images/`.

## What the comparison is

* The "expected" images are the Linux baselines of the M074 visual matrix (`frontend/tests/visual-matrix.spec.ts-snapshots/`). They were
  generated once on 2.2.0 (`bd45be7d`) and never re-accepted, so the comparison does not show only 2.4.5 -> 2.4.6: it shows everything
  that changed on these eleven screens since 2.2.0 (design unification DU1, the 2.4.4 glass light / dark setting, the Crystal skin, the
  2.4.5 security / home polish, the 2.4.6 settings, multimedia and wall work).
* Classic skin, demo data, fixed clock, light and dark, 1440 / 1024 / 390 px. `devices-building` renders the same home in demo mode as
  `devices-home`, so its rows repeat that one.
* Classes: **intended** = explained by a named change; **noise** = sub-pixel text or anti-aliasing drift with no visible change;
  **REGRESSION** = unintended defect.

## Named changes that explain the differences

| Tag | Change | Where it is recorded |
|---|---|---|
| DU1 | design unification: type scale (13 / 12.5 / 11 px tiers), control-state tokens, one focus-ring rule, switch-on and accent tokens (switches are the accent blue, no longer success green), filled (borderless) pills | `ae72b5d1`, `9c53e5f6`, `66b2537e`, `0df3816b`, `b31ea0d2` |
| GLASS | the glass screens (schedules, multimedia) follow the light / dark scheme (the 2.2.0 baselines painted a light page under dark chrome) | 2.4.4 `ced2cca9` |
| HOME | home widgets on state tokens: amber lights-on pill, status dot halo, filled count pills | 2.4.5 HOME-polish, `9c53e5f6` |
| SEC | alarm screen: state card, zone cards by area, count chips, cards / list switch, tokens | 2.4.5 `389e7773` |
| CRY | Crystal skin card in the skin picker (fifth skin) | 2.4.5 `3c46d677` |
| SET | settings navigation column / search row, shared settings stylesheet, new page heading block, accent-coloured switches | 2.4.6 `a3300c41`, `90cd92da` |
| MEDIA | multimedia and notification surfaces on tokens, toasts, remote | 2.4.6 `4dbbbe76` |
| KIOSK | wall display: state screens, offline tile | 2.4.6 `fd2abd38` |

## Classification (one row per difference)

| # | screen | state | scheme | viewport | class | change | reason |
|---|---|---|---|---|---|---|---|
| 000 | devices-home | ready | light | desktop | intended | HOME DU1 | home widgets on state tokens: filled count / device pills, amber lights-on pill, status-dot halo, one tier smaller date line and captions, cards 3 px taller |
| 001 | devices-home | ready | dark | desktop | intended | HOME DU1 | home widgets on state tokens: filled count / device pills, amber lights-on pill, status-dot halo, one tier smaller date line and captions, cards 3 px taller |
| 002 | devices-home | dialog | light | desktop | intended | DU1 HOME | the dialog: one double focus ring on the field (DU1 focus rule); the home behind it as in the previous rows |
| 004 | devices-building | ready | light | desktop | intended | HOME DU1 | the same home as 000 (demo data renders the building route as the home) |
| 005 | devices-building | ready | dark | desktop | intended | HOME DU1 | the same home as 001 |
| 006 | devices-schedules | ready | light | desktop | intended | DU1 | switches in the accent colour instead of success green, filled chips and day dots, toolbar: the "new" button moves from its own line onto the first row |
| 007 | devices-schedules | ready | dark | desktop | intended | DU1 GLASS | switches in the accent colour instead of success green, filled chips and day dots, toolbar: the "new" button moves from its own line onto the first row; the page body follows the dark scheme (the 2.2.0 baseline painted a light page under dark chrome) |
| 014 | settings-diagnostics | ready | light | desktop | REGRESSION (fixed) | SET CRY | settings: new navigation column with search, page heading block with eyebrow, Crystal skin card added; fixed here: the fifth skin card sat alone on a second line (R1), the column's group labels were 2.75:1 (R2) |
| 015 | settings-diagnostics | ready | dark | desktop | REGRESSION (fixed) | SET CRY | settings: new navigation column with search, page heading block with eyebrow, Crystal skin card added; fixed here: the fifth skin card sat alone on a second line (R1), the column's group labels were 2.75:1 (R2) |
| 016 | settings-notifications | ready | light | desktop | intended | DU1 SET | switches in the accent colour, filled channel chips, smaller chip tones (shared settings stylesheet, DU1); the page keeps its own section navigation, so no settings column here by design |
| 017 | settings-notifications | ready | dark | desktop | intended | DU1 GLASS | switches in the accent colour, filled channel chips, smaller chip tones (shared settings stylesheet, DU1); the page keeps its own section navigation, so no settings column here by design; the page body follows the dark scheme (2.4.4 glass setting) |
| 018 | security-alarm | ready | light | desktop | intended | SEC | alarm screen redesign: state card with one tone per state, count chips, cards / list switch, zones packed side by side by area, tinted open / bypassed cards, warning banner readable in dark (SEC) |
| 019 | security-alarm | ready | dark | desktop | intended | SEC | alarm screen redesign: state card with one tone per state, count chips, cards / list switch, zones packed side by side by area, tinted open / bypassed cards, warning banner readable in dark (SEC) |
| 020 | multimedia-screens | ready | light | desktop | intended | MEDIA DU1 | multimedia on tokens: accent power buttons, filled remote chip, glass cards, toast / text colours (MEDIA, DU1) |
| 021 | multimedia-screens | ready | dark | desktop | intended | MEDIA GLASS | multimedia on tokens: accent power buttons, filled remote chip, glass cards, toast / text colours (MEDIA, DU1); the page follows the dark scheme (2.4.4 glass setting; the 2.2.0 baseline painted a light page under dark chrome) |
| 024 | devices-home | ready | light | tablet | intended | HOME DU1 | home widgets on state tokens: filled count / device pills, amber lights-on pill, status-dot halo, one tier smaller date line and captions, cards 3 px taller |
| 025 | devices-home | ready | dark | tablet | intended | HOME DU1 | home widgets on state tokens: filled count / device pills, amber lights-on pill, status-dot halo, one tier smaller date line and captions, cards 3 px taller |
| 026 | devices-home | dialog | light | tablet | intended | DU1 HOME | the dialog: one double focus ring on the field (DU1 focus rule); the home behind it as in the previous rows |
| 027 | devices-home | dialog | dark | tablet | intended | DU1 HOME | the dialog: one double focus ring on the field (DU1 focus rule); the home behind it as in the previous rows |
| 028 | devices-building | ready | light | tablet | intended | HOME DU1 | the same home as 024 |
| 029 | devices-building | ready | dark | tablet | intended | HOME DU1 | the same home as 025 |
| 030 | devices-schedules | ready | light | tablet | intended | DU1 | switches in the accent colour instead of success green, filled chips and day dots, toolbar: the "new" button moves from its own line onto the first row |
| 031 | devices-schedules | ready | dark | tablet | intended | DU1 GLASS | switches in the accent colour instead of success green, filled chips and day dots, toolbar: the "new" button moves from its own line onto the first row; the page body follows the dark scheme (the 2.2.0 baseline painted a light page under dark chrome) |
| 038 | settings-diagnostics | ready | light | tablet | REGRESSION (fixed) | SET CRY | settings: search row above the page (a tablet gets no column), new heading block, Crystal skin card; fixed here: the fifth skin card sat alone on a second line (R1) |
| 039 | settings-diagnostics | ready | dark | tablet | REGRESSION (fixed) | SET CRY | settings: search row above the page (a tablet gets no column), new heading block, Crystal skin card; fixed here: the fifth skin card sat alone on a second line (R1) |
| 040 | settings-notifications | ready | light | tablet | intended | DU1 SET | switches in the accent colour, filled channel chips, smaller chip tones (shared settings stylesheet, DU1); the page keeps its own section navigation, so no settings column here by design |
| 041 | settings-notifications | ready | dark | tablet | intended | DU1 GLASS | switches in the accent colour, filled channel chips, smaller chip tones (shared settings stylesheet, DU1); the page keeps its own section navigation, so no settings column here by design; the page body follows the dark scheme (2.4.4 glass setting) |
| 042 | security-alarm | ready | light | tablet | REGRESSION (fixed) | SEC | alarm screen redesign (SEC); fixed here: the filter chips were 32 px and the cards / list switch 30 x 28 px on a touch layout (R3) |
| 043 | security-alarm | ready | dark | tablet | REGRESSION (fixed) | SEC | alarm screen redesign (SEC); fixed here: the filter chips were 32 px and the cards / list switch 30 x 28 px on a touch layout (R3) |
| 044 | multimedia-screens | ready | light | tablet | intended | MEDIA DU1 | multimedia on tokens: accent power buttons, filled remote chip, glass cards, toast / text colours (MEDIA, DU1) |
| 045 | multimedia-screens | ready | dark | tablet | intended | MEDIA GLASS | multimedia on tokens: accent power buttons, filled remote chip, glass cards, toast / text colours (MEDIA, DU1); the page follows the dark scheme (2.4.4 glass setting; the 2.2.0 baseline painted a light page under dark chrome) |
| 048 | devices-home | ready | light | mobile | noise | DU1 | sub-pixel text drift only (type-scale tiers, DU1: 13 -> 12.5 px captions, date line); no box moves |
| 049 | devices-home | ready | dark | mobile | noise | DU1 | sub-pixel text drift only (type-scale tiers, DU1: 13 -> 12.5 px captions, date line); no box moves |
| 052 | devices-building | ready | light | mobile | noise | DU1 | sub-pixel text drift only (type-scale tiers, DU1: 13 -> 12.5 px captions, date line); no box moves (same home as 048) |
| 053 | devices-building | ready | dark | mobile | noise | DU1 | sub-pixel text drift only (type-scale tiers, DU1: 13 -> 12.5 px captions, date line); no box moves (same home as 049) |
| 054 | devices-schedules | ready | light | mobile | intended | DU1 | switches in the accent colour instead of success green, filled chips and day dots, toolbar: the "new" button moves from its own line onto the first row |
| 055 | devices-schedules | ready | dark | mobile | intended | DU1 GLASS | switches in the accent colour instead of success green, filled chips and day dots, toolbar: the "new" button moves from its own line onto the first row; the page body follows the dark scheme (the 2.2.0 baseline painted a light page under dark chrome) |
| 060 | live-wall | ready | light | mobile | intended | KIOSK | wall / camera-wall states: the offline tile gets a ring behind its icon and slightly larger state text, the "demo" badge text re-set (KIOSK) |
| 061 | live-wall | ready | dark | mobile | intended | KIOSK | wall / camera-wall states: the offline tile gets a ring behind its icon and slightly larger state text, the "demo" badge text re-set (KIOSK) |
| 062 | settings-diagnostics | ready | light | mobile | intended | SET | settings: 44 px search row, new heading block (eyebrow + page title + one line); the skin cards stay one per row |
| 063 | settings-diagnostics | ready | dark | mobile | intended | SET | settings: 44 px search row, new heading block (eyebrow + page title + one line); the skin cards stay one per row |
| 064 | settings-notifications | ready | light | mobile | intended | DU1 SET | switches in the accent colour, filled chips, and the phone's search row above the heading (SET: the phone gets the search row on every settings page) |
| 065 | settings-notifications | ready | dark | mobile | intended | DU1 SET | switches in the accent colour, filled chips, and the phone's search row above the heading (SET: the phone gets the search row on every settings page); the page follows the dark scheme (2.4.4) |
| 066 | security-alarm | ready | light | mobile | REGRESSION (fixed) | SEC | alarm screen redesign (SEC); fixed here: the filter chips were 32 px and the cards / list switch 30 x 28 px on a phone (R3) |
| 067 | security-alarm | ready | dark | mobile | REGRESSION (fixed) | SEC | alarm screen redesign (SEC); fixed here: the filter chips were 32 px and the cards / list switch 30 x 28 px on a phone (R3) |
| 068 | multimedia-screens | ready | light | mobile | intended | MEDIA DU1 | multimedia on tokens: accent power buttons, filled remote chip, glass cards, toast / text colours (MEDIA, DU1) |
| 069 | multimedia-screens | ready | dark | mobile | intended | MEDIA GLASS | multimedia on tokens: accent power buttons, filled remote chip, glass cards, toast / text colours (MEDIA, DU1); the page follows the dark scheme (2.4.4 glass setting; the 2.2.0 baseline painted a light page under dark chrome) |

## Totals

| class | rows | images |
|---|---|---|
| intended | 35 | every other row |
| cosmetic noise | 4 | 048, 049, 052, 053 (phone home / building: sub-pixel text drift, no box moves) |
| UNINTENDED REGRESSION (all fixed in this branch; each of these rows is also an intended redesign, the defect is a part of it) | 8 | 014, 015, 038, 039 (R1; R2 also on 014 and 015), 042, 043, 066, 067 (R3) |
| total | 47 | |

The matrix has no row for the schedules settings page, but the layout sweep added for this review found a fourth defect there (R4).
Nothing was found wrong in RTL (every screen mirrors its text and controls; video and map geometry is untouched) and no screen lost an
element: what looks absent between a pair was moved (the "new" button of the schedules toolbar, the settings tabs behind the column) or replaced.


## Unintended regressions

### R1 - the fifth skin card sat alone on a second line (images 014, 015, 038, 039)
* **What**: the settings General page lists the skins in a grid of `repeat(auto-fit, minmax(170px, 1fr))`. The Crystal skin (2.4.5) made
  five cards in a card that holds four per row (about 850 px at 1440 and at 1024): a lone 25 % card on a second line and a hole beside it.
* **Cause**: `frontend/src/screens/system-design.ts`, `.skins`.
* **Fix**: the row (`.skinrow`) is a size container; from 740 px up the grid is five equal columns. Narrower cards keep the auto-fit
  grid (one per row on a phone, unchanged).
* **Spec**: `tests/layout-visdiff-246.spec.ts` "the skin cards share one row" (all card tops equal at 1024 and 1440).

### R2 - the settings navigation labels were 2.75:1 (images 014, 015)
* **What**: the five group labels of the new column ("מראה ותצוגה", "משתמשים ואבטחה", ...) are 10 px uppercase text in the tertiary
  text colour: 2.75:1 on the light page (the floor for small text is 4.5:1).
* **Cause**: `frontend/src/screens/system-nav.ts`, `.grp > b` and its icon read `--sw-text-3`.
* **Fix**: both read `--sw-text-2` (about 5:1 in light, higher in dark). No new token, no skin rule.
* **Spec**: "the settings navigation labels keep 4.5:1 against the page" (computed contrast, light and dark; 2.75 measured before the fix).

### R3 - the alarm screen's new filter chips and cards / list switch were below 44 px on touch layouts (images 042, 043, 066, 067)
* **What**: the 2.4.5 zone redesign added filter chips (32 px high) and a cards / list switch (30 x 28 px) to the alarm screen; on a phone
  and on the reference tablet both are touch targets, while the 2.4.6 controls next to them (search field, wall, kiosk, install cards)
  hold 44-48 px.
* **Cause**: `frontend/src/screens/security-alarm.ts`, `.chips button` (`min-block-size: 32px`) and `.vt button` (`30px x 28px`).
* **Fix**: up to 1100 px (the product's touch layouts) the chips are 44 px high and the switch buttons 44 x 44 px; desktop is unchanged
  (images 018 / 019 are not touched by the fix). The Bubble skin's own `.vt` rule is unchanged.
* **Spec**: "the zone filter chips" and "the cards / list switch are 44 px targets on a touch layout" (390 and 1024, light and dark).

### R4 - the last segment of the schedules defaults was clipped at tablet widths (not in the 47; found by the sweep)
* **What**: Settings > Schedules > "Editor defaults" > "Time snap": at 1024 px the "30 דק׳" segment ran 12 px past its track (the guard's `escape`).
* **Cause**: `frontend/src/styles/settings.ts`, `.seg`: `overflow: hidden` on a flex item lets the track shrink below its buttons in the
  page's 300 px side column. The rule belongs to the shared settings stylesheet, so the same control on other pages was exposed to it.
* **Fix**: `flex: none; max-inline-size: 100%` on `.seg` (the track keeps its width; the label next to it gives way).
* **Spec**: the per-screen sweep of `settings-schedules` (two `escape` findings before the fix, none after).

### Looked at and found fine
* Dark mode of the schedules, multimedia and notifications pages: the baseline painted a light page body under dark chrome; the current
  render is dark all the way (2.4.4 glass setting) and text and controls keep their contrast (the alarm warning banner is readable now; it was orange on brown).
* Switches turn accent blue (from success green) on every screen (DU1); light and dark both read clearly.
* The dialog's field gets one double focus ring (DU1); the dialog keeps its size and footer order.
* The wall's offline tile (060 / 061); the wall, the kiosk and the camera wall are otherwise unchanged at the sizes the matrix covers.

### Observed, present in the baseline too (not caused by 2.4.6; left alone)
* The notification matrix's last channel chip ("אפליקציה") is cut at the card edge on desktop and on the phone (a horizontal scroll area).
* On the tablet the settings tab strip's last tabs pass under the floating search / status corner.
* On the phone about 150 dense admin controls of the classic skin are 24-40 px (tab rows, automation icon buttons, storage and access buttons).
  The sweep lists them (`VISDIFF_REPORT=1`); the 44 px rule is held only for the redesigned controls named in the spec's `TARGETS`.
* On a wide screen the alarm zones pack four areas as three columns plus a lone fourth area on a second row (SEC design; a layout choice for the owner).
* The M074 visual-matrix baselines are the 2.2.0 images and were never re-accepted, so every gate since reports a growing set of differences.
  This branch refreshed only the 8 images its fixes change (see Tests); the other 64 should be accepted (or the comparison base moved)
  after the owner's look at the table above: `node scripts/visual.mjs accept --screens ...` on the runner.


## Tests

Local: nothing was run on the workstation (the new worktree has no `node_modules` and the RAM rule applies); everything ran on the shared runner.

| run | command | result |
|---|---|---|
| layout sweep, discovery on the unfixed code @ 403db3d1 | `run_smart.py spec pilot/VISDIFF-246-review tests/layout-visdiff-246.spec.ts --project=desktop` | FAIL as intended: 108 checks, 4494 findings; geometry classes: 2 `escape` (R4) and the sticky save bar / section row `floating` (by design, now in KNOWN); the rest `target` (dense admin controls); the alarm chips and switch measured 32 and 30 x 28 |
| the same spec @ fd3ba7a9 (fixed) | same | 21 passed (4.7 min) |
| the same spec @ b7604a3f (fixed + the skin-row and contrast tests) | same | 23 passed (4.6 min) |
| the spec on a commit without the fixes (temporary revert 0ffacc00, undone in f47421e5; tree identical to b7604a3f) | same, `-g "settings-schedules\|skin cards\|navigation labels\|44 px"` | 5 failed, 1 passed (the search-field guard, which no fix touches): seg escape, alarm chips, alarm switch, skin cards on two rows, label contrast 2.75 |
| `tsc` | `run_smart.py tsc pilot/VISDIFF-246-review --machine runner` @ fd3ba7a9 and @ b7604a3f | tsc ok, both |
| Linux pixel specs | `run_smart.py linux-pixel pilot/VISDIFF-246-review tests/pixel-nvr-encoding-batch.spec.ts tests/evidence-design-foundation.spec.ts` @ fd3ba7a9 | 38 passed, 19 skipped (tablet project, no baseline): no Linux pixel baseline of these two specs is changed by the fixes, so none was regenerated |
| M074 visual matrix, the two touched screens | `run_smart.py visual pilot/VISDIFF-246-review --screens settings-diagnostics,security-alarm` @ fd3ba7a9, then @ b7604a3f | 12 differ before; after the 8 baselines below were refreshed: pass 8, differ 4 (alarm 1440 light / dark and General 390 light / dark, which the fixes do not change) |

Baselines refreshed (`frontend/tests/visual-matrix.spec.ts-snapshots/*-linux.png`, copied from the runner's own `actual` images of the run at
fd3ba7a9 after looking at each one): `settings-diagnostics-ready-{light,dark}-{desktop,tablet}` and `security-alarm-ready-{light,dark}-{tablet,mobile}`.

NOT_RUN: `win32-pixel` (workstation only; the navigation label colour may move the `classic-settings-1440-desktop-win32` twin of
`evidence-design-foundation`, whose Linux twin still matches - run it on the workstation and re-accept only if it differs); the backend
suites (no backend change); the release gate; the other 64 matrix baselines are not touched; no live device or Home Assistant was used.

