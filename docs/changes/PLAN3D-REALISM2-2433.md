# PLAN3D-REALISM2-2433 - realistic 3D, round 2: baked AO, cut caps, fresnel glass, colour grade, studio backdrop dial, materials

Branch `pilot/PLAN3D-REALISM2-2433`, from `pilot/PLAN3D-REALISM-2432` (round 1) with `origin/pilot/PLAN3D-POLISH-2430` merged first
(bde8e5cc7: the expected one-line conflict on the `scene-three.ts` import line, both sides kept, `tsc --noEmit` exit 0). No version
bump. No migration (migration number 0216 was offered and is NOT used: see S5). Scope: `frontend/src/map/`, the 3D settings card
(`frontend/src/screens/system-plan-view.ts`, `plan-view-dials.ts`), `frontend/src/api/plan-view.ts`, `services/plan_view.py` + its test.
New hunks in shared files are marked `PLAN3D-REALISM2-2433`.

Commits: d2d440a26 (degenerate normals fix), ad5215d4c (S1 S3 S4 S6), 8273a2020 (S5), then the evidence / this record.

## Changes

### S1 - baked ambient occlusion (static geometry, level 3)

What: `ao-volume.ts` (pure, three-free) bakes the shown levels' static occluders - walls, lintels, sills, heads, objects, connectors
(the floor lightmap's set from migration 0075's baker `lightmap-bake.ts`, reused: its Hammersley set, oriented-box ray test and cell
grid, now exported; door leaves left out so a door state never changes the bake) - into a coarse **3D volume** (0.2 m texels, RG8):
R = up-hemisphere openness (floors, table tops), G = whole-sphere openness with the level's floor as a slab (walls, cabinet sides:
darker toward the floor and in corners; divided at run time by the flat-wall reference). 24 rays up + 24 mirrored down per texel,
reach 1.1 m; texels inside an occluder are dilated from their open neighbours. A volume (not the 0075 floor lightmap / an aoMap)
because the library materials already use their `aoMap` slot and UV0 for the CC0 packed AO, the walls and furniture are merged /
instanced (no lightmap UVs), and one volume shades floors, walls and furniture with one texture fetch per fragment. The 0075 floor
lightmap (stills) is untouched.

