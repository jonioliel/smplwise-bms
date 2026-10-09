# ST7 look-dev — before / after board

Before = the prototype as reviewed by the owner on 2026-10-05 ("much better, direction right, looks like the 90s"),
`origin/pilot/studio6-prototype`, `shots/*.png`. After = `pilot/ST7-lookdev`, `shots/lookdev/{light,dark}/*.png`,
same headless Chromium on the workstation iGPU, 1440 × 900 unless noted. The plan's L1-L12 diagnosis is the row key.

| # | Symptom (before) | Before shot | After shot(s) | What changed |
|---|---|---|---|---|
| L1 | Every object a sharp box | `shots/11-walk-living-room.png`, `17-walk-stand-at-camera.png` | `lookdev/light/11-walk-living-room.png`, `11b-walk-living-tv.png`, `13-walk-kitchen-after-tap-to-walk.png` | RoundedBoxGeometry families (sofa with cushions + tapered legs, chairs, tables, cabinets with seams + handles, beds, kitchen fronts, plants), skirting, door panels + casings + lever handles, sills + mullions, TV picture |
| L2 | Saturated primaries (royal-blue sofa / rug / TV, orange wood) | `01-realistic-iso-afternoon.png` | `lookdev/light/01-iso-day.png`, `lookdev/dark/01-iso-day.png` | Palette per style (`style.js`): greige walls, oak, charcoal metal, one muted accent per room; hue-free detail textures tinted by the palette |
| L3 | Flat bright interiors, no contact darkening, night = brown murk | `11-walk-living-room.png`, `03-realistic-iso-night-lamps.png` | `lookdev/light/03-iso-night-lamps.png`, `lookdev/light/10-walk-entrance-door.png`, `lookdev/dark/03-iso-night-lamps.png` | Neutral tone mapping, junction AO strips + blob shadows on every rung, GTAO 0.6 m low on the top rung, per-room daylight fill while walking, lamp levels per time band |
| L4 | Blurry textures, plank scale wrong, ceiling looks like a floor | `11-walk-living-room.png` | `lookdev/light/11-walk-living-room.png` | 512 px floors / walls, planks 0.2 × 1.2 m, tiles 0.6 / 0.3 m, plain matte ceiling (normal 0.04) |
| L5 | Windows = grey opaque boards | `11-walk-living-room.png` | `lookdev/light/11b-walk-living-tv.png` | Cheap glass on every rung (env reflection + 16 % opacity), sky dome + ground disc seen through |
| L6 | Iso hides the interior behind tall walls | `01-realistic-iso-afternoon.png` | `lookdev/light/01-iso-day.png`, `lookdev/dark/02-iso-sunset.png` | Section cut at 60 % with poché caps (light) / caps + luminous edges (dark) |
| L7 | Lamps = bloom blobs, haloed frame | `03-realistic-iso-night-lamps.png` | `lookdev/light/03-iso-night-lamps.png` | Bloom threshold 1.6-2.0 (light) / 1.0-1.2 (dark), radius .35-.45, emissive 1.6-3.4, pool 0.5-1.2, glow sprite .16-.42 |
| L8 | Jagged edges | any before shot | any after shot | MSAA ×4 (top rung) / ×2 (lite) on the composer target, SMAA fallback |
| L9 | 2018 admin UI: toggle list, HUD, chip rows, pill per room | `01-realistic-iso-afternoon.png` | `lookdev/light/01-iso-day.png`, `06b-temperatures-on.png` | Full-bleed canvas, floating translucent bars (time pill, floors strip, one view bar), HUD off, room names as floor text, temperature pills on hover / setting, toasts auto-hide, floors / areas tree with per-floor collapse kept |
| L10 | Phone wider than the viewport, controls cut | `21-mobile-walk-joystick.png` | `lookdev/light/21-mobile-walk-joystick.png`, `22-mobile-iso.png`, `22b-mobile-sheet-open.png` | Bottom sheet, floors row, scrolling bar, joystick + 3 floating buttons; `scrollWidth == innerWidth` at 390 / 820 / 1440 (`lookdev-gpu.json`) |
| L11 | Hard camera cuts | – (interactive) | `shots/lookdev/walk-through.gif` | 520 ms preset tween, flash on type / floor change, 650 ms fly-down into the walk, eased eye height and room fill |
| L12 | No ground / context | `01-realistic-iso-afternoon.png` | `lookdev/light/04-persp-both-floors-overcast.png` | Ground disc with a horizon fade, the building's sun shadow (top rung) and a contact shadow, dome sky |

Second style (owner Q12 ג): every after shot exists in `lookdev/dark/` as well — dark navy backdrop, cool charcoal
walls, lit rooms as the picture, cyan state tokens and cap edges.

## Walk checks (unchanged behaviour, both styles; `lookdev-gpu.json`)

Blocked at the closed office door (x stops at 3.16 before the door at 3.5), on the stair (level L0, eye rising), on L1
after the flight (the level-switch window is now judged from the band before the step, so a low frame rate cannot jump
over it), tap-to-walk through the open sliding door with 5 waypoints.

## Performance (same-session relative numbers; the workstation ran other sessions all day)

The table, the lever costs, the verdict against the plan's budgets (not met on this box today for the lite walk and the
realistic orbit; 55.6 fps on the 390 px lite walk) and the port rules that follow are in `LOOK_SPEC.md` §11. Files:
`shots/lookdev-gpu.json` (after), `shots/perf-gpu.json` (before, morning), `shots/perf-baseline-sameminute-gpu.json`
(before, measured in the same minute as `shots/levers-gpu.json`).

## CC0 assets (same day, after the owner's approval)

The final `shots/lookdev/` set and `checkpoint/` frames use the downloaded CC0 sets (`assets/textures/`, 21 ids over 16
ambientCG sets, 3.1 MB) and the Kenney furniture kit (`assets/models/`, 19 glTFs, 416 KB) with the palette applied per
material slot — both switchable back to the procedural sets in settings (`?procedural` forces both). What changed
visually: real plaster grain and wood / tile structure at the right scale in the walk; recognisable furniture
silhouettes (sofa, chairs, beds, bookcase, desk) at iso. What stayed procedural and why: lamps (devices), long kitchen
counters (one module stretched reads wrong), screens (emissive picture), the ceiling (a near-flat WebP showed block
artefacts).

## Known limits of the evidence

- `16-walk-upper-floor-after-stairs.png` is a wall close-up: the scripted walker holds W for 4.5 s and reaches the north
  wall of the gallery; the position row in the JSON (`[1.25, 1.34, 4.55, "L1"]`) is the check.
- The 390 px walk frames carry the kiosk idle toast: the capture's own pauses exceeded the 30 s idle default after a
  bake existed; a product wall display has that timer, a phone does not.
- No model files: `?testmodels` renders in-code stand-ins through the real loader path (31 placed, palette slots,
  authored sizes); the Kenney kit waits for the owner's download approval.
- SwiftShader: boots only; real devices: none measured.
