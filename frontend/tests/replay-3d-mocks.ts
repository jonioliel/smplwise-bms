import type { Page, Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeometryDoc, GeomObject, GeomOpening, GeomWall } from '../src/map/geometry';

// ST7HIST (CR-029 section 14): a mocked backend for the two replay screens - the history map and the event page - on one
// synthetic floor: two rooms, a door bound to a door sensor, a lamp bound to a light, a lamp on a circuit, a window, a
// camera, a lock and a sensor without history. The floor's map answers the states OF THE ASKED INSTANT: before SWITCH_AT
// everything is off / closed, from it on / open; the live map (no instant) answers the opposite of the event time, so a
// screen that drew a live value would show it. Every name is synthetic; no device, no platform, no network beyond the page.

export const FLOOR = 'f-hist';
export const VERSION = 'v-hist';
export const CAMERA = 'cam-hist';
export const CAM_ANCHOR = 'an-cam';
export const EVENT_ID = 'ev-hist';
/** The states switch here: door open, the hall light and the office circuit on. */
export const SWITCH_AT = '2026-06-21T09:00:00Z';
/** An instant after the switch (12:30 in Israel: the sun high in the south). */
export const T_DAY = '2026-06-21T09:30:00Z';
/** An instant before the switch (one hour earlier). */
export const T_BEFORE = '2026-06-21T08:30:00Z';
/** A night instant after the switch (23:30 in Israel). */
export const T_NIGHT = '2026-06-21T20:30:00Z';
export const SITE = { latitude: 32.08, longitude: 34.78 };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as Record<string, unknown>;
const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
/** A 2x2 PNG (the k88 mock's) - enough for the plan picture to load. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBFIjN8B/EBgA5UQjPY8YfnQAAAABJRU5ErkJggg==', 'base64');
const PUBLISHED = '2026-06-01T00:00:00Z';

const wall = (id: string, polyline: [number, number][], thickness_m: number, kind: string): GeomWall => ({ id, level_id: 'L0', polyline, thickness_m, height_m: null, base_z_m: 0, kind, confidence: 1, source: 'manual', locked: false, external_ids: {} } as GeomWall);
const opening = (id: string, wall_id: string, t: number, kind: 'door' | 'window', extra: Partial<GeomOpening> = {}): GeomOpening => ({
  id, wall_id, t, kind, width_m: kind === 'door' ? 0.9 : 1.4, height_m: kind === 'door' ? 2.1 : 1.2, sill_m: kind === 'door' ? 0 : 0.9, swing: 'left', hinge: 'start', anchor_ref: null, confidence: 1, source: 'manual', external_ids: {}, ...extra,
} as GeomOpening);
const object = (id: string, item_id: string, position: [number, number], size: GeomObject['size'], z_m: number, extra: Partial<GeomObject> = {}): GeomObject => ({
  id, item_id, level_id: 'L0', position, rotation_deg: 0, size, z_m, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra,
} as GeomObject);

/** The published structure: 12 x 8 m, two rooms split by a wall with the sensed door. */
export const DOC: GeometryDoc = {
  schema_version: '2.0', plan_version_id: VERSION, floor_id: FLOOR, source: { sha256: '', file_name: 'plan.png', mime: 'image/png', page: 1 },
  dimensions: { width_px: 1200, height_px: 800, scale_m_per_px: 0.01, calibration: { status: 'measured', method: 'manual', pairs: [], residual_pct: null, reason: null } },
  transform: { rotation: 0, crop: null },
  levels: [{ id: 'L0', name: 'קרקע', elevation_m: 0, ceiling_height_m: 3, is_default: true }],
  walls: [wall('w-out', [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.1, 0.1]], 0.2, 'exterior'), wall('w-mid', [[0.5, 0.1], [0.5, 0.9]], 0.12, 'interior')],
  openings: [
    opening('door-mid', 'w-mid', 0.5, 'door', { anchor_ref: { resource_type: 'ha_entity', resource_id: 'binary_sensor.front_door' } } as Partial<GeomOpening>),
    opening('win-1', 'w-out', 0.15, 'window'),
  ],
  rooms: [],
  objects: [
    object('lamp-a', 'light.ceiling', [0.3, 0.5], { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, -0.3, { anchor_ref: { resource_type: 'ha_entity', resource_id: 'light.hall' } } as Partial<GeomObject>),
    object('lamp-b', 'light.ceiling', [0.7, 0.5], { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, -0.3),
    object('chair-1', 'chair.basic', [0.25, 0.3], { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, 0),
    object('chair-2', 'chair.basic', [0.35, 0.3], { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, 0),
  ],
  circuits: [{ id: 'c-office', name: 'משרד', switch_entity_id: 'switch.office', member_ids: ['lamp-b'], color_token: 'light', power_w: 60 }],
  connectors: [], labels: [], groups: [], uncertain_regions: [], uncertainty: { overall: 0, notes: [] },
  meta: { generator: 'st7hist-spec', tokens_version: 'map-1', detector_version: null },
};

const SYNC = { connected: true, last_snapshot_at: T_DAY, last_event_at: T_DAY, last_registry_at: T_DAY, last_error: null, reconnects: 0, sequence: 1, entities: 5, started_at: PUBLISHED, ha_version: null };
const floorRow = { id: FLOOR, building_id: 'b-hist', name: 'קומת קרקע', level: 0, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: VERSION, plan_width_px: 1200, plan_height_px: 800, draft_version_id: null, anchor_count: 5, camera_count: 1, updated_at: PUBLISHED };
const building = { id: 'b-hist', site_id: 's-hist', name: 'מבנה בדיקה', sort_order: 0, updated_at: PUBLISHED, floors: [floorRow] };
const site = { id: 's-hist', name: 'אתר בדיקה', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: PUBLISHED, buildings: [building] };
const camera = { id: CAMERA, recorder_id: 'rec-1', channel: 1, name: 'מצלמת כניסה', name_source: 'מצלמת כניסה', alias: null, enabled: true, sort_order: 0, grid_col_span: 1, main_track: null, sub_track: null, status: 'online', last_seen_at: T_DAY, recorder_enabled: true };

type Phase = 'on' | 'off';
/** The state of every entity in a phase ("on" = after SWITCH_AT; the live map answers "off"). */
const STATES: Record<string, (p: Phase) => string> = {
  'binary_sensor.front_door': (p) => (p === 'on' ? 'on' : 'off'),
  'light.hall': (p) => (p === 'on' ? 'on' : 'off'),
  'lock.front': (p) => (p === 'on' ? 'unlocked' : 'locked'),
};
const DOMAIN_LAYER: Record<string, string> = { binary_sensor: 'doors', light: 'lights', lock: 'doors', sensor: 'sensors' };

function anchors(at: string | null) {
  const phase: Phase = at === null ? 'off' : at >= SWITCH_AT ? 'on' : 'off';
  const base = { floor_id: FLOOR, plan_version_id: VERSION, coverage_radius: null, coverage_polygon: null, level_id: null, revision: 1, effective_from: PUBLISHED, effective_to: null, updated_at: PUBLISHED, mount_height_m: null, tilt_deg: null };
  const ent = (id: string, x: number, y: number, entity_id: string, name: string) => {
    const domain = entity_id.split('.')[0];
    const known = entity_id in STATES;
    const value = known ? STATES[entity_id](phase) : '21.5';
    const entity = {
      entity_id, domain, name, state: at === null ? value : null, available: true, fresh: at === null, last_changed: SWITCH_AT, attributes: {}, device_class: domain === 'binary_sensor' ? 'door' : domain === 'sensor' ? 'temperature' : null, unit: domain === 'sensor' ? '°C' : null,
      can_control: false, actions: [],
      ...(at === null ? {} : { state_at: known ? { state: value, changed_at: phase === 'on' ? SWITCH_AT : PUBLISHED, known: true, reason: null, source: 'vms' } : { state: null, changed_at: null, known: false, reason: 'אין היסטוריה', source: 'vms' } }),
    };
    return { ...base, id, resource_type: 'ha_entity', resource_id: entity_id, position: { x, y }, rotation_degrees: 0, field_of_view_degrees: null, layer_id: DOMAIN_LAYER[domain] ?? 'sensors', label: name, camera: null, entity };
  };
  return [
    { ...base, id: CAM_ANCHOR, resource_type: 'camera', resource_id: CAMERA, position: { x: 0.15, y: 0.15 }, rotation_degrees: 45, field_of_view_degrees: 90, layer_id: 'cameras', label: null, camera, entity: null },
    ent('an-door', 0.5, 0.42, 'binary_sensor.front_door', 'דלת המעבר'),
    ent('an-hall', 0.3, 0.5, 'light.hall', 'אור המבואה'),
    ent('an-lock', 0.12, 0.6, 'lock.front', 'מנעול הכניסה'),
    ent('an-temp', 0.7, 0.3, 'sensor.office_temp', 'טמפרטורת המשרד'),
  ];
}

/** The floor's map bundle at `at` (null = live). */
export function mapBundle(at: string | null) {
  const phase: Phase = at === null ? 'off' : at >= SWITCH_AT ? 'on' : 'off';
  return {
    floor: floorRow, building, site,
    plan: { id: VERSION, floor_id: FLOOR, asset_id: 'a-hist', status: 'published', width_px: 1200, height_px: 800, rotation: 0, crop: null, notes: '', revision: 1, image_url: `api/v1/plan-versions/${VERSION}/image.png`, stylized_url: null, render_mode: 'source', published_at: PUBLISHED, archived_at: null, created_at: PUBLISHED, scale_m_per_px: 0.01, calibration_json: null },
    geometry: { id: 'g-hist', plan_version_id: VERSION, floor_id: FLOOR, status: 'published', revision: 1, doc_hash: 'h-hist', published_at: PUBLISHED },
    catalog_revision: 'r-hist', levels: DOC.levels,
    circuit_states: { 'c-office': { entity_id: 'switch.office', name: 'משרד', color_token: 'light', member_ids: ['lamp-b'], power_w: 60, state: phase === 'on' ? 'on' : 'off', known: true, fresh: at === null, available: true, can_control: false, actions: [] } },
    anchors: anchors(at),
    zones: [
      { id: 'z-hall', floor_id: FLOOR, plan_version_id: VERSION, name: 'מבואה', kind: 'room', polygon: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }, { x: 0.1, y: 0.9 }], color: '#2767ED', source: 'manual', searchable: true, label_pos: 'auto', level_id: null, ceiling_height_m: null, tags: [], area_id: null, revision: 1, created_at: PUBLISHED, updated_at: PUBLISHED },
      { id: 'z-office', floor_id: FLOOR, plan_version_id: VERSION, name: 'משרד', kind: 'room', polygon: [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.5, y: 0.9 }], color: '#2767ED', source: 'manual', searchable: true, label_pos: 'auto', level_id: null, ceiling_height_m: null, tags: [], area_id: null, revision: 1, created_at: PUBLISHED, updated_at: PUBLISHED },
    ],
    cameras: [], ha_sync: SYNC, reach: null, needs_alignment: false, floor_images: null, bakes: null,
    at, history: at ? 'exact' : null, history_from: null, ha_history: at ? { from: PUBLISHED, to: null, rows: 12, retention_days: 365 } : null,
    permissions: { edit: false, publish: false, import: false, structure: false },
  };
}

