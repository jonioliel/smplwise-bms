import { test, expect, type Page, type Route } from '@playwright/test';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import { PERMS, installCastMock } from './cast-mocks';

// ANNOUNCEB-295 (voice announcements, stage B): the announcement text on screens. Mocked wire contract, invented names; nothing is sent to any device.
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/evidence-announceb-295.spec.ts --project=desktop --workers=1
// 1. the TV board page draws the overlay over the page (normal, emergency, several languages), hides when its time ends, never scrolls - at 1366x768, 1920x1080 and 1080x1920.
// 2. the wall display draws the same text, can be closed on the screen, and fits 1366x768, 1024x768 and 800x1280 without scrolling.
// 3. Settings: the screens card (switch, times, allowed screens) saves at once; the announce form offers "screens" only while the server says so.

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'the viewports are set by the spec itself; one project is enough'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

// the fixed instant of the TV page (`clock=fixed`) is 23.10.2026 09:12 Asia/Jerusalem = 06:12Z
const LIVE = '2026-10-23T06:20:00Z';
const OVER = '2026-10-23T06:00:00Z';
const ann = (o: Record<string, unknown> = {}) => ({ id: 'an1', critical: false, until: LIVE, texts: [{ language: 'he', text: 'המעלית הצפונית בתחזוקה עד הצהריים' }], ...o });

const VIEWPORTS = [{ name: 'reference 1366x768', w: 1366, h: 768 }, { name: 'tv 1920x1080', w: 1920, h: 1080 }, { name: 'portrait tv 1080x1920', w: 1080, h: 1920 }];

async function openTv(page: Page, announcement: unknown, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  const feed = lobbyFeed({}, undefined, announcement ? { announcement: announcement as never } : {});
  feed.board.announce_poll_s = 5;
  await serveFeed(page, feed);
  await page.goto(new URL(tvUrl(), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(600);
}

async function noScroll(page: Page, sel: string) {
  const r = await page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement;
    const inner = el.querySelector('.ann-in, .ann-body') as HTMLElement | null;
    const box = el.getBoundingClientRect();
    const ib = inner ? inner.getBoundingClientRect() : box;
    return { sh: el.scrollHeight, ch: el.clientHeight, sw: el.scrollWidth, cw: el.clientWidth, docH: document.documentElement.scrollHeight, winH: innerHeight, docW: document.documentElement.scrollWidth, winW: innerWidth,
      inside: ib.top >= box.top - 1 && ib.bottom <= box.bottom + 1 && ib.left >= box.left - 1 && ib.right <= box.right + 1 };
  }, sel);
  expect(r.sh, 'no vertical overflow inside the overlay').toBeLessThanOrEqual(r.ch + 1);
  expect(r.sw, 'no horizontal overflow inside the overlay').toBeLessThanOrEqual(r.cw + 1);
  expect(r.docH).toBeLessThanOrEqual(r.winH + 1);
  expect(r.docW).toBeLessThanOrEqual(r.winW + 1);
  expect(r.inside, 'the text block stays inside the overlay').toBe(true);
}

