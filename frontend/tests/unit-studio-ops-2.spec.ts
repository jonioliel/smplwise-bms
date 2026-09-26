import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectHitCorners, type GeometryDoc, type GeomObject } from '../src/map/geometry';
import type { CatalogItem } from '../src/api/plan-catalog';
import { addArray, addCircuit, addConnector, addLevel, addObject, arrayDefaults, circuitPower, duplicateBeside, duplicateObject, initialLevel, levelUsage, moveConnectorVertex, moveGroup, moveObject, objectZ, patchCircuit, patchConnector, patchLevel, patchObject, removeGroup, removeItem, removeLevel, rotationTo, stretchedSize, toggleCircuitMember, translatePolygon, translateWall, visibleUnderLevel } from '../src/map/studio-ops';

// Plan Studio phase 2 (T085): the pure document operations of the editor - placing an item (its size, z and params come
// from the library), moving, rotating, stretching, duplicating, and removing an object out of its group, its circuit
// and the connector derived from it. Runs in node. Later tasks add their operations to this file.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
const library = JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as { items: CatalogItem[] };
const item = (id: string): CatalogItem => library.items.find((i) => i.id === id)!;
const PLACE = { levelId: 'L0', ceilingM: 3.0 };

test.describe('plan studio object operations (unit)', () => {
  test('placing an item copies its size, params and height; a ceiling item sits below the ceiling', () => {
    const doc = sample();
    const chair = addObject(doc, item('chair.basic'), [0.42, 0.61], PLACE);
    const o = chair.doc.objects.find((x) => x.id === chair.id)!;
    expect(o).toMatchObject({ item_id: 'chair.basic', level_id: 'L0', position: [0.42, 0.61], rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, source: 'manual', locked: false });
    const lamp = addObject(chair.doc, item('light.ceiling'), [0.5, 0.5], PLACE, 30);
    const l = lamp.doc.objects.find((x) => x.id === lamp.id)!;
    expect(l.z_m).toBe(2.7);
    expect(l.params).toEqual({ power_w: 36 });
    expect(l.rotation_deg).toBe(30);
    expect(objectZ(item('extinguisher.co2'), 3.0)).toBe(0.9);
    expect(doc.objects.length).toBe(5);
  });

  test('move, rotate, stretch, duplicate', () => {
    const doc = sample();
    const moved = moveObject(doc, 'o1', [1.4, 0.3]);
    expect(moved.objects.find((x) => x.id === 'o1')!.position).toEqual([1, 0.3]);
    const o2 = doc.objects.find((x) => x.id === 'o2')!; // centre (300, 320) px
    expect(rotationTo(o2, [0.3, 0.1], 1000, 800, 1)).toBe(0); // straight up
    expect(rotationTo(o2, [0.5, 0.4], 1000, 800, 1)).toBe(90); // to the right
    expect(rotationTo(o2, [0.32, 0.1], 1000, 800, 15)).toBe(0); // Shift snaps to 15 degrees
    const o1 = doc.objects.find((x) => x.id === 'o1')!; // 45 x 45 px at (200, 160), scale 0.01
    expect(stretchedSize(o1, 1, [0.25, 0.2], 1000, 800, 0.01, false)).toEqual({ w_m: 1, d_m: 0.45, h_m: 0.85 }); // right edge to x = 250: half width 50 px = 0.5 m
    expect(stretchedSize(o1, 2, [0.2, 0.3], 1000, 800, 0.01, false)).toEqual({ w_m: 0.45, d_m: 1.6, h_m: 0.85 }); // bottom edge to y = 240
    expect(stretchedSize(o1, 1, [0.25, 0.2], 1000, 800, 0.01, true)).toEqual({ w_m: 1, d_m: 1, h_m: 0.85 }); // ratio kept
    expect(stretchedSize(o1, 1, [0.2, 0.2], 1000, 800, 0.01, false).w_m).toBe(0.05); // never below the minimum
    const dup = duplicateObject(doc, 'o3', [0.6, 0.6]);
    const copy = dup.doc.objects.find((x) => x.id === dup.id)!;
    expect(copy).toMatchObject({ item_id: 'light.ceiling', position: [0.6, 0.6], anchor_ref: null, group_id: null, z_m: 2.7 });
    expect(dup.doc.objects.length).toBe(6);
    expect(duplicateObject(doc, 'o1', [0.1, 0.1], 'fixed-id').id).toBe('fixed-id');
    expect(patchObject(doc, 'o1', { label: 'כיסא', position: [-1, 0.2] }).objects[0]).toMatchObject({ id: 'o1', label: 'כיסא', position: [0, 0.2] });
  });

  test('removing an object takes it out of its group, its circuit and its derived connector; removing a group keeps the members', () => {
    const doc = sample();
    const noLamp = removeItem(doc, 'o3');
    expect(noLamp.objects.some((x) => x.id === 'o3')).toBe(false);
    expect(noLamp.circuits[0].member_ids).toEqual([]);
    const noTribune = removeItem(doc, 'o4');
    expect(noTribune.connectors.map((c) => c.id)).toEqual(['c1']);
    const noChair = removeItem(doc, 'o1');
    expect(noChair.groups[0].member_ids).toEqual(['o2']);
    const noMembers = removeItem(noChair, 'o2'); // the group's last member goes: the empty group row drops with it
    expect(noMembers.groups).toEqual([]);
    const noGroup = removeItem(doc, 'g1');
    expect(noGroup.groups).toEqual([]);
    expect(noGroup.objects.filter((o) => o.group_id === null).length).toBe(5);
    expect(removeItem(doc, 'c1').connectors.map((c) => c.id)).toEqual(['cx-o4']);
    expect(removeItem(doc, 'k1').circuits).toEqual([]);
    expect((doc.objects[0] as GeomObject).group_id).toBe('g1'); // the input is untouched
  });

  test('an array of 6 x 10 chairs is one group; the origin is member [0, 0]; the group moves as one', () => {
    let doc = sample();
    const placed = addObject(doc, item('chair.basic'), [0.1, 0.1], PLACE);
    doc = placed.doc;
    expect(arrayDefaults(item('chair.basic'))).toEqual({ spacingX: 0.5, spacingY: 0.9 });
    const arr = addArray(doc, placed.id, { rows: 6, cols: 10, spacingX: 0.5, spacingY: 0.9, directionDeg: 0 }, 1000, 800, 0.01)!;
    expect(arr).not.toBeNull();
    expect(arr.ids.length).toBe(60);
    expect(arr.ids[0]).toBe(placed.id);
    const g = arr.doc.groups.find((x) => x.id === arr.groupId)!;
    expect(g).toMatchObject({ kind: 'array', member_ids: arr.ids, params: { rows: 6, cols: 10, spacing_x_m: 0.5, spacing_y_m: 0.9, direction_deg: 0, item_id: 'chair.basic' } });
    expect(arr.doc.objects.length).toBe(doc.objects.length + 59);
    const at = (id: string) => arr.doc.objects.find((o) => o.id === id)!;
    expect(at(arr.ids[9]).position).toEqual([0.55, 0.1]); // column 9: 9 x 0.5 m = 450 px of 1000
    expect(at(arr.ids[50]).position).toEqual([0.1, 0.6625]); // row 5: 5 x 0.9 m = 450 px of 800
    expect(at(arr.ids[59]).group_id).toBe(arr.groupId);
    expect(at(placed.id).group_id).toBe(arr.groupId);
    const turned = addArray(doc, placed.id, { rows: 1, cols: 2, spacingX: 1, spacingY: 1, directionDeg: 90 }, 1000, 800, 0.01)!;
    expect(turned.doc.objects.find((o) => o.id === turned.ids[1])!.position).toEqual([0.1, 0.225]); // the right of a 90 degree turn points down: 100 px of 800
    expect(addArray(doc, 'nope', { rows: 2, cols: 2, spacingX: 1, spacingY: 1, directionDeg: 0 }, 1000, 800, 0.01)).toBeNull();
    expect(addArray(doc, placed.id, { rows: 30, cols: 30, spacingX: 1, spacingY: 1, directionDeg: 0 }, 1000, 800, 0.01)).toBeNull(); // 900 > ARRAY_MAX
    expect(addArray(arr.doc, placed.id, { rows: 2, cols: 2, spacingX: 1, spacingY: 1, directionDeg: 0 }, 1000, 800, 0.01)).toBeNull(); // already in a group
    const moved = moveGroup(arr.doc, arr.groupId, 0.1, 0);
    expect(moved.objects.find((o) => o.id === arr.ids[9])!.position).toEqual([0.65, 0.1]);
    expect(moved.objects.find((o) => o.id === 'o1')!.position).toEqual([0.2, 0.2]); // not a member
  });

  test('deleting a group keeps or takes its members', () => {
    let doc = sample();
    const placed = addObject(doc, item('chair.basic'), [0.1, 0.1], PLACE);
    const arr = addArray(placed.doc, placed.id, { rows: 2, cols: 3, spacingX: 0.5, spacingY: 0.9, directionDeg: 0 }, 1000, 800, 0.01)!;
    doc = arr.doc;
    const kept = removeGroup(doc, arr.groupId, false);
    expect(kept.groups.some((g) => g.id === arr.groupId)).toBe(false);
    expect(kept.objects.filter((o) => arr.ids.includes(o.id)).every((o) => o.group_id === null)).toBe(true);
    expect(kept.objects.length).toBe(doc.objects.length);
    const gone = removeGroup(doc, arr.groupId, true);
    expect(gone.objects.some((o) => arr.ids.includes(o.id))).toBe(false);
    expect(gone.objects.length).toBe(doc.objects.length - 6);
  });

  test('levels: added with the next free id, one default at a time, removed only when unused', () => {
    const doc = sample();
    const added = addLevel(doc, 'גלריה', 3.5, 3.0);
    expect(added.id).toBe('L2');
    expect(added.doc.levels.find((l) => l.id === 'L2')).toEqual({ id: 'L2', name: 'גלריה', elevation_m: 3.5, ceiling_height_m: 3.0, is_default: false, external_ids: {} });
    const asDefault = patchLevel(added.doc, 'L2', { is_default: true });
    expect(asDefault.levels.map((l) => l.is_default)).toEqual([false, false, true]);
    expect(levelUsage(doc, 'L1')).toBe(5); // wall wd, label lb, object o5, connectors c1 and cx-o4 (both end there)
    expect(removeLevel(doc, 'L0')).toBeNull(); // the default
    expect(removeLevel(doc, 'L1')).toBeNull(); // used
    expect(removeLevel(added.doc, 'L2')!.levels.length).toBe(2);
  });

  test('visibleUnderLevel: a wall/opening by its wall, a label/object by its own, a connector on every level, a group by its members', () => {
    const doc = sample();
    expect(visibleUnderLevel(doc, 'o1', null)).toBe(true); // no filter: always visible
    expect(visibleUnderLevel(doc, 'o1', 'L0')).toBe(true); // object o1 is on L0
    expect(visibleUnderLevel(doc, 'o1', 'L1')).toBe(false);
    expect(visibleUnderLevel(doc, 'wd', 'L1')).toBe(true); // wall wd is on L1
    expect(visibleUnderLevel(doc, 'wd', 'L0')).toBe(false);
    expect(visibleUnderLevel(doc, 'oc', 'L0')).toBe(true); // opening oc's wall wb is on L0
    expect(visibleUnderLevel(doc, 'of', 'L0')).toBe(false); // opening of's wall wd is on L1
    expect(visibleUnderLevel(doc, 'of', 'L1')).toBe(true);
    expect(visibleUnderLevel(doc, 'la', 'L0')).toBe(true); // label la is on L0
    expect(visibleUnderLevel(doc, 'lb', 'L0')).toBe(false); // label lb is on L1
    // a connector is drawn on every level (buildPrimitives has no level filter for it, round 2 of the final review):
    // level_from / level_to are its endpoints, not a visibility test, so it is visible under any filter, including
    // one matching neither end.
    expect(visibleUnderLevel(doc, 'c1', 'L0')).toBe(true); // connector c1: L0 -> L1
    expect(visibleUnderLevel(doc, 'c1', 'L1')).toBe(true);
    expect(visibleUnderLevel(doc, 'c1', 'L2')).toBe(true); // matches neither end
    const noLevelTo = addConnector(doc, 'elevator', [0.1, 0.1], [0.1, 0.15], 'L0', null).doc;
    const cid = noLevelTo.connectors.at(-1)!.id;
    expect(visibleUnderLevel(noLevelTo, cid, 'L0')).toBe(true);
    expect(visibleUnderLevel(noLevelTo, cid, 'L1')).toBe(true); // level_to null, still visible
    expect(visibleUnderLevel(doc, 'g1', 'L0')).toBe(true); // group g1's members o1, o2 are both on L0
    expect(visibleUnderLevel(doc, 'g1', 'L1')).toBe(false);
    expect(visibleUnderLevel(doc, 'nope', 'L0')).toBe(true); // unknown id: never hides a selection it cannot place
  });

  test('connectors: drawn between two points with the kind width, patched and their corners moved inside the plan', () => {
    const doc = sample();
    const r = addConnector(doc, 'stairs', [0.7, 0.2], [0.9, 0.2], 'L0', 'L1');
    const c = r.doc.connectors.find((x) => x.id === r.id)!;
    expect(c).toEqual({ id: r.id, kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.7, 0.2], [0.9, 0.2]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} });
    expect(addConnector(doc, 'elevator', [0.1, 0.1], [0.1, 0.15], 'L0', null).doc.connectors.at(-1)!.width_m).toBe(1.6);
    const wider = patchConnector(r.doc, r.id, { width_m: 2, level_to: null, floor_ids: ['f-other'] });
    expect(wider.connectors.find((x) => x.id === r.id)).toMatchObject({ width_m: 2, level_to: null, floor_ids: ['f-other'] });
    expect(moveConnectorVertex(r.doc, r.id, 1, [1.2, 0.3]).connectors.find((x) => x.id === r.id)!.polyline).toEqual([[0.7, 0.2], [1, 0.3]]);
    expect(moveConnectorVertex(r.doc, 'cx-o4', 0, [0.1, 0.1]).connectors.find((x) => x.id === 'cx-o4')!.polyline).toEqual([[0.25, 0.4125], [0.25, 0.7875]]); // derived: not editable
  });

  test('circuits: created with a switch entity, lamps toggled in and out (one circuit per lamp), power summed from the items', () => {
    const doc = sample();
    const r = addCircuit(doc, 'אולם צפון', 'switch.hall_b', 'circuit-2');
    expect(r.doc.circuits.find((k) => k.id === r.id)).toEqual({ id: r.id, name: 'אולם צפון', switch_entity_id: 'switch.hall_b', member_ids: [], color_token: 'circuit-2', power_w: 0 });
    const withLamp = toggleCircuitMember(r.doc, r.id, 'o3'); // o3 belongs to k1: it moves over
    expect(withLamp.circuits.find((k) => k.id === r.id)!.member_ids).toEqual(['o3']);
    expect(withLamp.circuits.find((k) => k.id === 'k1')!.member_ids).toEqual([]);
    expect(toggleCircuitMember(withLamp, r.id, 'o3').circuits.find((k) => k.id === r.id)!.member_ids).toEqual([]);
    const items = new Map(library.items.map((i) => [i.id, i]));
    const lookup = (id: string) => items.get(id);
    expect(circuitPower(withLamp, withLamp.circuits.find((k) => k.id === r.id)!, lookup)).toBe(36); // the item's default
    const boosted = patchObject(withLamp, 'o3', { params: { power_w: 60 } });
    expect(circuitPower(boosted, boosted.circuits.find((k) => k.id === r.id)!, lookup)).toBe(60); // the object's own value wins
    expect(patchCircuit(r.doc, r.id, { name: 'צפון', color_token: 'circuit-3' }).circuits.at(-1)).toMatchObject({ name: 'צפון', color_token: 'circuit-3' });
  });
});