const event = {
  id: EVENT_ID, source: 'alertstream', raw_type: 'VMD', type: 'motion', camera_id: CAMERA, camera_name: 'מצלמת כניסה', recorder_id: 'rec-1', channel: 1, occurred_at: T_DAY, ended_at: T_DAY, received_at: T_DAY, state: 'inactive', count: 1, severity: 'info',
  confidence: 'measured', details: {}, acked_at: null, acked_by_username: null, thumbnail: 'unavailable', timezone: 'Asia/Jerusalem',
  location: { anchor_id: CAM_ANCHOR, floor_id: FLOOR, floor_name: 'קומת קרקע', building_id: 'b-hist', building_name: 'מבנה בדיקה', x: 0.15, y: 0.15, zone: 'מבואה', has_plan: true },
};

export interface ReplayMockOptions {
  /** The installation's plan.quality ("auto" | "2" | "1"). */
  install?: string;
  /** The person's own plan.quality in /me/prefs (null = not set). */
  own?: string | null;
  /** The person's default view (plan.view): "realistic" makes `auto` start at the realistic rung. */
  defaultView?: 'schematic' | 'realistic';
  /** The event's time (the event page). */
  eventAt?: string;
}
export interface ReplayMockState {
  /** Every `at` the floor's map was asked for, in order (null = the live map). */
  mapAts: (string | null)[];
}

