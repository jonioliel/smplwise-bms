import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { biarcJunction, cleanPoints, fitCurve, minRadiusPx, SHARP_TURN_DEG, type CurveFit, type P } from '../src/map/curve-fit';
import { addCurveWall, bendSegment, curvePointAt, curvePoints, curvePreview, fitPoints, insertCurvePoint, isPointsCurve, moveCurvePoint, refitCurve, removeCurvePoint, roundCorner } from '../src/map/curve-ops';
import { CURVE_THROUGH, curveThrough, removeCorner, translateWall, withThrough } from '../src/map/studio-ops';
import { buildPrimitives, pointOnWall, wallOutlineAreaM2, type GeometryDoc, type GeomWall, type Pt } from '../src/map/geometry';
import { arcOf, cumulative, pathLength, pointAtS, project, sample, wallPx } from '../src/map/wall-path';
import { glazingOf, panelCount, type GlazingPrim } from '../src/map/glass-wall';
import { curveT, PLAN_CURVE_STRINGS } from '../src/i18n/plan-curves';
import { glassT, PLAN_GLASS_STRINGS } from '../src/i18n/plan-glass';
import { DRAW_MODES, STUDIO_MODES } from '../src/screens/plan-studio-panel';

// Walls drawn through points (WALLP, owner request 2026-10-08): the fit (curve-fit.ts) passes through every clicked
// point, is tangent-continuous everywhere (clicked points and biarc junctions), is exact on circles and straight on
// lines, handles closed rings, near-coincident points and sharp reversals; the document edits (curve-ops) keep the
// clicked points as the wall's handles and re-fit on every edit; contracts/fixtures/plan_geometry/sample-curve-points.json
// (shared with the backend's tests/test_wall_curve_points.py) is what the fit produces today. Runs in node.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const W = 1000;
const H = 800;
const DEG = Math.PI / 180;

/** The largest angle (degrees) between the tangent arriving at a corner and the one leaving it, over the inner corners
 * (and the closing corner of a ring). */
function worstKink(fit: Pick<CurveFit, 'pts' | 'bulges'>, closed: boolean, skip: number[] = []): number {
  const n = fit.pts.length;
  const endDir = (i: number) => pointAtS([fit.pts[i], fit.pts[i + 1]], [fit.bulges[i]], pathLength([fit.pts[i], fit.pts[i + 1]], [fit.bulges[i]])).d;
  const startDir = (i: number) => pointAtS([fit.pts[i], fit.pts[i + 1]], [fit.bulges[i]], 0).d;
  let worst = 0;
  for (let c = 1; c < n - 1 + (closed ? 1 : 0); c++) {
    if (skip.includes(c)) continue;
    const a = endDir(c - 1);
    const b = startDir(c === n - 1 ? 0 : c);
    worst = Math.max(worst, Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])) / DEG);
  }
  return worst;
}

const onCircle = (n: number, r: number, a0: number, span: number, c: P = [500, 400]): P[] =>
  Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos(a0 + (span * i) / (n - 1)), c[1] + r * Math.sin(a0 + (span * i) / (n - 1))]);

function passesThrough(fit: CurveFit, input: P[], tol = 1e-9) {
  const clean = cleanPoints(input, false);
  expect(fit.through.length).toBe(clean.length);
  fit.through.forEach((idx, k) => {
    expect(Math.hypot(fit.pts[idx][0] - clean[k][0], fit.pts[idx][1] - clean[k][1])).toBeLessThanOrEqual(tol);
  });
}

function emptyDoc(): GeometryDoc {
  const base = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
  return { ...base, walls: [], openings: [], labels: [], objects: [], groups: [], circuits: [], connectors: [], schema_version: '2.0' };
}
const wallOf = (d: GeometryDoc, id: string): GeomWall => d.walls.find((w) => w.id === id)!;
const N = (p: P): Pt => [p[0] / W, p[1] / H];

