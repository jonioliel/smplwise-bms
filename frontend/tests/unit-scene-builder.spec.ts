import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogItem, CatalogLibrary } from '../src/api/plan-catalog';
import { lookup3dOf } from '../src/api/plan-catalog';
import type { GeometryDoc, GeomConnector, GeomObject, GeomOpening, GeomWall, Pt } from '../src/map/geometry';
import { buildScene, isoProjection, type SceneAnchor, type SceneDescription, type SceneInput, type ScenePart } from '../src/map/scene-builder';

// Plan Studio phase 4 (T087, design 10.5, ruling R-P4-4): the scene description is a pure function of the document, the
// anchors, the states, the library and the zones - pinned on the shared fixture (sample-v2.scene.json, regenerated with
// SCENE_WRITE=1) and checked on a synthetic hall with levels, connectors, a tribune, cylinders, an extruded polygon, a
// composite item, 3,000 chairs, cameras with cones and lamps on / off. Node only: no three, no DOM.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const CATALOG = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json');
const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
const builtin = (JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: CatalogItem[] }).items;
const libraryOf = (items: CatalogItem[]): CatalogLibrary => ({ catalog_version: 'test', revision: 'test', categories: [], icons: [], color_tokens: [], items });
const catalog = lookup3dOf(libraryOf(builtin));

const ANCHOR = (id: string, resource_type: 'camera' | 'ha_entity', resource_id: string, x: number, y: number, extra: Partial<SceneAnchor> = {}): SceneAnchor => ({
  id, resource_type, resource_id, x, y, rotation: 0, fov: null, radius: null, polygon: null, level_id: null, layer_id: resource_type === 'camera' ? 'cameras' : 'sensors', label: id, state: null, online: null, mount_height_m: null, tilt_deg: null, ...extra,
});
const SAMPLE_ANCHORS: SceneAnchor[] = [
  ANCHOR('a-cam', 'camera', 'cam-1', 0.15, 0.4, { rotation: 90, fov: 90, radius: 0.3, online: true }),
  ANCHOR('a-cam2', 'camera', 'cam-2', 0.7, 0.2, { rotation: 180, fov: 60, polygon: [[0.7, 0.2], [0.8, 0.3], [0.6, 0.3]], level_id: 'L1', online: false, mount_height_m: 3, tilt_deg: 20 }),
  ANCHOR('a-light', 'ha_entity', 'light.store', 0.5, 0.3, { layer_id: 'lights', state: 'on' }),
  ANCHOR('a-lock', 'ha_entity', 'lock.front', 0.85, 0.35, { layer_id: 'doors', state: 'locked' }),
  ANCHOR('a-sensor', 'ha_entity', 'binary_sensor.hall', 0.3, 0.65, { layer_id: 'sensors', state: null }),
];
const SAMPLE_ZONES = [{ id: 'z1', name: 'מחסן', polygon: [{ x: 0.12, y: 0.12 }, { x: 0.58, y: 0.12 }, { x: 0.58, y: 0.48 }, { x: 0.12, y: 0.48 }] }];
const sampleInput = (): SceneInput => ({ doc: sample(), width: 1000, height: 800, anchors: SAMPLE_ANCHORS, entityStates: { 'light.store': 'on', 'lock.front': 'locked', 'binary_sensor.hall': null, 'lock.store': 'open' }, circuitStates: { k1: 'on' }, catalog, zones: SAMPLE_ZONES });
const byId = (desc: SceneDescription, id: string): ScenePart => { const p = desc.parts.find((x) => x.id === id); expect(p, id).toBeTruthy(); return p!; };
const ofKind = (desc: SceneDescription, kind: ScenePart['kind']) => desc.parts.filter((p) => p.kind === kind);
/** The two ends [x, z] of a box along its length (the yaw turns +x toward (cos, -sin)). */
const ends = (p: ScenePart): [number, number][] => { const t = (p.rotation[1] * Math.PI) / 180; const [dx, dz] = [Math.cos(t) * p.size[0] / 2, -Math.sin(t) * p.size[0] / 2]; return [[p.position[0] - dx, p.position[2] - dz], [p.position[0] + dx, p.position[2] + dz]]; };
/** Whether the point [x, z] lies in the footprint of a box part. */
const covers = (p: ScenePart, x: number, z: number): boolean => { const t = (p.rotation[1] * Math.PI) / 180; const [ox, oz] = [x - p.position[0], z - p.position[2]]; const lx = ox * Math.cos(t) - oz * Math.sin(t); const lz = ox * Math.sin(t) + oz * Math.cos(t); return Math.abs(lx) <= p.size[0] / 2 + 1e-6 && Math.abs(lz) <= p.size[2] / 2 + 1e-6; };
const near = (a: [number, number], b: [number, number], tol = 1e-3): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
const stepsOf = (desc: SceneDescription, prefix: string): ScenePart[] => desc.parts.filter((p) => p.id.startsWith(prefix)).sort((a, b) => Number(a.id.slice(prefix.length)) - Number(b.id.slice(prefix.length)));