test.describe('the TV board page', () => {
  for (const v of VIEWPORTS) {
    test(`a normal announcement covers the page and fits, ${v.name}`, async ({ page }) => {
      await openTv(page, ann(), v.w, v.h);
      await expect(page.locator('#cv')).toHaveAttribute('data-ann', '1');
      const o = page.locator('#cv .ann');
      await expect(o).toBeVisible();
      await expect(o.locator('.ann-t')).toHaveText('המעלית הצפונית בתחזוקה עד הצהריים');
      await expect(o.locator('.ann-tag')).toHaveText('הכרזה');
      await noScroll(page, '#cv .ann');
    });

    test(`an emergency in three languages is critical and still fits, ${v.name}`, async ({ page }) => {
      const long = 'יש לפנות את הבניין מיד דרך המדרגות הקרובות ולהתכנס בחניון הצפוני. אין להשתמש במעליות.';
      await openTv(page, ann({ id: 'em1', critical: true, texts: [{ language: 'he', text: long }, { language: 'en', text: 'Evacuate the building now by the nearest stairs and gather in the north car park. Do not use the lifts.' }, { language: 'ru', text: 'Немедленно покиньте здание по ближайшей лестнице и соберитесь на северной парковке. Не пользуйтесь лифтами.' }] }), v.w, v.h);
      await expect(page.locator('#cv')).toHaveAttribute('data-ann', 'crit');
      await expect(page.locator('#cv .ann .ann-tag')).toHaveText('הודעת חירום');
      await expect(page.locator('#cv .ann .ann-t')).toHaveCount(3);
      await expect(page.locator('#cv .ann .ann-t').nth(1)).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('#cv .ann .ann-t').first()).toHaveAttribute('dir', 'rtl');
      await noScroll(page, '#cv .ann');
    });
  }

  test('an announcement whose time has ended, or none, draws no overlay; the board underneath is untouched', async ({ page }) => {
    await openTv(page, ann({ until: OVER }), 1366, 768);
    await expect(page.locator('#cv')).toHaveAttribute('data-ann', '0');
    await expect(page.locator('#cv .ann')).toBeHidden();
    await expect(page.locator('#cv .pg .hd')).toBeVisible();
    const p2 = await page.context().newPage();
    await openTv(p2, null, 1366, 768);
    await expect(p2.locator('#cv')).toHaveAttribute('data-ann', '0');
  });

  test('the text is escaped: markup in an announcement is shown as text, never drawn', async ({ page }) => {
    await openTv(page, ann({ texts: [{ language: 'en', text: '<img src=x onerror=alert(1)> & <b>bold</b>' }] }), 1366, 768);
    await expect(page.locator('#cv .ann .ann-t')).toHaveText('<img src=x onerror=alert(1)> & <b>bold</b>');
    await expect(page.locator('#cv .ann img, #cv .ann b')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------------- the wall display

const CAMS = Array.from({ length: 4 }, (_, i) => ({ id: `cam-${i + 1}`, name: `מצלמה ${i + 1}` }));
const BASE_CFG = {
  cameras: CAMS.map((c) => c.id), scope: 'cameras', layout: 'auto', grid: 'auto', rotate_s: 0, stream: 'sub', strip: ['clock', 'date', 'health'], state_entities: [], show_map: false, theme: 'dark',
  alerts: { enabled: true, categories: ['safety'], min_severity: 'alert', ack_allowed: false, takeover_timeout_s: 120, sound: false },
  frame: { enabled: false, folder: null, idle_min: 1, interval_s: 5, fit: 'contain', clock: true, motion: 'none' },
  burn_in: { shift: false, dim_after_min: 0, dim_to: 0.6, shuffle_h: 0 },
  schedule: { windows: [], wake_on_alert_severity: 'critical', wake_on_touch: true },
  offline: { show_last_frame_s: 60, then: 'clock' },
};

async function installWall(page: Page, state: { announcement: unknown; poll_s: number; asked: number }) {
  await page.routeWebSocket(/\/api\/v1\/wall\/ws/, (ws) => {
    ws.onMessage(() => {});
    ws.send(JSON.stringify({ version: 1, type: 'hello', payload: { version: 1, state: 'ok' } }));
  });
  await page.routeWebSocket(/\/api\/v1\/me\/ws/, () => {});
  await page.routeWebSocket(/\/api\/v1\/ha\/ws/, () => {});
  await page.route('**/api/v1/**', async (route: Route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const perms = ['map.read', 'video.live', 'wall.view'];
    if (p === 'me') {
      return json(route, {
        channel: 'local', remote: null, user: { id: 'u-wall', username: 'reception', display_name: 'קבלה', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'kiosk', role_name: 'x', scope_type: 'floor', scope_id: 'f1', scope_name: 'x', effect: 'allow' }],
        permissions_installation: [], permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
        bootstrap_state: 'done', mode: 'full', wall: { enabled: true, profile_version: 1 },
      });
    }
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'ui.skin': 'classic', 'ui.scheme': 'dark', 'ui.start_route': 'devices', 'ui.hide_map': 'false', 'ui.hide_wiskey': 'false', 'ui.hide_search': 'false', 'ui.tabs': {}, 'media.transport_default': 'mse' }, can_edit: false });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p === 'wall/config') return json(route, { title: 'קבלה', area_id: null, floor_id: null, version: 1, config: BASE_CFG, cameras: CAMS, server_time: new Date().toISOString(), zone: 'Asia/Jerusalem', alerts: [] });
    if (p.startsWith('wall/states')) return json(route, { states: [] });
    if (p === 'wall/announcement') {
      state.asked += 1;
      return json(route, { poll_s: state.poll_s, announcement: state.announcement });
    }
    if (p.startsWith('media/live/')) return json(route, { code: 'media_unavailable', user_message: 'אין מדיה' }, 503);
    return json(route, {}, 200);
  });
}

async function asTablet(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript((dev) => {
    Object.defineProperty(window.screen, 'width', { get: () => dev.w });
    Object.defineProperty(window.screen, 'height', { get: () => dev.h });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({ mobile: false }) });
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (/pointer:\s*coarse|hover:\s*none/.test(q) ? ({ ...mm('all'), matches: true, media: q } as MediaQueryList) : mm(q));
  }, { w, h });
}

const live = () => new Date(Date.now() + 120_000).toISOString();

