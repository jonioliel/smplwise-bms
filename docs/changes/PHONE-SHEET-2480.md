# PHONE-SHEET-2480 - the phone sheet no longer reads through (opaque floor, solid module forms)

Branch `pilot/PHONE-SHEET-2480`, base `main` 619f94d04 (2.47.0). Found while capturing question N55 (water tariff "new version",
2.46.0 and 2.47.0, phone 390): the sheet looked translucent and its "ביטול" looked as if it sat on the bottom bar.

## What was measured (before, phone 390 x 844, mocked water backend, every selectable skin, light and dark)

- `sw-sheet` paints `rgba(--sw-sheet-rgb, --sw-sheet-alpha)`. The look dial `transparency` (default 72, clamped to the contrast floor)
  writes `--sw-sheet-alpha` inline on `<html>` for EVERY skin (design/look.ts), which overrides the skin token `1` the component's
  comment relies on ("the classic skin's resting alpha is 1"). Result: classic 0.77 / 0.72 (light / dark), infra 0.80 / 0.72,
  soft 0.75 / 0.72, tesla 0.72 / 0.72 - all with `backdrop-filter: none`, so the page's figures and the bottom bar were crisp
  behind the form. Domus and crystal: 0.72-0.74 with a 36 px blur (the bar still ghosts faintly under the action row).
- The action row is NOT covered: the sheet is `z-index` 51 (`--sw-z-modal` + 1) over the bottom bar's 30; the bar is 781-844 px,
  "ביטול" 782-826 px, and the top element at the centre of both actions is the action itself (drilled through the shadow roots).
  The "Cancel over the bar" in the capture is the bar showing THROUGH the translucent sheet. The sheet keeps its
  `env(safe-area-inset-bottom)` padding.

## What changed

- `design/tokens.ts`: new token `--sw-sheet-alpha-min` (1). The glass skins set 0 (`skins/domus.ts`, `crystal.ts`, `bubble.ts`); a
  custom palette sets 0 when it blurs (`design/palette.ts`).
- `components/sw-sheet.ts`: the surface is `rgba(--sw-sheet-rgb, max(--sw-sheet-alpha, --sw-sheet-alpha-min))` - opaque in a skin
  with no sheet blur, unchanged in a glass skin. The close button gets the opaque dialog's hairline (`--sw-menu-border`) where the
  sheet is opaque (its translucent `--sw-layer` fill disappears on an opaque light sheet); none on the glass sheets.
- `electricity/elec-ui.ts` (`elec-dialog`, every dialog of electricity and water), `screens/water/page-customers.ts`,
  `screens/water/page-accounts.ts`, `electricity/elec-customers.ts`: the form sheets take the existing `solid` attribute
  (POLISH4-WP1) - opaque `--sw-surface-solid` in every skin, in line with the owner's single opaque dialog (Q-DES-8A, Q-DES-23 b).
- Unchanged: layout, sizes, the button order and the module looks; the non-form sheets in domus / crystal keep their frosted glass
  (device sheet, synoptic summary, area picker, incidents, cast picker); no scroll added anywhere.

## Tests

- `tests/unit-design-tokens.spec.ts`: every skin x scheme - no sheet blur => floor 1, glass => 0; every ready palette likewise.
- `tests/layout-phone-sheet-2480.spec.ts` (mobile only, mocked): the water "new version" sheet in classic, tesla, domus x light, dark
  is opaque, stacked over the bar, both actions on top; the synoptic summary sheet keeps the glass in domus and is opaque in classic.
  Both fail on 619f94d04 (7/7 layout, 1 unit) and pass with the change.

Rollback: revert the branch commits; no data, API or setting is touched.
