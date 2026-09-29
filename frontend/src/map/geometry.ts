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
  /** CR-009: an item of a room another floor owns, attached on read (map/shared-space.ts); never stored here. */
  shared?: import('./shared-space').SharedItemMark;
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
  /** Free-text tags for marking and selection (T085; at most TAG_MAX_COUNT of TAG_MAX_LEN characters). Absent = none. */
  tags?: string[];
  /** Detector 1.3 (T087): a detected wall drawn as two thin lines with white between (hollow_v1); every detected wall
   * carries it, the editor does not draw it differently yet. Absent on hand-drawn and older walls. */
  hollow?: boolean;
  /** CR-009: an item of a room another floor owns, attached on read (map/shared-space.ts); never stored here. */
  shared?: import('./shared-space').SharedItemMark;
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
  /** CR-009: an item of a room another floor owns, attached on read (map/shared-space.ts); never stored here. */
  shared?: import('./shared-space').SharedItemMark;
}
export interface GeomLabel {
  id: string;
  text: string;
  position: Pt;
  level_id: string;
  size: number;
  /** CR-009: an item of a room another floor owns, attached on read (map/shared-space.ts); never stored here. */
  shared?: import('./shared-space').SharedItemMark;
  /** CR-009 (re-review N3): explicit content of the shared space with this home zone id - needed for an item outside the
   * room's home outline (under the upper level only); set by the server when drawn there from the other floor, and by
   * the home floor's editor with "חלק מהחלל המשותף". */
  shared_space_id?: string;
}
export type ObjectShape = 'box' | 'cylinder' | 'extruded_polygon' | 'stepped' | 'composite';
export type ConnectorKind = 'stairs' | 'ramp' | 'tribune' | 'elevator' | 'ladder';
export type GroupKind = 'array' | 'manual';
export interface GeomSize {
  w_m: number;
  d_m: number;
  h_m: number;
}
/** An object from the library (T085): position 0..1, sizes in metres. With `anchor_ref` it is the body of that anchor:
 * the server refreshes its position from the anchor on save and publish, the maps override it live. */
export interface GeomObject {
  id: string;
  item_id: string;
  level_id: string;
  position: Pt;
  rotation_deg: number;
  size: GeomSize;
  z_m: number;
  params: Record<string, unknown>;
  label: string | null;
  anchor_ref: AnchorRef | null;
  group_id: string | null;
  confidence: number;
  source: GeomSource;
  locked: boolean;
  external_ids?: ExternalIds;
  /** Free-text tags, as a wall's (T085). */
  tags?: string[];
  /** CR-009: an item of a room another floor owns, attached on read (map/shared-space.ts); never stored here. */
  shared?: import('./shared-space').SharedItemMark;
  /** CR-009 (re-review N3): explicit content of the shared space with this home zone id - needed for an item outside the
   * room's home outline (under the upper level only); set by the server when drawn there from the other floor, and by
   * the home floor's editor with "חלק מהחלל המשותף". */
  shared_space_id?: string;
}
export interface GeomGroup {
  id: string;
  kind: GroupKind;
  member_ids: string[];
  params: Record<string, unknown>;
  label?: string | null;
  /** CR-009: an item of a room another floor owns, attached on read (map/shared-space.ts); never stored here. */
  shared?: import('./shared-space').SharedItemMark;
}
/** Stairs with a landing (T085, owner 2026-09-29): the run's shape - straight, a quarter turn "L", a half turn "U". */
export type StairShape = 'straight' | 'l' | 'u';
export type StairTurn = 'left' | 'right' | 'none';
export interface StairFlight {
  steps: number;
}
/** What the server computes on every read of a connector to another floor (geometry_store.attach_far, never stored):
 * the other floor's name ("קומה אחרת" for a reader who may not read it), the level it reaches there and that level's
 * elevation, the other floor's datum above this one (the floor heights between, signed) and whether it is above or
 * below; missing = the floor was deleted. */
