/**
 * PLAN3D-R28-WIZARD-2433: everything the wizard asks of the server, behind one small interface, so the screen reads the same in
 * demo mode (wizard-demo.ts, nothing sent) and against the add-on. The API side only calls the existing Plan Studio endpoints:
 * plan assets and versions (api/maps.ts), detection, accept, calibration and the draft (api/geometry.ts), room detection and
 * zones (api/zones.ts), the device catalogue (api/ha.ts) and map anchors. Every one is authorized by its own route.
 */
import { get, put } from '../api/client';
import { acceptDetection, calibrate, calibrateEstimate, detectStructure, getGeometry, saveGeometryDraft, type AcceptRequest, type CalibrationHint, type DetectResult } from '../api/geometry';
import { createAnchor, createVersion, publishVersion, uploadAsset } from '../api/maps';
import { acceptZones, deleteZone, detectZones, updateZone, type ZoneKind } from '../api/zones';
import { listEntities } from '../api/ha';
import { loadLibrary, lookup3dOf, lookupMaterialsOf } from '../api/plan-catalog';
import { isApi } from '../api/session';
import { resourceUrl } from '../api/client';
import type { GeometryDoc } from '../map/geometry';
import type { Catalog3DLookup } from '../map/scene-builder';
import type { CatalogMaterialLookup } from '../map/material-resolve';
import { DEMO_AREAS, DEMO_ENTITIES, demoBaseDoc, demoDetect, demoRooms, demoTruthDoc } from './wizard-demo';
import { normalizePrefs, type PlaceEntity, type WizardPrefs } from './wizard-model';
import { planDrawingDataUrl } from './wizard-draw';

export interface Draft {
  doc: GeometryDoc;
  revision: number;
}
export interface RoomCandidateIn {
  polygon: { x: number; y: number }[];
  /** The detector's name (DXF / demo) or empty. */
  name: string;
}
export interface CreatedRoom {
  id: string;
  revision: number;
  polygon: { x: number; y: number }[];
  level_id: string | null;
}
export interface UploadedPlan {
  assetId: string;
  name: string;
  pages: { page: number; url: string }[];
}
export interface VersionInfo {
  versionId: string;
  imageUrl: string;
  width: number;
  height: number;
}
export interface PlacedDevice {
  entity_id: string;
  x: number;
  y: number;
  level_id: string | null;
}
export interface SceneCatalog {
  lookup3d: Catalog3DLookup | null;
  materials: CatalogMaterialLookup | null;
}

export interface WizardBackend {
  readonly demo: boolean;
  prefs(): Promise<WizardPrefs>;
  savePrefs(p: WizardPrefs): Promise<void>;
  upload(file: File): Promise<UploadedPlan>;
  createVersion(assetId: string, page: number): Promise<VersionInfo>;
  draft(versionId: string): Promise<Draft>;
  detect(versionId: string): Promise<DetectResult>;
  estimate(versionId: string, hint: CalibrationHint): Promise<void>;
  measure(versionId: string, a: [number, number], b: [number, number], metres: number): Promise<number>;
  accept(versionId: string, body: AcceptRequest): Promise<Draft>;
  detectRooms(): Promise<{ rooms: RoomCandidateIn[]; existingAuto: number }>;
  acceptRooms(rooms: { polygon: { x: number; y: number }[]; name: string; kind: ZoneKind }[], replaceAuto: boolean, dropFirst: string[]): Promise<CreatedRoom[]>;
  tagRoom(room: CreatedRoom, tags: string[], areaId: string | null): Promise<void>;
  areas(): Promise<{ area_id: string; name: string }[]>;
  saveDraft(versionId: string, doc: GeometryDoc, revision: number): Promise<Draft>;
  entities(): Promise<PlaceEntity[]>;
  catalog(): Promise<SceneCatalog>;
  publish(versionId: string, devices: PlacedDevice[]): Promise<{ placed: number; failed: number }>;
}

const PREFS_KEY = 'plan.wizard';

class ApiBackend implements WizardBackend {
  readonly demo = false;
  constructor(private readonly floorId: string) {}

