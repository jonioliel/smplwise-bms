import type { APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The site the HUD evidence runs on (tests/evidence-hud-opaque-live.spec.ts, and the before / after screenshot runs): the REAL backend of the
// devices fixture (tests/fixtures/devices_fake_ha.py: SW_LIVE=1 SW_DEVICES_FIXTURE=1, a fake Home Assistant behind the bridge), seeded through its own
// routes - a building of three floors with the apartment plan (the detector's walls and doors), the ground floor with four named rooms, four
// cameras, lights / a presence sensor / an open door / a thermometer on the plan, a lighting circuit, a second level; the floors above and below
// carry one device each so the floor strip's state dots light. Nothing here is a real device, address or secret. Erasable TypeScript only (Node
// imports this file directly from the screenshot scripts).

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const HUD_PLAN = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'tests', 'fixtures', 'plan_detect', 'apartment.png');

export interface HudSeed {
  site: string;
  building: string;
  /** Floor ids in the order created: ground, first, basement. */
  floors: string[];
  main: string;
  versions: string[];
  cameras: string[];
}

export const HUD_FLOORS = [
  { name: 'קרקע', level: 0 },
  { name: 'קומה 1', level: 1 },
  { name: 'קומה -1', level: -1 },
] as const;

const WALL = (id: string, polyline: [number, number][], level = 'L0', extra: Record<string, unknown> = {}) => ({ id, level_id: level, polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'interior', confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const OBJ = (id: string, item_id: string, position: [number, number], size: { w_m: number; d_m: number; h_m: number }, extra: Record<string, unknown> = {}) =>
  ({ id, item_id, level_id: 'L0', position, rotation_deg: 0, size, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });
const ZONE = (name: string, a: [number, number], b: [number, number]) => ({ name, kind: 'room', polygon: [{ x: a[0], y: a[1] }, { x: b[0], y: a[1] }, { x: b[0], y: b[1] }, { x: a[0], y: b[1] }] });

async function ok<T = Record<string, unknown>>(res: { status(): number; json(): Promise<unknown>; text(): Promise<string> }, what: string): Promise<T> {
  if (res.status() >= 300) throw new Error(`${what}: ${res.status()} ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

/** One floor with the apartment picture, its calibration (1 px = 1 cm) and the detector's structure, published. Returns its ids. */
async function seedFloor(api: APIRequestContext, building: string, floor: { name: string; level: number }) {
  const f = await ok<{ id: string }>(await api.post(`api/v1/buildings/${building}/floors`, { data: floor }), 'floor');
  const asset = await ok<{ id: string }>(await api.post(`api/v1/floors/${f.id}/plan-assets`, { multipart: { file: { name: 'apartment.png', mimeType: 'image/png', buffer: fs.readFileSync(HUD_PLAN) } } }), 'asset');
  const version = await ok<{ id: string }>(await api.post(`api/v1/floors/${f.id}/plan-versions`, { data: { asset_id: asset.id } }), 'version');
  await ok(await api.post(`api/v1/plan-versions/${version.id}/publish`), 'publish version');
  await ok(await api.patch(`api/v1/plan-versions/${version.id}/calibration`, { data: { pairs: [{ a: [0.075, 0.5], b: [0.925, 0.5], metres: 13.6 }] } }), 'calibration');
  const det = await ok<{ walls: { id: string }[]; openings: { id: string }[]; objects?: { id: string }[] }>(await api.post(`api/v1/plan-versions/${version.id}/detect`, { data: { targets: ['walls', 'openings'] } }), 'detect');
  const g = await ok<{ geometry: { revision: number } }>(await api.get(`api/v1/plan-versions/${version.id}/geometry?draft=true`), 'geometry');
  await ok(
    await api.post(`api/v1/plan-versions/${version.id}/detect/accept`, {
      data: { accepted: [...det.walls.map((w) => w.id), ...det.openings.map((o) => o.id)], candidates: { walls: det.walls, openings: det.openings, objects: det.objects ?? [] }, base_revision: g.geometry.revision },
    }),
    'accept',
  );
  return { floor: f.id, version: version.id };
}

type Draft = { doc: Record<string, unknown> & { levels: unknown[]; walls: unknown[]; objects: unknown[]; circuits: unknown[] }; geometry: { revision: number } };
const draft = async (api: APIRequestContext, version: string) => ok<Draft>(await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`), 'draft');
async function saveAndPublish(api: APIRequestContext, version: string, patch: (doc: Draft['doc']) => Draft['doc']) {
  const g = await draft(api, version);
  await ok(await api.put(`api/v1/plan-versions/${version}/geometry`, { data: { doc: patch(g.doc), base_revision: g.geometry.revision } }), 'save geometry');
  await ok(await api.post(`api/v1/plan-versions/${version}/geometry/publish`), 'publish geometry');
}
const anchor = async (api: APIRequestContext, floor: string, body: Record<string, unknown>) => ok<{ id: string }>(await api.post(`api/v1/floors/${floor}/anchors`, { data: body }), `anchor ${String(body.resource_id)}`);

/** Build the site. `control` is the fake Home Assistant's control server of the fixture backend (SW_FAKE_HA_CONTROL_PORT, default API port + 1). */
export async function seedHud(api: APIRequestContext, control: string, stamp: string): Promise<HudSeed> {
  const site = (await ok<{ id: string }>(await api.post('api/v1/sites', { data: { name: `בדיקת חלונית ${stamp}`, address: '' } }), 'site')).id;
  const building = (await ok<{ id: string }>(await api.post(`api/v1/sites/${site}/buildings`, { data: { name: 'מבנה בדיקה' } }), 'building')).id;
  const seed: HudSeed = { site, building, floors: [], main: '', versions: [], cameras: [] };
  for (const f of HUD_FLOORS) {
    const s = await seedFloor(api, building, f);
    seed.floors.push(s.floor);
    seed.versions.push(s.version);
  }
  seed.main = seed.floors[0];
  const [v0, v1, v2] = seed.versions;

  // devices as if Home Assistant sent them (developer identity mode), cameras as an NVR discovery would register them
  await ok(
    await api.post('api/v1/ha/dev/states', {
      data: {
        states: [
          { entity_id: 'light.living_main', state: 'on', attributes: { friendly_name: 'תאורת סלון' } },
          { entity_id: 'light.kitchen_main', state: 'off', attributes: { friendly_name: 'תאורת מטבח' } },
          { entity_id: 'binary_sensor.living_motion', state: 'on', attributes: { friendly_name: 'תנועה בסלון', device_class: 'motion' } },
          { entity_id: 'binary_sensor.front_door', state: 'on', attributes: { friendly_name: 'דלת כניסה', device_class: 'door' } },
          { entity_id: 'sensor.living_temp', state: '23.5', attributes: { friendly_name: 'טמפרטורה בסלון', device_class: 'temperature', unit_of_measurement: '°C' } },
          { entity_id: 'switch.living_lights', state: 'on', attributes: { friendly_name: 'מפסק תאורת סלון' } },
          { entity_id: 'light.upstairs_hall', state: 'on', attributes: { friendly_name: 'תאורת מסדרון עליון' } },
          { entity_id: 'binary_sensor.basement_door', state: 'on', attributes: { friendly_name: 'דלת מרתף', device_class: 'door' } },
        ],
      },
    }),
    'states',
  );
  const cams = await ok<{ cameras: Record<string, string> }>(
    await api.post(`${control}/seed-cameras`, { data: { model: 'DS-7616NXI-K2/D', cameras: [
      { channel: 1, alias: 'כניסה ראשית', status: 'online' },
      { channel: 2, alias: 'סלון', status: 'online' },
      { channel: 3, alias: 'מטבח', status: 'offline' },
      { channel: 4, alias: 'משרד', status: 'online' },
    ] } }),
    'cameras',
  );
  seed.cameras = Object.values(cams.cameras);

  // the ground floor: rooms, devices on the plan, the structure's second level, furniture, a lamp circuit
  for (const z of [ZONE('סלון', [0.09, 0.12], [0.49, 0.49]), ZONE('מטבח', [0.51, 0.12], [0.91, 0.57]), ZONE('חדר שינה', [0.09, 0.51], [0.49, 0.89]), ZONE('משרד', [0.51, 0.6], [0.91, 0.89])]) {
    await ok(await api.post(`api/v1/floors/${seed.main}/zones`, { data: z }), 'zone');
  }
  const camSpots: [number, number, number, number][] = [[0.28, 0.86, 0, 80], [0.46, 0.14, 200, 90], [0.88, 0.14, 230, 80], [0.88, 0.86, 300, 70]];
  for (let i = 0; i < seed.cameras.length; i++) {
    const [x, y, rot, fov] = camSpots[i];
    await anchor(api, seed.main, { resource_type: 'camera', resource_id: seed.cameras[i], x, y, rotation_degrees: rot, field_of_view_degrees: fov, coverage_radius: 0.16, mount_height_m: 2.6, tilt_deg: 15 });
  }
  const spots: [string, number, number][] = [['light.living_main', 0.28, 0.3], ['light.kitchen_main', 0.7, 0.3], ['binary_sensor.living_motion', 0.2, 0.2], ['binary_sensor.front_door', 0.25, 0.92], ['sensor.living_temp', 0.4, 0.42]];
  for (const [id, x, y] of spots) await anchor(api, seed.main, { resource_type: 'ha_entity', resource_id: id, x, y, rotation_degrees: 0, field_of_view_degrees: null });
  await anchor(api, seed.floors[1], { resource_type: 'ha_entity', resource_id: 'light.upstairs_hall', x: 0.3, y: 0.3, rotation_degrees: 0, field_of_view_degrees: null });
  await anchor(api, seed.floors[2], { resource_type: 'ha_entity', resource_id: 'binary_sensor.basement_door', x: 0.3, y: 0.85, rotation_degrees: 0, field_of_view_degrees: null });

  await saveAndPublish(api, v0, (doc) => ({
    ...doc,
    levels: [...doc.levels, { id: 'L1', name: 'גלריה', elevation_m: 2.9, ceiling_height_m: 2.6, is_default: false, external_ids: {} }],
    walls: [...doc.walls, WALL('g-n', [[0.1, 0.14], [0.48, 0.14]], 'L1'), WALL('g-e', [[0.48, 0.14], [0.48, 0.3]], 'L1'), WALL('g-s', [[0.48, 0.3], [0.1, 0.3]], 'L1', { kind: 'low', height_m: 1 })],
    objects: [
      ...doc.objects,
      OBJ('sofa', 'sofa.3', [0.24, 0.4], { w_m: 2, d_m: 0.9, h_m: 0.8 }),
      OBJ('chair', 'armchair', [0.4, 0.34], { w_m: 0.8, d_m: 0.8, h_m: 0.8 }),
      OBJ('cab', 'cabinet.tall', [0.15, 0.7], { w_m: 1, d_m: 0.5, h_m: 1.9 }),
      OBJ('kit', 'kitchenette.counter', [0.78, 0.17], { w_m: 2.2, d_m: 0.6, h_m: 0.9 }),
      OBJ('fridge', 'fridge.kitchen', [0.88, 0.3], { w_m: 0.7, d_m: 0.7, h_m: 1.8 }),
      OBJ('lamp-1', 'light.ceiling', [0.28, 0.3], { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, { z_m: 2.5, anchor_ref: { resource_type: 'ha_entity', resource_id: 'light.living_main' } }),
      OBJ('lamp-2', 'light.ceiling', [0.7, 0.3], { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, { z_m: 2.5, anchor_ref: { resource_type: 'ha_entity', resource_id: 'light.kitchen_main' } }),
    ],
    circuits: [{ id: 'k1', name: 'מעגל סלון', switch_entity_id: 'switch.living_lights', member_ids: ['lamp-1'], color_token: 'circuit-1', power_w: 36 }],
  }));
  // the other floors keep the detector's structure; publishing it makes them listed with a plan in the strip
  await saveAndPublish(api, v1, (doc) => doc);
  await saveAndPublish(api, v2, (doc) => doc);
  return seed;
}

/** Remove what seedHud made (the floors force-deleted with their anchors, then the building and the site). */
export async function unseedHud(api: APIRequestContext, seed: HudSeed): Promise<void> {
  for (const f of seed.floors) await api.delete(`api/v1/floors/${f}?force=true`);
  if (seed.building) await api.delete(`api/v1/buildings/${seed.building}`);
  if (seed.site) await api.delete(`api/v1/sites/${seed.site}`);
}
