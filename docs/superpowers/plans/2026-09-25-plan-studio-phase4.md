# Plan Studio — Phase 4 (T087) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every map surface of the product gains a 2D / 3D toggle: the live floor map, the historical map and the event page (with a "מבט מהמצלמה" preset) show the published structure as a schematic scene - walls with their height and openings, library objects, levels as floor plates, connectors, cameras as a body with a translucent cone that stops at walls, Home Assistant entities with their live state (lamps glow, doors and locks open or locked) - built deterministically from the same document the 2D draws, selected in step with the 2D, controlled by the same permissions, exported as glTF; the building page draws a true isometric of every floor from its walls; the camera coverage of the 2D map stops at walls too.

**Architecture:** `frontend/src/map/scene-builder.ts` is a pure function: the document + the live anchors and states + the library + the zones → a sorted, JSON-serialisable *scene description* (parts with a shape, a position and a size in metres, a colour **token name**, an opacity, an instance-group key and the id of the item they stand for). No three.js is imported there, so a node spec pins the description of the shared fixture and of a synthetic document with 3,000 chairs. `frontend/src/map/scene-three.ts` realises a description with three (one `InstancedMesh` per group, `OrbitControls`, presets, picking, `GLTFExporter`) and is the only module that imports `three`; Vite puts the library in its own `three` chunk that the app fetches on the first click of the toggle (dynamic `import()`), so the 2D bundle does not grow and the Ingress relative-URL rule holds by construction (`base: './'`). The Lit element `sw-plan-3d` owns the canvas, the spinner, the presets and the export button; the screens build the description, pass the selected id in and take `part-select` events out - the entity action path (`trigger` → `runAction`) and the live tile are the existing ones. Coverage stopped by walls is one pure module, `frontend/src/map/coverage.ts` (ray casting against the wall parts of the camera's level), used by the 2D canvas and by the 3D cone. Migration 0021 adds `mount_height_m` and `tilt_deg` to `map_anchors`; the anchor panel edits them, the bundle carries them, the builder applies the defaults when they are null.

**Tech Stack:** FastAPI + SQLite on Python 3.12 (no backend dependency added), Lit 3 + TypeScript 5.9 (strict, `noUnusedLocals`), Vite 6 with `@rollup/wasm-node` (kept - Smart App Control blocks native rollup), Playwright 1.63. **One new runtime dependency:** `three` 0.186.1 (MIT, pure JavaScript) plus `@types/three` 0.186.0 as a dev dependency. Measured on this workstation before the plan was written: a Vite production build of `three` + `OrbitControls` + `GLTFExporter` with `manualChunks` yields a 629.6 KB chunk, **160.2 KB gzip** (limit 200 KB).

**Spec:** `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (sections 2, 2a, 4.1 - the `map_anchors` migration 0021 line - 4.2, 5, 7, 8, 10 whole, 12, 13, 14 row 4, 15, 16) and `docs/changes/CR-003-PLAN-STUDIO.md`. Task card: `management/tasks/T087.md` (R173 / AT173, R174 / AT174). Foundation: phases 1-3 (`docs/superpowers/plans/2026-09-23-plan-studio-phase1.md`, `2026-09-24-plan-studio-phase2.md`, `2026-09-24-plan-studio-phase3.md`; the tree is at the 0.1.86 merge, commit `0052701`).

## Rulings

Binding decisions from the controller (R-P4-1 … R-P4-12), recorded here verbatim or tighter; where a ruling narrows or extends the design document the difference is noted under "Interpretations and recorded differences" and nothing is silently resolved:

1. **R-P4-1 Scope** = design section 10 and section 14 row 4, nothing more: migration 0021 (`map_anchors.mount_height_m REAL NULL`, `tilt_deg REAL NULL`), `three` from npm in a separate manual chunk loaded only when the user opens 3D (dynamic `import()`; target ≤ 200 KB gzip for the chunk - measured from a real build and asserted by a node spec reading the built assets), a pure deterministic `frontend/src/map/scene-builder.ts` that turns the document + live states + tokens into a scene DESCRIPTION (a sorted JSON-serialisable list of parts: id, kind, shape, position `[x, y, z]` in metres, size, rotation, colour token, opacity, instance group, `userData {id, kind}`) with NO three.js import, a `frontend/src/map/scene-three.ts` that realises a description with three (`InstancedMesh` for repeated shapes, `OrbitControls`, presets top / isometric / "from camera X", `GLTFExporter`), a Lit element `sw-plan-3d`, the 2D / 3D toggle in the live floor map, the history map and the event page ("מבט מהמצלמה" preset from the event's camera), selection sync with the 2D (one shared selected id), layers as in 2D, level switch, cameras as a body + a translucent cone from `rotation_degrees` / `field_of_view_degrees` / `coverage_radius` with `tilt_deg` (default 10 down) and `mount_height_m`, live HA states (symbol colour by state; lamps glow + a weak point light when on; doors / locks open / locked), levels as floor plates at their heights, connectors (stairs = stepped boxes, elevator = translucent prism), room floors tinted from tokens, room-name sprites, a TRUE isometric view on the building page (SC03) built from the same description, glTF export through the existing download pattern (`exportJson` in the editor: a Blob, an `<a download>`), the key `3` toggles 3D, and the live states path unchanged.
2. **R-P4-2 Coverage stopped by walls** is ONE pure TypeScript module `frontend/src/map/coverage.ts` (ray casting from the anchor position within the FOV and radius against the document's wall segments at the anchor's level; returns a polygon in plan units) used by BOTH the 2D canvas (when the floor has structure on the camera's level, the drawn coverage is the clipped polygon; without structure the existing radius / polygon behaviour stays; a manual coverage polygon always wins) and the 3D cone (the cone is clipped to the same polygon as a flat wedge on the floor plus the volume above it up to the mount height, no CSG). Deterministic, unit-tested with walls in the four directions and an opening (a passage does not stop coverage; a closed door does; an open door - its `anchor_ref` entity in an open state - does not). No backend mirror in this phase (the SVG / PNG exports keep the unclipped coverage; the changelog states it as a known limit).
3. **R-P4-3 Openings in 3D by wall splitting**, not CSG (design decision 3), exactly as section 10.2 describes: the wall parts `buildPrimitives` already cuts at every opening become boxes; a door adds a lintel above `height_m`, a window a sill (0 … `sill_m`) and a head (`sill_m + height_m` … the wall's height), a passage nothing; the door leaf is a thin plate at 0° (closed) or 80° (open) by the entity state when the opening has an `anchor_ref` to a door / lock entity, else closed; a window is a translucent plate.
4. **R-P4-4 Determinism and tests:** the scene description of `contracts/fixtures/plan_geometry/sample-v2.json` (with a fixed set of anchors and states written in the spec) is pinned as `contracts/fixtures/plan_geometry/sample-v2.scene.json` by the node spec `frontend/tests/unit-scene-builder.spec.ts` with a `SCENE_WRITE=1` regeneration path, plus a synthetic document built in the test with levels, connectors, a tribune (stepped), cylinders, an extruded polygon, a composite item, 3,000 chairs (asserting the instance group and that the part count stays bounded), cameras with cones, lamps on / off; every existing test suite stays green (backend, node unit specs, the Python golden, the fixture chain, the phase 1-3 live specs). Screenshots are for humans only; assertions are on the description and on the DOM (data attributes on the toggle, the presets, the selected part id echoed into a `data-selected` attribute, the export button producing a Blob of a glTF JSON whose `asset.generator` and node count are asserted through a stubbed download).
5. **R-P4-5 Performance:** one `InstancedMesh` per instance group; a distance-based hide of small objects above 3,000 parts; a live test in real Chrome measures frames over 2 s with `requestAnimationFrame` on the sample document and on a 3,000-chair document and records the fps in the report (asserts ≥ 20 fps as a loose floor so a loaded machine does not flake; the design target 30 fps phone / 60 desktop is reported, not asserted). The 3D never blocks the 2D: the chunk is imported on the first toggle with a spinner, and the 2D stays usable if WebGL is unavailable (a Hebrew message "תלת-ממד לא זמין בדפדפן זה" and the toggle disabled).
6. **R-P4-6 Interaction:** a click on a part selects it and the 2D selection follows (and the reverse); hover shows the label; a click on a lamp that belongs to a circuit runs the EXISTING entity action path with its permission and confirm (`ha.entity.control`, the same `trigger` the circuit strip uses) - no new HA write path; a click on a camera opens the existing card with the live tile; the live test that toggles a lamp answers the action route with `page.route` so nothing reaches Home Assistant (ruling R-P2-T13-1).
7. **R-P4-7 Phone:** the toggle sits in the phone tool row; `OrbitControls` with touch (one finger rotates, two fingers zoom and pan); the panel rules of phase 2 apply; no sideways scroll at 390 px; the chunk still loads on demand only.
8. **R-P4-8 Anchor fields:** `mount_height_m` and `tilt_deg` editable in the existing anchor panel (`placement.edit`), validated server-side (mount 0-30 m, tilt -90 … 90), present in the bundle and in every anchor response; defaults when null, applied by the clients and never stored: camera 2.5 m / 10°, door station (an `ha_entity` anchor on the `doors` layer) 1.4 m / 0°, every other entity 1.2 m / 0°; audited as the other anchor fields (`anchor.update` before / after).
9. **R-P4-9 Lovelace card:** the card (`smplwise_vms/integration/smplwise_bridge/www/smplwise-card.js`) embeds the add-on's own Ingress page in an iframe (`<ingress_url>/#/explore/floors/<id>?embed=1`), so the map view is the same `explore-floor-map` element and the toggle works there with no card change; the chunk resolves relative to the page because the build uses `base: './'` and the dynamic import is relative to the entry module. The plan states this mechanism and tests it: a backend test asserts that the built entry (`smplwise_vms/www/index.html` and `www/assets/index-*.js`) references its assets relatively and that the `three-*.js` chunk is present and never referenced by an absolute `/assets/` path; the live spec opens the map with `embed=1` and toggles 3D (the optional live check).
10. **R-P4-10 Versions and records:** phase 4 ships as 0.1.87; the release task (last) bumps the three version files, regenerates the API inventory, writes the CHANGELOG (with the known limits), records T087 as an evidence line "on commit <sha>" while it stays BACKLOG (the registry refuses DONE while T084 is BACKLOG), AT173 / AT174 PASS only for what ran, runs `scripts/project_status.py --write`, writes the owner checklist `docs/operations/PLAN_STUDIO_PHASE4_CHECKLIST_HE.md` with as FEW rows as possible - only what an automated test cannot verify (the look on the owner's real screen and phone GPU, their real plan) - and every row names the automated test that already covers the mechanics. The release task stops after the release commit (no merge / push / reload).
11. **R-P4-11 Model policy and tooling:** implementers on sonnet where the plan carries the complete code (Tasks 1, 3, 9, 11), opus for the builder, the three realisation, the screens and the live spec (Tasks 2, 4, 5, 6, 7, 8, 10); reviewers opus for the builder / three / screens, sonnet for small diffs; the final whole-branch review on fable. Every commit step: `bash /c/cloude/smplwisebms/secrets/scan_staged.sh` prints `0`; message in a UTF-8 file without BOM, `git commit -F`, English, no apostrophes, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Python is `MSYS_NO_PATHCONV=1 C:/cloude/smplwisebms/.venv/Scripts/python.exe`, pytest `-p no:cacheprovider` never `-q`; Node via `export PATH="/c/Users/jon/AppData/Roaming/fnm/node-versions/v24.21.0/installation:$PATH"`; the dev backend serves `smplwise_vms/www` on 8099 (`$SP/restart_dev.sh`); live specs run against `npm run preview` on 4173 after `npm run build` (each live step says so); one live run at a time.
12. **R-P4-12 Out of scope:** quality level 2 (PBR, shadows, textures), the eye-level tour, a backend 3D export, clipping the SVG / PNG coverage, editing geometry in 3D. Also out (not asked, not built): a 3D toggle in the plan editor, a `tilt_deg` control for entities (see interpretations), and any change to the HA action route, the map bundle's shape beyond the two anchor fields, or the geometry document.

**Interpretations and recorded differences** (each is applied consistently through the plan):

- *Anchor defaults vs design 4.1.* The design line names camera 2.7 m / 10°, a lamp "ceiling − 0.1 m", a lock 1.0 m and a sensor 2.2 m; ruling R-P4-8 fixes camera 2.5 m / 10°, door station 1.4 m / 0°, others 1.2 m / 0°. The ruling is implemented (one table, `frontend/src/map/anchor-3d.ts`); the design line is corrected in the implementation line of Task 11. A lamp that has a body object takes the body's height (`z_m` from the item: ceiling items carry a negative offset from the ceiling), not the anchor default.
- *Instance groups.* R-P4-5 says "per (shape, size, colour)". The realisation keys a group by `(shape, colour token, opacity)` and puts the size in each instance's matrix (a unit box / unit cylinder scaled per instance): the same picture with far fewer draw calls when 2,000 wall parts all have different lengths. The 3,000 identical chairs land in one group either way; the node spec asserts that group and the bounded part count.
- *Windows block coverage.* R-P4-2 fixes passages (open) and doors (closed unless the entity is open). Glass is treated as opaque for coverage planning (a camera behind a window promises nothing about the far side); recorded in the changelog line about coverage.
- *Tilt in the panel.* R-P4-8 makes both fields editable in the anchor panel. The camera inspector gets both; the entity inspector gets the mount height only (a tilt on a lock or a sensor has no reading in the schematic scene), while the route accepts both for every anchor.
- *Wall colour in 3D.* Design 10.2 says the style comes from tokens. Walls use `--sw-map-structure`, railings and low walls `--sw-map-wall`, glass `--sw-map-glass`, door leaves and cones `--sw-accent`, floor plates `--sw-map-bg`, room tints `--sw-accent` at 10 %, objects `--sw-obj-<token>`, a lamp that is on `--sw-map-glow`, entity symbols `--sw-live` / `--sw-text-3` / `--sw-stale` by state, offline cameras `--sw-offline`. `tokens.css` has no dark theme (only the default and `data-design="a"`), so "both themes" means those two: the description carries token names only and `scene-three` reads the computed values of the element, so a future theme needs no change here.
- *Where the "from camera" preset comes from on the event page.* The event's `location.anchor_id` names the camera's anchor; the preset places the virtual camera at that anchor's position and mount height, looking along its bearing and tilt.
- *Stairs and ramps.* Stairs, ladders and ramps are stepped boxes along the connector's polyline between the two elevations (a ramp gets a finer step); a bent polyline is approximated by its first-to-last direction; an elevator is a translucent prism from the lower elevation to the upper level's ceiling; a tribune connector (derived from an object) draws nothing itself - its object does.
- *The event page live test needs a real event.* The developer backend holds events only when the NVR delivered them; the live spec looks for an event with `location.has_plan` and records NOT_RUN for that test when there is none (the preset code path is exercised on the history map with `?camera=` in the same spec, which needs no event).
- *`polygonCentroid`* lives in `sw-plan-canvas.ts` (a Lit module); the builder re-implements the same centroid so it stays importable in node.
- *Duplicate code noticed, not touched:* `routers/anchors.py` defines `RealignIn` / `realign_anchors` twice (lines 291-368) and `AnchorIn` / `AnchorPatch` repeat their `label_pos` line; Task 3 edits the first `AnchorIn` / `AnchorPatch` fields and leaves the duplicates alone (out of scope; reported to the controller).

## Global Constraints

- Geometry contract: coordinates normalized 0..1 to the plan **version image**, origin top-left, points stored as `[x, y]` arrays; angles 0° = up, clockwise; sizes in metres. 3D axes (design 17.1): x east = plan x, z south = plan y (down in the plan = +z), y up; metres from the document's effective scale (`effectiveScale`: the calibration, else the estimate `0.2 m / (0.006 × width_px)` flagged `estimated`, shown as "≈ משוער").
- Nothing automatic is published; viewers see the published document only. Permissions (VMS, floor scope): `map.read` = view 2D and 3D, `placement.edit` = the anchor fields, `ha.entity.control` (+ grants) = every action from 3D through the existing route; nothing new.
- Determinism: the scene description rounds every metre value half-up to 0.0001 (`r4`), sorts parts by id, and carries token names, never colours; the same document + anchors + states → the same JSON (the node spec asserts it twice).
- Migrations are additive only (0021 adds two nullable columns). Backups already include `map_anchors`.
- UI copy in Hebrew; code, comments and commit messages in English.
- Commits: message in a temp file (UTF-8, no BOM), `git commit -F`; trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; before every commit `bash /c/cloude/smplwisebms/secrets/scan_staged.sh` must print `0` (the script is in the gitignored `secrets/`; never copy its pattern into a tracked file). No apostrophes in commit messages.
- Branch: `pilot/T087-plan-studio-4` (created from `g0/intake` at the 0.1.86 merge; `git status` clean before Task 1). The release task ends at the release commit; the controller merges and pushes.
- Commands (Git Bash on Windows):
  - `SP=C:/Users/jon/AppData/Local/Temp/claude/C--cloude-smplwisebms/bd61f90d-850a-444f-9da9-92c50c272bc2/scratchpad` - the session scratchpad; it holds `fixture_chain.sh`, `restart_backend.ps1` and `restart_dev.sh` (the phase-3 plan shows how to recreate `restart_dev.sh` if it is missing).
  - "Restart the developer backend" means `bash "$SP/restart_dev.sh"` (expect `me: 200` and a new listener pid; an old process can survive on 8099 - `powershell -NoProfile -Command "Stop-Process -Id <pid>"` and run it again).
  - `PY=C:/cloude/smplwisebms/.venv/Scripts/python.exe`
  - Backend tests: `cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest <files> -p no:cacheprovider` (never `-q`).
  - Node: `export PATH="/c/Users/jon/AppData/Roaming/fnm/node-versions/v24.21.0/installation:$PATH"`; in `/c/cloude/smplwisebms/frontend`: `npx tsc --noEmit -p tsconfig.json`, `npm run build`, `npx playwright test <spec> --project=desktop --workers=1 --reporter=line`.
  - Live specs (`SW_LIVE=1 SW_CHROME=1`) need the developer backend on 8099 (restart it after any backend change) and a fresh `npm run build` (the preview on 4173 serves `frontend/dist` and proxies `/api` to 8099). One live run at a time.
  - Demo fixture chain (only when a demo-visible component changed - Task 6 changes the floor map, Task 8 the building page): `bash "$SP/fixture_chain.sh"` → `fixtures exit: 0` and the same passed count as the phase-3 release run.
  - Never edit version files while a background pytest run is in progress. Run `scripts/dev_cleanup.ps1 -StopBackend` when a batch of live specs is done.
- Test counts: the backend suite has 353 `def test_` at the branch base (phase-3 release: see `$SP/pytest_0185.txt` for the passed count of that run); Task 11 reads the real number from its own pytest output file. The node specs at the base: `unit-geometry`, `unit-geometry-2`, `unit-studio-controller`, `unit-studio-ops-2`, `unit-plan-detect`.
- Private material: the plan never names a lab host, address, serial or token; the evidence lines quote counts and timings only.

---

## File Structure

**Backend — create**
- `smplwise_vms/backend/smplwise/migrations/0021_anchor_3d.sql` — `map_anchors.mount_height_m`, `tilt_deg`.
- `smplwise_vms/backend/tests/test_anchor_3d.py` — the migration, the fields, validation, clearing, the bundle, the audit.

**Backend — modify**
- `smplwise_vms/backend/smplwise/routers/anchors.py` — `anchor_row`, `AnchorIn`, `AnchorPatch`, the insert, `NULLABLE_KEYS`.
- `smplwise_vms/backend/tests/test_lovelace_card.py` — the built UI references its assets relatively; the three chunk exists and is never absolute.

**Frontend — create**
- `frontend/src/map/webgl.ts` — the WebGL availability gate and its Hebrew message.
- `frontend/src/map/three-bundle.ts` — the one module that imports `three` and its two addons (the chunk boundary).
- `frontend/src/map/coverage.ts` — blocking segments, ray casting, the clipped coverage polygon.
- `frontend/src/map/anchor-3d.ts` — the mount / tilt defaults per anchor kind.
- `frontend/src/map/scene-builder.ts` — the scene description and the isometric projection (no three).
- `frontend/src/map/scene-three.ts` — the three realisation: `SceneView`.
- `frontend/src/map/sw-plan-3d.ts` — the Lit element (spinner, presets, export, data attributes).
- `contracts/fixtures/plan_geometry/sample-v2.scene.json` — the pinned description (generated by the spec with `SCENE_WRITE=1`).
- Tests: `frontend/tests/unit-three-chunk.spec.ts`, `unit-coverage.spec.ts`, `unit-anchor-3d.spec.ts`, `unit-scene-builder.spec.ts`, `evidence-plan-studio-4.spec.ts` (live).

**Frontend — modify**
- `frontend/package.json`, `frontend/package-lock.json` — `three`, `@types/three`.
- `frontend/vite.config.ts` — `manualChunks` for `three`.
- `frontend/src/api/types.ts`, `frontend/src/api/maps.ts` — `mount_height_m`, `tilt_deg`.
- `frontend/src/api/plan-catalog.ts` — `CatalogItem.mesh`, `lookup3dOf`.
- `frontend/src/map/sw-plan-canvas.ts` — `PlanMarker.level`, the clipped coverage drawing.
- `frontend/src/screens/explore-plan-editor.ts` — the two fields in the camera / entity inspectors; the save.
- `frontend/src/screens/explore-floor-map.ts` — the toggle, the key `3`, the 3D stage, selection sync, layers, level, live states, actions, phone rules.
- `frontend/src/screens/investigate-history-map.ts`, `investigate-event-detail.ts` — the toggle and the "from camera" preset.
- `frontend/src/components/sw-floor-iso.ts`, `frontend/src/screens/explore-floors.ts` — the true isometric.
- `frontend/src/components/sw-icon.ts` — `cube`.

**Release**
- `smplwise_vms/config.yaml`, `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` (0.1.87), `smplwise_vms/CHANGELOG.md`, `contracts/API_INVENTORY.md` (generated), `smplwise_vms/www/` (generated by `build:addon`), `management/tasks.json`, `management/test_catalog.json` and the generated views, `docs/operations/PLAN_STUDIO_PHASE4_CHECKLIST_HE.md`, `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (implementation line), `docs/changes/CR-003-PLAN-STUDIO.md` (status line).

---

### Task 1: `three` as a dependency, the manual chunk, the WebGL gate and the chunk-size check

**Files:**
- Modify: `frontend/package.json` (dependencies, devDependencies), `frontend/package-lock.json` (by `npm install`)
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/map/three-bundle.ts`
- Create: `frontend/src/map/webgl.ts`
- Test: `frontend/tests/unit-three-chunk.spec.ts`

**Interfaces:**
- Consumes: nothing from this phase.
- Produces:
  - `three-bundle.ts`: `export * from 'three'; export { OrbitControls } ...; export { GLTFExporter } ...` - the ONLY module in `src/` that names `three`; Task 5 imports from it.
  - `webgl.ts`: `webglAvailable(): boolean` (cached per page), `resetWebglCheck(): void`, `WEBGL_UNAVAILABLE_HE = 'תלת-ממד לא זמין בדפדפן זה'`.
  - `vite.config.ts`: every module under `node_modules/three/` lands in the chunk named `three` (`dist/assets/three-<hash>.js`).
  - The spec's programmatic build helper (`buildProbe`) that Task 5 reuses for the `dist/assets` assertion.

- [ ] **Step 1: Write the failing test**

`frontend/tests/unit-three-chunk.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// Plan Studio phase 4 (T087, design 10.1): three.js lives in a chunk of its own, loaded only when someone opens 3D, and
// that chunk stays under 200 KB gzip. Runs in node: the first test builds the chunk boundary module alone with the same
// Vite + wasm rollup the app uses (no dist needed); the second reads the app's own dist when it exists (Task 5 adds it).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, '..');
const LIMIT_GZIP = 200 * 1024;

export const gzipBytes = (file: string): number => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;

/** Build one entry through Vite into a fresh temp folder and return the emitted asset file names with their gzip sizes. */
export async function buildProbe(entry: string): Promise<{ dir: string; files: { name: string; gzip: number }[] }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-three-probe-'));
  await build({
    configFile: false,
    root: FRONTEND,
    logLevel: 'silent',
    build: {
      outDir: dir,
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      rollupOptions: { input: entry, output: { manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined) } },
    },
  });
  const assets = path.join(dir, 'assets');
  const files = fs.readdirSync(assets).filter((f) => f.endsWith('.js')).map((name) => ({ name, gzip: gzipBytes(path.join(assets, name)) }));
  return { dir, files };
}

test('the three chunk built from the bundle module is separate and under 200 KB gzip', async () => {
  test.setTimeout(120_000);
  const { dir, files } = await buildProbe(path.join(FRONTEND, 'src', 'map', 'three-bundle.ts'));
  try {
    const three = files.filter((f) => /^three-[\w-]+\.js$/.test(f.name));
    expect(three, `one three chunk among ${files.map((f) => f.name).join(', ')}`).toHaveLength(1);
    console.log(`three chunk: ${three[0].name} ${three[0].gzip} bytes gzip`);
    expect(three[0].gzip).toBeLessThanOrEqual(LIMIT_GZIP);
    expect(three[0].gzip).toBeGreaterThan(50 * 1024); // a chunk this small would mean three was not bundled at all
    const entry = files.find((f) => /^three-bundle-[\w-]+\.js$/.test(f.name));
    expect(entry, 'the boundary module itself is a tiny re-export').toBeTruthy();
    expect(entry!.gzip).toBeLessThan(4 * 1024);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /c/cloude/smplwisebms/frontend && npx playwright test tests/unit-three-chunk.spec.ts --project=desktop --reporter=line`
Expected: FAIL - the build throws (`three-bundle.ts` does not exist / `three` cannot be resolved).

- [ ] **Step 3: Install the dependency and add the chunk boundary**

```bash
cd /c/cloude/smplwisebms/frontend && npm install three@0.186.1 --save-exact=false --no-audit --no-fund && npm install --save-dev @types/three@0.186.0 --no-audit --no-fund
grep -n '"three"\|"@types/three"' package.json
```

Expected: `"three": "^0.186.1"` under `dependencies` and `"@types/three": "^0.186.0"` under `devDependencies`; `package-lock.json` updated; `rollup` stays aliased to `@rollup/wasm-node` (do not touch the `overrides` block).

`frontend/src/map/three-bundle.ts`:

```ts
/**
 * The chunk boundary of the 3D view (T087, design 10.1): the only module under src/ that imports three. Vite's
 * manualChunks (vite.config.ts) puts everything under node_modules/three into the `three` chunk, and scene-three.ts
 * imports from here, so the library reaches the browser only through the dynamic import of sw-plan-3d - the 2D bundle
 * does not grow, and with `base: './'` the chunk URL stays relative (the Ingress rule).
 */
export * from 'three';
export { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
```

`frontend/vite.config.ts` (whole file):

```ts
import { defineConfig } from 'vite';

// `base: './'` keeps every asset URL relative so the same build works under the HA Ingress
// prefix (/api/hassio_ingress/<token>/) and on a plain dev server.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        // Plan Studio 3D (T087): three.js in a chunk of its own, fetched only by the dynamic import of sw-plan-3d.
        manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined),
      },
    },
  },
  server: {
    // Dev loop: the FastAPI backend runs on 8099 (`python -m smplwise` with SW_DEV_USER); the UI on 5173.
    // `ws: true` forwards the live-video WebSocket relay (/api/v1/media/live/<id>/ws) as well.
    proxy: { '/api': { target: 'http://127.0.0.1:8099', ws: true }, '/healthz': 'http://127.0.0.1:8099' },
  },
  preview: {
    proxy: { '/api': { target: 'http://127.0.0.1:8099', ws: true }, '/healthz': 'http://127.0.0.1:8099' },
  },
});
```

`frontend/src/map/webgl.ts`:

```ts
/**
 * WebGL availability (T087, ruling R-P4-5): the 3D toggle is disabled with a Hebrew note when the browser gives no
 * context, and the 2D map stays as it is. Checked once per page (creating contexts is not free).
 */
export const WEBGL_UNAVAILABLE_HE = 'תלת-ממד לא זמין בדפדפן זה';

let known: boolean | null = null;

export function webglAvailable(): boolean {
  if (known !== null) return known;
  try {
    const canvas = document.createElement('canvas');
    known = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    known = false;
  }
  return known;
}

/** Forget the cached answer (tests). */
export function resetWebglCheck(): void {
  known = null;
}
```

- [ ] **Step 4: Run the test and the type check**

Run: `cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && npx playwright test tests/unit-three-chunk.spec.ts --project=desktop --reporter=line`
Expected: `tsc` exit 0; `1 passed`, with a line like `three chunk: three-XXXX.js 160xxx bytes gzip` (the measured value was 160,222; anything up to 204,800 passes). Then `npm run build` → exit 0 and NO `three-*.js` in `dist/assets` yet (nothing imports the boundary module; the app bundle is unchanged - confirm with `ls dist/assets`).

- [ ] **Step 5: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/map/three-bundle.ts frontend/src/map/webgl.ts frontend/tests/unit-three-chunk.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
build(plan-studio): three 0.186 as an on-demand chunk with a size check and the WebGL gate (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 2: Coverage stopped by walls — `coverage.ts` and the clipped cone on the 2D canvas

**Files:**
- Create: `frontend/src/map/coverage.ts`
- Modify: `frontend/src/map/sw-plan-canvas.ts` (`PlanMarker.level`, the `clipCoverage` property, the clipped polygon in `renderMarker`)
- Modify: `frontend/src/screens/explore-floor-map.ts`, `investigate-history-map.ts`, `investigate-event-detail.ts` (the markers carry their level)
- Test: `frontend/tests/unit-coverage.spec.ts`

**Interfaces:**
- Consumes: `buildPrimitives`, `r2`, `Pt`, `GeometryDoc`, `CatalogLookup` from `geometry.ts`; `defaultLevelId` from `studio-ops.ts`.
- Produces (used by Task 4's builder and Task 2's canvas):
  - `interface Seg { a: Pt; b: Pt }` (plan pixels).
  - `OPEN_STATES`, `isOpenState(state): boolean`.
  - `blockingSegments(doc, W, H, level: string, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Seg[]`.
  - `raySegment(o: Pt, d: Pt, a: Pt, b: Pt): number | null` (distance along the unit ray, or null).
  - `clipCoverage(origin: Pt, rotationDeg, fovDeg, radiusPx, segs: Seg[], rays?: number): Pt[]` (plan pixels; the origin first unless the field is a full circle; one point per ray, `rays = max(24, ceil(fov))`; rounded `r2`).
  - `coveragePolygon(m: CoverageMarker, doc, W, H, entityStates, catalog?): Pt[]` (normalized 0..1, rounded to 5 decimals) with `interface CoverageMarker { x; y; rotation; fov; radiusPx; level: string }`.
  - `hasWallsOnLevel(doc, level): boolean`.
  - `PlanMarker.level?: string` on the canvas; the canvas draws `<polygon class="fov" data-cov-clipped>` when the marker's level has walls and no manual polygon.

- [ ] **Step 1: Write the failing test**

`frontend/tests/unit-coverage.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import type { GeometryDoc, GeomOpening, GeomWall, Pt } from '../src/map/geometry';
import { blockingSegments, clipCoverage, coveragePolygon, hasWallsOnLevel, isOpenState, raySegment } from '../src/map/coverage';

// Plan Studio phase 4 (T087, ruling R-P4-2): camera coverage stops at the walls of the camera's level - a passage lets a
// ray through, a closed door and a window stop it, an open door (its entity in an open state) lets it through. Node only.
const W = 1000;
const H = 800;

const wall = (id: string, polyline: Pt[], level = 'L0'): GeomWall => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
const opening = (id: string, wall_id: string, kind: GeomOpening['kind'], anchor: string | null = null): GeomOpening => ({ id, wall_id, t: 0.5, kind, width_m: 0.9, height_m: 2.1, sill_m: kind === 'window' ? 0.9 : 0, swing: kind === 'door' ? 'left' : 'none', hinge: 'start', anchor_ref: anchor ? { resource_type: 'ha_entity', resource_id: anchor } : null, confidence: 1, source: 'manual', external_ids: {} });

/** A closed room 0.2..0.8 x 0.3..0.7 around the plan centre; the camera sits at (0.5, 0.5). 1 m = 100 px. */
function doc(openings: GeomOpening[] = [], extraWalls: GeomWall[] = []): GeometryDoc {
  return {
    schema_version: '2.0', plan_version_id: 'v', floor_id: 'f', source: { sha256: '', file_name: 'p.png', mime: 'image/png', page: 1 },
    dimensions: { width_px: W, height_px: H, scale_m_per_px: 0.01, calibration: { status: 'measured', method: 'two_point', pairs: [], residual_pct: 0, reason: null } },
    transform: { rotation: 0, crop: null },
    levels: [{ id: 'L0', name: 'ראשי', elevation_m: 0, ceiling_height_m: 3, is_default: true }, { id: 'L1', name: 'תחתון', elevation_m: -1.2, ceiling_height_m: 6, is_default: false }],
    walls: [wall('n', [[0.2, 0.3], [0.8, 0.3]]), wall('e', [[0.8, 0.3], [0.8, 0.7]]), wall('s', [[0.8, 0.7], [0.2, 0.7]]), wall('w', [[0.2, 0.7], [0.2, 0.3]]), ...extraWalls],
    openings, rooms: [], objects: [], circuits: [], connectors: [], labels: [], groups: [], uncertain_regions: [], uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'test', tokens_version: 'map-1', detector_version: null },
  };
}

const origin: Pt = [W / 2, H / 2];
/** The point the ray at `bearing` reaches in a full-circle clip (360 rays: index = bearing + 180). */
const at = (pts: Pt[], bearing: number): Pt => pts[((bearing + 180) % 360 + 360) % 360];

test('ray against segment: hit distance, misses behind, beside and parallel', () => {
  expect(raySegment([0, 0], [1, 0], [5, -1], [5, 1])).toBeCloseTo(5, 9);
  expect(raySegment([0, 0], [1, 0], [-5, -1], [-5, 1])).toBeNull(); // behind the origin
  expect(raySegment([0, 0], [1, 0], [5, 1], [5, 3])).toBeNull(); // beside the ray
  expect(raySegment([0, 0], [1, 0], [5, 0], [9, 0])).toBeNull(); // parallel
  expect(raySegment([0, 0], [0, -1], [-1, -4], [1, -4])).toBeCloseTo(4, 9); // up (plan y down): bearing 0
});

test('walls in the four directions stop the rays; the corners of the room are the farthest points', () => {
  const segs = blockingSegments(doc(), W, H, 'L0', {});
  expect(segs.length).toBe(4);
  const pts = clipCoverage(origin, 0, 360, 400, segs);
  expect(pts.length).toBe(360); // one per degree, no origin in a full circle, the closing ray not repeated
  expect(at(pts, 0)).toEqual([500, 240]); // north wall at y = 0.3 * 800
  expect(at(pts, 90)).toEqual([800, 400]); // east wall at x = 0.8 * 1000
  expect(at(pts, 180)).toEqual([500, 560]);
  expect(at(pts, 270)).toEqual([200, 400]);
  const far = Math.max(...pts.map((p) => Math.hypot(p[0] - origin[0], p[1] - origin[1])));
  expect(far).toBeLessThanOrEqual(Math.hypot(300, 160) + 1);
  // a narrow field: the origin comes first and the fan has fov + 1 points after it
  const fan = clipCoverage(origin, 90, 60, 400, segs);
  expect(fan[0]).toEqual([500, 400]);
  expect(fan.length).toBe(62);
  expect(fan.every((p) => p[0] <= 800.01)).toBe(true);
});

test('without walls the arc is the plain radius', () => {
  const pts = clipCoverage(origin, 0, 90, 140, []);
  expect(pts[0]).toEqual([500, 400]);
  for (const p of pts.slice(1)) expect(Math.hypot(p[0] - 500, p[1] - 400)).toBeCloseTo(140, 1);
});

test('a passage lets the ray through, a closed door and a window stop it, an open door lets it through', () => {
  const north = (o: GeomOpening | null, states: Record<string, string | null> = {}) => at(clipCoverage(origin, 0, 360, 400, blockingSegments(doc(o ? [o] : []), W, H, 'L0', states)), 0);
  expect(north(null)).toEqual([500, 240]);
  expect(north(opening('p', 'n', 'passage'))).toEqual([500, 0]); // through the gap to the radius (y = 400 - 400)
  expect(north(opening('d', 'n', 'door'))).toEqual([500, 240]); // a door without an entity is closed
  expect(north(opening('d', 'n', 'door', 'lock.front'), { 'lock.front': 'locked' })).toEqual([500, 240]);
  expect(north(opening('d', 'n', 'door', 'lock.front'), { 'lock.front': 'unlocked' })).toEqual([500, 0]);
  expect(north(opening('d', 'n', 'door', 'binary_sensor.front'), { 'binary_sensor.front': 'on' })).toEqual([500, 0]);
  expect(north(opening('g', 'n', 'window'))).toEqual([500, 240]);
  expect(isOpenState('open') && isOpenState('unlocked') && isOpenState('on') && isOpenState('opening')).toBe(true);
  expect(isOpenState('closed') || isOpenState('locked') || isOpenState('off') || isOpenState(null) || isOpenState(undefined)).toBe(false);
});

test('only the walls of the camera level block; the normalized polygon is rounded and deterministic', () => {
  const d = doc([], [wall('lower', [[0.45, 0.35], [0.55, 0.35]], 'L1')]); // a wall on the lower level, right in front of the camera
  expect(hasWallsOnLevel(d, 'L0') && hasWallsOnLevel(d, 'L1') && !hasWallsOnLevel(d, 'L2')).toBe(true);
  const m = { x: 0.5, y: 0.5, rotation: 0, fov: 90, radiusPx: 400, level: 'L0' };
  const a = coveragePolygon(m, d, W, H, {});
  expect(a[0]).toEqual([0.5, 0.5]);
  expect(a[46]).toEqual([0.5, 0.3]); // the middle ray (bearing 0) stops at the north wall, not at the lower level's wall
  expect(coveragePolygon({ ...m, level: 'L1' }, d, W, H, {})[46]).toEqual([0.5, 0.35]);
  expect(JSON.stringify(coveragePolygon(m, d, W, H, {}))).toBe(JSON.stringify(a));
  expect(a.every((p) => String(p[0]).length <= 7 && String(p[1]).length <= 7)).toBe(true); // 5 decimals at most
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /c/cloude/smplwisebms/frontend && npx playwright test tests/unit-coverage.spec.ts --project=desktop --reporter=line`
Expected: FAIL - `Cannot find module '../src/map/coverage'`.

- [ ] **Step 3: Write `coverage.ts`**

`frontend/src/map/coverage.ts`:

```ts
/**
 * Coverage stopped by walls (T087, design 2a "כיסוי מצלמות", ruling R-P4-2): rays from a camera position, across its
 * field of view and up to its radius, against the walls of its level. What a ray hits first ends it - a wall, a window,
 * a closed door; a passage and a door whose entity is in an open state let it through. Planning information, not a
 * promise that nothing is hidden. Pure maths in plan pixels, used by the 2D canvas and by the 3D cone alike, so both
 * draw the same polygon; the SVG / PNG exports keep the unclipped cone (a known limit of this phase).
 */
import { buildPrimitives, r2, type CatalogLookup, type GeometryDoc, type Pt } from './geometry';

export interface Seg {
  a: Pt;
  b: Pt;
}

export interface CoverageMarker {
  x: number;
  y: number;
  rotation: number;
  fov: number;
  radiusPx: number;
  level: string;
}

/** Entity states that leave a door open for a ray (lock unlocked, cover / door open, a binary door sensor on). */
export const OPEN_STATES: readonly string[] = ['open', 'opening', 'unlocked', 'on'];
export const isOpenState = (state: string | null | undefined): boolean => !!state && OPEN_STATES.includes(state);

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;

export function hasWallsOnLevel(doc: Pick<GeometryDoc, 'walls'>, level: string): boolean {
  return doc.walls.some((w) => w.level_id === level && w.polyline.length >= 2);
}

/** The segments that stop a ray on one level: every wall part (buildPrimitives already cuts the walls at their openings)
 * plus the gap of every opening that blocks - a window, and a door unless its entity is open. Openings of walls on other
 * levels never reach the primitives (their wall is filtered out), so no second level check is needed here. */
export function blockingSegments(doc: GeometryDoc, W: number, H: number, level: string, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Seg[] {
  const out: Seg[] = [];
  const openings = new Map(doc.openings.map((o) => [o.id, o]));
  for (const p of buildPrimitives(doc, W, H, level, catalog)) {
    if (p.kind === 'wall') {
      for (let i = 1; i < p.points.length; i++) out.push({ a: p.points[i - 1], b: p.points[i] });
    } else if (p.kind === 'window') {
      out.push({ a: p.gap[0], b: p.gap[1] });
    } else if (p.kind === 'door') {
      const ref = openings.get(p.id)?.anchor_ref;
      const open = !!ref && ref.resource_type === 'ha_entity' && isOpenState(entityStates[ref.resource_id]);
      if (!open) out.push({ a: p.gap[0], b: p.gap[1] });
    }
  }
  return out;
}

/** Distance along the ray (origin o, unit direction d) to the segment ab, or null when the ray misses it. */
export function raySegment(o: Pt, d: Pt, a: Pt, b: Pt): number | null {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const den = d[0] * ey - d[1] * ex;
  if (Math.abs(den) < 1e-12) return null;
  const wx = a[0] - o[0];
  const wy = a[1] - o[1];
  const t = (wx * ey - wy * ex) / den;
  const u = (wx * d[1] - wy * d[0]) / den;
  if (t < 0 || u < -1e-9 || u > 1 + 1e-9) return null;
  return t;
}

/** The coverage polygon in plan pixels: the origin first (unless the field is a full circle), then one point per ray
 * from `rotation - fov / 2` to `rotation + fov / 2` (bearing 0 = up, clockwise), each stopped by the nearest segment or
 * by the radius. `rays` defaults to one per degree (at least 24). Rounded half-up to 0.01 px like every primitive. */
export function clipCoverage(origin: Pt, rotationDeg: number, fovDeg: number, radiusPx: number, segs: Seg[], rays?: number): Pt[] {
  const fov = Math.max(1, Math.min(360, fovDeg));
  const n = Math.max(1, rays ?? Math.max(24, Math.ceil(fov)));
  const pts: Pt[] = fov < 360 ? [[r2(origin[0]), r2(origin[1])]] : [];
  const last = fov < 360 ? n : n - 1; // a full circle: the last ray would repeat the first
  for (let i = 0; i <= last; i++) {
    const bearing = rotationDeg - fov / 2 + (fov * i) / n;
    const rad = ((bearing - 90) * Math.PI) / 180;
    const d: Pt = [Math.cos(rad), Math.sin(rad)];
    let t = radiusPx;
    for (const s of segs) {
      const hit = raySegment(origin, d, s.a, s.b);
      if (hit !== null && hit < t) t = hit;
    }
    pts.push([r2(origin[0] + d[0] * t), r2(origin[1] + d[1] * t)]);
  }
  return pts;
}

/** The clipped coverage of one marker in normalized plan units (5 decimals), the shape both the 2D canvas and the 3D
 * cone draw. */
export function coveragePolygon(m: CoverageMarker, doc: GeometryDoc, W: number, H: number, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Pt[] {
  const segs = blockingSegments(doc, W, H, m.level, entityStates, catalog);
  return clipCoverage([m.x * W, m.y * H], m.rotation, m.fov, m.radiusPx, segs).map((p) => [round5(p[0] / W), round5(p[1] / H)]);
}
```

- [ ] **Step 4: Run the test**

Run: `cd /c/cloude/smplwisebms/frontend && npx playwright test tests/unit-coverage.spec.ts --project=desktop --reporter=line`
Expected: `5 passed`. If the four-direction test reports `[500, 239.99]`-style values, the ray at bearing 0 is `[cos(-90°), sin(-90°)] = [6e-17, -1]`: `r2` rounds 240.00000000000003 to 240 - check that `clipCoverage` uses `r2` on both coordinates.

- [ ] **Step 5: The canvas draws the clipped polygon**

In `frontend/src/map/sw-plan-canvas.ts`:

(a) Add the import after the `symbolOf` import:

```ts
import { coveragePolygon, hasWallsOnLevel } from './coverage';
import { defaultLevelId } from './studio-ops';
```

(b) Extend `PlanMarker` (after `labelPos`):

```ts
  /** T087: the level the item belongs to (null / undefined = the document's default level); the clipped coverage uses
   * the walls of that level only. */
  level?: string | null;
```

(c) Add the property and the cache after `hideConnectors`:

```ts
  /** T087 (ruling R-P4-2): a camera cone is cut by the walls of its level when the document has any; off in the
   * candidates overlay of the editor is not needed - the editor keeps it on, so what is drawn is what viewers see. */
  @property({ type: Boolean }) clipCoverage = true;
  private covCache = new Map<string, { key: string; points: string }>();
  private covSeq = 0;
```

(d) In `updated(changed)`, before the `view-change` dispatch, add:

```ts
    if (changed.has('geometry') || changed.has('catalog')) {
      this.covSeq++; // the clipped cones depend on the document: recompute them lazily
      this.covCache.clear();
    }
```

(e) Add the method right after `polygonPath`:

```ts
  /** The camera's coverage cut by the walls of its level, as a points attribute relative to the marker's translate;
   * null when clipping is off, there is no structure on that level or the marker has a manual polygon (which wins).
   * Cached per marker on the document sequence, the pose, the radius and the states of the door entities. */
  private clippedCoverage(m: PlanMarker, live: { x: number; y: number }, rotation: number, fov: number): string | null {
    const doc = this.geometry;
    if (!this.clipCoverage || !doc || m.polygon) return null;
    const level = m.level ?? defaultLevelId(doc);
    if (!hasWallsOnLevel(doc, level)) return null;
    const radiusPx = this.radiusOf(m);
    const doors = doc.openings.filter((o) => o.kind === 'door' && o.anchor_ref).map((o) => `${o.id}=${this.entityStates[o.anchor_ref!.resource_id] ?? ''}`).join(',');
    const key = `${this.covSeq}|${live.x}|${live.y}|${rotation}|${fov}|${radiusPx}|${level}|${this.planWidth}|${this.planHeight}|${doors}`;
    const hit = this.covCache.get(m.id);
    if (hit && hit.key === key) return hit.points;
    const pts = coveragePolygon({ x: live.x, y: live.y, rotation, fov, radiusPx, level }, doc, this.planWidth, this.planHeight, this.entityStates, this.catalog ?? undefined);
    const points = pts.map((p) => `${((p[0] - live.x) * this.planWidth).toFixed(2)},${((p[1] - live.y) * this.planHeight).toFixed(2)}`).join(' ');
    this.covCache.set(m.id, { key, points });
    return points;
  }
```

(f) In `renderMarker`, replace the cone block

```ts
        ${isCamera && fov && m.state !== 'forbidden'
          ? (() => { const poly = this.polygonPath(m); return poly
            ? svg`<polygon class="fov ${m.state === 'offline' ? 'off' : ''}" data-cov-polygon points=${poly} />`
            : svg`<path class="fov ${m.state === 'offline' ? 'off' : ''}" d=${this.fovPath(rotation, fov, this.radiusOf(m))} />`; })()
          : nothing}
```

with

```ts
        ${isCamera && fov && m.state !== 'forbidden'
          ? (() => { const poly = this.polygonPath(m); if (poly) return svg`<polygon class="fov ${m.state === 'offline' ? 'off' : ''}" data-cov-polygon points=${poly} />`;
            const clipped = this.clippedCoverage(m, live, rotation, fov);
            return clipped
              ? svg`<polygon class="fov ${m.state === 'offline' ? 'off' : ''}" data-cov-clipped points=${clipped} />`
              : svg`<path class="fov ${m.state === 'offline' ? 'off' : ''}" d=${this.fovPath(rotation, fov, this.radiusOf(m))} />`; })()
          : nothing}
```

(g) The screens hand the level to the markers. In `explore-floor-map.ts` `get markers()`, in the API branch's `.map((a) => ({ ... }))`, add after `labelPos`:

```ts
        level: a.level_id ?? null,
```

In `investigate-history-map.ts` `get apiMarkers()`, in the camera object literal add `level: a.level_id ?? null,` after `labelPos: a.label_pos ?? undefined,`. In `investigate-event-detail.ts` `get markers()`, add `level: a.level_id ?? null,` after `fov: a.field_of_view_degrees ?? undefined,`.

- [ ] **Step 6: Type check, node specs, one live look**

Run: `cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && npx playwright test tests/unit-coverage.spec.ts tests/unit-geometry.spec.ts tests/unit-geometry-2.spec.ts --project=desktop --reporter=line`
Expected: exit 0; every test passes (the geometry goldens are untouched: `buildPrimitives` was not changed).

Then `npm run build && bash "$SP/restart_dev.sh"` and, with the phase-2 live spec's floor set-up in mind, run the existing phase-2 spec to confirm nothing regressed on the live map: `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` → the same result as the phase-3 baseline (`$SP/neighbours_0185.txt`). The clipped cone is asserted by Task 10's live spec (`[data-cov-clipped]`).

- [ ] **Step 7: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/coverage.ts frontend/src/map/sw-plan-canvas.ts frontend/src/screens/explore-floor-map.ts frontend/src/screens/investigate-history-map.ts frontend/src/screens/investigate-event-detail.ts frontend/tests/unit-coverage.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): camera coverage stops at the walls of its level on every 2D map (T087, coverage.ts)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 3: Migration 0021 and the anchor fields — backend, API types, defaults, the anchor panel

**Files:**
- Create: `smplwise_vms/backend/smplwise/migrations/0021_anchor_3d.sql`
- Modify: `smplwise_vms/backend/smplwise/routers/anchors.py` (`anchor_row`, `NULLABLE_KEYS`, `AnchorIn`, `AnchorPatch`, the insert, `update_anchor`)
- Test: `smplwise_vms/backend/tests/test_anchor_3d.py`
- Modify: `frontend/src/api/types.ts` (`Anchor`), `frontend/src/api/maps.ts` (`createAnchor`, `updateAnchor`)
- Create: `frontend/src/map/anchor-3d.ts`
- Modify: `frontend/src/screens/explore-plan-editor.ts` (the two inspectors, `save()`)
- Test: `frontend/tests/unit-anchor-3d.spec.ts`

**Interfaces:**
- Consumes: the anchor routes and the bundle of phase 1-2.
- Produces:
  - Columns `map_anchors.mount_height_m REAL`, `map_anchors.tilt_deg REAL` (nullable).
  - Every anchor answer and every bundle anchor carries `mount_height_m: number | null` and `tilt_deg: number | null`; `POST /floors/{id}/anchors` and `PATCH /map-anchors/{id}` accept them (`0 <= mount <= 30`, `-90 <= tilt <= 90`, else 422); an explicit `null` in a PATCH clears; audit `anchor.update` lists them in `before` / `after`.
  - `frontend/src/map/anchor-3d.ts`: `ANCHOR_3D_DEFAULTS`, `type Anchor3dKind = 'camera' | 'door_station' | 'other'`, `anchor3dKind(a: { resource_type: string; layer_id: string }): Anchor3dKind`, `anchor3d(a: { resource_type: string; layer_id: string; mount_height_m?: number | null; tilt_deg?: number | null }): { mount_height_m: number; tilt_deg: number; defaulted: boolean }` - Task 4's builder and the panel placeholders use it.
  - `Anchor.mount_height_m?: number | null`, `Anchor.tilt_deg?: number | null` (types.ts); the editor inputs `[data-anchor-mount]` and `[data-anchor-tilt]`.

- [ ] **Step 1: Write the failing backend test**

`smplwise_vms/backend/tests/test_anchor_3d.py`:

```python
"""Plan Studio phase 4 (T087, ruling R-P4-8): migration 0021 gives map anchors a mount height and a tilt; the routes
validate them (0-30 m, -90..90 deg), an explicit null clears them, they travel in every anchor answer and in the map
bundle, defaults are never stored, and the audit records them like every other anchor field."""
from __future__ import annotations

import sqlite3

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def _cols(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def test_migration_0021_adds_the_3d_columns(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        assert {"mount_height_m", "tilt_deg"} <= _cols(conn, "map_anchors")
        assert conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] >= 21


def _floor_with_plan(c: TestClient) -> dict:
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return ids


def test_mount_height_and_tilt_round_trip_validate_clear_and_audit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = _floor_with_plan(c)
        cam = c.post("/api/v1/cameras", json={"channel": 4, "alias": "לובי"}).json()
        cam2 = c.post("/api/v1/cameras", json={"channel": 5, "alias": "חניה"}).json()
        r = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.3, "y": 0.4, "rotation_degrees": 90, "field_of_view_degrees": 100, "mount_height_m": 3.2, "tilt_deg": 15})
        assert r.status_code == 201, r.text
        a = r.json()
        assert a["mount_height_m"] == 3.2 and a["tilt_deg"] == 15
        # defaults are the clients' business: an anchor created without the fields answers null, nothing is stored
        r = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam2["id"], "x": 0.6, "y": 0.4})
        assert r.status_code == 201, r.text
        assert r.json()["mount_height_m"] is None and r.json()["tilt_deg"] is None
        # the list and the map bundle carry the fields
        listed = {x["id"]: x for x in c.get(f"/api/v1/floors/{ids['floor2']}/anchors").json()["anchors"]}
        assert listed[a["id"]]["mount_height_m"] == 3.2 and listed[a["id"]]["tilt_deg"] == 15
        bundle = {x["id"]: x for x in c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["anchors"]}
        assert bundle[a["id"]]["mount_height_m"] == 3.2 and bundle[a["id"]]["tilt_deg"] == 15
        # validation on both routes
        for body in ({"mount_height_m": -0.1}, {"mount_height_m": 30.5}, {"tilt_deg": 90.5}, {"tilt_deg": -91}):
            assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], **body}).status_code == 422, body
            assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam2["id"], "x": 0.1, "y": 0.1, **body}).status_code == 422, body
        # a patch changes both and bumps the revision
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "tilt_deg": -5, "mount_height_m": 2.8})
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["tilt_deg"] == -5 and a["mount_height_m"] == 2.8 and a["revision"] == 2
        # an explicit null clears; an absent key leaves the value alone
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "tilt_deg": None, "label": "לובי צפון"})
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["tilt_deg"] is None and a["mount_height_m"] == 2.8 and a["label"] == "לובי צפון"
        # the audit carries the before / after of the fields like every other anchor field
        rows = c.get("/api/v1/audit?prefix=anchor.update&limit=10").json()["rows"]
        assert any(x["details"].get("after", {}).get("tilt_deg") == -5 and x["details"]["before"].get("tilt_deg") == 15 for x in rows), rows
        assert any(x["details"].get("after", {}).get("tilt_deg", "absent") is None for x in rows), rows
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_anchor_3d.py -p no:cacheprovider`
Expected: 2 failed - the columns are missing (`assert {'mount_height_m', 'tilt_deg'} <= {...}` fails) and the create answers without the fields (`KeyError: 'mount_height_m'`).

- [ ] **Step 3: The migration and the router**

`smplwise_vms/backend/smplwise/migrations/0021_anchor_3d.sql`:

```sql
-- Plan Studio phase 4 (T087, CR-003, design 4.1): the height of a placed item above its level's floor and its downward
-- tilt, for the schematic 3D view. NULL = the default of the item's kind (camera 2.5 m / 10 deg down, door station
-- 1.4 m / 0, other entities 1.2 m / 0), applied by the clients and never stored.
ALTER TABLE map_anchors ADD COLUMN mount_height_m REAL;
ALTER TABLE map_anchors ADD COLUMN tilt_deg REAL;
```

In `smplwise_vms/backend/smplwise/routers/anchors.py`:

(a) `anchor_row`: add two entries after the `level_id` line:

```python
        "mount_height_m": r["mount_height_m"] if "mount_height_m" in r.keys() else None,
        "tilt_deg": r["tilt_deg"] if "tilt_deg" in r.keys() else None,
```

(b) Below `COVERAGE_KEYS = ("coverage_radius", "coverage_polygon")` add:

```python
# Fields an explicit null clears in a PATCH (absent = unchanged): the coverage pair and the 3D pair (T087).
NULLABLE_KEYS = COVERAGE_KEYS + ("mount_height_m", "tilt_deg")
```

(c) In the FIRST `class AnchorIn(BaseModel)` (the one at line 221), after the `coverage_polygon` line add:

```python
    mount_height_m: float | None = Field(default=None, ge=0, le=30)  # metres above the level's floor (T087); null = the kind's default
    tilt_deg: float | None = Field(default=None, ge=-90, le=90)  # positive = down
```

(d) In the FIRST `class AnchorPatch(BaseModel)` (line 237), after its `coverage_polygon` line add the same two lines.

(e) In `create_anchor`, replace the INSERT statement and its values with:

```python
    conn.execute(
        """INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, revision, effective_from, created_by, updated_by, updated_at, coverage_radius, coverage_polygon, label_pos, level_id, mount_height_m, tilt_deg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (aid, floor_id, version["id"], body.resource_type, body.resource_id, body.x, body.y, body.rotation_degrees, body.field_of_view_degrees, body.layer_id, body.label, now, principal.user_id, principal.user_id, now,
         body.coverage_radius, _check_polygon(body.coverage_polygon), body.label_pos, body.level_id or None, body.mount_height_m, body.tilt_deg),
    )
```

(f) In `update_anchor`, replace the `fields = ...` line with:

```python
    fields = {k: v for k, v in body.model_dump().items() if k != "revision" and (v is not None or (k in NULLABLE_KEYS and k in body.model_fields_set))}
```

- [ ] **Step 4: Run the backend tests**

Run: `cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_anchor_3d.py tests/test_anchor_coverage.py tests/test_plan_geometry_integration.py tests/test_plan_geometry_binding.py -p no:cacheprovider`
Expected: all pass (2 new). If `test_plan_geometry_integration.py` compares a whole anchor dict against a literal, extend that literal with `"mount_height_m": None, "tilt_deg": None` - never drop the fields from `anchor_row`.

- [ ] **Step 5: Write the failing node test for the defaults**

`frontend/tests/unit-anchor-3d.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { ANCHOR_3D_DEFAULTS, anchor3d, anchor3dKind } from '../src/map/anchor-3d';

// Plan Studio phase 4 (T087, ruling R-P4-8): the mount height and tilt a placed item gets when its anchor stores none.
test('the defaults per anchor kind, and stored values win', () => {
  expect(ANCHOR_3D_DEFAULTS).toEqual({ camera: { mount_height_m: 2.5, tilt_deg: 10 }, door_station: { mount_height_m: 1.4, tilt_deg: 0 }, other: { mount_height_m: 1.2, tilt_deg: 0 } });
  expect(anchor3dKind({ resource_type: 'camera', layer_id: 'cameras' })).toBe('camera');
  expect(anchor3dKind({ resource_type: 'ha_entity', layer_id: 'doors' })).toBe('door_station');
  expect(anchor3dKind({ resource_type: 'ha_entity', layer_id: 'lights' })).toBe('other');
  expect(anchor3dKind({ resource_type: 'ha_entity', layer_id: 'sensors' })).toBe('other');
  expect(anchor3d({ resource_type: 'camera', layer_id: 'cameras' })).toEqual({ mount_height_m: 2.5, tilt_deg: 10, defaulted: true });
  expect(anchor3d({ resource_type: 'camera', layer_id: 'cameras', mount_height_m: 3.2, tilt_deg: null })).toEqual({ mount_height_m: 3.2, tilt_deg: 10, defaulted: true });
  expect(anchor3d({ resource_type: 'camera', layer_id: 'cameras', mount_height_m: 3.2, tilt_deg: -5 })).toEqual({ mount_height_m: 3.2, tilt_deg: -5, defaulted: false });
  expect(anchor3d({ resource_type: 'ha_entity', layer_id: 'doors', mount_height_m: 0 })).toEqual({ mount_height_m: 0, tilt_deg: 0, defaulted: true }); // 0 is a value, not "unset"
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `cd /c/cloude/smplwisebms/frontend && npx playwright test tests/unit-anchor-3d.spec.ts --project=desktop --reporter=line`
Expected: FAIL - `Cannot find module '../src/map/anchor-3d'`.

- [ ] **Step 7: The defaults module, the API types, the panel**

`frontend/src/map/anchor-3d.ts`:

```ts
/**
 * The 3D placement of a map anchor (T087, ruling R-P4-8): metres above its level's floor and degrees of downward tilt.
 * The anchor stores them only when someone set them; otherwise the kind's default applies here, on every client, and
 * nothing is written back. No Lit, no three: the scene builder, the anchor panel and a node spec share it.
 */
export const ANCHOR_3D_DEFAULTS = {
  camera: { mount_height_m: 2.5, tilt_deg: 10 },
  door_station: { mount_height_m: 1.4, tilt_deg: 0 },
  other: { mount_height_m: 1.2, tilt_deg: 0 },
} as const;

export type Anchor3dKind = keyof typeof ANCHOR_3D_DEFAULTS;

/** A camera; an entity on the doors layer (a lock, a door station, a gate) at hand height; every other entity. */
export function anchor3dKind(a: { resource_type: string; layer_id: string }): Anchor3dKind {
  if (a.resource_type === 'camera') return 'camera';
  return a.layer_id === 'doors' ? 'door_station' : 'other';
}

export function anchor3d(a: { resource_type: string; layer_id: string; mount_height_m?: number | null; tilt_deg?: number | null }): { mount_height_m: number; tilt_deg: number; defaulted: boolean } {
  const d = ANCHOR_3D_DEFAULTS[anchor3dKind(a)];
  const mount = typeof a.mount_height_m === 'number' && Number.isFinite(a.mount_height_m) ? a.mount_height_m : null;
  const tilt = typeof a.tilt_deg === 'number' && Number.isFinite(a.tilt_deg) ? a.tilt_deg : null;
  return { mount_height_m: mount ?? d.mount_height_m, tilt_deg: tilt ?? d.tilt_deg, defaulted: mount === null || tilt === null };
}
```

In `frontend/src/api/types.ts`, in `interface Anchor` after `level_id?: string | null;` add:

```ts
  /** T087: metres above the level's floor and the downward tilt in degrees; null = the kind's default (map/anchor-3d.ts). */
  mount_height_m?: number | null;
  tilt_deg?: number | null;
```

In `frontend/src/api/maps.ts`, extend the two bodies: in `createAnchor` add `; mount_height_m?: number | null; tilt_deg?: number | null` before the closing `}` of the body type, and the same in `updateAnchor`.

In `frontend/src/screens/explore-plan-editor.ts`:

(a) Add the import after the `studio-ops` import line:

```ts
import { ANCHOR_3D_DEFAULTS, anchor3dKind } from '../map/anchor-3d';
```

(b) Add this method right before `renderCameraInspector`:

```ts
  /** T087: the height above the floor (and, for a camera, the tilt) the 3D view places the item at; empty = the kind's
   * default, shown as the placeholder. A typed 0 is a value; an emptied field clears back to the default. */
  private renderMount(a: Anchor, withTilt: boolean) {
    const d = ANCHOR_3D_DEFAULTS[anchor3dKind(a)];
    const num = (raw: string, min: number, max: number): number | null => {
      if (raw.trim() === '') return null;
      const v = Number(raw);
      return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
    };
    return html`<div class="two" data-anchor-3d>
      <sw-field label="גובה התקנה (מ׳)" hint=${`ברירת מחדל ${d.mount_height_m} מ׳ · לתצוגת התלת-ממד`}><input type="number" step="0.1" min="0" max="30" data-ltr data-anchor-mount placeholder=${String(d.mount_height_m)} .value=${a.mount_height_m == null ? '' : String(a.mount_height_m)} @change=${(e: Event) => this.apply(a.id, { mount_height_m: num((e.target as HTMLInputElement).value, 0, 30) })} /></sw-field>
      ${withTilt ? html`<sw-field label="הטיה (°)" hint=${`ברירת מחדל ${d.tilt_deg}° · חיובי = מטה`}><input type="number" step="1" min="-90" max="90" data-ltr data-anchor-tilt placeholder=${String(d.tilt_deg)} .value=${a.tilt_deg == null ? '' : String(a.tilt_deg)} @change=${(e: Event) => this.apply(a.id, { tilt_deg: num((e.target as HTMLInputElement).value, -90, 90) })} /></sw-field>` : nothing}
    </div>`;
  }
```

(c) In `renderCameraInspector`, right after the `מיקום התווית` `<sw-field>` line, add:

```ts
      ${this.renderMount(a, true)}
```

(d) In `renderEntityInspector`, right after its `מיקום התווית` `<sw-field>` line, add:

```ts
      ${this.renderMount(a, false)}
```

(e) In `save()`, replace the `updateAnchor(id, { ... })` call with:

```ts
          const saved = await updateAnchor(id, { revision: a.revision, x: a.position.x, y: a.position.y, rotation_degrees: a.rotation_degrees, field_of_view_degrees: a.field_of_view_degrees, label: a.label,
            coverage_radius: a.coverage_radius ?? null, coverage_polygon: a.coverage_polygon ?? null, label_pos: a.label_pos ?? 'auto', level_id: a.level_id ?? '',
            mount_height_m: a.mount_height_m ?? null, tilt_deg: a.tilt_deg ?? null });
```

- [ ] **Step 8: Type check and node specs**

Run: `cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && npx playwright test tests/unit-anchor-3d.spec.ts --project=desktop --reporter=line`
Expected: exit 0; `1 passed`. Then `npm run build && bash "$SP/restart_dev.sh"` and `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-editor.spec.ts --project=desktop --workers=1 --reporter=line` → the same result as the phase-3 baseline (the inspector gained two fields; nothing else moved). The fields themselves are asserted by Task 10's live spec (`[data-anchor-mount]`, the PATCH body, the bundle value).

- [ ] **Step 9: Commit**

```bash
cd /c/cloude/smplwisebms && git add smplwise_vms/backend/smplwise/migrations/0021_anchor_3d.sql smplwise_vms/backend/smplwise/routers/anchors.py smplwise_vms/backend/tests/test_anchor_3d.py smplwise_vms/backend/tests/test_plan_geometry_integration.py frontend/src/api/types.ts frontend/src/api/maps.ts frontend/src/map/anchor-3d.ts frontend/src/screens/explore-plan-editor.ts frontend/tests/unit-anchor-3d.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): map anchors carry a mount height and a tilt for 3D - migration 0021, routes, bundle, panel, defaults (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

(`git add` of an unchanged `test_plan_geometry_integration.py` is a no-op; keep it for the case Step 4 needed the literal extended.)

---

### Task 4: The scene builder — a deterministic description, pinned on the fixture and on a 3,000-chair document

**Files:**
- Create: `frontend/src/map/scene-builder.ts`
- Modify: `frontend/src/api/plan-catalog.ts` (`MeshPart`, `CatalogItem.mesh`, `lookup3dOf`)
- Create (generated by the spec with `SCENE_WRITE=1`, committed): `contracts/fixtures/plan_geometry/sample-v2.scene.json`
- Test: `frontend/tests/unit-scene-builder.spec.ts`

**Interfaces:**
- Consumes: `buildPrimitives`, `effectiveScale`, `MAX_TRIBUNE_ROWS`, the document types (`geometry.ts`); `defaultLevelId` (`studio-ops.ts`); `blockingSegments`, `clipCoverage`, `isOpenState` (Task 2); `anchor3d` (Task 3).
- Produces (Tasks 5-8 build on these exact names):
  - Types `PartKind`, `PartShape`, `Vec3`, `ScenePart`, `SceneAnchor`, `SceneZone`, `SceneLayers`, `MeshPart` (re-export), `Catalog3D`, `Catalog3DLookup`, `SceneInput`, `SceneDescription`, `IsoFace`, `IsoScene`.
  - `buildScene(input: SceneInput): SceneDescription`, `isoProjection(desc: SceneDescription): IsoScene`, `r4(v)`, `DEFAULT_LAYERS`, `DEFAULT_CONE_RADIUS_PX = 140`, `STATE_HE`.
  - Part ids: `floor:<level>`, `room:<zone>`, `room:<zone>#label`, `label:<id>`, `wall:<id>#<n>`, `lintel:<opening>`, `sill:<opening>`, `head:<opening>`, `door:<opening>`, `window:<opening>`, `obj:<id>` (or `obj:<id>#<n>` for stepped / composite), `obj:<id>#glow`, `conn:<id>` (or `#<n>`), `cam:<anchor>`, `cam:<anchor>#cone`, `ent:<anchor>`, `ent:<anchor>#glow`. `userData.kind` ∈ `level | zone | label | wall | opening | object | connector | camera | entity`, `userData.id` = the source id (anchor id for cameras and entities, object id, wall id, opening id).
  - Colour tokens (names without `--sw-`): `map-bg`, `map-structure`, `map-wall`, `map-glass`, `map-label`, `map-glow`, `accent`, `live`, `stale`, `text-3`, `offline`, `obj-<token>`.
  - Rotation `[pitch about x, yaw about y, 0]` in degrees, applied yaw first (`Euler` order `'YXZ'` in Task 5); a box along +x turned by yaw `-deg(atan2(dz, dx))` points along `(dx, dz)`; a camera at bearing `b` has yaw `-b` and pitch `tilt`.
  - Instance group key `${shape}|${color}|${opacity}` for `box` and `cylinder` parts of kinds `wall`, `lintel`, `sill`, `head`, `object` (single-part and composite), `connector`; `null` for everything else.
  - `plan-catalog.ts`: `interface MeshPart { shape: 'box' | 'cylinder'; size: [number, number, number]; offset: [number, number, number]; color_token?: string }`, `CatalogItem.mesh?: MeshPart[] | null`, `lookup3dOf(lib: CatalogLibrary): Catalog3DLookup`.

- [ ] **Step 1: Write the failing test**

`frontend/tests/unit-scene-builder.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogItem, CatalogLibrary } from '../src/api/plan-catalog';
import { lookup3dOf } from '../src/api/plan-catalog';
import type { GeometryDoc, GeomConnector, GeomObject, GeomOpening, GeomWall, Pt } from '../src/map/geometry';
import { buildScene, isoProjection, type SceneAnchor, type SceneDescription, type SceneInput, type ScenePart } from '../src/map/scene-builder';

// Plan Studio phase 4 (T087, design 10.5, ruling R-P4-4): the scene description is a pure function of the document, the
// anchors, the states, the library and the zones - pinned on the shared fixture (sample-v2.scene.json, regenerated with
// SCENE_WRITE=1) and checked on a synthetic hall with levels, connectors, a tribune, cylinders, an extruded polygon, a
// composite item, 3,000 chairs, cameras with cones and lamps on / off. Node only: no three, no DOM.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const CATALOG = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json');
const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
const builtin = (JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: CatalogItem[] }).items;
const libraryOf = (items: CatalogItem[]): CatalogLibrary => ({ catalog_version: 'test', revision: 'test', categories: [], icons: [], color_tokens: [], items });
const catalog = lookup3dOf(libraryOf(builtin));

const ANCHOR = (id: string, resource_type: 'camera' | 'ha_entity', resource_id: string, x: number, y: number, extra: Partial<SceneAnchor> = {}): SceneAnchor => ({
  id, resource_type, resource_id, x, y, rotation: 0, fov: null, radius: null, polygon: null, level_id: null, layer_id: resource_type === 'camera' ? 'cameras' : 'sensors', label: id, state: null, online: null, mount_height_m: null, tilt_deg: null, ...extra,
});
const SAMPLE_ANCHORS: SceneAnchor[] = [
  ANCHOR('a-cam', 'camera', 'cam-1', 0.15, 0.4, { rotation: 90, fov: 90, radius: 0.3, online: true }),
  ANCHOR('a-cam2', 'camera', 'cam-2', 0.7, 0.2, { rotation: 180, fov: 60, polygon: [[0.7, 0.2], [0.8, 0.3], [0.6, 0.3]], level_id: 'L1', online: false, mount_height_m: 3, tilt_deg: 20 }),
  ANCHOR('a-light', 'ha_entity', 'light.store', 0.5, 0.3, { layer_id: 'lights', state: 'on' }),
  ANCHOR('a-lock', 'ha_entity', 'lock.front', 0.85, 0.35, { layer_id: 'doors', state: 'locked' }),
  ANCHOR('a-sensor', 'ha_entity', 'binary_sensor.hall', 0.3, 0.65, { layer_id: 'sensors', state: null }),
];
const SAMPLE_ZONES = [{ id: 'z1', name: 'מחסן', polygon: [{ x: 0.12, y: 0.12 }, { x: 0.58, y: 0.12 }, { x: 0.58, y: 0.48 }, { x: 0.12, y: 0.48 }] }];
const sampleInput = (): SceneInput => ({ doc: sample(), width: 1000, height: 800, anchors: SAMPLE_ANCHORS, entityStates: { 'light.store': 'on', 'lock.front': 'locked', 'binary_sensor.hall': null }, circuitStates: { k1: 'on' }, catalog, zones: SAMPLE_ZONES });
const byId = (desc: SceneDescription, id: string): ScenePart => { const p = desc.parts.find((x) => x.id === id); expect(p, id).toBeTruthy(); return p!; };
const ofKind = (desc: SceneDescription, kind: ScenePart['kind']) => desc.parts.filter((p) => p.kind === kind);

test('the sample document builds the pinned scene description (SCENE_WRITE=1 regenerates it)', () => {
  const desc = buildScene(sampleInput());
  const text = JSON.stringify(desc, null, 1) + '\n';
  const target = path.join(FIX, 'sample-v2.scene.json');
  if (process.env.SCENE_WRITE === '1') {
    fs.writeFileSync(target, text);
    console.log(`written ${target}: ${desc.parts.length} parts`);
  }
  expect(fs.existsSync(target), 'run once with SCENE_WRITE=1 to create the golden').toBe(true);
  expect(text).toBe(fs.readFileSync(target, 'utf8'));
  expect(JSON.stringify(buildScene(sampleInput()))).toBe(JSON.stringify(desc)); // twice the same
  expect(JSON.stringify(buildScene({ ...sampleInput(), anchors: [...SAMPLE_ANCHORS].reverse() }))).toBe(JSON.stringify(desc)); // whatever the input order
  expect(desc.version).toBe('scene-1');
  expect(desc.estimated).toBe(false);
  expect(desc.scale_m_per_px).toBe(0.01);
  expect(desc.size).toEqual([10, 8]);
  expect(desc.levels.map((l) => l.id)).toEqual(['L0', 'L1']);
  expect(ofKind(desc, 'floor').length).toBe(2);
  expect(byId(desc, 'floor:L0').size).toEqual([10, 0.05, 8]);
  expect(byId(desc, 'floor:L1').size[0]).toBeLessThan(10); // a secondary level covers what sits on it, not the whole plan
  expect(ofKind(desc, 'wall').length).toBeGreaterThanOrEqual(8); // four walls cut by six openings
  expect(ofKind(desc, 'lintel').length).toBe(ofKind(desc, 'door').length);
  expect(ofKind(desc, 'sill').length).toBe(ofKind(desc, 'window').length);
  expect(ofKind(desc, 'head').length).toBe(ofKind(desc, 'window').length);
  expect(ofKind(desc, 'window').every((p) => p.opacity < 1)).toBe(true);
  expect(byId(desc, 'cam:a-cam').color).toBe('accent');
  expect(byId(desc, 'cam:a-cam').rotation).toEqual([10, -90, 0]); // the default tilt, the bearing as a yaw
  expect(byId(desc, 'cam:a-cam').position[1]).toBe(2.5); // the default mount height
  expect(byId(desc, 'cam:a-cam#cone').polygon!.length).toBeGreaterThan(10);
  expect(byId(desc, 'cam:a-cam#cone').size).toEqual([0, 2.5, 0]);
  expect(byId(desc, 'cam:a-cam2').color).toBe('offline');
  expect(byId(desc, 'cam:a-cam2').position).toEqual([7, 1.8, 1.6]); // L1 sits at -1.2 m; a stored mount of 3 m
  expect(byId(desc, 'cam:a-cam2').rotation).toEqual([20, -180, 0]);
  expect(byId(desc, 'cam:a-cam2#cone').polygon).toEqual([[0, 0], [1, 0.8], [-1, 0.8]]); // the manual polygon, in metres from the camera
  expect(byId(desc, 'obj:o3').color).toBe('map-glow'); // the lamp of circuit k1, which is on
  expect(byId(desc, 'obj:o3#glow').shape).toBe('light');
  expect(desc.parts.find((p) => p.id === 'ent:a-light')).toBeUndefined(); // it has a body (o3): no floating symbol
  expect(byId(desc, 'ent:a-lock').color).toBe('text-3');
  expect(byId(desc, 'ent:a-lock').text).toBe('a-lock · נעול');
  expect(byId(desc, 'ent:a-lock').position[1]).toBeCloseTo(1.65, 6); // the door-station default (1.4 m), the sprite a little above it
  expect(byId(desc, 'ent:a-sensor').color).toBe('stale');
  expect(byId(desc, 'room:z1').shape).toBe('prism');
  expect(byId(desc, 'room:z1#label').text).toBe('מחסן');
  expect(byId(desc, 'label:la').text).toBe('מחסן');
  expect(ofKind(desc, 'connector').length).toBeGreaterThanOrEqual(3); // the stairs c1 as stepped boxes; the tribune connector draws nothing (its object does)
  expect(desc.parts.filter((p) => p.id.startsWith('conn:cx-o4')).length).toBe(0);
  expect(desc.parts.every((p) => p.position.every(Number.isFinite) && p.size.every((v) => Number.isFinite(v) && v >= 0) && p.rotation.every(Number.isFinite))).toBe(true);
  const ids = desc.parts.map((p) => p.id);
  expect([...ids].sort()).toEqual(ids);
  expect(new Set(ids).size).toBe(ids.length);
  expect(desc.stats.parts).toBe(desc.parts.length);
  expect(desc.stats.groups).toBe(Object.keys(desc.groups).length);
});

const WALL = (id: string, polyline: Pt[], level = 'L0', extra: Partial<GeomWall> = {}): GeomWall => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const OPENING = (id: string, wall_id: string, kind: GeomOpening['kind'], extra: Partial<GeomOpening> = {}): GeomOpening => ({ id, wall_id, t: 0.5, kind, width_m: 0.9, height_m: kind === 'window' ? 1.2 : 2.1, sill_m: kind === 'window' ? 0.9 : 0, swing: kind === 'door' ? 'left' : 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {}, ...extra });
const OBJ = (id: string, item_id: string, position: Pt, extra: Partial<GeomObject> = {}): GeomObject => ({ id, item_id, level_id: 'L0', position, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const CONN = (id: string, kind: GeomConnector['kind'], polyline: Pt[], extra: Partial<GeomConnector> = {}): GeomConnector => ({ id, kind, level_from: 'L0', level_to: 'L1', floor_ids: [], polyline, width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {}, ...extra });

/** A hall: a room on L0 with a door (a lock entity), a window and a passage; a lower level L1 with a wall and a tribune;
 * 3,000 chairs in a 60 x 50 grid; a column, an extruded polygon, a composite desk; three lamps (entity on, circuit on,
 * off); stairs, an elevator and a ramp; a camera looking north at the wall. 1 m = 100 px on a 1000 x 800 plan. */
function hall(): SceneInput {
  const chairs: GeomObject[] = [];
  for (let i = 0; i < 3000; i++) chairs.push(OBJ(`ch${i}`, 'chair.basic', [0.15 + (i % 60) * (0.7 / 59), 0.15 + Math.floor(i / 60) * (0.4 / 49)]));
  const custom: CatalogItem[] = [
    { id: 'custom.poly', category: 'structure', names: { he: 'מצולע', en: 'polygon' }, tags: [], role: 'structure', shape: 'extruded_polygon', size: { w_m: 2, d_m: 2, h_m: 1 }, z_ref: 'floor', z_m: 0, params: {}, params_schema: {}, icon: 'box', color_token: 'structure', anchor_kinds: [], ifc: { class: 'IfcBuildingElementProxy', predefined_type: '' }, custom: true, based_on: null },
    { id: 'custom.desk', category: 'furniture', names: { he: 'שולחן מורכב', en: 'desk' }, tags: [], role: 'furniture', shape: 'composite', size: { w_m: 1.4, d_m: 0.7, h_m: 0.75 }, z_ref: 'floor', z_m: 0, params: {}, params_schema: {}, icon: 'table', color_token: 'furniture', anchor_kinds: [], ifc: { class: 'IfcFurniture', predefined_type: '' }, custom: true, based_on: null,
      mesh: [{ shape: 'box', size: [1.4, 0.05, 0.7], offset: [0, 0.725, 0] }, { shape: 'cylinder', size: [0.05, 0.7, 0.05], offset: [-0.6, 0.35, -0.3] }, { shape: 'cylinder', size: [0.05, 0.7, 0.05], offset: [0.6, 0.35, 0.3] }] },
  ];
  const doc: GeometryDoc = {
    ...sample(),
    levels: [{ id: 'L0', name: 'ראשי', elevation_m: 0, ceiling_height_m: 3, is_default: true }, { id: 'L1', name: 'תחתון', elevation_m: -1.2, ceiling_height_m: 6, is_default: false }],
    walls: [WALL('n', [[0.1, 0.1], [0.9, 0.1]]), WALL('e', [[0.9, 0.1], [0.9, 0.6]]), WALL('s', [[0.9, 0.6], [0.1, 0.6]]), WALL('w', [[0.1, 0.6], [0.1, 0.1]]), WALL('lw', [[0.2, 0.9], [0.8, 0.9]], 'L1', { kind: 'low', height_m: 1 })],
    openings: [OPENING('dr', 'n', 'door', { anchor_ref: { resource_type: 'ha_entity', resource_id: 'lock.a' } }), OPENING('wn', 'e', 'window'), OPENING('ps', 's', 'passage')],
    objects: [...chairs, OBJ('tr', 'tribune.stepped', [0.5, 0.8], { level_id: 'L1', size: { w_m: 12, d_m: 4, h_m: 1.2 }, rotation_deg: 90, params: { rows: 5, step_height_m: 0.24, step_width_m: 0.8 } }),
      OBJ('col', 'column.round', [0.5, 0.5], { size: { w_m: 0.4, d_m: 0.4, h_m: 2.8 } }), OBJ('ex', 'custom.poly', [0.3, 0.5], { size: { w_m: 2, d_m: 2, h_m: 1 }, params: { polygon: [[-1, -1], [1, -1], [0, 1]] } }),
      OBJ('cp', 'custom.desk', [0.7, 0.5], { size: { w_m: 1.4, d_m: 0.7, h_m: 0.75 }, rotation_deg: 30 }),
      OBJ('l1', 'light.ceiling', [0.2, 0.2], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3, anchor_ref: { resource_type: 'ha_entity', resource_id: 'light.a' } }),
      OBJ('l2', 'light.ceiling', [0.5, 0.2], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3 }), OBJ('l3', 'light.ceiling', [0.8, 0.2], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3 })],
    circuits: [{ id: 'k', name: 'אולם', switch_entity_id: 'switch.k', member_ids: ['l2'], color_token: 'circuit-1', power_w: 36 }],
    connectors: [CONN('st', 'stairs', [[0.2, 0.7], [0.2, 0.75]]), CONN('el', 'elevator', [[0.9, 0.7], [0.95, 0.7]], { width_m: 2 }), CONN('rp', 'ramp', [[0.6, 0.7], [0.6, 0.78]], { level_from: 'L1', level_to: 'L0' })],
    labels: [], groups: [],
  };
  const anchors = [
    ANCHOR('c1', 'camera', 'cam-1', 0.5, 0.3, { rotation: 0, fov: 90, radius: 0.5, online: true }),
    ANCHOR('la', 'ha_entity', 'light.a', 0.2, 0.2, { layer_id: 'lights', state: 'on' }),
    ANCHOR('lk', 'ha_entity', 'lock.a', 0.5, 0.1, { layer_id: 'doors', state: 'unlocked' }),
  ];
  return { doc, width: 1000, height: 800, anchors, entityStates: { 'light.a': 'on', 'lock.a': 'unlocked' }, circuitStates: { k: 'on' }, catalog: lookup3dOf(libraryOf([...builtin, ...custom])) };
}

test('a hall with 3,000 chairs: one instance group, a bounded part count, every shape, openings, states, connectors, cones', () => {
  const input = hall();
  const desc = buildScene(input);
  // instancing: every chair shares one group; the description stays close to one part per item
  const chair = byId(desc, 'obj:ch0');
  expect(chair.shape).toBe('box');
  expect(chair.group).toBe(`box|${chair.color}|1`);
  expect(desc.groups[chair.group!]).toBe(3000);
  expect(desc.stats.instanced).toBeGreaterThanOrEqual(3000);
  expect(desc.parts.length).toBeLessThanOrEqual(3000 + 150);
  expect(desc.stats.objects).toBe(3013); // 3,000 chairs + 5 tribune steps + the column + the polygon + 3 desk parts + 3 lamps
  // the tribune: five rising steps on the lower level, turned by its rotation, not instanced
  const steps = desc.parts.filter((p) => p.id.startsWith('obj:tr#'));
  expect(steps.length).toBe(5);
  expect(steps.map((p) => p.size[1])).toEqual([0.24, 0.48, 0.72, 0.96, 1.2]);
  expect(steps.every((p) => p.group === null && p.level_id === 'L1' && p.rotation[1] === -90 && p.userData.id === 'tr')).toBe(true);
  expect(steps[0].position[1]).toBeCloseTo(-1.2 + 0.12, 6);
  // a cylinder, an extruded polygon, a composite
  expect(byId(desc, 'obj:col').shape).toBe('cylinder');
  expect(byId(desc, 'obj:col').group).toBe('cylinder|obj-structure|1');
  expect(byId(desc, 'obj:col').size).toEqual([0.4, 2.8, 0.4]);
  const ex = byId(desc, 'obj:ex');
  expect(ex.shape).toBe('prism');
  expect(ex.polygon).toEqual([[-1, -1], [1, -1], [0, 1]]);
  expect(ex.size).toEqual([0, 1, 0]);
  const desk = desc.parts.filter((p) => p.id.startsWith('obj:cp#'));
  expect(desk.length).toBe(3);
  expect(desk.map((p) => p.shape)).toEqual(['box', 'cylinder', 'cylinder']);
  expect(desk.every((p) => p.rotation[1] === -30 && p.userData.id === 'cp')).toBe(true);
  expect(desk[0].position[1]).toBeCloseTo(0.725, 6);
  // lamps: a body whose entity is on, a member of a circuit that is on, one that is off
  expect(byId(desc, 'obj:l1').color).toBe('map-glow');
  expect(byId(desc, 'obj:l1#glow').shape).toBe('light');
  expect(byId(desc, 'obj:l1').position[1]).toBeCloseTo(3 - 0.3 + 0.05, 6); // a ceiling item hangs from the level's ceiling
  expect(byId(desc, 'obj:l2').color).toBe('map-glow');
  expect(byId(desc, 'obj:l2#glow')).toBeTruthy();
  expect(byId(desc, 'obj:l3').color).toBe('obj-light');
  expect(desc.parts.find((p) => p.id === 'obj:l3#glow')).toBeUndefined();
  expect(desc.parts.find((p) => p.id === 'ent:la')).toBeUndefined(); // the light has a body
  // openings: the door leaf is open by its lock, the lintel, the window sill / head / glass, the passage nothing
  const leaf = byId(desc, 'door:dr');
  expect(Math.abs(leaf.rotation[1])).toBe(80);
  expect(leaf.size).toEqual([0.9, 2.1, 0.04]);
  expect(byId(desc, 'lintel:dr').size[1]).toBeCloseTo(0.9, 6);
  expect(byId(desc, 'sill:wn').size[1]).toBeCloseTo(0.9, 6);
  expect(byId(desc, 'head:wn').size[1]).toBeCloseTo(0.9, 6);
  expect(byId(desc, 'window:wn').opacity).toBeLessThan(1);
  expect(desc.parts.filter((p) => p.id.endsWith(':ps')).length).toBe(0);
  const closed = buildScene({ ...input, entityStates: { 'light.a': 'on', 'lock.a': 'locked' } });
  expect(byId(closed, 'door:dr').rotation[1]).toBe(0);
  expect(byId(desc, 'ent:lk').color).toBe('live');
  expect(byId(closed, 'ent:lk').color).toBe('text-3');
  // walls: the low wall keeps its own height and colour
  const low = desc.parts.filter((p) => p.id.startsWith('wall:lw#'));
  expect(low.length).toBe(1);
  expect(low[0].size[1]).toBe(1);
  expect(low[0].color).toBe('map-wall');
  expect(low[0].position[1]).toBeCloseTo(-1.2 + 0.5, 6);
  expect(desc.parts.filter((p) => p.id.startsWith('wall:n#')).every((p) => p.size[1] === 3 && p.color === 'map-structure')).toBe(true);
  // connectors: stairs and a ramp as rising steps between the levels, the elevator a translucent prism
  const stairs = desc.parts.filter((p) => p.id.startsWith('conn:st#'));
  expect(stairs.length).toBeGreaterThanOrEqual(3);
  const rises = stairs.map((p) => p.size[1]);
  expect(rises.every((v, i) => i === 0 || (v - rises[i - 1]) * (rises[1] - rises[0]) >= 0)).toBe(true); // monotonic: going down from L0 to L1, the steps shrink toward the end
  expect(Math.max(...rises)).toBeCloseTo(1.2, 6);
  expect(desc.parts.filter((p) => p.id.startsWith('conn:rp#')).length).toBeGreaterThanOrEqual(6);
  const lift = byId(desc, 'conn:el');
  expect(lift.opacity).toBe(0.3);
  expect(lift.size[1]).toBeCloseTo(4.2, 6); // from the lower floor (-1.2) to the upper ceiling (0 + 3)
  expect(lift.size[2]).toBe(2);
  // the camera cone stops at the north wall 1.6 m in front of it while the door is locked; the unlocked door lets the middle rays through
  const cone = byId(closed, 'cam:c1#cone');
  expect(cone.polygon![0]).toEqual([0, 0]);
  expect(cone.polygon!.length).toBe(92);
  expect(Math.min(...cone.polygon!.map((p) => p[1]))).toBeGreaterThanOrEqual(-1.61);
  expect(cone.polygon!.some((p) => p[1] < -1.5)).toBe(true);
  expect(Math.min(...byId(desc, 'cam:c1#cone').polygon!.map((p) => p[1]))).toBeLessThan(-2);
  // the level switch and the layer switches
  const lower = buildScene({ ...input, level: 'L1' });
  expect(lower.parts.filter((p) => p.kind === 'wall').map((p) => p.id)).toEqual(['wall:lw#0']);
  expect(lower.parts.filter((p) => p.level_id === 'L0' && p.kind !== 'connector').length).toBe(0);
  expect(lower.parts.filter((p) => p.kind === 'connector').length).toBe(desc.parts.filter((p) => p.kind === 'connector').length); // connectors always
  expect(buildScene({ ...input, layers: { objects: false } }).parts.filter((p) => p.kind === 'object' || p.kind === 'glow').length).toBe(0);
  expect(buildScene({ ...input, layers: { cameras: false } }).parts.filter((p) => p.kind === 'camera' || p.kind === 'cone').length).toBe(0);
  expect(buildScene({ ...input, layers: { structure: false } }).parts.filter((p) => ['wall', 'floor', 'door', 'window', 'lintel', 'sill', 'head'].includes(p.kind)).length).toBe(0);
  // uncalibrated: the estimated scale, flagged
  const raw = { ...input.doc, dimensions: { ...input.doc.dimensions, scale_m_per_px: null, calibration: { status: 'missing' as const, method: null, pairs: [], residual_pct: null, reason: null } } };
  const est = buildScene({ ...input, doc: raw });
  expect(est.estimated).toBe(true);
  expect(est.scale_m_per_px).toBeCloseTo(0.2 / (0.006 * 1000), 9);
});

test('the isometric projection of the building page comes from the same description', () => {
  const desc = buildScene(sampleInput());
  const iso = isoProjection(desc);
  expect(iso.faces.length).toBeGreaterThan(20);
  expect(iso.faces.filter((f) => f.face === 'plate').length).toBe(2);
  expect(iso.faces.every((f) => f.points.length === 4 && f.points.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])))).toBe(true);
  expect(iso.faces.every((f) => f.points.every((p) => p[0] >= -10 && p[0] <= 130 && p[1] >= -40 && p[1] <= 100))).toBe(true); // around the 120 x 72 thumbnail, walls rising above the plate
  expect(JSON.stringify(isoProjection(desc))).toBe(JSON.stringify(iso));
  expect(isoProjection(buildScene({ ...sampleInput(), layers: { objects: false, cameras: false, entities: false, zones: false } })).faces.length).toBe(iso.faces.length); // objects and anchors are not part of the thumbnail
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /c/cloude/smplwisebms/frontend && npx playwright test tests/unit-scene-builder.spec.ts --project=desktop --reporter=line`
Expected: FAIL - `Cannot find module '../src/map/scene-builder'` (and `lookup3dOf` is not exported).

- [ ] **Step 3: The catalog lookup for 3D**

In `frontend/src/api/plan-catalog.ts`:

(a) Change the type import line to:

```ts
import type { CatalogLookup, GeomSize, ObjectShape } from '../map/geometry';
import type { Catalog3DLookup } from '../map/scene-builder';
```

(b) Before `export interface CatalogItem` add:

```ts
/** A relative part of a composite item (T087): a box or a cylinder, its size in metres and its offset from the item's
 * footprint centre (x right, y up, z down the plan) before the item's rotation. */
export interface MeshPart {
  shape: 'box' | 'cylinder';
  size: [number, number, number];
  offset: [number, number, number];
  color_token?: string;
}
```

(c) In `CatalogItem`, after `anchor_kinds: string[];` add:

```ts
  /** Composite items only (T087); null / absent for every other shape. */
  mesh?: MeshPart[] | null;
```

(d) After `lookupOf` add:

```ts
/** What the scene builder needs from the library for one item (T087): the shape, the colour, the role and the parts
 * of a composite. */
export function lookup3dOf(lib: CatalogLibrary): Catalog3DLookup {
  const m = new Map(lib.items.map((i) => [i.id, { shape: i.shape, color_token: i.color_token, role: i.role, mesh: i.shape === 'composite' && Array.isArray(i.mesh) ? i.mesh : null }]));
  return (id) => m.get(id);
}
```

- [ ] **Step 4: Write `scene-builder.ts`**

`frontend/src/map/scene-builder.ts`:

```ts
/**
 * Plan Studio 3D (T087, design 10.2 and 10.5): the deterministic scene description. The document, the live anchors and
 * states, the library and the zones go in; a sorted, JSON-serialisable list of parts comes out - boxes, cylinders,
 * prisms, sprites and lights with positions and sizes in metres, colours as design-token names and the id of the item
 * they stand for. No three.js here: scene-three.ts realises the description, unit-scene-builder.spec.ts pins it
 * (contracts/fixtures/plan_geometry/sample-v2.scene.json) and sw-floor-iso draws the building page from the same list.
 * Axes (design 17.1): x east = plan x, z south = plan y, y up; metres from the document's effective scale (the estimate
 * when uncalibrated, flagged). Rotation [pitch about x, yaw about y, 0] in degrees, yaw first (Euler order YXZ).
 */
import { buildPrimitives, effectiveScale, MAX_TRIBUNE_ROWS, type CatalogLookup, type ConnectorPrim, type DoorPrim, type GeometryDoc, type GeomLevel, type GeomObject, type ObjectPrim, type ObjectShape, type Pt, type Primitive, type WallPrim, type WindowPrim } from './geometry';
import { defaultLevelId } from './studio-ops';
import { blockingSegments, clipCoverage, isOpenState, type Seg } from './coverage';
import { anchor3d } from './anchor-3d';
import type { MeshPart } from '../api/plan-catalog';

export type { MeshPart };
export type PartKind = 'floor' | 'room' | 'label' | 'wall' | 'lintel' | 'sill' | 'head' | 'door' | 'window' | 'object' | 'connector' | 'camera' | 'cone' | 'entity' | 'glow';
export type PartShape = 'box' | 'cylinder' | 'prism' | 'sprite' | 'light';
export type Vec3 = [number, number, number];

export interface ScenePart {
  id: string;
  kind: PartKind;
  shape: PartShape;
  /** The centre of a box / cylinder / sprite / light; the origin of a prism (its polygon is relative, on the floor). */
  position: Vec3;
  /** box: [w, h, d]; cylinder: [diameter, h, diameter]; prism: [0, h, 0]; sprite: [w, h, 0]; light: [distance, 0, 0]. */
  size: Vec3;
  rotation: Vec3;
  /** A token name without the --sw- prefix (map-structure, obj-light, accent, ...): scene-three reads the value. */
  color: string;
  opacity: number;
  /** Parts that share a group become one InstancedMesh (box / cylinder only). */
  group: string | null;
  level_id: string | null;
  polygon?: [number, number][];
  text?: string;
  userData: { id: string; kind: string };
}

export interface SceneAnchor {
  id: string;
  resource_type: 'camera' | 'ha_entity';
  resource_id: string;
  x: number;
  y: number;
  rotation: number;
  fov: number | null;
  /** Fraction of the plan width (the anchor's coverage_radius); null = the canvas default cone. */
  radius: number | null;
  polygon: [number, number][] | null;
  level_id: string | null;
  layer_id: string;
  label: string;
  state: string | null;
  /** Cameras: the recorder's status; null = unknown. */
  online: boolean | null;
  mount_height_m: number | null;
  tilt_deg: number | null;
}
export interface SceneZone {
  id: string;
  name: string;
  polygon: { x: number; y: number }[];
  level_id?: string | null;
}
export interface SceneLayers {
  structure: boolean;
  objects: boolean;
  connectors: boolean;
  cameras: boolean;
  entities: boolean;
  zones: boolean;
}
export interface Catalog3D {
  shape: ObjectShape;
  color_token: string;
  role: string;
  mesh: MeshPart[] | null;
}
export type Catalog3DLookup = (itemId: string) => Catalog3D | undefined;
export interface SceneInput {
  doc: GeometryDoc;
  width: number;
  height: number;
  anchors: SceneAnchor[];
  entityStates: Record<string, string | null>;
  circuitStates: Record<string, string | null>;
  catalog?: Catalog3DLookup | null;
  zones?: SceneZone[];
  /** One level only (null / absent = every level). Connectors always show. */
  level?: string | null;
  layers?: Partial<SceneLayers>;
  coneRadiusPx?: number;
}
export interface SceneDescription {
  version: 'scene-1';
  units: 'm';
  estimated: boolean;
  scale_m_per_px: number;
  size: [number, number];
  centre: Vec3;
  levels: { id: string; elevation_m: number; ceiling_height_m: number }[];
  parts: ScenePart[];
  groups: Record<string, number>;
  stats: { parts: number; instanced: number; groups: number; walls: number; objects: number; cameras: number; entities: number };
}
export interface IsoFace {
  points: [number, number][];
  face: 'plate' | 'side' | 'top';
  color: string;
  opacity: number;
}
export interface IsoScene {
  faces: IsoFace[];
  levels: number;
}

export const DEFAULT_LAYERS: SceneLayers = { structure: true, objects: true, connectors: true, cameras: true, entities: true, zones: true };
/** The canvas default cone radius in plan pixels (sw-plan-canvas coneRadius). */
export const DEFAULT_CONE_RADIUS_PX = 140;
export const STATE_HE: Record<string, string> = { on: 'דולק', off: 'כבוי', open: 'פתוח', opening: 'נפתח', closed: 'סגור', closing: 'נסגר', locked: 'נעול', unlocked: 'לא נעול', unavailable: 'לא זמין', unknown: 'לא ידוע' };

const FLOOR_PLATE_M = 0.05;
const ROOM_TINT_M = 0.01;
const LABEL_HEIGHT_M = 0.1;
const LEAF_THICKNESS_M = 0.04;
const GLASS_THICKNESS_M = 0.02;
const DOOR_OPEN_DEG = 80;
const CAMERA_BODY: Vec3 = [0.12, 0.1, 0.24];
const STEP_RISE_M = 0.17;
const RAMP_STEP_M = 0.5;
const GLOW_DISTANCE_M = 6;
const MIN_STEP_M = 0.05;
const LEVEL_PAD_M = 0.5;

/** Half-up to 0.1 mm, the r2 rule of the primitives one digit further (metres, not pixels). */
export const r4 = (v: number): number => Math.floor(v * 1e4 + 0.5) / 1e4;
const v3 = (a: number, b: number, c: number): Vec3 => [r4(a), r4(b), r4(c)];
const deg = (rad: number): number => (rad * 180) / Math.PI;
const rad = (d: number): number => (d * Math.PI) / 180;
const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const groupKey = (shape: PartShape, color: string, opacity: number): string => `${shape}|${color}|${opacity}`;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A local offset (x right, z down the plan) turned by the yaw the part carries (the same mapping three applies). */
function turned(x: number, z: number, yawDeg: number): [number, number] {
  const t = rad(yawDeg);
  return [x * Math.cos(t) + z * Math.sin(t), -x * Math.sin(t) + z * Math.cos(t)];
}

/** Area-weighted centroid (the vertex mean for a degenerate ring) - the same maths as sw-plan-canvas.polygonCentroid. */
function centroid(poly: { x: number; y: number }[]): { x: number; y: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = poly.length || 1;
    return { x: poly.reduce((t, p) => t + p.x, 0) / n, y: poly.reduce((t, p) => t + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

class Builder {
  readonly parts: ScenePart[] = [];
  readonly scale: number;
  readonly estimated: boolean;
  readonly levels: GeomLevel[];
  readonly defaultLevel: GeomLevel;
  readonly layers: SceneLayers;
  readonly catalogLookup: CatalogLookup | undefined;
  private segCache = new Map<string, Seg[]>();

  constructor(readonly input: SceneInput) {
    const { scale, estimated } = effectiveScale(input.doc);
    this.scale = scale;
    this.estimated = estimated;
    this.levels = input.doc.levels.length ? [...input.doc.levels].sort(byId) : [{ id: defaultLevelId(input.doc), name: '', elevation_m: 0, ceiling_height_m: 2.8, is_default: true }];
    this.defaultLevel = this.levels.find((l) => l.id === defaultLevelId(input.doc)) ?? this.levels[0];
    this.layers = { ...DEFAULT_LAYERS, ...(input.layers ?? {}) };
    const cat = input.catalog;
    this.catalogLookup = cat ? (id) => { const c = cat(id); return c ? { shape: c.shape, icon: 'box', color_token: c.color_token } : undefined; } : undefined;
  }

  /** Plan pixels to metres. */
  m(px: number): number {
    return px * this.scale;
  }
  level(id: string | null | undefined): GeomLevel {
    return (id ? this.levels.find((l) => l.id === id) : undefined) ?? this.defaultLevel;
  }
  shown(levelId: string | null | undefined): boolean {
    const want = this.input.level ?? null;
    return want === null || this.level(levelId).id === want;
  }
  add(p: ScenePart): void {
    this.parts.push({ ...p, position: v3(...p.position), size: v3(...p.size), rotation: v3(...p.rotation), polygon: p.polygon?.map(([x, z]): [number, number] => [r4(x), r4(z)]) });
  }
  box(id: string, kind: PartKind, userData: ScenePart['userData'], centre: Vec3, size: Vec3, yaw: number, color: string, levelId: string | null, opacity = 1, pitch = 0, instanced = true): void {
    this.add({ id, kind, shape: 'box', position: centre, size, rotation: [pitch, yaw, 0], color, opacity, group: instanced ? groupKey('box', color, opacity) : null, level_id: levelId, userData });
  }
  segments(levelId: string): Seg[] {
    let s = this.segCache.get(levelId);
    if (!s) {
      s = blockingSegments(this.input.doc, this.input.width, this.input.height, levelId, this.input.entityStates, this.catalogLookup);
      this.segCache.set(levelId, s);
    }
    return s;
  }

  /** The extent of what sits on a level (walls, objects, zones), in metres, padded; null when the level is empty. */
  private bounds(levelId: string): [number, number, number, number] | null {
    const { doc, width, height, zones } = this.input;
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    const take = (x: number, y: number) => {
      minX = Math.min(minX, x * width);
      maxX = Math.max(maxX, x * width);
      minZ = Math.min(minZ, y * height);
      maxZ = Math.max(maxZ, y * height);
    };
    for (const w of doc.walls) if (this.level(w.level_id).id === levelId) for (const p of w.polyline) take(p[0], p[1]);
    for (const o of doc.objects) if (this.level(o.level_id).id === levelId) take(o.position[0], o.position[1]);
    for (const lb of doc.labels) if (this.level(lb.level_id).id === levelId) take(lb.position[0], lb.position[1]);
    for (const c of doc.connectors) if (this.level(c.level_from).id === levelId || (c.level_to && this.level(c.level_to).id === levelId)) for (const p of c.polyline) take(p[0], p[1]);
    for (const z of zones ?? []) if (this.level(z.level_id).id === levelId) for (const p of z.polygon) take(p.x, p.y);
    if (!Number.isFinite(minX)) return null;
    return [this.m(minX) - LEVEL_PAD_M, this.m(minZ) - LEVEL_PAD_M, this.m(maxX) + LEVEL_PAD_M, this.m(maxZ) + LEVEL_PAD_M];
  }

  floors(): void {
    if (!this.layers.structure) return;
    const W = this.m(this.input.width);
    const D = this.m(this.input.height);
    for (const lv of this.levels) {
      if (!this.shown(lv.id)) continue;
      const box = lv.id === this.defaultLevel.id ? ([0, 0, W, D] as [number, number, number, number]) : this.bounds(lv.id);
      if (!box) continue;
      const [x0, z0, x1, z1] = [Math.max(0, box[0]), Math.max(0, box[1]), Math.min(W, box[2]), Math.min(D, box[3])];
      this.box(`floor:${lv.id}`, 'floor', { id: lv.id, kind: 'level' }, [(x0 + x1) / 2, lv.elevation_m - FLOOR_PLATE_M / 2, (z0 + z1) / 2], [x1 - x0, FLOOR_PLATE_M, z1 - z0], 0, 'map-bg', lv.id, 1, 0, false);
    }
  }

  rooms(): void {
    if (!this.layers.zones) return;
    const { width, height } = this.input;
    for (const z of [...(this.input.zones ?? [])].sort(byId)) {
      if (z.polygon.length < 3 || !this.shown(z.level_id)) continue;
      const lv = this.level(z.level_id);
      this.add({ id: `room:${z.id}`, kind: 'room', shape: 'prism', position: [0, lv.elevation_m, 0], size: [0, ROOM_TINT_M, 0], rotation: [0, 0, 0], color: 'accent', opacity: 0.1, group: null, level_id: lv.id,
        polygon: z.polygon.map((p): [number, number] => [this.m(p.x * width), this.m(p.y * height)]), userData: { id: z.id, kind: 'zone' } });
      if (z.name) {
        const c = centroid(z.polygon);
        this.add({ id: `room:${z.id}#label`, kind: 'label', shape: 'sprite', position: [this.m(c.x * width), lv.elevation_m + LABEL_HEIGHT_M, this.m(c.y * height)], size: [Math.max(1, 0.2 * z.name.length), 0.4, 0], rotation: [0, 0, 0],
          color: 'text-3', opacity: 1, group: null, level_id: lv.id, text: z.name, userData: { id: z.id, kind: 'zone' } });
      }
    }
  }

  structure(prims: Primitive[]): void {
    if (!this.layers.structure) return;
    const { doc } = this.input;
    const walls = new Map(doc.walls.map((w) => [w.id, w]));
    const openings = new Map(doc.openings.map((o) => [o.id, o]));
    const thicknessOf = new Map<string, number>();
    for (const p of prims) {
      if (p.kind !== 'wall') continue;
      const w = walls.get(p.id);
      if (!w) continue;
      const lv = this.level(w.level_id);
      const h = w.height_m ?? lv.ceiling_height_m;
      const base = lv.elevation_m + (w.base_z_m || 0);
      const t = this.m(p.width);
      thicknessOf.set(w.id, t);
      const color = w.kind === 'railing' || w.kind === 'low' ? 'map-wall' : 'map-structure';
      for (let i = 1; i < p.points.length; i++) {
        const [ax, az] = [this.m(p.points[i - 1][0]), this.m(p.points[i - 1][1])];
        const [bx, bz] = [this.m(p.points[i][0]), this.m(p.points[i][1])];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 1e-4) continue;
        // one box per straight segment of the cut wall part: "wall:<id>#<part>" and "wall:<id>#<part>.<segment>" for a bend
        this.box(`wall:${w.id}#${(p as WallPrim).part}${i > 1 ? `.${i - 1}` : ''}`, 'wall', { id: w.id, kind: 'wall' }, [(ax + bx) / 2, base + h / 2, (az + bz) / 2], [len, h, t], -deg(Math.atan2(bz - az, bx - ax)), color, lv.id);
      }
    }
    for (const p of prims) {
      if (p.kind !== 'door' && p.kind !== 'window') continue;
      const o = openings.get(p.id);
      const w = o ? walls.get(o.wall_id) : undefined;
      if (!o || !w) continue;
      const lv = this.level(w.level_id);
      const wallH = w.height_m ?? lv.ceiling_height_m;
      const base = lv.elevation_m + (w.base_z_m || 0);
      const t = thicknessOf.get(w.id) ?? this.m(1);
      const gap = (p as DoorPrim | WindowPrim).gap;
      const [g0x, g0z] = [this.m(gap[0][0]), this.m(gap[0][1])];
      const [g1x, g1z] = [this.m(gap[1][0]), this.m(gap[1][1])];
      const len = Math.hypot(g1x - g0x, g1z - g0z);
      if (len < 1e-4) continue;
      const yaw = -deg(Math.atan2(g1z - g0z, g1x - g0x));
      const cx = (g0x + g1x) / 2;
      const cz = (g0z + g1z) / 2;
      const ud = { id: o.id, kind: 'opening' };
      if (p.kind === 'door') {
        const lintel = wallH - o.height_m;
        if (lintel > 0.01) this.box(`lintel:${o.id}`, 'lintel', ud, [cx, base + o.height_m + lintel / 2, cz], [len, lintel, t], yaw, 'map-structure', lv.id);
        const ref = o.anchor_ref;
        const open = !!ref && ref.resource_type === 'ha_entity' && isOpenState(this.input.entityStates[ref.resource_id]);
        const hingeAtStart = (o.hinge || 'start') === 'start';
        const [hx, hz] = hingeAtStart ? [g0x, g0z] : [g1x, g1z];
        const swing = open ? (o.swing === 'right' ? -DOOR_OPEN_DEG : DOOR_OPEN_DEG) : 0;
        const leafYaw = yaw + (hingeAtStart ? swing : -swing);
        const [ox, oz] = turned(hingeAtStart ? len / 2 : -len / 2, 0, leafYaw);
        this.box(`door:${o.id}`, 'door', ud, [hx + ox, base + o.height_m / 2, hz + oz], [len, o.height_m, LEAF_THICKNESS_M], leafYaw, 'accent', lv.id, 0.9, 0, false);
      } else {
        if (o.sill_m > 0.01) this.box(`sill:${o.id}`, 'sill', ud, [cx, base + o.sill_m / 2, cz], [len, o.sill_m, t], yaw, 'map-structure', lv.id);
        const head = wallH - (o.sill_m + o.height_m);
        if (head > 0.01) this.box(`head:${o.id}`, 'head', ud, [cx, base + o.sill_m + o.height_m + head / 2, cz], [len, head, t], yaw, 'map-structure', lv.id);
        this.box(`window:${o.id}`, 'window', ud, [cx, base + o.sill_m + o.height_m / 2, cz], [len, o.height_m, GLASS_THICKNESS_M], yaw, 'map-glass', lv.id, 0.35, 0, false);
      }
    }
    for (const lb of [...doc.labels].sort(byId)) {
      if (!this.shown(lb.level_id)) continue;
      const lv = this.level(lb.level_id);
      const text = String(lb.text ?? '');
      if (!text) continue;
      this.add({ id: `label:${lb.id}`, kind: 'label', shape: 'sprite', position: [this.m(lb.position[0] * this.input.width), lv.elevation_m + LABEL_HEIGHT_M, this.m(lb.position[1] * this.input.height)], size: [Math.max(1, 0.2 * text.length), 0.4, 0],
        rotation: [0, 0, 0], color: 'map-label', opacity: 1, group: null, level_id: lv.id, text, userData: { id: lb.id, kind: 'label' } });
    }
  }

  objects(prims: Primitive[]): void {
    if (!this.layers.objects) return;
    const { doc, catalog, entityStates, circuitStates } = this.input;
    const objects = new Map(doc.objects.map((o) => [o.id, o]));
    for (const p of prims) {
      if (p.kind !== 'object') continue;
      const o = objects.get(p.id);
      if (!o) continue;
      const item = catalog?.(o.item_id);
      const lv = this.level(o.level_id);
      const hM = o.size?.h_m || 0.05;
      const zBase = (o.z_m || 0) >= 0 ? o.z_m || 0 : lv.ceiling_height_m + o.z_m;
      const y0 = lv.elevation_m + zBase;
      const cx = this.m(p.cx);
      const cz = this.m(p.cy);
      const w = this.m(p.w);
      const d = this.m(p.h);
      const yaw = -p.rotation;
      const entityId = p.anchor?.startsWith('ha_entity:') ? p.anchor.slice('ha_entity:'.length) : null;
      const on = (p.circuit_id !== null && circuitStates[p.circuit_id] === 'on') || (entityId !== null && entityStates[entityId] === 'on');
      const lamp = item?.role === 'light' || p.color === 'light';
      const color = on && lamp ? 'map-glow' : `obj-${p.color}`;
      const ud = { id: o.id, kind: 'object' };
      this.objectParts(o, p, item, cx, cz, w, d, hM, y0, yaw, color, lv.id, ud);
      if (on && lamp) this.add({ id: `obj:${o.id}#glow`, kind: 'glow', shape: 'light', position: [cx, y0 + hM / 2, cz], size: [GLOW_DISTANCE_M, 0, 0], rotation: [0, 0, 0], color: 'map-glow', opacity: 1, group: null, level_id: lv.id, userData: ud });
    }
  }

  private objectParts(o: GeomObject, p: ObjectPrim, item: Catalog3D | undefined, cx: number, cz: number, w: number, d: number, hM: number, y0: number, yaw: number, color: string, levelId: string, ud: ScenePart['userData']): void {
    const shape = p.shape;
    if (shape === 'stepped') {
      const rowsRaw = o.params?.rows;
      const rows = isNum(rowsRaw) && Number.isInteger(rowsRaw) && rowsRaw >= 2 ? Math.min(rowsRaw, MAX_TRIBUNE_ROWS) : 4;
      const stepRaw = o.params?.step_height_m;
      const stepH = isNum(stepRaw) && stepRaw > 0 ? stepRaw : hM / rows;
      const rowD = d / rows;
      for (let i = 0; i < rows; i++) {
        const [ox, oz] = turned(0, -d / 2 + (i + 0.5) * rowD, yaw);
        const h = Math.min(hM, stepH * (i + 1));
        this.box(`obj:${o.id}#${i}`, 'object', ud, [cx + ox, y0 + h / 2, cz + oz], [w, h, rowD], yaw, color, levelId, 1, 0, false);
      }
      return;
    }
    if (shape === 'composite' && item?.mesh && item.mesh.length) {
      item.mesh.forEach((m, i) => {
        const [ox, oz] = turned(m.offset[0], m.offset[2], yaw);
        const c = m.color_token ? `obj-${m.color_token}` : color;
        this.add({ id: `obj:${o.id}#${i}`, kind: 'object', shape: m.shape, position: [cx + ox, y0 + m.offset[1], cz + oz], size: [m.size[0], m.size[1], m.size[2]], rotation: [0, yaw, 0], color: c, opacity: 1, group: groupKey(m.shape, c, 1), level_id: levelId, userData: ud });
      });
      return;
    }
    if (shape === 'extruded_polygon') {
      const raw = o.params?.polygon;
      const poly = Array.isArray(raw) ? raw.filter((q): q is [number, number] => Array.isArray(q) && q.length === 2 && isNum(q[0]) && isNum(q[1])) : [];
      if (poly.length >= 3) {
        this.add({ id: `obj:${o.id}`, kind: 'object', shape: 'prism', position: [cx, y0, cz], size: [0, hM, 0], rotation: [0, 0, 0], color, opacity: 1, group: null, level_id: levelId, polygon: poly.map((q) => turned(q[0], q[1], yaw)), userData: ud });
        return;
      }
    }
    const s: PartShape = shape === 'cylinder' ? 'cylinder' : 'box';
    this.add({ id: `obj:${o.id}`, kind: 'object', shape: s, position: [cx, y0 + hM / 2, cz], size: s === 'cylinder' ? [Math.max(w, d), hM, Math.max(w, d)] : [w, hM, d], rotation: [0, yaw, 0], color, opacity: 1, group: groupKey(s, color, 1), level_id: levelId, userData: ud });
  }

  connectors(prims: Primitive[]): void {
    if (!this.layers.connectors) return;
    for (const p of prims) {
      if (p.kind !== 'connector' || (p as ConnectorPrim).ckind === 'tribune') continue;
      const c = p as ConnectorPrim;
      const from = this.level(c.level_from);
      const to = c.level_to ? this.level(c.level_to) : null;
      const e0 = from.elevation_m;
      const e1 = to ? to.elevation_m : from.elevation_m + from.ceiling_height_m;
      const [ax, az] = [this.m(c.points[0][0]), this.m(c.points[0][1])];
      const [bx, bz] = [this.m(c.points[c.points.length - 1][0]), this.m(c.points[c.points.length - 1][1])];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-4) continue;
      const yaw = -deg(Math.atan2(bz - az, bx - ax));
      const width = this.m(c.width);
      const ud = { id: c.id, kind: 'connector' };
      const rise = e1 - e0;
      if (c.ckind === 'elevator') {
        const lower = Math.min(e0, e1);
        const upper = to && to.elevation_m > from.elevation_m ? to : from;
        const top = upper.elevation_m + upper.ceiling_height_m; // the shaft reaches the ceiling of the upper level
        this.box(`conn:${c.id}`, 'connector', ud, [(ax + bx) / 2, (lower + top) / 2, (az + bz) / 2], [L, top - lower, width], yaw, 'obj-circulation', from.id, 0.3, 0, false);
        continue;
      }
      const n = c.ckind === 'ramp' ? Math.max(6, Math.round(L / RAMP_STEP_M)) : Math.max(3, Math.round(Math.abs(rise) / STEP_RISE_M));
      const lower = Math.min(e0, e1);
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const h = Math.max(MIN_STEP_M, rise >= 0 ? (Math.abs(rise) * (i + 1)) / n : (Math.abs(rise) * (n - i)) / n);
        this.box(`conn:${c.id}#${i}`, 'connector', ud, [ax + (bx - ax) * f, lower + h / 2, az + (bz - az) * f], [L / n, h, width], yaw, 'obj-circulation', from.id);
      }
    }
  }

  anchors(): void {
    const { anchors, doc, width, height, coneRadiusPx } = this.input;
    const bodies = new Set(doc.objects.filter((o) => o.anchor_ref?.resource_id).map((o) => `${o.anchor_ref!.resource_type}:${o.anchor_ref!.resource_id}`));
    for (const a of [...anchors].sort(byId)) {
      if (!this.shown(a.level_id)) continue;
      const lv = this.level(a.level_id);
      const { mount_height_m: mount, tilt_deg: tilt } = anchor3d(a);
      const px = a.x * width;
      const py = a.y * height;
      const x = this.m(px);
      const z = this.m(py);
      if (a.resource_type === 'camera') {
        if (!this.layers.cameras) continue;
        const color = a.online === false ? 'offline' : 'accent';
        const ud = { id: a.id, kind: 'camera' };
        this.box(`cam:${a.id}`, 'camera', ud, [x, lv.elevation_m + mount, z], CAMERA_BODY, -a.rotation, color, lv.id, 1, tilt, false);
        if (a.fov && a.fov > 0) {
          const radiusPx = a.radius ? Math.max(12, a.radius * width) : coneRadiusPx ?? DEFAULT_CONE_RADIUS_PX;
          const pts: Pt[] = a.polygon && a.polygon.length >= 3 ? a.polygon.map(([qx, qy]) => [qx * width, qy * height]) : clipCoverage([px, py], a.rotation, a.fov, radiusPx, this.segments(lv.id));
          this.add({ id: `cam:${a.id}#cone`, kind: 'cone', shape: 'prism', position: [x, lv.elevation_m, z], size: [0, mount, 0], rotation: [0, 0, 0], color, opacity: 0.12, group: null, level_id: lv.id, polygon: pts.map((q): [number, number] => [this.m(q[0] - px), this.m(q[1] - py)]), userData: ud });
        }
        continue;
      }
      if (!this.layers.entities || bodies.has(`ha_entity:${a.resource_id}`)) continue;
      const state = a.state;
      const color = state === null || state === 'unavailable' || state === 'unknown' ? 'stale' : isOpenState(state) ? 'live' : 'text-3';
      const text = `${a.label}${state && STATE_HE[state] ? ` · ${STATE_HE[state]}` : ''}`;
      const ud = { id: a.id, kind: 'entity' };
      this.add({ id: `ent:${a.id}`, kind: 'entity', shape: 'sprite', position: [x, lv.elevation_m + mount + 0.25, z], size: [Math.max(1.2, 0.18 * text.length), 0.36, 0], rotation: [0, 0, 0], color, opacity: 1, group: null, level_id: lv.id, text, userData: ud });
      if (a.layer_id === 'lights' && state === 'on') this.add({ id: `ent:${a.id}#glow`, kind: 'glow', shape: 'light', position: [x, lv.elevation_m + mount, z], size: [GLOW_DISTANCE_M, 0, 0], rotation: [0, 0, 0], color: 'map-glow', opacity: 1, group: null, level_id: lv.id, userData: ud });
    }
  }

  finish(): SceneDescription {
    this.parts.sort(byId);
    const groups: Record<string, number> = {};
    let instanced = 0;
    for (const p of this.parts) {
      if (!p.group) continue;
      groups[p.group] = (groups[p.group] ?? 0) + 1;
      instanced++;
    }
    const count = (k: PartKind) => this.parts.filter((p) => p.kind === k).length;
    const W = r4(this.m(this.input.width));
    const D = r4(this.m(this.input.height));
    return {
      version: 'scene-1', units: 'm', estimated: this.estimated, scale_m_per_px: this.scale, size: [W, D], centre: v3(W / 2, 0, D / 2),
      levels: this.levels.filter((l) => this.shown(l.id)).map((l) => ({ id: l.id, elevation_m: l.elevation_m, ceiling_height_m: l.ceiling_height_m })),
      parts: this.parts, groups,
      stats: { parts: this.parts.length, instanced, groups: Object.keys(groups).length, walls: count('wall'), objects: count('object'), cameras: count('camera'), entities: count('entity') },
    };
  }
}

