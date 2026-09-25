/**
 * Plan Studio API (T084): the structure document of a plan version. Maps get it by hash (the bundle carries only the
 * reference), the historical map by the version's publish timeline; the editor works on the draft through the studio
 * controller.
 */
import { get, patch, post, put, resourceUrl } from './client';
import type { GeomConnector, GeometryDoc, GeomObject, GeomOpening, GeomWall, Pt } from '../map/geometry';
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
/** Items per collection, as the server counts them. */
export interface GeometryCounts {
  walls: number;
  openings: number;
  labels: number;
  objects: number;
  connectors: number;
  circuits: number;
  levels: number;
  groups: number;
}
/** GET /plan-versions/{id}/geometry/diff: the draft against the published structure, the draft's issues and the counts
 * before and after (published_counts is null before the first publish). */
export interface GeometryDiffResponse {
  diff: GeometryDiff;
  issues: GeometryIssue[];
  counts: GeometryCounts;
  published_counts: GeometryCounts | null;
}
export interface CalibrationResult {
  version: PlanVersion;
  scale_m_per_px: number;
  residual_pct: number | null;
  warning: string | null;
  /** "measured" (two-point pairs) or "estimated" (the door-width hint, phase 3). */
  status?: 'measured' | 'estimated';
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
export const geometryDiff = (versionId: string) => get<GeometryDiffResponse>(`plan-versions/${versionId}/geometry/diff`);
export const copyGeometryFrom = (versionId: string, fromVersionId: string) =>
  post<GeometryResponse>(`plan-versions/${versionId}/geometry/copy-from`, { from_version_id: fromVersionId });
export const calibrate = (versionId: string, pairs: { a: Pt; b: Pt; metres: number }[]) =>
  patch<CalibrationResult>(`plan-versions/${versionId}/calibration`, { pairs });
export function exportUrl(versionId: string, fmt: 'svg' | 'png', opts: { draft?: boolean; layers?: string[] } = {}): string {
  const q = new URLSearchParams();
  if (opts.draft) q.set('draft', 'true');
  if (opts.layers?.length) q.set('layers', opts.layers.join(','));
  const qs = q.toString();
  return resourceUrl(`api/v1/plan-versions/${versionId}/export.${fmt}${qs ? `?${qs}` : ''}`);
}
/** Stairs / an elevator to another floor: the same connector id lands on the other floor's draft (T085). */
export const linkConnector = (versionId: string, connectorId: string, floorId: string) =>
  post<{ connector: GeomConnector; target: { floor_id: string; version_id: string; revision: number } }>(`plan-versions/${versionId}/geometry/link`, { connector_id: connectorId, floor_id: floorId });

// ---------------------------------------------------------------- detection (phase 3, T086)

export type DetectTarget = 'walls' | 'openings';
export interface DetectRequest {
  targets?: DetectTarget[];
  /** 0.3 (light morphology) to 1.0 (strong); the server's default is 0.6. */
  strength?: number;
  level_id?: string;
}
export interface CalibrationHint {
  scale_m_per_px: number;
  status: 'estimated';
  method: 'door_width';
  reason: string;
  doors: number;
}
/** Version pixels per candidate: the client recomputes the metres with the document's effective scale before accepting. */
export type CandidatePixels = Record<string, { thickness_px?: number; width_px?: number }>;
export interface DetectorInfo {
  name: string;
  version: string;
  params: Record<string, unknown>;
}
export interface DxfRoomCandidate {
  polygon: { x: number; y: number }[];
  name: string;
}
/** POST /plan-versions/{id}/detect and POST …/import-dxf-geometry: candidates in document-v2 shape, never stored.
 * Deviation from the brief (API review): object candidates are document-v2 objects (GeomObject), not the brief's
 * pose/catalog_id shape - the backend never produced that shape (services/plan_geometry.py merge_candidates,
 * CANDIDATE_COLLECTIONS includes "objects" with the same schema _check_objects validates). */
export interface DetectResult {
  walls: GeomWall[];
  openings: GeomOpening[];
  objects?: GeomObject[];
  rooms?: DxfRoomCandidate[];
  detector: DetectorInfo;
  calibration_hint: CalibrationHint | null;
  pixels: CandidatePixels;
  /** Deviation from the brief (API review, matches services/plan_detect.py): "estimated_walls", not "estimated" -
   * an uncalibrated detect always answers this even when the version's own calibration is an estimate; the "≈" on
   * screen comes from the document's effective scale (map/geometry.ts effectiveScale), never from this field. */
  scale: { m_per_px: number | null; status: 'measured' | 'estimated_walls' };
  stats: Record<string, number>;
  version_id: string;
  level_id: string;
  existing_auto: { walls: number; openings: number };
  elapsed_ms?: number;
}
export interface AcceptRequest {
  accepted: string[];
  /** A partial object/wall/opening (document-v2 fields only): the server accepts only the editable fields of each
   * collection (services/plan_geometry.py EDITABLE_FIELDS) and ignores the rest - id, source and confidence never
   * travel through an edit. */
  edits: Record<string, Partial<GeomWall> | Partial<GeomOpening> | Partial<GeomObject>>;
  replace_auto: boolean;
  candidates: { walls: GeomWall[]; openings: GeomOpening[]; objects?: GeomObject[] };
  base_revision: number;
  detector: DetectorInfo | null;
}
export const detectStructure = (versionId: string, body: DetectRequest) => post<DetectResult>(`plan-versions/${versionId}/detect`, body);
export const acceptDetection = (versionId: string, body: AcceptRequest) => post<GeometryResponse>(`plan-versions/${versionId}/detect/accept`, body);
/** The door-width hint as an estimated calibration (design 6.3): metres then show with "≈". */
export const calibrateEstimate = (versionId: string, scaleMPerPx: number, reason: string) =>
  patch<CalibrationResult>(`plan-versions/${versionId}/calibration`, { estimate: { scale_m_per_px: scaleMPerPx, method: 'door_width', reason } });

/** Error codes /detect, /detect/accept and /calibration (estimate) can answer with (the API review, backed by
 * routers/plan_geometry.py and tests/test_plan_detect_api.py): the client reads them off ApiError.code. detect_timeout
 * (504) is retryable. calibration_measured (409, "an estimate never replaces a measured calibration silently") is a
 * concurrent backend change (test_plan_detect_api.py::test_an_estimate_never_replaces_a_measured_calibration_silently,
 * not yet in plan_geometry.py at the time of this task): calibrateEstimate above does not yet send the confirming
 * replace_measured flag that route will need - a follow-up task wires the confirmation dialog once that endpoint change
 * lands on this branch. */
export type DetectErrorCode = 'detect_timeout' | 'stale_revision' | 'calibration_measured' | 'unknown_candidate' | 'orphan_opening' | 'candidate_source' | 'duplicate_candidate' | 'candidate_shape' | 'geometry_structure';

export type DxfTarget = 'walls' | 'openings' | 'windows' | 'objects' | 'rooms' | 'ignore';
export interface DxfEntityLayer {
  name: string;
  count: number;
  kinds: Record<string, number>;
  sample: string;
  suggested: DxfTarget;
  in_render: boolean;
}
export interface DxfBlock {
  name: string;
  count: number;
  size_m: [number, number];
  suggested: { catalog_id: string | null; name: string };
}
export interface DxfEntities {
  asset_id: string;
  units: string;
  metres_per_unit: number | null;
  layers: DxfEntityLayer[];
  blocks: DxfBlock[];
  targets: { id: DxfTarget; label: string }[];
  catalog_choices: { id: string | null; name: string }[];
}
export const getDxfEntities = (assetId: string) => get<DxfEntities>(`plan-assets/${assetId}/dxf/entities`);
export const importDxfGeometry = (versionId: string, body: { layer_map: Record<string, DxfTarget>; block_map: Record<string, string | null>; level_id?: string }) =>
  post<DetectResult>(`plan-versions/${versionId}/import-dxf-geometry`, body);
