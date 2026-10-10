import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeometryDoc, GeomOpening, GeomWall } from '../src/map/geometry';
import type { SceneAnchor, SceneInput } from '../src/map/scene-builder';
import { buildWalkWorld, doorWalkState, type WalkCatalogLookup } from '../src/map/walk-world';
import { BODY_R, NO_INPUT, WalkController, type WalkEvent, type WalkInput } from '../src/map/walk-controller';
import { minimapFrame } from '../src/map/walk-minimap';

// Plan Studio 6, slice S4 (CR-029 section 4.3 / 8): the walk controller in node - slide along a wall and into a corner,
// through an open door, blocked by a closed / stale / locked door and by a window, a passage always open, a low wall
// blocking and a soffit not, tall objects blocking and walkable ones not, the stair rise and the level switch at both
// mouths, the edge clamp, a stair to another floor stopping at its cap, start points, A* through an open door and never
// through a closed one, and the determinism of a scripted input sequence. 10 m x 8 m plan, 0.01 m/px.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
const catalogFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as { items: { id: string; role: string; walkable?: boolean }[] };
const items = new Map(catalogFile.items.map((i) => [i.id, i]));
const catalog: WalkCatalogLookup = (id) => items.get(id);

const wall = (id: string, a: [number, number], b: [number, number], extra: Partial<GeomWall> = {}): GeomWall => ({ id, level_id: 'L0', polyline: [a, b], thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, ...extra });
const opening = (id: string, wallId: string, t: number, kind: GeomOpening['kind'], entity: string | null = null): GeomOpening => ({ id, wall_id: wallId, t, kind, width_m: 1.0, height_m: 2.1, sill_m: kind === 'window' ? 0.9 : 0, swing: kind === 'door' ? 'right' : 'none', hinge: 'start',
  anchor_ref: entity ? { resource_type: 'ha_entity', resource_id: entity } : null, confidence: 1, source: 'manual' });

