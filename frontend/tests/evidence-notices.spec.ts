import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';
import { lobbyFeed } from './notice-tv-fixtures';

// CR-NOTICE106 evidence: ראשי › לוח הודעות (#/devices/notices) and הגדרות › לוח הודעות (#/system/notices) with a board's page, from the
// REAL build against fake data (the generator mock layer serves the session; the notices routes are layered on top). The board's display
// tab previews the REAL TV page in an iframe (notice-tv.html?embed=1&preview=<id>), fed by the preview route of the mock.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-notices.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/notices');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = '2026-10-23T06:12:00Z';
const CAN = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true };

const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, boards_remote: false, boards_max: 10,
  weather_entity: 'weather.home', weather_fallback: false, news_custom: true, building_name: '', boards_origin: 'http://192.0.2.10:18094',
  news_sources: [{ id: 'ynet', name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml' }],
};
const BOARD = { id: 'b1', name: 'לוח הלובי', slug: 'lobby', enabled: true, display: lobbyFeed().board.display, has_token: true, token_rotated_at: '2026-10-15T08:00:00Z',
  last_seen_at: '2026-10-23T06:11:40Z', item_count: 2, created_at: '2026-10-02T08:00:00Z', updated_at: NOW };
const NOTICES = [
  { id: 'n1', title: 'הפסקת מים מחר 10:00-12:00', body: 'עקב עבודות תאגיד המים ברחוב.', severity: 'critical', starts_at: '2026-10-23T05:30:00Z', ends_at: '2026-10-24T09:00:00Z', pinned: true, state: 'active',
    dwell_s: null, when_text: null, published_at: '2026-10-23T05:40:00Z', updated_at: NOW, boards: ['b1'], read: false, audience: { everyone: true }, status: 'published', reads: 84 },
  { id: 'n2', title: 'טיפול במעלית הצפונית ביום שלישי', body: 'המעלית הצפונית תושבת בין 08:00 ל-14:00.', severity: 'alert', starts_at: '2026-10-22T13:00:00Z', ends_at: '2026-10-27T11:00:00Z', pinned: false,
    state: 'active', dwell_s: null, when_text: null, published_at: '2026-10-22T13:05:00Z', updated_at: NOW, boards: ['b1'], read: true, audience: { floors: ['f1'] }, status: 'published', reads: 51 },
  { id: 'n3', title: 'ניקוי חלונות חיצוני', body: 'צוות סנפלינג יעבוד על חזית הבניין.', severity: 'info', starts_at: '2026-11-02T06:00:00Z', ends_at: '2026-11-05T15:00:00Z', pinned: false, state: 'scheduled',
    dwell_s: 24, when_text: null, published_at: '2026-10-23T05:00:00Z', updated_at: NOW, boards: [], read: false, audience: { everyone: true }, status: 'published', reads: 0 },
  { id: 'n4', title: 'שינוי שעות קבלת קהל במשרד הניהול', body: '', severity: 'info', starts_at: '2026-10-23T06:00:00Z', ends_at: '2026-10-30T06:00:00Z', pinned: false, state: 'draft',
    dwell_s: null, when_text: null, published_at: null, updated_at: NOW, boards: [], read: false, audience: { everyone: true }, status: 'draft', reads: 0 },
];

async function install(page: Page, o: { enabled?: boolean; manager?: boolean } = {}): Promise<{ method: string; path: string; body: unknown }[]> {
  const enabled = o.enabled ?? true;
  const manager = o.manager ?? true;
  const perms = manager ? ['devices.read', 'notices.view', 'notices.manage', 'notices.push', 'notices.boards', 'system.configure'] : ['devices.read', 'notices.view'];
  await installGeneratorMock(page, { perms, count: 0, modules: { tickets: false, notices: enabled } as { tickets: boolean } });
  const calls: { method: string; path: string; body: unknown }[] = [];
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    let body: unknown = null;
    try { body = method === 'GET' ? null : req.postDataJSON(); } catch { body = null; }
    calls.push({ method, path: p, body });
    const off = () => json(route, { code: 'feature_disabled', user_message: 'לוח ההודעות כבוי בהגדרות המערכת.', retryable: false, correlation_id: 'mock', details: {} }, 404);
    if (p === 'notices/module') return json(route, { enabled, can: CAN });
    if (p === 'notices/settings' && method === 'GET') return json(route, { settings: { ...SETTINGS, enabled }, can: manager ? CAN : { ...CAN, boards: false, configure: false }, weather_entities: [{ entity_id: 'weather.home', name: 'בית' }], company_logo: false, listener: true, building_fallback: 'מגדל הים' });
    if (p === 'notices/settings') return json(route, { settings: { ...SETTINGS, ...(body as object) } });
    if (p === 'notices/tv-defaults' && method === 'PUT') {
      const b = body as Record<string, unknown>;
      const v2keys = ['design', 'board_layout', 'co_size', 'portrait_order', 'next_row'];
      const pick = (want: boolean) => Object.fromEntries(Object.entries(b).filter(([k]) => v2keys.includes(k) === want));
      return json(route, { tv_defaults: { header: 'c', updated: 'place', space: 'bigger', night_logo: 'auto', weather_days: 0, idle_logo: 'sw', ...pick(false) }, // TVNOTICE2-297
        tv2_defaults: { design: 'classic', board_layout: 'side', co_size: 'auto', portrait_order: 'bus', next_row: 'show', ...pick(true) } }); // BOARDV2-297
    }
    if (!enabled) return off();
    if (p === 'notices' && method === 'GET') {
      const scope = new URL(req.url()).searchParams.get('scope');
      if (scope === 'all' && !manager) return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'mock', details: {} }, 403);
      const list = manager ? NOTICES : NOTICES.filter((n) => n.state === 'active').map(({ audience: _a, status: _s, reads: _r, ...n }) => n);
      return json(route, { notices: list, can: CAN, now: NOW, defaults: { default_days: 7, default_severity: 'info' } });
    }
    if (p === 'notices' && method === 'POST') return json(route, { notice: { ...NOTICES[3], id: 'new1', ...(body as object) } });
    // NOTICEADD-295: edit / archive / delete of one notice
    const one = /^notices\/(n\d)(?:\/(archive|publish))?$/.exec(p);
    if (one) {
      const n = NOTICES.find((x) => x.id === one[1]);
      if (method === 'DELETE') return json(route, { deleted: true });
      return json(route, { notice: { ...n, ...(body as object), ...(one[2] === 'archive' ? { status: 'archived', state: 'archived' } : {}) } });
    }
    if (p === 'notices/boards' && method === 'GET') return json(route, { boards: [BOARD], full: true, max: 10, remote: false });
    if (p === 'notices/boards' && method === 'POST') return json(route, { board: { ...BOARD, id: 'b2', name: (body as { name: string }).name, slug: (body as { slug: string }).slug, item_count: 0, last_seen_at: null }, token: 'k9Qw2Lr7Vt3pXa8MbN4cHd6FeJ1sYz0uRiGo5wTqBv' });
    if (p === 'notices/boards/b1' && method === 'GET') return json(route, { board: BOARD, notices: NOTICES.slice(0, 2).map((n, i) => ({ ...n, position: i })) });
    if (p === 'notices/boards/b1' && method === 'PATCH') return json(route, { board: { ...BOARD, display: { ...BOARD.display, ...((body as { display?: object }).display ?? {}) } } });
    if (p === 'notices/boards/b1/preview') return json(route, lobbyFeed(((body as { display?: object } | null)?.display ?? {}) as never));
    if (p === 'notices/boards/b1/rotate-token') return json(route, { token: 'Zz9Qw2Lr7Vt3pXa8MbN4cHd6FeJ1sYz0uRiGo5wTqB', board: BOARD });
    if (p === 'notices/audience/preview') return json(route, { users: 118, in_scope: true });
    if (p === 'notices/audience/options') return json(route, { floors: [{ id: 'f1', name: 'קומה 1', building: 'מבנה א' }], groups: [{ id: 'g1', name: 'ועד הבית' }], roles: [{ id: 'viewer', name: 'צופה' }] });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return calls;
}

