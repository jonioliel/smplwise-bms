# ST7 look-dev — proposed CC0 asset download list (awaits owner approval)

**Status:** proposal, 2026-10-09. **Nothing on this list has been downloaded.** The look-dev continues with procedural
512 px textures and procedural furniture (owner Q10: both paths, switchable) until the coordinator relays the owner's
approval per file. Every approved file gets a row in `docs/design/mockups/plan-studio-6-prototype/LICENSES.md` (and
later `frontend/public/plan3d/MANIFEST.json`) with id, source URL, author, licence, download date, sha256, processing.

Rules applied (owner Q6, CR-029 §6.1): **CC0 only** — no attribution-required, no share-alike, no Sketchfab / TurboSquid /
CGTrader, no AI textures, no photographs of the owner's sites. ambientCG and Poly Haven publish everything as CC0
(site-wide statement); Kenney publishes its kits as CC0. Page existence and the 1K-JPG sizes marked "verified" were read
from the public pages on 2026-10-09 (page reads only, no asset download); sizes marked "≈" are the site's usual range
and must be read off the page at download time. **sha256: unknown for every file until downloaded** — it is written into
the manifest row at download time, never guessed.

Processing after download (same for every texture): 1K source → 512 px (and 256 px for the phone budget), colour as
WebP q85, normal as PNG, roughness + AO packed into one RG texture (CR-029 §6.2) — ~120-180 KB per 512 set. 1K masters
stay out of the repository.

## A. PBR material sets (ambientCG, CC0) — map to the CR-029 §6.2 ids

Download URL pattern: `https://ambientcg.com/get?file=<ID>_1K-JPG.zip` (the page is `https://ambientcg.com/view?id=<ID>`).
Each zip holds Color, NormalGL, Roughness, AmbientOcclusion (and Displacement) JPGs at 1024 px.

| # | Material id (product) | File | Source page | Size (1K-JPG zip) | Licence | sha256 |
|---|---|---|---|---|---|---|
| 1 | `plaster_white`, `plaster_ceiling` | `Plaster001_1K-JPG.zip` | https://ambientcg.com/view?id=Plaster001 | 7 MB (verified) | CC0 | unknown until downloaded |
| 2 | `plaster_exterior` | `Plaster003_1K-JPG.zip` | https://ambientcg.com/view?id=Plaster003 | ≈ 7 MB | CC0 | unknown |
| 3 | `concrete`, `floor_concrete` | `Concrete034_1K-JPG.zip` | https://ambientcg.com/view?id=Concrete034 | ≈ 6 MB | CC0 | unknown |
| 4 | `brick_painted` | `Bricks059_1K-JPG.zip` | https://ambientcg.com/view?id=Bricks059 | ≈ 8 MB | CC0 | unknown |
| 5 | `tiles_white` | `Tiles074_1K-JPG.zip` | https://ambientcg.com/view?id=Tiles074 | ≈ 6 MB | CC0 | unknown |
| 6 | `floor_oak` (`oak`) | `WoodFloor051_1K-JPG.zip` | https://ambientcg.com/view?id=WoodFloor051 | 5 MB (verified) | CC0 | unknown |
| 7 | `floor_tiles_grey` (`tiles_grey`) | `Tiles101_1K-JPG.zip` | https://ambientcg.com/view?id=Tiles101 | 6 MB (verified) | CC0 | unknown |
| 8 | `floor_carpet` (`carpet`) | `Carpet013_1K-JPG.zip` | https://ambientcg.com/view?id=Carpet013 | 10 MB (verified; a red carpet — the colour is replaced by the palette tint, only the weave is used) | CC0 | unknown |
| 9 | `floor_asphalt` | `Asphalt012_1K-JPG.zip` | https://ambientcg.com/view?id=Asphalt012 | ≈ 8 MB | CC0 | unknown |
| 10 | `floor_grass` | `Grass004_1K-JPG.zip` | https://ambientcg.com/view?id=Grass004 | ≈ 9 MB | CC0 | unknown |
| 11 | `door_wood`, `wood_light`, `wood_dark` | `Wood049_1K-JPG.zip` | https://ambientcg.com/view?id=Wood049 | ≈ 6 MB | CC0 | unknown |
| 12 | `door_metal`, `metal_dark`, `metal_light` | `Metal032_1K-JPG.zip` | https://ambientcg.com/view?id=Metal032 | ≈ 5 MB | CC0 | unknown |
| 13 | `fabric_grey`, `fabric_accent` (sofa, chairs) | `Fabric030_1K-JPG.zip` | https://ambientcg.com/view?id=Fabric030 | 11 MB (verified) | CC0 | unknown |
| 14 | `linen` (bedding, cushions) | `Fabric024_1K-JPG.zip` | https://ambientcg.com/view?id=Fabric024 | ≈ 8 MB | CC0 | unknown |
| 15 | `leather` (office chair) | `Leather011_1K-JPG.zip` | https://ambientcg.com/view?id=Leather011 | ≈ 7 MB | CC0 | unknown |
| 16 | `floor_sport` (parquet court, venues) | `WoodFloor040_1K-JPG.zip` | https://ambientcg.com/view?id=WoodFloor040 | ≈ 6 MB | CC0 | unknown |

