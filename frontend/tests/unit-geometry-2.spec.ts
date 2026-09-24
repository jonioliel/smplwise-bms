import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAnchorPositions, buildPrimitives, connectorLabel, objectCorners, SYMBOL_IDS, type CatalogLookup, type GeometryDoc, type GeomLevel, type ObjectPrim, type ObjectShape, type Primitive } from '../src/map/geometry';
import { searchItems, type CatalogItem } from '../src/api/plan-catalog';

// Plan Studio phase 2 (T085): the object and connector primitives equal the backend renderer's (the extended golden
// file), a missing item draws as a box, the connector label and the anchor refresh mirror the Python, and the library
// search finds items by Hebrew / English names and tags. Runs in node: no page, no backend.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const CATALOG = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json');
const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.primitives.json'), 'utf8')) as { all: Primitive[]; level_L1: Primitive[] };
const library = JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: CatalogItem[] };
const byId = new Map(library.items.map((i) => [i.id, i]));
const lookup: CatalogLookup = (id) => {
  const i = byId.get(id);
  return i ? { shape: i.shape as ObjectShape, icon: i.icon, color_token: i.color_token } : undefined;
};

/** Deep comparison with a 0.011 px tolerance on numbers (Math.hypot and the C library may differ in the last bit). */
function close(a: unknown, b: unknown, where = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), `${where}: ${a} vs ${b}`).toBeLessThanOrEqual(0.011);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, `${where} length`).toBe(b.length);
    a.forEach((x, i) => close(x, b[i], `${where}[${i}]`));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), `${where} keys`).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${where}.${k}`);
    return;
  }
  expect(a, where).toEqual(b);
}

test.describe('plan studio objects and connectors (unit)', () => {
  test('the map draws exactly what the backend exports, objects and connectors included', () => {
    const all = buildPrimitives(sample(), 1000, 800, null, lookup);
    expect(all.length).toBe(24);
    close(all, golden.all, 'all');
    const l1 = buildPrimitives(sample(), 1000, 800, 'L1', lookup);
    expect(l1.length).toBe(7);
    close(l1, golden.level_L1, 'L1');
    expect(all.map((p) => p.kind).slice(15)).toEqual(['label', 'label', 'connector', 'connector', 'object', 'object', 'object', 'object', 'object']);
  });

  test('a missing item draws as a plain box; the symbol ids are the 24 known ones', () => {
    const o1 = buildPrimitives(sample(), 1000, 800, null, () => undefined).find((p) => p.id === 'o1') as ObjectPrim;
    expect([o1.shape, o1.icon, o1.color]).toEqual(['box', 'box', 'object']);
    expect(SYMBOL_IDS.length).toBe(24);
    expect(new Set(library.items.map((i) => i.icon))).toEqual(new Set(SYMBOL_IDS));
  });

  test('connector labels and the corners of a turned footprint', () => {
    const levels = new Map<string, GeomLevel>(sample().levels.map((l) => [l.id, l]));
    expect(connectorLabel(levels, { level_from: 'L0', level_to: 'L1', label: null })).toBe('↓ −1.2 מ׳');
    expect(connectorLabel(levels, { level_from: 'L1', level_to: 'L0', label: null })).toBe('↑ +1.2 מ׳');
    expect(connectorLabel(levels, { level_from: 'L0', level_to: null, label: null })).toBe('↕');
    expect(connectorLabel(levels, { level_from: 'L0', level_to: 'L1', label: 'לגלריה' })).toBe('לגלריה');
    const o2 = sample().objects.find((o) => o.id === 'o2')!;
    close(objectCorners(o2, 1000, 800, 0.01), [[335, 250], [335, 390], [265, 390], [265, 250]], 'o2');
  });

  test('a bound body follows its anchor; the input document is untouched', () => {
    const doc = sample();
    const moved = applyAnchorPositions(doc, { 'ha_entity:light.store': { x: 0.9123456789, y: 0.9, rotation: 45 } });
    const o3 = moved.objects.find((o) => o.id === 'o3')!;
    expect(o3.position).toEqual([0.912346, 0.9]);
    expect(o3.rotation_deg).toBe(45);
    expect(doc.objects.find((o) => o.id === 'o3')!.position).toEqual([0.5, 0.3]);
    expect((buildPrimitives(moved, 1000, 800, null, lookup).find((p) => p.id === 'o3') as ObjectPrim).cx).toBe(912.35);
  });

  test('the library search matches Hebrew and English names and tags, any category', () => {
    const items = library.items;
    expect(searchItems(items, 'כיסא', null).map((i) => i.id)).toContain('chair.basic');
    expect(searchItems(items, 'bleachers', null).map((i) => i.id)).toEqual(['tribune.stepped']);
    expect(searchItems(items, 'יציע', null).map((i) => i.id).sort()).toEqual(['bleacher.mobile', 'tribune.stepped']);
    expect(searchItems(items, 'מטף', 'safety').length).toBe(2);
    expect(searchItems(items, 'מטף', 'medical')).toEqual([]);
    expect(searchItems(items, '', 'lighting').length).toBe(12);
  });
});
