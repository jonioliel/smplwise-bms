import type { Page, Route, WebSocketRoute } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeometryDoc, GeomObject, GeomOpening, GeomWall } from '../src/map/geometry';

// PERF3D-295: a mocked backend for the live floor map's 3D view at the size of a real home, for the performance harness
// (perf-plan-3d.spec.ts). The replay mock's floor (two rooms, five anchors) is far lighter than the owner's house; this one is
// generated: two levels of `nx` x `ny` rooms each, interior walls with a door per room, windows along the outside, furniture
// and a ceiling lamp per room, five HA entities per room (a light, a door sensor, a temperature, a power meter, a motion
// sensor) and a camera per level corner. The HA push socket is mocked too, so the harness can replay the live pushes of a
// house (a power meter ticking) at a fixed cadence. Every name is synthetic; no device, no platform, no network beyond the page.

export const FLOOR = 'f-perf';
export const VERSION = 'v-perf';
const PUBLISHED = '2026-06-01T00:00:00Z';
const NOW = '2026-10-20T09:30:00Z';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as Record<string, unknown>;
const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBFIjN8B/EBgA5UQjPY8YfnQAAAABJRU5ErkJggg==', 'base64');

export interface HouseSize {
  /** Rooms across and down on every level. */
  nx: number;
  ny: number;
  levels: number;
}
export const HOUSE: HouseSize = { nx: 4, ny: 3, levels: 2 };
/** The plan in pixels at 1 cm a pixel: a 20 x 14 m house. */
const W_PX = 2000;
const H_PX = 1400;
const X0 = 0.05;
const X1 = 0.95;
const Y0 = 0.05;
const Y1 = 0.95;

type P = [number, number];
interface Cell {
  id: string;
  level: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  cx: number;
  cy: number;
}

const wall = (id: string, level: string, polyline: P[], thickness_m: number, kind: string): GeomWall => ({ id, level_id: level, polyline, thickness_m, height_m: null, base_z_m: 0, kind, confidence: 1, source: 'manual', locked: false, external_ids: {} } as GeomWall);
const opening = (id: string, wall_id: string, t: number, kind: 'door' | 'window', extra: Partial<GeomOpening> = {}): GeomOpening => ({
  id, wall_id, t, kind, width_m: kind === 'door' ? 0.9 : 1.4, height_m: kind === 'door' ? 2.1 : 1.2, sill_m: kind === 'door' ? 0 : 0.9, swing: 'left', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {}, ...extra,
} as GeomOpening);
const object = (id: string, level: string, item_id: string, position: P, size: GeomObject['size'], z_m: number, extra: Partial<GeomObject> = {}): GeomObject => ({
  id, item_id, level_id: level, position, rotation_deg: 0, size, z_m, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra,
} as GeomObject);
const ref = (entity: string) => ({ anchor_ref: { resource_type: 'ha_entity', resource_id: entity } }) as Partial<GeomObject>;

function levelsOf(h: HouseSize) {
  return Array.from({ length: h.levels }, (_, i) => ({ id: `L${i}`, name: i === 0 ? 'קרקע' : `קומה ${i}`, elevation_m: i * 3.2, ceiling_height_m: 2.9, is_default: i === 0 }));
}

