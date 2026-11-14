# HOME-R32-ANSWERS-2438 - home interface: the owner's round-32 answers (Q-HOME-1 .. Q-HOME-7)

Branch `pilot/HOME-R32-ANSWERS-2438` from `origin/pilot/HOME-V3-AUDITFIX-2437` (ecee791a1), not from `origin/main`: the home files
(`frontend/src/home/*`, `sw-camera-tile.ts`) are held by that unmerged branch, which already carries the round-30 audit fixes these
answers refer to. `pilot/AUDIT30-COMBINED-2435` holds none of the files touched here (MASTER_PLAN Appendix A). Merge order: AUDITFIX first,
then this branch.

Owner answers: `private/planning/OWNER_ANSWERS_ROUND32_2026-11-14_HE.md`; question text: `private/design-system-2026-10-27/round32/
all-questions/index.html` (`#qdata`). Where the owner asked for a setting, the chosen answer is the default.

## What changed, per answer

| Q | Answer | Done here |
|---|---|---|
| Q-HOME-1 | a: portrait tablet = phone layout, bottom bar, four tiles per row | AUDITFIX moved the 701-899 px portrait band to the phone layout (bottom bar, 56 px targets, hub 4 x 3). This branch adds the four-per-row favourites grid: `sw-home.ts` `tab4` (`HOME_TABLET_PORTRAIT_MQ`, same query as the CSS band) packs 4 x 5, a wide tile (climate, shade, camera, dimmable light) is half a row, a tile being edited the whole row; `.wgrid` 4 columns in the band (`home-styles-extra.ts`). Phones keep 3 per row |
| Q-HOME-2 | a: seven days from today + a "השבוע" / "הימים הקרובים" switch, remembered | `home-calendar.ts`: the switch sits with the calendar's tabs (head on wide screens, the tabs row on a phone, sharing it with "היומן שלנו / חדרים משותפים" without wrapping). "השבוע" = Sunday to Saturday (`home-p2-ui.ts` `thisWeekDays`, counted from local noon so a DST night never repeats a day); days already gone are quieter (`data-past`). The choice is the person's layout key `cal_week` (`next` default / `week`), so it follows them to every device. The occurrences request now spans from the week's first day to a week from today, so both strips and the switch need no second request. The new-event sheet's day row stays "from today" (no events in the past) |
| Q-HOME-3 | a: "תמונה", grey dot, "מתעדכנת כל 30 שנ׳" with the real interval | AUDITFIX gave the word and the dot, with the interval only in a hover title and always "30". Now: the interval is the real one - the cameras screen's stills `HOME_STILL_SECS` (30, the same constant feeds the tile's `stillRefresh`), a favourite tile that fell back to its player's snapshot `STILL_REFRESH_MS` (10 s, now exported by `sw-live-player.ts`). The line "מתעדכנת כל N שנ׳" is shown beside the word where the tile is at least 340 px wide (container query; the wall panel and desktop cameras screen); on a phone tile it stays in the title (no room beside the camera name) |
| Q-HOME-4 | b: the line under "הבית שלי" stays the person's name | verified, no change: `sw-home.ts` strip title shows `userFull || userName` (spec asserts "נועה לביא") |
| Q-HOME-5 | a: phone recordings header = day picker only | verified, no change: AUDITFIX hides only the camera stepper on the phone (`.hs-head .cf-nav:not(.pb-days)`), the day stepper has its own row (its spec covers it) |
| Q-HOME-6 | a: short fade, rise only from "עוד", setting for b | `sw-home.ts` render: a screen change gets `.enter.fade` (160 ms, opacity only, no stagger - `home-styles-extra.ts`); a screen opened from "עוד" (the hub's children) gets `.enter.rise` (the mockup's 280 ms rise with its stagger). New setting "הגדרות › תצוגה › מעבר בין מסכים": "מהיר" (default) / "עם תנועה" (= option b, the rise on every change), the layout key `motion`. The entry class now stays until the next screen and the screen is keyed by its address, so a data reload during the entry no longer cuts it and another room / tab plays it once. `prefers-reduced-motion`: the existing rule turns either one into the same short fade |
| Q-HOME-7 | a: first five defects now, the rest a round later | The first five are the P1 items of `round30/home-audit/FIXES.md` (1 phone recordings day choice, 2 portrait tablet, 3 phone alarm icon, 4 wall chip spill, 5 still camera word). All five are fixed by the base branch AUDITFIX; this branch completes 2 (Q-HOME-1) and 5 (Q-HOME-3) per the owner's answers. See "The rest" below |

