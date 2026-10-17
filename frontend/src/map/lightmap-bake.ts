/**
 * The floor lightmap of a level (CR-029 S3, the second tier after the stills; docs/changes/CR-029-ST7-S3-NOTES.md section 6).
 * A pure CPU raster baker over the scene description - no three.js, no path-tracer package (CR-029 3.1: the chunk cap) - so
 * node tests pin it and any browser can run it without WebGL:
 *
 * - the receiver is the level's floor plane over levelExtent, one texel per `texel_m` (the atlas side is the next power of two,
 *   64..MAX_SIDE; the texel grows on a large venue so the side stays within MAX_SIDE);
 * - R = ambient occlusion: SAMPLES cosine-weighted hemisphere rays (a fixed Hammersley set) against the level's boxes and
 *   cylinders (walls, lintels, sills, heads, doors, objects; glass and state parts never occlude), each hit weighted by
 *   1 - distance / AO_REACH_M;
 * - G = lamp light: every lamp of the all-on description (its glow light, else an `obj-light` object), inverse-square with the
 *   floor's cosine, visibility-tested by one ray, scaled by LAMP_EXPOSURE and clamped - the "lit" layer the run time blends
 *   per room by that room's lit state (roomBlendWeights);
 * - B = 0, A = 255.
 *
 * Determinism: fixed sample set, fixed traversal order, the description's numbers only - the same description and level give
 * the same bytes (unit-lightmap-bake.spec.ts). Applying it in SceneView level 3 is the S1 / S2 owner's: `LightmapSet` is the
 * interface (the floor material's aoMap / lightMap with UVs from `lightmapUv`).
 */
import type { SceneDescription, ScenePart, Vec3 } from './scene-builder';
import { levelExtent } from './scene-frame';

/** lightmap-2 (STILLCAM): baked from still-bake.bakeSceneInput (no camera-bound body shades it); the backend withholds a
 * lightmap-1 from a reader whose camera scope hides a camera a body of the floor is bound to. */
export const LIGHTMAP_RECIPE = 'lightmap-2';
export const SAMPLES = 64;
export const AO_REACH_M = 2.5;
export const DEFAULT_TEXEL_M = 0.1;
export const MAX_SIDE = 512;
export const MIN_SIDE = 64;
export const LAMP_EXPOSURE = 1.6;
export const LAMP_REACH_M = 12;
/** A part thinner than this does not occlude (state plates, floor tints). */
const MIN_OCCLUDER_M = 0.04;
const OCCLUDER_KINDS = new Set<ScenePart['kind']>(['wall', 'lintel', 'sill', 'head', 'door', 'object', 'connector']);
const CELL_M = 1;

export interface LightmapSurface {
  kind: 'floor';
  level_id: string;
  /** [u0, v0, u1, v1] of the atlas the surface covers. */
  uv: [number, number, number, number];
  /** [x0, z0, x1, z1] in metres: the world rectangle mapped onto `uv` (u along x, v along z). */
  world: [number, number, number, number];
  /** The floor height the surface lies at. */
  y: number;
}
export interface LightmapMeta {
  version: 1;
  surfaces: LightmapSurface[];
  channels: { ao: 'r'; lamps: 'g' };
  samples: number;
  texel_m: number;
}
export interface LightmapResult {
  width: number;
  height: number;
  /** RGBA, row 0 = the plan's top (z0), like an image. */
  rgba: Uint8ClampedArray;
  meta: LightmapMeta;
}
/** What the level-3 view receives (the bundle's lightmap entry, the file decoded by the browser). */
export interface LightmapSet {
  url: string;
  width: number;
  height: number;
  meta: LightmapMeta;
  recipe: string;
}

interface Occluder {
  c: Vec3;
  half: Vec3;
  cos: number;
  sin: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const rad = (d: number): number => (d * Math.PI) / 180;

/** The Hammersley point set on the cosine-weighted hemisphere (y up): the same SAMPLES directions on every run. */
export function hemisphere(n: number = SAMPLES): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    let bits = i;
    bits = ((bits << 16) | (bits >>> 16)) >>> 0;
    bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
    bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
    bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
    bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
    const u = (i + 0.5) / n;
    const v = bits / 4294967296;
    const r = Math.sqrt(u);
    const phi = 2 * Math.PI * v;
    out.push([r * Math.cos(phi), Math.sqrt(Math.max(0, 1 - u)), r * Math.sin(phi)]);
  }
  return out;
}