// Hotfix 0.1.87 (owner report 2026-09-25): a wall moves as a whole, a zone polygon moves as a whole.
test.describe('whole-wall and whole-zone moves (unit)', () => {
  test('translateWall moves every corner by the same delta; its openings keep t; groups and connectors stay', () => {
    const doc = sample();
    const moved = translateWall(doc, 'wa', 0.05, 0.02);
    expect(moved.walls.find((w) => w.id === 'wa')!.polyline).toEqual([[0.15, 0.12], [0.95, 0.12], [0.95, 0.62]]);
    expect(moved.walls.filter((w) => w.id !== 'wa')).toEqual(doc.walls.filter((w) => w.id !== 'wa')); // the other walls stay
    expect(moved.openings).toEqual(doc.openings); // openings sit at a relative t: they ride along unchanged
    expect(moved.openings.filter((o) => o.wall_id === 'wa').map((o) => o.t)).toEqual([0.75, 0.2]);
    expect(moved.groups).toBe(doc.groups);
    expect(moved.connectors).toBe(doc.connectors);
    expect(moved.objects).toBe(doc.objects);
    expect(doc.walls.find((w) => w.id === 'wa')!.polyline[0]).toEqual([0.1, 0.1]); // the input is never mutated
  });

  test('translateWall is clamped as a whole: no corner leaves the plan and the shape is kept', () => {
    const doc = sample();
    const right = translateWall(doc, 'wa', 0.5, 0); // max x is 0.9: only 0.1 of the move fits
    expect(right.walls.find((w) => w.id === 'wa')!.polyline).toEqual([[0.2, 0.1], [1, 0.1], [1, 0.6]]);
    const up = translateWall(doc, 'wa', -0.03, -0.4); // min y is 0.1
    expect(up.walls.find((w) => w.id === 'wa')!.polyline).toEqual([[0.07, 0], [0.87, 0], [0.87, 0.5]]);
    expect(translateWall(doc, 'nope', 0.1, 0.1)).toEqual(doc); // an unknown wall changes nothing
    const ring = { ...doc, walls: [...doc.walls, { ...doc.walls[0], id: 'ring', polyline: [[0.2, 0.2], [0.3, 0.2], [0.3, 0.3], [0.2, 0.2]] as [number, number][] }] };
    const r = translateWall(ring, 'ring', 0.1, 0.1).walls.find((w) => w.id === 'ring')!.polyline;
    expect(r[0]).toEqual(r[3]); // a closed outline stays closed
    expect(r).toEqual([[0.3, 0.3], [0.4, 0.3], [0.4, 0.4], [0.3, 0.3]]);
  });

  test('objectHitCorners widens a small footprint to the minimum side around its centre, turned with it; a big one keeps its footprint', () => {
    const small = { cx: 100, cy: 50, w: 4, h: 10, rotation: 0, corners: [[98, 45], [102, 45], [102, 55], [98, 55]] as [number, number][] };
    expect(objectHitCorners(small, 24)).toEqual([[88, 38], [112, 38], [112, 62], [88, 62]]);
    const turned = objectHitCorners({ ...small, rotation: 90 }, 24).map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
    expect(turned).toEqual([[112, 38], [112, 62], [88, 62], [88, 38]]); // turned a quarter: the same square, corners in turn
    const wide = { ...small, w: 30, h: 10 };
    expect(objectHitCorners(wide, 24)).toEqual([[85, 38], [115, 38], [115, 62], [85, 62]]); // only the narrow side grows
    const big = { ...small, w: 40, h: 30 };
    expect(objectHitCorners(big, 24)).toBe(big.corners);
  });

  test('duplicateBeside puts the copy one width plus 30 cm to the right, below when that leaves the plan, left when below leaves it too; unknown id unchanged', () => {
    const doc = sample();
    const o = doc.objects.find((x: GeomObject) => x.id === 'o3')!; // (0.5, 0.5), size from the catalog fixture
    const W = 2000, H = 1000, scale = 0.01; // 20 m by 10 m
    const r = duplicateBeside(doc, 'o3', W, H, scale);
    expect(r.id).not.toBe('o3');
    const copy = r.doc.objects.find((x) => x.id === r.id)!;
    expect(copy.position[0]).toBeCloseTo(o.position[0] + (o.size.w_m + 0.3) / scale / W, 5);
    expect(copy.position[1]).toBeCloseTo(o.position[1], 5);
    expect(copy.item_id).toBe(o.item_id);
    expect(r.doc.objects.length).toBe(doc.objects.length + 1);
    const atRightEdge = { ...doc, objects: doc.objects.map((x: GeomObject) => (x.id === 'o3' ? { ...x, position: [0.99, 0.5] as [number, number] } : x)) };
    const below = duplicateBeside(atRightEdge, 'o3', W, H, scale);
    const b = below.doc.objects.find((x) => x.id === below.id)!;
    expect(b.position[0]).toBeCloseTo(0.99, 5);
    expect(b.position[1]).toBeCloseTo(0.5 + (o.size.d_m + 0.3) / scale / H, 5);
    const atCorner = { ...doc, objects: doc.objects.map((x: GeomObject) => (x.id === 'o3' ? { ...x, position: [0.99, 0.99] as [number, number] } : x)) };
    const left = duplicateBeside(atCorner, 'o3', W, H, scale);
    const l = left.doc.objects.find((x) => x.id === left.id)!;
    expect(l.position[0]).toBeCloseTo(0.99 - (o.size.w_m + 0.3) / scale / W, 5);
    expect(l.position[1]).toBeCloseTo(0.99, 5);
    expect(duplicateBeside(doc, 'nope', W, H, scale)).toEqual({ doc, id: 'nope' });
  });

  test('translatePolygon moves a zone polygon as a whole, clamped inside the plan, rounded to 4 places', () => {
    const poly = [{ x: 0.03, y: 0.55 }, { x: 0.15, y: 0.55 }, { x: 0.15, y: 0.68 }, { x: 0.03, y: 0.68 }];
    expect(translatePolygon(poly, 0.1, -0.05)).toEqual([{ x: 0.13, y: 0.5 }, { x: 0.25, y: 0.5 }, { x: 0.25, y: 0.63 }, { x: 0.13, y: 0.63 }]);
    expect(translatePolygon(poly, -0.2, 0.5)).toEqual([{ x: 0, y: 0.87 }, { x: 0.12, y: 0.87 }, { x: 0.12, y: 1 }, { x: 0, y: 1 }]);
    expect(translatePolygon(poly, 0.012345, 0)[0]).toEqual({ x: 0.0423, y: 0.55 });
    expect(poly[0]).toEqual({ x: 0.03, y: 0.55 }); // never mutated
  });

  // 0.1.89: the plan.levels setting turned into the level filter a map opens with.
  test('initialLevel: all levels for "all" or an unset setting, the default level id for "default", null with no or one level', () => {
    const doc = sample(); // L0 (default), L1
    expect(initialLevel('all', doc)).toBeNull();
    expect(initialLevel(undefined, doc)).toBeNull();
    expect(initialLevel('default', doc)).toBe('L0');
    const oneLevel = { ...doc, levels: [doc.levels[1]] }; // a single, non-default level: still behaves as today
    expect(initialLevel('default', oneLevel)).toBeNull();
    const noLevels = { ...doc, levels: [] };
    expect(initialLevel('default', noLevels)).toBeNull();
    expect(initialLevel('all', noLevels)).toBeNull();
  });
});
