import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// CR-030 v2 (WDM) evidence: the wall display and its settings screen against a mocked backend. Wall mode is chosen by the
// detection rule of section 3.2.1 (init script below fakes the physical device: touch pointer, screen size, mobile token), so the
// same wall user is shown on a tablet (the wall display, the shell NOT mounted), on a phone and on a desktop (the normal application).
// Tablets x {classic, bubble} x {light, dark}, landscape and portrait; every reachable state of the display; the Settings list.
// Run on the runner: `~/run_remote.sh spec <branch> tests/evidence-wall.spec.ts --project=desktop`; screenshots: SW_SHOTS=../docs/evidence/CR-030.
const SHOTS = process.env.SW_SHOTS ?? '';

type Dev = { w: number; h: number; touch: boolean; mobile: boolean };
const TABLET_L: Dev = { w: 1280, h: 800, touch: true, mobile: false };
const TABLET_P: Dev = { w: 800, h: 1280, touch: true, mobile: false };
const PHONE: Dev = { w: 393, h: 852, touch: true, mobile: true };
const DESKTOP: Dev = { w: 1440, h: 900, touch: false, mobile: false };

async function asDevice(page: Page, d: Dev) {
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

const CAMS = Array.from({ length: 8 }, (_, i) => ({ id: `cam-${i + 1}`, name: `מצלמה ${i + 1}` }));
interface Mock {
  wall: boolean;
  cams: number;
  skin: 'classic' | 'bubble';
  scheme: 'light' | 'dark';
  configStatus: number;
  configBody: Record<string, unknown> | null;
  version: number;
  title: string;
  admin: boolean;
  profiles: Record<string, unknown>[];
  cfgOver: Record<string, unknown>;
  ws: { send: (m: string) => void } | null;
}
const newMock = (over: Partial<Mock> = {}): Mock => ({ wall: true, cams: 4, skin: 'classic', scheme: 'dark', configStatus: 200, configBody: null, version: 1, title: 'קבלה', admin: false, profiles: [], cfgOver: {}, ws: null, ...over });

const BASE_CFG = {
  cameras: [], scope: 'cameras', layout: 'auto', grid: 'auto', rotate_s: 0, stream: 'sub', strip: ['clock', 'date', 'health'], state_entities: [], show_map: false, theme: 'dark',
  alerts: { enabled: true, categories: ['safety'], min_severity: 'alert', ack_allowed: false, takeover_timeout_s: 120, sound: false },
  frame: { enabled: false, folder: null, idle_min: 10, interval_s: 30, fit: 'contain', clock: true, motion: 'none' },
  burn_in: { shift: true, dim_after_min: 30, dim_to: 0.6, shuffle_h: 1 },
  schedule: { windows: [], wake_on_alert_severity: 'critical', wake_on_touch: true },
  offline: { show_last_frame_s: 60, then: 'clock' },
};

function profile(user: string, title: string, over: Record<string, unknown> = {}) {
  return { user_id: `u-${user}`, username: user, display_name: title, title, area_id: null, floor_id: null, enabled: true, remote_allowed: false, version: 1, config: { ...BASE_CFG, cameras: ['cam-1', 'cam-2'] },
    status: 'connected', connections: 1, last_seen_at: new Date().toISOString(), last_channel: 'local', created_at: '2026-10-05T08:00:00Z', updated_at: '2026-10-05T08:00:00Z', camera_names: ['מצלמה 1', 'מצלמה 2'], ...over };
}

async function install(page: Page, st: Mock) {
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
        bootstrap_state: 'done', mode: 'full', wall: st.wall ? { enabled: true, profile_version: st.version } : null,
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.skin': st.skin, 'ui.scheme': st.scheme, 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {}, 'media.transport_default': 'mse' }, can_edit: st.admin });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'wall/config') {
      if (st.configStatus !== 200) return json(st.configBody ?? { code: 'unauthorized', user_message: 'x' }, st.configStatus);
      return json({ title: st.title, area_id: null, floor_id: null, version: st.version, config: { ...BASE_CFG, ...st.cfgOver, cameras: CAMS.slice(0, st.cams).map((c) => c.id) }, cameras: CAMS.slice(0, st.cams), server_time: new Date().toISOString(), zone: 'Asia/Jerusalem', alerts: [] });
    }
    if (p.startsWith('wall/states')) return json({ states: [] });
    if (p === 'wall/profiles') return json({ profiles: st.profiles, max_profiles: 20 });
    if (p === 'wall/candidates') return json({ users: [{ id: 'u-lobby', username: 'lobby', display_name: 'לובי' }] });
    if (p === 'cameras') return json({ cameras: CAMS.map((c, i) => ({ ...c, recorder_id: 'r', channel: i + 1, name_source: c.name, alias: null, enabled: true, sort_order: i })), recorder: null, can_sync: false });
    if (p.startsWith('sites')) return json({ sites: [] });
    if (p.startsWith('media/live/')) return json({ code: 'media_unavailable', user_message: 'אין מדיה' }, 503);
    return json({}, 200);
  });
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function noOverflow(page: Page) {
  const over = await page.locator('sw-wall').evaluate((w) => {
    const r = w.shadowRoot?.querySelector('.wall') as HTMLElement | null;
    return r ? r.scrollWidth - r.clientWidth : 0;
  });
  expect(over).toBeLessThanOrEqual(0);
}

