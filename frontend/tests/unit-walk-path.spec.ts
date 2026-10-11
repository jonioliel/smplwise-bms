import { test, expect } from '@playwright/test';
import type { GeometryDoc } from '../src/map/geometry';
import { BODY_R, NO_INPUT, STUCK_S, WalkController, type WalkEvent } from '../src/map/walk-controller';
import { GRID_M, MAX_ASTAR_CELLS, closestOnSeg, findPath, gridBuilds, gridFor, levelSegments } from '../src/map/walk-path';
import { resolveLongPress, resolveTap, type TapHit, type TapView } from '../src/map/walk-tap';
import { ROUTE_DWELL_MS, RoutePlayer, routeStops } from '../src/map/walk-route';
import type { WalkStart, WalkWorld } from '../src/map/walk-world';
import { opening, walkDoc, walkWorld } from './walk-fixtures';

// Plan Studio 6, slice S5-A (CR-029 section 8, S5 row): tap-to-walk in node - the A* on the 0.25 m grid goes through an open
// door, a passage, and never through a closed / locked / stale door or a window; the grid is built once per world; a tap means
// "walk there" (and stops a walk under way) and never operates a device; a long press picks the device; the auto-walk gives up
// when a new world closes its way or the body stops; the saved positions play as a route on a scripted clock.
//   npx playwright test tests/unit-walk-path.spec.ts --project=desktop
// 10 m x 8 m plan (walk-fixtures.ts): the middle wall at x = 5 m has a sensed door at z = 2.4 m and an unsensed one at z = 5.6 m.
const near = (a: number, b: number, tol = 0.02): void => expect(Math.abs(a - b), `${a} vs ${b}`).toBeLessThanOrEqual(tol);
const D1 = 'binary_sensor.d1';
const D2 = 'binary_sensor.d2';

/** The z where the polyline from `from` through `path` crosses the vertical line x = `at` (null = it never does). */
function crossZ(from: [number, number], path: [number, number][], at: number): number | null {
  const all = [from, ...path];
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1];
    const b = all[i];
    if ((a[0] - at) * (b[0] - at) <= 0 && a[0] !== b[0]) return a[1] + ((b[1] - a[1]) * (at - a[0])) / (b[0] - a[0]);
  }
  return null;
}
const withDoor2 = (): GeometryDoc => walkDoc({ openings: walkDoc().openings.map((o) => (o.id === 'd-free' ? { ...o, anchor_ref: { resource_type: 'ha_entity' as const, resource_id: D2 } } : o)) });
const R = BODY_R;

test('A* goes through the open door and never through a closed one', () => {
  const w = walkWorld(walkDoc(), { [D1]: 'off' }); // the sensed door at z 2.4 is closed, the unsensed one at z 5.6 is walkable
  const from: [number, number] = [3, 2.4];
  const path = findPath(w, 'L0', from, [6.3, 2.4], R);
  expect(path).not.toBeNull();
  near(crossZ(from, path!, 5)!, 5.6, 0.5); // the way around, through the other door
  near(path![path!.length - 1][0], 6.3, 1e-3);
  // the sensed door open: the straight way, one leg
  expect(findPath(walkWorld(walkDoc(), { [D1]: 'on' }), 'L0', from, [6.3, 2.4], R)).toEqual([[6.3, 2.4]]);
  // both doors closed: no way
  expect(findPath(walkWorld(withDoor2(), { [D1]: 'off', [D2]: 'off' }), 'L0', from, [6.3, 2.4], R)).toBeNull();
  // and the second door open again: through that one
  const second = findPath(walkWorld(withDoor2(), { [D1]: 'off', [D2]: 'on' }), 'L0', from, [6.3, 2.4], R)!;
  near(crossZ(from, second, 5)!, 5.6, 0.5);
});

