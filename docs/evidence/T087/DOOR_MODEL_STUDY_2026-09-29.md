# T087 door model study (2026-09-29)

Branch `pilot/T087-door-model` from `g0/intake` at ec84af9. Follows `TUNING_TRIAGE_2026-09-29.md` item 2.1 (doors:
0 of ~40 found on the owner's three scans). Outcome: **STOPPED by the stop rule** - a second door model (`arc_v2`) is
implemented behind the detect request's `door_model` flag (off by default, nothing changes for existing users), but on
floor 0 it finds 0 of 8 sampled doors at its shipped thresholds and at most 2 of 8 (with 41 false candidates) at the
loosest ones.

Private material: the three PDFs are raster-only (one embedded 8-bit scan each, 3508 x 2480 = A4 at 300 dpi, no
vector drawing). They were rendered at 3000 px (as the upload path does) into the local scratchpad; doors were sampled
by eye there. Nothing from them (pictures, crops, coordinates) is in the repository - numbers only below. Calibrations
as in the tuning pass.

## 1. What the doors look like (24 sampled doors, 33 leaves)

The sample is every door symbol that could be identified with confidence on each floor (8 per floor; the task asked for
10-15, the scans do not show more unambiguous ones outside the toilet blocks, whose stall doors are 0.6 m symbols at
the resolution limit). Measured at the render (3000 px) and at the detector's working raster (1600 px).

### 1.1 Symbol conventions per floor (doors)

| Symbol | Floor 0 | Floor -1 | Floor -2 | All |
|---|---|---|---|---|
| Leaf at 90 degrees + quarter arc (single) | 2 | 2 | 1 | 5 |
| Double door, two 90 degree leaves + two quarter arcs | 0 | 2 | 1 | 3 |
| Leaf at 90 degrees + straight chord tip-to-latch (a triangle, no arc) | 0 | 0 | 5 | 5 |
| Single leaf open at 30-50 degrees, no arc (stall doors) | 4 | 1 | 0 | 5 |
| Double door as a "V": two leaves at about 45 degrees meeting, no arcs | 2 | 2 | 1 | 5 |
| Stylised double drawn later in a darker grey overlay | 0 | 1 | 0 | 1 |
| **Doors with any arc** | **2 / 8** | **4 / 8 (+1 stylised)** | **2 / 8** | **8-9 / 24** |

### 1.2 Per-door measurements

| Measure | Floor 0 | Floor -1 | Floor -2 |
|---|---|---|---|
| Door-sized gap in the wall mask (mask covers < 30 % of hinge -> latch) | 4 / 8 | 6 / 8 | 7 / 8 |
| Arc present (by eye) | 2 / 8 | 4 / 8 | 2 / 8 |
| Arc ink ratio on the detector's thin mask, arc leaves (min / median) | 0.92 / 0.96 | 0.25 / 0.83 | 0.83 / 1.00 |
| Arc radius / door width (leaf length / hinge-latch distance), arc doors | 1.00 | 0.94-1.14 | 0.96-1.00 |
| Leaf length / door width, "V" and 45 degree leaves | 1.34-1.38 | 1.21-2.02 | 1.37-1.47 |
| Leaf angle of the no-arc leaves (degrees from the wall) | 29-50 | 44-62 | 44-47 |
| Leaf drawn | 8 / 8 | 8 / 8 | 8 / 8 |
| Leaf stroke, darkest grey at 3000 px (0 black, 255 white), median / max | 142 / 191 | 137 / 176 | 196 / 213 |
| Leaf stroke width darker than grey 170 at 3000 px (px) | 0-9 | 0-10 | 0 (all lighter) |
| Door width (m) | 0.81-0.97 | 0.59-0.87 per leaf | 0.61-0.92 per leaf |
| Door radius at the 1600 px working raster (px) | 21-26 | 14-21 | 21-32 |
| Hinge in a single-line or undetected wall (wall < 0.1 m at the hinge) | 2 / 8 | 3 / 8 | 1 / 8 |
| Hinge on a detected wall line (within 3 px of a wall segment's face) | 0 / 10 leaves | 6 / 13 leaves | 0 / 10 leaves |

### 1.3 Clutter around doors and chance hits

| Measure | Floor 0 | Floor -1 | Floor -2 |
|---|---|---|---|
| Soft-ink share of the picture (1600 px) | 0.10 | 0.09 | 0.13 |
| Leaves with both rings (0.7 r, 1.3 r) <= 0.35 on the thin mask | 8 / 10 | 5 / 13 | 0 / 10 |
| ... on the soft ink | 2 / 10 | 4 / 13 | 7 / 10 |
| Random quarter arcs (3000 per floor, hinged on wall edges, 0.7-1.1 m) with >= 60 % ink, thin mask | 0.068 | 0.027 | 0.034 |
| ... soft ink | 0.164 | 0.138 | 0.104 |

### 1.4 What this says

1. Two thirds of the sampled doors have no arc at all: 45 degree leaves, "V" double doors and chord triangles are the
   offices' conventions on these sheets. An arc model can reach at most 2 / 8 doors on floor 0 even if perfect.
2. At the 1600 px working raster a door is 14-32 px in radius and its lines are 1-3 px of light grey (floor -2's
   lines are all lighter than grey 170 at full resolution); the closing (6 px at 1600 px) merges leaves into walls and
   whole toilet blocks into one blob, so the hinge lies on a detected wall line for only 6 of 33 leaves. The anchor the
   door model needs - the wall - is missing exactly where the doors are.
3. The ring test that keeps hatching out also refuses most real doors (0-8 of 10-13 leaves pass, depending on the
   mask), because text, stall partitions and fixtures sit within 0.3 r of the swing.
4. The scans are raster-only at 300 dpi A4 (the render at 3000 px is 85 % of it): a "higher-resolution raster" of the
   same PDFs gains at most 1.17 x; the gain available is analysing doors at the upload resolution instead of 1600 px
   (1.9 x). There is no DXF/vector path for these floors.

## 2. The model built: `arc_v2` (`smplwise/services/plan_detect_doors.py`)

Behind `door_model: "arc_v2"` in `POST /plan-versions/{id}/detect` (default `"gap"`: the answer is unchanged, key for
key). After the gap model and the window profile pass:

- hinges every 1.5 px along every detected wall (centre line and both faces), extended one door width past each end;
  radii: 7 steps over 0.6-1.2 m at the plan's scale (0.51-1.38 m when the scale is only estimated), 8 px minimum;
- per hinge and radius, four templates (latch along +-wall, leaf to either side); on the "light" line mask (ink up to
  grey >= 200 that is not wall): open leaf >= 0.8 (read on the light ink including walls, since the closing often
  swallows it), then the quarter arc >= 0.8 or the straight chord >= 0.9;
- rejects: the 0.7 r and 1.3 r rings (middle half, 20 samples) <= 0.12, the arc's continuation beyond the leaf and
  the mirrored quarter behind the wall <= 0.2 (round tables, columns, stair wells, stair treads);
- non-maximum suppression over hinges closer than half a width; mirrored leaves whose latches meet become one double
  door; a candidate on a gap-model passage upgrades it, one on a door or window is dropped;
- confidence 0.3-0.7 (capped: proposals for the acceptance screen, never accepted by themselves); `pixels[id]` carries
  `model`, `swing_kind` (arc / chord) and the scores; arc_v2 widths never feed the door-width calibration hint.

Not modelled (measured above, left for a follow-up): the 45 degree leaf and "V" doors without arcs (a 45 degree line
from a wall is also every chamfered wall and stair cut line on floor -2), and hinges on walls the wall pass did not find.

## 3. Real floors before / after (local, sampled doors only)

A sampled door is found when a door or passage candidate's centre lies within half its width + 15 px (3000 px) of it.
"Other door candidates" are door candidates matching no sampled door: on floors 0 and -2 they were reviewed on an
overlay - all are at wall corners, zig-zag wall vertices, stall posts, tribune rows and window frames (false), except
floor 0's single one, an ambiguous thin arc in the lobby; floor -1's were not reviewed one by one and are counted false.

| Floor | Model | Sampled doors found (as door) | Other door candidates | ms (2 runs) |
|---|---|---|---|---|
| 0 | gap (default) | 0 / 8 (0) | 0 | 2078, 2552 |
| 0 | arc_v2, shipped thresholds | 0 / 8 (0) | 1 | 4182, 3688 |
| 0 | arc_v2, loosest (0.6 / 0.6 / 0.8 / 0.35 / 0.35) | 2 / 8 (2) | 41 | 5701, 6575 |
| -1 | gap | 0 / 8 (0) | 0 | 4941, 4437 |
| -1 | arc_v2, shipped | 2 / 8 (2) | 13 | 9805, 7642 |
| -1 | arc_v2, loosest | 6 / 8 (6) | 126 | 12455, 11419 |
| -2 | gap | 3 / 8 (0: three passages) | 0 | 2630, 2459 |
| -2 | arc_v2, shipped | 4 / 8 (4: three passages upgraded) | 13 | 4855, 5812 |
| -2 | arc_v2, loosest | 4 / 8 (4) | 87 | 8213, 9368 |

Intermediate sweep points (before the light mask and the dense rings; floors 0 / -1 / -2, found / other): 0.8 / 0.8 /
0.9 / 0.2 / 0.2 -> 1/8 4, 2/8 19, 4/8 22; 0.9 / 0.9 / - / 0.1 / 0.1 -> 0/8 2, 1/8 6, 4/8 7; leaf on the thin mask only
-> 1/8 16, 4/8 26, 4/8 40. No setting reaches 30 % on floor 0 with fewer than one false candidate per five true doors.

Timing: arc_v2 adds 1.1-5.4 s per floor at 3000 px (0.3-1.1 million templates), within the 60 s guard, and checks the
run's deadline between walls.

## 4. Synthetic checks

- New `tests/test_plan_detect_doors_v2.py`: a door in a gap (both models, one door, the gap model's opening kept as
  it was), an arc over a wall that continues through it (arc_v2 only), a 1-px grey (150) arc, mirrored / rotated
  doors (2 wall directions x 2 hinges x 2 swings: the leaf tip lands on ink), a round table touching the wall, a
  column on it, a chair ring and a stair quarter-turn with treads (no arc_v2 door), the default answer identical with
  and without `door_model="gap"`, an unknown model refused (ValueError; 422 on the route), the deadline kept, the
  extra cost bounded.
- Synthetic metrics set (`tests/plan_detect_metrics.py`), calibrated and uncalibrated, default model before and
  after: identical, "walls recall >= 0.974, precision >= 0.969; doors 21/21; windows 17/17", 0 false doors. With
  `arc_v2`: the same numbers (21/21 doors as doors, 0 false), slowest plan 2.1 -> 3.4 s calibrated, 2.5 -> 3.7 s
  uncalibrated.
- `pytest tests/test_plan_detect_*.py`: 87 passed (a first run beside the private evaluation exited 1 with its failure
  lost to the output filter; the rerun without that load passed - the known load-sensitive detector timings).

## 5. Recommendation

The arc-based door model is the wrong tool for these three sheets; tuning it further trades a few doors for dozens of
false ones. In order of expected value:

1. **Keep the review flow manual for doors on scans** and add an assisted placement in the editor (click on a door
   symbol, propose width / hinge / swing from the local ink at full resolution): the owner's ~40 doors are a few
   minutes of clicking, and it needs no recognition at all.
2. **A door pass at the upload resolution**, not the 1600 px working raster, with its own light closing, anchored on
   raw ink line ends and junctions instead of detected walls, with templates for the three conventions measured
   here (arc, chord triangle, 45 degree leaf / "V"). Expected to lift the anchor rate (0-6 of 33 hinges on a wall
   today); the false-positive problem of 45 degree leaves near chamfered walls remains.
3. **A learned symbol detector** once there is labelled data: the conventions differ per floor on the same building,
   which is what a small learned detector handles and hand-set templates do not. Needs the owner (or the assisted tool
   in 1) to mark doors on real plans first; those marks are the training set.

The DXF path does not apply: the owner's PDFs carry only a raster.

## 6. Follow-up: recommendation 1 built - the "סמן דלת" tool (branch `pilot/T087-door-tool`)

The editor's structure tool gained a "סמן דלת" mode: one click on a door symbol, and `POST
/plan-versions/{id}/door-proposal` (`smplwise/services/plan_door_tool.py`) proposes the door from a crop of the picture
at its upload resolution - anchored on the ink near the click, not on detected walls; walls told from symbol lines by
darkness (on these scans a wall bottoms out at grey 50-120 and is 8-13 px wide below 150, a leaf, chord or arc bottoms
out at 135-200 and is at most 3 px wide there); templates for the conventions of section 1.1 (arc, chord triangle,
30-60 degree leaf, arc or "V" double) scored with plan_detect_doors' arc / line pieces plus the jambs; the person
adjusts width, hinge and swing on a ghost and accepts. Design and decisions: `docs/changes/CR-003-PLAN-STUDIO.md`.

Measured locally on the same 24 sampled doors (the renders at 3000 px; one click per door on the middle of its symbol,
no walls drawn - the same numbers with a hand-drawn wall through the door). "Right without adjustment": width within
15 %, centre within a quarter width, the hinge at the right jamb and the swing to the right side (a double door: found
as double, opening to the right side).

| Floor | Calibrated | Uncalibrated | Per convention (calibrated) |
|---|---|---|---|
| 0 | 2 / 8 | 2 / 8 | both single arc doors right (their blurred arcs read as chords); the 4 stall leaves misplaced (one as a bogus double); the 2 "V" doubles wrong (one on the wrong side, one not read as double) |
| -1 | 2 / 8 | 2 / 8 | both arc doubles right; the single arc doors and the 45 degree leaf with the hinge on the wrong jamb (one of them otherwise right); the 3 "V" / curved doubles not read as double |
| -2 | 6 / 8 | 6 / 8 | the chord doors, the single arc door and the arc double right (one chord door 26 % narrow); the "V" double on the wrong side |
| **All** | **10 / 24** | **10 / 24** | no click refused; 2 more need one handle (a hinge flip, a width drag); 12 are misplaced or read as the wrong kind |

Time per click on this workstation while other jobs ran (8 logical cores at ~80 % load, 2.5 GB free): median 435 ms,
p95 700 ms, max 950 ms - over the 0.3 s target; not measured on a quiet machine.
