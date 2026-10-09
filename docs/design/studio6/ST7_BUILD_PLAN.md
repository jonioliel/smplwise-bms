# ST7 — Studio 6 build plan (realistic 3D + eye-level walk-through)

**Status:** plan, 2026-10-09. Waits for the owner's answers in `docs/design/studio6/OWNER_FORM_HE.html`.
**Binds to:** `docs/changes/CR-029-PLAN-STUDIO-6-REALISTIC-3D.md` (branch `pilot/studio6-plan`, §1-§12) and its
prototype findings §13 (branch `pilot/studio6-prototype`, `docs/design/mockups/plan-studio-6-prototype/`).
**Board / registry:** ST7 on the board = task card T089 (R177 / R178, AT177 / AT178), dependency T087.
**Audience:** the coordinator and the Fable design agent that runs right after the owner answers.

No product code changes are part of this document. Nothing here authorises a download, a device write or a release.

---

## 0. Contradictions recorded (not resolved here)

| # | What disagrees | Where | Proposed handling |
|---|---|---|---|
| C1 | The owner budgeted **~20 h** of Fable work for ST7; CR-029 §13.4 estimates the product build (S0-S7) at **84-116 h**. 20 h cannot deliver CR-029 release A in the product with tests. | owner (2026-10-05 / 10-08) vs CR-029 §13.4 | New form question 13. Recommended: the 20 h Fable budget buys the **look** (art direction + look development in the prototype + a binding look spec); the product port runs afterwards on cheaper models (Sonnet/Opus) per the model-budget rule. |
| C2 | CR-029 Q12 asks whether "the attached mockups" are right; the owner has since answered on the prototype: "much better, direction right, looks like the 90s". | CR-029 §12 vs owner review 2026-10-05 | Form Q12 re-asked as "which visual direction" (light architectural vs dark digital twin vs both). The original answer is recorded in the question text. |
| C3 | CR-029 Q8 recommends the bake in release B; §13.4 recommends moving the **stills** into release A. | CR-029 §12 Q8 vs §13.4 | Form Q8 offers the split explicitly (stills in A, lightmap in B = recommended). |
| C4 | CR-029 Q10 options were "no models / models in B"; the prototype showed that sharp-box furniture is a main cause of the "90s" verdict. | §12 Q10 vs §13 shots | Form Q10 recommends an improved procedural catalog (bevels, cushions, proportions) inside the 20 h; real CC0 models stay an option. |
| C5 | T089 depends on T087, still BACKLOG by the registry rule. | CR-029 header | Coordinator must close T087 through the rule or record the exception in `management/tasks.json` before T089 is READY. Unchanged. |

---

## 1. What the prototype got right, and why it still looks like the 1990s

The prototype (three r0.186.1, `index.html` + `dist/studio6.js`) proves the mechanics: level-3 materials from the
geometry, sun by hour, light pool, GTAO, bloom, door / shutter animation, the walk (collision, doors, stairs, A*, minimap,
joystick), stills + room masks, the quality ladder. None of that needs redoing. The look does. Diagnosis from
`shots/01, 03, 11, 17, 21`:

