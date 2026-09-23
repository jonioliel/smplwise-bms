import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrimitives, distanceM, effectiveScale, nearestWall, perimeterM, polygonAreaM2, snapPoint, type GeometryDoc, type Primitive, type Pt, type WallPrim } from '../src/map/geometry';
import { addOpening, addWall, moveVertex, patchOpening, removeItem } from '../src/map/studio-ops';

// Plan Studio (T084): the map's structure primitives equal the backend renderer's (the shared golden file), and the
// pure editor maths (snapping, the nearest wall, metres) and document operations behave. Runs in node: no page, no backend.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.primitives.json'), 'utf8')) as { all: Primitive[]; level_L1: Primitive[] };

/** Deep comparison with a 0.011 px tolerance on numbers (Math.hypot and the C library may differ in the last bit). */
function close(a: unknown, b: unknown, where = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), `${where}: ${a} vs ${b}`).toBeLessThanOrEqual(0.011);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, `${where} length`).toBe(b.length);
    a.forEach((x, i) => close(x, b[i], `${where}[${i}]`));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), `${where} keys`).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${where}.${k}`);
    return;
  }
  expect(a, where).toEqual(b);
}

test.describe('plan studio geometry (unit)', () => {
  test('the map draws exactly what the backend exports', () => {
    close(buildPrimitives(sample(), 1000, 800), golden.all, 'all');
    close(buildPrimitives(sample(), 1000, 800, 'L1'), golden.level_L1, 'L1');
  });

  test('snapping: a wall vertex first, then 45 degree steps unless free', () => {
    const doc = sample();
    expect(snapPoint([0.603, 0.498], null, doc.walls, 1000, 800, { tolPx: 10, free: false })).toEqual([0.6, 0.5]);
    const p = snapPoint([0.3, 0.212], [0.1, 0.2], [], 1000, 800, { tolPx: 10, free: false });
    expect(p[1]).toBeCloseTo(0.2, 6);
    expect(snapPoint([0.3, 0.212], [0.1, 0.2], [], 1000, 800, { tolPx: 10, free: true })).toEqual([0.3, 0.212]);
  });

  test('a click near a wall finds it and the position along it', () => {
    const doc = sample();
    const hit = nearestWall([0.35, 0.505], doc.walls, 1000, 800, 20);
    expect(hit?.wall.id).toBe('wb');
    expect(hit?.t).toBeCloseTo(0.5, 6);
    expect(nearestWall([0.35, 0.3], doc.walls, 1000, 800, 20)).toBeNull();
  });

  test('metres come from the calibration and are estimated without it', () => {
    const doc = sample();
    expect(effectiveScale(doc)).toEqual({ scale: 0.01, estimated: false });
    expect(distanceM([0.1, 0.1], [0.9, 0.1], 1000, 800, 0.01)).toBeCloseTo(8, 9);
    const square: Pt[] = [[0.1, 0.1], [0.3, 0.1], [0.3, 0.35], [0.1, 0.35]]; // 200 x 200 px
    expect(polygonAreaM2(square, 1000, 800, 0.01)).toBeCloseTo(4, 9);
    expect(perimeterM(square, 1000, 800, 0.01)).toBeCloseTo(8, 9);
    const raw: GeometryDoc = { ...doc, dimensions: { ...doc.dimensions, scale_m_per_px: null, calibration: { ...doc.dimensions.calibration, status: 'missing' } } };
    expect(effectiveScale(raw)).toEqual({ scale: 0.2 / (0.006 * 1000), estimated: true });
    // A non-finite scale (e.g. a corrupt or divide-by-zero calibration) is not usable even though it is > 0 and
    // "measured" - falls back to the same estimate as no calibration at all, never Infinity or pxPerM = 0.
    const inf: GeometryDoc = { ...doc, dimensions: { ...doc.dimensions, scale_m_per_px: Infinity, calibration: { ...doc.dimensions.calibration, status: 'measured' } } };
    expect(effectiveScale(inf)).toEqual({ scale: 0.2 / (0.006 * 1000), estimated: true });
  });

  test('editor operations keep the document consistent', () => {
    const original = sample();
    const before = JSON.stringify(original);
    let doc = original;
    const w = addWall(doc, [[0.2, 0.9], [0.5, 0.9]], { thickness_m: 0.25, kind: 'partition' });
    doc = w.doc;
    expect(w.id).toMatch(/^[0-9a-f]{16}$/);
    expect(doc.walls.find((x) => x.id === w.id)).toMatchObject({ level_id: 'L0', thickness_m: 0.25, kind: 'partition', source: 'manual', confidence: 1, height_m: null });
    const o = addOpening(doc, w.id, 0.5, 'window');
    doc = o.doc;
    expect(doc.openings.find((x) => x.id === o.id)).toMatchObject({ wall_id: w.id, kind: 'window', width_m: 1.2, sill_m: 0.9, swing: 'none' });
    doc = patchOpening(doc, o.id, { t: 0.25 });
    expect(doc.openings.find((x) => x.id === o.id)!.t).toBe(0.25);
    doc = moveVertex(doc, w.id, 1, [0.6, 0.9]);
    expect(doc.walls.find((x) => x.id === w.id)!.polyline[1]).toEqual([0.6, 0.9]);
    doc = removeItem(doc, w.id);
    expect(doc.walls.some((x) => x.id === w.id)).toBe(false);
    expect(doc.openings.some((x) => x.id === o.id)).toBe(false);
    // Every op above returns a new document rather than mutating its input (addWall's input, captured as
    // `original` before the sequence ran, must still equal its own before-snapshot).
    expect(JSON.stringify(original)).toBe(before);
  });

  // Controller note (golden review, T084): the golden fixture cannot catch a sort that works by accident. Two
  // regressions look identical on most inputs but diverge exactly at these boundaries:
  //   - `cuts.sort((a, b) => a[0] - b[0] || a[1] - b[1])` must be numeric. A default (stringifying) sort of
  //     [[95, 105], [250, 350]] would compare "95,105" against "250,350" character by character and place the
  //     250-cut first, because "2" < "9" - even though 95 < 250. That corrupts the keep-segment walk.
  //   - `byId` must compare code points (`<` / `>`), not `localeCompare`, which case-folds and would not give
  //     the plain UTF-16 order B (66) < a (97) < b (98).
  test('cuts sort numerically and wall ids sort by code point, not lexicographically or by locale', () => {
    const base = sample();

    // One wall (0,0.5)-(1,0.5) in a 1000x800 plan, scale 0.01 (100 px/m): its own length is exactly 1000 px, so
    // wall-local px equal global x. Two openings cut it: a narrow one centred at x=100 (cut [95, 105], starting
    // just below the 100 px digit-count boundary) and a 1 m one centred at x=300 (cut [250, 350], starting just
    // above it). Correct numeric sort keeps them in that order and leaves three parts in ascending x; the wall's
    // 0.2 m thickness (20 px) extends the two free ends by 10 px past the outer cuts.
    const wallDoc: GeometryDoc = {
      ...base,
      walls: [
        { id: 'w1', level_id: 'L0', polyline: [[0, 0.5], [1, 0.5]], thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} },
      ],
      openings: [
        // Stored with the later (larger-x) cut first, so a correct sort has to actually reorder them.
        { id: 'o2', wall_id: 'w1', t: 0.3, kind: 'window', width_m: 1, height_m: 1.2, sill_m: 0.9, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
        { id: 'o1', wall_id: 'w1', t: 0.1, kind: 'window', width_m: 0.1, height_m: 1.2, sill_m: 0.9, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
      ],
      labels: [],
    };
    const wallParts = buildPrimitives(wallDoc, 1000, 800).filter((p): p is WallPrim => p.kind === 'wall');
    close(wallParts.map((p) => p.points), [
      [[-10, 400], [95, 400]],
      [[105, 400], [250, 400]],
      [[350, 400], [1010, 400]],
    ], 'wallParts.points');
    close(wallParts.map((p) => p.width), [20, 20, 20], 'wallParts.width');

    const idsDoc: GeometryDoc = {
      ...base,
      walls: [
        { id: 'b', level_id: 'L0', polyline: [[0.1, 0.1], [0.2, 0.1]], thickness_m: 0.1, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} },
        { id: 'B', level_id: 'L0', polyline: [[0.3, 0.1], [0.4, 0.1]], thickness_m: 0.1, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} },
        { id: 'a', level_id: 'L0', polyline: [[0.5, 0.1], [0.6, 0.1]], thickness_m: 0.1, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} },
      ],
      openings: [],
      labels: [],
    };
    const ids = buildPrimitives(idsDoc, 1000, 800)
      .filter((p): p is WallPrim => p.kind === 'wall')
      .map((p) => p.id);
    expect(ids).toEqual(['B', 'a', 'b']);
  });

  // Controller note (golden review, T084): a saved draft can carry duplicate wall ids (duplicate_id is not
  // structural, so nothing upstream rejects it) - the backend's export collapses them by id, keeping the last
  // occurrence (`walls = {w["id"]: w ...}`), and draws one wall. The map must match, or it would show a wall the
  // SVG/PNG export does not.
  test('duplicate wall ids draw once, the last one wins', () => {
    const base = sample();
    const doc: GeometryDoc = {
      ...base,
      walls: [
        { id: 'dup', level_id: 'L0', polyline: [[0.1, 0.2], [0.5, 0.2]], thickness_m: 0.1, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} },
        { id: 'dup', level_id: 'L0', polyline: [[0.1, 0.6], [0.5, 0.6]], thickness_m: 0.1, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} },
      ],
      openings: [],
      labels: [],
    };
    const wallPrims = buildPrimitives(doc, 1000, 800).filter((p): p is WallPrim => p.kind === 'wall');
    expect(wallPrims.length).toBe(1);
    expect(wallPrims[0].id).toBe('dup');
    // The second (last) occurrence: y = 0.6 * 800 = 480, not the first occurrence's 0.2 * 800 = 160. No
    // openings, so the whole 400 px wall is one part, both free ends extended by half the 10 px thickness:
    // x = [0.1, 0.5] * 1000 = [100, 500], extended to [95, 505].
    close(wallPrims[0].points, [[95, 480], [505, 480]], 'dup.points');
  });

  // Controller note (golden review, T084): no existing test drives the interval-merge branch (two cuts that
  // overlap) or a cut clamped at the wall's own start (which must suppress that end's extension, since the part
  // no longer begins at the wall's true end).
  test('overlapping cuts merge and a cut at the wall start suppresses the extension', () => {
    const base = sample();
    // One wall (0.1,0.5)-(0.9,0.5) in a 1000x800 plan: 800 px long locally (global x = local + 100), thickness
    // 0.2 m = 20 px (half-extend 10 px). Scale 0.01 => 100 px/m, so a 1 m opening is 100 px wide (half 50 px).
    //   door t=0.05: centre 0.05*800=40,  cut [40-50, 40+50] = [-10, 90], clamped to [0, 90] - touches the start.
    //   open t=0.50: centre 0.50*800=400, cut [350, 450].
    //   open t=0.55: centre 0.55*800=440, cut [390, 490] - overlaps [350, 450] (390 < 450), so the keep-walk
    //                merges them into one gap instead of leaving a sliver part between 450 and 390.
    // Keep-segment walk (local coordinates): cursor = 0.
    //   [0, 90]:    a=0 is not > cursor(0)   -> no part pushed;                cursor = max(0, 90) = 90.
    //   [350, 450]: a=350 is > cursor(90)    -> push [90, 350];                cursor = max(90, 450) = 450.
    //   [390, 490]: a=390 is not > cursor(450) -> no part pushed (merged);     cursor = max(450, 490) = 490.
    //   end: cursor(490) < total(800)        -> push [490, 800].
    // Two parts, local [90, 350] and [490, 800]:
    //   part 0: s0=90 is not <= 0, so the start is NOT extended - global x [90+100, 350+100] = [190, 450].
    //   part 1: s1=800 is the wall total, so the end IS extended by 10 - global x [490+100, 800+100+10] = [590, 910].
    const doc: GeometryDoc = {
      ...base,
      walls: [
        { id: 'w1', level_id: 'L0', polyline: [[0.1, 0.5], [0.9, 0.5]], thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} },
      ],
      openings: [
        { id: 'o1', wall_id: 'w1', t: 0.05, kind: 'door', width_m: 1, height_m: 2.1, sill_m: 0, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
        { id: 'o2', wall_id: 'w1', t: 0.5, kind: 'window', width_m: 1, height_m: 1.2, sill_m: 0.9, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
        { id: 'o3', wall_id: 'w1', t: 0.55, kind: 'window', width_m: 1, height_m: 1.2, sill_m: 0.9, swing: 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} },
      ],
      labels: [],
    };
    const wallParts = buildPrimitives(doc, 1000, 800).filter((p): p is WallPrim => p.kind === 'wall');
    close(wallParts.map((p) => p.points), [
      [[190, 400], [450, 400]],
      [[590, 400], [910, 400]],
    ], 'mergedParts.points');
    close(wallParts.map((p) => p.width), [20, 20], 'mergedParts.width');
  });
});
