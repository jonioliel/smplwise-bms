import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// CR-030 v2 (WDX) evidence: alert tiles (info chip / alert tile / critical takeover / seen / press-and-hold ack / the alert chip),
// the picture frame (idle slideshow, yields to touch and alerts) and the Settings pieces (alert + frame sections, photo sets),
// against a mocked backend. Run on the runner: `~/run_remote.sh spec <branch> tests/evidence-wall-alerts.spec.ts --project=desktop`;
// screenshots: SW_SHOTS=../docs/evidence/CR-030.
const SHOTS = process.env.SW_SHOTS ?? '';

type Dev = { w: number; h: number };
const TABLET_L: Dev = { w: 1280, h: 800 };
const TABLET_P: Dev = { w: 800, h: 1280 };

async function asTablet(page: Page, d: Dev) {
  await page.setViewportSize({ width: d.w, height: d.h });
  await page.addInitScript((dev) => {
    Object.defineProperty(window.screen, 'width', { get: () => dev.w });
    Object.defineProperty(window.screen, 'height', { get: () => dev.h });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ mobile: false }) });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (/pointer:\s*coarse|hover:\s*none/.test(q) ? ({ ...mm('all'), matches: true, media: q } as MediaQueryList) : mm(q));
  }, d);
}

const CAMS = Array.from({ length: 4 }, (_, i) => ({ id: `cam-${i + 1}`, name: `מצלמה ${i + 1}` }));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

interface Alert { id: string; source: string; category: string; severity: string; title: string; place: string | null; body: string; count: number; first_at: string; last_at: string; camera_id: string | null }
const alert = (id: string, severity: string, title: string, place: string | null, over: Partial<Alert> = {}): Alert => ({
  id, source: 's', category: 'safety', severity, title, place, body: '', count: 1, first_at: new Date().toISOString(), last_at: new Date().toISOString(), camera_id: null, ...over,
});

interface Mock {
  admin: boolean;
  alerts: Alert[];
  alertsCfg: Record<string, unknown>;
  frameCfg: Record<string, unknown>;
  version: number;
  acked: string[];
  patched: Record<string, unknown>[];
  uploads: number;
  sets: { id: string; name: string; count: number; bytes: number; used_by: string[] }[];
  ws: { send: (m: string) => void } | null;
}

