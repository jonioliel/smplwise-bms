# CR-029 — Plan Studio 6: realistic 3D and the eye-level walk-through (T089)

**Status:** Proposed 2026-10-05 (planning only; no product code in this CR). Owner decision 2026-10-05: Studio 6 is planned
and built **before** Studio 5 (T088, exports / DXF / plan packages). Nothing below is scheduled until the owner answers §11.
Branch: `pilot/studio6-plan`. Hebrew summary and the owner questions: §12 (תקציר בעברית).

**Related:** CR-003 (Plan Studio, design document `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` §10.4 items 2-3 and §15),
CR-006 (3D visual level: quality level 2, the state layer, skins 2a - AI skins paused by the owner 2026-09-29), CR-027
(3D round 2: night mode, floor strip, own floor images with a lights-on variant clipped per room), the owner references
`reference-3d-dashboard-inspiration` (pre-rendered 2-state renders + SVG room masks) and NeonPlan 3D (wall-tablet 3D card:
glowing lights, animated doors/blinds, draws no frame when nothing changes). Task card T089 (R177/R178, AT177/AT178),
dependency T087.

**Registry note (fact):** T089 depends on T087, which is still recorded BACKLOG with evidence "on commit" because the
registry refuses DONE while its own dependencies are BACKLOG (the same block that holds T084). Before T089 can be READY the
coordinator must either close T087 through the registry rule or record the exception in `management/tasks.json`
(contradiction recorded, not resolved here).

---

## 1. Goals - what "realistic" means for this product

The product is a security / building-management console, not a visualiser. "Realistic" has to serve three users:

| User | What realism buys them | What it must never cost |
|---|---|---|
| Operator at the wall / desk | Recognises the real room at a glance (floor material, wall colour, furniture, daylight); sees which lights are on, which doors are open, where the cameras look - from the 3D, without reading labels | Frame rate, battery and heat on an always-on tablet; false state (a door drawn open because the sensor is stale) |
| Site admin / editor | Walks the plan at eye level to check camera placement, coverage, blind corners and door swings before anything is mounted | Hours of material work per site; a second tool |
| Owner selling the system | The "wow" of the reference renders, on every site, from the same geometry, without an artist | Cloud renders, AI, licences, per-site cost |

So, concretely, realistic = **quality level 3** of the existing `sw-plan-3d` view:

1. **Materials** on walls, floors, ceilings, doors, windows and objects: tiling PBR textures (colour + normal + roughness)
   resolved from a small built-in library by wall kind, room, catalog item and an optional per-item override.
2. **Lighting**: a sky and sun that follow the time of day (and night, which CR-027 already has) - sun direction from the
   hour, the date and the plan's north; soft shadows (level 2 has them); lamps that emit light where they are, in the lamp's
   colour; window daylight.
3. **Baked lighting (optional, slice S3)**: an ambient-occlusion / indirect-light map baked once per floor in the
   administrator's browser and stored on the server, blended at run time per room by state - the same "two aligned images
   and a mask" idea as the owner's reference, moved into 3D.
4. **Device states as physical changes**, not only tints: lit lamps glow and light the room, doors and covers animate open /
   closed, locks show their state on the leaf, cameras keep their cones, presence keeps the fading blue (CR-006 1b).
5. **The eye-level walk-through**: a first-person camera at eye height that collides with walls, passes only open doors and
   passages, climbs stairs between levels, and can be started from any door, room, camera or saved position.
6. **The default stays schematic** (acceptance R178): level 3 and the walk are opt-in per browser, with the automatic
   fallback ladder of §3.4 so no device is ever stuck on a slide show.

Out of scope (recorded): photoreal furniture models for all 154 catalog items (the catalog stays procedural, §6.3 proposes
a CC0 model set for the twenty most visible items as an owner option), AI renders (paused by the owner, CR-006), DWG / IFC
(T065 / T090), VR headsets, multi-user avatars.

---

## 2. Where the code stands today (facts)

- `frontend/src/map/scene-builder.ts` (1,017 lines): a pure function, document + anchors + states + catalog + zones →
  `SceneDescription` (parts: floor / room / tint / marker / chip / label / wall / lintel / sill / head / door / window /
  object / connector / camera / cone / entity / glow; shapes box / cylinder / prism / sprite / light). Deterministic
  (design rule 4; `unit-plan-3d-determinism.spec.ts`). Colours are token names, not values.
- `frontend/src/map/scene-three.ts` (1,286 lines): `SceneView` realises the description with three.js r186 - instancing
  by (shape, colour, opacity), level 1 Lambert / level 2 Standard materials, hemisphere + shadow-casting sun
  (`PCFSoftShadowMap`, 2048² / 1024² under `HEAVY_CONFIG`), ACES tone mapping, contact-occlusion planes, cutaway walls by
  azimuth, a pool of 8 point lights for lit lamps, night mode, `OrbitControls`, presets top / iso (orthographic) / persp /
  from-camera, picking, outline, DOM chips and pills, thumbnails, PNG capture, glTF export. Render on demand
  (`invalidate`), continuous only while probing or measuring.
- `frontend/src/map/sw-plan-3d.ts`: the element - quality chips (1 / 2), the 2.5 s frame-rate probe and the session
  fallback to level 1 under 30 fps, the strip, the bar, the overlays.
- `frontend/src/map/three-bundle.ts`: the only import of `three`; Vite `manualChunks` puts it in the `three` chunk
  (154.6 KB gzip today against the 200 KB cap; `unit-three-chunk.spec.ts` guards it). No post-processing packages.