test('the sample document builds the pinned scene description (SCENE_WRITE=1 regenerates it)', () => {
  const desc = buildScene(sampleInput());
  const text = JSON.stringify(desc, null, 1) + '\n';
  const target = path.join(FIX, 'sample-v2.scene.json');
  if (process.env.SCENE_WRITE === '1') {
    fs.writeFileSync(target, text);
    console.log(`written ${target}: ${desc.parts.length} parts`);
  }
  expect(fs.existsSync(target), 'run once with SCENE_WRITE=1 to create the golden').toBe(true);
  expect(text).toBe(fs.readFileSync(target, 'utf8'));
  expect(JSON.stringify(buildScene(sampleInput()))).toBe(JSON.stringify(desc)); // twice the same
  expect(JSON.stringify(buildScene({ ...sampleInput(), anchors: [...SAMPLE_ANCHORS].reverse() }))).toBe(JSON.stringify(desc)); // whatever the input order
  const d0 = sample();
  const reversed: GeometryDoc = { ...d0, levels: [...d0.levels].reverse(), walls: [...d0.walls].reverse(), openings: [...d0.openings].reverse(), objects: [...d0.objects].reverse(), connectors: [...d0.connectors].reverse(), labels: [...d0.labels].reverse(), circuits: [...d0.circuits].reverse() };
  expect(JSON.stringify(buildScene({ ...sampleInput(), doc: reversed, zones: [...SAMPLE_ZONES].reverse() }))).toBe(JSON.stringify(desc)); // whatever the document order
  expect(desc.version).toBe('scene-1');
  expect(desc.estimated).toBe(false);
  expect(desc.scale_m_per_px).toBe(0.01);
  expect(desc.size).toEqual([10, 8]);
  expect(desc.levels.map((l) => l.id)).toEqual(['L0', 'L1']);
  expect(ofKind(desc, 'floor').length).toBe(2);
  expect(byId(desc, 'floor:L0').size).toEqual([10, 0.05, 8]);
  expect(byId(desc, 'floor:L1').size[0]).toBeLessThan(10); // a secondary level covers what sits on it, not the whole plan
  expect(ofKind(desc, 'wall').length).toBeGreaterThanOrEqual(8); // four walls cut by six openings
  expect(ofKind(desc, 'lintel').map((p) => p.id)).toEqual(['lintel:oa', 'lintel:oc', 'lintel:od', 'lintel:of']);
  expect(ofKind(desc, 'door').map((p) => p.id)).toEqual(['door:oa', 'door:oc', 'door:od#0', 'door:od#1', 'door:of']); // the double door od has two half leaves
  expect(ofKind(desc, 'sill').length).toBe(ofKind(desc, 'window').length);
  expect(ofKind(desc, 'head').length).toBe(ofKind(desc, 'window').length);
  expect(ofKind(desc, 'window').every((p) => p.opacity < 1)).toBe(true);
  expect(byId(desc, 'cam:a-cam').color).toBe('accent');
  expect(byId(desc, 'cam:a-cam').rotation).toEqual([-10, -90, 0]); // R-P4-T4-1: pitch = -tilt (the default 10 deg, looking down), the bearing as a yaw
  expect(byId(desc, 'cam:a-cam').position[1]).toBe(2.5); // the default mount height
  expect(byId(desc, 'cam:a-cam#cone').polygon!.length).toBeGreaterThan(10);
  expect(byId(desc, 'cam:a-cam#cone').size).toEqual([0, 2.5, 0]);
  expect(byId(desc, 'cam:a-cam2').color).toBe('offline');
  expect(byId(desc, 'cam:a-cam2').position).toEqual([7, 1.8, 1.6]); // L1 sits at -1.2 m; a stored mount of 3 m
  expect(byId(desc, 'cam:a-cam2').rotation).toEqual([-20, -180, 0]);
  expect(byId(desc, 'cam:a-cam2#cone').polygon).toEqual([[0, 0], [1, 0.8], [-1, 0.8]]); // the manual polygon, in metres from the camera
  expect(byId(desc, 'obj:o3').color).toBe('map-glow'); // the lamp of circuit k1, which is on
  expect(byId(desc, 'obj:o3#glow').shape).toBe('light');
  expect(desc.parts.find((p) => p.id === 'ent:a-light')).toBeUndefined(); // it has a body (o3): no floating symbol
  expect(byId(desc, 'ent:a-lock').color).toBe('text-3');
  expect(byId(desc, 'ent:a-lock').text).toBe('a-lock · נעול');
  expect(byId(desc, 'ent:a-lock').position[1]).toBeCloseTo(1.65, 6); // the door-station default (1.4 m), the sprite a little above it
  expect(byId(desc, 'ent:a-sensor').color).toBe('stale');
  expect(byId(desc, 'room:z1').shape).toBe('prism');
  expect(byId(desc, 'room:z1#label').text).toBe('מחסן');
  expect(byId(desc, 'label:la').text).toBe('מחסן');
  expect(ofKind(desc, 'connector').length).toBeGreaterThanOrEqual(3); // the stairs c1 as stepped boxes; the tribune connector draws nothing (its object does)
  expect(desc.parts.filter((p) => p.id.startsWith('conn:cx-o4')).length).toBe(0);
  expect(desc.parts.every((p) => p.position.every(Number.isFinite) && p.size.every((v) => Number.isFinite(v) && v >= 0) && p.rotation.every(Number.isFinite))).toBe(true);
  // every bend keeps its outer corner: the exterior wall wa (0.3 m) turns at (9, 0.8), its outer corner is (9.15, 0.65)
  expect(ofKind(desc, 'wall').some((p) => p.userData.id === 'wa' && covers(p, 9.15, 0.65))).toBe(true);
  expect(ofKind(desc, 'wall').some((p) => p.userData.id === 'wa' && covers(p, 8.85, 0.95))).toBe(true);
  // the open door oc (left swing, hinged at its end jamb (3.9, 4.0) of wall wb) stands 80 deg off the wall toward the north
  const oc = ends(byId(desc, 'door:oc'));
  const hinge = oc.find((e) => near(e, [3.9, 4]));
  expect(hinge, JSON.stringify(oc)).toBeTruthy();
  const tip = oc.find((e) => e !== hinge)!;
  expect(tip[0]).toBeCloseTo(3.9 - 0.8 * Math.cos((80 * Math.PI) / 180), 3);
  expect(tip[1]).toBeCloseTo(4 - 0.8 * Math.sin((80 * Math.PI) / 180), 3);
  expect(byId(desc, 'lintel:od').color).toBe('map-structure');
  // the tribune o4 descends into L1 (connects_levels): four rows from -1.2 m, the top one meeting the L0 floor
  const rows = stepsOf(desc, 'obj:o4#');
  expect(rows.map((p) => p.size[1])).toEqual([0.3, 0.6, 0.9, 1.2]);
  expect(rows.every((p) => Math.abs(p.position[1] - p.size[1] / 2 + 1.2) < 1e-9)).toBe(true);
  const ids = desc.parts.map((p) => p.id);
  expect([...ids].sort()).toEqual(ids);
  expect(new Set(ids).size).toBe(ids.length);
  expect(desc.stats.parts).toBe(desc.parts.length);
  expect(desc.stats.groups).toBe(Object.keys(desc.groups).length);
});

