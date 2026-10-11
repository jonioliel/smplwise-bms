# CR-029 / ST7 product port - slice S3: stills, masks, lightmap bake

**Branch:** `pilot/ST7-port-s3-stills` (from `pilot/ST7-port-s0-s4` 0298e10d). **Binds to:** CR-029 sections 3.2-3.4, 5.3, 7,
8 (S3 row), 13.1-13.4 (branch `pilot/studio6-prototype`); ST7_BUILD_PLAN section 3 (stills in the first delivery, lightmap in
the same delivery per the owner); LOOK_SPEC sections 1, 10, 12 (in-memory stills of the prototype become `plan_bakes`). Owner
decisions 2026-10-09/10: hybrid live 3D + pre-rendered stills; stills AND the lightmap in one release; both styles; every
choice changeable in settings; the wall display stays live 3D by default with a setting for stills; schematic default.

## 1. Decision recorded BEFORE building: the stills are rendered in an editor's browser, not in the add-on

Facts checked on this branch:

- The add-on image is `amd64-base-python:3.12-alpine3.22` with `poppler-utils`, `ffmpeg`, `pango` and Pillow / WeasyPrint
  (`smplwise_vms/Dockerfile`). There is no GPU, no headless browser, no OpenGL / EGL / OSMesa and no 3D package.
- Every PNG / SVG plan export the add-on makes today is **2D** and drawn with Pillow from `plan_geometry_render.structure_primitives`
  (`services/plan_geometry_render.py`, `services/exports.py`). Nothing server-side draws the 3D scene.
- Every 3D picture the product already stores (the AI-skin control image, CR-006 2a) is drawn by **the browser**: `renderControlImage`
  in `frontend/src/map/scene-three.ts` (a fresh off-screen `SceneView`, fixed size, pixel ratio 1, fixed palette) and uploaded to
  `POST /floors/{id}/skins/control-image`, keyed by the floor's geometry key.
- CR-029 section 3.2 B2 already records server-side rendering as not feasible for the add-on (Blender / a CPU path tracer would
  add hundreds of MB and minutes per view on a NUC), and a render service on the runner as a refused external dependency.

**Therefore:** stills, room masks and the lightmap are produced by a browser session of a person holding `map.edit` on the floor
(the "editor session"), with the same off-screen render path as the skin control image, and uploaded to the add-on. The add-on
stores, validates, versions, lists, serves, evicts, backs up and queues requests for them; it never renders. "Regenerate" is a
**bake request** (a job row) that any editor session with WebGL picks up - immediately when the requester's own browser can do it
(the normal case), later otherwise (a request made from a phone or by an administrator without a GPU waits for the next editor
session on that floor). The add-on is never blocked: its only CPU work is validating an upload (bounded, see section 4).

Consequences, said plainly:

- A floor gets stills only after an editor has opened it in a browser with WebGL once after the last structural change. Until
  then every consumer falls back to the live view or 2D (section 6); nothing shows a still of an outdated structure as current.
- Pixel output depends on the GPU of the editor's machine. Determinism is guaranteed for the **description**, the camera, the
  size, the palette and the masks (pure functions, node-tested); the pixels are deterministic on one GPU / driver and are
  compared byte-for-byte only on SwiftShader (the CR-006 1c rule). The uploader's renderer string is stored with the row.

## 2. Data model - migration 0075 (`plan_bakes`, `plan_bake_jobs`)

One row per stored file, unique per **slot** `(floor, level, kind, preset, style, band, variant)`:

| kind | level | preset | style | band | variant | file | cap |
|---|---|---|---|---|---|---|---|
| `still` | the level | `iso` / `top` | `light` / `dark` | `day` / `sunset` / `night` | `off` / `on` | WebP, JPEG or PNG | 2 MB, 640-2560 px wide |
| `mask` | the level | the still's preset | `` | `` | `` | JSON (projected room / door / camera outlines) | 256 KB |
| `lightmap` | the level | `` | `` | `` | `` | PNG, RGBA (R = ambient occlusion, G = lamp light), power-of-two 64-2048 | 4 MB |

Each row carries `bake_key` (section 3), `recipe` (the renderer recipe that drew it), `meta_json` (still: renderer string and the
camera; lightmap: the atlas layout), `path / mime / width / height / bytes / sha256 / created_by / created_at`. A new upload into a
slot replaces the old file. `plan_bake_jobs` holds the requests (`requested -> claimed -> done | failed | cancelled`, a 10-minute
claim lease, the slot list asked for). Masks are stored once per (level, preset) because every style / band / variant of that
preset shares the camera and the size.

