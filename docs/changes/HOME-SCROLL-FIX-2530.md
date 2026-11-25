# HOME-SCROLL-FIX-2530 - direction b's widget column no longer scrolls the home screen

Branch `pilot/HOME-SCROLL-FIX-2530` from `origin/release/2520-train` (9b659b361, the 2.52.0 train head). Target 2.53.
Found by GATE-FIXTURE-LANE-2530 (`docs/changes/GATE-FIXTURE-LANE-2530.md` on `origin/pilot/GATE-FIXTURE-LANE-2530`, open question 1):
`evidence-home-screen.spec.ts`, desktop, direction b, cards and tiles view at 1440x900 - the page area (`main`) scrolled 918 / 900 px,
against the owner rule "no scrolling in control screens".

## Cause (measured on the runner, devices fixture backend, the owner's site size)

Direction b draws the widgets as a column beside the floors (`.bgrid` > `.bside` > `home-widgets layout="side"`). The fit packing
(devices-building.ts `measureFit`, levels 0-2) stepped to its tightest level, 2, and the page still scrolled because the column - not
the floors - was the part that reached lowest:

| 1440x900, fit 2, before | top..bottom |
|---|---|
| summary tiles `.kpis` | 186..257 |
| floors column `.bmain` (cards / tiles) | 265..580 / 265..708 |
| widget column `.bside` | **265..880** (page area ends 918 with its bottom padding: 18 px over) |
| clock m / weather m / Shabbat m | 138 / 124 / 149 px |
| alarm s / quick actions s | 78 / 78 px - their content is 50 / 52 px; the side layout's resting floor `min-block-size: 78px` held at fit 2 |
| column gap | 12 px x 4 |

Fit 2 of the side layout trimmed the medium / large cards (padding 8 px, floor 90 px, forecast / countdown / extra quick line hidden)
but kept the small cards' 78 px floor and the 12 px gap. Not a padding / `100vh` sum: no `vh` / `dvh` height is involved; the shell
page area (`main`) and `sw-page` add nothing unusual. On shorter screens the same column overflowed far more (before: 1280x800 by
118 px, 1366x768 by 150 px, 1024x768 by 75 px), which fit 2 could never absorb.

## What changed

| Where | Change |
|---|---|
| `frontend/src/screens/home-widgets-css.ts` | At `layout='side'` + `data-fit='2'`: the column gap is `var(--sw-s-2)`; the small cards' resting floor is released (`min-block-size: auto`, the card takes its content's height). With `data-fold` (below) as well: the card headings fold (`.wg-h` hidden - the row of direction c already hides them) and the clock's digits use `--sw-fs-4xl` (the display-reading token). |
| `frontend/src/screens/devices-building.ts` | `fitFold` (state): one home-only step past fit 2. When the packing is settled at 2, the direction-b grid (`[data-bgrid]`) is drawn and the page area still scrolls, `fitFold` turns on and `home-widgets` gets `data-fold`. It resets with the packing (a changed fit key: viewport, view, direction, widgets...) and off the fit-eligible widths / in edit mode. The shared `fitStep` / `FitLevel` (also used by the area screen) are unchanged. |
| `frontend/tests/evidence-home-screen.spec.ts` | The "three directions ... without a vertical scroll" test also measures direction b at 1366x768 (the fold step). |

Tokens only: `scripts/design_ratchet.py` unchanged counts (px-literal 25513, color-literal 1984, scroll-container 13 - baseline).
Resting look: unchanged wherever the page did not scroll (fit 0 / 1, every other direction, phone, portrait tablet). At 1440x900 in
direction b the alarm and quick-action cards are now their content's height and the gaps 8 px (the column ends at 810, 52 px of air);
on a short screen (1280x800, 1366x768, 1024x768) the column's headings fold and the clock is smaller. No pixel baseline covers direction
b (none of the visual specs sets `home.direction` b), so no baseline was refreshed.

## After (runner, the spec's own configuration: cards info style, every default widget, `?design=a`)

| Direction / view | 1440x900 | 1280x800 | 1366x768 | 1024x768 | 1920x1080 |
|---|---|---|---|---|---|
| b cards | fits (fit 2) | fits (fit 2 + fold) | fits (fit 2 + fold) | fits (fit 2 + fold) | fits |
| b tiles | fits (fit 2) | fits | fits | 1089/768 (floors tiles column, see Q2) | fits |
| a cards / tiles | fits / fits | 884 / 1012 of 800 | 884 / 1012 of 768 | 926 / 1107 of 768 | fits |
| c cards / tiles | fits / fits | fits / 820 of 800 | fits / 820 of 768 | 775 / 955 of 768 | fits |

