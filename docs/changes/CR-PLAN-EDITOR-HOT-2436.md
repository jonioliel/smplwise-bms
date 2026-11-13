# CR-PLAN-EDITOR-HOT-2436 - plan editor: render hot path, message lifetime, stale entity search

Branch `pilot/CR-PLAN-EDITOR-HOT-2436` from `origin/main` 665ec8f24 (v2.43.4). Code-review master plan
(`private/code-review-2026-11-13/MASTER_PLAN.md`) section 3.2, wave 1; findings of report 06: PERF-5, MSG-1 (plan editor part),
RACE-7 (`searchEntities`). Scope: `frontend/src/screens/explore-plan-editor.ts` and two new unit specs. No backend, API, stored data,
version, changelog or device change. Visuals and behaviour are meant to stay identical; only message lifetime changes (the MSG-1 fix).

## What changed

### MSG-1 - one message timer
- `flash()` keeps one stored timer: a newer message cancels the older one's clear, so an older timer never cuts a newer message short
  (also the same text flashed twice). The clear still removes only the text it showed. `flashError()` got the same stored timer.
- All 43 sites that wrote `this.info = X; setTimeout(() => (this.info = ''), N)` (including the studio's `onNotice` and the panel's
  `say`) now call `this.flash(X, N)` with the same text and the same duration. Messages set without a timer (demo notes) are unchanged.
- `confirmDiff`: the message is still shown during the reload and its time still starts after the reload; a message written during the
  reload is no longer wiped by it.
- `disconnectedCallback` clears both timers (no timer fires on a detached editor).

### PERF-5 - stable props on the render hot path
- `memo(name, keys, build)`: identity memos with `sameRefs` (`map/memo.ts`). The editor replaces its anchors, zones, layers, document
  and drafts and never edits them in place (checked: `apply`, undo / redo, `patchCandidate`, zone updates all build new objects).
  - `markers` - keys: anchors, layers, document, active level, bundle source.
  - `planZones` - keys: zones, multi-drag zone preview, detected candidates (hidden zones: the shared `EMPTY`).
  - `issueIds` - key: the studio's issue list.
  - `rulers` - keys: bundle, document, tool, cursor, connector start / mode, walk armed / focus, active level, calibration, measure
    points, estimates switch.
  - `shownTags` (read twice per render) - keys: document, zones, zones shown, active level.
  - `curveLive` (read twice per render: hint and canvas) - keys: draft, document, cursor, plan size.
  - `highlightIds` (new getter, same three cases as the inline expression) - the multi-selection id list keyed on the selection list.
  - the studio panel's `entityChoices` - key: anchors.
- One frozen `EMPTY` replaces the `?? []` / `: []` literals handed to `sw-plan-canvas` (draft points, wall draft, curve draft, arc preview,
  highlight ids, ghost handles). The canvas does not mutate these lists.
- The floor-image card's wall segments are sampled only when the alignment view is shown, memoised per document and plan size (they were
  sampled on every render of the card).
- `geom-drag-move` is coalesced to one preview per animation frame (the latest move wins). The drop (`geom-drag`) and the cancel drop a
  move still waiting, and disconnect cancels the frame, so a late frame never brings a preview back. The drop computes from its own
  detail, as before, so the saved result is the same.

### RACE-7 - `searchEntities`
- A request number is taken before the await and compared after it, in the answer and in the failure; only the latest request writes
  the list, the error or the busy flag. The "light entities too" switch is read once, before the await.

## Tests

New (written before the change; the static spec ran red on the unchanged source: 3 failed):
- `frontend/tests/unit-plan-editor-hot-lint-2436.spec.ts` (node, static): no own clearing timer for `this.info` / `this.error`; flash's
  stored timer and its clear on disconnect; no `?? []` in the canvas binding; the request-number checks in `searchEntities`.
- `frontend/tests/unit-plan-editor-hot-2436.spec.ts` (page, demo data, desktop): stable identity of ten canvas array props across a
  render with no input changed, and a real change (layers) giving a new, correct list; message lifetime (same text twice; older and
  newer); no timer on a detached editor; an older entity search answering or failing late does not overwrite the newer one.

Runs on the workstation (Windows, Node 24, `npm run build` then the preview on a private port with no backend, one worker):
- `npx tsc --noEmit`: exit 0 (and again inside `npm run build`: exit 0).
- `npx playwright test -c playwright.unit.config.ts --workers=1 tests/unit-plan-editor-hot-lint-2436.spec.ts`: before the change
  3 failed; after it 3 passed.
- `SW_BASE_URL=http://127.0.0.1:4677/ npx playwright test --project=desktop --workers=1` with the new page unit and the 27 plan-editor
  evidence / layout specs (`evidence-architect-request`, `-camsuggest-live`, `-curve-points`, `-curved-walls`, `-door-tool`,
  `-editor-move`, `-editor`, `-levels-setting`, `-mobile-options`, `-mobile-structure`, `-nvrless-cameras-2412`, `-plan-glass-entity`,
  `-plan-glass`, `-plan-package`, `-plan-studio` (1-4, stairs), `-plan-versions`, `-shared-space-stations`, `-shared-space`, `-st7-ui`,
  `-stylize-options`, `-zone-vertices`, `-zones`, `layout-st7-ui`): **33 passed, 107 skipped**. The 33: the 4 new page tests,
  architect-request 7, mobile-options 3, mobile-structure 4, st7-ui 7, layout-st7-ui 8 (all demo / mocked data).
- The 107 skipped are the `SW_LIVE=1` specs (developer backend); they were **NOT_RUN** here. They include the drag specs that exercise
  the coalesced `geom-drag-move` (editor-move, curve-points, curved-walls, plan-studio 1-4); the runner's targeted gate covers them.
- An earlier run by mistake hit another worktree's preview on a shared port (a build without this change): the 4 new page tests
  failed there exactly as expected (props not stable, message cut short, timer fired after detach, the old search answer won). Its
  evidence results are discarded.
- Pixels: there is no screenshot (pixel) spec for the plan editor; `layout-st7-ui` is an in-page layout guard and passed. The rendered
  values are unchanged (same lists, same text, same durations), so no runner pixel run was made.

## Known limits
- The rAF coalescing means a drag preview can be one frame behind the pointer (by design of the finding). A pre-existing oddity is
  unchanged in kind: in the circuits tool a drag-move calls `onGeomSelect`, which toggles lamp membership per move event; the number of
  such calls already depended on the pointer's event rate.
- Report 06's other plan-editor items (CMP-1 confirms, STRUCT-1 split, PERF-6 in `plan-studio-panel`) are not in this branch.

## Rollback
Revert the commit; nothing is stored or migrated.
