import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeometryDoc, GeomObject } from '../src/map/geometry';
import type { CatalogItem } from '../src/api/plan-catalog';
import { addArray, addCircuit, addConnector, addLevel, addObject, arrayDefaults, circuitPower, duplicateObject, levelUsage, moveConnectorVertex, moveGroup, moveObject, objectZ, patchCircuit, patchConnector, patchLevel, patchObject, removeGroup, removeItem, removeLevel, rotationTo, stretchedSize, toggleCircuitMember, visibleUnderLevel } from '../src/map/studio-ops';

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