- Run time: `ao-cache.ts` - IndexedDB `sw-plan3d-ao` keyed by `aoVolumeKey` (FNV-1a over the recipe and the occluders' numbers),
  else a module Worker (`ao-volume.worker.ts`), else the same bake on the main thread in z-slices. Newest 12 volumes kept; every
  store access guarded (private window / blocked storage costs only the cache).
- Shading: `ao-shading.injectBakedAo` patches every opaque library material (`onBeforeCompile`, one shared uniform set per view):
  the fragment is lifted 0.12 m along its normal, R/G blended by the normal's up component, `pow(a, 1.5)`, applied to the indirect
  diffuse, 80 % to the indirect specular and 70 % to the direct diffuse (the contact a cutaway render shows). Strength 0 / the
  one-texel placeholder draws exactly the unpatched material.
- SSAO reduced: while the bake is on, GTAO (realistic rung) runs 4 samples instead of 6 at 0.6 of the style's blend
  (`PostChain.setBakedAo`).
- Determinism: same description -> same bytes (unit test); `realPending` counts a bake in flight, so every capture that waits for
  `realPending == 0` (all visual specs) has it.

Before / after: `evidence/PLAN3D-REALISM2-2433/before/` vs `after/` (01-05, 09); the in-page on/off pairs were checked during tuning
(the dense floor: darker room corners, floor contact under the sofas, desks and night stands, wall bases).

Cost (`ab-ao.md`, in-page A/B, 9 interleaved pairs of `benchFrames(15)`, median; AO on = bake + GTAO 4 / 0.6, off = GTAO 6 / full):

| Scene | Rung | AO off ms | AO on ms | Cost | Calls | Volume | First bake (worker) |
|---|---|---|---|---|---|---|---|
| look-dev house L0 | realistic | 57.83 | 58.17 | +0.3 | 288 / 288 | 61x14x55, 94 KB | 2.0 s |
| look-dev house L0 | lite | 34.21 | 33.18 | -1.0 (noise) | 160 / 160 | same | same |
| dense floor (perf house, 12 rooms) | realistic | 61.55 | 63.50 | +2.0 | 208 / 208 | 96x15x69, 199 KB | 2.8 s |
| dense floor | lite | 32.99 | 33.67 | +0.7 | 98 / 98 | same | same |

No extra draw call. The first view of a floor bakes 2-3 s in the worker (the materials draw without it until it lands; a repeat
visit reads IndexedDB). Node bake of the house in the unit test: ~3 s on the loaded machine.

Fallback: levels 1-2 never patch a material (RealMaterials is level-3 only); no Worker -> in-thread slices; a failed bake logs and
draws without; outside the volume (the ground, the sky) the factor is 1.

### S2 - wall cut caps

Already present (round 0 / round 1, `scene-real.ts` section caps: each wall footprint at the cut height of the top level in the style's
poché, the dark style with the cyan edge line). Verified in every after shot (dark caps on the cut walls, iso and persp). Not changed.

### S3 - window glass (both rungs)

What: one translucent standard glass on both rungs (`injectGlassFresnel`): alpha rises with a power-4 view-angle term (+0.55 at grazing)
and with the luminance the environment reflects (x0.9, cap 0.88); roughness 0.04, env intensity per style. The realistic rung's
`MeshPhysicalMaterial` transmission is gone - it re-rendered the opaque scene into a transmission target every frame.

Perf (per-shot table below): realistic house iso 406 -> 288 calls, 55,748 -> 38,096 triangles, ~69 -> ~48 ms; dense 265 -> 184 calls.
Lite unchanged (it already had the cheap glass). Fallback: the frosted glass keeps its plain translucent look.

### S4 - colour grade

What: `color-grade.ts` - lift / gamma / gain + saturation per style, a day and a night grade mixed by the sun recipe's night factor
(day: shadows a touch cool, highlights a touch warm, sat +4 %; night: blue-teal lift, warm gain for the lamp-lit rooms, sat +6..8 %),
appended to the post chain's existing `OutputPass` after the Neutral tone mapping and the sRGB transfer (`gradeOutput`): no pass, no
target. Under 3 % per channel at mid grey (unit test). Tone mapping stays Neutral (round 1's comparison; the grade does not change
the verdict - it is a nudge on top). Cost: inside the noise of the per-shot table (one full-screen pass already existed).

### S5 - studio backdrop as a stored dial

What: `plan.view` gains `backdrop: 'sky' | 'studio'`, default `sky` (look unchanged until the owner decides). Installation value and a
personal override (added to `USER_DIALS` / `PERSONAL_DIALS`), validated like every dial (`services/plan_view.py`, `api/plan-view.ts`).
Settings card row "רקע מאחורי הבית" with "שמיים" / "סטודיו כהה" right after the style, Hebrew hint. `sw-plan-3d`: the dial decides,
the element property `backdrop` is now the host's override (null = the dial), `data-backdrop` reflects the one in force.
**No migration**: `plan.view` is one JSON settings value and the override one JSON row (table from 0074), so 0216 is not needed.
An older server without the key reads as `sky`.

### S6 - material quality pass

Finding: with the CC0 files loaded, the library `roughness` was replaced by the packed file's own (`m.roughness = 1` x map), and the
files run much glossier than the library (measured G means: oak ~0.42 for 0.85, wall tiles ~0.17 for 0.35, plaster ~0.79 for 1.0).
Change: each packed file's mean is measured once (16 x 16 reduction on decode) and the material factor moves it toward the library
value within 0.75..1.5 (the full factor flattened the softbox highlights on the floors; the clamp keeps a lacquered sheen on wood and
tiles and brings fabric / plaster to matte). Texture anisotropy 4 -> 8 (the iso views see the floors at a grazing angle). Normal
scales left as they are: at iso distance with mipmaps they read as grain, no shimmer in the shots.

### Also fixed: blank perspective view (pre-existing)

`mesh-utils.creaseNormals` gave zero-area triangles a zero normal; the kit's `bookcaseOpen.glb` then made the lighting NaN and the bloom
spread it over the frame - the realistic perspective view of the look-dev house drew only the backdrop when entered right after a
build (reproduced on the merged base before any change of this branch; found by hiding meshes one at a time). Degenerate triangles
now get (0, 1, 0); the AO shader also returns 1 for a zero normal.

## Performance (Intel UHD Graphics 0x9B41, ANGLE D3D11, 1280 x 800, headless Chromium with the GPU, `benchFrames(30)` median of 3)

The workstation was shared with other agents (CPU near 100 %); absolute numbers swing. Headed Chromium could not be spawned this session
(`spawn UNKNOWN` on chrome.exe; the headless shell ran on the real GPU - the renderer string is in each `perf.md`).

| Shot | Rung | Before ms | After ms | Calls before / after | Triangles before / after |
|---|---|---|---|---|---|
| 09 dense floor iso day | realistic | 67.6 | 44.9 | 265 / 184 | 64,676 / 43,432 |
| 01 house iso day | realistic | 69.2 | 48.3 | 406 / 288 | 55,748 / 38,096 |
| 02 house iso night | realistic | 71.6 | 49.5 | 406 / 288 | 55,748 / 38,096 |
| 03 house persp day | realistic | 76.3 | 52.2 | 406 / 288 | 55,748 / 38,096 |
| 04 house persp night | realistic | 69.7 | 47.1 | 406 / 288 | 55,748 / 38,096 |
| 05 both levels iso day | realistic | 84.1 | 47.4 | 686 / 482 | 99,184 / 67,892 |
| 10 studio iso day | realistic | 67.1 | 64.7 | 406 / 288 | 55,748 / 38,096 |
| 11 studio iso night | realistic | 68.7 | 46.4 | 406 / 288 | 55,748 / 38,096 |
| 06 house iso night | lite | 30.3 | 36.3 | 160 / 160 | 19,172 / 19,172 |
| 07 house iso day | lite | 32.3 | 34.1 | 160 / 160 | 19,172 / 19,172 |
| 00 demo | schematic | 9.1 | 9.6 | - | - |
| 08 house | schematic | 7.6 | 8.4 | - | - |

The realistic rung's ~30 % gain is the dropped transmission pass (S3); the lite rows move within the machine noise (the A/B above puts
the bake at +0.3..2 ms). The weak-device ladder (`quality-ladder.ts`) is untouched; levels 1-2 draw no new code.