const WALL = (id: string, polyline: Pt[], level = 'L0', extra: Partial<GeomWall> = {}): GeomWall => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const OPENING = (id: string, wall_id: string, kind: GeomOpening['kind'], extra: Partial<GeomOpening> = {}): GeomOpening => ({ id, wall_id, t: 0.5, kind, width_m: 0.9, height_m: kind === 'window' ? 1.2 : 2.1, sill_m: kind === 'window' ? 0.9 : 0, swing: kind === 'door' ? 'left' : 'none', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {}, ...extra });
const OBJ = (id: string, item_id: string, position: Pt, extra: Partial<GeomObject> = {}): GeomObject => ({ id, item_id, level_id: 'L0', position, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const CONN = (id: string, kind: GeomConnector['kind'], polyline: Pt[], extra: Partial<GeomConnector> = {}): GeomConnector => ({ id, kind, level_from: 'L0', level_to: 'L1', floor_ids: [], polyline, width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {}, ...extra });

/** A hall: a room on L0 with a door (a lock entity), a window and a passage; a lower level L1 with a wall and a tribune;
 * 3,000 chairs in a 60 x 50 grid; a column, an extruded polygon, a composite desk; three lamps (entity on, circuit on,
 * off); stairs, an elevator and a ramp; a camera looking north at the wall. 1 m = 100 px on a 1000 x 800 plan. The lock
 * reports "open" (the leaf is open): an "unlocked" lock keeps the door closed (ruling R-P4-T2-1, shared with coverage.ts). */
function hall(): SceneInput {
  const chairs: GeomObject[] = [];
  for (let i = 0; i < 3000; i++) chairs.push(OBJ(`ch${i}`, 'chair.basic', [0.15 + (i % 60) * (0.7 / 59), 0.15 + Math.floor(i / 60) * (0.4 / 49)]));
  const custom: CatalogItem[] = [
    { id: 'custom.poly', category: 'structure', names: { he: 'מצולע', en: 'polygon' }, tags: [], role: 'structure', shape: 'extruded_polygon', size: { w_m: 2, d_m: 2, h_m: 1 }, z_ref: 'floor', z_m: 0, params: {}, params_schema: {}, icon: 'box', color_token: 'structure', anchor_kinds: [], ifc: { class: 'IfcBuildingElementProxy', predefined_type: '' }, custom: true, based_on: null },
    { id: 'custom.desk', category: 'furniture', names: { he: 'שולחן מורכב', en: 'desk' }, tags: [], role: 'furniture', shape: 'composite', size: { w_m: 1.4, d_m: 0.7, h_m: 0.75 }, z_ref: 'floor', z_m: 0, params: {}, params_schema: {}, icon: 'table', color_token: 'furniture', anchor_kinds: [], ifc: { class: 'IfcFurniture', predefined_type: '' }, custom: true, based_on: null,
      mesh: [{ shape: 'box', size: [1.4, 0.05, 0.7], offset: [0, 0.725, 0] }, { shape: 'cylinder', size: [0.05, 0.7, 0.05], offset: [-0.6, 0.35, -0.3] }, { shape: 'cylinder', size: [0.05, 0.7, 0.05], offset: [0.6, 0.35, 0.3] }] },
  ];
  const doc: GeometryDoc = {
    ...sample(),
    levels: [{ id: 'L0', name: 'ראשי', elevation_m: 0, ceiling_height_m: 3, is_default: true }, { id: 'L1', name: 'תחתון', elevation_m: -1.2, ceiling_height_m: 6, is_default: false }],
    walls: [WALL('n', [[0.1, 0.1], [0.9, 0.1]]), WALL('e', [[0.9, 0.1], [0.9, 0.6]]), WALL('s', [[0.9, 0.6], [0.1, 0.6]]), WALL('w', [[0.1, 0.6], [0.1, 0.1]]), WALL('lw', [[0.2, 0.9], [0.8, 0.9]], 'L1', { kind: 'low', height_m: 1 })],
    openings: [OPENING('dr', 'n', 'door', { anchor_ref: { resource_type: 'ha_entity', resource_id: 'lock.a' } }), OPENING('wn', 'e', 'window'), OPENING('ps', 's', 'passage')],
    objects: [...chairs, OBJ('tr', 'tribune.stepped', [0.5, 0.8], { level_id: 'L1', size: { w_m: 12, d_m: 4, h_m: 1.2 }, rotation_deg: 90, params: { rows: 5, step_height_m: 0.24, step_width_m: 0.8 } }),
      OBJ('col', 'column.round', [0.5, 0.5], { size: { w_m: 0.4, d_m: 0.4, h_m: 2.8 } }), OBJ('ex', 'custom.poly', [0.3, 0.5], { size: { w_m: 2, d_m: 2, h_m: 1 }, params: { polygon: [[-1, -1], [1, -1], [0, 1]] } }),
      OBJ('cp', 'custom.desk', [0.7, 0.5], { size: { w_m: 1.4, d_m: 0.7, h_m: 0.75 }, rotation_deg: 30 }),
      OBJ('l1', 'light.ceiling', [0.2, 0.2], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3, anchor_ref: { resource_type: 'ha_entity', resource_id: 'light.a' } }),
      OBJ('l2', 'light.ceiling', [0.5, 0.2], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3 }), OBJ('l3', 'light.ceiling', [0.8, 0.2], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: -0.3 })],
    circuits: [{ id: 'k', name: 'אולם', switch_entity_id: 'switch.k', member_ids: ['l2'], color_token: 'circuit-1', power_w: 36 }],
    connectors: [CONN('st', 'stairs', [[0.2, 0.7], [0.2, 0.75]]), CONN('el', 'elevator', [[0.9, 0.7], [0.95, 0.7]], { width_m: 2 }), CONN('rp', 'ramp', [[0.6, 0.7], [0.6, 0.78]], { level_from: 'L1', level_to: 'L0' })],
    labels: [], groups: [],
  };
  const anchors = [
    ANCHOR('c1', 'camera', 'cam-1', 0.5, 0.3, { rotation: 0, fov: 90, radius: 0.5, online: true }),
    ANCHOR('la', 'ha_entity', 'light.a', 0.2, 0.2, { layer_id: 'lights', state: 'on' }),
    ANCHOR('lk', 'ha_entity', 'lock.a', 0.5, 0.1, { layer_id: 'doors', state: 'open' }),
  ];
  return { doc, width: 1000, height: 800, anchors, entityStates: { 'light.a': 'on', 'lock.a': 'open' }, circuitStates: { k: 'on' }, catalog: lookup3dOf(libraryOf([...builtin, ...custom])) };
}