function occluderOf(p: ScenePart): Occluder | null {
  if (!OCCLUDER_KINDS.has(p.kind)) return null;
  if (p.shape !== 'box' && p.shape !== 'cylinder') return null;
  if (p.opacity < 0.5) return null;
  const [w, h, d] = p.size;
  if (h < MIN_OCCLUDER_M || w < MIN_OCCLUDER_M || d < MIN_OCCLUDER_M) return null;
  const yaw = p.shape === 'box' ? rad(p.rotation[1]) : 0;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const ex = Math.abs((w / 2) * cos) + Math.abs((d / 2) * sin);
  const ez = Math.abs((w / 2) * sin) + Math.abs((d / 2) * cos);
  return { c: p.position, half: [w / 2, h / 2, d / 2], cos, sin, minX: p.position[0] - ex, maxX: p.position[0] + ex, minZ: p.position[2] - ez, maxZ: p.position[2] + ez };
}

/** The distance along a ray (origin o, unit direction d) to an oriented box (yaw only), or Infinity. */
export function rayBox(o: Vec3, d: Vec3, b: Occluder): number {
  // into the box frame: undo the yaw (three.js Y rotation: x' = x cos + z sin, z' = -x sin + z cos)
  const rx = o[0] - b.c[0];
  const ry = o[1] - b.c[1];
  const rz = o[2] - b.c[2];
  const lo: Vec3 = [rx * b.cos - rz * b.sin, ry, rx * b.sin + rz * b.cos];
  const ld: Vec3 = [d[0] * b.cos - d[2] * b.sin, d[1], d[0] * b.sin + d[2] * b.cos];
  let t0 = -Infinity;
  let t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(ld[a]) < 1e-12) {
      if (lo[a] < -b.half[a] || lo[a] > b.half[a]) return Infinity;
      continue;
    }
    let ta = (-b.half[a] - lo[a]) / ld[a];
    let tb = (b.half[a] - lo[a]) / ld[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return Infinity;
  }
  if (t1 < 1e-4) return Infinity;
  return t0 > 1e-4 ? t0 : 1e-4; // a start inside the box counts as an immediate hit
}

/** A uniform grid of the occluders' footprints (CELL_M cells) for the rays. */
class Grid {
  readonly cells = new Map<number, number[]>();
  readonly x0: number;
  readonly z0: number;
  readonly nx: number;
  readonly nz: number;
  private stamp: Uint32Array;
  private tick = 0;
  constructor(readonly occ: Occluder[], x0: number, z0: number, x1: number, z1: number) {
    this.x0 = x0 - CELL_M;
    this.z0 = z0 - CELL_M;
    this.nx = Math.max(1, Math.ceil((x1 - x0) / CELL_M) + 2);
    this.nz = Math.max(1, Math.ceil((z1 - z0) / CELL_M) + 2);
    this.stamp = new Uint32Array(occ.length);
    occ.forEach((o, i) => {
      const ix0 = this.cx(o.minX);
      const ix1 = this.cx(o.maxX);
      const iz0 = this.cz(o.minZ);
      const iz1 = this.cz(o.maxZ);
      for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
        const k = iz * this.nx + ix;
        const list = this.cells.get(k);
        if (list) list.push(i);
        else this.cells.set(k, [i]);
      }
    });
  }
  private cx(x: number): number {
    return Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.x0) / CELL_M)));
  }
  private cz(z: number): number {
    return Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.z0) / CELL_M)));
  }
  /** The nearest hit within `reach` (a 2D DDA over the cells the ray's footprint crosses), or Infinity. */
  cast(o: Vec3, d: Vec3, reach: number): number {
    this.tick = (this.tick + 1) >>> 0 || 1;
    const tick = this.tick;
    let ix = this.cx(o[0]);
    let iz = this.cz(o[2]);
    const stepX = d[0] > 0 ? 1 : -1;
    const stepZ = d[2] > 0 ? 1 : -1;
    const inv = (v: number): number => (Math.abs(v) < 1e-12 ? Infinity : 1 / Math.abs(v));
    const dX = inv(d[0]) * CELL_M;
    const dZ = inv(d[2]) * CELL_M;
    const fx = (o[0] - this.x0) / CELL_M - ix;
    const fz = (o[2] - this.z0) / CELL_M - iz;
    let tX = Math.abs(d[0]) < 1e-12 ? Infinity : (d[0] > 0 ? 1 - fx : fx) * dX;
    let tZ = Math.abs(d[2]) < 1e-12 ? Infinity : (d[2] > 0 ? 1 - fz : fz) * dZ;
    let best = Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 4096; guard++) {
      const list = this.cells.get(iz * this.nx + ix);
      if (list) {
        for (const i of list) {
          if (this.stamp[i] === tick) continue;
          this.stamp[i] = tick;
          const t = rayBox(o, d, this.occ[i]);
          if (t < best) best = t;
        }
      }
      if (best <= tCell || tCell > reach) break;
      if (tX < tZ) {
        tCell = tX;
        tX += dX;
        ix += stepX;
      } else {
        tCell = tZ;
        tZ += dZ;
        iz += stepZ;
      }
      if (ix < 0 || iz < 0 || ix >= this.nx || iz >= this.nz) break;
    }
    return best <= reach ? best : Infinity;
  }
}

