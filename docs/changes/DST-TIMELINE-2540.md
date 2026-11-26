# DST-TIMELINE-2540 - rooms timeline and resident time bar on a wall-clock axis (target 2.54)

Branch `pilot/DST-TIMELINE-2540`, from `origin/pilot/TIME-CORRECT-2540` (6ff195ab0) with `origin/pilot/STALE-ANSWERS-2540` (14116a86a)
merged first (`0d603c935`). The merge had no conflicts: both rows touch `calendars/resident.ts` and `home/home-p2-api.ts`, in different
places (TIME-CORRECT: the "my bookings" error state, `bookingLook`; STALE-ANSWERS: the day read's `Latest` token, the ticket note id), and
git merged them automatically. Source: `docs/changes/TIME-CORRECT-2540.md` open question 1 (owner rule: unanswered = recommendation a,
"a small follow-up after STALE-ANSWERS-2540 merges").

## The fault

On the two DST-change days of Asia/Jerusalem (Friday 27.03.2026 02:00 -> 03:00, a 23-hour day; Sunday 25.10.2026 02:00 -> 01:00, a
25-hour day; in 2027 26.03 and 31.10) the rooms timeline ("חדרים לפי שעות") and the resident's time bar drew an entry at
*midnight + elapsed minutes* (`model.span`) and turned a tap into *midnight + elapsed minutes*, while the hour labels, the open hours and
the now line are clock hours. After the change hour every entry sat one hour off its label (spring: one hour early, autumn: one hour
late) and a tap opened a booking an hour off the hour under the finger. The stored time was right (TIME-CORRECT fixed the instants);
only the drawing and the tap were wrong.

## What changed

`frontend/src/calendars/model.ts` (pure, unit-tested):
- `span()` places an entry by its clock time: `wallMinute(t, day)` (minutes since the day's midnight by the clock; earlier day < 0,
  later day >= 1440) and `wallRange(o, day)` (an entry through the repeated hour that "ends before it starts" by the clock keeps its real
  length from its start).
- `hourKind(day, h)` = `plain | missing | repeated`, read from the zone itself (any zone / year); `axisHours(day, from, to)`;
  `missingBands(day, from, to)`.
- `wallInstant(day, min)`: like `atMinute`, but a minute the clock skips gives the change itself (02:30 on the spring day -> 03:00, not
  03:30). `roomsTapStart` (half hour under the finger) and `barStart` (the resident bar: the duration centred on the finger, quarter hour,
  inside the window) build the tap's time by the clock. `minuteExists(day, min)`.
- `slotGrid` (the resident's start grid) skips starts inside the missing hour (it offered "03:30" twice).

`frontend/src/calendars/booking-logic.ts`: `trackLanes(entries, range?)` takes the axis range; the rooms timeline passes the clock range,
so two entries of the repeated autumn hour (same clock place, an hour apart) get two lanes instead of covering each other (other callers:
unchanged, by time). `firstFree` skips starts inside the missing hour (a 02:00 start was built as 03:00-03:00).

`frontend/src/calendars/view-rooms.ts`: the axis comes from `axisHours` - the skipped spring hour has no label and its slot is hatched like
a closed hour (`.closed`, `data-cal-gap`), the repeated autumn hour keeps its one place and reads "01:00 ×2" (phone "01 ×2") with the title
"השעה 01:00 עוברת פעמיים ביום הזה (השעון זז שעה אחורה)"; lanes by the clock range; the tap by `roomsTapStart`.

`frontend/src/calendars/resident.ts`: the time bar's axis from `axisHours` (no "02", "01 ×2"), the skipped hour hatched (`.bar .gap`), one
short line under the axis on a DST window ("השעה 02:00 לא קיימת ביום הזה (השעון זז שעה קדימה)" / "...עוברת פעמיים..."), the tap by
`barStart`, the arrow keys start from the window's first hour by the clock (`atMinute`).

`frontend/src/i18n/lang/en/i18n/msg/calendars.ts`: the English of the two new texts.

No setting: a correctness fix (as TIME-CORRECT). An ordinary day is unchanged (clock time = elapsed time there). No new colour or size
(the hatch reuses `.closed`). No backend change, no API change. Files of other 2.54 rows not touched.

## Tests

PC (Windows, TZ pinned to Asia/Jerusalem by the unit config):

| Check | Code | Exit | Result |
|---|---|---|---|
| `npx playwright test -c playwright.unit.config.ts tests/unit-dst-timeline-2540.spec.ts` | branch | 0 | 8 passed |
| the same with `model.ts`, `booking-logic.ts`, `view-rooms.ts`, `resident.ts` put back to the base (0d603c935), then restored | base | 1 | 7 failed, 1 passed (the zone premise) |

Runner (Linux, TZ Asia/Jerusalem): `~/work/p2520_dsttimeline_run.sh` (head `9d3ccfdf4`, log `~/work/p2520_dsttimeline_run.out`) and
`~/work/p2520_dsttimeline_ev2.sh` (head `a53b72ee6`: the resident evidence cases read the hour labels by their text, so the spec also runs
on the base). "Before" = the base `0d603c935` with the branch's new test files copied in.

**Before (fails at the base, as it should):**
| Check | Exit | Result |
|---|---|---|
| unit `unit-dst-timeline-2540.spec.ts` | 1 | 7 failed, 1 passed (the zone premise) |
| evidence `evidence-dst-timeline-2540.spec.ts` (desktop + mobile), run 2 | 1 | 8 failed, 1 passed (the ordinary day - unchanged, as it should), 9 skipped (project filters). Desktop: the 10:00 entry 63 px off the 10:00 label on all four DST days |

**After (the branch):**
| Check | Exit | Result |
|---|---|---|
| `npm run build` (tsc + vite) | 0 | |
| `npm run typecheck` (tests + scripts) | 0 | 0 TS errors |
| eslint `src/calendars` + the new specs / mocks | 0 | 0 errors (4 warnings: the new test files match the lint ignore pattern) |
| `scripts/design_ratchet.py` | 0 | no count above the baseline |
| unit: new + time-correct + stale-answers + calendars (ui, grid-edit, conflict-hint, attendees, switch-reach) + round4-leftovers + i18n cal/elec completeness + lint + rtl-logical + format pins | 0 | 134 passed |
| unit i18n English ratchet | 0 | 6 passed |
| evidence new (desktop + mobile) | 0 | 9 passed, 9 skipped; run 2 with `--repeat-each=2`: 18 passed, 18 skipped |
| neighbours: evidence time-correct, stale-answers, calendars views / settings / grid-edit / nav (desktop + mobile) | 0 | 145 passed, 37 skipped |
| existing pixel baselines of the touched screens (`pixel-round4-leftovers-2390` - the rooms axis, `pixel-time-correct-2540`) | 0 | 31 passed, 7 skipped - no existing baseline changed |
| new `pixel-dst-timeline-2540.spec.ts` (mobile) | 0 | baselines generated (`--update-snapshots`, 8 passed), compared twice (16 passed); run 2 against the committed files: 8 passed |

New Linux baselines (`frontend/tests/pixel-dst-timeline-2540.spec.ts-snapshots/`, 8 files): the phone night window 00-06 of the spring and
the autumn day, the rooms timeline and the resident time bar, light and dark. Compare page (Hebrew, local, not in git):
`private/planning/dst-timeline-2540_compare_2026-11-26.html` (desktop rooms timeline on 25.10 + the four phone night views, before / after,
light + dark).

NOT_RUN: the full release gate; tablet project; the lab (no lab in this row); backend tests (no backend change).

## Open questions

None left open by this row. One choice made by the recommendation, for the record:
1. The skipped spring hour on the axis: a. no label + its slot hatched like a closed hour, not bookable (built) b. squeeze it out of the
   axis (the axis would no longer be the same 24 clock hours as the week / day grid).
