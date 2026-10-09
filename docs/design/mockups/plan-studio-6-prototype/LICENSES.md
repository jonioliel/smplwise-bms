# Licence manifest — Plan Studio 6 prototype (look-dev)

Rule (CR-029 §6.1): nothing enters this folder without a row here. Every downloaded file below was approved by the owner
(`docs/design/studio6/ASSET_DOWNLOAD_LIST.md`, question 3 answer A, 2026-10-09), fetched on **2026-10-09** from the listed
CC0 source only, hashed before unpacking, and processed by the tools named. The 1K masters (zips, 125 MB) stay
**outside the repository**; only the processed 512 px textures (`assets/textures/`, 3.1 MB) and the 19 selected glTF
models (`assets/models/`, 416 KB) are committed.

## Downloaded sources (CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/)

ambientCG (https://ambientcg.com, "All assets are released under the Creative Commons CC0 license"); download URL
`https://ambientcg.com/get?file=<file>`; each zip holds Color / NormalGL / NormalDX / Roughness / Displacement (+ AO on
some sets) JPGs at 1024 px plus .blend/.mtlx/.usdc/.tres helpers (unused).

| File | Size (bytes) | sha256 | Used for material ids |
|---|---|---|---|
| `Plaster001_1K-JPG.zip` | 7,414,156 | `944b4831016e42ace4a89422e4e7190912ca2f7fed6f561354c48ec7bb54d3a4` | `plaster_white`, `plaster_ceiling` |
| `Plaster003_1K-JPG.zip` | 7,879,772 | `3a47249643273c82c53d8d31c9caef43aec940a4c926cf0c74858a8e96631bf1` | `plaster_exterior` |
| `Concrete034_1K-JPG.zip` | 3,657,575 | `5839d284d94ffb8d2a56df742ec522b13dd311c52dbd42b8fd33f0409ceedb81` | `concrete` |
| `Bricks059_1K-JPG.zip` | 8,271,312 | `847dd2e4932563bbb67fdc2bad3cc08db72d74b3e81d242f31b663d8a3ea744b` | `brick_painted` |
| `Tiles074_1K-JPG.zip` | 3,706,371 | `28a40cb36d3c265f17c798c52aa3ea7cdcb8c949b80c49692b0a855e9637c677` | `tiles_white` |
| `WoodFloor051_1K-JPG.zip` | 5,104,319 | `3f493484eab1ec5e1c466b90e515003b286fc6d7f84ff8ff6485900bfc26cef5` | `oak` |
| `Tiles101_1K-JPG.zip` | 5,942,649 | `8f877d511a00b905ae239ada8454d84de097704e8716acd7802150522127a1bf` | `tiles_grey` |
| `Carpet013_1K-JPG.zip` | 11,001,883 | `77254e2877771524423a6ef8ce2e61aa3ec42ee5962d81d9b328a258afed7e1e` | `carpet` |
| `Asphalt012_1K-JPG.zip` | 8,507,722 | `c077e5d1b21a4333829bb655043ee6a45ddcf82fef850528f91f4305ac11193d` | `asphalt` |
| `Grass004_1K-JPG.zip` | 11,003,149 | `4b63495f459db8481f4d5144e4e9069345c81cf898cc71f2216f5dd3bb344469` | `grass` |
| `Wood049_1K-JPG.zip` | 6,784,006 | `74ec51bcf5ddfc2e9af6205dc5cbcc90ad51c22117e013ff8b1c7258f8ecbc69` | `wood_light`, `wood_dark`, `door_wood` |
| `Metal032_1K-JPG.zip` | 3,650,556 | `9e4f363905a647958c273154fa125d2a6440892d0e583f9b3af24bb08b5afc3c` | `metal_dark`, `metal_light` |
| `Fabric030_1K-JPG.zip` | 11,064,340 | `82d4d00ccf901cf4707c5489005945ab8574933fc60437e26c6737f0436699e0` | `fabric_grey`, `fabric_accent`, `fabric_rug` |
| `Fabric024_1K-JPG.zip` | 8,668,140 | `098a5f496cc67a4042e6394a950bee52d303740bc63d431e172d3cb49e4428da` | `linen` |
| `Leather011_1K-JPG.zip` | 5,605,677 | `e499febfd8b696cec89eff289fc85d7735440c0d4862171104974b3a04b8cc1d` | `leather` |
| `WoodFloor040_1K-JPG.zip` | 5,913,872 | `c83a01f1733f2a1f6e95ad6703689eb12fe259e77245d4c0a5652728d07c87cb` | `floor_sport` |

Kenney (https://kenney.nl/assets/furniture-kit, "Furniture Kit 2.0", 2018-10-20, `License.txt` inside the zip: CC0,
"Support us by crediting Kenney or www.kenney.nl (this is not mandatory)"); download URL
`https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip`.

| File | Size (bytes) | sha256 | Used |
|---|---|---|---|
| `kenney_furniture-kit.zip` | 5,130,729 | `e67652d0932cee41683f74711c03d3e192a2af9979ef8e6b237711f5482d46b0` | 19 of the 140 glTF models (list below); the kit's PNG textures are not used (palette slots instead) |

Sizes on the ambientCG pages matched the downloads (Plaster001 7 MB, WoodFloor051 5 MB, Tiles101 6 MB, Carpet013 10 MB,
Fabric030 11 MB; the others were not stated on the pages and are recorded above as received).

## Processed files in the repository

| Asset | Source | Licence | Processing / notes |
|---|---|---|---|
| `assets/textures/<id>/color.webp` (22 ids) | ambientCG Color maps above | CC0 | `tools/process-textures.mjs`: 1024 → 512 px, converted to a hue-free luminance detail map (mean → `mid`, 2σ → `amp` per id, LOOK_SPEC §13) so the style palette supplies the colour; WebP q85, 3-95 KB each |
| `assets/textures/sets/<Set>/normal.jpg` (16 sets) | ambientCG NormalGL maps | CC0 | 512 px, JPEG q92 (ambientCG ships JPG normals; PNG tripled the repo cost), 29-70 KB |
| `assets/textures/sets/<Set>/rough_ao.jpg` (16 sets) | ambientCG Roughness (+ AmbientOcclusion where the set has one) | CC0 | R = AO (255 when the set has none), G = roughness, B = 255; three.js reads `aoMap.r` / `roughnessMap.g` from the one file; 512 px, JPEG q90 |
| `assets/textures/MANIFEST.json` | generated | — | id → set, mid, amp, source mean/σ, has_ao, byte sizes |
| `assets/models/*.glb` (19 files: bathroomSink, bathtub, bedDouble, bedSingle, bookcaseOpen, cabinetBed, cabinetBedDrawer, cabinetTelevision, chair, chairDesk, desk, kitchenCabinet, kitchenFridgeLarge, lampRoundFloor, loungeSofa, plantSmall1, table, tableCoffee, toilet, washerDryerStacked) | Kenney Furniture Kit `Models/GLTF format/` | CC0 | Copied verbatim (72-992 triangles, 6.6-64 KB each; no Draco, no KTX2, no embedded images); material slots are replaced by the style palette at load (`src/models.js` MODEL_MANIFEST). `lampRoundFloor.glb` is present but unmapped (lamps stay procedural devices) |
| three.js r0.186.1 (core + addons: OrbitControls, Reflector, EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, SMAAPass, OutputPass, BufferGeometryUtils, RoundedBoxGeometry, GLTFLoader) | `frontend/node_modules/three` (npm `three@0.186.1`), bundled into `dist/studio6.js` by `build.mjs` | MIT — Copyright © 2010-2026 three.js authors | Same version the product ships; the bundle banner names it |
| Procedural detail textures (fallback set; `textureSource: procedural`) | Generated at load time by `src/materials.js` (value noise + Sobel normal maps) | Project code | Same ids, same tint table |
| Gradient textures (contact blob, wall-junction strip, ground alpha, lamp glow, screen picture) | `src/materials.js` / `src/scene.js` canvases | Project code | |
| Style palettes and light rigs | `src/style.js` | Project code | The LOOK_SPEC numbers |
| Procedural furniture (fallback per item; `furnitureMode: procedural`) | `src/scene.js` (rounded boxes / cylinders / spheres) | Project code | |
| Demo house geometry | `src/data/demo-house.js` | Project code, synthetic | Not a real site |
| Fixture `sample-v2.json` | `contracts/fixtures/plan_geometry/sample-v2.json` (copied by `build.mjs`) | Project code | Verbatim copy, generated file |
| Fonts / icons | System fonts, Unicode glyphs | — | Nothing embedded |

Not downloaded: anything outside the approved list (no Poly Haven models — the Kenney kit covered the sofa / bed need;
row 18 of the list stays unused), no HDRI, no photos. Screenshots and GIFs in `shots/` and `docs/design/studio6/` are
renders of the above.
