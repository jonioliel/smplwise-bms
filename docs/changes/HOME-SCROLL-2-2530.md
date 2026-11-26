# HOME-SCROLL-2-2530 - a last fit step: the top bar and the floor tiles compress on low screens

Branch `pilot/HOME-SCROLL-2-2530` from `origin/pilot/HOME-SCROLL-FIX-2530` (c41c14ad0). Target 2.53.
Follow-up of HOME-SCROLL-FIX-2530 open question 2 (answer a: one more fit step, measured, tokens only).

## Problem

With the product default info style (`home.info_style` = auto: the cards in the cards view, the header bar in tiles) the home screen
still scrolled the page area at the tightest packing (fit 2) on low screens, against the owner rule "no scrolling in control screens":
the tiles view at 1366x768 in directions a and c, and a landscape tablet in every direction. Phone and portrait tablet scroll by design
and are out of scope.

Measured on the runner (devices fixture backend, the owner's site size: 3 floors, 8 areas, ~150 devices; `?design=a` = the domus
skin; every default widget). At 1366x768 in the tiles view of a / c (fit 2) the page area was 796 / 768: the title row 58 px (domus
48 px heading), the page's own block spacing (14 px top, 14 px gaps, a 14 px gap before the bulk dialog's empty host, 24 px bottom),
and three floor rows of tiles held at their 96 px resting height although their content (the name line and the 30 px quick row) needs
about 67 px. On the landscape tablet (1024x768) the same tiles view was 836 / 768 in every direction (four floor sections stacked).

## What changed

| Where | Change |
|---|---|
| `frontend/src/screens/devices-building.ts` | `fitSqueeze` (state): the last home-only step. When the packing is settled at fit 2 (and, where direction b's column is drawn, b's fold is already on) and the page area still scrolls, `fitSqueeze` turns on: `data-squeeze` on `sw-page` and on `.page-body`. It resets with the packing (a changed fit key) and off the fit-eligible widths / in edit mode, exactly as the fold. The shared `fitStep` / `FitLevel` (also used by the area screen) are unchanged. A settled packing is measured again 0.6, 1.5 and 3 s later (`scheduleFitRecheck`, at most three times per fit key): the shell's setup hint is fetched after the screen draws and lengthens the page area ABOVE the page body, which nothing the screen watches reports - in the first runner pass the 1366x768 tiles view of a stayed unsqueezed (28 px) in one of the two colour schemes for that reason. |
| `frontend/src/screens/devices-building-css.ts` | The top bar at `sw-page[data-squeeze]`: the page title takes the skin's own phone heading size (`--sw-h1: var(--sw-h1-phone)`; domus 48 -> 26 px), the page's block spacing the spacing tokens (top `--sw-s-2`, bottom `--sw-s-3`, gaps `--sw-s-2`). |
| `frontend/src/screens/home-screen-css.ts` | The floor tiles at `.page-body[data-squeeze]`: a tile with its quick row drops its resting height (`min-block-size: 96px` -> its content) and keeps the head line plus the 30 px quick row under it (`padding-block-end: calc(var(--sw-s-8) + var(--sw-s-2))`, the row at `--sw-s-1` from the edge). The bubble skin (touch-sized actions) keeps its tall tile. |
| `frontend/src/components/sw-page.ts` | Three knobs with today's values as defaults: `--sw-page-pad-start` (14px), `--sw-page-pad-end` (24px), `--sw-page-gap` (14px, the header / body gap and the body's own gap). Nothing sets them except the home screen's squeeze step, so every other page is unchanged. |
| `frontend/tests/evidence-home-screen.spec.ts` | A new test with the product default info style: every direction x view fits without a page scroll at 1440x900, 1366x768, 1280x800 and 1024x768; at 1440x900 the squeeze step is never on. |

Tokens only: `scripts/design_ratchet.py` - no count above the baseline (px-literal 25513, color-literal 1984, scroll-container 13 - all
equal to the baseline). Resting look: unchanged on every screen that fits at fit 0-2 (the step needs a page scroll at fit 2 first).

## Measurements (runner, before = c41c14ad0, after = b2041be28, light; dark measured too with the same results; `before -> after`, page area overflow at the tightest step)

Product default info style (`home.info_style` = auto) - the scope of this row:

| Direction / view | 1440x900 | 1366x768 | 1280x800 | 1024x768 | 1180x820 |
|---|---|---|---|---|---|
| a cards | fits -> fits | fits -> fits | fits -> fits | +9 px -> fits (squeeze) | fits -> fits |
| a tiles | fits -> fits | +28 px -> fits (squeeze) | fits -> fits | +68 px -> fits (squeeze) | fits -> fits |
| b cards | fits -> fits | fits -> fits | fits -> fits | fits -> fits | fits -> fits |
| b tiles | fits -> fits | fits -> fits | fits -> fits | +68 px -> fits (squeeze) | fits -> fits |
| c cards | fits -> fits | fits -> fits | fits -> fits | +7 px -> fits (squeeze) | fits -> fits |
| c tiles | fits -> fits | +28 px -> fits (squeeze) | fits -> fits | +68 px -> fits (squeeze) | fits -> fits |