/** The description of one floor: the same document, anchors, states, library and zones always give the same JSON. */
export function buildScene(input: SceneInput): SceneDescription {
  const b = new Builder(input);
  const prims = buildPrimitives(input.doc, input.width, input.height, input.level ?? null, b.catalogLookup);
  b.floors();
  b.rooms();
  b.structure(prims);
  b.objects(prims);
  b.connectors(prims);
  b.anchors();
  return b.finish();
}

// ---------------------------------------------------------------- the building page (SC03)

const ISO_KINDS: readonly PartKind[] = ['floor', 'wall', 'lintel', 'sill', 'head', 'connector'];

/** The isometric thumbnail of the building page from the same description: floor plates and the box parts of the
 * structure and the connectors (objects and anchors are left out), projected like sw-floor-iso always did
 * (u = x / W, v = z / D → screen (60 + (u − v) · 58, 6 + (u + v) · 26)), heights scaled so a wall as high as the plan
 * is deep spans the plate; faces sorted far to near, each box's sides before its top. */
export function isoProjection(desc: SceneDescription): IsoScene {
  const [W, D] = desc.size;
  const kh = 52 / Math.max(W, D, 1e-6);
  const proj = (x: number, y: number, z: number): [number, number] => {
    const u = x / (W || 1);
    const v = z / (D || 1);
    return [Math.round((60 + (u - v) * 58) * 10) / 10, Math.round((6 + (u + v) * 26 - y * kh) * 10) / 10];
  };
  const faces: { depth: number; order: number; face: IsoFace }[] = [];
  let plates = 0;
  for (const p of desc.parts) {
    if (p.shape !== 'box' || !ISO_KINDS.includes(p.kind)) continue;
    const [cx, cy, cz] = p.position;
    const [w, h, d] = p.size;
    const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]) => { const [ox, oz] = turned((sx * w) / 2, (sz * d) / 2, p.rotation[1]); return [cx + ox, cz + oz] as [number, number]; });
    const depth = (cx / (W || 1)) + (cz / (D || 1));
    const top = cy + h / 2;
    const bottom = cy - h / 2;
    if (p.kind === 'floor') {
      plates++;
      faces.push({ depth: -1e9 + plates, order: 0, face: { points: corners.map(([x, z]) => proj(x, top, z)), face: 'plate', color: p.color, opacity: p.opacity } });
      continue;
    }
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      faces.push({ depth, order: 1, face: { points: [proj(a[0], bottom, a[1]), proj(b[0], bottom, b[1]), proj(b[0], top, b[1]), proj(a[0], top, a[1])], face: 'side', color: p.color, opacity: p.opacity } });
    }
    faces.push({ depth, order: 2, face: { points: corners.map(([x, z]) => proj(x, top, z)), face: 'top', color: p.color, opacity: p.opacity } });
  }
  faces.sort((a, b) => a.depth - b.depth || a.order - b.order);
  return { faces: faces.map((f) => f.face), levels: desc.levels.length };
}
```

- [ ] **Step 5: Generate the golden, then run the spec twice**

```bash
cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && SCENE_WRITE=1 npx playwright test tests/unit-scene-builder.spec.ts --project=desktop --reporter=line && npx playwright test tests/unit-scene-builder.spec.ts tests/unit-coverage.spec.ts tests/unit-geometry.spec.ts tests/unit-geometry-2.spec.ts tests/unit-plan-detect.spec.ts --project=desktop --reporter=line
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/geometry_golden.py --check; echo "golden $?"
```

Expected: `tsc` exit 0; the first run prints `written …sample-v2.scene.json: N parts` and passes; the second run (without `SCENE_WRITE`) passes every spec (`3 passed` for the builder); `golden 0` (the primitives golden is untouched). Open the written JSON once and check by eye that it starts with `{"version": "scene-1"` and that every number has at most four decimals. If the hall test fails on a count or a colour, fix the builder, never the expectation, unless the expectation contradicts the interface block above (then say so in the commit message).

- [ ] **Step 6: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/scene-builder.ts frontend/src/api/plan-catalog.ts contracts/fixtures/plan_geometry/sample-v2.scene.json frontend/tests/unit-scene-builder.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): deterministic scene description of a floor - walls, openings, objects, connectors, cameras, entities, the pinned fixture (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 5: The three realisation (`scene-three.ts`) and the `sw-plan-3d` element, hosted for its browser test by the style guide

**Files:**
- Create: `frontend/src/map/scene-three.ts`
- Create: `frontend/src/map/sw-plan-3d.ts`
- Create: `frontend/src/fixtures/demo-3d.ts` (the demo floor as a scene input - the style guide and the demo mode of the floor map use it)
- Modify: `frontend/src/screens/styleguide-screen.ts` (a "תלת-ממד סכמטי" section that loads the element on demand)
- Modify: `frontend/src/components/sw-icon.ts` (`cube`)
- Modify: `frontend/tests/unit-three-chunk.spec.ts` (the `dist/assets` assertions)
- Test: `frontend/tests/unit-plan-3d.spec.ts` (browser, preview in demo mode, no backend)

**Interfaces:**
- Consumes: `three-bundle.ts` (Task 1), `SceneDescription` / `ScenePart` / `Vec3` (Task 4), `webglAvailable` (Task 1).
- Produces:
  - `scene-three.ts`: `type ScenePreset = 'top' | 'iso' | { camera: string }` (the part id `cam:<anchor id>`), `interface SceneHit { id: string; kind: string; partId: string }`, `class SceneView` with `constructor(opts: { mount: HTMLElement; color: (token: string) => string; onSelect: (hit: SceneHit | null) => void; onHover: (hit: SceneHit | null, x: number, y: number) => void; onFrame: (frames: number, fps: number) => void })`, `setDescription(desc)`, `setSelected(sourceId: string | null)`, `setPreset(preset)`, `projectPoint(p: Vec3): { x: number; y: number } | null`, `resize()`, `exportGltf(): Promise<Record<string, unknown>>`, `dispose()`; constants `SMALL_PART_M = 0.6`, `HIDE_SMALL_ABOVE_PARTS = 3000`, `HIDE_SMALL_DISTANCE_M = 45`.
  - `sw-plan-3d.ts`: element `<sw-plan-3d>` with properties `description: SceneDescription | null`, `selectedId: string | null` (a SOURCE id: anchor / object / zone id), `preset: ScenePreset`, `cameras: { id: string; label: string }[]` (anchor ids for the "from camera" select), `labels: Record<string, string>` (source id → hover label), `exportName: string`; events `part-select` (`{ id: string | null; kind: string | null }`), `part-hover` (`{ id, kind, label, x, y } | null`); methods `toScreen(p: Vec3)`, `exportGltf()`, `download()`; attributes it maintains: `data-ready`, `data-parts`, `data-preset` (`top | iso | camera`), `data-selected` (the source id or empty), `data-frames`, `data-fps`, `data-estimated`; DOM hooks `[data-preset-top]`, `[data-preset-iso]`, `[data-preset-camera]` (a `<select>`), `[data-export-gltf]`, `[data-3d-tip]`, `[data-3d-spinner]`.
  - `demo-3d.ts`: `demoSceneInput(floorId: string): SceneInput | null` (the demo rooms as walls with a door each, a lamp per room, six chairs, the demo cameras and entities as anchors; 60 px per metre).
  - `sw-icon`: `cube`.

- [ ] **Step 1: Write the failing browser test**

`frontend/tests/unit-plan-3d.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// Plan Studio phase 4 (T087): the 3D element in a browser without a backend. The style guide loads it on demand (the three
// chunk is fetched only then), it renders the demo floor, the presets change the view, a click on a wall is echoed as the
// selection, hovering shows a label and the export answers a glTF. Headless Chromium draws WebGL through SwiftShader;
// frame rates are measured in real Chrome by the live spec (Task 10), never asserted here.
test('the 3D element: lazy chunk, parts, presets, selection echo, hover, export', async ({ page }) => {
  test.setTimeout(90_000);
  const chunkRequests: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
  });
  await page.goto('/#/styleguide');
  await expect(page.locator('styleguide-screen [data-3d-demo-load]')).toBeVisible({ timeout: 20000 });
  expect(chunkRequests, 'three is not fetched before the first click').toHaveLength(0);
  await page.locator('styleguide-screen [data-3d-demo-load]').click();
  const el = page.locator('styleguide-screen sw-plan-3d');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  expect(chunkRequests).toHaveLength(1);
  expect(Number(await el.getAttribute('data-parts'))).toBeGreaterThan(20);
  await expect(el).toHaveAttribute('data-preset', 'iso');
  await el.locator('[data-preset-top]').click();
  await expect(el).toHaveAttribute('data-preset', 'top');
  await el.locator('[data-preset-camera]').selectOption('cam-1');
  await expect(el).toHaveAttribute('data-preset', 'camera');
  await el.locator('[data-preset-top]').click();
  await expect(el).toHaveAttribute('data-preset', 'top');
  await expect.poll(async () => Number(await el.getAttribute('data-frames'))).toBeGreaterThan(5); // it renders continuously
  // a click on a wall: the element projects the part's centre, the click lands there, the selection is echoed
  const wall = await el.evaluate((node) => {
    const e = node as unknown as { description: { parts: { id: string; kind: string; position: [number, number, number]; userData: { id: string } }[] }; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    const w = e.description.parts.find((p) => p.kind === 'wall')!;
    return { id: w.userData.id, at: e.toScreen(w.position) };
  });
  expect(wall.at).toBeTruthy();
  const box = (await el.boundingBox())!;
  await page.mouse.click(box.x + wall.at!.x, box.y + wall.at!.y);
  await expect(el).toHaveAttribute('data-selected', wall.id);
  await expect(page.locator('styleguide-screen [data-3d-demo-selected]')).toHaveText(wall.id);
  await page.mouse.move(box.x + wall.at!.x + 2, box.y + wall.at!.y + 2);
  await expect(el.locator('[data-3d-tip]')).toBeAttached();
  await expect(el.locator('[data-3d-tip]')).toContainText('קיר');
  // a click on the empty floor clears the selection
  const floorAt = await el.evaluate((node) => (node as unknown as { toScreen: (p: [number, number, number]) => { x: number; y: number } | null }).toScreen([0.6, 0, 0.6]));
  await page.mouse.click(box.x + floorAt!.x, box.y + floorAt!.y);
  await expect(el).toHaveAttribute('data-selected', '');
  // the export is a glTF JSON with nodes
  const gltf = await el.evaluate(async (node) => {
    const g = await (node as unknown as { exportGltf: () => Promise<{ asset: { generator: string }; nodes: unknown[] }> }).exportGltf();
    return { generator: g.asset.generator, nodes: g.nodes.length };
  });
  expect(gltf.generator).toContain('GLTFExporter');
  expect(gltf.nodes).toBeGreaterThan(5);
});
```

Add to `frontend/tests/unit-three-chunk.spec.ts` (after the first test):

```ts
test('the app build keeps three out of the entry and in one lazy chunk under 200 KB gzip', () => {
  const assets = path.join(FRONTEND, 'dist', 'assets');
  test.skip(!fs.existsSync(assets), 'run npm run build first (frontend/dist is missing)');
  const files = fs.readdirSync(assets);
  const three = files.filter((f) => /^three-[\w-]+\.js$/.test(f));
  expect(three, 'exactly one three chunk in dist').toHaveLength(1);
  const gz = gzipBytes(path.join(assets, three[0]));
  console.log(`dist three chunk: ${three[0]} ${gz} bytes gzip`);
  expect(gz).toBeLessThanOrEqual(LIMIT_GZIP);
  const entry = files.filter((f) => /^index-[\w-]+\.js$/.test(f));
  expect(entry).toHaveLength(1);
  const entrySrc = fs.readFileSync(path.join(assets, entry[0]), 'utf8');
  expect(entrySrc).not.toContain('WebGLRenderer'); // no three code in the entry
  expect(entrySrc).not.toMatch(/from"\.\/three-[\w-]+\.js"/); // and no static import of the chunk
  const view = files.filter((f) => /^sw-plan-3d-[\w-]+\.js$/.test(f));
  expect(view, 'the 3D view is its own lazy chunk').toHaveLength(1);
  const viewSrc = fs.readFileSync(path.join(assets, view[0]), 'utf8');
  expect(viewSrc).toMatch(/from"\.\/three-[\w-]+\.js"/); // the view pulls the library in, relatively (the Ingress rule)
  expect(viewSrc).not.toContain('"/assets/');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /c/cloude/smplwisebms/frontend && npm run build && npx playwright test tests/unit-plan-3d.spec.ts tests/unit-three-chunk.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: the element test FAILS (`[data-3d-demo-load]` is not on the style guide); the dist test FAILS (`exactly one three chunk in dist` - there is none yet).

- [ ] **Step 3: The demo scene input**

`frontend/src/fixtures/demo-3d.ts`:

```ts
/**
 * The demo floors as a 3D scene input (T087): each demo room becomes a walled room with a door and a ceiling lamp, the
 * first room gets six chairs, the demo cameras and entities become anchors whose ids are the demo ids the floor map
 * already selects (cam-1, light.lobby, ...), so the demo card opens from a 3D click. Used by the style guide (the element's
 * browser test) and by the floor map in demo mode; never with a backend.
 */
import { demoCameras, demoEntities, demoFloors, demoRooms } from './demo';
import type { GeometryDoc, GeomObject, GeomOpening, GeomWall } from '../map/geometry';
import type { Catalog3DLookup, SceneAnchor, SceneInput } from '../map/scene-builder';

const PX_PER_M = 60;

const demoCatalog: Catalog3DLookup = (id) => (id.startsWith('light.')
  ? { shape: 'cylinder', color_token: 'light', role: 'light', mesh: null }
  : { shape: 'box', color_token: 'furniture', role: 'furniture', mesh: null });

const object = (id: string, item_id: string, position: [number, number], size: GeomObject['size'], z_m: number): GeomObject => ({
  id, item_id, level_id: 'L0', position, rotation_deg: 0, size, z_m, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {},
});

export function demoSceneInput(floorId: string): SceneInput | null {
  const floor = demoFloors.find((f) => f.id === floorId);
  const rooms = demoRooms(floorId);
  if (!floor?.hasPlan || !rooms.length) return null;
  const walls: GeomWall[] = [];
  const openings: GeomOpening[] = [];
  const objects: GeomObject[] = [];
  rooms.forEach((r, i) => {
    const id = `dw${i}`;
    walls.push({ id, level_id: 'L0', polyline: [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h], [r.x, r.y]], thickness_m: 0.15, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
    openings.push({ id: `do${i}`, wall_id: id, t: 0.12, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'left', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} });
    objects.push(object(`dl${i}`, 'light.ceiling', [r.x + r.w / 2, r.y + r.h / 2], { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, -0.3));
  });
  const r0 = rooms[0];
  for (let k = 0; k < 6; k++) objects.push(object(`dc${k}`, 'chair.basic', [r0.x + r0.w * (0.25 + 0.25 * (k % 3)), r0.y + r0.h * (0.35 + 0.3 * Math.floor(k / 3))], { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, 0));
  const doc: GeometryDoc = {
    schema_version: '2.0', plan_version_id: `demo-${floorId}`, floor_id: floorId, source: { sha256: '', file_name: 'demo', mime: 'image/svg+xml', page: 1 },
    dimensions: { width_px: floor.planWidth, height_px: floor.planHeight, scale_m_per_px: 1 / PX_PER_M, calibration: { status: 'measured', method: 'manual', pairs: [], residual_pct: null, reason: null } },
    transform: { rotation: 0, crop: null },
    levels: [{ id: 'L0', name: 'קומה', elevation_m: 0, ceiling_height_m: 3, is_default: true }],
    walls, openings, rooms: [], objects, circuits: [], connectors: [], labels: [], groups: [], uncertain_regions: [], uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'demo', tokens_version: 'map-1', detector_version: null },
  };
  const cams = demoCameras.filter((c) => c.floorId === floorId);
  const ents = demoEntities.filter((e) => e.floorId === floorId);
  const anchors: SceneAnchor[] = [
    ...cams.map((c): SceneAnchor => ({ id: c.id, resource_type: 'camera', resource_id: c.id, x: c.x, y: c.y, rotation: c.rotation, fov: c.fov, radius: null, polygon: null, level_id: null, layer_id: 'cameras', label: c.name, state: null, online: c.state !== 'offline', mount_height_m: null, tilt_deg: null })),
    ...ents.map((e): SceneAnchor => ({ id: e.id, resource_type: 'ha_entity', resource_id: e.id, x: e.x, y: e.y, rotation: 0, fov: null, radius: null, polygon: null, level_id: null, layer_id: e.domain === 'lock' ? 'doors' : e.domain === 'light' ? 'lights' : 'sensors', label: e.name, state: e.state, online: null, mount_height_m: null, tilt_deg: null })),
  ];
  return { doc, width: floor.planWidth, height: floor.planHeight, anchors, entityStates: Object.fromEntries(ents.map((e) => [e.id, e.state])), circuitStates: {}, catalog: demoCatalog, zones: [] };
}

/** Hover labels for the demo scene: anchors by name, walls / doors / objects by kind. */
export function demoSceneLabels(floorId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of demoCameras) if (c.floorId === floorId) out[c.id] = c.name;
  for (const e of demoEntities) if (e.floorId === floorId) out[e.id] = e.name;
  demoRooms(floorId).forEach((_, i) => {
    out[`dw${i}`] = 'קיר';
    out[`do${i}`] = 'דלת';
    out[`dl${i}`] = 'מנורת תקרה';
  });
  for (let k = 0; k < 6; k++) out[`dc${k}`] = 'כיסא';
  return out;
}
```

- [ ] **Step 4: Write `scene-three.ts`**

`frontend/src/map/scene-three.ts`:

```ts
/**
 * The three.js realisation of a scene description (T087, design 10.2-10.4, quality level 1: flat materials, an ambient
 * and a directional light, no shadows). One InstancedMesh per instance group (a unit box or a unit cylinder scaled per
 * instance), a Mesh per prism, a Sprite per label, a PointLight per glow; OrbitControls with touch; the presets top /
 * isometric / from a camera; picking by ray; a wireframe outline on the selected item; GLTFExporter. Above 3,000 parts
 * the small objects hide when the camera is far. Colours come from the element's computed design tokens - the description
 * carries names only. This is the only module that imports the three bundle (the lazy chunk).
 */
import { AmbientLight, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry, Euler, ExtrudeGeometry, GLTFExporter, Group, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshLambertMaterial, Object3D, OrbitControls, PerspectiveCamera, PointLight, Quaternion, Raycaster, SRGBColorSpace, Scene, Shape, Sprite, SpriteMaterial, Vector2, Vector3, WebGLRenderer } from './three-bundle';
import type { SceneDescription, ScenePart, Vec3 } from './scene-builder';

export type ScenePreset = 'top' | 'iso' | { camera: string };
export interface SceneHit {
  id: string;
  kind: string;
  partId: string;
}
export interface SceneViewOptions {
  mount: HTMLElement;
  color: (token: string) => string;
  onSelect: (hit: SceneHit | null) => void;
  onHover: (hit: SceneHit | null, x: number, y: number) => void;
  onFrame: (frames: number, fps: number) => void;
}

export const SMALL_PART_M = 0.6;
export const HIDE_SMALL_ABOVE_PARTS = 3000;
export const HIDE_SMALL_DISTANCE_M = 45;
const CLICK_SLOP_PX = 6;
const NOT_PICKABLE = new Set(['glow']);

const rad = (d: number): number => (d * Math.PI) / 180;
const isSmall = (p: ScenePart): boolean => p.kind === 'object' && Math.max(p.size[0], p.size[1], p.size[2]) < SMALL_PART_M;

export class SceneView {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(50, 1, 0.05, 2000);
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly unitBox = new BoxGeometry(1, 1, 1);
  private readonly unitCylinder = new CylinderGeometry(0.5, 0.5, 1, 24);
  private readonly materials = new Map<string, MeshLambertMaterial>();
  private readonly raycaster = new Raycaster();
  /** Every pickable object → the parts it carries (index = instanceId for an InstancedMesh, [0] otherwise). */
  private lookup = new Map<Object3D, ScenePart[]>();
  private byPart = new Map<string, { object: Object3D; index: number | null }>();
  private smallGroups: Object3D[] = [];
  private outline: LineSegments | null = null;
  private desc: SceneDescription | null = null;
  private framed = false;
  private hideSmall = false;
  private disposed = false;
  private raf = 0;
  private frames = 0;
  private fps = 0;
  private windowStart = 0;
  private windowFrames = 0;
  private pressed: { x: number; y: number } | null = null;
  private lastHover: string | null = null;

  constructor(private readonly opts: SceneViewOptions) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    opts.mount.appendChild(canvas);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // never under the floor
    this.scene.add(new AmbientLight(0xffffff, 1.6));
    const sun = new DirectionalLight(0xffffff, 1.4);
    sun.position.set(1, 2, 1.2);
    this.scene.add(sun);
    this.scene.add(this.root);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    this.resize();
    this.loop();
  }

  // ---- building

  private material(color: string, opacity: number, doubleSided = false): MeshLambertMaterial {
    const key = `${color}|${opacity}|${doubleSided ? 2 : 1}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new MeshLambertMaterial({ color: new Color(this.opts.color(color)), transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: doubleSided ? DoubleSide : undefined });
      this.materials.set(key, m);
    }
    return m;
  }

  private transform(o: Object3D, p: ScenePart): void {
    o.position.set(p.position[0], p.position[1], p.position[2]);
    o.quaternion.setFromEuler(new Euler(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'YXZ'));
  }

  private single(p: ScenePart): Object3D | null {
    if (p.shape === 'box' || p.shape === 'cylinder') {
      const mesh = new Mesh(p.shape === 'cylinder' ? this.unitCylinder : this.unitBox, this.material(p.color, p.opacity));
      this.transform(mesh, p);
      mesh.scale.set(Math.max(p.size[0], 1e-3), Math.max(p.size[1], 1e-3), Math.max(p.size[2], 1e-3));
      return mesh;
    }
    if (p.shape === 'prism') {
      const poly = p.polygon ?? [];
      if (poly.length < 3 || p.size[1] <= 0) return null;
      const shape = new Shape();
      shape.moveTo(poly[0][0], -poly[0][1]); // the shape lives in x / y; rotated -90 deg about x, y becomes -z
      for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0], -poly[i][1]);
      shape.closePath();
      const mesh = new Mesh(new ExtrudeGeometry(shape, { depth: p.size[1], bevelEnabled: false }), this.material(p.color, p.opacity, true));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.position[0], p.position[1], p.position[2]);
      return mesh;
    }
    if (p.shape === 'sprite') {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.beginPath();
        ctx.roundRect(8, 16, 496, 96, 48);
        ctx.fill();
        ctx.fillStyle = this.opts.color(p.color);
        ctx.font = 'bold 44px Heebo, "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = 'rtl';
        ctx.fillText(p.text ?? '', 256, 66, 480);
      }
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
      sprite.position.set(p.position[0], p.position[1], p.position[2]);
      sprite.scale.set(Math.max(p.size[0], 0.5), Math.max(p.size[1], 0.2), 1);
      return sprite;
    }
    if (p.shape === 'light') {
      const light = new PointLight(new Color(this.opts.color(p.color)), 8, Math.max(p.size[0], 1), 2);
      light.position.set(p.position[0], p.position[1], p.position[2]);
      return light;
    }
    return null;
  }

  private clear(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof InstancedMesh) child.dispose();
      if (child instanceof Mesh && child.geometry !== this.unitBox && child.geometry !== this.unitCylinder) child.geometry.dispose();
      if (child instanceof Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    }
    this.lookup.clear();
    this.byPart.clear();
    this.smallGroups = [];
    this.setSelected(null);
  }

  setDescription(desc: SceneDescription): void {
    this.clear();
    this.desc = desc;
    const groups = new Map<string, ScenePart[]>();
    const singles: ScenePart[] = [];
    for (const p of desc.parts) {
      if (p.group && (p.shape === 'box' || p.shape === 'cylinder')) {
        const bucket = groups.get(p.group);
        if (bucket) bucket.push(p);
        else groups.set(p.group, [p]);
      } else singles.push(p);
    }
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3();
    for (const [key, parts] of groups) {
      const [shape, color, opacity] = key.split('|');
      const mesh = new InstancedMesh(shape === 'cylinder' ? this.unitCylinder : this.unitBox, this.material(color, Number(opacity)), parts.length);
      parts.forEach((p, i) => {
        q.setFromEuler(new Euler(rad(p.rotation[0]), rad(p.rotation[1]), rad(p.rotation[2]), 'YXZ'));
        pos.set(p.position[0], p.position[1], p.position[2]);
        scl.set(Math.max(p.size[0], 1e-3), Math.max(p.size[1], 1e-3), Math.max(p.size[2], 1e-3));
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
        this.byPart.set(p.id, { object: mesh, index: i });
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = key;
      this.lookup.set(mesh, parts);
      this.root.add(mesh);
      if (parts.every(isSmall)) this.smallGroups.push(mesh);
    }
    for (const p of singles) {
      const o = this.single(p);
      if (!o) continue;
      o.name = p.id;
      if (!NOT_PICKABLE.has(p.kind)) this.lookup.set(o, [p]);
      this.byPart.set(p.id, { object: o, index: null });
      this.root.add(o);
      if (isSmall(p)) this.smallGroups.push(o);
    }
    this.hideSmall = desc.parts.length > HIDE_SMALL_ABOVE_PARTS;
    if (!this.framed) {
      this.setPreset('iso');
      this.framed = true;
    }
  }

  // ---- selection and presets

  setSelected(sourceId: string | null): void {
    if (this.outline) {
      this.root.remove(this.outline);
      this.outline.geometry.dispose();
      (this.outline.material as LineBasicMaterial).dispose();
      this.outline = null;
    }
    if (!sourceId || !this.desc) return;
    const part = this.desc.parts.find((p) => p.userData.id === sourceId && (p.shape === 'box' || p.shape === 'cylinder' || p.shape === 'prism' || p.shape === 'sprite'));
    if (!part) return;
    const line = new LineSegments(new EdgesGeometry(this.unitBox), new LineBasicMaterial({ color: new Color(this.opts.color('accent')), depthTest: false }));
    if (part.shape === 'prism') {
      const xs = (part.polygon ?? []).map((q) => q[0]);
      const zs = (part.polygon ?? []).map((q) => q[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const d = Math.max(...zs) - Math.min(...zs);
      line.position.set(part.position[0] + (Math.max(...xs) + Math.min(...xs)) / 2, part.position[1] + part.size[1] / 2, part.position[2] + (Math.max(...zs) + Math.min(...zs)) / 2);
      line.scale.set(w * 1.04 + 0.05, part.size[1] * 1.04 + 0.05, d * 1.04 + 0.05);
    } else {
      this.transform(line, part);
      line.scale.set(part.size[0] * 1.06 + 0.05, part.size[1] * 1.06 + 0.05, (part.shape === 'sprite' ? 0.1 : part.size[2]) * 1.06 + 0.05);
    }
    line.renderOrder = 10;
    this.outline = line;
    this.root.add(line);
  }

  setPreset(preset: ScenePreset): void {
    const d = this.desc;
    if (!d) return;
    const [W, D] = d.size;
    const cx = W / 2;
    const cz = D / 2;
    const span = Math.max(W, D, 4);
    if (preset === 'top') {
      this.camera.position.set(cx, span * 1.4, cz + 0.001);
      this.controls.target.set(cx, 0, cz);
    } else if (preset === 'iso') {
      this.camera.position.set(cx + span * 0.9, span * 0.75, cz + span * 0.9);
      this.controls.target.set(cx, 0, cz);
    } else {
      const body = d.parts.find((p) => p.id === preset.camera && p.kind === 'camera');
      if (!body) return;
      const yaw = rad(body.rotation[1]);
      const pitch = rad(body.rotation[0]);
      // bearing b = -yaw: forward is (sin b, 0, -cos b) on the floor, tipped down by the pitch
      const fx = -Math.sin(yaw) * Math.cos(pitch);
      const fy = -Math.sin(pitch);
      const fz = -Math.cos(yaw) * Math.cos(pitch);
      this.camera.position.set(body.position[0], body.position[1], body.position[2]);
      this.controls.target.set(body.position[0] + fx * 6, body.position[1] + fy * 6, body.position[2] + fz * 6);
    }
    this.controls.update();
  }

  /** Host pixels of a scene point (null behind the camera). */
  projectPoint(p: Vec3): { x: number; y: number } | null {
    const v = new Vector3(p[0], p[1], p[2]).project(this.camera);
    if (v.z > 1) return null;
    const w = this.opts.mount.clientWidth;
    const h = this.opts.mount.clientHeight;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  // ---- picking

  private pick(clientX: number, clientY: number): SceneHit | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.raycaster.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    for (const hit of this.raycaster.intersectObjects([...this.lookup.keys()], false)) {
      const parts = this.lookup.get(hit.object);
      if (!parts) continue;
      const part = parts[hit.instanceId ?? 0];
      if (!part || part.kind === 'floor') return null; // the floor: an empty click
      return { id: part.userData.id, kind: part.userData.kind, partId: part.id };
    }
    return null;
  }

  private onDown = (e: PointerEvent) => {
    this.pressed = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    const p = this.pressed;
    this.pressed = null;
    if (!p || e.button !== 0 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_SLOP_PX) return; // a drag orbits, it never selects
    this.opts.onSelect(this.pick(e.clientX, e.clientY));
  };

  private onMove = (e: PointerEvent) => {
    if (this.pressed || e.pointerType === 'touch') return;
    const hit = this.pick(e.clientX, e.clientY);
    const key = hit ? hit.partId : null;
    if (key === this.lastHover && hit) return;
    this.lastHover = key;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.opts.onHover(hit, e.clientX - rect.left, e.clientY - rect.top);
  };

  private onLeave = () => {
    this.lastHover = null;
    this.opts.onHover(null, 0, 0);
  };

  // ---- frames

  resize(): void {
    const w = this.opts.mount.clientWidth || 1;
    const h = this.opts.mount.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.controls.update();
    if (this.hideSmall) {
      const show = this.camera.position.distanceTo(this.controls.target) < HIDE_SMALL_DISTANCE_M;
      for (const g of this.smallGroups) g.visible = show;
    }
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    const now = performance.now();
    if (!this.windowStart) this.windowStart = now;
    this.windowFrames++;
    if (now - this.windowStart >= 1000) {
      this.fps = Math.round((this.windowFrames * 1000) / (now - this.windowStart));
      this.windowStart = now;
      this.windowFrames = 0;
    }
    this.opts.onFrame(this.frames, this.fps);
  };

  async exportGltf(): Promise<Record<string, unknown>> {
    const out = await new GLTFExporter().parseAsync(this.root, { binary: false, onlyVisible: false });
    return out as Record<string, unknown>;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerleave', this.onLeave);
    this.controls.dispose();
    this.clear();
    for (const m of this.materials.values()) m.dispose();
    this.unitBox.dispose();
    this.unitCylinder.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
```

- [ ] **Step 5: Write the element**

Add `cube` to `frontend/src/components/sw-icon.ts`, in the icon map right after the `sparkle` entry (keep the map's style; the `IconName` union follows the map's keys):

```ts
  cube: svg`<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>`,
```

`frontend/src/map/sw-plan-3d.ts`:

```ts
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-chip';
import { SceneView, type SceneHit, type ScenePreset } from './scene-three';
import type { SceneDescription, Vec3 } from './scene-builder';

export interface PartSelectDetail {
  id: string | null;
  kind: string | null;
}
export interface PartHoverDetail {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
}

const KIND_HE: Record<string, string> = { wall: 'קיר', opening: 'פתח', object: 'עצם', connector: 'מחבר', camera: 'מצלמה', entity: 'ישות', zone: 'חדר', label: 'תווית', level: 'מפלס' };

/**
 * The schematic 3D view of a floor (T087, design 10.3): a SceneView on a canvas, the presets, the export, the hover
 * label and the data attributes the tests read. The screen builds the description (scene-builder) and owns the
 * selection: `selectedId` comes in as a source id, `part-select` goes out with one. This module is loaded through a
 * dynamic import: importing it is what fetches the three chunk.
 */
@customElement('sw-plan-3d')
export class SwPlan3d extends LitElement {
  @property({ attribute: false }) description: SceneDescription | null = null;
  @property() selectedId: string | null = null;
  @property({ attribute: false }) preset: ScenePreset = 'iso';
  @property({ attribute: false }) cameras: { id: string; label: string }[] = [];
  @property({ attribute: false }) labels: Record<string, string> = {};
  @property() exportName = 'plan-3d';
  @state() private hover: PartHoverDetail | null = null;
  @state() private ready = false;
  @state() private exporting = false;
  @state() private error = '';
  @query('.stage') private stage!: HTMLDivElement;
  private view: SceneView | null = null;
  private ro?: ResizeObserver;
  /** The preset is applied once with the first description (the screen's choice), then only when the property changes:
   * a live state push replaces the description and must not snap the camera back. */
  private presetApplied = false;

  static styles = css`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 240px;
      background: var(--sw-map-bg);
      direction: ltr;
      overflow: hidden;
      border-radius: inherit;
    }
    .stage {
      position: absolute;
      inset: 0;
    }
    .stage canvas {
      inline-size: 100% !important;
      block-size: 100% !important;
    }
    .bar {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: calc(100% - 24px);
      direction: rtl;
    }
    .bar select {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: 999px;
      padding: 4px 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 160px;
    }
    .tip {
      position: absolute;
      z-index: var(--sw-z-map-ui);
      pointer-events: none;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
      transform: translate(-50%, -140%);
    }
    .note {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      direction: rtl;
    }
    .spinner {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    .err {
      color: var(--sw-danger);
    }
    @media (max-width: 640px) {
      .bar {
        inset-inline-start: 8px;
        inset-block-end: 8px;
        gap: 4px;
      }
      .note {
        display: none;
      }
    }
  `;

  protected firstUpdated(): void {
    try {
      this.view = new SceneView({
        mount: this.stage,
        color: (token) => getComputedStyle(this).getPropertyValue(`--sw-${token}`).trim() || '#888888',
        onSelect: (hit) => this.emitSelect(hit),
        onHover: (hit, x, y) => this.setHover(hit, x, y),
        onFrame: (frames, fps) => {
          this.setAttribute('data-frames', String(frames));
          this.setAttribute('data-fps', String(fps));
        },
      });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      return;
    }
    this.ro = new ResizeObserver(() => this.view?.resize());
    this.ro.observe(this);
    if (this.description) this.apply(this.description);
    this.ready = true;
    this.setAttribute('data-ready', '');
    this.setAttribute('data-selected', this.selectedId ?? '');
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.view?.dispose();
    this.view = null;
  }

  protected updated(changed: Map<string, unknown>): void {
    if (!this.view) return;
    if (changed.has('description') && this.description) this.apply(this.description);
    if (changed.has('selectedId') || changed.has('description')) {
      this.view.setSelected(this.selectedId);
      this.setAttribute('data-selected', this.selectedId ?? '');
    }
    if (changed.has('preset') && changed.get('preset') !== undefined) this.applyPreset(this.preset);
  }

  private apply(desc: SceneDescription): void {
    this.view?.setDescription(desc);
    this.setAttribute('data-parts', String(desc.parts.length));
    this.toggleAttribute('data-estimated', desc.estimated);
    if (!this.presetApplied) {
      this.applyPreset(this.preset);
      this.presetApplied = true;
    }
    this.view?.setSelected(this.selectedId);
  }

  private applyPreset(p: ScenePreset): void {
    this.view?.setPreset(p);
    this.setAttribute('data-preset', typeof p === 'string' ? p : 'camera');
  }

  private pickPreset(p: ScenePreset): void {
    this.preset = p;
    this.applyPreset(p);
  }

  private labelOf(hit: SceneHit): string {
    return this.labels[hit.id] ?? KIND_HE[hit.kind] ?? hit.id;
  }

  private emitSelect(hit: SceneHit | null): void {
    this.dispatchEvent(new CustomEvent<PartSelectDetail>('part-select', { detail: { id: hit?.id ?? null, kind: hit?.kind ?? null }, bubbles: true, composed: true }));
  }

  private setHover(hit: SceneHit | null, x: number, y: number): void {
    this.hover = hit ? { id: hit.id, kind: hit.kind, label: this.labelOf(hit), x, y } : null;
    this.dispatchEvent(new CustomEvent<PartHoverDetail | null>('part-hover', { detail: this.hover, bubbles: true, composed: true }));
  }

  /** Host pixels of a scene point (tests click through it). */
  toScreen(p: Vec3): { x: number; y: number } | null {
    return this.view?.projectPoint(p) ?? null;
  }

  async exportGltf(): Promise<Record<string, unknown>> {
    if (!this.view) throw new Error('3D view not ready');
    return this.view.exportGltf();
  }

  /** The existing download pattern (explore-plan-editor.exportJson): a Blob, an anchor with a download name, a click. */
  async download(): Promise<void> {
    if (this.exporting) return;
    this.exporting = true;
    try {
      const json = await this.exportGltf();
      const url = URL.createObjectURL(new Blob([JSON.stringify(json)], { type: 'model/gltf+json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.exportName}.gltf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.exporting = false;
    }
  }

  render() {
    const preset = typeof this.preset === 'string' ? this.preset : 'camera';
    const cameraId = typeof this.preset === 'string' ? '' : this.preset.camera.replace(/^cam:/, '');
    return html`
      <div class="stage"></div>
      ${!this.ready && !this.error ? html`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>` : nothing}
      ${this.error ? html`<div class="spinner err" data-3d-error>${this.error}</div>` : nothing}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${preset === 'top'} @click=${() => this.pickPreset('top')}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${preset === 'iso'} @click=${() => this.pickPreset('iso')}>איזומטרי</sw-chip>
        ${this.cameras.length
          ? html`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${cameraId} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; if (v) this.pickPreset({ camera: `cam:${v}` }); }}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map((c) => html`<option value=${c.id} ?selected=${c.id === cameraId}>${c.label}</option>`)}
            </select>`
          : nothing}
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready || this.exporting} @click=${() => this.download()}>${this.exporting ? 'מייצא…' : 'glTF'}</sw-button>
      </div>
      ${this.description?.estimated ? html`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>` : nothing}
      ${this.hover ? html`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-plan-3d': SwPlan3d;
  }
}
```

- [ ] **Step 6: The style guide hosts the element**

In `frontend/src/screens/styleguide-screen.ts`:

(a) Change the first two import lines to:

```ts
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
```

(b) After the `demoRooms` import add:

```ts
import { demoSceneInput, demoSceneLabels } from '../fixtures/demo-3d';
import { buildScene, type SceneDescription } from '../map/scene-builder';
import { WEBGL_UNAVAILABLE_HE, webglAvailable } from '../map/webgl';
import type { PartSelectDetail } from '../map/sw-plan-3d';
```

(c) Inside the class, before `static styles`, add:

```ts
  /** T087: the 3D element, loaded on demand (the click is what fetches the three chunk), on the demo floor f0. */
  @state() private demo3d: { loading: boolean; error: string; desc: SceneDescription | null; selected: string | null } = { loading: false, error: '', desc: null, selected: null };

  private async load3d(): Promise<void> {
    if (this.demo3d.loading || this.demo3d.desc) return;
    this.demo3d = { ...this.demo3d, loading: true, error: '' };
    try {
      await import('../map/sw-plan-3d');
      const input = demoSceneInput('f0');
      this.demo3d = { loading: false, error: '', desc: input ? buildScene(input) : null, selected: null };
    } catch (err) {
      this.demo3d = { loading: false, error: err instanceof Error ? err.message : String(err), desc: null, selected: null };
    }
  }
```

(d) In `render()`, right before the `<h3>אייקונים</h3>` line, add:

```ts
      <h3>תלת-ממד סכמטי (T087)</h3>
      <div data-3d-demo style="display:flex;flex-direction:column;gap:8px;max-inline-size:720px">
        ${this.demo3d.desc
          ? html`<sw-plan-3d style="block-size:360px;border:1px solid var(--sw-border);border-radius:var(--sw-r-md)" .description=${this.demo3d.desc} .selectedId=${this.demo3d.selected} .labels=${demoSceneLabels('f0')}
                .cameras=${[{ id: 'cam-1', label: 'כניסה ראשית' }, { id: 'cam-2', label: 'לובי' }]} exportName="demo-floor"
                @part-select=${(e: CustomEvent<PartSelectDetail>) => (this.demo3d = { ...this.demo3d, selected: e.detail.id })}></sw-plan-3d>
              <div style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">נבחר: <span class="ltr" data-3d-demo-selected>${this.demo3d.selected ?? ''}</span></div>`
          : html`<div><sw-button icon="cube" data-3d-demo-load ?disabled=${!webglAvailable() || this.demo3d.loading} @click=${() => this.load3d()}>${this.demo3d.loading ? 'טוען…' : 'טען תצוגת 3D'}</sw-button>
              ${webglAvailable() ? nothing : html`<span data-3d-unavailable style="margin-inline-start:8px">${WEBGL_UNAVAILABLE_HE}</span>`}
              ${this.demo3d.error ? html`<span style="color:var(--sw-danger);margin-inline-start:8px">${this.demo3d.error}</span>` : nothing}</div>`}
      </div>
```

- [ ] **Step 7: Type check, build, run the browser test and the chunk test**

Run: `cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && npm run build && ls dist/assets | grep -E "three-|sw-plan-3d-" && npx playwright test tests/unit-plan-3d.spec.ts tests/unit-three-chunk.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: `tsc` exit 0; the build lists `three-<hash>.js` and `sw-plan-3d-<hash>.js`; `3 passed` (the element test and the two chunk tests) with the printed gzip size. Notes for a failure: if `@types/three` complains about `ctx.roundRect`, the DOM lib is ES2022 + DOM - `roundRect` is in TypeScript 5.x's DOM lib; if not, replace the rounded pill with `ctx.fillRect(8, 16, 496, 96)`. If the click on the wall selects a `door` instead, the projected point fell on the leaf: take `parts.filter((p) => p.kind === 'wall')[1]` in the test. If `data-ready` never appears in headless Chromium, run the test once with `SW_CHROME=1` to separate a SwiftShader problem from a code problem, and report which.

Then the fixture chain, because the style guide changed: `bash "$SP/fixture_chain.sh"` → `fixtures exit: 0` and the same passed count as the phase-3 release (the style-guide screenshot changes on purpose: one new section with a button).

- [ ] **Step 8: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/scene-three.ts frontend/src/map/sw-plan-3d.ts frontend/src/fixtures/demo-3d.ts frontend/src/screens/styleguide-screen.ts frontend/src/components/sw-icon.ts frontend/tests/unit-plan-3d.spec.ts frontend/tests/unit-three-chunk.spec.ts docs/evidence/T007
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): the sw-plan-3d element on three - instanced parts, orbit and presets, picking, outline, glTF; hosted by the style guide (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 6: The live floor map — the toggle, the key `3`, selection sync, layers, level, live states, actions

**Files:**
- Modify: `frontend/src/screens/explore-floor-map.ts`
- Modify: `frontend/tests/unit-plan-3d.spec.ts` (a second, demo-mode test on the floor map)
- Create: `frontend/tests/evidence-plan-studio-4.spec.ts` (live; the first test - Tasks 7-10 append theirs)

**Interfaces:**
- Consumes: `buildScene`, `SceneAnchor`, `SceneDescription`, `SceneInput`, `Catalog3DLookup` (Task 4); `ScenePreset` (type only, Task 5); `PartSelectDetail` and the element (Task 5, dynamic import); `webglAvailable`, `WEBGL_UNAVAILABLE_HE` (Task 1); `lookup3dOf` (Task 4); `demoSceneInput`, `demoSceneLabels` (Task 5); `trigger` / `runAction` (existing).
- Produces: on `explore-floor-map`: `[data-view-3d]` (the toggle, `aria-pressed`, disabled with a `title` when WebGL or a structure is missing), `[data-3d-unavailable]` (the Hebrew note when WebGL is missing), `[data-3d-loading]` (the spinner cover), `sw-plan-3d[data-floor-3d]` when the 3D is on; the key `3` toggles (never while typing in a field); `part-select` handling: a camera or an entity opens its existing card (a drawer, no screen point), an object of a circuit runs the circuit's existing action through `trigger`, an object that is the body of an entity opens that entity's card, a zone selects the zone, the floor clears; `sel3d` = the shared selection (`selectedId ?? focusedObjectId ?? selectedZoneId`); `applyFocus` selects without the canvas when the 3D is on; export name `plan-3d-<floor>[-<level>]-<yyyy-mm-dd>`.
- Live spec conventions Tasks 7-10 reuse: `ids`, `api`, `ENTITIES`, `draft()`, `saveDraft()`, `publish()`, `describe3d(page, host)` (reads the element's description), `partScreen(page, host, partId)` (clicks through `toScreen`), `HOST = 'explore-floor-map'`.

- [ ] **Step 1: Write the failing demo-mode test**

Append to `frontend/tests/unit-plan-3d.spec.ts`:

```ts
test('the demo floor map: the toggle loads the chunk once, the key 3 switches, layers and a camera card work in 3D', async ({ page }) => {
  test.setTimeout(90_000);
  const chunkRequests: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
  });
  await page.goto('/#/explore/floors/f0');
  const host = page.locator('explore-floor-map');
  await expect(host.locator('sw-plan-canvas')).toBeAttached({ timeout: 20000 });
  const toggle = host.locator('[data-view-3d]');
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(chunkRequests).toHaveLength(0);
  await toggle.click();
  const el = host.locator('sw-plan-3d[data-floor-3d]');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(chunkRequests).toHaveLength(1);
  const all = Number(await el.getAttribute('data-parts'));
  expect(all).toBeGreaterThan(20);
  // the layers of the 2D apply: objects off removes the chairs and lamps
  await host.locator('.layers button[aria-label="עצמים"]').click();
  await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBeLessThan(all);
  await host.locator('.layers button[aria-label="עצמים"]').click();
  await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all);
  // a click on a camera opens its card (a drawer: the 3D has no pin to anchor a popover to)
  const cam = await el.evaluate((node) => {
    const e = node as unknown as { description: { parts: { id: string; position: [number, number, number]; userData: { id: string } }[] }; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    const c = e.description.parts.find((p) => p.id === 'cam:cam-2')!;
    return { id: c.userData.id, at: e.toScreen(c.position) };
  });
  await el.locator('[data-preset-top]').click();
  const camTop = await el.evaluate((node, id) => {
    const e = node as unknown as { description: { parts: { id: string; position: [number, number, number] }[] }; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    return e.toScreen(e.description.parts.find((p) => p.id === id)!.position);
  }, 'cam:cam-2');
  const box = (await el.boundingBox())!;
  await page.mouse.click(box.x + camTop!.x, box.y + camTop!.y);
  await expect(el).toHaveAttribute('data-selected', cam.id);
  await expect(host.locator('sw-drawer[open]')).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(host.locator('sw-drawer[open]')).toHaveCount(0);
  await expect(el).toHaveAttribute('data-selected', '');
  // the key 3 goes back to 2D and forth again without a second fetch of the chunk
  await page.keyboard.press('3');
  await expect(host.locator('sw-plan-canvas')).toBeAttached();
  await expect(host.locator('sw-plan-3d')).toHaveCount(0);
  await page.keyboard.press('3');
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 15000 });
  expect(chunkRequests).toHaveLength(1);
  // a 3 typed into a field (the floor select of the tool row) is not a toggle: the 3D stays
  await host.locator('.tools sw-field select').focus();
  await page.keyboard.press('3');
  await page.waitForTimeout(300);
  await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveCount(1);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /c/cloude/smplwisebms/frontend && npm run build && npx playwright test tests/unit-plan-3d.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: the new test FAILS at `[data-view-3d]` (no toggle on the floor map).

- [ ] **Step 3: The floor map**

In `frontend/src/screens/explore-floor-map.ts`:

(a) Change the `plan-catalog` import to `import { loadLibrary, lookup3dOf, lookupOf } from '../api/plan-catalog';` and add after it:

```ts
import { buildScene, type Catalog3DLookup, type SceneAnchor, type SceneDescription, type SceneInput } from '../map/scene-builder';
import type { ScenePreset } from '../map/scene-three'; // type only: the three chunk stays out of the entry bundle
import type { PartSelectDetail } from '../map/sw-plan-3d';
import { WEBGL_UNAVAILABLE_HE, webglAvailable } from '../map/webgl';
import { demoSceneInput, demoSceneLabels } from '../fixtures/demo-3d';
```

(b) After `@state() private geometry: GeometryDoc | null = null;` add:

```ts
  /** T087: the 2D / 3D toggle. The element's module - and with it the three chunk - is imported on the first switch. */
  @state() private view3d = false;
  @state() private threeState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  @state() private threeError = '';
  @state() private preset3d: ScenePreset = 'iso';
  @state() private catalog3d: Catalog3DLookup | null = null;
  private itemNames = new Map<string, string>();
  private sceneMemo: { keys: unknown[]; desc: SceneDescription } | null = null;
```

(c) Replace the whole `onKey` handler with:

```ts
  private onKey = (e: KeyboardEvent) => {
    if (e.key === '3' && !e.ctrlKey && !e.metaKey && !e.altKey && !this.typing(e)) {
      e.preventDefault();
      void this.toggle3d();
      return;
    }
    if (e.key !== 'Escape') return;
    if (this.confirmSpec) return; // the dialog handles its own Escape
    if (this.selectedId) {
      const id = this.selectedId;
      this.close();
      this.canvas?.focusMarker(id);
    } else if (this.panel) this.panel = false;
  };

  /** A key pressed inside a text field, a select or an editable node belongs to it. */
  private typing(e: KeyboardEvent): boolean {
    const t = e.composedPath()[0];
    return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
```

(d) In `load()`, replace the library block

```ts
        void loadLibrary(this.bundle.catalogRevision).then((lib) => {
          this.catalogLookup = lookupOf(lib);
        }).catch(() => {}); // without the library objects draw as plain boxes
```

with

```ts
        void loadLibrary(this.bundle.catalogRevision).then((lib) => {
          this.catalogLookup = lookupOf(lib);
          this.catalog3d = lookup3dOf(lib);
          this.itemNames = new Map(lib.items.map((i) => [i.id, i.names.he]));
        }).catch(() => {}); // without the library objects draw as plain boxes
```

(e) In `applyFocus`, replace the lines from `const canvas = this.canvas;` down to the end of the `if (a) {…}` block with:

```ts
    const canvas = this.canvas; // undefined while the 3D is shown: the selection still applies, the zoom does not
    const z = this.focusZone ? b.zones.find((x) => x.id === this.focusZone) : null;
    if (z) {
      const xs = z.polygon.map((p) => p.x);
      const ys = z.polygon.map((p) => p.y);
      this.selectedZoneId = z.id;
      canvas?.zoomToBox(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    }
    const a = this.focusCamera
      ? b.anchors.find((x) => x.resource_type === 'camera' && x.resource_id === this.focusCamera)
      : this.focusEntity
        ? b.anchors.find((x) => x.resource_type === 'ha_entity' && x.resource_id === this.focusEntity)
        : null;
    if (a) {
      if (canvas) {
        if (this.focusZoom) canvas.zoomToBox(a.position.x - 0.15, a.position.y - 0.15, a.position.x + 0.15, a.position.y + 0.15, 48, 2.2);
        else canvas.centerOn(a.position.x, a.position.y);
        await this.updateComplete;
      }
      const p = canvas?.toScreen(a.position.x, a.position.y) ?? null;
      this.selectedId = a.id;
      this.anchor = p ? { x: p.x, y: p.y } : null;
    }
    if (this.focusObject) {
      const o = this.geometry?.objects.find((x) => x.id === this.focusObject);
      if (!o) return; // the document arrives after the bundle: the geometry load calls applyFocus again
      this.focusedObjectId = o.id;
      canvas?.centerOn(o.position[0], o.position[1]);
    }
```

(f) After `entityStateMap` add the 3D section:

```ts
  // ---- 3D (T087) ----

  /** The anchors as the scene builder wants them, filtered by the same layer switches as the 2D markers. */
  private get sceneAnchors(): SceneAnchor[] {
    const b = this.bundle;
    if (!b || b.source !== 'api') return [];
    const stale = this.screenState === 'stale';
    return b.anchors
      .filter((a) => (a.resource_type === 'camera' ? this.layers.has('cameras') : this.layers.has(a.layer_id === 'doors' ? 'doors' : a.layer_id === 'lights' ? 'lights' : 'sensors')))
      .map((a) => ({
        id: a.id, resource_type: a.resource_type, resource_id: a.resource_id, x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? null, radius: a.coverage_radius ?? null,
        polygon: a.coverage_polygon ?? null, level_id: a.level_id ?? null, layer_id: a.layer_id, label: entityName(a), state: stale ? null : a.entity?.state ?? null,
        online: a.resource_type === 'camera' ? (a.camera ? a.camera.status === 'online' : null) : null, mount_height_m: a.mount_height_m ?? null, tilt_deg: a.tilt_deg ?? null,
      }));
  }

  /** The scene of the shown floor, rebuilt only when one of its inputs changed (a state push replaces the bundle). */
  private get sceneDescription(): SceneDescription | null {
    const b = this.bundle;
    if (!b) return null;
    let base: SceneInput | null = null;
    if (b.source === 'demo') {
      const demo = demoSceneInput(b.floorId);
      if (!demo) return null;
      base = { ...demo, anchors: demo.anchors.filter((a) => (a.resource_type === 'camera' ? this.layers.has('cameras') : this.layers.has(a.layer_id === 'doors' ? 'doors' : a.layer_id === 'lights' ? 'lights' : 'sensors'))) };
    } else if (this.geometry) {
      base = { doc: this.geometry, width: b.width, height: b.height, anchors: this.sceneAnchors, entityStates: this.entityStateMap, circuitStates: this.circuitStateMap, catalog: this.catalog3d,
        zones: b.zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null })) };
    }
    if (!base) return null;
    const keys = [b, this.geometry, this.layers, this.levelFilter, this.catalog3d, this.screenState];
    if (this.sceneMemo && this.sceneMemo.keys.length === keys.length && this.sceneMemo.keys.every((k, i) => k === keys[i])) return this.sceneMemo.desc;
    const desc = buildScene({ ...base, level: this.levelFilter, layers: { structure: this.layers.has('structure'), objects: this.layers.has('objects'), connectors: this.layers.has('connectors'), zones: this.layers.has('zones') } });
    this.sceneMemo = { keys, desc };
    return desc;
  }

  /** Hover labels: anchors by their map name, objects by label or library name, zones by name. */
  private get sceneLabels(): Record<string, string> {
    const b = this.bundle;
    if (!b) return {};
    if (b.source === 'demo') return demoSceneLabels(b.floorId);
    const out: Record<string, string> = {};
    for (const a of b.anchors) out[a.id] = entityName(a);
    for (const o of this.geometry?.objects ?? []) out[o.id] = o.label || this.itemNames.get(o.item_id) || o.item_id;
    for (const z of b.zones) out[z.id] = z.name;
    return out;
  }

  private get can3d(): boolean {
    return webglAvailable() && this.sceneDescription !== null;
  }

  private async toggle3d(): Promise<void> {
    if (this.view3d) {
      this.view3d = false;
      return;
    }
    if (!this.can3d || this.threeState === 'loading') return;
    if (this.threeState !== 'ready') {
      this.threeState = 'loading';
      try {
        await import('../map/sw-plan-3d');
        this.threeState = 'ready';
      } catch (err) {
        this.threeState = 'error';
        this.threeError = describeError(err);
        return;
      }
    }
    this.view3d = true;
  }

  /** The shared selection, as the 3D shows it: the pin, else the focused object, else the room. */
  private get sel3d(): string | null {
    return this.selectedId ?? this.focusedObjectId ?? this.selectedZoneId;
  }

  /** A click in the 3D (ruling R-P4-6): a camera or an entity opens its existing card; a lamp of a circuit runs the
   * circuit's existing action (the same route, permission and confirmation as the circuit strip); the body of an entity
   * opens that entity's card; a room selects it; the floor clears. Walls and connectors have nothing to open. */
  private onPartSelect(e: CustomEvent<PartSelectDetail>) {
    const { id, kind } = e.detail;
    const b = this.bundle;
    if (!id || !kind || !b) {
      this.close();
      this.focusedObjectId = null;
      this.selectedZoneId = null;
      return;
    }
    if (kind === 'camera' || kind === 'entity') {
      const a = b.anchors.find((x) => x.id === id);
      if (this.multi) {
        if (a?.resource_type === 'camera') this.togglePick(a.id);
        return;
      }
      this.selectedZoneId = null;
      this.focusedObjectId = null;
      this.selectedId = id;
      this.anchor = null; // no pin on screen: the card opens as a drawer
      return;
    }
    if (kind === 'object') {
      const o = this.geometry?.objects.find((x) => x.id === id);
      const circuit = this.geometry?.circuits.find((k) => k.member_ids.includes(id));
      const s = circuit ? b.circuitStates[circuit.id] : undefined;
      if (s) {
        const on = s.state === 'on';
        const spec = s.actions.find((x) => x.id.endsWith(on ? 'turn_off' : 'turn_on'));
        const busy = !!this.action?.busy && this.action.entityId === s.entity_id;
        const blocked = !s.can_control || !spec || spec.granted === false || busy || this.screenState === 'stale' || !s.available;
        if (spec && !blocked) this.trigger(s.entity_id, spec);
      } else if (o?.anchor_ref) {
        const a = b.anchors.find((x) => x.resource_type === o.anchor_ref!.resource_type && x.resource_id === o.anchor_ref!.resource_id);
        if (a) {
          this.selectedZoneId = null;
          this.focusedObjectId = null;
          this.selectedId = a.id;
          this.anchor = null;
          return;
        }
      }
      this.close();
      this.selectedZoneId = null;
      this.focusedObjectId = id;
      return;
    }
    if (kind === 'zone') {
      this.close();
      this.focusedObjectId = null;
      this.selectedZoneId = id;
    }
  }

  private render3d(b: MapBundle, desc: SceneDescription) {
    const cameras = b.anchors.filter((a) => a.resource_type === 'camera' && this.layers.has('cameras')).map((a) => ({ id: a.id, label: entityName(a) }));
    const stamp = new Date().toISOString().slice(0, 10);
    return html`<sw-plan-3d data-floor-3d .description=${desc} .selectedId=${this.sel3d} .preset=${this.preset3d} .cameras=${cameras} .labels=${this.sceneLabels}
      exportName=${`plan-3d-${b.floorName}${this.levelFilter ? `-${this.levelFilter}` : ''}-${stamp}`} @part-select=${(e: CustomEvent<PartSelectDetail>) => this.onPartSelect(e)}></sw-plan-3d>`;
  }
```

(g) In `renderStage()`, replace the `<sw-plan-canvas … ></sw-plan-canvas>` element (from `<sw-plan-canvas` to `@view-change=${this.onViewChange}></sw-plan-canvas>`) with:

```ts
      ${this.view3d && this.threeState === 'ready' && this.sceneDescription
        ? this.render3d(b, this.sceneDescription)
        : html`<sw-plan-canvas
        .planWidth=${b.width}
        .planHeight=${b.height}
        .plan=${b.planSvg}
        .imageUrl=${b.imageUrl}
        .geometry=${this.layers.has('structure') || this.layers.has('objects') || this.layers.has('connectors') ? this.geometry : null}
        .hideStructure=${!this.layers.has('structure')}
        .hideObjects=${!this.layers.has('objects')}
        .hideConnectors=${!this.layers.has('connectors')}
        .selectedGeomId=${this.focusedObjectId}
        .structureLevel=${this.levelFilter}
        .catalog=${this.catalogLookup}
        .anchorPositions=${this.anchorPositions}
        .circuitStates=${this.circuitStateMap}
        .entityStates=${this.entityStateMap}
        .markers=${this.markers}
        .selectedId=${this.selectedId}
        .selectedIds=${this.multi ? this.picked : []}
        .boxSelect=${this.multi}
        @box-select=${(e: CustomEvent<{ ids: string[] }>) => this.addPicks(e.detail.ids)}
        .zones=${this.layers.has('zones') ? b.zones.map((z) => ({ ...z, labelPos: z.label_pos })) : []}
        .selectedZoneId=${this.selectedZoneId}
        .dimEntities=${this.screenState === 'stale'}
        @zone-select=${(e: CustomEvent<{ id: string }>) => { if (this.multi) { this.pickZone(e.detail.id); return; } this.selectedZoneId = this.selectedZoneId === e.detail.id ? null : e.detail.id; this.close(); }}
        @marker-select=${this.onSelect}
        @view-change=${this.onViewChange}></sw-plan-canvas>`}
      ${this.threeState === 'loading' ? html`<div class="cover" data-3d-loading><sw-state-panel state="loading" hint="טוען תלת-ממד…"></sw-state-panel></div>` : nothing}
      ${this.threeState === 'error' ? html`<div class="banner"><sw-state-panel compact state="error" heading="תלת-ממד לא נטען" hint=${this.threeError}></sw-state-panel></div>` : nothing}
```

(h) In `render()`, in the `.tools` div, right before the `<sw-button icon="layers" …>${t('floor.layers')}</sw-button>` line, add:

```ts
          <sw-button icon="cube" aria-pressed=${this.view3d} data-view-3d ?disabled=${!this.can3d || this.threeState === 'loading'}
            title=${!webglAvailable() ? WEBGL_UNAVAILABLE_HE : !this.sceneDescription ? 'אין מבנה מפורסם לקומה הזו' : 'מקש 3'} @click=${() => this.toggle3d()}>${this.view3d ? '2D' : '3D'}</sw-button>
          ${webglAvailable() ? nothing : html`<span class="note" data-3d-unavailable>${WEBGL_UNAVAILABLE_HE}</span>`}
```

- [ ] **Step 4: Type check, build, the demo test, the fixture chain**

Run: `cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && npm run build && npx playwright test tests/unit-plan-3d.spec.ts tests/unit-three-chunk.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: exit 0; `4 passed`. Then `bash "$SP/fixture_chain.sh"` → `fixtures exit: 0` and the same passed count as before (the floor-map screenshots gain a "3D" button; the rest is unchanged).

- [ ] **Step 5: Write the live spec (first test)**

`frontend/tests/evidence-plan-studio-4.spec.ts`:

```ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_STATUS_LABEL } from '../src/api/ha';

// Plan Studio phase 4 (T087) against the running developer backend in real Chrome: the 3D toggle on the live map, the
// history map and the event page, selection sync, layers, levels, live states through the dev state route, the lamp
// action through the existing route (answered in the browser - ruling R-P2-T13-1), coverage stopped by walls, the
// anchor fields, the building page isometric, the glTF export, embed mode, the WebGL gate, the phone and the frame rate.
// The spec builds its own site / building / floor on the committed apartment fixture and removes them at the end.
// Runs only with SW_LIVE=1 SW_CHROME=1 (backend on 8099 behind the preview proxy on 4173).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');
export const HOST = 'explore-floor-map';
export const ENTITIES = { lamp: 'light.p4_lamp', lock: 'lock.p4_door', sw: 'switch.p4_k' };
export const ids = { site: '', building: '', floor: '', version: '', camera: '', camAnchor: '', lockAnchor: '', lampAnchor: '' };
export let api: APIRequestContext;

type Desc = { estimated: boolean; parts: { id: string; kind: string; color: string; opacity: number; position: [number, number, number]; rotation: [number, number, number]; level_id: string | null; polygon?: [number, number][]; userData: { id: string; kind: string } }[] };

/** The element's description, read straight off the element (it is a public property). */
export const describe3d = (page: Page, host: string) => page.locator(`${host} sw-plan-3d`).evaluate((node) => (node as unknown as { description: Desc }).description);
/** Host pixels of a part's centre, projected by the element. */
export async function partScreen(page: Page, host: string, partId: string): Promise<{ x: number; y: number }> {
  const el = page.locator(`${host} sw-plan-3d`);
  const box = (await el.boundingBox())!;
  const at = await el.evaluate((node, id) => {
    const e = node as unknown as { description: Desc; toScreen: (p: [number, number, number]) => { x: number; y: number } | null };
    const p = e.description.parts.find((x) => x.id === id);
    return p ? e.toScreen(p.position) : null;
  }, partId);
  expect(at, `part ${partId} on screen`).toBeTruthy();
  return { x: box.x + at!.x, y: box.y + at!.y };
}
export const draft = async () => (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json()) as { geometry: { revision: number }; doc: Record<string, unknown> };
export const saveDraft = async (patch: Record<string, unknown>) => {
  const g = await draft();
  expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: { ...g.doc, ...patch }, base_revision: g.geometry.revision } })).status()).toBe(200);
};
export const publish = async () => expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
const WALL = (id: string, polyline: [number, number][], level = 'L0', extra: Record<string, unknown> = {}) => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const OBJ = (id: string, item_id: string, position: [number, number], extra: Record<string, unknown> = {}) => ({ id, item_id, level_id: 'L0', position, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

test.describe.serial('plan studio phase 4 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת תלת-ממד ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה 3D' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'אולם 3D', level: 0 } })).json()).id;
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(FIXTURE) } } })).json();
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
    // 1 m = 100 px: the 1600 px plan is 16 m wide
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 16 }] } })).status()).toBe(200);
    // entities as if Home Assistant sent them (developer identity mode only), then the anchors
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [
      { entity_id: ENTITIES.lamp, state: 'off', attributes: { friendly_name: 'מנורת אולם' } },
      { entity_id: ENTITIES.lock, state: 'locked', attributes: { friendly_name: 'דלת אולם' } },
      { entity_id: ENTITIES.sw, state: 'on', attributes: { friendly_name: 'מפסק אולם' } },
    ] } })).status()).toBe(200);
    const cams = (await (await api.get('api/v1/cameras')).json()).cameras as { id: string }[];
    ids.camera = cams[0]?.id ?? (await (await api.post('api/v1/cameras', { data: { channel: 61, alias: 'מצלמת 3D' } })).json()).id;
    // the camera at the plan centre (8 m, 6 m) looks north at the room's wall 4.8 m ahead; its radius (0.5 x 1600 px) is 8 m
    ids.camAnchor = (await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'camera', resource_id: ids.camera, x: 0.5, y: 0.5, rotation_degrees: 0, field_of_view_degrees: 90, coverage_radius: 0.5, mount_height_m: 3, tilt_deg: 15 } })).json()).id;
    ids.lockAnchor = (await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'ha_entity', resource_id: ENTITIES.lock, x: 0.5, y: 0.1, rotation_degrees: 0, field_of_view_degrees: null } })).json()).id;
    ids.lampAnchor = (await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'ha_entity', resource_id: ENTITIES.lamp, x: 0.2, y: 0.2, rotation_degrees: 0, field_of_view_degrees: null } })).json()).id;
    expect(ids.camAnchor && ids.lockAnchor && ids.lampAnchor).toBeTruthy();
    // the structure: a room with a door bound to the lock, a window, a passage; a lower level with a tribune; lamps; stairs
    const chairs = Array.from({ length: 6 }, (_, k) => OBJ(`ch${k}`, 'chair.basic', [0.25 + 0.08 * (k % 3), 0.35 + 0.1 * Math.floor(k / 3)]));
    await saveDraft({
      levels: [{ id: 'L0', name: 'ראשי', elevation_m: 0, ceiling_height_m: 3, is_default: true, external_ids: {} }, { id: 'L1', name: 'תחתון', elevation_m: -1.2, ceiling_height_m: 6, is_default: false, external_ids: {} }],
      walls: [WALL('n', [[0.1, 0.1], [0.9, 0.1]]), WALL('e', [[0.9, 0.1], [0.9, 0.6]]), WALL('s', [[0.9, 0.6], [0.1, 0.6]]), WALL('w', [[0.1, 0.6], [0.1, 0.1]]), WALL('lw', [[0.2, 0.9], [0.8, 0.9]], 'L1', { kind: 'low', height_m: 1 })],
      openings: [
        { id: 'dr', wall_id: 'n', t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'left', hinge: 'start', anchor_ref: { resource_type: 'ha_entity', resource_id: ENTITIES.lock }, confidence: 1, source: 'manual', external_ids: {} },
        { id: 'wn', wall_id: 'e', t: 0.5, kind: 'window', width_m: 1.2, height_m: 1.2, sill_m: 0.9, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
        { id: 'ps', wall_id: 's', t: 0.5, kind: 'passage', width_m: 1.0, height_m: 2.1, sill_m: 0, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
      ],
      objects: [...chairs,
        OBJ('lb', 'light.ceiling', [0.2, 0.2], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3, anchor_ref: { resource_type: 'ha_entity', resource_id: ENTITIES.lamp } }),
        OBJ('lk', 'light.ceiling', [0.6, 0.3], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3 }),
        OBJ('tr', 'tribune.stepped', [0.5, 0.8], { level_id: 'L1', size: { w_m: 8, d_m: 3, h_m: 1.2 }, params: { rows: 4, step_height_m: 0.3, step_width_m: 0.75 } })],
      circuits: [{ id: 'k', name: 'מעגל אולם', switch_entity_id: ENTITIES.sw, member_ids: ['lk'], color_token: 'circuit-1', power_w: 0 }],
      connectors: [{ id: 'st', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.15, 0.7], [0.15, 0.78]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} }],
    });
    await publish();
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      if (ids.floor) expect((await api.delete(`api/v1/floors/${ids.floor}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('live map: the 3D loads on demand, mirrors the layers, the level, the live states and the selection, and toggles a lamp through the existing route', async ({ page }) => {
    test.setTimeout(150_000);
    const chunkRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 20000 });
    // the 2D cone is cut by the walls of the room (Task 2)
    await expect(host.locator('sw-plan-canvas [data-cov-clipped]')).toHaveCount(1);
    const toggle = host.locator('[data-view-3d]');
    await expect(toggle).toBeEnabled({ timeout: 10000 });
    expect(chunkRequests).toHaveLength(0);
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    expect(chunkRequests).toHaveLength(1);
    const all = Number(await el.getAttribute('data-parts'));
    expect(all).toBeGreaterThan(20);
    // what the description says: the door is closed (the lock is locked), the bound lamp is off, the circuit lamp glows, the camera cone is clipped
    let d = await describe3d(page, HOST);
    expect(d.estimated).toBe(false);
    const part = (id: string) => d.parts.find((p) => p.id === id)!;
    expect(part('door:dr').rotation[1]).toBe(0);
    expect(part('obj:lb').color).toBe('obj-light');
    expect(part('obj:lk').color).toBe('map-glow');
    expect(d.parts.some((p) => p.id === 'obj:lk#glow')).toBe(true);
    expect(part(`cam:${ids.camAnchor}`).position[1]).toBe(3); // the stored mount height
    expect(part(`cam:${ids.camAnchor}`).rotation[0]).toBe(15); // the stored tilt
    expect(part(`cam:${ids.camAnchor}#cone`).polygon!.length).toBeGreaterThan(10);
    expect(Math.min(...part(`cam:${ids.camAnchor}#cone`).polygon!.map((p) => p[1]))).toBeGreaterThanOrEqual(-4.81); // the north wall 4.8 m ahead stops every ray while the door is closed
    expect(d.parts.filter((p) => p.id.startsWith('obj:tr#')).length).toBe(4);
    expect(d.parts.filter((p) => p.id.startsWith('conn:st#')).length).toBeGreaterThanOrEqual(3);
    // live states arrive through the existing push: the door opens, the lamp glows, the cone passes through the door
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: ENTITIES.lock, state: 'unlocked' }, { entity_id: ENTITIES.lamp, state: 'on' }] } })).status()).toBe(200);
    await expect.poll(async () => { d = await describe3d(page, HOST); return Math.abs(part('door:dr').rotation[1]); }, { timeout: 15000 }).toBe(80);
    expect(part('obj:lb').color).toBe('map-glow');
    expect(Math.min(...part(`cam:${ids.camAnchor}#cone`).polygon!.map((p) => p[1]))).toBeLessThan(-7); // the middle rays pass the open door (0.9 m wide, straight ahead) out to the 8 m radius
    // the layers of the 2D apply, the level chips too
    await host.locator('.layers button[aria-label="עצמים"]').click();
    await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBeLessThan(all);
    await host.locator('.layers button[aria-label="עצמים"]').click();
    await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all);
    await host.locator('[data-level-chip="L1"]').click();
    await expect.poll(async () => { d = await describe3d(page, HOST); return d.parts.every((p) => p.level_id === 'L1' || p.kind === 'connector'); }).toBe(true);
    expect(d.parts.filter((p) => p.kind === 'wall').map((p) => p.id)).toEqual(['wall:lw#0']);
    await host.locator('[data-level-chip="all"]').click();
    await expect.poll(async () => Number(await el.getAttribute('data-parts'))).toBe(all);
    // selection: a click on the camera body opens its card (drawer) and the 2D selection follows the same id
    await el.locator('[data-preset-top]').click();
    const camAt = await partScreen(page, HOST, `cam:${ids.camAnchor}`);
    await page.mouse.click(camAt.x, camAt.y);
    await expect(el).toHaveAttribute('data-selected', ids.camAnchor);
    await expect(host.locator('sw-drawer[open]')).toBeAttached();
    await expect(host.locator('sw-drawer[open] sw-camera-tile')).toBeAttached(); // the existing live tile
    await page.keyboard.press('3'); // back to 2D: the same pin is selected there
    await expect(host.locator('sw-plan-canvas g.marker.selected')).toHaveAttribute('data-id', ids.camAnchor, { timeout: 10000 });
    await host.locator('sw-plan-canvas').click({ position: { x: 5, y: 5 } }); // an empty corner clears the 2D selection
    await host.locator('[data-sidelist-toggle]').click();
    await host.locator(`[data-side-entity="${ENTITIES.lock}"]`).click(); // the 2D list selects the lock
    await expect(host.locator('sw-plan-canvas g.marker.selected')).toHaveAttribute('data-id', ids.lockAnchor);
    await page.keyboard.press('3'); // to 3D: the shared selection shows there
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-selected', ids.lockAnchor, { timeout: 15000 });
    expect(chunkRequests).toHaveLength(1); // the chunk was fetched once
    await page.keyboard.press('Escape');
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-selected', '');
    // the circuit lamp: a click runs switch.turn_off through the existing action route, answered here (R-P2-T13-1)
    const sent: unknown[] = [];
    await page.route('**/api/v1/ha/entities/*/actions', async (r) => {
      sent.push(r.request().postDataJSON());
      await r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'p4-fake', entity_id: ENTITIES.sw, action_id: 'switch.turn_off', status: 'failed', error: 'bridge_error', requested_at: new Date().toISOString(), confirmed_at: null }) });
    });
    await el.locator('[data-preset-top]').click();
    const lampAt = await partScreen(page, HOST, 'obj:lk');
    await page.mouse.click(lampAt.x, lampAt.y);
    await expect(host.locator('[data-circuit-status]')).toContainText(ACTION_STATUS_LABEL.failed, { timeout: 10000 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ allowed_action_id: 'switch.turn_off' });
    await page.unroute('**/api/v1/ha/entities/*/actions');
    // the states back for the later tests
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: ENTITIES.lock, state: 'locked' }, { entity_id: ENTITIES.lamp, state: 'off' }] } })).status()).toBe(200);
  });
});
```

- [ ] **Step 6: Run the live test in real Chrome**

```bash
cd /c/cloude/smplwisebms/frontend && npm run build && bash "$SP/restart_dev.sh"
SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-4.spec.ts --project=desktop --workers=1 --reporter=line
```

Expected: `1 passed`. The geometry behind the cone numbers: the plan is 1600 × 1200 px at 0.01 m/px, the camera sits at (800, 600) px = (8, 6) m looking north, the room's north wall is at y = 120 px = 1.2 m, so 4.8 m ahead; the door (0.9 m wide) is centred at x = 800 px, straight ahead; the radius is 0.5 × 1600 px = 8 m. Closed: every ray ends at ≤ 4.8 m (`z ≥ -4.8`, rounded `-4.81`); open: the middle rays reach the radius (`z ≈ -8`). If `[data-side-entity]` is missing, the side list is closed - the toggle click before it is required. A failure naming the NVR / go2rtc / HA is BLOCKED, anything else is fixed here.

- [ ] **Step 7: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/screens/explore-floor-map.ts frontend/tests/unit-plan-3d.spec.ts frontend/tests/evidence-plan-studio-4.spec.ts docs/evidence/T007
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): the live floor map toggles to 3D - on-demand chunk, key 3, shared selection, layers, levels, live states, circuit action (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 7: The historical map at the instant and the event page's "מבט מהמצלמה"

**Files:**
- Modify: `frontend/src/screens/investigate-history-map.ts`
- Modify: `frontend/src/screens/investigate-event-detail.ts`
- Modify: `frontend/tests/evidence-plan-studio-4.spec.ts` (two tests appended)

**Interfaces:**
- Consumes: Tasks 4-6 (`buildScene`, the element, `webgl.ts`, `lookup3dOf`); the history bundle's `state_at` and `circuit_states` at the instant; `EventLocation.anchor_id`.
- Produces: on `investigate-history-map`: `[data-view-3d]`, `sw-plan-3d[data-history-3d]`, the key `3`, the preset `{ camera: 'cam:<anchor id>' }` when the page was opened with `?camera=` (the event page's hand-off), no actions (the history offers none: `part-select` on a camera or entity only selects). On `investigate-event-detail`: `[data-event-3d]` (the toggle over the map card), `sw-plan-3d[data-event-3d]` with the preset from the event's camera anchor and that anchor selected; `[data-event-3d-unavailable]` when WebGL is missing.

- [ ] **Step 1: Write the failing live tests**

Append inside the `test.describe.serial` block of `frontend/tests/evidence-plan-studio-4.spec.ts`, before its closing `});`:

```ts
  test('history map: the 3D shows the structure and the states of the instant, opens from the camera of ?camera=, and the key 3 toggles', async ({ page }) => {
    test.setTimeout(120_000);
    const t = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    await page.goto(`/?design=a#/investigate/floors/${ids.floor}/history?t=${encodeURIComponent(t)}&camera=${ids.camera}`);
    const host = page.locator('investigate-history-map');
    await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 30000 });
    await expect(host.locator('[data-history-camera]')).not.toContainText('לחץ על מצלמה');
    const toggle = host.locator('[data-view-3d]');
    await expect(toggle).toBeEnabled({ timeout: 10000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-history-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await expect(el).toHaveAttribute('data-preset', 'camera'); // "מבט מהמצלמה": the camera the page was opened with
    await expect(el).toHaveAttribute('data-selected', ids.camAnchor);
    const d = await describe3d(page, 'investigate-history-map');
    const part = (id: string) => d.parts.find((p) => p.id === id)!;
    expect(part('door:dr').rotation[1]).toBe(0); // the lock was locked at the instant (the local history knows it)
    expect(part(`ent:${ids.lockAnchor}`).color).toBe('text-3');
    expect(part('obj:lb').color).toBe('obj-light');
    expect(d.parts.filter((p) => p.kind === 'wall').length).toBeGreaterThanOrEqual(5);
    // a click on the lock symbol selects it in the panel's terms (no action is offered in the history)
    await el.locator('[data-preset-top]').click();
    const lockAt = await partScreen(page, 'investigate-history-map', `ent:${ids.lockAnchor}`);
    await page.mouse.click(lockAt.x, lockAt.y);
    await expect(el).toHaveAttribute('data-selected', ids.lockAnchor);
    await expect(host.locator('[data-history-camera]')).toContainText('לחץ על מצלמה');
    await page.keyboard.press('3');
    await expect(host.locator('sw-plan-canvas')).toBeAttached();
    await expect(host.locator('sw-plan-canvas g.marker.selected')).toHaveAttribute('data-id', ids.lockAnchor);
    await page.keyboard.press('3');
    await expect(host.locator('sw-plan-3d[data-history-3d]')).toHaveAttribute('data-ready', '', { timeout: 15000 });
  });

  test('event page: the map card toggles to 3D from the camera of the event', async ({ page }) => {
    test.setTimeout(120_000);
    // the developer backend holds events only when the NVR delivered them: find one on a floor with a plan, else NOT_RUN
    const list = (await (await api.get('api/v1/events?limit=300')).json()).events as { id: string; camera_id: string | null }[];
    let found: { id: string; anchor: string } | null = null;
    for (const e of list.filter((x) => x.camera_id)) {
      const d = (await (await api.get(`api/v1/events/${e.id}`)).json()) as { location: { has_plan: boolean; anchor_id: string } | null };
      if (d.location?.has_plan) {
        found = { id: e.id, anchor: d.location.anchor_id };
        break;
      }
    }
    test.skip(!found, 'no event with a camera on a floor with a plan on this backend (recorded NOT_RUN)');
    await page.goto(`/?design=a#/investigate/events/${found!.id}`);
    const host = page.locator('investigate-event-detail');
    await expect(host.locator('sw-plan-canvas')).toBeAttached({ timeout: 30000 });
    const toggle = host.locator('[data-event-3d]');
    await expect(toggle).toBeEnabled({ timeout: 15000 });
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-event-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await expect(el).toHaveAttribute('data-preset', 'camera');
    await expect(el).toHaveAttribute('data-selected', found!.anchor);
    expect(Number(await el.getAttribute('data-parts'))).toBeGreaterThan(0);
    await toggle.click();
    await expect(host.locator('sw-plan-canvas')).toBeAttached();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /c/cloude/smplwisebms/frontend && npm run build && SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-4.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: the first test passes; the history test FAILS at `[data-view-3d]`; the event test FAILS at `[data-event-3d]` or is skipped (no event).

- [ ] **Step 3: The history map**

In `frontend/src/screens/investigate-history-map.ts`:

(a) Change the `plan-catalog` import to `import { loadLibrary, lookup3dOf, lookupOf } from '../api/plan-catalog';` and add after it:

```ts
import { buildScene, type Catalog3DLookup, type SceneAnchor, type SceneDescription } from '../map/scene-builder';
import type { ScenePreset } from '../map/scene-three';
import type { PartSelectDetail } from '../map/sw-plan-3d';
import { WEBGL_UNAVAILABLE_HE, webglAvailable } from '../map/webgl';
```

(`describeError` is already imported from `../api/client` in this file; `toggle3d` below uses it.)

(b) After `private frameTimer = 0;` add:

```ts
  /** T087: the 2D / 3D toggle of the historical map (no actions here, the states are those of the instant). */
  @state() private view3d = false;
  @state() private threeState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  @state() private threeError = '';
  @state() private preset3d: ScenePreset = 'iso';
  @state() private catalog3d: Catalog3DLookup | null = null;
  private sceneMemo: { keys: unknown[]; desc: SceneDescription } | null = null;
  private onKey = (e: KeyboardEvent) => {
    const t = e.composedPath()[0];
    const typing = t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === '3' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing) {
      e.preventDefault();
      void this.toggle3d();
    }
  };
```

(c) Replace `connectedCallback` with:

```ts
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    if (isApi()) void this.init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
  }
```

(d) In `init()`, replace the library block with:

```ts
      if (this.bundle.source === 'api') {
        void loadLibrary(this.bundle.catalogRevision).then((lib) => {
          this.catalogLookup = lookupOf(lib);
          this.catalog3d = lookup3dOf(lib);
        }).catch(() => {}); // without the library objects draw as plain boxes
      }
```

and, right after `this.selectedId = a?.id ?? null;` inside `if (this.camera) { … }`, add:

```ts
        if (a) this.preset3d = { camera: `cam:${a.id}` }; // the event page hands its camera over: the 3D opens from it
```

(e) After `get floors()` add:

```ts
  // ---- 3D (T087) ----

  private get sceneDescription(): SceneDescription | null {
    const b = this.bundle;
    const g = this.geometry;
    if (!b || b.source !== 'api' || !g) return null;
    const keys = [b, g, this.catalog3d, this.recordings];
    if (this.sceneMemo && this.sceneMemo.keys.every((k, i) => k === keys[i])) return this.sceneMemo.desc;
    const anchors: SceneAnchor[] = b.anchors.map((a) => ({
      id: a.id, resource_type: a.resource_type, resource_id: a.resource_id, x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? null, radius: a.coverage_radius ?? null,
      polygon: a.coverage_polygon ?? null, level_id: a.level_id ?? null, layer_id: a.layer_id, label: entityName(a), state: a.entity?.state_at?.known ? a.entity.state_at.state : null,
      online: a.resource_type === 'camera' ? this.coverageAt(a.resource_id).state === 'historic' : null, mount_height_m: a.mount_height_m ?? null, tilt_deg: a.tilt_deg ?? null,
    }));
    const entityStates = Object.fromEntries(b.anchors.filter((a) => a.resource_type === 'ha_entity').map((a) => [a.resource_id, a.entity?.state_at?.known ? a.entity.state_at.state : null]));
    const circuitStates = Object.fromEntries(Object.entries(b.circuitStates).map(([id, s]) => [id, s.state]));
    const desc = buildScene({ doc: g, width: b.width, height: b.height, anchors, entityStates, circuitStates, catalog: this.catalog3d, zones: b.zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null })) });
    this.sceneMemo = { keys, desc };
    return desc;
  }

  private get sceneLabels(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of this.bundle?.anchors ?? []) out[a.id] = entityName(a);
    for (const z of this.bundle?.zones ?? []) out[z.id] = z.name;
    return out;
  }

  private async toggle3d(): Promise<void> {
    if (this.view3d) {
      this.view3d = false;
      return;
    }
    if (!webglAvailable() || !this.sceneDescription || this.threeState === 'loading') return;
    if (this.threeState !== 'ready') {
      this.threeState = 'loading';
      try {
        await import('../map/sw-plan-3d');
        this.threeState = 'ready';
      } catch (err) {
        this.threeState = 'error';
        this.threeError = describeError(err);
        return;
      }
    }
    this.view3d = true;
  }

  /** A click in the 3D of the past: a camera or an entity becomes the selected pin (the panel follows); nothing is actuated. */
  private onPartSelect(e: CustomEvent<PartSelectDetail>) {
    const { id, kind } = e.detail;
    if (!id || (kind !== 'camera' && kind !== 'entity')) {
      if (!id) this.selectedId = null;
      return;
    }
    this.selectedId = id;
    this.frameFailed = false;
  }
```

(f) In `renderApi()`, in the head, right before the `<sw-button icon="live" data-back-live …>` line add:

```ts
        <sw-button icon="cube" aria-pressed=${this.view3d} data-view-3d ?disabled=${!webglAvailable() || !this.sceneDescription || this.threeState === 'loading'} title=${!webglAvailable() ? WEBGL_UNAVAILABLE_HE : !this.sceneDescription ? 'אין מבנה מפורסם בזמן הזה' : 'מקש 3'} @click=${() => this.toggle3d()}>${this.view3d ? '2D' : '3D'}</sw-button>
```

and replace the `<sw-plan-canvas alwaysLabel … ></sw-plan-canvas>` element inside `.stage` with:

```ts
          ${this.view3d && this.threeState === 'ready' && this.sceneDescription
            ? html`<sw-plan-3d data-history-3d .description=${this.sceneDescription} .selectedId=${this.selectedId} .preset=${this.preset3d} .labels=${this.sceneLabels}
                .cameras=${b.anchors.filter((a) => a.resource_type === 'camera').map((a) => ({ id: a.id, label: entityName(a) }))} exportName=${`plan-3d-${b.floorName}-${this.date}`}
                @part-select=${(e: CustomEvent<PartSelectDetail>) => this.onPartSelect(e)}></sw-plan-3d>`
            : html`<sw-plan-canvas alwaysLabel .planWidth=${b.width} .planHeight=${b.height} .plan=${b.planSvg} .imageUrl=${b.imageUrl} .markers=${this.apiMarkers} .selectedId=${this.selectedId} .zones=${b.zones} .geometry=${this.geometry} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(b.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees } as AnchorPosition]))} .entityStates=${Object.fromEntries(b.anchors.filter((a) => a.resource_type === 'ha_entity').map((a) => [a.resource_id, a.entity?.state_at?.known ? a.entity.state_at.state : null]))} dimEntities
            @marker-select=${(e: CustomEvent<MarkerSelectDetail>) => { this.selectedId = e.detail.id; this.frameFailed = false; }}></sw-plan-canvas>`}
          ${this.threeState === 'loading' ? html`<div class="hist" data-3d-loading>טוען תלת-ממד…</div>` : nothing}
          ${this.threeState === 'error' ? html`<div class="hist" data-3d-error>${this.threeError}</div>` : nothing}
```

