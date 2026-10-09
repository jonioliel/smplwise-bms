# Licence manifest — Plan Studio 6 prototype (look-dev)

Rule (CR-029 §6.1): nothing enters this folder without a row here. No image, model or font files are included;
every texture and gradient is generated in code at load time. The CC0 file set proposed in
`docs/design/studio6/ASSET_DOWNLOAD_LIST.md` has **not** been downloaded (awaits the owner); when it is, each file gets
its own row below (id, source URL, author, licence, download date, sha256, processing).

| Asset | Source | Licence | Notes |
|---|---|---|---|
| three.js r0.186.1 (core + addons: OrbitControls, Reflector, EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, SMAAPass, OutputPass, BufferGeometryUtils, RoundedBoxGeometry, GLTFLoader) | `frontend/node_modules/three` (npm `three@0.186.1`), bundled into `dist/studio6.js` by `build.mjs` | MIT — Copyright © 2010-2026 three.js authors | Same version the product ships; the bundle banner names it. The Sky shader is no longer bundled |
| Procedural detail textures (plaster, concrete, tiles, planks, carpet, fabric, linen, leather, wood, metal, grass) | Generated at load time by `src/materials.js` (value noise + Sobel normal maps), hue-free, tinted by the style palette | Project code | No downloaded texture files |
| Gradient textures (contact blob, wall-junction strip, lamp glow, screen picture) | `src/materials.js` / `src/scene.js` canvases | Project code | |
| Style palettes and light rigs | `src/style.js` | Project code | The LOOK_SPEC numbers |
| Procedural furniture | `src/scene.js` (rounded boxes / cylinders / spheres) | Project code | No glTF models |
| Model manifest + loader path | `src/models.js` | Project code | Maps item ids to the (not yet downloaded) Kenney furniture kit files; `?testmodels` serves an in-code block instead |
| Demo house geometry | `src/data/demo-house.js` | Project code, synthetic | Not a real site |
| Fixture `sample-v2.json` | `contracts/fixtures/plan_geometry/sample-v2.json` (copied by `build.mjs`) | Project code | Verbatim copy, generated file |
| Fonts | System fonts only (`Heebo` / `Segoe UI` / `Noto Sans Hebrew` fallbacks via CSS) | — | Nothing embedded |
| Icons | Unicode glyphs only | — | |

Screenshots and GIFs in `shots/` and `docs/design/studio6/` are renders of the above.
