# ST7 look-dev — round 2 self-critique (2026-10-10)

Judged against the reference class the plan names (Planner 5D / Floorplanner 3D, Matterport dollhouse, modern
archviz iso renders, Apple Home / Google Home cards) using the six `checkpoint/` frames and the 30 + 30 `shots/lookdev/`
screens of round 1. Ordered by visible impact; each row says what was done in round 2 (numbers in `LOOK_SPEC.md`).

| # | Gap (round 1) | Where it shows | Round-2 fix |
|---|---|---|---|
| G1 | **Kit furniture reads as toys**: faceted low-poly shading, one flat colour per slot, chairs small next to tables, every chair identical | iso day/night, walk living, stand-at-camera | Creased vertex normals (smooth curved parts, crisp edges), per-slot material roughness (fabric .9 / wood .55 / metal .35), per-object luminance jitter ±5 % so repeats differ, proportion-preserving scale (uniform by height, ≤ 15 % per-axis stretch), tinted accent on cushions; procedural mode stays one click away |
| G2 | **Light-style day iso is flat and over-bright**: no GI, open-roof sun floods every floor, caps too black | iso day (both checkpoints) | Vignette + gentle S-curve / saturation grade as a cheap post pass (every composer rung), junction AO wider and darker, softer sun shadow (radius 8), lighter poché (`#3a3e46`) so the caps frame instead of dominate, exposure 0.68 → 0.62 |
| G3 | **Walls read as mottled grey concrete**: plaster detail amplitude too high at 2 m tiling, normal too strong | walk frames | plaster_white amp 14 → 7, normal .35 → .22; plaster_exterior amp 18 → 12 |
| G4 | **Windows are pale boards**: the dome horizon is almost white at eye level, nothing outside | walk frames | Horizon band (distant vegetation / terrain silhouette ring, 2 tones, 40-70 m) + a more saturated day horizon; glass tint `#cfe0ea`, opacity .22, env reflection 1.6; the lite rung keeps the cheap glass |
| G5 | **Dark style lacks depth**: interiors sink into one navy, no separation of planes | dark iso/walk | Cool rim light from the camera-opposite side (`#7cc8ff`, 0.55), floor sheen (roughness × 0.72 on floors in the dark style → env-map reflection reads as a wet-look floor without a Reflector pass), fog in the walk, cap edges 1 → 1.5 px |
| G6 | **Walk has no atmosphere**: uniform fill, no depth cue beyond the lamp pools | walk frames | Exponential fog per style (light `#dfe6ee` 0.028, dark `#0a1322` 0.045) in the walk only, vignette, lamp pool a touch warmer |
| G7 | **Shadows are hard-edged** on the realistic rung | iso day | PCF radius 5 → 8 (top rung), 1024 map on lite (fill-rate) with radius 3 |
| G8 | **Performance below the lite budgets**: 894 draws in the realistic walk, 273 in orbit; kit models cloned per object; door parts as ~12 meshes each | `lookdev-gpu.json` | Door leaves merged to 2 meshes (wood / metal), kit models instanced per (item, slot) with `InstancedMesh`, lamp parts merged, lite shadow map 1024, GTAO samples 8 → 6 on the top rung (look kept) |
| G9 | **UI chrome is clean but plain**: no hover feedback, labels pop in, bar chips same weight as the active one | all 1440 frames | Chip hover lift + active weight, label fade-in, bar / strip shadows, Hebrew sizes 13 → 13.5 px with tabular numerals on the time pill, 150-200 ms microinteractions (all in `index.html`) |
| G10 | **Kitchen / lamps / TV**: counters and island mix a kit module with procedural fronts; pendant shade flat; TV bezel heavy | kitchen walk, iso | Island back to procedural with the counters (one language per room), pendant shade gets the inner-glow emissive from the file material, TV bezel 12 → 8 mm with a darker glass face |

Not addressed in round 2 (and why): a real GI lightmap (release B of CR-029, hours not in this round), an HDRI sky (CR-029
§6.4 says procedural), fonts (no new downloads), real-device numbers (no device).