(g) In `updateGeometry()` and `ensureVersion()` nothing changes: the memo keys include the geometry and the bundle, so the 3D follows the cursor like the 2D does.

- [ ] **Step 4: The event page**

In `frontend/src/screens/investigate-event-detail.ts`:

(a) Change the `plan-catalog` import to `import { loadLibrary, lookup3dOf, lookupOf } from '../api/plan-catalog';` and add after it:

```ts
import { buildScene, type Catalog3DLookup, type SceneDescription } from '../map/scene-builder';
import type { PartSelectDetail } from '../map/sw-plan-3d';
import { WEBGL_UNAVAILABLE_HE, webglAvailable } from '../map/webgl';
```

and change the existing `../api/maps` import line to `import { cameraState, entityName, loadMap, type MapBundle } from '../api/maps';`.

(b) After `private pollTimer = 0;` add:

```ts
  /** T087: the map card's 3D, opened from the event's camera ("מבט מהמצלמה"). */
  @state() private view3d = false;
  @state() private threeState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  @state() private catalog3d: Catalog3DLookup | null = null;
  @state() private selected3d: string | null = null;
  /** The "from camera" preset, one object per toggle: the element re-applies a preset only when the property changes. */
  @state() private eventPreset: { camera: string } | null = null;
  private sceneMemo: { keys: unknown[]; desc: SceneDescription } | null = null;
```

