/**
 * A smooth wall through points (owner request 2026-10-08, "קיר מעוגל דרך נקודות"): the person clicks points ON the
 * intended curve and the wall is built through them. Pure maths in plan PIXELS, no DOM: tests/unit-curve-fit.spec.ts.
 *
 * The result is the existing curved-wall model (schema 2.1: polyline + one DXF bulge per segment, wall-path.ts), so
 * every consumer (map, 3D, exports, DXF, glazing, openings, area) reads it unchanged. The fit:
 *
 * 1. A tangent at every point: the tangent of the circle through the point and its two neighbours (the open ends take
 *    the circle through the first / last three points). Points that lie on one circle therefore give exactly that
 *    circle, three points give one arc, collinear points give a straight wall.
 * 2. Between two consecutive points: ONE arc when the two tangents already agree with a single arc (the circle case),
 *    else a BIARC - two arcs that meet tangentially at a junction point (equal tangent lengths, the classic construction).
 *    The curve is tangent-continuous (G1) everywhere: at every clicked point and at every junction.
 * 3. A point where the path turns back sharply (more than SHARP_TURN_DEG between the chords) is kept as a corner: the
 *    curve on each side is fitted on its own (a smooth curve cannot reverse there without a loop).
 *
 * Why biarcs and not one arc per pair of points: a chain of single arcs can only be tangent-continuous when its first
 * tangent is chosen freely, and a closed loop with an even number of points then has no solution at all; the chain also
 * oscillates when the spacing is uneven. Biarcs are local (moving a point changes the curve only near it), exact on
 * circles, and every arc stays a true arc in DXF and 3D. The price is an extra corner (the junction) in the polyline:
 * the clicked points are recorded as the wall's `through` indices (external_ids.curve_through, curve-ops.ts).
 */
export type P = [number, number];

export const SHARP_TURN_DEG = 150;
/** Points closer than this (px) are one point. */
export const MIN_GAP_PX = 0.5;
/** Two tangents that differ less than this (radians) from a single arc's take the single arc (no junction). */
const SINGLE_ARC_EPS = 1e-6;
const MAX_BULGE = 4;
const EPS = 1e-9;

export interface CurveFit {
  /** Corners in pixels: the clicked points and the junctions between them; a closed curve repeats its first point last. */
  pts: P[];
  /** One bulge per segment (wall-path convention: tan(theta/4), positive = clockwise on screen). */
  bulges: number[];
  /** Indices into `pts` of the clicked points, in order (a closed curve does not list the closing repeat). */
  through: number[];
}

export interface FitOptions {
  closed?: boolean;
  /** Applied to each junction point before its arcs are computed (the editor rounds to the stored precision), so the
   * bulges match the corners that are actually stored. */
  round?: (p: P) => P;
}

const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const dot = (a: P, b: P): number => a[0] * b[0] + a[1] * b[1];
const cross = (a: P, b: P): number => a[0] * b[1] - a[1] * b[0];
const len = (a: P): number => Math.hypot(a[0], a[1]);
const unit = (a: P): P => {
  const n = len(a);
  return n > EPS ? [a[0] / n, a[1] / n] : [1, 0];
};
/** The signed angle that turns direction u onto direction v (atan2 convention of the plan's own axes). */
const angle = (u: P, v: P): number => Math.atan2(cross(u, v), dot(u, v));

/** The points without consecutive near-duplicates (and, closed, without a last point on the first). */
export function cleanPoints(input: readonly P[], closed: boolean): P[] {
  const out: P[] = [];
  for (const p of input) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const last = out[out.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_GAP_PX) continue;
    out.push([p[0], p[1]]);
  }
  if (closed) while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < MIN_GAP_PX) out.pop();
  return out;
}

/** The tangent at `at` (one of a, b, c) of the circle through a, b, c in travel order; the chord a -> c when they are
 * collinear (no circle). */
