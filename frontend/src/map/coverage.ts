/**
 * Coverage stopped by walls (T087, design 2a "כיסוי מצלמות", ruling R-P4-2): rays from a camera position, across its
 * field of view and up to its radius, against the walls of its level. What a ray hits first ends it - a wall, a window,
 * a closed door; a passage and a door whose entity is in an open state let it through. Planning information, not a
 * promise that nothing is hidden. Pure maths in plan pixels, used by the 2D canvas and by the 3D cone alike, so both
 * draw the same polygon; the SVG / PNG exports keep the unclipped cone (a known limit of this phase).
 *
 * Ruling R-P4-T2-1: only a state that describes the leaf opens a door for a ray (a door / cover "open" or "opening", a
 * binary door sensor "on"). A lock state says nothing about the leaf, so an "unlocked" door is still closed.
 *
 * A camera mounted on a wall (or anywhere inside a wall thickness) is not blinded by that wall: a segment whose centre
 * line is within half its thickness of the camera lets through every ray on the side the camera faces and stops every
 * ray behind it at the camera itself, so the cone neither vanishes nor leaks through the wall it hangs on.
 */
import { buildPrimitives, r2, type CatalogLookup, type GeometryDoc, type Pt } from './geometry';

export interface Seg {
  a: Pt;
  b: Pt;
  /** The full thickness of the wall in plan pixels (a gap takes the thickness of its wall); undefined = a thin line. */
  w?: number;
}

export interface CoverageMarker {
  x: number;
  y: number;
  rotation: number;
  fov: number;
  radiusPx: number;
  level: string;
}

/** Entity states that leave a door open for a ray (a door / cover open or opening, a binary door sensor on). */
export const OPEN_STATES: readonly string[] = ['open', 'opening', 'on'];
export const isOpenState = (state: string | null | undefined): boolean => !!state && OPEN_STATES.includes(state);

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const EPS = 1e-6;

export function hasWallsOnLevel(doc: Pick<GeometryDoc, 'walls'>, level: string): boolean {
  return doc.walls.some((w) => w.level_id === level && w.polyline.length >= 2);
}

/** The ids of the anchored doors that are open under `entityStates`, as a key: the only part of the states that changes
 * the blocking segments. */
export function doorStateKey(doc: Pick<GeometryDoc, 'openings'>, entityStates: Record<string, string | null>): string {
  return doc.openings
    .filter((o) => o.kind === 'door' && o.anchor_ref?.resource_type === 'ha_entity' && isOpenState(entityStates[o.anchor_ref.resource_id]))
    .map((o) => o.id)
    .join(',');
}

/** The segments that stop a ray on one level: every wall part (buildPrimitives already cuts the walls at their openings)
 * plus the gap of every opening that blocks - a window, and a door unless its entity is open. Openings of walls on other
 * levels never reach the primitives (their wall is filtered out), so no second level check is needed here. Objects,
 * labels and connectors never block, so they are left out of the primitives. */