(c) In `loadMap(floorId)`, replace the library block with:

```ts
      if (b.source === 'api') {
        void loadLibrary(b.catalogRevision).then((lib) => {
          this.catalogLookup = lookupOf(lib);
          this.catalog3d = lookup3dOf(lib);
        }).catch(() => {}); // without the library objects draw as plain boxes
      }
```

(d) After `get markers()` add:

```ts
  private get sceneDescription(): SceneDescription | null {
    const b = this.bundle;
    const g = this.geometry;
    if (!b || !g) return null;
    const keys = [b, g, this.catalog3d];
    if (this.sceneMemo && this.sceneMemo.keys.every((k, i) => k === keys[i])) return this.sceneMemo.desc;
    const desc = buildScene({
      doc: g, width: b.width, height: b.height,
      anchors: b.anchors.map((a) => ({
        id: a.id, resource_type: a.resource_type, resource_id: a.resource_id, x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? null, radius: a.coverage_radius ?? null,
        polygon: a.coverage_polygon ?? null, level_id: a.level_id ?? null, layer_id: a.layer_id, label: entityName(a), state: a.entity?.state ?? null,
        online: a.resource_type === 'camera' ? (a.camera ? a.camera.status === 'online' : null) : null, mount_height_m: a.mount_height_m ?? null, tilt_deg: a.tilt_deg ?? null,
      })),
      entityStates: Object.fromEntries(b.anchors.filter((a) => a.resource_type === 'ha_entity').map((a) => [a.resource_id, a.entity?.state ?? null])),
      circuitStates: Object.fromEntries(Object.entries(b.circuitStates).map(([id, s]) => [id, s.state])),
      catalog: this.catalog3d, zones: b.zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null })),
    });
    this.sceneMemo = { keys, desc };
    return desc;
  }

  private async toggle3d(): Promise<void> {
    if (this.view3d) {
      this.view3d = false;
      return;
    }
    if (!webglAvailable() || !this.sceneDescription || this.threeState === 'loading') return;
    if (this.threeState !== 'ready') {
      this.threeState = 'loading';
      try {
        await import('../map/sw-plan-3d');
        this.threeState = 'ready';
      } catch {
        this.threeState = 'error';
        return;
      }
    }
    const anchorId = this.ev?.location?.anchor_id ?? null;
    this.selected3d = anchorId;
    this.eventPreset = anchorId ? { camera: `cam:${anchorId}` } : null;
    this.view3d = true;
  }
```

