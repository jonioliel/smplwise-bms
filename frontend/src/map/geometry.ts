/**
 * Plan Studio structure layer (T084, CR-003): the v2 geometry document types, the deterministic primitives every map
 * draws - the same list the backend's plan_geometry_render.structure_primitives produces for the SVG / PNG exports
 * (contracts/fixtures/plan_geometry pins both) - and the pure maths of the editor tools: snapping, the nearest wall,
 * distances and areas in metres. No DOM and no Lit, so it runs in node (tests/unit-geometry.spec.ts).
 */
export type Pt = [number, number];
export type WallKind = 'exterior' | 'interior' | 'partition' | 'railing' | 'low';
export type OpeningKind = 'door' | 'window' | 'passage';
export type Swing = 'left' | 'right' | 'double' | 'sliding' | 'none';
export type Hinge = 'start' | 'end';
export type GeomSource = 'manual' | 'auto' | 'imported';
export type CalStatus = 'measured' | 'estimated' | 'missing';
export type ExternalIds = Record<string, string>;

export interface AnchorRef {
  resource_type: 'camera' | 'ha_entity';
  resource_id: string;
}
export interface GeomLevel {
  id: string;
  name: string;
  elevation_m: number;
  ceiling_height_m: number;
  is_default: boolean;
  external_ids?: ExternalIds;
}
export interface GeomWall {
  id: string;
  level_id: string;
  polyline: Pt[];
  thickness_m: number;
  height_m: number | null;
  base_z_m: number;
  kind: WallKind;
  confidence: number;
  source: GeomSource;
  locked: boolean;
  external_ids?: ExternalIds;
}
export interface GeomOpening {
  id: string;
  wall_id: string;
  t: number;
  kind: OpeningKind;
  width_m: number;
  height_m: number;
  sill_m: number;
  swing: Swing;
  hinge: Hinge;
  anchor_ref: AnchorRef | null;
  confidence: number;
  source: GeomSource;
  external_ids?: ExternalIds;
}
export interface GeomLabel {
  id: string;
  text: string;
  position: Pt;
  level_id: string;
  size: number;
}
export interface CalPair {
  a: Pt;
  b: Pt;
  metres: number;
}
export interface Calibration {
  status: CalStatus;
  method: string | null;
  pairs: CalPair[];
  residual_pct: number | null;
  reason: string | null;
}
export interface GeometryDoc {
  schema_version: '2.0';
  plan_version_id: string;
  floor_id: string;
  source: { sha256: string; file_name: string; mime: string; page: number };
  dimensions: { width_px: number; height_px: number; scale_m_per_px: number | null; calibration: Calibration };
  transform: { rotation: number; crop: { x: number; y: number; w: number; h: number } | null };
  levels: GeomLevel[];
  walls: GeomWall[];
  openings: GeomOpening[];
  rooms: { id: string; level_id?: string | null; ceiling_height_m?: number | null }[];
  objects: unknown[];
  circuits: unknown[];
  connectors: unknown[];
  labels: GeomLabel[];
  groups: unknown[];
  uncertain_regions: unknown[];
  uncertainty: { overall: number; notes: string[] };
  meta: { generator: string; tokens_version: string; detector_version: string | null };
}

export interface WallPrim { kind: 'wall'; id: string; part: number; points: Pt[]; width: number }
export interface DoorPrim { kind: 'door'; id: string; gap: [Pt, Pt]; leaves: [Pt, Pt][]; arcs: { from: Pt; to: Pt; r: number; sweep: 0 | 1 }[] }
export interface WindowPrim { kind: 'window'; id: string; gap: [Pt, Pt]; lines: [Pt, Pt][] }
export interface PassagePrim { kind: 'passage'; id: string; gap: [Pt, Pt] }
export interface LabelPrim { kind: 'label'; id: string; x: number; y: number; text: string; size: number }
export type Primitive = WallPrim | DoorPrim | WindowPrim | PassagePrim | LabelPrim;

export const DEFAULT_LEVEL_ID = 'L0';
export const DEFAULT_WALL_THICKNESS_M = 0.2;
export const ESTIMATED_WALL_FRACTION = 0.006;
export const OPENING_DEFAULTS: Record<OpeningKind, { width_m: number; height_m: number; sill_m: number }> = {
  door: { width_m: 0.9, height_m: 2.1, sill_m: 0 },
  window: { width_m: 1.2, height_m: 1.2, sill_m: 0.9 },
  passage: { width_m: 1.0, height_m: 2.1, sill_m: 0 },
};