function doc(over: Partial<GeometryDoc> = {}): GeometryDoc {
  return {
    ...base,
    levels: [
      { id: 'L0', name: 'קרקע', elevation_m: 0, ceiling_height_m: 2.8, is_default: true },
      { id: 'L1', name: 'עליון', elevation_m: 3, ceiling_height_m: 2.8, is_default: false },
    ],
    walls: [
      wall('w-n', [0.1, 0.1], [0.9, 0.1], { kind: 'exterior' }),
      wall('w-e', [0.9, 0.1], [0.9, 0.9], { kind: 'exterior' }),
      wall('w-s', [0.9, 0.9], [0.1, 0.9], { kind: 'exterior' }),
      wall('w-w', [0.1, 0.9], [0.1, 0.1], { kind: 'exterior' }),
      wall('w-mid', [0.5, 0.1], [0.5, 0.9]),
      wall('w-mid2', [0.5, 0.5], [0.9, 0.5]),
      wall('w-low', [0.2, 0.6], [0.4, 0.6], { kind: 'low', height_m: 0.9 }),
      wall('w-soffit', [0.6, 0.55], [0.6, 0.85], { base_z_m: 2.2, height_m: 0.6 }), // x = 6 m, z 4.4 .. 6.8
      wall('u-n', [0.3, 0.6], [0.9, 0.6], { level_id: 'L1' }),
      wall('u-e', [0.9, 0.6], [0.9, 0.9], { level_id: 'L1' }),
      wall('u-s', [0.9, 0.9], [0.3, 0.9], { level_id: 'L1' }),
    ],
    openings: [
      opening('d-sensed', 'w-mid', 0.25, 'door', 'binary_sensor.d1'), // z = 0.8 + 0.25 x 6.4 = 2.4 m
      opening('d-free', 'w-mid', 0.75, 'door'), // z = 5.6 m, no sensor
      opening('win', 'w-n', 0.25, 'window'), // x = 1 + 0.25 x 8 = 3 m
      opening('pass', 'w-mid2', 0.5, 'passage'), // x = 7 m
      opening('d-ext', 'w-w', 0.5, 'door'), // the west exterior wall, z = 4.8 m
    ],
    objects: [
      { id: 'cab', item_id: 'cabinet.tall', level_id: 'L0', position: [0.75, 0.3], rotation_deg: 0, size: { w_m: 1.0, d_m: 0.6, h_m: 1.8 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false },
      { id: 'tab', item_id: 'table.dining', level_id: 'L0', position: [0.75, 0.75], rotation_deg: 0, size: { w_m: 1.2, d_m: 0.8, h_m: 0.75 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false },
      { id: 'mat', item_id: 'mat.gym', level_id: 'L0', position: [0.3, 0.3], rotation_deg: 0, size: { w_m: 1.0, d_m: 1.0, h_m: 1.0 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false },
    ],
    connectors: [{ id: 'st', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.2, 0.8], [0.45, 0.8]], width_m: 1.0, label: null, object_id: null, source: 'manual' }],
    circuits: [],
    groups: [],
    labels: [],
    rooms: [],
    ...over,
  };
}
const zones = [
  { id: 'z-west', name: 'מערב', polygon: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }, { x: 0.1, y: 0.9 }], level_id: 'L0' },
  { id: 'z-east', name: 'מזרח', polygon: [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.5 }, { x: 0.5, y: 0.5 }], level_id: 'L0' },
];
const camera: SceneAnchor = { id: 'c1', resource_type: 'camera', resource_id: 'cam1', x: 0.85, y: 0.15, rotation: 225, fov: 90, radius: null, polygon: null, level_id: 'L0', layer_id: 'cameras', label: 'מצלמה', state: null, online: true, mount_height_m: 2.6, tilt_deg: 20 };
const input = (d: GeometryDoc, states: Record<string, string | null> = { 'binary_sensor.d1': 'off' }, anchors: SceneAnchor[] = [camera]): SceneInput => ({ doc: d, width: 1000, height: 800, anchors, entityStates: states, circuitStates: {}, zones });
const ctrlFor = (d: GeometryDoc, states?: Record<string, string | null>): WalkController => new WalkController(buildWalkWorld(input(d, states), catalog));
const F = (forward = 1, extra: Partial<WalkInput> = {}): WalkInput => ({ ...NO_INPUT, forward, ...extra });
/** Hold an input for `s` seconds at 60 frames per second; the events of every frame. */
function hold(c: WalkController, inp: WalkInput, s: number): WalkEvent[] {
  const out: WalkEvent[] = [];
  for (let t = 0; t < s - 1e-9; t += 1 / 60) out.push(...c.step(1 / 60, inp));
  return out;
}
const near = (a: number, b: number, tol = 0.02): void => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol);

test('the world: segments by rule, door states, deterministic JSON', () => {
  const w = buildWalkWorld(input(doc()), catalog);
  expect(w.version).toBe('walk-1');
  const l0 = w.levels.find((l) => l.id === 'L0')!;
  const ids = new Set(l0.segs.map((s) => s.id));
  expect(ids.has('w-low')).toBe(true); // a low wall stops the body
  expect(ids.has('w-soffit')).toBe(false); // a soffit above every eye does not
  expect(ids.has('win')).toBe(true); // a window always blocks
  expect(ids.has('pass')).toBe(false); // a passage never
  expect(ids.has('d-sensed')).toBe(true); // closed
  expect(ids.has('d-free')).toBe(false); // unsensed = walkable (owner Q4)
  expect(ids.has('cab')).toBe(true); // 1.8 m tall
  expect(ids.has('tab')).toBe(false); // 0.75 m: under the 0.9 m rule
  expect(ids.has('mat')).toBe(false); // walkable by the catalog
  expect(w.doors.map((d) => [d.id, d.state])).toEqual([['d-ext', 'unsensed'], ['d-free', 'unsensed'], ['d-sensed', 'closed']]);
  expect(JSON.stringify(buildWalkWorld(input(doc()), catalog))).toBe(JSON.stringify(w));
  const shuffled = doc({ walls: [...doc().walls].reverse(), openings: [...doc().openings].reverse(), objects: [...doc().objects].reverse() });
  const w2 = buildWalkWorld({ ...input(shuffled), zones: [...zones].reverse() }, catalog);
  // the same blocking set, whatever the order of the document
  const key = (x: typeof w) => x.levels.map((l) => l.segs.map((s) => JSON.stringify(s)).sort());
  expect(key(w2)).toEqual(key(w));
  expect(w2.doors).toEqual(w.doors);
  expect(w2.bands).toEqual(w.bands);
  expect(w2.starts).toEqual(w.starts);
});