export interface ConnectorFar {
  floor_id: string;
  floor_name: string | null;
  level_name: string | null;
  direction: 'up' | 'down' | null;
  level_elevation_m?: number | null;
  datum_m?: number | null;
  missing?: boolean;
}
export interface GeomConnector {
  id: string;
  kind: ConnectorKind;
  level_from: string;
  /** Same floor: the other level of this floor. To another floor (floor_ids set): the level it reaches THERE. */
  level_to: string | null;
  floor_ids: string[];
  polyline: Pt[];
  width_m: number;
  label: string | null;
  /** Set on a connector the server derived from an object (a tribune): regenerated on every save, not editable. */
  object_id: string | null;
  source: GeomSource;
  external_ids?: ExternalIds;
  /** The stairs model (T085), all optional - absent = the plain band along the polyline. The polyline is the walking
   * line: straight [start, end], L [start, landing centre, end], U [start, landing on flight 1's axis, landing on
   * flight 2's axis, end]. */
  shape?: StairShape | null;
  turn?: StairTurn | null;
  flights?: StairFlight[] | null;
  landing_depth_m?: number | null;
  /** Server-maintained on a connector to another floor. */
  far?: ConnectorFar | null;
  /** A twin placed at the centre of a plan that shares no frame with the other floor: waits to be moved into place. */
  needs_placement?: boolean;
  /** The floor a cross-floor link was made from: only there can the link move to another floor. */
  origin_floor_id?: string;
  /** The twin's path was regenerated by a model change on the other floor: "ודא את המיקום" until moved or confirmed. */
  check_placement?: boolean;
  /** CR-009: an item of a room another floor owns, attached on read (map/shared-space.ts); never stored here. */
  shared?: import('./shared-space').SharedItemMark;
  /** CR-009 (re-review N3): explicit content of the shared space with this home zone id - needed for an item outside the
   * room's home outline (under the upper level only); set by the server when drawn there from the other floor, and by
   * the home floor's editor with "חלק מהחלל המשותף". */
  shared_space_id?: string;
}
export interface GeomCircuit {
  id: string;
  name: string;
  switch_entity_id: string;
  member_ids: string[];
  color_token: string;
  power_w: number;
  /** CR-009: an item of a room another floor owns, attached on read (map/shared-space.ts); never stored here. */
  shared?: import('./shared-space').SharedItemMark;
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
  rooms: { id: string; level_id?: string | null; ceiling_height_m?: number | null; tags?: string[] }[];
  objects: GeomObject[];
  circuits: GeomCircuit[];
  connectors: GeomConnector[];
  labels: GeomLabel[];
  groups: GeomGroup[];
  uncertain_regions: unknown[];
  uncertainty: { overall: number; notes: string[] };
  meta: { generator: string; tokens_version: string; detector_version: string | null };
  /** The floor's height, floor to floor (T085, owner 2026-09-29): absent = DEFAULT_FLOOR_HEIGHT_M. */
  floor_height_m?: number;
  /** CR-009: the rooms this floor shares with other floors, computed by the server on every read and never stored
   * (map/shared-space.ts). A room another floor owns arrives as items of this document, each marked `shared`. */
  shared_spaces?: import('./shared-space').SharedSpaceEntry[];
}

export interface WallPrim { kind: 'wall'; id: string; part: number; points: Pt[]; width: number }
export interface DoorPrim { kind: 'door'; id: string; gap: [Pt, Pt]; leaves: [Pt, Pt][]; arcs: { from: Pt; to: Pt; r: number; sweep: 0 | 1 }[] }
export interface WindowPrim { kind: 'window'; id: string; gap: [Pt, Pt]; lines: [Pt, Pt][] }
export interface PassagePrim { kind: 'passage'; id: string; gap: [Pt, Pt] }
export interface LabelPrim { kind: 'label'; id: string; x: number; y: number; text: string; size: number }
export interface ConnectorPrim { kind: 'connector'; id: string; ckind: ConnectorKind; points: Pt[]; width: number; arrow: { from: Pt; to: Pt }; label: string; lx: number; ly: number; level_from: string; level_to: string | null }
export interface ObjectPrim { kind: 'object'; id: string; item_id: string; shape: ObjectShape; icon: string; color: string; level_id: string; cx: number; cy: number; w: number; h: number; rotation: number; corners: Pt[]; label: string | null; circuit_id: string | null; anchor: string | null; steps: [Pt, Pt][] }
export type Primitive = WallPrim | DoorPrim | WindowPrim | PassagePrim | LabelPrim | ConnectorPrim | ObjectPrim;

/** The 24 symbol ids of the library (plan-symbols.ts draws them; the export draws the same ids). */
export const SYMBOL_IDS = ['box', 'cylinder', 'chair', 'table', 'sofa', 'bed', 'cabinet', 'lamp', 'panel', 'socket', 'extinguisher', 'smoke', 'exit', 'aed', 'medical', 'goal', 'mat', 'stairs', 'elevator', 'doorstation', 'tree', 'sanitary', 'office', 'parking'] as const;
export type SymbolId = (typeof SYMBOL_IDS)[number];
export const OBJECT_SHAPES: readonly ObjectShape[] = ['box', 'cylinder', 'extruded_polygon', 'stepped', 'composite'];
export const COLOR_TOKENS = ['object', 'structure', 'circulation', 'furniture', 'light', 'electrical', 'safety', 'medical', 'sport', 'sanitary', 'security', 'outdoor'] as const;
/** The circuit colours (tokens.css --sw-circuit-1..6). A circuit's color_token is a document string: the maps turn it
 * into a CSS variable name only through circuitToken, so nothing else ever reaches an inline style. */
