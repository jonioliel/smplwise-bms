import { test, expect } from '@playwright/test';
import { boundItemOf } from '../src/map/part-select';
import type { GeomObject, GeomOpening } from '../src/map/geometry';

// T087 Task 10 (review of Task 7): one selection rule for a click in the 3D on the live map, the history map and the
// event page. Node only.
const ref = (resource_type: 'camera' | 'ha_entity', resource_id: string) => ({ resource_type, resource_id });
const doc = {
  objects: [
    { id: 'lamp', anchor_ref: ref('ha_entity', 'light.hall') },
    { id: 'chair', anchor_ref: null },
    { id: 'orphan', anchor_ref: ref('ha_entity', 'light.gone') }, // bound to an entity that is not placed on this floor
  ] as unknown as GeomObject[],
  openings: [
    { id: 'door', anchor_ref: ref('ha_entity', 'lock.front') },
    { id: 'window', anchor_ref: null },
  ] as unknown as GeomOpening[],
};
const anchors = [
  { id: 'a-cam', resource_type: 'camera', resource_id: 'cam-1' },
  { id: 'a-light', resource_type: 'ha_entity', resource_id: 'light.hall' },
  { id: 'a-lock', resource_type: 'ha_entity', resource_id: 'lock.front' },
];

test('a camera or an entity selects itself; a bound door or object selects its entity', () => {
  expect(boundItemOf({ id: 'a-cam', kind: 'camera' }, doc, anchors)).toEqual({ anchor: 'a-cam' });
  expect(boundItemOf({ id: 'a-lock', kind: 'entity' }, doc, anchors)).toEqual({ anchor: 'a-lock' });
  expect(boundItemOf({ id: 'door', kind: 'opening' }, doc, anchors)).toEqual({ anchor: 'a-lock' });
  expect(boundItemOf({ id: 'lamp', kind: 'object' }, doc, anchors)).toEqual({ anchor: 'a-light' });
});

test('an unbound object is the object; an unbound opening and every other part are stray clicks', () => {
  expect(boundItemOf({ id: 'chair', kind: 'object' }, doc, anchors)).toEqual({ object: 'chair' });
  expect(boundItemOf({ id: 'orphan', kind: 'object' }, doc, anchors)).toEqual({ object: 'orphan' }); // its entity is not on the floor
  expect(boundItemOf({ id: 'window', kind: 'opening' }, doc, anchors)).toBeNull();
  for (const kind of ['zone', 'wall', 'connector', 'label', 'level', 'floor'])
    expect(boundItemOf({ id: 'x', kind }, doc, anchors), kind).toBeNull();
  // unknown ids and a screen without a document never select anything
  expect(boundItemOf({ id: 'nope', kind: 'object' }, doc, anchors)).toBeNull();
  expect(boundItemOf({ id: 'door', kind: 'opening' }, null, anchors)).toBeNull();
});
