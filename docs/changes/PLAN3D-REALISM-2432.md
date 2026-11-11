# PLAN3D-REALISM-2432 - the realistic 3D look: room glow, studio backdrop, softbox environment

Branch `pilot/PLAN3D-REALISM-2432`, from `main` a5618fad6 (v2.42.1). No backend change, no migration, no change outside the 3D
(`frontend/src/map/`, two 3D specs). No version bump. Parallel work: `pilot/PLAN3D-POLISH-2430` (pills, viewport fit, name plates,
rim light, sky arc, pool lights at levels 2-3, context loss, auto-start rung) had no commits when this branch was cut and last
checked; the hunks here in `scene-three.ts` (12 small hunks) / `sw-plan-3d.ts` (3) are each marked `// PLAN3D-REALISM-2432`.
At the end of this work `origin/pilot/PLAN3D-POLISH-2430` had two commits (pills' state words, auto start at lite) that touch none
of this branch's files - no rebase was needed; its uncommitted work touches `scene-three.ts` on the import line next to this branch's
(line 22 vs 23: expect a trivial merge conflict there) and around setDescription / frame().

Owner target: a photoreal isometric multi-floor home dashboard - dark sky-gradient backdrop, cutaway walls, soft GI-like light,
lights-on glow per room, presence room tint, red marks for open doors / windows.

## Changes

### S1 - room glow (lights on, presence tint)

What: `room-glow.ts` (pure plan) + `room-glow-mesh.ts` (three). At level 3 every room with a state tint (`room:<zone>#lit`,
`#presence`, `#presence-ring` from the scene builder) gets an unlit light layer, on every rung:

- lit: warm floor pools - one per lamp of the room that is on (radius by lamp kind, weight by lumens) plus a broad fill - drawn with a
  multiplying blend (`dst x (1 + light)`), so the wood / tile keep their colour and grain (a first additive version washed the floor
  milky pink); a warm wash up the room's walls (vertical gradient x the strength of the nearest pool per 0.4 m segment), clipped by the
  section plane like the walls. Colour = the mean colour temperature of the lit lamps.
- presence: a cool inner-edge band (0.55 m), a faint fill (only when the room is not lit) and a low cool wash on the walls, weighted by
  the presence fade; the style's presence colour (`2767ed` light, `38bdf8` dark), recoloured on a style switch.
- Strengths follow the style and the night factor (`glowLook`), set in `applyTime`.
- Fade 450 ms (ease-in-out) when a room's weight changes across a rebuild of the same levels (`state()` carried into the next graph);
  the presence fade steps of the live path update the weights in place (`updateWeights`); no fade without motion (`motion=false`), on
  the first build, or across a level switch (deterministic captures).
- The thinned level-3 presence plate and ring (R3 G2) are no longer drawn - the glow replaces them. Levels 1-2 are unchanged.

Before / after: `evidence/PLAN3D-REALISM-2432/before/02-house-iso-night.png` vs `after/02-house-iso-night.png` (lit rooms beyond the 8
pool lights now read lit; the blue neon ring became a soft cool edge), `03/04` persp day / night, `06/07` lite rung.

Perf cost: see the table below (A/B in the same page, glow shown / hidden, interleaved). Draw calls +24 on the look-dev house level L0 (4 rooms with a glow, 12 meshes): <= 5 meshes per room, MeshBasicMaterial only - no light, no shader variant, no shadow caster, hidden from the GTAO
normal pass (`skipAO`).

Fallback: levels 1-2 (schematic / full) never build it; a room the inset cannot hold (a corridor under 0.28 m) is skipped; a room
without a lamp gets the fill pool only.

### S2 - backdrop and environment

What:
- The LDR sky dome is hidden in the orbit views (`applyBackdrop`): it went through the post chain's tone mapping and read grey; it stays
  for the walk and always feeds the IBL (PMREM from the dome scene).
- Three softbox panels in the dome scene only (`softboxLevels`): a bright neutral overhead panel and two side panels by day, a dim cool
  one plus a warm low one at night. They give the floors and the glass soft area-light highlights and the walls a top-down gradient;
  prefiltered once per sun step (no per-frame cost).
- New realistic setting `backdrop: 'sky' | 'studio'` (default `sky`, unchanged look). `studio`: the dark sky gradient (CSS radial,
  day stops easing to night by the night factor, never tone-mapped), no horizon band, the ground disc shrunk to 0.5 and darkened into a
  plinth. Exposed for now as the element property / attribute `backdrop` / `data-backdrop` on `sw-plan-3d` (not a stored dial: owner
  question 1).

Before / after: `before/01-house-iso-day.png` vs `after-studio/01-house-iso-day.png`, `after-studio/02-house-iso-night.png`.

Perf cost: the dome is one draw less in the orbit views; the softboxes only cost at PMREM time (on a sun step).

Fallback: `sky` stays the default; the walk always draws the dome.

### S3 - rig tuning (light style)

What: sun 1.3 -> 1.45, hemisphere .36 -> .30, day environment .50 -> .44 (the softboxes carry part of the fill), night environment
.22 -> .30 (the shell stays readable at night). Studio night centre glow a little brighter.

Tone mapping evaluated, not changed: Neutral vs AgX vs ACES on the same day / night views (`evidence/PLAN3D-REALISM-2432/tonemap/`).
AgX flattened and desaturated the wood and the lit rooms; ACES shifted hues and crushed the night. Neutral stays.

### Evaluated and not done (this round)

- PBR texture sets: the CC0 files (colour, NormalGL, packed AO + roughness) already exist per material (`public/plan3d/`); no new file
  was added (bundle size unchanged).
- Baked AO / lightmaps for the live view: the contact AO (junction strips, blobs), GTAO on the top rung and the stills' lightmaps
  (migration 0075) already exist; a per-load bake of the live graph would cost seconds on this GPU for a small gain over GTAO - not
  done.
- Window glass reflection on the lite rung, a grade pass (split toning), depth of field: not done - small on screen at the iso
  distances, a full-screen pass costs ~1 ms+ on the Intel UHD; the CSS grade and vignette stay.

## Performance (Intel UHD Graphics, ANGLE D3D11, 1280 x 800, headed Chromium, the look-dev house, level L0)

The workstation was at 100 % CPU from other agents during every run: absolute frame times swing by 2x between runs. The per-shot
table is therefore informative only; the glow's cost is the in-page A/B.

**Room glow, in-page A/B** (`evidence/PLAN3D-REALISM-2432/ab-glow.md`; the same view at 21:00 iso, glow hidden / shown,
9 interleaved pairs of `benchFrames(15)`, median; each frame is followed by a 1-pixel readback so the GPU finished it):

| Rung | Glow off ms | Glow on ms | Cost | Calls off | Calls on | Glow meshes |
|---|---|---|---|---|---|---|
| realistic | 90.87 | 93.61 | +2.7 ms (+3 %) | 398 | 422 | 12 (4 rooms) |
| lite | 39.16 | 40.36 | +1.2 ms (+3 %) | 146 | 168 | 12 (4 rooms) |

(`calls` counts every pass of the post chain, so one mesh counts more than once.) Without the glow the new graph draws 398 calls
against the old 404: the hidden dome and the dropped presence plates.

**Per shot** (`benchFrames(30)`, median of 3; `before/`, `after/`, `after-studio/perf.md`; the schematic rows' calls are the last
level-3 frame's - the counter only runs at level 3):

| Shot | Rung | Before ms | After ms | After studio ms | Calls before / after | Triangles before / after |
|---|---|---|---|---|---|---|
| iso day | realistic | 115.3 | 100.6 | 98.6 | 404 / 422 | 54,884 / 55,780 |
| iso night | realistic | 78.9 | 97.1 | 89.5 | 404 / 422 | 54,884 / 55,780 |
| persp day | realistic | 59.8 | 91.4 | 83.6 | 404 / 422 | 54,884 / 55,780 |
| persp night | realistic | 71.3 | 85.1 | 79.1 | 404 / 422 | 54,884 / 55,780 |
| both levels, iso day | realistic | 88.4 | 100.5 | 97.4 | 680 / 716 | 97,608 / 99,244 |
| iso night | lite | 31.2 | 35.7 | 39.7 | 150 / 168 | 19,172 / 19,188 |
| iso day | lite | 33.5 | 35.2 | 36.5 | 150 / 168 | 19,172 / 19,188 |
| demo | schematic | 9.1 | 8.6 | 8.7 | - | - |

The before / after spread (e.g. iso day 115 -> 101, persp day 60 -> 91) is machine load, not the change: the A/B above is the
measure. The realistic rung on this GPU is ~90 ms a frame (GTAO + MSAA + 2048 shadows) before and after; the lite rung ~35-40 ms.
The weak-device path is unchanged: levels 1-2 draw no glow and no softbox; the ladder (quality-ladder.ts, not touched) still steps
down by measured fps.

## Tests

| Command (from `frontend/`) | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` (after the last source change, 27ea0cae2) | 0 | clean |
| `SW_BASE_URL=http://127.0.0.1:4417/ npx playwright test tests/unit-plan3d-room-glow.spec.ts tests/unit-plan3d-sun.spec.ts tests/unit-plan3d-assets.spec.ts tests/unit-plan3d-real.spec.ts tests/unit-plan-3d-realistic.spec.ts tests/unit-plan-3d-look-r3.spec.ts tests/unit-plan-3d-quality.spec.ts tests/unit-plan-3d-state.spec.ts tests/unit-plan-3d.spec.ts --project=desktop --workers=2` (Vite dev server on 4417, headless SwiftShader) | 1 | 47 passed, 3 skipped (unit-plan-3d.spec.ts: two dev-server skips; look-r3 G10: mobile only), 1 failed: my new studio-backdrop test asserted the old plinth colours - fixed in the test |
| `npx playwright test tests/unit-plan3d-room-glow.spec.ts --project=desktop` (rerun after the fix) | 0 | 8 passed |
| Evidence harness `evidence/PLAN3D-REALISM-2432/harness/shots.spec.ts` (before / after / after-studio, headed GPU) | 0 | 3 runs, 9 shots each |
| Evidence harness `harness/ab.spec.ts` (glow A/B) | 0 | `ab-glow.md` |
| Evidence harness `harness/tm.spec.ts` (tone mapping comparison) | 0 | `tonemap/` |

The harness specs live under the evidence folder (they import the worktree by absolute path; a scratch config); they are not
product specs.

NOT_RUN: the full unit / evidence / pixel suites (by instruction); the runner gate; mobile / tablet projects of the changed specs.

## Pixel baselines to refresh (not updated here)

Every level-3 (realistic / lite) baseline changes: the room glow, the hidden dome, the softbox environment and the light-style rig.
Levels 1-2 baselines do not change (no level-1/2 code path changed). Candidates found by search:

- `frontend/tests/evidence-replay-3d.spec.ts-snapshots/` - the 12 level-3 pictures (Linux runner):
  `event-l3-lite-{desktop,mobile,tablet}-linux.png`, `history-l3-lite-day-*`, `history-l3-lite-night-*`,
  `history-l3-realistic-day-*` (each x desktop / mobile / tablet).
- Not affected: `docs/evidence/T087/visual/plan-3d-*-l1-*` / `-l2-*` (levels 1-2 only), `pixel-walk-touch` (the canvas is hidden),
  `pixel-wall-plan`.
- Stills (migration 0075 room masks / lightmaps) are baked from the realistic scene: a still baked after this change looks like
  the new level 3 (no stored still changes by itself).

## Owner questions (Hebrew)

1. הרקע מאחורי הבית במבט איזומטרי: האם להפוך את "רקע סטודיו" (שמיים כהים בהדרגה, בלי קו אופק) לברירת המחדל?
   א. כן, סטודיו כברירת מחדל לכולם. ב. רק בסגנון הכהה. ג. להשאיר שמיים, ולהוסיף בחירה בהגדרות התצוגה (דורש שינוי בשרת ובמסך ההגדרות - משימה נפרדת). ד. להשאיר כמו היום.
2. עוצמת התאורה בחדרים דולקים בלילה:
   א. כמו בצילומים. ב. חזקה יותר. ג. עדינה יותר.
3. סימון נוכחות (קצה כחול רך במקום הטבעת הכחולה):
   א. מתאים. ב. להחזיר את הטבעת החדה. ג. רך אבל בולט יותר.
4. השתקפות בזכוכית החלונות ופס צבע (grading) - לא נעשו בסבב הזה בגלל עלות על מחשב חלש. להמשיך?
   א. כן, בסבב הבא. ב. לא צריך.