async function noOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`notices page, manager (${scheme})`, async ({ page }) => {
    await install(page);
    await page.goto('about:blank');
    await page.goto(url('/devices/notices', 'classic', scheme));
    const root = page.locator('sw-app devices-notices');
    await expect(root.locator('[data-kpis] .kpi')).toHaveCount(5);
    await expect(root.locator('[data-kpis] .kpi[data-k="all"] b')).toHaveText('2');
    await expect(root.locator('[data-kpis] .kpi[data-k="drafts"] b')).toHaveText('1');
    await root.locator('[data-kpis] .kpi[data-k="urgent"]').click();
    if (test.info().project.name !== 'mobile') await expect(root.locator('table.t tbody tr')).toHaveCount(1);
    await noOverflow(page);
    await shot(page, `page-manager-${scheme}`);
  });
}

test('compose: an urgent notice needs an end, a publish sends the draft', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  await root.locator('[data-compose]').first().click();
  const dlg = root.locator('[data-compose-dialog]');
  await dlg.locator('#nt-title').fill('הפסקת חשמל מתוכננת');
  await dlg.locator('[data-sev] button').nth(2).click();
  await dlg.locator('#nt-to').fill('');
  await dlg.locator('[data-publish]').click();
  await expect(dlg.locator('[data-compose-error]')).toHaveText('הודעה דחופה חייבת תאריך סיום');
  await dlg.locator('#nt-from').fill('2026-10-23T08:00');
  await dlg.locator('#nt-to').fill('2026-10-24T12:00');
  await dlg.locator('[data-boards] .pick').first().click();
  await shot(page, 'compose');
  await dlg.locator('[data-publish]').click();
  await expect.poll(() => calls.find((c) => c.method === 'POST' && c.path === 'notices')?.body).toMatchObject({ title: 'הפסקת חשמל מתוכננת', severity: 'critical', publish: true, boards: ['b1'], audience: { everyone: true } });
});