| # | Symptom in the shots | Cause | Fix (look-dev item) |
|---|---|---|---|
| L1 | Every object is a sharp-edged box (sofa, TV, tables, cabinets, door leaves) | `BoxGeometry` everywhere in `src/scene.js`; no bevel, no silhouette detail | Rounded / chamfered boxes (`RoundedBoxGeometry` from `three/addons`, 2-3 segments, radius 1-3 cm) for furniture, door leaves, frames; cushions as separate rounded parts; tapered legs; skirting boards; door casings; window mullions and sills |
| L2 | Saturated primaries: royal-blue sofa / rug / TV, orange-brown wood on every surface | Material colours picked per item without a palette | A curated interior palette (warm whites, greige, oak, one muted accent, charcoal metal); max chroma per material class; one accent colour per room at most |
| L3 | Flat, bright interiors; no contact darkening under furniture or in corners; night = brown murk | No GI; the sky diffuse reaches every indoor wall; ACES with a constant fill cut | (a) **AgX** (or `NeutralToneMapping`) instead of ACES - less orange shift, better highlights; (b) per-room hemisphere / light-probe fill driven by window area instead of a global constant; (c) cheap baked contact AO: a soft blob-shadow decal under every object (one instanced quad, one 128 px texture) + vertex AO along wall-floor junctions; (d) GTAO tuned (radius ~0.6 m, low intensity) on the realistic rung only |
| L4 | Textures blurry, plank scale far too large, ceiling looks like a floor | 256 px procedural canvas textures; tile sizes not real-world | CC0 sets at 1 K / 512 px (owner Q6), real tile sizes from the manifest (`tile_m`: oak plank 0.18 × 1.2 m, tile 0.6 m, plaster 2 m); plain matte ceiling by default |
| L5 | Windows are grey opaque boards | Physical glass only on the expensive rung; no outside to look at | Cheap glass for all rungs (env-map reflection + 15 % opacity) and an exterior backdrop seen through windows (gradient sky + ground plane + soft horizon); physical transmission only on desktop "realistic" |
| L6 | Iso view hides the interior behind tall grey exterior walls | Cutaway not drawn in the prototype | Dollhouse cut: walls cut at a uniform height with a dark **section cap** (architectural poché) - the single strongest "current" cue in the light style; the product's azimuth cutaway keeps working |
| L7 | Lamps are bloom blobs; bloom haloes the frame | Bloom threshold low, emissive too high | Physically plausible emissive (lux-ish values), bloom threshold above 1.0, small radius; lamp shades with an inner glow; warm (2700-3000 K) vs cool daylight contrast at dusk |
| L8 | Jagged edges | No AA in the composer chain | MSAA render target (`samples: 4`) on desktop, SMAA pass as the fallback; DPR caps as in CR-029 §3.4 |
| L9 | UI from a 2018 admin panel: long toggle list, debug HUD over the scene, chip rows overlapping the walk bar, a temperature pill on every room | Prototype instrumentation left visible | HUD hidden by default (developer toggle); floating translucent toolbars; room names as small floor labels; temperature / state pills on hover or long-press only (clean-operator-screens rule); the **floors / areas tree stays** (owner rule) |
| L10 | Phone: page wider than the viewport (shot 21), controls cut off | Fixed-width side panel | Bottom sheet for the panel on ≤ 820 px, joystick + 3 floating buttons, no horizontal overflow (design contract) |
| L11 | Hard camera cuts between presets / floors | Instant camera set | 400-600 ms eased transitions (orbit target + zoom), floor change as a cross-fade of the strip, walk entry as a fly-down from the current view |
| L12 | No ground / context outside the house | Single colour backdrop | Soft ground disc with a contact shadow under the building, subtle gradient backdrop per theme, optional site plot outline |

What "current" means, concretely (reference class): Planner 5D / Floorplanner "3D view", Matterport dollhouse, modern
architectural-visualisation iso renders, Apple Home / Google Home device-state cards. Common traits: soft shadows and
contact AO, restrained palettes, chamfered geometry, section-cut walls, generous negative space, UI floating over a
full-bleed canvas, motion on every state change.

---

## 2. Execution plan for the Fable agent (the 20 h, recommended answer to Q13 א)

Branch: `pilot/ST7-lookdev` from `origin/pilot/studio6-prototype`. Work stays inside
`docs/design/mockups/plan-studio-6-prototype/` (design evidence, not product code), so the iteration loop is "edit →
`node build.mjs` → `node tools/capture.mjs shots`" in seconds, without the product's test suites.

| Phase | Hours | Output | Done when |
|---|---|---|---|
| P0 Setup + baseline | 1 | Baseline shots at 1440 / 820 / 390 × light / dark × day / sunset / night; `perf-gpu.json` re-run | Same numbers as §13.2 ± 10 % on the workstation iGPU |
| P1 Light and colour pipeline | 3 | AgX / Neutral tone mapping, exposure per time band, per-room fill from window area, contact blob shadows, tuned GTAO, bloom threshold, sky + exterior backdrop, MSAA / SMAA | Interior walk frame reads with depth (corners darker than wall centres) without the GTAO pass on the lite rung |
| P2 Materials | 3 | Palette tokens per style (owner Q12), material recipes (base colour, roughness, normal strength, tile_m) for the §6.2 ids; CC0 textures if approved (see §4), otherwise improved procedural at 512 px cached | Side-by-side board shows no saturated primaries; plank / tile scale matches real sizes |
| **Owner checkpoint** (~hour 8) | - | Three frames: iso day, iso night with lamps, walk in the living room, in the chosen style | Owner says go / adjust. Stop and wait; do not continue on a "no" |
| P3 Geometry detail | 4 | Rounded furniture families (sofa, chairs, tables, beds, cabinets, TV, lamps), skirting, casings, sills, mullions, door leaves with panels; section caps on cut walls | Shot 17 re-taken: no sharp-box silhouettes in frame |
| P4 UI chrome + motion | 4 | Floating toolbars, hidden HUD, labels on hover, bottom sheet on phone, preset / floor / walk transitions, light + dark themes; the floors tree kept | 390 px: no horizontal overflow; 1440: canvas ≥ 75 % of the viewport; both themes captured |
| P5 Eye level polish | 2 | FOV per device, eye-height easing, door-frame clearance, crosshair + action hint, interior exposure adaptation | Walk frames at 1.65 m and 1.2 m look correct; scripted walk checks (`shots-gpu.json`) unchanged |
| P6 Evidence + look spec | 3 | Final shots + GIFs, perf table per rung, **`docs/design/studio6/LOOK_SPEC.md`** (palette tokens, material recipe table, light rig per time band, post chain per rung, geometry detail rules, UI chrome rules, motion timings), before / after board | Look spec complete enough that a non-Fable implementer can port it without design decisions |
| **Total** | **20** | | |