export const CIRCUIT_TOKENS = ['circuit-1', 'circuit-2', 'circuit-3', 'circuit-4', 'circuit-5', 'circuit-6'] as const;
export const circuitToken = (token: unknown): (typeof CIRCUIT_TOKENS)[number] | null =>
  typeof token === 'string' && (CIRCUIT_TOKENS as readonly string[]).includes(token) ? (token as (typeof CIRCUIT_TOKENS)[number]) : null;
/** What the renderer needs from the library for one item. */
export interface CatalogShape {
  shape: ObjectShape;
  icon: string;
  color_token: string;
}
export type CatalogLookup = (itemId: string) => CatalogShape | undefined;
export interface AnchorPosition {
  x: number;
  y: number;
  rotation: number;
}
export const ARROW_PX = 14;
/** tribune.stepped's params_schema cap (catalog/objects.json): a saved rows value above it still draws, capped, never
 * an unbounded loop. Mirrors the backend's MAX_TRIBUNE_ROWS (services/plan_geometry_render.py). */
export const MAX_TRIBUNE_ROWS = 60;

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
  // a double or sliding door has no hinge jamb to choose: its hinge field picks the side of the wall instead
  // (start = the left normal, the default; end = the right normal) - owner request 2026-09-26
  const side = (o.hinge || 'start') === 'start' ? nl : nr;
  if (swing === 'sliding') {
    const k = w * 0.12;
    return { leaves: [[rp(add(g0, side, k)), rp(add(g1, side, k))]], arcs: [] };
  }
  if (swing === 'double') {
    const h = w / 2;
    const leaves: [Pt, Pt][] = [];
    const arcs: DoorPrim['arcs'] = [];
    const pairs: [Pt, Pt][] = [[g0, d], [g1, [-d[0], -d[1]]]];
    for (const [hinge, along] of pairs) {
      const tip = add(hinge, side, h);
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
export function buildPrimitives(doc: GeometryDoc, width: number, height: number, level: string | null = null, catalog?: CatalogLookup): Primitive[] {
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
    if (level !== null && w.level_id !== level && !w.shared) continue; // CR-009: a shared room shows on every level filter
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
    if (level !== null && lb.level_id !== level && !lb.shared) continue;
    prims.push({ kind: 'label', id: lb.id, x: r2(lb.position[0] * width), y: r2(lb.position[1] * height), text: String(lb.text ?? ''), size: r2(lb.size || 14) });
  }
  const levels = new Map<string, GeomLevel>(doc.levels.map((l) => [l.id, l]));
  for (const c of [...doc.connectors].sort(byId)) {
    const pts: Pt[] = c.polyline.map((p) => [p[0] * width, p[1] * height]);
    if (pts.length < 2) continue;
    const cum = cumulative(pts);
    const total = cum[cum.length - 1];
    if (total <= 1e-6) continue;
    const tail = pointAt(pts, cum, Math.max(0, total - Math.min(ARROW_PX, total))).p;
    const mid = pointAt(pts, cum, total / 2).p;
    prims.push({ kind: 'connector', id: c.id, ckind: c.kind || 'stairs', points: pts.map(rp), width: r2(Math.max(1, (c.width_m || 1) * pxPerM)), arrow: { from: rp(tail), to: rp(pts[pts.length - 1]) },
      label: connectorLabel(levels, c), lx: r2(mid[0]), ly: r2(mid[1]), level_from: c.level_from, level_to: c.level_to ?? null });
  }
  const circuitOf = new Map<string, string>();
  for (const k of [...doc.circuits].sort(byId)) for (const mid of k.member_ids) if (!circuitOf.has(mid)) circuitOf.set(mid, k.id);
  for (const o of [...doc.objects].sort(byId)) {
    if (level !== null && o.level_id !== level && !o.shared) continue;
    const item = catalog?.(o.item_id);
    const shape: ObjectShape = item && OBJECT_SHAPES.includes(item.shape) ? item.shape : 'box';
    const cx = o.position[0] * width;
    const cy = o.position[1] * height;
    const hw = ((o.size?.w_m || 0.05) * pxPerM) / 2;
    const hd = ((o.size?.d_m || 0.05) * pxPerM) / 2;
    const rot = o.rotation_deg || 0;
    const theta = (rot * Math.PI) / 180;
    const corners: Pt[] = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => rp(rotated(cx, cy, sx * hw, sy * hd, theta)));
    const steps: [Pt, Pt][] = [];
    const rows = o.params?.rows;
    if (shape === 'stepped' && typeof rows === 'number' && Number.isInteger(rows) && rows >= 2) {
      const cappedRows = Math.min(rows, MAX_TRIBUNE_ROWS);
      for (let i = 1; i < cappedRows; i++) {
        const y = -hd + (2 * hd * i) / cappedRows;
        steps.push([rp(rotated(cx, cy, -hw, y, theta)), rp(rotated(cx, cy, hw, y, theta))]);
      }
    }
    const ref = o.anchor_ref;
    prims.push({ kind: 'object', id: o.id, item_id: String(o.item_id ?? ''), shape, icon: item && (SYMBOL_IDS as readonly string[]).includes(item.icon) ? item.icon : 'box',
      color: item && (COLOR_TOKENS as readonly string[]).includes(item.color_token) ? item.color_token : 'object', level_id: o.level_id, cx: r2(cx), cy: r2(cy), w: r2(hw * 2), h: r2(hd * 2),
      rotation: r2(rot), corners, label: o.label || null, circuit_id: circuitOf.get(o.id) ?? null, anchor: ref && ref.resource_id ? `${ref.resource_type}:${ref.resource_id}` : null, steps });
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

/** The point at relative position t (0..1 of the length) along a wall, in normalized plan space. */
export function pointOnWall(wall: GeomWall, t: number, W: number, H: number): Pt {
  const pts: Pt[] = wall.polyline.map((v) => [v[0] * W, v[1] * H]);
  const cum = cumulative(pts);
  const { p } = pointAt(pts, cum, Math.min(1, Math.max(0, t)) * cum[cum.length - 1]);
  return [p[0] / W, p[1] / H];
}

/** A closed outline: a wall drawn back onto its first point (at least three corners); its last point is the first one. */
export function isClosedOutline(polyline: Pt[]): boolean {
  const n = polyline.length;
  return n >= 4 && polyline[0][0] === polyline[n - 1][0] && polyline[0][1] === polyline[n - 1][1];
}

// ---------------------------------------------------------------- objects and connectors (phase 2)

/** A footprint-local offset (x right, y down) turned by theta around the centre: clockwise on screen (y points down). */
export function rotated(cx: number, cy: number, x: number, y: number, theta: number): Pt {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [cx + x * c - y * s, cy + x * s + y * c];
}

/** The order of the objects' press targets (SVG presses the last one first). Objects draw by id, which is random, so a
 * chair placed on a tribune could lie under the tribune's target and a press on it would drag the tribune: the targets go
 * from the largest footprint to the smallest (ties keep the drawing order), and the selected object comes last, so a
 * press on it always takes it. Returns a new list. */
export function objectHitOrder(objects: readonly ObjectPrim[], selectedId: string | null): ObjectPrim[] {
  const ranked = objects.map((o, i) => ({ o, i, area: o.w * o.h, sel: o.id === selectedId ? 1 : 0 }));
  ranked.sort((a, b) => a.sel - b.sel || b.area - a.area || a.i - b.i);
  return ranked.map((r) => r.o);
}

/** The corners of an object's hit area in plan pixels: its footprint, widened to at least `minSide` along each of its
 * own axes around its centre (hotfix 0.1.87: a small object zoomed out was a few pixels wide and hard to press). */
export function objectHitCorners(o: Pick<ObjectPrim, 'cx' | 'cy' | 'w' | 'h' | 'rotation' | 'corners'>, minSide: number): Pt[] {
  if (o.w >= minSide && o.h >= minSide) return o.corners;
  const hw = Math.max(o.w, minSide) / 2;
  const hh = Math.max(o.h, minSide) / 2;
  const theta = ((o.rotation || 0) * Math.PI) / 180;
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => rotated(o.cx, o.cy, sx * hw, sy * hh, theta));
}

/** The four corners of an object's footprint in plan pixels (not rounded): the hit area and the handles. */
export function objectCorners(o: Pick<GeomObject, 'position' | 'rotation_deg' | 'size'>, W: number, H: number, scale: number): Pt[] {
  const cx = o.position[0] * W;
  const cy = o.position[1] * H;
  const hw = (o.size.w_m / scale) / 2;
  const hd = (o.size.d_m / scale) / 2;
  const theta = ((o.rotation_deg || 0) * Math.PI) / 180;
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => rotated(cx, cy, sx * hw, sy * hd, theta));
}

