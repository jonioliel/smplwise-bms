# PLAN3D-LEVEL3-2435 - realistic 3D, round 3: floor reflections, polished marble / ceramic, soft contact shadows, refined families

Branch `pilot/PLAN3D-LEVEL3-2435`, from `origin/pilot/PLAN3D-FURNMERGE-2434` at 3303d5376 (REALISM2 + FURNMERGE: baked AO, glass,
grade, studio backdrop, floor finish, furniture merging, zoom buttons). No version bump, no migration (`plan.view` is one JSON
value; an older stored value without the new key reads the default). Owner goal: "raise the 3D map to a much higher level",
marble or luxury ceramic floors preferred. New hunks in shared files are marked `PLAN3D-LEVEL3-2435`. Reference used where it
fits: the lead's look-dev `private/design-system-2026-10-27/round30/map3d-lookdev/` (book-matched marble, 1.2 m porcelain);
its room-state overlay and the wall cut height were NOT taken (out of scope; the cut height stays as it is).

Commits: 74c1daaf6 (feature), 4b5bb297c (test: sky dome), a796420a1 (book-matched marble, 1.2 m porcelain), then the baselines
and this record.

## 1. Floor reflections (realistic rung only) - new dial `floor_reflections`

What: a screen-space reflection limited to the reflective floors (`map/floor-reflect.ts`, `post-chain.SsrPass`). The floor
materials (variant `floor`) write their reflectivity into the beauty pass's alpha as `1 - 0.25 k` - only while the post chain
renders (`REFLECT_ON`), so a thumbnail, a still bake, level 2 or the lite rung never sees a floor with alpha below 1. Opaque
materials draw without blending, so the code arrives intact; the SSR pass (after GTAO, before bloom) puts alpha back to 1 and,
where GTAO's normal buffer says the surface faces up, marches the reflected ray through GTAO's depth (20 steps + 4-step
refinement, 0.35 m thickness, 4 m reach, fade at the screen edge / the far end, a Schlick-like angle term, 3-tap softening).
No extra scene render and no extra target: it reads the depth / normals GTAO already draws.

Reflectivity (`FLOOR_REFLECT`): marble 1, ceramic 0.8, white / grey tiles 0.4 / 0.35, sports floor 0.3, oak 0.22; concrete,
carpet and every other id 0. Strength 0.7 (light) / 0.75 (dark).

Dial: `plan.view.floor_reflections`, boolean, default **on**, a personal flag (a display / performance choice) - frontend
`api/plan-view.ts`, `screens/plan-view-dials.ts`, the 3D settings card row "השתקפויות ברצפה" with a hint, backend
`services/plan_view.py` (FLAGS, DEFAULT, USER_DIALS). Off = the pass is disabled, the materials keep alpha 1 (exactly round 2).
The lite rung has no GTAO and draws no SSR (its cost does not change).

Cost (in-page A/B, `after/ab-reflections.md`, 9 interleaved pairs of `benchFrames(15)`, median, Intel UHD 0x9B41, 1280 x 800):

| Scene | off ms | on ms | cost |
|---|---|---|---|
| house ground floor, iso | 59.5 | 65.8 | +6.3 |
| house dining close-up (marble fills the frame) | 81.8 | 100.2 | +18.4 |
| dense floor (12 rooms), iso | 60.9 | 65.7 | +4.8 |

The cost follows the reflective floor area on screen; a close-up on a weak GPU pays most. That is why it is a dial and why it
lives on the realistic rung only; the quality ladder (auto) still drops to lite when the frame rate falls. Not changed:
GPU-loss handling - the pass is part of the post chain, which `onRestored` rebuilds (and `ensurePost` re-applies the dial).

## 2. Floor materials - polished marble and large-format porcelain

- Marble (`floor-finish.ts`): Carrara-like veining - a main vein family whose strength comes and goes along the slab (a sharp
  core in a feathered halo), a thinner cross family, a soft cloud and a fine grain; the second slab of each row book-matched
  (mirrored). Round 2's veins were one even-width dark line everywhere and read as contour lines at a close view.
- Ceramic: 2 x 2 large-format 1.2 m tiles over 2.4 m (512 px, was 0.6 m tiles at 256 px), limestone tone, 1 px rectified joint.
- New generated surface per finish (`finishSurfacePixels`): a packed map (R = AO, a little less in the joint; G = roughness) and
  a joint normal map (a 1 px groove with a bevel either side). Polished body ~0.17 (marble, duller veins) / ~0.26 (porcelain,
  satin), joints 0.75 / 0.85, times the style's floor sheen as before.
- The finishes' sky environment reflection 0.7 -> 0.35: the outdoor sky the IBL is prefiltered from laid a white sheen over the
  polished indoor floors in the iso views; the SSR brings the room's own reflections instead.
- Memory: marble 1.4 MB -> 4.2 MB, ceramic 0.35 MB -> 4.2 MB of GPU memory with the mips (colour + surface + normal, 512 px each);
  one draw per level and material as before.

