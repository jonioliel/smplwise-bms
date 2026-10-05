import type { Page, Route } from '@playwright/test';
import { areaDetail as bubbleAreaDetail } from './bubble-mocks';

// K88 (2.0.1): a mocked backend for the real floor map, the devices screens and the settings map tab - one plan floor
// with two rooms (one linked to the area "living"), one light anchor, the floor's own picture in both variants, the device
// tree with the area's map pointer, the room <-> area link table. Every name is synthetic; no device, no platform.

const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
/** A 2x2 PNG (opaque orange) - enough for an <image> to load. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBFIjN8B/EBgA5UQjPY8YfnQAAAABJRU5ErkJggg==', 'base64');

export const PERMS = ['map.read', 'map.edit', 'map.publish', 'placement.edit', 'devices.read', 'devices.control', 'devices.control_bulk', 'system.configure'];
export const FLOOR = 'f-plan';
export const ZONE_LINKED = 'z-living';
export const ZONE_FREE = 'z-store';

const counts = (o: Partial<Record<string, number | string | null>> = {}) => ({ entities: 0, lights: 0, lights_on: 0, switches: 0, switches_on: 0, covers: 0, covers_open: 0, climate: 0, climate_active: 0, heating: 0, heating_active: 0, media: 0, media_on: 0, locks: 0, locks_locked: 0, alarm: null, cameras: 0, sensors: 0, ...o });
const SYNC = { connected: true, last_snapshot_at: '2026-10-05T10:00:00Z', last_event_at: '2026-10-05T10:00:00Z', last_registry_at: '2026-10-05T09:00:00Z', last_error: null, reconnects: 0, sequence: 10, entities: 4, started_at: '2026-10-05T08:00:00Z', ha_version: null };

function me(perms: string[]) {
  return {
    user: { id: 'u-k88', username: 'k88', display_name: 'יוני', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
    permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
  };
}

const floorRow = { id: FLOOR, building_id: 'b1', name: 'קומת קרקע', level: 0, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: 'v1', plan_width_px: 1200, plan_height_px: 800, draft_version_id: null, anchor_count: 1, camera_count: 0, updated_at: '2026-10-05T08:00:00Z' };
const floor2Row = { ...floorRow, id: 'f-up', name: 'קומה א', level: 1, sort_order: 1, published_version_id: 'v2' };
const building = { id: 'b1', site_id: 's1', name: 'מבנה הדגמה', sort_order: 0, updated_at: '2026-10-05T08:00:00Z', floors: [floorRow, floor2Row] };
const site = { id: 's1', name: 'אתר הדגמה', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '2026-10-05T08:00:00Z', buildings: [building] };

const zone = (id: string, name: string, poly: { x: number; y: number }[], area_id: string | null) => ({
  id, floor_id: FLOOR, plan_version_id: 'v1', name, kind: 'room', polygon: poly, color: '#2767ED', source: 'manual', searchable: true, label_pos: 'auto', level_id: null, ceiling_height_m: null, tags: [], area_id,
  revision: 3, created_at: '2026-10-05T08:00:00Z', updated_at: '2026-10-05T08:00:00Z',
});
export const ZONES = [
  zone(ZONE_LINKED, 'סלון', [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.1, y: 0.5 }], 'living'),
  zone(ZONE_FREE, 'מחסן', [{ x: 0.6, y: 0.6 }, { x: 0.9, y: 0.6 }, { x: 0.9, y: 0.9 }, { x: 0.6, y: 0.9 }], null),
];

function mapBundle(floor: typeof floorRow, images: boolean) {
  return {
    floor, building, site,
    plan: { id: floor.published_version_id, floor_id: floor.id, asset_id: 'a1', status: 'published', width_px: 1200, height_px: 800, rotation: 0, crop: null, notes: '', revision: 1, image_url: `api/v1/plan-versions/${floor.published_version_id}/image.png`, stylized_url: null, render_mode: 'source', published_at: '2026-10-05T08:00:00Z', archived_at: null, created_at: '2026-10-05T07:00:00Z', scale_m_per_px: 0.01, calibration_json: null },
    geometry: null, catalog_revision: 'r1', levels: [], circuit_states: {},
    floor_images: images ? { off: `api/v1/floors/${floor.id}/images/off?v=aaaa`, on: `api/v1/floors/${floor.id}/images/on?v=bbbb`, corners: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]], opacity: 0.9 } : null,
    anchors: floor.id === FLOOR ? [{ id: 'an1', floor_id: FLOOR, plan_version_id: 'v1', resource_type: 'ha_entity', resource_id: 'light.salon', position: { x: 0.3, y: 0.3 }, rotation_degrees: 0, field_of_view_degrees: null, layer_id: 'lights', label: 'מנורת הסלון', revision: 1, created_at: '2026-10-05T08:00:00Z', updated_at: '2026-10-05T08:00:00Z', camera: null,
      entity: { entity_id: 'light.salon', domain: 'light', name: 'מנורת הסלון', state: 'on', available: true, fresh: true, last_changed: '2026-10-05T09:50:00Z', attributes: {}, device_class: null, can_control: true, actions: [] } }] : [],
    ha_sync: SYNC, zones: floor.id === FLOOR ? ZONES : [], reach: null, needs_alignment: false, at: null, history: null, history_from: null, ha_history: null,
    permissions: { edit: true, publish: true, import: true, structure: true }, cameras: [],
  };
}

const area = (area_id: string, name: string, floor_id: string, c: Record<string, number | string | null>, map: { floor_id: string; zone_id: string } | null) => ({ area_id, name, icon: null, floor_id, counts: counts(c), has_camera: false, can_bulk: true, climate: [], temperature: null, open_count: 0, map });
const AREAS = [area('living', 'סלון', 'g', { entities: 3, lights: 1, lights_on: 1, sensors: 2 }, { floor_id: FLOOR, zone_id: ZONE_LINKED }), area('kitchen', 'מטבח', 'g', { entities: 2, lights: 1 }, null)];

function tree() {
  return {
    floors: [{ floor_id: 'g', name: 'קומת קרקע', level: 0, icon: null, areas: AREAS, counts: counts({ entities: 5, lights: 2, lights_on: 1, sensors: 2 }), can_bulk: true, climate: [] }],
    unassigned: { area_id: 'unassigned', name: 'ללא שיוך', counts: counts() }, building: counts({ entities: 5, lights: 2, lights_on: 1, sensors: 2 }), building_climate: [], scoped: false, can_bulk: true, sync: SYNC,
  };
}

function areaDetail() {
  const a = AREAS[0];
  const base = bubbleAreaDetail('living');
  return { ...base, area: { ...base.area, map: a.map }, floor_areas: AREAS.map((x) => ({ area_id: x.area_id, name: x.name, icon: null, counts: x.counts })) };
}

export interface K88MockState {
  /** Every POST /plan/area-links body and every PATCH /settings body the page sent. */
  linkPosts: unknown[];
  settingsPatches: Record<string, unknown>[];
  settings: Record<string, unknown>;
}