test('three points: one circular arc through them, two segments on the same circle', () => {
  const pts = onCircle(3, 200, 0.2, 2.2);
  const fit = fitCurve(pts);
  expect(fit.pts.length).toBe(3); // no junction: the clicked points are the only corners
  expect(fit.through).toEqual([0, 1, 2]);
  passesThrough(fit, pts);
  const a = arcOf(fit.pts[0], fit.pts[1], fit.bulges[0])!;
  const b = arcOf(fit.pts[1], fit.pts[2], fit.bulges[1])!;
  expect(a.r).toBeCloseTo(200, 6);
  expect(b.r).toBeCloseTo(200, 6);
  expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeLessThan(1e-6);
  expect(minRadiusPx(fit)).toBeCloseTo(200, 6);
  expect(worstKink(fit, false)).toBeLessThan(1e-6);
});

test('points on one circle give exactly that circle (any count, uneven spacing)', () => {
  const ang = [0.1, 0.35, 0.9, 1.0, 1.7, 2.6];
  const pts = ang.map((t): P => [500 + 180 * Math.cos(t), 400 + 180 * Math.sin(t)]);
  const fit = fitCurve(pts);
  passesThrough(fit, pts);
  for (const q of sample(fit.pts, fit.bulges, 0.1)) expect(Math.abs(Math.hypot(q[0] - 500, q[1] - 400) - 180)).toBeLessThan(0.05);
  expect(worstKink(fit, false)).toBeLessThan(1e-6);
});

test('a smooth curve through many points: tangent-continuous everywhere, close to the true curve, local', () => {
  const f = (x: number) => 400 + 120 * Math.sin(((x - 100) / 100) * 0.9);
  const pts: P[] = Array.from({ length: 7 }, (_, i) => [100 + i * 100, f(100 + i * 100)]);
  const fit = fitCurve(pts);
  passesThrough(fit, pts);
  expect(fit.pts.length).toBeGreaterThan(pts.length); // biarcs: junctions between the clicked points
  expect(worstKink(fit, false)).toBeLessThan(1e-6); // G1 at the clicked points AND at the junctions
  // accuracy: within 10 % of the point spacing of the sine between the samples (sparse: 7 points per 5.4 rad)
  let dev = 0;
  for (const q of sample(fit.pts, fit.bulges, 0.25)) dev = Math.max(dev, Math.abs(q[1] - f(q[0])));
  expect(dev).toBeLessThan(10);
  // denser points: much closer (the error falls with the spacing)
  const dense: P[] = Array.from({ length: 25 }, (_, i) => [100 + i * 25, f(100 + i * 25)]);
  const fd = fitCurve(dense);
  let devD = 0;
  for (const q of sample(fd.pts, fd.bulges, 0.25)) devD = Math.max(devD, Math.abs(q[1] - f(q[0])));
  expect(devD).toBeLessThan(0.6);
  // local: moving the last point leaves the first spans unchanged
  const moved = fitCurve([...pts.slice(0, -1), [pts[6][0] + 40, pts[6][1] - 60]]);
  for (let i = 0; i <= fit.through[3]; i++) {
    expect(moved.pts[i][0]).toBeCloseTo(fit.pts[i][0], 9);
    expect(moved.bulges[i] ?? 0).toBeCloseTo(fit.bulges[i] ?? 0, 9);
  }
});

test('collinear points make a straight wall; two points too', () => {
  const fit = fitCurve([[0, 0], [100, 0], [250, 0], [400, 0]]);
  expect(fit.bulges.every((b) => b === 0)).toBe(true);
  expect(fit.pts.length).toBe(4);
  const two = fitCurve([[10, 10], [200, 90]]);
  expect(two.bulges).toEqual([0]);
  expect(two.through).toEqual([0, 1]);
});

test('near-coincident and repeated points count once; fewer than two points make no curve', () => {
  const pts: P[] = [[0, 0], [0.2, 0.1], [100, 40], [100, 40], [200, 0]];
  const fit = fitCurve(pts);
  expect(fit.through.length).toBe(3);
  expect(fitCurve([[5, 5], [5.1, 5.2]]).bulges).toEqual([]);
  expect(fitCurve([]).pts).toEqual([]);
  const d = emptyDoc();
  expect(addCurveWall(d, [[0.5, 0.5], [0.50001, 0.5]], false, { kind: 'interior', thickness_m: 0.2 }, W, H)).toBeNull();
  expect(addCurveWall(d, [[0.5, 0.5]], false, { kind: 'interior', thickness_m: 0.2 }, W, H)).toBeNull();
});