test('notices page, reader: the active notices only, no compose', async ({ page }) => {
  await install(page, { manager: false });
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  await expect(root.locator('[data-kpis] .kpi')).toHaveCount(3);
  await expect(root.locator('[data-compose]')).toHaveCount(0);
  await shot(page, 'page-reader');
});

test('module off: the page says so', async ({ page }) => {
  await install(page, { enabled: false });
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  await expect(page.locator('sw-app devices-notices [data-notices-state="off"]')).toBeVisible();
});

test('settings: module, defaults, boards; a new board shows its link once', async ({ page }) => {
  await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const root = page.locator('sw-app system-notices');
  await expect(root.locator('[data-module-card]')).toBeVisible();
  await expect(root.locator('[data-defaults-card]')).toBeVisible();
  if (test.info().project.name !== 'mobile') await expect(root.locator('tr[data-board="lobby"]')).toBeVisible();
  await noOverflow(page);
  await shot(page, 'settings');
  await root.locator('[data-new-board]').click();
  await root.locator('#nb-name').fill('לוח החניון');
  await root.locator('#nb-slug').fill('parking');
  await root.locator('[data-create]').click();
  await expect(root.locator('[data-board-link]')).toHaveText('http://192.0.2.10:18094/b/parking#t=k9Qw2Lr7Vt3pXa8MbN4cHd6FeJ1sYz0uRiGo5wTqBv');
  await expect(root.locator('[data-link-dialog] [data-sf-qr]')).toBeVisible();
  await shot(page, 'settings-link');
});