function linksTable(rows: { zone_id: string; area_id: string | null }[]) {
  const areas = [{ area_id: 'living', name: 'סלון', floor_id: 'g', floor_name: 'קומת קרקע' }, { area_id: 'kitchen', name: 'מטבח', floor_id: 'g', floor_name: 'קומת קרקע' }, { area_id: 'store', name: 'מחסן', floor_id: null, floor_name: null }];
  const out = rows.map((r) => {
    const z = ZONES.find((x) => x.id === r.zone_id)!;
    const linked = areas.find((a) => a.area_id === r.area_id) ?? null;
    const sug = !linked ? areas.find((a) => a.name === z.name) ?? null : null;
    return { zone_id: z.id, zone_name: z.name, kind: 'room', revision: 3, floor_id: FLOOR, floor_name: 'קומת קרקע', floor_level: 0, building_name: 'מבנה הדגמה', area_id: linked?.area_id ?? null, area_name: linked?.name ?? null, dangling: false,
      suggestion: sug ? { area_id: sug.area_id, area_name: sug.name, score: 1 } : null, status: linked ? 'linked' : sug ? 'suggested' : 'none' };
  });
  return { rows: out, areas, counts: { linked: out.filter((r) => r.status === 'linked').length, suggested: out.filter((r) => r.status === 'suggested').length, none: out.filter((r) => r.status === 'none').length, dangling: 0 } };
}

/** Installs the mocked API on `page`; `surfaces` is the plan.surfaces setting the mock answers. */
export async function installK88Mock(page: Page, opts: { perms?: string[]; surfaces?: string[]; images?: boolean } = {}): Promise<K88MockState> {
  const st: K88MockState = { linkPosts: [], settingsPatches: [], settings: { 'ui.design': 'a', 'ui.scheme': 'light', 'devices.style': 'smplwise', 'plan.surfaces': opts.surfaces ?? ['devices', 'area'], 'plan.quality': '1', 'map.default_view': '2d', 'plan.levels': 'all', 'plan.presence_fade': '3' } };
  const perms = opts.perms ?? PERMS;
  const images = opts.images ?? true;
  let links: { zone_id: string; area_id: string | null }[] = ZONES.map((z) => ({ zone_id: z.id, area_id: z.area_id }));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, me(perms));
    if (p === 'me/prefs') return json(route, req.method() === 'PUT' ? { prefs: req.postDataJSON() ?? {}, stored: [] } : { prefs: {}, stored: [] });
    if (p === 'settings') {
      if (req.method() === 'PATCH') {
        const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
        st.settingsPatches.push(body);
        st.settings = { ...st.settings, ...body };
      }
      return json(route, { settings: st.settings, can_edit: true, nvr_channels: [], warnings: [] });
    }
    if (p === 'sites' && url.searchParams.get('tree') === 'true') return json(route, { sites: [site], can_create_site: true });
    if (p === `floors/${FLOOR}/map`) return json(route, mapBundle(floorRow, images));
    if (p === 'floors/f-up/map') return json(route, mapBundle(floor2Row, false));
    if (/^floors\/[^/]+\/images\/(off|on)$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (/^plan-versions\/[^/]+\/image\.png$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === 'devices/tree') return json(route, tree());
    if (p === 'devices/areas/living') return json(route, areaDetail());
    if (p === 'plan/areas') return json(route, { areas: linksTable(links).areas });
    if (p === 'plan/area-links') {
      if (req.method() === 'POST') {
        const body = (req.postDataJSON() ?? {}) as { links: { zone_id: string; area_id: string | null }[] };
        st.linkPosts.push(body);
        links = links.map((l) => { const c = body.links.find((x) => x.zone_id === l.zone_id); return c ? { ...l, area_id: c.area_id || null } : l; });
        return json(route, { changed: body.links.length, ...linksTable(links) });
      }
      return json(route, linksTable(links));
    }
    if (p === 'catalog/objects') return json(route, { catalog_version: '1', revision: 'r1', categories: [], icons: [], color_tokens: [], items: [] });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p.startsWith('devices/layouts/')) return json(route, NOT_FOUND, 404);
    if (p === 'home' || p.startsWith('home/')) return json(route, NOT_FOUND, 404);
    return json(route, NOT_FOUND, 404);
  });
  return st;
}