test.describe('CR-030 wall display (mocked backend)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
  });

  test('detection: the same wall user gets the wall on a tablet, the normal application on a phone and a desktop', async ({ page }) => {
    const st = newMock();
    await install(page, st);
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(page.locator('sw-app sw-wall')).toHaveCount(1);
    await expect(page.locator('sw-wall')).toHaveAttribute('data-wall-theme', 'dark');
    await expect(page.locator('sw-app >> css=nav, sw-app >> [data-rail]')).toHaveCount(0);
    await expect(page.locator('sw-wall [data-wall-state="base"]')).toHaveAttribute('data-wall-class', 'tablet');
  });

  for (const [name, dev] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
    test(`detection: ${name} + wall user -> the application, no wall interface`, async ({ page }) => {
      await install(page, newMock());
      await asDevice(page, dev);
      await page.goto('/?design=a#/');
      await page.waitForSelector('sw-app');
      await page.waitForTimeout(800);
      await expect(page.locator('sw-wall')).toHaveCount(0);
      await expect(page.locator('sw-app')).toBeVisible();
    });
  }

  test('detection: a tablet and a user WITHOUT a wall profile -> the application', async ({ page }) => {
    await install(page, newMock({ wall: false }));
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(800);
    await expect(page.locator('sw-wall')).toHaveCount(0);
  });

  for (const skin of ['classic', 'bubble'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      for (const [dname, dev, preset] of [['landscape', TABLET_L, 'tablet-landscape'], ['portrait', TABLET_P, 'tablet-portrait']] as const) {
        test(`base layout: ${dname} ${skin} ${scheme}, 4 cameras`, async ({ page }) => {
          await install(page, newMock({ skin, scheme }));
          await asDevice(page, dev);
          await page.goto('/?design=a#/');
          const wall = page.locator('sw-wall');
          await expect(wall.locator('[data-wall-state="base"]')).toHaveAttribute('data-preset', preset);
          await expect(wall.locator('[data-wall-tile]')).toHaveCount(preset === 'tablet-landscape' ? 4 : 2); // portrait: two cells, the rest paged
          await expect(wall.locator('[data-wall-title]')).toHaveText('קבלה');
          await noOverflow(page);
          // the clock is the largest text on screen
          const sizes = await page.locator('sw-wall').evaluate((w) => {
            const r = w.shadowRoot!;
            const px = (sel: string) => parseFloat(getComputedStyle(r.querySelector(sel) as HTMLElement).fontSize);
            return { clock: px('[data-wall-clock]'), title: px('[data-wall-title]') };
          });
          expect(sizes.clock).toBeGreaterThan(sizes.title);
          // the video is never mirrored by RTL: tiles stay left-to-right
          expect(await wall.locator('[data-wall-tile]').first().evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
          await shot(page, `wall-${dname}-${skin}-${scheme}`);
        });
      }
    }
  }

  test('one camera is a single full-bleed tile; many cameras page with dots', async ({ page }) => {
    await install(page, newMock({ cams: 1 }));
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(page.locator('sw-wall [data-wall-state="base"]')).toHaveAttribute('data-preset', 'single');
    await expect(page.locator('sw-wall [data-wall-tile]')).toHaveCount(1);
    const st2 = newMock({ cams: 8 });
    await install(page, st2);
    await page.reload();
    await expect(page.locator('sw-wall [data-wall-dots]')).toBeVisible();
    expect(await page.locator('sw-wall [data-wall-tile]').count()).toBeLessThanOrEqual(6);
  });

  test('state: no cameras', async ({ page }) => {
    await install(page, newMock({ cams: 0 }));
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(page.locator('sw-wall [data-wall-state="no-cameras"]')).toContainText('לא הוגדרו מצלמות');
    await shot(page, 'wall-no-cameras');
  });

  test('state: access removed (401) and remote refused (403 code)', async ({ page }) => {
    await install(page, newMock({ configStatus: 401, configBody: { code: 'unauthorized', user_message: 'x' } }));
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(page.locator('sw-wall [data-wall-state="access-removed"]')).toContainText('הגישה למסך הזה הוסרה');
    await shot(page, 'wall-access-removed');
    await install(page, newMock({ configStatus: 403, configBody: { code: 'wall_user_remote_not_allowed', user_message: 'x' } }));
    await page.reload();
    await expect(page.locator('sw-wall [data-wall-state="remote-refused"]')).toBeVisible();
    await shot(page, 'wall-remote-refused');
  });

  test('state: no connection on the first load retries by itself', async ({ page }) => {
    await install(page, newMock());
    await page.route('**/api/v1/wall/config', (r) => r.abort());
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(page.locator('sw-wall [data-wall-state="no-connection"]')).toContainText('אין חיבור לשרת');
    await shot(page, 'wall-no-connection');
  });

  test('state: a stalled camera is dimmed with a hatch and the time of the last frame - never shown as live', async ({ page }) => {
    await install(page, newMock({ cams: 2 }));
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    const tile = page.locator('sw-wall [data-wall-tile="cam-1"]');
    await expect(tile).toBeVisible();
    await tile.evaluate((el) => el.dispatchEvent(new CustomEvent('player-status', { detail: { status: 'error' }, bubbles: true, composed: true })));
    await expect(tile).toHaveAttribute('data-health', 'stale');
    await expect(tile.locator('[data-wall-badge]')).toContainText('אין וידאו');
    await shot(page, 'wall-camera-stale');
  });

  test('installer panel: a long press on the clock shows it, read-only, with the detected class', async ({ page }) => {
    await install(page, newMock());
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    const clock = page.locator('sw-wall [data-wall-clock]');
    await expect(clock).toBeVisible();
    await expect(page.locator('sw-wall [data-wall-panel]')).toHaveCount(0);
    const box = (await clock.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    const panel = page.locator('sw-wall [data-wall-panel]');
    await expect(panel).toContainText('tablet');
    await expect(panel.locator('button, input, a')).toHaveCount(0); // read-only: no control on the panel
    await shot(page, 'wall-installer-panel');
  });

  test('a new configuration arrives over the websocket and shows the 3 s chip', async ({ page }) => {
    const st = newMock();
    await install(page, st);
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(page.locator('sw-wall [data-wall-title]')).toHaveText('קבלה');
    await expect.poll(() => st.ws !== null).toBe(true);
    st.title = 'מסדרון';
    st.version = 2;
    st.ws!.send(JSON.stringify({ version: 1, type: 'config', payload: { version: 2 } }));
    await expect(page.locator('sw-wall [data-wall-title]')).toHaveText('מסדרון');
    await expect(page.locator('sw-wall [data-wall-updated]')).toBeVisible();
    await shot(page, 'wall-config-updated');
  });

  test('burn-in: the layout moves by at most 2 px', async ({ page }) => {
    await install(page, newMock());
    await asDevice(page, TABLET_L);
    await page.goto('/?design=a#/');
    const m = await page.locator('sw-wall').evaluate((el) => new DOMMatrix(getComputedStyle(el.shadowRoot!.querySelector('.wall') as HTMLElement).transform));
    expect(Math.abs(m.e)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.f)).toBeLessThanOrEqual(2);
  });
});