test.describe('the wall display', () => {
  for (const v of [{ n: 'reference 1366x768', w: 1366, h: 768 }, { n: 'tablet 1024x768', w: 1024, h: 768 }, { n: 'portrait tablet 800x1280', w: 800, h: 1280 }]) {
    test(`the announcement text covers the wall and fits, ${v.n}; closing it on the screen hides it`, async ({ page }) => {
      const st = { announcement: ann({ until: live(), texts: [{ language: 'he', text: 'הקבלה סגורה לטיפול' }, { language: 'en', text: 'Reception is closed for service' }] }), poll_s: 5, asked: 0 };
      await installWall(page, st);
      await asTablet(page, v.w, v.h);
      await page.goto('/?design=a#/');
      const o = page.locator('sw-wall').locator('[data-wall-announcement="an1"]');
      await expect(o).toBeVisible();
      await expect(o.locator('.ann-t')).toHaveCount(2);
      const r = await o.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const inner = (el.querySelector('.ann-in') as HTMLElement).getBoundingClientRect();
        return { w: b.width, h: b.height, sh: (el as HTMLElement).scrollHeight, ch: (el as HTMLElement).clientHeight, inside: inner.top >= b.top - 1 && inner.bottom <= b.bottom + 1 && inner.left >= b.left - 1 && inner.right <= b.right + 1 };
      });
      expect(r.w).toBeGreaterThanOrEqual(v.w - 2);
      expect(r.h).toBeGreaterThanOrEqual(v.h - 2);
      expect(r.sh).toBeLessThanOrEqual(r.ch + 1);
      expect(r.inside).toBe(true);
      await o.locator('[data-wall-announcement-close]').click();
      await expect(page.locator('sw-wall').locator('[data-wall-announcement]')).toHaveCount(0);
    });
  }

  test('a display that is not an announcement screen is asked about once a minute and shows nothing', async ({ page }) => {
    const st = { announcement: null, poll_s: 0, asked: 0 };
    await installWall(page, st);
    await asTablet(page, 1366, 768);
    await page.goto('/?design=a#/');
    await expect(page.locator('sw-wall [data-wall-state="base"]')).toBeVisible();
    await expect(page.locator('sw-wall [data-wall-announcement]')).toHaveCount(0);
    expect(st.asked).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------- Settings and the announce form

interface Calls { method: string; path: string; body: Record<string, unknown> | null }

async function setupSettings(page: Page, opts: { screensEnabled: boolean }) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installCastMock(page, { perms: [...PERMS.admin, 'media.announce'] });
  const calls: Calls[] = [];
  const cfg = {
    enabled: true, engine: 'tts.demo_engine', engine_kind: 'local', cloud_enabled: false, cloud_key_set: false, emergency_languages: ['he', 'en', 'ru'], language: 'he', devices: ['sp-1'], max_per_minute: 6, max_text: 200, cooldown_s: 5, volume: null, pause_music: false,
    quiet: { enabled: false, from: '22:00', to: '07:00', days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], mode: 'suppress', night_volume: null },
    notify: { enabled: false, scope: 'area', ref: '', categories: [], min_severity: 'alert' },
    screens: { enabled: opts.screensEnabled, default_on: true, seconds: 30, critical_seconds: 180, poll_s: 5, targets: [] as { key: string; area_id: string | null; device_key: string | null }[] },
  };
  const options = () => ({
    screens: [{ key: 'board:b1', kind: 'board', name: 'לוח הלובי', area_id: null, device_key: null, allowed: false }, { key: 'wall:w1', kind: 'wall', name: 'קבלה', area_id: 'living', device_key: null, allowed: false }]
      .map((s) => { const t = cfg.screens.targets.find((x) => x.key === s.key); return t ? { ...s, allowed: true, area_id: t.area_id, device_key: t.device_key } : s; }),
    devices: [{ key: 'tv-1', name: 'טלוויזיה סלון', area_id: 'living' }],
  });
  const answer = () => ({ config: JSON.parse(JSON.stringify(cfg)), speakers: [{ key: 'sp-1', name: 'רמקול סלון', kind: 'speaker', floor_name: 'קומת קרקע', area_id: 'living', area_name: 'סלון', allowed: true }], engines: ['tts.demo_engine'], history: [], templates: [], screen_options: options() });
  await page.route(/\/api\/v1\/announcements(\/|\?|$)/, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/announcements\/?/, '');
    const body = req.postData() ? (JSON.parse(req.postData() as string) as Record<string, unknown>) : null;
    calls.push({ method: req.method(), path: p, body });
    if (p === 'config' && req.method() === 'GET') return json(route, answer());
    if (p === 'config' && req.method() === 'PUT') {
      Object.assign(cfg.screens, (body?.screens as object) ?? {});
      return json(route, { changed: ['screens'], ...answer() });
    }
    if (p === 'areas') return json(route, { enabled: true, max_text: 200, areas: [{ area_id: 'living', name: 'סלון', floor_name: 'קומת קרקע', devices: [{ key: 'sp-1', name: 'רמקול סלון' }], screens: 1 }], templates: [], languages: ['he', 'en', 'ru', 'ar'], default_language: 'he', emergency_languages: ['he', 'en', 'ru'], quiet_mode: 'suppress', screens_enabled: cfg.screens.enabled, screens_default_on: cfg.screens.default_on });
    if (p === '') return json(route, { id: 'x', status: 'sent', targets: 1, screens: 1 });
    return json(route, {});
  });
  return calls;
}