test('closed rings: a round room through 3, 4 or N points, tangent-continuous at the closing point too', () => {
  const tri = fitCurve([[300, 300], [500, 300], [400, 480]], { closed: true });
  expect(tri.pts.length).toBe(4); // one arc per span: the circumcircle
  expect(tri.pts[3]).toEqual(tri.pts[0]);
  expect(worstKink(tri, true)).toBeLessThan(1e-6);
  const sq = fitCurve([[300, 300], [500, 300], [500, 500], [300, 500]], { closed: true });
  for (const q of sample(sq.pts, sq.bulges, 0.1)) expect(Math.abs(Math.hypot(q[0] - 400, q[1] - 400) - Math.SQRT2 * 100)).toBeLessThan(0.05);
  const quad = fitCurve([[300, 300], [600, 320], [560, 500], [320, 480]], { closed: true });
  expect(quad.through).toEqual([0, 2, 4, 6]);
  expect(worstKink(quad, true)).toBeLessThan(1e-6);
  // a closed curve through two points is the circle on them (two half circles)
  expect(fitCurve([[100, 100], [300, 100]], { closed: true }).bulges).toEqual([1, 1]);
  // the clicked last point on the first one is dropped (the ring closes on its own)
  expect(fitCurve([[300, 300], [500, 300], [400, 480], [300, 300]], { closed: true }).through).toEqual([0, 1, 2]);
});

test('a sharp reversal is kept as a corner: no loop, every bulge within the model limit', () => {
  const zig: P[] = [[0, 0], [100, 0], [0, 10], [100, 20], [0, 30]];
  const fit = fitCurve(zig);
  passesThrough(fit, zig);
  expect(fit.bulges.every((b) => Number.isFinite(b) && Math.abs(b) <= 4)).toBe(true);
  // a U-turn after a smooth run: the run keeps its smoothness, the turn is a corner
  const u: P[] = [[0, 0], [100, 30], [200, 40], [80, 45], [0, 60]];
  const fu = fitCurve(u);
  expect(fu.bulges.every((b) => Math.abs(b) <= 4)).toBe(true);
  expect(worstKink(fu, false, [fu.through[2]])).toBeLessThan(1e-6); // smooth except at the U-turn point
  expect(worstKink(fu, false)).toBeGreaterThan(SHARP_TURN_DEG / 4);
  // the S case of the biarc (parallel end tangents across the chord) is two half circles
  const j = biarcJunction([0, 0], [0, 1], [100, 0], [0, 1]);
  expect(j).toEqual([50, 0]);
});

test('random point sets: the fit always passes through the points, stays finite and within the bulge limit', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 200; k++) {
    const n = 2 + Math.floor(rnd() * 8);
    const pts: P[] = Array.from({ length: n }, () => [rnd() * 1000, rnd() * 800]);
    const closed = n >= 3 && rnd() < 0.3;
    const fit = fitCurve(pts, { closed });
    expect(fit.bulges.length).toBe(fit.pts.length - 1);
    expect(fit.bulges.every((b) => Number.isFinite(b) && Math.abs(b) <= 4)).toBe(true);
    expect(fit.pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))).toBe(true);
    if (!closed) passesThrough(fit, pts, 1e-6);
  }
});

test('the stored fit: rounded corners keep the curve tangent-continuous and through the clicked points', () => {
  const pts: Pt[] = [[0.1, 0.55], [0.22, 0.45], [0.34, 0.52], [0.46, 0.62], [0.58, 0.5]];
  const f = fitPoints(pts, false, W, H);
  expect(f.through.map((i) => f.polyline[i])).toEqual(pts);
  const px = { pts: f.polyline.map((p): P => [p[0] * W, p[1] * H]), bulges: f.bulges };
  expect(worstKink(px, false)).toBeLessThan(0.05); // rounding to 1e-5 of the plan: a few hundredths of a degree at most
});