export function blockingSegments(doc: GeometryDoc, W: number, H: number, level: string, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Seg[] {
  const out: Seg[] = [];
  const openings = new Map(doc.openings.map((o) => [o.id, o]));
  const wallWidth = new Map<string, number>();
  for (const p of buildPrimitives({ ...doc, objects: [], labels: [], connectors: [] }, W, H, level, catalog)) {
    if (p.kind === 'wall') {
      wallWidth.set(p.id, p.width);
      for (let i = 1; i < p.points.length; i++) out.push({ a: p.points[i - 1], b: p.points[i], w: p.width });
    } else if (p.kind === 'window' || p.kind === 'door') {
      const o = openings.get(p.id);
      if (p.kind === 'door') {
        const ref = o?.anchor_ref;
        if (ref && ref.resource_type === 'ha_entity' && isOpenState(entityStates[ref.resource_id])) continue;
      }
      out.push({ a: p.gap[0], b: p.gap[1], w: o ? wallWidth.get(o.wall_id) : undefined });
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

const unit = (bearingDeg: number): Pt => {
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  return [Math.cos(rad), Math.sin(rad)];
};

function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const len2 = ex * ex + ey * ey;
  const k = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + k * ex), p[1] - (a[1] + k * ey));
}

/** The coverage polygon in plan pixels: the origin first (unless the field is a full circle), then one point per ray
 * from `rotation - fov / 2` to `rotation + fov / 2` (bearing 0 = up, clockwise), each stopped by the nearest segment or
 * by the radius. `rays` defaults to one per degree (at least 24). Rounded half-up to 0.01 px like every primitive. A
 * segment the camera sits inside (within half its thickness) passes the rays on the side the camera faces and stops
 * the rays behind it at the origin; a camera facing exactly along such a segment is not stopped by it at all. */
export function clipCoverage(origin: Pt, rotationDeg: number, fovDeg: number, radiusPx: number, segs: Seg[], rays?: number): Pt[] {
  const fov = Math.max(1, Math.min(360, fovDeg));
  const n = Math.max(1, rays ?? Math.max(24, Math.ceil(fov)));
  const facing = unit(rotationDeg);
  const far: Seg[] = [];
  const inside: { nx: number; ny: number; side: number }[] = [];
  for (const s of segs) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    if (s.w && len > EPS && distanceToSegment(origin, s.a, s.b) <= s.w / 2 + EPS) {
      const nx = -(s.b[1] - s.a[1]) / len;
      const ny = (s.b[0] - s.a[0]) / len;
      inside.push({ nx, ny, side: facing[0] * nx + facing[1] * ny });
    } else far.push(s);
  }
  const pts: Pt[] = fov < 360 ? [[r2(origin[0]), r2(origin[1])]] : [];
  const last = fov < 360 ? n : n - 1; // a full circle: the last ray would repeat the first
  for (let i = 0; i <= last; i++) {
    const d = unit(rotationDeg - fov / 2 + (fov * i) / n);
    let t = radiusPx;
    for (const s of inside) {
      if (Math.abs(s.side) > 1e-9 && (d[0] * s.nx + d[1] * s.ny) * s.side < -1e-9) t = 0; // behind the wall it hangs on
    }
    for (const s of far) {
      if (t === 0) break;
      const hit = raySegment(origin, d, s.a, s.b);
      if (hit !== null && hit < t) t = hit;
    }
    pts.push([r2(origin[0] + d[0] * t), r2(origin[1] + d[1] * t)]);
  }
  return pts;
}

/** The clipped coverage of one marker in normalized plan units (5 decimals), the shape both the 2D canvas and the 3D
 * cone draw. `segs` lets a caller that already holds the blocking segments of the level (see CoverageCache) pass them. */
export function coveragePolygon(m: CoverageMarker, doc: GeometryDoc, W: number, H: number, entityStates: Record<string, string | null>, catalog?: CatalogLookup, segs?: Seg[]): Pt[] {
  const blocking = segs ?? blockingSegments(doc, W, H, m.level, entityStates, catalog);
  return clipCoverage([m.x * W, m.y * H], m.rotation, m.fov, m.radiusPx, blocking).map((p) => [round5(p[0] / W), round5(p[1] / H)]);
}

/** Memo for a view that draws many cameras: the blocking segments are shared per (level, open doors) and the polygon of
 * each camera is kept per id until its pose, radius, level or the open doors change. Both reset when the document object
 * (compared by identity, like the primitive cache of the canvas) or the plan size changes. The catalog is not part of
 * the key: objects never reach the blocking segments. */
export class CoverageCache {
  private base: { doc: GeometryDoc; W: number; H: number } | null = null;
  private segs = new Map<string, Seg[]>();
  private polys = new Map<string, { key: string; pts: Pt[] }>();

  private sync(doc: GeometryDoc, W: number, H: number): void {
    const b = this.base;
    if (b && b.doc === doc && b.W === W && b.H === H) return;
    this.base = { doc, W, H };
    this.segs.clear();
    this.polys.clear();
  }

  private segmentsFor(doc: GeometryDoc, W: number, H: number, level: string, doors: string, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Seg[] {
    const key = `${level}|${doors}`;
    let s = this.segs.get(key);
    if (!s) {
      s = blockingSegments(doc, W, H, level, entityStates, catalog);
      this.segs.set(key, s);
    }
    return s;
  }

  segments(doc: GeometryDoc, W: number, H: number, level: string, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Seg[] {
    this.sync(doc, W, H);
    return this.segmentsFor(doc, W, H, level, doorStateKey(doc, entityStates), entityStates, catalog);
  }

  /** The normalized polygon of camera `id` (the same array while nothing it depends on changed). */
  polygon(id: string, m: CoverageMarker, doc: GeometryDoc, W: number, H: number, entityStates: Record<string, string | null>, catalog?: CatalogLookup): Pt[] {
    this.sync(doc, W, H);
    const doors = doorStateKey(doc, entityStates);
    const key = `${m.x}|${m.y}|${m.rotation}|${m.fov}|${m.radiusPx}|${m.level}|${doors}`;
    const hit = this.polys.get(id);
    if (hit && hit.key === key) return hit.pts;
    const pts = coveragePolygon(m, doc, W, H, entityStates, catalog, this.segmentsFor(doc, W, H, m.level, doors, entityStates, catalog));
    this.polys.set(id, { key, pts });
    return pts;
  }
}
