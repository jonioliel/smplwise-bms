import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arcOf, bulgeForRadius, bulgeThrough, cumulative, fillet, offsetPolyline, pathLength, pointAtS, project, ringArea, sample, segLength, subPath, type P } from '../src/map/wall-path';
import { buildPrimitives, nearestWall, pointOnWall, snapPoint, wallLengthM, wallOutlineAreaM2, type GeometryDoc, type GeomWall, type Primitive } from '../src/map/geometry';
import { addArcWall, bendSegment, maxCornerRadiusM, roundCorner, segmentAt, segmentMid, segmentRadiusM, setSegmentRadius, straightenSegment } from '../src/map/curve-ops';
import { removeCorner } from '../src/map/studio-ops';
import { buildScene } from '../src/map/scene-builder';
import { cutawayIds } from '../src/map/scene-frame';
import { glazingOf, panelCount, wallLengthM as wallLengthMGlass, withDocVersion, type GlazingPrim } from '../src/map/glass-wall';

// Curved walls (owner request 2026-10-08): the frontend mirror of services/wall_path.py gives the backend's golden values,
// the map's primitives of the curved sample equal the backend renderer's, and the curve edits of the structure tool keep
// the document valid (one bulge per segment, openings in place). Runs in node: no page, no backend.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'wall-path.golden.json'), 'utf8'));
const curved = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-curved.json'), 'utf8')) as GeometryDoc;
const primsGolden = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-curved.primitives.json'), 'utf8')) as { all: Primitive[]; level_L0: Primitive[] };
const W = 1000;
const H = 800;

function close(a: unknown, b: unknown, tol: number, where = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), `${where}: ${a} vs ${b}`).toBeLessThanOrEqual(tol);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, `${where} length`).toBe(b.length);
    a.forEach((x, i) => close(x, b[i], tol, `${where}[${i}]`));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), `${where} keys`).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], tol, `${where}.${k}`);
    return;
  }
  expect(a, where).toEqual(b);
}

test('segments match the golden values', () => {
  for (const s of golden.segments) {
    const arc = arcOf(s.a, s.b, s.bulge);
    close(arc ? [arc.cx, arc.cy, arc.r, arc.a0, arc.sweep] : null, s.arc, 1e-5, 'arc');
    close(segLength(s.a, s.b, s.bulge), s.length, 1e-5, 'length');
    close(sample([s.a, s.b], [s.bulge], 0.25), s.sample_025, 2e-4, 'sample .25');
    close(sample([s.a, s.b], [s.bulge], 2), s.sample_2, 2e-4, 'sample 2');
  }
});

test('a path matches the golden values', () => {
  const g = golden.path;
  const pts = g.points as P[];
  const b = g.bulges as number[];
  close(cumulative(pts, b), g.cumulative, 1e-5, 'cum');
  close(pathLength(pts, b), g.length, 1e-5, 'length');
  for (const at of g.at) {
    const r = pointAtS(pts, b, at.s);
    close(r.p, at.point, 1e-4, 'point');
    close(r.d, at.tangent, 1e-5, 'tangent');
  }
  for (const s of g.sub) {
    const r = subPath(pts, b, s.s0, s.s1);
    close(r.pts, s.points, 1e-4, 'sub points');
    close(r.bulges, s.bulges, 1e-5, 'sub bulges');
  }
  close(sample(pts, b), g.sample, 2e-4, 'sample');
  for (const q of g.project) {
    const r = project(pts, b, q.q);
    close(r.s, q.s, 2e-4, 'project s');
    close(r.dist, q.dist, 2e-4, 'project dist');
  }
});

test('three-point, radius, fillet, area and offset match the golden values', () => {
  for (const t of golden.through) close(bulgeThrough(t.a, t.m, t.b), t.bulge, 1e-6, 'through');
  for (const r of golden.radius) close(bulgeForRadius([0, 0], [200, 0], r.r, r.sign, r.major), r.bulge, 1e-6, 'radius');
  for (const f of golden.fillet) {
    const got = fillet(f.points, [0, 0, 0, 0], f.i, f.r);
    close(got ? { points: got.pts, bulges: got.bulges } : null, f.result, 1e-5, `fillet ${f.i}`);
  }
  for (const a of golden.area) close(ringArea(a.points, a.bulges), a.area, 1e-3, 'area');
  const s = sample(golden.path.points, golden.path.bulges);
  close(offsetPolyline(s, 10), golden.offset.left_10, 2e-4, 'left');
  close(offsetPolyline(s, -10), golden.offset.right_10, 2e-4, 'right');
});

test('the map draws the curved sample like the backend renderer', () => {
  close(buildPrimitives(curved(), W, H), primsGolden.all, 0.011, 'all');
  close(buildPrimitives(curved(), W, H, 'L0'), primsGolden.level_L0, 0.011, 'L0');
});

