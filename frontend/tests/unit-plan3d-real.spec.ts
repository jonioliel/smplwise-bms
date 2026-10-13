import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogItem, CatalogLibrary } from '../src/api/plan-catalog';
import { lookup3dOf, lookupMaterialsOf } from '../src/api/plan-catalog';
import type { GeometryDoc, GeomObject } from '../src/map/geometry';
import { buildScene, type SceneInput } from '../src/map/scene-builder';
import { MATERIALS } from '../src/map/material-resolve';
import { demoSceneInput } from '../src/fixtures/demo-3d';

// CR-029 S1 (section 8, ST7 build plan 5.2): the realistic level is ADDITIVE and DETERMINISTIC. Without `realistic` the
// description is byte-identical to before (the levels 1-2 baselines cannot move); with it the base parts are unchanged
// and `real` carries the materials, bevels, detail families, room floors, section caps, models, lamps and shutters - the
// same JSON from the same input. Node only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const CATALOG = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json');
const builtin = (JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: CatalogItem[] }).items;
const lib: CatalogLibrary = { catalog_version: 'test', revision: 'test', categories: [], icons: [], color_tokens: [], items: builtin };
const catalog = lookup3dOf(lib);
const materialsCatalog = lookupMaterialsOf(lib);
const IDS = new Set(MATERIALS.map((m) => m.id));

const obj = (id: string, item: string, x: number, y: number, rot = 0, extra: Partial<GeomObject> = {}): GeomObject => {
  const it = builtin.find((i) => i.id === item)!;
  return { id, item_id: item, level_id: 'L0', position: [x, y], rotation_deg: rot, size: { ...it.size }, z_m: it.z_m, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra };
};
function doc(): GeometryDoc {
  const d = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
  d.objects.push(obj('s1', 'sofa.3', 0.3, 0.25, 30), obj('k1', 'kitchenette.counter', 0.45, 0.15), obj('l1', 'light.pendant', 0.35, 0.3), obj('l2', 'light.ceiling', 0.25, 0.35, 0, { anchor_ref: { resource_type: 'ha_entity', resource_id: 'light.l2' } }), obj('t1', 'tree.small', 0.8, 0.8), obj('c9', 'cabinet.tall', 0.4, 0.45, 90));
  const win = d.openings.find((o) => o.id === 'ob')!;
  win.anchor_ref = { resource_type: 'ha_entity', resource_id: 'cover.store' };
  return d;
}
const input = (extra: Partial<SceneInput> = {}): SceneInput => ({ doc: doc(), width: 1000, height: 800, anchors: [], entityStates: { 'light.l2': 'on', 'cover.store': 'closed', 'lock.store': 'open' }, circuitStates: {}, catalog, zones: [{ id: 'z1', name: 'מחסן', polygon: [{ x: 0.12, y: 0.12 }, { x: 0.58, y: 0.12 }, { x: 0.58, y: 0.48 }, { x: 0.12, y: 0.48 }], level_id: 'L0' }, { id: 'z2', name: 'חדר', polygon: [{ x: 0.62, y: 0.12 }, { x: 0.88, y: 0.12 }, { x: 0.88, y: 0.58 }, { x: 0.62, y: 0.58 }], level_id: 'L0' }], materialsCatalog, ...extra });

test('without `realistic` the description is byte-identical; with it the base parts are unchanged and `real` is added', () => {
  const plain = buildScene(input());
  expect('real' in plain).toBe(false);
  expect(JSON.stringify(buildScene(input({ realistic: false })))).toBe(JSON.stringify(plain));
  const real = buildScene(input({ realistic: true }));
  expect(real.real?.version).toBe('real-1');
  expect(JSON.stringify(real.parts)).toBe(JSON.stringify(plain.parts));
  expect(real.stats).toEqual(plain.stats);
  // the demo floor of the style guide too (the visual baselines' floor)
  const demo = demoSceneInput('f0')!;
  expect(JSON.stringify(buildScene({ ...demo, realistic: false }))).toBe(JSON.stringify(buildScene(demo)));
});