The cards info style (`home.info_style` = cards, not the default; the spec's own configuration) - improved, not solved (see Q2):

| Direction / view | 1440x900 | 1366x768 | 1280x800 | 1024x768 | 1180x820 |
|---|---|---|---|---|---|
| a cards | fits -> fits | +116 px -> +59 px (squeeze) | +84 px -> +27 px (squeeze) | +158 px -> +102 px (squeeze) | fits -> fits |
| a tiles | fits -> fits | +244 px -> +100 px (squeeze) | +212 px -> +68 px (squeeze) | +339 px -> +195 px (squeeze) | +141 px -> fits (squeeze) |
| b cards | fits -> fits | fits -> fits | fits -> fits | fits -> fits | fits -> fits |
| b tiles | fits -> fits | fits -> fits | fits -> fits | +321 px -> +120 px (squeeze) | +23 px -> fits (squeeze) |
| c cards | fits -> fits | fits -> fits | fits -> fits | +7 px -> fits (squeeze) | fits -> fits |
| c tiles | fits -> fits | +52 px -> fits (squeeze) | +20 px -> fits (squeeze) | +187 px -> +44 px (squeeze) | +97 px -> fits (squeeze) |

At 1440x900 nothing reaches the squeeze step in either style (the resting look there is unchanged). After, at 1024x768 tiles: title row 40 px (the header bar's own height), a tile 67 px, the page ends at 768.

## Tests run (real results)

| What | Where / command | Result |
|---|---|---|
| `scripts/design_ratchet.py` | PC, `py -3.12 scripts/design_ratchet.py` (at 1af3bf7a7 and b2041be28) | rc 0: no count above the baseline (all metrics equal to the baseline) |
| Diagnostic copy of the home spec (every direction x view x 1440x900 / 1366x768 / 1280x800 / 1024x768 / 1180x820, info style auto and cards, light and dark; screenshots; not committed) | runner, `scripts/fixture_job.py diag-home-scroll2` (devices group, desktop; `~/work/p2520_homescroll2_diag.sh`): before at c41c14ad0, after at 1af3bf7a7 and at b2041be28 | every run rc 0; the tables above. At 1af3bf7a7 the dark pass left a tiles 1366x768 unsqueezed (28 px, the setup-hint timing) - fixed by b2041be28's re-measure; at b2041be28 all 60 default-style cases fit in light and dark |
| `evidence-home-screen.spec.ts` (desktop + mobile, the JSON's projects), with the new test | runner, `~/smplwisebms/.venv/bin/python scripts/fixture_job.py evidence-home-screen --no-build` | 1af3bf7a7: rc 0, 24 passed, 0 failed, 22 skipped. **b2041be28, two runs in a row: rc 0 / rc 0, 24 passed, 0 failed, 22 skipped each** (each project skips the other's tests) |
| `visual-matrix.spec.ts`, the home cases (`-g "devices-building\|devices-home"`), desktop 1440x900 + tablet 1024x768, light + dark | runner, `npx playwright test tests/visual-matrix.spec.ts --project=desktop --project=tablet -g ... --workers=2` against the branch build | 1af3bf7a7 and b2041be28: **rc 0, 12 passed** - the committed Linux baselines still match (the mock site fits there without the new step), so no baseline was refreshed |
| eslint on the five changed source / spec files | runner, `npx eslint src/screens/devices-building.ts src/screens/devices-building-css.ts src/screens/home-screen-css.ts src/components/sw-page.ts tests/evidence-home-screen.spec.ts` | rc 0, 0 errors (1 warning: the spec file is on the eslint ignore list) |
| tests typecheck | runner, `npx tsc --noEmit -p tsconfig.tests.json` | rc 0 |
| Source typecheck + build | runner, inside the fixture jobs (`npm run build` = `tsc --noEmit && vite build`) | passed at both heads (the jobs ran on those builds) |

Before / after screenshots: runner (`~/work/p2520_homescroll2_before/`, `~/work/p2520_homescroll2_after/`), compare page
`private/planning/home-scroll-2-2530_compare_2026-11-25.html` (local, not in the repo).

NOT_RUN: tsc / vite / Playwright on the PC (PC rule); the release gate; the other skins than domus (`?design=a`) were not measured
(the step is token-based: the title takes each skin's own `--sw-h1-phone`; the bubble skin keeps its tall tiles, so a bubble site may
still scroll where domus no longer does); the area screen (unchanged - `fitStep` is untouched).

## Open questions (recommendation first)

1. The cards info style (`home.info_style` = cards, not the product default) still scrolls on low screens, mostly in direction a, where
   the band of large cards stays tall (1366x768: a cards +59 px, a tiles +100 px; 1024x768: a / b / c tiles +44 to +195 px):
   (a) a follow-up row that folds that band too on the squeeze step (headings off, the clock at the display size, as b's fold does),
   measured the same way [recommended]; (b) accept a scroll with that non-default style below 1440x900.
2. The squeeze step makes the page title smaller (domus: 48 -> 26 px, the skin's own phone size) only on a low screen that would
   scroll: (a) keep [recommended - it is the top bar part of the step, and it is what the cards info style needs most]; (b) keep the
   title and compress only the spacing and the tiles (by the measurements the default style would still fit: the spacing gives about
   30 px and every floor row of tiles about 29 px; the cards info style would scroll about 18-27 px more - computed, not measured).
3. `evidence-home-screen.spec.ts` in the gate: as in HOME-SCROLL-FIX-2530 Q1 - (a) flip it to `"gate": true` in the fixture lane once
   GATE-FIXTURE-LANE-2530 merges [recommended]; (b) keep it job-only.

## Rollback

Revert the branch's commits. No data, setting or API change.
