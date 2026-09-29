import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScene, LANDING_PLATE_M } from '../src/map/scene-builder';
import { connectorLabel, crossFloorLabel, rebuildStair, stairCaption, stairPath, stairPlan, stairRise, turnOf, type GeomConnector, type GeometryDoc, type GeomLevel, type Pt } from '../src/map/geometry';
import { connectorTargets, currentTarget, floorLinks, otherFloorOf, parseTarget, targetValue, type LinkTargetFloor } from '../src/map/connector-targets';
import { addStair, levelUsage, moveConnector, moveConnectorVertex, rotateConnector, STAIR_ALIASES } from '../src/map/studio-ops';

// Stairs between floors and stairs with a landing (T085, owner 2026-09-29): the U / L / straight walking line generated
// from a start, a direction, a width, the flights and the landing; the plan drawing (flights with a line per riser, the
// landing rectangle, the break line) and its tread counts; the rise; the "מחבר אל" picker's options and value; the
// cross-floor label; the connector moves and turns. Runs in node: no page, no backend.
const W = 1000;
const H = 1000;
const SCALE = 0.01; // 1 px = 1 cm
const near = (a: Pt[], b: Pt[]) => {
  expect(a.length).toBe(b.length);
  a.forEach((p, i) => {
    expect(Math.abs(p[0] - b[i][0]), `x${i}`).toBeLessThan(1e-6);
    expect(Math.abs(p[1] - b[i][1]), `y${i}`).toBeLessThan(1e-6);
  });
};
const C = (o: Partial<GeomConnector>): GeomConnector => ({ id: 's1', kind: 'stairs', level_from: 'L0', level_to: null, floor_ids: [], polyline: [], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {}, ...o });
const LEVELS: GeomLevel[] = [
  { id: 'L0', name: 'מפלס ראשי', elevation_m: 0, ceiling_height_m: 2.8, is_default: true },
  { id: 'L1', name: 'גלריה', elevation_m: 2.4, ceiling_height_m: 2.6, is_default: false },
];

