/**
 * PLAN3D-REALISM2-2433 (owner 2026-11-11): the floor finish of the realistic level - one installation dial (`floor_finish`,
 * api/plan-view.ts) choosing what the living floors of a home are made of: `wood` (the library's oak files), `marble`
 * (the default the owner asked for) or `ceramic` (large-format polished porcelain, the "luxury ceramic" option).
 *
 * Which floors it paints: a room floor whose material the document does not set (no own `floor_material_id` on the room or
 * its level) and whose tags match no special-floor rule of the resolver or only the residential (oak) one - the floors the
 * resolver otherwise leaves on the level's bare concrete or on the residential oak (scene-real-builder marks them
 * `finish: true`). Wet rooms, parking, gardens, offices and sports floors keep their resolved material (material-resolve
 * ROOM_FLOOR_RULES), and so does every floor the document sets itself.
 *
 * The marble and ceramic textures are generated here (no binary asset): one tileable colour map each, computed once per
 * session from a seeded periodic value noise - a pure function of the kind (deterministic, the same bytes every run) - and
 * uploaded as a single mip-mapped DataTexture (512 px each; PLAN3D-LEVEL3-2435: ceramic was 256 px of 0.6 m tiles). No
 * normal map, no extra pass: the floor stays one draw per level, the cost of a plain textured floor. The `procedural`
 * texture source (the geometric look) draws the finish as its plain tint, like every library material without its files.
 *
 * PLAN3D-R32-ANSWERS-2438 (owner round 32, Q-MAP-11 a): the default marble is a polished Calacatta - a bright white ground with
 * fewer, bolder grey-gold veins (was a grey Carrara) - and a fourth finish is added, `travertine`: warm beige honed stone in
 * 1.2 m tiles, the vein-cut layers running along each tile and the small open pores of the stone; it reflects little.
 */
import type { MaterialDef } from './material-resolve';

export type FloorFinish = 'wood' | 'marble' | 'ceramic' | 'travertine';
export const FLOOR_FINISHES: readonly FloorFinish[] = ['wood', 'marble', 'ceramic', 'travertine'];
/** The owner's answer (2026-11-11): marble or luxury ceramic; marble at install, the dial switches. */
export const DEFAULT_FLOOR_FINISH: FloorFinish = 'marble';

/** The render-time material ids of the two generated finishes (not library ids: never in a document, never resolved). */
export const FINISH_MARBLE = 'finish_marble';
export const FINISH_CERAMIC = 'finish_ceramic';
export const FINISH_TRAVERTINE = 'finish_travertine';

/** The material a finish floor draws in. */
export function finishMaterial(finish: FloorFinish | undefined): string {
  if (finish === 'wood') return 'oak';
  if (finish === 'ceramic') return FINISH_CERAMIC;
  if (finish === 'travertine') return FINISH_TRAVERTINE;
  return FINISH_MARBLE;
}
type Kind = 'marble' | 'ceramic' | 'travertine';
const kindOf = (id: string): Kind => (id === FINISH_CERAMIC ? 'ceramic' : id === FINISH_TRAVERTINE ? 'travertine' : 'marble');

/**
 * The two generated finishes as library-shaped entries (tint per style multiplies the generated map; tile_m is the span of
 * one texture repeat: marble 2 x 2 slabs of 1.2 m, ceramic 2 x 2 large-format tiles of 1.2 m - PLAN3D-LEVEL3-2435, was 0.6 m). Roughness: honed / satin rather than
 * mirror polish (the owner approved the less glossy floors of this branch; the style's floor sheen multiplies it).
 */
export const FINISH_DEFS: readonly MaterialDef[] = [
  { id: FINISH_MARBLE, group: 'floor', he: 'שיש קלקטה מלוטש', tile_m: 2.4, tint: { light: '#ffffff', dark: '#868b95' }, roughness: 0.32, metalness: 0, normal: 0, set: null, aliases: [] },
  { id: FINISH_CERAMIC, group: 'floor', he: 'קרמיקה יוקרתית', tile_m: 2.4, tint: { light: '#ffffff', dark: '#80848c' }, roughness: 0.4, metalness: 0, normal: 0, set: null, aliases: [] },
  { id: FINISH_TRAVERTINE, group: 'floor', he: 'טרוורטין', tile_m: 2.4, tint: { light: '#ffffff', dark: '#857f76' }, roughness: 0.55, metalness: 0, normal: 0, set: null, aliases: [] },
];
export const isFinishMaterial = (id: string): boolean => id === FINISH_MARBLE || id === FINISH_CERAMIC || id === FINISH_TRAVERTINE;

