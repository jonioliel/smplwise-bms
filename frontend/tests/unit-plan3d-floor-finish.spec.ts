import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogItem, CatalogLibrary } from '../src/api/plan-catalog';
import { lookup3dOf, lookupMaterialsOf } from '../src/api/plan-catalog';
import { CHOICES, DEFAULT_VIEW } from '../src/api/plan-view';
import type { GeometryDoc } from '../src/map/geometry';
import { DEFAULT_FLOOR_FINISH, FINISH_CERAMIC, FINISH_DEFS, FINISH_MARBLE, FLOOR_FINISHES, finishMaterial, finishPixels } from '../src/map/floor-finish';
import { buildScene, type SceneInput } from '../src/map/scene-builder';
import { takesFinish } from '../src/map/scene-real-builder';
import { DEFAULT_REAL, RealMaterials, roomFloorMaterial } from '../src/map/scene-real';

// PLAN3D-REALISM2-2433 (owner 2026-11-11): the floor finish of the realistic level - the installation dial `floor_finish`
// (wood / marble / luxury ceramic, marble at install), which floors it paints, and the generated (asset-free) textures.
// Node only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const CATALOG = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json');
const builtin = (JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: CatalogItem[] }).items;
const lib: CatalogLibrary = { catalog_version: 'test', revision: 'test', categories: [], icons: [], color_tokens: [], items: builtin };

const box = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
function input(): SceneInput {
  const doc = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
  doc.rooms = [
    { id: 'living', level_id: 'L0', tags: ['living'] },
    { id: 'bath', level_id: 'L0', tags: ['bath'] },
    { id: 'own', level_id: 'L0', floor_material_id: 'carpet' },
    // 'plain' has no room entry at all: the level's floor, untagged
  ];
  return {
    doc, width: 1000, height: 800, anchors: [], entityStates: {}, circuitStates: {}, catalog: lookup3dOf(lib), materialsCatalog: lookupMaterialsOf(lib), realistic: true,
    zones: [
      { id: 'living', name: 'סלון', polygon: box(0.12, 0.12, 0.4, 0.4), level_id: 'L0' },
      { id: 'bath', name: 'אמבטיה', polygon: box(0.42, 0.12, 0.58, 0.4), level_id: 'L0' },
      { id: 'own', name: 'משרד', polygon: box(0.62, 0.12, 0.88, 0.4), level_id: 'L0' },
      { id: 'plain', name: 'חדר', polygon: box(0.12, 0.45, 0.58, 0.7), level_id: 'L0' },
    ],
  };
}

test('the dial: wood / marble / ceramic, marble at install, the same everywhere it is listed', () => {
  expect(FLOOR_FINISHES).toEqual(['wood', 'marble', 'ceramic']);
  expect(CHOICES.floor_finish).toEqual(FLOOR_FINISHES);
  expect(DEFAULT_FLOOR_FINISH).toBe('marble');
  expect(DEFAULT_VIEW.floor_finish).toBe('marble');
  expect(DEFAULT_REAL.floorFinish).toBe('marble');
  expect(finishMaterial('wood')).toBe('oak');
  expect(finishMaterial('marble')).toBe(FINISH_MARBLE);
  expect(finishMaterial('ceramic')).toBe(FINISH_CERAMIC);
  expect(finishMaterial(undefined)).toBe(FINISH_MARBLE); // an older caller without the dial
});

test('which floors take the finish: untagged and living rooms; wet rooms, own materials and a level material keep theirs', () => {
  expect(takesFinish(undefined, undefined)).toBe(true);
  expect(takesFinish({ id: 'a', tags: ['living'] }, undefined)).toBe(true);
  expect(takesFinish({ id: 'a', tags: ['סלון'] }, undefined)).toBe(true);
  expect(takesFinish({ id: 'a', tags: ['storage'] }, undefined)).toBe(true); // no special-floor rule: the level's concrete before
  for (const t of ['bath', 'kitchen', 'parking', 'garden', 'office', 'gym']) expect(takesFinish({ id: 'a', tags: [t] }, undefined), t).toBe(false);
  expect(takesFinish({ id: 'a', floor_material_id: 'oak' }, undefined)).toBe(false);
  expect(takesFinish({ id: 'a' }, { id: 'L0', name: '', elevation_m: 0, ceiling_height_m: 3, is_default: true, floor_material_id: 'tiles_grey' })).toBe(false);
  expect(takesFinish({ id: 'a', floor_material_id: 'no-such-id' }, undefined)).toBe(true); // an unknown id resolves to the default
  const real = buildScene(input()).real!;
  const by = Object.fromEntries(real.floors.map((f) => [f.zone, f]));
  expect(by.living.finish).toBe(true);
  expect(by.plain.finish).toBe(true);
  expect(by.bath.finish).toBeUndefined();
  expect(by.bath.material).toBe('tiles_grey');
  expect(by.own.finish).toBeUndefined();
  expect(by.own.material).toBe('carpet');
  // the resolved material stays in the description (the wood finish and an older reader draw it as before)
  expect(by.living.material).toBe('oak');
});