test('a locked or an unknown door blocks, an unlocked one does not', () => {
  const lockDoc = (id: string) => walkDoc({ openings: walkDoc().openings.map((o) => (o.id === id ? { ...o, anchor_ref: { resource_type: 'ha_entity' as const, resource_id: 'lock.front' } } : o)) });
  const from: [number, number] = [3, 2.4];
  // the sensed door is a lock now: locked = closed, unlocked = open, a lock nobody reports = stale = closed
  const d1 = lockDoc('d-sensed');
  expect(crossZ(from, findPath(walkWorld(d1, { 'lock.front': 'locked' }), 'L0', from, [6.3, 2.4], R)!, 5)!).toBeGreaterThan(4.5); // around, through z 5.6
  expect(findPath(walkWorld(d1, { 'lock.front': 'unlocked' }), 'L0', from, [6.3, 2.4], R)).toEqual([[6.3, 2.4]]);
  expect(crossZ(from, findPath(walkWorld(d1, {}), 'L0', from, [6.3, 2.4], R)!, 5)!).toBeGreaterThan(4.5);
  // both doors a lock that is locked / jammed / unknown: nothing gets through
  const both = walkDoc({ openings: walkDoc().openings.map((o) => (o.id === 'd-sensed' || o.id === 'd-free' ? { ...o, anchor_ref: { resource_type: 'ha_entity' as const, resource_id: 'lock.front' } } : o)) });
  for (const s of ['locked', 'jammed', 'unavailable', 'unknown']) expect(findPath(walkWorld(both, { 'lock.front': s }), 'L0', from, [6.3, 2.4], R), s).toBeNull();
  // a sensor that reports unavailable is stale: not open
  const stale = findPath(walkWorld(withDoor2(), { [D1]: 'unavailable', [D2]: 'unavailable' }), 'L0', from, [6.3, 2.4], R);
  expect(stale).toBeNull();
});

test('a window never opens, a passage always does', () => {
  const partition = (kind: 'window' | 'passage') => walkDoc({ openings: [opening('o1', 'w-mid', 0.25, kind)] }); // z = 2.4 m, nothing else in the wall
  const from: [number, number] = [3, 2.4];
  expect(findPath(walkWorld(partition('window')), 'L0', from, [6.3, 2.4], R)).toBeNull();
  const through = findPath(walkWorld(partition('passage')), 'L0', from, [6.3, 2.4], R);
  expect(through).toEqual([[6.3, 2.4]]);
});

