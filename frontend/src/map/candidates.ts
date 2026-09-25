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
  /** Object candidates (DXF block mapping): document-v2 shape (the API review's binding contract), not yet drawn by
   * the candidates layer below - Task 8 only wires walls and openings into sw-plan-canvas; a later task adds the
   * object candidate layer. */
  objects: GeomObject[];
  pixels: CandidatePixels;
  /** Metres per version pixel the server used for the metres of this set (null when unknown). */
  scaleMPerPx: number | null;
}

const MIN_THICKNESS_M = 0.02;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const clampPt = (p: Pt): Pt => [round5(Math.min(1, Math.max(0, p[0]))), round5(Math.min(1, Math.max(0, p[1])))];

export function fromResult(r: DetectResult): CandidateSet {
  return { walls: r.walls, openings: r.openings, objects: r.objects ?? [], pixels: r.pixels ?? {}, scaleMPerPx: r.scale?.m_per_px ?? null };
}

/** The set as a document, so the canvas draws it through buildPrimitives exactly like the structure. Every other
 * collection is cleared, not only labels and objects: detect never returns connectors, and the base document's real
 * ones must not draw a second time inside this ad-hoc "document" (they already draw once from the real structure). */
export function candidatesDoc(base: GeometryDoc, set: CandidateSet): GeometryDoc {
  return { ...base, walls: set.walls, openings: set.openings, labels: [], objects: [], connectors: [] };
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
  return { ...set, walls, openings, scaleMPerPx };
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