- `frontend/src/map/geometry.ts`: the v2 document. Heights exist: `GeomLevel.elevation_m / ceiling_height_m`,
  `GeomWall.height_m / base_z_m / thickness_m / kind`, `GeomOpening.height_m / sill_m / width_m / swing / hinge`,
  `GeomObject.size / z_m`, `rooms[].ceiling_height_m`, `floor_height_m`, connectors with the stairs model (flights,
  landing, rise). **No** material, texture, light-emission or north fields anywhere.
- `smplwise_vms/backend/smplwise/catalog/objects.json`: 154 items, 12 categories, `shape`, `size`, `mesh` (box /
  cylinder parts with a colour token), `color_token`, `ifc`. **No** material or light fields.
- `frontend/src/map/coverage.ts`: `blockingSegments` / `clipCoverage` - camera cones already stop at walls in 2D segment
  space; `isOpenState` decides whether an opening blocks. The walk's collision can reuse this exact segment list.
- `frontend/src/map/room-state.ts`: per-room lit / presence / openings / temperature from anchored entities; the 3D and 2D
  state layers draw from it.
- CR-027: `floor_images` (one base picture + a lights-on variant per floor, four-corner alignment, clipped per lit room),
  the server-side file store with path confinement (`services/skins/store._confine` pattern), backup coverage. This is the
  storage and compositing path §3.2's stills reuse.
- Measured (CR-006 1c, real Chrome, workstation): level 2 on the 3,000-chair floor 9-19 ms/frame at 1440 px under
  `HEAVY_CONFIG`; the 37-part sample ~50-58 fps under CPU load. Headless Chromium (SwiftShader) always falls back from
  level 2 - the visual baselines are drawn on SwiftShader and compared only on SwiftShader.

---

## 3. Rendering approaches

### 3.1 Approach A - real-time three.js PBR with textures, procedural sky and baked lighting ("level 3")

A third quality level of `SceneView`. Everything the viewer sees is drawn live from the geometry on the viewer's GPU.

- Materials: `MeshStandardMaterial` (or `MeshPhysicalMaterial` for glass only) with `map` / `normalMap` /
  `roughnessMap` from the material library (§6), tiling in metres through the existing metre-based geometry (UVs generated
  per box face and per prism from world position - a triplanar-free "box mapping" in the builder, deterministic).
- Sky and sun: a sun direction from (hour, day of year, latitude, plan north) - a 60-line solar-position function, unit
  tested; sky colours and the hemisphere light from the sun elevation (a small lookup, not an atmosphere shader - the
  `three/addons/objects/Sky` shader is ~9 KB gzip and would be acceptable, but it costs a full-screen pass per frame on a
  phone; decision in §9). The time comes from the site's clock (`time.zone`) with a slider override for planning.
- Lamps: the lit lamp's glow (exists) plus an emissive material on the lamp body and a `PointLight` from the pool, in the
  colour temperature of the catalog item; above `MAX_GLOW_LIGHTS` (8) the nearest to the camera get the lights, the rest
  the emissive only (deterministic by distance bucket, as the cutaway is by azimuth bin).
- Shadows: the level-2 sun shadow; a second small shadow map for the strongest lamp only at level 3 on desktop.
- Baked lighting (optional slice S3): ambient occlusion + indirect sun into one lightmap atlas per floor and level,
  baked in the administrator's browser with a hemisphere-sampling raster baker over the builder's parts (no path-tracer
  package - `three-gpu-pathtracer` is ~180 KB gzip and would break the chunk cap), stored on the server as a floor asset
  (CR-027's store), reused by every viewer until the geometry key changes (CR-006 2a's `geometry_key` rule).

| | |
|---|---|
| Pros | Scales to every site on day one; states live; free orbit, any preset, and it is the only approach that can host the walk-through; the deterministic description stays testable; no new backend authority for the look itself |
| Cons | The phone budget: textures and normal maps cost fragment time and memory; a kiosk tablet on 24/7 heats up unless frames stop when nothing changes; textures make pixel baselines GPU-dependent (mipmaps, anisotropy) so visual regression stays SwiftShader-only |
| Budget | Phone (390 px, 2× DPR capped at 1.5): ≥ 30 fps at 1,000 objects on level 3 - achievable by the `HEAVY_CONFIG` precedent (Lambert objects above 3,000 parts gave 25-35 % back); textures ≤ 1.5 MB per floor at level 3, loaded on demand outside the `three` chunk; lightmap ≤ 2 MB per floor |

### 3.2 Approach B - pre-rendered image sets + masks

Fixed views rendered once, shown as pictures. Two ways to make them:

- **B1 - rendered by our own level-3 view** in the administrator's browser at bake time (the CR-006 2a control-image
  path: fixed camera matrix, fixed size, off-screen view) - for each floor: the three overview presets × day / night ×
  lights-off / lights-on = 12 pictures, plus per-room masks projected with the same camera matrix (exactly what 2c planned).
- **B2 - rendered server-side.** Fact: the add-on runs on the HA host, Alpine / musl, no GPU, and Blender or a CPU
  path-tracer inside the add-on image would add hundreds of MB and minutes per view on a NUC. Recorded as **not feasible
  for the add-on**; a "render service on the runner" would be a new external dependency the owner has refused for AI
  renders and is not proposed here.

| | |
|---|---|
| Pros | The cheapest display there is: a picture, a mask, a tint - runs on any device, no WebGL at all, perfect for an always-on wall tablet and the Lovelace card; the compositing already exists (CR-027 floor images clipped per lit room) |
| Cons | Fixed camera: no orbit, no walk-through, no camera-preset view that is not pre-rendered; every geometry change invalidates the set (re-bake); a picture per state combination is not affordable, so only lit / unlit and open-door markers are overlaid, never arbitrary states; the 12 pictures per floor need ~3-6 MB of storage per floor and a bake pass the administrator must run |