test.describe('settings and the announce form', () => {
  test('the screens card: off by default, saved at once, the allowed screens carry a room and a media screen', async ({ page }) => {
    const calls = await setupSettings(page, { screensEnabled: false });
    await page.goto('/?design=a#/system/multimedia?tab=announce');
    const card = page.locator('sw-app system-multimedia system-announcements [data-announce-screens]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-announce-screens-enabled]')).toBeVisible();
    await expect(card.locator('[data-announce-screens-seconds]')).toHaveValue('30');
    await expect(card.locator('[data-announce-screens-critical]')).toHaveValue('180');
    await expect(card.locator('[data-announce-screens-poll]')).toHaveValue('5');
    await card.locator('[data-announce-screens-enabled]').click();
    await expect.poll(() => calls.some((c) => c.method === 'PUT' && (c.body?.screens as { enabled?: boolean } | undefined)?.enabled === true)).toBe(true);
    await card.locator('[data-announce-screens-seconds]').fill('9999');
    await card.locator('[data-announce-screens-seconds]').dispatchEvent('change');
    await expect.poll(() => calls.some((c) => (c.body?.screens as { seconds?: number } | undefined)?.seconds === 600)).toBe(true);
    const row = card.locator('[data-announce-screen="board:b1"]');
    await expect(row.locator('[data-announce-screen-area]')).toBeDisabled();
    await row.locator('[data-announce-screen-allow]').check();
    await expect.poll(() => calls.some((c) => JSON.stringify((c.body?.screens as { targets?: unknown } | undefined)?.targets) === '[{"key":"board:b1","area_id":null,"device_key":null}]')).toBe(true);
    await row.locator('[data-announce-screen-area]').selectOption('living');
    await row.locator('[data-announce-screen-device]').selectOption('tv-1');
    await expect.poll(() => calls.some((c) => JSON.stringify((c.body?.screens as { targets?: unknown } | undefined)?.targets) === '[{"key":"board:b1","area_id":"living","device_key":"tv-1"}]')).toBe(true);
    await expect(card).not.toContainText(/home assistant|ingress/i);
  });

  test('the announce form offers the screens channel only while the server says screens are on; a send carries the chosen channels', async ({ page }) => {
    const calls = await setupSettings(page, { screensEnabled: false });
    await page.goto('/?design=a#/devices/announce');
    await expect(page.locator('devices-announce [data-announce-form]')).toBeVisible();
    await expect(page.locator('devices-announce [data-announce-via]')).toHaveCount(0);
    const p2 = await page.context().newPage();
    const calls2 = await setupSettings(p2, { screensEnabled: true });
    await p2.setViewportSize({ width: 1366, height: 768 });
    await p2.goto('/?design=a#/devices/announce');
    const via = p2.locator('devices-announce [data-announce-via]');
    await expect(via).toHaveCount(2);
    await expect(via.first()).toHaveAttribute('aria-pressed', 'true');
    await p2.locator('devices-announce [data-announce-text="he"]').fill('בדיקה');
    await via.first().click(); // speakers off: screens only
    await p2.locator('devices-announce [data-announce-send]').click();
    await expect.poll(() => calls2.some((c) => c.method === 'POST' && c.path === '' && c.body?.speakers === false && c.body?.screens === true)).toBe(true);
    await p2.locator('devices-announce [data-announce-text="he"]').fill('בדיקה');
    await expect(p2.locator('devices-announce [data-announce-send]')).not.toHaveAttribute('disabled', '');
    await via.nth(1).click(); // screens off too: nothing to send to
    await expect(p2.locator('devices-announce [data-announce-send]')).toHaveAttribute('disabled', '');
    const fit = await p2.evaluate(() => ({ h: document.documentElement.scrollHeight, w: innerHeight }));
    expect(fit.h).toBeLessThanOrEqual(fit.w + 1); // the control screen never scrolls at the reference size
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