  async prefs() {
    try {
      const r = await get<{ prefs: Record<string, unknown> }>('me/prefs');
      return normalizePrefs(r.prefs[PREFS_KEY]);
    } catch {
      return normalizePrefs(null); // an older server without the key: the recommended defaults
    }
  }
  async savePrefs(p: WizardPrefs) {
    await put('me/prefs', { [PREFS_KEY]: p });
  }
  async upload(file: File) {
    const a = await uploadAsset(this.floorId, file);
    return { assetId: a.id, name: a.original_name, pages: a.pages.map((p) => ({ page: p.page, url: resourceUrl(p.preview_url) })) };
  }
  async createVersion(assetId: string, page: number) {
    const v = await createVersion(this.floorId, { asset_id: assetId, page, rotation: 0, crop: null, notes: 'אשף תוכנית חדשה' });
    const url = (v as unknown as { image_url?: string }).image_url ?? '';
    return { versionId: v.id, imageUrl: url ? resourceUrl(url) : '', width: v.width_px, height: v.height_px };
  }
  async draft(versionId: string) {
    const r = await getGeometry(versionId, { draft: true });
    return { doc: r.doc, revision: r.geometry.revision };
  }
  detect(versionId: string) {
    return detectStructure(versionId, { targets: ['walls', 'openings'] });
  }
  async estimate(versionId: string, hint: CalibrationHint) {
    await calibrateEstimate(versionId, hint.scale_m_per_px, hint.reason);
  }
  async measure(versionId: string, a: [number, number], b: [number, number], metres: number) {
    return (await calibrate(versionId, [{ a, b, metres }])).scale_m_per_px;
  }
  async accept(versionId: string, body: AcceptRequest) {
    const r = await acceptDetection(versionId, body);
    return { doc: r.doc, revision: r.geometry.revision };
  }
  async detectRooms() {
    const r = await detectZones(this.floorId, 'medium');
    return { rooms: r.rooms.map((c) => ({ polygon: c.polygon, name: '' })), existingAuto: r.existing_auto };
  }
  async acceptRooms(rooms: { polygon: { x: number; y: number }[]; name: string; kind: ZoneKind }[], replaceAuto: boolean, dropFirst: string[]) {
    for (const id of dropFirst) await deleteZone(id).catch(() => undefined); // the wizard's own rooms of an earlier pass
    const r = await acceptZones(this.floorId, rooms, replaceAuto);
    const made = new Set(r.created);
    // the answer lists every zone of the floor; keep the order of the request (created ids come back in it)
    return r.created.map((id) => r.zones.find((z) => z.id === id)).filter((z): z is NonNullable<typeof z> => !!z && made.has(z.id))
      .map((z) => ({ id: z.id, revision: z.revision, polygon: z.polygon, level_id: z.level_id ?? null }));
  }
  async tagRoom(room: CreatedRoom, tags: string[], areaId: string | null) {
    await updateZone(room.id, { revision: room.revision, tags, ...(areaId ? { area_id: areaId } : {}) });
  }
  async areas() {
    const r = await listEntities({ limit: 1 });
    return r.areas.filter((a) => a.area_name).map((a) => ({ area_id: a.area_id, name: a.area_name as string }));
  }
  async saveDraft(versionId: string, doc: GeometryDoc, revision: number) {
    const r = await saveGeometryDraft(versionId, doc, revision);
    return { doc: r.doc, revision: r.geometry.revision };
  }
  async entities() {
    const r = await listEntities({ placed: false, limit: 300 });
    return r.entities.filter((e) => !e.disabled && !e.hidden && e.area_id).map((e) => ({ entity_id: e.entity_id, name: e.name || e.original_name || e.entity_id, domain: e.domain, device_class: e.device_class, area_id: e.area_id }));
  }
  async catalog() {
    try {
      const lib = await loadLibrary();
      return { lookup3d: lookup3dOf(lib), materials: lookupMaterialsOf(lib) };
    } catch {
      return { lookup3d: null, materials: null };
    }
  }
  async publish(versionId: string, devices: PlacedDevice[]) {
    await publishVersion(versionId); // publishing the version publishes its structure too (routers/plan_geometry.py)
    let placed = 0;
    let failed = 0;
    // one by one, never retried: a refused anchor (no placement right in that scope, already placed meanwhile) is counted, not hidden
    for (const d of devices) {
      try {
        await createAnchor(this.floorId, { resource_type: 'ha_entity', resource_id: d.entity_id, x: d.x, y: d.y, level_id: d.level_id });
        placed += 1;
      } catch {
        failed += 1;
      }
    }
    return { placed, failed };
  }
}