const BASE_CFG = {
  cameras: [], scope: 'cameras', layout: 'auto', grid: 'auto', rotate_s: 0, stream: 'sub', strip: ['clock', 'date', 'health'], state_entities: [], show_map: false, theme: 'dark',
  alerts: { enabled: true, categories: ['safety', 'device_faults'], min_severity: 'alert', ack_allowed: false, takeover_timeout_s: 120, sound: false },
  frame: { enabled: false, folder: null, idle_min: 1, interval_s: 5, fit: 'contain', clock: true, motion: 'none' },
  burn_in: { shift: false, dim_after_min: 0, dim_to: 0.6, shuffle_h: 0 },
  schedule: { windows: [], wake_on_alert_severity: 'critical', wake_on_touch: true },
  offline: { show_last_frame_s: 60, then: 'clock' },
};

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
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const perms = st.admin ? ['system.configure', 'rbac.assign', 'map.read', 'video.live'] : ['map.read', 'video.live', 'wall.view'];
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-wall', username: 'reception', display_name: 'קבלה', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: st.admin ? 'system_admin' : 'kiosk', role_name: 'x', scope_type: st.admin ? 'installation' : 'floor', scope_id: st.admin ? '*' : 'f1', scope_name: 'x', effect: 'allow' }],
        permissions_installation: st.admin ? perms : [], permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full', wall: st.admin ? null : { enabled: true, profile_version: st.version },
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'ui.skin': 'classic', 'ui.scheme': 'dark', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {}, 'media.transport_default': 'mse' }, can_edit: st.admin });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    if (p === 'wall/config') {
      return json({ title: 'קבלה', area_id: null, floor_id: null, version: st.version, config: { ...BASE_CFG, alerts: { ...BASE_CFG.alerts, ...st.alertsCfg }, frame: { ...BASE_CFG.frame, ...st.frameCfg }, cameras: CAMS.map((c) => c.id) }, cameras: CAMS, server_time: new Date().toISOString(), zone: 'Asia/Jerusalem', alerts: st.alerts });
    }
    if (p.startsWith('wall/states')) return json({ states: [] });
    if (p === 'wall/frame/list') return json({ photos: [{ id: 'p1', w: 1, h: 1 }, { id: 'p2', w: 1, h: 1 }] });
    if (/^wall\/frame\//.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    const ack = /^wall\/alerts\/([^/]+)\/ack$/.exec(p);
    if (ack && req.method() === 'POST') {
      st.acked.push(decodeURIComponent(ack[1]));
      return json({ acknowledged: true });
    }
    if (p === 'wall/profiles') {
      return json({ profiles: [{ user_id: 'u-reception', username: 'reception', display_name: 'קבלה', title: 'קבלה', area_id: null, floor_id: null, enabled: true, remote_allowed: false, version: 1, config: { ...BASE_CFG, cameras: ['cam-1'] }, status: 'connected', connections: 1, last_seen_at: new Date().toISOString(), last_channel: 'local', created_at: '', updated_at: '', camera_names: ['מצלמה 1'] }], max_profiles: 20 });
    }
    if (p === 'wall/profiles/u-reception' && req.method() === 'PATCH') {
      st.patched.push(req.postDataJSON());
      return json({});
    }
    if (p === 'wall/photo-sets' && req.method() === 'GET') return json({ sets: st.sets, limits: { max_files: 200, max_bytes: 8388608, formats: ['image/jpeg'] } });
    if (p === 'wall/photo-sets' && req.method() === 'POST') {
      const s = { id: 'sabcd1234', name: req.postDataJSON().name, count: 0, bytes: 0, used_by: [] };
      st.sets.push(s);
      return json(s, 201);
    }
    if (/^wall\/photo-sets\/[^/]+\/photos$/.test(p)) return json({ photos: [{ id: 'p1', w: 1, h: 1 }] });
    if (/^wall\/photo-sets\/[^/]+\/photos\/[^/]+$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (/^wall\/photo-sets\/[^/]+\/upload$/.test(p)) {
      st.uploads += 1;
      return json({ id: 'p9', w: 1, h: 1, bytes: 10 }, 201);
    }
    if (p === 'cameras') return json({ cameras: CAMS.map((c, i) => ({ ...c, recorder_id: 'r', channel: i + 1, name_source: c.name, alias: null, enabled: true, sort_order: i })), recorder: null, can_sync: false });
    if (p.startsWith('sites')) return json({ sites: [] });
    if (p.startsWith('media/live/')) return json({ code: 'media_unavailable', user_message: 'אין מדיה' }, 503);
    return json({}, 200);
  });
}

const newMock = (over: Partial<Mock> = {}): Mock => ({ admin: false, alerts: [], alertsCfg: {}, frameCfg: {}, version: 1, acked: [], patched: [], uploads: 0, sets: [{ id: 'sfam', name: 'משפחה', count: 3, bytes: 1000, used_by: [] }], ws: null, ...over });

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

const wall = (page: Page) => page.locator('sw-wall');