### 3.3 Approach C - hybrid (recommended)

A plus B1, split by what each does best:

- **Level 3 real-time** is the realistic mode on desktop, tablet and a capable phone, and the only mode of the
  walk-through.
- **Stills (B1)** are produced by the same level-3 view as a by-product of the bake step ("הכן תמונות ותאורה לקומה"):
  the three presets × day / night × off / on. They serve (a) devices that fail the level-3 probe, (b) the kiosk mode after
  N minutes idle (the view swaps to the still of the current preset and stops drawing - NeonPlan's "no frame when nothing
  changes" taken one step further), (c) the Lovelace card and the phone app, which get a picture + masks over the API
  instead of a WebGL scene.
- **Masks per room** come from the room polygons projected by the still's camera matrix, computed on the client at bake
  time and stored next to the still - the owner's reference technique, generated, not hand-drawn.

The hybrid keeps one source of truth (the deterministic description), one storage path (CR-027 floor assets) and one
compositing path (the floor-image layer), and gives the acceptance pair - realistic level + walk-through - from the same
build.

### 3.4 Performance budget and the fallback ladder

| Device class | Target | Mechanism |
|---|---|---|
| Desktop / laptop (integrated GPU) | 60 fps vsync at level 3, 1,000 objects; ≥ 30 fps at 3,000 | render on demand; continuous only while walking or animating |
| Tablet (iPad 9th gen / mid Android) | ≥ 30 fps at level 3, 1,000 objects, DPR ≤ 1.5 | `HEAVY_CONFIG` thresholds lowered for level 3 (Lambert objects above 1,500 parts; 1024 shadow map always) |
| Phone (390 px) | ≥ 30 fps at level 3, 1,000 objects (R178) | DPR 1.5 cap; no lamp shadow; normal maps off above 1,000 parts; textures 512 px |
| Kiosk wall tablet (24/7) | zero frames when nothing changes; ≤ 1 frame per state change; still after idle | on-demand rendering (exists) + idle timer → still (§3.3) + `visibilitychange` already honoured |
| Weak / no WebGL (SwiftShader, old Android WebView, HA Companion on an old phone) | always usable | ladder below |

Fallback ladder, decided per mount by the existing probe (`DEFAULT_MIN_FPS` 30, 2.5 s window after three warm-up frames):
level 3 → level 2 → level 1 → stills (if the floor has a bake) → 2D. A fallback is remembered for the session and shown in
the existing note style (`data-3d-fallback`); choosing a level again measures afresh. The walk-through has its own floor:
under 24 fps during the walk it drops level 3 → 2 → 1 in place, never to stills (a still cannot be walked); with no
WebGL the walk button is disabled with the reason.

Memory: the GPU texture budget is counted (bytes of decoded textures) and capped at 48 MB on a phone / 128 MB elsewhere;
over it the material library serves its 256 px variants. Lost WebGL context on a kiosk (`webglcontextlost`) is already
followed by a redraw on restore; the kiosk mode adds a one-shot reload after three losses in an hour.

Chunk: the `three` chunk stays ≤ 200 KB gzip (today 154.6 KB). Level 3 adds: `Sky` shader (~9 KB, optional), the walk
controller (~6 KB, own code), the material resolver (~3 KB) - under the cap without the path-tracer. Textures, lightmaps
and stills are **assets**, never bundle code.

---

## 4. The eye-level walk-through

### 4.1 Camera

- Eye height 1.65 m above the level's floor (a setting `plan.walk.eye_m`, 1.2-2.0; 1.2 is a wheelchair check the owner
  may want for accessibility audits). Perspective 70° vertical FOV on a phone, 60° desktop. Near plane 0.05 m.
- The camera's y follows the ground under it: the level's `elevation_m`, a stair's interpolated rise along the connector
  polyline (`stairRise`, `stairPlan`), a tribune's row heights (`tribuneLayout`). A ramp interpolates linearly.
- Head bob none (motion sickness on a wall tablet); a 120 ms ease on turns from touch.

### 4.2 Controls

| Input | Move | Look | Other |
|---|---|---|---|
| Keyboard | W/A/S/D and arrows; Shift = 2× speed (walk 1.4 m/s, run 2.8 m/s) | Q/E turn 45° steps; mouse drag | Esc leaves the walk; `3` still toggles 3D; Enter = act on the looked-at device (the same action popover); number keys 1-9 jump to saved positions |
| Mouse | click-and-hold on the floor = walk toward the point; wheel = speed | drag (no pointer lock by default - §4.5) | hover = the existing tooltip; click a device = the existing popover |
| Touch (phone / tablet) | left-half virtual joystick (appears under the thumb, 56 px dead zone) | right-half drag; two-finger pinch = FOV 50-80° | tap a floor point = walk there along the open path (auto-walk; a tap mid-way cancels); long-press a device = its popover |
| Kiosk (no keyboard) | the same touch controls; a "סיור" button plays a saved route (positions in order, 4 s each) when the screen is idle (optional, S5) | | |

Keyboard / numeric alternatives exist for every spatial control (design contract): position fields (x, y in metres, heading
in degrees) in the walk bar, and the saved-positions list.

### 4.3 Collision

Collision is 2D and reuses the segment list the cameras' coverage already builds (`blockingSegments`): the player is a
circle of radius 0.28 m sliding against wall segments offset by half the wall thickness; a wall of kind `low` or `railing`
blocks the body but not the view (walls under 1.1 m `height_m` likewise, so a counter does not stop the eye); `base_z_m`
above the eye or the wall's top under the floor = no collision (a soffit).