test('a hall with 3,000 chairs: one instance group, a bounded part count, every shape, openings, states, connectors, cones', () => {
  const input = hall();
  const desc = buildScene(input);
  // instancing: every chair shares one group; the description stays close to one part per item
  const chair = byId(desc, 'obj:ch0');
  expect(chair.shape).toBe('box');
  expect(chair.group).toBe(`box|${chair.color}|1`);
  expect(desc.parts.filter((p) => p.id.startsWith('obj:ch') && p.group === chair.group).length).toBe(3000);
  expect(desc.groups[chair.group!]).toBe(3001); // the group key is shape|colour|opacity: the desk top (a furniture box) joins the chairs
  expect(desc.stats.instanced).toBeGreaterThanOrEqual(3000);
  expect(desc.parts.length).toBeLessThanOrEqual(3000 + 150);
  expect(desc.stats.objects).toBe(3013); // 3,000 chairs + 5 tribune steps + the column + the polygon + 3 desk parts + 3 lamps
  // the tribune: five rising steps on the lower level, turned by its rotation, not instanced
  const steps = stepsOf(desc, 'obj:tr#');
  expect(steps.length).toBe(5);
  expect(steps.map((p) => p.size[1])).toEqual([0.24, 0.48, 0.72, 0.96, 1.2]);
  expect(steps.every((p) => p.group === null && p.level_id === 'L1' && p.rotation[1] === -90 && p.userData.id === 'tr')).toBe(true);
  expect(steps[0].position[1]).toBeCloseTo(-1.2 + 0.12, 6);
  // a cylinder, an extruded polygon, a composite
  expect(byId(desc, 'obj:col').shape).toBe('cylinder');
  expect(byId(desc, 'obj:col').group).toBe('cylinder|obj-structure|1');
  expect(byId(desc, 'obj:col').size).toEqual([0.4, 2.8, 0.4]);
  const ex = byId(desc, 'obj:ex');
  expect(ex.shape).toBe('prism');
  expect(ex.polygon).toEqual([[-1, -1], [1, -1], [0, 1]]);
  expect(ex.size).toEqual([0, 1, 0]);
  const desk = stepsOf(desc, 'obj:cp#');
  expect(desk.length).toBe(3);
  expect(desk.map((p) => p.shape)).toEqual(['box', 'cylinder', 'cylinder']);
  expect(desk.every((p) => p.rotation[1] === -30 && p.userData.id === 'cp')).toBe(true);
  expect(desk[0].position[1]).toBeCloseTo(0.725, 6);
  // the legs turn with the desk like its 2D footprint (geometry.rotated, 30 deg clockwise on the plan) around (7, 4)
  const th = (30 * Math.PI) / 180;
  for (const [leg, [lx, lz]] of [[desk[1], [-0.6, -0.3]], [desk[2], [0.6, 0.3]]] as [ScenePart, [number, number]][]) {
    expect(leg.position[0]).toBeCloseTo(7 + lx * Math.cos(th) - lz * Math.sin(th), 3);
    expect(leg.position[2]).toBeCloseTo(4 + lx * Math.sin(th) + lz * Math.cos(th), 3);
  }
  // lamps: a body whose entity is on, a member of a circuit that is on, one that is off
  expect(byId(desc, 'obj:l1').color).toBe('map-glow');
  expect(byId(desc, 'obj:l1#glow').shape).toBe('light');
  expect(byId(desc, 'obj:l1').position[1]).toBeCloseTo(3 - 0.3 + 0.05, 6); // a ceiling item hangs from the level's ceiling
  expect(byId(desc, 'obj:l2').color).toBe('map-glow');
  expect(byId(desc, 'obj:l2#glow')).toBeTruthy();
  expect(byId(desc, 'obj:l3').color).toBe('obj-light');
  expect(desc.parts.find((p) => p.id === 'obj:l3#glow')).toBeUndefined();
  expect(desc.parts.find((p) => p.id === 'ent:la')).toBeUndefined(); // the light has a body
  // openings: the door leaf is open by its lock, the lintel, the window sill / head / glass, the passage nothing
  const leaf = byId(desc, 'door:dr');
  expect(Math.abs(leaf.rotation[1])).toBe(80);
  expect(leaf.size).toEqual([0.9, 2.1, 0.04]);
  expect(byId(desc, 'lintel:dr').size[1]).toBeCloseTo(0.9, 6);
  expect(byId(desc, 'sill:wn').size[1]).toBeCloseTo(0.9, 6);
  expect(byId(desc, 'head:wn').size[1]).toBeCloseTo(0.9, 6);
  expect(byId(desc, 'window:wn').opacity).toBeLessThan(1);
  expect(desc.parts.filter((p) => p.id.endsWith(':ps')).length).toBe(0);
  const closed = buildScene({ ...input, entityStates: { 'light.a': 'on', 'lock.a': 'locked' } });
  expect(byId(closed, 'door:dr').rotation[1]).toBe(0);
  expect(byId(desc, 'ent:lk').color).toBe('live');
  expect(byId(closed, 'ent:lk').color).toBe('text-3'); // the live state wins over the anchor's stored one
  const unlocked = buildScene({ ...input, entityStates: { 'light.a': 'on', 'lock.a': 'unlocked' } }); // R-P4-T2-1: a lock state says nothing about the leaf
  expect(byId(unlocked, 'door:dr').rotation[1]).toBe(0);
  expect(byId(unlocked, 'ent:lk').color).toBe('text-3');
  expect(JSON.stringify(byId(unlocked, 'cam:c1#cone').polygon)).toBe(JSON.stringify(byId(closed, 'cam:c1#cone').polygon));
  // walls: the low wall keeps its own height and colour
  const low = desc.parts.filter((p) => p.id.startsWith('wall:lw#'));
  expect(low.length).toBe(1);
  expect(low[0].size[1]).toBe(1);
  expect(low[0].color).toBe('map-wall');
  expect(low[0].position[1]).toBeCloseTo(-1.2 + 0.5, 6);
  expect(desc.parts.filter((p) => p.id.startsWith('wall:n#')).every((p) => p.size[1] === 3 && p.color === 'map-structure')).toBe(true);
  // connectors: stairs and a ramp as rising steps between the levels, the elevator a translucent prism
  const stairs = stepsOf(desc, 'conn:st#'); // by the step number in the id, not the part order (#10 sorts before #2)
  expect(stairs.length).toBeGreaterThanOrEqual(3);
  const rises = stairs.map((p) => p.size[1]);
  expect(rises.every((v, i) => i === 0 || (v - rises[i - 1]) * (rises[1] - rises[0]) >= 0)).toBe(true); // monotonic: going down from L0 to L1, the steps shrink toward the end
  expect(Math.max(...rises)).toBeCloseTo(1.2, 6);
  expect(desc.parts.filter((p) => p.id.startsWith('conn:rp#')).length).toBeGreaterThanOrEqual(6);
  const lift = byId(desc, 'conn:el');
  expect(lift.opacity).toBe(0.3);
  expect(lift.size[1]).toBeCloseTo(4.2, 6); // from the lower floor (-1.2) to the upper ceiling (0 + 3)
  expect(lift.size[2]).toBe(2);
  // the camera cone stops at the north wall 1.6 m in front of it while the door is locked; the open door lets the middle rays through
  const cone = byId(closed, 'cam:c1#cone');
  expect(cone.polygon![0]).toEqual([0, 0]);
  expect(cone.polygon!.length).toBe(92);
  expect(Math.min(...cone.polygon!.map((p) => p[1]))).toBeGreaterThanOrEqual(-1.61);
  expect(cone.polygon!.some((p) => p[1] < -1.5)).toBe(true);
  expect(Math.min(...byId(desc, 'cam:c1#cone').polygon!.map((p) => p[1]))).toBeLessThan(-2);
  // the level switch and the layer switches
  const lower = buildScene({ ...input, level: 'L1' });
  expect(lower.parts.filter((p) => p.kind === 'wall').map((p) => p.id)).toEqual(['wall:lw#0']);
  expect(lower.parts.filter((p) => p.level_id === 'L0' && p.kind !== 'connector').length).toBe(0);
  expect(lower.parts.filter((p) => p.kind === 'connector').length).toBe(desc.parts.filter((p) => p.kind === 'connector').length); // connectors always
  expect(buildScene({ ...input, layers: { objects: false } }).parts.filter((p) => p.kind === 'object' || p.kind === 'glow').length).toBe(0);
  expect(buildScene({ ...input, layers: { cameras: false } }).parts.filter((p) => p.kind === 'camera' || p.kind === 'cone').length).toBe(0);
  expect(buildScene({ ...input, layers: { structure: false } }).parts.filter((p) => ['wall', 'floor', 'door', 'window', 'lintel', 'sill', 'head'].includes(p.kind)).length).toBe(0);
  // uncalibrated: the estimated scale, flagged
  const raw = { ...input.doc, dimensions: { ...input.doc.dimensions, scale_m_per_px: null, calibration: { status: 'missing' as const, method: null, pairs: [], residual_pct: null, reason: null } } };
  const est = buildScene({ ...input, doc: raw });
  expect(est.estimated).toBe(true);
  expect(est.scale_m_per_px).toBeCloseTo(0.2 / (0.006 * 1000), 9);
});

