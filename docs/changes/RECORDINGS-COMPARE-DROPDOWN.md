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

## Owner feedback 2026-10-05 (third step, `pilot/compare-polish`): search from 4, buttons or dropdown, the synchronized-playback card

Three points of feedback on the two pickers, after the second step.

### 1. The search field from 4 cameras, as a setting (`ui.dd_search`)

- A MULTI-SELECT list (the two camera pickers) carries its search field from **4** options (was 8). The threshold is a setting with the
  phone choice's shape: one global value, the installation's default (`ui.dd_search`, PATCH /settings, system.configure) and the user's
  own (/me/prefs, null = follow the installation). Values `always` | `4` (default) | `8` | `never`; backend validation in
  services/dd_style.py (`SEARCH_MODES`, `normalize_search`, `stored_search`), the same closed list in `components/dd-style.ts`
  (`DD_SEARCH_IDS`, `ddSearchMin`). The effective value is carried to the dropdown as `data-dd-search` on `<html>` (next to
  `data-dd-phone`); `sw-dropdown` reads it when a `multiple` list opens. Single-choice lists keep the fixed 8+ rule of 0.1.157 (the
  settings tabs' long lists): the dial is the camera pickers', not every dropdown's.
- Settings: a new card "בחירת מצלמות להשוואה" in הגדרות › כללי › לשוניות (`system-tabs-mode.ts`, `data-dd-picker-card`), after the
  phone card, with both dials of this step: "תצוגה" and "חיפוש ברשימה", installation default + personal choice, one key per change,
  "מה פעיל אצלי עכשיו".

### 2. Dropdown or buttons, on every width (`ui.dd_picker`)

- How the comparison picker is drawn: `dropdown` (default; the phone keeps its bottom sheet by `ui.dd_phone`) or `chips` (a button per
  camera, the 2.0.0 look). Same shape as the search dial (installation `ui.dd_picker` + personal; services/dd_style.py `PICKERS`,
  `normalize_picker`, `stored_picker`; `DD_PICKER_IDS` in dd-style.ts; `TabsModeController.ddPicker`). The choice applies on EVERY width -
  an installation that prefers buttons gets them on the phone too (that was the owner's ask: the look is a choice, not a width rule).
- `investigate-playback.ts` (`renderCompareChips`, `[data-compare][data-picker]`, `sw-chip[data-compare-chip]`): "השוואה (עד 4):" + a chip per
  other camera. `investigate-sync.ts` (`renderChips`, `sw-chip[data-sync-camera]`, the status dot as in 2.0.0). Both share the dropdown's
  state exactly: `toggleCapped` with the same limit (3 extras / 4 cameras), `applyExtra` / `applyPicked`, the route's `extra=` parameter,
  the recent sets. One deliberate difference from 2.0.0: at the limit the remaining chips are DISABLED with the tooltip "אפשר לבחור עד 4"
  (the 2.0.0 chips silently swapped the oldest pick out; the dropdown refuses the pick the same way). `sw-chip` gains a `disabled` property
  (the native button is disabled; 2.0.0 set a boolean attribute that did nothing).
- Max 4, URL / state behaviour unchanged (compare-dropdown.spec and sync-dropdown.spec drive both looks against the same mocked backend).

### 3. The synchronized-playback card

- The explanatory sentence under "זמן התחלה" is gone (an operator screen keeps no paragraphs). Its content lives where the comparison runs:
  the recordings screen's diagnostics line (`data-sync-method`, shown in group mode when `playback.diagnostics` allows it) now also says
  "מהירויות שונות מ־1× כבויות; מקור בלי הקלטה בזמן הזה מוצג כ"אין הקלטה", לא כמסונכרן"; the launch button's tooltip carries the short form
  (or "נדרשות לפחות 2 מצלמות" while it is disabled); the time field's tooltip says "זמן מקומי של הדפדפן; ההקלטה נפתחת מהפריים הקרוב ביותר"
  (was the card's subheading).
- The card itself (`renderSlots`, `[data-sync-slots]`): the four places of a set are ALWAYS drawn - a picked camera fills its place
  (snapshot, name under it, the number of its place on the picture, a remove button `.rm` of the touch dial with a 28 px circle inside),
  an empty place is a numbered dashed frame; place 1 carries "מובילה" (the live badge on a picked camera, a word on the empty frame), so
  "up to 4" and "the first leads" are visible without a sentence: the page subheading is now "2–4 מצלמות, זמן אחד", the card has no
  subheading. Four places per row on a wide screen, two on the phone. The lead badge on the picture is a dark translucent pill with white
  text in every skin (the badge's on-image look keys on the text token, which is light in dark skins - unreadable there).
- A camera of another recorder, listed disabled in the dropdown, says why: `DropdownItem.note` ("מקליט אחר"), drawn after the name in the
  muted small type (`[data-dd-note]`) and as the option's `title`; the same reason is the tooltip of a disabled chip in the buttons look.
  An offline picked camera shows the "לא מקוון" badge under its picture.
- Tests: `sync-dropdown.spec.ts` (the places, the remove button, no `.note`, no card subheading; the search dial; the chips look),
  `compare-dropdown.spec.ts` (the note; the search dial at 1 / 3 / 4 / 8 options x always / 4 / 8 / never; the chips look),
  `dropdown-picker-choice.spec.ts` (the Settings card: both levels, every option, `data-dd-search` on `<html>`, a reload, a non-admin, a
  refused save, the phone width), `unit-dd-choices.spec.ts` (the closed lists, `ddSearchMin`), `layout-sync-dropdown.spec.ts` (the places
  are measured too; a second sweep in the chips look, empty and at the limit), backend `tests/test_dd_style.py` (the two keys at both
  levels, 403 for a viewer, every bad value refused).
- Evidence: `docs/evidence/sync-polish/before` and `after` (four skins x light / dark x 390 / 1440, the dropdown closed with four picks;
  `after` also holds the chips look empty / full and two open lists). The `before` set is the second step (dcc1da28) as built.

## Other screens with the same chip-row pattern (reported, not changed; the owner said no for the two editors)

- `screens/live-views.ts` (the saved live views editor): a chip per camera, no limit.
- `screens/investigate-rules.ts` ("מצלמות ספציפיות" of a rule, plus floors / zones / days / types): chip rows inside a form, no limit.
- `screens/system-access.ts` (delegable roles): a chip row, not cameras.
- The events, exports and live wall screens have no multi-camera chip row.