test('door walk state: open passes; closed, stale, locked block; unknown is not open', () => {
  const o = (entity: string | null) => ({ kind: 'door' as const, anchor_ref: entity ? { resource_type: 'ha_entity' as const, resource_id: entity } : null });
  expect(doorWalkState(o(null), {})).toBe('unsensed');
  expect(doorWalkState(o('binary_sensor.d'), { 'binary_sensor.d': 'on' })).toBe('open');
  expect(doorWalkState(o('cover.g'), { 'cover.g': 'opening' })).toBe('open');
  expect(doorWalkState(o('binary_sensor.d'), { 'binary_sensor.d': 'off' })).toBe('closed');
  expect(doorWalkState(o('binary_sensor.d'), { 'binary_sensor.d': null })).toBe('stale');
  expect(doorWalkState(o('binary_sensor.d'), { 'binary_sensor.d': 'unavailable' })).toBe('stale');
  expect(doorWalkState(o('binary_sensor.d'), {})).toBe('stale');
  expect(doorWalkState(o('lock.f'), { 'lock.f': 'locked' })).toBe('locked');
  expect(doorWalkState(o('lock.f'), { 'lock.f': 'jammed' })).toBe('locked');
  expect(doorWalkState(o('lock.f'), { 'lock.f': 'unlocked' })).toBe('unlocked');
});

test('slides along a wall and stops in a corner', () => {
  const c = ctrlFor(doc());
  c.placeAt(3, 2, 'L0', 0);
  hold(c, F(), 2);
  near(c.z, 0.8 + 0.1 + BODY_R); // the north wall's face plus the body
  c.heading = 45;
  const x0 = c.x;
  hold(c, F(), 1);
  expect(c.x).toBeGreaterThan(x0 + 0.5); // slid east along the wall...
  near(c.z, 0.8 + 0.1 + BODY_R); // ...without leaving it
  c.placeAt(8.4, 1.4, 'L0', 45);
  hold(c, F(), 2);
  near(c.x, 9 - 0.1 - BODY_R);
  near(c.z, 0.8 + 0.1 + BODY_R);
});

test('a closed sensed door blocks (with an event); open passes; stale and a locked lock block', () => {
  const blocked = (states: Record<string, string | null>) => {
    const c = ctrlFor(doc(), states);
    c.placeAt(3.5, 2.4, 'L0', 90);
    const ev = hold(c, F(), 3);
    return { x: c.x, ev };
  };
  const shut = blocked({ 'binary_sensor.d1': 'off' });
  near(shut.x, 5 - 0.1 - BODY_R);
  expect(shut.ev.filter((e) => e.type === 'blocked').map((e) => (e as { door: { id: string; state: string } }).door)).toEqual([expect.objectContaining({ id: 'd-sensed', state: 'closed' })]);
  expect(blocked({ 'binary_sensor.d1': 'on' }).x).toBeGreaterThan(5.5);
  near(blocked({ 'binary_sensor.d1': null }).x, 4.62);
  near(blocked({}).x, 4.62);
  const locked = doc({ openings: doc().openings.map((o) => (o.id === 'd-sensed' ? { ...o, anchor_ref: { resource_type: 'ha_entity' as const, resource_id: 'lock.front' } } : o)) });
  const lc = ctrlFor(locked, { 'lock.front': 'locked' });
  lc.placeAt(3.5, 2.4, 'L0', 90);
  hold(lc, F(), 3);
  near(lc.x, 4.62);
  const uc = ctrlFor(locked, { 'lock.front': 'unlocked' });
  uc.placeAt(3.5, 2.4, 'L0', 90);
  hold(uc, F(), 3);
  expect(uc.x).toBeGreaterThan(5.5);
});