## 3. Versioning and stale detection

`bake_key = sha256({v: 1, geometry: <skins geometry key>, catalog: <catalog revision>})` - the skins geometry key is the published
structure's `doc_hash` plus the rooms (id, level, outline); `doc_hash` covers the Studio 6 material / light / north fields (S0), so
a material change invalidates a bake on purpose (CR-029 5.2). The catalog revision is added because the stills draw catalog meshes.
A row whose `bake_key` differs from the floor's current key is **stale**: listed (with `stale: true`) for the editor's card, never
in the map bundle's current set, never shown by a consumer, first in line for eviction. An upload made for an outdated key is
refused with 409 `geometry_changed` (the skins rule). The recipe (`still-q2.1`, later `still-q3.1` when the level-3 renderer lands)
is compared by the client: a bake drawn by an older recipe than the client's is offered for regeneration but still shown.

## 4. Server work stays bounded

Upload validation (content sniffing, a full decode with a pixel ceiling, a metadata chunk / segment allow-list - no text, EXIF or
XMP may ride along, the skins rule) runs in the thread pool behind a semaphore of **2** concurrent decodes; a third waits up to 5 s
and is then answered 503 `bake_busy` with `Retry-After` (the client retries twice). The event loop never decodes. Storage caps per
floor and per installation come from the `plan.bakes` setting; over a cap the stale rows go first (oldest first, installation-wide),
and if only current rows remain the upload is refused with 507 `bake_storage_full` - current stills are never evicted silently.

## 5. Routes (RBAC: read = `map.read` on the floor, write = `map.edit` on the floor - the plan-edit permission; every write audited)

| Route | Permission | Audit |
|---|---|---|
| `GET /floors/{id}/bakes` - rows, the current key, stale counts, the expected slots from the settings, the open job, storage use | map.read | - |
| `GET /floors/{id}/bakes/{bake_id}/file` - the file, `ETag` = sha256, `If-None-Match` -> 304 | map.read | - |
| `POST /floors/{id}/bakes` (multipart: kind, level_id, preset, style, band, variant, bake_key, recipe, meta, file) | map.edit | `plan.bake.upload` |
| `POST /floors/{id}/bakes/regenerate` (which levels / styles / bands / presets, lightmap yes / no) - opens or returns the job | map.edit | `plan.bake.regenerate` |
| `POST /floors/{id}/bakes/jobs/{job_id}/claim` and `/finish` | map.edit | `plan.bake.job` |
| `DELETE /floors/{id}/bakes` (all) and `DELETE /floors/{id}/bakes/{bake_id}` | map.edit | `plan.bake.delete` |

The map bundle (`GET /floors/{id}/map`) carries `bakes`: the current key, whether the set is complete, and per level the URLs of the
current stills, masks and lightmap - so a viewer (the 3D element, the wall display, the Lovelace card, the phone app) knows at
mount whether a still exists without a second request. The phone app / Lovelace path is exactly this bundle part plus the file
route; both are read-only `map.read`.

## 6. Consumers and fallbacks

- **Quality ladder** (`map/quality-ladder.ts`, pure): realistic -> lite -> full -> schematic -> **stills** (only when the level has a
  current set) -> 2D. The 3D element reports a failed probe at its lowest live rung with the event `stills-fallback`; the host swaps
  to `sw-plan-stills`, which draws zero WebGL frames. No WebGL at all goes straight to stills (or 2D without them).
- **Wall display** (`plan.view.wall_display`, installation dial from S0, default `live`; a wall browser may pin its own value):
  `stills` shows `sw-plan-stills` on the wall display; `live` keeps the live 3D, and the kiosk idle timer (`kiosk_idle_s`, S5) may
  swap to the still of the current level after the idle time when a current set exists.
- **Time band** of a still: from the site clock (`time.zone`) and the sun elevation at the site (fallback 32.0 / 34.8 as CR-029 5.2):
  above 6 deg day, -4..6 deg sunset, below -4 deg night. The style follows `plan.view.style` (auto = the UI theme).