/** "↑ קומה 1 · גלריה": a connector to another floor names the floor and the level it reaches there (its `far`), the
 * arrow up or down by the floors' numbers, "↔" when equal or unknown; without a far record only "↕". Mirrors the
 * backend's cross_floor_label. */
export function crossFloorLabel(c: Partial<Pick<GeomConnector, 'far'>>): string {
  const far = c.far;
  if (!far || !far.floor_name) return '↕';
  const arrow = far.direction === 'up' ? '↑' : far.direction === 'down' ? '↓' : '↔';
  return far.level_name ? `${arrow} ${far.floor_name} · ${far.level_name}` : `${arrow} ${far.floor_name}`;
}

/** "↓ −1.2 מ׳": the arrow and the signed elevation difference from level_from to level_to; the connector's own label
 * wins; a connector to another floor (floor_ids set) names that floor and level (crossFloorLabel); one whose target is
 * not chosen yet shows the two-way arrow (a freshly drawn connector starts that way). Two levels at the same elevation
 * show "↕" too - there is no up or down to point. The magnitude rounds half-up to 0.1 m (the project's r2 rule, scaled),
 * not JavaScript's banker-adjacent rounding quirks: matches the backend's connector_label exactly. */
export function connectorLabel(levels: Map<string, GeomLevel>, c: Pick<GeomConnector, 'level_from' | 'level_to' | 'label'> & Partial<Pick<GeomConnector, 'floor_ids' | 'far'>>): string {
  if (c.label) return c.label;
  if (c.floor_ids && c.floor_ids.length) return crossFloorLabel(c);
  const a = levels.get(c.level_from);
  const b = c.level_to ? levels.get(c.level_to) : undefined;
  if (!a || !b) return '↕';
  const delta = b.elevation_m - a.elevation_m;
  if (delta === 0) return '↕';
  const d = Math.floor(Math.abs(delta) * 10 + 0.5) / 10;
  return `${delta < 0 ? '↓' : '↑'} ${delta < 0 ? '−' : '+'}${d.toFixed(1)} מ׳`;
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** The body follows its anchor: an object whose anchor_ref names a key of `positions` ("<type>:<id>") takes the anchor's
 * position and rotation. The maps run it with the live anchors they hold; the server does the same on save and publish. */
export function applyAnchorPositions(doc: GeometryDoc, positions: Record<string, AnchorPosition>): GeometryDoc {
  let changed = false;
  const objects = doc.objects.map((o) => {
    const ref = o.anchor_ref;
    const a = ref ? positions[`${ref.resource_type}:${ref.resource_id}`] : undefined;
    if (!a) return o;
    changed = true;
    return { ...o, position: [round6(a.x), round6(a.y)] as Pt, rotation_deg: Math.round((a.rotation || 0) * 1000) / 1000 };
  });
  return changed ? { ...doc, objects } : doc;
}

// ---------------------------------------------------------------- stairs with a landing (T085, owner 2026-09-29)
//
// Drawing convention (architectural floor plans; e.g. gridsnap.app/guides/stair-symbols, Wikipedia "Dog-leg (stairs)"):
// each flight is a rectangle with a line at every riser, the landing a plain rectangle, a walking line along the centre
// of the run from a start dot to an arrow that points the way up, and a diagonal break line across the first flight
// where the plan's cut plane passes (about 1.2 m up). A half-turn "U" (dog-leg) has two parallel flights side by side
// joined by a landing that spans both; a quarter-turn "L" turns 90 degrees on a square landing.

export const STAIR_GOING_M = 0.28; // a typical tread depth
export const STAIR_WELL_M = 0.1; // the gap between the two flights of a U
export const STAIR_FALLBACK_RISE_M = 3.0; // a stair with no target yet, or a far record without a datum
export const DEFAULT_FLOOR_HEIGHT_M = 3.0;
export const FLOOR_HEIGHT_RANGE: readonly [number, number] = [2.2, 12];

/** The document's floor-to-floor height, or the default when absent or out of range (plan_geometry.floor_height). */
export function floorHeight(doc: Pick<GeometryDoc, 'floor_height_m'>): number {
  const h = doc.floor_height_m;
  return typeof h === 'number' && Number.isFinite(h) && h >= FLOOR_HEIGHT_RANGE[0] && h <= FLOOR_HEIGHT_RANGE[1] ? h : DEFAULT_FLOOR_HEIGHT_M;
}
export const MAX_STAIR_STEPS = 60;
export const STAIR_WIDTH_RANGE: readonly [number, number] = [0.6, 5];
export const LANDING_RANGE: readonly [number, number] = [0.3, 10];
export const STAIR_POINTS: Record<StairShape, number> = { straight: 2, l: 3, u: 4 };
export const STAIR_SHAPE_LABEL: Record<StairShape, string> = { straight: 'ישר', l: 'L', u: 'U' };

/** Whether a connector carries the stairs model (any of shape, flights, landing depth); else it draws as a band. */
export function hasStairModel(c: Pick<GeomConnector, 'shape' | 'flights' | 'landing_depth_m'>): boolean {
  return !!c.shape || (Array.isArray(c.flights) && c.flights.length > 0) || typeof c.landing_depth_m === 'number';
}

/** The side the walking line turns to at its first corner (plan y points down: a positive cross product is a right
 * turn); null for a straight line. Mirrors geometry_store._turn_of. */
export function turnOf(points: Pt[]): 'left' | 'right' | null {
  if (points.length < 3) return null;
  const [[x0, y0], [x1, y1], [x2, y2]] = points;
  const cross = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1);
  return Math.abs(cross) < 1e-12 ? null : cross > 0 ? 'right' : 'left';
}