function circleTangent(a: P, b: P, c: P, at: P): P {
  const turn = cross(sub(b, a), sub(c, b));
  const ax = a[0];
  const ay = a[1];
  const bx = b[0] - ax;
  const by = b[1] - ay;
  const cx = c[0] - ax;
  const cy = c[1] - ay;
  const d = 2 * (bx * cy - by * cx);
  const scale = Math.max(dot(sub(b, a), sub(b, a)), dot(sub(c, a), sub(c, a)), 1);
  if (Math.abs(d) <= 1e-9 * scale) return unit(sub(c, a));
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ox = ax + (cy * b2 - by * c2) / d;
  const oy = ay + (bx * c2 - cx * b2) / d;
  const r: P = [at[0] - ox, at[1] - oy];
  const s = turn > 0 ? 1 : -1;
  return unit([-r[1] * s, r[0] * s]);
}

/** The turn between the chord into point i and the chord out of it (radians, signed). */
function turnAt(prev: P, p: P, next: P): number {
  return angle(sub(p, prev), sub(next, p));
}

/** Tangents (in, out) at every point of an open run or a closed ring of at least two points. */
function tangents(pts: readonly P[], closed: boolean): { tin: P[]; tout: P[] } {
  const n = pts.length;
  const tin: P[] = new Array(n);
  const tout: P[] = new Array(n);
  const sharp = (SHARP_TURN_DEG * Math.PI) / 180;
  const at = (i: number) => pts[((i % n) + n) % n];
  // corner flags: a sharp reversal is a corner
  const corner = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) continue;
    if (n < 3) continue;
    corner[i] = Math.abs(turnAt(at(i - 1), at(i), at(i + 1))) > sharp;
  }
  // a run's end tangent: the circle through the end and the next two points of its run (or the chord)
  const endTangent = (i: number, dir: 1 | -1): P => {
    const p1 = at(i + dir);
    const runHasThird = closed ? n >= 3 && !corner[((i + dir) % n + n) % n] : i + 2 * dir >= 0 && i + 2 * dir < n && !corner[i + dir];
    if (!runHasThird) return unit(dir === 1 ? sub(p1, at(i)) : sub(at(i), p1));
    const p2 = at(i + 2 * dir);
    // travel order: i -> i+1 -> i+2 (dir 1), or i-2 -> i-1 -> i (dir -1)
    return dir === 1 ? circleTangent(at(i), p1, p2, at(i)) : circleTangent(p2, p1, at(i), at(i));
  };
  for (let i = 0; i < n; i++) {
    const open = !closed && (i === 0 || i === n - 1);
    if (n === 2) {
      const t = unit(sub(at(1), at(0)));
      tin[i] = t;
      tout[i] = t;
      continue;
    }
    if (open) {
      const t = i === 0 ? endTangent(0, 1) : endTangent(n - 1, -1);
      tin[i] = t;
      tout[i] = t;
      continue;
    }
    if (corner[i]) {
      tin[i] = endTangent(i, -1);
      tout[i] = endTangent(i, 1);
      continue;
    }
    const t = circleTangent(at(i - 1), at(i), at(i + 1), at(i));
    tin[i] = t;
    tout[i] = t;
  }
  return { tin, tout };
}

/** The bulge of the arc a -> b that leaves a along t0 (clamped to the model's limit). */
function bulgeFromStart(a: P, b: P, t0: P): number {
  const c = sub(b, a);
  if (len(c) <= EPS) return 0;
  const phi = angle(t0, c); // half the sweep
  const v = Math.tan(phi / 2);
  return Math.abs(v) < 1e-9 ? 0 : Math.max(-MAX_BULGE, Math.min(MAX_BULGE, v));
}

/** The bulge of the arc a -> b that arrives at b along t1. */
function bulgeFromEnd(a: P, b: P, t1: P): number {
  const c = sub(b, a);
  if (len(c) <= EPS) return 0;
  const phi = angle(c, t1);
  const v = Math.tan(phi / 2);
  return Math.abs(v) < 1e-9 ? 0 : Math.max(-MAX_BULGE, Math.min(MAX_BULGE, v));
}