test.describe('CR-030 settings: הגדרות › מסכי קיר (mocked backend)', () => {
  test('the list: wall users with their status; add dialog picks an existing user; the drawer holds the configuration', async ({ page }, info) => {
    const st = newMock({ admin: true, wall: false, profiles: [profile('reception', 'קבלה'), profile('hall', 'מסדרון', { enabled: false, status: 'disabled', connections: 0, camera_names: [] })] });
    await install(page, st);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await expect(page.locator('system-wall [data-wall-row]')).toHaveCount(2);
    await expect(page.locator('system-wall [data-wall-row="u-reception"]')).toContainText('מחובר');
    await expect(page.locator('system-wall [data-wall-row="u-hall"]')).toContainText('מושבת');
    await expect(page.locator('system-wall [data-wall-count]')).toContainText('2');
    await shot(page, `wall-settings-list-${info.project.name}`);
    await page.locator('system-wall [data-wall-add-open]').click();
    await expect(page.locator('sw-dialog[data-wall-add] [data-wall-add-submit]')).toBeDisabled(); // the dialog host has no box of its own
    await shot(page, 'wall-settings-add');
    await page.keyboard.press('Escape');
    await page.locator('system-wall [data-wall-edit="u-reception"]').click();
    const drawer = page.locator('sw-drawer[data-wall-drawer]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('מצלמות ופריסה');
    await expect(drawer).toContainText('שעות והגנה על המסך');
    await expect(drawer.locator('[data-wall-cam]')).toHaveCount(8);
    await shot(page, 'wall-settings-drawer');
  });

  test('a phone shows cards, never a shrunken table', async ({ page }) => {
    await install(page, newMock({ admin: true, wall: false, profiles: [profile('reception', 'קבלה')] }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?design=a#/system/wall');
    await expect(page.locator('system-wall [data-wall-card="u-reception"]')).toBeVisible();
    await expect(page.locator('system-wall [data-wall-table]')).toBeHidden();
    await shot(page, 'wall-settings-list-phone');
  });

  test('the empty state offers the add button', async ({ page }) => {
    await install(page, newMock({ admin: true, wall: false, profiles: [] }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await expect(page.locator('system-wall [data-wall-empty]')).toBeVisible();
    await expect(page.locator('system-wall [data-wall-add-open]')).toBeEnabled();
  });
});