test('the realistic part is deterministic: equal input, equal JSON - per level filter and with the walk', () => {
  for (const level of [null, 'L0', 'L1']) {
    const a = buildScene(input({ realistic: true, level }));
    const b = buildScene(input({ realistic: true, level }));
    expect(JSON.stringify(b.real)).toBe(JSON.stringify(a.real));
  }
  const w1 = buildScene(input({ realistic: true, walk: true }));
  const w2 = buildScene(input({ realistic: true, walk: true }));
  expect(JSON.stringify(w2)).toBe(JSON.stringify(w1));
});

test('materials, bevels, families, floors, caps, models, lamps and shutters are what the look spec asks for', () => {
  const d = buildScene(input({ realistic: true }));
  const r = d.real!;
  const ids = new Set(d.parts.map((p) => p.id));
  // every material is a library id; every wall part has one; the floor plates take their level's floor
  for (const [pid, m] of Object.entries(r.materials)) {
    expect(IDS.has(m), `${pid}: ${m}`).toBe(true);
    expect(ids.has(pid), pid).toBe(true);
  }
  for (const p of d.parts.filter((q) => q.kind === 'wall' || q.kind === 'floor' || q.kind === 'door' || q.kind === 'object')) expect(r.materials[p.id], p.id).toBeTruthy();
  for (const p of r.parts) {
    expect(IDS.has(p.material), `${p.id}: ${p.material}`).toBe(true);
    expect(p.owner === '' || ids.has(p.owner) || p.owner.startsWith('lintel:') || p.owner.startsWith('window:'), `${p.id} owner ${p.owner}`).toBe(true);
    expect(p.size.every((s) => s > 0), p.id).toBe(true);
  }
  // bevel rule: a door leaf 6 mm, objects of 0.12 m and up a few cm, never above 5 cm
  for (const p of d.parts.filter((q) => q.kind === 'door' && q.shape === 'box')) expect(r.radius[p.id]).toBe(0.006);
  expect(Object.values(r.radius).every((v) => v > 0 && v <= 0.05)).toBe(true);
  // skirting along interior walls, door frames and casings, handles on swinging leaves, window frame + sill
  expect(r.parts.some((p) => p.id.includes('~sk'))).toBe(true);
  expect(r.parts.filter((p) => p.id.startsWith('door:oa~casing')).length).toBe(3);
  expect(r.parts.filter((p) => p.id.startsWith('door:oa~frame')).length).toBe(3);
  expect(r.parts.filter((p) => p.id.startsWith('door:oa') && p.id.includes('~lever')).length).toBe(2);
  expect(r.parts.filter((p) => p.id.startsWith('door:od') && p.id.includes('~rose')).length).toBe(4); // two leaves
  expect(r.parts.some((p) => p.id.startsWith('door:of') && p.id.includes('~rose'))).toBe(false); // a sliding leaf: no lever
  expect(r.parts.filter((p) => p.id.startsWith('window:ob~frame')).length).toBe(4); // jambs, head, foot rail
  expect(r.parts.some((p) => p.id === 'window:ob~sill' && p.material === 'tiles_white')).toBe(true);
  expect(r.parts.some((p) => p.id === 'window:ob~mullion.0')).toBe(true); // 1.2 m wide: one mullion
  // families replace their base parts: the sofa (cushions per 0.6 m), the cabinet (doors every 0.5 m + handles), the tree
  expect(r.replaced).toEqual(expect.arrayContaining(['obj:s1', 'obj:c9', 'obj:t1', 'obj:l1', 'obj:l2']));
  expect(r.parts.filter((p) => p.owner === 'obj:s1' && p.id.includes('~cushion')).length).toBe(3);
  expect(r.parts.filter((p) => p.owner === 'obj:c9' && p.id.includes('~handle')).length).toBe(2);
  expect(r.replaced.every((id) => ids.has(id))).toBe(true);
  // models: the sofa and the chair map to kit files; the kitchen run tiles 0.6 m modules (2.4 m -> 4)
  const k = r.models.find((m) => m.id === 'model:k1')!;
  expect(k.tiles).toHaveLength(4);
  expect(k.size[0]).toBeCloseTo(0.6, 4);
  expect(r.models.some((m) => m.item === 'sofa.3')).toBe(true);
  expect(r.models.some((m) => m.item === 'chair.basic')).toBe(true);
  // lamps: the pendant off, the ceiling lamp on through its entity, both with bulbs in their families
  const l2 = r.lamps.find((l) => l.id === 'lamp:l2')!;
  expect(l2.on).toBe(true);
  expect(r.lamps.find((l) => l.id === 'lamp:l1')!.on).toBe(false);
  expect(r.lamps.find((l) => l.id === 'lamp:l1')!.kind).toBe('pendant');
  expect(r.parts.filter((p) => p.bulb).map((p) => p.bulb)).toEqual(expect.arrayContaining(['l1', 'l2']));
  expect(new Set(r.parts.filter((p) => p.bulb).map((p) => p.bulb)).size).toBe(r.lamps.length); // one bulb per lamp
  // the room floor in its material, the daylight of the room with the window, section caps at 0.6 of the ceiling
  expect(r.floors).toHaveLength(2);
  expect(IDS.has(r.floors[0].material)).toBe(true);
  expect(r.rooms.z1.daylight).toBe(0); // no window on its walls
  expect(r.rooms.z2.daylight).toBeGreaterThan(0); // the 1.2 x 1.2 m window
  expect(r.caps.length).toBeGreaterThan(2);
  for (const c of r.caps.filter((q) => q.level_id === 'L0')) expect(c.y).toBeCloseTo(1.8, 4);
  // the closed cover lowers the shutter fully; an open one would leave it up
  expect(r.shutters).toEqual([expect.objectContaining({ id: 'shutter:ob', entity: 'cover.store', down: 1 })]);
  const open = buildScene(input({ realistic: true, entityStates: { 'cover.store': 'open' } })).real!;
  expect(open.shutters[0].down).toBe(0);
  const stale = buildScene(input({ realistic: true, entityStates: { 'cover.store': null } })).real!;
  expect(stale.shutters[0].down).toBe(0);
  console.log(`real: ${r.parts.length} detail parts, ${r.caps.length} caps, ${r.models.length} models, ${r.lamps.length} lamps`);
});

