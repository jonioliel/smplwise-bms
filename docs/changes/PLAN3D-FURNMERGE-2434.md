# PLAN3D-FURNMERGE-2434 - furniture merge, + / - zoom buttons, studio backdrop over the realistic sky

Branch `pilot/PLAN3D-FURNMERGE-2434`, from `origin/pilot/PLAN3D-REALISM2-2433` at 73a73b185 (the new look, which already carries
PLAN3D-POLISH-2430). No version bump, no migration, no backend change. Owner approval 2026-11-11: "furniture merging to save draw
calls - after the new look is merged". New hunks in shared files are marked `PLAN3D-FURNMERGE-2434`.

Files: `frontend/src/map/scene-real.ts` (merge, backdrop), `scene-three.ts` (zoomBy, the per-frame sky pass, the A/B switch),
`sw-plan-3d.ts` (four small lines: import, styles array, one render line), new `zoom-buttons.ts`, new specs
`tests/unit-plan3d-furnmerge.spec.ts` (Node) and `tests/unit-plan3d-zoom.spec.ts` (page).

## 1. Furniture merge (level 3, both rungs)

Before: the structure was already merged per (level, material); every furniture part - each object base part, each part of the
procedural families (sofa seat, back, arms, legs, table top...), each kit-model primitive - was an `InstancedMesh` per distinct
(shape, size, bevel, material) or per (file, primitive). Most groups held one or two instances, so each piece of furniture cost
several draws, plus its shadow-pass and (realistic rung) GTAO normal-pass draws.

Now (`scene-real.buildReal`):