test.describe('stairs model (T085)', () => {
  test('a U stair: two parallel flights one width plus the well apart, the landing spanning both', () => {
    const path = stairPath({ shape: 'u', start: [0.5, 0.8], dir: [0, -1], width_m: 1.2, runs_m: [12 * 0.28, 12 * 0.28], landing_m: 1.2, turn: 'right' }, W, H, SCALE);
    // flight 1 runs 3.36 m up, the landing centre 0.6 m further; flight 2 starts 1.2 + 0.1 m to the right and runs back down
    near(path, [[0.5, 0.8], [0.5, 0.404], [0.63, 0.404], [0.63, 0.8]]);
    expect(turnOf(path)).toBe('right');
    expect(turnOf([...path].reverse())).toBe('left');
    const left = stairPath({ shape: 'u', start: [0.5, 0.8], dir: [0, -1], width_m: 1.2, runs_m: [3.36, 3.36], landing_m: 1.2, turn: 'left' }, W, H, SCALE);
    expect(left[2][0]).toBeCloseTo(0.37, 6);
    const plan = stairPlan(C({ shape: 'u', turn: 'right', flights: [{ steps: 12 }, { steps: 12 }], landing_depth_m: 1.2, polyline: path }), W, H, SCALE)!;
    expect(plan.shape).toBe('u');
    expect(plan.flights.map((f) => f.steps)).toEqual([12, 12]);
    expect(plan.flights.map((f) => f.treads.length)).toEqual([11, 11]);
    expect(plan.flights[0].from).toEqual([500, 800]);
    expect(plan.flights[0].to).toEqual([500, 464]); // 12 x 28 cm
    expect(plan.flights[1].from).toEqual([630, 464]);
    expect(plan.flights[1].to).toEqual([630, 800]);
    expect(plan.landings).toEqual([[[440, 464], [690, 464], [690, 344], [440, 344]]]);
    expect(plan.caption).toBe('12+12 מדרגות · פודסט');
    expect(plan.breakLine).not.toBeNull();
    expect(plan.walk).toEqual([[500, 800], [500, 404], [630, 404], [630, 800]]);
  });

  test('an L stair turns on a square landing; a straight stair with two flights gets a mid landing; a plain connector has no stair plan', () => {
    const path = stairPath({ shape: 'l', start: [0.2, 0.8], dir: [0, -1], width_m: 1, runs_m: [2, 1.5], landing_m: 1, turn: 'right' }, W, H, SCALE);
    near(path, [[0.2, 0.8], [0.2, 0.55], [0.4, 0.55]]);
    const l = stairPlan(C({ shape: 'l', flights: [{ steps: 8 }, { steps: 6 }], width_m: 1, landing_depth_m: 1, polyline: path }), W, H, SCALE)!;
    expect(l.landings[0]).toEqual([[150, 600], [250, 600], [250, 500], [150, 500]]);
    expect(l.flights[1].from).toEqual([250, 550]);
    expect(l.flights[1].to).toEqual([400, 550]);
    const straight = stairPath({ shape: 'straight', start: [0.1, 0.5], dir: [1, 0], width_m: 1.2, runs_m: [2.8, 2.8], landing_m: 1, turn: 'right' }, W, H, SCALE);
    near(straight, [[0.1, 0.5], [0.76, 0.5]]);
    const s = stairPlan(C({ shape: 'straight', flights: [{ steps: 10 }, { steps: 10 }], landing_depth_m: 1, polyline: straight }), W, H, SCALE)!;
    expect(s.flights.map((f) => [f.from[0], f.to[0]])).toEqual([[100, 380], [480, 760]]);
    expect(s.landings).toHaveLength(1);
    expect(s.caption).toBe('10+10 מדרגות · פודסט');
    expect(stairPlan(C({ polyline: [[0.1, 0.1], [0.2, 0.1]] }), W, H, SCALE)).toBeNull(); // no model: the plain band
    expect(stairPlan(C({ shape: 'u', flights: [{ steps: 5 }, { steps: 5 }], polyline: [[0.1, 0.1], [0.2, 0.1]] }), W, H, SCALE)).toBeNull(); // a U needs 4 points
    expect(stairCaption({ flights: [{ steps: 16 }], shape: 'straight' })).toBe('16 מדרגות');
  });

  test('changing the steps or the shape rebuilds the walking line from its start with the same going', () => {
    const path = stairPath({ shape: 'u', start: [0.5, 0.8], dir: [0, -1], width_m: 1.2, runs_m: [3.36, 3.36], landing_m: 1.2, turn: 'right' }, W, H, SCALE);
    const c = C({ shape: 'u', turn: 'right', flights: [{ steps: 12 }, { steps: 12 }], landing_depth_m: 1.2, polyline: path });
    const fewer = rebuildStair(c, { flights: [{ steps: 10 }, { steps: 10 }] }, W, H, SCALE);
    near(fewer.polyline!, [[0.5, 0.8], [0.5, 0.46], [0.63, 0.46], [0.63, 0.8]]);
    const straight = rebuildStair(c, { shape: 'straight' }, W, H, SCALE);
    expect(straight.shape).toBe('straight');
    expect(straight.polyline).toHaveLength(2);
    const toL = rebuildStair(C({ shape: 'straight', flights: [{ steps: 16 }], polyline: [[0.5, 0.8], [0.5, 0.352]] }), { shape: 'l' }, W, H, SCALE);
    expect(toL.flights).toEqual([{ steps: 8 }, { steps: 8 }]);
    expect(toL.polyline).toHaveLength(3);
    expect(toL.landing_depth_m).toBe(1.2);
  });

  test('the rise: the level difference on one floor, 3 m up or down to another floor', () => {
    const levels = new Map(LEVELS.map((l) => [l.id, l]));
    expect(stairRise(levels, { level_from: 'L0', level_to: 'L1', floor_ids: [], far: null })).toBeCloseTo(2.4, 9);
    expect(stairRise(levels, { level_from: 'L0', level_to: 'X', floor_ids: ['f0', 'f1'], far: { floor_id: 'f1', floor_name: 'קומה 1', level_name: 'גלריה', direction: 'up' } })).toBe(3);
    expect(stairRise(levels, { level_from: 'L0', level_to: 'X', floor_ids: ['f0', 'f1'], far: { floor_id: 'f1', floor_name: 'קומה 0', level_name: null, direction: 'down' } })).toBe(-3);
    expect(stairRise(levels, { level_from: 'L0', level_to: null, floor_ids: [], far: null })).toBe(3);
  });

  test('the cross-floor label names the floor and the level there; the level id of the other floor never reads as this floor\'s', () => {
    const levels = new Map(LEVELS.map((l) => [l.id, l]));
    const far = { floor_id: 'f1', floor_name: 'קומה 1', level_name: 'גלריה', direction: 'up' as const };
    expect(connectorLabel(levels, { level_from: 'L0', level_to: 'L1', label: null, floor_ids: ['f0', 'f1'], far })).toBe('↑ קומה 1 · גלריה');
    expect(crossFloorLabel({ far: { ...far, direction: 'down', level_name: null } })).toBe('↓ קומה 1');
    expect(crossFloorLabel({ far: { ...far, direction: null } })).toBe('↔ קומה 1 · גלריה');
    expect(crossFloorLabel({ far: { floor_id: 'f1', floor_name: null, level_name: null, direction: null, missing: true } })).toBe('↕');
    expect(connectorLabel(levels, { level_from: 'L0', level_to: null, label: null, floor_ids: ['f0', 'f1'] })).toBe('↕'); // a link from before T085
    expect(connectorLabel(levels, { level_from: 'L0', level_to: 'L1', label: null, floor_ids: [] })).toBe('↑ +2.4 מ׳');
  });

  test('the "מחבר אל" picker lists this floor\'s other levels and every level of the other floors that have a plan', () => {
    const doc = { floor_id: 'f0', levels: LEVELS } as Pick<GeometryDoc, 'floor_id' | 'levels'>;
    const floors: LinkTargetFloor[] = [
      { floor_id: 'f1', name: 'קומה 1', level: 1, version_id: 'v1', same_frame: true, levels: [{ id: 'L0', name: 'מפלס ברירת מחדל', elevation_m: 0, is_default: true }, { id: 'G', name: 'גלריה', elevation_m: 2, is_default: false }] },
      { floor_id: 'f2', name: 'קומה 2', level: 2, version_id: null, same_frame: false, levels: [] },
    ];
    const g = connectorTargets(doc, { level_from: 'L0' }, floors);
    expect(g.here.map((o) => [o.value, o.label])).toEqual([['here:L1', 'גלריה']]);
    expect(g.floors.map((f) => f.options.map((o) => o.label))).toEqual([['קומה 1 · מפלס ברירת מחדל', 'קומה 1 · גלריה']]);
    expect(g.floors[0].options[1].value).toBe(targetValue('f1', 'G'));
    expect(parseTarget('f1:G')).toEqual({ floorId: 'f1', levelId: 'G' });
    expect(parseTarget('here:L1')).toEqual({ floorId: null, levelId: 'L1' });
    expect(parseTarget('bad')).toBeNull();
    expect(currentTarget(doc, { floor_ids: ['f0', 'f1'], far: null, level_to: 'G' })).toBe('f1:G');
    expect(currentTarget(doc, { floor_ids: [], far: null, level_to: 'L1' })).toBe('here:L1');
    expect(currentTarget(doc, { floor_ids: [], far: null, level_to: null })).toBe('');
    expect(otherFloorOf(doc, { floor_ids: ['f0', 'f1'], far: null })).toBe('f1');
  });

  test('a stair is placed from one click, moved and turned as a whole; a moved twin is placed; a far level never counts as a level here', () => {
    const doc = { floor_id: 'f0', levels: LEVELS, connectors: [] as GeomConnector[], walls: [], labels: [], objects: [] } as unknown as GeometryDoc;
    const alias = STAIR_ALIASES['stairs.landing'];
    const r = addStair(doc, { shape: alias.shape!, start: [0.5, 0.9], flights: alias.flights, width_m: alias.width_m, levelFrom: 'L0', levelTo: null }, W, H, SCALE);
    const c = r.doc.connectors[0];
    expect(c.shape).toBe('u');
    expect(c.polyline).toHaveLength(4);
    expect(c.flights).toEqual([{ steps: 9 }, { steps: 9 }]);
    expect(stairPlan(c, W, H, SCALE)!.flights.map((f) => f.treads.length)).toEqual([8, 8]);
    const twin = { ...c, needs_placement: true, floor_ids: ['f0', 'f1'], level_to: 'L1' };
    const d1 = { ...r.doc, connectors: [twin] };
    const moved = moveConnector(d1, c.id, 0.1, -0.05).connectors[0];
    expect(moved.polyline[0][0]).toBeCloseTo(c.polyline[0][0] + 0.1, 5);
    expect(moved.needs_placement).toBeUndefined();
    expect(moveConnectorVertex(d1, c.id, 0, [0.4, 0.9]).connectors[0].needs_placement).toBeUndefined();
    const turned = rotateConnector(r.doc, c.id, 90, W, H).connectors[0];
    expect(turnOf(turned.polyline)).toBe(turnOf(c.polyline));
    expect(Math.abs(turned.polyline[1][1] - turned.polyline[0][1])).toBeLessThan(1e-4); // the first flight now runs sideways
    expect(levelUsage(d1, 'L1')).toBe(0);
  });

  test('3D: each flight rises step by step, the landing is a plate at the first flight\'s top, the second flight goes on to the target', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const doc = JSON.parse(fs.readFileSync(path.resolve(here, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
    // the sample's L1 hall sits at -1.2 m: a U from the hall up to the main level (0 m), 4 + 4 steps of 0.15 m
    doc.connectors = [C({ id: 'u1', level_from: 'L1', level_to: 'L0', shape: 'u', turn: 'right', flights: [{ steps: 4 }, { steps: 4 }], landing_depth_m: 1.2, polyline: [[0.5, 0.9], [0.5, 0.7], [0.6, 0.7], [0.6, 0.9]] })];
    doc.objects = [];
    const desc = buildScene({ doc, width: doc.dimensions.width_px, height: doc.dimensions.height_px, anchors: [], entityStates: {}, circuitStates: {} });
    const parts = desc.parts.filter((q) => q.id.startsWith('conn:u1'));
    const steps = parts.filter((q) => /#f\ds\d+$/.test(q.id));
    expect(steps).toHaveLength(8);
    const top = (q: (typeof parts)[number]) => q.position[1] + q.size[1] / 2;
    const f0 = steps.filter((q) => q.id.includes('#f0s')).map(top);
    const f1 = steps.filter((q) => q.id.includes('#f1s')).map(top);
    f0.forEach((v, k) => expect(v).toBeCloseTo(-1.2 + 0.15 * (k + 1), 4));
    f1.forEach((v, k) => expect(v).toBeCloseTo(-0.6 + 0.15 * (k + 1), 4));
    const landing = parts.find((q) => q.id === 'conn:u1#landing')!;
    expect(top(landing)).toBeCloseTo(-0.6, 4); // 4 steps x 0.15 m above the hall
    expect(landing.size[1]).toBeCloseTo(LANDING_PLATE_M, 4);
    // the flights of a U are parallel and the landing spans both
    const x0 = steps.filter((q) => q.id.includes('#f0s')).map((q) => q.position[0]);
    const x1 = steps.filter((q) => q.id.includes('#f1s')).map((q) => q.position[0]);
    expect(new Set(x0.map((v) => v.toFixed(3))).size).toBe(1);
    expect(new Set(x1.map((v) => v.toFixed(3))).size).toBe(1);
    expect(landing.position[0]).toBeGreaterThan(Math.min(x0[0], x1[0]));
    expect(landing.position[0]).toBeLessThan(Math.max(x0[0], x1[0]));
    expect(Math.max(landing.size[0], landing.size[2])).toBeGreaterThan(Math.abs(x1[0] - x0[0]));
    // to another floor: 3 m, up by the far floor's direction
    doc.connectors = [C({ id: 'u1', level_from: 'L0', level_to: 'X', floor_ids: ['f0', 'f1'], far: { floor_id: 'f1', floor_name: 'קומה 1', level_name: null, direction: 'up' }, shape: 'straight', flights: [{ steps: 10 }], polyline: [[0.5, 0.9], [0.5, 0.6]] })];
    const up = buildScene({ doc, width: doc.dimensions.width_px, height: doc.dimensions.height_px, anchors: [], entityStates: {}, circuitStates: {} }).parts.filter((q) => q.id.startsWith('conn:u1'));
    expect(Math.max(...up.map(top))).toBeCloseTo(3, 4);
  });

  test('the building page pairs the twins of a link across two floors, once, and keeps a link whose twin is not published', () => {
    const far = (name: string) => ({ floor_id: 'x', floor_name: name, level_name: 'גלריה', direction: 'up' as const });
    const mine = C({ id: 'st', floor_ids: ['f0', 'f1'], level_to: 'G', polyline: [[0.2, 0.2], [0.4, 0.2]], far: far('קומה 1') });
    const twin = C({ id: 'st', floor_ids: ['f0', 'f1'], level_from: 'G', level_to: 'L0', polyline: [[0.6, 0.6], [0.6, 0.4]] });
    const lone = C({ id: 'el', kind: 'elevator', floor_ids: ['f0', 'f2'], level_to: 'L0', polyline: [[0.1, 0.1], [0.1, 0.2]], far: { floor_id: 'f2', floor_name: 'קומה 2', level_name: null, direction: 'up' } });
    const same = C({ id: 'lv', level_to: 'L1', polyline: [[0.1, 0.1], [0.2, 0.1]] });
    const links = floorLinks([
      { floorId: 'f1', connectors: [twin], levels: [{ id: 'G', name: 'גלריה', elevation_m: 2, ceiling_height_m: 2.5, is_default: false }] },
      { floorId: 'f0', connectors: [mine, lone, same], levels: LEVELS },
    ], [{ id: 'f0', name: 'קומה 0' }, { id: 'f1', name: 'קומה 1' }, { id: 'f2', name: 'קומה 2' }]);
    expect(links.map((l) => l.id)).toEqual(['el', 'st']);
    const st = links[1];
    expect(st.a).toEqual({ floorId: 'f0', at: [0.30000000000000004, 0.2], label: 'קומה 0 · מפלס ראשי' });
    expect(st.b).toEqual({ floorId: 'f1', at: [0.6, 0.5], label: 'קומה 1 · גלריה' });
    expect(links[0].b).toBeNull();
    expect(links[0].kindLabel).toBe('מעלית');
    expect(links[0].farLabel).toBe('קומה 2');
  });
});