(e) In `render()`, replace the `.map` block

```ts
              ${loc && loc.has_plan && this.bundle
                ? html`<div class="map">
                    <div class="floorchip"><sw-icon name="building" size=${12}></sw-icon>${loc.floor_name}</div>
                    <sw-plan-canvas … alwaysLabel dimEntities></sw-plan-canvas>
                  </div>
```

with

```ts
              ${loc && loc.has_plan && this.bundle
                ? html`<div class="map" style=${this.view3d ? 'block-size:320px' : ''}>
                    <div class="floorchip"><sw-icon name="building" size=${12}></sw-icon>${loc.floor_name}</div>
                    <div style="position:absolute;inset-inline-end:8px;inset-block-start:8px;z-index:var(--sw-z-map-ui);display:flex;gap:6px;align-items:center">
                      <sw-button size="sm" icon="cube" aria-pressed=${this.view3d} data-event-3d ?disabled=${!webglAvailable() || !this.sceneDescription || this.threeState === 'loading'} title=${!webglAvailable() ? WEBGL_UNAVAILABLE_HE : 'מבט מהמצלמה בתלת-ממד'} @click=${() => this.toggle3d()}>${this.view3d ? '2D' : '3D'}</sw-button>
                      ${webglAvailable() ? nothing : html`<span class="note" style="margin:0" data-event-3d-unavailable>${WEBGL_UNAVAILABLE_HE}</span>`}
                    </div>
                    ${this.view3d && this.threeState === 'ready' && this.sceneDescription
                      ? html`<sw-plan-3d data-event-3d .description=${this.sceneDescription} .selectedId=${this.selected3d} .preset=${this.eventPreset ?? 'iso'} .labels=${Object.fromEntries(this.bundle.anchors.map((a) => [a.id, entityName(a)]))}
                          .cameras=${this.bundle.anchors.filter((a) => a.resource_type === 'camera').map((a) => ({ id: a.id, label: entityName(a) }))} exportName=${`plan-3d-${loc.floor_name}-${ev.id}`}
                          @part-select=${(e: CustomEvent<PartSelectDetail>) => (this.selected3d = e.detail.kind === 'camera' || e.detail.kind === 'entity' ? e.detail.id : null)}></sw-plan-3d>`
                      : html`<sw-plan-canvas .planWidth=${this.bundle.width} .planHeight=${this.bundle.height} .imageUrl=${this.bundle.imageUrl} .plan=${this.bundle.planSvg} .markers=${this.markers} .selectedId=${loc.anchor_id} .zones=${this.bundle.zones} .geometry=${this.geometry} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(this.bundle.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees } as AnchorPosition]))} alwaysLabel dimEntities></sw-plan-canvas>`}
                  </div>
```

