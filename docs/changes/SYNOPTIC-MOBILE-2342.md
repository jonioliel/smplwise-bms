# SYNOPTIC-MOBILE-2342 - the phone synoptic map in three layouts; the overlap fixed at its root; the head chip against the rows

Branch `pilot/SYNOPTIC-MOBILE-2342`, cut from `origin/release/2340-train` @ `15e0542d7` (2.34.0 rebuilt UI). No version bump, not
merged. Static demo and fakes only: no Home Assistant, NVR or device was contacted. No migration (one new `ui.xs` key with a default).

## 1. The request (owner round 13, 02.11, answer 1A + note)

The owner's phone screenshot of 2.33.0 (width 390) showed six defects on the synoptic map; the mock-up
`private/design-system-2026-10-27/round12/synoptic-mobile/index.html` drew three fixes: A a compact table (recommended), B one card per
floor, C the cross-section first. The owner chose A and asked for all three to be available, chosen by a setting:
"תצוגת המפה הסינופטית בטלפון": טבלה קומפקטית (default) / כרטיסי קומה / חתך בניין. The recommended sub-answers apply: 2B a small lights bar
on the phone (the full strip stays on tablet and desktop), 3B the board's summary behind an info button, 4C only the page title with
"<building> · N קומות" under it.

## 2. Root cause of the overlap (defects 1 and 5)

`devices-synoptic.ts`, phone media block: `grid-template-columns: minmax(80px, 1.3fr) repeat(var(--pcols, 3), minmax(0, auto))`. A
`minmax(0, auto)` column may shrink to zero, but its content did not: the lights cell holds an 8-segment strip (7 px a segment, ~70 px)
and the "2/10" number, both `flex: none`. At 390 px the lighting spilled into the cameras cell. In a right-to-left row the spill runs
toward the inline end, so the cameras cell painted over the LEFT part of the left-to-right "2/10" - the lit digit.

Fix: on the phone every number column has a FIXED width (`xs-model.ts PHONE_COL_PX`: lighting 56, temperature 38, presence 34, cameras 42,
doors 34, alerts 32, fire 36 px; `phoneGridTemplate`), the floor name is the only `minmax(0, 1fr)` column and ellipsises, every cell
clips (`overflow: hidden`), and the strip is replaced by a 34 x 4 px bar under "2/10" (`litPercent`). The narrow WIDE board, which only
the wall screen can still draw under 768 px, gets fixed 64 px columns and no strip as well.

## 3. The head chip "11/17 דולקות" against rows that seemed to add up to 4/17 (defect 6)

Investigated in code (no owner data was read):

- The chip is `totalsOf(sigs)` and every row prints `f.lit / f.lights` of the SAME `sigs` array in the same render: they cannot disagree.
- Lights on no floor are NOT in the chip: `signalOf` sums only the areas `matchFloors` gave the floor; the "no floor" bucket and the
  devices without an area (`tree.unassigned`) reach no row and no total.
- No double count: `treeAreas` keeps each area once (first platform floor that lists it) and `matchFloors` gives each area one owner.
- The owner's denominators add up exactly (1 + 10 + 6 = 17), which also rules out lights from outside the floors (they would raise the
  17 too). Only the numerators differ (4 against 11), and the numerator is precisely the part of "x/10" the cameras cell covered (section
  2). The most likely reading: the rows were 11 lit in truth, the overlap hid their first digit. Not confirmed on the owner's system
  (read-only access was not part of this task); the phone board of this change shows the numbers unobstructed, so a fresh screenshot after it ships settles it.

Made explicit anyway: `unassignedLights(tree, sigs, ctx, opts)` counts the lights on no floor (the no-floor bucket areas that no map
placement, per-area row or floor match moves, plus `tree.unassigned`; the "all switches" option included). They are shown once, as the
row "ללא קומה: x/y דולקות, לא נספרות בקומות ובסיכום" of the phone info sheet and as the head chip's title on every width - never added to
the chip. Unit test: `unit-synoptic-mobile-2342` ("the head chip is the sum of the rows", "lights on no floor are counted apart").

## 4. The phone board (under 768 px; tablet and desktop unchanged)

`devices-synoptic.ts renderPhone`, styles in `devices-synoptic-phone-css.ts`. Common to the three layouts: the head chips with the clock
and an info button (44 px); no title inside the board; the page subheading "<building> · N קומות"; a press on a floor's lighting opens
the floor lights popup (2.33.1, `data-syn-lights`); a ground line between the floors above and below ground; above 6 floors the rows
drop to the 44 px touch minimum; only the list scrolls (`overscroll-behavior: contain`), the page does not; hover only under a pointer
that hovers; presses read the skin's `--sw-press-scale`; no tap flash, no long-press selection, `touch-action: manipulation`.

