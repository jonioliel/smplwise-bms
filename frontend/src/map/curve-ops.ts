/**
 * Curved walls in the editor (owner request 2026-10-08): the pure document edits of the structure tool's curve mode -
 * bend a segment through a point (3-point arc), set a segment's radius, straighten it, round a corner (a fillet tangent
 * to both sides) and draw an arc wall from start, end and a point on it. Every edit returns a new document (one undo
 * step in the editor); the wall's openings keep their place: each is re-projected onto the new path by its centre.
 *
 * The maths is wall-path.ts (plan pixels; positive bulge = clockwise on screen). No DOM, no Lit: tests/unit-curve-ops.spec.ts.
 */
import { pointOnWall, type GeometryDoc, type GeomWall, type Pt } from './geometry';
import { bulgeForRadius, bulgeThrough, bulgesOf, fillet, MAX_BULGE, pathLength, pointAtS, project, radius, wallPx, type P } from './wall-path';
import { defaultLevelId, newId, withBulges, type WallDefaults } from './studio-ops';

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const clampPt = (p: Pt): Pt => [round5(Math.min(1, Math.max(0, p[0]))), round5(Math.min(1, Math.max(0, p[1])))];
const toPx = (p: Pt, W: number, H: number): P => [p[0] * W, p[1] * H];

/** The wall with `polyline` and `bulges` replaced, its openings re-projected onto the new path (each keeps the point
 * nearest to where its centre was). */
function replaceWall(doc: GeometryDoc, old: GeomWall, polyline: Pt[], bulges: number[] | undefined, W: number, H: number): GeometryDoc {
  const next = withBulges({ ...old, polyline: polyline.map(clampPt) }, bulges);
  const { pts, bulges: nb } = wallPx(next, W, H);
  const total = pathLength(pts, nb);
  const openings = doc.openings.map((o) => {
    if (o.wall_id !== old.id || !(total > 0)) return o;
    const was = toPx(pointOnWall(old, o.t, W, H), W, H);
    const t = round5(Math.min(1, Math.max(0, project(pts, nb, was).s / total)));
    return t === o.t ? o : { ...o, t };
  });
  return { ...doc, walls: doc.walls.map((w) => (w.id === old.id ? next : w)), openings };
}

const wallOf = (doc: GeometryDoc, id: string): GeomWall | undefined => doc.walls.find((w) => w.id === id);

/** Segment `seg` of the wall bent into the arc through `through` (normalized); a point on the chord straightens it. */
export function bendSegment(doc: GeometryDoc, id: string, seg: number, through: Pt, W: number, H: number): GeometryDoc {
  const w = wallOf(doc, id);
  if (!w || seg < 0 || seg >= w.polyline.length - 1) return doc;
  const b = bulgeThrough(toPx(w.polyline[seg], W, H), toPx(through, W, H), toPx(w.polyline[seg + 1], W, H));
  return setSegmentBulge(doc, id, seg, b, W, H);
}

/** Segment `seg` with this bulge (clamped to +-MAX_BULGE; tiny values straighten it). */
export function setSegmentBulge(doc: GeometryDoc, id: string, seg: number, bulge: number, W: number, H: number): GeometryDoc {
  const w = wallOf(doc, id);
  if (!w || seg < 0 || seg >= w.polyline.length - 1 || !Number.isFinite(bulge)) return doc;
  const bulges = bulgesOf(w);
  const v = Math.abs(bulge) < 1e-4 ? 0 : Math.max(-MAX_BULGE, Math.min(MAX_BULGE, Math.round(bulge * 1e6) / 1e6));
  if (bulges[seg] === v) return doc;
  bulges[seg] = v;
  return replaceWall(doc, w, w.polyline, bulges, W, H);
}

export const straightenSegment = (doc: GeometryDoc, id: string, seg: number, W: number, H: number): GeometryDoc => setSegmentBulge(doc, id, seg, 0, W, H);

/** Segment `seg` as an arc of `radiusM` metres, on the side it already bends to (a straight one bends to the left of
 * its direction on screen); the minor arc unless the segment already turns more than half a circle. Null when the
 * radius is shorter than half the segment. */
export function setSegmentRadius(doc: GeometryDoc, id: string, seg: number, radiusM: number, scale: number, W: number, H: number): GeometryDoc | null {
  const w = wallOf(doc, id);
  if (!w || seg < 0 || seg >= w.polyline.length - 1 || !(radiusM > 0) || !(scale > 0)) return null;
  const cur = bulgesOf(w)[seg];
  const b = bulgeForRadius(toPx(w.polyline[seg], W, H), toPx(w.polyline[seg + 1], W, H), radiusM / scale, cur < 0 ? -1 : 1, Math.abs(cur) > 1);
  return b === null ? null : setSegmentBulge(doc, id, seg, b, W, H);
}

