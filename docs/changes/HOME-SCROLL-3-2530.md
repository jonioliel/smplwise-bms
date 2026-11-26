# HOME-SCROLL-3-2530 - the band of large cards folds on the last fit step (the cards info style)

Branch `pilot/HOME-SCROLL-3-2530` from `origin/release/2530-train` (8ae83adfa, which carries HOME-SCROLL-FIX-2530 and
HOME-SCROLL-2-2530). Target 2.53. Follow-up of HOME-SCROLL-2-2530 open question 1 (answer a: fold that band too on the squeeze step,
measured the same way).

## Problem

With the cards info style (`home.info_style` = cards; not the product default, which is `auto`) the home screen keeps the large cards
(clock, weather, Shabbat, alarm, quick actions) in both views. In direction a they sit in a band (`home-widgets layout="hero"`) that
stayed tall on HOME-SCROLL-2's squeeze step: at fit 2 a large card still drew its heading, the clock at its band size, a resting
height of 96-110 px, and the owner's five cards (two large, three medium) wrapped onto a second row below 1440 px (302 px of band at
1366x768). The page area still scrolled: a cards +59 / a tiles +100 px at 1366x768, +27 / +68 px at 1280x800, +102 / +195 px at
1024x768 (runner, devices fixture, the owner's site size).

## What changed

| Where | Change |
|---|---|
| `frontend/src/screens/devices-building.ts` | `home-widgets` gets `data-squeeze` while the screen's squeeze step (`fitSqueeze`, HOME-SCROLL-2) is on AND the widgets are drawn as the band (`layout === 'hero'`). No new state, no new step: the band folds on the same step that compresses the top bar and the floor tiles, and resets with it. |
| `frontend/src/screens/home-widgets-css.ts` | `:host([layout='hero'][data-squeeze])`: the band folds the way direction b's column folds (HOME-SCROLL-FIX-2530) - the card headings go, the clock reads at the display size (`--hm: var(--sw-fs-4xl)`), each card takes its content's height (`min-block-size: auto`, `padding-block: var(--sw-s-2)`), the gap is `--sw-s-2`; and each card's flex basis is four fifths of its resting one (`calc(var(--wb) * 0.8)`) so the owner's five cards keep one row at 1366 / 1280 and the four of a landscape tablet keep one row at 1024 (a longer band still wraps, as before). The narrower large weather card puts its measures on a line under the reading (one grid column) - in the first pass the reading was cut to "28..." at 1366x768 / 1024x768. |
| `frontend/tests/evidence-home-screen.spec.ts` | A new test with the cards info style: every direction x view fits without a page scroll at 1440x900, 1366x768, 1280x800 and 1180x820; direction a's band folds exactly when the page squeezes (then no visible heading, one row) and keeps its headings at rest; the other directions' widgets never get the attribute; at 1440x900 nothing squeezes. |

Tokens only: `scripts/design_ratchet.py` - no count above the baseline (px-literal 25512 (baseline 25513), color-literal 1984,
scroll-container 13). The `0.8` is a ratio, not a size literal. Resting look: unchanged wherever the page fits at fit 0-2 (the step
needs a page scroll at fit 2 first); the product default style (`auto`) never draws the band on a fit-eligible screen (its cards view
draws the row of c, its tiles view the header bar), so nothing changes there - measured, see below.

## Measurements (runner, devices fixture, `?design=a` = domus; before = 8ae83adfa, after = d968b5bbf; light and dark, identical; page area overflow at the tightest step, `before -> after`)

The cards info style - the scope of this row:

| Direction / view | 1440x900 | 1366x768 | 1280x800 | 1024x768 | 1180x820 |
|---|---|---|---|---|---|
| a cards | fits -> fits | +59 px -> fits (band folded) | +27 px -> fits (band folded) | +102 px -> fits (band folded) | fits -> fits |
| a tiles | fits -> fits | +100 px -> fits (band folded) | +68 px -> fits (band folded) | +195 px -> **+56 px** (band folded) | fits -> fits (band folded) |
| b cards | fits -> fits | fits -> fits | fits -> fits | fits -> fits | fits -> fits |
| b tiles | fits -> fits | fits -> fits | fits -> fits | **+120 px -> +120 px** | fits -> fits |
| c cards | fits -> fits | fits -> fits | fits -> fits | fits -> fits | fits -> fits |
| c tiles | fits -> fits | fits -> fits | fits -> fits | **+44 px -> +44 px** | fits -> fits |

The product default info style (`auto`): all 60 cases (3 directions x 2 views x 5 sizes x light / dark) identical before and after -
every case fits, the band never folds (it is not drawn there).

Remaining overflow (all at 1024x768, the cards info style, tiles view; see Q1): a tiles +56 px (the band is one row of 4 now; the floors
under it - four floor sections, the summary row on two text lines - are the rest), b tiles +120 px (the floors column beside the folded
widget column: the floor tiles wrap two per row in the narrow main column), c tiles +44 px (the row of c, as tall as its Shabbat card,
plus the summary row on two text lines). None of them is the band of a.

### The bubble skin (frozen)

The bubble skin is frozen (BUBBLE-FREEZE-295: not offered, a stored / requested bubble reads as domus), so no installation can show it
today. It was measured with a diagnostic-only unfreeze (`stage: 'stable'` in the runner's diagnostic copy, `?skin=bubble`; never
committed), light, both info styles. It overflows almost everywhere, also at 1440x900, before and after this row alike:

The cards info style (bubble, light; `before -> after`):

| Direction / view | 1440x900 | 1366x768 | 1280x800 | 1024x768 | 1180x820 |
|---|---|---|---|---|---|
| a cards | +53 px -> fits (band folded) | +185 px -> fits (band folded) | +401 px -> +202 px (band folded) | +477 px -> +338 px (band folded) | +302 px -> +271 px (band folded) |
| a tiles | +65 px -> fits (band folded) | +297 px -> +98 px (band folded) | +319 px -> +120 px (band folded) | +387 px -> +248 px (band folded) | +116 px -> +85 px (band folded) |
| b cards | fits -> fits | +146 px -> +146 px | +114 px -> +114 px | +397 px -> +397 px | +198 px -> +198 px |
| b tiles | fits -> fits | +22 px -> +22 px | +32 px -> +32 px | +384 px -> +384 px | +55 px -> +55 px |
| c cards | +35 px -> +35 px | +167 px -> +167 px | +383 px -> +383 px | +325 px -> +325 px | +258 px -> +258 px |
| c tiles | +47 px -> +47 px | +279 px -> +279 px | +301 px -> +301 px | +236 px -> +236 px | +72 px -> +72 px |

The product default style (`auto`) with bubble: unchanged by this row (the band is not drawn there) and overflowing in 25 of 30 cases,
from +10 px (b tiles 1366x768) to +397 px (b cards 1024x768); at 1440x900 a / c cards +35 px, a / c tiles +47 px. The bubble skin's
own sizes (touch-sized pills, its larger floor rows, its tall tiles that HOME-SCROLL-2 kept on purpose) are the cause, not the band.

## Tests run (real results)

| What | Where / command | Result |
|---|---|---|
| `scripts/design_ratchet.py` | PC, `py -3.12 scripts/design_ratchet.py` (at b9696b32d and d968b5bbf) | rc 0: no count above the baseline |
| Diagnostic copy of the home spec (every direction x view x 1440x900 / 1366x768 / 1280x800 / 1024x768 / 1180x820, info style auto and cards; domus light and dark, bubble light; screenshots; not committed) | runner, `scripts/fixture_job.py diag-home-scroll3` (devices group, desktop; `~/work/p2520_homescroll3_diag.sh`): before at 8ae83adfa, after at b9696b32d and at d968b5bbf | every run rc 0 (120 + 60 cases each); the tables above are 8ae83adfa -> d968b5bbf. At b9696b32d the weather reading was cut ("28...") - fixed by d968b5bbf; that pass also had one transient (light, a tiles 1280x800 measured at fit 0, 431 px, during a re-pack) that did not repeat: d968b5bbf's full pass and three more passes of a tiles 1280x800 / 1366x768 light + dark (12 cases) all fit |
| `evidence-home-screen.spec.ts` (desktop + mobile, the JSON's projects), with the new test | runner, `~/smplwisebms/.venv/bin/python scripts/fixture_job.py evidence-home-screen [--no-build]` at d968b5bbf | 4 runs at d968b5bbf: run 1 rc 1 (24 passed, 1 failed: the edit-mode drag reorder), run 2 rc 1 (23 passed, 2 failed: b cards 1440x900 "main 962/900", the weather sensor reading) - both while a release gate loaded the runner (load ~30, under 1 GB free); after the gate: **run 3 rc 0, 25 passed, 0 failed, 23 skipped**; run 4 rc 1 (24 passed, 1 failed: the edit-mode drag reorder again). **The new test passed in all 4 runs.** Control at the train head (aeb05ad3d, without this branch), after the gate: rc 0 (24 passed) / rc 1 (22 passed, 2 failed: b cards and b tiles 1366x768 "main 962/768") / rc 1 (23 passed, 1 failed: the weather sensor reading) - the spec is flaky on the runner at the base too. The drag failure was not seen in the 3 base runs; it is in edit mode, where this branch changes nothing (the squeeze step, and with it the band's `data-squeeze`, is off in edit mode) - see Q4 |
| `visual-matrix.spec.ts`, the home cases (`-g "devices-building\|devices-home"`), desktop 1440x900 + tablet 1024x768, light + dark | runner, `npx playwright test tests/visual-matrix.spec.ts --project=desktop --project=tablet -g ... --workers=2` against the branch build (d968b5bbf) | **rc 0, 12 passed** - the committed Linux baselines still match (the product default style there never draws the band), so no baseline was refreshed |
| eslint on the three changed files | runner, `npx eslint src/screens/devices-building.ts src/screens/home-widgets-css.ts tests/evidence-home-screen.spec.ts` | rc 0, 0 errors (1 warning: the spec file is on the eslint ignore list) |
| tests typecheck | runner, `npx tsc --noEmit -p tsconfig.tests.json` | rc 0 |
| Source typecheck + build | runner, inside the fixture jobs (`npm run build` = `tsc --noEmit && vite build`) | passed at every head (the jobs ran on those builds) |

Before / after screenshots: runner (`~/work/p2520_homescroll3_before/`, `~/work/p2520_homescroll3_after2/`, `..._bubble/`), compare
page `private/planning/home-scroll-3-2530_compare_2026-11-25.html` (local, not in the repo).

NOT_RUN: tsc / vite / Playwright on the PC (PC rule); the release gate; skins other than domus and (diagnostic) bubble; the area screen
(unchanged - `fitStep` is untouched); a band longer than the owner's five cards (by the CSS it wraps as before, not measured).

## Open questions (recommendation first)

1. The cards info style still scrolls on a 1024x768 landscape tablet in the tiles view (a +56, b +120, c +44 px); the band of a is not
   the cause any more (one row, folded): (a) accept it for that non-default style on the smallest landscape tablet [recommended - the
   product default fits there, and the remaining height is the floors and the summary row, whose further packing would change the
   tiles' look on every screen that reaches the step]; (b) a follow-up row that packs the floor sections and the summary row on the
   squeeze step at 1024 (two-line summary labels to one line, the floor chip row beside the floor name), measured the same way.
2. The bubble skin (frozen) overflows on every size, 1440x900 included, independent of this row: (a) leave it to the unfreeze task -
   its fit pass belongs to whoever unfreezes the skin [recommended]; (b) a separate row now to fit the frozen skin.
3. The band's cards on the squeeze step are four fifths of their resting width, so the band keeps one row: (a) keep [recommended - it is
   most of the saving; the content was checked on the screenshots: the weather reading now whole, the quick actions' labels whole];
   (b) fold the headings only and let the band wrap (a tiles at 1366x768 would still scroll by roughly 40-50 px - estimated from the card heights, not measured).

4. `evidence-home-screen.spec.ts` (`"gate": true` in the fixture lane) is flaky on the runner - the base fails 2 of 3 runs, in other
   tests than this row's: (a) a follow-up row that stabilises the three flaky tests (the edit-mode drag reorder, direction b's fit at
   1366x768 right after a reload, the weather sensor reading) [recommended]; (b) leave it as it is.

## Rollback

Revert the branch's commits. No data, setting or API change.
