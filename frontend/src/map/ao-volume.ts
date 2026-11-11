/**
 * PLAN3D-REALISM2-2433 S1: the baked ambient occlusion of the realistic level's static geometry, as a coarse 3D volume over
 * the shown levels. A pure CPU baker over the scene description - no three.js, no DOM - so node tests pin it, a worker runs
 * it (ao-volume.worker.ts) and the bytes are cached by a hash of the geometry (ao-cache.ts):
 *
 * - the occluders are the level's static boxes and cylinders (walls, lintels, sills, heads, objects, connectors - the floor
 *   lightmap's set without the door leaves, which move with their state: a door never changes the cache key); each level's
 *   floor is an infinite slab at its elevation (a ray down hits it), the level above never shades the one below (the views
 *   are cutaways under an open sky);
 * - one texel every `texel` metres (VOL_TEXEL_M, grown on a large venue so no side passes VOL_MAX_XZ); per texel centre
 *   VOL_SAMPLES cosine-weighted rays up (the floor lightmap's Hammersley set) and the same set mirrored down, each hit within
 *   VOL_REACH_M weighted by 1 - distance / reach:
 *   R = the up hemisphere's openness (what an up-facing surface - a floor, a table top - sees),
 *   G = the whole sphere's openness, the floor slab included (a wall's or a cabinet side's: darker toward the floor and in
 *   corners). A flat wall darkens its own G by the plane it stands on: `flatWallRef` is that value, the shader divides by it;
 * - a texel whose centre lies inside an occluder (the core of a wall, a cabinet) takes the mean of its open neighbours
 *   (two dilation passes), so the shading next to a wall face never reads the wall's inside.
 *
 * The run-time sampling (ao-shading.ts) offsets the fragment by VOL_BIAS_M along its normal and blends R and G by the
 * normal's up component. Deterministic: a fixed sample set, a fixed traversal order and the description's numbers only - the
 * same description and levels give the same bytes on every machine (unit-plan3d-ao-volume.spec.ts).
 */
import type { SceneDescription, ScenePart, Vec3 } from './scene-builder';
import { OccluderGrid, hemisphere, occluderOf, pointInOccluder, type Occluder } from './lightmap-bake';

export const AO_VOLUME_RECIPE = 'aovol-1';
export const VOL_SAMPLES = 24;
export const VOL_REACH_M = 1.1;
export const VOL_TEXEL_M = 0.2;
export const VOL_MAX_XZ = 128;
export const VOL_MAX_Y = 64;
/** How far the run time lifts a fragment off its surface before it samples (a little more than half a texel). */
export const VOL_BIAS_M = 0.12;
/** The margin around the occluders' footprint the volume covers. */
const MARGIN_M = 0.4;
/** The door leaves are not static: the floor lightmap's occluder kinds without `door`. */
const STATIC_KINDS = new Set<ScenePart['kind']>(['wall', 'lintel', 'sill', 'head', 'object', 'connector']);

export interface AoLevel {
  id: string;
  elevation_m: number;
  ceiling_height_m: number;
}
/** What the baker needs (and what the cache key hashes): the levels and their static occluder parts, in description order. */
export interface AoVolumeInput {
  levels: AoLevel[];
  parts: Pick<ScenePart, 'level_id' | 'kind' | 'shape' | 'position' | 'size' | 'rotation' | 'opacity'>[];
}
export interface AoVolumePlan {
  /** World position of texel (0, 0, 0)'s lower corner. */
  origin: Vec3;
  /** Texel edge in metres (x / z share it; y is VOL_TEXEL_M). */
  texel: [number, number];
  /** Texels along x, y, z. */
  dims: [number, number, number];
  /** The volume's world size (dims x texel). */
  size: Vec3;
}
export interface AoVolume {
  key: string;
  plan: AoVolumePlan;
  /** Two bytes per texel (R up openness, G sphere openness), x fastest, then y, then z: a three.js Data3DTexture (RG8). */
  data: Uint8Array;
  /** The flat-wall reference of G (0..1) the shader divides by. */
  wallRef: number;
  stats: { texels: number; inside: number; rays: number; ms: number };
}

const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;

/** The static occluder parts of the shown levels (the cache key's input). */
export function aoVolumeInput(desc: Pick<SceneDescription, 'levels' | 'parts'>): AoVolumeInput {
  const ids = new Set(desc.levels.map((l) => l.id));
  const parts = desc.parts
    .filter((p) => p.level_id !== null && ids.has(p.level_id) && STATIC_KINDS.has(p.kind) && occluderOf(p) !== null)
    .map((p) => ({ level_id: p.level_id, kind: p.kind, shape: p.shape, position: p.position, size: p.size, rotation: p.rotation, opacity: p.opacity }));
  const levels = desc.levels.map((l) => ({ id: l.id, elevation_m: l.elevation_m, ceiling_height_m: l.ceiling_height_m }));
  return { levels, parts };
}

