import { test, expect } from '@playwright/test';
import { AO_VOLUME_RECIPE, VOL_MAX_XZ, VOL_TEXEL_M, aoVolumeInput, aoVolumeKey, aoVolumePlan, bakeAoVolume, flatWallRef, sampleVolume } from '../src/map/ao-volume';
import { GRADES, IDENTITY_GRADE, applyGrade, gradeFor } from '../src/map/color-grade';
import { buildScene, type SceneDescription, type ScenePart } from '../src/map/scene-builder';
import { houseInput } from './lookdev/house';

// PLAN3D-REALISM2-2433: the baked AO volume (determinism, the cache key, what it darkens) and the colour grade's numbers.
// Node only: pure functions, no three renderer, no DOM.

const box = (id: string, kind: ScenePart['kind'], position: [number, number, number], size: [number, number, number], level = 'L0', yaw = 0): ScenePart =>
  ({ id, kind, shape: 'box', position, size, rotation: [0, yaw, 0], color: 'map-structure', opacity: 1, group: null, level_id: level, userData: { id, kind } }) as ScenePart;
/** A 4 x 3 m room (walls 0.2 m thick, 2.6 m high) with a 0.8 m cabinet against the north wall's middle and a door leaf. */
function room(extra: ScenePart[] = []): Pick<SceneDescription, 'levels' | 'parts'> {
  return {
    levels: [{ id: 'L0', elevation_m: 0, ceiling_height_m: 2.6 }],
    parts: [
      box('w-n', 'wall', [2, 1.3, 0], [4.2, 2.6, 0.2]),
      box('w-s', 'wall', [2, 1.3, 3], [4.2, 2.6, 0.2]),
      box('w-w', 'wall', [0, 1.3, 1.5], [0.2, 2.6, 3]),
      box('w-e', 'wall', [4, 1.3, 1.5], [0.2, 2.6, 3]),
      box('cab', 'object', [2, 0.4, 0.4], [1.2, 0.8, 0.6]),
      box('leaf', 'door', [3.2, 1.05, 3], [0.9, 2.1, 0.04]),
      ...extra,
    ],
  };
}

test('the input keeps the static occluders only: no door leaf, no glass, no thin plate, no other level', () => {
  const d = room([box('pane', 'window', [1, 1.5, 3], [1, 1.2, 0.02]), box('plate', 'tint', [2, 0.01, 1.5], [3, 0.01, 2]), box('up', 'wall', [2, 4, 1], [1, 2, 0.2], 'L1')]);
  const inp = aoVolumeInput(d);
  expect(inp.parts.length).toBe(5);
  expect(inp.parts.some((p) => p.kind === 'door')).toBe(false);
  expect(inp.levels).toEqual([{ id: 'L0', elevation_m: 0, ceiling_height_m: 2.6 }]);
});

test('the key: stable for the same geometry, moved by a wall or the recipe inputs, not by a door state', () => {
  const a = aoVolumeKey(aoVolumeInput(room()));
  expect(a.startsWith(`${AO_VOLUME_RECIPE}:`)).toBe(true);
  expect(aoVolumeKey(aoVolumeInput(room()))).toBe(a);
  const open = room();
  open.parts = open.parts.map((p) => (p.kind === 'door' ? { ...p, rotation: [0, 90, 0] } : p));
  expect(aoVolumeKey(aoVolumeInput(open))).toBe(a);
  const moved = room();
  moved.parts = moved.parts.map((p) => (p.id === 'cab' ? { ...p, position: [2.5, 0.4, 0.4] } : p));
  expect(aoVolumeKey(aoVolumeInput(moved))).not.toBe(a);
  const lower = room();
  lower.levels = [{ id: 'L0', elevation_m: 0, ceiling_height_m: 2.4 }];
  expect(aoVolumeKey(aoVolumeInput(lower))).not.toBe(a);
});

test('the plan: texel 0.2 m over the footprint plus a margin; a large venue grows the texel so no side passes the cap', () => {
  const p = aoVolumePlan(aoVolumeInput(room()))!;
  expect(p.texel[0]).toBe(VOL_TEXEL_M);
  expect(p.origin[0]).toBeCloseTo(-0.5, 4);
  expect(p.dims[0]).toBe(Math.ceil(5 / VOL_TEXEL_M));
  expect(p.dims[1]).toBe(13);
  const big = aoVolumePlan(aoVolumeInput({ levels: [{ id: 'L0', elevation_m: 0, ceiling_height_m: 3 }], parts: [box('w', 'wall', [0, 1.5, 0], [80, 3, 0.2])] }))!;
  expect(big.dims[0]).toBeLessThanOrEqual(VOL_MAX_XZ);
  expect(big.texel[0]).toBeGreaterThan(VOL_TEXEL_M);
  expect(aoVolumePlan({ levels: [], parts: [] })).toBeNull();
  expect(aoVolumePlan({ levels: [{ id: 'L0', elevation_m: 0, ceiling_height_m: 3 }], parts: [] })).toBeNull();
});