## 3. Contact shadows and sun shadows

- Found and fixed: on the realistic rung every contact blob drew a flat grey RECTANGLE (the size of the object's footprint x 1.3)
  - the "rug shadow" rectangles of the round-2 close-ups. The blob was a zero-height `BoxGeometry`; in GTAO's normal pass its
  downward face (drawn after the upward one at the same depth) wrote a down normal, and the occlusion filled the rectangle.
  The blobs and the junction strips are now `skipAO` decals, and `SkipAoPass` shows again only what it hid (it used to show
  every marked mesh after each frame - the walk's sky dome over the CSS sky in the orbit views included; the dome is now
  hidden there as `applyBackdrop` intended).
- The contact blob is one upward plate per object, shaded in the shader as a soft shadow of the object's rounded footprint
  (`contactBlob`, `CONTACT_GLSL`): full under the outline, falling as (1 - d / margin)^2 over a margin that grows with height
  (4 cm for a rug, ~16 cm for a sofa or a cabinet), a disc under a cylinder; lifted to 2.4 cm when the object stands on a
  rug (it was hidden under it). Alpha 0.46 / 0.52 -> 0.68 / 0.74 (light / dark).
- Sun: the realistic rung's PCF radius is now a penumbra in metres (~7 cm, `shadowPenumbraTexels`, within 2 .. the style's 8
  texels) - it was 8 texels of whatever the extent gave (~9 cm on a house, ~25 cm on a large hall).