/** Lamp positions of a level: the glow lights of the all-on description, else the bodies of `obj-light` objects. */
export function lampsOf(desc: SceneDescription, levelId: string): Vec3[] {
  const glows = desc.parts.filter((p) => p.level_id === levelId && p.kind === 'glow' && p.shape === 'light').map((p) => p.position);
  if (glows.length) return glows;
  return desc.parts.filter((p) => p.level_id === levelId && p.kind === 'object' && p.color === 'obj-light').map((p) => [p.position[0], p.position[1] + p.size[1] / 2, p.position[2]] as Vec3);
}

export function pow2(n: number): number {
  let s = MIN_SIDE;
  while (s < n && s < 2048) s *= 2;
  return s;
}

export interface BakeOptions {
  samples?: number;
  texel_m?: number;
  maxSide?: number;
  /** Called between rows; resolve to continue (a browser yields to the event loop here). */
  yieldRow?: (row: number, rows: number) => Promise<void> | void;
  /** Stop early (the editor left the page): the bake throws BAKE_CANCELLED. */
  cancelled?: () => boolean;
}
export const BAKE_CANCELLED = 'lightmap bake cancelled';

/** The plan of a level's lightmap: the texel, the grid size and the atlas size (no rays yet). */
export function lightmapPlan(desc: SceneDescription, levelId: string, opts: Pick<BakeOptions, 'texel_m' | 'maxSide'> = {}) {
  const e = levelExtent(desc, levelId);
  const W = Math.max(0.5, e.x1 - e.x0);
  const D = Math.max(0.5, e.z1 - e.z0);
  const maxSide = Math.min(2048, Math.max(MIN_SIDE, opts.maxSide ?? MAX_SIDE));
  const texel = Math.max(opts.texel_m ?? DEFAULT_TEXEL_M, W / maxSide, D / maxSide);
  const cols = Math.max(1, Math.min(maxSide, Math.ceil(W / texel)));
  const rows = Math.max(1, Math.min(maxSide, Math.ceil(D / texel)));
  return { extent: e, texel, cols, rows, width: pow2(cols), height: pow2(rows) };
}

/** Bake one level. `desc` is the all-on synthetic description of the floor (still-bake.stillDescription is not needed: every
 * part of the level is read; lamps come from its glows). */
