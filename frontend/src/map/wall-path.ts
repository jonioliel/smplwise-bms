/**
 * The path of a wall, straight or curved (owner request 2026-10-08) - the mirror of the backend's
 * services/wall_path.py; contracts/fixtures/plan_geometry/wall-path.golden.json pins both (tests/unit-wall-path.spec.ts).
 *
 * A wall keeps its `polyline` (corners, 0..1) and may carry `bulges`: one per segment, the DXF LWPOLYLINE convention -
 * bulge = tan(theta / 4), 0 = straight. Everything here is in plan PIXELS (x * W, y * H): only there is an arc a circle.
 * The sign follows the stored numbers (x right, y DOWN): a positive bulge turns clockwise on screen and bulges to the
 * screen-left of the segment's direction (geometry.ts' `nl` = (d.y, -d.x)).
 *
 * No DOM, no Lit and no imports from the rest of the map code, so any wall kind and any tool can use it.
 */
export type P = [number, number];

export const MAX_BULGE = 4;
export const TOL_PX = 0.25;
export const MAX_STEP = Math.PI / 36;
export const MAX_SEGMENTS = 128;
const EPS = 1e-9;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The wall's bulges, one per segment; all zeros when absent or malformed (the server refuses such a document; a
 * reader never crashes on a draft that fails it). */
export function bulgesOf(wall: { polyline: readonly (readonly number[])[]; bulges?: readonly number[] | null }): number[] {
  const n = Math.max(0, (wall.polyline?.length ?? 0) - 1);
  const raw = wall.bulges;
  if (!Array.isArray(raw) || raw.length !== n || !raw.every(isNum)) return new Array<number>(n).fill(0);
  return raw.map(Number);
}

export function isCurved(wall: { polyline: readonly (readonly number[])[]; bulges?: readonly number[] | null }): boolean {
  return bulgesOf(wall).some((b) => Math.abs(b) > EPS);
}

export function wallPx(wall: { polyline: readonly (readonly number[])[]; bulges?: readonly number[] | null }, W: number, H: number): { pts: P[]; bulges: number[] } {
  return { pts: wall.polyline.map((p): P => [p[0] * W, p[1] * H]), bulges: bulgesOf(wall) };
}

export interface Arc { cx: number; cy: number; r: number; a0: number; sweep: number }

/** The arc a -> b, or null for a straight (or zero-length) segment; the sweep is signed like the bulge. */
export function arcOf(a: P, b: P, bulge: number): Arc | null {
  if (Math.abs(bulge) <= EPS) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const chord = Math.hypot(dx, dy);
  if (chord <= EPS) return null;
  const k = (1 - bulge * bulge) / (4 * bulge);
  const cx = (a[0] + b[0]) / 2 - dy * k;
  const cy = (a[1] + b[1]) / 2 + dx * k;
  const r = (chord * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
  return { cx, cy, r, a0: Math.atan2(a[1] - cy, a[0] - cx), sweep: 4 * Math.atan(bulge) };
}

export function segLength(a: P, b: P, bulge: number): number {
  const arc = arcOf(a, b, bulge);
  return arc ? arc.r * Math.abs(arc.sweep) : Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function radius(a: P, b: P, bulge: number): number {
  const arc = arcOf(a, b, bulge);
  return arc ? arc.r : Number.POSITIVE_INFINITY;
}

function steps(r: number, sweep: number, tol: number): number {
  let step = MAX_STEP;
  if (tol < r) step = Math.min(step, 2 * Math.acos(1 - tol / r));
  return Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil(Math.abs(sweep) / step - EPS)));
}

export function cumulative(pts: readonly P[], bulges: readonly number[]): number[] {
  const out = [0];
  for (let i = 0; i < pts.length - 1; i++) out.push(out[i] + segLength(pts[i], pts[i + 1], bulges[i] ?? 0));
  return out;
}

export function pathLength(pts: readonly P[], bulges: readonly number[]): number {
  const c = cumulative(pts, bulges);
  return c[c.length - 1];
}