test('a wall through points: added with its clicked points as handles, the document 2.1, the level default', () => {
  const r = addCurveWall(emptyDoc(), [[0.2, 0.5], [0.35, 0.35], [0.5, 0.5]], false, { kind: 'interior', thickness_m: 0.2 }, W, H)!;
  const w = wallOf(r.doc, r.id);
  expect(isPointsCurve(w)).toBe(true);
  expect(w.external_ids?.[CURVE_THROUGH]).toBe('0,1,2');
  expect(curvePoints(w)).toEqual([[0.2, 0.5], [0.35, 0.35], [0.5, 0.5]]);
  expect(r.doc.schema_version).toBe('2.1');
  expect(w.bulges?.length).toBe(2);
  expect(curvePointAt(w, 1)).toBe(1);
  // a straight one through collinear points stays 2.0 and has no bulges (but keeps its points)
  const s = addCurveWall(emptyDoc(), [[0.2, 0.5], [0.3, 0.5], [0.5, 0.5]], false, { kind: 'interior', thickness_m: 0.2 }, W, H)!;
  expect(wallOf(s.doc, s.id).bulges).toBeUndefined();
  expect(s.doc.schema_version).toBe('2.0');
});

test('dragging a point re-fits through it; the door stays on the wall near its place; undo is the old document', () => {
  let d = addCurveWall(emptyDoc(), [[0.1, 0.5], [0.25, 0.38], [0.4, 0.5], [0.55, 0.62], [0.7, 0.5]], false, { kind: 'interior', thickness_m: 0.2 }, W, H)!.doc;
  const id = d.walls[0].id;
  d = { ...d, openings: [{ id: 'o1', wall_id: id, t: 0.2, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} }] };
  const doorAt = pointOnWall(wallOf(d, id), 0.2, W, H);
  const moved = moveCurvePoint(d, id, 3, [0.55, 0.7], W, H);
  const w = wallOf(moved, id);
  expect(curvePoints(w)![3]).toEqual([0.55, 0.7]);
  expect(curvePoints(w)!.filter((_, k) => k !== 3)).toEqual(curvePoints(wallOf(d, id))!.filter((_, k) => k !== 3));
  const nowAt = pointOnWall(w, moved.openings[0].t, W, H);
  expect(Math.hypot((nowAt[0] - doorAt[0]) * W, (nowAt[1] - doorAt[1]) * H)).toBeLessThan(2); // the door's first span did not move
  expect(wallOf(d, id).polyline).not.toEqual(w.polyline); // the original document is untouched (undo restores it)
});

test('a point added on the curve barely changes it; a point removed re-fits; the last two points keep the wall', () => {
  const d = addCurveWall(emptyDoc(), [[0.1, 0.5], [0.3, 0.3], [0.6, 0.5]], false, { kind: 'interior', thickness_m: 0.2 }, W, H)!.doc;
  const id = d.walls[0].id;
  const before = wallOf(d, id);
  const ins = insertCurvePoint(d, id, W, H)!;
  const after = wallOf(ins.doc, id);
  expect(curvePoints(after)!.length).toBe(4);
  const { pts, bulges } = wallPx(before, W, H);
  const now = wallPx(after, W, H);
  for (const q of sample(now.pts, now.bulges, 1)) expect(project(pts, bulges, q).dist).toBeLessThan(3);
  // at a given place: the nearest point of the curve, in the right span
  const at = insertCurvePoint(d, id, W, H, [0.15, 0.42])!;
  expect(at.k).toBe(1);
  const rem = removeCurvePoint(ins.doc, id, ins.k, W, H);
  expect(rem.wallRemoved).toBe(false);
  expect(curvePoints(wallOf(rem.doc, id))).toEqual(curvePoints(before));
  const two = removeCurvePoint(d, id, 1, W, H);
  expect(curvePoints(wallOf(two.doc, id))!.length).toBe(2);
  const gone = removeCurvePoint(two.doc, id, 0, W, H);
  expect(gone.wallRemoved).toBe(true);
  expect(gone.doc.walls.length).toBe(0);
});

