/**
 * Plan Studio phase 3 (T086): the candidate set the detect tool holds until "אשר" - pure operations (every function
 * returns a new set), no DOM and no Lit, so it runs in node (tests/unit-plan-detect.spec.ts). Candidates are document-v2
 * walls and openings with source "auto" (detection) or "imported" (DXF); `pixels` keeps their version-pixel sizes so
 * the metres follow the document's effective scale, whatever the server assumed.
 */
import type { CandidatePixels, DetectResult } from '../api/geometry';
import type { GeometryDoc, GeomObject, GeomOpening, GeomWall, Pt } from './geometry';

export type CandState = 'accepted' | 'rejected';
export type CandKind = 'wall' | 'door' | 'window' | 'passage';
export interface CandidateSet {
  walls: GeomWall[];
  openings: GeomOpening[];
  /** Object candidates (DXF block mapping; since detector 1.4 also detected tribunes and columns): document-v2 shape
   * (the API review's binding contract). The candidates layer draws them dashed (their outline, a tribune's rows); they
   * are accepted or left out together (the panel's "כולל ... עצמים"), not one by one. */
  objects: GeomObject[];
  pixels: CandidatePixels;
  /** Metres per version pixel the server used for the metres of this set (null when unknown). */
  scaleMPerPx: number | null;
  /** Detector 1.2 and later (T087 review): ids of the wall candidates kept although they lie outside the main structure (a small
   * building beside a large one). They stay selectable and acceptable like any candidate; the layer draws them with
   * their own dash and the list, the pill and the summary say so. Absent / empty: none. */
  outsideMain?: string[];
}

/** The label of a wall candidate outside the main structure (list row, map pill, selection note). */
export const OUTSIDE_MAIN_HE = 'מחוץ למבנה הראשי';

/** Whether candidate `id` is a wall outside the main structure. */
export function isOutsideMain(set: CandidateSet, id: string): boolean {
  return !!set.outsideMain?.includes(id);
}

/** The summary line for the walls outside the main structure still in the set, or null when there are none. */
export function outsideMainSummary(set: CandidateSet): string | null {
  const flagged = new Set(set.outsideMain ?? []);
  const n = set.walls.filter((w) => flagged.has(w.id)).length;
  if (!n) return null;
  return `${n === 1 ? 'קיר אחד' : `${n} קירות`} ${OUTSIDE_MAIN_HE} - בדוק לפני קבלה`;
}

const MIN_THICKNESS_M = 0.02;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const clampPt = (p: Pt): Pt => [round5(Math.min(1, Math.max(0, p[0]))), round5(Math.min(1, Math.max(0, p[1])))];

export function fromResult(r: DetectResult): CandidateSet {
  return { walls: r.walls, openings: r.openings, objects: r.objects ?? [], pixels: r.pixels ?? {}, scaleMPerPx: r.scale?.m_per_px ?? null, outsideMain: r.flags?.outside_main ?? [] };
}

/** The set as a document, so the canvas draws it through buildPrimitives exactly like the structure: its walls,
 * openings and object candidates. Every other collection is cleared: detect never returns connectors or labels, and the
 * base document's real ones must not draw a second time inside this ad-hoc "document" (they already draw once from the
 * real structure). */
export function candidatesDoc(base: GeometryDoc, set: CandidateSet): GeometryDoc {
  return { ...base, walls: set.walls, openings: set.openings, labels: [], objects: set.objects, connectors: [] };
}

/** The label of an object candidate (list, map title): what the detector proposes it as. */
export function objectCandidateLabel(itemId: string): string {
  if (itemId.startsWith('tribune.')) return 'טריבונה';
  if (itemId.startsWith('column.')) return 'עמוד';
  return 'עצם';
}

/** The panel's line for the object candidates: how many of which kind (detect), or how many from the file (DXF). */
export function objectsSummary(set: CandidateSet, source: 'detect' | 'dxf'): string {
  const n = set.objects.length;
  const count = n === 1 ? 'עצם אחד' : `${n} עצמים`;
  if (source === 'dxf') return `${count} מהקובץ`;
  const tribunes = set.objects.filter((o) => o.item_id.startsWith('tribune.')).length;
  const columns = set.objects.filter((o) => o.item_id.startsWith('column.')).length;
  const parts = [tribunes ? (tribunes === 1 ? 'טריבונה' : `${tribunes} טריבונות`) : '', columns ? (columns === 1 ? 'עמוד' : `${columns} עמודים`) : ''].filter(Boolean);
  return parts.length ? `${count} שזוהו (${parts.join(', ')})` : `${count} שזוהו`;
}