- [ ] **Step 5: Type check, build, live**

```bash
cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && npm run build && bash "$SP/restart_dev.sh"
SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-4.spec.ts --project=desktop --workers=1 --reporter=line
```

Expected: `3 passed`, or `2 passed, 1 skipped` when the developer backend has no event on a floor with a plan (the skip message names it; Task 11 records the event test NOT_RUN in that case). Then the neighbours of these screens: `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-history-map.spec.ts tests/evidence-event-detail.spec.ts tests/evidence-ha-history.spec.ts --project=desktop --workers=1 --reporter=line` → the same results as the phase-3 baseline (`$SP/neighbours_0185.txt` lists them; a failure naming the NVR / go2rtc / HA is BLOCKED).

- [ ] **Step 6: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/screens/investigate-history-map.ts frontend/src/screens/investigate-event-detail.ts frontend/tests/evidence-plan-studio-4.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): 3D on the historical map at the instant and on the event page from the camera of the event (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 8: The building page's true isometric, the glTF download, the key on both maps

**Files:**
- Modify: `frontend/src/components/sw-floor-iso.ts` (`iso` property, faces)
- Modify: `frontend/src/screens/explore-floors.ts` (published geometry per floor → description → isometric)
- Modify: `frontend/tests/unit-plan-3d.spec.ts` (the isometric element in the browser)
- Modify: `frontend/tests/evidence-plan-studio-4.spec.ts` (two tests appended: SC03 and the glTF download)

**Interfaces:**
- Consumes: `buildScene`, `isoProjection`, `IsoScene` (Task 4); `getGeometry` (existing); the element's `download()` / `[data-export-gltf]` (Task 5); the key handlers of Tasks 6-7.
- Produces: `sw-floor-iso.iso: IsoScene | null` (draws the faces when set, else the rooms as before) with the reflected attribute `data-iso="real" | "demo"`; on `explore-floors`, one `getGeometry(published_version_id)` per floor with a plan (cached in the screen), `[data-floor-iso="<floor id>"]`; the glTF download named `plan-3d-<floor>[-<level>]-<date>.gltf`, a Blob of the JSON `GLTFExporter` produced.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/tests/unit-plan-3d.spec.ts` (the two `import` lines go to the top of the file with the other imports; the description is built in the test process and handed to the element, because the preview serves hashed modules that an `import()` inside `evaluate` cannot name):

```ts
import { buildScene, isoProjection } from '../src/map/scene-builder';
import { demoSceneInput } from '../src/fixtures/demo-3d';

test('the isometric thumbnail draws faces from a description and the demo building page still draws rooms', async ({ page }) => {
  const iso = isoProjection(buildScene(demoSceneInput('f0')!));
  await page.goto('/#/explore/buildings/bld-a/floors');
  const isos = page.locator('explore-floors sw-floor-iso');
  await expect(isos.first()).toBeAttached({ timeout: 20000 });
  await expect(isos.first()).toHaveAttribute('data-iso', 'demo');
  const faces = await isos.first().evaluate(async (node, scene) => {
    const el = node as unknown as { iso: unknown; updateComplete: Promise<boolean>; shadowRoot: ShadowRoot };
    el.iso = scene;
    await el.updateComplete;
    return { real: (node as HTMLElement).getAttribute('data-iso'), sides: el.shadowRoot.querySelectorAll('polygon.side').length, tops: el.shadowRoot.querySelectorAll('polygon.top').length, plates: el.shadowRoot.querySelectorAll('polygon.plate').length };
  }, iso);
  expect(faces.real).toBe('real');
  expect(faces.plates).toBe(1);
  expect(faces.sides).toBeGreaterThan(8);
  expect(faces.tops).toBeGreaterThan(2);
});
```

Append inside the live spec's describe block:

```ts
  test('building page: the floor list shows a true isometric of the published walls', async ({ page }) => {
    await page.goto(`/?design=a#/explore/buildings/${ids.building}/floors`);
    const iso = page.locator(`explore-floors sw-floor-iso[data-floor-iso="${ids.floor}"]`);
    await expect(iso).toHaveAttribute('data-iso', 'real', { timeout: 30000 });
    expect(await iso.locator('polygon.side').count()).toBeGreaterThan(8); // five walls, each a box with four sides (openings cut them further)
    expect(await iso.locator('polygon.plate').count()).toBe(2); // two levels
  });

  test('glTF export: the button downloads a glTF JSON with the instanced parts', async ({ page }) => {
    test.setTimeout(120_000);
    // the download pattern is an <a download> click on a Blob URL: capture the Blob instead of saving a file
    await page.addInitScript(() => {
      const w = window as unknown as { __gltf: { name: string; text: string } | null };
      w.__gltf = null;
      const origCreate = URL.createObjectURL.bind(URL);
      const blobs = new Map<string, Blob>();
      URL.createObjectURL = (b: Blob | MediaSource) => { const u = origCreate(b); if (b instanceof Blob) blobs.set(u, b); return u; };
      HTMLAnchorElement.prototype.click = function () { const b = blobs.get(this.href); if (b) void b.text().then((text) => { w.__gltf = { name: this.download, text }; }); };
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('[data-view-3d]')).toBeEnabled({ timeout: 30000 });
    await host.locator('[data-view-3d]').click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    await el.locator('[data-export-gltf]').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __gltf: unknown }).__gltf !== null), { timeout: 30000 }).toBe(true);
    const got = await page.evaluate(() => (window as unknown as { __gltf: { name: string; text: string } }).__gltf);
    expect(got.name).toMatch(/^plan-3d-.+-\d{4}-\d{2}-\d{2}\.gltf$/);
    const gltf = JSON.parse(got.text) as { asset: { generator: string; version: string }; nodes: unknown[]; meshes: unknown[]; extensionsUsed?: string[] };
    expect(gltf.asset.generator).toContain('GLTFExporter');
    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.nodes.length).toBeGreaterThan(10);
    expect(gltf.meshes.length).toBeGreaterThan(3);
    expect(gltf.extensionsUsed ?? []).toContain('EXT_mesh_gpu_instancing'); // the chairs and the wall parts travel as instances
    console.log(`GLTF ${got.name}: ${gltf.nodes.length} nodes, ${gltf.meshes.length} meshes, ${got.text.length} bytes`);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd /c/cloude/smplwisebms/frontend && npm run build && npx playwright test tests/unit-plan-3d.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: the isometric test FAILS (`data-iso` attribute missing). The live SC03 test fails the same way when run; the glTF test passes already if run alone (the element's export is in place since Task 5) - run it in Step 5 with the rest.

- [ ] **Step 3: The isometric element**

Replace `frontend/src/components/sw-floor-iso.ts` with:

```ts
import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { IsoScene } from '../map/scene-builder';

export interface IsoRoom {
  x: number; // normalized 0..1
  y: number;
  w: number;
  h: number;
}

/**
 * Isometric floor thumbnail (board 1 screen 3): the floor slab drawn in isometric projection with its room outlines;
 * the selected floor is tinted blue. Floors without a plan get a dashed empty slab. With `iso` (T087) the thumbnail is
 * the true isometric of the published structure - the faces of scene-builder.isoProjection, far to near - and the
 * host reflects `data-iso="real"`; without it `data-iso="demo"` and the room rectangles draw as before.
 */
@customElement('sw-floor-iso')
export class SwFloorIso extends LitElement {
  @property({ attribute: false }) rooms: IsoRoom[] = [];
  @property({ attribute: false }) iso: IsoScene | null = null;
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: Boolean, reflect: true }) empty = false;
  @property({ type: Number }) width = 132;

  static styles = css`
    :host {
      display: inline-block;
      inline-size: var(--w, 132px);
      flex-shrink: 0;
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: auto;
      overflow: visible;
    }
    .side {
      fill: #cfd7e3;
    }
    .top {
      fill: #ffffff;
      stroke: #b7c3d4;
      stroke-width: 1.2;
      stroke-linejoin: round;
    }
    .room {
      fill: none;
      stroke: #b7c3d4;
      stroke-width: 1;
      stroke-linejoin: round;
    }
    /* the true isometric: a token colour per face, sides darkened, the plate as the slab top */
    polygon.plate {
      fill: #ffffff;
      stroke: #b7c3d4;
      stroke-width: 1;
      stroke-linejoin: round;
    }
    polygon.f-side {
      fill: color-mix(in srgb, var(--fc, #aab7cc) 72%, #1f2937 28%);
      stroke: none;
    }
    polygon.f-top {
      fill: var(--fc, #aab7cc);
      stroke: none;
    }
    :host([selected]) .side {
      fill: #9db9ff;
    }
    :host([selected]) .top,
    :host([selected]) polygon.plate {
      fill: #dbe6ff;
      stroke: var(--sw-accent);
    }
    :host([selected]) .room {
      stroke: var(--sw-accent);
    }
    :host([empty]) .top {
      fill: #f6f8fb;
      stroke-dasharray: 3 3;
    }
  `;

  private iso2(u: number, v: number) {
    return { x: 60 + (u - v) * 58, y: 6 + (u + v) * 26 };
  }

  private poly(pts: { x: number; y: number }[]) {
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  protected updated(): void {
    this.setAttribute('data-iso', this.iso ? 'real' : 'demo');
  }

  render() {
    this.style.setProperty('--w', `${this.width}px`);
    if (this.iso) {
      return html`<svg viewBox="0 0 120 72" aria-hidden="true">
        ${this.iso.faces.map((f) => svg`<polygon class=${f.face === 'plate' ? 'plate' : f.face === 'side' ? 'side f-side' : 'top f-top'} style=${`--fc: var(--sw-${f.color}); opacity: ${f.opacity}`} points=${f.points.map((p) => `${p[0]},${p[1]}`).join(' ')} />`)}
      </svg>`;
    }
    const slab = [this.iso2(0, 0), this.iso2(1, 0), this.iso2(1, 1), this.iso2(0, 1)];
    const d = 7;
    const right = [this.iso2(1, 0), this.iso2(1, 1), { x: this.iso2(1, 1).x, y: this.iso2(1, 1).y + d }, { x: this.iso2(1, 0).x, y: this.iso2(1, 0).y + d }];
    const left = [this.iso2(0, 1), this.iso2(1, 1), { x: this.iso2(1, 1).x, y: this.iso2(1, 1).y + d }, { x: this.iso2(0, 1).x, y: this.iso2(0, 1).y + d }];
    return html`<svg viewBox="0 0 120 72" aria-hidden="true">
      ${svg`<polygon class="side" points=${this.poly(right)} /><polygon class="side" points=${this.poly(left)} />`}
      ${svg`<polygon class="top" points=${this.poly(slab)} />`}
      ${this.empty
        ? nothing
        : this.rooms.map((r) => svg`<polygon class="room" points=${this.poly([this.iso2(r.x, r.y), this.iso2(r.x + r.w, r.y), this.iso2(r.x + r.w, r.y + r.h), this.iso2(r.x, r.y + r.h)])} />`)}
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-floor-iso': SwFloorIso;
  }
}
```

(The browser test counts `polygon.side` and `polygon.top`: the true faces carry both the legacy class and the `f-*` class, so the same selectors match.)

- [ ] **Step 4: The building page**

In `frontend/src/screens/explore-floors.ts`:

(a) Add the imports after the `types` import:

```ts
import { getGeometry } from '../api/geometry';
import { buildScene, isoProjection, type IsoScene } from '../map/scene-builder';
```

(b) After `@state() private formLevel = 0;` add:

```ts
  /** T087: the true isometric of every floor with a published structure, one document read per version (cached here). */
  @state() private isos = new Map<string, IsoScene | null>();
  private isoPending = new Set<string>();

  private isoFor(f: Floor): IsoScene | null {
    const vid = f.published_version_id;
    if (!vid || this.tree?.source !== 'api') return null;
    if (this.isos.has(vid)) return this.isos.get(vid) ?? null;
    if (this.isoPending.has(vid)) return null;
    this.isoPending.add(vid);
    void getGeometry(vid)
      .then((r) => {
        const desc = buildScene({ doc: r.doc, width: f.plan_width_px || r.doc.dimensions.width_px, height: f.plan_height_px || r.doc.dimensions.height_px, anchors: [], entityStates: {}, circuitStates: {},
          layers: { objects: false, cameras: false, entities: false, zones: false } });
        this.isos = new Map(this.isos).set(vid, desc.parts.some((p) => p.kind === 'wall') ? isoProjection(desc) : null);
      })
      .catch(() => {
        this.isos = new Map(this.isos).set(vid, null); // no published structure (404) or no permission: the room outlines stay
      })
      .finally(() => this.isoPending.delete(vid));
    return null;
  }
```

(c) In `render()`, replace the `<sw-floor-iso …>` line with:

```ts
                  <sw-floor-iso data-floor-iso=${f.id} .rooms=${tree.source === 'demo' ? demoRooms(f.id) : []} .iso=${this.isoFor(f)} ?selected=${sel?.id === f.id} ?empty=${!f.has_plan} width=${128}></sw-floor-iso>
```

- [ ] **Step 5: Type check, build, the browser and live tests, the fixture chain**

```bash
cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && npm run build && npx playwright test tests/unit-plan-3d.spec.ts tests/unit-scene-builder.spec.ts --project=desktop --workers=1 --reporter=line
bash "$SP/restart_dev.sh"
SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-4.spec.ts --project=desktop --workers=1 --reporter=line
bash "$SP/fixture_chain.sh"
```

Expected: the browser specs pass (`6 passed` across the two files); the live spec `5 passed` (or 4 + 1 skipped for the event page); the fixture chain `fixtures exit: 0` with the same count (the building-page screenshot is unchanged in demo mode: `data-iso="demo"` draws exactly what it drew).

- [ ] **Step 6: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/components/sw-floor-iso.ts frontend/src/screens/explore-floors.ts frontend/tests/unit-plan-3d.spec.ts frontend/tests/evidence-plan-studio-4.spec.ts docs/evidence/T007
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): the building page draws a true isometric of each floor from the published walls; glTF download evidence (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 9: The Lovelace card path, embed mode, the WebGL gate and the phone

**Files:**
- Modify: `smplwise_vms/backend/tests/test_lovelace_card.py` (the built UI references its assets relatively; the three chunk ships)
- Modify: `smplwise_vms/www/` (regenerated by `npm run build:addon`, committed so the backend test sees the chunk)
- Modify: `frontend/src/screens/explore-floor-map.ts` (one phone rule)
- Modify: `frontend/tests/evidence-plan-studio-4.spec.ts` (three tests appended: embed, gate, phone)

**Interfaces:**
- Consumes: Tasks 1, 5, 6; the card `smplwise-card.js` (unchanged: it embeds `<ingress_url>/#/explore/floors/<id>?embed=1`); `sw-app`'s `data-embed` attribute.
- Produces: the mechanism on record (ruling R-P4-9): the card is an iframe on the add-on's own page, `explore-floor-map` is the same element there, the toggle imports `./assets/sw-plan-3d-<hash>.js`, which imports `./assets/three-<hash>.js` - both relative to the entry module's URL, so under `/api/hassio_ingress/<token>/` they resolve inside the Ingress prefix; the backend test pins that the built files say so.

- [ ] **Step 1: Write the failing backend test**

Append to `smplwise_vms/backend/tests/test_lovelace_card.py`:

```python
WWW = REPO / "smplwise_vms" / "www"


def test_built_ui_references_its_assets_relatively_and_ships_the_three_chunk():
    """T087 (ruling R-P4-9): the card embeds the Ingress page, so the 3D toggle is the floor screen's own; the chunk must
    resolve relative to that page. The built entry names ./assets/, the lazy 3D chunk names the three chunk relatively,
    no file names an absolute /assets/ path, and three never reaches the entry bundle."""
    index = (WWW / "index.html").read_text(encoding="utf-8")
    assert 'src="./assets/index-' in index and 'href="./assets/index-' in index
    assert '"/assets/' not in index
    assets = WWW / "assets"
    three = sorted(p for p in assets.glob("three-*.js") if not p.name.endswith(".map"))
    view = sorted(p for p in assets.glob("sw-plan-3d-*.js") if not p.name.endswith(".map"))
    assert len(three) == 1 and len(view) == 1, "one three chunk and one 3D view chunk in the built UI (run npm run build:addon)"
    entry = next(p for p in assets.glob("index-*.js") if not p.name.endswith(".map")).read_text(encoding="utf-8")
    assert "WebGLRenderer" not in entry
    assert f'"./{three[0].name}"' not in entry, "the entry never imports the three chunk statically"
    view_src = view[0].read_text(encoding="utf-8")
    assert f'from"./{three[0].name}"' in view_src
    assert '"/assets/' not in view_src and '"/assets/' not in entry
    assert three[0].stat().st_size < 900_000, "the three chunk stays a single tree-shaken library build (about 630 KB minified, 160 KB gzip)"
    card = (SRC / "www" / "smplwise-card.js").read_text(encoding="utf-8")
    assert "/explore/floors/" in card and "embed=1" in card, "the map view of the card is the floor screen itself"
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_lovelace_card.py -p no:cacheprovider`
Expected: the new test FAILS at `one three chunk and one 3D view chunk` (`smplwise_vms/www` is the 0.1.86 build).

- [ ] **Step 3: Rebuild the add-on UI and the phone rule**

In `frontend/src/screens/explore-floor-map.ts`, inside the existing `@media (max-width: 640px)` block that hides `.tools .layers`, add after that rule:

```css
      /* the 3D toggle stays in the scrolling tool row, never squeezed (ruling R-P4-7) */
      .tools sw-button[data-view-3d] {
        flex: none;
      }
      .tools .note {
        white-space: nowrap;
      }
```

Then:

```bash
cd /c/cloude/smplwisebms/frontend && npx tsc --noEmit -p tsconfig.json && npm run build:addon && ls ../smplwise_vms/www/assets | grep -E "three-|sw-plan-3d-|index-"
cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_lovelace_card.py -p no:cacheprovider
```

Expected: the listing shows `three-<hash>.js`, `sw-plan-3d-<hash>.js` and `index-<hash>.js` (each with a `.map`); `3 passed`.

- [ ] **Step 4: Write the failing live tests**

Append inside the live spec's describe block:

```ts
  test('embed mode (the Lovelace card path): the floor screen toggles to 3D without its chrome, the chunk fetched from the page own assets folder', async ({ page }) => {
    test.setTimeout(120_000);
    const chunkRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
    });
    await page.goto('about:blank');
    await page.goto(`/#/explore/floors/${ids.floor}?embed=1`);
    await page.waitForSelector('sw-app');
    await expect(page.locator('sw-app')).toHaveAttribute('data-embed', '', { timeout: 30000 });
    await expect(page.locator('sw-app nav')).toHaveCount(0);
    const host = page.locator(HOST);
    await expect(host.locator('[data-view-3d]')).toBeEnabled({ timeout: 30000 });
    await host.locator('[data-view-3d]').click();
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 30000 });
    expect(chunkRequests).toHaveLength(1);
    expect(new URL(chunkRequests[0]).pathname).toMatch(/^\/assets\/three-[\w-]+\.js$/); // next to the page that embedded it
    await page.goto('about:blank'); // leave embed mode for the next tests (it is remembered per session)
  });

  test('without WebGL the toggle is disabled with a Hebrew note and the 2D map keeps working', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return (orig as (this: HTMLCanvasElement, t: string, ...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 30000 });
    await expect(host.locator('[data-view-3d]')).toBeDisabled();
    await expect(host.locator('[data-3d-unavailable]')).toHaveText('תלת-ממד לא זמין בדפדפן זה');
    await page.keyboard.press('3');
    await expect(host.locator('sw-plan-3d')).toHaveCount(0);
    await host.locator(`sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`).click();
    await expect(host.locator('sw-popover, sw-drawer[open]')).toHaveCount(1); // the 2D card still opens
  });

  test('phone: the toggle sits in the tool row, the 3D fills the stage without sideways scroll, the canvas takes touch', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const chunkRequests: string[] = [];
    page.on('request', (r) => {
      if (/\/assets\/three-[\w-]+\.js$/.test(r.url())) chunkRequests.push(r.url());
    });
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('sw-plan-canvas')).toBeAttached({ timeout: 30000 });
    const toggle = host.locator('.tools [data-view-3d]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    expect(chunkRequests).toHaveLength(0);
    await toggle.click();
    const el = host.locator('sw-plan-3d[data-floor-3d]');
    await expect(el).toHaveAttribute('data-ready', '', { timeout: 30000 });
    expect(chunkRequests).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const stage = await el.boundingBox();
    expect(stage!.width).toBeLessThanOrEqual(390);
    expect(stage!.width).toBeGreaterThan(300);
    const touch = await el.evaluate((node) => { const c = (node as HTMLElement).shadowRoot!.querySelector('canvas')!; return { action: getComputedStyle(c).touchAction, w: c.clientWidth }; });
    expect(touch.action).toBe('none'); // OrbitControls owns the gestures: one finger orbits, two zoom and pan
    expect(touch.w).toBeGreaterThan(300);
    await expect(el.locator('[data-preset-top]')).toBeVisible();
    await el.locator('[data-preset-top]').click();
    await expect(el).toHaveAttribute('data-preset', 'top');
  });
