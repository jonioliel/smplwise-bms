# Studio 6 — LOOK SPEC (binding recipes for the product port)

**Status:** look-dev result, 2026-10-09, branch `pilot/ST7-lookdev`. Source of every number: the prototype in
`docs/design/mockups/plan-studio-6-prototype/` (`src/style.js`, `src/materials.js`, `src/env.js`, `src/scene.js`,
`index.html`). Evidence: `shots/lookdev/{light,dark}/`, `shots/lookdev-gpu.json`, `docs/design/studio6/checkpoint/`,
`docs/design/studio6/BEFORE_AFTER.md`.
**Audience:** the Sonnet / Opus implementers of CR-029 S0-S7 (plan §3). Everything here is a number or a rule, not an
adjective; where the port has to decide, the decision is written here.
**Owner answers honoured:** Q1 hybrid (live + stills), Q2 one delivery, Q3 eye 1.2-2.0 default 1.65, Q4 unsensed doors
walkable, Q5 mouse mode selectable (drag default), Q6 CC0 only, Q7 time from the site clock + slider + now, Q8 stills
first then lightmap, Q9 wall display live by default (setting), Q10 procedural AND models (setting), Q11 schematic
default for everyone, realistic per browser, Q12 both styles, Q13 full implementation at high quality.

---

## 1. Styles

Two selectable styles; the UI theme (light / dark) picks the default (`light` → architectural, `dark` → digital twin);
the user can pin either per browser (`localStorage studio6.style`; product: a per-user preference). A style switch
re-tints materials and re-applies the light rig; it never rebuilds geometry.

| Token | `light` — architectural render | `dark` — digital twin |
|---|---|---|
| id / name (he) | `light` / אדריכלי בהיר | `dark` / תאום דיגיטלי כהה |
| UI accent | `#2767ed` (product token) | `#38bdf8` |
| Label background / text | `rgba(255,255,255,.86)` / `#22314c` | `rgba(21,28,44,.86)` / `#e6ebf5` |
| Section cap (poché) | `#2f3237` flat, no edge | `#151b27` flat + edge line `#5fd3ff` 1 px, opacity .9 |
| Ground disc (day / night) | `#d4d8dd` / `#1a2130`, contact shadow α .38 | `#11161f` / `#0b0f17`, contact α .50 |
| Backdrop gradient (day) | top `#cfdff2` → horizon `#eef3f9` (mixed 50 % with the sun recipe) | top `#111a2b` → `#1b2a44` |
| Backdrop gradient (night) | `#0d1a33` → `#1a2b47` | `#070c17` → `#111c33` |
| Ground tint on the dome | 0.96 | 0.50 |

## 2. Material palette (hex tints; level 3 multiplies the hue-free detail texture, levels 1-2 draw the tint flat)

Palette rule (plan L2): warm whites / greige / oak / charcoal; chroma per material class low; **one** muted accent per
room (the sofa `fabric_accent`); no saturated primaries anywhere in the geometry. State colours are the only saturated
hues and they are tokens (`open_door`, `presence`, `cone`, `lock_ok`).