/** Half-up rounding to 0.01 px - the backend's r2, so both sides print the same numbers. */
export const r2 = (v: number): number => Math.floor(v * 100 + 0.5) / 100;
const rp = (p: Pt): Pt => [r2(p[0]), r2(p[1])];
const byId = <T extends { id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Metres per version pixel, and whether it is only an estimate (no calibration: a 0.2 m wall = 0.6 % of the width). */
export function effectiveScale(doc: Pick<GeometryDoc, 'dimensions'>): { scale: number; estimated: boolean } {
  const d = doc.dimensions;
  const s = d.scale_m_per_px;
  const st = d.calibration?.status;
  if (typeof s === 'number' && Number.isFinite(s) && s > 0 && (st === 'measured' || st === 'estimated')) return { scale: s, estimated: st === 'estimated' };
  return { scale: DEFAULT_WALL_THICKNESS_M / (ESTIMATED_WALL_FRACTION * (d.width_px || 1000)), estimated: true };
}

function cumulative(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return out;
}

/** The point at arc length s along a polyline and the unit direction of the segment it lies on. */
export function pointAt(pts: Pt[], cum: number[], s: number): { p: Pt; d: Pt } {
  let i = 0;
  while (i < pts.length - 2 && s > cum[i + 1]) i++;
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  const seg = cum[i + 1] - cum[i];
  if (seg <= 1e-9) return { p: [x0, y0], d: [1, 0] };
  const f = Math.min(1, Math.max(0, (s - cum[i]) / seg));
  return { p: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f], d: [(x1 - x0) / seg, (y1 - y0) / seg] };
}

function subPolyline(pts: Pt[], cum: number[], s0: number, s1: number): Pt[] {
  const inner: Pt[] = [];
  for (let i = 1; i < pts.length - 1; i++) if (s0 < cum[i] && cum[i] < s1) inner.push(pts[i]);
  return [pointAt(pts, cum, s0).p, ...inner, pointAt(pts, cum, s1).p];
}

const extend = (p: Pt, q: Pt, by: number): Pt => {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const n = Math.hypot(dx, dy);
  return n < 1e-9 ? p : [p[0] + (dx / n) * by, p[1] + (dy / n) * by];
};
const add = (p: Pt, v: Pt, k: number): Pt => [p[0] + v[0] * k, p[1] + v[1] * k];
const sweep = (c: Pt, a: Pt, b: Pt): 0 | 1 => ((a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0]) > 0 ? 1 : 0);

function door(g0: Pt, g1: Pt, d: Pt, o: GeomOpening, w: number): Pick<DoorPrim, 'leaves' | 'arcs'> {
  const nl: Pt = [d[1], -d[0]];
  const nr: Pt = [-d[1], d[0]];
  const swing = o.swing || 'right';
  if (swing === 'none') return { leaves: [], arcs: [] };
  if (swing === 'sliding') {
    const k = w * 0.12;
    return { leaves: [[rp(add(g0, nl, k)), rp(add(g1, nl, k))]], arcs: [] };
  }
  if (swing === 'double') {
    const h = w / 2;
    const leaves: [Pt, Pt][] = [];
    const arcs: DoorPrim['arcs'] = [];
    const pairs: [Pt, Pt][] = [[g0, d], [g1, [-d[0], -d[1]]]];
    for (const [hinge, along] of pairs) {
      const tip = add(hinge, nl, h);
      const mid = add(hinge, along, h);
      leaves.push([rp(hinge), rp(tip)]);
      arcs.push({ from: rp(tip), to: rp(mid), r: r2(h), sweep: sweep(hinge, tip, mid) });
    }
    return { leaves, arcs };
  }
  const n = swing === 'left' ? nl : nr;
  const [hinge, other] = (o.hinge || 'start') === 'start' ? [g0, g1] : [g1, g0];
  const tip = add(hinge, n, w);
  return { leaves: [[rp(hinge), rp(tip)]], arcs: [{ from: rp(tip), to: rp(other), r: r2(w), sweep: sweep(hinge, tip, other) }] };
}

/** Walls cut by their openings (free ends grown by half the thickness), door leaves and arcs, window glass,
 * passages and labels, in plan pixels - the mirror of the backend's structure_primitives. */