- Object / family groups go into the level's merged mesh of their material (`Bucket`, the structure's own merged meshes): one draw per
  material per level. The part keeps its own UVs (`partGeometry`'s, so the wood grain stays turned with a turned table); the rest of the
  merged mesh keeps its box UVs. Parts that throw no shadow (`shadow: false` families) get their own `...|noshadow` merged mesh.
- Kit models: every tile of every primitive into a `model-merged|<level>|<slot material>|slot:<roughness>` mesh with no UVs (as
  instanced - their materials draw the plain tint) and the +-5 % luminance jitter as a vertex colour (the `vc:` material variant:
  the same material with `vertexColors`, which multiplies the diffuse exactly as `instanceColor` did).
- InstancedMesh stays for repeated heavy items: `keepInstanced(count, tris) = count >= 2 && count * tris > INSTANCE_KEEP_TRIS (24,000)`
  (a hall of identical seats: one geometry, many matrices, instead of the vertex memory of every copy). None of the demo floors
  reaches it.
- Kept as they were: door leaves (they swing), shutters (they roll), lamp bulbs (each its own emissive by lamp state), the room glow
  (`room-glow-mesh.ts`), the caps, the contact AO strips / blobs, glass.
- Picking: a merged mesh carries `userData.ranges` (the first triangle of each part) and the lookup's part list, the rule the view
  already applies to the structure (`SceneView.pick` binary search) - rooms / zones, objects and openings pick as before.
- Per-floor visibility / translucency: a merged mesh is per level (the description's levels decide what is built, as before);
  levels 1-2 are untouched (the translucent upper plate is a level-2 path). The quality ladder only switches rungs / levels and
  rebuilds; nothing reads the instanced groups. The baked AO volume reads the description, not the meshes.
- `realStats.furnitureMerged`: the parts / tiles drawn inside merged meshes. `SceneView.mergeFurniture = false` builds the old
  instanced graph (tests and the A/B only).

### Measured (Intel UHD 0x9B41, ANGLE D3D11, headless Chromium on the real GPU, 1280 x 800)

`evidence/PLAN3D-FURNMERGE-2434/{before,after}/perf.md` (`harness/perf.spec.ts`, `renderer.info` after one frame; before = 73a73b185,
after = this branch; same harness, same machine):

| Floor | Rung | Draw calls before / after | Triangles before / after | Level-3 meshes before / after |
|---|---|---|---|---|
| look-dev house, ground floor, iso | realistic | 288 / 186 (-35 %) | 38,096 / 38,096 | 122 / 71 |
| look-dev house, both floors, iso | realistic | 482 / 304 (-37 %) | 67,892 / 67,892 | 212 / 123 |
| dense floor (perf house, 12 rooms), iso | realistic | 184 / 172 (-7 %) | 43,432 / 43,432 | 88 / 82 |
| dense floor, both floors, iso | realistic | 340 / 316 (-7 %) | 85,584 / 85,584 | 173 / 161 |
| look-dev house, ground floor, iso | lite | 160 / 109 (-32 %) | 19,172 / 19,172 | 122 / 71 |
| look-dev house, both floors, iso | lite | 265 / 176 (-34 %) | 34,472 / 34,472 | 212 / 123 |
| dense floor, iso | lite | 98 / 92 | 21,312 / 21,312 | 88 / 82 |
| dense floor, both floors, iso | lite | 176 / 164 | 42,388 / 42,388 | 173 / 161 |

Triangles are identical (nothing drawn twice, nothing lost; the Node spec asserts the same total). The dense floor gains little: its
12 rooms repeat the same few items, which were already one InstancedMesh per kit primitive; what is left there is doors and lamps.

Frame time: the workstation was shared with other agents (CPU near 100 %, the absolute numbers swing by 20-30 ms between runs), so
the before / after columns of `perf.md` are not comparable as such. The in-page A/B interleaves merge on / off rebuilds of the same
scene (`harness/studio.spec.ts`, 7 pairs of `benchFrames(20)`, median; `after/ab-merge.md`):

| Scene | Rung | merge off ms | merge on ms | delta | calls off / on |
|---|---|---|---|---|---|
| house L0 iso | realistic | 112.96 | 113.72 | +0.8 (noise) | 287 / 185 |
| house both iso | realistic | 104.63 | 89.46 | -15.2 | 481 / 303 |
| house L0 iso | lite | 58.65 | 55.95 | -2.7 | 159 / 108 |
| house both iso | lite | 60.36 | 55.32 | -5.0 | 264 / 175 |

The style guide's demo floor (few objects: `after/ab-merge-demo.md`): realistic 102 -> 100 calls, lite 57 -> 56; the frame-time
deltas there (-6.9 / +4.8 ms) are the machine's noise.

Reading: on this GPU the realistic rung is fill-bound on one floor (the post chain dominates), so 100 fewer draws do not show there;
with both floors, and on the lite rung, the draw cost is visible (-5 to -15 ms). On a CPU-bound weak device (the quality ladder's
case) the draw count is what matters. Pictures before / after (`house-L0-iso-3`, `house-both-iso-3`, `house-L0-iso-3-lite`, `dense-L0-iso-3`; the rest of the shot list was taken and dropped to keep the evidence small): the same.

## 2. + / - zoom buttons

As the round-28 mockup (`map3d/app/pills.html`, `arx.js` `hud(sc.stage, 'bl', ...)`): a group of two icon buttons (sw-icon `minus`,
`plus`) in the bottom corner opposite the view bar - the left edge in the RTL shell. Where it stands (`zoom-buttons.zoomPlace`,
kept on the host as `data-zoom-room` by a ResizeObserver on the element and the bar): on the bar's row when the row leaves 100 px
free (a wide map stage), else just above the bar's row (a tablet: the product's bar carries every mode chip and fills the row;
that corner's notes move up over it), and not at all on an element under 700 px (a phone - a pinch zooms, the mockup hides it there
too - or an event's card). The bar never wraps for it, so no view's framing moves: a first version shrank the bar by the group's
width, which re-wrapped the bar of the narrow event / history cards and moved 5 level-3 pixel baselines (runner proof below);
that was replaced by this placement and the baselines stay as they are. The floor strip stands on the bar's other side.

One press = 1.35x closer or farther, eased over 180 ms (at once with motion off): the iso camera's zoom (0.4..8 of the preset's
fit), the perspective eye along its line to the orbit target (1.2 m .. 4x the building's diagonal). A preset click returns to the
preset's framing; the live fit stops following the stage after a zoom, as after a wheel zoom. Hebrew labels "התקרבות" / "התרחקות"
(`aria-label` + `title`), the group `role="group" aria-label="זום"`, real buttons (keyboard Enter / Space), focus ring. Hidden in the
walk and in the kiosk view. The element's own edits are a few lines (import, the styles array, one render line, the observer
next to the bar's); the CSS, the template and the placement are in `zoom-buttons.ts`, so pilot/PLAN3D-R28-UI-2433's overlay edits of
`sw-plan-3d.ts` should merge cleanly (a conflict is possible only on the `static styles = [css` / `` `, ZOOM_CSS]; `` lines or the
`watchBar` hunk if that branch rewrites them).

Evidence: `after/zoom-0.png`, `zoom-in-2.png`, `zoom-out-1.png`, `zoom-persp-in-1.png` (full-viewport desktop: on the row),
`zoom-place-tablet.png` (above the bar), `zoom-place-desktop.png`.

## 3. The studio ("dark") backdrop over the realistic level's sky

Found: the "סטודיו כהה" backdrop darkened only the CSS gradient. Three things still showed the light sky look:

- the realistic rung's ground disc is lit: by day the sun turned the dark plinth a mid grey that filled the middle of an iso view
  (REALISM2's `10-house-studio-iso-day.png`: grey-brown behind the house). Now in the studio the lit disc glows in the studio colour
  (`emissive`) with 15 % of it as albedo (the building's shadow stays faintly on it); the sky backdrop resets the glow.
- the per-frame sky pass of the perspective views (`SceneView.followSky`, PLAN3D-POLISH-2430) re-showed the hill band and grew the disc
  to the horizon every frame, over the dark gradient; and it remembered the disc's first scale, so a later sky / studio switch left the
  wrong plinth size in the iso view. It now follows the backdrop: studio = no band, the plinth scale, in every orbit view.
- the walk saw the sun's sky dome. The dome the walk sees now has its own colours: the sun's sky (copied from the environment's dome)
  or the studio gradient (the CSS stops: glow at the horizon, top stop overhead); no hill band; the walk's fog takes the gradient's
  bottom stop. The environment (IBL) is still prefiltered from the sun's sky, so the lighting does not change with the backdrop.

The default stays `sky` (owner 2026-11-11, answer 26 א). Evidence: `after/studio-{iso,persp}-day-{3,3-lite}.png`,
`studio-persp-night-*.png` (dark behind the model by day and by night, both rungs). The walk under the studio sky is covered by the
unit test (dome colours), not by a picture: the harness could not start the walk on the style-guide demo.

## Tests

| Command (from `frontend/` unless noted) | Exit | Result |
|---|---|---|
| `npx tsc --noEmit -p .` (after the last source change) | 0 | clean |
| `npx playwright test -c playwright.unit.config.ts tests/unit-plan3d-furnmerge.spec.ts --workers=1` (Node) | 0 | 4 passed |
| `SW_BASE_URL=http://127.0.0.1:4434/ npx playwright test tests/unit-plan3d-zoom.spec.ts --workers=2` (Vite dev server, 3 projects) | 0 | 6 passed, 3 skipped (mobile-only / desktop-only by design) |
| `SW_BASE_URL=http://127.0.0.1:4434/ npx playwright test tests/unit-plan3d-real.spec.ts tests/unit-plan-3d-realistic.spec.ts tests/unit-plan-3d-look-r3.spec.ts tests/unit-plan-3d-view.spec.ts tests/unit-plan3d-floor-finish.spec.ts tests/unit-plan3d-room-glow.spec.ts tests/unit-plan3d-ao-volume.spec.ts tests/unit-plan-3d-state.spec.ts tests/unit-plan-3d-quality.spec.ts tests/unit-plan3d-sun.spec.ts tests/unit-studio6-ui.spec.ts --project=desktop --workers=2` | 0 | 65 passed, 1 skipped (the existing skip) |
| Evidence harness `perf.spec.ts` before / after, `studio.spec.ts` (studio, zoom, ab) | 0 | 1 passed each |

New unit tests: merge on vs off - same triangle total, same pickable part set, fewer meshes, ascending ranges, vertex colours / no UVs on
merged kit tiles, deterministic graph; a ray at every instanced object of the old graph finds the same part in the merged graph by the
view's range rule; the keep-instanced rule; the studio backdrop (lit disc glow, band, plinth scale, walk dome dark while the
environment's dome keeps the sun's sky, back to sky, the unlit lite disc). Page tests: the zoom group (labels, placement opposite the
bar and clear of every chip, closer / farther in iso and perspective, a preset restores the framing, keyboard), hidden on a phone,
on a narrow element and in the kiosk view, the level-3 graph carries merged furniture and a click on a merged object selects it.

## Runner

Pending (filled in by the next commit).

