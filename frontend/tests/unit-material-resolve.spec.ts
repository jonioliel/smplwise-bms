import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATERIALS, canonicalMaterial, materialDef, resolveLight, resolveMaterials, type CatalogMaterialLookup } from '../src/map/material-resolve';
import { foldHeading, moveWalkPosition, removeWalkPosition, setItemMaterial, setNorth, setSurface, upsertWalkPosition, usesStudio6 } from '../src/map/studio6-fields';
import { withDocVersion } from '../src/map/glass-wall';
import type { GeometryDoc } from '../src/map/geometry';

// Plan Studio 6, slice S0 (CR-029): the frontend material resolver gives the backend's golden (one fixture pins both sides),
// is deterministic under reordering, falls back with a warning on unknown ids; document 2.2 is stamped only when a Studio 6
// field is present; the edit operations of the editor and the walk keep the document minimal. Runs in node.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FIX = path.join(ROOT, 'contracts', 'fixtures', 'plan_geometry');
const load = (name: string): GeometryDoc => JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8')) as GeometryDoc;
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v22.materials.json'), 'utf8'));
const catalogFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as { items: { id: string; role: string; material_id?: string; light?: object }[] };
const items = new Map(catalogFile.items.map((i) => [i.id, i]));
const catalog: CatalogMaterialLookup = (id) => items.get(id) as ReturnType<CatalogMaterialLookup>;

test('the frontend copy of the library is the backend file, byte for byte', () => {
  const back = fs.readFileSync(path.join(ROOT, 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'materials.json'));
  const front = fs.readFileSync(path.join(ROOT, 'frontend', 'src', 'map', 'materials.json'));
  expect(front.equals(back)).toBe(true);
  expect(MATERIALS.length).toBeGreaterThanOrEqual(28);
  expect(canonicalMaterial('floor_oak')).toBe('oak');
  expect(canonicalMaterial('nope')).toBeNull();
  expect(materialDef('oak')?.tint).toEqual({ light: '#bf9a6a', dark: '#7a6650' }); // LOOK_SPEC section 2
  expect(materialDef('glass_frosted')?.glass?.opacity).toBe(0.62);
});

test('the resolver matches the backend golden on the 2.2 sample', () => {
  expect(resolveMaterials(load('sample-v22.json'), catalog)).toEqual(golden);
});

test('the resolver is deterministic under reordering and pure', () => {
  const doc = load('sample-v22.json');
  const first = JSON.stringify(resolveMaterials(doc, catalog));
  const before = JSON.stringify(doc);
  const rev = { ...doc, walls: [...doc.walls].reverse(), openings: [...doc.openings].reverse(), objects: [...doc.objects].reverse(), rooms: [...doc.rooms].reverse(), levels: [...doc.levels].reverse() };
  const again = resolveMaterials(rev, catalog);
  // the same values; key order differs only by insertion, so compare canonically
  const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
  expect(canon(again)).toBe(canon(JSON.parse(first)));
  expect(JSON.stringify(doc)).toBe(before);
});

test('defaults on an old document, unknown ids warn', () => {
  const doc = load('sample-v2.json');
  const r = resolveMaterials(doc, catalog);
  expect(r.walls).toEqual({ wa: 'plaster_exterior', wb: 'plaster_white', wc: 'plaster_white', wd: 'plaster_white' });
  expect(r.openings.oe).toBeNull();
  expect(r.warnings).toEqual([]);
  const bad = setItemMaterial(doc, 'walls', 'wa', 'marble_2099');
  const rb = resolveMaterials(bad, catalog);
  expect(rb.walls.wa).toBe('plaster_exterior');
  expect(rb.warnings).toEqual([{ path: 'walls.material_id', id: 'wa', material_id: 'marble_2099' }]);
  // an unknown catalog item falls back to the neutral material
  expect(resolveMaterials({ ...doc, objects: [{ ...doc.objects[0], id: 'zz', item_id: 'custom.none' }] }, catalog).objects.zz).toBe('plastic');
});