test.describe('CR-030 WDX wall alerts and frame (mocked backend)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'the device is emulated by the spec itself; one project is enough');
  });

  test('an alert is a tile in the top-start cell with the other cameras kept; "seen" folds it into the alert chip', async ({ page }) => {
    const st = newMock({ alerts: [alert('a1', 'alert', 'דלת מחסן פתוחה', 'מחסן')] });
    await install(page, st);
    await asTablet(page, TABLET_L);
    await page.goto('/?design=a#/');
    const tile = wall(page).locator('[data-wall-alert-tile="a1"]');
    await expect(tile).toBeVisible();
    await expect(tile).toContainText('דלת מחסן פתוחה · מחסן');
    await expect(tile.locator('[data-wall-ack-off]')).toBeVisible();
    await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(3);
    await shot(page, 'wdx-alert-L-dark');
    await tile.locator('[data-wall-seen]').click();
    await expect(wall(page).locator('[data-wall-alert-tile]')).toHaveCount(0);
    await expect(wall(page).locator('[data-wall-alert-chip]')).toContainText('1');
    await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(4);
  });

  test('several alerts: the tile shows the newest with a "+N" badge, a tap cycles', async ({ page }) => {
    const t = Date.now();
    const st = newMock({ alerts: [alert('a1', 'alert', 'ראשונה', null, { last_at: new Date(t - 5000).toISOString() }), alert('a2', 'alert', 'שנייה', null, { last_at: new Date(t).toISOString() })] });
    await install(page, st);
    await asTablet(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(wall(page).locator('[data-wall-alert-title]')).toContainText('שנייה');
    await wall(page).locator('[data-wall-alert-more]').click();
    await expect(wall(page).locator('[data-wall-alert-title]')).toContainText('ראשונה');
  });

  test('critical: a takeover; press-and-hold acknowledges only when the profile allows it', async ({ page }) => {
    const st = newMock({ alerts: [alert('c1', 'critical', 'דליפת מים', 'מטבח')], alertsCfg: { ack_allowed: true } });
    await install(page, st);
    await asTablet(page, TABLET_L);
    await page.goto('/?design=a#/');
    const take = wall(page).locator('[data-wall-takeover="c1"]');
    await expect(take).toBeVisible();
    await expect(take).toContainText('דליפת מים');
    await shot(page, 'wdx-takeover-L-dark');
    const ack = take.locator('[data-wall-ack]');
    const box = (await ack.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    expect(st.acked).toEqual([]); // a short press does nothing
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => st.acked, { timeout: 4000 }).toEqual(['c1']);
    await page.mouse.up();
    await expect(wall(page).locator('[data-wall-takeover]')).toHaveCount(0);
  });

  test('critical without the ack flag: the note, "seen" folds it for a while', async ({ page }) => {
    await install(page, newMock({ alerts: [alert('c1', 'critical', 'עשן', 'מטבח')] }));
    await asTablet(page, TABLET_P);
    await page.goto('/?design=a#/');
    const take = wall(page).locator('[data-wall-takeover="c1"]');
    await expect(take.locator('[data-wall-ack-off]')).toBeVisible();
    await expect(take.locator('[data-wall-ack]')).toHaveCount(0);
    await shot(page, 'wdx-takeover-P-dark');
    await take.locator('[data-wall-seen]').click();
    await expect(wall(page).locator('[data-wall-takeover]')).toHaveCount(0);
    await expect(wall(page).locator('[data-wall-alert-chip]')).toBeVisible();
  });

  test('the websocket pushes alerts live; a resolve shows the "closed" chip', async ({ page }) => {
    const st = newMock();
    await install(page, st);
    await asTablet(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect.poll(() => st.ws !== null).toBe(true);
    await expect(wall(page).locator('[data-wall-alert-tile]')).toHaveCount(0);
    st.ws!.send(JSON.stringify({ version: 1, type: 'alerts', payload: { alerts: [alert('a1', 'alert', 'מצלמה לא זמינה', 'חניון')] } }));
    await expect(wall(page).locator('[data-wall-alert-tile="a1"]')).toBeVisible();
    st.ws!.send(JSON.stringify({ version: 1, type: 'alerts', payload: { alerts: [] } }));
    await expect(wall(page).locator('[data-wall-alert-tile]')).toHaveCount(0);
    await expect(wall(page).locator('[data-wall-resolved]')).toContainText('נסגר · חניון');
  });

  test('info is a strip chip and does not take a cell', async ({ page }) => {
    await install(page, newMock({ alerts: [alert('i1', 'info', 'דלת כניסה נפתחה', null)], alertsCfg: { min_severity: 'info' } }));
    await asTablet(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(wall(page).locator('[data-wall-info-chip]')).toContainText('דלת כניסה נפתחה');
    await expect(wall(page).locator('[data-wall-alert-tile]')).toHaveCount(0);
    await expect(wall(page).locator('[data-wall-tile]')).toHaveCount(4);
  });

  test('picture frame: after the idle time the photos show; a touch brings the cameras back; an alert keeps them away', async ({ page }) => {
    const st = newMock({ frameCfg: { enabled: true, folder: 'sfam', idle_min: 1 } });
    await install(page, st);
    await page.clock.install();
    await asTablet(page, TABLET_L);
    await page.goto('/?design=a#/');
    await expect(wall(page).locator('[data-wall-state="base"]')).toBeVisible();
    await page.clock.fastForward(70_000);
    const frame = wall(page).locator('[data-wall-state="frame"]');
    await expect(frame).toBeVisible();
    await expect(frame.locator('[data-wall-photo]')).toHaveAttribute('src', /wall\/frame\/p[12]/);
    await expect(frame.locator('[data-wall-frame-clock]')).toBeVisible();
    await shot(page, 'wdx-frame-L-dark');
    await page.mouse.click(200, 200);
    await expect(wall(page).locator('[data-wall-state="base"]')).toBeVisible();
    await page.clock.fastForward(70_000);
    await expect(frame).toBeVisible();
    st.ws!.send(JSON.stringify({ version: 1, type: 'alerts', payload: { alerts: [alert('a1', 'alert', 'דלת פתוחה', 'מחסן')] } }));
    await expect(wall(page).locator('[data-wall-alert-tile="a1"]')).toBeVisible();
    await expect(wall(page).locator('[data-wall-state="frame"]')).toHaveCount(0);
    await page.clock.fastForward(300_000);
    await expect(wall(page).locator('[data-wall-state="frame"]')).toHaveCount(0); // the open alert holds the cameras
  });

  test('the frame needs a folder: without one the display never shows photos', async ({ page }) => {
    await install(page, newMock({ frameCfg: { enabled: true, folder: null, idle_min: 1 } }));
    await page.clock.install();
    await asTablet(page, TABLET_L);
    await page.goto('/?design=a#/');
    await page.clock.fastForward(130_000);
    await expect(wall(page).locator('[data-wall-state="frame"]')).toHaveCount(0);
  });
});

test.describe('CR-030 WDX settings (mocked backend)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough');
  });

  test('the drawer has the alert and frame sections and saves the chosen folder', async ({ page }) => {
    const st = newMock({ admin: true });
    await install(page, st);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await page.locator('system-wall [data-wall-edit="u-reception"]').first().click();
    const drawer = page.locator('sw-drawer[data-wall-drawer]');
    await expect(drawer.locator('[data-wall-section="alerts"]')).toContainText('התראות במסך');
    await expect(drawer.locator('[data-wall-section="frame"]')).toContainText('מסגרת תמונות');
    await drawer.locator('select[data-wall-field="frame-folder"]').selectOption('sfam');
    await drawer.locator('select[data-wall-field="alerts-min"]').selectOption('critical');
    await shot(page, 'wdx-settings-drawer');
    await drawer.locator('[data-wall-save]').click();
    await expect.poll(() => st.patched.length).toBe(1);
    const cfg = (st.patched[0] as { config: { frame: { folder: string }; alerts: { min_severity: string } } }).config;
    expect(cfg.frame.folder).toBe('sfam');
    expect(cfg.alerts.min_severity).toBe('critical');
  });

  test('photo sets: create a folder, upload photos, the limits are shown', async ({ page }) => {
    const st = newMock({ admin: true, sets: [] });
    await install(page, st);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?design=a#/system/wall');
    await page.locator('system-wall [data-wall-photos-manage]').click();
    const dlg = page.locator('sw-wall-photo-sets');
    await expect(dlg.locator('[data-wall-photos-empty]')).toBeVisible();
    await dlg.locator('[data-wall-new-set]').fill('משפחה');
    await dlg.locator('[data-wall-create-set]').click();
    await expect(dlg.locator('[data-wall-set]')).toHaveCount(1);
    await dlg.locator('[data-wall-upload]').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.gif', mimeType: 'image/gif', buffer: PNG }]);
    await expect.poll(() => st.uploads).toBe(1); // the gif is refused on the client, never sent
    await expect(dlg.locator('[data-wall-photos-error]')).toContainText('b.gif');
    await shot(page, 'wdx-photo-sets');
  });
});
