# Material dials - mockups (MD1, phase 1)

Static HTML mockups for roadmap idea 2 ("material dials": `depth`, `tint` and `material` presets Frosted / Paper / Chalk / Neon
in `ui.look`, a 1 px bevel rim, state-tinted tiles). Design only: no product code, no migration, no device access. Owner rule
(2026-10-02): not every reference idea is adopted; evaluate, show mockups first. This document is the evaluation.

Open `index.html` in a browser. It is static (no build, no network; the Heebo subset is the approved Bubble taste mockup's
`fonts.css`, the palettes are `palettes-data.js`, generated from `docs/design/palettes/palettes.json`). It works from `file://`
or from any static server, for example `python -m http.server 8731` in `docs/design/` and then
`http://127.0.0.1:8731/compare/material-dials/index.html`. Every switcher is kept in the URL, so a state can be shared:
`?preset=frosted&depth=1&tint=1&skin=bubble&theme=dark&palette=teal-green&surface=glass&radius=pill&perf=lite&touch=44&width=phone&op=62`.

Regenerate the palette data after a palette change (from the repository root):
`py -3.12 -c "import json;d=json.load(open('docs/design/palettes/palettes.json',encoding='utf-8'));open('docs/design/compare/material-dials/palettes-data.js','w',encoding='utf-8').write('// Generated from docs/design/palettes/palettes.json (do not edit; regenerate with the one-liner in README.md)\nwindow.SW_PALETTES = '+json.dumps(d,ensure_ascii=False,separators=(',',':'))+';\n')"`

## What the gallery shows

| Section | Screen | What to judge |
|---|---|---|
| 1 | Home: area tiles with the floors/areas tree | the tone wash per state, the rim, the lift; off and unavailable tiles stay neutral; the state word and dot stay |
| 2 | Device list (`density=row`) with the tree | the tone lives in a side stripe and the icon ring, not on the row (set tint = strong to see why a washed row fails) |
| 3 | Security chrome strip + camera grid | the chrome (strip, tree, dock) is the only place that keeps `backdrop-filter` in the lite tier; video gets no material |
| 4 | Dense events table | the material stops at the table frame; rows are rows with hairlines, no wash, no blur |
| 5 | Overlap panel | the same tile under today's Bubble `surface=glass`, Frosted, depth + tint alone, and today's Domus |
| 6 | Cost summary | see below |

Switchers: material preset (new), depth (new), tint (new), skin (Bubble / Domus / Classic), theme, palette (Bubble only: the ten
palettes are Bubble data), and the existing dials that interact with the material: surface, transparency, radius, performance,
touch target (32 / 44), plus a desktop / phone-390 frame width.

Binding rules checked in the mockup: RTL Hebrew; light and dark; Bubble, Domus and Classic; ten palettes; performance tier
(default `lite`: no `backdrop-filter` on tiles, rows and tables, only on the strip, tree and dock); touch 32 / 44 (44 is forced
at or below 1100 px); the radius dial; clean operator screens inside the frames (no hints, badges or paragraphs; the captions
are gallery chrome outside the frames); the tree in every tiled and listed screen; list and table views present; nothing floats
over content (the dock is a grid row). The light source of the sheen is physical (top-left) in both directions; it is decoration,
not geometry, so it is not mirrored, the same as video and maps.

## How the material is built (one formula)

Everything is custom properties on `:root`; a preset only changes the numbers, `depth` and `tint` multiply them. Any element can
carry the attributes (a settings preview box can show a draft), as the Bubble dials do today.

| Property | Frosted | Paper | Chalk | Neon | Multiplied by |
|---|---|---|---|---|---|
| `--m-sheen` (top-left white radial) | .07 | .03 | 0 | .05 | depth |
| `--m-shade` (bottom-right dark radial) | .06 | .04 | 0 | .08 | depth |
| `--m-rim` (bevel: inset 1 px top highlight, inner light edge, inner dark edge) | 1 | .5 | 0 (ink outline instead) | 1.2 | depth |
| `--m-lift` (outer drop shadow) | .45 | .22 | 0 | .5 | depth |
| `--m-wash` (135deg wash from the state tone, with a tone inner bottom glow) | 28 % | 18 % | 14 % | 34 % | tint, and only on tiles whose state carries a tone |
| `--m-blur` (chrome always; tiles only in the full tier) | 20 px | 0 | 0 | 14 px | - |
| `--m-glow` (outer bloom in the tone) | 0 | 0 | 0 | 16 px | - |
| grain (160 px SVG fractal noise, ~5 % alpha) | on | off | off | off | - |
| suggested transparency (existing dial) | 62 | 96 | 60 | 56 | - |

`depth`: 0 = off, 1 = normal, 2 = x1.8. `tint`: 0 = off, 1 = soft, 2 = x1.8. There is no `clarity` dial: the existing
`transparency` dial already is the sheet alpha, the preset only suggests a value and the slider keeps ownership.

Where the tone comes from: a tile sets `--tone` from the palette's entity colours (`entity.light` ...) or the state colours
(`state.success` for locked / ok, `state.warning` for open, `state.danger` for alarm) and `--wash: 1` only when its state carries
meaning (on, locked, open, live, alarm). Off, unavailable and idle tiles have no wash. `surface=gradient` disables the wash (two
colours on one tile fight). `surface=fill` keeps the wash in the filled part only.

Licence: the formula, the numbers and the markup here are our own, written for this mockup. The layer order (sheen, shade,
wash, rim) is a general description of thick glass found in the public research document (`GLASS_DASHBOARDS_ANALYSIS.md`,
branch `pilot/design-glasshome-research`); no stylesheet, token file, asset or text of GlassHome (proprietary app, MIT `ui` repo
not copied, so no notice is required) or Magic Frame (Polyform Noncommercial: inspiration only) was copied.