/** FNV-1a (32 bit, two seeds) over the input's numbers and the recipe: the IndexedDB key of a bake. */
export function aoVolumeKey(inp: AoVolumeInput): string {
  const words: string[] = [AO_VOLUME_RECIPE, String(VOL_SAMPLES), String(VOL_REACH_M), String(VOL_TEXEL_M), String(VOL_MAX_XZ)];
  for (const l of inp.levels) words.push(`L${l.id}:${r4(l.elevation_m)}:${r4(l.ceiling_height_m)}`);
  for (const p of inp.parts) words.push(`${p.level_id}|${p.kind}|${p.shape}|${p.position.map(r4).join(',')}|${p.size.map(r4).join(',')}|${r4(p.rotation[1])}`);
  const s = words.join(';');
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193 + 2) >>> 0;
  }
  return `${AO_VOLUME_RECIPE}:${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}:${inp.parts.length}`;
}

/** The volume's grid over the occluders' footprint and the levels' heights; null without a level or an occluder. */
export function aoVolumePlan(inp: AoVolumeInput): AoVolumePlan | null {
  if (!inp.levels.length) return null;
  const occ = inp.parts.map((p) => occluderOf(p as ScenePart)).filter((o): o is Occluder => o !== null);
  if (!occ.length) return null;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const o of occ) {
    x0 = Math.min(x0, o.minX);
    x1 = Math.max(x1, o.maxX);
    z0 = Math.min(z0, o.minZ);
    z1 = Math.max(z1, o.maxZ);
  }
  x0 -= MARGIN_M;
  z0 -= MARGIN_M;
  x1 += MARGIN_M;
  z1 += MARGIN_M;
  const y0 = Math.min(...inp.levels.map((l) => l.elevation_m));
  const y1 = Math.max(...inp.levels.map((l) => l.elevation_m + l.ceiling_height_m));
  const t = Math.max(VOL_TEXEL_M, (x1 - x0) / VOL_MAX_XZ, (z1 - z0) / VOL_MAX_XZ);
  const ty = Math.max(VOL_TEXEL_M, (y1 - y0) / VOL_MAX_Y);
  const nx = Math.max(2, Math.ceil((x1 - x0) / t));
  const nz = Math.max(2, Math.ceil((z1 - z0) / t));
  const ny = Math.max(2, Math.ceil((y1 - y0) / ty));
  return { origin: [r4(x0), r4(y0), r4(z0)], texel: [r4(t), r4(ty)], dims: [nx, ny, nz], size: [r4(nx * t), r4(ny * ty), r4(nz * t)] };
}

/** G of a texel centre VOL_BIAS_M in front of an infinite wall, far above the floor: what a flat wall reads as "open". */
export function flatWallRef(dirs: Vec3[] = hemisphere(VOL_SAMPLES)): number {
  // the wall plane x = -VOL_BIAS_M, the point at the origin: a vertical plane meets an up ray and its mirrored down ray at
  // the same distance, so the sphere's mean is the up hemisphere's
  let sum = 0;
  for (const d of dirs) {
    if (d[0] >= 0) continue;
    const t = VOL_BIAS_M / -d[0];
    if (t < VOL_REACH_M) sum += 1 - t / VOL_REACH_M;
  }
  return 1 - sum / dirs.length;
}

export interface AoBakeOptions {
  /** Called after every z slice; resolve to continue (the main-thread fallback yields to the event loop here). */
  yieldSlice?: (slice: number, slices: number) => Promise<void> | void;
  now?: () => number;
}

