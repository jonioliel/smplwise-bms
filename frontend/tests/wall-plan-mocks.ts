import { expect, type Locator, type Page, type Route } from '@playwright/test';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { DEFAULT_VIEW } from '../src/api/plan-view';
import type { SkinId } from '../src/design/skins';

// Plan Studio 6, slice S5-B: the mocked backend of a portrait wall display with a map band (CR-030 show_map), shared by
// evidence-wall-plan.spec.ts and pixel-wall-plan.spec.ts. The wall user's profile carries the screen's own plan setting; the floor is
// the demo structure with one lamp circuit, two rooms and a set of stills drawn as SVG in the wire form services/plan_bakes.py sends.
// The device (touch pointer, physical screen size, mobile token) is emulated by the spec so the detection rule picks the wall.

export type Dev = { w: number; h: number; touch: boolean; mobile: boolean };
export const TABLET_P: Dev = { w: 800, h: 1280, touch: true, mobile: false };
export const TABLET_L: Dev = { w: 1280, h: 800, touch: true, mobile: false };

export async function asDevice(page: Page, d: Dev) {
  await page.setViewportSize({ width: d.w, height: d.h });
  await page.addInitScript((dev) => {
    Object.defineProperty(window.screen, 'width', { get: () => dev.w });
    Object.defineProperty(window.screen, 'height', { get: () => dev.h });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => (dev.touch ? 5 : 0) });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ mobile: dev.mobile }) });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => {
      if (/pointer:\s*coarse|hover:\s*none/.test(q)) return { ...mm('all'), matches: dev.touch, media: q } as MediaQueryList;
      return mm(q);
    };
  }, d);
}

// ---- the mocked floor: the demo structure with one lamp circuit, two rooms, a set of stills drawn as SVG
export const input = demoSceneInput('f0')!;
export const rooms = demoRooms('f0');
export const zones = rooms.map((r, i) => ({ id: `z${i}`, floor_id: 'f1', plan_version_id: 'pv1', name: `חדר ${i}`, kind: 'room', polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], color: '#888', source: 'manual', searchable: true, level_id: 'L0' }));
export const doc = { ...input.doc, circuits: [{ id: 'c1', name: 'מנורות', switch_entity_id: 'switch.c1', member_ids: ['dl0'], color_token: 'light', power_w: 40 }] };
export const LIBRARY = {
  catalog_version: '2026.10.1', revision: 'rev1', categories: [], icons: [], color_tokens: [],
  items: [
    { id: 'light.ceiling', category: 'lighting', names: { he: 'מנורה', en: 'lamp' }, tags: [], role: 'light', shape: 'cylinder', size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_ref: 'ceiling', z_m: -0.3, params: {}, params_schema: {}, icon: 'bulb', color_token: 'light', anchor_kinds: ['light'], ifc: { class: 'IfcLamp', predefined_type: 'NOTDEFINED' }, custom: false, based_on: null },
    { id: 'chair.basic', category: 'furniture', names: { he: 'כיסא', en: 'chair' }, tags: [], role: 'furniture', shape: 'box', size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_ref: 'floor', z_m: 0, params: {}, params_schema: {}, icon: 'chair', color_token: 'furniture', anchor_kinds: [], ifc: { class: 'IfcFurniture', predefined_type: 'NOTDEFINED' }, custom: false, based_on: null },
  ],
};
const STILL_W = 800;
const STILL_H = 500;
/** A still as an SVG picture: the floor plate in the style's colour, two room slabs, warm slabs when the lights are on. */
function stillSvg(style: 'light' | 'dark', variant: 'off' | 'on'): string {
  const bg = style === 'light' ? '#dfe6ef' : '#0f1626';
  const slab = variant === 'on' ? '#ffd28a' : style === 'light' ? '#f4f6fa' : '#1c2740';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STILL_W} ${STILL_H}" width="${STILL_W}" height="${STILL_H}"><rect width="${STILL_W}" height="${STILL_H}" fill="${bg}"/>`
    + `<g stroke="${style === 'light' ? '#56617a' : '#8fa0c0'}" stroke-width="6" fill="${slab}"><rect x="60" y="120" width="300" height="300"/><rect x="420" y="120" width="320" height="300"/></g></svg>`;
}
const MASK = {
  version: 1, preset: 'iso', width: STILL_W, height: STILL_H,
  rooms: [
    { id: 'z0', floor: [[60, 120], [360, 120], [360, 420], [60, 420]], top: [[60, 120], [360, 120], [360, 420], [60, 420]], centre: [210, 270] },
    { id: 'z1', floor: [[420, 120], [740, 120], [740, 420], [420, 420]], top: [[420, 120], [740, 120], [740, 420], [420, 420]], centre: [580, 270] },
  ],
  doors: [], cameras: [],
};
const bakesWire = () => {
  const still = (id: string) => ({ url: `api/v1/floors/f1/bakes/${id}/file?v=${id}`, width: STILL_W, height: STILL_H, recipe: 'still-q2.2' }); // the wire form of services/plan_bakes.py
  return {
    bake_key: 'k1', complete: true, stale_count: 0, recipes: ['still-q2.2'],
    levels: { L0: { stills: { 'iso/light/day/off': still('ld0'), 'iso/light/day/on': still('ld1'), 'iso/dark/day/off': still('dd0'), 'iso/dark/day/on': still('dd1') }, masks: { iso: { url: 'api/v1/floors/f1/bakes/mask/file?v=mask' } }, lightmap: null } },
  };
};