## The rest of the audit (Q-HOME-7: a later round)

The base branch `pilot/HOME-V3-AUDITFIX-2437` was built before the owner's answer and already contains most of the P2 / P3 items
(6, 7, 9-20, 22-29, the motion notes M2, M3). This branch does not revert them; whether the release train carries AUDITFIX whole or
holds its P2 / P3 part for the next round is a lead decision. Still open after this branch:

| # | Item | Why open |
|---|---|---|
| 8 | Room screen: small tiles split around wide ones, an orphan row | needs an owner decision: the grid is the person's own favourites order; re-ordering by tile type would override it |
| 21 | Line under "הבית שלי" = home name | closed by the owner (Q-HOME-4 b: stays the person's name) |
| - | Card / list grids at four columns on the portrait tablet (FIXES item 2 sketch) | lists keep the phone's one-column pages; the owner's "four tiles per row" is applied to the tile grids (favourites, hub) |
| - | Physical-device checks (phone, portrait tablet, wall panel), the five other colour themes, keyboard order, contrast measurement | not run (AUDITFIX "not verified" list) |

## Backend

`services/home_interface.py` `clean_layout`: two personal layout keys, validated like `start` / `scheme` - `motion` (`fade` | `rise`) and
`cal_week` (`next` | `week`); anything else is a 422 in Hebrew. No migration (the layout is a JSON column), no API shape change for old
clients (unknown keys were and are dropped; absent keys = the defaults). Test: `tests/test_home_interface.py::
test_motion_and_calendar_week_are_kept_per_person`.

## Tests

New spec: `frontend/tests/home-r32-answers-2438.spec.ts` (desktop project, sizes per test, mocked backend; the prefs mock keeps what was
PUT so a reload sees it): motion fade / rise / setting / reduced motion, the week switch at 375 and 1280 (Sunday start, `data-past`,
remembered after reload, nothing cut, no scroll), the portrait tablet at 768 and 820 (4 columns, spans 1 / 2, hub 4), a phone keeps 3,
the still camera word, grey dot and real interval at 1280 and the title-only line at 375, the line under "הבית שלי".

Pixel baselines refreshed on the runner (`run_smart.py preview ... -u --workers=1 --machine runner` over the three home pixel specs,
`pixel-home-auditfix-2437`, `pixel-home-fb-2431`, `pixel-home-gaps-2436`): 4 images changed, all in `pixel-home-auditfix-2437`:
`auditfix-cameras-{light,dark}-390-mobile` (the phone's one-column camera tiles now show "מתעדכנת כל 30 שנ׳") and
`auditfix-room-{light,dark}-768-desktop` (the portrait tablet's favourites four per row). The other 20 shots were unchanged.

| Run | Where | Commit | Result |
|---|---|---|---|
| `npx tsc --noEmit` | workstation | 1854837af tree | exit 0 |
| `pytest tests/test_home_interface.py` (whole file) | workstation (`.venv`, `-p no:xdist`) | 1854837af | 26 passed |
| `preview`: home-r32-answers-2438, home-v3-auditfix-2437, home-v3-p2, home-v3-p1 (all projects, workers 1) | runner | 1854837af | 59 passed, 3 failed (all in the new spec: the calendar checks used the gaps mocks, which have no calendar routes; the phone camera check expected the line hidden, but the phone's tiles are one column, 343 px, so it shows), 127 skipped (per-project skips) |
| `preview`: home-r32-answers-2438 after the spec fix | runner | b5340ca4e | 11 passed, 22 skipped (desktop-only spec) |
| pixel `-u --workers=1`: the three home pixel specs | runner | b5340ca4e | 24 passed, 18 skipped; 4 baselines rewritten (above) |

NOT_RUN: the full suites and the pixel re-run without `-u` (the entry check runs them); a physical phone / portrait tablet / wall panel;
the five other colour themes on the new rules; frame-by-frame review of the fade.

## Rollback

Revert the branch's commits. Stored layout keys `motion` / `cal_week` are harmless without the code (the old frontend ignores them).
