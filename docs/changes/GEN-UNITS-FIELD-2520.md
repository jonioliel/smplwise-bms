# GEN-UNITS-FIELD-2520 - generator alert routing: the minute fields carry their unit inside the frame

Task card: GEN-UNITS-FIELD-2490 (management/tasks.json; status there is stale). Base: origin/main 3d71fb183 (v2.51.0).
Branch: pilot/GEN-UNITS-FIELD-2520.

## Context

The row itself shipped in 2.49.0 (merge 16b38a7c4, pilot/GEN-UNITS-FIELD-2490 bd551962d, see
`docs/changes/GEN-UNITS-FIELD-2490.md`): the rated power, alert thresholds, retention windows and run-log thresholds use the
shared `sw-field` unit slot. A check of origin/main found one gap in the same settings screen: the two minute inputs of the
alert routing drawers (Settings > Infrastructure > Generator > Alert routing) still carried the unit in their words:

- the critical severity default: label "דקות עד הסלמה של התראה קריטית" / "Minutes until a critical alert escalates" over a bare
  90px number input;
- a non-critical alert type with escalation on: a bare 90px number input followed by "דקות עד הסלמה" (read from the Hebrew
  catalogue directly, so Hebrew in an English session too).

## What changed

- `frontend/src/generator/gen-routing.ts`: both inputs are slotted in `sw-field` with `unit` = minutes (the same component and
  look as electricity's "days" / "hours after the period" fields and the other generator settings), width 132px (the
  electricity unit-field width). The critical label names the value ("זמן עד הסלמה של התראה קריטית" / "Time until a critical
  alert escalates"); the escalate-after field has an aria-label ("זמן עד הסלמה" / "Time until escalation") and the words after
  it read "עד הסלמה" / "until escalation" ("[15 min] until escalation").
- `frontend/src/i18n/generator-routing.ts` + the en / ar / ru packs: `criticalDelay` reworded; new keys `unitMin`,
  `escalateAfter`, `escalateUntil` in all four languages (ar / ru stay dev-marked, initial translation).
- `frontend/tests/evidence-gen-units-routing-2520.spec.ts`: Hebrew and English sessions, light and dark: the unit attribute
  and the drawn unit, no unit word in the label, the aria-label and the trailing words.
- Unchanged: ids (`crit-min`), `data-critical-delay` / `data-escalate-min` hooks, min / max, values, request bodies, saved data.
  `he.generator.settings.escalateAfter` is no longer read by this screen (left in place; `he.ts` is touched by another 2.52 row).
- RTL: the unit sits at the end in the reading direction (left of the figure in Hebrew), digits stay left-to-right
  (sw-field's numeric rule).
- Design ratchet: px-literal count unchanged (two `inline-size:90px` became two `inline-size:132px`).

## Tests

Runner job `~/work/p2520_genunits_run.sh` (slot B) at ae7a252d3, Linux:

| Check | Command | Exit | Result |
|---|---|---|---|
| Types (app) | `npx tsc --noEmit -p tsconfig.json` | 0 | clean |
| Types (tests) | `npx tsc --noEmit -p tsconfig.tests.json` | 0 | clean |
| Lint (touched files) | `npx eslint src/generator/gen-routing.ts src/i18n/generator-routing.ts tests/evidence-gen-units-routing-2520.spec.ts` | 0 | clean |
| Design ratchet | `python3 scripts/design_ratchet.py` | 0 | no count above the baseline (px-literal 25639) |
| Unit (catalogue placeholders, 4 languages) | `npx playwright test -c playwright.unit.config.ts tests/unit-generator.spec.ts` | 0 | 25 passed |
| Build | `npm run build` | 0 | ok |
| Evidence (new + GENALERT-295) | `npx playwright test tests/evidence-gen-units-routing-2520.spec.ts tests/evidence-genalert.spec.ts` (desktop / tablet / mobile) | 0 | 9 passed |
| Same specs on the base 3d71fb183 | as above | 1 | 6 failed (the new spec: no unit in the frame - expected), 3 passed (genalert) |

Evidence PNGs refreshed: `docs/evidence/genalert/routing-critical-default-editor-*` and `routing-alert-type-editor-*`.
No `toHaveScreenshot` baseline covers the routing drawers (none to refresh). Compare page (local, Hebrew):
`private/planning/gen_units_field_2520_compare_2026-11-25.html`.

NOT_RUN: the full frontend suite and the release gate (the train gate covers them).

## Open question

1. In an English session the rest of the routing screen (`gen-routing.ts` reads `he.generator.settings` directly) is still Hebrew,
   as before this change; 2.49.0 fixed the same thing for `gen-settings.ts`.
   a. Separate small row: the routing screen reads the active-language catalogue as gen-settings does (recommended).
   b. Leave as is.