export const CAMS = Array.from({ length: 4 }, (_, i) => ({ id: `cam-${i + 1}`, name: `מצלמה ${i + 1}` }));
export const BASE_CFG = {
  cameras: [], scope: 'floor', layout: 'auto', grid: 'auto', rotate_s: 0, stream: 'sub', strip: ['clock', 'date', 'health'], state_entities: [], show_map: true, theme: 'dark',
  alerts: { enabled: true, categories: ['safety'], min_severity: 'alert', ack_allowed: false, takeover_timeout_s: 120, sound: false },
  frame: { enabled: false, folder: null, idle_min: 10, interval_s: 30, fit: 'contain', clock: true, motion: 'none' },
  burn_in: { shift: true, dim_after_min: 30, dim_to: 0.6, shuffle_h: 1 },
  schedule: { windows: [], wake_on_alert_severity: 'critical', wake_on_touch: true },
  offline: { show_last_frame_s: 60, then: 'clock' },
};
export type PlanCfg = { mode: string; quality: string; idle_s: string | number };
export interface Mock {
  plan: PlanCfg | null; // null: a configuration from before the block existed
  floor: string | null;
  dials: Partial<typeof DEFAULT_VIEW>;
  skin: SkinId;
  scheme: 'light' | 'dark';
  theme: 'dark' | 'light' | 'follow';
  circuit: 'on' | 'off';
  version: number;
  admin: boolean;
  patched: Record<string, unknown>[];
  ws: { send: (m: string) => void } | null;
  maps: number;
  /** The floor map of the floor opens in 3D by itself (settings map.default_view) and the site tree lists the floor. */
  floorMap?: boolean;
}
export const newMock = (over: Partial<Mock> = {}): Mock => ({ plan: { mode: 'follow', quality: 'follow', idle_s: 'follow' }, floor: 'f1', dials: {}, skin: 'classic', scheme: 'dark', theme: 'dark', circuit: 'on', version: 1, admin: false, patched: [], ws: null, maps: 0, ...over });

export function profile(st: Mock) {
  const config = { ...BASE_CFG, theme: st.theme, cameras: CAMS.map((c) => c.id), ...(st.plan ? { plan: st.plan } : {}) };
  return { user_id: 'u-wall', username: 'reception', display_name: 'קבלה', title: 'קבלה', area_id: null, floor_id: st.floor, enabled: true, remote_allowed: false, version: st.version, config, status: 'connected', connections: 1, last_seen_at: new Date().toISOString(), last_channel: 'local',
    created_at: '2026-10-05T08:00:00Z', updated_at: '2026-10-05T08:00:00Z', camera_names: CAMS.map((c) => c.name) };
}

