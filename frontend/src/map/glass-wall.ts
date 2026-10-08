/**
 * Window walls (glass curtain walls, document 2.1; owner request 2026-10-08): a wall of kind "glass" made mostly of
 * glazing - equal panels between mullions over an optional sill; some panels open, each may be bound to an entity like
 * an opening. The mirror of the backend's services/plan_glass.py: the same defaults, limits, layout maths and the same
 * glazing primitive (contracts: tests/unit-glass-wall.spec.ts checks it against the backend's output).
 *
 * Panel layout works on the wall's PATH LENGTH only (panelCount, panelBounds, autoDivide take metres along the path) and
 * glazingPrimitive takes the path's points as the caller computed them: the polyline, or a curved wall's sampled path
 * with the exact arc length of every point (geometry.ts curvedWall; wallPathPx / wallLengthM here).
 *
 * No DOM and no Lit: runs in node.
 */
import type { AnchorRef, GeometryDoc, GeomWall, Pt } from './geometry';
import { isCurved, sample, wallLengthPx, wallPx } from './wall-path';

export const GLASS_KIND = 'glass' as const;
export const GLAZING_SCHEMA_VERSION = '2.1' as const;
export const BASE_SCHEMA_VERSION = '2.0' as const;
export type GlassTint = 'clear' | 'tinted' | 'frosted' | 'reflective';
export type PanelOperation = 'casement_left' | 'casement_right' | 'tilt' | 'sliding' | 'awning';
export const TINTS: readonly GlassTint[] = ['clear', 'tinted', 'frosted', 'reflective'];
export const OPERATIONS: readonly PanelOperation[] = ['casement_left', 'casement_right', 'tilt', 'sliding', 'awning'];
export const MAX_PANELS = 200;
export const PANEL_WIDTH_RANGE: readonly [number, number] = [0.2, 6];
export const MULLION_RANGE: readonly [number, number] = [0.01, 0.5];
export const SILL_RANGE: readonly [number, number] = [0, 10];
export const GLAZED_HEIGHT_RANGE: readonly [number, number] = [0.2, 50];
export const OPACITY_RANGE: readonly [number, number] = [0.05, 0.95];
export const AUTO_MIN_M = 0.9;
export const AUTO_MAX_M = 1.5;
export const CORNER_DEG = 20;
/** The frame depth a wall takes when it becomes a window wall and was thicker (a solid wall's 0.2 m stays as it is). */
export const GLASS_THICKNESS_M = 0.12;

export interface OperablePanel {
  /** 0-based index on the current layout. */
  panel: number;
  operation: PanelOperation;
  anchor_ref?: AnchorRef | null;
}
export interface Glazing {
  panel_width_m: number;
  /** A fixed number of equal panels; null = the length over panel_width_m, rounded half-up. */
  panel_count: number | null;
  mullion_m: number;
  sill_m: number;
  /** null = up to the head of the wall. */
  glazed_height_m: number | null;
  tint: GlassTint;
  opacity: number;
  operable: OperablePanel[];
}
export const GLAZING_DEFAULTS: Glazing = { panel_width_m: 1.2, panel_count: null, mullion_m: 0.06, sill_m: 0, glazed_height_m: null, tint: 'clear', opacity: 0.35, operable: [] };

