import { test, expect } from '@playwright/test';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Vector3, type BufferAttribute, type InstancedMesh, type Object3D } from '../src/map/three-bundle';
import { buildScene } from '../src/map/scene-builder';
import { DEFAULT_REAL, INSTANCE_KEEP_TRIS, RealMaterials, applyBackdrop, buildExterior, buildReal, keepInstanced, paintSky, type RealModels } from '../src/map/scene-real';
import { lightRecipe } from '../src/map/sun';
import { houseInput } from './lookdev/house';

// PLAN3D-FURNMERGE-2434: the level-3 furniture merge (static object / family parts and kit tiles merged per level and
// material, picked by triangle range), and the studio backdrop over the realistic level's sky. Node only.

// the contact / disc / band textures paint on a canvas: in Node a canvas without a 2D context (the textures stay blank)
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };

type Built = ReturnType<typeof buildReal>;
const tris = (o: Object3D): number => {
  const m = o as Mesh;
  const n = (m.geometry.getAttribute('position') as BufferAttribute).count / 3;
  return (o as InstancedMesh).isInstancedMesh ? n * (o as InstancedMesh).count : n;
};
const meshes = (b: Built) => {
  const out: Mesh[] = [];
  b.root.traverse((o) => { if ((o as Mesh).isMesh) out.push(o as Mesh); });
  return out;
};
/** A stand-in kit: every file is one two-primitive box model (no fetch), the same template object per file. */
function fakeModels(): RealModels {
  const cache = new Map<string, unknown>();
  const box = (s: number) => {
    const g = new BufferGeometry();
    const p: number[] = [];
    // a closed unit cube scaled by s: 12 triangles
    const v = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const f = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [0, 4, 7], [0, 7, 3]];
    for (const t of f) for (const i of t) p.push(...v[i].map((x) => (x * s) / 2));
    g.setAttribute('position', new Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  };
  return {
    pending: 0,
    version: 1,
    template(file: string) {
      if (!cache.has(file)) cache.set(file, { model: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }, geos: [{ geometry: box(1), slot: 'wood' }, { geometry: box(0.5), slot: 'fabric' }] });
      return cache.get(file) as never;
    },
  } as unknown as RealModels;
}
function build(level: string | null, mergeFurniture: boolean, models = true): Built {
  const desc = buildScene(houseInput({ level, walk: false, realistic: true }));
  const mats = new RealMaterials('/', () => {});
  mats.setSource('procedural');
  const settings = { ...DEFAULT_REAL, textures: 'procedural' as const, furniture: models ? ('models' as const) : ('procedural' as const) };
  return buildReal({ desc, real: desc.real!, parts: desc.parts, settings, heavy: false, mats, models: fakeModels(), mergeFurniture });
}

test('the merge keeps every triangle and every pickable part, in far fewer meshes', () => {
  for (const level of ['L0', null]) {
    for (const models of [true, false]) {
      const off = build(level, false, models);
      const on = build(level, true, models);
      const mOff = meshes(off);
      const mOn = meshes(on);
      expect(on.stats.furnitureMerged).toBeGreaterThan(20);
      expect(off.stats.furnitureMerged).toBe(0);
      expect(mOn.length).toBeLessThan(mOff.length - 20);
      // nothing drawn twice, nothing lost: the same triangles in total
      expect(mOn.reduce((n, m) => n + tris(m), 0)).toBe(mOff.reduce((n, m) => n + tris(m), 0));
      // the same pickable parts (by id) in the lookup
      const ids = (b: Built) => [...new Set([...b.lookup.values()].flat().map((p) => `${p.id}|${p.userData.kind}|${p.userData.id}`))].sort();
      expect(ids(on)).toEqual(ids(off));
      // no instanced furniture group left below the keep rule; every merged mesh carries one range per part, ascending
      for (const m of mOn) {
        if ((m as unknown as InstancedMesh).isInstancedMesh && m.name.startsWith('inst|')) expect(keepInstanced((m as unknown as InstancedMesh).count, tris(m) / (m as unknown as InstancedMesh).count)).toBe(true);
        const r = m.userData.ranges as Uint32Array | undefined;
        if (!r) continue;
        expect(r.length).toBe(on.lookup.get(m)!.length);
        for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
      }
      // the merged kit tiles draw with vertex colours (the jitter), the rest without
      for (const m of mOn.filter((x) => x.name.startsWith('model-merged|'))) {
        expect((m.material as MeshStandardMaterial).vertexColors).toBe(true);
        expect(m.geometry.getAttribute('color')).toBeTruthy();
        expect(m.geometry.getAttribute('uv')).toBeFalsy(); // as the instanced kit: no UVs
      }
      if (models) expect(mOn.some((x) => x.name.startsWith('model-merged|'))).toBe(true);
    }
  }
  // deterministic: equal input, equal graph
  const a = meshes(build('L0', true)).map((m) => `${m.name}:${tris(m)}`);
  const b = meshes(build('L0', true)).map((m) => `${m.name}:${tris(m)}`);
  expect(b).toEqual(a);
});