/** The radius of segment `seg` in metres, or null when it is straight. */
export function segmentRadiusM(w: GeomWall, seg: number, W: number, H: number, scale: number): number | null {
  if (seg < 0 || seg >= w.polyline.length - 1) return null;
  const r = radius(toPx(w.polyline[seg], W, H), toPx(w.polyline[seg + 1], W, H), bulgesOf(w)[seg]);
  return Number.isFinite(r) ? r * scale : null;
}

/** The smallest radius segment `seg` can take, in metres (half its chord). */
export function minRadiusM(w: GeomWall, seg: number, W: number, H: number, scale: number): number {
  const a = toPx(w.polyline[seg], W, H);
  const b = toPx(w.polyline[seg + 1], W, H);
  return (Math.hypot(b[0] - a[0], b[1] - a[1]) / 2) * scale;
}

/** Corner `index` rounded with an arc of `radiusM` metres tangent to both of its (straight) sides; a closed outline's
 * corner 0 too. Null when the corner cannot take it (an open end, a curved side, the tangent points past a neighbour). */
export function roundCorner(doc: GeometryDoc, id: string, index: number, radiusM: number, scale: number, W: number, H: number): GeometryDoc | null {
  const w = wallOf(doc, id);
  if (!w || !(radiusM > 0) || !(scale > 0)) return null;
  const { pts, bulges } = wallPx(w, W, H);
  const res = fillet(pts, bulges, index, radiusM / scale);
  if (!res) return null;
  return replaceWall(doc, w, res.pts.map((p): Pt => [p[0] / W, p[1] / H]), res.bulges, W, H);
}

/** The largest radius corner `index` can take, in metres (the tangent points reach the nearer neighbour), or 0. */
export function maxCornerRadiusM(w: GeomWall, index: number, W: number, H: number, scale: number): number {
  const { pts, bulges } = wallPx(w, W, H);
  let lo = 0;
  let hi = 1e6;
  if (!fillet(pts, bulges, index, 1e-6)) return 0;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (fillet(pts, bulges, index, mid)) lo = mid;
    else hi = mid;
  }
  return lo * scale;
}

/** A new wall: the arc from `a` to `b` through `through` (normalized points); a point on the line draws it straight. */
export function addArcWall(doc: GeometryDoc, a: Pt, b: Pt, through: Pt, defaults: WallDefaults, W: number, H: number): { doc: GeometryDoc; id: string } {
  const id = newId();
  const bulge = bulgeThrough(toPx(a, W, H), toPx(through, W, H), toPx(b, W, H));
  const base: GeomWall = { id, level_id: defaultLevelId(doc), polyline: [clampPt(a), clampPt(b)], thickness_m: defaults.thickness_m, height_m: null, base_z_m: 0,
    kind: defaults.kind, confidence: 1, source: 'manual', locked: false, external_ids: {} };
  return { doc: { ...doc, walls: [...doc.walls, withBulges(base, Math.abs(bulge) < 1e-4 ? undefined : [Math.round(bulge * 1e6) / 1e6])] }, id };
}

/** The segment of the wall nearest to p (normalized), by its drawn path; null when the wall has none. */
export function segmentAt(w: GeomWall, p: Pt, W: number, H: number): number | null {
  const { pts, bulges } = wallPx(w, W, H);
  if (pts.length < 2) return null;
  const q = toPx(p, W, H);
  let best: { seg: number; d: number } | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const hit = project([pts[i], pts[i + 1]], [bulges[i]], q);
    if (!best || hit.dist < best.d) best = { seg: i, d: hit.dist };
  }
  return best?.seg ?? null;
}

/** The middle of segment `seg` on its drawn path (normalized): where the bend handle sits. */
export function segmentMid(w: GeomWall, seg: number, W: number, H: number): Pt {
  const { pts, bulges } = wallPx(w, W, H);
  const a = pts[seg];
  const b = pts[seg + 1];
  const { p } = pointAtS([a, b], [bulges[seg]], pathLength([a, b], [bulges[seg]]) / 2);
  return [p[0] / W, p[1] / H];
}

/** Whether corner `index` of the wall is one a fillet can round (both sides straight, an inner corner or a closed
 * outline's corner). */
export function cornerRoundable(w: GeomWall, index: number, W: number, H: number): boolean {
  const { pts, bulges } = wallPx(w, W, H);
  return fillet(pts, bulges, index, 1e-6) !== null;
}
