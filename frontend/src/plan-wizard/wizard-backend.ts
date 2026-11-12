/**
 * PLAN3D-R28-WIZARD-2433: everything the wizard asks of the server, behind one small interface, so the screen reads the same in
 * demo mode (wizard-demo.ts, nothing sent) and against the add-on. The API side only calls the existing Plan Studio endpoints:
 * plan assets and versions (api/maps.ts), detection, accept, calibration and the draft (api/geometry.ts), room detection and
 * zones (api/zones.ts), the device catalogue (api/ha.ts) and map anchors. Every one is authorized by its own route.
 */
import { ApiError, get, put } from '../api/client';
import { acceptDetection, calibrate, calibrateEstimate, detectStructure, getGeometry, saveGeometryDraft, type AcceptRequest, type CalibrationHint, type DetectResult } from '../api/geometry';
import { createAnchor, createVersion, deleteVersion, listVersions, loadMap, publishVersion, uploadAsset } from '../api/maps';
import { acceptZones, deleteZone, detectZones, listZones, updateZone, type ZoneKind } from '../api/zones';
import { listEntities } from '../api/ha';
import { loadLibrary, lookup3dOf, lookupMaterialsOf } from '../api/plan-catalog';
import { isApi } from '../api/session';
import { resourceUrl } from '../api/client';
import type { GeometryDoc } from '../map/geometry';
import type { Catalog3DLookup } from '../map/scene-builder';
import type { CatalogMaterialLookup } from '../map/material-resolve';
import { DEMO_AREAS, DEMO_CAMERAS, DEMO_ENTITIES, demoBaseDoc, demoDetect, demoRooms, demoTruthDoc } from './wizard-demo';
import { normalizePrefs, type PlaceCamera, type PlaceEntity, type WizardPrefs } from './wizard-model';
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
  /** A device (`ha_entity`, the default) or a camera. */
  resource_type?: 'ha_entity' | 'camera';
  entity_id: string;
  x: number;
  y: number;
  level_id: string | null;
}
/** What the placement after the publish did: every item tried once, a refused one named with the server's code. */
export interface PublishResult {
  placed: number;
  failed: number;
  refused: { id: string; code: string }[];
  /** Nothing was placed because the floor has another open draft (the server would put the items on it, not on this plan). */
  blocked?: 'other_draft';
}
/** A wizard draft the person left mid-way (the newest draft of the floor, made by the wizard). */
export interface ResumeInfo {
  version: VersionInfo;
  createdAt: string;
}
/** A room of a resumed draft: the zone the wizard made earlier, its name and tags. */
export interface ResumedRoom extends CreatedRoom {
  name: string;
  tags: string[];
}
/** The note the wizard leaves on its plan versions: how it knows its own drafts (resume, discard). */
export const WIZARD_NOTE = 'אשף תוכנית חדשה';

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
  /** PLAN3D-R28-WIZARD2-2434: the cameras this person may place here and that are not on this floor yet. */
  cameras(): Promise<PlaceCamera[]>;
  publish(versionId: string, devices: PlacedDevice[]): Promise<PublishResult>;
  /** The floor's newest draft when the wizard made it (null otherwise, or when the floor has no draft). */
  resumable(): Promise<ResumeInfo | null>;
  /** The draft's own rooms (the floor's automatic zones of that version). */
  resumeRooms(versionId: string): Promise<ResumedRoom[]>;
  /** Discard an abandoned wizard draft: its rooms first, then the draft version (the server refuses a non-draft). */
  discard(versionId: string, zoneIds: string[]): Promise<void>;
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
    const v = await createVersion(this.floorId, { asset_id: assetId, page, rotation: 0, crop: null, notes: WIZARD_NOTE });
    return versionInfo(v);
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
  async cameras() {
    const m = await loadMap(this.floorId, true);
    const here = new Set(m.anchors.filter((a) => a.resource_type === 'camera').map((a) => a.resource_id));
    // the bundle's list for an editor is exactly the cameras it may place (placement.edit on their chain, T055)
    return (m.cameras ?? []).filter((c) => !here.has(c.id)).map((c) => ({ id: c.id, name: c.name || c.id }));
  }
  async publish(versionId: string, devices: PlacedDevice[]): Promise<PublishResult> {
    await publishVersion(versionId); // publishing the version publishes its structure too (routers/plan_geometry.py)
    if (!devices.length) return { placed: 0, failed: 0, refused: [] };
    // the server puts a new anchor on the floor's newest DRAFT when there is one (routers/anchors.py _editor_version): with
    // another draft still open the items would not stand on this plan - none is placed, and the person is told why
    const others = await listVersions(this.floorId).then((r) => r.versions.filter((v) => v.status === 'draft' && v.id !== versionId)).catch(() => []);
    if (others.length) return { placed: 0, failed: devices.length, refused: devices.map((d) => ({ id: d.entity_id, code: 'other_draft' })), blocked: 'other_draft' };
    let placed = 0;
    const refused: { id: string; code: string }[] = [];
    // one by one, never retried: a refused anchor (no placement right in that scope, already placed meanwhile) is counted, not hidden
    for (const d of devices) {
      try {
        await createAnchor(this.floorId, { resource_type: d.resource_type ?? 'ha_entity', resource_id: d.entity_id, x: d.x, y: d.y, level_id: d.level_id });
        placed += 1;
      } catch (err) {
        refused.push({ id: d.entity_id, code: err instanceof ApiError ? err.code : 'error' });
      }
    }
    return { placed, failed: refused.length, refused };
  }
  async resumable(): Promise<ResumeInfo | null> {
    const r = await listVersions(this.floorId);
    const newest = r.versions.filter((v) => v.status === 'draft').sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return newest && newest.notes === WIZARD_NOTE ? { version: versionInfo(newest), createdAt: newest.created_at } : null;
  }
  async resumeRooms(versionId: string): Promise<ResumedRoom[]> {
    const r = await listZones(this.floorId);
    return r.zones.filter((z) => z.plan_version_id === versionId && z.source === 'auto')
      .map((z) => ({ id: z.id, revision: z.revision, polygon: z.polygon, level_id: z.level_id ?? null, name: z.name, tags: z.tags ?? [] }));
  }
  async discard(versionId: string, zoneIds: string[]) {
    for (const id of zoneIds) {
      await deleteZone(id).catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) throw err; // a room removed meanwhile is already gone
      });
    }
    await deleteVersion(versionId);
  }
}

function versionInfo(v: { id: string; width_px: number; height_px: number }): VersionInfo {
  const url = (v as unknown as { image_url?: string }).image_url ?? '';
  return { versionId: v.id, imageUrl: url ? resourceUrl(url) : '', width: v.width_px, height: v.height_px };
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
  async cameras() {
    return DEMO_CAMERAS;
  }
  async publish(_v: string, devices: PlacedDevice[]) {
    await this.wait(300);
    return { placed: devices.length, failed: 0, refused: [] };
  }
  /** `?resume=1` (screenshots): the sample house left mid-way, as if the person had gone away after the review. */
  constructor(private readonly resume = false) {}
  async resumable() {
    return this.resume ? { version: await this.createVersion(), createdAt: '2026-11-12T08:30:00Z' } : null;
  }
  async resumeRooms() {
    return [];
  }
  async discard() {
    await this.wait(100);
  }
}

export function wizardBackend(floorId: string, demoResume = false): WizardBackend {
  return isApi() ? new ApiBackend(floorId) : new DemoBackend(demoResume);
}
