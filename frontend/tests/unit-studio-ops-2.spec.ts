import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeometryDoc, GeomObject } from '../src/map/geometry';
import type { CatalogItem } from '../src/api/plan-catalog';
import { addObject, duplicateObject, moveObject, objectZ, patchObject, removeItem, rotationTo, stretchedSize } from '../src/map/studio-ops';

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
    const noGroup = removeItem(doc, 'g1');
    expect(noGroup.groups).toEqual([]);
    expect(noGroup.objects.filter((o) => o.group_id === null).length).toBe(5);
    expect(removeItem(doc, 'c1').connectors.map((c) => c.id)).toEqual(['cx-o4']);
    expect(removeItem(doc, 'k1').circuits).toEqual([]);
    expect((doc.objects[0] as GeomObject).group_id).toBe('g1'); // the input is untouched
  });
});
