# CR-FE-COMPLEXITY-2450 - split the most complex frontend logic functions

Branch `pilot/CR-FE-COMPLEXITY-2450`, based on `origin/release/2440-train` (43ad4766e). Target 2.45.0. Frontend only, no visible change.
Sources: code review 2026-11-13, 08:F22 (very large modules) and 06:STRUCT-1 steps 2-3 (pure logic out of the big functions/modules).

## Measurement

New `frontend/scripts/complexity-report.mjs`: ESLint's `complexity` rule alone (TypeScript parser, no type information), worst first.
Report only, no gate. On the base: 362 functions at complexity >= 25. The top of the list is render code (`sw-app.renderRoute` 200,
`system-diagnostics.renderMedia` 123, `devices-area-bubble`, `explore-plan-editor.render` / `handleKey`) and files other agents edit today
(shell, router, segmented / tables, electricity, water, home, generator, maintenance); those were left alone. The worst PURE LOGIC
functions outside that scope were split:

| Function | File | Before | After (function; extracted parts) |
|---|---|---|---|
| `parseCondition` | `src/api/automations.ts` | 77 | 21; `typedCondition` 35, `stateCondition` 23 |
| `buildPrimitives` | `src/map/geometry.ts` | 72 | 11; `straightWall` 12, `openingPrimitives` 9, `labelPrimitives` 7, `connectorPrimitives` 7, `objectPrimitives` 31 |
| `hintFor` | `src/calendars/grid-logic.ts` | 70 | 19; `hoursRule` 9, `bookingRules` 16, `conflictRule` 25, `verdictOf` 6 |
| `parseTrigger` | `src/api/automations.ts` | 66 | 10; `specialTrigger` 22, `typedTrigger` 37 |
| `parseAction` | `src/api/automations.ts` | 60 | 19; `flowAction` 26, `serviceAction` 18 |
| `matchFloors` | `src/xsection/xs-model.ts` | 58 | 10; `levelRule` 10, `nameRule` 9, `mapSuggestions` 13, `assignAreas` 14, `floorInfos` 7 |
| `roomStates` | `src/map/room-state.ts` | 53 | 24; `openOpenings` 13, `roomPresence` 9, `roomReadings` 10 |

## Method (one function per commit pair)

1. `test(...)`: a characterisation spec `tests/unit-cx-<name>-2450.spec.ts` runs a fixed list of inputs through the function and compares
   the whole answer with `tests/fixtures/cx/<name>.json`, recorded from the UNCHANGED function (helper `tests/cx-record.ts`; the encoding
   keeps undefined members, NaN / Infinity / -0, Map and Set). `SW_CX_RECORD=1` rewrites a record - only when a behaviour change is meant.
2. `refactor(...)`: the split. Bodies moved verbatim into module-private helpers in the same file, the order of the checks, of the side
   effects (uid calls, pushes) and of the output unchanged. The only edits inside moved code: a loop's `continue` became the helper's
   `return` (straight wall), a flag set inside the moved branch is returned (`hoursRule`), two `input.*` reads became arguments
   (`roomPresence`), and `matchFloors`' passes destructure one shared `MatchState`. No export added or removed.

Not deduplicated on purpose (moved verbatim): `straightWall` still computes its cut spans inline although `keepSpans` does the same for curved
walls; a later cleanup can share it.

## Tests actually run (PC, 19.11)

- Characterisation records: written once with `SW_CX_RECORD=1` on the unchanged code, then re-run on the unchanged code: 7/7 pass.
- After the splits, unit (node, `playwright.unit.config.ts`, `--workers=1`):
  - `unit-cx-parse-*` + `unit-automation*` + `unit-kavarnit-ext`: 139 passed, 0 failed;
  - `unit-cx-build-primitives` + `unit-geometry*` + `unit-glass-wall` + `unit-curve-fit` + `unit-door-tool` + `unit-shared-space`: 68 passed, 0 failed;
  - `unit-cx-*` + `unit-calendars*` + `unit-xs-*` + `unit-syn*` + `unit-synoptic*` + `unit-switch-light*` + `unit-glass-wall` + `unit-plan-3d-state`
    + `unit-plan-canvas-state` + `unit-plan-3d-determinism`: 144 passed, 0 failed.
- `tsc --noEmit`: app (`tsconfig.json`) exit 0, tests (`tsconfig.tests.json`) exit 0, scripts (`tsconfig.scripts.json`) exit 0.
- ESLint (repo config, type-aware) on the five changed source files: exit 0, no report. `scripts/unused-exports.mjs --enforce`: OK.
- Browser evidence on a local Vite dev server, desktop project, `--workers=1`: `evidence-automations-builder`, `evidence-automations-list`,
  `evidence-calendars-grid-edit-2343`, `evidence-xsection-synoptic`, `evidence-synoptic-ha-2310`, `evidence-plan-studio`: 160 passed,
  18 skipped (the specs' own skips), 1 failed - `evidence-automations-builder.spec.ts:558` timed out in `page.goto` (load wait, the PC
  was running tsc at the same time); re-run alone: 1 passed.

NOT_RUN: pixel specs (none expected to change: no markup or CSS touched; the runner entry check covers them), the full unit / evidence
suites, tablet / mobile projects, the runner entry check (not queued by this agent).
