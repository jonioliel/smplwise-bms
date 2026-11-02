# SYNOPTIC-PHONE-SETTINGS-2360 - "תאורה בטלפון" and "שורת סיכום בטלפון" as settings of the phone synoptic map

Branch `pilot/SYNOPTIC-PHONE-SETTINGS-2360`, cut from `origin/release/2342-train` @ `b75d214da` (2.34.2). No version bump, not merged.
Static demo and fakes only: no Home Assistant, NVR or device was contacted. No migration (two new `ui.xs` keys with defaults).

## 1. The request (owner 02.11, round 14)

Two choices of the phone mock-up (`private/design-system-2026-10-27/round12/synoptic-mobile`, questions 2 and 3) were built in
SYNOPTIC-MOBILE-2342 as fixed behaviour (the recommended answers 2B and 3B). The owner asked for them as settings, next to
`ui.xs.syn_phone_view`, each defaulting to what 2.34.2 draws:

| Setting | Key | Values (first = default) |
|---|---|---|
| תאורה בטלפון | `ui.xs.syn_phone_light` | `bar` פס קטן, `segments` פס מקטעים, `number` מספר בלבד |
| שורת סיכום בטלפון | `ui.xs.syn_phone_summary` | `button` כפתור מידע, `line` שורה, `off` כבויה |

The card lists the default first (the convention of every row of `system-xs-options.ts`), so the order differs from the order of the request.

## 2. Storage and editing (same path as `syn_phone_view`)

- Backend `services/xs_options.py`: two enums, defaults, docstring. Unknown values -> 422; a value stored before the keys existed reads as
  the default. No other backend file knows the keys.
- Frontend `xsection/xs-model.ts`: `XS_SYN_PHONE_LIGHT`, `XS_SYN_PHONE_SUMMARY`, `XsOptions`, `XS_DEFAULT`, `normalizeXs`; the demo override works
  through the generic `?xs_syn_phone_light=` / `?xs_syn_phone_summary=` (`xsFromParams`).
- Settings › כללי › חתך הבניין והמפה הסינופטית, group "מפה סינופטית", directly under "תצוגת המפה הסינופטית בטלפון"
  (`screens/system-xs-options.ts`, strings in `i18n/xsection.ts`, Hebrew and English). Each row has a hint.

## 3. What each value does

`phoneLightGauge(mode, floor)` and `phoneSummaryParts(mode)` in `xs-model.ts` are the whole mapping (pure, unit-tested); `devices-synoptic.ts`
only draws their result. Under 768 px only; the tablet, the desktop board and the wall screen do not read the keys.

### תאורה בטלפון - the gauge under "2/10"

| Value | Table cell | Floor card tile | Cross-section |
|---|---|---|---|
| `bar` (default) | the 34 x 4 px bar, byte-for-byte the 2.34.2 markup (`data-syn-gauge="bar"` is the only addition) | same | - |
| `segments` | the wide board's strip in the bar's own 34 px: one segment per light, eight at most, 6 px tall. One light on is never zero segments, one light off is never a full strip | same, across the tile | - |
| `number` | no gauge, the number only | same | - |

The cross-section does not apply: its floors are slabs warmed by the share of lights on, which is the layout itself. The row's hint says so
("בחתך בניין צבע הקומה נשאר לפי האורות הדולקים, וההגדרה לא חלה"); the row stays visible for every layout. The column widths do not change
(`PHONE_COL_PX`), so no gauge can spill into a neighbour cell (the 2.33.0 defect): the strip is flex children of the bar's width, no fixed segment width.

### שורת סיכום בטלפון - the board's summary

| Value | Head | Where the summary is | Table / cards | Cross-section |
|---|---|---|---|---|
| `button` (default) | the 44 px info button | the info sheet (`renderInfo`), as in 2.34.2 | sheet | sheet; the strip's "פרטים" button (no floor selected) opens it |
| `line` | no button | one line under the board: "כל המבנה · N קומות", the hidden-columns note with its way to the setting, the lights on no floor, the unlinked-floor hint with its link | after the list (one more `auto` grid row; the list stays the only scrolling part) | the bottom strip already says "כל המבנה · N קומות" (and the lights), so the line carries only the notes, and appears only when there is one; the strip's "פרטים" button is not drawn |
| `off` | no button | nowhere (no sheet, no line, no "פרטים") | - | - |

The head chips ("x/y דולקות", temperature) are the board's totals, not the summary, and stay in all three. The links of the line keep a 44 px touch
target without growing the line (`::after` inset, as the section's pills). Reading `off` as "no way to the info sheet" is deliberate: it is what
"כבויה" says; the settings link is still in the line / sheet of the other two values, and the card is reachable from the settings screen.

## 4. Tests

- `smplwise_vms/backend/tests/test_xs_options.py`: defaults and the changed set carry both keys, six refused values, the round trip of all nine
  combinations through PATCH /settings, a refused value changes nothing, a stored value without the keys reads as the defaults.
- `frontend/tests/unit-synoptic-phone-settings-2360.spec.ts` (Node, 8 tests): defaults / normalisation / demo override; the gauge mapping incl. every
  edge of the segment count (1..30 lights x 0..n lit); the summary parts and where the gauge applies; the template wiring read from the source (the
  default bar markup unchanged, both former hand-drawn bars go through `lightGauge`, one `sum` drives button / sheet / line, the line closes all three
  layouts, the wide board does not read the keys); the CSS rows of the line and the strip's footprint; the settings card; the words; server <-> frontend parity.
- `frontend/tests/evidence-synoptic-phone-settings-2360.spec.ts` (runner, mobile project): 3 layouts x 3 gauges x 3 summaries x 320 / 390 with 12 floors
  - gauge markup per setting, info button / sheet / line per setting, no cell spills, no sideways scroll, only the list scrolls; the dark strip and line; the
  default; the lights popup from a strip; the settings card. Screenshots in `docs/evidence/SYNOPTIC-PHONE-SETTINGS-2360/`.

## 5. Pixel baselines

None expected to change. The defaults draw the 2.34.2 markup; no committed screenshot baseline covers the synoptic phone board
(`evidence-synoptic-mobile-2342` writes pictures, it does not compare them), and the only baseline that reaches the settings card is
`visual-matrix` settings-diagnostics (General tab), a viewport-only picture taken above the card. Only a non-default setting changes the board.

## 6. Not done / for the owner

- Not checked on a real phone (the strip's legibility at 6 px, the line's links under a thumb).
- The cross-section ignores `syn_phone_light` by design (section 3); if a stepped slab fill is wanted there, that is a separate request.
- `off` removes the only phone route to the info sheet's "הגדרות המפה" link; the owner reaches the card from the settings screen.