Total download ≈ 115 MB of 1K masters (kept outside the repo); ≈ 3 MB in the repository after processing.
If a page id above turns out not to exist at download time, the nearest id in the same category is taken and the row
is corrected **before** the download — never a different licence.

## B. Furniture models (owner Q10: real models next to the procedural catalog)

| # | Use | File | Source page | Size | Licence | sha256 |
|---|---|---|---|---|---|---|
| 17 | ~20 of the 154 catalog items: sofa, armchair, chairs, dining / coffee / desk tables, beds, wardrobe, bookcase, TV cabinet, kitchen blocks, fridge, lamps (ceiling / pendant / floor), plant, WC, basin, bath, washer | `furniture-kit.zip` (one kit, ~140 models; GLTF/OBJ/FBX inside) | https://kenney.nl/assets/furniture-kit | ≈ 10-15 MB zip (page verified; size not shown on the page) | CC0 (verified on the page) | unknown |

Processing: pick the ~20 items by catalog id, keep the glTF (no Draco, no KTX2), decimate to ≤ 2,000 triangles each,
strip the kit's textures (the palette materials of the look spec are applied by material slot), ≈ 1-2 MB total in
`frontend/public/plan3d/models/`. Level 1-2 keep drawing the box (CR-029 §6.3); the models are a level-3 choice only.

Optional, only if the Kenney kit lacks a convincing sofa / bed (decide after unpacking):

| # | Use | Source page | Size | Licence | sha256 |
|---|---|---|---|---|---|
| 18 | sofa / armchair / bed, higher fidelity | https://polyhaven.com/models (filter: furniture; e.g. `sofa_02`, `armchair_01`, `bed_01` — exact slugs to confirm on the page) — 1K glTF variant | ≈ 5-15 MB each | CC0 | unknown |

## C. Not requested

- No HDRI (CR-029 §6.4: the sky is procedural), no fonts, no icons, no Sketchfab-class models, no photos.
- The contact-shadow blob, the wall-junction AO strip, the sky dome, the ground disc and the lamp glow are generated in
  code (gradient canvases) — no files.

## D. What happens on approval

1. The coordinator messages the agent with the approved row numbers.
2. The agent downloads only those files into a fresh, empty folder under the scratchpad, records sha256 + download date,
   processes to 512 px, copies the processed files into `docs/design/mockups/plan-studio-6-prototype/assets/` and adds
   the `LICENSES.md` rows in the same commit.
3. The material library serves the file set by id when present and falls back to the procedural set otherwise — the
   look spec recipes (tile_m, roughness, normal strength, palette tint) are identical for both, so nothing else changes.