/** The junction of the equal-tangent-length biarc from p0 (tangent t0) to p1 (tangent t1); null when degenerate. */
export function biarcJunction(p0: P, t0: P, p1: P, t1: P): P | null {
  const v = sub(p1, p0);
  const t: P = [t0[0] + t1[0], t0[1] + t1[1]];
  const vv = dot(v, v);
  if (vv <= EPS) return null;
  const vt = dot(v, t);
  const denom = 2 * (1 - dot(t0, t1));
  let d: number;
  if (Math.abs(denom) <= 1e-12) {
    const vt2 = dot(v, t1);
    if (Math.abs(vt2) <= 1e-12) return [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]; // two half circles (S)
    d = vv / (4 * vt2);
  } else {
    const disc = vt * vt + denom * vv;
    d = (-vt + Math.sqrt(Math.max(0, disc))) / denom;
  }
  if (!Number.isFinite(d)) return null;
  const j: P = [(p0[0] + p1[0] + d * (t0[0] - t1[0])) / 2, (p0[1] + p1[1] + d * (t0[1] - t1[1])) / 2];
  const span = Math.sqrt(vv);
  if (Math.hypot(j[0] - p0[0], j[1] - p0[1]) < 1e-6 * span || Math.hypot(j[0] - p1[0], j[1] - p1[1]) < 1e-6 * span) return null;
  return j;
}

/** The smooth curve through `input` (pixels). Fewer than two distinct points: no curve (empty). */
export function fitCurve(input: readonly P[], opts: FitOptions = {}): CurveFit {
  const closedAsked = !!opts.closed;
  const pts = cleanPoints(input, closedAsked);
  const round = opts.round ?? ((p: P) => p);
  if (pts.length < 2) return { pts: pts.map((p): P => [p[0], p[1]]), bulges: [], through: pts.map((_, i) => i) };
  const closed = closedAsked && pts.length >= 2;
  if (closed && pts.length === 2) {
    // a closed curve through two points: the circle on their distance as diameter (two half circles)
    return { pts: [pts[0], pts[1], [pts[0][0], pts[0][1]]], bulges: [1, 1], through: [0, 1] };
  }
  const n = pts.length;
  const { tin, tout } = tangents(pts, closed);
  const outP: P[] = [pts[0]];
  const outB: number[] = [];
  const through = [0];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const k = (i + 1) % n;
    const b = pts[k];
    const t0 = tout[i];
    const t1 = tin[k];
    const c = sub(b, a);
    const single = Math.abs(angle(t0, c) - angle(c, t1)) <= SINGLE_ARC_EPS;
    const j = single ? null : biarcJunction(a, t0, b, t1);
    if (!j) {
      outB.push(bulgeFromStart(a, b, t0));
    } else {
      const jr = round(j);
      outB.push(bulgeFromStart(a, jr, t0));
      outP.push(jr);
      outB.push(bulgeFromEnd(jr, b, t1));
    }
    outP.push(k === 0 ? [pts[0][0], pts[0][1]] : b);
    if (k !== 0) through.push(outP.length - 1);
  }
  return { pts: outP, bulges: outB, through };
}

/** The radius (px) of the tightest arc of a fitted curve; Infinity when it is straight. */
export function minRadiusPx(fit: Pick<CurveFit, 'pts' | 'bulges'>): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < fit.bulges.length; i++) {
    const b = fit.bulges[i];
    if (Math.abs(b) <= EPS) continue;
    const chord = Math.hypot(fit.pts[i + 1][0] - fit.pts[i][0], fit.pts[i + 1][1] - fit.pts[i][1]);
    const r = (chord * (1 + b * b)) / (4 * Math.abs(b));
    if (r < best) best = r;
  }
  return best;
}
