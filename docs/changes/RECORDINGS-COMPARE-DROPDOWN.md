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

## Other screens with the same chip-row pattern (reported, not changed)

- `screens/investigate-sync.ts` (ניגון מסונכרן, "מצלמות להשוואה"): the same up-to-4 + same-recorder chip row; its evidence specs click
  `[data-sync-camera]` chips and the picks drive the snapshot cards, so it is not a drop-in swap. Candidate for the same dropdown
  (`max="4"`, no base).
- `screens/live-views.ts` (the saved live views editor): a chip per camera, no limit.
- `screens/investigate-rules.ts` ("מצלמות ספציפיות" of a rule, plus floors / zones / days / types): chip rows inside a form, no limit.
- `screens/system-access.ts` (delegable roles): a chip row, not cameras.
- The events, exports and live wall screens have no multi-camera chip row.