test('editor maths follows the arc: nearest wall, point on wall, length', () => {
  const doc = curved();
  const arc = doc.walls.find((w) => w.id === 'ca-arc') as GeomWall;
  const top = pointOnWall(arc, 0.5, W, H);
  expect(top[1]).toBeLessThan(0.3); // the arc's middle is above the chord
  const hit = nearestWall(top, [arc], W, H, 5);
  expect(hit?.wall.id).toBe('ca-arc');
  expect(Math.abs((hit?.t ?? 0) - 0.5)).toBeLessThan(1e-3);
  expect(wallLengthM(arc, W, H, 0.01)).toBeGreaterThan(3.15); // the chord is 3 m
});

test('drawing snaps onto an arc body within the tolerance; corners still win; straight bodies keep the angle step', () => {
  const doc = curved();
  const arc = doc.walls.find((w) => w.id === 'ca-arc') as GeomWall;
  const top = pointOnWall(arc, 0.5, W, H);
  const near: [number, number] = [top[0], top[1] - 4 / H]; // 4 px off the arc's middle
  const s = snapPoint(near, null, [arc], W, H, { tolPx: 10, free: true });
  const hit = nearestWall(s, [arc], W, H, 1);
  expect(hit?.distPx ?? 99).toBeLessThan(0.3);
  expect(snapPoint([top[0], top[1] - 30 / H], null, [arc], W, H, { tolPx: 10, free: true })).toEqual([top[0], top[1] - 30 / H]); // too far
  const c = arc.polyline[0];
  expect(snapPoint([c[0] + 3 / W, c[1]], null, [arc], W, H, { tolPx: 10, free: true })).toEqual([c[0], c[1]]); // the corner
  const flat: GeomWall = { ...arc, id: 'flat', bulges: undefined };
  const q: [number, number] = [(flat.polyline[0][0] + flat.polyline[1][0]) / 2, flat.polyline[0][1] + 3 / H];
  expect(snapPoint(q, null, [flat], W, H, { tolPx: 10, free: true })).toEqual(q); // no body snap on straight walls
});

test('the area a closed outline encloses: a round room, a rounded square, open walls have none', () => {
  const round: GeomWall = { ...(curved().walls[0] as GeomWall), id: 'r', polyline: [[0.4, 0.5], [0.6, 0.5], [0.4, 0.5]], bulges: [1, 1] };
  // diameter 200 px at 0.01 m/px = 2 m: pi m^2
  expect(wallOutlineAreaM2(round, W, H, 0.01)).toBeCloseTo(Math.PI, 3);
  const square: GeomWall = { ...round, polyline: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.35], [0.1, 0.35], [0.1, 0.1]], bulges: undefined };
  expect(wallOutlineAreaM2(square, W, H, 0.01)).toBeCloseTo(4, 6); // 200 x 200 px
  const out = { ...square, bulges: [0, 0, 0, Math.tan(Math.PI / 8)] }; // the last side becomes a quarter-turn arc
  expect(wallOutlineAreaM2(out, W, H, 0.01)!).not.toBeCloseTo(4, 2);
  expect(wallOutlineAreaM2({ ...square, polyline: square.polyline.slice(0, 4) }, W, H, 0.01)).toBeNull();
  expect(wallOutlineAreaM2({ ...round, bulges: undefined }, W, H, 0.01)).toBeNull(); // a three-point straight "outline" is a line
});

test('a curved window wall: glass parts with their arcs, panels over the exact length on the arc, document 2.1 kept', () => {
  const doc = curved();
  const w = doc.walls.find((x) => x.id === 'cb-round') as GeomWall;
  w.kind = 'glass';
  w.thickness_m = 0.12;
  const prims = buildPrimitives(doc, W, H);
  const parts = prims.filter((p) => p.kind === 'wall' && p.id === 'cb-round') as (Primitive & { glass?: true; arc?: unknown })[];
  expect(parts.length).toBeGreaterThan(0);
  expect(parts.every((p) => p.glass === true && !!p.arc)).toBe(true);
  const glz = prims.find((p) => p.kind === 'glazing' && p.id === 'cb-round') as GlazingPrim;
  const { pts, bulges } = { pts: w.polyline.map((p): P => [p[0] * W, p[1] * H]), bulges: w.bulges! };
  expect(glz.panels.length).toBe(panelCount(pathLength(pts, bulges) * 0.01, glazingOf(w)));
  for (const q of glz.panels) for (const e of [q.a, q.b]) expect(project(pts, bulges, e as P).dist).toBeLessThan(0.3);
  // withDocVersion keeps 2.1 for a curved document without glass (it used to reset a non-glass 2.1 to 2.0)
  const plain = curved();
  expect(withDocVersion(plain).schema_version).toBe('2.1');
  expect(wallLengthMGlass(w, W, H, 0.01)).toBeCloseTo(pathLength(pts, bulges) * 0.01, 6);
});

