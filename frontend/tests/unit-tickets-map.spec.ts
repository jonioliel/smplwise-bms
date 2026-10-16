import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { anchorName, mapLine, nearestElement, pickerElements, pickOf } from '../src/tickets/map-picker-model';
import { describeElement, mapHref, type MapElementInfo } from '../src/api/tickets-map';
import { mapBlock } from '../src/public-ticket/map-block';
import { CATALOGUES, LANGS } from '../src/public-ticket/strings';
import type { Anchor } from '../src/api/types';

// TKMAP1 (owner 16.10): a map element attached to a service request - the picker's pure model, the request's map line and "הצג במפה",
// and the vendor page's map card (text + a server-drawn picture only).
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-map.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));

const anchor = (over: Partial<Anchor> & { id: string }): Anchor => ({
  floor_id: 'f2', plan_version_id: 'pv', resource_type: 'camera', resource_id: 'cam-1', position: { x: 0.5, y: 0.5 }, rotation_degrees: 0,
  field_of_view_degrees: null, coverage_radius: null, coverage_polygon: null, layer_id: 'cameras', label: null, revision: 1, effective_from: '',
  effective_to: null, updated_at: '', ...over,
} as Anchor);

const info = (over: Partial<MapElementInfo> = {}): MapElementInfo => ({
  kind: 'anchor', type: 'camera', name: 'מצלמת לובי', floor_name: 'קומה 2', room_name: 'לובי', attached_at: '2026-10-16T08:00:00Z', present: true,
  vendor_image: true, floor_id: 'f2', element_id: 'a-1', resource_id: 'cam-1', ...over,
});

test('the picker offers the floor anchors then its objects, named like the map, and skips a position outside the plan', () => {
  const list = pickerElements(
    [anchor({ id: 'a-1', label: 'מצלמת לובי' }), anchor({ id: 'a-2', resource_type: 'ha_entity', resource_id: 'climate.ac', entity: { name: 'מזגן' } as never }),
      anchor({ id: 'a-out', position: { x: 3, y: 0.2 } })],
    [{ id: 'o-1', item_id: 'boiler', position: [0.2, 0.3], label: null, level_id: 'L0' }, { id: 'o-bad', item_id: 'x', position: [Number.NaN, 0], label: 'x' }],
    (o) => o.label || o.item_id);
  expect(list.map((e) => [e.key, e.type, e.name])).toEqual([['anchor:a-1', 'camera', 'מצלמת לובי'], ['anchor:a-2', 'ha_entity', 'מזגן'], ['object:o-1', 'object', 'boiler']]);
  expect(anchorName({ resource_type: 'camera', label: '  ', resource_id: 'cam-9', camera: { alias: 'כניסה', name: 'Cam 9' } })).toBe('כניסה');
  expect(anchorName({ resource_type: 'ha_entity', label: null, resource_id: 'light.x', entity: null })).toBe('light.x');
});

test('a click picks the nearest element within the radius (round on screen), or nothing', () => {
  const list = pickerElements([anchor({ id: 'a', position: { x: 0.5, y: 0.5 } }), anchor({ id: 'b', position: { x: 0.53, y: 0.5 } })], [], () => '');
  expect(nearestElement(list, 0.51, 0.5, 1.25)?.id).toBe('a');
  expect(nearestElement(list, 0.525, 0.5, 1.25)?.id).toBe('b');
  expect(nearestElement(list, 0.9, 0.9, 1.25)).toBeNull();
  expect(pickOf('f2', { kind: 'anchor', id: 'a' })).toEqual({ element: { floor_id: 'f2', kind: 'anchor', id: 'a' } });
});

test('the request line and "הצג במפה": the live map focused on the element; nothing to show once it left the map or for a non-reader', () => {
  expect(mapLine(info())).toEqual({ text: 'מצלמת לובי · קומה 2 · לובי', gone: false, canShow: true, vendorImage: true });
  expect(mapHref(info())).toBe('#/explore/floors/f2?camera=cam-1');
  expect(mapHref(info({ type: 'ha_entity', resource_id: 'climate.ac' }))).toBe('#/explore/floors/f2?entity=climate.ac');
  expect(mapHref(info({ type: 'object', kind: 'object', resource_id: null, element_id: 'o-1' }))).toBe('#/explore/floors/f2?focus=object%3Ao-1');
  expect(mapHref(info({ present: false }))).toBeNull();
  expect(mapHref(info({ floor_id: undefined }))).toBeNull(); // a reader without map.read gets no where-fields
  expect(mapLine(info({ present: false, vendor_image: false, room_name: null }))).toEqual({ text: 'מצלמת לובי · קומה 2', gone: true, canShow: false, vendorImage: false });
  expect(describeElement(' a ', '', null)).toBe('a');
});

test('the vendor card: the stored text, a picture only when the server says so, nothing for a malformed answer', () => {
  expect(mapBlock({ name: 'מזגן משרד', floor: 'קומה 2', room: 'משרד 12', image: true })).toEqual({ line: 'מזגן משרד · קומה 2 · משרד 12', image: true });
  expect(mapBlock({ name: 'מזגן משרד', floor: 'קומה 2', room: '', image: false })).toEqual({ line: 'מזגן משרד · קומה 2', image: false });
  expect(mapBlock({ name: 'x', floor: '', room: '', image: 'yes' })).toEqual({ line: 'x', image: false });
  for (const bad of [null, undefined, 'x', 3, {}, { name: '', floor: ' ', room: '' }]) expect(mapBlock(bad)).toBeNull();
});

test('the vendor card words exist in all four languages', () => {
  for (const lang of LANGS) {
    for (const k of ['mapTitle', 'mapAlt', 'mapNoImage'] as const) expect(CATALOGUES[lang][k], `${lang}.${k}`).toBeTruthy();
  }
});

test('the vendor page fetches the picture with the token header and shows it only through a blob: URL; the image is never a map', () => {
  const src = (f: string) => readFileSync(path.resolve(HERE, '../src/public-ticket', f), 'utf8');
  const api = src('api.ts');
  const fetcher = api.slice(api.indexOf('mapBlob:'), api.indexOf('codeSend:'));
  expect(fetcher).toContain("'/t/api/map-image'");
  expect(fetcher).toContain("'X-Ticket-Token'");
  expect(fetcher).toContain("credentials: 'omit'");
  expect(fetcher).toContain("startsWith('image/svg+xml')");
  const main = src('main.ts');
  const at = main.indexOf('private mapCard(');
  const card = main.slice(at, main.indexOf('\n  private ', at + 10));
  expect(card).toContain('img(this.mapUrl');
  expect(card).not.toMatch(/addEventListener|on: \{|svg|innerHTML/i);
  const forget = main.slice(main.indexOf('private forget(): void {'), main.indexOf('private saveDraft(): void {'));
  expect(forget).toContain('URL.revokeObjectURL(this.mapUrl)');
});