test('round 3: every room gets a ceiling plate at its height unless the document says `ceiling: false`; a cylinder item takes its kit model', () => {
  const d = buildScene(input({ realistic: true }));
  const r = d.real!;
  // G4: one ceiling per room, at elevation + ceiling height, in the room's / level's ceiling material, same polygon as the floor
  expect(r.ceilings!.map((c) => c.zone).sort()).toEqual(['z1', 'z2']);
  for (const c of r.ceilings!) {
    const f = r.floors.find((q) => q.zone === c.zone)!;
    expect(c.polygon).toEqual(f.polygon);
    expect(c.y).toBeCloseTo(f.y + d.levels.find((l) => l.id === c.level_id)!.ceiling_height_m, 4);
    expect(IDS.has(c.material)).toBe(true);
  }
  const noCeil = doc();
  noCeil.rooms.push({ id: 'z1', level_id: 'L0', ceiling: false });
  expect(buildScene(input({ realistic: true, doc: noCeil })).real!.ceilings!.map((c) => c.zone)).toEqual(['z2']);
  // G9: the office chair is a cylinder in the catalog; it reaches the model path like a box does
  const withChair = doc();
  withChair.objects.push(obj('oc1', 'chair.office', 0.7, 0.3));
  const rc = buildScene(input({ realistic: true, doc: withChair })).real!;
  expect(rc.models.some((m) => m.id === 'model:oc1' && m.item === 'chair.office')).toBe(true);
  // determinism holds with the new rows
  expect(JSON.stringify(buildScene(input({ realistic: true, doc: withChair })).real)).toBe(JSON.stringify(rc));
});
