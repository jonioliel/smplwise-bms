# GEN-UNITS-FIELD-2490 - generator settings: units inside the field frame

Owner decision Q16 (N54). Base: main 619f94d04. Branch: pilot/GEN-UNITS-FIELD-2490.

## What changed

- `frontend/src/generator/gen-settings.ts`: the rated power (kW, kVA), the alert thresholds, the retention windows and the run-log
  thresholds are `sw-field` fields with the shared `unit` slot (the same component and look as electricity and water). The
  "default N" line moved to the field's `message` slot (outside the unit frame).
- Labels lost their "(unit)" suffix in `he.ts`, `lang/en/i18n/en.ts` and both `generator-log.ts` catalogues; a new `settings.units`
  table carries the unit words (kW, kVA, bar, C, %, V, Hz, hours, hours ahead, seconds, minutes, days) in Hebrew and English.
- Unchanged: element ids, `data-*` hooks, values, min/max validation, request bodies and saved data.

## Progress note

| Row | State |
|---|---|
| Component reuse (`sw-field`, CR-FIELD-UNIT-2470), no new look | done |
| Labels without units, Hebrew + English tables | done |
| PC: tsc, eslint on touched files, unit specs (144 passed), generator evidence specs (36 passed) | done |
| Before/after captures (private/planning/gen_units_2490_compare_2026-11-23.html) | done |
| Runner evidence run | see the branch report |

Known limit (pre-existing, not changed here): the generator settings screen reads the Hebrew catalogue object directly, so labels
and the unit words stay Hebrew in an English session; the English tables are filled and parity-checked.
