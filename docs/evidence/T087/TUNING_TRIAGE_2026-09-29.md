# T087 Plan Studio tuning pass - triage (2026-09-29)

Branch `pilot/T087-plan-tuning` from `g0/intake` at 3a1f845. Sources: the "0.1.89 list" and the "0.1.91 tuning list"
at the end of `.superpowers/sdd/2026-09-25-plan-studio-phase4/progress.md`, the phase-3 "0.1.87 tuning list"
(`.superpowers/sdd/2026-09-24-plan-studio-phase3/progress.md`, last line), the 0.1.87 hotfix deferrals
(`.superpowers/sdd/hotfix-0187/hotfix-0187-report.md`), `docs/operations/PLAN_STUDIO_PHASE4_CHECKLIST_HE.md` and
`.superpowers/sdd/2026-09-26-owner-followups/notes.md`. Each item was checked against the code of 3a1f845 and the
CHANGELOG 0.1.90-0.1.126.

Legend: size S (< 1 h), M (half a day), L (a day or more); risk to existing behaviour low / medium / high.

## 1. The 0.1.89 list

| # | Item | Still relevant? | Size | Risk | Outcome |
|---|------|-----------------|------|------|---------|
| 1 | The 3D keeps the previous floor's framing when the floor changes while in 3D | Yes: `sw-plan-3d` applied the preset once per mount; the floor map keeps the element mounted across floors | S | low | **Fixed** 010652e (`frameKey`) |
| 2 | An anchor on a removed level gets an unclipped cone (2D agrees) | Yes: `removeLevel` keeps anchors' `level_id`; canvas and scene builder clipped against the missing level's (no) walls | S | low | **Fixed** b9aaaea (`levelOrDefault`) |
| 3 | History / event `sceneDescription` getter rebuilds the anchor list and a `JSON.stringify` key per call | Yes (still a getter, read 3-4 times per render) | S | medium (a wrong memo key shows stale 3D) | Deferred: cost is microseconds for tens of anchors; the memo already prevents rebuilding the scene |
| 4 | Duplicated realign route in `routers/anchors.py` | Yes (byte-identical copy) | S | low | **Fixed** d2618fc (+ app-wide duplicate-route guard) |
| 5 | 0.1.87 hotfix item 9: `loadTree` guard for the select-tool connector inspector | Yes (`explore-plan-editor.ts` 1527 / 2325: no in-flight guard, a few duplicate `GET sites?tree` on quick clicks) | S | low | Deferred: no user-visible effect; only testable in a live spec |
| 6 | 0.1.87 hotfix item 10: the copy-from flake in `evidence-plan-studio` test 4 | Yes; same family as the autosave/publish race noted at 0.1.94 and the R10 "publish drops a 60-member group" finding | M | medium | Deferred: live-backend only; belongs with the queued R10 publish task |
| 7 | Owner questions (unlocked lock drawn closed; levels default) | No: answered 2026-09-26 (lock stays; `plan.levels` setting shipped in 0.1.89) | - | - | Closed |
| 8 | Phase-3 detection tuning list | See section 3 | - | - | - |

## 2. The 0.1.91 tuning list (owner's real scans)

Measured locally on the three private scans rendered at 3000 px (calibrated as in the ledger), detector strength 0.6.
There is no ground truth for the real scans, so the metrics are targeted ones against a hand-drawn private
reference kept outside the repository: walls whose middle lies outside the building footprint (all false by
definition), envelope recall (length of the exterior wall centrelines covered within 0.5 m laterally, and the share
covered by walls of kind `exterior`), and on floor 0 the horizontal walls inside the tribune area.