```

- [ ] **Step 5: Run the live spec**

```bash
cd /c/cloude/smplwisebms/frontend && npm run build && bash "$SP/restart_dev.sh"
SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-4.spec.ts --project=desktop --workers=1 --reporter=line
```

Expected: `8 passed` (or 7 + 1 skipped). Also the existing `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-lovelace.spec.ts tests/evidence-mobile.spec.ts --project=desktop --workers=1 --reporter=line` → the same results as the phase-3 baseline.

- [ ] **Step 6: Commit**

```bash
cd /c/cloude/smplwisebms && git add smplwise_vms/backend/tests/test_lovelace_card.py smplwise_vms/www frontend/src/screens/explore-floor-map.ts frontend/tests/evidence-plan-studio-4.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
test(plan-studio): the built UI keeps the three chunk relative for the Lovelace card; embed, WebGL gate and phone evidence (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 10: Performance measurement and the complete live evidence run

**Files:**
- Modify: `frontend/tests/evidence-plan-studio-4.spec.ts` (the anchor-fields test and the performance test appended, last)
- Modify (only if the measurement requires it): `frontend/src/map/scene-three.ts`, `frontend/src/map/scene-builder.ts`

**Interfaces:**
- Consumes: the whole phase; `data-frames` / `data-fps` on the element; `[data-anchor-mount]` / `[data-anchor-tilt]` in the editor (Task 3).
- Produces: the fps numbers printed as `PERF sample fps=<n> parts=<n>` and `PERF chairs fps=<n> parts=<n>` (the release quotes them), the assertion ≥ 20 fps on both, the complete `evidence-plan-studio-4` run.

- [ ] **Step 1: Append the last two tests**

Inside the describe block, after the phone test:

```ts
  test('the anchor panel edits the mount height and the tilt; the bundle and the 3D take them', async ({ page }) => {
    test.setTimeout(120_000);
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`)).toBeAttached({ timeout: 30000 });
    await page.locator(`${ed} sw-plan-canvas g.marker[data-id="${ids.camAnchor}"]`).click();
    await expect(page.locator(`${ed} [data-anchor-mount]`)).toHaveValue('3');
    await expect(page.locator(`${ed} [data-anchor-tilt]`)).toHaveValue('15');
    await page.locator(`${ed} [data-anchor-mount]`).fill('2.2');
    await page.locator(`${ed} [data-anchor-mount]`).press('Tab');
    await page.locator(`${ed} [data-anchor-tilt]`).fill('');
    await page.locator(`${ed} [data-anchor-tilt]`).press('Tab'); // emptied: back to the kind's default (10), stored as null
    await expect(page.locator(`${ed} [data-anchor-tilt]`)).toHaveAttribute('placeholder', '10');
    const patched = page.waitForResponse((r) => r.url().includes('/map-anchors/') && r.request().method() === 'PATCH');
    await page.locator(`${ed} sw-button`, { hasText: 'שמירת מיקום' }).first().click();
    const body = (await patched).request().postDataJSON() as { mount_height_m: number | null; tilt_deg: number | null };
    expect(body).toMatchObject({ mount_height_m: 2.2, tilt_deg: null });
    const bundle = (await (await api.get(`api/v1/floors/${ids.floor}/map`)).json()) as { anchors: { id: string; mount_height_m: number | null; tilt_deg: number | null }[] };
    const cam = bundle.anchors.find((a) => a.id === ids.camAnchor)!;
    expect(cam.mount_height_m).toBe(2.2);
    expect(cam.tilt_deg).toBeNull();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('[data-view-3d]')).toBeEnabled({ timeout: 30000 });
    await host.locator('[data-view-3d]').click();
    await expect(host.locator('sw-plan-3d[data-floor-3d]')).toHaveAttribute('data-ready', '', { timeout: 30000 });
    const d = await describe3d(page, HOST);
    const camPart = d.parts.find((p) => p.id === `cam:${ids.camAnchor}`)!;
    expect(camPart.position[1]).toBe(2.2);
    expect(camPart.rotation[0]).toBe(10); // the default tilt
    // an entity anchor gets the mount field only (no tilt), with the door-station default as its placeholder
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} sw-plan-canvas g.marker[data-id="${ids.lockAnchor}"]`).click({ timeout: 30000 });
    await expect(page.locator(`${ed} [data-anchor-mount]`)).toHaveAttribute('placeholder', '1.4');
    await expect(page.locator(`${ed} [data-anchor-tilt]`)).toHaveCount(0);
  });

  test('performance: frames over two seconds on the floor and on a 3,000-chair floor (>= 20 fps asserted; the numbers are reported)', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const measure = async (label: string) => {
      const el = page.locator(`${HOST} sw-plan-3d[data-floor-3d]`);
      await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
      await page.waitForTimeout(1000); // let the first frames and the chunk settle
      const before = Number(await el.getAttribute('data-frames'));
      await page.waitForTimeout(2000);
      const after = Number(await el.getAttribute('data-frames'));
      const fps = Math.round((after - before) / 2);
      const parts = Number(await el.getAttribute('data-parts'));
      const line = `PERF ${label} fps=${fps} parts=${parts}`;
      console.log(line);
      testInfo.annotations.push({ type: 'perf', description: line });
      return { fps, parts };
    };
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const host = page.locator(HOST);
    await expect(host.locator('[data-view-3d]')).toBeEnabled({ timeout: 30000 });
    await host.locator('[data-view-3d]').click();
    const small = await measure('sample');
    expect(small.fps).toBeGreaterThanOrEqual(20);
    // 3,000 chairs in a 60 x 50 grid inside the room, published; the small objects hide when the camera is far (> 3,000 parts)
    const chairs = Array.from({ length: 3000 }, (_, i) => OBJ(`big${i}`, 'chair.basic', [0.12 + (i % 60) * (0.76 / 59), 0.12 + Math.floor(i / 60) * (0.46 / 49)]));
    const g = await draft();
    const objects = (g.doc.objects as Record<string, unknown>[]).filter((o) => !String(o.id).startsWith('big'));
    await saveDraft({ objects: [...objects, ...chairs] });
    await publish();
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await expect(host.locator('[data-view-3d]')).toBeEnabled({ timeout: 60000 });
    await host.locator('[data-view-3d]').click();
    const big = await measure('chairs');
    expect(big.parts).toBeGreaterThanOrEqual(3000);
    expect(big.fps).toBeGreaterThanOrEqual(20);
    const d = await describe3d(page, HOST);
    expect(d.parts.filter((p) => p.id.startsWith('obj:big')).length).toBe(3000);
    await saveDraft({ objects }); // the small floor again for anyone who reruns a single test
    await publish();
  });
```

- [ ] **Step 2: The complete run, twice**

```bash
cd /c/cloude/smplwisebms/frontend && npm run build && bash "$SP/restart_dev.sh"
SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-4.spec.ts --project=desktop --workers=1 --reporter=line 2>&1 | tee "$SP/live_0187_t10.txt"; grep PERF "$SP/live_0187_t10.txt"
```

Expected: `10 passed` (or 9 + 1 skipped); two `PERF` lines, for example `PERF sample fps=60 parts=64` and `PERF chairs fps=58 parts=3080` on this workstation's GPU. If `chairs` falls under 20 fps: profile first (`data-fps` while orbiting; the Chrome performance panel on the preview), then act only inside `scene-three.ts` - the levers are `renderer.setPixelRatio(1)` on descriptions above 3,000 parts, and `HIDE_SMALL_DISTANCE_M` lowered to 30; never raise the assertion. Run the spec a second time to confirm it is stable (the beforeAll rebuilds the floor; a stale `ids` from a crashed run is impossible because every run creates its own site).

Then the neighbours, for the baseline the release compares against:

