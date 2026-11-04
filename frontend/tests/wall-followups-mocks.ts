import { expect, type Page, type Route } from '@playwright/test';

// WALL-FOLLOWUPS-2390 (display D5): the mocked backend and the emulated physical device shared by
// evidence-wall-followups-2390.spec.ts and pixel-wall-followups-2390.spec.ts. Same shapes as evidence-wall.spec.ts, plus:
// - the device is MUTABLE (`foldTo`): the screen, touch and mobile token live on `window.__swDev`, so a test can fold and unfold
//   the same page without a reload, the way a book-style foldable does;
// - `me.wall.desktop` (the "wall mode on desktop" profile flag) and a PATCH recorder for the settings drawer.
// WALL-ANSWERS-2400: `desktop` is a field of the profile (not of `config`), `me.wall.foldable_open` carries the installation's
// foldable setting, and PATCH wall/settings is recorded in `settingsPatched`.

export type Dev = { w: number; h: number; touch: boolean; mobile: boolean; segments?: number };
export const TABLET_L: Dev = { w: 1280, h: 800, touch: true, mobile: false };
export const TABLET_P: Dev = { w: 800, h: 1280, touch: true, mobile: false };
export const PHONE: Dev = { w: 393, h: 852, touch: true, mobile: true };
export const DESKTOP: Dev = { w: 1440, h: 900, touch: false, mobile: false };
/** Galaxy Z Fold 5: the cover screen (folded) and the inner screen (unfolded, both ways round); Fold 3/4 inner as CR-030 names it */
export const FOLD_COVER: Dev = { w: 344, h: 882, touch: true, mobile: true };
export const FOLD_INNER: Dev = { w: 690, h: 829, touch: true, mobile: true };
export const FOLD_INNER_TURNED: Dev = { w: 829, h: 690, touch: true, mobile: true };
export const FOLD4_INNER: Dev = { w: 673, h: 841, touch: true, mobile: true };

/** The physical device as the detection rule reads it (device-class.ts), from a mutable object, before any app script runs. */
export async function asDevice(page: Page, d: Dev, viewport = true) {
  if (viewport) await page.setViewportSize({ width: d.w, height: d.h });
  await page.addInitScript((dev) => {
    const w = window as unknown as { __swDev: Dev };
    w.__swDev = dev;
    Object.defineProperty(window.screen, 'width', { get: () => w.__swDev.w });
    Object.defineProperty(window.screen, 'height', { get: () => w.__swDev.h });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => (w.__swDev.touch ? 5 : 0) });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ mobile: w.__swDev.mobile }) });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => {
      if (/pointer:\s*coarse|hover:\s*none/.test(q)) return { ...mm('all'), matches: w.__swDev.touch, media: q } as MediaQueryList;
      if (/viewport-segments:\s*2/.test(q)) return { ...mm('all'), matches: (w.__swDev.segments ?? 1) === 2, media: q } as MediaQueryList;
      return mm(q);
    };
  }, d);
}

/** Fold / unfold / turn: the physical screen changes, then the window follows (the order a real fold reports them in). */
export async function foldTo(page: Page, d: Dev) {
  await page.evaluate((dev) => {
    (window as unknown as { __swDev: Dev }).__swDev = dev;
  }, d);
  await page.setViewportSize({ width: d.w, height: d.h });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
}

export const CAMS = Array.from({ length: 8 }, (_, i) => ({ id: `cam-${i + 1}`, name: `מצלמה ${i + 1}` }));
export interface Mock {
  wall: boolean;
  desktop: boolean;
  cams: number;
  skin: 'classic' | 'bubble';
  scheme: 'light' | 'dark';
  theme: 'dark' | 'light';
  channel: 'local' | 'remote';
  configStatus: number;
  configBody: Record<string, unknown> | null;
  version: number;
  admin: boolean;
  patched: Record<string, unknown>[];
  foldable: 'tablet' | 'phone';
  settingsPatched: Record<string, unknown>[];
}
export const newMock = (over: Partial<Mock> = {}): Mock => ({ wall: true, desktop: false, cams: 4, skin: 'classic', scheme: 'dark', theme: 'dark', channel: 'local', configStatus: 200, configBody: null, version: 1, admin: false, patched: [], foldable: 'tablet', settingsPatched: [], ...over });

export const BASE_CFG = {
  cameras: [] as string[], scope: 'cameras', layout: 'auto', grid: 'auto', rotate_s: 0, stream: 'sub', strip: ['clock', 'date', 'health'], state_entities: [], show_map: false, theme: 'dark',
  alerts: { enabled: true, categories: ['safety'], min_severity: 'alert', ack_allowed: false, takeover_timeout_s: 120, sound: false },
  frame: { enabled: false, folder: null, idle_min: 10, interval_s: 30, fit: 'contain', clock: true, motion: 'none' },
  burn_in: { shift: true, dim_after_min: 30, dim_to: 0.6, shuffle_h: 1 },
  schedule: { windows: [], wake_on_alert_severity: 'critical', wake_on_touch: true },
  offline: { show_last_frame_s: 60, then: 'clock' },
};