/** "12+12 מדרגות · פודסט", "16 מדרגות": the steps per flight and whether there is a landing. */
export function stairCaption(c: Pick<GeomConnector, 'flights' | 'shape'>): string {
  const f = (c.flights ?? []).map((x) => x.steps);
  if (!f.length) return '';
  const landing = f.length > 1 || c.shape === 'l' || c.shape === 'u';
  return `${f.join('+')} מדרגות${landing ? ' · פודסט' : ''}`;
}

export interface StairSpec {
  shape: StairShape;
  /** The start of the first flight, normalized 0..1. */
  start: Pt;
  /** The direction of the first flight, a vector in plan pixels (any length). */
  dir: Pt;
  width_m: number;
  /** The run of each flight in metres (one entry = one flight; a straight stair with two = a mid landing). */
  runs_m: number[];
  landing_m: number;
  turn: 'left' | 'right';
}

const unit = (v: Pt): Pt => {
  const n = Math.hypot(v[0], v[1]);
  return n < 1e-12 ? [0, -1] : [v[0] / n, v[1] / n];
};
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
/** The right-hand normal of a direction on screen (y down): up (0, -1) -> right (1, 0). */
const rightOf = (f: Pt): Pt => [-f[1], f[0]];

/** The walking line of a stair from its start, direction, width, flight runs, landing depth and turn - normalized
 * points in the polyline convention above. The U's second flight runs back parallel to the first, one width plus the
 * well beside it; the L's leaves the square landing at a right angle. Points are clamped into the plan. */