test('door leaves follow the 2D rules: none, sliding on its track, two half leaves, a missing swing opens right', () => {
  // one wall from (1, 4) to (9, 4) m, a 1 m door in the middle: gap (4.5, 4) .. (5.5, 4), the left normal points north
  const scene = (swing: GeomOpening['swing'], state: string, hinge: GeomOpening['hinge'] = 'start') => buildScene({
    doc: { ...sample(), walls: [WALL('w', [[0.1, 0.5], [0.9, 0.5]])], openings: [OPENING('o', 'w', 'door', { swing, hinge, width_m: 1, anchor_ref: { resource_type: 'ha_entity', resource_id: 'door.o' } })], objects: [], connectors: [], labels: [], circuits: [], groups: [] },
    width: 1000, height: 800, anchors: [], entityStates: { 'door.o': state }, circuitStates: {}, catalog,
  });
  const doors = (desc: SceneDescription) => desc.parts.filter((p) => p.kind === 'door');
  expect(doors(scene('none', 'open'))).toEqual([]);
  expect(byId(scene('none', 'open'), 'lintel:o')).toBeTruthy();
  const slidingShut = byId(scene('sliding', 'off'), 'door:o');
  expect([slidingShut.position[0], slidingShut.position[2], slidingShut.rotation[1]]).toEqual([5, 3.88, 0]); // over the gap, 0.12 w off the wall
  const slidingOpen = byId(scene('sliding', 'open'), 'door:o');
  expect([slidingOpen.position[0], slidingOpen.position[2]]).toEqual([4, 3.88]); // slid one width toward its hinge jamb
  const double = scene('double', 'open');
  expect(doors(double).map((p) => p.size[0])).toEqual([0.5, 0.5]);
  const [a, b] = [ends(byId(double, 'door:o#0')), ends(byId(double, 'door:o#1'))];
  const c80 = Math.cos((80 * Math.PI) / 180);
  const s80 = Math.sin((80 * Math.PI) / 180);
  expect(a.some((e) => near(e, [4.5, 4])) && a.some((e) => near(e, [4.5 + 0.5 * c80, 4 - 0.5 * s80]))).toBe(true);
  expect(b.some((e) => near(e, [5.5, 4])) && b.some((e) => near(e, [5.5 - 0.5 * c80, 4 - 0.5 * s80]))).toBe(true);
  const closedDouble = scene('double', 'closed');
  expect(doors(closedDouble).every((p) => p.rotation[1] === 0 && p.position[2] === 4)).toBe(true);
  // no swing stored: right, as geometry.ts draws it - the leaf opens to the south of the wall
  const dflt = ends(byId(scene('' as unknown as GeomOpening['swing'], 'open'), 'door:o'));
  expect(dflt.some((e) => near(e, [4.5, 4])) && dflt.some((e) => near(e, [4.5 + c80, 4 + s80]))).toBe(true);
  // a wall without its own height reaches the ceiling from its base (L0 ceiling 3 m, base 1 m: 2 m tall, top at 3 m)
  const raised = buildScene({ doc: { ...sample(), walls: [WALL('r', [[0.1, 0.5], [0.9, 0.5]], 'L0', { base_z_m: 1 })], openings: [], objects: [], connectors: [], labels: [] }, width: 1000, height: 800, anchors: [], entityStates: {}, circuitStates: {}, catalog });
  expect(byId(raised, 'wall:r#0').size[1]).toBe(2);
  expect(byId(raised, 'wall:r#0').position[1]).toBe(2);
});

test('the isometric projection of the building page comes from the same description', () => {
  const desc = buildScene(sampleInput());
  const iso = isoProjection(desc);
  expect(iso.faces.length).toBeGreaterThan(20);
  expect(iso.faces.filter((f) => f.face === 'plate').length).toBe(2);
  expect(iso.faces.every((f) => f.points.length === 4 && f.points.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])))).toBe(true);
  expect(iso.faces.every((f) => f.points.every((p) => p[0] >= -10 && p[0] <= 130 && p[1] >= -40 && p[1] <= 100))).toBe(true); // around the 120 x 72 thumbnail, walls rising above the plate
  expect(JSON.stringify(isoProjection(desc))).toBe(JSON.stringify(iso));
  expect(isoProjection(buildScene({ ...sampleInput(), layers: { objects: false, cameras: false, entities: false, zones: false } })).faces.length).toBe(iso.faces.length); // objects and anchors are not part of the thumbnail
});