// ---------------------------------------------------------------- the generated maps

/** A 32-bit integer hash (deterministic, platform-independent). */
function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Periodic value noise in [0, 1): `period` lattice cells across the unit square, so the texture tiles without a seam. */
function vnoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (n: number) => ((n % period) + period) % period;
  const a = hash(w(x0), w(y0), seed);
  const b = hash(w(x0 + 1), w(y0), seed);
  const c = hash(w(x0), w(y0 + 1), seed);
  const d = hash(w(x0 + 1), w(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(u: number, v: number, base: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(u, v, base << o, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

const FIELD = 128;
/** A periodic scalar field on a FIELD x FIELD grid over the unit square. */
function field(fn: (u: number, v: number) => number): Float32Array {
  const f = new Float32Array(FIELD * FIELD);
  for (let y = 0; y < FIELD; y++) for (let x = 0; x < FIELD; x++) f[y * FIELD + x] = fn(x / FIELD, y / FIELD);
  return f;
}
/** The field at (u, v), bilinear, wrapping (the repeat stays seamless). */
function sample(f: Float32Array, u: number, v: number): number {
  const x = u * FIELD;
  const y = v * FIELD;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const xa = x0 % FIELD;
  const ya = y0 % FIELD;
  const xb = (x0 + 1) % FIELD;
  const yb = (y0 + 1) % FIELD;
  const a = f[ya * FIELD + xa];
  const b = f[ya * FIELD + xb];
  const c = f[yb * FIELD + xa];
  const d = f[yb * FIELD + xb];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Square RGBA8 pixels (sRGB) of a finish; `size` is a power of two (mip-mapped repeat); `joints` false leaves the slab /
 * tile joints out (the seam test). Pure and deterministic. */
export function finishPixels(id: string, size = 512, joints = true): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const kind = kindOf(id);
  const marble = kind === 'marble';
  // marble (PLAN3D-R32-ANSWERS-2438): a bright Calacatta ground, a whisper of clouding and bold warm grey-gold veins; ceramic: a warm
  // greige porcelain; travertine: a warm beige stone, its darker layers and its pores
  const ground = marble ? [246, 244, 239] : kind === 'travertine' ? [226, 210, 184] : [214, 207, 196];
  const shade = marble ? [228, 224, 216] : kind === 'travertine' ? [205, 186, 156] : [198, 191, 180];
  const vein = marble ? [118, 108, 94] : kind === 'travertine' ? [178, 156, 124] : [190, 182, 170];
  const grout = marble ? [214, 211, 205] : kind === 'travertine' ? [196, 182, 160] : [160, 154, 146];
  const travF = kind === 'travertine' ? field((u, v) => fbm(u, v, 3, 4, 131)) : null; // the layers' slow wander
  const half = size / 2;
  // the marble's low-frequency fields (clouding, the two vein warps) on a 128 x 128 periodic grid, sampled bilinearly: a
  // tenth of the noise work of a per-texel evaluation for fields that change over tens of texels
  const cloudF = marble ? field((u, v) => fbm(u, v, 4, 4, 11)) : null;
  const warp1F = marble ? field((u, v) => fbm(u, v, 3, 4, 29)) : null;
  const warp2F = marble ? field((u, v) => fbm(u, v, 5, 3, 47)) : null;
  const modF = marble ? field((u, v) => fbm(u, v, 2, 3, 61)) : null; // PLAN3D-LEVEL3-2435: where each vein family shows
  for (let py = 0; py < size; py++) {
    const v = py / size;
    for (let px = 0; px < size; px++) {
      // PLAN3D-LEVEL3-2435: the marble slabs are book-matched - the second slab of each row the mirror of the first (the
      // luxury lay of a real slab pair; continuous across the middle and across the repeat)
      const u = marble && px >= half ? (size - px) / size : px / size;
      let r: number;
      let g: number;
      let b: number;
      if (marble) {
        // PLAN3D-LEVEL3-2435: Carrara-like veining - a soft cloud, a main vein family whose strength comes and goes along the
        // slab (a sharp core in a soft feathered halo), a thinner cross family and a fine grain; the round-1 veins were one
        // even-width dark line everywhere and read as a map's contour lines at a close view
        const cloud = sample(cloudF!, u, v);
        const warp = sample(warp1F!, u, v);
        const presence = sample(modF!, u, v);
        const q1 = 1 - Math.abs(Math.sin(Math.PI * (2 * u + 1 * v + warp * 1.6)));
        const q2 = 1 - Math.abs(Math.sin(Math.PI * (1 * u - 3 * v + sample(warp2F!, u, v) * 2.2)));
        const q1s = q1 * q1;
        const q1_4 = q1s * q1s;
        const q1_16 = q1_4 * q1_4 * q1_4 * q1_4;
        const q2s = q2 * q2;
        const q2_8 = q2s * q2s * q2s * q2s;
        const q2_32 = q2_8 * q2_8 * q2_8 * q2_8;
        // Calacatta: the main veins bolder and fewer (a narrower presence window, a stronger core and a gold halo), the cross family faint
        const on1 = clamp01((presence - 0.42) * 3.6);
        const on2 = clamp01((0.5 - presence) * 2.4);
        const q1_32 = q1_16 * q1_16;
        const v1 = (q1_32 * 0.82 + q1_4 * q1s * 0.3) * on1;
        const v2 = (q2_32 * q2_8 * 0.22 + q2_8 * 0.05) * on2;
        const veinK = clamp01(v1 + v2);
        const cloudK = clamp01((cloud - 0.45) * 1.4) * 0.35;
        const grain = (vnoise(u, v, 96, 101) - 0.5) * 0.035;
        r = mix(mix(ground[0], shade[0], cloudK), vein[0], veinK) * (1 + grain);
        g = mix(mix(ground[1], shade[1], cloudK), vein[1], veinK) * (1 + grain);
        b = mix(mix(ground[2], shade[2], cloudK), vein[2], veinK) * (1 + grain);
      } else if (kind === 'travertine') {
        // 2 x 2 tiles; within a tile the vein-cut layers run along u, wandering slowly, each its own depth; a few small pores
        const tx = px < half ? 0 : 1;
        const ty = py < half ? 0 : 1;
        const tone = (hash(tx, ty, 9) - 0.5) * 0.06;
        const wander = sample(travF!, u, v);
        const band = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (v * 9 + wander * 1.4 + tx * 0.37));
        const fine = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (v * 31 + wander * 2.3));
        const layer = clamp01(Math.pow(band, 6) * 0.65 + Math.pow(fine, 10) * 0.3);
        const speck = (vnoise(u, v, 64, 141) - 0.5) * 0.1;
        const k = clamp01(0.62 + tone + speck - layer * 0.55);
        r = mix(shade[0], ground[0], k);
        g = mix(shade[1], ground[1], k);
        b = mix(shade[2], ground[2], k);
        const vk = layer * 0.35;
        r = mix(r, vein[0], vk);
        g = mix(g, vein[1], vk);
        b = mix(b, vein[2], vk);
        // the pores: rare dark pits, stretched along the layers
        const pore = hash(Math.floor(px / 3), Math.floor(py / 2), 151);
        if (pore > 0.985) {
          r *= 0.72;
          g *= 0.7;
          b *= 0.66;
        }
      } else {
        // 2 x 2 tiles, each its own slight tone (the batch shade of real porcelain), a fine low-contrast stone speckle
        const tx = px < half ? 0 : 1;
        const ty = py < half ? 0 : 1;
        const tone = (hash(tx, ty, 5) - 0.5) * 0.05;
        const speck = (fbm(u, v, 32, 2, 71) - 0.5) * 0.08 + (fbm(u, v, 6, 3, 83) - 0.5) * 0.1;
        const k = clamp01(0.5 + tone + speck);
        r = mix(shade[0], ground[0], k) + (k - 0.5) * 6;
        g = mix(shade[1], ground[1], k) + (k - 0.5) * 6;
        b = mix(shade[2], ground[2], k) + (k - 0.5) * 6;
      }
      // the joints on the tile / slab edges: marble 1 px (a tight slab joint), ceramic 1 px since PLAN3D-LEVEL3-2435 (512 px over 2.4 m: a rectified joint)
      const jw = 1;
      if (joints && (px % half < jw || py % half < jw)) {
        const j = marble ? 0.55 : 0.9;
        r = mix(r, grout[0], j);
        g = mix(g, grout[1], j);
        b = mix(b, grout[2], j);
      }
      const i = (py * size + px) * 4;
      out[i] = Math.round(clamp01(r / 255) * 255);
      out[i + 1] = Math.round(clamp01(g / 255) * 255);
      out[i + 2] = Math.round(clamp01(b / 255) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * PLAN3D-LEVEL3-2435: the surface of a finish - a packed map (R = ambient occlusion: 1, a little less in the joint; G = roughness)
 * and a tangent-space normal map (only the joints: a 1 px groove with a bevel either side, so the slab / tile edges catch the
 * light), both the colour map's size and repeat. Polished marble ~0.15 roughness (the veins a little duller), the porcelain
 * ~0.2, the joints matte (0.75-0.85); the style's floor sheen multiplies them as before. Pure and deterministic.
 */
export function finishSurfacePixels(id: string, size = 512): { rough: Uint8Array; normal: Uint8Array } {
  const kind = kindOf(id);
  const marble = kind === 'marble';
  const rough = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  const half = size / 2;
  const jw = 1;
  const colour = finishPixelsCached(id).data;
  // the joint's depth profile across the edge: groove, bevel, flat (texel distance from the slab / tile edge)
  const depth = (k: number): number => (k <= 0 ? 1 : k === 1 ? 0.45 : 0);
  // texels from the nearest joint: 0 inside the groove (texels 0 .. jw-1 of each half), 1 on the bevel either side
  const dist = (p: number): number => {
    const m = p % half;
    return Math.min(Math.max(m - jw + 1, 0), half - m);
  };
  const h = (px: number, py: number): number => Math.max(depth(dist(((px % size) + size) % size)), depth(dist(((py % size) + size) % size)));
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      const joint = px % half < jw || py % half < jw;
      // the slab body: duller where the colour map is darker (a vein, a cloud), a fine tone
      const lum = (colour[i] * 0.2126 + colour[i + 1] * 0.7152 + colour[i + 2] * 0.0722) / 255;
      // travertine (PLAN3D-R32-ANSWERS-2438) is honed: a satin 0.4-0.55, the pores and the darker layers duller
      const body = marble ? 0.12 + (0.95 - lum) * 0.35 : kind === 'travertine' ? 0.42 + (0.86 - lum) * 0.5 : 0.26 + (0.84 - lum) * 0.2;
      const r = joint ? (marble ? 0.75 : 0.85) : Math.min(kind === 'travertine' ? 0.7 : 0.45, Math.max(0.08, body));
      rough[i] = joint ? 205 : 255;
      rough[i + 1] = Math.round(r * 255);
      rough[i + 2] = 0;
      rough[i + 3] = 255;
      // the normal from the height's slope (the groove is a dent: height = -depth)
      const dx = (h(px + 1, py) - h(px - 1, py)) * 0.5;
      const dy = (h(px, py + 1) - h(px, py - 1)) * 0.5;
      const nx = dx * 0.9;
      const ny = -dy * 0.9;
      const inv = 1 / Math.hypot(nx, ny, 1);
      normal[i] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      normal[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      normal[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      normal[i + 3] = 255;
    }
  }
  return { rough, normal };
}

const surfaceCache = new Map<string, { rough: Uint8Array; normal: Uint8Array }>();
/** finishSurfacePixels, computed once per session per finish. */
export function finishSurfaceCached(id: string): { rough: Uint8Array; normal: Uint8Array; size: number } {
  let d = surfaceCache.get(id);
  if (!d) surfaceCache.set(id, (d = finishSurfacePixels(id)));
  return { ...d, size: Math.round(Math.sqrt(d.rough.length / 4)) };
}

const cache = new Map<string, Uint8Array>();
/** finishPixels, computed once per session per finish. */
export function finishPixelsCached(id: string): { data: Uint8Array; size: number } {
  let d = cache.get(id);
  if (!d) cache.set(id, (d = finishPixels(id)));
  return { data: d, size: Math.round(Math.sqrt(d.length / 4)) };
}