/** Bake the volume (deterministic; null without a level or an occluder). */
export async function bakeAoVolume(inp: AoVolumeInput, opts: AoBakeOptions = {}): Promise<AoVolume | null> {
  const plan = aoVolumePlan(inp);
  if (!plan) return null;
  const now = opts.now ?? (() => Date.now());
  const t0 = now();
  const [nx, ny, nz] = plan.dims;
  const [t, ty] = plan.texel;
  const [ox, oy, oz] = plan.origin;
  const dirs = hemisphere(VOL_SAMPLES);
  const down: Vec3[] = dirs.map((d) => [d[0], -d[1], d[2]]);
  // one grid per level: a level's rays only meet its own occluders and its own floor
  const byLevel = inp.levels.map((l) => {
    const occ = inp.parts.filter((p) => p.level_id === l.id).map((p) => occluderOf(p as ScenePart)).filter((o): o is Occluder => o !== null);
    return { level: l, grid: new OccluderGrid(occ, ox, oz, ox + plan.size[0], oz + plan.size[2]) };
  });
  const levelOfY = (y: number) => {
    // the highest level whose floor is at or below y and whose ceiling is above it
    let best: (typeof byLevel)[number] | null = null;
    for (const b of byLevel) if (y >= b.level.elevation_m && y < b.level.elevation_m + b.level.ceiling_height_m + 1e-6 && (!best || b.level.elevation_m > best.level.elevation_m)) best = b;
    return best;
  };
  const total = nx * ny * nz;
  const R = new Float32Array(total).fill(1);
  const G = new Float32Array(total).fill(1);
  const inside = new Uint8Array(total);
  let insideCount = 0;
  let rays = 0;
  const p: Vec3 = [0, 0, 0];
  const n = dirs.length;
  for (let z = 0; z < nz; z++) {
    p[2] = oz + (z + 0.5) * t;
    for (let y = 0; y < ny; y++) {
      p[1] = oy + (y + 0.5) * ty;
      const lv = levelOfY(p[1]);
      if (!lv) continue;
      const elev = lv.level.elevation_m;
      for (let x = 0; x < nx; x++) {
        p[0] = ox + (x + 0.5) * t;
        const i = x + nx * (y + ny * z);
        if (lv.grid.contains(p)) {
          inside[i] = 1;
          insideCount++;
          continue;
        }
        let up = 0;
        let dn = 0;
        for (let k = 0; k < n; k++) {
          const hu = lv.grid.cast(p, dirs[k], VOL_REACH_M);
          if (hu < VOL_REACH_M) up += 1 - hu / VOL_REACH_M;
          const d = down[k];
          let hd = lv.grid.cast(p, d, VOL_REACH_M);
          const tf = (p[1] - elev) / -d[1];
          if (tf >= 0 && tf < hd) hd = tf;
          if (hd < VOL_REACH_M) dn += 1 - hd / VOL_REACH_M;
        }
        rays += 2 * n;
        R[i] = 1 - up / n;
        G[i] = 1 - (up + dn) / (2 * n);
      }
    }
    if (opts.yieldSlice) await opts.yieldSlice(z, nz);
  }
  dilate(R, G, inside, nx, ny, nz);
  const data = new Uint8Array(total * 2);
  for (let i = 0; i < total; i++) {
    data[2 * i] = Math.round(Math.min(1, Math.max(0, R[i])) * 255);
    data[2 * i + 1] = Math.round(Math.min(1, Math.max(0, G[i])) * 255);
  }
  return { key: aoVolumeKey(inp), plan, data, wallRef: Math.round(flatWallRef(dirs) * 1e4) / 1e4, stats: { texels: total, inside: insideCount, rays, ms: Math.round(now() - t0) } };
}

/** Two passes: every inside texel takes the mean of its open (or already filled) 6-neighbours; one left without any keeps 1. */
function dilate(R: Float32Array, G: Float32Array, inside: Uint8Array, nx: number, ny: number, nz: number): void {
  const at = (x: number, y: number, z: number): number => x + nx * (y + ny * z);
  for (let pass = 0; pass < 2; pass++) {
    const fill: [number, number, number][] = [];
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = at(x, y, z);
      if (!inside[i]) continue;
      let sr = 0, sg = 0, c = 0;
      const look = (xx: number, yy: number, zz: number) => {
        if (xx < 0 || yy < 0 || zz < 0 || xx >= nx || yy >= ny || zz >= nz) return;
        const j = at(xx, yy, zz);
        if (inside[j]) return;
        sr += R[j];
        sg += G[j];
        c++;
      };
      look(x - 1, y, z); look(x + 1, y, z); look(x, y, z - 1); look(x, y, z + 1); look(x, y - 1, z); look(x, y + 1, z);
      if (c) fill.push([i, sr / c, sg / c]);
    }
    for (const [i, r, g] of fill) {
      R[i] = r;
      G[i] = g;
      inside[i] = 0;
    }
  }
}

/** The texel value at a world point (nearest texel; tests and the harness). */
export function sampleVolume(v: AoVolume, x: number, y: number, z: number): { r: number; g: number } | null {
  const [nx, ny, nz] = v.plan.dims;
  const ix = Math.floor((x - v.plan.origin[0]) / v.plan.texel[0]);
  const iy = Math.floor((y - v.plan.origin[1]) / v.plan.texel[1]);
  const iz = Math.floor((z - v.plan.origin[2]) / v.plan.texel[0]);
  if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return null;
  const i = ix + nx * (iy + ny * iz);
  return { r: v.data[2 * i] / 255, g: v.data[2 * i + 1] / 255 };
}

export { pointInOccluder };