Openings: a **door** is passable when its entity reports open (`isOpenState`) or it has no entity and the setting
`plan.walk.unsensed_doors` = `open` (§11 Q4); a **passage** is always passable; a **window** never (sill or not). A locked
door with a lock entity is closed to the walk; a door whose sensor is stale (`last_changed` older than the staleness
window the state layer already applies) is drawn with the stale token and treated as closed - stale is not open (the
master rule "historical unknown is not current state"). Objects block by their footprint only if `h_m` ≥ 0.9 and the item's
role is not `circulation` (a mat, a stair object, a tribune are walkable; a tribune's rows lift the eye).

Stairs and levels: entering a connector band (`stairPlan` outline or the plain band ± half width) switches the ground
function to the connector's interpolation; leaving it at the far end switches the active level (`level-select` fires, so
the 2D, the strip and the chips agree - the existing shared-selection rule). A connector to another floor (`floor_ids`)
ends in a "המשך לקומה…" prompt at the top of the stair: a floor switch is a document load, not a walk; the walk resumes at
the twin connector of the other floor if it has one (`needs_placement` false), else at the floor's default position.

Falling through: the ground query never fails - outside every level's extent the player is clamped to the extent and a
soft "קצה התוכנית" edge is drawn at 0.3 m.

### 4.4 Positions

- Start points, in order of preference: the saved default position of the floor; the first door on an exterior wall
  (`kind: exterior`) facing inward; the centre of the largest room on the default level.
- "Stand at camera X": the existing from-camera preset at the camera's mount height and tilt - from inside the walk it
  becomes a teleport with a 300 ms fade, and the walk's eye height resumes on the first move.
- "Stand in room X": the room's centroid (zone polygon) facing its longest wall.
- Saved positions per floor (name, x, y, heading, level): stored in the document as `walk_positions[]` (schema 2.1, §5),
  edited by `map.edit`, read by everyone with `map.read`. Position 1 = the default. A route = the list in order.
- The minimap: a 160 px 2D canvas (the existing `sw-plan-canvas` in a read-only mode at a fixed zoom) with a heading cone;
  tap = teleport (operator convenience, not an edit).

### 4.5 Pointer lock

Pointer lock gives mouse-look without a drag, but the product runs inside the HA Ingress `<iframe>`, where
`requestPointerLock` needs the embedding frame's permission policy (`allow="pointer-lock"`), which the product does not
control. Fact to verify in the first slice on the real Ingress page; the design therefore makes drag-to-look the default
and pointer lock an opt-in button that silently stays disabled where the API refuses. Nothing depends on it.

### 4.6 What the walk shows

Level 3 by default (or the level the ladder chose), the state layer as everywhere (lit lamps, open doors animated to 80°,
presence ring on the floor, temperature chip at the room's centre at 1.5 m, camera bodies and their cones as translucent
volumes - a planner's view of coverage from inside), entity pills on hover / long-press only (no pill cloud at eye
level), the cutaway disabled (walls full height), the room name as a small floor-level label at the door when entering.

---

## 5. Data requirements - what the geometry model has and what must be added

### 5.1 Already there (used as is)

Levels (elevation, ceiling height), walls (polyline, thickness, height, base, kind, `hollow`), openings (kind, width,
height, sill, swing, hinge, anchor), rooms (`level_id`, `ceiling_height_m`), objects (size, `z_m`, rotation, params,
anchor), catalog mesh parts, circuits (switch entity, members, power), connectors with the stairs model and the far
record, `floor_height_m`, shared spaces, calibration status (an uncalibrated plan walks in "≈" units with the estimate
note, as the 3D does today).

### 5.2 To add - schema 2.0 → 2.1 (all optional, backwards compatible; no SQL migration, the document is JSON)

| Field | On | Type | Default when absent | Why |
|---|---|---|---|---|
| `material_id` | wall, opening, object, `rooms[]` (floor), `levels[]` (default floor / ceiling) | string (library id) | resolved by rule: wall kind → `plaster_white` (interior), `plaster_exterior`; room floor → `floor_oak` for `residential`-tagged rooms else `floor_concrete`; door → `door_wood`; window → `glass`; object → the catalog item's `material_id` | the look; the resolver is a pure function (`material-resolve.ts`), so the same document gives the same materials |
| `ceiling` | `rooms[]` | `boolean` | `true` | a hall with a visible roof structure, an outdoor room (no ceiling, sky visible from the walk) |
| `north_deg` | document (`transform.north_deg`) | number 0-360 | `0` (plan up = north) | sun direction; set in the editor with a compass widget on the calibration card |
| `site.latitude / longitude` | **not in the document** - read from the HA config (`/api/config` already read for `time.zone`), fallback 32.0 / 34.8 (Israel) with a note | | | sun elevation by date; read-only, never written |
| `light` | object (lamp items) | `{ kind: 'ceiling' \| 'wall' \| 'spot' \| 'strip' \| 'floor', color_k: number, lumens: number, beam_deg?: number }` | from the catalog item (`lighting` category gets defaults: 3000 K, 800 lm, ceiling) | emission colour, intensity, a spot's cone |
| `glazing` | window openings | `'clear' \| 'frosted' \| 'tinted'` | `clear` | material |
| `walk_positions[]` | document | `{ id, name, x, y, level_id, heading_deg, is_default }` (0..1 plan space like everything else) | `[]` | §4.4 |
| `catalog_version` bump | objects.json | items gain `material_id`, lighting items `light`, seating `walkable: false` (default), circulation `walkable: true` | | §5.3 |

Validator rules (backend `plan_geometry` validator + frontend mirror): `material_id` must exist in the library manifest
(unknown → warning, fallback material; never an error, so an older library build still opens the document); `north_deg`
in [0, 360); `walk_positions` ids unique, positions in [0, 1], at most 50; `light.color_k` in [1800, 6500], `lumens` in
[1, 20000]. The geometry hash (`doc_hash`) covers the new fields, so a material change invalidates a bake (geometry key)
- deliberate: a bake with the old floor material is wrong.

