# Recordings: the camera comparison picker is a multi-select dropdown (2.0.1)

Owner request 2026-10-05, with a phone screenshot of the recordings screen: the row "השוואה (עד 4):" listed every camera as a chip, so
on a phone the picker alone took most of the screen. It is now one dropdown in which up to three cameras are picked next to the lead
(the comparison stays "עד 4", lead included), drawn in the dropdown style the installation (or the user) chose in הגדרות.

## What changed

- `frontend/src/components/sw-dropdown.ts` gains a `multiple` mode (the single mode is untouched): `values` (pick order), `max`
  (0 = no limit), `count-base` (a fixed member counted in "n מתוך N" but not in `values`: the lead camera). The list stays open while
  picking (a press, Enter or Space toggle), is `aria-multiselectable`, every option draws a check box and carries `aria-selected`; once
  the limit is reached the remaining options are `aria-disabled` and a press on one answers "אפשר לבחור עד N" in the foot's status line
  (role=status) instead of swapping the oldest pick out. The foot of the list holds the count, "נקה" and "סיום" (44 px each, 48 px in
  the sheet). The chip reads the picked names and "n מתוך N"; its box is the touch target (44 px on touch layouts, the desktop dial
  above). Tab cycles search field -> list -> foot buttons and never leaves the picker; Esc closes and returns the focus to the chip.
  `change` carries `{ id, ids }` (`id` '' after "נקה"). Items may be `disabled` (listed, not choosable: a camera of another recorder).
  Everything else is the shared dropdown: the six styles + `auto` + capsule, the four skins, light / dark, the search field at 8+
  options, the phone bottom sheet / centred box / inline list by `ui.dd_phone` and the Bubble popup dial, the radius / touch /
  performance dials.
- `frontend/src/components/multi-select.ts`: the pure logic (`toggleCapped`, `pickedCount`, `limitNotice`, `pickedSummary`,
  `extraFromParam`), unit-tested without a page.
- `frontend/src/screens/investigate-playback.ts`: the chip row is replaced by `<sw-dropdown multiple max="3" count-base="1">` in the
  `security` group's style (`TabsModeController`, so a style change re-renders it). The state semantics are the chips' exactly:
  `extra` holds the extra camera ids, the route's `extra=` parameter is read the same way (known ids, the lead dropped, at most three -
  now through `extraFromParam`), every toggle ends the running session / group and opens a new one at the same instant, `selectCamera`
  still drops the new lead from the extras. One deliberate difference: the 4th extra is refused (the chips silently dropped the oldest).
- `frontend/tests/playback-stall-mock.ts`: optional extra cameras (with a recorder) and settings on top of the defaults; groups of any
  size; the stall specs' two-camera shape is unchanged.

## Tests

- `tests/unit-multi-select.spec.ts` - the pure logic.
- `tests/compare-dropdown.spec.ts` (desktop / tablet / mobile) - picks, the refused 4th extra, "נקה", "סיום", keys, aria, the search
  field, Tab cycling, the `extra=` parameter, another recorder's camera disabled, `ui.dd_style` + the phone sheet.
- `tests/layout-compare-dropdown.spec.ts` (desktop project; `LAYOUT_FULL=1` for the ten widths) - the layout guard over the picker,
  closed and open at the limit, four skins x light / dark x `auto` + one style per skin; `SW_SHOTS=<dir>` saves the screenshots.

## Synchronized playback (ניגון מסונכרן): the same dropdown (owner approval 2026-10-05, second step)

- `frontend/src/screens/investigate-sync.ts`: the card "מצלמות להשוואה" held a chip per camera (up to 4, same recorder); it is now
  `<sw-dropdown multiple max="4">` (`data-sync-pick-cameras`) in the `security` group's style, with no base: the first pick IS the lead
  (the "מובילה" badge on the first snapshot card follows the pick order, as before). The state semantics are the chips' exactly: `picked`
  in pick order, the launch button at 2+ picks, the route it opens unchanged (`#/investigate/playback?camera=<first>&extra=<rest>&t=`),
  the recent sets in `localStorage` unchanged. Every id the dropdown reports passes the same filter the recordings screen gives its
  route parameter (`extraFromParam` with an empty lead, at most four) plus CR-024 (one recorder per set unless the experimental setting
  allows more); a camera of another recorder is listed `disabled` once the set has a lead, an offline camera carries the alert dot (the
  chips drew a red / green dot). The 5th pick is refused ("אפשר לבחור עד 4"); the chips silently ignored it. The chip is a 44 px target on
  touch layouts, the dropdown style / size / ring / panel dials and the phone bottom sheet come from הגדרות.
- Text moved out of the way (an operator screen keeps no paragraphs): the card's subheading no longer repeats the count (the chip reads
  "n מתוך 4") and says only "הראשונה שנבחרת היא המובילה"; the empty-state paragraph ("עדיין לא נבחרו מצלמות. אפשר גם להתחיל מהמפה…") is
  gone - the chip's placeholder "בחר מצלמות (עד 4)" says it. The note under the start-time card (speeds, p95, "אין הקלטה") is unchanged.
- `frontend/tests/layout-guard.ts`: the rounded-corner / clipping walk stops at a `position: fixed` ancestor (the open list is a fixed
  layer painted over the card; the bubble skin's card corner flagged the list's foot "4 מתוך 4" at 1440 px as "text in the rounded
  corner of sw-card"). `visRect()` already made the same cut; the layer itself is still checked. The rule only removes that false
  positive, it adds no finding.
- Tests: `tests/sync-dropdown.spec.ts` (desktop / tablet / mobile: picks up to four, the refused 5th, the cards and the lead badge, "נקה",
  the launch route, keys, aria, another recorder's camera off / on by the setting, `ui.dd_style` + the phone sheet),
  `tests/layout-sync-dropdown.spec.ts` (the layout guard over the picker, four skins x light / dark x `auto` + one style per skin,
  closed with four picks and open at the limit; `SW_SHOTS=<dir>`), `tests/unit-multi-select.spec.ts` (the no-lead / max-4 case).
  `evidence-multi-nvr.spec.ts` and `evidence-review-fixes.spec.ts` drive the dropdown instead of `[data-sync-camera]` chips.
- Evidence: `docs/evidence/sync-dropdown/before` (the chip row, classic + bubble, 390 / 1440) and `after` (closed / open, classic `auto`
  + bubble `capsule`, 390 / 1440).

## Other screens with the same chip-row pattern (reported, not changed; the owner said no for the two editors)

- `screens/live-views.ts` (the saved live views editor): a chip per camera, no limit.
- `screens/investigate-rules.ts` ("מצלמות ספציפיות" of a rule, plus floors / zones / days / types): chip rows inside a form, no limit.
- `screens/system-access.ts` (delegable roles): a chip row, not cameras.
- The events, exports and live wall screens have no multi-camera chip row.
