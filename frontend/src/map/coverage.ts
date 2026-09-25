/**
 * Coverage stopped by walls (T087, design 2a "כיסוי מצלמות", ruling R-P4-2): rays from a camera position, across its
 * field of view and up to its radius, against the walls of its level. What a ray hits first ends it - a wall, a window,
 * a closed door; a passage and a door whose entity is in an open state let it through. Planning information, not a
 * promise that nothing is hidden. Pure maths in plan pixels, used by the 2D canvas and by the 3D cone alike, so both
 * draw the same polygon; the SVG / PNG exports keep the unclipped cone (a known limit of this phase).
 */
import { buildPrimitives, r2, type CatalogLookup, type GeometryDoc, type Pt } from './geometry';

export interface Seg {
  a: Pt;
  b: Pt;
}

export interface CoverageMarker {
  x: number;
  y: number;
  rotation: number;
  fov: number;
  radiusPx: number;
  level: string;
}

/** Entity states that leave a door open for a ray (lock unlocked, cover / door open, a binary door sensor on). */
export const OPEN_STATES: readonly string[] = ['open', 'opening', 'unlocked', 'on'];
export const isOpenState = (state: string | null | undefined): boolean => !!state && OPEN_STATES.includes(state);

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;

export function hasWallsOnLevel(doc: Pick<GeometryDoc, 'walls'>, level: string): boolean {
  return doc.walls.some((w) => w.level_id === level && w.polyline.length >= 2);
}

/** The segments that stop a ray on one level: every wall part (buildPrimitives already cuts the walls at their openings)
 * plus the gap of every opening that blocks - a window, and a door unless its entity is open. Openings of walls on other
 * levels never reach the primitives (their wall is filtered out), so no second level check is needed here. */
export function blockingSegments(doc: GeometryDoc, W: number, H: number, level: string, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Seg[] {
  const out: Seg[] = [];
  const openings = new Map(doc.openings.map((o) => [o.id, o]));
  for (const p of buildPrimitives(doc, W, H, level, catalog)) {
    if (p.kind === 'wall') {
      for (let i = 1; i < p.points.length; i++) out.push({ a: p.points[i - 1], b: p.points[i] });
    } else if (p.kind === 'window') {
      out.push({ a: p.gap[0], b: p.gap[1] });
    } else if (p.kind === 'door') {
      const ref = openings.get(p.id)?.anchor_ref;
      const open = !!ref && ref.resource_type === 'ha_entity' && isOpenState(entityStates[ref.resource_id]);
      if (!open) out.push({ a: p.gap[0], b: p.gap[1] });
    }
  }
  return out;
}

/** Distance along the ray (origin o, unit direction d) to the segment ab, or null when the ray misses it. */
export function raySegment(o: Pt, d: Pt, a: Pt, b: Pt): number | null {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const den = d[0] * ey - d[1] * ex;
  if (Math.abs(den) < 1e-12) return null;
  const wx = a[0] - o[0];
  const wy = a[1] - o[1];
  const t = (wx * ey - wy * ex) / den;
  const u = (wx * d[1] - wy * d[0]) / den;
  if (t < 0 || u < -1e-9 || u > 1 + 1e-9) return null;
  return t;
}

/** The coverage polygon in plan pixels: the origin first (unless the field is a full circle), then one point per ray
 * from `rotation - fov / 2` to `rotation + fov / 2` (bearing 0 = up, clockwise), each stopped by the nearest segment or
 * by the radius. `rays` defaults to one per degree (at least 24). Rounded half-up to 0.01 px like every primitive. */
export function clipCoverage(origin: Pt, rotationDeg: number, fovDeg: number, radiusPx: number, segs: Seg[], rays?: number): Pt[] {
  const fov = Math.max(1, Math.min(360, fovDeg));
  const n = Math.max(1, rays ?? Math.max(24, Math.ceil(fov)));
  const pts: Pt[] = fov < 360 ? [[r2(origin[0]), r2(origin[1])]] : [];
  const last = fov < 360 ? n : n - 1; // a full circle: the last ray would repeat the first
  for (let i = 0; i <= last; i++) {
    const bearing = rotationDeg - fov / 2 + (fov * i) / n;
    const rad = ((bearing - 90) * Math.PI) / 180;
    const d: Pt = [Math.cos(rad), Math.sin(rad)];
    let t = radiusPx;
    for (const s of segs) {
      const hit = raySegment(origin, d, s.a, s.b);
      if (hit !== null && hit < t) t = hit;
    }
    pts.push([r2(origin[0] + d[0] * t), r2(origin[1] + d[1] * t)]);
  }
  return pts;
}

/** The clipped coverage of one marker in normalized plan units (5 decimals), the shape both the 2D canvas and the 3D
 * cone draw. */
export function coveragePolygon(m: CoverageMarker, doc: GeometryDoc, W: number, H: number, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Pt[] {
  const segs = blockingSegments(doc, W, H, m.level, entityStates, catalog);
  return clipCoverage([m.x * W, m.y * H], m.rotation, m.fov, m.radiusPx, segs).map((p) => [round5(p[0] / W), round5(p[1] / H)]);
}