- **Live state on a still**: a lit room shows the `on` picture clipped to its mask; an open door, presence and cameras are drawn as
  SVG from the same projection. Stale or unknown states never light or open anything (the state layer's rule).
- **Lightmap** (`map/lightmap-bake.ts`, pure, node-tested): per level, a planar floor atlas of ambient occlusion (64 Hammersley
  hemisphere rays against the description's boxes) and lamp light (inverse square, visibility-tested), plus the room index so the
  lamp channel blends per room by the room's lit state at run time. Fallback when absent or stale: the level-3 contact AO (junction
  strips and blobs, LOOK_SPEC section 4) - the view is complete without it. Applying it in `SceneView` level 3 belongs to the S1 / S2
  owner; the interface is `LightmapSet` (section 7).

## 7. Interfaces for the other slices (no edit of SceneView level-3 rendering here)

- `StillRenderer` (`map/still-bake.ts`): `recipe`, `render(desc, slot, camera size) -> { blob, project(p) }`. The S3 adapter
  (`map/still-render-scene.ts`) implements it on today's `SceneView` at level 2 with a frozen per-style palette; when level 3 lands,
  the S1 / S2 owner provides a level-3 renderer with the same interface and a new recipe id (`still-q3.*`), and every bake made by
  the level-2 recipe is offered for regeneration automatically.
- `StillBand` -> scene state: `bandScene(band)` returns `{ night, sun_elevation_deg, hour }`; S2's sun model consumes it.
- `LightmapSet` (`map/lightmap-bake.ts`): the PNG URL, the atlas layout (`surfaces[]`: level, world rectangle, uv rectangle, floor
  height), the channels, `lightmapUv(x, z, surface)` and `roomBlendWeights(states)`. Level 3 multiplies AO into the floor material
  and adds `G x weight(room)` as emissive light; levels 1-2 ignore it (their baselines do not move).
- `sw-plan-3d` gains only `stillsAvailable` and the `stills-fallback` event (no rendering change).

## 8. What S3 delivers (files)

- Backend: migration `0075_plan_bakes.sql` (`plan_bakes`, `plan_bake_jobs`); `services/plan_bakes.py` (slots, bake key, validation
  with the metadata allow-lists and the bounded decoder, store / evict / delete / sweep, describe / bundle part, jobs, the
  `plan.bakes` setting); `routers/plan_bakes.py`; wiring in `main.py`, `body_limit.py` (4 MB + multipart slack),
  `routers/catalog.py` (deleted with the floor), `routers/anchors.py` (bundle `bakes`), `services/backup.py` (table, file column,
  sweep after a restore), `routers/settings.py` (`plan.bakes`); `tests/test_plan_bakes.py`; the four migration-list tests;
  `contracts/API_INVENTORY.md` regenerated (715 routes).
- Frontend: `map/still-bake.ts` (slots, bands, palettes, the still description, the iso camera, masks, the renderer interface,
  bake status), `map/lightmap-bake.ts` (the CPU baker, `LightmapSet`, UVs, room blend), `map/bake-runner.ts` (the job),
  `map/still-render-scene.ts` (the level-2 renderer on SceneView, no SceneView change), `map/sw-plan-stills.ts` (the still view),
  `map/quality-ladder.ts` (ladder + view decision + wall display flag), `api/bakes.ts`, bundle typing in `api/maps.ts` /
  `api/types.ts`, `screens/floor-stills.ts` + wiring in `screens/explore-floor-map.ts` (the still view on the ladder's last rung,
  without WebGL and on a wall display set to stills; the editor tool "הכן תמונות ותאורה" next to the control images),
  `sw-plan-3d.ts` (`stillsAvailable`, `stills-fallback` only), settings rows in `screens/system-diagnostics.ts` (wall display
  live / stills, styles, time bands, size, lightmap, storage caps). Tests: `tests/unit-still-bake.spec.ts` (node),
  `tests/evidence-plan-stills.spec.ts` (dev server: the renderer's camera equals the pure projection, same bytes twice, variants
  differ, no DOM left; the still view composes lit rooms / an open door / presence without a canvas).
- A wall display is marked by opening the map with `?display=wall` (remembered in that browser; `?display=desk` clears it); its
  own live / stills pin is `localStorage sw.plan3d.wall_display` (the UI for it is S5).

## 9. Not in S3 (owner-visible)

- Wall-face lightmaps: v1 bakes the floor surfaces only (walls darken through the level-3 junction strips); the atlas format has
  room for wall faces.
- The `top` / `persp` presets are accepted by the API; the default bake set is `iso` only (one picture per variant keeps a floor
  at about 4 MB). The setting turns `top` on.
- Real-device timing of a bake (workstation / owner evidence, S7); the R178 perf gate (S7); the kiosk idle swap timer itself and
  the wall tablet's own override UI (S5).
- Sunset at level 2 is the day picture under a fixed warm grade (there is no sun model before S2); night is level 2's night mode.
  The level-3 renderer (S1 / S2) brings the real light rig per band; its recipe id makes every q2 bake show as "improved version
  available" to editors.
- No automatic pickup: a pending request is fulfilled when an editor presses "הכן תמונות ותאורה" (the press joins the open
  request). Starting a multi-minute GPU job silently on someone's page was judged wrong; owner question 2 below.
- The wall display (CR-030 `sw-wall`) has no plan pane yet (`layout.map` is computed but not drawn); the stills reach the wall
  tablet through the floor map opened with `?display=wall`. Embedding `sw-plan-stills` in `sw-wall` is S5.

## 10. Contradictions recorded

| # | What disagrees | Decision | Why |
|---|---|---|---|
| S3-1 | CR-029 5.3: variants `day_off / day_on / night_off / night_on`, presets three; owner 2026-10-10: time bands day / sunset / night and both styles | slot = preset x style x band x off / on; default bake = iso only | the owner's answer is binding; one preset keeps a floor near 4 MB |
| S3-2 | CR-029 5.3: `POST` stores with `map.edit`, served by `GET /floors/{id}/bakes/{kind}/{variant}[/{preset}]` | served by `GET /floors/{id}/bakes/{bake_id}/file` | a slot has six dimensions now; the id is unambiguous and the URL carries `?v=<sha16>` for caching |
| S3-3 | CR-029 5.3 size caps 2 MB still / 4 MB lightmap; no mask cap | kept, plus 256 KB per mask, per-floor and installation caps in `plan.bakes` | the owner asked for caps and eviction |
| S3-4 | CR-029 3.1 bakes AO "into one lightmap atlas per floor and level" on all surfaces | floor surfaces only in v1, atlas format ready for more | wall faces need per-instance lightmap UVs in SceneView (S1 owner); the floor is where the darkening reads |

## 11. Test record (2026-10-10 / 11)

| Run | Where | Result |
|---|---|---|
| `tests/test_plan_bakes.py` (14) | workstation + runner | PASS |
| Full backend suite @ 54ec52a5 (2 shards) | runner, under heavy load (3 h) | 6,372 passed, 8 failed: 7 timing tests (ha_sync_1000, lat1 toggle latency, media seek rate limit, nvr m2 45 s, refusal throttle x2, remote auth flood) PASS when re-run alone @ b3c20414 = FLAKY under load; `test_release_check` "migrations contiguous" red = expected on this branch (0073 lives on main 2.4.4; clears at integration) |
| tsc | runner @ b84c799a | ok |
| `unit-still-bake.spec.ts` (15), `evidence-plan-stills.spec.ts` (2, dev server, SwiftShader) | runner | PASS |
| 3D / map / settings specs on the dist preview, 3 projects (unit-plan-3d*, determinism, floor-map-3d, three-chunk, skin-control, levels / presence / skins settings) | runner | PASS after the chunk fix; `evidence-material-dials` 2 failures are pre-existing (same 2 fail on `pilot/ST7-port-s0-s4`) |
| Visual matrix `map-floor`, `settings-diagnostics` (light / dark x 3 projects) | runner | 12 / 12 pixel-stable (levels 1-2 baselines unchanged); artefacts private-evidence/visual-out/pilot-ST7-port-s3-stills-39f21da3 |
| Full dist-preview suite | runner | NOT_RUN to the end (terminated by the session pause; not repeated to save the shared runner) |
| Real GPU / phone / wall tablet bake timing, owner review of the still pictures | - | NOT_RUN |

## 12. Owner answers 2026-10-11 (implemented)

1. Start of a bake: `plan.bakes.bake_trigger` = `manual` (default; the editor presses "הכן תמונות ותאורה" / "Prepare stills and lighting") or
   `auto` ("starts by itself when an editor opens a floor whose stills are missing or outdated" - in that editor's browser, once per
   floor per page, only with WebGL). Settings row "תמונות מוכנות — הפעלה ומבטים" (ידני — בלחיצה / אוטומטי — בפתיחת קומה).
2. Views: `plan.bakes.bake_views` = `iso` (default, "iso view only" / "מבט איזומטרי בלבד") or `iso_top` ("iso and top view" /
   "איזומטרי ומבט מלמעלה"). `presets` is now read-only, derived from it on both sides.
3. Sunset at level 2 = the day picture with the warm grade: accepted for the first release.

Both keys live in the `plan.bakes` installation setting: PATCH /settings (system.configure), audited as `settings.update`, in every
backup through the `settings` table; tests in `test_plan_bakes.py` and `unit-still-bake.spec.ts`.