With the product default info style (`home.info_style` = auto: the cards in the cards view, the header bar in tiles), before this
change: b cards overflowed at every size below 1920x1080 (fixed here); a / c fit at 1440x900 and 1280x800; at 1366x768 a tiles and c
tiles overflow by 28 px, and at 1024x768 every direction overflows 7-75 px (the floors tiles grid and the hero band) - unchanged by
this row, see Q2.

## Tests run (real results)

| What | Where / command | Result |
|---|---|---|
| `scripts/design_ratchet.py` | PC | RESULT: no count above the baseline (all metrics equal to the baseline) |
| Diagnostic copy of the spec (measures every direction / view / size; not committed) | runner, `scripts/fixture_job.py` devices group, before at 9b659b361 and after at aa08b15e3 | before: b 918/900 at 1440x900 (both views), after: the table above |
| `evidence-home-screen.spec.ts`, base (train head 9b659b361) | runner, `~/smplwisebms/.venv/bin/python scripts/fixture_job.py evidence-home-screen --no-build --project=desktop` (devices fixture backend) | rc 1: 15 passed, 2 failed (the two "three directions ... without a vertical scroll" tests, b 918/900), 5 skipped - the defect reproduced |
| `evidence-home-screen.spec.ts`, branch run 1 (78376af8f, desktop + mobile = the JSON's projects) | runner, same command without `--project` | rc 1: 22 passed, 1 failed, 21 skipped (the other project's tests). Both scroll tests passed (b also at 1366x768). The failure: "edit mode ... the order by drag" - the quick card dragged onto the clock did not reorder within 5 s (`expect.poll` line 593); edit mode packs nothing (fit 0, no fold), and the same test passed in run 2 and on the base: a flaky drag, not this change |
| `evidence-home-screen.spec.ts`, branch run 2 (78376af8f, desktop) | runner, `... --project=desktop` | **rc 0: 17 passed, 0 failed, 5 skipped** (the mobile tests skip on desktop). With run 1's mobile part (6 passed) every one of the 23 tests passed at 78376af8f, not yet in one single run (see NOT_RUN) |
| eslint on the three changed files | runner, `npx eslint src/screens/devices-building.ts src/screens/home-widgets-css.ts tests/evidence-home-screen.spec.ts` | rc 0, 0 errors (1 warning: the spec file is on the eslint ignore list) |
| tests typecheck | runner, `npx tsc --noEmit -p tsconfig.tests.json` | rc 0 |
| Before / after screenshots (b, cards + tiles, 1440x900 + 1280x800, light + dark) | runner, same diagnostic copy with `DIAG_SHOTS`, product default info style | before: 8 shots taken (b cards 918/900 and 918/800); after: queued (below); compare page `private/planning/home-scroll-fix-2530_compare_2026-11-25.html` (local, not in the repo) |

NOT_RUN: tsc / vite build on the PC (PC rule; on the runner the fixture job's `npm run build` is `tsc --noEmit && vite build`, so the
source type-checked there); one single full run with 23/23 and the after-screenshots - queued on the runner
(`~/work/p2520_homescroll_final.sh`, output `~/work/p2520_homescroll_final.out`, shots `~/work/p2520_homescroll_after/`), waiting for slot
B while the 2.52.0 release gate holds the runner's memory; the release gate; the fixture lane itself (`fixture_lane.sh` is on the unmerged
`pilot/GATE-FIXTURE-LANE-2530`); other skins than the spec's `?design=a`.

## Open questions (recommendation first)

1. `evidence-home-screen.spec.ts` in the gate: (a) after this row and GATE-FIXTURE-LANE-2530 merge, flip it to `"gate": true` in the
   lane's `fixture_specs.json` [recommended]; (b) keep it job-only.
2. Short screens outside direction b (1366x768 tiles in a / c by 28 px; a landscape tablet 1024x768 in every direction by 7-75 px; and
   with the cards info style a at 1280x800 too): (a) a follow-up row that gives the floors tiles grid and the hero band one more fit
   step the same way (measured per region, tokens only) [recommended]; (b) accept a scroll below 1440x900.
3. The fold step folds the headings of b's column on a short screen: (a) keep (the row of c already shows the cards without
   headings) [recommended]; (b) make it a setting (`home.screen.fold_headings`, default on).

## Rollback

Revert the branch's commits. No data, setting or API change.