export interface GlazingPanelPrim {
  index: number;
  a: Pt;
  b: Pt;
  operation: PanelOperation | null;
  anchor: string | null;
}
export interface GlazingPrim {
  kind: 'glazing';
  id: string;
  width: number;
  mullion: number;
  tint: GlassTint;
  mullions: [Pt, Pt][];
  panels: GlazingPanelPrim[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const halfUp = (v: number): number => Math.floor(v + 0.5);

export const isGlass = (w: Pick<GeomWall, 'kind'> | null | undefined): boolean => !!w && w.kind === GLASS_KIND;

/** Whether the document needs version 2.1 (a glass wall or a glazing block), as plan_glass.uses_glazing. */
export function usesGlazing(doc: Pick<GeometryDoc, 'walls'>): boolean {
  return doc.walls.some((w) => w.kind === GLASS_KIND || (w.glazing !== undefined && w.glazing !== null));
}

/** The document with the schema version it is stored with (the server stamps the same on every save): 2.1 for a window
 * wall or a curved wall (bulges; plan_geometry.document_version), else 2.0. */
export function withDocVersion<D extends Pick<GeometryDoc, 'walls' | 'schema_version'>>(doc: D): D {
  if (usesGlazing(doc) || doc.walls.some((w) => isCurved(w))) return doc.schema_version === GLAZING_SCHEMA_VERSION ? doc : { ...doc, schema_version: GLAZING_SCHEMA_VERSION };
  return doc.schema_version === GLAZING_SCHEMA_VERSION ? { ...doc, schema_version: BASE_SCHEMA_VERSION } : doc; // any other value is left as it is
}

/** The wall's glazing with the defaults filled in for what is absent or of the wrong type (as plan_glass.glazing_of). */
export function glazingOf(w: Pick<GeomWall, 'glazing'>): Glazing {
  const raw = (w.glazing && typeof w.glazing === 'object' ? w.glazing : {}) as Partial<Glazing>;
  const out: Glazing = { ...GLAZING_DEFAULTS, operable: [] };
  for (const k of ['panel_width_m', 'mullion_m', 'sill_m', 'opacity'] as const) if (isNum(raw[k]) && raw[k]! >= 0) out[k] = raw[k] as number;
  if (isInt(raw.panel_count) && raw.panel_count >= 1) out.panel_count = raw.panel_count;
  if (isNum(raw.glazed_height_m) && raw.glazed_height_m > 0) out.glazed_height_m = raw.glazed_height_m;
  if (raw.tint && (TINTS as readonly string[]).includes(raw.tint)) out.tint = raw.tint;
  out.operable = Array.isArray(raw.operable) ? raw.operable.filter((o) => o && typeof o === 'object' && isInt(o.panel)) : [];
  if (out.panel_width_m < PANEL_WIDTH_RANGE[0]) out.panel_width_m = PANEL_WIDTH_RANGE[0];
  return out;
}

// ---------------------------------------------------------------- layout (path length only)

/** The wall's path in plan pixels: the polyline, or a curved wall's sampled path (wall-path.ts). */
export function wallPathPx(w: Pick<GeomWall, 'polyline' | 'bulges'>, W: number, H: number): Pt[] {
  if (!isCurved(w)) return w.polyline.map((p): Pt => [p[0] * W, p[1] * H]);
  const { pts, bulges } = wallPx(w, W, H);
  return sample(pts, bulges) as Pt[];
}

export function pathLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

/** The wall's path length in metres (a curved wall by its exact arcs). */
export function wallLengthM(w: Pick<GeomWall, 'polyline' | 'bulges'>, W: number, H: number, scale: number): number {
  return (isCurved(w) ? wallLengthPx(w, W, H) : pathLength(wallPathPx(w, W, H))) * scale;
}

/** How many equal panels: the stored count, else length / nominal width rounded half-up; 1..MAX_PANELS. */
export function panelCount(lengthM: number, g: Pick<Glazing, 'panel_count' | 'panel_width_m'>): number {
  if (isInt(g.panel_count) && g.panel_count >= 1) return Math.min(g.panel_count, MAX_PANELS);
  const width = isNum(g.panel_width_m) && g.panel_width_m > 0 ? g.panel_width_m : GLAZING_DEFAULTS.panel_width_m;
  if (!(isNum(lengthM) && lengthM > 0)) return 1;
  return Math.max(1, Math.min(MAX_PANELS, halfUp(lengthM / Math.max(width, PANEL_WIDTH_RANGE[0]))));
}

export function panelBounds(lengthM: number, count: number): number[] {
  const n = Math.max(1, Math.trunc(count));
  return Array.from({ length: n + 1 }, (_, i) => (lengthM * i) / n);
}

/** Bulk layout: the number of equal panels whose width lies in [minM, maxM], closest to targetM (default the middle);
 * null when no whole number fits. */
export function autoDivide(lengthM: number, minM = AUTO_MIN_M, maxM = AUTO_MAX_M, targetM?: number): number | null {
  if (!(isNum(lengthM) && lengthM > 0 && isNum(minM) && isNum(maxM) && minM > 0 && minM <= maxM)) return null;
  const lo = Math.max(1, Math.ceil(lengthM / maxM - 1e-9));
  let hi = Math.floor(lengthM / minM + 1e-9);
  if (lo > hi || lo > MAX_PANELS) return null;
  hi = Math.min(hi, MAX_PANELS);
  const target = isNum(targetM) && targetM > 0 ? targetM : (minM + maxM) / 2;
  return Math.min(hi, Math.max(lo, halfUp(lengthM / target)));
}

// ---------------------------------------------------------------- the primitive (mirror of plan_glass.glazing_primitive)

function pointAtS(pts: Pt[], cum: number[], s: number): { p: Pt; d: Pt } {
  let i = 0;
  while (i < pts.length - 2 && s > cum[i + 1]) i++;
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  const seg = cum[i + 1] - cum[i];
  if (seg <= 1e-9) return { p: [x0, y0], d: [1, 0] };
  const f = Math.min(1, Math.max(0, (s - cum[i]) / seg));
  return { p: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f], d: [(x1 - x0) / seg, (y1 - y0) / seg] };
}

function unitOf(a: Pt, b: Pt): Pt | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = Math.hypot(dx, dy);
  return n > 1e-9 ? [dx / n, dy / n] : null;
}