test('lamp light: own > item > default, clamped into the ranges', () => {
  expect(resolveLight(undefined, undefined)).toEqual({ kind: 'ceiling', color_k: 3000, lumens: 800 });
  expect(resolveLight({ kind: 'spot', color_k: 9000, lumens: 0, beam_deg: 500 }, undefined)).toEqual({ kind: 'spot', color_k: 6500, lumens: 1, beam_deg: 180 });
  expect(resolveLight(undefined, { kind: 'wall', color_k: 2700.9, lumens: 500 })).toEqual({ kind: 'wall', color_k: 2700, lumens: 500 });
});

test('document 2.2 is stamped only while a Studio 6 field is present', () => {
  const v2 = load('sample-v2.json');
  expect(usesStudio6(v2)).toBe(false);
  expect(withDocVersion(v2)).toBe(v2);
  const north = setNorth(v2, -30);
  expect(north.north_deg).toBe(330);
  expect(withDocVersion(north).schema_version).toBe('2.2');
  expect(withDocVersion(setNorth(withDocVersion(north), null)).schema_version).toBe('2.0');
  const glass = load('sample-v2-glass.json');
  expect(withDocVersion(setItemMaterial(glass, 'walls', glass.walls[0].id, 'oak')).schema_version).toBe('2.2');
  expect(withDocVersion(setItemMaterial(withDocVersion(setItemMaterial(glass, 'walls', glass.walls[0].id, 'oak')), 'walls', glass.walls[0].id, null)).schema_version).toBe('2.1');
  expect(usesStudio6({ ...v2, walk_positions: [] })).toBe(false);
  expect(usesStudio6(setSurface(v2, 'levels', 'L0', 'floor_material_id', 'oak'))).toBe(true);
  expect(usesStudio6(setSurface(v2, 'levels', 'L0', 'floor_material_id', null))).toBe(false);
});

test('surfaces: a room ceiling true is the default and stored as absent', () => {
  const doc = { ...load('sample-v2.json'), rooms: [{ id: 'r1' }] } as GeometryDoc;
  const off = setSurface(doc, 'rooms', 'r1', 'ceiling', false);
  expect(off.rooms[0]).toEqual({ id: 'r1', ceiling: false });
  expect(setSurface(off, 'rooms', 'r1', 'ceiling', true).rooms[0]).toEqual({ id: 'r1' });
});

test('saved walk positions: upsert, one default, order, removal back to absent', () => {
  let doc = load('sample-v2.json');
  doc = upsertWalkPosition(doc, { id: 'a', name: '  כניסה  ', x: 1.2, y: 0.5, level_id: 'L0', heading_deg: -90, is_default: true });
  expect(doc.walk_positions).toEqual([{ id: 'a', name: 'כניסה', x: 1, y: 0.5, level_id: 'L0', heading_deg: 270, is_default: true }]);
  doc = upsertWalkPosition(doc, { id: 'b', name: 'אולם', x: 0.3, y: 0.3, level_id: 'L1', heading_deg: 45, is_default: true });
  expect(doc.walk_positions!.map((p) => [p.id, !!p.is_default])).toEqual([['a', false], ['b', true]]);
  doc = moveWalkPosition(doc, 'b', -1);
  expect(doc.walk_positions!.map((p) => p.id)).toEqual(['b', 'a']);
  expect(moveWalkPosition(doc, 'b', -1)).toBe(doc);
  doc = removeWalkPosition(removeWalkPosition(doc, 'a'), 'b');
  expect('walk_positions' in doc).toBe(false);
  let many = load('sample-v2.json');
  for (let i = 0; i < 55; i++) many = upsertWalkPosition(many, { id: `p${i}`, name: 'x', x: 0.5, y: 0.5, level_id: 'L0', heading_deg: 0 });
  expect(many.walk_positions).toHaveLength(50);
  expect(foldHeading(720.0004)).toBe(0);
  expect(foldHeading(Number.NaN)).toBe(0);
});