## Recommendation (honest)

### Build (phase 2, with the Bubble releases, after the palettes and the colour editor)

1. **`depth` dial** (0 / 1 / 2). This is the one thing the references have that we do not: the bevel rim plus a soft lift turn
   the flat Bubble pill into a thick glass tile at zero structural cost - five `box-shadow` lines and two background layers, no
   blur. It reads well in light and dark, on all ten palettes (checked in the gallery: teal-green, amber-sand, deep-ocean,
   high-contrast have the weakest rim in light because the surfaces are already bright; still visible through the dark inner edge).
   Applies to tiles, cards, the tree panel, the strip and the dock. Not to table rows or list rows (they get a hairline only).
2. **`tint` dial** (0 / 1 / 2) for **tiles only**. State on the surface is the strongest idea in the reference and it fits our
   "state = shape + word, never colour alone" rule as long as the dot and the word stay (they do). In lists the tone goes to the
   6 px side stripe and the icon ring, never to the row (section 2 at tint = strong shows why: seven coloured bars are a chart,
   not a list). Tables: dot + word only, as today.
3. **`material` as two presets: `frosted` and `paper`**, implemented as macros over existing and new dials
   (`surface`, `transparency`, `depth`, `tint`, plus the grain flag for frosted). No separate values of their own, so the settings
   card stays one card and a preset never fights the dials: choosing a preset writes the dials, then the dials are free again.
   `paper` is the wall-tablet material: near-opaque, no blur anywhere except the chrome, a half rim; it is the correct default for
   `performance=lite` devices. `frosted` is the Bubble glass we already have plus rim, grain and wash.

### Drop

- **Chalk.** An irregular ink outline on a security and building-management product reads as a toy; it also breaks the rounded
  corner guard (text and the double outline meet in the corners at small radii) and has no meaning to carry. The gallery shows it
  so the owner can see the verdict, not as a candidate.
- **Neon.** The outer glow is paint outside the box (the layout guard reads it as floating over the neighbour), costs a full
  extra shadow pass on every tile, and competes with the alarm tone: a glowing lamp tile and a glowing alarm tile look alike at
  a distance. The one place a glow earns its keep, "on" tiles in the dark, is already covered by `tint` = strong on a dark palette.
  If the owner still wants it later it is a third preset over the same dials (`--m-glow`), nothing structural.
- **A `clarity` or `blur` dial.** They are the existing `transparency` dial and `performance` tier; a second knob for the same
  thing is the kind of overlap the roadmap already flagged.

### Overlap with Bubble and Domus

- Bubble `surface=glass` + `transparency` is exactly the base layer of Frosted; Domus is one fixed point of the same formula
  (sheet alpha .52, a pale border, flat top highlight, no wash). So the dials belong to **both** glass-capable skins through the
  shared token layer, not to a fourth skin; Classic ignores `depth`'s rim (it keeps its own border and `shadow-1`) and may take
  `tint` on tiles only. Section 5 shows that `depth` + `tint` alone, without any preset, give most of the difference; the presets
  are convenience names.
- The `crystal` skin (roadmap idea 3) would add only a wallpaper pipeline on top of this; after `depth` and `tint` exist the
  remaining delta is the photo background, which is why the lead's view stays: dials first, `crystal` last and behind a mockup.

### Cost (estimate, phase 2)

| Item | Work | Estimate |
|---|---|---|
| `depth` | dial in `look.ts` / `look.py` (lists, ranges, 422), the attribute on `<html>`, the token bundle in `css.ts`, applied to the shared `.mat`-like surfaces of sw-card, the home tiles, the tree panel, the strip, the dock; Domus mapping | ~2 h |
| `tint` | dial as above; a per-entity tone token already exists in the palette mapping (`--sw-ent-*`); tile rule + list stripe rule; a tone table state -> token | ~3 h, plus the contrast check |
| `material` (frosted, paper) | a choice dial whose change writes the other dials (one function in `system-look.ts`), grain data URI as a token, settings card copy | ~2 h |
| Evidence | `evidence-bubble-*` specs: 2 skins x 2 themes x 3 presets (none, frosted, paper) at 390 / 1440; layout guard runs on the same matrix; `validate_palettes.mjs` extended with "text on washed surface" pairs (text over `tone` at 28 % and at 50 % over `surface`) | ~4 h |
| Docs | SKIN_AUTHORING_HE.md section on the material layer; TOKEN_CONTRACT.md rows; bilingual release note with how to enable | ~1 h |

Total about 12 h for depth + tint + two presets with evidence; no migration (the `ui.look` value is a JSON object, new keys are
optional and fall back to the installation default, as every dial does today: `depth=1`, `tint=1`, `material=none` as the
built-in defaults keep the current Bubble pixels unchanged until an owner turns a dial).

## What was not verified (phase 1 limits)

- Contrast of text on washed tiles was judged by eye in the gallery only, not measured. The wash is capped at 28 % (soft) and
  50 % (strong) of the tone over the surface; the strong setting on the amber and coral palettes in light mode is the pair most
  likely to need a floor. Phase 2 extends `validate_palettes.mjs` before the dial ships.
- The layout guard was not run (no Playwright on this machine); the mockup follows the rules by construction (touch sizes
  through `--touch`, the dock as a grid row, no sticky controls over content, tables scroll inside their frame on a phone).
- Rendering was checked in headless Chrome (1280 and 430 wide, light and dark, all presets, Bubble / Domus / Classic, and the
  teal-green and amber-sand palettes). Safari and Firefox were not checked; `color-mix()` and `calc()` inside colour alphas are
  used, both supported since 2023; the product code should precompute the mixed colours as tokens instead, as the palette
  mapping does today, so no runtime dependency on `color-mix()` is introduced.