- Draw calls / triangles: -4 calls and -1.8 k triangles per floor (the blobs are 2 triangles instead of 12, the decals left
  GTAO's normal pass).

## 4. Furniture silhouettes (procedural families, still merged per material)

- Sofa / armchair: the frame sits back from the seat front, rolled arms a little above the seat, plump gapped seat and back
  cushions, two linen scatter cushions on a sofa wider than 1.3 m.
- Dining / meeting / picnic table: an apron under the top.
- Bed families: two pillows and a turned-down duvet edge on a bed wider than 1.2 m.
- The default furniture source is `models` (the Kenney kit, owner-approved): there the sofa, dining table and kitchen run are kit
  models and do not change; the families show for the armchair, the meeting / side / round tables, the beds, the cabinets and
  everything in the `procedural` source. The catalog has no residential bed (only `bed.exam` / `bed.hospital`) - owner question 3.

## 5. Time-of-day sun

Already present: the realistic sun follows the site clock (`time_source: clock`, the default) or the manual slider - solar
position, colour, sky and IBL per instant (CR-029 S2). Nothing added.

## Performance (same harness as FURNMERGE `perf.md`, Intel UHD Graphics 0x9B41, ANGLE D3D11, headless Chromium on the GPU)

Before = `evidence/PLAN3D-FURNMERGE-2434/after/perf.md` (the base commit, same harness and machine), after =
`evidence/PLAN3D-LEVEL3-2435/after/perf.md`. The workstation is shared with other agents: frame times swing by 20-40 ms between
runs, so the in-page A/B above is the cost measure; calls and triangles are exact.

| Floor | Rung | Calls before / after | Triangles before / after | ms before / after (noisy) |
|---|---|---|---|---|
| dense floor, iso | realistic | 172 / 170 | 43,432 / 40,833 | 107.3 / 59.4 |
| dense, both floors, iso | realistic | 316 / 314 | 85,584 / 81,345 | 99.7 / 61.3 |
| house ground floor, iso | realistic | 186 / 182 | 38,096 / 36,293 | 106.1 / 63.8 |
| house both floors, iso | realistic | 304 / 298 | 67,892 / 66,089 | 94.7 / 60.9 |
| house both floors, persp | realistic | 304 / 298 | 67,892 / 66,089 | 111.1 / 63.2 |
| dense floor, iso | lite | 92 / 92 | 21,312 / 20,712 | 51.5 / 31.2 |
| house ground floor, iso | lite | 109 / 109 | 19,172 / 18,892 | 59.1 / 32.5 |
| house both floors, iso | lite | 176 / 176 | 34,472 / 34,324 | 66.7 / 33.0 |

The lite rung (weak devices) gains no new pass; its only new cost is two more texture fetches on the finish floors.

## Evidence (`evidence/PLAN3D-LEVEL3-2435/`)

`before/` (the base commit) and `after/` (this branch), the same harness `harness/looks.spec.ts`: the look-dev house with its dry
rooms left to the finish - marble / ceramic iso, perspective and living-room close-up by day, the kitchen close-up, the living
room and the iso by night, the lite rung's set; `looks.md` each (calls / triangles / ms per shot). `after/ab-reflections.md`
(`harness/ab.spec.ts`), `after/perf.md` (`harness/perf.spec.ts`, the FURNMERGE harness). `harness/probe.spec.ts` is the tuning probe.

## Tests

| Command (from `frontend/` unless noted) | Exit | Result |
|---|---|---|
| `npx tsc --noEmit -p .` | 0 | clean |
| `npx playwright test -c playwright.unit.config.ts tests/unit-plan3d-level3.spec.ts` (+ `unit-plan3d-sun`) | 0 | 16 passed |
| the same config, `unit-plan3d-floor-finish`, `unit-plan3d-furnmerge`, `unit-plan3d-real`, `unit-plan3d-ao-volume`, one file per run | 0 | 5 / 4 / 4 / 8 passed |
| `SW_BASE_URL=http://127.0.0.1:4435/ npx playwright test <11 3D page specs> --project=desktop --workers=2` (Vite dev server) | 1 | 59 passed, 4 skipped, 3 failed: two timeouts (the dev server reloaded the page while I edited sources), `unit-plan-3d-odd` expected the sky dome visible (see 3; test updated) |
| rerun `unit-plan-3d-odd`, `unit-plan-3d-look-r3`, `evidence-plan-3d-dpr-cap` (desktop, workers 1) | 0 | 14 passed, 4 skipped |
| `python -m pytest tests/test_plan_view_settings.py` (`smplwise_vms/backend`, the main checkout's `.venv`) | 0 | 47 passed |

Seen, not mine: running `unit-plan3d-floor-finish`, `-furnmerge`, `-real`, `-ao-volume` together in one Node worker fails at load
(`createTreeWalker is not a function` - one spec's `document` stub meets lit in another); the same on the base worktree.

New tests (`unit-plan3d-level3.spec.ts`): the dial (default, personal, flag, card, hint), the reflectivity table and the alpha code
round trip (8-bit), the floor patch on floor materials only, the generated surface (polished body, matte joint, flat normals off
the joints, determinism), the contact blob (shape numbers, skipAO, one upward plate, the instance attribute), the refined families,
the penumbra helper. Updated: the pass list (`'ssr'` after `'gtao'`) in four specs, the floor-finish map expectations, the tiling
reference (quarter lines: the book-matched middle is a mirror line), the sky dome in `unit-plan-3d-odd`.

## Baselines refreshed on the runner (Linux, SwiftShader - the gate's renderer; desktop / tablet / mobile, workers 1)

| Commit | Run | Result |
|---|---|---|
| a796420a1 | `run_smart.py preview pilot/PLAN3D-LEVEL3-2435 tests/evidence-replay-3d.spec.ts tests/pixel-wall-plan.spec.ts tests/pixel-walk-touch.spec.ts tests/visual-matrix.spec.ts -u --workers=1 --machine runner` (from this worktree) | 116 passed, 28 skipped; the 12 level-3 pictures of `evidence-replay-3d.spec.ts-snapshots/` rewritten (`event-l3-lite-*`, `history-l3-lite-day-*`, `history-l3-lite-night-*`, `history-l3-realistic-day-*` x 3 projects). Looked at: the new marble, the reflections (realistic), the contact shadows; nothing else moved. Committed 806b2e01a |
| 806b2e01a | proof, no `-u`: the same four + `unit-plan-3d-determinism`, `unit-plan3d-level3`, `unit-plan-3d-odd`, `evidence-plan-studio-6`, `unit-plan-3d-realistic` | **182 passed, 49 skipped, 0 failed** |

Levels 1-2 baselines did not change (`pixel-wall-plan`, `pixel-walk-touch`, `visual-matrix` matched). Before / after copies
(gitignored): `private-evidence/baselines-3d/LEVEL3-2435/{before,after}/`; in git the before is `a796420a1:<path>`.
`unit-plan-3d-determinism` ran without `SW_REQUIRE_VISUAL=1` (its picture comparison not forced; functional tests passed).

## Known limits

- SSR sees only what is on screen: a reflection fades where the reflected object leaves the frame; the reflection of the area
  behind the camera is the environment's.
- On a weak GPU a close-up of a large marble floor costs ~18 ms more on the realistic rung (A/B above); the dial switches it off.
- The marble map is generated on the main thread (now with the surface maps: a one-off of a few hundred ms more at the first
  realistic build on a slow device).

## Owner questions (Hebrew)

1. השתקפויות ברצפת השיש והקרמיקה (רהיטים וחלונות משתקפים) - בתמונות `after/marble-living-day.png` ו-`ab-reflections.md`:
   א. מתאים. ב. חזק יותר. ג. עדין יותר. ד. לכבות כברירת מחדל (נשאר בהגדרות).
2. השיש עכשיו מבריק ומלוטש, עם עורקים רכים ולוחות במראה (book-match); הקרמיקה באריחים של 120x120:
   א. מתאים. ב. שיש מט יותר (מושחז). ג. אריחים קטנים יותר (60x60).
3. אין בקטלוג מיטה ביתית (רק מיטת בדיקה / בית חולים). להוסיף מיטה זוגית ויחיד לקטלוג?
   א. כן. ב. לא עכשיו.
4. צללי המגע מתחת לרהיטים כהים יותר וצמודים לצורת הרהיט:
   א. מתאים. ב. עדין יותר.