test('an unsensed door and a passage pass; a window, a low wall and a tall object block; a soffit and a mat do not', () => {
  const c = ctrlFor(doc());
  c.placeAt(3.5, 5.6, 'L0', 90); // through the unsensed door
  hold(c, F(), 3);
  expect(c.x).toBeGreaterThan(5.5);
  c.placeAt(7, 3, 'L0', 180); // south through the passage
  hold(c, F(), 2);
  expect(c.z).toBeGreaterThan(4.5);
  c.placeAt(3, 1.6, 'L0', 0); // north into the window
  hold(c, F(), 2);
  near(c.z, 0.8 + 0.1 + BODY_R);
  c.placeAt(3, 4.2, 'L0', 180); // south into the low wall at z = 4.8
  hold(c, F(), 2);
  near(c.z, 4.8 - 0.1 - BODY_R);
  c.placeAt(5.5, 5.0, 'L0', 90); // the soffit at x = 6 is above the head
  hold(c, F(), 0.6);
  expect(c.x).toBeGreaterThan(6.2);
  c.placeAt(7.5, 1.5, 'L0', 180); // south into the tall cabinet (z 2.1 .. 2.7)
  hold(c, F(), 2);
  near(c.z, 2.4 - 0.3 - BODY_R);
  c.placeAt(2.0, 2.4, 'L0', 90); // across the gym mat (x 2.5 .. 3.5)
  hold(c, F(), 1.5);
  expect(c.x).toBeGreaterThan(3.6);
});

test('the stair: the ground rises along it, the level switches at the top mouth and back at the bottom one', () => {
  const c = ctrlFor(doc());
  c.placeAt(1.6, 6.4, 'L0', 90);
  const up = hold(c, F(), 1.0);
  const mid = c.pose();
  expect(mid.band).toBe('st');
  expect(mid.ground).toBeGreaterThan(0.2);
  near(mid.y, mid.ground + 1.65, 0.001);
  const more = hold(c, F(), 3);
  const levels = [...up, ...more].filter((e) => e.type === 'level').map((e) => (e as { level: string }).level);
  expect(levels).toEqual(['L1']);
  expect(c.level).toBe('L1');
  expect(c.pose().ground).toBe(3);
  expect(c.x).toBeGreaterThan(4.5);
  // back down: west onto the stair, down, and off at the bottom
  c.heading = 270;
  const down = hold(c, F(), 6);
  expect(down.filter((e) => e.type === 'level').map((e) => (e as { level: string }).level)).toEqual(['L0']);
  expect(c.level).toBe('L0');
  expect(c.pose().ground).toBe(0);
});

test('a stair to another floor stops at its cap and asks to continue there', () => {
  const d = doc({ connectors: [{ id: 'xf', kind: 'stairs', level_from: 'L0', level_to: 'X0', floor_ids: ['f2'], far: { floor_id: 'f2', floor_name: 'קומה 2', level_name: null, direction: 'up', datum_m: 3, level_elevation_m: 0 }, polyline: [[0.2, 0.8], [0.45, 0.8]], width_m: 1.0, label: null, object_id: null, source: 'manual' }] });
  const c = ctrlFor(d);
  c.placeAt(1.6, 6.4, 'L0', 90);
  const ev = hold(c, F(), 5);
  expect(ev.filter((e) => e.type === 'cross-floor')).toEqual([{ type: 'cross-floor', band: 'xf', floor: { id: 'f2', name: 'קומה 2' } }]);
  expect(c.level).toBe('L0');
  expect(c.x).toBeLessThan(4.5 - BODY_R + 0.01); // the cap holds
  expect(c.pose().ground).toBeGreaterThan(2.5);
});

test('the edge of the plan clamps softly', () => {
  const d = doc({ walls: [wall('lonely', [0.4, 0.4], [0.6, 0.4])], openings: [], objects: [], connectors: [] });
  const c = ctrlFor(d);
  c.placeAt(5, 3.5, 'L0', 180);
  const ev = hold(c, F(), 4);
  expect(ev.filter((e) => e.type === 'edge')).toHaveLength(1);
  const ext = c.world.levels[0].extent;
  near(c.z, ext.maxZ - 0.3, 0.001);
});