export function stairPath(o: StairSpec, W: number, H: number, scale: number): Pt[] {
  const k = 1 / scale;
  const f = unit(o.dir);
  const r = rightOf(f);
  const s: Pt = o.turn === 'left' ? [-r[0], -r[1]] : r;
  const p0: Pt = [o.start[0] * W, o.start[1] * H];
  const r1 = (o.runs_m[0] ?? STAIR_GOING_M) * k;
  const r2 = (o.runs_m[1] ?? 0) * k;
  const w = o.width_m * k;
  const D = (o.shape === 'l' ? Math.max(o.landing_m, o.width_m) : o.landing_m) * k; // an L turns on a landing at least as deep as the stair is wide
  let pts: Pt[];
  if (o.shape === 'u') {
    const p1 = add(p0, f, r1 + D / 2);
    const p2 = add(p1, s, w + STAIR_WELL_M * k);
    pts = [p0, p1, p2, add(p2, f, -(D / 2 + r2))];
  } else if (o.shape === 'l') {
    const p1 = add(p0, f, r1 + D / 2);
    pts = [p0, p1, add(p1, s, w / 2 + r2)];
  } else {
    pts = [p0, add(p0, f, r1 + (o.runs_m.length > 1 ? D + r2 : 0))];
  }
  return pts.map((p) => [clamp01(r6(p[0] / W)), clamp01(r6(p[1] / H))]);
}

export interface StairFlightPlan {
  from: Pt;
  to: Pt;
  steps: number;
  /** The flight's rectangle. */
  outline: Pt[];
  /** A line across the flight at every inner riser (steps - 1 lines). */
  treads: [Pt, Pt][];
}
/** A stair in plan pixels: its flights, landings, the walking line (the polyline) and the break line. */
export interface StairPlan {
  shape: StairShape;
  flights: StairFlightPlan[];
  landings: Pt[][];
  walk: Pt[];
  breakLine: [Pt, Pt] | null;
  caption: string;
}