/** Installs the mocked API on `page` (before the first navigation). */
export async function installReplayMock(page: Page, opts: ReplayMockOptions = {}): Promise<ReplayMockState> {
  const st: ReplayMockState = { mapAts: [] };
  const settings = { 'ui.design': 'a', 'ui.scheme': 'light', 'time.zone': 'Asia/Jerusalem', 'plan.quality': opts.install ?? '1', 'map.default_view': '2d', 'plan.levels': 'all', 'site.latitude': SITE.latitude, 'site.longitude': SITE.longitude };
  const perms = ['map.read', 'events.read', 'recordings.read', 'cameras.read'];
  const me = { user: { id: 'u-hist', username: 'hist', display_name: 'בודק', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' };
  const view = { style: 'auto', default_view: opts.defaultView ?? 'schematic', furniture: 'models', textures: 'files', wall_display: 'live', time_source: 'clock', mouse_mode: 'drag', quality: 'auto', kiosk_idle_s: 30, eye_m: 1.65, dpr_cap: 1.25, section_cut: true, show_temps: false, motion: true, walk_guard: true };
  const { default_view: _dv, ...siteDials } = view;
  const ev = { ...event, occurred_at: opts.eventAt ?? T_DAY, ended_at: opts.eventAt ?? T_DAY, received_at: opts.eventAt ?? T_DAY };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, me);
    if (p === 'me/prefs') return json(route, req.method() === 'PUT' ? { prefs: req.postDataJSON() ?? {}, stored: [] } : { prefs: opts.own ? { 'plan.quality': opts.own } : {}, stored: opts.own ? ['plan.quality'] : [] });
    if (p === 'settings') return json(route, { settings, can_edit: false, nvr_channels: [], warnings: [] });
    if (p === 'plan-view/prefs') return json(route, { site: siteDials, own: {}, effective: view, personal_dials: [], can_edit_site: false });
    if (p === 'sites' && url.searchParams.get('tree') === 'true') return json(route, { sites: [site], can_create_site: false });
    if (p === `floors/${FLOOR}/map`) {
      const at = url.searchParams.get('at');
      st.mapAts.push(at);
      return json(route, mapBundle(at));
    }
    if (p === `plan-versions/${VERSION}/image.png`) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === `plan-versions/${VERSION}/geometry/timeline`) return json(route, { timeline: [{ id: 'g-hist', doc_hash: 'h-hist', published_at: PUBLISHED, archived_at: null }] });
    if (p === `plan-versions/${VERSION}/geometry`) return json(route, { geometry: { id: 'g-hist', plan_version_id: VERSION, floor_id: FLOOR, status: 'published', revision: 1, doc_hash: 'h-hist', created_at: PUBLISHED, updated_at: PUBLISHED, published_at: PUBLISHED, published_by: null, archived_at: null }, doc: DOC, issues: [], published_hash: 'h-hist' });
    if (p === 'catalog/objects') return json(route, { ...CATALOG, revision: 'r-hist', items: (CATALOG.items as Record<string, unknown>[]).map((i) => ({ custom: false, based_on: null, ...i })) });
    if (p === 'events' || p.startsWith('events?')) return json(route, { events: [], total: 0, limit: 1000, next_cursor: null });
    if (p === `events/${EVENT_ID}`) return json(route, ev);
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    return json(route, NOT_FOUND, 404);
  });
  return st;
}
