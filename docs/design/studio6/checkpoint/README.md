# ST7 look-dev — owner checkpoint (~hour 8; frames re-rendered after the CC0 assets landed)

Re-rendered 2026-10-09 (evening) with the owner-approved CC0 textures and the Kenney furniture kit (both switchable in settings) from `docs/design/mockups/plan-studio-6-prototype/` (branch `pilot/ST7-lookdev`, `tools/checkpoint.mjs`,
headless Chromium on the workstation's Intel UHD iGPU, 1440 × 900, realistic rung). Both styles, three frames each:

| Frame | Light architectural (`light-*`) | Dark digital twin (`dark-*`) |
|---|---|---|
| 1 | `light-1-iso-day.png` — iso, 15:30, clear | `dark-1-iso-day.png` |
| 2 | `light-2-iso-night-lamps.png` — iso, 22:30, lamps on | `dark-2-iso-night-lamps.png` |
| 3 | `light-3-walk-living.png` — eye level 1.65 m, living room, 16:00, floor lamp on | `dark-3-walk-living.png` |

## What the frames already show (P1 + P2 + most of P3)

- Section cut ("dollhouse"): walls clipped at 60 % of the ceiling with a dark cap (poché); the dark style adds a
  luminous cap edge. The walk never cuts.
- Khronos Neutral tone mapping (AgX was tried and rejected as too flat), MSAA ×4, bloom only on emitters, GTAO tuned to
  0.6 m / low intensity on the top rung only.
- Contact darkening without GTAO: a junction strip along every wall base (floor + wall side) and a blob shadow under every
  object — on the lite rung too.
- Ground disc with the building's sun shadow and a contact shadow; sky dome + exterior seen through the windows.
- Palette per style (style.js), hue-free detail textures at real tile sizes (oak plank 0.2 × 1.2 m, grey tile 0.6 m,
  white tile 0.3 m); one muted accent (sofa) per room.
- Rounded furniture families (sofa with cushions and tapered legs, chairs, tables, cabinets with seams and handles,
  beds with duvet and pillows, kitchen with worktops and seams, plants, sanitary, appliances), skirting boards,
  pendant shades with an inner glow.
- Lamps: plausible emissive levels per time band; the room's pool light is the state cue in the cut view.

## Since the first checkpoint (same day)

P3-P6 landed (door / window detail, floating chrome, bottom sheet on phones, motion, walk polish, settings list), then the
CC0 assets: real ambientCG material sets by id and 19 Kenney models by item id, palette-tinted; `shots/lookdev/` holds
the full §2.1 screen list in both styles.

## What the first checkpoint frames did NOT show (now done)

- P3 remainder: door leaves with panels, door casings, window sills / mullions, the TV picture.
- P4: the UI chrome is still the prototype's (fallback note over the scene, temperature pill on every room, walk bar
  overlapping chips, HUD) — floating toolbars, hover-only pills, bottom sheet on the phone, motion, both UI themes.
- P5: FOV per device, eye-height easing, door clearance, crosshair hint.
- The real-model furniture path (loader + manifest, switchable) and the CC0 textures (await the download approval).

## Settings the frames imply (for the look spec)

style (light / dark / follow theme), section-cut fraction (0.6), time of day (site clock / slider / now), eye height.
