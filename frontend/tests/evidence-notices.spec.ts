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
    if (!enabled) return off();
    if (p === 'notices' && method === 'GET') {
      const scope = new URL(req.url()).searchParams.get('scope');
      if (scope === 'all' && !manager) return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'mock', details: {} }, 403);
      const list = manager ? NOTICES : NOTICES.filter((n) => n.state === 'active').map(({ audience: _a, status: _s, reads: _r, ...n }) => n);
      return json(route, { notices: list, can: CAN, now: NOW, defaults: { default_days: 7, default_severity: 'info' } });
    }
    if (p === 'notices' && method === 'POST') return json(route, { notice: { ...NOTICES[3], id: 'new1', ...(body as object) } });
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