/** The glazing of one glass wall along the path `pts` (cumulative lengths `cum`) in plan pixels: a mullion tick across
 * the wall at every inner panel edge outside the opening cuts and a corner post where the path turns by more than
 * CORNER_DEG, and every panel's chord (curtain-wall panels are flat) with its operation and bound entity. */
export function glazingPrimitive(w: GeomWall, pts: Pt[], cum: number[], wpx: number, pxPerM: number, cuts: [number, number][], rp: (p: Pt) => Pt, r2: (v: number) => number): GlazingPrim {
  const total = cum[cum.length - 1];
  const g = glazingOf(w);
  const n = panelCount(total / pxPerM, g);
  const bounds = panelBounds(total, n);
  const ops = new Map<number, OperablePanel>();
  // the backend's dict keeps the LAST entry of a duplicated panel index; mirror that
  for (const o of g.operable) if (o.panel >= 0 && o.panel < n) ops.set(o.panel, o);
  const insideCut = (s: number): boolean => cuts.some(([a, b]) => a - 1e-6 <= s && s <= b + 1e-6);
  const h = wpx / 2;
  const ticks: [number, Pt][] = bounds.slice(1, -1).map((s) => [s, pointAtS(pts, cum, s).d]);
  const closed = pts.length >= 4 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
  for (let i = closed ? 0 : 1; i < pts.length - 1; i++) {
    const d0 = unitOf(i ? pts[i - 1] : pts[pts.length - 2], pts[i]);
    const d1 = unitOf(pts[i], pts[i + 1]);
    const turn = d0 && d1 ? (Math.acos(Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1]))) * 180) / Math.PI : 0;
    if (turn > CORNER_DEG && ticks.every(([s]) => Math.abs(cum[i] - s) > 1e-6)) {
      const bis: Pt = [d0![0] + d1![0], d0![1] + d1![1]];
      const norm = Math.hypot(bis[0], bis[1]);
      ticks.push([cum[i], norm > 1e-9 ? [bis[0] / norm, bis[1] / norm] : d0!]);
    }
  }
  ticks.sort((a, b) => a[0] - b[0]);
  const mullions: [Pt, Pt][] = [];
  for (const [s, d] of ticks) {
    if (insideCut(s)) continue;
    const c = pointAtS(pts, cum, s).p;
    const nl: Pt = [d[1], -d[0]];
    mullions.push([rp([c[0] + nl[0] * h, c[1] + nl[1] * h]), rp([c[0] - nl[0] * h, c[1] - nl[1] * h])]);
  }
  const panels: GlazingPanelPrim[] = [];
  for (let i = 0; i < n; i++) {
    const op = ops.get(i);
    const ref = op?.anchor_ref;
    panels.push({ index: i, a: rp(pointAtS(pts, cum, bounds[i]).p), b: rp(pointAtS(pts, cum, bounds[i + 1]).p), operation: op && (OPERATIONS as readonly string[]).includes(op.operation) ? op.operation : null,
      anchor: ref && ref.resource_id ? `${ref.resource_type}:${ref.resource_id}` : null });
  }
  return { kind: 'glazing', id: w.id, width: r2(wpx), mullion: r2(Math.max(0, g.mullion_m) * pxPerM), tint: g.tint, mullions, panels };
}