| Layout | Floor row | Press on the floor | Many floors |
|---|---|---|---|
| A table (default) | name + sub-line, then the fixed number columns; header icons only (title = the column name) | the name opens the floor | 44 px rows, smaller type |
| B cards | a card: name + sub-line + chevron, three metric tiles (word over number; lighting with the bar) | the card head opens the floor | above 6 floors one row per floor (same fixed columns) |
| C section | roof, slabs warm by the share of lights on, level number, soil hatch below ground; name + sub-line + pills | selects (slab ring); the bottom strip shows it with "פתח קומה" | name and pills on one line; the sub-line moves to the strip |

Columns (`phoneBoardColumns`): the columns WITH a source first - at most three, by rank lighting, temperature, alerts, doors, presence,
cameras, drawn in the board order (the owner's building: lighting, cameras, open doors); then, only with "הסתרת עמודות בלי נתונים" off
and from 360 px, the chosen columns with no source, dashed "-", five columns at most. The old rule (`phoneColumns`, kept for the
cross-section) took the first three by rank even without a source and dropped cameras and doors that had data. Fire follows its option.

The info sheet (sub-answer 3B, `sw-sheet`): "כל הבניין כלוח מצב", floors, the columns shown, the columns drawn on wide screens only,
the columns hidden for want of data, the lights on no floor, the unlinked-floors hint (with the link where the phone allows the
structure tools), and "הגדרות המפה" (the settings card, `?focus=xs`).

## 5. The option

`ui.xs.syn_phone_view`: `table` (default) | `cards` | `section`. Backend `services/xs_options.py` (enum, unknown values 422, a value
stored before the key existed reads as `table`); frontend `xs-model.ts` (`XS_SYN_PHONE_VIEW`, `normalizeXs`, demo override
`?xs_syn_phone_view=`). Settings › כללי › חתך הבניין והמפה הסינופטית, group "מפה סינופטית": "תצוגת המפה הסינופטית בטלפון" with its hint
("במסך צר מ-768 פיקסלים..."). Enum rows of that card now show their hint (the existing "מפסקים בעמודת התאורה" hint appears too).

## 6. Tests

- `smplwise_vms/backend/tests/test_xs_options.py`: defaults / changed sets carry the key, four refused values, the round trip of the
  three layouts and a refused value that changes nothing.
- `frontend/tests/unit-synoptic-mobile-2342.spec.ts` (Node): option and normalisation, phone columns (hide-empty on / off, 320 / 360 /
  390, a temperature source, fire), fixed widths and no `minmax(0, auto)` grid, the bar, chip = rows, lights on no floor, words,
  the settings row, hover gating / touch rules of the board and its phone sheet.
- `frontend/tests/evidence-synoptic-mobile-2342.spec.ts` (runner, mobile project): 3 layouts x 320 / 390 / 430 x light / dark x 3 / 12
  floors - no cell spills into its neighbour or clips its content, no sideways page scroll, only the list scrolls, one title; the
  lights popup, the info sheet, the floor name, the section's select-then-open, dashed columns at 390 but not 320, 768 keeps the wide
  board. Screenshots in `docs/evidence/SYNOPTIC-MOBILE-2342/`.
- Mobile branches updated: `evidence-syn-columns-2321` (the note and the hidden list in the info sheet; the phone column order with
  hide-empty off), `evidence-synoptic-ha-2310` (the unlinked hint in the info sheet), `evidence-xsection-synoptic` (the phone row opens
  the floor from its name; under 768 px only the phone list may scroll).

Runs: backend `test_xs_options.py` 11 passed; unit set (the new spec, unit-syn-columns-2321, unit-xs-floor-match,
unit-switch-light-dimmer-2331 and the lints unit-polish-phone-297, unit-polish-classic-domus-297, unit-token-lint,
unit-designtokens-297, unit-menu-lint) 82 passed; tsc clean. Runner (preview, `7508e4f3a`, desktop / tablet / mobile): the new evidence
spec plus evidence-syn-columns-2321, evidence-xsection-synoptic, evidence-synoptic-ha-2310, evidence-switch-light-dimmer-2331 - 185
passed, 181 skipped (project gates), 0 failed. Run 1 found two real faults (fixed in `a7ab20288`, `7508e4f3a`): the section's lights
pill touch target widened the pill, and at 320 px with 12 floors the pills left the row. The screenshots stay on the runner worktree.

## 7. Not done / for the owner

- Not checked on a real phone (tap feel, safe areas, the sheet's swipe): the mobile-native rules are applied in code only.
- The "11/17" reading in section 3 is an explanation from the code, not a check on the owner's installation.
- Settings "תאורה בטלפון: פס קטן / פס מקטעים / מספר בלבד" and "שורת סיכום: שורה / כפתור מידע / כבויה" from the mock-up's notes were not
  asked for and are not built (the recommended answers 2B and 3B are fixed behaviour).