test('a ray at a merged furniture part finds that part by its triangle range (the view pick rule)', () => {
  const on = build('L0', true);
  const off = build('L0', false);
  const rc = new Raycaster();
  const partAt = (b: Built, o: Vector3, d: Vector3) => {
    rc.set(o, d);
    const targets = [...b.lookup.keys()];
    for (const hit of rc.intersectObjects(targets, false)) {
      const parts = b.lookup.get(hit.object)!;
      const ranges = hit.object.userData.ranges as Uint32Array | undefined;
      let index = hit.instanceId ?? 0;
      if (ranges && hit.instanceId === undefined && hit.faceIndex != null) {
        let lo = 0;
        let hi = ranges.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (ranges[mid] <= hit.faceIndex) lo = mid;
          else hi = mid - 1;
        }
        index = lo;
      }
      return parts[index];
    }
    return null;
  };
  // straight down onto every instanced object of the unmerged graph: the merged graph answers the same part
  let checked = 0;
  for (const [o, parts] of off.lookup) {
    const im = o as InstancedMesh;
    if (!im.isInstancedMesh) continue;
    for (let i = 0; i < Math.min(im.count, 3); i++) {
      const e = im.instanceMatrix.array;
      const at = new Vector3(e[i * 16 + 12], e[i * 16 + 13], e[i * 16 + 14]);
      const down = new Vector3(0, -1, 0);
      const from = at.clone().add(new Vector3(0, 0.6, 0));
      const want = partAt(off, from, down);
      if (!want || want.id !== parts[i].id) continue; // something above it (a lamp, a shelf): not this probe
      expect(partAt(on, from, down)?.id).toBe(want.id);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(10);
});

test('the keep-instanced rule: only a repeated group heavier than the cap merged', () => {
  expect(keepInstanced(1, 1e6)).toBe(false);
  expect(keepInstanced(2, INSTANCE_KEEP_TRIS / 2)).toBe(false);
  expect(keepInstanced(2, INSTANCE_KEEP_TRIS / 2 + 1)).toBe(true);
  expect(keepInstanced(40, 1000)).toBe(true);
  expect(keepInstanced(12, 1500)).toBe(false);
});

test('the studio backdrop covers the realistic sky: a dark lit plinth by day, the walk dome dark, the environment dome untouched', () => {
  const ext = buildExterior({ x0: 0, x1: 12, y0: 0, z0: 0, z1: 10 }, 'light', true);
  const day = lightRecipe(55);
  paintSky(ext, day, [0.3, 0.8, 0.2], 'light');
  const iblBefore = Float32Array.from((ext.iblDome!.geometry.getAttribute('color') as BufferAttribute).array as Float32Array);
  const lum = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const disc = ext.disc.material as MeshStandardMaterial;
  // the sky backdrop: the walk's dome is the sun's sky (a copy of the environment's), the disc unlit-free
  applyBackdrop(ext, 'sky', true, day, 'light');
  expect(Array.from((ext.dome.geometry.getAttribute('color') as BufferAttribute).array as Float32Array)).toEqual(Array.from(iblBefore));
  expect(lum(disc.emissive)).toBe(0);
  expect(ext.band.visible).toBe(true);
  // the studio: the lit disc glows in the dark studio colour with almost no albedo (the sun cannot turn it grey)
  applyBackdrop(ext, 'studio', false, day, 'light');
  expect(lum(disc.color)).toBeLessThan(0.002);
  expect(lum(disc.emissive)).toBeGreaterThan(0);
  expect(lum(disc.emissive)).toBeLessThan(0.02);
  expect(ext.band.visible).toBe(false);
  expect(ext.disc.scale.x).toBeLessThan(1);
  // ... and the walk under it sees a dark sky; the environment's dome keeps the sun's (the lighting does not change)
  applyBackdrop(ext, 'studio', true, day, 'light');
  const col = ext.dome.geometry.getAttribute('color') as BufferAttribute;
  let maxSky = 0;
  let maxIbl = 0;
  for (let i = 0; i < col.count; i++) {
    maxSky = Math.max(maxSky, 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i));
    maxIbl = Math.max(maxIbl, 0.2126 * iblBefore[i * 3] + 0.7152 * iblBefore[i * 3 + 1] + 0.0722 * iblBefore[i * 3 + 2]);
  }
  expect(maxSky).toBeLessThan(0.1);
  expect(maxIbl).toBeGreaterThan(0.3);
  expect(Array.from((ext.iblDome!.geometry.getAttribute('color') as BufferAttribute).array as Float32Array)).toEqual(Array.from(iblBefore));
  expect(ext.band.visible).toBe(false);
  expect(ext.disc.scale.x).toBe(1);
  // back to the sky: the walk dome takes the sun's colours again, the disc loses its glow
  applyBackdrop(ext, 'sky', true, day, 'light');
  expect(Array.from(col.array as Float32Array)).toEqual(Array.from(iblBefore));
  expect(lum(disc.emissive)).toBe(0);
  // the unlit disc of the lite rung (no emissive): the studio colour as before
  const lite = buildExterior({ x0: 0, x1: 12, y0: 0, z0: 0, z1: 10 }, 'light', false);
  applyBackdrop(lite, 'studio', false, day, 'light');
  expect(lum((lite.disc.material as MeshBasicMaterial).color)).toBeLessThan(0.01);
});