| # | Item | Size | Risk | Outcome |
|---|------|------|------|---------|
| 1 | Doors: 0 of ~40 found | M-L | high | **Not fixed, measured.** Door-sized gaps between collinear pieces: 7 / 27 / 13 (floors 0 / -1 / -2). The quarter arc at the gap's radius holds >= 60 % ink in 2 / 6 / 2 of them, and only 1 of those 10 has clear rings (the other arcs sit among leaf lines, text and neighbouring strokes that fill the 0.7 r / 1.3 r rings). Many doors leave no gap at all (thin frames bridged by the closing, or the wall pieces not found). Lowering the ring test would trade this for false doors in hatching (the reason for it); a real fix needs a different door model (leaf line + arc as one symbol), not tuning. |
| 2 | Thin hollow exterior walls missed | M | medium-high | **Shipped as hollow_v1 on `pilot/T087-hollow-walls`, see section 6.** Earlier: **prototyped, not shipped.** Pairing a thin segment with a parallel line 0.15-0.8 m away (same pen width, white between, soft ink) and moving it onto the middle lifted the real envelopes (floor 0 envelope as exterior 0.00 -> 0.68; floor -1 recall 0.76 -> 0.88, as exterior 0.26 -> 0.72), but it merged two solid walls 0.75 m apart with walls crossing between them (existing `test_t_junctions_near_the_corners...`, second picture) - geometrically the same as a hollow outline. Needs a discriminator (e.g. the inner ring's lines stopping at each other instead of running into the outer ring) and its own task. |
| 3 | Section / title / reference lines read as walls | S | low | **Fixed** 5fb9066 for strokes well outside the building. A dash of a section line that crosses into the building stays (known limit). |
| 4 | Tribune boundary lines read as walls | S | medium | **Fixed** 4dd59e1: horizontal walls in the tribune area 8 -> 4 (the rest are the central stair-landing lines). |
| 5 | 185 fragments on floor -1 | M | medium | **Partly fixed**: reference strokes and dashed lines dropped (5fb9066), tribune rule (4dd59e1): 185 -> 171. Not done: joining collinear pieces across a < 30 cm gap with no symbol (only 8 such gaps on floor -1; risk of joining across crossing walls) - deferred. |
| 6 | Pier stubs on floor -2 | M-L | medium | Deferred: proposing piers as column objects needs a new candidate kind in the detect/accept API and the acceptance screen. Also found: floor -2's facade between the piers is two faint hairlines (glazing), below every threshold - not a wall problem. |

### Before / after on the real scans (numbers only)

| Floor | Walls | Outside the building | Envelope recall | ... as exterior | Tribune lines | Openings (window / passage / door) |
|---|---|---|---|---|---|---|
| 0, before | 46 | 5 | 0.68 | 0.00 | 8 | 7 / 2 / 0 |
| 0, after | 36 | 1 | 0.68 | 0.00 | 4 | 7 / 2 / 0 |
| -1, before | 185 | 18 | 0.76 | 0.26 | - | 9 / 3 / 0 |
| -1, after | 171 | 12 | 0.76 | 0.26 | - | 8 / 3 / 0 |
| -2, before | 89 | 11 | 0.32 | 0.00 | - | 3 / 4 / 0 |
| -2, after | 80 | 3 | 0.32 | 0.00 | - | 3 / 4 / 0 |

Openings are reported, not scored (no ground truth on the real scans). Detection time stays at 2.5-6 s per scan at
3000 px on this workstation (60 s guard). Floor -2's envelope recall stays low: its facade between the piers is two
faint hairlines (glazing), below every threshold.

Synthetic metrics set (`tests/plan_detect_metrics.py`, calibrated and uncalibrated) before and after, identical:
walls recall >= 0.974, precision >= 0.969; doors 21/21; windows 17/17.

## 3. The phase-3 "0.1.87 tuning list"

None of these is mentioned as fixed in the CHANGELOG 0.1.90-0.1.126; none was reported by the owner.

| Item | Outcome / reason |
|------|------------------|
| Real-scan door arcs | See 2.1 (measured, not fixed). |
| Otsu cap at 200 | Relevant (floor 0's inner envelope line is lighter than the cap). Deferred: changes every mask; the hollow-wall pass reads the soft ink instead, which covers the case seen. |
| Deadline inside the DXF mapper; DXF collinear duplicates from two closed rooms; DXF double doors in a gap; annotation words / AIA modifiers; a backend "none" for a suggested block; crop clipping per coordinate; 409 `dxf_options_changed`; imported objects' label convention | Deferred: DXF path, no owner DXF in use. |
| Short bent stubs beside doors / corners; `PROFILE_MIN_SOLID` for windows of half a wall; labels beyond a corner via the pier rule; text rows >= 8 t; vertical stripes; text over walls; doors 15-30 cm from a corner; merged raw direction; perpendicular run-length thickness; `plan_stylize` / `plan_zones` `<` threshold | Deferred: synthetic-set minors from the phase-3 reviews; no owner report; each needs its own fixture. |
| Level filter as `level_id` for detection; the add-level dialog during an in-flight accept; no-edit DXF card spec; Ctrl+Y coverage; failed rights-call copy; a pure module for the mapping card; `AcceptRequest.edits` Pick types; selected candidate painted last; an "edited" visual state; DXF object candidates in the layer | Deferred: editor UI polish, not in this tuning scope. |
| Phase-2 carry-overs (focus centring for anchor-bound bodies, `focusedObjectId` on floor change, phone library under the plan, catalog `created_at` bound, link route scope + 404/403 order, link-back rewrite, stale docstring, dev-DB housekeeping) | Deferred: unrelated to detection; left for a Plan Studio polish task. |

## 4. Phase-4 checklist end notes and owner follow-ups

| Item | Outcome |
|------|---------|
| Hand-drawn tribune connector invisible in 3D (`plan-studio-panel.ts` kind select vs `scene-builder.ts` skip) | **Fixed** 6d3c733 |
| 3D culls an unset-level zone under a non-default filter while 2D keeps it | No longer relevant: the 0.1.96 fix round made an unset zone level the default level everywhere (`zoneOnLevel`) |
| Small selected objects covered by their stretch handles at low zoom | Still open (recorded in the 0.1.98 CHANGELOG); editor interaction, outside this pass |
| Checklist known limits (SVG/PNG export draws full cones, glass opaque to coverage, curved stairs straight, glTF without lights/labels, cones not pickable) | Design limits of phase 4, unchanged; not tuning items |
| Flaky `evidence-plan-studio(-2)` autosave/publish race; R10 publish drops a large group; round-10 SQLite lock storm | Separate queued tasks (live backend); not touched here (`db.py` is owned by another agent tonight) |

## 5. Verification (this branch, 4dd59e1)

- Backend: `pytest tests/test_plan_*.py` 236 passed (baseline before the pass: 229); `test_p2_batch.py` (realign) passed.
- Frontend: `tsc --noEmit` clean; `npm run build` built; unit specs `unit-plan-*`, `unit-scene-*`, `unit-geometry*`
  (desktop): 64 passed in one run with 9 WebGL cases timing out while the detector suite ran beside them; those 9
  (5 files) re-run alone with one worker: 23 passed.
- Detector: synthetic metrics identical before and after; real-scan numbers above (local, private files only).

## 6. Hollow walls - shipped (hollow_v1, 2026-09-29)

Branch `pilot/T087-hollow-walls` from `g0/intake` at c446891; detector 1.3. Code: `services/plan_detect_hollow.py`
(the rule and every threshold in its module docstring), wired into `plan_detect.detect` after the solid walls and
their reference-stroke rule; tests `tests/test_plan_detect_hollow.py`.

**Discriminator.** A hollow wall is two thin axis strokes of the dark ink (at most 5 px at the 1600 px working raster
AND thinner than the plan's median solid wall), 0.12-0.6 m apart centre to centre, cut into the stretches whose
interior holds no ink as dark as the strokes' cores (half way from the Otsu threshold to their median core grey - a
light scan's blur between two hairlines is not ink; hatching, room content, a glass line or a crossing wall is), not
a stack (no third stroke at 0.6-1.4 spacings beyond a line: treads, rows), at the plan's learnt spacing (length-
weighted mode, +-35 %), not a tribune railing (the tribune rule beyond either line), not the face lines of an opening
in a truly solid wall, at least 1.5 m long (or continuing one on its line), and linked to the building (end-to-body
or along its line to a solid wall; a group with no solid wall only when it turns and lies in the solid walls' box).
The kept stretch is one exterior wall on its middle line, as thick as the pair, `hollow: true` in the result (every
wall carries the flag), confidence at most 0.9; fused solid pieces inside its band are absorbed, solid pieces mostly
outside it stay and the stretch is cut around them.

**The T-junction case.** Two 12 px solid walls 0.8 m apart centre to centre (the existing
`test_t_junctions_near_the_corners...` second picture, unchanged and passing): the pass finds **0 strokes** (the
walls are as thick as the median wall, t_med 12 px, rule 1) and the spacing is above 0.6 m anyway (rule 2). The
prototype's merge came from pairing segments of the wall mask; hollow_v1 pairs raw strokes only.

**Real floors (local, private scans at 3000 px, strength 0.6; numbers only).** Envelope recall / as exterior against
the private hand-drawn reference (0.5 m lateral tolerance):

| Floor | Walls | Outside the building | Envelope recall | ... as exterior | ... as hollow | Hollow walls | Learnt spacing |
|---|---|---|---|---|---|---|---|
| 0, before | 36 | 1 | 0.68 | 0.00 | - | - | - |
| 0, after | 45 | 1 | 0.89 | 0.67 | 0.67 | 16 | 4.8 px (0.18 m) |
| -1, before | 174 | 12 | 0.76 | 0.26 | - | - | - |
| -1, after | 173 | 12 | 0.77 | 0.49 | 0.36 | 11 | 4.6 px (0.19 m) |
| -2, before | 80 | 3 | 0.32 | 0.00 | - | - | - |
| -2, after | 80 | 3 | 0.32 | 0.00 | 0.00 | 3 | 6.0 px (0.17 m) |

- Floor 0 per side (left / top / right): as exterior 0.86 / 0.77 / 0.35 (was 0 / 0 / 0). Floor -1 (top / right /
  bottom): 0.85 / 0 / 0.72 (was 0.51 / 0 / 0.31); its right side is drawn as solid dark lines 0.5 m off the
  reference line. Floor -2: its envelope reference is the glazing (two faint hairlines, below every threshold) and
  single lines between the piers - no pair; its 3 hollow walls replace 3 solid walls at the same place (heavy walls
  drawn as a double line with a light grey fill read hollow: known limit).
- False walls added: of 30 hollow walls, 19 lie on the envelope, 10 replace a solid-pass wall at the same place, 1 is
  new elsewhere (floor 0: it joins two solid pieces of one line across 1.1 m); outside-the-building counts unchanged.
- Openings: 6 windows of the base run are gone (floor 0: 4, floor -1: 2), all proposed by the profile pass on
  partly fused hairline pairs; 5 of the 6 positions were checked visually and show continuous lines with no window
  symbol (the sixth sits beside a small box symbol). No other opening changed.
- Door gaps: the hollow walls now break where the interior is inked, so openings appear as gaps between hollow
  pieces: floor 0 has 9 gaps (2 classified as passages as before, 4 door-sized unclassified), floor -1 6 gaps (3
  door-sized unclassified), floor -2 none. Of the 7 door-sized gaps, checked visually: 5 are pilaster boxes in the
  wall, 1 a wall notch, 1 a real double door (floor -1) - it now appears as a gap but its leaves are not arcs the gap
  pass classifies (see the door study). Doors found stay 0 / 0 / 0.
- Detection time (same machine, interleaved min of 3): quiet, 1.36 -> 1.66 s / 2.65 -> 2.92 s / 1.58 -> 1.95 s with
  the pass itself 0.39 / 0.89 / 0.30 s; under load (other agents running), 3.65 -> 4.83 s / 8.21 -> 8.75 s /
  4.86 -> 5.69 s with the pass 0.98 / 1.35 / 0.98 s. The pass checks the run's deadline between its stages (60 s guard).

**Synthetic set** (`tests/plan_detect_metrics.py`, calibrated and uncalibrated) before and after, identical: walls
recall >= 0.974, precision >= 0.969; doors 21/21; windows 17/17; no hollow wall on any of the six plans.

**Fixtures** (`test_plan_detect_hollow.py`): a hollow outline with a 0.9 m door gap and a 1.2 m window (four hollow
exterior walls; the door found as a door, the window as a window, both on hollow walls); a hollow outline meeting a
solid wall (corners on its centre line; the solid walls exactly as without the pass); two thin lines with hatching or
room content between them (no hollow wall, nothing on their line); a tribune railing (double line 0.2 m apart over
rows 0.9 m apart) and stair treads (each rejected by its rule - with the rule switched off they would pass); the
T-junction picture (0 strokes); the deadline inside the pass.

**Known limits.** Axis-parallel walls only; one spacing per plan (a second hollow-wall type is missed); floor 0's
wall is drawn as a hairline pair plus an inner line 0.6 m in - hollow_v1 reads the hairline pair (0.3 m thick,
~0.4 m off the drawn wall's middle), not the whole 0.8 m; a double line with a light grey fill reads hollow.

Verification: `pytest tests/test_plan_detect_*.py` 96 passed (88 before + 8 new).
