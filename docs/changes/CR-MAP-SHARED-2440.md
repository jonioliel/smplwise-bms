# CR-MAP-SHARED-2440 - one definition for the pieces the three floor screens wrote two or three times

Branch `pilot/CR-MAP-SHARED-2440`, cut from `origin/release/2437-train` @ `32c4a2275` (the 2.43.7 train: AUDIT30-COMBINED,
CR-WAVE1B-COMBINED with CR-PLAN-EDITOR-HOT, FE-LEAK-TEXTKEY). Plan row: `pilot/CR-MAP-SHARED-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md` section 3.3, finding 06:DUP-9. No version bump, no CHANGELOG entry, no
backend file, no device or lab access.

## What and why

The live floor map, the historical map and the plan editor each carried their own copy of the same small pieces, so a fix
in one screen did not reach the others. They now read one pure module, `frontend/src/map/floor-view-shared.ts`:

| Shared piece | Was written in | Now |
|---|---|---|
| "a key belongs to a field" predicate | floor map (`typing()`), history map and editor (inline) | `isTypingTarget(target)` |
| plan picture switch per floor (localStorage) | all three, with the keys `sw.floor.` / `sw.history.` / `sw.editor.background.<floor>` | `readPlanImage(scope, floorId)`, `writePlanImage(scope, floorId, on)` - the same three keys |
| library lookups after `loadLibrary` | floor map, history map | `libraryLookups(lib)` |
| loading the 3D chunk in `toggle3d` | floor map, history map | `loadPlan3d()` (null = ready, else the error text) |
| default-3D rule (`map.default_view`) | floor map, history map | `defaultViewIs3d(settings)`, `default3dDue(pending, view3d, hasScene)` |
| zones as the scene builder reads them | floor map x2, history map | `sceneZonesOf(zones)` |
| zones as rooms of the room-state layer | floor map, history map | `stateRoomsOf(zones)` |
| lamps of the state facts (lit by circuit or entity) | floor map, history map | `stateLampsOf(facts, circuits, states)` |
| level fallback | floor map x2, history map | `fallbackLevelId(geometry, bundle)` |
| 3D hover labels | floor map, history map | `hoverLabelsOf(anchors, nameOf, objects, itemNames, zones)` |

`deriveRoomStates` of the live map built its room-state entities with a private loop that re-implemented
`stateEntitiesOf` (`map/state-facts.ts`); it now calls `stateEntitiesOf(b.anchors, states)`. The new unit keeps the old loop
as a reference and compares both the values and the JSON key order.

Behaviour is unchanged and the markup is byte-identical: no template, no CSS and no attribute was touched (the diff contains
no `html` or `css` literal change). Notes on the exact equivalences:

- `toggle3d`: before, `threeState = 'ready'` was set inside the `try`; now it is set after `loadPlan3d()` answered null. On
  failure the order is still `threeState = 'error'`, then `threeError`.
- The dynamic `import('./sw-plan-3d')` now lives in the shared module. The 3D chunk stays a lazy chunk (the screens still do
  not import it statically); only the importing module of the chunk changed.
- The editor's `typing` was `target && (...)` (so `undefined` or `''`-like falsy for a non-field); it is now a boolean with
  the same truthiness, and `e.composedPath()[0]` not being an `HTMLElement` answers false in both.

## Not done here (left to the owner branches of those parts)

- The second half of 06:DUP-9 - the history map's `renderApi` / `renderScrub` twins (private `renderHead` / `render3d` /
  `renderCanvas`) - belongs to the playback / history-map hot-paths branch (`CR-INV-PLAYBACK`) in the plan; that branch is
  not in the base, so the templates were left alone here ("the shared pieces only").
- Other copies of the same pieces outside the three files of this row (`investigate-event-detail.ts`,
  `styleguide-screen.ts`, `wall/sw-wall-plan.ts` and `plan-wizard.ts` load the 3D chunk themselves) are not in the row.

## Resolved file list

- new `frontend/src/map/floor-view-shared.ts`
- `frontend/src/screens/explore-floor-map.ts`
- `frontend/src/screens/investigate-history-map.ts`
- `frontend/src/screens/explore-plan-editor.ts` (the picture switch and the typing predicate only)
- new `frontend/tests/unit-floor-view-shared.spec.ts`

Outside my rows: nothing.

## Overlap with other branches in flight

- `pilot/PLAN3D-R32-ANSWERS-2438` edits `explore-floor-map.ts` (two template lines: the `sw-plan-3d` properties near
  `.roomPills` and the `sw-room-card` `camera` attribute) and `explore-plan-editor.ts` (one import line of
  `../map/candidates`, a new `@state`, two lines in the studio panel model). None of those lines is touched here; the
  nearest hunk of this branch is more than 100 lines away in both files. No plan3d file (`map/sw-plan-3d.ts`,
  `scene-*.ts`, `room-glow*.ts`) is edited.
- `CR-INV-PLAYBACK` (not started in this base) owns the load path of `investigate-history-map.ts`; this branch changes
  eleven small spots there (imports, the key handler's predicate, the library assignment, the picture switch, `toggle3d`,
  the scene zones / labels, the room lamps / rooms, the level fallback).
- `pilot/CR-FLOORMAP-STATE-2440` (same batch, same agent) is based on this branch: both edit `explore-floor-map.ts`.

## Tests

Actually run on the workstation (16.11.2026; node 24, `--workers=1`):

- Full-project `npx tsc --noEmit` (it took 50 minutes on the loaded PC): **2 errors, both in this branch** -
  `defaultViewIs3d` declared its parameter as `Record<string, unknown>` and `ProductSettings` has no index signature.
  Fixed (the parameter is `{ 'map.default_view'?: unknown }`); the rest of the project type-checked with the new module.
- After the fix, `tsc --noEmit -p` on a focused project (the base `tsconfig.json` with `include` narrowed to
  `src/vite-env.d.ts`, the shared module, the three screens and the new spec, plus everything they import): **exit 0**.
  The full-project run was not repeated after the fix.
- `playwright test -c playwright.unit.config.ts` on `unit-floor-view-shared.spec.ts` (new, 6 tests),
  `unit-room-state.spec.ts`, `unit-plan-editor-hot-2436.spec.ts`, `unit-plan-editor-hot-lint-2436.spec.ts`:
  **19 passed, 0 failed**. The first run had 1 failure in the new spec's source guard: it found a fourth copy of the
  scene-zones mapping (`roomSummaries` of the live map), which now uses `sceneZonesOf` too.

NOT_RUN (the PC had 0.1-1.2 GB of free memory the whole session; the batch brief forbids heavier runs then):

- every browser spec: `unit-floor-map-3d.spec.ts` (the 3D toggle and key 3 on the demo floor map),
  `evidence-history-map.spec.ts`, the editor evidence specs, and the map pixel specs the row names as its proof
  ("markup byte-identical" is established here by the diff, not by a pixel run);
- `npm run build` (so the chunk layout after moving the dynamic import was not looked at).