/** The double line of a window wall drawn `width` px thick: the pane band inside the frame lines and the frame line's
 * width (plan_geometry_render.glass_band). */
export function glassBand(width: number): { band: number; line: number } {
  const line = Math.max(0.6, Math.min(width * 0.18, 2));
  return { band: Math.max(width - 2 * line, width * 0.35), line };
}

/** The id of an operable panel as an opening of the state layer ("<wall id>~p<index>"): it is never a document id. */
export const panelStateId = (wallId: string, index: number): string => `${wallId}~p${index}`;

// ---------------------------------------------------------------- editor edits (pure; the editor commits each as one undo step)

/** A wall turned into a window wall (one click): kind glass, its glazing kept or the defaults, a frame depth no deeper
 * than GLASS_THICKNESS_M unless it was already thinner. */
export function toGlassPatch(w: GeomWall): Partial<GeomWall> {
  return { kind: GLASS_KIND, glazing: w.glazing ? glazingOf(w) : { ...GLAZING_DEFAULTS, operable: [] }, thickness_m: Math.min(w.thickness_m, GLASS_THICKNESS_M) };
}

/** A window wall turned back into a solid wall of `kind` (the glazing goes; undo brings it back). */
export function toSolidPatch(kind: Exclude<GeomWall['kind'], 'glass'>): Partial<GeomWall> {
  return { kind, glazing: undefined };
}

/** The glazing with `patch` applied and the operable panels that no longer exist on the new layout dropped. */
export function patchGlazing(w: GeomWall, patch: Partial<Glazing>, lengthM: number): Glazing {
  const next: Glazing = { ...glazingOf(w), ...patch };
  const n = panelCount(lengthM, next);
  next.operable = next.operable.filter((o) => o.panel >= 0 && o.panel < n);
  return next;
}

/** Panel `index` toggled between fixed and operable (`operation`, default a left casement). */
export function toggleOperable(g: Glazing, index: number, operation: PanelOperation = 'casement_left'): Glazing {
  const has = g.operable.some((o) => o.panel === index);
  const operable = has ? g.operable.filter((o) => o.panel !== index) : [...g.operable, { panel: index, operation, anchor_ref: null }].sort((a, b) => a.panel - b.panel);
  return { ...g, operable };
}

/** One operable panel changed (its operation or its bound entity). */
export function patchOperable(g: Glazing, index: number, patch: Partial<OperablePanel>): Glazing {
  return { ...g, operable: g.operable.map((o) => (o.panel === index ? { ...o, ...patch, panel: o.panel } : o)) };
}

/** Bulk layout applied: the panel count auto-divide finds, with the nominal width set to the resulting width; null =
 * nothing fits (the glazing is unchanged). */
export function applyAutoDivide(w: GeomWall, lengthM: number, minM = AUTO_MIN_M, maxM = AUTO_MAX_M): Glazing | null {
  const n = autoDivide(lengthM, minM, maxM);
  if (n === null) return null;
  return patchGlazing(w, { panel_count: n, panel_width_m: Math.round((lengthM / n) * 1000) / 1000 }, lengthM);
}

/** The glass panes of a window wall in 3D, from the bottom of the wall: the sill's top and the glazing's top (the head
 * frame fills the rest up to the wall's height). */
export function glassVerticals(g: Glazing, wallH: number): { sill: number; top: number } {
  const sill = Math.min(Math.max(0, g.sill_m), Math.max(0, wallH - 0.05));
  const top = g.glazed_height_m === null ? wallH : Math.min(wallH, sill + g.glazed_height_m);
  return { sill, top: Math.max(sill, top) };
}
