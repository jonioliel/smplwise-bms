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

See `shots/lookdev-gpu.json` (after), `shots/perf-gpu.json` (before, re-measured today at the start of the session) and
`shots/levers-gpu.json` (lever costs). Filled in §11 of `LOOK_SPEC.md` after the final run.
