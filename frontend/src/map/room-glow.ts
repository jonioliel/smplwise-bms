/**
 * PLAN3D-REALISM-2432: the room glow of the realistic level - the plan, pure (no three, no DOM).
 *
 * Level 2 paints a lit room with a saturated plate and an occupied room with a blue plate and an edge ring. Level 3 drops
 * those plates (R3 G2: they hid the floor material) and, until now, showed a lit room only through the eight pool lights
 * nearest the camera - a lit room farther away read as dark, and the thinned blue ring read as a hard neon line. This
 * module turns the same state parts (`room:<zone>#lit`, `#presence`, `#presence-ring`, scene-builder roomState) into the
 * plan of a soft, cheap light layer that the realistic level draws on every rung (room-glow-mesh.ts):
 *
 * - lit: warm light pools on the floor (one per lamp of the room that is on, plus a broad fill) and a warm wash up the
 *   room's walls whose strength follows the distance to the nearest pool - the "lights on" look of an architectural
 *   cutaway render, with no extra light, shader or shadow pass;
 * - presence: a cool inner-edge glow on the floor, a faint fill and a low wash on the walls, weighted by the presence fade.
 *
 * Deterministic: the same parts, levels and lamps give the same plan in the same order (zones sorted by id).
 */
import type { ScenePart } from './scene-builder';

export const PRESENCE_RING_BASE = 0.75; // scene-builder PRESENCE_RING_OPACITY
export const PRESENCE_PLATE_BASE = 0.36; // scene-builder PRESENCE_TINT_OPACITY
/** The wall wash and the floor layers stand this far inside the room outline (the outline runs on the wall centre line:
 * an exterior wall is 0.25 m, so half of it plus a margin keeps the wash in front of the inner face). */
export const GLOW_INSET_M = 0.14;
/** The presence edge band on the floor. */
export const PRESENCE_BAND_M = 0.55;
const WASH_MAX_M = 1.5;
const LAMP_RADIUS: Record<string, number> = { floor: 1.5, wall: 1.3, pendant: 1.7 };

export interface GlowLamp {
  id: string;
  level_id: string;
  position: [number, number, number];
  kind: string;
  color_k: number;
  lumens: number;
  on: boolean;
}
export interface GlowLevel {
  id: string;
  elevation_m: number;
  ceiling_height_m?: number;
}
export interface GlowPool {
  x: number;
  z: number;
  /** Radius of the pool (m): the gradient reaches 0 here. */
  r: number;
  /** Relative strength 0..1.4. */
  w: number;
}
export interface GlowRoom {
  zone: string;
  level_id: string;
  /** The floor's height (the level's elevation). */
  y: number;
  /** The room outline inset by GLOW_INSET_M (counter-clockwise seen from above). */
  polygon: [number, number][];
  /** The inner outline of the presence band ([] where the room is too narrow for it). */
  band: [number, number][];
  pools: GlowPool[];
  /** The colour temperature of the light (the mean of the lit lamps, 2900 K without one). */
  color_k: number;
  /** Height of the wall wash (m). */
  wash: number;
  /** 1 while lit, 0 otherwise. */
  lit: number;
  /** The presence weight 0..1 (the fade). */
  presence: number;
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function signedArea(p: readonly [number, number][]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) a += p[i][0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * p[i][1];
  return a / 2;
}

/** The polygon moved inward by `d` along the miter of every corner (capped at 2.5 d on sharp corners), returned
 * counter-clockwise in (x, z) (positive signed area); [] when the inset folds (an edge reversed, the area gone or more
 * than lost) - a corridor narrower than 2 d. */
export function insetPolygon(poly: readonly [number, number][], d: number): [number, number][] {
  const src = poly.length > 2 && poly[0][0] === poly[poly.length - 1][0] && poly[0][1] === poly[poly.length - 1][1] ? poly.slice(0, -1) : poly.slice();
  const n = src.length;
  if (n < 3) return [];
  const a0 = signedArea(src);
  if (Math.abs(a0) < 1e-6) return [];
  const p = a0 > 0 ? src : [...src].reverse();
  if (!(d > 0)) return p.map(([x, z]) => [r4(x), r4(z)]);
  // counter-clockwise (positive area in this formula): the inward normal of an edge a->b is (-dz, dx)
  const inward = (a: [number, number], b: [number, number]): [number, number] => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  };
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const n1 = inward(p[(i + n - 1) % n], p[i]);
    const n2 = inward(p[i], p[(i + 1) % n]);
    const dot = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    const k = dot > 1e-6 ? Math.min(d / dot, 2.5 * d) : 2.5 * d;
    out.push([r4(p[i][0] + (n1[0] + n2[0]) * k), r4(p[i][1] + (n1[1] + n2[1]) * k)]);
  }
  const a1 = signedArea(out);
  if (!(a1 > 0) || a1 > a0 * Math.sign(a0)) return [];
  for (let i = 0; i < n; i++) {
    const e0 = [p[(i + 1) % n][0] - p[i][0], p[(i + 1) % n][1] - p[i][1]];
    const e1 = [out[(i + 1) % n][0] - out[i][0], out[(i + 1) % n][1] - out[i][1]];
    if (e0[0] * e1[0] + e0[1] * e1[1] <= 0 && Math.hypot(e0[0], e0[1]) > 2 * d) return [];
  }
  return out;
}