/** The point at fraction f (by length) of one segment and the unit direction of travel there. */
function segPoint(a: P, b: P, bulge: number, f: number): { p: P; d: P } {
  const arc = arcOf(a, b, bulge);
  if (!arc) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const n = Math.hypot(dx, dy);
    return { p: [a[0] + dx * f, a[1] + dy * f], d: n > EPS ? [dx / n, dy / n] : [1, 0] };
  }
  const ang = arc.a0 + arc.sweep * f;
  const sgn = arc.sweep > 0 ? 1 : -1;
  return { p: [arc.cx + arc.r * Math.cos(ang), arc.cy + arc.r * Math.sin(ang)], d: [-Math.sin(ang) * sgn, Math.cos(ang) * sgn] };
}

function locate(cum: readonly number[], s: number): { i: number; f: number } {
  let i = 0;
  const n = cum.length - 1;
  while (i < n - 1 && s > cum[i + 1]) i++;
  const seg = cum[i + 1] - cum[i];
  return { i, f: seg > EPS ? Math.min(1, Math.max(0, (s - cum[i]) / seg)) : 0 };
}

/** The point at arc length s along the path and the unit tangent there. */
export function pointAtS(pts: readonly P[], bulges: readonly number[], s: number, cum?: readonly number[]): { p: P; d: P } {
  const c = cum ?? cumulative(pts, bulges);
  const { i, f } = locate(c, s);
  return segPoint(pts[i], pts[i + 1], bulges[i] ?? 0, f);
}

/** The exact part of the path between arc lengths s0 < s1 (a cut arc keeps its circle). */
export function subPath(pts: readonly P[], bulges: readonly number[], s0: number, s1: number, cum?: readonly number[]): { pts: P[]; bulges: number[] } {
  const c = cum ?? cumulative(pts, bulges);
  const a = locate(c, s0);
  const z = locate(c, s1);
  const outP: P[] = [segPoint(pts[a.i], pts[a.i + 1], bulges[a.i] ?? 0, a.f).p];
  const outB: number[] = [];
  for (let i = a.i; i <= z.i; i++) {
    const lo = i === a.i ? a.f : 0;
    const hi = i === z.i ? z.f : 1;
    if (hi - lo <= EPS && !(i === a.i && i === z.i)) continue;
    const b = bulges[i] ?? 0;
    outB.push(Math.abs(b) <= EPS ? 0 : Math.tan(Math.atan(b) * (hi - lo)));
    outP.push(i === z.i ? segPoint(pts[i], pts[i + 1], b, hi).p : pts[i + 1]);
  }
  if (outP.length === 1) {
    outP.push(outP[0]);
    outB.push(0);
  }
  return { pts: outP, bulges: outB };
}

/** The path as a polyline within `tol` px of every arc (at most MAX_STEP per chord), with each sample's exact arc
 * length. Straight segments add only their end; corners are kept exactly. */
export function sampleWithS(pts: readonly P[], bulges: readonly number[], tol = TOL_PX): { pts: P[]; s: number[] } {
  if (!pts.length) return { pts: [], s: [] };
  const out: P[] = [pts[0]];
  const sOut = [0];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const arc = arcOf(a, b, bulges[i] ?? 0);
    if (!arc) {
      s += Math.hypot(b[0] - a[0], b[1] - a[1]);
      out.push(b);
      sOut.push(s);
      continue;
    }
    const n = steps(arc.r, arc.sweep, tol);
    for (let k = 1; k < n; k++) {
      const ang = arc.a0 + (arc.sweep * k) / n;
      out.push([arc.cx + arc.r * Math.cos(ang), arc.cy + arc.r * Math.sin(ang)]);
      sOut.push(s + (arc.r * Math.abs(arc.sweep) * k) / n);
    }
    s += arc.r * Math.abs(arc.sweep);
    out.push(b);
    sOut.push(s);
  }
  return { pts: out, s: sOut };
}

export function sample(pts: readonly P[], bulges: readonly number[], tol = TOL_PX): P[] {
  return sampleWithS(pts, bulges, tol).pts;
}

