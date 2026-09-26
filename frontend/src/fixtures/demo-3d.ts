/**
 * The demo floors as a 3D scene input (T087): each demo room becomes a walled room with a door and a ceiling lamp, the
 * first room gets six chairs, the demo cameras and entities become anchors whose ids are the demo ids the floor map
 * already selects (cam-1, light.lobby, ...), so the demo card opens from a 3D click. Used by the style guide (the element's
 * browser test) and by the floor map in demo mode; never with a backend.
 */
import { demoCameras, demoEntities, demoFloors, demoRooms } from './demo';
import type { GeometryDoc, GeomObject, GeomOpening, GeomWall } from '../map/geometry';
import type { Catalog3DLookup, SceneAnchor, SceneInput } from '../map/scene-builder';

const PX_PER_M = 60;

const demoCatalog: Catalog3DLookup = (id) => (id.startsWith('light.')
  ? { shape: 'cylinder', color_token: 'light', role: 'light', mesh: null }
  : { shape: 'box', color_token: 'furniture', role: 'furniture', mesh: null });

const object = (id: string, item_id: string, position: [number, number], size: GeomObject['size'], z_m: number): GeomObject => ({
  id, item_id, level_id: 'L0', position, rotation_deg: 0, size, z_m, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {},
});

export function demoSceneInput(floorId: string): SceneInput | null {
  const floor = demoFloors.find((f) => f.id === floorId);
  const rooms = demoRooms(floorId);
  if (!floor?.hasPlan || !rooms.length) return null;
  const walls: GeomWall[] = [];
  const openings: GeomOpening[] = [];
  const objects: GeomObject[] = [];
  rooms.forEach((r, i) => {
    const id = `dw${i}`;
    walls.push({ id, level_id: 'L0', polyline: [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h], [r.x, r.y]], thickness_m: 0.15, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {} });
    openings.push({ id: `do${i}`, wall_id: id, t: 0.12, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'left', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {} });
    objects.push(object(`dl${i}`, 'light.ceiling', [r.x + r.w / 2, r.y + r.h / 2], { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, -0.3));
  });
  const r0 = rooms[0];
  for (let k = 0; k < 6; k++) objects.push(object(`dc${k}`, 'chair.basic', [r0.x + r0.w * (0.25 + 0.25 * (k % 3)), r0.y + r0.h * (0.35 + 0.3 * Math.floor(k / 3))], { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, 0));
  const doc: GeometryDoc = {
    schema_version: '2.0', plan_version_id: `demo-${floorId}`, floor_id: floorId, source: { sha256: '', file_name: 'demo', mime: 'image/svg+xml', page: 1 },
    dimensions: { width_px: floor.planWidth, height_px: floor.planHeight, scale_m_per_px: 1 / PX_PER_M, calibration: { status: 'measured', method: 'manual', pairs: [], residual_pct: null, reason: null } },
    transform: { rotation: 0, crop: null },
    levels: [{ id: 'L0', name: 'קומה', elevation_m: 0, ceiling_height_m: 3, is_default: true }],
    walls, openings, rooms: [], objects, circuits: [], connectors: [], labels: [], groups: [], uncertain_regions: [], uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'demo', tokens_version: 'map-1', detector_version: null },
  };
  const cams = demoCameras.filter((c) => c.floorId === floorId);
  const ents = demoEntities.filter((e) => e.floorId === floorId);
  const anchors: SceneAnchor[] = [
    ...cams.map((c): SceneAnchor => ({ id: c.id, resource_type: 'camera', resource_id: c.id, x: c.x, y: c.y, rotation: c.rotation, fov: c.fov, radius: null, polygon: null, level_id: null, layer_id: 'cameras', label: c.name, state: null, online: c.state !== 'offline', mount_height_m: null, tilt_deg: null })),
    ...ents.map((e): SceneAnchor => ({ id: e.id, resource_type: 'ha_entity', resource_id: e.id, x: e.x, y: e.y, rotation: 0, fov: null, radius: null, polygon: null, level_id: null, layer_id: e.domain === 'lock' ? 'doors' : e.domain === 'light' ? 'lights' : 'sensors', label: e.name, state: e.state, online: null, mount_height_m: null, tilt_deg: null })),
  ];
  return { doc, width: floor.planWidth, height: floor.planHeight, anchors, entityStates: Object.fromEntries(ents.map((e) => [e.id, e.state])), circuitStates: {}, catalog: demoCatalog, zones: [] };
}

/** Hover labels for the demo scene: anchors by name, walls / doors / objects by kind. */
export function demoSceneLabels(floorId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of demoCameras) if (c.floorId === floorId) out[c.id] = c.name;
  for (const e of demoEntities) if (e.floorId === floorId) out[e.id] = e.name;
  demoRooms(floorId).forEach((_, i) => {
    out[`dw${i}`] = 'קיר';
    out[`do${i}`] = 'דלת';
    out[`dl${i}`] = 'מנורת תקרה';
  });
  for (let k = 0; k < 6; k++) out[`dc${k}`] = 'כיסא';
  return out;
}