export async function install(page: Page, st: Mock) {
  await page.routeWebSocket(/\/api\/v1\/wall\/ws/, (ws) => {
    ws.onMessage(() => {});
    ws.send(JSON.stringify({ version: 1, type: 'hello', payload: { version: st.version, state: 'ok' } }));
    st.ws = ws;
  });
  await page.routeWebSocket(/\/api\/v1\/me\/ws/, () => {});
  await page.routeWebSocket(/\/api\/v1\/ha\/ws/, () => {});
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const perms = st.admin ? ['system.configure', 'rbac.assign', 'map.read', 'video.live', 'entity.state.read', 'devices.read'] : ['map.read', 'video.live', 'wall.view'];
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-wall', username: 'reception', display_name: 'קבלה', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: st.admin ? 'system_admin' : 'kiosk', role_name: st.admin ? 'מנהל' : 'קיוסק', scope_type: st.admin ? 'installation' : 'floor', scope_id: st.admin ? '*' : 'f1', scope_name: 'x', effect: 'allow' }],
        permissions_installation: st.admin ? perms : [], permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full', wall: st.admin ? null : { enabled: true, profile_version: st.version },
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.skin': st.skin, 'ui.scheme': st.scheme, 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {}, 'media.transport_default': 'mse', 'plan.quality': 'auto', ...(st.floorMap ? { 'map.default_view': '3d' } : {}) }, can_edit: st.admin });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'wall/config') {
      const pf = profile(st);
      return json({ title: pf.title, area_id: null, floor_id: st.floor, version: st.version, config: pf.config, cameras: CAMS, server_time: new Date().toISOString(), zone: 'Asia/Jerusalem', alerts: [] });
    }
    if (p.startsWith('wall/states')) return json({ states: [] });
    if (p === 'wall/profiles') return json({ profiles: [profile(st)], max_profiles: 20 });
    if (p.startsWith('wall/profiles/') && req.method() === 'PATCH') {
      const body = req.postDataJSON() as { config?: Record<string, unknown> };
      st.patched.push(body);
      return json(profile(st));
    }
    if (p === 'wall/photo-sets') return json({ sets: [], limits: { max_files: 200, max_bytes: 8388608, formats: [] } });
    if (p === 'cameras') return json({ cameras: CAMS.map((c, i) => ({ ...c, recorder_id: 'r', channel: i + 1, name_source: c.name, alias: null, enabled: true, sort_order: i })), recorder: null, can_sync: false });
    if (p.startsWith('sites')) {
      if (!st.floorMap) return json({ sites: [] });
      const floor = { id: 'f1', building_id: 'b1', name: 'קומה 1', level: 1, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: 'pv1', plan_width_px: input.width, plan_height_px: input.height, draft_version_id: null, anchor_count: 0, camera_count: 0 };
      return json({ sites: [{ id: 's1', name: 'אתר', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '', buildings: [{ id: 'b1', site_id: 's1', name: 'בניין', sort_order: 0, updated_at: '', floors: [floor] }] }], can_create_site: false });
    }
    if (p.startsWith('media/live/')) return json({ code: 'media_unavailable', user_message: 'אין מדיה' }, 503);
    if (p === 'plan-view/prefs') {
      const { default_view: _d, ...site } = { ...DEFAULT_VIEW, ...st.dials };
      return json({ site, own: {}, effective: { ...DEFAULT_VIEW, ...st.dials }, personal_dials: [], can_edit_site: false });
    }
    if (p === 'floors/f1/map') {
      st.maps++;
      return json({
        floor: { id: 'f1', building_id: 'b1', name: 'קומה 1', level: 1, sort_order: 0, ha_area_id: null, has_plan: true, published_version_id: 'pv1', plan_width_px: input.width, plan_height_px: input.height, draft_version_id: null, anchor_count: 0, camera_count: 0 },
        building: { id: 'b1', site_id: 's1', name: 'בניין', sort_order: 0, updated_at: '' }, site: { id: 's1', name: 'אתר', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '' },
        plan: { id: 'pv1', floor_id: 'f1', asset_id: 'a1', page: 1, rotation: 0, crop: null, width_px: input.width, height_px: input.height, scale_m_per_px: 1 / 60, status: 'published', revision: 1, notes: '', created_at: '', published_at: '2026-10-01T00:00:00Z', image_url: 'plan-assets/a1/image' },
        geometry: { id: 'g1', doc_hash: 'h1', status: 'published', revision: 1, published_at: '2026-10-01T00:00:00Z' }, catalog_revision: 'rev1', levels: doc.levels,
        circuit_states: { c1: { entity_id: 'switch.c1', name: null, color_token: null, member_ids: ['dl0'], power_w: 40, state: st.circuit, known: true, fresh: true, available: true, can_control: false, actions: [] } },
        bakes: bakesWire(), anchors: [], zones, needs_alignment: false, permissions: { edit: false, publish: false, import: false, structure: false }, cameras: [],
      });
    }
    if (p.startsWith('plan-versions/pv1/geometry')) return json({ geometry: { id: 'g1', doc_hash: 'h1', status: 'published', revision: 1 }, doc, issues: [], published_hash: 'h1' });
    if (p === 'catalog/objects') return json(LIBRARY);
    const still = /^floors\/f1\/bakes\/(ld0|ld1|dd0|dd1)\/file$/.exec(p);
    if (still) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: stillSvg(still[1].startsWith('l') ? 'light' : 'dark', still[1].endsWith('1') ? 'on' : 'off') });
    if (p === 'floors/f1/bakes/mask/file') return json(MASK);
    return json({}, 200);
  });
}

export const band = (page: Page): Locator => page.locator('sw-wall [data-wall-map-slot]');
export const stills = (page: Page): Locator => band(page).locator('sw-wall-plan [data-wall-plan="stills"] sw-plan-stills');
export const live = (page: Page): Locator => band(page).locator('sw-wall-plan [data-wall-plan="live"] sw-plan-3d[kiosk]');

export async function open(page: Page, st: Mock, dev: Dev = TABLET_P, query = '?design=a') {
  await install(page, st);
  await asDevice(page, dev);
  await page.goto(`/${query}#/`);
  // the first paint of a wall on a loaded runner took more than the 5 s default of expect (FLAKY-2250-297: the full gate saw it, a lone run did not)
  await expect(page.locator('sw-wall [data-wall-state="base"]')).toBeVisible({ timeout: 30_000 });
}

