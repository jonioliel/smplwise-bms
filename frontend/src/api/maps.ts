/**
 * Floor map, plan import and anchor editing against the backend, with a demo fallback that renders the
 * synthetic plans when no backend is present.
 */
import { svg, type SVGTemplateResult } from 'lit';
import { del, get, patch, post, resourceUrl, upload } from './client';
import { isApi } from './session';
import type { Anchor, Camera, FloorMap, PlanAsset, PlanVersion, SpatialZone } from './types';
import { demoCameras, demoFloors, demoPlan, demoSite } from '../fixtures/demo';
import type { StateKind } from '../components/sw-badge';

export interface MapBundle {
  source: 'api' | 'demo';
  floorId: string;
  floorName: string;
  buildingName: string;
  siteName: string;
  /** Raster background (API) or synthetic SVG (demo). Coordinates are normalized to width/height. */
  width: number;
  height: number;
  imageUrl: string | null;
  planSvg: SVGTemplateResult | null;
  planStatus: 'published' | 'draft' | 'none';
  planVersionId: string | null;
  needsAlignment: boolean;
  anchors: Anchor[];
  /** Named rooms / areas (M13); empty when none were defined. */
  zones: SpatialZone[];
  cameras: Camera[];
  permissions: { edit: boolean; publish: boolean; import: boolean };
  renderMode: 'source' | 'stylized';
  stylizedAvailable: boolean;
  /** Published period of the shown version and, when loaded at an instant, how the history was resolved (T038). */
  planPublishedAt: string | null;
  planArchivedAt: string | null;
  at: string | null;
  history: 'exact' | 'current' | null;
  historyFrom: string | null;
  haHistory: { from: string | null; to: string | null; rows: number; retention_days: number } | null;
}

function demoBundle(floorId: string): MapBundle {
  const floor = demoFloors.find((f) => f.id === floorId) ?? demoFloors[0];
  const cams = demoCameras.filter((c) => c.floorId === floor.id);
  return {
    source: 'demo',
    floorId: floor.id,
    floorName: floor.name,
    buildingName: demoSite.building,
    siteName: demoSite.name,
    width: floor.planWidth || 1200,
    height: floor.planHeight || 800,
    imageUrl: null,
    planSvg: floor.hasPlan ? demoPlan(floor.id) : null,
    planStatus: floor.hasPlan ? 'published' : 'none',
    planVersionId: floor.hasPlan ? `demo-${floor.id}` : null,
    needsAlignment: false,
    renderMode: 'source',
    stylizedAvailable: false,
    planPublishedAt: null,
    planArchivedAt: null,
    at: null,
    history: null,
    historyFrom: null,
    haHistory: null,
    anchors: cams.map((c, i) => ({
      id: `demo-anchor-${c.id}`,
      floor_id: floor.id,
      plan_version_id: `demo-${floor.id}`,
      resource_type: 'camera',
      resource_id: c.id,
      position: { x: c.x, y: c.y },
      rotation_degrees: c.rotation,
      field_of_view_degrees: c.fov,
      layer_id: 'cameras',
      label: c.name,
      revision: 1,
      effective_from: '',
      effective_to: null,
      updated_at: '',
      camera: { id: c.id, recorder_id: 'demo', channel: i + 1, name: c.name, name_source: c.name, alias: null, enabled: true, sort_order: i, main_track: null, sub_track: null, status: c.state === 'offline' ? 'offline' : 'online', last_seen_at: null },
    })),
    zones: [],
    cameras: [],
    permissions: { edit: true, publish: true, import: true },
  };
}

export async function loadMap(floorId: string, draft = false, at?: string): Promise<MapBundle> {
  if (!isApi()) return demoBundle(floorId);
  const q = new URLSearchParams();
  if (draft) q.set('draft', 'true');
  if (at) q.set('at', at);
  const qs = q.toString();
  const m = await get<FloorMap>(`floors/${floorId}/map${qs ? `?${qs}` : ''}`);
  return {
    source: 'api',
    floorId: m.floor.id,
    floorName: m.floor.name,
    buildingName: m.building.name,
    siteName: m.site.name,
    width: m.plan?.width_px ?? 1200,
    height: m.plan?.height_px ?? 800,
    imageUrl: m.plan ? resourceUrl(m.plan.image_url) : null,
    planSvg: null,
    planStatus: m.plan ? m.plan.status === 'published' ? 'published' : 'draft' : 'none',
    planVersionId: m.plan?.id ?? null,
    needsAlignment: m.needs_alignment,
    anchors: m.anchors,
    zones: m.zones ?? [],
    cameras: m.cameras,
    permissions: m.permissions,
    renderMode: m.plan?.render_mode === 'stylized' ? 'stylized' : 'source',
    stylizedAvailable: Boolean(m.plan?.stylized_url),
    planPublishedAt: m.plan?.published_at ?? null,
    planArchivedAt: m.plan?.archived_at ?? null,
    at: m.at ?? null,
    history: m.history ?? null,
    historyFrom: m.history_from ?? null,
    haHistory: m.ha_history ?? null,
  };
}