### 5.3 Assets stored per floor (server, CR-027 store pattern)

`plan_bakes` table: floor, level, geometry key, kind (`lightmap` | `still`), variant (`day_off` | `day_on` | `night_off`
| `night_on`), preset (for stills), path, width, height, sha256, created_by / at. Files under
`<data>/plans/bakes/<floor>/…` behind the same `_confine` guard and `ID_RE` check as skins; in `PROJECT_TABLES` and
`FILE_COLUMNS` for backup; deleted with the floor; `GET /floors/{id}/bakes` lists, `POST` (multipart, `map.edit`,
PNG / WebP sniffed and decoded, size caps 4 MB lightmap / 2 MB still, no text chunks - the skins rule) stores,
`DELETE` removes. Served by `GET /floors/{id}/bakes/{kind}/{variant}[/{preset}]` with `map.read`, ETag by sha256. The map
bundle carries the list (urls + geometry key) so the 3D knows at mount whether a bake matches the published structure.

---

## 6. Asset and material library - plan and licensing

### 6.1 Rules

- **CC0 only** by default (no attribution obligation, no share-alike, no per-site licence): ambientCG (CC0),
  Poly Haven (CC0), cgbookcase (CC0), Kenney (CC0) for low-poly models, LearnOpenGL / three.js example textures are **not**
  used (mixed licences). CC-BY sources only if the owner chooses §11 Q6 ב, with a credits entry in the "אודות" screen.