export async function bakeLightmap(desc: SceneDescription, levelId: string, opts: BakeOptions = {}): Promise<LightmapResult> {
  const samples = Math.max(8, Math.min(256, Math.round(opts.samples ?? SAMPLES)));
  const plan = lightmapPlan(desc, levelId, opts);
  const { extent: e, texel, cols, rows, width, height } = plan;
  const lv = desc.levels.find((l) => l.id === levelId);
  const y = (lv?.elevation_m ?? e.y0) + 0.02;
  const occ = desc.parts.filter((p) => p.level_id === levelId).map(occluderOf).filter((o): o is Occluder => !!o);
  const grid = new Grid(occ, e.x0, e.z0, e.x1, e.z1);
  const dirs = hemisphere(samples);
  const lamps = lampsOf(desc, levelId);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) rgba[i * 4 + 3] = 255;
  for (let r = 0; r < rows; r++) {
    if (opts.cancelled?.()) throw new Error(BAKE_CANCELLED);
    const z = e.z0 + (r + 0.5) * texel;
    for (let c = 0; c < cols; c++) {
      const x = e.x0 + (c + 0.5) * texel;
      const o: Vec3 = [x, y, z];
      let occluded = 0;
      for (const d of dirs) {
        const t = grid.cast(o, d, AO_REACH_M);
        if (t !== Infinity) occluded += 1 - t / AO_REACH_M;
      }
      const ao = 1 - occluded / dirs.length;
      let lit = 0;
      for (const L of lamps) {
        const v: Vec3 = [L[0] - x, L[1] - y, L[2] - z];
        const dist = Math.hypot(v[0], v[1], v[2]);
        if (dist < 1e-3 || dist > LAMP_REACH_M || v[1] <= 0) continue;
        const dir: Vec3 = [v[0] / dist, v[1] / dist, v[2] / dist];
        const t = grid.cast(o, dir, dist - 0.05);
        if (t !== Infinity) continue;
        lit += (dir[1] / (dist * dist)) * LAMP_EXPOSURE;
      }
      const k = (r * width + c) * 4;
      rgba[k] = Math.round(Math.max(0, Math.min(1, ao)) * 255);
      rgba[k + 1] = Math.round(Math.max(0, Math.min(1, lit)) * 255);
    }
    if (opts.yieldRow) await opts.yieldRow(r, rows);
  }
  const meta: LightmapMeta = {
    version: 1,
    surfaces: [{ kind: 'floor', level_id: levelId, uv: [0, 0, r6(cols / width), r6(rows / height)], world: [r6(e.x0), r6(e.z0), r6(e.x0 + cols * texel), r6(e.z0 + rows * texel)], y: r6(y - 0.02) }],
    channels: { ao: 'r', lamps: 'g' },
    samples,
    texel_m: r6(texel),
  };
  return { width, height, rgba, meta };
}

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** The atlas UV of a floor point of a surface (u along x, v along z, v = 0 at the plan's top row), or null outside it. */
export function lightmapUv(s: LightmapSurface, x: number, z: number): [number, number] | null {
  const [x0, z0, x1, z1] = s.world;
  if (x < x0 || x > x1 || z < z0 || z > z1) return null;
  const fu = (x - x0) / (x1 - x0);
  const fv = (z - z0) / (z1 - z0);
  return [s.uv[0] + fu * (s.uv[2] - s.uv[0]), s.uv[1] + fv * (s.uv[3] - s.uv[1])];
}

/** The lamp channel's weight per room at run time: 1 for a lit room, 0 otherwise; a stale or unknown state never lights
 * (the state layer's rule - only `lit === true` counts). */
export function roomBlendWeights(rooms: Record<string, { lit: boolean | null | undefined }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.keys(rooms).sort()) out[id] = rooms[id].lit === true ? 1 : 0;
  return out;
}

/** Which room (by id) a floor point lies in (even-odd rule over the rooms' outlines in metres); null outside every room. */
export function roomAt(rooms: { id: string; polygon: [number, number][] }[], x: number, z: number): string | null {
  for (const r of rooms) {
    let inside = false;
    const p = r.polygon;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > z) !== (p[j][1] > z) && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
    }
    if (inside) return r.id;
  }
  return null;
}

/** The rooms of a level from a description (the `room:<id>` prisms, outlines in metres). */
export function roomsOf(desc: SceneDescription, levelId: string): { id: string; polygon: [number, number][] }[] {
  return desc.parts
    .filter((p) => p.kind === 'room' && p.level_id === levelId && p.id.startsWith('room:') && !p.id.includes('#') && p.polygon?.length)
    .map((p) => ({ id: p.id.slice(5), polygon: p.polygon!.map(([x, z]) => [x + p.position[0], z + p.position[2]] as [number, number]) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