/** THE shared helper: a wall's path as a normalized polyline (0..1), arcs sampled within `tol` pixels. */
export function sampledWall(wall: { polyline: readonly (readonly number[])[]; bulges?: readonly number[] | null }, W: number, H: number, tol = TOL_PX): P[] {
  if (!isCurved(wall)) return wall.polyline.map((p): P => [p[0], p[1]]);
  const { pts, bulges } = wallPx(wall, W, H);
  return sample(pts, bulges, tol).map((p): P => [p[0] / W, p[1] / H]);
}

export function wallLengthPx(wall: { polyline: readonly (readonly number[])[]; bulges?: readonly number[] | null }, W: number, H: number): number {
  const { pts, bulges } = wallPx(wall, W, H);
  return pts.length >= 2 ? pathLength(pts, bulges) : 0;
}

/** The nearest point of the path to q: its arc length, the distance and the point. */
export function project(pts: readonly P[], bulges: readonly number[], q: P, tol = TOL_PX): { s: number; dist: number; p: P } {
  const sp = sampleWithS(pts, bulges, tol);
  let best = { s: 0, dist: Number.POSITIVE_INFINITY, p: sp.pts[0] ?? q };
  for (let i = 0; i < sp.pts.length - 1; i++) {
    const [ax, ay] = sp.pts[i];
    const dx = sp.pts[i + 1][0] - ax;
    const dy = sp.pts[i + 1][1] - ay;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / l2)) : 0;
    const p: P = [ax + u * dx, ay + u * dy];
    const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d < best.dist) best = { s: sp.s[i] + u * (sp.s[i + 1] - sp.s[i]), dist: d, p };
  }
  return best;
}

/** The bulge of the arc a -> b through m (a 3-point arc); 0 when collinear. Clamped to MAX_BULGE. */
export function bulgeThrough(a: P, m: P, b: P): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const side = (m[0] - a[0]) * dy - (m[1] - a[1]) * dx;
  const ux = a[0] - m[0];
  const uy = a[1] - m[1];
  const vx = b[0] - m[0];
  const vy = b[1] - m[1];
  const nu = Math.hypot(ux, uy);
  const nv = Math.hypot(vx, vy);
  if (nu <= EPS || nv <= EPS || Math.abs(side) <= EPS * Math.max(1, Math.hypot(dx, dy))) return 0;
  const inscribed = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (nu * nv))));
  const mag = Math.tan((Math.PI - inscribed) / 2);
  return Math.sign(side) * Math.min(MAX_BULGE, mag);
}

/** The bulge of the arc of radius r (px) from a to b on the side of `sign`; null when r < half the chord. */
export function bulgeForRadius(a: P, b: P, r: number, sign: number, major = false): number | null {
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (chord <= EPS || !(r > 0) || r < chord / 2 - 1e-9) return null;
  const half = Math.asin(Math.min(1, chord / (2 * r)));
  const theta = major ? 2 * Math.PI - 2 * half : 2 * half;
  return (sign < 0 ? -1 : 1) * Math.min(MAX_BULGE, Math.tan(theta / 4));
}

function filletCorner(a: P, v: P, b: P, bIn: number, bOut: number, r: number): { p1: P; p2: P; bulge: number } | null {
  if (Math.abs(bIn) > EPS || Math.abs(bOut) > EPS || !(r > 0)) return null;
  let d1x = v[0] - a[0];
  let d1y = v[1] - a[1];
  let d2x = b[0] - v[0];
  let d2y = b[1] - v[1];
  const l1 = Math.hypot(d1x, d1y);
  const l2 = Math.hypot(d2x, d2y);
  if (l1 <= EPS || l2 <= EPS) return null;
  d1x /= l1;
  d1y /= l1;
  d2x /= l2;
  d2y /= l2;
  const turn = Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y);
  if (Math.abs(turn) <= 1e-6 || Math.abs(turn) >= Math.PI - 1e-6) return null;
  const tlen = r * Math.tan(Math.abs(turn) / 2);
  if (tlen > l1 + 1e-9 || tlen > l2 + 1e-9) return null;
  return { p1: [v[0] - d1x * tlen, v[1] - d1y * tlen], p2: [v[0] + d2x * tlen, v[1] + d2y * tlen], bulge: Math.tan(turn / 4) };
}