function flightPlan(a: Pt, b: Pt, w: number, steps: number): StairFlightPlan {
  const d = unit(sub(b, a));
  const n = rightOf(d);
  const h = w / 2;
  const outline: Pt[] = [add(a, n, h), add(b, n, h), add(b, n, -h), add(a, n, -h)].map(rp);
  const treads: [Pt, Pt][] = [];
  for (let i = 1; i < steps; i++) {
    const c: Pt = [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps];
    treads.push([rp(add(c, n, h)), rp(add(c, n, -h))]);
  }
  return { from: rp(a), to: rp(b), steps, outline, treads };
}

/** The steps of each flight: the stored flights, else one flight of run / going steps. */
function flightSteps(c: Pick<GeomConnector, 'flights'>, fallbackRuns: number[], scale: number): number[] {
  const f = (c.flights ?? []).map((x) => Math.max(1, Math.min(MAX_STAIR_STEPS, Math.round(x.steps || 1))));
  if (f.length) return f;
  return fallbackRuns.map((px) => Math.max(1, Math.min(MAX_STAIR_STEPS, Math.round((px * scale) / STAIR_GOING_M))));
}

/** The drawing of a connector with the stairs model, in plan pixels; null when it has none or its polyline does not
 * fit its shape (then the plain band draws, as for any connector). `descending`: the stair goes down from this level
 * (the plan shows all of it, looked down on) - no break line (review L5). An L's landing is at least as deep as the
 * stair is wide (review L6). */
export function stairPlan(c: GeomConnector, W: number, H: number, scale: number, opts: { descending?: boolean } = {}): StairPlan | null {
  if (!hasStairModel(c)) return null;
  const shape: StairShape = c.shape === 'l' || c.shape === 'u' ? c.shape : 'straight';
  const pts: Pt[] = c.polyline.map((p) => [p[0] * W, p[1] * H]);
  if (pts.length !== STAIR_POINTS[shape]) return null;
  const k = 1 / scale;
  const w = Math.max(1, (c.width_m || 1) * k);
  const D = Math.max(1, (shape === 'l' ? Math.max(c.landing_depth_m ?? c.width_m ?? 1, c.width_m || 1) : c.landing_depth_m ?? c.width_m ?? 1) * k);
  const flights: StairFlightPlan[] = [];
  const landings: Pt[][] = [];
  if (shape === 'straight') {
    const [p0, p1] = pts;
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (L < 1e-6) return null;
    const f = unit(sub(p1, p0));
    const n = rightOf(f);
    const two = (c.flights?.length ?? 0) >= 2 && L > D;
    const steps = flightSteps(c, two ? [(L - D) / 2, (L - D) / 2] : [L], scale);
    if (two) {
      const r1 = ((L - D) * steps[0]) / (steps[0] + steps[1]);
      const a2 = add(p0, f, r1 + D);
      flights.push(flightPlan(p0, add(p0, f, r1), w, steps[0]), flightPlan(a2, p1, w, steps[1]));
      const l0 = add(p0, f, r1);
      landings.push([add(l0, n, w / 2), add(a2, n, w / 2), add(a2, n, -w / 2), add(l0, n, -w / 2)].map(rp));
    } else flights.push(flightPlan(p0, p1, w, steps[0]));
  } else {
    const [p0, p1, p2] = pts;
    const f1 = unit(sub(p1, p0));
    const s = unit(sub(p2, p1));
    const len1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const b1 = add(p0, f1, Math.max(0, len1 - D / 2));
    if (shape === 'u') {
      const p3 = pts[3];
      const f3 = unit(sub(p3, p2));
      const len3 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
      const a2 = add(p2, f3, Math.min(len3, D / 2));
      const steps = flightSteps(c, [Math.max(0, len1 - D / 2), Math.max(0, len3 - D / 2)], scale);
      flights.push(flightPlan(p0, b1, w, steps[0]), flightPlan(a2, p3, w, steps[1] ?? steps[0]));
      landings.push([add(add(p1, s, -w / 2), f1, -D / 2), add(add(p2, s, w / 2), f1, -D / 2), add(add(p2, s, w / 2), f1, D / 2), add(add(p1, s, -w / 2), f1, D / 2)].map(rp));
    } else {
      const a2 = add(p1, s, w / 2);
      const len2 = Math.hypot(p2[0] - a2[0], p2[1] - a2[1]);
      const steps = flightSteps(c, [Math.max(0, len1 - D / 2), len2], scale);
      flights.push(flightPlan(p0, b1, w, steps[0]), flightPlan(a2, p2, w, steps[1] ?? steps[0]));
      landings.push([add(add(p1, f1, -D / 2), s, -w / 2), add(add(p1, f1, -D / 2), s, w / 2), add(add(p1, f1, D / 2), s, w / 2), add(add(p1, f1, D / 2), s, -w / 2)].map(rp));
    }
  }
  const first = flights[0];
  let breakLine: [Pt, Pt] | null = null;
  if (first && !opts.descending) {
    const d = unit(sub(first.to, first.from));
    const n = rightOf(d);
    const L = Math.hypot(first.to[0] - first.from[0], first.to[1] - first.from[1]);
    breakLine = [rp(add(add(first.from, d, L * 0.5), n, w / 2)), rp(add(add(first.from, d, L * 0.7), n, -w / 2))];
  }
  return { shape, flights, landings, walk: pts.map(rp), breakLine, caption: stairCaption({ flights: flights.map((x) => ({ steps: x.steps })), shape }) };
}

