# CR-I18N-MAP-WIZARD-2441

Two rows of `private/code-review-2026-11-13/MASTER_PLAN.md`, one commit set each, on one branch:

- `pilot/CR-I18N-MAP-2436` - 08:F11, map text only: text literals in `frontend/src/map/*`, no geometry or render code.
- `pilot/CR-I18N-PLANWIZARD-2436` - 08:F11 (plan wizard) and 08:F19 (plan wizard items): `frontend/src/plan-wizard/*`.

Base: `origin/pilot/CR-I18N-CORE-2441` (e6d320acd), with `origin/main` (v2.43.7, cc69447f1) merged in first.
Rules followed: `docs/changes/CR-I18N-CORE-2441.md`, "For the area rows that follow" - `tr()` and `{name}` only, no own
detector or filler, module-level constants allowed, no Arabic / Russian keys.

## The merge of main

18 conflicts, all between CR-I18N-CORE / I18N-EN-SWITCH-2438 and CR-NAV-LABELS-2436 / CR-SHELL-LAZY-2436 (15 import lines
kept from both sides, `tickets/text.ts`, `shell/nav.ts`, `main.ts`), plus `i18n/nav-labels.ts` (new on main, carried its own
detector and filler - now core's) and the two guard specs that disagreed about it.

The lead asked every i18n area branch to share one resolution. This branch resolved the merge on its own first (0e7b2dbef)
and was then aligned to CR-I18N-CAL-ELEC-2441's merge commit 341994611 (commit 2a1522558): the decisions were the same,
four files differed in wording only and now carry 341994611's text. **The tree at 2a1522558 is byte-identical to the tree
at 341994611** (`git diff 341994611 2a1522558` is empty), so the two branches merge without a conflict in those files.

## Row 1 - map (313de7ca2)

- New `frontend/src/i18n/msg/map.ts`: `msgCatalogue('msg/map', { Hebrew: English })`, 185 texts.
- 25 files of `src/map/` import `tr` from it. Every Hebrew interface literal is now `tr('<the same Hebrew>')`: labels,
  titles and aria names of the 2D canvas and the 3D view, the 3D toolbar, the time pill, the walk messages, the room pills
  and their popover, the history layer names and statuses, the prepared-picture errors, and the label helpers
  (`candidates.ts`, `circuit-action.ts`, `connector-targets.ts`, `door-tool.ts`, `geometry.ts` captions, `history-replay.ts`,
  `quality-ladder.ts`, `quality-mode.ts`, `room-pills.ts`, `shared-space.ts`, `studio-controller.ts`, `sun.ts`,
  `walk-world.ts`, `webgl.ts`, `floor-finish.ts`, `look-style.ts`, `adjacent-cameras.ts`).
- String templates became placeholders: `` `${n} קירות ...` `` -> `tr('{n} קירות ...', { n })`. Where a sentence was glued
  from parts, the parts were joined into whole sentences per case (one wall / many walls), so English can order its words.
- Module-level tables (`RUNG_HE`, `TIME_BAND_HE`, `DOOR_STATE_HE`, `LAYER_NAME`, `QUALITY_MODE_LABEL`, `KIND_HE` ...) are
  filled with `tr()` when the module loads (rule 5 of the core note: the language switch reloads the page).
- Not touched: geometry, scene building, rendering, CSS. In `geometry.ts`, `sw-plan-canvas.ts` and `sw-plan-3d.ts` only the
  literals changed.
- Left as data, on purpose: `material-resolve.ts` `ROOM_FLOOR_RULES` - Hebrew keywords matched against a room's tags, never shown.

## Row 2 - plan wizard (55101e2ca)

- New `frontend/src/i18n/msg/plan-wizard.ts`: `msgCatalogue('msg/plan-wizard', ...)`, 203 texts.
- `plan-wizard.ts` (the seven steps, the replace dialog, the footer, the settings dialog) and `wizard-model.ts` (choices,
  room types, kits, placement words) read their texts through `tr()`.
- Left as data, on purpose (the new spec lists each with its reason):
  - `wizard-demo.ts` - the demo house (room, device and camera names, as a server would send them);
  - `wizard-model.ts` `words` - room-type keywords matched against area names;
  - `wizard-backend.ts` `WIZARD_NOTE` - stored on the plan version and compared on resume; translating it would hide a
    Hebrew-made draft from an English user and the other way round;
  - `wizard-model.ts` `fallbackRoomName` ("חדר 7") - the server gives the same name; the English hint quotes it as it is stored;
  - the demo file name in `plan-wizard.ts` `demoTo`.
- 08:F19: `plan-wizard.ts` `tint()` no longer casts `MATERIALS.find(...)` through `unknown` (`MaterialDef` declares `tint`);
  `wizard-backend.ts` `versionInfo()` takes `Pick<PlanVersion, ...>` with `image_url` instead of casting through `unknown`
  (`PlanVersion` declares it). No API type file was edited; run-time values are the same.

## Spec and glossary

- New `frontend/tests/unit-i18n-map-wizard-2441.spec.ts` (Node only, 5 cases): no Hebrew literal outside `tr()` in the two
  folders but for the listed data (read with the TypeScript parser, comments never count; an exception that matches nothing
  fails); every `tr()` text has its English with the same placeholders and no table entry is unused; every `tr()` call takes
  a plain literal; the sentences that were templates read in Hebrew exactly as before (16 pinned strings) and in English
  from the tables.
- `docs/i18n/GLOSSARY_EN.md`: a section "Map, 3D view and plan wizard" and three single-key compromises.

## Tests actually run (workstation, all `--workers=1`)

- `npx tsc --noEmit` (frontend): clean, on the final tree.
- Playwright unit config, Node specs: `unit-i18n-map-wizard-2441` + `unit-i18n-core` + `unit-nav-labels-2436` +
  `unit-ui-lang`: 28 passed (on the final tree, after the alignment).
- Playwright unit config, Node specs matching `unit-plan*` (incl. `unit-plan-wizard-2433`, `-2434`, `unit-plan3d-*`),
  `unit-circuit-action`, `unit-history-replay`, `unit-shared-space`, `unit-stairs`, `unit-studio-controller`,
  `unit-adjacent-cameras`, `unit-nav-labels`, `unit-ui-lang`, `unit-sun`, `unit-room*`, `unit-walk*`, `unit-candidates*`,
  `unit-door-tool*`, `unit-quality*`: 250 passed, 0 failed (before the alignment commit, which changed no file of these rows).
- Page unit specs (`SW_UNIT_PAGES=1`, against a Vite dev server of this worktree on a private port, stopped afterwards):
  - `unit-plan-canvas-state`, `unit-plan-detect`, `unit-plan-skin-control`, `unit-plan-editor-hot-2436`: 17 passed;
  - `unit-plan-3d*` (11 files) + `unit-plan3d-zoom`: 59 passed, 6 skipped (skips the specs declare themselves), 0 failed.
    `unit-plan-3d-view`'s own picture comparison reported 0 of 259,200 pixels differing in all 12 views.
- `node scripts/i18n_missing_keys.mjs` (summary only, not `--write`): runs; its printed summary names neither `msg/map` nor `msg/plan-wizard` (the per-module table was not read; the spec above checks completeness directly).

## NOT_RUN

- Pixel suites (`pixel-plan-wizard-2433`, `pixel-plan-wizard-2434`, the map / 3D pixel specs), evidence and layout suites:
  they need the built preview and the runner's baselines; no build was made here and the runner entry check is the lead's.
- The English interface was not looked at in a browser (no screenshot review of the English map or wizard).
- `docs/i18n/MISSING_KEYS_EN.md` / `.json` were not regenerated (`--write`): every area branch would rewrite the same file.
- ESLint, the bundle budget report, the backend.

## Pixels to refresh

None expected. Hebrew output is the argument of `tr()` itself; the pinned strings and the 3D view's own picture comparison
agree. No pixel spec was run locally, so this is by construction and by the unit runs above, not by a pixel run.

## For the lead

1. `fallbackRoomName` stays Hebrew ("חדר 7") in the English interface because the server names rooms the same way. If
   English users should get "Room 7", it is a server + client change (and a decision), not a text move.
2. `fmtWhen` in `plan-wizard.ts` still formats with `he-IL` (the base left the same literal in calendars); it belongs with
   the time / locale helpers (T9), not with this row.
3. `msg/map` is imported by small pure modules (`quality-mode.ts`, `webgl.ts`, `sun.ts` ...), so the table (about 12 kB of
   source) can land in whatever chunk first imports one of them, possibly the entry chunk. The bundle budget was not run here.
4. This spec carries its own small TypeScript reader because it needs the enclosing declaration's name for the data list;
   `frontend/tests/helpers/i18n-source-scan.ts` on CR-I18N-CAL-ELEC-2441 does the rest and could absorb it after both merge.
5. `docs/i18n/GLOSSARY_EN.md` is edited near its end by this branch; other area branches may touch the same lines.
