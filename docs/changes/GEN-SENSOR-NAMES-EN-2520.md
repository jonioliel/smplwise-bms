# GEN-SENSOR-NAMES-EN-2520 - generator sensor names in English (server) and in the page language (routing + sensor mapping)

Base: origin/pilot/GEN-UNITS-FIELD-2520 (8ae3cbaa3; its open question 2, recommendation a). Branch: pilot/GEN-SENSOR-NAMES-EN-2520.

## Why

The generator sensor names (`generator_catalog.ROLES`) existed on the server in Hebrew only. An English page therefore showed Hebrew in
Settings > Infrastructure > Generator > Alert routing ("requires sensor" under an alert type the controller cannot serve) and in the
sensor-mapping tab (the name of every sensor role). The alert types already carry `title_en`; the sensor names now get the same.

## What changed

Backend (additive, ADR-015):
- `services/generator_catalog.py`: `ROLE_NAMES_EN` - the English name of every role (a test pins that every `ROLES` key has one, without
  Hebrew); `role_label(role, lang="he")`; `needs_label(t, lang="he")` builds the "requires sensor" text in either language (same order, same
  rule: value sensors first, the controller alarm outputs only when no value sensor can do it). The Hebrew output is byte-for-byte unchanged
  (a test compares it with the previous implementation for every alert type).
- New wire fields: `needs_en` beside `needs` in the policy items (`GET .../policies`) and in the device detail's `alert_types`;
  `label_en` beside `label` in the role-mapping items (`GET .../roles`). Each with a default, so the generated TypeScript marks them optional
  (an older server / the demo data without them keep working). `frontend/src/api/generated/wire-generator.ts` regenerated.
- Unchanged: the Hebrew `needs` / `label`, the live values' `label`, the history `labels`, `roles_detail` (not shown on the two screens of
  this row; see open question 1), permissions, audit, request bodies.

Frontend:
- `frontend/src/generator/gen-text.ts` (the shared generator text reader): `genServerWord(heWord, enWord)` - the server's English twin on an
  English page when the server sent one, else the server's Hebrew word.
- `gen-routing.ts`: the alert type title (`title_en`, same behaviour as before, now through the shared reader) and the "requires sensor"
  text (`needs_en`) in the desktop table and in the phone list (the phone row's needs line gets the same `data-needs` hook).
- `gen-settings.ts` (sensor-mapping tab): the role name and the select's `aria-label` use `label_en` on an English page (`data-role-label`
  hook added).
- A Hebrew page reads the same Hebrew words as before. Arabic / Russian pages: `uiLang()` is `he` | `en`, so they keep the Hebrew, as
  every other server word.

Tests / evidence:
- `smplwise_vms/backend/tests/test_gen_sensor_names_en_2520.py` (5 tests): every role has an English name; Hebrew `needs_label` unchanged
  and English in the same order; `needs_en` in the policies and device detail (null when available); `label_en` in the mapping answer.
- `frontend/tests/generator-fixtures.ts` / `generator-mocks.ts`: the mock now sends the real Hebrew sensor names (it sent the role keys)
  plus `needs_en` / `label_en`. No `toHaveScreenshot` baseline covers the routing or mapping screens (checked: the only generator pixel
  baselines are `layout-audit30-e-infra` live / charts), so no Hebrew baseline changes.
- `frontend/tests/evidence-gen-sensor-names-en-2520.spec.ts`: Hebrew and English sessions, light and dark, routing and mapping.

Design ratchet: no new literal (no CSS touched).

## Tests

(see the "Runner results" section below)

## Compare page

`private/planning/gen_sensor_names_en_2520_compare_2026-11-25.html` (local, Hebrew; before = base 8ae3cbaa3, after = this branch; same
mock data).

## Open questions

1. Other answers still carry Hebrew-only sensor labels (`values[].label`, `roles_detail[].label`, history `labels`). A frontend grep finds
   only one place that shows them: the history CSV export's column headers (`gen-logic.toCsv`, from history `labels`); the live screen and
   charts name the roles from the frontend catalogue.
   a. A small follow-up: `labels_en` in the history answer and the CSV header in the page language (recommended - the catalogue is ready).
   b. Leave as is (a downloaded file, not a screen).
2. The English names were written here (generic genset wording, e.g. "Transfer switch", "Hours to next service").
   a. Keep; correct single names when the owner sees them (recommended).
   b. Owner review of the full list first.