test('closed ring through points: a round room with an area; a moved point keeps it closed', () => {
  const r = addCurveWall(emptyDoc(), [[0.4, 0.3], [0.6, 0.3], [0.6, 0.55], [0.4, 0.55]], true, { kind: 'exterior', thickness_m: 0.2 }, W, H)!;
  const w = wallOf(r.doc, r.id);
  expect(w.polyline[0]).toEqual(w.polyline[w.polyline.length - 1]);
  expect(curvePoints(w)!.length).toBe(4);
  const area = wallOutlineAreaM2(w, W, H, 0.01)!;
  const box = (0.2 * W * 0.01) * (0.25 * H * 0.01);
  expect(area).toBeGreaterThan(box); // a round room bulges past the four points
  expect(area).toBeLessThan(box * 1.75);
  const m = wallOf(moveCurvePoint(r.doc, r.id, 0, [0.38, 0.28], W, H), r.id);
  expect(m.polyline[0]).toEqual(m.polyline[m.polyline.length - 1]);
  expect(m.polyline[0]).toEqual([0.38, 0.28]);
  expect(curvePointAt(m, m.polyline.length - 1)).toBe(0); // the closing corner is point 0
});

test('a curved glass wall through points: glazing defaults, panels along the arc, every panel end on the curve', () => {
  const r = addCurveWall(emptyDoc(), [[0.2, 0.6], [0.4, 0.45], [0.6, 0.6]], false, { kind: 'glass', thickness_m: 0.12 }, W, H)!;
  const w = wallOf(r.doc, r.id);
  expect(w.kind).toBe('glass');
  expect(glazingOf(w).panel_width_m).toBe(1.2);
  expect(r.doc.schema_version).toBe('2.1');
  const prims = buildPrimitives(r.doc, W, H); // sample-v2: calibrated, 0.01 m per pixel
  const glz = prims.find((p) => p.kind === 'glazing') as GlazingPrim | undefined;
  expect(glz).toBeTruthy();
  const { pts, bulges } = wallPx(w, W, H);
  const lengthM = pathLength(pts, bulges) * 0.01;
  expect(glz!.panels.length).toBe(panelCount(lengthM, glazingOf(w)));
  expect(glz!.panels.length).toBeGreaterThan(2);
  for (const q of glz!.panels) for (const e of [q.a, q.b]) expect(project(pts, bulges, e as P).dist).toBeLessThan(0.3);
});

test('other edits end the re-fit: bending a segment, rounding a corner or removing a corner make an ordinary curved wall', () => {
  const r = addCurveWall(emptyDoc(), [[0.1, 0.5], [0.3, 0.3], [0.5, 0.5], [0.7, 0.62]], false, { kind: 'interior', thickness_m: 0.2 }, W, H)!;
  const id = r.id;
  expect(isPointsCurve(wallOf(bendSegment(r.doc, id, 0, [0.15, 0.3], W, H), id))).toBe(false);
  expect(isPointsCurve(wallOf(removeCorner(r.doc, id, 1).doc, id))).toBe(false);
  // a whole-wall move keeps the points (the indices are unchanged)
  const t = wallOf(translateWall(r.doc, id, 0.05, 0), id);
  expect(isPointsCurve(t)).toBe(true);
  expect(curvePoints(t)![0][0]).toBeCloseTo(0.15, 5);
  // a straight wall cannot be rounded into a points wall by accident either
  const plain: GeomWall = { id: 'p', level_id: 'L0', polyline: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]], thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} };
  const rc = roundCorner({ ...emptyDoc(), walls: [plain] }, 'p', 1, 1, 0.01, W, H)!;
  expect(isPointsCurve(wallOf(rc, 'p'))).toBe(false);
  // refit keeps whatever else external_ids holds
  const tagged = { ...r.doc, walls: r.doc.walls.map((x) => ({ ...x, external_ids: { ...x.external_ids, dxf: 'A1' } })) };
  expect(wallOf(refitCurve(tagged, id, curvePoints(wallOf(tagged, id))!, W, H), id).external_ids?.dxf).toBe('A1');
});