| Material id | tile_m | detail set (size px, normal strength) | `light` | `dark` |
|---|---|---|---|---|
| `plaster_white` (interior walls) | 2.0 | plaster 512, 0.35 | `#ece6dc` | `#4b5364` |
| `plaster_exterior` | 2.0 | plaster 512, 0.9 | `#d3ccc0` | `#343b4a` |
| `plaster_ceiling` (plain matte, L4) | 3.0 | plaster 256, 0.04 | `#f4f2ee` | `#3e4554` |
| `concrete` (worktops, pots, plates) | 2.5 | concrete 512, 1.2 | `#b0ada6` | `#4b5059` |
| `tiles_white` (wet rooms; 0.3 m tiles, 4 per tile) | 1.2 | tiles 512, 1.8, glossy | `#e2e1dc` | `#6c7178` |
| `tiles_grey` (0.6 m tiles, 2 per tile) | 1.2 | tiles 512, 1.8 | `#b2b5b8` | `#4f555e` |
| `oak` (planks 0.2 × 1.2 m, 6 per tile, staggered) | 1.2 | planks 512, 1.6 | `#bf9a6a` | `#7a6650` |
| `carpet` | 0.5 | fabric 256 (weave 1.3), 0.8 | `#aea79c` | `#4d525b` |
| `fabric_grey` (cushions, chair seats, duvets) | 0.6 | fabric 256, 0.9 | `#8a93a0` | `#5b6572` |
| `fabric_accent` (sofa body — the one accent) | 0.6 | fabric 256, 0.9 | `#667a8e` | `#4c6a86` |
| `fabric_rug` | 0.8 | fabric 256 (weave 1.6), 1.0 | `#ad9281` | `#605b67` |
| `linen` (bedding, pillows, shelves' books) | 0.8 | fabric 256 (weave 1.1), 0.6 | `#e9e4da` | `#9a9da6` |
| `leather` (office chair) | 0.6 | leather 256, 0.8 | `#4e4236` | `#332b24` |
| `wood_light` (cabinets, bed frames, kitchen fronts) | 1.0 | wood 256, 0.7 | `#d0b694` | `#8a7560` |
| `wood_dark` (legs, frames, casings, TV unit) | 1.0 | wood 256, 0.7 | `#6b5647` | `#3f3530` |
| `door_wood` (leaves) | 1.0 | wood 256, 0.9 | `#bb9e7c` | `#6e5b47` |
| `metal_dark` (lamp poles, camera bodies, seams), metalness .85 | 0.5 | metal 256, 0.4 | `#3c4046` | `#2a2e35` |
| `metal_light` (window frames, handles, appliances), metalness .80 | 0.5 | metal 256, 0.4 | `#babdc1` | `#8d949c` |
| `asphalt` / `grass` (outdoor, plant foliage) | 3.0 / 2.0 | concrete / grass 256 | `#6b6c6e` / `#879c72` | `#33363b` / `#3e5340` |
| `screen_off` (TV body) | – | emissive map = generated gradient picture, intensity .9 when playing | `#15181d` | `#0b0d12` |
| `shutter` | – | flat, roughness .6, metalness .3 | `#d9dbdd` | `#7a8088` |
| states: `open_door` / `presence` / `cone` / `lock_ok` | – | emissive .9 (frames), α .45 (presence ring), α .11 (cone) | `#e4463c` / `#2767ed` / `#2767ed` / `#2fa36b` | `#ff6b62` / `#38bdf8` / `#38bdf8` / `#3ddc84` |

Material defaults: `MeshStandardMaterial`, roughness 1 × roughnessMap, metalness 0 (metals .80 / .85),
`envMapIntensity` 0.7 (metals 1.0). Glass: top rung `MeshPhysicalMaterial` transmission .92 / roughness .05 / ior 1.5 /
clearcoat .6; **every other rung** `MeshStandardMaterial` `#dfe9f3`, opacity .16 (frosted .62), roughness .05,
`envMapIntensity` 1.4, `depthWrite` false, DoubleSide (plan L5).

Detail textures are hue-free: luminance mid 196-215 / 255, amplitude 14-46, so the tint IS the colour. When the CC0 sets
arrive (`ASSET_DOWNLOAD_LIST.md`) they are desaturated to the same mid / amplitude before use, and the tint table stays.

## 3. Light rig (per style; multipliers over the sun recipe of `sun.js` by elevation + weather)

| Parameter | `light` | `dark` | Where |
|---|---|---|---|
| Tone mapping | Khronos **Neutral** (`NeutralToneMapping`); AgX rejected (flat, drains the oak); ACES rejected (orange shift) | same | renderer |
| Exposure day / night (× recipe exposure 0.95-1.05) | 0.68 / 0.90 | 0.72 / 0.80 | `toneMappingExposure` |
| Sun intensity | recipe (3.4 clear … 0.9 overcast) × 0.55 (IBL on) × **1.30** | × 0.55 × **0.55** | DirectionalLight |
| Sun shadow | 2048 PCF, radius 5, bias −0.0004, normalBias .025, blurSamples 12; fitted to extent + 4 m (the ground disc gets the building's shadow) | same | |
| Sky scale (dome + backdrop) | 1.0 | 0.32 | dome vertex colours |
| Environment (IBL from the LDR dome) day / night | 0.50 / 0.22 | 0.50 / 0.20 | `scene.environmentIntensity` |
| Hemisphere fill (× recipe) | 0.22 | 0.35 | HemisphereLight |
| Interior fill while walking | lerp(0.55, 1.0, daylight) × 0.7 | lerp(0.45, 0.9, daylight) × 0.7 | hemi + env while `interior` |
| Moon | recipe night × .35 × 0.5 | × 0.8 | DirectionalLight |
| Lamp bulb emissive day / night | 1.6 / 3.0 | 2.6 / 3.4 | emissive intensity (lerp by `night`) |
| Lamp pool light (8 nearest lit lamps, decay 2) | base (ceiling 11 / floor 6 / wall 5 cd) × 0.50 day / 1.00 night | × 1.00 / 1.20 | PointLight intensity |
| Lamp glow sprite | opacity .16 + .26 × night, scale 1.1 m; hidden above the section cut | same | Sprite, additive |
| Pendant shade inner glow | emissive = bulb × 0.22 | same | |

Daylight factor per room = clamp(glazed area / floor area × 5, 0, 1); it drives the walk's fill (eased, `dt × 3`), not
the orbit views. Night factor = recipe `night` (civil twilight −4° … −12°).

## 4. Post chain per rung

| Rung | Chain | Numbers |
|---|---|---|
| Realistic (top) | RenderPass (MSAA ×4, HalfFloat) → GTAO → UnrealBloom → Output | GTAO radius **0.6 m**, scale .9, samples 8, denoise (lumaPhi 10, depthPhi 2, normalPhi 3, r 4, rings 2, 6) , blend `light` .55 / `dark` .50 |
| Realistic lite | RenderPass (MSAA ×2) → UnrealBloom → Output | no GTAO, no transmission, DPR 1 |
| Full (2), Schematic (1) | renderer (its own MSAA), no composer | |
| WebGL1 fallback | SMAA pass after Output | only where `samples` is unsupported |

Bloom (both rungs): threshold day / night `light` **2.0 / 1.6**, `dark` **1.2 / 1.0**; strength `light` .12 / .38, `dark`
.32 / .50; radius `light` .35, `dark` .45. Only emitters (bulbs, screens, state frames) cross the threshold; sunlit
white plaster peaks ~1.5 in the HDR buffer.

Contact AO on every rung ≥ 2 (plan L3 c, the lite rung's substitute for GTAO):
- **junction strip** along every wall footprint edge longer than 0.32 m: a floor quad 0.22 m wide and a wall quad 0.28 m
  high, gradient black α 1 → .45 at 35 % → 0, material opacity `light` .50 / `dark` .55, no depth write, polygon offset −1;
- **blob** under every floor-standing object (not lights / rugs / screens): a quad (w × 1.3 + 0.1) × (d × 1.3 + 0.1) with
  a radial gradient (α 1 → .75 at 45 % → .18 at 80 % → 0), opacity `light` .42 / `dark` .50;
- **building contact** under the footprint: (w + 3) × (d + 3) radial, opacity per style (above).

## 5. Section cut (plan L6)

Orbit views (top / iso / perspective): one world clipping plane at `elevation + ceiling × 0.60` of the **top visible
level** (`renderer.localClippingEnabled`, `material.clippingPlanes` on every wall / object / door / glass material,
`clipShadows` true; decals, caps, ground, sprites, lines excluded). Each wall footprint gets a cap polygon at the cut
(`section_cap`), merged per level; the dark style also draws the footprint outline as a line (`section_edge`). Lamps
above the cut lose their glow sprite; their pool light stays (it is the state cue). The walk never cuts; `all floors`
cuts only the top level. Setting: `sectionCut` on / off (default on).

## 6. Geometry detail rules (plan L1 / P3; level 3 only — levels 1-2 keep the boxes so baselines never move)

- `RoundedBoxGeometry`, 2 segments (1 for parts under 0.12 m), radii: furniture bodies 2-6 cm, cushions 5 cm, table
  tops 1.2 cm, door leaves 6 mm, seams 2 mm, panels 5 mm. Legs are tapered cylinders (r 18-30 mm, taper .7-.8, 10 segments).
- Sofa: base 0.34 high on 8 cm legs, back 0.2 deep, arms 0.2 wide, one seat + one back cushion per 0.6 m (3 above 1.9 m).
- Chairs: seat frame + 5 cm cushion, back 92 % width with two uprights; office chair: column, 5-star base, leather.
- Tables: 3.5 cm top; dining legs wood, coffee legs metal, desk with side panels, modesty panel, monitor + keyboard.
- Cabinets: body 12 mm radius + recessed plinth; doors every 0.5 m as 6 mm seams; handles (bar 0.14 m or two uprights for
  wardrobes); bookcase: sides, 5 shelves, muted book blocks (`linen` / `fabric_rug`).
- Beds: 20 cm frame on legs, 20 cm mattress (6 cm radius), duvet 8 cm over 62 % of the length with a fold, one or two
  pillows 0.42 × 0.11, headboard 5 cm × (h + 0.45).
- Kitchen: fronts with 6 mm seams every 0.6 m + bar handles, 4 cm worktop proud 1.5 cm, recessed plinth 10 cm; fridge
  3 cm radius with a 50 cm handle; island with a sink plate.
- Plants: tapered pot + 5 spheres (r = 0.55 w × 0.6-1.0).
- Doors: leaf 45 mm, two raised panels per face (52 % / 28 % of the height, 5 mm proud, 1 cm radius), lever handles with
  roses on both faces at 1.02 m, 7 cm casing proud 12 mm on both faces; sliding glass leaf with a 4 cm dark frame.
- Windows: 6 cm frame, interior sill 3 cm proud on both faces (`tiles_white`), mullion above 1.0 m width (two above 2.0 m),
  transom at 68 % above 1.6 m height.
- Skirting: 8 × 1.2 cm along every interior wall footprint; lamps: ceiling disc + rim, pendant cord + rose + shade, floor
  lamp pole + base + shade.
- Triangle budget: ≤ 2 × the box baseline per floor; above `HEAVY_CONFIG` thresholds (venues) fall back to boxes.

## 7. UI chrome rules (plan L9 / L10; clean operator screens)

- Full-bleed canvas; every control floats: translucent cards `rgba(255,255,255,.78)` (dark `rgba(21,28,44,.72)`),
  blur 14 px, border `rgba(255,255,255,.6)` / `.08`, radius 12 px, shadow `0 8px 24px rgba(17,24,39,.10)`.
- Top-left: time pill (icon · HH:MM · now · caret); click opens slider + date / sun line + weather and presets.
- Top-right: the **floors tree strip** (thumbnail + name + state dots per floor, "all floors"); the side panel holds the
  floors / areas tree with per-floor collapse (owner rule) — room rows are "stand in room" shortcuts.
- Bottom centre: one view bar — top / iso / perspective | walk | quality dropdown. Nothing else over the scene.
- Labels: room names as floor text (12.5 px, 700, heading colour, 2 px halo), temperature pill only on hover of the
  room name (or the `showTemps` setting), device labels on hover; camera labels always. No HUD (developer toggle).
- Toasts: one bottom pill, auto-hide 6 s (3.5 s for confirmations); nothing permanent.
- ≤ 820 px: the panel is a bottom sheet (62 vh, handle, slide 300 ms), the strip becomes a row above the bar, the bar
  scrolls horizontally, the walk shows the joystick (104 px) + three floating buttons (exit, next position, panel), the
  numeric walk fields hide. No horizontal overflow at 390 / 820 / 1440 (checked in `lookdev-gpu.json`).
- Themes: light + dark UI, both with both 3D styles; dark theme pairs with the dark style by default.

## 8. Motion timings (plan L11)

| Transition | Timing |
|---|---|
| Preset change (same camera type: top ↔ iso) | 520 ms ease-in-out quad on position, target, ortho half-size |
| Preset change with a camera type change (iso ↔ perspective), floor change | dark flash: 120 ms to α .6 (floor: .45), 280 ms back |
| Walk entry | 650 ms fly-down from the orbit pose (position lerp + quaternion slerp) to the eye pose |
| Door swing / slide | 350 ms ease-in-out quad (85°) |
| Shutter | 350 ms × 0.6 per unit of travel |
| Lamp on / off | exponential, `dt × 8` |
| Eye-height change | exponential, `dt × 6` (~0.4 s) |
| Room fill adaptation | exponential, `dt × 3` (~0.6 s) |
| Popover | 180 ms pop |
| Setting: `motion` off disables the tweens and flashes |

## 9. Walk (P5)

FOV 62° desktop, 70° touch, 76° portrait; near plane 0.06 m; body radius 0.28 m; door clearance = casing 7 cm + jamb
5 cm inside the 0.8-1.6 m opening; crosshair 12 px, grows ×1.5 and turns `--sw-map-lit` over a device within 3.5 m with
a one-line hint "<name> · Enter". Mouse look: `drag` (default), `lock` (pointer lock on first click, silent fallback),
`auto`. Eye height 1.2-2.0 m, default 1.65, eased.

## 10. Settings the port must expose (owner Q3 / Q5 / Q7 / Q9 / Q10 / Q11 / Q12)

| Key | Values | Default | Scope |
|---|---|---|---|
| `style` | `auto` (follow theme) / `light` / `dark` | `auto` | per user (browser) |
| `defaultView` | `schematic` / `realistic` | `schematic` for everyone; `realistic` per browser choice | per user |
| `wallDisplay` | `live` / `stills` | `live` | per display (kiosk) |
| `furnitureMode` | `procedural` / `models` | `procedural` until the CC0 kit lands; then `models` with per-item fallback | per site |
| `timeSource` | `clock` (site clock, IANA zone) / `manual` (slider) + "now" | `clock` | per view |
| `eyeHeight` | 1.2 … 2.0 m, step 0.05 | 1.65 | per user |
| `mouseMode` | `drag` / `lock` / `auto` | `drag` | per user |
| `sectionCut` | on / off | on | per user |
| `showTemps` | on / off | off | per user |
| `motion` | on / off | on | per user |
| kiosk idle → still | 0 / 10 / 30 / 120 / 600 s | 30 s | per display |
| quality ladder | auto / fixed rung; DPR cap 1-2 | auto, DPR 1.25 | per device |

Unsensed doors are walkable (Q4) — not a setting.

## 11. Performance (same-session, workstation iGPU under load; see `shots/lookdev-gpu.json` and `BEFORE_AFTER.md`)

Filled from the final measurement run — see §11 of `BEFORE_AFTER.md`. SwiftShader per-rung numbers: **NOT_RUN** (software
renderer, the harness times out on the realistic rung); real phones / tablets / kiosk: **NOT_RUN** (no device).

## 12. What the port must NOT copy from the prototype

The JS geometry port (`geometry.js`), the canvas texture generator (the CC0 sets replace it), the localStorage settings
(product: user preferences + site settings), the in-memory stills (product: `plan_bakes`), the demo plan.
