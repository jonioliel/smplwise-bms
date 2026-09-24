import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrimitives, distanceM, effectiveScale, isClosedOutline, nearestWall, perimeterM, pointOnWall, polygonAreaM2, snapPoint, type CatalogLookup, type GeometryDoc, type ObjectShape, type Primitive, type Pt, type WallPrim } from '../src/map/geometry';
import { addLabel, addOpening, addWall, cornerRemovable, moveVertex, nudgeT, openingRange, patchLabel, patchOpening, removeCorner, removeItem, wallDirectionAt } from '../src/map/studio-ops';
import { fmtArea, fmtMetres } from '../src/screens/plan-studio-panel';
import type { CatalogItem } from '../src/api/plan-catalog';

// Plan Studio (T084): the map's structure primitives equal the backend renderer's (the shared golden file), and the
// pure editor maths (snapping, the nearest wall, metres) and document operations behave. Runs in node: no page, no backend.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const CATALOG = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json');
const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.primitives.json'), 'utf8')) as { all: Primitive[]; level_L1: Primitive[] };
// T085: the golden now carries objects and connectors too (the backend's catalog gives their real shape / icon / color);
// the map needs the same library lookup the backend used to produce this fixture.
const catalogItems = new Map((JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: CatalogItem[] }).items.map((i) => [i.id, i]));
const lookup: CatalogLookup = (id) => {
  const i = catalogItems.get(id);
  return i ? { shape: i.shape as ObjectShape, icon: i.icon, color_token: i.color_token } : undefined;
};

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
    close(buildPrimitives(sample(), 1000, 800, null, lookup), golden.all, 'all');
    close(buildPrimitives(sample(), 1000, 800, 'L1', lookup), golden.level_L1, 'L1');
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
    // A closed outline keeps its closing point equal to the first after clamping; two corners are not an outline.
    const ring = addWall(doc, [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.2]], { thickness_m: 0.2, kind: 'interior' });
    expect(isClosedOutline(ring.doc.walls.find((x) => x.id === ring.id)!.polyline)).toBe(true);
    expect(isClosedOutline([[0.2, 0.2], [0.4, 0.2], [0.2, 0.2]])).toBe(false);
    expect(isClosedOutline([[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.21]])).toBe(false);
    // Deleting a selected corner (0.1.83): an open wall keeps at least two points, a closed outline stays closed with at
    // least three corners; a wall that would drop below that goes instead, with its openings.
    const polyOf = (d: GeometryDoc, id: string) => d.walls.find((x) => x.id === id)?.polyline;
    expect(cornerRemovable(polyOf(ring.doc, ring.id)!)).toBe(false); // a triangle
    const lost = removeCorner(ring.doc, ring.id, 1);
    expect(lost.wallRemoved).toBe(true);
    expect(polyOf(lost.doc, ring.id)).toBeUndefined();
    const quad = addWall(doc, [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4], [0.2, 0.2]], { thickness_m: 0.2, kind: 'interior' });
    const q0 = removeCorner(quad.doc, quad.id, 0); // the closing corner: the outline now closes on the next one
    expect(q0.wallRemoved).toBe(false);
    expect(polyOf(q0.doc, quad.id)).toEqual([[0.4, 0.2], [0.4, 0.4], [0.2, 0.4], [0.4, 0.2]]);
    expect(polyOf(removeCorner(quad.doc, quad.id, 2).doc, quad.id)).toEqual([[0.2, 0.2], [0.4, 0.2], [0.2, 0.4], [0.2, 0.2]]);
    const bent = addWall(doc, [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2]], { thickness_m: 0.2, kind: 'interior' });
    expect(polyOf(removeCorner(bent.doc, bent.id, 1).doc, bent.id)).toEqual([[0.1, 0.1], [0.2, 0.2]]);
    const straight = addWall(doc, [[0.1, 0.1], [0.2, 0.1]], { thickness_m: 0.2, kind: 'interior' });
    expect(removeCorner(straight.doc, straight.id, 0).wallRemoved).toBe(true);
    expect(removeCorner(bent.doc, bent.id, 5).doc).toBe(bent.doc); // no such corner: nothing changes
    // Every op above returns a new document rather than mutating its input (addWall's input, captured as
    // `original` before the sequence ran, must still equal its own before-snapshot).
    expect(JSON.stringify(original)).toBe(before);
  });

  // Fine placement of an opening (0.1.83): openingRange keeps it inside its wall (the validator's opening_outside_wall),
  // nudgeT moves it by one arrow press.
  test('openingRange: a wall without length sets no limit', () => {
    expect(openingRange(0.9, 0)).toEqual([0, 1]);
    expect(openingRange(0.9, Number.NaN)).toEqual([0, 1]);
    expect(nudgeT(0.5, 0.1, openingRange(0.9, 0))).toBeCloseTo(0.6, 12);
    expect(nudgeT(0.95, 0.1, openingRange(0.9, 0))).toBe(1);
    expect(nudgeT(0.05, -0.1, openingRange(0.9, 0))).toBe(0);
  });

  test('openingRange: an opening as wide as its wall or wider only fits the middle', () => {
    const [lo, hi] = openingRange(0.9, 12); // half the width from either end
    expect(lo).toBeCloseTo(0.0375, 12);
    expect(hi).toBeCloseTo(0.9625, 12);
    expect(openingRange(1.5, 1.5)).toEqual([0.5, 0.5]);
    expect(openingRange(2, 1.5)).toEqual([0.5, 0.5]);
    const middle = openingRange(2, 1.5);
    expect(nudgeT(0.5, 0.01, middle)).toBe(0.5);
    expect(nudgeT(0.5, -0.01, middle)).toBe(0.5);
    expect(nudgeT(0.3, 0.5, middle)).toBe(0.5); // towards the middle, never past it
    expect(nudgeT(0.3, -0.01, middle)).toBe(0.3); // and never further away
  });

  test('an opening that already sticks out of its wall does not jump against the key', () => {
    const range = openingRange(0.9, 12);
    expect(nudgeT(0.01, -0.002, range)).toBe(0.01); // further out: nothing moves
    expect(nudgeT(0.01, 0.002, range)).toBeCloseTo(0.012, 12); // back towards the wall by one step, no jump to the limit
    expect(nudgeT(0.99, 0.002, range)).toBe(0.99);
    expect(nudgeT(0.99, -0.002, range)).toBeCloseTo(0.988, 12);
    expect(nudgeT(0.036, 0.01, range)).toBeCloseTo(0.046, 12); // a step that crosses into the wall is taken whole
    expect(nudgeT(0.5, 0, range)).toBe(0.5);
  });

  test('nudging to the end of a wall stops at the limit and stays there after rounding', () => {
    // A 0.9 m door on a 3.7 m wall: the limit is t = 1 - 0.45 / 3.7 = 0.8783783..., which patchOpening's 5-decimal
    // rounding turns into 0.87838, just above it. 1 cm steps from t = 0.87 reach it and a further press stays there.
    const placed = addOpening(sample(), 'wb', 0.87, 'door');
    let doc = placed.doc;
    const t = () => doc.openings.find((o) => o.id === placed.id)!.t;
    const range = openingRange(0.9, 3.7);
    const step = 0.01 / 3.7;
    for (let i = 0; i < 10; i++) doc = patchOpening(doc, placed.id, { t: nudgeT(t(), step, range) });
    expect(t()).toBe(0.87838);
    expect(t()).toBeGreaterThan(range[1]);
    doc = patchOpening(doc, placed.id, { t: nudgeT(t(), step, range) });
    expect(t()).toBe(0.87838); // no creeping on, no jump back below the limit
    expect(t() * 3.7 + 0.45).toBeLessThanOrEqual(3.7 + 0.01); // inside the wall by the validator's 1 cm tolerance
    doc = patchOpening(doc, placed.id, { t: nudgeT(t(), -step, range) });
    expect(t()).toBeCloseTo(0.87838 - step, 5); // the other way it moves one step
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

  test('labels, and the point at a position along a wall', () => {
    let doc = sample();
    const l = addLabel(doc, [0.5, 0.5], 'מחסן');
    doc = patchLabel(l.doc, l.id, { text: 'מחסן ראשי', position: [1.2, 0.4] });
    expect(doc.labels.find((x) => x.id === l.id)).toMatchObject({ text: 'מחסן ראשי', position: [1, 0.4], level_id: 'L0', size: 14 });
    const wb = doc.walls.find((w) => w.id === 'wb')!;
    const mid = pointOnWall(wb, 0.5, 1000, 800); // (100,400)-(600,400) px
    expect(mid[0]).toBeCloseTo(0.35, 9);
    expect(mid[1]).toBeCloseTo(0.5, 9);
    // The wall's direction at a position, towards its end, y down (the arrow keys move an opening by it): the segment
    // the position lies on.
    expect(wallDirectionAt(wb, 0.5, 1000, 800)).toEqual([1, 0]);
    expect(wallDirectionAt({ ...wb, polyline: [[0.5, 0.9], [0.5, 0.1]] }, 0.3, 1000, 800)).toEqual([0, -1]);
    const bend = { ...wb, polyline: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.6]] as Pt[] }; // 400 px across, then 400 px down
    expect(wallDirectionAt(bend, 0.25, 1000, 800)).toEqual([1, 0]);
    expect(wallDirectionAt(bend, 0.75, 1000, 800)).toEqual([0, 1]);
    doc = removeItem(doc, l.id);
    expect(doc.labels.some((x) => x.id === l.id)).toBe(false);
  });

  test('metre formatting follows the estimate rule', () => {
    expect(fmtMetres(5, false)).toBe('5.00 מ׳');
    expect(fmtMetres(12.34, true)).toBe('≈12.3 מ׳');
    expect(fmtMetres(5, true, false)).toBe('לא מכויל');
    expect(fmtArea(42.25, true)).toBe('≈42.3 מ״ר');
    expect(fmtArea(150, false)).toBe('150 מ״ר');
  });
});