test('start points: the saved default first, the exterior door facing in, rooms, cameras at their mount', () => {
  const d = doc({ walk_positions: [{ id: 'p1', name: 'כניסה', x: 0.3, y: 0.3, level_id: 'L0', heading_deg: 90 }, { id: 'p2', name: 'סלון', x: 0.7, y: 0.7, level_id: 'L0', heading_deg: 0, is_default: true }] });
  const w = buildWalkWorld(input(d), catalog);
  expect(w.defaultStart).toBe('pos:p2');
  expect(w.starts.map((s) => s.kind)).toEqual(['saved', 'saved', 'door', 'room', 'room', 'camera', 'centre']);
  const door = w.starts.find((s) => s.kind === 'door')!;
  expect(door.x).toBeGreaterThan(1.5); // inside the west wall (x = 1 m)
  expect(door.heading_deg).toBe(90); // facing east, into the building
  const noSaved = buildWalkWorld(input(doc()), catalog);
  expect(noSaved.defaultStart).toBe('door:d-ext');
  const c = new WalkController(w, { eye_m: 1.2 });
  expect(c.pose()).toMatchObject({ x: 7, z: 5.6, heading_deg: 0, level: 'L0' });
  near(c.pose().y, 1.2, 0.001);
  // stand at the camera: its mount height and tilt until the first step, then the eye eases back to the setting
  c.place(w.starts.find((s) => s.kind === 'camera')!);
  c.step(0.5);
  expect(c.pose().pitch_deg).toBe(-20);
  near(c.pose().y, 2.6, 0.01);
  hold(c, F(), 1);
  near(c.pose().y, 1.2, 0.02);
});

test('A* walks through the open door and never through a closed one', () => {
  const c = ctrlFor(doc());
  c.placeAt(3, 2.4, 'L0', 0);
  const path = c.pathTo(6.3, 2.4);
  expect(path).not.toBeNull();
  // the sensed door at z = 2.4 is closed: the path crosses the middle wall at the unsensed door (z = 5.6)
  const crossing = [[c.x, c.z] as [number, number], ...path!].findIndex((p, i, all) => i > 0 && (all[i - 1][0] - 5) * (p[0] - 5) <= 0);
  const all = [[c.x, c.z] as [number, number], ...path!];
  const a = all[crossing - 1];
  const b = all[crossing];
  const zAt5 = a[1] + ((b[1] - a[1]) * (5 - a[0])) / (b[0] - a[0] || 1);
  near(zAt5, 5.6, 0.5);
  const ev = hold(c, NO_INPUT, 20);
  expect(ev.some((e) => e.type === 'arrived')).toBe(true);
  near(c.x, 6.3, 0.2);
  near(c.z, 2.4, 0.2);
  // both doors closed: unreachable
  const shut = doc({ openings: doc().openings.map((o) => (o.id === 'd-free' ? { ...o, anchor_ref: { resource_type: 'ha_entity' as const, resource_id: 'binary_sensor.d2' } } : o)) });
  const c2 = ctrlFor(shut, { 'binary_sensor.d1': 'off', 'binary_sensor.d2': 'off' });
  c2.placeAt(3, 2.4, 'L0', 0);
  expect(c2.pathTo(6.3, 2.4)).toBeNull();
  // open the sensed door: the straight way
  const c3 = ctrlFor(shut, { 'binary_sensor.d1': 'on', 'binary_sensor.d2': 'off' });
  c3.placeAt(3, 2.4, 'L0', 0);
  expect(c3.pathTo(6.3, 2.4)).toEqual([[6.3, 2.4]]);
});

test('a scripted input sequence gives the same poses every time (determinism)', () => {
  const script: [number, WalkInput][] = [];
  for (let i = 0; i < 240; i++) script.push([i % 7 === 0 ? 1 / 30 : 1 / 60, { forward: i < 120 ? 1 : 0.5, strafe: i % 50 < 10 ? 1 : 0, turn: i > 180 ? -1 : 0, run: i % 40 < 20 }]);
  const run = (): string => {
    const c = ctrlFor(doc());
    c.placeAt(1.6, 6.4, 'L0', 90);
    const out: unknown[] = [];
    for (const [dt, inp] of script) out.push([c.pose(), c.step(dt, inp)]);
    out.push(c.pathTo(7, 2.4));
    return JSON.stringify(out);
  };
  expect(run()).toBe(run());
});

test('the minimap frame maps metres to pixels and back', () => {
  const w = buildWalkWorld(input(doc()), catalog);
  const f = minimapFrame(w.levels[0].extent, 160);
  const [px, py] = f.toPx(5, 4);
  const [x, z] = f.toM(px, py);
  near(x, 5, 1e-9);
  near(z, 4, 1e-9);
  expect(px).toBeGreaterThan(0);
  expect(px).toBeLessThan(160);
});