- Every asset is listed in `frontend/public/plan3d/MANIFEST.json`: id, source URL, author, licence, download date,
  sha256 of the original, the processing applied. The manifest is unit-tested against the files on disk (every file has
  an entry; every entry's licence is in the allowed set). Nothing enters the repository without a manifest row.
- No Sketchfab / TurboSquid / CGTrader downloads (licence terms forbid redistribution in most tiers), no AI-generated
  textures (CR-006 decision: no AI for renders unless the owner reopens it), no photographs of the owner's sites in the
  repository (private-evidence stays private).

### 6.2 Materials (slice S1) - about 16 PBR sets

| Group | Ids | Source candidates |
|---|---|---|
| Walls | `plaster_white`, `plaster_exterior` (rough render), `concrete`, `brick_painted`, `tiles_white` (wet rooms) | ambientCG Plaster001 / Concrete034 / Bricks059 / Tiles074 |
| Floors | `floor_concrete`, `floor_oak`, `floor_tiles_grey`, `floor_sport` (parquet court), `floor_carpet`, `floor_asphalt` (parking), `floor_grass` (outdoor) | ambientCG WoodFloor051 / Tiles101 / Carpet013 / Asphalt012 / Grass004, Poly Haven sport parquet |
| Doors / windows | `door_wood`, `door_metal`, `glass` (physical, transmission 0.9), `glass_frosted` | ambientCG Wood049 / Metal032; glass is a shader, not a texture |
| Objects | `metal_dark`, `plastic`, `fabric_grey`, `wood_light` | ambientCG Metal / Fabric / Wood |

Processing: 1 K source → 1024 / 512 / 256 px variants, colour as WebP q85, normal as WebP lossless or PNG, roughness +
AO packed into one RG texture; ~120-180 KB per 512 set → the whole library ~3 MB on disk, loaded per material on demand
(a floor typically touches 5-8 sets). `KTX2 / Basis` would halve GPU memory but needs the `KTX2Loader` + a WASM
transcoder (~250 KB) - not in the first build; recorded as a later lever.

Tiling is in metres (`repeat = size_m / tile_m`, `tile_m` per material in the manifest), so a texture never stretches
with the plan scale; an uncalibrated plan tiles on the estimate.

### 6.3 Models (optional, owner Q10)

The catalog stays procedural (box / cylinder composites) in the first release - it is what makes 3,000 chairs instance
into one draw call. If the owner wants recognisable furniture, slice S8 adds a glTF per item for the ~20 most visible
items (chair, table, sofa, bed, cabinet, desk, lamp types, door station, extinguisher, AED, goal, basket) from Kenney's
furniture kit (CC0) or Poly Haven models (CC0), decimated to ≤ 2,000 triangles, Draco-free (the decoder is another
~100 KB), instanced per item id with the same (shape, colour) grouping - the description gains `shape: 'model'` with a
`model_id`, and level 1 / 2 keep drawing the box so the baselines of today never move.

### 6.4 Sky

Procedural: a sky-colour lookup by sun elevation drawn into the hemisphere light and the CSS backdrop (today's
`--sw-map-sky` tokens interpolated), optionally the three.js `Sky` addon (MIT, in the three package already, ~9 KB gzip)
for a real sun disc and horizon haze on desktop only. No HDRI files (1 K HDRI ≈ 1.5 MB each and the IBL needs a PMREM pass
- out of the phone budget).

---

## 7. Device-state integration and permissions

| State source | Today (level 1-2) | Level 3 / walk adds |
|---|---|---|
| Light / switch on a circuit or a lamp's own entity | glow sprite + point light from the pool (8), warm room plate | emissive lamp body in the item's colour temperature; the nearest 8 lamps get real lights, the rest emissive only; with a bake: the room's lit lightmap blended in by the circuit state (per-room blend weight in a tiny mask texture, one draw) |
| Door / window / cover sensor | leaf at 80° when open, red frame marker | the leaf animates 350 ms between states (ease), a cover (blind) slides down the window by its `current_position`; in the walk the door's passability follows the same state (§4.3) |
| Lock | carried in the model, not drawn | a small lock plate on the leaf with the lock token; the walk treats locked as closed |
| Presence / motion | blue ring with fade | unchanged; in the walk the ring is on the floor under the eye |
| Temperature / climate | chip | chip at 1.5 m in the walk; nothing else |
| Camera online / offline | body + cone, stale token | unchanged; in the walk the cone is a translucent volume the operator stands inside to check coverage |
| Stale / unknown | stale token, dimmed | **never** animates or lights anything; a stale door is closed for the walk; the state layer's staleness rule is the only source |

Actions from inside the 3D (a tap on a lamp, a door station, a lock) open the existing action popover - CR-007 device
control with its permission check, confirmation and server-side authorization. The 3D never calls a service itself and
the walk adds no new action path. Permissions, unchanged: `map.read` to view every level and to walk; `map.edit` to set
materials, north, positions and to run / upload a bake; `system.configure` for the three settings (`plan.quality` gains the
value `3`; new `plan.walk.eye_m`, `plan.walk.unsensed_doors`; `plan.kiosk.idle_still_min`, 0 = off). The Lovelace card and
the phone app receive stills + masks + room states over the existing map bundle - read-only, `map.read`.

Audit: a bake upload and a material / position edit are document edits and audit like any plan version (`plan.publish`
covers the fields; the bake rows audit as `plan.bake`). No HA writes, no device access, no outbound calls.

---

## 8. Slices, estimates, tests

Estimates are build hours at the project's pace (implementer → reviewer → fix round, as CR-006), excluding the owner's
review time. The order is the recommended one (§10).

| Slice | Scope | Hours | Tests (new) |
|---|---|---|---|
| **S0** Schema 2.1 + catalog + resolver | `material_id`, `ceiling`, `north_deg`, `light`, `glazing`, `walk_positions`; validator both sides; catalog `material_id` / `light` / `walkable`; `material-resolve.ts` pure resolver; editor fields (material select per wall / room / object, compass on the calibration card, positions list) | 10-14 | backend `test_plan_geometry_v21.py` (validation, hash covers new fields, old documents open unchanged); node `unit-material-resolve.spec.ts` (defaults by kind, overrides, unknown id → fallback + warning, determinism); contract fixture `sample-v21.json` |
| **S1** Material library + level 3 | manifest + processing script (`scripts/plan3d_assets.py`: download by URL list, resize, pack, write the manifest row - run by a human, never in CI), `MaterialLibrary` loader with the memory cap and variants, box-mapped UVs in the builder, level 3 in `SceneView` (Standard + maps, physical glass), quality chip "ריאליסטי", probe thresholds for level 3, texture budget | 16-22 | node: UV generation determinism, manifest ↔ files, licence allow-list; browser: level-3 graph equality after a round trip, fallback 3→2→1 by the probe, texture cap serves the 256 variants, chunk size unchanged (`unit-three-chunk`); visual baselines level 3 × presets on SwiftShader (new PNGs under `docs/evidence/T089/visual/`) |
| **S2** Sun, sky, time of day, lamps | solar position (hour, date, latitude, north), sky lookup + hemisphere, the slider "שעה ביום" with "עכשיו" default, emissive lamps + colour temperature, lamp assignment to the light pool by distance bucket, door / cover animation | 8-12 | node: solar position against 6 published reference values (NOAA calculator, ±0.5°), sky lookup monotonic, pool assignment deterministic; browser: the slider moves the sun deterministically (same hour → same graph), animation ends in the same state as a cold build (determinism preserved after 350 ms) |
| **S4** Walk-through core | `walk-controller.ts` (pure: state, input → move, collision against `blockingSegments`, door passability, ground function with stairs / tribune / levels), `SceneView.walk` mode (perspective, eye camera, controls off), keyboard + mouse, Esc, the walk bar with the numeric position fields, start points, "stand at camera / room" | 16-20 | node `unit-walk-controller.spec.ts` (slide along a wall, a corner, through an open door, blocked by a closed / stale / locked door and by a window, passage always, low wall, stair rise along the polyline, level switch at the top, extent clamp, determinism of a scripted input sequence); browser: keyboard walk in headless (positions after a scripted sequence equal the node model), Esc returns to the previous preset and camera, `level-select` fires on the stair |
| **S5** Walk UX: touch, minimap, positions, kiosk | virtual joystick + look drag + tap-to-walk (A* on a 0.25 m grid of the level, open doors as edges), pinch FOV, minimap, saved positions + route, idle still + "no frames when idle", pointer-lock opt-in verified on the real Ingress page | 12-16 | browser (mobile project): joystick moves, tap-to-walk reaches the point around a wall, long-press opens the popover; node: A* path through an open door and not through a closed one; kiosk timer → still swap (fake timers) |
| **S3** Bake: lightmap + stills + storage | in-browser raster baker (hemisphere sampling against the description, 64 samples, per level, ≤ 10 s on a desktop for 1,000 parts - measured, else the sample count drops), lightmap atlas per level, per-room blend mask, the stills (3 presets × 4 variants) + masks, `plan_bakes` table + routes + confinement + backup, the "הכן תאורה ותמונות" card for `map.edit`, "bake outdated" note by geometry key | 18-26 | backend `test_plan_bakes.py` (upload / list / delete / permissions / sniffing / caps / confinement / backup round trip / deleted with the floor / geometry key mismatch 409); node: atlas packing deterministic, blend weights from room states; browser: a floor with a bake draws the lightmap at level 3 and the still on the ladder's last rung; the Lovelace card path reads stills + masks |
| **S7** Perf, determinism, release | the R178 gate (level 3, 1,000 objects, 390 px, ≥ 30 fps) in `evidence-plan-studio-6.spec.ts` with the lever table (textures on/off, normal maps, lamp shadow, DPR), kiosk thermal note, CHANGELOG, owner checklist `PLAN_STUDIO_PHASE6_CHECKLIST_HE.md`, task registry, test catalog AT177 / AT178 evidence | 8-10 | the perf spec; the full 3D unit set on desktop + tablet + mobile; a real-phone evidence row left for the owner (NOT_RUN until walked) |
| S8 (optional) | CC0 glTF models for ~20 items, `shape: 'model'`, instancing per model | 12-16 | manifest / licence tests, instancing count, baselines of levels 1-2 unchanged |
| **Total (S0-S7)** | | **88-120 h** | |

Visual regression: as CR-006 1c - pixel baselines drawn and compared on SwiftShader only (`renderer-<project>.json`),
`SW_REQUIRE_VISUAL=1` lanes, ≤ 0.2 % differing pixels at 2/255; level 3 baselines are new files, the level 1-2 baselines
must not change (the strongest guard that the new level is additive). Textures are deterministic on SwiftShader
(no anisotropy, fixed mip selection); a real-GPU comparison is reported, never asserted.

Runner use: the browser suites and the perf gate run on the Ubuntu runner (`run_remote.sh`) per the owner's rule; the
bake timing and the real-phone rows are owner / workstation evidence.

---

## 9. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Phone misses 30 fps at level 3 with 1,000 objects | medium | the lever table of S7 decides the phone configuration as 1c did; the ladder guarantees a usable view; R178 is asserted on the runner's Chrome at 390 px with 4× CPU throttling as a proxy and reported on a real phone by the owner |
| Kiosk tablet heat / context loss on 24/7 | medium | on-demand frames (exists), idle → still, three context losses → reload; documented in the kiosk checklist row |
| Pointer lock refused inside Ingress | high | drag-look default; pointer lock opt-in only (§4.5) |
| The `three` chunk cap | low | no path-tracer, no KTX2, no Draco in S0-S7; `unit-three-chunk` fails the build otherwise |
| Texture baselines differ across GPUs | certain | SwiftShader-only comparison (exists); real GPUs report only |
| Licence contamination (a CC-BY or unknown file slips in) | low | manifest test: every file has a row and an allowed licence; the processing script is the only path in |
| Stale door drawn passable | low | the state layer's staleness is the single source; unit test "stale is closed" |
| Bake takes minutes on a weak admin laptop | medium | sample count adapts to a 10 s budget; the bake is optional; the view is complete without it |
| Schema 2.1 breaks an exported package (T088 later) | low | all fields optional; T088 will version the package on 2.1 |
| Determinism with animations (door leaf mid-swing) | low | animation is view-only; the description carries end states; the determinism spec compares after the animation window |
| Owner expects photoreal furniture from day one | medium | §6.3 and Q10 make it an explicit option with its own hours |

---

## 10. Recommendation

**Build approach C (hybrid) in the order S0 → S4 → S1 → S2 → S7 (release A), then S5 → S3 → S7 (release B), S8 only on
the owner's word.**

Reasons:

1. The acceptance of T089 has two halves - a realistic level and a walk-through - and only a real-time scene can be
   walked. Approach B alone fails R177 outright; approach A alone leaves wall tablets and the phone app with either a hot
   GPU or nothing. The hybrid uses B's pictures exactly where A is weakest, produced by A itself, through storage and
   compositing paths that already exist (CR-027).
2. The walk (S4) is the highest-value, lowest-asset slice: it needs no textures, no licences and no bake - only the
   geometry and the coverage segments that exist today - and it is what an installer uses to check cameras. Building it
   second (after the schema) means the owner can walk his real plans in the first release even if the material work
   slips.
3. Materials + time of day (S1 + S2) give most of the "wow" at a fixed, auditable cost (CC0 textures, a solar formula)
   and keep the deterministic description intact - the same tests that protect levels 1-2 protect level 3.
4. The bake (S3) is the most expensive and the most optional: the view is complete without it, so it goes last, when the
   real phone numbers from release A say whether a lightmap is needed for the look or for the frame budget.
5. The default stays schematic (R178) and every level above it is reversible per browser and per session - no site is
   ever worse off than today.

---

## 11. Owner questions (in Hebrew; numbered, lettered options)

See §12 below - the questions are asked in Hebrew so the owner answers in the chat as usual; the English text above is
the contract they bind.

---

## 12. תקציר בעברית ושאלות לבעלים

### מה מוצע

סטודיו התוכנית 6 מוסיף למפה התלת־ממדית הקיימת **רמת איכות שלישית - "ריאליסטי"** (חומרים אמיתיים על קירות, רצפות,
דלתות וחלונות; שמש ושמיים לפי שעה ביום ותאריך; מנורות שמאירות בצבען; דלתות ותריסים שנפתחים ונסגרים לפי מצב החיישן)
ו**סיור בגובה עין**: הליכה בתוך התוכנית במקלדת, בעכבר ובמגע, עם התנגשות בקירות, מעבר רק בדלתות פתוחות ובמעברים, עלייה
במדרגות בין מפלסים, ונקודות מוצא (דלת כניסה, מרכז חדר, עמדת מצלמה, עמדות שמורות). ברירת המחדל נשארת סכמטית; הרמה
הריאליסטית והסיור הם בחירה לכל דפדפן, עם ירידה אוטומטית ברמה כשהמכשיר חלש (ריאליסטי → מלא → סכמטי → תמונות מוכנות
→ 2D).

### שלוש גישות שנבדקו

- **א. זמן־אמת (three.js עם טקסטורות ותאורה):** עובד בכל אתר מיד, מצבים חיים, מאפשר סיור - אבל כבד יותר לטלפון
  ולטאבלט־קיר.
- **ב. תמונות מוכנות + מסכות לכל חדר (הטכניקה של הרפרנס מפייסבוק):** הכי קל להצגה בכל מכשיר - אבל מבט קבוע בלבד,
  בלי סיור, וכל שינוי בגאומטריה דורש הכנה מחדש. רינדור בשרת (בתוסף) **אינו אפשרי** - אין GPU, ו־Blender בתוך התוסף
  שוקל מאות MB.
- **ג. משולב (מומלץ):** זמן־אמת ברמה 3 לדסקטופ, לטאבלט ולטלפון מתאים ולסיור; אותה תצוגה מייצרת פעם אחת, בדפדפן של
  המנהל, תמונות מוכנות ומסכות (3 מבטים × יום/לילה × כבוי/דולק) למכשירים חלשים, לטאבלט־קיר אחרי זמן המתנה (אפס פריימים
  כשאין שינוי) ולכרטיס הדשבורד ולאפליקציה. אחסון והרכבה - בנתיב תמונות הקומה שכבר קיים.

### נתונים שצריך להוסיף למודל (סכימה 2.1, הכול אופציונלי ותואם לאחור)

חומר לכל קיר / חדר / דלת / עצם (עם ברירות מחדל לפי סוג), תקרה כן/לא לחדר, כיוון צפון של התוכנית, פרטי תאורה למנורות
(צבע, עוצמה, סוג), זיגוג לחלונות, עמדות סיור שמורות. ספריית החומרים: כ־16 סטים ב־CC0 בלבד (ambientCG / Poly Haven),
רשומים במניפסט עם מקור ורישיון, נבדקים אוטומטית.

### פרוסות והערכה

S0 סכימה וספרייה (10-14 ש׳) → S4 ליבת הסיור (16-20) → S1 חומרים ורמה 3 (16-22) → S2 שמש, שמיים, שעה ביום, מנורות
(8-12) → S7 ביצועים ושחרור (8-10) = **שחרור א׳, ~58-78 שעות**. אחר כך S5 מגע, מפה קטנה, עמדות, מצב קיוסק (12-16) →
S3 אפיית תאורה ותמונות מוכנות + אחסון (18-26) → S7 = **שחרור ב׳, ~30-42 שעות**. סה״כ 88-120 שעות. דגמי ריהוט
תלת־ממדיים (S8, 12-16 שעות) רק אם תבחר.

### ההמלצה

גישה ג׳ (משולב), בסדר S0 → S4 → S1 → S2 → S7 ואז S5 → S3. הסיור הוא החלק בעל הערך הגבוה והעלות הנמוכה (אין צורך
בטקסטורות או ברישיונות - רק הגאומטריה ורשימת הקירות שהכיסוי כבר משתמש בה), ולכן הוא שני; חומרים ושעה ביום נותנים את רוב
ה"וואו" במחיר קבוע; האפייה היא היקרה והאופציונלית ביותר, ולכן אחרונה.

### שאלות לבעלים

1. **גישה:** א. משולב (מומלץ) · ב. זמן־אמת בלבד · ג. תמונות מוכנות בלבד (בלי סיור - לא עומד בדרישת הקבלה)
2. **סדר הבנייה:** א. סכימה → סיור → חומרים → שעה ביום (מומלץ) · ב. חומרים ושעה ביום לפני הסיור · ג. הכול בשחרור אחד
3. **גובה העין:** א. 1.65 מ׳ קבוע · ב. הגדרה (1.2-2.0 מ׳; 1.2 = בדיקת נגישות בכיסא גלגלים) (מומלץ)
4. **דלת בלי חיישן בסיור:** א. עבירה (מומלץ) · ב. חסומה · ג. הגדרה למערכת
5. **נעילת סמן (pointer lock) לעכבר:** א. לא - גרירה בלבד (מומלץ; ייתכן שחסום בתוך המסגרת של תשתית המערכת) ·
   ב. כפתור אופציונלי, מושבת היכן שחסום
6. **רישיונות נכסים:** א. CC0 בלבד (מומלץ) · ב. גם CC-BY עם מסך קרדיטים
7. **שעה ביום:** א. מהשעון של האתר, עם מחוון לשינוי (מומלץ) · ב. מחוון בלבד · ג. מהשעון בלבד
8. **אפיית תאורה ותמונות מוכנות (S3):** א. כן, בשחרור ב׳ (מומלץ) · ב. לא עכשיו · ג. רק תמונות מוכנות, בלי מפת תאורה
9. **מצב קיוסק לטאבלט־קיר:** א. אפס פריימים כשאין שינוי + מעבר לתמונה מוכנה אחרי N דקות (מומלץ; N הגדרה) · ב. זמן־אמת
   תמיד
10. **ריהוט ריאליסטי (דגמי glTF ב־CC0 ל־20 הפריטים הבולטים, S8):** א. לא בשלב זה (מומלץ) · ב. כן, בשחרור ב׳
11. **ברירת מחדל:** א. סכמטי לכולם, ריאליסטי לפי בחירת הדפדפן (מומלץ, לפי דרישת הקבלה) · ב. גם אפשרות להגדרת מערכת
    "ריאליסטי כברירת מחדל"
12. **תמונות ההדמיה (mockups) שצורפו** (`docs/design/mockups/plan-studio-6/`): א. הכיוון נכון, המשך · ב. שינויים
    (אנא פרט)

> תזכורת רישומית: T089 תלוי ב־T087 שעדיין רשום BACKLOG בגלל כלל הרישום (תלויות שלו ב־BACKLOG). לפני שהכרטיס עובר
> ל־READY צריך לסגור את T087 דרך הכלל או לרשום חריגה ב־`management/tasks.json`.