/** The rise of a stair in metres, signed along its walking line: to another level of this floor, the elevation
 * difference; to another floor, the other floor's datum above this one (the floor heights between, far.datum_m) + the
 * elevation of the level it reaches there - the elevation of the level it leaves here (review M1); without a datum,
 * this floor's height up or down by the far floor's direction; a stair with no target yet rises the fallback. */
export function stairRise(levels: Map<string, GeomLevel>, c: Pick<GeomConnector, 'level_from' | 'level_to' | 'floor_ids' | 'far'>, floorHeightM: number = DEFAULT_FLOOR_HEIGHT_M): number {
  if (c.floor_ids && c.floor_ids.length) {
    const own = levels.get(c.level_from)?.elevation_m ?? 0;
    const far = c.far;
    if (far && typeof far.datum_m === 'number' && Number.isFinite(far.datum_m)) return far.datum_m + (far.level_elevation_m ?? 0) - own;
    return far?.direction === 'down' ? -floorHeightM : floorHeightM;
  }
  const a = levels.get(c.level_from);
  const b = c.level_to ? levels.get(c.level_to) : undefined;
  if (a && b && b.elevation_m !== a.elevation_m) return b.elevation_m - a.elevation_m;
  return STAIR_FALLBACK_RISE_M;
}

/** The tread depth of a drawn stair: its first flight's run over its steps (the going the panel keeps when the steps
 * change), within 0.15..0.5 m; STAIR_GOING_M when the stair has no plan yet. */
export function stairGoing(c: GeomConnector, W: number, H: number, scale: number): number {
  const plan = stairPlan(c, W, H, scale);
  const f = plan?.flights[0];
  if (!f || f.steps < 1) return STAIR_GOING_M;
  const g = (Math.hypot(f.to[0] - f.from[0], f.to[1] - f.from[1]) * scale) / f.steps;
  return Math.min(0.5, Math.max(0.15, g));
}

/** A stair rebuilt after a change in the panel (shape, turn, steps, width, landing depth): the same start and first
 * direction, each flight's run = its steps x the stair's going, the walking line regenerated. Returns the fields to
 * patch (polyline included). */
export function rebuildStair(c: GeomConnector, patch: Partial<Pick<GeomConnector, 'shape' | 'turn' | 'flights' | 'width_m' | 'landing_depth_m'>>, W: number, H: number, scale: number): Partial<GeomConnector> {
  const going = stairGoing(c, W, H, scale);
  const shape: StairShape = patch.shape ?? c.shape ?? 'straight';
  let flights = (patch.flights ?? c.flights ?? []).map((x) => ({ steps: Math.max(1, Math.min(MAX_STAIR_STEPS, Math.round(x.steps || 1))) }));
  if (!flights.length) flights = [{ steps: Math.max(1, Math.round((lengthPx(c.polyline, W, H) * scale) / going)) }];
  if (shape !== 'straight' && flights.length < 2) {
    const half = Math.max(1, Math.ceil(flights[0].steps / 2));
    flights = [{ steps: half }, { steps: Math.max(1, flights[0].steps - half) }];
  }
  const width_m = patch.width_m ?? c.width_m;
  const asked = patch.landing_depth_m ?? c.landing_depth_m ?? width_m;
  const landing = shape === 'l' ? Math.max(asked, width_m) : asked; // review L6: an L's landing is never narrower than the stair
  const turn: 'left' | 'right' = (patch.turn ?? c.turn) === 'left' ? 'left' : (patch.turn ?? c.turn) === 'right' ? 'right' : turnOf(c.polyline) ?? 'right';
  const [a, b] = c.polyline;
  const dir: Pt = b ? [(b[0] - a[0]) * W, (b[1] - a[1]) * H] : [0, -1];
  const polyline = stairPath({ shape, start: a, dir, width_m, runs_m: flights.map((x) => x.steps * going), landing_m: landing, turn }, W, H, scale);
  return { shape, turn: shape === 'straight' ? 'none' : turn, flights, width_m, landing_depth_m: flights.length > 1 || shape !== 'straight' ? landing : null, polyline };
}
