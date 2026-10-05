/**
 * Plan Studio 6 prototype - a JavaScript port of the parts of frontend/src/map/geometry.ts and coverage.ts the
 * prototype needs: the effective scale, walls cut by their openings (buildPrimitives), the opening gaps, and the
 * blocking segments the walk-through collides with. Same conventions: plan space 0..1, plan pixels = fraction x
 * width_px, metres = pixels x scale. PROTOTYPE ONLY - the product keeps the TypeScript source of truth.
 */
export const DEFAULT_WALL_THICKNESS_M = 0.2;
export const ESTIMATED_WALL_FRACTION = 0.006;
export const OPEN_STATES = ['open', 'opening', 'on'];
export const isOpenState = (s) => !!s && OPEN_STATES.includes(s);

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function effectiveScale(doc) {
  const d = doc.dimensions;
  const s = d.scale_m_per_px;
  const st = d.calibration && d.calibration.status;
  if (typeof s === 'number' && Number.isFinite(s) && s > 0 && (st === 'measured' || st === 'estimated')) return { scale: s, estimated: st === 'estimated' };
  return { scale: DEFAULT_WALL_THICKNESS_M / (ESTIMATED_WALL_FRACTION * (d.width_px || 1000)), estimated: true };
}

export function cumulative(pts) {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return out;
}
export function pointAt(pts, cum, s) {
  let i = 0;
  while (i < pts.length - 2 && s > cum[i + 1]) i++;
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  const seg = cum[i + 1] - cum[i];
  if (seg <= 1e-9) return { p: [x0, y0], d: [1, 0] };
  const f = Math.min(1, Math.max(0, (s - cum[i]) / seg));
  return { p: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f], d: [(x1 - x0) / seg, (y1 - y0) / seg] };
}
function subPolyline(pts, cum, s0, s1) {
  const inner = [];
  for (let i = 1; i < pts.length - 1; i++) if (s0 < cum[i] && cum[i] < s1) inner.push(pts[i]);
  return [pointAt(pts, cum, s0).p, ...inner, pointAt(pts, cum, s1).p];
}
const extend = (p, q, by) => {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const n = Math.hypot(dx, dy);
  return n < 1e-9 ? p : [p[0] + (dx / n) * by, p[1] + (dy / n) * by];
};
const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];

/**
 * Walls cut by their openings and the opening gaps, in PLAN PIXELS (the geometry.ts algorithm). Returns
 * { walls: [{ id, part, points, width, wall }], openings: [{ opening, wall, c, d, g0, g1, w }] }.
 */
export function buildStructure(doc, W, H, level) {
  const { scale } = effectiveScale(doc);
  const pxPerM = 1 / scale;
  const byWall = new Map();
  for (const o of doc.openings) {
    const b = byWall.get(o.wall_id);
    if (b) b.push(o);
    else byWall.set(o.wall_id, [o]);
  }
  const walls = [];
  const geo = new Map();
  for (const w of [...new Map(doc.walls.map((x) => [x.id, x])).values()].sort(byId)) {
    if (level !== null && level !== undefined && w.level_id !== level) continue;
    const pts = w.polyline.map((p) => [p[0] * W, p[1] * H]);
    const cum = cumulative(pts);
    const total = cum[cum.length - 1];
    if (total <= 1e-6) continue;
    const wpx = Math.max(1, (w.thickness_m || DEFAULT_WALL_THICKNESS_M) * pxPerM);
    geo.set(w.id, { pts, cum, wpx, wall: w });
    const cuts = (byWall.get(w.id) || []).map((o) => {
      const c = (o.t || 0) * total;
      const half = ((o.width_m || 0) * pxPerM) / 2;
      return [Math.max(0, c - half), Math.min(total, c + half)];
    });
    cuts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const keep = [];
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
      walls.push({ id: w.id, part, points: seg, width: wpx, wall: w });
      part += 1;
    }
  }
  const openings = [];
  for (const o of [...doc.openings].sort(byId)) {
    const g = geo.get(o.wall_id);
    if (!g) continue;
    const { p: c, d } = pointAt(g.pts, g.cum, (o.t || 0) * g.cum[g.cum.length - 1]);
    const w = (o.width_m || 0) * pxPerM;
    openings.push({ opening: o, wall: g.wall, c, d, g0: add(c, d, -w / 2), g1: add(c, d, w / 2), w, wpx: g.wpx });
  }
  return { walls, openings, scale };
}

/** Collision / ray segments of one level in plan pixels: every wall part, every window gap, and every door gap whose
 * entity is not open (a door without an entity is passable - CR-029 Q4 default). */
export function blockingSegments(doc, W, H, level, entityStates, opts = {}) {
  const { walls, openings } = buildStructure(doc, W, H, level);
  const out = [];
  for (const p of walls) {
    if (opts.bodyOnly === false && (p.wall.kind === 'railing' || p.wall.kind === 'low')) continue;
    for (let i = 1; i < p.points.length; i++) out.push({ a: p.points[i - 1], b: p.points[i], w: p.width, kind: p.wall.kind, id: p.id });
  }
  for (const o of openings) {
    const k = o.opening.kind;
    if (k === 'passage') continue;
    if (k === 'door') {
      const ref = o.opening.anchor_ref;
      const state = ref && ref.resource_type === 'ha_entity' ? entityStates[ref.resource_id] : undefined;
      if (!ref) continue; // unsensed door: passable
      if (isOpenState(state)) continue;
      const lock = opts.locks && opts.locks[o.opening.id];
      void lock;
    }
    out.push({ a: o.g0, b: o.g1, w: o.wpx, kind: k, id: o.opening.id });
  }
  return out;
}

/** Point-in-polygon (plan or metre space, any closed ring). */
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) return [poly[0][0], poly[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}

/** An open polyline offset to a closed outline of half-width h with mitered joins (limit 4h): the wall's footprint. */
export function outlinePolyline(pts, h) {
  const n = pts.length;
  if (n < 2) return [];
  const dirs = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dy) || 1;
    dirs.push([dx / l, dy / l]);
  }
  const side = (sign) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const d0 = dirs[Math.max(0, i - 1)];
      const d1 = dirs[Math.min(n - 2, i)];
      const n0 = [-d0[1] * sign, d0[0] * sign];
      const n1 = [-d1[1] * sign, d1[0] * sign];
      const mx = n0[0] + n1[0], my = n0[1] + n1[1];
      const ml = Math.hypot(mx, my);
      if (ml < 1e-6) {
        out.push([pts[i][0] + n1[0] * h, pts[i][1] + n1[1] * h]);
        continue;
      }
      const cosHalf = (mx * n1[0] + my * n1[1]) / ml;
      let k = h / Math.max(cosHalf, 0.25);
      out.push([pts[i][0] + (mx / ml) * k, pts[i][1] + (my / ml) * k]);
    }
    return out;
  };
  const left = side(1);
  const right = side(-1).reverse();
  return [...left, ...right];
}