## Evidence (`evidence/PLAN3D-REALISM2-2433/`)

`before/` and `after/` (same harness, same machine): 00 demo schematic, 01 iso day, 02 iso night, 03 persp day, 04 persp night, 05 both
levels, 06 / 07 lite night / day, 08 schematic fallback, 09 dense floor, 10 / 11 studio backdrop day / night; `perf.md` each;
`ab-ao.md`. Harness: `harness/shots.spec.ts`, `ab.spec.ts`, `probe.spec.ts` (look-dev on/off probe), `dense.ts` (the perf spec's
generated house as a description) - they import the worktree by absolute path, not product specs.

## Tests

| Command (from `frontend/` unless noted) | Exit | Result |
|---|---|---|
| `npx tsc --noEmit -p .` after the merge | 0 | clean |
| `npx tsc --noEmit -p .` after the last source change | 0 | clean |
| `SW_BASE_URL=http://127.0.0.1:4433/ npx playwright test tests/unit-plan3d-ao-volume.spec.ts --project=desktop` (first run) | 1 | 6 passed, 1 failed: my test expected `{1,1}` above the ceiling, the sample is outside the volume (null) - test fixed |
| `SW_BASE_URL=http://127.0.0.1:4433/ npx playwright test tests/unit-plan3d-ao-volume.spec.ts tests/unit-studio6-ui.spec.ts tests/unit-plan3d-room-glow.spec.ts tests/unit-plan3d-sun.spec.ts tests/unit-plan3d-assets.spec.ts tests/unit-plan3d-real.spec.ts tests/unit-plan-3d-realistic.spec.ts tests/unit-plan-3d-look-r3.spec.ts tests/unit-plan-3d-quality.spec.ts tests/unit-plan-3d-state.spec.ts tests/unit-plan-3d.spec.ts tests/unit-plan-3d-pixel-ratio.spec.ts tests/unit-lightmap-bake.spec.ts --project=desktop --workers=2` (Vite dev server on 4433) | 0 | 66 passed, 3 skipped (the existing dev-server / mobile-only skips) |
| `python scripts/gate/lint_spec_waits.py frontend/tests/unit-plan3d-ao-volume.spec.ts` (repo root) | 0 | 0 findings |
| `python -m pytest -p no:cacheprovider tests/test_plan_view_settings.py` (`smplwise_vms/backend`, the main checkout's `.venv`) | 0 | 37 passed |
| Evidence harness `shots.spec.ts` before / after, `ab.spec.ts` | 0 | 1 passed each |

New unit tests (`unit-plan3d-ao-volume.spec.ts`): occluder input, cache key (stable, door-independent, geometry-dependent), plan / cap,
determinism (bytes), what darkens (cabinet contact, corner, wall base, wall core dilated, flat-wall reference), the look-dev house
bake, the grade numbers, degenerate normals. Backend: `backdrop` accepted / refused / default.

NOT_RUN: the full unit / evidence / pixel / layout suites (by instruction); `evidence-st7-ui.spec.ts` / `layout-st7-ui.spec.ts`
(the settings card gained one row - their mock now carries `backdrop`); mobile / tablet projects; the runner gate.

## Pixel baselines to refresh (not updated here)

Every level-3 baseline changes (baked AO, fresnel glass on the realistic rung, the grade, the roughness pass, anisotropy):
`frontend/tests/evidence-replay-3d.spec.ts-snapshots/` - `event-l3-lite-{desktop,mobile,tablet}-linux.png`,
`history-l3-lite-day-*`, `history-l3-lite-night-*`, `history-l3-realistic-day-*` (12 files). Any settings-card picture of the
realistic-view card (one new row). Levels 1-2 baselines do not change. Stills baked after this change look like the new level 3.

## Baselines refreshed on the runner

Linux runner (SwiftShader, the gate's renderer), desktop / tablet / mobile, workers=1, commit `fc3a39307`:

- `run_smart.py preview pilot/PLAN3D-REALISM2-2433 tests/evidence-replay-3d.spec.ts tests/pixel-walk-touch.spec.ts
  tests/visual-matrix.spec.ts -u --workers=1 --machine runner`: 108 passed, 12 skipped; the 12 level-3 pictures of
  `frontend/tests/evidence-replay-3d.spec.ts-snapshots/` rewritten (`event-l3-lite-*`, `history-l3-lite-day-*`,
  `history-l3-lite-night-*`, `history-l3-realistic-day-*`, x 3 projects). `pixel-walk-touch` and `visual-matrix` did not change.
- `unit-plan-3d-determinism.spec.ts` with `SW_UPDATE_VISUAL=1`: the 42 pictures of `docs/evidence/T087/visual/` rewritten.
  They are byte-identical to the ones re-taken on `pilot/PLAN3D-POLISH-2430` (`abfbd6e63`): levels 1-2 change only through
  the merged polish (framing, room names as DOM plates), not through this round.
- Looked at, pair by pair: the look (AO, glass, grade, roughness) and the polish framing; no missing geometry or material.
- Not committed: the `evidence-st7-ui.spec.ts` pictures (`docs/design/evidence/st7-ui/`). They are evidence and not compared
  baselines, and the re-shot differs from the stored set mostly by unrelated app changes since it was taken (layout, the
  side rail, the editor pages). The crop does not reach the new backdrop row either. Re-shoot them deliberately if the
  card needs a picture.
- Before / after copies (gitignored): `private-evidence/baselines-3d/REALISM2-2433/{before,after}/<file>.png`; in git the
  before is `956f7b700:<path>`, the after is the same path at `fc3a39307`.
- Proof without `-u` on `fc3a39307`: the same preview run 108 passed, 12 skipped, 0 failed; `unit-plan-3d-determinism`
  with `SW_REQUIRE_VISUAL=1` 12 passed.

## Entry check 2f43ae087 (RED) and the owner's answers of 2026-11-11

Entry check `entry_pilot-PLAN3D-REALISM2-2433_2f43ae087.md` on the runner: 4 failures outside the quarantine, plus the expired
`pixel-wiskey-stations.spec.ts:87` quarantine (ticket WKWATER-POLISH-2331-pixel, fixed on main by another branch; not touched here).

- `evidence-plan-studio-6.spec.ts:520` [desktop] [mobile], "the lever table switches": it counted `MeshPhysicalMaterial` objects
  on the realistic rung and expected more than 0. S3 above removed the transmission glass on purpose (one translucent glass with a
  fresnel edge on both rungs), and the owner approved that glass on 2026-11-11. The test pinned the old behaviour: it now asserts
  no physical glass on either rung and fresnel glass (`userData.swGlass`) on both. Commit 7e807aa92.
- `unit-plan-3d-view.spec.ts:201` [mobile], "a click goes through a translucent upper plate": reproduced locally. The floor point
  `[1.2, 0, 4.4]` is 0.6 m from the lobby's south wall. Since the live framing (PLAN3D-POLISH-2430, merged into this branch) the
  top camera stands over the free part of the stage rather than over the plan's middle; on the narrow mobile stage the 3 m wall
  then leans over that point, so the click hit the wall `dw0`, which is also what the picture shows there (a probe screenshot put
  the point on the wall line). The product is right; the test now clicks an open bit of the lobby floor (`[2.55, 0, 2.85]`, about
  1.9 m from every wall, between the chairs and 0.6 m from the lamp) and checks that it projects. Desktop / tablet / mobile pass
  locally. Commit 7e807aa92.
- `pixel-wall-plan.spec.ts:54` [desktop], "the live schematic view in the map band, dark wall": 8748 px differ. The actual picture
  carries the room name plates and the polish framing - both from PLAN3D-POLISH-2430 (room names approved: top floor only, which
  this one-floor plan is). A legitimate change: the baseline was re-taken on the runner (see below).

Owner answers applied:

- Night lighting, the presence edge, contact shadows, the fresnel glass, the warmer night / cooler shadow grade and the less glossy
  floors: approved as built, nothing changed.
- Backdrop: `sky` stays the default at install (`plan_view.DEFAULT`, `DEFAULT_VIEW`, `DEFAULT_REAL`, the element's fallback all say
  `sky`, unchanged); the display setting switches it.
- Auto quality on an unknown GPU stays `full`; room names on the top floor only; the 52 px floor-button strip stays. No change.
- Furniture merging: after this branch is merged, not here.
- Floors: a new floor-finish dial, below.

### Floor finish (owner 2026-11-11: marble or luxury ceramic)

What: the installation dial `floor_finish` - `wood` / `marble` / `ceramic`, default **marble** - in the 3D settings card next to the
textures ("ריצוף": פרקט עץ / שיש / קרמיקה יוקרתית). An installation dial (content, like `furniture` / `textures`), not a personal
one. No migration (`plan.view` is one JSON value); an older stored value without the key reads the default.

Which floors: `scene-real-builder.takesFinish` - a room floor whose material the document does not set (no own `floor_material_id`
on the room or on its level) and whose tags pick no special floor in the resolver's rules (wet rooms, parking, garden, office,
sports keep theirs). That is the floors that drew the residential oak or the level's bare concrete. A floor set in Plan Studio
keeps its pick. The description keeps the resolved material and adds `finish: true` (older readers and `wood` draw it as before).

How (`map/floor-finish.ts`): two generated, tileable colour maps from a seeded periodic value noise, a pure function of the finish
(same bytes every run): marble 512 px over 2.4 m (2 x 2 slabs, soft clouding, two thin vein families, 1 px slab joints), ceramic
256 px over 1.2 m (2 x 2 large-format 0.6 m tiles, 2 px joints, a slight per-tile tone and a fine speckle). One mip-mapped
`DataTexture` per finish, 8x anisotropy, no normal map, no extra pass: the floor stays one merged draw per level and material.
GPU memory: 1.4 MB (marble) / 0.35 MB (ceramic) with the mips. Generation: once per session, measured 155-470 ms (marble) and
60-150 ms (ceramic) on the workstation (a loaded weak PC; the low-frequency marble fields are sampled from a 128 x 128 grid).
`wood` draws the library oak files. The geometric texture source (`textures: procedural`) draws the finish as its plain tint.
Roughness 0.32 (marble, honed) / 0.40 (ceramic), times the style's floor sheen - in line with the approved less glossy floors.

Evidence: `evidence/PLAN3D-REALISM2-2433/floors/{marble,ceramic,wood}-{iso,persp}-day.png` - the look-dev house with its dry rooms
(living, study, entrance, corridors, gallery) left to the finish, headless Chromium 1280 x 800 (`harness/floors.spec.ts`).
Frame cost in the same run (`floors/perf.md`, median of 3 x 30 frames, a software renderer): 70.9-75.6 ms for all three finishes,
equal within noise.

Known limits: the Plan Studio material picker still shows the resolver's default (concrete / oak) for a room left to the finish;
picking marble or ceramic per room is not offered (the finish is per installation). The marble map is generated on the main
thread (a one-off hitch of a few hundred ms on a slow device at the first realistic build).

Tests: `frontend/tests/unit-plan3d-floor-finish.spec.ts` (5: the dial lists and defaults, which floors, the drawn material per
finish, the maps per texture source and style, determinism / opacity / seamless repeat / bounded time - passed locally, desktop
project), `smplwise_vms/backend/tests/test_plan_view_settings.py` (defaults, accept / refuse, site-only; not run locally - no
backend deps on the workstation; the entry check runs it).

Runner, `2f98a1fc7`, `run_smart.py preview` (desktop / tablet / mobile, workers 2, during a release gate): `unit-plan-3d-view`,
`evidence-plan-studio-6`, `unit-plan3d-floor-finish`, `unit-studio6-ui`, `unit-plan3d-real`, `evidence-replay-3d`,
`pixel-walk-touch`, `visual-matrix` - 180 passed, 21 skipped, 6 failed. The 6 failures are the 12 level-3 pictures of
`evidence-replay-3d.spec.ts-snapshots/` (`event-l3-lite-*`, `history-l3-lite-day-*`, `history-l3-lite-night-*`,
`history-l3-realistic-day-*`): their history fixture's rooms set no floor, so they now draw the default marble - the intended
change. Re-taken with `-u --workers=1` on the runner and looked at (marble floors, nothing else moved); committed.
`pixel-wall-plan.spec.ts` [desktop] is a schematic (level 1) view: the floor finish does not reach it.

## Observed, not changed

- Studio backdrop, day, both before and after: a few bright lamp discs float over the plan near ceiling height after the both-levels
  view (`10-house-studio-iso-day.png`); not seen in the sky backdrop shots. Round-1 / polish territory - worth a look.
- Headed Chromium cannot be spawned on this workstation at the moment (`spawn UNKNOWN`); the headless shell was used.

## Owner questions (Hebrew)

1. הצללה אפופה (פינות כהות יותר, מגע של רהיטים ברצפה) - העוצמה בצילומים:
   א. מתאים. ב. חזק יותר. ג. עדין יותר.
2. זכוכית החלונות: במבט ריאליסטי ויתרנו על "שקיפות פיזיקלית" לטובת זכוכית עם השתקפות בקצוות - מהיר בכשליש. מתאים?
   א. כן. ב. להחזיר את הזכוכית הקודמת במבט הריאליסטי (איטי יותר).
3. "רקע מאחורי הבית" נמצא עכשיו בהגדרות התצוגה (שמיים / סטודיו כהה), ברירת המחדל שמיים. מה ברירת המחדל להתקנה?
   א. להשאיר שמיים. ב. סטודיו כהה. ג. סטודיו רק בסגנון הכהה.
4. גוון הצבע (חם יותר בלילה, קריר מעט בצללים):
   א. מתאים. ב. חזק יותר. ג. לבטל.
5. רצפות עץ ואריחים מבריקים פחות מבעבר (קרוב יותר לחומר האמיתי):
   א. מתאים. ב. להחזיר את הברק. ג. מט לגמרי.