test('a target inside something solid takes the nearest free cell; far inside it there is none', () => {
  const w = walkWorld(walkDoc(), { [D1]: 'on' });
  const from: [number, number] = [6, 1.5];
  // the middle of the tall cabinet (x 7 .. 8, z 2.1 .. 2.7)
  const p = findPath(w, 'L0', from, [7.5, 2.4], R)!;
  const end = p[p.length - 1];
  expect(Math.abs(end[0] - 7.5) + Math.abs(end[1] - 2.4)).toBeGreaterThan(0.2);
  const cab = w.levels[0].segs.filter((s) => s.id === 'cab');
  for (const s of cab) expect(closestOnSeg(end[0], end[1], s).d).toBeGreaterThanOrEqual(R * 0.85 - 1e-6);
  // a tap well inside a big solid object (0.6 m from its north edge) goes to its foot: the inside is solid too, not a free island
  const wide = walkDoc({ objects: [{ id: 'blk', item_id: 'cabinet.tall', level_id: 'L0', position: [0.75, 0.75], rotation_deg: 0, size: { w_m: 2, d_m: 2, h_m: 1.8 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false }] }); // x 6.5 .. 8.5, z 5 .. 7
  const ww = walkWorld(wide, { [D1]: 'on' });
  const grid = gridFor(ww, 'L0', R)!;
  const cellAt = (x: number, z: number): number => grid.blocked[Math.floor((z - grid.minZ) / GRID_M) * grid.cols + Math.floor((x - grid.minX) / GRID_M)];
  expect(cellAt(7.5, 6)).toBe(1); // the middle of the block, a metre from every edge, is blocked: not a hole
  const inside = findPath(ww, 'L0', [6, 1.5], [7.1, 5.6], R)!;
  expect(inside).not.toBeNull();
  const foot = inside[inside.length - 1];
  expect(foot[0] > 6.5 && foot[0] < 8.5 && foot[1] > 5 && foot[1] < 7).toBe(false);
  expect(Math.hypot(foot[0] - 7.1, foot[1] - 5.6)).toBeLessThan(1.1);
  // a solid block 4 m across: its middle is more than a metre from any free cell
  const big = walkDoc({ objects: [{ id: 'blk', item_id: 'cabinet.tall', level_id: 'L0', position: [0.3, 0.3], rotation_deg: 0, size: { w_m: 4, d_m: 4, h_m: 1.8 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false }] });
  expect(findPath(walkWorld(big, { [D1]: 'on' }), 'L0', [6, 5], [3, 3], R)).toBeNull();
});

test('the blocked grid is built once per world object and again for a new one', () => {
  const doc = walkDoc();
  const w = walkWorld(doc, { [D1]: 'off' });
  const before = gridBuilds();
  findPath(w, 'L0', [3, 2.4], [6.3, 2.4], R);
  findPath(w, 'L0', [3, 6], [6.3, 6], R);
  findPath(w, 'L0', [2, 2], [4, 3], R);
  expect(gridBuilds() - before).toBe(1);
  expect(gridFor(w, 'L0', R)).toBe(gridFor(w, 'L0', R));
  const again = walkWorld(doc, { [D1]: 'on' }); // a door opened: a new world, a new grid
  findPath(again, 'L0', [3, 2.4], [6.3, 2.4], R);
  expect(gridBuilds() - before).toBe(2);
  // the grid blocks exactly where the segments are: the cell of a wall centre is blocked, the middle of the room is free
  const g = gridFor(w, 'L0', R)!;
  const cell = (x: number, z: number): number => Math.floor((z - g.minZ) / GRID_M) * g.cols + Math.floor((x - g.minX) / GRID_M);
  expect(g.blocked[cell(5, 1.5)]).toBe(1); // inside the middle wall
  expect(g.blocked[cell(3, 4)]).toBe(0);
  expect(levelSegments(w, 'L0').length).toBeGreaterThan(w.levels[0].segs.length); // the level's own plus the stair's sides
  // deterministic: the same call gives the same path
  expect(JSON.stringify(findPath(w, 'L0', [3, 2.4], [6.3, 2.4], R))).toBe(JSON.stringify(findPath(walkWorld(doc, { [D1]: 'off' }), 'L0', [3, 2.4], [6.3, 2.4], R)));
});

test('a level too large for the grid, an unknown level and an unreachable start give no path', () => {
  const huge: WalkWorld = { version: 'walk-1', scale: 0.01, estimated: false, levels: [{ id: 'L0', name: '', elevation_m: 0, ceiling_height_m: 2.8, extent: { minX: 0, minZ: 0, maxX: 2000, maxZ: 2000 }, segs: [] }], bands: [], doors: [], rooms: [], starts: [], defaultStart: null };
  expect((2000 / GRID_M) ** 2).toBeGreaterThan(MAX_ASTAR_CELLS);
  expect(findPath(huge, 'L0', [1, 1], [10, 10], R)).toBeNull();
  expect(findPath(walkWorld(walkDoc()), 'nope', [1, 1], [2, 2], R)).toBeNull();
});

// ---- tap and long press

const fakeView = (hit: TapHit | null, floor: [number, number] | null): TapView & { asked: number[][] } => {
  const asked: number[][] = [];
  return { asked, pickAt: (x, y) => (asked.push([x, y]), hit), floorPoint: (x, y, g) => (asked.push([x, y, g]), floor) };
};
const hit = (kind: string, point: [number, number, number]): TapHit => ({ id: `${kind}-1`, kind, partId: `p-${kind}`, point });
const ctrlFor = (doc: GeometryDoc, states: Record<string, string | null>, at: [number, number] = [3, 2.4]): WalkController => {
  const c = new WalkController(walkWorld(doc, states));
  c.placeAt(at[0], at[1], 'L0', 0);
  return c;
};

test('a tap walks to the floor point; a tap while walking stops; the next tap walks again', () => {
  const c = ctrlFor(walkDoc(), { [D1]: 'on' });
  const r = resolveTap(fakeView(null, [6.3, 2.4]), c, 100, 200);
  expect(r.kind).toBe('walk');
  expect(c.path).not.toBeNull();
  near((r as { target: [number, number] }).target[0], 6.3, 1e-3);
  const stop = resolveTap(fakeView(null, [8, 6]), c, 50, 50);
  expect(stop).toEqual({ kind: 'cancel' });
  expect(c.path).toBeNull(); // the walk stopped where it stood; no new path
  expect(resolveTap(fakeView(null, [8, 6]), c, 50, 50).kind).toBe('walk');
});

test('a tap on a wall, a chair or a lamp walks to its foot - it never picks a device', () => {
  // the ray met the tall cabinet at its west face (x 7, z 2.4): the walk ends at the nearest free cell, not inside it
  const c = ctrlFor(walkDoc(), { [D1]: 'on' }, [6, 1.5]);
  const r = resolveTap(fakeView(hit('object', [7, 1.2, 2.4]), [9, 2.4]), c, 10, 10);
  expect(r.kind).toBe('walk');
  const t = (r as { target: [number, number] }).target;
  expect(Math.hypot(t[0] - 7, t[1] - 2.4)).toBeLessThan(1); // at the cabinet's foot, not at the floor point beyond it (9, 2.4)
  expect(t[0] > 7 && t[0] < 8 && t[1] > 2.1 && t[1] < 2.7).toBe(false); // and not inside it
  // a room's tint plane or a level plate is the floor: the exact floor point is used
  const c1 = ctrlFor(walkDoc(), { [D1]: 'on' }, [6, 1.5]);
  const z = resolveTap(fakeView(hit('zone', [1, 0, 1]), [4, 4]), c1, 10, 10);
  expect(z.kind).toBe('walk');
  near((z as { target: [number, number] }).target[0], 4, 1e-3);
  // nothing under the finger and no floor point (the sky, the ceiling): nothing happens
  const c2 = ctrlFor(walkDoc(), { [D1]: 'on' });
  expect(resolveTap(fakeView(null, null), c2, 10, 10)).toEqual({ kind: 'none' });
  expect(c2.path).toBeNull();
  // no way (both doors closed): unreachable, and the walk is not started
  const c3 = ctrlFor(withDoor2(), { [D1]: 'off', [D2]: 'off' });
  expect(resolveTap(fakeView(null, [6.3, 2.4]), c3, 10, 10)).toEqual({ kind: 'unreachable' });
  expect(c3.path).toBeNull();
});

test('a long press picks the device under the finger and nothing else', () => {
  for (const kind of ['entity', 'camera', 'object', 'opening']) expect(resolveLongPress(fakeView(hit(kind, [1, 1, 1]), null), 5, 5)?.kind, kind).toBe(kind);
  for (const kind of ['wall', 'zone', 'connector', 'label', 'level']) expect(resolveLongPress(fakeView(hit(kind, [1, 1, 1]), null), 5, 5), kind).toBeNull();
  expect(resolveLongPress(fakeView(null, [1, 1]), 5, 5)).toBeNull();
});

// ---- the auto-walk gives up

test('a new world that closes a leg of the auto-walk cancels it; one that does not, keeps it', () => {
  const c = ctrlFor(walkDoc(), { [D1]: 'on' });
  c.pathTo(6.3, 2.4); // straight through the open sensed door
  expect(c.path).toEqual([[6.3, 2.4]]);
  expect(c.setWorld(walkWorld(walkDoc(), { [D1]: 'on' }))).toEqual([]); // the same state: kept
  expect(c.path).not.toBeNull();
  expect(c.setWorld(walkWorld(withDoor2(), { [D1]: 'on', [D2]: 'off' }))).toEqual([]); // the other door closed: not on the way
  expect(c.path).not.toBeNull();
  const ev = c.setWorld(walkWorld(walkDoc(), { [D1]: 'off' })); // the door on the way closed
  expect(ev).toEqual([{ type: 'path-blocked' }]);
  expect(c.path).toBeNull();
  // a world change with no path under way says nothing
  expect(c.setWorld(walkWorld(walkDoc(), { [D1]: 'on' }))).toEqual([]);
});

test('an auto-walk that makes no progress gives up after STUCK_S; a normal walk arrives', () => {
  const c = ctrlFor(walkDoc(), { [D1]: 'off' }, [4.2, 2.4]);
  c.heading = 90;
  c.path = [[6.3, 2.4]]; // forced straight at the closed door (x = 5)
  const events: WalkEvent[] = [];
  let t = 0;
  while (t < STUCK_S - 0.1) {
    events.push(...c.step(1 / 60, NO_INPUT));
    t += 1 / 60;
  }
  expect(events.some((e) => e.type === 'path-blocked')).toBe(false); // not yet
  expect(c.path).not.toBeNull();
  while (t < STUCK_S + 0.5) {
    events.push(...c.step(1 / 60, NO_INPUT));
    t += 1 / 60;
  }
  expect(events.filter((e) => e.type === 'path-blocked')).toHaveLength(1);
  expect(events.some((e) => e.type === 'blocked')).toBe(true); // it had bumped the door
  expect(c.path).toBeNull();
  expect(c.x).toBeLessThan(5);
  // a walk that is going somewhere is never stuck
  const ok = ctrlFor(walkDoc(), { [D1]: 'on' }, [3, 2.4]);
  ok.pathTo(7, 2.4);
  const ev: WalkEvent[] = [];
  for (let i = 0; i < 60 * 8 && ok.path; i++) ev.push(...ok.step(1 / 60, NO_INPUT));
  expect(ev.some((e) => e.type === 'arrived')).toBe(true);
  expect(ev.some((e) => e.type === 'path-blocked')).toBe(false);
  near(ok.x, 7, 0.2);
  // a failed pathTo leaves a walk under way as it was
  const keep = ctrlFor(withDoor2(), { [D1]: 'off', [D2]: 'off' });
  keep.path = [[1.5, 1.5]];
  expect(keep.pathTo(6.3, 2.4)).toBeNull();
  expect(keep.path).toEqual([[1.5, 1.5]]);
});

// ---- the route

const saved = (n: number): WalkStart[] => Array.from({ length: n }, (_, i) => ({ id: `pos:p${i}`, kind: 'saved', label: `עמדה ${i}`, level: 'L0', x: 2 + i, z: 3, heading_deg: i * 90, pitch_deg: 0, eye_m: null }));

test('the route is the saved positions in order; it plays one stop per dwell on a scripted clock', () => {
  const mixed: WalkStart[] = [{ id: 'door:d', kind: 'door', label: 'כניסה', level: 'L0', x: 1, z: 1, heading_deg: 0, pitch_deg: 0, eye_m: null }, ...saved(3), { id: 'centre', kind: 'centre', label: 'מרכז', level: 'L0', x: 5, z: 4, heading_deg: 0, pitch_deg: 0, eye_m: null }];
  const stops = routeStops(mixed);
  expect(stops.map((s) => s.id)).toEqual(['pos:p0', 'pos:p1', 'pos:p2']);
  const p = new RoutePlayer(stops);
  expect(p.playable).toBe(true);
  expect(p.playing).toBe(false);
  expect(p.advance(1000)).toBeNull(); // not started
  expect(p.start(0)).toEqual({ index: 0, stop: stops[0] });
  expect(p.dueAt).toBe(ROUTE_DWELL_MS);
  expect(ROUTE_DWELL_MS).toBe(4000);
  expect(p.advance(3999)).toBeNull();
  expect(p.advance(4000)).toEqual({ index: 1, stop: stops[1] });
  expect(p.dueAt).toBe(8000);
  expect(p.advance(8000)).toEqual({ index: 2, stop: stops[2] });
  expect(p.advance(11999)).toBeNull();
  expect(p.advance(12000)).toBe('end'); // the last stop shows for its dwell, then the route is over
  expect(p.playing).toBe(false);
  expect(p.dueAt).toBeNull();
  expect(p.advance(99999)).toBeNull();
  // a long pause (a hidden tab) advances ONE stop, then waits a dwell: the clock never catches up in a burst
  const q = new RoutePlayer(stops);
  q.start(0);
  expect(q.advance(100000)).toEqual({ index: 1, stop: stops[1] });
  expect(q.dueAt).toBe(104000);
  q.stop();
  expect(q.playing).toBe(false);
  expect(q.advance(200000)).toBeNull();
});

test('a route needs two stops; looping wraps; the dwell is configurable', () => {
  expect(new RoutePlayer(saved(1)).playable).toBe(false);
  expect(new RoutePlayer(saved(1)).start(0)).toBeNull();
  expect(new RoutePlayer([]).start(0)).toBeNull();
  const l = new RoutePlayer(saved(2), { dwellMs: 1000, loop: true });
  l.start(0);
  expect(l.advance(1000)).toMatchObject({ index: 1 });
  expect(l.advance(2000)).toMatchObject({ index: 0 }); // wrapped
  expect(l.playing).toBe(true);
  expect(l.dueAt).toBe(3000);
  // a restart after the end
  const o = new RoutePlayer(saved(2), { dwellMs: 500 });
  o.start(0);
  o.advance(500);
  expect(o.advance(1000)).toBe('end');
  expect(o.start(5000)).toMatchObject({ index: 0 });
});
