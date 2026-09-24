/**
 * Plan Studio API (T084): the structure document of a plan version. Maps get it by hash (the bundle carries only the
 * reference), the historical map by the version's publish timeline; the editor works on the draft through the studio
 * controller.
 */
import { get, patch, post, put, resourceUrl } from './client';
import type { GeometryDoc, Pt } from '../map/geometry';
import type { MapBundle } from './maps';
import type { PlanVersion } from './types';

export interface GeometryRow {
  id: string | null;
  plan_version_id: string;
  floor_id: string;
  status: 'new' | 'draft' | 'published' | 'archived';
  revision: number;
  doc_hash: string;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  published_by: string | null;
  archived_at: string | null;
}
export interface GeometryIssue {
  code: string;
  severity: 'error' | 'warning';
  structural: boolean;
  id: string | null;
  path: string;
  message: string;
}
export interface CopyCandidate {
  version_id: string;
  status: string;
  created_at: string;
  walls: number;
  openings: number;
  same_drawing: boolean;
}
export interface GeometryResponse {
  geometry: GeometryRow;
  doc: GeometryDoc;
  issues: GeometryIssue[];
  published_hash: string | null;
  copy_candidates?: CopyCandidate[];
}
export interface GeometryDiff {
  collections: Record<string, { added: string[]; removed: string[]; changed: string[] }>;
  total: number;
  calibration_changed: boolean;
  same: boolean;
}
export interface CalibrationResult {
  version: PlanVersion;
  scale_m_per_px: number;
  residual_pct: number;
  warning: string | null;
}
export interface GeometryPeriod {
  id: string;
  doc_hash: string;
  published_at: string;
  archived_at: string | null;
}

const byHash = new Map<string, GeometryDoc>();
const timelines = new Map<string, Promise<GeometryPeriod[]>>();

export function getGeometry(versionId: string, opts: { draft?: boolean; at?: string } = {}): Promise<GeometryResponse> {
  const q = new URLSearchParams();
  if (opts.draft) q.set('draft', 'true');
  if (opts.at) q.set('at', opts.at);
  const qs = q.toString();
  return get<GeometryResponse>(`plan-versions/${versionId}/geometry${qs ? `?${qs}` : ''}`);
}

/** The structure a live map shows: fetched once per hash. A map without its structure still works (null on error). */
export async function geometryFor(bundle: MapBundle): Promise<GeometryDoc | null> {
  const ref = bundle.geometryRef;
  if (bundle.source !== 'api' || !ref || !bundle.planVersionId) return null;
  const hit = byHash.get(ref.doc_hash);
  if (hit) return hit;
  try {
    // A published or archived row is asked for by its publish instant, so an exact-history bundle gets the row it names.
    const r = await getGeometry(bundle.planVersionId, ref.status === 'draft' ? { draft: true } : ref.published_at ? { at: ref.published_at } : {});
    byHash.set(r.geometry.doc_hash, r.doc);
    return r.doc;
  } catch {
    return null;
  }
}

/** The structure a historical map shows at an instant: the version's publish timeline is read once, documents once per hash. */
export async function geometryAt(versionId: string, iso: string): Promise<GeometryDoc | null> {
  let tl = timelines.get(versionId);
  if (!tl) {
    const fetched: Promise<GeometryPeriod[]> = get<{ timeline: GeometryPeriod[] }>(`plan-versions/${versionId}/geometry/timeline`)
      .then((r) => r.timeline)
      .catch(() => {
        if (timelines.get(versionId) === fetched) timelines.delete(versionId); // a failed read is not remembered: the next move asks again
        return [];
      });
    tl = fetched;
    timelines.set(versionId, tl);
  }
  const period = (await tl).find((p) => p.published_at <= iso && (!p.archived_at || iso < p.archived_at));
  if (!period) return null;
  const hit = byHash.get(period.doc_hash);
  if (hit) return hit;
  try {
    const r = await getGeometry(versionId, { at: period.published_at });
    byHash.set(r.geometry.doc_hash, r.doc);
    return r.doc;
  } catch {
    return null;
  }
}

export const saveGeometryDraft = (versionId: string, doc: GeometryDoc, baseRevision: number) =>
  put<GeometryResponse>(`plan-versions/${versionId}/geometry`, { doc, base_revision: baseRevision });
/** A publish changes the version's timeline: the cached one is dropped (documents stay cached by hash), so an open
 * historical map shows the new structure at instants after it. */
export async function publishGeometry(versionId: string): Promise<{ published: GeometryRow | null; diff: GeometryDiff; unchanged: boolean }> {
  const r = await post<{ published: GeometryRow | null; diff: GeometryDiff; unchanged: boolean }>(`plan-versions/${versionId}/geometry/publish`);
  timelines.delete(versionId);
  return r;
}
export const geometryDiff = (versionId: string) =>
  get<{ diff: GeometryDiff; issues: GeometryIssue[]; counts: Record<string, number>; published_counts: Record<string, number> | null }>(`plan-versions/${versionId}/geometry/diff`);
export const copyGeometryFrom = (versionId: string, fromVersionId: string) =>
  post<GeometryResponse>(`plan-versions/${versionId}/geometry/copy-from`, { from_version_id: fromVersionId });
export const calibrate = (versionId: string, pairs: { a: Pt; b: Pt; metres: number }[]) =>
  patch<CalibrationResult>(`plan-versions/${versionId}/calibration`, { pairs });
export function exportUrl(versionId: string, fmt: 'svg' | 'png', opts: { draft?: boolean } = {}): string {
  return resourceUrl(`api/v1/plan-versions/${versionId}/export.${fmt}${opts.draft ? '?draft=true' : ''}`);
}