/** Camera state for a marker: real sync status when the backend knows it, otherwise the demo state. */
export function cameraState(anchor: Anchor, demoFallback?: StateKind): StateKind {
  const cam = anchor.camera;
  if (!cam) return demoFallback ?? 'unknown';
  if (cam.status === 'online') return 'live';
  if (cam.status === 'offline') return 'offline';
  return demoFallback ?? 'unknown';
}

// ---- plans ----

export const listAssets = (floorId: string) => get<{ assets: PlanAsset[] }>(`floors/${floorId}/plan-assets`);
export const uploadAsset = (floorId: string, file: File) => {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload<PlanAsset>(`floors/${floorId}/plan-assets`, form);
};
export const listVersions = (floorId: string) => get<{ versions: PlanVersion[] }>(`floors/${floorId}/plan-versions`);
export const createVersion = (floorId: string, body: { asset_id: string; page: number; rotation: number; crop?: { x: number; y: number; w: number; h: number } | null; notes?: string }) =>
  post<PlanVersion>(`floors/${floorId}/plan-versions`, body);
export const publishVersion = (versionId: string) => post<PlanVersion>(`plan-versions/${versionId}/publish`);

/** What publishing or restoring a version means: geometry changes against the published one and the fate of every placed item (T038). */
export interface VersionDiff {
  from: PlanVersion | null;
  to: PlanVersion;
  geometry: { same: boolean; changes: { field: string; from: unknown; to: unknown }[] };
  anchors: {
    total: number;
    carried: number;
    needs_alignment: number;
    items: { anchor_id: string; resource_type: 'camera' | 'ha_entity'; resource_id: string; name: string; on_version_id: string; outcome: 'carried' | 'needs_alignment' }[];
  };
}
export const versionDiff = (versionId: string, against?: string) => get<VersionDiff>(`plan-versions/${versionId}/diff${against ? `?against=${against}` : ''}`);
/** Restore an archived version as a new published copy; `revision` and the expected published id make a concurrent change a clear 409. */
export const rollbackVersion = (versionId: string, revision: number, expectedPublishedId: string | null) =>
  post<PlanVersion>(`plan-versions/${versionId}/rollback`, { revision, expected_published_id: expectedPublishedId });
export const deleteVersion = (versionId: string) => del(`plan-versions/${versionId}`);

// ---- anchors ----

export const createAnchor = (floorId: string, body: { resource_type: 'camera' | 'ha_entity'; resource_id: string; x: number; y: number; rotation_degrees?: number; field_of_view_degrees?: number | null; layer_id?: string; label?: string | null }) =>
  post<Anchor>(`floors/${floorId}/anchors`, body);
export const updateAnchor = (id: string, body: { revision: number; x?: number; y?: number; rotation_degrees?: number; field_of_view_degrees?: number | null; label?: string | null }) =>
  patch<Anchor>(`map-anchors/${id}`, body);
export const deleteAnchor = (id: string) => del(`map-anchors/${id}`);

// ---- cameras ----

export const listCameras = () => get<{ cameras: Camera[]; recorder: { id: string; name: string; model: string | null; firmware: string | null; last_seen_at: string | null } | null; can_sync: boolean }>('cameras');
export const syncCameras = () => post<{ channels: number; created: number; updated: number; recorder: { model: string | null; firmware: string | null } }>('cameras/sync');
export const registerCamera = (body: { channel: number; alias: string }) => post<Camera>('cameras', body);
export const updateCamera = (id: string, body: { alias?: string; sort_order?: number; enabled?: boolean }) => patch<Camera>(`cameras/${id}`, body);

/** Plain white plan area (used only where no raster and no synthetic plan exist). */
export const blankPlan = (w: number, h: number): SVGTemplateResult => svg`<rect x="0" y="0" width=${w} height=${h} fill="var(--sw-map-bg)" />`;