/** Even-odd point in polygon. */
export function inside(x: number, z: number, poly: readonly [number, number][]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi || 1e-12) + xi) c = !c;
  }
  return c;
}

/** The area-weighted centroid (the vertex mean for a degenerate ring). */
export function centroidOf(poly: readonly [number, number][]): [number, number] {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    const c = x0 * z1 - x1 * z0;
    a += c;
    cx += (x0 + x1) * c;
    cz += (z0 + z1) * c;
  }
  if (Math.abs(a) < 1e-9) return [poly.reduce((s, q) => s + q[0], 0) / Math.max(1, poly.length), poly.reduce((s, q) => s + q[1], 0) / Math.max(1, poly.length)];
  return [cx / (3 * a), cz / (3 * a)];
}

/** The pools of a lit room: one per lamp that is on inside it (kind radius, lumens weight), plus the broad fill. */
export function poolsFor(poly: readonly [number, number][], lamps: readonly GlowLamp[]): GlowPool[] {
  const xs = poly.map((q) => q[0]);
  const zs = poly.map((q) => q[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const area = Math.abs(signedArea(poly));
  const [cx, cz] = centroidOf(poly);
  const own = lamps.filter((l) => l.on && inside(l.position[0], l.position[2], poly)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const out: GlowPool[] = [{ x: r4(cx), z: r4(cz), r: r4(Math.max(1.6, span * 0.78)), w: own.length ? 0.45 : 0.9 }];
  const ceilingR = Math.min(3.2, Math.max(1.4, Math.sqrt(area) * 0.6));
  for (const l of own.slice(0, 6)) out.push({ x: r4(l.position[0]), z: r4(l.position[2]), r: r4(LAMP_RADIUS[l.kind] ?? ceilingR), w: r4(Math.min(1.4, Math.max(0.6, Math.sqrt(l.lumens / 1000)))) });
  return out;
}

/** The strength of the light at (x, z) from the pools: the strongest pool's gaussian falloff, 0..1.4. */
export function poolStrength(x: number, z: number, pools: readonly GlowPool[]): number {
  let s = 0;
  for (const p of pools) {
    const d = Math.hypot(x - p.x, z - p.z) / p.r;
    s = Math.max(s, p.w * Math.exp(-2.2 * d * d));
  }
  return s;
}

/** The glow plan of a description's state parts (module note). */
export function planGlow(parts: readonly ScenePart[], levels: readonly GlowLevel[], lamps: readonly GlowLamp[]): GlowRoom[] {
  const byZone = new Map<string, { lit: boolean; presence: number; polygon: [number, number][] | null; level: string }>();
  for (const p of parts) {
    if (p.kind !== 'tint' || !p.id.startsWith('room:')) continue;
    const hash = p.id.lastIndexOf('#');
    if (hash < 0) continue;
    const zone = p.userData?.id ?? p.id.slice(5, hash);
    const tag = p.id.slice(hash + 1);
    if (tag !== 'lit' && tag !== 'presence' && tag !== 'presence-ring') continue;
    const e = byZone.get(zone) ?? { lit: false, presence: 0, polygon: null, level: p.level_id ?? '' };
    if (tag === 'lit') {
      e.lit = true;
      e.polygon = p.polygon ?? e.polygon;
    } else if (tag === 'presence') {
      e.presence = Math.max(e.presence, p.opacity / PRESENCE_PLATE_BASE);
      e.polygon ??= p.polygon ?? null;
    } else e.presence = Math.max(e.presence, p.opacity / PRESENCE_RING_BASE);
    byZone.set(zone, e);
  }
  const lv = new Map(levels.map((l) => [l.id, l]));
  const out: GlowRoom[] = [];
  for (const [zone, e] of [...byZone].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (!e.polygon || e.polygon.length < 3) continue;
    const polygon = insetPolygon(e.polygon, GLOW_INSET_M);
    if (!polygon.length) continue;
    const level = lv.get(e.level);
    const roomLamps = lamps.filter((l) => l.level_id === e.level);
    const lit = roomLamps.filter((l) => l.on && inside(l.position[0], l.position[2], polygon));
    const ceiling = level?.ceiling_height_m ?? 2.8;
    out.push({
      zone, level_id: e.level, y: level?.elevation_m ?? 0, polygon, band: insetPolygon(polygon, PRESENCE_BAND_M),
      pools: poolsFor(polygon, roomLamps), color_k: lit.length ? Math.round(lit.reduce((s, l) => s + l.color_k, 0) / lit.length) : 2900,
      wash: r4(Math.min(WASH_MAX_M, ceiling * 0.6 - 0.12)), lit: e.lit ? 1 : 0, presence: r4(Math.max(0, Math.min(1, e.presence))),
    });
  }
  return out;
}

/** The wall wash of a room: the outline's edges cut into ~0.4 m segments, each vertex with its light strength. */
export function washSegments(room: Pick<GlowRoom, 'polygon' | 'pools'>, step = 0.4): { a: [number, number]; b: [number, number]; sa: number; sb: number }[] {
  const out: { a: [number, number]; b: [number, number]; sa: number; sb: number }[] = [];
  const p = room.polygon;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const pa: [number, number] = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0];
      const pb: [number, number] = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
      out.push({ a: pa, b: pb, sa: r4(Math.min(1, 0.3 + 0.7 * poolStrength(pa[0], pa[1], room.pools))), sb: r4(Math.min(1, 0.3 + 0.7 * poolStrength(pb[0], pb[1], room.pools))) });
    }
  }
  return out;
}

/** The glow strengths for a style and the night factor: `floor` is the gain of the multiplying floor pool (dst x (1 +
 * floor x pool)), the others the additive / normal alpha of their layers. */
export interface GlowLook {
  floor: number;
  wall: number;
  presFloor: number;
  presEdge: number;
  presWall: number;
}
export function glowLook(style: 'light' | 'dark', night: number): GlowLook {
  const n = Math.max(0, Math.min(1, night));
  const k = style === 'dark' ? 1.15 : 1;
  const mix = (day: number, nt: number) => r4((day + (nt - day) * n) * k);
  return { floor: mix(0.35, 1.3), wall: mix(0.1, 0.36), presFloor: mix(0.05, 0.07), presEdge: mix(0.3, 0.42), presWall: mix(0.1, 0.16) };
}