test('3D cutaway: a round room off the scene centre loses its near half as one room, never a chord at its back', () => {
  const doc = curved();
  const desc = buildScene({ doc, width: W, height: H, anchors: [], entityStates: {}, circuitStates: {} });
  const ring = desc.parts.filter((p) => p.kind === 'wall' && p.id.startsWith('wall:cb-round#'));
  expect(ring.length).toBeGreaterThan(20);
  const pivot = ring[0].pivot!;
  expect(pivot).toBeTruthy();
  expect(ring.every((p) => p.pivot && p.pivot[0] === pivot[0] && p.pivot[1] === pivot[1])).toBe(true);
  expect(desc.parts.filter((p) => p.kind === 'wall' && p.id.startsWith('wall:ce-straight#')).every((p) => p.pivot === undefined)).toBe(true); // straight walls as before
  for (let az = 5; az < 360; az += 10) {
    const cut = new Set(cutawayIds(desc, az));
    const t = [Math.cos((az * Math.PI) / 180), Math.sin((az * Math.PI) / 180)];
    for (const p of ring) {
      const side = (p.position[0] - pivot[0]) * t[0] + (p.position[2] - pivot[1]) * t[1];
      if (side <= 0) expect(cut.has(p.id), `${p.id} at ${az}: the far half stays`).toBe(false);
    }
    expect(ring.some((p) => cut.has(p.id)), `something of the near half is cut at ${az}`).toBe(true);
  }
});

test('bend, radius and straighten: one segment, openings stay on the wall', () => {
  const doc = curved();
  const plain = doc.walls.find((w) => w.id === 'ce-straight') as GeomWall;
  const bent = bendSegment(doc, plain.id, 0, [0.225, 0.05], W, H);
  const w1 = bent.walls.find((w) => w.id === plain.id) as GeomWall;
  expect(w1.bulges?.length).toBe(1);
  expect(Math.abs(w1.bulges![0])).toBeGreaterThan(0.05);
  const r = setSegmentRadius(bent, plain.id, 0, 3, 0.01, W, H)!;
  expect(segmentRadiusM(r.walls.find((w) => w.id === plain.id)!, 0, W, H, 0.01)).toBeCloseTo(3, 3);
  expect(setSegmentRadius(bent, plain.id, 0, 1, 0.01, W, H)).toBeNull(); // shorter than half the 3.5 m chord
  const back = straightenSegment(r, plain.id, 0, W, H);
  expect('bulges' in (back.walls.find((w) => w.id === plain.id) as object)).toBe(false);
  // the door on the arc keeps its place when the arc is reshaped
  const moved = setSegmentRadius(doc, 'ca-arc', 0, 2, 0.01, W, H)!;
  const door = moved.openings.find((o) => o.id === 'oa-door')!;
  expect(door.t).toBeGreaterThan(0.3);
  expect(door.t).toBeLessThan(0.7);
});

test('round a corner: a tangent arc of that radius, and the largest radius', () => {
  const doc = curved();
  const room = doc.walls.find((w) => w.id === 'cd-room') as GeomWall;
  const max = maxCornerRadiusM(room, 1, W, H, 0.01);
  expect(max).toBeGreaterThan(1.1);
  const out = roundCorner(doc, room.id, 1, 0.5, 0.01, W, H)!;
  const w = out.walls.find((x) => x.id === room.id) as GeomWall;
  expect(w.polyline.length).toBe(room.polyline.length + 1);
  expect(w.bulges!.length).toBe(w.polyline.length - 1);
  const k = w.bulges!.findIndex((b) => b !== 0);
  expect(segmentRadiusM(w, k, W, H, 0.01)).toBeCloseTo(0.5, 3);
  expect(roundCorner(doc, room.id, 1, max + 0.5, 0.01, W, H)).toBeNull();
  const c0 = roundCorner(doc, room.id, 0, 0.3, 0.01, W, H)!; // a closed outline's first corner
  const w0 = c0.walls.find((x) => x.id === room.id) as GeomWall;
  expect(w0.polyline[0]).toEqual(w0.polyline[w0.polyline.length - 1]);
  // removing a corner keeps one bulge per segment
  const rc = removeCorner(out, room.id, 0).doc.walls.find((x) => x.id === room.id) as GeomWall;
  expect(rc.bulges ? rc.bulges.length : rc.polyline.length - 1).toBe(rc.polyline.length - 1);
});

test('draw an arc wall from start, end and a point on it; segment helpers', () => {
  const doc = curved();
  const r = addArcWall(doc, [0.1, 0.95], [0.4, 0.95], [0.25, 0.9], { thickness_m: 0.2, kind: 'interior' }, W, H);
  const w = r.doc.walls.find((x) => x.id === r.id) as GeomWall;
  expect(w.bulges?.length).toBe(1);
  const mid = segmentMid(w, 0, W, H);
  expect(Math.abs(mid[0] - 0.25) < 1e-3 && Math.abs(mid[1] - 0.9) < 1e-3).toBe(true);
  expect(segmentAt(w, [0.25, 0.9], W, H)).toBe(0);
  const flat = addArcWall(doc, [0.1, 0.95], [0.4, 0.95], [0.25, 0.95], { thickness_m: 0.2, kind: 'interior' }, W, H);
  expect('bulges' in (flat.doc.walls.find((x) => x.id === flat.id) as object)).toBe(false);
});
