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

## Part 2 - the routing screen follows the page language (lead: Q1 = a)

Before: `gen-routing.ts` read `he.generator` directly, so an English page showed the whole routing screen in Hebrew (2.49.0 fixed
the same thing for `gen-settings.ts` only).

- `frontend/src/generator/gen-text.ts` (new): the active-language reader of 2.49.0 (English catalogue merged over the Hebrew, built on
  an English read, rebuilt only when the pack's table is another object; a Hebrew page reads `he.generator` itself) as `GEN` and
  `GEN_SETTINGS`. `gen-settings.ts` now imports it instead of its own copy (same behaviour); `gen-routing.ts` uses it for every
  `G.*` / `S.*` word (columns, severities, channels, quiet modes, editor labels, notes, toasts, the reset confirmation).
- Alert type titles: the server already sends `title_en`; an English page shows it (the list, the matrix, the editor heading, the
  preview title, the switch label, the search).
- The alert groups and the template placeholders come from the server in Hebrew only. They get keys in the generator-routing
  catalogue (`group_<key>`, `ph_<key>`; he / en + ar / ru first translations, dev-marked) read through the new `grtServer(key,
  serverWord)`: a Hebrew page, or a key or language without a word, keeps the server's word, so the Hebrew output is unchanged.
- Still Hebrew on an English page (server data, out of this row): the "requires sensor" sensor names (`needs`, also Hebrew in the
  sensor-mapping tab: `generator_catalog.ROLES` has no English) and the message text / sample (the notification body is a Hebrew
  template, `template_he`). Role labels are already localized by the server (`localize_for`).
- Arabic / Russian pages: the main catalogue (`he.ts` / `en.ts`) has no Arabic or Russian column anywhere in the product
  (`uiLang()` is `he` | `en`), so those words stay Hebrew as on every other screen; the routing catalogue's words (including the
  new group and placeholder words) are Arabic / Russian first translations.
- Test data: the generator mock sends the server's English titles (`TITLE_EN` in `tests/generator-fixtures.ts`) instead of the key.
- Evidence spec: an English-session check of the routing screen and the editor (no Hebrew except the mock's server data: role
  labels, a user name, the sample message) and a Hebrew-session check (Hebrew group and type words, no English title).

### Part 2 tests

Runner job `~/work/p2520_genunits_run2.sh` (slot B) at b329b2c07, Linux:

| Check | Command | Exit | Result |
|---|---|---|---|
| Types (app / tests) | `npx tsc --noEmit -p tsconfig.json` / `-p tsconfig.tests.json` | 0 / 0 | clean |
| Lint (touched files) | `npx eslint src/generator/gen-routing.ts src/generator/gen-settings.ts src/generator/gen-text.ts src/i18n/generator-routing.ts tests/...` | 0 | 0 errors (3 "file ignored" warnings for test files) |
| Design ratchet | `python3 scripts/design_ratchet.py` | 0 | no count above the baseline |
| i18n report | `node scripts/i18n_missing_keys.mjs` | 0 | en: missing 20, gap 4, placeholder 1 |
| Unused exports | `node scripts/unused-exports.mjs` | 0 | nothing new |
| Unit, node-only, whole suite | `npx playwright test -c playwright.unit.config.ts --workers=2` | 1 | 5233 passed, 15 skipped, 3 failed: `unit-mfa-passkeys-2490.spec.ts` (known, pre-existing: needs a preview server on port 4173, fails the same on main in a plain unit run - 2.52 train note) |
| Build | `npm run build` | 0 | ok |
| Generator evidence + layout (desktop / tablet / mobile) | `npx playwright test tests/evidence-gen-units-routing-2520.spec.ts tests/evidence-gen-units-en-2490.spec.ts tests/evidence-genalert.spec.ts tests/evidence-generator.spec.ts tests/evidence-genlog-092.spec.ts tests/layout-audit30-e-infra.spec.ts` | 1 | 90 passed, 44 skipped, 1 failed: `evidence-genlog-092` "switch on" on tablet (run-log page pager; the page and its mock are not touched here; desktop and mobile passed) - see the re-run below |
| New spec on the base 3d71fb183 | `npx playwright test tests/evidence-gen-units-routing-2520.spec.ts` | 1 | 9 failed (the units and English checks - expected), 3 passed (the Hebrew-session check: Hebrew words unchanged) |

NOT_RUN: a targeted re-run of the one `evidence-genlog-092` tablet failure (queued behind the 2.52 jobs for over 30 minutes, cancelled).
That test covers the run-log page and its pager, which this branch does not change: the only shared change is the mock's English `title_en`
for the routing policies. Also NOT_RUN: the full frontend suite and the release gate (the train gate covers them).

## Open question

1. (answered by the lead: a - done in part 2 above.)
2. The sensor names in "requires sensor" (and in the sensor-mapping tab) are Hebrew on an English page; the server has no English for them.
   a. A small backend row: English sensor names in `generator_catalog.ROLES` through the server `Msg` catalogue (recommended).
   b. Leave as is.