test('the clicked-point record is validated: malformed or stale values make an ordinary wall', () => {
  const w: GeomWall = { id: 'x', level_id: 'L0', polyline: [[0, 0], [0.1, 0], [0.2, 0], [0.3, 0]], thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} };
  const as = (v: string) => curveThrough({ ...w, external_ids: { [CURVE_THROUGH]: v } });
  expect(as('0,2,3')).toEqual([0, 2, 3]);
  expect(as('0,2')).toBeNull(); // does not end on the last corner
  expect(as('1,3')).toBeNull(); // does not start on the first
  expect(as('0,2,2,3')).toBeNull();
  expect(as('0,a,3')).toBeNull();
  expect(as('0,5')).toBeNull();
  expect(as('3')).toBeNull();
  expect(withThrough(w, undefined)).toBe(w);
  expect(withThrough({ ...w, external_ids: { [CURVE_THROUGH]: '0,3', keep: 'k' } }, undefined).external_ids).toEqual({ keep: 'k' });
});

test('the live preview: length and tightest radius in metres; the shared fixture is what the fit produces', () => {
  const pts = onCircle(3, 200, Math.PI, Math.PI).map(N);
  const live = curvePreview(pts, false, W, H, 0.01);
  expect(live.lengthM).toBeCloseTo(Math.PI * 2, 2); // a half circle of 2 m radius
  expect(live.minRadiusM).toBeCloseTo(2, 3);
  expect(live.path.length).toBeGreaterThan(20);
  expect(curvePreview([[0.1, 0.1], [0.3, 0.1]], false, W, H, 0.01).minRadiusM).toBe(Number.POSITIVE_INFINITY);
  // the fixture shared with the backend: every wall re-fits to itself (regenerate it with the scratch generator if the
  // fit changes on purpose, then review the diff)
  const fx = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-curve-points.json'), 'utf8')) as GeometryDoc;
  for (const w of fx.walls) {
    const again = wallOf(refitCurve(fx, w.id, curvePoints(w)!, W, H), w.id);
    expect(again.polyline, w.id).toEqual(w.polyline);
    expect(again.bulges, w.id).toEqual(w.bulges);
    const { pts: wp, bulges } = wallPx(w, W, H);
    expect(worstKink({ pts: wp, bulges }, w.polyline[0][0] === w.polyline[w.polyline.length - 1][0] && w.polyline[0][1] === w.polyline[w.polyline.length - 1][1]), w.id).toBeLessThan(0.05);
  }
  expect(cumulative([[0, 0], [3, 4]], [0])[1]).toBe(5);
});

test('chips and strings: the wall tools first, the glass wall also named curtain wall, bend has no chip; he and en complete', () => {
  const chips = STUDIO_MODES.filter((m) => m.chip !== false).map((m) => m.id);
  expect(chips).toEqual(['select', 'wall', 'curved', 'glass', 'door', 'markdoor', 'window', 'passage', 'label']);
  expect(STUDIO_MODES.find((m) => m.id === 'glass')!.aria).toContain(glassT('alias', 'he'));
  expect(DRAW_MODES).toEqual(['wall', 'curved', 'glass']);
  expect(glassT('kind', 'he')).toBe('קיר זכוכית');
  expect(glassT('alias', 'he')).toBe('קיר מסך');
  expect(glassT('kind', 'en')).toBe('Glass wall');
  expect(curveT('modeCurved', 'he')).toBe('קיר מעוגל');
  for (const set of [PLAN_CURVE_STRINGS, PLAN_GLASS_STRINGS]) {
    expect(Object.keys(set.en).sort()).toEqual(Object.keys(set.he).sort());
    for (const v of [...Object.values(set.he), ...Object.values(set.en)]) expect(v.trim().length).toBeGreaterThan(0);
  }
  // short Hebrew chip labels (phone width): at most two words
  for (const id of chips) expect(STUDIO_MODES.find((m) => m.id === id)!.label.split(' ').length).toBeLessThanOrEqual(2);
});
