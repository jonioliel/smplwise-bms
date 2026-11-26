import type { Page, Route, WebSocketRoute } from '@playwright/test';
import { install, newMock, type Mock } from './wall-followups-mocks';

// MEDIUM-REST-2540: the mocked backends of evidence-medium-rest-2540 / pixel-medium-rest-2540 / medium-rest-2540-shots. Invented names,
// nothing is sent anywhere, no device or recorder is contacted.

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// ------------------------------------------------------------------------------------------------ the walls (SCR-26) and the wall display

export const WALL_CAMS = ['כניסה', 'חניה', 'לובי', 'מחסן'].map((name, i) => ({ id: `cam-${i + 1}`, name }));

/** The camera list the walls read: `offline` names the cameras that are offline in THIS answer (the spec changes it between reads). */
export interface WallState { mock: Mock; offline: Set<string>; reads: number; health: 'ok' | 'warn' | 'error'; version: string }

export async function mockWalls(page: Page, over: Partial<Mock> = {}, health: WallState['health'] = 'ok', version = 'test'): Promise<WallState> {
  const st: WallState = { mock: newMock({ admin: true, wall: false, cams: WALL_CAMS.length, ...over }), offline: new Set(), reads: 0, health, version };
  await install(page, st.mock);
  await page.route(/\/api\/v1\/cameras(\?.*)?$/, (r) => {
    st.reads += 1;
    return json(r, {
      cameras: WALL_CAMS.map((c, i) => ({
        ...c, recorder_id: 'r1', channel: i + 1, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 101 + i * 100, sub_track: 102 + i * 100,
        status: st.offline.has(c.id) ? 'offline' : 'online', last_seen_at: '2026-11-26T08:00:00Z', stream: { codec: 'H.264', resolution: '1920x1080', fps: 15, bitrate_kbps: 2048 }, encoding: null, can_view_live: true,
      })),
      recorders: [{ id: 'r1', name: 'מקליט' }], recorder: { id: 'r1', name: 'מקליט', model: null, firmware: null, last_seen_at: null }, can_sync: false,
    });
  });
  await page.route('**/api/v1/health/summary', (r) => json(r, {
    status: st.health, items: st.health === 'ok' ? [] : [{ id: 'recorder', status: st.health, label: 'מקליט' }], checked_at: '2026-11-26T08:00:00Z', version: st.version,
  }));
  await page.route(/\/api\/v1\/cameras\/[^/]+\/snapshot/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  return st;
}

// ------------------------------------------------------------------------------------------------ the camera page's motion grid (SCR-27)

const PERMS = ['video.live', 'media.read', 'devices.read', 'nvr.config.detection'];
const CAMERA = {
  id: 'cam-1', recorder_id: 'r1', channel: 1, name: 'כניסה', name_source: 'nvr', alias: null, enabled: true, sort_order: 1, grid_col_span: 1,
  main_track: 101, sub_track: 102, status: 'online', last_seen_at: '2026-11-26T08:00:00Z', stream: { codec: 'H.264', resolution: '1920x1080', fps: 15, bitrate_kbps: 2048 },
  encoding: null, can_view_live: true,
};

export async function mockMotionCamera(page: Page, sensitivity = 40): Promise<{ puts: unknown[] }> {
  const m = { puts: [] as unknown[] };
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  const cells = Array.from({ length: 4 }, (_, r) => Array.from({ length: 6 }, (_, c) => r > 0 && c > 1));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-mr', username: 'mr', display_name: 'בודק', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'cameras' && method === 'GET') return json(route, { cameras: [CAMERA], recorders: [{ id: 'r1', name: 'NVR' }], recorder: { id: 'r1', name: 'NVR', model: null, firmware: null, last_seen_at: null }, can_sync: false });
    if (/^cameras\/[^/]+\/snapshot/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === 'cameras/cam-1/zones' && method === 'GET') {
      return json(route, {
        camera_id: 'cam-1', channel: 1, source: 'nvr', read_only: false, write_reason: '', can_edit_motion: true, writes_enabled: true, sensitivity_caps: { min: 0, max: 100, step: 20 },
        fetched_at: '2026-11-26T08:00:00Z', cached: false, unsupported: {}, privacy_mask: null, intrusion: null, line_crossing: null,
        motion: { enabled: true, region_type: 'grid', sensitivity, rows: 4, cols: 6, cells, coverage_pct: 50, target_types: [] },
      });
    }
    if (p.startsWith('cameras/cam-1/zones') && method !== 'GET') {
      m.puts.push(req.postDataJSON());
      return json(route, { code: 'nvr_write_refused', user_message: 'לא נכתב (דוגמה).', retryable: false, correlation_id: 'mock', details: {} }, 409);
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return m;
}

/** Opens the motion editor of the mocked camera, moves the sensitivity to `to` and opens the write confirmation. */
export async function openMotionConfirm(page: Page, to: number) {
  const cam = page.locator('sw-app live-camera');
  await page.goto('/?design=a#/live/cameras/cam-1');
  await page.waitForSelector('sw-app');
  await cam.locator('[data-camera-settings]').waitFor({ timeout: 20_000 });
  await cam.locator('[data-camera-settings] > summary').click();
  await cam.locator('[data-acc-zones] > summary').click();
  await cam.locator('[data-motion-edit]').click();
  await cam.locator('[data-motion-sensitivity]').evaluate((el, v) => {
    const i = el as HTMLInputElement;
    i.value = String(v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, to);
  await cam.locator('[data-motion-save]').click();
  await cam.locator('[data-motion-confirm] [data-motion-confirm-run]').waitFor();
  return cam.locator('[data-motion-confirm]');
}

// ------------------------------------------------------------------------------------------------ the home push socket (SCR-30)

/** The home's `/ha/ws` socket, held by the spec: `push(entity)` sends an `entity_state_changed` frame. */
export async function holdHaSocket(page: Page): Promise<{ push: (e: { entity_id: string; state: string; device_class?: string | null }) => void; open: () => boolean }> {
  const sockets: WebSocketRoute[] = []; // every open /ha/ws of the page (the home's own and any other listener's)
  await page.routeWebSocket(/\/ha\/ws/, (s) => {
    sockets.push(s);
    s.onMessage(() => undefined);
  });
  return {
    open: () => sockets.length > 0,
    push: (e) => {
      const domain = e.entity_id.split('.')[0];
      for (const ws of sockets) ws.send(JSON.stringify({ type: 'entity_state_changed', payload: { entity: {
        entity_id: e.entity_id, domain, device_class: e.device_class ?? null, state: e.state, attributes: {}, available: true, fresh: true, name: e.entity_id,
        registry_id: null, platform: null, device_id: null, area_id: null, area_name: null, ha_floor_id: null, ha_floor_name: null, original_name: null, unit: null, icon: null,
        entity_category: null, disabled: false, hidden: false, supported_features: null, last_changed: null, last_updated: null, state_seen_at: null, removed_at: null,
      } } }));
    },
  };
}
