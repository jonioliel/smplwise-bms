# Licence manifest — Plan Studio 6 prototype

Rule (CR-029 §6.1): nothing enters this folder without a row here. No image, model or font files are included.

| Asset | Source | Licence | Notes |
|---|---|---|---|
| three.js r0.186.1 (core + addons: OrbitControls, Sky, Reflector, EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, BufferGeometryUtils) | `frontend/node_modules/three` (npm `three@0.186.1`), bundled into `dist/studio6.js` by `build.mjs` | MIT — Copyright © 2010-2026 three.js authors | Same version the product ships; the bundle banner names it |
| Procedural textures (plaster, concrete, tiles, oak, carpet, fabric, linen, wood, metal, asphalt, grass) | Generated at load time by `src/materials.js` (value noise + Sobel normal maps) | Project code | No downloaded texture files; the CC0 library of CR-029 §6.2 replaces them in the product |
| Procedural furniture | `src/scene.js` (boxes / cylinders / spheres) | Project code | No glTF models |
| Demo house geometry | `src/data/demo-house.js` | Project code, synthetic | Not a real site |
| Fixture `sample-v2.json` | `contracts/fixtures/plan_geometry/sample-v2.json` (copied by `build.mjs`) | Project code | Verbatim copy, generated file |
| Fonts | System fonts only (`Heebo` / `Segoe UI` / `Noto Sans Hebrew` fallbacks via CSS) | — | Nothing embedded |
| Icons | Unicode glyphs only | — | |

Screenshots and GIFs in `shots/` are renders of the above.