/** Metres from the version pixels at another scale (the document's effective scale, or the applied door-width hint). */
export function rescale(set: CandidateSet, scaleMPerPx: number): CandidateSet {
  const walls = set.walls.map((w) => {
    const px = set.pixels[w.id]?.thickness_px;
    return px === undefined ? w : { ...w, thickness_m: Math.max(MIN_THICKNESS_M, round3(px * scaleMPerPx)) };
  });
  const openings = set.openings.map((o) => {
    const px = set.pixels[o.id]?.width_px;
    return px === undefined ? o : { ...o, width_m: Math.max(0.05, round3(px * scaleMPerPx)) };
  });
  // a detected object's footprint follows the scale too (a DXF object carries no pixels: its metres are the drawing's)
  const objects = set.objects.map((o) => {
    const p = set.pixels[o.id];
    if (p?.w_px === undefined || p.d_px === undefined) return o;
    const size = { ...o.size, w_m: Math.min(100, Math.max(0.05, round3(p.w_px * scaleMPerPx))), d_m: Math.min(100, Math.max(0.05, round3(p.d_px * scaleMPerPx))) };
    const step = o.params?.step_width_m;
    const rows = o.params?.rows;
    // a tribune's row depth is its depth over its rows
    const params = typeof step === 'number' && typeof rows === 'number' && rows > 0 ? { ...o.params, step_width_m: Math.min(3, Math.max(0.2, round3(size.d_m / rows))) } : o.params;
    return { ...o, size, params };
  });
  return { ...set, walls, openings, objects, scaleMPerPx };
}

export function allIds(set: CandidateSet): string[] {
  return [...set.walls.map((w) => w.id), ...set.openings.map((o) => o.id)];
}

export function kindOf(set: CandidateSet, id: string): CandKind | null {
  if (set.walls.some((w) => w.id === id)) return 'wall';
  const o = set.openings.find((x) => x.id === id);
  return o ? o.kind : null;
}

/** Ids in the set's order (walls first) with the wall of every chosen opening added, duplicates dropped. */
export function withParents(set: CandidateSet, ids: Iterable<string>): string[] {
  const chosen = new Set(ids);
  for (const o of set.openings) if (chosen.has(o.id)) chosen.add(o.wall_id);
  return allIds(set).filter((id) => chosen.has(id));
}

export function byConfidence(set: CandidateSet, min: number): string[] {
  return withParents(set, [...set.walls.filter((w) => w.confidence >= min).map((w) => w.id), ...set.openings.filter((o) => o.confidence >= min).map((o) => o.id)]);
}

export function byKind(set: CandidateSet, kinds: CandKind[]): string[] {
  const k = new Set(kinds);
  return withParents(set, [...(k.has('wall') ? set.walls.map((w) => w.id) : []), ...set.openings.filter((o) => k.has(o.kind)).map((o) => o.id)]);
}

export function defaultStates(set: CandidateSet): Record<string, CandState> {
  return Object.fromEntries(allIds(set).map((id) => [id, 'accepted' as const]));
}

/** An endpoint of a candidate wall moved before accepting (desktop only); the same set when the wall is unknown. */
export function moveVertex(set: CandidateSet, id: string, index: number, p: Pt): CandidateSet {
  const i = set.walls.findIndex((w) => w.id === id);
  if (i < 0 || index < 0 || index >= set.walls[i].polyline.length) return set;
  const walls = set.walls.slice();
  walls[i] = { ...walls[i], polyline: walls[i].polyline.map((q, k) => (k === index ? clampPt(p) : q)) };
  return { ...set, walls };
}

// ---------------------------------------------------------------- the DXF hand-off (import screen -> editor)

const dxfKey = (versionId: string) => `sw.dxf-candidates.${versionId}`;

export function stashDxfCandidates(versionId: string, r: DetectResult): void {
  try {
    sessionStorage.setItem(dxfKey(versionId), JSON.stringify(r));
  } catch {
    /* no storage (node, a private window): the import screen keeps the result in memory instead */
  }
}

export function takeDxfCandidates(versionId: string): DetectResult | null {
  try {
    const raw = sessionStorage.getItem(dxfKey(versionId));
    if (!raw) return null;
    sessionStorage.removeItem(dxfKey(versionId));
    return JSON.parse(raw) as DetectResult;
  } catch {
    return null;
  }
}