```bash
SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts tests/evidence-plan-studio-2.spec.ts tests/evidence-plan-studio-3.spec.ts tests/evidence-editor.spec.ts tests/evidence-history-map.spec.ts tests/evidence-event-detail.spec.ts tests/evidence-lovelace.spec.ts tests/evidence-mobile.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/neighbours_0187_t10.txt" 2>&1; tail -n 5 "$SP/neighbours_0187_t10.txt"
```

Expected: the same results as the phase-3 baseline (`$SP/neighbours_0185.txt`; a failure naming the NVR / go2rtc / HA is BLOCKED, anything else is fixed before Task 11). Then `powershell -NoProfile -ExecutionPolicy Bypass -File /c/cloude/smplwisebms/scripts/dev_cleanup.ps1` (keep the backend up for Task 11).

- [ ] **Step 3: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/tests/evidence-plan-studio-4.spec.ts frontend/src/map/scene-three.ts frontend/src/map/scene-builder.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
test(plan-studio): anchor fields end to end and the frame-rate measurement on the sample and on 3000 chairs (T087)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

(`git add` of unchanged `scene-three.ts` / `scene-builder.ts` is a no-op; keep them in the command for the case the measurement touched them.)

---

### Task 11: Release 0.1.87 — full verification, version, records, owner checklist (stop after the release commit)

**Files:**
- Modify: `smplwise_vms/config.yaml`, `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` (0.1.87)
- Modify: `smplwise_vms/CHANGELOG.md`, `contracts/API_INVENTORY.md` (generated), `smplwise_vms/www/` (generated by `build:addon`)
- Modify: `management/tasks.json`, `management/test_catalog.json` and the generated views (`scripts/project_status.py --write`)
- Create: `docs/operations/PLAN_STUDIO_PHASE4_CHECKLIST_HE.md`
- Modify: `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (implementation line), `docs/changes/CR-003-PLAN-STUDIO.md` (status line)

**Interfaces:**
- Consumes: everything above; the tree is at 0.1.86.
- Produces: the release commit of 0.1.87 on `pilot/T087-plan-studio-4`; T087 evidenced (BACKLOG); AT173 / AT174 recorded. **This task ends at the release commit: no merge, no push, no store reload - the controller does those.**

- [ ] **Step 1: Version bump and the generated API inventory**

```bash
cd /c/cloude/smplwisebms
sed -i 's/^version: "0.1.86"/version: "0.1.87"/' smplwise_vms/config.yaml
sed -i 's/io.hass.version="0.1.86"/io.hass.version="0.1.87"/' smplwise_vms/Dockerfile
sed -i 's/__version__ = "0.1.86"/__version__ = "0.1.87"/' smplwise_vms/backend/smplwise/__init__.py
grep -c '0\.1\.87' smplwise_vms/config.yaml smplwise_vms/Dockerfile smplwise_vms/backend/smplwise/__init__.py
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/api_inventory.py
git diff --stat contracts/API_INVENTORY.md
```

Expected: each file reports `1`; the inventory is rewritten at 0.1.87 (no route was added in this phase: only the version line and, if the generator lists request fields, `mount_height_m` / `tilt_deg` on the anchor bodies change).

- [ ] **Step 2: The whole backend suite and the goldens**

```bash
cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest -p no:cacheprovider > "$SP/pytest_0187.txt" 2>&1; echo "exit $?"; tail -n 3 "$SP/pytest_0187.txt"
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/geometry_golden.py --check; echo "golden $?"
```

Expected: `exit 0` and `N passed` (the phase-3 count plus 3 new tests: two in `test_anchor_3d.py`, one in `test_lovelace_card.py`); `golden 0`.

- [ ] **Step 3: The whole frontend check**

In `/c/cloude/smplwisebms/frontend`:
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npm run build` → exit 0 (the node chunk test reads `dist`)
- `npx playwright test tests/unit-geometry.spec.ts tests/unit-geometry-2.spec.ts tests/unit-studio-controller.spec.ts tests/unit-studio-ops-2.spec.ts tests/unit-plan-detect.spec.ts tests/unit-coverage.spec.ts tests/unit-anchor-3d.spec.ts tests/unit-scene-builder.spec.ts tests/unit-three-chunk.spec.ts --project=desktop --reporter=line` → all passed (the phase-3 node count plus 11 new: 5 coverage, 1 anchor, 3 builder, 2 chunk); note the gzip size the chunk test prints
- `npx playwright test tests/unit-plan-3d.spec.ts --project=desktop --workers=1 --reporter=line` → `3 passed`
- `bash "$SP/restart_dev.sh"` → `me: 200` and the new listener pid
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-4.spec.ts --project=desktop --workers=1 --reporter=line 2>&1 | tee "$SP/live_0187.txt"` → `10 passed` (or 9 + 1 skipped: the event page without an event), two `PERF` lines
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts tests/evidence-plan-studio-2.spec.ts tests/evidence-plan-studio-3.spec.ts tests/evidence-editor.spec.ts tests/evidence-history-map.spec.ts tests/evidence-event-detail.spec.ts tests/evidence-lovelace.spec.ts tests/evidence-mobile.spec.ts tests/evidence-zones.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/neighbours_0187.txt" 2>&1` → the same results as the Task 10 baseline; a failure that also fails in the baseline and names the NVR / go2rtc / HA (ConnectTimeout, source_unavailable) is BLOCKED, anything else is fixed before continuing
- `bash "$SP/fixture_chain.sh"` → `fixtures exit: 0` and the same count as phase 3 (the floor map and the style guide changed on purpose)
- `npm run build:addon` → writes `smplwise_vms/www` (the Lovelace test of Task 9 reads it); then `cd ../smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_lovelace_card.py -p no:cacheprovider` → `3 passed` against the fresh build

- [ ] **Step 4: CHANGELOG**

Insert at the top of `smplwise_vms/CHANGELOG.md`, right after the `# Changelog — SMPLWISE VMS add-on` line and its blank line:

```markdown
## 0.1.87 (pilot) — Plan Studio phase 4: schematic 3D inside the map, coverage stopped by walls, a true isometric on the building page
- Every map surface gains a 2D / 3D toggle (T087, CR-003, design section 10): the live floor map (also the key `3`), the
  historical map at the chosen instant and the event page, where the view opens from the camera of the event
  ("מבט מהמצלמה"). The scene is built deterministically from the published structure: walls with their height and openings
  (a lintel over a door, a sill and a head around a window, a passage as a gap; the door leaf turns 80° when its entity
  is open), library objects (boxes, cylinders, extruded polygons, stepped tribunes, composite items), levels as floor
  plates at their heights, stairs and ramps as steps between the levels, elevators as a translucent prism, room floors
  tinted with room-name sprites, cameras as a body with a translucent cone, Home Assistant entities as symbols coloured
  by their live state - lamps glow with a weak point light when on, doors and locks show open / locked. The selection is
  one with the 2D (a click on a camera opens its card with the live tile, a click on a lamp of a circuit runs the
  circuit's existing action with the same permission and confirmation), the layer switches and the level chips apply,
  the presets are top / isometric / from a camera, and "glTF" downloads the scene (`plan-3d-<floor>[-<level>]-<date>.gltf`).
- three.js (0.186, MIT) ships as a separate chunk fetched only on the first toggle (measured [paste the gzip size the chunk
  test prints] gzip, limit 200 KB); the 2D bundle did not grow; the chunk URL is relative, so the Lovelace card (which
  embeds the same floor screen through Ingress) gets the toggle for free. Without WebGL the toggle is disabled with
  "תלת-ממד לא זמין בדפדפן זה" and the 2D map is untouched. Frame rate measured in real Chrome on this workstation:
  [paste the two PERF lines] (the floor >= 20 fps is what the evidence asserts; 30 fps on a phone / 60 on a desktop is
  the design target, reported not asserted).
- Camera coverage now stops at the walls of the camera's level, in 2D on every map and in the 3D cone: rays within the
  field of view and the radius against the wall parts, a passage and an open door let a ray through, a closed door and a
  window stop it (planning information, not a promise that nothing is hidden). A manual coverage polygon always wins.
- Map anchors carry `mount_height_m` and `tilt_deg` (migration 0021; the anchor panel edits them; defaults when unset:
  camera 2.5 m / 10° down, door station 1.4 m / 0°, other entities 1.2 m / 0°); the bundle and every anchor answer
  return them.
- The building page draws a true isometric of every floor from its published walls (floor plates per level, walls as
  boxes) instead of the demo rectangles; floors without a structure keep the old thumbnail.
- Known limits: the SVG / PNG exports keep the unclipped cone (no backend mirror of the clipping in this phase); glass is
  treated as opaque for coverage; a bent stair polyline is drawn straight from its first to its last point; quality level
  1 only (flat materials, no shadows or textures) - PBR, the eye-level tour and editing in 3D stay phase 6; a plan without
  a calibration draws in estimated metres, marked "≈ מידות משוערות".
- Evidence: `test_anchor_3d.py` (migration, fields, validation, audit), `test_lovelace_card.py` (the built UI references
  its chunks relatively), node specs `unit-coverage`, `unit-anchor-3d`, `unit-scene-builder` (the pinned description
  `contracts/fixtures/plan_geometry/sample-v2.scene.json` and a 3,000-chair hall), `unit-three-chunk` (the gzip limit
  against a real build), the browser spec `unit-plan-3d` (the element and the demo floor without a backend), and the live
  spec `evidence-plan-studio-4` (ten tests in real Chrome: the live map, the history map, the event page, the building
  page, the glTF download, embed mode, the WebGL gate, the phone, the anchor fields, the frame rate).

```

Replace `[paste the gzip size the chunk test prints]` with the number from Step 3 (for example `160 KB`) and `[paste the two PERF lines]` with the two lines from `$SP/live_0187.txt` (for example `PERF sample fps=60 parts=64 · PERF chairs fps=58 parts=3080`). If the event-page test was skipped, change "ten tests" to "nine tests (the event page NOT_RUN: no event on a floor with a plan on the developer backend)".

- [ ] **Step 5: Records (only after Steps 2-3 are green)**

```bash
cd /c/cloude/smplwisebms && cat > "$SP/record_t087.py" <<'EOF'
"""Record the Plan Studio phase 4 evidence (T087 and its acceptance tests) at the tested commit. Numbers only."""
import datetime
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(r"C:\cloude\smplwisebms\management")
SP = pathlib.Path(sys.argv[1])
summary = re.search(r"(\d+) passed", (SP / "pytest_0187.txt").read_text(encoding="utf-8", errors="replace"))
if not summary:
    sys.exit("no pytest summary line")
N = summary.group(1)
live = (SP / "live_0187.txt").read_text(encoding="utf-8", errors="replace")
perf = " · ".join(l.strip() for l in live.splitlines() if l.strip().startswith("PERF "))
if not perf:
    sys.exit("no PERF lines in live_0187.txt")
live_summary = re.search(r"(\d+) passed(?:, (\d+) skipped)?", live)
if not live_summary:
    sys.exit("no live summary line")
passed, skipped = live_summary.group(1), live_summary.group(2) or "0"
event_note = "" if skipped == "0" else " (the event page test skipped: no event on a floor with a plan on the developer backend - NOT_RUN)"
commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True, cwd=ROOT.parent).strip()
today = datetime.date.today().isoformat()
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
env = f"workstation: dev backend 0.1.87 (SQLite) on 8099 + vite preview 4173, real Chrome through Playwright; pytest on Python 3.12 ({today})"
tasks = json.loads((ROOT / "tasks.json").read_text(encoding="utf-8"))
tests = json.loads((ROOT / "test_catalog.json").read_text(encoding="utf-8"))
by_task = {t["id"]: t for t in tasks}
by_test = {t["id"]: t for t in tests}
t087 = (f"{today} (0.1.87): Plan Studio phase 4 on commit {commit} - three 0.186 as an on-demand chunk (vite manualChunks, dynamic import, WebGL gate), "
        "map/coverage.ts (rays against the wall parts of the camera level; passages and open doors let through, closed doors and windows stop; used by the 2D canvas "
        "and the 3D cone), migration 0021 (map_anchors.mount_height_m, tilt_deg; routes validate 0-30 m / -90..90, explicit null clears, bundle and audit), "
        "map/scene-builder.ts (deterministic description: floors, rooms, walls split at openings with lintel / sill / head, door leaf by state, glass, objects incl. "
        "stepped / composite / extruded, connectors, cameras with clipped cones, entity sprites by state, glow lights; instance groups; pinned on "
        "contracts/fixtures/plan_geometry/sample-v2.scene.json), map/scene-three.ts + sw-plan-3d (InstancedMesh per group, OrbitControls with touch, presets top / iso / "
        "from camera, picking, outline, GLTFExporter, distance hide above 3000 parts), the toggle on the live map (key 3, shared selection, layers, levels, live states, "
        "circuit action through the existing route), the history map at the instant, the event page from the camera of the event, the true isometric on the building "
        f"page, the glTF download. Frame rate in real Chrome: {perf}. Tests: {N} backend passed (3 new), node specs unit-coverage 5 / unit-anchor-3d 1 / "
        f"unit-scene-builder 3 / unit-three-chunk 2, browser spec unit-plan-3d 3, evidence-plan-studio-4 {passed} passed{event_note}, neighbour specs as their "
        "baselines, fixture chain green.")
t = by_task["T087"]
t["evidence"].append(t087)
# status stays BACKLOG: the registry (scripts/project_status.py, AGENTS.md rule) refuses DONE and IN_PROGRESS while a dependency (T084) is BACKLOG;
# implementation evidence is not acceptance (phase-1 ruling R-T15-2) - progress.py counts the "on commit" wording of the evidence line
t["blocker"] = None
t["commit"] = commit
t["owner"] = t["owner"] or "Claude Code (tech lead); approver: product owner"
EVIDENCE = {
    "AT173": ["frontend/tests/evidence-plan-studio-4.spec.ts (the 2D / 3D toggle on the live map, the history map at the instant, the event page from the camera of the event; "
              "walls with height and openings, objects, levels and connectors, cameras with cones, HA entities in their live state; the selection shared with the 2D; "
              f"the lamp action through the existing route with its permission){event_note}",
              "frontend/tests/unit-scene-builder.spec.ts (the description is deterministic: the pinned fixture and a synthetic hall)",
              "smplwise_vms/backend/tests/test_anchor_3d.py (mount height and tilt: migration, routes, bundle, audit)"],
    "AT174": [f"frontend/tests/unit-three-chunk.spec.ts (the three chunk is separate and under 200 KB gzip) and evidence-plan-studio-4 (fetched only on the first toggle, once; {perf})",
              "frontend/tests/evidence-plan-studio-4.spec.ts (the phone at 390 px, embed mode as the Lovelace card embeds it, the WebGL gate, the glTF download with asset.generator and nodes)",
              "smplwise_vms/backend/tests/test_lovelace_card.py (the built UI references its chunks relatively)",
              "frontend/tests/unit-coverage.spec.ts and evidence-plan-studio-4 (coverage stopped by walls in 2D and in the 3D cone)",
              "frontend/tests/evidence-plan-studio-4.spec.ts (the building page draws a true isometric of the published walls)"],
}
for aid, ev in EVIDENCE.items():
    x = by_test[aid]
    x.update({"status": "PASS", "commit": commit, "environment": env, "evidence": ev, "executed_at": now})
(ROOT / "tasks.json").write_text(json.dumps(tasks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
(ROOT / "test_catalog.json").write_text(json.dumps(tests, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print("recorded at", commit)
EOF
MSYS_NO_PATHCONV=1 $PY "$SP/record_t087.py" "$SP" && MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/project_status.py --write
```

If any check in Steps 2-3 is not green, do not run the script: leave T087 BACKLOG, write the failing check into its `blocker` field and report it.

- [ ] **Step 6: Owner checklist, the design document line, the CR status**

Create `docs/operations/PLAN_STUDIO_PHASE4_CHECKLIST_HE.md` (as few rows as possible: only what no automated test can see - the look on the owner's own screen, phone and plan; every row names the test that already covers the mechanics):

```markdown
# סטודיו התוכנית — שלב 4: בדיקה אצל הבעלים (גרסה 0.1.87)

לכל סעיף: עבר / נכשל, והערה קצרה. הרשימה קצרה בכוונה: כל מה שניתן לבדוק אוטומטית כבר נבדק (העמודה האחרונה אומרת איפה),
ונשאר רק מה שדורש את העיניים שלך, את המסך שלך ואת התוכנית האמיתית שלך. אין צורך ב־NVR; מספיקה קומה עם מבנה מפורסם.

| # | מה עושים | מה אמור לקרות | מה כבר נבדק אוטומטית |
|---|---|---|---|
| 1 | "בדוק עדכון" בחנות התוספים ועדכון ל־0.1.87 | הגרסה מותקנת והמערכת עולה | — |
| 2 | מפת קומה עם מבנה מפורסם ← "3D" (או המקש 3) במחשב, סיבוב עם העכבר, זום בגלגלת, "מלמעלה" / "איזומטרי" / "מבט מהמצלמה" | הקירות בגובה, דלתות וחלונות במקומם, המנורות זוהרות כשהמפסק דולק, קונוסי המצלמות נעצרים בקירות; התנועה חלקה בעין שלך על הכרטיס הגרפי שלך | evidence-plan-studio-4 (טעינה לפי דרישה, סנכרון בחירה, שכבות, מפלסים, מצבים חיים, פעולת מעגל, קצב פריימים ≥ 20 על אולם של 3,000 כיסאות) |
| 3 | אותו מסך בטלפון: "3D" בשורת הכלים, אצבע אחת מסובבת, שתי אצבעות מקרבות ומזיזות | חלק מספיק על ה־GPU של הטלפון שלך; אין גלילה הצידה | evidence-plan-studio-4 (390 px: המתג בשורה, בלי גלילה הצידה, touch-action על הקנבס) |
| 4 | כרטיס ה־Lovelace ב־Home Assistant (`view: map`) ← "3D" בתוך הכרטיס | התלת-ממד נטען בתוך הכרטיס דרך Ingress (הנתיב היחסי של ה־chunk) | test_lovelace_card.py (הבנייה מפנה ל־chunk יחסית) ו־evidence-plan-studio-4 (מצב embed=1) — רק נתיב ה־Ingress האמיתי של ההתקנה שלך אינו נבדק אוטומטית |
| 5 | התוכנית האמיתית שלך: הקונוסים ב־2D וב־3D | הקונוס נעצר בקיר הקרוב ועובר במעבר ובדלת פתוחה — מידע לתכנון, לא הבטחה שאין שטח מת | unit-coverage (ארבעה כיוונים, מעבר, דלת סגורה ופתוחה, חלון) ו־evidence-plan-studio-4 על תוכנית סינתטית |

**חשוב לדעת:** ייצוא ה־SVG / PNG עדיין מצייר את הקונוס המלא (מגבלה ידועה של השלב); זכוכית נחשבת אטומה לכיסוי; מדרגות מפוליליין
מעוקל מצוירות בקו ישר; רמת האיכות היא סכמטית (חומרים שטוחים, בלי צללים) — ריאליסטי וסיור בגובה עין הם שלב 6; אין עריכה בתלת-ממד.
```

In `docs/architecture/PLAN_STUDIO_DESIGN_HE.md`, after the phase-3 implementation paragraph (the one starting `שלב 3 (T086) מומש בגרסה 0.1.86`), add a new paragraph:

```markdown
שלב 4 (T087) מומש בגרסה 0.1.87; רשימת הבדיקה לבעלים: `docs/operations/PLAN_STUDIO_PHASE4_CHECKLIST_HE.md`. הבדלים
שנרשמו במימוש שלב 4: ברירות המחדל של גובה ההתקנה וההטיה (4.1) הן מצלמה 2.5 מ׳ / 10° מטה, עמדת דלת (ישות בשכבת הדלתות)
1.4 מ׳ / 0°, שאר הישויות 1.2 מ׳ / 0° (במסמך נכתב 2.7 / תקרה−0.1 / 1.0 / 2.2); מנורה שיש לה גוף מהספרייה לוקחת את גובה
הגוף; קבוצות ה־instancing הן לפי (צורה, צבע, שקיפות) והגודל במטריצת המופע; זכוכית עוצרת כיסוי (מידע לתכנון); ייצוא
SVG / PNG לא נחתך בקירות (אין מראה בשרת בשלב זה); מדרגות מפוליליין מעוקל מצוירות ישר; `tilt_deg` נערך בפאנל למצלמות
בלבד (הנתיב מקבל אותו לכל עוגן); רמת האיכות הראשונה בלבד (10.4).
```

In `docs/changes/CR-003-PLAN-STUDIO.md`, in the `**Status:**` line replace `phase 4 (T087, 3D schematic) pending;` with `phase 4 in 0.1.87 (T087, schematic 3D inside every map, coverage stopped by walls, the true isometric; quality level 1 only);`.

- [ ] **Step 7: The release commit — and stop**

```bash
cd /c/cloude/smplwisebms && git add -A
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 || echo "SECRET SCAN FAILED - do not commit"
git status --short | head -40
msg=$(mktemp) && cat > "$msg" <<'EOF'
release: 0.1.87 - Plan Studio phase 4 (T087, CR-003): schematic 3D inside every map, coverage stopped by walls, true isometric, glTF

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
git log --oneline -1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev_cleanup.ps1 -StopBackend
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/progress.py
```

Expected: `git status` shows only this plan's files (no `private-evidence/`, `secrets/` or `data/`; `smplwise_vms/www` and `contracts/fixtures/plan_geometry/sample-v2.scene.json` are meant to be there); the commit lands on `pilot/T087-plan-studio-4`; the progress table counts T087. **Do not merge, push or reload the store** - report the commit hash, the test counts, the gzip size and the two PERF lines, and stop.

---

## Self-Review

**1. Spec coverage** (design `PLAN_STUDIO_DESIGN_HE.md`, phase 4 of section 14, and the rulings):

| Design section / ruling | Where |
|---|---|
| 2 principle 4: the same JSON + tokens → the same scene graph; style from tokens | Task 4 (token names in the description, `r4`, sorted parts, the pinned fixture), Task 5 (`SceneView.material` reads the computed tokens) |
| 2 principle 7: `map.read` sees 3D; actions keep their permissions | Task 6 (`onPartSelect` → the existing `trigger`; nothing new server-side), Task 9 (embed) |
| 2a table: the live map, the history map, the event page, the Lovelace card, the building page, coverage stopped by walls, the phone | Tasks 6, 7, 7, 9, 8, 2, 9 |
| 2a rule 3: levels also for anchors, cameras at the right height | Task 4 (`level(a.level_id)` for every anchor; `shown()`), Task 6 (the level chips) |
| 4.1: migration 0021 `mount_height_m`, `tilt_deg` (defaults per the ruling, recorded) | Task 3; the interpretation and the design line in Task 11 |
| 4.2: `height_m`, `base_z_m`, `sill_m`, `anchor_ref` on openings, `levels`, `connectors`, `groups` | Task 4 (walls, openings, connectors, objects; groups unused: instancing is by shape and colour) |
| 5: no new route; the bundle carries the anchor fields | Task 3 (`anchor_row`), Task 11 (inventory regenerated) |
| 7 (the editor): the anchor panel edits the two fields | Task 3 (`renderMount`), Task 10 (the live test) |
| 8: floor plates per level, walls from the level's elevation, the tribune descends | Task 4 (`floors`, `structure`, `objectParts` stepped on L1 in the tests) |
| 10.1: `three` from npm, a separate chunk on demand, ≤ 200 KB gzip, no CDN, relative URLs | Task 1 (dependency, `manualChunks`, the probe build), Task 5 (the dist assertion), Task 9 (the backend test) |
| 10.2: the builder's inputs and outputs, axes, floors, walls split at openings, lintel / sill / head, leaf 80°, glass, objects by shape, `InstancedMesh`, `userData`, cameras with cones tilted 10° by default and `tilt_deg`, entities by state, lamps glow + point light, levels and connectors, room-name sprites | Task 4 (all), Task 5 (`InstancedMesh`, sprites, lights) |
| 10.3: orbit / zoom / pan, presets top / iso / from camera, layers as in 2D, level switch, click selects and syncs, hover tooltip, camera → live tile, circuit → the existing action, the key `3` | Task 5 (controls, presets, picking, tooltip), Task 6 (sync, layers, level, tile, action, the key), Task 7 (the key on the history map) |
| 10.4 level 1: flat materials, ambient + directional, no shadows; 60 / 30 fps target; instancing up to 3,000; distance hide beyond | Task 5 (`MeshLambertMaterial`, lights, `HIDE_SMALL_*`), Task 10 (the measurement) |
| 10.5: the description snapshot per fixture; screenshots for humans only | Task 4 (`sample-v2.scene.json`, `SCENE_WRITE=1`), no screenshot assertion anywhere |
| 11: glTF in the client through `GLTFExporter`, file name floor + level + date | Task 5 (`exportGltf`, `download`), Task 6 (`exportName`), Task 8 (the live assertion) |
| 12: actions from 3D through `ha.entity.control` and the grants; no new audit | Task 6 |
| 13: evidence specs for 3D (description + screenshot for humans) | Tasks 4, 5, 10 |
| 14 row 4: migration 0021, the chunk, the builder, `sw-plan-3d` as a toggle on the floor screen, the history map and the event page, selection sync, layers, levels, cameras and cones, live states, coverage stopped by walls (2D and 3D), the true isometric, glTF; the acceptance (opens in ≤ 3 s, a lamp click switches with permission, the tribune descends, a cone stops at a wall, a stable snapshot, works on a phone and in the card) | Tasks 1-10; the ≤ 3 s is the `data-ready` wait (30 s ceiling) - the measured time is in the live report, not asserted |
| 15: chunk size, phone performance, openings without CSG (rounded ones as rectangles) | Tasks 1, 5, 10; Task 4 |
| 16 decisions 3 (wall splitting) and 4 (three, own chunk, no CDN) | Tasks 4, 1 |
| R-P4-1 … R-P4-12 | Rulings 1-12 above; every element named in R-P4-1 has a task in this table |

Gaps found and recorded (not silent): the design's 4.1 defaults differ from the ruling (interpretation 1); `tokens.css` has no dark theme (interpretation 5); the event-page live test depends on the NVR having delivered an event (interpretation 8); the ≤ 3 s opening time of section 14 is reported, not asserted (a loaded machine would flake).

**2. Placeholder scan:** every code step carries the full code and every command is exact. The run-time values are read from files by the release script: the backend count (`pytest_0187.txt`), the live summary and the `PERF` lines (`live_0187.txt`). The CHANGELOG's `[paste …]` blanks are the deliberate ones, filled in Task 11 Step 4 from the same files. No "similar to Task N", no "TBD".

**3. Type and name consistency:** checked across tasks in the table below.

## Appendix: Consistency table

### A. Shared files and interfaces

| # | Tasks | Shared thing | Both sides |
|---|---|---|---|
| C1 | 1 ↔ 5 | The chunk boundary | `scene-three.ts` imports every three symbol from `./three-bundle` (never from `three`); `vite.config.ts` routes `node_modules/three/` to the `three` chunk; `unit-three-chunk` asserts `WebGLRenderer` is absent from the entry |
| C2 | 1 ↔ 6, 7 | The gate | `webglAvailable()` / `WEBGL_UNAVAILABLE_HE` from `map/webgl.ts` are what the three screens import; the note text equals the string the gate test asserts (`'תלת-ממד לא זמין בדפדפן זה'`) |
| C3 | 2 ↔ 4 | Coverage | `blockingSegments(doc, W, H, level, entityStates, catalog?)` and `clipCoverage(origin, rotation, fov, radiusPx, segs)` are called by `Builder.segments` / `Builder.anchors` with those argument orders; `isOpenState` decides the door leaf in `Builder.structure` and the door segment in `blockingSegments` alike |
| C4 | 2 ↔ 6, 7 | `PlanMarker.level` | The three screens set `level: a.level_id ?? null`; the canvas's `clippedCoverage` reads `m.level ?? defaultLevelId(doc)` |
| C5 | 3 ↔ 4 | Defaults | `anchor3d(a)` takes `{ resource_type, layer_id, mount_height_m?, tilt_deg? }`; `SceneAnchor` carries exactly those fields (plus the rest); `Builder.anchors` destructures `mount_height_m` / `tilt_deg` from its answer |
| C6 | 3 ↔ 6, 7, 10 | The anchor fields | `Anchor.mount_height_m` / `tilt_deg` (types.ts) feed `sceneAnchors` in both screens; the live test reads the same names from the PATCH body and the bundle |
| C7 | 4 ↔ 5 | The description | `ScenePart.shape` ∈ `box | cylinder | prism | sprite | light` - `SceneView.single` handles each; `group` is set only for `box` / `cylinder` and `setDescription` instances exactly those; `rotation` order `'YXZ'` in `transform` and `setDescription` matches the builder's "yaw first"; `prism.polygon` is relative to `position` and `size[1]` is the height (both in `single` and `setSelected`); `userData.id` is what `setSelected(sourceId)` and `pick()` use |
| C8 | 4 ↔ 6, 7 | `SceneInput` | Both screens pass `doc, width, height, anchors, entityStates, circuitStates, catalog, zones, level?, layers?`; `SceneLayers` keys `structure, objects, connectors, cameras, entities, zones`; the floor map pre-filters anchors by the 2D layers and passes the four document layers |
| C9 | 4 ↔ 8 | The isometric | `isoProjection(desc)` returns `{ faces: { points, face: 'plate' | 'side' | 'top', color, opacity }[], levels }`; `sw-floor-iso` renders `polygon.plate`, `polygon.side.f-side`, `polygon.top.f-top` from it; the tests count `polygon.plate` / `.side` / `.top` |
| C10 | 4 ↔ 4 (plan-catalog) | `lookup3dOf` | Returns `{ shape, color_token, role, mesh }` = `Catalog3D`; `MeshPart` is declared in `plan-catalog.ts` and re-exported by `scene-builder.ts`; the builder reads `item.mesh` for composites and `item.role === 'light'` for lamps |
| C11 | 5 ↔ 6, 7 | The element's contract | Properties `description, selectedId, preset, cameras, labels, exportName`; event `part-select` with `{ id, kind }`; attributes `data-ready, data-parts, data-preset, data-selected, data-frames, data-fps, data-estimated`; the screens use exactly these; `kind` values the screens branch on (`camera, entity, object, zone`) are the `userData.kind` strings the builder writes |
| C12 | 5 ↔ 8 | Export | `SwPlan3d.download()` builds `${exportName}.gltf` from `exportGltf()`; the live test matches `/^plan-3d-.+-\d{4}-\d{2}-\d{2}\.gltf$/` against the floor map's `exportName` (`plan-3d-<floor>[-<level>]-<yyyy-mm-dd>`) |
| C13 | 5 ↔ 5 (style guide) | The demo host | `[data-3d-demo-load]`, `[data-3d-demo-selected]`, `[data-3d-unavailable]` on the style guide; the element's `toScreen`, `description`, `exportGltf` are the public members the browser test calls |
| C14 | 6 ↔ 10 | Live selectors | `[data-view-3d]`, `[data-3d-unavailable]`, `sw-plan-3d[data-floor-3d]`, `[data-level-chip=…]`, `[data-sidelist-toggle]`, `[data-side-entity=…]`, `[data-circuit-status]`, `.layers button[aria-label="עצמים"]`, `g.marker.selected[data-id]`, `sw-drawer[open] sw-camera-tile` all exist in the floor map (this phase or earlier) |
| C15 | 7 ↔ 7 (tests) | History / event selectors | `sw-plan-3d[data-history-3d]`, `[data-history-camera]`, `sw-plan-3d[data-event-3d]`, `[data-event-3d]` exist in the two screens; the history preset comes from `?camera=` through `this.camera` → `preset3d` |
| C16 | 8 ↔ 8 (tests) | Building page | `sw-floor-iso[data-floor-iso="<floor id>"]` with `data-iso="real" | "demo"` set in `updated()` |
| C17 | 9 ↔ 1, 5 | The built files | The backend test greps `from"./three-<hash>.js"` in `sw-plan-3d-*.js` and `./assets/index-` in `index.html`: Vite with `base: './'` emits exactly these forms (the same strings `unit-three-chunk` asserts on `dist`) |
| C18 | 10 ↔ 11 | The numbers | The perf test prints `PERF <label> fps=<n> parts=<n>`; `record_t087.py` greps lines starting with `PERF `; the CHANGELOG quotes the same lines |
| C19 | 4 ↔ 2 (fixture) | The golden | `sample-v2.scene.json` is written by the spec from `sampleInput()` (fixed anchors, states, zones written in the spec); any change to the builder, to `coverage.ts` or to `buildPrimitives` that moves a number fails the comparison until the golden is regenerated on purpose |

### B. Per task: tests against code, created files against later edits

| T | Task | Tests ↔ code |
|---|---|---|
| T1 | 1 | `unit-three-chunk` builds `src/map/three-bundle.ts` (created in the same task) with `manualChunks` identical to `vite.config.ts`; `webgl.ts` is exercised through the screens' gate tests (Task 9) |
| T2 | 2 | `unit-coverage` calls `blockingSegments`, `raySegment`, `clipCoverage`, `coveragePolygon`, `hasWallsOnLevel`, `isOpenState` with the signatures above; its ray indices (`bearing + 180`, `1 + 45`) follow `clipCoverage`'s `n = max(24, ceil(fov))` and the origin-first rule for `fov < 360` |
| T3 | 3 | `test_anchor_3d.py` posts / patches `mount_height_m`, `tilt_deg`, reads them from the anchor answers, the list, the bundle and the audit rows (`details.before / after`); `unit-anchor-3d` reads `ANCHOR_3D_DEFAULTS`, `anchor3dKind`, `anchor3d` |
| T4 | 4 | `unit-scene-builder` reads every part id named in the interface block (`floor:`, `room:…#label`, `label:`, `wall:<id>#<part>`, `lintel:`, `sill:`, `head:`, `door:`, `window:`, `obj:…#n`, `obj:…#glow`, `conn:…#n`, `cam:…`, `cam:…#cone`, `ent:…`) and the colours the builder writes |
| T5 | 5 | `unit-plan-3d` (test 1) drives the style guide's host; the dist test reads what `npm run build` emits after the style guide's dynamic import exists |
| T6 | 6 | `unit-plan-3d` (test 2) and the first live test drive `[data-view-3d]`, the key, the layers, the level chips, the states, the selection paths and the circuit action written in `onPartSelect` |
| T7 | 7 | The history and event live tests drive `preset3d` from `?camera=`, `onPartSelect` (history: select only), `eventPreset` and `selected3d` |
| T8 | 8 | The browser test sets `iso` on the element and counts faces; the live tests read `data-iso`, the plate count (two levels) and the glTF captured through the stubbed anchor click |
| T9 | 9 | `test_lovelace_card.py` reads `smplwise_vms/www` rebuilt in the same task; the embed / gate / phone live tests use the selectors of Task 6 and the gate text of Task 1 |
| T10 | 10 | The anchor-fields test uses `[data-anchor-mount]` / `[data-anchor-tilt]` (Task 3) and `describe3d` (Task 6); the perf test reads `data-frames` / `data-parts` (Task 5) and publishes through `saveDraft` / `publish` (Task 6) |
| T11 | 11 | `record_t087.py` reads `pytest_0187.txt` and `live_0187.txt` written in Steps 2-3; the CHANGELOG blanks are filled from the same files |