test('the realisation draws the finish floors in the dial\'s material; the others in their own', () => {
  const real = buildScene(input()).real!;
  const drawn = (finish?: 'wood' | 'marble' | 'ceramic') => Object.fromEntries(real.floors.map((f) => [f.zone, roomFloorMaterial(f, { floorFinish: finish })]));
  expect(drawn('marble')).toEqual({ living: FINISH_MARBLE, plain: FINISH_MARBLE, bath: 'tiles_grey', own: 'carpet' });
  expect(drawn('ceramic')).toEqual({ living: FINISH_CERAMIC, plain: FINISH_CERAMIC, bath: 'tiles_grey', own: 'carpet' });
  expect(drawn('wood')).toEqual({ living: 'oak', plain: 'oak', bath: 'tiles_grey', own: 'carpet' });
  expect(drawn(undefined)).toEqual(drawn('marble'));
});

test('the generated maps: one DataTexture per finish with the files source, none in the geometric look; tint per style', () => {
  const mats = new RealMaterials('/', () => {});
  mats.source = 'files';
  const m = mats.get(FINISH_MARBLE, 'floor');
  const map = m.map as unknown as { isDataTexture?: boolean; image: { width: number; height: number }; generateMipmaps: boolean };
  expect(map?.isDataTexture).toBe(true);
  expect([map.image.width, map.image.height]).toEqual([512, 512]);
  expect(map.generateMipmaps).toBe(true);
  expect(m.normalMap).toBeNull(); // no normal map: the cost of a plain textured floor
  expect(mats.get(FINISH_MARBLE, 'floor', false).map).toBe(m.map); // one texture per finish
  expect((mats.get(FINISH_CERAMIC, 'floor').map as unknown as { image: { width: number } }).image.width).toBe(256);
  const geo = new RealMaterials('/', () => {});
  geo.source = 'procedural';
  expect(geo.get(FINISH_MARBLE, 'floor').map).toBeNull();
  const dark = new RealMaterials('/', () => {});
  dark.source = 'procedural';
  dark.style = 'dark';
  expect(dark.get(FINISH_MARBLE, 'floor').color.getHexString()).toBe(FINISH_DEFS[0].tint.dark.slice(1));
  mats.dispose();
});

test('the generated pixels: deterministic, opaque, tileable, cheap', () => {
  for (const id of [FINISH_MARBLE, FINISH_CERAMIC]) {
    const t0 = performance.now();
    const a = finishPixels(id);
    const ms = performance.now() - t0;
    const b = finishPixels(id);
    expect(Buffer.from(a).equals(Buffer.from(b)), id).toBe(true);
    const size = Math.sqrt(a.length / 4);
    expect([256, 512]).toContain(size);
    for (let i = 3; i < a.length; i += 4) if (a[i] !== 255) throw new Error(`${id}: alpha ${a[i]} at ${i}`);
    // tileable: without the joints, the step from the last column (row) into the first is no larger than the largest step
    // between two neighbouring columns (rows) inside the square - the repeat shows no seam
    const p = finishPixels(id, size, false);
    const step = (i: number, j: number) => Math.abs(p[i] - p[j]) + Math.abs(p[i + 1] - p[j + 1]) + Math.abs(p[i + 2] - p[j + 2]);
    let seam = 0;
    let inner = 0;
    for (let k = 0; k < size; k++) {
      seam = Math.max(seam, step((k * size + size - 1) * 4, (k * size) * 4), step(((size - 1) * size + k) * 4, k * 4));
      inner = Math.max(inner, step((k * size + size / 2 - 1) * 4, (k * size + size / 2) * 4), step(((size / 2 - 1) * size + k) * 4, ((size / 2) * size + k) * 4));
    }
    expect(seam, `${id}: seam across the repeat (inner step ${inner})`).toBeLessThanOrEqual(Math.max(inner * 1.5, 12));
    // a light floor (the iso views read it as stone, not as a dark slab)
    let lum = 0;
    for (let i = 0; i < a.length; i += 4) lum += 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
    expect(lum / (a.length / 4), id).toBeGreaterThan(180);
    console.log(`floor finish ${id}: ${size} px, ${ms.toFixed(0)} ms`);
    expect(ms, `${id}: generated in bounded time`).toBeLessThan(3000);
  }
});