export function buildPrimitives(doc: GeometryDoc, width: number, height: number, level: string | null = null): Primitive[] {
  const { scale } = effectiveScale(doc);
  const pxPerM = 1 / scale;
  const byWall = new Map<string, GeomOpening[]>();
  for (const o of doc.openings) {
    const bucket = byWall.get(o.wall_id);
    if (bucket) bucket.push(o);
    else byWall.set(o.wall_id, [o]);
  }
  const prims: Primitive[] = [];
  const geo = new Map<string, { pts: Pt[]; cum: number[]; wpx: number }>();
  // Draft documents can carry duplicate wall ids (duplicate_id is not structural); the backend's export
  // collapses them by id, keeping the last occurrence, and draws one wall - mirror that here.
  for (const w of [...new Map(doc.walls.map((x) => [x.id, x])).values()].sort(byId)) {
    if (level !== null && w.level_id !== level) continue;
    const pts: Pt[] = w.polyline.map((p) => [p[0] * width, p[1] * height]);
    const cum = cumulative(pts);
    const total = cum[cum.length - 1];
    if (total <= 1e-6) continue;
    const wpx = Math.max(1, (w.thickness_m || DEFAULT_WALL_THICKNESS_M) * pxPerM);
    geo.set(w.id, { pts, cum, wpx });
    const cuts = (byWall.get(w.id) ?? []).map((o): [number, number] => {
      const c = (o.t || 0) * total;
      const half = ((o.width_m || 0) * pxPerM) / 2;
      return [Math.max(0, c - half), Math.min(total, c + half)];
    });
    cuts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const keep: [number, number][] = [];
    let cursor = 0;
    for (const [a, b] of cuts) {
      if (a > cursor) keep.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < total) keep.push([cursor, total]);
    let part = 0;
    for (const [s0, s1] of keep) {
      if (s1 - s0 <= 0.01) continue;
      const seg = subPolyline(pts, cum, s0, s1);
      if (s0 <= 0) seg[0] = extend(seg[0], seg[1], wpx / 2);
      if (s1 >= total) seg[seg.length - 1] = extend(seg[seg.length - 1], seg[seg.length - 2], wpx / 2);
      prims.push({ kind: 'wall', id: w.id, part, points: seg.map(rp), width: r2(wpx) });
      part += 1;
    }
  }
  for (const o of [...doc.openings].sort(byId)) {
    const g = geo.get(o.wall_id);
    if (!g) continue;
    const { p: c, d } = pointAt(g.pts, g.cum, (o.t || 0) * g.cum[g.cum.length - 1]);
    const w = (o.width_m || 0) * pxPerM;
    const g0 = add(c, d, -w / 2);
    const g1 = add(c, d, w / 2);
    const gap: [Pt, Pt] = [rp(g0), rp(g1)];
    if (o.kind === 'door') prims.push({ kind: 'door', id: o.id, gap, ...door(g0, g1, d, o, w) });
    else if (o.kind === 'window') {
      const nl: Pt = [d[1], -d[0]];
      const q = g.wpx / 4;
      prims.push({ kind: 'window', id: o.id, gap, lines: [[rp(add(g0, nl, q)), rp(add(g1, nl, q))], [rp(add(g0, nl, -q)), rp(add(g1, nl, -q))]] });
    } else prims.push({ kind: 'passage', id: o.id, gap });
  }
  for (const lb of [...doc.labels].sort(byId)) {
    if (level !== null && lb.level_id !== level) continue;
    prims.push({ kind: 'label', id: lb.id, x: r2(lb.position[0] * width), y: r2(lb.position[1] * height), text: String(lb.text ?? ''), size: r2(lb.size || 14) });
  }
  return prims;
}

// ---------------------------------------------------------------- editor maths

export function lengthPx(pts: Pt[], W: number, H: number): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot((pts[i][0] - pts[i - 1][0]) * W, (pts[i][1] - pts[i - 1][1]) * H);
  return s;
}

export function distanceM(a: Pt, b: Pt, W: number, H: number, scale: number): number {
  return Math.hypot((b[0] - a[0]) * W, (b[1] - a[1]) * H) * scale;
}

export function polygonAreaM2(poly: Pt[], W: number, H: number, scale: number): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * W * (y1 * H) - x1 * W * (y0 * H);
  }
  return (Math.abs(a) / 2) * scale * scale;
}

export function perimeterM(poly: Pt[], W: number, H: number, scale: number): number {
  return lengthPx([...poly, poly[0]], W, H) * scale;
}

/** The wall closest to a point (plan pixels) and the relative position t along its polyline. */
export function nearestWall(p: Pt, walls: GeomWall[], W: number, H: number, maxPx: number, onlyId?: string): { wall: GeomWall; t: number; distPx: number } | null {
  const q: Pt = [p[0] * W, p[1] * H];
  let best: { wall: GeomWall; t: number; distPx: number } | null = null;
  for (const w of walls) {
    if (onlyId && w.id !== onlyId) continue;
    const pts: Pt[] = w.polyline.map((v) => [v[0] * W, v[1] * H]);
    const cum = cumulative(pts);
    const total = cum[cum.length - 1];
    if (total <= 1e-6) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const dx = pts[i + 1][0] - ax;
      const dy = pts[i + 1][1] - ay;
      const l2 = dx * dx + dy * dy;
      const u = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / l2)) : 0;
      const dist = Math.hypot(q[0] - (ax + u * dx), q[1] - (ay + u * dy));
      if (dist <= maxPx && (!best || dist < best.distPx)) best = { wall: w, t: (cum[i] + u * Math.sqrt(l2)) / total, distPx: dist };
    }
  }
  return best;
}

/** A drawing point: onto a wall vertex within tolPx; otherwise, from the previous point, to the nearest 45 degrees
 * unless `free` (Shift). */
export function snapPoint(p: Pt, prev: Pt | null, walls: GeomWall[], W: number, H: number, opts: { tolPx: number; free: boolean }): Pt {
  let best: Pt | null = null;
  let bestD = opts.tolPx;
  for (const w of walls) {
    for (const v of w.polyline) {
      const dd = Math.hypot((v[0] - p[0]) * W, (v[1] - p[1]) * H);
      if (dd <= bestD) {
        best = v;
        bestD = dd;
      }
    }
  }
  if (best) return [best[0], best[1]];
  if (!prev || opts.free) return p;
  const dx = (p[0] - prev[0]) * W;
  const dy = (p[1] - prev[1]) * H;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return p;
  const step = Math.PI / 4;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  return [clamp01(prev[0] + (Math.cos(ang) * len) / W), clamp01(prev[1] + (Math.sin(ang) * len) / H)];
}