If the owner picks Q12 ג (both styles) add ~6 h (a second palette + light rig + section-cap / outline treatment).
If he picks Q10 ב / ג (real models) add 12-16 h (CR-029 S8), not inside the 20 h.

### 2.1 Screens the look-dev must cover (all in light and dark, each at 1440 / 820 / 390 unless noted)

1. Realistic orbit, iso preset, ground floor - day, sunset, night with lamps.
2. Realistic orbit, perspective, both floors.
3. Walk: entrance door, living room, kitchen after tap-to-walk, blocked at a closed door, on the stair, upper floor,
   stand-at-camera (coverage cone volume).
4. Walk on a phone: joystick, look drag, bottom sheet closed / open (390 only).
5. Wall-tablet kiosk still (day / night with room masks), 820 and 1280 × 800.
6. Device states: lamp on / off, door open / closed / stale, shutter positions, presence ring, lock plate.
7. Quality ladder note (fallback to lite / full / schematic) and the time-of-day control.
8. Settings mock: eye height, unsensed doors, kiosk idle minutes (only the controls the owner's answers keep).
9. Editor mock (product later): material per wall / room / object, north compass, saved walk positions.

### 2.2 3D approach (per CR-029 §3.3, hybrid)

- Real-time three.js level 3 for orbit and walk; rungs: realistic (GTAO, physical glass on desktop) → realistic lite
  (textures, IBL, sun shadow, contact blobs, bloom, DPR 1) → full → schematic → stills → 2D.
- New look items must sit on the **lite** rung wherever they are cheap (contact blobs, AgX, palette, bevels, section
  caps, exterior backdrop), because the lite rung is what most iGPUs and tablets get. Expensive items (GTAO, transmission)
  stay on the top rung only.
- Bevels add triangles: budget ≤ 2× the current 26 k triangles for the demo house; instancing per (shape, material)
  keeps draw calls ≤ 150 on the lite rung.
- No HDRI, no path tracer, no KTX2, no Draco (chunk cap, CR-029 §3.4). The Sky shader stays out (§13.3 item 2).

---

## 3. After the look: product port (not Fable; by cheaper models, owner Q2 / Q13)

Order per CR-029 §10 and owner Q2 (recommended): S0 schema 2.1 → S4 walk core → S1 materials + level 3 (now with the
look spec) → S2 sun / sky / lamps → S3 stills (if Q8 א) → S7 = release A; then S5 walk UX + kiosk → S3 lightmap → S7
= release B. Hours from CR-029 §13.4, adjusted for the look spec:

| Slice | CR §13.4 | Adjusted | Why |
|---|---|---|---|
| S0 schema + resolver | 10-14 | 10-14 | |
| S4 walk core | 14-18 | 14-18 | |
| S1 materials + level 3 | 14-20 | 16-22 | + bevel geometry in `scene-builder.ts` (deterministic), contact blobs, section caps, AgX |
| S2 sun / sky / lamps | 8-10 | 8-10 | recipes come from the look spec |
| S3 stills only (release A) | (in 18-26) | 6-8 | the B1 path is proven; storage per CR-029 §5.3 |
| S7 release A | 8-12 | 8-12 | |
| S5 walk UX + kiosk | 12-16 | 12-16 | + bottom-sheet UI from the look spec |
| S3 lightmap (release B) | (in 18-26) | 12-18 | |
| **Total** | **84-116** | **86-118** | look spec saves design decisions, the extra geometry costs build time |

Model choice: Sonnet for S0 / S7 / tests, Opus for S4 / S1 / S3 (algorithmic and determinism-sensitive). Fable only if
the owner rejects the port against the look spec.

---

## 4. Asset needs

| Asset | Count | Source (CC0 only unless owner Q6 ב) | Size | Gate |
|---|---|---|---|---|
| PBR material sets (colour, normal, roughness+AO packed) | ~16 (CR-029 §6.2 ids) | ambientCG, Poly Haven | ~3 MB total at 512 px; 1 K masters kept out of the repo | **Downloading requires explicit owner approval per file list** (filename, source URL, size). The agent asks once with the full list; if not approved it continues with procedural 512 px textures |
| Contact-shadow blob | 1 | generated (radial gradient) | < 10 KB | none |
| Exterior backdrop | 0 files | gradient + plane in code | - | none |
| Furniture models | 0 (Q10 א) / ~20 (Q10 ב / ג) | Kenney furniture kit, Poly Haven models (CC0) | ≤ 2,000 tris each, ~1-2 MB total | download approval as above; manifest rows |
| Fonts / icons | 0 | system fonts, existing product icons | - | none |

Every file gets a row in the prototype's `LICENSES.md` (and later `frontend/public/plan3d/MANIFEST.json`): id, source URL,
author, licence, download date, sha256, processing. No Sketchfab / TurboSquid / CGTrader, no AI textures, no photos of
the owner's sites.

---

## 5. Test plan

### 5.1 Look-dev phase (prototype)

| Check | How | Pass |
|---|---|---|
| Boots, no console errors | `tools/capture.mjs smoke` from `file:///` | 0 page errors |
| Scripted walk unchanged | `tools/capture.mjs shots` → `shots-gpu.json` | blocked at the closed door, on the stair, upper floor after it, tap-to-walk arrival - same as before |
| Performance per rung | `tools/capture.mjs measure` with `SW_GPU=1` on the workstation iGPU | lite walk ≥ 50 fps at 1076 × 828 (was 57); realistic orbit ≥ 30 fps (was 35); phone-size lite ≥ 60 fps; triangles ≤ 2× baseline |
| No horizontal overflow | Playwright at 390 / 820 / 1440 | `scrollWidth == innerWidth` |
| Both themes | captures in light and dark | labels and toolbars readable (contrast ≥ 4.5:1 for text) |
| Licence manifest | every new file has a `LICENSES.md` row with an allowed licence | 100 % |
| SwiftShader | smoke only | boots and falls back down the ladder; per-rung numbers stay NOT_RUN (known limit) |
| Real devices | owner on a phone / tablet | reported, NOT_RUN until he walks it |

### 5.2 Product port

As CR-029 §8, plus: bevel / section-cap geometry deterministic (`unit-plan-3d-determinism`), level 1-2 visual baselines
**unchanged** (proves level 3 is additive), level-3 baselines new on SwiftShader only, `unit-three-chunk` ≤ 200 KB gzip
with the post chain in its own lazy chunk, the R178 perf gate on the runner (390 px, 4× CPU throttle), AT177 / AT178
evidence rows. Browser suites run on the Ubuntu runner (`run_remote.sh`).

---

## 6. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 20 h is read as "ST7 done" while the product still has no level 3 | high | Q13 makes the split explicit; the board shows ST7-look and ST7-port as separate rows |
| Style is subjective; the owner rejects the look late | medium | owner checkpoint at ~8 h with three frames; Q12 fixes the target before work starts |
| Better lighting costs the iGPU frame budget | medium | look items placed on the lite rung only when cheap; perf table per phase; GTAO / transmission stay top-rung |
| Texture download not approved in time | medium | procedural 512 px fallback with the same recipe table; CC0 files drop in by id later |
| Bevels multiply triangles on large venues (3,000 chairs) | medium | bevel only above a size threshold and on levels ≥ 3; instancing kept; `HEAVY_CONFIG` falls back to plain boxes |
| Look spec too vague for a non-Fable port | medium | P6 requires numeric recipes (colours as tokens, roughness, light intensities, timings), not adjectives |
| Pointer lock inside the infrastructure iframe | high | drag-look default (Q5 א); verify on the real page in S5 |
| Phone performance unknown (no device measured) | certain | owner real-device row; ladder guarantees a usable view |
| Fable quota | medium | 20 h cap, checkpoint at 8 h; check usage before launch |

---

## 7. Launch checklist for the coordinator

1. Owner answers pasted from the form; record them under CR-029 §12 (answers block) in English.
2. Resolve C5 (T087) in `management/tasks.json`; run `python scripts/project_status.py --write`.
3. If Q6 / Q10 need downloads: prepare the file list (name, URL, size, licence) and get the owner's explicit approval.
4. Launch the Fable agent on `pilot/ST7-lookdev` with this document, CR-029 §13 and the answers; `model` set explicitly.
5. At the ~8 h checkpoint: show the owner the three frames; continue only on his go.
6. After P6: owner review of the before / after board; then schedule the product port per §3.