/** Round corner i with an arc of radius r (px) tangent to both of its straight segments; a closed outline may round
 * corner 0 (the path then starts at the second tangent point). null when the corner cannot take that radius. */
export function fillet(pts: readonly P[], bulges: readonly number[], i: number, r: number): { pts: P[]; bulges: number[] } | null {
  const n = pts.length;
  const closed = n >= 4 && pts[0][0] === pts[n - 1][0] && pts[0][1] === pts[n - 1][1];
  if (closed && i === 0) {
    const res = filletCorner(pts[n - 2], pts[0], pts[1], bulges[n - 2] ?? 0, bulges[0] ?? 0, r);
    if (!res) return null;
    return { pts: [res.p2, ...pts.slice(1, -1), res.p1, res.p2], bulges: [...bulges, res.bulge] };
  }
  if (!(i > 0 && i < n - 1)) return null;
  const res = filletCorner(pts[i - 1], pts[i], pts[i + 1], bulges[i - 1] ?? 0, bulges[i] ?? 0, r);
  if (!res) return null;
  return { pts: [...pts.slice(0, i), res.p1, res.p2, ...pts.slice(i + 1)], bulges: [...bulges.slice(0, i), res.bulge, ...bulges.slice(i)] };
}

/** Signed area (px^2) of a closed path: the corner polygon plus each arc's circular segment. */
export function ringArea(pts: readonly P[], bulges: readonly number[]): number {
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  let area = a / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const arc = arcOf(pts[i], pts[i + 1], bulges[i] ?? 0);
    if (arc) area += Math.sign(arc.sweep) * ((arc.r * arc.r) / 2) * (Math.abs(arc.sweep) - Math.sin(Math.abs(arc.sweep)));
  }
  return area;
}

/** A polyline moved sideways by d px (positive = screen-left of travel) with mitred joins (cut at miterLimit * |d|). */
export function offsetPolyline(input: readonly P[], d: number, miterLimit = 4): P[] {
  const pts = input.filter((p, k) => k === 0 || Math.hypot(p[0] - input[k - 1][0], p[1] - input[k - 1][1]) > EPS);
  if (pts.length < 2) return pts.map((p): P => [p[0], p[1]]);
  const normals: P[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const dx = pts[k + 1][0] - pts[k][0];
    const dy = pts[k + 1][1] - pts[k][1];
    const n = Math.hypot(dx, dy);
    normals.push([dy / n, -dx / n]);
  }
  const out: P[] = [[pts[0][0] + normals[0][0] * d, pts[0][1] + normals[0][1] * d]];
  for (let k = 1; k < pts.length - 1; k++) {
    const [n0x, n0y] = normals[k - 1];
    const [n1x, n1y] = normals[k];
    let mx = n0x + n1x;
    let my = n0y + n1y;
    const mn = Math.hypot(mx, my);
    if (mn <= EPS) {
      out.push([pts[k][0] + n1x * d, pts[k][1] + n1y * d]);
      continue;
    }
    mx /= mn;
    my /= mn;
    const cosHalf = mx * n1x + my * n1y;
    let length = cosHalf > EPS ? d / cosHalf : d * miterLimit;
    if (Math.abs(length) > Math.abs(d) * miterLimit) length = Math.sign(length) * Math.abs(d) * miterLimit;
    out.push([pts[k][0] + mx * length, pts[k][1] + my * length]);
  }
  const nl = normals[normals.length - 1];
  out.push([pts[pts.length - 1][0] + nl[0] * d, pts[pts.length - 1][1] + nl[1] * d]);
  return out;
}

/** The wall's two faces in pixels (left, right of travel), from its sampled path. */
export function wallFaces(wall: { polyline: readonly (readonly number[])[]; bulges?: readonly number[] | null }, W: number, H: number, thicknessPx: number, tol = TOL_PX): { left: P[]; right: P[] } {
  const { pts, bulges } = wallPx(wall, W, H);
  const s = sample(pts, bulges, tol);
  return { left: offsetPolyline(s, thicknessPx / 2), right: offsetPolyline(s, -thicknessPx / 2) };
}
