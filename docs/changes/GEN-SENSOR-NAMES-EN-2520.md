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

PC: `pytest tests/test_gen_sensor_names_en_2520.py` (main checkout venv) - exit 0, 5 passed; `scripts/gen_wire_types.py --check` - exit 0.

Runner, slot B. Job `~/work/p2520_gensensoren_run.sh` at 1cba40b3d (code head; later commits change only the evidence spec, this
note and evidence PNGs):

| Check | Command | Exit | Result |
|---|---|---|---|
| Wire types | `python scripts/gen_wire_types.py --check` | 0 | up to date |
| Ruff (touched backend files) | `ruff check ...` | 0 | all checks passed |
| Backend, one process per file (`SW_WIRE_STRICT=1`) | `pytest tests/<file>.py` | 0 each | test_gen_sensor_names_en_2520 5, test_generator 49, test_genalert_295 11, test_generator_home_widget 3, test_genlog_092 21, test_wire_routers_b_2450 66, test_wire_routers_c_2470 58, test_wire_routers_d_2470 166, test_wire_route_coverage_2460 5 - all passed |
| Types (app / tests) | `npx tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json` | 0 / 0 | clean |
| Lint (touched files) | `npx eslint src/generator/gen-routing.ts src/generator/gen-settings.ts src/generator/gen-text.ts tests/...` | 0 | 0 errors (3 "file ignored" warnings for test files) |
| Design ratchet | `python3 scripts/design_ratchet.py` | 0 | no count above the baseline |
| Unused exports | `node scripts/unused-exports.mjs` | 0 | nothing new |
| Unit | `npx playwright test -c playwright.unit.config.ts tests/unit-generator.spec.ts` | 0 | 25 passed |
| Build | `npm run build` | 0 | ok |

Job `~/work/p2520_gensensoren_run2.sh` at 1bf47d376 (final spec):

| Check | Command | Exit | Result |
|---|---|---|---|
| Evidence + generator layout baselines (desktop / tablet / mobile) | `npx playwright test tests/evidence-gen-sensor-names-en-2520.spec.ts tests/evidence-gen-units-routing-2520.spec.ts tests/evidence-gen-units-en-2490.spec.ts tests/evidence-genalert.spec.ts tests/evidence-generator.spec.ts tests/layout-audit30-e-infra.spec.ts --workers=2` | 0 | 94 passed, 44 skipped (the Hebrew pixel baselines of `layout-audit30-e-infra` pass unchanged; no baseline refreshed) |
| New spec on the base 8ae3cbaa3 (with this branch's mock) | `npx playwright test tests/evidence-gen-sensor-names-en-2520.spec.ts` | 1 | 9 failed (English sessions: Hebrew names; Hebrew mapping: the new `data-role-label` hook is absent), 3 passed (Hebrew routing: the same Hebrew text as on this branch) |

The first run of the new spec (at 1cba40b3d) failed its routing checks on all three projects: the spec expected a second "requires
sensor" line (fuel) that is not on the matrix's first page. The spec was corrected (df408ca8f) to check the first-page line only and to use
soft checks so every shot is made; the mapping checks passed in both runs.

Evidence PNGs refreshed (the routing and mapping screens now show the mock's real Hebrew sensor names instead of role keys):
`docs/evidence/genalert/routing-first-run-*`, `routing-configured-*`, `docs/evidence/generator/settings-routing-empty-*`,
`settings-routing-full-*`, `settings-mapping-*`. Other generator evidence PNGs re-rendered by the run were not committed (unchanged screens).

NOT_RUN: the full backend and frontend suites and the release gate (the train gate covers them).

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