function cells(h: HouseSize): Cell[] {
  const out: Cell[] = [];
  for (const lv of levelsOf(h))
    for (let j = 0; j < h.ny; j++)
      for (let i = 0; i < h.nx; i++) {
        const x0 = X0 + ((X1 - X0) * i) / h.nx;
        const x1 = X0 + ((X1 - X0) * (i + 1)) / h.nx;
        const y0 = Y0 + ((Y1 - Y0) * j) / h.ny;
        const y1 = Y0 + ((Y1 - Y0) * (j + 1)) / h.ny;
        out.push({ id: `${lv.id}-r${j}${i}`, level: lv.id, x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
      }
  return out;
}

/** The rooms whose spot lamps are on a switched circuit: the first two of every level. */
const circuitRooms = (h: HouseSize): string[] => cells(h).filter((_, n) => n % (h.nx * h.ny) < 2).map((c) => c.id);

/** The published structure of the generated house. */
export function houseDoc(h: HouseSize = HOUSE): GeometryDoc {
  const walls: GeomWall[] = [];
  const openings: GeomOpening[] = [];
  const objects: GeomObject[] = [];
  const circuits: GeometryDoc['circuits'] = [];
  for (const lv of levelsOf(h)) {
    const L = lv.id;
    walls.push(wall(`${L}-w-out`, L, [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1], [X0, Y0]], 0.25, 'exterior'));
    // the outside: two windows per room along the outer edge (t over the closed ring of four sides)
    for (let k = 0; k < 2 * (h.nx + h.ny); k++) openings.push(opening(`${L}-win-${k}`, `${L}-w-out`, (k + 0.5) / (2 * (h.nx + h.ny)), 'window'));
    for (let i = 1; i < h.nx; i++) {
      const x = X0 + ((X1 - X0) * i) / h.nx;
      walls.push(wall(`${L}-w-v${i}`, L, [[x, Y0], [x, Y1]], 0.12, 'interior'));
      for (let j = 0; j < h.ny; j++) openings.push(opening(`${L}-door-v${i}-${j}`, `${L}-w-v${i}`, (j + 0.5) / h.ny, 'door', j === 0 ? ref(`binary_sensor.${L}_door_v${i}`) : {}));
    }
    for (let j = 1; j < h.ny; j++) {
      const y = Y0 + ((Y1 - Y0) * j) / h.ny;
      walls.push(wall(`${L}-w-h${j}`, L, [[X0, y], [X1, y]], 0.12, 'interior'));
      for (let i = 0; i < h.nx; i++) openings.push(opening(`${L}-door-h${j}-${i}`, `${L}-w-h${j}`, (i + 0.3) / h.nx, 'door'));
    }
  }
  for (const c of cells(h)) {
    const dx = (c.x1 - c.x0) / 4;
    const dy = (c.y1 - c.y0) / 4;
    objects.push(
      object(`${c.id}-lamp`, c.level, 'light.ceiling', [c.cx, c.cy], { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, -0.3, ref(`light.${c.id}`)),
      object(`${c.id}-table`, c.level, 'table.dining', [c.cx, c.cy + dy * 0.5], { w_m: 1.6, d_m: 0.9, h_m: 0.75 }, 0),
      object(`${c.id}-chair-1`, c.level, 'chair.basic', [c.cx - dx * 0.6, c.cy + dy * 0.5], { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, 0),
      object(`${c.id}-chair-2`, c.level, 'chair.basic', [c.cx + dx * 0.6, c.cy + dy * 0.5], { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, 0),
      object(`${c.id}-sofa`, c.level, 'sofa.3', [c.cx, c.y0 + dy * 0.6], { w_m: 2.1, d_m: 0.9, h_m: 0.85 }, 0),
      object(`${c.id}-cab`, c.level, 'cabinet.low', [c.x0 + dx * 0.5, c.cy], { w_m: 0.9, d_m: 0.45, h_m: 0.9 }, 0),
      object(`${c.id}-spot`, c.level, 'light.spot', [c.x1 - dx * 0.5, c.y1 - dy * 0.5], { w_m: 0.12, d_m: 0.12, h_m: 0.1 }, -0.2),
    );
    // four switched circuits in the house (the host stacks a button per circuit at the map's edge: one per room would cover the canvas)
    if (circuitRooms(h).includes(c.id)) circuits.push({ id: `${c.id}-circ`, name: `מעגל ${c.id}`, switch_entity_id: `switch.${c.id}`, member_ids: [`${c.id}-spot`], color_token: 'light', power_w: 40 } as GeometryDoc['circuits'][number]);
  }
  return {
    schema_version: '2.0', plan_version_id: VERSION, floor_id: FLOOR, source: { sha256: '', file_name: 'plan.png', mime: 'image/png', page: 1 },
    dimensions: { width_px: W_PX, height_px: H_PX, scale_m_per_px: 0.01, calibration: { status: 'measured', method: 'manual', pairs: [], residual_pct: null, reason: null } },
    transform: { rotation: 0, crop: null },
    levels: levelsOf(h),
    walls, openings, rooms: [], objects, circuits,
    connectors: [], labels: [], groups: [], uncertain_regions: [], uncertainty: { overall: 0, notes: [] },
    meta: { generator: 'perf3d-spec', tokens_version: 'map-1', detector_version: null },
  } as unknown as GeometryDoc;
}

const DOMAIN_LAYER: Record<string, string> = { binary_sensor: 'doors', light: 'lights', sensor: 'sensors', camera: 'cameras' };

/** A deterministic state per entity: a third of the lights on, the first door open, motion in two rooms, readings. */
function initialStates(h: HouseSize): Record<string, string> {
  const s: Record<string, string> = {};
  cells(h).forEach((c, n) => {
    s[`light.${c.id}`] = n % 3 === 0 ? 'on' : 'off';
    s[`binary_sensor.${c.id}_motion`] = n === 1 || n === 6 ? 'on' : 'off';
    s[`sensor.${c.id}_temp`] = (21 + (n % 5) * 0.4).toFixed(1);
    s[`sensor.${c.id}_power`] = String(40 + n * 7);
    s[`switch.${c.id}`] = n % 4 === 0 ? 'on' : 'off';
  });
  for (const lv of levelsOf(h)) for (let i = 1; i < h.nx; i++) s[`binary_sensor.${lv.id}_door_v${i}`] = i === 1 ? 'on' : 'off';
  return s;
}

export function haEntity(entity_id: string, state: string) {
  const domain = entity_id.split('.')[0];
  const motion = entity_id.endsWith('_motion');
  const temp = entity_id.endsWith('_temp');
  const power = entity_id.endsWith('_power');
  return {
    entity_id, domain, name: entity_id, state, available: true, fresh: true, last_changed: NOW, attributes: {},
    device_class: domain === 'binary_sensor' ? (motion ? 'motion' : 'door') : temp ? 'temperature' : power ? 'power' : null,
    unit: temp ? '°C' : power ? 'W' : null, can_control: false, actions: [],
  };
}

function anchors(h: HouseSize, states: Record<string, string>) {
  const base = { floor_id: FLOOR, plan_version_id: VERSION, coverage_radius: null, coverage_polygon: null, revision: 1, effective_from: PUBLISHED, effective_to: null, updated_at: PUBLISHED, mount_height_m: null, tilt_deg: null };
  const out: Record<string, unknown>[] = [];
  const ent = (id: string, level: string, x: number, y: number, entity_id: string) => {
    const domain = entity_id.split('.')[0];
    out.push({ ...base, id, level_id: level, resource_type: 'ha_entity', resource_id: entity_id, position: { x, y }, rotation_degrees: 0, field_of_view_degrees: null, layer_id: DOMAIN_LAYER[domain] ?? 'sensors', label: entity_id, camera: null, entity: haEntity(entity_id, states[entity_id] ?? 'unknown') });
  };
  for (const c of cells(h)) {
    const dx = (c.x1 - c.x0) / 5;
    const dy = (c.y1 - c.y0) / 5;
    ent(`an-${c.id}-light`, c.level, c.cx, c.cy, `light.${c.id}`);
    ent(`an-${c.id}-motion`, c.level, c.x0 + dx, c.y0 + dy, `binary_sensor.${c.id}_motion`);
    ent(`an-${c.id}-temp`, c.level, c.x1 - dx, c.y0 + dy, `sensor.${c.id}_temp`);
    ent(`an-${c.id}-power`, c.level, c.x1 - dx, c.y1 - dy, `sensor.${c.id}_power`);
  }
  for (const lv of levelsOf(h))
    for (let i = 1; i < h.nx; i++) {
      const x = X0 + ((X1 - X0) * i) / h.nx;
      ent(`an-${lv.id}-door-v${i}`, lv.id, x, Y0 + (Y1 - Y0) / h.ny / 2 + 0.03, `binary_sensor.${lv.id}_door_v${i}`);
    }
  levelsOf(h).forEach((lv, k) => {
    const camId = `cam-perf-${k}`;
    out.push({ ...base, id: `an-cam-${k}`, level_id: lv.id, resource_type: 'camera', resource_id: camId, position: { x: X0 + 0.02, y: Y0 + 0.02 }, rotation_degrees: 45, field_of_view_degrees: 90, layer_id: 'cameras', label: null,
      camera: { id: camId, recorder_id: 'rec-1', channel: k + 1, name: `מצלמה ${k + 1}`, name_source: `מצלמה ${k + 1}`, alias: null, enabled: true, sort_order: k, grid_col_span: 1, main_track: null, sub_track: null, status: 'online', last_seen_at: NOW, recorder_enabled: true }, entity: null });
  });
  return out;
}

export interface PerfMock {
  /** Push one entity state over the mocked HA socket (as the add-on does); false while no socket is open. */
  push(entityId: string, state: string): boolean;
  readonly sockets: number;
}

/** Installs the mocked API and HA socket on `page` (before the first navigation). `install` is plan.quality. */
export async function installPerfMock(page: Page, opts: { install?: string; own?: string | null; house?: HouseSize } = {}): Promise<PerfMock> {
  const h = opts.house ?? HOUSE;
  const doc = houseDoc(h);
  const states = initialStates(h);
  const floorRow = { id: FLOOR, building_id: 'b-perf', name: 'בית', level: 0, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: VERSION, plan_width_px: W_PX, plan_height_px: H_PX, draft_version_id: null, anchor_count: 0, camera_count: h.levels, updated_at: PUBLISHED };
  const building = { id: 'b-perf', site_id: 's-perf', name: 'בית בדיקה', sort_order: 0, updated_at: PUBLISHED, floors: [floorRow] };
  const site = { id: 's-perf', name: 'אתר בדיקה', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: PUBLISHED, buildings: [building] };
  const sync = { connected: true, last_snapshot_at: NOW, last_event_at: NOW, last_registry_at: NOW, last_error: null, reconnects: 0, sequence: 1, entities: Object.keys(states).length, started_at: PUBLISHED, ha_version: null };
  const circuitStates = Object.fromEntries(cells(h).filter((c) => circuitRooms(h).includes(c.id)).map((c) => [`${c.id}-circ`, { entity_id: `switch.${c.id}`, name: `מעגל ${c.id}`, color_token: 'light', member_ids: [`${c.id}-spot`], power_w: 40, state: states[`switch.${c.id}`], known: true, fresh: true, available: true, can_control: false, actions: [] }]));
  const zones = cells(h).map((c) => ({ id: `z-${c.id}`, floor_id: FLOOR, plan_version_id: VERSION, name: `חדר ${c.id}`, kind: 'room', polygon: [{ x: c.x0, y: c.y0 }, { x: c.x1, y: c.y0 }, { x: c.x1, y: c.y1 }, { x: c.x0, y: c.y1 }], color: '#2767ED', source: 'manual', searchable: true, label_pos: 'auto', level_id: c.level, ceiling_height_m: null, tags: [], area_id: null, revision: 1, created_at: PUBLISHED, updated_at: PUBLISHED }));
  const bundle = () => ({
    floor: floorRow, building, site,
    plan: { id: VERSION, floor_id: FLOOR, asset_id: 'a-perf', status: 'published', width_px: W_PX, height_px: H_PX, rotation: 0, crop: null, notes: '', revision: 1, image_url: `api/v1/plan-versions/${VERSION}/image.png`, stylized_url: null, render_mode: 'source', published_at: PUBLISHED, archived_at: null, created_at: PUBLISHED, scale_m_per_px: 0.01, calibration_json: null },
    geometry: { id: 'g-perf', plan_version_id: VERSION, floor_id: FLOOR, status: 'published', revision: 1, doc_hash: 'h-perf', published_at: PUBLISHED },
    catalog_revision: 'r-perf', levels: doc.levels, circuit_states: circuitStates, anchors: anchors(h, states), zones,
    cameras: [], ha_sync: sync, reach: null, needs_alignment: false, floor_images: null, bakes: null, at: null, history: null, history_from: null, ha_history: null,
    permissions: { edit: false, publish: false, import: false, structure: false },
  });
  const settings = { 'ui.design': 'a', 'ui.scheme': 'light', 'time.zone': 'Asia/Jerusalem', 'plan.quality': opts.install ?? 'auto', 'map.default_view': '2d', 'plan.levels': 'all', 'site.latitude': 32.08, 'site.longitude': 34.78 };
  const perms = ['map.read', 'events.read', 'recordings.read', 'cameras.read', 'entity.state.read'];
  const me = { user: { id: 'u-perf', username: 'perf', display_name: 'בודק', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' };
  const view = { style: 'auto', default_view: 'schematic', furniture: 'models', textures: 'files', wall_display: 'live', time_source: 'clock', mouse_mode: 'drag', quality: 'auto', kiosk_idle_s: 30, eye_m: 1.65, dpr_cap: 1.25, section_cut: true, show_temps: true, motion: true, walk_guard: true };
  const { default_view: _dv, ...siteDials } = view;
  const open: WebSocketRoute[] = [];
  await page.routeWebSocket('**/api/v1/ha/ws', (ws) => {
    open.push(ws);
    ws.onClose(() => open.splice(open.indexOf(ws), 1));
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, me);
    if (p === 'me/prefs') return json(route, req.method() === 'PUT' ? { prefs: req.postDataJSON() ?? {}, stored: [] } : { prefs: opts.own ? { 'plan.quality': opts.own } : {}, stored: opts.own ? ['plan.quality'] : [] });
    if (p === 'settings') return json(route, { settings, can_edit: false, nvr_channels: [], warnings: [] });
    if (p === 'plan-view/prefs') return json(route, { site: siteDials, own: {}, effective: view, personal_dials: [], can_edit_site: false });
    if (p === 'sites' && url.searchParams.get('tree') === 'true') return json(route, { sites: [site], can_create_site: false });
    if (p === `floors/${FLOOR}/map`) return json(route, bundle());
    if (p === `plan-versions/${VERSION}/image.png`) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === `plan-versions/${VERSION}/geometry/timeline`) return json(route, { timeline: [{ id: 'g-perf', doc_hash: 'h-perf', published_at: PUBLISHED, archived_at: null }] });
    if (p === `plan-versions/${VERSION}/geometry`) return json(route, { geometry: { id: 'g-perf', plan_version_id: VERSION, floor_id: FLOOR, status: 'published', revision: 1, doc_hash: 'h-perf', created_at: PUBLISHED, updated_at: PUBLISHED, published_at: PUBLISHED, published_by: null, archived_at: null }, doc, issues: [], published_hash: 'h-perf' });
    if (p === 'catalog/objects') return json(route, { ...CATALOG, revision: 'r-perf', items: (CATALOG.items as Record<string, unknown>[]).map((i) => ({ custom: false, based_on: null, ...i })) });
    if (p === 'events' || p.startsWith('events?')) return json(route, { events: [], total: 0, limit: 1000, next_cursor: null });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    return json(route, NOT_FOUND, 404);
  });
  return {
    push(entityId: string, state: string): boolean {
      const ws = open[open.length - 1];
      if (!ws) return false;
      ws.send(JSON.stringify({ type: 'entity_state_changed', payload: { entity: haEntity(entityId, state) } }));
      return true;
    },
    get sockets() {
      return open.length;
    },
  };
}

/** The power meters of the generated house, in a fixed order (the harness ticks them as a home's meters do). */
export const powerMeters = (h: HouseSize = HOUSE): string[] => cells(h).map((c) => `sensor.${c.id}_power`);