test('the bake is deterministic: the same description gives the same bytes', async () => {
  const a = await bakeAoVolume(aoVolumeInput(room()));
  const b = await bakeAoVolume(aoVolumeInput(room()));
  expect(a).not.toBeNull();
  expect(Buffer.from(a!.data).equals(Buffer.from(b!.data))).toBe(true);
  expect(a!.data.length).toBe(a!.plan.dims[0] * a!.plan.dims[1] * a!.plan.dims[2] * 2);
  expect(a!.key).toBe(b!.key);
});

test('the bake darkens what it should: the floor by the cabinet and in a corner, a wall toward the floor, never the open middle', async () => {
  const v = (await bakeAoVolume(aoVolumeInput(room())))!;
  const s = (x: number, y: number, z: number) => sampleVolume(v, x, y, z)!;
  const open = s(2, 0.1, 2);
  const byCab = s(2, 0.1, 0.85); // the floor just in front of the cabinet
  const corner = s(0.25, 0.1, 2.75);
  expect(open.r).toBeGreaterThan(0.85);
  expect(byCab.r).toBeLessThan(open.r - 0.08);
  expect(corner.r).toBeLessThan(open.r - 0.15);
  // a wall face: lower is darker (the floor), the corner is darker than the middle of the face
  const wallLow = s(0.25, 0.3, 1.5).g;
  const wallHigh = s(0.25, 1.9, 1.5).g;
  expect(wallLow).toBeLessThan(wallHigh - 0.05);
  expect(s(0.25, 1.3, 2.75).g).toBeLessThan(s(0.25, 1.3, 1.5).g);
  // the middle of a wall face, high up, reads about the flat-wall reference (the shader divides by it)
  expect(Math.abs(wallHigh - v.wallRef)).toBeLessThan(0.12);
  // the inside of a wall took its open neighbours' values (no black core)
  expect(s(0, 1.3, 1.5).g).toBeGreaterThan(0.3);
  // above the level's ceiling lies outside the volume (the shader reads 1 there)
  expect(sampleVolume(v, 2, 2.7, 2)).toBeNull();
  expect(v.wallRef).toBeCloseTo(flatWallRef(), 4);
  expect(v.wallRef).toBeGreaterThan(0.5);
  expect(v.wallRef).toBeLessThan(0.95);
});

test('the look-dev house bakes in bounded work and stays deterministic', async () => {
  const desc = buildScene(houseInput({ level: 'L0', walk: false, realistic: true }));
  const inp = aoVolumeInput(desc);
  const a = (await bakeAoVolume(inp))!;
  const b = (await bakeAoVolume(inp))!;
  expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  expect(a.plan.dims[0] * a.plan.dims[1] * a.plan.dims[2]).toBeLessThan(VOL_MAX_XZ * VOL_MAX_XZ * 64);
  console.log(`house L0: dims ${a.plan.dims.join('x')}, ${a.stats.rays} rays, ${a.stats.inside} inside, ${a.stats.ms} ms`);
});

test('grade: day and night per style, mixed by the night factor, a nudge only at mid grey', () => {
  expect(gradeFor('light', 0)).toEqual(GRADES.light.day);
  expect(gradeFor('light', 1)).toEqual(GRADES.light.night);
  expect(gradeFor('dark', 5)).toEqual(GRADES.dark.night);
  expect(gradeFor('dark', Number.NaN)).toEqual(GRADES.dark.day);
  const half = gradeFor('light', 0.5);
  expect(half.saturation).toBeCloseTo((GRADES.light.day.saturation + GRADES.light.night.saturation) / 2, 6);
  expect(applyGrade([0.5, 0.5, 0.5], IDENTITY_GRADE)).toEqual([0.5, 0.5, 0.5]);
  for (const style of ['light', 'dark'] as const) for (const night of [0, 1]) {
    const out = applyGrade([0.5, 0.5, 0.5], gradeFor(style, night));
    for (const c of out) expect(Math.abs(c - 0.5)).toBeLessThan(0.03);
  }
  // night: the shadows go cool (blue over red), the highlights warm (red over blue)
  const n = gradeFor('light', 1);
  const shadow = applyGrade([0.05, 0.05, 0.05], n);
  const high = applyGrade([0.85, 0.85, 0.85], n);
  expect(shadow[2]).toBeGreaterThan(shadow[0]);
  expect(high[0]).toBeGreaterThan(high[2]);
});

test('creaseNormals: a degenerate triangle gets a unit normal, never zero (a zero normal blanked the perspective view)', async () => {
  const { creaseNormals } = await import('../src/map/mesh-utils');
  // one real triangle and one with three points on a line
  const pos = [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 0, 0];
  const n = creaseNormals(pos, (35 * Math.PI) / 180);
  for (let v = 0; v < 6; v++) expect(Math.hypot(n[v * 3], n[v * 3 + 1], n[v * 3 + 2])).toBeCloseTo(1, 6);
  expect([...n.slice(9, 12)]).toEqual([0, 1, 0]);
});