test('board page: the display tab previews the real TV page and saves the settings', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await root.locator('sw-tabs').getByText('תצוגה').click();
  const frame = page.frameLocator('sw-app system-notices iframe[data-preview]');
  await expect(frame.locator('#cv')).toHaveAttribute('data-tpl', '1');
  await root.locator('[data-tpls] [data-tpl="3"]').click();
  await expect(frame.locator('#cv')).toHaveAttribute('data-tpl', '3');
  await root.locator('[data-mode-seg] [data-mode="all"]').click();
  await expect(frame.locator('.stage.all')).toBeVisible();
  await shot(page, 'board-display');
  await root.locator('[data-save-display]').click();
  await expect.poll(() => (calls.find((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1')?.body as { display?: { template?: number; mode?: string } } | undefined)?.display).toMatchObject({ template: 3, mode: 'all' });
});

// TVOPT-295: the four screen choices of the one-row header review in the display tab: a board follows the installation default
// ("ברירת מחדל", pressed while the board has no own value) until it picks its own; the preview follows each choice, the freed-height
// choice waits for a one-row header, the logo layout applies to the header "as before" only, and the save sends the own values
// (null = back to the default).
test('board page: the header, "updated" line, freed height and night logo choices', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await root.locator('sw-tabs').getByText('תצוגה').click();
  const frame = page.frameLocator('sw-app system-notices iframe[data-preview]');
  await expect(frame.locator('#cv')).toHaveAttribute('data-header', 'c');
  const seg = (name: string) => root.locator(`notice-display-layout [data-seg="${name}"]`);
  for (const name of ['header', 'space', 'night-logo']) await expect(seg(name).locator('button')).toHaveCount(4);
  await expect(seg('updated').locator('button')).toHaveCount(5); // TVNOTICE2-297: default, place and time, time and board name, time, issues
  await expect(seg('idle-logo').locator('button')).toHaveCount(3); // TVNOTICE2-297: default, SmplWise only, the developer logo too
  await expect(seg('weather-days').locator('button')).toHaveCount(7); // default, as before, today only, 2..5 days
  await expect(seg('weather-days').locator('button[data-v="1"]')).toHaveText('היום בלבד');
  await expect(seg('header').locator('button[data-v="default"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator('notice-display-layout [data-default-note]').first()).toContainText('כמו היום');
  await expect(seg('space').locator('button').first()).toBeDisabled(); // only with a one-row header
  await expect(root.locator('notice-display-saver [data-logos-seg] button').first()).toBeEnabled();
  await seg('header').locator('button[data-v="a"]').click();
  await expect(seg('header').locator('button[data-v="a"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(frame.locator('#cv')).toHaveAttribute('data-header', 'a');
  await expect(frame.locator('.pg .hd.one[data-h="a"]')).toBeVisible();
  await expect(seg('space').locator('button').first()).toBeEnabled();
  await expect(root.locator('notice-display-saver [data-logos-seg] button').first()).toBeDisabled();
  await seg('updated').locator('button[data-v="time"]').click();
  await expect(frame.locator('#cv')).toHaveAttribute('data-updated', 'time');
  await seg('space').locator('button[data-v="mix"]').click();
  await expect(frame.locator('#cv')).toHaveAttribute('data-space', 'mix');
  await seg('night-logo').locator('button[data-v="invert"]').click();
  await expect(seg('night-logo').locator('button[data-v="invert"]')).toHaveAttribute('aria-pressed', 'true');
  await seg('weather-days').locator('button[data-v="4"]').click();
  await expect(frame.locator('#cv')).toHaveAttribute('data-tpl', '1');
  await seg('updated').locator('button[data-v="default"]').click(); // back to the installation default
  await expect(seg('updated').locator('button[data-v="default"]')).toHaveAttribute('aria-pressed', 'true');
  await noOverflow(page);
  await shot(page, 'board-display-tvopt');
  await root.locator('[data-save-display]').click();
  await expect.poll(() => (calls.find((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1')?.body as { display?: object } | undefined)?.display)
    .toMatchObject({ header: 'a', updated: null, space: 'mix', night_logo: 'invert', weather_days: 4 });
});

test('settings: the installation defaults of the TV options (TV boards card)', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const card = page.locator('sw-app system-notices [data-tv-defaults-card]');
  await expect(card).toBeVisible();
  const seg = (name: string) => card.locator(`notice-display-layout [data-seg="${name}"]`);
  for (const name of ['header', 'space', 'night-logo']) await expect(seg(name).locator('button')).toHaveCount(3); // no "default" button here
  await expect(seg('updated').locator('button')).toHaveCount(4);
  await expect(seg('updated').locator('button[data-v="place"]')).toHaveAttribute('aria-pressed', 'true'); // TVNOTICE2-297: the preview wording by default
  await expect(seg('idle-logo').locator('button[data-v="sw"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(seg('weather-days').locator('button')).toHaveCount(6);
  await expect(seg('weather-days').locator('button[data-v="0"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(seg('header').locator('button[data-v="c"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(seg('night-logo').locator('button[data-v="auto"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(seg('space').locator('button').first()).toBeDisabled();
  await seg('header').locator('button[data-v="b"]').click();
  await expect.poll(() => calls.find((c) => c.method === 'PUT' && c.path === 'notices/tv-defaults')?.body).toEqual({ header: 'b' });
  await expect(seg('header').locator('button[data-v="b"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(seg('space').locator('button').first()).toBeEnabled();
  await seg('night-logo').locator('button[data-v="plate"]').click();
  await seg('weather-days').locator('button[data-v="3"]').click();
  await expect.poll(() => calls.filter((c) => c.method === 'PUT' && c.path === 'notices/tv-defaults').map((c) => c.body)).toEqual([{ header: 'b' }, { night_logo: 'plate' }, { weather_days: 3 }]);
  await noOverflow(page);
  await shot(page, 'settings-tv-defaults');
});

// BOARDV2-297: the V2 board's options - on a board (with "default"), and as installation defaults in the TV boards card
test('board page: the V2 design and its options switch the preview; the V2-only rows wait for V2', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await root.locator('sw-tabs').getByText('תצוגה').click();
  const frame = page.frameLocator('sw-app system-notices iframe[data-preview]');
  await expect(frame.locator('#cv')).toHaveAttribute('data-design', 'classic');
  const seg = (name: string) => root.locator(`notice-display-design [data-seg="${name}"]`);
  // default + previous, V2, Ink, Sign (NOTICEBOARD-STYLES-2300) + the six lobby styles lumen / axis / prism / gallery / concierge / stone
  // (LOBBY-STYLES-2300, owner decisions 2026-10-30)
  await expect(seg('design').locator('button')).toHaveCount(11);
  await expect(seg('design').locator('button[data-v="stone"]')).toBeEnabled();
  await expect(seg('board-layout').locator('button')).toHaveCount(4);
  await expect(seg('co-size').locator('button')).toHaveCount(6);
  await expect(seg('portrait-order').locator('button')).toHaveCount(3);
  await expect(seg('next-row').locator('button')).toHaveCount(3);
  for (const name of ['board-layout', 'co-size', 'portrait-order', 'next-row']) await expect(seg(name).locator('button').first()).toBeDisabled();
  // the lobby styles' behaviour rows (LOBBY-STYLES-2300) are not V2-only: editable on the previous design too
  for (const [name, n] of [['live-bg', 5], ['systems-status', 3], ['urgent-screen', 4]] as const) {
    await expect(seg(name).locator('button')).toHaveCount(n);
    await expect(seg(name).locator('button').first()).toBeEnabled();
  }
  await seg('design').locator('button[data-v="v2"]').click();
  await expect(frame.locator('#cv')).toHaveAttribute('data-design', 'v2');
  await expect(frame.locator('.pg .b2hd')).toBeVisible();
  for (const name of ['board-layout', 'co-size', 'portrait-order', 'next-row']) await expect(seg(name).locator('button').first()).toBeEnabled();
  await seg('board-layout').locator('button[data-v="strip"]').click();
  await expect(frame.locator('.b2bd')).toHaveAttribute('data-l', 'strip');
  await seg('co-size').locator('button[data-v="l"]').click();
  await seg('next-row').locator('button[data-v="hide"]').click();
  await noOverflow(page);
  await shot(page, 'board-display-v2');
  await root.locator('[data-save-display]').click();
  await expect.poll(() => (calls.find((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1')?.body as { display?: object } | undefined)?.display)
    .toMatchObject({ design: 'v2', board_layout: 'strip', co_size: 'l', next_row: 'hide' });
});

test('settings: the V2 defaults (design, default layout, logo size, portrait order, "next" row) in the TV boards card', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const card = page.locator('sw-app system-notices [data-tv-defaults-card]');
  await expect(card).toBeVisible();
  const seg = (name: string) => card.locator(`notice-display-design [data-seg="${name}"]`);
  await expect(seg('design').locator('button[data-v="classic"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(seg('board-layout').locator('button')).toHaveCount(3); // no "default" button here
  await expect(card.locator('notice-display-design')).toContainText('פריסת ברירת מחדל');
  await expect(seg('board-layout').locator('button').first()).toBeEnabled(); // the defaults stay editable before the switch
  await seg('board-layout').locator('button[data-v="slide"]').click();
  await seg('design').locator('button[data-v="v2"]').click();
  await expect(seg('design').locator('button[data-v="v2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => calls.filter((c) => c.method === 'PUT' && c.path === 'notices/tv-defaults').map((c) => c.body)).toEqual([{ board_layout: 'slide' }, { design: 'v2' }]);
  await noOverflow(page);
  await shot(page, 'settings-tv2-defaults');
});

test('settings: the TV defaults card needs the screen settings permission', async ({ page }) => {
  await install(page, { manager: false });
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  await expect(page.locator('sw-app system-notices [data-tv-defaults-card]')).toHaveCount(0);
});

// NOTICEADD-295: the board's "הודעות" tab writes, edits and archives notices (2.16.0 offered only a picker of existing notices, and nothing
// at all while there were none); the settings page opens the same dialog; the rail carries "לוח הודעות" while the module is on.
test('board page: a new notice for the board, edit and archive from the notices tab', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await root.locator('sw-tabs').getByText('הודעות').click();
  await root.locator('[data-board-compose]').click();
  const dlg = root.locator('[data-compose-dialog]');
  await expect(dlg.locator('[data-aud] button[data-a="tv"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(dlg.locator('[data-board-pick="b1"]')).toHaveAttribute('aria-pressed', 'true');
  await dlg.locator('#nt-title').fill('ניקיון חדר האשפה');
  await noOverflow(page);
  await shot(page, 'board-compose');
  await dlg.locator('[data-publish]').click();
  await expect.poll(() => calls.find((c) => c.method === 'POST' && c.path === 'notices')?.body).toMatchObject({ title: 'ניקיון חדר האשפה', publish: true, boards: ['b1'], audience: {} });
  await expect(root.locator('[data-compose-dialog]')).toHaveCount(0);
  // edit the first notice of the board, then archive it (asked once in the dialog)
  await root.locator('tr[data-board-notice="n1"] [data-edit-notice]').click();
  await expect(dlg.locator('#nt-title')).toHaveValue('הפסקת מים מחר 10:00-12:00');
  await dlg.locator('#nt-title').fill('הפסקת מים מחר 10:00-13:00');
  await dlg.locator('[data-publish]').click();
  await expect.poll(() => calls.find((c) => c.method === 'PATCH' && c.path === 'notices/n1')?.body).toMatchObject({ title: 'הפסקת מים מחר 10:00-13:00' });
  await root.locator('tr[data-board-notice="n1"] [data-edit-notice]').click();
  await dlg.locator('[data-remove-notice]').click();
  expect(calls.some((c) => c.path === 'notices/n1/archive')).toBe(false);
  await dlg.locator('[data-remove-notice]').click();
  await expect.poll(() => calls.some((c) => c.method === 'POST' && c.path === 'notices/n1/archive')).toBe(true);
});

test('board page: an empty board offers the new notice right away', async ({ page }) => {
  await install(page);
  await page.route('**/api/v1/notices/boards/b1', (route) => (route.request().method() === 'GET' ? json(route, { board: { ...BOARD, item_count: 0 }, notices: [] }) : route.fallback()));
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await root.locator('sw-tabs').getByText('הודעות').click();
  await expect(root.locator('[data-board-compose]')).toBeVisible();
  await root.locator('sw-state-panel').getByRole('button').click();
  await expect(root.locator('[data-compose-dialog] [data-board-pick="b1"]')).toHaveAttribute('aria-pressed', 'true');
});

test('settings page: a new notice opens the same dialog', async ({ page }) => {
  await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const root = page.locator('sw-app system-notices');
  await root.locator('[data-new-notice]').click();
  await expect(root.locator('[data-compose-dialog] [data-aud] button[data-a="all"]')).toHaveAttribute('aria-pressed', 'true');
});

test('the rail carries לוח הודעות while the module is on, and lights it on its page', async ({ page }) => {
  await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const entry = page.locator('sw-app [data-nav="notices"]');
  await expect(entry.first()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('sw-app [data-nav="devices"]').first()).toHaveAttribute('aria-current', 'false');
});

test('module off: no לוח הודעות in the rail', async ({ page }) => {
  await install(page, { enabled: false });
  await page.goto('about:blank');
  await page.goto(url('/devices/building'));
  await expect(page.locator('sw-app [data-nav="devices"]').first()).toBeAttached();
  await expect(page.locator('sw-app [data-nav="notices"]')).toHaveCount(0);
});

// NOTICEGB-295 slice B: the building-status chip picker of the display tab (states only; the server shows a chip only for a kind it has).
test('board page: the building-status picker saves blocks.info in the picker order', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await root.locator('sw-tabs').getByText('תצוגה').click();
  const picker = root.locator('notice-display-info');
  await expect(picker.locator('[data-info="elevators"]')).toBeChecked();
  await expect(picker.locator('[data-info="gym"]')).not.toBeChecked();
  await picker.locator('[data-info="parking"]').uncheck();
  await picker.locator('[data-info="gym"]').check();
  await root.locator('[data-save-display]').click();
  await expect.poll(() => (calls.find((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1')?.body as { display?: { blocks?: { info?: string[] } } } | undefined)?.display?.blocks?.info)
    .toEqual(['elevators', 'generator', 'gym']);
});

// NOTICEPOLISH-295: the settings polish - one logo place (a link), retention as a choice, boards-table and board-header actions, place presets.
test('settings polish: no logo upload here, retention is a choice, a row offers copy link / open', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const root = page.locator('sw-app system-notices');
  await expect(root.locator('[data-defaults-card]')).toBeVisible();
  await expect(root.locator('[data-defaults-card] input[type="file"]')).toHaveCount(0);
  await expect(root.locator('[data-logo-link]')).toHaveAttribute('href', '#/system/diagnostics?tab=general');
  await expect(root.locator('#ns-ret')).toHaveValue('365');
  await root.locator('#ns-ret').selectOption('180');
  await expect.poll(() => calls.find((c) => c.method === 'PATCH' && c.path === 'notices/settings')?.body).toMatchObject({ retention_days: 180 });
  if (test.info().project.name === 'mobile') return;
  const row = root.locator('tr[data-board="lobby"]');
  await expect(row.locator('[data-activate]')).toHaveCount(0);
  await expect(row.locator('[data-copy-link]')).toBeVisible();
  // "copy" re-issues the link after a confirmation (the stored token is a hash), then shows it
  await row.locator('[data-copy-link]').click();
  await expect(root.locator('[data-rotate-go]')).toBeVisible();
  expect(calls.some((c) => c.path.endsWith('rotate-token'))).toBe(false);
  await root.locator('[data-rotate-go]').click();
  await expect(root.locator('[data-board-link]')).toContainText('#t=');
  expect(calls.filter((c) => c.path.endsWith('rotate-token')).length).toBe(1);
});

test('settings polish: a disabled board offers הפעלה, which turns it on', async ({ page }) => {
  const calls = await install(page);
  await page.route('**/api/v1/notices/boards', (route) => (route.request().method() === 'GET' ? json(route, { boards: [{ ...BOARD, enabled: false }], full: true, max: 10, remote: false }) : route.fallback()));
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const root = page.locator('sw-app system-notices');
  if (test.info().project.name === 'mobile') return;
  await root.locator('tr[data-board="lobby"] [data-activate]').click();
  await expect.poll(() => calls.find((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1')?.body).toMatchObject({ enabled: true });
});

test('settings polish: without system.configure nobody is offered the link copy', async ({ page }) => {
  await install(page);
  await page.route('**/api/v1/notices/settings', (route) => (route.request().method() === 'GET'
    ? json(route, { settings: SETTINGS, can: { ...CAN, configure: false }, weather_entities: [], company_logo: false, listener: true, building_fallback: 'מגדל הים' }) : route.fallback()));
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await expect(root.locator('[data-tv-open]')).toBeVisible();
  await expect(root.locator('[data-copy-link]')).toHaveCount(0);
  await expect(root.locator('[data-rotate]')).toBeVisible();
});

test('board header: open the TV screen, copy link (administrator), new link; the place is a choice of floors', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await expect(root.locator('[data-tv-open]')).toBeVisible();
  await expect(root.locator('[data-copy-link]')).toBeVisible();
  await root.locator('[data-rotate]').click();
  await expect(root.locator('[data-rotate-go]')).toBeVisible();
  await root.locator('[data-rotate-confirm] sw-button').first().click();
  expect(calls.some((c) => c.path.endsWith('rotate-token'))).toBe(false);
  const sel = root.locator('[data-place-select]');
  await expect(sel).toBeVisible();
  await expect(sel.locator('option')).toContainText(['-', 'קומה 1 · מבנה א', 'אחר...']);
  await sel.selectOption({ label: 'קומה 1 · מבנה א' });
  await root.locator('sw-button[variant="primary"]', { hasText: 'שמירה' }).first().click();
  await expect.poll(() => (calls.find((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1')?.body as { display?: { place?: string } } | undefined)?.display?.place).toBe('קומה 1 · מבנה א');
});

// NOTICEPUSH-295: the compose dialog's "שליחת התראה לנמענים בפרסום" and the defaults card's "התראה בפרסום"
test('push: the checkbox follows the severity default, the tick is sent, a TV-only audience disables it', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  await root.locator('[data-compose]').first().click();
  const dlg = root.locator('[data-compose-dialog]');
  const box = dlg.locator('[data-push]');
  await expect(dlg.locator('[data-push-row]')).toContainText('פעם אחת, בערוצים שכל נמען בחר');
  await expect(box).not.toBeChecked();
  await dlg.locator('#nt-title').fill('הודעה רגילה');
  await dlg.locator('[data-publish]').click();
  await expect.poll(() => calls.find((c) => c.method === 'POST' && c.path === 'notices')?.body).toMatchObject({ title: 'הודעה רגילה', publish: true, push: false });
  await root.locator('[data-compose]').first().click();
  await dlg.locator('[data-sev] button').nth(2).click();
  await expect(box).toBeChecked();
  await dlg.locator('[data-aud] button[data-a="tv"]').click();
  await expect(box).toBeDisabled();
  await expect(box).not.toBeChecked();
  await dlg.locator('[data-aud] button[data-a="all"]').click();
  await expect(box).toBeEnabled();
  await box.uncheck();
  await dlg.locator('#nt-title').fill('דחוף בשקט');
  await dlg.locator('#nt-to').fill('2099-12-24T12:00');
  await dlg.locator('[data-publish]').click();
  await expect.poll(() => calls.filter((c) => c.method === 'POST' && c.path === 'notices').pop()?.body).toMatchObject({ title: 'דחוף בשקט', severity: 'critical', push: false });
});

test('push: a writer without notices.push sees the checkbox disabled and sends no tick; a published notice has no checkbox', async ({ page }) => {
  const calls = await install(page);
  await page.route((u) => u.pathname.endsWith('/api/v1/notices') && u.searchParams.get('scope') === 'all', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ notices: NOTICES, can: { ...CAN, push: false }, now: NOW, defaults: { default_days: 7, default_severity: 'info' } }) }));
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  await root.locator('[data-compose]').first().click();
  const dlg = root.locator('[data-compose-dialog]');
  await expect(dlg.locator('[data-push]')).toBeDisabled();
  await expect(dlg.locator('[data-push-row]')).toContainText('דורשת הרשאה');
  await dlg.locator('#nt-title').fill('בלי הרשאה');
  await dlg.locator('[data-publish]').click();
  await expect.poll(() => calls.find((c) => c.method === 'POST' && c.path === 'notices')?.body).toMatchObject({ title: 'בלי הרשאה', publish: true });
  expect((calls.find((c) => c.method === 'POST' && c.path === 'notices')?.body as Record<string, unknown>).push).toBeUndefined();
});

test('push: the defaults card chooses לפי חומרה / תמיד / אף פעם', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const sel = page.locator('sw-app system-notices [data-defaults-card] #ns-push');
  await expect(sel.locator('option')).toHaveText(['לפי חומרה', 'תמיד', 'אף פעם']);
  await sel.selectOption('always');
  await expect.poll(() => calls.find((c) => c.method === 'PATCH' && c.path === 'notices/settings')?.body).toMatchObject({ push_default: 'always' });
});