export function profile(st: Mock, user = 'reception', title = 'קבלה') {
  return {
    user_id: `u-${user}`, username: user, display_name: title, title, area_id: null, floor_id: null, enabled: true, remote_allowed: false, desktop: st.desktop, version: st.version,
    config: { ...BASE_CFG, theme: st.theme, cameras: CAMS.slice(0, st.cams).map((c) => c.id) },
    status: 'connected', connections: 1, last_seen_at: '2026-11-04T08:00:00Z', last_channel: 'local', created_at: '2026-10-05T08:00:00Z', updated_at: '2026-10-05T08:00:00Z',
    camera_names: CAMS.slice(0, st.cams).map((c) => c.name),
  };
}

export async function install(page: Page, st: Mock) {
  await page.routeWebSocket(/\/api\/v1\/wall\/ws/, (ws) => {
    ws.onMessage(() => {});
    ws.send(JSON.stringify({ version: 1, type: 'hello', payload: { version: st.version, state: 'ok' } }));
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
        channel: st.channel, remote: null, user: { id: 'u-wall', username: 'reception', display_name: 'קבלה', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: st.admin ? 'system_admin' : 'kiosk', role_name: st.admin ? 'מנהל' : 'קיוסק', scope_type: st.admin ? 'installation' : 'floor', scope_id: st.admin ? '*' : 'f1', scope_name: 'x', effect: 'allow' }],
        permissions_installation: st.admin ? perms : [], permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full', wall: st.wall && !st.admin ? { enabled: true, profile_version: st.version, desktop: st.desktop, foldable_open: st.foldable } : null,
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.skin': st.skin, 'ui.scheme': st.scheme, 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {}, 'media.transport_default': 'mse' }, can_edit: st.admin });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-11-04T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'wall/config') {
      if (st.configStatus !== 200) return json(st.configBody ?? { code: 'unauthorized', user_message: 'x' }, st.configStatus);
      const pf = profile(st);
      return json({ title: pf.title, area_id: null, floor_id: null, version: st.version, config: pf.config, cameras: CAMS.slice(0, st.cams), server_time: new Date().toISOString(), zone: 'Asia/Jerusalem', alerts: [] });
    }
    if (p.startsWith('wall/states')) return json({ states: [] });
    if (p === 'wall/alerts') return json({ alerts: [] });
    if (p === 'wall/profiles') return json({ profiles: [profile(st), profile({ ...st, desktop: false, cams: 2 }, 'lobby', 'לובי')], max_profiles: 20, foldable_open: st.foldable });
    if (p === 'wall/settings' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as { foldable_open?: 'tablet' | 'phone' };
      st.settingsPatched.push(body);
      if (body.foldable_open) st.foldable = body.foldable_open;
      return json({ foldable_open: st.foldable });
    }
    if (p.startsWith('wall/profiles/') && req.method() === 'PATCH') {
      const body = req.postDataJSON() as { desktop?: boolean };
      st.patched.push(body);
      if (typeof body.desktop === 'boolean') st.desktop = body.desktop;
      st.version += 1;
      return json(profile(st));
    }
    if (p === 'wall/candidates') return json({ users: [{ id: 'u-gate', username: 'gate', display_name: 'שער' }] });
    if (p === 'wall/photo-sets') return json({ sets: [], limits: { max_files: 200, max_bytes: 8388608, formats: [] } });
    if (p === 'cameras') return json({ cameras: CAMS.map((c, i) => ({ ...c, recorder_id: 'r', channel: i + 1, name_source: c.name, alias: null, enabled: true, sort_order: i })), recorder: null, can_sync: false });
    if (p.startsWith('sites')) return json({ sites: [] });
    if (p.startsWith('media/live/')) return json({ code: 'media_unavailable', user_message: 'אין מדיה' }, 503);
    return json({}, 200);
  });
}

export const wall = (page: Page) => page.locator('sw-app sw-wall');

/** The wall is mounted, ready, and drawn with the expected preset. */
export async function expectWall(page: Page, preset?: string) {
  await expect(wall(page)).toHaveCount(1);
  const base = wall(page).locator('[data-wall-state="base"]');
  await expect(base).toBeVisible();
  if (preset) await expect(base).toHaveAttribute('data-preset', preset);
}

/** The application, not the wall: the shell rendered and no wall element exists. */
export async function expectApp(page: Page) {
  await page.waitForSelector('sw-app');
  await expect(page.locator('sw-wall')).toHaveCount(0);
  await expect(page.locator('sw-app')).toBeVisible();
}

/** Nothing on the wall reaches past its right or bottom edge. */
export async function noOverflow(page: Page) {
  const over = await wall(page).evaluate((w) => {
    const r = w.shadowRoot?.querySelector('.wall') as HTMLElement | null;
    return r ? { x: r.scrollWidth - r.clientWidth, y: r.scrollHeight - r.clientHeight } : { x: 0, y: 0 };
  });
  expect(over.x, 'no sideways overflow').toBeLessThanOrEqual(0);
  expect(over.y, 'no vertical overflow').toBeLessThanOrEqual(0);
}