/** Demo mode: the sample house, the answers a moment later, nothing stored but the choices (per browser). */
class DemoBackend implements WizardBackend {
  readonly demo = true;
  private doc: GeometryDoc = demoBaseDoc();
  private revision = 0;
  private wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  private static prefsMem: WizardPrefs | null = null;

  async prefs() {
    return normalizePrefs(DemoBackend.prefsMem);
  }
  async savePrefs(p: WizardPrefs) {
    DemoBackend.prefsMem = { ...p };
  }
  async upload(file: File) {
    await this.wait(150);
    return { assetId: 'demo-asset', name: file.name, pages: [{ page: 1, url: '' }] };
  }
  async createVersion() {
    return { versionId: 'demo-wizard', imageUrl: planDrawingDataUrl(demoTruthDoc()), width: this.doc.dimensions.width_px, height: this.doc.dimensions.height_px };
  }
  async draft() {
    return { doc: this.doc, revision: this.revision };
  }
  async detect() {
    await this.wait(900);
    return demoDetect();
  }
  async estimate() {}
  async measure(_v: string, a: [number, number], b: [number, number], metres: number) {
    const px = Math.hypot((b[0] - a[0]) * this.doc.dimensions.width_px, (b[1] - a[1]) * this.doc.dimensions.height_px);
    const s = metres / Math.max(1, px);
    this.doc = { ...this.doc, dimensions: { ...this.doc.dimensions, scale_m_per_px: s, calibration: { status: 'measured', method: 'two_point', pairs: [{ a, b, metres }], residual_pct: null, reason: null } } };
    return s;
  }
  async accept(_v: string, body: AcceptRequest) {
    const keep = new Set(body.accepted);
    const ed = body.edits as Record<string, Record<string, unknown>>;
    this.doc = {
      ...this.doc,
      walls: body.candidates.walls.filter((w) => keep.has(w.id)).map((w) => ({ ...w, ...(ed[w.id] ?? {}) })),
      openings: body.candidates.openings.filter((o) => keep.has(o.id)).map((o) => ({ ...o, ...(ed[o.id] ?? {}) })),
      objects: [...this.doc.objects.filter((o) => o.source !== 'auto'), ...(body.candidates.objects ?? []).filter((o) => keep.has(o.id))],
    };
    this.revision += 1;
    return { doc: this.doc, revision: this.revision };
  }
  async detectRooms() {
    await this.wait(200);
    return { rooms: demoRooms(), existingAuto: 0 };
  }
  async acceptRooms(rooms: { polygon: { x: number; y: number }[]; name: string; kind: ZoneKind }[]) {
    return rooms.map((r, i) => ({ id: `demo-room-${i + 1}`, revision: 1, polygon: r.polygon, level_id: 'L0' }));
  }
  async tagRoom() {}
  async areas() {
    return DEMO_AREAS;
  }
  async saveDraft(_v: string, doc: GeometryDoc) {
    this.doc = doc;
    this.revision += 1;
    return { doc: this.doc, revision: this.revision };
  }
  async entities() {
    return DEMO_ENTITIES;
  }
  async catalog() {
    return { lookup3d: null, materials: null };
  }
  async publish(_v: string, devices: PlacedDevice[]) {
    await this.wait(300);
    return { placed: devices.length, failed: 0 };
  }
}

export function wizardBackend(floorId: string): WizardBackend {
  return isApi() ? new ApiBackend(floorId) : new DemoBackend();
}
